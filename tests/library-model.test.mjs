import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanLibraryCard, validateLibraryCard, csvCandidates, parseCSV, importPreview, libraryCSV, addLibraryToPack, libraryCardReady, referenceURLValid, browseLibraryCards, libraryAddedTime } from '../src/library-model.js';
import { cardFromTCGdex, createTCGdex, tcgdexImage, tcgplayerQuotes, matchingPriceQuote, importPriceQuote, providerPriceRange, sortProviderMatches } from '../src/library-provider.js';
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
test('metadata parsing never labels market references as verified Near Mint or slab values',()=>{
  const imported=cardFromTCGdex({id:'swsh7-215',name:'Umbreon VMAX',image:'https://assets.tcgdex.net/en/swsh/swsh7/215',localId:'215',set:{name:'Evolving Skies'},rarity:'Secret Rare',pricing:{tcgplayer:{unit:'USD',updated:new Date().toISOString(),normal:{marketPrice:123.45},holofoil:{marketPrice:234.56}}}});
  // The documented variant feed has no condition field. Normal means non-foil,
  // not Near Mint; it cannot establish a condition-specific sell-back valuation.
  assert.equal(imported.valueCents,null);
  assert.equal(libraryCardReady(imported),false);
  assert.equal(imported.grading,undefined);
});
test('TCGplayer quotes use listed USD market values per finish, rounded to cents',()=>{
  const now=Date.now(),data={pricing:{tcgplayer:{unit:'USD',updated:new Date(now).toISOString(),normal:{marketPrice:1.005,lowPrice:0.01,midPrice:999},holofoil:{marketPrice:12.34},'reverse-holofoil':{marketPrice:4.56}},cardmarket:{unit:'EUR',trend:99}}};
  const quotes=tcgplayerQuotes(data,now);
  assert.deepEqual(quotes.map(q=>[q.finish,q.valueCents]),[['Standard',101],['Holofoil',1234],['Reverse holo',456]]);
  assert(quotes.every(q=>q.currency==='USD'&&!q.stale));
});
test('missing, non-USD, invalid or zero prices never become fabricated values',()=>{
  const now=Date.now(),feed={unit:'USD',updated:new Date(now).toISOString(),normal:{marketPrice:2}};
  for(const replacement of [undefined,{...feed,unit:'EUR'},{...feed,updated:'unknown'},{...feed,updated:new Date(now+600000).toISOString()},{...feed,normal:{marketPrice:null}},{...feed,normal:{marketPrice:'2.00'}},{...feed,normal:{lowPrice:2}},{...feed,normal:{marketPrice:0}},{...feed,normal:{marketPrice:-1}},{...feed,normal:{marketPrice:1000001}}])assert.deepEqual(tcgplayerQuotes({pricing:{tcgplayer:replacement}},now),[]);
  const old=tcgplayerQuotes({pricing:{tcgplayer:{...feed,updated:new Date(now-8*86400000).toISOString()}}},now);assert.equal(old[0].stale,true);assert.equal(old[0].valueCents,200);
});
test('finish matching preserves slab values and requires a choice for unknown or conflicting variants',()=>{
  const feed={unit:'USD',updated:new Date().toISOString(),normal:{marketPrice:2},holo:{marketPrice:5},reverse:{marketPrice:3}};
  const quotes=tcgplayerQuotes({pricing:{tcgplayer:feed}});
  assert.equal(matchingPriceQuote(raw(),quotes).valueCents,200);
  assert.equal(matchingPriceQuote(raw({finish:'Reverse holo'}),quotes).valueCents,300);
  assert.equal(matchingPriceQuote(raw({finish:'1st edition'}),quotes),null);
  assert.equal(matchingPriceQuote(raw({grading:{company:'PSA',grade:'10'}}),quotes),null);
  const conflicting=tcgplayerQuotes({pricing:{tcgplayer:{...feed,holofoil:{marketPrice:9}}}});assert.equal(matchingPriceQuote(raw({finish:'Holofoil'}),conflicting),null);
});
test('new imports select standard or a single unambiguous finish, never the highest-priced variant',()=>{
  const quote=(key,finish,valueCents)=>({key,finish,valueCents});
  assert.equal(importPriceQuote([quote('normal','Standard',200),quote('holofoil','Holofoil',5000)]).valueCents,200);
  assert.equal(importPriceQuote([quote('holofoil','Holofoil',500)]).key,'holofoil');
  assert.equal(importPriceQuote([quote('holofoil','Holofoil',500),quote('reverse','Reverse holo',300)]),null);
  assert.equal(importPriceQuote([]),null);
});
test('price refresh bypasses cached card data and rejects mismatched provider IDs',async()=>{
  let calls=0;
  const api=createTCGdex(async(url,opts)=>{calls++;if(calls>1)assert.equal(opts.cache,'no-store');return{ok:true,text:async()=>JSON.stringify({id:calls===4?'wrong-id':'swsh7-215',name:'Umbreon VMAX',set:{name:'Evolving Skies'},image:'https://assets.tcgdex.net/en/swsh/swsh7/215',pricing:{tcgplayer:{unit:'USD',updated:new Date().toISOString(),normal:{marketPrice:calls}}}})}});
  await api.card('swsh7-215');await api.card('swsh7-215');assert.equal(calls,1);
  assert.equal((await api.priceDetails('swsh7-215')).quotes[0].valueCents,200);
  assert.equal((await api.priceDetails('swsh7-215')).quotes[0].valueCents,300);
  await assert.rejects(api.priceDetails('swsh7-215'),/different card/);
});
test('library browsing combines inclusive value, site rarity, condition and full identity search',()=>{
  const cards=[raw({id:'cheap',name:'Pikachu',rarity:'Rare',valueCents:100}),raw({id:'foil',rarity:'Rare',finish:'Reverse holo',valueCents:250}),raw({id:'slab',rarity:'Legendary',valueCents:500,grading:{company:'PSA',grade:'10'}}),raw({id:'unpriced'}),raw({id:'zero',valueCents:0,rarity:'Common'})];
  assert.deepEqual(browseLibraryCards(cards,{minValueCents:100,maxValueCents:250,rarity:'Rare',condition:'raw',sort:'value-high'}).map(c=>c.id),['foil','cheap']);
  assert.deepEqual(browseLibraryCards(cards,{search:'reverse holo'}).map(c=>c.id),['foil']);
  assert.deepEqual(browseLibraryCards(cards,{condition:'graded'}).map(c=>c.id),['slab']);
  assert.deepEqual(browseLibraryCards(cards,{minValueCents:0,maxValueCents:0}).map(c=>c.id),['zero']);
  assert.deepEqual(browseLibraryCards(cards,{rarity:'Rare',excludeIds:['cheap']}).map(c=>c.id),['foil']);
  assert.equal(browseLibraryCards(cards,{search:'evolving skies'}).length,5);
});
test('recently added uses immutable creation time, admits legacy v1 first-save time and keeps unknown dates last',()=>{
  const cards=[raw({id:'changed',createdAt:1000,updatedAt:9000,version:5}),raw({id:'new',createdAt:3000,version:2}),raw({id:'legacy-first',updatedAt:2000,version:1}),raw({id:'unknown',updatedAt:10000,version:3})];
  assert.deepEqual(browseLibraryCards(cards).map(c=>c.id),['new','legacy-first','changed','unknown']);
  assert.equal(libraryAddedTime({createdAt:{toMillis:()=>123},version:2}),123);
  assert.equal(libraryAddedTime({version:3,updatedAt:10000}),null);
  assert.equal(libraryAddedTime({createdAt:NaN,version:2}),null);
  assert.equal(cards[0].id,'changed');
});
test('value sorts keep unpriced records last, preserve zero and use stable name/ID ties',()=>{
  const cards=[raw({id:'unknown',name:'A'}),raw({id:'zero',valueCents:0}),raw({id:'high',valueCents:500}),raw({id:'b',valueCents:100}),raw({id:'a',valueCents:100})];
  assert.deepEqual(browseLibraryCards(cards,{sort:'value-low'}).map(c=>c.id),['zero','a','b','high','unknown']);
  assert.deepEqual(browseLibraryCards(cards,{sort:'value-high'}).map(c=>c.id),['high','a','b','zero','unknown']);
  for(const options of [{minValueCents:300,maxValueCents:200},{minValueCents:NaN},{maxValueCents:100000001},{sort:'fake'},{condition:'fake'}])assert.throws(()=>browseLibraryCards(cards,options));
});
test('import search prices expose finish ranges and sort by the lowest listed value without fabricating missing prices',()=>{
  const cards=[{id:'unpriced',name:'A missing',quotes:[]},{id:'high',name:'Expensive',quotes:[{finish:'Holofoil',valueCents:10000}]},{id:'range',name:'Mixed finishes',quotes:[{finish:'Holofoil',valueCents:2000},{finish:'Reverse holo',valueCents:200}]},{id:'low',name:'Low',quotes:[{finish:'Standard',valueCents:25}]}];
  assert.deepEqual(providerPriceRange(cards[2]),{minCents:200,maxCents:2000,finishes:2});assert.equal(providerPriceRange(cards[0]),null);
  assert.deepEqual(sortProviderMatches(cards,'value-high').map(c=>c.id),['high','range','low','unpriced']);
  assert.deepEqual(sortProviderMatches(cards,'value-low').map(c=>c.id),['low','range','high','unpriced']);
  assert.deepEqual(sortProviderMatches(cards,'source').map(c=>c.id),cards.map(c=>c.id));assert.equal(cards[0].id,'unpriced');
  assert.throws(()=>sortProviderMatches(cards,'fake'));
});
test('rate-limit errors retain HTTP status so search can stop additional price requests',async()=>{
  const api=createTCGdex(async()=>({ok:false,status:429}));await assert.rejects(api.priceDetails('base1-4'),error=>error.status===429);
});
