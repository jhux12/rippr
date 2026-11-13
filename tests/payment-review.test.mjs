import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {memoryDatabase} from './helpers/memory-database.mjs';
import {accountService} from '../functions/service.js';
import {applyStripeEvent} from '../functions/stripe-service.js';
import {paymentReviewService} from '../functions/payment-review-service.js';
import {initialLiveWallet,readCredits,calculateCredits} from '../functions/wallet-ledger.js';
import {OWNER_PHONE} from '../functions/catalog-model.js';
const deny=code=>e=>e.code===code;
async function fixture({purchased=500,legacy=0,credited=true,refund=500}={}){
 const db=memoryDatabase(),id=randomUUID(),uid='buyer',owner='owner';let time=10000000;
 const session={id:'cs_test_review',livemode:false,mode:'payment',payment_status:'paid',currency:'usd',client_reference_id:uid,amount_subtotal:500,amount_total:500,total_details:{amount_tax:0},payment_intent:'pi_review',metadata:{namespace:'rippr-sandbox-balance-v1',uid,topupId:id}};
 const charge={id:'ch_review',livemode:false,currency:'usd',amount:500,amount_refunded:refund,disputed:false,status:'succeeded',payment_intent:'pi_review'};
 const stripe={checkout:{sessions:{retrieve:async()=>session}},paymentIntents:{retrieve:async()=>({livemode:false,currency:'usd',amount:500,metadata:session.metadata,latest_charge:charge})},charges:{retrieve:async()=>charge},disputes:{retrieve:async()=>({id:'dp_review',livemode:false,charge:charge.id,status:'won'})}};
 const set=(path,data)=>db.runTransaction(async tx=>tx.set(db.doc(path),data)),get=path=>db.runTransaction(async tx=>(await tx.get(db.doc(path))).data());
 await set('testAccounts/'+uid,{currency:'TEST_USD',balanceCents:purchased+legacy,creditBuckets:{purchasedCents:purchased,promotionalCents:0,sellbackCents:0,legacyTestCents:legacy},creditLedgerVersion:1,creditRevision:1});
 await set(`testAccounts/${uid}/stripeTestTopups/${id}`,{uid,amountCents:500,sessionId:session.id,status:credited?'credited':'pending',automaticTax:false,paymentIntentId:'pi_review',...(credited?{creditedAtMs:time}:{})});
 const call=(action,data={},op=randomUUID(),claims={sub:owner,phone_number:OWNER_PHONE})=>paymentReviewService(db,stripe,owner,{action,accountUid:owner,operationId:op,...data},claims,{now:()=>time});
 const open=async()=>{time++;await applyStripeEvent(db,stripe,{id:'evt_'+randomUUID().replaceAll('-',''),livemode:false,type:'charge.refunded',data:{object:charge}},{now:()=>time})};
 const inspect=()=>call('adminPaymentInspect',{customerUid:uid,topupId:id});
 const resolve=async(resolution,op=randomUUID(),extra={})=>{const detail=await inspect();return call('adminPaymentResolve',{customerUid:uid,topupId:id,resolution,note:'Reviewed canonical sandbox payment in Stripe.',expectedVersion:detail.review.version,expectedWalletRevision:detail.wallet.revision,...extra},op)};
 return{db,id,uid,session,charge,stripe,call,set,get,open,inspect,resolve};
}
test('live wallet foundation starts at zero and cannot import test balance or legacy credit',()=>{
 const live=initialLiveWallet();assert.equal(live.balanceCents,0);assert.equal(live.currency,'USD');assert.throws(()=>readCredits({currency:'TEST_USD',balanceCents:500},{mode:'live'}));assert.throws(()=>readCredits({currency:'USD',balanceCents:500},{mode:'live'}));assert.throws(()=>calculateCredits(live,[{bucket:'legacyTestCents',cents:1}],{mode:'live'}));assert.equal(calculateCredits(live,[{bucket:'purchasedCents',cents:500}],{mode:'live'}).balanceCents,500);
});
test('legacy test balance stays legacy while newly sourced credits and spend remain auditable',async()=>{
 const db=memoryDatabase(),run=accountService(db);await db.runTransaction(async tx=>tx.set(db.doc('testAccounts/alice'),{currency:'TEST_USD',balanceCents:500,packsOpened:0,cardsCollected:0,grailsFound:0}));
 await run('alice',{action:'topup',amountCents:1000,operationId:randomUUID()});let wallet=await db.runTransaction(async tx=>(await tx.get(db.doc('testAccounts/alice'))).data());assert.deepEqual(wallet.creditBuckets,{purchasedCents:0,promotionalCents:1000,sellbackCents:0,legacyTestCents:500});
 await run('alice',{action:'purchase',packId:'basic',quantity:3,expectedPriceCents:199,expectedVersion:0,operationId:randomUUID()});wallet=await db.runTransaction(async tx=>(await tx.get(db.doc('testAccounts/alice'))).data());assert.equal(wallet.balanceCents,903);assert.equal(wallet.creditBuckets.legacyTestCents,0);assert.equal(wallet.creditBuckets.promotionalCents,903);assert.equal(wallet.creditRevision,2);assert.equal((await db.doc('testAccounts/alice').collection('creditLedger').orderBy('revision').get()).docs.length,3);
});
test('ordinary members cannot inspect or resolve payment reviews',async()=>{
 const f=await fixture();for(const action of ['adminPaymentReviews','adminPaymentInspect','adminPaymentResolve','adminPaymentWallet','adminSandboxDebtWaive'])await assert.rejects(()=>f.call(action,{customerUid:f.uid,topupId:f.id},randomUUID(),{sub:'owner',phone_number:'+12025550123'}),deny('permission-denied'));
});
test('full refund removes purchased credit once and does not touch legacy test credit',async()=>{
 const f=await fixture({legacy:200});await f.open();const first=await f.inspect();assert.equal(first.wallet.reviewCount,1);const op=randomUUID(),data={customerUid:f.uid,topupId:f.id,resolution:'record-refund',note:'Refund confirmed in the Stripe sandbox dashboard.',expectedVersion:first.review.version,expectedWalletRevision:first.wallet.revision};
 await f.call('adminPaymentResolve',data,op);await f.call('adminPaymentResolve',data,op);let wallet=await f.get('testAccounts/'+f.uid);assert.equal(wallet.balanceCents,200);assert.equal(wallet.creditBuckets.purchasedCents,0);assert.equal(wallet.creditBuckets.legacyTestCents,200);assert.equal(wallet.paymentHold,false);
 await applyStripeEvent(f.db,f.stripe,{id:'evt_latepayment',livemode:false,type:'checkout.session.completed',data:{object:{id:f.session.id}}});await f.open();wallet=await f.get('testAccounts/'+f.uid);assert.equal(wallet.balanceCents,200);assert.equal(wallet.paymentReviewCount,0);
});
test('spent purchased credit becomes debt; only explicit sandbox write-off clears the hold',async()=>{
 const f=await fixture({purchased:100});await f.open();const result=await f.resolve('record-refund');assert.equal(result.remainingDebtCents,400);assert.equal(result.hold,true);let wallet=await f.get('testAccounts/'+f.uid);assert.equal(wallet.balanceCents,0);
 await f.call('adminSandboxDebtWaive',{customerUid:f.uid,note:'Write off the remaining sandbox-only refund test debt.',expectedWalletRevision:wallet.creditRevision});wallet=await f.get('testAccounts/'+f.uid);assert.equal(wallet.paymentDebtCents,0);assert.equal(wallet.paymentHold,false);assert.equal(wallet.balanceCents,0);
});
test('uncredited refunded payments remain uncredited even after a late completion event',async()=>{
 const f=await fixture({purchased:0,credited:false});await f.open();await f.resolve('record-refund');await applyStripeEvent(f.db,f.stripe,{id:'evt_afterrefund',livemode:false,type:'checkout.session.completed',data:{object:{id:f.session.id}}});assert.equal((await f.get('testAccounts/'+f.uid)).balanceCents,0);
});
test('release requires current Stripe evidence and optimistic versions prevent stale admin edits',async()=>{
 const f=await fixture({refund:0});await f.open();const detail=await f.inspect();await assert.rejects(()=>f.resolve('release-paid',randomUUID(),{expectedVersion:detail.review.version+1}),deny('failed-precondition'));
 f.charge.disputed=true;f.stripe.disputes.retrieve=async()=>({livemode:false,charge:f.charge.id,status:'needs_response'});await assert.rejects(()=>f.resolve('release-paid'),deny('failed-precondition'));
 f.charge.disputed=false;await f.resolve('release-paid');assert.equal((await f.get('testAccounts/'+f.uid)).paymentHold,false);assert.equal((await f.get('testAccounts/'+f.uid)).balanceCents,500);
});
test('multiple payment reviews keep the wallet held until each case is resolved',async()=>{
 const f=await fixture({refund:0});await f.open();await f.set('testAccounts/'+f.uid,{...(await f.get('testAccounts/'+f.uid)),paymentReviewCount:2});await f.resolve('release-paid');assert.equal((await f.get('testAccounts/'+f.uid)).paymentHold,true);assert.equal((await f.get('testAccounts/'+f.uid)).paymentReviewCount,1);
});

