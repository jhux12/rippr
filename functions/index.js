import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { onCall } from 'firebase-functions/v2/https';
import { defineBoolean, defineString, defineSecret } from 'firebase-functions/params';
import { accountService } from './service.js';
import { museumService } from './museum-service.js';
initializeApp();
const freeTestTopups = defineBoolean('FREE_TEST_TOPUPS', { default:true, description:'Allow free, nonredeemable test credit. Disable to pause top-ups.' });
const emailEnabled=defineBoolean('EMAIL_ENABLED',{default:false,description:'Enable confirmed-address transactional email.'});
const emailSite=defineString('EMAIL_SITE_URL',{default:'',description:'Public HTTPS site origin, without a path.'});
const emailFrom=defineString('EMAIL_FROM',{default:'',description:'Verified sending email address.'});
const emailReplyTo=defineString('EMAIL_REPLY_TO',{default:'',description:'Monitored support reply-to address.'});
const emailKey=defineSecret('RESEND_API_KEY');
const emailConfig=()=>({enabled:emailEnabled.value(),siteUrl:emailSite.value(),from:emailFrom.value(),replyTo:emailReplyTo.value()});
const operate = accountService(getFirestore(), { freeTopups:()=>freeTestTopups.value(),emailOptions:emailConfig });
export const ripprAccount = onCall({ region:'us-central1', maxInstances:10, timeoutSeconds:30 }, request => operate(request.auth?.uid, request.data, request.auth?.token));

const museumOperate = museumService(getFirestore());
export const ripprMuseum = onCall({ region:'us-central1', maxInstances:10, timeoutSeconds:30 }, request => museumOperate(request.auth?.uid, request.data));


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
