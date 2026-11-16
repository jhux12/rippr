import {recordEngagement,recordCustomerMilestones} from './conversion-service.js';
import {createHash} from 'node:crypto';
import {promotionDay} from './promotion-summary.js';
import {testShippo} from './shippo-test.js';
import {shippingService} from './shipping-service.js';
import {shippoProvider} from './shippo-provider.js';
import {monitorFailure,withOpeningMonitoring} from './operations-monitor.js';
import {saveHomepageGrails} from './homepage-grails-service.js';
import {scopedDatabase,validateMode,assertRuntime,ensureLiveAccount,LIVE_POLICY_VERSION,runtimeInput,authorizeLiveAction,protectSharedIdentity} from './runtime-mode.js';
import {closureService,CLOSURE_ACTIONS,guardedLifecycle,assertAccountOpen} from './closure-service.js';
import {getAuth} from 'firebase-admin/auth';
import {getStorage} from 'firebase-admin/storage';
import {requireEligibility,guardedAccount,guardedStripe} from './eligibility-service.js';
import {isAdminToken} from './catalog-model.js';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { onCall, onRequest, HttpsError } from 'firebase-functions/v2/https';
import { defineBoolean, defineString, defineSecret } from 'firebase-functions/params';
import { accountService } from './service.js';
import { museumService } from './museum-service.js';
initializeApp();
const siteMode=defineString('SITE_MODE',{default:'test',description:'Active storefront ledger: test or live. Live starts with clean financial records.'});
const livePublic=defineBoolean('LIVE_PUBLIC_ACCESS',{default:false,description:'Allow nonowner live transactions after the controlled live payment/refund check.'});
const livePurchases=defineBoolean('LIVE_PURCHASES_ENABLED',{default:false,description:'Allow live pack openings and reward claims.'});
const liveTopups=defineBoolean('STRIPE_LIVE_TOPUPS_ENABLED',{default:false,description:'Allow real Stripe balance funding in live mode.'});
const activeMode=()=>validateMode(siteMode.value()),activeDb=()=>scopedDatabase(getFirestore(),activeMode());
export const ripprRuntime=onCall({region:'us-central1',maxInstances:5},()=>({mode:activeMode(),policyVersion:activeMode()==='live'?LIVE_POLICY_VERSION:'sandbox-2026-11-13-v4',liveTopupsEnabled:activeMode()==='live'&&liveTopups.value(),privatePreview:activeMode()==='live'&&!livePublic.value()}));
const freeTestTopups = defineBoolean('FREE_TEST_TOPUPS', { default:true, description:'Allow free, nonredeemable test credit. Disable to pause top-ups.' });
const emailEnabled=defineBoolean('EMAIL_ENABLED',{default:false,description:'Enable confirmed-address transactional email.'});
const emailSite=defineString('EMAIL_SITE_URL',{default:'',description:'Public HTTPS site origin, without a path.'});
const emailFrom=defineString('EMAIL_FROM',{default:'',description:'Verified sending email address.'});
const emailReplyTo=defineString('EMAIL_REPLY_TO',{default:'',description:'Monitored support reply-to address.'});
const emailKey=defineSecret('RESEND_API_KEY');
const emailConfig=()=>({enabled:emailEnabled.value(),siteUrl:emailSite.value(),from:emailFrom.value(),replyTo:emailReplyTo.value()});
const stripeTestEnabled=defineBoolean('STRIPE_TEST_TOPUPS_ENABLED',{default:false,description:'Enable sandbox-only Stripe balance funding.'});
const stripeSite=defineString('STRIPE_SITE_URL',{default:'https://www.rippr.gg'});
const stripeTax=defineBoolean('STRIPE_TOPUP_AUTOMATIC_TAX',{default:false,description:'Only enable after choosing the correct tax treatment for stored credit.'});
const stripeTaxCode=defineString('STRIPE_TOPUP_TAX_CODE',{default:''});
const stripeSecret=defineSecret('STRIPE_TEST_SECRET_KEY'),stripeWebhookSecret=defineSecret('STRIPE_TEST_WEBHOOK_SECRET');
const stripeOptions=()=>({enabled:stripeTestEnabled.value(),siteUrl:stripeSite.value(),automaticTax:stripeTax.value(),taxCode:stripeTaxCode.value()});
const closureOperate=closureService(getFirestore(),{emailEnabled:()=>emailEnabled.value(),deleteAuth:async uid=>{await protectSharedIdentity(getFirestore(),uid);try{await getAuth().deleteUser(uid)}catch(e){if(e.code!=='auth/user-not-found')throw e}},removePhotos:async uid=>{await protectSharedIdentity(getFirestore(),uid);const bucket=getStorage().bucket('rippr-2b01c.firebasestorage.app');const [files]=await bucket.getFiles({prefix:'profile-images/'+uid+'/',maxResults:100,autoPaginate:false});await Promise.all(files.map(file=>file.delete({ignoreNotFound:true})));return files.length===100}});
const accountDomain=accountService(getFirestore(), { freeTopups:()=>freeTestTopups.value(),emailOptions:emailConfig,stripeTopups:()=>stripeTestEnabled.value() });
const operate = guardedLifecycle(getFirestore(),guardedAccount(getFirestore(),(uid,input,claims)=>CLOSURE_ACTIONS.includes(input?.action)?closureOperate(uid,input,claims):accountDomain(uid,input,claims)));
async function accountRequest(request) {
 const mode=activeMode();assertRuntime(mode,request.data);
 // Homepage catalog settings are shared by both modes and owner-only. Validate
 // them on the server rather than charging six slab validations to Rules.
 if(request.data?.action==='saveHomepageGrails'){
  const result=await saveHomepageGrails(getFirestore(),request.auth?.uid,runtimeInput(request.data),request.auth?.token);
  return mode==='live'?{...result,mode}:result;
 }
 if(mode==='test'){if(request.data?.action==='requestClosure'&&request.auth?.uid)await protectSharedIdentity(getFirestore(),request.auth.uid);if(request.data?.action==='adminClosureProcess'&&isAdminToken(request.auth?.token,request.auth?.uid)&&typeof request.data?.customerUid==='string')await protectSharedIdentity(getFirestore(),request.data.customerUid);return operate(request.auth?.uid,runtimeInput(request.data),request.auth?.token);}
 const db=activeDb(),uid=request.auth?.uid;
 if(request.data?.action==='closureState')return{request:null,manualClosure:true,mode:'live'};
 if(CLOSURE_ACTIONS.includes(request.data?.action))throw new HttpsError('failed-precondition','Live account closure requires support review. Contact support; no funds or items have been relinquished.');
 await ensureLiveAccount(getFirestore(),uid);
 const allowed=authorizeLiveAction(uid,request.auth?.token,request.data?.action,{publicAccess:livePublic.value(),purchasesEnabled:livePurchases.value()});
 const domain=accountService(db,{mode:'live',freeTopups:()=>false,liveStripeTopups:()=>liveTopups.value()&&allowed,livePurchasesEnabled:()=>livePurchases.value()&&allowed,emailOptions:emailConfig});
 const result=await guardedLifecycle(db,guardedAccount(db,domain))(uid,runtimeInput(request.data),request.auth?.token);return{...result,mode:'live'};
}
export const ripprAccount = onCall({region:'us-central1',maxInstances:10,timeoutSeconds:30},request=>withOpeningMonitoring(activeDb(),request.auth?.uid,request.data,()=>accountRequest(request)));

