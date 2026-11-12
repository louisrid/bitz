/* BITZ cards: the server-authoritative collecting service. Packs, boxes, guarantees, numbered serials, the
   collector book (best edition you personally packed), the Card Buyer, trades, Top 5, net worth and milestones.
   Every change goes through here; the page only displays what this returns. */
import crypto from 'node:crypto';
import { ECON, SETS, PACKS, EDITIONS, RARE, SEASON, BOX_PACKS, boxPrice, packWorth, edOf, rankOf, isOneOfOne, protectedEdition, pool, dualPartners, cardValue, sellPrice, ONE_OF_ONES } from './econ.js';
import { PLAYERS, PLAYER_BY_ID, PL_CLUBS, CLUB_BY_ID, MAIN_BY_CLUB } from './catalogue.js';
import { awardXP, progressOf } from './progression.js';
import { ITEMS } from './shop.js';

export class CardError extends Error {}
const refuse = m => { throw new CardError(m); };
const rnd = max => crypto.randomInt(max);
const uuid = () => crypto.randomUUID();
export function weighted(odds) { const e = Object.entries(odds); const total = e.reduce((s, x) => s + x[1], 0); let n = (crypto.randomInt(1 << 30) / (1 << 30)) * total; for (const [k, w] of e) { n -= w; if (n < 0) return k; } return e[e.length - 1][0]; }
function pickPlayer(list) { let total = 0; for (const x of list) total += x[1]; let n = (crypto.randomInt(1 << 30) / (1 << 30)) * total; for (const [p, w] of list) { n -= w; if (n < 0) return p; } return list[list.length - 1][0]; }
const serialKey = (set, ed, ids) => SEASON + ':' + set + ':' + ed + ':' + ids.join('+');

export function freshCards() { return { v: ECON.version, cards: [], packs: { [ECON.welcome]: 1 }, book: {}, claimed: {}, top: [], ms: {}, peak: 0, orders: {}, races: {}, lock: [], stats: { opened: 0, sold: 0, soldFor: 0, found: 0, best: null } }; }

/* the one-time versioned reset: old balances, cards and packs are archived on the account, never deleted */
export function migrate(w, now) {
  const from = w.econ && w.econ.v || 1;
  if (from >= ECON.version) { if (!w.cards) w.cards = freshCards(); return false; }
  w.archive = w.archive && typeof w.archive === 'object' ? w.archive : {};
  w.archive['v' + from] = { at: now, coins: w.coins, football: w.football || null, boxes: w.boxes || 0, themeBoxes: w.themeBoxes || null, xp: w.xp || 0, level: w.level || 1, daily: w.daily || null, stats: w.stats || null };
  w.coins = 0; w.xp = 0; w.level = 1; w.cards = freshCards();
  for (const k of ['football', 'boxes', 'themeBoxes', 'daily', 'boost', 'gt', 'goldCarry', 'hiddenFriends', 'games', 'gb', 'claimed']) delete w[k];
  w.stats = { earned: 0 };
  w.econ = { v: ECON.version, at: now };
  return true;
}

