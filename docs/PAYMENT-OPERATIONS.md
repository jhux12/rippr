# Credit ledger and sandbox payment reviews

## Delivered scope

This batch implements the next payment work: source-separated credit accounting, an isolated live-wallet foundation, stronger negative/replay tests and an owner-only payment review workspace. It does not activate live charges, convert test balances, issue refunds, register tax, approve a business model, send marketing texts or initiate shipping.

### Credit sources

`testAccounts/{uid}` now stores `creditBuckets`, `creditLedgerVersion:1` and `creditRevision`. The sum of the four buckets must equal the existing `balanceCents`; mismatches fail closed rather than inventing a repair.

- `purchasedCents`: newly confirmed Stripe **sandbox** funding.
- `promotionalCents`: free test top-ups, credit rewards and referral bonuses.
- `sellbackCents`: selling inventory cards back for site credit.
- `legacyTestCents`: any balance that existed before source tracking. Historical totals are not relabelled as purchased credit or real value from incomplete provenance.

On the first ledger-backed change, an older balance gets one immutable `legacy-opening-v1` entry. Every subsequent credit/spend records the bucket deltas, before/after balances, currency, source, revision, reference and server time in `creditLedger`. The aggregate and ledger entry commit in the same Firestore transaction. Existing operation IDs, Stripe event/session IDs and referral IDs prevent replayed writes. The display total and pack prices stay the same.

Spending consumes legacy test credit, promotional credit, sellback credit, then purchased sandbox credit. That order is explicit and covered by tests; any future live promotional restrictions need the owner’s policy before activation. Profile → Settings shows the four sources. A held account shows a payment-review message.

The separate future namespace is `liveAccounts`, closed to every browser client. `initialLiveWallet()` returns a zero USD wallet. The shared ledger engine rejects test currency and any nonzero aggregate-only/legacy balance in live mode. No live funding endpoint, migration, UI switch or live secret is added. This is a **ledger foundation**, not a complete production financial platform or general accounting ledger; processor approval, purchased/promotional policies, tax classification, operational reconciliation and a reviewed live adapter remain required.

### Owner payment workspace

Open **Admin → Payments** using the existing verified owner account. The sidebar/page title and mobile layout use the existing admin theme.

- Paginated review cases, including open and resolved cases. The filter applies to loaded records; Load more reaches older cases.
- Customer UID + optional top-up ID lookup. Wallet-only lookup shows source buckets, aggregate balance, payment debt, holds, paginated ledger and the latest 25 owner review notes.
- Payment inspection retrieves the canonical Checkout Session, PaymentIntent/charge and (when present) dispute from Stripe. Test mode, currency, metadata, gross/subtotal/tax, payment intent and charge binding are checked.
- Required 15–1,000 character owner notes, confirmation before mutation, optimistic case/wallet revisions and stable retry operation IDs.
- Append-only server-only audit records include actor, note, evidence, action, debt effects and time. Account switches clear current records, notes, forms and pending result rendering.

Available resolutions:

1. **Release confirmed paid payment:** only for an already-credited payment that Stripe currently shows paid, not refunded and without an unresolved/lost dispute. Won disputes can be released after verification. This does not add money.
2. **Credit confirmed uncredited payment:** for a paid, unrefunded/uncontested payment placed in review before crediting. It adds purchased test credit once, respects the test balance cap and existing deposit/reward rules. A later completion webhook cannot double-credit it.
3. **Record confirmed refund / lost dispute:** records a refund already made in Stripe, or a confirmed lost dispute. It does **not** call Stripe’s refund API. Only newly refunded principal is reconciled, so partial/cumulative events and retries do not double-debit. Tax-free partial refunds and full refunds are supported; partial taxed refunds stay held pending an owner-approved allocation.
4. **Write off sandbox debt:** when refunded purchased credit has already been spent, the available purchased bucket is removed and the rest becomes `paymentDebtCents`. No bucket goes negative and promotions/legacy test balances are not silently confiscated. Only the verified owner can write off this sandbox debt with a note after tracked reviews are resolved. This creates no Stripe refund, no new spendable credit and no real-money debt-write-off capability.

