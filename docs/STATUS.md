# Latest: eager visible pulls with bounded artwork look-ahead

Recent-pull artwork uses an explicit queue: load the visible row before the visitor scrolls to it, warm about two cards ahead/one behind, and cap tile artwork requests at three. Distant images have no source until needed. Decoding completes before the artwork fades in over a static card silhouette. Existing original URLs/browser cache, retry/error handling, card previews and sort/refresh behavior are preserved. Visibility/page-exit cleanup avoids offscreen queue work and stale retry timers. No continuous polling or new image derivatives/services were added.

Browser checks cover pre-scroll readiness, all visible images decoded, distant images unfetched, three-request concurrency, end-of-rail loading, errors and prior privacy/interaction cases at 320/390/768/1440px. Frontend only; no Firebase deployment required.

# Previous: randomized curved rip and diagonal pull

Integrated the two approved motion concepts into the existing opening stage. Each prepared pack randomly selects a curved top-seal rip or diagonal pull; a short or canceled grip retains that selection. A bounded textured strip bends using the original tier artwork, then the wrapper falls away as the face-down card rises. Existing stage size/themes, slide/keyboard trigger, rarity/flip, keep/sell, audio, batch skip and Open again behavior remain intact. No purchase, reward or wallet logic changed.

One reusable 64-segment canvas follows an owned 640ms WAAPI clock with hidden-tab pause/return and cleanup. Reduced motion is instant; unavailable texture/canvas uses the existing release fallback. Deterministic variant/pixel/cleanup tests, resource/audio checks and four-width full tear regressions passed. Repeated-opening checks verify bounded actors and reset behavior; build/site checks passed. See [PERFORMANCE.md](PERFORMANCE.md). Frontend only; no Firebase deployment required.

# Previous: ranked Fresh from the machine rail

Fresh from the machine defaults to Biggest this week (rolling last seven days), with Latest available. An indexed value/time query ranks the full window before limiting to 12; sort/runtime caches stay isolated. Compact rarity-colored cards show recorded card values, relative pull times and condition. Inspect opens a card dialog with a source-pack thumbnail/link; native source links remain available. Explicit refresh stages updates while browsing rather than moving the rail, and brief entrance motion honors reduced-motion settings. No fabricated activity, customer identity, background polling or purchase action was added.

Query/cache/concurrency checks and browser checks passed at 320/390/768/1440px; Firebase SDK query validation and build/site checks passed. Ranked Rules coverage was added, but the emulator artifact download was unavailable here. Existing Rules and account projection are unchanged. Deploy `firestore:indexes` for Biggest and allow index building to finish; see [RECENT-PULLS.md](RECENT-PULLS.md).

# Previous: larger mobile hero artwork

Enlarged the signature pack fan, daily reward chest, grail cards and central Community display to use the taller focal framing of Icy Rush on mobile. The existing banner height, copy/CTA separation and carousel controls remain fixed; desktop and Icy Rush styling are unchanged. All-five-slide browser checks passed at 320/390/768/1440/1920px, with mobile artwork crops reviewed. Build/site checks passed 24 pages and 1,343 references. Frontend only; no additional Firebase deployment required.

# Previous: tactile foil tear and cleaner extraction

Refined the original pack artwork into a curling top seal with metallic underside, stable torn fibers, a dark mouth/inner lip and subtle inner-wrapper tension. Drag direction locks after horizontal intent, reverses progress without flipping the hinge and cleans up short/canceled/lost-capture/hidden gestures. The 480ms release joins the existing centered extraction, rarity/flip, grade, keep/sell, mute and batch-wide skip flow; the card stays narrow inside the wrapper before enlarging. Stage sizing and account/payment/catalog calls are unchanged. Four-width tear checks, 29-batch/83-award repeatability, reveal/sale spacing including landscape, and resource/audio checks passed. The focused 390px run also covers missing/throwing animation engines and reduced motion during release. See `tests/browser/foil-tearing.cjs` and [PERFORMANCE.md](PERFORMANCE.md). Frontend only; no additional Firebase deployment required.

# Previous: full-width homepage hero carousel

