/* Stakkz server: serves the game, runs every party with the rules in src/core.js, and keeps the accounts.
   Plain Node (20 or newer) with one dependency, `ws`, for the live connection.   Start:  npm install && npm start */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import postgres from 'postgres';
import * as core from './src/core.js';
import { AccountAuth } from './src/auth.js';
import { nextBotAction, isBot } from './src/bots.js';

const DIR = path.dirname(fileURLToPath(import.meta.url)), PUB = path.join(DIR, 'public');
const PORT = Number(process.env.PORT) || 3000, DATA = process.env.DATA_FILE || path.join(DIR, 'data.json');
const AB = 'ABCDEFGHJKLMNPQRSTUVWXYZ', IDLE = 48 * 3600 * 1000;
const parties = new Map(), accounts = new Map(), watchers = new Map();   // code -> game, id -> account, code -> sockets
const CLOUD_URL = (process.env.STAKKZ_STORE_URL || '').replace(/\/$/, '');
const CLOUD_KEY = process.env.STAKKZ_STORE_KEY || '';
const cloud = !!(CLOUD_URL && CLOUD_KEY);
/* Tolerate a connection string pasted straight from a provider's dashboard or .env file: drop surrounding
   quotes, and drop channel_binding, which the driver would otherwise send to the server as a setting. */
