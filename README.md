# OrderRelay

OrderRelay helps small online sellers answer “Did my PayPal payment go through?” It reads a PayPal Sandbox order and its captures, explains the evidence, and drafts a customer reply for seller review.

## Run locally

1. Install [Node.js](https://nodejs.org/) 22 or newer. No npm dependencies or AI API keys are needed.
2. Clone or extract this project and open a terminal in the folder containing `package.json`.
3. Run `npm start` and open [http://127.0.0.1:3000](http://127.0.0.1:3000).
4. Try the three **Sample cases**. They use synthetic payment records and the same evidence and AI drafting logic as the sandbox path.

Run `npm test` for the evidence, tone model, and PayPal request tests.

## Verify a real PayPal Sandbox checkout

1. Sign in to [PayPal Developer](https://developer.paypal.com/dashboard/). In **Apps & Credentials**, switch to **Sandbox** and create or select a sandbox REST app. Copy the client ID and secret.
2. Copy `.env.example` to `.env` in this folder. Set `PAYPAL_CLIENT_ID` and `PAYPAL_CLIENT_SECRET` to your sandbox values and restart `npm start`. Keep `.env` local.
3. In the developer dashboard, open **Testing Tools → Sandbox Accounts** and open the credentials for a **Personal** test buyer account. Use a buyer distinct from the app’s merchant account.
4. In OrderRelay, open **PayPal sandbox** and select **Create $24 test checkout**. Sign in with the test buyer and approve. Return to the same OrderRelay tab. No real money is involved.
5. Select **Investigate payment**. For an approved order with no capture, the expected verdict is **Approved · capture unconfirmed**.
6. Select **Capture test payment**. OrderRelay captures only a sample order created by that browser session, then reads it again. A completed capture of the full amount should switch the verdict to **Payment captured** and show the capture ID. If PayPal returns a pending or another state, the app displays that evidence.
7. You can also look up an existing sandbox order ID owned by the configured app. Lookup and drafting are read-only. The test checkout buttons are separate explicit actions.

## How it works

- **Payment source.** Server-side PayPal Sandbox OAuth and the Orders v2 create, read and capture endpoints. Payment capture uses a repeatable request ID and checks the latest order state.
- **Evidence.** OrderRelay checks order intent, order status, capture status, currency and total per purchase unit. Checkout approval, a pending capture, a refund, and a completed capture produce different seller actions. Shipping and fulfillment stay outside the verdict.
- **AI.** A local multinomial naïve Bayes model learns unigram and bigram counts from 28 synthetic English tickets and selects a customer acknowledgement for duplicate-payment concern, frustration, uncertainty or a routine update. Low-evidence input uses the neutral opening. The reply’s payment wording comes from the evidence rules. A seller can edit and copy the draft.
- **Scope.** This is a single-seller local prototype for sandbox use. The checkout session lives in memory. The model runs in the Node.js process and does not send support text to another service. The small synthetic dataset demonstrates behavior on sample tickets and does not establish real-world accuracy.

See [SUBMISSION.md](SUBMISSION.md) for the Devpost copy and demo script.
