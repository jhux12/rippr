/* Deterministic cosmetic variants with real local wrapper pixels; no account calls. */
const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../..');
(async()=>{const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined,args:['--no-sandbox']});
try{const p=await browser.newPage({viewport:{width:600,height:740}}),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.route('**/*',route=>route.abort());
const image='data:image/webp;base64,'+fs.readFileSync(path.join(root,'assets/packs/plus.webp')).toString('base64');
await p.setContent(`<style>body{margin:0;background:#081722}.pack-shell{position:absolute;left:195px;top:220px;width:210px;height:350px}.artwork,.foil-piece{position:absolute;inset:0;background:url('${image}') center/100% 100%;}.foil-piece{opacity:0}</style><div class="pack-shell ripping" id="shell"><div class="pack artwork" style="background-image:url('${image}')"></div><div class="foil-piece"></div><button class="rip-target" hidden></button></div>`);
await p.addStyleTag({path:path.join(root,'opening-foil.css')});await p.addScriptTag({path:path.join(root,'opening-foil.js')});
await p.evaluate(async image=>{const img=new Image();img.src=image;await img.decode();window.fixtureHidden=false;Object.defineProperty(document,'hidden',{configurable:true,get:()=>fixtureHidden});window.api=RipprFoil.mount(document.querySelector('#shell'))},image);
await p.waitForTimeout(80);
let previous=null;for(const [random,expected] of [[.1,'curved'],[.9,'diagonal'],[.1,'curved'],[.9,'diagonal']]){
await p.evaluate(value=>{const native=Math.random;Math.random=()=>value;api.reset();Math.random=native;api.setProgress(.3)},random);
assert.equal(await p.locator('#shell').getAttribute('data-foil-style'),expected);
await p.evaluate(()=>api.setProgress(0));assert.equal(await p.locator('#shell').getAttribute('data-foil-style'),expected,'Returning the grip does not reroll the style');
assert.equal(await p.evaluate(()=>api.release()),640);await p.evaluate(()=>{const a=document.querySelector('.foil-ribbon').getAnimations()[0];a.pause();a.currentTime=290});await p.waitForTimeout(50);
assert(await p.locator('.foil-ribbon').isVisible());
const pixels=await p.locator('.foil-ribbon').evaluate(canvas=>{const data=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;let count=0,x=0,y=0;for(let i=3;i<data.length;i+=4)if(data[i]>30){count++;const index=(i-3)/4;x+=index%canvas.width;y+=Math.floor(index/canvas.width)}return{count,x:x/count,y:y/count}});
assert(pixels.count>100,'Actual wrapper texture is drawn');if(previous&&expected==='diagonal')assert(Math.abs(pixels.x-previous.x)>10||Math.abs(pixels.y-previous.y)>10,'Variants follow different paths');previous=pixels;
await p.screenshot({path:`/tmp/rippr-random-foil-${expected}.png`});
const frozen=await p.locator('.foil-ribbon').evaluate(c=>c.toDataURL());await p.evaluate(()=>{fixtureHidden=true;document.dispatchEvent(new Event('visibilitychange'))});await p.waitForTimeout(80);assert.equal(await p.locator('.foil-ribbon').evaluate(c=>c.toDataURL()),frozen);
await p.evaluate(()=>{document.querySelector('.foil-ribbon').getAnimations()[0].currentTime=440;fixtureHidden=false;document.dispatchEvent(new Event('visibilitychange'))});await p.waitForTimeout(40);assert.notEqual(await p.locator('.foil-ribbon').evaluate(c=>c.toDataURL()),frozen,'Tab return repaints the owned clock');
await p.evaluate(()=>api.cancel());assert(await p.locator('.foil-ribbon').isHidden());assert.equal(await p.locator('#shell').evaluate(el=>el.getAnimations({subtree:true}).length),0);
}
await p.evaluate(()=>{api.reset();api.setProgress(1,-1)});assert.equal(await p.evaluate(()=>api.release()),640);await p.waitForTimeout(35);assert.equal(await p.locator('#shell').getAttribute('data-foil-direction'),'left');assert(await p.locator('.foil-ribbon').isVisible());await p.evaluate(()=>api.cancel());
assert.equal(await p.locator('.foil-ribbon').count(),1,'Repeated variants reuse one canvas');await p.emulateMedia({reducedMotion:'reduce'});assert.equal(await p.evaluate(()=>api.release()),0);assert(await p.locator('.foil-ribbon').isHidden());assert.deepEqual(errors,[]);console.log('PASS randomized foil: both textured paths, stable grip selection, clock pause/resume, repeated cancellation, bounded canvas and reduced motion');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
