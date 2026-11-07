const $=s=>document.querySelector(s);
const packCatalog=typeof window!=='undefined'&&Array.isArray(window.RIPPR_PACKS)?window.RIPPR_PACKS:[];
const packId=typeof location!=='undefined'?new URLSearchParams(location.search).get('pack'):null;
const selectedPack=packCatalog.find(pack=>pack.id===packId)||packCatalog.find(pack=>pack.id==='basic');
if(selectedPack){
 document.title=`${selectedPack.name} — rippr`;
 $('.heading h1').textContent=selectedPack.name;
 $('.showcase').setAttribute('aria-label',`${selectedPack.name} pack showcase`);
 $('.arena').setAttribute('aria-label',`Rippr ${selectedPack.name} pack`);
 $('.pack.artwork').setAttribute('aria-label',`Rippr ${selectedPack.name} booster pack`);
 document.documentElement.style.setProperty('--pack-image',`url("${selectedPack.image}")`);
 for(const part of document.querySelectorAll('.pack.artwork, .tear-strip, .foil-piece'))part.style.backgroundImage=`url("${selectedPack.image}")`;
}

const quantityButtons=[...document.querySelectorAll('[data-qty]')],openButton=$('#open'),display=$('#display'),arena=$('.arena'),stage=$('#reveal-stage'),controls=$('.controls'),results=$('#results'),cards=$('#cards'),announcement=$('#announcement'),phase=$('#phase');
let quantity=1,state='idle',deck=[],cursor=0,openingTimer;
const reduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
const catalog=window.RipprCatalog;
let contents=catalog.defaultPack(selectedPack.id),contentsReady=false,artReady=false;
const escape=value=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const cardImage=card=>window.RIPPR_ASSET_URLS?.[card.image]||card.image;
const formatChance=value=>(value/100).toLocaleString('en-US',{maximumFractionDigits:2})+'%';
const money=new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'});
const rarityBadge=name=>`<span class="rarity-badge" style="--rarity-color:${catalog.RARITIES.find(rarity=>rarity.name===name).color}"><span class="rarity-dot" aria-hidden="true"></span>${escape(name)}</span>`;
const rare=card=>!['Common','Uncommon'].includes(card.rarity);
function updateOpen(){openButton.disabled=!artReady||!contentsReady||!contents.enabled||state!=='idle';label()}
function renderContents(note){
 const table=$('.odds-table-panel table');
 table.querySelector('thead').innerHTML='<tr><th scope="col">Rarity</th><th scope="col">Chance</th><th scope="col">Min value</th><th scope="col">Max value</th></tr>';
 table.querySelector('tbody').innerHTML=catalog.summarizeRarities(contents.items).map(group=>`<tr><th scope="row">${rarityBadge(group.rarity)}</th><td>${formatChance(group.chanceBps)}</td><td>${money.format(group.minValueCents/100)}</td><td>${money.format(group.maxValueCents/100)}</td></tr>`).join('');
 table.querySelector('caption').textContent=note;
 table.setAttribute('aria-busy','false');
 $('.grails-panel h2>span').textContent='';
 $('.grail-grid').innerHTML=contents.items.filter(card=>card.grail&&card.chanceBps>0).slice(0,6).map(card=>{const color=catalog.RARITIES.find(r=>r.name===card.rarity).color;return `<article class="grail-card" style="--grail:${color}"><div class="grail-art"><img src="${escape(cardImage(card))}" alt="${escape(card.name)}" loading="lazy"></div><h3>${escape(card.name)}</h3>${rarityBadge(card.rarity)}</article>`}).join('')||'<p class="empty-grails">No grails in this pack.</p>';
 $('.grail-grid').setAttribute('aria-busy','false');
 label();
}
async function loadContents(){
 try{
  if(window.RIPPR_AUTH_OFFLINE){renderContents('Offline design preview · one card per pack');contentsReady=true;return}
  contents=await Promise.race([window.RipprFirebase.loadPackContents(selectedPack.id),new Promise((_,reject)=>setTimeout(()=>reject(new Error('Catalog timeout')),6000))]);
  renderContents('One card per pack · free test balance');
  contentsReady=true;
 }catch{phase.textContent='Pack contents could not load. Reload to try again.';renderContents('Contents unavailable')}
 finally{if(!contents.enabled)phase.textContent='This pack is currently unavailable.';updateOpen()}
}
document.addEventListener('DOMContentLoaded',loadContents,{once:true});
function label(){openButton.textContent=(window.RIPPR_AUTH_OFFLINE?'Preview open':window.RIPPR_ACCOUNT?.user?'Open':'Log in to open')+' · '+money.format(contents.priceCents*quantity/100)}
document.addEventListener('rippr:authchange',()=>{if(state!=='idle')resetOpening();label()});
quantityButtons.forEach(button=>button.addEventListener('click',()=>{if(state!=='idle')return;quantity=Number(button.dataset.qty);quantityButtons.forEach(b=>{b.classList.toggle('selected',b===button);b.setAttribute('aria-pressed',String(b===button))});label()}));
function randomUnit(){const v=new Uint32Array(1);crypto.getRandomValues(v);return v[0]/4294967296}
function makeDeck(){return Array.from({length:quantity},(_,p)=>{const card=catalog.drawItem(contents.items,randomUnit());return {...card,pack:p+1,tone:catalog.RARITIES.find(r=>r.name===card.rarity).color}})}
function renderCard(){const c=deck[cursor];arena.style.setProperty('--reveal-tone',c.tone);stage.innerHTML=`${rare(c)?'<div class="rare-halo" aria-hidden="true"></div>':''}<div class="reveal-meta">Pack ${c.pack} / ${quantity}</div><div class="spotlight-card ${rare(c)?'rare':''}" style="--tone:${c.tone}">${rarityBadge(c.rarity)}<img class="revealed-art" src="${escape(cardImage(c))}" alt="${escape(c.name)}"><strong>${escape(c.name)}</strong></div><div class="progress-track" aria-hidden="true"><span style="width:${(cursor+1)/deck.length*100}%"></span></div><p class="pack-counter">${cursor+1} / ${deck.length} ${deck.length===1?'CARD':'CARDS'}</p><div class="reveal-actions"><button id="next">${cursor===deck.length-1?(deck.length===1?'View card ↗':'View all cards ↗'):'Reveal next →'}</button><button id="skip" class="quiet" ${deck.length===1?'hidden':''}>Reveal all</button></div>`;announcement.textContent=`Card ${cursor+1} of ${deck.length}: ${c.rarity}, ${c.name}.`;$('#next').addEventListener('click',()=>{if(state!=='revealing')return;if(cursor<deck.length-1){cursor++;prepareRip()}else finish()});$('#skip').addEventListener('click',finish);$('#next').focus({preventScroll:true})}
function finish(){if(state!=='revealing')return;state='complete';$('.showcase').hidden=true;stage.hidden=true;arena.classList.remove('is-revealing');display.style.visibility='hidden';cards.innerHTML='';deck.forEach((c,i)=>{const article=document.createElement('article');article.className='result-card';article.style.setProperty('--tone',c.tone);article.style.animationDelay=`${Math.min(i,12)*.025}s`;article.innerHTML=`${rarityBadge(c.rarity)}<img class="revealed-art" src="${escape(cardImage(c))}" alt="${escape(c.name)}"><strong>${escape(c.name)}</strong>`;cards.append(article)});results.classList.add('visible');$('#summary').textContent=window.RIPPR_AUTH_OFFLINE?'Offline preview. Results are not saved.':`${deck.length} card${deck.length===1?'':'s'} saved to your items.`;$('#result-title').textContent=deck.length===1?'Your card':'Your cards';phase.textContent='';announcement.textContent=`Opening complete. ${deck.length} cards revealed.`;$('#result-title').focus({preventScroll:true});results.scrollIntoView({behavior:reduced()?'instant':'smooth',block:'start'})}
const shell=$('#pack-shell'),ripButton=$('#rip-foil');
let drag=null,progress=0;
const packImage=new Image();openButton.disabled=true;
packImage.onload=()=>{document.documentElement.style.setProperty('--pack-ratio',String(packImage.naturalWidth/packImage.naturalHeight));artReady=true;updateOpen()};
packImage.onerror=()=>{phase.textContent='Pack image could not load. Please reload.'};
packImage.src=selectedPack.image;
function setRip(value){progress=Math.max(0,Math.min(1,value));shell.style.setProperty('--rip',progress);ripButton.setAttribute('aria-label',`Rip top foil: ${Math.round(progress*100)} percent. Drag across, or press Enter`)}
function prepareRip(){
 const previousBounds=shell.getBoundingClientRect();
 clearTimeout(openingTimer);state='zooming';stage.hidden=true;arena.classList.remove('is-revealing');display.style.visibility='';
 shell.classList.remove('ripping','unsealed');setRip(0);ripButton.hidden=true;
 $('.showcase').classList.add('opening-focus');arena.classList.add('zoomed');
 if(!reduced()){const now=shell.getBoundingClientRect();shell.animate([{translate:`${previousBounds.x+previousBounds.width/2-now.x-now.width/2}px ${previousBounds.y+previousBounds.height/2-now.y-now.height/2}px`},{translate:'0 0'}],{duration:500,easing:'cubic-bezier(.2,.8,.2,1)'})}phase.textContent='';announcement.textContent=`Pack ${cursor+1} of ${deck.length}. Zooming in.`;
 openingTimer=setTimeout(()=>{state='ripping';shell.classList.add('ripping');ripButton.hidden=false;phase.textContent='';announcement.textContent=`Pack ${cursor+1} of ${deck.length}. Drag across the foil, or press Enter to rip.`;ripButton.focus({preventScroll:true})},reduced()?0:500);
}
function completeRip(){
 if(state!=='ripping')return;state='unsealing';drag=null;setRip(1);ripButton.hidden=true;shell.classList.add('unsealed');phase.textContent='';
 announcement.textContent='Foil removed. Revealing your card.';
 openingTimer=setTimeout(()=>{state='revealing';arena.classList.add('is-revealing');stage.hidden=false;renderCard()},reduced()?0:600);
}
ripButton.addEventListener('pointerdown',event=>{if(state!=='ripping'||(event.pointerType==='mouse'&&event.button!==0))return;event.preventDefault();drag={x:event.clientX,id:event.pointerId};ripButton.setPointerCapture(event.pointerId);setRip(0)});
ripButton.addEventListener('pointermove',event=>{if(!drag||event.pointerId!==drag.id)return;setRip(Math.abs(event.clientX-drag.x)/(ripButton.getBoundingClientRect().width*.75))});
ripButton.addEventListener('pointerup',event=>{if(!drag||event.pointerId!==drag.id)return;drag=null;if(progress>=.8)completeRip();else setRip(0)});
ripButton.addEventListener('pointercancel',()=>{drag=null;setRip(0)});
ripButton.addEventListener('lostpointercapture',()=>{if(drag){drag=null;setRip(0)}});
ripButton.addEventListener('click',event=>{if(event.detail===0)completeRip()});
ripButton.addEventListener('keydown',event=>{if(event.key==='ArrowRight'){event.preventDefault();setRip(progress+.25);if(progress>=1)completeRip()}else if(event.key==='ArrowLeft'){event.preventDefault();setRip(progress-.25)}});
openButton.addEventListener('click',async()=>{
 if(state!=='idle'||!contentsReady||!contents.enabled)return;
 if(!window.RIPPR_AUTH_OFFLINE&&!window.RIPPR_ACCOUNT?.user){location.href='auth.html?mode=login';return}
 const uid=window.RIPPR_ACCOUNT?.user?.uid;
 state='purchasing';quantityButtons.forEach(b=>b.disabled=true);openButton.disabled=true;controls.classList.add('is-busy');results.classList.remove('visible');phase.textContent='Opening…';
 try{
  if(window.RIPPR_AUTH_OFFLINE)deck=makeDeck();
  else{
   const purchase=await window.RipprAccount.act('purchase',{packId:selectedPack.id,quantity,expectedPriceCents:contents.priceCents,expectedVersion:contents.version});
   if(uid!==window.RIPPR_ACCOUNT?.user?.uid)return;
   deck=purchase.cards.map(card=>({...card,tone:catalog.RARITIES.find(r=>r.name===card.rarity).color}));
  }
  cursor=0;prepareRip();
 }catch(error){
  if(uid!==window.RIPPR_ACCOUNT?.user?.uid)return;
  state='idle';quantityButtons.forEach(b=>b.disabled=false);controls.classList.remove('is-busy');phase.textContent=window.RipprAccount?.errorMessage(error)||'Opening is unavailable.';updateOpen();
  if(error.code==='functions/resource-exhausted')document.querySelector('.topup-trigger')?.click();
 }
});
function resetOpening(){clearTimeout(openingTimer);$('.showcase').hidden=false;$('.showcase').classList.remove('opening-focus');drag=null;setRip(0);ripButton.hidden=true;arena.classList.remove('zoomed');shell.classList.remove('ripping','unsealed');state='idle';deck=[];cursor=0;results.classList.remove('visible');controls.classList.remove('is-busy');display.style.visibility='';display.classList.remove('opening');arena.classList.remove('is-revealing');stage.hidden=true;stage.innerHTML='';quantityButtons.forEach(b=>b.disabled=false);phase.textContent='';updateOpen();announcement.textContent='Ready for another opening.';}
$('#again').addEventListener('click',()=>{resetOpening();openButton.focus({preventScroll:true});$('.heading').scrollIntoView({behavior:reduced()?'instant':'smooth'})});

// Ambient animation runs only while the stage is visible and navigation is clear.
(() => {
 let inView = true, navigationOpen = false;
 function updateStageMotion() {
  arena.classList.toggle('is-paused', document.hidden || !inView || navigationOpen);
 }
 if ('IntersectionObserver' in window) {
  const observer = new IntersectionObserver(entries => {
   inView = entries[0].isIntersecting;
   updateStageMotion();
  }, { threshold:0 });
  observer.observe(arena);
 }
 document.addEventListener('visibilitychange', updateStageMotion);
 document.addEventListener('rippr:navigationchange', event => {
  navigationOpen = Boolean(event.detail.menuOpen || event.detail.dialogOpen);
  updateStageMotion();
 });
 updateStageMotion();
})();
