# rippr status — inventory, redemption and loading performance

Working board: [PROJECTS.md](PROJECTS.md). Asset measurements: [PERFORMANCE.md](PERFORMANCE.md).

## Completed in this batch

- **R-04 — Complete inventory access:** cards and packs now have Load more controls. The museum editor can reach older kept/shipped cards, and Order tracking can load older requests. Authenticated cursors use timestamp precision plus document ID; identical timestamps, deleted boundary records and new records do not skip the continuation. Snapshots start at 200 cards/packs and 50 requests rather than imposing a hard access limit.
- **Refresh and account safety:** loaded ranges are refreshed, duplicates are removed, successful old sales update correctly, repeated page requests coalesce, and stale responses/errors are discarded after refresh or account changes. Search/filter copy describes its loaded scope. Unchanged profile card DOM/focus and selection survive refresh; tracking no longer hides the current request merely to load another history page.
- **R-05 — Seasonal redemption:** `enabled` controls new purchases and reward offers. An owned pack can still redeem after sales stop or its sale price is removed, provided its current catalog/version is valid and ownership is verified. It consumes once and costs zero balance. Exact owned-record verification works beyond the first page. A missing seasonal catalog does not fall back to concept cards or consume the award.
- **R-06 — Reusable journey checks:** added a Playwright suite using actual page scripts and isolated account/museum services. CI now installs Chromium and runs these checks after domain tests/build/static reference checks.
- **R-07 — Smaller active artwork:** five core pack sprites use lossless WebP inside their existing SVG geometry; reveal-back and landing-slab references use lossless WebP too. The five-pack asset group is 35% smaller. Dimensions, viewBox and alpha outlines are unchanged. Transparent PNG/WebP compositing can differ by one 8-bit RGB level in Chromium; no byte-identical browser rendering claim is made.

Previous foundation fixes (fulfillment labels, reward prize readiness, expanded release checks) remain included.

## Verification

- **91 offline tests pass**, including pagination boundaries, timestamp ties, ownership isolation, retry/reset races, missing seasonal catalog and one-time redemption.
- Build and static HTML reference checks pass: 16 pages / 707 local references.
- **21 browser journey groups** pass at 320, 390 and 1440 pixels: auth form/return paths; real-service sell/ship; older inventory; museum draft/eligibility/save; order-history failure/retry; seasonal redemption; batch skip/theater exit/interrupted reveal.
- Lossless image decode and browser alpha/geometry checks completed; source asset payload measurements recorded separately.
- Whitespace/syntax checks pass.

The browser suite intercepts all HTTP and uses fixtures. It does not establish real Firebase SMS or SDK persistence behavior, Security Rules correctness, production infrastructure, payment processing, or carrier dispatch. No production account data or balances were changed. CI is configured; a successful hosted run is not assumed from local results. No production load-time/Core Web Vitals claim is made from the asset byte savings.

## Required deployment

Inventory pagination, exact owned-pack verification and seasonal redemption use the updated existing **ripprAccount** Function. Deploy it before frontend rollout. This also includes the previous daily reward readiness fix. No new rules, Function names, secrets or payment integration are needed.

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

**R-08 — Fulfillment operations:** older admin shipping queue access, request lookup, status edits and conflict recovery. The admin request queue is still capped at 100; activity is still the latest 50 records. These limits are separate from the inventory work and are not claimed to be removed.

Following work: broader accessibility checks, accurately labeled notification preferences/delivery, error visibility and owner-supplied real fulfillment content. Legal and payment-provider setup remain owned by the business owner.

## Updates

During active work, post updates when a finding changes priorities, verification completes or something is blocked. Update this report and the board at completed milestones. No unattended background work or scheduled reporting is configured.
