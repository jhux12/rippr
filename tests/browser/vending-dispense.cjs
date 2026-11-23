/* Isolated browser fixtures: vending motion never charges or opens a pack. */
const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../..'),origin='http://localhost:3000';
const types={'.html':'text/html','.js':'application/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.woff2':'font/woff2'};
const browserScripts=new Set(['packs.js','catalog.js','app.js','vending-machine.js']);

(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined,args:['--no-sandbox']});
 try{
  for(const width of [320,390,768,1440]){
   const page=await browser.newPage({viewport:{width,height:1000},reducedMotion:'no-preference'});
   const errors=[],visits=[];
   page.on('pageerror',error=>errors.push(error.message));
   await page.route('**/*',async route=>{
    const url=new URL(route.request().url());
    assert.equal(url.origin,origin,'Vending fixtures cannot contact live services');
    const name=url.pathname.slice(1);
    if(name==='opening.html'){
     if(route.request().isNavigationRequest())visits.push(url.href);
     return route.fulfill({body:'<!doctype html><html lang="en"><head><title>Pack destination fixture</title></head><body><h1>Pack destination fixture</h1></body></html>',contentType:'text/html'});
    }
    if(name.startsWith('assets/packs/')&&page.url().includes('fixture=broken-art'))return route.abort();
    if(name.endsWith('.js')&&!browserScripts.has(name))return route.fulfill({body:'',contentType:'application/javascript'});
    const file=path.resolve(root,name);
    assert(file.startsWith(root+path.sep),'Fixture paths stay within repository');
    if(!fs.existsSync(file))return route.abort();
    return route.fulfill({body:fs.readFileSync(file),contentType:types[path.extname(file)]||'application/octet-stream'});
   });
   await page.addInitScript(()=>{
    window.fixtureMode=new URLSearchParams(location.search).get('fixture')||'normal';
    if(fixtureMode==='no-waapi')Element.prototype.animate=undefined;
    if(fixtureMode==='throw-waapi')Element.prototype.animate=function(){throw Error('Fixture animation engine failure')};
    window.purchaseCalls=0;window.RIPPR_RUNTIME={mode:'live'};
    window.RipprAccount={act:async()=>{purchaseCalls++;throw Error('Vending navigation must not purchase')}};
    window.RipprFirebase={loadHomepageGrails:async()=>({version:1,source:'firebase',items:[]}),loadPackContents:async id=>{
     const prices={basic:100,plus:500,premium:1000,elite:2500,ultimate:5000,mythic:10000,'icy-rush':1500};
     return{...RipprCatalog.defaultPack(id),source:'firebase',version:3,enabled:fixtureMode!=='disabled',priceCents:prices[id],savedPriceCents:prices[id]};
    }};
   });
   const machine=()=>page.locator('.vending-machine'),view=()=>page.locator('#vending-view-pack');
   async function home(fixture='normal'){
    await page.goto(origin+'/index.html?fixture='+fixture);
    await page.waitForFunction(()=>document.querySelector('.vending-machine')?.getAttribute('aria-busy')==='false');
    await page.locator('#packs').scrollIntoViewIfNeeded();
   }
   async function select(id,quantity=1){
    await page.locator('.vending-slot[data-vending-pack="'+id+'"]').click();
    while(!(await page.locator('#vending-minus').isDisabled()))await page.locator('#vending-minus').click();
    for(let n=1;n<quantity;n++)await page.locator('#vending-plus').click();
    const selected=page.locator('.vending-slot[aria-pressed="true"]');
    assert.equal(await selected.getAttribute('data-vending-pack'),id);
    assert.equal(await machine().evaluate(el=>el.style.getPropertyValue('--vending-accent')),await page.evaluate(id=>RIPPR_PACKS.find(pack=>pack.id===id).accent,id));
   }
   function assertDestination(index,id,quantity){
    const url=new URL(visits[index]);
    assert.equal(url.pathname,'/opening.html');assert.equal(url.searchParams.get('pack'),id);assert.equal(url.searchParams.get('quantity'),String(quantity));
   }

   await home();await select('plus',3);
   // User intent with modifiers/new-tab semantics must keep native link behavior.
   const nativeResults=await view().evaluate(link=>{
    const results=[];
    for(const flags of [{ctrlKey:true},{metaKey:true},{shiftKey:true},{altKey:true},{button:1},{target:'_blank'}]){
     if(flags.target)link.target=flags.target;
     const listener=event=>{results.push({prevented:event.defaultPrevented,busy:document.querySelector('.vending-machine').classList.contains('is-dispensing')});event.preventDefault()};
     window.addEventListener('click',listener,{once:true});
     link.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,button:flags.button||0,ctrlKey:Boolean(flags.ctrlKey),metaKey:Boolean(flags.metaKey),shiftKey:Boolean(flags.shiftKey),altKey:Boolean(flags.altKey)}));
     link.removeAttribute('target');
    }
    return results;
   });
   assert.equal(nativeResults.length,6);assert(nativeResults.every(result=>!result.prevented&&!result.busy),'Modifier/middle/target clicks remain native and do not start motion');
   assert.equal(await page.locator('.vending-dispense').count(),0);
   assert.equal(await page.evaluate(()=>purchaseCalls),0);

   // One compact transition locks selection and carries the exact snapshot once.
   await select('mythic',3);await view().scrollIntoViewIfNeeded();
   const initialVisits=visits.length;
   await view().evaluate(link=>{link.click();link.click()});
   await page.waitForFunction(()=>document.querySelector('.vending-machine')?.classList.contains('is-dispensing'));
   assert.equal(await page.locator('.vending-dispense').count(),1,'One dispense prop for repeated activation');
   assert.equal(await page.locator('.vending-dispense').getAttribute('aria-hidden'),'true');
   assert(await page.locator('#vending-plus').isDisabled(),'Quantity cannot change during dispense');
   const before=await page.locator('#vending-selected-name').textContent();
   await page.locator('.vending-slot[data-vending-pack="premium"]').dispatchEvent('click');
   assert.equal(await page.locator('#vending-selected-name').textContent(),before,'Selection remains the clicked snapshot while dispensing');
   assert.equal(await page.evaluate(()=>purchaseCalls),0);
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Motion does not add horizontal scrolling');
   if([390,1440].includes(width)){
    await page.evaluate(()=>document.getAnimations().filter(effect=>effect.effect?.target?.matches('.vending-dispense-pack,.vending-coil-motion i,.vending-tray-pack,.vending-flap')).forEach(effect=>{effect.pause();effect.currentTime=430}));
    await page.screenshot({path:'/tmp/rippr-vending-drop-'+width+'.png',animations:'allow'});
   }
   await page.waitForURL('**/opening.html?pack=mythic&quantity=3',{timeout:2500});
   assert.equal(visits.length,initialVisits+1,'Rapid repeat activation navigates exactly once');assertDestination(initialVisits,'mythic',3);

   // Offscreen source lanes use the local hatch without moving the page.
   await home();await select('plus',2);
   await view().evaluate(link=>scrollTo(0,Math.max(0,scrollY+link.getBoundingClientRect().top-80)));
   assert(await page.locator('.vending-slot[data-vending-pack="plus"] .vending-pack-front').evaluate(img=>img.getBoundingClientRect().bottom<0),'Fixture source lane is offscreen');
   const scrollPosition=await page.evaluate(()=>scrollY),offscreenVisits=visits.length;
   await view().evaluate(link=>link.click());
   await page.waitForFunction(()=>document.querySelector('.vending-machine')?.classList.contains('is-dispensing'));
   assert(Math.abs(await page.evaluate(()=>scrollY)-scrollPosition)<1,'Dispensing never forces the user to scroll');
   assert.equal(await page.locator('.vending-tray-pack').count(),1);
   assert.equal(await page.locator('.vending-tray-pack').getAttribute('aria-hidden'),'true');
   if([390,1440].includes(width)){
    await page.evaluate(()=>document.getAnimations().filter(effect=>effect.effect?.target?.matches('.vending-tray-pack,.vending-flap,.vending-inline-pack')).forEach(effect=>{effect.pause();effect.currentTime=350}));
    await page.screenshot({path:'/tmp/rippr-vending-dispense-'+width+'.png',animations:'allow'});
   }
   await page.waitForURL('**/opening.html?pack=plus&quantity=2',{timeout:2500});assertDestination(offscreenVisits,'plus',2);

   // Returning through the back/forward cache must restore interactive controls.
   await home();await select('premium',2);
   if(width===390){
    const hiddenVisits=visits.length;await view().evaluate(link=>{link.click();window.dispatchEvent(new Event('pagehide'))});
    await page.waitForTimeout(900);assert.equal(visits.length,hiddenVisits,'Pagehide cancels the pending navigation deadline');
    assert.equal(await page.locator('.vending-dispense,.vending-tray-pack,.vending-inline-pack').count(),0,'Pagehide removes temporary artwork');
    assert(!(await machine().evaluate(el=>el.classList.contains('is-dispensing'))));
   }
   const canceledVisits=visits.length;
   await view().evaluate(link=>{
    link.click();
    const event=new Event('pageshow');Object.defineProperty(event,'persisted',{value:true});window.dispatchEvent(event);
   });
   await page.waitForFunction(()=>!document.querySelector('.vending-machine')?.classList.contains('is-dispensing'));
   assert.equal(await page.locator('.vending-dispense').count(),0);
   assert(!(await page.locator('#vending-plus').isDisabled()),'Controls recover after pageshow');
   await page.waitForTimeout(1200);
   assert.equal(visits.length,canceledVisits,'A canceled dispense cannot navigate later');
   assert.equal(await page.evaluate(()=>purchaseCalls),0);

   await home();await select('elite');
   await page.locator('.vending-slot[data-vending-pack="elite"] .vending-pack-front').evaluate(img=>img.decode().catch(()=>{}));
   if([390,1440].includes(width))await page.locator('#packs').screenshot({path:'/tmp/rippr-vending-lighting-'+width+'.png',animations:'disabled'});
   await select('mythic');
   await view().focus();await page.keyboard.press('Enter');await page.waitForURL('**/opening.html?pack=mythic&quantity=1',{timeout:2500});

   // Reduced motion gets the original link flow, without an animation delay.
   await page.emulateMedia({reducedMotion:'reduce'});await home();await select('basic');
   const reducedVisits=visits.length;
   await view().evaluate(link=>{
    const observed=[];window.addEventListener('click',()=>observed.push({busy:document.querySelector('.vending-machine').classList.contains('is-dispensing'),props:document.querySelectorAll('.vending-dispense').length}),{once:true});
    window.reducedObservation=observed;link.click();
    sessionStorage.setItem('reducedObservation',JSON.stringify(observed));
   });
   await page.waitForURL('**/opening.html?pack=basic&quantity=1',{timeout:1000});assertDestination(reducedVisits,'basic',1);
   assert.deepEqual(await page.evaluate(()=>JSON.parse(sessionStorage.getItem('reducedObservation'))),[{busy:false,props:0}]);

   await page.emulateMedia({reducedMotion:'no-preference'});await home('no-waapi');await select('plus');
   const noWaapiVisits=visits.length;
   await view().evaluate(link=>{link.click();sessionStorage.setItem('noWaapiBusy',String(document.querySelector('.vending-machine').classList.contains('is-dispensing')))});
   await page.waitForURL('**/opening.html?pack=plus&quantity=1',{timeout:1000});assertDestination(noWaapiVisits,'plus',1);
   assert.equal(await page.evaluate(()=>sessionStorage.getItem('noWaapiBusy')),'false','Without WAAPI the normal link remains immediate');
   await home('throw-waapi');await select('plus');const thrownVisits=visits.length;
   await view().click();await page.waitForURL('**/opening.html?pack=plus&quantity=1',{timeout:1000});
   assert.equal(visits.length,thrownVisits+1,'An animation engine failure still navigates exactly once');assertDestination(thrownVisits,'plus',1);
   if(width===390){
    await home();await select('plus',2);await view().evaluate(link=>link.click());
    await page.waitForFunction(()=>document.querySelector('.vending-machine')?.classList.contains('is-dispensing'));
    const preferenceVisits=visits.length;await page.emulateMedia({reducedMotion:'reduce'});
    await page.waitForURL('**/opening.html?pack=plus&quantity=2',{timeout:1000});assertDestination(preferenceVisits,'plus',2);
   }

   // Failed artwork and unavailable catalogs must never trap navigation or vend.
   await page.emulateMedia({reducedMotion:'no-preference'});await home('broken-art');await select('plus');
   const brokenVisits=visits.length;await view().click();await page.waitForURL('**/opening.html?pack=plus&quantity=1',{timeout:2500});assertDestination(brokenVisits,'plus',1);
   await home('disabled');const disabledVisits=visits.length;
   assert.equal(await view().getAttribute('href'),null);await view().dispatchEvent('click');
   assert.equal(await page.locator('.vending-dispense').count(),0);assert(!(await machine().evaluate(el=>el.classList.contains('is-dispensing'))));
   assert.equal(visits.length,disabledVisits);assert.equal(await page.evaluate(()=>purchaseCalls),0);assert.deepEqual(errors,[]);
   await page.close();
   console.log('PASS vending dispense '+width+'px: selection themes, single navigation with exact quantity, locked intent, native modified clicks, reduced motion, missing artwork, return recovery and zero purchases');
  }
 }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
