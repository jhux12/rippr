/* Recover transient card-CDN failures without replacing saved artwork URLs. */
(() => {
 'use strict';
 const states=new WeakMap(),pending=new Set(),delays=[400,1600],cacheKey=Date.now().toString(36);let requestId=0,suspended=false;
 function cancel(state){clearTimeout(state.timer);state.timer=null;pending.delete(state)}
 function retryURL(source,attempt){
  try{
   const url=new URL(source,document.baseURI);
   // Never alter signed/uploaded URLs. Only the public TCGdex asset CDN uses a
   // cache-busting query so a cached failure can be recovered without refresh.
   if(attempt&&url.origin==='https://assets.tcgdex.net'){url.searchParams.set('_rippr_retry',cacheKey+'-'+(++requestId));return url.href}
  }catch{}
  return source;
 }
 function assign(state){
  state.current=retryURL(state.source,state.attempt);state.failed=false;
  state.img.src=state.current;
 }
 function schedule(state,delay){
  cancel(state);pending.add(state);
  state.timer=setTimeout(()=>{
   state.timer=null;
   if(!state.img.isConnected||state.img.getAttribute('src')!==state.current){cancel(state);return}
   if(document.hidden||suspended)return;
   pending.delete(state);state.attempt++;assign(state);
  },delay);
 }
 function watch(img,handlers={}){
  if(states.has(img))return states.get(img).api;
  const state={img,handlers,source:img.getAttribute('src')||'',current:img.getAttribute('src')||'',attempt:0,timer:null,failed:false};
  const api={
   retry(){cancel(state);state.attempt=1;state.failed=false;state.handlers.onRetry?.(img);assign(state)},
   load(source){cancel(state);state.source=source;state.attempt=0;state.handlers.onRetry?.(img);assign(state)},
   cancel(){cancel(state)}
  };
  state.api=api;states.set(img,state);img.decoding='async';
  img.addEventListener('load',()=>{
   if(img.getAttribute('src')!==state.current||!img.naturalWidth)return;
   cancel(state);state.failed=false;state.handlers.onLoad?.(img);
  });
  function failed(){
   if(!state.source||!img.isConnected||state.failed||pending.has(state)||img.getAttribute('src')!==state.current)return;
   if(state.attempt<delays.length){schedule(state,delays[state.attempt]);return}
   cancel(state);state.failed=true;state.handlers.onError?.(img);
  }
  img.addEventListener('error',failed);
  // Cached failures may have fired before the caller attached its handlers.
  queueMicrotask(()=>{if(img.complete&&!img.naturalWidth)failed()});
  return api;
 }
 function retryButton(img){
  const button=document.createElement('button');button.type='button';button.className='artwork-retry';button.textContent='Retry image';
  button.setAttribute('aria-label',`Retry artwork${img.alt?' for '+img.alt:''}`);
  button.addEventListener('click',event=>{event.stopPropagation();states.get(img)?.api.retry()});return button;
 }
 // A removed card must not leave a retry timer or retained image behind.
 new MutationObserver(()=>{for(const state of pending)if(!state.img.isConnected)cancel(state)}).observe(document.documentElement,{childList:true,subtree:true});
 const resume=()=>{if(!document.hidden&&!suspended)for(const state of [...pending])schedule(state,0)};
 document.addEventListener('visibilitychange',resume);
 window.addEventListener('pagehide',()=>{suspended=true;for(const state of pending){clearTimeout(state.timer);state.timer=null}});
 window.addEventListener('pageshow',()=>{suspended=false;resume()});
 window.RipprArtwork={watch,retryButton};
})();
