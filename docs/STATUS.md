# rippr status — collector cards and welcome screens

Working board: [PROJECTS.md](PROJECTS.md). Asset measurements: [PERFORMANCE.md](PERFORMANCE.md).

## Latest collector/welcome polish

- Unified profile card frames, visible card values (including zero), rarity capsules, selection/focus finishes and action spacing. Long names remain keyboard-scrollable; missing card art is explicitly labeled rather than replaced with unrelated artwork.
- Community cards use aligned title/copy/action areas, consistent badges and restrained hover/focus treatment. Missing avatars use Pip; missing featured artwork is labeled honestly. Like counts and account data remain authoritative.
- Login/signup/code screens retain the current forms and compact 88px mobile welcome strip. Copy changes with the step, the approved Pip/real-pack composition is preserved, inputs/code entry have consistent finishes, and floating Pip respects reduced motion. Welcome art uses an optimized small WebP.
- Three new fixture browser groups cover 320/390/1440px, long names/focus, zero values, missing art/avatar, login/signup/referral/Remember me visibility and verification/reduced motion. Full sign-in/persistence mechanics are unchanged.
- Frontend-only. Shipping and accumulated Firebase deployment remain deferred. No new authentication provider, rules, rewards or account-writing behavior.

## Latest reveal/results polish

- Card names use a clear main-name/detail hierarchy; long names remain keyboard-scrollable within their allotted space. Full names remain accessible.
- Refined rarity/value/action styling without changing stage geometry, tearing, rarity cycling, flip timing or fullscreen behavior.
- Result cards show value and keep/sell disposition with consistent framing, a visible batch summary, and missing-art fallback. Shipped/delivered outcomes are labeled accurately.
- Four new browser groups cover extreme names, failed-sale retry, mixed sold/kept results, missing artwork and unchanged inline stage size at 320x900, 390x900, 1440x1000 and 844x390 landscape. Added to the regular browser suite.
- Frontend-only; shipping work and the accumulated Firebase deployment remain deferred.

## Latest brand polish

- Shared compact navy/cyan feedback styling with the approved optimized Pip artwork for homepage grails, Community and My items/activity.
- Separate loading, empty and error copy; loading animation respects reduced motion. Empty displays do not invent cards or community activity.
- Homepage grail failures offer retry; Community and inventory searches offer clear search when empty. Existing collection actions remain in place.
- Three browser groups cover retries, empty/search actions, artwork decoding and layouts at 320, 390 and 1440 pixels. Included in the regular browser command/CI.
- Frontend-only. No new backend changes, no new artwork generation, no shipping work or Firebase deployment.

## Latest frontend batch

- Notification switches now explain that they store preferences; email delivery is not connected. The hint is associated with both notification controls and remains visible after account initialization.
- Profile forms use native required/email validation before a request. Failed saves preserve entered values and focus a readable error; error feedback is announced as an alert and successful feedback as status.
- Phone changes focus the next code/number field and validate the six-digit code before verification. Existing session/identity checks remain intact.
- Added durable browser regressions for settings errors/retries, preference rollback and phone-step focus, plus existing navigation menu/Escape/dialog-focus/sign-out behavior at 320, 390 and 1440 pixels. These add six groups to the 21 customer-journey groups. Navigation production code and header design are unchanged.
- This batch needs only the frontend build. It adds no backend/rules changes to the pending deployment. Shipping/admin fulfillment work is deferred by the owner; the existing pending `ripprAccount` update remains recorded below for the combined release.

## Previous batch — inventory, redemption and performance

