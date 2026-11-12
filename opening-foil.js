/* Foil geometry follows the source wrapper; no replacement product artwork. */
(() => {
  'use strict';
  const clamp = value => Math.max(0, Math.min(1, Number(value) || 0));
  const mounts = new WeakMap();
  function mount(shell) {
    if (mounts.has(shell)) return mounts.get(shell);
    const artwork = shell.querySelector('.pack.artwork');
    const piece = shell.querySelector('.foil-piece');
    const strip = shell.querySelector('.tear-strip');
    const layers = ['foil-underlay', 'foil-cut-edge', 'foil-crease'].map(name => {
      const element = document.createElement('span');
      element.className = name;
      element.setAttribute('aria-hidden', 'true');
      shell.insertBefore(element, shell.querySelector('.rip-target'));
      return element;
    });
    const [underlay, edge, crease] = layers;
    let direction = 1, animations = [], frame = 0, pendingProgress = 0, pendingDirection = 1;
    let lastProgress = -1, lastDirection = 0;
    shell.classList.add('has-physical-foil');
    function cancel() {
      cancelAnimationFrame(frame); frame = 0;
      animations.forEach(animation => { animation.onfinish = null; animation.oncancel = null; animation.cancel(); });
      animations = [];
      shell.classList.remove('foil-detaching');
    }
    function paint(progress, from) {
      direction = from < 0 ? -1 : 1;
      if (progress === lastProgress && direction === lastDirection) return;
      lastProgress = progress; lastDirection = direction;
      const percent = progress * 100;
      const sign = direction;
      const mapX = x => direction === 1 ? x : 100 - x;
      // Irregular fibers stay attached to the unpeeled wrapper, not a straight crop.
      const seam = [];
      const steps = Math.max(1, Math.ceil(percent / 2.4));
      for (let i = 0; i <= steps; i++) {
        const x = percent * i / steps;
        const y = 9 + [0, -.30, .42, -.13, .24, -.36, .12][i % 7];
        seam.push(`${mapX(x).toFixed(3)}% ${y.toFixed(2)}%`);
      }
      if (progress === 0) artwork.style.clipPath = 'none';
      else artwork.style.clipPath = `polygon(${seam.join(',')},${mapX(percent)}% 0,${mapX(100)}% 0,${mapX(100)}% 100%,${mapX(0)}% 100%)`;
      const peeled = `polygon(${mapX(0)}% 0,${mapX(percent)}% 0,${[...seam].reverse().join(',')})`;
      piece.style.clipPath = peeled;
      underlay.style.clipPath = peeled;
      shell.style.setProperty('--foil-progress', progress);
      shell.style.setProperty('--foil-tip', mapX(percent) + '%');
      shell.style.setProperty('--foil-hinge', mapX(percent) + '% 9%');
      shell.style.setProperty('--foil-turn', sign * (progress * 15) + 'deg');
      shell.style.setProperty('--foil-twist', sign * progress * 5 + 'deg');
      shell.style.setProperty('--foil-pull-x', sign * -progress * 1.3 + '%');
      shell.style.setProperty('--foil-pull-y', -progress * 2.2 + '%');
      shell.dataset.foilDirection = direction === 1 ? 'right' : 'left';
      // This narrow reflected edge tracks the tear without covering the artwork.
      edge.style.left = direction === 1 ? '1%' : (100 - percent) + '%';
      edge.style.width = Math.max(0, percent - 1) + '%';
      edge.style.opacity = progress === 0 ? '0' : '1';
      crease.style.left = `calc(${mapX(percent)}% - 8px)`;
      crease.style.opacity = progress > 0 && progress < 1 ? String(.38 + progress * .3) : '0';
      if (strip) strip.style.opacity = '0';
    }
    function flush() {
      cancelAnimationFrame(frame); frame = 0;
      paint(pendingProgress, pendingDirection);
    }
    function setProgress(value, from = direction) {
      pendingProgress = clamp(value); pendingDirection = from < 0 ? -1 : 1;
      // Pointer events can arrive faster than display refresh. Geometry is only
      // rebuilt once per frame; reset/release boundaries always paint immediately.
      if (pendingProgress === 0 || pendingProgress === 1) flush();
      else if (!frame) frame = requestAnimationFrame(() => { frame = 0; paint(pendingProgress, pendingDirection); });
    }
    function reset() {
      cancel();
      piece.style.removeProperty('opacity'); underlay.style.removeProperty('opacity');
      lastProgress = -1; lastDirection = 0;
      setProgress(0, 1);
    }
    function release(instant = false) {
      cancel();
      setProgress(1, direction);
      if (instant || matchMedia('(prefers-reduced-motion: reduce)').matches) {
        piece.style.opacity = '0'; underlay.style.opacity = '0';
        shell.classList.add('foil-detaching');
        return 0;
      }
      // Release stored tension, then let the lightweight strip rotate and fall.
      const start = getComputedStyle(piece).transform;
      const keyframes = [
        {transform:start,opacity:1,offset:0},
        {transform:`translate(${-direction * 9}%, -5%) rotate(${direction * 23}deg)`,opacity:1,offset:.24},
        {transform:`translate(${-direction * 24}%, -11%) rotate(${direction * 39}deg)`,opacity:.92,offset:.64},
        {transform:`translate(${-direction * 35}%, 8%) rotate(${direction * 58}deg)`,opacity:0,offset:1}
      ];
      for (const layer of [piece, underlay]) {
        const animation = layer.animate(keyframes, {duration:580,easing:'cubic-bezier(.2,.65,.3,1)',fill:'forwards'});
        animations.push(animation);
        animation.onfinish = () => {
          // Release completed compositing effects instead of keeping fill layers
          // attached to the pack for the rest of a multi-pack opening.
          layer.style.opacity = '0'; animation.onfinish = null; animation.oncancel = null;
          animations = animations.filter(active => active !== animation);
          animation.cancel();
        };
        animation.oncancel = () => {
          animation.onfinish = null; animation.oncancel = null;
          animations = animations.filter(active => active !== animation);
        };
      }
      edge.style.opacity = '.4';
      shell.classList.add('foil-detaching');
      return 580;
    }
    reset();
    const api = {setProgress, reset, release, cancel};
    mounts.set(shell, api);
    return api;
  }
  window.RipprFoil = {mount};
})();
