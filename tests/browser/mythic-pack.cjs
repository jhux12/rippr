/* Isolated fixtures: new tier layout, intrinsic artwork, and batch skip. */
const {chromium}=require('playwright'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../..'),origin='http://localhost:3000';
const types={'.html':'text/html','.js':'application/javascript','.css':'text/css','.svg':'image/svg+xml','.webp':'image/webp','.png':'image/png','.woff2':'font/woff2','.wav':'audio/wav'};
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
 try{for(const width of [320,390,1440]){
  const page=await browser.newPage({viewport:{width,height:900},reducedMotion:'no-preference'}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',async route=>{
   const u=new URL(route.request().url());assert.equal(u.origin,origin,'No production calls');const name=u.pathname.slice(1);
   if(['firebase-client.js','account-state.js','navigation.js','footer.js'].includes(name))return route.fulfill({body:'',contentType:'application/javascript'});
   if(name==='assets/pack-mythic.webp')await new Promise(resolve=>setTimeout(resolve,700));
   const target=path.resolve(root,name);assert(target.startsWith(root+path.sep));
   if(!fs.existsSync(target))return route.abort();return route.fulfill({body:fs.readFileSync(target),contentType:types[path.extname(target)]||'application/octet-stream'});
  });
  await page.addInitScript(()=>{
   window.RIPPR_ACCOUNT={ready:true,user:{uid:'mythic-fixture'},wallet:{balanceCents:100000},items:[]};
   window.RipprFirebase={ready:Promise.resolve(),loadHomepageGrails:async()=>RipprCatalog.defaultHomepageGrails(),loadPackContents:async id=>({...RipprCatalog.defaultPack(id),enabled:sessionStorage.getItem('configured')==='yes'||id!=='mythic',priceCents:id==='mythic'?sessionStorage.getItem('configured')==='yes'?2500:null:199})};
   window.RipprAccount={errorMessage:e=>e.message,act:async(action,data)=>{
    if(action!=='purchase')throw Error('Unexpected action');
    return{cards:Array.from({length:data.quantity},(_,i)=>({...RipprCatalog.defaultPack('basic').items[0],id:'mythic-'+i,packId:'mythic',pack:i+1,status:'available',rarity:'Legendary'})),totalCents:data.quantity*2500};
   }};
  });
  await page.goto(origin+'/index.html');await page.getByRole('button',{name:'Mythic',exact:true}).click();
  assert.equal(await page.locator('.tier-slide.is-active h3').textContent(),'Mythic');
  assert.equal(await page.locator('.tier-slide.is-active .view-pack').getAttribute('href'),'opening.html?pack=mythic');
  assert.equal(await page.locator('#tier-selectors button').count(),6);
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  const bounds=await page.locator('#tier-selectors').boundingBox();assert(bounds.x>=0&&bounds.x+bounds.width<=width);
  await page.screenshot({path:'/tmp/mythic-home-'+width+'.png',fullPage:true});
  await page.locator('.tier-slide.is-active .view-pack').click();await page.waitForURL('**/opening.html?pack=mythic',{waitUntil:'domcontentloaded'});
  assert(Math.abs(await page.evaluate(()=>Number(document.documentElement.style.getPropertyValue('--pack-ratio')))-2/3)<.001,'Intrinsic geometry is reserved before artwork loads');
  await page.waitForFunction(()=>artReady&&contentsReady);
  const centered=await page.evaluate(()=>{const a=document.querySelector('.arena').getBoundingClientRect(),p=document.querySelector('#pack-shell').getBoundingClientRect();return Math.abs(p.x+p.width/2-a.x-a.width/2)<1&&Math.abs(p.y+p.height/2-a.y-a.height/2)<5});assert(centered,'Cold-load pack is centered without refresh');
  assert(await page.locator('#open').isDisabled());
  assert.equal(await page.locator('.arena').getAttribute('data-pack'),'mythic');
  assert.equal(await page.locator('.signature-crystal').count(),1);
  const ratio=await page.evaluate(()=>Number(document.documentElement.style.getPropertyValue('--pack-ratio')));assert(Math.abs(ratio-2/3)<.001);
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.screenshot({path:'/tmp/mythic-stage-'+width+'.png',fullPage:true});
  await page.evaluate(()=>sessionStorage.setItem('configured','yes'));await page.reload();await page.waitForFunction(()=>!document.querySelector('#open').disabled);
  await page.locator('[data-qty="3"]').click();await page.locator('#open').click();await page.locator('#skip-opening:not([hidden])').click();
  await page.waitForFunction(()=>state==='revealing');
  assert.equal(await page.locator('.arena').getAttribute('data-reveal-rarity'),'Legendary');
  for(let i=0;i<3;i++){await page.locator('#next').click();if(i<2)await page.waitForFunction(index=>state==='revealing'&&cursor===index,i+1)}
  assert.deepEqual(errors,[]);
  console.log(`PASS Mythic ${width}px: six tiers, disabled default, artwork sizing, unique stage, configured purchase and three-card skip`);
  await page.close();
 }}finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
