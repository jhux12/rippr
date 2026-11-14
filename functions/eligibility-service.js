import {LIVE_POLICY_VERSION} from './runtime-mode.js';
import {HttpsError} from 'firebase-functions/v2/https';
import {FieldValue} from 'firebase-admin/firestore';
export const POLICY_VERSION='sandbox-2026-11-13-v4';
export const POLICY_SCOPE='sandbox-review-drafts';
const fail=(code,message,details)=>{throw new HttpsError(code,message,details)};
export function adultBirthDate(value,atMs=Date.now()){
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))fail('invalid-argument','Enter your date of birth.');
 const date=new Date(value+'T00:00:00Z'),today=new Date(atMs);
 if(!Number.isFinite(date.getTime())||date.toISOString().slice(0,10)!==value||date.getUTCFullYear()<1900||date>today)fail('invalid-argument','Enter a valid date of birth.');
 let age=today.getUTCFullYear()-date.getUTCFullYear();if(today.getUTCMonth()<date.getUTCMonth()||(today.getUTCMonth()===date.getUTCMonth()&&today.getUTCDate()<date.getUTCDate()))age--;
 if(age<18)fail('failed-precondition','You must be at least 18 to use rippr.');return value;
}
export function hasCurrentEligibility(value,{mode='test'}={}){const version=mode==='live'?LIVE_POLICY_VERSION:POLICY_VERSION,scope=mode==='live'?'live-account':POLICY_SCOPE;return value?.closed!==true&&value?.adultSelfAttested===true&&value.termsVersion===version&&value.privacyVersion===version&&value.scope===scope}
export function eligibilityService(db,{now=Date.now}={}){const POLICY_VERSION=db.mode==='live'?LIVE_POLICY_VERSION:'sandbox-2026-11-13-v4',POLICY_SCOPE=db.mode==='live'?'live-account':'sandbox-review-drafts';return async(uid,input={},claims={})=>{
 if(!uid||typeof uid!=='string'||uid.includes('/')||input.accountUid&&input.accountUid!==uid)fail('unauthenticated','Sign in to continue.');
 const ref=db.doc('accountEligibility/'+uid);
 if(input.action==='eligibilityState'){const found=await db.runTransaction(tx=>tx.get(ref));return{required:!hasCurrentEligibility(found.data(),{mode:db.mode}),policyVersion:POLICY_VERSION,scope:POLICY_SCOPE,livePurchasesEnabled:db.mode==='live'}}
 if(input.action!=='acceptEligibility')fail('invalid-argument','Unknown eligibility action.');
 if(typeof claims.phone_number!=='string'||!/^\+[1-9]\d{6,14}$/.test(claims.phone_number))fail('failed-precondition','Verify your phone before saving eligibility.');
 const dob=adultBirthDate(input.birthDate,now());
 if(input.agreeTerms!==true||input.acknowledgePrivacy!==true)fail('invalid-argument','Agree to the Terms and acknowledge the Privacy Policy separately.');
 if(input.policyVersion!==POLICY_VERSION)fail('failed-precondition','Policies changed. Reload and review the current versions.');
 const id=input.operationId;if(typeof id!=='string'||!/^[a-zA-Z0-9-]{16,80}$/.test(id))fail('invalid-argument','A valid request ID is required.');
 return db.runTransaction(async tx=>{
  const saved=await tx.get(ref),before=saved.data(),event=ref.collection('acceptances').doc(id),prior=await tx.get(event);
  if(before?.birthDate&&before.birthDate!==dob)fail('failed-precondition','Your saved date of birth differs. Contact support to correct it.');
  if(prior.exists&&(prior.data().termsVersion!==POLICY_VERSION||prior.data().privacyVersion!==POLICY_VERSION))fail('already-exists','Use a new request for the current policy version.');
  if(prior.exists||hasCurrentEligibility(before,{mode:db.mode}))return{accepted:true,policyVersion:POLICY_VERSION,livePurchasesEnabled:db.mode==='live'};
  const record={uid,birthDate:dob,adultSelfAttested:true,ageVerified:false,termsVersion:POLICY_VERSION,privacyVersion:POLICY_VERSION,scope:POLICY_SCOPE,acceptedAt:FieldValue.serverTimestamp(),acceptedAtMs:now(),source:'self-reported-date-of-birth',livePurchasesEnabled:db.mode==='live'};
  tx.set(ref,record);tx.create(event,{...record,operationId:id});return{accepted:true,policyVersion:POLICY_VERSION,livePurchasesEnabled:db.mode==='live'};
 });
}}
export async function requireEligibility(db,uid,input={}){
 if(!uid||typeof uid!=='string'||uid.includes('/')||input.accountUid&&input.accountUid!==uid)fail('unauthenticated','Sign in to continue.');
 const saved=await db.runTransaction(tx=>tx.get(db.doc('accountEligibility/'+uid)));
 if(!hasCurrentEligibility(saved.data(),{mode:db.mode}))fail('failed-precondition','Complete your age and policy check before continuing.',{reason:'eligibility-required'});
}
// All deployed account/Checkout entrypoints pass through this guard. Reads,
// refunds/reconciliation and already-paid webhook settlement remain accessible.
export function guardedAccount(db,operate,options={}){const eligibility=eligibilityService(db,options);return async(uid,input={},claims={})=>{
 if(['eligibilityState','acceptEligibility'].includes(input?.action))return eligibility(uid,input,claims);
 if(['purchase','openInventoryPack','topup','redeemSpark'].includes(input?.action))await requireEligibility(db,uid,input);
 return operate(uid,input,claims);
}}
export function guardedStripe(db,operate){return async(uid,input={},claims={})=>{if(input?.action==='checkout')await requireEligibility(db,uid,input);return operate(uid,input,claims)}}