The homepage hero now spans the viewport directly below navigation, with its copy and artwork aligned to the centered site content. A dedicated inner grid preserves all five scenes, swipe/keyboard navigation, pause/play and existing destinations. The vending machine, recent pulls, grails and footer spacing retain their bounded layout. Hero height stays fixed across slides; mobile uses a compact 232–238px banner with 44px-high controls and readable separate text/art areas. CSS is scoped to the homepage. All-slide checks passed at 320/390/768/1440/1920px for geometry, text/CTA separation, controls, navigation and zero purchases; existing vending regression passed at four widths. Build/site checks passed 24 pages and 1,343 references. Dedicated checks are in `tests/browser/home-hero.cjs`. No additional Firebase deployment is required.

# Previous: real anonymous recent pulls on the homepage

Added “Fresh from the machine” below vending and above grails: up to 12 card awards from seven days, with rarity colors, Near Mint/slab grades and source-pack links. Paid and owned/reward openings publish whitelisted card-only snapshots atomically with their awards. Opaque IDs and strict fields exclude customer identity, private inventory IDs and operations; invalid/demo/private artwork is skipped. Live/test collections and reads are isolated, with explicitly labeled test results. No historical backfill, invented activity, museum spotlight or welcome panel was added.

303 domain tests and recent-pulls browser checks at 320/390/768/1440px passed; helper query/cache/concurrency checks and build/site checks passed. Rules tests are implemented but the emulator download was blocked by workspace proxy HTTP 403. [RECENT-PULLS.md](RECENT-PULLS.md) contains the Cloud Shell Rules-check/account deployment command and managed TTL setup. No production deployment, TTL policy, payment or customer record was changed here.

# Previous: selected-lane lighting and cosmetic vending transition

Added pack-accent spotlights, shelf-edge lighting, selected badges and a single foil reflection on selection. Ordinary View pack clicks now play a brief chrome-coil/drop/pickup-tray sequence before navigating to the frozen pack/quantity URL. Offscreen source/tray fallbacks preserve feedback without forced scrolling. No purchase, wallet, inventory or catalog mutation occurs. Modified/new-tab clicks and reduced-motion/missing-art cases retain direct native links; temporary controls and owned effects are cleaned up on page exit/return. Verification and frontend deployment notes are in [PACK-VENDING.md](PACK-VENDING.md).

Validation: existing selection/regression and new motion browser checks passed at 320/390/768/1440px, including rapid repeat clicks, exact quantity links, keyboard activation, native modifiers, unavailable packs, broken art, absent/throwing animation APIs and reduced motion. Return/preference-change cleanup has dedicated coverage. Build/site checks passed 24 pages and 1,338 references. Frontend only; no Firebase deployment required.

# Previous: all packs visible with compact selection controls

The homepage machine now displays all six core tiers together in two rows, keeping the Core/Limited switch. Unconfigured or unavailable tiers remain visible, clearly labeled and disabled; only valid enabled saved catalogs with explicit saved prices are selectable. Replaced the large selection screen, preview artwork, duplicate slot keys, odds shortcut and bank pagination with one compact bar for pack name, total, quantity and View pack. Existing opening/checkout flow and saved catalog data are unchanged. Browser checks passed at 320/390/768/1440px for all-visible layout, disabled packs, keyboard selection, quantities, retry/late-load states and responsive geometry; Mythic opening passed at 320/390/1440px. Frontend only; no Firebase deployment needed.

# Previous: approved pack vending machine and foil wrappers

Replaced the homepage pack carousel with the approved realistic pack-station layout: metal/glass chassis, photographic chrome spirals, foil stacks, tactile selectors, selection screen, 1–5 quantity and Core/Limited banks. Uses enabled valid saved catalogs and explicit saved prices; selection leads to the existing opening page without a charge. Added matching transparent foil wrapper artwork for all 7 tiers and updated visible wrappers across hero/auth/landing/rewards/inventory/guides. Accurate intrinsic dimensions keep cold-load opening art centered. Multi-pack quantity follows the pack link and supported checkout return. No saved prices, odds, availability, financial records or inventory were changed. See [PACK-VENDING.md](PACK-VENDING.md) for assets, deployment and verification. Domain tests: 294 passed; machine, opening and checkout browser checks passed on mobile/desktop; build/site checks passed.

# Latest: landing-to-customer conversion project, phase 1

