import { test, after, before } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { accountService } from '../functions/service.js';
import { defaultPack } from '../functions/catalog-model.js';
import { catalogDatabase as memoryDatabase } from './helpers/catalog-database.mjs';

let db, app;
if(process.env.FIRESTORE_EMULATOR_HOST){
  const { initializeApp, deleteApp }=await import('../functions/node_modules/firebase-admin/lib/app/index.js');
  const { getFirestore }=await import('../functions/node_modules/firebase-admin/lib/firestore/index.js');
  app=initializeApp({projectId:'demo-rippr'});db=getFirestore(app);after(()=>deleteApp(app));
}else db=memoryDatabase();
before(async()=>{if(process.env.FIRESTORE_EMULATOR_HOST)await db.doc('packContents/basic').set({...defaultPack('basic'),version:1})});
const run=accountService(db);
const act=(uid,action,data={},id=randomUUID())=>run(uid,{action,...data,operationId:id});
const user=()=>randomUUID();
const purchase=(uid,data={},id)=>act(uid,'purchase',{packId:'basic',quantity:1,expectedPriceCents:199,expectedVersion:1,...data},id);
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

test('settings protect wallet fields, persist preferences and snapshot shipping addresses',async()=>{
 const uid=user();await act(uid,'topup',{amountCents:1000});
 for(const patch of [{balanceCents:99999},{admin:true},{preferences:{soundEffects:'yes'}},{address:{fullName:'Missing street'}}])await assert.rejects(()=>act(uid,'settings',patch),code('invalid-argument'));
 const address={fullName:'Test Collector',line1:'123 Example St',line2:'',city:'Example',region:'IN',postalCode:'46000',country:'US'};
 const id=randomUUID(),patch={displayName:'Collector One',address,emailForUpdates:'collector@example.com',preferences:{emailUpdates:true,soundEffects:false}};
 await act(uid,'settings',patch,id);await act(uid,'settings',patch,id);
 let saved=await snapshot(uid);assert.equal(saved.account.balanceCents,1000);assert.equal(saved.account.displayName,'Collector One');assert.equal(saved.account.preferences.soundEffects,false);assert.equal(saved.account.preferences.shippingUpdates,true);
 const opened=await purchase(uid);const shipped=await act(uid,'ship',{itemIds:[opened.cards[0].id]});
 await act(uid,'settings',{address:{...address,line1:'456 New Address'}});
 saved=await snapshot(uid);const request=saved.shipments.find(s=>s.id===shipped.shipmentId);assert.equal(request.address.line1,'123 Example St');assert.equal(request.items[0].name,opened.cards[0].name);assert.equal(request.status,'test-request');assert.equal(saved.account.address.line1,'456 New Address');
 await assert.rejects(()=>act(uid,'settings',{emailForUpdates:''}),code('invalid-argument'));
});

test('shipping queue is owner-only and manual tracking updates are versioned, atomic and private',async()=>{
 const uid=user(),owner='shipping-owner',claims={sub:owner,phone_number:'+17654794230'};
 const admin=(action,data={},id=randomUUID())=>run(owner,{action,...data,operationId:id},claims);
 await act(uid,'topup',{amountCents:1000});const cards=(await purchase(uid)).cards;
 await assert.rejects(()=>act(uid,'ship',{itemIds:[cards[0].id],requireAddress:true}),code('invalid-argument'));
 assert.equal((await snapshot(uid)).items[0].status,'available');
 const address={fullName:'Test Person',line1:'123 Example St',city:'Example',region:'IN',postalCode:'46000',country:'US'};
 const request=await act(uid,'ship',{itemIds:[cards[0].id],address,requireAddress:true,estimateCents:1});
 for(const action of ['adminShipments','adminShipment','updateShipment'])await assert.rejects(()=>act(uid,action,{customerUid:uid,shipmentId:request.shipmentId}),code('permission-denied'));
 const rows=(await admin('adminShipments')).requests;assert.ok(rows.some(r=>r.id===request.shipmentId&&r.customerUid===uid));
 const data={customerUid:uid,shipmentId:request.shipmentId};
 let saved=(await admin('adminShipment',data)).request;assert.equal(saved.address.line1,address.line1);assert.equal(saved.estimateCents,null);
 await assert.rejects(()=>admin('updateShipment',{...data,status:'shipped',carrier:'',trackingNumber:'',expectedVersion:0}),code('invalid-argument'));
 const op=randomUUID(),patch={...data,status:'shipped',carrier:'Test Carrier',trackingNumber:'TEST-123',expectedVersion:0};
 await admin('updateShipment',patch,op);await admin('updateShipment',patch,op);
 await assert.rejects(()=>admin('updateShipment',{...patch,status:'delivered'}),code('failed-precondition'));
 const customer=await snapshot(uid);saved=customer.shipments.find(s=>s.id===request.shipmentId);assert.equal(saved.status,'shipped');assert.equal(saved.trackingNumber,'TEST-123');assert.equal(saved.version,1);assert.equal(customer.account.balanceCents,801);assert.equal(customer.activity.filter(a=>a.type==='shipping-update').length,1);
 await admin('updateShipment',{...patch,status:'delivered',expectedVersion:1});saved=(await admin('adminShipment',data)).request;assert.equal(saved.status,'delivered');assert.equal(saved.version,2);
});

