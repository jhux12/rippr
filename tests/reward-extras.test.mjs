import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {accountService} from '../functions/service.js';
import {rewardExtras,REWARD_COOLDOWN_MS as DAY} from '../src/reward-model.js';
import {defaultPack} from '../src/catalog-model.js';
import {memoryDatabase} from './helpers/memory-database.mjs';
const code=c=>e=>e.code===c;
function fixture(){const db=memoryDatabase();let time=1000000000;const run=accountService(db,{now:()=>time});const call=(action,data={},id=randomUUID(),uid='member')=>run(uid,{action,...data,operationId:id});return{db,call,now:()=>time,advance:n=>time+=n,patch:async patch=>{await call('snapshot');await db.runTransaction(async tx=>{await tx.get(db.doc('testAccounts/member'));tx.update(db.doc('testAccounts/member'),patch)})}}}
test('streak boundaries use rolling 24/48 hours separately from spin testing',()=>{
 const now=1e9;assert.equal(rewardExtras({},now).streak.day,1);
 const wallet={streakCount:2,lastStreakAtMs:now};assert.equal(rewardExtras(wallet,now+DAY-1).streak.ready,false);assert.equal(rewardExtras(wallet,now+DAY).streak.day,3);assert.equal(rewardExtras(wallet,now+2*DAY-1).streak.count,2);assert.equal(rewardExtras(wallet,now+2*DAY).streak.count,0);
 assert.equal(rewardExtras({streakCount:7,lastStreakAtMs:now},now).streak.claimedDays,7);assert.equal(rewardExtras({streakCount:7,lastStreakAtMs:now},now+DAY).streak.claimedDays,0);
});
test('streak awards once under retry/concurrency and never changes daily spin cooldown',async()=>{
 const f=fixture(),op=randomUUID(),one=await f.call('claimStreak',{expectedDay:1},op);assert.deepEqual(await f.call('claimStreak',{expectedDay:1},op),one);
 await assert.rejects(()=>f.call('claimStreak',{expectedDay:2}),code('failed-precondition'));
 let saved=await f.call('snapshot');assert.equal(saved.account.balanceCents,5);assert.equal(saved.account.nextRewardAtMs,undefined);
 f.advance(DAY);const results=await Promise.allSettled([f.call('claimStreak',{expectedDay:2}),f.call('claimStreak',{expectedDay:2})]);assert.equal(results.filter(r=>r.status==='fulfilled').length,1);saved=await f.call('snapshot');assert.equal(saved.account.balanceCents,10);
 await f.call('claimReward',{expectedVersion:0});await assert.rejects(()=>f.call('claimStreak',{expectedDay:3}),code('failed-precondition'));
});
test('seven-day streak grants one normal unopened pack and cycles after cooldown',async()=>{
 const f=fixture();for(let day=1;day<=7;day++){await f.call('claimStreak',{expectedDay:day});if(day<7)f.advance(DAY)}
 let saved=await f.call('snapshot');assert.equal(saved.account.balanceCents,80);assert.equal(saved.packs.length,1);assert.equal(saved.packs[0].source,'streak-reward');assert.equal(saved.packs[0].status,'available');
 const win=await f.call('openInventoryPack',{packId:'basic',inventoryPackId:saved.packs[0].id,quantity:1,expectedVersion:0});assert.equal(win.totalCents,0);assert.equal(win.cards.length,1);
 f.advance(DAY);assert.equal((await f.call('rewardState')).extras.streak.day,1);await f.call('claimStreak',{expectedDay:1});saved=await f.call('snapshot');assert.equal(saved.account.streakCount,8);
});
test('streak resets on a missed window and invalid/disabled pack claims roll back',async()=>{
 const f=fixture();await f.call('claimStreak',{expectedDay:1});f.advance(2*DAY);await assert.rejects(()=>f.call('claimStreak',{expectedDay:2}),code('failed-precondition'));await f.call('claimStreak',{expectedDay:1});
 await f.patch({streakCount:6,lastStreakAtMs:f.now()-DAY});await f.db.runTransaction(async tx=>{tx.set(f.db.doc('packContents/basic'),{...defaultPack('basic'),version:1,enabled:false})});
 const before=await f.call('snapshot');await assert.rejects(()=>f.call('claimStreak',{expectedDay:7}),code('failed-precondition'));assert.deepEqual(await f.call('snapshot'),before);
});
test('welcome bonus requires trusted verified deposit metadata, not top-ups or spoofed claims',async()=>{
 const f=fixture();await f.call('topup',{amountCents:500});assert.equal((await f.call('rewardState')).extras.welcome.eligible,false);
 await assert.rejects(()=>f.call('claimWelcomeCase',{firstVerifiedDepositAtMs:f.now(),eligible:true}),code('failed-precondition'));
 await assert.rejects(()=>f.call('settings',{firstVerifiedDepositAtMs:f.now()}),code('invalid-argument'));
 await f.patch({firstVerifiedDepositAtMs:f.now()+1});assert.equal((await f.call('rewardState')).extras.welcome.eligible,false);
 await f.patch({firstVerifiedDepositAtMs:f.now()});const op=randomUUID(),won=await f.call('claimWelcomeCase',{},op);assert.deepEqual(await f.call('claimWelcomeCase',{},op),won);
 await assert.rejects(()=>f.call('claimWelcomeCase'),code('failed-precondition'));const saved=await f.call('snapshot');assert.equal(saved.packs.length,1);assert.equal(saved.packs[0].source,'welcome-case');assert.equal(saved.account.balanceCents,500);
});
test('extras reject guests, stale days and balance overflow without writes',async()=>{
 const f=fixture();await assert.rejects(()=>f.call('claimStreak',{expectedDay:1},randomUUID(),null),code('unauthenticated'));
 await assert.rejects(()=>f.call('claimStreak',{expectedDay:7}),code('failed-precondition'));
 await f.patch({balanceCents:100000000});const before=await f.call('snapshot');await assert.rejects(()=>f.call('claimStreak',{expectedDay:1}),code('failed-precondition'));assert.deepEqual(await f.call('snapshot'),before);
});
