import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,createHash} from 'node:crypto';
import {memoryDatabase} from './helpers/memory-database.mjs';
import {recordEngagement,bindAcquisition,recordCustomerMilestones,adminConversionSummary} from '../functions/conversion-service.js';
import {scopedDatabase} from '../functions/runtime-mode.js';
const atMs=Date.UTC(2026,10,16,15),owner={sub:'owner',phone_number:'+17654794230'},hash=v=>createHash('sha256').update(v).digest('hex');
function fixture(){const db=memoryDatabase(),sessionId=randomUUID();return{db,sessionId,event:(stage='landing',source='instagram',extra={})=>recordEngagement(db,{sessionId,stage,source,...extra},{networkKey:'test-network',atMs}),bind:(uid='member',time=atMs)=>bindAcquisition(db,uid,{sessionId},{},time),summary:(days=7,time=atMs)=>adminConversionSummary(db,'owner',{days},owner,time),read:p=>db.runTransaction(async tx=>(await tx.get(db.doc(p))).data())}}

test('landing measurements deduplicate stages, preserve first-touch source and never accept client payment success',async()=>{
 const f=fixture();assert.deepEqual(await f.event('pack'),{recorded:false});assert.equal((await f.db.collection('conversionDays').get()).size,0);
 await f.event();await f.event('landing','tiktok');await f.event('pack','facebook');await f.event('pack','email');
 for(const stage of ['registered','funded','opened','returned','random'])await assert.rejects(()=>f.event(stage),e=>e.code==='invalid-argument');
 const report=await f.summary();assert.equal(report.totals.landing,1);assert.equal(report.totals.pack,1);assert.equal(report.totals.funded,0);assert.equal(report.sources.find(r=>r.source==='instagram').pack,1);assert.equal(report.sources.find(r=>r.source==='facebook').pack,0);assert.equal(report.historicalBackfill,false);
 const saved=await f.read('conversionSessions/'+hash(f.sessionId));assert.equal(saved.source,'instagram');assert.equal(saved.expiresAtMs,atMs+30*60000);assert.equal(JSON.stringify(report).includes(f.sessionId),false);
 await assert.rejects(()=>f.event('landing','private@email.test'),e=>e.code==='invalid-argument');await assert.rejects(()=>recordEngagement(f.db,{sessionId:'abc',stage:'landing'},{networkKey:'test',atMs}),e=>e.code==='invalid-argument');
});

test('source/session binding is one-time, authenticated, unexpired and excluded for the verified owner',async()=>{
 const f=fixture();await f.event();await assert.rejects(()=>bindAcquisition(f.db,null,{sessionId:f.sessionId},{},atMs),e=>e.code==='unauthenticated');assert.deepEqual(await bindAcquisition(f.db,'owner',{sessionId:f.sessionId},owner,atMs),{bound:false,excluded:true});
 assert.deepEqual(await f.bind(),{bound:true});assert.deepEqual(await f.bind(),{bound:true});await assert.rejects(()=>f.bind('another'),e=>e.code==='permission-denied');
 const alternate=randomUUID();await recordEngagement(f.db,{sessionId:alternate,stage:'landing',source:'google'},{networkKey:'test',atMs});assert.deepEqual(await bindAcquisition(f.db,'member',{sessionId:alternate},{},atMs),{bound:false});
 assert.equal((await f.read('conversionAccounts/'+hash('member'))).source,'instagram');assert.equal((await f.read('testAccounts/member')),undefined);
 const g=fixture();await g.event();assert.deepEqual(await g.bind('member',atMs+30*60000),{bound:false});
});

test('trusted milestones reconcile out-of-order events with attribution and count each account once',async()=>{
 const f=fixture();await f.event();await recordCustomerMilestones(f.db,'member',{registered:true,funded:true},atMs+100);await recordCustomerMilestones(f.db,'member',{funded:true},atMs+100);assert.equal((await f.summary()).totals.funded,0);
 await f.bind('member',atMs+200);await recordCustomerMilestones(f.db,'member',{funded:true,opened:true,openingEventId:'purchase-one'},atMs+300);await recordCustomerMilestones(f.db,'member',{opened:true,openingEventId:'purchase-one'},atMs+400);let report=await f.summary();assert.equal(report.totals.registered,1);assert.equal(report.totals.funded,1);assert.equal(report.totals.opened,1);assert.equal(report.totals.returned,0);
 await recordCustomerMilestones(f.db,'member',{opened:true,openingEventId:'purchase-two'},atMs+500);await recordCustomerMilestones(f.db,'member',{opened:true,openingEventId:'purchase-two'},atMs+600);report=await f.summary();assert.equal(report.totals.returned,1);const saved=await f.read('conversionAccounts/'+hash('member'));assert.equal(saved.openingEvents.length,2);assert(!JSON.stringify(saved).includes('purchase-one'));assert(!JSON.stringify(report).includes('member'));
});

test('expired sessions and events outside the 30-day acquisition window cannot inflate cohorts',async()=>{
 const f=fixture();await f.event();assert.deepEqual(await recordEngagement(f.db,{sessionId:f.sessionId,stage:'pack',source:'instagram'},{networkKey:'test',atMs:atMs+30*60000}),{recorded:false,expired:true});await f.bind();
 await recordCustomerMilestones(f.db,'member',{registered:true},atMs-1);await recordCustomerMilestones(f.db,'member',{funded:true},atMs+31*86400000);assert.equal((await f.summary()).totals.registered,0);assert.equal((await f.summary()).totals.funded,0);
});

