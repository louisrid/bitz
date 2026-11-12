/* The Dealer: standing orders anyone can fill, and live races the whole server runs to him for.
   Orders rotate on a timer and pay a premium over book value; races are won by the first valid submission, atomically. */
import crypto from 'node:crypto';
import { ECON, SETS, edOf, rankOf, protectedEdition, cardValue, pool } from './econ.js';
import { PLAYERS, PLAYER_BY_ID, PL_CLUBS, CLUB_BY_ID } from './catalogue.js';
import { awardXP } from './progression.js';
import { ITEMS } from './shop.js';
import { CardError } from './cards.js';

const refuse = m => { throw new CardError(m); };
const rnd = n => crypto.randomInt(n);
const pick = a => a[rnd(a.length)];
const meanValue = (list, ed) => { let s = 0, n = 0; for (const p of list) { s += cardValue({ ed, player: p.id, players: [p.id] }); n++; } return n ? s / n : 0; };
const clubName = id => (CLUB_BY_ID.get(id) || {}).name || id;
const NATIONS = { ENG: 'English', BRA: 'Brazilian', FRA: 'French', NED: 'Dutch', ESP: 'Spanish', ARG: 'Argentinian', POR: 'Portuguese', GER: 'German', BEL: 'Belgian', ITA: 'Italian' };

export function qualifies(card, need) {
  const p = PLAYER_BY_ID.get(card.player); if (!p) return false; const e = edOf(card.ed);
  if (need.club && !card.players.some(id => (PLAYER_BY_ID.get(id) || {}).club === need.club)) return false;
  if (need.set && card.set !== need.set) return false;
  if (need.auto && !e.auto) return false;
  if (need.rank != null && e.rank < need.rank) return false;
  if (need.pos && p.pos !== need.pos) return false;
  if (need.player && !card.players.includes(need.player)) return false;
  if (need.nation && p.nation !== need.nation) return false;
  if (need.minValue && cardValue(card) < need.minValue) return false;
  return true;
}
export function describe(need) {
  const n = need.n || 1, s = n > 1 ? 's' : '';
  if (need.player) return 'any ' + (PLAYER_BY_ID.get(need.player) || {}).name + ' card';
  if (need.club) return n + ' ' + clubName(need.club) + ' card' + s;
  if (need.set) return n + ' ' + SETS[need.set].short + ' card' + s;
  if (need.auto) return n + ' autograph' + s;
  if (need.rank != null) return n + ' Holo-or-better card' + s;
  if (need.pos) return n + ' goalkeeper' + s;
  if (need.nation) return n + ' ' + (NATIONS[need.nation] || need.nation) + ' player' + s;
  return n + ' card' + s;
}

