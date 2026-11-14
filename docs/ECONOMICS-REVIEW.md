# Payment fees and promotion budget review

## Inputs and evidence

- Owner confirmed acquisition cost equals listed card value and sourcing is available. This is a planning input, not independently verified invoices or supplier guarantees.
- Owner-provided saved-pack audit: Basic $1 / $0.80 EV, Plus $5 / $4.10 EV, Premium $10 / $8.40 EV.
- Owner selected **2.9% + $0.30** for this planning scenario. It is not a verified Stripe rate agreement or business-model approval. Actual method/country/currency/dispute/tax-related costs can differ.
- Saved daily-spin/referral settings have not been read by this workspace. Their runtime defaults and hardcoded streak/welcome rules are distinguishable below. No settings have been changed.

## Fee scenarios

Estimated fees rounded to the nearest cent for each top-up:

| Top-up | Fee | Percentage of funding |
| --- | --- | --- |
| $1 | $0.33 | 33.0% |
| $5 | $0.45 | 9.0% |
| $10 | $0.59 | 5.9% |
| $25 | $1.03 | 4.12% |
| $50 | $1.75 | 3.5% |

A $1 deposit spent on a single Basic opening has a $0.20 price-minus-expected-card-value spread but an estimated $0.33 processing fee. It is negative by $0.13 in that simplified all-awards-procured scenario before rewards or other costs. This is not proof of realized cash losses on all users: keep/sellback behavior and how balances are used affect cash flow.

Fees occur on funding transactions, not on every pack opening. Allocating a $10 deposit's $0.59 fee proportionally across its face value yields the following planning spreads:

| Pack | Before fees/promotions | Allocated funding fee | After allocation, before promotions/other costs |
| --- | --- | --- | --- |
| Basic | $0.20 | $0.059 | $0.141 |
| Plus | $0.90 | $0.295 | $0.605 |
| Premium | $1.60 | $0.590 | $1.010 |

This allocation assumes the funded value is ultimately spent. Partial usage/refunds, retained processor fees and mixed deposit sizes change the result. These are not verified net margins. No minimum top-up is changed by this report.

## Promotions: code evidence versus saved settings

**Daily spin:** if no saved daily document exists, the current code default is enabled with testing cooldown bypass on. Its default prize mix gives $0.45 in expected credit face value plus $0.146 in expected pack-award value per claim, using Basic/Plus EVs from the snapshot. The combined $0.596 is a promotion-budget measure, not a cash cost. An enabled cooldown bypass has no finite daily claim budget. A saved configuration may override all those defaults; it must be inspected before claiming this is the deployed setup.

**Streak:** current code grants $0.80 total site credit over days 1–6, plus a Basic pack on day 7 ($0.80 expected item value at the audited pool). Combined credit-face/pack-EV exposure is $1.60 per completed cycle. The rolling streak timing is independent of spin cooldown bypass. No deposit requirement is enforced for streak claims by the current service.

**Welcome case:** current code grants one Basic pack after a verified first deposit. With the audited pool that is $0.80 expected item value. The current sandbox Checkout permits deposits starting at $1; the welcome timestamp has no separate minimum-deposit qualification. Free test credits do not qualify. This describes code behavior, not an approved production deposit policy.

**Referral:** absent saved or valid legacy settings, the default grants $0.25 credit to each participant after the buyer's first qualifying purchase of at least $1, capped at 20 bonuses per referrer. Total credit face value is $0.50 per successful pair. Saved/legacy settings can override it. Both participants' grants count in the promotion budget; a minimum purchase and per-referrer cap do not by themselves cap the site's total acquisition spend.

If the default spin mix were limited to one claim/day, seven daily spins plus one full streak would represent $5.772 in combined credit-face/pack-EV exposure. That hypothetical does **not** describe the uncapped testing default or establish the actual saved configuration, cash fulfillment cost or profitability. Recurring rewards need a separate budget, especially when ongoing deposit eligibility is not enforced.

## Recommendations, not applied changes

1. Confirm the saved spin/referral configuration and whether testing bypass remains enabled. Disable repeat-claim testing before any live rollout and approve explicit eligibility/caps; do not assume a visual countdown enforces eligibility.
2. Avoid treating $1 funding as sustainable under this fee scenario. Consider a reviewed $10 minimum top-up and/or larger suggested amounts, with appropriate refund/unused-credit treatment. This is a proposal, not a new restriction or encouragement to spend more.
3. Approve a welcome/referral acquisition budget and qualifying amount against expected customer lifetime contribution. A free Basic pack alone can exceed a small deposit's first-purchase spread. Front-loaded acquisition spend can be deliberate, but should not be mistaken for positive first-order contribution.
4. Budget recurring daily/streak rewards separately from pack odds; preserve the owner-selected pack prices and EVs unless a separately reviewed change is requested.
5. Validate actual fees, keep/sellback/redemption behavior, acquisition costs, packaging, returns and shipping before asserting profitability. Tax/live payments remain off.

## Read-only saved-settings command

The workspace cannot currently reach Firestore. The following helper uses the existing Google Cloud Shell login for GET requests only to `rewardSettings/daily`, `rewardSettings/referrals`, `rewardSettings/journey` and the three active public pack catalogs. It does not access customer accounts, create deposits, send email, change settings or reveal/write the Google access token. It follows the same saved/legacy/default precedence as the service and labels each source. Missing pack catalogs or denied reads stop the report rather than substituting demo costs.

```bash
cd ~/rippr &&
git pull --ff-only origin main &&
node scripts/audit-economics.mjs --gcloud --project rippr-2b01c
```

Share the short printed summary. No download or private key is required. If access is denied, report the HTTP status; do not paste tokens or loosen database rules. A `--output` file contains only cleaned settings and pack economics, not account/customer records. `--input` supports isolated fixture/export review.
