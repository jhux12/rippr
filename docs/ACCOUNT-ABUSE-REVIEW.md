# Account security and promotion-abuse review

Review date: November 13, 2026, Indianapolis. Sandbox code/fixture review only. Firebase Console SMS policy, billing quotas, production App Check enforcement and provider dashboards were not independently verified from this workspace.

## Fixed

Welcome claims now share a deposit-eligibility check with referral qualification. Payment holds, outstanding review counts, payment debt and legacy holds block new deposit bonuses. A refunded or lost-dispute principal reconciled by the owner records `lastPromotionReversalAtMs`; an old first-deposit marker no longer unlocks an unclaimed bonus afterward. Newly verified funding records `lastVerifiedDepositAtMs`, including owner-reviewed credits. An unreversed later verified deposit can restore eligibility, but claimed welcome/referral awards are never issued again.

This is conservative: even a partial refund pauses unclaimed deposit promotions until newer verified funding. Other earlier paid deposits are not automatically attributed to the reversed transaction. Existing prizes are not silently removed. Related inventory and both referral participants still need owner review where refund/abuse investigation warrants it. These safeguards do not turn sandbox funding into live payments.

Welcome/referral UI and the top-up popup show paused eligibility. No eligible status is accepted from a browser request. Stored funding/hold fields remain server-written under existing rules.

The existing 60-second SMS resend convenience timer now survives reloads and is shared across tabs using only a browser timestamp; no phone number or verification code is stored by this feature. This is NOT an anti-bot security boundary: clearing browser storage or directly calling Firebase bypasses client timers. Actual SMS abuse prevention must come from Firebase's reCAPTCHA, provider limits/region policy and appropriate project enforcement. No real SMS was sent during tests.

## Existing protections reviewed

- Production phone sign-in uses Firebase reCAPTCHA. The testing bypass requires both the app and emulator URL to be validated localhost HTTP hosts.
- Server-authorized owner actions require verified token claims; body-supplied owner flags do not grant access.
- Referral binding rejects self-referrals and repeat binding, requires binding before an opening, and respects the configured cap and pause switch.
- Referral awards require purchased-credit spending and verified funding. Transactional once-only flags and operation replay prevent repeat rewards from retries/concurrent requests.
- Welcome grants are atomic and once per account. Free top-ups cannot manufacture verified deposit metadata.
- Credit, point and inventory mutations are server controlled. Purchased/promotional/sellback sources remain separate.
- Stripe Checkout creation has a server-side fixed-hour limit of 10 new attempts per account; existing operation retries reuse the saved request/session.
- Verified payment webhooks open refund/dispute reviews and hold affected accounts. Spent refunds create payment debt; earned Spark Points can require a separate review. Reconciliation checks provider state and current revisions rather than trusting the client.
- Account closure requires recent phone authentication, explicit consent and owner review; unresolved payment/points issues prevent cleanup.

## Remaining launch decisions

One verified phone per Firebase account is not proof of one person. Multiple phone numbers, account cycling/number changes and shared devices/payment methods are not fully detected by the present referral system. No invasive fingerprinting or automatic household bans were added. Before a broad promotion rollout, define a one-person/household policy and review suspicious referrals using appropriate payment/identity signals with false-positive handling.

Public referral-code lookup currently has no app-level server rate limiter; the browser cooldown protects SMS convenience only, not callable lookup traffic. App Check and appropriate server request controls should be assessed before a broad rollout.

The owner should verify Firebase SMS region allowlisting (US if US-only), quotas/billing alerts, abuse monitoring and App Check support/configuration for each deployed product. App Check is not a replacement for Firebase Auth SMS protections. The owner account currently relies on the designated verified phone; strong Firebase/Google project-account MFA and SIM/number protection remain operational requirements. These are not confirmed as enabled by this review.

## Verification and deployment

Domain tests cover held/reversed welcome claims, no claim consumption on rejection, immediate webhook holds, refund reconciliation, newer verified funding, referral qualification, once-only awards, source exclusion, admin authorization and existing financial/lifecycle regressions. Browser fixtures cover cooldown reload/cross-tab/expiry, checkout states and customer journeys. Official emulator/provider configuration checks remain separate.

Deploy frontend through the normal Git/Vercel build, and deploy all three handlers together so verified-funding markers, refunds and bonus eligibility agree:

```bash
cd ~/rippr &&
git pull --ff-only origin main &&
npm ci &&
npm ci --prefix functions &&
npx firebase deploy --only functions:ripprAccount,functions:ripprStripe,functions:ripprStripeWebhook --project rippr-2b01c
```

No new secrets, rules, indexes or retroactive account migration. Old eligible first-deposit markers remain supported until a newly recorded reversal blocks them. Reversals reconciled before this update are not retroactively inferred from ledger history.