const museumOperate = museumService(getFirestore());
export const ripprMuseum = onCall({ region:'us-central1', maxInstances:10, timeoutSeconds:30 }, async request => {const mode=activeMode();assertRuntime(mode,request.data);const result=await (mode==='live'?museumService(activeDb())(request.auth?.uid,runtimeInput(request.data)):museumOperate(request.auth?.uid,runtimeInput(request.data)));return mode==='live'?{...result,mode:'live'}:result});


// Activity is emitted only after account transactions commit. No purchase receipt.
import {onDocumentCreated,onDocumentWritten} from 'firebase-functions/v2/firestore';
import {onSchedule} from 'firebase-functions/v2/scheduler';
import {emailEvent,queueEmail,verifiedRecipient} from './email-events.js';
import {deliverEmail} from './email-delivery.js';
export const ripprEmailEvents=onDocumentWritten({document:'testAccounts/{uid}/{collection}/{recordId}',region:'us-central1',retry:true,maxInstances:5},async event=>{
 if(!emailEnabled.value()||!['activity','shipments','supportTickets'].includes(event.params.collection))return;
 const before=event.data?.before.exists?event.data.before.data():null,after=event.data?.after.exists?event.data.after.data():null;
 await queueEmail(getFirestore(),event.params.uid,emailEvent(event.params.collection,event.params.recordId,before,after));
});
export const ripprEmailWelcome=onDocumentWritten({document:'testAccounts/{uid}',region:'us-central1',retry:true,maxInstances:5},async event=>{
 if(!emailEnabled.value()||!event.data?.after.exists)return;
 const after=event.data.after.data(),before=event.data.before.exists?event.data.before.data():null;
 if(verifiedRecipient(after)&&!verifiedRecipient(before))await queueEmail(getFirestore(),event.params.uid,{type:'welcome',key:'welcome',data:{}});
});
export const ripprEmailDelivery=onDocumentCreated({document:'emailOutbox/{emailId}',region:'us-central1',secrets:[emailKey],retry:true,maxInstances:3,timeoutSeconds:60},event=>deliverEmail(getFirestore(),event.params.emailId,emailConfig(),{apiKey:emailKey.value()}));
export const ripprEmailRetry=onSchedule({schedule:'every 10 minutes',region:'us-central1',secrets:[emailKey],maxInstances:1,timeoutSeconds:300},async()=>{
 if(!emailEnabled.value())return;
 const db=getFirestore(),pending=await db.collection('emailOutbox').where('status','in',['pending','retry','processing']).limit(10).get();
 for(const doc of pending.docs)await deliverEmail(db,doc.id,emailConfig(),{apiKey:emailKey.value()});
});


