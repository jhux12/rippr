import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {memoryDatabase} from './helpers/memory-database.mjs';
import {scopedDatabase} from '../functions/runtime-mode.js';
import {initialLiveWallet} from '../functions/wallet-ledger.js';
import {eligibleDeposit} from '../functions/reward-model.js';
import {OWNER_PHONE} from '../functions/catalog-model.js';
import {accountService} from '../functions/service.js';
const owner='promo-owner',claims={sub:owner,phone_number:OWNER_PHONE};
async function setup(){
 const root=memoryDatabase(),db=scopedDatabase(root,'live'),wallet={...initialLiveWallet(),sparkUnits:500,depositCents:0,referralPurchasedSpendCents:0};
 await root.runTransaction(tx=>tx.set(root.doc('liveAccounts/'+owner),wallet));
 return{root,db,run:accountService(db,{mode:'live',now:()=>1800000000000}),read:p=>root.runTransaction(tx=>tx.get(root.doc(p))),write:(p,v)=>root.runTransaction(tx=>tx.set(root.doc(p),v))};
}
const input=(extra={})=>({action:'adminGrantPromoCredit',accountUid:owner,operationId:randomUUID(),amountCents:1000,note:'Testing pack opening flow',...extra});
test('owner grants audited live promotional credit once, without deposit/Spark/referral rewards',async()=>{
 const f=await setup(),request=input();const first=await f.run(owner,request,claims);assert.equal(first.balanceCents,1000);assert.deepEqual(await f.run(owner,request,claims),first);
 const w=(await f.read('liveAccounts/'+owner)).data();assert.equal(w.creditBuckets.promotionalCents,1000);assert.equal(w.creditBuckets.purchasedCents,0);assert.equal(w.creditRevision,1);assert.equal(w.sparkUnits,500);assert.equal(w.depositCents,0);assert.equal(w.referralPurchasedSpendCents,0);assert.equal(w.firstVerifiedDepositAtMs,undefined);assert.equal(w.lastVerifiedDepositAtMs,undefined);assert.equal(eligibleDeposit(w),false);
 assert.equal((await f.read(`liveAccounts/${owner}/creditLedger/${request.operationId}`)).data().kind,'owner-promotional-credit');assert.equal((await f.read(`livePaymentAuditByAccount/${owner}/entries/${request.operationId}`)).data().note,request.note);
 await assert.rejects(()=>f.run(owner,{...request,amountCents:2000},claims),e=>e.code==='already-exists');
 assert.equal((await f.read('testAccounts/'+owner)).exists,false);
});
test('promo credit rejects nonowners, forged owner identity, cross-account targets and sandbox mode',async()=>{
 const f=await setup();
 for(const token of [{},{sub:'someone',phone_number:OWNER_PHONE},{sub:owner,phone_number:'+12015550123'}])await assert.rejects(()=>f.run(owner,input(),token),e=>e.code==='permission-denied');
 await assert.rejects(()=>f.run(owner,input({customerUid:'other'}),claims),e=>e.code==='permission-denied');
 await assert.rejects(()=>f.run(owner,input({accountUid:'other'}),claims),e=>e.code==='unauthenticated');
 await assert.rejects(()=>accountService(f.root)(owner,input(),claims),e=>e.code==='failed-precondition');
});
test('promo credit validates limits, refuses inconsistent wallets, holds and closures',async()=>{
 const f=await setup();for(const patch of [{amountCents:0},{amountCents:10001},{amountCents:1.5},{note:'short'},{operationId:'bad'}])await assert.rejects(()=>f.run(owner,input(patch),claims),e=>e.code==='invalid-argument');
 const original=(await f.read('liveAccounts/'+owner)).data();
 for(const patch of [{balanceCents:1000},{paymentHold:true},{legacyPaymentHold:true},{paymentDebtCents:100},{paymentReviewCount:1}]){await f.write('liveAccounts/'+owner,{...original,...patch});await assert.rejects(()=>f.run(owner,input(),claims),e=>e.code==='failed-precondition')}
 await f.write('liveAccounts/'+owner,original);await f.write('liveAccountClosureState/'+owner,{status:'completed'});await assert.rejects(()=>f.run(owner,input(),claims),e=>e.code==='failed-precondition');
});
test('daily promotional cap counts successful grants once even on concurrent retries',async()=>{
 const f=await setup(),request=input({amountCents:10000});await Promise.all([f.run(owner,request,claims),f.run(owner,request,claims)]);
 for(let i=0;i<4;i++)await f.run(owner,input({amountCents:10000}),claims);
 await assert.rejects(()=>f.run(owner,input(),claims),e=>e.code==='failed-precondition'&&e.message.includes('$500'));
 assert.equal((await f.read('liveAccounts/'+owner)).data().balanceCents,50000);
 assert.equal((await f.run(owner,request,claims)).balanceCents,10000);
});

test('promotional owner credit opens real inventory without earning purchase points or deposit eligibility',async()=>{
 const f=await setup(),{defaultPack}=await import('../functions/catalog-model.js');
 const w=(await f.read('liveAccounts/'+owner)).data();await f.write('liveAccounts/'+owner,{...w,packsOpened:0,cardsCollected:0,grailsFound:0});
 await f.write('packContents/basic',{...defaultPack('basic'),priceCents:100,enabled:true,version:1});
 await f.run(owner,input(),claims);
 const result=await f.run(owner,{action:'purchase',accountUid:owner,operationId:randomUUID(),packId:'basic',quantity:1,expectedPriceCents:100,expectedVersion:1},claims);
 assert.equal(result.cards.length,1);assert.equal(result.cards[0].testItem,false);assert.equal(result.balanceCents,900);
 const after=(await f.read('liveAccounts/'+owner)).data();assert.equal(after.creditBuckets.promotionalCents,900);assert.equal(after.sparkUnits,500);assert.equal(after.referralPurchasedSpendCents,0);assert.equal(eligibleDeposit(after),false);
 assert.equal((await f.read(`liveAccounts/${owner}/items/${result.cards[0].id}`)).data().status,'available');
});
