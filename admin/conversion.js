(()=>{
 'use strict';
 const root=document.querySelector('#conversion-view');if(!root)return;
 const $=selector=>root.querySelector(selector),stages=['landing','pack','signup','checkout','registered','funded','opened','returned'];
 const labels={direct:'Direct / unattributed',instagram:'Instagram',tiktok:'TikTok',facebook:'Facebook',youtube:'YouTube',discord:'Discord',google:'Google',email:'Email',referral:'Referral',other:'Other source'};
 const allowed=()=>window.RipprCatalog?.isAdminUser(window.RIPPR_ACCOUNT?.user)===true;
 const number=n=>new Intl.NumberFormat('en-US').format(n);
 let busy=false,loaded=false,generation=0,lastDays=null;
 const node=(tag,copy,className)=>{const el=document.createElement(tag);if(copy!==undefined)el.textContent=copy;if(className)el.className=className;return el};
 function validate(result){
  if(!result||!Array.isArray(result.sources)||!result.totals||!Number.isSafeInteger(result.recordedDays)||result.recordedDays<0||!Number.isSafeInteger(result.asOfMs)||!['startDay','endDay'].every(k=>/^\d{4}-\d{2}-\d{2}$/.test(result[k]||''))||!stages.every(k=>Number.isSafeInteger(result.totals[k])&&result.totals[k]>=0)||!result.sources.every(row=>typeof row.source==='string'&&stages.every(k=>Number.isSafeInteger(row[k])&&row[k]>=0)))throw Error('Invalid conversion summary.');
  return result;
 }
 function group(title,description,definitions,totals){
  const section=node('section',undefined,'conversion-group'),h=node('h3',title),p=node('p',description,'conversion-muted'),grid=node('div',undefined,'conversion-metrics');
  for(const [key,label,detail]of definitions){const card=node('article',undefined,'conversion-metric');card.dataset.conversionMetric=key;card.append(node('h4',label),node('strong',number(totals[key])),node('p',detail));grid.append(card)}
  section.append(h,p,grid);return section;
 }
 function render(result){
  const summary=$('#conversion-summary'),sources=$('#conversion-sources');summary.replaceChildren();sources.replaceChildren();
  const totals=result.totals;
  if(!result.recordedDays||!totals.landing){const empty=node('div',undefined,'conversion-empty');empty.append(node('h3','Your next visitors start the story.'),node('p','No measured landing activity in this date range yet. Share a tagged /landing link, then return here after visitors arrive. Earlier site traffic is not backfilled.'));summary.append(empty);return}
  summary.append(group('Landing journey','Observed browser sessions · one count per step in each 30-minute landing session.',[
   ['landing','Landing visits','Measured sessions that started on /landing.'],['pack','Viewed a pack','Sessions that reached a pack page.'],['signup','Started signup','Sessions that entered the signup flow.'],['checkout','Started checkout','Sessions that continued to Stripe Checkout.']
  ],totals));
  summary.append(group('Confirmed new-customer activity','New live accounts attributed to a measured landing visit · confirmed by the server, with up to 30 days of follow-up.',[
   ['registered','New accounts','New account registration attributed to a measured landing session.'],['funded','First funding','First verified balance funding. A checkout click alone does not count.'],['opened','First paid opening','First pack opening paid from the account balance.'],['returned','Repeat paid opening','A later paid opening; this does not by itself mean a visit on another day.']
  ],totals));
  const insight=node('aside',undefined,'conversion-insight'),percent=Math.round(totals.pack/totals.landing*100);
  insight.append(node('strong',number(totals.pack)+' of '+number(totals.landing)+' landing sessions reached a pack ('+percent+'%).'));
  insight.append(node('p',totals.landing<20?'This is an early sample. Gather more visits before drawing conclusions or increasing ad spend.':'Compare this share as you improve the landing page. The steps are not forced in order, so differences between adjacent counts are not exact abandonment rates.'));
  summary.append(insight);
  const heading=node('h3','Where visits came from'),copy=node('p','First reported landing source. Source tags describe attribution; they do not prove that a channel caused a purchase.','conversion-muted');
  const wrap=node('div',undefined,'conversion-table-wrap'),table=node('table',undefined,'conversion-table'),caption=node('caption','Measured landing cohorts by source'),thead=node('thead'),header=node('tr');
  for(const label of ['Source','Landing visits','Pack views','Signup starts','Checkout starts','New accounts','First funding','First paid open','Repeat paid open']){const th=node('th',label);th.scope='col';header.append(th)}thead.append(header);table.append(caption,thead);
  const body=node('tbody');
  for(const row of [...result.sources].sort((a,b)=>b.landing-a.landing||a.source.localeCompare(b.source))){const tr=node('tr'),th=node('th',labels[row.source]||'Other source');th.scope='row';tr.append(th);for(const key of stages)tr.append(node('td',number(row[key])));body.append(tr)}
  table.append(body);wrap.tabIndex=0;wrap.setAttribute('role','region');wrap.setAttribute('aria-label','Acquisition sources, scroll horizontally for all columns');wrap.append(table);sources.append(heading,copy,wrap);
 }
 function controls(locked){busy=locked;$('#conversion-refresh').disabled=locked;$('#conversion-days').disabled=locked;root.setAttribute('aria-busy',String(locked))}
 async function load(){
  if(busy||!allowed())return;
  const uid=window.RIPPR_ACCOUNT.user.uid,ticket=generation,days=Number($('#conversion-days').value);if(![7,30].includes(days))return;
  controls(true);$('#conversion-status').textContent='Loading conversion data…';
  try{
   const result=validate(await window.RipprFirebase.accountAction('adminConversions',{days,accountUid:uid}));
   if(ticket!==generation||uid!==window.RIPPR_ACCOUNT?.user?.uid||!allowed())return;
   render(result);loaded=true;lastDays=days;
   $('#conversion-updated').textContent=result.startDay+' – '+result.endDay+' · Indianapolis calendar days · Updated '+new Intl.DateTimeFormat('en-US',{dateStyle:'medium',timeStyle:'short',timeZone:'America/Indiana/Indianapolis'}).format(new Date(result.asOfMs));
   $('#conversion-status').textContent=result.sandbox?'Sandbox data only. These are not live customer results.':result.recordedDays&&result.totals.landing?'Conversion data loaded. Browser steps and confirmed account activity are shown separately.':'No measured landing visits in this range yet.';
  }catch{
   if(ticket===generation)$('#conversion-status').textContent=loaded?'Could not refresh. Previous '+lastDays+'-day data remains shown; its timestamp has not changed.':'Conversion data is unavailable. Refresh to retry; no results have been inferred.';
  }finally{if(ticket===generation)controls(false)}
 }
 $('#conversion-refresh').addEventListener('click',load);$('#conversion-days').addEventListener('change',load);
 document.addEventListener('rippr:adminview',event=>{if(event.detail?.name==='conversion'&&(!loaded||lastDays!==Number($('#conversion-days').value)))void load()});
 document.addEventListener('rippr:authchange',()=>{generation++;loaded=false;lastDays=null;controls(false);$('#conversion-summary').replaceChildren();$('#conversion-sources').replaceChildren();$('#conversion-status').textContent='';$('#conversion-updated').textContent=''});
})();
