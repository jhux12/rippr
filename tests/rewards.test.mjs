import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {accountService} from '../functions/service.js';
import {defaultRewards,validateRewards,drawReward,REWARD_COOLDOWN_MS} from '../src/reward-model.js';
import {OWNER_EMAIL,defaultPack} from '../src/catalog-model.js';
import {memoryDatabase} from './helpers/memory-database.mjs';
const code=c=>e=>e.code===c;
function fixture(){const db=memoryDatabase();let time=10000000;const run=accountService(db,{now:()=>time});const call=(uid,action,data={},operationId=randomUUID(),claims={})=>run(uid,{action,...data,operationId},claims);return {db,run,call,advance:n=>time+=n,config:async prizes=>{const current=await call('owner','rewardState');return call('owner','saveRewards',{config:{enabled:true,testingNoCooldown:false,prizes},expectedVersion:current.config.version},randomUUID(),{email:OWNER_EMAIL,email_verified:true})}}}
const credit={id:'credit',kind:'credit',amountCents:125,chanceBps:10000};
const pack={id:'pack',kind:'pack',packId:'basic',chanceBps:10000};
test('reward odds are exact basis points with valid prize types and safe values',()=>{
 assert.deepEqual(validateRewards(defaultRewards()),[]);
 const c=defaultRewards();for(const [roll,id]of[[0,'credit-25'],[3999,'credit-25'],[4000,'credit-50'],[7000,'credit-100'],[9000,'pack-basic'],[9800,'pack-plus'],[9999,'pack-plus']])assert.equal(drawReward(c,roll).id,id);
 for(const prizes of [[],[{...credit,chanceBps:9999}],[{...credit,amountCents:1.5}],[{...credit,amountCents:0}],[{...pack,packId:'unknown'}],[{...credit,kind:'cash'}],[credit,credit]])assert.ok(validateRewards({enabled:true,prizes}).length);
 assert.throws(()=>drawReward(c,10000));
});
test('only verified owner claims may edit rewards, and stale versions cannot overwrite',async()=>{
 const f=fixture(),data={config:{enabled:true,prizes:[credit]},expectedVersion:0};
 for(const claims of [{},{email:OWNER_EMAIL,email_verified:false},{email:'member@example.com',email_verified:true}])await assert.rejects(()=>f.call('other','saveRewards',data,randomUUID(),claims),code('permission-denied'));
 await f.config([credit]);assert.equal((await f.call('user','rewardState')).config.prizes[0].amountCents,125);
 await assert.rejects(()=>f.call('owner','saveRewards',data,randomUUID(),{email:OWNER_EMAIL,email_verified:true}),code('failed-precondition'));
});
test('credit awards and cooldown are atomic, persist across requests, and ignore supplied prizes/times',async()=>{
 const f=fixture();await f.config([credit]);const op=randomUUID(),data={expectedVersion:1,amountCents:999999,now:0};
 const won=await f.call('member','claimReward',data,op);const retry=await f.call('member','claimReward',data,op);assert.deepEqual(won,retry);
 let saved=await f.call('member','snapshot');assert.equal(saved.account.balanceCents,125);assert.equal(saved.activity.filter(a=>a.type==='reward').length,1);
 await assert.rejects(()=>f.call('member','claimReward',{expectedVersion:1,testingNoCooldown:true}),code('failed-precondition'));
 f.advance(REWARD_COOLDOWN_MS-1);await assert.rejects(()=>f.call('member','claimReward',{expectedVersion:1}),code('failed-precondition'));
 f.advance(1);await f.call('member','claimReward',{expectedVersion:1});saved=await f.call('member','snapshot');assert.equal(saved.account.balanceCents,250);
});
test('concurrent daily claims cannot award twice, even from different tabs',async()=>{
 const f=fixture();await f.config([pack]);const results=await Promise.allSettled([f.call('member','claimReward',{expectedVersion:1}),f.call('member','claimReward',{expectedVersion:1})]);assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal((await f.call('member','snapshot')).packs.length,1);
});
test('awarded packs are saved unopened, consumed once for a real card, and never debit balance',async()=>{
 const f=fixture();await f.config([pack]);const reward=await f.call('member','claimReward',{expectedVersion:1});let saved=await f.call('member','snapshot');assert.equal(saved.items.length,0);assert.equal(saved.packs[0].status,'available');assert.equal(saved.account.packsOpened,0);
 const data={packId:'basic',inventoryPackId:reward.inventoryPackId,quantity:1,expectedVersion:0,expectedPriceCents:999999};const op=randomUUID();
 const opened=await f.call('member','openInventoryPack',data,op);assert.equal(opened.totalCents,0);assert.equal(opened.cards.length,1);
 assert.deepEqual(await f.call('member','openInventoryPack',data,op),opened);
 saved=await f.call('member','snapshot');assert.equal(saved.account.balanceCents,0);assert.equal(saved.packs[0].status,'opened');assert.equal(saved.items.length,1);assert.equal(saved.account.packsOpened,1);
 await assert.rejects(()=>f.call('member','openInventoryPack',data),code('failed-precondition'));
 await assert.rejects(()=>f.call('other','openInventoryPack',data),code('failed-precondition'));
 await assert.rejects(()=>f.call('member','sell',{itemIds:[reward.inventoryPackId]}),code('failed-precondition'));
});
test('inventory packs cannot be swapped, batched or consumed from disabled/stale catalogs',async()=>{
 const f=fixture();await f.config([pack]);const reward=await f.call('member','claimReward',{expectedVersion:1});const data={packId:'basic',inventoryPackId:reward.inventoryPackId,quantity:1,expectedVersion:0};
 await assert.rejects(()=>f.call('member','openInventoryPack',{...data,packId:'ultimate'}),code('failed-precondition'));
 await assert.rejects(()=>f.call('member','openInventoryPack',{...data,quantity:2}),code('invalid-argument'));
 await assert.rejects(()=>f.call('member','openInventoryPack',{...data,expectedVersion:4}),code('failed-precondition'));
 const catalog=defaultPack('basic');catalog.enabled=false;catalog.version=1;await f.db.runTransaction(async tx=>tx.set(f.db.doc('packContents/basic'),catalog));
 await assert.rejects(()=>f.call('member','openInventoryPack',{...data,expectedVersion:1}),code('failed-precondition'));
 const saved=await f.call('member','snapshot');assert.equal(saved.packs[0].status,'available');assert.equal(saved.items.length,0);
});
test('paused rewards, stale odds and unauthenticated claims fail without awarding',async()=>{
 const f=fixture();await assert.rejects(()=>f.call(null,'claimReward',{expectedVersion:0}),code('unauthenticated'));await f.config([credit]);
 await assert.rejects(()=>f.call('member','claimReward',{expectedVersion:0}),code('failed-precondition'));
 await f.call('owner','saveRewards',{config:{enabled:false,prizes:[credit]},expectedVersion:1},randomUUID(),{email:OWNER_EMAIL,email_verified:true});
 await assert.rejects(()=>f.call('member','claimReward',{expectedVersion:2}),code('failed-precondition'));
 assert.equal((await f.call('member','snapshot')).account.balanceCents,0);
});

test('admin testing bypass allows repeat claims without waiting and can be turned off',async()=>{
 const f=fixture();await f.config([credit]);
 await f.call('owner','saveRewards',{config:{enabled:true,testingNoCooldown:true,prizes:[credit]},expectedVersion:1},randomUUID(),{email:OWNER_EMAIL,email_verified:true});
 await f.call('member','claimReward',{expectedVersion:2});await f.call('member','claimReward',{expectedVersion:2});
 assert.equal((await f.call('member','snapshot')).account.balanceCents,250);
 assert.equal((await f.call('member','rewardState')).nextClaimAtMs,0);
 await f.call('owner','saveRewards',{config:{enabled:true,testingNoCooldown:false,prizes:[credit]},expectedVersion:2},randomUUID(),{email:OWNER_EMAIL,email_verified:true});
 await f.call('member','claimReward',{expectedVersion:3});
 await assert.rejects(()=>f.call('member','claimReward',{expectedVersion:3}),code('failed-precondition'));
});
