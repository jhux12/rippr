# Saved pack review

Source: owner-provided Cloud Shell output from `scripts/audit-packs.mjs`, reading public saved Firestore `packContents` documents. This workspace did not independently retrieve the documents; its Firestore network route remains blocked. No prices, odds, card pools, values or stock were changed.

## Active pack summary

| Pack | Saved version | Price | Active entries | Expected sellback credit | Credit return | Price minus expected credit | Below-price outcome | Any repeated entry in five |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Basic | 32 | $1.00 | 118 | $0.80 | 80.00% | $0.20 | 65.99% | 8.94% |
| Plus | 52 | $5.00 | 163 | $4.10 | 82.00% | $0.90 | 65.68% | 6.49% |
| Premium | 20 | **$10.00** | 229 | $8.40 | 84.00% | $1.60 | 69.71% | 4.78% |

The $15 pack described earlier is not currently an enabled saved pack in this output. Icy Rush is saved at $15 but disabled and still contains demo entries. The owner confirmed Premium should remain $10. The active target lineup is $1/$5/$10; no repricing is needed.

The mathematical checks apply to the reported distribution of entries, with independent draws and replacement. They are not evidence of real stock, current market prices, independent randomness certification or distinct card identities beyond the saved entries.

## Per-pack recommendations

**Basic:** retain the current odds provisionally for sandbox testing. Its 118-entry pool is a substantial improvement over the five-entry fallback. Consecutive same-entry probability is 0.92%, and ten openings average 9.59 distinct entries. Common is 69.47% of the pool probability; Legendary is 1.54% with saved values $4–$20. The $0.20 price-minus-expected-credit spread is narrow: validate card acquisition, payment costs per top-up, promotional credits and handling costs before interpreting it as a viable real-money product. It is not $0.20 cash profit per opening.

**Plus:** retain the current odds provisionally. The 163-entry pool gives 0.66% consecutive-repeat probability and 9.71 expected distinct entries in ten. Legendary probability is 4.24%, with a broad $9–$100 tier range. That 4.24% is the chance of the entire tier, not the chance of the $100 item. Verify each featured grail's individual probability from the detailed JSON or admin pool. The $0.90 credit spread still excludes all actual operating costs.

**Premium:** retain the owner-confirmed $10 price. At the saved $10 price, 229 entries and 0.49% consecutive-repeat probability provide good entry variety; ten openings average 9.78 distinct entries. Its 84% average credit return is higher than Plus, but fewer outcomes meet or exceed its price (30.29%, versus Plus 34.32%). Review that experience deliberately rather than assuming a higher average means more frequent break-even outcomes. Legendary is 1.72% with saved values $25–$200. Individual high-value-item probabilities remain unknown from this summary.

Owner decision: keep Premium at $10 with its existing pool/odds. The prior $15 proposal is not being pursued. No saved configuration was changed.

## Disabled/unconfigured tiers

- Elite v1 and Ultimate v1 are disabled and still contain the five demo entries. Keep them disabled until they have real configured catalogs and explicit intended prices.
- Icy Rush v2 is disabled at $15 and also contains demo entries. It is not a ready $15 offering.
- Mythic has no saved document. Its repository default is disabled/unpriced; treat it as unconfigured.
- Do not issue reward/inventory packs for these tiers while their pools remain unready. Already-owned disabled packs can still redeem their saved pools by design. Do not delete saved catalogs as a cleanup shortcut; review outstanding entitlements before retiring or replacing a pool.

## Evidence that supports readiness

The three active catalogs parsed successfully using the same validator as the application; no active demo, variety, concentration or duplicate-name warning appeared in the supplied summary. This supports configuration-level correctness, not full launch clearance. The saved prices override repository defaults, resolving the earlier fallback-price concern for these three existing documents. Missing standard catalogs still fall back to demos in code, so fail-closed behavior remains a separate pre-live recommendation.

## Still unverified

1. Every possible award's physical stock or reliable sourcing/reservation. The current test purchase path does not reserve warehouse stock.
2. Actual card identity, finish, Near Mint assessment, slab company/grade/image agreement and remote image loading. The summary contains no card-level image checks.
3. Individual card value freshness, acquisition costs, fee/top-up economics, rewards/referrals, packing, insurance, returns and shipping costs. Expected credit return cannot establish cash margin.
4. Detailed item-level odds, possible duplicate physical cards represented by different entries, maximum-probability entries and grail-feature accuracy. The detailed `/tmp/rippr-pack-readiness.json` can support this next pass without exporting customer data.
5. Deployed UI agreement with these configurations, legal/processor approval, tax treatment and the separate live-money/physical-fulfillment rollout.

Recommended order: examine the detailed public item rows and acquisition costs → verify artwork/condition/stock → implement fail-closed catalogs and appropriate physical-stock handling before real-money fulfillment. Preserve existing prices/odds during review.
