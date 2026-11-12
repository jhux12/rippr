// Public TCGdex v2 contract: github.com/tcgdex/javascript-sdk (Query / interfaces).
const ROOT = 'https://api.tcgdex.net/v2/en';
const PRICE_FINISHES = {
  normal:'Standard', holo:'Holofoil', holofoil:'Holofoil', reverse:'Reverse holo', 'reverse-holofoil':'Reverse holo',
  '1st-edition':'1st edition', '1st-edition-holofoil':'1st edition holofoil', unlimited:'Unlimited', 'unlimited-holofoil':'Unlimited holofoil'
};
export function tcgplayerQuotes(data, now = Date.now()) {
  const feed = data?.pricing?.tcgplayer;
  if (!feed || feed.unit !== 'USD') return [];
  const updated = typeof feed.updated === 'string' ? Date.parse(feed.updated) : typeof feed.updated === 'number' ? feed.updated : NaN;
  // No currency or age guessed; the admin sees the source's update time.
  if (!Number.isFinite(updated) || updated < Date.UTC(2000,0,1) || updated > now+300000) return [];
  return Object.entries(PRICE_FINISHES).flatMap(([key,finish]) => {
    const price = feed[key]?.marketPrice;
    if (typeof price !== 'number' || !Number.isFinite(price) || price <= 0 || price > 1000000) return [];
    const valueCents = Math.round((price+Number.EPSILON)*100);
    return valueCents > 0 ? [{key,finish,valueCents,updated:new Date(updated).toISOString(),currency:'USD',stale:now-updated>7*86400000}] : [];
  });
}
export function matchingPriceQuote(card, quotes) {
  if (card.grading) return null;
  const finish = String(card.finish || '').toLowerCase().replace(/[^a-z0-9]/g,'');
  const matches = quotes.filter(q=>q.finish.toLowerCase().replace(/[^a-z0-9]/g,'')===finish);
  // Alias duplicates with different prices need explicit review.
  return matches.length && new Set(matches.map(q=>q.valueCents)).size === 1 ? matches[0] : null;
}
export function importPriceQuote(quotes) {
  const normal = matchingPriceQuote({finish:'Standard'},quotes);
  if(normal) return normal;
  return quotes.length && new Set(quotes.map(q=>q.finish)).size === 1 && new Set(quotes.map(q=>q.valueCents)).size === 1 ? quotes[0] : null;
}
export function providerPriceRange(card) {
  const values=(card.quotes||[]).map(q=>q.valueCents).filter(v=>Number.isSafeInteger(v)&&v>0);
  return values.length?{minCents:Math.min(...values),maxCents:Math.max(...values),finishes:new Set(card.quotes.map(q=>q.finish)).size}:null;
}
export function sortProviderMatches(cards,sort='source') {
  if(!['source','name','value-low','value-high'].includes(sort))throw new Error('Choose a valid search sort order.');
  if(sort==='source')return [...cards];
  return [...cards].sort((a,b)=>{
    if(sort!=='name'){const left=providerPriceRange(a)?.minCents??null,right=providerPriceRange(b)?.minCents??null;const compared=(left===null)-(right===null)||(sort==='value-low'?(left??0)-(right??0):(right??0)-(left??0));if(compared)return compared}
    return a.name.localeCompare(b.name,'en')||a.id.localeCompare(b.id,'en');
  });
}
const providerSegment = /^[a-zA-Z0-9_-]+(?:\.[a-zA-Z0-9_-]+)*$/;
export function validTCGdexId(id) { return typeof id==='string'&&id.length<=45&&id.trim()===id&&providerSegment.test(id); }
function providerId(id) { if (!validTCGdexId(id)) throw new Error('Invalid TCGdex card or set ID.'); return id; }
export function libraryIdForTCGdex(id) {
  providerId(id);
  // Keep existing IDs stable. Dotted provider IDs use a disjoint, reversible
  // base64url namespace that fits the site's 64-character ID limit.
  return id.includes('.')?'tdx_'+btoa(id).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,''):`tdx-en-${id}`;
}
export function tcgdexImage(base, quality = 'high') {
  if (typeof base !== 'string') return '';
  try { const u = new URL(base); if (u.origin !== 'https://assets.tcgdex.net' || u.username || u.password || u.search || u.hash || u.href!==base || !u.pathname.slice(1).split('/').every(segment=>providerSegment.test(segment))) return ''; return `${base}/${quality}.webp`; } catch { return ''; }
}
export function cardFromTCGdex(data) {
  const id = providerId(data?.id), image = tcgdexImage(data.image);
  if (!image || typeof data.name !== 'string' || !data.name.trim() || !data.set?.name) throw new Error(`TCGdex card ${id} is missing card details or artwork. Try another card or import your own image by CSV.`);
  return { id:libraryIdForTCGdex(id), name:data.name, image, setName:data.set.name, number:String(data.localId ?? ''), finish:'Standard', source:'tcgdex', sourceId:id, sourceRarity:data.rarity || '', referenceURL:'', rarity:null, valueCents:null };
}
export function createTCGdex(fetcher = (...args) => fetch(...args)) {
  const cache = new Map();
  async function request(path, fresh = false) {
    if (!fresh && cache.has(path)) return structuredClone(cache.get(path));
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(),15000);
    try {
      const response = await fetcher(ROOT + path, { signal:controller.signal, credentials:'omit', referrerPolicy:'no-referrer', ...(fresh?{cache:'no-store'}:{}) });
      if (!response.ok) throw Object.assign(new Error(`TCGdex returned ${response.status}. Try again later or use CSV.`),{status:response.status});
      const text = await response.text(); if (text.length > 2 * 1024 * 1024) throw new Error('TCGdex returned too much data. Refine the search.');
      const data = JSON.parse(text); if (cache.size >= 80) cache.delete(cache.keys().next().value); cache.set(path, data); return structuredClone(data);
    } catch (error) { throw Object.assign(new Error(error.name === 'AbortError' ? 'TCGdex timed out. Try again or use CSV.' : (error.message || 'Could not reach TCGdex. Try again or use CSV.')),{status:error.status}); }
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
    async card(id) { return cardFromTCGdex(await request('/cards/' + providerId(id))); },
    async priceDetails(id) {
      const card = await request('/cards/' + providerId(id),true);
      if (card?.id !== id) throw new Error('TCGdex returned a different card. Price was not changed.');
      return {card:cardFromTCGdex(card),quotes:tcgplayerQuotes(card)};
    }
  };
}
