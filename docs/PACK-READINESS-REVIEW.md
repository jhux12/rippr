# Pack readiness review — evidence and next input

## Scope

Owner confirmed the active targets are $1, $5 and $10 (Premium stays $10). This review does not change prices, odds, card pools, values or stock. Saved Firestore configurations are not stored in Git, and their live contents have not been retrieved here: the workspace proxy rejected the public Firestore GET with HTTP 403 at CONNECT. That is an environment access restriction, not evidence that the public site or Firebase rules are broken.

No per-pack live EV, card count, probability or image-health result is claimed without the saved data. Repository seed cards are explicitly not treated as the owner's current packs.

## Verified code-level findings

1. **Missing standard catalogs fall back to illustrative cards.** `functions/service.js` reads `packContents/{id}` and uses `defaultPack(id)` if absent; standard core defaults are enabled. Saved seasonal/Mythic inventory catalogs have a narrower missing-document safeguard. The core fallback contains five fictional/demo entries. Before live launch, require a valid explicitly saved catalog for every enabled purchasable tier. Do not infer the owner is currently selling demo cards: document existence is unverified.
2. **Physical stock is not reserved by openings.** The purchase transaction draws with replacement from configured items and writes awarded test inventory records. It does not consult/decrement a warehouse stock record. An item may be awarded repeatedly without a physical-quantity limit. Before physical fulfillment, implement reliable stock/reservations or a reviewed sourcing guarantee; do not silently reroll an unavailable outcome and change published odds.
3. **Repository price defaults differ from the owner's stated prices.** Basic defaults to $1.99, Plus $4.99, Premium $14.99. Saved prices override them. This is a fallback risk, not proof of incorrect current prices. Explicitly save the intended $1/$5/$10 and verify the saved values.
4. **Several existing correctness controls are present.** Saved item odds must total 10,000 basis points; values/rarities/grades/images receive structural validation; the server checks the price/version the customer approved; one card is written per pack before reveal; retries do not duplicate awards/debits; zero-probability grails are excluded from the opening gallery. These do not independently verify live art, warehouse stock or market pricing.
5. **Value freshness and costs remain unknown.** Pack items contain the saved sellback/reference value. A catalog update timestamp does not establish the date of every market price. Acquisition costs, processor fees, promotional liabilities and shipping/packaging costs are not available for a gross-margin calculation.

## Read the actual saved catalogs

The new command reads only public `packContents` documents. It does not require a private key, alter a document, purchase a pack or access customer accounts. It fetches all seven known tier IDs so disabled tiers and unexpected enabled prices can also be spotted. Missing or malformed documents are reported; demo defaults are not substituted.

In Cloud Shell:

```bash
cd ~/rippr &&
git pull --ff-only origin main &&
node scripts/audit-packs.mjs --project rippr-2b01c --output /tmp/rippr-pack-readiness.json
```

Share the printed summary for the per-pack recommendations. `/tmp/rippr-pack-readiness.json` also contains the public item rows if deeper analysis is needed. Do not send account exports, tokens, private keys or customer data. If the public read fails, report its HTTP status; do not loosen Firestore rules to obtain the audit.

Alternatively, `--input` accepts either a `{ "packs": { "basic": <saved catalog>, ... } }` JSON export or a Firestore REST list response containing `documents`. The input must be the saved public catalogs, not screenshots or repository defaults.

## What the report measures

- Saved price/version/enabled status, positive-probability entries and zero-chance entries.
- Rarity counts, probability totals and active min/max values.
- Exact expected sellback credit, credit return relative to opening price, and chance of an item valued below/at-or-above the price.
- Same-entry probability on consecutive openings, probability of any repeated entry in five openings, expected distinct entries across ten openings and per-item expected awards per 1,000 openings.
- Demo entries, structurally invalid configurations, missing local artwork and possible duplicate names/grades.

Calculations assume the code's independent draws with replacement. These exact calculations are more stable than a small random sample; they are not an external fairness certification. Entries with separate IDs can still represent the same physical card, so identity/variant review matters. Remote image URLs are structurally checked but not downloaded; artwork reachability and slab/image matching remain visual checks.

**Expected credit return is not cash margin or profit.** Customers may keep or sell items; credit circulation, repeat openings, card acquisition costs, promotions, payment fees, returns and shipping all affect the business. Variety flags (under 30 entries or an individual entry over 20% probability) are review heuristics, not automatic configuration changes or universal requirements.

## Remaining owner inputs

Confirm physical quantities/sourcing for every possible card, acquisition costs by card/tier, actual Near Mint checks and slab identity, recent value references, current reward/referral costs, and how many openings to support before restocking. Keep real payments/fulfillment off until the relevant launch gates are met.
