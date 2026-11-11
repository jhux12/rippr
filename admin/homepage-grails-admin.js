(() => {
 'use strict';
 const $=s=>document.querySelector(s),client=window.RipprFirebase,model=window.RipprCatalog;
 const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const owner=()=>model.isAdminUser(client?.currentUser());
 const empty=()=>({version:0,items:[],source:'default'});
 let config=empty(),loaded=false,busy=false,globalBusy=false,dirty=false,generation=0,uploadingId=null;
 const values=new Map();
 const imageURL=value=>model.safeImageURL(value)?(value.startsWith('assets/')?'/'+value:value):'';
 const message=(copy='',isError=false)=>{const el=$(isError?'#homepage-grails-error':'#homepage-grails-status');el.textContent=copy;el.hidden=!copy};
 function errorText(error){
  if(/conflict/.test(error?.code||''))return 'Homepage grails changed in another session. Reload saved before saving again. Your draft is still here.';
  if(/permission-denied|unauthorized/.test(error?.code||''))return 'Access was denied. Check your verified owner sign-in and Firebase rules.';
  if(/invalid-data|invalid-image/.test(error?.code||''))return error.message;
  return 'Could not connect. Your draft is still here. Check your connection and retry.';
 }
 function fail(error){message();message(errorText(error),true)}
 function controls(){
  const blocked=busy||globalBusy||!loaded||!owner();
  $('#homepage-grails-form').querySelectorAll('input,button,select').forEach(el=>el.disabled=blocked);
  $('#reload-homepage-grails').disabled=busy||globalBusy||!owner();
  $('#save-homepage-grails').disabled=blocked||!dirty;
  $('#save-homepage-grails').textContent=busy?'Working…':'Save homepage grails';
  $('#homepage-grail-rows').querySelectorAll('[data-homepage-id]').forEach(row=>{const item=config.items.find(i=>i.id===row.dataset.homepageId);row.querySelectorAll('[data-homepage-field=company],[data-homepage-field=grade]').forEach(el=>el.disabled=blocked||!item?.grading)});
  $('#add-homepage-grail').disabled=blocked||config.items.length>=6;
  $('#homepage-grails-form').setAttribute('aria-busy',String(busy));
  $('#homepage-grails-dirty').hidden=!dirty;
  $('#homepage-grails-count').textContent=`${config.items.length} / 6 cards`;
  document.querySelectorAll('[data-homepage-move]').forEach(el=>{
   const index=config.items.findIndex(item=>item.id===el.dataset.id);
   el.disabled=blocked||(el.dataset.homepageMove==='up'?index===0:index===config.items.length-1);
  });
 }
 function markDirty(){dirty=true;message();message('',true);controls()}
 function render(){
  $('#homepage-grail-rows').innerHTML=config.items.map((item,index)=>`<article class="homepage-grail-row" data-homepage-id="${escape(item.id)}"><div class="homepage-grail-image"><img src="${escape(imageURL(item.image)||'/assets/card-placeholder.svg')}" alt="${escape(item.name||'New homepage card')}" ${item.image?'':'hidden'}><span ${item.image?'hidden':''}>Upload a card photo</span></div><div class="homepage-grail-fields"><label for="homepage-name-${escape(item.id)}">Card name<input id="homepage-name-${escape(item.id)}" data-homepage-field="name" type="text" maxlength="160" value="${escape(item.name)}" autocomplete="off" required></label><label for="homepage-value-${escape(item.id)}">Value ($)<input id="homepage-value-${escape(item.id)}" data-homepage-field="value" type="text" inputmode="decimal" value="${escape(values.get(item.id)??(Number.isInteger(item.valueCents)?(item.valueCents/100).toFixed(2):''))}" autocomplete="off" required></label><label>Condition<select data-homepage-field="condition"><option value="raw" ${!item.grading?'selected':''}>Raw · Near Mint</option><option value="graded" ${item.grading?'selected':''}>Graded slab</option></select></label><label>Grading company<select data-homepage-field="company" ${!item.grading?'disabled':''}>${model.GRADING_COMPANIES.map(company=>`<option ${item.grading?.company===company?'selected':''}>${company}</option>`).join('')}</select></label><label>Grade<input data-homepage-field="grade" type="text" inputmode="decimal" maxlength="4" placeholder="10" value="${escape(item.grading?.grade||'')}" ${!item.grading?'disabled':''}></label><div class="homepage-grail-row-actions"><button type="button" class="button secondary" data-homepage-upload="${escape(item.id)}">Upload photo</button><div class="homepage-grail-order"><button type="button" class="button secondary" data-homepage-move="up" data-id="${escape(item.id)}" aria-label="Move card ${index+1} up">↑</button><button type="button" class="button secondary" data-homepage-move="down" data-id="${escape(item.id)}" aria-label="Move card ${index+1} down">↓</button><button type="button" class="button secondary homepage-grail-remove" data-homepage-remove="${escape(item.id)}" aria-label="Remove card ${index+1}">Remove</button></div></div></div></article>`).join('');
  $('#homepage-grails-empty').hidden=config.items.length>0;
  controls();
 }
 async function load(){
  if(!owner()||busy||globalBusy)return;
  const ticket=++generation,uid=client.currentUser().uid;
  busy=true;message('Loading homepage grails…');message('',true);controls();
  try{
   const saved=await client.loadHomepageGrails();
   if(ticket!==generation||uid!==client.currentUser()?.uid||!owner())return;
   config=structuredClone(saved);loaded=true;dirty=false;values.clear();
   message(saved.source==='firebase'?'Saved homepage grails loaded.':'Default homepage grails loaded. Save to publish your selection.');render();
  }catch(error){if(ticket===generation&&uid===client.currentUser()?.uid)fail(error)}
  finally{if(ticket===generation){busy=false;controls()}}
 }
 function reset(){generation++;config=empty();loaded=false;busy=false;dirty=false;uploadingId=null;values.clear();$('#homepage-grail-file').value='';message();message('',true);render()}
 document.addEventListener('rippr:adminview',event=>{if(event.detail.name==='settings'&&!loaded)void load()});
 document.addEventListener('rippr:adminbusy',event=>{globalBusy=event.detail.busy;controls();if(!globalBusy&&!loaded&&!$('#settings-view').hidden)void load()});
 document.addEventListener('rippr:authchange',()=>{reset();if(owner()&&!$('#settings-view').hidden)void load()});
 $('#homepage-grail-rows').addEventListener('input',event=>{
  if(busy||globalBusy||!owner())return;
  const row=event.target.closest('[data-homepage-id]'),field=event.target.dataset.homepageField;
  const item=config.items.find(item=>item.id===row?.dataset.homepageId);if(!item||!field)return;
  if(field==='name')item.name=event.target.value;
  else if(field==='condition'){if(event.target.value==='graded')item.grading={company:'PSA',grade:''};else delete item.grading;render()}
  else if(field==='company'||field==='grade'){if(item.grading)item.grading[field]=event.target.value}
  else{values.set(item.id,event.target.value);item.valueCents=model.decimalToUnits(event.target.value)}
  markDirty();
 });
 $('#homepage-grail-rows').addEventListener('click',event=>{
  if(busy||globalBusy||!loaded||!owner())return;
  const upload=event.target.closest('[data-homepage-upload]'),remove=event.target.closest('[data-homepage-remove]'),move=event.target.closest('[data-homepage-move]');
  if(upload){uploadingId=upload.dataset.homepageUpload;$('#homepage-grail-file').click()}
  else if(remove){config.items=config.items.filter(item=>item.id!==remove.dataset.homepageRemove);values.delete(remove.dataset.homepageRemove);markDirty();render()}
  else if(move){const index=config.items.findIndex(item=>item.id===move.dataset.id),next=index+(move.dataset.homepageMove==='up'?-1:1);if(index<0||next<0||next>=config.items.length)return;[config.items[index],config.items[next]]=[config.items[next],config.items[index]];markDirty();render();document.querySelector(`[data-homepage-move="${move.dataset.homepageMove}"][data-id="${move.dataset.id}"]`)?.focus()}
 });
 $('#homepage-grail-rows').addEventListener('error',event=>{if(event.target.tagName!=='IMG')return;event.target.hidden=true;const fallback=event.target.nextElementSibling;fallback.textContent='Image unavailable';fallback.hidden=false},{capture:true});
 $('#homepage-grail-file').addEventListener('change',async event=>{
  const file=event.target.files[0],id=uploadingId;event.target.value='';uploadingId=null;
  if(!file||busy||globalBusy||!owner()||!config.items.some(item=>item.id===id))return;
  if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>5*1024*1024||file.size===0){message('Choose a JPG, PNG or WebP image up to 5 MB.',true);return}
  const ticket=generation,uid=client.currentUser().uid;busy=true;message('Uploading card photo…');message('',true);controls();
  try{
   const url=await client.uploadHomepageGrailImage(file);
   if(ticket!==generation||uid!==client.currentUser()?.uid||!owner())return;
   const item=config.items.find(item=>item.id===id);if(!item)return;
   item.image=url;dirty=true;message('Photo uploaded. Save homepage grails to publish it.');render();
  }catch(error){if(ticket===generation&&uid===client.currentUser()?.uid)fail(error)}
  finally{if(ticket===generation){busy=false;controls()}}
 });
 $('#add-homepage-grail').addEventListener('click',()=>{
  if(busy||globalBusy||!owner()||!loaded||config.items.length>=6)return;
  const id='grail-'+crypto.randomUUID();config.items.push({id,name:'',image:'',valueCents:0});values.set(id,'0.00');markDirty();render();$('#homepage-name-'+id).focus();
 });
 $('#reload-homepage-grails').addEventListener('click',()=>{if(!dirty||confirm('Discard unsaved homepage grail changes?'))void load()});
 $('#homepage-grails-form').addEventListener('submit',async event=>{
  event.preventDefault();if(busy||globalBusy||!loaded||!owner())return;
  const invalid=config.items.find(item=>!item.name.trim()||item.name.trim().length>160||!model.safeImageURL(item.image)||item.image.length>2048||!Number.isInteger(item.valueCents)||item.valueCents<0||item.valueCents>100000000);
  if(invalid){message('Each card needs a name, uploaded photo and value from $0 to $1,000,000 with up to two decimal places.',true);return}
  const ticket=generation,uid=client.currentUser().uid,draft={...config,items:config.items.map(item=>({...item,name:item.name.trim()}))};
  busy=true;message('Saving homepage grails…');message('',true);controls();
  try{
   const saved=await client.saveHomepageGrails(draft,config.version);
   if(ticket!==generation||uid!==client.currentUser()?.uid||!owner())return;
   config=structuredClone(saved);dirty=false;values.clear();message('Homepage grails saved. The homepage now uses these photos and values.');render();
  }catch(error){if(ticket===generation&&uid===client.currentUser()?.uid)fail(error)}
  finally{if(ticket===generation){busy=false;controls()}}
 });
 window.RipprHomepageAdmin={get dirty(){return dirty},get busy(){return busy}};
 window.addEventListener('beforeunload',event=>{if(owner()&&dirty){event.preventDefault();event.returnValue=''}});
 render();
})();
