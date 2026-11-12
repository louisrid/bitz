/* BITZ app shell: boot, account, the server API, the live socket, the HUD, the menu, sheets, toasts and sound.
   Screens for cards live in cards-ui.js; the 3D world in world.js. */
(function () {
  'use strict';
  const $ = s => document.querySelector(s), esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const money = n => '$' + Math.round(Number(n) || 0).toLocaleString('en-US');
  const store = { get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }, del(k) { try { localStorage.removeItem(k); } catch (e) {} } };
  const W = globalThis.BZWORLD, A = globalThis.BZART, L = globalThis.STAKKZ_WORLD_LAYOUT;
  const BZ = { state: null, cat: null, me: null, code: '', auth: { username: null, registered: false, persistent: false }, settings: Object.assign({ sound: true, haptics: true, motion: true }, store.get('bitz-settings') || {}), online: 0, board: [], rank: null, zone: '', earner: true, idle: false };
  const reduced = () => !BZ.settings.motion || matchMedia('(prefers-reduced-motion: reduce)').matches;
  /* the guest key: made on first visit, kept in this browser. A sign-in token replaces it as the active credential. */
  const guestKey = () => Array.from(crypto.getRandomValues(new Uint8Array(24)), x => ('0' + x.toString(16)).slice(-2)).join('');
  let KEY = (() => { const k = store.get('stakkz-key'); if (typeof k === 'string' && /^[a-f0-9]{48}$/.test(k)) return k; const f = guestKey(); store.set('stakkz-key', f); return f; })();
  let token = store.get('stakkz-session'); if (typeof token !== 'string' || !/^s_[a-f0-9]{64}$/.test(token)) token = null;
  (function handoff() { const m = /^#h=([a-f0-9]{32})$/.exec(location.hash || ''); if (!m) return; try { const x = new XMLHttpRequest(); x.open('GET', 'api/handoff/' + m[1], false); x.send(); const j = JSON.parse(x.responseText || '{}'); if (j.key) { KEY = j.key; store.set('stakkz-key', KEY); } if (j.session) { token = j.session; store.set('stakkz-session', token); } } catch (e) {} history.replaceState(null, '', location.pathname); })();
  const cred = () => token || KEY;
  let skew = 0;
  async function api(path, body) {
    let r; try { r = await Promise.race([fetch('api/' + path, { method: body ? 'POST' : 'GET', headers: Object.assign({ Authorization: 'Bearer ' + cred() }, body ? { 'Content-Type': 'application/json' } : {}), body: body ? JSON.stringify(body) : undefined }), new Promise((ok, no) => setTimeout(() => no(new Error('timeout')), 15000))]); }
    catch (e) { throw { code: 'unavailable', message: 'Could not reach the server. Check your connection.' }; }
    let j = {}; try { j = await r.json(); } catch (e) {}
    if (j.now) skew = j.now - Date.now();
    if (!r.ok) throw { code: r.status === 401 ? 'auth' : r.status >= 500 || r.status === 429 ? 'unavailable' : 'refused', message: j.message || 'That did not work.', status: r.status };
    return j;
  }

  /* ---------------- sound ---------------- */
  let AC = null;
  function sound(kind) {
    if (!BZ.settings.sound) return;
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext; if (!Ctx) return; AC = AC || new Ctx(); if (AC.state === 'suspended') AC.resume();
      const t0 = AC.currentTime, seqs = {
        click: [[520, 0, 'triangle', .05, .03]], tear: [[160, 0, 'sawtooth', .08, .05], [110, .06, 'sawtooth', .1, .05], [80, .12, 'sawtooth', .14, .05]], flip: [[480, 0, 'triangle', .08, .035], [760, .05, 'triangle', .1, .03]],
        rare: [[523, 0, 'triangle', .35, .05], [659, .1, 'triangle', .35, .05], [784, .2, 'triangle', .35, .05], [1047, .3, 'triangle', .5, .05], [1568, .45, 'sine', .7, .04]],
        epic: [[392, 0, 'square', .3, .03], [523, .12, 'square', .3, .03], [659, .24, 'square', .3, .03], [784, .36, 'square', .3, .03], [1047, .5, 'triangle', .6, .05], [1319, .64, 'sine', .9, .05], [1568, .8, 'sine', 1.1, .04]],
        one: [[196, 0, 'sine', 1.2, .06], [262, .3, 'sine', 1.2, .06], [330, .6, 'sine', 1.2, .06], [392, .9, 'triangle', 1.6, .06], [784, 1.3, 'sine', 2, .05], [1568, 1.6, 'sine', 2.4, .04]],
        cash: [[988, 0, 'square', .1, .035], [1319, .07, 'square', .14, .035], [1760, .14, 'triangle', .2, .03]], pack: [[660, 0, 'triangle', .12, .04], [880, .09, 'triangle', .18, .04], [1320, .18, 'sine', .3, .04]],
        ink: [[220, 0, 'sine', .9, .02], [330, .3, 'sine', .9, .02]], no: [[200, 0, 'square', .12, .04], [150, .1, 'square', .18, .04]], level: [[523, 0, 'triangle', .2, .04], [659, .1, 'triangle', .2, .04], [784, .2, 'triangle', .2, .04], [1047, .3, 'triangle', .5, .05]]
      };
      (seqs[kind] || seqs.click).forEach(([f, d, type, len, vol]) => { const o = AC.createOscillator(), g = AC.createGain(); o.type = type; o.frequency.value = f; g.gain.setValueAtTime(0.0001, t0 + d); g.gain.exponentialRampToValueAtTime(vol, t0 + d + 0.015); g.gain.exponentialRampToValueAtTime(0.0001, t0 + d + len); o.connect(g); g.connect(AC.destination); o.start(t0 + d); o.stop(t0 + d + len + 0.05); });
    } catch (e) {}
  }
  const buzz = p => { if (BZ.settings.haptics && navigator.vibrate) try { navigator.vibrate(p); } catch (e) {} };

  /* ---------------- UI: screens, sheets, toasts ---------------- */
  const ui = $('#ui'); const stack = [];
  function paintBlocked() { W.blocked = () => stack.length > 0; document.documentElement.classList.toggle('ui-open', stack.length > 0); }
  function screen(opts) {
    const el = document.createElement('section'); el.className = 'screen ' + (opts.cls || ''); el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true');
    el.innerHTML = (opts.raw ? opts.raw : '<header class="shead">' + (opts.back ? '<button class="x" data-a="close" aria-label="Back"><svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/></svg></button>' : '') + '<h1>' + esc(opts.title || '') + '</h1>' + (opts.head || '<div class="cash"><b id="sc-cash">' + money(BZ.me ? BZ.me.coins : 0) + '</b></div>') + (opts.back ? '' : '<button class="x" data-a="close" aria-label="Close"><svg viewBox="0 0 24 24"><path d="M5 5l14 14M19 5L5 19" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round"/></svg></button>') + '</header>' + (opts.tabs || '') + '<div class="sbody">' + (opts.body || '') + '</div>' + (opts.foot ? '<footer class="sfoot">' + opts.foot + '</footer>' : ''));
    ui.appendChild(el); const rec = { el, opts, kind: 'screen' }; stack.push(rec); paintBlocked(); return el;
  }
  function sheet(html, opts) {
    opts = opts || {}; const bg = document.createElement('div'); bg.className = 'sheet-bg'; bg.dataset.a = 'close'; const el = document.createElement('div'); el.className = 'sheet'; el.setAttribute('role', 'dialog'); el.innerHTML = html;
    ui.appendChild(bg); ui.appendChild(el); requestAnimationFrame(() => el.classList.add('in')); const rec = { el, bg, opts, kind: 'sheet' }; stack.push(rec); paintBlocked(); return el;
  }
  function close(all) {
    do { const rec = stack.pop(); if (!rec) break; if (rec.opts && rec.opts.onClose) try { rec.opts.onClose(); } catch (e) {} rec.el.remove(); if (rec.bg) rec.bg.remove(); } while (all && stack.length);
    paintBlocked();
  }
  const top = () => stack[stack.length - 1];
  function toast(t, bad) { const box = $('#toasts'); const d = document.createElement('div'); d.className = 'toast' + (bad ? ' bad' : ''); d.textContent = t; box.appendChild(d); while (box.children.length > 3) box.firstChild.remove(); setTimeout(() => d.classList.add('gone'), 2600); setTimeout(() => d.remove(), 3000); if (bad) sound('no'); }
  function confirm(title, text, okLabel, danger) { return new Promise(res => { sheet('<h2>' + esc(title) + '</h2><p class="mute">' + esc(text) + '</p><div class="acts"><button class="btn" data-a="close">Not now</button><button class="btn ' + (danger ? 'ink' : 'go') + '" data-a="confirm-ok">' + esc(okLabel || 'Yes') + '</button></div>', { onClose: () => res(false) }).addEventListener('click', e => { if (e.target.closest('[data-a="confirm-ok"]')) { const rec = top(); rec.opts.onClose = null; close(); res(true); } }); }); }
  function feed(text, cls) { const f = $('#feed'); const d = document.createElement('div'); d.className = 'line ' + (cls || ''); d.textContent = text; f.appendChild(d); while (f.children.length > 3) f.firstChild.remove(); setTimeout(() => d.classList.add('out'), 4200); setTimeout(() => d.remove(), 4700); }
  ui.addEventListener('click', e => { const a = e.target.closest('[data-a]'); if (!a || a.closest('#stage')) return; if (a.dataset.a === 'close') { e.preventDefault(); close(); } });   // the opening stage closes itself
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && stack.length) { e.preventDefault(); close(); } });
  const hints = store.get('bitz-hints') || {};
  function hint(key, text) { if (hints[key]) return; hints[key] = 1; store.set('bitz-hints', hints); feed(text, 'purple'); }

  /* ---------------- HUD ---------------- */
  let shownCash = 0, cashT = null;
  function paintCash() {
    const target = Math.floor(BZ.me ? BZ.me.coins || 0 : 0), el = $('#hud-cash b'); if (!el) return;
    if (Math.abs(target - shownCash) < 2 || reduced()) { shownCash = target; el.textContent = money(target); } else { const from = shownCash, t0 = performance.now(); cancelAnimationFrame(cashT); const step = now => { const k = Math.min(1, (now - t0) / 500), v = Math.round(from + (target - from) * (1 - Math.pow(1 - k, 3))); el.textContent = money(v); if (k < 1) cashT = requestAnimationFrame(step); else shownCash = target; }; cashT = requestAnimationFrame(step); if (target > from) { const c = $('#hud-cash'); c.classList.remove('bump'); void c.offsetWidth; c.classList.add('bump'); } }
    const sc = $('#sc-cash'); if (sc) sc.textContent = money(target);
  }
  function paintLevel() { const p = BZ.state && BZ.state.progress || { level: 1, percent: 0 }; $('#hud-level').textContent = p.level; $('#hud-xp i').style.width = (p.percent || 0) + '%'; $('#hud-lvl').title = 'Level ' + p.level + ' · ' + (p.levelXp || 0) + ' / ' + (p.nextXp || 100) + ' XP'; }
  function paintZone(z, purple) { const el = $('#hud-zone'); el.className = ''; if (BZ.idle) { el.classList.add('idle'); el.innerHTML = 'Paused: move to keep earning'; return; } if (z === 'gold') { el.classList.add('gold'); el.innerHTML = '<span class="ring" style="--p:100;background:var(--gold)"></span>GOLD CIRCLE · ×3 cash'; } else if (z === 'purple') { el.classList.add('purple'); el.innerHTML = '<span class="ring" style="--p:' + Math.round((purple || 0) / (BZ.cat.econ.income.purpleEverySec) * 100) + '"></span>PURPLE CIRCLE · Red Hot pack in ' + Math.max(0, BZ.cat.econ.income.purpleEverySec - (purple || 0)) + 's'; } }
  let lastRanks = new Map();
  function paintBoard() {
    const rows = BZ.board.slice(0, 5), me = BZ.rank; const el = $('#board-mini'); if (!el) return;
    const line = r => '<div class="row' + (r.code === BZ.code ? ' me' : '') + (lastRanks.has(r.code) && lastRanks.get(r.code) > r.rank ? ' up' : '') + '"><i>' + r.rank + '</i><span>' + esc(r.name) + '</span><b>' + A.short(r.nw) + '</b></div>';
    el.innerHTML = '<h4>NET WORTH <small>' + (BZ.online ? BZ.online + ' online' : '') + '</small></h4>' + rows.map(line).join('') + (me && me.rank > 5 ? '<div class="row me"><i>' + me.rank + '</i><span>You</span><b>' + A.short(me.nw) + '</b></div>' : '');
    lastRanks = new Map(BZ.board.map(r => [r.code, r.rank]));
  }
  async function loadBoard() { try { const b = await api('board/all'); BZ.board = b.top; BZ.rank = b.me; paintBoard(); } catch (e) {} }
  function paintAct(spot) { const b = $('#btn-act'); if (!spot) { b.hidden = true; return; } const names = { seller: 'Buy packs', buyer: 'Sell cards', dealer: 'Talk to the Dealer' }; b.innerHTML = '<b>E</b> ' + names[spot.id] + ' · ' + esc(spot.who); b.hidden = false; b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop'); }
  function paintAll() { paintCash(); paintLevel(); paintBoard(); }

  /* ---------------- state ---------------- */
  async function refresh() { const s = await api('state'); applyState(s); return s; }
  function applyState(s) { BZ.state = s; if (BZ.me) BZ.me.coins = s.cash; BZ.code = s.code; paintAll(); if (globalThis.CARDS) CARDS.onState(s); }
  async function act(body) {
    const j = await api('cards', body); if (j.state) { const s = Object.assign({}, BZ.state || {}, j.state, { cash: j.cash, progress: j.progress }); applyState(s); } if (j.progress && j.progress.rewards && j.progress.rewards.length && BZ.state) { /* level ups are reported through progress on the next state */ }
    if (j.xp && j.xp.rewards && j.xp.rewards.length) { j.xp.rewards.forEach(r => { toast('Level ' + r.level + '! +' + money(r.cash) + (r.item ? ' and a new collectible' : '')); sound('level'); }); }
    return j;
  }
  function setLook(look) { if (BZ.me) { BZ.me.look = look.look || BZ.me.look; BZ.me.pet = look.pet != null ? look.pet : BZ.me.pet; BZ.me.name = look.name != null ? look.name : BZ.me.name; } W.setMe(BZ.me.look, BZ.me.name || BZ.auth.username || 'You', BZ.me.pet, colourOf(BZ.me.name || 'you')); send({ restyle: 1 }); }
  const colourOf = s => { const h = A.hash(s) % 360; return 'hsl(' + h + ', 70%, 55%)'; };

  /* ---------------- socket ---------------- */
  let ws = null, you = null, tries = 0, timer = null, sent = null, sentAt = 0;
  function send(m) { if (ws && ws.readyState === 1 && you) { try { ws.send(JSON.stringify(m)); } catch (e) {} } }
  function connect() {
    clearTimeout(timer); let s; try { s = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + location.pathname.replace(/[^/]*$/, '') + 'api/plaza/ws'); } catch (e) { timer = setTimeout(connect, 3000); return; }
    ws = s; sent = null;
    s.onopen = () => { tries = 0; const me = W.me; s.send(JSON.stringify(me ? { hello: cred(), at: [me.x, me.z, me.ry] } : { hello: cred() })); };
    s.onmessage = e => { if (e.data === 'pong') return; let d; try { d = JSON.parse(e.data); } catch (x) { return; } got(d); };
    s.onclose = () => { if (ws !== s) return; ws = null; you = null; if (!document.hidden) timer = setTimeout(connect, Math.min(10000, 800 * Math.pow(1.7, tries++))); };
    s.onerror = () => { try { s.close(); } catch (x) {} };
  }
  function got(d) {
    if (d.you) { you = d.you; W.you = d.you; BZ.earner = !!d.earner; W.clear(); (d.all || []).forEach(o => W.add(o, colourOf(o.n))); BZ.online = (d.all || []).length + 1; send({ vis: document.hidden ? 0 : 1 }); paintBoard(); return; }
    if (d.join) { W.add(d.join, colourOf(d.join.n)); BZ.online = W.others.size + 1; paintBoard(); }
    if (d.leave) { W.drop(d.leave); BZ.online = W.others.size + 1; paintBoard(); }
    if (d.s) W.snap(d.s.filter(r => r[0] !== you));
    if (d.look && d.look.i !== you) { const o = W.others.get(d.look.i); W.add(Object.assign({}, d.look, o ? { p: [o.x, o.y, o.z, o.ry, 0] } : {}), colourOf(d.look.n)); }
    if (d.emote && d.emote.i !== you) W.emote(d.emote.i, d.emote.e);
    if (d.stat) W.stat(d.stat[0], d.stat[1], d.stat[2]);
    if (d.earner != null) { BZ.earner = !!d.earner; if (!d.earner) feed('Another tab is earning for this account', 'ink'); }
    if (typeof d.cash === 'number') { if (BZ.me) BZ.me.coins = d.cash; BZ.idle = !!d.idle; paintCash(); paintZone(d.zone, d.purple); if (d.gained && d.zone === 'gold') { goldSeconds += BZ.cat.econ.income.tickMs / 1000; if (goldSeconds >= 300 && !orbiting) { orbiting = true; W.setOrbit(true); } } else if (d.zone !== 'gold') { goldSeconds = 0; if (orbiting) { orbiting = false; W.setOrbit(false); } }
      if (d.pack) { if (BZ.state) BZ.state.packs = d.packs; sound('pack'); buzz(20); feed('Purple Circle: a free RED HOT pack!', 'purple'); if (globalThis.CARDS) CARDS.onState(BZ.state); W.celebrate('purple'); hint('purple1', 'Open packs anywhere from MENU › Packs'); } }
    if (d.race) { feed('THE DEALER: ' + d.race.label, 'ink'); sound('level'); W.say('dealer', d.race.label, 8); if (globalThis.CARDS) CARDS.onRace(d.race); }
    if (d.raceWon) { feed(d.raceWon.winnerName + ' won the Dealer race!', 'gold'); if (globalThis.CARDS) CARDS.onRaceWon(d.raceWon); }
    if (d.raceOver) { if (globalThis.CARDS) CARDS.onRaceOver(d.raceOver); }
    if (d.orders && globalThis.CARDS) CARDS.onOrders(d.orders);
    if (d.pull) { d.pull.forEach(p => { const pl = A.player(p.player); feed(p.by + ' pulled a 1 OF 1 ' + (pl ? pl.name : '') + ' worth ' + money(p.v) + '!', 'gold'); }); W.flash(0xfff0b0, 1.4); W.say('dealer', 'A ONE OF ONE! Did you see that?!', 6); }
    if (d.trade) { feed(d.from + (d.trade === 'offer' ? ' sent you a trade offer' : d.trade === 'accept' ? ' accepted your trade' : ' declined your trade'), 'purple'); refresh().catch(() => {}); }
    if (d.friend) { feed(d.from + (d.friend === 'request' ? ' wants to be friends' : ' accepted your friend request'), 'purple'); refresh().catch(() => {}); }
    if (d.restyled) {}
    if (d.error) toast(d.error, true);
  }
  let goldSeconds = 0, orbiting = false;
  setInterval(() => { if (!ws || ws.readyState !== 1 || !you || !W.me) return; const p = W.pose(); if (!p) return; const now = Date.now(), moved = !sent || Math.abs(p[0] - sent[0]) + Math.abs(p[1] - sent[1]) + Math.abs(p[2] - sent[2]) > 0.02 || Math.abs(p[3] - sent[3]) > 0.03 || p[4] !== sent[4]; if (!moved && now - sentAt < 3000) return; sent = p; sentAt = now; send({ p: p.map(v => Math.round(v * 100) / 100) }); }, 100);
  setInterval(() => { if (ws && ws.readyState === 1) { try { ws.send('ping'); } catch (e) {} } }, 25000);
  setInterval(() => { if (W.lastInput && Date.now() - W.lastInput < 10000) send({ k: 1 }); }, 10000);
  document.addEventListener('visibilitychange', () => { send({ vis: document.hidden ? 0 : 1 }); if (!document.hidden) { tries = 0; if (!ws || ws.readyState > 1) connect(); refresh().catch(() => {}); loadBoard(); } });
  addEventListener('online', () => { tries = 0; if (!ws || ws.readyState > 1) connect(); });

  /* ---------------- menu ---------------- */
  const ICON = { packs: '<path d="M6 3h12l1.2 3-1.2 3 1.2 3-1.2 3 1.2 3-1.2 3H6l-1.2-3L6 15l-1.2-3L6 9 4.8 6z" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"/>', cards: '<rect x="3" y="4" width="8" height="11" rx="1.6" fill="none" stroke="currentColor" stroke-width="2.2"/><rect x="8" y="9" width="8" height="11" rx="1.6" fill="#fff" stroke="currentColor" stroke-width="2.2"/><rect x="13" y="4" width="8" height="11" rx="1.6" fill="none" stroke="currentColor" stroke-width="2.2"/>', book: '<path d="M4 5c3-1 6-1 8 1 2-2 5-2 8-1v14c-3-1-6-1-8 1-2-2-5-2-8-1z" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"/><path d="M12 6v14" stroke="currentColor" stroke-width="2.2"/>', top: '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"/>', friends: '<circle cx="9" cy="8" r="3.4" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="M3 20c0-3.5 2.7-6 6-6s6 2.5 6 6" fill="none" stroke="currentColor" stroke-width="2.2"/><circle cx="17" cy="9" r="2.6" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="M16 14c2.8 0 5 2.2 5 5" fill="none" stroke="currentColor" stroke-width="2.2"/>', trade: '<path d="M4 8h14l-4-4M20 16H6l4 4" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>', board: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>', ones: '<circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="M11 8l2-1v10" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>', ms: '<path d="M5 20V9l7-5 7 5v11z" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"/><path d="M12 11v5" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>', style: '<path d="M8 3l4 2 4-2 4 4-3 2v11H7V9L4 7z" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"/>', dealer: '<path d="M3 8l9-4 9 4-9 4z" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"/><path d="M3 8v8l9 4 9-4V8M12 12v8" fill="none" stroke="currentColor" stroke-width="2.2"/>', account: '<circle cx="12" cy="8" r="4" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7" fill="none" stroke="currentColor" stroke-width="2.2"/>', settings: '<circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>' };
  const ic = k => '<svg viewBox="0 0 24 24" aria-hidden="true">' + ICON[k] + '</svg>';
  function menu() {
    const s = BZ.state || {}, packs = Object.values(s.packs || {}).reduce((a, b) => a + b, 0), incoming = (s.trades || []).filter(t => t.status === 'pending' && t.toCode === BZ.code).length + ((s.friends || {}).in || []).length, ready = (s.milestones || []).filter(m => m.ready).length + (s.clubs || []).filter(c => c.owned >= 11 && !c.claimed).length;
    const items = [['packs', 'Packs', packs], ['cards', 'My Cards'], ['book', 'Collector Book', ready ? ready : 0], ['top', 'Top 5'], ['dealer', 'The Dealer'], ['trade', 'Trades', incoming], ['friends', 'Friends'], ['board', 'Leaderboard'], ['ones', '1 of 1 Tracker'], ['ms', 'Milestones'], ['style', 'Style & Pets'], ['account', BZ.auth.registered ? '@' + BZ.auth.username : 'Account'], ['settings', 'Settings']];
    const nw = s.nw || { total: 0, cash: 0, cards: 0, packs: 0 }, next = (s.milestones || []).find(m => !m.claimed && !m.ready);
    screen({ title: 'MENU', body: '<div class="card-box" style="margin-bottom:12px"><div class="row" style="justify-content:space-between;flex-wrap:wrap;gap:12px"><div class="stat"><small>Net worth</small><b>' + money(nw.total) + '</b></div><div class="stat"><small>Rank</small><b>' + (BZ.rank ? '#' + BZ.rank.rank : '–') + '</b></div><div class="stat"><small>Cards</small><b>' + money(nw.cards) + '</b></div><div class="stat"><small>Packs</small><b>' + money(nw.packs) + '</b></div></div>' + (next ? '<p class="mute" style="margin:8px 0 0">Next milestone at ' + money(next.at) + ': ' + Math.min(100, Math.round(nw.total / next.at * 100)) + '% there.</p>' : '') + '</div><div class="menu-grid">' + items.map(([k, n, b]) => '<button class="btn" data-m="' + k + '">' + ic(k) + '<span>' + esc(n) + '</span>' + (b ? '<i class="badge">' + b + '</i>' : '') + '</button>').join('') + '</div>' }).addEventListener('click', e => { const b = e.target.closest('[data-m]'); if (!b) return; sound('click'); const k = b.dataset.m; if (k === 'account') account(); else if (k === 'settings') settings(); else CARDS.open(k); });
  }
  function settings() {
    const row = (k, name, note) => '<div class="kv"><div><b>' + name + '</b><div class="mute" style="font-size:12px">' + note + '</div></div><button class="chip ' + (BZ.settings[k] ? 'on' : '') + '" data-s="' + k + '">' + (BZ.settings[k] ? 'On' : 'Off') + '</button></div>';
    const el = screen({ title: 'SETTINGS', back: true, body: '<div class="card-box">' + row('sound', 'Sound', 'Pack tears, flips, cash and reveals') + row('haptics', 'Vibration', 'Little taps on rare pulls (phones)') + row('motion', 'Animation', 'Turn off for a calmer, faster game') + '</div><p class="mute" style="margin-top:14px">Move with WASD or the stick, jump with Space, run with Shift, talk with E. Drag to look around, scroll or pinch to zoom.</p><p class="mute">Your player code: <b class="brand">' + esc(BZ.code) + '</b></p>' });
    el.addEventListener('click', e => { const b = e.target.closest('[data-s]'); if (!b) return; BZ.settings[b.dataset.s] = !BZ.settings[b.dataset.s]; store.set('bitz-settings', BZ.settings); b.classList.toggle('on', BZ.settings[b.dataset.s]); b.textContent = BZ.settings[b.dataset.s] ? 'On' : 'Off'; });
  }
  function account() {
    const body = BZ.auth.registered ? '<div class="card-box account"><p>Signed in as <b>' + esc(BZ.auth.username) + '</b>. Your cards, cash and friends follow you to any phone or computer.</p><p class="mute">Player code <b class="brand">' + esc(BZ.code) + '</b></p><button class="btn" data-a="signout">Sign out</button></div>'
      : '<div class="card-box account">' + (BZ.auth.persistent ? '<p>Pick a username and password so your collection follows you between devices. No email needed. Your cards and cash so far come with you.</p><form data-a="authform"><input class="t" id="au" maxlength="20" placeholder="Username" autocomplete="username"><input class="t" id="ap" type="password" minlength="3" maxlength="128" placeholder="Password (3+ characters)" autocomplete="current-password"><div class="row"><button class="btn go grow" data-a="register">Create account</button><button class="btn grow" data-a="login">Sign in</button></div></form>' : '<p>This server has no account database connected, so you play as a guest on this device.</p>') + '<p class="mute">Player code <b class="brand">' + esc(BZ.code) + '</b></p></div>';
    const el = screen({ title: 'ACCOUNT', back: true, body });
    el.addEventListener('submit', e => e.preventDefault());
    el.addEventListener('click', async e => {
      const b = e.target.closest('[data-a]'); if (!b) return; const a = b.dataset.a; if (a === 'close') return;
      e.preventDefault();
      if (a === 'signout') { try { await api('auth/logout', {}); } catch (x) {} token = null; store.del('stakkz-session'); store.del('stakkz-seal'); location.reload(); return; }
      if (a === 'register' || a === 'login') { const u = $('#au').value.trim(), p = $('#ap').value; if (!u || !p) return toast('Enter a username and password.', true); b.disabled = true;
        try { const r = await api('auth/' + a, { username: u, password: p }); token = r.token; store.set('stakkz-session', token); if (a === 'register') { KEY = guestKey(); store.set('stakkz-key', KEY); } toast('Signed in as ' + r.username + '.'); location.reload(); } catch (err) { toast(err.message, true); b.disabled = false; } }
    });
  }

  /* ---------------- boot ---------------- */
  const status = t => { const s = $('#load .status'); if (s) s.textContent = t; };
  async function boot() {
    document.documentElement.classList.toggle('touch', matchMedia('(pointer: coarse)').matches);
    status('Loading the catalogue');
    const cat = await api('catalogue'); BZ.cat = cat; A.setCatalogue(cat);
    status('Signing in');
    let me; try { me = await api('me'); } catch (e) { if (e.code === 'auth' && token) { token = null; store.del('stakkz-session'); me = await api('me'); } else throw e; }
    if (me.fresh) { const kept = store.get('stakkz-seal'); if (kept && kept.seal) { try { me = await api('restore', kept); } catch (e) {} } }
    BZ.me = me.wallet; BZ.code = me.code; BZ.auth = { username: me.username, registered: !!me.registered, persistent: !!me.persistent }; if (me.seal) store.set('stakkz-seal', { wallet: me.wallet, seal: me.seal });
    status('Entering the world');
    if (!W.init($('#gl'))) { status('This browser cannot draw 3D. Try Chrome or Safari.'); return; }
    W.setMe(BZ.me.look || {}, BZ.me.name || BZ.auth.username || 'You', BZ.me.pet || '', colourOf(BZ.me.name || 'you'));
    W.onPrompt = paintAct; W.onInteract = spot => { sound('click'); CARDS.open(spot.id); }; W.onPick = o => CARDS.profile(o.f, o.n); W.onZone = z => { BZ.zone = z; paintZone(z, 0); if (z === 'gold') { sound('cash'); hint('gold1', 'Gold Circle: cash comes in three times faster here'); } if (z === 'purple') hint('purple0', 'Purple Circle: stay 40 seconds for a free RED HOT pack'); };
    await refresh(); W.level = BZ.state.progress.level; W.on = true;
    connect(); loadBoard(); setInterval(loadBoard, 20000);
    $('#load').classList.add('out'); setTimeout(() => $('#load').remove(), 600);
    if (BZ.state.packs && BZ.state.packs.welcome) setTimeout(() => CARDS.welcome(), 400);
  }
  $('#btn-menu').addEventListener('click', () => { sound('click'); if (stack.length) close(true); else menu(); });
  $('#btn-act').addEventListener('click', () => { if (W.prompt) { sound('click'); CARDS.open(W.prompt.id); } });
  $('#board-mini').addEventListener('click', () => { sound('click'); CARDS.open('board'); });
  $('#btn-jump').addEventListener('pointerdown', e => { e.preventDefault(); W.jump(); });
  /* the touch stick */
  (function stick() { const st = $('#stick'), knob = st.querySelector('i'); let pid = null; const set = (x, y) => { const r = st.getBoundingClientRect(), R = r.width / 2; let dx = (x - r.left - R) / R, dy = (y - r.top - R) / R; const l = Math.hypot(dx, dy); if (l > 1) { dx /= l; dy /= l; } W.joy.x = dx; W.joy.y = dy; knob.style.transform = 'translate(' + (dx * R * 0.55) + 'px,' + (dy * R * 0.55) + 'px)'; };
    st.addEventListener('pointerdown', e => { e.preventDefault(); pid = e.pointerId; st.setPointerCapture(pid); set(e.clientX, e.clientY); W.touched(); }); st.addEventListener('pointermove', e => { if (e.pointerId === pid) set(e.clientX, e.clientY); }); const end = e => { if (e.pointerId !== pid) return; pid = null; W.joy.x = W.joy.y = 0; knob.style.transform = ''; }; st.addEventListener('pointerup', end); st.addEventListener('pointercancel', end); })();
  document.addEventListener('keydown', e => { if (/^(INPUT|TEXTAREA)$/.test(e.target.tagName) || stack.length) return; const m = { 1: 'wave', 2: 'dance', 3: 'cheer' }[e.key]; if (m) { W.emote('me', m); send({ emote: m }); } if (e.key.toLowerCase() === 'm') { menu(); } });
  globalThis.BZ = Object.assign(BZ, { api, act, refresh, applyState, screen, sheet, close, top, toast, confirm, feed, hint, sound, buzz, money, esc, store, setLook, colourOf, menu, reduced, send, loadBoard, paintCash, get stack() { return stack; } });
  boot().catch(e => { console.error(e); status(e.message || 'Could not start BITZ. Refresh to try again.'); const l = $('#load'); if (l) l.insertAdjacentHTML('beforeend', '<button class="btn" onclick="location.reload()">Try again</button>'); });
})();
