(()=>{
 'use strict';
 const machine=document.querySelector('.vending-machine');if(!machine)return;
 const $=selector=>document.querySelector(selector),all=window.RIPPR_PACKS||[],money=new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'});
 let available=[],collection='core',selected=null,bank=0,quantity=1,generation=0,failures=false;
 const choices=()=>available.filter(pack=>collection==='limited'?pack.limited:!pack.limited),count=()=>Math.max(1,Math.ceil(choices().length/3));
 const remember={core:null,limited:null},asset=path=>window.RIPPR_ASSET_URLS?.[path]||path;
 function coil(){const img=document.createElement('img');img.src=asset('assets/vending/dispensing-coil.webp');img.className='vending-coil';img.alt='';img.setAttribute('aria-hidden','true');img.width=220;img.height=100;return img}

 function setSelection(pack,moveFocus=false){selected=pack;remember[collection]=pack.id;renderSelection();for(const button of document.querySelectorAll('[data-vending-pack]')){const active=button.dataset.vendingPack===pack.id;button.setAttribute('aria-pressed',String(active));button.classList.toggle('is-active',active)}if(moveFocus)document.querySelector('.vending-slot.is-active')?.focus();}
 function renderSelection(){
  const pack=selected,img=$('#vending-selected-art'),view=$('#vending-view-pack'),odds=$('#vending-odds');machine.classList.toggle('has-selection',Boolean(pack));
  $('#vending-quantity').textContent=String(quantity);$('#vending-minus').disabled=!pack||quantity<=1;$('#vending-plus').disabled=!pack||quantity>=5;
  img.hidden=!pack;$('#vending-selected-name').textContent=pack?pack.name+' pack':'Choose a pack';$('#vending-selected-price').textContent=pack?money.format(pack.priceCents*quantity/100):'—';
  $('#vending-unit-price').hidden=!pack||quantity===1;$('#vending-unit-price').textContent=pack&&quantity>1?money.format(pack.priceCents/100)+' each · '+quantity+' packs':'';
  if(pack){img.src=asset(pack.image);img.alt=pack.name+' pack';machine.style.setProperty('--vending-accent',pack.accent);const url='opening.html?pack='+encodeURIComponent(pack.id)+'&quantity='+quantity;view.href=url;odds.href=url+'#odds-title';view.removeAttribute('aria-disabled');odds.removeAttribute('aria-disabled');view.removeAttribute('tabindex');odds.removeAttribute('tabindex');view.dataset.total=money.format(pack.priceCents*quantity/100);view.setAttribute('aria-label','View '+quantity+' '+pack.name+' pack'+(quantity===1?'':'s')+', '+money.format(pack.priceCents*quantity/100)+' total');view.firstElementChild.textContent='View pack';}
  else{img.removeAttribute('src');delete view.dataset.total;view.removeAttribute('href');odds.removeAttribute('href');for(const link of [view,odds]){link.setAttribute('aria-disabled','true');link.tabIndex=-1}}
 }
 function render(){
  const packs=choices(),root=$('#pack-grid'),keys=$('#tier-selectors');root.replaceChildren();keys.replaceChildren();bank=Math.max(0,Math.min(bank,count()-1));machine.dataset.vendingCollection=collection;
  const visible=packs.slice(bank*3,bank*3+3);root.style.setProperty('--slot-count',visible.length||3);root.dataset.slotCount=String(visible.length);$('#vending-empty').hidden=Boolean(visible.length);
  if(!visible.length){selected=null;$('#vending-empty p').textContent=failures?'The packs couldn’t load. Try again below.':collection==='limited'?'Limited packs are coming soon.':'No packs are available right now.';renderSelection();}
  else{
   if(!selected||!visible.some(pack=>pack.id===selected.id))selected=visible.find(pack=>pack.id===remember[collection])||visible[0];
   for(const [index,pack]of visible.entries()){
    const slot=document.createElement('button');slot.type='button';slot.className='vending-slot tier-slide';slot.dataset.vendingPack=pack.id;slot.dataset.packId=pack.id;slot.style.setProperty('--slot-accent',pack.accent);slot.setAttribute('aria-label','Select '+pack.name+' pack, '+money.format(pack.priceCents/100));
    const art=document.createElement('span');art.className='vending-slot-art';for(let depth=3;depth>=0;depth--){const img=document.createElement('img');img.src=asset(pack.image);img.width=250;img.height=390;img.alt=depth?'':pack.name+' rippr foil pack';img.draggable=false;img.className=depth?'vending-pack-back depth-'+depth:'vending-pack-front';art.append(img)}const selectedLabel=document.createElement('span');selectedLabel.className='vending-selected-label';selectedLabel.textContent='Selected';art.append(selectedLabel,coil(pack.id));
    const label=document.createElement('span');label.className='vending-slot-label';const code=document.createElement('span');code.className='vending-slot-code';code.textContent='A'+(index+1);const name=document.createElement('span');name.className='vending-slot-price';name.textContent=pack.name+' '+money.format(pack.priceCents/100);label.append(code,name);slot.append(art,label);slot.addEventListener('click',()=>setSelection(pack));root.append(slot);
    const key=document.createElement('button');key.type='button';key.className='vending-key';key.dataset.vendingPack=pack.id;key.textContent='A'+(index+1);key.setAttribute('aria-label','Select '+pack.name+' in slot A'+(index+1));key.addEventListener('click',()=>setSelection(pack));keys.append(key);
   }
   setSelection(selected);
  }
  const controls=$('.vending-bank-controls');controls.hidden=packs.length<=3;$('#previous-pack').disabled=bank===0;$('#next-pack').disabled=bank>=count()-1;$('#vending-bank-label').textContent=(bank+1)+' / '+count();
  $('#catalog-status').textContent=failures?'Some packs couldn’t load. Showing available packs only.':packs.length?`${packs.length} ${collection==='limited'?'limited':'core'} pack${packs.length===1?'':'s'} available. Select a pack to view its contents and odds.`:collection==='limited'?'No limited packs available. Check back for the next edition.':'Packs are unavailable right now.';$('#catalog-retry').hidden=!failures;
 }
 async function load(){
  const ticket=++generation;available=[];selected=null;machine.setAttribute('aria-busy','true');$('#catalog-status').textContent='Loading current packs…';$('#catalog-retry').hidden=true;$('#pack-grid').replaceChildren();$('#tier-selectors').replaceChildren();$('#vending-empty').hidden=false;$('#vending-empty p').textContent='Loading the pack station…';renderSelection();
  try{if(window.RIPPR_AUTH_OFFLINE||typeof window.RipprFirebase?.loadPackContents!=='function')throw Error('Saved catalogs unavailable');const results=await Promise.allSettled(all.map(async pack=>{let timeout;try{const saved=await Promise.race([window.RipprFirebase.loadPackContents(pack.id),new Promise((_,reject)=>{timeout=setTimeout(()=>reject(Error('Catalog timeout')),6500)})]);if(saved.source!=='firebase'||!Number.isInteger(saved.version)||saved.version<1||window.RipprCatalog.validateItems(saved.items).length)throw Error('Invalid saved catalog');if(!saved.enabled)return null;if(!Number.isSafeInteger(saved.savedPriceCents)||saved.savedPriceCents<0)throw Error('Unpriced pack');return{...pack,priceCents:saved.savedPriceCents}}catch(error){if(error?.code==='catalog/unconfigured')return null;throw error}finally{clearTimeout(timeout)}}));if(ticket!==generation)return;available=results.filter(result=>result.status==='fulfilled'&&result.value).map(result=>result.value);failures=results.some(result=>result.status==='rejected');}
  catch{if(ticket!==generation)return;available=[];failures=true}
  if(ticket===generation){machine.setAttribute('aria-busy','false');render();}
 }
 $('#vending-minus').addEventListener('click',()=>{if(selected&&quantity>1){quantity--;renderSelection()}});$('#vending-plus').addEventListener('click',()=>{if(selected&&quantity<5){quantity++;renderSelection()}});
 for(const [id,direction]of [['previous-pack',-1],['next-pack',1]])$('#'+id).addEventListener('click',()=>{bank+=direction;render()});
 document.querySelectorAll('[data-collection]').forEach(button=>button.addEventListener('click',()=>{collection=button.dataset.collection;selected=null;bank=0;quantity=1;document.querySelectorAll('[data-collection]').forEach(option=>option.setAttribute('aria-pressed',String(option===button)));const position=choices().findIndex(pack=>pack.id===remember[collection]);if(position>=0)bank=Math.floor(position/3);render()}));
 machine.addEventListener('keydown',event=>{if(!event.target.matches('[data-vending-pack]')||!['ArrowLeft','ArrowRight'].includes(event.key))return;event.preventDefault();const packs=choices();if(!selected||!packs.length)return;const current=packs.findIndex(pack=>pack.id===selected.id),next=Math.max(0,Math.min(packs.length-1,current+(event.key==='ArrowRight'?1:-1)));if(next===current)return;bank=Math.floor(next/3);selected=packs[next];render();document.querySelector('.vending-slot.is-active')?.focus()});
 $('#catalog-retry').addEventListener('click',()=>void load());void load();
})();
