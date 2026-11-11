import { MAX_PACK_ITEMS, RARITIES, safeImageURL, decimalToUnits, validGrading, gradingFields, validateItems } from './catalog-model.js';

export const LIBRARY_BATCH_SIZE = 50;
export const LIBRARY_IMPORT_LIMIT = 500;
export const LIBRARY_FIELDS = ['id','name','image','setName','number','finish','source','sourceId','sourceRarity','referenceURL','rarity','valueCents','grading'];
export const CSV_COLUMNS = ['id','name','setName','number','finish','image','rarity','value','gradingCompany','grade','referenceURL'];
export const nameKey = value => String(value).trim().normalize('NFKC').toLowerCase();
export function referenceURLValid(value) {
  if (value === '') return true;
  try { const u = new URL(value); return value.length <= 2048 && !/\s/.test(value) && /^https:\/\/(www\.)?tcgplayer\.com(\/.*)?$/.test(value) && u.protocol === 'https:' && !u.username && !u.password && ['www.tcgplayer.com','tcgplayer.com'].includes(u.hostname) && !u.port; } catch { return false; }
}
export function cleanLibraryCard(input = {}) {
  return { id:input.id, name:input.name?.trim(), image:input.image?.trim(),
    setName:input.setName?.trim() ?? '', number:input.number?.trim() ?? '', finish:input.finish?.trim() || 'Standard',
    source:input.source ?? 'manual', sourceId:input.sourceId ?? '', sourceRarity:input.sourceRarity ?? '',
    referenceURL:input.referenceURL?.trim() ?? '', rarity:input.rarity ?? null, valueCents:input.valueCents ?? null, ...gradingFields(input) };
}
export function validateLibraryCard(card) {
  const issues = [];
  if (!card || typeof card !== 'object' || Array.isArray(card)) return ['Card must be an object.'];
  if (!/^[a-zA-Z0-9_-]{1,64}$/.test(card.id || '')) issues.push('Use a stable card ID with up to 64 letters, numbers, hyphens or underscores.');
  if (typeof card.name !== 'string' || !card.name.trim() || card.name.length > 100) issues.push('Enter a card name up to 100 characters.');
  else if (nameKey(card.name).length > 200) issues.push('Use a shorter card name.');
  if (!safeImageURL(card.image)) issues.push('Enter a valid HTTPS image URL or site asset path.');
  for (const [field, max] of [['setName',120],['number',30],['finish',60],['sourceId',80],['sourceRarity',80]]) {
    if (typeof card[field] !== 'string' || card[field].length > max || (field === 'finish' && !card[field].trim())) issues.push(`Invalid ${field}.`);
  }
  if (!['manual','tcgdex','pack'].includes(card.source)) issues.push('Invalid card source.');
  if (!referenceURLValid(card.referenceURL)) issues.push('Reference links must be HTTPS TCGplayer links.');
  if (card.valueCents !== null && (!Number.isSafeInteger(card.valueCents) || card.valueCents < 0 || card.valueCents > 100000000)) issues.push('Value must be blank or between $0 and $1,000,000.');
  if (card.rarity !== null && !RARITIES.some(r => r.name === card.rarity)) issues.push('Choose a rippr rarity.');
  if (!validGrading(card.grading)) issues.push('Enter a valid grading company and grade.');
  return issues;
}
export function libraryCardReady(card) { return !validateLibraryCard(card).length && card.valueCents !== null && card.rarity !== null; }
export function libraryAddedTime(data) {
  const value=data.createdAt ?? (data.version===1?data.updatedAt:null);
  const millis=typeof value==='number'?value:value?.toMillis?.();
  return Number.isFinite(millis)&&millis>=0?millis:null;
}
export function browseLibraryCards(cards, {search='',rarity='',condition='',minValueCents=null,maxValueCents=null,sort='newest',excludeIds=[]}={}) {
  if(!['newest','name','value-low','value-high'].includes(sort))throw new Error('Choose a valid sort order.');
  if(!['','raw','graded'].includes(condition))throw new Error('Choose a valid condition.');
  for(const value of [minValueCents,maxValueCents])if(value!==null&&(!Number.isSafeInteger(value)||value<0||value>100000000))throw new Error('Enter values from $0 to $1,000,000 with up to two decimal places.');
  if(minValueCents!==null&&maxValueCents!==null&&minValueCents>maxValueCents)throw new Error('Minimum value must not exceed maximum value.');
  const text=nameKey(search),excluded=new Set(excludeIds);
  const visible=cards.filter(card=>!excluded.has(card.id)&&(!rarity||card.rarity===rarity)&&(!condition||(condition==='graded'?Boolean(card.grading):!card.grading))
    &&(!text||nameKey([card.name,card.setName,card.number,card.id,card.finish].join(' ')).includes(text))
    &&(minValueCents===null||(card.valueCents!==null&&card.valueCents>=minValueCents))&&(maxValueCents===null||(card.valueCents!==null&&card.valueCents<=maxValueCents)));
  const alphabetical=(a,b)=>nameKey(a.name).localeCompare(nameKey(b.name),'en')||a.id.localeCompare(b.id,'en');
  return visible.sort((a,b)=>{
    if(sort==='newest'){const left=libraryAddedTime(a),right=libraryAddedTime(b);return(left===null)-(right===null)||(right??0)-(left??0)||alphabetical(a,b)}
    if(sort==='value-low'||sort==='value-high')return(a.valueCents===null)-(b.valueCents===null)||(sort==='value-low'?(a.valueCents??0)-(b.valueCents??0):(b.valueCents??0)-(a.valueCents??0))||alphabetical(a,b);
    return alphabetical(a,b);
  });
}

