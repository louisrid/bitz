/* BITZ economy: every number that decides what things cost, pay and are worth lives here.
   The server, the page's odds sheets, net worth, the Dealer and tools/econ-sim.mjs all read this one file.
   Cash is the only currency ($). Values are virtual and never redeemable. */
import { PLAYERS, PLAYER_BY_ID, SEASON } from './catalogue.js';
export { SEASON };
const TEST = process.env.NODE_ENV === 'test' && process.env.BITZ_FAST_TIMERS === '1';
export const ECON = Object.freeze({
  version: 2,                                   // one-time versioned reset: accounts migrate to this once and never again
  income: Object.freeze({ perMin: 8000, goldX: 3, tickMs: TEST ? 1000 : 5000, purpleEverySec: TEST ? 3 : 40, idleMs: 10 * 60000, purplePack: 'red-hot' }),   // the test flag only shortens timers
  sellRate: 0.65,                               // the Card Buyer pays this share of book value
  packEquity: 0.8,                              // unopened packs count at this share of their price in net worth
  maxOpen: 50, maxCards: 6000,
  welcome: 'welcome',
  milestones: Object.freeze({                   // one-time rewards for verified peak net worth
    50000: { pack: 'red-hot', n: 1 }, 250000: { pack: 'golden-star', n: 1 }, 1000000: { pack: 'european-nights', n: 1 },
    5000000: { pack: 'god', n: 1, item: 'x_sun' }, 25000000: { pack: 'european-nights', n: 3, item: 'x_void' }, 100000000: { pack: 'god', n: 2, item: 'x_prism' }
  }),
  club: Object.freeze({ pack: 'european-nights', n: 1 }),   // completing all 11 main players of a club (plus that club's scarf)
  level: Object.freeze({ cash: 2500, step: 750 }),        // level-up pays cash + step x level
  xp: Object.freeze({ open: 12, sell: 2, trade: 40, order: 60, race: 120, club: 300 }),
  dealer: Object.freeze({ orders: 4, orderHours: 3, premium: 1.6, raceEveryMin: [18, 32], raceMinutes: 6, soloRaceMinutes: 4 })
});

/* ---- sets: the three collections, the welcome pack and the God pack ---- */
export const SETS = Object.freeze({
  'red-hot': { name: 'RED HOT', short: 'Red Hot', price: 15000, n: 5, shop: true, theme: 'fire', blurb: 'Fire, magma and the next generation.' },
  'golden-star': { name: 'GOLDEN STAR', short: 'Golden Star', price: 35000, n: 5, shop: true, theme: 'gold', blurb: 'A guaranteed autograph in every pack.' },
  'european-nights': { name: 'EUROPEAN NIGHTS', short: 'European Nights', price: 150000, n: 5, shop: true, theme: 'night', blurb: 'Elite players only. Far less filler.' },
  'welcome': { name: 'WELCOME PACK', short: 'Welcome', price: 0, listed: 15000, n: 5, shop: false, theme: 'fire', earned: true, blurb: 'Your first five cards.' },
  'god': { name: 'GOD PACK', short: 'God Pack', price: 0, listed: 180000, n: 5, shop: false, theme: 'god', earned: true, blurb: 'The best of all three collections.' }
});
export const BOX_PACKS = 10, BOX_MULT = 9.5;   // a box is ten packs for 9.5x the pack price
export const boxPrice = set => { const s = SETS[set]; return s && s.shop ? Math.round(s.price * BOX_MULT) : 0; };
export const packWorth = set => { const s = SETS[set]; return !s ? 0 : Math.round((s.price || s.listed || 0) * ECON.packEquity); };

