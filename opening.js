const $=s=>document.querySelector(s);
const packCatalog=typeof window!=='undefined'&&Array.isArray(window.RIPPR_PACKS)?window.RIPPR_PACKS:[];
const packId=typeof location!=='undefined'?new URLSearchParams(location.search).get('pack'):null;
const inventoryPackId=new URLSearchParams(location.search).get('inventory');
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

const quantityButtons=[...document.querySelectorAll('[data-qty]')],openButton=$('#open'),display=$('#display'),arena=$('.arena'),stage=$('#reveal-stage'),controls=$('.controls'),results=$('#results'),cards=$('#cards'),announcement=$('#announcement'),phase=$('#phase'),skipOpening=$('#skip-opening');
let quantity=1,state='idle',deck=[],cursor=0,openingTimer,openingSession=0,selling=false,pendingSale=null;
const sound=window.RipprOpeningAudio||{play:()=>false,stop:()=>{}};
const reduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
const catalog=window.RipprCatalog;
let contents=catalog.defaultPack(selectedPack.id),contentsReady=false,artReady=false,loadError=false;
const oddsPanel=$('.odds-table-panel');
const escape=value=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const cardImage=card=>window.RIPPR_ASSET_URLS?.[card.image]||card.image;
const formatChance=value=>(value/100).toLocaleString('en-US',{maximumFractionDigits:2})+'%';
const money=new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'});
const rarityBadge=name=>`<span class="rarity-badge" style="--rarity-color:${catalog.RARITIES.find(rarity=>rarity.name===name).color}"><span class="rarity-dot" aria-hidden="true"></span>${escape(name)}</span>`;
function updateOpen(){openButton.disabled=!artReady||!contentsReady||!contents.enabled||state!=='idle';label()}
function renderContents(note){
 const table=$('.odds-table-panel table');
 table.querySelector('thead').innerHTML='<tr><th scope="col">Rarity</th><th scope="col">Chance</th><th scope="col" aria-label="Minimum to maximum item value">Value</th></tr>';
 table.querySelector('tbody').innerHTML=catalog.summarizeRarities(contents.items).map(group=>{const min=money.format(group.minValueCents/100),max=money.format(group.maxValueCents/100);return `<tr><th scope="row">${rarityBadge(group.rarity)}</th><td>${formatChance(group.chanceBps)}</td><td class="odds-value-range" aria-label="Minimum ${min}, maximum ${max}">${min}${group.minValueCents===group.maxValueCents?'':`<span aria-hidden="true">–</span><wbr>${max}`}</td></tr>`}).join('');
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
 }catch{loadError=true;phase.textContent='Pack contents could not load. Reload to try again.';const table=oddsPanel.querySelector('table');table.setAttribute('aria-busy','false');table.querySelector('caption').textContent='Contents unavailable';table.querySelector('tbody').innerHTML='<tr><td colspan="3" class="odds-loading">Odds unavailable. Reload to try again.</td></tr>';$('.grail-grid').innerHTML='<p class="empty-grails">Grails could not load.</p>';$('.grail-grid').setAttribute('aria-busy','false')}
 finally{if(!contents.enabled)phase.textContent='This pack is currently unavailable.';updateOpen()}
}
document.addEventListener('DOMContentLoaded',loadContents,{once:true});
function label(){
 if(state!=='idle')return;
 $('#pack-price').textContent=inventoryPackId?'Owned pack':contentsReady?money.format(contents.priceCents/100):'—';$('#price-suffix').hidden=Boolean(inventoryPackId);
 if(!contentsReady){openButton.textContent=loadError?'Pack unavailable':'Loading pack…';return}
 if(!contents.enabled){openButton.textContent='Pack unavailable';return}
 if(inventoryPackId){openButton.textContent=window.RIPPR_ACCOUNT?.user?'Open reward pack':'Log in to open reward pack';return}
 const packs=`${quantity} pack${quantity===1?'':'s'}`;
 openButton.textContent=(window.RIPPR_AUTH_OFFLINE?'Preview':window.RIPPR_ACCOUNT?.user?'Open':'Log in to open')+' '+packs+' · '+money.format(contents.priceCents*quantity/100);
}
document.addEventListener('rippr:authchange',()=>{if(state!=='idle')resetOpening();label()});
if(inventoryPackId){$('.quantities').hidden=true;$('#quantity-control').hidden=true;$('.back').href='profile.html';$('.back').textContent='← Back to my items';$('#again').textContent='Back to my items';}
quantityButtons.forEach(button=>button.addEventListener('click',()=>{if(state!=='idle')return;sound.play('click');quantity=Number(button.dataset.qty);quantityButtons.forEach(b=>{b.classList.toggle('selected',b===button);b.setAttribute('aria-pressed',String(b===button))});label()}));
function randomUnit(){const v=new Uint32Array(1);crypto.getRandomValues(v);return v[0]/4294967296}
function makeDeck(){return Array.from({length:quantity},(_,p)=>{const card=catalog.drawItem(contents.items,randomUnit());return {...card,pack:p+1,tone:catalog.RARITIES.find(r=>r.name===card.rarity).color}})}
const revealPhaseClasses=['is-extracting','is-cycling','is-settling','is-flipping','is-card-revealed'];
const cycleDelays=[100,100,110,110,120,120,130,140,155,175,200,230,270,320];
function clearRevealEffects(){arena.classList.remove(...revealPhaseClasses);delete arena.dataset.revealRarity;delete arena.dataset.cycleIndex;}
const revealSpark='<svg viewBox="0 0 24 28" aria-hidden="true"><path d="M12 0C13 9 15 12 24 14C15 16 13 19 12 28C11 19 9 16 0 14C9 12 11 9 12 0Z"/></svg>';
const cardBackImage=window.RIPPR_REVEAL_BACK_URL||'assets/reveal/rippr-card-back.png';
const preloadBack=new Image();preloadBack.src=cardBackImage;
const saleDialog=$('#reveal-sale-dialog');
function revealNavigation(){document.dispatchEvent(new CustomEvent('rippr:navigationchange',{detail:{menuOpen:!document.querySelector('#mobile-navigation')?.hidden,dialogOpen:Boolean(document.querySelector('dialog[open]'))}}))}
function savedCardStatus(c){return window.RIPPR_ACCOUNT?.items?.find(item=>item.id===c.id)?.status||c.status||'available'}
function syncRevealActions(){
 if(state!=='revealing'||!deck[cursor])return;
 const c=deck[cursor],status=savedCardStatus(c),unavailable=status!=='available';
 $('#next').disabled=selling;
 $('#next').textContent=unavailable?'Continue':'Add to inventory';
 $('#sell-card').disabled=selling||Boolean(window.RIPPR_AUTH_OFFLINE)||unavailable;
 $('#sell-card').textContent=selling?'Selling…':status==='sold'?'Sold':status==='shipping'?'Shipping requested':`Sell for ${money.format(c.valueCents/100)}`;
 if(unavailable)c.status=status;
}
function renderCard(instant=false){
 clearTimeout(openingTimer);
 const c=deck[cursor];
 clearRevealEffects();state='extracting';arena.classList.add('is-extracting');arena.style.setProperty('--reveal-tone','#92b4d4');
 stage.innerHTML=`<p class="reveal-meta" ${deck.length===1?'hidden':''}>Pack ${cursor+1} of ${deck.length}</p><div class="reveal-rarity" aria-hidden="true">${revealSpark}<span>${escape(c.rarity)}</span></div><div class="reveal-art-stage"><div class="reveal-halo" aria-hidden="true"></div><div class="reveal-motes" aria-hidden="true">${Array.from({length:7},(_,i)=>`<i style="--i:${i};--mote-top:${8+(i*29)%85}%"></i>`).join('')}</div><div class="spotlight-card"><div class="reveal-card-turn"><div class="reveal-face reveal-front" aria-hidden="true"><img class="revealed-art" src="${escape(cardImage(c))}" alt="${escape(c.name)}"><span class="reveal-art-fallback" hidden>Artwork unavailable</span></div><div class="reveal-face reveal-back" role="img" aria-label="Face-down rippr card"><img src="${escape(cardBackImage)}" alt="" draggable="false"></div></div><svg class="reveal-edge" viewBox="0 0 300 420" preserveAspectRatio="none" aria-hidden="true"><rect x="2" y="2" width="296" height="416" rx="17" pathLength="100"/></svg></div><span class="reveal-plinth" aria-hidden="true"></span></div><div class="reveal-information" inert aria-hidden="true"><h2 id="reveal-name" title="${escape(c.name)}">${escape(c.name)}</h2><p class="reveal-value">${money.format(c.valueCents/100)}</p></div><div class="reveal-actions" inert aria-hidden="true"><button type="button" id="next" class="keep-card">Add to inventory</button><button type="button" id="sell-card" class="sell-card" ${window.RIPPR_AUTH_OFFLINE?'disabled title="Selling is unavailable in offline previews."':''}>Sell for ${money.format(c.valueCents/100)}</button></div>`;
 const art=$('.reveal-front .revealed-art');
 art.addEventListener('error',()=>{art.hidden=true;art.nextElementSibling.hidden=false},{once:true});
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
  openingTimer=setTimeout(beginRarityCycle,900);
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
 openingTimer=setTimeout(()=>cycleRarityColor(index+1),cycleDelays[index]);
}
function landRarity(){
 if(state!=='cycling')return;
 state='settling';arena.classList.remove('is-cycling');arena.classList.add('is-settling');
 applyWinningRarity();announcement.textContent=`${deck[cursor].rarity}. Revealing your card.`;
 openingTimer=setTimeout(flipCard,480);
}
function applyWinningRarity(){
 const c=deck[cursor];arena.style.setProperty('--reveal-tone',c.tone);arena.dataset.revealRarity=c.rarity;
 const badge=$('.reveal-rarity');badge.style.setProperty('--rarity-color',c.tone);badge.removeAttribute('aria-hidden');
}
function flipCard(){
 if(state!=='settling')return;
 state='flipping';arena.classList.remove('is-settling');arena.classList.add('is-flipping');sound.play('flip',{channel:'motion'});
 openingTimer=setTimeout(()=>completeCardReveal(false),650);
}
function completeCardReveal(instant){
 if(!['extracting','cycling','settling','flipping'].includes(state))return;
 clearTimeout(openingTimer);state='revealing';sound.stop('motion');sound.stop('foil');
 arena.classList.remove('is-extracting','is-cycling','is-settling','is-flipping');arena.classList.add('is-card-revealed');applyWinningRarity();
 arena.classList.toggle('skip-reveal-motion',instant);skipOpening.hidden=true;
 $('.reveal-front').removeAttribute('aria-hidden');$('.reveal-back').setAttribute('aria-hidden','true');
 for(const element of stage.querySelectorAll('.reveal-information,.reveal-actions')){element.removeAttribute('inert');element.removeAttribute('aria-hidden')}
 const c=deck[cursor];announcement.textContent=`Card ${cursor+1} of ${deck.length}: ${c.rarity}, ${c.name}, ${money.format(c.valueCents/100)}.`;
 if(!instant)sound.play(c.rarity==='Legendary'?'legendary':['Epic','Special rare'].includes(c.rarity)?'epic':['Rare','Ultra rare'].includes(c.rarity)?'rare':'common',{channel:'reveal'});
 const name=$('#reveal-name');if(name.scrollHeight>name.clientHeight)name.tabIndex=0;
 syncRevealActions();$('#next').focus({preventScroll:true});
}
function advanceReveal(){if(cursor<deck.length-1){cursor++;prepareRip()}else finish()}
function confirmRevealSale(){
 if(state!=='revealing'||selling||window.RIPPR_AUTH_OFFLINE||!window.RIPPR_ACCOUNT?.user)return;
 const c=deck[cursor];if(savedCardStatus(c)!=='available')return;
 pendingSale={card:c,uid:window.RIPPR_ACCOUNT.user.uid,session:openingSession};
 $('#reveal-sale-name').textContent=c.name;
 $('#reveal-sale-description').textContent=`${money.format(c.valueCents/100)} will be added to your test balance. This card will leave your available inventory.`;
 $('#confirm-reveal-sale').textContent=`Sell for ${money.format(c.valueCents/100)}`;
 $('#reveal-sale-error').hidden=true;saleDialog.showModal();revealNavigation();
}
$('#confirm-reveal-sale').addEventListener('click',async()=>{
 if(selling||!pendingSale)return;
 const target=pendingSale;if(target.uid!==window.RIPPR_ACCOUNT?.user?.uid||target.session!==openingSession)return;
 selling=true;$('#confirm-reveal-sale').disabled=true;$('#cancel-reveal-sale').disabled=true;syncRevealActions();
 try{
  const result=await window.RipprAccount.act('sell',{itemIds:[target.card.id]});
  if(target.uid!==window.RIPPR_ACCOUNT?.user?.uid||target.session!==openingSession)return;
  target.card.status='sold';target.card.soldCents=result.soldCents;
  selling=false;saleDialog.close();sound.play('click');advanceReveal();
 }catch(error){
  if(target.uid!==window.RIPPR_ACCOUNT?.user?.uid||target.session!==openingSession)return;
  $('#reveal-sale-error').textContent=window.RipprAccount.errorMessage(error);$('#reveal-sale-error').hidden=false;
 }finally{
  if(target.session===openingSession){selling=false;$('#confirm-reveal-sale').disabled=false;$('#cancel-reveal-sale').disabled=false;syncRevealActions()}
 }
});
$('#cancel-reveal-sale').addEventListener('click',()=>{if(!selling)saleDialog.close()});
saleDialog.addEventListener('cancel',event=>{if(selling)event.preventDefault()});
saleDialog.addEventListener('close',()=>{pendingSale=null;revealNavigation()});
document.addEventListener('rippr:walletchange',syncRevealActions);
function finish(){
 if(state!=='revealing')return;sound.stop('motion');sound.stop('reveal');state='complete';$('.showcase').hidden=true;stage.hidden=true;arena.classList.remove('is-revealing');display.style.visibility='hidden';cards.innerHTML='';
 deck.forEach((c,i)=>{const article=document.createElement('article');article.className='result-card';article.style.setProperty('--tone',c.tone);article.style.animationDelay=`${Math.min(i,12)*.025}s`;article.innerHTML=`${rarityBadge(c.rarity)}<img class="revealed-art" src="${escape(cardImage(c))}" alt="${escape(c.name)}"><strong>${escape(c.name)}</strong>${window.RIPPR_AUTH_OFFLINE?'':`<p class="result-disposition">${c.status==='sold'?`Sold for ${money.format((c.soldCents??c.valueCents)/100)}`:c.status==='shipping'?'Shipping requested':'Added to inventory'}</p>`}`;cards.append(article)});
 const sold=deck.filter(c=>c.status==='sold').length,kept=deck.filter(c=>c.status!=='sold'&&c.status!=='shipping').length;
 results.classList.add('visible');$('#summary').textContent=window.RIPPR_AUTH_OFFLINE?'Offline preview. Results are not saved.':`${kept} card${kept===1?'':'s'} in your inventory.${sold?` ${sold} sold.`:''}`;
 $('#result-title').textContent=deck.length===1?'Your card':'Your cards';phase.textContent='';announcement.textContent=`Opening complete. ${$('#summary').textContent}`;$('#result-title').focus({preventScroll:true});results.scrollIntoView({behavior:reduced()?'instant':'smooth',block:'start'});
}
const shell=$('#pack-shell'),ripButton=$('#rip-foil');
let drag=null,progress=0;
const packImage=new Image();openButton.disabled=true;
packImage.onload=()=>{document.documentElement.style.setProperty('--pack-ratio',String(packImage.naturalWidth/packImage.naturalHeight));artReady=true;updateOpen()};
packImage.onerror=()=>{phase.textContent='Pack image could not load. Please reload.'};
packImage.src=selectedPack.image;
function setRip(value){progress=Math.max(0,Math.min(1,value));shell.style.setProperty('--rip',progress);ripButton.setAttribute('aria-label',`Rip top foil: ${Math.round(progress*100)} percent. Drag across, or press Enter`)}
function prepareRip(){
 sound.stop('motion');sound.stop('reveal');sound.stop('foil');
 const previousBounds=shell.getBoundingClientRect();
 clearTimeout(openingTimer);state='zooming';stage.hidden=true;skipOpening.hidden=false;arena.classList.remove('is-revealing','skip-reveal-motion');clearRevealEffects();display.style.visibility='';
 shell.classList.remove('ripping','unsealed');setRip(0);ripButton.hidden=true;
 $('.showcase').classList.add('opening-focus');arena.classList.add('zoomed');
 if(!reduced()){const now=shell.getBoundingClientRect();shell.animate([{translate:`${previousBounds.x+previousBounds.width/2-now.x-now.width/2}px ${previousBounds.y+previousBounds.height/2-now.y-now.height/2}px`},{translate:'0 0'}],{duration:500,easing:'cubic-bezier(.2,.8,.2,1)'})}phase.textContent='';announcement.textContent=`Pack ${cursor+1} of ${deck.length}. Zooming in.`;
 openingTimer=setTimeout(()=>{state='ripping';shell.classList.add('ripping');ripButton.hidden=false;phase.textContent='';announcement.textContent=`Pack ${cursor+1} of ${deck.length}. Drag across the foil, or press Enter to rip.`;ripButton.focus({preventScroll:true})},reduced()?0:500);
}
function completeRip(){
 if(state!=='ripping')return;state='unsealing';drag=null;setRip(1);ripButton.hidden=true;shell.classList.add('unsealed');phase.textContent='';
 announcement.textContent='Foil removed. Revealing your card.';sound.play('rip',{channel:'foil'});
 openingTimer=setTimeout(()=>showReveal(false),reduced()?0:180);
}
function showReveal(instant){
 if(!['zooming','ripping','unsealing'].includes(state))return;
 clearTimeout(openingTimer);drag=null;setRip(1);ripButton.hidden=true;skipOpening.hidden=true;
 shell.getAnimations().forEach(animation=>animation.cancel());
 arena.classList.add('is-revealing');arena.classList.toggle('skip-reveal-motion',instant);stage.hidden=false;renderCard(instant);
}
skipOpening.addEventListener('click',()=>{sound.stop();if(['extracting','cycling','settling','flipping'].includes(state))completeCardReveal(true);else showReveal(true)});
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
 sound.play('click');
 const uid=window.RIPPR_ACCOUNT?.user?.uid;
 const session=++openingSession;
 state='purchasing';quantityButtons.forEach(b=>b.disabled=true);openButton.disabled=true;controls.classList.add('is-busy');results.classList.remove('visible');phase.textContent='Opening…';
 try{
  if(window.RIPPR_AUTH_OFFLINE)deck=makeDeck();
  else{
   const purchase=await window.RipprAccount.act(inventoryPackId?'openInventoryPack':'purchase',{packId:selectedPack.id,quantity,expectedPriceCents:contents.priceCents,expectedVersion:contents.version,...(inventoryPackId?{inventoryPackId}:{})});
   if(uid!==window.RIPPR_ACCOUNT?.user?.uid||session!==openingSession)return;
   deck=purchase.cards.map(card=>({...card,tone:catalog.RARITIES.find(r=>r.name===card.rarity).color}));
  }
  cursor=0;prepareRip();
 }catch(error){
  if(uid!==window.RIPPR_ACCOUNT?.user?.uid||session!==openingSession)return;
  state='idle';quantityButtons.forEach(b=>b.disabled=false);controls.classList.remove('is-busy');phase.textContent=window.RipprAccount?.errorMessage(error)||'Opening is unavailable.';updateOpen();
  if(error.code==='functions/resource-exhausted')document.querySelector('.topup-trigger')?.click();
 }
});
function resetOpening(){sound.stop();openingSession++;selling=false;pendingSale=null;if(saleDialog.open)saleDialog.close();$('#confirm-reveal-sale').disabled=false;$('#cancel-reveal-sale').disabled=false;clearTimeout(openingTimer);$('.showcase').hidden=false;$('.showcase').classList.remove('opening-focus');drag=null;setRip(0);ripButton.hidden=true;skipOpening.hidden=true;arena.classList.remove('zoomed','skip-reveal-motion');shell.classList.remove('ripping','unsealed');state='idle';deck=[];cursor=0;results.classList.remove('visible');cards.innerHTML='';controls.classList.remove('is-busy');display.style.visibility='';display.classList.remove('opening');arena.classList.remove('is-revealing');clearRevealEffects();stage.hidden=true;stage.innerHTML='';quantityButtons.forEach(b=>b.disabled=false);phase.textContent='';updateOpen();announcement.textContent='Ready for another opening.';}
$('#again').addEventListener('click',()=>{if(inventoryPackId){location.href='profile.html';return}resetOpening();sound.play('click');openButton.focus({preventScroll:true});window.scrollTo({top:0,left:0,behavior:reduced()?'instant':'smooth'})});

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
