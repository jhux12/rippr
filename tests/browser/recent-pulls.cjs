/* Isolated browser fixtures. Feed cards are examples; live services and purchases are blocked. */
const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../..'),origin='http://localhost:3000';
const scripts=new Set(['packs.js','catalog.js','app.js','vending-machine.js','artwork-loader.js','recent-pulls.js']);
const types={'.html':'text/html','.js':'application/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.woff2':'font/woff2'};

(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined,args:['--no-sandbox']});
 try{for(const width of [320,390,768,1440]){
  const page=await browser.newPage({viewport:{width,height:1000},reducedMotion:'reduce'}),errors=[],destinations=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/*',route=>{
   const url=new URL(route.request().url());
   // Remote public art is fulfilled from a local fixture, never fetched from its host.
   if(url.origin==='https://assets.tcgdex.net'){if(page.url().includes('fixture=broken-art'))return route.abort();return route.fulfill({body:fs.readFileSync(path.join(root,'assets/hero/charizard-slab.webp')),contentType:'image/webp'})}
   assert.equal(url.origin,origin,'Recent-pull tests must not contact external services');
   const name=url.pathname.slice(1);
   if(name==='opening.html'){destinations.push(url.href);return route.fulfill({body:'<!doctype html><html><body>Pack page fixture</body></html>',contentType:'text/html'})}
   if(name.endsWith('.js')&&!scripts.has(name))return route.fulfill({body:'',contentType:'application/javascript'});
   const file=path.resolve(root,name);assert(file.startsWith(root+path.sep));
   if(!fs.existsSync(file))return route.abort();
   return route.fulfill({body:fs.readFileSync(file),contentType:types[path.extname(file)]||'application/octet-stream'});
  });
  await page.addInitScript(()=>{
   window.RIPPR_RUNTIME={mode:'live'};window.fixtureMode=new URLSearchParams(location.search).get('fixture')||'normal';
   window.feedReads=[];window.purchaseCalls=0;window.injectionExecuted=false;window.releaseFeed=[];
   window.RipprAccount={act:async()=>{purchaseCalls++;throw Error('Recent pulls must never purchase')}};
   window.makeFeed=(mode='live')=>{
    const names=['Bloodmoon Ursaluna ex · Twilight Masquerade #216 · Holofoil','Charizard ex','Umbreon VMAX','Mewtwo','Pikachu','Gengar','Dragonite','Snorlax','Eevee','Mew','Blastoise','Venusaur'];
    const rarities=['Epic','Legendary','Ultra rare','Rare','Common','Uncommon','Special rare'];
    return names.map((name,index)=>({id:(index+1).toString(16).padStart(64,'0'),name:mode==='test'?'Sandbox '+name:name,image:'https://assets.tcgdex.net/en/sv/sv03.5/'+String(index+1).padStart(3,'0')+'/high.webp',rarity:rarities[index%rarities.length],valueCents:100+index*100,packId:['basic','plus','premium','elite','ultimate','mythic','icy-rush'][index%7],pulledAtMs:Date.now()-index*60000,testOnly:mode==='test',...(index===1?{grading:{company:'PSA',grade:'10'}}:{}),customerUid:'PRIVATE-UID',displayName:'PRIVATE-DISPLAY-NAME',email:'private@example.com'}));
   };
   window.RipprFirebase={
    ready:Promise.resolve(),runtimeMode:()=>RIPPR_RUNTIME.mode,
    loadHomepageGrails:async()=>({source:'firebase',version:1,items:[]}),
    loadPackContents:async id=>({...RipprCatalog.defaultPack(id),source:'firebase',version:2,enabled:true,savedPriceCents:100,priceCents:100}),
    loadRecentPulls:async(options={})=>{
     const mode=RIPPR_RUNTIME.mode,fixture=fixtureMode;feedReads.push({mode,force:options.force===true});
     if(fixture==='held'&&mode==='live')await new Promise(resolve=>releaseFeed.push(resolve));
     if(fixture==='failed')throw Error('Fixture feed unavailable');
     const items=makeFeed(mode);
     if(fixture==='empty')return{mode,source:'firebase',items:[]};
     if(fixture==='wrong-mode')return{mode:'test',source:'firebase',items:makeFeed('test')};
     if(fixture==='default')return{mode,source:'default',items};
     if(fixture==='invalid')return{mode,source:'firebase',items:[items[0],
      {...items[1],id:'f'.repeat(64),name:'Unsafe script image',image:'javascript:window.injectionExecuted=true'},
      {...items[2],id:'e'.repeat(64),name:'Unknown pack card',packId:'made-up-pack'},
      {...items[3],id:'d'.repeat(64),name:'Old card',pulledAtMs:Date.now()-8*86400000},
      {...items[4],id:'c'.repeat(64),name:'Future card',pulledAtMs:Date.now()+86400000},
      {...items[5],id:'b'.repeat(64),name:'Sandbox leak',testOnly:true},
      {...items[6],id:'a'.repeat(64),name:'Unsafe upload image',image:'https://firebasestorage.googleapis.com/v0/b/example/o/profile-images%2Fprivate-user%2Fphoto.png?alt=media'}
     ]};
     if(fixture==='literal')return{mode,source:'firebase',items:[{...items[0],name:'<img src=x onerror="window.injectionExecuted=true">'}]};
     return{mode,source:'firebase',items};
    }
   };
  });
  const section=()=>page.locator('#recent-pulls'),track=()=>page.locator('#recent-pulls-track'),cards=()=>track().locator('[data-recent-pull]');
  async function ready(){await page.waitForFunction(()=>document.querySelector('#recent-pulls-track')?.getAttribute('aria-busy')==='false'||document.querySelector('#recent-pulls')?.getAttribute('aria-busy')==='false')}
  async function home(fixture='normal'){await page.goto(origin+'/index.html?fixture='+fixture);await ready()}

  await home();assert.equal(await cards().count(),12,'A bounded row contains the returned genuine fixture pulls');
  assert(await section().evaluate(el=>{const packs=document.querySelector('#packs'),grails=document.querySelector('.grails');return Boolean(packs.compareDocumentPosition(el)&Node.DOCUMENT_POSITION_FOLLOWING)&&Boolean(el.compareDocumentPosition(grails)&Node.DOCUMENT_POSITION_FOLLOWING)}),'Recent pulls sits after vending and before grails');
  assert.equal(await section().getByText('Epic',{exact:true}).count(),2);assert.equal(await section().getByText('Ultra rare',{exact:true}).count(),2);
  assert(await section().getByText('PSA 10',{exact:true}).isVisible(),'Explicit grading remains visible');
  assert(await section().getByText('Near Mint',{exact:true}).first().isVisible(),'Raw cards use the site condition');
  for(const card of await cards().all()){
   const pack=await card.getAttribute('data-pack-id'),link=card.locator('a[href*="opening.html"]').first();
   const target=new URL(await link.getAttribute('href'),origin);assert.equal(target.origin,origin);assert.equal(target.pathname,'/opening.html');assert.equal(target.searchParams.get('pack'),pack);
   const image=card.locator('img').first();await image.evaluate(img=>{img.loading='eager';return img.decode().catch(()=>{})});const box=await image.boundingBox();assert(box&&box.height>=145,'Card artwork remains legible');
  }
  assert.equal(await section().getByText('Ultra rare',{exact:true}).first().evaluate(el=>getComputedStyle(el).color),'rgb(255, 92, 99)','Ultra rare uses the site red');
  const body=await section().evaluate(el=>el.outerHTML);for(const secret of ['PRIVATE-UID','PRIVATE-DISPLAY-NAME','private@example.com'])assert(!body.includes(secret),'Private metadata is never displayed');
  assert(!(await section().textContent()).includes('Sample pulls'),'There is no sample-activity fallback');
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Document has no horizontal overflow');
  assert(await track().evaluate(el=>el.scrollWidth>el.clientWidth),'The bounded strip scrolls within its own track');
  const firstBox=await cards().first().boundingBox(),trackBox=await track().boundingBox();assert(firstBox.width<trackBox.width,'A next tile is discoverable without vertical stacking');
  for(const selector of ['#recent-pulls-prev','#recent-pulls-next']){const box=await page.locator(selector).boundingBox();assert(box&&box.width>=43.5&&box.height>=43.5,'Carousel controls have44px touch targets')}
  assert(await page.locator('#recent-pulls-prev').isDisabled());await page.locator('#recent-pulls-next').click();await page.waitForFunction(()=>document.querySelector('#recent-pulls-track').scrollLeft>0);
  await page.waitForFunction(()=>!document.querySelector('#recent-pulls-prev').disabled);assert(!(await page.locator('#recent-pulls-prev').isDisabled()));await page.locator('#recent-pulls-prev').click();await page.waitForFunction(()=>document.querySelector('#recent-pulls-track').scrollLeft<2);
  await track().focus();await page.keyboard.press('ArrowRight');await page.waitForFunction(()=>document.querySelector('#recent-pulls-track').scrollLeft>0);
  // Native scrolling/swiping also updates the boundary controls.
  await track().evaluate(el=>{el.scrollLeft=el.scrollWidth;el.dispatchEvent(new Event('scroll'))});await page.waitForFunction(()=>document.querySelector('#recent-pulls-next').disabled);
  await track().evaluate(el=>{el.scrollLeft=0;el.dispatchEvent(new Event('scroll'))});await page.waitForFunction(()=>document.querySelector('#recent-pulls-prev').disabled);
  assert.equal(await page.evaluate(()=>purchaseCalls),0);
  if([390,1440].includes(width)){await section().scrollIntoViewIfNeeded();await section().screenshot({path:'/tmp/rippr-recent-pulls-'+width+'.png'})}
  const reads=await page.evaluate(()=>feedReads.length);await page.clock.install();await page.clock.fastForward(300000);assert.equal(await page.evaluate(()=>feedReads.length),reads,'The feed does not automatically poll or replay activity');await page.clock.resume();

  // An image error leaves a readable card and usable pack link.
  const firstName=await cards().first().textContent();await cards().first().locator('img').first().evaluate(img=>img.dispatchEvent(new Event('error')));assert((await cards().first().textContent()).includes('Bloodmoon Ursaluna'));
  assert(await cards().first().locator('a[href*="pack=basic"]').isVisible());assert.equal(await page.evaluate(()=>purchaseCalls),0);assert(firstName.includes('Bloodmoon Ursaluna'));

  await home('broken-art');await section().scrollIntoViewIfNeeded();await cards().first().locator('img').evaluate(img=>img.loading='eager');await page.waitForFunction(()=>document.querySelector('#recent-pulls-track [data-recent-pull] .recent-pull-art-fallback')&&!document.querySelector('#recent-pulls-track [data-recent-pull] .recent-pull-art-fallback').hidden,{},{timeout:6000});assert(await cards().first().locator('img').isHidden());assert((await cards().first().textContent()).includes('Bloodmoon Ursaluna'));assert(await cards().first().locator('a[href*="pack=basic"]').isVisible());

  await home('empty');assert.equal(await cards().count(),0);assert(await page.locator('#recent-pulls-status').isVisible());assert(!(await page.locator('#recent-pulls-retry').isVisible()));assert(!(await section().textContent()).includes('Sample'));
  await home('failed');assert.equal(await cards().count(),0);assert(await page.locator('#recent-pulls-retry').isVisible());await page.evaluate(()=>fixtureMode='normal');await page.locator('#recent-pulls-retry').click();await page.waitForFunction(()=>document.querySelectorAll('#recent-pulls-track [data-recent-pull]').length===12);assert((await page.evaluate(()=>feedReads)).at(-1).force,'Retry explicitly bypasses a stale cache');

  await home('invalid');assert.equal(await cards().count(),1,'Unsafe, stale, future, unknown-pack and sandbox records are not presented as live pulls');assert.equal(await cards().first().getAttribute('data-pack-id'),'basic');assert.equal(await page.evaluate(()=>injectionExecuted),false);
  await home('literal');assert.equal(await section().locator('img[src="x"]').count(),0);assert.equal(await page.evaluate(()=>injectionExecuted),false,'Card names never become executable markup');
  for(const fixture of ['wrong-mode','default']){await home(fixture);assert.equal(await cards().count(),0,'Unverified source or wrong runtime never becomes public activity')}

  // A previous runtime's unresolved request cannot repopulate the newly selected mode.
  await page.goto(origin+'/index.html?fixture=held');await page.waitForFunction(()=>releaseFeed.length===1);
  const immediatelyAfterSwitch=await page.evaluate(()=>{RIPPR_RUNTIME={mode:'test'};document.dispatchEvent(new CustomEvent('rippr:runtimechange',{detail:RIPPR_RUNTIME}));return document.querySelectorAll('#recent-pulls-track [data-recent-pull]').length});
  assert.equal(immediatelyAfterSwitch,0,'Runtime changes immediately clear old cards');await page.evaluate(()=>releaseFeed.forEach(resolve=>resolve()));await ready();
  const afterSwitch=await section().textContent();assert(!afterSwitch.includes('Bloodmoon Ursaluna')||afterSwitch.includes('Sandbox Bloodmoon Ursaluna'),'Old live results cannot replace test-mode cards');
  if(await cards().count()){assert(afterSwitch.includes('Test pulls'),'Sandbox activity is explicitly labelled');assert((await cards().allTextContents()).every(text=>text.includes('Sandbox')))}
  assert.equal(await page.evaluate(()=>purchaseCalls),0);assert.deepEqual(errors,[]);
  await page.close();console.log('PASS recent pulls '+width+'px: anonymous saved activity, responsive artwork, safe pack links, carousel controls, no polling, honest states, image recovery, source/runtime isolation and zero purchases');
 }}finally{await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