test('public measurement enforces network and daily session caps without storing network identifiers',async()=>{
 const f=fixture();await f.event();for(let i=1;i<120;i++)await f.event();await assert.rejects(()=>f.event(),e=>e.code==='resource-exhausted');assert.equal((await f.summary()).totals.landing,1);
 const limit=(await f.db.collection('conversionLimits').get()).docs[0];assert(!JSON.stringify(limit.data()).includes('test-network'));assert.equal(limit.id.length,64);
 const g=fixture();await g.db.runTransaction(tx=>tx.set(g.db.doc('conversionDays/2026-11-16'),{day:'2026-11-16',totals:{landing:20000}}));assert.deepEqual(await g.event(),{recorded:false,limited:true});assert.equal((await g.db.collection('conversionSessions').get()).size,0);
});

test('owner summary uses bounded Indianapolis cohort dates and never exposes customer/session records',async()=>{
 const f=fixture();await f.event();await assert.rejects(()=>adminConversionSummary(f.db,'member',{},{}),e=>e.code==='permission-denied');await assert.rejects(()=>f.summary(90),e=>e.code==='invalid-argument');
 await f.db.runTransaction(tx=>{tx.set(f.db.doc('conversionDays/2026-11-08'),{day:'2026-11-08',totals:{landing:5},sources:{google:{landing:5}}});tx.set(f.db.doc('conversionDays/2026-10-01'),{day:'2026-10-01',totals:{landing:100},sources:{google:{landing:100}}})});
 const week=await f.summary(),month=await f.summary(30);assert.equal(week.totals.landing,1);assert.equal(month.totals.landing,6);assert.equal(week.startDay,'2026-11-10');assert.equal(week.endDay,'2026-11-16');assert.equal(week.timeZone,'America/Indiana/Indianapolis');assert(!JSON.stringify(month).includes('sessionHash'));
 const midnight=await adminConversionSummary(f.db,'owner',{days:7},owner,Date.UTC(2026,10,16,3));assert.equal(midnight.endDay,'2026-11-15');
});

test('existing accounts never become new funded customers; late registration reconciles pending verified outcomes',async()=>{
 const f=fixture();await f.event();await f.bind();await recordCustomerMilestones(f.db,'member',{funded:true,opened:true,openingEventId:'first-event'},atMs+100);
 let report=await f.summary();assert.equal(report.totals.funded,0);assert.equal(report.totals.opened,0);
 await recordCustomerMilestones(f.db,'member',{registered:true},atMs+50);report=await f.summary();assert.equal(report.totals.registered,1);assert.equal(report.totals.funded,1);assert.equal(report.totals.opened,1);
 const g=fixture();await g.event();await recordCustomerMilestones(g.db,'member',{registered:true},atMs-100);await g.bind();await recordCustomerMilestones(g.db,'member',{funded:true,opened:true,openingEventId:'existing-event'},atMs+100);assert.equal((await g.summary()).totals.funded,0);assert.equal((await g.summary()).totals.opened,0);
});

test('late/retried opening triggers derive repeat time from distinct activities and retain the earliest two',async()=>{
 const f=fixture();await f.event();await f.bind();await recordCustomerMilestones(f.db,'member',{registered:true},atMs);
 await recordCustomerMilestones(f.db,'member',{opened:true,openingEventId:'first'},atMs+100);
 await recordCustomerMilestones(f.db,'member',{opened:true,openingEventId:'late-second'},atMs+31*86400000);
 await recordCustomerMilestones(f.db,'member',{opened:true,openingEventId:'first'},atMs+100);
 assert.equal((await f.summary()).totals.returned,0);
 await recordCustomerMilestones(f.db,'member',{opened:true,openingEventId:'middle'},atMs+200);
 let saved=await f.read('conversionAccounts/'+hash('member'));assert.equal(saved.milestones.opened,atMs+100);assert.equal(saved.milestones.returned,atMs+200);assert.equal((await f.summary()).totals.returned,1);
 await recordCustomerMilestones(f.db,'member',{opened:true,openingEventId:'earliest'},atMs+50);saved=await f.read('conversionAccounts/'+hash('member'));assert.equal(saved.openingEvents.length,2);assert.equal(saved.milestones.opened,atMs+50);assert.equal(saved.milestones.returned,atMs+100);assert.equal((await f.summary()).totals.returned,1);
});

test('measurement expiry fields distinguish session authorization from bounded record retention',async()=>{
 const f=fixture();await f.event();let session=await f.read('conversionSessions/'+hash(f.sessionId));assert.equal(session.expiresAtMs,atMs+30*60000);assert.equal(session.deleteAtMs,atMs+37*86400000);
 await recordCustomerMilestones(f.db,'unbound',{registered:true},atMs);assert.equal((await f.read('conversionAccounts/'+hash('unbound'))).expiresAtMs,atMs+30*86400000);
 await f.bind();assert.equal((await f.read('conversionAccounts/'+hash('member'))).expiresAtMs,atMs+37*86400000);assert.equal((await f.read('conversionDays/2026-11-16')).expiresAtMs,atMs+90*86400000);
});
