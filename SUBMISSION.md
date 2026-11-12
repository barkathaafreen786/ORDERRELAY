# OrderRelay · Devpost submission

## Project name

OrderRelay

## Elevator pitch

OrderRelay helps small sellers verify what happened to a PayPal payment and draft a customer reply that matches the evidence.

## Inspiration

A customer sees a frozen checkout page and asks whether they should try again. The seller sees an approved order and has to work out whether funds were captured. Guessing can lead to a duplicate payment request or a promise the seller cannot keep.

## What it does

OrderRelay reads PayPal Sandbox order and capture records and surfaces the evidence behind its verdict. It distinguishes buyer approval, capture pending, a full capture and refunded payments. A local text classifier interprets the buyer’s concern and picks an appropriate opening for a reply. Payment wording follows the evidence. The seller reviews, edits and copies the result.

## How it was built

Node.js, JavaScript, HTML and CSS. PayPal Sandbox OAuth and Orders v2 power the checkout and investigation. A local naïve Bayes model trained on synthetic support tickets adapts the reply’s opening without an external AI service. The sandbox demo uses a test buyer to show the same order before and after capture.

## Try it

Use the README setup steps in the public repository. Sample cases run immediately. The PayPal walkthrough uses a free Sandbox REST app and a Personal sandbox test account. The README explains how to create both.

## Record a 100-second demo

| Time | On screen | Voiceover |
| --- | --- | --- |
| 0:00–0:13 | OrderRelay workspace | “A customer approved checkout, the page froze, and now they’re worried they’ll pay twice. OrderRelay helps a seller answer with evidence.” |
| 0:13–0:35 | Create a $24 sandbox checkout, approve it as a test buyer, and return. Cut around login and redact test account details. | “I’m creating a PayPal sandbox order and approving it as a test buyer.” |
| 0:35–0:53 | Enter the duplicate concern and investigate. Show APPROVED, no capture, and the seller next step. | “The buyer approved checkout. The capture record is empty, so the reply tells the buyer to hold off while the seller checks.” |
| 0:53–1:12 | Capture test payment. Show COMPLETED and the returned capture ID. | “I’ll capture the test payment. The same order now shows a completed capture for the full amount. OrderRelay changes the verdict and the reply.” |
| 1:12–1:33 | Change the message to an upset buyer and investigate again. Show the opening change while the payment wording remains tied to capture evidence. | “The local AI model changes the opening for an upset customer. The payment statement stays tied to PayPal’s records.” |
| 1:33–1:40 | Review or edit the reply and copy it. | “The seller has the final word. They review the reply before sharing it.” |

## Devpost fields to finish

- Public source URL on GitHub, GitLab or Bitbucket with the MIT license visible.
- Public YouTube URL for the live walkthrough under three minutes.
- Paste the project description and add the public repository’s setup link as the functional demo.
- Review the official rules and submit through [PayPal AI Hackathon on Devpost](https://paypalaihackathon.devpost.com/) before **Friday, November 13, 2026 at 1:30 a.m. IST**.
