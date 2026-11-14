const $=s=>document.querySelector(s);
const conditionBadge=card=>`<span class="condition-badge">${window.RipprCatalog.conditionLabel(card)}</span>`;
const packCatalog=typeof window!=='undefined'&&Array.isArray(window.RIPPR_PACKS)?window.RIPPR_PACKS:[];
const packId=typeof location!=='undefined'?new URLSearchParams(location.search).get('pack'):null;
const inventoryPackId=new URLSearchParams(location.search).get('inventory');
const selectedPack=packCatalog.find(pack=>pack.id===packId)||packCatalog.find(pack=>pack.id==='basic');
if(selectedPack){
 // Reserve intrinsic geometry before the first image response (including cold loads).
 document.documentElement.style.setProperty('--pack-ratio',String(selectedPack.width/selectedPack.height||.56));
 document.title=`${selectedPack.name} — rippr`;
 $('.heading h1').textContent=selectedPack.name;
 $('.showcase').setAttribute('aria-label',`${selectedPack.name} pack showcase`);
 $('.arena').setAttribute('aria-label',`Rippr ${selectedPack.name} pack`);
 $('.arena').dataset.pack=selectedPack.id;
 $('.pack.artwork').setAttribute('aria-label',`Rippr ${selectedPack.name} booster pack`);
 document.documentElement.style.setProperty('--pack-image',`url("${selectedPack.image}")`);
 for(const part of document.querySelectorAll('.pack.artwork, .tear-strip, .foil-piece'))part.style.backgroundImage=`url("${selectedPack.image}")`;
}

const quantityButtons=[...document.querySelectorAll('[data-qty]')],openButton=$('#open'),display=$('#display'),arena=$('.arena'),stage=$('#reveal-stage'),controls=$('.controls'),results=$('#results'),cards=$('#cards'),announcement=$('#announcement'),phase=$('#phase'),skipOpening=$('#skip-opening');
let quantity=1,state='idle',deck=[],cursor=0,openingTimer=null,openingSession=0,selling=false,pendingSale=null,skipBatchAnimations=false;
// One phase deadline belongs to one opening session. Hidden tabs retain the
// remaining delay instead of letting timers outrun paused visual effects.
let phaseTask=null,pageSuspended=false;
const motionEffects=new Set(),visibilityPaused=new Set();
const openingHidden=()=>document.hidden||pageSuspended;
function clearOpeningTimer(){clearTimeout(openingTimer);openingTimer=null;phaseTask=null}
function armOpeningTimer(){
 const task=phaseTask;if(!task||openingHidden())return;
 task.started=performance.now();openingTimer=setTimeout(()=>{if(phaseTask!==task||task.session!==openingSession)return;phaseTask=null;openingTimer=null;task.callback()},task.remaining);
}
function scheduleOpening(callback,delay){clearOpeningTimer();phaseTask={callback,remaining:delay,started:0,session:openingSession};armOpeningTimer()}
function syncPhaseVisibility(){
 if(openingHidden()){
  if(phaseTask&&openingTimer!==null){phaseTask.remaining=Math.max(0,phaseTask.remaining-(performance.now()-phaseTask.started));clearTimeout(openingTimer);openingTimer=null}
  for(const effect of arena.getAnimations({subtree:true})){if(effect.playState==='running'){effect.pause();visibilityPaused.add(effect)}}
 }else{
  for(const effect of visibilityPaused){if(effect.playState==='paused'&&effect.effect?.target?.isConnected)effect.play()}visibilityPaused.clear();
  if(phaseTask&&openingTimer===null)armOpeningTimer();
 }
}
function animateOpening(element,keyframes,options){
 const effect=element.animate(keyframes,options);motionEffects.add(effect);
 const release=()=>{motionEffects.delete(effect);visibilityPaused.delete(effect)};
 effect.finished.then(release,release);
 if(openingHidden()){effect.pause();visibilityPaused.add(effect)}
 return effect;
}
function cancelOpeningMotion(){
 for(const effect of motionEffects){effect.cancel();visibilityPaused.delete(effect)}motionEffects.clear();
 // Ambient CSS effects paused by visibility still need resuming on return.
 for(const effect of visibilityPaused)if(effect.playState==='idle'||effect.playState==='finished'||!effect.effect?.target?.isConnected)visibilityPaused.delete(effect);
}
document.addEventListener('visibilitychange',syncPhaseVisibility);
window.addEventListener('pagehide',()=>{pageSuspended=true;syncPhaseVisibility()});
window.addEventListener('pageshow',()=>{pageSuspended=false;syncPhaseVisibility()});
const warmedArt=new Map();
function warmCardArt(){
 const urls=deck.slice(cursor,cursor+2).map(cardImage);
 for(const url of warmedArt.keys())if(!urls.includes(url))warmedArt.delete(url);
 for(const url of urls)if(!warmedArt.has(url)){const image=new Image();image.decoding='async';image.src=url;const ready=image.decode().catch(()=>{});warmedArt.set(url,{image,ready})}
}
// Decorative geometry gives each tier its own setting without changing stage layout.
const stageSignatures={
 basic:'<path d="M220 58h-88v422h88m560-422h88v422h-88"/><path class="signature-detail" d="M185 88v362m630-362v362"/>',
 plus:'<ellipse class="signature-current" cx="500" cy="284" rx="344" ry="154" transform="rotate(-26 500 284)"/><ellipse class="signature-detail" cx="500" cy="284" rx="344" ry="154" transform="rotate(26 500 284)"/>',
 premium:'<path d="m500 42 352 420H148Z"/><path class="signature-detail" d="m500 98 298 354H202Zm-290 27 580 320m0-320L210 445"/>',
 elite:'<path class="signature-streak" d="M76 380 286 170m-175 280 245-245m288 130 245-245m-175 280 210-210"/><path class="signature-detail" d="M88 430 370 148m260 244L912 110"/>',
 ultimate:'<circle cx="500" cy="270" r="214"/><circle class="signature-detail" cx="500" cy="270" r="240"/><path class="signature-detail" d="M500 22v18m0 460v18M252 270h18m460 0h18"/><path class="signature-star" d="m500 37 4 11 11 4-11 4-4 11-4-11-11-4 11-4Zm-243 81 3 8 8 3-8 3-3 8-3-8-8-3 8-3Zm482 280 3 8 8 3-8 3-3 8-3-8-8-3 8-3Z"/>',
 mythic:'<path class="signature-crystal" d="m500 28 236 124v236L500 512 264 388V152Zm0 0v484M264 152l472 236m0-236L264 388M500 28 358 270l142 242 142-242ZM264 152h472M264 388h472"/><path class="signature-detail" d="m190 98 46 46-46 46-46-46Zm620 254 46 46-46 46-46-46Z"/>',
 'icy-rush':'<path class="signature-ice" d="m112 474 76-104 45 67 65-28 52 65m300 0 58-79 54 27 47-59 79 111"/><g class="signature-snow"><path d="M181 107v30m-13-23 26 15m0-15-26 15M811 169v24m-10-18 20 12m0-12-20 12M752 75v20m-9-15 18 10m0-10-18 10M251 303v24m-10-18 20 12m0-12-20 12"/></g>'
};
const signature=document.createElement('div');signature.className='stage-signature';signature.setAttribute('aria-hidden','true');
signature.innerHTML=`<svg viewBox="0 0 1000 540" preserveAspectRatio="xMidYMid slice">${stageSignatures[selectedPack.id]||stageSignatures.basic}</svg>`;
$('.stage-effects').append(signature);
const sound=window.RipprOpeningAudio||{play:()=>false,stop:()=>{}};
const reduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
const catalog=window.RipprCatalog;
let contents=catalog.defaultPack(selectedPack.id),contentsReady=false,artReady=false,loadError=false;
let inventoryStatus=inventoryPackId?'checking':'none',inventoryCheckVersion=0;
const oddsPanel=$('.odds-table-panel');
const escape=value=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const cardImage=card=>window.RIPPR_ASSET_URLS?.[card.image]||card.image;
const formatChance=value=>(value/100).toLocaleString('en-US',{maximumFractionDigits:2})+'%';
const money=new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'});
const rarityBadge=name=>`<span class="rarity-badge" style="--rarity-color:${catalog.RARITIES.find(rarity=>rarity.name===name).color}"><span class="rarity-dot" aria-hidden="true"></span>${escape(name)}</span>`;
function canOpenCatalog(){if(window.RIPPR_ACCOUNT?.mode==='live'&&window.RIPPR_ACCOUNT?.livePurchasesEnabled===false)return false;return inventoryPackId?(!window.RIPPR_ACCOUNT?.user||inventoryStatus==='available'):contents.enabled&&Number.isSafeInteger(contents.priceCents)}
function updateOpen(){openButton.disabled=!artReady||!contentsReady||!canOpenCatalog()||state!=='idle';label()}
async function verifyInventoryPack(){
 if(!inventoryPackId)return;
 const version=++inventoryCheckVersion,uid=window.RIPPR_ACCOUNT?.user?.uid;
 if(!uid){inventoryStatus='guest';updateOpen();return}
 inventoryStatus='checking';updateOpen();
 try{
  const owned=await window.RipprFirebase.loadInventoryPack(inventoryPackId);
  if(version!==inventoryCheckVersion||uid!==window.RIPPR_ACCOUNT?.user?.uid)return;
  inventoryStatus=owned?.status==='available'&&owned.packId===selectedPack.id?'available':'unavailable';
  if(inventoryStatus==='unavailable'&&state==='idle')phase.textContent='This reward pack is unavailable or already opened. Return to My items.';
 }catch{
  if(version!==inventoryCheckVersion||uid!==window.RIPPR_ACCOUNT?.user?.uid)return;
  inventoryStatus='unavailable';
  if(state==='idle')phase.textContent='Could not verify this reward pack. Reload to retry or return to My items.';
 }
 updateOpen();
}

