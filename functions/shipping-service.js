import {suggestedPackingConfig,cleanPackingPresets,selectShippingPackaging} from './shipping-packaging.js';
import {createHash,randomUUID} from 'node:crypto';
import {FieldValue} from 'firebase-admin/firestore';
import {HttpsError} from 'firebase-functions/v2/https';
import {isAdminToken} from './catalog-model.js';
import {cleanShippingAddress,shipmentStage} from './account-settings-model.js';
import {hasLegacyHold} from './payment-review-model.js';
import {calculateCredits,postCredits,readCredits} from './wallet-ledger.js';
const fail=(code,message)=>{throw new HttpsError(code,message)},stamp=()=>FieldValue.serverTimestamp();
const validId=x=>typeof x==='string'&&/^[a-zA-Z0-9_-]{16,90}$/.test(x);
const defaults=()=>({version:0,enabled:false,labelsEnabled:false,origin:null,...suggestedPackingConfig(),maxValueCents:10000,services:['usps_ground_advantage','usps_priority']});
const json=d=>Object.fromEntries(Object.entries(d).map(([k,v])=>[k,v?.toMillis?v.toMillis():v]));
export function cleanShippingConfig(value){
 if(!value||typeof value.enabled!=='boolean'||typeof value.labelsEnabled!=='boolean')fail('invalid-argument','Choose whether quotes and label purchases are enabled.');
 let origin;try{origin=cleanShippingAddress(value.origin,{live:true})}catch(e){fail('invalid-argument',e.message)}
 if(value.originPhone!==undefined&&(typeof value.originPhone!=='string'||value.originPhone.trim()&&!/^\+?[0-9 ()-]{7,32}$/.test(value.originPhone.trim())))fail('invalid-argument','Enter a valid sender phone number.');
 if(value.originEmail!==undefined&&(typeof value.originEmail!=='string'||value.originEmail.trim()&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.originEmail.trim())||value.originEmail.length>254))fail('invalid-argument','Enter a valid sender email.');
 const parcel=p=>{if(!p||!Number.isInteger(p.capacity)||p.capacity<1||p.capacity>50||!['length','width','height','weight','perItemWeight'].every(k=>typeof p[k]==='number'&&Number.isFinite(p[k])&&p[k]>=0&&p[k]<=1000)||!['length','width','height','weight'].every(k=>p[k]>0))fail('invalid-argument','Enter measured parcel dimensions and weights.');return Object.fromEntries(['length','width','height','weight','perItemWeight','capacity'].map(k=>[k,p[k]]))};
 if(!Number.isSafeInteger(value.maxValueCents)||value.maxValueCents<1||value.maxValueCents>10000000||!Array.isArray(value.services)||!value.services.length||value.services.length>30||value.services.some(s=>typeof s!=='string'||!/^[a-z0-9_]{1,80}$/.test(s)))fail('invalid-argument','Check the automated shipping value limit and allowed tracked services.');
 let testDestination;const supplied=value.testDestination;if(supplied&&['fullName','line1','line2','city','region','postalCode'].some(k=>typeof supplied[k]==='string'&&supplied[k].trim())){try{testDestination=cleanShippingAddress(supplied,{live:true})}catch(e){fail('invalid-argument','Sandbox destination: '+e.message)}}
 let packingPresets;try{packingPresets=cleanPackingPresets(value.packingPresets)}catch(e){fail('invalid-argument',e.message)}
 return{...(testDestination?{testDestination}:{}),...(packingPresets?{packingPresets}:{}),enabled:value.enabled,labelsEnabled:value.labelsEnabled,origin,originPhone:typeof value.originPhone==='string'?value.originPhone.trim().slice(0,32):'',originEmail:typeof value.originEmail==='string'?value.originEmail.trim().slice(0,254):'',raw:parcel(value.raw),graded:parcel(value.graded),maxValueCents:value.maxValueCents,services:[...new Set(value.services)]};
}
const providerAddress=a=>({name:a.fullName,street1:a.line1,street2:a.line2||'',city:a.city,state:a.region,zip:a.postalCode,country:a.country});
export function shippingService(db,{provider,now=Date.now}={}){
 const mode=db.mode||'test';
 return async(uid,input={},claims={})=>{
  if(!uid||input.accountUid!==uid)fail('unauthenticated','Sign in again before continuing shipping.');
  const admin=input.action?.startsWith('admin');if(admin&&!isAdminToken(claims,uid))fail('permission-denied','Only the verified owner may manage shipping.');
  const configRef=db.doc('shippingSettings/config'),read=ref=>db.runTransaction(tx=>tx.get(ref));
  if(input.action==='adminShippingSettings'){const saved=await read(configRef);return{config:saved.exists?saved.data():defaults(),suggestedPacking:suggestedPackingConfig()}}
  if(input.action==='adminSaveShippingSettings'){
   const config=cleanShippingConfig(input.config);if(!Number.isSafeInteger(input.expectedVersion)||input.expectedVersion<0)fail('invalid-argument','Reload shipping settings.');
   return db.runTransaction(async tx=>{const prior=await tx.get(configRef),version=prior.data()?.version||0;if(version!==input.expectedVersion)fail('aborted','Shipping settings changed. Reload before saving.');const result={...config,version:version+1};tx.set(configRef,{...result,updatedBy:uid,updatedAt:stamp()});return{config:result}});
  }
  if(input.action==='validateShippingAddress'){
   let entered;try{entered=cleanShippingAddress(input.address,{live:true})}catch(e){fail('invalid-argument',e.message)}if(!entered)fail('invalid-argument','Add a complete delivery address.');
   const account=db.doc('testAccounts/'+uid),limit=account.collection('meta').doc('shippoAddressRate'),started=now();
   await db.runTransaction(async tx=>{const [settings,wallet,closure,limited]=await Promise.all([tx.get(configRef),tx.get(account),tx.get(db.doc('accountClosureState/'+uid)),tx.get(limit)]);const w=wallet.data();if(!settings.data()?.enabled)fail('failed-precondition','Address checks are temporarily unavailable. You can submit a shipping request for review.');if(!w||w.closureStatus||w.paymentHold||w.legacyPaymentHold||w.paymentDebtCents>0||w.paymentReviewCount>0||closure.data()?.status&&closure.data().status!=='canceled')fail('failed-precondition','Resolve your account review before checking an address.');const bucket=Math.floor(started/60000),count=limited.data()?.bucket===bucket?limited.data().count||0:0;if(count>=5)fail('resource-exhausted','Too many address checks. Wait a minute before trying again.');tx.set(limit,{bucket,count:count+1});});
   const result=await provider.validateAddress({...providerAddress(entered),...(claims?.phone_number?{phone:claims.phone_number}:{})});
   let suggested=null;if(result.valid===true){try{suggested=cleanShippingAddress({...result.suggested,fullName:entered.fullName},{live:true})}catch{}}
   if(!suggested)return{valid:false,entered,suggested:null,changed:false,reason:result.reason==='unit-review'?'unit-review':'unconfirmed'};
   if(entered.line2&&!suggested.line2)return{valid:false,entered,suggested:null,changed:false,reason:'unit-review'};
   return{valid:true,entered,suggested,changed:['line1','line2','city','region','postalCode','country'].some(key=>entered[key]!==suggested[key])};
  }
  if(input.action==='estimateShipment'){
   const ids=input.itemIds;
   if(!Array.isArray(ids)||!ids.length||ids.length>50||new Set(ids).size!==ids.length||ids.some(id=>!validId(id)))fail('invalid-argument','Select between 1 and 50 different items.');
   let address;try{address=cleanShippingAddress(input.address,{live:true})}catch(e){fail('invalid-argument',e.message)}if(!address)fail('invalid-argument','Add a delivery address.');
   const account=db.doc('testAccounts/'+uid),refs=ids.map(id=>account.collection('items').doc(id)),limit=account.collection('meta').doc('shippoQuoteRate'),closureRef=db.doc('accountClosureState/'+uid),started=now();
   const check=(wallet,closure,snapshots)=>{if(!wallet||wallet.closureStatus||wallet.paymentHold||wallet.legacyPaymentHold||wallet.paymentDebtCents>0||wallet.paymentReviewCount>0||closure&&closure.status!=='canceled')fail('failed-precondition','Resolve your account review before calculating shipping.');readCredits(wallet);if(snapshots.some(s=>!s.exists||s.data().status!=='available'))fail('failed-precondition','An item is no longer available. Refresh your collection.');};
   const prepared=await db.runTransaction(async tx=>{
    const [saved,wallet,closure,rate,...snapshots]=await Promise.all([tx.get(configRef),tx.get(account),tx.get(closureRef),tx.get(limit),...refs.map(ref=>tx.get(ref))]);
    if(!saved.data()?.enabled)fail('failed-precondition','Carrier estimates are not available yet. You can submit a shipping request for review.');
    check(wallet.data(),closure.data(),snapshots);const config=cleanShippingConfig(saved.data()),items=snapshots.map(s=>s.data());
    if(items.some(i=>!Number.isSafeInteger(i.valueCents)||i.valueCents<0)||items.reduce((sum,i)=>sum+i.valueCents,0)>config.maxValueCents)fail('failed-precondition','These items need a manual insurance review. Submit a shipping request or contact support.');
    let packing;try{packing=selectShippingPackaging(config,items)}catch(e){fail('failed-precondition',e.message)}
    const bucket=Math.floor(started/60000),count=rate.data()?.bucket===bucket?rate.data().count||0:0;if(count>=5)fail('resource-exhausted','Too many shipping quote requests. Wait a minute before trying again.');
    tx.set(limit,{bucket,count:count+1});return{config,version:saved.data().version,...packing};
   });
   const {config,parcel,packaging}=prepared;
   const quoted=await provider.rates({origin:{...providerAddress(config.origin),...(config.originPhone?{phone:config.originPhone}:{}),...(config.originEmail?{email:config.originEmail}:{})},destination:{...providerAddress(address),...(claims?.phone_number?{phone:claims.phone_number}:{})},parcel,services:config.services});
   await db.runTransaction(async tx=>{const [settings,wallet,closure,...snapshots]=await Promise.all([tx.get(configRef),tx.get(account),tx.get(closureRef),...refs.map(ref=>tx.get(ref))]);check(wallet.data(),closure.data(),snapshots);if(!settings.data()?.enabled||settings.data().version!==prepared.version)fail('aborted','Shipping settings changed. Calculate a fresh estimate.');});
   return{estimateOnly:true,rates:quoted.rates,parcel,packaging:packaging||null,expiresAtMs:now()+15*60000};
  }
  const customer=admin?input.customerUid:uid,id=input.shipmentId;
  if(typeof customer!=='string'||!customer||customer.includes('/')||customer.length>128||!validId(id))fail('invalid-argument','Choose a shipping request.');
  const account=db.doc('testAccounts/'+customer),target=account.collection('shipments').doc(id),queue=db.doc('shippingQueue/root/requests/'+customer+'_'+id),jobRef=db.doc('shippingProviderJobs/'+createHash('sha256').update(customer+':'+id).digest('hex'));
  const write=(tx,data,patch)=>{tx.update(target,patch);tx.set(queue,{...data,...patch,id,customerUid:customer})};
  const ensureOpen=wallet=>{if(!wallet||wallet.closureStatus||wallet.paymentHold||wallet.paymentDebtCents>0)fail('failed-precondition','Resolve your account or payment review before continuing shipping.')};
  const saved=await read(target);if(!saved.exists)fail('not-found','Shipping request not found.');
  if(input.action==='shippingState'){const config=(await read(configRef)).data();return{shipment:{...json(saved.data()),id},paymentsEnabled:config?.enabled===true&&config?.labelsEnabled===true}};
  if(input.action==='adminShippingLabel'){const [job,wallet]=await Promise.all([read(jobRef),read(account)]);const w=wallet.data();return{label:job.exists?job.data():null,fulfillmentHold:!w||!!w.closureStatus||!!w.paymentHold||w.paymentDebtCents>0}}
  if(input.action==='cancelShipment'){
   if(!validId(input.operationId))fail('invalid-argument','Use a valid shipping operation ID.');
   const op=account.collection('operations').doc(input.operationId);
   return db.runTransaction(async tx=>{const [prior,found,wallet,job]=await Promise.all([tx.get(op),tx.get(target),tx.get(account),tx.get(jobRef)]);if(prior.exists){if(prior.data().shippingAction!=='cancelShipment'||prior.data().shipmentId!==id)fail('already-exists','Use a new operation ID.');return prior.data().result}ensureOpen(wallet.data());const data=found.data();if(data.feeStatus==='paid'||shipmentStage(data.status)>=3||job.exists||data.status==='canceled')fail('failed-precondition','This request needs support review to cancel.');if((data.version||0)!==input.expectedVersion)fail('aborted','Shipping changed. Reload before canceling.');const refs=data.itemIds.map(x=>account.collection('items').doc(x)),items=await Promise.all(refs.map(x=>tx.get(x)));if(items.some(x=>!x.exists||x.data().shipmentId!==id||x.data().status!=='shipping'))fail('failed-precondition','Shipment items need review.');refs.forEach(ref=>tx.update(ref,{status:'available',shipmentId:null}));write(tx,data,{status:'canceled',version:(data.version||0)+1,canceledAtMs:now()});const result={canceled:true};tx.create(op,{shippingAction:'cancelShipment',shipmentId:id,result,createdAt:stamp()});return result});
  }
  if(input.action==='quoteShipment'){
   const config=(await read(configRef)).data();if(!config?.enabled)fail('failed-precondition','Carrier quotes are not available yet. Your request remains saved.');
   const configData=cleanShippingConfig(config),data=saved.data();if(!['review','test-request','packing'].includes(data.status)||data.feeStatus==='paid')fail('failed-precondition','This request cannot be re-quoted.');
   const address=cleanShippingAddress(data.address,{live:true}),items=data.items||[];if(!items.length||items.reduce((n,x)=>n+x.valueCents,0)>configData.maxValueCents)fail('failed-precondition','This shipment needs a manual insurance review. Contact support.');
   let packing;try{packing=selectShippingPackaging(configData,items)}catch(e){fail('failed-precondition',e.message)}const {parcel,packaging}=packing,quoteId=randomUUID(),started=now();
   await db.runTransaction(async tx=>{const rateLimit=account.collection('meta').doc('shippoQuoteRate'),[found,wallet,limited]=await Promise.all([tx.get(target),tx.get(account),tx.get(rateLimit)]);ensureOpen(wallet.data());const current=found.data(),bucket=Math.floor(started/60000),count=limited.data()?.bucket===bucket?limited.data().count||0:0;if(count>=5)fail('resource-exhausted','Too many shipping quote requests. Wait a minute before trying again.');if((current.version||0)!==(data.version||0)||current.feeStatus==='paid')fail('aborted','Shipping changed. Reload before quoting.');if(started-(current.quoteRequestedAtMs||0)<30000)fail('resource-exhausted','Wait 30 seconds before requesting another quote.');tx.set(rateLimit,{bucket,count:count+1});write(tx,current,{quoteStatus:'loading',quoteId,quoteRequestedAtMs:started,version:(current.version||0)+1})});
   let result;try{result=await provider.rates({origin:{...providerAddress(configData.origin),...(configData.originPhone?{phone:configData.originPhone}:{}),...(configData.originEmail?{email:configData.originEmail}:{})},destination:{...providerAddress(address),...(claims?.phone_number?{phone:claims.phone_number}:{})},parcel,services:configData.services})}catch(error){await db.runTransaction(async tx=>{const found=await tx.get(target);if(found.data()?.quoteId===quoteId)write(tx,found.data(),{quoteStatus:'unavailable'})});throw error}
   return db.runTransaction(async tx=>{const found=await tx.get(target),current=found.data();if(current.quoteId!==quoteId||current.status==='canceled'||current.feeStatus==='paid')fail('aborted','The shipping request changed while quoting.');const patch={quoteStatus:'ready',quoteId,rates:result.rates,quoteExpiresAtMs:now()+15*60000,quoteConfigVersion:config.version,parcel,packaging:packaging||null,version:(current.version||0)+1};write(tx,current,patch);return{shipment:{...json(current),...patch,id},paymentsEnabled:configData.labelsEnabled}});
  }
  if(input.action==='payShipment'){
   if(!validId(input.operationId))fail('invalid-argument','Use a valid payment operation ID.');
   const op=account.collection('operations').doc(input.operationId);
   return db.runTransaction(async tx=>{const [prior,found,wallet,config]=await Promise.all([tx.get(op),tx.get(target),tx.get(account),tx.get(configRef)]);if(prior.exists){if(prior.data().shippingAction!=='payShipment'||prior.data().shipmentId!==id||prior.data().rateId!==input.rateId)fail('already-exists','Use a new operation ID.');return prior.data().result}const data=found.data(),w=wallet.data();ensureOpen(w);if(!config.data()?.enabled||!config.data()?.labelsEnabled)fail('failed-precondition','Shipping payment is not enabled yet. No credit was deducted.');if(data.feeStatus==='paid')fail('failed-precondition','Shipping is already paid.');if(shipmentStage(data.status)>=3||data.status==='canceled'||data.quoteStatus!=='ready'||data.quoteId!==input.quoteId||data.quoteExpiresAtMs<now()||data.quoteConfigVersion!==config.data().version)fail('failed-precondition','The shipping quote changed or expired. Get a fresh quote.');const rate=data.rates.find(x=>x.id===input.rateId);if(!rate||input.expectedCents!==rate.amountCents)fail('failed-precondition','Review the current shipping price before paying.');const movement=calculateCredits(w,[{spend:rate.amountCents}]);const sources=Object.fromEntries(Object.entries(movement.delta).map(([k,v])=>[k,-v]));const credit=postCredits(tx,account,w,{id:input.operationId,kind:'shipping-fee',moves:[{spend:rate.amountCents}],atMs:now(),reference:id});tx.update(account,{...credit,updatedAt:stamp()});const patch={feeStatus:'paid',shippingPaidCents:rate.amountCents,shippingCreditSources:sources,paidRate:rate,paidAtMs:now(),version:(data.version||0)+1};write(tx,data,patch);tx.create(account.collection('activity').doc(input.operationId),{type:'shipping-fee',label:'Shipping paid · '+rate.carrier+' '+rate.service,amountCents:-rate.amountCents,testOnly:mode!=='live',createdAt:stamp()});const result={paid:true,amountCents:rate.amountCents};tx.create(op,{shippingAction:'payShipment',shipmentId:id,rateId:rate.id,result,createdAt:stamp()});return result});
  }
  if(['syncTracking','adminSyncTracking'].includes(input.action)){
   const current=saved.data(),carrier=String(current.carrier||'').toLowerCase().trim().replace(/[ -]+/g,'_').replace(/^dhl$/,'dhl_express');
   if(shipmentStage(current.status)<3||!current.trackingNumber)fail('failed-precondition','Tracking is available after dispatch.');
   if(now()-(current.trackingSyncedAtMs||0)<60000)return{shipment:{...json(current),id}};
   const result=await provider.tracking(carrier,current.trackingNumber);
   if(result.tracking_number!==current.trackingNumber||String(result.carrier).toLowerCase().replace(/^dhl$/,'dhl_express')!==carrier)fail('failed-precondition','The carrier response did not match this shipment.');
   const carrierStatus=result.tracking_status?.status;
   if(!['UNKNOWN','PRE_TRANSIT','TRANSIT','DELIVERED','RETURNED','FAILURE'].includes(carrierStatus))fail('unavailable','The carrier has no recognized tracking status yet.');
   return db.runTransaction(async tx=>{const found=await tx.get(target),data=found.data();if(data.trackingNumber!==current.trackingNumber||data.carrier!==current.carrier)fail('aborted','Tracking details changed. Refresh before syncing.');const status=carrierStatus==='DELIVERED'?'delivered':data.status;const patch={status,carrierStatus,trackingSyncedAtMs:now(),version:(data.version||0)+1};write(tx,data,patch);return{shipment:{...json(data),...patch,id}}});
  }
  if(input.action==='adminReconcileShippingVoid'){
   const job=(await read(jobRef)).data();if(!job?.transactionId||shipmentStage(saved.data().status)>=3)fail('failed-precondition','Only an unshipped label can be reconciled as voided here.');
   const [refund,transaction]=await Promise.all([provider.refund(input.refundId),provider.transaction(job.transactionId)]);
   const refundedTransaction=typeof refund.transaction==='string'?refund.transaction:refund.transaction?.object_id;
   if(refund.status!=='SUCCESS'||refundedTransaction!==job.transactionId||transaction.object_id!==job.transactionId||transaction.test!==(mode==='test')||transaction.metadata!==job.reference)fail('failed-precondition','Shippo has not confirmed a successful refund for this label.');
   await db.runTransaction(async tx=>{const [found,prior]=await Promise.all([tx.get(target),tx.get(jobRef)]);const data=found.data();if(shipmentStage(data.status)>=3||prior.data()?.transactionId!==job.transactionId)fail('aborted','Shipping changed. Reload before reconciling.');tx.update(jobRef,{status:'voided',refundId:input.refundId,updatedAtMs:now()});write(tx,data,{labelStatus:'voided',version:(data.version||0)+1})});return{label:{...job,status:'voided',refundId:input.refundId}};
  }
  if(input.action==='adminRefundShippingFee'){
   if(!validId(input.operationId))fail('invalid-argument','Use a valid refund operation ID.');const op=db.doc('testAccounts/'+uid+'/operations/'+input.operationId);
   return db.runTransaction(async tx=>{const [prior,found,wallet,job]=await Promise.all([tx.get(op),tx.get(target),tx.get(account),tx.get(jobRef)]);if(prior.exists){if(prior.data().shippingAction!=='refundShipment'||prior.data().shipmentId!==id||prior.data().customerUid!==customer)fail('already-exists','Use a new operation ID.');return prior.data().result}const data=found.data();if(data.feeStatus!=='paid'||shipmentStage(data.status)>=3||data.labelStatus==='ready'||job.exists&&!['failed','voided'].includes(job.data().status))fail('failed-precondition','A purchased or uncertain label needs Shippo review before any refund.');const sources=data.shippingCreditSources;if(!sources||Object.values(sources).some(x=>!Number.isSafeInteger(x)||x<0)||Object.values(sources).reduce((n,x)=>n+x,0)!==data.shippingPaidCents)fail('failed-precondition','Shipping credits need ledger review.');const refs=data.itemIds.map(x=>account.collection('items').doc(x)),items=await Promise.all(refs.map(x=>tx.get(x)));if(items.some(x=>!x.exists||x.data().shipmentId!==id||x.data().status!=='shipping'))fail('failed-precondition','Shipment items need review.');const w=wallet.data(),debt=w.paymentDebtCents||0;if(!Number.isSafeInteger(debt)||debt<0)fail('failed-precondition','This wallet needs payment debt review.');const appliedToDebtCents=Math.min(debt,sources.purchasedCents||0),remainingDebt=debt-appliedToDebtCents;const patch=postCredits(tx,account,w,{id:'shipping-refund-'+input.operationId,kind:'shipping-fee-refund',moves:Object.entries(sources).map(([bucket,cents])=>({bucket,cents:cents-(bucket==='purchasedCents'?appliedToDebtCents:0)})).filter(x=>x.cents>0),atMs:now(),reference:id});tx.update(account,{...patch,...(appliedToDebtCents?{paymentDebtCents:remainingDebt,paymentHold:remainingDebt>0||(w.paymentReviewCount||0)>0||hasLegacyHold(w)}:{}),updatedAt:stamp()});refs.forEach(ref=>tx.update(ref,{status:'available',shipmentId:null}));write(tx,data,{status:'canceled',feeStatus:'refunded',shippingRefundedCents:data.shippingPaidCents,shippingDebtAppliedCents:appliedToDebtCents,version:(data.version||0)+1});tx.create(account.collection('activity').doc('shipping-refund-'+input.operationId),{type:'shipping-fee-refund',label:appliedToDebtCents?'Shipping refund · payment debt reduced':'Shipping credit returned · request canceled',amountCents:data.shippingPaidCents-appliedToDebtCents,createdAt:stamp(),testOnly:mode!=='live'});const result={refunded:true,amountCents:data.shippingPaidCents,appliedToDebtCents};tx.create(op,{shippingAction:'refundShipment',shipmentId:id,customerUid:customer,result,createdAt:stamp()});return result});
  }
  if(['adminBuyShippingLabel','adminRefreshShippingLabel'].includes(input.action)){
   const reference='rippr:'+jobRef.id;let transaction;
   if(input.action==='adminBuyShippingLabel'){
    const reservation=await db.runTransaction(async tx=>{const [job,found,config,wallet]=await Promise.all([tx.get(jobRef),tx.get(target),tx.get(configRef),tx.get(account)]);if(job.exists)return{existing:true,label:job.data()};const data=found.data();ensureOpen(wallet.data());if(!config.data()?.labelsEnabled||data.feeStatus!=='paid'||shipmentStage(data.status)>=3||data.status==='canceled')fail('failed-precondition','Shipping must be approved and paid before buying its label.');tx.create(jobRef,{status:'purchasing',reference,rateId:data.paidRate.id,createdAtMs:now()});write(tx,data,{labelStatus:'purchasing',version:(data.version||0)+1});return{rateId:data.paidRate.id}});
    if(reservation.existing)return{label:reservation.label};
    try{transaction=await provider.buy({rateId:reservation.rateId,reference})}catch(error){const status=error?.details?.provider==='shippo'&&error.details.rejected===true?'failed':'unknown';await db.runTransaction(async tx=>{const found=await tx.get(target);tx.update(jobRef,{status,updatedAtMs:now()});write(tx,found.data(),{labelStatus:status,version:(found.data().version||0)+1})});fail('unavailable',status==='failed'?'Shippo rejected the label request. Review its setup and return shipping credit before creating a new request.':'Label purchase status is uncertain. Check Shippo and reconcile its transaction; do not buy another label.')}
   }else{
    const job=(await read(jobRef)).data();if(!job)fail('not-found','No label purchase exists.');transaction=await provider.transaction(job.transactionId||input.transactionId);
   }
   const job=(await read(jobRef)).data(),rateId=typeof transaction.rate==='string'?transaction.rate:transaction.rate?.object_id;
   if(transaction.test!==(mode==='test')||transaction.metadata!==reference||rateId!==job.rateId||!validId(transaction.object_id))fail('failed-precondition','The Shippo transaction does not match this shipment. Review in Shippo.');
   const patch={status:transaction.status==='SUCCESS'?'ready':transaction.status==='ERROR'?'failed':'pending',transactionId:transaction.object_id,updatedAtMs:now()};
   if(patch.status==='ready'){
    let url;try{url=new URL(transaction.label_url)}catch{fail('unavailable','The label URL is unavailable. Refresh its saved transaction.')}
    if(url.protocol!=='https:'||url.username||url.password)fail('failed-precondition','Shippo returned an invalid label URL.');patch.labelURL=url.href;patch.trackingNumber=String(transaction.tracking_number||'');if(!patch.trackingNumber)fail('unavailable','Tracking is not available yet. Refresh its saved transaction.');
   }
   await db.runTransaction(async tx=>{const found=await tx.get(target),data=found.data();tx.update(jobRef,patch);if(patch.status==='ready')write(tx,data,{labelStatus:'ready',carrier:data.paidRate.carrier,trackingNumber:patch.trackingNumber,status:shipmentStage(data.status)<2?'packing':data.status,version:(data.version||0)+1});else write(tx,data,{labelStatus:patch.status,version:(data.version||0)+1})});return{label:{...job,...patch}};
  }
  fail('invalid-argument','Unknown shipping action.');
 };
}
