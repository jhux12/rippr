/* Real opening/foil/audio scripts; deterministic account fixtures never contact live services. */
const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../..'),origin='http://localhost:3000';
const types={'.html':'text/html','.js':'application/javascript','.css':'text/css','.svg':'image/svg+xml','.webp':'image/webp','.png':'image/png','.woff2':'font/woff2','.wav':'audio/wav'};
const phase=(page,value)=>page.waitForFunction(expected=>state===expected,value,{timeout:20000});
const frame=page=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));

async function setup(browser,width){
 const page=await browser.newPage({viewport:{width,height:960},reducedMotion:'no-preference'}),errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 await page.route('**/*',route=>{
  const url=new URL(route.request().url());assert.equal(url.origin,origin,'Tear checks cannot contact live services');
  const name=url.pathname.slice(1);
  if(['firebase-client.js','account-state.js','navigation.js','footer.js','conversion.js','runtime-ui.js'].includes(name))return route.fulfill({body:'',contentType:'application/javascript'});
  const file=path.resolve(root,name);assert(file.startsWith(root+path.sep));if(!fs.existsSync(file))return route.abort();
  return route.fulfill({body:fs.readFileSync(file),contentType:types[path.extname(file)]||'application/octet-stream'});
 });
 await page.addInitScript(()=>{
  window.fixtureHidden=false;Object.defineProperty(document,'hidden',{configurable:true,get:()=>fixtureHidden});
  localStorage.setItem('rippr:opening-muted','true');
  window.tearFixture={purchases:0,awards:0,sales:0};
  window.RIPPR_ACCOUNT={ready:true,mode:'live',user:{uid:'tear-fixture'},wallet:{balanceCents:100000},items:[]};
  window.RipprFirebase={ready:Promise.resolve(),loadPackContents:async id=>({...RipprCatalog.defaultPack(id),priceCents:199})};
  window.RipprAccount={errorMessage:error=>error.message,act:async(action,data)=>{
   if(action==='purchase'){
    const batch=++tearFixture.purchases;
    const cards=Array.from({length:data.quantity},(_,index)=>({...RipprCatalog.defaultPack('basic').items[0],id:`tear-${batch}-${index}`,name:`Foil fixture card ${batch}.${index+1}`,image:'assets/hero/charizard-slab.webp',rarity:index%2?'Ultra rare':'Legendary',grading:index%2?undefined:{company:'PSA',grade:'10'},valueCents:250,pack:index+1,status:'available'}));
    tearFixture.awards+=cards.length;RIPPR_ACCOUNT.items.push(...cards.map(card=>({...card})));return{cards,totalCents:data.quantity*199};
   }
   if(action==='sell'){
    const item=RIPPR_ACCOUNT.items.find(item=>item.id===data.itemIds[0]);if(!item||item.status!=='available')throw Error('Fixture item unavailable');
    tearFixture.sales++;item.status='sold';return{soldCents:item.valueCents,count:1};
   }
   throw Error('Unexpected account action: '+action);
  }};
 });
 await page.goto(origin+'/opening.html?pack=basic');await page.waitForFunction(()=>!document.querySelector('#open').disabled);
 return{page,errors};
}
async function open(page,count=1){
 await page.locator(`[data-qty="${count}"]`).click();await page.locator('#open').click();await phase(page,'ripping');
 return page.locator('#rip-foil').boundingBox();
}
async function down(page,box,direction=1){
 const x=box.x+box.width*(direction===1?.05:.95),y=box.y+box.height/2;
 await page.mouse.move(x,y);await page.mouse.down();return{x,y};
}
async function drag(page,start,box,fraction,direction=1){
 await page.mouse.move(start.x+direction*box.width*fraction,start.y,{steps:8});await frame(page);
}
async function metric(page){
 return page.evaluate(()=>{
  const arena=document.querySelector('.arena'),shell=document.querySelector('#pack-shell');
  return{arena:arena.getBoundingClientRect().toJSON(),shell:shell.getBoundingClientRect().toJSON(),nodes:document.querySelectorAll('*').length,layers:shell.querySelectorAll('.foil-underlay,.foil-cut-edge,.foil-crease,.foil-mouth,.foil-inner-lip').length,effects:arena.getAnimations({subtree:true}).filter(effect=>!(effect instanceof CSSAnimation)&&!(effect instanceof CSSTransition)).length,phase:state,pending:phaseTask!==null,warmed:warmedArt.size};
 });
}
async function reset(page,baseline){
 await phase(page,'complete');await page.locator('#again').click();await phase(page,'idle');await frame(page);
 const result=await metric(page);
 assert.equal(result.effects,0,'No scripted effects survive a completed opening');assert.equal(result.pending,false);assert.equal(result.warmed,0);
 assert.equal(await page.locator('#reveal-stage').evaluate(el=>el.childElementCount),0);assert.equal(await page.locator('.arena-placeholder').count(),0);
 assert.equal(await page.locator('#opening-theater').evaluate(el=>el.open),false);assert(await page.locator('#open').isEnabled());
 assert.equal(await page.locator('#pack-shell').evaluate(el=>el.style.getPropertyValue('--rip')),'0');
 assert.equal(await page.locator('#pack-shell').evaluate(el=>el.style.getPropertyValue('--foil-progress')),'0');
 if(baseline){assert.equal(result.layers,baseline.layers,'Foil layers mount once');assert(result.nodes<=baseline.nodes+3,'Repeated opens retain a bounded DOM')}
 return result;
}
async function keep(page,count){
 for(let index=0;index<count;index++){
  await phase(page,'revealing');assert.equal(await page.locator('#next').textContent(),'Add to inventory');assert(await page.locator('#next').isEnabled());
  assert.equal(await page.locator('.arena').getAttribute('data-reveal-rarity'),await page.evaluate(()=>deck[cursor].rarity));
  assert.equal(await page.locator('.reveal-front').getAttribute('aria-hidden'),null);
  await page.locator('#next').click();
 }
 await phase(page,'complete');assert.equal(await page.locator('.result-card').count(),count);
}
async function screenshot(page,label,width,atMs){
 if(![390,1440].includes(width))return;
 await page.evaluate(({at,partial})=>{
  if(partial){window.tearScreenshotEffects=document.querySelector('.arena').getAnimations({subtree:true}).filter(effect=>effect.playState==='running');for(const effect of tearScreenshotEffects)effect.pause()}
  else{fixtureHidden=true;document.dispatchEvent(new Event('visibilitychange'))}
  if(at!==undefined)for(const effect of document.querySelector('.arena').getAnimations({subtree:true})){
   const node=effect.effect?.target;
   if(node?.matches('.foil-piece,.foil-underlay,.pack.artwork,.foil-mouth,.foil-inner-lip,.foil-cut-edge,.reveal-art-stage'))effect.currentTime=at;
  }
 },{at:atMs,partial:label==='partial'});
 await page.screenshot({path:`/tmp/rippr-foil-${label}-${width}.png`});
 await page.evaluate(partial=>{if(partial){for(const effect of tearScreenshotEffects||[])if(effect.playState==='paused'&&effect.effect?.target?.isConnected)effect.play();delete window.tearScreenshotEffects}else{fixtureHidden=false;document.dispatchEvent(new Event('visibilitychange'))}},label==='partial');
}

