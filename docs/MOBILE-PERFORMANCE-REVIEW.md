# Opening lifecycle and mobile performance review

Review date: November 13, 2026 (Indianapolis). This is a local Chromium fixture review of the current implementation, not production telemetry or a measured physical-phone frame-rate claim. No Firebase accounts, real purchases or payments were changed.

## Scope

- Repeated one-, three- and five-pack openings at 320, 390 and 1440px.
- Actual foil, extraction, rarity cycling, flip and shipped audio scripts.
- Batch-wide skip, restart, hidden tab, page suspension and resume.
- Image CDN errors, invalid image bytes, retry and removed-image cleanup.
- Inspection of preloads, decoded audio reuse and stage animation lifecycle.

## Findings

The implementation already limits predecoded card artwork to the current and next cards. Audio decoding uses two workers and one reused audio context; stopped sources and gain nodes disconnect. Foil pointer changes coalesce into one paint per animation frame. Reset removes reveal actors, clears phase timers and preload references, and cancels scripted effects. Ambient animations pause outside the visible stage or while navigation overlays are open. Reduced motion remains supported.

Lifecycle resource tests verify 25 foil peel cleanups and 100 four-channel audio cycles, including failed-load retries, gesture activation, interrupted audio, mute and page restore. Audio signal checks verify actual WAV decoding and nonzero Web Audio output; they do not prove speaker output on every device.

Repeat tests compare idle DOM, active scripted effects, foil layers, pending phase work, warmed card references and audio-context counts after each batch. They also check that card geometry does not jump when the reveal settles, and that hidden-tab skip/reset does not freeze later ambient motion.

The largest source PNGs are not automatically the downloaded assets: for example, the reveal uses its WebP variant and the homepage hero uses optimized variants. No speculative visual changes or image substitutions were made. The reveal back WebP is still about 1.6 MB, so initial uncached network transfer remains a candidate for later asset optimization. Existing desktop-style artwork should be compared visually before replacing it.

## Limits and remaining checks

Fixture requests are deterministic. A real iPhone Safari and a midrange Android device should still be checked for uncached image loading, silent-mode/audio interruption, thermal throttling and battery behavior. A production performance recording is needed to make an FPS or Core Web Vitals claim. No leak or reproducible lifecycle regression was found in the checks listed here; that does not establish that every device or production session is lag-free.

## Verified run

- 320px: 7 batches / 21 cards with repeated batch skip and reset.
- 390px: 11 batches / 31 cards with real motion and visibility/page suspension.
- 1440px: 11 batches / 31 cards with real motion and visibility/page suspension.
- Total: 29 batches / 83 cards. No duplicate fixture purchases or awards; reset retained bounded DOM, effects, artwork references and audio contexts.
- Image recovery passed at all three widths, including network/decode failures, bounded automatic retries, manual recovery, unchanged account actions/selection, signed URL preservation, source replacement/removal and hidden-tab recovery.

No runtime changes or Firebase deployment were needed for this review.
