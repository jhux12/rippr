# rippr status — initial reliability batch

Updated: November 10, 2026 (America/Indianapolis). Working board: [PROJECTS.md](PROJECTS.md).

## Completed in code

- **R-01 — Fulfillment labels:** My items displays the linked shipment's saved progress (received, review, packing, shipped or delivered), while keeping fulfillment cards unavailable for selling or another shipping request. Explicit shipped/delivered item records remain visible in Shipping. No ownership status or museum eligibility is changed.
- **R-02 — Daily prize readiness:** Enabled daily settings and every new claim validate all positive-odds pack catalogs. An invalid/unavailable prize blocks the whole claim before an award, cooldown or operation is written; it never rerolls the advertised odds. Zero-odds prizes do not block valid rewards. The owner can still pause an invalid configuration. Redemption rules for already-owned packs are unchanged.
- **R-03 — Release checks:** The default test command now includes all existing offline account, reward, referral and museum suites, plus profile-fulfillment and static-site-check regressions. Added a read-only GitHub Actions workflow to test, build and check built HTML references. It does not deploy or use production credentials.
- Updated outdated documentation about address collection, hero slides, packing artwork and shared pages.

## Verification completed locally

- `npm test`: all 10 selected test files passed, including the new fulfillment projection and reward failure/repair cases.
- `npm run build`: passed.
- `npm run check:site`: 16 built HTML pages, 708 local references, no missing references.
- Chromium with isolated account snapshots at 320, 390, 768 and 1440 pixels: correct shipment labels on refresh; shipped/delivered cards visible; no fulfillment sell/ship controls; available/sold behavior intact; no horizontal overflow or page script errors.
- `git diff --check`: passed.

The browser data was a fixture. No customer records, live rewards, purchases, production SMS, addresses or account balances were changed. These checks do not validate Firestore Security Rules or deployed Firebase behavior. The new hosted CI workflow's first run is not yet verified.

## Deployment requirement

The profile label fix is frontend-only. The daily reward guard needs the updated existing `ripprAccount` Function. No new rules, secrets or Function name are needed. From the owner's authenticated Firebase checkout:

```sh
cd ~/rippr &&
git pull --ff-only origin main &&
npm ci &&
npm ci --prefix functions &&
npx firebase deploy --only functions:ripprAccount --project rippr-2b01c
```

This workspace has not run that deployment. Static hosting builds do not deploy Functions. If the checkout has local edits, inspect/stash them before pulling; do not discard them.

## Next priority

**R-04 — Complete inventory access.** Current snapshots stop at 200 cards and 200 unopened packs. Older available items can be hidden behind newer sold/opened records. Add stable authenticated pagination and complete collection/museum selection before encouraging larger collections.

## Other confirmed follow-ups

- Large embedded pack artwork and the active reveal/landing PNGs warrant a measured performance pass that preserves pack dimensions and alpha/foil alignment.
- Email/shipping notification preferences currently store settings but do not send messages. Clarify or complete notification delivery before describing it as operational.
- Periodic profile refresh rebuilds the item grid and can disrupt focused controls; preserve keyed DOM/focus in the accessibility pass.
- An already-earned pack still cannot open while its catalog is disabled. Define separate sales/redemption availability for seasonal packs before changing that lifecycle.

## Update cadence

During active work, post a short update when findings change the priority, a project reaches verification, or something is blocked. At each completed batch, update this status and the project board with the result, evidence and next project. There is no unattended background work or scheduled reporting configured.