test('partial refunds reconcile only the new principal and duplicate cumulative events stay closed',async()=>{
 const f=await fixture({refund:200});await f.open();await f.resolve('record-refund');assert.equal((await f.get('testAccounts/'+f.uid)).balanceCents,300);await f.open();assert.equal((await f.get('testAccounts/'+f.uid)).paymentReviewCount,0);
 f.charge.amount_refunded=500;await f.open();await f.resolve('record-refund');assert.equal((await f.get('testAccounts/'+f.uid)).balanceCents,0);assert.equal((await f.inspect()).history.length,2);
});
test('won disputes can be released and lost disputes must be reconciled',async()=>{
 for(const status of ['won','lost']){
  const f=await fixture({refund:0});f.charge.disputed=true;f.stripe.disputes.retrieve=async()=>({livemode:false,charge:f.charge.id,status});await applyStripeEvent(f.db,f.stripe,{id:'evt_dispute'+status,type:'charge.dispute.created',livemode:false,data:{object:{id:'dp_review',charge:f.charge.id}}});
  if(status==='won'){await f.resolve('release-paid');assert.equal((await f.get('testAccounts/'+f.uid)).balanceCents,500)}else{await assert.rejects(()=>f.resolve('release-paid'),deny('failed-precondition'));await f.resolve('record-refund');assert.equal((await f.get('testAccounts/'+f.uid)).balanceCents,0)}
 }
});
test('an uncredited paid payment can be credited through review exactly once',async()=>{
 const f=await fixture({purchased:0,credited:false,refund:0});await f.open();await f.resolve('credit-paid');const wallet=await f.get('testAccounts/'+f.uid);assert.equal(wallet.creditBuckets.purchasedCents,500);assert.equal(wallet.paymentHold,false);await applyStripeEvent(f.db,f.stripe,{id:'evt_reviewedcredit',type:'checkout.session.completed',livemode:false,data:{object:{id:f.session.id}}});assert.equal((await f.get('testAccounts/'+f.uid)).balanceCents,500);
});
test('review and ledger cursors reach older records without silent first-page limits',async()=>{
 const f=await fixture();for(let i=0;i<27;i++)await f.set('paymentReviewQueue/root/cases/case-'+i,{uid:f.uid,topupId:f.id,status:'resolved',updatedAtMs:10000+i,version:1});
 const first=await f.call('adminPaymentReviews');assert.equal(first.cases.length,25);assert(first.hasMore);const second=await f.call('adminPaymentReviews',{cursor:first.cursor});assert.equal(second.cases.length,2);assert.equal(second.hasMore,false);assert.equal(new Set([...first.cases,...second.cases].map(c=>c.id)).size,27);
 for(let i=1;i<=27;i++)await f.set('testAccounts/'+f.uid+'/creditLedger/entry-'+i,{revision:i,kind:'fixture',balanceAfterCents:500,delta:{purchasedCents:0},atMs:i});
 const a=await f.call('adminPaymentWallet',{customerUid:f.uid});assert.equal(a.ledger.length,25);const b=await f.call('adminPaymentWallet',{customerUid:f.uid,beforeRevision:a.beforeRevision});assert.equal(b.ledger.length,2);
});
