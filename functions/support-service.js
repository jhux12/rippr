import {FieldValue} from 'firebase-admin/firestore';
import {HttpsError} from 'firebase-functions/v2/https';
import {isAdminToken} from './catalog-model.js';
const fail=(code,message)=>{throw new HttpsError(code,message)};
const text=(value,max)=>typeof value==='string'&&value.trim().length<=max?value.trim():null;
const idOK=value=>typeof value==='string'&&/^[a-zA-Z0-9-]{16,80}$/.test(value);
const stamp=()=>FieldValue.serverTimestamp();
const json=data=>Object.fromEntries(Object.entries(data).map(([k,v])=>[k,v?.toMillis?v.toMillis():v]));
export const SUPPORT_ACTIONS=['supportCreate','supportList','supportReply','adminSupportList','adminSupportUpdate'];
export async function supportService(db,uid,input,claims,now){
 const {action,operationId,accountUid,...data}=input,admin=isAdminToken(claims,uid);
 if(action.startsWith('admin')&&!admin)fail('permission-denied','Only the verified owner may manage support.');
 const queue=db.doc('supportQueue/root').collection('requests');
 if(action==='supportList'||action==='adminSupportList'){
  const result=await (action==='supportList'?db.doc(`testAccounts/${uid}`).collection('supportTickets'):queue).orderBy('createdAt','desc').limit(action==='supportList'?50:100).get();
  return {tickets:result.docs.map(s=>({...json(s.data()),id:s.id}))};
 }
 if(!idOK(operationId))fail('invalid-argument','A valid operation ID is required.');
 const op=db.doc(`testAccounts/${uid}/operations/${operationId}`),fingerprint=JSON.stringify({action,data});
 const customerUid=action==='adminSupportUpdate'?data.customerUid:uid;
 if(typeof customerUid!=='string'||!customerUid||customerUid.length>128||customerUid.includes('/'))fail('invalid-argument','Invalid customer.');
 const ticketId=action==='supportCreate'?data.ticketId:data.id;
 if(!idOK(ticketId))fail('invalid-argument','Invalid support request ID.');
 const target=db.doc(`testAccounts/${customerUid}/supportTickets/${ticketId}`),index=queue.doc(ticketId),wallet=db.doc(`testAccounts/${uid}/meta/supportRate`);
 return db.runTransaction(async tx=>{
  const [prior,found,account,queued]=await Promise.all([tx.get(op),tx.get(target),tx.get(wallet),tx.get(index)]);
  if(prior.exists){if(prior.data().fingerprint!==fingerprint)fail('already-exists','Operation ID already used.');return prior.data().result}
  let ticket;
  if(action==='supportCreate'){
   if(found.exists||queued.exists)fail('already-exists','Request already submitted. Refresh your requests.');
   const name=text(data.name,80),email=text(data.email,254),body=text(data.message,4000),topic=text(data.topic,30),requestNumber=text(data.requestNumber??'',80);
   if(!name||!email||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||!body||!['account','packs','collection','shipping','other'].includes(topic)||requestNumber===null)fail('invalid-argument','Add your name, valid email, topic and message.');
   const attachment=data.attachment??null;
   if(attachment!==null&&![`support-attachments/${uid}/${ticketId}/screenshot.png`,`support-attachments/${uid}/${ticketId}/screenshot.jpg`].includes(attachment))fail('invalid-argument','Invalid screenshot.');
   if(account.data()?.lastSupportAtMs>now()-60000)fail('resource-exhausted','Please wait a minute before sending another support request.');
   ticket={customerUid:uid,name,email,topic,requestNumber,attachment,status:'open',version:1,createdAt:stamp(),updatedAt:stamp(),messages:[{author:'customer',body,createdAtMs:now()}]};
   tx.set(wallet,{lastSupportAtMs:now()},{merge:true});
  }else{
   if(!found.exists)fail('not-found','Support request not found.');ticket=found.data();
   if(ticket.customerUid!==customerUid)fail('permission-denied','This request is unavailable.');
   if(ticket.version!==data.expectedVersion)fail('failed-precondition','This conversation changed. Refresh before replying.');
   const body=text(data.message??'',4000);
   if(body===null||(!body&&action==='supportReply'))fail('invalid-argument','Write a message of up to 4,000 characters.');
   if(body&&ticket.messages.length>=40)fail('failed-precondition','This conversation is full. Start a new support request.');
   if(body&&ticket.lastMessageAtMs>now()-5000)fail('resource-exhausted','Please wait a few seconds before replying again.');
   const status=action==='adminSupportUpdate'?data.status:'open';
   if(!['open','pending','resolved'].includes(status))fail('invalid-argument','Choose a valid request status.');
   ticket={...ticket,status,version:ticket.version+1,updatedAt:stamp(),...(body?{lastMessageAtMs:now(),messages:[...ticket.messages,{author:action==='adminSupportUpdate'?'support':'customer',body,createdAtMs:now()}]}:{})};
  }
  tx.set(target,ticket);tx.set(index,ticket);
  const result={id:ticketId,version:ticket.version};tx.create(op,{fingerprint,result,createdAt:stamp()});return result;
 });
}
