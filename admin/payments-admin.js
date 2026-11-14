(()=>{
 'use strict';const $=s=>document.querySelector(s),state=()=>window.RIPPR_ACCOUNT,allowed=()=>window.RipprCatalog.isAdminUser(state()?.user),money=n=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format((n||0)/100);
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 let cases=[],cursor=null,current=null,ledger=[],ledgerCursor=null,busy=false,generation=0,actor=null;
 const pending=new Map(),live=()=>window.RIPPR_RUNTIME?.mode==='live'||state()?.mode==='live';
 const message=(text,error=false)=>{const el=$('#payment-message');el.textContent=text;el.setAttribute('role',error?'alert':'status');if(error){el.tabIndex=-1;el.focus()}};
 const errorText=e=>e?.code==='functions/permission-denied'?'Only the verified owner may manage payment reviews.':e?.details?.provider==='stripe'?'Could not verify this payment with Stripe. Check the server logs.':window.RipprAccount.errorMessage(e);
 function lock(value){busy=value;$('#payments-view').setAttribute('aria-busy',String(value));$('#payments-view').querySelectorAll('input,button,select,textarea').forEach(el=>el.disabled=value);if(!value)actionControls()}
 function actionControls(){if(!current)return;$('#payment-resolve').disabled=busy||current.detail?.review?.status!=='open';$('#payment-waive').hidden=live()||!(current.wallet?.debtCents>0);$('#payment-waive').disabled=busy||current.wallet?.reviewCount>0||current.wallet?.legacyHold===true}
 async function call(action,data={},mutate=false){
  const uid=state()?.user?.uid;if(!allowed())throw{code:'functions/permission-denied',message:'Only the verified owner may manage payments.'};
  const key='rippr:payment-review:'+uid+':'+action+':'+JSON.stringify(data);let id;
  if(mutate){try{id=sessionStorage.getItem(key)}catch{}id||=pending.get(key)||crypto.randomUUID();pending.set(key,id);try{sessionStorage.setItem(key,id)}catch{}}
  try{const result=await window.RipprFirebase.stripeAction(action,data,id);if(mutate){pending.delete(key);try{sessionStorage.removeItem(key)}catch{}}return result}catch(e){if(mutate&&['functions/invalid-argument','functions/failed-precondition','functions/permission-denied'].includes(e.code)){pending.delete(key);try{sessionStorage.removeItem(key)}catch{}}throw e}
 }
 function renderCases(){const filter=$('#payment-filter').value,rows=cases.filter(c=>!filter||c.status===filter);$('#payment-rows').innerHTML=rows.map(c=>`<tr><td>${esc(c.topupId.slice(0,8))}<br><small>${esc(c.uid)}</small></td><td>${money(c.amountCents)}</td><td>${esc(c.reason)}</td><td>${esc(c.status)}</td><td><button type="button" class="button secondary" data-payment="${esc(c.topupId)}" data-customer="${esc(c.uid)}">Inspect</button></td></tr>`).join('')||'<tr><td colspan="5">No matching loaded reviews.</td></tr>';$('#payment-count').textContent=rows.length+' of '+cases.length+' loaded cases';$('#payment-more').hidden=!cursor;}
 async function loadQueue(reset=true){
  if(!allowed()||busy)return;const ticket=generation;lock(true);message('Loading payment reviews…');
  try{const result=await call('adminPaymentReviews',reset?{}:{cursor});if(ticket!==generation||!allowed())return;const found=new Map((reset?[]:cases).map(c=>[c.id,c]));for(const item of result.cases)found.set(item.id,item);cases=[...found.values()];cursor=result.cursor;renderCases();message('Payment reviews loaded. Stripe verification happens when you inspect a payment.')}catch(e){if(ticket===generation)message(errorText(e),true)}finally{if(ticket===generation)lock(false)}
 }
 function renderDetail(){
  if(!current)return;$('#payment-detail').hidden=false;const {wallet,detail}=current,b=wallet.buckets;
  $('#payment-detail-title').textContent=detail?'Top-up '+current.topupId:'Wallet · '+current.uid;
  $('#payment-breakdown').innerHTML=[[live()?'Total balance':'Total test balance',wallet.balanceCents],['Stripe-funded',b.purchasedCents],['Promotional',b.promotionalCents],['Sellback',b.sellbackCents],['Legacy test credit',b.legacyTestCents],['Payment debt',wallet.debtCents]].filter(([label])=>!live()||label!=='Legacy test credit').map(([label,value])=>`<div><dt>${label}</dt><dd>${money(value)}</dd></div>`).join('');
  $('#payment-provider-status').textContent=detail?`Stripe: ${detail.provider.paid?'paid':'not paid'} · refunded ${money(detail.provider.refundedCents)}${detail.provider.disputeStatus?' · dispute '+detail.provider.disputeStatus:''}`:'No payment selected. Enter a top-up ID to verify it with Stripe.';
  $('#payment-review-state').textContent=(wallet.reviewCount||0)+' open reviews · '+(wallet.hold||wallet.legacyHold||wallet.debtCents?'balance on hold':'no payment hold')+(wallet.legacyHold?' · an earlier untracked hold needs owner reconciliation':'');
  $('#payment-resolution-form').hidden=!detail&&!(wallet.debtCents>0);
  $('#payment-resolve').hidden=!detail;
  $('#payment-ledger').innerHTML=ledger.map(entry=>`<tr><td>${entry.revision}</td><td>${esc(entry.kind)}</td><td>${money(Object.values(entry.delta||{}).reduce((a,b)=>a+b,0))}</td><td>${money(entry.balanceAfterCents)}</td></tr>`).join('')||'<tr><td colspan="4">No ledger entries yet. Existing balances stay legacy test credit until the first ledger-backed change.</td></tr>';
  $('#payment-ledger-more').hidden=!ledgerCursor;
  $('#payment-audit').innerHTML=(current.audit||[]).map(entry=>`<article class="payment-note"><strong>${esc(entry.action)} · ${esc(entry.actor)}</strong><p>${esc(new Date(entry.atMs).toLocaleString())}</p><p>${esc(entry.note)}</p></article>`).join('')||'<p class="payment-caption">No review notes yet.</p>';actionControls();
 }
 async function inspect(uid,topupId){
  if(!allowed()||busy)return;const ticket=generation;lock(true);message(topupId?(live()?'Verifying the payment with Stripe…':'Verifying the sandbox payment with Stripe…'):'Loading the wallet ledger…');
  try{const [detail,history]=await Promise.all([topupId?call('adminPaymentInspect',{customerUid:uid,topupId}):Promise.resolve(null),call('adminPaymentWallet',{customerUid:uid})]);if(ticket!==generation||!allowed())return;if(detail&&detail.wallet.revision!==history.wallet.revision)throw{code:'functions/failed-precondition',message:'The wallet changed while loading. Inspect it again.'};current={uid,topupId,detail,wallet:{...history.wallet,...detail?.wallet},audit:history.audit||[]};ledger=history.ledger;ledgerCursor=history.beforeRevision;$('#payment-customer').value=uid;$('#payment-topup').value=topupId||'';$('#payment-note').value='';$('#payment-dispute').value=detail?.review?.disputeId||'';renderDetail();message('Loaded. Resolutions recheck the payment and wallet version before saving.')}catch(e){if(ticket===generation)message(errorText(e),true)}finally{if(ticket===generation)lock(false)}
 }
 $('#payment-lookup').addEventListener('submit',e=>{e.preventDefault();inspect($('#payment-customer').value.trim(),$('#payment-topup').value.trim())});
 $('#payment-rows').addEventListener('click',e=>{const b=e.target.closest('[data-payment]');if(b)inspect(b.dataset.customer,b.dataset.payment)});
 $('#payment-reload').addEventListener('click',()=>loadQueue());$('#payment-more').addEventListener('click',()=>loadQueue(false));$('#payment-filter').addEventListener('change',renderCases);
 $('#payment-ledger-more').addEventListener('click',async()=>{if(!current||busy||!ledgerCursor)return;const saved=current,ticket=generation;lock(true);try{const result=await call('adminPaymentWallet',{customerUid:saved.uid,beforeRevision:ledgerCursor});if(ticket!==generation||current!==saved||!allowed())return;ledger=[...new Map([...ledger,...result.ledger].map(e=>[e.id,e])).values()];ledgerCursor=result.beforeRevision;renderDetail()}catch(e){if(ticket===generation)message(errorText(e),true)}finally{if(ticket===generation)lock(false)}});
 async function resolve(waive=false){
  if(!current||busy||!allowed()||!$('#payment-resolution-form').reportValidity())return;
  const saved=current,ticket=generation,note=$('#payment-note').value.trim();
  if(!confirm(waive?'Write off this sandbox debt? No Stripe funds are refunded or credited.':(live()?'Record this live payment resolution? This changes the live wallet ledger. No Stripe refund is issued.':'Record this sandbox payment resolution? No Stripe refund is issued.')))return;
  lock(true);let result;
  try{result=await call(waive?'adminSandboxDebtWaive':'adminPaymentResolve',{customerUid:saved.uid,expectedWalletRevision:saved.wallet.revision,note,...(waive?{}:{topupId:saved.topupId,expectedVersion:saved.detail.review.version,resolution:$('#payment-resolution').value,disputeId:$('#payment-dispute').value.trim()})},true);if(ticket!==generation||!allowed())return;message(result.hold?'Resolution recorded. The wallet remains held for another review, debt or earlier hold.':'Resolution recorded. No payment hold remains.')}catch(e){if(ticket===generation)message(errorText(e),true)}finally{if(ticket===generation)lock(false)}
  if(result&&ticket===generation&&allowed()){await inspect(saved.uid,saved.topupId);await loadQueue();message(result.hold?'Recorded. A remaining review, debt or earlier hold still blocks spending.':'Recorded. No payment hold remains.')}
 }
 $('#payment-resolution-form').addEventListener('submit',e=>{e.preventDefault();resolve(false)});$('#payment-waive').addEventListener('click',()=>resolve(true));
 document.addEventListener('rippr:adminview',e=>{if(e.detail.name==='payments')loadQueue()});
 document.addEventListener('rippr:authchange',()=>{const uid=state()?.user?.uid;if(uid!==actor||!allowed()){if(actor){try{for(const key of Object.keys(sessionStorage))if(key.startsWith('rippr:payment-review:'+actor+':'))sessionStorage.removeItem(key)}catch{}}pending.clear();actor=uid;generation++;cases=[];cursor=null;current=null;ledger=[];ledgerCursor=null;lock(false);$('#payment-detail').hidden=true;$('#payment-rows').replaceChildren();$('#payment-audit').replaceChildren();$('#payment-ledger').replaceChildren();$('#payment-breakdown').replaceChildren();$('#payment-lookup').reset();$('#payment-resolution-form').reset();message('')}});
})();
