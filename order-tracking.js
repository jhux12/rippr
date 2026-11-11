(() => {
 'use strict';
 const $=s=>document.querySelector(s),state=()=>window.RIPPR_ACCOUNT,model=window.RipprSettings;
 const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 let generation=0,uid=null,currentRequestId=null;
 function gate(title,copy,{login=false,retry=false}={}){$('#tracking-content').hidden=true;$('#account-gate').hidden=false;$('#gate-title').textContent=title;$('#gate-copy').textContent=copy;$('#gate-login').hidden=!login;$('#gate-retry').hidden=!retry}
 function records(){const all=new Map((state()?.shipments||[]).map(s=>[s.id,s]));for(const item of state()?.items||[])if(item.shipmentId&&!all.has(item.shipmentId))all.set(item.shipmentId,{id:item.shipmentId,status:'test-request',createdAt:item.requestedAt});return [...all.values()].sort((a,b)=>(b.createdAt||0)-(a.createdAt||0))}
 const label=id=>'#RP-'+id.slice(0,8).toUpperCase();
 function updatePaging(){const a=state();$('#load-more-shipments').hidden=!a?.pageInfo?.shipments?.hasMore;$('#load-more-shipments').disabled=Boolean(a?.inventoryLoading?.shipments);$('#load-more-shipments').textContent=a?.inventoryLoading?.shipments?'Loading…':'Load older requests';$('#shipment-page-error').textContent=a?.inventoryErrors?.shipments||'';$('#shipment-page-error').hidden=!a?.inventoryErrors?.shipments;}
 async function load(){
  const a=state(),user=a?.user,ticket=++generation;uid=user?.uid;
  updatePaging();
  $('#tracking-error').hidden=true;$('#gate-login').textContent='Log in';$('#gate-login').href='auth.html?mode=login';
  if(!a?.ready){gate('Your shipping requests','Loading your account…');return}
  if(!user){gate('Your next mail day awaits.','Log in to view your shipping requests.',{login:true});return}
  if(!a.wallet){gate('Your shipping requests',a.accountError||'Loading your account…',{retry:Boolean(a.accountError)});return}
  const list=records(),id=new URLSearchParams(location.search).get('request')||list[0]?.id;
  if(!id){gate('No shipping requests yet.','Select available cards from My items to get started.');$('#gate-login').textContent='View my items';$('#gate-login').href='profile.html';$('#gate-login').hidden=false;return}
  if(!/^[a-zA-Z0-9-]{16,80}$/.test(id)){gate('Request not found','Choose a shipping request from your account.',{retry:true});return}
  $('#gate-login').textContent='Log in';$('#gate-login').href='auth.html?mode=login';
  if(currentRequestId!==id||$('#tracking-content').hidden)gate('Your shipping request','Loading request details…');
  try{
   const data=await window.RipprFirebase.loadShipment(id);
   if(ticket!==generation||uid!==state()?.user?.uid)return;
   const select=$('#request-select');select.replaceChildren();for(const request of list.some(s=>s.id===id)?list:[{id},...list]){const option=document.createElement('option');option.value=request.id;option.textContent=label(request.id);option.selected=request.id===id;select.append(option)}
   currentRequestId=id;$('#account-gate').hidden=true;$('#tracking-content').hidden=false;
   $('#request-number').textContent=label(id);$('#request-number').title=id;
   const index=model.shipmentStage(data.status),status=index<0?'Status unavailable':model.SHIPMENT_STAGES[index];
   $('#request-status').textContent=status;
   $('#request-timeline').innerHTML=model.SHIPMENT_STAGES.map((text,i)=>`<li class="${index>=i?'is-complete':''}" ${index===i?'aria-current="step"':''}><span aria-hidden="true">${index>=i?'✓':i+1}</span>${text}</li>`).join('');
   $('#request-note').textContent=index<0?'The saved status is not recognized. Contact support for help.':index===0?'Your request is saved. Updates will appear here.':index===4?'Your request is marked delivered.':'Latest recorded status: '+status+'.';
   const items=Array.isArray(data.items)?data.items:[];
   $('#request-items').innerHTML=items.map(item=>{const image=window.RipprCatalog.safeImageURL(item.image)?(window.RIPPR_ASSET_URLS?.[item.image]||item.image):'assets/card-placeholder.svg';const color=window.RipprCatalog.RARITIES.find(r=>r.name===item.rarity)?.color||'#adbdcf';return `<article class="request-item"><img src="${esc(image)}" alt="${esc(item.name)}"><div><h3>${esc(item.name)}</h3><p><span class="status-pill" style="color:${color};border-color:${color}">${esc(item.rarity)}</span><span class="condition-badge">${window.RipprCatalog.conditionLabel(item)}</span>1 card</p></div></article>`}).join('')||'<p>Item details are unavailable. Keep your request number for support.</p>';
   $('#request-items').querySelectorAll('img').forEach(img=>img.addEventListener('error',()=>{img.src='assets/card-placeholder.svg'},{once:true}));
   const address=$('#request-address');address.replaceChildren();const lines=model.addressLines(data.address);for(const text of lines){const p=document.createElement('p');p.textContent=text;address.append(p)}if(!lines.length)address.textContent='No delivery address was saved with this request.';
   $('#carrier').textContent=data.carrier||'Assigned after dispatch';$('#tracking-number').textContent=data.trackingNumber||'Available after dispatch';
   const url=new URL(location.href);url.searchParams.set('request',id);history.replaceState(null,'',url);
  }catch(error){if(ticket!==generation||uid!==state()?.user?.uid)return;gate(error.code==='account/not-found'?'Request not found':'Request unavailable',error.code==='account/not-found'?'This request does not belong to your current account or no longer exists.':'Could not load the request. Please try again.',{retry:true})}
 }
 $('#load-more-shipments').addEventListener('click',async()=>{const actor=state()?.user?.uid;try{await window.RipprAccount.loadMore('shipments')}catch(error){if(actor===state()?.user?.uid){$('#shipment-page-error').textContent=window.RipprAccount.errorMessage(error);$('#shipment-page-error').hidden=false}}});
 $('#request-select').addEventListener('change',event=>{const url=new URL(location.href);url.searchParams.set('request',event.target.value);history.replaceState(null,'',url);void load()});
 async function refresh(){const user=state()?.user?.uid;$('#refresh-tracking').disabled=true;try{await window.RipprAccount.refresh();if(user===state()?.user?.uid)await load()}finally{$('#refresh-tracking').disabled=false}}
 $('#refresh-tracking').addEventListener('click',refresh);$('#gate-retry').addEventListener('click',refresh);
 document.addEventListener('rippr:authchange',()=>{generation++;currentRequestId=null;$('#request-items').replaceChildren();$('#request-address').replaceChildren();void load()});document.addEventListener('rippr:walletchange',()=>{if(state()?.inventoryLoading?.shipments){updatePaging();return}void load()});
 document.querySelectorAll('.support-trigger').forEach(button=>button.addEventListener('click',event=>{event.preventDefault();location.href='contact-support.html?request='+encodeURIComponent(new URLSearchParams(location.search).get('request')||'')}));
 load();
})();
