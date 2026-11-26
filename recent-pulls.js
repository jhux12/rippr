/* Anonymous, server-published pulls. No fabricated activity or purchase actions. */
(()=>{
 'use strict';
 const section=document.querySelector('#recent-pulls');if(!section)return;
 const track=section.querySelector('#recent-pulls-track'),status=section.querySelector('#recent-pulls-status'),retry=section.querySelector('#recent-pulls-retry'),controls=section.querySelector('.recent-pulls-controls'),previous=section.querySelector('#recent-pulls-prev'),next=section.querySelector('#recent-pulls-next'),modeBadge=section.querySelector('#recent-pulls-mode');
 const reduced=matchMedia('(prefers-reduced-motion: reduce)'),packs=new Map((window.RIPPR_PACKS||[]).map(pack=>[pack.id,pack])),rarities=new Map((window.RipprCatalog?.RARITIES||[]).map(rarity=>[rarity.name,rarity.color]));
 const windowMs=7*24*60*60*1000,asset=path=>window.RIPPR_ASSET_URLS?.[path]||path;
 const sortButtons=[...section.querySelectorAll('[data-pull-sort]')],refresh=section.querySelector('#recent-pulls-refresh'),description=section.querySelector('#recent-pulls-description'),dialog=section.querySelector('#recent-pull-preview');
 const money=new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'});
 const imageJobs=new Map(),activeImages=new Set();
 function clearImages(){for(const [image,job] of imageJobs){job.loader?.cancel();if(!image.complete)image.removeAttribute('src')}imageJobs.clear();activeImages.clear()}
 function warmArtwork(){
  if(suspended||document.hidden||track.hidden)return;const bounds=track.getBoundingClientRect();
  const jobs=[...imageJobs.values()].map(job=>({job,box:job.row.getBoundingClientRect()}));
  for(const {job,box} of jobs){
   if(activeImages.size>=3)break;
   if(job.started||box.right<bounds.left-box.width||box.left>bounds.right+box.width*2)continue;
   job.started=true;activeImages.add(job.image);job.image.fetchPriority=box.left<bounds.right?'auto':'low';job.start();
  }
 }
 let sort='biggest',pending=null,previewTrigger=null;
 let generation=0,fetching=false,sourceMode=null,activeMode=runtime(),frame=0,suspended=false;
 function runtime(){const mode=window.RIPPR_RUNTIME?.mode;return mode==='live'||mode==='test'?mode:null}
 function state(title,copy){
  pending=null;refresh.textContent='Refresh';
  clearImages();track.replaceChildren();track.hidden=true;controls.hidden=true;status.hidden=false;status.replaceChildren();
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
   &&Number.isSafeInteger(item.valueCents)&&item.valueCents>=0&&item.valueCents<=100000000
   &&packs.has(item.packId)&&rarities.has(item.rarity)&&validImage(item.image)
   &&item.testOnly===(mode==='test')&&Number.isSafeInteger(item.pulledAtMs)
   &&item.pulledAtMs>=Date.now()-windowMs&&item.pulledAtMs<=Date.now()+60000;
 }
 function ago(item){const minutes=Math.max(0,Math.floor((Date.now()-item.pulledAtMs)/60000));return minutes<1?'Just now':minutes<60?`${minutes}m ago`:minutes<1440?`${Math.floor(minutes/60)}h ago`:`${Math.floor(minutes/1440)}d ago`}
 function badges(item){
  const group=document.createElement('div');group.className='recent-pull-badges';
  const rarity=document.createElement('span');rarity.className='recent-pull-rarity';rarity.textContent=item.rarity;
  const condition=document.createElement('span');condition.className='recent-pull-condition';condition.textContent=window.RipprCatalog.conditionLabel(item);group.append(rarity,condition);return group;
 }
 function closePreview(){if(dialog.open)dialog.close()}
 function preview(item,trigger){
  const pack=packs.get(item.packId);previewTrigger=trigger;dialog.style.setProperty('--pull-accent',rarities.get(item.rarity));
  dialog.querySelector('h2').textContent=item.name;
  const image=document.createElement('img');image.src=asset(item.image);image.alt=item.name;image.referrerPolicy='no-referrer';
  const art=dialog.querySelector('.pull-preview-art');art.replaceChildren(image);
  const unavailable=()=>{image.hidden=true;if(art.querySelector('span'))return;const message=document.createElement('span');message.textContent='Artwork temporarily unavailable';art.append(message)};
  if(window.RipprArtwork?.watch)window.RipprArtwork.watch(image,{onError:unavailable,onLoad:()=>{image.hidden=false;art.querySelector('span')?.remove()}});else image.addEventListener('error',unavailable,{once:true});
  dialog.querySelector('.recent-pull-badges').replaceWith(badges(item));
  dialog.querySelector('.pull-preview-value').textContent=money.format(item.valueCents/100)+' card value';
  dialog.querySelector('.pull-preview-time').textContent='Pulled '+ago(item)+' · Value recorded when pulled';
  const link=dialog.querySelector('.pull-preview-pack');link.href='opening.html?pack='+encodeURIComponent(pack.id);link.querySelector('img').src=asset(pack.image);link.querySelector('span').textContent='View '+pack.name+' pack';
  dialog.showModal();
 }
 dialog.querySelector('.pull-preview-close').addEventListener('click',closePreview);
 dialog.addEventListener('click',event=>{if(event.target===dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)closePreview()}});
 dialog.addEventListener('close',()=>{dialog.querySelector('.pull-preview-art').replaceChildren();if(previewTrigger?.isConnected)previewTrigger.focus({preventScroll:true});previewTrigger=null});
 function tile(item){
  const pack=packs.get(item.packId),row=document.createElement('li');row.dataset.recentPull=item.id;row.dataset.packId=pack.id;row.className='recent-pull';row.style.setProperty('--pull-accent',rarities.get(item.rarity));
  const surface=document.createElement('div');surface.className='recent-pull-surface';
  const inspect=document.createElement('button');inspect.type='button';inspect.className='recent-pull-inspect';inspect.setAttribute('aria-label','Inspect '+item.name);inspect.addEventListener('click',()=>preview(item,inspect));
  if(['Legendary','Special rare'].includes(item.rarity))row.classList.add('is-grail');
  const art=document.createElement('div');art.className='recent-pull-art';const image=document.createElement('img');image.alt=item.name;image.width=250;image.height=350;image.loading='eager';image.decoding='async';image.referrerPolicy='no-referrer';image.draggable=false;
  const job={image,row,started:false,loader:null,start:null};imageJobs.set(image,job);
  function finish(){activeImages.delete(image);if(imageJobs.get(image)===job)warmArtwork()}
  function failedArt(){art.classList.add('art-failed');finish();image.hidden=true;if(art.querySelector('.recent-pull-art-fallback'))return;const fallback=document.createElement('span');fallback.className='recent-pull-art-fallback';fallback.textContent='Artwork temporarily unavailable';art.append(fallback)}
  async function loadedArt(){
   try{await image.decode()}catch{}
   if(imageJobs.get(image)!==job)return;
   image.hidden=false;art.classList.remove('art-failed');art.classList.add('art-ready');art.querySelector('.recent-pull-art-fallback')?.remove();finish();
  }
  job.start=()=>{
   image.src=asset(item.image);
   if(window.RipprArtwork?.watch)job.loader=window.RipprArtwork.watch(image,{onError:failedArt,onLoad:loadedArt});
   else{image.addEventListener('error',failedArt,{once:true});image.addEventListener('load',loadedArt,{once:true});if(image.complete&&image.naturalWidth)void loadedArt()}
  };art.append(image);
  const copy=document.createElement('div');copy.className='recent-pull-copy';const name=document.createElement('h3');name.textContent=item.name;name.title=item.name;
  const source=document.createElement('a');source.className='recent-pull-source';source.href='opening.html?pack='+encodeURIComponent(pack.id);source.setAttribute('aria-label','View '+pack.name+' pack, source of '+item.name);source.textContent='From '+pack.name;const arrow=document.createElementNS('http://www.w3.org/2000/svg','svg');arrow.setAttribute('viewBox','0 0 16 16');arrow.setAttribute('aria-hidden','true');arrow.setAttribute('focusable','false');const path=document.createElementNS('http://www.w3.org/2000/svg','path');path.setAttribute('d','M4 12 12 4M4 4h8v8');arrow.append(path);source.append(arrow);const detail=document.createElement('div');detail.className='recent-pull-detail';const value=document.createElement('strong');value.textContent=money.format(item.valueCents/100);value.title='Card value recorded when pulled';const time=document.createElement('time');time.dateTime=new Date(item.pulledAtMs).toISOString();time.title=new Date(item.pulledAtMs).toLocaleString();time.textContent=ago(item);detail.append(value,time);
  copy.append(name,badges(item),detail);inspect.append(art,copy);surface.append(inspect,source);row.append(surface);return row;
 }
 function measure(){
  frame=0;const max=track.scrollWidth-track.clientWidth,overflow=!track.hidden&&max>2;
  warmArtwork();controls.hidden=!overflow;previous.disabled=!overflow||track.scrollLeft<=2;next.disabled=!overflow||track.scrollLeft>=max-2;
 }
 function schedule(){if(!frame&&!suspended)frame=requestAnimationFrame(measure)}
 function move(direction){
  const card=track.firstElementChild;if(!card)return;
  const distance=card.getBoundingClientRect().width+(parseFloat(getComputedStyle(track).columnGap)||0);
  track.scrollBy({left:direction*distance,behavior:reduced.matches?'instant':'smooth'});
 }
 function apply(items){
  closePreview();clearImages();track.replaceChildren(...items.map(tile));track.scrollLeft=0;track.hidden=false;status.hidden=true;pending=null;refresh.textContent='Refresh';schedule();
  if(!reduced.matches)for(const row of track.children){try{row.animate([{opacity:.4,transform:'translateY(5px)'},{opacity:1,transform:'translateY(0)'}],{duration:220,easing:'ease-out'})}catch{}}
 }
 async function load(force=false,preserve=false){
  const ticket=++generation;fetching=true;sourceMode=runtime();activeMode=sourceMode;retry.hidden=true;refresh.disabled=true;track.setAttribute('aria-busy','true');modeBadge.hidden=sourceMode!=='test';if(!preserve)state(sort==='biggest'?'Finding the biggest pulls…':'Finding the latest pulls…');
  let timer;
  try{
   if(window.RIPPR_AUTH_OFFLINE||typeof window.RipprFirebase?.loadRecentPulls!=='function')throw Error('Recent pulls unavailable');
   const saved=await Promise.race([window.RipprFirebase.loadRecentPulls({force,sort}),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Recent pulls timed out')),10000)})]);
   if(ticket!==generation||suspended)return;
   const mode=runtime();if(!mode||saved?.mode!==mode||saved?.source!=='firebase'||!Array.isArray(saved.items))throw Error('Recent pulls changed');
   activeMode=mode;modeBadge.hidden=mode!=='test';const seen=new Set(),items=saved.items.filter(item=>{if(!validPull(item,mode)||seen.has(item.id))return false;seen.add(item.id);return true}).sort((a,b)=>sort==='biggest'?b.valueCents-a.valueCents||b.pulledAtMs-a.pulledAtMs:b.pulledAtMs-a.pulledAtMs).slice(0,12);
   if(!items.length){state('The next pull starts here.','Cards will appear here as packs are opened.');return}
   if(preserve&&(track.scrollLeft>2||track.contains(document.activeElement)||track.matches(':hover')||dialog.open)){pending=items;refresh.textContent='Show updated pulls';return}
   apply(items);
  }catch{
   if(ticket!==generation||suspended)return;
   if(!preserve)state(sort==='biggest'?'Biggest pulls are taking a moment.':'Recent pulls are taking a moment.',sort==='biggest'?'Try Latest while the weekly ranking is prepared.':'Try again to see the latest cards.');retry.hidden=false;
  }finally{clearTimeout(timer);if(ticket===generation){fetching=false;refresh.disabled=false;track.setAttribute('aria-busy','false')}}
 }
 for(const button of sortButtons)button.addEventListener('click',()=>{
  if(sort===button.dataset.pullSort)return;sort=button.dataset.pullSort;pending=null;refresh.textContent='Refresh';closePreview();
  sortButtons.forEach(item=>item.setAttribute('aria-pressed',String(item===button)));
  description.textContent=sort==='biggest'?'Highest-value cards pulled in the last 7 days.':'Latest cards pulled · Last 7 days.';
  track.setAttribute('aria-label',sort==='biggest'?'Biggest pulls from the last seven days':'Latest cards and their source packs');void load();
 });
 refresh.addEventListener('click',()=>{if(pending){apply(pending);return}if(!fetching)void load(true,true)});
 previous.addEventListener('click',()=>move(-1));next.addEventListener('click',()=>move(1));retry.addEventListener('click',()=>void load(true));track.addEventListener('scroll',schedule,{passive:true});
 track.addEventListener('keydown',event=>{if(event.target!==track)return;if(event.key==='ArrowLeft'||event.key==='ArrowRight'){event.preventDefault();move(event.key==='ArrowRight'?1:-1)}else if(event.key==='Home'||event.key==='End'){event.preventDefault();track.scrollTo({left:event.key==='Home'?0:track.scrollWidth,behavior:reduced.matches?'instant':'smooth'})}});
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)schedule()});
 const observer=typeof ResizeObserver==='function'?new ResizeObserver(schedule):null;observer?.observe(track);window.addEventListener('resize',schedule);
 document.addEventListener('rippr:runtimechange',()=>{const mode=runtime();if(mode===activeMode)return;activeMode=mode;pending=null;closePreview();state('Finding the latest pulls…');modeBadge.hidden=mode!=='test';if(fetching&&sourceMode===null)return;void load(true)});
 window.addEventListener('pagehide',()=>{clearImages();closePreview();pending=null;suspended=true;generation++;fetching=false;cancelAnimationFrame(frame);frame=0});
 window.addEventListener('pageshow',event=>{suspended=false;if(event.persisted)void load(true)});
 void load();
})();
