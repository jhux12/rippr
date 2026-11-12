import {renderEmail} from './email-templates.js';
import {emailAllowed,verifiedRecipient} from './email-events.js';
import {createHash} from 'node:crypto';
const supported=new Set(['welcome','shipping-request','order-shipped','order-delivered','reward-earned','referral-earned','support-received','support-reply','verify-email']);
export function validateEmailConfig(config){
 if(!config.enabled)return false;
 const site=new URL(config.siteUrl);
 if(site.protocol!=='https:'||site.pathname!=='/'||site.search||site.hash||site.username||site.password||site.hostname.endsWith('.example'))throw new Error('Set EMAIL_SITE_URL to your public HTTPS origin.');
 if(!/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(config.from||''))throw new Error('Set EMAIL_FROM to your verified sender address.');
 if(config.replyTo&&!/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(config.replyTo))throw new Error('Set EMAIL_REPLY_TO to a valid address.');
 return true;
}
export async function sendResend(message,{apiKey,fetchImpl=fetch}={}){
 if(!apiKey)throw new Error('Email provider secret is missing.');
 const response=await fetchImpl('https://api.resend.com/emails',{method:'POST',signal:AbortSignal.timeout(15000),headers:{Authorization:'Bearer '+apiKey,'Content-Type':'application/json','Idempotency-Key':'rippr-'+message.id},body:JSON.stringify({from:message.from,to:[message.to],subject:message.subject,html:message.html,text:message.text,...(message.replyTo?{reply_to:message.replyTo}:{})})});
 if(!response.ok){const error=new Error('Email provider returned '+response.status);error.permanent=response.status>=400&&response.status<500&&![408,409,425,429].includes(response.status);throw error}
 const body=await response.json();if(typeof body.id!=='string')throw new Error('Provider response is missing its message ID.');return body.id;
}
// Firestore and provider idempotency cooperate: no mail is sent inside a DB transaction.
export async function deliverEmail(db,id,config,{send=sendResend,now=Date.now,apiKey}={}){
 if(!validateEmailConfig(config))return{disabled:true};
 const target=db.doc('emailOutbox/'+id),time=now();
 const job=await db.runTransaction(async tx=>{
  const saved=await tx.get(target);if(!saved.exists)return null;const job=saved.data();
  if(['sent','skipped','failed','expired'].includes(job.status)||job.leaseUntilMs>time||job.nextAttemptAtMs>time)return null;
  const owner=await tx.get(db.doc('testAccounts/'+job.uid)),wallet=owner.data();
  let valid=supported.has(job.type)&&job.to===verifiedRecipient(wallet)&&emailAllowed(wallet,job.type);
  if(job.type==='verify-email'){
   const challenge=await tx.get(db.doc(`testAccounts/${job.uid}/meta/emailVerification`));
   const record=challenge.data();let token;try{token=new URL(job.data.verificationUrl).searchParams.get('verifyEmail')}catch{}
   valid=Boolean(record&&!record.used&&record.expiresAtMs>time&&record.email===job.to&&job.to===wallet?.emailForUpdates?.trim().toLowerCase()&&token&&createHash('sha256').update(token).digest('hex')===record.hash);
  }
  if(!valid){tx.update(target,{status:'skipped',data:{},message:null,to:null,reason:'recipient-or-preference',finishedAtMs:time});return null}
  if(time-job.createdAtMs>23*3600000||(job.expiresAtMs&&job.expiresAtMs<=time)){tx.update(target,{status:'expired',data:{},message:null,to:null,finishedAtMs:time});return null}
  if((job.attempts||0)>=5){tx.update(target,{status:'failed',data:{},message:null,to:null,reason:'retry-limit',finishedAtMs:time});return null}
  // Freeze rendered content and sender on the first attempt so retries use the
  // identical provider payload even if profile/configuration changes later.
  let message;try{message=job.message||{...renderEmail(job.type,job.data,{siteUrl:config.siteUrl}),from:`rippr <${config.from}>`,replyTo:config.replyTo||'',to:job.to,id}}catch{tx.update(target,{status:'failed',data:{},message:null,to:null,reason:'invalid-template-data',finishedAtMs:time});return null}
  tx.update(target,{status:'processing',message,leaseUntilMs:time+60000,nextAttemptAtMs:time+60000,attempts:(job.attempts||0)+1});
  return{...job,message,attempts:(job.attempts||0)+1};
 });
 if(!job)return{ignored:true};
 try{
  const providerId=await send(job.message,{apiKey});
  await db.runTransaction(async tx=>{const current=await tx.get(target);if(current.data()?.status!=='sent')tx.update(target,{status:'sent',data:{},message:null,to:null,providerId,sentAtMs:now(),leaseUntilMs:0})});return{sent:true};
 }catch(error){
  await db.runTransaction(async tx=>{const current=await tx.get(target);if(current.data()?.status==='sent')return;tx.update(target,{status:error.permanent||job.attempts>=5?'failed':'retry',...(error.permanent||job.attempts>=5?{data:{},message:null,to:null}:{}),reason:error.permanent?'provider-rejected':'provider-unavailable',leaseUntilMs:0,nextAttemptAtMs:now()+Math.min(3600000,60000*2**(job.attempts-1))})});
  return{retry:!error.permanent&&job.attempts<5};
 }
}
