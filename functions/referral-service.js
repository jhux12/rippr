import {createHash} from 'node:crypto';
import {FieldValue} from 'firebase-admin/firestore';
import {HttpsError} from 'firebase-functions/v2/https';
import {defaultReferrals,cleanReferrals} from './referral-model.js';
import {isAdminToken} from './catalog-model.js';
const fail=(code,message)=>{throw new HttpsError(code,message)},stamp=()=>FieldValue.serverTimestamp();
const codeFor=uid=>'RIPPR-'+createHash('sha256').update('referral:'+uid).digest('hex').slice(0,16).toUpperCase();
export const REFERRAL_ACTIONS=['referralState','bindReferral','saveReferrals'];
export async function readReferralConfig(tx,db){
 const saved=await tx.get(db.doc('rewardSettings/referrals'));if(saved.exists){try{return cleanReferrals(saved.data())}catch{fail('failed-precondition','Referral settings need correction.')}}
 // Preserve referral configuration saved before the wider rewards rollback.
 const legacy=await tx.get(db.doc('rewardSettings/journey'));if(!legacy.exists)return defaultReferrals();const old=legacy.data();
 try{return cleanReferrals({version:0,enabled:old.referralEnabled,creditCents:old.referralCreditCents,minimumCents:old.referralMinimumCents,limit:old.referralLimit})}catch{return defaultReferrals()}
}
export async function referralService(db,uid,input,claims,initial){
 const {action,operationId,accountUid,...data}=input;
 if(action==='saveReferrals'&&!isAdminToken(claims,uid))fail('permission-denied','Only the verified owner may change referrals.');
 if(action!=='referralState'&&!/^[a-zA-Z0-9-]{16,80}$/.test(operationId||''))fail('invalid-argument','A valid operation ID is required.');
 const account=db.doc(`testAccounts/${uid}`),code=codeFor(uid),codeRef=db.doc(`referralCodes/${code}`),op=account.collection('operations').doc(action==='referralState'?'referral-state':operationId);
 return db.runTransaction(async tx=>{
  const [current,registered,prior]=await Promise.all([tx.get(account),tx.get(codeRef),tx.get(op)]);const config=await readReferralConfig(tx,db),wallet=current.exists?current.data():initial(uid),fingerprint=JSON.stringify({action,data});
  if(action!=='referralState'&&prior.exists){if(prior.data().fingerprint!==fingerprint)fail('already-exists','Operation ID already used.');return prior.data().result}
  if(registered.exists&&registered.data().uid!==uid)fail('internal','Referral code unavailable.');
  let patch={},result;
  if(action==='referralState'){
   let referralStatus=wallet.referralAwarded?'awarded':wallet.referrerUid?'pending':'none';
   if(wallet.referrerUid&&!wallet.referralAwarded){const sponsor=await tx.get(db.doc(`testAccounts/${wallet.referrerUid}`));if(!config.enabled)referralStatus='paused';else if(!sponsor.exists||sponsor.data().closureStatus||(sponsor.data().referralCount||0)>=config.limit)referralStatus='limit'}
   result={config,code,count:wallet.referralCount||0,applied:Boolean(wallet.referrerUid),status:referralStatus,canApply:!wallet.referrerUid&&!(wallet.packsOpened>0)};
  }else if(action==='saveReferrals'){
   let value;try{value=cleanReferrals(data.config)}catch(e){fail('invalid-argument',e.message)}
   if(data.expectedVersion!==config.version)fail('failed-precondition','Referral settings changed. Reload before saving.');
   tx.set(db.doc('rewardSettings/referrals'),{...value,version:config.version+1,updatedAt:stamp(),updatedBy:uid});result={version:config.version+1};
  }else{
   if(data.expectedVersion!==config.version)fail('failed-precondition','Referral settings changed. Refresh before applying.');
   if(!config.enabled||wallet.referrerUid||wallet.packsOpened>0)fail('failed-precondition','Apply one referral code before your first opening.');
   const requested=typeof data.code==='string'?data.code.trim().toUpperCase():'';if(!/^RIPPR-[A-F0-9]{16}$/.test(requested))fail('invalid-argument','Enter a valid referral code.');
   const found=await tx.get(db.doc(`referralCodes/${requested}`));if(!found.exists||found.data().uid===uid)fail('failed-precondition','This code cannot be applied to your account.');
   const sponsor=await tx.get(db.doc(`testAccounts/${found.data().uid}`));if(!sponsor.exists||sponsor.data().closureStatus||(sponsor.data().referralCount||0)>=config.limit)fail('failed-precondition','This referral code has reached its limit.');
   patch.referrerUid=found.data().uid;result={applied:true};
  }
  tx.set(account,{...(!current.exists?wallet:{}),...patch,updatedAt:stamp()},{merge:true});if(!registered.exists)tx.create(codeRef,{uid,createdAt:stamp()});
  if(action!=='referralState')tx.create(op,{fingerprint,result,createdAt:stamp()});return result;
 });
}

// Public pre-signup check: no wallet creation, binding or referrer identity disclosure.
export async function validateSignupReferral(db,input){
 const code=typeof input?.code==='string'?input.code.trim().toUpperCase():'';
 if(!/^RIPPR-[A-F0-9]{16}$/.test(code))fail('invalid-argument','Enter a valid referral code.');
 return db.runTransaction(async tx=>{
  const config=await readReferralConfig(tx,db),found=await tx.get(db.doc('referralCodes/'+code));
  if(!config.enabled||!found.exists)fail('failed-precondition','This referral code is unavailable. Check it or leave it blank.');
  const uid=found.data().uid;
  if(typeof uid!=='string'||!uid||uid.includes('/'))fail('failed-precondition','This referral code is unavailable.');
  const sponsor=await tx.get(db.doc('testAccounts/'+uid));
  if(!sponsor.exists||sponsor.data().closureStatus||(sponsor.data().referralCount||0)>=config.limit)fail('failed-precondition','This referral code is unavailable.');
  return {valid:true};
 });
}
