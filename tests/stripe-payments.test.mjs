import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import Stripe from '../functions/node_modules/stripe/esm/stripe.esm.node.js';
import {stripeService,applyStripeEvent,requireTestKey,stripeConfig} from '../functions/stripe-service.js';
import {accountService} from '../functions/service.js';
import {memoryDatabase} from './helpers/memory-database.mjs';
const config={enabled:true,siteUrl:'https://www.rippr.gg',automaticTax:false};
function fixture(tax=false){
 const db=memoryDatabase(),sessions=new Map(),keys=new Map();let creates=0,lost=false,time=1800000000000;
 const stripe={checkout:{sessions:{create:async(request,options)=>{assert(!Object.hasOwn(request,'payment_method_types'),'Current API uses Dashboard-managed payment methods');creates++;if(keys.has(options.idempotencyKey))return sessions.get(keys.get(options.idempotencyKey));const id='cs_test_fixture'+creates,session={...request,id,url:'https://checkout.stripe.com/c/pay/'+id,livemode:false,expires_at:request.expires_at,currency:'usd',status:'open',payment_status:'unpaid',amount_subtotal:request.line_items[0].price_data.unit_amount,amount_total:request.line_items[0].price_data.unit_amount+(tax?123:0),total_details:{amount_tax:tax?123:0},payment_intent:'pi_fixture'+creates};keys.set(options.idempotencyKey,id);sessions.set(id,session);if(lost){lost=false;throw new Error('Response lost')}return session},retrieve:async id=>{const session=sessions.get(id);if(!session)throw new Error('Unknown session');return session}}},paymentIntents:{retrieve:async id=>{const session=[...sessions.values()].find(s=>s.payment_intent===id);return{livemode:false,metadata:session.metadata}}},charges:{retrieve:async()=>({payment_intent:[...sessions.values()][0].payment_intent})}};
 const run=stripeService(db,{getStripe:()=>stripe,options:()=>({...config,automaticTax:tax,taxCode:tax?'txcd_99999999':''}),now:()=>time});
 const set=(path,value)=>db.runTransaction(async tx=>tx.set(db.doc(path),value));const get=path=>db.runTransaction(async tx=>(await tx.get(db.doc(path))).data());
 const checkout=async(uid='alice',amountCents=2500,id=randomUUID())=>{const result=await run(uid,{action:'checkout',operationId:id,amountCents,accountUid:uid});return{...result,id,session:[...sessions.values()].find(s=>s.metadata.topupId===id)}};
 const event=(session,type='checkout.session.completed',id='evt_'+randomUUID().replaceAll('-',''))=>({id,type,livemode:false,data:{object:{id:session.id}}});
 const apply=event=>applyStripeEvent(db,stripe,event,{now:()=>time});
 return{db,stripe,sessions,run,set,get,checkout,event,apply,now:()=>time,advance:n=>time+=n,creates:()=>creates,lose:()=>lost=true,seed:()=>set('testAccounts/alice',{balanceCents:0,currency:'TEST_USD',displayName:'Alice'})};
}
test('requires authenticated ownership, bounded integer amounts, test keys and explicit tax code',async()=>{
 const f=fixture();await f.seed();await assert.rejects(()=>f.run(null,{action:'checkout'}),e=>e.code==='unauthenticated');
 await assert.rejects(()=>f.run('alice',{action:'checkout',accountUid:'bob'}),e=>e.code==='unauthenticated');
 for(const amountCents of [0,99,1.5,'2500',100001])await assert.rejects(()=>f.checkout('alice',amountCents),e=>e.code==='invalid-argument');
 assert.throws(()=>requireTestKey('sk_live_fixture'));assert.throws(()=>requireTestKey('pk_test_fixture'));assert.equal(requireTestKey('sk_test_fixture'),'sk_test_fixture');
 assert.throws(()=>stripeConfig({...config,automaticTax:true,taxCode:''}));assert.throws(()=>stripeConfig({...config,siteUrl:'http://evil.test'}));
 assert.equal(f.creates(),0);
});
test('server Checkout request fixes currency/amount/return origin and retries a lost response without a second session',async()=>{
 const f=fixture();await f.seed();const id=randomUUID();f.lose();await assert.rejects(()=>f.checkout('alice',2500,id));
 const opened=await f.checkout('alice',2500,id);assert.equal(f.sessions.size,1);assert.equal(opened.session.currency,'usd');assert.equal(opened.session.client_reference_id,'alice');assert.equal(opened.session.amount_subtotal,2500);assert.equal(opened.session.automatic_tax.enabled,false);assert(opened.session.success_url.startsWith('https://www.rippr.gg/payment-success.html?'));assert.equal(opened.session.cancel_url,'https://www.rippr.gg/payment-canceled.html');assert.equal((await f.get('testAccounts/alice')).balanceCents,0);
 await assert.rejects(()=>f.checkout('alice',5000,id),e=>e.code==='already-exists');
 await assert.rejects(()=>f.run('bob',{action:'status',topupId:id}),e=>e.code==='not-found');
});
test('paid signed-event processing credits once across duplicate/different event IDs and sets verified test deposit metadata',async()=>{
 const f=fixture();await f.seed();const opened=await f.checkout();opened.session.payment_status='paid';opened.session.status='complete';
 const event=f.event(opened.session);await Promise.all([f.apply(event),f.apply(event)]);await f.apply(f.event(opened.session,'checkout.session.async_payment_succeeded'));
 const wallet=await f.get('testAccounts/alice');assert.equal(wallet.balanceCents,2500);assert.equal(wallet.firstVerifiedDepositAtMs,f.now());assert.equal(wallet.firstVerifiedDepositMode,'stripe-test');assert.equal((await f.run('alice',{action:'status',topupId:opened.id})).status,'credited');
});
test('unpaid, live, wrong currency/amount and foreign metadata never fund a balance',async()=>{
 for(const mutation of ['unpaid','live','currency','amount','metadata']){
  const f=fixture();await f.seed();const opened=await f.checkout();opened.session.payment_status='paid';const event=f.event(opened.session);
  if(mutation==='unpaid')opened.session.payment_status='unpaid';if(mutation==='live')event.livemode=true;if(mutation==='currency')opened.session.currency='eur';if(mutation==='amount')opened.session.amount_subtotal=1;if(mutation==='metadata')opened.session.metadata={namespace:'other'};
  try{await f.apply(event)}catch{}assert.equal((await f.get('testAccounts/alice')).balanceCents,0,mutation);
 }
});
test('Stripe Tax adds to the charge, never to spendable site credit',async()=>{
 const f=fixture(true);await f.seed();const opened=await f.checkout();assert.equal(opened.session.line_items[0].price_data.product_data.tax_code,'txcd_99999999');assert.equal(opened.session.line_items[0].price_data.tax_behavior,'exclusive');opened.session.payment_status='paid';await f.apply(f.event(opened.session));assert.equal((await f.get('testAccounts/alice')).balanceCents,2500);const job=await f.get('testAccounts/alice/stripeTestTopups/'+opened.id);assert.equal(job.taxCents,123);assert.equal(job.totalCents,2623);
});
test('refund/dispute puts the funded wallet on review hold and replay cannot restore spendability',async()=>{
 for(const type of ['charge.refunded','charge.dispute.created']){
  const f=fixture();await f.seed();const opened=await f.checkout();opened.session.payment_status='paid';await f.apply(f.event(opened.session));
  await f.apply({id:'evt_reversal'+randomUUID().replaceAll('-',''),type,livemode:false,data:{object:{payment_intent:opened.session.payment_intent,charge:'ch_fixture'}}});
  assert.equal((await f.get('testAccounts/alice')).paymentHold,true);assert.equal((await f.run('alice',{action:'status',topupId:opened.id})).status,'review');
  await f.apply(f.event(opened.session));assert.equal((await f.get('testAccounts/alice')).balanceCents,2500);
  const accounts=accountService(f.db);await assert.rejects(()=>accounts('alice',{action:'purchase',operationId:randomUUID(),packId:'basic',quantity:1,expectedPriceCents:199,expectedVersion:0}),e=>e.code==='failed-precondition');
 }
});
test('reversal arriving before completion prevents later funding',async()=>{
 const f=fixture();await f.seed();const opened=await f.checkout();opened.session.payment_status='paid';await f.apply({id:'evt_earlyrefund',type:'charge.refunded',livemode:false,data:{object:{payment_intent:opened.session.payment_intent}}});await f.apply(f.event(opened.session));assert.equal((await f.get('testAccounts/alice')).balanceCents,0);assert.equal((await f.get('testAccounts/alice')).paymentHold,true);
});
test('expired/failed Checkout never grants credit, and funding cap requires review rather than losing a paid event',async()=>{
 const f=fixture();await f.seed();const opened=await f.checkout();await f.apply(f.event(opened.session,'checkout.session.expired'));assert.equal((await f.run('alice',{action:'status',topupId:opened.id})).status,'expired');assert.equal((await f.get('testAccounts/alice')).balanceCents,0);
 const next=await f.checkout();next.session.payment_status='paid';await f.set('testAccounts/alice',{balanceCents:999999,currency:'TEST_USD'});await f.apply(f.event(next.session));assert.equal((await f.run('alice',{action:'status',topupId:next.id})).status,'review');assert.equal((await f.get('testAccounts/alice')).balanceCents,999999);
});
test('official Stripe SDK verifies the raw webhook body and rejects tampering/stale signatures',()=>{
 const stripe=new Stripe('sk_test_fixture'),secret='whsec_fixture',payload=JSON.stringify({id:'evt_signed',livemode:false,type:'checkout.session.completed',data:{object:{id:'cs_test_fixture'}}});
 const header=stripe.webhooks.generateTestHeaderString({payload,secret});assert.equal(stripe.webhooks.constructEvent(Buffer.from(payload),header,secret).id,'evt_signed');assert.throws(()=>stripe.webhooks.constructEvent(Buffer.from(payload+' '),header,secret));assert.throws(()=>stripe.webhooks.constructEvent(payload,stripe.webhooks.generateTestHeaderString({payload,secret,timestamp:1}),secret));
});