- **R-04 — Complete inventory access:** cards and packs now have Load more controls. The museum editor can reach older kept/shipped cards, and Order tracking can load older requests. Authenticated cursors use timestamp precision plus document ID; identical timestamps, deleted boundary records and new records do not skip the continuation. Snapshots start at 200 cards/packs and 50 requests rather than imposing a hard access limit.
- **Refresh and account safety:** loaded ranges are refreshed, duplicates are removed, successful old sales update correctly, repeated page requests coalesce, and stale responses/errors are discarded after refresh or account changes. Search/filter copy describes its loaded scope. Unchanged profile card DOM/focus and selection survive refresh; tracking no longer hides the current request merely to load another history page.
- **R-05 — Seasonal redemption:** `enabled` controls new purchases and reward offers. An owned pack can still redeem after sales stop or its sale price is removed, provided its current catalog/version is valid and ownership is verified. It consumes once and costs zero balance. Exact owned-record verification works beyond the first page. A missing seasonal catalog does not fall back to concept cards or consume the award.
- **R-06 — Reusable journey checks:** added a Playwright suite using actual page scripts and isolated account/museum services. CI now installs Chromium and runs these checks after domain tests/build/static reference checks.
- **R-07 — Smaller active artwork:** five core pack sprites use lossless WebP inside their existing SVG geometry; reveal-back and landing-slab references use lossless WebP too. The five-pack asset group is 35% smaller. Dimensions, viewBox and alpha outlines are unchanged. Transparent PNG/WebP compositing can differ by one 8-bit RGB level in Chromium; no byte-identical browser rendering claim is made.

Previous foundation fixes (fulfillment labels, reward prize readiness, expanded release checks) remain included.

## Verification

- **91 offline tests pass**, including pagination boundaries, timestamp ties, ownership isolation, retry/reset races, missing seasonal catalog and one-time redemption.
- Build and static HTML reference checks pass: 16 pages / 715 local references.
- **37 browser groups** cover 21 customer journeys, 6 settings/navigation, 3 branded feedback states, 4 reveal/results layouts and 3 collector/welcome layouts at 320, 390 and 1440 pixels: auth form/return paths; real-service sell/ship; older inventory; museum draft/eligibility/save; order-history failure/retry; seasonal redemption; batch skip/theater exit/interrupted reveal.
- Lossless image decode and browser alpha/geometry checks completed; source asset payload measurements recorded separately.
- Whitespace/syntax checks pass.

The browser suite intercepts all HTTP and uses fixtures. It does not establish real Firebase SMS or SDK persistence behavior, Security Rules correctness, production infrastructure, payment processing, or carrier dispatch. No production account data or balances were changed. CI is configured; a successful hosted run is not assumed from local results. No production load-time/Core Web Vitals claim is made from the asset byte savings.

## Deferred deployment

Inventory pagination, exact owned-pack verification and seasonal redemption use the updated existing **ripprAccount** Function. The owner will deploy the combined backend changes after this work is complete. This also includes the previous daily reward readiness fix. No new rules, Function names, secrets or payment integration are needed.

From the owner's authenticated Firebase checkout:

```sh
cd ~/rippr &&
git pull --ff-only origin main &&
npm ci &&
npm ci --prefix functions &&
npx firebase deploy --only functions:ripprAccount --project rippr-2b01c
```

This workspace has not deployed Firebase. If local edits block a pull, inspect/stash them rather than discarding them. Older snapshots remain readable; additional paging and the new ownership lookup require the new Function.

## Repeat checks

```sh
npm test
npm run build
npm run check:site
npx playwright install --with-deps chromium  # first browser setup only
npm run test:browser
```

To use an installed Chromium: `CHROMIUM_PATH=/usr/bin/chromium npm run test:browser`.

## Next project

**R-08 — Fulfillment operations (deferred by owner):** older admin shipping queue access, request lookup, status edits and conflict recovery. The admin request queue is still capped at 100; activity is still the latest 50 records. These limits are separate from the inventory work and are not claimed to be removed.

Current work: keyboard/focus and error recovery in navigation and account settings. Notification preference copy now clearly distinguishes stored preferences from active email delivery. Actual notification delivery, error visibility and owner-supplied real fulfillment content remain later projects. Legal and payment-provider setup remain owned by the business owner.

## Updates

During active work, post updates when a finding changes priorities, verification completes or something is blocked. Update this report and the board at completed milestones. No unattended background work or scheduled reporting is configured.