/* ---- editions. base = book value per 1.0 desirability. rank orders rarity (guarantees use it); auto = signature; dual = two players. ---- */
export const EDITIONS = Object.freeze({
  /* RED HOT */
  'rh-common':    { set: 'red-hot', name: 'Common', base: 380, rank: 0 },
  'rh-uncommon':  { set: 'red-hot', name: 'Uncommon', base: 620, rank: 1 },
  'rh-rare':      { set: 'red-hot', name: 'Rare', base: 1300, rank: 2 },
  'rh-epic':      { set: 'red-hot', name: 'Epic', base: 2900, rank: 3 },
  'rh-holo':      { set: 'red-hot', name: 'Holo', base: 5600, rank: 4 },
  'rh-fire':      { set: 'red-hot', name: 'Fire Edition', base: 10500, rank: 5 },
  'rh-ember99':   { set: 'red-hot', name: 'Ember /99', base: 14000, rank: 5, serialMax: 99 },
  'rh-lava':      { set: 'red-hot', name: 'Lava Edition', base: 21000, rank: 6 },
  'rh-molten':    { set: 'red-hot', name: 'Molten Signature', base: 35000, rank: 7, auto: true },
  'rh-magma25':   { set: 'red-hot', name: 'Magma /25', base: 60000, rank: 7, serialMax: 25 },
  'rh-inferno5':  { set: 'red-hot', name: 'Inferno /5', base: 220000, rank: 8, serialMax: 5 },
  'rh-firestorm': { set: 'red-hot', name: 'Firestorm 1/1', base: 600000, rank: 9, serialMax: 1 },
  /* GOLDEN STAR */
  'gs-ivory':     { set: 'golden-star', name: 'Ivory', base: 450, rank: 0 },
  'gs-silver':    { set: 'golden-star', name: 'Silver', base: 860, rank: 1 },
  'gs-gold':      { set: 'golden-star', name: 'Gold', base: 2200, rank: 2 },
  'gs-holo':      { set: 'golden-star', name: 'Gold Holo', base: 5200, rank: 4 },
  'gs-auto':      { set: 'golden-star', name: 'Golden Signature', base: 4500, rank: 5, auto: true },
  'gs-foil':      { set: 'golden-star', name: 'Gold Foil Signature', base: 12000, rank: 6, auto: true },
  'gs-ink':       { set: 'golden-star', name: 'Golden Ink', base: 36000, rank: 7, auto: true, serialMax: 50 },
  'gs-dual':      { set: 'golden-star', name: 'Double Signature', base: 26000, rank: 7, auto: true, dual: true, serialMax: 50 },
  'gs-25':        { set: 'golden-star', name: 'Gold /25', base: 78000, rank: 8, auto: true, serialMax: 25 },
  'gs-11':        { set: 'golden-star', name: 'Golden Star 1/1', base: 700000, rank: 9, auto: true, serialMax: 1 },
  /* EUROPEAN NIGHTS */
  'en-night':     { set: 'european-nights', name: 'Night', base: 1600, rank: 2 },
  'en-platinum':  { set: 'european-nights', name: 'Platinum', base: 3300, rank: 3 },
  'en-holo':      { set: 'european-nights', name: 'Floodlight Holo', base: 6000, rank: 4 },
  'en-fullart':   { set: 'european-nights', name: 'Full Art', base: 12000, rank: 5 },
  'en-champ':     { set: 'european-nights', name: 'Champions Signature', base: 26000, rank: 7, auto: true },
  'en-dual':      { set: 'european-nights', name: 'Platinum Dual Signature', base: 36000, rank: 8, auto: true, dual: true, serialMax: 25 },
  'en-10':        { set: 'european-nights', name: 'Platinum /10', base: 65000, rank: 8, serialMax: 10 },
  'en-5':         { set: 'european-nights', name: 'Champions /5', base: 140000, rank: 8, auto: true, serialMax: 5 },
  'en-masterpiece': { set: 'european-nights', name: 'Masterpiece 1/1', base: 900000, rank: 9, serialMax: 1 }
});
export const RARE = 2;                       // "Rare-or-better" = rank >= RARE
export const TIER_NAMES = ['Common', 'Uncommon', 'Rare', 'Epic', 'Holo', 'Premium', 'Elite', 'Signature', 'Numbered', 'One of One'];
export const edOf = id => EDITIONS[id] || EDITIONS['rh-common'];
export const rankOf = id => edOf(id).rank;
export const isOneOfOne = id => edOf(id).serialMax === 1;
export const ONE_OF_ONES = Object.freeze(Object.keys(EDITIONS).filter(isOneOfOne));
/* cards the Buyer protects unless the player unlocks them one by one */
export const protectedEdition = id => { const e = edOf(id); return !!(e.auto || e.serialMax || e.rank >= 6); };

/* ---- packs: slots, each with its own edition odds (weights) and a player pool. The best card is shown last. ---- */
const RH_COMMON = { 'rh-common': 58, 'rh-uncommon': 26, 'rh-rare': 10, 'rh-epic': 4, 'rh-holo': 1.5, 'rh-fire': 0.4, 'rh-ember99': 0.1 };
const RH_RARE = { 'rh-rare': 52, 'rh-epic': 26, 'rh-holo': 12, 'rh-fire': 5, 'rh-lava': 2.4, 'rh-ember99': 1.6, 'rh-molten': 0.6, 'rh-magma25': 0.3, 'rh-inferno5': 0.08, 'rh-firestorm': 0.02 };
const GS_COMMON = { 'gs-ivory': 56, 'gs-silver': 30, 'gs-gold': 11, 'gs-holo': 3 };
const GS_RARE = { 'gs-gold': 50, 'gs-holo': 35, 'gs-foil': 10, 'gs-ink': 3, 'gs-dual': 1.5, 'gs-25': 0.45, 'gs-11': 0.05 };
const GS_AUTO = { 'gs-auto': 86, 'gs-foil': 10, 'gs-ink': 2.5, 'gs-dual': 1, 'gs-25': 0.45, 'gs-11': 0.05 };
const EN_COMMON = { 'en-night': 70, 'en-platinum': 22, 'en-holo': 6, 'en-fullart': 2 };
const EN_RARE = { 'en-platinum': 40, 'en-holo': 30, 'en-fullart': 18, 'en-champ': 8, 'en-dual': 2, 'en-10': 1.4, 'en-5': 0.5, 'en-masterpiece': 0.1 };
export const PACKS = Object.freeze({
  'red-hot': { slots: [['red-hot', RH_COMMON], ['red-hot', RH_COMMON], ['red-hot', RH_COMMON], ['red-hot', RH_COMMON], ['red-hot', RH_RARE]], guarantee: { rank: RARE } },
  'welcome': { slots: [['red-hot', RH_COMMON], ['red-hot', RH_COMMON], ['red-hot', RH_COMMON], ['red-hot', RH_COMMON], ['red-hot', RH_RARE]], guarantee: { rank: RARE } },
  'golden-star': { slots: [['golden-star', GS_COMMON], ['golden-star', GS_COMMON], ['golden-star', GS_COMMON], ['golden-star', GS_RARE], ['golden-star', GS_AUTO]], guarantee: { rank: RARE, auto: true } },
  'european-nights': { slots: [['european-nights', EN_COMMON], ['european-nights', EN_COMMON], ['european-nights', EN_COMMON], ['european-nights', EN_COMMON], ['european-nights', EN_RARE]], guarantee: { rank: RARE } },
  'god': { slots: [['red-hot', RH_RARE], ['red-hot', { 'rh-holo': 40, 'rh-fire': 30, 'rh-lava': 18, 'rh-molten': 8, 'rh-magma25': 3, 'rh-inferno5': 0.9, 'rh-firestorm': 0.1 }], ['golden-star', GS_AUTO], ['golden-star', { 'gs-foil': 60, 'gs-ink': 25, 'gs-dual': 10, 'gs-25': 4.5, 'gs-11': 0.5 }], ['european-nights', EN_RARE]], guarantee: { rank: 5 } }
});