export function createDealer({ world, cards, accounts, markDirty, broadcast, online, nameOf }) {
  const D = () => { let d = world.dealer; if (!d || typeof d !== 'object') d = world.dealer = {}; if (!Array.isArray(d.orders)) d.orders = []; if (!Array.isArray(d.past)) d.past = []; if (!d.nextRaceAt) d.nextRaceAt = 0; return d; };
  const touch = () => markDirty();

  /* ---------- standing orders ---------- */
  function makeOrder(now, avoid) {
    const kinds = ['club', 'club', 'set', 'auto', 'rank', 'pos', 'player', 'nation'];
    for (let tries = 0; tries < 20; tries++) {
      const kind = pick(kinds); let need, pay, tag;
      if (kind === 'club') { const c = pick(PL_CLUBS); const n = 2 + rnd(2); need = { club: c.id, n }; tag = 'club:' + c.id; pay = { cash: Math.round(n * (meanValue(PLAYERS.filter(p => p.club === c.id), 'rh-common') * 2.5 + 2500) / 100) * 100 }; }
      else if (kind === 'set') { const set = pick(['red-hot', 'red-hot', 'golden-star', 'european-nights']); const n = set === 'european-nights' ? 1 : set === 'golden-star' ? 2 : 3; need = { set, n }; tag = 'set:' + set; const mean = meanValue(pool(set, set === 'red-hot' ? 'rh-common' : set === 'golden-star' ? 'gs-ivory' : 'en-night').map(x => x[0]), set === 'red-hot' ? 'rh-common' : set === 'golden-star' ? 'gs-ivory' : 'en-night'); pay = { cash: Math.round(n * (mean * 2.5 + 2500) / 100) * 100 }; }
      else if (kind === 'auto') { need = { auto: true, n: 1 }; tag = 'auto'; pay = rnd(2) ? { pack: 'golden-star', n: 1 } : { cash: Math.round((meanValue(pool('golden-star', 'gs-auto').map(x => x[0]), 'gs-auto') * 2.2 + 5000) / 100) * 100 }; }
      else if (kind === 'rank') { need = { rank: 4, n: 1 }; tag = 'rank'; pay = { pack: 'red-hot', n: 1, cash: 6000 }; }
      else if (kind === 'pos') { need = { pos: 'GK', n: 2 }; tag = 'gk'; pay = { cash: Math.round(2 * (meanValue(PLAYERS.filter(p => p.pos === 'GK'), 'rh-common') * 2.5 + 2500) / 100) * 100 }; }
      else if (kind === 'player') { const p = pick(PLAYERS.filter(x => !x.ucl && x.d <= 4)); need = { player: p.id, n: 1 }; tag = 'player:' + p.id; pay = { cash: Math.round((cardValue({ ed: 'rh-rare', player: p.id, players: [p.id] }) * 2 + 3000) / 100) * 100 }; }
      else { const nat = pick(Object.keys(NATIONS)); need = { nation: nat, n: 2 }; tag = 'nat:' + nat; pay = { cash: Math.round(2 * (meanValue(PLAYERS.filter(p => p.nation === nat), 'rh-common') * 2.5 + 2500) / 100) * 100 }; }
      if (avoid.has(tag)) continue;
      return { id: crypto.randomUUID(), kind, tag, need, label: 'Bring me ' + describe(need), pay, at: now, until: now + ECON.dealer.orderHours * 3600000 };
    }
    return null;
  }
  function rotate(now) {
    const before = D().orders.length; D().orders = D().orders.filter(o => o.until > now); let changed = D().orders.length !== before;
    const avoid = new Set(D().orders.map(o => o.tag));
    while (D().orders.length < ECON.dealer.orders) { const o = makeOrder(now, avoid); if (!o) break; if (D().orders.length) o.until = now + Math.round(ECON.dealer.orderHours * 3600000 * (0.5 + D().orders.length / ECON.dealer.orders)); D().orders.push(o); avoid.add(o.tag); changed = true; }
    if (changed) touch();
    return changed;
  }
  /* the cheapest qualifying cards the player can spare: never locked, showcased or reserved, and never a numbered or signed card unless the order asks for one */
  function choose(w, id, need, requested) {
    const c = cards.ensure(w), top = new Set(c.top), lock = new Set(c.lock), special = !!(need.auto || need.rank != null);
    let list = c.cards.filter(x => qualifies(x, need) && !top.has(x.uid) && !lock.has(x.uid) && !cards.reserved(id, x.uid) && (special || !protectedEdition(x.ed)));
    if (Array.isArray(requested) && requested.length) { const want = new Set(requested); list = list.filter(x => want.has(x.uid)); }
    list.sort((a, b) => cards.value(a) - cards.value(b));
    return list.slice(0, need.n || 1);
  }
  function preview(w, id, orderId) {
    const o = D().orders.find(x => x.id === orderId); if (!o) refuse('That order is gone.');
    const c = cards.ensure(w), chosen = choose(w, id, o.need);
    return { order: o, done: !!c.orders[o.id], cards: chosen.map(cards.view), ok: chosen.length >= (o.need.n || 1) };
  }
  function deliver(w, id, orderId, uids, name) {
    const o = D().orders.find(x => x.id === orderId); if (!o || o.until < Date.now()) refuse('That order is gone.');
    const c = cards.ensure(w); if (c.orders[o.id]) refuse('You already filled this order.');
    const chosen = choose(w, id, o.need, uids); if (chosen.length < (o.need.n || 1)) refuse('You do not have the cards for this order.');
    const gone = new Set(chosen.map(x => x.uid)); c.cards = c.cards.filter(x => !gone.has(x.uid)); c.orders[o.id] = Date.now();
    if (o.pay.cash) { w.coins = Math.floor(w.coins || 0) + o.pay.cash; w.stats = w.stats || {}; w.stats.earned = (w.stats.earned || 0) + o.pay.cash; }
    if (o.pay.pack) c.packs[o.pay.pack] = (Number(c.packs[o.pay.pack]) || 0) + (o.pay.n || 1);
    const xp = awardXP(w, ECON.xp.order, ITEMS); touch();
    return { delivered: chosen.map(cards.view), pay: o.pay, order: o.id, xp };
  }

  /* ---------- live races ---------- */
  function plan(now) {
    const ids = online(); if (!ids.length) return null;
    const rows = ids.map(id => accounts.get(id)).filter(Boolean).map(w => ({ w, c: cards.ensure(w) }));
    const solo = rows.length < 2, options = [];
    const count = (fn) => rows.map(r => r.c.cards.filter(fn).length);
    /* club delivery: the club the room holds the most of */
    let bestClub = null, bestN = 0;
    for (const cl of PL_CLUBS) { const n = Math.max(...count(x => x.players.some(p => (PLAYER_BY_ID.get(p) || {}).club === cl.id))); if (n > bestN) { bestN = n; bestClub = cl; } }
    if (bestClub && bestN >= 2) options.push({ kind: 'deliver', need: { club: bestClub.id, n: Math.max(2, Math.min(5, Math.floor(bestN * 0.8))) } });
    const autos = Math.max(...count(x => edOf(x.ed).auto)); if (autos >= 1) options.push({ kind: 'deliver', need: { auto: true, n: Math.max(1, Math.min(3, Math.floor(autos * 0.7))) } });
    const rh = Math.max(...count(x => x.set === 'red-hot')); if (rh >= 3) options.push({ kind: 'deliver', need: { set: 'red-hot', n: Math.max(3, Math.min(8, Math.floor(rh * 0.6))) } });
    const tops = rows.map(r => r.c.top.map(u => r.c.cards.find(x => x.uid === u)).filter(Boolean).reduce((s, x) => s + cards.value(x), 0)).sort((a, b) => a - b);
    const med = tops[Math.floor(tops.length / 2)] || 0; if (med >= 30000) options.push({ kind: 'show', need: { minTop: Math.round(med * 1.15 / 1000) * 1000 } });
    if (!options.length) options.push({ kind: 'deliver', need: { set: 'red-hot', n: 2 } });
    const o = pick(options), minutes = solo ? ECON.dealer.soloRaceMinutes : ECON.dealer.raceMinutes;
    const reward = solo ? (o.kind === 'show' ? { cash: 25000 } : { pack: 'golden-star', n: 1 }) : { pack: 'god', n: 1 };
    const label = o.kind === 'show' ? 'First to show me a Top 5 worth $' + o.need.minTop.toLocaleString('en-US') + '!' : 'First to bring me ' + describe(o.need) + '!';
    return { id: crypto.randomUUID(), kind: o.kind, need: o.need, label, reward, consolation: { cash: solo ? 0 : 8000 }, startedAt: now, endsAt: now + minutes * 60000, solo, winner: null, winnerName: null, entries: [] };
  }
  function tick(now) {
    if (rotate(now)) broadcast({ orders: D().orders });
    const r = D().race;
    if (r && now >= r.endsAt) { D().past.unshift({ id: r.id, label: r.label, winnerName: r.winnerName, at: r.endsAt }); D().past = D().past.slice(0, 20); D().race = null; D().nextRaceAt = now + (ECON.dealer.raceEveryMin[0] + rnd(ECON.dealer.raceEveryMin[1] - ECON.dealer.raceEveryMin[0])) * 60000; touch(); broadcast({ raceOver: { id: r.id, winnerName: r.winnerName, label: r.label } }); }
    if (!D().race && now >= D().nextRaceAt) { const race = plan(now); if (race) { D().race = race; touch(); broadcast({ race }); } else D().nextRaceAt = now + 60000; }
  }
  function submit(w, id, raceId, uids, name) {
    const r = D().race; if (!r || r.id !== raceId) refuse('That race is over.'); const now = Date.now(); if (now > r.endsAt) refuse('Too late, the race is over.');
    const c = cards.ensure(w); if (c.races[r.id]) refuse('You already entered this race.');
    let handed = [];
    if (r.kind === 'show') { const top = c.top.map(u => c.cards.find(x => x.uid === u)).filter(Boolean), worth = top.reduce((s, x) => s + cards.value(x), 0); if (top.length < 5 || worth < r.need.minTop) refuse('Your Top 5 is worth $' + worth.toLocaleString('en-US') + '. Not enough yet.'); }
    else { handed = choose(w, id, r.need, uids); if (handed.length < (r.need.n || 1)) refuse('You do not have ' + describe(r.need) + ' to hand over.'); }
    /* from here on nothing awaits: the first valid entry is the winner */
    const first = !r.winner;
    if (handed.length) { const gone = new Set(handed.map(x => x.uid)); c.cards = c.cards.filter(x => !gone.has(x.uid)); }
    c.races[r.id] = now; r.entries.push({ code: id.slice(2, 12), name, at: now, won: first });
    let reward = null;
    if (first) { r.winner = id; r.winnerName = name; reward = r.reward; }
    else if (r.consolation.cash && r.entries.length <= 6) reward = { cash: r.consolation.cash };
    if (reward) { if (reward.cash) { w.coins = Math.floor(w.coins || 0) + reward.cash; w.stats = w.stats || {}; w.stats.earned = (w.stats.earned || 0) + reward.cash; } if (reward.pack) c.packs[reward.pack] = (Number(c.packs[reward.pack]) || 0) + (reward.n || 1); }
    const xp = awardXP(w, first ? ECON.xp.race : ECON.xp.order, ITEMS); touch();
    if (first) { broadcast({ raceWon: { id: r.id, winnerName: name, label: r.label } }); if (r.kind === 'deliver') { r.endsAt = Math.min(r.endsAt, now + 60000); } }
    return { won: first, reward, handed: handed.map(cards.view), xp };
  }
  const state = () => ({ orders: D().orders, race: D().race, past: D().past.slice(0, 5) });
  return { tick, rotate, preview, deliver, submit, state, plan, choose };
}
