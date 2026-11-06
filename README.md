# rippr

The approved dark homepage mockup, implemented with HTML, CSS, and JavaScript. Includes exactly five tiers (Basic, Plus, Premium, Elite, Ultimate), a compact hero, a rotating pack carousel, and grail previews. The desktop layout follows the mockup; smaller screens use a responsive catalog.

## Run

```sh
cd /workspace/rippr
python3 -m http.server 3000 --bind 127.0.0.1
```

No installation or build is required. Visit the server in your browser. All fonts and art are local.

## Use

- Browse five tiers using arrows, tier buttons, keyboard arrows, or swipes.
- Rotation pauses on hover; keyboard/manual navigation pauses it until Play. Reduced motion defaults to paused.
- Each pack links to `opening.html?pack=<id>` and uses its matching artwork.
- Open 1–5 demo packs; each pack reveals exactly one concept card.
- Demo rarity odds are 10% rare, 20% uncommon, and 70% common.
- Grail previews, Collection, How it works, and Log in open accessible dialogs.
- Accounts and saved collections are placeholders. No payments, real items, or card values are involved.

## Files

- `index.html`, `style.css`, `app.js`: homepage layout and interactions.
- `packs.js`: shared five-pack catalog.
- `opening.html`: animated opening flow, odds, and grail previews.
- `assets/pack-basic.svg` through `assets/pack-ultimate.svg`: editable vector tier pack designs. Earlier concept assets are retained. Grail assets are SVG presentation viewports containing raster artwork.
- `assets/fonts/`: bundled Manrope variable font and its OFL license.

## Export offline previews

```sh
python3 scripts/export-previews.py /workspace/downloads
```

This creates two self-contained HTML files and `rippr-site.zip`. Keep both HTML files together for navigation between them. The exported previews embed art and fonts and require no server. The browser must allow JavaScript and local Blob image URLs.

## Validation

Validated in Chromium at desktop, tablet, and mobile sizes: artwork loading, no horizontal overflow, carousel navigation, rotation, swipes, dialogs and keyboard focus, all five pack links, one-card openings, five-pack openings, restart, and reduced-motion behavior. The reusable export script verifies the ZIP archive's integrity.
