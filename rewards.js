(() => {
'use strict';
const $=s=>document.querySelector(s),model=window.RipprRewards;
let config=null,mode='loading',index=2,animation=null,pool=[],nextClaimAtMs=0,serverOffset=0,generation=0,pendingResult=null;
const reduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const image=p=>p.kind==='pack'?`assets/pack-${p.packId}.svg`:'assets/rewards/credit-wallet.svg';
const art=p=>`<img class="${p.kind==='pack'?'pack-art':'wallet-art'}" src="${image(p)}" alt="" draggable="false">`;
const copy=p=>p.kind==='pack'?{value:model.rewardLabel(p),detail:''}:{value:model.rewardLabel(p).replace(' credit',''),detail:'credit'};
document.querySelector('[data-image="pip-daily-case.png"]').src='assets/rewards/pip-daily-case.png';
function error(message){$('#reward-error').textContent=message;$('#reward-error').hidden=!message;$('#retry-rewards').hidden=!message}
function announce(message){$('#live-status').textContent=message}
function render(){
 const prizes=config.prizes.filter(p=>p.chanceBps>0);pool=Array.from({length:90},(_,i)=>prizes[i%prizes.length]);
 $('#reel-track').innerHTML=pool.map((p,i)=>{const text=copy(p);return `<div class="prize ${p.kind==='pack'?'pack-prize':''}" data-index="${i}" aria-hidden="true"><div class="prize-art">${art(p)}</div><strong>${escape(text.value)}</strong>${text.detail?`<small>${text.detail}</small>`:''}</div>`}).join('');
 $('#reward-grid').innerHTML=prizes.map(p=>{const text=copy(p);return `<article class="reward-preview" aria-label="${escape(model.rewardLabel(p))}, ${p.chanceBps/100}% chance">${art(p)}<div class="prize-copy"><strong>${escape(text.value)}</strong>${text.detail?`<small>${text.detail}</small>`:''}<span class="reward-odds">${(p.chanceBps/100).toLocaleString('en-US',{maximumFractionDigits:2})}%</span></div></article>`}).join('');index=2;align();
}
const target=i=>{const tile=$('.prize');return tile?$('#reel-window').clientWidth/2-i*(tile.getBoundingClientRect().width+parseFloat(getComputedStyle($('#reel-track')).gap))-tile.getBoundingClientRect().width/2:0};
function align(){if(mode==='spinning')return;$('#reel-track').style.transform=`translateX(${target(index)}px)`}
function clock(){
 if(mode==='spinning'||mode==='purchasing')return;
 const user=window.RIPPR_ACCOUNT?.user;
 const left=config?.testingNoCooldown?0:Math.max(0,Math.ceil((nextClaimAtMs-(Date.now()+serverOffset))/1000));
 mode=!config?'loading':!config.enabled?'paused':!user?'guest':left?'claimed':'ready';
 $('#case-panel').className='case-panel'+(mode==='claimed'?' is-claimed':mode==='paused'?' is-locked':'');
 $('#status-text').textContent={ready:'Ready to open',guest:'Log in to claim',claimed:'Reward claimed',paused:'Daily rewards paused',loading:'Loading rewards…'}[mode];
 $('#opening-detail').textContent=config?.testingNoCooldown?'Testing · no cooldown':mode==='claimed'?'Your next case is on its way':'1 free opening every 24 hours';
 $('#open-case').textContent={ready:'✦  Open daily case',guest:'Log in to claim',claimed:'✓  Claimed',paused:'Rewards paused',loading:'Loading…'}[mode];
 $('#open-case').disabled=!['ready','guest'].includes(mode);
 $('#timer-label').textContent=config?.testingNoCooldown?'Testing mode':mode==='claimed'?'Next case in':'Daily reward';$('#countdown').hidden=mode!=='claimed';
 if(left)$('#countdown').textContent=[Math.floor(left/3600),Math.floor(left/60)%60,left%60].map(n=>String(n).padStart(2,'0')).join(':');
}
async function load(){
 if(mode==='spinning'||mode==='purchasing')return;
 const ticket=++generation,uid=window.RIPPR_ACCOUNT?.user?.uid;config=null;mode='loading';clock();error('');
 try{
  if(window.RIPPR_AUTH_OFFLINE){config=model.defaultRewards();nextClaimAtMs=0}
  else if(uid){const state=await window.RipprFirebase.accountAction('rewardState',{accountUid:uid});if(ticket!==generation)return;config=state.config;nextClaimAtMs=state.nextClaimAtMs;serverOffset=state.serverTimeMs-Date.now()}
  else{const settings=await window.RipprFirebase.loadRewardSettings();if(ticket!==generation)return;config=settings;nextClaimAtMs=0}
  render();clock();
 }catch(e){if(ticket!==generation)return;config=null;mode='loading';clock();error(window.RipprAccount.errorMessage(e))}
}
function sparkle(){if(reduced())return;for(let i=0;i<18;i++){const p=document.createElement('i');p.className='confetti';const angle=Math.PI*2*i/18;p.style.setProperty('--x',Math.cos(angle)*160+'px');p.style.setProperty('--y',Math.sin(angle)*120-50+'px');p.style.setProperty('--r',i*30+'deg');$('#case-panel').append(p);p.addEventListener('animationend',()=>p.remove(),{once:true})}}
async function spin(){
 if(mode==='guest'){location.href='auth.html?mode=login&next='+encodeURIComponent(location.pathname+location.search+location.hash);return}if(mode!=='ready')return;
 const uid=window.RIPPR_ACCOUNT.user.uid,ticket=generation;
 pendingResult=null;document.querySelectorAll('.winner').forEach(el=>el.classList.remove('winner'));mode='purchasing';$('#open-case').disabled=true;$('#open-case').textContent='Opening…';$('#status-text').textContent='Opening…';error('');$('#result').hidden=true;document.querySelector('.reward-result-link')?.remove();
 try{
  const result=await window.RipprAccount.act('claimReward',{expectedVersion:config.version});
  if(ticket!==generation||uid!==window.RIPPR_ACCOUNT?.user?.uid)return;
  pendingResult=result;nextClaimAtMs=result.nextClaimAtMs;
  const win=pool.findIndex((p,i)=>i>=40&&p.id===result.prize.id);
  if(win<0)throw new Error('The prize display changed. Your reward is saved in your account.');
  mode='spinning';$('#case-panel').classList.add('is-spinning');announce('Opening your daily case.');
  animation=$('#reel-track').animate([{transform:`translateX(${target(index)}px)`},{transform:`translateX(${target(win)}px)`}],{duration:reduced()?120:4800,easing:'cubic-bezier(.12,.72,.14,1)',fill:'forwards'});
  await animation.finished;
  if(ticket!==generation)return;
  index=win;$('#reel-track').style.transform=`translateX(${target(index)}px)`;animation.cancel();animation=null;mode='claimed';clock();$(`[data-index="${index}"]`).classList.add('winner');
  $('#result').textContent=`You received ${model.rewardLabel(result.prize)}.`;$('#result').hidden=false;
  if(result.prize.kind==='pack'){const link=document.createElement('a');link.className='reward-result-link';link.href='profile.html';link.textContent='View your unopened pack ↗';$('.case-actions').append(link)}
  announce(`You received ${model.rewardLabel(result.prize)}. ${result.prize.kind==='pack'?'Your unopened pack is saved in your items.':'Credit added to your test balance.'}`);sparkle();
 }catch(e){if(ticket!==generation)return;mode='ready';clock();error(pendingResult?'Your reward was saved. View your profile to find it.':window.RipprAccount.errorMessage(e));announce($('#reward-error').textContent)}
}
$('#open-case').addEventListener('click',spin);$('#retry-rewards').addEventListener('click',load);
document.addEventListener('rippr:authchange',()=>{generation++;animation?.cancel();animation=null;mode='loading';pendingResult=null;$('#result').hidden=true;document.querySelector('.reward-result-link')?.remove();load()});
document.addEventListener('rippr:walletchange',()=>{const wallet=window.RIPPR_ACCOUNT?.wallet;if(wallet&&mode!=='spinning'&&mode!=='purchasing'){nextClaimAtMs=wallet.nextRewardAtMs||nextClaimAtMs;clock()}});
new ResizeObserver(()=>{if(mode==='spinning')animation?.finish();else align()}).observe($('#reel-window'));
setInterval(clock,1000);
if(window.RIPPR_ACCOUNT?.ready)load();
})();