export function createCardService({ accounts, serials, offers, world, markDirty, resolvePlayer, nameOf }) {
  const touch = () => markDirty();
  const ensure = w => { if (!w.cards || typeof w.cards !== 'object') { w.cards = freshCards(); touch(); } const c = w.cards; for (const k of ['cards', 'top', 'lock']) if (!Array.isArray(c[k])) c[k] = []; for (const k of ['packs', 'book', 'claimed', 'ms', 'orders', 'races']) if (!c[k] || typeof c[k] !== 'object') c[k] = {}; if (!c.stats) c.stats = { opened: 0, sold: 0, soldFor: 0, found: 0, best: null }; return c; };
  const owned = (w, uid) => ensure(w).cards.find(c => c.uid === uid);
  const reserved = (id, uid) => [...offers.values()].some(o => o.status === 'pending' && ((o.fromId === id && o.fromCards.includes(uid)) || (o.toId === id && o.toCards.includes(uid))));
  const value = c => cardValue(c);
  const ones1 = () => (world.ones && typeof world.ones === 'object' ? world.ones : (world.ones = {}));
  const pulls = () => (Array.isArray(world.pulls) ? world.pulls : (world.pulls = []));

  /* ---------- rolling ---------- */
  function rollCard(w, packId, setId, odds, forced) {
    let ed = forced || weighted(odds), e = edOf(ed), players = [], tries = 0, p;
    const left = (ids) => Number(serials.get(serialKey(setId, ed, ids)) || 0) < e.serialMax;
    for (;;) {
      p = pickPlayer(pool(setId, ed)); players = [p.id];
      if (e.dual) { const partners = dualPartners(setId, ed, p); players.push(pickPlayer(partners).id); }
      if (!e.serialMax || left(players)) break;
      if (++tries >= 8) {   // random picks keep hitting sold-out players: choose among those that still have a serial, or fall back if none do
        const open = pool(setId, ed).filter(([q]) => left([q.id]));
        if (open.length && !e.dual) { p = pickPlayer(open); players = [p.id]; break; }
        if (open.length && e.dual) { p = pickPlayer(open); const partners = dualPartners(setId, ed, p).filter(([q]) => left([p.id, q.id])); if (partners.length) { players = [p.id, pickPlayer(partners).id]; break; } }
        const fallback = Object.keys(odds).filter(k => !edOf(k).serialMax && edOf(k).rank <= e.rank).sort((a, b) => rankOf(b) - rankOf(a))[0] || Object.keys(odds).find(k => !edOf(k).serialMax) || Object.keys(odds)[0];
        ed = fallback; e = edOf(ed); p = pickPlayer(pool(setId, ed)); players = [p.id]; if (e.dual) players.push(pickPlayer(dualPartners(setId, ed, p)).id); break;
      }
    }
    let serial = null;
    if (e.serialMax && left(players)) { const key = serialKey(setId, ed, players); serial = (Number(serials.get(key)) || 0) + 1; serials.set(key, serial); }
    return { uid: uuid(), player: players[0], players, set: setId, ed, pack: packId, season: SEASON, serial, serialMax: e.serialMax || null, at: Date.now(), src: 'pack' };
  }
  function rollPack(w, packId) {
    const pk = PACKS[packId]; if (!pk) refuse('Unknown pack.');
    let cards = pk.slots.map(([setId, odds]) => rollCard(w, packId, setId, odds));
    const g = pk.guarantee || {};
    if (g.rank != null && !cards.some(c => rankOf(c.ed) >= g.rank)) {   // the published guarantee: re-roll the rare slot within qualifying editions only
      const i = pk.slots.length - 1, [setId, odds] = pk.slots[i], ok = Object.fromEntries(Object.entries(odds).filter(([k]) => rankOf(k) >= g.rank));
      cards[i] = rollCard(w, packId, setId, Object.keys(ok).length ? ok : odds);
    }
    if (g.auto && !cards.some(c => edOf(c.ed).auto)) {
      const i = pk.slots.findIndex(([, odds]) => Object.keys(odds).every(k => edOf(k).auto)), k = i < 0 ? pk.slots.length - 1 : i, [setId, odds] = pk.slots[k], ok = Object.fromEntries(Object.entries(odds).filter(([x]) => edOf(x).auto));
      cards[k] = rollCard(w, packId, setId, Object.keys(ok).length ? ok : odds);
    }
    cards.sort((a, b) => value(a) - value(b) || rankOf(a.ed) - rankOf(b.ed));   // best last
    return cards;
  }
  const better = (a, b) => !b || rankOf(a.ed) > rankOf(b.ed) || (rankOf(a.ed) === rankOf(b.ed) && value(a) > (b.v || 0));
  function record(w, c, card, name) {
    for (const pid of card.players) {
      const prev = c.book[pid], entry = { ed: card.ed, set: card.set, at: card.at, v: value(card), serial: card.serial, uid: card.uid };
      if (!prev) c.stats.found++;
      if (better(entry, prev)) c.book[pid] = entry;
    }
    const v = value(card);
    if (!c.stats.best || v > c.stats.best.v) c.stats.best = { uid: card.uid, ed: card.ed, player: card.player, players: card.players, set: card.set, serial: card.serial, v, at: card.at };
    if (isOneOfOne(card.ed)) { ones1()[card.set + ':' + card.ed + ':' + card.player] = { uid: card.uid, by: name, at: card.at, v }; }
    if (rankOf(card.ed) >= 7 || v >= 100000) { pulls().unshift({ by: name, ed: card.ed, player: card.player, players: card.players, set: card.set, serial: card.serial, v, at: card.at }); if (world.pulls.length > 40) world.pulls.length = 40; }
  }

  /* ---------- buying and opening ---------- */
  function buy(w, setId, kind) {
    const s = SETS[setId]; if (!s || !s.shop) refuse('That pack is not for sale.');
    const c = ensure(w), box = kind === 'box', price = box ? boxPrice(setId) : s.price;
    if (!Number.isFinite(w.coins) || w.coins < price) refuse('You need $' + (price - Math.floor(w.coins || 0)).toLocaleString('en-US') + ' more.');
    w.coins = Math.floor(w.coins) - price; c.packs[setId] = (Number(c.packs[setId]) || 0) + (box ? BOX_PACKS : 1); touch();
    return { bought: setId, box, price, packs: c.packs };
  }
  function open(w, id, packId, count, name) {
    const c = ensure(w), pk = PACKS[packId]; if (!pk) refuse('Unknown pack.');
    count = Math.max(1, Math.min(ECON.maxOpen, Math.floor(Number(count) || 1)));
    const have = Number(c.packs[packId]) || 0; if (have < count) refuse(have ? 'You only have ' + have + ' of those.' : 'You do not have that pack.');
    if (c.cards.length + count * pk.slots.length > ECON.maxCards) refuse('Your collection is full. Sell some cards first.');
    const before = new Set(Object.keys(c.book)), packs = [], ones = [];
    c.packs[packId] = have - count; if (!c.packs[packId]) delete c.packs[packId];
    for (let i = 0; i < count; i++) {
      const cards = rollPack(w, packId);
      for (const card of cards) { c.cards.push(card); record(w, c, card, name); if (isOneOfOne(card.ed)) ones.push(card); }
      packs.push(cards);
    }
    c.stats.opened += count;
    const xp = awardXP(w, Math.min(600, count * ECON.xp.open), ITEMS);
    touch();
    const all = packs.flat();
    return { packs, pack: packId, value: all.reduce((s, x) => s + value(x), 0), discovered: [...new Set(all.flatMap(x => x.players))].filter(pid => !before.has(pid)), ones: ones.map(view), xp, best: all.slice().sort((a, b) => value(b) - value(a))[0] };
  }

  /* ---------- the Card Buyer ---------- */
  function quote(w, id, uids) {
    const c = ensure(w), top = new Set(c.top), lock = new Set(c.lock), rows = [];
    for (const uid of uids) {
      const card = owned(w, uid); if (!card) refuse('You do not own one of those cards.');
      rows.push({ uid, v: value(card), pay: sellPrice(value(card)), locked: lock.has(uid), top: top.has(uid), reserved: reserved(id, uid), protected: protectedEdition(card.ed) });
    }
    return rows;
  }
  function sell(w, id, uids, confirm) {
    if (!Array.isArray(uids) || !uids.length || uids.length > 500 || uids.length !== new Set(uids).size) refuse('Choose the cards to sell.');
    const c = ensure(w), ok = new Set(Array.isArray(confirm) ? confirm : []), rows = quote(w, id, uids);
    for (const r of rows) {
      if (r.locked) refuse('A locked card is in that list. Unlock it first.');
      if (r.top) refuse('A Top 5 card is in that list. Take it out of your showcase first.');
      if (r.reserved) refuse('A card in a pending trade is in that list.');
      if (r.protected && !ok.has(r.uid)) refuse('Confirm the numbered or signed cards one by one before selling them.');
    }
    const gone = new Set(uids), sold = c.cards.filter(x => gone.has(x.uid)); c.cards = c.cards.filter(x => !gone.has(x.uid));
    const pay = rows.reduce((s, r) => s + r.pay, 0);
    w.coins = Math.floor(w.coins || 0) + pay; c.stats.sold += sold.length; c.stats.soldFor += pay; w.stats = w.stats || {}; w.stats.earned = (w.stats.earned || 0) + pay;
    const xp = awardXP(w, Math.min(200, sold.length * ECON.xp.sell), ITEMS); touch();
    return { sold: sold.map(view), pay, xp };
  }
  function lock(w, uid, on) { const c = ensure(w); if (!owned(w, uid)) refuse('You do not own that card.'); const s = new Set(c.lock); if (on) s.add(uid); else s.delete(uid); c.lock = [...s].slice(-2000); touch(); return { lock: c.lock }; }

  /* ---------- Top 5 ---------- */
  function setTop(w, uids) {
    const c = ensure(w); if (!Array.isArray(uids) || uids.length > 5 || uids.length !== new Set(uids).size) refuse('Choose up to five different cards.');
    if (!uids.every(u => typeof u === 'string' && owned(w, u))) refuse('You can only showcase cards you own.');
    c.top = uids; touch(); return { top: c.top };
  }

  /* ---------- the book and clubs ---------- */
  function clubProgress(w) {
    const c = ensure(w), have = new Set(c.cards.flatMap(x => x.players));
    return PL_CLUBS.map(cl => { const main = MAIN_BY_CLUB.get(cl.id); return { id: cl.id, owned: main.filter(p => have.has(p.id)).length, slots: 11, claimed: !!c.claimed[cl.id] }; });
  }
  function claimClub(w, clubId) {
    const c = ensure(w), club = CLUB_BY_ID.get(clubId); if (!club || club.league !== 'PL') refuse('Unknown club.');
    if (c.claimed[clubId]) refuse('You already claimed this club.');
    const have = new Set(c.cards.flatMap(x => x.players)); if (MAIN_BY_CLUB.get(clubId).some(p => !have.has(p.id))) refuse('Own all eleven main players first.');
    c.claimed[clubId] = Date.now(); c.packs[ECON.club.pack] = (Number(c.packs[ECON.club.pack]) || 0) + ECON.club.n;
    const item = 'scarf_' + clubId; w.own = Array.isArray(w.own) ? w.own : []; if (ITEMS[item] && !w.own.includes(item)) w.own.push(item);
    const xp = awardXP(w, ECON.xp.club, ITEMS); touch();
    return { claimed: clubId, pack: ECON.club.pack, n: ECON.club.n, item, xp };
  }

  /* ---------- net worth and milestones ---------- */
  function netWorth(w) {
    const c = ensure(w); let cards = 0; for (const x of c.cards) cards += value(x);
    let packs = 0; for (const [k, n] of Object.entries(c.packs)) packs += packWorth(k) * (Number(n) || 0);
    return { cash: Math.floor(w.coins || 0), cards, packs, total: Math.floor(w.coins || 0) + cards + packs };
  }
  function peak(w) { const c = ensure(w), nw = netWorth(w); if (nw.total > (c.peak || 0)) { c.peak = nw.total; touch(); } return nw; }
  function milestones(w) { const c = ensure(w); peak(w); return Object.keys(ECON.milestones).map(Number).sort((a, b) => a - b).map(t => ({ at: t, reward: ECON.milestones[t], ready: c.peak >= t && !c.ms[t], claimed: !!c.ms[t] })); }
  function claimMilestone(w, t) {
    const c = ensure(w), r = ECON.milestones[t]; if (!r) refuse('Unknown milestone.'); peak(w);
    if (c.ms[t]) refuse('Already claimed.'); if (c.peak < t) refuse('Not there yet.');
    c.ms[t] = Date.now(); c.packs[r.pack] = (Number(c.packs[r.pack]) || 0) + r.n;
    if (r.item && ITEMS[r.item]) { w.own = Array.isArray(w.own) ? w.own : []; if (!w.own.includes(r.item)) w.own.push(r.item); }
    touch(); return { milestone: t, reward: r };
  }

  /* ---------- trades ---------- */
  function offer(fromId, targetCode, give, take) {
    const toId = resolvePlayer(targetCode); if (!toId || toId === fromId) refuse('Choose another player.');
    const from = accounts.get(fromId), to = accounts.get(toId); if (!from || !to) refuse('Player unavailable.');
    ensure(from); ensure(to);
    if (!Array.isArray(give) || !Array.isArray(take) || give.length > 10 || take.length > 10 || (!give.length && !take.length)) refuse('Choose the cards to exchange.');
    if (give.length !== new Set(give).size || take.length !== new Set(take).size) refuse('Duplicate card in the offer.');
    if (!give.every(u => owned(from, u)) || !take.every(u => owned(to, u))) refuse('A card in the offer has changed hands.');
    if (give.some(u => from.cards.lock.includes(u))) refuse('Unlock your locked cards before offering them.');
    if ([...offers.values()].filter(x => x.status === 'pending' && (x.fromId === fromId || x.toId === fromId)).length >= 8) refuse('Too many pending offers.');
    const id = uuid(), now = Date.now();
    offers.set(id, { id, fromId, toId, fromCards: give, toCards: take, createdAt: now, expiresAt: now + 24 * 3600000, status: 'pending' }); touch();
    return { offer: id, toId };
  }
  function decision(id, tradeId, accept) {
    const t = offers.get(tradeId); if (!t) refuse('Trade not found.');
    if (t.status !== 'pending') refuse('This trade was already resolved.');
    if (t.expiresAt < Date.now()) { t.status = 'expired'; touch(); refuse('That offer expired.'); }
    if (!accept) { if (id !== t.toId && id !== t.fromId) refuse('Not your trade.'); t.status = id === t.fromId ? 'cancelled' : 'declined'; touch(); return { declined: tradeId, fromId: t.fromId, toId: t.toId }; }
    if (id !== t.toId) refuse('Only the receiving player can accept.');
    const a = accounts.get(t.fromId), b = accounts.get(t.toId); if (!a || !b) refuse('A player is unavailable.');
    const ca = ensure(a), cb = ensure(b), from = t.fromCards.map(u => owned(a, u)), to = t.toCards.map(u => owned(b, u));
    if (from.some(x => !x) || to.some(x => !x)) { t.status = 'expired'; touch(); refuse('The trade is no longer valid: a card changed hands.'); }
    if (ca.cards.length - from.length + to.length > ECON.maxCards || cb.cards.length - to.length + from.length > ECON.maxCards) refuse('A collection is full.');
    const giving = new Set(t.fromCards), taking = new Set(t.toCards), stamp = x => Object.assign({}, x, { src: 'trade', tradedAt: Date.now() });
    ca.cards = ca.cards.filter(x => !giving.has(x.uid)).concat(to.map(stamp)); cb.cards = cb.cards.filter(x => !taking.has(x.uid)).concat(from.map(stamp));
    ca.top = ca.top.filter(u => !giving.has(u)); cb.top = cb.top.filter(u => !taking.has(u)); ca.lock = ca.lock.filter(u => !giving.has(u)); cb.lock = cb.lock.filter(u => !taking.has(u));
    t.status = 'accepted'; t.acceptedAt = Date.now();
    awardXP(a, ECON.xp.trade, ITEMS); awardXP(b, ECON.xp.trade, ITEMS); touch();
    return { accepted: tradeId, fromId: t.fromId, toId: t.toId, received: from.map(view), sent: to.map(view) };
  }
  const trades = id => [...offers.values()].filter(x => x.toId === id || x.fromId === id).sort((a, b) => b.createdAt - a.createdAt).slice(0, 40).map(x => ({ ...x, fromName: nameOf(x.fromId), toName: nameOf(x.toId), fromCode: x.fromId.slice(2, 12), toCode: x.toId.slice(2, 12) }));

  /* ---------- views ---------- */
  function view(card) { return { ...card, v: value(card) }; }
  function self(w, id) {
    const c = ensure(w), nw = peak(w);
    return { season: SEASON, cards: c.cards.map(view), packs: c.packs, book: c.book, claimed: c.claimed, top: c.top, lock: c.lock, ms: c.ms, peak: c.peak, stats: c.stats, clubs: clubProgress(w), nw, milestones: milestones(w), trades: trades(id), orders: c.orders, races: c.races };
  }
  function publicProfile(w, id) {
    const c = ensure(w), nw = peak(w), clubs = clubProgress(w);
    return { code: id.slice(2, 12), name: w.name || 'Player', level: progressOf(w).level, look: w.look || {}, pet: w.pet || '', nw: nw.total, top: c.top.map(u => owned(w, u)).filter(Boolean).map(view), best: c.stats.best, cards: c.cards.length, found: Object.keys(c.book).length, clubsDone: clubs.filter(x => x.owned >= 11).length, ones: c.cards.filter(x => isOneOfOne(x.ed)).length };
  }
  function ones() {
    const out = [];
    for (const ed of ONE_OF_ONES) { const e = EDITIONS[ed]; for (const p of PLAYERS) { if (pool(e.set, ed).every(([q]) => q.id !== p.id)) continue; const k = e.set + ':' + ed + ':' + p.id, hit = ones1()[k]; out.push({ set: e.set, ed, player: p.id, found: !!hit, by: hit ? hit.by : null, at: hit ? hit.at : null, v: cardValue({ ed, player: p.id, players: [p.id] }) }); } }
    return out;
  }
  function move(verb, w, id, b, name) {
    switch (verb) {
      case 'buy': return buy(w, String(b.set || ''), b.kind === 'box' ? 'box' : 'pack');
      case 'open': return open(w, id, String(b.pack || ''), b.count, name);
      case 'quote': return { quote: quote(w, id, Array.isArray(b.cards) ? b.cards.slice(0, 500) : []) };
      case 'sell': return sell(w, id, b.cards, b.confirm);
      case 'lock': return lock(w, String(b.uid || ''), !!b.on);
      case 'top': return setTop(w, b.cards);
      case 'claim-club': return claimClub(w, String(b.club || ''));
      case 'claim-milestone': return claimMilestone(w, Number(b.at));
      case 'offer': return offer(id, String(b.to || ''), b.give, b.take);
      case 'accept': return decision(id, String(b.trade || ''), true);
      case 'decline': return decision(id, String(b.trade || ''), false);
    }
    refuse('Unknown card action.');
  }
  return { ensure, migrate, open, rollPack, roll: rollCard, buy, sell, quote, lock, netWorth, peak, clubProgress, claimClub, milestones, claimMilestone, setTop, offer, decision, trades, self, publicProfile, ones, view, value, owned, reserved, move, world };
}
