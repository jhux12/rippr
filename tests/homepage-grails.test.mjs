import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultHomepageGrails, validateHomepageGrails, cleanHomepageGrailsItems, readHomepageGrails, defaultPack } from '../src/catalog-model.js';

test('homepage defaults are independent from pack odds and fresh on every read', () => {
  const defaults = defaultHomepageGrails(), other = defaultHomepageGrails();
  assert.equal(defaults.version,0);assert.equal(defaults.source,'default');
  assert.deepEqual(defaults.items.map(x=>x.id),['first-light','ocean-spirit','moonstone']);
  assert.deepEqual(validateHomepageGrails(defaults),[]);
  defaults.items[0].name='Changed';assert.notEqual(other.items[0].name,'Changed');
  assert.notEqual(defaultPack('basic').items.find(x=>x.id==='first-light').name,'Changed');
});
test('an intentionally empty gallery, six photos, and zero or maximum values are valid', () => {
  assert.deepEqual(validateHomepageGrails({items:[]}),[]);
  const items=Array.from({length:6},(_,i)=>({id:'photo-'+i,name:'Gallery card '+i,image:'https://images.example/card.png',valueCents:i?100000000:0}));
  assert.deepEqual(validateHomepageGrails({items}),[]);
  assert.deepEqual(readHomepageGrails({items:[],version:1}),{items:[],version:1,source:'firebase'});
  assert.match(validateHomepageGrails({items:[...items,{...items[0],id:'seventh'}]}).join(' '),/6/);
});
test('invalid values cannot silently round, coerce, or become missing-price claims', () => {
  for(const valueCents of [undefined,null,'12500',1.5,-1,NaN,Infinity,100000001]){
    const config=defaultHomepageGrails();config.items[0].valueCents=valueCents;
    assert.match(validateHomepageGrails(config).join(' '),/value/);
    assert.throws(()=>readHomepageGrails({...config,version:1}),{code:'catalog/invalid-data'});
  }
});
test('homepage records require safe images, unique IDs, and nonblank bounded names', () => {
  for(const image of ['javascript:alert(1)','data:image/svg+xml,<svg/>','//example.com/card.png','http://example.com/card.png','https://name:secret@example.com/card.png','assets/../secret','https://example.com/'+ 'a'.repeat(2048)]){
    const config=defaultHomepageGrails();config.items[0].image=image;assert.ok(validateHomepageGrails(config).length);
  }
  for(const patch of [{id:''},{id:'x'.repeat(81)},{id:'a/b'},{name:'  '},{name:'x'.repeat(161)},{unexpected:true}]){
    const config=defaultHomepageGrails();Object.assign(config.items[0],patch);assert.ok(validateHomepageGrails(config).length);
  }
  const dup=defaultHomepageGrails();dup.items[1].id=dup.items[0].id;assert.match(validateHomepageGrails(dup).join(' '),/unique/);
  for(const item of [null,[],1,'card'])assert.ok(validateHomepageGrails({items:[item]}).length);
});
test('stored galleries reject invalid versions and clean names without mutating inputs', () => {
  const config=defaultHomepageGrails();config.items[0].name='  Card name  ';
  const clean=cleanHomepageGrailsItems(config.items);assert.equal(clean[0].name,'Card name');assert.equal(config.items[0].name,'  Card name  ');
  const saved=readHomepageGrails({...config,version:3,updatedBy:'owner',updatedAt:'timestamp'});
  assert.equal(saved.items[0].name,'Card name');assert.equal(saved.version,3);assert.equal(saved.source,'firebase');
  for(const version of [0,-1,1.5,'1',undefined,NaN,Number.MAX_SAFE_INTEGER+1])assert.throws(()=>readHomepageGrails({...config,version}),{code:'catalog/invalid-data'});
});

