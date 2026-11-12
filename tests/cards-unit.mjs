/* BITZ unit tests: roster, packs, guarantees, odds, serials, the book, selling, trades, clubs, milestones, the Dealer and friends. */
import assert from 'node:assert/strict';
import '../public/world-layout.js';
import { PLAYERS, PL_CLUBS, MAIN_BY_CLUB, PLAYER_BY_ID, validate } from '../src/catalogue.js';
import { ECON, SETS, PACKS, EDITIONS, RARE, edOf, rankOf, packStats, boxPrice, packWorth, cardValue, sellPrice, protectedEdition, pool } from '../src/econ.js';
import { createCardService, migrate, CardError, freshCards } from '../src/cards.js';
import { createDealer, qualifies } from '../src/dealer.js';
import { createFriends } from '../src/friends.js';
import * as core from '../src/core.js';
import { progressOf } from '../src/progression.js';
const check = (name, fn) => { fn(); console.log('PASS', name); };
const A = 'p_' + 'a'.repeat(24), B = 'p_' + 'b'.repeat(24);
const accounts = new Map(), serials = new Map(), offers = new Map(), world = {}; let dirty = 0;
const names = { [A]: 'Alpha', [B]: 'Bravo' };
const mk = id => { const w = core.freshWallet(); w.name = names[id]; w.econ = { v: ECON.version }; accounts.set(id, w); w.cards = freshCards(); return w; };
const a = mk(A), b = mk(B);
const svc = createCardService({ accounts, serials, offers, world, markDirty: () => dirty++, resolvePlayer: c => [...accounts.keys()].find(id => id.slice(2, 12) === c), nameOf: id => names[id] || 'Player' });

