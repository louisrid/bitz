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

/* the old address after a move: forward everyone, run nothing else */
if (process.env.STAKKZ_MOVED_TO) { await import('./moved.js'); await new Promise(() => {}); }

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
  catch (e) { dirty = true; console.error('BITZ save failed:',e.message); return false; }
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
/* which release this server is running; open pages reload themselves when it changes */
const handoffs = new Map();
const BUILD = String(process.env.RENDER_GIT_COMMIT || 'dev').slice(0, 12);   // only a new release changes this, never a restart
const send = (res, code, o) => { const buf = Buffer.from(JSON.stringify(o)); res.writeHead(code, { 'Content-Type': 'application/json', 'Content-Length': buf.length, 'Cache-Control': 'no-store' }); res.end(buf); };
const read = req => new Promise((ok, no) => { let n = 0; const parts = []; req.on('data', c => { n += c.length; if (n > 20000) { no(new Error('big')); req.destroy(); } else parts.push(c); }); req.on('end', () => { try { ok(JSON.parse(Buffer.concat(parts).toString('utf8') || '{}')); } catch (e) { no(e); } }); req.on('error', no); });

async function api(req, res, parts) {
  const now = Date.now();
  if (parts[0] === 'ping') return send(res, 200, { ok: true, now, parties: parties.size, persistent, build: BUILD });
  /* moving address: the old site's page posts its guest key and session here and gets a one-time code;
     the new page swaps the code for them. Codes last two minutes and work once. */
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
      res.writeHead(200, Object.assign({ 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, cors)); return res.end(JSON.stringify({ code: code }));
    }
    if (req.method === 'GET' && /^[a-f0-9]{32}$/.test(parts[1] || '')) { const h = handoffs.get(parts[1]); handoffs.delete(parts[1]); return send(res, 200, h && h.exp >= now ? { key: h.key, session: h.session } : {}); }
    return send(res, 404, {});
  }
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
      const friend={f:u.id.slice(2,12),n:(a.name||u.username||'Player').slice(0,12),u:u.username,l:a.look||{},pet:a.pet||'',at:inGame.has(u.id)?'game':inPlaza.has(u.id)?'plaza':'',seen:lastSeen.get(u.id)||a.t||0,wins:a.wins||0,played:a.played||0,swag:core.swag(a),worth:core.worth(a)};
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
  const mine = extra => { const fresh = !!w.fresh, out = Object.assign({}, w); delete out.fresh; const bo = core.boostOf(w, now); return Object.assign({ wallet: out, seal: seal(id, out), fresh: fresh, id: id, now: now, worth: core.worth(w), rate: core.GOLD_RATE * (bo ? bo.x : 1), boost: bo ? { x: bo.x, left: bo.until - now } : null, swag: core.swag(w) }, extra); };
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
const plazaCard = q => ({ i:q.i, f:q.id.slice(2,12), n:q.n, l:q.l, pet:q.pet, p:q.p, hp:q.hp, w:q.w, d:q.dead?1:0, sw:q.sw, nw:q.nw });
/* weapons and gold boosts: the server holds health, decides every hit and hands out every boost */
/* 1 Blaster, 2 Pulse (beam, hits everything in line), 3 Cannon (wide blast), 4 Scatter (five pellets), 5 Longshot (sniper) */
const GUNIDS = ['g_blaster', 'g_pulse', 'g_cannon', 'g_scatter', 'g_longshot'];
const WEAPONS = [{ dmg: 18, cd: 300, range: 34, rad: 1.1, all: false }, { dmg: 40, cd: 1100, range: 24, rad: 2.4, all: true }, { dmg: 58, cd: 1900, range: 24, rad: 3.4, all: true },
  { dmg: 15, cd: 800, range: 15, rad: 1.0, all: false, pellets: 5, spread: 0.22 }, { dmg: 95, cd: 2300, range: 75, rad: 0.8, all: false }];
