import { validateItems } from './catalog-model.js';

const TOTAL = 10000;

export function expectedValue(items) {
  if (!Array.isArray(items) || !items.length || items.some(item => !item || !Number.isSafeInteger(item.valueCents) || item.valueCents < 0 || !Number.isInteger(item.chanceBps) || item.chanceBps < 0 || item.chanceBps > TOTAL)
    || items.reduce((sum, item) => sum + item.chanceBps, 0) !== TOTAL) return null;
  return items.reduce((sum, item) => sum + item.valueCents * item.chanceBps, 0) / TOTAL;
}

// A maximum-entropy distribution over item values, with one basis point reserved
// for every included item. This gives a smooth suggestion without using a
// member's balance, history, rarity label or previous results.
export function generateOdds(items, targetCents, { includeZero = false } = {}) {
  const issues = validateItems(items).filter(issue => issue !== 'Pull chances must total exactly 100%.');
  if (issues.length) throw new Error(issues[0]);
  if (!Number.isFinite(targetCents) || targetCents < 0 || targetCents > 100000000) throw new Error('Enter a target EV from $0 to $1,000,000.');
  const active = items.map((item, index) => ({ ...item, index })).filter(item => includeZero || item.chanceBps > 0);
  if (!active.length) throw new Error('Include the items at 0%, or give at least one item a positive chance.');
  const values = active.map(item => item.valueCents), low = Math.min(...values), high = Math.max(...values);
  const remaining = TOTAL - active.length;
  const base = values.reduce((sum, value) => sum + value, 0) / TOTAL;
  const minCents = base + remaining * low / TOTAL, maxCents = base + remaining * high / TOTAL;
  if (targetCents < minCents - 1e-8 || targetCents > maxCents + 1e-8) {
    const usd = cents => '$' + (cents / 100).toLocaleString('en-US', { maximumFractionDigits:4 });
    throw new Error(`Reachable EV: ${usd(minCents)}–${usd(maxCents)}. Each included item keeps at least 0.01% odds. Change the target or exclude an item by setting its odds to 0%.`);
  }
  const distribution = beta => {
    const edge = beta >= 0 ? high : low;
    const weights = values.map(value => Math.exp(beta * (value - edge) / (high - low)));
    const sum = weights.reduce((a, b) => a + b, 0);
    return weights.map(weight => weight / sum);
  };
  let weights;
  if (low === high || targetCents <= minCents + 1e-8 || targetCents >= maxCents - 1e-8) {
    const edge = targetCents <= minCents + 1e-8 ? low : high;
    const count = values.filter(value => value === edge).length;
    weights = values.map(value => value === edge ? 1 / count : 0);
  } else {
    const ev = beta => base + distribution(beta).reduce((sum, weight, i) => sum + weight * remaining * values[i] / TOTAL, 0);
    let left = -1, right = 1;
    for (let step = 0; step < 64 && ev(left) > targetCents; step++) left *= 2;
    for (let step = 0; step < 64 && ev(right) < targetCents; step++) right *= 2;
    for (let step = 0; step < 100; step++) {
      const middle = (left + right) / 2;
      if (ev(middle) < targetCents) left = middle; else right = middle;
    }
    weights = distribution((left + right) / 2);
  }
  // Largest remainders make the total exactly 100%, never exceeding the existing
  // server's two-decimal percentage precision.
  const raw = weights.map(weight => 1 + remaining * weight), odds = raw.map(Math.floor);
  const order = raw.map((value, i) => ({ i, remainder:value - odds[i], id:active[i].id }))
    .sort((a, b) => b.remainder - a.remainder || a.id.localeCompare(b.id));
  const leftover = TOTAL - odds.reduce((a, b) => a + b, 0);
  for (let i = 0; i < leftover; i++) odds[order[i].i]++;

  // Reduce EV drift from rounding with bounded one-basis-point transfers. This
  // is an approximation on a discrete grid, not a promise of an exact target.
  let actual = values.reduce((sum, value, i) => sum + value * odds[i], 0) / TOTAL;
  for (let step = 0; step < 200; step++) {
    let best = Math.abs(actual - targetCents), move;
    for (let from = 0; from < odds.length; from++) {
      if (odds[from] <= 1) continue;
      for (let to = 0; to < odds.length; to++) {
        const delta = (values[to] - values[from]) / TOTAL;
        const error = Math.abs(actual + delta - targetCents);
        if (error < best - 1e-9) { best = error; move = { from, to, delta }; }
      }
    }
    if (!move) break;
    odds[move.from]--; odds[move.to]++; actual += move.delta;
  }
  const next = items.map(item => ({ ...item, chanceBps:0 }));
  active.forEach((item, i) => { next[item.index].chanceBps = odds[i]; });
  return { items:next, targetCents, actualCents:expectedValue(next), minCents, maxCents };
}
