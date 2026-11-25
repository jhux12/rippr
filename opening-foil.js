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
    // One reusable textured ribbon, allocated once for every tier/batch.
    const ribbon=document.createElement('canvas');ribbon.className='foil-ribbon';ribbon.hidden=true;ribbon.setAttribute('aria-hidden','true');shell.insertBefore(ribbon,shell.querySelector('.rip-target'));
    const context=ribbon.getContext('2d'),texture=new Image();
    const source=artwork.style.backgroundImage||getComputedStyle(artwork).backgroundImage;
    const sourceURL=source.match(/^url\(["']?(.*?)["']?\)$/)?.[1];if(sourceURL)texture.src=sourceURL;
    let ribbonFrame=0,ribbonClock=null,variant='curved',ribbonPaint=-1,paintRibbonResume=null;
    const animations = new Set();
    let direction = 1, frame = 0, pendingProgress = 0, pendingDirection = 1;
    let lastProgress = -1, lastDirection = 0;
    shell.classList.add('has-physical-foil');
    function cancel() {
      cancelAnimationFrame(frame); frame = 0;
      cancelAnimationFrame(ribbonFrame);ribbonFrame=0;ribbonClock=null;paintRibbonResume=null;ribbon.hidden=true;
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
      variant=Math.random()<.5?'curved':'diagonal';shell.dataset.foilStyle=variant;
      setProgress(0, 1);
      // The empty clip hides the reset strip. Let the next drag own opacity,
      // instead of preserving an inline zero left by a completed release.
      piece.style.removeProperty('opacity');underlay.style.removeProperty('opacity');
    }
    function meshRelease(){
      if(!context||!texture.complete||!texture.naturalWidth||typeof ribbon.animate!=='function')return null;
      const bounds=shell.getBoundingClientRect(),w=shell.offsetWidth,h=shell.offsetHeight;
      if(!bounds.width||!w||!h)return null;
      const ratio=Math.min(devicePixelRatio||1,2);const width=Math.ceil(w*3*ratio),height=Math.ceil(h*.9*ratio);if(ribbon.width!==width)ribbon.width=width;if(ribbon.height!==height)ribbon.height=height;
      ribbon.hidden=false;ribbonPaint=-1;
      const clock=ribbon.animate([{opacity:1},{opacity:1}],{duration:640,fill:'forwards'});
      ribbonClock=clock;animations.add(clock);clock.finished.catch(()=>{});
      function done(){cancelAnimationFrame(ribbonFrame);ribbonFrame=0;ribbon.hidden=true;animations.delete(clock);if(ribbonClock===clock){ribbonClock=null;paintRibbonResume=null}clock.onfinish=null;clock.oncancel=null;clock.cancel()}
      clock.onfinish=done;clock.oncancel=done;
      function draw(){
        ribbonFrame=0;if(ribbonClock!==clock)return;
        const t=clamp(Number(clock.currentTime)/640);
        if(t!==ribbonPaint){
          ribbonPaint=t;context.setTransform(ratio,0,0,ratio,0,0);context.clearRect(0,0,w*3,h*.9);context.save();context.translate(w,h*.7);
          const smooth=x=>{x=clamp(x);return x*x*(3-2*x)},bend=smooth(t/.62),fly=smooth((t-.5)/.5),segments=64;
          context.globalAlpha=1-smooth((t-.75)/.25);
          for(let i=0;i<segments;i++){
            const u=(i+.5)/segments,a=u*Math.PI,pull=direction===1?u:1-u;
            let x=u*w,y=0,turn=0;
            if(variant==='curved'){
              x=(u-.5)*w*(1-.24*bend)+w/2+direction*fly*w*.4;
              y=-Math.sin(a)*h*.14*bend-fly*h*.52;
              turn=Math.atan2(-h*.14*Math.PI*Math.cos(a)*bend,w*(1-.24*bend))+direction*fly*.35;
            }else{
              x+=direction*(pull*pull*bend*w*.4+fly*w*.85);y-=Math.pow(pull,1.4)*bend*h*.22+fly*h*.35;
              turn=-direction*Math.atan(1.4*Math.pow(Math.max(.01,pull),.4)*bend*h*.22/w)+direction*fly*.2;
            }
            context.save();context.translate(x,y);context.rotate(turn);
            context.drawImage(texture,i*texture.width/segments,0,texture.width/segments,texture.height*seamHeight/100,-w/segments*.6,0,w/segments*1.2,h*seamHeight/100);context.restore();
          }
          context.restore();
        }
        if(!document.hidden)ribbonFrame=requestAnimationFrame(draw);
      }
      paintRibbonResume=draw;piece.style.opacity='0';underlay.style.opacity='0';draw();return 640;
    }
    // The opening controller pauses the WAAPI clock with the other stage effects.
    // Resume painting its current frame after a hidden tab returns.
    document.addEventListener('visibilitychange',()=>{if(!document.hidden&&ribbonClock&&!ribbonFrame)paintRibbonResume?.()});
    function release(instant = false) {
      cancel(); setProgress(1, direction);
      shell.classList.add('foil-detaching');
      function hideStrip() { piece.style.opacity = '0'; underlay.style.opacity = '0'; }
      if (instant || matchMedia('(prefers-reduced-motion: reduce)').matches || typeof piece.animate !== 'function' || typeof underlay.animate !== 'function') {
        hideStrip(); return 0;
      }
      try {
        const meshDelay=meshRelease();if(meshDelay!==null)return meshDelay;
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
