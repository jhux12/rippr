(() => {
  'use strict';
  const modal = document.querySelector('#modal');
  const content = document.querySelector('#modal-content');
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  let returnFocus, navigationBusy = false;
  // Pack selection is handled by the nonrotating vending-machine component.
  function schedule() {}

  const hero = document.querySelector('.hero');
  const heroDots = document.querySelector('#hero-dots');
  const heroRotation = document.querySelector('#hero-rotation');
  const heroStatus = document.querySelector('#hero-status');
  const banners = [
    {title:'Your next great pull.',cta:'Explore packs',href:'#packs',scene:'signature'},
    {title:'A little spark. More discovery.',cta:'View rewards',href:'rewards.html',scene:'daily-discovery'},
    {title:'Find your next favorite.',cta:'Discover grails',href:'#grails-title',scene:'grail-gallery'},
    {title:'A collection worth sharing.',cta:'Explore Community',href:'community.html',scene:'community'},
    {title:'Meet Icy Rush.',cta:'View limited packs',href:'#packs',scene:'icy-rush',collection:'limited'}
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
    const cta=document.querySelector('#hero-cta');cta.textContent=banner.cta;cta.setAttribute('href',banner.href);
    hero.dataset.hero=banner.scene;
    hero.querySelectorAll('.hero-scene').forEach(scene=>{const active=scene.dataset.scene===banner.scene;scene.hidden=!active;if(active)scene.querySelectorAll('img').forEach(image=>image.loading='eager')});
    // Warm only the next scene so rotation does not flash on a slow connection.
    const nextScene=banners[(heroIndex+1)%banners.length].scene;
    hero.querySelector(`[data-scene="${nextScene}"]`).querySelectorAll('img').forEach(image=>image.loading='eager');
    [...heroDots.children].forEach((button,i)=>button.setAttribute('aria-pressed',String(i===heroIndex)));
    heroStatus.textContent=`Banner ${heroIndex+1} of ${banners.length}: ${banner.title}`;
    hero.classList.remove('hero-enter');void hero.offsetWidth;hero.classList.add('hero-enter');
    if(manual)heroPaused=true;heroSchedule();
  }
  document.querySelector('#hero-previous').addEventListener('click',()=>changeHero(heroIndex-1,true));
  document.querySelector('#hero-next').addEventListener('click',()=>changeHero(heroIndex+1,true));
  document.querySelector('#hero-cta').addEventListener('click',()=>{
    if(banners[heroIndex].collection)document.querySelector(`[data-collection="${banners[heroIndex].collection}"]`).click();
  });
  hero.addEventListener('keydown',event=>{
    if(event.key==='ArrowRight'||event.key==='ArrowLeft'){
      event.preventDefault();changeHero(heroIndex+(event.key==='ArrowRight'?1:-1),true);
    }
  });
  let heroTouch;
  hero.addEventListener('touchstart',event=>{heroTouch={x:event.touches[0].clientX,y:event.touches[0].clientY};},{passive:true});
  hero.addEventListener('touchend',event=>{
    if(!heroTouch)return;
    const dx=event.changedTouches[0].clientX-heroTouch.x,dy=event.changedTouches[0].clientY-heroTouch.y;
    if(Math.abs(dx)>40&&Math.abs(dx)>Math.abs(dy))changeHero(heroIndex+(dx<0?1:-1),true);
    heroTouch=null;
  },{passive:true});
  hero.addEventListener('touchcancel',()=>{heroTouch=null;},{passive:true});
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
    scheduleGrails();
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
      show('<div class="modal-kicker">ONE PACK. ONE CARD.</div><h2 id="modal-title">How it works</h2><ol><li>Add site credit through secure Stripe Checkout.</li><li>Open a pack using your balance.</li><li>Reveal one card per pack, saved to your items.</li></ol><p>One card per pack. Sellback adds site credit; no cash withdrawals.</p><button class="primary-button" data-explore>Explore packs</button>', button);
    } else if (button.dataset.dialog === 'collection') {
      location.href='profile.html'; return;
    } else {
      location.href='auth.html?mode=login&next='+encodeURIComponent(location.pathname+location.search+location.hash);
      return;
    }
    content.querySelector('[data-explore]').addEventListener('click', () => {
      close();
      document.querySelector('#packs').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
    });
  }));

  const grailGrid = document.querySelector('#homepage-grails');
  const grailSection=grailGrid.closest('.grails'),grailMotion=matchMedia('(prefers-reduced-motion: reduce)');
  let grailPaused=grailMotion.matches,grailHover=false,grailFocus=false,grailVisible=true,grailTimer=null;
  const grailToggle=document.querySelector('#home-grail-toggle');
  function stopGrailTimer(){clearTimeout(grailTimer);grailTimer=null}
  function scheduleGrails(){
    stopGrailTimer();const overflow=grailGrid.scrollWidth>grailGrid.clientWidth+2;
    document.querySelector('.homepage-grail-controls').hidden=!overflow;
    grailToggle.textContent=grailPaused?'Play':'Pause';grailToggle.setAttribute('aria-label',grailPaused?'Start grail rotation':'Pause grail rotation');
    if(overflow&&!grailPaused&&!grailHover&&!grailFocus&&grailVisible&&!document.hidden&&!modal.open&&!navigationBusy){grailTimer=setTimeout(()=>{const max=grailGrid.scrollWidth-grailGrid.clientWidth;if(grailGrid.scrollLeft>=max-2)grailGrid.scrollTo({left:0,behavior:'instant'});else moveGrails(1);scheduleGrails()},5000)}
  }
  function moveGrails(direction){const card=grailGrid.querySelector('.grail-preview');if(!card)return;const unit=card.getBoundingClientRect().width+(parseFloat(getComputedStyle(grailGrid).gap)||0),max=grailGrid.scrollWidth-grailGrid.clientWidth;let target=grailGrid.scrollLeft+direction*unit;if(target>max+2)target=0;if(target< -2)target=max;grailGrid.scrollTo({left:Math.max(0,Math.min(max,target)),behavior:grailMotion.matches?'instant':'smooth'})}
  document.querySelector('#home-grail-prev').addEventListener('click',()=>{grailPaused=true;moveGrails(-1);scheduleGrails()});
  document.querySelector('#home-grail-next').addEventListener('click',()=>{grailPaused=true;moveGrails(1);scheduleGrails()});
  grailToggle.addEventListener('click',()=>{grailPaused=!grailPaused;scheduleGrails()});
  grailSection.addEventListener('pointerenter',()=>{grailHover=true;scheduleGrails()});grailSection.addEventListener('pointerleave',()=>{grailHover=false;scheduleGrails()});
  grailSection.addEventListener('focusin',()=>{grailFocus=true;scheduleGrails()});grailSection.addEventListener('focusout',event=>{if(!grailSection.contains(event.relatedTarget)){grailFocus=false;scheduleGrails()}});
  grailGrid.addEventListener('pointerdown',()=>{grailPaused=true;scheduleGrails()});grailGrid.addEventListener('keydown',event=>{if(event.target===grailGrid&&['ArrowLeft','ArrowRight'].includes(event.key)){event.preventDefault();grailPaused=true;moveGrails(event.key==='ArrowLeft'?-1:1);scheduleGrails()}});
  grailMotion.addEventListener('change',()=>{if(grailMotion.matches)grailPaused=true;scheduleGrails()});document.addEventListener('visibilitychange',scheduleGrails);
  document.addEventListener('rippr:navigationchange',()=>scheduleGrails());modal.addEventListener('close',scheduleGrails);
  if('IntersectionObserver' in window)new IntersectionObserver(entries=>{grailVisible=entries[0].isIntersecting;scheduleGrails()},{threshold:.1}).observe(grailSection);
  new ResizeObserver(scheduleGrails).observe(grailGrid);window.addEventListener('pagehide',stopGrailTimer);window.addEventListener('pageshow',scheduleGrails);
  const grailMoney = new Intl.NumberFormat('en-US', {style:'currency',currency:'USD'});
  const escapeHTML = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const grailImage = image => window.RIPPR_ASSET_URLS?.[image] || image;
  let homepageGrails = [], grailSource = 'default';
  function grailStatus(message,retry=false) {
    homepageGrails = [];
    const panel=document.createElement('div');panel.className='brand-state brand-state--quiet';panel.setAttribute('role','status');
    const image=document.createElement('img');image.src=window.RIPPR_MASCOT_URLS?.hover||'assets/hero/pip-hover.webp';image.alt='';image.width=76;image.height=76;
    const title=document.createElement('h3');title.textContent=message;
    const copy=document.createElement('p');copy.textContent=retry?'Please try again to see the featured cards.':'A new lineup is on its way.';panel.append(image,title,copy);
    if(retry){const button=document.createElement('button');button.type='button';button.className='primary-button';button.textContent='Try again';button.addEventListener('click',()=>{button.disabled=true;button.setAttribute('aria-busy','true');button.textContent='Loading…';loadHomepageGrails()});panel.append(button)}
    grailGrid.replaceChildren(panel);grailGrid.setAttribute('aria-busy','false');scheduleGrails();
  }
  function renderHomepageGrails(saved) {
    const catalog = window.RipprCatalog;
    if (catalog.validateHomepageGrails(saved).length) throw new Error('Invalid homepage grails');
    homepageGrails = saved.items; grailSource = saved.source || 'firebase';
    if (!homepageGrails.length) { grailStatus('Grails coming soon.'); return; }
    const fragment = document.createDocumentFragment();
    homepageGrails.forEach((grail,index) => {
      const button = document.createElement('button'); button.type = 'button'; button.className = 'grail-preview'; button.dataset.grail = String(index);
      button.setAttribute('aria-label',`Preview ${grail.name}, ${grailMoney.format(grail.valueCents / 100)}`);
      const art = document.createElement('span'); art.className = 'homepage-grail-art';
      const image = document.createElement('img'); image.src = grailImage(grail.image); image.alt = grail.name; image.loading = 'lazy'; image.decoding = 'async';
      image.addEventListener('error', () => { image.hidden = true; const fallback = document.createElement('span'); fallback.className = 'homepage-grail-fallback'; fallback.textContent = 'Image unavailable'; art.append(fallback); }, {once:true});
      art.append(image);
      const name = document.createElement('span'); name.className = 'homepage-grail-name'; name.textContent = grail.name; name.title = grail.name;
      const value = document.createElement('span'); value.className = 'homepage-grail-value'; value.textContent = grailMoney.format(grail.valueCents / 100);
      const condition=document.createElement('span');condition.className='condition-badge';condition.textContent=window.RipprCatalog.conditionLabel(grail);button.append(art,name,value,condition); fragment.append(button);
    });
    grailGrid.replaceChildren(fragment); grailGrid.setAttribute('aria-busy','false');grailGrid.scrollLeft=0;requestAnimationFrame(scheduleGrails);
  }
  async function loadHomepageGrails() {
    try {
      const saved = window.RIPPR_AUTH_OFFLINE ? window.RipprCatalog.defaultHomepageGrails() : await Promise.race([window.RipprFirebase.loadHomepageGrails(),new Promise((_,reject) => setTimeout(() => reject(new Error('Grails timeout')),6000))]);
      renderHomepageGrails(saved);
    } catch { grailStatus('The highlights are taking a moment.',true); }
  }
  grailGrid.addEventListener('click', event => {
    const button = event.target.closest('[data-grail]'); if (!button || !grailGrid.contains(button)) return;
    const grail = homepageGrails[Number(button.dataset.grail)]; if (!grail) return;
    stopGrailTimer();show(`<div class="modal-kicker">GRAIL PREVIEW</div><h2 id="modal-title">${escapeHTML(grail.name)}</h2><img class="modal-grail" src="${escapeHTML(grailImage(grail.image))}" alt="${escapeHTML(grail.name)}"><span class="condition-badge">${window.RipprCatalog.conditionLabel(grail)}</span><p class="homepage-modal-value">${grailMoney.format(grail.valueCents / 100)}</p>${grailSource === 'default' ? '<p>Original concept artwork.</p>' : ''}`, button);
    content.querySelector('.modal-grail').addEventListener('error', event => { event.currentTarget.hidden = true; const text = document.createElement('p'); text.textContent = 'Image unavailable.'; event.currentTarget.after(text); }, {once:true});
  });
  loadHomepageGrails();
})();