check('roster: 265 unique players, 20 clubs x 11 main, 25 bonus, 20 UCL stars', () => {
  assert.deepEqual(validate(), []); assert.equal(PLAYERS.length, 265); assert.equal(PL_CLUBS.length, 20);
  for (const c of PL_CLUBS) assert.equal(MAIN_BY_CLUB.get(c.id).length, 11);
  assert.equal(PLAYERS.filter(p => p.group === 'bonus').length, 25); assert.equal(PLAYERS.filter(p => p.ucl).length, 20);
  for (const n of ['Erling Haaland', 'Kylian Mbappe', 'Lamine Yamal', 'Max Dowman', 'Carl Rushworth']) assert(PLAYERS.some(p => p.name === n), n);
});
check('store: exactly three collections, each with a pack and a box of ten', () => {
  const shop = Object.entries(SETS).filter(([, s]) => s.shop).map(([k]) => k);
  assert.deepEqual(shop, ['red-hot', 'golden-star', 'european-nights']);
  for (const s of shop) { assert.equal(PACKS[s].slots.length, 5); assert.equal(boxPrice(s), Math.round(SETS[s].price * 9.5)); assert(packWorth(s) < SETS[s].price); }
  assert(!SETS.god.shop && !SETS.welcome.shop);
  for (const [id, e] of Object.entries(EDITIONS)) assert(SETS[e.set], id + ' set');
  for (const [pk, p] of Object.entries(PACKS)) for (const [set, odds] of p.slots) for (const ed of Object.keys(odds)) assert.equal(EDITIONS[ed].set, set, pk + ' slot leaks ' + ed);
});
check('values: desirability beats autographs on weak players; 1/1s reach millions; no buy-open-sell profit', () => {
  const v = (ed, id) => cardValue({ ed, player: id, players: [id] });
  assert(v('gs-auto', 'john-egan') < v('en-fullart', 'erling-haaland'));
  assert(v('rh-common', 'erling-haaland') > v('rh-common', 'john-egan') * 10);
  assert(v('en-masterpiece', 'kylian-mbappe') > 5000000 && v('rh-firestorm', 'john-egan') > 100000);
  for (const s of ['red-hot', 'golden-star', 'european-nights']) { const st = packStats(s); assert(st.ev * ECON.sellRate < SETS[s].price * 0.8, s + ' sells back for too much'); assert(st.ev > SETS[s].price * 0.85 && st.ev < SETS[s].price * 1.12, s + ' EV ' + st.ev); }
});
check('migration: legacy balances and cards are archived once, then never touched again', () => {
  const w = core.freshWallet(); w.coins = 12345678; w.football = { cards: [{ uid: 'old' }], packs: { 'first-xi': 2 } }; w.xp = 900; w.level = 5; w.own = ['cat', 'x_sun']; w.look.outfit = 'tux';
  assert.equal(migrate(w, 1000), true);
  assert.equal(w.coins, 0); assert.equal(w.xp, 0); assert.equal(w.level, 1); assert(!w.football); assert.equal(w.cards.packs.welcome, 1);
  assert.equal(w.archive.v1.coins, 12345678); assert.equal(w.archive.v1.football.cards[0].uid, 'old'); assert.deepEqual(w.own, ['cat', 'x_sun']); assert.equal(w.look.outfit, 'tux');
  w.coins = 500; assert.equal(migrate(w, 2000), false); assert.equal(w.coins, 500);
});
check('welcome pack: five cards, a Rare-or-better, real names, best card last, book updated', () => {
  const r = svc.open(a, A, 'welcome', 1, 'Alpha');
  assert.equal(r.packs.length, 1); const cards = r.packs[0]; assert.equal(cards.length, 5);
  assert(cards.some(c => rankOf(c.ed) >= RARE)); for (const c of cards) { assert(PLAYER_BY_ID.get(c.player)); assert.equal(c.set, 'red-hot'); }
  for (let i = 1; i < cards.length; i++) assert(svc.value(cards[i]) >= svc.value(cards[i - 1]));
  assert.equal(svc.self(a, A).cards.length, 5); assert(Object.keys(a.cards.book).length >= 1); assert(!a.cards.packs.welcome);
  assert.throws(() => svc.open(a, A, 'welcome', 1, 'Alpha'), CardError);
});
check('buying: price, boxes of ten, no cash shortcuts', () => {
  a.coins = 15000 * 2 + boxPrice('red-hot'); svc.buy(a, 'red-hot', 'pack'); svc.buy(a, 'red-hot', 'box');
  assert.equal(a.cards.packs['red-hot'], 11); assert.equal(a.coins, 15000);
  assert.throws(() => svc.buy(a, 'european-nights', 'pack'), CardError); assert.throws(() => svc.buy(a, 'god', 'pack'), CardError);
});
check('odds: 6000 Red Hot packs match the published per-pack chances and the Rare guarantee always holds', () => {
  const w = mk('p_' + 'c'.repeat(24)); w.cards.packs['red-hot'] = 6000; const r = svc.open(w, 'p_' + 'c'.repeat(24), 'red-hot', 50, 'Charlie');
  let all = r.packs; for (let i = 1; i < 120; i++) { w.cards.cards = []; all = all.concat(svc.open(w, 'p_' + 'c'.repeat(24), 'red-hot', 50, 'Charlie').packs); }
  assert.equal(all.length, 6000); const pub = packStats('red-hot').perEd, seen = {};
  for (const pk of all) { assert(pk.some(c => rankOf(c.ed) >= RARE)); for (const ed of new Set(pk.map(c => c.ed))) seen[ed] = (seen[ed] || 0) + 1; }
  for (const [ed, x] of Object.entries(pub)) { if (x.p < 0.01) continue; const got = (seen[ed] || 0) / 6000; assert(Math.abs(got - x.p) < Math.max(0.025, x.p * 0.2), ed + ' published ' + x.p.toFixed(3) + ' got ' + got.toFixed(3)); }
  const commons = all.flat().filter(c => rankOf(c.ed) <= 1).length / 30000; assert(commons > 0.55, 'ordinary pulls must stay common: ' + commons);
  accounts.delete('p_' + 'c'.repeat(24));
});
check('Golden Star always has an autograph, mostly from less desirable players; European Nights is elite only', () => {
  const id = 'p_' + 'd'.repeat(24), w = mk(id); w.cards.packs['golden-star'] = 600; w.cards.packs['european-nights'] = 300;
  let gs = []; for (let i = 0; i < 12; i++) gs = gs.concat(svc.open(w, id, 'golden-star', 50, 'Delta').packs);
  let autos = 0, weak = 0; for (const pk of gs) { const au = pk.filter(c => edOf(c.ed).auto); assert(au.length >= 1); assert(pk.some(c => rankOf(c.ed) >= RARE)); autos += au.length; weak += au.filter(c => PLAYER_BY_ID.get(c.player).d < 3).length; }
  assert(weak / autos > 0.6, 'most autographs should be squad players: ' + (weak / autos).toFixed(2));
  let en = []; for (let i = 0; i < 6; i++) en = en.concat(svc.open(w, id, 'european-nights', 50, 'Delta').packs);
  for (const pk of en) for (const c of pk) { const p = PLAYER_BY_ID.get(c.player); assert(p.ucl || p.d >= 3, 'filler in European Nights: ' + p.name); assert(rankOf(c.ed) >= RARE); assert.equal(c.set, 'european-nights'); }
  accounts.delete(id);
});
check('serials: a 1/1 is never issued twice; sold-out editions fall back honestly', () => {
  const id = 'p_' + 'e'.repeat(24), w = mk(id), keys = new Set(); let ones = 0, fell = 0; const already = [...serials.keys()].filter(k => k.includes(':rh-firestorm:')).length;
  for (let i = 0; i < 400; i++) { const c = svc.roll(w, 'red-hot', 'red-hot', { 'rh-firestorm': 1, 'rh-lava': 1 }, 'rh-firestorm'); if (c.ed === 'rh-firestorm') { assert.equal(c.serial, 1); assert.equal(c.serialMax, 1); const k = c.player; assert(!keys.has(k), 'duplicate 1/1 ' + k); keys.add(k); ones++; } else { fell++; assert(!c.serial); } }
  assert.equal(ones + already, pool('red-hot', 'rh-firestorm').length); assert(fell > 0); for (const k of serials.keys()) if (k.includes(':rh-firestorm:')) assert.equal(serials.get(k), 1);
  const d = svc.roll(w, 'golden-star', 'golden-star', { 'gs-dual': 1 }, 'gs-dual'); assert.equal(d.players.length, 2); assert.notEqual(d.players[0], d.players[1]); assert(cardValue(d) > 0);
  accounts.delete(id);
});
check('the Card Buyer: 65% of book value, protected cards need confirming, Top 5 and locked cards are refused', () => {
  const w = a, c = w.cards; c.cards = []; c.top = []; c.lock = []; c.packs = { 'red-hot': 2 };
  const got = svc.open(w, A, 'red-hot', 2, 'Alpha').packs.flat();
  const plain = got.filter(x => !protectedEdition(x.ed)), uid = plain[0].uid, before = w.coins, val = svc.value(plain[0]);
  svc.setTop(w, [uid]); assert.throws(() => svc.sell(w, A, [uid]), /Top 5/); svc.setTop(w, []);
  svc.lock(w, uid, true); assert.throws(() => svc.sell(w, A, [uid]), /locked/i); svc.lock(w, uid, false);
  const r = svc.sell(w, A, [uid]); assert.equal(r.pay, sellPrice(val)); assert.equal(w.coins, before + r.pay); assert(!svc.owned(w, uid));
  const rare = { uid: 'x1', player: 'cole-palmer', players: ['cole-palmer'], set: 'red-hot', ed: 'rh-molten', at: 1, src: 'pack' }; c.cards.push(rare);
  assert.throws(() => svc.sell(w, A, ['x1']), /Confirm/); svc.sell(w, A, ['x1'], ['x1']); assert(!svc.owned(w, 'x1'));
});
check('the book keeps the best edition you packed even after you sell it; trades never count as packing', () => {
  const w = a; w.cards.cards = []; w.cards.book = {};
  const gold = { uid: 'g1', player: 'bukayo-saka', players: ['bukayo-saka'], set: 'red-hot', ed: 'rh-holo', at: 5, src: 'pack' };
  w.cards.cards.push(gold); svc.ensure(w);
  // record through the real path: a forced roll into the book via open() is random, so call the recorder the way open() does
  const r = svc.open(w, A, 'welcome', (w.cards.packs.welcome = 1, 1), 'Alpha'); assert(r.packs[0].length === 5);
  const pid = r.packs[0][4].player; assert(w.cards.book[pid]); const bestEd = w.cards.book[pid].ed;
  svc.sell(w, A, [r.packs[0][4].uid], [r.packs[0][4].uid]); assert.equal(w.cards.book[pid].ed, bestEd, 'book forgot a sold card');
  b.cards.cards.push({ uid: 't1', player: 'erling-haaland', players: ['erling-haaland'], set: 'european-nights', ed: 'en-fullart', at: 9, src: 'pack' });
  const o = svc.offer(B, A.slice(2, 12), ['t1'], []); svc.decision(A, o.offer, true);
  assert(svc.owned(a, 't1')); assert(!a.cards.book['erling-haaland'] || a.cards.book['erling-haaland'].ed !== 'en-fullart');
  assert.equal(svc.owned(a, 't1').src, 'trade');
});
check('trades are atomic, reserve cards and refuse stale offers', () => {
  a.cards.cards.push({ uid: 'm1', player: 'cole-palmer', players: ['cole-palmer'], set: 'red-hot', ed: 'rh-rare', at: 1 }); b.cards.cards.push({ uid: 'm2', player: 'john-egan', players: ['john-egan'], set: 'red-hot', ed: 'rh-common', at: 1 });
  const o = svc.offer(A, B.slice(2, 12), ['m1'], ['m2']); assert.throws(() => svc.sell(a, A, ['m1']), /pending trade/);
  assert.throws(() => svc.decision(A, o.offer, true), /receiving/); svc.decision(B, o.offer, true);
  assert(svc.owned(b, 'm1') && svc.owned(a, 'm2') && !svc.owned(a, 'm1')); assert.throws(() => svc.decision(B, o.offer, true), CardError);
  const o2 = svc.offer(B, A.slice(2, 12), ['m1'], []); b.cards.cards = b.cards.cards.filter(x => x.uid !== 'm1'); assert.throws(() => svc.decision(A, o2.offer, true), /no longer valid/);
});
check('club completion: all eleven main players, one claim, a pack and the club scarf', () => {
  const w = b; w.cards.cards = []; w.own = [];
  for (const p of MAIN_BY_CLUB.get('arsenal')) w.cards.cards.push({ uid: 'ars-' + p.id, player: p.id, players: [p.id], set: 'red-hot', ed: 'rh-common', at: 1 });
  assert.equal(svc.clubProgress(w).find(x => x.id === 'arsenal').owned, 11);
  const r = svc.claimClub(w, 'arsenal'); assert.equal(r.pack, 'european-nights'); assert.equal(w.cards.packs['european-nights'], 1); assert(w.own.includes('scarf_arsenal'));
  assert.throws(() => svc.claimClub(w, 'arsenal'), /already/); assert.throws(() => svc.claimClub(w, 'chelsea'), /eleven/);
  assert.throws(() => core.buyItem(w, 'scarf_chelsea'), core.Refused);
});
check('net worth = cash + owned card values + 80% of unopened packs; peak drives one-time milestones', () => {
  const w = b; const nw = svc.netWorth(w); const cardsV = w.cards.cards.reduce((s, c) => s + cardValue(c), 0);
  assert.equal(nw.total, Math.floor(w.coins) + cardsV + Object.entries(w.cards.packs).reduce((s, [k, n]) => s + packWorth(k) * n, 0));
  w.coins = 60000; svc.peak(w); assert(w.cards.peak >= 60000); w.coins = 0; svc.peak(w); assert(w.cards.peak >= 60000, 'peak must not fall');
  const ms = svc.milestones(w); assert(ms.find(m => m.at === 50000).ready); svc.claimMilestone(w, 50000); assert.equal(w.cards.packs['red-hot'], 1);
  assert.throws(() => svc.claimMilestone(w, 50000), /Already/); assert.throws(() => svc.claimMilestone(w, 250000), /Not there/);
});
check('the Dealer: four rotating orders, previews, premium pay, consumed cards, races won once', () => {
  const online = () => [A, B];
  const dealer = createDealer({ world, cards: svc, accounts, markDirty: () => dirty++, broadcast: () => {}, online, nameOf: id => names[id] });
  dealer.rotate(Date.now()); assert.equal(dealer.state().orders.length, ECON.dealer.orders); assert.equal(new Set(dealer.state().orders.map(o => o.tag)).size, 4);
  const w = a; w.cards.cards = []; w.cards.top = []; w.cards.lock = []; w.coins = 0;
  const order = { id: 'o1', kind: 'club', tag: 'club:brighton', need: { club: 'brighton', n: 2 }, label: 'Bring me 2 Brighton cards', pay: { cash: 7600 }, at: 0, until: Date.now() + 3600000 };
  world.dealer.orders.push(order);
  for (const p of MAIN_BY_CLUB.get('brighton').slice(0, 3)) w.cards.cards.push({ uid: 'bha-' + p.id, player: p.id, players: [p.id], set: 'red-hot', ed: 'rh-common', at: 1 });
  w.cards.cards.push({ uid: 'bha-sig', player: 'kaoru-mitoma', players: ['kaoru-mitoma'], set: 'golden-star', ed: 'gs-auto', at: 1 });
  const pv = dealer.preview(w, A, 'o1'); assert(pv.ok); assert.equal(pv.cards.length, 2); assert(pv.cards.every(c => c.ed === 'rh-common'), 'never hands over a signed card for a plain order');
  const r = dealer.deliver(w, A, 'o1', pv.cards.map(c => c.uid), 'Alpha'); assert.equal(w.coins, 7600); assert.equal(w.cards.cards.length, 2); assert(svc.owned(w, 'bha-sig'));
  assert.throws(() => dealer.deliver(w, A, 'o1', [], 'Alpha'), /already/);
  world.dealer.race = null; world.dealer.nextRaceAt = 0; const race = dealer.plan(Date.now()); assert(race && race.label);
  world.dealer.race = { id: 'r1', kind: 'deliver', need: { club: 'brighton', n: 1 }, label: 'x', reward: { pack: 'god', n: 1 }, consolation: { cash: 8000 }, startedAt: Date.now(), endsAt: Date.now() + 60000, winner: null, winnerName: null, entries: [] };
  b.cards.cards.push({ uid: 'bha-b', player: 'kaoru-mitoma', players: ['kaoru-mitoma'], set: 'red-hot', ed: 'rh-common', at: 1 });
  const win = dealer.submit(b, B, 'r1', [], 'Bravo'); assert(win.won); assert.equal(b.cards.packs.god, 1);
  const lose = dealer.submit(a, A, 'r1', [], 'Alpha'); assert(!lose.won); assert.equal(lose.reward.cash, 8000); assert.throws(() => dealer.submit(a, A, 'r1', [], 'Alpha'), /already/);
  assert(qualifies({ player: 'bukayo-saka', players: ['bukayo-saka'], set: 'red-hot', ed: 'rh-molten' }, { auto: true }));
});
check('friends: requests need an account, acceptance is mutual, nobody is a friend by default', () => {
  const users = { [A]: 'alpha', [B]: 'bravo' }, auth = { username: id => users[id] || null };
  const fr = createFriends({ accounts, auth, markDirty: () => dirty++, online: () => [A], nameOf: id => names[id], find: c => [...accounts.keys()].find(id => id.slice(2, 12) === c), progressOf, worthOf: w => svc.netWorth(w).total });
  assert.equal(fr.list(A).friends.length, 0);
  fr.request(A, B.slice(2, 12)); assert.equal(fr.status(A, B), 'sent'); assert.equal(fr.status(B, A), 'incoming'); assert.throws(() => fr.request(A, B.slice(2, 12)), /already sent/i);
  fr.accept(B, A.slice(2, 12)); assert.equal(fr.status(A, B), 'friends'); assert.equal(fr.list(B).friends[0].code, A.slice(2, 12)); assert.equal(fr.list(B).friends[0].online, true);
  fr.remove(A, B.slice(2, 12)); assert.equal(fr.status(B, A), 'none');
  const G = 'p_' + 'f'.repeat(24); mk(G); assert.throws(() => fr.request(G, A.slice(2, 12)), /Sign up/);
});
check('saved state is JSON-serialisable and changes were flagged', () => { JSON.stringify({ accounts: [...accounts], serials: [...serials], offers: [...offers], world }); assert(dirty > 0); });
console.log('BITZ unit validation complete');
