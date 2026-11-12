/* Stakkz server rules. Everything that decides the game or a player's account happens here, on the server:
   the board rules (the same engine the page uses to draw and to play offline), dice, timers, coins, the shop and loot boxes.
   Pure functions: the worker loads and saves the data around them. */
import '../public/engine.js';
import { ITEMS, HAIRS } from './shop.js';
import { BOT_NAMES, BOT_LOOKS, isBot } from './bots.js';

const E = globalThis.Engine;
export const BOX_PRICE = 500000, GOLD_RATE = 1000, AWAY_MS = 45000;
const MYTHIC_ODDS = 0.15;   // every box holds an exclusive: Legendary usually, Mythical about one box in seven
const rarity = p => (p <= 40000 ? 0 : p <= 100000 ? 1 : p <= 300000 ? 2 : p <= 3000000 ? 3 : 4);
const exclusive = id => !!(ITEMS[id] && ITEMS[id][3] === 1);   // [3] 1 = loot boxes only, 2 = caught in the wild only
export { ITEMS };
const int = (v, lo, hi) => Math.max(lo, Math.min(hi, Math.floor(Number(v) || 0)));
const rnd = () => { const a = new Uint32Array(1); crypto.getRandomValues(a); return a[0] / 4294967296; };
const ctx = now => ({ now: now, rand: rnd, die: () => 1 + Math.floor(rnd() * 6) });
/* a rule the player ran into (shown to them), as opposed to a fault in the server */
export class Refused extends Error {}
const refuse = m => { throw new Refused(m); };

/* ---------- accounts ---------- */
export function freshWallet() {
  return { v: 3, t: 0, coins: 1000000, m1: 1, m10: 1, e7: 1, gt: 0, boxes: 1, own: [], claimed: [], games: {}, gb: {}, played: 0, wins: 0, soloAt: 0,
    stats: { earned: 0, rent: 0, bought: 0, kos: 0, best: 0, opened: 0 }, name: '', look: { skin: 0, hair: 'short', hc: 0, outfit: 'tee', hat: '', acc: '', bg: 'paper' }, pet: '' };
}
/* Passive gold: 1,000 a second while the server can hear the player (any request or an open world connection).
   The server's own clock decides; the page only animates the number between answers. */