// The public document is read-only in Rules; the callable owns full validation.
import {saveHomepageGrails} from '../functions/homepage-grails-service.js';
import {memoryDatabase} from './helpers/memory-database.mjs';
import {OWNER_PHONE} from '../src/catalog-model.js';
const ownerClaims={sub:'owner',phone_number:OWNER_PHONE};
const sixSlabs=()=>Array.from({length:6},(_,i)=>({id:'slab-'+i,name:'  Slab '+i+'  ',image:'https://cards.example/'+i+'.png',valueCents:1000,grading:{company:['PSA','CGC','BGS','SGC','TAG','ACE'][i],grade:'10'}}));
const saveInput=(items=sixSlabs(),expectedVersion=0)=>({action:'saveHomepageGrails',accountUid:'owner',config:{items},expectedVersion});
test('server homepage saves require the verified owner and matching account identity',async()=>{
 const db=memoryDatabase();
 for(const [uid,claims,code] of [[null,null,'unauthenticated'],['member',{sub:'member',phone_number:'+12025550123'},'permission-denied'],['owner',{sub:'someone',phone_number:OWNER_PHONE},'permission-denied'],['owner',{sub:'owner'},'permission-denied'],['owner',{sub:'owner',email:'jhuxf12@outlook.com',email_verified:true},'permission-denied']])await assert.rejects(()=>saveHomepageGrails(db,uid,saveInput(),claims),{code});
 await assert.rejects(()=>saveHomepageGrails(db,'owner',{...saveInput(),accountUid:'member'},ownerClaims),{code:'unauthenticated'});
 assert.equal((await db.runTransaction(tx=>tx.get(db.doc('settings/homepageGrails')))).exists,false);
});
test('server saves six slabs atomically, safely retries, rejects stale concurrent edits, and clears explicitly',async()=>{
 const db=memoryDatabase(),input=saveInput(),run=i=>saveHomepageGrails(db,'owner',i,ownerClaims);
 const first=await run(input);assert.equal(first.version,1);assert.equal(first.items.length,6);assert.equal(first.items[0].name,'Slab 0');
 assert.deepEqual(await run(input),first);
 const edits=await Promise.allSettled([run(saveInput(sixSlabs().map(x=>({...x,valueCents:2000})),1)),run(saveInput(sixSlabs().map(x=>({...x,valueCents:3000})),1))]);
 assert.equal(edits.filter(x=>x.status==='fulfilled').length,1);assert.equal(edits.find(x=>x.status==='rejected').reason.code,'aborted');
 const stored=(await db.runTransaction(tx=>tx.get(db.doc('settings/homepageGrails')))).data();
 assert.equal(stored.updatedBy,'owner');assert.equal(typeof stored.updatedAt,'number');assert.equal(stored.version,2);
 const clear=await run(saveInput([],2));assert.deepEqual(clear.items,[]);assert.equal(clear.version,3);
 await assert.rejects(()=>run(saveInput(sixSlabs(),0)),{code:'aborted'});
});
test('server validates all six slots and rejects injected metadata without partial changes',async()=>{
 const db=memoryDatabase(),run=i=>saveHomepageGrails(db,'owner',i,ownerClaims);
 const bad=[null,[],{id:'missing'},...['','bad/id','x'.repeat(81)].map(id=>({...sixSlabs()[5],id})),...['',' \n\t ','x'.repeat(161)].map(name=>({...sixSlabs()[5],name})),...['javascript:x','data:image/png;base64,eA==','assets/../secret','http://cards.example/x','https://user:password@cards.example/x','https://cards.example/'+ 'x'.repeat(2048)].map(image=>({...sixSlabs()[5],image})),...[-1,1.5,'1000',100000001].map(valueCents=>({...sixSlabs()[5],valueCents})),...[{company:'PSA',grade:'9.5'},{company:'TAG',grade:'9.5'},{company:'ACE',grade:'9.5'},{company:'unknown',grade:'10'},{company:'PSA',grade:'11'},{company:'PSA',grade:'10',extra:true}].map(grading=>({...sixSlabs()[5],grading})),{...sixSlabs()[5],isAdmin:true}];
 for(const item of bad)await assert.rejects(()=>run(saveInput([...sixSlabs().slice(0,5),item])),{code:'invalid-argument'});
 for(let j=1;j<6;j++)for(let i=0;i<j;i++){const items=sixSlabs();items[j].id=items[i].id;await assert.rejects(()=>run(saveInput(items)),{code:'invalid-argument'});}
 for(const expectedVersion of [-1,1.5,'0',Number.MAX_SAFE_INTEGER,undefined])await assert.rejects(()=>run({...saveInput(),expectedVersion}),{code:'invalid-argument'});
 for(const extra of [{updatedBy:'member'},{updatedAt:0},{role:'admin'}])await assert.rejects(()=>run({...saveInput(),...extra}),{code:'invalid-argument'});
 await assert.rejects(()=>run({...saveInput(),config:{items:[],version:1}}),{code:'invalid-argument'});
 await assert.rejects(()=>run(saveInput([...sixSlabs(),{...sixSlabs()[0],id:'seventh'}])),{code:'invalid-argument'});
 assert.equal((await db.runTransaction(tx=>tx.get(db.doc('settings/homepageGrails')))).exists,false);
 const items=sixSlabs().map(x=>({...x,grading:{company:'CGC',grade:'9.5'},valueCents:0}));
 assert.equal((await run(saveInput(items))).version,1);
});
