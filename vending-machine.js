(()=>{
 'use strict';
 const machine=document.querySelector('.vending-machine');if(!machine)return;
 const $=selector=>document.querySelector(selector),all=window.RIPPR_PACKS||[],money=new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'});
 let catalogs=new Map(),collection='core',selected=null,quantity=1,generation=0,failures=false,loading=true;
 const choices=()=>all.filter(pack=>collection==='limited'?pack.limited:!pack.limited).map(pack=>({...pack,...catalogs.get(pack.id)}));
 const remember={core:null,limited:null},asset=path=>window.RIPPR_ASSET_URLS?.[path]||path;
 function coil(){const img=document.createElement('img');img.src=asset('assets/vending/dispensing-coil.webp');img.className='vending-coil';img.alt='';img.setAttribute('aria-hidden','true');img.width=220;img.height=100;return img}
 function setSelection(pack){if(!pack?.selectable)return;selected=pack;remember[collection]=pack.id;renderSelection();for(const button of document.querySelectorAll('.vending-slot[data-vending-pack]')){const active=button.dataset.vendingPack===pack.id;button.setAttribute('aria-pressed',String(active));button.classList.toggle('is-active',active)}}
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
   const tag=document.createElement('span');tag.className='vending-selected-label';tag.textContent='Selected';art.append(tag,coil());
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
 $('#vending-minus').addEventListener('click',()=>{if(selected&&quantity>1){quantity--;renderSelection()}});$('#vending-plus').addEventListener('click',()=>{if(selected&&quantity<5){quantity++;renderSelection()}});
 document.querySelectorAll('[data-collection]').forEach(button=>button.addEventListener('click',()=>{collection=button.dataset.collection;selected=null;quantity=1;document.querySelectorAll('[data-collection]').forEach(option=>option.setAttribute('aria-pressed',String(option===button)));render()}));
 machine.addEventListener('keydown',event=>{if(!event.target.matches('.vending-slot[data-vending-pack]')||!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();const packs=choices().filter(pack=>pack.selectable);if(!selected||!packs.length)return;const current=packs.findIndex(pack=>pack.id===selected.id),next=event.key==='Home'?0:event.key==='End'?packs.length-1:Math.max(0,Math.min(packs.length-1,current+(event.key==='ArrowRight'?1:-1)));setSelection(packs[next]);document.querySelector('.vending-slot.is-active')?.focus()});
 $('#catalog-retry').addEventListener('click',()=>void load());void load();
})();
