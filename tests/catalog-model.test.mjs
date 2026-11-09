import test from 'node:test';
import assert from 'node:assert/strict';
import { OWNER_PHONE, PACK_IDS, defaultPack, isAdminUser, isAdminToken, safeImageURL, decimalToUnits, validPackPrice, summarizeRarities, validateItems, readStoredPack, drawItem } from '../src/catalog-model.js';

test('only the designated Firebase phone profile shows the owner UI', () => {
  assert.equal(isAdminUser(null), false);
  assert.equal(isAdminUser({ email:'jhuxf12@outlook.com', emailVerified:true }), false);
  assert.equal(isAdminUser({ email:'someone@example.com', emailVerified:true, isAdmin:true }), false);
  assert.equal(isAdminUser({ phoneNumber:'+12025550123', isAdmin:true }), false);
  assert.equal(isAdminUser({ phoneNumber:OWNER_PHONE, emailVerified:false }), true);
  assert.equal(isAdminUser({ phoneNumber:'765-479-4230' }), false);
});
test('privileged requests require Firebase phone claims bound to the current UID', () => {
  const claims = {sub:'owner',phone_number:OWNER_PHONE};
  assert.equal(isAdminToken(claims,'owner'),true);
  assert.equal(isAdminToken({sub:'owner',email:'jhuxf12@outlook.com',email_verified:true},'owner'),false);
  assert.equal(isAdminToken({...claims,phone_number:'+12025550123'},'owner'),false);
  assert.equal(isAdminToken({...claims,sub:'different-user'},'owner'),false);
  assert.equal(isAdminToken({...claims,phone_number:'765-479-4230'},'owner'),false);
  assert.equal(isAdminToken({sub:'owner',phoneNumber:OWNER_PHONE,isAdmin:true},'owner'),false);
  assert.equal(isAdminToken(claims,''),false);
  assert.equal(isAdminToken(null,'owner'),false);
});
test('each fixed tier has independent valid defaults', () => {
  const basic = defaultPack('basic'), plus = defaultPack('plus');
  basic.items[0].name = 'Changed';
  assert.notEqual(basic.items[0].name, plus.items[0].name);
  for (const id of PACK_IDS) assert.deepEqual(validateItems(defaultPack(id).items), []);
  assert.throws(() => defaultPack('new-tier'));
});
test('decimal values use integer cents and basis points without rounding input', () => {
  assert.equal(decimalToUnits('12.34'), 1234);
  assert.equal(decimalToUnits('0.01'), 1);
  assert.equal(decimalToUnits('100'), 10000);
  for (const invalid of ['-1','1.001','1e2','','Infinity','1,000']) assert.ok(Number.isNaN(decimalToUnits(invalid)));
});
test('only safe image schemes and static asset paths are accepted', () => {
  for (const url of ['javascript:alert(1)','data:image/svg+xml,<svg/>','//example.com/a.png','http://example.com/a.png','assets/../secret','https://user:password@example.com/a.png']) assert.equal(safeImageURL(url), false);
  assert.equal(safeImageURL('assets/grail-first-light.svg'), true);
  assert.equal(safeImageURL('https://firebasestorage.googleapis.com/v0/b/project/o/card.png?alt=media'), true);
  globalThis.location = {hostname:'127.0.0.1'};
  globalThis.RIPPR_STORAGE_EMULATOR_URL = 'http://127.0.0.1:9199';
  try {
    assert.equal(safeImageURL('http://127.0.0.1:9199/v0/b/demo/o/card.png'), true);
    globalThis.location.hostname = 'rippr.example';
    assert.equal(safeImageURL('http://127.0.0.1:9199/v0/b/demo/o/card.png'), false);
  } finally { delete globalThis.location; delete globalThis.RIPPR_STORAGE_EMULATOR_URL; }
});
test('drafts with invalid totals, duplicate ids, values or image URLs cannot publish', () => {
  const invalidTotal = defaultPack('basic').items; invalidTotal[0].chanceBps--;
  assert.match(validateItems(invalidTotal).join(' '), /100%/);
  const duplicate = defaultPack('basic').items; duplicate[1].id = duplicate[0].id;
  assert.match(validateItems(duplicate).join(' '), /unique ID/);
  const bad = defaultPack('basic').items; bad[0].valueCents = -1; bad[0].image = 'javascript:alert(1)';
  assert.ok(validateItems(bad).length >= 2);
  assert.throws(() => readStoredPack({ items:bad, version:1, enabled:true }));
});
test('weighted draws honor every boundary and skip zero-chance cards', () => {
  const items = defaultPack('basic').items;
  for (const [roll,id] of [[0,'solar-flare'],[.5999,'solar-flare'],[.6,'ocean-spirit'],[.8499,'ocean-spirit'],[.85,'moonstone'],[.95,'wild-bloom'],[.99,'first-light'],[.999999,'first-light']]) assert.equal(drawItem(items,roll).id,id);
  const zero = defaultPack('basic').items; zero[0].chanceBps=0; zero[1].chanceBps=8500;
  assert.equal(drawItem(zero,0).id, 'ocean-spirit');
  assert.throws(() => drawItem(items, 1));
});
test('rarity summaries combine chances and calculate reachable minimum and maximum values', () => {
  const sample = [
    {rarity:'Common',chanceBps:3000,valueCents:100},
    {rarity:'Common',chanceBps:2000,valueCents:1250},
    {rarity:'Rare',chanceBps:5000,valueCents:5000},
    {rarity:'Common',chanceBps:0,valueCents:0},
    {rarity:'Rare',chanceBps:0,valueCents:100000000},
    {rarity:'Legendary',chanceBps:0,valueCents:100000}
  ];
  const original = structuredClone(sample);
  const rows = summarizeRarities(sample);
  assert.deepEqual(rows.map(({color,...row})=>row),[
    {rarity:'Common',chanceBps:5000,minValueCents:100,maxValueCents:1250},
    {rarity:'Rare',chanceBps:5000,minValueCents:5000,maxValueCents:5000}
  ]);
  assert.deepEqual(sample,original);
  assert.deepEqual(summarizeRarities([]),[]);
});
test('rarity summaries preserve fractional-percent odds and active zero-dollar values', () => {
  const rows = summarizeRarities([
    {rarity:'Common',chanceBps:3333,valueCents:0},
    {rarity:'Common',chanceBps:1,valueCents:50},
    {rarity:'Rare',chanceBps:6666,valueCents:199}
  ]);
  assert.equal(rows[0].chanceBps,3334);
  assert.equal(rows[0].minValueCents,0);
  assert.equal(rows.reduce((total,row)=>total+row.chanceBps,0),10000);
});
test('pack prices accept unset or integer cents and preserve legacy catalogs', () => {
  for (const price of [null,0,499,100000000]) assert.equal(validPackPrice(price),true);
  for (const price of [undefined,-1,1.5,'499',NaN,Infinity,100000001]) assert.equal(validPackPrice(price),false);
  const legacy = {items:defaultPack('basic').items,enabled:true,version:1};
  assert.equal(readStoredPack(legacy).priceCents,null);
  assert.equal(readStoredPack({...legacy,priceCents:499}).priceCents,499);
  assert.equal(readStoredPack({...legacy,priceCents:null}).priceCents,null);
  assert.throws(()=>readStoredPack({...legacy,priceCents:-1}));
  assert.throws(()=>readStoredPack({...legacy,priceCents:'4.99'}));
});

test('Icy Rush is recognized but unavailable until the owner configures it', () => {
  assert.ok(PACK_IDS.includes('icy-rush'));
  const seasonal = defaultPack('icy-rush');
  assert.equal(seasonal.enabled, false);
  assert.equal(seasonal.priceCents, null);
  assert.deepEqual(validateItems(seasonal.items), []);
});
