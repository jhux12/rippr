# Stripe sandbox balance funding and Tax plan

## Planning and tool availability

Business: rippr.gg, operated in Indiana, US. The actual current model is paid randomized Pokémon card pack openings, one card per pack, inventory cards, optional shipping requests, and sellback for non-withdrawable site credit. It is not ordinary direct card checkout. The owner chose **fund the existing balance**, rather than pay per pack.

The requested setup sequence was attempted:

1. `codex plugin add stripe@openai-curated` failed: Stripe was not available in this environment’s plugin marketplace.
2. `codex mcp add stripe --url https://mcp.stripe.com` failed because session MCP configuration is read-only. No Stripe MCP tools or `stripe_implementation_planner` became available. A new authenticated session would be needed to use that planner here.
3. The specified `npx --yes skills add https://docs.stripe.com --yes` fallback also failed to download; direct official-doc access returned HTTP 403 under the environment’s network policy.

This is therefore a **locally prepared implementation plan, not planner-tool output**. The official Stripe Node SDK was successfully installed from npm (23.1.0, locked in `functions/package-lock.json`), and its webhook signature implementation is exercised by tests. The SDK API version is `2026-10-28.endive`. Live Stripe API/Checkout and tax-registration checks were not possible here. No API keys were saved in code, printed or committed, and no Stripe account objects/charges were created by this workspace.

## Tailored integration plan and current review

There was no previous Stripe integration to review. The existing popup calls a Firebase action that adds free nonredeemable test credit to `testAccounts`. Keep that namespace as sandbox-only; never silently convert its existing balances/items into purchased real-money balances or fulfillment obligations.

1. Use Stripe-hosted Checkout, created by an authenticated Firebase callable. The user submits only the amount; server validation owns currency, amount limits, return origin, tax configuration and wallet binding. Card data stays with Stripe; no Stripe.js or publishable key is necessary for this hosted-redirect approach.
2. Persist a top-up intent before the provider call and use a stable Stripe idempotency key. Preserve the immutable request across retries. Link the returned `cs_test_` session before returning its URL. Restrict redirect URLs to Stripe’s HTTPS Checkout host.
3. Credit only from a raw-body, signed webhook, after retrieving the canonical Checkout Session from Stripe. Validate test mode, namespace, UID, saved session, paid status, USD currency, subtotal and tax/total amounts. Both top-up and event ledgers are transactional, preventing duplicate credits across distinct successful event deliveries. A success URL never credits the wallet.
4. Show pending/credited/failed/review status on return using an authenticated status call, with bounded polling, account isolation and an explicit retry button. Refresh balance only after the server reports credited.
5. Record verified sandbox deposit metadata only after successful funding, so the existing welcome-case eligibility can be tested. Free credits do not set it. Refunds/disputes require payment review and put the wallet on hold; pack purchases, reward-pack openings, sales and shipping requests are blocked while held. This is conservative manual reconciliation, not automatic refunds or automatic reversal of previously opened cards.
6. Keep all live mode locked out. The provider client accepts only `sk_test_` keys, webhook events must have `livemode:false`, Checkout IDs must be test IDs, and balances must use `TEST_USD`. Enabling sandbox funding does **not** enable real purchases.
7. Stripe Tax belongs at the legally correct taxable event. Funding stored credit and selling physical cards are different events. Confirm whether this credit is treated as a voucher/gift certificate and whether tax is due at funding or redemption. Do not label deposits as physical card sales or make up registrations/tax codes. The implementation supports opt-in automatic Tax at Checkout, but it defaults off and requires an explicit tax code; it is not a conclusion that top-ups are exempt.

Before production, get Stripe’s approval for the complete randomized-pack/stored-credit/sellback model, confirm the tax treatment with the owner’s adviser, implement a real-money ledger separate from test balances/items, and define refund/dispute reconciliation and fulfillment policies. If tax is due at redemption, tax calculation/ledger support must be added to pack redemption instead of using top-up Tax. That live-money conversion and tax determination are not implemented by this sandbox change.

