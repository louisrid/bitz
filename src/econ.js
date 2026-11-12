/* BITZ economy: every number that decides what things cost, pay and are worth lives here.
   The server, the leaderboard, quests and tools/econ-sim.mjs all read this one file. Cash is the only currency ($). */
export const ECON = Object.freeze({
  version: 2,                      // one-time versioned reset: accounts migrate to this once and never again
  season: 'S2',                    // serial namespace, so cards minted before the reset are never re-issued
  income: Object.freeze({ base: 8000, goldX: 3, tickSec: 5, afkMs: 120000, purpleEverySec: 40 }),   // $ per minute while active
  sellRate: 0.6,                   // the Card Buyer pays this share of book value
  hot: Object.freeze({ bonus: 0.25, cap: 5 }),
  dealerRate: 1.2,
  discovery: 500,                  // first time you personally pull a player
  packEquity: 0.8,                 // unopened shop packs count at this share of price in net worth
  setBonus: 0.25,                  // a fully owned 11/11 club adds this share of that club's card value
  boxPacks: 10, boxPrice: 9.5,     // a box is 10 packs for 9.5x the pack price
  maxOpen: 50,                     // packs per bulk request
  maxCards: 5000,
  leaderboardMinutes: 20,          // active minutes before an account can rank
  milestones: Object.freeze({ 3: { cash: 10000 }, 6: { pack: 'focus' }, 9: { cash: 40000 }, 11: { pack: 'elite-vault' } }),
  ultraviolet: Object.freeze({ cash: 250000 }),
  level: Object.freeze({ cash: 2000, step: 500 })   // level-up pays cash + step x level
});

/* editions, best first. base = book value per 1.0 desirability. */
export const EDITIONS = Object.freeze({
  masterpiece: { name: '1 of 1 Masterpiece', base: 100000, serialMax: 1, tier: 'Masterpiece' },
  blackInk: { name: 'Black Ink', base: 20000, serialMax: 10, auto: true, tier: 'Mythical' },
  numbered5: { name: 'Limited /5', base: 25000, serialMax: 5, tier: 'Mythical' },
  goldInk: { name: 'Gold Ink', base: 8000, serialMax: 50, auto: true, tier: 'Mythical' },
  dual: { name: 'Dual Autograph', base: 1250, serialMax: 50, auto: true, dual: true, tier: 'Mythical' },
  numbered10: { name: 'Limited /10', base: 10000, serialMax: 10, tier: 'Legendary' },
  legendary: { name: 'Legendary', base: 6000, tier: 'Legendary' },
  neon: { name: 'Neon', base: 5000, serialMax: 25, tier: 'Ultraviolet' },
  numbered25: { name: 'Limited /25', base: 4000, serialMax: 25, tier: 'Legendary' },
  superstar: { name: 'Superstar', base: 3000, tier: 'Superstar' },
  signature: { name: 'Signature', base: 2000, auto: true, tier: 'Signature' },
  holo: { name: 'Holo', base: 1500, tier: 'Holo' },
  black: { name: 'Black', base: 1200, tier: 'Black' },
  numbered99: { name: 'Limited /99', base: 1000, serialMax: 99, tier: 'Gold' },
  gold: { name: 'Gold', base: 800, tier: 'Gold' },
  purple: { name: 'Ultraviolet', base: 600, tier: 'Ultraviolet' },
  silver: { name: 'Silver', base: 400, tier: 'Silver' },
  bronze: { name: 'Bronze', base: 250, tier: 'Bronze' },
  base: { name: 'Base', base: 150, tier: 'Base' }
});
export const RANK = Object.freeze(Object.fromEntries(Object.keys(EDITIONS).reverse().map((k, i) => [k, i])));   // higher = better
export const rankOf = ed => RANK[ed] ?? 0;
/* cards the Card Buyer will not take without an explicit unlock */
export const protectedEdition = ed => { const e = EDITIONS[ed]; return !!e && (e.auto || e.serialMax || rankOf(ed) >= RANK.legendary); };

const C = { base: 70, bronze: 20, silver: 10 };
/* packs: n ordinary cards, then the rare slot(s). pool = [desirability weighting, icons allowed].
   The best card is always shown last. Prices come from tools/econ-sim.mjs (about 80-85% average value back). */
