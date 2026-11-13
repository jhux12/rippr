# Reviewed sandbox account closure

This is a user-requested, owner-reviewed sandbox cleanup workflow, not a timed purge, automatic live refund or deletion of every retained record. No real customer data was modified during implementation/testing.

## Customer workflow

Account settings → Close your account → request closure → send a code to the current verified phone → reauthenticate → separately confirm the request and relinquishment of sandbox items/nonpurchased test credit. The callable requires Firebase phone-provider authentication no older than five minutes. A recent token check is enforced server-side; a client “verified” flag is never trusted.

A saved request immediately unpublishes the Community collection and pauses new purchases, funding, owned-pack openings, rewards, profile changes and other new account activity. Reading current items/payment status and using support remain possible while pending. A request can be withdrawn while requested/reviewing/blocked. Withdrawal does not republish the collection. Processing is irreversible and cannot be withdrawn. Owner accounts cannot use self-service closure without a separate ownership-transfer review.

The request displays acknowledgment and completion targets (five business days excluding weekends; 30 calendar days), subject to applicable legal handling. No background timer deletes an account at either deadline.

## Owner workflow

Admin → Account closures has a paginated request list, UID lookup, inspection, acknowledgment/manual block notes, automatic blockers and latest 25 audit entries. Retained audit history is not capped at 25. Every destructive phase requires a review note, explicit sandbox confirmation, matching version and a fresh owner-authorized call.

1. Inspect the account. Resolve actual refund/payment reviews and shipping requests first. The tool cannot issue a Stripe refund or waive a payment hold to make closure succeed.
2. Acknowledge review. A manual blocked request cannot process until the owner changes it back to reviewing.
3. Start reviewed sandbox cleanup. Each click runs one bounded phase. Inspect and continue; stopping clicking pauses the workflow.
4. If a phase fails, reload the inspection and retry/continue. Audit and phase/version/lease records make progress visible. A one-minute lease prevents concurrent processing. An expired lease permits recovery after a terminated Function.

Automatic blockers include non-TEST_USD accounts, inconsistent balances, unused purchased test credit, legacy balances overlapping unreconciled Stripe payments, debt/payment holds/reviews, pending/unknown/review Checkout records, and undelivered/uncanceled shipping requests. Inspections scan up to 201 order/payment records: accounts exceeding 200 in either collection are held for a separate full-history review, never silently approved. Operationally cancel or resolve legitimate test requests before closure; do not falsify delivery to bypass a blocker. A cancellation endpoint for shipping is not introduced by this batch.

## Cleanup and retention

The processing phases delete account `operations` documents in batches of 100 (they can contain profile/address/email fingerprints/results); redact DOB from the private eligibility root and acceptance audit pages; redact phone numbers from SMS-consent event pages; remove original files only under `profile-images/{uid}/` in `rippr-2b01c.firebasestorage.app` in batches of 100; delete the Firebase Auth identity; then replace the active account profile with a minimal closed financial summary and remove museum configuration and email-verification metadata.

Nonpurchased sandbox credit is relinquished only after the user's separate explicit confirmation and owner review; a negative, immutable credit-ledger entry records the adjustment. Purchased credit, unresolved debt or orders cannot be discarded with this operation. Test cards/packs, financial ledger, Stripe/refund records, activity, order/support records and necessary private audit records remain for accounting, disputes and the published retention policy. This is not an implementation of the future seven-year/two-year/90-day automatic retention schedules. Third-party provider records, backups, caches and copies saved by others have separate retention and are not falsely reported erased.

The Auth removal happens before final profile replacement and is idempotent (`user-not-found` is success). If finalization fails or a new payment review arrives, the account stays processing and the owner must resolve the issue and continue. Never delete the request/lifecycle marker to “fix” a stuck cleanup. Closed accounts cannot be recreated by `snapshot`; old valid tokens are blocked by lifecycle checks and closed-account Firestore/Storage rules. A later signup with the same phone may create a different Firebase UID and does not restore the closed account's records or credit.

Storage rules consult the lifecycle marker to stop new profile/support uploads during closure and deny closed-account reads of retained support attachments. This requires Cloud Storage Rules access to Firestore; Firebase may prompt to enable the cross-service permission during deployment. Do not bypass it by removing the lifecycle rule.

## Notices

`closure-requested` and `closure-completed` transactional emails use the existing Resend outbox and retry/idempotency handling, only if email sending is enabled and the account had a confirmed address. Request notice confirms receipt, not deletion. Completion accurately describes retained data and includes an account reference. If there is no confirmed email, the request/status remains in-app; the UI does not claim that an email was sent.

To permit delivery after profile/email redaction, the closed lifecycle marker retains only a SHA-256 recipient binding; the transient outbox recipient is checked against that binding. Its raw recipient/payload is cleared on the existing terminal/expiry paths. No marketing opt-in is created and no pack receipts are enabled.

## Deployment

Deploy the normal frontend first, then:

```bash
cd ~/rippr &&
git pull --ff-only origin main &&
npm ci &&
npm ci --prefix functions &&
npx firebase deploy \
  --only functions:ripprAccount,functions:ripprMuseum,functions:ripprStripe,functions:ripprEmailDelivery,functions:ripprEmailRetry,firestore:rules,storage \
  --project rippr-2b01c
```

No new Function name, secret, index or tax setting. The deployment service account needs its normal Firebase Auth user-management and bucket permissions; adapter errors keep cleanup retryable. Webhook settlement is deliberately left available for old paid sessions. The worker and completion email templates require both email delivery/retry deployments.

## Tests and limits

`npm test` includes closure authorization, recent auth, explicit confirmations, ownership, stale review versions, purchased-credit/order/payment blockers, privacy removal, retained ledgers, bounded histories, queue pagination, storage failure recovery and duplicate completion/notice handling. `npm run test:closure:browser` checks actual closure logic with fixture SMS/Auth/Storage actions at 320/390/1440px. These tests do not delete real identities/files, send mail, verify IAM deployment, execute official Security Rules emulators or establish production legal compliance. Official emulator execution remains blocked here by the previously recorded download restriction.

Run a dedicated throwaway sandbox account through the deployed process before accepting actual requests. Never test destructive processing on the owner or an unrelated customer's account.

The updated draft Terms/Privacy use sandbox acceptance version v2. Existing active accounts must re-acknowledge before further funding/opening; this still does not accept final launch terms. Closure requests themselves do not require a new purchase acceptance.

Validation for this batch: all 23 domain test files, 35 focused browser groups (closure, eligibility, email previews/settings, account settings and customer journeys), and the 24-page/1,283-reference site check passed. Provider/Auth/Storage effects were mocked; the official rules emulator and deployed IAM behavior remain unverified here.
