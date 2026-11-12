/* Original rippr cues. Audio never delays a purchase or reveal. */
(() => {
 const files={click:'01-soft-click',rip:'02-foil-rip',lift:'03-card-lift',build:'04-rarity-build',flip:'05-card-flip',common:'06-reveal-common',rare:'07-reveal-rare',epic:'08-reveal-epic',legendary:'09-reveal-legendary',inventory:'10-inventory-saved'};
 const storageKey='rippr:opening-muted',button=document.querySelector('#opening-mute');
 let muted=false,context,master,loading,resuming,loaded=false,overlayOpen=false;
 try{muted=localStorage.getItem(storageKey)==='true'}catch{}
 function syncSound(){try{muted=localStorage.getItem(storageKey)==='true'}catch{}if(master)master.gain.value=muted?0:.28;if(muted)stop();updateButton()}
 window.addEventListener('storage',event=>{if(event.key===storageKey)syncSound()});document.addEventListener('rippr:soundpreferencechange',syncSound);
 const buffers=new Map(),active=new Map();
 function updateButton(){
  if(!button)return;
  button.setAttribute('aria-pressed',String(muted));
  button.setAttribute('aria-label',muted?'Unmute sound':'Mute sound');
  button.title=muted?'Unmute sound':'Mute sound';
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
 async function unlock(){
  if(muted||document.hidden||overlayOpen)return false;
  try{
   const AudioEngine=window.AudioContext||window.webkitAudioContext;
   if(!AudioEngine)return false;
   if(!context||context.state==='closed'){
    stop();try{master?.disconnect()}catch{}
    context=new AudioEngine();master=context.createGain();master.gain.value=.28;master.connect(context.destination);
    buffers.clear();loading=null;resuming=null;loaded=false;
   }
   const engine=context;
   // Safari can report "interrupted" after backgrounding. Resume from a gesture
   // for every non-running state, while sharing one outstanding resume request.
   if(engine.state!=='running'&&!resuming)resuming=Promise.resolve(engine.resume()).finally(()=>{if(context===engine)resuming=null});
   const resumed=resuming||Promise.resolve();
   if(!loading)loading=(async()=>{
    const entries=Object.entries(files);let next=0;
    async function worker(){
     while(next<entries.length&&context===engine){
      const [name,file]=entries[next++];
      try{
       const url=window.RIPPR_OPENING_AUDIO_URLS?.[name]||`assets/audio/${file}.wav`;
       const response=await fetch(url);if(!response.ok)continue;
       const buffer=await engine.decodeAudioData(await response.arrayBuffer());
       if(context===engine)buffers.set(name,buffer);
      }catch{}
     }
    }
    // Decode work is bounded so the first gesture does not queue ten decoders
    // alongside the full-screen opening transition on a phone.
    await Promise.all([worker(),worker()]);if(context===engine)loaded=true;
   })();
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
  updateButton();if(!muted)void unlock();
 }
 window.RipprOpeningAudio={unlock,play,stop,setMuted,get muted(){return muted}};
 button?.addEventListener('click',()=>setMuted(!muted));
 const activate=event=>{if(event.isTrusted&&!(context?.state==='running'&&loaded))void unlock()};
 document.addEventListener('pointerdown',activate,{capture:true,passive:true});
 document.addEventListener('click',activate,{capture:true,passive:true});
 document.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' ')activate(event)},{capture:true});
 document.addEventListener('visibilitychange',()=>{if(document.hidden)suspend()});
 document.addEventListener('rippr:navigationchange',event=>{overlayOpen=Boolean(event.detail.menuOpen||event.detail.dialogOpen);if(overlayOpen)stop()});
 window.addEventListener('pagehide',suspend);
 updateButton();
})();
