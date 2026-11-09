// Shared limits; all ownership, privacy and like-count decisions remain server-side.
export const MUSEUM_LIMITS = { cards:6, title:60, description:160, pageSize:24, search:60 };
export const museumId = value => typeof value === 'string' && /^[a-zA-Z0-9_-]{1,128}$/.test(value);
export function cleanMuseumDraft(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Choose your museum settings.');
  const title = typeof data.title === 'string' ? data.title.trim() : '';
  const description = typeof data.description === 'string' ? data.description.trim() : '';
  if (!title || title.length > MUSEUM_LIMITS.title || typeof data.description !== 'string' || description.length > MUSEUM_LIMITS.description) throw new Error('Use a title up to 60 characters and a description up to 160 characters.');
  if (typeof data.published !== 'boolean') throw new Error('Choose whether your museum is public.');
  if (!Number.isSafeInteger(data.expectedVersion) || data.expectedVersion < 0) throw new Error('Reload the saved museum before editing.');
  if (!Array.isArray(data.cardIds) || data.cardIds.length > MUSEUM_LIMITS.cards || data.cardIds.some(id => !museumId(id)) || new Set(data.cardIds).size !== data.cardIds.length) throw new Error('Choose up to six different cards from your available items.');
  if (data.published && !data.cardIds.length) throw new Error('Add at least one card before publishing your museum.');
  return { title, description, published:data.published, cardIds:[...data.cardIds], expectedVersion:data.expectedVersion };
}
