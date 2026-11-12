(() => {
'use strict';
const $=s=>document.querySelector(s),model=window.RipprRewards,media=matchMedia('(prefers-reduced-motion: reduce)');
let config=null,extras=null,mode='loading',generation=0,animation=null,rotation=0,slots=[],nextClaimAtMs=0,serverOffset=0,extraBusy=false,pendingResult=null,timer;
const money=n=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(n/100);
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const image=p=>window.RIPPR_ASSET_URLS?.[`assets/pack-${p.packId}.svg`]||(p.kind==='pack'?(p.packId==='icy-rush'?'assets/seasonal/pack-icy-rush.png':`assets/pack-${p.packId}.svg`):'assets/rewards/credit-wallet.svg');
const art=p=>`<img class="${p.kind==='pack'?'pack-art':'wallet-art'}" src="${image(p)}" alt="" draggable="false">`;
const serverNow=()=>Date.now()+serverOffset;
const timeLeft=until=>{const s=Math.max(0,Math.ceil((until-serverNow())/1000));return[Math.floor(s/3600),Math.floor(s/60)%60,s%60].map(n=>String(n).padStart(2,'0')).join(':')};
const lock='<svg viewBox="0 0 16 18"><rect x="2" y="8" width="12" height="9" rx="2"/><path d="M4 8V5a4 4 0 0 1 8 0v3"/></svg>';
const busy=()=>extraBusy||['purchasing','spinning'].includes(mode);
const login=()=>{location.href='auth.html?mode=login&next='+encodeURIComponent(location.pathname+location.search+location.hash)};
function error(text){$('.rewards-page').classList.toggle('has-error',Boolean(text));$('#reward-error').textContent=text;$('#reward-error').hidden=!text;$('#retry-rewards').hidden=!text}
function announce(text){$('#live-status').textContent=text}
function render(){
 const prizes=config.prizes.filter(p=>p.chanceBps>0),n=Math.max(8,prizes.length),step=360/n;
 slots=Array.from({length:n},(_,i)=>prizes[i%prizes.length]);rotation=0;
 const point=a=>[150+147*Math.cos(a*Math.PI/180),150+147*Math.sin(a*Math.PI/180)];
 $('#reward-wheel').innerHTML=`<svg viewBox="0 0 300 300" aria-hidden="true">${slots.map((p,i)=>{const a=point(i*step-90-step/2),b=point(i*step-90+step/2);return `<path d="M150 150 L${a.join(' ')} A147 147 0 ${step>180?1:0} 1 ${b.join(' ')}Z" fill="${i%2?'#0c2533':'#102f3d'}" stroke="#32606b" stroke-width=".7"/>`}).join('')}<circle cx="150" cy="150" r="148" fill="none" stroke="#00e2ed" stroke-width="2"/></svg>`+slots.map((p,i)=>`<span class="wheel-prize" data-index="${i}" style="width:${Math.min(18,140/n)}%;left:${50+33*Math.sin(i*step*Math.PI/180)}%;top:${50-33*Math.cos(i*step*Math.PI/180)}%;transform:translate(-50%,-50%) rotate(${i*step}deg)" aria-hidden="true">${art(p)}${p.kind==='credit'?`<b>${money(p.amountCents)}</b>`:''}</span>`).join('');
 $('#reward-wheel').style.transform='rotate(0deg)';$('#reward-wheel').dataset.dense=String(n>12);
 $('#reward-grid').innerHTML=prizes.map(p=>`<article class="reward-preview">${art(p)}<div><strong>${escape(model.rewardLabel(p))}</strong><span>${(p.chanceBps/100).toLocaleString('en-US',{maximumFractionDigits:2})}% chance</span></div></article>`).join('');
}
function streakState(){const state=model.rewardExtras(extras?{streakCount:extras.streak.count,lastStreakAtMs:extras.streak.lastClaimAtMs}: {},serverNow()).streak;return{...state,prizes:extras?.streak.prizes||state.prizes}}
function renderExtras(){
 const user=window.RIPPR_ACCOUNT?.user,s=streakState(),available=Boolean(extras)||!user,ready=available&&s.ready;
 $('#streak-title').textContent=s.count?`${s.count}-day streak`:'Daily streak';
 $('#streak-status').textContent=!available?'Streak rewards are unavailable right now.':ready?`Day ${s.day} is ready to claim`:`Next reward in ${timeLeft(s.nextClaimAtMs)}`;
 const signature=JSON.stringify([s.day,s.claimedDays,ready,available]);
 if($('#streak-days').dataset.state!==signature){
  $('#streak-days').dataset.state=signature;
  $('#streak-days').innerHTML=s.prizes.map((p,i)=>{const claimed=i<s.claimedDays,today=ready&&i===s.day-1;return `<article class="streak-day ${claimed?'is-earned':today?'is-today':'is-locked'} ${i===6?'is-pack':''}" aria-label="Day ${i+1}, ${escape(model.rewardLabel(p))}, ${claimed?'claimed':today?'ready':'locked'}"><span>Day ${i+1}</span><span class="day-state" aria-hidden="true">${claimed?'✓':today?'':lock}</span>${art(p)}<strong>${p.kind==='credit'?money(p.amountCents):'Basic pack'}</strong>${p.kind==='credit'?'<small>credit</small>':''}${today?'<b class="today-label">TODAY</b>':''}</article>`}).join('');
 }
 $('#streak-progress').value=s.claimedDays;$('#streak-progress-label').textContent=`Earned: ${s.claimedDays} / 7 days`;
 $('#claim-streak').disabled=busy()||!ready||!window.RIPPR_ACCOUNT?.ready;$('#claim-streak').textContent=!window.RIPPR_ACCOUNT?.ready?'Loading…':extraBusy?'Claiming…':!user?'Log in to claim':!available?'Unavailable':ready?`Claim day ${s.day}`:timeLeft(s.nextClaimAtMs);
 const welcome=extras?.welcome;
 $('#claim-welcome').disabled=busy()||!user||!welcome?.eligible||welcome.claimed;
 $('#claim-welcome').textContent=welcome?.claimed?'Case claimed':welcome?.eligible?'Open bonus case':'Unlock bonus case';
 $('#welcome-note').textContent=welcome?.claimed?'Your bonus pack is saved in My items.':welcome?.eligible?'One per account. Ready to claim.':'One per account · Test top-ups don’t qualify.';
 $('#welcome-result').hidden=!welcome?.claimed;
}
function clock(){
 $('#view-prizes').disabled=!config;renderExtras();
 if(['spinning','purchasing'].includes(mode))return;
 const user=window.RIPPR_ACCOUNT?.user,left=config&&!config.testingNoCooldown&&nextClaimAtMs>serverNow();
 mode=!config?'loading':!config.enabled?'paused':!user?'guest':left?'claimed':'ready';
 $('#status-text').textContent={ready:'1 free spin available',guest:'Log in for your daily spin',claimed:'Reward claimed',paused:'Daily spin paused',loading:'Loading rewards…'}[mode];
 $('#opening-detail').textContent=config?.testingNoCooldown?'Testing · no cooldown':left?'Your next spin is on its way.':'1 free spin every 24 hours';
 $('#open-case').textContent={ready:'Spin now',guest:'Log in to spin',claimed:'✓ Claimed',paused:'Spin paused',loading:'Unavailable'}[mode];
 $('#open-case').disabled=extraBusy||!['ready','guest'].includes(mode);
 $('#spin-timer').hidden=!left;$('#countdown').textContent=left?timeLeft(nextClaimAtMs):'';
}
async function load(){
 if(busy())return;
 const ticket=++generation,uid=window.RIPPR_ACCOUNT?.user?.uid;config=null;extras=null;mode='loading';$('#case-panel').classList.remove('is-won');error('');clock();$('#open-case').textContent='Loading…';$('#open-case').setAttribute('aria-busy','true');
 try{
  if(window.RIPPR_AUTH_OFFLINE){config=model.defaultRewards();nextClaimAtMs=0}
  else if(uid){const state=await window.RipprFirebase.accountAction('rewardState',{accountUid:uid});if(ticket!==generation||uid!==window.RIPPR_ACCOUNT?.user?.uid)return;config=state.config;extras=state.extras||null;nextClaimAtMs=state.nextClaimAtMs;serverOffset=state.serverTimeMs-Date.now()}
  else{const settings=await window.RipprFirebase.loadRewardSettings();if(ticket!==generation)return;config=settings;nextClaimAtMs=0}
  if(model.validateRewards(config).length)throw Error('Daily rewards need their configuration corrected.');render();clock();
 }catch(e){if(ticket!==generation)return;config=null;clock();error(window.RipprAccount.errorMessage(e))}
 finally{if(ticket===generation)$('#open-case').setAttribute('aria-busy','false')}
}
async function spin(){
 if(mode==='guest'){login();return}if(mode!=='ready'||busy())return;
 const uid=window.RIPPR_ACCOUNT.user.uid,ticket=generation;pendingResult=null;mode='purchasing';error('');$('#result').hidden=true;$('#case-panel').classList.remove('is-won');document.querySelector('.reward-result-link')?.remove();$('#open-case').disabled=true;$('#open-case').textContent='Preparing spin…';$('#open-case').setAttribute('aria-busy','true');renderExtras();
 try{
  const result=await window.RipprAccount.act('claimReward',{expectedVersion:config.version});
  if(ticket!==generation||uid!==window.RIPPR_ACCOUNT?.user?.uid)return;
  pendingResult=result;nextClaimAtMs=result.nextClaimAtMs;
  const win=slots.findIndex(p=>p.id===result.prize.id);if(win<0)throw Error('Your saved reward is available in your account.');
  mode='spinning';$('#open-case').setAttribute('aria-busy','false');$('#open-case').textContent='Spinning…';announce('Spinning your daily reward wheel.');
  const end=Math.ceil(rotation/360)*360+1800-win*360/slots.length;
  animation=$('#reward-wheel').animate([{transform:`rotate(${rotation}deg)`},{transform:`rotate(${end}deg)`}],{duration:media.matches?0:4800,easing:'cubic-bezier(.12,.72,.14,1)',fill:'forwards'});
  if(document.hidden)animation.pause();await animation.finished;
  if(ticket!==generation||uid!==window.RIPPR_ACCOUNT?.user?.uid)return;
  rotation=((end%360)+360)%360;$('#reward-wheel').style.transform=`rotate(${rotation}deg)`;animation.cancel();animation=null;mode='claimed';clock();$('#case-panel').classList.add('is-won');
  $('#result').textContent=`You received ${model.rewardLabel(result.prize)}.`;$('#result').hidden=false;
  if(result.prize.kind==='pack'){const link=document.createElement('a');link.className='reward-result-link';link.href='profile.html';link.textContent='View your unopened pack ↗';$('.case-actions').append(link)}
  announce(`${$('#result').textContent} ${result.prize.kind==='pack'?'Your pack is saved in My items.':'Credit added to your test balance.'}`);
 }catch(e){if(ticket!==generation)return;animation?.cancel();animation=null;mode='ready';clock();error(pendingResult?'Your reward was saved. View My items to find it.':window.RipprAccount.errorMessage(e))}
 finally{if(ticket===generation)$('#open-case').setAttribute('aria-busy','false')}
}
async function claimExtra(action){
 if(!window.RIPPR_ACCOUNT?.user){login();return}if(busy()||!extras)return;
 const ticket=generation,uid=window.RIPPR_ACCOUNT.user.uid;extraBusy=true;clock();error('');
 try{
  const result=await window.RipprAccount.act(action,action==='claimStreak'?{expectedDay:streakState().day}:{});
  if(ticket!==generation||uid!==window.RIPPR_ACCOUNT?.user?.uid)return;
  extras=result.extras;announce(`You received ${model.rewardLabel(result.prize)}.`);
  if(action==='claimStreak')$('#streak-status').textContent=`You received ${model.rewardLabel(result.prize)}.`;
 }catch(e){if(ticket===generation&&uid===window.RIPPR_ACCOUNT?.user?.uid)error(window.RipprAccount.errorMessage(e))}
 finally{if(ticket===generation){extraBusy=false;clock()}}
}
$('#open-case').addEventListener('click',spin);$('#retry-rewards').addEventListener('click',load);$('#claim-streak').addEventListener('click',()=>claimExtra('claimStreak'));$('#claim-welcome').addEventListener('click',()=>claimExtra('claimWelcomeCase'));
for(const [trigger,id] of [['view-prizes','prizes-dialog'],['streak-info','streak-dialog']]){
 const dialog=$('#'+id);$('#'+trigger).addEventListener('click',()=>dialog.showModal());dialog.querySelector('[data-close]').addEventListener('click',()=>dialog.close());dialog.addEventListener('close',()=>$('#'+trigger).focus({preventScroll:true}));
}
document.addEventListener('rippr:authchange',()=>{generation++;animation?.cancel();animation=null;mode='loading';extraBusy=false;pendingResult=null;$('#result').hidden=true;document.querySelector('.reward-result-link')?.remove();load()});
document.addEventListener('rippr:walletchange',()=>{const wallet=window.RIPPR_ACCOUNT?.wallet;if(wallet&&mode!=='spinning'&&mode!=='purchasing'){nextClaimAtMs=wallet.nextRewardAtMs??nextClaimAtMs;if(extras)extras=model.rewardExtras(wallet,serverNow());clock()}});
function visibility(){if(animation&&mode==='spinning'){if(document.hidden)animation.pause();else if(animation.playState==='paused')animation.play()}}
document.addEventListener('visibilitychange',visibility);media.addEventListener('change',()=>{if(media.matches&&animation)animation.finish()});
function startClock(){clearInterval(timer);timer=setInterval(clock,1000)}
window.addEventListener('pagehide',()=>{clearInterval(timer);animation?.pause()});window.addEventListener('pageshow',()=>{startClock();visibility();clock()});startClock();
if(window.RIPPR_ACCOUNT?.ready)load();
})();
