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
