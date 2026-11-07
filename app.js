(() => {
  'use strict';
  const packs = window.RIPPR_PACKS;
  const grid = document.querySelector('#pack-grid');
  const carousel = document.querySelector('#pack-carousel');
  const status = document.querySelector('#catalog-status');
  const toggle = document.querySelector('#rotation-toggle');
  const modal = document.querySelector('#modal');
  const content = document.querySelector('#modal-content');
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  let current = 0, paused = motion.matches, hovered = false, timer, returnFocus;
  let navigationBusy = false;
  const selectors = document.querySelector('#tier-selectors');
  packs.forEach((pack, i) => {
    const card = document.createElement('article');
    card.className = 'tier-slide';
    card.style.setProperty('--accent', pack.accent);
    card.setAttribute('role', 'group');
    card.setAttribute('aria-roledescription', 'slide');
    card.setAttribute('aria-label', `${i+1} of ${packs.length}: ${pack.name}`);
    card.innerHTML = `<button type="button" class="tier-art" aria-label="Select ${pack.name}"><img src="${pack.image}" alt="Pokémon-themed ${pack.name} rippr pack" width="250" height="390"></button><div class="tier-info"><p class="tier-number">TIER 0${pack.tier}</p><h3>${pack.name}</h3><p class="tier-card-count"><span class="tier-price" hidden></span><span>1 card</span></p><a class="view-pack" href="opening.html?pack=${pack.id}">View pack <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 12 12 4M4 4h8v8"/></svg></a></div>`;
    card.querySelector('button').addEventListener('click', () => move(i, true));
    grid.append(card);
    const button = document.createElement('button');
    button.type = 'button'; button.textContent = pack.name;
    button.addEventListener('click', () => move(i, true));
    selectors.append(button);
  });
  const slides = [...grid.children], tierButtons = [...selectors.children];
  if (!window.RIPPR_AUTH_OFFLINE && window.RipprFirebase?.loadPackContents) {
    const money = new Intl.NumberFormat('en-US', { style:'currency', currency:'USD' });
    packs.forEach((pack, index) => {
      window.RipprFirebase.loadPackContents(pack.id).then(saved => {
        const price = slides[index].querySelector('.tier-price');
        if (Number.isSafeInteger(saved.priceCents) && saved.priceCents >= 0) {
          price.textContent = money.format(saved.priceCents / 100); price.hidden = false;
        }
      }).catch(() => {});
    });
  }
  function schedule() {
    clearInterval(timer);
    toggle.textContent = paused ? 'Play' : 'Pause';
    toggle.setAttribute('aria-label', paused ? 'Start rotation' : 'Pause rotation');
    status.setAttribute('aria-live', paused ? 'polite' : 'off');
    if (!paused && !hovered && !document.hidden && !modal.open && !navigationBusy) timer = setInterval(() => move(current + 1), 4500);
  }
  function move(index, manual = false) {
    current = (index + packs.length) % packs.length;
    slides.forEach((slide, i) => {
      const offset = ((i-current+packs.length+2)%packs.length)-2;
      slide.style.setProperty('--offset', offset);
      slide.dataset.distance = Math.abs(offset);
      slide.classList.toggle('is-active', offset === 0);
      slide.setAttribute('aria-hidden', String(offset !== 0));
      slide.inert = offset !== 0;
      slide.querySelector('button').tabIndex = -1;
    });
    tierButtons.forEach((button, i) => button.setAttribute('aria-pressed', String(i === current)));
    carousel.style.setProperty('--accent', packs[current].accent);
    status.textContent = `${packs[current].name}, tier ${current+1} of ${packs.length}, one card per pack`;
    if (manual) paused = true;
    schedule();
  }
  document.querySelector('#previous-pack').addEventListener('click', () => move(current-1, true));
  document.querySelector('#next-pack').addEventListener('click', () => move(current+1, true));
  toggle.addEventListener('click', () => { paused = !paused; schedule(); });
  carousel.addEventListener('pointerenter', () => { hovered = true; schedule(); });
  carousel.addEventListener('pointerleave', () => { hovered = false; schedule(); });
  carousel.addEventListener('focusin', () => { paused = true; schedule(); });
  carousel.addEventListener('keydown', event => {
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      event.preventDefault(); move(current + (event.key === 'ArrowRight' ? 1 : -1), true);
    }
  });
  let touchStart;
  carousel.addEventListener('touchstart', event => { touchStart = {x:event.touches[0].clientX,y:event.touches[0].clientY}; }, {passive:true});
  carousel.addEventListener('touchend', event => {
    if (!touchStart) return;
    const dx = event.changedTouches[0].clientX-touchStart.x, dy = event.changedTouches[0].clientY-touchStart.y;
    if (Math.abs(dx)>45 && Math.abs(dx)>Math.abs(dy)) move(current + (dx<0?1:-1), true);
    touchStart = null;
  }, {passive:true});
  document.addEventListener('visibilitychange', schedule);
  motion.addEventListener('change', () => { if(motion.matches) paused = true; schedule(); });
  move(0);

  const hero = document.querySelector('.hero');
  const heroDots = document.querySelector('#hero-dots');
  const heroRotation = document.querySelector('#hero-rotation');
  const heroStatus = document.querySelector('#hero-status');
  const banners = [
    {title:'Your next great pull.',copy:'One pack. One card. Something unexpected.',cta:'Explore packs',href:'#packs',art:['plus','ultimate','premium']},
    {title:'Start your collection.',copy:'A little curiosity starts with Basic.',cta:'Explore Basic',href:'opening.html?pack=basic',art:['plus','premium','basic']},
    {title:'Find your next favorite.',copy:'Discover Plus, Premium, and Elite.',cta:'Explore tiers',href:'#packs',art:['plus','elite','premium']},
    {title:'Aim a little higher.',copy:'Meet Ultimate. Our highest tier.',cta:'View Ultimate',href:'opening.html?pack=ultimate',art:['premium','elite','ultimate']}
  ];
  let heroIndex=0, heroPaused=motion.matches, heroHovered=false, heroTimer;
  banners.forEach((banner,i)=>{
    const button=document.createElement('button');button.type='button';
    button.setAttribute('aria-label',`Banner ${i+1}: ${banner.title}`);
    button.addEventListener('click',()=>changeHero(i,true));heroDots.append(button);
  });
  function heroSchedule(){
    clearInterval(heroTimer);
    hero.classList.toggle('is-paused',heroPaused||heroHovered||document.hidden||modal.open||navigationBusy);
    heroRotation.textContent=heroPaused?'Play':'Pause';
    heroRotation.setAttribute('aria-label',heroPaused?'Play banners':'Pause banners');
    heroStatus.setAttribute('aria-live',heroPaused?'polite':'off');
    if(!heroPaused&&!heroHovered&&!document.hidden&&!modal.open&&!navigationBusy)heroTimer=setInterval(()=>changeHero(heroIndex+1),6500);
  }
  function changeHero(index,manual=false){
    heroIndex=(index+banners.length)%banners.length;const banner=banners[heroIndex];
    document.querySelector('#hero-title').textContent=banner.title;
    hero.querySelector('.hero-copy p').textContent=banner.copy;
    const cta=document.querySelector('#hero-cta');cta.textContent=banner.cta;cta.setAttribute('href',banner.href);
    ['left','right','center'].forEach((position,i)=>{hero.querySelector(`.hero-pack-${position}`).src=packs.find(pack=>pack.id===banner.art[i]).image});
    [...heroDots.children].forEach((button,i)=>button.setAttribute('aria-pressed',String(i===heroIndex)));
    heroStatus.textContent=`Banner ${heroIndex+1} of ${banners.length}: ${banner.title}`;
    hero.classList.remove('hero-enter');void hero.offsetWidth;hero.classList.add('hero-enter');
    if(manual)heroPaused=true;heroSchedule();
  }
  document.querySelector('#hero-previous').addEventListener('click',()=>changeHero(heroIndex-1,true));
  document.querySelector('#hero-next').addEventListener('click',()=>changeHero(heroIndex+1,true));
  heroRotation.addEventListener('click',()=>{heroPaused=!heroPaused;heroSchedule()});
  hero.addEventListener('pointerenter',()=>{heroHovered=true;heroSchedule()});
  hero.addEventListener('pointerleave',()=>{heroHovered=false;heroSchedule()});
  hero.addEventListener('focusin',event=>{if(event.target!==heroRotation){heroPaused=true;heroSchedule()}});
  document.addEventListener('visibilitychange',heroSchedule);
  motion.addEventListener('change',()=>{if(motion.matches)heroPaused=true;heroSchedule()});
  changeHero(0);
  document.addEventListener('rippr:navigationchange', event => {
    navigationBusy = Boolean(event.detail.menuOpen || event.detail.dialogOpen);
    schedule();
    heroSchedule();
  });

  function show(html, trigger) {
    returnFocus = trigger;
    content.innerHTML = html;
    modal.showModal();
    schedule();
    heroSchedule();
  }
  function close() { modal.close(); }
  modal.querySelector('.modal-close').addEventListener('click', close);
  modal.addEventListener('close', () => { returnFocus?.focus({ preventScroll: true }); schedule(); heroSchedule(); });
  modal.addEventListener('click', event => {
    if (event.target !== modal) return;
    const r = modal.getBoundingClientRect();
    if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) close();
  });

  document.querySelectorAll('[data-dialog]').forEach(button => button.addEventListener('click', () => {
    if (button.dataset.dialog === 'how') {
      show('<div class="modal-kicker">ONE PACK. ONE CARD.</div><h2 id="modal-title">How it works</h2><ol><li>Choose a pack.</li><li>Select how many to open.</li><li>Reveal one concept card per pack.</li></ol><p>Openings are free demos. No purchase, real-world items, or monetary value.</p><button class="primary-button" data-explore>Explore packs</button>', button);
    } else if (button.dataset.dialog === 'collection') {
      show(`<h2 id="modal-title">Your collection</h2><div class="collection-empty"><img class="pip-mascot pip-empty" src="${window.RIPPR_MASCOT_URLS?.hover||'assets/mascot/pip-hover.png'}" alt="" width="82" height="82"><p>A little room for discovery.</p></div><p>Saved collections are coming soon. For now, enjoy a demo opening and view your cards at the end.</p><button class="primary-button" data-explore>Explore packs</button>`, button);
    } else {
      location.href = 'auth.html?mode=login';
      return;
    }
    content.querySelector('[data-explore]').addEventListener('click', () => {
      close();
      document.querySelector('#packs').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
    });
  }));

  const grails = {
    'first-light': { name: 'First Light', image: 'assets/grail-first-light.svg' },
    'ocean-spirit': { name: 'Ocean Spirit', image: 'assets/grail-ocean-spirit.svg' },
    moonstone: { name: 'Moonstone', image: 'assets/grail-moonstone.svg' }
  };
  document.querySelectorAll('[data-grail]').forEach(button => button.addEventListener('click', () => {
    const grail = grails[button.dataset.grail];
    show(`<div class="modal-kicker">GRAIL PREVIEW</div><h2 id="modal-title">${grail.name}</h2><img class="modal-grail" src="${grail.image}" alt="${grail.name} concept card"><p>Original concept artwork. Demo preview only.</p>`, button);
  }));
})();
