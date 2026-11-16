import {createHash} from 'node:crypto';
import {HttpsError} from 'firebase-functions/v2/https';
import {isAdminToken} from './catalog-model.js';
import {promotionDay} from './promotion-summary.js';

// Only coarse, first-party landing cohorts are measured. Browser events never
// represent payment success; financial/retention milestones have trusted callers.
export const ENGAGEMENT_STAGES=['landing','pack','signup','checkout'];
export const CUSTOMER_STAGES=['registered','funded','opened','returned'];
export const CONVERSION_SOURCES=['direct','instagram','tiktok','facebook','youtube','discord','google','email','referral','other'];
const stages=[...ENGAGEMENT_STAGES,...CUSTOMER_STAGES];
const SESSION_MS=30*60000,FOLLOWUP_MS=30*86400000,RECONCILE_MS=7*86400000,NETWORK_LIMIT=120,DAILY_SESSION_LIMIT=20000;
const hash=value=>createHash('sha256').update(value).digest('hex');
const fail=(code,message)=>{throw new HttpsError(code,message)};
const counts=()=>Object.fromEntries(stages.map(stage=>[stage,0]));
function time(atMs){if(!Number.isSafeInteger(atMs)||atMs<0||atMs>8640000000000000)fail('invalid-argument','Invalid measurement time.');return atMs}
function sessionKey(value){if(typeof value!=='string'||!/^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i.test(value))fail('invalid-argument','Use a valid landing session.');return hash(value.toLowerCase())}
function accountKey(uid){if(typeof uid!=='string'||!uid||uid.length>128||uid.includes('/'))fail('unauthenticated','Sign in before connecting a landing session.');return hash(uid)}
function number(value){if(!Number.isSafeInteger(value)||value<0)fail('failed-precondition','Conversion totals need review.');return value}
function increment(data,day,source,changes,atMs){
 const next={...data,day,expiresAtMs:data?.expiresAtMs??atMs+90*86400000,totals:{...counts(),...data?.totals},sources:{...data?.sources},updatedAtMs:atMs};
 const bucket={...counts(),...next.sources[source]};
 for(const stage of changes){next.totals[stage]=number(number(next.totals[stage])+1);bucket[stage]=number(number(bucket[stage])+1)}
 next.sources[source]=bucket;return next;
}
function eligibleMilestones(account,startedAtMs){
 // Only registrations observed inside this landing cohort represent new customers.
 // Existing customers may bind a session but never inflate first-customer metrics.
 const registered=account.milestones?.registered;if(!Number.isSafeInteger(registered)||registered<startedAtMs||registered>startedAtMs+FOLLOWUP_MS)return[];
 return CUSTOMER_STAGES.filter(stage=>Number.isSafeInteger(account.milestones?.[stage])&&!account.counted?.[stage]&&account.milestones[stage]>=startedAtMs&&account.milestones[stage]<=startedAtMs+FOLLOWUP_MS);
}

export async function recordEngagement(db,input={},options={}){
 const atMs=time(options.atMs??Date.now()),key=sessionKey(input.sessionId),stage=input.stage,source=input.source??'direct';
 if(!ENGAGEMENT_STAGES.includes(stage)||!CONVERSION_SOURCES.includes(source))fail('invalid-argument','Unknown landing measurement.');
 if(typeof options.networkKey!=='string'||!options.networkKey||options.networkKey.length>256)fail('invalid-argument','Measurement network context is required.');
 const day=promotionDay(atMs),bucket=Math.floor(atMs/60000),sessionRef=db.doc('conversionSessions/'+key),limitRef=db.doc('conversionLimits/'+hash(options.networkKey+':'+bucket));
 return db.runTransaction(async tx=>{
  const [sessionSnapshot,limitSnapshot]=await Promise.all([tx.get(sessionRef),tx.get(limitRef)]),session=sessionSnapshot.data(),limit=limitSnapshot.data();
  if(number(limit?.count??0)>=NETWORK_LIMIT)fail('resource-exhausted','Too many measurements.');
  if(!session&&stage!=='landing'){tx.set(limitRef,{count:number(limit?.count??0)+1,expiresAtMs:(bucket+2)*60000});return{recorded:false}}
  if(session&&(atMs<session.startedAtMs||atMs>=session.expiresAtMs)){tx.set(limitRef,{count:number(limit?.count??0)+1,expiresAtMs:(bucket+2)*60000});return{recorded:false,expired:true}}
  const sessionDay=session?.day||day,sessionSource=session?.source||source,dayRef=db.doc('conversionDays/'+sessionDay),daySnapshot=await tx.get(dayRef),daily=daySnapshot.data();
  if(!session&&number(daily?.totals?.landing??0)>=DAILY_SESSION_LIMIT){tx.set(limitRef,{count:number(limit?.count??0)+1,expiresAtMs:(bucket+2)*60000});return{recorded:false,limited:true}}
  tx.set(limitRef,{count:number(limit?.count??0)+1,expiresAtMs:(bucket+2)*60000});
  if(Number.isSafeInteger(session?.stages?.[stage]))return{recorded:false};
  tx.set(sessionRef,{...(session||{source:sessionSource,day:sessionDay,startedAtMs:atMs,expiresAtMs:atMs+SESSION_MS,deleteAtMs:atMs+FOLLOWUP_MS+RECONCILE_MS}),stages:{...session?.stages,[stage]:atMs}});
  tx.set(dayRef,increment(daily,sessionDay,sessionSource,[stage],atMs));
  return{recorded:true};
 });
}

