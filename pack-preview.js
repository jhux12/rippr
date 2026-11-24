/* Compositor-only wrapper preview. No canvas, external models or account calls. */
window.RipprPackPreview={mount(shell,pack){
 if(!shell||!pack||!CSS.supports('transform-style','preserve-3d'))return null;
 const view=document.createElement('div');view.className='pack-preview';view.style.setProperty('--preview-accent',pack.accent);
 const turntable=document.createElement('div');turntable.className='pack-turntable';
 const hint=document.createElement('span');hint.className='pack-preview-hint';
 view.append(turntable,hint);shell.append(view);
 let quantity=0,active=false,yaw=-12,pitch=0,gesture=null,frame=0;
 const render=()=>{frame=0;turntable.style.setProperty('--preview-yaw',yaw+'deg');turntable.style.setProperty('--preview-pitch',pitch+'deg')};
 const paint=()=>{if(!frame)frame=requestAnimationFrame(render)};
 function release(){const id=gesture?.id;gesture=null;view.classList.remove('is-dragging');try{if(id!==undefined&&turntable.hasPointerCapture(id))turntable.releasePointerCapture(id)}catch{}}
 function reset(){release();yaw=-12;pitch=0;paint()}
 function makePack(index,count){
  const model=document.createElement('div');model.className='pack-model';model.setAttribute('aria-hidden','true');
  const offset=index-(count-1)/2;model.style.setProperty('--fan-x',offset*24+'%');model.style.setProperty('--fan-angle',offset*9+'deg');model.style.zIndex=String(count-Math.abs(offset)*2);
  for(const side of ['front','back','left','right','top','bottom']){
   const face=document.createElement('div');face.className='pack-face pack-face-'+side;
   if(side==='front'){const img=document.createElement('img');img.src=pack.image;img.alt='';img.draggable=false;face.append(img)}
   if(side==='back'){
    const brand=document.createElement('strong');brand.textContent='rippr✦';
    const name=document.createElement('span');name.textContent=pack.name.toUpperCase();
    const seam=document.createElement('i');seam.className='pack-back-seam';
    const mark=document.createElement('span');mark.className='pack-back-mark';mark.textContent='✦';face.append(brand,name,mark,seam);
   }
   model.append(face);
  }
  return model;
 }
 const models=Array.from({length:5},(_,i)=>makePack(i,1));turntable.append(...models);
 function sync(count,enabled=true){
  count=Math.max(1,Math.min(5,Number(count)||1));
  if(count!==quantity){quantity=count;reset();models.forEach((model,index)=>{
   model.hidden=index>=count;const offset=index-(count-1)/2;model.style.setProperty('--fan-x',offset*24+'%');model.style.setProperty('--fan-angle',offset*9+'deg');model.style.zIndex=String(count-Math.abs(offset)*2);
  })}
  active=enabled;shell.classList.toggle('has-pack-preview',active);view.hidden=!active;
  const single=count===1;view.classList.toggle('is-multiple',!single);turntable.tabIndex=active&&single?0:-1;
  turntable.setAttribute('role',single?'group':'img');turntable.setAttribute('aria-label',single?`${pack.name} 3D pack preview. Drag horizontally or use arrow keys to rotate 360 degrees. Press Home to face forward.`:`${count} ${pack.name} packs selected`);
  hint.textContent=single?'Drag to rotate · 360°':`${count} packs selected`;
  if(!active){release();if(frame)cancelAnimationFrame(frame);frame=0}
 }
 turntable.addEventListener('pointerdown',event=>{
  if(!active||quantity!==1||!event.isPrimary||event.button!==0)return;
  gesture={id:event.pointerId,x:event.clientX,y:event.clientY,yaw,pitch,locked:false};
 });
 turntable.addEventListener('pointermove',event=>{
  if(!gesture||gesture.id!==event.pointerId)return;
  const dx=event.clientX-gesture.x,dy=event.clientY-gesture.y;
  if(!gesture.locked){if(Math.max(Math.abs(dx),Math.abs(dy))<6)return;if(Math.abs(dy)>Math.abs(dx)){release();return}gesture.locked=true;turntable.setPointerCapture(event.pointerId);view.classList.add('is-dragging')}
  yaw=gesture.yaw+dx*.8;pitch=Math.max(-16,Math.min(16,gesture.pitch-dy*.12));paint();
 });
 for(const event of ['pointerup','pointercancel','lostpointercapture'])turntable.addEventListener(event,release);
 turntable.addEventListener('keydown',event=>{
  if(!active||quantity!==1)return;
  if(!['ArrowLeft','ArrowRight','Home'].includes(event.key))return;
  event.preventDefault();release();if(event.key==='Home'){yaw=0;pitch=0}else yaw+=event.key==='ArrowRight'?30:-30;paint();
 });
 turntable.addEventListener('dblclick',()=>{if(active&&quantity===1)reset()});
 document.addEventListener('visibilitychange',()=>{if(document.hidden)release()});window.addEventListener('pagehide',release);window.addEventListener('blur',release);
 window.addEventListener('pointerup',release);window.addEventListener('pointercancel',release);
 return{sync};
}};
