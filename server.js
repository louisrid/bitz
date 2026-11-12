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
import './public/world-layout.js';
import { AccountAuth } from './src/auth.js';
import { isBot } from './src/bots.js';
import { mountSocial } from './src/social.js';
import { createFootballService, CardError } from './src/football.js';

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
const footballSerials=new Map(),footballOffers=new Map();
const lastSeen = new Map();
// Always two minutes in real deployments. A short test-only interval lets CI
// verify reconnect and eviction timing without waiting two wall-clock minutes.
const RECONNECT_GRACE_MS = process.env.NODE_ENV === 'test'
  ? Math.max(2000, Math.min(120000, Number(process.env.STAKKZ_TEST_GRACE_MS) || 120000))
  : 120000;
try { saved = JSON.parse(fs.readFileSync(DATA, 'utf8')); Object.entries(saved.parties || {}).forEach(([k, v]) => parties.set(k, v)); Object.entries(saved.accounts || {}).forEach(([k, v]) => accounts.set(k, v)); console.log('loaded', parties.size, 'parties and', accounts.size, 'accounts'); } catch (e) {}
Object.entries(saved.footballSerials||{}).forEach(([k,v])=>footballSerials.set(k,v));
Object.entries(saved.footballOffers||{}).forEach(([k,v])=>footballOffers.set(k,v));
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
const snapshot = () => ({ secret: SECRET, writer: BOOTED, parties: Object.fromEntries(parties), accounts: Object.fromEntries(accounts), auth: auth.export(),footballSerials:Object.fromEntries(footballSerials),footballOffers:Object.fromEntries(footballOffers) });
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
  add(footballSerials, remote.footballSerials,'serial:',(mine,theirs)=>Number(theirs)>Number(mine));
  add(footballOffers, remote.footballOffers,'offer:',(mine,theirs)=>Number(theirs?.acceptedAt||theirs?.createdAt||0)>Number(mine?.acceptedAt||mine?.createdAt||0));
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
/* Archived board-party records are retained for rollback; no game timers or cleanup. */

const football=createFootballService({accounts,serials:footballSerials,offers:footballOffers,
  markDirty:()=>{dirty=true;},
  resolvePlayer:code=>[...accounts.keys()].find(x=>x.slice(2,12)===code||x===code)});
const idOf = key => 'p_' + crypto.createHash('sha256').update('stakkz:' + key).digest('hex').slice(0, 24);
const account = id => { let w = accounts.get(id); if (!w) { w = core.freshWallet(); w.fresh = true; accounts.set(id, w); }
  if (!w.m1) { w.coins = (w.coins || 0) + 1000000; w.m1 = 1; dirty = true; }
  if (!w.m10) { w.coins = (w.coins || 0) + 10000000; w.m10 = 1; dirty = true; }   // one-off: 10,000,000 coins for everyone   // one-off: every player gets 1,000,000 coins for boxes
  /* Legacy e7 balance-reset migration intentionally disabled to preserve every saved balance. */
  if (core.earn(w, Date.now())) dirty = true;
  return w; };
