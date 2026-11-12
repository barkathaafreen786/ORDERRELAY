import { predictTone } from './tone.js';

const replies = {
  paid: {
    label: 'Payment captured', tone: 'green',
    explanation: 'PayPal reports a completed capture covering the full order.',
    action: 'Check your store order and fulfillment status before promising delivery.',
    message: 'Thanks for checking in. We confirmed that PayPal completed the payment for your order. We’ll check its fulfillment status separately and share an update.',
  },
  approved: {
    label: 'Approved · capture unconfirmed', tone: 'amber',
    explanation: 'The buyer approved checkout, and PayPal shows no capture or authorization record.',
    action: 'Check your checkout integration for a capture attempt before asking the buyer to retry.',
    message: 'Thanks for reaching out. PayPal shows that you approved checkout, and we’re checking whether the payment went through. Please hold off on trying again while we verify it.',
  },
  pending: {
    label: 'Capture pending', tone: 'amber',
    explanation: 'At least one capture is pending and PayPal has yet to confirm the full order amount.',
    action: 'Recheck the capture before fulfilling the order or requesting another payment.',
    message: 'Thanks for checking in. PayPal is still processing the payment. We’ll check again and share an update once its status is confirmed.',
  },
  refunded: {
    label: 'Refund recorded', tone: 'blue',
    explanation: 'PayPal reports a fully or partially refunded capture.',
    action: 'Check the refund record before confirming its amount or arrival date.',
    message: 'Thanks for reaching out. PayPal shows a refund on this payment. We’ll check the refund details and share what we can confirm.',
  },
  checkout: {
    label: 'Checkout incomplete', tone: 'amber',
    explanation: 'PayPal shows that checkout started, with no buyer approval or capture on this order.',
    action: 'Check for a separate order or payment before advising the buyer to retry.',
    message: 'Thanks for reaching out. PayPal shows that checkout started and we haven’t confirmed a payment on this order. We’ll check for a separate payment before advising you on what to do next.',
  },
  review: {
    label: 'Needs seller review', tone: 'amber',
    explanation: 'The order and capture records do not establish a completed payment for the full order.',
    action: 'Review the capture or authorization records in PayPal before taking action.',
    message: 'Thanks for reaching out. We’re reviewing the PayPal payment records for your order. Please hold off on trying again while we verify the status.',
  },
};

function amountUnits(amount) {
  if (!/^\d{1,9}(\.\d{1,3})?$/.test(amount?.value || '')) return null;
  const [whole, fraction = ''] = amount.value.split('.');
  return Number(whole) * 1000 + Number(fraction.padEnd(3, '0'));
}

function coversAmount(unit) {
  const due = amountUnits(unit.amount);
  if (!due || !unit.amount.currency_code) return false;
  const captures = unit.payments?.captures ?? [];
  const completed = captures.filter(capture => capture.status === 'COMPLETED');
  if (!completed.length || captures.some(capture => capture.status !== 'COMPLETED')) return false;
  const matched = completed.every(capture => capture.amount?.currency_code === unit.amount.currency_code && amountUnits(capture.amount) !== null);
  return matched && completed.reduce((total, capture) => total + amountUnits(capture.amount), 0) === due;
}

export function investigate(order) {
  const units = order.purchase_units ?? [];
  const captures = units.flatMap(unit => unit.payments?.captures ?? []);
  const authorized = units.flatMap(unit => unit.payments?.authorizations ?? []).length > 0;
  let state = 'review';
  if (captures.some(capture => ['REFUNDED', 'PARTIALLY_REFUNDED'].includes(capture.status))) state = 'refunded';
  else if (order.status === 'COMPLETED' && order.intent === 'CAPTURE' && units.length && units.every(coversAmount)) state = 'paid';
  else if (captures.some(capture => capture.status === 'PENDING')) state = 'pending';
  else if (!captures.length && !authorized && order.status === 'APPROVED') state = 'approved';
  else if (!captures.length && !authorized && ['CREATED', 'PAYER_ACTION_REQUIRED', 'SAVED'].includes(order.status)) state = 'checkout';
  const { message, ...decision } = replies[state];
  return {
    state, decision, message, orderId: order.id, orderStatus: order.status, intent: order.intent,
    units: units.map(unit => ({ amount: unit.amount, captures: (unit.payments?.captures ?? []).map(capture => ({
      id: capture.id, status: capture.status, amount: capture.amount,
    })) })),
  };
}

const openings = {
  DUPLICATE: 'I understand why you want to make sure you only pay once.',
  FRUSTRATED: 'I understand how frustrating it is to wait for an answer.',
  UNCERTAIN: 'I can see why the checkout status was confusing.',
  NEUTRAL: 'Thanks for getting in touch about your order.',
};

export function draftUpdate(result, ticket) {
  const tone = predictTone(ticket);
  const text = openings[tone] + ' ' + result.message.slice(result.message.indexOf('. ') + 2);
  return { text, mode: 'AI-assisted draft', note: 'The local model selects the opening. The payment wording comes from the evidence above.' };
}
