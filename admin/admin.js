(() => {
  'use strict';
  const $ = selector => document.querySelector(selector);
  const client = window.RipprFirebase, model = window.RipprCatalog, odds = window.RipprOdds;
  const tiers = window.RIPPR_PACKS;
  const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
  const percent = value => (value / 100).toLocaleString('en-US', { maximumFractionDigits: 2 });
  const escape = value => String(value).replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));
  const imageURL = value => model.safeImageURL(value) ? (value.startsWith('assets/') ? '/' + value : value) : '/assets/card-placeholder.svg';
  const packs = new Map(tiers.map(tier => [tier.id, model.defaultPack(tier.id)]));
  const loaded = new Set(), dirty = new Set();
  const priceInputs = new Map();
  let rowsVisible=50,rowsQuery='',rowsPack=null;
  let oddsPreview = null, oddsUndo = null;
  let selectedPack = 'basic', selectedItem = 'first-light', currentImage, editorDirty = false;
  let newItem = false, busy = false, ownerUid = null, generation = 0, statusTimer;
  const mobile = matchMedia('(max-width:760px)');
  const pack = () => packs.get(selectedPack);
  const owner = () => model.isAdminUser(client?.currentUser());

  function status(message, error = false) {
    clearTimeout(statusTimer);
    $('#admin-status').textContent = message;
    $('#admin-status').classList.toggle('is-error', error);
    $('#admin-status').hidden = !message;
    if (!error) statusTimer = setTimeout(() => { $('#admin-status').hidden = true; }, 6000);
  }
  function errorText(error) {
    if (error?.code === 'catalog/conflict') return 'This pack changed in another session. Reload the saved contents before saving again.';
    if (error?.code === 'catalog/invalid-data' || error?.code === 'catalog/invalid-image') return error.message;
    if (/permission-denied|unauthorized/.test(error?.code || '')) return 'Access was denied. Check your verified owner sign-in and Firebase access rules.';
    return 'Could not connect to Firebase. Your edits are still here. Check the connection and setup guide, then retry.';
  }
  function setBusy(value) {
    busy = value;
    $('#workspace').setAttribute('aria-busy', String(value));
    $('#workspace').querySelectorAll('button,input,select').forEach(control => { control.disabled = value; });gradingControls();
    refreshSave();
    document.dispatchEvent(new CustomEvent('rippr:adminbusy',{detail:{busy:value}}));
  }
  function refreshSave() {
    $('#save-pack').disabled = busy || !loaded.has(selectedPack) || (!dirty.has(selectedPack) && !editorDirty && pack().version > 0);
    $('#save-pack').textContent = busy ? 'Working…' : 'Save changes';
    $('#dirty-indicator').hidden = !dirty.size && !editorDirty;
    $('#generate-odds').disabled = busy || !loaded.has(selectedPack);
    $('#apply-odds').disabled = busy || !oddsPreview;
    $('#undo-odds').disabled = busy || !oddsUndo;
  }
  function clearOddsPreview() { oddsPreview = null; $('#odds-preview').hidden = true; $('#odds-error').hidden = true; }
  function markDirty() { clearOddsPreview(); oddsUndo = null; $('#undo-odds').hidden = true; dirty.add(selectedPack); renderTiers(); refreshSave(); }
  function changedEditor(event) { if (event?.target?.id === 'image-file') return; clearOddsPreview(); editorDirty = true; refreshSave(); }
  function effectivePrice() {
    const raw = $('#pack-price').value.trim();
    const price = raw ? model.decimalToUnits(raw) : model.DEFAULT_PRICES[selectedPack];
    return model.validPackPrice(price) ? price : null;
  }
  function renderEV() {
    const ev = odds.expectedValue(pack().items), price = effectivePrice();
    $('#current-pack-ev').textContent = ev == null ? 'EV —' : `EV ${money.format(ev / 100)}${price > 0 ? ` · ${(ev / price * 100).toFixed(2)}%` : ''}`;
  }
  function oddsFingerprint() { return JSON.stringify([selectedPack, pack().items, $('#pack-price').value]); }
  function oddsError(message) { $('#odds-error').textContent = message; $('#odds-error').hidden = false; }
  function setSidebar(open) {
    const visible = open && mobile.matches && owner();
    document.body.classList.toggle('sidebar-open', visible);
    $('#sidebar-toggle').setAttribute('aria-expanded', String(visible));
    $('#sidebar-toggle').setAttribute('aria-label', visible ? 'Close admin navigation' : 'Open admin navigation');
    $('#sidebar-backdrop').hidden = !visible;
  }
  function view(name, focus = false) {
    if (!owner()) return;
    for (const id of ['packs', 'library', 'members', 'settings', 'rewards', 'shipping', 'support', 'referrals', 'payments', 'closures']) $(`#${id}-view`).hidden = id !== name;
    document.querySelectorAll('[data-view]').forEach(button => {
      if (button.dataset.view === name) button.setAttribute('aria-current', 'page'); else button.removeAttribute('aria-current');
    });
    $('#page-title').textContent = { packs:'Packs', library:'Card library', members:'Members', settings:'Settings', rewards:'Spark rewards',shipping:'Shipping requests',support:'Support inbox',referrals:'Referrals',payments:'Payment reviews',closures:'Account closures' }[name];
    document.title = `${$('#page-title').textContent} — rippr Admin`;
    document.dispatchEvent(new CustomEvent('rippr:adminview',{detail:{name}}));
    setSidebar(false);
    if (focus) $('#workspace').focus({ preventScroll:true });
  }
  function renderTiers() {
    $('#tier-grid').innerHTML = tiers.map(tier => `<button type="button" class="tier-tile" data-pack="${tier.id}" aria-pressed="${tier.id === selectedPack}" ${busy ? 'disabled' : ''}><img src="/${tier.image}" alt="" width="70" height="135"><span class="tier-tile-copy"><strong>${tier.name}</strong>${packs.get(tier.id).priceCents == null ? '' : `<span class="tier-tile-price">${money.format(packs.get(tier.id).priceCents / 100)}</span>`}</span>${dirty.has(tier.id) ? '<span class="tier-dirty" aria-label="Unsaved changes"></span>' : ''}</button>`).join('');
  }
  function renderRows() {
    const query = $('#card-search').value.trim().toLowerCase();
    const visible = pack().items.filter(item => item.name.toLowerCase().includes(query));
    if(query!==rowsQuery||selectedPack!==rowsPack){rowsVisible=50;rowsQuery=query;rowsPack=selectedPack}
    $('#item-rows').innerHTML = visible.slice(0,rowsVisible).map(item => {
      const tone = model.RARITIES.find(rarity => rarity.name === item.rarity)?.color || '#adbdcf';
      return `<tr data-item="${escape(item.id)}" class="${item.id === selectedItem && !newItem ? 'is-selected' : ''}"><td><div class="card-cell"><img src="${escape(imageURL(item.image))}" alt="" width="47" height="58" loading="lazy"><span>${escape(item.name)}</span></div></td><td><span class="rarity-chip" style="--rarity:${tone}">${escape(item.rarity)}</span></td><td>${money.format(item.valueCents / 100)}</td><td>${percent(item.chanceBps)}%</td><td><button type="button" class="icon-button" aria-label="Edit ${escape(item.name)}" ${busy ? 'disabled' : ''}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14 4 6 6M4 15l12-12a2 2 0 0 1 3 0l2 2a2 2 0 0 1 0 3L9 20l-6 1 1-6Z"/></svg></button></td></tr>`;
    }).join('');
    $('#no-items').hidden = visible.length > 0;
    $('#pack-items-count').textContent=`${Math.min(rowsVisible,visible.length)} of ${visible.length} cards shown · ${pack().items.length} / ${model.MAX_PACK_ITEMS.toLocaleString('en-US')} in pack`;
    $('#pack-items-more').hidden=visible.length<=rowsVisible;
    const total = pack().items.reduce((sum, item) => sum + item.chanceBps, 0);
    $('#odds-total').textContent = `Total odds: ${percent(total)}%`;
    $('#odds-total').classList.toggle('is-invalid', total !== 10000);
    renderEV();
  }
  function editor(item, isNew = false) {
    editorDirty = false; newItem = isNew;
    $('#item-error').hidden = true;
    $('#item-form').hidden = !item;
    $('#editor-empty').hidden = Boolean(item);
    $('#editor-title').textContent = isNew ? 'Add item' : 'Edit item';
    $('#update-item').textContent = isNew ? 'Add to pack' : 'Update item';
    if (!item) { selectedItem = null; refreshSave(); return; }
    selectedItem = item.id; currentImage = item.image;
    $('#item-name').value = item.name;
    $('#item-rarity').value = item.rarity;
    $('#item-condition').value=item.grading?'graded':'raw';$('#item-grader').value=item.grading?.company||'PSA';$('#item-grade').value=item.grading?.grade||'';gradingControls();
    $('#item-value').value = (item.valueCents / 100).toFixed(2);
    $('#item-chance').value = percent(item.chanceBps);
    $('#item-grail').checked = item.grail;
    $('#item-preview').src = imageURL(item.image);
    $('#item-preview').alt = `${item.name || 'New card'} artwork`;
    $('#preview-name').textContent = item.name || 'New card';
    $('#delete-item').hidden = isNew;
    refreshSave();
  }
  function gradingControls(){const raw=$('#item-condition').value==='raw';$('#item-grader').disabled=busy||raw;$('#item-grade').disabled=busy||raw}
  $('#item-condition').addEventListener('change',gradingControls);
  function renderPack() {
    clearOddsPreview(); oddsUndo = null; $('#undo-odds').hidden = true;
    $('#selected-pack-title').firstChild.textContent = `${tiers.find(tier => tier.id === selectedPack).name} pack `;
    $('#pack-enabled').checked = pack().enabled;
    $('#pack-price').placeholder = tiers.find(tier=>tier.id===selectedPack).limited ? 'Set seasonal price' : 'Tier default';
    $('#pack-price').value = priceInputs.get(selectedPack) ?? (pack().priceCents == null ? '' : (pack().priceCents / 100).toFixed(2));
    $('#pack-price-error').hidden = true;
    $('#pack-price').removeAttribute('aria-invalid');
    renderTiers(); renderRows(); refreshSave();
  }
  function confirmAction(title, copy, label) {
    const dialog = $('#confirm-dialog');
    if (dialog.open) return Promise.resolve(false);
    $('#confirm-title').textContent = title; $('#confirm-copy').textContent = copy; $('#confirm-ok').textContent = label;
    dialog.returnValue = ''; dialog.showModal();
    return new Promise(resolve => dialog.addEventListener('close', () => resolve(dialog.returnValue === 'ok'), { once:true }));
  }
  async function mayLeaveEditor() {
    return !editorDirty || await confirmAction('Discard item edits?', 'Update this item first to keep your changes in the pack draft.', 'Discard edits');
  }
  async function choosePack(id) {
    if (busy || id === selectedPack || !await mayLeaveEditor()) return;
    selectedPack = id; $('#card-search').value = '';
    editor(pack().items.at(-1)); renderPack();
  }
  function stageItem() {
    if ($('#item-form').hidden) return true;
    const item = { id:selectedItem, name:$('#item-name').value.trim(), image:currentImage, rarity:$('#item-rarity').value, valueCents:model.decimalToUnits($('#item-value').value), chanceBps:model.decimalToUnits($('#item-chance').value), grail:$('#item-grail').checked };
    if($('#item-condition').value==='graded')item.grading={company:$('#item-grader').value,grade:$('#item-grade').value.trim()};
    const next = newItem ? [...pack().items, item] : pack().items.map(existing => existing.id === selectedItem ? item : existing);
    const issues = model.validateItems(next).filter(issue => issue !== 'Pull chances must total exactly 100%.');
    if (issues.length) { $('#item-error').textContent = issues[0]; $('#item-error').hidden = false; return false; }
    pack().items = next; markDirty(); editor(item); renderRows();
    return true;
  }
  function stagePrice() {
    const input = $('#pack-price');
    const price = input.value.trim() ? model.decimalToUnits(input.value) : null;
    if (!model.validPackPrice(price) || (['icy-rush','mythic'].includes(selectedPack) && $('#pack-enabled').checked && price===null)) {
      chooseTab(true);
      $('#pack-price-error').textContent = ['icy-rush','mythic'].includes(selectedPack) && price===null ? `Set a pack price before enabling ${model.packName(selectedPack)}.` : 'Enter a price from $0 to $1,000,000 with up to two decimal places.';
      $('#pack-price-error').hidden = false; input.setAttribute('aria-invalid', 'true'); input.focus();
      return false;
    }
    pack().priceCents = price;
    return true;
  }
  function showConnection() {
    const ready = loaded.size === tiers.length;
    $('#connection-notice').hidden = ready;
    $('#connection-copy').textContent = 'Saved contents are unavailable for some tiers. Showing demo defaults; connect Firebase to save.';
    $('#catalog-connection').textContent = ready ? 'Connected' : 'Setup or connection needed';
  }
  async function loadPacks() {
    const request = ++generation, uid = ownerUid;
    setBusy(true);
    const results = await Promise.allSettled(tiers.map(async tier => {
      const result = await Promise.race([client.loadPackContents(tier.id,{forEditor:true}), new Promise((_, reject) => setTimeout(() => reject(new Error('Connection timed out.')), 9000))]);
      return [tier.id, result];
    }));
    if (request !== generation || !owner() || ownerUid !== uid) return;
    results.forEach(result => {
      if (result.status === 'fulfilled') {
        const [id, saved] = result.value;
        // Retry never overwrites an unsaved draft or the version it was based on.
        if (!dirty.has(id) && !(id === selectedPack && editorDirty)) packs.set(id, saved);
        loaded.add(id);
      }
    });
    showConnection();
    if (!editorDirty) editor(pack().items.find(item => item.id === selectedItem) || pack().items.at(-1));
    setBusy(false); renderPack();
  }
  async function signOut() {
    if (busy || window.RipprHomepageAdmin?.busy || window.RipprLibraryAdmin?.busy) return;
    if ((dirty.size || editorDirty || window.RipprHomepageAdmin?.dirty || window.RipprLibraryAdmin?.dirty) && !await confirmAction('Sign out with unsaved changes?', 'Your unsaved edits will be discarded.', 'Sign out')) return;
    try { await client.signOut(); renderAccess(); } catch { status('Could not sign out. Please retry.', true); }
  }
  function renderAccess() {
    const user = client?.currentUser();
    const allowed = model.isAdminUser(user);
    $('#access-gate').hidden = allowed;
    $('#admin-layout').hidden = !allowed;
    $('#sidebar-toggle').hidden = !allowed;
    for (const id of ['gate-login','gate-check','gate-signout','gate-retry']) $('#' + id).hidden = true;
    if (allowed) {
      $('#settings-owner').textContent = user.phoneNumber;
      $('#owner-avatar').title = user.phoneNumber;
      if (ownerUid !== user.uid) {
        ownerUid = user.uid; dirty.clear(); loaded.clear(); priceInputs.clear(); editorDirty = false;
        tiers.forEach(tier => packs.set(tier.id, model.defaultPack(tier.id)));
        renderPack(); editor(pack().items.at(-1)); loadPacks();
      }
    } else {
      if (ownerUid) { ownerUid = null; generation++; dirty.clear(); loaded.clear(); priceInputs.clear(); editorDirty = false; setBusy(false); }
      setSidebar(false);
      if (!user) {
        $('#gate-title').textContent = 'Admin sign-in';
        $('#gate-copy').textContent = 'Log in with your owner account to manage rippr.';
        $('#gate-login').hidden = false;
      } else if (!user.phoneNumber) {
        $('#gate-title').textContent = 'Link your phone';
        $('#gate-copy').textContent = 'Link a verified phone number to your existing account. Your balance and items stay on the same account.';
        $('#gate-login').hidden = false; $('#gate-signout').hidden = false;
      } else {
        $('#gate-title').textContent = 'Admin access only';
        $('#gate-copy').textContent = 'This account does not have permission to manage rippr.';
        $('#gate-signout').hidden = false;
      }
    }
  }

  $('#item-rarity').innerHTML = model.RARITIES.map(rarity => `<option>${rarity.name}</option>`).join('');
  $('#tier-grid').addEventListener('click', event => { const button = event.target.closest('[data-pack]'); if (button) choosePack(button.dataset.pack); });
  $('#item-rows').addEventListener('click', async event => {
    const row = event.target.closest('[data-item]');
    if (!row || busy || !await mayLeaveEditor()) return;
    editor(pack().items.find(item => item.id === row.dataset.item)); renderRows();
  });
  $('#card-search').addEventListener('input', renderRows);
  $('#pack-items-more').addEventListener('click',()=>{if(!busy){rowsVisible+=50;renderRows()}});
  $('#item-form').addEventListener('input', changedEditor);
  $('#item-form').addEventListener('change', changedEditor);
  $('#item-name').addEventListener('input', () => { $('#preview-name').textContent = $('#item-name').value || 'New card'; });
  $('#item-form').addEventListener('submit', event => { event.preventDefault(); if (!busy && owner() && stageItem()) status('Item updated in your draft. Save changes to publish it.'); });
  $('#add-item').addEventListener('click', async () => {
    if (busy || !await mayLeaveEditor()) return;
    if (pack().items.length >= model.MAX_PACK_ITEMS) { status(`Each pack supports up to ${model.MAX_PACK_ITEMS.toLocaleString('en-US')} cards.`, true); return; }
    editor({ id:crypto.randomUUID(), name:'', image:'assets/card-placeholder.svg', rarity:'Common', valueCents:0, chanceBps:0, grail:false }, true);
    renderRows(); $('#item-name').focus(); $('#editor-panel').scrollIntoView({ behavior:matchMedia('(prefers-reduced-motion:reduce)').matches ? 'instant' : 'smooth', block:'nearest' });
  });
  $('#close-editor').addEventListener('click', async () => { if (!busy && await mayLeaveEditor()) { editor(null); renderRows(); } });
  $('#delete-item').addEventListener('click', async () => {
    if (busy || !await confirmAction('Remove this item?', 'It will be removed from this pack when you save changes. Other tiers keep their own contents.', 'Remove item')) return;
    pack().items = pack().items.filter(item => item.id !== selectedItem);
    markDirty(); editor(pack().items.at(-1)); renderRows();
  });
  $('#upload-image').addEventListener('click', () => { if (!busy) $('#image-file').click(); });
  $('#image-file').addEventListener('change', async event => {
    const file = event.target.files[0]; event.target.value = '';
    if (!file || busy || !owner()) return;
    setBusy(true);
    try {
      if (!['image/jpeg','image/png','image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) throw { code:'catalog/invalid-image', message:'Choose a JPG, PNG, or WebP image up to 5 MB.' };
      let bitmap;
      try { bitmap = await createImageBitmap(file); }
      catch { throw { code:'catalog/invalid-image', message:'This image could not be read. Choose a valid JPG, PNG, or WebP file.' }; }
      const valid = bitmap.width > 0 && bitmap.height > 0 && bitmap.width <= 8192 && bitmap.height <= 8192; bitmap.close();
      if (!valid) throw { code:'catalog/invalid-image', message:'Choose an image no larger than 8192 pixels on either side.' };
      const url = await client.uploadCardImage(file);
      if (!owner()) return;
      currentImage = url; $('#item-preview').src = url; changedEditor();
      status('Image uploaded. Update the item, then save your pack.');
    } catch (error) { status(errorText(error), true); }
    finally { setBusy(false); }
  });
  $('#save-pack').addEventListener('click', async () => {
    if (busy || !owner() || !loaded.has(selectedPack)) return;
    if (!stagePrice()) return;
    if (editorDirty && !stageItem()) return;
    const issues = model.validateItems(pack().items);
    if (issues.length) { status(issues[0], true); return; }
    const id = selectedPack, draft = structuredClone(pack());
    setBusy(true);
    try {
      const version = await client.savePackContents(id, draft, draft.version);
      if (!owner()) return;
      pack().version = version; pack().source = 'firebase'; dirty.delete(id);
      priceInputs.delete(id);
      $('#pack-price').value = pack().priceCents == null ? '' : (pack().priceCents / 100).toFixed(2);
      status(`${tiers.find(tier => tier.id === id).name} pack saved. Its contents are now available on the site.`);
      oddsUndo = null; $('#undo-odds').hidden = true;
    } catch (error) { status(errorText(error), true); }
    finally { setBusy(false); renderTiers(); }
  });
  $('#retry-connection').addEventListener('click', () => { if (!busy && owner()) loadPacks(); });
  $('#pack-enabled').addEventListener('change', event => { pack().enabled = event.target.checked; markDirty(); });
  $('#pack-price').addEventListener('input', event => {
    priceInputs.set(selectedPack, event.target.value);
    $('#pack-price-error').hidden = true; event.target.removeAttribute('aria-invalid'); markDirty(); renderEV();
  });
  for (const id of ['odds-target','odds-include-zero']) $('#' + id).addEventListener('input', () => { clearOddsPreview(); refreshSave(); });
  $('#odds-target-mode').addEventListener('change', () => {
    const price = effectivePrice(), value = model.decimalToUnits($('#odds-target').value);
    if (price > 0 && Number.isFinite(value)) $('#odds-target').value = ($('#odds-target-mode').value === 'value' ? price * value / 10000 / 100 : value / price * 100).toFixed(2);
    clearOddsPreview(); refreshSave();
  });
  document.querySelectorAll('[data-odds-preset]').forEach(button => button.addEventListener('click', () => {
    $('#odds-target-mode').value = 'return'; $('#odds-target').value = button.dataset.oddsPreset;
    clearOddsPreview(); refreshSave();
  }));
  $('#generate-odds').addEventListener('click', () => {
    if (busy || !owner() || !loaded.has(selectedPack)) return;
    clearOddsPreview();
    if (editorDirty) { oddsError('Update the item first so its edits are included in the calculation.'); refreshSave(); return; }
    const input = model.decimalToUnits($('#odds-target').value), price = effectivePrice();
    if (!Number.isFinite(input)) { oddsError('Enter a target with up to two decimal places.'); refreshSave(); return; }
    if ($('#odds-target-mode').value === 'return' && !(price > 0)) { oddsError('Set a valid pack price greater than $0, or enter an EV in USD.'); refreshSave(); return; }
    const target = $('#odds-target-mode').value === 'return' ? price * input / 10000 : input;
    try {
      const result = odds.generateOdds(pack().items, target, { includeZero:$('#odds-include-zero').checked });
      oddsPreview = { ...result, fingerprint:oddsFingerprint() };
      $('#odds-preview-stats').textContent = `Calculated EV ${money.format(result.actualCents / 100)}${price > 0 ? ` · ${(result.actualCents / price * 100).toFixed(2)}% of pack price` : ''}`;
      const difference = (result.actualCents - target) / 100;
      const delta = Math.abs(difference) < .00005 ? '$0.00' : `${difference < 0 ? '−' : '+'}$${Math.abs(difference).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:4})}`;
      $('#odds-preview-note').textContent = `Total: 100%. Rounded to 0.01% odds. Target EV ${money.format(target / 100)}; difference ${delta}.`;
      $('#odds-preview-rows').innerHTML = result.items.map((item, i) => `<tr><th scope="row">${escape(item.name)}</th><td>${percent(pack().items[i].chanceBps)}%</td><td>${percent(item.chanceBps)}%</td></tr>`).join('');
      $('#odds-preview').hidden = false;
    } catch (error) { oddsError(error.message); }
    refreshSave();
  });
  $('#apply-odds').addEventListener('click', () => {
    if (busy || !owner() || !oddsPreview) return;
    if (editorDirty || oddsPreview.fingerprint !== oddsFingerprint()) { clearOddsPreview(); oddsError('The draft changed. Preview odds again.'); refreshSave(); return; }
    const before = structuredClone(pack().items), next = oddsPreview.items;
    pack().items = next; markDirty();
    oddsUndo = { pack:selectedPack, items:before, fingerprint:oddsFingerprint() }; $('#undo-odds').hidden = false;
    editor(pack().items.find(item => item.id === selectedItem)); renderRows(); refreshSave();
    $('#undo-odds').focus(); status('Generated odds applied to the draft. Save changes to publish them.');
  });
  $('#undo-odds').addEventListener('click', () => {
    if (busy || !owner() || !oddsUndo) return;
    if (editorDirty) { oddsError('Update or discard the item edits before undoing.'); return; }
    if (oddsUndo.pack !== selectedPack || oddsUndo.fingerprint !== oddsFingerprint()) return;
    pack().items = oddsUndo.items; markDirty();
    editor(pack().items.find(item => item.id === selectedItem)); renderRows();
    $('#generate-odds').focus(); status('Previous draft odds restored.');
  });
  function chooseTab(settings) {
    for (const [id, selected] of [['contents-tab',!settings],['pack-settings-tab',settings]]) { $('#' + id).setAttribute('aria-selected', String(selected)); $('#' + id).tabIndex = selected ? 0 : -1; }
    $('#contents-panel').hidden = settings; $('#pack-settings-panel').hidden = !settings;
  }
  $('#contents-tab').addEventListener('click', () => chooseTab(false));
  $('#pack-settings-tab').addEventListener('click', () => chooseTab(true));
  $('.pack-tabs').addEventListener('keydown', event => { if (['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) { event.preventDefault(); const settings = event.key === 'End' || (event.key !== 'Home' && $('#contents-tab').getAttribute('aria-selected') === 'true'); chooseTab(settings); $(settings ? '#pack-settings-tab' : '#contents-tab').focus(); } });
  document.querySelectorAll('[data-view]').forEach(button => button.addEventListener('click', () => { if (!busy) view(button.dataset.view, mobile.matches); }));
  window.RipprPackAdmin = {
    confirm:confirmAction,
    get busy() { return busy; },
    snapshot() { return owner()?{id:selectedPack,name:tiers.find(t=>t.id===selectedPack).name,ready:loaded.has(selectedPack),items:structuredClone(pack().items)}:null; },
    cards() {
      if (!owner() || loaded.size !== tiers.length) throw new Error('Load saved pack contents before copying cards.');
      return [...new Map(tiers.flatMap(tier => packs.get(tier.id).items.map(item => [item.id, { ...item, source:'pack' }]))).values()];
    },
    async addCards(id, cards) {
      if (!owner() || busy || !loaded.has(id)) throw new Error('Wait for saved pack contents to load before adding cards.');
      const uid=ownerUid;
      if (!await mayLeaveEditor()) return null;
      if(!owner()||ownerUid!==uid||busy||!loaded.has(id))throw new Error('Your account or pack changed. Reopen the card picker.');
      const result = window.RipprLibrary.addLibraryToPack(packs.get(id).items, cards);
      selectedPack = id; $('#card-search').value = '';
      pack().items = result.items;
      if (result.added) markDirty();
      editor(pack().items.at(-1)); renderPack(); chooseTab(false); view('packs', true);
      status(`${result.added} cards added to the draft at 0% odds. ${result.skipped} existing IDs skipped. Set odds or use the EV calculator, then save changes.`);
      return result;
    }
  };
  $('#sidebar-toggle').addEventListener('click', () => setSidebar(!document.body.classList.contains('sidebar-open')));
  $('#sidebar-backdrop').addEventListener('click', () => { setSidebar(false); $('#sidebar-toggle').focus(); });
  mobile.addEventListener('change', () => setSidebar(false));
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && document.body.classList.contains('sidebar-open')) { setSidebar(false); $('#sidebar-toggle').focus(); } });
  $('#confirm-ok').addEventListener('click', () => $('#confirm-dialog').close('ok'));
  $('#confirm-cancel').addEventListener('click', () => $('#confirm-dialog').close('cancel'));
  for (const id of ['sign-out','settings-signout','gate-signout']) $('#' + id).addEventListener('click', signOut);
  $('#gate-check').addEventListener('click', async () => { try { await client.refreshUser(); renderAccess(); } catch { $('#gate-copy').textContent = 'Could not check verification. Please try again.'; } });
  $('#gate-retry').addEventListener('click', () => location.reload());
  document.addEventListener('rippr:authchange', renderAccess);
  window.addEventListener('beforeunload', event => { if (owner() && (dirty.size || editorDirty)) { event.preventDefault(); event.returnValue = ''; } });
  if (client) client.ready.then(renderAccess).catch(() => { $('#gate-title').textContent = 'Sign-in unavailable'; $('#gate-copy').textContent = 'Check your connection and try again.'; $('#gate-retry').hidden = false; });
  else { $('#gate-title').textContent = 'Sign-in unavailable'; $('#gate-copy').textContent = 'Reload the page to reconnect.'; $('#gate-retry').hidden = false; }
})();
