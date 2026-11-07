(() => {
  'use strict';
  const header = document.querySelector('.site-navigation');
  if (!header) return;
  const toggle = header.querySelector('#nav-menu-toggle');
  const menu = header.querySelector('#mobile-navigation');
  const dialog = header.querySelector('#nav-dialog');
  const content = header.querySelector('#nav-dialog-content');
  const mobile = matchMedia('(max-width: 760px)');
  const packsTarget = document.querySelector('#packs') ? '#packs' : 'index.html#packs';
  let dialogTrigger;

  header.querySelectorAll('[data-nav-packs]').forEach(link => link.setAttribute('href', packsTarget));
  function announceState() {
    document.dispatchEvent(new CustomEvent('rippr:navigationchange', {
      detail: { menuOpen: !menu.hidden, dialogOpen: dialog.open || Boolean(document.querySelector('.topup-dialog')?.open) }
    }));
  }
  function setMenu(open, restoreFocus = false) {
    const visible = Boolean(open && mobile.matches);
    menu.hidden = !visible;
    toggle.setAttribute('aria-expanded', String(visible));
    toggle.setAttribute('aria-label', visible ? 'Close navigation menu' : 'Open navigation menu');
    if (restoreFocus && mobile.matches) toggle.focus({ preventScroll: true });
    announceState();
  }
  toggle.hidden = false;
  toggle.addEventListener('click', () => setMenu(menu.hidden));
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !menu.hidden && !dialog.open) {
      event.preventDefault();
      setMenu(false, true);
    }
  });
  document.addEventListener('pointerdown', event => {
    if (!menu.hidden && !header.contains(event.target)) setMenu(false);
  });
  header.querySelectorAll('a').forEach(link => link.addEventListener('click', () => {
    if (!menu.hidden) setMenu(false, menu.contains(link));
  }));
  mobile.addEventListener('change', () => {
    const active = document.activeElement;
    const focusWasInMenu = menu.contains(active) || active === toggle;
    setMenu(false);
    if (!mobile.matches && focusWasInMenu) header.querySelector('.nav-brand').focus({ preventScroll: true });
  });

  function returnDialogFocus() {
    const target = mobile.matches ? toggle
      : header.querySelector(`.nav-links [data-nav-dialog="${dialogTrigger?.dataset.navDialog}"]`) || header.querySelector('.nav-brand');
    if (target) target.focus({ preventScroll: true });
    announceState();
  }
  header.querySelectorAll('[data-nav-dialog]').forEach(button => button.addEventListener('click', () => {
    dialogTrigger = button;
    setMenu(false);
    content.innerHTML = button.dataset.navDialog === 'collection'
      ? `<div class="pip-dialog-intro"><img class="pip-dialog-portrait" src="${window.RIPPR_MASCOT_URLS?.hover||'assets/mascot/pip-hover.png'}" alt="" width="72" height="72"><h2 id="nav-dialog-title">Your collection</h2></div><p>Saved collections are coming soon. For now, try a demo pack and view your cards after opening.</p>`
      : '<h2 id="nav-dialog-title">How it works</h2><ol><li>Choose one of five pack tiers.</li><li>Select how many packs to open.</li><li>Rip the foil to reveal one card per pack.</li></ol><p>Openings are free demos. No payments or physical cards are involved.</p>';
    const explore = document.createElement('a');
    explore.className = 'nav-dialog-action';
    explore.href = packsTarget;
    explore.textContent = 'Explore packs';
    explore.addEventListener('click', () => dialog.close());
    content.append(explore);
    dialog.showModal();
    announceState();
  }));
  header.querySelector('.nav-dialog-close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', returnDialogFocus);
  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const bounds = dialog.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.close();
  });
  function updateAccountLinks() {
    const user = window.RIPPR_ACCOUNT?.user;
    const login = header.querySelector('.nav-login');
    const signup = header.querySelector('.nav-signup');
    login.hidden = Boolean(user);
    signup.textContent = user ? 'Account' : 'Sign up';
    signup.href = user ? 'auth.html?mode=login' : 'auth.html?mode=signup';
    const mobileAccount = menu.querySelector('a:last-child');
    mobileAccount.textContent = user ? 'Account' : 'Log in';
    mobileAccount.href = 'auth.html?mode=login';
  }
  document.addEventListener('rippr:authchange', updateAccountLinks);
  updateAccountLinks();
  setMenu(false);
})();

