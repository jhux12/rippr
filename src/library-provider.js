// Public TCGdex v2 contract: github.com/tcgdex/javascript-sdk (Query / interfaces).
const ROOT = 'https://api.tcgdex.net/v2/en';
function providerId(id) { if (typeof id !== 'string' || !/^[a-zA-Z0-9_-]{1,45}$/.test(id)) throw new Error('Invalid TCGdex card or set ID.'); return id; }
export function tcgdexImage(base, quality = 'high') {
  if (typeof base !== 'string') return '';
  try { const u = new URL(base); if (u.origin !== 'https://assets.tcgdex.net' || u.search || u.hash || !/^\/[a-zA-Z0-9/_-]+$/.test(u.pathname)) return ''; return `${base}/${quality}.webp`; } catch { return ''; }
}
export function cardFromTCGdex(data) {
  const id = providerId(data?.id), image = tcgdexImage(data.image);
  if (!image || typeof data.name !== 'string' || !data.name.trim() || !data.set?.name) throw new Error(`TCGdex card ${id} is missing card details or artwork. Try another card or import your own image by CSV.`);
  return { id:`tdx-en-${id}`, name:data.name, image, setName:data.set.name, number:String(data.localId ?? ''), finish:'Standard', source:'tcgdex', sourceId:id, sourceRarity:data.rarity || '', referenceURL:'', rarity:null, valueCents:null };
}
export function createTCGdex(fetcher = (...args) => fetch(...args)) {
  const cache = new Map();
  async function request(path) {
    if (cache.has(path)) return structuredClone(cache.get(path));
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(),15000);
    try {
      const response = await fetcher(ROOT + path, { signal:controller.signal, credentials:'omit', referrerPolicy:'no-referrer' });
      if (!response.ok) throw new Error(`TCGdex returned ${response.status}. Try again later or use CSV.`);
      const text = await response.text(); if (text.length > 2 * 1024 * 1024) throw new Error('TCGdex returned too much data. Refine the search.');
      const data = JSON.parse(text); if (cache.size >= 80) cache.delete(cache.keys().next().value); cache.set(path, data); return structuredClone(data);
    } catch (error) { throw new Error(error.name === 'AbortError' ? 'TCGdex timed out. Try again or use CSV.' : (error.message || 'Could not reach TCGdex. Try again or use CSV.')); }
    finally { clearTimeout(timer); }
  }
  return {
    async search({ name = '', setId = '', page = 1 } = {}) {
      name = name.trim(); setId = setId.trim();
      if ((!setId && name.length < 2) || name.length > 80 || !Number.isSafeInteger(page) || page < 1 || page > 1000) throw new Error('Enter at least two letters of a card name, or a set ID.');
      if (setId) providerId(setId);
      const query = new URLSearchParams({ 'pagination:page':String(page), 'pagination:itemsPerPage':'24', 'sort:field':'id', 'sort:order':'ASC' });
      if (name) query.set('name',name); if (setId) query.set('set.id',`eq:${setId}`);
      const cards = await request('/cards?' + query);
      if (!Array.isArray(cards) || cards.length > 24) throw new Error('Unexpected TCGdex search response. Refine your search or use CSV.');
      return cards.map(c => ({ id:providerId(c.id), name:typeof c.name === 'string' ? c.name.slice(0,100) : c.id, number:String(c.localId ?? ''), image:tcgdexImage(c.image,'low') }));
    },
    async card(id) { return cardFromTCGdex(await request('/cards/' + providerId(id))); }
  };
}
