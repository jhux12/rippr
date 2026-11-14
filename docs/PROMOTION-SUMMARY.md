# Admin promotion summary

Admin → Spark rewards now shows 7/30/90-calendar-day totals for welcome packs, referral packs (both recipients), Spark redemptions, and their combined estimated reward value. Date boundaries use Indianapolis local time, including daylight-saving changes. Values are sandbox-only budget measures, not profit or verified cash cost.

Tracking begins when this version is deployed. Historical awards are not backfilled and are explicitly excluded in the interface. Failed awards and operation replays do not add to totals. Each new welcome claim, referral pair or Spark redemption updates a private daily aggregate in its existing award transaction. There are no customer identifiers in these aggregate documents.

Pack EV is captured from the validated saved catalog at the time of award: sum(valueCents × chanceBps), stored in integer units of 1/10,000 cent. Credit prizes use their actual face amount. Changing a catalog later does not rewrite prior recorded estimates. Referral counts represent one qualifying pair per two awarded packs. Previously issued rewards are gross issued value: later sales, openings, refunds and point revocations do not subtract from these totals.

The read-only `adminPromotionSummary` action requires the verified owner token. Browser reads/writes of `promotionDays` remain denied under existing rules. Reads fetch at most 90 daily documents and require only a single-field index; no new indexes or secrets. A daily aggregate is shared by award transactions; if high award volume later causes contention, shard the aggregates before increasing throughput.

Refresh explicitly to update totals. Failed refreshes retain prior totals with a warning; sign-out/account switches clear the display. The summary never changes odds, pricing, inventory or reward eligibility.

Deploy frontend normally through Git/Vercel. Backend:

```bash
cd ~/rippr &&
git pull --ff-only origin main &&
npm ci &&
npm ci --prefix functions &&
npx firebase deploy --only functions:ripprAccount --project rippr-2b01c
```

Domain tests cover owner access, invalid periods, Indianapolis boundaries, exact EV, period filtering, catalog changes, replay and rollback. Existing referral tests verify both awards count once. Browser fixtures cover filters, recorded values, mobile layout and sign-out cleanup. Official Firebase emulator rule checks remain a separate environment-dependent check.
