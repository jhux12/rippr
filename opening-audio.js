/* Original rippr cues. Audio never delays a purchase or reveal. */
(() => {
 const files={click:'01-soft-click',rip:'02-foil-rip',lift:'03-card-lift',build:'04-rarity-build',flip:'05-card-flip',common:'06-reveal-common',rare:'07-reveal-rare',epic:'08-reveal-epic',legendary:'09-reveal-legendary',inventory:'10-inventory-saved'};
 const storageKey='rippr:opening-muted',button=document.querySelector('#opening-mute');
 let muted=false,context,master,loading,overlayOpen=false;
 try{muted=localStorage.getItem(storageKey)==='true'}catch{}
 const buffers=new Map(),active=new Map();
 function updateButton(){
  if(!button)return;
  button.setAttribute('aria-pressed',String(muted));
  button.setAttribute('aria-label',muted?'Unmute sound':'Mute sound');
  button.title=muted?'Unmute sound':'Mute sound';
  button.classList.toggle('is-muted',muted);
 }
 function stop(channel){
  for(const [key,entry] of active){
   if(channel&&key!==channel)continue;
   try{entry.source.stop()}catch{}
   entry.source.disconnect();entry.gain.disconnect();active.delete(key);
  }
 }
 async function unlock(){
  if(muted||document.hidden)return false;
  try{
   const AudioEngine=window.AudioContext||window.webkitAudioContext;
   if(!AudioEngine)return false;
   if(!context){context=new AudioEngine();master=context.createGain();master.gain.value=.28;master.connect(context.destination)}
   // Resume directly from the gesture, before fetching/decoding any audio.
   const resumed=context.state==='suspended'?context.resume():Promise.resolve();
   if(!loading)loading=Promise.all(Object.entries(files).map(async([name,file])=>{
    try{
     const url=window.RIPPR_OPENING_AUDIO_URLS?.[name]||`assets/audio/${file}.wav`;
     const response=await fetch(url);if(!response.ok)return;
     const buffer=await context.decodeAudioData(await response.arrayBuffer());buffers.set(name,buffer);
    }catch{}
   }));
   await resumed;await loading;
   return !muted&&context.state==='running';
  }catch{return false}
 }
 function play(name,{channel='ui'}={}){
  // Cues that aren't ready are skipped; never replay a stale phase after loading.
  if(muted||overlayOpen||document.hidden||context?.state!=='running'||!buffers.has(name))return false;
  try{
   stop(channel);
   const source=context.createBufferSource(),gain=context.createGain();
   source.buffer=buffers.get(name);gain.gain.value=name==='build'?.6:1;
   source.connect(gain);gain.connect(master);active.set(channel,{source,gain});
   source.onended=()=>{source.disconnect();gain.disconnect();if(active.get(channel)?.source===source)active.delete(channel)};
   source.start();return true;
  }catch{return false}
 }
 function setMuted(value){
  muted=Boolean(value);if(master)master.gain.value=muted?0:.28;
  if(muted)stop();
  try{localStorage.setItem(storageKey,String(muted))}catch{}
  updateButton();if(!muted)void unlock();
 }
 window.RipprOpeningAudio={unlock,play,stop,setMuted,get muted(){return muted}};
 button?.addEventListener('click',()=>setMuted(!muted));
 const activate=event=>{if(event.isTrusted)void unlock()};
 document.addEventListener('pointerdown',activate,{capture:true,passive:true});
 document.addEventListener('click',activate,{capture:true,passive:true});
 document.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' ')activate(event)},{capture:true});
 document.addEventListener('visibilitychange',()=>{if(document.hidden)stop()});
 document.addEventListener('rippr:navigationchange',event=>{overlayOpen=Boolean(event.detail.menuOpen||event.detail.dialogOpen);if(overlayOpen)stop()});
 window.addEventListener('pagehide',()=>{stop();if(context)void context.suspend().catch(()=>{})});
 updateButton();
})();