Acquisition entry is `/landing`. Added current enabled saved-pack prices and clear funding/credit/shipping explanation; preserved the selected pack after hosted Checkout with no auto-purchase. Added owner-only Admin → Conversions, first-party session/source measurement, trusted new-account/live-funding/paid-opening events and bounded hourly cleanup. Browser reports never count as payment success; only new attributed accounts count as customer outcomes. See [CONVERSION-PROJECT.md](CONVERSION-PROJECT.md) for the deployment command, measurement/privacy limitations, organic source links, acceptance checks and project review agenda. No ad campaign, outreach, budget spend, customer email, production configuration or live payment was executed here. Real results start accumulating only after deployment; none have been inferred or backfilled. Validation passed: 294 domain tests; landing availability/prices, dashboard source/empty/error states and selected-pack returns at 320/390/1440px; isolated first-party tracking/privacy checks; all seven customer journeys at all three widths; live-copy checks on 23 pages. The broad journey fixture now verifies current popup-paid shipping instead of its obsolete unpaid-submit flow.

# Latest: approved welcome-email checklist

Replaced the welcome template with the owner-approved preview: “Your first moves on rippr,” Pip artwork, completed account step, four linked getting-started steps for packs/My items/rewards/Community, site-credit disclosure and operator footer. Checklist items are onboarding suggestions, not a claim to track user progress. Both HTML and plain text are generated by the existing provider-neutral renderer; all other templates remain unchanged. No email was sent or resent here. Apply the updated renderer to both email delivery and retry functions in each active runtime; existing saved retry message snapshots remain unchanged to preserve delivery idempotency.

# Latest: shipping-method copy and owner shipping promises

Shipping popup methods now say “Tracking available”; service prices and the total still include server-calculated markup. Added responsive owner-requested shipping promises to the homepage packing section, shipping guide and shipping popup: over 50,000 cards ready to ship, Mint/Near Mint, double sleeves/top loaders, 14-day average and dispatch within four weeks or fees refunded. These are owner-provided business claims, not independently audited inventory/delivery metrics. Updated delivery copy and the operating policy to replace the earlier 3–5-day target with a 28-calendar-day dispatch promise from shipping payment; late-shipping/handling fee refunds are handled through support to site credit. No automatic deadline/refund job, production shipping setting, payment or wallet changed. Slab grades remain shown as supplied.

# Latest: shipping markup and payment in the popup

Added owner percentage/fixed-fee markup controls for live carrier quotes (zero default), visible postage/handling breakdown, and atomic `checkoutShipment`: wallet debit, paid request, fulfillment queue and inventory reservations commit together after approval. Quote/close/failure does not reserve cards or enqueue fulfillment. Idempotent retries protect against duplicate charges and overlapping checkouts. Server checks settings/quote expiry/amount, owned card snapshots, credit reconciliation and review/closure/eligibility gates. Tracking is payment status only; older unpaid requests can be canceled and recreated through the popup. Legacy live unpaid submission and unpaid admin packing/dispatch are blocked. Labels remain a separate deliberate staff action. Validation: 285 domain tests passed; popup cancellation/insufficient-credit/lost-response recovery, carrier markup, address choices and admin controls passed at 320/390/1440px; build/site checks passed for 24 pages and 1,321 references; live-copy check passed for 23 public pages. Provider calls in tests are isolated fixtures. See [SHIPPO-SETUP.md](SHIPPO-SETUP.md) for deployment and setup; no production fees/settings, wallet records, provider calls or labels changed here.

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

The second owner rerun remained 32/33: six graded homepage grails still exhausted the expression budget. Consolidated homepage create/update permissions into one validation branch with an existence-aware version guard, avoiding repeated full validation across set() permission branches. Extended the emulator regression to cover invalid initial versions, rollback, all six grading companies and localhost image URLs. Regular tests are separate from official Rules confirmation; the latter remains required before activation. Emulator binary download here remains HTTP 403.


## Homepage gallery: server-authoritative replacement for Rules budget optimizations

