/* A Checkout redirect never grants credit. Poll the authenticated server record. */
(()=>{
 const params=new URLSearchParams(location.search),id=params.get('stripe_topup'),cancelled=params.has('stripe_topup_cancelled')||document.body.dataset.paymentResult==='canceled';
 const dedicated=document.body.dataset.paymentResult;
 const title=document.querySelector('#payment-result-title');
 function headline(value){if(title)title.textContent=value}
 if(dedicated==='success'&&(!id||!/^[a-zA-Z0-9-]{16,80}$/.test(id))){headline('No top-up to check');document.querySelector('.payment-result-copy').textContent='Return from Stripe Checkout to check your payment, or view your account.';return}
 if(!id&&!cancelled)return;
 if(id&&!/^[a-zA-Z0-9-]{16,80}$/.test(id))return;
 const main=document.querySelector('main');if(!main)return;
 const box=document.createElement('section');box.className='stripe-return-status';box.setAttribute('aria-label','Stripe top-up status');const text=document.createElement('span');text.setAttribute('role','status');const retry=document.createElement('button');retry.type='button';retry.textContent='Check again';retry.hidden=true;box.append(text,retry);(document.querySelector('#payment-result-status')||main).prepend(box);
 if(dedicated==='success')document.querySelector('.payment-result-copy').hidden=true;
 let actor=null,timer=null,attempts=0,busy=false,done=false,generation=0;
 const clear=()=>{clearTimeout(timer);timer=null};
 function cleanUrl(){if(dedicated)return;params.delete('stripe_topup');params.delete('stripe_topup_cancelled');history.replaceState(null,'',location.pathname+(params.size?'?'+params:'')+location.hash)}
 async function check(){
  clear();if(done||busy||document.hidden)return;
  const uid=window.RIPPR_ACCOUNT?.user?.uid;if(!uid){text.textContent='Sign in to check your Stripe sandbox top-up.';return}
  if(actor!==uid){actor=uid;attempts=0;generation++}const ticket=generation;
  busy=true;attempts++;retry.hidden=true;text.textContent='Confirming your Stripe sandbox top-up…';
  try{
   const result=await window.RipprFirebase.stripeAction('status',{topupId:id});
   if(ticket!==generation||uid!==window.RIPPR_ACCOUNT?.user?.uid)return;
   if(result.status==='credited'){
    done=true;headline('You’re topped up.');text.textContent=new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(result.amountCents/100)+' in test credit has been added to your balance.';
    try{sessionStorage.removeItem('rippr:stripe-topup:'+uid+':'+result.amountCents)}catch{}
    cleanUrl();try{await window.RipprAccount.refresh()}catch{if(ticket===generation&&uid===window.RIPPR_ACCOUNT?.user?.uid)text.textContent+=' Refresh your account to update the displayed balance.'}
   }else if(['review','failed','expired','refunded'].includes(result.status)){
    done=true;headline(result.status==='review'?'We’re reviewing your top-up':result.status==='refunded'?'Top-up refunded':'Top-up not completed');text.textContent=result.status==='review'?'This top-up needs payment review. Contact support.':result.status==='refunded'?'This top-up has been refunded. Check your account for its current balance.':'This Checkout did not complete. You can start a new top-up.';cleanUrl();
    try{sessionStorage.removeItem('rippr:stripe-topup:'+uid+':'+result.amountCents)}catch{}
   }else{text.textContent='Waiting for Stripe payment confirmation. Your balance will update after the webhook arrives.';if(attempts<12)timer=setTimeout(check,5000);else retry.hidden=false}
  }catch{
   if(ticket===generation&&uid===window.RIPPR_ACCOUNT?.user?.uid){text.textContent='Could not check this top-up. Retry or return to this page later.';retry.hidden=false}
  }finally{busy=false;if(ticket!==generation)sync()}
 }
 function sync(){
  const uid=window.RIPPR_ACCOUNT?.user?.uid;
  if(uid!==actor){generation++;actor=uid;attempts=0;done=false;headline('Checking your top-up');clear();text.textContent=uid?'Checking your sandbox top-up…':'Sign in to check your Stripe sandbox top-up.'}
  if(!busy&&!timer&&!done)check();
 }
 retry.addEventListener('click',()=>{attempts=0;check()});
 if(cancelled){text.textContent='Stripe Checkout was cancelled. No credit has been added by this return page.';cleanUrl();return}
 document.addEventListener('rippr:authchange',sync);document.addEventListener('rippr:walletchange',sync);
 document.addEventListener('visibilitychange',()=>{if(document.hidden)clear();else sync()});window.addEventListener('pagehide',clear);window.addEventListener('pageshow',sync);sync();
})();