test('Stripe diagnostics distinguish setup failures without exposing provider payloads or secrets',async()=>{
 const {stripeFailure}=await import('../functions/stripe-errors.js');
 const fixture='secret-fixture-do-not-log';
 const failure=stripeFailure({type:'StripeInvalidRequestError',code:'parameter_unknown',param:'line_items[0][price_data]',requestId:'req_ABC123',statusCode:400,message:fixture,raw:{secret:fixture},headers:{Authorization:fixture}});
 assert.equal(failure.reason,'checkout');assert.equal(failure.reference,'req_ABC123');assert.equal(failure.param,'line_items[0][price_data]');assert(!JSON.stringify(failure).includes(fixture));
 assert.equal(stripeFailure({type:'StripeAuthenticationError'}).reason,'key');assert.equal(stripeFailure({code:'stripe-config-tax'}).reason,'tax');assert.equal(stripeFailure({code:'stripe-config-site'}).reason,'site');
 const injected=stripeFailure({type:fixture,code:fixture,param:'sk_test_bad',requestId:fixture,message:fixture});assert(!JSON.stringify(injected).includes(fixture));assert(!('param'in injected));
});


test('legacy unbound payment-method requests require a fresh intent without changing the old provider payload',async()=>{
 const f=fixture();await f.seed();const id=randomUUID(),request={mode:'payment',payment_method_types:['card']};
 await f.set('testAccounts/alice/stripeTestTopups/'+id,{uid:'alice',amountCents:500,status:'creating',createdAtMs:f.now(),request,automaticTax:false});
 await assert.rejects(()=>f.checkout('alice',500,id),e=>e.code==='failed-precondition'&&e.message.includes('click Continue to Stripe again'));
 assert.equal(f.creates(),0);assert.deepEqual((await f.get('testAccounts/alice/stripeTestTopups/'+id)).request,request);
 const fresh=await f.checkout('alice',500);assert(!Object.hasOwn(fresh.session,'payment_method_types'));assert.equal(fresh.session.amount_subtotal,500);
 fresh.session.payment_status='paid';await f.apply(f.event(fresh.session));assert.equal((await f.get('testAccounts/alice')).balanceCents,500);
});
