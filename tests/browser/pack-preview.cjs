/* Real preview/opening scripts, local artwork, no external services or payments. */
const {chromium}=require('playwright'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../..'),origin='http://localhost:3000';
const types={'.html':'text/html','.css':'text/css','.js':'application/javascript','.webp':'image/webp','.svg':'image/svg+xml','.woff2':'font/woff2'};
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined,args:['--no-sandbox']});
 try{for(const width of [320,390,1440]){
  const p=await browser.newPage({viewport:{width,height:1000},reducedMotion:'reduce'}),errors=[];
  p.on('pageerror',e=>errors.push(e.message));
  await p.route('**/*',route=>{
   const u=new URL(route.request().url());assert.equal(u.origin,origin);
   const name=u.pathname.slice(1);if(['firebase-client.js','account-state.js','navigation.js','footer.js','conversion.js','runtime-ui.js'].includes(name))return route.fulfill({body:'',contentType:'application/javascript'});
   const file=path.resolve(root,name);assert(file.startsWith(root+path.sep));if(!fs.existsSync(file))return route.abort();
   return route.fulfill({body:fs.readFileSync(file),contentType:types[path.extname(file)]||'application/octet-stream'});
  });
  await p.addInitScript(()=>{
   window.RIPPR_ACCOUNT={ready:true,mode:'live',user:{uid:'preview-fixture'},wallet:{balanceCents:100000},items:[]};window.purchaseCount=0;
   window.RipprFirebase={loadPackContents:async id=>({...RipprCatalog.defaultPack(id),priceCents:100,enabled:true})};
   window.RipprAccount={errorMessage:e=>e.message,act:async()=>{purchaseCount++;throw Error('Fixture declined')}};
   localStorage.setItem('rippr:opening-muted','true');
  });
  await p.goto(origin+'/opening.html?pack=icy-rush&quantity=3');
  const preview=p.locator('.pack-preview'),turn=p.locator('.pack-turntable');
  await p.waitForFunction(()=>document.querySelector('#pack-shell').dataset.artReady==='true'&&!document.querySelector('#open').disabled);
  assert.equal(await preview.locator('.pack-model:not([hidden])').count(),3);assert.equal(await turn.getAttribute('tabindex'),'-1');
  await p.locator('[data-qty="1"]').click();assert.equal(await preview.locator('.pack-model:not([hidden])').count(),1);assert.equal(await turn.getAttribute('tabindex'),'0');
  await p.screenshot({path:`/tmp/rippr-pack-preview-front-${width}.png`,fullPage:false});
  assert.equal(await turn.evaluate(el=>getComputedStyle(el).touchAction),'pan-y','Phone scrolling remains available');
  await turn.dispatchEvent('pointerdown',{pointerId:9,isPrimary:true,button:0,clientX:100,clientY:100});
  await turn.dispatchEvent('pointermove',{pointerId:9,isPrimary:true,clientX:102,clientY:150});
  assert.equal(await preview.evaluate(el=>el.classList.contains('is-dragging')),false,'Vertical intent does not rotate');
  await turn.focus();await p.keyboard.press('Home');await p.keyboard.press('ArrowRight');
  await p.waitForFunction(()=>document.querySelector('.pack-turntable').style.getPropertyValue('--preview-yaw')==='30deg');
  await turn.dispatchEvent('pointerdown',{pointerId:1,isPrimary:true,button:0,clientX:100,clientY:100});
  // Real mouse capture and an uninterrupted full turn.
  await turn.dispatchEvent('pointercancel',{pointerId:1});
  const box=await turn.boundingBox();await p.mouse.move(box.x+20,box.y+box.height/2);await p.mouse.down();await p.mouse.move(box.x+box.width-15,box.y+box.height/2,{steps:12});await p.mouse.up();
  assert.notEqual(await turn.evaluate(el=>el.style.getPropertyValue('--preview-yaw')),'30deg');
  await turn.focus();for(let i=0;i<12;i++)await p.keyboard.press('ArrowRight');
  await p.evaluate(()=>new Promise(requestAnimationFrame));const before=await turn.evaluate(el=>el.style.getPropertyValue('--preview-yaw'));assert(parseFloat(before)>360,'Full 360 rotation supported');
  await p.locator('[data-qty="5"]').click();assert.equal(await preview.locator('.pack-model:not([hidden])').count(),5);
  await p.evaluate(()=>new Promise(requestAnimationFrame));const rotation=await turn.evaluate(el=>el.style.getPropertyValue('--preview-yaw'));
  await turn.dispatchEvent('keydown',{key:'ArrowRight'});assert.equal(await turn.evaluate(el=>el.style.getPropertyValue('--preview-yaw')),rotation,'Batch cannot rotate');
  await turn.dispatchEvent('pointerdown',{pointerId:2,isPrimary:true,button:0,clientX:100,clientY:100});await turn.dispatchEvent('pointermove',{pointerId:2,isPrimary:true,clientX:250,clientY:100});assert.equal(await preview.evaluate(el=>el.classList.contains('is-dragging')),false);
  for(const count of [2,4,5]){await p.locator(`[data-qty="${count}"]`).click();assert.equal(await preview.locator('.pack-model:not([hidden])').count(),count)}
  assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'No viewport overflow');
  assert.equal(await p.evaluate(()=>purchaseCount),0,'Preview interactions never purchase');
  await p.evaluate(()=>scrollTo(0,0));await p.screenshot({path:`/tmp/rippr-pack-preview-batch-${width}.png`,fullPage:false});
  await p.locator('[data-qty="1"]').click();await turn.focus();await p.keyboard.press('Home');await p.keyboard.press('ArrowRight');await p.keyboard.press('ArrowRight');await p.keyboard.press('ArrowRight');await p.keyboard.press('ArrowRight');await p.keyboard.press('ArrowRight');await p.keyboard.press('ArrowRight');
  await p.screenshot({path:`/tmp/rippr-pack-preview-back-${width}.png`,fullPage:false});
  await p.locator('#open').click();await p.waitForFunction(()=>purchaseCount===1&&state==='idle');assert(await preview.isVisible(),'Failed purchase restores preview');
  await p.evaluate(()=>{RipprAccount.act=async(action,data)=>{purchaseCount++;return{cards:Array.from({length:data.quantity},(_,i)=>({...RipprCatalog.defaultPack('basic').items[0],id:'preview-'+i,status:'available',image:'assets/hero/charizard-slab.webp',rarity:'Legendary',valueCents:100}))}}});
  await p.locator('[data-qty="3"]').click();await p.locator('#open').click();await p.waitForFunction(()=>state==='ripping');assert(await preview.isHidden(),'Paid opening hands back to original foil rig');assert(await p.locator('#rip-foil').isVisible());
  await p.locator('#skip-opening').click();await p.waitForFunction(()=>state==='revealing');
  assert.deepEqual(errors,[]);console.log(`PASS 3D preview ${width}px: deep links, single/batch, pointer/keyboard 360, no preview purchases, failed payment restore and tear/skip handoff`);await p.close();
 }}finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
