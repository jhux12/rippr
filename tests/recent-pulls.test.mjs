import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { accountService } from '../functions/service.js';
import { scopedDatabase } from '../functions/runtime-mode.js';
import { initialLiveWallet, postCredits } from '../functions/wallet-ledger.js';
import { stageRecentPulls } from '../functions/recent-pulls.js';
import { defaultPack } from '../src/catalog-model.js';
import { readRecentPull, safeRecentPullImage, RECENT_PULL_WINDOW_MS } from '../src/recent-pulls-model.js';
import { memoryDatabase } from './helpers/memory-database.mjs';

const AT = Date.UTC(2026, 10, 23, 12);
const card = {
  id: 'sv03-223', name: 'Charizard ex', image: 'https://assets.tcgdex.net/en/sv/sv03/223/high.webp',
  rarity: 'Epic', valueCents: 2100, chanceBps: 10000, grail: true,
  grading: { company: 'PSA', grade: '10' }
};
const catalog = (patch = {}) => ({ ...defaultPack('basic'), version: 1, priceCents: 100, items: [{ ...card }], ...patch });
const get = (db, path) => db.runTransaction(async tx => (await tx.get(db.doc(path))).data());
const feed = (db, mode = 'test') => db.collection(mode === 'live' ? 'liveRecentPulls' : 'testRecentPulls').orderBy('pulledAtMs', 'desc').get();
const buy = (call, data = {}, operationId = randomUUID()) => call('purchase', { packId: 'basic', quantity: 1, expectedVersion: 1, expectedPriceCents: 100, ...data }, operationId);
async function fixture({ mode = 'test', balance = 1000, root = memoryDatabase(), uid = 'private-member', pack = catalog() } = {}) {
  let atMs = AT;
  const db = scopedDatabase(root, mode), service = accountService(db, { mode, now: () => atMs });
  const call = (action, data = {}, operationId = randomUUID()) => service(uid, { action, ...data, operationId });
  await root.runTransaction(tx => tx.set(root.doc('packContents/basic'), pack));
  if (mode === 'test') {
    await call('snapshot');
    if (balance) await call('topup', { amountCents: balance });
  } else {
    const account = db.doc('testAccounts/' + uid), wallet = { ...initialLiveWallet(), packsOpened: 0, cardsCollected: 0, grailsFound: 0 };
    await db.runTransaction(tx => {
      const funded = postCredits(tx, account, wallet, { id: randomUUID(), kind: 'fixture-funding', moves: [{ bucket: 'purchasedCents', cents: balance }], atMs });
      tx.create(account, { ...wallet, ...funded });
    });
  }
  return { root, db, call, uid, advance: ms => { atMs += ms; } };
}

test('successful batch awards atomically publish only anonymous card snapshots with actual grade and TTL', async () => {
  const privateValues = { ownerUid: 'secret-owner', email: 'secret@example.com', phone: '+12025550123', privateNote: 'Never public', catalogItemId: 'private-catalog-record' };
  const f = await fixture({ pack: catalog({ items: [{ ...card, ...privateValues }] }) });
  await f.db.runTransaction(tx => tx.update(f.db.doc('testAccounts/' + f.uid), { displayName: 'Private Name', emailForUpdates: 'collector@example.com', address: { line1: 'Private street' } }));
  const id = randomUUID(), result = await buy(f.call, { quantity: 5 }, id), found = await feed(f.root);
  assert.equal(result.cards.length, 5);
  assert.equal(result.totalCents, 500);
  assert.equal(result.balanceCents, 500);
  assert.equal(found.size, 5);
  const expectedKeys = ['expiresAt', 'grading', 'image', 'name', 'packId', 'pulledAtMs', 'rarity', 'testOnly', 'valueCents'];
  for (const saved of found.docs) {
    const data = saved.data();
    assert.match(saved.id, /^[a-f0-9]{64}$/);
    assert.deepEqual(Object.keys(data).sort(), expectedKeys);
    assert.equal(data.name, card.name);
    assert.equal(data.image, card.image);
    assert.equal(data.valueCents, card.valueCents);
    assert.deepEqual(data.grading, card.grading);
    assert.equal(data.packId, 'basic');
    assert.equal(data.pulledAtMs, AT);
    assert.equal(data.expiresAt.toMillis(), AT + RECENT_PULL_WINDOW_MS);
    assert.equal(data.testOnly, true);
    const serialized = JSON.stringify(data);
    for (const value of [f.uid, id, 'Private Name', 'collector@example.com', 'Private street', ...Object.values(privateValues)]) assert(!serialized.includes(value));
    assert(!result.cards.some(award => serialized.includes(award.id)));
  }
  assert.equal((await f.db.doc('testAccounts/' + f.uid).collection('items').get()).size, 5);
});