import Stripe from 'stripe';
import {error as logStripeError} from 'firebase-functions/logger';
import {stripeFailure} from './stripe-errors.js';
import {stripeService,applyStripeEvent,requireTestKey} from './stripe-service.js';
const stripeClient=()=>new Stripe(requireTestKey(stripeSecret.value()),{maxNetworkRetries:2,timeout:15000});
export const ripprStripe=onCall({region:'us-central1',secrets:[stripeSecret],maxInstances:5,timeoutSeconds:60},async request=>{
 try{if(activeMode()==='live'&&request.data?.action==='checkout')throw new HttpsError('failed-precondition','Sandbox Checkout is unavailable in live mode. Reload the page.');if(request.data?.action==='checkout')await assertAccountOpen(getFirestore(),request.auth?.uid);return await guardedStripe(getFirestore(),stripeService(getFirestore(),{getStripe:stripeClient,options:stripeOptions}))(request.auth?.uid,runtimeInput(request.data),request.auth?.token)}catch(error){if(error instanceof HttpsError)throw error;const detail=stripeFailure(error);if(request.data?.action==='checkout')await monitorFailure(getFirestore(),{category:'checkout',uid:request.auth?.uid,operationId:request.data?.operationId,reason:detail.reason});logStripeError('Stripe sandbox Checkout failed',detail);throw new HttpsError('unavailable',detail.message,{provider:'stripe',reason:detail.reason,...(detail.reference?{reference:detail.reference}:{})});}
});
export const ripprStripeWebhook=onRequest({region:'us-central1',secrets:[stripeSecret,stripeWebhookSecret],maxInstances:5,timeoutSeconds:120},async(req,res)=>{
 if(req.method!=='POST'){res.set('Allow','POST').status(405).send('POST required');return}
 let stripe,event;
 try{stripe=stripeClient();event=stripe.webhooks.constructEvent(req.rawBody,req.get('stripe-signature'),stripeWebhookSecret.value())}catch{res.status(400).send('Invalid webhook signature');return}
 try{await applyStripeEvent(getFirestore(),stripe,event);res.status(200).json({received:true})}catch{res.status(500).send('Payment processing will retry')}
});