let grailCards=[],grailTrigger=null,grailStops=[];
const grailTrack=$('.grail-grid'),grailDialog=$('#grail-preview');
function updateGrailControls(){
 const max=Math.max(0,grailTrack.scrollWidth-grailTrack.clientWidth),overflow=max>2;
 $('.grail-carousel-controls').hidden=!overflow;$('.grail-pagination').hidden=!overflow;
 $('#grail-prev').disabled=grailTrack.scrollLeft<2;$('#grail-next').disabled=grailTrack.scrollLeft>=max-2;
 const width=grailTrack.firstElementChild?.getBoundingClientRect().width||1,gap=parseFloat(getComputedStyle(grailTrack).gap)||0,unit=width+gap,stops=[0];
 if(overflow&&grailCards.length){for(let left=unit;left<max-2;left+=unit)stops.push(left);stops.push(max)}
 const pages=$('.grail-pagination');
 if(stops.length!==grailStops.length||stops.some((v,i)=>Math.abs(v-grailStops[i])>1)){
  grailStops=stops;pages.replaceChildren();
  if(stops.length<=8){stops.forEach((left,i)=>{const button=document.createElement('button');button.type='button';button.setAttribute('aria-label',`Grail gallery position ${i+1} of ${stops.length}`);button.addEventListener('click',()=>grailTrack.scrollTo({left,behavior:reduced()?'instant':'smooth'}));pages.append(button)})}else{const count=document.createElement('span');count.className='grail-position';pages.append(count)}
 }
 let index=0;stops.forEach((left,i)=>{if(Math.abs(left-grailTrack.scrollLeft)<Math.abs(stops[index]-grailTrack.scrollLeft))index=i});
 pages.querySelectorAll('button').forEach((button,i)=>button.setAttribute('aria-pressed',String(i===index)));
 const count=pages.querySelector('.grail-position');if(count)count.textContent=`${index+1} / ${stops.length}`;
}
function renderGrails(items){
 grailCards=items;$('.grail-count').textContent=items.length?`${items.length} ${items.length===1?'grail':'grails'}`:'';
 const expand='<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M12 3h5v5M17 3l-6 6M8 17H3v-5M3 17l6-6"/></svg>';
 grailTrack.innerHTML=items.map((card,index)=>{const color=catalog.RARITIES.find(r=>r.name===card.rarity)?.color||'#adbdcf',parts=card.name.split(/\s+[-–—]\s+/),name=parts[0],subtitle=parts.slice(1).join(' · ');return `<article class="grail-card" role="listitem" style="--grail:${color}"><div class="grail-art"><img src="${escape(cardImage(card))}" alt="${escape(card.name)}" loading="lazy"><button type="button" class="grail-expand" data-grail="${index}" aria-label="Preview ${escape(card.name)}">${expand}</button></div><div class="grail-copy"><h3 title="${escape(card.name)}">${escape(name)}</h3><p class="grail-subtitle" title="${escape(subtitle)}">${escape(subtitle)}</p>${conditionBadge(card)}<div class="grail-footer">${rarityBadge(card.rarity)}<p class="grail-value">${money.format(card.valueCents/100)}</p></div></div></article>`}).join('')||'<p class="empty-grails" role="listitem">No grails in this pack.</p>';
 grailTrack.querySelectorAll('img').forEach(img=>window.RipprArtwork.watch(img,{onError:()=>{img.src='assets/card-placeholder.svg'}}));
 grailStops=[];$('.grail-pagination').replaceChildren();
 $('.grail-gallery-caption').hidden=!items.length;grailTrack.setAttribute('aria-busy','false');grailTrack.scrollLeft=0;requestAnimationFrame(updateGrailControls);
}
function moveGrails(direction){grailTrack.scrollBy({left:direction*grailTrack.clientWidth,behavior:reduced()?'instant':'smooth'})}
$('#grail-prev').addEventListener('click',()=>moveGrails(-1));$('#grail-next').addEventListener('click',()=>moveGrails(1));
grailTrack.addEventListener('scroll',updateGrailControls,{passive:true});new ResizeObserver(updateGrailControls).observe(grailTrack);
grailTrack.addEventListener('keydown',event=>{if(event.target!==grailTrack)return;if(['ArrowLeft','ArrowRight'].includes(event.key)){event.preventDefault();moveGrails(event.key==='ArrowLeft'?-1:1)}});
const grailArtwork=window.RipprArtwork.watch($('#grail-preview-image'),{onError:img=>{img.src='assets/card-placeholder.svg'}});
grailTrack.addEventListener('click',event=>{const button=event.target.closest('[data-grail]');if(!button)return;const card=grailCards[Number(button.dataset.grail)];if(!card)return;grailTrigger=button;grailArtwork.load(cardImage(card));$('#grail-preview-image').alt=card.name;$('#grail-preview-name').textContent=card.name;$('#grail-preview-details').innerHTML=rarityBadge(card.rarity)+conditionBadge(card)+`<strong>${money.format(card.valueCents/100)}</strong>`;grailDialog.showModal();document.dispatchEvent(new CustomEvent('rippr:navigationchange',{detail:{menuOpen:false,dialogOpen:true}}))});
$('.grail-preview-close').addEventListener('click',()=>grailDialog.close());grailDialog.addEventListener('close',()=>{grailTrigger?.focus({preventScroll:true});document.dispatchEvent(new CustomEvent('rippr:navigationchange',{detail:{menuOpen:false,dialogOpen:false}}))});
grailDialog.addEventListener('click',event=>{if(event.target!==grailDialog)return;const r=grailDialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)grailDialog.close()});
function renderContents(note){
 const table=$('.odds-table-panel table');
 table.querySelector('thead').innerHTML='<tr><th scope="col">Rarity</th><th scope="col">Chance</th><th scope="col" aria-label="Minimum to maximum item value">Value</th></tr>';
 table.querySelector('tbody').innerHTML=catalog.summarizeRarities(contents.items).map(group=>{const min=money.format(group.minValueCents/100),max=money.format(group.maxValueCents/100);return `<tr><th scope="row">${rarityBadge(group.rarity)}</th><td>${formatChance(group.chanceBps)}</td><td class="odds-value-range" aria-label="Minimum ${min}, maximum ${max}">${min}${group.minValueCents===group.maxValueCents?'':`<span aria-hidden="true">–</span><wbr>${max}`}</td></tr>`}).join('');
 table.querySelector('caption').textContent=note;
 table.setAttribute('aria-busy','false');
 renderGrails(contents.items.filter(card=>card.grail&&card.chanceBps>0));
 label();
}
async function loadContents(){
 try{
  if(window.RIPPR_AUTH_OFFLINE){renderContents('Offline design preview · one card per pack');contentsReady=true;return}
  contents=await Promise.race([window.RipprFirebase.loadPackContents(selectedPack.id),new Promise((_,reject)=>setTimeout(()=>reject(new Error('Catalog timeout')),6000))]);
  renderContents(inventoryPackId?'Owned pack · current displayed contents':window.RIPPR_RUNTIME?.mode==='live'?'One card per pack':'One card per pack · free test balance');
  contentsReady=true;
 }catch(error){loadError=true;phase.textContent=['catalog/unconfigured','catalog/invalid-data'].includes(error?.code)?'This pack is temporarily unavailable. Your balance and any owned pack are unchanged.':'Pack contents could not load. Reload to try again.';const table=oddsPanel.querySelector('table');table.setAttribute('aria-busy','false');table.querySelector('caption').textContent='Contents unavailable';table.querySelector('tbody').innerHTML='<tr><td colspan="3" class="odds-loading">Odds unavailable. Reload to try again.</td></tr>';$('.grail-grid').innerHTML='<p class="empty-grails">Grails could not load.</p>';$('.grail-grid').setAttribute('aria-busy','false')}
 finally{updateOpen()}
}
document.addEventListener('DOMContentLoaded',()=>{loadContents();verifyInventoryPack()},{once:true});
function label(){
 if(state!=='idle')return;
 if(window.RIPPR_ACCOUNT?.mode==='live'&&window.RIPPR_ACCOUNT?.livePurchasesEnabled===false){openButton.textContent='Openings paused';return}
 $('#pack-price').textContent=inventoryPackId?'Owned pack':contentsReady&&Number.isSafeInteger(contents.priceCents)?money.format(contents.priceCents/100):'—';$('#price-suffix').hidden=Boolean(inventoryPackId);
 if(!contentsReady){openButton.textContent=loadError?'Pack unavailable':'Loading pack…';return}
 if(inventoryPackId){
  openButton.textContent=!window.RIPPR_ACCOUNT?.user?'Log in to open reward pack':inventoryStatus==='checking'?'Checking reward pack…':inventoryStatus==='available'?'Open reward pack':'Reward pack unavailable';return;
 }
 if(!canOpenCatalog()){openButton.textContent='Pack unavailable';return}
 const packs=`${quantity} pack${quantity===1?'':'s'}`;
 openButton.textContent=(window.RIPPR_AUTH_OFFLINE?'Preview':window.RIPPR_ACCOUNT?.user?'Open':'Log in to open')+' '+packs+' · '+money.format(contents.priceCents*quantity/100);
}
document.addEventListener('rippr:authchange',()=>{inventoryStatus=inventoryPackId?'checking':'none';if(state!=='idle')resetOpening();verifyInventoryPack();updateOpen()});
if(inventoryPackId){$('.quantities').hidden=true;$('#quantity-control').hidden=true;$('.back').href='profile.html';$('.back').textContent='← Back to my items';$('#again').textContent='Back to my items';}
quantityButtons.forEach(button=>button.addEventListener('click',()=>{if(state!=='idle')return;sound.play('click');quantity=Number(button.dataset.qty);quantityButtons.forEach(b=>{b.classList.toggle('selected',b===button);b.setAttribute('aria-pressed',String(b===button))});label()}));
function randomUnit(){const v=new Uint32Array(1);crypto.getRandomValues(v);return v[0]/4294967296}
function makeDeck(){return Array.from({length:quantity},(_,p)=>{const card=catalog.drawItem(contents.items,randomUnit());return {...card,pack:p+1,tone:catalog.RARITIES.find(r=>r.name===card.rarity).color}})}
const revealPhaseClasses=['is-extracting','is-cycling','is-settling','is-flipping','is-card-revealed'];
const cycleDelays=[100,100,110,110,120,120,130,140,155,175,200,230,270,320];
function clearRevealEffects(){arena.classList.remove(...revealPhaseClasses);delete arena.dataset.revealRarity;delete arena.dataset.cycleIndex;}
const revealSpark='<svg viewBox="0 0 24 28" aria-hidden="true"><path d="M12 0C13 9 15 12 24 14C15 16 13 19 12 28C11 19 9 16 0 14C9 12 11 9 12 0Z"/></svg>';
const cardBackImage=window.RIPPR_REVEAL_BACK_URL||'assets/reveal/rippr-card-back.webp';
const preloadBack=new Image();preloadBack.src=cardBackImage;
const saleDialog=$('#reveal-sale-dialog');
// Reuse the actual arena so theme, audio, card actions and purchase state stay intact.
const theater=document.createElement('dialog');theater.id='opening-theater';theater.className='opening-theater';theater.setAttribute('aria-label',selectedPack.name+' pack opening');
const theaterSlot=document.createElement('div');theaterSlot.className='theater-stage-slot';theater.append(theaterSlot);document.body.append(theater);
const arenaHome=document.createComment('arena-home');arena.before(arenaHome);
const announcementHome=document.createComment('announcement-home');announcement.before(announcementHome);
const theaterToggle=document.createElement('button');theaterToggle.id='theater-toggle';theaterToggle.type='button';theaterToggle.className='theater-toggle';theaterToggle.hidden=true;theaterToggle.setAttribute('aria-label','Expand stage');theaterToggle.setAttribute('aria-expanded','false');
theaterToggle.innerHTML='<svg class="theater-expand" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/></svg><svg class="theater-contract" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 8h5V3m8 0v5h5M8 21v-5H3m18 0h-5v5"/></svg>';arena.append(theaterToggle);
let arenaPlaceholder=null,theaterAnimation=null,theaterScroll=0;
function focusOpeningControl(){
 if(['idle','purchasing','complete'].includes(state))return;
 const target=state==='revealing'?$('#next'):state==='ripping'?ripButton:skipOpening;
 if(target&&!target.hidden)target.focus({preventScroll:true});
}
async function expandOpening(){
 if(theater.open)return;
 const bounds=arena.getBoundingClientRect();theaterScroll=window.scrollY;
 arenaPlaceholder=document.createElement('div');arenaPlaceholder.className='arena-placeholder';arenaPlaceholder.setAttribute('aria-hidden','true');arenaPlaceholder.style.height=bounds.height+'px';arena.before(arenaPlaceholder);
 theaterSlot.append(arena,announcement);theaterToggle.hidden=false;theaterToggle.setAttribute('aria-label','Exit full screen');theaterToggle.setAttribute('aria-expanded','true');
 document.body.classList.add('opening-in-theater');theater.showModal();
 if(!reduced()){
  const end=arena.getBoundingClientRect(),effect=animateOpening(arena,[{transformOrigin:'0 0',transform:`translate(${bounds.left}px,${bounds.top}px) scale(${bounds.width/end.width},${bounds.height/end.height})`},{transformOrigin:'0 0',transform:'none'}],{duration:520,easing:'cubic-bezier(.22,1,.36,1)'});theaterAnimation=effect;
  await effect.finished.catch(()=>{});if(theaterAnimation===effect)theaterAnimation=null;
 }
}
function collapseOpening(focus=true){
 theaterAnimation?.cancel();theaterAnimation=null;
 if(arena.parentNode===theaterSlot)arenaHome.after(arena);
 if(announcement.parentNode===theaterSlot)announcementHome.after(announcement);
 arenaPlaceholder?.remove();arenaPlaceholder=null;
 if(theater.open)theater.close();
 document.body.classList.remove('opening-in-theater');theaterToggle.setAttribute('aria-label','Expand stage');theaterToggle.setAttribute('aria-expanded','false');
 window.scrollTo({top:theaterScroll,left:0,behavior:'instant'});
 if(focus)requestAnimationFrame(focusOpeningControl);
}
theater.addEventListener('cancel',event=>{event.preventDefault();collapseOpening()});
theater.addEventListener('close',()=>{if(!theater.open&&arena.parentNode===theaterSlot)collapseOpening()});
theaterToggle.addEventListener('click',async()=>{if(theater.open)collapseOpening();else{await expandOpening();focusOpeningControl()}});