(() => {
  'use strict';
  const header = document.querySelector('.site-navigation');
  const actions = header?.querySelector('.nav-actions');
  if (!actions) return;

  // Payment processing and an account wallet are not connected yet.
  const demoBalanceCents = 0;
  const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
  const balance = currency.format(demoBalanceCents / 100);
  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.className = 'topup-trigger nav-balance';
  trigger.setAttribute('aria-label', `Demo balance ${balance}. Open top up`);
  trigger.setAttribute('aria-haspopup', 'dialog');
  trigger.setAttribute('aria-controls', 'topup-dialog');
  trigger.title = 'Top up balance';
  trigger.innerHTML = `<svg class="nav-wallet-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M19 8V5a1 1 0 0 0-1.2-1L5.4 6.5A3 3 0 0 0 3 9.4V18a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V10a2 2 0 0 0-2-2H6a3 3 0 0 1-2.4-1.2"/><path d="M21 12h-5a2 2 0 0 0 0 4h5"/><path d="M16.5 14h.01"/></svg><span class="nav-balance-amount">${balance}</span><span class="nav-balance-add" aria-hidden="true"><svg viewBox="0 0 16 16" focusable="false"><path d="M8 3v10M3 8h10"/></svg></span>`;
  actions.prepend(trigger);

  const dialog = document.createElement('dialog');
  dialog.id = 'topup-dialog';
  dialog.className = 'topup-dialog';
  dialog.setAttribute('aria-labelledby', 'topup-title');
  dialog.innerHTML = `<div class="topup-heading"><span><b>✦</b> rippr</span><button type="button" class="topup-close" aria-label="Close top up">×</button></div><h2 id="topup-title">Top up your balance</h2><p class="topup-muted">Choose an amount to add.</p><div class="topup-balance"><span>Current balance</span><strong id="topup-current-balance">${balance}</strong></div><div class="topup-presets" role="group" aria-label="Choose amount">${[5,10,25,50,100,250].map(n => `<button type="button" data-amount="${n}" aria-pressed="${n === 25}">$${n}</button>`).join('')}</div><form novalidate><label for="topup-amount">Custom amount</label><div class="topup-input"><span>$</span><input id="topup-amount" inputmode="decimal" type="text" value="25.00" aria-describedby="topup-error"><span>USD</span></div><p id="topup-error" class="topup-error" role="alert" hidden></p><label>Payment method</label><div class="topup-method"><span aria-hidden="true">▤</span> Credit or debit card <span class="topup-chevron" aria-hidden="true">›</span></div><div class="topup-total"><span>You add</span><strong id="topup-total">$25.00</strong></div><button class="topup-continue" type="submit">Continue to payment <span aria-hidden="true">→</span></button><p class="topup-review">Review the total before paying.</p><p class="topup-notice" role="status" tabindex="-1">DESIGN PREVIEW · NO PAYMENT PROCESSED</p></form>`;
  document.body.append(dialog);
  const input = dialog.querySelector('input');
  const error = dialog.querySelector('#topup-error');
  const notice = dialog.querySelector('.topup-notice');
  const menu = header.querySelector('#mobile-navigation');
  const menuToggle = header.querySelector('#nav-menu-toggle');

  function announceState() {
    document.dispatchEvent(new CustomEvent('rippr:navigationchange', {
      detail: { menuOpen: !menu.hidden, dialogOpen: dialog.open || header.querySelector('#nav-dialog').open }
    }));
  }
  function amount() {
    const value = input.value.trim();
    return /^\d+(\.\d{1,2})?$/.test(value) ? Math.round(Number(value) * 100) : NaN;
  }
  function update() {
    const cents = amount();
    const valid = Number.isSafeInteger(cents) && cents >= 100 && cents <= 100000;
    dialog.querySelector('#topup-total').textContent = valid ? currency.format(cents / 100) : '—';
    dialog.querySelectorAll('[data-amount]').forEach(button => {
      button.setAttribute('aria-pressed', String(Number(button.dataset.amount) * 100 === cents));
    });
    error.hidden = true;
    input.removeAttribute('aria-invalid');
    return valid;
  }
  dialog.querySelectorAll('[data-amount]').forEach(button => button.addEventListener('click', () => {
    input.value = Number(button.dataset.amount).toFixed(2);
    update();
  }));
  input.addEventListener('input', update);
  trigger.addEventListener('click', () => {
    if (menuToggle.getAttribute('aria-expanded') === 'true') menuToggle.click();
    notice.textContent = 'DESIGN PREVIEW · NO PAYMENT PROCESSED';
    update();
    dialog.showModal();
    announceState();
  });
  dialog.querySelector('.topup-close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => {
    trigger.focus({ preventScroll: true });
    announceState();
  });
  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const bounds = dialog.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.close();
  });
  dialog.querySelector('form').addEventListener('submit', event => {
    event.preventDefault();
    if (!update()) {
      error.textContent = 'Enter an amount from $1 to $1,000 with up to two decimal places.';
      error.hidden = false;
      input.setAttribute('aria-invalid', 'true');
      input.focus();
      return;
    }
    notice.textContent = 'Payments are not connected yet. No charge was made and no funds were added.';
    notice.focus();
  });
})();
