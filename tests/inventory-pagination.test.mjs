import test from 'node:test';
import assert from 'node:assert/strict';
import {Timestamp} from '../functions/node_modules/firebase-admin/lib/firestore/index.js';
import {accountService} from '../functions/service.js';
import {memoryDatabase} from './helpers/memory-database.mjs';

const code=expected=>error=>error.code===expected;
function fixture(){const db=memoryDatabase(),call=accountService(db);return {db,call:(uid,action,data={})=>call(uid,{action,...data})};}
async function seed(db,uid,collection,records){await db.runTransaction(async tx=>{for(const record of records)tx.set(db.doc(`testAccounts/${uid}/${collection}/${record.id}`),record)});}
const idFor=i=>'record-'+String(i).padStart(4,'0');
const cards=count=>Array.from({length:count},(_,i)=>({id:idFor(i),wonAt:1000,status:i===0?'available':'sold',name:'Card '+i}));
async function allPages(f,uid,collection){let cursor=null,records=[];do{const page=await f.call(uid,'inventoryPage',{collection,cursor});records.push(...page.records);assert.equal(page.hasMore,Boolean(page.cursor));cursor=page.cursor;}while(cursor);return records;}

test('more than 200 cards with identical timestamps remain reachable without duplicates or skipped older available cards',async()=>{
 const f=fixture();await seed(f.db,'collector','items',cards(405));
 const first=await f.call('collector','snapshot');assert.equal(first.items.length,200);assert.equal(first.hasMore,true);assert.equal(first.pageInfo.items.hasMore,true);assert.ok(first.pageInfo.items.cursor);
 assert.deepEqual(first.items.map(c=>c.id),cards(405).map(c=>c.id).reverse().slice(0,200));
 const second=await f.call('collector','inventoryPage',{collection:'items',cursor:first.pageInfo.items.cursor});assert.equal(second.records.length,200);assert.equal(second.hasMore,true);
 const last=await f.call('collector','inventoryPage',{collection:'items',cursor:second.cursor});assert.equal(last.records.length,5);assert.equal(last.cursor,null);assert.equal(last.hasMore,false);assert.equal(last.records.at(-1).status,'available');
 const ids=[...first.items,...second.records,...last.records].map(c=>c.id);assert.equal(new Set(ids).size,405);assert.deepEqual(ids,cards(405).map(c=>c.id).reverse());
});

test('unopened packs and shipment history have independent exact boundaries and cursors',async()=>{
 const f=fixture();const packs=cards(201).map((c,i)=>({...c,status:i===0?'available':'opened',packId:'basic'}));
 await seed(f.db,'collector','packs',packs);await seed(f.db,'collector','shipments',Array.from({length:51},(_,i)=>({id:idFor(i),createdAt:1000,status:'test-request'})));
 const snapshot=await f.call('collector','snapshot');assert.equal(snapshot.items.length,0);assert.equal(snapshot.hasMore,false);assert.equal(snapshot.pageInfo.items.cursor,null);assert.equal(snapshot.packs.length,200);assert.equal(snapshot.shipments.length,50);
 assert.equal(snapshot.pageInfo.packs.hasMore,true);assert.equal(snapshot.pageInfo.shipments.hasMore,true);
 assert.equal((await allPages(f,'collector','packs')).at(-1).status,'available');assert.equal((await allPages(f,'collector','shipments')).length,51);
 await assert.rejects(()=>f.call('collector','inventoryPage',{collection:'items',cursor:snapshot.pageInfo.packs.cursor}),code('invalid-argument'));
 const exact=fixture();await seed(exact.db,'collector','items',cards(200));await seed(exact.db,'collector','shipments',Array.from({length:50},(_,i)=>({id:idFor(i),createdAt:1000})));
 const end=await exact.call('collector','snapshot');assert.equal(end.hasMore,false);assert.deepEqual(end.pageInfo.items,{cursor:null,hasMore:false});assert.deepEqual(end.pageInfo.shipments,{cursor:null,hasMore:false});
});

