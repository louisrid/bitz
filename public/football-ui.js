/* BITZ Cards: pack store, pack opening, album, collection and trading.
   One overlay, one set of components, all art from cards-art.js. The server owns every card, pack and gold change. */
(function () {
  'use strict';
  const A = window.BZART, $ = s => document.querySelector(s), esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const money = c => '$' + (Number(c || 0) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const num = n => Math.floor(Number(n) || 0).toLocaleString('en-GB');
  const GOLD_PER_CENT = 400;
  const S = { tab: 'packs', cat: null, self: null, busy: false, active: false, clubIdx: 0, sort: 'rarity', filt: 'all', friends: [], partner: '', partnerName: '', partnerCards: [], give: [], take: [], open: null, sheet: null };
  const players = new Map(), clubs = new Map();
  const cat = { player: id => players.get(id), club: id => clubs.get(id) };
  const ORDER = ['first-xi', 'electric-nights', 'derby-day', 'blackout', 'crown-glory', 'signature', 'elite-vault', 'triple-auto', 'god'];

  /* ---------------- shell ---------------- */
  const shell = document.createElement('section'); shell.id = 'fc-overlay'; shell.hidden = true; shell.setAttribute('aria-label', 'BITZ Cards');
  shell.innerHTML = '<div id="fx" role="dialog" aria-modal="true" aria-label="BITZ Cards">' +
    '<header class="fx-head"><div class="fx-brand"><b>BITZ</b><i>CARDS</i></div><div class="fx-gold"><i class="hx-coin"></i><b id="fx-gold">0</b></div><button class="fx-x" data-x="close" aria-label="Close">' + xIcon() + '</button></header>' +
    '<nav class="fx-tabs" aria-label="Cards sections">' + [['packs', 'Packs'], ['album', 'Album'], ['collection', 'Collection'], ['trade', 'Trade']].map(t => '<button data-x="tab" data-v="' + t[0] + '">' + tabIcon(t[0]) + '<span>' + t[1] + '</span><i class="fx-badge" hidden></i></button>').join('') + '</nav>' +
    '<main id="fx-main"></main></div><div id="fx-stage" hidden></div><div id="fx-sheet" hidden></div>';
  document.body.appendChild(shell);
  function xIcon() { return '<svg viewBox="0 0 24 24" width="22" height="22"><path d="M5 5l14 14M19 5L5 19" stroke="currentColor" stroke-width="3.4" stroke-linecap="round"/></svg>'; }
  function tabIcon(t) {
    const P = { packs: '<path d="M6 4h12l1 3-1 3 1 3-1 3 1 3-1 3H6l-1-3 1-3-1-3 1-3-1-3z" fill="currentColor" opacity=".25"/><path d="M6 4h12l1 3-1 3 1 3-1 3 1 3-1 3H6l-1-3 1-3-1-3 1-3-1-3z" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"/>', album: '<path d="M4 5c3-1 6-1 8 1 2-2 5-2 8-1v14c-3-1-6-1-8 1-2-2-5-2-8-1z" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"/><path d="M12 6v14" stroke="currentColor" stroke-width="2.2"/>', collection: '<rect x="3" y="4" width="8" height="11" rx="1.6" fill="none" stroke="currentColor" stroke-width="2.2"/><rect x="13" y="4" width="8" height="11" rx="1.6" fill="currentColor" opacity=".3" stroke="currentColor" stroke-width="2.2"/><rect x="8" y="10" width="8" height="11" rx="1.6" fill="#fff" stroke="currentColor" stroke-width="2.2"/>', trade: '<path d="M4 8h14l-4-4M20 16H6l4 4" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>' };
    return '<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">' + P[t] + '</svg>';
  }

  /* ---------------- data ---------------- */
  async function loadCatalog() {
    if (S.cat) return;
    const j = await api('cards/catalogue'); S.cat = j; players.clear(); clubs.clear();
    (j.players || []).forEach(p => players.set(p.id, p)); [...(j.clubs || []), ...(j.europe || [])].forEach(c => clubs.set(c.id, c));
  }
  async function sync() { await loadCatalog(); S.self = await api('cards'); paintGold(); }
  const own = () => (S.self && S.self.cards) || [];
  const packCount = id => Number(S.self && S.self.packs && S.self.packs[id] || 0);
  const pOf = c => players.get(c.player || (c.players || [])[0]) || {};
  function paintGold() { const g = $('#fx-gold'); if (g && typeof wallet !== 'undefined' && wallet) g.textContent = num(wallet.coins); if (typeof goldPaint === 'function') goldPaint(); }
  async function act(payload) {
    if (S.busy) return null; S.busy = true;
    try {
      const j = await api('cards', payload);
      if (j.state) S.self = j.state;
      if (typeof j.gold === 'number' && typeof wallet !== 'undefined' && wallet) wallet.coins = j.gold;
      if (j.progress && typeof levelSync === 'function') levelSync(j.progress);
      paintGold(); return j;
    } catch (e) { say(e.message || 'That did not work. Try again.'); return null; }
    finally { S.busy = false; }
  }
  function say(t) { if (typeof toast === 'function') toast(t); }

  /* ---------------- sound ---------------- */
  function sound(kind) {
    try {
      const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
      const a = window.__BZ_AUDIO || (window.__BZ_AUDIO = new AC()); if (a.state === 'suspended') a.resume();
      const t0 = a.currentTime, seq = { tear: [[180, .0, 'sawtooth'], [120, .05, 'sawtooth'], [90, .1, 'sawtooth']], flip: [[520, 0, 'triangle'], [780, .05, 'triangle']], rare: [[523, 0, 'triangle'], [659, .1, 'triangle'], [784, .2, 'triangle'], [1047, .3, 'triangle'], [1568, .42, 'sine']], epic: [[392, 0, 'square'], [523, .12, 'square'], [659, .24, 'square'], [784, .36, 'square'], [1047, .5, 'triangle'], [1319, .62, 'sine']], coin: [[988, 0, 'square'], [1319, .07, 'square']], tap: [[300, 0, 'triangle']] }[kind] || [[400, 0, 'triangle']];
      seq.forEach(([f, d, type]) => { const o = a.createOscillator(), g = a.createGain(); o.type = type; o.frequency.value = f; g.gain.setValueAtTime(0.0001, t0 + d); g.gain.exponentialRampToValueAtTime(kind === 'tear' ? 0.05 : 0.04, t0 + d + 0.015); g.gain.exponentialRampToValueAtTime(0.0001, t0 + d + (kind === 'epic' || kind === 'rare' ? 0.35 : 0.16)); o.connect(g); g.connect(a.destination); o.start(t0 + d); o.stop(t0 + d + 0.4); });
    } catch (e) { }
  }

  /* ---------------- render ---------------- */
  function render() {
    if (!S.active) return;
    shell.querySelectorAll('.fx-tabs button').forEach(b => b.classList.toggle('on', b.dataset.v === S.tab));
    const tb = shell.querySelector('.fx-tabs [data-v=trade] .fx-badge'), incoming = (S.self && S.self.trades || []).filter(t => t.status === 'pending' && t.toId && String(t.toId).slice(2, 12) === myCode()).length;
    if (tb) { tb.hidden = !incoming; tb.textContent = incoming; }
    const pb = shell.querySelector('.fx-tabs [data-v=packs] .fx-badge'), unopened = ORDER.reduce((s, id) => s + packCount(id), 0);
    if (pb) { pb.hidden = !unopened; pb.textContent = unopened; }
    const m = $('#fx-main'); if (!m) return;
    m.innerHTML = S.tab === 'packs' ? packsView() : S.tab === 'album' ? albumView() : S.tab === 'collection' ? collectionView() : tradeView();
    m.dataset.tab = S.tab;
  }
  const myCode = () => String(typeof myId !== 'undefined' && myId || '').slice(2, 12);

  /* ---------- packs ---------- */
  function packsView() {
    const P = S.cat.packs, mine = ORDER.filter(id => packCount(id) > 0);
    const shelf = mine.length ? '<section class="fx-sec"><h2>Ready to open</h2><div class="fx-shelf">' + mine.map(id => '<button class="fx-mypack" data-x="open" data-v="' + id + '">' + A.packArt(id, packCount(id)) + '<span class="fx-btn fx-go">Open</span></button>').join('') + '</div></section>' : '';
    const obj = S.self.objective || {};
    const store = '<section class="fx-sec"><h2>Pack store</h2><div class="fx-store">' + ORDER.map(id => {
      const p = P[id]; if (!p) return '';
      const god = p.questOnly;
      return '<article class="fx-pack' + (god ? ' fx-god' : '') + '">' + A.packArt(id) +
        '<div class="fx-pinfo"><b>' + esc(p.name) + '</b><span>' + p.cards + ' cards' + (p.guaranteed ? ' · ' + (p.guaranteed.signature ? p.guaranteed.signature + ' signature' + (p.guaranteed.signature > 1 ? 's' : '') : '1 Legendary+') : '') + '</span></div>' +
        (god ? '<p class="fx-quest">' + esc(obj.label || 'Complete a trading objective') + '</p>' : '<button class="fx-btn fx-buy" data-x="buy" data-v="' + id + '"><i class="hx-coin"></i>' + num(p.cost) + '</button>') +
        '<button class="fx-link" data-x="odds" data-v="' + id + '">Odds</button></article>';
    }).join('') + '</div></section>';
    return shelf + store;
  }
  function oddsSheet(id) {
    const p = S.cat.packs[id], tot = Object.values(p.odds).reduce((s, x) => s + x, 0);
    sheet('<h3>' + esc(p.name) + '</h3><div class="fx-odds">' + Object.entries(p.odds).sort((a, b) => A.rank(a[0]) - A.rank(b[0])).map(([v, w]) => '<div><span class="fx-rdot ' + A.RARITY[v][1] + '"></span><b>' + esc(A.RARITY[v][0]) + '</b><em>' + (w / tot * 100).toFixed(w / tot < 0.001 ? 3 : w / tot < 0.01 ? 2 : 1) + '%</em></div>').join('') + '</div><p class="fx-fine">Per card. ' + (p.guaranteed ? 'Guarantee applied on the last card if needed.' : '') + '</p><button class="fx-btn" data-x="sheetclose">Got it</button>');
  }

  /* ---------- album: a flipbook, one club per spread ---------- */
  function albumView() {
    const list = S.self.album || [], i = Math.max(0, Math.min(list.length - 1, S.clubIdx)), a = list[i]; if (!a) return '';
    const club = clubs.get(a.id), ownedIds = new Set(own().flatMap(c => c.players || [c.player]));
    const squad = [...players.values()].filter(p => p.club === a.id).sort((x, y) => x.slot - y.slot);
    const best = id => own().filter(c => (c.players || [c.player]).includes(id)).sort((x, y) => A.rank(y.variant) - A.rank(x.variant))[0];
    const done = list.filter(x => x.owned >= x.slots).length;
    const index = '<div class="fx-crests">' + list.map((x, k) => '<button class="' + (k === i ? 'on ' : '') + (x.owned >= x.slots ? 'full' : '') + '" data-x="club" data-v="' + k + '" aria-label="' + esc(clubs.get(x.id).name) + '">' + A.crest(clubs.get(x.id), 30) + '<i style="--p:' + Math.round(x.owned / x.slots * 100) + '%"></i></button>').join('') + '</div>';
    const slots = squad.map(p => {
      const c = best(p.id);
      return '<div class="fx-slot' + (c ? ' got' : '') + '">' + (c ? A.card(c, cat, { cls: 'mini', attrs: ' data-x="detail"' }) : '<div class="fx-empty-slot"><b>' + p.num + '</b><span>' + esc(p.pos) + '</span><small>' + esc(p.name) + '</small></div>') + '</div>';
    }).join('');
    return index + '<div class="fx-book' + (S.turn ? ' turn-' + S.turn : '') + '"><div class="fx-page fx-left">' + A.crest(club, 110) + '<h2>' + esc(club.name) + '</h2><p class="fx-div">' + esc(club.division || '') + '</p>' +
      '<div class="fx-prog"><i style="width:' + (a.owned / a.slots * 100) + '%"></i></div><p class="fx-count"><b>' + a.owned + '</b> / ' + a.slots + ' players</p>' +
      (a.claimed ? '<p class="fx-claimed">Reward claimed</p>' : a.owned >= a.slots ? '<button class="fx-btn fx-go" data-x="claim" data-v="' + a.id + '">Claim Elite Vault + 1,000,000</button>' : '<p class="fx-fine">Collect all 11 to claim an Elite Vault and 1,000,000 gold.</p>') +
      '<div class="fx-turns"><button class="fx-btn" data-x="clubmove" data-v="-1" aria-label="Previous club">‹</button><span>' + (i + 1) + ' / ' + list.length + ' · ' + done + ' complete</span><button class="fx-btn" data-x="clubmove" data-v="1" aria-label="Next club">›</button></div></div>' +
      '<div class="fx-page fx-right"><div class="fx-slots">' + slots + '</div></div></div>';
  }

  /* ---------- collection ---------- */
  function collectionView() {
    let list = own().slice();
    if (S.filt === 'sig') list = list.filter(c => /signature|Ink|dual/.test(c.variant));
    else if (S.filt === 'num') list = list.filter(c => c.serial);
    else if (S.filt === 'fav') list = list.filter(c => (S.self.favorites || []).includes(c.uid));
    else if (S.filt === 'rare') list = list.filter(c => A.rank(c.variant) >= 4);
    const sorters = { rarity: (a, b) => A.rank(b.variant) - A.rank(a.variant) || (pOf(b).rating || 0) - (pOf(a).rating || 0), rating: (a, b) => (pOf(b).rating || 0) - (pOf(a).rating || 0), newest: (a, b) => (b.createdAt || 0) - (a.createdAt || 0), value: (a, b) => (b.valueCents || 0) - (a.valueCents || 0) };
    list.sort(sorters[S.sort] || sorters.rarity);
    const favs = new Set(S.self.favorites || []);
    const chips = (k, arr) => '<div class="fx-chips">' + arr.map(x => '<button class="' + (S[k] === x[0] ? 'on' : '') + '" data-x="' + k + '" data-v="' + x[0] + '">' + x[1] + '</button>').join('') + '</div>';
    return '<div class="fx-collhead"><div><b>' + own().length + '</b> cards · <b>' + money(S.self.virtualValueCents) + '</b> value</div>' +
      chips('filt', [['all', 'All'], ['rare', 'Holo+'], ['sig', 'Signed'], ['num', 'Numbered'], ['fav', 'Showcase']]) + chips('sort', [['rarity', 'Rarity'], ['rating', 'Rating'], ['newest', 'Newest'], ['value', 'Value']]) + '</div>' +
      (list.length ? '<div class="fx-grid">' + list.map(c => '<div class="fx-cell">' + A.card(c, cat, { cls: 'mid', attrs: ' data-x="detail"' }) + (favs.has(c.uid) ? '<i class="fx-star" title="In your showcase">★</i>' : '') + '</div>').join('') + '</div>'
        : '<div class="fx-none"><b>No cards here yet</b><span>Open a pack to start your collection.</span><button class="fx-btn fx-go" data-x="tab" data-v="packs">Go to packs</button></div>');
  }
  function detailSheet(uid) {
    const c = own().find(x => x.uid === uid) || (S.partnerCards || []).find(x => x.uid === uid); if (!c) return;
    const mine = own().some(x => x.uid === uid), p = pOf(c), club = clubs.get(p.club), fav = (S.self.favorites || []).includes(uid);
    sheet('<div class="fx-detail"><div class="fx-big">' + A.card(c, cat, { cls: 'big tilt' }) + '</div><div class="fx-facts"><h3>' + esc(p.name) + '</h3>' +
      '<p class="fx-meta">' + A.flag(p.nation, 22) + ' ' + esc(A.NATION[p.nation] || '') + ' · ' + esc(p.pos) + ' · #' + p.num + '</p><p class="fx-meta">' + A.crest(club, 20) + ' ' + esc(club ? club.name : '') + '</p>' +
      '<dl><dt>Rarity</dt><dd>' + esc(A.RARITY[c.variant][0]) + '</dd><dt>Rating</dt><dd>' + (p.rating || '') + '</dd><dt>Value</dt><dd>' + money(c.valueCents) + '</dd>' + (c.serial ? '<dt>Serial</dt><dd>' + c.serial + ' of ' + c.serialMax + '</dd>' : '') + '<dt>From</dt><dd>' + esc((S.cat.packs[c.pack] || {}).name || '') + '</dd></dl>' +
      (mine ? '<div class="fx-acts"><button class="fx-btn" data-x="fav" data-uid="' + esc(uid) + '">' + (fav ? 'Remove from showcase' : 'Add to showcase') + '</button><button class="fx-btn fx-sell" data-x="sellask" data-uid="' + esc(uid) + '">Quick-sell</button></div>' : '') +
      '<button class="fx-link" data-x="sheetclose">Close</button></div></div>');
  }
  function sellSheet(uid) {
    const c = own().find(x => x.uid === uid); if (!c) return;
    const gold = (Number(c.valueCents) || 50) * GOLD_PER_CENT, rare = A.rank(c.variant) >= 5;
    sheet('<div class="fx-sellbox"><div class="fx-big">' + A.card(c, cat, { cls: 'big' }) + '</div><div class="fx-sellside"><h3>Quick-sell</h3><p class="fx-gain"><i class="hx-coin"></i>+' + num(gold) + '</p>' +
      (rare ? '<p class="fx-warn">This is a ' + esc(A.RARITY[c.variant][0]) + ' card. It is gone for good once sold.</p>' : '<p class="fx-fine">The card leaves your collection.</p>') +
      '<div class="fx-acts"><button class="fx-btn" data-x="sheetclose">Keep it</button><button class="fx-btn fx-sell" data-x="sell" data-uid="' + esc(uid) + '">Sell for ' + num(gold) + '</button></div></div></div>');
  }

  /* ---------- trading ---------- */
  function tradeView() {
    const obj = S.self.objective || {}, trades = S.self.trades || [], me = myCode();
    const friendList = S.friends.length ? S.friends.map(f => { const code = String(f.id || f.f || '').slice(0, 10); return '<button class="fx-friend' + (S.partner === code ? ' on' : '') + '" data-x="partner" data-v="' + esc(code) + '" data-n="' + esc(f.n || f.name || 'Player') + '"><i style="--h:' + (A.hash(code) % 360) + '">' + esc(String(f.n || f.name || 'P')[0]).toUpperCase() + '</i><span>' + esc(f.n || f.name || 'Player') + '</span></button>'; }).join('') : '<p class="fx-fine">Add friends from the Menu to trade with them, or enter a player code.</p>';
    const pick = (list, sel, k) => '<div class="fx-pick">' + (list.length ? list.slice().sort((a, b) => A.rank(b.variant) - A.rank(a.variant)).map(c => '<button class="fx-pc' + (sel.includes(c.uid) ? ' on' : '') + '" data-x="' + k + '" data-uid="' + esc(c.uid) + '">' + A.card(c, cat, { cls: 'mini' }) + '</button>').join('') : '<p class="fx-fine">No cards.</p>') + '</div>';
    const side = (title, ids, list) => { const cs = ids.map(u => list.find(c => c.uid === u)).filter(Boolean); return '<div class="fx-side"><h4>' + title + ' <em>' + money(cs.reduce((s, c) => s + (c.valueCents || 0), 0)) + '</em></h4><div class="fx-lineup">' + (cs.length ? cs.map(c => A.card(c, cat, { cls: 'mid' })).join('') : '<div class="fx-placeholder">Tap cards below</div>') + '</div></div>'; };
    const builder = S.partner ? '<section class="fx-sec fx-builder"><h2>Trade with ' + esc(S.partnerName) + '</h2><div class="fx-sides">' + side('You give', S.give, own()) + '<div class="fx-swap">⇄</div>' + side('You get', S.take, S.partnerCards) + '</div>' +
      '<div class="fx-pickers"><div><h4>Your cards</h4>' + pick(own(), S.give, 'give') + '</div><div><h4>' + esc(S.partnerName) + '’s cards</h4>' + pick(S.partnerCards, S.take, 'take') + '</div></div>' +
      '<button class="fx-btn fx-go fx-wide" data-x="review"' + (S.give.length || S.take.length ? '' : ' disabled') + '>Review offer</button></section>' : '';
    const status = t => t.status === 'pending' ? (String(t.toId).slice(2, 12) === me ? 'Waiting for you' : 'Waiting for them') : t.status === 'accepted' ? 'Done' : t.status === 'declined' ? 'Declined' : 'Expired';
    const inbox = trades.length ? trades.slice(0, 20).map(t => {
      const incoming = String(t.toId).slice(2, 12) === me, giveCards = t.fromCards.length, getCards = t.toCards.length;
      return '<div class="fx-offer st-' + t.status + '"><div><b>' + esc(incoming ? t.fromName : t.toName) + '</b><span>' + (incoming ? 'Offers ' + giveCards + ' for ' + getCards + ' of yours' : 'You offered ' + giveCards + ' for ' + getCards) + '</span></div><em class="fx-st">' + status(t) + '</em>' +
        (t.status === 'pending' ? (incoming ? '<button class="fx-btn fx-go" data-x="viewoffer" data-v="' + esc(t.id) + '">Review</button>' : '<button class="fx-btn" data-x="decline" data-v="' + esc(t.id) + '">Cancel</button>') : '') + '</div>';
    }).join('') : '<p class="fx-fine">No offers yet.</p>';
    return '<section class="fx-sec fx-goal"><div>' + A.packArt('god') + '</div><div><h2>God Pack objective</h2><p>' + esc(obj.label || '') + '</p><p class="fx-fine">Complete it in a trade to earn a God Pack and 500,000 gold.</p></div></section>' +
      '<section class="fx-sec"><h2>Choose a player</h2><div class="fx-friends">' + friendList + '</div><form class="fx-code" data-x="codeform"><input id="fx-codein" placeholder="Player code" maxlength="10" autocomplete="off"><button class="fx-btn">Find</button></form></section>' +
      builder + '<section class="fx-sec"><h2>Offers</h2><div class="fx-inbox">' + inbox + '</div></section>';
  }
  function reviewSheet() {
    const g = S.give.map(u => own().find(c => c.uid === u)).filter(Boolean), t = S.take.map(u => S.partnerCards.find(c => c.uid === u)).filter(Boolean);
    const val = l => money(l.reduce((s, c) => s + (c.valueCents || 0), 0));
    sheet('<h3>Send this offer to ' + esc(S.partnerName) + '?</h3><div class="fx-review"><div><h4>You give · ' + val(g) + '</h4><div class="fx-lineup">' + (g.map(c => A.card(c, cat, { cls: 'mid' })).join('') || '<div class="fx-placeholder">Nothing</div>') + '</div></div><div><h4>You get · ' + val(t) + '</h4><div class="fx-lineup">' + (t.map(c => A.card(c, cat, { cls: 'mid' })).join('') || '<div class="fx-placeholder">Nothing</div>') + '</div></div></div>' +
      '<p class="fx-fine">Your cards are held until they answer, cancel or 24 hours pass.</p><div class="fx-acts"><button class="fx-btn" data-x="sheetclose">Back</button><button class="fx-btn fx-go" data-x="send">Send offer</button></div>');
  }
  async function offerSheet(id) {
    const t = (S.self.trades || []).find(x => x.id === id); if (!t) return;
    let theirs = [];
    try { const r = await api('cards/inventory/' + encodeURIComponent(String(t.fromId).slice(2, 12))); theirs = r.cards || []; } catch (e) { }
    const g = t.toCards.map(u => own().find(c => c.uid === u)).filter(Boolean), r = t.fromCards.map(u => theirs.find(c => c.uid === u)).filter(Boolean);
    const val = l => money(l.reduce((s, c) => s + (c.valueCents || 0), 0));
    sheet('<h3>' + esc(t.fromName) + ' wants to trade</h3><div class="fx-review"><div><h4>You get · ' + val(r) + '</h4><div class="fx-lineup">' + (r.map(c => A.card(c, cat, { cls: 'mid' })).join('') || '<div class="fx-placeholder">Nothing</div>') + '</div></div><div><h4>You give · ' + val(g) + '</h4><div class="fx-lineup">' + (g.map(c => A.card(c, cat, { cls: 'mid' })).join('') || '<div class="fx-placeholder">Nothing</div>') + '</div></div></div>' +
      '<div class="fx-acts"><button class="fx-btn" data-x="decline" data-v="' + esc(id) + '">Decline</button><button class="fx-btn fx-go" data-x="accept" data-v="' + esc(id) + '">Accept trade</button></div>');
  }

  /* ---------------- sheet (BITZ pop-up inside the cards app) ---------------- */
  function sheet(html) { const s = $('#fx-sheet'); s.innerHTML = '<div class="fx-sheet-bg" data-x="sheetclose"></div><div class="fx-sheet-card" role="dialog" aria-modal="true">' + html + '</div>'; s.hidden = false; requestAnimationFrame(() => s.classList.add('in')); S.sheet = true; }
  function sheetClose() { const s = $('#fx-sheet'); s.classList.remove('in'); S.sheet = false; setTimeout(() => { if (!S.sheet) { s.hidden = true; s.innerHTML = ''; } }, 180); }

  /* ---------------- pack opening ---------------- */
  function stage(html) { const s = $('#fx-stage'); s.innerHTML = html; s.hidden = false; }
  function openPack(id) {
    S.open = { pack: id, phase: 'sealed', i: 0, cards: [] };
    stage('<div class="op-bg pk-' + esc(id) + '"></div><button class="op-x" data-x="opclose" aria-label="Close">' + xIcon() + '</button>' +
      '<div class="op-pack" id="op-pack">' + A.packArt(id) + '<div class="op-strip">' + A.packArt(id) + '</div></div><p class="op-hint">Swipe across the top, or tap to tear</p>');
    sound('tap');
  }
  async function tear() {
    const o = S.open; if (!o || o.phase !== 'sealed') return; o.phase = 'tearing';
    const pk = $('#op-pack'); if (pk) pk.classList.add('torn'); sound('tear'); if (navigator.vibrate) navigator.vibrate(18);
    const hint = $('.op-hint'); if (hint) hint.textContent = '';
    const [j] = await Promise.all([act({ op: 'open', pack: o.pack }), new Promise(r => setTimeout(r, 650))]);
    if (S.open !== o) return;
    if (!j) { closeStage(); return; }
    o.cards = j.cards; o.bonus = j.bonusGold || 0; o.disc = new Set(j.discovered || []); o.phase = 'reveal'; o.i = 0;
    const best = Math.max(...o.cards.map(c => A.rank(c.variant)));
    $('#fx-stage').insertAdjacentHTML('beforeend', '<div class="op-deck" id="op-deck">' + o.cards.map((c, k) => '<div class="op-card" data-k="' + k + '" style="--k:' + k + '"><div class="op-flip"><div class="op-back"><b>BITZ</b><i></i></div><div class="op-front">' + A.card(c, cat, { cls: 'big tilt' }) + '</div></div></div>').join('') + '</div>' +
      '<div class="op-ui"><span class="op-n" id="op-n"></span><button class="fx-btn" data-x="skip">Skip</button></div>' + (best >= 5 ? '<div class="op-tease r' + best + '"></div>' : ''));
    if (pk) setTimeout(() => pk.classList.add('gone'), 60);
    setTimeout(() => reveal(0), 420);
  }
  function reveal(k) {
    const o = S.open; if (!o || o.phase !== 'reveal') return;
    const el = document.querySelector('.op-card[data-k="' + k + '"]'), c = o.cards[k]; if (!el || !c) return;
    o.i = k; o.lock = true; el.classList.add('top');
    const r = A.rank(c.variant), wait = r >= 7 ? 1100 : r >= 5 ? 700 : 0;
    const n = $('#op-n'); if (n) n.textContent = (k + 1) + ' / ' + o.cards.length;
    if (wait) { el.classList.add('suspense', 'r' + r); if (navigator.vibrate) navigator.vibrate([20, 60, 20]); }
    setTimeout(() => {
      if (S.open !== o) return;
      el.classList.add('flipped'); el.classList.remove('suspense');
      const stageEl = $('#fx-stage');
      if (r >= 5) { stageEl.insertAdjacentHTML('beforeend', '<div class="op-burst r' + r + '"></div>' + confetti(r)); setTimeout(() => stageEl.querySelectorAll('.op-burst,.op-conf').forEach(x => x.remove()), 2200); sound(r >= 7 ? 'epic' : 'rare'); }
      else sound('flip');
      if (o.disc.has((c.players || [c.player])[0])) el.insertAdjacentHTML('beforeend', '<i class="op-new">NEW +15,000</i>');
      setTimeout(() => { o.lock = false; }, 260);
    }, wait);
  }
  function nextCard(dir) {
    const o = S.open; if (!o) return;
    if (o.phase === 'sealed') { tear(); return; }
    if (o.phase !== 'reveal' || o.lock) return;
    const el = document.querySelector('.op-card[data-k="' + o.i + '"]');
    if (el) { el.classList.add(dir === 'left' ? 'out-l' : 'out-r'); el.classList.remove('top'); }
    if (o.i >= o.cards.length - 1) { setTimeout(summary, 280); return; }
    reveal(o.i + 1);
  }
  function confetti(r) { const cols = r >= 8 ? ['#fff', '#ffe27a', '#ff8bd8', '#7df9ff', '#a77bff'] : r >= 7 ? ['#ffe27a', '#ffbf1f', '#fff'] : ['#a77bff', '#d6c8ff', '#fff']; return '<div class="op-conf">' + Array.from({ length: 36 }, (_, i) => '<i style="--x:' + (Math.random() * 100).toFixed(1) + '%;--d:' + (Math.random() * 0.5).toFixed(2) + 's;--r:' + Math.floor(Math.random() * 360) + 'deg;background:' + cols[i % cols.length] + '"></i>').join('') + '</div>'; }
  function summary() {
    const o = S.open; if (!o) return; o.phase = 'summary';
    const val = o.cards.reduce((s, c) => s + (c.valueCents || 0), 0), more = packCount(o.pack);
    stage('<div class="op-bg pk-' + esc(o.pack) + '"></div><div class="op-sum"><h2>Pack opened</h2><div class="op-sumgrid">' + o.cards.map(c => '<div class="op-sumcell">' + A.card(c, cat, { cls: 'mid', attrs: ' data-x="detail"' }) + (o.disc.has((c.players || [c.player])[0]) ? '<i class="op-new">NEW</i>' : '') + '</div>').join('') + '</div>' +
      '<div class="op-totals"><span><small>Value</small><b>' + money(val) + '</b></span>' + (o.bonus ? '<span><small>Bonus gold</small><b class="g"><i class="hx-coin"></i>+' + num(o.bonus) + '</b></span>' : '') + '</div>' +
      '<div class="fx-acts">' + (more ? '<button class="fx-btn fx-go" data-x="open" data-v="' + esc(o.pack) + '">Open another (' + more + ')</button>' : '') + '<button class="fx-btn" data-x="opcollection">See collection</button><button class="fx-btn" data-x="opclose">Done</button></div></div>');
  }
  function skip() { const o = S.open; if (!o || o.phase !== 'reveal') return; summary(); }
  function closeStage() { S.open = null; const s = $('#fx-stage'); s.hidden = true; s.innerHTML = ''; render(); }

  /* ---------------- open / close ---------------- */
  async function show(tab) {
    if (typeof modal !== 'undefined' && modal && typeof closeModal === 'function') closeModal();
    if (typeof profileClose === 'function') profileClose();
    S.tab = tab || 'packs'; S.active = true; shell.hidden = false; document.documentElement.classList.add('fx-open');
    $('#fx-main').innerHTML = '<div class="fx-wait"><i></i><span>Loading your cards</span></div>';
    try { await sync(); render(); if (S.tab === 'trade') loadFriends(); }
    catch (e) { $('#fx-main').innerHTML = '<div class="fx-none"><b>Could not load your cards</b><span>' + esc(e.message || 'Try again.') + '</span><button class="fx-btn" data-x="retry">Try again</button></div>'; }
  }
  function hide() { if (S.open && S.open.phase === 'tearing') return; S.active = false; S.open = null; shell.hidden = true; $('#fx-stage').hidden = true; $('#fx-stage').innerHTML = ''; sheetClose(); document.documentElement.classList.remove('fx-open'); }
  async function loadFriends() { try { const f = await api('friends'); S.friends = [...(f.friends || []), ...(f.hidden || [])]; if (S.tab === 'trade') render(); } catch (e) { } }
  async function choosePartner(code, name) {
    S.partner = code; S.partnerName = name || 'Player'; S.give = []; S.take = []; S.partnerCards = [];
    try { const r = await api('cards/inventory/' + encodeURIComponent(code)); S.partnerCards = r.cards || []; if (r.name) S.partnerName = r.name; } catch (e) { say(e.message || 'Could not load their cards.'); S.partner = ''; }
    render();
  }

  /* ---------------- input ---------------- */
  async function handle(x, el) {
    const v = el.dataset.v, uid = el.dataset.uid || (el.closest('[data-uid]') || {}).dataset && el.closest('[data-uid]').dataset.uid;
    switch (x) {
      case 'close': hide(); break;
      case 'retry': show(S.tab); break;
      case 'tab': S.tab = v; render(); if (v === 'trade') loadFriends(); $('#fx-main').scrollTop = 0; break;
      case 'buy': { const j = await act({ op: 'buy', pack: v }); if (j) { sound('coin'); render(); openPack(v); } break; }
      case 'open': if (packCount(v) > 0) openPack(v); break;
      case 'odds': oddsSheet(v); break;
      case 'club': S.turn = Number(v) > S.clubIdx ? 'next' : 'prev'; S.clubIdx = Number(v); render(); setTimeout(() => { S.turn = null; }, 400); break;
      case 'clubmove': { const n = (S.self.album || []).length; S.turn = Number(v) > 0 ? 'next' : 'prev'; S.clubIdx = (S.clubIdx + Number(v) + n) % n; render(); setTimeout(() => { S.turn = null; }, 400); break; }
      case 'claim': { const j = await act({ op: 'claim', club: v }); if (j) { sound('epic'); say('Club complete! Elite Vault and 1,000,000 gold added.'); render(); } break; }
      case 'filt': S.filt = v; render(); break;
      case 'sort': S.sort = v; render(); break;
      case 'detail': if (uid) detailSheet(uid); break;
      case 'fav': { const ids = [...(S.self.favorites || [])], k = ids.indexOf(uid); if (k >= 0) ids.splice(k, 1); else if (ids.length < 5) ids.push(uid); else { say('Your showcase holds 5 cards. Remove one first.'); break; } const j = await act({ op: 'favorites', cards: ids }); if (j) { sheetClose(); render(); } break; }
      case 'sellask': sellSheet(uid); break;
      case 'sell': { const c = own().find(q => q.uid === uid), j = await act({ op: 'sell', uid }); if (j) { sound('coin'); sheetClose(); say('Sold for ' + num(j.sold ? (j.sold.valueCents || 50) * GOLD_PER_CENT : 0) + ' gold.'); render(); } break; }
      case 'sheetclose': sheetClose(); break;
      case 'partner': choosePartner(v, el.dataset.n); break;
      case 'give': case 'take': { const l = x === 'give' ? S.give : S.take, k = l.indexOf(uid); if (k >= 0) l.splice(k, 1); else if (l.length < 10) l.push(uid); render(); break; }
      case 'review': reviewSheet(); break;
      case 'send': { const j = await act({ op: 'offer', to: S.partner, give: S.give, take: S.take }); if (j) { sheetClose(); say('Offer sent to ' + S.partnerName + '.'); S.give = []; S.take = []; render(); } break; }
      case 'viewoffer': offerSheet(v); break;
      case 'accept': { const j = await act({ op: 'accept', trade: v }); if (j) { sheetClose(); if (j.rewarded && j.rewarded.some(Boolean)) { sound('epic'); say('Objective complete: God Pack and 500,000 gold!'); } else { sound('rare'); say('Trade complete.'); } render(); } break; }
      case 'decline': { const j = await act({ op: 'decline', trade: v }); if (j) { sheetClose(); render(); } break; }
      case 'skip': skip(); break;
      case 'opclose': closeStage(); break;
      case 'opcollection': closeStage(); S.tab = 'collection'; S.sort = 'newest'; render(); break;
    }
  }
  shell.addEventListener('click', e => {
    const el = e.target.closest('[data-x]');
    if (S.open && !e.target.closest('.op-x,.op-ui,.op-sum,#fx-sheet')) {   // anywhere on the opening stage moves on
      if (swiped) { swiped = false; return; }
      e.preventDefault(); nextCard(); return;
    }
    if (!el || el.tagName === 'FORM') return;
    e.preventDefault(); handle(el.dataset.x, el);
  });
  shell.addEventListener('submit', e => { if (e.target.matches('.fx-code')) { e.preventDefault(); const v = ($('#fx-codein').value || '').trim().replace(/[^a-f0-9]/gi, '').slice(0, 10); if (v.length === 10) choosePartner(v.toLowerCase(), 'Player'); else say('A player code has 10 characters.'); } });
  /* swipes: across the sealed pack tears it; left or right on a revealed card moves on */
  let down = null, swiped = false;
  shell.addEventListener('pointerdown', e => { if (!S.open || e.target.closest('.op-x,.op-ui,.op-sum,#fx-sheet')) return; down = { x: e.clientX, y: e.clientY, t: Date.now() }; }, { passive: true });
  shell.addEventListener('pointerup', e => {
    if (!down || !S.open) return; const dx = e.clientX - down.x, dy = e.clientY - down.y; down = null;
    if (Math.hypot(dx, dy) < 34) return;
    swiped = true; setTimeout(() => { swiped = false; }, 400);
    if (S.open.phase === 'sealed') tear(); else nextCard(dx < 0 ? 'left' : 'right');
  });
  /* cards lean towards your pointer */
  shell.addEventListener('pointermove', e => {
    const c = e.target.closest('.bc.tilt'); if (!c || e.pointerType === 'touch') return;
    const r = c.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
    c.style.setProperty('--rx', ((0.5 - y) * 14).toFixed(2) + 'deg'); c.style.setProperty('--ry', ((x - 0.5) * 18).toFixed(2) + 'deg'); c.style.setProperty('--mx', (x * 100).toFixed(1) + '%'); c.style.setProperty('--my', (y * 100).toFixed(1) + '%');
  });
  shell.addEventListener('pointerleave', e => { const c = e.target.closest && e.target.closest('.bc.tilt'); if (c) { c.style.removeProperty('--rx'); c.style.removeProperty('--ry'); } }, true);
  document.addEventListener('keydown', e => {
    if (shell.hidden) return;
    if (e.key === 'Escape') { e.preventDefault(); if (S.sheet) sheetClose(); else if (S.open) { if (S.open.phase !== 'tearing') closeStage(); } else hide(); }
    else if (S.open && (e.key === ' ' || e.key === 'Enter' || e.key === 'ArrowRight')) { e.preventDefault(); nextCard(); }
  });
  document.addEventListener('click', e => { const t = e.target.closest('[data-a="football"],[data-fxopen]'); if (t) { e.preventDefault(); e.stopPropagation(); show(t.dataset.fxopen || 'packs'); } }, true);

  /* a player's showcase on their profile card */
  async function renderFavorites(p) {
    const node = document.getElementById('fc-profile-favorites'); if (!node || !p) return;
    node.innerHTML = '<small class="fx-fine">Loading showcase…</small>';
    try {
      await loadCatalog();
      const ref = String(p.f || myCode()), j = await api('cards/profile/' + encodeURIComponent(ref)); if (!node.isConnected) return;
      node.innerHTML = '<div class="fx-showhead"><b>Card showcase</b><span>' + (j.cards || 0) + ' cards · ' + money(j.valueCents) + '</span></div><div class="fx-showrow">' + ((j.top || []).map(c => A.card(c, cat, { cls: 'mini' })).join('') || '<span class="fx-fine">No cards in the showcase yet.</span>') + '</div>' +
        (p.self ? '<button class="fx-btn" data-fxopen="collection">Edit showcase</button>' : '');
    } catch (e) { if (node.isConnected) node.innerHTML = ''; }
  }
  window.BITZ_FOOTBALL = { open: show, close: hide, renderFavorites };
})();
