const {chromium}=require('playwright'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {randomUUID}=require('node:crypto');const root=path.resolve(__dirname,'../..'),origin='http://localhost:3000';
const types={'.html':'text/html','.js':'application/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.woff2':'font/woff2'};
(async()=>{
 const {accountService}=await import('../../functions/service.js'),{memoryDatabase}=await import('../helpers/memory-database.mjs'),{OWNER_PHONE}=await import('../../src/catalog-model.js'),{defaultRewards,REWARD_COOLDOWN_MS:DAY}=await import('../../src/reward-model.js');
 const browser=await chromium.launch({...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),args:['--no-sandbox']});
 try{for(const width of [320,390,1440]){
  const db=memoryDatabase();let time=Date.now(),counts={},uid='member';const run=accountService(db,{now:()=>time});
  const call=(who,action,data={},operationId=randomUUID())=>run(who,{action,...data,operationId},who==='owner'?{sub:'owner',phone_number:OWNER_PHONE}:{});
  const patch=async data=>db.runTransaction(async tx=>{await tx.get(db.doc('testAccounts/member'));tx.update(db.doc('testAccounts/member'),data)});
  await call(uid,'snapshot');await patch({streakCount:2,lastStreakAtMs:time-DAY});
  let config=(await call('owner','rewardState')).config;
  await call('owner','saveRewards',{config:{...defaultRewards(),testingNoCooldown:false},expectedVersion:config.version});
  const page=await browser.newPage({viewport:{width,height:1000},reducedMotion:width===320?'reduce':'no-preference'}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',route=>{const u=new URL(route.request().url());assert.equal(u.origin,origin);const name=u.pathname.slice(1);if(['firebase-client.js','account-state.js','footer.js','auth.js'].includes(name))return route.fulfill({body:'',contentType:'application/javascript'});const target=path.resolve(root,name);assert(target.startsWith(root+path.sep));if(!fs.existsSync(target))return route.abort();return route.fulfill({body:fs.readFileSync(target),contentType:types[path.extname(target)]||'application/octet-stream'})});
  await page.exposeFunction('fixtureRewards',async(action,data,actor)=>{try{counts[action]=(counts[action]||0)+1;const result=await call(actor,action,data);return{result,snapshot:actor?await call(actor,'snapshot'):null}}catch(e){return{error:{message:e.message,code:e.code}}}});
  await page.addInitScript(()=>{
   window.fixtureHidden=false;Object.defineProperty(document,'hidden',{configurable:true,get:()=>fixtureHidden});
   window.RIPPR_ACCOUNT={ready:true,user:{uid:'member'},wallet:null,items:[],packs:[],shipments:[],activity:[]};
   async function api(action,data={},actor=RIPPR_ACCOUNT.user?.uid||'guest-read'){
    const response=await fixtureRewards(action,data,actor);if(response.error)throw Object.assign(Error(response.error.message),{code:response.error.code});
    if(RIPPR_ACCOUNT.user?.uid===actor&&response.snapshot){RIPPR_ACCOUNT.wallet=response.snapshot.account;RIPPR_ACCOUNT.packs=response.snapshot.packs;RIPPR_ACCOUNT.items=response.snapshot.items}
    return response.result;
   }
   window.RipprFirebase={ready:Promise.resolve(),accountAction:(action,data)=>api(action,data),loadRewardSettings:async()=> (await api('rewardState')).config};
   window.RipprAccount={errorMessage:e=>e.message,act:async(action,data)=>{const actor=RIPPR_ACCOUNT.user?.uid,result=await api(action,data,actor);if(RIPPR_ACCOUNT.user?.uid===actor)document.dispatchEvent(new Event('rippr:walletchange'));return result}};
  });
  await page.goto(origin+'/rewards.html');await page.waitForFunction(()=>!document.querySelector('#open-case').disabled);await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(500);
  assert.equal(await page.locator('.wheel-prize').count(),8);assert.equal(await page.locator('.streak-day').count(),7);assert.equal(await page.locator('.is-earned').count(),2);assert.equal(await page.locator('#claim-streak').textContent(),'Claim day 3');assert(await page.locator('#claim-welcome').isDisabled());
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  const boxes=await page.evaluate(()=>Object.fromEntries(['case-panel','streak-panel','welcome-panel'].map(id=>{const b=document.getElementById(id).getBoundingClientRect();return[id,{top:b.top,bottom:b.bottom,left:b.left,right:b.right}]})));
  if(width<761){assert(boxes['case-panel'].bottom<=boxes['streak-panel'].top);assert(boxes['streak-panel'].bottom<=boxes['welcome-panel'].top)}else assert(boxes['case-panel'].right<=boxes['welcome-panel'].left);
  await page.screenshot({path:`/tmp/rewards-wheel-${width}.png`,fullPage:true});
  config=(await call('owner','rewardState')).config;await call('owner','saveRewards',{config:{enabled:true,testingNoCooldown:false,prizes:[{id:'pack-basic',kind:'pack',packId:'basic',chanceBps:10000}]},expectedVersion:config.version});
  await page.reload();await page.waitForFunction(()=>!document.querySelector('#open-case').disabled);
  await page.locator('#open-case').evaluate(el=>{el.click();el.click()});
  if(width!==320){await page.waitForFunction(()=>document.querySelector('#reward-wheel').getAnimations().length>0);assert.equal((await call(uid,'snapshot')).packs.length,1,'Server saves the prize before wheel animation');
   await page.evaluate(()=>{fixtureHidden=true;document.dispatchEvent(new Event('visibilitychange'))});const before=await page.locator('#reward-wheel').evaluate(el=>el.getAnimations()[0].currentTime);await page.waitForTimeout(250);assert.equal(await page.locator('#reward-wheel').evaluate(el=>el.getAnimations()[0].currentTime),before);await page.setViewportSize({width,height:900});await page.evaluate(()=>{fixtureHidden=false;document.dispatchEvent(new Event('visibilitychange'))});}
  await page.locator('#result:not([hidden])').waitFor();assert((await page.locator('#result').textContent()).includes('Basic pack'));assert.equal(counts.claimReward,1);assert(await page.locator('#open-case').isDisabled());assert.equal(await page.locator('.reward-result-link').getAttribute('href'),'profile.html');assert.equal(await page.locator('#reward-wheel').evaluate(el=>el.getAnimations().length),0);
  await page.locator('#view-prizes').click();await page.locator('#prizes-dialog[open]').waitFor();assert((await page.locator('#reward-grid').textContent()).includes('100% chance'));await page.keyboard.press('Escape');assert.equal(await page.evaluate(()=>document.activeElement.id),'view-prizes');
  await page.locator('#claim-streak').click();await page.waitForFunction(()=>document.querySelector('#streak-title').textContent==='3-day streak');assert(await page.locator('#claim-streak').isDisabled());assert.equal((await call(uid,'snapshot')).account.balanceCents,10);
  await patch({firstVerifiedDepositAtMs:time});await page.reload();await page.waitForFunction(()=>!document.querySelector('#claim-welcome').disabled);await page.locator('#claim-welcome').click();await page.waitForFunction(()=>document.querySelector('#claim-welcome').textContent==='Case claimed');assert.equal((await call(uid,'snapshot')).packs.length,2);assert(await page.locator('#claim-welcome').isDisabled());
  await page.evaluate(()=>{RIPPR_ACCOUNT.user=null;RIPPR_ACCOUNT.wallet=null;document.dispatchEvent(new Event('rippr:authchange'))});await page.waitForFunction(()=>document.querySelector('#open-case').textContent==='Log in to spin');assert.equal(await page.locator('#streak-progress').getAttribute('value'),'0');assert(await page.locator('#welcome-result').isHidden());
  if(width===1440){
   config=(await call('owner','rewardState')).config;await call('owner','saveRewards',{config:{...config,testingNoCooldown:true},expectedVersion:config.version});
   await page.goto(origin+'/rewards.html');await page.waitForFunction(()=>!document.querySelector('#open-case').disabled);await page.locator('#open-case').click();
   await page.waitForFunction(()=>document.querySelector('#reward-wheel').getAnimations().length>0);
   await page.evaluate(()=>{RIPPR_ACCOUNT.user={uid:'other-member'};RIPPR_ACCOUNT.wallet=null;document.dispatchEvent(new Event('rippr:authchange'))});
   await page.waitForFunction(()=>document.querySelector('#open-case').textContent==='Spin now');assert(await page.locator('#result').isHidden());assert.equal((await call('other-member','snapshot')).packs.length,0);assert.equal(await page.locator('#streak-progress').getAttribute('value'),'0');
   await page.evaluate(()=>{RIPPR_ACCOUNT.user=null;RIPPR_ACCOUNT.wallet=null;document.dispatchEvent(new Event('rippr:authchange'))});await page.waitForFunction(()=>document.querySelector('#open-case').textContent==='Log in to spin');
  }
  await page.locator('#open-case').click();await page.waitForURL(/auth.html\?mode=login&next=/);assert.deepEqual(errors,[]);
  console.log(`PASS rewards wheel ${width}px: responsive layout, authoritative award/odds/cooldown, single claim, hidden/resize/reduced motion, streak, verified welcome gate and sign-out isolation`);await page.close();
 }}finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
