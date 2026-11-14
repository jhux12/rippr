# Latest: fees and promotion budget review

Owner selected 2.9% + $0.30 as a planning assumption (not a verified Stripe agreement). [ECONOMICS-REVIEW.md](ECONOMICS-REVIEW.md) separates per-top-up fee scenarios, pack contribution estimates, credit face liability and pack EV. Code evidence flags recurring streak/welcome costs and the default spin cooldown bypass; actual saved spin/referral settings remain unverified. Added a read-only Cloud Shell economics audit using the local Google login without printing/storing its token or accessing customer collections. No fees, funding minimum, reward/referral setting, pack price/odds or payment mode changed.

# Latest: sourcing policy and acquisition assumption

Owner reports available sourcing and acquisition costs equal to listed card values. Recorded the planning assumption and approval to honor awarded cards, handle sourcing/price exceptions through support, and avoid silent substitutions/rerolls or extra customer debits. Supplier coverage/prices are not independently verified. No site prices, odds, EV tooling, public policy versions or deployment settings changed.

# Latest: full card-level audit reviewed

Reviewed the owner-uploaded detailed public audit: 510 active entries, exact 100% odds and matching EVs for all three packs. No exact image duplicates within packs, normalized name/grade duplicates or conflicting values for identical cross-pack images; checked TCGdex name numbers agree with URL card numbers. Basic/Plus/Premium medians are $0.30/$3.45/$6.37. Top Plus/Premium outcomes are individually 0.01%, distinct from tier odds. One PSA 9 entry exists (Plus Bulbasaur); Premium is all raw Near Mint. [CARD-LEVEL-REVIEW.md](CARD-LEVEL-REVIEW.md) records findings, individual odds and remaining visual/stock/cost checks. No cards, prices, odds or other site data changed.

# Latest: fail-closed catalog availability

Removed server default-pool substitution for missing catalogs on every purchase/owned-pack tier and reachable reward-pack validation. Customer reads reject missing catalogs and show an unavailable opening; admin can still create a disabled draft. Existing owned packs remain intact and can redeem valid disabled/restored saved catalogs. No saved prices, odds, items or enablement changed. Explicit persisted fixtures replace legacy fallback-dependent tests. See [CATALOG-AVAILABILITY.md](CATALOG-AVAILABILITY.md); deployment requires the frontend and `ripprAccount`, with no rules/secrets/indexes. Saved demo pools and physical stock reservation remain separate review items.

# Latest: Premium price confirmed

Owner confirmed Premium stays $10. Audit targets now match the active $1/$5/$10 lineup. Existing saved prices, odds and pools are unchanged; the price decision is resolved in SAVED-PACK-REVIEW.md.

# Latest: owner-provided saved pack audit

Reviewed the owner-provided public Firestore audit output: Basic v32 $1/118 entries/80% expected credit return; Plus v52 $5/163 entries/82%; Premium v20 **$10**/229 entries/84%. No active saved $15 pack; disabled Icy Rush at $15 still contains demos. Disabled Elite/Ultimate remain demo catalogs and Mythic is unsaved. [SAVED-PACK-REVIEW.md](SAVED-PACK-REVIEW.md) records repeat/rarity/economic findings and limits. The report does not establish stock, current values, artwork/condition, costs or cash margin. No price/odds/catalog change made; confirm intended Premium price before any change.

# Latest: read-only pack readiness review

Reviewed purchase/catalog code and prepared [PACK-READINESS-REVIEW.md](PACK-READINESS-REVIEW.md). Verified missing-core-catalog demo fallback, repository price fallbacks differing from owner targets and no physical-stock reservation in the test purchase path. Actual saved catalogs could not be read because the workspace proxy blocks Firestore. Added `npm run audit:packs` / `scripts/audit-packs.mjs` for a read-only public-catalog report in Cloud Shell, with exact EV/rarity/repeat metrics and no fallback substitution. Calculation tests pass. No prices, odds, cards, stock, customer data or deployment settings changed. The per-pack saved-data assessment remains pending the command output.

# Latest: reviewed sandbox account closure