const BOOSTS = [{ x: 2, ms: 60000 }, { x: 3, ms: 30000 }, { x: 5, ms: 15000 }], PAD_REST = 45000;
/* three boosts only, out on the grass well clear of the fighting circle */
const pads = [].map((q, i) => ({ id: i, x: q[0], z: q[1], k: i % 3, at: 0 }));
const padList = now => pads.map(d => [d.id, d.x, d.z, d.k, d.at <= now ? 1 : 0]);
/* everyone arrives inside the circle in the middle of the field */
const spawnAt = () => { const a = Math.random() * Math.PI * 2, r = Math.random() * 9; return [Math.sin(a) * r, 0, Math.cos(a) * r, Math.atan2(-Math.sin(a), -Math.cos(a)), 0]; };
function plazaHurt(o, dmg, by, now) {
  if (o.dead || o.safe > now) return; o.hp = Math.max(0, o.hp - dmg);
  if (o.hp > 0) return plazaAll({ hp: [o.i, o.hp] });
  o.dead = now + 3000; plazaAll({ ko: [o.i, by ? by.i : 'z'] });
  if (!by) return; const w = account(by.id); w.kos = (w.kos || 0) + 1; by.paid = by.paid || {};
  if (now - (by.paid[o.id] || 0) > 60000 && o.id !== by.id) { by.paid[o.id] = now; w.coins += 5000; dirty = true; plazaSend(wsOf(by), { gold: w.coins, bonus: 5000 }); }
}
/* ---------- things in the world: rare creatures to chase, gift drops from the sky, and zombies ----------
   The server moves them, decides who touched or shot them first, and pays out. */
