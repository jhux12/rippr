# Sandbox eligibility and policy acceptance

## What is enforced

New signup requires an adult birth date plus two separate unchecked choices before the UI requests an SMS: agreement to the sandbox draft Terms and acknowledgment of the draft Privacy Policy. Marketing remains separate. After phone verification the server validates the date/choices/current version and saves the record before the normal signup return. If recording is interrupted, the user is sent to the dedicated check page rather than implicitly marked accepted.

Existing accounts can log in, browse, read inventory, get support, sell existing items and inspect existing payment statuses. Before new sandbox funding (`topup` or Stripe `checkout`), purchases or owned-pack opening, deployed callable routes check current eligibility. Missing/outdated records yield `eligibility-required`; the real Firebase client routes to `/eligibility` with a same-site return path. Final Stripe webhook settlement and payment reviews are intentionally not blocked by the new gate, so already-paid sessions can reconcile.

`functions/index.js` wraps both callable entrypoints in the exported, tested guards. Lower-level account/Stripe services still perform their normal domain validation; tests of those isolated services do not represent the entire callable route. New eligibility tests exercise the guards with the actual account service. Clients cannot opt out of a guard or supply an accepted flag.

## Records and privacy

- `accountEligibility/{uid}` is server-only, including for the account’s browser and the site admin’s browser. It stores the birth date, `adultSelfAttested:true`, `ageVerified:false`, the two document versions, scope, source and server acceptance timestamp.
- `accountEligibility/{uid}/acceptances/{operationId}` is an immutable per-acceptance audit record. Equivalent retries/current-version confirmations do not create repeated audit entries. Old-version operation IDs cannot be reused to imply a new acceptance.
- `eligibilityState` returns required/current version/scope and live-disabled status, never birth date. Account snapshots/public collections do not contain the private record.
- Birth date is kept only in form/memory before saving. It is not put in a URL or pending-operation browser-storage key. Signup/dedicated forms clear on page exit or account change. A successfully saved DOB cannot be changed through the acceptance endpoint; corrections require a separately reviewed support/admin process.
- Authentication comes from Firebase’s verified token, with a verified phone claim required to record acceptance. Supplying another account UID is rejected.

Privacy drafts now disclose this additional data. No new email or SMS marketing consent is recorded by accepting policies.

## Scope and limits

Current version: `sandbox-2026-11-13-v1`; scope: `sandbox-review-drafts`. This acknowledges the clearly marked review documents, not final launch terms. Before final policy publication, bump the server and client versions together, archive the actual documents approved, and require new acceptance. Do not silently change substantive terms under an already accepted version.

Date of birth is self-reported and checked against the server’s UTC calendar. It is not identity verification, state clearance, proof of residence or processor approval. The public Firebase phone-auth service can create an authentication identity outside this website form; that alone does not satisfy the guarded account/purchase APIs. Final eligibility/age/location verification and the permitted-state list still require review before live service. No state is declared permitted, no live-payment path is added, and the existing adapter still rejects live keys/events/non-test wallets.

## Deployment

Deploy frontend first so missing-eligibility responses can open the new form, then update both guarded callable Functions and the explicit private-data rules:

```bash
cd ~/rippr &&
git pull --ff-only origin main &&
npm ci &&
npm ci --prefix functions &&
npx firebase deploy \
  --only functions:ripprAccount,functions:ripprStripe,firestore:rules \
  --project rippr-2b01c
```

No new Function name, secret, tax parameter, Storage rule or composite index is required. Existing accounts are not silently grandfathered or marked accepted. Existing paid Checkout sessions may finish but new purchases/funding require the check.

## Verification

- `npm test`: complete domain suite including birthday boundaries, invalid dates, missing choices, stale versions, identity/phone binding, private status, idempotent audit, immutable DOB, callable purchase/funding gates and Stripe provider-call exclusion.
- `CHROMIUM_PATH=/usr/bin/chromium npm run test:eligibility:browser`: real guarded account service with fixture phone verification, signup and existing-account flows at 320/390/1440px.
- Customer-journey and Stripe-return browser regressions cover existing modes/returns and payment status compatibility. No real SMS, payments or production records are used.
- Rules regressions explicitly deny reading/writing the DOB/audit records as anonymous, account or admin clients. Official emulator execution remains subject to the previously documented emulator-download restriction; domain tests are not Security Rules execution.
