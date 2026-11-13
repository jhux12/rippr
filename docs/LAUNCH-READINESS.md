# rippr launch readiness

This report separates implemented/tested code from business approval and deployed evidence. A green local test or merged commit is not proof of live readiness.

| Area | Current evidence | Remaining step |
| --- | --- | --- |
| Stripe happy path | Owner reported a successful sandbox top-up | Repeat once after this ledger deployment and confirm the purchased bucket/ledger entry |
| Negative/replay/refund/dispute handling | Local domain + browser fixtures | Run the sandbox acceptance matrix in PAYMENT-OPERATIONS.md against the deployed Stripe sandbox |
| Credit accounting | Source-separated sandbox ledger and zero-initialized isolated USD foundation | Owner approves live credit/promo/spend/refund policy; implement/review a separate real-money adapter before any live key |
| Payment reviews | Owner-only paginated queue, canonical Stripe proof, optimistic edits and audit notes | Deploy all three payment/account Functions and test admin resolutions on dedicated sandbox payments |
| Stripe business eligibility | Not established by API keys or successful test payments | Owner obtains approval for randomized Pokémon packs, stored credit and sellback model |
| Tax | Owner selected tax at funding on November 13, 2026; guarded Checkout support exists, Automatic Tax remains off until configured | Set the correct Stripe tax code, business origin and registrations; verify sandbox calculation before enabling. This records the owner decision, not tax/legal validation |
| Card catalog / prices / odds | Owner reports three current pack prices: $1, $5 and $15; site admin/library tools exist | Owner reviews the deployed enabled packs, removes demo entries, checks near-mint/slab descriptions, actual physical availability and saved probabilities/prices |
| Physical inventory controls | Current ownership/shipping flows remain test-only | Define stock/reservation and fulfillment handling before promising physical delivery; carrier integration is deferred at owner request |
| Email | Owner confirmed confirmation-email receipt and reply-to reception on November 13, 2026; local template/delivery checks passed | Verify actual welcome/reward/support messages and provider bounce/suppression behavior; see OPERATIONS-CHECK.md |
| SMS marketing | Explicit prelaunch preference/audit history; sending off | Provider approval/registration, final terms, inbound STOP/HELP, frequency control and fresh consent |
| Policies | Site footer still says full terms/privacy are being prepared | Owner publishes final terms, privacy, refunds and fulfillment policies; placeholders do not count as complete |
| Access rules | Server authorization/domain tests and rule regressions exist | Run official emulator rules tests from an environment that can download them; deploy updated rules |
| Mobile/customer journeys | Local browser regression checks | Final review of the deployed www.rippr.gg build on an actual iPhone/Android and desktop |
| Live rollout | Not active; live keys/events/non-test wallets rejected by current adapter | Separate reviewed rollout after these owner decisions and acceptance tests; never relabel existing test balances/items |

Next operational order: deploy this sandbox ledger/review batch → finish sandbox negative/reversal tests → verify email delivery and final catalog → obtain owner business/tax/policy decisions → implement/review the live adapter and fulfillment commitments. Keep marketing texts and live charging off until their separate requirements are met.

Owner sequencing: complete the operational checks (step 6) next; defer policy work (step 7) until afterward. Shipping integration remains deferred. See [OPERATIONS-CHECK.md](OPERATIONS-CHECK.md) for the focused results and remaining deployed checks.
