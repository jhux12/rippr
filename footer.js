(() => {
  'use strict';
  const footer=document.querySelector('.rippr-footer');
  if(!footer)return;
  const config=window.RIPPR_FOOTER_CONFIG||{};
  const dialog=footer.querySelector('#footer-info-dialog'),title=footer.querySelector('#footer-info-title'),copy=footer.querySelector('#footer-info-copy');
  let trigger;
  const safeURL=(value,hosts)=>{try{const url=new URL(value);return url.protocol==='https:'&&!url.username&&!url.password&&hosts.includes(url.hostname)?url.href:null}catch{return null}};
  const email=typeof config.supportEmail==='string'&&/^[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9](?:[A-Z0-9.-]*[A-Z0-9])?\.[A-Z]{2,}$/i.test(config.supportEmail)?config.supportEmail:null;
  const destinations={discord:safeURL(config.discordUrl,['discord.gg','discord.com','www.discord.com']),instagram:safeURL(config.instagramUrl,['instagram.com','www.instagram.com'])};
  for(const [service,url]of Object.entries(destinations)){
    if(!url)continue;
    const button=footer.querySelector(`[data-footer-social="${service}"]`),link=document.createElement('a');
    link.className=button.className;link.href=url;link.target='_blank';link.rel='noopener noreferrer';link.setAttribute('aria-label',service==='discord'?'rippr on Discord (opens in a new tab)':'rippr on Instagram (opens in a new tab)');link.title=service==='discord'?'Discord':'Instagram';
    link.append(...button.childNodes);button.replaceWith(link);
  }

  const pages={
    help:{title:'Help center',html:'<h3>How do I open a pack?</h3><p>Add free test credit using the balance in the header, choose a pack, then rip the foil to reveal your card.</p><h3>Where are my winnings?</h3><p>Your cards are saved in My items. Pack rewards appear under Unopened packs and can be opened without another balance charge.</p><h3>How do daily rewards work?</h3><p>The Rewards page shows the available prizes, odds and when you can claim your next case.</p><a href="profile.html">View my items ↗</a>'},
    shipping:{title:'Shipping',html:'<p>Shipping is currently being tested. Requests are saved to your account; no physical items are dispatched and no shipping charges are collected.</p><p>You can view your requests in My items under Shipping.</p><a href="profile.html">View my items ↗</a>'},
    contact:{title:'Contact',html:'<p>Support contact details are coming soon.</p><p>For guidance on packs, rewards and your collection, visit the Help center.</p><button type="button" data-footer-dialog="help">Open Help center →</button>'},
    terms:{title:'Terms',html:'<p>Review the draft terms at terms.html before launch.</p><p>Current credit, rewards and items are for testing and have no cash value. No real payments or physical shipments are processed.</p>'},
    privacy:{title:'Privacy',html:'<p>Sign-in is handled by Firebase Authentication. rippr saves your display name, profile photo, delivery address, communication preferences, test balance, items and shipping requests to your account. Profile photos are publicly accessible; delivery details are private to your account.</p><p>Support messages, contact email and optional screenshots are saved privately for the sender and rippr support. The draft privacy policy is available at privacy.html.</p>'}
  };
  const announce=()=>document.dispatchEvent(new CustomEvent('rippr:navigationchange',{detail:{menuOpen:!document.querySelector('#mobile-navigation')?.hidden,dialogOpen:dialog.open||Boolean(document.querySelector('.topup-dialog')?.open)||Boolean(document.querySelector('#nav-dialog')?.open)}}));
  footer.addEventListener('click',event=>{
    const button=event.target.closest('[data-footer-dialog]');if(!button)return;
    const routes={help:'help-center.html',contact:'contact-support.html',shipping:'shipping.html',terms:'terms.html',privacy:'privacy.html'};if(routes[button.dataset.footerDialog]){location.href=routes[button.dataset.footerDialog];return}
    const page=pages[button.dataset.footerDialog];if(!page)return;
    if(!dialog.open)trigger=button;
    title.textContent=page.title;copy.innerHTML=page.html;
    if(!dialog.open)dialog.showModal();else footer.querySelector('.footer-dialog-close').focus();
    announce();
  });
  footer.querySelector('.footer-dialog-close').addEventListener('click',()=>dialog.close());
  dialog.addEventListener('close',()=>{if(trigger?.isConnected)trigger.focus({preventScroll:true});announce()});
  dialog.addEventListener('click',event=>{if(event.target!==dialog)return;const box=dialog.getBoundingClientRect();if(event.clientX<box.left||event.clientX>box.right||event.clientY<box.top||event.clientY>box.bottom)dialog.close()});
  footer.querySelector('[data-footer-top]').addEventListener('click',event=>{event.preventDefault();window.scrollTo({top:0,behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'auto':'smooth'});document.querySelector('.site-navigation .nav-brand')?.focus({preventScroll:true})});
})();