Reference links for the owner’s Stripe session: [Checkout](https://docs.stripe.com/payments/checkout), [fulfillment](https://docs.stripe.com/checkout/fulfillment), [webhooks](https://docs.stripe.com/webhooks), [Stripe Tax](https://docs.stripe.com/tax), [restricted businesses](https://stripe.com/legal/restricted-businesses). These links were not fetched successfully by this environment.

## Deployment — test mode only

The key pasted into chat is a sandbox key. Rotate that secret before deployment and save its replacement **only in Firebase Secret Manager**. Never paste a live secret into chat. The public key is unnecessary for this redirect integration.

1. Pull and install:

   ```bash
   cd ~/rippr &&
   git pull --ff-only origin main &&
   npm ci &&
   npm ci --prefix functions
   ```

   Stop if Git reports local changes instead of discarding them.
2. Store the replacement **test** secret at the CLI’s secure prompt:

   ```bash
   npx firebase functions:secrets:set STRIPE_TEST_SECRET_KEY --project rippr-2b01c
   ```

3. In Stripe’s **sandbox/test-mode** webhook settings, add this endpoint:

   ```text
   https://us-central1-rippr-2b01c.cloudfunctions.net/ripprStripeWebhook
   ```

   Subscribe to these events:

   ```text
   checkout.session.completed
   checkout.session.async_payment_succeeded
   checkout.session.async_payment_failed
   checkout.session.expired
   charge.refunded
   charge.dispute.created
   ```

   Use the API version above when available. The endpoint may not respond until deployed. Copy its `whsec_…` signing secret, then save it at the CLI prompt:

   ```bash
   npx firebase functions:secrets:set STRIPE_TEST_WEBHOOK_SECRET --project rippr-2b01c
   ```

   A Stripe CLI forwarding secret and a Dashboard endpoint secret are different; use the signing secret for the endpoint that sends the event.
4. Enable sandbox funding:

   ```bash
   npm run configure:stripe -- --enable --no-tax
   ```

   This writes `STRIPE_TEST_TOPUPS_ENABLED=true`, `STRIPE_SITE_URL=https://www.rippr.gg` and `FREE_TEST_TOPUPS=false` into the ignored project environment file while preserving other settings. Secrets are untouched. `--no-tax` explicitly writes `STRIPE_TOPUP_AUTOMATIC_TAX=false` and clears the tax code, replacing any earlier prompted value. Omit `--no-tax` only when intentionally preserving a configured tax setup. `npm run configure:stripe -- --disable` pauses new Stripe Checkouts and preserves the current free-credit setting; to restore free-credit testing, explicitly set `FREE_TEST_TOPUPS=true` and redeploy the account Function.
5. Deploy:

   ```bash
   npx firebase deploy \
     --only functions:ripprAccount,functions:ripprStripe,functions:ripprStripeWebhook,firestore:rules \
     --project rippr-2b01c
   ```

   The frontend is deployed through the normal GitHub/Vercel workflow. No email or SMS Function redeployment is required. Checkout and webhook Functions need the test secret; only the webhook needs the signing secret. `ripprAccount` only exposes the enabled flag and enforces payment holds.
6. Open https://www.rippr.gg, sign in, and choose a top-up. The popup must say **Stripe sandbox / no real charge**. Use Stripe’s documented test card `4242 4242 4242 4242`, any future expiry and test CVC. No real card or live charge is needed. Verify the Checkout Session and webhook event in the Stripe sandbox, the return message, and exactly one balance credit in Firebase. Only then try Stripe’s published decline/3DS test cases and event replays.

## Tax setup (only after choosing the correct taxable event)

Owner decision recorded November 13, 2026: collect applicable tax at funding. This does not set a tax code, establish registrations or enable Automatic Tax; the guarded configuration below must still be completed and tested.

If the owner determines that top-up Checkout should collect tax, enable Stripe Tax in the same sandbox, configure the business origin and appropriate **test registrations**, and select the appropriate product tax code from Stripe. Set:

```dotenv
STRIPE_TOPUP_AUTOMATIC_TAX=true
STRIPE_TOPUP_TAX_CODE=txcd_REPLACE_WITH_ACTUAL_CODE
```

The value above is a placeholder; the backend rejects it until replaced with a valid eight-digit Stripe code. Redeploy `ripprStripe`. Checkout then collects billing address and uses exclusive tax: a $25 credit plus $x tax charges $25 + $x, but grants only $25 in credit. Return URLs and browser input cannot alter this. Already-created sessions keep their original tax configuration. Test registration, rate accuracy, thresholds and reporting require Stripe-side setup; no real tax registration or remittance is performed by this code.

## Records and operations

- `testAccounts/{uid}/stripeTestTopups/{operationId}`: immutable Checkout request, session binding, pending/credited/review/failed/expired status, credit/tax amounts and timestamps. Only the owner can read; browser writes are denied. No card, API-key or full payment-method data is stored.
- `stripeTestWebhookEvents/{eventId}`: server-only deduplication ledger. No raw webhook payload or payment card details are retained.
- `testAccounts/{uid}.paymentHold`: review gate for refunds/disputes or a paid event that cannot safely be credited. Neither free credits nor a new Checkout clears it. Admin → Payments now provides canonical Stripe inspection, audited sandbox resolution and sandbox debt handling. See [PAYMENT-OPERATIONS.md](PAYMENT-OPERATIONS.md). Earlier untracked holds are not automatically cleared. Live-money operations remain future work.
- The first successful sandbox funding sets `firstVerifiedDepositAtMs` and `firstVerifiedDepositMode:'stripe-test'`, enabling the existing one-time welcome case for testing. It must not be migrated into real-money eligibility automatically.
- New Checkouts are limited to ten per account per hour and $1–$1,000 per top-up, with a $10,000 test-balance cap. If concurrent activity reaches the cap before a paid webhook, the paid top-up goes to review rather than disappearing or overcrediting.
- Disabling new Checkouts does not disable webhook settlement of already-created test sessions. Return polling remains available. Unknown/live events are ignored; invalid signatures return 400; temporary processing failures return 500 so Stripe can retry. Authentication/API failures are sanitized rather than returned with provider details.
- Resend intentionally receives no pack receipt or funding receipt event from this adapter. Stripe receipt settings are separate. Existing earned-reward emails can still send after the user claims a reward with the required email preference.

## Verification performed locally

`npm run test:stripe` uses the official SDK for raw-body signature validation plus transactional/Stripe API fixtures for server pricing, lost responses, ownership, duplicates, unpaid/live/mismatched sessions, separate Tax credit, expiry, cap review, early refunds and disputes. `npm run test:stripe:browser` covers the hosted redirect and pending/credited/cancelled return at 320/390/1440px, with no real network requests or charges. The ordinary customer journey/domain suites check compatibility. Rules tests include forged funding/audit-denial cases but require downloadable emulators.

These tests do not establish actual Stripe sandbox account access, webhook reachability, inbox delivery, Stripe approval or tax correctness. Those deployment checks remain to be run using the owner’s configured Stripe sandbox and domain.


### Checkout error diagnostics

`ripprStripe` logs only allowlisted error type/code/parameter/status and the Stripe `req_…` reference, not raw provider messages, requests, headers, keys, card data or customer payloads. The top-up popup shows a safe error category (key, tax, origin, permission, rejected setup, temporary failure) instead of the generic account-service error. Unknown outcomes retain the same operation ID for safe retries.

After a failed Checkout attempt, run `npx firebase functions:log --only ripprStripe --project rippr-2b01c` in Cloud Shell and inspect the entry named **Stripe sandbox Checkout failed**. Share only that sanitized entry. For `StripeInvalidRequestError`, the logged `req_…` reference also identifies the request in the Stripe sandbox’s API logs. A missing entry can indicate that the new handler is not deployed or the request did not reach it; inspect the callable network response rather than resetting keys blindly.


If Checkout reports automatic tax without a code, run `npm run configure:stripe -- --enable --no-tax`, then redeploy `ripprStripe`. Verify the active value with `gcloud functions describe ripprStripe --gen2 --region=us-central1 --project=rippr-2b01c --format="value(serviceConfig.environmentVariables.STRIPE_TOPUP_AUTOMATIC_TAX)"`; it must print `false`. Do not choose a random product tax code merely to get past the error.


### Dashboard-managed payment methods

The current Checkout API rejects `payment_method_types`. New sessions omit it and use the payment methods configured in the Stripe sandbox Dashboard. Enable the appropriate methods there (Cards is sufficient for the basic sandbox test). The adapter already handles unpaid completions and asynchronous success/failure; only a canonical paid session grants credit.

A saved attempt from before this change may still contain the removed field. Its provider request/idempotency key is never silently rewritten. An unbound legacy attempt returns “Checkout settings were updated. Please click Continue to Stripe again.” The client then clears that attempt key; the next explicit click starts a fresh operation with supported parameters. Previously bound sessions remain reusable until completion/expiry. No keys, tax settings, balance or successful payment is changed by this compatibility update.


The source-separated credit ledger and owner review workspace are documented in [PAYMENT-OPERATIONS.md](PAYMENT-OPERATIONS.md); remaining launch dependencies and the limits of verification are in [LAUNCH-READINESS.md](LAUNCH-READINESS.md).