Account settings now supports phone-reverified closure requests, explicit test-entitlement relinquishment, status and pre-processing withdrawal. Admin → Account closures adds a paginated review queue, blockers, audit notes and bounded retryable cleanup. Request freezes new activity and hides public collections; processing redacts personal data, removes profile uploads/Auth identity and retains required records. Transactional request/completion notices use the existing outbox with a hashed verified-recipient binding after redaction. Scope/retention limits and deployment are in [ACCOUNT-CLOSURE.md](ACCOUNT-CLOSURE.md). No real accounts, files, payments, messages or deployed settings were mutated here. Tax/live payments remain off.

# Latest: sandbox eligibility and policy acceptance

Added pre-SMS adult DOB and separate draft Terms/Privacy choices to signup, a dedicated existing-account check, private server-only DOB/acceptance records, immutable audit/version timestamps and callable guards on new funding/purchases/owned-pack openings. Records explicitly remain self-attested, not age-verified; final launch terms and permitted-state/location checks remain pending. Existing reads/support/payment-status and paid webhook settlement remain available. Both `ripprAccount` and `ripprStripe` plus Firestore rules need deployment after the frontend. See [ELIGIBILITY.md](ELIGIBILITY.md). No live charging, tax or marketing changes.

# Latest: approved operating defaults

Owner-approved working defaults are incorporated into all five policy drafts: 18+/US cleared-state eligibility, 14-day unused purchased-credit/unopened-pack requests, no outcome-only refunds, nonexpiring nontransferable credit, support-assisted closure, future contiguous-US tracked shipping and 3–5-business-day dispatch target, wrong/damaged-item remedies, and retention/deletion targets. [APPROVED-OPERATING-POLICIES.md](APPROVED-OPERATING-POLICIES.md) records implementation gates and the existing support intake process. These future-service defaults are explicitly labelled; no state is cleared, live-money/refund adapter enabled, data purge scheduled or shipping activated. Final legal approval/effective date and enforcement remain required.

# Latest: policy operator details

Added owner-supplied pullz.gg LLC and the Indianapolis business mailing address to all five policy drafts. Removed the now-resolved operator/address placeholders in Terms and Privacy and updated the owner checklist. Draft labels and outstanding legal/launch decisions remain; no payment, tax or backend configuration changed.

# Latest: policy review drafts

Prepared five responsive, visibly marked drafts: Terms, Privacy, Refunds, Shipping & delivery, and Pack & credit disclosures. Shared desktop/mobile footer links now open standalone pages; no login or JavaScript is needed for policy access. Current sandbox/one-card/site-credit/Near Mint and grading behavior is described without inventing live refunds, shipping deadlines, operator details or legal clearance. Added [POLICY-REVIEW.md](POLICY-REVIEW.md) with missing owner/counsel decisions and launch/assent requirements. Tax remains off; no live-money, shipping, SMS, account acceptance or provider mutation is enabled. Owner reports completed payment/refund and email acceptance checks. Frontend only; no Firebase deployment needed.

# Latest: dedicated Checkout result pages

Added `/payment-success` and `/payment-canceled` with shared navigation/footer, compact responsive navy/cyan layouts, sandbox disclosure and account/pack/support links. Success polls only the authenticated server status, handles pending/review/refunded/failure states, keeps the operation ID for refresh and clears stale account results. Existing Profile return links remain supported. New Checkout requests use the dedicated result URLs; already-created sessions retain their original destinations. Frontend build/reference and Stripe domain tests pass; browser checks cover both pages at 320/390/1440px. Deploy frontend first, then `functions:ripprStripe`. No tax/live-payment setting changed or deployment performed here.

# Latest: operational review

Owner selected tax at funding and reports $1/$5/$15 packs. Confirmation-email receipt and reply-to reception are owner-confirmed. Focused email/access/mobile checks passed: four domain test files, 32 browser groups, and 16-page/736-reference site validation. Added `npm run test:operations` and [OPERATIONS-CHECK.md](OPERATIONS-CHECK.md) with precise evidence and outstanding deployed checks. Public-domain access is blocked by the workspace allowlist; no production/provider mutation or deployment occurred. Tax stays unmodified and policy work remains deferred.

# Latest: credit ledger and sandbox payment operations (not deployed here)

