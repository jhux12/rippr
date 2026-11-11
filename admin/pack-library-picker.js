(() => {
  'use strict';
  const $=s=>document.querySelector(s),client=window.RipprFirebase,model=window.RipprLibrary,catalog=window.RipprCatalog;
  const dialog=$('#pack-library-dialog');if(!dialog||!client||!model)return;
  const money=new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}),cards=new Map(),selected=new Map();
  const escape=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const owner=()=>catalog.isAdminUser(client.currentUser());
  let ownerUid=null,target=null,cursor=null,complete=false,loading=false,adding=false,generation=0,visibleCount=30;
  let filters={},loadError='';
  const image=c=>catalog.safeImageURL(c.image)?(c.image.startsWith('assets/')?'/'+c.image:c.image):'/assets/card-placeholder.svg';
  function message(text='',error=false){$('#pack-library-status').textContent=error?'':text;$('#pack-library-error').textContent=error?text:'';$('#pack-library-error').hidden=!error}
  function controls(){
    const blocked=adding||!owner()||window.RipprPackAdmin?.busy;
    dialog.setAttribute('aria-busy',String(loading||adding));
    dialog.querySelectorAll('button,input,select').forEach(el=>{el.disabled=Boolean(blocked)});
    $('#pack-library-add').disabled=blocked||!selected.size||[...selected.values()].some(card=>!model.libraryCardReady(card));
    $('#pack-library-clear').disabled=blocked||!selected.size;
    $('#pack-library-selection').textContent=`${selected.size} selected · ${Math.max(0,100-(target?.items.length||0))} slots available`;
    dialog.querySelectorAll('[data-site-card]').forEach(el=>{const card=cards.get(el.dataset.siteCard);el.disabled=blocked||!card||(!model.libraryCardReady(card)&&!selected.has(card.id))||target?.items.some(i=>i.id===card.id)});
  }
  function results(){
    const excluded=$('#pack-library-hide-existing').checked?target.items.map(c=>c.id):[];
    const result=model.browseLibraryCards([...cards.values()],{...filters,excludeIds:excluded});
    return $('#pack-library-selected-only').checked?result.filter(c=>selected.has(c.id)):result;
  }
  function render(){
    if(!target)return;
    const matches=results(),existing=new Set(target.items.map(c=>c.id));
    $('#pack-library-grid').innerHTML=matches.slice(0,visibleCount).map(card=>{
      const used=existing.has(card.id),ready=model.libraryCardReady(card),time=model.libraryAddedTime(card);
      const reason=used?'Already in this pack':!ready?'Set a value and site rarity in Card library':'';
      const color=catalog.RARITIES.find(r=>r.name===card.rarity)?.color||'#a4b7c9';
      return `<label class="site-card-tile ${used||!ready?'is-unavailable':''}"><input type="checkbox" data-site-card="${escape(card.id)}" aria-label="Select ${escape(card.name)}" ${selected.has(card.id)?'checked':''} ${used||!ready?'disabled':''}><img src="${escape(image(card))}" alt="" loading="lazy" width="110" height="150"><strong>${escape(card.name)}</strong><small>${escape([card.setName,card.number&&'#'+card.number,card.finish].filter(Boolean).join(' · '))}</small><span class="site-card-meta"><span class="rarity-chip" style="--rarity:${color}">${escape(card.rarity||'Rarity not set')}</span><b>${card.valueCents===null?'Not priced':money.format(card.valueCents/100)}</b></span><small>${escape(catalog.conditionLabel(card))}</small><small>${time===null?'Added date unavailable':'Added '+new Date(time).toLocaleDateString()}</small>${reason?`<small class="site-card-reason">${escape(reason)}</small>`:''}</label>`;
    }).join('');
    $('#pack-library-empty').hidden=Boolean(matches.length)||loading;
    $('#pack-library-empty').textContent=cards.size?'No matching site cards. Try changing the filters.':'Your site library is empty. Import cards in Card library first.';
    $('#pack-library-more').hidden=matches.length<=visibleCount;
    $('#pack-library-count').textContent=`${matches.length} matches · ${cards.size} site cards loaded${loading?' · loading the rest of the library…':complete?' · library fully loaded':''}`;
    $('#pack-library-retry').hidden=!loadError;
    controls();
  }
  function applyFilters(){
    try{
      const min=$('#pack-library-min').value.trim(),max=$('#pack-library-max').value.trim();
      const next={search:$('#pack-library-search').value,rarity:$('#pack-library-rarity').value,condition:$('#pack-library-condition').value,sort:$('#pack-library-sort').value,minValueCents:min?catalog.decimalToUnits(min):null,maxValueCents:max?catalog.decimalToUnits(max):null};
      model.browseLibraryCards([],next);filters=next;visibleCount=30;message();render();
    }catch(error){message(error.message,true)}
  }
  async function load(){
    if(loading||complete||!owner()||!dialog.open)return;
    const ticket=generation,uid=client.currentUser().uid;loading=true;loadError='';render();
    const active=()=>ticket===generation&&owner()&&client.currentUser()?.uid===uid&&dialog.open;
    try{
      while(!complete){
        const previous=cursor,data=await client.loadLibraryPage({cursor,pageSize:200});if(!active())return;
        if(data.cursor&&JSON.stringify(data.cursor)===JSON.stringify(previous))throw new Error('Library pagination stalled. Retry loading the library.');
        for(const card of data.cards)cards.set(card.id,card);
        cursor=data.cursor;complete=!cursor;render();
      }
    }catch(error){if(active()){loadError=/permission-denied/.test(error.code||'')?'Library access was denied. Deploy the latest Firestore rules and check the owner sign-in.':error.message||'Could not load site cards.';message(loadError,true)}}
    finally{if(active()){loading=false;render()}}
  }
  function clearCache(keepSelection=false){generation++;cards.clear();if(!keepSelection)selected.clear();cursor=null;complete=false;loading=false;loadError=''}
  $('#browse-site-cards').addEventListener('click',()=>{
    if(!owner()||window.RipprPackAdmin?.busy)return;
    target=window.RipprPackAdmin.snapshot();if(!target?.ready)return;
    if(ownerUid!==client.currentUser().uid){clearCache();ownerUid=client.currentUser().uid}
    selected.clear();visibleCount=30;$('#pack-library-title').textContent=`Add site cards to ${target.name}`;message();
    $('#pack-library-advanced').open=!matchMedia('(max-width:760px)').matches;
    dialog.showModal();dialog.scrollTop=0;applyFilters();void load();
  });
  $('#pack-library-close').addEventListener('click',()=>dialog.close());
  dialog.addEventListener('cancel',event=>{if(adding)event.preventDefault()});
  dialog.addEventListener('close',()=>{generation++;loading=false;selected.clear();$('#pack-library-grid').replaceChildren();if(owner())$('#browse-site-cards').focus()});
  $('#pack-library-filters').addEventListener('submit',event=>{event.preventDefault();if(!adding&&owner())applyFilters()});
  $('#pack-library-filters').addEventListener('change',event=>{if(event.target.matches('select,input[type=checkbox]')&&!adding&&owner())applyFilters()});
  let searchTimer;
  $('#pack-library-search').addEventListener('input',()=>{clearTimeout(searchTimer);searchTimer=setTimeout(()=>{if(dialog.open&&!adding&&owner())applyFilters()},200)});
  $('#pack-library-reset').addEventListener('click',()=>{$('#pack-library-filters').reset();applyFilters()});
  $('#pack-library-more').addEventListener('click',()=>{visibleCount+=30;render()});
  $('#pack-library-retry').addEventListener('click',()=>{message();void load()});
  $('#pack-library-refresh').addEventListener('click',()=>{if(adding||!owner())return;clearCache(true);message();render();void load()});
  $('#pack-library-clear').addEventListener('click',()=>{selected.clear();render()});
  $('#pack-library-grid').addEventListener('change',event=>{
    const id=event.target.dataset.siteCard;if(!id||adding||!owner())return;
    if(!event.target.checked){selected.delete(id);controls();if($('#pack-library-selected-only').checked)render();return}
    const card=cards.get(id);if(!card||!model.libraryCardReady(card)||target.items.some(i=>i.id===id)){event.target.checked=false;return}
    if(event.target.checked){if(selected.size>=100-target.items.length){event.target.checked=false;message('This pack supports up to 100 cards. Select fewer cards or remove some from the pack draft.',true);return}selected.set(id,card)}else selected.delete(id);
    controls();if($('#pack-library-selected-only').checked)render();
  });
  $('#pack-library-add').addEventListener('click',async()=>{
    if(adding||!owner()||!selected.size)return;
    const ticket=generation,uid=client.currentUser().uid;adding=true;message();controls();
    const active=()=>ticket===generation&&owner()&&client.currentUser()?.uid===uid&&dialog.open;
    try{
      const saved=await client.lookupLibraryCards([...selected.keys()]);if(!active())return;
      if(saved.length!==selected.size)throw new Error('Some cards are no longer available. Reopen the picker and choose again.');
      if(saved.some(card=>card.version!==selected.get(card.id)?.version)){
        for(const card of saved){cards.set(card.id,card);selected.set(card.id,card)}
        $('#pack-library-filters').reset();$('#pack-library-selected-only').checked=true;applyFilters();if(matchMedia('(max-width:760px)').matches)$('#pack-library-advanced').open=false;dialog.scrollTop=0;message('Some selected cards changed in the library. Review their updated values and rarities, then add again.',true);return;
      }
      const result=await window.RipprPackAdmin.addCards(target.id,saved);if(!active())return;
      if(result)dialog.close();
    }catch(error){if(active())message(error.message||'Could not add cards to the draft. Your selection is still here.',true)}
    finally{adding=false;if(active())controls()}
  });
  document.addEventListener('rippr:librarysaved',()=>{clearCache();if(dialog.open){render();void load()}});
  document.addEventListener('rippr:adminbusy',controls);
  document.addEventListener('rippr:authchange',()=>{clearCache();adding=false;ownerUid=null;target=null;$('#pack-library-filters').reset();if(dialog.open)dialog.close();$('#pack-library-grid').replaceChildren();$('#pack-library-count').textContent='';message()});
  window.addEventListener('beforeunload',event=>{if(owner()&&selected.size){event.preventDefault();event.returnValue=''}});
  $('#pack-library-rarity').insertAdjacentHTML('beforeend',catalog.RARITIES.map(r=>`<option>${r.name}</option>`).join(''));
})();