/* ---- who comes out of each set, and how often ---- */
export function playerWeight(set, p, ed) {
  const e = edOf(ed);
  if (set === 'red-hot') return (p.ucl ? 0.15 : 1) * (p.young ? 3 : 1);
  if (set === 'golden-star') return e.auto ? 1 / Math.sqrt(p.d) : 1;           // most autographs come from less desirable players
  if (set === 'european-nights') return p.ucl ? 2 : p.d >= 3 ? Math.sqrt(p.d) / 2 : 0;
  return Math.sqrt(p.d);
}
const poolCache = new Map();
export function pool(set, ed) {
  const key = set + ':' + (edOf(ed).auto ? 'a' : 'n');
  if (!poolCache.has(key)) { const list = []; for (const p of PLAYERS) { const w = playerWeight(set, p, ed); if (w > 0) list.push([p, w]); } poolCache.set(key, Object.freeze(list)); }
  return poolCache.get(key);
}
/* partner for a dual: the same club when possible (a real pairing), otherwise anyone else from the pool */
export function dualPartners(set, ed, first) {
  const list = pool(set, ed).filter(([p]) => p.id !== first.id), same = list.filter(([p]) => p.club === first.club);
  return same.length ? same : list;
}

/* ---- values ---- */
const dShape = d => Math.pow(d, 0.85);          // compresses the very top so one icon card does not dwarf an entire collection
export function cardValue(card) {
  const e = edOf(card.ed), ids = card.players || [card.player];
  const p1 = PLAYER_BY_ID.get(ids[0]), p2 = ids[1] ? PLAYER_BY_ID.get(ids[1]) : null;
  if (!p1) return 0;
  if (e.dual && p2) return Math.round(e.base * Math.sqrt(dShape(p1.d) * dShape(p2.d)) * 1.5);
  let v = e.base * dShape(p1.d);
  if (card.serial && e.serialMax > 1) v *= card.serial === 1 ? 1.25 : card.serial === e.serialMax ? 1.1 : 1;   // first and last serials carry a small premium
  return Math.round(v);
}
export const sellPrice = value => Math.floor(value * ECON.sellRate);
export const dayKey = now => new Date(now).toISOString().slice(0, 10);

/* ---- expected values straight from the odds above (what the simulator and the shop's odds sheet show) ---- */
export function slotStats(set, odds) {
  let ev = 0, total = 0; const perEd = {};
  for (const w of Object.values(odds)) total += w;
  for (const [ed, w] of Object.entries(odds)) {
    const e = edOf(ed), list = pool(set, ed); let sumW = 0, sumV = 0;
    for (const [p, pw] of list) { sumW += pw; sumV += pw * cardValue({ ed, player: p.id, players: e.dual ? [p.id, p.id] : [p.id] }); }
    const mean = sumV / sumW, pr = w / total; perEd[ed] = { p: pr, mean }; ev += pr * mean;
  }
  return { ev, perEd };
}
export function packStats(set) {
  const pk = PACKS[set]; let ev = 0; const perEd = {};
  for (const [s, odds] of pk.slots) { const st = slotStats(s, odds); ev += st.ev; for (const [ed, x] of Object.entries(st.perEd)) { const cur = perEd[ed] || { p: 0, mean: x.mean, miss: 1 }; cur.miss *= 1 - x.p; cur.mean = x.mean; perEd[ed] = cur; } }
  for (const x of Object.values(perEd)) { x.p = 1 - x.miss; delete x.miss; }   // chance the pack contains at least one of that edition
  return { ev, perEd, price: SETS[set].price || SETS[set].listed || 0 };
}