test('duplicate and concurrent retries preserve the first cards, timestamp and one feed entry per award', async () => {
  const f = await fixture(), id = randomUUID();
  const [first, retry] = await Promise.all([buy(f.call, { quantity: 3 }, id), buy(f.call, { quantity: 3 }, id)]);
  assert.deepEqual(first, retry);
  const before = (await feed(f.root)).docs.map(doc => [doc.id, doc.data()]);
  f.advance(100000);
  assert.deepEqual(await buy(f.call, { quantity: 3 }, id), first);
  assert.deepEqual((await feed(f.root)).docs.map(doc => [doc.id, doc.data()]), before);
  assert.equal(before.length, 3);
  assert.equal((await get(f.db, 'testAccounts/' + f.uid)).balanceCents, 700);
  await assert.rejects(() => buy(f.call, { quantity: 2 }, id), error => error.code === 'already-exists');
  assert.equal((await feed(f.root)).size, 3);
});

test('rejected openings never publish activity or change funds/items', async () => {
  for (const scenario of ['insufficient', 'price', 'version', 'disabled', 'hold', 'quantity']) {
    const f = await fixture({ balance: scenario === 'insufficient' ? 0 : 1000 });
    if (scenario === 'disabled') await f.root.runTransaction(tx => tx.update(f.root.doc('packContents/basic'), { enabled: false }));
    if (scenario === 'hold') await f.db.runTransaction(tx => tx.update(f.db.doc('testAccounts/' + f.uid), { paymentHold: true }));
    const before = await get(f.db, 'testAccounts/' + f.uid);
    const patch = scenario === 'price' ? { expectedPriceCents: 1 } : scenario === 'version' ? { expectedVersion: 2 } : scenario === 'quantity' ? { quantity: 6 } : {};
    await assert.rejects(() => buy(f.call, patch));
    assert.deepEqual(await get(f.db, 'testAccounts/' + f.uid), before, scenario);
    assert.equal((await f.db.doc('testAccounts/' + f.uid).collection('items').get()).size, 0, scenario);
    assert.equal((await feed(f.root)).size, 0, scenario);
  }
});

test('a transaction failure after staging a feed record rolls back the debit, item and feed together', async () => {
  const base = memoryDatabase();
  let failCommit = false;
  const db = { ...base, runTransaction: callback => base.runTransaction(async tx => {
    const result = await callback(tx);
    if (failCommit) throw Error('Simulated transaction commit failure');
    return result;
  }) };
  const f = await fixture({ root: db }), id = randomUUID();
  failCommit = true;
  await assert.rejects(() => buy(f.call, {}, id), /commit failure/);
  failCommit = false;
  assert.equal((await get(db, 'testAccounts/' + f.uid)).balanceCents, 1000);
  assert.equal((await db.doc('testAccounts/' + f.uid).collection('items').get()).size, 0);
  assert.equal((await feed(db)).size, 0);
  await buy(f.call, {}, id);
  assert.equal((await feed(db)).size, 1);
  assert.equal((await get(db, 'testAccounts/' + f.uid)).balanceCents, 900);
});

test('an owned reward pack appears only after opening, even after its sales catalog is disabled', async () => {
  const f = await fixture({ pack: catalog({ enabled: false }) }), inventoryPackId = randomUUID();
  await f.db.runTransaction(tx => tx.create(f.db.doc('testAccounts/' + f.uid + '/packs/' + inventoryPackId), { packId: 'basic', status: 'available', source: 'welcome-case', testItem: true }));
  assert.equal((await feed(f.root)).size, 0);
  const id = randomUUID(), data = { packId: 'basic', quantity: 1, expectedVersion: 1, inventoryPackId };
  const result = await f.call('openInventoryPack', data, id);
  assert.equal(result.totalCents, 0);
  assert.deepEqual(await f.call('openInventoryPack', data, id), result);
  assert.equal((await feed(f.root)).size, 1);
  assert.equal((await get(f.db, 'testAccounts/' + f.uid)).balanceCents, 1000);
  await assert.rejects(() => f.call('openInventoryPack', data));
  assert.equal((await feed(f.root)).size, 1);
});

test('test and live feeds stay isolated and opaque IDs differ across accounts and ledgers', async () => {
  const root = memoryDatabase(), sharedId = randomUUID();
  const sandbox = await fixture({ root }), live = await fixture({ root, mode: 'live' });
  const other = await fixture({ root, uid: 'another-private-member' });
  await buy(sandbox.call, {}, sharedId); await buy(live.call, {}, sharedId); await buy(other.call, {}, sharedId);
  const tests = await feed(root), lives = await feed(root, 'live');
  assert.equal(tests.size, 2); assert.equal(lives.size, 1);
  const ids = [...tests.docs, ...lives.docs].map(doc => doc.id);
  assert.equal(new Set(ids).size, 3);
  assert(tests.docs.every(doc => doc.data().testOnly));
  assert(lives.docs.every(doc => doc.data().testOnly === false));
  assert.equal((await get(root, 'testAccounts/private-member')).balanceCents, 900);
  assert.equal((await get(root, 'liveAccounts/private-member')).balanceCents, 900);
  assert.equal(live.db.collection('testRecentPulls').doc('x').path, 'liveRecentPulls/x');
});