function revealNavigation(){document.dispatchEvent(new CustomEvent('rippr:navigationchange',{detail:{menuOpen:!document.querySelector('#mobile-navigation')?.hidden,dialogOpen:Boolean(document.querySelector('dialog[open]:not(.opening-theater)'))}}))}
function cardTitle(name){
 const parts=String(name).split(/\s+[-–—]\s+/),main=parts.shift(),detail=parts.join(' · ');
 return `<span class="card-title-main">${escape(main)}</span>${detail?`<span class="card-title-detail">${escape(detail)}</span>`:''}`;
}
function savedCardStatus(c){return window.RIPPR_ACCOUNT?.items?.find(item=>item.id===c.id)?.status||c.status||'available'}
function syncRevealActions(){
 if(state!=='revealing'||!deck[cursor])return;
 const c=deck[cursor],status=savedCardStatus(c),unavailable=status!=='available';
 $('.reveal-actions').setAttribute('aria-busy',String(selling));
 $('#next').disabled=selling;
 $('#next').textContent=unavailable?'Continue':'Add to inventory';
 $('#sell-card').disabled=selling||Boolean(window.RIPPR_AUTH_OFFLINE)||unavailable;
 $('#sell-card').textContent=selling?'Selling…':status==='sold'?'Sold':status==='shipping'?'Shipping requested':status==='shipped'?'Shipped':status==='delivered'?'Delivered':unavailable?'Unavailable':`Sell for ${money.format(c.valueCents/100)}`;
 if(unavailable)c.status=status;
}
function renderCard(instant=false){
 clearOpeningTimer();cancelOpeningMotion();warmCardArt();
 const c=deck[cursor];
 clearRevealEffects();state='extracting';arena.classList.add('is-extracting');arena.style.setProperty('--reveal-tone','#92b4d4');
 stage.innerHTML=`<p class="reveal-meta" ${deck.length===1?'hidden':''}>Pack ${cursor+1} of ${deck.length}</p><div class="reveal-rarity" aria-hidden="true">${revealSpark}<span>${escape(c.rarity)}</span>${conditionBadge(c)}</div><div class="reveal-art-stage"><div class="reveal-halo" aria-hidden="true"></div><div class="reveal-motes" aria-hidden="true">${Array.from({length:7},(_,i)=>`<i style="--i:${i};--mote-top:${8+(i*29)%85}%"></i>`).join('')}</div><div class="spotlight-card"><div class="reveal-card-turn"><div class="reveal-face reveal-front" aria-hidden="true"><img class="revealed-art" src="${escape(cardImage(c))}" alt="${escape(c.name)}"><span class="reveal-art-fallback" hidden>Artwork unavailable</span></div><div class="reveal-face reveal-back" role="img" aria-label="Face-down rippr card"><img src="${escape(cardBackImage)}" alt="" draggable="false"></div></div><svg class="reveal-edge" viewBox="0 0 300 420" preserveAspectRatio="none" aria-hidden="true"><rect x="2" y="2" width="296" height="416" rx="17" pathLength="100"/></svg></div><span class="reveal-plinth" aria-hidden="true"></span></div><div class="reveal-information" inert aria-hidden="true"><h2 id="reveal-name" title="${escape(c.name)}" aria-label="${escape(c.name)}">${cardTitle(c.name)}</h2><p class="reveal-value">${money.format(c.valueCents/100)}</p></div><div class="reveal-actions" inert aria-hidden="true"><button type="button" id="next" class="keep-card">Add to inventory</button><button type="button" id="sell-card" class="sell-card" ${window.RIPPR_AUTH_OFFLINE?'disabled title="Selling is unavailable in offline previews."':''}>Sell for ${money.format(c.valueCents/100)}</button></div>`;
 const art=$('.reveal-front .revealed-art');
 const fallback=art.nextElementSibling;fallback.inert=true;
 fallback.append(window.RipprArtwork.retryButton(art));
 window.RipprArtwork.watch(art,{onError:()=>{art.hidden=true;fallback.hidden=false},onRetry:()=>{art.hidden=false;fallback.hidden=true},onLoad:()=>{art.hidden=false;fallback.hidden=true}});
 void art.decode().catch(()=>{});
 $('.reveal-back img').addEventListener('error',event=>{event.currentTarget.hidden=true},{once:true});
 $('#next').addEventListener('click',()=>{if(state!=='revealing'||selling)return;c.status=savedCardStatus(c);if(c.status==='available')sound.play('inventory');advanceReveal()});
 $('#sell-card').addEventListener('click',confirmRevealSale);
 announcement.textContent=`Pack ${cursor+1} of ${deck.length}. Pulling your face-down card out of the pack.`;
 skipOpening.hidden=false;skipOpening.focus({preventScroll:true});
 if(instant||reduced())completeCardReveal(true);
 else {
  const packBounds=shell.getBoundingClientRect(),art=$('.reveal-art-stage');
  // Measure the destination before its extraction animation starts.
  const destinationTop=arena.getBoundingClientRect().top+arena.clientTop+art.offsetTop;
  const destinationCenter=destinationTop+art.offsetHeight/2;
  stage.style.setProperty('--extract-y',(packBounds.top+packBounds.height/2-destinationCenter)+'px');
  stage.style.setProperty('--extract-scale',String(Math.min(.95,packBounds.width*.8/art.offsetWidth)));
  sound.play('lift',{channel:'motion'});
  scheduleOpening(beginRarityCycle,900);
 }
}
function beginRarityCycle(){
 if(state!=='extracting')return;
 state='cycling';arena.classList.remove('is-extracting');arena.classList.add('is-cycling');
 announcement.textContent='Your card is out. The rarity colors are cycling.';sound.play('build',{channel:'motion'});
 cycleRarityColor(0);
}
function cycleRarityColor(index){
 if(state!=='cycling')return;
 if(index===cycleDelays.length){landRarity();return}
 const color=catalog.RARITIES[index%catalog.RARITIES.length].color;
 arena.dataset.cycleIndex=String(index);arena.style.setProperty('--reveal-tone',color);
 scheduleOpening(()=>cycleRarityColor(index+1),cycleDelays[index]);
}
function landRarity(){
 if(state!=='cycling')return;
 state='settling';arena.classList.remove('is-cycling');arena.classList.add('is-settling');
 applyWinningRarity();announcement.textContent=`${deck[cursor].rarity}. Revealing your card.`;
 scheduleOpening(flipCard,480);
}
function applyWinningRarity(){
 const c=deck[cursor];arena.style.setProperty('--reveal-tone',c.tone);arena.dataset.revealRarity=c.rarity;
 const badge=$('.reveal-rarity');badge.style.setProperty('--rarity-color',c.tone);badge.removeAttribute('aria-hidden');
}
function flipCard(){
 if(state!=='settling')return;
 state='flipping';arena.classList.remove('is-settling');arena.classList.add('is-flipping');sound.play('flip',{channel:'motion'});
 scheduleOpening(()=>completeCardReveal(false),650);
}
function completeCardReveal(instant){
 if(!['extracting','cycling','settling','flipping'].includes(state))return;
 clearOpeningTimer();cancelOpeningMotion();
 const artStage=$('.reveal-art-stage'),before=!instant&&!reduced()?artStage.getBoundingClientRect():null;
 state='revealing';sound.stop('motion');sound.stop('foil');
 arena.classList.remove('is-extracting','is-cycling','is-settling','is-flipping');arena.classList.add('is-card-revealed');applyWinningRarity();
 arena.classList.toggle('skip-reveal-motion',instant);skipOpening.hidden=true;
 if(before){
  const after=artStage.getBoundingClientRect();
  if(after.width&&after.height){
   // Individual scale also scales the CSS translateX(-50%). Match centers in X
   // so the large card settles without a sideways jump, including landscape.
   const dx=before.left+before.width/2-after.left-after.width/2,dy=before.top-after.top;
   animateOpening(artStage,[{transformOrigin:'0 0',translate:`${dx}px ${dy}px`,scale:`${before.width/after.width} ${before.height/after.height}`},{transformOrigin:'0 0',translate:'0 0',scale:'1 1'}],{duration:460,easing:'cubic-bezier(.22,1,.36,1)'})
  }
 }
 $('.reveal-front').removeAttribute('aria-hidden');$('.reveal-back').setAttribute('aria-hidden','true');
 for(const element of stage.querySelectorAll('.reveal-information,.reveal-actions,.reveal-art-fallback')){element.removeAttribute('inert');element.removeAttribute('aria-hidden')}
 const c=deck[cursor];announcement.textContent=`Card ${cursor+1} of ${deck.length}: ${c.rarity}, ${c.name}, ${money.format(c.valueCents/100)}.`;
 if(!instant)sound.play(c.rarity==='Legendary'?'legendary':['Epic','Special rare'].includes(c.rarity)?'epic':['Rare','Ultra rare'].includes(c.rarity)?'rare':'common',{channel:'reveal'});
 const name=$('#reveal-name');if(name.scrollHeight>name.clientHeight)name.tabIndex=0;
 syncRevealActions();$('#next').focus({preventScroll:true});
}
function advanceReveal(){if(cursor<deck.length-1){cursor++;prepareRip()}else finish()}
function salePreferenceKey(uid){return 'rippr:skip-sale-confirmation:'+uid}
function skipSaleConfirmation(uid){try{return localStorage.getItem(salePreferenceKey(uid))==='true'}catch{return false}}
function confirmRevealSale(){
 if(state!=='revealing'||selling||window.RIPPR_AUTH_OFFLINE||!window.RIPPR_ACCOUNT?.user)return;
 const c=deck[cursor];if(savedCardStatus(c)!=='available')return;
 pendingSale={card:c,uid:window.RIPPR_ACCOUNT.user.uid,session:openingSession};
 $('#reveal-sale-name').textContent=c.name;
 $('#reveal-sale-description').textContent=`${money.format(c.valueCents/100)} will be added to your ${window.RIPPR_ACCOUNT?.mode==='live'?'site credit balance':'test balance'}. This card will leave your available inventory.`;
 $('#confirm-reveal-sale').textContent=`Sell for ${money.format(c.valueCents/100)}`;
 $('#skip-sale-confirmation').checked=skipSaleConfirmation(pendingSale.uid);
 $('#reveal-sale-error').hidden=true;
 if($('#skip-sale-confirmation').checked){submitRevealSale();return}
 saleDialog.showModal();revealNavigation();
}
async function submitRevealSale(){
 if(selling||!pendingSale)return;
 const target=pendingSale,remember=$('#skip-sale-confirmation').checked;if(target.uid!==window.RIPPR_ACCOUNT?.user?.uid||target.session!==openingSession)return;
 selling=true;$('#skip-sale-confirmation').disabled=true;$('#confirm-reveal-sale').disabled=true;$('#cancel-reveal-sale').disabled=true;syncRevealActions();
 try{
  const result=await window.RipprAccount.act('sell',{itemIds:[target.card.id]});
  if(target.uid!==window.RIPPR_ACCOUNT?.user?.uid||target.session!==openingSession)return;
  target.card.status='sold';target.card.soldCents=result.soldCents;
  if(remember){try{localStorage.setItem(salePreferenceKey(target.uid),'true')}catch{}}
  selling=false;if(saleDialog.open)saleDialog.close();else pendingSale=null;sound.play('click');advanceReveal();
 }catch(error){
  if(target.uid!==window.RIPPR_ACCOUNT?.user?.uid||target.session!==openingSession)return;
  if(!saleDialog.open){saleDialog.showModal();revealNavigation()}
  $('#reveal-sale-error').textContent=window.RipprAccount.errorMessage(error);$('#reveal-sale-error').hidden=false;
 }finally{
  if(target.session===openingSession){selling=false;$('#skip-sale-confirmation').disabled=false;$('#confirm-reveal-sale').disabled=false;$('#cancel-reveal-sale').disabled=false;syncRevealActions()}
 }
}
$('#confirm-reveal-sale').addEventListener('click',submitRevealSale);
$('#cancel-reveal-sale').addEventListener('click',()=>{if(!selling)saleDialog.close()});
saleDialog.addEventListener('cancel',event=>{if(selling)event.preventDefault()});
saleDialog.addEventListener('close',()=>{pendingSale=null;revealNavigation()});
document.addEventListener('rippr:walletchange',syncRevealActions);
function finish(){
 if(state!=='revealing')return;clearOpeningTimer();cancelOpeningMotion();foil?.cancel();warmedArt.clear();collapseOpening(false);theaterToggle.hidden=true;sound.stop('motion');sound.stop('reveal');state='complete';$('.showcase').hidden=true;stage.hidden=true;arena.classList.remove('is-revealing');display.style.visibility='hidden';cards.innerHTML='';clearRevealEffects();stage.replaceChildren();
 deck.forEach((c,i)=>{c.status=savedCardStatus(c);const article=document.createElement('article');article.className='result-card';article.style.setProperty('--tone',c.tone);article.dataset.status=c.status||'available';article.style.animationDelay=`${Math.min(i,12)*.025}s`;article.innerHTML=`<div class="card-badges">${rarityBadge(c.rarity)}${conditionBadge(c)}</div><img class="revealed-art" src="${escape(cardImage(c))}" alt="${escape(c.name)}"><strong class="result-name" aria-label="${escape(c.name)}">${cardTitle(c.name)}</strong><p class="result-value">${money.format(c.valueCents/100)}</p>${window.RIPPR_AUTH_OFFLINE?'':`<p class="result-disposition">${c.status==='sold'?`Sold for ${money.format((c.soldCents??c.valueCents)/100)}`:c.status==='shipping'?'Shipping requested':c.status==='shipped'?'Shipped':c.status==='delivered'?'Delivered':'Added to inventory'}</p>`}`;const art=article.querySelector('.revealed-art');let fallback;const restore=()=>{art.hidden=false;fallback?.remove();fallback=null};window.RipprArtwork.watch(art,{onError:()=>{art.hidden=true;fallback=document.createElement('span');fallback.className='result-art-fallback';fallback.append('Artwork unavailable',window.RipprArtwork.retryButton(art));art.after(fallback)},onRetry:restore,onLoad:restore});cards.append(article)});
 const sold=deck.filter(c=>c.status==='sold').length,kept=deck.filter(c=>!['sold','shipping','shipped','delivered'].includes(c.status)).length;
 results.classList.add('visible');for(const name of cards.querySelectorAll('.result-name'))if(name.scrollHeight>name.clientHeight)name.tabIndex=0;$('#summary').textContent=window.RIPPR_AUTH_OFFLINE?'Offline preview. Results are not saved.':`${kept} card${kept===1?'':'s'} in your inventory.${sold?` ${sold} sold.`:''}`;
 $('#result-title').textContent=deck.length===1?'Your card':'Your cards';phase.textContent='';announcement.textContent=`Opening complete. ${$('#summary').textContent}`;$('#result-title').focus({preventScroll:true});results.scrollIntoView({behavior:reduced()?'instant':'smooth',block:'start'});
}
const shell=$('#pack-shell'),ripButton=$('#rip-foil');
const foil=window.RipprFoil?.mount(shell);
let ripDirection=1;
let drag=null,progress=0;
const packImage=new Image();openButton.disabled=true;
packImage.onload=async()=>{
 try{await packImage.decode()}catch{}
 if(!packImage.naturalWidth)return;
 document.documentElement.style.setProperty('--pack-ratio',String(packImage.naturalWidth/packImage.naturalHeight));
 artReady=true;shell.dataset.artReady='true';updateOpen();
};
packImage.onerror=()=>{phase.textContent='Pack image could not load. Please reload.'};
packImage.src=selectedPack.image;
let ripLabel=-1;
function releaseDrag(){const id=drag?.id;drag=null;if(id!==undefined&&ripButton.hasPointerCapture(id))ripButton.releasePointerCapture(id)}
function setRip(value){progress=Math.max(0,Math.min(1,value));shell.style.setProperty('--rip',progress);foil?.setProgress(progress,ripDirection);const label=Math.round(progress*100);if(label!==ripLabel){ripLabel=label;ripButton.setAttribute('aria-label',`Rip top foil: ${label} percent. Drag across, or press Enter`)}}
function prepareRip(){
 // Skip applies to this entire purchased batch while preserving each card's actions.
 if(skipBatchAnimations){state='zooming';showReveal(true);return}
 sound.stop('motion');sound.stop('reveal');sound.stop('foil');cancelOpeningMotion();releaseDrag();warmCardArt();stage.replaceChildren();
 const previousBounds=shell.getBoundingClientRect();
 clearOpeningTimer();state='zooming';stage.hidden=true;skipOpening.hidden=false;arena.classList.remove('is-revealing','skip-reveal-motion');clearRevealEffects();display.style.visibility='';
 shell.classList.remove('ripping','unsealed');foil?.reset();ripDirection=1;setRip(0);ripButton.hidden=true;
 $('.showcase').classList.add('opening-focus');arena.classList.add('zoomed');
 if(!reduced()){const now=shell.getBoundingClientRect();animateOpening(shell,[{translate:`${previousBounds.x+previousBounds.width/2-now.x-now.width/2}px ${previousBounds.y+previousBounds.height/2-now.y-now.height/2}px`},{translate:'0 0'}],{duration:500,easing:'cubic-bezier(.2,.8,.2,1)'})}phase.textContent='';announcement.textContent=`Pack ${cursor+1} of ${deck.length}. Zooming in.`;
 scheduleOpening(()=>{if(state!=='zooming')return;state='ripping';shell.classList.add('ripping');ripButton.hidden=false;phase.textContent='';announcement.textContent=`Pack ${cursor+1} of ${deck.length}. Drag across the foil, or press Enter to rip.`;ripButton.focus({preventScroll:true})},reduced()?0:500);
}
function completeRip(){
 if(state!=='ripping')return;clearOpeningTimer();state='unsealing';releaseDrag();setRip(1);ripButton.hidden=true;shell.classList.add('unsealed');phase.textContent='';
 announcement.textContent='Foil removed. Revealing your card.';sound.play('rip',{channel:'foil'});
 const peelDelay=foil?.release(reduced())??(reduced()?0:180);
 scheduleOpening(()=>showReveal(false),peelDelay);
}
function showReveal(instant){
 if(!['zooming','ripping','unsealing'].includes(state))return;
 clearOpeningTimer();releaseDrag();if(instant)foil?.cancel();setRip(1);ripButton.hidden=true;skipOpening.hidden=true;
 shell.getAnimations().forEach(animation=>animation.cancel());
 arena.classList.add('is-revealing');arena.classList.toggle('skip-reveal-motion',instant);stage.hidden=false;renderCard(instant);
}
skipOpening.addEventListener('click',()=>{skipBatchAnimations=true;sound.stop();if(['extracting','cycling','settling','flipping'].includes(state))completeCardReveal(true);else showReveal(true)});
ripButton.addEventListener('pointerdown',event=>{if(state!=='ripping'||drag||(event.pointerType==='mouse'&&event.button!==0))return;event.preventDefault();drag={x:event.clientX,id:event.pointerId,width:ripButton.getBoundingClientRect().width};ripButton.setPointerCapture(event.pointerId);setRip(0)});
ripButton.addEventListener('pointermove',event=>{if(!drag||event.pointerId!==drag.id)return;ripDirection=event.clientX<drag.x?-1:1;setRip(Math.abs(event.clientX-drag.x)/(Math.max(1,drag.width)*.75))});
ripButton.addEventListener('pointerup',event=>{if(!drag||event.pointerId!==drag.id)return;releaseDrag();if(progress>=.8)completeRip();else setRip(0)});
ripButton.addEventListener('pointercancel',event=>{if(!drag||event.pointerId!==drag.id)return;releaseDrag();if(state==='ripping')setRip(0)});
ripButton.addEventListener('lostpointercapture',event=>{if(drag&&event.pointerId===drag.id){drag=null;setRip(0)}});
ripButton.addEventListener('click',event=>{if(event.detail===0)completeRip()});
ripButton.addEventListener('keydown',event=>{if(state!=='ripping')return;if(event.key==='ArrowRight'){event.preventDefault();setRip(progress+.25);if(progress>=1)completeRip()}else if(event.key==='ArrowLeft'){event.preventDefault();setRip(progress-.25)}});
openButton.addEventListener('click',async()=>{
 if(state!=='idle'||!contentsReady||!canOpenCatalog())return;
 if(!window.RIPPR_AUTH_OFFLINE&&!window.RIPPR_ACCOUNT?.user){location.href='auth.html?mode=login&next='+encodeURIComponent(location.pathname+location.search+location.hash);return}
 sound.play('click');
 const uid=window.RIPPR_ACCOUNT?.user?.uid;
 const session=++openingSession;
 state='purchasing';quantityButtons.forEach(b=>b.disabled=true);openButton.disabled=true;controls.classList.add('is-busy');results.classList.remove('visible');phase.textContent='Opening…';
 try{
  if(window.RIPPR_AUTH_OFFLINE)deck=makeDeck();
  else{
   const purchase=await window.RipprAccount.act(inventoryPackId?'openInventoryPack':'purchase',{packId:selectedPack.id,quantity,expectedPriceCents:contents.priceCents,expectedVersion:contents.version,...(inventoryPackId?{inventoryPackId}:{})});
   if(uid!==window.RIPPR_ACCOUNT?.user?.uid||session!==openingSession)return;
   if(inventoryPackId)inventoryStatus='opened';
   deck=purchase.cards.map(card=>({...card,tone:catalog.RARITIES.find(r=>r.name===card.rarity).color}));
  }
  cursor=0;skipBatchAnimations=false;warmCardArt();state='expanding';
  try{await expandOpening()}catch{collapseOpening(false)}
  if(uid!==window.RIPPR_ACCOUNT?.user?.uid||session!==openingSession)return;
  prepareRip();
 }catch(error){
  if(uid!==window.RIPPR_ACCOUNT?.user?.uid||session!==openingSession)return;
  state='idle';quantityButtons.forEach(b=>b.disabled=false);controls.classList.remove('is-busy');phase.textContent=window.RipprAccount?.errorMessage(error)||'Opening is unavailable.';updateOpen();
  if(error.code==='functions/resource-exhausted')document.querySelector('.topup-trigger')?.click();
 }
});
function resetOpening(){clearOpeningTimer();cancelOpeningMotion();warmedArt.clear();releaseDrag();collapseOpening(false);theaterToggle.hidden=true;foil?.reset();skipBatchAnimations=false;sound.stop();openingSession++;selling=false;pendingSale=null;if(saleDialog.open)saleDialog.close();$('#skip-sale-confirmation').disabled=false;$('#confirm-reveal-sale').disabled=false;$('#cancel-reveal-sale').disabled=false;$('.showcase').hidden=false;$('.showcase').classList.remove('opening-focus');setRip(0);ripButton.hidden=true;skipOpening.hidden=true;arena.classList.remove('zoomed','skip-reveal-motion');shell.classList.remove('ripping','unsealed');state='idle';deck=[];cursor=0;results.classList.remove('visible');cards.innerHTML='';controls.classList.remove('is-busy');display.style.visibility='';display.classList.remove('opening');arena.classList.remove('is-revealing');clearRevealEffects();stage.hidden=true;stage.innerHTML='';quantityButtons.forEach(b=>b.disabled=false);phase.textContent='';updateOpen();announcement.textContent='Ready for another opening.';}
$('#again').addEventListener('click',()=>{if(inventoryPackId){location.href='profile.html';return}resetOpening();sound.play('click');openButton.focus({preventScroll:true});window.scrollTo({top:0,left:0,behavior:reduced()?'instant':'smooth'})});

// Ambient animation runs only while the stage is visible and navigation is clear.
(() => {
 let inView = true, navigationOpen = false;
 function updateStageMotion() {
  arena.classList.toggle('is-paused', document.hidden || (!inView&&!theater.open) || navigationOpen);
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
