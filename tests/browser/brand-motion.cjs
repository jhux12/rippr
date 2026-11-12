/* Real shared navigation motion and asynchronous loading/error transitions. */
const {chromium}=require('playwright'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../..'),origin='http://localhost:3000';
const types={'.html':'text/html','.js':'application/javascript','.css':'text/css','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml','.woff2':'font/woff2'};
(async()=>{
 const browser=await chromium.launch({...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),args:['--no-sandbox']});
 try{for(const width of [320,390,1440]){
  const page=await browser.newPage({viewport:{width,height:900},reducedMotion:'no-preference'}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',route=>{
   const url=new URL(route.request().url());assert.equal(url.origin,origin,'Only isolated local fixtures are permitted');const name=url.pathname.slice(1);
   if(['firebase-client.js','account-state.js','app.js','footer.js','auth.js','opening.js'].includes(name))return route.fulfill({body:'',contentType:'application/javascript'});
   const file=path.resolve(root,name);assert(file.startsWith(root+path.sep));if(!fs.existsSync(file))return route.abort();
   return route.fulfill({body:fs.readFileSync(file),contentType:types[path.extname(file)]||'application/octet-stream'});
  });
  await page.addInitScript(()=>{
   window.fixtureHidden=false;Object.defineProperty(document,'hidden',{configurable:true,get:()=>fixtureHidden});
   window.RIPPR_ACCOUNT={ready:false,user:null,wallet:null,items:[],packs:[],shipments:[],activity:[]};
   window.RipprAccount={refresh:async()=>{},errorMessage:e=>e.message};
   window.RipprFirebase={ready:Promise.resolve(),museumAction:()=>new Promise((resolve,reject)=>{window.finishMuseum=resolve;window.failMuseum=reject})};
   window.brandEntrances=[];const animate=Element.prototype.animate;
   Element.prototype.animate=function(frames,options){if(this.matches('.nav-brand svg,.nav-brand span'))brandEntrances.push({tag:this.tagName,duration:options.duration,delay:options.delay||0});return animate.call(this,frames,options)};
  });
  for(const pathname of ['/index.html','/opening.html','/auth.html']){
   await page.goto(origin+pathname,{waitUntil:'domcontentloaded'});await page.evaluate(()=>document.fonts.ready);
   assert.equal(await page.locator('.nav-brand').getAttribute('aria-label'),'rippr home');
   assert.equal(await page.evaluate(()=>brandEntrances.length),2,'Exactly one mark/word entrance per page');
   const before=await page.locator('.nav-shell').boundingBox();
   await page.waitForTimeout(560);
   assert.equal(await page.locator('.nav-brand').evaluate(el=>el.getAnimations({subtree:true}).length),0,'Header rests after its entrance');
   assert.deepEqual(await page.locator('.nav-shell').boundingBox(),before,'Logo motion never expands the header');
  }
  const brand=page.locator('.nav-brand');
  await brand.hover();assert.equal(await brand.evaluate(el=>el.getAnimations({subtree:true}).length),1);
  await brand.evaluate(el=>{for(let i=0;i<30;i++)el.dispatchEvent(new PointerEvent('pointerenter',{pointerType:'mouse'}))});
  assert.equal(await brand.evaluate(el=>el.getAnimations({subtree:true}).length),1,'Rapid interactions do not accumulate effects');
  await page.mouse.move(width-3,140);await page.waitForTimeout(420);
  assert.equal(await brand.evaluate(el=>el.getAnimations({subtree:true}).length),0,'Hover finishes without an idle loop');
  await brand.evaluate(el=>el.dispatchEvent(new PointerEvent('pointerdown',{pointerType:'touch',isPrimary:true,button:0})));
  assert.equal(await brand.evaluate(el=>el.getAnimations({subtree:true}).length),1,'Touch gets the same short accent');
  await page.emulateMedia({reducedMotion:'reduce'});
  assert.equal(await brand.evaluate(el=>el.getAnimations({subtree:true}).length),0,'Changing reduced motion cancels active logo effects');
  await brand.evaluate(el=>el.dispatchEvent(new PointerEvent('pointerenter',{pointerType:'mouse'})));
  assert.equal(await brand.evaluate(el=>el.getAnimations({subtree:true}).length),0);
  await page.emulateMedia({reducedMotion:'no-preference'});assert.equal(await brand.evaluate(el=>el.getAnimations({subtree:true}).length),0,'Disabling reduced motion does not replay the intro');
  await brand.click();await page.waitForURL(origin+'/index.html');
  await page.goto(origin+'/community.html');
  const loading=page.locator('.brand-state--loading');await loading.waitFor();
  const style=await loading.evaluate(el=>{const css=getComputedStyle(el,'::before');return{content:css.content,mask:css.maskImage,animation:css.animationName,width:css.width,left:css.marginLeft,right:css.marginRight}});
  assert.notEqual(style.content,'none');assert(style.mask.includes('data:image/svg+xml'),'Loading uses the vector sparkle');assert.equal(style.animation,'brand-sparkle-breathe');assert.equal(style.width,'28px');assert.equal(style.left,style.right,'Loading sparkle stays centered above its label');
  assert(await loading.locator('img').isHidden(),'Only the sparkle animates in the compact loading panel');
  await page.waitForTimeout(560);await page.screenshot({path:`/tmp/rippr-brand-loading-${width}.png`});
  await page.evaluate(()=>{fixtureHidden=true;document.dispatchEvent(new Event('visibilitychange'))});
  assert.equal(await loading.evaluate(el=>getComputedStyle(el,'::before').animationPlayState),'paused');
  assert.equal(await page.locator('.nav-brand').evaluate(el=>el.getAnimations({subtree:true}).length),0);
  await page.evaluate(()=>{fixtureHidden=false;document.dispatchEvent(new Event('visibilitychange'))});
  assert.equal(await loading.evaluate(el=>getComputedStyle(el,'::before').animationPlayState),'running');
  await page.emulateMedia({reducedMotion:'reduce'});
  assert.equal(await loading.evaluate(el=>getComputedStyle(el,'::before').animationName),'none','Reduced motion keeps a static loading mark');
  await page.evaluate(()=>failMuseum(Error('Fixture unavailable')));await page.locator('[data-retry]').waitFor();assert.equal(await loading.count(),0,'Failed requests stop the loader');
  await page.locator('[data-retry]').click();await loading.waitFor();await page.evaluate(()=>finishMuseum({museums:[],nextCursor:null}));
  await page.getByText('Be the first to open your doors.',{exact:true}).waitFor();assert.equal(await loading.count(),0,'Completed requests stop the loader');
  assert.equal(await page.locator('#community-grid').getAttribute('aria-busy'),'false');
  await page.goto(origin+'/profile.html');assert(await page.locator('#gate-message').evaluate(el=>el.classList.contains('brand-loading')));
  await page.evaluate(()=>{RIPPR_ACCOUNT.ready=true;document.dispatchEvent(new Event('rippr:authchange'))});
  assert.equal(await page.locator('#gate-message').evaluate(el=>el.classList.contains('brand-loading')),false,'Signed-out gate does not pretend to load');
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.deepEqual(errors,[]);
  console.log(`PASS brand motion ${width}px: finite entrance/pulse, native home link, stable header, bounded effects, reduced/hidden motion and loading success/error cleanup`);await page.close();
 }}finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