// RFC 4180-style parser: quoted commas/newlines, doubled quotes, BOM, CRLF.
export function parseCSV(text) {
  if (typeof text !== 'string' || text.length > 2 * 1024 * 1024) throw new Error('Choose a CSV file up to 2 MB.');
  text = text.replace(/^\uFEFF/, '');
  const rows = []; let row = [], cell = '', quoted = false, closed = false;
  const endCell = () => { row.push(cell); cell = ''; closed = false; };
  const endRow = () => { endCell(); if (row.some(v => v.trim())) rows.push(row); row = []; if (rows.length > LIBRARY_IMPORT_LIMIT + 1) throw new Error('Import up to 500 rows at a time.'); };
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) { if (c === '"') { if (text[i+1] === '"') { cell += '"'; i++; } else { quoted = false; closed = true; } } else cell += c; }
    else if (c === ',') endCell();
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i+1] === '\n') i++; endRow(); }
    else if (c === '"' && !cell && !closed) quoted = true;
    else if (closed || c === '"') throw new Error('Malformed CSV quotes. Export again using standard CSV formatting.');
    else cell += c;
  }
  if (quoted) throw new Error('A CSV quoted field was not closed.');
  if (cell || row.length || closed) endRow();
  return rows;
}
export function csvCandidates(text) {
  const rows = parseCSV(text), headers = rows.shift()?.map(v => v.trim());
  if (!headers?.includes('id') || new Set(headers).size !== headers.length || headers.some(h => !CSV_COLUMNS.includes(h))) throw new Error(`Use these CSV headers (id is required): ${CSV_COLUMNS.join(', ')}.`);
  if (!rows.length) throw new Error('This CSV has no card rows.');
  return rows.map((values, index) => {
    if (values.length !== headers.length) throw new Error(`Row ${index+2}: expected ${headers.length} columns.`);
    const raw = Object.fromEntries(headers.map((h, i) => [h, values[i].trim()])), card = { id:raw.id };
    for (const key of ['name','setName','number','finish','image','rarity','referenceURL']) if (raw[key]) card[key] = raw[key];
    if (raw.value) card.valueCents = decimalToUnits(raw.value);
    if (raw.gradingCompany || raw.grade) {
      if (!raw.gradingCompany || !raw.grade) throw new Error(`Row ${index+2}: supply both gradingCompany and grade.`);
      card.grading = { company:raw.gradingCompany, grade:raw.grade };
    }
    return card;
  });
}
export function importPreview(candidates, existing, mode = 'skip') {
  if (!Array.isArray(candidates) || !candidates.length || candidates.length > LIBRARY_IMPORT_LIMIT) throw new Error('Preview between 1 and 500 cards.');
  if (!['skip','update'].includes(mode)) throw new Error('Choose how to handle existing IDs.');
  const byId = new Map(existing.map(card => [card.id, card])), seen = new Set(), changes = [], skipped = [], errors = [];
  candidates.forEach((input, index) => {
    if (seen.has(input.id)) { errors.push(`Row ${index+1}: duplicate ID ${input.id}.`); return; } seen.add(input.id);
    const previous = byId.get(input.id);
    if (previous && mode === 'skip') { skipped.push(input.id); return; }
    const card = cleanLibraryCard({ ...previous, ...input });
    const issues = validateLibraryCard(card);
    if (issues.length) { errors.push(`Row ${index+1} (${input.id || 'missing ID'}): ${issues[0]}`); return; }
    changes.push({ ...card, version:previous?.version || 0 });
  });
  return { changes, skipped, errors, added:changes.filter(c => c.version === 0).length, updated:changes.filter(c => c.version > 0).length };
}
function csvCell(value, protect = true) {
  let text = String(value ?? '');
  // Spreadsheet formula protection; IDs used for updating remain unchanged.
  if (protect && /^[=+@\-\t\r]/.test(text)) text = "'" + text;
  return '"' + text.replaceAll('"','""') + '"';
}
export function libraryCSV(cards) {
  // Valid IDs contain no formula operators except hyphens; retain them byte-for-byte.
  return [CSV_COLUMNS, ...cards.map(c => [c.id,c.name,c.setName,c.number,c.finish,c.image,c.rarity,c.valueCents == null ? '' : (c.valueCents/100).toFixed(2),c.grading?.company,c.grading?.grade,c.referenceURL])].map(row => row.map((value,index) => csvCell(value,index !== 0 || !/^[a-zA-Z0-9_-]{1,64}$/.test(String(value)))).join(',')).join('\r\n');
}
export function addLibraryToPack(existing, cards) {
  const ids = new Set(existing.map(c => c.id)), additions = [];
  for (const card of cards) {
    if (ids.has(card.id)) continue;
    if (!libraryCardReady(card)) throw new Error(`${card.name || card.id} needs a value and rippr rarity before adding to a pack.`);
    ids.add(card.id);
    const name = [card.name, [card.setName, card.number && `#${card.number}`].filter(Boolean).join(' '), card.finish !== 'Standard' ? card.finish : ''].filter(Boolean).join(' · ').slice(0,100);
    additions.push({ id:card.id, name, image:card.image, rarity:card.rarity, valueCents:card.valueCents, chanceBps:0, grail:false, ...gradingFields(card) });
  }
  if (existing.length + additions.length > MAX_PACK_ITEMS) throw new Error(`A pack supports up to ${MAX_PACK_ITEMS.toLocaleString('en-US')} cards. Choose fewer cards or remove some from its draft.`);
  const issues=validateItems([...existing,...additions]).filter(issue=>issue!=='Pull chances must total exactly 100%.');
  if(issues.length)throw new Error(issues[0]);
  return { items:[...existing, ...additions], added:additions.length, skipped:cards.length-additions.length };
}
