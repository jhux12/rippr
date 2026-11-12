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

R-12 — **Reusable card library** is complete in code: owner-only paginated library, TCGdex English import preview, CSV/value updates, bulk rarity/value edits, raw/slab records and selection into pack drafts at 0% odds. Pack snapshots and existing odds are preserved. Requires the new Firestore rules; no new Function. Live provider access and Rules emulator verification remain limited by workspace network policy. See [CARD-LIBRARY.md](CARD-LIBRARY.md).

R-13 — **Listed TCGplayer market values** is complete in code following the owner's updated direction to use listed market values. Imports include USD market-value previews; saved cards support on-demand refresh, finish selection, provider-ID linking and source update-time display. Missing prices, slab values, prior winnings and existing pack odds/values are preserved. No new API key, Function or rules change. Exact Near Mint-only market data is not claimed; live provider access remains unverified here.

R-14 — **Library-first imports and pack card picker** is complete in code: per-card/bulk site rarity during TCG import, library-only import saves, and an in-pack picker with full-library loading, value/rarity/condition/search filters, date/value/name sorting, selection persistence, version review and 0%-odds draft additions. Added dates are immutable for new cards; unknown historical dates remain unknown. Requires updated Firestore rules; no new Function/index/secret. Rules emulator remains network-blocked.

R-15 — **Prices and sorting before import** is complete in code: TCGplayer prices/ranges on search tiles, low/high sorting across loaded matches, load-all for full-query ranking, 24-card display pages, bounded price requests, progress/stop/retry, rate-limit handling and persistent selection. Ranges sort by their lowest listed value; missing prices sort last. The 1,000-match guard asks for a narrower search explicitly. No new backend deployment.

R-16 — **Larger pack prize pools** is complete in code: 1,000-entry shared/server/owner limit, a 900 KiB Firestore size guard, faster EV rounding for large pools, bulk selection within capacity, and 50-row/lazy-art admin rendering. Each opening still awards one card. Requires updated `ripprAccount` and Firestore rules; no data migration. Large-pool domain, purchase/idempotency and three viewport UI cases cover the boundary and overflow behavior. Rules emulator remains network-blocked.

R-17 — **Dotted TCGdex IDs** is fixed in code: set search accepts IDs such as `sv03.5`, dotted card links and artwork paths validate correctly, and imported site keys use a collision-free bounded namespace while retaining original provider IDs. Legacy generated IDs stay unchanged. Domain and 320/390/1440px browser checks cover search, prices, import/save, manual links and pack draft/save. Frontend only; no new Firebase deployment.

R-18 — **Repeated-opening motion and resource cleanup** is complete in code: one cancellable/visibility-aware phase clock, retained-motion cleanup, frame-coalesced foil, bounded decoding/audio graphs and compositor-based large-card settling. Existing colors/layout/economy remain intact; a short rarity lock pulse and card sheen add emphasis. Real-motion multi-pack, skip/reset, hidden-page, geometry and resource checks join the browser suite. Frontend only; no new Firebase deployment.

R-19 — **Audio and imported-artwork recovery** is complete in code: bounded image retries, manual Retry image for reveals/results/My items, stale-image cleanup, signed-URL preservation, recoverable clip loading, gesture/audio-session handling and visible-page audio resume. Tests cover transient network/decode failures, retry cleanup, autoplay-blocked resumes and real WAV output through the master graph. Native iOS/Safari and the owner’s exact live CDN failure remain unverified. Frontend only; no new Firebase deployment.

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

## Deferred — fulfillment operations

**R-08 is deferred at the owner’s request.** Its planned scope is: review the admin shipping queue, request lookup, status edits and conflict recovery; add older-queue access. Carrier quotes/dispatch and payment setup remain separate integrations. The current focus is accessibility and accurate settings feedback. Firebase deployment is deferred until the owner requests the combined release command.

## Current and following — customer experience

Completed frontend slice: account settings validation/error focus, phone-step focus, accurate saved-only notification copy and six new settings/navigation browser groups. The broader accessibility and notification delivery projects remain open.

| ID | Project | Why / definition of done |
| --- | --- | --- |
| R-08 | Fulfillment operator workflow (deferred) | Validate queue discovery, status edits, conflict recovery, request lookup and customer tracking. Keep quote/provider integration separate and label unavailable estimates accurately. |
| R-09 | Accessibility pass | Keyboard/focus checks for dialogs, forms and carousels; touch targets, reduced motion and error recovery. Record concrete issues and fix those found. Profile card focus now survives unchanged refreshes; extend checks to the remaining dialogs/forms and changing content. |
| R-10 | Operational visibility and notifications | Saved email/shipping notification preferences now explicitly say email delivery is not connected. Actual notification delivery remains unimplemented. Plan minimal error reporting and an admin audit view without capturing phone numbers, addresses, verification codes or tokens. External tools/costs require a concrete proposal first. |
| R-11 | Brand and content polish | Completed slices: consistent compact Pip empty/loading/error states; reveal name/detail hierarchy, value/outcome presentation, bounded keyboard-readable names, result artwork fallback and a visible batch summary. That typography slice preserved stage geometry/timing; later opening-motion work is recorded under R-18. Profile/Community framing, value/rarity/status styling, long names and art/avatar fallbacks are now polished. Sign-in and welcome screens share compact Pip/real-pack artwork, step-specific copy and consistent form finishes. Shipping content remains deferred. |

## Owner dependencies / excluded from this batch

Legal review and eligibility, Stripe/payment setup, real deposits, real-money ledger design, launch promises and refund terms are owned by the business owner. Existing test balances/items remain test data. Shipping prices and delivery estimates remain unavailable until the provider workflow exists. No dates or guarantees are inferred from the mockups.

## Verification levels

1. **Offline domain tests:** transaction fixture, not Firestore Security Rules or production behavior.
2. **Browser fixtures:** actual page scripts with isolated account data; no live account mutation.
3. **Build smoke checks:** local output links/assets, not external destinations or provider integrations.
4. **Emulator / live verification:** recorded separately. Rules emulator and deployed backend checks must not be reported as passed unless actually run.

## Condition metadata follow-through

Condition badges and admin grading fields are implemented. Raw entries default to Near Mint; slabs need explicit company/grade. New winnings retain their grading snapshot. Existing slab catalog entries need owner annotation; historical wins without recorded grades are not automatically reclassified. Queue the updated ripprAccount/ripprMuseum Functions and Firestore homepage rules with the deferred release. Local rules emulator validation could not run because the emulator download was unavailable.
