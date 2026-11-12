const byId = id => document.getElementById(id);
const sampleTickets = {
  approved: 'I approved checkout and the page froze. I’m worried I’ll pay twice if I try again.',
  paid: 'I’ve contacted support twice because my order confirmation never arrived. Can someone check?',
  pending: 'I see something processing in my wallet. Can you tell me what happened?',
};
const form = byId('case-form');
const ticket = byId('ticket');
const scenario = byId('scenario');
const orderId = byId('order-id');
const capture = byId('capture');
const create = byId('create');
const run = byId('investigate');
const buttons = [...document.querySelectorAll('[data-source]')];
let source = 'sample';
let busy = false;
let checkoutOrder = '';
let checkoutRequestId;

function setStatus(message = '', error = false) {
  const status = byId('status');
  status.textContent = message;
  status.classList.toggle('error', error);
}

function resetResult() {
  for (const id of ['source-tag', 'draft-tag', 'evidence-content', 'draft-content']) byId(id).hidden = true;
  byId('placeholder').hidden = false;
  byId('draft-placeholder').hidden = false;
  byId('copy').textContent = 'Copy reply';
}

function setSource(value) {
  source = value;
  for (const button of buttons) button.setAttribute('aria-pressed', String(button.dataset.source === source));
  byId('sample-fields').hidden = source !== 'sample';
  byId('sandbox-fields').hidden = source !== 'sandbox';
  ticket.value = source === 'sample' ? sampleTickets[scenario.value] : '';
  byId('source-note').textContent = source === 'sample'
    ? 'Sample records let you try the workflow without credentials.'
    : 'Sandbox uses test money. Add sandbox app credentials to connect.';
  orderId.required = source === 'sandbox';
  resetResult();
  setStatus();
}

async function api(path, data) {
  const response = await fetch('/api/' + path, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Could not complete the request.');
  return result;
}

function setBusy(value) {
  busy = value;
  for (const element of [...buttons, run, create, capture, scenario, orderId, ticket]) element.disabled = value;
  form.setAttribute('aria-busy', String(value));
}

function addFact(label, value, isCapture = false) {
  const row = document.createElement('div');
  const name = document.createElement('dt');
  const content = document.createElement('dd');
  name.textContent = label;
  content.textContent = value;
  row.append(name, content);
  row.classList.toggle('capture', isCapture);
  byId('facts').append(row);
}

function showResult(result) {
  byId('placeholder').hidden = true;
  byId('evidence-content').hidden = false;
  byId('source-tag').hidden = false;
  byId('source-tag').textContent = result.source;
  byId('verdict').className = 'verdict ' + result.decision.tone;
  byId('result-label').textContent = result.decision.label;
  byId('explanation').textContent = result.decision.explanation;
  byId('facts').replaceChildren();
  addFact('Order ID', result.orderId || 'Unavailable');
  addFact('Order state', result.orderStatus || 'Unavailable');
  addFact('Intent', result.intent || 'Unavailable');
  const captures = result.units.flatMap(unit => unit.captures);
  if (!captures.length) addFact('Capture records', 'None reported', true);
  for (const payment of captures) {
    const amount = payment.amount ? payment.amount.currency_code + ' ' + payment.amount.value : 'Amount unavailable';
    addFact('Capture ' + (payment.id || 'ID unavailable'), payment.status + ' · ' + amount, true);
  }
  byId('action').textContent = result.decision.action;
  byId('draft-placeholder').hidden = true;
  byId('draft-content').hidden = false;
  byId('draft-tag').hidden = false;
  byId('draft-tag').textContent = result.draft.mode;
  byId('draft-note').textContent = result.draft.note;
  byId('reply').value = result.draft.text;
}

async function investigate() {
  resetResult();
  setStatus('Checking payment evidence…');
  const result = await api('investigate', { source, ticket: ticket.value, scenario: scenario.value, orderId: orderId.value.trim().toUpperCase() });
  showResult(result);
  setStatus('Case checked. Review the reply before sharing.');
}

async function perform(task) {
  if (busy) return;
  setBusy(true);
  try {
    await task();
  } catch (error) {
    setStatus(error.message, true);
  } finally {
    setBusy(false);
  }
}

for (const button of buttons) button.addEventListener('click', () => setSource(button.dataset.source));
scenario.addEventListener('change', () => setSource('sample'));
orderId.addEventListener('input', () => {
  capture.hidden = orderId.value.trim().toUpperCase() !== checkoutOrder || !checkoutOrder;
  resetResult();
  setStatus();
});
form.addEventListener('submit', event => {
  event.preventDefault();
  perform(investigate);
});
create.addEventListener('click', () => perform(async () => {
  setStatus('Creating a PayPal sandbox checkout…');
  checkoutRequestId ??= crypto.randomUUID();
  const order = await api('sandbox/create', { requestId: checkoutRequestId });
  window.location.assign(order.approvalUrl);
}));
capture.addEventListener('click', () => perform(async () => {
  resetResult();
  setStatus('Capturing the test payment…');
  await api('sandbox/capture', { orderId: checkoutOrder });
  capture.hidden = true;
  byId('sandbox-message').textContent = 'Capture requested. The evidence panel shows PayPal’s latest state.';
  await investigate();
}));
byId('copy').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(byId('reply').value);
    byId('copy').textContent = 'Copied';
  } catch {
    byId('reply').focus();
    byId('reply').select();
    setStatus('Reply selected. Use your system copy shortcut.');
  }
});

setSource('sample');
const params = new URLSearchParams(location.search);
if (params.has('checkout')) {
  setSource('sandbox');
  const token = params.get('token') || '';
  if (params.get('checkout') === 'approved' && /^[A-Z0-9]{5,36}$/.test(token)) {
    orderId.value = checkoutOrder = token;
    capture.hidden = false;
    byId('sandbox-message').textContent = 'Returned from PayPal. Investigate now to see the approved order before capture.';
  } else {
    byId('sandbox-message').textContent = 'Checkout ended without an approval result.';
  }
}
fetch('/api/config').then(response => response.json()).then(config => {
  byId('config').textContent = (config.sandbox ? 'Sandbox configured' : 'Sandbox setup required') + ' · Local AI';
}).catch(() => {});