export function boostOf(w, now) { const b = w.boost; return b && b.until > now ? b : null; }
export function earn(w, now) {
  const from = w.gt || 0; w.gt = now;
  if (!from || now <= from || now - from > AWAY_MS) return 0;
  const b = w.boost, boosted = b && b.until > from ? Math.min(now, b.until) - from : 0;
  const gain = Math.floor(((now - from) + boosted * ((b ? b.x : 1) - 1)) * GOLD_RATE / 1000);
  w.coins = Math.floor(w.coins || 0) + gain; if (b && b.until <= now) delete w.boost;
  return gain;
}
const owns = (w, id) => !!ITEMS[id] && (ITEMS[id][2] === 0 || w.own.indexOf(id) >= 0);
/* a look may only use what the account owns; anything else falls back to the free starter look */
export function setProfile(w, b) {
  if (typeof b.name === 'string') w.name = b.name.replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 12);
  const l = b.look && typeof b.look === 'object' ? b.look : w.look, out = { skin: int(l.skin, 0, 4), hc: int(l.hc, 0, 6), hair: 'short', outfit: 'tee', hat: '', acc: '', bg: 'paper' };
  if (HAIRS.indexOf(l.hair) >= 0) out.hair = l.hair;
  ['outfit', 'hat', 'acc', 'bg'].forEach(k => { const v = l[k]; if (typeof v === 'string' && v && owns(w, v) && ITEMS[v][0] === k) out[k] = v; });
  if (out.hc > 3 && !owns(w, 'dye')) out.hc = 0;
  w.look = out;
  const pet = typeof b.pet === 'string' ? b.pet : w.pet;
  w.pet = pet && owns(w, pet) && ITEMS[pet][0] === 'pet' ? pet : '';
}
/* loot boxes hold only exclusives, and never one you already own */
const missing = w => Object.keys(ITEMS).filter(id => exclusive(id) && ITEMS[id][0] === 'outfit' && !owns(w, id));
function rollLoot(w) {
  const pool = missing(w); if (!pool.length) return { coins: BOX_PRICE };   // nothing left to win: the box is refunded
  const myth = pool.filter(id => rarity(ITEMS[id][2]) === 4), leg = pool.filter(id => rarity(ITEMS[id][2]) !== 4);
  const from = myth.length && (!leg.length || rnd() < MYTHIC_ODDS) ? myth : leg;
  return { item: from[Math.floor(rnd() * from.length)] };
}
export function shop(w, what, item) {
  if (what === 'buy') {
    const it = ITEMS[item]; if (!it || it[2] <= 0) refuse('That is not for sale.');
    if (it[3]) refuse(it[3] === 2 ? 'That one can only be caught in the wild.' : 'That one only comes from loot boxes.');
    if (owns(w, item)) return {};
    if (w.coins < it[2]) refuse('You need ' + (it[2] - w.coins).toLocaleString('en-GB') + ' more coins.');
    w.coins -= it[2]; w.own.push(item); return {};
  }
  if (what === 'box') { if (!missing(w).length) refuse('You have collected every exclusive.'); if (w.coins < BOX_PRICE) refuse('You need ' + (BOX_PRICE - w.coins).toLocaleString('en-GB') + ' more coins for a loot box.'); w.coins -= BOX_PRICE; w.boxes++; return {}; }
  if (what === 'open') {
    if (w.boxes < 1) refuse('No loot boxes left.');
    const pz = rollLoot(w); w.boxes--; w.stats.opened++;
    if (pz.item) w.own.push(pz.item); else w.coins += pz.coins;
    return { prize: pz };
  }
  if (what === 'reset') refuse('Accounts can no longer be reset.');
  refuse('Unknown request.');
}
/* net worth: gold in hand plus the price of every item owned */
export function worth(w) { return Math.floor(w.coins || 0) + (Array.isArray(w.own) ? w.own : []).reduce((a, id) => a + (ITEMS[id] && ITEMS[id][2] > 0 ? ITEMS[id][2] : 0), 0); }
/* ---------- trading ---------- */
/* what one side may put up: things they own that the other side does not, and gold they really have */
export function tradeCheck(w, other, offer) {
  const raw = Array.isArray(offer && offer.items) ? offer.items : [], items = [...new Set(raw.filter(id => typeof id === 'string'))].slice(0, 12);
  items.forEach(id => { const it = ITEMS[id]; if (!it || it[2] <= 0 || w.own.indexOf(id) < 0) refuse('You can only trade items you own.'); if (other.own.indexOf(id) >= 0) refuse('They already own the ' + it[1] + '.'); });
  const gold = int(offer && offer.gold, 0, 1e12); if (gold > Math.floor(w.coins || 0)) refuse('You do not have that much gold.');
  return { items: items, gold: gold };
}
/* both sides are checked again at the moment of the swap, then everything moves at once */
export function tradeSwap(a, b, oa, ob) {
  const ca = tradeCheck(a, b, oa), cb = tradeCheck(b, a, ob);
  if (!ca.items.length && !cb.items.length && !ca.gold && !cb.gold) refuse('There is nothing in this trade.');
  a.own = a.own.filter(id => ca.items.indexOf(id) < 0).concat(cb.items); b.own = b.own.filter(id => cb.items.indexOf(id) < 0).concat(ca.items);
  a.coins = Math.floor(a.coins) - ca.gold + cb.gold; b.coins = Math.floor(b.coins) - cb.gold + ca.gold;
  setProfile(a, {}); setProfile(b, {});   // anything traded away comes off
  return { a: ca, b: cb };
}
/* Swag Level: starts at -100, tops out at 9,999. What you are wearing counts most; the whole collection adds to it. */
const WORN = [20, 70, 180, 520, 1500], KEPT = [3, 8, 20, 60, 150];
export function swag(w) {
  const own = Array.isArray(w.own) ? w.own.filter(id => ITEMS[id]) : [], has = new Set(own), l = w.look || {};
  const worn = [l.outfit, l.hat, l.acc, l.bg, w.pet].reduce((a, id) => { const it = ITEMS[id]; if (!it || it[2] <= 0 || !has.has(id)) return a; const r = rarity(it[2]); return a + WORN[r] * (it[3] ? 2 : 1); }, 0);
  const kept = [...has].reduce((a, id) => { const it = ITEMS[id]; return a + KEPT[rarity(it[2])] * (it[3] ? 3 : 1); }, 0);
  return Math.max(-100, Math.min(9999, -100 + worn + kept));
}
/* coins and loot boxes won in a game. `c` comes from the party's own state, so it can be trusted;
   a game played on one device (against the computer, or passed around) is reported by the page, so it is capped. */