Added purchased/promotional/sellback/legacy test buckets with immutable per-operation credit entries; aggregate balances stay unchanged. New funding is labelled as purchased sandbox credit; old balances remain legacy, never live value. Added a zero-initialized isolated USD ledger foundation, still unreachable from live payments. Admin → Payments adds paginated reviews/ledger, current Stripe proof, required notes, stale-edit guards, refund/debt reconciliation and account-switch cleanup. Live keys and payments remain rejected. See [PAYMENT-OPERATIONS.md](PAYMENT-OPERATIONS.md) for deployment and the sandbox acceptance matrix, and [LAUNCH-READINESS.md](LAUNCH-READINESS.md) for owner/external dependencies. No Stripe objects, real charges, refunds, messages or Firebase deployment were performed by this workspace.

# Latest: Stripe sandbox funding (not deployed here)

The user selected funding the existing balance. New `ripprStripe` and `ripprStripeWebhook` Functions support authenticated hosted Checkout and signed, idempotent USD test-credit settlement. The updated `ripprAccount` reports the sandbox funding flag and blocks purchases/redemption/sales/shipping during payment-review holds. Frontend supports a Stripe sandbox popup and verified status on return; free credit remains the default until explicitly changed. Stripe Tax is opt-in and requires a tax code after taxable-event classification; no real-money wallet migration is implemented. The requested plugin/MCP/skill plan path was unavailable, so the locally prepared plan and exact setup boundaries are documented in [STRIPE.md](STRIPE.md). Test keys and webhook secret are entered only through Firebase Secret Manager. No live API/account/Checkout validation or deployment was performed in this workspace.

# rippr status — daily spin, streaks and welcome case

Working board: [PROJECTS.md](PROJECTS.md). Asset measurements: [PERFORMANCE.md](PERFORMANCE.md).

## Latest rewards page

- Replaced the daily case reel with a responsive eight-or-more-slice wheel, keeping the existing `rewardSettings/daily` configuration, `claimReward` transaction, exact prize odds, catalog checks, cooldown and testing bypass unchanged. The server saves the prize before motion. Equal display slices are explicitly distinguished from actual odds; the odds dialog shows the configured percentages.
- The navy/cyan layout follows the desktop/mobile mockup: spin plus welcome case on desktop, then seven-day streak; mobile stacks spin, streak and welcome. Existing pack artwork, Pip, shared header/footer and referral behavior are retained. The referral banner expands to reveal the existing invite code/actions. New transparent welcome-case artwork is losslessly encoded as a 578 KiB WebP.
- Streak rewards are separate server-controlled claims: $0.05, $0.05, $0.10, $0.10, $0.25, $0.25 credit, then one unopened Basic pack. Claims are once per rolling 24 hours, reset after 48 hours without claiming, and cycle after day 7. The spin testing bypass does not bypass streak timing. Credits/packs, activity and claim metadata commit atomically with the existing operation-ID retry guard.
- The one-time welcome case grants an unopened Basic pack only when trusted backend metadata `firstVerifiedDepositAtMs` is a positive, non-future millisecond timestamp. Free test top-ups and client-supplied flags do not qualify. No payment verification adapter is connected by this change; the case stays locked until that trusted integration exists. `welcomeCaseClaimedAtMs` enforces the once-per-account claim. Existing account write protections cover these fields; no rules change.
- Wheel motion owns one transform effect, cancels on account change, pauses while hidden and settles immediately with reduced motion. Resizing preserves the same server-selected prize. No 90-tile reel, permanent motion handle or particle accumulation remains.
- Six new domain scenarios cover streak boundaries/cycling/idempotency/concurrency, pack redemption, rollback, authentication, balance limits and deposit spoofing. Three new browser groups cover 320/390/1440px layout, real isolated account transactions, correct odds/cooldown, hidden/resize/reduced motion, pack awards, streak/welcome claims and account isolation. Standard build/reference checks pass (16 pages / 733 references).
- Deploy the updated existing **ripprAccount** Function to enable streak/welcome claims. The daily spin continues with the prior backend; missing extras are shown unavailable rather than fabricated as claimed/unlocked. No new Function name, rule, index, migration or secret. This workspace has not deployed Firebase.

## Latest logo motion and sparkle loading