/* Legacy board game functions are archived in legacy/server.adventure.js. */
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
process.on('uncaughtException', e => { console.error('uncaught', e && e.stack || e); });
process.on('unhandledRejection', e => { console.error('unhandled', e && e.stack || e); });
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
  if(parts[0]==='party') return send(res,410,{message:'The board game is archived in BITZ 2.0.'});
  if(parts[0]==='clan') return send(res,410,{message:'Clans are disabled in BITZ 2.0.'});
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
    const inPlaza = new Set([...plaza.values()].filter(q => q.i).map(q => q.id)), inGame = new Set(); /* Archived board games never mark players online. */
    const list = [], hidden=[]; const excluded=new Set(Array.isArray(w.hiddenFriends)?w.hiddenFriends:[]);
    auth.users.forEach(u => { const a = accounts.get(u.id); if (!a || u.id === id) return;
      const friend={f:u.id.slice(2,12),n:(a.name||u.username||'Player').slice(0,12),u:u.username,l:a.look||{},pet:a.pet||'',at:inGame.has(u.id)?'game':inPlaza.has(u.id)?'plaza':'',seen:lastSeen.get(u.id)||a.t||0,wins:a.wins||0,played:a.played||0,swag:core.swag(a),worth:core.worth(a),level:core.progressOf(a).level};
      (excluded.has(u.id)?hidden:list).push(friend); });
    list.sort((a, b) => (b.at ? 1 : 0) - (a.at ? 1 : 0) || b.seen - a.seen);
    return send(res, 200, { friends:list.slice(0,200),hidden:hidden.slice(0,200),now });
  }
  /* anyone's stuff: what a player owns, shown from their profile */
  if (parts[0] === 'inv' && req.method === 'GET') {
    const f = String(parts[1] || '').replace(/[^a-zA-Z0-9]/g, '').slice(0, 12);
    if (f.length < 6) return send(res, 400, { message: 'Who is that?' });
    let hit = null; for (const [aid, a] of accounts) { if (aid.slice(2, 12) === f) { hit = [aid, a]; break; } }
    if (!hit) return send(res, 404, { message: 'No player found.' });
    const a = hit[1], un = auth.username(hit[0]);
    return send(res, 200, { n: (a.name || un || 'Player').slice(0, 12), u: un || '', own: (a.own || []).filter(x => core.ITEMS[x]).slice(0, 2000), worth: core.worth(a), swag: core.swag(a),level:core.progressOf(a).level });
  }
  if (parts[0]==='cards' && req.method==='GET' && parts[1]==='catalogue')
    return send(res,200,football.catalogue());
  if (parts[0]==='cards' && req.method==='GET' && parts[1]==='profile'){
    const fragment=String(parts[2]||'').replace(/[^a-zA-Z0-9]/g,'').slice(0,12);
    const other=[...accounts.entries()].find(([aid])=>aid.slice(2,12)===fragment);
    if(!other)return send(res,404,{message:'Collector not found.'});
    return send(res,200,football.publicCard(other[1],other[0].slice(2,12)));
  }
  if (parts[0]==='cards' && req.method==='GET' && !parts[1])
    return send(res,200,{...football.self(w,id),gold:w.coins});
  if(parts[0]==='my-party') return send(res,200,{code:null});
  if (parts[0] === 'auth' && parts[1] === 'me' && req.method === 'GET')
    return send(res, 200, { username:auth.username(id), registered:!!auth.username(id), persistent, id });

  let b = {}; if (req.method === 'POST') { try { b = await read(req); } catch (e) { return send(res, 400, { message: 'Bad request.' }); } }
  const mine = extra => { const fresh = !!w.fresh, out = Object.assign({}, w); delete out.fresh; const bo = core.boostOf(w, now); return Object.assign({ wallet: out, seal: seal(id, out), fresh: fresh, id: id, now: now, worth: core.worth(w), rate: core.GOLD_RATE * (bo ? bo.x : 1), boost: bo ? { x: bo.x, left: bo.until - now } : null, swag: core.swag(w), progress: core.progressOf(w) }, extra); };
  const touch = () => { w.t = now; delete w.fresh; dirty = true; };
  try {
    /* Archived clan actions are never executed; saved memberships are preserved. */
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
    if(parts[0]==='cards'&&req.method==='POST'){
      const result=football.move(String(b.op||''),w,id,b);
      touch();return send(res,200,{...result,gold:w.coins,progress:core.progressOf(w)});
    }
    if (parts[0] === 'me') { if (req.method === 'POST') { core.setProfile(w, b); touch(); } return send(res, 200, mine({swag:core.swag(w)})); }
    if (parts[0] === 'restore' && req.method === 'POST') {
      // a sealed copy this server issued earlier, for an account it no longer has
      if (w.fresh && b.wallet && typeof b.seal === 'string' && b.seal === seal(id, b.wallet)) { Object.keys(w).forEach(k => delete w[k]); Object.assign(w, core.freshWallet(), b.wallet); core.setProfile(w, {}); touch(); }
      return send(res, 200, mine());
    }
    /* admin only: take any item (or all of them) for free, checked against the signed-in username, never the page */
    if (parts[0] === 'shop' && req.method === 'POST' && b.op === 'grant') {
      if (!isAdmin({ id })) return send(res, 403, { message: 'Only the admin can do that.' });
      const ids = b.item === 'all' ? Object.keys(core.ITEMS) : [String(b.item || '')]; let n = 0;
      for (const x of ids) { const it = core.ITEMS[x]; if (it && it[0] !== 'gun' && it[2] > 0 && w.own.indexOf(x) < 0) { w.own.push(x); n++; } }
      core.setProfile(w, {}); touch(); return send(res, 200, mine({ granted: n }));
    }
    if (parts[0] === 'shop' && req.method === 'POST') { const out = core.shop(w, b.op, b.item); core.setProfile(w, {}); touch(); return send(res, 200, mine(out)); }
    /* Board-party operations are disabled, not deleted from Git history. */
  } catch (e) {
    if (e instanceof CardError) return send(res, 400, {message:e.message,now});
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
/* Current social server is isolated from archived combat/trading/board code. */
const ADMINS=new Set(String(process.env.STAKKZ_ADMINS||'louis').toLowerCase().split(',').map(s=>s.trim()).filter(Boolean));
const isAdmin=q=>{const name=auth.username(q.id);return !!name&&ADMINS.has(String(name).toLowerCase());};
const plaza=mountSocial({server,wss,core,getAuth:()=>auth,account,idOf,isAdmin,markDirty:()=>{dirty=true;}});
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
      footballSerials.clear();footballOffers.clear();
      Object.entries(saved.footballSerials||{}).forEach(([k,v])=>footballSerials.set(k,v));
      Object.entries(saved.footballOffers||{}).forEach(([k,v])=>footballOffers.set(k,v));
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
