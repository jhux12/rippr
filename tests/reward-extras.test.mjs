import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {accountService} from '../functions/service.js';
import {rewardExtras,REWARD_COOLDOWN_MS as DAY} from '../src/reward-model.js';
import {defaultPack} from '../src/catalog-model.js';
import {catalogDatabase as memoryDatabase} from './helpers/catalog-database.mjs';
const code=c=>e=>e.code===c;
function fixture(){const db=memoryDatabase();let time=1000000000;const run=accountService(db,{now:()=>time});const call=(action,data={},id=randomUUID(),uid='member')=>run(uid,{action,...data,operationId:id});return{db,call,now:()=>time,advance:n=>time+=n,patch:async patch=>{await call('snapshot');await db.runTransaction(async tx=>{await tx.get(db.doc('testAccounts/member'));tx.update(db.doc('testAccounts/member'),patch)})}}}
test('streak boundaries use rolling 24/48 hours separately from spin testing',()=>{
 const now=1e9;assert.equal(rewardExtras({},now).streak.day,1);
 const wallet={streakCount:2,lastStreakAtMs:now};assert.equal(rewardExtras(wallet,now+DAY-1).streak.ready,false);assert.equal(rewardExtras(wallet,now+DAY).streak.day,3);assert.equal(rewardExtras(wallet,now+2*DAY-1).streak.count,2);assert.equal(rewardExtras(wallet,now+2*DAY).streak.count,0);
 assert.equal(rewardExtras({streakCount:7,lastStreakAtMs:now},now).streak.claimedDays,7);assert.equal(rewardExtras({streakCount:7,lastStreakAtMs:now},now+DAY).streak.claimedDays,0);
});
test('retired streak never awards even with historical progress and testing bypass',async()=>{
 const f=fixture();await f.patch({streakCount:6,lastStreakAtMs:f.now()-DAY});const before=await f.call('snapshot');
 await assert.rejects(()=>f.call('claimStreak',{expectedDay:7,testingNoCooldown:true}),code('failed-precondition'));assert.deepEqual(await f.call('snapshot'),before);
});
test('welcome bonus requires trusted verified deposit metadata, not top-ups or spoofed claims',async()=>{
 const f=fixture();await f.call('topup',{amountCents:500});assert.equal((await f.call('sparkState')).extras.welcome.eligible,false);
 await assert.rejects(()=>f.call('claimWelcomeCase',{firstVerifiedDepositAtMs:f.now(),eligible:true}),code('failed-precondition'));
 await assert.rejects(()=>f.call('settings',{firstVerifiedDepositAtMs:f.now()}),code('invalid-argument'));
 await f.patch({firstVerifiedDepositAtMs:f.now()+1});assert.equal((await f.call('sparkState')).extras.welcome.eligible,false);
 await f.patch({firstVerifiedDepositAtMs:f.now()});const op=randomUUID(),won=await f.call('claimWelcomeCase',{},op);assert.deepEqual(await f.call('claimWelcomeCase',{},op),won);
 await assert.rejects(()=>f.call('claimWelcomeCase'),code('failed-precondition'));const saved=await f.call('snapshot');assert.equal(saved.packs.length,1);assert.equal(saved.packs[0].source,'welcome-case');assert.equal(saved.account.balanceCents,500);
});
test('extras reject guests, stale days and balance overflow without writes',async()=>{
 const f=fixture();await assert.rejects(()=>f.call('claimStreak',{expectedDay:1},randomUUID(),null),code('unauthenticated'));
 await assert.rejects(()=>f.call('claimStreak',{expectedDay:7}),code('failed-precondition'));
 await f.patch({balanceCents:100000000});const before=await f.call('snapshot');await assert.rejects(()=>f.call('claimStreak',{expectedDay:1}),code('failed-precondition'));assert.deepEqual(await f.call('snapshot'),before);
});

test('payment holds, debt, reviews and reversed deposits block new welcome awards without consuming them',async()=>{
 for(const patch of [{paymentHold:true},{paymentDebtCents:1},{paymentReviewCount:1},{legacyPaymentHold:true},{lastPromotionReversalAtMs:1000000000}]){const f=fixture();await f.patch({firstVerifiedDepositAtMs:1,...patch});const before=await f.call('snapshot');assert.equal((await f.call('sparkState')).extras.welcome.eligible,false);await assert.rejects(()=>f.call('claimWelcomeCase'),code('failed-precondition'));assert.deepEqual(await f.call('snapshot'),before);}
 const f=fixture();await f.patch({firstVerifiedDepositAtMs:1,lastPromotionReversalAtMs:f.now()-1});await f.patch({lastVerifiedDepositAtMs:f.now()});assert.equal((await f.call('sparkState')).extras.welcome.eligible,true);await f.call('claimWelcomeCase');assert.equal((await f.call('snapshot')).packs.length,1);
});

test('a saved welcome receipt can replay during a hold but cannot create a second award',async()=>{const f=fixture();await f.patch({firstVerifiedDepositAtMs:1});const id=randomUUID(),first=await f.call('claimWelcomeCase',{},id);await f.patch({paymentHold:true,lastPromotionReversalAtMs:f.now()});assert.deepEqual(await f.call('claimWelcomeCase',{},id),first);await assert.rejects(()=>f.call('claimWelcomeCase'),code('failed-precondition'));assert.equal((await f.call('snapshot')).packs.length,1);});
