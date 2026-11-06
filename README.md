# rippr

The approved dark homepage mockup, implemented with HTML, CSS, and JavaScript. Includes exactly five tiers (Basic, Plus, Premium, Elite, Ultimate), a four-banner rotating hero, a rotating pack carousel, and grail previews. The desktop layout follows the mockup; smaller screens use a responsive catalog.

## Run

```sh
cd /workspace/rippr
python3 -m http.server 3000 --bind 127.0.0.1
```

No installation or build is required. Visit the server in your browser. All fonts and art are local.

## Use

- The hero preserves the original style, rotates through four banners, and uses a compact 220px mobile height. Banner controls support pause and manual selection, and reduced motion disables autoplay by default.
- Pack artwork uses transparent-background cutouts throughout the hero, carousel, and opening pages.
- Browse five tiers using arrows, tier buttons, keyboard arrows, or swipes.
- Rotation pauses on hover; keyboard/manual navigation pauses it until Play. Reduced motion defaults to paused.
- Each pack links to `opening.html?pack=<id>` and uses its matching artwork.
- Open 1–5 demo packs; each pack reveals exactly one concept card. The pack zooms into a centered stage, then users drag across the foil before revealing it. Enter/Space also rips the foil; arrow keys advance the tear. Each pack in a batch has its own rip step.
- Shimmer and foil layers use the selected artwork's intrinsic ratio and alpha mask.
- Demo rarity odds are 10% rare, 20% uncommon, and 70% common.
- Grail previews, Collection, and How it works open accessible dialogs. Log in and Get started link to the matching account form.
- `auth.html?mode=signup` and `auth.html?mode=login` implement the approved split-screen account concept, with a compact split panel (maximum 940px), an 80px mobile artwork strip, keyboard tabs, validation, and a password visibility toggle. Google buttons switch between Sign up and Sign in; OAuth is not connected and clicks show an explicit preview notice.
- Authentication is a frontend preview. Valid form submissions explicitly say no account was created or login performed. Email/password values are never sent, stored, or logged. Connecting an authentication provider and publishing real Terms/Privacy documents are required before production account use. Saved collections remain placeholders. No payments, real items, or card values are involved.

## Files

- `index.html`, `style.css`, `app.js`: homepage layout and interactions.
- `packs.js`: shared five-pack catalog.
- `auth.html`, `auth.css`, `auth.js`: sign-up/login UI; authentication service not connected.
- The account page reuses the same Plus, Premium, and Ultimate pack files as the homepage and opening flow.
- `opening.html`: animated opening flow, odds, and grail previews.
- `assets/pack-basic.svg` through `assets/pack-ultimate.svg`: SVG presentation viewports of the approved Pokémon-themed tier artwork, with Poké Ball icons and one-card labels. These contain raster illustrations, not editable vector masters. Earlier concept assets are retained. Grail assets also contain raster artwork.
- `assets/fonts/`: bundled Manrope variable font and its OFL license.

## Export offline previews

```sh
python3 scripts/export-previews.py /workspace/downloads
```

This creates three self-contained HTML files and `rippr-site.zip`. Keep the three HTML files together for navigation between them. The exported previews embed art and fonts and require no server. The browser must allow JavaScript and local Blob image URLs.

## Validation

Validated in Chromium at desktop, tablet, and mobile sizes: artwork loading, no horizontal overflow, carousel navigation, rotation, swipes, dialogs and keyboard focus, all five pack links, one-card openings, five-pack openings, restart, and reduced-motion behavior. Account-page checks cover signup/login deep links and history, keyboard tabs, validation, password visibility, policy-dialog focus, honest preview submissions, and offline operation without external requests. The reusable export script verifies the ZIP archive's integrity.
