(() => {
 'use strict';
 const $=selector=>document.querySelector(selector),targetUid=new URLSearchParams(location.search).get('user')||null;
 const room=$('#museum-room'),editor=$('#museum-editor'),preview=$('#museum-card-dialog'),share=$('#museum-share-dialog');
 const mobileCaption=document.createElement('p'),captionText=document.createElement('span');mobileCaption.id='museum-active-name';mobileCaption.className='museum-mobile-caption';captionText.className='museum-caption-text';mobileCaption.append(captionText);mobileCaption.hidden=true;$('#museum-displays').after(mobileCaption);room.dataset.hasCards='false';room.dataset.loading='false';
 const displays=$('#museum-displays'),featureTrack=$('#museum-featured-track'),displayNodes=new Map(),featureNodes=new Map(),preloaded=new Map(),motion=matchMedia('(prefers-reduced-motion: reduce)'),narrow=matchMedia('(max-width:1000px)');
 const positions=['is-center','slot-left','slot-right','slot-back-left','slot-back-middle','slot-back-right'];
 let addDisplayNode=null,selectionAnimation=null,suppressClickUntil=0,swipe=null;
 const client=window.RipprFirebase,actor=()=>window.RIPPR_ACCOUNT?.user?.uid||null;
 let museum=null,canEdit=false,selectedIndex=0,request=0,saving=false,liking=false,returnFocus=null,draftIds=[],inventorySignature='';
 const cards=()=>museum?.cards||[];
 const safeURL=url=>window.RipprCatalog?.safeImageURL(url)===true;
 const asset=url=>safeURL(url)?window.RIPPR_ASSET_URLS?.[url]||url:'assets/card-placeholder.svg';
 const picture=(url,alt,cls='')=>{const img=document.createElement('img');img.src=asset(url);img.alt=alt;img.className=cls;img.draggable=false;img.decoding='async';img.addEventListener('error',()=>{img.src='assets/card-placeholder.svg'},{once:true});return img};
 const publicURL=uid=>{const url=new URL('museum',location.href);url.searchParams.set('user',uid);return url.href};
 function loginURL(){return 'auth.html?mode=login&next='+encodeURIComponent(location.pathname+location.search+location.hash)}
 function service(action,data={}){if(!client?.museumAction)return Promise.reject(new Error('Museum services are unavailable. Please try again.'));return client.museumAction(action,data)}
 function errorCopy(error){if(error?.code==='functions/not-found')return 'This museum is private or unavailable.';if(error?.code==='functions/unauthenticated')return 'Log in to continue.';if(['functions/invalid-argument','functions/failed-precondition','functions/aborted','functions/already-exists'].includes(error?.code))return error.message;return 'The museum could not load. Please try again.'}
 function notice(message){$('#museum-notice').hidden=!message;$('#museum-notice').textContent=message||''}
 function button(text,handler,primary=false){const el=document.createElement('button');el.type='button';el.className='museum-button'+(primary?' museum-primary':'');el.textContent=text;el.addEventListener('click',handler);return el}
 function link(text,href,primary=false){const el=document.createElement('a');el.className='museum-button'+(primary?' museum-primary':'');el.href=href;el.textContent=text;return el}
 function dialogState(){document.body.classList.toggle('museum-dialog-open',[editor,preview,share].some(dialog=>dialog.open));document.dispatchEvent(new CustomEvent('rippr:navigationchange',{detail:{menuOpen:false,dialogOpen:Boolean(document.querySelector('dialog[open]'))}}))}
 function openDialog(dialog,trigger){returnFocus=trigger||document.activeElement;dialog.showModal();dialogState()}
 for(const dialog of [editor,preview,share]){dialog.addEventListener('close',()=>{dialogState();returnFocus?.focus({preventScroll:true})});dialog.addEventListener('click',event=>{if(event.target!==dialog||dialog===editor&&saving)return;const b=dialog.getBoundingClientRect();if(event.clientX<b.left||event.clientX>b.right||event.clientY<b.top||event.clientY>b.bottom)dialog.close()})}
 editor.addEventListener('cancel',event=>{if(saving)event.preventDefault()});
 document.querySelectorAll('[data-close]').forEach(el=>el.addEventListener('click',()=>{if(el.dataset.close==='museum-editor'&&saving)return;$('#'+el.dataset.close).close()}));
 function showState(title,copy='',actions=[]){
  $('#museum-state').hidden=false;$('#museum-state-title').textContent=title;$('#museum-state-copy').textContent=copy;$('#museum-state-actions').className='museum-state-actions';$('#museum-state-actions').replaceChildren(...actions);
 }
 function stopSelectionMotion(){selectionAnimation?.cancel();selectionAnimation=null}
 function clearGallery(){stopSelectionMotion();displayNodes.clear();featureNodes.clear();preloaded.clear();addDisplayNode=null;displays.replaceChildren();featureTrack.replaceChildren();swipe=null;suppressClickUntil=0}
 function clearView(){captionText.textContent='';mobileCaption.hidden=true;room.dataset.hasCards='false';room.dataset.loading='false';museum=null;canEdit=false;selectedIndex=0;clearGallery();$('#museum-featured').hidden=true;$('#museum-owner').hidden=true;for(const id of ['museum-edit','museum-like','museum-share','museum-inspect','museum-room-nav'])$('#'+id).hidden=true;$('#museum-title').textContent='My museum';$('#museum-description').textContent='A collection worth sharing.';$('#museum-description').dataset.default='true'}
 function updateLike(){
  if(!museum)return;
  const owner=canEdit&&museum.uid===actor();
  $('#museum-like').hidden=owner||!museum.published;$('#museum-like').disabled=liking;$('#museum-like').setAttribute('aria-pressed',String(Boolean(museum.likedByMe)));$('#museum-likes').textContent=String(Math.max(0,Number(museum.likeCount)||0));
 }
 function updateIdentity(){
  const owner=canEdit&&museum.uid===actor(),identity=$('#museum-owner');
  let avatar=identity.querySelector('img'),by=identity.querySelector('span');
  if(!avatar){avatar=picture(museum.photoURL||'assets/mascot/pip-hover.png','');by=document.createElement('span');identity.append(avatar,by)}
  const src=asset(museum.photoURL||'assets/mascot/pip-hover.png');if(avatar.getAttribute('src')!==src)avatar.src=src;
  by.textContent=owner?(museum.published?'Public museum':'Private museum'):'Curated by '+(museum.displayName||'Collector');identity.hidden=false;
 }
 function readyArtwork(img,glass){
  const source=img.getAttribute('src');
  const done=()=>{if(img.isConnected&&img.getAttribute('src')===source)glass.classList.remove('museum-image-pending')};
  if(img.decode)img.decode().then(done,done);else done();
 }
 function updateArtwork(img,glass,url){
  const source=asset(url);if(img.dataset.source===source)return;
  img.dataset.source=source;glass.classList.add('museum-image-pending');img.src=source;
  if(img.complete&&img.naturalWidth)readyArtwork(img,glass);
 }
 function reconcileDisplays(){
  const items=cards(),ids=new Set(items.map(card=>card.id));
  for(const [id,node]of displayNodes)if(!ids.has(id)){node.remove();displayNodes.delete(id)}
  for(const [index,card]of items.entries()){
   let display=displayNodes.get(card.id);
   if(!display){
    display=document.createElement('button');display.type='button';display.className='museum-display';display.dataset.cardId=card.id;
    const glass=document.createElement('span');glass.className='museum-case museum-image-pending';const image=picture(card.image,card.name);image.addEventListener('load',()=>readyArtwork(image,glass));glass.append(image);
    const plaque=document.createElement('span');plaque.className='museum-plaque';display.append(glass,plaque);
    display.addEventListener('click',()=>{const current=cards().findIndex(item=>item.id===display.dataset.cardId);if(current<0)return;if(current===selectedIndex)inspect();else feature(current)});
    displayNodes.set(card.id,display);displays.append(display);
   }
   display.dataset.cardIndex=String(index);display.querySelector('img').alt=card.name;display.querySelector('.museum-plaque').textContent=card.name;
   updateArtwork(display.querySelector('img'),display.querySelector('.museum-case'),card.image);
  }
 }
 function renderFeatures(){
  const items=cards(),ids=new Set(items.map(card=>card.id));
  for(const [id,node]of featureNodes)if(!ids.has(id)){node.remove();featureNodes.delete(id)}
  for(const [index,card]of items.entries()){
   let node=featureNodes.get(card.id);
   if(!node){node=document.createElement('button');node.type='button';node.className='museum-feature';node.dataset.cardId=card.id;node.append(picture(card.image,''),document.createElement('span'));node.addEventListener('click',()=>{const i=cards().findIndex(item=>item.id===node.dataset.cardId);if(i>=0)feature(i)});featureNodes.set(card.id,node)}
   node.dataset.featureIndex=String(index);node.setAttribute('aria-label','Feature '+card.name);node.querySelector('span').textContent=card.name;
   const image=node.querySelector('img'),source=asset(card.image);if(image.getAttribute('src')!==source)image.src=source;
   const at=featureTrack.children[index];if(at!==node)featureTrack.insertBefore(node,at||null);
  }
  if(canEdit&&museum?.uid===actor()&&items.length<6){
   if(!addDisplayNode){addDisplayNode=button('',openEditor);addDisplayNode.className='museum-feature museum-add';const icon=document.createElement('b');icon.textContent='+';icon.setAttribute('aria-hidden','true');const text=document.createElement('span');text.textContent='Add a display';addDisplayNode.append(icon,text)}
   if(addDisplayNode.parentNode!==featureTrack)featureTrack.append(addDisplayNode);
  }else{addDisplayNode?.remove();addDisplayNode=null}
 }
 function preloadAdjacent(){
  const items=cards();if(!items.length)return;const nearby=new Set([selectedIndex,(selectedIndex+1)%items.length,(selectedIndex+items.length-1)%items.length].map(i=>asset(items[i].image)));
  for(const source of preloaded.keys())if(!nearby.has(source))preloaded.delete(source);
  for(const source of nearby)if(!preloaded.has(source)){const image=new Image();image.decoding='async';image.fetchPriority='low';image.src=source;preloaded.set(source,image);image.decode?.().catch(()=>{})}
 }
 function updateSelection(animate=false,direction=1){
  const items=cards();if(!items.length)return;selectedIndex=Math.min(selectedIndex,items.length-1);
  for(const [index,card]of items.entries()){
   const display=displayNodes.get(card.id),slot=(index-selectedIndex+items.length)%items.length;
   display.className='museum-display '+positions[slot];display.setAttribute('aria-label',(slot?'Feature ':'Inspect ')+card.name);display.setAttribute('aria-pressed',String(slot===0));display.querySelector('img').fetchPriority=slot?'auto':'high';
   featureNodes.get(card.id)?.setAttribute('aria-pressed',String(index===selectedIndex));
  }
  captionText.textContent=items[selectedIndex].name;mobileCaption.hidden=false;$('#museum-position').textContent=`Display ${selectedIndex+1} of ${items.length}`;
  stopSelectionMotion();
  if(animate&&narrow.matches&&!motion.matches){const current=displayNodes.get(items[selectedIndex].id);selectionAnimation=current.animate([{opacity:.18,translate:`${direction*10}px 0`},{opacity:1,translate:'0 0'}],{duration:240,easing:'cubic-bezier(.2,.7,.2,1)'});selectionAnimation.finished.then(()=>{selectionAnimation=null},()=>{})}
  preloadAdjacent();
 }
 function render(){
  const items=cards(),owner=canEdit&&museum?.uid===actor();room.setAttribute('aria-busy','false');room.dataset.loading='false';room.dataset.hasCards=String(Boolean(items.length));
  $('#museum-title').textContent=owner?'My museum':museum.title||'Collection museum';document.title=(owner?'My museum':museum.title||'Museum')+' — rippr';
  $('#museum-description').textContent=museum.description||'A collection worth sharing.';$('#museum-description').dataset.default=String(!museum.description);
  updateIdentity();$('#museum-edit').hidden=!owner;$('#museum-share').hidden=!(owner||museum.published);updateLike();
  if(!items.length){captionText.textContent='';mobileCaption.hidden=true;clearGallery();$('#museum-inspect').hidden=true;$('#museum-room-nav').hidden=true;$('#museum-featured').hidden=!owner;renderFeatures();showState(owner?'Your gallery starts here.':'This gallery is waiting for its next display.',owner?'Choose your favorite cards to create a museum of your own.':'Explore more collections from the community.',owner?[button('Add a display',openEditor,true),link('View my items','profile.html')]:[link('Browse collections','community.html',true)]);return}
  $('#museum-state').hidden=true;reconcileDisplays();renderFeatures();updateSelection();
  $('#museum-inspect').hidden=false;$('#museum-room-nav').hidden=false;$('#museum-prev').disabled=items.length<2;$('#museum-next').disabled=items.length<2;$('#museum-featured').hidden=false;
 }
 function feature(index,direction){
  const items=cards();if(!items.length)return;
  const previous=selectedIndex,from=document.activeElement,fromFeature=from?.classList.contains('museum-feature'),fromDisplay=from?.classList.contains('museum-display');
  selectedIndex=(index+items.length)%items.length;updateSelection(previous!==selectedIndex,direction??(index>previous?1:-1));
  const active=featureNodes.get(items[selectedIndex].id);
  if(active){const a=active.getBoundingClientRect(),b=featureTrack.getBoundingClientRect();let delta=0;if(a.left<b.left+2)delta=a.left-b.left-2;else if(a.right>b.right-2)delta=a.right-b.right+2;if(delta)featureTrack.scrollBy({left:delta,behavior:motion.matches?'instant':'smooth'});if(fromFeature)active.focus({preventScroll:true})}
  if(fromDisplay)displayNodes.get(items[selectedIndex].id)?.focus({preventScroll:true});
 }
 displays.addEventListener('click',event=>{if(performance.now()<suppressClickUntil){event.preventDefault();event.stopImmediatePropagation()}},true);
 displays.addEventListener('pointerdown',event=>{if(!event.isPrimary||event.pointerType==='mouse'&&event.button!==0||cards().length<2)return;swipe={id:event.pointerId,x:event.clientX,y:event.clientY,horizontal:false}});
 displays.addEventListener('pointermove',event=>{if(!swipe||swipe.id!==event.pointerId)return;const dx=event.clientX-swipe.x,dy=event.clientY-swipe.y;if(!swipe.horizontal&&Math.abs(dy)>12&&Math.abs(dy)>Math.abs(dx)){suppressClickUntil=performance.now()+450;swipe=null;return}if(Math.abs(dx)>12&&Math.abs(dx)>Math.abs(dy)*1.25){swipe.horizontal=true;if(!displays.hasPointerCapture(event.pointerId))displays.setPointerCapture(event.pointerId);event.preventDefault()}});
 displays.addEventListener('pointerup',event=>{if(!swipe||swipe.id!==event.pointerId)return;const gesture=swipe;swipe=null;const dx=event.clientX-gesture.x,dy=event.clientY-gesture.y;if(gesture.horizontal){suppressClickUntil=performance.now()+450;event.preventDefault();if(Math.abs(dx)>=40&&Math.abs(dx)>Math.abs(dy)*1.25)feature(selectedIndex+(dx<0?1:-1),dx<0?1:-1)}if(displays.hasPointerCapture(event.pointerId))displays.releasePointerCapture(event.pointerId)});
 displays.addEventListener('pointercancel',()=>{swipe=null});displays.addEventListener('lostpointercapture',()=>{swipe=null});
 for(const area of [displays,featureTrack])area.addEventListener('keydown',event=>{if(!['ArrowLeft','ArrowRight'].includes(event.key)||event.target.closest('.museum-add'))return;event.preventDefault();const focused=event.target.closest('[data-feature-index],[data-card-index]'),base=focused?Number(focused.dataset.featureIndex??focused.dataset.cardIndex):selectedIndex;feature(base+(event.key==='ArrowRight'?1:-1),event.key==='ArrowRight'?1:-1)});
 motion.addEventListener('change',()=>{if(motion.matches)stopSelectionMotion()});narrow.addEventListener('change',stopSelectionMotion);
 function inspect(){const card=cards()[selectedIndex];if(!card)return;$('#museum-card-image').src=asset(card.image);$('#museum-card-image').alt=card.name;$('#museum-card-name').textContent=card.name;$('#museum-card-rarity').textContent=card.rarity||'';$('#museum-card-condition').textContent=window.RipprCatalog.conditionLabel(card);openDialog(preview,$('#museum-inspect'))}
 $('#museum-card-image').addEventListener('error',event=>{if(!event.target.src.endsWith('card-placeholder.svg'))event.target.src='assets/card-placeholder.svg'});
 $('#museum-inspect').addEventListener('click',inspect);$('#museum-prev').addEventListener('click',()=>feature(selectedIndex-1));$('#museum-next').addEventListener('click',()=>feature(selectedIndex+1));
 function inventory(){const found=new Map(cards().map(card=>[card.id,card]));for(const item of window.RIPPR_ACCOUNT?.items||[]){if(['available','shipping','shipped','delivered'].includes(item.status))found.set(item.id,item);else found.delete(item.id)}return [...found.values()]}
 function renderDraft(){
  const items=inventory(),lookup=new Map(items.map(item=>[item.id,item]));$('#museum-selected-count').textContent=draftIds.length+' / 6 cards';const list=$('#museum-selected');list.replaceChildren();
  if(!draftIds.length){const li=document.createElement('li');li.className='museum-selection-empty';li.textContent='Select cards below. Your first card becomes the centerpiece.';list.append(li)}
  for(const [index,id]of draftIds.entries()){const item=lookup.get(id);const li=document.createElement('li');if(item)li.append(picture(item.image,''));const name=document.createElement('span');name.className='museum-order-name';name.textContent=item?.name||'Item no longer available';li.append(name);for(const [label,direction,mark]of [['Move earlier',-1,'↑'],['Move later',1,'↓'],['Remove',0,'×']]){const control=button(mark,()=>{if(direction){[draftIds[index],draftIds[index+direction]]=[draftIds[index+direction],draftIds[index]]}else draftIds.splice(index,1);renderDraft()});control.setAttribute('aria-label',label+' '+(item?.name||'card'));control.disabled=saving||direction<0&&index===0||direction>0&&index===draftIds.length-1;li.append(control)}list.append(li)}
  const options=$('#museum-card-options'),query=$('#museum-card-search').value.trim().toLowerCase();options.replaceChildren();const shown=items.filter(item=>!query||item.name.toLowerCase().includes(query));
  for(const item of shown){const el=document.createElement('button');el.type='button';el.className='museum-option';el.dataset.itemId=item.id;el.setAttribute('aria-pressed',String(draftIds.includes(item.id)));el.setAttribute('aria-label',(draftIds.includes(item.id)?'Remove ':'Add ')+item.name);el.disabled=saving;el.append(picture(item.image,''));const name=document.createElement('span');name.textContent=item.name;el.append(name);el.addEventListener('click',()=>{const index=draftIds.indexOf(item.id);if(index>=0)draftIds.splice(index,1);else if(draftIds.length<6)draftIds.push(item.id);else{editorError('Choose up to six cards. Remove one to add another.');return}editorError('');renderDraft()});options.append(el)}
  if(!shown.length){const copy=document.createElement('p');copy.className='museum-selection-empty';copy.textContent=query?'No matching cards.':'No displayable cards yet. Open a pack to start your collection.';options.append(copy)}const a=window.RIPPR_ACCOUNT,more=Boolean(a?.pageInfo?.items?.hasMore||a?.hasMore);$('#museum-inventory-note').hidden=!more;$('#museum-load-more').hidden=!more;$('#museum-load-more').disabled=saving||Boolean(a?.inventoryLoading?.items);$('#museum-load-more').textContent=a?.inventoryLoading?.items?'Loading…':'Load more cards';$('#museum-page-error').textContent=a?.inventoryErrors?.items||'';$('#museum-page-error').hidden=!a?.inventoryErrors?.items;
 }
 function editorError(copy){$('#museum-editor-error').hidden=!copy;$('#museum-editor-error').textContent=copy||''}
 function editorBusy(){editor.querySelectorAll('input,button').forEach(el=>{el.disabled=saving});$('#museum-save').textContent=saving?'Saving…':'Save displays';if(!saving)renderDraft()}
 function openEditor(){if(!canEdit||museum?.uid!==actor()||saving)return;draftIds=[...(museum.cardIds||cards().map(card=>card.id))].slice(0,6);$('#museum-title-input').value=museum.title||'My museum';$('#museum-description-input').value=museum.description||'';$('#museum-published-input').checked=Boolean(museum.published);$('#museum-card-search').value='';editorError('');renderDraft();openDialog(editor,$('#museum-edit'))}
 $('#museum-load-more').addEventListener('click',async()=>{const owner=actor();try{await window.RipprAccount.loadMore('items')}catch(error){if(owner===actor()){$('#museum-page-error').textContent=window.RipprAccount.errorMessage(error);$('#museum-page-error').hidden=false}}});
 $('#museum-edit').addEventListener('click',openEditor);$('#museum-card-search').addEventListener('input',renderDraft);
 $('#museum-editor-form').addEventListener('submit',async event=>{
  event.preventDefault();if(saving||!museum||!canEdit)return;const uid=actor(),ticket=request;if(museum.uid!==uid)return;
  const title=$('#museum-title-input').value.trim(),description=$('#museum-description-input').value.trim(),published=$('#museum-published-input').checked;
  if(!title){editorError('Add a museum title.');$('#museum-title-input').focus();return}if(published&&!draftIds.length){editorError('Choose at least one card before sharing your museum.');return}
  saving=true;editorBusy();editorError('');try{const result=await service('save',{title,description,published,cardIds:[...draftIds],expectedVersion:museum.version});if(uid!==actor()||ticket!==request)return;museum=result.museum;canEdit=result.canEdit!==false;selectedIndex=0;editor.close();render();notice(museum.published?'Your museum is ready to share.':'Your private displays are saved.')}catch(error){if(uid===actor()&&ticket===request)editorError(errorCopy(error))}finally{if(uid===actor()&&ticket===request){saving=false;editorBusy()}}
 });
 $('#museum-like').addEventListener('click',async()=>{
  if(!museum||canEdit||liking)return;if(!actor()){location.href=loginURL();return}
  const uid=actor(),ticket=request,target=museum,previous={likedByMe:Boolean(museum.likedByMe),likeCount:Math.max(0,Number(museum.likeCount)||0)},liked=!museum.likedByMe;
  liking=true;target.likedByMe=liked;target.likeCount=Math.max(0,previous.likeCount+(liked?1:-1));updateLike();notice('');
  try{const result=await service('setLike',{uid:target.uid,liked});if(uid!==actor()||ticket!==request||museum!==target)return;target.likedByMe=result.likedByMe;target.likeCount=result.likeCount;updateLike()}
  catch(error){if(uid===actor()&&ticket===request&&museum===target){Object.assign(target,previous);updateLike();notice('Your like couldn’t be updated. Please try again.')}}
  finally{if(uid===actor()&&ticket===request&&museum===target){liking=false;updateLike()}}
 });
 $('#museum-share').addEventListener('click',()=>{if(!museum)return;if(!museum.published){notice('Choose the cards you want to share, then turn on “Share with the community.”');openEditor();return}$('#museum-share-url').value=publicURL(museum.uid);$('#museum-share-status').textContent='';openDialog(share,$('#museum-share'))});
 $('#museum-copy-link').addEventListener('click',async()=>{const value=$('#museum-share-url').value;try{await navigator.clipboard.writeText(value);$('#museum-share-status').textContent='Link copied.'}catch{$('#museum-share-url').select();$('#museum-share-status').textContent='Select and copy the link above.'}});
 async function load(keepView=false){
  const uid=actor(),ticket=++request,retaining=keepView===true&&Boolean(museum);if(!retaining)clearView();notice('');room.setAttribute('aria-busy','true');room.dataset.loading=String(!retaining);if(!retaining)showState('Opening the gallery…');
  const own=!targetUid||targetUid===uid;
  if(own&&!window.RIPPR_ACCOUNT?.ready){showState('Opening the gallery…');return}
  if(own&&!uid){room.dataset.loading='false';room.setAttribute('aria-busy','false');showState('Make room for your favorites.','Log in to curate a personal museum, or explore the community.',[link('Log in',loginURL(),true),link('Browse collections','community.html')]);return}
  if(own&&!window.RIPPR_ACCOUNT?.wallet){if(window.RIPPR_ACCOUNT?.accountError){room.dataset.loading='false';room.setAttribute('aria-busy','false');showState('Your collection could not load.','Try loading your account again.',[button('Try again',()=>window.RipprAccount?.refresh(),true)])}else showState('Loading your collection…');return}
  try{const result=await service(own?'own':'get',own?{}:{uid:targetUid});if(uid!==actor()||ticket!==request)return;if(!result.museum||!own&&!result.museum.published)throw Object.assign(new Error(),{code:'functions/not-found'});museum=result.museum;canEdit=Boolean(result.canEdit&&uid===museum.uid);selectedIndex=0;render()}catch(error){if(uid!==actor()||ticket!==request)return;room.dataset.loading='false';room.setAttribute('aria-busy','false');if(retaining){notice(errorCopy(error));return}showState(error?.code==='functions/not-found'?'This museum isn’t available.':'The gallery couldn’t load.',errorCopy(error),[button('Try again',load,true),link('Browse collections','community.html')])}
 }
 document.addEventListener('rippr:authchange',()=>{request++;saving=false;liking=false;for(const dialog of [editor,preview,share])if(dialog.open)dialog.close();editorBusy();load()});
 document.addEventListener('rippr:walletchange',()=>{if(!targetUid||targetUid===actor()){const next=(window.RIPPR_ACCOUNT?.items||[]).map(item=>item.id+':'+item.status).join('|');if(!museum||inventorySignature!==next&&!editor.open&&!saving){inventorySignature=next;load(Boolean(museum))}else if(editor.open&&!saving)renderDraft()}});
 load();
})();
