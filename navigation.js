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
      detail: { menuOpen: !menu.hidden, dialogOpen: dialog.open }
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
      ? '<h2 id="nav-dialog-title">Your collection</h2><p>Saved collections are coming soon. For now, try a demo pack and view your cards after opening.</p>'
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
