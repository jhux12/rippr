# Spark Points — sandbox implementation

Supersedes daily spin and streak payouts. Existing awards, balances, packs, saved daily configuration, welcome qualification and referral settings remain intact. No points are retroactively minted. No live Stripe payments or tax were enabled.

## Rules

- Earn 1 point per $1 of purchased credit actually spent on packs. Deposits alone earn nothing.
- Spending order: legacy test credit → promotional credit → sellback credit → purchased credit.
- Only the purchased portion earns points. Free and reward-pack openings earn nothing. Fractions persist: 100 integer units = 1 point; each eligible USD cent earns one unit.
- Redeem 25 points for a Spark Spin. No daily free claims, streak payouts, cooldowns or testing bypass.
- Default prizes: $0.05 at 80%, $0.10 at 18%, $0.25 at 2%. Expected credit face value $0.063 per spin, or $0.00252 per eligible purchased dollar spent, before other promotions/costs. This is not verified net profit.
- Points do not expire, cannot be transferred or withdrawn, and have no cash redemption. Current prizes and balances are sandbox-only.
- Welcome case and referrals remain separate and retain their existing settings. Their cost is not included in the Spark estimate.

## Integrity and recovery

Server transactions atomically debit points, draw the outcome, save any inventory/credit award, and record the operation and Spark ledger. Same operation replay returns its original outcome. Different requests cannot overspend the balance. The browser persists an account-scoped pending operation so an interrupted spin can recover its original outcome without another debit. Browser storage failure still retains the operation in memory for that page session.

`rewardSettings/spark` is a new settings namespace. Missing settings use the explicit bounded defaults above, version 0; admin saves advance the version. Saved daily settings are untouched but no longer award anything. Cached clients cannot create new `claimReward`, `claimStreak` or `saveRewards` operations. Historical successful operation replays remain available.

The wheel uses equal display slices. Published probability percentages, not slice sizes, determine the server draw. Motion pauses when hidden and respects reduced motion. Pack prizes retain normal unopened-inventory behavior and require valid saved catalogs.

## Refund review

Remaining purchased credit is handled by the existing payment-review process. If a refund exceeds remaining purchased credit and the account has earned points, Spark redemption pauses for manual review. This deliberately does not claim to attribute fungible spending to a particular deposit lot.

In Admin → Rewards, use the customer UID to view the private Spark ledger. Review the related payment and earned-point entries, enter the number of points to remove and a detailed note, and resolve the review. Zero removal is supported when the investigation supports it. A removal larger than spendable points becomes point debt; future earnings repay that debt first. Stale revisions and nonowner adjustments are rejected. This action changes no payment or credit balance.

Account closure blocks unresolved point reviews/debt and explicitly relinquishes remaining points only with current user confirmation. Point ledger access and point mutation remain server controlled.

## Deployment

Frontend deploys through the normal Git/Vercel build. In Cloud Shell, from the repository:

```bash
cd ~/rippr &&
git pull --ff-only origin main &&
npm ci &&
npm ci --prefix functions &&
npx firebase deploy --only functions:ripprAccount,functions:ripprStripe,firestore:rules --project rippr-2b01c
```

No new secrets or indexes. The Stripe function deployment includes spent-refund point-review handling. Updated sandbox draft disclosures use policy version `sandbox-2026-11-13-v3`; users review them again. This is not legal approval for live launch.

## Verification

Domain tests cover paid-only earning, mixed-source spending, fractions, operation replay, concurrency, no free-claim routes, paused/stale odds, inventory pack redemption, refund review, debt recovery and closure. Browser fixtures verify mobile/desktop layout, reduced motion, visibility pausing, duplicate clicks, welcome gating and sign-out. Fixtures do not replace live Firebase/Stripe smoke tests or official Security Rules emulator execution.
