(() => {
  'use strict';
  const $ = selector => document.querySelector(selector), client = window.RipprFirebase;
  const model = window.RipprLibrary, catalog = window.RipprCatalog;
  if (!client || !model || !$('#library-view')) return;
  const provider = model.createTCGdex(), money = new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'});
  const escape = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const image = value => catalog.safeImageURL(value) ? (value.startsWith('assets/')?'/'+value:value) : '/assets/card-placeholder.svg';
  const owner = () => catalog.isAdminUser(client.currentUser());
  const selected = new Map(), providerSelected = new Map();
  let rows = [], cursor = null, loaded = false, busy = false, generation = 0, tab = 'saved';
  let pending = null, editing = null, results = [], page = 1, providerQuery = null, loadedSearch = '';
  const current = (ticket,uid) => ticket === generation && owner() && client.currentUser()?.uid === uid;
  function message(text = '', error = false) {
    const el = $(error?'#library-error':'#library-status'); el.textContent = text; el.hidden = !text;
  }
  function fail(error) {
    message(/permission-denied|unauthorized/.test(error?.code || '') ? 'Library access was denied. Deploy the updated Firestore rules and sign in with the owner account.' : (error.message || 'Could not load the card library. Try again.'),true);
  }
  function controls() {
    const blocked = busy || !owner() || window.RipprPackAdmin?.busy;
    $('#library-view').setAttribute('aria-busy',String(busy));
    $('#library-view').querySelectorAll('button,input,select').forEach(el=>{el.disabled=Boolean(blocked)});
    $('#library-commit').disabled = blocked || !pending?.changes.length || Boolean(pending?.errors.length);
    $('#library-provider-preview').disabled = blocked || !providerSelected.size;
    for (const id of ['library-export','library-clear','library-market-prices']) $('#'+id).disabled = blocked || !selected.size;
    $('#library-select-page').disabled = blocked || !rows.length;
    $('#library-edit-company').disabled = blocked || $('#library-edit-condition').value !== 'graded';
    $('#library-edit-grade').disabled = blocked || $('#library-edit-condition').value !== 'graded';
  }
  async function run(work) {
    if (!owner() || busy || window.RipprPackAdmin?.busy) return;
    const ticket = generation, uid = client.currentUser().uid;
    busy = true; message(); message('',true); controls();
    const active = () => current(ticket,uid);
    try { await work(active); } catch(error) { if (active()) fail(error); }
    finally { if (active()) { busy = false; controls(); } }
  }
  function cardDetails(card) {
    return [card.setName,card.number && '#'+card.number,card.finish,card.sourceRarity && 'Printed rarity: '+card.sourceRarity].filter(Boolean).join(' · ');
  }
  const providerIdentity = card => [card.setName,card.number && '#'+card.number,card.sourceRarity].filter(Boolean).join(' · ');
  function renderRows() {
    $('#library-rows').innerHTML = rows.map(c=>`<tr><td><input type="checkbox" data-library-select="${escape(c.id)}" aria-label="Select ${escape(c.name)}" ${selected.has(c.id)?'checked':''}></td><th scope="row"><div class="library-card-cell"><img src="${escape(image(c.image))}" alt="" loading="lazy" width="44" height="62"><span><strong>${escape(c.name)}</strong><small>${escape(cardDetails(c))}</small><small>${escape(c.id)}</small></span></div></th><td>${escape(c.rarity || 'Rarity not set')}<small>${escape(catalog.conditionLabel(c))}</small></td><td>${c.valueCents == null ? 'Not priced' : money.format(c.valueCents/100)}</td><td><button type="button" class="button secondary" data-library-edit="${escape(c.id)}">Edit</button></td></tr>`).join('');
    $('#library-empty').hidden = Boolean(rows.length); $('#library-more').hidden = !cursor;
    $('#library-selected-count').textContent = `${selected.size} selected`;
    controls();
  }
  async function load(active, more = false) {
    const search = more ? loadedSearch : $('#library-search').value.trim();
    const data = await client.loadLibraryPage({search,cursor:more?cursor:null});
    if (!active()) return;
    loadedSearch = search; rows = more ? [...new Map([...rows,...data.cards].map(c=>[c.id,c])).values()] : data.cards;
    cursor = data.cursor; loaded = true;
    for (const c of data.cards) if (selected.has(c.id)) selected.set(c.id,c);
    renderRows(); message(`${rows.length} cards loaded${cursor?' · more available':''}${search?' for “'+search+'”':''}.`);
  }
  function showTab(name) {
    tab = name;
    for (const id of ['saved','pokemon','csv']) $('#library-'+id+'-panel').hidden = id !== name;
    document.querySelectorAll('[data-library-tab]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.libraryTab===name)));
  }
  function priceRow(row) {
    const card=row.card, quote=row.quotes[0], chosen=row.quotes.find(q=>q.key===row.chosenKey), shown=chosen?{...card,finish:chosen.finish}:card, id=escape(card.id);
    const choices=quote?`<label class="library-price-choice" for="library-price-${id}">TCGplayer · USD</label><select id="library-price-${id}" class="library-price-select" data-market-choice="${id}"><option value="">${row.import?'Import without value':'Keep current value'}</option>${row.quotes.map(q=>`<option value="${escape(q.key)}" ${row.chosenKey===q.key?'selected':''}>${escape(q.finish)} · ${money.format(q.valueCents/100)}</option>`).join('')}</select><small>Feed updated ${escape(new Date(quote.updated).toLocaleString())}${quote.stale?' · over 7 days old':''}</small>`:'<small>No listed USD market price. Import stays unpriced.</small>';
    const rarity=row.import?`<label class="library-price-choice" for="import-rarity-${id}">Site rarity</label><select class="library-price-select" id="import-rarity-${id}" data-import-rarity="${id}"><option value="">Not set</option>${catalog.RARITIES.map(r=>`<option ${card.rarity===r.name?'selected':''}>${r.name}</option>`).join('')}</select>`:escape(card.rarity || 'Rarity not set');
    return `<tr><td>${row.import?'New':row.chosenKey?'Update':'Keep'}</td><th scope="row">${escape(card.name)}<small>${escape(cardDetails(shown))}</small><small>${id}</small></th><td>${rarity}<small>${escape(catalog.conditionLabel(card))}</small></td><td><small>Current: ${card.valueCents==null?'Not priced':money.format(card.valueCents/100)}</small>${choices}<small>Matched: ${escape(row.matchedName)} · ${escape(row.matched)}</small></td></tr>`;
  }
  function renderPreview() {
    $('#library-preview').hidden = !pending;
    $('#library-import-rarity-tools').hidden = !pending?.marketRows?.some(row=>row.import);
    $('#library-price-notice').hidden = !pending?.marketRows;
    $('#library-price-warnings').textContent = pending?.marketWarnings?.join('\n') || ''; $('#library-price-warnings').hidden = !pending?.marketWarnings?.length;
    if (!pending) { $('#library-preview-rows').replaceChildren(); $('#library-preview-summary').textContent=''; $('#library-preview-errors').textContent=''; $('#library-preview-errors').hidden=true; controls(); return; }
    $('#library-preview-summary').textContent = pending.marketRows ? `${pending.added} new cards · ${pending.updated} price ${pending.updated===1?'update':'updates'} selected · ${pending.skipped.length} skipped. Other saved values stay unchanged.` : `${pending.added} new · ${pending.updated} updates · ${pending.skipped.length} existing IDs skipped. ${pending.changes.filter(c=>!model.libraryCardReady(c)).length} cards still need a value or rarity before use in packs.`;
    $('#library-preview-rows').innerHTML = pending.marketRows ? pending.marketRows.map(priceRow).join('') : pending.changes.map(c=>`<tr><td>${c.version?'Update':'New'}</td><th scope="row">${escape(c.name)}<small>${escape(cardDetails(c))}</small><small>${escape(c.id)}</small></th><td>${escape(c.rarity || 'Rarity not set')}<small>${escape(catalog.conditionLabel(c))}</small></td><td>${c.valueCents == null ? 'Not priced' : money.format(c.valueCents/100)}</td></tr>`).join('');
    $('#library-preview-errors').textContent = pending.errors.join('\n'); $('#library-preview-errors').hidden = !pending.errors.length;
    controls();
  }
  async function mayReplacePreview() {
    return !pending || await window.RipprPackAdmin.confirm('Replace library preview?','The current unsaved preview will be discarded.','Replace preview');
  }
  async function preview(candidates, mode, active) {
    const ids = candidates.map(c=>c.id);
    if (ids.some(id=>!/^[a-zA-Z0-9_-]{1,64}$/.test(id || ''))) throw new Error('Every row needs a valid stable ID (letters, numbers, hyphens or underscores; up to 64 characters).');
    const existing = await client.lookupLibraryCards([...new Set(ids)]);
    if (!active()) return;
    pending = model.importPreview(candidates,existing,mode); renderPreview();
    $('#library-preview').scrollIntoView({behavior:'instant',block:'nearest'});
    message('Review the cards below, then save them to your library.');
  }
  function download(filename,body) {
    const url = URL.createObjectURL(new Blob(['\uFEFF'+body],{type:'text/csv;charset=utf-8'})), a = document.createElement('a');
    a.href = url; a.download = filename; a.click(); setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  async function searchProvider(active) {
    const found = await provider.search({...providerQuery,page});
    if (!active()) return;
    results = found;
    $('#library-provider-results').innerHTML = found.map(c=>`<label class="library-provider-card"><input type="checkbox" data-provider-select="${escape(c.id)}" ${providerSelected.has(c.id)?'checked':''}><img src="${escape(c.image || '/assets/card-placeholder.svg')}" alt="" loading="lazy"><strong>${escape(c.name)}</strong><small>${escape(c.id)}</small></label>`).join('') || '<p>No matching cards. Try another name or set.</p>';
    $('#library-provider-prev').hidden = page === 1; $('#library-provider-next').hidden = found.length < 24;
    message(`TCGdex page ${page} · ${providerSelected.size} selected. Import previews skip cards already in your library.`);
  }
  function edit(card) {
    editing = structuredClone(card);
    $('#library-edit-id').textContent = card.id;
    $('#library-edit-sourceId').value = card.source==='tcgdex' ? card.sourceId : '';
    for (const field of ['name','setName','number','finish','image','referenceURL']) $('#library-edit-'+field).value = card[field];
    $('#library-edit-value').value = card.valueCents == null ? '' : (card.valueCents/100).toFixed(2);
    $('#library-edit-rarity').value = card.rarity || '';
    $('#library-edit-condition').value = card.grading?'graded':'raw';
    $('#library-edit-company').value = card.grading?.company || 'PSA'; $('#library-edit-grade').value = card.grading?.grade || '';
    $('#library-edit-error').hidden = true; controls(); $('#library-editor').showModal();
  }
  // A library record represents one physical finish/grade; create distinct IDs by CSV.
  $('#library-editor-form').addEventListener('submit',event=>{
    event.preventDefault(); if (!editing || busy || !owner()) return;
    const card = {...editing};
    const sourceId = $('#library-edit-sourceId').value.trim();
    if(sourceId&&!/^[a-zA-Z0-9_-]{1,45}$/.test(sourceId)){$('#library-edit-error').textContent='Enter a valid TCGdex card ID, such as swsh7-215.';$('#library-edit-error').hidden=false;return}
    if(sourceId){if(card.sourceId!==sourceId)card.sourceRarity='';card.source='tcgdex';card.sourceId=sourceId}else if(card.source==='tcgdex'){card.source='manual';card.sourceId='';card.sourceRarity=''}
    for (const field of ['name','setName','number','finish','image','referenceURL']) card[field] = $('#library-edit-'+field).value.trim();
    card.rarity = $('#library-edit-rarity').value || null;
    card.valueCents = $('#library-edit-value').value.trim() ? catalog.decimalToUnits($('#library-edit-value').value) : null;
    if ($('#library-edit-condition').value === 'graded') card.grading = {company:$('#library-edit-company').value,grade:$('#library-edit-grade').value.trim()}; else delete card.grading;
    const issues = model.validateLibraryCard(card);
    if (issues.length) { $('#library-edit-error').textContent=issues[0]; $('#library-edit-error').hidden=false; return; }
    // Keep the editor's original revision: another session's change must conflict.
    pending = {changes:[{...model.cleanLibraryCard(card),version:editing.version}],errors:[],skipped:[],added:0,updated:1};
    editing = null; $('#library-editor').close(); renderPreview();
  });
  $('#library-editor-close').addEventListener('click',()=>{editing=null;$('#library-editor').close()});
  $('#library-editor').addEventListener('close',()=>{editing=null});
  $('#library-edit-condition').addEventListener('change',controls);
  $('#library-rows').addEventListener('click',async event=>{
    const button = event.target.closest('[data-library-edit]');
    if (!button || busy || !owner() || !await mayReplacePreview()) return;
    pending=null;renderPreview(); const card=rows.find(c=>c.id===button.dataset.libraryEdit); if(card)edit(card);
  });
  $('#library-rows').addEventListener('change',event=>{
    const id=event.target.dataset.librarySelect;if(!id||busy||!owner())return;
    if(event.target.checked){if(selected.size>=500){event.target.checked=false;message('Select up to 500 cards at a time.',true);return}selected.set(id,rows.find(c=>c.id===id))}else selected.delete(id);renderRows();
  });
  $('#library-select-page').addEventListener('click',()=>{for(const c of rows){if(selected.size>=500&&!selected.has(c.id)){message('Select up to 500 cards at a time.',true);break}selected.set(c.id,c)}renderRows()});
  $('#library-clear').addEventListener('click',()=>{selected.clear();renderRows()});
  function priceChanges() {
    pending.changes=pending.marketRows.flatMap(row=>{const quote=row.quotes.find(q=>q.key===row.chosenKey);return quote?[{...model.cleanLibraryCard(row.card),version:row.card.version,valueCents:quote.valueCents,finish:quote.finish}]:row.import?[{...model.cleanLibraryCard(row.card),version:0}]:[]});
    pending.added=pending.changes.filter(c=>!c.version).length;pending.updated=pending.changes.length-pending.added;
    pending.errors=pending.changes.flatMap(c=>model.validateLibraryCard(c));
  }
  $('#library-preview-rows').addEventListener('change',event=>{
    const importId=event.target.dataset.importRarity;
    if(importId&&!busy&&owner()&&pending?.marketRows){const row=pending.marketRows.find(r=>r.import&&r.card.id===importId);if(!row)return;row.card.rarity=event.target.value||null;priceChanges();renderPreview();$(`#import-rarity-${CSS.escape(importId)}`)?.focus();return}
    const id=event.target.dataset.marketChoice;if(!id||busy||!owner()||!pending?.marketRows)return;
    const row=pending.marketRows.find(r=>r.card.id===id);if(!row)return;
    row.chosenKey=event.target.value;priceChanges();renderPreview();
    $('#library-preview-rows').querySelector(`[data-market-choice="${CSS.escape(id)}"]`)?.focus();
  });
  $('#library-import-rarity-apply').addEventListener('click',()=>{
    if(busy||!owner()||!pending?.marketRows)return;
    const rarity=$('#library-import-rarity').value;if(!rarity){message('Choose a site rarity to apply to the new imports.',true);return}
    pending.marketRows.filter(row=>row.import).forEach(row=>{row.card.rarity=rarity});priceChanges();renderPreview();
  });
  $('#library-market-prices').addEventListener('click',()=>void run(async active=>{
    if(!selected.size||selected.size>50)throw new Error('Select between 1 and 50 cards to fetch market prices.');
    if(!await mayReplacePreview()||!active())return;
    const cards=await client.lookupLibraryCards([...selected.keys()]);if(!active())return;
    if(cards.length!==selected.size)throw new Error('Some selected cards could not be found. Refresh the library and try again.');
    const marketRows=[],skipped=[],marketWarnings=[];
    for(let i=0;i<cards.length;i+=4){
      const batch=await Promise.all(cards.slice(i,i+4).map(async card=>{
        if(card.grading)return{card,reason:'Graded slab: keep its separate slab value.'};
        if(card.source!=='tcgdex'||!card.sourceId)return{card,reason:'No TCGdex link. Edit this card and enter its exact TCGdex card ID, or import it through Import Pokémon.'};
        try{const detail=await provider.priceDetails(card.sourceId),quotes=detail.quotes;return quotes.length?{card,quotes,matched:providerIdentity(detail.card),matchedName:detail.card.name,chosenKey:model.matchingPriceQuote(card,quotes)?.key || ''}:{card,reason:'No valid TCGplayer USD market quote is available. Current value retained.'}}catch(error){return{card,reason:error.message}}
      }));
      if(!active())return;
      for(const row of batch){if(row.reason){skipped.push(row.card.id);marketWarnings.push(`${row.card.name}: ${row.reason}`)}else marketRows.push(row)}
    }
    pending={marketRows,marketWarnings,skipped,changes:[],errors:[],added:0,updated:0};priceChanges();renderPreview();
    message('Review the TCGplayer market references below. Choose the correct finish for unmatched cards, then save to the library.');
    $('#library-preview').scrollIntoView({behavior:'instant',block:'nearest'});
  }));
  $('#library-export').addEventListener('click',()=>download('rippr-card-values.csv',model.libraryCSV([...selected.values()])));
  $('#library-template').addEventListener('click',()=>download('rippr-library-template.csv',model.libraryCSV([{id:'your-stable-card-id',name:'Card name',setName:'Set name',number:'001',finish:'Standard',image:'https://example.com/card.webp',rarity:'Common',valueCents:100}])));
  $('#library-search-form').addEventListener('submit',event=>{event.preventDefault();void run(active=>load(active))});
  $('#library-more').addEventListener('click',()=>void run(active=>load(active,true)));
  document.querySelectorAll('[data-library-tab]').forEach(b=>b.addEventListener('click',()=>showTab(b.dataset.libraryTab)));
  $('#library-csv-preview').addEventListener('click',()=>void run(async active=>{
    if(!await mayReplacePreview()||!active())return;
    const file=$('#library-csv-file').files[0];if(!file||file.size>2*1024*1024)throw new Error('Choose a CSV file up to 2 MB.');
    const text=await file.text();if(!active())return;
    await preview(model.csvCandidates(text),$('#library-csv-mode').value,active);
  }));
  $('#library-provider-form').addEventListener('submit',event=>{event.preventDefault();void run(async active=>{
    providerQuery={name:$('#library-provider-name').value,setId:$('#library-provider-set').value};page=1;await searchProvider(active);
  })});
  for(const [id,delta]of [['prev',-1],['next',1]])$('#library-provider-'+id).addEventListener('click',()=>void run(async active=>{page+=delta;try{await searchProvider(active)}catch(error){page-=delta;throw error}}));
  $('#library-provider-results').addEventListener('change',event=>{
    const id=event.target.dataset.providerSelect;if(!id||busy||!owner())return;
    if(event.target.checked){if(providerSelected.size>=50){event.target.checked=false;message('Preview up to 50 Pokémon imports at a time.',true);return}providerSelected.set(id,results.find(c=>c.id===id))}else providerSelected.delete(id);
    message(`${providerSelected.size} TCGdex cards selected.`);controls();
  });
  $('#library-provider-preview').addEventListener('click',()=>void run(async active=>{
    if(!await mayReplacePreview()||!active())return;
    const ids=[...providerSelected.keys()],details=[];
    for(let i=0;i<ids.length;i+=4){details.push(...await Promise.all(ids.slice(i,i+4).map(id=>provider.priceDetails(id))));if(!active())return}
    const existing=await client.lookupLibraryCards(details.map(d=>d.card.id));if(!active())return;
    const known=new Set(existing.map(c=>c.id));
    const marketRows=details.filter(d=>!known.has(d.card.id)).map(detail=>({card:{...detail.card,version:0},quotes:detail.quotes,chosenKey:model.importPriceQuote(detail.quotes)?.key || '',matchedName:detail.card.name,matched:providerIdentity(detail.card),import:true}));
    pending={marketRows,marketWarnings:[],skipped:[...known],changes:[],errors:[],added:0,updated:0};priceChanges();renderPreview();
    message('Review imported cards and their listed TCGplayer market values. Choose a finish when multiple prices are available, then save.');
    $('#library-preview').scrollIntoView({behavior:'instant',block:'nearest'});
  }));
  $('#library-from-packs').addEventListener('click',()=>void run(async active=>{
    if(!await mayReplacePreview()||!active())return;
    const cards=window.RipprPackAdmin.cards().map(model.cleanLibraryCard),existing=[];
    for(let i=0;i<cards.length;i+=500){existing.push(...await client.lookupLibraryCards(cards.slice(i,i+500).map(c=>c.id)));if(!active())return}
    const known=new Set(existing.map(c=>c.id)),fresh=cards.filter(c=>!known.has(c.id));
    pending=fresh.length?model.importPreview(fresh.slice(0,500),[],'skip'):{changes:[],skipped:[],errors:[],added:0,updated:0};
    pending.skipped=[...known];renderPreview();
    message(fresh.length>500?'Review the first 500 new cards. Save, then copy pack cards again for the remaining cards.':'Review the copied pack cards below. Existing library IDs were skipped.');
  }));
  $('#library-bulk-form').addEventListener('submit',event=>{event.preventDefault();void run(async active=>{
    if(!selected.size)throw new Error('Select cards first.');if(!await mayReplacePreview()||!active())return;
    const rarity=$('#library-bulk-rarity').value,value=$('#library-bulk-value').value.trim();
    if(!rarity&&!value)throw new Error('Choose a rarity or enter a value for the selected cards.');
    // Use selected revisions so bulk edits never silently replace concurrent changes.
    const changes=[...selected.values()].map(c=>({...c,...(rarity?{rarity}:{}),...(value?{valueCents:catalog.decimalToUnits(value)}:{})}));
    pending={changes,skipped:[],errors:changes.flatMap(c=>model.validateLibraryCard(c).map(e=>`${c.name}: ${e}`)),added:0,updated:changes.length};renderPreview();
  })});
  $('#library-cancel-preview').addEventListener('click',()=>{pending=null;renderPreview();message('Preview discarded. No saved cards changed.')});
  $('#library-commit').addEventListener('click',()=>void run(async active=>{
    if(!pending?.changes.length||pending.errors.length)return;
    let savedCount=0;
    // Each batch is atomic. After a failure the preview retains only unsaved rows.
    while(pending.changes.length){
      const chunk=pending.changes.slice(0,50),saved=await client.saveLibraryCards(chunk);if(!active())return;
      pending.changes.splice(0,chunk.length);savedCount+=saved.length;
      if(pending.marketRows){const ids=new Set(chunk.map(c=>c.id));pending.marketRows=pending.marketRows.filter(row=>!ids.has(row.card.id))}
      for(const c of saved){if(selected.has(c.id))selected.set(c.id,c);const at=rows.findIndex(r=>r.id===c.id);if(at>=0)rows[at]=c}
      document.dispatchEvent(new CustomEvent('rippr:librarysaved',{detail:{ids:saved.map(c=>c.id)}}));
      pending.added=pending.changes.filter(c=>!c.version).length;pending.updated=pending.changes.length-pending.added;
      renderPreview();renderRows();message(`${savedCount} saved. ${pending.changes.length} remaining.`);
    }
    pending=null;providerSelected.clear();renderPreview();await load(active);if(active())message(`${savedCount} ${savedCount===1?'card':'cards'} saved to the library. Pack contents and odds are unchanged.`);
  }));
  function reset() {
    generation++;busy=false;loaded=false;rows=[];cursor=null;pending=null;editing=null;results=[];providerQuery=null;page=1;
    selected.clear();providerSelected.clear();$('#library-csv-file').value='';$('#library-editor-form').reset();$('#library-search').value='';$('#library-provider-name').value='';$('#library-provider-set').value='';$('#library-provider-results').replaceChildren();$('#library-provider-prev').hidden=true;$('#library-provider-next').hidden=true;
    if($('#library-editor').open)$('#library-editor').close();message();message('',true);renderRows();renderPreview();
  }
  document.addEventListener('rippr:adminview',event=>{if(event.detail.name==='library'&&!loaded)void run(active=>load(active))});
  document.addEventListener('rippr:adminbusy',()=>{controls();if(!$('#library-view').hidden&&!loaded&&!window.RipprPackAdmin?.busy)void run(active=>load(active))});
  document.addEventListener('rippr:authchange',()=>{reset();if(owner()&&!$('#library-view').hidden)void run(active=>load(active))});
  window.addEventListener('beforeunload',event=>{if(owner()&&(pending||editing)){event.preventDefault();event.returnValue=''}});
  window.RipprLibraryAdmin={get dirty(){return Boolean(pending||editing)},get busy(){return busy}};
  for(const id of ['library-bulk-rarity','library-edit-rarity'])$('#'+id).insertAdjacentHTML('beforeend',catalog.RARITIES.map(r=>`<option>${r.name}</option>`).join(''));
  $('#library-import-rarity').insertAdjacentHTML('beforeend',catalog.RARITIES.map(r=>`<option>${r.name}</option>`).join(''));
  $('#library-edit-company').innerHTML=catalog.GRADING_COMPANIES.map(c=>`<option>${c}</option>`).join('');
  renderRows();renderPreview();
})();
