# Pack station

The homepage pack display now follows the approved desktop/mobile vending-machine mockup: navy powder-coated chassis, metal edges, lit glass, stocked foil packs, chrome dispensing spirals, a selection screen, tactile slot buttons and a recessed pickup hatch.

The machine is interactive HTML/CSS with optimized photographic assets. It does not vend or charge directly. Select a slot, adjust 1–5 packs and choose View pack or Contents & odds to continue to the existing pack page. The quantity is validated on that page, forces 1 for an owned inventory pack, and remains selected through the same-site auth return and supported hosted-checkout return. The screen shows the selected total and per-pack breakdown for multiple packs.

Only enabled, valid, saved catalogs with explicit saved prices are offered. Missing, unconfigured, disabled, default/demo or unpriced packs cannot be selected in the machine. No catalog, price, odds or enable switch was changed. Core/limited choices persist separately and additional tiers appear in banks of three. Empty/retry states, keyboard controls, reduced motion and 44px touch targets are supported. There is no automatic pack rotation or automatic purchase.

## Artwork

`assets/packs/{packId}.webp` contains new transparent navy foil artwork for Basic, Plus, Premium, Elite, Ultimate, Mythic and Icy Rush. The shared pack map includes exact intrinsic dimensions so the opening artwork stays centered on a cold visit. Hero, auth, landing, rewards, inventory and guide illustrations use the updated wrappers. Historical records and old assets remain intact. Known reward pack IDs resolve to the current artwork at display time, without rewriting records.

Photographic coils and a small powder-coat material are in `assets/vending/`. Asset files are generated from the approved visual direction and encoded as WebP; original generated files were retained in the workspace.

## Deployment

The machine and visible wrappers deploy through the normal frontend build/Vercel flow; no new secret or Rules are needed. If future reward records should also store the new wrapper path, deploy the shared Functions helper:

```bash
cd ~/rippr &&
git pull --ff-only origin main &&
npx firebase deploy --only functions:ripprAccount --project rippr-2b01c
```

Existing inventory displays current known wrapper artwork without this metadata deployment. No payment/odds logic was changed.

## Verification

- 294 domain tests passed.
- Machine behavior at 320/390/768/1440px: saved prices/availability, tactile/keyboard selection, quantity bounds/totals and links, no automatic purchase, multiple banks, limited/empty states, late catalog reads, retry and responsive geometry.
- Opening at 320/390/1440px: new intrinsic artwork remains centered, configured Mythic selection, disabled direct-link guard, quantity 3 carried from the machine and batch skip.
- Hosted checkout returns preserve known pack/quantity and reject stale/account/mode/unsafe contexts, with no automatic purchase.
- Existing Stripe top-up flow passed test/live fixtures at 320/390/1440px.
- Offline export retains local artwork/materials and shows an honest unavailable catalog rather than fabricated live stock.

Screenshots in `/tmp/rippr-vending-{width}.png` use isolated fixture prices/catalogs, not a read of production settings.
