(()=>{
 'use strict';
 const client=window.RipprFirebase,sessionKey='rippr:landing-session:v1',optoutKey='rippr:measurement-optout',windowMs=30*60000;
 const sources={ig:'instagram',instagram:'instagram',fb:'facebook',facebook:'facebook',tiktok:'tiktok',youtube:'youtube',discord:'discord',google:'google',email:'email',newsletter:'email',referral:'referral'};
 const optedOut=()=>{try{return navigator.globalPrivacyControl===true||navigator.doNotTrack==='1'||window.doNotTrack==='1'||localStorage.getItem(optoutKey)==='1'}catch{return true}};
 let session=null,queue=Promise.resolve(),boundActor=null;
 const landing=()=>/^\/landing(?:\.html)?\/?$/.test(location.pathname);
 function source(){const value=new URLSearchParams(location.search).get('utm_source');if(value)return sources[value.toLowerCase()]||'other';try{const host=new URL(document.referrer).hostname;if(host===location.hostname||['www.rippr.gg','rippr.gg'].includes(host))return'direct';for(const [domain,name]of [['instagram.com','instagram'],['tiktok.com','tiktok'],['facebook.com','facebook'],['youtube.com','youtube'],['youtu.be','youtube'],['discord.com','discord'],['discord.gg','discord'],['google.com','google']])if(host===domain||host.endsWith('.'+domain))return name;return'other'}catch{return'direct'}}
 function store(){try{sessionStorage.setItem(sessionKey,JSON.stringify(session));return true}catch{session=null;return false}}
 function context(){if(optedOut())return null;if(session&&Date.now()-session.atMs<windowMs&&Date.now()>=session.atMs)return session;try{const saved=JSON.parse(sessionStorage.getItem(sessionKey));if(saved&&/^[a-f\d-]{36}$/i.test(saved.id)&&Number.isSafeInteger(saved.atMs)&&saved.atMs<=Date.now()&&Date.now()-saved.atMs<windowMs){session=saved;return session}}catch{}session=null;return null}
 function active(){return !optedOut()&&window.RIPPR_RUNTIME?.mode==='live'&&!window.RIPPR_RUNTIME?.privatePreview&&!window.RIPPR_AUTH_OFFLINE&&window.RipprCatalog?.isAdminUser(client?.currentUser?.())!==true}
 async function send(stage){
  if(!active()||!context()||typeof client?.trackConversion!=='function')return;
  const current=session;
  // Re-send landing when a previous navigation interrupted its acknowledgment.
  for(const next of stage==='landing'?['landing']:['landing',stage]){
   if(current.sent?.[next])continue;
   const result=await client.trackConversion({sessionId:current.id,source:current.source,stage:next});
   if(!active()||session!==current)return;
   if(result?.expired||result?.limited)return;
   current.sent={...current.sent,[next]:true};store();
  }
 }
 async function bind(){const uid=client?.currentUser?.()?.uid;if(!uid||uid===boundActor||!active()||!context())return;await send('landing');if(!context())return;const result=await client.accountAction('bindAcquisition',{sessionId:session.id,accountUid:uid});if(active()&&client.currentUser()?.uid===uid&&result?.bound)boundActor=uid}
 function track(stage){queue=queue.catch(()=>{}).then(()=>send(stage)).catch(()=>{});return queue}
 async function start(){
  try{await client?.ready;if(!active())return;
   if(!context()&&landing()){session={id:crypto.randomUUID(),atMs:Date.now(),source:source(),sent:{}};if(!store())return}
   if(!context())return;
   await track('landing');
   if(/^\/opening(?:\.html)?$/.test(location.pathname))await track('pack');
   if(/^\/auth(?:\.html)?$/.test(location.pathname)){const params=new URLSearchParams(location.search);if(params.get('mode')==='signup'||(!params.has('mode')&&params.has('ref')))await track('signup')}
   await bind();
  }catch{/* Measurement must never interrupt signup, funding or opening. */}
 }
 // This counts a hosted Checkout handoff only after the server creates its URL.
 document.addEventListener('rippr:checkoutstarted',()=>{void track('checkout')});
 document.addEventListener('rippr:authchange',()=>{if(!client?.currentUser?.()){boundActor=null;return}void start()});
 document.addEventListener('rippr:runtimechange',()=>{void start()});
 window.RipprConversion={track,context:()=>context()?{sessionId:session.id}:null};
 function privacyControls(){for(const button of document.querySelectorAll('[data-measurement-optout]')){const refresh=()=>{button.textContent=optedOut()?'Measurement is off in this browser':'Turn off optional visit measurement';button.disabled=navigator.globalPrivacyControl===true||navigator.doNotTrack==='1'};button.addEventListener('click',()=>{try{localStorage.setItem(optoutKey,'1');sessionStorage.removeItem(sessionKey);session=null;boundActor=null}catch{}refresh()});refresh()}}
 privacyControls();void start();
})();
