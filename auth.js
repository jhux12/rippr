(() => {
  'use strict';
  const $ = selector => document.querySelector(selector);
  const tabs = [$('#signup-tab'), $('#login-tab')];
  const form = $('#auth-form');
  const email = $('#email');
  const password = $('#password');
  const terms = $('#terms');
  const toggle = $('#password-toggle');
  const status = $('#auth-status');
  let mode;
  let policyTrigger;

  function clearError(input) {
    input.removeAttribute('aria-invalid');
    const message = $(`#${input.id}-error`);
    message.textContent = '';
    message.hidden = true;
  }
  function showError(input, message) {
    input.setAttribute('aria-invalid', 'true');
    const error = $(`#${input.id}-error`);
    error.textContent = message;
    error.hidden = false;
  }
  function passwordVisibility(visible) {
    password.type = visible ? 'text' : 'password';
    toggle.setAttribute('aria-pressed', String(visible));
    toggle.setAttribute('aria-label', visible ? 'Hide password' : 'Show password');
  }
  function readMode() {
    const hash = location.hash.slice(1);
    if (hash === 'login' || hash === 'signup') return hash;
    return new URLSearchParams(location.search).get('mode') === 'login' ? 'login' : 'signup';
  }
  function setMode(next, updateHistory = false, focus = false) {
    mode = next === 'login' ? 'login' : 'signup';
    const signup = mode === 'signup';
    document.querySelector('.auth-layout').dataset.mode = mode;
    tabs.forEach((tab, i) => {
      const active = signup ? i === 0 : i === 1;
      tab.setAttribute('aria-selected', String(active));
      tab.tabIndex = active ? 0 : -1;
    });
    $('#auth-panel').setAttribute('aria-labelledby', signup ? 'signup-tab' : 'login-tab');
    $('#auth-title').textContent = signup ? 'Create your account' : 'Welcome back';
    $('#auth-intro').textContent = signup ? 'A little closer to your next discovery.' : 'Your next great pull is waiting.';
    $('#auth-submit').textContent = signup ? 'Create account' : 'Log in';
    $('#google-label').textContent = signup ? 'Sign up with Google' : 'Sign in with Google';
    $('#switch-intro').textContent = signup ? 'Already have an account?' : 'New to rippr?';
    $('#switch-mode').textContent = signup ? 'Log in' : 'Create an account';
    document.title = signup ? 'Create your account — rippr' : 'Log in — rippr';
    password.autocomplete = signup ? 'new-password' : 'current-password';
    password.placeholder = signup ? 'Create a password' : 'Enter your password';
    if (signup) password.minLength = 12;
    else password.removeAttribute('minlength');
    $('#password-help').hidden = !signup;
    password.setAttribute('aria-describedby', signup ? 'password-help password-error' : 'password-error');
    terms.required = signup;
    terms.disabled = !signup;
    terms.checked = false;
    $('#terms-group').hidden = !signup;
    password.value = '';
    passwordVisibility(false);
    [email, password, terms].forEach(clearError);
    status.textContent = '';
    status.hidden = true;
    if (updateHistory) {
      const url = new URL(location.href);
      url.searchParams.set('mode', mode);
      url.hash = '';
      try { history.pushState(null, '', url); }
      catch { location.hash = mode; }
    }
    if (focus) tabs[signup ? 0 : 1].focus();
  }
  tabs.forEach((tab, i) => {
    tab.addEventListener('click', () => setMode(i === 0 ? 'signup' : 'login', true));
    tab.addEventListener('keydown', event => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? 1 : 1 - i;
      setMode(next === 0 ? 'signup' : 'login', true, true);
    });
  });
  $('#switch-mode').addEventListener('click', () => setMode(mode === 'signup' ? 'login' : 'signup', true, true));
  window.addEventListener('popstate', () => setMode(readMode()));
  window.addEventListener('hashchange', () => setMode(readMode()));
  toggle.addEventListener('click', () => passwordVisibility(password.type === 'password'));
  [email, password, terms].forEach(input => input.addEventListener(input === terms ? 'change' : 'input', () => {
    clearError(input);
    status.hidden = true;
  }));
  form.addEventListener('submit', event => {
    event.preventDefault();
    status.hidden = true;
    [email, password, terms].forEach(clearError);
    const invalid = [];
    email.value = email.value.trim();
    if (!email.value) { showError(email, 'Enter your email address.'); invalid.push(email); }
    else if (!email.validity.valid) { showError(email, 'Enter a valid email address.'); invalid.push(email); }
    if (!password.value) { showError(password, 'Enter your password.'); invalid.push(password); }
    else if (mode === 'signup' && password.value.length < 12) { showError(password, 'Use at least 12 characters.'); invalid.push(password); }
    if (mode === 'signup' && !terms.checked) { showError(terms, 'Please review and accept the Terms and Privacy Policy.'); invalid.push(terms); }
    if (invalid.length) { invalid[0].focus(); return; }
    // Frontend preview only: never send or persist entered credentials.
    password.value = '';
    passwordVisibility(false);
    status.textContent = mode === 'signup'
      ? 'This is a preview. Account creation is not connected yet. No account was created, and your details were not sent or saved.'
      : 'This is a preview. Log in is not connected yet. Your details were not sent or saved.';
    status.hidden = false;
    status.focus();
  });
  $('#google-auth').addEventListener('click', () => {
    password.value = '';
    passwordVisibility(false);
    status.textContent = 'Google ' + (mode === 'signup' ? 'sign-up' : 'sign-in') + ' is not connected yet. This is a preview; no Google sign-in was started and no account was created.';
    status.hidden = false;
    status.focus();
  });
  const dialog = $('#policy-dialog');
  document.querySelectorAll('[data-policy]').forEach(button => button.addEventListener('click', () => {
    policyTrigger = button;
    const privacy = button.dataset.policy === 'privacy';
    $('#policy-title').textContent = privacy ? 'Privacy Policy' : 'Terms';
    $('#policy-copy').textContent = privacy
      ? 'A published privacy policy is not available yet. This form is a frontend preview: it does not submit or save your email or password.'
      : 'Published terms are not available yet. This is a demo: account creation and payments are not connected.';
    dialog.showModal();
  }));
  $('#policy-close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => policyTrigger?.focus());
  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const r = dialog.getBoundingClientRect();
    if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) dialog.close();
  });
  setMode(readMode());
  $('#auth-submit').disabled = false;
  $('#google-auth').disabled = false;
})();