Third owner rerun remained 32/33. Replaced the Rules-heavy write path with an owner-only `ripprAccount` saveHomepageGrails action using shared full validation and an optimistic transaction. The browser uses that callable and cannot write the public setting directly. No settings/data were changed here. Both test/live use the shared homepage setting; authorization remains verified owner token plus matching account UID. Identical retries return the committed result, stale different edits fail, and update attribution/time are server-generated. Official emulator tests now exercise the Admin SDK server transaction plus browser denials; invalid input tests remain enforced, not removed. Domain suite (31 groups), build, syntax checks and site check pass. Emulator binaries remain inaccessible here (HTTP 403); official Cloud Shell confirmation is pending. After passing, deploy ripprAccount plus Firestore/Storage rules together; live mode remains off.

## Follow-up to owner run: 29/33, deployment correctly stopped

The homepage server-save refactor accidentally removed validGrading, which cardLibrary still invokes; restored that shared Rules helper. Two positive server-save fixtures also used localhost HTTP image URLs, which safeImageURL intentionally rejects outside a configured local browser. Those fixtures now use production-valid HTTPS images, and localhost HTTP remains an explicit negative server case. Added a lightweight missing-Rules-helper regression check to the normal suite (it does not replace official Rules compilation). Domain suite and focused tests pass; official emulator confirmation remains pending. No deployment or live activation occurred here, and the owner's failed-test command chain stopped before deployment.

Owner reports full deployment and private-mode setup completed, but live Checkout still reports key configuration failure after secret reset. Added a read-only Cloud Shell diagnostic to distinguish malformed/rejected latest secrets from stale deployed secret bindings. It never emits secret values, balance data or raw provider messages and creates no payments. Mocked success/rejection and stale-binding checks passed without secret leakage; no actual secret or Stripe authentication was accessible here. Actual real-payment verification remains pending.

The first owner diagnostic stopped before Stripe verification. Replaced gcloud's /dev/stdout output-file approach (incompatible with some Node subprocess sockets) with explicitly formatted base64 payload capture and in-memory decoding. Lookup and value-access failures now report separate stages and allowlisted error classifications without raw stderr. Added mocked CLI/Stripe regressions for successful auth, stale bindings, missing secrets, denied access, malformed keys, whitespace and provider 401. No actual live secret access was available here; owner rerun is required.

Stripe account screenshots show the custom-permission secret-key workflow. Added restricted live rk_live key support alongside sk_live, retaining mode separation and rejection of publishable/webhook credentials. Changed the secret-safe diagnostic to read Checkout Sessions rather than account balance, avoiding unnecessary balance permissions. All 223 tests pass, including restricted key acceptance, cross-mode rejection, permission-denied diagnostics and secret non-disclosure. No real Stripe credential/payment or permission scope was verified from this workspace.

## Public live checks and mobile journey polish

Owner reported successful live top-up, unused-payment refund/reconciliation, purchase, inventory, sellback and welcome checks, followed by public-mode deployment and a working nonowner flow. This is owner-reported production verification; this workspace did not charge a card or inspect private Stripe/Firebase records.

Reviewed the isolated customer journey at 320/390/1440px and inspected mobile login, verification, signup, inventory and top-up screenshots. Increased small secondary auth/inventory touch controls to 44px and set mobile inventory search text to 16px to avoid the common iOS focus-zoom trigger. Existing branding/layout/copy and all financial settings stay unchanged. Expanded the journey regression to measure tap targets, prevent horizontal overflow, and check search input size. See MOBILE-JOURNEY-REVIEW.md for scope and real-device limits. No Firebase deployment is needed for these frontend adjustments.

## Live minimum, public copy cleanup and launch monitoring

Implemented a $10 minimum for new live top-ups, enforced by both the popup and server; test-mode funding retains $1. Added a visible min/max hint. Fixed unmarked payment-result disclaimers that still said no real money was charged, cancellation/pending copy, balance accessibility wording, old fallback help copy and remaining retired live policy review wording. Live Checkout errors now use customer-facing retry/support wording. Hidden unverified Trustpilot placeholders in live mode and removed dead unconfigured social controls without inventing ratings or social destinations.