(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined,args:['--no-sandbox']});
 const widths=process.env.FOIL_TEST_WIDTHS?process.env.FOIL_TEST_WIDTHS.split(',').map(Number):[320,390,768,1440];
 try{for(const width of widths){
  const{page,errors}=await setup(browser,width);let baseline,purchases=0,awards=0;
  // A complete physical tear supports either grip, resets canceled gestures and leaves layout fixed.
  let box=await open(page);purchases++;awards++;
  assert.equal(await page.locator('.foil-mouth').count(),1);assert.equal(await page.locator('.foil-inner-lip').count(),1);
  const before=await metric(page),intact=await page.locator('.pack.artwork').evaluate(el=>getComputedStyle(el).clipPath);
  let start=await down(page,box);await page.mouse.move(start.x+2,start.y+32,{steps:5});await frame(page);assert.equal(await page.evaluate(()=>progress),0,'Vertical movement does not start a horizontal tear');await drag(page,start,box,.24);
  let partial=await page.evaluate(()=>({progress,clip:document.querySelector('.pack.artwork').style.clipPath,curl:getComputedStyle(document.querySelector('.foil-piece')).transform,mouthOpacity:Number(getComputedStyle(document.querySelector('.foil-mouth')).opacity)}));
  assert(partial.progress>0&&partial.progress<.86);assert.notEqual(partial.clip,intact);assert.notEqual(partial.curl,'none');assert(partial.mouthOpacity>0,'An opened foil mouth has visible depth');
  const during=await metric(page);for(const key of ['x','y','width','height']){assert(Math.abs(before.arena[key]-during.arena[key])<1.1,'Drag does not resize/reposition arena');assert(Math.abs(before.shell[key]-during.shell[key])<1.1,'Grip never moves the centered outer shell')}
  // A second contact is ignored; traveling back reduces progress without reversing the hinge.
  await page.evaluate(()=>{const button=document.querySelector('#rip-foil'),id=drag.id;button.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,pointerId:999,isPrimary:false,pointerType:'touch',clientX:0,clientY:0}));button.dispatchEvent(new PointerEvent('pointermove',{bubbles:true,pointerId:999,isPrimary:false,pointerType:'touch',clientX:1000,clientY:0}));if(drag.id!==id)throw Error('A second contact stole the active tear')});
  assert.equal(await page.evaluate(()=>progress),partial.progress);
  const locked=await page.locator('#pack-shell').getAttribute('data-foil-direction');await drag(page,start,box,.11);assert(await page.evaluate(()=>progress)<partial.progress);assert.equal(await page.locator('#pack-shell').getAttribute('data-foil-direction'),locked);
  await page.mouse.up();await page.waitForFunction(()=>progress===0);assert.equal(await page.evaluate(()=>state),'ripping');
  start=await down(page,box,-1);await drag(page,start,box,.35,-1);assert.equal(await page.locator('#pack-shell').getAttribute('data-foil-direction'),'left');
  await screenshot(page,'partial',width);
  const canceled=await page.evaluate(()=>{document.querySelector('#rip-foil').dispatchEvent(new PointerEvent('pointercancel',{bubbles:true,pointerId:drag.id,pointerType:'mouse'}));return{progress,state,drag}});assert.equal(canceled.progress,0,'Pointer cancellation clears progress: '+JSON.stringify(canceled));await page.mouse.up();await page.waitForFunction(()=>progress===0);
  start=await down(page,box);await drag(page,start,box,.22);await page.evaluate(()=>document.querySelector('#rip-foil').releasePointerCapture(drag.id));await page.mouse.move(start.x+box.width*.23,start.y);await page.waitForFunction(()=>progress===0);await page.mouse.up();assert.equal(await page.evaluate(()=>state),'ripping');
  start=await down(page,box);await drag(page,start,box,.2);await page.evaluate(()=>{fixtureHidden=true;document.dispatchEvent(new Event('visibilitychange'))});await page.mouse.up();assert.equal(await page.evaluate(()=>progress),0,'Hiding the page releases a live grip');await page.evaluate(()=>{fixtureHidden=false;document.dispatchEvent(new Event('visibilitychange'))});
  start=await down(page,box);await drag(page,start,box,.94);await page.mouse.up();await phase(page,'unsealing');
  await screenshot(page,'release',width,180);await phase(page,'extracting');await screenshot(page,'extraction',width,350);
  await phase(page,'revealing');assert.equal(await page.locator('.reveal-rarity .condition-badge').textContent(),'PSA 10');
  assert(await page.locator('#opening-mute').isVisible());await page.locator('#opening-mute').click();await page.waitForFunction(()=>document.querySelector('#opening-mute').getAttribute('aria-label')==='Mute sound');await page.locator('#opening-mute').click();assert.equal(await page.locator('#opening-mute').getAttribute('aria-pressed'),'true');
  await keep(page,1);baseline=await reset(page);

  // Keyboard tearing remains accessible; skipping unseal cancels the old callback.
  box=await open(page);purchases++;awards++;
  await page.locator('#rip-foil').press('ArrowRight');assert(await page.evaluate(()=>progress)>0);await page.locator('#rip-foil').press('ArrowLeft');assert.equal(await page.evaluate(()=>progress),0);
  await page.locator('#rip-foil').press('Enter');await phase(page,'unsealing');await page.locator('#rip-foil').dispatchEvent('click',{detail:0});
  await page.locator('#skip-opening').click();await phase(page,'revealing');assert.equal(await page.evaluate(()=>drag),null);await keep(page,1);baseline=await reset(page,baseline);await page.waitForTimeout(550);assert.equal(await page.evaluate(()=>state),'idle','Old foil-release callbacks cannot revive a reset opening');

  // A skip while holding the seal applies to all five purchased cards.
  box=await open(page,5);purchases++;awards+=5;start=await down(page,box);await drag(page,start,box,.3);
  await page.locator('#skip-opening').evaluate(button=>button.click());await page.mouse.up();await phase(page,'revealing');
  assert.equal(await page.evaluate(()=>drag),null);for(let index=0;index<5;index++){await phase(page,'revealing');assert(await page.locator('#skip-opening').isHidden());await page.locator('#next').click()}
  await phase(page,'complete');assert.equal(await page.locator('.result-card').count(),5);baseline=await reset(page,baseline);

  // Reduced motion resolves directly and keeps the existing sell disposition.
  await page.emulateMedia({reducedMotion:'reduce'});box=await open(page);purchases++;awards++;
  await page.locator('#rip-foil').press('Enter');await phase(page,'revealing');assert.equal(await page.locator('.foil-piece').evaluate(el=>Number(getComputedStyle(el).opacity)),0);
  await page.locator('#sell-card').click();await page.locator('#confirm-reveal-sale').click();await phase(page,'complete');assert.equal(await page.locator('.result-card[data-status=sold]').count(),1);assert.equal(await page.evaluate(()=>tearFixture.sales),1);baseline=await reset(page,baseline);
  if(width===390){
   await page.emulateMedia({reducedMotion:'no-preference'});
   for(const unavailable of ['missing','throwing']){
    await open(page);purchases++;awards++;
    await page.evaluate(kind=>{tearFixture.nativeAnimate=Element.prototype.animate;Element.prototype.animate=kind==='missing'?undefined:function(){throw Error('Fixture animation API failure')}},unavailable);
    await page.locator('#rip-foil').press('Enter');await phase(page,'revealing');assert(await page.locator('#next').isEnabled(),'A failed compositor never strands an already awarded card');
    await keep(page,1);await page.evaluate(()=>{Element.prototype.animate=tearFixture.nativeAnimate;delete tearFixture.nativeAnimate});baseline=await reset(page,baseline);
   }
   await open(page);purchases++;awards++;await page.locator('#rip-foil').press('Enter');await phase(page,'unsealing');
   await page.emulateMedia({reducedMotion:'reduce'});await page.waitForFunction(()=>state==='revealing',null,{timeout:1500});assert.equal(await page.locator('.foil-piece').evaluate(el=>Number(getComputedStyle(el).opacity)),0,'Changing motion preference finishes the detached seal');await keep(page,1);baseline=await reset(page,baseline);
  }
  const actual=await page.evaluate(()=>({...tearFixture,items:RIPPR_ACCOUNT.items.length}));assert.equal(actual.purchases,purchases);assert.equal(actual.awards,awards);assert.equal(actual.items,awards);assert.deepEqual(errors,[]);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.close();console.log(`PASS physical foil ${width}px: bidirectional grip/return/cancel, fixed stage, single release, keyboard, batch5 skip, grade/sale/mute, reduced motion and bounded repeated actors`);
 }}finally{await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
