/* Original rippr cues. Audio never delays a purchase or reveal. */
(() => {
 const files={click:'01-soft-click',rip:'02-foil-rip',lift:'03-card-lift',build:'04-rarity-build',flip:'05-card-flip',common:'06-reveal-common',rare:'07-reveal-rare',epic:'08-reveal-epic',legendary:'09-reveal-legendary',inventory:'10-inventory-saved'};
 const storageKey='rippr:opening-muted',button=document.querySelector('#opening-mute');
 const assetBase=document.currentScript?.src?new URL('assets/audio/',document.currentScript.src).href:'assets/audio/';
 let muted=false,context,master,loading,resuming,loaded=false,overlayOpen=false,enableOnClick=false;
 try{muted=localStorage.getItem(storageKey)==='true'}catch{}
 function syncSound(){try{muted=localStorage.getItem(storageKey)==='true'}catch{}if(master)master.gain.value=muted?0:.28;if(muted)stop();updateButton()}
 window.addEventListener('storage',event=>{if(event.key===storageKey)syncSound()});document.addEventListener('rippr:soundpreferencechange',syncSound);
 const buffers=new Map(),active=new Map();
 function updateButton(){
  if(!button)return;
  button.setAttribute('aria-pressed',String(muted));
  const label=muted?'Unmute sound':context?.state!=='running'?'Enable sound':'Mute sound';
  button.setAttribute('aria-label',label);
  button.title=label;
  button.classList.toggle('is-muted',muted);
 }
 function dispose(key,entry,stopSource=false){
  if(entry.disposed)return;entry.disposed=true;entry.source.onended=null;
  if(stopSource)try{entry.source.stop()}catch{}
  try{entry.source.disconnect()}catch{}try{entry.gain.disconnect()}catch{}
  if(active.get(key)===entry)active.delete(key);
 }
 function stop(channel){
  for(const [key,entry] of active){if(!channel||key===channel)dispose(key,entry,true)}
 }
 function suspend(){
  stop();
  if(context&&context.state!=='closed')try{void context.suspend().catch(()=>{})}catch{}
 }
 function prime(engine){
  // iOS needs a source started directly inside the activation gesture as well
  // as resume(). One silent frame unlocks output without delaying a real cue.
  if(!engine.createBuffer)return;
  let entry;
  try{
   stop('activation');
   const source=engine.createBufferSource(),gain=engine.createGain();entry={source,gain,disposed:false};
   source.buffer=engine.createBuffer(1,1,engine.sampleRate);gain.gain.value=0;
   source.connect(gain);gain.connect(master);active.set('activation',entry);
   source.onended=()=>dispose('activation',entry);source.start(0);
  }catch{if(entry)dispose('activation',entry,true)}
 }
 async function unlock(fromGesture=false){
  if(muted||document.hidden||overlayOpen)return false;
  try{
   // Safari can otherwise route Web Audio as ambient audio under the ringer
   // switch. Request playback only when this page's sound is enabled.
   try{if(navigator.audioSession)navigator.audioSession.type='playback'}catch{}
   const AudioEngine=window.AudioContext||window.webkitAudioContext;
   if(!AudioEngine)return false;
   if(!context||context.state==='closed'){
    stop();try{master?.disconnect()}catch{}
    context=new AudioEngine();master=context.createGain();master.gain.value=.28;master.connect(context.destination);
    buffers.clear();loading=null;resuming=null;loaded=false;
    context.addEventListener?.('statechange',updateButton);
   }
   const engine=context;
   // Safari can report "interrupted" after backgrounding. Resume from a gesture
   // for every non-running state, while sharing one outstanding resume request.
   if(engine.state!=='running'&&(!resuming||fromGesture)){
    // A resume requested on tab return can remain pending under autoplay policy.
    // A fresh gesture must be allowed to retry it rather than share that block.
    prime(engine);const request=Promise.resolve(engine.resume()).finally(()=>{if(resuming===request)resuming=null});resuming=request;
   }
   const resumed=resuming||Promise.resolve();
   if(!loading)loading=(async()=>{
    const entries=Object.entries(files).filter(([name])=>!buffers.has(name));let next=0;
    async function worker(){
     while(next<entries.length&&context===engine){
      const [name,file]=entries[next++];
      for(let attempt=0;attempt<2&&context===engine;attempt++){
       const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),6000);
       try{
        const url=window.RIPPR_OPENING_AUDIO_URLS?.[name]||assetBase+file+'.wav';
        const response=await fetch(url,{signal:controller.signal,...(attempt?{cache:'reload'}:{})});if(!response.ok)continue;
        const buffer=await engine.decodeAudioData(await response.arrayBuffer());
        if(context===engine)buffers.set(name,buffer);break;
       }catch{}finally{clearTimeout(timer)}
      }
     }
    }
    // Decode work is bounded so the first gesture does not queue ten decoders
    // alongside the full-screen opening transition on a phone.
    await Promise.all([worker(),worker()]);if(context===engine)loaded=buffers.size===Object.keys(files).length;
   })().finally(()=>{if(context===engine)loading=null});
   const ready=loading;await resumed;await ready;
   if(context!==engine)return false;
   if(muted||document.hidden||overlayOpen){suspend();return false}
   return engine.state==='running';
  }catch{return false}
 }
 function play(name,{channel='ui'}={}){
  // Cues that aren't ready are skipped; never replay a stale phase after loading.
  if(muted||overlayOpen||document.hidden||context?.state!=='running'||!buffers.has(name))return false;
  let entry;
  try{
   stop(channel);
   const source=context.createBufferSource(),gain=context.createGain();entry={source,gain,disposed:false};
   source.buffer=buffers.get(name);gain.gain.value=name==='build'?.6:1;
   source.connect(gain);gain.connect(master);active.set(channel,entry);
   source.onended=()=>dispose(channel,entry);
   source.start();return true;
  }catch{if(entry)dispose(channel,entry,true);return false}
 }
 function setMuted(value){
  muted=Boolean(value);if(master)master.gain.value=muted?0:.28;
  if(muted)stop();
  try{localStorage.setItem(storageKey,String(muted))}catch{}
  updateButton();if(!muted)void unlock(true).then(ready=>{if(ready)play('click')});
 }
 window.RipprOpeningAudio={unlock,play,stop,setMuted,get muted(){return muted}};
 button?.addEventListener('click',()=>{const enable=!muted&&(enableOnClick||context?.state!=='running');enableOnClick=false;if(enable)void unlock(true).then(ready=>{if(ready)play('click')});else setMuted(!muted)});
 const activate=event=>{
  if(!event.isTrusted)return;
  // Capture the intent before pointerdown/keydown resumes the context. Otherwise
  // the following click sees "running" and accidentally mutes Enable sound.
  if(event.type!=='click')enableOnClick=Boolean(button?.contains(event.target)&&!muted&&context?.state!=='running');
  if(!(context?.state==='running'&&loaded))void unlock(true);
 };
 document.addEventListener('pointerdown',activate,{capture:true,passive:true});
 document.addEventListener('click',activate,{capture:true,passive:true});
 document.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' ')activate(event)},{capture:true});
 const recover=()=>{if(context&&!muted&&!document.hidden&&!overlayOpen)void unlock()};
 document.addEventListener('visibilitychange',()=>{if(document.hidden)suspend();else recover()});
 document.addEventListener('rippr:navigationchange',event=>{overlayOpen=Boolean(event.detail.menuOpen||event.detail.dialogOpen);if(overlayOpen)stop();else recover()});
 window.addEventListener('pagehide',suspend);
 window.addEventListener('pageshow',recover);
 updateButton();
})();
