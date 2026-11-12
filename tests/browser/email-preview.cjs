const {chromium}=require('playwright'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../../emails/output'),origin='http://localhost:3000';
(async()=>{const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});try{for(const width of [390,1440]){
 const page=await browser.newPage({viewport:{width,height:1100}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',route=>{const u=new URL(route.request().url());assert.equal(u.origin,origin,'Preview artwork is embedded, no remote calls');const file=path.resolve(root,u.pathname.slice(1));assert(file.startsWith(root+path.sep));return route.fulfill({body:fs.readFileSync(file),contentType:file.endsWith('.html')?'text/html':'text/plain'})});
 await page.goto(origin+'/preview.html');const frame=page.frameLocator('#frame');
 for(const button of await page.locator('nav button').all()){
  await button.click();await frame.locator('h1').waitFor();await page.waitForFunction(()=>document.querySelector('#frame').contentDocument?.images[0]?.complete);
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  const geometry=await frame.locator('body').evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}));assert(geometry.scroll<=geometry.width,'Email has no horizontal overflow');
  assert.equal(await frame.locator('img').evaluate(img=>img.naturalWidth>0),true);
 }
 await page.getByRole('button',{name:'Welcome',exact:true}).click();await frame.locator('h1').waitFor();
 await page.screenshot({path:'/tmp/rippr-email-studio-'+width+'.png',fullPage:true});
 await page.getByRole('button',{name:'Mobile',exact:true}).click();assert((await page.locator('#frame').boundingBox()).width<=360);
 await page.getByRole('button',{name:'Plain text',exact:true}).click();assert(await page.locator('#plain').isVisible());assert(await page.locator('#frame').isHidden());assert.deepEqual(errors,[]);
 console.log('PASS email studio '+width+'px: all nine templates, embedded artwork, no page/email overflow, width and text controls');await page.close();
 }}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
