import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { createPayPal, PayPalError } from './paypal.js';
import { draftUpdate, investigate } from './investigate.js';
import { examples } from './fixtures.js';

const files = new Map([
  ['/', ['index.html', 'text/html; charset=utf-8']],
  ['/style.css', ['style.css', 'text/css; charset=utf-8']],
  ['/app.js', ['app.js', 'text/javascript; charset=utf-8']],
]);
const orderIdPattern = /^[A-Z0-9]{5,36}$/;

function reply(response, status, payload) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(payload));
}

async function readBody(request) {
  if (request.headers['content-type'] !== 'application/json') throw new PayPalError(415, 'Use a JSON request.');
  let body = '';
  for await (const chunk of request) {
    body += chunk;
    if (body.length > 4096) throw new PayPalError(413, 'Request is too large.');
  }
  const value = JSON.parse(body);
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new PayPalError(400, 'Expected a JSON object.');
  return value;
}

export function buildServer({ env = process.env, paypal } = {}) {
  paypal ??= createPayPal({ clientId: env.PAYPAL_CLIENT_ID, secret: env.PAYPAL_CLIENT_SECRET });
  const sessions = new Map();
  const server = createServer(async (request, response) => {
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Content-Security-Policy', "default-src 'self'; frame-ancestors 'none'; base-uri 'none'");
    response.setHeader('Referrer-Policy', 'no-referrer');
    try {
      const allowed = ['127.0.0.1:', 'localhost:'].map(host => host + server.address().port);
      if (env.RENDER_EXTERNAL_HOSTNAME) allowed.push(env.RENDER_EXTERNAL_HOSTNAME);
      if (!allowed.includes(request.headers.host)) return reply(response, 403, { error: 'Use the local address shown in the terminal.' });
      const protocol = env.RENDER_EXTERNAL_HOSTNAME ? 'https' : 'http';
      const origin = protocol + '://' + request.headers.host;
      const { pathname } = new URL(request.url, origin);
      if (request.method === 'GET' && files.has(pathname)) {
        const [name, type] = files.get(pathname);
        const contents = await readFile(new URL('./public/' + name, import.meta.url));
        response.writeHead(200, { 'Content-Type': type });
        return response.end(contents);
      }
      if (request.method === 'GET' && pathname === '/api/config') {
        return reply(response, 200, { sandbox: Boolean(env.PAYPAL_CLIENT_ID && env.PAYPAL_CLIENT_SECRET) });
      }
      if (request.method !== 'POST' || !pathname.startsWith('/api/')) return reply(response, 404, { error: 'Page not found.' });
      if (request.headers.origin !== origin) return reply(response, 403, { error: 'Open OrderRelay in your browser to run this action.' });
      const data = await readBody(request);
      if (pathname === '/api/investigate') {
        const ticket = typeof data.ticket === 'string' ? data.ticket.trim().slice(0, 700) : '';
        const sample = data.source === 'sample' && Object.hasOwn(examples, data.scenario) ? examples[data.scenario] : null;
        if (!sample && (data.source !== 'sandbox' || typeof data.orderId !== 'string' || !orderIdPattern.test(data.orderId))) {
          return reply(response, 400, { error: 'Choose a sample or enter a valid PayPal sandbox order ID.' });
        }
        const result = investigate(sample ? sample.order : await paypal.getOrder(data.orderId));
        const draft = draftUpdate(result, ticket);
        return reply(response, 200, { ...result, draft, source: sample ? 'Sample data' : 'PayPal sandbox' });
      }
      if (pathname === '/api/sandbox/create') {
        const now = Date.now();
        for (const [id, entry] of sessions) {
          if (entry.expiresAt <= now) sessions.delete(id);
        }
        const priorId = request.headers.cookie?.match(/(?:^|;\s*)relay=([a-f0-9-]{36})(?:;|$)/)?.[1];
        const sessionId = sessions.has(priorId) ? priorId : randomUUID();
        const entry = sessions.get(sessionId) ?? { expiresAt: now + 7200000, orders: new Set() };
        sessions.set(sessionId, entry);
        response.setHeader('Set-Cookie', 'relay=' + sessionId + '; HttpOnly; SameSite=Lax; Path=/; Max-Age=7200' + (protocol === 'https' ? '; Secure' : ''));
        if (typeof data.requestId !== 'string' || !/^[a-f0-9-]{36}$/.test(data.requestId)) {
          return reply(response, 400, { error: 'Invalid checkout request ID.' });
        }
        const order = await paypal.createDemoOrder(origin, data.requestId);
        const link = order.links?.find(item => ['payer-action', 'approve'].includes(item.rel))?.href;
        if (!link || new URL(link).origin !== 'https://www.sandbox.paypal.com') {
          throw new PayPalError(502, 'PayPal did not return a sandbox approval link.');
        }
        entry.orders.add(order.id);
        return reply(response, 200, { orderId: order.id, approvalUrl: link });
      }
      if (pathname === '/api/sandbox/capture') {
        const id = request.headers.cookie?.match(/(?:^|;\s*)relay=([a-f0-9-]{36})(?:;|$)/)?.[1];
        const entry = sessions.get(id);
        if (!entry || entry.expiresAt <= Date.now() || !entry.orders.has(data.orderId)) {
          return reply(response, 403, { error: 'Only an order created in this browser session can be captured here.' });
        }
        const current = await paypal.getOrder(data.orderId);
        if (current.status === 'COMPLETED') return reply(response, 200, { orderId: current.id, status: current.status });
        if (current.status !== 'APPROVED') return reply(response, 409, { error: 'Approve this order in PayPal sandbox before capturing it.' });
        const order = await paypal.captureDemoOrder(data.orderId);
        return reply(response, 200, { orderId: order.id, status: order.status });
      }
      return reply(response, 404, { error: 'Action not found.' });
    } catch (error) {
      if (error instanceof PayPalError) return reply(response, error.status, { error: error.message });
      if (error instanceof SyntaxError) return reply(response, 400, { error: 'Invalid JSON.' });
      if (['TimeoutError', 'TypeError'].includes(error.name)) return reply(response, 502, { error: 'A service could not be reached. Check your connection and try again.' });
      console.error(error.name);
      return reply(response, 500, { error: 'OrderRelay hit an unexpected error.' });
    }
  });
  return server;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = Number(process.env.PORT || 3000);
  const server = buildServer();
  const host = process.env.RENDER ? '0.0.0.0' : '127.0.0.1';
  server.listen(port, host, () => console.log('OrderRelay is ready on port ' + server.address().port));
}
