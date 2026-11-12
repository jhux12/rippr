import {createHash,randomBytes} from 'node:crypto';
import {HttpsError} from 'firebase-functions/v2/https';
import {FieldValue} from 'firebase-admin/firestore';
import {validateEmailConfig} from './email-delivery.js';
import {emailId,verifiedRecipient} from './email-events.js';
const hash=value=>createHash('sha256').update(value).digest('hex');
export const EMAIL_ACTIONS=['requestEmailVerification','confirmEmailVerification'];
export async function emailVerification(db,uid,input,options={}){
 const {enabled=false,siteUrl='',now=Date.now}=options;
 const {action,operationId,token}=input;
 if(!/^[a-zA-Z0-9-]{16,80}$/.test(operationId||''))throw new HttpsError('invalid-argument','A valid operation ID is required.');
 let configured=false;try{configured=validateEmailConfig(options)}catch{}
 if(!enabled||!siteUrl||!configured)throw new HttpsError('failed-precondition','Email delivery is not configured yet. Your address has been saved.');
 const account=db.doc('testAccounts/'+uid),challenge=account.collection('meta').doc('emailVerification'),operation=account.collection('operations').doc(operationId);
 const time=now(),secret=randomBytes(32).toString('hex'),fingerprint=JSON.stringify({action,token:typeof token==='string'?hash(token):null});
 return db.runTransaction(async tx=>{
  const [owner,saved,prior]=await Promise.all([tx.get(account),tx.get(challenge),tx.get(operation)]);
  if(prior.exists){if(prior.data().fingerprint!==fingerprint)throw new HttpsError('already-exists','This operation ID was already used.');return prior.data().result}
  const wallet=owner.data(),email=wallet?.emailForUpdates?.trim().toLowerCase();
  if(!email||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw new HttpsError('failed-precondition','Save an email address first.');
  let result;
  if(action==='requestEmailVerification'){
   if(verifiedRecipient(wallet))return{verified:true};
   if(time-(saved.data()?.requestedAtMs||0)<60000)throw new HttpsError('resource-exhausted','Wait a minute before requesting another email.');
   const day=Math.floor(time/86400000),daily=saved.data()?.day===day?saved.data().dailyCount||0:0;
   if(daily>=5)throw new HttpsError('resource-exhausted','Daily confirmation limit reached. Try again tomorrow.');
   const url=new URL('account-settings.html',siteUrl);url.searchParams.set('verifyEmail',secret);
   tx.set(challenge,{hash:hash(secret),email,requestedAtMs:time,expiresAtMs:time+1800000,used:false,day,dailyCount:daily+1});
   tx.create(db.doc('emailOutbox/'+emailId(uid+':verify:'+operationId)),{uid,type:'verify-email',to:email,data:{displayName:wallet.displayName||wallet.handle||'collector',verificationUrl:url.href},status:'pending',attempts:0,createdAtMs:time,nextAttemptAtMs:time,expiresAtMs:time+1800000,createdAt:FieldValue.serverTimestamp()});
   result={queued:true};
  }else{
   const record=saved.data();
   if(typeof token!=='string'||!/^[a-f0-9]{64}$/.test(token)||!record||record.used||record.email!==email||record.expiresAtMs<=time||hash(token)!==record.hash)throw new HttpsError('failed-precondition','This email link expired or was replaced. Request a new one.');
   tx.update(account,{verifiedEmailForUpdates:email,emailVerifiedAtMs:time,updatedAt:FieldValue.serverTimestamp()});tx.update(challenge,{used:true});result={verified:true};
  }
  tx.create(operation,{fingerprint,result,createdAt:FieldValue.serverTimestamp()});return result;
 });
}
