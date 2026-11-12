/* BITZ economy simulator. Uses the real card service, odds and values (nothing is re-implemented here) to compare how
   different ways of playing grow net worth.   node tools/econ-sim.mjs [sessions]   (default 1500 per strategy) */
import '../public/world-layout.js';
import { ECON, SETS, PACKS, packStats, boxPrice, cardValue, sellPrice, edOf, rankOf, isOneOfOne, protectedEdition } from '../src/econ.js';
import { createCardService, freshCards } from '../src/cards.js';
import { PLAYER_BY_ID } from '../src/catalogue.js';
import * as core from '../src/core.js';
const N = Math.max(50, Number(process.argv[2]) || 1500);
const perMin = ECON.income.perMin, gold = perMin * ECON.income.goldX, purplePerMin = 60 / ECON.income.purpleEverySec;
const fmt = n => '$' + Math.round(n).toLocaleString('en-US');
const pct = x => (x * 100).toFixed(1) + '%';
console.log('BITZ ECONOMY SIMULATION  (' + N + ' sessions per strategy)\n');
console.log('Income: ' + fmt(perMin) + '/min anywhere, ' + fmt(gold) + '/min in the Gold Circle, one ' + SETS[ECON.income.purplePack].short + ' pack every ' + ECON.income.purpleEverySec + 's in the Purple Circle (' + purplePerMin.toFixed(2) + '/min).');
console.log('Card Buyer pays ' + pct(ECON.sellRate) + ' of book value. Unopened packs count at ' + pct(ECON.packEquity) + ' of price in net worth.\n');

/* ---- 1. analytic expected values straight from the odds ---- */
console.log('PACK EXPECTED VALUES (analytic, from the published odds)');
for (const [id, s] of Object.entries(SETS)) {
  const st = packStats(id), price = s.price || s.listed; const ones = Object.entries(st.perEd).filter(([ed]) => isOneOfOne(ed)).reduce((a, [, x]) => a + x.p, 0);
  console.log('  ' + s.name.padEnd(16) + ' price ' + fmt(price).padStart(9) + '  EV ' + fmt(st.ev).padStart(9) + '  EV/price ' + (st.ev / price).toFixed(2) + '  sell-back ' + pct(st.ev * ECON.sellRate / price) + (ones ? '  1/1 in 1 of ' + Math.round(1 / ones).toLocaleString() + ' packs' : ''));
}

/* ---- 2. Monte Carlo: open many packs, look at the distribution ---- */
const mkSvc = () => { const accounts = new Map(), serials = new Map(), offers = new Map(), world = {}; return { accounts, svc: createCardService({ accounts, serials, offers, world, markDirty() {}, resolvePlayer: () => null, nameOf: () => 'Sim' }) }; };
const mkPlayer = (accounts, svc, id) => { const w = core.freshWallet(); w.econ = { v: ECON.version }; w.cards = freshCards(); accounts.set(id, w); return w; };
console.log('\nPACK OUTCOMES (' + (N * 4) + ' packs each, real rolls)');
for (const set of ['red-hot', 'golden-star', 'european-nights', 'god']) {
  const { accounts, svc } = mkSvc(), w = mkPlayer(accounts, svc, 'p_sim'), price = SETS[set].price || SETS[set].listed, vals = [], top = [];
  let autos = 0, weakAutos = 0, best = 0;
  for (let i = 0; i < N * 4; i += 50) { w.cards.cards = []; w.cards.packs[set] = 50; const r = svc.open(w, 'p_sim', set, 50, 'Sim'); for (const pk of r.packs) { const v = pk.reduce((s, c) => s + svc.value(c), 0); vals.push(v); const t = Math.max(...pk.map(c => svc.value(c))); top.push(t); if (t > best) best = t; for (const c of pk) if (edOf(c.ed).auto) { autos++; if (PLAYER_BY_ID.get(c.player).d < 3) weakAutos++; } } }
  vals.sort((a, b) => a - b); const mean = vals.reduce((a, b) => a + b, 0) / vals.length, med = vals[vals.length >> 1], p90 = vals[Math.floor(vals.length * 0.9)], win = vals.filter(v => v >= price).length / vals.length;
  console.log('  ' + SETS[set].name.padEnd(16) + ' mean ' + fmt(mean).padStart(9) + ' (' + (mean / price).toFixed(2) + 'x)  median ' + fmt(med).padStart(9) + ' (' + (med / price).toFixed(2) + 'x)  90th ' + fmt(p90).padStart(10) + '  pack>=price ' + pct(win).padStart(6) + '  best single card ' + fmt(best) + (autos ? '  autos from squad players ' + pct(weakAutos / autos) : ''));
}

