const {chromium}=require('playwright'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../..'),origin='http://rippr.test';
const pages=['index','landing','auth','opening','profile','rewards','help-center','how-it-works','about','contact-support','shipping','order-tracking','account-settings','payment-success','payment-canceled','eligibility','terms','privacy','refunds','shipping-policy','pack-disclosures','community','museum'];
(async()=>{const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined,args:['--no-sandbox']});try{
 const p=await browser.newPage({viewport:{width:390,height:844}});
 await p.addInitScript(()=>{window.RIPPR_RUNTIME={mode:'live'}});
 await p.route('**/*',r=>{
  const u=new URL(r.request().url());assert.equal(u.origin,origin,'Copy audit must not contact live services');const name=u.pathname.slice(1),file=path.resolve(root,name);
  if(name.endsWith('.js')&&!['runtime-ui.js','footer.js','footer-config.js'].includes(name))return r.fulfill({body:'',contentType:'application/javascript'});
  if(!file.startsWith(root+'/')||!fs.existsSync(file))return r.abort();
  return r.fulfill({body:fs.readFileSync(file),contentType:({'.html':'text/html','.js':'application/javascript','.css':'text/css','.svg':'image/svg+xml','.webp':'image/webp','.png':'image/png','.woff2':'font/woff2'})[path.extname(file)]||'application/octet-stream'});
 });
 const failures=[];
 for(const name of pages){
  await p.goto(origin+'/'+name+'.html');await p.waitForFunction(()=>document.documentElement.dataset.siteMode==='live');
  const text=(await p.locator('body').innerText()).replace(/legacy test credit/gi,'');
  const stale=text.match(/.{0,90}(?:no real (?:money|charge)|test payments only|sandbox.only|current testing status|not final launch|final legal review|planned live.service policy|controls are not yet active|approved launch policy|before live launch|for testing and have no cash value).{0,120}/gi);
  if(stale)failures.push({page:name,text:stale});
  if(name==='index'){
   const review=p.locator('.trustpilot-review a');assert.equal(await review.getAttribute('href'),'https://www.trustpilot.com/review/rippr.gg');
   assert((await review.innerText()).includes('Leave a review'));assert.equal(await p.locator('.trustpilot-review-stars span').count(),5);
   assert.equal(await p.locator('.trustpilot-review-stars').getAttribute('aria-hidden'),'true');
   for(const width of [320,390,1440]){await p.setViewportSize({width,height:844});assert(await review.isVisible());const box=await review.boundingBox();assert(box.x>=0&&box.x+box.width<=width,'Review invitation fits viewport');}
   await p.setViewportSize({width:390,height:844});
  }
 }
 assert.deepEqual(failures,[],'Live pages must not show retired test/launch-draft copy');
 console.log('PASS launch copy: 23 public pages render live labels without stale testing disclaimers and the Trustpilot review invitation fits mobile and desktop');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
