import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {accountService} from '../functions/service.js';
import {defaultRewards,validateRewards,drawReward,REWARD_COOLDOWN_MS} from '../src/reward-model.js';
import {OWNER_PHONE,defaultPack} from '../src/catalog-model.js';
import {memoryDatabase} from './helpers/memory-database.mjs';
const code=c=>e=>e.code===c;
function fixture(){const db=memoryDatabase();let time=10000000;const run=accountService(db,{now:()=>time});const call=(uid,action,data={},operationId=randomUUID(),claims={})=>run(uid,{action,...data,operationId},claims);return {db,run,call,advance:n=>time+=n,config:async prizes=>{const current=await call('owner','rewardState');return call('owner','saveRewards',{config:{enabled:true,testingNoCooldown:false,prizes},expectedVersion:current.config.version},randomUUID(),{sub:'owner',phone_number:OWNER_PHONE})}}}
const credit={id:'credit',kind:'credit',amountCents:125,chanceBps:10000};
const pack={id:'pack',kind:'pack',packId:'basic',chanceBps:10000};
test('reward odds are exact basis points with valid prize types and safe values',()=>{
 assert.deepEqual(validateRewards(defaultRewards()),[]);
 const c=defaultRewards();for(const [roll,id]of[[0,'credit-25'],[3999,'credit-25'],[4000,'credit-50'],[7000,'credit-100'],[9000,'pack-basic'],[9800,'pack-plus'],[9999,'pack-plus']])assert.equal(drawReward(c,roll).id,id);
 for(const prizes of [[],[{...credit,chanceBps:9999}],[{...credit,amountCents:1.5}],[{...credit,amountCents:0}],[{...pack,packId:'unknown'}],[{...credit,kind:'cash'}],[credit,credit]])assert.ok(validateRewards({enabled:true,prizes}).length);
 assert.throws(()=>drawReward(c,10000));
});
test('only verified owner claims may edit rewards, and stale versions cannot overwrite',async()=>{
 const f=fixture(),data={config:{enabled:true,prizes:[credit]},expectedVersion:0,phone_number:OWNER_PHONE,isAdmin:true};
 for(const claims of [{},{sub:'other',email:'jhuxf12@outlook.com',email_verified:true},{sub:'other',phone_number:'+12025550123'},{sub:'owner',phone_number:OWNER_PHONE}])await assert.rejects(()=>f.call('other','saveRewards',data,randomUUID(),claims),code('permission-denied'));
 await f.config([credit]);assert.equal((await f.call('user','rewardState')).config.prizes[0].amountCents,125);
 await assert.rejects(()=>f.call('owner','saveRewards',data,randomUUID(),{sub:'owner',phone_number:OWNER_PHONE}),code('failed-precondition'));
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
test('inventory packs cannot be swapped, batched or consumed from invalid/stale catalogs',async()=>{
 const f=fixture();await f.config([pack]);const reward=await f.call('member','claimReward',{expectedVersion:1});const data={packId:'basic',inventoryPackId:reward.inventoryPackId,quantity:1,expectedVersion:0};
 await assert.rejects(()=>f.call('member','openInventoryPack',{...data,packId:'ultimate'}),code('failed-precondition'));
 await assert.rejects(()=>f.call('member','openInventoryPack',{...data,quantity:2}),code('invalid-argument'));
 await assert.rejects(()=>f.call('member','openInventoryPack',{...data,expectedVersion:4}),code('failed-precondition'));
 const catalog=defaultPack('basic');catalog.items=[];catalog.version=1;await f.db.runTransaction(async tx=>tx.set(f.db.doc('packContents/basic'),catalog));
 await assert.rejects(()=>f.call('member','openInventoryPack',{...data,expectedVersion:1}),code('failed-precondition'));
 const saved=await f.call('member','snapshot');assert.equal(saved.packs[0].status,'available');assert.equal(saved.items.length,0);
});
test('paused rewards, stale odds and unauthenticated claims fail without awarding',async()=>{
 const f=fixture();await assert.rejects(()=>f.call(null,'claimReward',{expectedVersion:0}),code('unauthenticated'));await f.config([credit]);
 await assert.rejects(()=>f.call('member','claimReward',{expectedVersion:0}),code('failed-precondition'));
 await f.call('owner','saveRewards',{config:{enabled:false,prizes:[credit]},expectedVersion:1},randomUUID(),{sub:'owner',phone_number:OWNER_PHONE});
 await assert.rejects(()=>f.call('member','claimReward',{expectedVersion:2}),code('failed-precondition'));
 assert.equal((await f.call('member','snapshot')).account.balanceCents,0);
});

test('admin testing bypass allows repeat claims without waiting and can be turned off',async()=>{
 const f=fixture();await f.config([credit]);
 await f.call('owner','saveRewards',{config:{enabled:true,testingNoCooldown:true,prizes:[credit]},expectedVersion:1},randomUUID(),{sub:'owner',phone_number:OWNER_PHONE});
 await f.call('member','claimReward',{expectedVersion:2});await f.call('member','claimReward',{expectedVersion:2});
 assert.equal((await f.call('member','snapshot')).account.balanceCents,250);
 assert.equal((await f.call('member','rewardState')).nextClaimAtMs,0);
 await f.call('owner','saveRewards',{config:{enabled:true,testingNoCooldown:false,prizes:[credit]},expectedVersion:2},randomUUID(),{sub:'owner',phone_number:OWNER_PHONE});
 await f.call('member','claimReward',{expectedVersion:3});
 await assert.rejects(()=>f.call('member','claimReward',{expectedVersion:3}),code('failed-precondition'));
});

test('Icy Rush rewards retain seasonal art and open exactly once after catalog setup',async()=>{
 const f=fixture();
 const seasonalPrize={id:'winter-pack',kind:'pack',packId:'icy-rush',chanceBps:10000};
 const catalog={...defaultPack('icy-rush'),enabled:true,priceCents:1500,version:1};
 await f.db.runTransaction(async tx=>tx.set(f.db.doc('packContents/icy-rush'),catalog));
 await f.config([seasonalPrize]);
 const reward=await f.call('member','claimReward',{expectedVersion:1});
 let saved=await f.call('member','snapshot');
 assert.equal(saved.packs[0].image,'assets/seasonal/pack-icy-rush.png');
 assert.equal(saved.packs[0].name,'Icy Rush pack');
 const data={packId:'icy-rush',inventoryPackId:reward.inventoryPackId,quantity:1,expectedVersion:1};
 const result=await f.call('member','openInventoryPack',{...data,expectedVersion:1});
 assert.equal(result.cards.length,1);assert.equal(result.cards[0].packId,'icy-rush');assert.equal(result.totalCents,0);
 await assert.rejects(()=>f.call('member','openInventoryPack',{...data,expectedVersion:1}),code('failed-precondition'));
 saved=await f.call('member','snapshot');assert.equal(saved.packs[0].status,'opened');
});

test('Icy Rush purchases require an enabled priced catalog and use its exact price',async()=>{
 const f=fixture();await f.call('member','topup',{amountCents:10000});
 const data={packId:'icy-rush',quantity:2,expectedPriceCents:null,expectedVersion:0};
 await assert.rejects(()=>f.call('member','purchase',data),code('failed-precondition'));
 await f.db.runTransaction(async tx=>tx.set(f.db.doc('packContents/icy-rush'),{...defaultPack('icy-rush'),enabled:true,version:1}));
 await assert.rejects(()=>f.call('member','purchase',{...data,expectedVersion:1}),code('failed-precondition'));
 await f.db.runTransaction(async tx=>tx.set(f.db.doc('packContents/icy-rush'),{...defaultPack('icy-rush'),enabled:true,priceCents:1500,version:2}));
 await assert.rejects(()=>f.call('member','purchase',{...data,expectedVersion:2,expectedPriceCents:1}),code('failed-precondition'));
 const result=await f.call('member','purchase',{...data,expectedVersion:2,expectedPriceCents:1500});
 assert.equal(result.totalCents,3000);assert.equal(result.cards.length,2);assert.equal(result.balanceCents,7000);
 assert.ok(result.cards.every(card=>card.packId==='icy-rush'));
});


test('reward settings reject positive-odds unconfigured, disabled, invalid and unpriced pack catalogs atomically',async()=>{
 const scenarios=[
  {packId:'icy-rush'},
  {packId:'basic',catalog:{...defaultPack('basic'),enabled:false,version:1}},
  {packId:'basic',catalog:{...defaultPack('basic'),items:[],version:1}},
  {packId:'icy-rush',catalog:{...defaultPack('icy-rush'),enabled:true,version:1}}
 ];
 for(const scenario of scenarios){
  const f=fixture();await f.config([credit]);
  if(scenario.catalog)await f.db.runTransaction(async tx=>tx.set(f.db.doc('packContents/'+scenario.packId),scenario.catalog));
  const op=randomUUID(),config={enabled:true,prizes:[{...pack,packId:scenario.packId}]};
  await assert.rejects(()=>f.call('owner','saveRewards',{config,expectedVersion:1},op,{sub:'owner',phone_number:OWNER_PHONE}),code('failed-precondition'));
  const saved=await f.call('owner','rewardState');assert.equal(saved.config.version,1);assert.deepEqual(saved.config.prizes,[credit]);
  const operation=await f.db.runTransaction(tx=>tx.get(f.db.doc('testAccounts/owner/operations/'+op)));assert.equal(operation.exists,false);
 }
});

test('catalog changes pause the entire claim without rerolling, consuming cooldown or recording an operation',async()=>{
 const f=fixture(),prizes=[{...credit,chanceBps:9999},{...pack,chanceBps:1}];await f.config(prizes);
 await f.call('member','topup',{amountCents:1000});const before=await f.call('member','snapshot');
 const catalog={...defaultPack('basic'),enabled:false,version:1};
 await f.db.runTransaction(async tx=>tx.set(f.db.doc('packContents/basic'),catalog));
 const op=randomUUID();await assert.rejects(()=>f.call('member','claimReward',{expectedVersion:1},op),code('failed-precondition'));
 const after=await f.call('member','snapshot');assert.deepEqual(after,before);
 assert.equal((await f.call('member','rewardState')).nextClaimAtMs,0);
 const operation=await f.db.runTransaction(tx=>tx.get(f.db.doc('testAccounts/member/operations/'+op)));assert.equal(operation.exists,false);
 await f.db.runTransaction(async tx=>tx.set(f.db.doc('packContents/basic'),{...catalog,enabled:true}));
 const won=await f.call('member','claimReward',{expectedVersion:1},op);assert.ok(won.prize);assert.ok(won.nextClaimAtMs>0);
});

test('unavailable zero-chance pack prizes do not prevent publishing or claiming reachable rewards',async()=>{
 const f=fixture(),prizes=[credit,{...pack,packId:'icy-rush',chanceBps:0}];
 await f.config(prizes);const won=await f.call('member','claimReward',{expectedVersion:1});
 assert.equal(won.prize.id,'credit');assert.equal(won.balanceCents,125);
 assert.deepEqual((await f.call('member','rewardState')).config.prizes,prizes);
});


test('owners can pause rewards with unavailable prizes but must repair the catalog before enabling',async()=>{
 const f=fixture();await f.config([pack]);
 const catalog={...defaultPack('basic'),enabled:false,version:1};
 await f.db.runTransaction(async tx=>tx.set(f.db.doc('packContents/basic'),catalog));
 const claims={sub:'owner',phone_number:OWNER_PHONE},config={enabled:false,prizes:[pack]};
 await f.call('owner','saveRewards',{config,expectedVersion:1},randomUUID(),claims);
 assert.equal((await f.call('owner','rewardState')).config.enabled,false);
 await assert.rejects(()=>f.call('member','claimReward',{expectedVersion:2}),code('failed-precondition'));
 await assert.rejects(()=>f.call('owner','saveRewards',{config:{...config,enabled:true},expectedVersion:2},randomUUID(),claims),code('failed-precondition'));
 assert.equal((await f.call('owner','rewardState')).config.version,2);
 await f.db.runTransaction(async tx=>tx.set(f.db.doc('packContents/basic'),{...catalog,enabled:true}));
 await f.call('owner','saveRewards',{config:{...config,enabled:true},expectedVersion:2},randomUUID(),claims);
 const saved=await f.call('owner','rewardState');assert.equal(saved.config.enabled,true);assert.equal(saved.config.version,3);
 assert.equal((await f.call('member','claimReward',{expectedVersion:3})).prize.packId,'basic');
});


test('owned seasonal packs remain redeemable after sales end without a configured sale price',async()=>{
 const f=fixture(),seasonalPrize={id:'winter-pack',kind:'pack',packId:'icy-rush',chanceBps:10000};
 const enabled={...defaultPack('icy-rush'),enabled:true,priceCents:1500,version:1};
 await f.db.runTransaction(async tx=>tx.set(f.db.doc('packContents/icy-rush'),enabled));
 await f.config([seasonalPrize]);
 const reward=await f.call('member','claimReward',{expectedVersion:1});
 const ended={...enabled,enabled:false,priceCents:null,version:2};
 await f.db.runTransaction(async tx=>tx.set(f.db.doc('packContents/icy-rush'),ended));
 await assert.rejects(()=>f.call('member','purchase',{packId:'icy-rush',quantity:1,expectedPriceCents:null,expectedVersion:2}),code('failed-precondition'));
 await assert.rejects(()=>f.call('member','openInventoryPack',{packId:'icy-rush',inventoryPackId:reward.inventoryPackId,quantity:1,expectedVersion:1}),code('failed-precondition'));
 let saved=await f.call('member','snapshot');assert.equal(saved.packs[0].status,'available');assert.equal(saved.items.length,0);
 f.advance(REWARD_COOLDOWN_MS);
 await assert.rejects(()=>f.call('new-member','claimReward',{expectedVersion:1}),code('failed-precondition'));
 const data={packId:'icy-rush',inventoryPackId:reward.inventoryPackId,quantity:1,expectedVersion:2,expectedPriceCents:999999};
 const op=randomUUID(),opened=await f.call('member','openInventoryPack',data,op);
 assert.equal(opened.totalCents,0);assert.equal(opened.balanceCents,0);assert.equal(opened.cards.length,1);
 assert.ok(ended.items.some(card=>card.id===opened.cards[0].catalogItemId));
 assert.deepEqual(await f.call('member','openInventoryPack',data,op),opened);
 await assert.rejects(()=>f.call('member','openInventoryPack',data),code('failed-precondition'));
 saved=await f.call('member','snapshot');assert.equal(saved.packs[0].status,'opened');assert.equal(saved.items.length,1);
});

test('exact inventory-pack lookup is authenticated, account scoped and includes opened records',async()=>{
 const f=fixture();await f.config([pack]);const reward=await f.call('member','claimReward',{expectedVersion:1});
 const data={inventoryPackId:reward.inventoryPackId};
 // Exact lookup must work even after 200 newer opened packs hide this award
 // from the first snapshot page.
 await f.db.runTransaction(async tx=>{
  for(let i=0;i<201;i++)tx.set(f.db.doc('testAccounts/member/packs/newer-pack-'+String(i).padStart(4,'0')),{packId:'basic',status:'opened',wonAt:Date.now()+10000});
 });
 assert.equal((await f.call('member','snapshot')).packs.some(p=>p.id===reward.inventoryPackId),false);
 assert.equal((await f.call('member','inventoryPack',data)).pack.status,'available');
 await assert.rejects(()=>f.call(null,'inventoryPack',data),code('unauthenticated'));
 await assert.rejects(()=>f.call('other','inventoryPack',data),code('not-found'));
 await assert.rejects(()=>f.call('member','inventoryPack',{...data,accountUid:'other'}),code('unauthenticated'));
 for(const inventoryPackId of ['../private','short','x'.repeat(81)])await assert.rejects(()=>f.call('member','inventoryPack',{inventoryPackId}),code('invalid-argument'));
 await f.call('member','openInventoryPack',{packId:'basic',inventoryPackId:reward.inventoryPackId,quantity:1,expectedVersion:0});
 assert.equal((await f.call('member','inventoryPack',data)).pack.status,'opened');
});


test('an owned seasonal pack never substitutes concept defaults when its saved catalog is missing',async()=>{
 const f=fixture(),inventoryPackId=randomUUID();await f.call('member','snapshot');
 await f.db.runTransaction(async tx=>tx.set(f.db.doc('testAccounts/member/packs/'+inventoryPackId),{id:inventoryPackId,packId:'icy-rush',status:'available',name:'Icy Rush pack',wonAt:Date.now()}));
 const before=await f.call('member','snapshot'),operationId=randomUUID();
 await assert.rejects(()=>f.call('member','openInventoryPack',{packId:'icy-rush',inventoryPackId,quantity:1,expectedVersion:0},operationId),code('failed-precondition'));
 assert.deepEqual(await f.call('member','snapshot'),before);
 assert.equal((await f.db.runTransaction(tx=>tx.get(f.db.doc('testAccounts/member/operations/'+operationId)))).exists,false);
});
