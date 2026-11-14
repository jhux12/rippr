/* Actual page scripts + isolated account service. Requires Playwright and Chromium.
 * No Firebase network requests or SMS are made; all HTTP is locally fulfilled.
 * Run npm run test:browser (install Chromium with npx playwright install chromium).
 * CHROMIUM_PATH can select an existing system Chromium without a browser download.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {pathToFileURL} = require('node:url');
const {randomUUID} = require('node:crypto');
const {chromium} = require('playwright');
const root = path.resolve(__dirname, '../..');
const origin = 'http://localhost:3000';
const blankScripts = new Set(['firebase-client.js', 'navigation.js', 'footer.js', 'opening-audio.js']);
const mime = {'.html':'text/html','.js':'application/javascript','.css':'text/css','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml','.woff2':'font/woff2','.wav':'audio/wav'};
const waitFor = (page, fn) => page.waitForFunction(fn, null, {timeout:15000});

async function routeLocal(page) {
  await page.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.origin !== origin) throw new Error(`Unexpected external request: ${url.origin}`);
    if (url.pathname === '/journey-return.html') return route.fulfill({contentType:'text/html',body:'<h1>Return destination</h1>'});
    const name = url.pathname.slice(1) || 'index.html';
    if (blankScripts.has(name)) return route.fulfill({contentType:'application/javascript',body:''});
    const file = path.resolve(root, name);
    assert(file.startsWith(root + path.sep));
    if (!fs.existsSync(file)) return route.abort();
    return route.fulfill({contentType:mime[path.extname(file)]||'application/octet-stream',body:fs.readFileSync(file)});
  });
}
async function newPage(browser, init, seed) {
  const page = await browser.newPage({viewport:{width:390,height:844}});
  const errors=[];page.on('pageerror', error=>errors.push(error.message));
  await routeLocal(page);await page.addInitScript(init, seed);
  return {page,errors};
}
function assertClean(errors) { assert.deepEqual(errors, []); }

async function authJourney(browser, width) {
  const {page,errors}=await newPage(browser,()=>{
    window.calls=[];let current=null;
    window.RIPPR_ACCOUNT={ready:true,user:null};
    window.RipprFirebase={ready:Promise.resolve(),currentUser:()=>current,observe:()=>{},cancelPhoneSignIn:()=>{},
      startPhoneSignIn:async(number,options)=>{calls.push(['sms',options]);return {phoneNumber:number}},
      validateSignupReferral:async code=>{calls.push(['check',code]);if(code.endsWith('0000'))throw {code:'functions/failed-precondition',message:'Invalid referral'}},
      confirmPhoneSignIn:async()=>{current={uid:'auth-member',phoneNumber:'+12015550123'};return current},
      accountAction:async()=>({canApply:false,config:{enabled:true,version:0}})};
  });
  await page.setViewportSize({width,height:900});
  // Account state is not needed for auth's persistence-choice / return-path UI.
  await page.route('**/account-state.js',r=>r.fulfill({contentType:'application/javascript',body:''}));
  for(const remember of [false,true]){
    await page.goto(origin+'/auth.html?mode=login&next='+encodeURIComponent('/journey-return.html?from=login#saved')+'&ref=RIPPR-AAAAAAAAAAAAAAAA');
    await waitFor(page,()=>!document.querySelector('#auth-submit').disabled);
    assert(await page.locator('#invite-code-group').isHidden());assert(await page.locator('#remember-group').isVisible());
    if(remember)await page.locator('#remember-me').check();
    await page.locator('#phone').fill('2015550123');await page.locator('#auth-submit').click();
    await page.locator('#code-step:not([hidden])').waitFor();
    assert.deepEqual(await page.evaluate(()=>calls),[['sms',{link:false,remember}]]);
    await page.locator('#verification-code').fill('123456');await page.locator('#auth-submit').click();
    await page.waitForURL(origin+'/journey-return.html?from=login#saved');
  }
  await page.goto(origin+'/auth.html?mode=signup&next='+encodeURIComponent('/journey-return.html?from=signup'));
  await waitFor(page,()=>!document.querySelector('#auth-submit').disabled);
  assert(await page.locator('#remember-group').isHidden());assert(await page.locator('#invite-code-group').isVisible());await page.locator('#eligibility-dob').fill('1990-01-01');await page.locator('#eligibility-terms').check();await page.locator('#eligibility-privacy').check();
  await page.locator('#phone').fill('2015550123');await page.locator('#invite-code').fill('RIPPR-0000000000000000');await page.locator('#auth-submit').click();
  await page.locator('#invite-code-error:not([hidden])').waitFor();assert.equal(await page.evaluate(()=>calls.filter(c=>c[0]==='sms').length),0);
  await page.locator('#invite-code').fill('RIPPR-AAAAAAAAAAAAAAAA');await page.locator('#auth-submit').click();await page.locator('#code-step:not([hidden])').waitFor();
  assert.deepEqual(await page.evaluate(()=>calls.map(c=>c[0])),['check','check','sms']);
  await page.locator('#verification-code').fill('123456');await page.locator('#auth-submit').click();await page.waitForURL(origin+'/journey-return.html?from=signup');
  // External redirects are rejected by the actual phone helper and auth page.
  await page.goto(origin+'/auth.html?mode=login&next='+encodeURIComponent('https://outside.invalid/'));
  await waitFor(page,()=>!document.querySelector('#auth-submit').disabled);
  await page.locator('#phone').fill('2015550123');await page.locator('#auth-submit').click();await page.locator('#code-step:not([hidden])').waitFor();
  await page.locator('#verification-code').fill('123456');await page.locator('#auth-submit').click();await page.waitForURL(origin+'/');
  assertClean(errors);await page.close();console.log('PASS auth: distinct modes, referral check before SMS, Remember me option, successful same-site returns, external redirect rejection');
}
async function accountFixture(browser, uid, fixture) {
  const {page,errors}=await newPage(browser,({uid})=>{
    let current=uid?{uid,phoneNumber:'+12015550123'}:null;const observers=[];
    window.__fixtureCalls=[];
    window.__switchUser=next=>{current=next?{uid:next,phoneNumber:'+12015550123'}:null;observers.forEach(fn=>fn(current))};
    const rpc=async(action,data={},operationId)=>{
      __fixtureCalls.push({action,data,operationId});
      if(action==='inventoryPage'&&window.__failInventoryPage)throw Object.assign(new Error('Fixture network interruption'),{code:'functions/unavailable'});
      const result=await window.__accountService({uid:current?.uid,action,data,operationId});
      if(!result.ok)throw Object.assign(new Error(result.error.message),{code:'functions/'+result.error.code});return result.data;
    };
    window.RipprFirebase={ready:Promise.resolve(),currentUser:()=>current,observe:fn=>{observers.push(fn);setTimeout(()=>fn(current),0)},accountAction:rpc,
      loadPackContents:async id=>{const result=await window.__catalog(id);return result},
      loadInventoryPack:async id=>(await rpc('inventoryPack',{inventoryPackId:id})).pack,
      loadShipment:async id=>window.__readRecord({uid:current?.uid,collection:'shipments',id}),
      museumAction:async(action,data={})=>{const result=await window.__museumService({uid:current?.uid,action,data});if(!result.ok)throw Object.assign(new Error(result.error.message),{code:'functions/'+result.error.code});return result.data},
      signOut:async()=>window.__switchUser(null)};
  },{uid});
  await page.exposeFunction('__accountService',async({uid,action,data,operationId})=>{
    try{return {ok:true,data:await fixture.run(uid,{action,...data,...(operationId?{operationId}:{})})}}
    catch(error){return {ok:false,error:{code:error.code||'internal',message:error.message}}}
  });
  await page.exposeFunction('__catalog',async id=>fixture.catalog(id));
  await page.exposeFunction('__readRecord',async({uid,collection,id})=>{const record=await fixture.db.runTransaction(tx=>tx.get(fixture.db.doc(`testAccounts/${uid}/${collection}/${id}`)));if(!record.exists)throw Error('Record unavailable');return {...record.data(),id}});
  await page.exposeFunction('__museumService',async({uid,action,data})=>{try{return {ok:true,data:await fixture.museumRun(uid,{action,...data})}}catch(error){return {ok:false,error:{code:error.code||'internal',message:error.message}}}});
  return {page,errors};
}
async function profileJourney(browser, fixture, width) {
  const uid='journey-profile',other='journey-other';await fixture.act(uid,'topup',{amountCents:10000});
  const opened=await fixture.act(uid,'purchase',{packId:'basic',quantity:3,expectedVersion:1,expectedPriceCents:199});
  const address={fullName:'Fixture Collector',line1:'123 Test Street',city:'Test City',region:'IN',postalCode:'46000',country:'US'};
  await fixture.act(uid,'settings',{address});await fixture.act(other,'topup',{amountCents:1000});
  const {page,errors}=await accountFixture(browser,uid,fixture);await page.setViewportSize({width,height:900});await page.goto(origin+'/profile.html');
  await waitFor(page,()=>document.querySelectorAll('.item-card').length===3);
  const before=await fixture.act(uid,'snapshot'), ids=opened.cards.slice(0,2).map(c=>c.id),value=opened.cards.slice(0,2).reduce((s,c)=>s+c.valueCents,0);
  for(const id of ids)await page.locator(`[data-select="${id}"]`).check();
  assert.equal(await page.locator('#selected-count').textContent(),'2 selected');
  await page.locator(`[data-select="${ids[0]}"]`).focus();await page.evaluate(()=>window.RipprAccount.refresh());
  assert.equal(await page.evaluate(()=>document.activeElement.dataset.select),ids[0]);assert(await page.locator(`[data-select="${ids[0]}"]`).isChecked());
  await page.locator(`[data-sell="${ids[0]}"]`).focus();await page.evaluate(()=>window.RipprAccount.refresh());assert.equal(await page.evaluate(()=>document.activeElement.dataset.sell),ids[0]);
  await page.locator('#bulk-sell').click();await page.locator('#item-dialog[open]').waitFor();await page.locator('#confirm-action').click();
  await waitFor(page,()=>document.querySelectorAll('.item-card').length===1);
  const sold=await fixture.act(uid,'snapshot');assert.equal(sold.account.balanceCents,before.account.balanceCents+value);assert.equal(sold.items.filter(i=>i.status==='sold').length,2);
  await page.locator('[data-ship]').click();await page.locator('#shipping-dialog[open]').waitFor();
  assert(await page.locator('.shipping-choice input[value="saved"]').isChecked());
  await page.locator('#shipping-form [type="submit"]').click();await page.waitForURL(/order-tracking\.html\?request=/);
  const shipped=await fixture.act(uid,'snapshot');assert.equal(shipped.shipments.length,1);assert.equal(shipped.items.find(i=>i.id===opened.cards[2].id).status,'shipping');assert.equal(shipped.shipments[0].address.line1,address.line1);
  // Sign-out / account switch closes in-progress dialogs and removes prior inventory.
  const fresh=await fixture.act(uid,'purchase',{packId:'basic',quantity:1,expectedVersion:1,expectedPriceCents:199});
  await page.goto(origin+'/profile.html');await waitFor(page,()=>document.querySelectorAll('[data-ship]').length===1);await page.locator('[data-ship]').click();await page.locator('#shipping-dialog[open]').waitFor();
  await page.evaluate(next=>window.__switchUser(next),other);await waitFor(page,()=>window.RIPPR_ACCOUNT?.user?.uid==='journey-other'&&window.RIPPR_ACCOUNT?.wallet);
  assert(await page.locator('#shipping-dialog').evaluate(d=>!d.open));assert.equal(await page.locator('.item-card').count(),0);assert.equal(await page.locator('#bulk-actions').isHidden(),true);
  assert.equal((await fixture.act(uid,'snapshot')).items.find(i=>i.id===fresh.cards[0].id).status,'available');
  assertClean(errors);await page.close();console.log('PASS profile/service: bulk sale credits saved values, shipping saves address and ownership, account switching clears dialogs and inventory');
}
async function inventoryJourney(browser, fixture, width) {
  const uid='journey-large';await fixture.act(uid,'snapshot');const oldIds=[];
  await fixture.db.runTransaction(async tx=>{
    for(let i=0;i<205;i++){
      const id=randomUUID();if(i<5)oldIds.push(id);
      tx.set(fixture.db.doc(`testAccounts/${uid}/items/${id}`),{id,name:`Collection card ${i}`,status:i<5?'available':'sold',wonAt:1700000000000+i,image:'assets/grail-moonstone.svg',rarity:'Rare',valueCents:100});
      const packId=randomUUID();tx.set(fixture.db.doc(`testAccounts/${uid}/packs/${packId}`),{id:packId,packId:'basic',name:'Basic pack',image:'assets/pack-basic.svg',status:i<5?'available':'opened',wonAt:1700000000000+i});
    }
  });
  const {page,errors}=await accountFixture(browser,uid,fixture);await page.setViewportSize({width,height:900});await page.goto(origin+'/profile.html');
  await waitFor(page,()=>window.RIPPR_ACCOUNT?.items.length===200);
  assert.equal(await page.locator('.item-card').count(),0);assert.equal(await page.locator('.inventory-pack').count(),0);
  assert(await page.locator('#load-more-items').isVisible());assert(await page.locator('#load-more-packs').isVisible());
  await page.locator('#load-more-items').click();await waitFor(page,()=>window.RIPPR_ACCOUNT.items.length===205);
  assert.equal(await page.locator('.item-card').count(),5);assert(await page.locator('#load-more-items').isHidden());
  await page.locator('#load-more-packs').click();await waitFor(page,()=>window.RIPPR_ACCOUNT.packs.length===205);
  assert.equal(await page.locator('.inventory-pack').count(),5);assert(await page.locator('#load-more-packs').isHidden());
  await page.locator(`[data-select="${oldIds[0]}"]`).check();
  await fixture.act(uid,'sell',{itemIds:[oldIds[0]]});await page.evaluate(()=>window.RipprAccount.refresh());
  assert.equal(await page.locator('.item-card').count(),4);assert.equal(await page.locator('#bulk-actions').isHidden(),true);
  assert.equal(await page.evaluate(()=>window.RIPPR_ACCOUNT.items.length),205);
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  assertClean(errors);await page.close();console.log('PASS full inventory/service: older actionable cards and packs reachable, end-of-list, refreshed older-sale state and selection cleanup');
}
async function museumJourney(browser, fixture, width) {
  const uid='journey-museum';await fixture.act(uid,'snapshot');const old=[];let latest;
  await fixture.db.runTransaction(async tx=>{for(let i=0;i<205;i++){
    const id=randomUUID(),status=i===204?'available':i<5?['available','shipping','shipped','delivered','sold'][i]:'sold';if(i<5)old.push(id);if(i===204)latest=id;
    tx.set(fixture.db.doc(`testAccounts/${uid}/items/${id}`),{id,name:`Museum card ${i}`,status,wonAt:1700000000000+i,image:'assets/grail-moonstone.svg',rarity:'Rare',valueCents:100});
  }});
  const {page,errors}=await accountFixture(browser,uid,fixture);await page.setViewportSize({width,height:900});await page.goto(origin+'/museum.html');
  await page.locator('#museum-edit:not([hidden])').waitFor();await page.locator('#museum-edit').click();await page.locator('#museum-editor[open]').waitFor();
  assert.equal(await page.locator('.museum-option').count(),1);await page.locator(`[data-item-id="${latest}"]`).click();assert.equal(await page.locator('#museum-selected-count').textContent(),'1 / 6 cards');
  await page.locator('#museum-load-more').click();await waitFor(page,()=>window.RIPPR_ACCOUNT.items.length===205);
  assert.equal(await page.locator('#museum-selected-count').textContent(),'1 / 6 cards');assert.equal(await page.locator(`[data-item-id="${latest}"]`).getAttribute('aria-pressed'),'true');
  for(const id of old.slice(0,4))assert.equal(await page.locator(`[data-item-id="${id}"]`).count(),1);
  assert.equal(await page.locator(`[data-item-id="${old[4]}"]`).count(),0);assert(await page.locator('#museum-load-more').isHidden());
  await page.locator(`[data-item-id="${old[2]}"]`).click();await page.locator('#museum-save').click();await waitFor(page,()=>!document.querySelector('#museum-editor').open);
  const saved=(await fixture.museumRun(uid,{action:'own'})).museum;assert.deepEqual(saved.cardIds,[latest,old[2]]);
  assertClean(errors);await page.close();console.log('PASS museum/service: older kept/shipped cards load, sold excluded, selected draft survives pagination and saves ownership-checked display');
}
async function trackingJourney(browser, fixture, width) {
  const uid='journey-tracking';await fixture.act(uid,'snapshot');const ids=[];
  await fixture.db.runTransaction(async tx=>{for(let i=0;i<55;i++){
    const id=randomUUID();ids.push(id);tx.set(fixture.db.doc(`testAccounts/${uid}/shipments/${id}`),{id,status:'test-request',createdAt:1700000000000+i,items:[],address:null,version:0});
  }});
  const {page,errors}=await accountFixture(browser,uid,fixture);await page.setViewportSize({width,height:900});await page.goto(origin+'/order-tracking.html?request='+ids[54]);
  await waitFor(page,()=>document.querySelectorAll('#request-select option').length===50);assert.equal(await page.locator('#request-select').inputValue(),ids[54]);
  await page.evaluate(()=>window.__failInventoryPage=true);await page.locator('#load-more-shipments').click();await page.locator('#shipment-page-error:not([hidden])').waitFor();
  assert.equal(await page.locator('#request-select').inputValue(),ids[54]);
  await page.evaluate(()=>window.__failInventoryPage=false);await page.locator('#load-more-shipments').click();await waitFor(page,()=>document.querySelectorAll('#request-select option').length===55);
  assert.equal(await page.locator('#request-select').inputValue(),ids[54]);assert(await page.locator('#load-more-shipments').isHidden());
  await page.locator('#request-select').selectOption(ids[0]);await page.waitForURL(url=>url.searchParams.get('request')===ids[0]);await waitFor(page,()=>!document.querySelector('#tracking-content').hidden);
  assert.equal(await page.locator('#request-number').getAttribute('title'),ids[0]);assertClean(errors);await page.close();console.log('PASS tracking/service: older requests load, selection stays stable, transient paging error recovers, old request opens');
}
async function seasonalJourney(browser, fixture, width) {
  const uid='journey-seasonal';await fixture.act(uid,'snapshot');
  let catalog=await fixture.catalog('icy-rush');catalog={...catalog,enabled:true,priceCents:1500,version:1};
  await fixture.db.runTransaction(async tx=>{tx.set(fixture.db.doc('packContents/icy-rush'),catalog);tx.set(fixture.db.doc('rewardSettings/spark'),{enabled:true,testingNoCooldown:true,version:1,prizes:[{id:'winter',kind:'pack',packId:'icy-rush',chanceBps:10000}]})});
  await fixture.db.runTransaction(tx=>tx.update(fixture.db.doc('testAccounts/'+uid),{sparkUnits:2500,sparkEarnedUnits:2500}));
  const won=await fixture.act(uid,'redeemSpark',{expectedVersion:1});
  await fixture.db.runTransaction(async tx=>tx.set(fixture.db.doc('packContents/icy-rush'),{...catalog,enabled:false,priceCents:null,version:2}));
  const {page,errors}=await accountFixture(browser,uid,fixture);await page.setViewportSize({width,height:900});
  await page.goto(origin+'/opening.html?pack=icy-rush');await waitFor(page,()=>document.querySelector('#open').textContent!=='Loading pack…');assert(await page.locator('#open').isDisabled());
  await page.goto(origin+'/opening.html?pack=basic&inventory='+won.inventoryPackId);await waitFor(page,()=>document.querySelector('#open').textContent==='Reward pack unavailable');assert(await page.locator('#open').isDisabled());
  await page.goto(origin+'/opening.html?pack=icy-rush&inventory='+won.inventoryPackId);await waitFor(page,()=>!document.querySelector('#open').disabled);assert.equal(await page.locator('#open').textContent(),'Open reward pack');
  const before=await fixture.act(uid,'snapshot');await page.locator('#open').click();await page.locator('#skip-opening:not([hidden])').waitFor();await page.locator('#skip-opening').click();await page.locator('#next').waitFor();
  const after=await fixture.act(uid,'snapshot');assert.equal(after.account.balanceCents,before.account.balanceCents);assert.equal(after.items.length,1);assert.equal(after.packs[0].status,'opened');assert.equal(after.items[0].packId,'icy-rush');
  await page.goto(origin+'/opening.html?pack=icy-rush&inventory='+won.inventoryPackId);await waitFor(page,()=>document.querySelector('#open').textContent==='Reward pack unavailable');assert(await page.locator('#open').isDisabled());
  assertClean(errors);await page.close();console.log('PASS seasonal/service: disabled sales stay blocked, wrong tier rejected, earned disabled/unpriced pack opens once without debit');
}
async function openingJourney(browser, fixture, width) {
  const uid='journey-open';await fixture.act(uid,'topup',{amountCents:10000});
  const {page,errors}=await accountFixture(browser,uid,fixture);await page.setViewportSize({width,height:900});await page.goto(origin+'/opening.html?pack=basic');
  await waitFor(page,()=>!document.querySelector('#open').disabled);await page.locator('[data-qty="3"]').click();await page.locator('#open').click();
  await page.locator('#skip-opening:not([hidden])').waitFor();await page.locator('#skip-opening').click();await page.locator('#next').waitFor();
  const purchased=await fixture.act(uid,'snapshot');assert.equal(purchased.items.length,3);assert.equal(purchased.account.balanceCents,9403);
  // Closing the enlarged stage continues the same paid batch, never buying again.
  await page.locator('#theater-toggle').click();assert(await page.locator('#opening-theater').evaluate(d=>!d.open));
  await page.locator('#next').click();await page.locator('#next').waitFor();assert(await page.locator('#skip-opening').isHidden());
  await page.locator('#next').click();await page.locator('#next').waitFor();assert(await page.locator('#skip-opening').isHidden());
  await page.locator('#next').click();await page.locator('#results.visible').waitFor();assert.equal(await page.locator('.result-card').count(),3);
  assert.equal((await fixture.act(uid,'snapshot')).items.length,3);assert.equal(await page.evaluate(()=>__fixtureCalls.filter(c=>c.action==='purchase').length),1);
  // Award persistence survives leaving before ripping or revealing.
  await page.goto(origin+'/opening.html?pack=basic');await waitFor(page,()=>!document.querySelector('#open').disabled);await page.locator('#open').click();await page.locator('#skip-opening:not([hidden])').waitFor();
  await page.goto(origin+'/profile.html');await waitFor(page,()=>window.RIPPR_ACCOUNT?.items.length===4);assert.equal((await fixture.act(uid,'snapshot')).items.length,4);
  assertClean(errors);await page.close();console.log('PASS opening/service: one debit per batch, batch-wide skip, theater exit continuity, interrupted reveal retains awarded cards');
}
(async()=>{
  const {accountService}=await import(pathToFileURL(path.join(root,'functions/service.js')));
  const {museumService}=await import(pathToFileURL(path.join(root,'functions/museum-service.js')));
  const {catalogDatabase:memoryDatabase}=await import(pathToFileURL(path.join(root,'tests/helpers/catalog-database.mjs')));
  const {defaultPack,DEFAULT_PRICES}=await import(pathToFileURL(path.join(root,'functions/catalog-model.js')));
  const createFixture=()=>{const db=memoryDatabase(),run=accountService(db);return {db,run,museumRun:museumService(db),act:(uid,action,data={})=>run(uid,{action,...data,operationId:randomUUID()}),catalog:async id=>{const found=await db.runTransaction(tx=>tx.get(db.doc('packContents/'+id)));const c=found.exists?found.data():defaultPack(id);return {...c,priceCents:c.priceCents??DEFAULT_PRICES[id]}}}};
  const executablePath=process.env.CHROMIUM_PATH||undefined;
  const browser=await chromium.launch({...(executablePath?{executablePath}:{}),args:['--no-sandbox']});
  try{for(const width of [320,390,1440]){console.log(`Viewport ${width}px`);const fixture=createFixture();await authJourney(browser,width);await profileJourney(browser,fixture,width);await inventoryJourney(browser,fixture,width);await museumJourney(browser,fixture,width);await trackingJourney(browser,fixture,width);await seasonalJourney(browser,fixture,width);await openingJourney(browser,fixture,width)}}finally{await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
