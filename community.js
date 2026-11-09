(() => {
 'use strict';
 const $=selector=>document.querySelector(selector),grid=$('#community-grid'),status=$('#community-status'),more=$('#community-more');
 const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const safeImage=value=>window.RipprCatalog?.safeImageURL(value)?value:'assets/card-placeholder.svg';
 const avatar=value=>window.RipprCatalog?.safeImageURL(value)?value:'assets/mascot/pip-welcome.png';
 const asset=value=>window.RIPPR_ASSET_URLS?.[value]||value;
 const arrow='<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 16 16 4M4 4h12v12"/></svg>';
 const heart='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/></svg>';
 const pendingLikes=new Map();
 let generation=0,loading=false,cursor=null,search='',sort='recent',museums=new Map(),lastError=false;
 function empty(title,copy,retry=false){
  grid.innerHTML=`<div class="community-empty"><img src="${window.RIPPR_MASCOT_URLS?.hover||'assets/mascot/pip-hover.png'}" alt="" width="100" height="100"><h2>${escape(title)}</h2><p>${escape(copy)}</p>${retry?'<button type="button" class="community-outline" data-retry>Try again</button>':'<a class="community-primary" href="museum.html">Create your museum ↗</a>'}</div>`;
 }
 function render(){
  if(!museums.size){empty(search?'No matches on this page.':'Be the first to open your doors.',search?'Try another name, or explore the next page of museums.':'Choose cards from your collection and publish a museum for others to discover.');return}
  grid.innerHTML=[...museums.values()].map(m=>{
   const url='museum.html?user='+encodeURIComponent(m.uid),count=Number.isSafeInteger(m.cardCount)?m.cardCount:0,likes=Number.isSafeInteger(m.likeCount)&&m.likeCount>=0?m.likeCount:0;
   const self=m.uid===window.RIPPR_ACCOUNT?.user?.uid;
   return `<article class="community-card"><a class="community-scene" href="${escape(url)}" aria-label="Visit ${escape(m.title)} by ${escape(m.displayName)}"><span class="community-scene-label">${count} ${count===1?'display':'displays'}</span><span class="community-pedestal" aria-hidden="true"></span><span class="community-slab"><img src="${escape(asset(safeImage(m.coverImage)))}" alt="Featured card from ${escape(m.title)}" loading="lazy"></span></a><div class="community-card-copy"><div class="community-collector"><img src="${escape(asset(avatar(m.photoURL)))}" alt="" loading="lazy"><span>${escape(m.displayName||'Collector')}</span></div><h2><a href="${escape(url)}">${escape(m.title)}</a></h2><p class="community-description">${escape(m.description||'A collection worth sharing.')}</p><div class="community-card-footer"><button type="button" class="community-likes" data-like="${escape(m.uid)}" aria-label="${self?'Your museum, ':m.likedByMe?'Unlike museum, ':'Like museum, '}${likes} ${likes===1?'like':'likes'}" aria-pressed="${Boolean(m.likedByMe)}" ${self||pendingLikes.has(m.uid)?'disabled':''}>${heart}<span class="community-like-count">${likes.toLocaleString()}</span></button><a class="community-visit" href="${escape(url)}">Visit museum ${arrow}</a></div></div></article>`;
  }).join('');
  grid.querySelectorAll('img').forEach(img=>img.addEventListener('error',()=>{if(!img.dataset.fallback){img.dataset.fallback='true';img.src='assets/card-placeholder.svg'}},{once:true}));
  for(const owner of pendingLikes.keys())updateLikeButton(owner);
 }
 function updateLikeButton(owner){
  const museum=museums.get(owner),actor=window.RIPPR_ACCOUNT?.user?.uid;
  const button=[...grid.querySelectorAll('[data-like]')].find(el=>el.dataset.like===owner);
  if(!museum||!button)return;
  const pending=pendingLikes.get(owner),optimistic=pending&&pending.view===generation&&pending.actor===actor;
  const liked=optimistic?pending.liked:Boolean(museum.likedByMe),value=optimistic?pending.likeCount:museum.likeCount;
  const count=Number.isSafeInteger(value)&&value>=0?value:0,self=owner===actor;
  button.setAttribute('aria-pressed',String(liked));
  button.setAttribute('aria-label',(self?'Your museum, ':liked?'Unlike museum, ':'Like museum, ')+count+' '+(count===1?'like':'likes'));
  button.setAttribute('aria-busy',String(Boolean(pending&&pending.actor===actor)));
  button.disabled=self||Boolean(pending&&pending.actor===actor);
  button.querySelector('.community-like-count').textContent=count.toLocaleString();
 }
 async function load(reset=false){
  if(loading&&!reset)return;
  const ticket=++generation;loading=true;lastError=false;
  if(reset){cursor=null;museums=new Map();grid.replaceChildren()}
  grid.setAttribute('aria-busy','true');more.disabled=true;status.textContent=reset?'Loading museums…':'Exploring more museums…';
  try{
   const result=await window.RipprFirebase.museumAction('browse',{sort,search,cursor});
   if(ticket!==generation)return;
   for(const m of result.museums||[])if(m?.uid)museums.set(m.uid,m);
   cursor=result.nextCursor||null;render();more.hidden=!cursor;
   const n=museums.size;status.textContent=search?`${n} ${n===1?'match':'matches'} found on the pages explored.`:`${n} ${n===1?'museum':'museums'} to discover.`;
  }catch{
   if(ticket!==generation)return;lastError=true;
   status.textContent='Museums couldn’t load right now.';
   if(!museums.size)empty('The gallery is taking a moment.','Please try again to explore community collections.',true);
   else{more.hidden=false;more.textContent='Try again'}
  }finally{
   if(ticket===generation){loading=false;grid.setAttribute('aria-busy','false');more.disabled=false;if(!lastError)more.textContent='Explore more museums'}
  }
 }
 $('#community-search').addEventListener('submit',event=>{event.preventDefault();search=$('#community-query').value.trim();load(true)});
 $('#community-query').addEventListener('search',()=>{if(!$('#community-query').value){search='';load(true)}});
 $('#community-sort').addEventListener('change',()=>{sort=$('#community-sort').value;load(true)});
 more.addEventListener('click',()=>load(false));
 grid.addEventListener('click',async event=>{
  if(event.target.closest('[data-retry]')){load(true);return}
  const button=event.target.closest('[data-like]');if(!button)return;
  const owner=button.dataset.like,museum=museums.get(owner),actor=window.RIPPR_ACCOUNT?.user?.uid;
  if(!museum||pendingLikes.has(owner)||owner===actor)return;
  if(!actor){location.href='auth.html?mode=login&next='+encodeURIComponent(location.pathname+location.search);return}
  const view=generation,token=Symbol(),liked=!museum.likedByMe;
  const count=Number.isSafeInteger(museum.likeCount)&&museum.likeCount>=0?museum.likeCount:0;
  // Keep server data unchanged until confirmation; only this heart gets an
  // optimistic visual state, so failures can restore it without rebuilding cards.
  pendingLikes.set(owner,{token,view,actor,liked,likeCount:Math.max(0,count+(liked?1:-1))});
  updateLikeButton(owner);
  try{
   const result=await window.RipprFirebase.museumAction('setLike',{uid:owner,liked});
   if(view!==generation||actor!==window.RIPPR_ACCOUNT?.user?.uid)return;
   museums.set(owner,{...museum,likeCount:result.likeCount,likedByMe:result.likedByMe});
   status.textContent=result.likedByMe?'Museum liked.':'Like removed.';
  }catch{if(view===generation&&actor===window.RIPPR_ACCOUNT?.user?.uid)status.textContent='Your like couldn’t be updated. Try again.'}
  finally{
   if(pendingLikes.get(owner)?.token===token)pendingLikes.delete(owner);
   // A fresh view owns its data. An older response may only release its pending
   // button; it cannot replace the fresh account's or search results' counts.
   if(actor===window.RIPPR_ACCOUNT?.user?.uid)updateLikeButton(owner);
  }
 });
 document.addEventListener('rippr:authchange',()=>{pendingLikes.clear();load(true)});
 load(true);
})();