export function credit(w, c, solo, now) {
  const key = String(c.key || ''); let coins = int(c.coins, 0, 1e7), boxes = int(c.boxes, 0, 99);
  if (solo) {
    const m = /^LOCAL:(\d{13})$/.exec(key); if (!m || +m[1] > now + 3e5 || +m[1] < now - 8 * 36e5) return;
    if (!(key in w.games) && !(key in w.gb) && w.claimed.indexOf('s:' + key) < 0) { if (now - (w.soloAt || 0) < 180000) return; w.soloAt = now; }
    coins = Math.min(coins, 30000); boxes = Math.min(boxes, 4);
  }
  if (coins > (w.games[key] || 0)) { const d = coins - (w.games[key] || 0); w.coins += d; w.stats.earned += d; w.games[key] = coins; }
  if (boxes > (w.gb[key] || 0)) { w.boxes += boxes - (w.gb[key] || 0); w.gb[key] = boxes; }
  if (c.over && w.claimed.indexOf('s:' + key) < 0) {
    w.claimed.push('s:' + key); w.claimed = w.claimed.slice(-40); w.played++; if (c.win) w.wins++;
    w.stats.rent += int(c.rent, 0, 1e7); w.stats.bought += int(c.bought, 0, 99); w.stats.kos += int(c.kos, 0, 9); w.stats.best = Math.max(w.stats.best, int(c.best, 0, 1e7));
  }
  [w.games, w.gb].forEach(m => { const ks = Object.keys(m); if (ks.length > 12) delete m[ks[0]]; });
}
export function spend(w, n) { n = int(n, 0, 1e7); if (w.coins < n) refuse('You only have ' + w.coins.toLocaleString('en-GB') + ' coins.'); w.coins -= n; }

/* ---------- parties ---------- */
const ACTS = ['roll', 'payJail', 'useCard', 'buy', 'skip', 'end', 'build', 'sellHouse', 'sellProp', 'mortgage', 'unmortgage', 'propose', 'accept', 'reject', 'cancel', 'rush', 'gift', 'quit', 'bankrupt', 'auto', 'bid', 'pass', 'stay', 'travel'];
/* only the fields an action can have, with the types the rules expect */
function cleanAct(a) {
  if (!a || ACTS.indexOf(a.t) < 0) refuse('Unknown move.');
  const tiles = v => (Array.isArray(v) ? v.slice(0, 28).map(x => int(x, 0, 39)) : []);
  return { t: a.t, tile: int(a.tile, 0, 39), to: int(a.to, 0, 5), n: int(a.n, 0, 20000), amt: int(a.amt, 0, 1e6), gc: int(a.gc, 0, 1e6), tc: int(a.tc, 0, 1e6), gp: tiles(a.gp), tp: tiles(a.tp) };
}
const seat = (s, id) => s.players.findIndex(p => p.id === id);
/* Bots are explicitly tagged on the server's player state, never identified by a client claim. */
function addBots(s, count, difficulty, code) {
  const num = int(count, 0, Math.min(4, s.max - s.players.length));
  const level = ['easy','medium','hard'].includes(difficulty) ? difficulty : 'medium';
  let out = s;
  for (let i = 0; i < num; i++) {
    const id = 'bot:' + code + ':' + (i + 1);
    out = E.join(out, id, BOT_NAMES[i], BOT_LOOKS[i], '');
    out.players[out.players.length - 1].bot = level;
  }
  return out;
}
/* One request to a party. `s` is the stored state (null if there is none), `user` is who is asking, as the server knows them.
   Returns the new state, or `gone` when the party is finished with. Throws Refused for anything the rules do not allow. */