const PG_URL = (process.env.STAKKZ_DATABASE_URL || '').trim().replace(/^["']+|["']+$/g, '')
  .replace(/([?&])channel_binding=[^&]*(&|$)/, (m, a, b) => (b ? a : '')).replace(/[?&]$/, '');
const pg = PG_URL ? postgres(PG_URL, { max: 2, idle_timeout: 15, connect_timeout: 12, prepare: false }) : null;
const persistent = !!(pg || cloud);
let dirty = false, saved = {}, saveChain = Promise.resolve(), dbVersion = 0;
const lastSeen = new Map();
// Always two minutes in real deployments. A short test-only interval lets CI
// verify reconnect and eviction timing without waiting two wall-clock minutes.
const RECONNECT_GRACE_MS = process.env.NODE_ENV === 'test'
  ? Math.max(2000, Math.min(120000, Number(process.env.STAKKZ_TEST_GRACE_MS) || 120000))
  : 120000;
try { saved = JSON.parse(fs.readFileSync(DATA, 'utf8')); Object.entries(saved.parties || {}).forEach(([k, v]) => parties.set(k, v)); Object.entries(saved.accounts || {}).forEach(([k, v]) => accounts.set(k, v)); console.log('loaded', parties.size, 'parties and', accounts.size, 'accounts'); } catch (e) {}
/* Accounts are also handed back to each browser sealed with this secret, so if a free host wipes the disk
   a returning player's coins and items can be restored and cannot be forged. Set STAKKZ_SECRET to keep it stable. */
let SECRET = process.env.STAKKZ_SECRET || saved.secret || crypto.randomBytes(32).toString('hex');
let auth = new AccountAuth(saved.auth, () => { dirty = true; });
/* Deploy overlap. Each snapshot records when its writer booted. If an OLDER instance saved after this one
   booted, this (newer) instance merges the records it is missing and saves again instead of being locked
   out until restart. An older or outgoing instance still refuses to overwrite a newer one. Records this
   instance removed on purpose (logouts, closed parties) are remembered so a merge never brings them back. */
const BOOTED = Date.now(), dropped = new Set();
const watchDrops = (map, tag) => { if (map.__watched) return; const del = map.delete.bind(map); map.delete = k => { dropped.add(tag + k); return del(k); }; map.__watched = true; };
const watchAll = () => { watchDrops(parties, 'p'); watchDrops(accounts, 'a'); watchDrops(auth.users, 'u'); watchDrops(auth.sessions, 's'); };
watchAll();
const snapshot = () => ({ secret: SECRET, writer: BOOTED, parties: Object.fromEntries(parties), accounts: Object.fromEntries(accounts), auth: auth.export() });
async function mergeNewer() {
  if (shutdownStarted) return false;
  const rows = await pg`select state, version from stakkz_state where id = 'main' limit 1`;
  let remote = rows[0]?.state;
  if (typeof remote === 'string') remote = JSON.parse(remote);
  if (!remote || typeof remote !== 'object' || (Number(remote.writer) || 0) > BOOTED) return false;
  const add = (map, obj, tag, newer) => Object.entries(obj || {}).forEach(([k, v]) => {
    if (dropped.has(tag + k)) return;
    if (!map.has(k) || (newer && newer(map.get(k), v))) map.set(k, v);
  });
  add(parties, remote.parties, 'p', (mine, theirs) => (Number(theirs?.v) || 0) > (Number(mine?.v) || 0));
  add(accounts, remote.accounts, 'a');
  add(auth.users, remote.auth?.users, 'u');
  add(auth.sessions, remote.auth?.sessions, 's');
  parties.forEach(room => (room.players || []).forEach(p => { if (!isBot(p) && !p.out && !lastSeen.has(p.id)) lastSeen.set(p.id, Date.now()); }));
  dbVersion = Number(rows[0].version) || 0;
  console.warn('An older instance saved during a deploy; merged its new records and saving again.');
  return true;
}
const seal =(id, w) => crypto.createHmac('sha256', SECRET).update(id + ':' + JSON.stringify(w)).digest('base64url');
/* Serialise every snapshot in write order. A slow older save cannot overwrite a
   newer one, and login/registration can explicitly await a durable write. */
async function save(force = false) {
  if (!dirty && !force) return true;
  dirty = false;
  const write = async () => {
    const state = snapshot();
    if (pg) {
      /* Versioned compare-and-swap prevents an older process terminating
         during a zero-downtime deploy from erasing newer accounts or parties. */
      for (let attempt = 0; ; attempt++) {
        const json = JSON.stringify(snapshot());
        if (dbVersion === 0) {
          const inserted = await pg`insert into stakkz_state (id, state, version)
            values ('main', ${json}::jsonb, 1)
            on conflict (id) do nothing returning version`;
          if (inserted.length) { dbVersion = Number(inserted[0].version); return; }
        }
        const updated = await pg`update stakkz_state
          set state = ${json}::jsonb, version = version + 1
          where id = 'main' and version = ${dbVersion}
          returning version`;
        if (updated.length) { dbVersion = Number(updated[0].version); return; }
        if (attempt >= 2 || !(await mergeNewer())) throw Error('Database revision changed on another instance; refusing to overwrite newer saved game data.');
      }
    } else if (cloud) {
      const res = await fetch(CLOUD_URL + '?on_conflict=id', {
        method: 'POST',
        headers: { apikey: CLOUD_KEY, Authorization: 'Bearer ' + CLOUD_KEY, 'Content-Type':'application/json', Prefer:'resolution=merge-duplicates' },
        body: JSON.stringify([{ id:'main', state }]),
        signal: AbortSignal.timeout(12000)
      });
      if (!res.ok) throw Error('Persistent store save: HTTP ' + res.status + ' ' + (await res.text()).slice(0,120));
    } else {
      await fs.promises.writeFile(DATA + '.tmp', JSON.stringify(state));
      await fs.promises.rename(DATA + '.tmp', DATA);
    }
  };
  const op = saveChain.then(write,write);
  saveChain = op.catch(()=>{});
  try { await op; return true; }
  catch (e) { dirty = true; console.error('Stakkz save failed:',e.message); return false; }
}
setInterval(save, 4000).unref();
setInterval(() => { const now = Date.now(); parties.forEach((s, code) => { if (now - (s.touched || s.made || 0) > IDLE) { parties.delete(code); dirty = true; tell(code, null); } }); }, 600000).unref();

const idOf = key => 'p_' + crypto.createHash('sha256').update('stakkz:' + key).digest('hex').slice(0, 24);
const account = id => { let w = accounts.get(id); if (!w) { w = core.freshWallet(); w.fresh = true; accounts.set(id, w); }
  if (!w.m1) { w.coins = (w.coins || 0) + 1000000; w.m1 = 1; dirty = true; }
  if (!w.m10) { w.coins = (w.coins || 0) + 10000000; w.m10 = 1; dirty = true; }   // one-off: 10,000,000 coins for everyone   // one-off: every player gets 1,000,000 coins for boxes
  if (!w.e7) { w.coins = 1000000; w.e7 = 1; w.gt = 0; dirty = true; }   // economy reset, once: everyone restarts on exactly 1,000,000 gold; items are untouched
  if (core.earn(w, Date.now())) dirty = true;
  return w; };
function tell(code, s) { const set = watchers.get(code); if (!set) return; const m = JSON.stringify({ state: s, now: Date.now() }); set.forEach(ws => { try { ws.send(m); } catch (e) {} }); }
/* one request to a party; because Node runs one thing at a time, two moves can never collide */
function partyOp(code, op, user, body) {
  const prev = parties.get(code) || null, now = Date.now(), r = core.partyOp(prev, op, user, body, now, code);
  if (r.gone) { parties.delete(code); dirty = true; tell(code, null); return null; }
  if (r.state !== prev) {
    r.state.touched = now; parties.set(code, r.state); dirty = true;
    r.credits.forEach(c => { const w = account(c.id); core.credit(w, c.c, false, now); w.t = now; delete w.fresh; });
    tell(code, r.state);
  }
  return r.state;
}

const buckets = new Map();
const authAttempts = new Map();
function authLimit(req, type, username) {
  const ip = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress).split(',')[0].trim();
  const key = type + ':' + ip + ':' + (type === 'login' ? String(username||'').toLowerCase() : '');
  const now=Date.now(), windowMs=type==='login'?600000:3600000, max=type==='login'?5:6;
  const rec=authAttempts.get(key);
  if (rec && now-rec.since < windowMs && rec.count >= max) return {blocked:true,key};
  if (!rec || now-rec.since >= windowMs) authAttempts.set(key,{since:now,count:0});
  if (authAttempts.size>5000) authAttempts.clear();
  return {blocked:false,key};
}
function authFailed(key) { const rec=authAttempts.get(key); if(rec)rec.count++; }
function authSucceeded(key) { authAttempts.delete(key); }
function allowed(ip) { const now = Date.now(), b = buckets.get(ip) || { n: 80, t: now }; b.n = Math.min(80, b.n + (now - b.t) / 1000 * 20); b.t = now; buckets.set(ip, b); if (buckets.size > 5000) buckets.clear(); if (b.n < 1) return false; b.n--; return true; }
const send = (res, code, o) => { const buf = Buffer.from(JSON.stringify(o)); res.writeHead(code, { 'Content-Type': 'application/json', 'Content-Length': buf.length, 'Cache-Control': 'no-store' }); res.end(buf); };
const read = req => new Promise((ok, no) => { let n = 0; const parts = []; req.on('data', c => { n += c.length; if (n > 20000) { no(new Error('big')); req.destroy(); } else parts.push(c); }); req.on('end', () => { try { ok(JSON.parse(Buffer.concat(parts).toString('utf8') || '{}')); } catch (e) { no(e); } }); req.on('error', no); });

async function api(req, res, parts) {
  const now = Date.now();
  if (parts[0] === 'ping') return send(res, 200, { ok: true, now, parties: parties.size, persistent });
  if (!allowed(String(req.headers['x-forwarded-for'] || req.socket.remoteAddress).split(',')[0].trim())) return send(res, 429, { message: 'Slow down a little.' });
  if (parts[0] === 'party' && parts[1] && req.method === 'GET') return send(res, 200, { state: parties.get(parts[1]) || null, now });
  const key = String(req.headers.authorization || '').replace(/^Bearer /, '');
  if (parts[0] === 'auth' && req.method === 'POST' && ['register','login','logout'].includes(parts[1])) {
    let b; try { b = await read(req); } catch (e) { return send(res, 400, { message:'Invalid request.' }); }
    const guard=authLimit(req,parts[1],b.username);
    if(guard.blocked) return send(res,429,{message:parts[1]==='login'?'Too many incorrect passwords. Try again in ten minutes.':'Too many sign-up attempts. Try again later.'});
    try {
      if (parts[1] === 'register') {
        if (!persistent) return send(res, 503, { message:'Account creation requires persistent storage. The host has not configured it yet.' });
        if (!/^[a-f0-9]{48}$/.test(key)) return send(res, 401, { message:'A guest player key is required to register.' });
        const id = idOf(key), old = account(id);
        const result = auth.register(b.username, b.password, id);
        authSucceeded(guard.key);
        core.setProfile(old, { name: result.username.slice(0,12) });
        dirty = true;
        if (!(await save(true))) return send(res, 503, { message:'Could not save the account. Please try signing in later.' });
        return send(res, 200, { token:result.token, username:result.username, id, registered:true });
      }
      if (parts[1] === 'login') {
        const result = auth.login(b.username,b.password);
        authSucceeded(guard.key);
        if (!(await save(true))) return send(res, 503, { message:'Could not save the session. Please try again.' });
        return send(res, 200, { token:result.token, username:result.username, id:result.id });
      }
      auth.logout(key); if (!(await save(true))) return send(res,503,{message:'Could not safely complete sign-out.'}); return send(res, 200, {ok:true});
    } catch (e) { if(parts[1]==='login'||parts[1]==='register') authFailed(guard.key); return send(res, 400, { message:e.message }); }
  }
  const session = auth.authenticate(key);
  if (!session && !/^[a-f0-9]{48}$/.test(key)) return send(res, 401, { message: 'Missing or expired player session.' });
  const id = session ? session.id : idOf(key);
  // Once a guest account has been registered, only a valid login session can use it.
  if (!session && auth.username(id)) return send(res, 401, { message:'This account requires sign-in.' });
  const w = account(id);
  lastSeen.set(id,now);
  if (parts[0] === 'heartbeat' && req.method === 'POST') return send(res, 200, { ok:true });
  if (parts[0] === 'friends' && req.method === 'GET') {
    /* everyone with an account is everyone's friend: name, look, where they are right now */
    const inPlaza = new Set([...plaza.values()].filter(q => q.i).map(q => q.id)), inGame = new Set();
    parties.forEach(p => { if (p.phase === 'play') p.players.forEach(x => { if (!x.out && !x.bot) inGame.add(x.id); }); });
    const list = [], hidden=[]; const excluded=new Set(Array.isArray(w.hiddenFriends)?w.hiddenFriends:[]);
    auth.users.forEach(u => { const a = accounts.get(u.id); if (!a || u.id === id) return;
      const friend={f:u.id.slice(2,12),n:(a.name||u.username||'Player').slice(0,12),u:u.username,l:a.look||{},pet:a.pet||'',at:inGame.has(u.id)?'game':inPlaza.has(u.id)?'plaza':'',seen:lastSeen.get(u.id)||a.t||0,wins:a.wins||0,played:a.played||0,swag:core.swag(a)};
      (excluded.has(u.id)?hidden:list).push(friend); });
    list.sort((a, b) => (b.at ? 1 : 0) - (a.at ? 1 : 0) || b.seen - a.seen);
    return send(res, 200, { friends:list.slice(0,200),hidden:hidden.slice(0,200),now });
  }
  if (parts[0] === 'my-party' && req.method === 'GET') {
    const found = [...parties.values()].find(s => s.phase !== 'over' && s.players.some(p => p.id === id && !p.out));
    return send(res, 200, { code:found ? found.code:null });
  }
  if (parts[0] === 'auth' && parts[1] === 'me' && req.method === 'GET')
    return send(res, 200, { username:auth.username(id), registered:!!auth.username(id), persistent, id });

  let b = {}; if (req.method === 'POST') { try { b = await read(req); } catch (e) { return send(res, 400, { message: 'Bad request.' }); } }
  const mine = extra => { const fresh = !!w.fresh, out = Object.assign({}, w); delete out.fresh; const bo = core.boostOf(w, now); return Object.assign({ wallet: out, seal: seal(id, out), fresh: fresh, id: id, now: now, rate: core.GOLD_RATE * (bo ? bo.x : 1), boost: bo ? { x: bo.x, left: bo.until - now } : null, swag: core.swag(w) }, extra); };
  const touch = () => { w.t = now; delete w.fresh; dirty = true; };
  try {
    if(parts[0]==='friends'&&req.method==='POST'){
      const target=String(b.friend||'');
      if(!/^[a-f0-9]{10}$/.test(target))return send(res,400,{message:'Invalid friend account.'});
      const match=[...auth.users.values()].find(u=>u.id!==id&&u.id.slice(2,12)===target);
      if(!match)return send(res,404,{message:'Account not found.'});
      const hidden=new Set(Array.isArray(w.hiddenFriends)?w.hiddenFriends:[]);
      if(b.op==='remove')hidden.add(match.id);
      else if(b.op==='restore')hidden.delete(match.id);
      else return send(res,400,{message:'Unknown friend action.'});
      w.hiddenFriends=[...hidden].slice(-500);touch();
      return send(res,200,{ok:true,now});
    }
    if (parts[0] === 'me') { if (req.method === 'POST') { core.setProfile(w, b); if (b.solo) core.credit(w, b.solo, true, now); touch(); } return send(res, 200, mine({swag:core.swag(w)})); }
    if (parts[0] === 'restore' && req.method === 'POST') {
      // a sealed copy this server issued earlier, for an account it no longer has
      if (w.fresh && b.wallet && typeof b.seal === 'string' && b.seal === seal(id, b.wallet)) { Object.keys(w).forEach(k => delete w[k]); Object.assign(w, core.freshWallet(), b.wallet); core.setProfile(w, {}); touch(); }
      return send(res, 200, mine());
    }
    if (parts[0] === 'shop' && req.method === 'POST') { const out = core.shop(w, b.op, b.item); core.setProfile(w, {}); touch(); return send(res, 200, mine(out)); }
    if (parts[0] === 'party' && req.method === 'POST') {
      const user = { id: id, name: w.name, look: w.look, pet: w.pet };
      if (!parts[1]) {
        for (let k = 0; k < 20; k++) { const code = Array.from(crypto.randomBytes(4), x => AB[x % AB.length]).join(''); if (!parties.has(code)) return send(res, 200, { state: partyOp(code, 'create', user, b), now }); }
        return send(res, 503, { message: 'Could not make a party. Try again.' });
      }
      if (!/^[A-Z]{4}$/.test(parts[1])) return send(res, 400, { message: 'Party codes are 4 letters.' });
      const gift = b.op === 'act' && b.a && b.a.t === 'gift' ? Math.floor(Number(b.a.n) || 0) : 0;
      /* Give a disconnected player a two-minute reconnect window before their
         expired turn can be automatically played. Never remove their seat. */
      if (b.op === 'act' && b.a && b.a.t === 'auto') {
        const room = parties.get(parts[1]), targetIndex = room && room.phase === 'play' ?
          (room.stage === 'auction' && room.auc ? room.auc.who : globalThis.Engine.cur(room)) : -1;
        const target = targetIndex >= 0 && room.players[targetIndex];
        const seen = target && lastSeen.get(target.id);
        if (target && !isBot(target) && seen && now-seen>30000 && now-seen<RECONNECT_GRACE_MS)
          return send(res, 200, { state:room, now, reconnecting:true });
      }
      if (gift > 0) { core.spend(w, gift); touch(); }                       // coins leave the giver first
      try { return send(res, 200, { state: partyOp(parts[1], String(b.op), user, b), now }); }
      catch (e) { if (gift > 0) w.coins += gift; throw e; }
    }
  } catch (e) {
    if (e instanceof core.Refused) return send(res, 400, { message: e.message, state: parts[0] === 'party' && parts[1] ? parties.get(parts[1]) || null : undefined, now });
    console.error(e); return send(res, 500, { message: 'The server hit a problem. Try again.' });
  }
  send(res, 404, { message: 'Not found.' });
}

const TYPES = { '.css': 'text/css; charset=utf-8', '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8' };
const server = http.createServer((req, res) => {
  let url; try { url = new URL(req.url, 'http://x'); } catch (e) { res.writeHead(400); return res.end(); }
  const m = /\/api\/(.*)$/.exec(url.pathname);
  if (m) return api(req, res, m[1].split('/')).catch(e => { console.error(e); try { send(res, 500, { message: 'The server hit a problem.' }); } catch (x) {} });
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); return res.end(); }
  let rel = decodeURIComponent(url.pathname); if (rel.endsWith('/')) rel += 'index.html';
  const full = path.normalize(path.join(PUB, rel));
  if (!full.startsWith(PUB + path.sep)) { res.writeHead(403); return res.end(); }
  fs.readFile(full, (err, buf) => {
    if (err) { res.writeHead(404, { 'Content-Type': 'text/plain' }); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(full)] || 'application/octet-stream', 'Content-Length': buf.length, 'Cache-Control': /three\.min\.js$/.test(full) ? 'public, max-age=604800' : 'no-cache', 'X-Content-Type-Options': 'nosniff' });
    res.end(req.method === 'HEAD' ? undefined : buf);
  });
});
/* the live line: anyone with a party's code can watch it; the server sends the game whenever it changes */
const wss = new WebSocketServer({ noServer: true, maxPayload: 1024 });
/* ---------- the plaza: one shared 3D world everyone outside a match walks around in ----------
   Each connection says who it is with the same key or session the API uses; name and outfit come from the
   account, never from the client. Positions are relayed, batched, about ten times a second; nothing is stored. */