const ADMINS = new Set(String(process.env.STAKKZ_ADMINS || 'louis').toLowerCase().split(',').map(x => x.trim()).filter(Boolean));
const isAdmin = q => { const u = auth.username(q.id); return !!u && ADMINS.has(String(u).toLowerCase()); };
const world = { zom: false, wild: false, gift: false, forage: true };   // gift drops are off too   // rare creatures switched off for good
const ents = new Map(); let entSeq = 0, zMode = false, zBy = '';
let zWave = 0, zLeft = 0, zBoss = false, zNext = 0;
const WILD = [['w_goldpig', 26, 9.5], ['w_rainbowfox', 25, 11], ['w_crystaldeer', 20, 12], ['w_cosmiccat', 15, 12.5], ['w_phoenix', 10, 14], ['w_unicorn', 4, 16.5]];
const ZOMBIE_PAY = 1000000, ZOMBIE_MAX = 14;
const entCard = e => [e.id, e.k, e.sub, Math.round(e.x * 100) / 100, Math.round(e.y * 100) / 100, Math.round(e.z * 100) / 100, Math.round(e.ry * 100) / 100, e.hp || 0, e.mh || 0];
const people = () => [...plaza.values()].filter(q => q.i && !q.dead);
function entAdd(k, sub, x, z, extra) { const e = Object.assign({ id: 'e' + (++entSeq), k: k, sub: sub, x: x, y: 0, z: z, ry: Math.random() * 6, t0: Date.now(), tx: x, tz: z }, extra || {}); ents.set(e.id, e); plazaAll({ ent: entCard(e) }); return e; }
function entGone(e, how, by, extra) { ents.delete(e.id); plazaAll({ entgone: Object.assign({ id: e.id, k: e.k, sub: e.sub, how: how, by: by ? by.i : '', n: by ? by.n : '', x: e.x, z: e.z }, extra || {}) }); }
function giftPrize(w) {
  const r = Math.random();
  if (r < 0.25) { w.boxes = (w.boxes || 0) + 1; return { box: 1 }; }
  if (r < 0.6) { const pool = Object.keys(core.ITEMS || {}).filter(id => { const it = core.ITEMS[id]; return it[2] > 0 && !it[3] && it[2] <= 300000 && w.own.indexOf(id) < 0; });
    if (pool.length) { const id = pool[Math.floor(Math.random() * pool.length)]; w.own.push(id); return { item: id }; } }
  const g = [150000, 200000, 300000, 400000, 600000][Math.floor(Math.random() * 5)]; w.coins += g; return { gold: g };
}
function plazaTouch(q, ws, now) {
  if (q.dead) return;
  for (const e of ents.values()) {
    if (e.k === 'zom' || (e.k === 'gift' && e.y > 0.05)) continue;
    if (Math.hypot(q.p[0] - e.x, q.p[2] - e.z) > (e.k === 'gift' ? 3.2 : e.k === 'forage' ? 2.6 : 3.6)) continue;
    const w = account(q.id); let prize = {};
    if (e.k === 'forage') {
      if (e.sub === 'chest' || (e.sub === 'gem' && Math.random() < 0.15)) prize = giftPrize(w);
      else { const g = { shroom: [10000, 40000], nugget: [30000, 90000], gem: [150000, 300000] }[e.sub] || [10000, 20000]; const v = Math.round((g[0] + Math.random() * (g[1] - g[0])) / 1000) * 1000; w.coins += v; prize = { gold: v }; }
    } else if (e.k === 'wild') { if (w.own.indexOf(e.sub) < 0) { w.own.push(e.sub); prize = { item: e.sub }; } else { w.coins += 500000; prize = { gold: 500000 }; } }
    else prize = giftPrize(w);
    w.t = now; dirty = true; entGone(e, 'caught', q, prize);
    plazaSend(ws, { gold: w.coins, reward: Object.assign({ k: e.k, sub: e.sub }, prize) });
  }
}
function zombieShot(q, dx, dz, W, now) {
  const hits = [];
  ents.forEach(e => { if (e.k !== 'zom') return; const rx = e.x - q.p[0], rz = e.z - q.p[2], along = rx * dx + rz * dz; if (along < 0.2 || along > W.range || Math.abs(rx * dz - rz * dx) > W.rad + (e.boss ? 3 : 0.9)) return; hits.push([along, e]); });
  return hits;
}
setInterval(() => {
  const now = Date.now(), dt = 0.1, ppl = people(), moved = [];
  if (!plaza.size && ents.size) ents.forEach(e => { if (e.k === 'zom') ents.delete(e.id); });   // nobody connected: nobody to tell
  /* a rare creature roughly every minute, a gift every minute or so, zombies while zombie mode is on */
  const count = k => [...ents.values()].filter(e => e.k === k).length;
  /* foraging: things lying in the grass, always about 28 of them; picked ones come back elsewhere */
  if (world.forage && count('forage') < 28 && now > (global.nextForage || 0)) {
    global.nextForage = now + (count('forage') < 14 ? 150 : 4000);
    const r = Math.random(), sub = r < 0.45 ? 'shroom' : r < 0.85 ? 'nugget' : r < 0.97 ? 'gem' : 'chest';
    const a = Math.random() * Math.PI * 2, d = 20 + Math.sqrt(Math.random()) * 95; entAdd('forage', sub, Math.sin(a) * d, Math.cos(a) * d);
  }
  if (world.wild && ppl.length && now > (global.nextWild || 0)) {
    global.nextWild = now + 50000 + Math.random() * 25000;
    if (count('wild') < 2) { let r = Math.random() * 100, pick = WILD[0]; for (const w of WILD) { if (r < w[1]) { pick = w; break; } r -= w[1]; }
      const a = Math.random() * Math.PI * 2, d = 26 + Math.random() * 40; const e = entAdd('wild', pick[0], Math.sin(a) * d, Math.cos(a) * d, { sp: pick[2] }); plazaAll({ news: { wild: e.sub } }); }
  }
  if (global.nextGift == null) global.nextGift = now + 90000;   // not straight away after a restart
  if (world.gift && ppl.length && now > (global.nextGift || 0)) {
    global.nextGift = now + 180000 + Math.random() * 120000;   // a gift every three to five minutes
    if (count('gift') < 1) { const a = Math.random() * Math.PI * 2, d = 6 + Math.random() * 34; entAdd('gift', 'drop', Math.sin(a) * d, Math.cos(a) * d, { y: 42 }); plazaAll({ news: { gift: 1 } }); }
  }
  /* zombie waves: each wave is bigger; when the last zombie falls a boss comes; beat it for the next wave */
  if (zMode && ppl.length) {
    const zs = count('zom');
    if (!zLeft && !zs && !zBoss && now > zNext && zNext) { zWave++; zLeft = 5 + zWave * 3; zNext = 0; plazaAll({ wave: { n: zWave, count: zLeft } }); }
    if (zLeft > 0 && zs < ZOMBIE_MAX && now > (global.nextZom || 0)) {
      global.nextZom = now + Math.max(500, 1300 - zWave * 80); zLeft--;
      const t = ppl[Math.floor(Math.random() * ppl.length)], a = Math.random() * Math.PI * 2, d = 26 + Math.random() * 14, hp = 60 + (zWave - 1) * 12;
      entAdd('zom', 'z' + Math.floor(Math.random() * 3), Math.max(-140, Math.min(140, t.p[0] + Math.sin(a) * d)), Math.max(-140, Math.min(140, t.p[2] + Math.cos(a) * d)), { hp: hp, mh: hp, sp: 3.6 + Math.min(2, zWave * 0.2), dmg: 12 });
    }
    if (!zLeft && !zs && !zBoss && !zNext && zWave) {
      zBoss = true; const t = ppl[0], a = Math.random() * Math.PI * 2, hp = 450 + zWave * 200;
      entAdd('zom', 'boss', Math.max(-140, Math.min(140, t.p[0] + Math.sin(a) * 32)), Math.max(-140, Math.min(140, t.p[2] + Math.cos(a) * 32)), { hp: hp, mh: hp, sp: 3.2, dmg: 30, boss: 1 });
      plazaAll({ boss: { n: zWave, hp: hp } });
    }
  }
  ents.forEach(e => {
    const ox = e.x, oz = e.z, oy = e.y;
    let near = null, nd = 1e9; ppl.forEach(q => { const d = Math.hypot(q.p[0] - e.x, q.p[2] - e.z); if (d < nd) { nd = d; near = q; } });
    if (e.k === 'wild') {
      if (now - e.t0 > 100000) return entGone(e, 'fled');
      let vx = 0, vz = 0, sp = 0;
      /* creatures run in bursts: about 2.5 seconds flat out, then they tire for 1.6 seconds. Time your sprint. */
      if (near && nd < 22) { vx = e.x - near.p[0]; vz = e.z - near.p[2];
        if (e.tired > now) sp = e.sp * 0.35; else { sp = e.sp; e.stam = (e.stam == null ? 2 : e.stam) - dt; if (e.stam <= 0) { e.tired = now + 2200; e.stam = 2; } } const l = Math.hypot(vx, vz) || 1; vx /= l; vz /= l;
        const r = Math.hypot(e.x, e.z); if (r > 110) { vx -= e.x / r * 0.8; vz -= e.z / r * 0.8; } }   // turn back before the edge of the field
      else { if (Math.hypot(e.tx - e.x, e.tz - e.z) < 1) { const a = Math.random() * Math.PI * 2; e.tx = Math.max(-100, Math.min(100, e.x + Math.sin(a) * 12)); e.tz = Math.max(-100, Math.min(100, e.z + Math.cos(a) * 12)); } vx = e.tx - e.x; vz = e.tz - e.z; sp = 3; }
      const l = Math.hypot(vx, vz) || 1; e.x += vx / l * sp * dt; e.z += vz / l * sp * dt; if (sp) e.ry = Math.atan2(vx, vz);
      e.y = sp > 4 ? Math.abs(Math.sin(now / 90)) * 0.5 : 0;
    } else if (e.k === 'gift') {
      if (e.y > 0) e.y = Math.max(0, e.y - 6 * dt); else if (now - e.t0 > 150000) return entGone(e, 'gone');
    } else if (e.k === 'zom') {
      if (!near) return; const vx = near.p[0] - e.x, vz = near.p[2] - e.z, l = Math.hypot(vx, vz) || 1;
      const reach = e.boss ? 4.6 : 2.6;
      if (l > reach - 0.5) { e.x += vx / l * (e.sp || 3.8) * dt; e.z += vz / l * (e.sp || 3.8) * dt; } e.ry = Math.atan2(vx, vz);
      if (l < reach && now - (e.bit || 0) > (e.boss ? 900 : 700)) { e.bit = now; plazaHurt(near, e.dmg || 12, null, now); }
    }
    if (e.x !== ox || e.z !== oz || e.y !== oy) moved.push([e.id, Math.round(e.x * 100) / 100, Math.round(e.y * 100) / 100, Math.round(e.z * 100) / 100, Math.round(e.ry * 100) / 100]);
  });
  if (moved.length) plazaAll({ e: moved });
}, 100).unref();
function plazaShoot(q, m, now) {
  const wi = Math.max(0, Math.min(WEAPONS.length - 1, q.w | 0)), W = WEAPONS[wi]; if (q.dead || !W || now - (q.shotAt || 0) < W.cd * 0.85) return;
  let dx0 = Number(m[1]), dz0 = Number(m[2]); const l0 = Math.hypot(dx0, dz0); if (!Number.isFinite(l0) || l0 < 0.01) return; dx0 /= l0; dz0 /= l0; q.shotAt = now; q.safe = 0;
  const base = Math.atan2(dx0, dz0), n = W.pellets || 1;
  for (let k = 0; k < n; k++) { const a = base + (n > 1 ? (k / (n - 1) - 0.5) * 2 * W.spread : 0); plazaRay(q, Math.sin(a), Math.cos(a), W, wi, now); }
}
function plazaRay(q, dx, dz, W, wi, now) {
  const hits = []; let reach = W.range;
  plaza.forEach(o => { if (!o.i || o === q || o.dead || o.safe > now) return; const rx = o.p[0] - q.p[0], rz = o.p[2] - q.p[2], along = rx * dx + rz * dz; if (along < 0.2 || along > W.range || Math.abs(rx * dz - rz * dx) > W.rad + 0.6 || o.p[1] > 4.5) return; hits.push([along, o]); });
  zombieShot(q, dx, dz, W, now).forEach(h => hits.push(h));
  hits.sort((a, b) => a[0] - b[0]); const struck = W.all ? hits : hits.slice(0, 1); if (!W.all && struck.length) reach = struck[0][0];
  plazaAll({ shot: [q.i, wi, q.p[0], q.p[2], Math.round((q.p[0] + dx * reach) * 100) / 100, Math.round((q.p[2] + dz * reach) * 100) / 100].concat(struck.map(h => h[1].i || h[1].id)) });
  struck.forEach(h => { const o = h[1];
    if (o.k === 'zom') { if (!ents.has(o.id)) return; o.hp -= W.dmg; if (o.hp > 0) return plazaAll({ ent: entCard(o) });
      const w = account(q.id), pay = o.boss ? 5000000 : ZOMBIE_PAY; w.coins += pay; w.zkills = (w.zkills || 0) + 1; dirty = true; entGone(o, 'killed', q, { gold: pay, boss: o.boss ? 1 : 0 }); plazaSend(wsOf(q), { gold: w.coins, reward: { k: o.boss ? 'boss' : 'zom', gold: pay } });
      if (o.boss) { zBoss = false; zNext = now + 7000; const seen = new Set(); plaza.forEach((x, xws) => { if (!x.i || seen.has(x.id)) return; seen.add(x.id); const xw = account(x.id); xw.coins += 500000; plazaSend(xws, { gold: xw.coins, reward: { k: 'wave', gold: 500000, n: zWave } }); }); plazaAll({ cleared: { n: zWave, by: q.n } }); }
      return; }
    plazaHurt(o, W.dmg, q, now);
  });
}
/* trading: two people in the world put up items and gold; nothing moves until both confirm the same version of the offer */
const trades = new Map(); let tradeSeq = 0;
const tradeSide = () => ({ items: [], gold: 0, ok: false });
const tradeTell = (q, m) => plazaSend(wsOf(q), { trade: m });
const tradeView = (t, q) => { const a = q === t.a, o = a ? t.b : t.a; return { ev: 'state', id: t.id, v: t.v, with: o.i, n: o.n, me: a ? t.oa : t.ob, them: a ? t.ob : t.oa }; };
function tradeEnd(t, why) { trades.delete(t.id); [t.a, t.b].forEach(q => { if (q.trade === t.id) q.trade = 0; tradeTell(q, { ev: 'cancel', id: t.id, why: why }); }); }
function plazaTrade(q, m, now) {
  if (m.op === 'ask') {
    const o = [...plaza.values()].find(x => x.i && x.i === m.to); if (!o || o === q || o.id === q.id) return;
    if (q.trade || o.trade) return tradeTell(q, { ev: 'busy', n: o.n });
    const t = { id: ++tradeSeq, a: q, b: o, open: false, v: 0, at: now, oa: tradeSide(), ob: tradeSide() }; trades.set(t.id, t); q.trade = o.trade = t.id;
    tradeTell(o, { ev: 'ask', id: t.id, from: q.i, n: q.n }); return tradeTell(q, { ev: 'wait', id: t.id, n: o.n });
  }
  const t = trades.get(q.trade); if (!t || t.id !== m.id) return;
  if (m.op === 'decline' || m.op === 'cancel') return tradeEnd(t, m.op === 'decline' ? 'declined' : 'cancelled');
  if (m.op === 'accept') { if (q !== t.b || t.open) return; t.open = true; tradeTell(t.a, tradeView(t, t.a)); return tradeTell(t.b, tradeView(t, t.b)); }
  if (!t.open) return;
  const mine = q === t.a ? 'oa' : 'ob', o = q === t.a ? t.b : t.a, both = () => { tradeTell(t.a, tradeView(t, t.a)); tradeTell(t.b, tradeView(t, t.b)); };
  if (m.op === 'offer') {
    let c; try { c = core.tradeCheck(account(q.id), account(o.id), m); } catch (e) { return tradeTell(q, { ev: 'note', id: t.id, text: e.message }); }
    t[mine] = { items: c.items, gold: c.gold, ok: false }; t.oa.ok = t.ob.ok = false; t.v++; return both();
  }
  if (m.op === 'confirm') {
    if (m.v !== t.v) return; t[mine].ok = true; if (!(t.oa.ok && t.ob.ok)) return both();
    const wa = account(t.a.id), wb = account(t.b.id);
    try { core.tradeSwap(wa, wb, t.oa, t.ob); } catch (e) { t.oa.ok = t.ob.ok = false; t.v++; [t.a, t.b].forEach(x => tradeTell(x, { ev: 'note', id: t.id, text: e.message })); return both(); }
    wa.t = wb.t = now; dirty = true; trades.delete(t.id);
    [[t.a, wa, t.ob, t.oa], [t.b, wb, t.oa, t.ob]].forEach(r => { const x = r[0]; x.trade = 0; x.l = r[1].look || {}; x.pet = r[1].pet || ''; x.sw = core.swag(r[1]); plazaAll({ look: plazaCard(x) }); tradeTell(x, { ev: 'done', id: t.id, got: r[2].items, gotGold: r[2].gold, gave: r[3].items, gaveGold: r[3].gold }); });
  }
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
  trades.forEach(t => { if (!t.open && now - t.at > 30000) tradeEnd(t, 'no answer'); });
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
    Object.assign(q, who, { i: 'w' + (++plazaSeq), p: spawnAt(), moved: false, hp: 100, w: 0, dead: 0, safe: Date.now() + 2500, sw: core.swag(account(who.id)), nw: core.worth(account(who.id)) });
    plazaSend(ws, { you: q.i, admin: isAdmin(q), world: world, all: [...plaza.values()].filter(o => o.i && o !== q).map(plazaCard), ents: [...ents.values()].map(entCard), zmode: { on: zMode, n: zBy, wave: zWave } });
    plazaAll({ join: plazaCard(q) }, ws);
    return;
  }
  if (Array.isArray(msg.p) && msg.p.length === 5 && msg.p.every(Number.isFinite)) {
    if (q.dead) return;
    const now = Date.now(), np = [Math.max(-145, Math.min(145, msg.p[0])), Math.max(0, Math.min(12, msg.p[1])), Math.max(-145, Math.min(145, msg.p[2])), msg.p[3] % 7, msg.p[4] | 0];
    /* nobody runs faster than 11 a second: a longer step is cut short, so nobody can teleport into range to shoot */
    const step = Math.hypot(np[0] - q.p[0], np[2] - q.p[2]), most = 38 * Math.min(2, Math.max(0.1, (now - (q.lastAt || now)) / 1000)) + 3;
    if (q.lastAt && step > most) { const k = most / step; np[0] = q.p[0] + (np[0] - q.p[0]) * k; np[2] = q.p[2] + (np[2] - q.p[2]) * k; }
    const far = false;
    q.p = np; q.lastAt = now; q.moved = true; plazaTouch(q, ws, now);
  } else if (msg.sprint) { /* sprint has no stamina now: the step limit above already allows it */
  } else if (msg.admin && typeof msg.admin === 'object') {
    if (!isAdmin(q)) return plazaSend(ws, { error: 'Only the admin can change that.' });
    const k = msg.admin.k, on = !!msg.admin.on; if (!(k in world) || k === 'zom' || k === 'wild' || k === 'gift') return;   // zombies and rare creatures are gone
    world[k] = on;
    if (k === 'zom') { zMode = on; zBy = q.n; if (on) { zWave = 0; zNext = Date.now() + 1500; zLeft = 0; zBoss = false; } else ents.forEach(e => { if (e.k === 'zom') entGone(e, 'poof'); }); }
    if (!on && k !== 'zom') ents.forEach(e => { if (e.k === k) entGone(e, 'gone'); });
    plazaAll({ world: world, zmode: { on: zMode, n: q.n, wave: zWave } });
  } else if (Array.isArray(msg.shoot)) { plazaShoot(q, msg.shoot, Date.now());
  } else if (msg.trade && typeof msg.trade === 'object') { plazaTrade(q, msg.trade, Date.now());
  } else if (Number.isInteger(msg.wpn) && msg.wpn >= 0 && msg.wpn < WEAPONS.length) { if (msg.wpn > 0 && account(q.id).own.indexOf(GUNIDS[msg.wpn]) < 0) return plazaSend(ws, { error: 'Buy that gun in the shop first.' }); q.w = msg.wpn; plazaAll({ wpn: [q.i, q.w] });
  } else if (msg.restyle) {
    const w = account(q.id); q.n = (w.name || auth.username(q.id) || 'Guest').slice(0, 12); q.l = w.look || {}; q.pet = w.pet || ''; q.sw = core.swag(w); q.nw = core.worth(w);
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
/* players whose connection died without closing (a sleeping laptop, a crashed tab) are removed within 30 seconds */
setInterval(() => { plaza.forEach((q, ws) => { if (!ws.alive) { try { ws.terminate(); } catch (e) {} return; } ws.alive = false; try { ws.ping(); } catch (e) {} }); }, 15000).unref();
server.on('upgrade', (req, socket, head) => {
  if (new URL(req.url, 'http://x').pathname.endsWith('/api/plaza/ws')) {
    return wss.handleUpgrade(req, socket, head, ws => {
      plaza.set(ws, {}); let count = 0, since = Date.now(); ws.alive = true; ws.on('pong', () => { ws.alive = true; });
      ws.on('message', d => {
        const m = String(d); if (m === 'ping') return plazaSend(ws, 'pong');
        const now = Date.now(); if (now - since > 1000) { since = now; count = 0; } if (++count > 40) return;   // flood guard
        plazaJoin(ws, m);
      });
      ws.on('close', () => { const q = plaza.get(ws); if (q && q.trade && trades.get(q.trade)) tradeEnd(trades.get(q.trade), 'left'); plaza.delete(ws); if (q && q.i) plazaAll({ leave: q.i }); });
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
  server.listen(PORT, () => console.log('BITZ is running on port ' + PORT));
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
  })().catch(e => console.error('BITZ shutdown flush failed:', e.message))
    .finally(() => process.exit(0));
  setTimeout(() => process.exit(0), 2500).unref();
});
