import {test} from 'node:test';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';
import {shippingService,cleanShippingConfig} from '../functions/shipping-service.js';
import {shippoProvider,moneyCents} from '../functions/shippo-provider.js';
import {scopedDatabase} from '../functions/runtime-mode.js';import {postCredits,initialLiveWallet} from '../functions/wallet-ledger.js';import {memoryDatabase} from './helpers/memory-database.mjs';
const owner={sub:'owner',phone_number:'+17654794230'},address={fullName:'Collector',line1:'123 Example St',city:'Indianapolis',region:'IN',postalCode:'46204',country:'US'};
const config={version:1,enabled:true,labelsEnabled:true,origin:address,raw:{length:8,width:6,height:1,weight:1,perItemWeight:.2,capacity:20},graded:{length:10,width:8,height:3,weight:3,perItemWeight:3,capacity:2},maxValueCents:10000,services:['usps_ground_advantage']};
async function fixture(){
 const root=memoryDatabase(),db=scopedDatabase(root,'live'),id=randomUUID(),item=randomUUID(),rate={id:'a'.repeat(32),amountCents:379,carrier:'USPS',service:'Ground Advantage',serviceToken:'usps_ground_advantage'};
 let time=1800000000000,bought=0,quoted=0,synced=0,lose=false,last,transactionStatus='SUCCESS';
 const provider={rates:async()=>{quoted++;return{rates:[rate]}},buy:async({rateId,reference})=>{bought++;last={object_id:'b'.repeat(32),rate:rateId,metadata:reference,test:false,status:transactionStatus,label_url:'https://shippo-delivery.s3.amazonaws.com/fixture.pdf',tracking_number:'9400000000000000000000'};if(lose)throw Error('Uncertain transport');return last},transaction:async()=>({...last,status:transactionStatus}),refund:async()=>({status:'SUCCESS',transaction:last.object_id}),tracking:async()=>{synced++;return{carrier:'usps',tracking_number:last.tracking_number,tracking_status:{status:'DELIVERED'}}}};
 const wallet={...initialLiveWallet(),balanceCents:2000,creditBuckets:{purchasedCents:1500,promotionalCents:200,sellbackCents:300,legacyTestCents:0},sparkUnits:123,referralPurchasedSpendCents:700};
 await db.runTransaction(async tx=>{tx.set(db.doc('shippingSettings/config'),config);tx.set(db.doc('testAccounts/member'),wallet);tx.set(db.doc('testAccounts/member/items/'+item),{status:'shipping',shipmentId:id,name:'Card',valueCents:1000});const request={itemIds:[item],items:[{id:item,name:'Card',valueCents:1000}],address,status:'review',version:0};tx.set(db.doc('testAccounts/member/shipments/'+id),request);tx.set(db.doc('shippingQueue/root/requests/member_'+id),{...request,id,customerUid:'member'})});
 const service=shippingService(db,{provider,now:()=>time}),call=(action,data={},op=randomUUID())=>service('member',{action,accountUid:'member',shipmentId:id,operationId:op,...data},{sub:'member',phone_number:'+12025550123'}),admin=(action,data={},op=randomUUID())=>service('owner',{action,accountUid:'owner',customerUid:'member',shipmentId:id,operationId:op,...data},owner),read=path=>db.runTransaction(async tx=>(await tx.get(db.doc(path))).data());
 const quote=()=>call('quoteShipment'),pay=async(op=randomUUID())=>{const state=await call('shippingState');return call('payShipment',{quoteId:state.shipment.quoteId,rateId:rate.id,expectedCents:rate.amountCents},op)};
 return{root,db,id,item,rate,service,call,admin,read,quote,pay,wallet,counts:()=>({bought,quoted,synced}),lose:()=>lose=true,errorTransaction:()=>transactionStatus='ERROR',advance:n=>time+=n};
}
test('only owners configure shipping; private mode scopes and quote amounts remain authoritative',async()=>{
 const f=await fixture();await assert.rejects(()=>f.call('adminShippingSettings'),e=>e.code==='permission-denied');
 await assert.rejects(()=>f.service('other',{action:'adminShippingSettings',accountUid:'other'},owner),e=>e.code==='permission-denied');
 await assert.rejects(()=>f.service('other',{action:'shippingState',accountUid:'other',customerUid:'member',shipmentId:f.id}),e=>e.code==='not-found');
 assert.equal((await f.root.collection('shippingSettings').get()).size,0);
 const q=await f.quote();assert.equal(q.shipment.rates[0].amountCents,379);
 await assert.rejects(()=>f.call('payShipment',{quoteId:q.shipment.quoteId,rateId:f.rate.id,expectedCents:1}),e=>e.code==='failed-precondition');
 await assert.rejects(()=>f.quote(),e=>e.code==='resource-exhausted');assert.equal(f.counts().quoted,1);
 f.advance(16*60000);await assert.rejects(()=>f.pay(),e=>e.code==='failed-precondition');assert.equal((await f.read('testAccounts/member')).balanceCents,2000);
});
test('shipping payment is once-only, adds no Spark/referral spending and label creation never repeats',async()=>{
 const f=await fixture();await f.quote();const op=randomUUID();await Promise.all([f.pay(op),f.pay(op)]);
 const wallet=await f.read('testAccounts/member');assert.equal(wallet.balanceCents,1621);assert.equal(wallet.sparkUnits,123);assert.equal(wallet.referralPurchasedSpendCents,700);
 assert.deepEqual(wallet.creditBuckets,{purchasedCents:1500,promotionalCents:0,sellbackCents:121,legacyTestCents:0});
 await assert.rejects(()=>f.call('cancelShipment',{expectedVersion:2}),e=>e.code==='failed-precondition');
 await Promise.all([f.admin('adminBuyShippingLabel'),f.admin('adminBuyShippingLabel')]);await f.admin('adminBuyShippingLabel');assert.equal(f.counts().bought,1);
 const request=await f.read('testAccounts/member/shipments/'+f.id);assert.equal(request.status,'packing');assert.equal(request.labelStatus,'ready');assert.equal(request.trackingNumber,'9400000000000000000000');assert.equal(request.labelURL,undefined);
 await assert.rejects(()=>f.admin('adminRefundShippingFee'),e=>e.code==='failed-precondition');
 await f.db.runTransaction(async tx=>tx.update(f.db.doc('testAccounts/member/shipments/'+f.id),{status:'shipped'}));
 assert.equal((await f.call('syncTracking')).shipment.status,'delivered');await f.call('syncTracking');assert.equal(f.counts().synced,1);
});
test('uncertain label purchases require reconciliation; failed-label refunds restore original credit buckets once',async()=>{
 const f=await fixture();await f.quote();await f.pay();f.lose();
 await assert.rejects(()=>f.admin('adminBuyShippingLabel'),e=>e.code==='unavailable');
 assert.equal((await f.admin('adminBuyShippingLabel')).label.status,'unknown');assert.equal(f.counts().bought,1);
 await assert.rejects(()=>f.admin('adminRefundShippingFee'),e=>e.code==='failed-precondition');
 f.errorTransaction();await f.admin('adminRefreshShippingLabel',{transactionId:'b'.repeat(32)});
 const op=randomUUID();await f.admin('adminRefundShippingFee',{},op);await f.admin('adminRefundShippingFee',{},op);
 const wallet=await f.read('testAccounts/member');assert.equal(wallet.balanceCents,2000);assert.deepEqual(wallet.creditBuckets,f.wallet.creditBuckets);assert.equal(wallet.sparkUnits,123);
 assert.equal((await f.read('testAccounts/member/items/'+f.item)).status,'available');assert.equal((await f.read('testAccounts/member/shipments/'+f.id)).status,'canceled');
});
test('unpaid request cancellation releases cards without charging a balance or provider',async()=>{
 const f=await fixture(),op=randomUUID();await f.call('cancelShipment',{expectedVersion:0},op);await f.call('cancelShipment',{expectedVersion:0},op);
 assert.equal((await f.read('testAccounts/member/items/'+f.item)).status,'available');assert.equal((await f.read('testAccounts/member')).balanceCents,2000);assert.equal(f.counts().bought,0);
 await assert.rejects(()=>f.quote(),e=>e.code==='failed-precondition');
});
test('Shippo adapter uses trusted endpoints, filters unsupported services/currencies and does not retry purchases',async()=>{
 const calls=[];let fail=false;const p=shippoProvider({mode:'live',key:()=> 'shippo_live_fixture',fetchImpl:async(url,options)=>{calls.push({url,body:options.body&&JSON.parse(options.body)});if(fail)throw Error('secret provider body');return new Response(JSON.stringify({test:false,rates:[{object_id:'a'.repeat(32),amount:'3.79',currency:'USD',provider:'USPS',servicelevel:{token:'usps_ground_advantage',name:'Ground Advantage'}},{object_id:'c'.repeat(32),amount:'1.00',currency:'USD',servicelevel:{token:'untracked_letter'}}]}),{status:200})}});
 const result=await p.rates({origin:{name:'Origin'},destination:{name:'Destination'},parcel:{weight:'2'},services:['usps_ground_advantage']});assert.equal(result.rates.length,1);assert.equal(result.rates[0].amountCents,379);assert.equal(calls[0].url,'https://api.goshippo.com/shipments/');assert.equal(calls[0].body.async,false);
 fail=true;await assert.rejects(()=>p.buy({rateId:'a'.repeat(32),reference:'safe'}),e=>!e.message.includes('secret provider body'));assert.equal(calls.length,2);
 assert.equal(moneyCents('3.791'),null);assert.equal(moneyCents('3.79'),379);
 assert.throws(()=>cleanShippingConfig({...config,raw:{...config.raw,weight:0}}));assert.throws(()=>cleanShippingConfig({...config,origin:{...address,country:'CA'}}));
});

