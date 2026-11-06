export const OWNER_EMAIL = 'jhuxf12@outlook.com';
export const PACK_IDS = ['basic', 'plus', 'premium', 'elite', 'ultimate'];
export const RARITIES = [
  { name: 'Common', color: '#adbdcf' },
  { name: 'Uncommon', color: '#00e2ed' },
  { name: 'Rare', color: '#c19af2' },
  { name: 'Ultra rare', color: '#8dbeff' },
  { name: 'Special rare', color: '#ecb6df' },
  { name: 'Epic', color: '#ff9e98' },
  { name: 'Legendary', color: '#ffcf70' }
];
const seeds = [
  { id: 'solar-flare', name: 'Solar Flare', image: 'assets/card-solar-flare.svg', symbol: '☀', rarity: 'Common', valueCents: 50, chanceBps: 6000, grail: false },
  { id: 'ocean-spirit', name: 'Ocean Spirit', image: 'assets/grail-ocean-spirit.svg', symbol: '◈', rarity: 'Uncommon', valueCents: 200, chanceBps: 2500, grail: false },
  { id: 'moonstone', name: 'Moonstone', image: 'assets/grail-moonstone.svg', symbol: '☾', rarity: 'Rare', valueCents: 800, chanceBps: 1000, grail: true },
  { id: 'wild-bloom', name: 'Wild Bloom', image: 'assets/card-wild-bloom.svg', symbol: '✳', rarity: 'Epic', valueCents: 2500, chanceBps: 400, grail: true },
  { id: 'first-light', name: 'First Light', image: 'assets/grail-first-light.svg', symbol: '✦', rarity: 'Legendary', valueCents: 10000, chanceBps: 100, grail: true }
];

export function isAdminUser(user) {
  return Boolean(user?.emailVerified && user.email?.toLowerCase() === OWNER_EMAIL);
}
export function isAdminToken(claims, uid) {
  return Boolean(uid && claims?.sub === uid && claims.email_verified === true
    && claims.email?.toLowerCase() === OWNER_EMAIL);
}
export function assertPackId(id) {
  if (!PACK_IDS.includes(id)) throw Object.assign(new Error('Unknown pack tier.'), { code: 'catalog/invalid-pack' });
}
export function defaultPack(id) {
  assertPackId(id);
  return { items: seeds.map(item => ({ ...item })), enabled: true, version: 0, source: 'default' };
}
export function safeImageURL(value) {
  if (typeof value !== 'string' || value.length > 2048) return false;
  if (/^assets\/[a-zA-Z0-9/_\-.]+$/.test(value) && !value.includes('..')) return true;
  try {
    const url = new URL(value);
    if (url.username || url.password) return false;
    if (url.protocol === 'https:') return true;
    // Local Storage emulator URLs never become a production HTTP-image exception.
    const local = host => ['localhost', '127.0.0.1', '[::1]'].includes(host);
    const emulator = globalThis.RIPPR_STORAGE_EMULATOR_URL;
    if (!emulator) return false;
    return url.protocol === 'http:' && local(globalThis.location?.hostname)
      && local(url.hostname) && url.origin === new URL(emulator).origin;
  }
  catch { return false; }
}
export function decimalToUnits(value) {
  const match = /^(\d{1,8})(?:\.(\d{1,2}))?$/.exec(String(value).trim());
  return match ? Number(match[1]) * 100 + Number((match[2] || '').padEnd(2, '0')) : NaN;
}
export function validateItems(items) {
  if (!Array.isArray(items) || items.length < 1 || items.length > 100) return ['Add between 1 and 100 cards.'];
  const issues = [], ids = new Set();
  for (const [index, item] of items.entries()) {
    const label = `Card ${index + 1}`;
    if (!item || typeof item !== 'object') { issues.push(`${label} is invalid.`); continue; }
    if (typeof item.id !== 'string' || !/^[a-zA-Z0-9_-]{1,64}$/.test(item.id) || ids.has(item.id)) issues.push(`${label} needs a unique ID.`);
    ids.add(item.id);
    if (typeof item.name !== 'string' || !item.name.trim() || item.name.length > 100) issues.push(`${label} needs a name of up to 100 characters.`);
    if (!RARITIES.some(rarity => rarity.name === item.rarity)) issues.push(`${label} needs a valid rarity.`);
    if (!Number.isSafeInteger(item.valueCents) || item.valueCents < 0 || item.valueCents > 100000000) issues.push(`${label} needs a value from $0 to $1,000,000.`);
    if (!Number.isInteger(item.chanceBps) || item.chanceBps < 0 || item.chanceBps > 10000) issues.push(`${label} needs a chance from 0% to 100%, with up to two decimal places.`);
    if (typeof item.grail !== 'boolean') issues.push(`${label} needs a grail setting.`);
    if (!safeImageURL(item.image)) issues.push(`${label} needs a valid image.`);
  }
  if (items.reduce((total, item) => total + (Number.isInteger(item?.chanceBps) ? item.chanceBps : 0), 0) !== 10000) issues.push('Pull chances must total exactly 100%.');
  return issues;
}
export function readStoredPack(data) {
  const issues = validateItems(data?.items);
  if (issues.length || !Number.isInteger(data?.version) || data.version < 1 || typeof data.enabled !== 'boolean') {
    throw Object.assign(new Error('The saved pack contents are invalid.'), { code: 'catalog/invalid-data' });
  }
  return { items: data.items.map(item => ({ ...item })), enabled: data.enabled, version: data.version, source: 'firebase' };
}
export function drawItem(items, unit) {
  if (validateItems(items).length || !Number.isFinite(unit) || unit < 0 || unit >= 1) throw new Error('Cannot draw from invalid pack contents.');
  const roll = Math.floor(unit * 10000);
  let cumulative = 0;
  for (const item of items) { cumulative += item.chanceBps; if (roll < cumulative) return { ...item }; }
  throw new Error('The pack odds are incomplete.');
}