test('illustrative and private artwork never become activity, while their legitimate awards remain unaffected', async () => {
  const images = [
    'assets/card-placeholder.svg', 'assets/reveal/rippr-card-back.webp',
    'https://firebasestorage.googleapis.com/v0/b/rippr-2b01c.firebasestorage.app/o/support-attachments%2Fprivate-user%2Fticket%2Fscreenshot.png?alt=media&token=secret',
    'https://example.com/profile-images/private-user/picture.png',
    'https://example.com/private/picture.jpg'
  ];
  for (const image of images) {
    const f = await fixture({ pack: catalog({ items: [{ ...card, image }] }) });
    const result = await buy(f.call);
    assert.equal(result.cards.length, 1);
    assert.equal(result.balanceCents, 900);
    assert.equal((await feed(f.root)).size, 0, image);
  }
  const demo = await fixture({ pack: { ...defaultPack('basic'), version: 1, priceCents: 100 } });
  await buy(demo.call, { quantity: 5 });
  assert.equal((await feed(demo.root)).size, 0);
  const realExternal = await fixture({ pack: catalog({ items: [{ ...card, image: 'https://collector-cdn.example/cards/charizard.jpg' }] }) });
  await buy(realExternal.call); assert.equal((await feed(realExternal.root)).size, 1);
});

test('public read cleanup enforces mode, age, grading, real artwork and a strict privacy whitelist', () => {
  const valid = { ...card, packId: 'basic', pulledAtMs: AT, testOnly: false, uid: 'private', operationId: 'private', email: 'private@example.com' };
  const clean = readRecentPull(valid, { mode: 'live', nowMs: AT });
  assert(clean);
  assert.deepEqual(Object.keys(clean).sort(), ['grading', 'image', 'name', 'packId', 'pulledAtMs', 'rarity', 'testOnly', 'valueCents']);
  for (const patch of [
    { testOnly: true }, { pulledAtMs: AT - RECENT_PULL_WINDOW_MS - 1 }, { pulledAtMs: AT + 60001 },
    { pulledAtMs: 'now' }, { packId: 'fake' }, { rarity: 'Mythic' }, { valueCents: -1 },
    { grading: { company: 'PSA', grade: '11' } }, { name: '' }, { name: 'Secret\nName' },
    { image: 'javascript:alert(1)' }, { image: 'assets/grail-first-light.svg' }
  ]) assert.equal(readRecentPull({ ...valid, ...patch }, { mode: 'live', nowMs: AT }), null, JSON.stringify(patch));
  assert(readRecentPull({ ...valid, pulledAtMs: AT - RECENT_PULL_WINDOW_MS }, { mode: 'live', nowMs: AT }));
  assert(readRecentPull({ ...valid, grading: undefined }, { mode: 'live', nowMs: AT }));
  assert(safeRecentPullImage('https://firebasestorage.googleapis.com/v0/b/rippr-2b01c.firebasestorage.app/o/card-images%2Fabc.webp?alt=media&token=public-art-token'));
  assert(!safeRecentPullImage('https://example.com/support-attachments%252Fmember%252Fticket%252Fscreenshot.png'));
  assert(!safeRecentPullImage('https://example.com/profile-images/member/a.png'));
  assert(!safeRecentPullImage('https://user:password@example.com/card.png'));
});

test('malformed projection data is skipped without creating public records or throwing', async () => {
  const db = memoryDatabase(), award = { ...card, catalogItemId: card.id, packId: 'basic', testItem: true };
  const context = { uid: 'member', operationId: randomUUID(), cards: [award], mode: 'test', atMs: AT };
  for (const patch of [
    { atMs: Number.MAX_SAFE_INTEGER }, { atMs: NaN }, { mode: 'bogus' }, { cards: null },
    { cards: [{ ...award, testItem: false }] }, { cards: [{ ...award, rarity: 'fake' }] },
    { cards: [{ ...award, grading: { company: 'PSA', grade: '100' } }] },
    { cards: [{ ...award, catalogItemId: 'solar-flare' }] }
  ]) await db.runTransaction(tx => assert.equal(stageRecentPulls(tx, db, { ...context, ...patch }), 0));
  assert.equal((await feed(db)).size, 0);
});
