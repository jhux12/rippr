/* Full-width hero layout and carousel behavior with every live service blocked. */
const {chromium}=require('playwright'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../..'),origin='http://localhost:3000';
const allowed=new Set(['packs.js','catalog.js','app.js','vending-machine.js','recent-pulls.js','artwork-loader.js']);
const types={'.html':'text/html','.js':'application/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.woff2':'font/woff2'};
const slides=[
 ['signature','Your next great pull.','#packs'],
 ['daily-discovery','A little spark. More discovery.','rewards.html'],
 ['grail-gallery','Find your next favorite.','#grails-title'],
 ['community','A collection worth sharing.','community.html'],
 ['icy-rush','Meet Icy Rush.','#packs']
];
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined,args:['--no-sandbox']});
 try{for(const width of [320,390,768,1440,1920]){
  const p=await browser.newPage({viewport:{width,height:1000},reducedMotion:'reduce'}),errors=[];
  p.on('pageerror',error=>errors.push(error.message));
  await p.route('**/*',route=>{
   const u=new URL(route.request().url());assert.equal(u.origin,origin,'Hero checks must not contact live services');
   const name=u.pathname.slice(1);if(name.endsWith('.js')&&!allowed.has(name))return route.fulfill({body:'',contentType:'application/javascript'});
   const file=path.resolve(root,name);assert(file.startsWith(root+path.sep));if(!fs.existsSync(file))return route.abort();
   return route.fulfill({body:fs.readFileSync(file),contentType:types[path.extname(file)]||'application/octet-stream'});
  });
  await p.addInitScript(()=>{
   window.RIPPR_RUNTIME={mode:'live'};window.purchaseCalls=0;
   window.RipprAccount={act:async()=>{purchaseCalls++;throw Error('Hero actions never purchase')}};
   window.RipprFirebase={loadHomepageGrails:async()=>({source:'firebase',version:1,items:[]}),loadRecentPulls:async()=>({source:'firebase',mode:'live',items:[]}),loadPackContents:async id=>({...RipprCatalog.defaultPack(id),source:'firebase',version:2,enabled:true,savedPriceCents:100,priceCents:100})};
  });
  await p.goto(origin+'/index.html');await p.waitForFunction(()=>document.querySelector('#hero-dots')?.children.length===5&&document.querySelector('#pack-carousel')?.getAttribute('aria-busy')==='false');
  await p.evaluate(()=>document.fonts.ready);
  const hero=p.locator('.home-hero'),dots=p.locator('#hero-dots button');
  assert.equal(await p.locator('main').count(),1,'One main landmark contains hero and regular content');
  assert.equal(await hero.count(),1);assert.equal(await dots.count(),5);
  const initialHeight=(await hero.boundingBox()).height;
  for(let index=0;index<slides.length;index++){
   await dots.nth(index).click();const [scene,title,href]=slides[index];
   assert.equal(await hero.getAttribute('data-hero'),scene);assert.equal(await p.locator('#hero-title').textContent(),title);assert.equal(await p.locator('#hero-cta').getAttribute('href'),href);
   assert.equal(await hero.locator('.hero-scene:not([hidden])').count(),1);assert.equal(await dots.nth(index).getAttribute('aria-pressed'),'true');
   await hero.locator('.hero-scene:not([hidden]) img').evaluateAll(images=>Promise.all(images.map(img=>img.decode().catch(()=>{}))));
   const geometry=await p.evaluate(()=>{
    const rect=selector=>{const r=document.querySelector(selector).getBoundingClientRect();return{left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height}};
    const hero=rect('.home-hero'),art=rect('.home-hero .hero-scenes'),copy=rect('.home-hero .hero-copy'),title=rect('#hero-title'),cta=rect('#hero-cta'),controls=rect('.hero-controls'),regular=rect('.home-content');
    return{hero,art,copy,title,cta,controls,regular,viewport:document.documentElement.clientWidth,overflow:document.documentElement.scrollWidth>innerWidth,borderRadius:getComputedStyle(document.querySelector('.home-hero')).borderRadius};
   });
   assert(Math.abs(geometry.hero.left)<1&&Math.abs(geometry.hero.right-geometry.viewport)<1.1,'Hero spans available viewport width: '+width+' / '+scene);
   assert.equal(geometry.borderRadius,'0px','Full-width hero is not an inset rounded card');assert(!geometry.overflow,'No horizontal document overflow');
   assert(Math.abs(geometry.hero.height-initialHeight)<1.1,'Carousel height remains stable between scenes');
   assert(geometry.hero.height<=440,'Hero remains compact enough to reveal page content');
   assert(geometry.title.left>=geometry.hero.left+10&&geometry.title.right<=geometry.art.left+2,'Copy has its own readable area away from artwork');
   assert(geometry.title.bottom<=geometry.cta.top+1,'Heading and CTA never overlap');
   assert(geometry.cta.left>=geometry.hero.left+10&&geometry.cta.right<=geometry.art.left+2,'CTA fits the readable copy column: '+width+' / '+scene+' / '+JSON.stringify(geometry));
   assert(geometry.cta.bottom<=geometry.controls.top+1,'CTA clears carousel controls');
   assert(geometry.art.left>=geometry.hero.left-1.1&&geometry.art.right<=geometry.hero.right+1.1&&geometry.art.top>=geometry.hero.top-1.1&&geometry.art.bottom<=geometry.controls.top+1.1,'Artwork stage fits inside the hero: '+width+' / '+scene+' / '+JSON.stringify(geometry));
   assert(geometry.art.width>=110&&geometry.art.height>=110,'Artwork remains substantial at every width');
   assert(geometry.regular.left>0&&geometry.regular.width<geometry.hero.width,'Vending/recent pulls remain in their existing constrained content column');
   if(width>=1440)assert(geometry.regular.width<=1197,'Desktop content retains its established max width');
   for(const selector of ['#hero-previous','#hero-next','#hero-rotation','#hero-cta']){
    const r=await p.locator(selector).boundingBox();assert(r&&r.width>=43.5&&r.height>=43.5,'Primary touch control is44px: '+selector);
   }
   for(const dot of await dots.all()){const r=await dot.boundingBox();assert(r&&r.width>=23.5&&r.height>=43.5,'Dot has44px height and24px minimum width')}
   if([390,1440].includes(width)&&[0,2,3].includes(index)){
    await p.evaluate(()=>scrollTo(0,0));await p.screenshot({path:'/tmp/rippr-home-hero-'+scene+'-'+width+'.png',clip:{x:0,y:0,width,height:Math.min(760,Math.ceil(geometry.hero.bottom+180))}});
   }
  }
  await p.locator('#hero-next').click();assert.equal(await hero.getAttribute('data-hero'),'signature','Next wraps to first scene');
  await p.locator('#hero-previous').click();assert.equal(await hero.getAttribute('data-hero'),'icy-rush','Previous wraps to last scene');
  await p.locator('#hero-cta').click();assert.equal(await p.locator('[data-collection=limited]').getAttribute('aria-pressed'),'true','Limited CTA still chooses the Limited collection');
  assert.equal(await p.locator('.vending-slot').count(),1);await p.locator('[data-collection=core]').click();
  await dots.nth(0).click();await p.locator('#hero-cta').focus();await p.keyboard.press('ArrowRight');assert.equal(await hero.getAttribute('data-hero'),'daily-discovery');await p.keyboard.press('ArrowLeft');assert.equal(await hero.getAttribute('data-hero'),'signature');
  await hero.evaluate(el=>{
   const fire=(name,field,x,y)=>{const event=new Event(name);Object.defineProperty(event,field,{value:[{clientX:x,clientY:y}]});el.dispatchEvent(event)};
   fire('touchstart','touches',240,100);fire('touchend','changedTouches',170,105);
  });assert.equal(await hero.getAttribute('data-hero'),'daily-discovery','Horizontal swipe advances carousel');
  await hero.evaluate(el=>{
   const fire=(name,field,x,y)=>{const event=new Event(name);Object.defineProperty(event,field,{value:[{clientX:x,clientY:y}]});el.dispatchEvent(event)};
   fire('touchstart','touches',200,100);fire('touchend','changedTouches',205,180);
  });assert.equal(await hero.getAttribute('data-hero'),'daily-discovery','Vertical swipe preserves page scrolling');
  assert.equal(await p.locator('#hero-rotation').textContent(),'Play','Manual selection pauses rotation');
  // Normal-motion rotation and pause remain operational after the layout change.
  await p.emulateMedia({reducedMotion:'no-preference'});await p.clock.install();await p.mouse.move(width-2,950);await p.locator('#hero-rotation').evaluate(button=>button.click());
  await p.clock.fastForward(6600);assert.equal(await hero.getAttribute('data-hero'),'grail-gallery','Play advances after interval');
  await p.locator('#hero-rotation').evaluate(button=>button.click());const paused=await hero.getAttribute('data-hero');await p.clock.fastForward(14000);assert.equal(await hero.getAttribute('data-hero'),paused,'Pause stops automatic rotation');
  await p.emulateMedia({reducedMotion:'reduce'});assert.equal(await p.locator('#hero-rotation').textContent(),'Play');assert.equal(await p.evaluate(()=>purchaseCalls),0);assert.deepEqual(errors,[]);
  await p.close();console.log('PASS full-width homepage hero '+width+'px: all5scenes, viewport geometry, retained content width, readable CTA/art, touch targets, native links, keyboard/swipe, pause/play and no purchases');
 }}finally{await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
