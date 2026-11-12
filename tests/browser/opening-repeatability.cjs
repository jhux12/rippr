/* Actual motion/foil/audio scripts with isolated, deterministic account awards.
 * These checks exercise lifecycle cleanup; they do not claim a production FPS.
 */
const {chromium}=require('playwright'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../..'),origin='http://localhost:3000';
const types={'.html':'text/html','.js':'application/javascript','.css':'text/css','.svg':'image/svg+xml','.webp':'image/webp','.png':'image/png','.woff2':'font/woff2','.wav':'audio/wav'};
async function setup(browser,width){
  const page=await browser.newPage({viewport:{width,height:900},reducedMotion:'no-preference'}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',route=>{
    const u=new URL(route.request().url());assert.equal(u.origin,origin,'No production requests in animation tests');
    const name=u.pathname.slice(1);
    if(['firebase-client.js','account-state.js','navigation.js','footer.js'].includes(name))return route.fulfill({body:'',contentType:'application/javascript'});
    const target=path.resolve(root,name);assert(target.startsWith(root+path.sep));
    if(!fs.existsSync(target))return route.abort();
    return route.fulfill({body:fs.readFileSync(target),contentType:types[path.extname(target)]||'application/octet-stream'});
  });
  await page.addInitScript(()=>{
    window.fixtureHidden=false;
    Object.defineProperty(document,'hidden',{configurable:true,get:()=>fixtureHidden});
    window.openingFixture={purchases:0,awards:0,contexts:0,soundsPlayed:0};
    const NativeAudio=window.AudioContext||window.webkitAudioContext;
    if(NativeAudio){class CountedAudio extends NativeAudio{constructor(...args){super(...args);openingFixture.contexts++}createBufferSource(){const source=super.createBufferSource(),start=source.start.bind(source);source.start=(...args)=>{if(source.buffer?.duration>.01)openingFixture.soundsPlayed++;return start(...args)};return source}}window.AudioContext=CountedAudio;window.webkitAudioContext=CountedAudio}
    window.RIPPR_ACCOUNT={ready:true,user:{uid:'animation-fixture'},wallet:{balanceCents:100000},items:[]};
    window.RipprFirebase={ready:Promise.resolve(),loadPackContents:async id=>({...RipprCatalog.defaultPack(id),priceCents:199})};
    window.RipprAccount={errorMessage:e=>e.message||'Fixture error',act:async(action,data)=>{
      if(action!=='purchase')throw Error('Unexpected account action in animation fixture: '+action);
      openingFixture.purchases++;const batch=openingFixture.purchases,rarities=['Common','Rare','Ultra rare','Epic','Legendary'];
      const cards=Array.from({length:data.quantity},(_,i)=>({...RipprCatalog.defaultPack('basic').items[0],id:`award-${batch}-${i}`,name:`Opening ${batch} card ${i+1}`,image:'assets/grail-moonstone.svg',valueCents:250,rarity:rarities[(batch+i)%rarities.length],pack:i+1,status:'available'}));
      openingFixture.awards+=cards.length;RIPPR_ACCOUNT.items.push(...cards.map(c=>({...c})));return{cards,totalCents:data.quantity*199};
    }};
  });
  await page.goto(origin+'/opening.html?pack=basic');
  await page.waitForFunction(()=>!document.querySelector('#open').disabled);
  assert.equal(await page.evaluate(()=>matchMedia('(prefers-reduced-motion: reduce)').matches),false);
  return{page,errors};
}
const phase=(page,name)=>page.waitForFunction(expected=>state===expected,name,{timeout:20000});
async function captureNextRevealGeometry(page){
  await page.evaluate(()=>{
    const original=completeCardReveal;
    completeCardReveal=function(instant){
      if(instant)return original(instant);
      const art=document.querySelector('.reveal-art-stage'),before=art.getBoundingClientRect().toJSON();
      const result=original(instant),effect=art.getAnimations().find(a=>!(a instanceof CSSAnimation)&&!(a instanceof CSSTransition));
      if(effect){effect.pause();effect.currentTime=0;openingFixture.geometry={before,after:art.getBoundingClientRect().toJSON()};effect.play()}
      completeCardReveal=original;return result;
    };
  });
}
async function openBatch(page,quantity){
  await page.locator('[data-qty="'+quantity+'"]').click();await page.locator('#open').click();
  await page.locator('#skip-opening:not([hidden])').waitFor();
}
async function rip(page,drag=false){
  await phase(page,'ripping');
  if(drag){
    const r=await page.locator('#rip-foil').boundingBox();assert(r&&r.width>0);
    await page.mouse.move(r.x+r.width*.06,r.y+r.height/2);await page.mouse.down();
    await page.mouse.move(r.x+r.width*.2,r.y+r.height/2,{steps:5});await page.mouse.up();
    assert.equal(await page.locator('#pack-shell').evaluate(el=>el.style.getPropertyValue('--rip')),'0','An incomplete tear resets cleanly');
    await page.mouse.move(r.x+r.width*.06,r.y+r.height/2);await page.mouse.down();
    await page.mouse.move(r.x+r.width*.96,r.y+r.height/2,{steps:18});await page.mouse.up();
  }else await page.locator('#rip-foil').press('Enter');
}
async function keepBatch(page,quantity,{skipRest=false}={}){
  await phase(page,'revealing');
  for(let i=0;i<quantity;i++){
    const winning=await page.evaluate(()=>({rarity:deck[cursor].rarity,actual:document.querySelector('.arena').dataset.revealRarity}));
    assert.equal(winning.actual,winning.rarity,'The reveal lands on this award’s rarity');
    assert.equal(await page.locator('.reveal-front').getAttribute('aria-hidden'),null);
    assert.equal(await page.locator('.reveal-actions').getAttribute('aria-hidden'),null);
    assert(await page.locator('#next').isEnabled());
    await page.locator('#next').click();
    if(i<quantity-1){
      if(skipRest&&i===0){
        await page.waitForFunction(()=>state==='revealing'||!document.querySelector('#skip-opening').hidden);
        if(await page.locator('#skip-opening').isVisible())await page.locator('#skip-opening').click();
      }
      if(!skipRest)await rip(page);
      await phase(page,'revealing');
      if(skipRest)assert(await page.locator('#skip-opening').isHidden(),'Skip applies to the remaining purchased batch');
    }
  }
  await phase(page,'complete');await page.locator('#results.visible').waitFor();
  assert.equal(await page.locator('.result-card').count(),quantity);
  assert.equal(await page.locator('#reveal-stage').evaluate(el=>el.childElementCount),0,'Completed batches release hidden reveal actors');
  assert.equal(await page.locator('#opening-theater').evaluate(el=>el.open),false);
}
async function idleMetrics(page){
  return page.evaluate(()=>{
    const actor=document.querySelector('.arena');
    const scripted=actor.getAnimations({subtree:true}).filter(a=>!(a instanceof CSSAnimation)&&!(a instanceof CSSTransition));
    return{nodes:document.querySelectorAll('*').length,scripted:scripted.length,foilLayers:document.querySelectorAll('.foil-underlay,.foil-cut-edge,.foil-crease').length,stages:document.querySelectorAll('#reveal-stage').length,theaters:document.querySelectorAll('#opening-theater').length,placeholders:document.querySelectorAll('.arena-placeholder').length,stageChildren:document.querySelector('#reveal-stage').childElementCount,pendingPhase:phaseTask!==null,warmedArt:warmedArt.size,contexts:openingFixture.contexts,purchases:openingFixture.purchases,awards:openingFixture.awards};
  });
}
async function again(page,baseline){
  await page.locator('#again').click();await phase(page,'idle');await page.waitForTimeout(80);
  assert(await page.locator('#open').isEnabled());assert(await page.locator('#rip-foil').isHidden());assert(await page.locator('#skip-opening').isHidden());
  const metrics=await idleMetrics(page);
  assert.equal(metrics.scripted,0,'No retained script animations after reset');
  assert.equal(metrics.stageChildren,0,'Reveal actors are discarded after each batch');
  assert.equal(metrics.pendingPhase,false,'No pending opening phase survives reset');assert.equal(metrics.warmedArt,0,'Award decode cache is released after reset');
  assert.equal(metrics.placeholders,0);assert.equal(metrics.stages,1);assert.equal(metrics.theaters,1);
  assert(metrics.contexts<=1,'Repeated opens reuse one audio context');
  if(baseline){assert.equal(metrics.foilLayers,baseline.foilLayers);assert(metrics.nodes<=baseline.nodes+4,'Opening actors do not accumulate in the document')}
  return metrics;
}
(async()=>{
  const browser=await chromium.launch({...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),args:['--no-sandbox']});
  try{for(const width of [320,390,1440]){
    const{page,errors}=await setup(browser,width);let purchases=0,awards=0,baseline;
    // Full motion on representative phone/desktop sizes; small phones also get
    // repeated batch-wide skip/reset cycles with the same real scripts.
    if(width!==320){
      await captureNextRevealGeometry(page);
      for(const quantity of [1,3,5]){
        await openBatch(page,quantity);purchases++;awards+=quantity;await rip(page,quantity===5);await phase(page,'revealing');
        if(quantity===1){const geometry=await page.evaluate(()=>openingFixture.geometry);assert(geometry,'The full-motion reveal uses a compositor transition');for(const key of ['x','y','width','height'])assert(Math.abs(geometry.before[key]-geometry.after[key])<2,'No geometry jump when the revealed card settles: '+key)}
        await keepBatch(page,quantity);baseline=await again(page,baseline);
      }
      assert(await page.evaluate(()=>openingFixture.soundsPlayed>=18),'Real WAV cues start throughout full-motion batches');
      // A hidden tab freezes both the phase and rarity color step, then resumes
      // the same award instead of skipping, replaying or buying another pack.
      await openBatch(page,1);purchases++;awards++;await rip(page);
      await phase(page,'cycling');await page.evaluate(()=>{fixtureHidden=true;document.dispatchEvent(new Event('visibilitychange'))});
      assert.equal(await page.locator('.arena').evaluate(el=>el.getAnimations({subtree:true}).filter(a=>a.playState==='running').length),0,'Hidden-tab arena animations pause');
      const paused=await page.evaluate(()=>({phase:state,color:document.querySelector('.arena').style.getPropertyValue('--reveal-tone'),step:document.querySelector('.arena').dataset.cycleIndex}));
      await page.waitForTimeout(650);
      assert.deepEqual(await page.evaluate(()=>({phase:state,color:document.querySelector('.arena').style.getPropertyValue('--reveal-tone'),step:document.querySelector('.arena').dataset.cycleIndex})),paused);
      await page.evaluate(()=>{fixtureHidden=false;document.dispatchEvent(new Event('visibilitychange'));dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true}))});
      const suspended=await page.evaluate(()=>({phase:state,color:document.querySelector('.arena').style.getPropertyValue('--reveal-tone'),step:document.querySelector('.arena').dataset.cycleIndex}));
      await page.waitForTimeout(350);
      assert.deepEqual(await page.evaluate(()=>({phase:state,color:document.querySelector('.arena').style.getPropertyValue('--reveal-tone'),step:document.querySelector('.arena').dataset.cycleIndex})),suspended,'Page suspension preserves the current phase');
      await page.evaluate(()=>dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true})));await phase(page,'revealing');await keepBatch(page,1);baseline=await again(page,baseline);
    }
    for(const quantity of [1,3,5,5,3,1]){
      await openBatch(page,quantity);purchases++;awards+=quantity;await page.locator('#skip-opening').click();await keepBatch(page,quantity,{skipRest:true});baseline=await again(page,baseline);
    }
    // Skip and reset may happen while a tab is suspended. Returning must resume
    // ambient CSS effects rather than leave the next opening frozen.
    await openBatch(page,3);purchases++;awards+=3;await rip(page);await phase(page,'cycling');
    await page.evaluate(()=>{fixtureHidden=true;document.dispatchEvent(new Event('visibilitychange'))});
    await page.locator('#skip-opening').click();await keepBatch(page,3,{skipRest:true});baseline=await again(page,baseline);
    await page.evaluate(()=>{fixtureHidden=false;document.dispatchEvent(new Event('visibilitychange'))});
    await page.locator('.arena').scrollIntoViewIfNeeded();await page.waitForFunction(()=>!document.querySelector('.arena').classList.contains('is-paused'));
    assert.equal(await page.locator('.arena').evaluate(el=>el.getAnimations({subtree:true}).filter(a=>a instanceof CSSAnimation&&a.playState==='paused').length),0,'Ambient motion resumes after a hidden-tab skip/reset');
    const metrics=await idleMetrics(page);assert.equal(metrics.purchases,purchases);assert.equal(metrics.awards,awards);assert.equal(await page.evaluate(()=>RIPPR_ACCOUNT.items.length),awards);assert.deepEqual(errors,[]);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    console.log(`PASS repeated opening ${width}px: ${purchases} batches/${awards} cards, ${width===320?'batch skip':'real rip/extract/cycle/flip and visibility/page suspension'}, reset restores bounded actors/audio/DOM`);await page.close();
  }}finally{await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
