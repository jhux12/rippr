(() => {
  'use strict';
  const $ = selector => document.querySelector(selector);
  const client = window.RipprFirebase;
  const googleEnabled = window.RIPPR_AUTH_FEATURES?.google === true;
  const tabs = [$('#signup-tab'), $('#login-tab')];
  const form = $('#auth-form'), email = $('#email'), password = $('#password'), terms = $('#terms');
  const toggle = $('#password-toggle'), status = $('#auth-status');
  let mode, policyTrigger, busy = false, ready = false, signedInUser = null;
  function clearError(input) {
    input.removeAttribute('aria-invalid');
    const message = $(`#${input.id}-error`); message.textContent = ''; message.hidden = true;
  }
  function showError(input, message) {
    input.setAttribute('aria-invalid', 'true');
    const error = $(`#${input.id}-error`); error.textContent = message; error.hidden = false;
  }
  function passwordVisibility(visible) {
    password.type = visible ? 'text' : 'password';
    toggle.setAttribute('aria-pressed', String(visible));
    toggle.setAttribute('aria-label', visible ? 'Hide password' : 'Show password');
  }
  function message(text, account = false) {
    const target = account ? $('#account-status') : status;
    target.textContent = text; target.hidden = false; target.focus();
  }
  function errorMessage(error) {
    const messages = {
      'auth/invalid-credential': 'The email or password is not correct.',
      'auth/wrong-password': 'The email or password is not correct.',
      'auth/user-not-found': 'The email or password is not correct.',
      'auth/email-already-in-use': 'Try signing in or resetting your password for this email.',
      'auth/weak-password': 'Use a stronger password with at least 12 characters.',
      'auth/password-does-not-meet-requirements': 'Your password does not meet the account requirements. Try a longer, stronger password.',
      'auth/invalid-email': 'Enter a valid email address.',
      'auth/popup-closed-by-user': 'Google sign-in was cancelled. You can try again.',
      'auth/cancelled-popup-request': 'Google sign-in was cancelled. You can try again.',
      'auth/popup-blocked': 'Allow popups for this site, then try Google sign-in again.',
      'auth/unauthorized-domain': 'Sign-in is not enabled for this site address yet.',
      'auth/operation-not-allowed': 'This sign-in method is not enabled yet.',
      'auth/configuration-not-found': 'Sign-in has not been enabled for this project yet.',
      'auth/invalid-api-key': 'Sign-in configuration needs attention. Please contact the site owner.',
      'auth/user-disabled': 'This account cannot sign in. Please contact support.',
      'auth/network-request-failed': 'Connection failed. Check your connection and try again.',
      'auth/too-many-requests': 'Too many attempts. Please wait and try again.',
      'auth/offline-preview': 'Sign-in is available on the hosted site. Offline previews do not connect to accounts.'
    };
    return messages[error?.code] || 'That did not work. Please try again.';
  }
  function setBusy(value) {
    busy = value;
    [email, password, toggle, ...tabs, $('#switch-mode')].forEach(input => input.disabled = value);
    terms.disabled = value || mode !== 'signup';
    [$('#auth-submit'), $('#google-auth'), $('#reset-password'), $('#sign-out'), $('#resend-verification'), $('#refresh-verification')].forEach(button => button.disabled = value || !ready);
    $('#google-auth').disabled = value || !ready || !googleEnabled;
    $('#google-auth').title = googleEnabled ? '' : 'Google sign-in is not enabled yet.';
    form.setAttribute('aria-busy', String(value));
  }
  function readMode() {
    const hash = location.hash.slice(1);
    if (hash === 'login' || hash === 'signup') return hash;
    return new URLSearchParams(location.search).get('mode') === 'login' ? 'login' : 'signup';
  }
  function setMode(next, updateHistory = false, focus = false) {
    if (busy) return;
    mode = next === 'login' ? 'login' : 'signup';
    const signup = mode === 'signup';
    $('.auth-layout').dataset.mode = mode;
    tabs.forEach((tab, i) => { const active = signup ? i === 0 : i === 1; tab.setAttribute('aria-selected', String(active)); tab.tabIndex = active ? 0 : -1; });
    $('#auth-panel').setAttribute('aria-labelledby', signup ? 'signup-tab' : 'login-tab');
    $('#auth-title').textContent = signup ? 'Create your account' : 'Welcome back';
    $('#auth-intro').textContent = signup ? 'A little closer to your next discovery.' : 'Your next great pull is waiting.';
    $('#auth-submit').textContent = signup ? 'Create account' : 'Log in';
    $('#google-label').textContent = googleEnabled ? (signup ? 'Sign up with Google' : 'Sign in with Google') : 'Google sign-in coming soon';
    $('#switch-intro').textContent = signup ? 'Already have an account?' : 'New to rippr?';
    $('#switch-mode').textContent = signup ? 'Log in' : 'Create an account';
    document.title = signup ? 'Create your account — rippr' : 'Log in — rippr';
    password.autocomplete = signup ? 'new-password' : 'current-password';
    password.placeholder = signup ? 'Create a password' : 'Enter your password';
    if (signup) password.minLength = 12; else password.removeAttribute('minlength');
    $('#password-help').hidden = !signup; $('#reset-password').hidden = signup;
    password.setAttribute('aria-describedby', signup ? 'password-help password-error' : 'password-error');
    terms.required = signup; terms.disabled = !signup; terms.checked = false; $('#terms-group').hidden = !signup;
    password.value = ''; passwordVisibility(false); [email, password, terms].forEach(clearError);
    status.textContent = ''; status.hidden = true;
    if (updateHistory) { const url = new URL(location.href); url.searchParams.set('mode', mode); url.hash = ''; try { history.pushState(null, '', url); } catch { location.hash = mode; } }
    if (focus) tabs[signup ? 0 : 1].focus();
    setBusy(false);
  }
  function showAccount(user) {
    signedInUser = user;
    $('.auth-tabs').hidden = Boolean(user); $('#auth-panel').hidden = Boolean(user); $('#account-panel').hidden = !user;
    $('#open-admin').hidden = !user?.isAdmin;
    if (!user) return;
    // Only a fixed internal destination is accepted; never redirect to arbitrary URLs.
    if (user.isAdmin && new URLSearchParams(location.search).get('next') === '/admin') { location.replace('/admin'); return; }
    document.title = 'Your account — rippr';
    $('#account-email').textContent = user.email || user.displayName || 'Your rippr account';
    $('#verification-status').textContent = user.emailVerified ? 'Your email is verified.' : 'Verify your email using the link in your inbox.';
    $('#resend-verification').hidden = user.emailVerified; $('#refresh-verification').hidden = user.emailVerified;
  }
  async function authenticate(operation, signup = false) {
    if (busy || !ready) return;
    status.hidden = true; setBusy(true);
    try {
      const result = await operation();
      password.value = ''; passwordVisibility(false);
      const user = client.currentUser(); showAccount(user);
      if (user) $('#account-title').focus();
      if (signup && result?.verificationSent === false) message('Your account was created. Use Resend verification to request a new verification email.', true);
    } catch (error) { password.value = ''; passwordVisibility(false); message(errorMessage(error)); }
    finally { setBusy(false); }
  }
  tabs.forEach((tab, i) => {
    tab.addEventListener('click', () => setMode(i === 0 ? 'signup' : 'login', true));
    tab.addEventListener('keydown', event => { if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return; event.preventDefault(); const next = event.key === 'Home' ? 0 : event.key === 'End' ? 1 : 1 - i; setMode(next === 0 ? 'signup' : 'login', true, true); });
  });
  $('#switch-mode').addEventListener('click', () => setMode(mode === 'signup' ? 'login' : 'signup', true, true));
  window.addEventListener('popstate', () => setMode(readMode())); window.addEventListener('hashchange', () => setMode(readMode()));
  toggle.addEventListener('click', () => passwordVisibility(password.type === 'password'));
  [email, password, terms].forEach(input => input.addEventListener(input === terms ? 'change' : 'input', () => { clearError(input); status.hidden = true; }));
  form.addEventListener('submit', event => {
    event.preventDefault(); if (busy || !ready) return;
    status.hidden = true; [email, password, terms].forEach(clearError); const invalid = []; email.value = email.value.trim();
    if (!email.value || !email.validity.valid) { showError(email, 'Enter a valid email address.'); invalid.push(email); }
    if (!password.value) { showError(password, 'Enter your password.'); invalid.push(password); }
    else if (mode === 'signup' && password.value.length < 12) { showError(password, 'Use at least 12 characters.'); invalid.push(password); }
    if (mode === 'signup' && !terms.checked) { showError(terms, 'Please review and accept the Terms and Privacy Policy.'); invalid.push(terms); }
    if (invalid.length) { invalid[0].focus(); return; }
    authenticate(() => mode === 'signup' ? client.createAccount(email.value, password.value) : client.signInEmail(email.value, password.value), mode === 'signup');
  });
  $('#google-auth').addEventListener('click', () => {
    if (!googleEnabled) return;
    if (mode === 'signup' && !terms.checked) { showError(terms, 'Please review and accept the Terms and Privacy Policy.'); terms.focus(); return; }
    // authenticate invokes the operation immediately, keeping the popup user gesture.
    authenticate(() => client.signInGoogle());
  });
  $('#reset-password').addEventListener('click', async () => {
    if (busy || !ready) return;
    email.value = email.value.trim();
    if (!email.value || !email.validity.valid) { showError(email, 'Enter your email address to reset your password.'); email.focus(); return; }
    setBusy(true);
    try { await client.resetPassword(email.value); message('If an account uses this email, a password reset link has been sent.'); }
    catch (error) { message(errorMessage(error)); } finally { setBusy(false); }
  });
  $('#sign-out').addEventListener('click', async () => {
    if (busy || !ready) return; setBusy(true);
    try { await client.signOut(); setBusy(false); showAccount(null); setMode('login', true); $('#email').focus(); }
    catch (error) { message(errorMessage(error), true); } finally { setBusy(false); }
  });
  $('#refresh-verification').addEventListener('click', async () => {
    if (busy || !ready) return; setBusy(true);
    try { const user = await client.refreshUser(); showAccount(user); message(user?.emailVerified ? 'Your email is verified.' : 'Your email is not verified yet. Open the link in your verification email.', true); }
    catch (error) { message(errorMessage(error), true); } finally { setBusy(false); }
  });
  $('#resend-verification').addEventListener('click', async () => {
    if (busy || !ready) return; setBusy(true);
    try { await client.resendVerification(); message('Verification email sent. Check your inbox.', true); }
    catch (error) { message(errorMessage(error), true); } finally { setBusy(false); }
  });
  document.addEventListener('rippr:authchange', event => { if (!busy) showAccount(event.detail.user); });
  const dialog = $('#policy-dialog');
  document.querySelectorAll('[data-policy]').forEach(button => button.addEventListener('click', () => {
    policyTrigger = button; const privacy = button.dataset.policy === 'privacy'; $('#policy-title').textContent = privacy ? 'Privacy Policy' : 'Terms';
    $('#policy-copy').textContent = privacy ? 'Email and password sign-in is handled by Firebase Authentication. Passwords are not saved in this site’s code. A full privacy policy is still being prepared.' : 'Published terms are still being prepared. Test credit is free and has no cash value. Items and shipping requests are tests; no payment or physical dispatch is processed.';
    dialog.showModal();
  }));
  $('#policy-close').addEventListener('click', () => dialog.close()); dialog.addEventListener('close', () => policyTrigger?.focus());
  dialog.addEventListener('click', event => { if (event.target !== dialog) return; const r = dialog.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) dialog.close(); });
  setMode(readMode());
  if (client) client.ready.then(() => { ready = true; setBusy(false); showAccount(client.currentUser()); }).catch(() => message('Sign-in could not load. Please reload the page.'));
  else message('Sign-in could not load. Please reload the page.');
})();
