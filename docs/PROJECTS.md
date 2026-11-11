# rippr project board

This is the working plan for the next development batches. Keep each project small enough to review, test and release independently. Code merged to `main` is not proof that Firebase Functions or rules have been deployed.

## Working agreement

- Owner: legal decisions, business eligibility, payment-provider approval and payment setup.
- Website lead: product implementation, branding, customer experience, reliability, non-payment admin and fulfillment tools, testing and release preparation.
- Keep the current navy/cyan/Pip direction and existing pack-opening flow. Improve existing flows before adding modes.
- Do not invent reviews, delivery evidence, customer activity, stock counts or operational guarantees.
- Post findings and completion updates in chat during active work; update this board and [STATUS.md](STATUS.md) at each completed batch. Work and updates do not run unattended between sessions.
- No live purchases, production data changes, Firebase deployments, outbound messages, paid services or new customer commitments during local verification.

## Completed foundation

| ID | Project | Status | Completion criteria |
| --- | --- | --- | --- |
| R-01 | Consistent fulfillment labels in My items | Complete in code; see deployment note | Request, review, packing, shipped and delivered reflect the saved shipment. Older items without a shipment still render. No sell/ship controls for fulfillment items. Mobile and desktop checked. |
| R-02 | Award only configured daily reward packs | Complete in code; see deployment note | Saving/claiming cannot offer an unavailable positive-odds pack. Odds are never silently rerolled. A failed claim changes no balance, cooldown or inventory. Existing successful retries remain idempotent. |
| R-03 | Release checks cover the whole existing product | Complete in code; first hosted CI run pending | Standard tests include account, rewards, referrals and museums. CI builds the site, checks local links/assets and runs offline tests without production credentials. |

R-01 is frontend-only. R-02 requires deploying `functions:ripprAccount`; this workspace does not deploy it. R-03 adds CI configuration; local checks do not establish that the hosted workflow has run.

## Current batch — inventory, redemption and loading performance

| ID | Project | Status | Verified scope |
| --- | --- | --- | --- |
| R-04 | Complete inventory access | Complete in code; account Function deployment needed | Stable authenticated cursor pages for cards, packs and shipments. Load more in profile, museum editor and tracking. Loaded records/selection persist across refresh; stale account responses are discarded. Filters/search describe their loaded scope. |
| R-05 | Seasonal pack redemption | Complete in code; account Function deployment needed | Sales flag stops new purchases/reward offers, not earned packs. Exact ownership lookup for deep links; current valid contents/version required; one redemption, zero debit. |
| R-06 | Customer-journey regression checks | Implemented; see status for verification | Reusable Playwright fixture suite for auth return flows, sell/ship, older inventory, museum eligibility, order history, batch skip/interruption and seasonal redemption. CI setup includes browser installation. |
| R-07 | Initial performance pass | Complete for active asset payloads | Lossless encoding of the five active pack sprites, reveal back and landing slab. Pack group is 35% smaller; dimensions/alpha preserved. [Measured scope](PERFORMANCE.md). No production load-time claim. |

R-04 and R-05 require the updated `ripprAccount` Function. No rules changes or new Function names. Deploy backend before frontend rollout. The previous 200-record **page size** remains; the former hard access limit is removed. Admin queue (100) and activity history (50) need separate pagination if those workflows grow.

## Next — fulfillment operations

**R-08** is next: review the admin shipping queue, request lookup, status edits and conflict recovery; add older-queue access. Carrier quotes/dispatch and payment setup remain separate integrations. A broader accessibility/notification pass follows.

## Following — operations and experience

| ID | Project | Why / definition of done |
| --- | --- | --- |
| R-08 | Fulfillment operator workflow | Validate queue discovery, status edits, conflict recovery, request lookup and customer tracking. Keep quote/provider integration separate and label unavailable estimates accurately. |
| R-09 | Accessibility pass | Keyboard/focus checks for dialogs, forms and carousels; touch targets, reduced motion and error recovery. Record concrete issues and fix those found. Profile card focus now survives unchanged refreshes; extend checks to the remaining dialogs/forms and changing content. |
| R-10 | Operational visibility and notifications | Saved email/shipping notification preferences currently do not send messages; clarify the settings until delivery is implemented. Plan minimal error reporting and an admin audit view without capturing phone numbers, addresses, verification codes or tokens. External tools/costs require a concrete proposal first. |
| R-11 | Brand and fulfillment content | Keep approved pack/Pip assets coherent. Replace concept packaging imagery with owner-supplied real fulfillment evidence when available; no fabricated social proof. |

## Owner dependencies / excluded from this batch

Legal review and eligibility, Stripe/payment setup, real deposits, real-money ledger design, launch promises and refund terms are owned by the business owner. Existing test balances/items remain test data. Shipping prices and delivery estimates remain unavailable until the provider workflow exists. No dates or guarantees are inferred from the mockups.

## Verification levels

1. **Offline domain tests:** transaction fixture, not Firestore Security Rules or production behavior.
2. **Browser fixtures:** actual page scripts with isolated account data; no live account mutation.
3. **Build smoke checks:** local output links/assets, not external destinations or provider integrations.
4. **Emulator / live verification:** recorded separately. Rules emulator and deployed backend checks must not be reported as passed unless actually run.