const plaza = new Map();   // ws -> { i, id, n, l, pet, p: [x, y, z, ry, anim], moved }
let plazaSeq = 0;
const plazaCard = q => ({ i:q.i, f:q.id.slice(2,12), n:q.n, l:q.l, pet:q.pet, p:q.p, hp:q.hp, w:q.w, d:q.dead?1:0, sw:q.sw });
/* weapons and gold boosts: the server holds health, decides every hit and hands out every boost */
const WEAPONS = [{ dmg: 18, cd: 300, range: 34, rad: 1.1, all: false }, { dmg: 40, cd: 1100, range: 16, rad: 2.4, all: true }];
const BOOSTS = [{ x: 2, ms: 60000 }, { x: 3, ms: 30000 }, { x: 5, ms: 15000 }], PAD_REST = 40000;
const pads = [[-8, -5], [8, -5], [-8, 6], [8, 6], [0, -9], [0, 9], [-20, 0], [20, 0]].map((q, i) => ({ id: i, x: q[0], z: q[1], k: i % 3, at: 0 }));
const padList = now => pads.map(d => [d.id, d.x, d.z, d.k, d.at <= now ? 1 : 0]);
const spawnAt = () => [(Math.random() - 0.5) * 10, 0, 16 + Math.random() * 6, Math.PI, 0];
function plazaShoot(q, m, now) {
  const W = WEAPONS[q.w | 0]; if (q.dead || !W || now - (q.shotAt || 0) < W.cd * 0.85) return;
  let dx = Number(m[1]), dz = Number(m[2]); const l = Math.hypot(dx, dz); if (!Number.isFinite(l) || l < 0.01) return; dx /= l; dz /= l; q.shotAt = now; q.safe = 0;
  const hits = []; let reach = W.range;
  plaza.forEach(o => { if (!o.i || o === q || o.dead || o.safe > now) return; const rx = o.p[0] - q.p[0], rz = o.p[2] - q.p[2], along = rx * dx + rz * dz; if (along < 0.2 || along > W.range || Math.abs(rx * dz - rz * dx) > W.rad || o.p[1] > 3.2) return; hits.push([along, o]); });
  hits.sort((a, b) => a[0] - b[0]); const struck = W.all ? hits : hits.slice(0, 1); if (!W.all && struck.length) reach = struck[0][0];
  plazaAll({ shot: [q.i, q.w | 0, q.p[0], q.p[2], Math.round((q.p[0] + dx * reach) * 100) / 100, Math.round((q.p[2] + dz * reach) * 100) / 100].concat(struck.map(h => h[1].i)) });
  struck.forEach(h => { const o = h[1]; o.hp = Math.max(0, o.hp - W.dmg);
    if (o.hp > 0) return plazaAll({ hp: [o.i, o.hp] });
    o.dead = now + 3000; plazaAll({ ko: [o.i, q.i] });
    const w = account(q.id); w.kos = (w.kos || 0) + 1; q.paid = q.paid || {};
    if (now - (q.paid[o.id] || 0) > 60000 && o.id !== q.id) { q.paid[o.id] = now; w.coins += 5000; dirty = true; plazaSend(wsOf(q), { gold: w.coins, bonus: 5000 }); }
  });
}
const wsOf = q => { for (const [ws, v] of plaza) if (v === q) return ws; return null; };
function plazaPads(q, ws, now, far) {
  if (q.dead || far) return;
  for (const d of pads) { if (d.at > now || Math.hypot(q.p[0] - d.x, q.p[2] - d.z) > 2.3 || q.p[1] > 4) continue;
    const b = BOOSTS[d.k], w = account(q.id), cur = core.boostOf(w, now);
    if (cur && cur.x > b.x) continue;   // a stronger boost is still running: leave this one for someone else
    w.boost = { x: b.x, until: now + b.ms }; dirty = true; d.at = now + PAD_REST; d.k = Math.floor(Math.random() * 3);
    plazaSend(ws, { gold: w.coins, rate: core.GOLD_RATE * b.x, boost: { x: b.x, left: b.ms }, got: b.x }); plazaAll({ pads: padList(now), took: [q.i, b.x] });
  }
}
setInterval(() => { const now = Date.now(); let ch = false;
  plaza.forEach(q => { if (q.i && q.dead && q.dead <= now) { q.dead = 0; q.hp = 100; q.safe = now + 2500; q.p = spawnAt(); q.lastAt = now; plazaAll({ spawn: [q.i, q.p[0], q.p[2]] }); } });
  pads.forEach(d => { if (d.at && d.at <= now) { d.at = 0; ch = true; } }); if (ch) plazaAll({ pads: padList(now) });
}, 250).unref();
const plazaSend = (ws, m) => { if (ws.readyState === 1) { try { ws.send(typeof m === 'string' ? m : JSON.stringify(m)); } catch (e) {} } };
const plazaAll = (m, except) => { const s = JSON.stringify(m); plaza.forEach((q, ws) => { if (ws !== except && q.i) plazaSend(ws, s); }); };
function plazaWho(key) {
  const session = auth.authenticate(key);
  if (!session && !/^[a-f0-9]{48}$/.test(key)) return null;
  const id = session ? session.id : idOf(key);
  if (!session && auth.username(id)) return null;
  const w = account(id);
  return { id: id, n: (w.name || auth.username(id) || 'Guest').slice(0, 12), l: w.look || {}, pet: w.pet || '' };
}
function plazaJoin(ws, raw) {
  const q = plaza.get(ws); if (!q) return;
  const msg = (() => { try { return JSON.parse(raw); } catch (e) { return null; } })(); if (!msg || typeof msg !== 'object') return;
  if (!q.i) {
    if (typeof msg.hello !== 'string') return;
    const who = plazaWho(msg.hello); if (!who) { plazaSend(ws, { error: 'Sign in again to enter the plaza.' }); return ws.close(); }
    if (plaza.size > 80) { plazaSend(ws, { error: 'The plaza is full right now.' }); return ws.close(); }
    Object.assign(q, who, { i: 'w' + (++plazaSeq), p: spawnAt(), moved: false, hp: 100, w: 0, dead: 0, safe: Date.now() + 2500, sw: core.swag(account(who.id)) });
    plazaSend(ws, { you: q.i, all: [...plaza.values()].filter(o => o.i && o !== q).map(plazaCard), pads: padList(Date.now()) });
    plazaAll({ join: plazaCard(q) }, ws);
    return;
  }
  if (Array.isArray(msg.p) && msg.p.length === 5 && msg.p.every(Number.isFinite)) {
    if (q.dead) return;
    const now = Date.now(), np = [Math.max(-30, Math.min(30, msg.p[0])), Math.max(0, Math.min(12, msg.p[1])), Math.max(-30, Math.min(30, msg.p[2])), msg.p[3] % 7, msg.p[4] | 0];
    const far = Math.hypot(np[0] - q.p[0], np[2] - q.p[2]) > 16 * Math.min(3, (now - (q.lastAt || now)) / 1000) + 2.5;   // faster than anyone can run: no pick-ups from that step
    q.p = np; q.lastAt = now; q.moved = true; plazaPads(q, ws, now, far);
  } else if (Array.isArray(msg.shoot)) { plazaShoot(q, msg.shoot, Date.now());
  } else if (msg.wpn === 0 || msg.wpn === 1) { q.w = msg.wpn; plazaAll({ wpn: [q.i, q.w] });
  } else if (msg.restyle) {
    const w = account(q.id); q.n = (w.name || auth.username(q.id) || 'Guest').slice(0, 12); q.l = w.look || {}; q.pet = w.pet || ''; q.sw = core.swag(w);
    plazaAll({ look: plazaCard(q) });
  } else if (typeof msg.emote === 'string' && /^(wave|dance|cheer|jump)$/.test(msg.emote)) {
    const now = Date.now(); if (now - (q.em || 0) < 700) return; q.em = now;
    plazaAll({ emote: { i: q.i, e: msg.emote } });
  }
}
setInterval(() => {
  const s = []; plaza.forEach(q => { if (q.i && q.moved) { q.moved = false; s.push([q.i].concat(q.p.map(v => Math.round(v * 100) / 100))); } });
  if (s.length) plazaAll({ s: s });
}, 100).unref();
/* gold keeps flowing for everyone standing in the world, and each of them hears their true balance */
setInterval(() => { const now = Date.now(), seen = new Set(); plaza.forEach((q, ws) => { if (!q.i || seen.has(q.id)) return; seen.add(q.id); const w = account(q.id), bo = core.boostOf(w, now); plazaSend(ws, { gold: w.coins, rate: core.GOLD_RATE * (bo ? bo.x : 1), boost: bo ? { x: bo.x, left: bo.until - now } : null }); }); }, 5000).unref();
server.on('upgrade', (req, socket, head) => {
  if (new URL(req.url, 'http://x').pathname.endsWith('/api/plaza/ws')) {
    return wss.handleUpgrade(req, socket, head, ws => {
      plaza.set(ws, {}); let count = 0, since = Date.now();
      ws.on('message', d => {
        const m = String(d); if (m === 'ping') return plazaSend(ws, 'pong');
        const now = Date.now(); if (now - since > 1000) { since = now; count = 0; } if (++count > 40) return;   // flood guard
        plazaJoin(ws, m);
      });
      ws.on('close', () => { const q = plaza.get(ws); plaza.delete(ws); if (q && q.i) plazaAll({ leave: q.i }); });
      ws.on('error', () => {});
    });
  }
  const m = /\/api\/party\/([A-Z]{4})\/ws$/.exec(new URL(req.url, 'http://x').pathname);
  if (!m) return socket.destroy();
  wss.handleUpgrade(req, socket, head, ws => {
    const code = m[1]; let set = watchers.get(code); if (!set) watchers.set(code, set = new Set());
    if (set.size >= 40) return ws.close(1013, 'full');
    set.add(ws); ws.send(JSON.stringify({ state: parties.get(code) || null, now: Date.now() }));
    let lastLook = 0;
    ws.on('message', d => {
      const m = String(d);
      if (m === 'ping') { try { ws.send('pong'); } catch (e) {} return; }
      /* where a player is looking: relayed to the rest of the party, never stored */
      if (m.length > 200 || m[0] !== '{') return;
      const now = Date.now(); if (now - lastLook < 200) return; lastLook = now;
      let j; try { j = JSON.parse(m); } catch (e) { return; }
      if (!Array.isArray(j.look) || typeof j.id !== 'string' || j.id.length > 40) return;
      const a = Number(j.look[0]), el = Number(j.look[1]); if (!Number.isFinite(a) || !Number.isFinite(el)) return;
      const out = JSON.stringify({ look: { id: j.id, a: Math.round(a * 100) / 100, e: Math.round(el * 100) / 100 } });
      set.forEach(o => { if (o !== ws && o.readyState === 1) { try { o.send(out); } catch (e) {} } });
    });
    ws.on('close', () => { set.delete(ws); if (!set.size) watchers.delete(code); });
    ws.on('error', () => {});
  });
});
/* Bots and idle-turn recovery execute on the server, so gameplay does not stop
   just because the host closes their browser. */
