const {chromium}=require('playwright'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {randomUUID}=require('node:crypto');const root=path.resolve(__dirname,'../..'),origin='http://localhost:3000';
const types={'.html':'text/html','.js':'application/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.woff2':'font/woff2'};
(async()=>{
 const {accountService}=await import('../../functions/service.js'),{catalogDatabase:memoryDatabase}=await import('../helpers/catalog-database.mjs'),{OWNER_PHONE}=await import('../../src/catalog-model.js'),{defaultSpark}=await import('../../src/spark-model.js');
 const browser=await chromium.launch({...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),args:['--no-sandbox']});
 try{for(const width of [320,390,1440]){
  const db=memoryDatabase();let time=Date.now(),counts={},uid='member',dropNext=false;const run=accountService(db,{now:()=>time});
  const call=(who,action,data={},operationId=randomUUID())=>run(who,{action,...data,operationId},who==='owner'?{sub:'owner',phone_number:OWNER_PHONE}:{});
  const patch=async data=>db.runTransaction(async tx=>{await tx.get(db.doc('testAccounts/member'));tx.update(db.doc('testAccounts/member'),data)});
  await call(uid,'snapshot');await patch({sparkUnits:2500,sparkEarnedUnits:2500});
  let config=(await call('owner','sparkState')).config;
  await call('owner','saveSparkSettings',{config:{...defaultSpark(),testingNoCooldown:false},expectedVersion:config.version});
  const page=await browser.newPage({viewport:{width,height:1000},reducedMotion:width===320?'reduce':'no-preference'}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',route=>{const u=new URL(route.request().url());assert.equal(u.origin,origin);const name=u.pathname.slice(1);if(['firebase-client.js','account-state.js','footer.js','auth.js'].includes(name))return route.fulfill({body:'',contentType:'application/javascript'});const target=path.resolve(root,name);assert(target.startsWith(root+path.sep));if(!fs.existsSync(target))return route.abort();return route.fulfill({body:fs.readFileSync(target),contentType:types[path.extname(target)]||'application/octet-stream'})});
  await page.exposeFunction('fixtureRewards',async(action,data,actor,operationId)=>{try{counts[action]=(counts[action]||0)+1;const result=await call(actor,action,data,operationId);if(action==='redeemSpark'&&dropNext){dropNext=false;throw Object.assign(Error('Simulated lost response'),{code:'functions/unavailable'})}return{result,snapshot:actor?await call(actor,'snapshot'):null}}catch(e){return{error:{message:e.message,code:e.code}}}});
  await page.addInitScript(()=>{
   window.fixtureHidden=false;Object.defineProperty(document,'hidden',{configurable:true,get:()=>fixtureHidden});
   window.RIPPR_ACCOUNT={ready:true,user:{uid:'member'},wallet:null,items:[],packs:[],shipments:[],activity:[]};
   async function api(action,data={},actor=RIPPR_ACCOUNT.user?.uid||'guest-read',operationId){
    const response=await fixtureRewards(action,data,actor,operationId);if(response.error)throw Object.assign(Error(response.error.message),{code:response.error.code});
    if(RIPPR_ACCOUNT.user?.uid===actor&&response.snapshot){RIPPR_ACCOUNT.wallet=response.snapshot.account;RIPPR_ACCOUNT.packs=response.snapshot.packs;RIPPR_ACCOUNT.items=response.snapshot.items}
    return response.result;
   }
   window.RipprFirebase={ready:Promise.resolve(),accountAction:(action,data,operationId)=>api(action,data,undefined,operationId),loadSparkSettings:async()=> (await api('sparkState')).config};
   window.RipprAccount={refresh:async()=>api('snapshot'),errorMessage:e=>e.message,act:async(action,data)=>{const actor=RIPPR_ACCOUNT.user?.uid,result=await api(action,data,actor);if(RIPPR_ACCOUNT.user?.uid===actor)document.dispatchEvent(new Event('rippr:walletchange'));return result}};
  });
  await page.goto(origin+'/rewards.html');await page.waitForFunction(()=>!document.querySelector('#open-case').disabled);await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(500);
  assert.equal(await page.locator('.wheel-prize').count(),8);assert.equal(await page.locator('#spark-balance').textContent(),'25');assert.equal(await page.locator('#streak-panel').count(),0);assert(await page.locator('#claim-welcome').isDisabled());
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.screenshot({path:`/tmp/rewards-wheel-${width}.png`,fullPage:true});
  config=(await call('owner','sparkState')).config;await call('owner','saveSparkSettings',{config:{enabled:true,testingNoCooldown:false,prizes:[{id:'pack-basic',kind:'pack',packId:'basic',chanceBps:10000}]},expectedVersion:config.version});
  await page.reload();await page.waitForFunction(()=>!document.querySelector('#open-case').disabled);
  await page.locator('#open-case').evaluate(el=>{el.click();el.click()});
  if(width!==320){await page.waitForFunction(()=>document.querySelector('#reward-wheel').getAnimations().length>0);assert.equal((await call(uid,'snapshot')).packs.length,1,'Server saves the prize before wheel animation');
   await page.evaluate(()=>{fixtureHidden=true;document.dispatchEvent(new Event('visibilitychange'))});const before=await page.locator('#reward-wheel').evaluate(el=>el.getAnimations()[0].currentTime);await page.waitForTimeout(250);assert.equal(await page.locator('#reward-wheel').evaluate(el=>el.getAnimations()[0].currentTime),before);await page.setViewportSize({width,height:900});await page.evaluate(()=>{fixtureHidden=false;document.dispatchEvent(new Event('visibilitychange'))});}
  await page.locator('#result:not([hidden])').waitFor();assert((await page.locator('#result').textContent()).includes('Basic pack'));assert.equal(counts.redeemSpark,1);assert(await page.locator('#open-case').isDisabled());assert.equal(await page.locator('#reward-wheel').evaluate(el=>el.getAnimations().length),0);
  await page.locator('#view-prizes').click();await page.locator('#prizes-dialog[open]').waitFor();assert((await page.locator('#reward-grid').textContent()).includes('100% chance'));await page.keyboard.press('Escape');assert.equal(await page.evaluate(()=>document.activeElement.id),'view-prizes');
  if(width===1440){
   await patch({sparkUnits:2500,sparkEarnedUnits:5000});await page.reload();await page.waitForFunction(()=>!document.querySelector('#open-case').disabled);dropNext=true;await page.locator('#open-case').click();await page.waitForFunction(()=>document.querySelector('#open-case').textContent==='Recover saved spin');const savedCount=(await call(uid,'snapshot')).packs.length;assert.equal(savedCount,2);
   await page.reload();await page.waitForFunction(()=>document.querySelector('#open-case').textContent==='Recover saved spin');await page.emulateMedia({reducedMotion:'reduce'});await page.locator('#open-case').click();await page.locator('#result:not([hidden])').waitFor();assert.equal((await call(uid,'snapshot')).packs.length,savedCount);assert.equal((await call(uid,'snapshot')).account.sparkUnits,0);
  }
  await patch({firstVerifiedDepositAtMs:time});await page.reload();await page.waitForFunction(()=>!document.querySelector('#claim-welcome').disabled);await page.locator('#claim-welcome').click();await page.waitForFunction(()=>document.querySelector('#claim-welcome').textContent==='Case claimed');assert.equal((await call(uid,'snapshot')).packs.length,width===1440?3:2);assert(await page.locator('#claim-welcome').isDisabled());
  await page.evaluate(()=>{RIPPR_ACCOUNT.user=null;RIPPR_ACCOUNT.wallet=null;document.dispatchEvent(new Event('rippr:authchange'))});await page.waitForFunction(()=>document.querySelector('#open-case').textContent==='Log in to earn points');assert.equal(await page.locator('#spark-balance').textContent(),'—');assert(await page.locator('#welcome-result').isHidden());
  await page.locator('#open-case').click();await page.waitForURL(/auth.html\?mode=login&next=/);assert.deepEqual(errors,[]);
  console.log(`PASS rewards wheel ${width}px: responsive layout, authoritative award/odds/points, single redemption, hidden/resize/reduced motion, verified welcome gate and sign-out isolation`);await page.close();
 }}finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