- Shared public headers introduce the existing cyan sparkle with a 480 ms fade/small rotation, followed by a 340 ms wordmark fade with a 120 ms delay. Hover, primary tap and keyboard focus give the sparkle one 340 ms accent. The logo rests afterward; links retain their native behavior with no navigation delay.
- Effects use opacity/transform without changing header dimensions. At most two entrance effects or one interaction effect are owned at once. Finished/cancelled handles are released; hiding/suspending the page or enabling reduced motion cancels active logo effects. Restoring the page or disabling reduced motion does not replay the entrance.
- The same vector sparkle now marks shared loading panels, homepage retry, Community paging, profile account/paging, sign-in submission, landing grails, opening odds and the museum. Loading panels replace decorative Pip/line animation with the sparkle; museum placeholder frames stay static. Existing loading/status text carries the meaning, and buttons retain contrasting marks. CSS loading effects pause while hidden and become static with reduced motion; success/error transitions remove them.
- Three new fixture browser groups check 320/390/1440px headers on home/opening/auth, bounded repeated interactions, native home navigation, stable header dimensions, reduced/hidden motion, centered loading and loading error/success/sign-out cleanup. The existing navigation, brand-state and complete customer-journey groups also pass: **30 focused browser groups** for this batch. The broader command now includes 72 groups; the prior full 69-group run remains recorded for the media-recovery batch.
- Build/reference checks pass (16 pages / 733 local references). Frontend only, with no new animation library, generated art, external request or Firebase deployment requirement. Existing preview exports already inline the changed shared navigation and loading styles.

## Latest audio and imported-artwork recovery

- Confirmed that image error handlers immediately hid artwork/replaced it permanently after one failure. Opening grails/previews, reveals/results and My items now share bounded two-retry recovery. Reveals/results/My items retain a branded **Retry image** action if automatic recovery fails. Delayed image success restores the original artwork without a page refresh or changing saved cards, prices, selections or keep/sell behavior.
- Retry queries are runtime-only and restricted to the public TCGdex asset origin; signed/uploaded image URLs remain exactly unchanged. Source changes and removed images cancel queued retries. Hidden/page-suspended retries wait until return. The original cause of the owner's intermittent live CDN failures is not proven by these fixture tests.
- Confirmed audio failure paths: failed first-load clips were marked loaded and never retried, while hidden-page suspension required another activation to resume. Loading now retries missing clips with two workers, bounded fetch attempts/timeouts, and clears completed load handles. Returning to a visible/restored page attempts to resume the existing context; a fresh gesture can retry an autoplay-blocked pending resume.
- Added silent-frame gesture priming and playback audio-session selection where supported, plus an Enable sound label for a suspended context and an audible unmute cue. Mute and overlay/background stopping remain enforced. Mobile-specific activation/session behavior is fixture-tested; native iOS/Safari is not claimed verified.
- Four new artwork groups simulate interrupted requests, corrupt images, 503s, cached failures, manual retry, source/removal races, signed URLs and hidden-tab recovery at 320/390/1440px. Audio resource tests now include failed loads and pending autoplay recovery, and a new real-AudioContext group verifies shipped WAV decoding, nonzero master output, tab recovery and silent mute. Repeated-opening tests now assert that real WAV cues start through full-motion batches.
- Frontend only. Build, static references and self-contained preview exports include the new loader/styles. No additional Firebase deployment, data rewrite or backend change.

## Latest pack-opening reliability and motion

- Each opening owns one cancellable phase deadline and its scripted motion handles. Hidden tabs and page suspension freeze the current delay and visual effects together, then resume the same award. Reset/skip cancels stale work; the theater ignores stale inline visibility observations while expanded.
- Foil dragging measures its target once and coalesces geometry painting to one animation frame. Finished peel effects release their retained fill layers; reset clears queued paints and pointer capture. Reveal actors and the bounded two-card image decode cache are discarded after a batch.
- Audio reuses one context, disconnects ended/stopped/failed sources and gain nodes, bounds initial decoding to two workers and suspends on hidden/pagehide. Cues never delay or replay a stale reveal.
- Rarity color stays local to the card rather than repainting the full-screen backdrop every interpolation frame. Decorative SVG work yields during opening. The large card stays centered through its flip, then settles using transform/scale; details follow after the settle. A short rarity lock pulse/ring and front sheen add emphasis without changing prizes, colors or keep/sell actions. Skip and reduced motion bypass these effects.
- New real-motion browser checks cover 29 purchased batches / 83 fixture awards at 320/390/1440px, repeated 1/3/5-pack runs, skip/reset, visibility/page suspension, bounded actors/context/cache and continuous reveal geometry. Separate foil/audio checks cover 25 peel cleanups and 100 four-channel playback cycles. Additional phone/desktop/landscape geometry inspection confirms separated artwork/details/actions. These are lifecycle/layout checks, not device FPS benchmarks.
- Frontend only. No new Firebase rules, Function, index, asset or data migration. Existing deferred backend deployment remains separate.

