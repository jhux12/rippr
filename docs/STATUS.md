# rippr status — larger pack pools

Working board: [PROJECTS.md](PROJECTS.md). Asset measurements: [PERFORMANCE.md](PERFORMANCE.md).

## Latest 1,000-entry pack pools

- Increased the shared catalog, manual editor, library-to-pack helper, picker and owner rules from 100 to **1,000 card entries per pack**. The backend uses the same copied validator. Each opening still awards one card; existing odds, prices and historical winnings are not migrated or changed.
- Added a conservative UTF-8/map-aware **900 KiB** document budget below Firestore's 1 MiB hard limit. Oversized drafts are rejected with an actionable message, never silently truncated. Long image URLs can hit the size budget before the count limit.
- Optimized the odds calculator's rounding adjustment using sorted recipient values and binary search. It preserves exact basis-point totals, minimum included odds, deterministic output and reachable EV checks.
- Added Select matching cards within remaining capacity, a 50-row contents view with show-more/search and lazy artwork. The picker and lookups support the larger selection size; record lookups use bounded 30-ID queries instead of individual HTTP reads. Import/CSV limits remain separate.
- Five new domain/service cases and three browser groups cover 1,000 entries, 1,001 rejection, UTF-8 size guards, large EV generation, server purchase/idempotency and bulk draft/save/overflow flows at 320/390/1440px. New owner rules cases are provided; emulator execution remains blocked by the JAR download.
- Requires updated **ripprAccount** and **firestore.rules** before publishing pools above the prior limit. The cumulative deferred command below includes both. No new Function, index, secret or migration.

## Latest prices and sorting before import

- TCG import search tiles display USD market prices or finish ranges before selection. Low/high value sorting uses the lowest price in each range; missing/failed prices sort last.
- Search pages accumulate matches; Load all matching cards ranks the entire query once loaded. The UI distinguishes loaded matches from full-query results, limits display to 24 cards at a time and explicitly stops at 1,000 matches with a refine-search message.
- Four concurrent price requests, progress, stop, retry and HTTP 429 handling keep requests bounded. Source price summaries do not write to the library or packs; import previews still fetch current values and retain site rarity controls. Selections survive sorts/pages and clear after saving or sign-out.
- Two domain cases and three mobile/desktop browser groups cover ranges/sorting, cross-page late expensive cards, missing prices, retry, stop/rate limit, selection, bounded concurrency and stale-response isolation. No new rules, Function, index or secret. Live TCGdex access remains unverified here.

## Latest library-first imports and pack selection

- TCG import previews now support a site rarity selector per card and an apply-to-all control. Import saves only update the site library; the library pack-assignment form was removed.
- Packs now have **Browse site cards**: search name/set/number/finish/ID, inclusive min/max value, site rarity, raw/graded condition, recently added/value/name sorting, hide existing and selected-only views. Missing value/rarity and already-added cards cannot be selected.
- Full-library batches (200 records), progress, cache, refresh, retry and 30-tile rendering avoid first-page-only filters. Selection survives filtering; current saved revisions are checked before staging new 0%-odds cards. Source changes require a second review; existing odds/values remain intact.
- New records receive an immutable server added date. Legacy v1 first-save timestamps are usable; unknown creation times on edited legacy records remain unavailable and sort last. Requires the updated Firestore rules before new library saves; no Function, index or secret change.
- Three new domain cases cover combined filters, stable value/date ordering and honest legacy dates. Three picker browser groups cover 320/390/1440px plus import rarity/no-pack-assignment checks in the existing library suite. Rules cases cover timestamp creation, preservation and invalid legacy backfill; emulator execution is still blocked by the uncached JAR download.

## Latest TCGplayer market-value previews