Expanded the owner overview with aggregate unresolved support and seven-day recorded server Checkout/opening errors, server-log links and a one-minute visible-page refresh. Error records deduplicate operation retries, isolate live/test namespaces, avoid sensitive request/error payloads, and never replace the original financial result. Existing default Rules deny the new private record paths. Expected balance/policy rejections and hosted card declines/animation-only issues are outside these server counters; tracking starts with deployment, not backfilled history. See LAUNCH-OPERATIONS.md for rollout and limits. This workspace has not deployed these changes or modified production data/settings.

Verification complete: 228 domain tests pass, including pre-minimum payment settlement; live-copy audit passes across 23 page templates; top-up tests pass in test/live mode at 320/390/1440px; owner overview, navigation and paused live-storefront browser checks pass at all three widths. Build/site check passes 24 pages and 1,317 references. Backend changes await the owner's Cloud Shell deployment; normal frontend deployment picks up copy/UI changes. No live switches or Stripe/tax keys/settings were changed here.

Owner supplied the public Trustpilot review URL. Replaced the hidden placeholder with a visible, linked Trustpilot review invitation featuring five outlined, unscored stars and “Leave a review.” The external link opens safely in a new tab and does not claim a verified score or customer-review count. Live-copy audit, 320/390/1440px invitation fit checks, build and site check pass. Frontend-only; no additional Firebase deployment is needed for this change.

## Shippo shipping implementation

Owner selected Shippo and asked for pricing advice; implementation uses the actual tracked carrier quote with no markup and explicit customer approval before a site-credit debit. Quotes and real customer payments/admin postage purchases default off. Added private sender/parcel setup, raw/graded capacity and weight presets, value-based manual insurance review, customer quote/payment/cancellation, admin label purchase/reconciliation/refund, official carrier links and on-demand tracking. Live requests require a contiguous-US/DC address and valid ZIP structure; backward fulfillment and dispatch with unresolved label purchases are blocked.

Fees/refunds use the source-bucket ledger without Spark/referral spend. Label reservations prevent repeat external purchases after timeouts. Uncertain purchases require a matching Shippo transaction, not automatic retry. Label PDFs/sender settings stay admin-only; live/test namespaces and tokens are separate. Owner sandbox quote/test-label checks can run while the storefront remains live without wallet/shipment mutations. No API token or production origin/settings were available or changed here. See SHIPPO-SETUP.md for measured setup and controlled rollout. Actual Shippo connectivity remains to be validated with owner tokens; documentation downloads here returned HTTP 403.

Final shipping verification: 243 domain tests pass; build and built-site checks pass across 24 pages and 1,319 local references. Shipping quote/payment and admin label/privacy browser checks pass at 320/390/1440px, as do the existing customer journey and 23-template launch-copy checks. Returned purchased shipping credit first offsets existing payment debt, preventing refunded funding from becoming spendable again. No production deployment or Shippo API call was performed.

## First-time customer journey polish

Reviewed signup/login, funding returns, pack openings and inventory at 320/390/1440px with isolated browser fixtures. Fixed verification-code focus after SMS send and incorrect-code rejection by enabling inputs before moving focus. A failed resend now keeps the code-entry screen and restores the prior same-phone confirmation session only if the auth request has not been canceled or changed; switching phones/canceling never restores it. Shared account errors no longer suggest free test credit to live customers, and rate limiting is distinguished from insufficient balance.

Verification: 244 domain tests pass, including confirmation recovery/cancellation; SMS reload/cross-tab cooldown and failed-resend browser checks pass; the full customer journey passes all three widths, including one debit per batch and inventory persistence after interrupted reveals. Stripe payment UI checks pass in test/live mode at all three widths, including pending/confirmed returns, cancellation and session-key cleanup. Build/site checks pass 24 pages and 1,319 references. No real SMS, payment or account mutation was performed; these frontend changes do not require a Firebase Functions deployment.

## Reusable card imports and per-pack rarities

Added an opt-in “Import saved cards again as separate library entries” control to Pokémon imports. Known cards receive a fresh library ID while retaining source identity/artwork and listed-price choices; the owner can choose a different site rarity in the import preview. Default imports continue skipping existing IDs. No pack assignment occurs during import, and originals/published packs are unchanged.

Add site cards now offers a rarity override for the current pack draft, allowing the same saved card to be reused across packs with independent rarities without duplicate imports. Existing saved-card/version validation, grading preservation and zero starting odds remain intact. Browser regressions verify independent reimports and pack rarity overrides at 320/390/1440px; 24 library/site tests and the 24-page/1,319-reference built-site check pass. Frontend-only; no Functions or Rules deployment is needed.

