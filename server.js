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
const PG_URL = process.env.STAKKZ_DATABASE_URL || '';
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
const seal = (id, w) => crypto.createHmac('sha256', SECRET).update(id + ':' + JSON.stringify(w)).digest('base64url');
/* Serialise every snapshot in write order. A slow older save cannot overwrite a
   newer one, and login/registration can explicitly await a durable write. */
async function save(force = false) {
  if (!dirty && !force) return true;
  dirty = false;
  const state = { secret: SECRET, parties: Object.fromEntries(parties), accounts: Object.fromEntries(accounts), auth: auth.export() };
  const write = async () => {
    if (pg) {
      /* Versioned compare-and-swap prevents an older process terminating
         during a zero-downtime deploy from erasing newer accounts or parties. */
      const json = JSON.stringify(state);
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
      if (!updated.length) throw Error('Database revision changed on another instance; refusing to overwrite newer saved game data.');
      dbVersion = Number(updated[0].version);
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
const account = id => { let w = accounts.get(id); if (!w) { w = core.freshWallet(); w.fresh = true; accounts.set(id, w); } return w; };
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
  if (parts[0] === 'my-party' && req.method === 'GET') {
    const found = [...parties.values()].find(s => s.phase !== 'over' && s.players.some(p => p.id === id && !p.out));
    return send(res, 200, { code:found ? found.code:null });
  }
  if (parts[0] === 'auth' && parts[1] === 'me' && req.method === 'GET')
    return send(res, 200, { username:auth.username(id), registered:!!auth.username(id), persistent, id });

  let b = {}; if (req.method === 'POST') { try { b = await read(req); } catch (e) { return send(res, 400, { message: 'Bad request.' }); } }
  const mine = extra => { const fresh = !!w.fresh, out = Object.assign({}, w); delete out.fresh; return Object.assign({ wallet: out, seal: seal(id, out), fresh: fresh, id: id, now: now }, extra); };
  const touch = () => { w.t = now; delete w.fresh; dirty = true; };
  try {
    if (parts[0] === 'me') { if (req.method === 'POST') { core.setProfile(w, b); if (b.solo) core.credit(w, b.solo, true, now); touch(); } return send(res, 200, mine()); }
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

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8' };
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
server.on('upgrade', (req, socket, head) => {
  const m = /\/api\/party\/([A-Z]{4})\/ws$/.exec(new URL(req.url, 'http://x').pathname);
  if (!m) return socket.destroy();
  wss.handleUpgrade(req, socket, head, ws => {
    const code = m[1]; let set = watchers.get(code); if (!set) watchers.set(code, set = new Set());
    if (set.size >= 40) return ws.close(1013, 'full');
    set.add(ws); ws.send(JSON.stringify({ state: parties.get(code) || null, now: Date.now() }));
    ws.on('message', d => { if (String(d) === 'ping') { try { ws.send('pong'); } catch (e) {} } });
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
      auth = new AccountAuth(saved.auth, () => {dirty=true;});
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
