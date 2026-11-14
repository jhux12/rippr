import {createHash} from 'node:crypto';
import {FieldValue} from 'firebase-admin/firestore';
export const emailId=key=>createHash('sha256').update(key).digest('hex');
export function verifiedRecipient(account){
 const email=account?.emailForUpdates?.trim().toLowerCase();
 return email&&email===account?.verifiedEmailForUpdates&&account.emailVerifiedAtMs>0&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)?email:null;
}
export function emailAllowed(account,type){
 if(!verifiedRecipient(account))return false;
 if(['reward-earned','referral-earned'].includes(type))return account.preferences?.emailUpdates===true;
 if(['shipping-request','order-shipped','order-delivered'].includes(type))return account.preferences?.shippingUpdates!==false;
 return ['welcome','support-received','support-reply'].includes(type);
}
export function emailEvent(collection,id,before,after){
 if(!after)return null;
 if(collection==='activity'&&!before){
  if(after.type==='referral')return{type:'referral-earned',key:'referral:'+id,data:{amountCents:after.amountCents,...(after.rewardKind==='pack'?{rewardKind:'pack',rewardName:'Basic pack'}:{})}};
  if(after.type==='reward'){
   const [rewardSource,...label]=String(after.label||'').split(' · ');
   if(!label.length)return null;
   return{type:'reward-earned',key:'reward:'+id,data:{rewardSource,rewardName:label.join(' · ')}};
  }
 }
 if(collection==='shipments'){
  if(!before)return{type:'shipping-request',key:'shipping:'+id,data:{reference:id,itemCount:after.items?.length||after.itemIds?.length||0,...(Number.isSafeInteger(after.estimateCents)?{shippingCents:after.estimateCents}:{})}};
  if(before.status!==after.status&&['shipped','delivered'].includes(after.status))return{type:after.status==='shipped'?'order-shipped':'order-delivered',key:`shipping:${id}:${after.status}`,data:{reference:id,carrier:after.carrier||'',trackingNumber:after.trackingNumber||''}};
 }
 if(collection==='supportTickets'){
  if(!before)return{type:'support-received',key:'support:'+id,data:{reference:id,topic:after.topic||''}};
  const old=before.messages||[],messages=after.messages||[];
  if(messages.length===old.length+1&&messages.at(-1)?.author==='support')return{type:'support-reply',key:`support:${id}:${after.version}`,data:{reference:id,message:messages.at(-1).body}};
 }
 return null;
}
export async function queueEmail(db,uid,event,now=Date.now()){
 if(!event)return false;
 const target=db.doc('emailOutbox/'+emailId(uid+':'+event.key));
 return db.runTransaction(async tx=>{
  const [saved,owner]=await Promise.all([tx.get(target),tx.get(db.doc('testAccounts/'+uid))]);
  const account=owner.data();
  if(saved.exists||!emailAllowed(account,event.type))return false;
  tx.create(target,{uid,type:event.type,data:{...event.data,displayName:account.displayName||account.handle||'collector'},to:verifiedRecipient(account),status:'pending',attempts:0,createdAtMs:now,nextAttemptAtMs:now,createdAt:FieldValue.serverTimestamp()});return true;
 });
}