Follow-up: Pokémon import previews now include every selected card automatically. Already-saved cards receive separate IDs without an opt-in checkbox; they no longer produce an all-skipped preview. The owner can set a different rarity in the preview, with original library entries and pack drafts preserved. Updated the mobile/desktop regression to exercise repeat preview without extra setup and assert a new card with zero skipped.

## Owner-only live promotional testing credit

Added Admin → Payments → Add live promotional credit, restricted on the server to the verified owner’s own live account. Grants use the normal promotional credit ledger with reason, audit/activity, operation replay protection and atomic per-UTC-day limits ($1–$100 per grant; $500/day). Requests reject other recipients, sandbox mode, inconsistent wallets, active closures and payment holds/debt/reviews. No Stripe/deposit eligibility or purchased-spend rewards are generated; live openings still award real cards. UI confirms this explicitly and supports safe same-request retries after unknown responses.

Verification: the full domain suite passed 248 tests before the additional focused live-opening test; all five owner-credit domain tests pass, including live inventory/no-points/no-deposit eligibility and concurrent retry limits. Owner-credit and existing payment-review UI checks pass at 320/390/1440px; build/site checks pass 24 pages and 1,320 local references. No real credit, payment or production record was modified. Deploy functions:ripprAccount and the frontend before use. See OWNER-PROMO-CREDIT.md.

## Optional Shippo secret deployment isolation

Owner's account-only deploy was blocked by missing optional Shippo secret versions during global parameter resolution. Replaced only the Shippo defineSecret declarations with supported endpoint-specific named secret bindings and runtime injected environment reads. Deployment metadata retains identical Secret Manager bindings on ripprShipping/ripprLiveShipping/ripprShippoTest; ripprAccount has none, and maxInstances remains 10. Firebase still validates secrets for selected shipping endpoints. No dummy key, credential exposure, shipping activation or production deployment. All 19 focused shipping/deployment/owner-credit tests pass, including missing-key rejection before provider calls.

## Rarity-led museum gallery and source-pack inspection

Implemented the approved museum mockup with rarity-colored display frames, restrained halos and explicit icon/text badges across all seven rarities (Ultra rare remains red). Cleaned mobile gallery metadata/condition and separated inspect/navigation controls; desktop center-display sizing reserves space for the plaque and controls. Card inspection uses a landscape image/details layout on desktop and a stacked mobile layout with full uncropped artwork, concise name/set/number/finish, rarity and condition badges, and a compact clickable source-pack thumbnail.

Museum responses now whitelist known packId provenance and optional bounded setName/number/finish from authoritative owned inventory. No invented source pack: unknown/legacy origins hide the module. Existing purchase records already include packId; no migration is needed. Private wallet, price, contact and address fields remain excluded. Dialog content and links clear on sign-out/account change. Ownership, shipped-card eligibility, sold-card exclusion, publishing and likes are unchanged.

Verification: 252 domain tests pass; redesigned museum browser checks pass at 320/390/768/1440px, including red Ultra rare, graded condition, unknown origins, long titles, no horizontal overflow, focus/escape and account cleanup. Existing customer journey checks pass at 320/390/1440px, including selecting shipped cards. Build/site check passes 24 pages and 1,321 references. Rendered phone and desktop gallery/inspection screenshots reviewed. Frontend deployment plus functions:ripprMuseum deployment are required for source-pack links; no Rules changes or new assets/secrets are needed. No production data changed here.


## Shippo sandbox with only a test key

Moved only owner-only shipping setup read/save actions through ripprAccount, preserving account/mode checks and versioned private configuration. Carrier/payment/label actions retain the shipping endpoints. Deploy ripprAccount and ripprShippoTest using only SHIPPO_TEST_API_KEY; keep both enable switches off and run the owner sandbox check while the storefront stays live.

253 full domain tests pass, plus 16 focused shipping/deployment/client-routing tests after adding the route regression. Shipping UI checks pass at 320/390/1440px; build/site check passes. No Shippo token was provided, API called, production setting or wallet changed here. Actual API validation awaits the owner-run sandbox check. See SHIPPO-SETUP.md.

