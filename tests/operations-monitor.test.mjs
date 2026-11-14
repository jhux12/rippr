import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {recordOperationFailure,operationSummary,withOpeningMonitoring} from '../functions/operations-monitor.js';
import {scopedDatabase} from '../functions/runtime-mode.js';
import {memoryDatabase} from './helpers/memory-database.mjs';
const time=Date.UTC(2026,10,14,18),event=()=>({category:'checkout',uid:'private-customer',operationId:randomUUID(),reason:'key',atMs:time});
test('server error counts deduplicate retries and isolate live reporting from sandbox',async()=>{
 const root=memoryDatabase(),live=scopedDatabase(root,'live'),e=event();
 await Promise.all([recordOperationFailure(live,e),recordOperationFailure(live,e)]);
 await recordOperationFailure(root,e);
 await recordOperationFailure(live,{...event(),category:'opening',reason:'internal'});
 const s=await operationSummary(live,time),t=await operationSummary(root,time);
 assert.equal(s.checkoutErrors,1);assert.equal(s.openingErrors,1);assert.equal(t.checkoutErrors,1);assert.equal(t.openingErrors,0);
 assert.equal(s.historicalBackfill,false);assert(!JSON.stringify(s).includes('private-customer'));
 const rows=await root.collection('liveOperationalDays/2026-11-14/events').get();assert.equal(rows.size,2);
 assert(!JSON.stringify(rows.docs.map(x=>x.data())).includes('private-customer'));
 await recordOperationFailure(live,{...event(),atMs:time-8*86400000});assert.equal((await operationSummary(live,time)).checkoutErrors,1);
});
test('invalid or sensitive diagnostic inputs are not persisted',async()=>{
 const db=memoryDatabase();for(const patch of [{category:'anything'},{reason:'sk_live_doNotStore'},{uid:null},{operationId:'invalid'},{atMs:1.5}])await recordOperationFailure(db,{...event(),...patch});
 assert.equal((await db.collection('operationalDays').get()).size,0);
});
test('only technical opening errors are counted, successful or expected failures are not',async()=>{
 const db=memoryDatabase();assert.equal(await withOpeningMonitoring(db,'member',{action:'purchase'},async()=>42),42);
 const insufficient=Object.assign(Error('Not enough credit'),{code:'resource-exhausted'});
 await assert.rejects(()=>withOpeningMonitoring(db,'member',{action:'purchase',operationId:randomUUID()},async()=>{throw insufficient}),e=>e===insufficient);
 assert.equal((await db.collection('operationalDays').get()).size,0);
 const unavailable=Object.assign(Error('private provider payload'),{code:'unavailable'});
 await assert.rejects(()=>withOpeningMonitoring(db,'member',{action:'purchase',operationId:randomUUID()},async()=>{throw unavailable}),e=>e===unavailable);
 assert.equal((await operationSummary(db,Date.now())).openingErrors,1);
 const broken={runTransaction(){throw Error('Database unavailable')}};
 await assert.rejects(()=>withOpeningMonitoring(broken,'member',{action:'openInventoryPack',operationId:randomUUID()},async()=>{throw unavailable}),e=>e===unavailable);
});
