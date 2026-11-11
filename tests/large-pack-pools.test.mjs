import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {MAX_PACK_ITEMS,MAX_PACK_DOCUMENT_BYTES,packDocumentBytes,defaultPack,validateItems,readStoredPack,drawItem} from '../src/catalog-model.js';
import {generateOdds,expectedValue} from '../src/odds-calculator.js';
import {addLibraryToPack,cleanLibraryCard} from '../src/library-model.js';
import {accountService} from '../functions/service.js';
import {memoryDatabase} from './helpers/memory-database.mjs';
const pool=(length=MAX_PACK_ITEMS)=>Array.from({length},(_,i)=>({...defaultPack('basic').items[0],id:'large-'+i,name:'Large pool card '+i,valueCents:100+i,chanceBps:10}));
test('1,000 outcomes validate, reload and honor weighted boundaries while 1,001 are rejected',()=>{
  const items=pool();assert.equal(MAX_PACK_ITEMS,1000);assert.deepEqual(validateItems(items),[]);assert(packDocumentBytes(items)<MAX_PACK_DOCUMENT_BYTES);
  assert.equal(readStoredPack({items,version:1,enabled:true,priceCents:199}).items.length,1000);
  assert.equal(drawItem(items,0).id,'large-0');assert.equal(drawItem(items,0.1234).id,'large-123');assert.equal(drawItem(items,0.9999).id,'large-999');
  assert.match(validateItems(pool(1001))[0],/1,000/);
});
test('UTF-8 and map metadata size guard rejects oversized pools before save without shrinking normal capacity',()=>{
  const items=pool();assert.deepEqual(validateItems(items),[]);
  const oversized=items.map(item=>({...item,image:'https://example.com/'+ 'x'.repeat(1800)}));
  assert(packDocumentBytes(oversized)>MAX_PACK_DOCUMENT_BYTES);assert(validateItems(oversized).some(e=>e.includes('too large')));
  const unicode=items.map(item=>({...item,image:'https://example.com/'+ '界'.repeat(700)}));
  assert(packDocumentBytes(unicode)>MAX_PACK_DOCUMENT_BYTES);assert(validateItems(unicode).some(e=>e.includes('too large')));
  const cycle={};cycle.self=cycle;assert.equal(packDocumentBytes([cycle]),Infinity);
});
test('large library additions preserve old odds and support the exact 1,000-card boundary',()=>{
  const existing=defaultPack('basic').items,before=structuredClone(existing);
  const library=Array.from({length:995},(_,i)=>cleanLibraryCard({id:'site-'+i,name:'Site '+i,image:'assets/grail-moonstone.svg',rarity:'Rare',valueCents:100}));
  const result=addLibraryToPack(existing,library);assert.equal(result.added,995);assert.equal(result.items.length,1000);assert.deepEqual(result.items.slice(0,5),before);assert(result.items.slice(5).every(c=>c.chanceBps===0));
  assert.throws(()=>addLibraryToPack(result.items,[{...library[0],id:'one-too-many'}]),/1,000/);
});
test('the large-pool odds solver keeps 100%, positive included chances, grades, EV bounds and deterministic results',()=>{
  const items=pool().map((c,i)=>({...c,valueCents:(i*7919)%100000,grading:{company:'PSA',grade:'10'}})),before=structuredClone(items),target=50000.1234;
  const result=generateOdds(items,target,{includeZero:true});assert.deepEqual(validateItems(result.items),[]);assert.equal(result.items.reduce((n,c)=>n+c.chanceBps,0),10000);assert(result.items.every(c=>c.chanceBps>=1));assert.equal(result.actualCents,expectedValue(result.items));assert(result.actualCents>=result.minCents&&result.actualCents<=result.maxCents);assert(Math.abs(result.actualCents-target)<10);assert.deepEqual(items,before);assert.deepEqual(generateOdds(items,target,{includeZero:true}),result);
  const equal=generateOdds(items.map(c=>({...c,valueCents:100})),100,{includeZero:true});assert(equal.items.every(c=>c.chanceBps===10));
  assert.throws(()=>generateOdds(items,0,{includeZero:true}),/Reachable EV/);
});
test('server purchases from 1,000 outcomes award one saved card per paid pack and retry once without a second debit',async()=>{
  const db=memoryDatabase(),service=accountService(db),uid='large-pool-member',items=pool().map(c=>({...c,grading:{company:'PSA',grade:'10'}}));
  await db.runTransaction(async tx=>{tx.set(db.doc('packContents/basic'),{items,version:1,enabled:true,priceCents:199})});
  const act=(action,data={},operationId=randomUUID())=>service(uid,{action,...data,operationId});
  await act('topup',{amountCents:10000});const op=randomUUID(),request={packId:'basic',quantity:5,expectedPriceCents:199,expectedVersion:1};
  const first=await act('purchase',request,op),retry=await act('purchase',request,op);assert.deepEqual(first,retry);assert.equal(first.cards.length,5);assert.equal(first.totalCents,995);
  for(const card of first.cards){const entry=items.find(c=>c.id===card.catalogItemId);assert(entry);assert.equal(card.valueCents,entry.valueCents);assert.equal(card.grading.grade,'10')}
  const saved=await act('snapshot');assert.equal(saved.account.balanceCents,9005);assert.equal(saved.items.length,5);
  await db.runTransaction(async tx=>{tx.set(db.doc('packContents/basic'),{items:pool(1001),version:2,enabled:true,priceCents:199})});await assert.rejects(act('purchase',{...request,expectedVersion:2}),e=>e.code==='failed-precondition');assert.equal((await act('snapshot')).account.balanceCents,9005);
});
