(() => {
  'use strict';
  const $ = selector => document.querySelector(selector);
  const client = window.RipprFirebase, phoneModel = window.RipprPhone;
  const form = $('#auth-form'), phone = $('#phone'), code = $('#verification-code');
  const legacyEmail = $('#legacy-email'), legacyPassword = $('#legacy-password');
  const sentAt = new Map();
  let ready = false, busy = false, operation = '', step = 'phone', sentNumber = '', user = null, generation = 0, policyTrigger;
  const errors = {
    'auth/invalid-phone-number':'Enter a 10-digit US phone number, or include your country code.',
    'auth/missing-phone-number':'Enter your phone number.',
    'auth/invalid-verification-code':'That code is not correct. Check the six digits and try again.',
    'auth/code-expired':'Your code expired. Send a new code to continue.',
    'auth/session-expired':'Your code expired. Send a new code to continue.',
    'auth/invalid-verification-id':'Send a new code to continue.',
    'auth/captcha-check-failed':'The security check did not finish. Try sending the code again.',
    'auth/missing-app-credential':'The security check did not finish. Try sending the code again.',
    'auth/invalid-app-credential':'The security check could not be verified. Try again or contact support.',
    'auth/argument-error':'The sign-in security check could not load. Reload and try again.',
    'auth/too-many-requests':'Too many attempts. Please wait before trying again.',
    'auth/quota-exceeded':'Text sign-in is temporarily unavailable. Please try again later.',
    'auth/unauthorized-domain':'Sign-in is not enabled for this site address yet.',
    'auth/configuration-not-found':'Sign-in setup needs attention. Please contact support.',
    'auth/invalid-api-key':'Sign-in configuration needs attention. Please contact support.',
    'auth/user-disabled':'This account cannot sign in. Please contact support.',
    'auth/network-request-failed':'Connection failed. Check your connection and try again.',
    'auth/credential-already-in-use':'That phone belongs to another account. No accounts were merged. Use another number, or sign out and sign in with that phone.',
    'auth/account-exists-with-different-credential':'That phone belongs to another account. No accounts were merged. Use another number, or sign out and sign in with that phone.',
    'auth/phone-number-already-exists':'That phone belongs to another account. No accounts were merged. Use another number, or sign out and sign in with that phone.',
    'auth/provider-already-linked':'This account already has a phone number. Reload to continue.',
    'auth/requires-recent-login':'Sign in to your existing account again before linking your phone.',
    'auth/invalid-link-session':'Your existing-account sign-in changed. Start again.',
    'auth/cancelled-phone-request':'The sign-in request changed. Send a new code.',
    'auth/already-signed-in':'Sign out before using another account.',
    'auth/invalid-credential':'The email or password is not correct.',
    'auth/wrong-password':'The email or password is not correct.',
    'auth/user-not-found':'The email or password is not correct.',
    'auth/invalid-email':'Enter a valid email address.',
    'auth/offline-preview':'Phone sign-in is available on the hosted site. Offline previews do not send texts.'
  };
  function errorMessage(error) {
    const setup = phoneModel.phoneSetupMessage(error), reference = phoneModel.authErrorReference(error);
    if(setup)return setup + (reference ? ` Reference: ${reference}.` : '');
    if(errors[error?.code])return errors[error.code];
    return 'That did not work. Please try again.' + (reference ? ` Reference: ${reference}.` : '');
  }
  function clearError(input) { input.removeAttribute('aria-invalid'); const error=$('#'+input.id+'-error'); error.hidden=true; error.textContent=''; }
  function fieldError(input,text) { input.setAttribute('aria-invalid','true'); const error=$('#'+input.id+'-error'); error.textContent=text; error.hidden=false; input.focus(); }
  function message(text,account=false) { const target=$(account?'#account-status':'#auth-status'); target.textContent=text; target.hidden=false; target.focus(); }
  function clearStatus() { $('#auth-status').hidden=true; $('#auth-status').textContent=''; }
  function resetPasswordVisibility() { legacyPassword.value=''; legacyPassword.type='password'; $('#password-toggle').setAttribute('aria-pressed','false'); $('#password-toggle').setAttribute('aria-label','Show password'); }
  function remaining(number=sentNumber) { return Math.max(0,Math.ceil(((sentAt.get(number)||0)+60000-Date.now())/1000)); }
  function controls() {
    for(const id of ['phone','verification-code','auth-submit','change-phone','legacy-email','legacy-password','legacy-submit','password-toggle','reset-password','link-signout','sign-out']) $('#'+id).disabled=busy||!ready;
    $('#resend-code').disabled=busy||!ready||step!=='code'||remaining()>0;
    $('#resend-code').textContent=remaining()>0?`Resend in ${remaining()}s`:'Resend code';
    $('#auth-submit').textContent=busy&&operation==='verify'?'Verifying…':busy&&operation==='send'?'Sending…':step==='code'?'Verify & continue':'Send code';
    $('#legacy-submit').textContent=busy&&operation==='legacy'?'Signing in…':'Continue with existing account';
    form.setAttribute('aria-busy',String(busy)); $('#legacy-form').setAttribute('aria-busy',String(busy));
  }
  function setBusy(value,kind='') { busy=value; operation=value?kind:''; controls(); }
  function renderStep() {
    $('#phone-step').hidden=step!=='phone'; $('#code-step').hidden=step!=='code'; $('#code-actions').hidden=step!=='code';
    phone.required=step==='phone'; code.required=step==='code';
    $('#auth-title').textContent=step==='code'?'Enter your code':user?'Link your phone':'Welcome to rippr';
    $('#phone-intro').textContent=step==='code'?`Code sent to ${sentNumber}`:user?'Verify a number for this account.':'Sign in or sign up with your phone.';
    $('#link-account-note').hidden=!user; $('#legacy-access').hidden=Boolean(user)||step==='code';
    controls();
  }
  function resetPhoneRequest() { generation++; client?.cancelPhoneSignIn?.(); step='phone'; sentNumber=''; code.value=''; [phone,code].forEach(clearError); clearStatus(); }
  function showUser(next) {
    user=next; const signedIn=Boolean(next?.phoneNumber);
    $('#auth-panel').hidden=signedIn; $('#account-panel').hidden=!signedIn; $('#open-admin').hidden=!next?.isAdmin;
    if(signedIn) {
      resetPhoneRequest(); resetPasswordVisibility();
      $('#account-phone').textContent=next.phoneNumber; document.title='Your account — rippr';
      if(next.isAdmin&&new URLSearchParams(location.search).get('next')==='/admin'){location.replace('/admin');return}
    } else { renderStep(); document.title='Sign in or sign up — rippr'; }
  }
  async function sendCode() {
    if(busy||!ready)return;
    clearStatus(); clearError(phone); clearError(code);
    const number=phoneModel.normalizePhoneNumber(step==='code'?sentNumber:phone.value);
    if(!number){fieldError(phone,errors['auth/invalid-phone-number']);return}
    if(remaining(number)>0){message(`Wait ${remaining(number)} seconds before requesting another code.`);return}
    const ticket=++generation, linking=Boolean(client.currentUser());
    setBusy(true,'send');
    try {
      const result=await client.startPhoneSignIn(number,{link:linking});
      if(ticket!==generation)return;
      sentNumber=result.phoneNumber; sentAt.set(sentNumber,Date.now()); step='code'; code.value=''; renderStep(); code.focus();
    } catch(error) { if(ticket===generation){step='phone';code.value='';renderStep();message(errorMessage(error))} }
    finally { if(ticket===generation)setBusy(false); }
  }
  form.addEventListener('submit',async event=>{
    event.preventDefault(); if(busy||!ready)return;
    if(step==='phone'){sendCode();return}
    clearStatus(); clearError(code);
    if(!phoneModel.validVerificationCode(code.value)){fieldError(code,'Enter the six-digit code from your text.');return}
    const ticket=++generation; setBusy(true,'verify');
    try {
      const next=await client.confirmPhoneSignIn(code.value);
      if(ticket!==generation)return;
      code.value=''; setBusy(false); showUser(next); $('#account-title').focus();
    } catch(error) {
      if(ticket!==generation)return;
      code.value='';
      if(['auth/code-expired','auth/session-expired','auth/invalid-verification-id','auth/invalid-link-session'].includes(error.code)) {
        client.cancelPhoneSignIn(); step='phone'; renderStep(); message(errorMessage(error));
      } else if(error.code==='auth/invalid-verification-code')fieldError(code,errorMessage(error));
      else if(client.currentUser()?.phoneNumber) { setBusy(false);showUser(client.currentUser()); message('You’re signed in. Your phone number is verified.',true); }
      else message(errorMessage(error));
    } finally { if(ticket===generation||!busy)setBusy(false); }
  });
  $('#change-phone').addEventListener('click',()=>{if(busy)return;phone.value=sentNumber;resetPhoneRequest();renderStep();phone.focus()});
  $('#resend-code').addEventListener('click',sendCode);
  $('#legacy-form').addEventListener('submit',async event=>{
    event.preventDefault(); if(busy||!ready)return;
    clearStatus(); [legacyEmail,legacyPassword].forEach(clearError); legacyEmail.value=legacyEmail.value.trim();
    if(!legacyEmail.value||!legacyEmail.validity.valid){fieldError(legacyEmail,'Enter your existing email address.');return}
    if(!legacyPassword.value){fieldError(legacyPassword,'Enter your existing password.');return}
    const ticket=++generation; client.cancelPhoneSignIn(); setBusy(true,'legacy');
    try { const next=await client.signInEmail(legacyEmail.value,legacyPassword.value); if(ticket!==generation)return;resetPhoneRequest();setBusy(false);showUser(next);(next?.phoneNumber?$('#account-title'):phone).focus(); }
    catch(error){if(ticket===generation)message(errorMessage(error))}
    finally {if(ticket===generation||!busy){resetPasswordVisibility();setBusy(false)}}
  });
  $('#password-toggle').addEventListener('click',()=>{const visible=legacyPassword.type==='password';legacyPassword.type=visible?'text':'password';$('#password-toggle').setAttribute('aria-pressed',String(visible));$('#password-toggle').setAttribute('aria-label',visible?'Hide password':'Show password')});
  $('#reset-password').addEventListener('click',async()=>{
    if(busy||!ready)return; clearError(legacyEmail); legacyEmail.value=legacyEmail.value.trim();
    if(!legacyEmail.value||!legacyEmail.validity.valid){fieldError(legacyEmail,'Enter your existing email address.');return}
    setBusy(true);
    try {await client.resetPassword(legacyEmail.value);message('If this email has an account, a password reset link has been sent.')}
    catch(error){message(errorMessage(error))}finally{setBusy(false)}
  });
  async function signOut() {
    if(busy||!ready)return; resetPhoneRequest();setBusy(true,'signout');
    try{await client.signOut();phone.value='';$('#account-status').hidden=true;setBusy(false);showUser(null);phone.focus()}
    catch(error){message(errorMessage(error),Boolean(user?.phoneNumber))}finally{setBusy(false)}
  }
  $('#sign-out').addEventListener('click',signOut);$('#link-signout').addEventListener('click',signOut);
  for(const input of [phone,code,legacyEmail,legacyPassword])input.addEventListener('input',()=>{clearError(input);clearStatus()});
  document.addEventListener('rippr:authchange',event=>{
    const next=event.detail.user;
    if(busy){
      const expected=next?.uid===user?.uid||(operation==='verify'&&!user&&next?.phoneNumber===sentNumber)||(operation==='legacy'&&next?.email?.toLowerCase()===legacyEmail.value.trim().toLowerCase())||(operation==='signout'&&!next);
      if(expected)return;
      resetPhoneRequest();resetPasswordVisibility();setBusy(false);
    }
    if(next?.uid!==user?.uid)resetPhoneRequest();showUser(next);
  });
  const dialog=$('#policy-dialog');
  document.querySelectorAll('[data-policy]').forEach(button=>button.addEventListener('click',()=>{
    policyTrigger=button;const privacy=button.dataset.policy==='privacy';$('#policy-title').textContent=privacy?'Privacy Policy':'Terms';
    $('#policy-copy').textContent=privacy?'Phone sign-in is handled by Firebase Authentication. Your number is sent to and stored by Google for authentication and spam/abuse prevention. rippr does not store your verification code. A full privacy policy is still being prepared.':'Published terms are still being prepared. Test credit is free and has no cash value. Items and shipping requests are tests; no payment or physical dispatch is processed.';
    dialog.showModal();
  }));
  $('#policy-close').addEventListener('click',()=>dialog.close());dialog.addEventListener('close',()=>policyTrigger?.focus());
  dialog.addEventListener('click',event=>{if(event.target!==dialog)return;const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close()});
  let cooldown=setInterval(controls,1000);
  window.addEventListener('pagehide',()=>{clearInterval(cooldown);cooldown=null;resetPhoneRequest()});
  window.addEventListener('pageshow',event=>{if(event.persisted){setBusy(false);showUser(client?.currentUser());if(!cooldown)cooldown=setInterval(controls,1000)}});
  renderStep();
  if(client)client.ready.then(()=>{ready=true;setBusy(false);showUser(client.currentUser())}).catch(()=>message('Sign-in could not load. Please reload the page.'));
  else message('Sign-in could not load. Please reload the page.');
})();
