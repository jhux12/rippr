import {createHash} from 'node:crypto';
import {promotionDay} from './promotion-summary.js';
const categories={checkout:'checkoutErrors',opening:'openingErrors'};
const reasons=new Set(['key','tax','site','permission','checkout','temporary','retry','internal','unavailable','unknown','deadline-exceeded']);
// Only aggregate counts and hashed retry keys are stored. No phone numbers,
// customer IDs, request payloads, card data, provider bodies or error messages.
export async function recordOperationFailure(db,{category,uid,operationId,reason,atMs=Date.now()}){
 if(!categories[category]||!reasons.has(reason)||typeof uid!=='string'||!uid||typeof operationId!=='string'||!/^[a-zA-Z0-9-]{16,80}$/.test(operationId)||!Number.isSafeInteger(atMs))return;
 const day=promotionDay(atMs),target=db.doc('operationalDays/'+day),id=createHash('sha256').update(JSON.stringify([category,uid,operationId])).digest('hex'),event=db.doc('operationalDays/'+day+'/events/'+id);
 await db.runTransaction(async tx=>{
  const [seen,saved]=await Promise.all([tx.get(event),tx.get(target)]);if(seen.exists)return;
  const data=saved.data()||{},field=categories[category],count=data[field]||0;if(!Number.isSafeInteger(count)||count<0)throw Error('Invalid operational count.');
  tx.create(event,{category,reason,atMs});tx.set(target,{...data,day,[field]:count+1,updatedAtMs:atMs});
 });
}
export async function monitorFailure(db,details){let timer;try{await Promise.race([recordOperationFailure(db,details),new Promise(resolve=>{timer=setTimeout(resolve,2000)})])}catch{/* Diagnostics must never replace the payment/opening result. */}finally{clearTimeout(timer)}}
export async function withOpeningMonitoring(db,uid,input,work){
 try{return await work()}catch(error){
  if(['purchase','openInventoryPack'].includes(input?.action)){
   const reason=error?.code||'internal';if(['internal','unavailable','unknown','deadline-exceeded'].includes(reason)){console.error('Opening service failure',{reason});await monitorFailure(db,{category:'opening',uid,operationId:input.operationId,reason});}
  }
  throw error;
 }
}
export async function operationSummary(db,atMs){
 const endDay=promotionDay(atMs),startDay=new Date(Date.parse(endDay+'T12:00:00Z')-6*86400000).toISOString().slice(0,10);
 const rows=await db.collection('operationalDays').orderBy('day','desc').limit(7).get();let checkoutErrors=0,openingErrors=0;
 for(const doc of rows.docs){const data=doc.data();if(data.day<startDay||data.day>endDay)continue;for(const field of Object.values(categories))if(data[field]!==undefined&&(!Number.isSafeInteger(data[field])||data[field]<0))throw Error('Invalid operational count.');checkoutErrors+=data.checkoutErrors||0;openingErrors+=data.openingErrors||0;}
 return{startDay,endDay,checkoutErrors,openingErrors,historicalBackfill:false};
}