// Linking is authenticated, one-time and does not mutate a financial account.
// The random session is a capability; once linked, another account cannot reuse it.
export async function bindAcquisition(db,uid,input={},claims={},atMs=Date.now()){
 time(atMs);const customer=accountKey(uid);if(isAdminToken(claims,uid))return{bound:false,excluded:true};
 const key=sessionKey(input.sessionId),accountRef=db.doc('conversionAccounts/'+customer),sessionRef=db.doc('conversionSessions/'+key);
 return db.runTransaction(async tx=>{
  const [accountSnapshot,sessionSnapshot]=await Promise.all([tx.get(accountRef),tx.get(sessionRef)]),account=accountSnapshot.data()||{},session=sessionSnapshot.data();
  if(account.sessionHash)return{bound:account.sessionHash===key};
  if(!session||atMs<session.startedAtMs||atMs>=session.expiresAtMs)return{bound:false};
  if(session.accountHash&&session.accountHash!==customer)fail('permission-denied','This landing session is already connected.');
  const dayRef=db.doc('conversionDays/'+session.day),daySnapshot=await tx.get(dayRef),changes=eligibleMilestones(account,session.startedAtMs),counted={...account.counted};
  changes.forEach(stage=>counted[stage]=true);
  tx.set(accountRef,{...account,source:session.source,day:session.day,sessionHash:key,startedAtMs:session.startedAtMs,attributionExpiresAtMs:session.startedAtMs+FOLLOWUP_MS,expiresAtMs:session.startedAtMs+FOLLOWUP_MS+RECONCILE_MS,boundAtMs:atMs,counted});
  tx.update(sessionRef,{accountHash:customer});
  if(changes.length)tx.set(dayRef,increment(daySnapshot.data(),session.day,session.source,changes,atMs));
  return{bound:true};
 });
}

// Trusted server events ONLY. Never expose this function as a browser action.
// Persisting milestone timestamps before attribution allows event delivery in any
// order without losing a first deposit/opening or counting a retried event twice.
export async function recordCustomerMilestones(db,uid,flags={},atMs=Date.now()){
 time(atMs);const key=accountKey(uid),requested=CUSTOMER_STAGES.filter(stage=>flags[stage]===true);if(!requested.length)return{recorded:[]};
 const ref=db.doc('conversionAccounts/'+key);
 return db.runTransaction(async tx=>{
  const found=await tx.get(ref),account=found.data()||{},milestones={...account.milestones};
  let openingEvents=(account.openingEvents||[]).filter(event=>event&&typeof event.id==='string'&&Number.isSafeInteger(event.atMs));
  if(flags.opened===true&&typeof flags.openingEventId==='string'&&flags.openingEventId.length>0&&flags.openingEventId.length<=160){
   const id=hash(flags.openingEventId),prior=openingEvents.find(event=>event.id===id);
   if(prior)openingEvents=openingEvents.map(event=>event.id===id?{id,atMs:Math.min(event.atMs,atMs)}:event);
   else openingEvents.push({id,atMs});
   // Keep the earliest two distinct paid activities even if triggers arrive late.
   openingEvents.sort((a,b)=>a.atMs-b.atMs||a.id.localeCompare(b.id));openingEvents=openingEvents.slice(0,2);
   if(openingEvents.length===2&&!requested.includes('returned'))requested.push('returned');
  }
  for(const stage of requested)milestones[stage]=Number.isSafeInteger(milestones[stage])?Math.min(milestones[stage],atMs):atMs;
  if(openingEvents.length){milestones.opened=openingEvents[0].atMs;if(openingEvents.length===2)milestones.returned=openingEvents[1].atMs;}
  const next={...account,milestones,expiresAtMs:account.expiresAtMs??atMs+FOLLOWUP_MS,...(openingEvents.length?{openingEvents}:{})};
  if(!account.sessionHash){tx.set(ref,next);return{recorded:[]}}
  const changes=eligibleMilestones(next,account.startedAtMs),dayRef=db.doc('conversionDays/'+account.day),day=await tx.get(dayRef),counted={...account.counted};
  changes.forEach(stage=>counted[stage]=true);tx.set(ref,{...next,counted});
  if(changes.length)tx.set(dayRef,increment(day.data(),account.day,account.source,changes,atMs));
  return{recorded:changes};
 });
}

export async function adminConversionSummary(db,uid,input={},claims={},atMs=Date.now()){
 if(!isAdminToken(claims,uid))fail('permission-denied','Only the verified owner may view conversion totals.');
 time(atMs);const days=input.days??7;if(![7,30].includes(days))fail('invalid-argument','Choose 7 or 30 days.');
 const endDay=promotionDay(atMs),startDay=new Date(Date.parse(endDay+'T12:00:00Z')-(days-1)*86400000).toISOString().slice(0,10),totals=counts(),sources=Object.fromEntries(CONVERSION_SOURCES.map(source=>[source,counts()]));
 // One document per day bounds reporting reads. No session/account/IP data leaves.
 const rows=await db.collection('conversionDays').orderBy('day','desc').limit(30).get();let recordedDays=0;
 for(const doc of rows.docs){const row=doc.data();if(row.day<startDay||row.day>endDay)continue;recordedDays++;for(const stage of stages){totals[stage]=number(totals[stage]+number(row.totals?.[stage]??0));for(const source of CONVERSION_SOURCES)sources[source][stage]=number(sources[source][stage]+number(row.sources?.[source]?.[stage]??0));}}
 return{days,startDay,endDay,timeZone:'America/Indiana/Indianapolis',totals,sources:CONVERSION_SOURCES.map(source=>({source,...sources[source]})),recordedDays,historicalBackfill:false,attributionWindowDays:30,sessionWindowMinutes:30,asOfMs:atMs,sandbox:db.mode!=='live'};
}
