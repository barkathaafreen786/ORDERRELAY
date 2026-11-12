const training = {
  DUPLICATE: [
    'I am worried I will pay twice if I try again',
    'Did you charge me two times',
    'I see two charges for the same purchase',
    'There might be a duplicate payment',
    'Please make sure I only paid once',
    'My account shows a second payment for this order',
    'Will I be double charged if I retry checkout',
  ],
  FRUSTRATED: [
    'I have contacted support twice and nobody replied',
    'This is the third time I have asked for help',
    'I am frustrated with how long this is taking',
    'Still waiting after several messages to support',
    'I am upset that nobody has answered me',
    'I keep asking and getting no response',
    'This delay is unacceptable and I want an answer',
  ],
  UNCERTAIN: [
    'I am confused about what happened at checkout',
    'I see a processing message in my wallet',
    'The checkout page froze and I am unsure what to do',
    'The browser closed and I do not know if the order went through',
    'The status changed and I cannot tell what it means',
    'A spinning screen made me unsure whether checkout finished',
    'The payment page showed an error after approval',
  ],
  NEUTRAL: [
    'Please give me an update on my order',
    'Could you confirm the status of my payment',
    'Hello can I get a receipt for my purchase',
    'Please check my order when you have a chance',
    'I would like an update on the transaction',
    'Can you confirm that you received the payment',
    'I am writing to ask about the order confirmation',
  ],
};

const stopWords = new Set('a am an and at for have i if in is it me my of on the to was what whether will you'.split(' '));

function features(text) {
  const words = text.normalize('NFKC').toLowerCase().match(/[a-z]+/g) ?? [];
  const bigrams = words.slice(1).map((word, index) => words[index] + ' ' + word);
  return new Set([...words.filter(word => word.length > 1 && !stopWords.has(word)), ...bigrams]);
}

const vocabulary = new Set();
const model = Object.entries(training).map(([label, tickets]) => {
  const counts = new Map();
  let total = 0;
  for (const ticket of tickets) {
    for (const token of features(ticket)) {
      counts.set(token, (counts.get(token) || 0) + 1);
      vocabulary.add(token);
      total++;
    }
  }
  return { label, counts, total };
});

export function predictTone(ticket) {
  const tokens = [...features(ticket)].filter(token => vocabulary.has(token));
  if (tokens.length < 2) return 'NEUTRAL';
  const scores = model.map(({ label, counts, total }) => ({
    label, score: tokens.reduce((sum, token) => sum + Math.log(((counts.get(token) || 0) + 1) / (total + vocabulary.size)), 0),
  })).sort((a, b) => b.score - a.score);
  return scores[0].score - scores[1].score >= 0.55 ? scores[0].label : 'NEUTRAL';
}
