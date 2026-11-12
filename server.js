/* BITZ server: serves the game, keeps the accounts, and runs the cards, the Dealer and the multiplayer world.
   Plain Node (20 or newer) with two dependencies: `ws` for the live connection and `postgres` for persistence.   Start:  npm install && npm start */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import postgres from 'postgres';
import * as core from './src/core.js';
import './public/world-layout.js';
import { AccountAuth } from './src/auth.js';
import { mountSocial } from './src/social.js';
import { createCardService, migrate, CardError } from './src/cards.js';
import { createDealer } from './src/dealer.js';
import { createFriends } from './src/friends.js';
import { ECON, SETS, EDITIONS, PACKS, SEASON, boxPrice, packWorth, packStats, protectedEdition } from './src/econ.js';
import { PUBLIC_CATALOGUE } from './src/catalogue.js';
import { progressOf } from './src/progression.js';

/* the old address after a move: forward everyone, run nothing else */
if (process.env.STAKKZ_MOVED_TO) { await import('./moved.js'); await new Promise(() => {}); }

const DIR = path.dirname(fileURLToPath(import.meta.url)), PUB = path.join(DIR, 'public');
const PORT = Number(process.env.PORT) || 3000, DATA = process.env.DATA_FILE || path.join(DIR, 'data.json');
const parties = new Map(), accounts = new Map();   // parties: archived board-game records, kept so nothing is lost; never run
const CLOUD_URL = (process.env.STAKKZ_STORE_URL || '').replace(/\/$/, '');
const CLOUD_KEY = process.env.STAKKZ_STORE_KEY || '';
const cloud = !!(CLOUD_URL && CLOUD_KEY);
const PG_URL = (process.env.STAKKZ_DATABASE_URL || '').trim().replace(/^["']+|["']+$/g, '').replace(/([?&])channel_binding=[^&]*(&|$)/, (m, a, b) => (b ? a : '')).replace(/[?&]$/, '');
const pg = PG_URL ? postgres(PG_URL, { max: 2, idle_timeout: 15, connect_timeout: 12, prepare: false }) : null;
const persistent = !!(pg || cloud) || process.env.BITZ_FILE_ACCOUNTS === '1';   // file accounts: local play and tests only, never on an ephemeral host
let dirty = false, saved = {}, saveChain = Promise.resolve(), dbVersion = 0;
const serials = new Map(), offers = new Map(), world = {};   // world: the Dealer, 1/1 registry and recent pulls; mutated in place so services keep their reference
const lastSeen = new Map();
try { saved = JSON.parse(fs.readFileSync(DATA, 'utf8')); hydrate(saved); console.log('loaded', accounts.size, 'accounts'); } catch (e) {}
function hydrate(s) {
  parties.clear(); accounts.clear(); serials.clear(); offers.clear();
  Object.entries(s.parties || {}).forEach(([k, v]) => parties.set(k, v)); Object.entries(s.accounts || {}).forEach(([k, v]) => accounts.set(k, v));
  Object.entries(s.footballSerials || {}).forEach(([k, v]) => serials.set(k, v)); Object.entries(s.footballOffers || {}).forEach(([k, v]) => offers.set(k, v));
  for (const k of Object.keys(world)) delete world[k]; Object.assign(world, s.world && typeof s.world === 'object' ? s.world : {});
}
let SECRET = process.env.STAKKZ_SECRET || saved.secret || crypto.randomBytes(32).toString('hex');
let auth = new AccountAuth(saved.auth, () => { dirty = true; });
/* Deploy overlap: see mergeNewer. Records this instance removed on purpose are remembered so a merge never brings them back. */
const BOOTED = Date.now(), dropped = new Set();
const watchDrops = (map, tag) => { if (map.__watched) return; const del = map.delete.bind(map); map.delete = k => { dropped.add(tag + k); return del(k); }; map.__watched = true; };
const watchAll = () => { watchDrops(parties, 'p'); watchDrops(accounts, 'a'); watchDrops(auth.users, 'u'); watchDrops(auth.sessions, 's'); };
watchAll();
const snapshot = () => ({ secret: SECRET, writer: BOOTED, parties: Object.fromEntries(parties), accounts: Object.fromEntries(accounts), auth: auth.export(), footballSerials: Object.fromEntries(serials), footballOffers: Object.fromEntries(offers), world });
async function mergeNewer() {
  if (shutdownStarted) return false;
  const rows = await pg`select state, version from stakkz_state where id = 'main' limit 1`;
  let remote = rows[0]?.state; if (typeof remote === 'string') remote = JSON.parse(remote);
  if (!remote || typeof remote !== 'object' || (Number(remote.writer) || 0) > BOOTED) return false;
  const add = (map, obj, tag, newer) => Object.entries(obj || {}).forEach(([k, v]) => { if (dropped.has(tag + k)) return; if (!map.has(k) || (newer && newer(map.get(k), v))) map.set(k, v); });
  add(parties, remote.parties, 'p'); add(accounts, remote.accounts, 'a'); add(auth.users, remote.auth?.users, 'u'); add(auth.sessions, remote.auth?.sessions, 's');
  add(serials, remote.footballSerials, 'serial:', (mine, theirs) => Number(theirs) > Number(mine));
  add(offers, remote.footballOffers, 'offer:', (mine, theirs) => Number(theirs?.acceptedAt || theirs?.createdAt || 0) > Number(mine?.acceptedAt || mine?.createdAt || 0));
  if (remote.world && remote.world.ones) { world.ones = Object.assign({}, remote.world.ones, world.ones || {}); }
  dbVersion = Number(rows[0].version) || 0;
  console.warn('An older instance saved during a deploy; merged its new records and saving again.');
  return true;
}
const seal = (id, w) => crypto.createHmac('sha256', SECRET).update(id + ':' + JSON.stringify(w)).digest('base64url');
async function save(force = false) {
  if (!dirty && !force) return true;
  dirty = false;
  const write = async () => {
    const state = snapshot();
    if (pg) {
      for (let attempt = 0; ; attempt++) {
        const json = JSON.stringify(snapshot());
        if (dbVersion === 0) { const inserted = await pg`insert into stakkz_state (id, state, version) values ('main', ${json}::jsonb, 1) on conflict (id) do nothing returning version`; if (inserted.length) { dbVersion = Number(inserted[0].version); return; } }
        const updated = await pg`update stakkz_state set state = ${json}::jsonb, version = version + 1 where id = 'main' and version = ${dbVersion} returning version`;
        if (updated.length) { dbVersion = Number(updated[0].version); return; }
        if (attempt >= 2 || !(await mergeNewer())) throw Error('Database revision changed on another instance; refusing to overwrite newer saved game data.');
      }
    } else if (cloud) {
      const res = await fetch(CLOUD_URL + '?on_conflict=id', { method: 'POST', headers: { apikey: CLOUD_KEY, Authorization: 'Bearer ' + CLOUD_KEY, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates' }, body: JSON.stringify([{ id: 'main', state }]), signal: AbortSignal.timeout(12000) });
      if (!res.ok) throw Error('Persistent store save: HTTP ' + res.status + ' ' + (await res.text()).slice(0, 120));
    } else { await fs.promises.writeFile(DATA + '.tmp', JSON.stringify(state)); await fs.promises.rename(DATA + '.tmp', DATA); }
  };
  const op = saveChain.then(write, write); saveChain = op.catch(() => {});
  try { await op; return true; } catch (e) { dirty = true; console.error('BITZ save failed:', e.message); return false; }
}
setInterval(save, 4000).unref();

/* ---- accounts and the one-time economy migration ---- */
const idOf = key => 'p_' + crypto.createHash('sha256').update('stakkz:' + key).digest('hex').slice(0, 24);
const nameOf = id => { const w = accounts.get(id); return (w && w.name || auth.username(id) || 'Player').slice(0, 12); };
const findByCode = code => { const c = String(code || '').replace(/[^a-f0-9]/g, '').slice(0, 10); if (c.length < 10) return null; for (const id of accounts.keys()) if (id.slice(2, 12) === c) return id; return null; };
const account = id => {
  let w = accounts.get(id); if (!w) { w = core.freshWallet(); w.fresh = true; w.econ = { v: ECON.version, at: Date.now() }; accounts.set(id, w); dirty = true; }
  if (migrate(w, Date.now())) { dirty = true; console.log('economy', ECON.version, 'migration applied to', id.slice(2, 12)); }
  cards.ensure(w); return w;
};
const cards = createCardService({ accounts, serials, offers, world, markDirty: () => { dirty = true; }, resolvePlayer: findByCode, nameOf });
const buckets = new Map(), authAttempts = new Map();
function authLimit(req, type, username) {
  const ip = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress).split(',')[0].trim();
  const key = type + ':' + ip + ':' + (type === 'login' ? String(username || '').toLowerCase() : '');
  const now = Date.now(), windowMs = type === 'login' ? 600000 : 3600000, max = type === 'login' ? 5 : 6;
  const rec = authAttempts.get(key);
  if (rec && now - rec.since < windowMs && rec.count >= max) return { blocked: true, key };
  if (!rec || now - rec.since >= windowMs) authAttempts.set(key, { since: now, count: 0 });
  if (authAttempts.size > 5000) authAttempts.clear();
  return { blocked: false, key };
}
const authFailed = key => { const rec = authAttempts.get(key); if (rec) rec.count++; };
const authSucceeded = key => authAttempts.delete(key);
function allowed(ip) { const now = Date.now(), b = buckets.get(ip) || { n: 80, t: now }; b.n = Math.min(80, b.n + (now - b.t) / 1000 * 20); b.t = now; buckets.set(ip, b); if (buckets.size > 5000) buckets.clear(); if (b.n < 1) return false; b.n--; return true; }
const handoffs = new Map();
process.on('uncaughtException', e => { console.error('uncaught', e && e.stack || e); });
process.on('unhandledRejection', e => { console.error('unhandled', e && e.stack || e); });
const BUILD = String(process.env.RENDER_GIT_COMMIT || 'dev').slice(0, 12);
const send = (res, code, o) => { const buf = Buffer.from(JSON.stringify(o)); res.writeHead(code, { 'Content-Type': 'application/json', 'Content-Length': buf.length, 'Cache-Control': 'no-store' }); res.end(buf); };
const read = req => new Promise((ok, no) => { let n = 0; const parts = []; req.on('data', c => { n += c.length; if (n > 60000) { no(new Error('big')); req.destroy(); } else parts.push(c); }); req.on('end', () => { try { ok(JSON.parse(Buffer.concat(parts).toString('utf8') || '{}')); } catch (e) { no(e); } }); req.on('error', no); });

/* ---- the world, the Dealer, friends and the leaderboard ---- */
const wss = new WebSocketServer({ noServer: true, maxPayload: 1024 });
const plaza = mountSocial({ wss, getAuth: () => auth, account, idOf, cards, progressOf, markDirty: () => { dirty = true; } });
const dealer = createDealer({ world, cards, accounts, markDirty: () => { dirty = true; }, broadcast: m => plaza.broadcast(m), online: () => plaza.online(), nameOf });
const friends = createFriends({ accounts, auth, markDirty: () => { dirty = true; }, online: () => plaza.online(), nameOf, find: findByCode, progressOf, worthOf: w => cards.netWorth(w).total });
const L = globalThis.STAKKZ_WORLD_LAYOUT;
const near = (id, spot) => { if (process.env.BITZ_NO_PROXIMITY === '1') return true; const p = plaza.posOf(id), s = L.spots[spot]; return !!p && !!s && Math.hypot(p[0] - s.x, p[2] - s.z) <= s.r + 1.5; };
const board = { at: 0, rows: [] };
function leaderboard() {
  const now = Date.now(); if (now - board.at < 10000) return board.rows;
  const rows = []; for (const [id, w] of accounts) { if (!w.cards) continue; const nw = cards.netWorth(w).total; if (nw <= 0 && !w.name) continue; rows.push({ id, code: id.slice(2, 12), name: nameOf(id), level: progressOf(w).level, nw, look: w.look || {}, pet: w.pet || '' }); }
  rows.sort((a, b) => b.nw - a.nw); rows.forEach((r, i) => { r.rank = i + 1; }); board.at = now; board.rows = rows; return rows;
}
const strip = r => { const { id, ...rest } = r; return rest; };
setInterval(() => { try { dealer.tick(Date.now()); } catch (e) { console.error('dealer', e); } }, 20000).unref();
dealer.rotate(Date.now());

const CATALOGUE = { ...PUBLIC_CATALOGUE, sets: SETS, editions: EDITIONS, boxes: Object.fromEntries(Object.keys(SETS).map(s => [s, boxPrice(s)])), worth: Object.fromEntries(Object.keys(SETS).map(s => [s, packWorth(s)])), odds: Object.fromEntries(Object.keys(PACKS).map(s => [s, packStats(s).perEd])), econ: { income: ECON.income, sellRate: ECON.sellRate, packEquity: ECON.packEquity, maxOpen: ECON.maxOpen, milestones: ECON.milestones, club: ECON.club }, items: core.ITEMS, layout: L };

async function api(req, res, parts) {
  const now = Date.now();
  if (parts[0] === 'ping') return send(res, 200, { ok: true, now, online: plaza.online().length, persistent, build: BUILD, season: SEASON });
  if (parts[0] === 'handoff') {
    const OLD = process.env.STAKKZ_OLD_ORIGIN || 'https://stakkz.onrender.com', cors = { 'Access-Control-Allow-Origin': OLD, 'Access-Control-Allow-Methods': 'POST', 'Access-Control-Allow-Headers': 'Content-Type', 'Vary': 'Origin' };
    if (req.method === 'OPTIONS') { res.writeHead(204, cors); return res.end(); }
    if (req.method === 'POST' && !parts[1]) {
      if (!allowed(String(req.headers['x-forwarded-for'] || req.socket.remoteAddress).split(',')[0].trim())) { res.writeHead(429, cors); return res.end(); }
      let b; try { b = await read(req); } catch (e) { res.writeHead(400, cors); return res.end(); }
      const k = typeof b.key === 'string' && /^[a-f0-9]{48}$/.test(b.key) ? b.key : null, sess = typeof b.session === 'string' && auth.authenticate(b.session) ? b.session : null;
      if (!k && !sess) { res.writeHead(200, Object.assign({ 'Content-Type': 'application/json' }, cors)); return res.end('{}'); }
      handoffs.forEach((v, c) => { if (v.exp < now) handoffs.delete(c); }); if (handoffs.size > 2000) { res.writeHead(429, cors); return res.end(); }
      const code = crypto.randomBytes(16).toString('hex'); handoffs.set(code, { key: k, session: sess, exp: now + 120000 });
      res.writeHead(200, Object.assign({ 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, cors)); return res.end(JSON.stringify({ code }));
    }
    if (req.method === 'GET' && /^[a-f0-9]{32}$/.test(parts[1] || '')) { const h = handoffs.get(parts[1]); handoffs.delete(parts[1]); return send(res, 200, h && h.exp >= now ? { key: h.key, session: h.session } : {}); }
    return send(res, 404, {});
  }
  if (!allowed(String(req.headers['x-forwarded-for'] || req.socket.remoteAddress).split(',')[0].trim())) return send(res, 429, { message: 'Slow down a little.' });
  if (parts[0] === 'catalogue' && req.method === 'GET') return send(res, 200, CATALOGUE);
  const key = String(req.headers.authorization || '').replace(/^Bearer /, '');
  if (parts[0] === 'auth' && req.method === 'POST' && ['register', 'login', 'logout'].includes(parts[1])) {
    let b; try { b = await read(req); } catch (e) { return send(res, 400, { message: 'Invalid request.' }); }
    const guard = authLimit(req, parts[1], b.username);
    if (guard.blocked) return send(res, 429, { message: parts[1] === 'login' ? 'Too many incorrect passwords. Try again in ten minutes.' : 'Too many sign-up attempts. Try again later.' });
    try {
      if (parts[1] === 'register') {
        if (!persistent) return send(res, 503, { message: 'Account creation needs the persistent database, which this host has not configured.' });
        if (!/^[a-f0-9]{48}$/.test(key)) return send(res, 401, { message: 'A guest player key is required to register.' });
        const id = idOf(key), old = account(id);
        const result = auth.register(b.username, b.password, id);
        authSucceeded(guard.key); core.setProfile(old, { name: result.username.slice(0, 12) }); dirty = true;
        if (!(await save(true))) return send(res, 503, { message: 'Could not save the account. Please try again shortly.' });
        return send(res, 200, { token: result.token, username: result.username, id, registered: true });
      }
      if (parts[1] === 'login') { const result = auth.login(b.username, b.password); authSucceeded(guard.key); if (!(await save(true))) return send(res, 503, { message: 'Could not save the session. Please try again.' }); return send(res, 200, { token: result.token, username: result.username, id: result.id }); }
      auth.logout(key); if (!(await save(true))) return send(res, 503, { message: 'Could not safely complete sign-out.' }); return send(res, 200, { ok: true });
    } catch (e) { if (parts[1] === 'login' || parts[1] === 'register') authFailed(guard.key); return send(res, 400, { message: e.message }); }
  }
  const session = auth.authenticate(key);
  if (!session && !/^[a-f0-9]{48}$/.test(key)) return send(res, 401, { message: 'Missing or expired player session.' });
  const id = session ? session.id : idOf(key);
  if (!session && auth.username(id)) return send(res, 401, { message: 'This account requires sign-in.' });
  const w = account(id), name = nameOf(id);
  lastSeen.set(id, now);
  const mine = extra => { const fresh = !!w.fresh, out = Object.assign({}, w); delete out.fresh; const nw = cards.peak(w); return Object.assign({ wallet: out, seal: seal(id, out), fresh, id, code: id.slice(2, 12), now, nw, progress: progressOf(w), username: auth.username(id), registered: !!auth.username(id), persistent }, extra); };
  const touch = () => { w.t = now; delete w.fresh; dirty = true; board.at = 0; };
  const rank = () => { const rows = leaderboard(); const i = rows.findIndex(r => r.id === id); return i < 0 ? null : i + 1; };
  try {
    if (req.method === 'GET') {
      if (parts[0] === 'auth' && parts[1] === 'me') return send(res, 200, { username: auth.username(id), registered: !!auth.username(id), persistent, id, code: id.slice(2, 12) });
      if (parts[0] === 'me') return send(res, 200, mine());
      if (parts[0] === 'state') return send(res, 200, { ...cards.self(w, id), cash: Math.floor(w.coins || 0), progress: progressOf(w), rank: rank(), dealer: dealer.state(), friends: friends.list(id), pulls: (world.pulls || []).slice(0, 12), own: w.own || [], look: w.look, pet: w.pet, name: w.name, code: id.slice(2, 12), now });
      if (parts[0] === 'board') {
        const scope = String(parts[1] || 'all'), rows = leaderboard(); let list = rows;
        if (scope === 'online') { const on = new Set(plaza.online()); list = rows.filter(r => on.has(r.id)); }
        else if (scope === 'friends') { const f = new Set([...friends.ids(id), id]); list = rows.filter(r => f.has(r.id)); }
        const me = rows.find(r => r.id === id);
        return send(res, 200, { scope, top: list.slice(0, 50).map(strip), me: me ? { rank: me.rank, nw: me.nw, inScope: list.findIndex(r => r.id === id) + 1 || null } : null, total: rows.length, now });
      }
      if (parts[0] === 'profile') { const other = findByCode(parts[1]); if (!other || !accounts.get(other)) return send(res, 404, { message: 'Player not found.' }); const ow = accounts.get(other); return send(res, 200, { ...cards.publicProfile(ow, other), username: auth.username(other) || '', rank: (leaderboard().find(r => r.id === other) || {}).rank || null, friend: friends.status(id, other), online: plaza.online().includes(other), self: other === id }); }
      if (parts[0] === 'inventory') { const other = findByCode(parts[1]); if (!other || !accounts.get(other)) return send(res, 404, { message: 'Player not found.' }); const ow = accounts.get(other), c = cards.ensure(ow); return send(res, 200, { code: other.slice(2, 12), name: nameOf(other), cards: c.cards.slice(0, 3000).map(cards.view), top: c.top, lock: c.lock }); }
      if (parts[0] === 'ones') return send(res, 200, { ones: cards.ones(), now });
      if (parts[0] === 'friends') return send(res, 200, friends.list(id));
      if (parts[0] === 'dealer') return send(res, 200, { ...dealer.state(), mine: { orders: cards.ensure(w).orders, races: cards.ensure(w).races } });
      return send(res, 404, { message: 'Not found.' });
    }
    let b = {}; try { b = await read(req); } catch (e) { return send(res, 400, { message: 'Bad request.' }); }
    const persist = async () => { if (persistent && !(await save(true))) throw new CardError('That could not be saved safely. Refresh before trying again.'); };
    if (parts[0] === 'me') { core.setProfile(w, b); touch(); plaza.notify(id, { restyled: 1 }); return send(res, 200, mine()); }
    if (parts[0] === 'restore') {
      if (w.fresh && b.wallet && typeof b.seal === 'string' && b.seal === seal(id, b.wallet)) { Object.keys(w).forEach(k => delete w[k]); Object.assign(w, core.freshWallet(), b.wallet); core.setProfile(w, {}); migrate(w, now); cards.ensure(w); touch(); }
      return send(res, 200, mine());
    }
    if (parts[0] === 'shop') { const out = core.buyItem(w, String(b.item || '')); core.setProfile(w, {}); touch(); return send(res, 200, mine(out)); }
    if (parts[0] === 'cards') {
      const op = String(b.op || '');
      if (op === 'buy' && !near(id, 'seller')) return send(res, 400, { message: 'Walk over to the Pack Seller to buy packs.' });
      if (op === 'sell' && !near(id, 'buyer')) return send(res, 400, { message: 'Walk over to the Card Buyer to sell cards.' });
      const result = cards.move(op, w, id, b, name); touch();
      if (['buy', 'open', 'sell', 'accept', 'claim-club', 'claim-milestone'].includes(op)) await persist();
      if (result.toId) plaza.notify(result.toId, { trade: op, from: name });
      if (result.ones && result.ones.length) plaza.broadcast({ pull: result.ones.map(c => ({ by: name, ed: c.ed, player: c.player, players: c.players, set: c.set, v: c.v })) });
      return send(res, 200, { ...result, cash: Math.floor(w.coins || 0), progress: progressOf(w), state: cards.self(w, id) });
    }
    if (parts[0] === 'dealer') {
      const op = String(b.op || '');
      if (op === 'preview') return send(res, 200, dealer.preview(w, id, String(b.order || '')));
      if (!near(id, 'dealer')) return send(res, 400, { message: 'Walk over to the Dealer first.' });
      const result = op === 'deliver' ? dealer.deliver(w, id, String(b.order || ''), b.cards, name) : op === 'race' ? dealer.submit(w, id, String(b.race || ''), b.cards, name) : null;
      if (!result) return send(res, 400, { message: 'Unknown Dealer action.' });
      touch(); await persist();
      return send(res, 200, { ...result, cash: Math.floor(w.coins || 0), progress: progressOf(w), dealer: dealer.state(), state: cards.self(w, id) });
    }
    if (parts[0] === 'friends') {
      const op = String(b.op || ''), fn = { request: friends.request, accept: friends.accept, decline: friends.decline, remove: friends.remove }[op];
      if (!fn) return send(res, 400, { message: 'Unknown friend action.' });
      const result = fn(id, String(b.code || '')); touch();
      if (result.toId) plaza.notify(result.toId, { friend: op, from: name });
      return send(res, 200, { ...result, friends: friends.list(id) });
    }
  } catch (e) {
    if (e instanceof CardError || e instanceof core.Refused) return send(res, 400, { message: e.message, now });
    console.error(e); return send(res, 500, { message: 'The server hit a problem. Try again.' });
  }
  send(res, 404, { message: 'Not found.' });
}

const TYPES = { '.css': 'text/css; charset=utf-8', '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8', '.otf': 'font/otf', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg' };
const server = http.createServer((req, res) => {
  let url; try { url = new URL(req.url, 'http://x'); } catch (e) { res.writeHead(400); return res.end(); }
  const m = /\/api\/(.*)$/.exec(url.pathname);
  if (m) return api(req, res, m[1].split('/')).catch(e => { console.error(e); try { send(res, 500, { message: 'The server hit a problem.' }); } catch (x) {} });
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); return res.end(); }
  let rel = decodeURIComponent(url.pathname); if (rel.endsWith('/')) rel += 'index.html';
  const full = path.normalize(path.join(PUB, rel));
  if (!full.startsWith(PUB + path.sep)) { res.writeHead(403); return res.end(); }
  fs.readFile(full, (err, buf) => {
    if (err) {   // a missing portrait is never a broken image: every player falls back to the placeholder
      if (/^\/portraits\/[a-z0-9-]+\.(png|jpg|webp)$/.test(rel)) return fs.readFile(path.join(PUB, 'portraits', 'placeholder.png'), (e2, ph) => { if (e2) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'Content-Type': 'image/png', 'Content-Length': ph.length, 'Cache-Control': 'public, max-age=3600', 'X-Portrait': 'placeholder' }); res.end(req.method === 'HEAD' ? undefined : ph); });
      res.writeHead(404, { 'Content-Type': 'text/plain' }); return res.end('Not found');
    }
    const long = /\.(otf|woff2|png|jpg|webp|mp3)$/.test(full) || /three\.min\.js$/.test(full);
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(full)] || 'application/octet-stream', 'Content-Length': buf.length, 'Cache-Control': long ? 'public, max-age=604800' : 'no-cache', 'X-Content-Type-Options': 'nosniff' });
    res.end(req.method === 'HEAD' ? undefined : buf);
  });
});
server.on('upgrade', (req, socket, head) => plaza.upgrade(req, socket, head));
async function bootstrap() {
  if (pg || cloud) {
    let remote;
    if (pg) {
      await pg`create table if not exists stakkz_state (id text primary key, state jsonb not null, version bigint not null default 0)`;
      await pg`alter table stakkz_state add column if not exists version bigint not null default 0`;
      const rows = await pg`select state, version from stakkz_state where id = 'main' limit 1`;
      dbVersion = Number(rows[0]?.version) || 0; remote = rows[0]?.state; if (typeof remote === 'string') remote = JSON.parse(remote);
    } else {
      const res = await fetch(CLOUD_URL + '?id=eq.main&select=state', { headers: { apikey: CLOUD_KEY, Authorization: 'Bearer ' + CLOUD_KEY }, signal: AbortSignal.timeout(12000) });
      if (!res.ok) throw Error('Persistent store unavailable (HTTP ' + res.status + ')');
      const rows = await res.json(); remote = rows[0]?.state;
    }
    if (remote && typeof remote === 'object') {
      saved = remote; hydrate(saved);
      auth = new AccountAuth(saved.auth, () => { dirty = true; }); watchAll();
      if (!process.env.STAKKZ_SECRET && saved.secret) SECRET = saved.secret;
    }
    console.log('Persistent storage ready:', accounts.size, 'accounts');
  } else console.warn('No persistent database configured: free-host restarts can erase player progress. Account registration is disabled.');
  /* a one-time safety copy of the pre-reset state, written once per data store, before any account migrates */
  if (!world.backupV1 && accounts.size) { const legacy = [...accounts.entries()].filter(([, w]) => !w.econ || w.econ.v < ECON.version); if (legacy.length) { world.backupV1 = { at: Date.now(), accounts: legacy.length, note: 'per-account archives live under wallet.archive.v1' }; dirty = true; console.log('economy reset pending for', legacy.length, 'legacy accounts; each keeps an archive of its old balance, cards and packs'); } }
  server.listen(PORT, () => console.log('BITZ is running on port ' + PORT));
}
bootstrap().catch(e => { console.error('Startup aborted to protect accounts:', e.message); process.exitCode = 1; });
let shutdownStarted = false;
process.on('SIGTERM', () => {
  if (shutdownStarted) return; shutdownStarted = true;
  void (async () => { if (dirty) await save(); await saveChain; if (pg) await pg.end({ timeout: 1 }); })().catch(e => console.error('BITZ shutdown flush failed:', e.message)).finally(() => process.exit(0));
  setTimeout(() => process.exit(0), 2500).unref();
});
