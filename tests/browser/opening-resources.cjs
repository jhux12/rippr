const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const path=require('node:path');
const root=path.resolve(__dirname,'../..');

// Local fixtures exercise the actual foil/audio modules without Firebase,
// external audio requests or reliance on a physical sound device.
(async()=>{
  const browser=await chromium.launch({...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),args:['--no-sandbox']});
  try{
    const page=await browser.newPage(),errors=[],requests=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.route('**/*',route=>{requests.push(route.request().url());return route.abort()});
    await page.setContent('<div id="shell" style="width:220px;height:400px;position:relative"><div class="pack artwork"></div><div class="foil-piece"></div><div class="tear-strip"></div><button class="rip-target"></button></div>');
    await page.addScriptTag({path:path.join(root,'opening-foil.js')});
    const foil=await page.evaluate(async()=>{
      const check=(condition,message)=>{if(!condition)throw Error(message)};
      const shell=document.querySelector('#shell'),api=RipprFoil.mount(shell);
      const frames=()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
      check(api===RipprFoil.mount(shell),'Repeated mounting duplicated foil layers');
      let paints=0;
      const observer=new MutationObserver(records=>{paints+=records.length});
      observer.observe(shell.querySelector('.artwork'),{attributes:true,attributeFilter:['style']});
      for(let i=1;i<200;i++)api.setProgress(i/220);
      await frames();
      check(paints===1,`Pointer updates painted ${paints} times instead of once`);
      api.setProgress(.4);api.reset();await frames();
      check(shell.querySelector('.artwork').style.clipPath==='none','A queued paint altered the reset wrapper');
      for(let i=0;i<25;i++){
        api.reset();api.setProgress(.7);api.release();
        for(const animation of shell.getAnimations({subtree:true}))animation.finish();
        await frames();
        check(shell.getAnimations({subtree:true}).length===0,'Finished peel effects remained attached');
        api.reset();
        check(!shell.querySelector('.foil-piece').style.opacity,'Reset left the next foil strip hidden');
      }
      api.release();
      for(const animation of shell.getAnimations({subtree:true}))animation.finish();
      api.reset();await frames();
      check(!shell.querySelector('.foil-piece').style.opacity,'A late finish hid the next pack');
      api.release(true);
      check(shell.querySelector('.foil-piece').style.opacity==='0','Instant release left foil visible');
      api.reset();observer.disconnect();
      return {layers:shell.querySelectorAll('.foil-underlay,.foil-cut-edge,.foil-crease').length,animations:shell.getAnimations({subtree:true}).length};
    });
    assert.equal(foil.layers,3);assert.equal(foil.animations,0);
    console.log('PASS opening foil resources: one paint per frame, mount reuse, 25 peel cleanups, reset/finish races and instant release');

    await page.goto('about:blank');await page.setContent('<button id="opening-mute"></button>');
    await page.evaluate(()=>{
      window.audioNodes=[];window.audioEngines=[];window.activeDecoders=0;window.maximumDecoders=0;window.failAudioStart=false;
      class AudioNodeFixture{
        constructor(type){this.type=type;this.connected=false;this.gain={value:0};audioNodes.push(this)}
        connect(){this.connected=true}disconnect(){this.connected=false}
      }
      class SourceFixture extends AudioNodeFixture{
        constructor(){super('source')}
        start(){if(failAudioStart)throw Error('Simulated audio start failure')}
        stop(){}
      }
      class AudioContextFixture{
        constructor(){this.state='suspended';this.destination={};this.resumes=0;audioEngines.push(this)}
        createGain(){return new AudioNodeFixture('gain')}
        createBufferSource(){return new SourceFixture}
        resume(){this.resumes++;this.state='running';return Promise.resolve()}
        suspend(){this.state='suspended';return Promise.resolve()}
        async decodeAudioData(){activeDecoders++;maximumDecoders=Math.max(maximumDecoders,activeDecoders);await new Promise(resolve=>setTimeout(resolve,1));activeDecoders--;return{fixtureBuffer:true}}
      }
      window.AudioContext=AudioContextFixture;
      window.fetch=async()=>({ok:true,arrayBuffer:async()=>new ArrayBuffer(8)});
      Object.defineProperty(document,'hidden',{configurable:true,get:()=>false});
    });
    await page.addScriptTag({path:path.join(root,'opening-audio.js')});
    const audio=await page.evaluate(async()=>{
      const check=(condition,message)=>{if(!condition)throw Error(message)};
      const connected=()=>audioNodes.filter(node=>node.connected).length,api=RipprOpeningAudio;
      await Promise.all([api.unlock(),api.unlock(),api.unlock()]);
      check(audioEngines.length===1&&audioEngines[0].resumes===1,'Concurrent unlocks created contexts or duplicate resumes');
      check(maximumDecoders<=2,'Initial loading exceeded the decoder concurrency limit');
      for(let i=0;i<100;i++){
        for(const channel of ['ui','motion','foil','reveal'])check(api.play('click',{channel}),'A ready fixture cue was skipped');
        api.stop();
        check(connected()===1,'Stopped cues retained graph connections');
        check(!audioNodes.some(node=>node.type==='source'&&node.onended),'Stopped sources retained completion handlers');
      }
      api.play('click');audioNodes.filter(node=>node.type==='source').at(-1).onended();
      check(connected()===1,'Naturally ended audio retained connections');
      failAudioStart=true;check(!api.play('click'),'Failed playback reported success');failAudioStart=false;
      check(connected()===1,'Failed playback retained connections');
      audioEngines[0].state='interrupted';
      check(await api.unlock()&&audioEngines.length===1,'Interrupted audio did not resume the existing context');
      api.play('click');Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));
      check(audioEngines[0].state==='suspended'&&connected()===1,'Hidden page kept source playback alive');
      Object.defineProperty(document,'hidden',{configurable:true,get:()=>false});await api.unlock();
      document.dispatchEvent(new CustomEvent('rippr:navigationchange',{detail:{dialogOpen:true}}));
      check(!api.play('click')&&!await api.unlock(),'An overlay allowed audio playback');
      document.dispatchEvent(new CustomEvent('rippr:navigationchange',{detail:{dialogOpen:false}}));await api.unlock();
      api.setMuted(true);check(!api.play('click'),'Muted audio played a cue');api.setMuted(false);await api.unlock();
      window.dispatchEvent(new Event('pagehide'));check(audioEngines[0].state==='suspended','Pagehide left the audio context running');
      audioEngines[0].state='closed';await api.unlock();
      check(audioEngines.length===2&&connected()===1,'Replacing a closed context retained an old graph');
      return {contexts:audioEngines.length,decoders:maximumDecoders};
    });
    assert.equal(audio.contexts,2);assert(audio.decoders<=2);assert.deepEqual(errors,[]);assert.deepEqual(requests,[]);
    console.log('PASS opening audio resources: 100 four-channel cycles, stop/end/failure cleanup, context reuse/replacement, interrupted resume, visibility, overlay and mute');
    await page.close();
  }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