import {testShippo} from '../functions/shippo-test.js';
test('owner sandbox check uses only test labels and never changes wallet or shipment records',async()=>{
 const f=await fixture(),before=await f.read('testAccounts/member');
 await assert.rejects(()=>testShippo(f.db,'member',{accountUid:'member',createLabel:true},{sub:'member'},{}),e=>e.code==='permission-denied');
 const provider={rates:async()=>({rates:[f.rate]}),buy:async()=>({test:true,status:'SUCCESS',object_id:'c'.repeat(32),label_url:'https://shippo-delivery.s3.amazonaws.com/test-only.pdf'})};
 const result=await testShippo(f.db,'owner',{accountUid:'owner',createLabel:true},owner,provider);
 assert.equal(result.testOnly,true);assert.equal(result.noWalletChanges,true);assert(result.label.labelURL.endsWith('test-only.pdf'));assert.deepEqual(await f.read('testAccounts/member'),before);
 await assert.rejects(()=>testShippo(f.db,'owner',{accountUid:'owner',createLabel:true},owner,{...provider,buy:async()=>({test:false,status:'SUCCESS'})}),e=>e.code==='failed-precondition');
});
test('wrong Shippo credential mode fails before any provider request',async()=>{
 let requests=0;const p=shippoProvider({mode:'test',key:()=> 'shippo_live_wrongMode',fetchImpl:async()=>{requests++;throw Error('must not call')}});
 await assert.rejects(()=>p.rates({}),e=>e.code==='unavailable');assert.equal(requests,0);
});

