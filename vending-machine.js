(()=>{
 'use strict';
 const machine=document.querySelector('.vending-machine');if(!machine)return;
 const $=selector=>document.querySelector(selector),all=window.RIPPR_PACKS||[],money=new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'});
 let catalogs=new Map(),collection='core',selected=null,quantity=1,generation=0,failures=false,loading=true,flight=null;
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');
 const choices=()=>all.filter(pack=>collection==='limited'?pack.limited:!pack.limited).map(pack=>({...pack,...catalogs.get(pack.id)}));
 const remember={core:null,limited:null},asset=path=>window.RIPPR_ASSET_URLS?.[path]||path;
 function coil(){const img=document.createElement('img');img.src=asset('assets/vending/dispensing-coil.webp');img.className='vending-coil';img.alt='';img.setAttribute('aria-hidden','true');img.width=220;img.height=100;return img}
 function setSelection(pack){if(flight||!pack?.selectable)return;selected=pack;remember[collection]=pack.id;renderSelection();for(const button of document.querySelectorAll('.vending-slot[data-vending-pack]')){const active=button.dataset.vendingPack===pack.id;button.setAttribute('aria-pressed',String(active));button.classList.toggle('is-active',active)}}
 function renderSelection(){
  const pack=selected,view=$('#vending-view-pack');machine.classList.toggle('has-selection',Boolean(pack));
  $('#vending-quantity').textContent=String(quantity);$('#vending-minus').disabled=!pack||quantity<=1;$('#vending-plus').disabled=!pack||quantity>=5;
  $('#vending-selected-name').textContent=pack?pack.name+' pack':'Choose a pack';$('#vending-selected-price').textContent=pack?money.format(pack.priceCents*quantity/100):'—';
  $('#vending-unit-price').hidden=!pack||quantity===1;$('#vending-unit-price').textContent=pack&&quantity>1?money.format(pack.priceCents/100)+' each · '+quantity+' packs':'';
  if(pack){machine.style.setProperty('--vending-accent',pack.accent);view.href='opening.html?pack='+encodeURIComponent(pack.id)+'&quantity='+quantity;view.removeAttribute('aria-disabled');view.removeAttribute('tabindex');view.setAttribute('aria-label','View '+quantity+' '+pack.name+' pack'+(quantity===1?'':'s')+', '+money.format(pack.priceCents*quantity/100)+' total')}
  else{view.removeAttribute('href');view.setAttribute('aria-disabled','true');view.tabIndex=-1;view.setAttribute('aria-label','Choose an available pack')}
 }
 function render(){
  const packs=choices(),root=$('#pack-grid');root.replaceChildren();machine.dataset.vendingCollection=collection;root.dataset.slotCount=String(packs.length);$('#vending-empty').hidden=Boolean(packs.length);
  const selectable=packs.filter(pack=>pack.selectable);selected=selectable.find(pack=>pack.id===selected?.id)||selectable.find(pack=>pack.id===remember[collection])||selectable[0]||null;
  for(const [index,pack]of packs.entries()){
   const code=String.fromCharCode(65+Math.floor(index/3))+(index%3+1),slot=document.createElement('button');slot.type='button';slot.className='vending-slot tier-slide';slot.dataset.vendingPack=pack.id;slot.dataset.packId=pack.id;slot.disabled=!pack.selectable;slot.setAttribute('aria-pressed','false');slot.classList.toggle('is-unavailable',!pack.selectable);slot.style.setProperty('--slot-accent',pack.accent);slot.setAttribute('aria-label',pack.selectable?'Select '+pack.name+' pack, '+money.format(pack.priceCents/100):pack.name+' pack, '+(loading?'loading':'unavailable'));
   const art=document.createElement('span');art.className='vending-slot-art';for(let depth=pack.selectable?3:0;depth>=0;depth--){const img=document.createElement('img');img.src=asset(pack.image);img.width=pack.width||250;img.height=pack.height||390;img.alt=depth?'':pack.name+' rippr foil pack';img.draggable=false;img.className=depth?'vending-pack-back depth-'+depth:'vending-pack-front';art.append(img)}
   const sheen=document.createElement('span');sheen.className='vending-slot-sheen';sheen.setAttribute('aria-hidden','true');const tag=document.createElement('span');tag.className='vending-selected-label';tag.textContent='Selected';art.append(sheen,tag,coil());
   const label=document.createElement('span');label.className='vending-slot-label';const position=document.createElement('span');position.className='vending-slot-code';position.textContent=code;const name=document.createElement('span');name.className='vending-slot-price';name.textContent=pack.name+' · '+(pack.selectable?money.format(pack.priceCents/100):loading?'Loading…':'Unavailable');label.append(position,name);slot.append(art,label);slot.addEventListener('click',()=>setSelection(pack));root.append(slot);
  }
  if(selected)setSelection(selected);else renderSelection();
  $('#vending-empty p').textContent=loading?'Loading the pack station…':'No packs in this collection.';
  $('#catalog-status').textContent=loading?'Loading current packs…':failures?'Some pack details couldn’t load. Unavailable packs cannot be selected.':selectable.length?`${selectable.length} ${collection==='limited'?'limited':'core'} pack${selectable.length===1?'':'s'} available. Select a pack to view its contents and odds.`:collection==='limited'?'Limited packs are currently unavailable.':'Packs are currently unavailable.';$('#catalog-retry').hidden=loading||!failures;
 }
 async function load(){
  const ticket=++generation;catalogs=new Map();selected=null;loading=true;failures=false;machine.setAttribute('aria-busy','true');render();
  try{if(window.RIPPR_AUTH_OFFLINE||typeof window.RipprFirebase?.loadPackContents!=='function')throw Error('Saved catalogs unavailable');const results=await Promise.allSettled(all.map(async pack=>{let timeout;try{const saved=await Promise.race([window.RipprFirebase.loadPackContents(pack.id),new Promise((_,reject)=>{timeout=setTimeout(()=>reject(Error('Catalog timeout')),6500)})]);if(saved.source!=='firebase'||!Number.isInteger(saved.version)||saved.version<1||window.RipprCatalog.validateItems(saved.items).length)throw Error('Invalid saved catalog');if(!saved.enabled)return{id:pack.id,selectable:false};if(!Number.isSafeInteger(saved.savedPriceCents)||saved.savedPriceCents<0)throw Error('Unpriced pack');return{id:pack.id,selectable:true,priceCents:saved.savedPriceCents}}catch(error){if(error?.code==='catalog/unconfigured')return{id:pack.id,selectable:false};throw error}finally{clearTimeout(timeout)}}));if(ticket!==generation)return;catalogs=new Map(results.filter(result=>result.status==='fulfilled').map(result=>[result.value.id,result.value]));failures=results.some(result=>result.status==='rejected')}
  catch{if(ticket!==generation)return;failures=true}
  if(ticket===generation){loading=false;machine.setAttribute('aria-busy','false');render()}
 }
 // Short, cosmetic navigation transition. No purchase or inventory action happens here.
 function containedRect(img){
  const box=img.getBoundingClientRect(),ratio=img.naturalWidth/img.naturalHeight;
  const width=Math.min(box.width,box.height*ratio),height=width/ratio;
  return{left:box.left+(box.width-width)/2,top:box.bottom-height,width,height,bottom:box.bottom};
 }
 function resetFlight(){
  const trip=flight;if(!trip)return;flight=null;
  clearTimeout(trip.timer);clearTimeout(trip.recovery);
  for(const effect of trip.effects)effect.cancel();
  for(const node of trip.nodes)node.remove();
  for(const [button,disabled]of trip.buttons)button.disabled=disabled;
  trip.slot.classList.remove('is-vending');machine.classList.remove('is-dispensing');
  machine.setAttribute('aria-busy',String(loading));renderSelection();
 }
 function finishFlight(){
  const trip=flight;if(!trip||trip.navigating)return;trip.navigating=true;clearTimeout(trip.timer);
  // Recover if the browser or an extension blocks navigation; never retry a navigation automatically.
  trip.recovery=setTimeout(resetFlight,1500);
  try{location.assign(trip.href)}catch{resetFlight()}
 }
 function play(trip,node,frames,options){
  const effect=node.animate(frames,{fill:'both',...options});trip.effects.push(effect);
  effect.finished.catch(()=>{});return effect;
 }
 function dispense(event){
  const view=event.currentTarget;
  if(event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey||view.hasAttribute('download')||(view.target&&view.target!=='_self'))return;
  if(flight){event.preventDefault();return}
  if(!selected||view.getAttribute('aria-disabled')==='true'||!view.hasAttribute('href')||reduced.matches||document.hidden)return;
  const slot=machine.querySelector('.vending-slot.is-active'),front=slot?.querySelector('.vending-pack-front'),glass=machine.querySelector('.vending-window'),hatch=machine.querySelector('.vending-hatch');
  if(!front?.complete||!front.naturalWidth||!front.animate||!glass||!hatch)return;
  const source=containedRect(front),glassBox=glass.getBoundingClientRect(),hatchBox=hatch.getBoundingClientRect();
  if(!source.width||!hatchBox.width)return;
  event.preventDefault();
  const visible=source.top>=-source.height*.2&&source.bottom<=innerHeight+source.height*.2;
  const trip=flight={href:view.href,slot,effects:[],nodes:[],buttons:[],timer:null,recovery:null,navigating:false};
  machine.classList.add('is-dispensing');machine.setAttribute('aria-busy','true');view.setAttribute('aria-disabled','true');
  for(const button of document.querySelectorAll('.vending-machine button,[data-collection],#catalog-retry')){trip.buttons.push([button,button.disabled]);button.disabled=true}
  trip.timer=setTimeout(finishFlight,visible?740:560);
  try{
   const overlay=document.createElement('div');overlay.className='vending-dispense';overlay.setAttribute('aria-hidden','true');glass.append(overlay);trip.nodes.push(overlay);
   if(visible){
    const drop=front.cloneNode();drop.className='vending-dispense-pack';drop.alt='';Object.assign(drop.style,{left:source.left-glassBox.left+'px',top:source.top-glassBox.top+'px',width:source.width+'px',height:source.height+'px'});overlay.append(drop);slot.classList.add('is-vending');
    const distance=glassBox.bottom-source.top+source.height*.2;
    play(trip,drop,[{transform:'translate3d(0,0,0) rotate(0deg)',opacity:1},{transform:'translate3d(1px,8px,0) rotate(-5deg)',opacity:1,offset:.24},{transform:`translate3d(5px,${distance}px,0) rotate(16deg)`,opacity:.9}],{duration:460,delay:65,easing:'cubic-bezier(.5,.02,.84,.46)'});
   }
   const coilImage=slot.querySelector('.vending-coil');
   if(coilImage?.naturalWidth){
    const coilBox=containedRect(coilImage),art=slot.querySelector('.vending-slot-art'),artBox=art.getBoundingClientRect();
    const motor=document.createElement('span');motor.className='vending-coil-motion';motor.setAttribute('aria-hidden','true');Object.assign(motor.style,{left:coilBox.left-artBox.left+'px',top:coilBox.top-artBox.top+'px',width:coilBox.width+'px',height:coilBox.height+'px'});
    for(let n=0;n<2;n++){const ring=document.createElement('i');motor.append(ring);play(trip,ring,[{transform:'rotate(0deg)'},{transform:'rotate(360deg)'}],{duration:480,easing:'cubic-bezier(.3,.05,.4,1)'})}art.append(motor);trip.nodes.push(motor);
    play(trip,coilImage,[{transform:'translateY(0)'},{transform:'translateY(1.5px)',offset:.22},{transform:'translateY(-1px)',offset:.55},{transform:'translateY(0)'}],{duration:480,easing:'ease-in-out'});
   }
   const tray=document.createElement('img');tray.className='vending-tray-pack';tray.src=front.currentSrc||front.src;tray.alt='';tray.setAttribute('aria-hidden','true');tray.width=front.naturalWidth;tray.height=front.naturalHeight;tray.style.height=Math.min(135,hatchBox.height*1.18)+'px';hatch.append(tray);trip.nodes.push(tray);
   const delay=visible?370:110;
   play(trip,tray,[{transform:'translate(-50%,calc(-50% - 70px)) rotate(65deg) scale(.85)',opacity:0},{transform:'translate(-50%,calc(-50% - 32px)) rotate(76deg) scale(.97)',opacity:1,offset:.3},{transform:'translate(-50%,calc(-50% + 5px)) rotate(84deg)',opacity:1,offset:.78},{transform:'translate(-50%,-50%) rotate(82deg)',opacity:1}],{duration:300,delay,easing:'cubic-bezier(.22,.65,.36,1)'});
   play(trip,hatch.querySelector('.vending-flap'),[{transform:'perspective(350px) skewX(-7deg) rotateX(0deg)'},{transform:'perspective(350px) skewX(-7deg) rotateX(-26deg)',offset:.5},{transform:'perspective(350px) skewX(-7deg) rotateX(0deg)'}],{duration:390,delay:Math.max(0,delay-55),easing:'ease-in-out'});
   // A tiny foil pass in the button keeps feedback visible if the tray is below the fold.
   if(hatchBox.top>=innerHeight-25||hatchBox.bottom<=0){
    const preview=tray.cloneNode();preview.className='vending-inline-pack';preview.style.height='32px';view.append(preview);trip.nodes.push(preview);
    play(trip,preview,[{transform:'translateY(-145%) rotate(-12deg)',opacity:0},{transform:'translateY(-50%) rotate(7deg)',opacity:1,offset:.65},{transform:'translateY(-50%) rotate(0deg)',opacity:1}],{duration:350,delay:80,easing:'cubic-bezier(.2,.8,.3,1)'});
   }
  }catch{finishFlight()}
 }
 $('#vending-view-pack').addEventListener('click',dispense);
 window.addEventListener('pagehide',resetFlight);window.addEventListener('pageshow',resetFlight);
 window.addEventListener('resize',()=>{if(flight)finishFlight()});
 document.addEventListener('visibilitychange',()=>{if(document.hidden&&flight)finishFlight()});
 reduced.addEventListener('change',()=>{if(reduced.matches&&flight)finishFlight()});
 $('#vending-minus').addEventListener('click',()=>{if(!flight&&selected&&quantity>1){quantity--;renderSelection()}});$('#vending-plus').addEventListener('click',()=>{if(!flight&&selected&&quantity<5){quantity++;renderSelection()}});
 document.querySelectorAll('[data-collection]').forEach(button=>button.addEventListener('click',()=>{if(flight)return;collection=button.dataset.collection;selected=null;quantity=1;document.querySelectorAll('[data-collection]').forEach(option=>option.setAttribute('aria-pressed',String(option===button)));render()}));
 machine.addEventListener('keydown',event=>{if(flight||!event.target.matches('.vending-slot[data-vending-pack]')||!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();const packs=choices().filter(pack=>pack.selectable);if(!selected||!packs.length)return;const current=packs.findIndex(pack=>pack.id===selected.id),next=event.key==='Home'?0:event.key==='End'?packs.length-1:Math.max(0,Math.min(packs.length-1,current+(event.key==='ArrowRight'?1:-1)));setSelection(packs[next]);document.querySelector('.vending-slot.is-active')?.focus()});
 $('#catalog-retry').addEventListener('click',()=>{if(!flight)void load()});void load();
})();
