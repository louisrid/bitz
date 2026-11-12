/* BITZ multiplayer: who is in the world, where they stand, and the cash they earn while they play.
   One socket per account earns. Cash accrues on a server timer: x3 inside the Gold Circle, none inside the Purple Circle,
   where time turns into free Red Hot packs instead. Nothing accrues while the tab is hidden, after ten idle minutes, or offline. */
import { ECON } from './econ.js';
export function mountSocial({ wss, getAuth, account, idOf, cards, progressOf, markDirty, onEvent }) {
  const plaza = new Map(); let sequence = 0;
  const map = globalThis.STAKKZ_WORLD_LAYOUT, lim = map.limit, SPEED = map.speed;
  const clamp = n => Math.max(-lim, Math.min(lim, n));
  const send = (ws, m) => { if (ws.readyState !== 1) return; try { ws.send(typeof m === 'string' ? m : JSON.stringify(m)); } catch (e) {} };
  const all = (m, except) => { const json = JSON.stringify(m); plaza.forEach((q, ws) => { if (ws !== except && q.i) send(ws, json); }); };
  const card = q => ({ i: q.i, f: q.id.slice(2, 12), n: q.n, l: q.l, pet: q.pet, p: q.p, nw: q.nw, level: q.level });
  const spawn = () => { const a = Math.random() * Math.PI * 2, r = 2 + Math.sqrt(Math.random()) * 5; return [Math.sin(a) * r, 0, Math.cos(a) * r, 0, 0]; };
  const inCircle = (p, c) => Math.hypot(p[0] - c.x, p[2] - c.z) <= c.r;
  const zoneOf = p => inCircle(p, map.circles.gold) ? 'gold' : inCircle(p, map.circles.purple) ? 'purple' : '';
  function identity(key) {
    const auth = getAuth(), session = auth.authenticate(key);
    if (!session && !/^[a-f0-9]{48}$/.test(key)) return null;
    const id = session ? session.id : idOf(key);
    if (!session && auth.username(id)) return null;
    const w = account(id);
    return { id, n: (w.name || auth.username(id) || 'Guest').slice(0, 12), l: w.look || {}, pet: w.pet || '', nw: cards.netWorth(w).total, level: progressOf(w).level };
  }
  const earnerFor = id => { for (const q of plaza.values()) if (q.i && q.id === id && q.earner) return q; return null; };
  function receive(ws, raw) {
    const q = plaza.get(ws); if (!q) return;
    let msg; try { msg = JSON.parse(raw); } catch (e) { return; }
    if (!msg || typeof msg !== 'object' || Array.isArray(msg)) return;
    const now = Date.now();
    if (!q.i) {
      if (typeof msg.hello !== 'string') return;
      const who = identity(msg.hello);
      if (!who) { send(ws, { error: 'Sign in again to enter the world.' }); return ws.close(); }
      if ([...plaza.values()].filter(p => p.i).length >= 120) { send(ws, { error: 'The world is full right now.' }); return ws.close(); }
      const back = Array.isArray(msg.at) && msg.at.length >= 3 && msg.at.slice(0, 3).every(Number.isFinite) ? [clamp(msg.at[0]), 0, clamp(msg.at[1]), msg.at[2] % (Math.PI * 2), 0] : null;
      const other = earnerFor(who.id); if (other) { other.earner = false; send([...plaza.entries()].find(([, v]) => v === other)[0], { earner: false }); }   // the newest connection earns; older tabs watch
      Object.assign(q, who, { i: 'w' + (++sequence), p: back || spawn(), lastAt: now, lastInput: now, vis: true, earner: true, moved: false, purpleMs: 0, carry: 0, zone: '' });
      send(ws, { you: q.i, earner: true, all: [...plaza.values()].filter(o => o.i && o !== q).map(card), speed: SPEED });
      all({ join: card(q) }, ws); if (onEvent) onEvent('join', q); return;
    }
    if (Array.isArray(msg.p) && msg.p.length === 5 && msg.p.every(Number.isFinite)) {
      const np = [clamp(msg.p[0]), Math.max(0, Math.min(12, msg.p[1])), clamp(msg.p[2]), msg.p[3] % (Math.PI * 2), msg.p[4] | 0];
      const step = Math.hypot(np[0] - q.p[0], np[2] - q.p[2]), dt = Math.min(2, Math.max(.1, (now - (q.lastAt || now)) / 1000)), max = SPEED * 1.6 * dt + 2;
      if (step > max) { const k = max / step; np[0] = q.p[0] + (np[0] - q.p[0]) * k; np[2] = q.p[2] + (np[2] - q.p[2]) * k; }   // nobody moves faster than the game allows
      if (step > .02) q.lastInput = now;
      q.p = np; q.lastAt = now; q.moved = true;
    } else if (msg.vis != null) { q.vis = !!msg.vis; if (q.vis) q.lastInput = now; }
    else if (msg.k) { q.lastInput = now; }
    else if (msg.restyle) {
      const auth = getAuth(), w = account(q.id);
      Object.assign(q, { n: (w.name || auth.username(q.id) || 'Guest').slice(0, 12), l: w.look || {}, pet: w.pet || '', nw: cards.netWorth(w).total, level: progressOf(w).level });
      all({ look: card(q) });
    } else if (typeof msg.emote === 'string' && /^(wave|dance|cheer|jump)$/.test(msg.emote)) {
      if (now - (q.lastEmote || 0) < 700) return; q.lastEmote = now; q.lastInput = now;
      all({ emote: { i: q.i, e: msg.emote } });
    }
  }
  /* positions, ten times a second */
  setInterval(() => { const rows = []; plaza.forEach(q => { if (q.i && q.moved) { q.moved = false; rows.push([q.i, ...q.p.map(v => Math.round(v * 100) / 100)]); } }); if (rows.length) all({ s: rows }); }, 100).unref();
  /* cash: the only place money is created */
  setInterval(() => {
    const now = Date.now(), tick = ECON.income.tickMs;
    plaza.forEach((q, ws) => {
      if (!q.i || !q.earner) return;
      const w = account(q.id), c = cards.ensure(w), zone = zoneOf(q.p), active = q.vis && now - q.lastInput < ECON.income.idleMs;
      if (zone !== q.zone) { q.zone = zone; q.purpleMs = 0; }
      let gained = 0, pack = null;
      if (active && zone === 'purple') {
        q.purpleMs += tick;
        if (q.purpleMs >= ECON.income.purpleEverySec * 1000) { q.purpleMs -= ECON.income.purpleEverySec * 1000; c.packs[ECON.income.purplePack] = (Number(c.packs[ECON.income.purplePack]) || 0) + 1; pack = ECON.income.purplePack; markDirty(); }
      } else if (active) {
        const raw = ECON.income.perMin * tick / 60000 * (zone === 'gold' ? ECON.income.goldX : 1) + (q.carry || 0);
        gained = Math.floor(raw); q.carry = raw - gained;
        if (gained) { w.coins = Math.floor(w.coins || 0) + gained; w.stats = w.stats || {}; w.stats.earned = (w.stats.earned || 0) + gained; w.t = now; markDirty(); }
      }
      send(ws, { cash: Math.floor(w.coins || 0), gained, zone, idle: !active, purple: zone === 'purple' ? Math.round(q.purpleMs / 1000) : 0, pack, packs: pack ? c.packs : undefined });
    });
  }, ECON.income.tickMs).unref();
  /* net worth and level shown over heads, refreshed slowly */
  setInterval(() => { const seen = new Set(); plaza.forEach(q => { if (!q.i || seen.has(q.id)) return; seen.add(q.id); const w = account(q.id), nw = cards.netWorth(w).total, lv = progressOf(w).level; if (nw !== q.nw || lv !== q.level) { q.nw = nw; q.level = lv; all({ stat: [q.i, nw, lv] }); } }); }, 10000).unref();
  setInterval(() => plaza.forEach((q, ws) => { if (!ws.alive) { try { ws.terminate(); } catch (e) {} return; } ws.alive = false; try { ws.ping(); } catch (e) {} }), 15000).unref();
  function upgrade(req, socket, head) {
    let pathname; try { pathname = new URL(req.url, 'http://x').pathname; } catch (e) { return socket.destroy(); }
    if (pathname !== '/api/plaza/ws') return socket.destroy();
    wss.handleUpgrade(req, socket, head, ws => {
      plaza.set(ws, {}); let count = 0, since = Date.now(); ws.alive = true;
      ws.on('pong', () => { ws.alive = true; });
      ws.on('message', d => { const m = String(d); if (m === 'ping') return send(ws, 'pong'); const now = Date.now(); if (now - since > 1000) { count = 0; since = now; } if (++count > 40) return; try { receive(ws, m); } catch (e) { console.error('plaza', e?.stack || e); } });
      ws.on('close', () => { const q = plaza.get(ws); plaza.delete(ws); if (q?.i) { all({ leave: q.i }); if (q.earner) { const next = [...plaza.entries()].find(([, v]) => v.i && v.id === q.id); if (next) { next[1].earner = true; next[1].lastInput = Date.now(); send(next[0], { earner: true }); } } } });
      ws.on('error', () => {});
    });
  }
  const online = () => [...new Set([...plaza.values()].filter(q => q.i).map(q => q.id))];
  const posOf = id => { for (const q of plaza.values()) if (q.i && q.id === id && q.earner) return q.p; for (const q of plaza.values()) if (q.i && q.id === id) return q.p; return null; };
  const notify = (id, m) => { const json = JSON.stringify(m); plaza.forEach((q, ws) => { if (q.i && q.id === id) send(ws, json); }); };
  return { plaza, online, posOf, notify, broadcast: all, zoneOf, upgrade };
}
