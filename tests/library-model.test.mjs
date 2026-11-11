import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanLibraryCard, validateLibraryCard, csvCandidates, parseCSV, importPreview, libraryCSV, addLibraryToPack, libraryCardReady, referenceURLValid } from '../src/library-model.js';
import { cardFromTCGdex, createTCGdex, tcgdexImage } from '../src/library-provider.js';
import { defaultPack } from '../src/catalog-model.js';

const raw = (extra = {}) => ({...cleanLibraryCard({id:'tdx-en-swsh7-215',name:'Umbreon VMAX',image:'https://assets.tcgdex.net/en/swsh/swsh7/215/high.webp',source:'tcgdex',sourceId:'swsh7-215',setName:'Evolving Skies',number:'215'}),...extra});
test('library preserves unknown values and separates source rarity from rippr rarity',()=>{
  const card=raw({sourceRarity:'Secret Rare'});
  assert.deepEqual(validateLibraryCard(card),[]);assert.equal(libraryCardReady(card),false);assert.equal(card.valueCents,null);assert.equal(card.rarity,null);
  assert.equal(libraryCardReady(raw({valueCents:0,rarity:'Rare'})),true);
  assert.equal(validateLibraryCard(raw({valueCents:-1})).length,1);
  assert.equal(validateLibraryCard(raw({grading:{company:'PSA',grade:'9.5'}})).length,1);
  assert.equal(referenceURLValid('https://www.tcgplayer.com/product/123'),true);
  for(const url of ['https://tcgplayer.com.evil.test/product/1','javascript:alert(1)','https://x@tcgplayer.com/product/1','https://other.test'])assert.equal(referenceURLValid(url),false);
});
test('CSV handles BOM, quoted commas, newlines, quotes and CRLF without losing rows',()=>{
  const csv='\ufeffid,name,image,value\r\na,"Card, \"\"Gold\"\"\nEdition",https://example.com/a.webp,2.50\r\n';
  const cards=csvCandidates(csv);assert.equal(cards[0].name,'Card, "Gold"\nEdition');assert.equal(cards[0].valueCents,250);
  for(const bad of ['id,name\na,"no end','id,name\na,"closed"junk','id,name\na,b,c','id,id\na,b','name\na','id,unknown\na,b'])assert.throws(()=>csvCandidates(bad));
  assert.throws(()=>parseCSV('x'.repeat(2*1024*1024+1)));
  assert.throws(()=>csvCandidates('id\n'+Array.from({length:501},(_,i)=>'a'+i).join('\n')));
});
test('partial price CSV updates exact IDs, retains image and slab grade, never changes other finishes',()=>{
  const slab=raw({id:'slab-psa10',valueCents:10000,rarity:'Legendary',grading:{company:'PSA',grade:'10'},version:4});
  const foil=raw({id:'foil',valueCents:500,rarity:'Rare',finish:'Reverse holo',version:2});
  const preview=importPreview(csvCandidates('id,value\nslab-psa10,110.25'),[slab,foil],'update');
  assert.equal(preview.updated,1);assert.deepEqual(preview.errors,[]);assert.equal(preview.changes[0].valueCents,11025);assert.equal(preview.changes[0].version,4);assert.deepEqual(preview.changes[0].grading,slab.grading);assert.equal(preview.changes[0].image,slab.image);assert.equal(foil.valueCents,500);
  const keep=importPreview(csvCandidates('id,value\nslab-psa10,'),[slab],'update');assert.equal(keep.changes[0].valueCents,10000);
  assert.throws(()=>csvCandidates('id,gradingCompany,grade\nslab,PSA,'));
});
test('import preview reports duplicates and invalid rows; imports skip existing records by default',()=>{
  const saved=raw({version:3,valueCents:800});
  const skip=importPreview([raw()], [saved]);assert.equal(skip.changes.length,0);assert.equal(skip.skipped.length,1);
  const bad=importPreview([raw(),raw(),raw({id:'different',valueCents:NaN})],[],'update');assert.equal(bad.errors.length,2);
  assert.throws(()=>importPreview([],[]));assert.throws(()=>importPreview([raw()],[],'replace'));
});
test('CSV exports values/grades for updates and blocks spreadsheet formulas',()=>{
  const csv=libraryCSV([raw({name:'=SUM(1,2)',valueCents:125,rarity:'Rare',grading:{company:'CGC',grade:'9.5'}})]);
  assert.equal(csvCandidates(csv)[0].name,"'=SUM(1,2)");assert.equal(csvCandidates(csv)[0].valueCents,125);assert.equal(csvCandidates(csv)[0].grading.grade,'9.5');
  assert.equal(csvCandidates(libraryCSV([raw({id:'-valid-id'})]))[0].id,'-valid-id');
});
test('adding library cards preserves every existing pack chance/value and keeps new odds at zero',()=>{
  const pack=defaultPack('basic'),before=structuredClone(pack.items);
  const slab=raw({valueCents:30000,rarity:'Legendary',grading:{company:'PSA',grade:'10'}});
  const result=addLibraryToPack(pack.items,[slab,slab]);assert.equal(result.added,1);assert.equal(result.skipped,1);assert.deepEqual(result.items.slice(0,before.length),before);assert.equal(result.items.at(-1).chanceBps,0);assert.deepEqual(result.items.at(-1).grading,slab.grading);
  assert.throws(()=>addLibraryToPack(before,[raw()]),/needs a value/);
  assert.throws(()=>addLibraryToPack(Array.from({length:100},(_,i)=>({...before[0],id:'x'+i})),[slab]),/up to 100/);
});
test('TCGdex adapter uses documented query/pagination, safe image host and stable English IDs',async()=>{
  const urls=[];
  const api=createTCGdex(async(url,opts)=>{urls.push(url);assert.equal(opts.credentials,'omit');return{ok:true,text:async()=>JSON.stringify(url.includes('/cards?')?[{id:'swsh7-215',name:'Umbreon VMAX',image:'https://assets.tcgdex.net/en/swsh/swsh7/215',localId:'215'}]:{id:'swsh7-215',name:'Umbreon VMAX',image:'https://assets.tcgdex.net/en/swsh/swsh7/215',localId:'215',set:{name:'Evolving Skies'},rarity:'Secret Rare'})}});
  const found=await api.search({name:'Umbreon',setId:'swsh7',page:2});assert.equal(found.length,1);assert.equal(new URL(urls[0]).searchParams.get('set.id'),'eq:swsh7');assert.equal(new URL(urls[0]).searchParams.get('pagination:page'),'2');
  const card=await api.card(found[0].id);assert.equal(card.id,'tdx-en-swsh7-215');assert.equal(card.rarity,null);assert.equal(card.valueCents,null);assert.equal(card.sourceRarity,'Secret Rare');assert.deepEqual(validateLibraryCard(card),[]);
  await api.card(found[0].id);assert.equal(urls.length,2);
  assert.equal(tcgdexImage('https://evil.test/a'),'');assert.equal(tcgdexImage('https://assets.tcgdex.net@evil.test/a'),'');assert.throws(()=>cardFromTCGdex({id:'bad',name:'Missing artwork'}));
  await assert.rejects(api.search({name:'a'}));await assert.rejects(api.card('../secret'));
});
test('provider failures are actionable and never substitute fabricated cards or prices',async()=>{
  const api=createTCGdex(async()=>({ok:false,status:429}));await assert.rejects(api.search({name:'Pikachu'}),/429.*CSV/);
  const malformed=createTCGdex(async()=>({ok:true,text:async()=>'{}'}));await assert.rejects(malformed.search({name:'Pikachu'}),/Unexpected/);
  const timeout=createTCGdex(async()=>{throw Object.assign(new Error('aborted'),{name:'AbortError'})});await assert.rejects(timeout.card('base1-4'),/timed out/);
});
test('condition-unverified TCGplayer market references never become Near Mint values on import',()=>{
  const imported=cardFromTCGdex({id:'swsh7-215',name:'Umbreon VMAX',image:'https://assets.tcgdex.net/en/swsh/swsh7/215',localId:'215',set:{name:'Evolving Skies'},rarity:'Secret Rare',pricing:{tcgplayer:{unit:'USD',updated:new Date().toISOString(),normal:{marketPrice:123.45},holofoil:{marketPrice:234.56}}}});
  // The documented variant feed has no condition field. Normal means non-foil,
  // not Near Mint; it cannot establish a condition-specific sell-back valuation.
  assert.equal(imported.valueCents,null);
  assert.equal(libraryCardReady(imported),false);
  assert.equal(imported.grading,undefined);
});
