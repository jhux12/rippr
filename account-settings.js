(() => {
 'use strict';
 const $=s=>document.querySelector(s),account=()=>window.RIPPR_ACCOUNT,client=window.RipprFirebase,model=window.RipprSettings;
 const verificationParams=new URLSearchParams(location.search);let verificationToken=verificationParams.get('verifyEmail');
 if(verificationToken){try{sessionStorage.setItem('rippr:verify-email',verificationToken)}catch{}verificationParams.delete('verifyEmail');history.replaceState(null,'',location.pathname+(verificationParams.size?'?'+verificationParams:'')+location.hash)}else{try{verificationToken=sessionStorage.getItem('rippr:verify-email')}catch{}}
 let confirmingEmail=false;
 let uid=null,generation=0,busy=false,dirty=false,phoneStage='current-send',smsDirty=false,smsPhone=null;
 const user=()=>account()?.user;
 function message(id,text,error=false){const el=$(id);el.textContent=text;el.hidden=!text;el.classList.toggle('is-error',error);el.setAttribute('role',error?'alert':'status');if(error&&text){el.tabIndex=-1;el.focus()}}
 function errorText(error){if(error.code==='functions/resource-exhausted')return error.message;if(error.code?.startsWith('auth/'))return ({'auth/invalid-phone-number':'Enter a valid phone number.','auth/invalid-verification-code':'That code did not match. Try again.','auth/code-expired':'The code expired. Close this dialog and start again.','auth/credential-already-in-use':'That phone number belongs to another account. Accounts cannot be merged here.','auth/requires-recent-login':'Verify your current number again before changing it.','auth/too-many-requests':'Too many attempts. Please try again later.','auth/cancelled-phone-request':'Your sign-in changed. Start again.'})[error.code]||'Phone verification is unavailable. Check your connection and try again.';return error.code==='catalog/invalid-image'||error.code==='account/invalid-data'?error.message:window.RipprAccount.errorMessage(error)}
 function setBusy(value){busy=value;document.querySelectorAll('#settings-content input,#settings-content button,.settings-dialog input,.settings-dialog button').forEach(el=>el.disabled=value)}
 function validSession(ticket,actor){return ticket===generation&&actor===user()?.uid}
 function render(){
  const a=account(),actor=user()?.uid;if(actor!==uid){generation++;uid=actor;dirty=false;smsDirty=false;busy=false;$('#settings-profile-form').reset();$('#address-form').reset();client.cancelPhoneChange?.();for(const d of document.querySelectorAll('.settings-dialog[open]'))d.close();setBusy(false);document.querySelectorAll('.service-message').forEach(el=>{el.textContent='';el.hidden=true})}
  const ready=Boolean(user()&&a.wallet);$('#settings-content').hidden=!ready;$('#account-gate').hidden=ready;$('#gate-login').hidden=!a?.ready||Boolean(user());$('#gate-retry').hidden=!user()||!a.accountError;
  $('#gate-login').href='auth.html?mode=login&next='+encodeURIComponent(location.pathname+location.search+location.hash);
  $('#gate-title').textContent='Make it yours.';$('#gate-copy').textContent=!a?.ready?'Loading your account…':!user()?'Log in to manage your profile and preferences.':a.accountError||'Loading your settings…';
  if(!ready){$('#saved-address').replaceChildren();$('#settings-phone').textContent='';$('#settings-avatar').src='assets/mascot/pip-welcome.png';return;}
  if(!dirty&&!busy){$('#display-name').value=a.wallet.displayName||'';$('#updates-email').value=a.wallet.emailForUpdates||''}
  const email=(a.wallet.emailForUpdates||'').trim().toLowerCase(),verified=email&&a.wallet.verifiedEmailForUpdates===email&&a.wallet.emailVerifiedAtMs>0;
  $('#email-verification-status').textContent=!email?'Add an email to receive account updates.':verified?'Email confirmed.':'Confirm your saved email to receive updates.';
  $('#verify-updates-email').hidden=!email||verified;$('#verify-updates-email').disabled=busy||dirty;
  if(verificationToken&&!confirmingEmail&&!busy)confirmSavedEmail();
  const image=a.wallet.photoURL||user().photoURL;$('#settings-avatar').src=window.RipprCatalog.safeImageURL(image)?image:(window.RIPPR_MASCOT_URLS?.welcome||'assets/mascot/pip-welcome.png');
  const phone=user().phoneNumber,digits=phone?.replace(/\D/g,'');$('#settings-phone').textContent=phone?`+${digits.slice(0,-10)||digits.slice(0,1)} ••• ••• ${digits.slice(-4)}`:'No phone linked';$('#phone-verified').hidden=!phone;$('#change-number').textContent=phone?'Change number':'Link phone';
  const box=$('#saved-address');box.replaceChildren();const lines=model.addressLines(a.wallet.address);for(const line of lines){const p=document.createElement('p');p.textContent=line;box.append(p)}if(!lines.length)box.textContent='Add a delivery address for future shipping requests.';
  const prefs={...model.DEFAULT_PREFERENCES,...a.wallet.preferences};let sound=prefs.soundEffects;try{const saved=localStorage.getItem('rippr:opening-muted');if(saved!==null)sound=saved!=='true'}catch{}
  $('#pref-sound').checked=sound;$('#pref-email').checked=prefs.emailUpdates;$('#pref-shipping').checked=prefs.shippingUpdates;
  if(smsPhone!==phone){smsDirty=false;smsPhone=phone}
  const consent=a.wallet.smsConsent,active=model.currentSmsConsent(consent,phone);
  $('#sms-disclosure').textContent=model.SMS_CONSENT_TEXT;
  $('#sms-phone').textContent=phone?'For your verified number ending in '+digits.slice(-4):'Link and verify a phone number to opt in.';
  if(!smsDirty)$('#sms-alerts').checked=active;
  $('#sms-alerts').disabled=busy||!phone;
  $('#sms-save').disabled=busy||(!phone&&!consent?.enabled);

 }
 async function save(patch,status){if(busy||!user())return false;const ticket=generation,actor=user().uid;setBusy(true);message(status,'Saving…');try{model.cleanSettingsPatch(patch,account().wallet);await window.RipprAccount.act('settings',patch);if(!validSession(ticket,actor))return false;message(status,'Saved.');return true}catch(error){if(validSession(ticket,actor))message(status,errorText(error),true);return false}finally{if(validSession(ticket,actor)){setBusy(false);render()}}}
 $('#settings-profile-form').addEventListener('input',()=>{dirty=true;$('#verify-updates-email').disabled=true;message('#profile-save-status','')});
 $('#settings-profile-form').addEventListener('submit',async event=>{event.preventDefault();if(!event.target.reportValidity())return;const ticket=generation;if(await save({displayName:$('#display-name').value,emailForUpdates:$('#updates-email').value},'#profile-save-status')){if(ticket!==generation)return;dirty=false;render()}});
 async function confirmSavedEmail(){
  if(!verificationToken||confirmingEmail||!user())return;
  confirmingEmail=true;const ticket=generation,actor=user().uid,token=verificationToken;verificationToken=null;
  try{sessionStorage.removeItem('rippr:verify-email')}catch{}
  setBusy(true);message('#profile-save-status','Confirming your email…');
  try{await window.RipprAccount.act('confirmEmailVerification',{token});if(validSession(ticket,actor))message('#profile-save-status','Email confirmed. Your account updates can now reach you.')}catch(error){if(validSession(ticket,actor))message('#profile-save-status',errorText(error),true)}finally{confirmingEmail=false;if(validSession(ticket,actor)){setBusy(false);render()}}
 }
 $('#verify-updates-email').addEventListener('click',async()=>{
  if(busy||dirty||!user())return;const ticket=generation,actor=user().uid;setBusy(true);message('#profile-save-status','Requesting confirmation…');
  try{const result=await window.RipprAccount.act('requestEmailVerification');if(validSession(ticket,actor))message('#profile-save-status',result.verified?'Email already confirmed.':'Confirmation email queued. Check your inbox and spam folder. The link expires in 30 minutes.')}catch(error){if(validSession(ticket,actor))message('#profile-save-status',errorText(error),true)}finally{if(validSession(ticket,actor)){setBusy(false);render()}}
 });
 $('#sms-alerts').addEventListener('change',()=>{smsDirty=true;message('#sms-status','')});
 $('#sms-consent-form').addEventListener('submit',async event=>{
  event.preventDefault();if(busy||!user())return;
  const ticket=generation,actor=user().uid,enabled=$('#sms-alerts').checked,expectedPhoneNumber=user().phoneNumber||null;
  setBusy(true);message('#sms-status','Saving…');
  try{await window.RipprAccount.act('smsConsent',{enabled,disclosureVersion:model.SMS_CONSENT_VERSION,expectedPhoneNumber});if(!validSession(ticket,actor))return;smsDirty=false;message('#sms-status',enabled?'Preference saved. Text alerts are not sending yet.':'Text alerts turned off. Phone sign-in is unchanged.')}catch(error){if(validSession(ticket,actor))message('#sms-status',errorText(error),true)}finally{if(validSession(ticket,actor)){setBusy(false);render()}}
 });
 document.querySelectorAll('[data-sms-policy]').forEach(button=>button.addEventListener('click',()=>{
  const kind=button.dataset.smsPolicy==='privacy'?'privacy':'terms',dialog=document.querySelector('#footer-info-dialog');
  if(!dialog)return;
  document.querySelector('#footer-info-title').textContent=kind==='privacy'?'Privacy — review draft':'Text alerts — prelaunch terms';
  const copy=document.querySelector('#footer-info-copy');copy.replaceChildren();
  const note=document.createElement('p');note.textContent=kind==='privacy'?'Your text preference is stored with your verified phone number. Marketing texts are not sending yet. See the draft privacy policy for current data handling.':'Marketing texts are not sending yet. Saving this preference does not start a messaging program. Final provider, frequency, STOP/HELP and messaging terms must be reviewed before launch.';
  const link=document.createElement('a');link.href=kind+'.html';link.target='_blank';link.rel='noopener noreferrer';link.textContent='Read '+(kind==='privacy'?'privacy policy':'terms')+' draft (opens in a new tab)';copy.append(note,link);
  dialog.addEventListener('close',()=>button.focus({preventScroll:true}),{once:true});dialog.showModal();
 }));
 $('#settings-avatar').addEventListener('error',event=>{event.target.src=window.RIPPR_MASCOT_URLS?.welcome||'assets/mascot/pip-welcome.png'},{once:true});
 $('#change-photo').addEventListener('click',()=>$('#photo-file').click());
 $('#photo-file').addEventListener('change',async event=>{const file=event.target.files[0];event.target.value='';if(!file||busy||!user())return;const ticket=generation,actor=user().uid;setBusy(true);message('#profile-save-status','Uploading photo…');try{const photoURL=await client.uploadProfileImage(file);if(!validSession(ticket,actor))return;await window.RipprAccount.act('settings',{photoURL});if(validSession(ticket,actor))message('#profile-save-status','Photo saved.')}catch(error){if(validSession(ticket,actor))message('#profile-save-status',errorText(error),true)}finally{if(validSession(ticket,actor)){setBusy(false);render()}}});
 $('#edit-address').addEventListener('click',()=>{const address=account().wallet.address||{country:'US'};for(const input of $('#address-form').querySelectorAll('input'))input.value=address[input.name]||'';message('#address-error','');$('#address-dialog').showModal();announceDialog()});
 $('#address-form').addEventListener('submit',async event=>{event.preventDefault();const address=Object.fromEntries(new FormData(event.target));if(await save({address},'#address-error'))$('#address-dialog').close()});
 for(const [id,key]of [['#pref-sound','soundEffects'],['#pref-email','emailUpdates'],['#pref-shipping','shippingUpdates']])$(id).addEventListener('change',async event=>{const value=event.target.checked;if(key==='emailUpdates'&&value&&!account().wallet.emailForUpdates){event.target.checked=false;message('#preference-status','Add and save an email address before enabling email updates.',true);$('#updates-email').focus();return}if(await save({preferences:{[key]:value}},'#preference-status')){if(key!=='soundEffects')message('#preference-status','Preference saved. Email updates use your confirmed address.');if(key==='soundEffects'){try{localStorage.setItem('rippr:opening-muted',String(!value))}catch{}document.dispatchEvent(new CustomEvent('rippr:soundpreferencechange',{detail:{muted:!value}}));render()}}});
 $('#change-number').addEventListener('click',()=>{if(!user().phoneNumber){location.href='auth.html?mode=login&next='+encodeURIComponent(location.pathname+location.search+location.hash);return}phoneStage='current-send';client.cancelPhoneChange();$('#phone-code-label').hidden=true;$('#new-phone-label').hidden=true;$('#phone-instructions').textContent='First, verify your current number.';$('#phone-change-submit').textContent='Send code';$('#phone-change-code').value='';$('#new-phone').value='';message('#phone-change-error','');$('#phone-dialog').showModal();announceDialog()});
 $('#phone-change-form').addEventListener('submit',async event=>{event.preventDefault();if(busy||!user())return;const code=$('#phone-change-code');code.required=phoneStage.endsWith('-code');if(code.required&&!code.reportValidity())return;const previousStage=phoneStage,ticket=generation,actor=user().uid;setBusy(true);message('#phone-change-error','');try{if(phoneStage==='current-send'||phoneStage==='new-send'){await client.startPhoneChange($('#new-phone').value,{verifyCurrent:phoneStage==='current-send'});if(!validSession(ticket,actor))return;phoneStage=phoneStage==='current-send'?'current-code':'new-code';$('#phone-code-label').hidden=false;$('#new-phone-label').hidden=true;$('#phone-change-code').value='';$('#phone-instructions').textContent='Enter the verification code sent to your phone.';$('#phone-change-submit').textContent='Verify code'}else{const result=await client.confirmPhoneChange($('#phone-change-code').value);if(!validSession(ticket,actor))return;if(result.verifiedCurrent){phoneStage='new-send';$('#phone-code-label').hidden=true;$('#new-phone-label').hidden=false;$('#phone-instructions').textContent='Current number verified. Enter your new phone number.';$('#phone-change-submit').textContent='Send code'}else{$('#phone-dialog').close();message('#profile-save-status','Phone number updated.');await window.RipprAccount.refresh()}}}catch(error){if(validSession(ticket,actor))message('#phone-change-error',errorText(error),true)}finally{if(validSession(ticket,actor)){setBusy(false);render();if($('#phone-dialog').open&&phoneStage!==previousStage){if(!$('#phone-code-label').hidden)$('#phone-change-code').focus();else if(!$('#new-phone-label').hidden)$('#new-phone').focus()}}}});
 function announceDialog(){document.dispatchEvent(new CustomEvent('rippr:navigationchange',{detail:{menuOpen:false,dialogOpen:Boolean(document.querySelector('.settings-dialog[open]'))}}))}
 for(const dialog of document.querySelectorAll('.settings-dialog')){dialog.querySelectorAll('[data-settings-close]').forEach(b=>b.addEventListener('click',()=>{if(!busy)dialog.close()}));dialog.addEventListener('cancel',event=>{if(busy)event.preventDefault()});dialog.addEventListener('close',()=>{if(dialog.id==='phone-dialog')client.cancelPhoneChange?.();announceDialog()})}
 $('#settings-signout').addEventListener('click',async()=>{if(busy)return;if((dirty||smsDirty)&&!confirm('Discard unsaved changes and sign out?'))return;try{await client.signOut()}catch(error){message('#profile-save-status',errorText(error),true)}});
 $('#gate-retry').addEventListener('click',()=>window.RipprAccount.refresh());
 document.querySelectorAll('.settings-sidebar>a').forEach(link=>link.addEventListener('click',()=>{document.querySelectorAll('.settings-sidebar>a').forEach(el=>el.removeAttribute('aria-current'));link.setAttribute('aria-current','location')}));
 window.addEventListener('beforeunload',event=>{if((dirty||smsDirty)&&user()){event.preventDefault();event.returnValue=''}});
 document.addEventListener('rippr:authchange',render);document.addEventListener('rippr:walletchange',render);render();
})();