/* ---- 3. sessions: minute by minute, with the real rolls ---- */
function session(strategy, minutes, svc, accounts, id) {
  const w = mkPlayer(accounts, svc, id); let cash = 0, purple = 0, sold = 0, orders = 0;
  svc.open(w, id, 'welcome', 1, 'Sim');   // everyone starts with the welcome pack
  const open = set => { const n = w.cards.packs[set] || 0; if (n) { const r = svc.open(w, id, set, Math.min(50, n), 'Sim'); return r; } };
  const sellDupes = () => { const seen = new Set(), dupes = []; for (const c of w.cards.cards.slice().sort((a, b) => svc.value(b) - svc.value(a))) { const k = c.player; if (seen.has(k)) { if (!protectedEdition(c.ed)) dupes.push(c.uid); } else seen.add(k); } if (dupes.length) { const r = svc.sell(w, id, dupes); sold += r.pay; } };
  for (let m = 1; m <= minutes; m++) {
    if (strategy.zone === 'gold') w.coins += gold; else if (strategy.zone === 'purple') { purple += purplePerMin; while (purple >= 1) { purple -= 1; w.cards.packs['red-hot'] = (w.cards.packs['red-hot'] || 0) + 1; } } else w.coins += perMin;
    if (strategy.buy) { const set = strategy.buy, price = SETS[set].price; if (strategy.box && w.coins >= boxPrice(set)) { svc.buy(w, set, 'box'); } else while (w.coins >= price) svc.buy(w, set, 'pack'); }
    if (!strategy.hold) for (const set of Object.keys(w.cards.packs)) open(set);
    if (strategy.sell && m % 3 === 0) sellDupes();
    if (strategy.orders && m % 10 === 0) {   // a standing order every ten minutes: hand over two cheap cards for 2.5x their value + $5,000 (the Dealer's premium)
      const cheap = w.cards.cards.filter(c => !protectedEdition(c.ed)).sort((a, b) => svc.value(a) - svc.value(b)).slice(0, 2);
      if (cheap.length === 2) { const v = cheap.reduce((s, c) => s + svc.value(c), 0); const gone = new Set(cheap.map(c => c.uid)); w.cards.cards = w.cards.cards.filter(c => !gone.has(c.uid)); w.coins += Math.round(v * 2.5 + 5000); orders++; }
    }
    if (w.cards.cards.length > 5000) sellDupes();
  }
  const nw = svc.netWorth(w); return { nw: nw.total, cash: nw.cash, cards: nw.cards, n: w.cards.cards.length, found: Object.keys(w.cards.book).length, best: w.cards.stats.best ? w.cards.stats.best.v : 0, sold, orders };
}
const STRATS = [
  ['Gold Circle, keep the cash', { zone: 'gold' }],
  ['Purple Circle, open every pack', { zone: 'purple' }],
  ['Gold Circle, buy Red Hot packs, open, hold', { zone: 'gold', buy: 'red-hot' }],
  ['Gold Circle, buy Red Hot, sell duplicates', { zone: 'gold', buy: 'red-hot', sell: true }],
  ['Gold Circle, buy Golden Star, open, hold', { zone: 'gold', buy: 'golden-star' }],
  ['Gold Circle, save for European Nights', { zone: 'gold', buy: 'european-nights' }],
  ['Gold Circle, buy Red Hot boxes', { zone: 'gold', buy: 'red-hot', box: true }],
  ['Walk about, buy Red Hot (no circles)', { zone: '', buy: 'red-hot' }],
  ['Purple Circle + Dealer orders', { zone: 'purple', orders: true }],
  ['Gold Circle, Red Hot + Dealer orders', { zone: 'gold', buy: 'red-hot', orders: true, sell: true }]
];
const runs = {};
for (const minutes of [2, 5, 30, 120]) {
  console.log('\nAFTER ' + minutes + ' MINUTES  (median net worth, mean, 10th-90th percentile; ' + N + ' sessions)');
  for (const [name, s] of STRATS) {
    const { accounts, svc } = mkSvc(), out = [];
    for (let i = 0; i < (minutes >= 120 ? Math.max(50, N / 5) : N); i++) { out.push(session(s, minutes, svc, accounts, 'p_' + i)); accounts.clear(); }
    out.sort((a, b) => a.nw - b.nw); const med = out[out.length >> 1], mean = out.reduce((a, b) => a + b.nw, 0) / out.length, p10 = out[Math.floor(out.length * .1)].nw, p90 = out[Math.floor(out.length * .9)].nw;
    runs[name + minutes] = med.nw;
    console.log('  ' + name.padEnd(44) + fmt(med.nw).padStart(12) + '  mean ' + fmt(mean).padStart(12) + '  [' + fmt(p10) + ' .. ' + fmt(p90) + ']  cards ' + String(med.n).padStart(4) + '  found ' + String(med.found).padStart(3) + '/265  best card ' + fmt(med.best));
  }
}
console.log('\nCHECKS');
const say = (ok, t) => console.log('  ' + (ok ? 'OK  ' : 'WARN') + ' ' + t);
say(runs['Gold Circle, keep the cash' + 2] >= 50000 * 0.9, 'onboarding: about $50k net worth after two minutes in the Gold Circle with the welcome pack (' + fmt(runs['Gold Circle, keep the cash' + 2]) + ')');
const g30 = runs['Gold Circle, keep the cash' + 30], p30 = runs['Purple Circle, open every pack' + 30];
say(p30 > g30 * 0.75 && p30 < g30 * 1.35, 'Purple Circle within 25-35% of the Gold Circle at 30 minutes (purple ' + fmt(p30) + ' vs gold ' + fmt(g30) + '): different, neither dominates');
for (const s of ['red-hot', 'golden-star', 'european-nights']) say(packStats(s).ev * ECON.sellRate < SETS[s].price * 0.8, SETS[s].short + ': buying, opening and selling everything returns ' + pct(packStats(s).ev * ECON.sellRate / SETS[s].price) + ' of the price (no profit loop)');
const rh30 = runs['Gold Circle, buy Red Hot packs, open, hold' + 30];
say(rh30 > g30 * 0.85, 'opening packs does not destroy net worth: Red Hot buyer holds ' + pct(rh30 / g30) + ' of the pure cash player at 30 minutes (median)');
say(runs['Purple Circle + Dealer orders' + 30] > runs['Purple Circle, open every pack' + 30], 'Dealer orders add to a collector\'s net worth: Purple + orders ' + fmt(runs['Purple Circle + Dealer orders' + 30]) + ' vs Purple alone ' + fmt(runs['Purple Circle, open every pack' + 30]) + ' at 30 minutes');