// Live endpoints have separate secrets and never use sandbox payment records.
const liveSecret=defineSecret('STRIPE_LIVE_SECRET_KEY'),liveWebhookSecret=defineSecret('STRIPE_LIVE_WEBHOOK_SECRET');
import {requireStripeKey} from './stripe-service.js';
const liveClient=()=>new Stripe(requireStripeKey(liveSecret.value(),'live'),{maxNetworkRetries:2,timeout:15000});
export const ripprLiveStripe=onCall({region:'us-central1',secrets:[liveSecret],maxInstances:5,timeoutSeconds:60},async request=>{
 if(activeMode()!=='live')throw new HttpsError('failed-precondition','Live Checkout is not active.');assertRuntime('live',request.data);
 const db=scopedDatabase(getFirestore(),'live');
 authorizeLiveAction(request.auth?.uid,request.auth?.token,request.data?.action,{publicAccess:livePublic.value()});
 try{await ensureLiveAccount(getFirestore(),request.auth?.uid);if(request.data?.action==='checkout')await assertAccountOpen(db,request.auth?.uid);return await guardedStripe(db,stripeService(db,{getStripe:liveClient,mode:'live',options:()=>({...stripeOptions(),enabled:liveTopups.value()})}))(request.auth?.uid,runtimeInput(request.data),request.auth?.token)}catch(error){if(error instanceof HttpsError)throw error;const detail=stripeFailure(error);if(request.data?.action==='checkout')await monitorFailure(db,{category:'checkout',uid:request.auth?.uid,operationId:request.data?.operationId,reason:detail.reason});logStripeError('Stripe live Checkout failed',{...detail,message:undefined});throw new HttpsError('unavailable',detail.reason==='key'?'The live payment key needs configuration.':'Payment service unavailable. Retry the same request.',{provider:'stripe',reason:detail.reason,...(detail.reference?{reference:detail.reference}:{})})}
});
export const ripprLiveStripeWebhook=onRequest({region:'us-central1',secrets:[liveSecret,liveWebhookSecret],maxInstances:5,timeoutSeconds:120},async(req,res)=>{
 if(req.method!=='POST'){res.set('Allow','POST').status(405).send('POST required');return}let stripe,event;try{stripe=liveClient();event=stripe.webhooks.constructEvent(req.rawBody,req.get('stripe-signature'),liveWebhookSecret.value())}catch{res.status(400).send('Invalid webhook signature');return}try{await applyStripeEvent(scopedDatabase(getFirestore(),'live'),stripe,event,{mode:'live'});res.status(200).json({received:true})}catch{res.status(500).send('Payment processing will retry')}
});
export const ripprLiveEmailEvents=onDocumentWritten({document:'liveAccounts/{uid}/{collection}/{recordId}',region:'us-central1',retry:true,maxInstances:5},async event=>{if(!emailEnabled.value()||!['activity','shipments','supportTickets'].includes(event.params.collection))return;const before=event.data?.before.exists?event.data.before.data():null,after=event.data?.after.exists?event.data.after.data():null;await queueEmail(scopedDatabase(getFirestore(),'live'),event.params.uid,emailEvent(event.params.collection,event.params.recordId,before,after))});
export const ripprLiveEmailWelcome=onDocumentWritten({document:'liveAccounts/{uid}',region:'us-central1',retry:true,maxInstances:5},async event=>{if(!emailEnabled.value()||!event.data?.after.exists)return;const after=event.data.after.data(),before=event.data.before.exists?event.data.before.data():null;if(verifiedRecipient(after)&&!verifiedRecipient(before))await queueEmail(scopedDatabase(getFirestore(),'live'),event.params.uid,{type:'welcome',key:'welcome',data:{}})});
export const ripprLiveEmailDelivery=onDocumentCreated({document:'liveEmailOutbox/{emailId}',region:'us-central1',secrets:[emailKey],retry:true,maxInstances:3,timeoutSeconds:60},event=>deliverEmail(scopedDatabase(getFirestore(),'live'),event.params.emailId,emailConfig(),{apiKey:emailKey.value()}));
export const ripprLiveEmailRetry=onSchedule({schedule:'every 10 minutes',region:'us-central1',secrets:[emailKey],maxInstances:1,timeoutSeconds:300},async()=>{if(!emailEnabled.value())return;const db=scopedDatabase(getFirestore(),'live'),pending=await db.collection('emailOutbox').where('status','in',['pending','retry','processing']).limit(10).get();for(const doc of pending.docs)await deliverEmail(db,doc.id,emailConfig(),{apiKey:emailKey.value()})});