test('different payment IDs cannot charge one shipment twice and a lost label response can be recovered',async()=>{
 const f=await fixture();await f.quote();const results=await Promise.allSettled([f.pay(),f.pay()]);assert.equal(results.filter(x=>x.status==='fulfilled').length,1);assert.equal((await f.read('testAccounts/member')).balanceCents,1621);
 f.lose();await assert.rejects(()=>f.admin('adminBuyShippingLabel'));assert.equal((await f.read('testAccounts/member/shipments/'+f.id)).labelStatus,'unknown');
 await f.admin('adminRefreshShippingLabel',{transactionId:'b'.repeat(32)});assert.equal(f.counts().bought,1);assert.equal((await f.read('testAccounts/member/shipments/'+f.id)).labelStatus,'ready');
 await assert.rejects(()=>f.admin('adminRefundShippingFee'),e=>e.code==='failed-precondition');
});

test('a confirmed Shippo refund of an unshipped label unlocks a single source-preserving credit return',async()=>{
 const f=await fixture();await f.quote();await f.pay();await f.admin('adminBuyShippingLabel');
 await f.admin('adminReconcileShippingVoid',{refundId:'d'.repeat(32)});assert.equal((await f.admin('adminShippingLabel')).label.status,'voided');
 await f.admin('adminRefundShippingFee');assert.equal((await f.read('testAccounts/member')).balanceCents,2000);assert.equal((await f.read('testAccounts/member/items/'+f.item)).status,'available');assert.equal(f.counts().bought,1);
});

test('definitive provider rejections are distinguishable from ambiguous transport failures',async()=>{
 const p=shippoProvider({mode:'live',key:()=> 'shippo_live_fixture',fetchImpl:async()=>new Response('{}',{status:400})});
 await assert.rejects(()=>p.buy({rateId:'a'.repeat(32),reference:'safe'}),e=>e.details.provider==='shippo'&&e.details.rejected===true);
});

test('payment holds prevent buying new postage without preventing an eligible shipping credit return',async()=>{
 const f=await fixture();await f.quote();await f.pay();await f.db.runTransaction(async tx=>tx.update(f.db.doc('testAccounts/member'),{paymentHold:true}));
 assert.equal((await f.admin('adminShippingLabel')).fulfillmentHold,true);await assert.rejects(()=>f.admin('adminBuyShippingLabel'),e=>e.code==='failed-precondition');assert.equal(f.counts().bought,0);
 await f.admin('adminRefundShippingFee');assert.equal((await f.read('testAccounts/member')).balanceCents,2000);assert.equal((await f.read('testAccounts/member')).paymentHold,true);
});

test('refunded purchased shipping credit repays existing payment debt instead of creating spendable credit twice',async()=>{
 const f=await fixture(),account=f.db.doc('testAccounts/member');
 await f.db.runTransaction(async tx=>tx.update(account,{creditBuckets:{purchasedCents:2000,promotionalCents:0,sellbackCents:0,legacyTestCents:0}}));
 await f.quote();await f.pay();
 await f.db.runTransaction(async tx=>{const saved=await tx.get(account),w=saved.data();const patch=postCredits(tx,account,w,{id:'provider-full-refund',kind:'stripe-refund-reconciliation',moves:[{bucket:'purchasedCents',cents:-1621}],atMs:Date.now()});tx.update(account,{...patch,paymentDebtCents:379,paymentReviewCount:0,paymentHold:true})});
 const result=await f.admin('adminRefundShippingFee');assert.equal(result.appliedToDebtCents,379);const w=await f.read('testAccounts/member');assert.equal(w.balanceCents,0);assert.equal(w.paymentDebtCents,0);assert.equal(w.paymentHold,false);assert.equal(w.sparkUnits,123);
});
