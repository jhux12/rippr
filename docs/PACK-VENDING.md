# Pack station

The homepage pack display follows the approved desktop/mobile vending-machine mockup: navy powder-coated chassis, metal edges, lit glass, stocked foil packs, chrome dispensing spirals and a recessed pickup hatch. All six core tiers appear together in two rows. The Core/Limited switch remains; a single limited pack is centered in the glass.

The machine is interactive HTML/CSS with optimized photographic assets. It does not vend or charge directly. Select a pack, adjust 1–5 packs and choose View pack to continue to the existing pack page. A compact bar below the glass contains the selected name, total, quantity and button, with an each-price breakdown for multiple packs. The large preview screen, duplicate slot keys, separate odds link and bank pagination have been removed. Quantity is validated on the opening page, forces 1 for an owned inventory pack, and remains selected through the same-site auth return and supported hosted-checkout return.

Only enabled, valid, saved catalogs with explicit saved prices can be selected. Missing, unconfigured, disabled, default/demo or unpriced tiers remain visible with an Unavailable label and disabled controls; they never use fallback prices or open a purchase link. No catalog, price, odds or enable switch was changed. Core/limited choices persist separately. Loading/retry states, keyboard controls that skip disabled packs, reduced motion and 44px touch targets are supported. There is no automatic pack rotation or automatic purchase.

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
- Updated machine behavior at 320/390/768/1440px: all six tiers visible, unavailable tiers disabled, saved prices, click/keyboard selection across rows, quantity bounds/totals and links, no automatic purchase, limited states, late catalog reads, retry and responsive geometry.
- Opening at 320/390/1440px: new intrinsic artwork remains centered, configured Mythic selection, disabled direct-link guard, quantity 3 carried from the machine and batch skip.
- Hosted checkout returns preserve known pack/quantity and reject stale/account/mode/unsafe contexts, with no automatic purchase.
- Existing Stripe top-up flow passed test/live fixtures at 320/390/1440px.
- Offline export retains local artwork/materials and shows an honest unavailable catalog rather than fabricated live stock.

Current screenshots in `/tmp/rippr-vending-minimal-{width}.png` show six enabled fixture tiers; `/tmp/rippr-vending-minimal-normal-{width}.png` shows three enabled and three unavailable tiers. They use isolated fixture prices/catalogs, not a read of production settings.
