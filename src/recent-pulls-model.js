import { PACK_IDS, RARITIES, defaultPack, safeImageURL, validGrading, gradingFields } from './catalog-model.js';

export const RECENT_PULL_LIMIT = 12;
export const RECENT_PULL_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const demoImages = new Set(defaultPack('basic').items.map(card => '/' + card.image));
const privatePath = /(?:^|\/)(?:profile-images|support-attachments|private|testAccounts|liveAccounts)(?:\/|$)/i;

// These images are already public catalog artwork. Never republish an account
// upload, support attachment, illustrative seed or card-back as a recent pull.
export function safeRecentPullImage(value) {
  if (!safeImageURL(value) || value !== value.trim()) return false;
  try {
    const url = new URL(value, 'https://www.rippr.gg');
    let path = url.pathname;
    for (let n = 0; n < 3; n++) {
      const next = decodeURIComponent(path);
      if (next === path) break;
      path = next;
    }
    if (privatePath.test(path) || path.includes('\\') || /[\u0000-\u001f\u007f]/.test(path)) return false;
    if (demoImages.has(path) || /(?:placeholder|rippr-card-back)(?:\.[a-z0-9]+)?$/i.test(path)) return false;
    return true;
  } catch { return false; }
}

// Shared by the trusted award projection and the read-only homepage client.
// Always construct a fresh whitelist rather than spreading saved account data.
export function readRecentPull(data, { mode, nowMs = Date.now() } = {}) {
  try {
    if (!data || !['test', 'live'].includes(mode) || data.testOnly !== (mode === 'test')) return null;
    if (!Number.isSafeInteger(nowMs) || !Number.isSafeInteger(data.pulledAtMs) || data.pulledAtMs <= 0
      || data.pulledAtMs < nowMs - RECENT_PULL_WINDOW_MS || data.pulledAtMs > nowMs + 60000) return null;
    if (typeof data.name !== 'string' || !data.name.trim() || data.name.length > 100
      || /[\u0000-\u001f\u007f]/.test(data.name)) return null;
    if (!PACK_IDS.includes(data.packId) || !RARITIES.some(rarity => rarity.name === data.rarity)) return null;
    if (!Number.isSafeInteger(data.valueCents) || data.valueCents < 0 || data.valueCents > 100000000) return null;
    if (!safeRecentPullImage(data.image) || !validGrading(data.grading)) return null;
    return {
      name: data.name.trim(), image: data.image, rarity: data.rarity,
      valueCents: data.valueCents, packId: data.packId, pulledAtMs: data.pulledAtMs,
      testOnly: data.testOnly, ...gradingFields(data)
    };
  } catch { return null; }
}
