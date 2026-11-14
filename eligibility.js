(()=>{'use strict';
 const VERSION='sandbox-2026-11-13-v4';
 function read(){const dob=document.querySelector('#eligibility-dob'),terms=document.querySelector('#eligibility-terms'),privacy=document.querySelector('#eligibility-privacy');
  if(!dob||!terms||!privacy)throw Error('Eligibility form unavailable. Reload to continue.');
  const error=document.querySelector('#eligibility-error');if(error){error.hidden=true;error.textContent=''}
  function reject(message,input){if(error){error.textContent=message;error.hidden=false}input.focus();throw Error(message)}
  const value=dob.value,date=new Date(value+'T00:00:00Z'),today=new Date();
  if(!/^\d{4}-\d{2}-\d{2}$/.test(value)||!Number.isFinite(date.getTime())||date.toISOString().slice(0,10)!==value||date.getUTCFullYear()<1900||date>today)reject('Enter a valid date of birth.',dob);
  let age=today.getUTCFullYear()-date.getUTCFullYear();if(today.getUTCMonth()<date.getUTCMonth()||(today.getUTCMonth()===date.getUTCMonth()&&today.getUTCDate()<date.getUTCDate()))age--;
  if(age<18)reject('You must be at least 18 to use rippr.',dob);
  if(!terms.checked)reject('Agree to the Terms to continue.',terms);if(!privacy.checked)reject('Acknowledge the Privacy Policy to continue.',privacy);
  return{birthDate:value,agreeTerms:true,acknowledgePrivacy:true,policyVersion:VERSION};
 }
 window.RipprEligibility={VERSION,read};
 for(const input of document.querySelectorAll('#eligibility-fields input'))input.addEventListener('input',()=>{const error=document.querySelector('#eligibility-error');if(error){error.hidden=true;error.textContent=''}});
 if(!document.body.hasAttribute('data-eligibility-page'))return;
 const form=document.querySelector('#eligibility-form'),status=document.querySelector('#eligibility-status'),submit=document.querySelector('#eligibility-submit'),login=document.querySelector('#eligibility-login');
 const next=new URLSearchParams(location.search).get('next');let destination='/';try{const u=new URL(next||'/',location.origin);if(u.origin===location.origin&&!/^\/(?:auth|eligibility)(?:\.html)?\/?$/.test(u.pathname))destination=u.pathname+u.search+u.hash}catch{}
 login.href='auth.html?mode=login&next='+encodeURIComponent(location.pathname+location.search);
 let uid=null,generation=0,busy=false,operationId=null;
 function message(text){status.textContent=text;status.hidden=false}
 function reset(){generation++;busy=false;operationId=null;form.reset();document.querySelector('#eligibility-error').hidden=true;submit.disabled=true}
 async function sync(){const current=window.RIPPR_ACCOUNT?.user?.uid;if(current!==uid){reset();uid=current}login.hidden=!!uid;form.hidden=!uid;if(!uid){message('Sign in to complete your age and policy check.');return}const ticket=generation;submit.disabled=true;try{const result=await window.RipprFirebase.accountAction('eligibilityState',{accountUid:uid});if(ticket!==generation||uid!==window.RIPPR_ACCOUNT?.user?.uid)return;if(!result.required){location.replace(destination);return}if(result.policyVersion!==VERSION){message('Policies changed. Reload this page before continuing.');return}message('Review the sandbox drafts below. This is a self-reported age check, not identity verification.');submit.disabled=false}catch{if(ticket===generation){message('Could not load your eligibility check. Try again.');submit.disabled=false}}}
 form.addEventListener('submit',async event=>{event.preventDefault();if(busy||!uid)return;let data;try{data=read()}catch{return}const actor=uid,ticket=generation;operationId||=crypto.randomUUID();busy=true;submit.disabled=true;message('Saving your age and policy check…');
 try{await window.RipprFirebase.accountAction('acceptEligibility',{...data,accountUid:actor},operationId);if(ticket!==generation||actor!==window.RIPPR_ACCOUNT?.user?.uid)return;location.replace(destination)}catch(error){if(ticket===generation){message(error?.code==='functions/unavailable'?'Connection interrupted. Retry safely.':error?.message||'Could not save. Try again.');if(!['functions/unavailable','functions/internal','functions/deadline-exceeded','functions/unknown'].includes(error?.code))operationId=null}}finally{if(ticket===generation){busy=false;submit.disabled=false}}});
 document.addEventListener('rippr:authchange',sync);window.addEventListener('pagehide',()=>{generation++;form.reset();operationId=null});window.addEventListener('pageshow',event=>{if(event.persisted)sync()});sync();
})();
