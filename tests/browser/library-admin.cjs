const {chromium}=require('playwright'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../..'),origin='http://localhost:3000';
async function setup(browser,width){
  const p=await browser.newPage({viewport:{width,height:900}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.route('**/*',r=>{
    const u=new URL(r.request().url());
    if(u.origin==='https://api.tcgdex.net'){
      const data=u.pathname.endsWith('/cards')?[{id:'swsh7-215',name:'Umbreon VMAX',localId:'215',image:'https://assets.tcgdex.net/en/swsh/swsh7/215'}]:{id:'swsh7-215',name:'Umbreon VMAX',localId:'215',image:'https://assets.tcgdex.net/en/swsh/swsh7/215',set:{name:'Evolving Skies'},rarity:'Secret Rare'};
      return r.fulfill({json:data});
    }
    if(u.origin==='https://assets.tcgdex.net')return r.fulfill({body:fs.readFileSync(path.join(root,'assets/grail-moonstone.svg')),contentType:'image/svg+xml'});
    assert.equal(u.origin,origin);const name=u.pathname.slice(1);
    if(['firebase-client.js','account-state.js','navigation.js','footer.js'].includes(name))return r.fulfill({body:'',contentType:'application/javascript'});
    const f=path.resolve(root,name);assert(f.startsWith(root+path.sep));if(!fs.existsSync(f))return r.abort();
    return r.fulfill({body:fs.readFileSync(f),contentType:({'.html':'text/html','.js':'application/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.woff2':'font/woff2'})[path.extname(f)]||'application/octet-stream'});
  });
  await p.addInitScript(()=>{
    window.owner={uid:'owner',phoneNumber:'+17654794230'};window.savedPack=null;window.saveCalls=0;window.failSaveAt=0;window.libraryDB={};
    window.RipprFirebase={ready:Promise.resolve(),currentUser:()=>owner,observe:cb=>queueMicrotask(()=>cb(owner)),
      loadPackContents:async id=>RipprCatalog.defaultPack(id),savePackContents:async(id,pack)=>{savedPack=JSON.parse(JSON.stringify(pack));return 1},
      loadLibraryPage:async({search=''})=>({cards:Object.values(libraryDB).filter(c=>c.name.toLowerCase().startsWith(search.toLowerCase())).sort((a,b)=>a.id.localeCompare(b.id)),cursor:null}),
      lookupLibraryCards:async ids=>ids.map(id=>libraryDB[id]).filter(Boolean).map(c=>JSON.parse(JSON.stringify(c))),
      saveLibraryCards:async cards=>{saveCalls++;if(saveCalls===failSaveAt)throw new Error('Temporary save failure. Retry the remaining cards.');for(const c of cards)if((libraryDB[c.id]?.version||0)!==c.version)throw new Error('Card changed in another session. Rebuild the preview.');return cards.map(c=>libraryDB[c.id]={...c,version:c.version+1})}
    };
  });
  await p.goto(origin+'/admin/index.html');await p.waitForFunction(()=>window.RipprPackAdmin&&!RipprPackAdmin.busy);
  await p.evaluate(()=>{libraryDB.raw={...RipprLibrary.cleanLibraryCard({id:'raw',name:'Raw card',image:'assets/grail-moonstone.svg'}),version:1};libraryDB.slab={...RipprLibrary.cleanLibraryCard({id:'slab',name:'Slab card',image:'assets/grail-moonstone.svg',valueCents:10000,rarity:'Legendary',grading:{company:'PSA',grade:'10'}}),version:2}});
  // Mobile navigation lives in a drawer; use the same admin-view event as its buttons.
  await p.evaluate(()=>document.querySelector('[data-view=library]').click());await p.locator('#library-rows tr').first().waitFor();
  return{p,errors};
}
(async()=>{const browser=await chromium.launch({...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),args:['--no-sandbox']});try{
  for(const width of [320,390,1440]){
    const{p,errors}=await setup(browser,width);
    assert.equal(await p.locator('#library-rows tr').count(),2);assert(await p.locator('#library-saved-panel .library-scroll').evaluate(el=>el.scrollWidth<=el.clientWidth));assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    await p.locator('[data-library-select=raw]').check();await p.locator('.library-bulk summary').click();await p.locator('#library-bulk-rarity').selectOption('Rare');await p.locator('#library-bulk-value').fill('2.50');await p.locator('#library-bulk-form button').click();await p.locator('#library-preview:not([hidden])').waitFor();assert((await p.locator('#library-preview-summary').textContent()).includes('1 updates'));await p.locator('#library-commit').click();await p.waitForFunction(()=>libraryDB.raw.valueCents===250&&!RipprLibraryAdmin.busy);
    await p.locator('#library-add-form button').click();await p.locator('#packs-view:not([hidden])').waitFor();assert(await p.evaluate(()=>RipprPackAdmin.cards().some(c=>c.id==='raw'&&c.chanceBps===0)));assert.equal(await p.locator('#odds-total').textContent(),'Total odds: 100%');await p.locator('#save-pack').click();await p.waitForFunction(()=>savedPack);assert.equal(await p.evaluate(()=>savedPack.items.find(c=>c.id==='raw').valueCents),250);
    await p.evaluate(()=>document.querySelector('[data-view=library]').click());await p.locator('[data-library-edit=slab]').click();await p.locator('#library-edit-value').fill('125.50');await p.locator('#library-editor-form button[type=submit]').click();await p.locator('#library-commit').click();await p.waitForFunction(()=>libraryDB.slab.valueCents===12550&&!RipprLibraryAdmin.busy);assert.equal(await p.evaluate(()=>libraryDB.slab.grading.grade),'10');
    if(process.env.RIPPR_LIBRARY_SCREENSHOTS){await p.evaluate(()=>window.scrollTo(0,0));await p.screenshot({path:'/tmp/rippr-library-'+width+'.png',fullPage:true})}
    await p.locator('[data-library-tab=pokemon]').click();await p.locator('#library-provider-name').fill('Umbreon');await p.locator('#library-provider-form button').click();await p.locator('[data-provider-select="swsh7-215"]').waitFor();await p.locator('[data-provider-select="swsh7-215"]').check();await p.locator('#library-provider-preview').click();await p.locator('#library-preview:not([hidden])').waitFor();assert((await p.locator('#library-preview-rows').textContent()).includes('Not priced'));await p.locator('#library-commit').click();await p.waitForFunction(()=>libraryDB['tdx-en-swsh7-215']&&!RipprLibraryAdmin.busy);assert.equal(await p.evaluate(()=>libraryDB['tdx-en-swsh7-215'].rarity),null);
    assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.deepEqual(errors,[]);console.log(`PASS library ${width}px: bulk pricing, 0% pack draft, preserved slab grade, TCGdex preview, contained layout`);await p.close();
  }
  const{p,errors}=await setup(browser,390);
  await p.locator('[data-library-tab=csv]').click();
  await p.locator('#library-csv-file').setInputFiles({name:'cards.csv',mimeType:'text/csv',buffer:Buffer.from('id,name,image,rarity,value\n'+Array.from({length:51},(_,i)=>`csv${i},CSV card ${i},assets/grail-moonstone.svg,Common,1.25`).join('\n'))});
  await p.locator('#library-csv-preview').click();await p.locator('#library-preview:not([hidden])').waitFor();await p.evaluate(()=>{failSaveAt=2});await p.locator('#library-commit').click();await p.waitForFunction(()=>!RipprLibraryAdmin.busy&&saveCalls===2);assert.equal(await p.evaluate(()=>Object.keys(libraryDB).filter(k=>k.startsWith('csv')).length),50);assert.equal(await p.locator('#library-preview-rows tr').count(),1);assert(await p.locator('#library-error').isVisible());await p.locator('#library-commit').click();await p.waitForFunction(()=>!RipprLibraryAdmin.busy&&Object.keys(libraryDB).filter(k=>k.startsWith('csv')).length===51);assert.equal(await p.evaluate(()=>libraryDB.csv0.version),1);
  await p.locator('#library-csv-file').setInputFiles({name:'values.csv',mimeType:'text/csv',buffer:Buffer.from('id,value\nslab,111.50')});await p.locator('#library-csv-preview').click();await p.locator('#library-preview:not([hidden])').waitFor();await p.evaluate(()=>{libraryDB.slab.version++});await p.locator('#library-commit').click();await p.waitForFunction(()=>!RipprLibraryAdmin.busy);assert((await p.locator('#library-error').textContent()).includes('another session'));assert.equal(await p.evaluate(()=>libraryDB.slab.valueCents),10000);
  await p.locator('#library-cancel-preview').click();
  await p.evaluate(()=>{RipprPackAdmin.cards=()=>Array.from({length:600},(_,i)=>({...RipprLibrary.cleanLibraryCard({id:'copy'+i,name:'Copied card '+i,image:'assets/grail-moonstone.svg',source:'pack',rarity:'Common',valueCents:100})}))});await p.locator('#library-from-packs').click();await p.waitForFunction(()=>!RipprLibraryAdmin.busy);assert.equal(await p.locator('#library-preview-rows tr').count(),500);await p.locator('#library-commit').click();await p.waitForFunction(()=>!RipprLibraryAdmin.busy&&Object.keys(libraryDB).filter(k=>k.startsWith('copy')).length===500);await p.locator('#library-from-packs').click();await p.waitForFunction(()=>!RipprLibraryAdmin.busy);assert.equal(await p.locator('#library-preview-rows tr').count(),100);await p.locator('#library-commit').click();await p.waitForFunction(()=>!RipprLibraryAdmin.busy&&Object.keys(libraryDB).filter(k=>k.startsWith('copy')).length===600);
  await p.evaluate(()=>{RipprFirebase.lookupLibraryCards=()=>new Promise(resolve=>window.releaseLookup=resolve)});await p.locator('#library-csv-preview').click();await p.waitForFunction(()=>window.releaseLookup);await p.evaluate(()=>{owner=null;document.dispatchEvent(new CustomEvent('rippr:authchange'));releaseLookup([libraryDB.slab])});await p.waitForTimeout(30);assert.equal(await p.locator('#library-preview-rows tr').count(),0);assert.equal(await p.locator('#library-rows tr').count(),0);assert.deepEqual(errors,[]);console.log('PASS library recovery: partial-save retry, revision conflict, 600-card copy without loss, late response after sign-out');await p.close();
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
