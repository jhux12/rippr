(()=>{
 'use strict';
 const box=document.querySelector('#owner-promo'),form=document.querySelector('#owner-promo-form');if(!box||!form)return;
 const amount=document.querySelector('#owner-promo-amount'),note=document.querySelector('#owner-promo-note'),status=document.querySelector('#owner-promo-status'),button=form.querySelector('button');
 let busy=false,uncertain=false,generation=0,payload=null;
 const user=()=>window.RipprFirebase?.currentUser?.(),allowed=()=>window.RipprCatalog?.isAdminUser(user())&&(window.RIPPR_RUNTIME?.mode||window.RIPPR_ACCOUNT?.mode)==='live';
 function render(){box.hidden=!allowed();amount.disabled=note.disabled=busy||uncertain;button.disabled=busy||!allowed();button.textContent=busy?'Adding…':uncertain?'Retry same credit request':'Add promotional credit';form.setAttribute('aria-busy',String(busy))}
 function message(text,error=false){status.textContent=text;status.setAttribute('role',error?'alert':'status');status.focus()}
 form.addEventListener('submit',async event=>{
  event.preventDefault();if(busy||!allowed())return;
  if(!uncertain){
   if(!form.reportValidity())return;
   const value=amount.value.trim();if(!/^\d{1,3}(?:\.\d{1,2})?$/.test(value)){message('Enter an amount from $1 to $100, with up to two decimal places.',true);return}
   const [whole,fraction='']=value.split('.'),amountCents=Number(whole)*100+Number(fraction.padEnd(2,'0'));
   if(amountCents<100||amountCents>10000||note.value.trim().length<10){message('Enter $1–$100 and a reason of at least 10 characters.',true);return}
   if(!confirm(`Add $${(amountCents/100).toFixed(2)} live promotional credit to your admin account? Packs opened with this credit award real inventory.`))return;
   payload={amountCents,note:note.value.trim()};
  }
  const ticket=generation,uid=user().uid;busy=true;render();
  try{
   const result=await window.RipprAccount.act('adminGrantPromoCredit',payload);
   if(ticket!==generation||user()?.uid!==uid||!allowed())return;
   uncertain=false;payload=null;form.reset();message(`Added $${(result.amountCents/100).toFixed(2)} promotional credit. Balance: $${(result.balanceCents/100).toFixed(2)}. No deposit rewards were unlocked.`);
  }catch(error){
   if(ticket!==generation||user()?.uid!==uid||!allowed())return;
   uncertain=['functions/unavailable','functions/internal','functions/deadline-exceeded','functions/unknown'].includes(error?.code);
   message(uncertain?'The result could not be confirmed. Retry the same request to safely check it.':window.RipprAccount.errorMessage(error),true);
  }finally{if(ticket===generation){busy=false;render()}}
 });
 document.addEventListener('rippr:authchange',()=>{generation++;busy=false;uncertain=false;payload=null;form.reset();status.textContent='';render()});
 document.addEventListener('rippr:walletchange',render);document.addEventListener('rippr:adminview',render);render();
})();