test('timestamp nanoseconds are preserved in cursors and dominate document-id tie ordering',async()=>{
 const f=fixture();const records=Array.from({length:202},(_,i)=>({id:idFor(202-i),wonAt:new Timestamp(1000,i+1),status:'available'}));await seed(f.db,'collector','items',records);
 const first=await f.call('collector','inventoryPage',{collection:'items'});const payload=JSON.parse(Buffer.from(first.cursor,'base64url').toString('utf8'));assert.deepEqual(payload.time,{kind:'timestamp',seconds:1000,nanoseconds:3});
 const rest=await f.call('collector','inventoryPage',{collection:'items',cursor:first.cursor});assert.deepEqual([...first.records,...rest.records].map(c=>c.id),records.map(c=>c.id).reverse());assert.equal(rest.hasMore,false);
});

test('deleted cursor records and new head inserts do not invalidate a continuation',async()=>{
 const f=fixture();await seed(f.db,'collector','items',cards(205));const first=await f.call('collector','inventoryPage',{collection:'items'}),boundary=first.records.at(-1).id;
 await f.db.runTransaction(async tx=>{tx.delete(f.db.doc('testAccounts/collector/items/'+boundary));tx.set(f.db.doc('testAccounts/collector/items/new-head'),{id:'new-head',wonAt:2000,status:'available'});});
 const second=await f.call('collector','inventoryPage',{collection:'items',cursor:first.cursor});assert.deepEqual(second.records.map(c=>c.id),cards(5).map(c=>c.id).reverse());assert.equal(second.hasMore,false);
 const refreshed=await f.call('collector','snapshot');assert.equal(refreshed.items[0].id,'new-head');
});

test('pagination rejects unauthenticated, cross-account and malformed requests without exposing another collection',async()=>{
 const f=fixture();await seed(f.db,'owner','items',cards(201));await seed(f.db,'other','items',[{id:'private-card',wonAt:1000,name:'Other private card'}]);
 await assert.rejects(()=>f.call(null,'inventoryPage',{collection:'items'}),code('unauthenticated'));await assert.rejects(()=>f.call('owner','inventoryPage',{collection:'items',accountUid:'other'}),code('unauthenticated'));
 for(const collection of ['__proto__','activity','operations','../other/items',null,[]])await assert.rejects(()=>f.call('owner','inventoryPage',{collection}),code('invalid-argument'));
 const first=await f.call('owner','inventoryPage',{collection:'items'});await assert.rejects(()=>f.call('other','inventoryPage',{collection:'items',cursor:first.cursor}),code('invalid-argument'));
 const payload=JSON.parse(Buffer.from(first.cursor,'base64url').toString('utf8'));
 for(const cursor of ['',42,{},'bad!','a','x'.repeat(2049),Buffer.from('{}').toString('base64url'),Buffer.from(JSON.stringify({...payload,id:'../escape'})).toString('base64url'),Buffer.from(JSON.stringify({...payload,time:{kind:'timestamp',seconds:1,nanoseconds:1000000000}})).toString('base64url')])await assert.rejects(()=>f.call('owner','inventoryPage',{collection:'items',cursor}),code('invalid-argument'));
 // Cursors are not authorization tokens. Even a forged valid cursor still
 // queries the authenticated account path; it can never choose another uid.
 const forged=Buffer.from(JSON.stringify({...payload,uid:'other'})).toString('base64url');const own=await f.call('other','inventoryPage',{collection:'items',cursor:forged});assert.ok(own.records.every(c=>c.id==='private-card'));
 assert.equal((await f.call('owner','inventoryPage',{collection:'items'})).records.some(c=>c.name==='Other private card'),false);
});

test('empty read-only pages do not create an account or operation and legacy null dates retain stable continuation',async()=>{
 const f=fixture();assert.deepEqual(await f.call('new-member','inventoryPage',{collection:'items'}),{records:[],cursor:null,hasMore:false});
 assert.equal((await f.db.runTransaction(tx=>tx.get(f.db.doc('testAccounts/new-member')))).exists,false);
 const records=cards(201).map(c=>({...c,wonAt:null}));await seed(f.db,'collector','items',records);const found=await allPages(f,'collector','items');assert.equal(found.length,201);assert.deepEqual(found.map(c=>c.id),records.map(c=>c.id).reverse());
});
