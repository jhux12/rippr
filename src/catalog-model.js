export const OWNER_PHONE = '+17654794230';
export const MAX_PACK_ITEMS = 1000;
// Leave room below Firestore's 1 MiB document limit for document metadata.
export const MAX_PACK_DOCUMENT_BYTES = 900 * 1024;
const encoder = new TextEncoder();
export function packDocumentBytes(items) {
  const seen=new WeakSet();
  function size(value,depth=0){
    if(depth>20)return Infinity;
    if(value===null)return 1;
    if(typeof value==='string')return encoder.encode(value).length+1;
    if(typeof value==='number')return 8;
    if(typeof value==='boolean')return 1;
    if(!value||typeof value!=='object'||seen.has(value))return Infinity;
    seen.add(value);let bytes=Array.isArray(value)?0:32;
    for(const [key,child]of Object.entries(value)){if(child===undefined&&!Array.isArray(value))continue;bytes+=(Array.isArray(value)?0:encoder.encode(key).length+1)+size(child,depth+1);if(bytes>MAX_PACK_DOCUMENT_BYTES)break}
    seen.delete(value);return bytes;
  }
  return 2048+size(items);
}
export const PACK_IDS = ['basic', 'plus', 'premium', 'elite', 'ultimate', 'icy-rush'];
export const DEFAULT_PRICES = { basic:199, plus:499, premium:1499, elite:2999, ultimate:9999, 'icy-rush':null };
export const RARITIES = [
  { name: 'Common', color: '#adbdcf' },
  { name: 'Uncommon', color: '#63dcad' },
  { name: 'Rare', color: '#69b9ff' },
  { name: 'Ultra rare', color: '#ff5c63' },
  { name: 'Special rare', color: '#ecb6df' },
  { name: 'Epic', color: '#cf83ff' },
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
  // Firebase sets phoneNumber only after SMS verification or verified linking.
  // This is a UI hint; every write separately checks Firebase token claims.
  return Boolean(user?.phoneNumber === OWNER_PHONE);
}
export function isAdminToken(claims, uid) {
  return Boolean(uid && claims?.sub === uid && claims.phone_number === OWNER_PHONE);
}
export function assertPackId(id) {
  if (!PACK_IDS.includes(id)) throw Object.assign(new Error('Unknown pack tier.'), { code: 'catalog/invalid-pack' });
}
export function packName(id) { return id === 'icy-rush' ? 'Icy Rush' : id[0].toUpperCase() + id.slice(1); }
export function packImage(id) { return id === 'icy-rush' ? 'assets/seasonal/pack-icy-rush.png' : `assets/pack-${id}.svg`; }
export function defaultPack(id) {
  assertPackId(id);
  return { items: seeds.map(item => ({ ...item })), enabled: id !== 'icy-rush', priceCents: DEFAULT_PRICES[id], version: 0, source: 'default' };
}
export function validPackPrice(value) {
  return value === null || (Number.isSafeInteger(value) && value >= 0 && value <= 100000000);
}
export function summarizeRarities(items) {
  const groups = new Map();
  for (const item of items) {
    if (item.chanceBps <= 0) continue;
    const group = groups.get(item.rarity);
    if (!group) groups.set(item.rarity, { rarity:item.rarity, chanceBps:item.chanceBps, minValueCents:item.valueCents, maxValueCents:item.valueCents });
    else {
      group.chanceBps += item.chanceBps;
      group.minValueCents = Math.min(group.minValueCents, item.valueCents);
      group.maxValueCents = Math.max(group.maxValueCents, item.valueCents);
    }
  }
  return RARITIES.filter(rarity => groups.has(rarity.name)).map(rarity => ({ ...groups.get(rarity.name), color:rarity.color }));
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
  if (!Array.isArray(items) || items.length < 1 || items.length > MAX_PACK_ITEMS) return [`Add between 1 and ${MAX_PACK_ITEMS.toLocaleString('en-US')} cards.`];
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
    if (!validGrading(item.grading)) issues.push(`${label} needs a grading company and grade from 1 to 10.`);
  }
  if(!issues.length&&packDocumentBytes(items)>MAX_PACK_DOCUMENT_BYTES)issues.push('This pack is too large to save safely. Use shorter image URLs or fewer card entries.');
  if (items.reduce((total, item) => total + (Number.isInteger(item?.chanceBps) ? item.chanceBps : 0), 0) !== 10000) issues.push('Pull chances must total exactly 100%.');
  return issues;
}
export function readStoredPack(data) {
  const issues = validateItems(data?.items);
  const priceCents = data?.priceCents ?? null;
  if (issues.length || !Number.isInteger(data?.version) || data.version < 1 || typeof data.enabled !== 'boolean' || !validPackPrice(priceCents)) {
    throw Object.assign(new Error('The saved pack contents are invalid.'), { code: 'catalog/invalid-data' });
  }
  return { items: data.items.map(item => ({ ...item })), enabled: data.enabled, priceCents, version: data.version, source: 'firebase' };
}
export function drawItem(items, unit) {
  if (validateItems(items).length || !Number.isFinite(unit) || unit < 0 || unit >= 1) throw new Error('Cannot draw from invalid pack contents.');
  const roll = Math.floor(unit * 10000);
  let cumulative = 0;
  for (const item of items) { cumulative += item.chanceBps; if (roll < cumulative) return { ...item }; }
  throw new Error('The pack odds are incomplete.');
}