- The owner approved using listed TCGplayer USD market values through TCGdex instead of requiring a verified Near Mint-only feed. The item's Near Mint condition badge remains separate from the market reference; slabs keep their manual grade-specific values.
- Pokémon imports now include market-price previews. Saved cards support **Get TCGplayer prices**, explicit finish choice, linking a manually entered card by TCGdex ID and display of the matched identity/source update time. No TCGplayer key or scraping.
- Uses the chosen finish's `marketPrice`, with fresh requests. Missing, invalid, non-USD and zero quotes do not replace values. Old timestamps are visible/flagged. Graded slabs are excluded. All updates remain version-checked and previewed; packs and historical winnings are not silently repriced.
- Five new domain cases cover quotes, finish matching, missing values, import defaults and fresh lookup/identity guards. Three browser groups cover pricing and priced imports at 320/390/1440px, including slab exclusion, manual linking, stale-version rejection and missing-price retention.
- No new Function, Firestore/Storage rule, API key or deployment is needed for this frontend addition beyond the existing library setup. Live TCGdex API/CORS access remains unverified because this workspace denies the API domain. Tests use documented response fixtures. See [CARD-LIBRARY.md](CARD-LIBRARY.md#tcgplayer-market-values).

## Latest reusable card library

- `/admin → Card library` is now a separate owner-only catalog, with paginated saved-name search, TCGdex English card import previews, CSV import/value updates, duplicate checks, bulk edits and optional TCGplayer reference links. No API key or scraping.
- Cards without a listed market quote start unpriced; rippr rarities are explicitly configured. Raw cards default to Near Mint; slabs preserve explicit grades and separate values/IDs. Library edits do not silently update pack economics or historical winnings.
- Adding selected cards stages new 0%-odds entries in the existing pack editor; matching IDs and their odds/values are unchanged. Pack publishing and EV review remain explicit.
- CSV saves are version-checked, atomic per 50-card batch and retry only remaining rows after partial progress. Private UI state clears on sign-out.
- New Firestore rules protect/validate `cardLibrary`. Rules tests were added, but emulator execution again failed while downloading the uncached Google-hosted JAR. Direct TCGdex API requests are blocked by workspace policy; the official repository documentation/license were read and provider/browser tests use documented fixtures. Live API/CORS/artwork remain unverified here.
- Usage and limits: [CARD-LIBRARY.md](CARD-LIBRARY.md). No production data, Functions deployment or shipping work in this batch.

## Latest condition badges

- Raw cards use the owner's Near Mint default. Graded slabs show an explicit grader and grade (PSA 10, CGC 9.5, etc.) in a neutral badge separate from rarity.
- Pack and homepage-grail editors now let the owner mark a slab and enter its actual grading company/grade. Missing or invalid grades cannot publish. No grade is inferred from names or photos, and no certification verification is claimed.
- Grading is retained when a card is awarded and read from inventory, public museums, and request item snapshots. Card galleries, reveal/results, previews and tracked request items display it.
- Existing slab catalog/homepage entries must be marked in admin. Existing winnings are not rewritten from the current catalog: old slabs without recorded grading require explicit correction from known source data. Raw legacy entries retain the Near Mint policy.
- Three domain cases cover validation, legacy compatibility and award/inventory/museum/request persistence. Three browser groups cover mobile/desktop badges and pack/homepage admin saves/validation.
- Added owner-only Firestore homepage validation tests. The rules emulator download failed, so rule compilation and emulator behavior remain unverified in this environment. No deployment was performed.

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

- **118 offline tests pass**, including metadata/price separation and market-quote cases, library CSV/provider/pack invariants, pagination boundaries, timestamp ties, ownership isolation, retry/reset races, missing seasonal catalog and one-time redemption.
- Build and static HTML reference checks pass: 16 pages / 726 local references.
- **56 browser groups** cover the prior 53 journeys/layouts plus large-pool bulk selection, EV calculation, 1,000-entry draft/save, bounded rendering and overflow rejection at 320, 390 and 1440 pixels. Existing library groups now also check per-card/bulk import rarity and that imports do not change packs. Existing coverage includes auth, sell/ship, older inventory, museums, tracking, seasonal redemption, batch skip, reveal and grading editors.
- Lossless image decode and browser alpha/geometry checks completed; source asset payload measurements recorded separately.
- Whitespace/syntax checks pass.

The browser suite intercepts all HTTP and uses fixtures. It does not establish real Firebase SMS or SDK persistence behavior, Security Rules correctness, production infrastructure, payment processing, or carrier dispatch. No production account data or balances were changed. CI is configured; a successful hosted run is not assumed from local results. No production load-time/Core Web Vitals claim is made from the asset byte savings.

## Deferred deployment

Inventory pagination, exact owned-pack verification, seasonal redemption and the larger pack-pool validator use the updated existing **ripprAccount** Function. Condition metadata also requires the updated **ripprMuseum** Function and **firestore.rules** for homepage grading. The card library adds owner-only Firestore access/validation rules, immutable added-date metadata and frontend tools; it needs no new Function. The owner will deploy the combined backend changes after this work is complete. This also includes the previous daily reward readiness fix. No new Function names, Storage rules, secrets or payment integration are needed.

From the owner's authenticated Firebase checkout:

```sh
cd ~/rippr &&
git pull --ff-only origin main &&
npm ci &&
npm ci --prefix functions &&
npx firebase deploy --only functions:ripprAccount,functions:ripprMuseum,firestore:rules --project rippr-2b01c
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
