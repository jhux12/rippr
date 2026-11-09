(() => {
 const $=s=>document.querySelector(s),model=window.RipprRewards,client=window.RipprFirebase;
 let config=model.defaultRewards(),loaded=false,busy=false,dirty=false,pendingId=null;
 const owner=()=>window.RipprCatalog.isAdminUser(client?.currentUser());
 const percent=n=>(n/100).toFixed(2).replace(/\.00$/,'');
 const error=message=>{$('#reward-settings-error').textContent=message;$('#reward-settings-error').hidden=!message};
 function controls(){document.querySelectorAll('#rewards-view input,#rewards-view select,#rewards-view button').forEach(el=>el.disabled=busy||!loaded);$('#reload-rewards').disabled=busy;$('#save-rewards').disabled=busy||!loaded||!dirty}
 function render(){
  $('#rewards-enabled').checked=config.enabled;$('#rewards-no-cooldown').checked=config.testingNoCooldown===true;
  $('#reward-prize-rows').innerHTML=config.prizes.map((p,i)=>`<div class="reward-prize-row" data-row="${i}"><label>Prize type<select data-field="kind"><option value="credit" ${p.kind==='credit'?'selected':''}>Balance credit</option><option value="pack" ${p.kind==='pack'?'selected':''}>Unopened pack</option></select></label>${p.kind==='credit'?`<label>Amount ($)<input data-field="amount" inputmode="decimal" value="${Number.isFinite(p.amountCents)?(p.amountCents/100).toFixed(2):''}" required></label>`:`<label>Pack tier<select data-field="packId">${model.REWARD_PACKS.map(id=>`<option value="${id}" ${id===p.packId?'selected':''}>${id==='icy-rush'?'Icy Rush':id[0].toUpperCase()+id.slice(1)}</option>`).join('')}</select></label>`}<label>Odds (%)<input data-field="chance" inputmode="decimal" value="${Number.isFinite(p.chanceBps)?percent(p.chanceBps):''}" required></label><button type="button" class="button secondary" data-remove="${i}" aria-label="Remove prize ${i+1}">×</button></div>`).join('');
  totals();controls();
 }
 function totals(){const sum=config.prizes.reduce((n,p)=>n+(Number.isInteger(p.chanceBps)?p.chanceBps:0),0);$('#reward-odds-total').textContent='Total odds: '+percent(sum)+'%';$('#reward-odds-total').classList.toggle('invalid',sum!==10000)}
 async function load(){if(busy||!owner())return;busy=true;error('');controls();const uid=client.currentUser().uid;
  try{const state=await client.accountAction('rewardState');if(client.currentUser()?.uid!==uid)return;config=state.config;loaded=true;dirty=false;pendingId=null;$('#reward-settings-status').textContent='Saved reward settings loaded.';render()}
  catch(e){error(window.RipprAccount.errorMessage(e))}finally{busy=false;controls()}
 }
 document.addEventListener('rippr:adminview',e=>{if(e.detail.name==='rewards'&&!loaded)load()});
 document.addEventListener('rippr:authchange',()=>{loaded=false;dirty=false;pendingId=null;config=model.defaultRewards();render()});
 $('#rewards-no-cooldown').addEventListener('change',e=>{config.testingNoCooldown=e.target.checked;dirty=true;pendingId=null;controls()});
 $('#rewards-enabled').addEventListener('change',e=>{config.enabled=e.target.checked;dirty=true;pendingId=null;controls()});
 $('#reward-prize-rows').addEventListener('input',e=>{const row=e.target.closest('[data-row]');if(!row||!e.target.dataset.field)return;const p=config.prizes[Number(row.dataset.row)],field=e.target.dataset.field;
  if(field==='kind'){const chanceBps=p.chanceBps,id=p.id;config.prizes[Number(row.dataset.row)]={id,kind:e.target.value,chanceBps,...(e.target.value==='pack'?{packId:'basic'}:{amountCents:25})};render()}
  else if(field==='packId')p.packId=e.target.value;
  else{const value=window.RipprCatalog.decimalToUnits(e.target.value);p[field==='amount'?'amountCents':'chanceBps']=value}
  dirty=true;pendingId=null;totals();controls();error('');
 });
 $('#reward-prize-rows').addEventListener('click',e=>{const button=e.target.closest('[data-remove]');if(!button||busy)return;config.prizes.splice(Number(button.dataset.remove),1);dirty=true;pendingId=null;render()});
 $('#add-reward').addEventListener('click',()=>{if(config.prizes.length>=20){error('Use up to 20 prizes.');return}config.prizes.push({id:crypto.randomUUID(),kind:'credit',amountCents:25,chanceBps:0});dirty=true;pendingId=null;render()});
 $('#reload-rewards').addEventListener('click',()=>{if(!dirty||confirm('Discard unsaved reward changes?'))load()});
 $('#rewards-form').addEventListener('submit',async e=>{e.preventDefault();if(!owner()||busy||!loaded)return;const issues=model.validateRewards(config);if(issues.length){error(issues[0]);return}busy=true;controls();error('');pendingId ||= crypto.randomUUID();const uid=client.currentUser().uid;
  try{const result=await client.saveRewardSettings(config,config.version,pendingId);if(client.currentUser()?.uid!==uid)return;config=result.config;dirty=false;pendingId=null;$('#reward-settings-status').textContent='Rewards saved. The spinner now uses these prizes and odds.';render()}
  catch(e){error(window.RipprAccount.errorMessage(e));if(!['functions/unavailable','functions/internal','functions/deadline-exceeded','functions/unknown'].includes(e.code))pendingId=null}
  finally{busy=false;controls()}
 });
 window.addEventListener('beforeunload',e=>{if(owner()&&dirty){e.preventDefault();e.returnValue=''}});render();
})();
