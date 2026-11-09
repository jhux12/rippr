import {test} from 'node:test';
import assert from 'node:assert/strict';
import {museumService} from '../functions/museum-service.js';
import {memoryDatabase} from './helpers/memory-database.mjs';
import {cleanMuseumDraft} from '../src/museum-model.js';
const code=c=>error=>error.code===c;
function fixture(){
 const db=memoryDatabase();let time=100000;
 const run=museumService(db,{now:()=>time++});
 const call=(uid,action,data={})=>run(uid,{action,...data});
 const seed=async(uid='alice',items=3)=>db.runTransaction(async tx=>{
  tx.set(db.doc('testAccounts/'+uid),{displayName:'Collector '+uid,photoURL:'assets/mascot/pip-welcome.png',balanceCents:50000,phoneNumber:'private-phone',email:'private@example.com',address:{line1:'private address'}});
  for(let i=0;i<items;i++)tx.set(db.doc(`testAccounts/${uid}/items/card-${i}`),{id:'card-'+i,name:'Real card '+i,image:'assets/grail-moonstone.svg',rarity:'Rare',status:'available',valueCents:12345,packId:'basic'});
 });
 const save=(uid='alice',patch={})=>call(uid,'save',{title:'Moonlight museum',description:'My favorite card artwork',cardIds:['card-0','card-1'],published:true,expectedVersion:0,...patch});
 return {db,run,call,seed,save};
}
test('museum drafts have bounded editable text and unique fixed inventory selections',()=>{
 const valid={title:' Gallery ',description:' Favorites ',published:true,cardIds:['card-1'],expectedVersion:0};
 assert.equal(cleanMuseumDraft(valid).title,'Gallery');
 for(const patch of [{title:''},{title:'x'.repeat(61)},{description:'x'.repeat(161)},{published:'true'},{cardIds:[]},{cardIds:['card-1','card-1']},{cardIds:['../private']},{cardIds:Array.from({length:7},(_,i)=>'card-'+i)},{expectedVersion:1.1}])assert.throws(()=>cleanMuseumDraft({...valid,...patch}));
});
test('museums are private until explicitly published and public payloads contain only display fields',async()=>{
 const f=fixture();await f.seed();
 await assert.rejects(()=>f.call(null,'own'),code('unauthenticated'));
 await assert.rejects(()=>f.call(null,'get',{uid:'alice'}),code('not-found'));
 const empty=await f.call('alice','own');assert.equal(empty.museum.version,0);assert.equal(empty.museum.published,false);assert.deepEqual(empty.museum.cards,[]);assert.equal(empty.canEdit,true);
 await f.save('alice',{published:false});assert.equal((await f.call('alice','own')).museum.cards.length,2);
 await assert.rejects(()=>f.call('bob','get',{uid:'alice'}),code('not-found'));
 assert.deepEqual((await f.call(null,'browse')).museums,[]);
 const published=await f.save('alice',{expectedVersion:1,published:true,displayName:'forged',photoURL:'https://forged.example/photo',likeCount:99999});
 assert.equal(published.museum.likeCount,0);assert.equal(published.museum.displayName,'Collector alice');
 const publicView=await f.call(null,'get',{uid:'alice'});assert.equal(publicView.museum.cards.length,2);assert.equal(publicView.canEdit,false);
 for(const forbidden of ['balanceCents','phoneNumber','email','address','valueCents','packId'])assert(!JSON.stringify(publicView).includes(forbidden));
 const browse=await f.call(null,'browse');assert.equal(browse.museums.length,1);assert.equal(browse.museums[0].cardCount,2);assert.equal(browse.museums[0].coverImage,'assets/grail-moonstone.svg');
});
test('saving rejects missing, sold, other-account and forged cards, and stale versions',async()=>{
 const f=fixture();await f.seed();await f.seed('bob');
 await assert.rejects(()=>f.save('missing'),code('failed-precondition'));
 await assert.rejects(()=>f.save('alice',{cardIds:['card-unknown']}),code('failed-precondition'));
 await f.db.runTransaction(async tx=>tx.set(f.db.doc('testAccounts/bob/items/bob-only'),{name:'Other card',image:'assets/grail-moonstone.svg',rarity:'Legendary',status:'available'}));
 await assert.rejects(()=>f.save('alice',{cardIds:['bob-only'],cards:[{id:'bob-only',name:'forged'}]}),code('failed-precondition'));
 await f.db.runTransaction(async tx=>tx.update(f.db.doc('testAccounts/alice/items/card-0'),{status:'sold'}));
 await assert.rejects(()=>f.save('alice'),code('failed-precondition'));
 await f.save('alice',{cardIds:['card-1']});
 await assert.rejects(()=>f.save('alice',{cardIds:['card-1'],expectedVersion:0}),code('failed-precondition'));
 await assert.rejects(()=>f.run('alice',{action:'own',accountUid:'bob'}),code('unauthenticated'));
 await assert.rejects(()=>f.call(null,'get',{uid:'alice/secret'}),code('invalid-argument'));
 const current=await f.call(null,'get',{uid:'alice'});assert.deepEqual(current.museum.cards.map(c=>c.id),['card-1']);
});
test('published galleries always hydrate current ownership and current display identity',async()=>{
 const f=fixture();await f.seed();await f.save();
 await f.db.runTransaction(async tx=>{tx.update(f.db.doc('testAccounts/alice/items/card-0'),{status:'sold'});tx.update(f.db.doc('testAccounts/alice'),{displayName:'Renamed collector'})});
 let museum=(await f.call(null,'get',{uid:'alice'})).museum;assert.equal(museum.displayName,'Renamed collector');assert.deepEqual(museum.cards.map(c=>c.id),['card-1']);assert.equal((await f.call(null,'browse')).museums[0].cardCount,1);
 await f.db.runTransaction(async tx=>tx.update(f.db.doc('testAccounts/alice/items/card-1'),{status:'shipping'}));
 assert.deepEqual((await f.call(null,'get',{uid:'alice'})).museum.cards,[]);assert.deepEqual((await f.call(null,'browse')).museums,[]);
});
test('likes require authentication, exclude self, persist per-account and retry atomically',async()=>{
 const f=fixture();await f.seed();await f.seed('bob');await f.seed('carol');await f.save();
 await assert.rejects(()=>f.call(null,'setLike',{uid:'alice',liked:true}),code('unauthenticated'));
 await assert.rejects(()=>f.call('alice','setLike',{uid:'alice',liked:true}),code('permission-denied'));
 await assert.rejects(()=>f.call('bob','setLike',{uid:'alice',liked:'true'}),code('invalid-argument'));
 await Promise.all(Array.from({length:10},()=>f.call('bob','setLike',{uid:'alice',liked:true})));
 assert.equal((await f.call('bob','get',{uid:'alice'})).museum.likeCount,1);assert.equal((await f.call('bob','get',{uid:'alice'})).museum.likedByMe,true);assert.equal((await f.call('carol','get',{uid:'alice'})).museum.likedByMe,false);
 assert.equal((await f.call('bob','browse')).museums[0].likedByMe,true);assert.equal((await f.call('carol','browse')).museums[0].likedByMe,false);
 await f.call('carol','setLike',{uid:'alice',liked:true});assert.equal((await f.call(null,'get',{uid:'alice'})).museum.likeCount,2);
 await Promise.all(Array.from({length:5},()=>f.call('bob','setLike',{uid:'alice',liked:false})));
 assert.equal((await f.call(null,'get',{uid:'alice'})).museum.likeCount,1);
 await f.save('alice',{expectedVersion:1,published:false});
 await assert.rejects(()=>f.call('bob','setLike',{uid:'alice',liked:true}),code('not-found'));
 await assert.rejects(()=>f.call('bob','get',{uid:'alice'}),code('not-found'));
 assert.deepEqual((await f.call(null,'browse',{sort:'popular'})).museums,[]);
 await f.save('alice',{expectedVersion:2,published:true});assert.equal((await f.call(null,'get',{uid:'alice'})).museum.likeCount,1);
});
test('browse sorts and paginates with stable unique scalar keys, without composite indexes',async()=>{
 const f=fixture();for(let i=0;i<27;i++){const uid='owner-'+String(i).padStart(2,'0');await f.seed(uid);await f.save(uid,{title:'Gallery '+i})}
 await f.seed('fan');await f.call('fan','setLike',{uid:'owner-00',liked:true});
 assert.equal((await f.call(null,'browse',{sort:'popular'})).museums[0].uid,'owner-00');
 const first=await f.call(null,'browse',{sort:'recent'});assert.equal(first.museums.length,24);assert.equal(first.museums[0].uid,'owner-26');assert(first.nextCursor);
 const next=await f.call(null,'browse',{sort:'recent',cursor:first.nextCursor});assert.equal(next.museums.length,3);assert.equal(next.nextCursor,null);assert.equal(new Set([...first.museums,...next.museums].map(m=>m.uid)).size,27);
 const search=await f.call(null,'browse',{sort:'recent',search:'Gallery 25'});assert.equal(search.museums.length,1);assert.equal(search.searchScope,'page');
 await assert.rejects(()=>f.call(null,'browse',{sort:'popular',cursor:first.nextCursor}),code('invalid-argument'));
 await assert.rejects(()=>f.call(null,'browse',{sort:'bogus'}),code('invalid-argument'));
});