test('private support tickets persist, enforce owner access and reject stale or cross-account replies',async()=>{
 const uid=user(),other=user(),owner='support-owner',claims={sub:owner,phone_number:'+17654794230'};
 const admin=(action,data={},id=randomUUID())=>run(owner,{action,...data,operationId:id},claims);
 const ticketId=randomUUID(),op=randomUUID(),payload={ticketId,name:'Test Collector',email:'test@example.com',topic:'shipping',requestNumber:'#RP-TEST',message:'Please help with my request.',attachment:`support-attachments/${uid}/${ticketId}/screenshot.png`};
 await act(uid,'supportCreate',payload,op);await act(uid,'supportCreate',payload,op);
 let list=await act(uid,'supportList');assert.equal(list.tickets.length,1);assert.equal(list.tickets[0].messages.length,1);assert.equal(list.tickets[0].version,1);
 assert.equal((await act(other,'supportList')).tickets.length,0);
 await assert.rejects(()=>act(other,'supportReply',{id:ticketId,expectedVersion:1,message:'Read another account'}),code('not-found'));
 for(const action of ['adminSupportList','adminSupportUpdate'])await assert.rejects(()=>act(uid,action,{customerUid:other,id:ticketId,status:'resolved'}),code('permission-denied'));
 await assert.rejects(()=>act(other,'supportCreate',{...payload,ticketId:randomUUID()}),code('invalid-argument'));
 await assert.rejects(()=>act(other,'supportCreate',{...payload,attachment:null}),code('already-exists'));
 await assert.rejects(()=>act(uid,'supportCreate',{...payload,ticketId:randomUUID(),attachment:null}),code('resource-exhausted'));
 assert.equal((await admin('adminSupportList')).tickets.find(t=>t.id===ticketId).email,payload.email);
 const reply={customerUid:uid,id:ticketId,status:'pending',expectedVersion:1,message:'We are looking into this.'},replyOp=randomUUID();
 await admin('adminSupportUpdate',reply,replyOp);await admin('adminSupportUpdate',reply,replyOp);
 await assert.rejects(()=>admin('adminSupportUpdate',reply),code('failed-precondition'));
 list=await act(uid,'supportList');assert.equal(list.tickets[0].messages.length,2);assert.equal(list.tickets[0].messages[1].author,'support');assert.equal(list.tickets[0].status,'pending');
 const snapshotData=await snapshot(uid);assert.equal(snapshotData.account.balanceCents,0);assert.ok(snapshotData.account.handle,'Creating support before snapshot must not create a partial wallet');
});

test('support replies reopen resolved requests, retain author identity and respect message cooldown',async()=>{
 let time=Date.now(),uid=user(),owner='support-reply-owner';const service=accountService(db,{now:()=>time});
 const send=(actor,action,data={},claims={})=>service(actor,{action,...data,operationId:randomUUID()},claims);
 const ticketId=randomUUID();await send(uid,'supportCreate',{ticketId,name:'Collector',email:'member@example.com',topic:'account',message:'Need help.'});
 await send(owner,'adminSupportUpdate',{customerUid:uid,id:ticketId,expectedVersion:1,message:'Issue resolved.',status:'resolved'},{sub:owner,phone_number:'+17654794230'});
 await assert.rejects(()=>send(uid,'supportReply',{id:ticketId,expectedVersion:2,message:'Not yet fixed.'}),code('resource-exhausted'));
 time+=6000;await send(uid,'supportReply',{id:ticketId,expectedVersion:2,message:'Still need help.',author:'support',status:'resolved'});
 const ticket=(await send(uid,'supportList')).tickets[0];assert.equal(ticket.status,'open');assert.equal(ticket.version,3);assert.equal(ticket.messages[2].author,'customer');
});

test('Mythic requires configuration and then charges its saved price for one card',async()=>{
 const uid=user();await act(uid,'topup',{amountCents:10000});
 await assert.rejects(()=>purchase(uid,{packId:'mythic',expectedPriceCents:0}),code('failed-precondition'));
 assert.equal((await snapshot(uid)).account.balanceCents,10000);
 await db.runTransaction(async tx=>tx.set(db.doc('packContents/mythic'),{...defaultPack('mythic'),enabled:true,priceCents:2500,version:1}));
 try{
  await assert.rejects(()=>purchase(uid,{packId:'mythic',expectedPriceCents:199,expectedVersion:1}),code('failed-precondition'));
  const result=await purchase(uid,{packId:'mythic',expectedPriceCents:2500,expectedVersion:1});
  assert.equal(result.totalCents,2500);assert.equal(result.cards.length,1);
  const saved=await snapshot(uid);assert.equal(saved.account.balanceCents,7500);assert.equal(saved.items[0].packId,'mythic');
 }finally{await db.runTransaction(async tx=>tx.delete(db.doc('packContents/mythic')))}
});
