# Live-mode rollout

Code is prepared; this workspace did not configure live keys, charge/refund money, deploy Firebase, or activate public live access. Policy and provider legal approval remain the owner's responsibility as requested.

## Separation

`SITE_MODE` is server-selected (`test` by default). Live financial data lives under `liveAccounts`; sandbox data remains under `testAccounts`. On first live use, only profile/contact/preferences fields are copied. Balance, items, unopened packs, Spark Points, deposits, referral grants/caps and operations start fresh. No test winnings become physical obligations. Pack catalogs, library and display settings remain shared so configured prices/odds/artwork remain unchanged.

Live mode uses separate referral codes/registrations, eligibility, museums, support/shipping/payment queues, payment audits, webhook receipts, promotion totals and email outbox. These prefixes are mapped centrally by `scopedDatabase`; native Firestore references/transactions still enforce atomic writes. Live top-ups use `liveAccounts/{uid}/stripeTopups`; sandbox top-ups remain under `testAccounts/{uid}/stripeTestTopups`. Metadata, currency and provider mode are checked independently as well.

Currency is `USD` with a zero legacy-test bucket. Free top-ups are rejected by the server in live mode even if an old flag/client tries to enable them. Promotional and sellback credit are spent before purchased credit. Purchased spending earns Spark Points as before. Live Stripe secrets, metadata namespace, Checkout IDs, `livemode` flags and webhook records are separate; provider confirmation is required for credit. Refund/dispute reconciliation, debt holds and pending promotion holds use the live ledger.

The runtime endpoint returns mode and policy version; cached or spoofed requests from another mode are rejected before mutations. Missing/unavailable runtime discovery can use only legacy test routing, never a live fallback; a live server rejects that route. Existing test Checkout is disabled while the storefront is live, but old test webhooks can still settle only in sandbox records. Existing live webhooks continue settling live payments even if funding is paused or the storefront switches mode.

Live email triggers/outbox/retry are separate. Automatic sandbox closure cannot delete an identity/profile-image set if a live account exists, even after a mode rollback. Live closure routes to support for review rather than deleting real financial identity or forfeiting balances. Shipping requests use manual review: no automatic label, quote or shipping charge. Marketing SMS remains disabled.

## Switches

- `SITE_MODE=test|live`: active account ledger; defaults test.
- `STRIPE_LIVE_TOPUPS_ENABLED`: real Checkout availability; defaults false.
- `LIVE_PURCHASES_ENABLED`: live openings/reward claims; defaults false.
- `LIVE_PUBLIC_ACCESS`: nonowner real transactions; defaults false.
- `FREE_TEST_TOPUPS`: forced false by rollout script; live server also rejects free top-ups independently.

The script below changes local nonsecret Firebase parameter values only, then deployment applies them. It preserves site URL, email and tax settings. Automatic tax remains in its prior configuration. `pause` keeps the live ledger selected while disabling funding/openings; do not use `prepare` to roll an already-live site back into test data.

## 1. Prepare source and run checks in Cloud Shell

```bash
cd ~/rippr &&
git pull --ff-only origin main &&
npm ci &&
npm ci --prefix functions &&
npm test &&
npm run test:rules &&
node scripts/configure-live.mjs prepare
```

The official Rules emulator could not run in this workspace because the binary download from Google Storage failed. The Cloud Shell Rules check above must pass; fixtures are not a replacement. It uses the demo project, not production account data. If the download/Java setup fails, stop and share the error; do not loosen rules.

## 2. Store secrets privately

Use the live Stripe account key (not a test or publishable key). Enter the value only at the hidden Firebase prompt; never paste it into chat or the shell command itself.

```bash
npx firebase functions:secrets:set STRIPE_LIVE_SECRET_KEY --project rippr-2b01c
```

In Stripe **live mode**, create a webhook endpoint:

`https://us-central1-rippr-2b01c.cloudfunctions.net/ripprLiveStripeWebhook`

Subscribe to:

- `checkout.session.completed`
- `checkout.session.async_payment_succeeded`
- `checkout.session.async_payment_failed`
- `checkout.session.expired`
- `charge.refunded`
- `charge.dispute.created`

Copy that endpoint's signing secret (`whsec_...`) and enter it at:

```bash
npx firebase functions:secrets:set STRIPE_LIVE_WEBHOOK_SECRET --project rippr-2b01c
npx firebase deploy --only functions,firestore:rules --project rippr-2b01c
```

Creating the webhook before function deployment is fine; no live Checkout is available in prepare mode. Existing Resend/test secrets remain required by their existing functions. No Stripe publishable key is needed for server-created hosted Checkout.

## 3. Owner-only live preview

After all checks/deployment succeed:

```bash
node scripts/configure-live.mjs private &&
npx firebase deploy --only functions --project rippr-2b01c
```

Reload the site. Owner access is determined by the verified owner token, never a browser flag. Nonowners can browse/sign in but cannot fund, open or redeem live rewards. The top-up popup stops claiming no real charge; real payments are now possible for the owner. Test balances/items remain untouched and absent from the live profile. Review the updated mode-specific UI/disclosures.

Make a small real top-up through the owner account. Verify Stripe live mode, successful signed webhook, exactly one purchased-credit ledger entry, and the correct balance. Reload/return again and confirm no duplicate credit. For a clean first refund check, refund this unused top-up in Stripe before opening or claiming a bonus, then inspect and reconcile the review in Admin → Payments. Verify the purchased balance returns to zero with no debt. A refund of already-spent funds deliberately creates debt/holds; do not use the sandbox debt-writeoff control to erase live obligations.

Then check another real top-up and a controlled opening, inventory, sellback, welcome pack and Spark points as appropriate. This code has fixture coverage for those flows, not proof of an actual real transaction. Review any payment/email errors before public access. Refunds themselves are issued in Stripe; admin reconciliation does not issue a provider refund.

## 4. Public access

Only after the controlled live checks succeed:

```bash
node scripts/configure-live.mjs public &&
npx firebase deploy --only functions --project rippr-2b01c
```

For an operational pause:

```bash
node scripts/configure-live.mjs pause &&
npx firebase deploy --only functions --project rippr-2b01c
```

Pausing preserves the live ledger, incoming webhook settlement, account reads, support and payment review. It stops new funding/openings/reward claims. Do not copy sandbox balances or winnings into live records. No scheduled autonomous activation is configured.

## Slow emulator downloads / Ctrl+C

Firebase CLI can exit successfully after canceling a download, allowing a shell `&&` chain to continue. The repository's Rules runner now requires a standalone success marker from the completed test command; interruption or missing completion returns failure even if Firebase itself exits 0.

For slow Cloud Shell downloads:

```bash
cd ~/rippr &&
git pull --ff-only origin main &&
node scripts/download-emulators.mjs &&
npm run test:rules
```

The downloader uses the installed Firebase CLI's official binary metadata, IPv4 curl and persistent `.part` files. If interrupted, rerun it to resume. Files move into the CLI cache only after exact size and SHA-256 verification. Both Firestore and Storage binaries are required. Local emulator hub/logging explicitly bind IPv4 to avoid Cloud Shell's unavailable `::1` warnings. These local changes do not activate or deploy live payments.
