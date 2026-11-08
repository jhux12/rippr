import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {accountService} from '../functions/service.js';
import {defaultJourney} from '../functions/journey-model.js';
import {memoryDatabase} from './helpers/memory-database.mjs';
const error=code=>e=>e.code===code;
function setup(time=Date.UTC(2026,10,8)){const db=memoryDatabase(),run=accountService(db,{now:()=>time}),act=(uid,action,data={},id=randomUUID(),claims={})=>run(uid,{action,...data,operationId:id},claims);return{db,act,owner:(action,data={},id)=>act('owner',action,data,id,{sub:'owner',phone_number:'+17654794230'}),setTime:t=>time=t}}
async function seed(db,uid,count){await db.runTransaction(async tx=>{for(let i=0;i<count;i++)tx.create(db.doc(`testAccounts/${uid}/items/item-${i}`),{catalogItemId:'catalog-'+i,name:'Card '+i,image:'assets/card-solar-flare.svg',rarity:['Common','Uncommon','Rare','Ultra rare','Legendary'][i%5],status:i%2?'sold':'available',wonAt:i})})}
test('history migration includes more than the inventory page limit; milestone claims are atomic and packs open free',async()=>{
 const {db,act}=setup();await seed(db,'collector',240);
 let state=await act('collector','journeyState');assert.equal(state.uniqueCount,240);assert.equal(state.rarities.length,5);
 await db.runTransaction(async tx=>tx.create(db.doc('testAccounts/collector/items/duplicate'),{catalogItemId:'catalog-1',rarity:'Common',wonAt:999}));
 state=await act('collector','journeyState');assert.equal(state.uniqueCount,240);
 const results=await Promise.allSettled([act('collector','claimJourney',{id:'milestone-25',expectedVersion:0}),act('collector','claimJourney',{id:'milestone-25',expectedVersion:0})]);assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
 const snapshot=await act('collector','snapshot');assert.equal(snapshot.packs.length,1);const owned=snapshot.packs[0];assert.equal(owned.source,'milestone-25');
 const open=await act('collector','openInventoryPack',{packId:'basic',inventoryPackId:owned.id,quantity:1,expectedVersion:0});assert.equal(open.totalCents,0);assert.equal(open.cards.length,1);
 await assert.rejects(()=>act('collector','claimJourney',{id:'milestone-25',expectedVersion:0}),error('failed-precondition'));
});
test('only server progress unlocks milestones and rarity cosmetics; equipment persists and locked items cannot be equipped',async()=>{
 const {db,act}=setup();await assert.rejects(()=>act(null,'journeyState'),error('unauthenticated'));
 await assert.rejects(()=>act('new','claimJourney',{id:'milestone-25',expectedVersion:0,uniqueCount:999}),error('failed-precondition'));
 await assert.rejects(()=>act('new','equipCosmetics',{equipment:{avatar:'winter',frame:'gold',background:'aurora'}}),error('permission-denied'));
 await seed(db,'collector',10);await act('collector','claimJourney',{id:'milestone-10',expectedVersion:0});await act('collector','claimJourney',{id:'rarity-set',expectedVersion:0});
 await act('collector','equipCosmetics',{equipment:{avatar:'celebrate',frame:'violet',background:'default'}});
 const state=await act('collector','journeyState');assert.equal(state.equipped.avatar,'celebrate');assert.equal(state.equipped.frame,'violet');assert.ok(state.owned.includes('frame:cyan'));
});
test('season eligibility uses server dates and each season can be claimed only once',async()=>{
 const {act,setTime}=setup();const id='season-winter-2026';const op=randomUUID();await act('member','claimJourney',{id,expectedVersion:0},op);await act('member','claimJourney',{id,expectedVersion:0},op);
 await assert.rejects(()=>act('member','claimJourney',{id,expectedVersion:0}),error('failed-precondition'));
 const state=await act('member','journeyState');assert.ok(state.owned.includes('avatar:winter'));assert.ok(state.owned.includes('background:winter'));
 setTime(Date.UTC(2027,3,1));await assert.rejects(()=>act('other','claimJourney',{id,expectedVersion:0,serverTimeMs:Date.UTC(2026,11,1)}),error('failed-precondition'));
});
test('only verified owner may change reward configuration and stale saves or claims fail',async()=>{
 const {act,owner}=setup(),config={...defaultJourney(),referralLimit:1};
 await assert.rejects(()=>act('member','saveJourney',{config,expectedVersion:0}),error('permission-denied'));
 await owner('saveJourney',{config,expectedVersion:0});await assert.rejects(()=>owner('saveJourney',{config,expectedVersion:0}),error('failed-precondition'));
 await assert.rejects(()=>owner('saveJourney',{config:{...config,seasonEndMs:0},expectedVersion:1}),error('invalid-argument'));
 await assert.rejects(()=>act('member','claimJourney',{id:'season-winter-2026',expectedVersion:0}),error('failed-precondition'));
});
test('referrals bind once before openings, reject self-referral and pay both accounts once after a qualifying purchase',async()=>{
 const {act}=setup(),state=await act('referrer','journeyState');await act('buyer','journeyState');
 await assert.rejects(()=>act('referrer','bindReferral',{code:state.referralCode,expectedVersion:0}),error('failed-precondition'));
 await act('buyer','bindReferral',{code:state.referralCode,expectedVersion:0});await assert.rejects(()=>act('buyer','bindReferral',{code:state.referralCode,expectedVersion:0}),error('failed-precondition'));
 await act('buyer','topup',{amountCents:1000});const id=randomUUID(),purchase={packId:'basic',quantity:1,expectedPriceCents:199,expectedVersion:0};await act('buyer','purchase',purchase,id);await act('buyer','purchase',purchase,id);
 assert.equal((await act('buyer','snapshot')).account.balanceCents,826);let referrer=await act('referrer','snapshot');assert.equal(referrer.account.balanceCents,25);assert.equal(referrer.account.referralCount,1);
 await act('buyer','purchase',purchase);referrer=await act('referrer','snapshot');assert.equal(referrer.account.balanceCents,25);assert.equal(referrer.account.referralCount,1);
 await assert.rejects(()=>act('buyer','bindReferral',{code:state.referralCode,expectedVersion:0}),error('failed-precondition'));
});
test('free reward packs do not qualify for referral bonuses and referrer caps are enforced',async()=>{
 const {db,act,owner}=setup();await owner('saveJourney',{config:{...defaultJourney(),referralLimit:1},expectedVersion:0});const invite=(await act('referrer','journeyState')).referralCode;
 await act('buyer','bindReferral',{code:invite,expectedVersion:1});const pack=randomUUID();await db.runTransaction(async tx=>tx.create(db.doc(`testAccounts/buyer/packs/${pack}`),{packId:'basic',status:'available',wonAt:1}));
 await act('buyer','openInventoryPack',{inventoryPackId:pack,packId:'basic',quantity:1,expectedVersion:0});assert.equal((await act('referrer','snapshot')).account.balanceCents,0);
 await act('buyer','topup',{amountCents:1000});await act('buyer','purchase',{packId:'basic',quantity:1,expectedVersion:0,expectedPriceCents:199});
 await assert.rejects(()=>act('other','bindReferral',{code:invite,expectedVersion:1}),error('failed-precondition'));
});
