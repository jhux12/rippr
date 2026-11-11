(() => {
  'use strict';
const conditionBadge=card=>`<span class="condition-badge">${window.RipprCatalog.conditionLabel(card)}</span>`;
  const $=s=>document.querySelector(s), account=()=>window.RIPPR_ACCOUNT;
  const money=cents=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(cents/100);
  const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const truck='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 5h12v12H2ZM14 9h4l4 5v3h-8"/><circle cx="6" cy="18" r="2"/><circle cx="18" cy="18" r="2"/></svg>';
  const selected=new Set(); let filter='available',pending=null,busy=false;
  const color=rarity=>window.RipprCatalog.RARITIES.find(r=>r.name===rarity)?.color||'#adbdcf';
  const itemImage=item=>window.RIPPR_ASSET_URLS?.[item.image]||item.image;
  const itemState=item=>window.RipprSettings.profileItemState(item,account()?.shipments||[]);
  const available=()=>account().items.filter(item=>selected.has(item.id)&&itemState(item).canManage);
  const visibleItems=()=>account().items.filter(item=>itemState(item).filter===filter&&item.name.toLowerCase().includes($('#item-search').value.trim().toLowerCase()));
  function status(message){$('#profile-status').textContent=message;$('#profile-status').hidden=false}
  function updateSelection(){
    const items=available(),sum=items.reduce((a,b)=>a+b.valueCents,0);
    $('#bulk-actions').hidden=!items.length;
    $('#selected-count').textContent=`${items.length} selected`;
    $('#bulk-sell').textContent=`Sell ${money(sum)}`;
    $('#bulk-ship').innerHTML=truck+'Ship<span class="bulk-ship-label"> selected</span>';
    $('#select-items').setAttribute('aria-label',selected.size?'Clear selected items':'Select available items');
    $('#items-grid').querySelectorAll('.item-card').forEach(el=>{const checked=selected.has(el.dataset.id);el.classList.toggle('is-selected',checked);const checkbox=el.querySelector('input');if(checkbox)checkbox.checked=checked});
  }
  const renderedItems=new Map();
  function reconcileItems(markup){
    const root=$('#items-grid'),template=document.createElement('template');template.innerHTML=markup;
    const existing=new Map([...root.querySelectorAll('.item-card')].map(node=>[node.dataset.id,node]));
    const keep=new Set();let index=0;
    for(const fresh of [...template.content.children]){
      const id=fresh.dataset.id,old=existing.get(id),signature=fresh.outerHTML;
      const node=id&&old&&renderedItems.get(id)===signature?old:fresh;
      if(id){keep.add(id);renderedItems.set(id,signature)}
      const focused=old?.contains(document.activeElement)?document.activeElement:null;
      const control=focused&&['data-select','data-sell','data-ship'].find(attr=>focused.hasAttribute(attr));
      if(old&&node!==old)old.replaceWith(node);
      if(root.children[index]!==node)root.insertBefore(node,root.children[index]||null);
      if(control&&node!==old)node.querySelector('['+control+']')?.focus({preventScroll:true});
      index++;
    }
    while(root.children.length>index)root.lastElementChild.remove();
    for(const id of renderedItems.keys())if(!keep.has(id))renderedItems.delete(id);
  }
  function pageControls(collection,buttonId,statusId){
    const a=account(),button=$('#'+buttonId),message=$('#'+statusId),more=Boolean(a.pageInfo?.[collection]?.hasMore||(collection==='items'&&a.hasMore));
    button.hidden=!more;button.disabled=Boolean(a.inventoryLoading?.[collection]);button.textContent=button.disabled?'Loading…':collection==='packs'?'Load more packs':'Load more cards';
    message.textContent=a.inventoryErrors?.[collection]||'';message.hidden=!message.textContent;
    return more;
  }
  for(const [collection,buttonId,statusId] of [['items','load-more-items','item-page-status'],['packs','load-more-packs','pack-page-status']])$('#'+buttonId).addEventListener('click',async()=>{
    const actor=account()?.user?.uid;try{await window.RipprAccount.loadMore(collection)}catch(error){if(actor===account()?.user?.uid){$('#'+statusId).textContent=window.RipprAccount.errorMessage(error);$('#'+statusId).hidden=false}}
  });
  function renderItems(){
    const items=visibleItems();
    $('#item-count').textContent=`${items.length} ${filter} item${items.length===1?'':'s'}`;
    $('#select-items').hidden=filter!=='available'||!items.length;
    reconcileItems(items.length?items.map(item=>`<article class="item-card" data-id="${escape(item.id)}">${itemState(item).canManage?`<label class="item-check"><input type="checkbox" data-select="${escape(item.id)}" aria-label="Select ${escape(item.name)}"></label>`:''}<div class="item-art"><span class="item-art-note" hidden>Artwork unavailable</span><img src="${escape(itemImage(item))}" alt="${escape(item.name)}" loading="lazy"></div><h3 title="${escape(item.name)}">${escape(item.name)}</h3><span class="item-rarity" style="--rarity:${color(item.rarity)}">${escape(item.rarity)}</span>${conditionBadge(item)}<p class="item-value">${money(item.valueCents)}</p>${itemState(item).canManage?`<div class="item-actions"><button class="button" data-ship="${escape(item.id)}" aria-label="Ship ${escape(item.name)}">${truck}Ship</button><button class="button primary" data-sell="${escape(item.id)}" aria-label="Sell ${escape(item.name)} for ${money(item.valueCents)}">Sell ${money(item.valueCents)}</button></div>`:`<p class="item-state">${item.status==='sold'?'Sold · '+money(item.valueCents):escape(itemState(item).label)}</p>${item.shipmentId?`<a class="button" href="order-tracking.html?request=${encodeURIComponent(item.shipmentId)}">Track request</a>`:''}`}</article>`).join(''):`<div class="empty-items brand-state"><img src="${window.RIPPR_MASCOT_URLS?.hover||'assets/hero/pip-hover.webp'}" alt="" width="96" height="96"><h3>${$('#item-search').value?'No matching items':filter==='available'?'Your next great pull awaits.':filter==='sold'?'No sold items yet.':'No shipping requests yet.'}</h3>${$('#item-search').value?'<p>Try a different card name.</p><button type="button" class="button" data-clear-search>Clear search</button>':filter==='available'?'<p>Open a pack to start your collection.</p><a class="button primary" href="index.html#packs">Explore packs</a>':''}</div>`);
    $('#items-grid').querySelectorAll('img').forEach(img=>{if(img.dataset.fallbackBound)return;img.dataset.fallbackBound='true';img.addEventListener('error',()=>{if(!img.dataset.fallback){img.dataset.fallback='true';const frame=img.closest('.item-art');if(frame){img.hidden=true;frame.classList.add('is-missing');frame.querySelector('.item-art-note').hidden=false}else img.src='assets/card-placeholder.svg'}},{once:true})});
    $('#items-grid').querySelectorAll('h3').forEach(name=>{if(name.scrollHeight>name.clientHeight)name.tabIndex=0;else name.removeAttribute('tabindex')});
    $('#more-items').hidden=!pageControls('items','load-more-items','item-page-status');updateSelection();
  }
  function render(){
    const a=account(),user=a?.user;
    $('#profile-content').hidden=!user||!a.wallet;
    $('#profile-gate').hidden=Boolean(user&&a.wallet);
    $('#gate-login').hidden=!a?.ready||Boolean(user);
    $('#retry-account').hidden=!user||!a.accountError;
    $('#gate-message').textContent=!a?.ready?'Loading your account…':!user?'Log in to view your items and balance.':a.accountError||'Loading your items…';
    if(!user||!a.wallet)return;
    if(a.accountError)status(a.accountError);
    $('#profile-name').textContent=a.wallet.displayName;
    const photo=a.wallet.photoURL||user.photoURL;document.querySelector('.profile-avatar').src=window.RipprCatalog.safeImageURL(photo)?photo:'assets/mascot/pip-welcome.png';
    $('#profile-verified').hidden=!(user.phoneNumber||user.emailVerified);
    $('#stat-packs').textContent=a.wallet.packsOpened;
    $('#stat-cards').textContent=a.wallet.cardsCollected;
    $('#stat-grails').textContent=a.wallet.grailsFound;
    $('#settings-email').textContent=user.phoneNumber||user.email||'';
    for(const id of selected){if(!a.items.some(item=>item.id===id&&item.status==='available'))selected.delete(id)}
    const packs=(a.packs||[]).filter(pack=>pack.status==='available');
    $('#unopened-packs').hidden=!packs.length&&!a.pageInfo?.packs?.hasMore;pageControls('packs','load-more-packs','pack-page-status');
    $('#inventory-packs-grid').innerHTML=packs.map(pack=>`<article class="inventory-pack"><img src="${escape(pack.packId==='icy-rush'?'assets/seasonal/pack-icy-rush.png':pack.image)}" alt="${escape(pack.name)}" loading="lazy"><div><h3>${escape(pack.name)}</h3><p>Daily reward</p><a class="button primary" href="opening.html?pack=${encodeURIComponent(pack.packId)}&inventory=${encodeURIComponent(pack.id)}">Open pack ↗</a></div></article>`).join('');
    renderItems();
    $('#activity-list').innerHTML=a.activity.length?a.activity.map(event=>`<div class="activity-row"><div><p>${escape(event.label)}</p><time>${escape(event.createdAt?new Date(event.createdAt).toLocaleString([],{dateStyle:'medium',timeStyle:'short'}):'Just now')}</time></div><strong>${event.amountCents?`${event.amountCents>0?'+':'−'}${money(Math.abs(event.amountCents))}`:'—'}</strong></div>`).join(''):'<div class="brand-state brand-state--quiet"><img src="assets/hero/pip-hover.webp" alt="" width="58" height="58"><h3>Your collection has a story.</h3><p>Your openings and item activity will appear here.</p></div>';
  }
  $('#retry-account').addEventListener('click',()=>window.RipprAccount.refresh());
  document.addEventListener('rippr:authchange',()=>{selected.clear();for(const dialog of document.querySelectorAll('.profile-dialog[open]'))dialog.close();render()});
  document.addEventListener('rippr:walletchange',render);render();
  const tabs=[...document.querySelectorAll('.profile-tabs [role="tab"]')];
  function selectTab(tab){tabs.forEach(el=>{const active=el===tab;el.setAttribute('aria-selected',String(active));el.tabIndex=active?0:-1;$('#'+el.getAttribute('aria-controls')).hidden=!active})}
  tabs.forEach((tab,i)=>{tab.addEventListener('click',()=>selectTab(tab));tab.addEventListener('keydown',e=>{let next;if(e.key==='ArrowRight')next=(i+1)%tabs.length;if(e.key==='ArrowLeft')next=(i+tabs.length-1)%tabs.length;if(e.key==='Home')next=0;if(e.key==='End')next=tabs.length-1;if(next!==undefined){e.preventDefault();selectTab(tabs[next]);tabs[next].focus()}})});
  document.querySelectorAll('[data-filter]').forEach(button=>button.addEventListener('click',()=>{filter=button.dataset.filter;selected.clear();document.querySelectorAll('[data-filter]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));renderItems()}));
  $('#item-search').addEventListener('input',renderItems);
  $('#toggle-item-search').addEventListener('click',()=>{const open=$('#toggle-item-search').getAttribute('aria-expanded')!=='true';$('#toggle-item-search').setAttribute('aria-expanded',String(open));$('#collection-search').classList.toggle('is-open',open);if(open)$('#item-search').focus();else{$('#item-search').value='';renderItems()}});
  $('#select-items').addEventListener('click',()=>{if(selected.size)selected.clear();else visibleItems().slice(0,50).forEach(item=>selected.add(item.id));updateSelection()});
  $('#items-grid').addEventListener('change',event=>{const id=event.target.dataset.select;if(!id)return;if(event.target.checked&&selected.size>=50){event.target.checked=false;status('Select up to 50 items at once.');return}if(event.target.checked)selected.add(id);else selected.delete(id);updateSelection()});
  function confirm(type,ids){
    if(busy)return;
    const items=account().items.filter(item=>ids.includes(item.id)&&item.status==='available');if(!items.length)return;
    if(type==='ship'){window.RipprShipping.open(items);return}
    pending={type,ids:items.map(item=>item.id)};
    const amount=money(items.reduce((a,b)=>a+b.valueCents,0));
    $('#item-dialog-title').textContent=type==='sell'?`Sell ${items.length===1?'item':items.length+' items'}?`:'Request test shipping?';
    $('#item-dialog-description').textContent=type==='sell'?`${amount} will be added to your test balance. Sold items leave your available collection. This cannot be undone.`:'This saves a test shipping request for your selected items. No physical shipment or shipping charge will be created.';
    $('#confirm-action').textContent=type==='sell'?`Sell for ${amount}`:'Request test shipping';
    $('#action-error').hidden=true;$('#item-dialog').showModal();
  }
  $('#items-grid').addEventListener('click',event=>{if(event.target.closest('[data-clear-search]')){$('#item-search').value='';renderItems();$('#item-search').focus();return}const button=event.target.closest('[data-sell],[data-ship]');if(button)confirm(button.dataset.sell?'sell':'ship',[button.dataset.sell||button.dataset.ship])});
  $('#bulk-sell').addEventListener('click',()=>confirm('sell',available().map(i=>i.id)));
  $('#bulk-ship').addEventListener('click',()=>confirm('ship',available().map(i=>i.id)));
  $('#confirm-action').addEventListener('click',async()=>{
    if(busy||!pending)return;busy=true;const target=pending;$('#confirm-action').disabled=true;
    try{const result=await window.RipprAccount.act(target.type,{itemIds:target.ids});selected.clear();renderItems();$('#item-dialog').close();status(target.type==='sell'?`${result.count} item${result.count===1?'':'s'} sold for ${money(result.soldCents)} in test credit.`:'Test shipping request saved.');$('#profile-status').focus({preventScroll:true})}
    catch(error){$('#action-error').textContent=window.RipprAccount.errorMessage(error);$('#action-error').hidden=false}
    finally{busy=false;$('#confirm-action').disabled=false}
  });
  document.querySelectorAll('.profile-dialog').forEach(dialog=>{
    dialog.querySelectorAll('[data-close]').forEach(button=>button.addEventListener('click',()=>{if(!busy)dialog.close()}));
    dialog.addEventListener('cancel',e=>{if(busy)e.preventDefault()});
  });
  $('#edit-profile').addEventListener('click',()=>{$('#edit-name').value=account().wallet.displayName;$('#edit-error').hidden=true;$('#edit-dialog').showModal()});
  $('#edit-form').addEventListener('submit',async event=>{
    event.preventDefault();if(busy)return;busy=true;const submit=event.target.querySelector('[type="submit"]');submit.disabled=true;
    try{await window.RipprAccount.act('profile',{displayName:$('#edit-name').value.trim(),handle:account().wallet.handle});$('#edit-dialog').close();status('Profile updated.')}
    catch(error){$('#edit-error').textContent=window.RipprAccount.errorMessage(error);$('#edit-error').hidden=false}
    finally{busy=false;submit.disabled=false}
  });
  $('#settings-topup').addEventListener('click',()=>document.querySelector('.topup-trigger').click());
  $('#profile-signout').addEventListener('click',async()=>{try{await window.RipprFirebase.signOut()}catch{status('Could not log out. Please try again.')}});
})();