let botBusy = false;
setInterval(async () => {
  if (botBusy) return;
  botBusy = true;
  try {
    for (const [code,s] of parties) {
      if (s.phase !== 'play') continue;
      // Enforce the match deadline on the authoritative clock, regardless of
      // who is online, whose turn it is or whether an auction is running.
      if (s.endAt && Date.now() >= s.endAt) {
        try { partyOp(code, 'expire', {id:'server'}, {}); }
        catch(e) { console.error('Match deadline settlement failed:',e.message); }
        continue;
      }
      if (s.endAt && Date.now() >= s.endAt-300000 && !s.chaosStarted) {
        try { partyOp(code, 'chaos', {id:'server'}, {}); }
        catch(e) { console.error('Final Chaos activation failed:',e.message); }
        continue;
      }
      const next = nextBotAction(s);
      if (next) {
        try { partyOp(code, 'act', {id:next.id}, {a:next.a}); }
        catch(e) { console.error('Bot action rejected:',next.id,e.message); }
        continue;
      }
      const now = Date.now();
      /* A disconnected player keeps their seat for two minutes, during which
         another signed-in device can reclaim exactly the same identity.
         After the grace period, leave the game to avoid indefinite stalls. */
      const away = s.players.find(p => !isBot(p) && !p.out &&
        lastSeen.has(p.id) && now-lastSeen.get(p.id)>=RECONNECT_GRACE_MS);
      if (away) {
        try { partyOp(code,'act',{id:away.id},{a:{t:'quit'}}); }
        catch(e) { console.error('Grace-period removal failed:',e.message); }
        continue;
      }
      const index = s.stage === 'auction' && s.auc ? s.auc.who : globalThis.Engine.cur(s);
      const p = s.players[index], seen = p && lastSeen.get(p.id);
      const offline = p && !isBot(p) && seen && now - seen > 30000;
      if (s.deadline && now >= s.deadline && (!offline || now - seen >= RECONNECT_GRACE_MS)) {
        try { partyOp(code, 'act', {id:p.id}, {a:{t:'auto',force:1}}); }
        catch(e) { console.error('Automatic turn rejected:',e.message); }
      }
    }
  } finally { botBusy = false; }
}, 1350).unref();
async function bootstrap() {
  if (persistent) {
    let remote;
    if (pg) {
      await pg`create table if not exists stakkz_state (id text primary key, state jsonb not null, version bigint not null default 0)`;
      await pg`alter table stakkz_state add column if not exists version bigint not null default 0`;
      const rows = await pg`select state, version from stakkz_state where id = 'main' limit 1`;
      dbVersion = Number(rows[0]?.version) || 0;
      remote = rows[0]?.state;
      /* postgres.js returns JSONB as a string with some driver settings.
         Always hydrate the actual object before restoring accounts/sessions. */
      if (typeof remote === 'string') remote = JSON.parse(remote);
    } else {
      const res = await fetch(CLOUD_URL + '?id=eq.main&select=state', {
      headers: { apikey:CLOUD_KEY, Authorization:'Bearer '+CLOUD_KEY },
      signal: AbortSignal.timeout(12000)
    });
    if (!res.ok) throw Error('Persistent store unavailable (HTTP '+res.status+')');
      const rows = await res.json(); remote = rows[0]?.state;
    }
    if (remote && typeof remote === 'object') {
      saved = remote;
      parties.clear(); accounts.clear();
      Object.entries(saved.parties || {}).forEach(([k,v])=>parties.set(k,v));
      Object.entries(saved.accounts || {}).forEach(([k,v])=>accounts.set(k,v));
      auth = new AccountAuth(saved.auth, () => {dirty=true;}); watchAll();
      if (!process.env.STAKKZ_SECRET && saved.secret) SECRET = saved.secret;
    }
    parties.forEach(room => room.players.forEach(p => {if(!isBot(p) && !p.out) lastSeen.set(p.id,Date.now());}));
    console.log('Persistent storage ready:',accounts.size,'accounts,',parties.size,'parties');
  } else {
    console.warn('No persistent database configured: free-host restarts can erase player progress. Account registration is disabled.');
  }
  server.listen(PORT, () => console.log('Stakkz is running on port ' + PORT));
}
bootstrap().catch(e => { console.error('Startup aborted to protect accounts:',e.message); process.exitCode=1; });
let shutdownStarted = false;
process.on('SIGTERM', () => {
  if (shutdownStarted) return;
  shutdownStarted = true;
  /* Never mark an unchanged instance dirty during Render rolling deploys.
     Its stale empty snapshot must not overwrite a newer running server. */
  void (async () => {
    if (dirty) await save();
    await saveChain;
    if (pg) await pg.end({ timeout: 1 });
  })().catch(e => console.error('Stakkz shutdown flush failed:', e.message))
    .finally(() => process.exit(0));
  setTimeout(() => process.exit(0), 2500).unref();
});