## Latest dotted-set import fix

- The provider ID validator rejected periods, blocking valid set IDs such as `sv03.5` before any request. It now accepts periods inside ID segments while rejecting traversal, query/hash injection and whitespace.
- Dotted artwork paths, card-detail/price requests and the manual TCGdex link field now accept the same IDs. Dotted imports retain their original provider ID and use a disjoint, reversible site-key namespace within the existing 64-character format. Existing generated IDs are unchanged.
- Two domain cases and three browser groups cover `sv03.5` search, price/artwork display, import rarity/save, manual price links and pack draft/save at 320/390/1440px. API traffic remains fixture-based because live provider access is restricted here.
- Frontend only. No new Firestore rules, Function, index, secret or data migration is needed for this fix. The owner reports other dotted searches worked; the validator fix is confirmed, but that observation means it may not explain every failed live search. The API query combines any card-name filter with the exact set ID, and live provider behavior remains unverified here.

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

- **All 16 offline test files pass**, including six new streak/welcome scenarios. Coverage includes metadata/price separation and market-quote cases, library CSV/provider/pack invariants, pagination boundaries, timestamp ties, ownership isolation, retry/reset races, missing seasonal catalog and one-time redemption.
- Build and static HTML reference checks pass: 16 pages / 733 local references.
- **All 75 browser groups passed** for this rewards batch, including the three new wheel/streak/welcome groups and the existing animation, audio, artwork, account and admin coverage. Dotted set/card search, pricing, artwork, import/save and pack-draft flow remain covered at 320, 390 and 1440 pixels. Existing library groups now also check per-card/bulk import rarity and that imports do not change packs. Existing coverage includes auth, sell/ship, older inventory, museums, tracking, seasonal redemption, batch skip, reveal and grading editors.
- Lossless image decode and browser alpha/geometry checks completed; source asset payload measurements recorded separately.
- Whitespace/syntax checks pass.

The browser suite intercepts all HTTP and uses fixtures. It does not establish real Firebase SMS or SDK persistence behavior, Security Rules correctness, production infrastructure, payment processing, or carrier dispatch. No production account data or balances were changed. CI is configured; a successful hosted run is not assumed from local results. No production load-time/Core Web Vitals claim is made from the asset byte savings.

## Deferred deployment

Inventory pagination, exact owned-pack verification, seasonal redemption and the larger pack-pool validator use the updated existing **ripprAccount** Function. Condition metadata also requires the updated **ripprMuseum** Function and **firestore.rules** for homepage grading. The card library adds owner-only Firestore access/validation rules, immutable added-date metadata and frontend tools; it needs no new Function. The owner will deploy the combined backend changes after this work is complete. This also includes the previous daily reward readiness fix and the new streak/welcome reward claims. No new Function names, Storage rules, secrets or payment integration are needed.

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

Latest completed product work: the redesigned rewards page and server-controlled streak/welcome claims, following subtle logo motion and media recovery. The next review should include the owner’s actual phone/browser after the frontend release; automated Chromium lifecycle checks do not establish real-device frame rates. Actual notification delivery, error visibility and owner-supplied real fulfillment content remain later projects. Legal and payment-provider setup remain owned by the business owner.

## Updates

During active work, post updates when a finding changes priorities, verification completes or something is blocked. Update this report and the board at completed milestones. No unattended background work or scheduled reporting is configured.

## Spark Points

Implemented the points earning/ledger, 25-point redemption, Rewards artwork/layout, profile balance link, owner prize controls and refund point review. New free daily/streak operations are retired; historical awards survive. Default prize EV is $0.063 per spin; referrals/welcome remain unchanged. Sandbox only, no live payment activation. Deploy account + Stripe handlers and Firestore rules alongside frontend. See SPARK-POINTS.md.

## Top-up popup refresh

Matched the approved navy/cyan desktop/mobile concept with four amount presets, custom amount, clear site-credit total, Spark earning explanation, actual Basic pack art and Stripe sandbox disclosure. First-deposit offer changes to a ready-to-claim Rewards link after verification and hides after claim. Free-test-credit mode hides deposit-only promotions and the Stripe provider line. Funding still uses the existing server-verified Stripe flow; no backend or secret changes.

