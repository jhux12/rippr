/* Isolated transient CDN failures; no external API or account mutations. */
const {chromium}=require('playwright'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../..'),origin='http://localhost:3000',cdn='https://assets.tcgdex.net/en/sv/sv03.5/';
const body=fs.readFileSync(path.join(root,'assets/hero/pip-hover.webp'));
const types={'.html':'text/html','.js':'application/javascript','.css':'text/css','.svg':'image/svg+xml','.webp':'image/webp','.png':'image/png','.woff2':'font/woff2','.wav':'audio/wav'};
async function setup(browser,width){
 const page=await browser.newPage({viewport:{width,height:900},reducedMotion:'reduce'}),errors=[],counts=new Map(),urls=[];
 const control={permanent:true,removed:false};page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',route=>{
  const url=new URL(route.request().url());
  if(url.origin==='https://assets.tcgdex.net'){
   urls.push(url.href);const id=url.pathname.split('/').at(-2),count=(counts.get(id)||0)+1;counts.set(id,count);
   if(id==='151'&&count===1)return route.abort('failed');
   if(id==='151'&&count===2)return route.fulfill({status:200,body:'invalid image bytes',contentType:'image/webp'});
   if((id==='152'&&control.permanent)||id==='153')return route.fulfill({status:503,body:'Temporarily unavailable'});
   return route.fulfill({body,contentType:'image/webp'});
  }
  if(url.hostname==='images.example.test'){
   urls.push(url.href);const count=(counts.get('signed')||0)+1;counts.set('signed',count);
   return count===1?route.abort('failed'):route.fulfill({body,contentType:'image/webp'});
  }
  assert.equal(url.origin,origin,'Only local files and intercepted artwork requests are permitted');
  const name=url.pathname.slice(1);
  if(['firebase-client.js','account-state.js','navigation.js','footer.js'].includes(name))return route.fulfill({body:'',contentType:'application/javascript'});
  const target=path.resolve(root,name);assert(target.startsWith(root+path.sep));
  if(!fs.existsSync(target))return route.abort();
  return route.fulfill({body:fs.readFileSync(target),contentType:types[path.extname(target)]||'application/octet-stream'});
 });
 await page.addInitScript(({cdn})=>{
  window.fixtureHidden=false;Object.defineProperty(document,'hidden',{configurable:true,get:()=>fixtureHidden});
  window.RIPPR_ACCOUNT={ready:true,user:{uid:'media-fixture'},wallet:{displayName:'Collector',balanceCents:10000,packsOpened:2,cardsCollected:2,grailsFound:0},items:[],packs:[],shipments:[],activity:[]};
  window.RipprFirebase={ready:Promise.resolve(),loadPackContents:async id=>({...RipprCatalog.defaultPack(id),priceCents:100})};
  window.RipprAccount={refresh:async()=>{},errorMessage:e=>e.message,act:async(action)=>{
   if(action!=='purchase')throw Error('Unexpected account mutation');
   const cards=['151','152'].map((id,i)=>({...RipprCatalog.defaultPack('basic').items[0],id:'imported-'+id,name:'Imported card '+id,image:cdn+id+'/high.webp',valueCents:500,rarity:'Rare',pack:i+1,status:'available'}));
   RIPPR_ACCOUNT.items=cards.map(c=>({...c}));return{cards,totalCents:200};
  }};
 },{cdn});
 return{page,errors,counts,urls,control};
}
(async()=>{
 const browser=await chromium.launch({...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),args:['--no-sandbox']});
 try{
  for(const width of [320,390,1440]){
   const {page,errors,counts,urls,control}=await setup(browser,width);
   await page.goto(origin+'/opening.html?pack=basic');await page.waitForFunction(()=>!document.querySelector('#open').disabled);
   await page.locator('[data-qty="2"]').click();await page.locator('#open').click();await page.locator('#skip-opening:not([hidden])').waitFor();await page.locator('#skip-opening').click();
   await page.waitForFunction(()=>state==='revealing');
   await page.waitForFunction(()=>{const img=document.querySelector('.reveal-front img');return img.naturalWidth>0&&!img.hidden});
   assert(await page.locator('.reveal-art-fallback').isHidden(),'Transient failure recovers without permanent fallback');
   assert(counts.get('151')>=3&&counts.get('151')<=5,'Image retry count is bounded despite warm-cache reads');
   assert.equal(await page.evaluate(()=>deck[0].image),cdn+'151/high.webp','Retries never change the saved award URL');
   await page.locator('#next').click();await page.locator('.reveal-art-fallback:not([hidden])').waitFor();
   assert(await page.locator('#next').isEnabled());assert(await page.locator('#sell-card').isEnabled(),'Artwork failure does not block card actions');
   const failedCount=counts.get('152');await page.waitForTimeout(300);assert.equal(counts.get('152'),failedCount,'Permanent failures stop automatically retrying');
   control.permanent=false;await page.locator('.reveal-art-fallback .artwork-retry').click();
   await page.waitForFunction(()=>{const img=document.querySelector('.reveal-front img');return img.naturalWidth>0&&!img.hidden});assert(await page.locator('.reveal-art-fallback').isHidden());
   await page.locator('#next').click();await page.locator('#results.visible').waitFor();
   assert.equal(await page.locator('.result-card').count(),2);assert.equal(await page.locator('.result-art-fallback').count(),0);
   assert(urls.some(u=>u.includes('_rippr_retry=')),'Only runtime CDN requests receive cache busting');
   // Profile uses the same saved imported cards and preserves its selection while retrying.
   counts.clear();control.permanent=true;
   await page.addInitScript(({cdn})=>{RIPPR_ACCOUNT.items=['151','152'].map(id=>({id:'imported-'+id,name:'Imported card '+id,image:cdn+id+'/high.webp',valueCents:500,rarity:'Rare',status:'available'}))},{cdn});
   await page.goto(origin+'/profile.html');await page.locator('[data-select="imported-151"]').check();
   await page.waitForFunction(()=>{const img=document.querySelector('[data-id="imported-151"] .item-art img');return img.naturalWidth>0&&!img.hidden});
   await page.locator('[data-id="imported-152"] .item-art-note:not([hidden])').waitFor();
   control.permanent=false;await page.locator('[data-id="imported-152"] .artwork-retry').click();
   await page.waitForFunction(()=>{const img=document.querySelector('[data-id="imported-152"] .item-art img');return img.naturalWidth>0&&!img.hidden});
   assert(await page.locator('[data-select="imported-151"]').isChecked());assert(await page.locator('[data-id="imported-152"] .item-art-note').isHidden());
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.deepEqual(errors,[]);
   console.log(`PASS media recovery ${width}px: transient network/decode failures, bounded retries, manual recovery, unchanged awards/actions and profile selection`);await page.close();
  }
  const {page,errors,counts,urls}=await setup(browser,390);
  await page.goto(origin+'/opening.html?pack=basic');
  await page.evaluate(({cdn})=>{
   const img=document.createElement('img');img.id='changing-art';img.src=cdn+'153/high.webp';document.body.append(img);
   window.changingArt=RipprArtwork.watch(img,{onError:()=>{throw Error('Stale source exhausted retries')}});
  },{cdn});
  await page.waitForFunction(()=>document.querySelector('#changing-art').complete);await page.waitForTimeout(80);
  await page.evaluate(({cdn})=>changingArt.load(cdn+'154/high.webp'),{cdn});await page.locator('#changing-art').evaluate(img=>img.decode());
  const before=counts.get('153');await page.waitForTimeout(650);assert.equal(counts.get('153'),before,'Changing sources cancels stale retries');
  await page.evaluate(({cdn})=>{const img=document.createElement('img');img.id='removed-art';img.src=cdn+'153/high.webp';document.body.append(img);RipprArtwork.watch(img)}, {cdn});
  await page.waitForTimeout(80);await page.locator('#removed-art').evaluate(img=>img.remove());
  const removedCount=counts.get('153');await page.waitForTimeout(650);assert.equal(counts.get('153'),removedCount,'Removed artwork leaves no retry work');
  await page.evaluate(()=>{const img=document.createElement('img');img.id='signed-art';img.src='https://images.example.test/card.webp?token=keep-exactly';document.body.append(img);RipprArtwork.watch(img)});
  await page.waitForFunction(()=>document.querySelector('#signed-art').naturalWidth>0);
  assert.deepEqual(urls.filter(u=>u.includes('images.example.test')),[1,2].map(()=>'https://images.example.test/card.webp?token=keep-exactly'),'Signed URLs are never modified');
  await page.evaluate(({cdn})=>{fixtureHidden=true;document.dispatchEvent(new Event('visibilitychange'));const img=document.createElement('img');img.id='hidden-art';img.src=cdn+'151/high.webp';document.body.append(img);RipprArtwork.watch(img)}, {cdn});
  await page.waitForTimeout(700);assert.equal(counts.get('151'),1,'Hidden-tab image retries wait');
  await page.evaluate(()=>{fixtureHidden=false;document.dispatchEvent(new Event('visibilitychange'))});
  await page.waitForFunction(()=>document.querySelector('#hidden-art').naturalWidth>0);assert.equal(counts.get('151'),3);assert.deepEqual(errors,[]);
  console.log('PASS artwork lifecycle: source replacement/removal, signed URL preservation and hidden-tab recovery');await page.close();
 }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
