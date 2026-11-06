import test from 'node:test';
import assert from 'node:assert/strict';
import { OWNER_EMAIL, PACK_IDS, defaultPack, isAdminUser, isAdminToken, safeImageURL, decimalToUnits, validateItems, readStoredPack, drawItem } from '../src/catalog-model.js';

test('only the verified designated email is an owner', () => {
  assert.equal(isAdminUser(null), false);
  assert.equal(isAdminUser({ email:OWNER_EMAIL, emailVerified:false }), false);
  assert.equal(isAdminUser({ email:'someone@example.com', emailVerified:true, isAdmin:true }), false);
  assert.equal(isAdminUser({ email:OWNER_EMAIL.toUpperCase(), emailVerified:true }), true);
});
test('privileged requests require verified owner claims for the current UID', () => {
  const claims = {sub:'owner',email:OWNER_EMAIL,email_verified:true};
  assert.equal(isAdminToken(claims,'owner'),true);
  assert.equal(isAdminToken({...claims,email_verified:false},'owner'),false);
  assert.equal(isAdminToken({...claims,email:'member@example.com'},'owner'),false);
  assert.equal(isAdminToken({...claims,sub:'different-user'},'owner'),false);
  assert.equal(isAdminToken({...claims,email_verified:'true'},'owner'),false);
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
