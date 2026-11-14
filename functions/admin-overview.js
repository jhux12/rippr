import {HttpsError} from 'firebase-functions/v2/https';
import {isAdminToken} from './catalog-model.js';
import {promotionSummary} from './promotion-summary.js';
const aggregate=async query=>{const n=(await query.count().get()).data().count;if(!Number.isSafeInteger(n)||n<0)throw new HttpsError('internal','Invalid queue count.');return n};
const count=async(db,path,statuses)=>{
 const query=Array.isArray(statuses)?db.collection(path).where('status','in',statuses):db.collection(path).where('status','==',statuses);
 return aggregate(query);
};
// Counts use server aggregation over all retained queue records, not the first
// page of each management screen. No recipients, addresses or payment data leave.
export async function adminOverview(db,uid,claims,atMs){
 if(!isAdminToken(claims,uid))throw new HttpsError('permission-denied','Only the verified owner may view operations.');
 const sections={
  payments:async()=>{const [holds,reviews]=await Promise.all([aggregate(db.collection('testAccounts').where('paymentHold','==',true)),count(db,'paymentReviewQueue/root/cases','open')]);return{holds,reviews}},
  email:async()=>{const [failed,retry,queued]=await Promise.all([count(db,'emailOutbox',['failed','expired']),count(db,'emailOutbox','retry'),count(db,'emailOutbox',['pending','processing'])]);return{failed,retry,queued}},
  shipping:async()=>({pending:await count(db,'shippingQueue/root/requests',['test-request','review','packing'])}),
  promotions:async()=>{const r=await promotionSummary(db,uid,{days:7},claims,atMs);return{estimatedCents:r.estimatedCents,startDay:r.startDay,endDay:r.endDay,recordedDays:r.recordedDays}}
 };
 const keys=Object.keys(sections),found=await Promise.allSettled(keys.map(key=>sections[key]()));
 return{sandbox:db.mode!=='live',asOfMs:atMs,sections:Object.fromEntries(found.map((r,i)=>[keys[i],r.status==='fulfilled'?{available:true,...r.value}:{available:false,message:'Could not load this section. Refresh to retry.'}]))};
}
