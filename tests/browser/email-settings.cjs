const {chromium}=require('playwright'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../..'),origin='http://localhost:3000';
(async()=>{const browser=await chromium.launch({...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),args:['--no-sandbox']});try{for(const width of [320,390,1440]){
 const page=await browser.newPage({viewport:{width,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',route=>{const u=new URL(route.request().url());assert.equal(u.origin,origin);const name=u.pathname.slice(1);if(['firebase-client.js','account-state.js','navigation.js','footer.js'].includes(name))return route.fulfill({body:'',contentType:'application/javascript'});const file=path.resolve(root,name);assert(file.startsWith(root+path.sep));return route.fulfill({body:fs.readFileSync(file),contentType:({'.html':'text/html','.js':'application/javascript','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.webp':'image/webp','.woff2':'font/woff2'})[path.extname(file)]||'application/octet-stream'})});
 await page.addInitScript(()=>{
  window.calls=[];window.failEmail=false;window.RIPPR_ACCOUNT={ready:true,user:{uid:'alex'},wallet:{displayName:'Alex',emailForUpdates:'alex@example.test',preferences:{}}};
  window.RipprFirebase={cancelPhoneChange(){}};
  window.RipprAccount={errorMessage:e=>e.message,refresh:async()=>{},act:async(action,data={})=>{calls.push({action,data});if(failEmail)throw{code:'functions/failed-precondition',message:'Email delivery is not configured yet. Your address has been saved.'};if(action==='settings')Object.assign(RIPPR_ACCOUNT.wallet,data);if(action==='confirmEmailVerification'){RIPPR_ACCOUNT.wallet.verifiedEmailForUpdates=RIPPR_ACCOUNT.wallet.emailForUpdates;RIPPR_ACCOUNT.wallet.emailVerifiedAtMs=Date.now()}document.dispatchEvent(new Event('rippr:walletchange'));return action==='requestEmailVerification'?{queued:true}:{verified:true}}};
 });
 await page.goto(origin+'/account-settings.html');await page.locator('#verify-updates-email:not([hidden])').waitFor();await page.locator('#verify-updates-email').click();await page.waitForFunction(()=>document.querySelector('#profile-save-status').textContent.includes('queued'));
 await page.evaluate(()=>failEmail=true);await page.locator('#verify-updates-email').click();await page.locator('#profile-save-status.is-error').waitFor();assert((await page.locator('#profile-save-status').textContent()).includes('not configured'));
 await page.goto(origin+'/account-settings.html?verifyEmail='+'a'.repeat(64));await page.waitForFunction(()=>document.querySelector('#profile-save-status').textContent.includes('Email confirmed.'));
 assert(!page.url().includes('verifyEmail'));assert.equal(await page.evaluate(()=>sessionStorage.getItem('rippr:verify-email')),null);assert(await page.locator('#verify-updates-email').isHidden());
 assert.equal(await page.evaluate(()=>calls.filter(c=>c.action==='confirmEmailVerification').length),1);
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.deepEqual(errors,[]);
 await page.screenshot({path:'/tmp/rippr-email-settings-'+width+'.png',fullPage:true});console.log('PASS email confirmation '+width+'px: request, disabled-provider message, single confirmation, clean URL and no overflow');await page.close();
 }}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
