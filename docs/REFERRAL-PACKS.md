# Referral reward: one Basic pack each

Supersedes the previous cash-credit referral offer for new awards. Both the invited collector and referrer receive one unopened Basic pack after the invited collector spends at least $10 total of purchased credit on pack openings after binding the code, with a server-verified deposit on record. A higher saved minimum remains higher. Promotional, sellback and legacy test credit, and free inventory-pack openings, do not count.

The cap and enabled flag remain owner configurable. Default cap is 20. Codes remain optional at signup and bind once before the first opening. Self-referrals, closed referrers, exhausted caps, payment holds and repeat awards are blocked. Spending can accumulate while the offer is paused; awarding waits for enabled settings and a subsequent qualifying paid opening. A valid enabled saved Basic catalog is required before awarding; if missing, the qualifying purchase fails atomically without a debit or partial award.

The two inventory awards, referral count, activity, qualifying purchase and once-only flag commit in the same transaction. Retries replay the original operation. Opening awarded packs uses the normal inventory flow and earns no Spark Points. Pack prices and odds are unchanged. The separate first-deposit welcome Basic pack remains available once per account.

Existing credit-award records are preserved and never receive a replacement pack. Saved old cash settings are normalized on read to Basic pack rewards with a minimum of $10; their version, enabled flag and cap remain intact. No database migration or client-side grants are required. Saving in Admin persists the new explicit pack schema. Historical credit award emails remain accurate; new referral emails describe unopened Basic packs.

This uses the existing sandbox credit ledger and verified Stripe test funding. It does not activate live payments. Refunds after an award still use payment review; this change does not automatically claw back opened or transferred-value historical prizes. Admin should review related inventory and both accounts when investigating a refund or abuse.

Deploy after pulling and installing dependencies:

```bash
npx firebase deploy --only functions:ripprAccount,functions:ripprStripe,functions:ripprEmailEvents,functions:ripprEmailDelivery,functions:ripprEmailRetry --project rippr-2b01c
```

Frontend changes use the normal Vercel build. Sandbox policy version is now `sandbox-2026-11-13-v4`; deploy Stripe as well as Account so their eligibility checks stay aligned. No new secrets or rules. Domain tests exercise accumulation, source exclusions, verified-deposit gating, concurrency/retries, cap, pause, missing-catalog rollback and old-award preservation. Browser fixtures verify published terms, inventory confirmation and admin editing at mobile/desktop widths.
