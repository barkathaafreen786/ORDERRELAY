const SANDBOX = 'https://api-m.sandbox.paypal.com';

export class PayPalError extends Error {
  constructor(status, issue) {
    super(issue);
    this.status = status;
  }
}

export function createPayPal({ clientId, secret, request = fetch }) {
  let token;
  let expiresAt = 0;

  async function accessToken() {
    if (token && Date.now() < expiresAt) return token;
    if (!clientId || !secret) throw new PayPalError(503, 'Add PayPal sandbox app credentials to .env and restart.');
    const response = await request(SANDBOX + '/v1/oauth2/token', {
      method: 'POST',
      headers: {
        Authorization: 'Basic ' + Buffer.from(clientId + ':' + secret).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
      signal: AbortSignal.timeout(12000),
    });
    if (!response.ok) throw new PayPalError(502, 'PayPal sandbox authentication failed. Check your sandbox app credentials.');
    const payload = await response.json();
    token = payload.access_token;
    expiresAt = Date.now() + Math.max(0, payload.expires_in - 60) * 1000;
    return token;
  }

  async function orders(path, body, requestId, retry = true) {
    const headers = { Authorization: 'Bearer ' + await accessToken(), Accept: 'application/json' };
    if (body) {
      headers['Content-Type'] = 'application/json';
      headers.Prefer = 'return=representation';
      headers['PayPal-Request-Id'] = requestId;
    }
    const response = await request(SANDBOX + '/v2/checkout/orders' + path, {
      method: body ? 'POST' : 'GET', headers, body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(12000),
    });
    if (response.status === 401 && retry) {
      token = undefined;
      return orders(path, body, requestId, false);
    }
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      if (response.status === 404) throw new PayPalError(404, 'PayPal could not find this sandbox order under this app.');
      const issue = data.details?.[0]?.issue || data.name;
      const suffix = issue && /^[A-Z_]+$/.test(issue) ? ' (' + issue + ')' : '';
      throw new PayPalError(502, 'PayPal sandbox rejected the request' + suffix + '.');
    }
    return data;
  }

  return {
    getOrder: id => orders('/' + encodeURIComponent(id)),
    createDemoOrder: (origin, requestId) => orders('', {
      intent: 'CAPTURE',
      purchase_units: [{ description: 'OrderRelay sandbox sample order', amount: { currency_code: 'USD', value: '24.00' } }],
      payment_source: { paypal: { experience_context: {
        shipping_preference: 'NO_SHIPPING', user_action: 'PAY_NOW', landing_page: 'LOGIN',
        return_url: origin + '/?checkout=approved', cancel_url: origin + '/?checkout=cancelled',
      } } },
    }, requestId),
    captureDemoOrder: id => orders('/' + encodeURIComponent(id) + '/capture', {}, 'orderrelay-cap-' + id),
  };
}
