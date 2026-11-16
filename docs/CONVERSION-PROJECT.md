# Landing-to-customer conversion project

Project owner: rippr. Implementation/coordination: Codex. Acquisition traffic enters **https://www.rippr.gg/landing**. This phase installs a measurable foundation; it does not launch ads, contact customers, spend money or claim observed conversion results.

## Delivered in phase 1

- Landing displays only valid enabled saved catalogs with explicitly saved prices. No default/draft/demo/unpriced lineup is offered. Retry and unavailable states remain usable on mobile.
- First-visit copy explains one card per pack, published odds, $10 minimum balance funding, sellback for site credit and separate shipping fees before the signup decision.
- An unsigned pack-opening action leads to the signup flow while preserving the chosen pack. Existing users can switch to login.
- Hosted Checkout return offers the selected pack after funding or cancellation, with account/mode/expiry validation; it never purchases a pack automatically.
- Admin → **Conversions** reports 7/30-day landing cohorts and coarse acquisition sources. Owner-only server summaries contain no customer/contact/payment identifiers.
- First-party browser measurement separates reported landing/pack/signup/Checkout stages from new account creation, verified live funding and paid openings confirmed by server events. Multi-pack quantities and replayed events do not create multiple opening customers. Repeat means a second distinct paid opening, not necessarily another visit/day.

## Measurement scope and limits

A landing session is a random browser session token with a 30-minute authorization window. Sources are a fixed list: direct, Instagram, TikTok, Facebook, YouTube, Discord, Google, email, referral or other. Only the first reported source is retained; arbitrary UTM text, full URLs, referrer paths, phone numbers, sign-in codes and payment payloads are not collected. A supported `utm_source` takes priority over recognized external referrer hostname.

Source attribution is a reported label, not proof of causation. A shared device, cleared/blocked storage, privacy choices, blocked calls, lost navigation events or another device can undercount activity. Checkout handoff reporting waits at most 350ms; a cold-start request may be interrupted if the user never returns. Browser session counts are not unique people and adjacent stages are not required to occur in order. These counts must not be described as exact abandonment rates.

Confirmed outcomes count only accounts created after the measured landing visit, linked during its active session. Registered/new live account creation must be present before confirmed funding/opening totals count. Existing-customer visits can appear in browser steps but do not inflate new-customer financial conversions. Trusted event timestamps allow asynchronous trigger delivery; one attributed new account can contribute once per confirmed stage for up to 30 days. Rewards/free opens and sandbox deposits do not count as paid outcomes. Signed-in owner visits are excluded; signed-out owner traffic cannot be reliably identified. No previous traffic is backfilled. Refunds do not erase historical first-funding events: these are activation metrics, **not net revenue or contribution**.

Browser measurement honors GPC, DNT and the opt-out control in Privacy. Server-only hashed milestone buffers may exist up to 30 days without attribution. Session records are marked for deletion after 37 days, linked account measurement after 37 days and aggregate day/source counts after 90 days. Network throttle records expire in minutes. Hourly cleanup processes at most 2,000 expired documents per collection; backlogs can delay physical deletion. Financial/account retention is separate. The public event endpoint caps stage writes per session, network requests and new daily sessions, but does not prove humanity; treat reported engagement as observational data and review abuse before scaling spend.

## Deployment

```bash
cd ~/rippr &&
git pull --ff-only origin main &&
npx firebase deploy --only functions:ripprAccount,functions:ripprConversion,functions:ripprLiveConversionAccount,functions:ripprLiveConversionOpening,functions:ripprConversionCleanup --project rippr-2b01c
```

Frontend must finish its normal Vercel deployment. No new secret or Firestore rule/index change is needed; the new measurement roots are covered by default deny and read only through authenticated owner functions. Only live/public storefront measurement is enabled. Existing business/financial settings are untouched. Firestore triggers operate independently from money/item transactions and do not hold up checkout/opening. Automatic deployment retry prompts apply to the new event functions' deduplicated records.

## Owner verification after deploy

1. Signed out, use a fresh browser session and open `/landing?utm_source=instagram`. Browse a current pack. Admin signed-in traffic is deliberately not your test visitor.
2. In Admin → Conversions, refresh. The landing and pack session should appear under Instagram; a new signup or checkout page alone must not show a paid customer.
3. For real-customer outcomes, allow a consenting new adult tester to follow the normal live signup/funding/opening path. Do not switch production mode or make a real charge merely for measurement. Existing sandbox domain/browser tests verify transaction paths without live money.
4. Allow asynchronous event delivery, refresh and check one new account/first funding/first paid opener, with no increases from refreshes or multi-card batch quantity. Replayed events must not double counts.
5. From an opening page, cancel a hosted Checkout and confirm **Back to [pack]**. After a normal successful funding, confirm **Continue to [pack]**. Neither action auto-opens.

## First acquisition experiment — ready, not launched

Use one existing core pack and the same clear explanation across 3 organic posts. The customer should see the card possibilities, price/odds and a single “Explore packs” action. Show actual opens and packaging; obtain permission before using a customer's content. Do not invent testimonials, repeat-customer counts or delivery proof.

| Channel | Destination | Creative |
| --- | --- | --- |
| Instagram | https://www.rippr.gg/landing?utm_source=instagram | Short real opening plus a clear card close-up |
| TikTok | https://www.rippr.gg/landing?utm_source=tiktok | Show choosing a pack, reveal, then My items |
| Facebook | https://www.rippr.gg/landing?utm_source=facebook | Explain keep/sell for site credit/ship, with actual screenshots |

Track posts and any eventual spend manually alongside the source dashboard. This phase deliberately does not claim campaign-level attribution or ROAS. Use ads only after payment/support and contribution economics remain acceptable for real customers.

## Review rhythm and next work

- **Daily during the first test:** refresh Conversions and operations Overview. Record source traffic, pack reach, new funded customers, first paid openers, actual complaints and any failures. Fix broken paths before trying more creative.
- **After meaningful traffic:** review the mobile journey with observed drop-off and customer feedback. Change one material element at a time; keep dates/creative notes. Small samples are directional, not statistical proof.
- **Next deliverable:** a customer-feedback summary and one focused landing experiment selected from actual traffic (headline, pack choice or funding explanation). Support issue themes and card-choice outcomes are follow-up work; this phase does not add a complete customer-success CRM.

Regular updates can be recorded in this file/STATUS during active work. No automated background project-management messages or unattended ad purchases have been scheduled.
