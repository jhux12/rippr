import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultPack, validateItems } from '../src/catalog-model.js';
import { expectedValue, generateOdds } from '../src/odds-calculator.js';

const cards = values => values.map((valueCents, i) => ({ ...defaultPack('basic').items[0], id:'item-' + i, valueCents, chanceBps:i ? 0 : 10000 }));

test('EV is a probability-weighted average, including zero-value prizes', () => {
  assert.equal(expectedValue(cards([199])), 199);
  assert.equal(expectedValue([{valueCents:0,chanceBps:7500},{valueCents:10000,chanceBps:2500}]), 2500);
  assert.equal(expectedValue([{valueCents:100,chanceBps:9999}]), null);
  assert.equal(expectedValue([{valueCents:100,chanceBps:-1}]), null);
  assert.equal(expectedValue([]), null);
  assert.equal(expectedValue([null]), null);
});

test('two-item target has the known exact odds', () => {
  const result = generateOdds(cards([100,300]),150,{includeZero:true});
  assert.deepEqual(result.items.map(item=>item.chanceBps),[7500,2500]);
  assert.equal(result.actualCents,150);
});

test('generates valid published odds near a fractional-cent EV without mutating cards', () => {
  const items = defaultPack('basic').items, before = structuredClone(items);
  const result = generateOdds(items, 199 * .9);
  assert.deepEqual(validateItems(result.items), []);
  assert.deepEqual(items, before);
  assert.ok(result.items.every(item => item.chanceBps >= 1));
  assert.ok(Math.abs(result.actualCents - 179.1) < .1);
  assert.equal(result.actualCents, expectedValue(result.items));
  assert.notDeepEqual(result.items.map(item => item.chanceBps), items.map(item => item.chanceBps));
  assert.deepEqual(generateOdds(items,179.1), result);
});

test('zero-percent items stay excluded unless explicitly included', () => {
  const items = cards([0,10000]);
  const excluded = generateOdds(items,0);
  assert.deepEqual(excluded.items.map(item=>item.chanceBps),[10000,0]);
  assert.throws(()=>generateOdds(items,5000), /Reachable EV/);
  const included = generateOdds(items,5000,{includeZero:true});
  assert.deepEqual(included.items.map(item=>item.chanceBps),[5000,5000]);
  const allZero = items.map(item=>({...item,chanceBps:0}));
  assert.throws(()=>generateOdds(allZero,5000), /at least one item/);
  assert.equal(generateOdds(allZero,5000,{includeZero:true}).actualCents,5000);
});

test('reachable range reserves a 0.01% chance for every included card', () => {
  const items = cards([0,100000000]);
  assert.throws(()=>generateOdds(items,0,{includeZero:true}), /Reachable EV/);
  const low = generateOdds(items,10000,{includeZero:true});
  assert.equal(low.actualCents,10000);
  assert.deepEqual(low.items.map(item=>item.chanceBps),[9999,1]);
  const high = generateOdds(items,99990000,{includeZero:true});
  assert.deepEqual(high.items.map(item=>item.chanceBps),[1,9999]);
});

test('identical values, one item, and zero-value packs have exact EVs', () => {
  const equal = generateOdds(cards([199,199,199]),199,{includeZero:true});
  assert.equal(equal.actualCents,199);
  assert.deepEqual(equal.items.map(item=>item.chanceBps).sort(),[3333,3333,3334]);
  assert.equal(generateOdds(cards([0]),0).actualCents,0);
  assert.equal(generateOdds(cards([100000000]),100000000).actualCents,100000000);
  assert.throws(()=>generateOdds(cards([199]),200), /Reachable EV/);
});

test('invalid targets and card data are rejected; incomplete totals can be repaired', () => {
  const items = defaultPack('basic').items;
  for (const target of [NaN,Infinity,-1,100000001,'90']) assert.throws(()=>generateOdds(items,target));
  assert.throws(()=>generateOdds([],100));
  assert.throws(()=>generateOdds([{...items[0],valueCents:-1}],100));
  const unfinished = items.map(item=>({...item,chanceBps:1}));
  assert.deepEqual(validateItems(generateOdds(unfinished,179.1).items),[]);
});

test('rounding reports a discrete result instead of claiming the target is exact', () => {
  const result=generateOdds(cards([0,100000000]),12345,{includeZero:true});
  assert.equal(result.targetCents,12345);
  assert.equal(result.actualCents,10000);
  assert.notEqual(result.targetCents,result.actualCents);
});

test('varied catalogs keep exact totals, metadata, and nonzero included chances', () => {
  let seed=42;
  const random=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/2**32};
  for(let sample=0;sample<60;sample++){
    const items=cards(Array.from({length:1+Math.floor(random()*100)},()=>Math.floor(random()*100000000)));
    const values=items.map(item=>item.valueCents), base=values.reduce((a,b)=>a+b,0)/10000;
    const low=base+(10000-items.length)*Math.min(...values)/10000;
    const high=base+(10000-items.length)*Math.max(...values)/10000;
    const target=low+(high-low)*random();
    const result=generateOdds(items,target,{includeZero:true});
    assert.deepEqual(validateItems(result.items),[]);
    assert.ok(result.items.every(item=>item.chanceBps>=1));
    assert.deepEqual(result.items.map(({chanceBps,...item})=>item),items.map(({chanceBps,...item})=>item));
    assert.ok(Math.abs(result.actualCents-target)<=(Math.max(...values)-Math.min(...values))/10000+.00001);
  }
});