## Automatic packaging suggestions

Added editable rigid-mailer/small/medium/large box presets, with owner-requested planning weights of 1 oz per raw card and 3 oz per slab. New setup forms prefill suggestions; an explicit Use suggested packaging button applies them to existing setups without altering sender data or enable switches. Quote selection uses the smallest fitting preset, shared mixed-load capacity and total item weight plus one package tare, rounded upward. Oversized loads stay blocked for split/manual handling. Preset dimensions/tares are labeled estimates requiring comparison with actual supplies; all remain editable.

Quote records retain the selected package/counts and carrier parcel, displayed on customer quote pages. Sandbox sample labels use the same selection helper. Existing raw/graded configurations continue unchanged unless automatic presets are enabled. No live shipping setting, API key, production record or payment was changed. All 261 domain tests pass, including raw/slab/mixed boundaries, exact weights, invalid presets, legacy selection and stored carrier parcels. Mobile/desktop shipping checks pass at 320/390/1440px and verify preset save/address preservation/no extra label purchase. Build/site checks pass 24 pages and 1,321 references. Deploy ripprAccount/ripprShippoTest for the current test-only setup, and update carrier endpoints when live shipping is enabled later.

## Shippo upstream error diagnostics

Owner's generic Shippo failure with [503] could not distinguish the Firebase callable wrapper from the provider status. Added sanitized provider status/operation/reason and whitelisted invalid-field names, with specific authentication/account/rate-limit/unavailable messages. Sandbox admin displays the actual upstream status and failed step. No raw provider messages, response values, credentials or addresses are exposed. No automatic POST retries or label uncertainty safeguards changed. All 18 focused shipping/deployment tests pass; admin diagnostic checks pass at 320/390/1440px; build/site checks pass. Actual owner API failure remains undiagnosed until the updated sandbox function is deployed and rerun.

## Owner quote-only Shippo diagnostic

Owner reports actual Shippo HTTP 400 during quote creation, with no recognized field-name errors. Added scripts/check-shippo.mjs to read private setup/test token using Cloud Shell credentials and request one test quote, without labels/payments/database writes. A bounded redacting summary reveals provider validation text while excluding submitted address identity, API/OAuth tokens and email strings. Three focused tests pass, including an end-to-end mocked gcloud/Firestore/Shippo rejection that permits only the shipments endpoint. No actual API request or owner secret accessed in this workspace; underlying account rejection remains pending the owner's diagnostic output. No function deployment required for this diagnostic.


## Shippo identical-address sandbox correction

Owner diagnostic revealed Shippo's actual HTTP 400: From and To Addresses are identical. The original sender-to-sender sandbox harness was incorrect. Added optional private testDestination setup fields, validation and owner-admin save; sandbox quotes/labels and the Cloud Shell diagnostic now use that separate destination. Missing/identical normalized addresses fail before provider calls, ignoring mere recipient-name differences and ZIP+4 suffix changes. Customer shipments/real sender remain unchanged, and diagnostic redaction covers both addresses. No production fields or provider tokens changed here.

All 266 domain tests pass, including different-address carrier request assertions, missing/identical rejection with zero API calls, and quote-only diagnostic redaction. Mobile/desktop shipping admin checks pass at 320/390/1440px, saving the new destination while preserving origin and clearing both on sign-out. Build/site checks pass. Deploy ripprAccount and ripprShippoTest, refresh frontend, save a distinct test destination, then rerun the owner sandbox check; actual API success remains pending that run.

## Shippo test-label rejection details

Owner reports two returned rates and label ERROR: quote connectivity works, but label generation has not succeeded. The sandbox harness had discarded transaction.messages. It now returns an owner-only redacted errorSummary and displays Carrier details on the admin sandbox screen. Shared the existing bounded redactor in a Functions-packaged module, keeping the Cloud Shell helper's import compatible. No live-label logic, secret binding, rate selection, API retry or wallet behavior changed. All 23 focused shipping/deployment/redaction tests pass; 320/390/1440px browser diagnostics and build/site checks pass. Actual carrier rejection reason remains pending owner rerun after functions:ripprShippoTest deployment; no real provider request or production record changed here.

