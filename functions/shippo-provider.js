import {HttpsError} from 'firebase-functions/v2/https';
const fail=(message,details)=>{throw new HttpsError('unavailable',message,details)};
export const moneyCents=value=>typeof value==='string'&&/^\d+(\.\d{1,2})?$/.test(value)&&Number.isSafeInteger(Math.round(Number(value)*100))?Math.round(Number(value)*100):null;
export function shippoProvider({key,mode='test',fetchImpl=fetch}){
 const request=async(path,body)=>{
  const operation=path==='/shipments/'?'rates':path==='/transactions/'?'label':path.startsWith('/transactions/')?'label-status':path.startsWith('/refunds/')?'refund-status':'tracking';
  const token=key();if(typeof token!=='string'||!token.startsWith(mode==='live'?'shippo_live_':'shippo_test_')||token!==token.trim())fail('Shipping needs its '+mode+' Shippo API key configured.',{provider:'shippo',rejected:true});
  let response;try{response=await fetchImpl('https://api.goshippo.com'+path,{method:body?'POST':'GET',headers:{Authorization:'ShippoToken '+token,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(20000)})}catch{fail('Shippo did not confirm the request. Check its saved status before retrying a label purchase.')}
  if(!response.ok){
   const status=response.status,reason=status===401?'authentication':status===403?'account-access':status===429?'rate-limit':status>=500?'provider-unavailable':'request-rejected';
   const message=status===401?'Shippo rejected the API key. Check the saved test or live token.':status===403?'Shippo denied access. Check API access and carrier setup in your Shippo account.':status===429?'Shippo is receiving too many requests. Wait before trying again.':status>=500?'Shippo is temporarily unavailable. Check the saved label status before retrying a label purchase.':'Shippo rejected the shipping request. Check the sender, destination, parcel measurements and carrier setup.';
   let fields=[];try{const error=await response.json();fields=['address_from','address_to','parcels','rate','carrier_accounts','label_file_type','non_field_errors'].filter(field=>Object.hasOwn(error||{},field))}catch{}
   fail(message,{provider:'shippo',status,operation,reason,fields,rejected:[400,401,402,403,404,422].includes(status)});
  }
  let data;try{data=await response.json()}catch{fail('Shippo returned an unreadable response. Check its saved status.')}
  return data;
 };
 return{
  rates:({origin,destination,parcel,services})=>request('/shipments/',{address_from:origin,address_to:destination,parcels:[parcel],async:false}).then(data=>{
   if(data.test!==(mode==='test'))fail('Shippo shipment mode does not match this account.');
   const rates=(Array.isArray(data.rates)?data.rates:[]).filter(r=>r.currency==='USD'&&services.includes(r.servicelevel?.token)&&moneyCents(r.amount)>0&&moneyCents(r.amount)<=100000&&/^[a-zA-Z0-9_-]{16,80}$/.test(r.object_id||'')).map(r=>({id:r.object_id,amountCents:moneyCents(r.amount),carrier:String(r.provider||'Carrier').slice(0,80),service:String(r.servicelevel?.name||'Tracked shipping').slice(0,100),serviceToken:r.servicelevel.token,estimatedDays:Number.isInteger(r.estimated_days)&&r.estimated_days>0&&r.estimated_days<=60?r.estimated_days:null})).sort((a,b)=>a.amountCents-b.amountCents).slice(0,10);
   if(!rates.length)fail('No configured tracked shipping services are available for this address and parcel.');return{rates};
  }),
  buy:({rateId,reference})=>request('/transactions/',{rate:rateId,label_file_type:'PDF_4x6',async:false,metadata:reference}),
  refund:id=>{if(!/^[a-zA-Z0-9_-]{16,80}$/.test(id||''))throw new HttpsError('invalid-argument','Enter a valid Shippo refund ID.');return request('/refunds/'+encodeURIComponent(id)+'/')},
  tracking:(carrier,number)=>{if(!['usps','ups','fedex','dhl_express'].includes(carrier)||typeof number!=='string'||!/^[a-zA-Z0-9 -]{1,160}$/.test(number))throw new HttpsError('invalid-argument','This carrier needs manual tracking review.');return request('/tracks/'+carrier+'/'+encodeURIComponent(number)+'/')},
  transaction:id=>{if(!/^[a-zA-Z0-9_-]{16,80}$/.test(id||''))throw new HttpsError('invalid-argument','Enter a valid Shippo transaction ID.');return request('/transactions/'+encodeURIComponent(id)+'/')}
 };
}
