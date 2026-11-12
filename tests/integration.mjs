/* BITZ integration: the real server, a real socket, two accounts. Earnings and circles, proximity-checked stands,
   buying, opening, the book, selling, friends, a trade, profiles, the leaderboard, the 1/1 tracker and a restart. */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import WebSocket from 'ws';
import '../public/world-layout.js';
const L = globalThis.STAKKZ_WORLD_LAYOUT, PORT = 4100 + Math.floor(Math.random() * 500), BASE = 'http://127.0.0.1:' + PORT;
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bitz-it-')), DATA = path.join(dir, 'data.json');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const log = (...a) => console.log('PASS', ...a);
let server;
async function start() {
  server = spawn(process.execPath, ['server.js'], { env: { ...process.env, PORT, DATA_FILE: DATA, NODE_ENV: 'test', BITZ_FAST_TIMERS: '1', BITZ_FILE_ACCOUNTS: '1', STAKKZ_SECRET: 'test-secret' }, stdio: ['ignore', 'pipe', 'pipe'] });
  let out = ''; server.stdout.on('data', d => { out += d; }); server.stderr.on('data', d => { out += d; });
  for (let i = 0; i < 300; i++) { try { const r = await fetch(BASE + '/api/ping'); if (r.ok) return out; } catch (e) {} if (server.exitCode !== null) break; await sleep(100); }   // up to 30 s: CI runners can be slow
  throw new Error('server did not start: ' + out);
}
const stop = () => new Promise(r => { if (!server || server.exitCode !== null) return r(); server.once('exit', r); server.kill('SIGTERM'); });
const key = () => crypto.randomBytes(24).toString('hex');
const api = (token, p, body) => fetch(BASE + '/api/' + p, { method: body ? 'POST' : 'GET', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined }).then(async r => { const j = await r.json(); if (!r.ok) throw Object.assign(new Error(j.message || 'HTTP ' + r.status), { status: r.status }); return j; });
function connect(token, at) {
  return new Promise((ok, no) => {
    const ws = new WebSocket('ws://127.0.0.1:' + PORT + '/api/plaza/ws'), got = [], waiters = [];
    ws.on('open', () => ws.send(JSON.stringify({ hello: token, at })));
    ws.on('message', d => { if (String(d) === 'pong') return; const m = JSON.parse(String(d)); got.push(m); if (m.you) ok(c); for (const w of waiters.slice()) if (w.test(m)) { waiters.splice(waiters.indexOf(w), 1); w.ok(m); } });
    ws.on('error', no);
    let cur = at ? [at[0], at[1]] : [0, 0]; const c = { ws, got, moveTo: async (x, z) => { for (;;) { const dx = x - cur[0], dz = z - cur[1], d = Math.hypot(dx, dz); if (d < 0.01) break; const k = Math.min(1, 3 / d); cur = [cur[0] + dx * k, cur[1] + dz * k]; ws.send(JSON.stringify({ p: [cur[0], 0, cur[1], 0, 0] })); await sleep(120); } await sleep(80); }, waitFor: (test, ms = 8000) => new Promise((ok, no) => { const hit = got.find(test); if (hit) return ok(hit); const t = setTimeout(() => no(new Error('timed out waiting')), ms); waiters.push({ test, ok: m => { clearTimeout(t); ok(m); } }); }), send: m => ws.send(JSON.stringify(m)), close: () => ws.close() };
  });
}
try {
  await start();
  const ping = await (await fetch(BASE + '/api/ping')).json(); assert(ping.ok && ping.season === 'S2'); log('server up, season', ping.season);
  const cat = await (await fetch(BASE + '/api/catalogue')).json(); assert.equal(cat.players.length, 265); assert.deepEqual(Object.keys(cat.sets).filter(s => cat.sets[s].shop), ['red-hot', 'golden-star', 'european-nights']); assert(cat.odds['golden-star']['gs-auto'].p > 0.5); log('catalogue: 265 players, three shop sets, published odds');
  const kA = key(), kB = key();
  let st = await api(kA, 'state'); assert.equal(st.cash, 0); assert.equal(st.cards.length, 0); assert.equal(st.packs.welcome, 1); assert.equal(st.progress.level, 1); log('new account: $0, no cards, one welcome pack, level 1');
  const open = await api(kA, 'cards', { op: 'open', pack: 'welcome', count: 1 }); assert.equal(open.packs[0].length, 5); for (const c of open.packs[0]) assert(cat.players.find(p => p.id === c.player)); assert(Object.keys(open.state.book).length >= 1); log('welcome pack opened with real player names; book updated');
  const ph = await fetch(BASE + '/portraits/' + open.packs[0][0].player + '.png'); assert(ph.redirected && /placeholder\.png$/.test(ph.url), 'missing portrait redirects to the shared placeholder'); assert.equal(ph.headers.get('content-type'), 'image/png'); log('missing portrait redirects to placeholder.png, never a broken image');
  /* earnings: anywhere, then x3 in gold, then packs in purple */
  const A = await connect(kA); assert(A.got[0].you && A.got[0].earner); A.send({ vis: 1 });
  const t1 = await A.waitFor(m => m.gained > 0); assert.equal(t1.zone, ''); const base = t1.gained;
  await A.moveTo(L.circles.gold.x, L.circles.gold.z); await sleep(1200); const t2 = await A.waitFor(m => m.zone === 'gold' && m.gained > 0); assert(Math.abs(t2.gained - base * 3) <= 3, 'gold x3: ' + t2.gained + ' vs ' + base); log('passive cash accrues, x3 inside the Gold Circle (' + base + ' -> ' + t2.gained + ' per tick)');
  await A.moveTo(L.circles.purple.x, L.circles.purple.z); const pk = await A.waitFor(m => m.pack === 'red-hot', 9000); assert.equal(pk.gained, 0); assert(pk.packs['red-hot'] >= 1); log('Purple Circle: no cash, a Red Hot pack arrived');
  const A2 = await connect(kA); assert(A2.got[0].earner); const lost = await A.waitFor(m => m.earner === false, 3000); assert(lost); A2.close(); await sleep(300); log('only the newest connection earns; a second tab takes over');
  /* stands need you to be there */
  st = await api(kA, 'state'); const cashBefore = st.cash;
  await assert.rejects(api(kA, 'cards', { op: 'buy', set: 'red-hot' }), /Pack Seller/);
  await A.moveTo(L.spots.seller.x, L.spots.seller.z); await sleep(200);
  await assert.rejects(api(kA, 'cards', { op: 'buy', set: 'european-nights' }), /need \$/);
  log('buying needs the Pack Seller and enough cash');
  const bought = await api(kA, 'cards', { op: 'buy', set: 'red-hot', kind: 'pack' }).catch(e => e); if (bought instanceof Error) { assert(/need/.test(bought.message)); }
  st = await api(kA, 'state'); const rh = st.packs['red-hot'] || 0; assert(rh >= 1);
  const bulk = await api(kA, 'cards', { op: 'open', pack: 'red-hot', count: rh }); assert.equal(bulk.packs.length, rh); assert.equal(bulk.state.cards.length, 5 + 5 * rh); log('bulk open of ' + rh + ' pack(s): every card saved');
  const plain = bulk.state.cards.filter(c => !cat.editions[c.ed].auto && !c.serial && cat.editions[c.ed].rank < 6);
  await assert.rejects(api(kA, 'cards', { op: 'sell', cards: [plain[0].uid] }), /Card Buyer/);
  await A.moveTo(L.spots.buyer.x, L.spots.buyer.z); await sleep(200);
  const q = await api(kA, 'cards', { op: 'quote', cards: [plain[0].uid] }); assert.equal(q.quote[0].pay, Math.floor(q.quote[0].v * cat.econ.sellRate));
  const sold = await api(kA, 'cards', { op: 'sell', cards: [plain[0].uid] }); assert.equal(sold.pay, q.quote[0].pay); assert(!sold.state.cards.find(c => c.uid === plain[0].uid)); assert.equal(sold.cash, (await api(kA, 'state')).cash); log('sold a card at the Card Buyer for ' + Math.round(cat.econ.sellRate * 100) + '% of book value');
  const nw = (await api(kA, 'state')).nw; assert.equal(nw.total, nw.cash + nw.cards + nw.packs); log('net worth = cash + cards + packs (' + nw.total + ')');
  /* accounts, friends, a trade, profiles */
  const ra = await api(kA, 'auth/register', { username: 'alpha_' + PORT, password: 'secret-pass' }); const tA = ra.token;
  const rb = await api(kB, 'auth/register', { username: 'bravo_' + PORT, password: 'secret-pass' }); const tB = rb.token;
  await assert.rejects(api(kA, 'state'), /sign-in/); log('registered two accounts; the old guest key is locked out');
  st = await api(tA, 'state'); assert(st.cards.length >= 1, 'cards survive registration');
  const stB = await api(tB, 'state'); const codeA = st.code, codeB = stB.code;
  await api(tA, 'friends', { op: 'request', code: codeB }); let fl = await api(tB, 'friends'); assert.equal(fl.in[0].code, codeA); await api(tB, 'friends', { op: 'accept', code: codeA }); fl = await api(tA, 'friends'); assert.equal(fl.friends[0].code, codeB); log('friend request and acceptance');
  const openB = await api(tB, 'cards', { op: 'open', pack: 'welcome', count: 1 }); const give = st.cards[0].uid, take = openB.state.cards[0].uid;
  const off = await api(tA, 'cards', { op: 'offer', to: codeB, give: [give], take: [take] });
  await assert.rejects(api(tA, 'cards', { op: 'accept', trade: off.offer }), /receiving/);
  const acc = await api(tB, 'cards', { op: 'accept', trade: off.offer }); assert(acc.accepted);
  st = await api(tA, 'state'); assert(st.cards.find(c => c.uid === take) && !st.cards.find(c => c.uid === give)); assert.equal(st.cards.find(c => c.uid === take).src, 'trade'); log('trade settled atomically; traded card marked as traded, not packed');
  await api(tA, 'cards', { op: 'top', cards: st.cards.slice(0, Math.min(5, st.cards.length)).map(c => c.uid) });
  const prof = await api(tB, 'profile/' + codeA); assert.equal(prof.code, codeA); assert(prof.top.length >= 1); assert.equal(prof.friend, 'friends'); assert(prof.nw > 0); log('public profile shows Top 5, net worth and friendship');
  const board = await api(tA, 'board/all'); assert(board.top.length >= 2 && board.me.rank >= 1); const bf = await api(tA, 'board/friends'); assert(bf.top.some(r => r.code === codeB)); log('leaderboard: all and friends scopes, own rank present');
  const ones = await api(tA, 'ones'); assert(ones.ones.length > 500 && ones.ones.every(o => typeof o.found === 'boolean')); log('global 1/1 tracker lists ' + ones.ones.length + ' editions');
  const dl = await api(tA, 'dealer'); assert.equal(dl.orders.length, 4); const pv = await api(tA, 'dealer', { op: 'preview', order: dl.orders[0].id }); assert(pv.order && Array.isArray(pv.cards)); await assert.rejects(api(tA, 'dealer', { op: 'deliver', order: dl.orders[0].id, cards: [] }), /Dealer first/); log('Dealer orders rotate (4) and delivery needs you at the stand');
  const ms = st.milestones; assert.equal(ms[0].at, 50000); log('milestones listed, first at $50k');
  /* restart: everything persists */
  A.close(); await stop(); await start();
  const again = await api(tA, 'state'); assert.equal(again.cards.length, st.cards.length); assert.equal(again.cash, st.cash); assert.deepEqual(again.book, st.book); assert.equal(again.top.length, Math.min(5, st.cards.length)); assert.equal((await api(tA, 'friends')).friends[0].code, codeB); log('restart: cards, cash, book, Top 5 and friends persisted');
  const saved = JSON.parse(fs.readFileSync(DATA, 'utf8')); assert(saved.accounts && saved.footballSerials && saved.world); log('snapshot contains accounts, serials and world');
  console.log('BITZ integration complete');
} finally { await stop(); fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }); }
