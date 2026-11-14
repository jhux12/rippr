import {HttpsError} from 'firebase-functions/v2/https';
import {isAdminToken} from './catalog-model.js';
export const promotionDay=atMs=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Indiana/Indianapolis',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(atMs));
const categories=['welcome','referral','spark'];
export const emptyPromotion=()=>({awards:0,packs:0,creditCents:0,packEvUnits:0});
export const packEvUnits=pack=>pack.items.reduce((sum,item)=>sum+item.valueCents*item.chanceBps,0);
// Read before the calling award writes. The returned write shares its transaction
// and operation replay boundary, so failed/retried awards never inflate totals.
export async function preparePromotion(tx,db,{category,awards=1,packs=0,creditCents=0,packEvUnits=0,atMs}){
 if(!categories.includes(category)||![awards,packs,creditCents,packEvUnits].every(n=>Number.isSafeInteger(n)&&n>=0))throw new HttpsError('internal','Invalid promotion summary movement.');
 const day=promotionDay(atMs),ref=db.doc('promotionDays/'+day),saved=await tx.get(ref),before=saved.data()||{},bucket={...emptyPromotion(),...before[category]};
 for(const [key,value]of Object.entries({awards,packs,creditCents,packEvUnits})){bucket[key]+=value;if(!Number.isSafeInteger(bucket[key]))throw new HttpsError('failed-precondition','Promotion totals need review.');}
 return()=>tx.set(ref,{...before,day,[category]:bucket,updatedAtMs:atMs});
}
export async function promotionSummary(db,uid,input,claims,atMs){
 if(!isAdminToken(claims,uid))throw new HttpsError('permission-denied','Only the verified owner may view promotion totals.');
 const days=input.days??30;if(![7,30,90].includes(days))throw new HttpsError('invalid-argument','Choose 7, 30 or 90 days.');
 const endDay=promotionDay(atMs),startDay=new Date(Date.parse(endDay+'T12:00:00Z')-(days-1)*86400000).toISOString().slice(0,10),totals=Object.fromEntries(categories.map(c=>[c,emptyPromotion()]));
 const found=await db.collection('promotionDays').orderBy('day','desc').limit(90).get();let recordedDays=0;
 for(const doc of found.docs){const row=doc.data();if(row.day<startDay||row.day>endDay)continue;recordedDays++;for(const category of categories)for(const key of Object.keys(emptyPromotion())){const n=row[category]?.[key]??0;if(!Number.isSafeInteger(n)||n<0)throw new HttpsError('failed-precondition','Promotion totals need reconciliation.');totals[category][key]+=n;if(!Number.isSafeInteger(totals[category][key]))throw new HttpsError('failed-precondition','Promotion totals exceed the reporting limit.');}}
 return{days,startDay,endDay,timeZone:'America/Indiana/Indianapolis',totals,recordedDays,estimatedCents:Object.values(totals).reduce((n,t)=>n+t.creditCents+t.packEvUnits/10000,0),historicalBackfill:false,sandbox:true,asOfMs:atMs};
}