export const PACKS = Object.freeze({
  'first-xi': { name: 'FIRST XI', price: 8000, n: 4, common: C, rare: { gold: 70, holo: 20, signature: 6, numbered99: 3, legendary: 0.9, goldInk: 0.1 }, pool: [0, false], shelf: 'featured', min: 'Gold' },
  'focus': { name: 'FOCUS PACK', price: 11000, n: 4, common: C, rare: { gold: 70, holo: 20, signature: 6, numbered99: 3, legendary: 0.9, goldInk: 0.1 }, pool: [0, false], shelf: 'featured', focus: 1, min: 'Gold' },
  'electric-nights': { name: 'ELECTRIC NIGHTS', price: 30000, n: 4, common: { silver: 60, gold: 40 }, rare: { holo: 78, numbered99: 12, signature: 7, numbered25: 2.9, masterpiece: 0.02 }, pool: [0.4, false], shelf: 'featured', min: 'Holo' },
  'blackout': { name: 'BLACKOUT', price: 45000, n: 4, common: { silver: 50, black: 50 }, rare: { black: 70, signature: 22, numbered10: 6, blackInk: 1.2, numbered5: 0.8 }, pool: [0.4, false], shelf: 'featured', min: 'Black' },
  'derby-day': { name: 'DERBY DAY', price: 60000, n: 4, common: { bronze: 50, silver: 50 }, rare: { dual: 60, gold: 25, holo: 13, numbered25: 2 }, pool: [0.3, true], shelf: 'premium', min: 'Gold' },
  'crown-glory': { name: 'CROWN & GLORY', price: 120000, n: 4, common: { gold: 70, holo: 30 }, rare: { superstar: 75, legendary: 20, numbered25: 4.9, masterpiece: 0.05 }, pool: [0.7, true], shelf: 'premium', min: 'Superstar' },
  'signature': { name: 'SIGNATURE', price: 150000, n: 4, common: { gold: 60, holo: 40 }, rare: { signature: 85, goldInk: 12, blackInk: 2.5, dual: 0.5 }, pool: [0.7, true], shelf: 'premium', min: 'Signature' },
  'elite-vault': { name: 'ELITE VAULT', price: 350000, n: 4, common: { holo: 60, superstar: 40 }, rare: { legendary: 70, numbered10: 20, numbered5: 8, blackInk: 1.6, masterpiece: 0.4 }, pool: [0.9, true], shelf: 'premium', min: 'Legendary' },
  'triple-auto': { name: 'TRIPLE AUTO', price: 450000, n: 2, common: { holo: 50, superstar: 50 }, rare: { signature: 70, goldInk: 22, blackInk: 6, dual: 2 }, rares: 3, pool: [0.9, true], shelf: 'premium', min: 'Signature' },
  'god': { name: 'GOD PACK', price: 0, listed: 300000, n: 3, common: { holo: 50, superstar: 50 }, rare: { legendary: 46, signature: 24, goldInk: 12, numbered10: 9, blackInk: 4, numbered5: 2.5, dual: 2, masterpiece: 0.5 }, rares: 2, pool: [0.9, true], earned: true, min: 'Signature' },
  'purple': { name: 'PURPLE PACK', price: 0, listed: 11000, n: 4, common: { base: 50, purple: 50 }, rare: { purple: 78, holo: 12, signature: 7.5, neon: 2.5 }, pool: [0.2, false], earned: true, min: 'Ultraviolet' },
  'welcome': { name: 'WELCOME PACK', price: 0, listed: 6500, n: 4, common: C, rare: { gold: 70, holo: 20, signature: 6, numbered99: 3, legendary: 0.9, goldInk: 0.1 }, pool: [0, false], earned: true, focus: 2, min: 'Gold' }
});
export const packWorth = id => { const p = PACKS[id]; return !p ? 0 : p.price ? Math.round(p.price * ECON.packEquity) : (p.listed || 0); };
export const boxPrice = id => { const p = PACKS[id]; return p && p.price ? Math.round(p.price * ECON.boxPrice) : 0; };

/* book value of a card. D lookup is supplied by the catalogue. */
export function cardValue(card, dOf) {
  const e = EDITIONS[card.variant] || EDITIONS.base, ids = card.players || [card.player];
  if (e.dual && ids.length > 1) return Math.round(e.base * dOf(ids[0]) * dOf(ids[1]));
  return Math.round(e.base * dOf(ids[0]));
}
export const sellPrice = (value, hot) => Math.floor(value * ECON.sellRate * (hot ? 1 + ECON.hot.bonus : 1));
export const dayKey = now => new Date(now).toISOString().slice(0, 10);