export function partyOp(s, op, user, body, now, code) {
  const me = s ? seat(s, user.id) : -1, name = user.name || 'Player ' + ((s ? s.players.length : 0) + 1);
  let n = s;
  try {
    if (op === 'create') {
      if (s) refuse('taken');
      const mode = body.mode === 'classic' ? 'classic' : [25,35,45].includes(Number(body.mode)) ? Number(body.mode) : 35;
      const timer = [20,25,30,35,45,50,60].includes(Number(body.turnTimer)) ? Number(body.turnTimer) : 0;
      const max = [2,3,4,5,6].includes(Number(body.max)) ? Number(body.max) : 6;
      n = E.join(E.newRoom(code, { mode: mode, max: max, timer: timer }), user.id, user.name || 'Host', user.look, user.pet);
      n = addBots(n, body.bots, body.difficulty, code); n.made = now;
    } else if (!s) refuse('No party with the code ' + code + '.');
    else if (op === 'join') { if (s.phase === 'lobby' && me < 0) n = E.join(s, user.id, name, user.look, user.pet); }
    else if (op === 'leave') {
      if (s.phase === 'lobby' && me >= 0) {
        n = E.leave(s, user.id);
        /* Server-owned AI seats cannot host a party. Remove an empty bot-only
           lobby, or promote the next human while preserving all bot seats. */
        const humans = n.players.filter(p => !isBot(p));
        if (!humans.length) return { state: null, gone: true, credits: [] };
        if (isBot(n.players[0])) {
          n.players = humans.concat(n.players.filter(isBot));
          n.v++; n.w = 'host' + n.v;
        }
      }
    }
    else if (op === 'style') {
      if (me < 0) refuse('You are not in this party.');
      if (s.phase === 'lobby') n = E.restyle(s, user.id, user.look, user.pet);
      else if (s.phase === 'play' && !s.players[me].out) { n = E.act(s, me, { t: 'style', look: user.look, pet: user.pet }, ctx(now)); n.players[me].name = s.players[me].name; }
    }
    else if (op === 'start') { if (me < 0) refuse('You are not in this party.'); n = E.start(s, me, ctx(now)); }
    else if (op === 'again') {
      if (s.phase === 'over') { if (me < 0) refuse('You were not in that game.'); n = E.restyle(E.again(s, user.id), user.id, user.look, user.pet);
        const oldBots = s.players.filter(isBot);
        oldBots.forEach(bot => { n = E.join(n, bot.id, bot.name, bot.look, bot.pet); n.players[n.players.length-1].bot = bot.bot; });
        n.made = now; }
      else if (s.phase === 'lobby' && me < 0) n = E.join(s, user.id, name, user.look, user.pet);
    }
    else if (op === 'chaos') { n = E.chaosStep(s, ctx(now)); }
    else if (op === 'expire') { n = E.expire(s, ctx(now)); }
    else if (op === 'act') { if (me < 0) refuse('You are not playing in this game.'); n = E.act(s, me, cleanAct(body.a), ctx(now)); }
    else refuse('Unknown request.');
  } catch (e) {
    if (e instanceof Refused) throw e;
    if (e instanceof TypeError || e instanceof RangeError || e instanceof ReferenceError) throw e;   // a fault, not a rule
    throw new Refused(e.message);                                                                     // the engine said no
  }
  return { state: n, credits: n === s ? [] : earnings(s, n) };
}
/* what each player has earned so far in this game, for anyone whose total has just changed */
function earnings(prev, next) {
  if (!next.startedAt || next.phase === 'lobby') return [];
  const key = next.code + ':' + next.startedAt, over = next.phase === 'over', fresh = !prev || prev.startedAt !== next.startedAt, ended = over && (!prev || prev.phase !== 'over');
  return next.players.map((p, i) => {
    if (isBot(p)) return null;
    const q = fresh ? null : prev.players[i];
    if (q && !ended && q.coins === p.coins && q.boxes === p.boxes && q.out === p.out) return null;
    return { id: p.id, c: { key: key, coins: p.coins, boxes: p.boxes, over: over, win: over && next.winners.indexOf(i) >= 0, rent: p.rentIn, bought: p.bought, kos: p.kos, best: over ? E.worth(next, i) : 0 } };
  }).filter(Boolean);
}
