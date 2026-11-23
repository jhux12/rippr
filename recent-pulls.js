/* Anonymous, server-published pulls. No fabricated activity or purchase actions. */
(()=>{
 'use strict';
 const section=document.querySelector('#recent-pulls');if(!section)return;
 const track=section.querySelector('#recent-pulls-track'),status=section.querySelector('#recent-pulls-status'),retry=section.querySelector('#recent-pulls-retry'),controls=section.querySelector('.recent-pulls-controls'),previous=section.querySelector('#recent-pulls-prev'),next=section.querySelector('#recent-pulls-next'),modeBadge=section.querySelector('#recent-pulls-mode');
 const reduced=matchMedia('(prefers-reduced-motion: reduce)'),packs=new Map((window.RIPPR_PACKS||[]).map(pack=>[pack.id,pack])),rarities=new Map((window.RipprCatalog?.RARITIES||[]).map(rarity=>[rarity.name,rarity.color]));
 const windowMs=7*24*60*60*1000,asset=path=>window.RIPPR_ASSET_URLS?.[path]||path;
 let generation=0,fetching=false,sourceMode=null,activeMode=runtime(),frame=0,suspended=false;
 function runtime(){const mode=window.RIPPR_RUNTIME?.mode;return mode==='live'||mode==='test'?mode:null}
 function state(title,copy){
  track.replaceChildren();track.hidden=true;controls.hidden=true;status.hidden=false;status.replaceChildren();
  const pip=document.createElement('img');pip.src=asset('assets/hero/pip-hover.webp');pip.alt='';pip.width=48;pip.height=48;
  const content=document.createElement('div'),heading=document.createElement('p');heading.textContent=title;content.append(heading);
  if(copy){const detail=document.createElement('span');detail.textContent=copy;content.append(detail)}status.append(pip,content);
 }
 function validImage(image){
  if(!window.RipprCatalog?.safeImageURL(image))return false;
  try{let path=new URL(image,'https://www.rippr.gg').pathname;for(let i=0;i<3;i++){const decoded=decodeURIComponent(path);if(decoded===path)break;path=decoded}return !/(?:^|\/)(?:profile-images|support-attachments|private|testAccounts|liveAccounts)(?:\/|$)/i.test(path)&&!/(?:placeholder|rippr-card-back)(?:\.[a-z0-9]+)?$/i.test(path)}catch{return false}
 }
 function validPull(item,mode){
  return item&&typeof item.name==='string'&&Boolean(item.name.trim())&&item.name.length<=100
   &&typeof item.id==='string'&&/^[a-zA-Z0-9_-]{1,128}$/.test(item.id)
   &&packs.has(item.packId)&&rarities.has(item.rarity)&&validImage(item.image)
   &&item.testOnly===(mode==='test')&&Number.isSafeInteger(item.pulledAtMs)
   &&item.pulledAtMs>=Date.now()-windowMs&&item.pulledAtMs<=Date.now()+60000;
 }
 function tile(item){
  const pack=packs.get(item.packId),row=document.createElement('li');row.dataset.recentPull=item.id;row.dataset.packId=pack.id;row.className='recent-pull';row.style.setProperty('--pull-accent',rarities.get(item.rarity));
  const link=document.createElement('a');link.href='opening.html?pack='+encodeURIComponent(pack.id);link.setAttribute('aria-label','View '+pack.name+' pack, source of '+item.name);
  const art=document.createElement('div');art.className='recent-pull-art';const image=document.createElement('img');image.src=asset(item.image);image.alt=item.name;image.width=250;image.height=350;image.loading='lazy';image.decoding='async';image.referrerPolicy='no-referrer';image.draggable=false;
  function failedArt(){image.hidden=true;if(art.querySelector('.recent-pull-art-fallback'))return;const fallback=document.createElement('span');fallback.className='recent-pull-art-fallback';fallback.textContent='Artwork temporarily unavailable';art.append(fallback)}
  if(window.RipprArtwork?.watch)window.RipprArtwork.watch(image,{onError:failedArt,onLoad:()=>{image.hidden=false;art.querySelector('.recent-pull-art-fallback')?.remove()}});else image.addEventListener('error',failedArt,{once:true});art.append(image);
  const copy=document.createElement('div');copy.className='recent-pull-copy';const name=document.createElement('h3');name.textContent=item.name;name.title=item.name;
  const badges=document.createElement('div');badges.className='recent-pull-badges';const rarity=document.createElement('span');rarity.className='recent-pull-rarity';rarity.textContent=item.rarity;const condition=document.createElement('span');condition.className='recent-pull-condition';condition.textContent=window.RipprCatalog.conditionLabel(item);badges.append(rarity,condition);
  const source=document.createElement('span');source.className='recent-pull-source';source.textContent='From '+pack.name;const arrow=document.createElementNS('http://www.w3.org/2000/svg','svg');arrow.setAttribute('viewBox','0 0 16 16');arrow.setAttribute('aria-hidden','true');arrow.setAttribute('focusable','false');const path=document.createElementNS('http://www.w3.org/2000/svg','path');path.setAttribute('d','M4 12 12 4M4 4h8v8');arrow.append(path);source.append(arrow);copy.append(name,badges,source);link.append(art,copy);row.append(link);return row;
 }
 function measure(){
  frame=0;const max=track.scrollWidth-track.clientWidth,overflow=!track.hidden&&max>2;
  controls.hidden=!overflow;previous.disabled=!overflow||track.scrollLeft<=2;next.disabled=!overflow||track.scrollLeft>=max-2;
 }
 function schedule(){if(!frame&&!suspended)frame=requestAnimationFrame(measure)}
 function move(direction){
  const card=track.firstElementChild;if(!card)return;
  const distance=card.getBoundingClientRect().width+(parseFloat(getComputedStyle(track).columnGap)||0);
  track.scrollBy({left:direction*distance,behavior:reduced.matches?'instant':'smooth'});
 }
 async function load(force=false){
  const ticket=++generation;fetching=true;sourceMode=runtime();activeMode=sourceMode;retry.hidden=true;track.setAttribute('aria-busy','true');modeBadge.hidden=sourceMode!=='test';state('Finding the latest pulls…');
  let timer;
  try{
   if(window.RIPPR_AUTH_OFFLINE||typeof window.RipprFirebase?.loadRecentPulls!=='function')throw Error('Recent pulls unavailable');
   const saved=await Promise.race([window.RipprFirebase.loadRecentPulls({force}),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Recent pulls timed out')),10000)})]);
   if(ticket!==generation||suspended)return;
   const mode=runtime();if(!mode||saved?.mode!==mode||saved?.source!=='firebase'||!Array.isArray(saved.items))throw Error('Recent pulls changed');
   activeMode=mode;modeBadge.hidden=mode!=='test';const seen=new Set(),items=saved.items.filter(item=>{if(!validPull(item,mode)||seen.has(item.id))return false;seen.add(item.id);return true}).sort((a,b)=>b.pulledAtMs-a.pulledAtMs).slice(0,12);
   if(!items.length){state('The next pull starts here.','Cards will appear here as packs are opened.');return}
   track.replaceChildren(...items.map(tile));track.scrollLeft=0;track.hidden=false;status.hidden=true;schedule();
  }catch{
   if(ticket!==generation||suspended)return;
   state('Recent pulls are taking a moment.','Try again to see the latest cards.');retry.hidden=false;
  }finally{clearTimeout(timer);if(ticket===generation){fetching=false;track.setAttribute('aria-busy','false')}}
 }
 previous.addEventListener('click',()=>move(-1));next.addEventListener('click',()=>move(1));retry.addEventListener('click',()=>void load(true));track.addEventListener('scroll',schedule,{passive:true});
 track.addEventListener('keydown',event=>{if(event.target!==track)return;if(event.key==='ArrowLeft'||event.key==='ArrowRight'){event.preventDefault();move(event.key==='ArrowRight'?1:-1)}else if(event.key==='Home'||event.key==='End'){event.preventDefault();track.scrollTo({left:event.key==='Home'?0:track.scrollWidth,behavior:reduced.matches?'instant':'smooth'})}});
 const observer=typeof ResizeObserver==='function'?new ResizeObserver(schedule):null;observer?.observe(track);window.addEventListener('resize',schedule);
 document.addEventListener('rippr:runtimechange',()=>{const mode=runtime();if(mode===activeMode)return;activeMode=mode;state('Finding the latest pulls…');modeBadge.hidden=mode!=='test';if(fetching&&sourceMode===null)return;void load(true)});
 window.addEventListener('pagehide',()=>{suspended=true;generation++;fetching=false;cancelAnimationFrame(frame);frame=0});
 window.addEventListener('pageshow',event=>{suspended=false;if(event.persisted)void load(true)});
 void load();
})();