## Carrier estimates before shipping submission

Implemented estimateShipment in the carrier service and rate comparison inside the profile shipping dialog. Available owned items and the chosen address determine server-calculated packaging, weight and rates; client values/weights cannot override them. Estimates do not reserve cards, create requests/labels or debit the wallet. Hold/closure, unavailable items, manual-insurance limits, changed config/ownership and shared rate throttles remain authoritative. Dialog estimates invalidate on address edits/expiry, ignore late responses and snapshot the displayed saved address rather than silently following another tab's default changes.

After normal request submission a fresh saved quote is requested when a preview existed, and tracking preserves the preferred carrier service. Final payment remains a separate exact-rate approval; preview IDs cannot pay a shipment. Quote failures preserve the saved request for later retry/manual review. Live activation requires the live Shippo key, ripprLiveShipping deployment and enabled carrier quotes; the admin's working test key is not used for live customer estimates. No live switches, secrets, payments or production data were changed here.

Verification: 270 domain tests pass, including preview ownership, no debit/reservation, tampered inputs, holds, throttles and changes during API lookup. New browser tests pass at 320/390/1440px for saved/custom addresses, package/weight, rate selection, failure/retry, out-of-order replies, final quote/service and account cleanup. Existing complete customer journey passes all three widths. Build/site checks pass 24 pages and 1,321 references. Actual customer API verification awaits live Shippo access.

## Shippo address validation and explicit suggestion selection

Added validateShippingAddress and the Shippo addresses adapter with validate:true. Normalized suggestions are returned only for explicit provider is_valid:true and valid supported-US fields; recipient name is preserved, missing validation and dropped units cannot become a checked address. Auth/account closure/payment holds and a five-checks/minute limit protect the endpoint. No address book, wallet, inventory or shipment mutation occurs during checks.

Customer shipping now checks completed addresses before requesting estimates, shows entered/suggested alternatives when standardized fields differ, and waits for an explicit choice. Defaults remain unchanged; the chosen address travels through estimation and request submission. Editing/canceling/sign-out invalidates pending checks/results. Unconfirmed/outage cases offer review/manual request, never a fake success. Fixed an asynchronous native-dialog close/reopen race found during browser tests. Customer live activation still requires the live Shippo key and ripprLiveShipping deployment; working admin sandbox remains isolated and unchanged.

Verification: 273 full domain tests pass. Address-choice tests and estimate tests pass at 320/390/1440px, including suggested/original selection, unit preservation, unchanged defaults, stale replies, failures, rapid reopen and sign-out cleanup. Existing full customer journey passes all three widths. Rendered comparison cards reviewed on phone/desktop; build/site checks pass 24 pages and 1,321 references. Actual address-validation API access was not tested with an owner credential here; no production settings, API requests or customer records changed.


## Weight-based checkout without shipping API

Implemented owner-configured packed-weight prices and balance payment through ripprAccount, with no carrier key or provider request. Admin Shipping setup offers manual/Shippo modes, editable USD brackets and existing suggested raw/slab/box weights. New setups default to disabled manual mode; existing modes and production prices are not changed automatically. Blank prices cannot enable free shipping, oversized loads need manual review, and there is no invented postage price.

Manual previews and binding quotes read server-owned inventory/config. Charges/refunds retain source buckets, operation replay, quote-version expiry, eligibility and all closure/debt/review holds. Stripe can fund the existing balance; no new direct shipping-card checkout was added. Users see a merchant shipping price, not a carrier-verified quote/address. Label purchases and carrier sync are blocked for manual mode even if an old carrier endpoint is called directly; owner buys labels separately and enters tracking. Public shipping copy now matches configured pricing. Existing optional Shippo routing falls back only on the server's provider-required signal.

Verification: 279 domain tests pass, including no-provider checkout/debit/refund/replay, tampering, table changes, review holds, eligibility and direct provider-call blocking. Manual checkout/admin tests pass with external requests blocked at 320/390/1440px, including price editing and manual tracking. Existing Shippo browser regression and 23-template live copy checks pass; build/site checks pass 24 pages and 1,321 references. No production settings, credit or external shipping API changed. Deploy only ripprAccount, then select manual mode and enter prices in admin. See MANUAL-SHIPPING.md.
