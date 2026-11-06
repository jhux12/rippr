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

(() => {
  const actions=document.querySelector('.nav-actions');if(!actions)return;
  const trigger=document.createElement('button');trigger.type='button';trigger.className='topup-trigger';trigger.textContent='Top up';actions.prepend(trigger);
  const dialog=document.createElement('dialog');dialog.className='topup-dialog';dialog.setAttribute('aria-labelledby','topup-title');
  dialog.innerHTML=`<div class="topup-heading"><span><b>✦</b> rippr</span><button type="button" class="topup-close" aria-label="Close top up">×</button></div><h2 id="topup-title">Top up your balance</h2><p class="topup-muted">Choose an amount to add.</p><div class="topup-balance"><span>Current balance</span><strong>$0.00</strong></div><div class="topup-presets" role="group" aria-label="Choose amount">${[5,10,25,50,100,250].map(n=>`<button type="button" data-amount="${n}" aria-pressed="${n===25}">$${n}</button>`).join('')}</div><form novalidate><label for="topup-amount">Custom amount</label><div class="topup-input"><span>$</span><input id="topup-amount" inputmode="decimal" type="text" value="25.00" aria-describedby="topup-error"><span>USD</span></div><p id="topup-error" class="topup-error" role="alert" hidden></p><label>Payment method</label><div class="topup-method"><span aria-hidden="true">▤</span> Credit or debit card <span class="topup-chevron" aria-hidden="true">›</span></div><div class="topup-total"><span>You add</span><strong id="topup-total">$25.00</strong></div><button class="topup-continue" type="submit">Continue to payment <span aria-hidden="true">→</span></button><p class="topup-review">Review the total before paying.</p><p class="topup-notice" role="status" tabindex="-1">DESIGN PREVIEW · NO PAYMENT PROCESSED</p></form>`;
  document.body.append(dialog);
  const input=dialog.querySelector('input'),error=dialog.querySelector('#topup-error'),notice=dialog.querySelector('.topup-notice');
  function amount(){const v=input.value.trim();return /^\d+(\.\d{1,2})?$/.test(v)?Math.round(Number(v)*100):NaN}
  function update(){const cents=amount(),valid=Number.isSafeInteger(cents)&&cents>=100&&cents<=100000;dialog.querySelector('#topup-total').textContent=valid?'$'+(cents/100).toFixed(2):'—';dialog.querySelectorAll('[data-amount]').forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.amount)*100===cents)));error.hidden=true;input.removeAttribute('aria-invalid');return valid}
  dialog.querySelectorAll('[data-amount]').forEach(b=>b.addEventListener('click',()=>{input.value=Number(b.dataset.amount).toFixed(2);update()}));input.addEventListener('input',update);
  trigger.addEventListener('click',()=>{notice.textContent='DESIGN PREVIEW · NO PAYMENT PROCESSED';update();dialog.showModal();document.dispatchEvent(new CustomEvent('rippr:navigationchange',{detail:{dialogOpen:true}}))});
  dialog.querySelector('.topup-close').addEventListener('click',()=>dialog.close());dialog.addEventListener('close',()=>{trigger.focus({preventScroll:true});document.dispatchEvent(new CustomEvent('rippr:navigationchange',{detail:{dialogOpen:false}}))});
  dialog.addEventListener('click',e=>{if(e.target!==dialog)return;const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close()});
  dialog.querySelector('form').addEventListener('submit',e=>{e.preventDefault();if(!update()){error.textContent='Enter an amount from $1 to $1,000 with up to two decimal places.';error.hidden=false;input.setAttribute('aria-invalid','true');input.focus();return}notice.textContent='Payments are not connected yet. No charge was made and no funds were added.';notice.focus()});
})();