// Named secret bindings preserve Secret Manager injection and endpoint validation,
// without globally resolving optional shipping params during account-only deploys.
const shippoTestKey='SHIPPO_TEST_API_KEY',shippoLiveKey='SHIPPO_LIVE_API_KEY';
async function shippingRequest(request,mode,key){
 assertRuntime(mode,request.data);if(activeMode()!==mode)throw new HttpsError('failed-precondition','Shipping mode changed. Reload before continuing.');
 const db=scopedDatabase(getFirestore(),mode),uid=request.auth?.uid;
 if(!request.data?.action?.startsWith('admin'))await assertAccountOpen(db,uid);
 if(['payShipment','checkoutShipment'].includes(request.data?.action))await requireEligibility(db,uid,request.data);
 const result=await shippingService(db,{provider:shippoProvider({mode,key})})(uid,runtimeInput(request.data),request.auth?.token);
 return{...result,mode};
}
export const ripprShipping=onCall({region:'us-central1',maxInstances:5,timeoutSeconds:60,secrets:[shippoTestKey]},r=>shippingRequest(r,'test',()=>process.env[shippoTestKey]));
export const ripprLiveShipping=onCall({region:'us-central1',maxInstances:5,timeoutSeconds:60,secrets:[shippoLiveKey]},r=>shippingRequest(r,'live',()=>process.env[shippoLiveKey]));


export const ripprShippoTest=onCall({region:'us-central1',maxInstances:1,timeoutSeconds:60,secrets:[shippoTestKey]},async request=>{
 assertRuntime(activeMode(),request.data);
 return testShippo(activeDb(),request.auth?.uid,runtimeInput(request.data),request.auth?.token,shippoProvider({mode:'test',key:()=>process.env[shippoTestKey]}));
});

// Public first-party engagement is explicitly separate from trusted conversions.
export const ripprConversion=onCall({region:'us-central1',maxInstances:2,timeoutSeconds:15,cors:['https://www.rippr.gg','https://rippr.gg','https://rippr-dun.vercel.app']},async request=>{
 if(activeMode()!=='live'||!livePublic.value()||isAdminToken(request.auth?.token,request.auth?.uid))return{recorded:false};
 const atMs=Date.now(),ip=request.rawRequest?.ip;
 if(typeof ip!=='string'||!ip)return{recorded:false};
 const networkKey=createHash('sha256').update(promotionDay(atMs)+':'+ip).digest('hex');
 return recordEngagement(scopedDatabase(getFirestore(),'live'),request.data,{networkKey,atMs});
});
const conversionTime=event=>{const n=Date.parse(event.time);if(!Number.isSafeInteger(n))throw Error('Missing conversion event time.');return n};
export const ripprLiveConversionAccount=onDocumentWritten({document:'liveAccounts/{uid}',region:'us-central1',retry:true,maxInstances:2},async event=>{
 if(!event.data?.after.exists)return;
 const before=event.data.before.exists?event.data.before.data():null,after=event.data.after.data();
 if(after.closureStatus)return;
 const registered=!before,funded=after.firstVerifiedDepositMode==='stripe-live'&&Number.isSafeInteger(after.firstVerifiedDepositAtMs)&&after.firstVerifiedDepositAtMs>0&&!(before?.firstVerifiedDepositAtMs>0);
 if(registered||funded)await recordCustomerMilestones(scopedDatabase(getFirestore(),'live'),event.params.uid,{registered,funded},conversionTime(event));
});
export const ripprLiveConversionOpening=onDocumentCreated({document:'liveAccounts/{uid}/activity/{activityId}',region:'us-central1',retry:true,maxInstances:2},async event=>{
 const data=event.data?.data();
 if(data?.type!=='purchase'||data.testOnly!==false||!Number.isSafeInteger(data.amountCents)||data.amountCents>=0)return;
 await recordCustomerMilestones(scopedDatabase(getFirestore(),'live'),event.params.uid,{opened:true,openingEventId:event.params.activityId},conversionTime(event));
});
// Bounded cleanup of measurement records, independent of financial retention.
export const ripprConversionCleanup=onSchedule({schedule:'every 60 minutes',region:'us-central1',maxInstances:1,timeoutSeconds:120},async()=>{
 const db=scopedDatabase(getFirestore(),'live'),atMs=Date.now();
 for(const root of ['conversionSessions','conversionAccounts','conversionLimits','conversionDays']){
  const field=root==='conversionSessions'?'deleteAtMs':'expiresAtMs';
  for(let batch=0;batch<10;batch++){
   const rows=await db.collection(root).where(field,'<=',atMs).limit(200).get();if(!rows.docs.length)break;
   await db.runTransaction(async tx=>{const refs=rows.docs.map(doc=>db.doc(root+'/'+doc.id)),found=await Promise.all(refs.map(ref=>tx.get(ref)));found.forEach((doc,i)=>{if(doc.exists&&doc.data()[field]<=atMs)tx.delete(refs[i])})});
   if(rows.docs.length<200)break;
  }
 }
});
