# Frontend performance — assets and pack motion

The asset pass below preserves the approved artwork and pack geometry. It changes encoding only; no resizing, cropping, alpha masking, layout or animation timing was introduced by that pass. Original standalone PNG masters remain available. The later motion pass is documented separately at the end.

## Encoded asset bytes

| Asset | Before | After | Reduction |
| --- | ---: | ---: | ---: |
| `assets/pack-basic.svg` | 1,878,712 B | 1,222,053 B | 35.0% |
| `assets/pack-plus.svg` | 1,878,713 B | 1,222,054 B | 35.0% |
| `assets/pack-premium.svg` | 1,878,713 B | 1,222,054 B | 35.0% |
| `assets/pack-elite.svg` | 1,878,714 B | 1,222,055 B | 35.0% |
| `assets/pack-ultimate.svg` | 1,878,714 B | 1,222,055 B | 35.0% |
| `assets/reveal/rippr-card-back.webp` | 2,642,953 B | 1,658,384 B | 37.3% |
| `assets/landing/charizard-slab.webp` | 3,208,196 B | 2,092,690 B | 34.8% |

All five active SVG packs embed the same sprite. The sprite remains embedded to work inside SVG images and offline exports; each SVG keeps its original dimensions and `viewBox`. The sprite stays 1774 × 887 pixels.

## Page asset groups

These totals count the listed unique assets once each. They are source-file payloads, not whole-page transfer sizes or measured load times. Browser lazy loading, selected pack, caching and server compression affect when/how many bytes transfer.

| Page / asset group | Before | After | Reduction |
| --- | ---: | ---: | ---: |
| Homepage five-pack collection | 9,393,566 B | 6,110,271 B | 35.0% |
| Homepage collection + Community scene card back | 12,036,519 B | 7,768,655 B | 35.5% |
| Basic opening pack + preloaded card back | 4,521,665 B | 2,880,437 B | 36.3% |
| Landing collection + card back + Charizard slab | 15,244,715 B | 9,861,345 B | 35.3% |

For the landing asset group, a local gzip estimate is 12,351,575 → 8,371,477 bytes (32.2% lower). This estimate is not a measurement of Vercel/Firebase response compression. No Lighthouse, network-throttled timing or production Core Web Vitals result is claimed.

## Integrated reference mapping

- Active pack SVG paths stay the same; existing catalog/admin/default references continue to work.
- `assets/reveal/rippr-card-back.png` → `assets/reveal/rippr-card-back.webp` in opening, landing, homepage Community scene and offline preview export.
- `assets/landing/charizard-slab.png` → `assets/landing/charizard-slab.webp` in the landing hero.
- For embedded offline exports use `image/webp` MIME for the new card back.

## Verification

- Pillow decode: complete RGBA byte equality, including hidden transparent RGB values, for each source and optimized image.
- Pack outer SVG attributes are unchanged. Embedded sprite remains at the same coordinate system and dimensions.
- Chromium: optimized SVG/WebP assets decode successfully. Every alpha channel matches the original, so foil/shimmer outlines remain unchanged.
- Chromium draw-to-canvas on the site navy background: the RGB reveal back is exactly equal. Partially transparent pack/slab assets differ by at most one 8-bit RGB level (1/255), caused by PNG/WebP premultiplication rounding; fully opaque source pixels match. No visible composition or color change is intended. This is not described as byte-identical browser rendering.
- Local validation helpers: `/tmp/optimize-rippr-assets.py`, `/tmp/check-optimized-assets-composited-final.cjs` (require existing Pillow/Playwright/Chromium). These are diagnostic helpers, not CI dependencies.

## Remaining performance work

The five SVGs still each contain a complete sprite. A future individually cropped wrapper export could reduce duplicated unused image data further, but must prove exact pixel placement, alpha outline and foil-strip mapping before replacement. Keep that as a separate reviewed change.


## Repeated-opening motion pass

This later pass changes animation execution, not the asset encodings measured above.

- Removed inherited color interpolation that repainted full-screen gradients; rarity steps recolor the local card glow. Paused decorative SVG animations during opening and reduced redundant blur/shadow/blend layers.
- Replaced animated card height/top/left with a measured start/end transform/scale transition. The card retains the large suspense framing through the flip; labels/actions enter after it settles. No continuous layout tween is used.
- Foil polygon painting is coalesced to one frame, with target width measured at drag start. Completed peel effects, cancelled frames, pointer capture and removed reveal DOM are released between runs.
- One session-owned phase deadline pauses with visual effects while hidden or page-suspended. Skip/reset cancels old tasks. Up to two upcoming card images are warmed, and references clear when the batch ends.
- Audio sources/gains disconnect on stop, end or failure. One context is reused, decoding uses two workers, and hidden/pagehide suspends playback.

`opening-repeatability.cjs` exercises actual motion/foil/audio with local account fixtures across 29 batches and 83 awards at 320/390/1440px. It checks repeated 1/3/5-pack openings, skip/reset, pause/resume, start-geometry continuity and bounded DOM/animation/context/cache retention. `opening-resources.cjs` isolates coalesced painting, 25 peel cleanup cycles and 100 four-channel audio cycles, including failure/reset races. A separate geometry inspection covers 320/390/1440px portrait/desktop and 844×390 landscape. Reduced-motion reveal checks remain in the existing suite.

These checks establish bounded lifecycle behavior and layout continuity in local Chromium. They are not heap snapshots, real-device FPS measurements or production Core Web Vitals results.
