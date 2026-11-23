import { createHash } from 'node:crypto';
import { Timestamp } from 'firebase-admin/firestore';
import { defaultPack } from './catalog-model.js';
import { readRecentPull, RECENT_PULL_WINDOW_MS } from './recent-pulls-model.js';

const demoIds = new Set(defaultPack('basic').items.map(card => card.id));

// Stage one anonymous public card snapshot in the existing award transaction.
// There are no extra reads, public account references or shared feed document.
export function stageRecentPulls(tx, db, { uid, operationId, cards, atMs, mode }) {
  if (!['test', 'live'].includes(mode) || typeof uid !== 'string' || !uid
    || typeof operationId !== 'string' || !operationId || !Array.isArray(cards)
    || cards.length > 5 || !Number.isSafeInteger(atMs) || atMs <= 0
    || atMs + RECENT_PULL_WINDOW_MS > 253402300799999) return 0;
  let count = 0;
  for (const [index, card] of cards.entries()) {
    if (!card || card.testItem !== (mode === 'test') || demoIds.has(card.catalogItemId)) continue;
    const data = readRecentPull({
      name: card.name, image: card.image, rarity: card.rarity, valueCents: card.valueCents,
      packId: card.packId, pulledAtMs: atMs, testOnly: mode === 'test', grading: card.grading
    }, { mode, nowMs: atMs });
    if (!data) continue;
    const id = createHash('sha256').update(JSON.stringify(['rippr-recent-pull-v1', mode, uid, operationId, index])).digest('hex');
    tx.create(db.collection('testRecentPulls').doc(id), {
      ...data, expiresAt: Timestamp.fromMillis(atMs + RECENT_PULL_WINDOW_MS)
    });
    count++;
  }
  return count;
}