// Homepage grails are curated display data, independent of purchasable pack odds.
export function defaultHomepageGrails() {
  const order = ['first-light', 'ocean-spirit', 'moonstone'];
  return { items:order.map(id => {
    const { name, image, valueCents } = seeds.find(item => item.id === id);
    return { id, name, image, valueCents };
  }), version:0, source:'default' };
}
export function validateHomepageGrails(config) {
  if (!Array.isArray(config?.items) || config.items.length > 6) return ['Choose up to 6 homepage grails.'];
  const issues = [], ids = new Set();
  for (const [index, item] of config.items.entries()) {
    const label = `Grail ${index + 1}`;
    if (!item || typeof item !== 'object' || Array.isArray(item)) { issues.push(`${label} is invalid.`); continue; }
    if (Object.keys(item).some(key => !['id','name','image','valueCents','grading'].includes(key))) issues.push(`${label} contains unsupported fields.`);
    if (typeof item.id !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(item.id) || ids.has(item.id)) issues.push(`${label} needs a unique ID.`);
    ids.add(item.id);
    if (typeof item.name !== 'string' || !item.name.trim() || item.name.length > 160) issues.push(`${label} needs a name of up to 160 characters.`);
    if (!safeImageURL(item.image)) issues.push(`${label} needs a valid image.`);
    if (!validGrading(item.grading)) issues.push(`${label} needs a grading company and grade from 1 to 10.`);
    if (!Number.isSafeInteger(item.valueCents) || item.valueCents < 0 || item.valueCents > 100000000) issues.push(`${label} needs a value from $0 to $1,000,000.`);
  }
  return issues;
}
export function cleanHomepageGrailsItems(items) {
  return items.map(item => ({id:item.id,name:item.name.trim(),image:item.image,valueCents:item.valueCents,...gradingFields(item)}));
}
export function readHomepageGrails(data) {
  const issues = validateHomepageGrails(data);
  if (issues.length || !Number.isSafeInteger(data?.version) || data.version < 1) {
    throw Object.assign(new Error(issues[0] || 'The saved homepage grails are invalid.'), { code:'catalog/invalid-data' });
  }
  return { items:cleanHomepageGrailsItems(data.items), version:data.version, source:'firebase' };
}

// Raw cards follow the site's Near Mint policy. Slab labels require explicit metadata.
export const GRADING_COMPANIES=['PSA','CGC','BGS','SGC','TAG','ACE'];
export function validGrading(grading){
 return grading===undefined||grading===null||Boolean(grading&&typeof grading==='object'&&!Array.isArray(grading)&&Object.keys(grading).every(key=>['company','grade'].includes(key))&&GRADING_COMPANIES.includes(grading.company)&&typeof grading.grade==='string'&&/^(?:10|[1-9](?:\.5)?)$/.test(grading.grade)&&!(grading.company==='PSA'&&grading.grade==='9.5')&&(!['TAG','ACE'].includes(grading.company)||!grading.grade.includes('.')));
}
export function gradingFields(item){return item?.grading?{grading:{company:item.grading.company,grade:item.grading.grade}}:{}}
export function conditionLabel(item){return item?.grading?(validGrading(item.grading)?`${item.grading.company} ${item.grading.grade}`:'Grade unavailable'):'Near Mint'}
