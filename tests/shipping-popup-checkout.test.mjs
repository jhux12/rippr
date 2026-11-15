import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {shippingService,cleanShippingConfig} from '../functions/shipping-service.js';
import {accountService} from '../functions/service.js';
import {scopedDatabase} from '../functions/runtime-mode.js';
import {initialLiveWallet} from '../functions/wallet-ledger.js';
import {suggestedPackingConfig} from '../functions/shipping-packaging.js';
import {memoryDatabase} from './helpers/memory-database.mjs';
const address={fullName:'Collector',line1:'123 Example St',city:'Indianapolis',region:'IN',postalCode:'46204',country:'US'},owner={sub:'owner',phone_number:'+17654794230'};
async function fixture(){
 const db=scopedDatabase(memoryDatabase(),'live'),id=randomUUID();let time=1800000000000,buys=0,quotes=0;
 const config={...suggestedPackingConfig(),rateMode:'shippo',origin:address,version:1,enabled:true,labelsEnabled:true,maxValueCents:10000,services:['usps_ground_advantage'],markupBps:1000,handlingCents:50};
 const provider={rates:async()=>{quotes++;return{rates:[{id:'a'.repeat(32),carrier:'USPS',service:'Ground Advantage',serviceToken:'usps_ground_advantage',amountCents:499}]}},buy:async()=>{buys++;throw Error('No label should be purchased')}};
 await db.runTransaction(tx=>{tx.set(db.doc('shippingSettings/config'),config);tx.set(db.doc('testAccounts/member'),{...initialLiveWallet(),balanceCents:2000,creditBuckets:{purchasedCents:1000,promotionalCents:500,sellbackCents:500,legacyTestCents:0},sparkUnits:123,referralPurchasedSpendCents:100});tx.set(db.doc('testAccounts/member/items/'+id),{name:'Card',image:'assets/card-placeholder.svg',rarity:'Rare',valueCents:100,status:'available'})});
 const service=shippingService(db,{provider,now:()=>time}),call=(action,data={},operationId=randomUUID(),uid='member')=>service(uid,{action,accountUid:uid,operationId,...data},uid==='owner'?owner:{}),estimate=()=>call('estimateShipment',{itemIds:[id],address}),pay=(q,op=randomUUID(),extra={})=>call('checkoutShipment',{quoteId:q.quoteId,rateId:q.rates[0].id,expectedCents:q.rates[0].amountCents,...extra},op),read=p=>db.runTransaction(async tx=>(await tx.get(db.doc(p))).data()),patch=(p,data)=>db.runTransaction(tx=>tx.update(db.doc(p),data));
 return{db,id,config,call,estimate,pay,read,patch,advance:n=>time+=n,counts:()=>({buys,quotes})};
}
test('carrier markup is server-priced and popup checkout atomically pays, reserves items and submits one paid shipment',async()=>{
 const f=await fixture(),q=await f.estimate();assert.equal(q.rates[0].carrierAmountCents,499);assert.equal(q.rates[0].markupCents,100);assert.equal(q.rates[0].amountCents,599);
 assert.equal((await f.db.collection('shippingQueue/root/requests').get()).size,0);assert.equal((await f.read('testAccounts/member/items/'+f.id)).status,'available');
 const op=randomUUID(),[a,b]=await Promise.all([f.pay(q,op),f.pay(q,op)]);assert.deepEqual(a,b);assert.deepEqual(await f.pay(q),a);
 const wallet=await f.read('testAccounts/member'),shipment=await f.read('testAccounts/member/shipments/'+a.shipmentId);assert.equal(wallet.balanceCents,1401);assert.equal(wallet.sparkUnits,123);assert.equal(wallet.referralPurchasedSpendCents,100);assert.equal(shipment.feeStatus,'paid');assert.equal(shipment.shippingPaidCents,599);assert.equal(shipment.address.postalCode,'46204');assert.equal(shipment.paidRate.id,q.rates[0].id);assert.equal((await f.db.collection('shippingQueue/root/requests').get()).size,1);assert.equal((await f.read('testAccounts/member/items/'+f.id)).shipmentId,a.shipmentId);assert.equal(f.counts().buys,0);
 await assert.rejects(()=>f.pay(q,op,{expectedCents:1}),e=>e.code==='already-exists');
});
test('canceling a quote needs no mutation; recalculating later leaves items free and charges only on approval',async()=>{
 const f=await fixture(),q=await f.estimate();f.advance(16*60000);await assert.rejects(()=>f.pay(q),e=>e.code==='failed-precondition');assert.equal((await f.read('testAccounts/member')).balanceCents,2000);assert.equal((await f.read('testAccounts/member/items/'+f.id)).status,'available');assert.equal((await f.db.collection('shippingQueue/root/requests').get()).size,0);const fresh=await f.estimate();await f.pay(fresh);assert.equal((await f.read('testAccounts/member')).balanceCents,1401);
});
test('payment failures, forged rates, settings changes and stale items cannot enqueue or reserve shipments',async()=>{
 for(const reason of ['balance','price','rate','version','hold','closure','disabled','sold','changed','other-user']){
  const f=await fixture(),q=await f.estimate();let extra={};
  if(reason==='balance')await f.patch('testAccounts/member',{balanceCents:0,creditBuckets:{purchasedCents:0,promotionalCents:0,sellbackCents:0,legacyTestCents:0}});
  if(reason==='price')extra.expectedCents=1;if(reason==='rate')extra.rateId='fake';
  if(reason==='version')await f.patch('shippingSettings/config',{version:2,markupBps:2000});
  if(reason==='disabled')await f.patch('shippingSettings/config',{labelsEnabled:false});
  if(reason==='hold')await f.patch('testAccounts/member',{legacyPaymentHold:true});
  if(reason==='closure')await f.db.runTransaction(tx=>tx.set(f.db.doc('accountClosureState/member'),{status:'requested'}));
  if(reason==='sold')await f.patch('testAccounts/member/items/'+f.id,{status:'sold'});
  if(reason==='changed')await f.patch('testAccounts/member/items/'+f.id,{valueCents:200});
  await assert.rejects(()=>reason==='other-user'?f.call('checkoutShipment',{quoteId:q.quoteId,rateId:q.rates[0].id,expectedCents:599},randomUUID(),'other'):f.pay(q,randomUUID(),extra));
  assert.equal((await f.db.collection('shippingQueue/root/requests').get()).size,0,reason);assert.equal((await f.db.collection('testAccounts/member/shipments').get()).size,0,reason);assert.equal((await f.read('testAccounts/member/items/'+f.id)).status,reason==='sold'?'sold':'available',reason);assert.equal((await f.read('testAccounts/member')).balanceCents,reason==='balance'?0:2000,reason);
 }
});
test('overlapping quotes from different checkouts cannot pay or submit the same items twice',async()=>{
 const f=await fixture(),a=await f.estimate(),b=await f.estimate();const results=await Promise.allSettled([f.pay(a),f.pay(b)]);assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal((await f.read('testAccounts/member')).balanceCents,1401);assert.equal((await f.db.collection('shippingQueue/root/requests').get()).size,1);
});
test('markup validation defaults to zero; manual prices are unchanged and paid totals refund their original sources',async()=>{
 const f=await fixture();assert.equal(cleanShippingConfig({...f.config,markupBps:undefined,handlingCents:undefined}).markupBps,0);for(const patch of [{markupBps:-1},{markupBps:10001},{markupBps:1.5},{handlingCents:10001}])assert.throws(()=>cleanShippingConfig({...f.config,...patch}));
 const q=await f.estimate(),paid=await f.pay(q);await f.call('adminRefundShippingFee',{customerUid:'member',shipmentId:paid.shipmentId},randomUUID(),'owner');assert.equal((await f.read('testAccounts/member')).balanceCents,2000);assert.equal((await f.read('testAccounts/member/items/'+f.id)).status,'available');
 await f.patch('shippingSettings/config',{rateMode:'manual',manualRates:[{maxOz:64,amountCents:700}],version:2});assert.equal((await f.estimate()).rates[0].amountCents,700);
});
test('legacy unpaid requests cannot advance to packing or dispatch through admin',async()=>{
 const f=await fixture(),id=randomUUID(),run=accountService(f.db,{mode:'live'});await f.db.runTransaction(tx=>tx.set(f.db.doc('testAccounts/member/shipments/'+id),{status:'review',version:0}));
 for(const status of ['packing','shipped'])await assert.rejects(()=>run('owner',{action:'updateShipment',customerUid:'member',shipmentId:id,status,expectedVersion:0,carrier:'USPS',trackingNumber:'9400000000000000000000',operationId:randomUUID()},owner),e=>e.code==='failed-precondition'&&e.message.includes('paid'));
 await assert.rejects(()=>run('member',{action:'ship',itemIds:[f.id],address,operationId:randomUUID()}),e=>e.code==='failed-precondition');assert.equal((await f.read('testAccounts/member/items/'+f.id)).status,'available');
});
