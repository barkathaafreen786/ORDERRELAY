const amount = { currency_code: 'USD', value: '24.00' };
export const examples = {
  approved: {
    order: { id: 'SAMPLE-APPROVED', status: 'APPROVED', intent: 'CAPTURE', purchase_units: [{ amount }] },
    ticket: 'I approved checkout and the page froze. I’m worried I’ll pay twice if I try again.',
  },
  paid: {
    order: { id: 'SAMPLE-CAPTURED', status: 'COMPLETED', intent: 'CAPTURE', purchase_units: [
      { amount, payments: { captures: [{ id: 'SAMPLE-CAPTURE-01', status: 'COMPLETED', amount }] } },
    ] },
    ticket: 'I’ve contacted support twice because my order confirmation never arrived. Can someone check?',
  },
  pending: {
    order: { id: 'SAMPLE-PENDING', status: 'COMPLETED', intent: 'CAPTURE', purchase_units: [
      { amount, payments: { captures: [{ id: 'SAMPLE-CAPTURE-02', status: 'PENDING', amount }] } },
    ] },
    ticket: 'I see something processing in my wallet. Can you tell me what happened?',
  },
};
