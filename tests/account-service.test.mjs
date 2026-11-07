import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { accountService } from '../functions/service.js';
import { defaultPack } from '../functions/catalog-model.js';
import { memoryDatabase } from './helpers/memory-database.mjs';

let db, app;
if(process.env.FIRESTORE_EMULATOR_HOST){
  const { initializeApp, deleteApp }=await import('../functions/node_modules/firebase-admin/lib/app/index.js');
  const { getFirestore }=await import('../functions/node_modules/firebase-admin/lib/firestore/index.js');
  app=initializeApp({projectId:'demo-rippr'});db=getFirestore(app);after(()=>deleteApp(app));
}else db=memoryDatabase();
const run=accountService(db);
const act=(uid,action,data={},id=randomUUID())=>run(uid,{action,...data,operationId:id});
const user=()=>randomUUID();
const purchase=(uid,data={},id)=>act(uid,'purchase',{packId:'basic',quantity:1,expectedPriceCents:199,expectedVersion:0,...data},id);
const snapshot=uid=>act(uid,'snapshot');
const code=expected=>error=>error.code===expected;

test('requires authentication and denies arbitrary actions and invalid amounts',async()=>{
 await assert.rejects(()=>act(null,'topup',{amountCents:1000}),code('unauthenticated'));
 await assert.rejects(()=>act(user(),'topup',{amountCents:1000,accountUid:'previous-account'}),code('unauthenticated'));
 for(const amountCents of [-1,0,99,100001,1.5,'1000',NaN])await assert.rejects(()=>act(user(),'topup',{amountCents}),code('invalid-argument'));
 await assert.rejects(()=>act(user(),'setBalance',{balanceCents:999999}),code('invalid-argument'));
 const disabled=accountService(db,{freeTopups:()=>false});
 await assert.rejects(()=>disabled(user(),{action:'topup',amountCents:1000,operationId:randomUUID()}),code('failed-precondition'));
});
test('test credit is persistent, bounded and an identical retry credits exactly once',async()=>{
 const uid=user(),id=randomUUID();
 await act(uid,'topup',{amountCents:1000},id);await act(uid,'topup',{amountCents:1000},id);
 assert.equal((await snapshot(uid)).account.balanceCents,1000);
 await assert.rejects(()=>act(uid,'topup',{amountCents:2000},id),code('already-exists'));
});
test('a purchase charges server price and persists exactly one card per pack before revealing',async()=>{
 const uid=user();await act(uid,'topup',{amountCents:10000});const id=randomUUID();
 const first=await purchase(uid,{quantity:3},id);const retry=await purchase(uid,{quantity:3},id);
 assert.deepEqual(retry,first);assert.equal(first.cards.length,3);assert.equal(first.totalCents,597);
 const saved=await snapshot(uid);assert.equal(saved.account.balanceCents,9403);assert.equal(saved.items.length,3);
 assert.equal(saved.account.packsOpened,3);assert.equal(saved.account.cardsCollected,3);
 assert.ok(saved.items.every(i=>i.status==='available'&&i.testItem&&i.packId==='basic'));
});
test('insufficient credit, invalid quantities and price tampering never award items or debit',async()=>{
 const uid=user();await assert.rejects(()=>purchase(uid),code('resource-exhausted'));
 await act(uid,'topup',{amountCents:1000});
 await assert.rejects(()=>purchase(uid,{expectedPriceCents:0}),code('failed-precondition'));
 await assert.rejects(()=>purchase(uid,{expectedVersion:999}),code('failed-precondition'));
 for(const quantity of [0,6,1.5,'1'])await assert.rejects(()=>purchase(uid,{quantity}),code('invalid-argument'));
 const saved=await snapshot(uid);assert.equal(saved.items.length,0);assert.equal(saved.account.balanceCents,1000);
});
test('concurrent duplicate requests and purchases cannot spend a balance twice',async()=>{
 const uid=user();await act(uid,'topup',{amountCents:199});
 const results=await Promise.allSettled([purchase(uid),purchase(uid)]);
 assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
 assert.equal((await snapshot(uid)).account.balanceCents,0);assert.equal((await snapshot(uid)).items.length,1);
 const uid2=user(),id=randomUUID();await act(uid2,'topup',{amountCents:500});
 await Promise.all([purchase(uid2,{},id),purchase(uid2,{},id)]);
 assert.equal((await snapshot(uid2)).items.length,1);
});
test('sales use saved values, cannot double sell, and cannot sell another account’s card',async()=>{
 const uid=user(),other=user();await act(uid,'topup',{amountCents:1000});const bought=await purchase(uid);
 const item=bought.cards[0],id=randomUUID();
 await assert.rejects(()=>act(other,'sell',{itemIds:[item.id]}),code('failed-precondition'));
 const sold=await act(uid,'sell',{itemIds:[item.id],valueCents:999999},id);
 assert.equal(sold.soldCents,item.valueCents);assert.equal(sold.balanceCents,801+item.valueCents);
 await act(uid,'sell',{itemIds:[item.id],valueCents:999999},id);
 await assert.rejects(()=>act(uid,'sell',{itemIds:[item.id]}),code('failed-precondition'));
 assert.equal((await snapshot(uid)).items[0].status,'sold');
 assert.equal((await snapshot(other)).items.length,0);
});
test('shipping saves a test request atomically, blocks sale and cannot access another account',async()=>{
 const uid=user();await act(uid,'topup',{amountCents:1000});const cards=(await purchase(uid,{quantity:2})).cards;
 const ids=cards.map(c=>c.id);await act(uid,'ship',{itemIds:ids});
 const saved=await snapshot(uid);assert.ok(saved.items.every(i=>i.status==='shipping'));assert.equal(saved.account.balanceCents,602);
 await assert.rejects(()=>act(uid,'sell',{itemIds:ids}),code('failed-precondition'));
 await assert.rejects(()=>act(user(),'ship',{itemIds:ids}),code('failed-precondition'));
});
test('catalog enablement and custom prices are enforced independently of the browser',async()=>{
 const uid=user();await act(uid,'topup',{amountCents:1000});
 const pack=defaultPack('plus');pack.version=1;pack.priceCents=250;pack.enabled=false;
 await db.runTransaction(async tx=>tx.set(db.doc('packContents/plus'),pack));
 await assert.rejects(()=>purchase(uid,{packId:'plus',expectedPriceCents:250,expectedVersion:1}),code('failed-precondition'));
 pack.enabled=true;await db.runTransaction(async tx=>tx.set(db.doc('packContents/plus'),pack));
 await assert.rejects(()=>purchase(uid,{packId:'plus',expectedPriceCents:499,expectedVersion:1}),code('failed-precondition'));
 assert.equal((await purchase(uid,{packId:'plus',expectedPriceCents:250,expectedVersion:1})).totalCents,250);
});
test('profile changes are limited to display fields and activity is persisted',async()=>{
 const uid=user();await act(uid,'topup',{amountCents:1000});
 await act(uid,'profile',{displayName:'Jamie',handle:'jamie',balanceCents:1000000,isAdmin:true});
 const saved=await snapshot(uid);assert.equal(saved.account.displayName,'Jamie');assert.equal(saved.account.balanceCents,1000);assert.equal(saved.account.isAdmin,undefined);assert.equal(saved.activity.length,1);
 await assert.rejects(()=>act(uid,'profile',{displayName:'Jamie',handle:'bad handle'}),code('invalid-argument'));
});