## Basic pack referrals

Replaced future referral credit awards with one Basic pack per account. Qualification uses cumulative purchased-credit spending (minimum $10) and a verified deposit; existing awards are not reissued. Old settings normalize without a manual migration. Updated Rewards, admin, economics audit and referral emails. Welcome case remains separate. See REFERRAL-PACKS.md for deployment and refund-review limits.

## Promotion budget visibility

Added Admin → Spark rewards promotion summary for welcome/referral packs and Spark rewards over 7/30/90 Indianapolis calendar days. Award transactions record exact pack EV and credit face value once, with no historical backfill or customer identifiers. Gross issued estimates are separate from profit/refund accounting. Deploy ripprAccount plus frontend. See PROMOTION-SUMMARY.md.

## Mobile opening review

Current lifecycle/resource checks passed: 29 batches / 83 cards at 320/390/1440px, audio signal/resource tests, and transient artwork recovery. No accumulating opening actors or audio contexts were reproduced. No runtime changes or deployment. Physical-device FPS/network checks remain separate. See MOBILE-PERFORMANCE-REVIEW.md.

## Account and abuse review

Hardened welcome/referral deposit eligibility during payment review and after newly reconciled reversals. New verified funding can restore pending eligibility; past awards are not reissued. SMS resend convenience cooldown now survives reloads/tabs without storing phone/code. Remaining gaps include multi-phone/person referral abuse and unverified Firebase project settings; no one-person guarantee is claimed. Deploy account, Stripe and webhook together. See ACCOUNT-ABUSE-REVIEW.md.

## Operations overview

Added Admin → Overview with full retained-record aggregation for payment holds/reviews, failed/expired/retrying email jobs, pending shipping requests and seven-day recorded promotion value. Read-only, owner-authorized, no recipients/addresses in the response. Partial failures show Unavailable, and account switching clears stale data. Deploy ripprAccount plus frontend. See ADMIN-OVERVIEW.md.

## Separate live mode prepared

Added off-by-default live Stripe endpoints and isolated live ledgers, rewards, queues, museums, eligibility and email jobs. Profile/contact fields can be preserved; financial test state is never promoted. Server mode guards reject stale clients, free top-ups remain blocked live, and owner-only preview precedes public transactions. Live closure requires support review and sandbox cleanup protects shared identities. Mode-specific UI removes test/draft labels only in server-selected live mode. No real keys/deployment/charges were performed here. Official Rules emulator download is blocked; run it in Cloud Shell before activation. See LIVE-MODE.md for full setup and checks.

## Emulator setup reliability

Cloud Shell cancellation showed Firebase CLI returning success before Rules ran, allowing setup to proceed. Added a completion-marker Rules wrapper that fails on interruption/incomplete checks, resumable official downloads with size/SHA-256 validation, and IPv4 hub/logging bindings. Existing live secret creation does not imply activation or a passed Rules check. No financial setting or deployment changed.

## First official Rules run: six failures addressed

Owner's Cloud Shell run completed 32 checks: 26 passed, six failed. Four Storage tests showed overwrite attempts unexpectedly allowed, so every image/attachment create now explicitly requires `resource == null` in addition to owner/member, size and MIME checks. Homepage six-slot writes exceeded the 1,000-expression cap; cached scalar fields, a bounded string-ID set and lean grading validation reduce evaluation while retaining all field/URL/value/duplicate protections. An old test still denied self reads of live wallets, contradicting the intended live account contract; server-only payment audit tests remain strict and separate self-only wallet/ledger read tests cover live paths. Added a six-graded-grail budget regression case. Domain checks pass; official emulator confirmation still required in Cloud Shell because binary access here returns HTTP 403. Include Storage rules in the eventual deployment after a passing Rules run.

Owner rerun confirmed 32/33 official Rules tests pass, including all immutable uploads and live wallet access. The remaining six-graded-grail positive write still exceeded the 1,000-expression limit. Consolidated equivalent company/grade restrictions into one regex, bounded IDs in their regex, and removed redundant image nonempty/map checks (required field access fails closed). Official emulator confirmation remains pending; live activation remains gated.
