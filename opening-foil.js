/* A small foil rig made from the original wrapper, not replacement artwork. */
(() => {
  'use strict';
  const clamp = value => Math.max(0, Math.min(1, Number(value) || 0));
  const mounts = new WeakMap();
  const seamHeight = 9.15;
  // Fixed fibers do not crawl/flicker as the pointer advances across the seal.
  const fibers = [0, -.18, .24, -.10, .30, -.22, .12, -.28, .18, -.08, .26, -.20, .11, -.26, .22, -.07, .16, -.19, .04];
  function seamY(x) {
    const position = x * 18 / 100, index = Math.min(17, Math.floor(position));
    const fraction = position - index;
    return seamHeight + fibers[index] * (1 - fraction) + fibers[index + 1] * fraction;
  }
  function mount(shell) {
    if (!shell) return null;
    if (mounts.has(shell)) return mounts.get(shell);
    const artwork = shell.querySelector('.pack.artwork'), piece = shell.querySelector('.foil-piece');
    if (!artwork || !piece) return null;
    const strip = shell.querySelector('.tear-strip');
    const layers = ['foil-underlay', 'foil-cut-edge', 'foil-crease', 'foil-mouth', 'foil-inner-lip'].map(name => {
      const element = document.createElement('span');
      element.className = name;
      element.setAttribute('aria-hidden', 'true');
      shell.insertBefore(element, shell.querySelector('.rip-target'));
      return element;
    });
    const [underlay, edge, crease, mouth, lip] = layers;
    const animations = new Set();
    let direction = 1, frame = 0, pendingProgress = 0, pendingDirection = 1;
    let lastProgress = -1, lastDirection = 0;
    shell.classList.add('has-physical-foil');
    function cancel() {
      cancelAnimationFrame(frame); frame = 0;
      for (const animation of animations) {
        animation.onfinish = null; animation.oncancel = null; animation.cancel();
      }
      animations.clear();
      shell.classList.remove('foil-detaching');
    }
    function paint(progress, from) {
      direction = from < 0 ? -1 : 1;
      if (progress === lastProgress && direction === lastDirection) return;
      lastProgress = progress; lastDirection = direction;
      const percent = progress * 100, mapX = x => direction === 1 ? x : 100 - x;
      const seam = [];
      for (let i = 0; i <= 18; i++) {
        const x = i * 100 / 18;
        if (x >= percent) break;
        seam.push(`${mapX(x).toFixed(3)}% ${seamY(x).toFixed(3)}%`);
      }
      seam.push(`${mapX(percent).toFixed(3)}% ${seamY(percent).toFixed(3)}%`);
      artwork.style.clipPath = progress === 0 ? 'none' : `polygon(${seam.join(',')},${mapX(percent)}% 0,${mapX(100)}% 0,${mapX(100)}% 100%,${mapX(0)}% 100%)`;
      const peeled = progress === 0 ? 'inset(0 100% 100% 0)' : `polygon(${mapX(0)}% 0,${mapX(percent)}% 0,${[...seam].reverse().join(',')})`;
      piece.style.clipPath = peeled; underlay.style.clipPath = peeled;
      piece.style.opacity = progress > 0 ? '1' : '0';
      underlay.style.opacity = String(Math.min(.92, progress * 1.8));
      const tension = Math.sin(progress * Math.PI);
      shell.style.setProperty('--foil-progress', progress);
      shell.style.setProperty('--foil-tip', mapX(percent) + '%');
      shell.style.setProperty('--foil-hinge', `${mapX(percent)}% ${seamY(percent).toFixed(3)}%`);
      shell.style.setProperty('--foil-turn', direction * (progress * 19 + tension * 5) + 'deg');
      shell.style.setProperty('--foil-curl', -(progress * 34 + tension * 17) + 'deg');
      shell.style.setProperty('--foil-twist', direction * tension * 2.5 + 'deg');
      shell.style.setProperty('--foil-pull-x', direction * progress * 1.5 + '%');
      shell.style.setProperty('--foil-pull-y', -(progress * 2.1 + tension * 1.5) + '%');
      shell.style.setProperty('--foil-body-turn', -direction * tension * .7 + 'deg');
      shell.style.setProperty('--foil-body-x', direction * tension * .45 + '%');
      shell.style.setProperty('--foil-body-scale', 1 - tension * .006);
      shell.dataset.foilDirection = direction === 1 ? 'right' : 'left';
      const revealed = direction === 1 ? `inset(0 ${100 - percent}% 0 0)` : `inset(0 0 0 ${100 - percent}%)`;
      mouth.style.clipPath = revealed; lip.style.clipPath = revealed;
      mouth.style.opacity = String(Math.min(.94, progress * 1.9));
      lip.style.opacity = String(Math.min(.9, progress * 1.8));
      edge.style.left = direction === 1 ? '2.5%' : (100 - percent + 2.5) + '%';
      edge.style.width = Math.max(0, percent * .95) + '%';
      edge.style.opacity = progress > 0 ? '.92' : '0';
      crease.style.left = `calc(${mapX(percent)}% - 9px)`;
      crease.style.opacity = progress > 0 && progress < 1 ? String(.32 + tension * .4) : '0';
      if (strip) strip.style.opacity = '0';
    }
    function flush() {
      cancelAnimationFrame(frame); frame = 0;
      paint(pendingProgress, pendingDirection);
    }
    function setProgress(value, from = direction) {
      pendingProgress = clamp(value); pendingDirection = from < 0 ? -1 : 1;
      // Pointer events may outpace refresh. Rebuild the bounded seam at most once
      // per frame; reset and release boundaries still paint immediately.
      if (pendingProgress === 0 || pendingProgress === 1) flush();
      else if (!frame) frame = requestAnimationFrame(() => { frame = 0; paint(pendingProgress, pendingDirection); });
    }
    function reset() {
      cancel(); lastProgress = -1; lastDirection = 0;
      setProgress(0, 1);
      // The empty clip hides the reset strip. Let the next drag own opacity,
      // instead of preserving an inline zero left by a completed release.
      piece.style.removeProperty('opacity');underlay.style.removeProperty('opacity');
    }
    function release(instant = false) {
      cancel(); setProgress(1, direction);
      shell.classList.add('foil-detaching');
      function hideStrip() { piece.style.opacity = '0'; underlay.style.opacity = '0'; }
      if (instant || matchMedia('(prefers-reduced-motion: reduce)').matches || typeof piece.animate !== 'function' || typeof underlay.animate !== 'function') {
        hideStrip(); return 0;
      }
      try {
        for (const layer of [piece, underlay]) {
          const metal = layer === underlay;
          const animation = layer.animate([
            {transform:getComputedStyle(layer).transform,opacity:metal ? .92 : 1},
            {transform:`translate3d(${-direction * 2}%, -6%, 5px) rotateZ(${direction * 23}deg) rotateX(-62deg)`,opacity:metal ? 1 : .95,offset:.22},
            {transform:`translate3d(${direction * 7}%, -10%, 10px) rotateZ(${direction * 31}deg) rotateX(-105deg)`,opacity:metal ? .94 : 0,offset:.62},
            {transform:`translate3d(${direction * 23}%, 6%, 4px) rotateZ(${direction * 52}deg) rotateX(-128deg)`,opacity:0}
          ], {duration:480,easing:'cubic-bezier(.22,.6,.35,1)',fill:'forwards'});
          animations.add(animation);animation.finished.catch(()=>{});
          animation.onfinish = () => {
            layer.style.opacity = '0'; animation.onfinish = null; animation.oncancel = null;
            animations.delete(animation);animation.cancel();
          };
          animation.oncancel = () => {
            animation.onfinish = null; animation.oncancel = null;animations.delete(animation);
          };
        }
      } catch {
        cancel();shell.classList.add('foil-detaching');hideStrip();return 0;
      }
      return 480;
    }
    reset();
    const api = {setProgress, flush, reset, release, cancel};
    mounts.set(shell, api);return api;
  }
  window.RipprFoil = {mount};
})();