The account remains held until its tracked reviews and debt are resolved. Other open cases prevent an unrelated resolution from clearing the hold. A later new reversal reopens its case; duplicate already-reconciled cumulative refunds do not. Old untracked holds are preserved as `legacyPaymentHold` and are **not** blindly cleared by a new resolution. Earlier holds/cases that predate this queue need owner reconciliation/migration; there is no force-clear button that bypasses that unknown history.

### Storage and permissions

- `testAccounts/{uid}/creditLedger/{operationId}`: account owner can read, all browser writes denied.
- `paymentReviewQueue/root/cases/{uid_topupId}` plus per-case `history`: server-only.
- `paymentReviewAudit/{operationId}`: global server-only operation audit/idempotency record.
- `paymentAuditByAccount/{uid}/entries/{operationId}`: server-only owner-note history, not exposed to the customer’s Firestore scope.
- `liveAccounts/**`: server-only and unused by current payment endpoints.

No card number, CVC, secret key or raw Stripe request headers are stored in these records. Stripe’s sandbox API provides verification only; credentials remain in Secret Manager. The existing fixed owner token check also protects every review endpoint; browser admin styling alone grants nothing.

## Deploy

```bash
cd ~/rippr &&
git pull --ff-only origin main &&
npm ci &&
npm ci --prefix functions &&
npx firebase deploy \
  --only functions:ripprAccount,functions:ripprStripe,functions:ripprStripeWebhook,firestore:rules \
  --project rippr-2b01c
```

Deploy the frontend through the normal GitHub/Vercel flow. No new Function names, API secrets, tax changes, composite indexes or live keys are required. Existing email/SMS settings are unchanged. Deploy all three listed Functions so funding, spends and reversals use the same ledger/review version.

The owner has reported one successful real **sandbox** Checkout/top-up. That establishes the happy path, not all failure/reversal cases. Local suites use isolated Stripe/Firestore fixtures and do not make provider calls, send mail or mutate deployed accounts.

## Sandbox acceptance checklist

Use a dedicated test account and Stripe’s current published sandbox test methods:

| Scenario | Expected result |
| --- | --- |
| Successful test card | Exactly one purchased test credit, one funding ledger entry |
| Return-page refresh / replay paid webhook | No additional credit or welcome-case eligibility change |
| Declined test payment | No credit; customer can retry safely |
| 3DS cancellation/failure | No credit until Stripe actually reports paid |
| Checkout cancelled or expired | No credit; new explicit attempt remains possible |
| Delayed method completion | Pending until canonical paid success; failure never credits |
| Full sandbox refund in Stripe | Review opens; spend/sell/ship/redemption paused; reconcile removes only purchased funds |
| Partial refund, followed by larger cumulative refund | Only the additional principal is reconciled each time |
| Refund after spending | Available purchased credit debited, remaining debt visible, hold persists until audited sandbox resolution |
| Open / won / lost dispute | Open stays held; won can be released; lost must be reconciled |
| Two reviews on one account | Resolving one does not clear the other hold |
| Non-owner attempts admin actions | Permission denied; no wallet/audit changes |
| Two admin tabs resolve stale data | One succeeds; stale tab must reload |
| Sign out/change account during inspection | No previous customer details are rendered |
| Old balance before deployment | Remains the same total, classified as legacy test credit; no live value created |

Run local quality checks with `npm test`, `npm run test:stripe`, `npm run build`, `npm run check:site`, and `CHROMIUM_PATH=/usr/bin/chromium npm run test:payments:browser`. The broader `npm run test:browser` includes these checks. `npm run test:rules` includes private review/audit/live-ledger protections but requires official downloadable emulators; their download remains restricted in the managed workspace.
