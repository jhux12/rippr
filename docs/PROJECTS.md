# rippr project board

This is the working plan for the next development batches. Keep each project small enough to review, test and release independently. Code merged to `main` is not proof that Firebase Functions or rules have been deployed.

## Working agreement

- Owner: legal decisions, business eligibility, payment-provider approval and payment setup.
- Website lead: product implementation, branding, customer experience, reliability, non-payment admin and fulfillment tools, testing and release preparation.
- Keep the current navy/cyan/Pip direction and existing pack-opening flow. Improve existing flows before adding modes.
- Do not invent reviews, delivery evidence, customer activity, stock counts or operational guarantees.
- Post findings and completion updates in chat during active work; update this board and [STATUS.md](STATUS.md) at each completed batch. Work and updates do not run unattended between sessions.
- No live purchases, production data changes, Firebase deployments, outbound messages, paid services or new customer commitments during local verification.

## Current batch — reliability foundation

| ID | Project | Status | Completion criteria |
| --- | --- | --- | --- |
| R-01 | Consistent fulfillment labels in My items | Complete in code; see deployment note | Request, review, packing, shipped and delivered reflect the saved shipment. Older items without a shipment still render. No sell/ship controls for fulfillment items. Mobile and desktop checked. |
| R-02 | Award only configured daily reward packs | Complete in code; see deployment note | Saving/claiming cannot offer an unavailable positive-odds pack. Odds are never silently rerolled. A failed claim changes no balance, cooldown or inventory. Existing successful retries remain idempotent. |
| R-03 | Release checks cover the whole existing product | Complete in code; first hosted CI run pending | Standard tests include account, rewards, referrals and museums. CI builds the site, checks local links/assets and runs offline tests without production credentials. |

R-01 is frontend-only. R-02 requires deploying `functions:ripprAccount`; this workspace does not deploy it. R-03 adds CI configuration; local checks do not establish that the hosted workflow has run.

## Next — inventory access

### R-04: Complete inventory, not just the newest 200 records

**Priority:** High. **Owner:** Website lead. **Status:** Next.

Confirmed: `functions/service.js` limits snapshot cards and unopened packs to 200. Profile search and filters operate on that limited result. An older available card can be hidden behind 200 newer sold cards. The current `hasMore` note is not pagination.

Scope:
- Add authenticated cursor pagination for cards and unopened packs; define stable ordering for records with identical timestamps.
- Keep older actionable cards and reward packs reachable. Distinguish searching loaded records from searching the full collection.
- Preserve selection across page loads, deduplicate refreshes, and prevent account changes from leaking prior-account results.
- Apply the same retrieval model to museum curation so older kept/shipped cards remain selectable.
- Review the separate 50-shipment and 100-admin-request limits in the same data-access design.

Done when tests cover >200 cards/packs, mixed sold/available items, identical timestamps, retries, refreshes, end-of-list and account switching. Ship backend and frontend together; document the deployment requirement.

## Following — operations and experience

| ID | Project | Why / definition of done |
| --- | --- | --- |
| R-05 | Seasonal pack redemption lifecycle | Separate ending sales from redeeming already-owned packs. Define an explicit policy for outstanding seasonal reward packs before changing redemption behavior; never substitute contents silently. |
| R-06 | Signed-in journey regression checks | Exercise sign-up/login return paths, Remember me, opening interruption, batch skip, keep/sell, free inventory-pack opening, shipping requests and community on mobile/desktop using isolated fixtures. No production SMS or awards. |
| R-07 | Performance budget | Measure cold-load asset use on home, opening and profile. Optimize oversized active images without changing artwork or pack alpha dimensions. Record before/after request bytes and verify layout/animation quality. |
| R-08 | Fulfillment operator workflow | Validate queue discovery, status edits, conflict recovery, request lookup and customer tracking. Keep quote/provider integration separate and label unavailable estimates accurately. |
| R-09 | Accessibility pass | Keyboard/focus checks for dialogs, forms and carousels; touch targets, reduced motion and error recovery. Record concrete issues and fix those found. Preserve profile focus during periodic snapshot refresh instead of replacing focused controls. |
| R-10 | Operational visibility and notifications | Saved email/shipping notification preferences currently do not send messages; clarify the settings until delivery is implemented. Plan minimal error reporting and an admin audit view without capturing phone numbers, addresses, verification codes or tokens. External tools/costs require a concrete proposal first. |
| R-11 | Brand and fulfillment content | Keep approved pack/Pip assets coherent. Replace concept packaging imagery with owner-supplied real fulfillment evidence when available; no fabricated social proof. |

## Owner dependencies / excluded from this batch

Legal review and eligibility, Stripe/payment setup, real deposits, real-money ledger design, launch promises and refund terms are owned by the business owner. Existing test balances/items remain test data. Shipping prices and delivery estimates remain unavailable until the provider workflow exists. No dates or guarantees are inferred from the mockups.

## Verification levels

1. **Offline domain tests:** transaction fixture, not Firestore Security Rules or production behavior.
2. **Browser fixtures:** actual page scripts with isolated account data; no live account mutation.
3. **Build smoke checks:** local output links/assets, not external destinations or provider integrations.
4. **Emulator / live verification:** recorded separately. Rules emulator and deployed backend checks must not be reported as passed unless actually run.
