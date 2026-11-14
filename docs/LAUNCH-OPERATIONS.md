# Live funding, copy and operations

## Funding minimum

Live Checkout now requires $10–$1,000 per top-up. The popup displays and validates the same limits, and the server rejects under-minimum requests before creating a new Checkout. Sandbox-only funding keeps its existing $1 minimum. Pack prices, odds, balances, rewards and existing signed payment settlement are unchanged. Already-created payments can still settle; this is a restriction on new Checkout requests, not a rejection of money already paid.

## Launch copy

Payment success/canceled pages no longer claim that no real money is charged. Cancellation asks users who completed payment elsewhere to check My account, rather than assuming an unpaid state. Pending-payment copy explains payment confirmation without implementation jargon. Live Checkout errors show a customer-appropriate retry/support message and a sanitized provider request reference when available; configuration details remain in server logs. Header balance accessibility text is mode-neutral.

Live policy sections use their approved operational wording rather than retired future-launch/review wording. No claims of legal or provider approval are introduced. Existing policy windows and cash-withdrawal restrictions remain. The unverified Trustpilot placeholder was replaced by a linked “Leave a review” invitation with five outlined, unscored stars, and unconfigured social buttons are hidden rather than acting as dead links. No rating, review count, shipment history or social account is fabricated.

## Admin overview

The owner-only overview retains payment holds, open payment reviews, email problems, shipping requests and promotion estimates. It adds all unresolved open/pending support requests and recorded Checkout/opening service error totals for the last seven Indianapolis calendar days. It refreshes every minute while visible, with manual refresh and links to the management queues/server logs.

Technical error recording is server-side, best effort, and bounded to avoid replacing/delaying the original failure indefinitely. Duplicate operation retries are counted once per category/day. The stored data consists of daily counts, failure category, allowlisted reason, timestamp and a hashed retry key; it excludes customer identifiers, phone numbers, request payloads, Stripe bodies and raw error messages. Live operational records use liveOperationalDays, isolated from sandbox operationalDays, and both remain denied to direct browser reads/writes by the existing default Rules. Admin summaries expose aggregate counts only.

Counts start at deployment with no historical backfill. Customer card declines inside hosted Stripe Checkout, browser-only/network/animation problems, expected insufficient-balance errors and ordinary policy rejections are not represented by these server error counters. Use Stripe's Dashboard and support reports alongside them. A failed count source shows Unavailable rather than a misleading zero.

## Deploy

The site changes follow the normal frontend deployment. Apply the server minimum and monitoring with:

```bash
cd ~/rippr &&
git pull --ff-only origin main &&
npx firebase deploy --only functions:ripprAccount,functions:ripprLiveStripe,functions:ripprStripe --project rippr-2b01c
```

No mode-switch script, key reset, database migration or Rules relaxation is needed. Preserve the current public live settings and tax configuration. After deployment, verify the popup rejects $5, accepts $10, and Admin → Overview loads the new sections. Do not create a real payment merely to test an under-minimum rejection.

## Verification

The domain suite covers minimum enforcement, live/test financial isolation, error retry deduplication, expected-error exclusion, aggregate privacy and reporting-source failure. Browser fixtures exercise live/test top-up UI, payment result copy, owner overview counts/privacy, navigation and paused live states at 320/390/1440px. A static live-render audit covers 23 public page templates, including all policy pages, and rejects retired sandbox/review wording and visible unverified rating placeholders. All browser tests use local fixtures and create no actual payments.
