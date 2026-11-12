/* BITZ card art. Every card, pack, box, crest, flag and signature is drawn here, from one catalogue, so the shop,
   the opening stage, the book, the buyer, trades, profiles and inspection all show exactly the same thing.
   Portraits resolve through the licensed, identity-checked manifest (portraits/manifest.js),
   with a stable shared placeholder for unmatched players. See portraits/credits.json. */
(function () {
  'use strict';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const money = n => '$' + Math.round(Number(n) || 0).toLocaleString('en-US');
  const short = n => { n = Number(n) || 0; return n >= 1e6 ? '$' + (n / 1e6).toFixed(n >= 1e7 ? 0 : 1) + 'M' : n >= 1e4 ? '$' + Math.round(n / 1e3) + 'k' : money(n); };
  function hash(s) { let h = 2166136261; s = String(s); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function rng(seed) { let a = seed || 1; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  let uidN = 0; const uid = p => p + (++uidN).toString(36);
  const CAT = { players: new Map(), clubs: new Map(), editions: {}, sets: {}, season: 'S2' };
  function setCatalogue(cat) { CAT.players.clear(); CAT.clubs.clear(); (cat.players || []).forEach(p => CAT.players.set(p.id, p)); (cat.clubs || []).forEach(c => CAT.clubs.set(c.id, c)); CAT.editions = cat.editions || {}; CAT.sets = cat.sets || {}; CAT.season = cat.season || 'S2'; }
  const player = id => CAT.players.get(id);
  const club = id => CAT.clubs.get(id);
  const ed = id => CAT.editions[id] || { name: 'Common', rank: 0, set: 'red-hot' };
  const SET_CLASS = { 'red-hot': 's-rh', 'golden-star': 's-gs', 'european-nights': 's-en' };
  const TIER = ['Common', 'Uncommon', 'Rare', 'Epic', 'Holo', 'Premium', 'Elite', 'Signature', 'Numbered', 'One of One'];
  const INK = { 'red-hot': '#692529', 'golden-star': '#164ba3', 'european-nights': '#164ba3' };

  /* ---------------- flags (30 x 20) ---------------- */
  const star = (cx, cy, r, f) => { let d = ''; for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.42 : r; d += (i ? 'L' : 'M') + (cx + Math.cos(a) * rr).toFixed(2) + ' ' + (cy + Math.sin(a) * rr).toFixed(2); } return '<path d="' + d + 'Z" fill="' + f + '"/>'; };
  const H = (...c) => c.map((col, i) => '<rect x="0" y="' + (20 / c.length * i) + '" width="30" height="' + (20 / c.length + 0.05) + '" fill="' + col + '"/>').join('');
  const V = (...c) => c.map((col, i) => '<rect x="' + (30 / c.length * i) + '" y="0" width="' + (30 / c.length + 0.05) + '" height="20" fill="' + col + '"/>').join('');
  const NORD = (bg, cr, inner) => '<rect width="30" height="20" fill="' + bg + '"/><rect x="8" y="0" width="5" height="20" fill="' + cr + '"/><rect x="0" y="7.5" width="30" height="5" fill="' + cr + '"/>' + (inner ? '<rect x="9.25" y="0" width="2.5" height="20" fill="' + inner + '"/><rect x="0" y="8.75" width="30" height="2.5" fill="' + inner + '"/>' : '');
  const FLAGS = {
    ENG: '<rect width="30" height="20" fill="#fff"/><rect x="12.5" width="5" height="20" fill="#ce1124"/><rect y="7.5" width="30" height="5" fill="#ce1124"/>',
    SCO: '<rect width="30" height="20" fill="#0065bd"/><path d="M0 0L30 20M30 0L0 20" stroke="#fff" stroke-width="3.6"/>',
    WAL: H('#fff', '#00b140') + '<path d="M8 13l3-4 3 1 2-3 3 2 3-1-1 3 3 2-4 1-2 3-3-2-3 1z" fill="#d30731"/>',
    NIR: '<rect width="30" height="20" fill="#fff"/><rect x="12.5" width="5" height="20" fill="#ce1124"/><rect y="7.5" width="30" height="5" fill="#ce1124"/>' + star(15, 10, 3.2, '#fff') + '<rect x="13.2" y="8.6" width="3.6" height="2.8" fill="#ce1124"/>',
    IRL: V('#169b62', '#fff', '#ff883e'), FRA: V('#0055a4', '#fff', '#ef4135'), ITA: V('#009246', '#fff', '#ce2b37'), BEL: V('#1a1a1a', '#fdda24', '#ef3340'),
    ESP: '<rect width="30" height="20" fill="#aa151b"/><rect y="5" width="30" height="10" fill="#f1bf00"/><rect x="7" y="7.5" width="3.4" height="5" rx="1" fill="#aa151b" opacity=".8"/>',
    POR: '<rect width="30" height="20" fill="#da291c"/><rect width="12" height="20" fill="#046a38"/><circle cx="12" cy="10" r="4" fill="#ffe900" stroke="#da291c" stroke-width=".6"/>',
    BRA: '<rect width="30" height="20" fill="#009c3b"/><path d="M15 2.5L27 10 15 17.5 3 10z" fill="#ffdf00"/><circle cx="15" cy="10" r="4.6" fill="#002776"/><path d="M10.6 9.2q4.4-1.6 8.8 1.4" stroke="#fff" stroke-width=".9" fill="none"/>',
    ARG: H('#74acdf', '#fff', '#74acdf') + '<circle cx="15" cy="10" r="2.2" fill="#f6b40e"/>',
    URU: Array.from({ length: 9 }, (_, i) => '<rect y="' + (i * 20 / 9) + '" width="30" height="' + (20 / 9 + 0.05) + '" fill="' + (i % 2 ? '#0038a8' : '#fff') + '"/>').join('') + '<rect width="11" height="11.1" fill="#fff"/><circle cx="5.5" cy="5.5" r="3" fill="#fcd116"/>',
    COL: '<rect width="30" height="20" fill="#ce1126"/><rect width="30" height="15" fill="#003893"/><rect width="30" height="10" fill="#fcd116"/>',
    ECU: '<rect width="30" height="20" fill="#ed1c24"/><rect width="30" height="15" fill="#034ea2"/><rect width="30" height="10" fill="#ffdd00"/><circle cx="15" cy="9" r="2.6" fill="#7a4b1a" opacity=".8"/>',
    PAR: H('#d52b1e', '#fff', '#0038a8') + '<circle cx="15" cy="10" r="2.2" fill="none" stroke="#0038a8" stroke-width=".7"/>',
    MEX: V('#006847', '#fff', '#ce1126') + '<circle cx="15" cy="10" r="2.4" fill="#8c6a32"/>',
    USA: Array.from({ length: 13 }, (_, i) => '<rect y="' + (i * 20 / 13) + '" width="30" height="' + (20 / 13 + 0.05) + '" fill="' + (i % 2 ? '#fff' : '#b22234') + '"/>').join('') + '<rect width="13" height="10.8" fill="#3c3b6e"/>' + [2, 5, 8, 11].map(x => [2.5, 5.4, 8.3].map(y => '<circle cx="' + x + '" cy="' + y + '" r=".7" fill="#fff"/>').join('')).join(''),
    JAM: '<rect width="30" height="20" fill="#009b3a"/><path d="M0 0l15 10L0 20zM30 0L15 10l15 10z" fill="#000"/><path d="M0 0L30 20M30 0L0 20" stroke="#fed100" stroke-width="3.4"/>',
    GER: H('#000', '#dd0000', '#ffce00'), NED: H('#ae1c28', '#fff', '#21468b'), AUT: H('#ed2939', '#fff', '#ed2939'), POL: H('#fff', '#dc143c'), UKR: H('#0057b7', '#ffd700'), HUN: H('#ce2939', '#fff', '#477050'),
    CRO: H('#ff0000', '#fff', '#171796') + '<rect x="12.2" y="5.2" width="5.6" height="7.4" fill="#fff" stroke="#171796" stroke-width=".5"/>' + [0, 1, 2, 3].map(r => [0, 1, 2, 3].map(c => (r + c) % 2 ? '' : '<rect x="' + (12.2 + c * 1.4) + '" y="' + (5.2 + r * 1.85) + '" width="1.4" height="1.85" fill="#ff0000"/>').join('')).join(''),
    SRB: H('#c6363c', '#0c4076', '#fff') + '<rect x="7" y="5" width="4" height="8" rx="1.4" fill="#c6363c" stroke="#edb92e" stroke-width=".6"/>',
    BIH: '<rect width="30" height="20" fill="#002395"/><path d="M8 0h17v20z" fill="#fecb00"/>' + [2, 5.5, 9, 12.5, 16].map((y, i) => star(5 + i * 3.4, y + 1.2, 1.2, '#fff')).join(''),
    SVN: H('#fff', '#005da4', '#ed1c24') + '<path d="M8 4h6v4c0 2-1.5 3.5-3 4-1.5-.5-3-2-3-4z" fill="#005da4" stroke="#fff" stroke-width=".5"/>',
    CZE: H('#fff', '#d7141a') + '<path d="M0 0l15 10L0 20z" fill="#11457e"/>',
    GEO: '<rect width="30" height="20" fill="#fff"/><rect x="13" width="4" height="20" fill="#ff0000"/><rect y="8" width="30" height="4" fill="#ff0000"/>' + [[6, 4], [23, 4], [6, 15.5], [23, 15.5]].map(q => '<path d="M' + (q[0] - 1.6) + ' ' + q[1] + 'h3.2M' + q[0] + ' ' + (q[1] - 1.6) + 'v3.2" stroke="#ff0000" stroke-width="1.1"/>').join(''),
    GRE: Array.from({ length: 9 }, (_, i) => '<rect y="' + (i * 20 / 9) + '" width="30" height="' + (20 / 9 + 0.05) + '" fill="' + (i % 2 ? '#fff' : '#0d5eaf') + '"/>').join('') + '<rect width="11" height="11.1" fill="#0d5eaf"/><rect x="4.5" width="2" height="11.1" fill="#fff"/><rect y="4.5" width="11" height="2" fill="#fff"/>',
    TUR: '<rect width="30" height="20" fill="#e30a17"/><circle cx="11" cy="10" r="5" fill="#fff"/><circle cx="12.3" cy="10" r="4" fill="#e30a17"/>' + star(17.5, 10, 2.2, '#fff'),
    NOR: NORD('#ba0c2f', '#fff', '#00205b'), DEN: NORD('#c8102e', '#fff'), SWE: NORD('#006aa7', '#fecc00'),
    SUI: '<rect width="30" height="20" fill="#da291c"/><rect x="13" y="4" width="4" height="12" fill="#fff"/><rect x="9" y="8" width="12" height="4" fill="#fff"/>',
    NGA: V('#008751', '#fff', '#008751'), CIV: V('#f77f00', '#fff', '#009e60'), MLI: V('#14b53a', '#fcd116', '#ce1126'),
    GHA: H('#ce1126', '#fcd116', '#006b3f') + star(15, 10, 3.2, '#000'),
    SEN: V('#00853f', '#fdef42', '#e31b23') + star(15, 10, 3, '#00853f'),
    CMR: V('#007a5e', '#ce1126', '#fcd116') + star(15, 10, 2.8, '#fcd116'),
    BFA: H('#ef2b2d', '#009e49') + star(15, 10, 3.2, '#fcd116'),
    GAM: '<rect width="30" height="20" fill="#3a7728"/><rect width="30" height="13" fill="#0c1c8c"/><rect width="30" height="7" fill="#ce1126"/><rect y="6.6" width="30" height=".8" fill="#fff"/><rect y="12.6" width="30" height=".8" fill="#fff"/>',
    COD: '<rect width="30" height="20" fill="#007fff"/><path d="M0 20L30 0v6L0 26z" fill="#f7d618"/><path d="M0 18L30 -2v8L0 26z" fill="#ce1021" opacity=".95"/>' + star(5, 5, 3, '#f7d618'),
    MOZ: H('#007168', '#000', '#fce100') + '<rect y="6" width="30" height=".8" fill="#fff"/><rect y="13.2" width="30" height=".8" fill="#fff"/><path d="M0 0l13 10L0 20z" fill="#d21034"/>' + star(4.5, 10, 2.6, '#fce100'),
    MAR: '<rect width="30" height="20" fill="#c1272d"/>' + star(15, 10.4, 4.6, 'none').replace('fill="none"', 'fill="none" stroke="#006233" stroke-width="1"'),
    ALG: V('#006233', '#fff') + '<circle cx="15" cy="10" r="4" fill="#d21034"/><circle cx="16.2" cy="10" r="3.3" fill="#fff"/><circle cx="16.2" cy="10" r="3.3" fill="#fff"/><path d="M16.2 6.7a3.3 3.3 0 1 0 0 6.6a2.6 2.6 0 1 1 0-6.6z" fill="#d21034" opacity="0"/>' + star(17.2, 10, 1.6, '#d21034'),
    EGY: H('#ce1126', '#fff', '#000') + '<rect x="13.6" y="8" width="2.8" height="4" fill="#c09300"/>',
    JPN: '<rect width="30" height="20" fill="#fff"/><circle cx="15" cy="10" r="6" fill="#bc002d"/>',
    KOR: '<rect width="30" height="20" fill="#fff"/><circle cx="15" cy="10" r="4.6" fill="#0047a0"/><path d="M10.4 10a4.6 4.6 0 0 1 9.2 0a2.3 2.3 0 0 1-4.6 0a2.3 2.3 0 0 0-4.6 0z" fill="#cd2e3a"/>',
    AUS: '<rect width="30" height="20" fill="#012169"/><path d="M0 0L13 10M13 0L0 10" stroke="#fff" stroke-width="2"/><path d="M0 0L13 10M13 0L0 10" stroke="#c8102e" stroke-width=".8"/><rect x="5.5" width="2" height="10" fill="#fff"/><rect y="4" width="13" height="2" fill="#fff"/><rect x="6" width="1" height="10" fill="#c8102e"/><rect y="4.5" width="13" height="1" fill="#c8102e"/>' + star(6.5, 15, 2.2, '#fff') + star(22, 5, 1.2, '#fff') + star(25, 10, 1.2, '#fff') + star(22, 16, 1.2, '#fff'),
    NZL: '<rect width="30" height="20" fill="#012169"/><path d="M0 0L13 10M13 0L0 10" stroke="#fff" stroke-width="2"/><path d="M0 0L13 10M13 0L0 10" stroke="#c8102e" stroke-width=".8"/><rect x="5.5" width="2" height="10" fill="#fff"/><rect y="4" width="13" height="2" fill="#fff"/><rect x="6" width="1" height="10" fill="#c8102e"/><rect y="4.5" width="13" height="1" fill="#c8102e"/>' + [[22, 5], [25.5, 9], [21, 13], [23.5, 16.5]].map(q => star(q[0], q[1], 1.4, '#c8102e') + star(q[0], q[1], .9, '#fff')).join('')
  };
  const NATION = { ENG: 'England', SCO: 'Scotland', WAL: 'Wales', NIR: 'Northern Ireland', IRL: 'Ireland', FRA: 'France', ESP: 'Spain', POR: 'Portugal', BRA: 'Brazil', ARG: 'Argentina', URU: 'Uruguay', COL: 'Colombia', ECU: 'Ecuador', PAR: 'Paraguay', MEX: 'Mexico', USA: 'USA', JAM: 'Jamaica', GER: 'Germany', NED: 'Netherlands', BEL: 'Belgium', ITA: 'Italy', CRO: 'Croatia', SRB: 'Serbia', BIH: 'Bosnia', SVN: 'Slovenia', POL: 'Poland', UKR: 'Ukraine', HUN: 'Hungary', CZE: 'Czechia', GEO: 'Georgia', GRE: 'Greece', TUR: 'Turkey', NOR: 'Norway', DEN: 'Denmark', SWE: 'Sweden', SUI: 'Switzerland', AUT: 'Austria', NGA: 'Nigeria', GHA: 'Ghana', SEN: 'Senegal', CIV: 'Ivory Coast', CMR: 'Cameroon', MLI: 'Mali', BFA: 'Burkina Faso', GAM: 'Gambia', COD: 'DR Congo', MOZ: 'Mozambique', MAR: 'Morocco', ALG: 'Algeria', EGY: 'Egypt', JPN: 'Japan', KOR: 'South Korea', AUS: 'Australia', NZL: 'New Zealand' };
  function flag(code) { return '<svg viewBox="0 0 30 20" role="img" aria-label="' + esc(NATION[code] || code) + '">' + (FLAGS[code] || H('#ccc', '#eee')) + '</svg>'; }

  /* ---------------- crests: original roundels in the club's colours, never a real badge ---------------- */
  function crest(c, size) {
    if (!c) return '';
    const g = uid('c'), light = lum(c.primary) > 0.6, ink = light ? '#0b0b0f' : '#fff', s = size || 36;
    let pat = '';
    if (c.kit === 'stripes') pat = [22, 50, 78].map(x => '<rect x="' + (x - 7) + '" y="0" width="14" height="100" fill="' + c.accent + '"/>').join('');
    else if (c.kit === 'sash') pat = '<path d="M-10 25L25 -10 110 75 75 110z" fill="' + c.accent + '"/>';
    else if (c.kit === 'sleeves') pat = '<rect x="0" y="0" width="22" height="100" fill="' + c.accent + '"/><rect x="78" y="0" width="22" height="100" fill="' + c.accent + '"/>';
    else pat = '<circle cx="50" cy="50" r="30" fill="' + c.accent + '" opacity=".16"/>';
    return '<svg class="crest" viewBox="0 0 100 100" width="' + s + '" height="' + s + '" role="img" aria-label="' + esc(c.name) + '"><defs><clipPath id="' + g + '"><circle cx="50" cy="50" r="46"/></clipPath></defs>' +
      '<g clip-path="url(#' + g + ')"><rect width="100" height="100" fill="' + c.primary + '"/>' + pat + '<circle cx="50" cy="50" r="31" fill="' + c.primary + '" stroke="' + (light ? '#0b0b0f' : c.accent) + '" stroke-width="3"/>' +
      '<text x="50" y="58" text-anchor="middle" font-family="Coolvetica,Nunito,sans-serif" font-size="25" letter-spacing="1" fill="' + ink + '">' + esc(c.short) + '</text></g><circle cx="50" cy="50" r="46" fill="none" stroke="#0b0b0f" stroke-width="5"/></svg>';
  }
  function lum(hex) { const h = String(hex || '').replace('#', ''); if (h.length < 6) return 0.5; const r = parseInt(h.slice(0, 2), 16) / 255, g = parseInt(h.slice(2, 4), 16) / 255, b = parseInt(h.slice(4, 6), 16) / 255; return 0.2126 * r + 0.7152 * g + 0.0722 * b; }

  /* ---------------- virtual signatures (never a real autograph) ---------------- */
  function signature(name, ink, seedExtra) {
    // Original, fictional ink artwork, NOT the footballer's authentic signature.
    // Caveat is loaded specifically for signed card editions, separately from the BITZ UI fonts.
    const parts = String(name || 'Player').trim().split(/\s+/);
    const label = parts.length > 1 ? parts[0][0] + '. ' + parts.slice(1).join(' ') : parts[0];
    const r = rng(hash('bitz-ink:' + name + ':' + (seedExtra || '')));
    const y = 54 + Math.round(r() * 3), tilt = (-5 + Math.round(r() * 5));
    const stroke = ink || '#174da4';
    const sweep = 'M 18 ' + (y + 2) + ' C 58 ' + (y + 11) + ', 118 ' + (y - 4) + ', 204 ' + (y + 1);
    return '<svg class="autograph" viewBox="0 0 220 80" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Fictional signature for ' + esc(name) + '">' +
      '<text x="110" y="48" text-anchor="middle" font-family="Caveat,Brush Script MT,Segoe Script,cursive" font-size="46" font-weight="700" letter-spacing="-.7" fill="' + stroke + '" textLength="' + Math.min(195,Math.max(120, label.length * 16)) + '" lengthAdjust="spacingAndGlyphs" transform="rotate(' + tilt + ' 110 36)">' + esc(label) + '</text>' +
      '<path class="ink-sweep" d="' + sweep + '" fill="none" stroke="' + stroke + '" stroke-width="2.1" stroke-linecap="round" opacity=".85"/>' +
      '</svg>';
  }

  /* ---------------- portraits ---------------- */
  const portraitSrc = pid => {
    const record = (globalThis.BITZ_PORTRAITS || {})[pid];
    const file = record && record.file;
    return /^[a-z0-9-]+\.(?:jpg|png|webp)$/.test(file || '') ? 'portraits/' + file : 'portraits/placeholder.png';
  };
  const portrait = (pid, alt) => {
    const src = portraitSrc(pid), photo = !src.endsWith('placeholder.png');
    return '<img class="' + (photo ? 'photo' : 'fallback') + '" src="' + src + '" alt="' + esc(alt || '') + '" loading="lazy" decoding="async" draggable="false" onerror="this.onerror=null;this.className=\'fallback\';this.src=\'portraits/placeholder.png\'">';
  };

  /* ---------------- the card ---------------- */
  function card(c, opt) {
    opt = opt || {};
    const ids = c.players || [c.player], P = ids.map(player).filter(Boolean), p = P[0] || { name: 'Unknown', pos: '', nation: '', club: '' }, cl = club(p.club), e = ed(c.ed), dual = P.length > 1 && e.dual;
    const cls = ['bc', SET_CLASS[c.set] || 's-rh', 'r' + e.rank, P.some(q => portraitSrc(q.id) !== 'portraits/placeholder.png') ? 'photo-card' : '', opt.cls || '', opt.lock ? 'lockd' : '', opt.top ? 'topd' : '', opt.sel ? 'sel' : '', opt.dim ? 'dim' : '', e.auto ? 'has-auto' : '', dual ? 'dual' : '', opt.anim ? 'anim' : ''].filter(Boolean).join(' ');
    const art = dual ? '<div class="pair">' + portrait(P[0].id, P[0].name) + portrait(P[1].id, P[1].name) + '</div>' : '<div class="port">' + portrait(p.id, p.name) + '</div>';
    const name = dual ? P.map(q => q.name.split(' ').slice(-1)[0]).join(' & ') : (p.name.length > 15 ? p.name.split(' ').slice(-1)[0] : p.name);
    const sig = e.auto ? '<div class="sig' + (dual ? ' dual' : '') + '">' + '<div class="sign-one">' + signature(p.name, INK[c.set], c.uid) + '</div>' + (dual ? '<div class="sign-one">' + signature(P[1].name, INK[c.set], c.uid + 'b') + '</div>' : '') + '<span class="sig-cert">BITZ DIGITAL AUTOGRAPH</span></div>' : '';
    const foot = '<div class="foot"><span>' + esc(e.name) + '</span>' + (c.serial ? '<span class="serial">' + c.serial + '/' + c.serialMax + '</span>' : '<span>26/27</span>') + '</div>';
    return '<div class="' + cls + '"' + (c.uid ? ' data-uid="' + esc(c.uid) + '"' : '') + (opt.attrs || '') + '>' +
      '<div class="art"></div><i class="cracks"></i><i class="lights"></i>' + art +
      '<div class="top"><span class="pos">' + esc(p.pos) + '</span><span class="flag">' + flag(p.nation) + '</span></div>' + sig +
      '<div class="plate">' + crest(cl, 40) + '<div class="nm"><b>' + esc(name) + '</b><span>' + esc(dual ? 'Dual Signature' : cl ? cl.name : '') + '</span></div></div>' + foot +
      (e.serialMax === 1 ? '<span class="one">1 OF 1</span>' : '') + '<i class="foil"></i><i class="holo"></i><i class="sheen"></i></div>';
  }
  const back = (cls) => '<div class="bc ' + (cls || '') + '"><div class="back"><i></i><b>BITZ</b><small>' + esc(CAT.season) + ' · COLLECT</small></div></div>';

  /* ---------------- packs (160 x 250) and boxes ---------------- */
  const PK = {
    'red-hot': { bg: ['#2a0603', '#c81e0a', '#ff7a1a'], ink: '#fff', foil: '#ffb13d', label: 'RED HOT', sub: 'FIRE · MAGMA · TALENT' },
    'golden-star': { bg: ['#fff8df', '#f3cf5a', '#c9951c'], ink: '#2a1d02', foil: '#fff6c8', label: 'GOLDEN STAR', sub: 'AN AUTOGRAPH IN EVERY PACK' },
    'european-nights': { bg: ['#02040f', '#0e1f5a', '#2a56c8'], ink: '#e8efff', foil: '#cfe0ff', label: 'EUROPEAN NIGHTS', sub: 'ELITE · PLATINUM · 1/1' },
    'welcome': { bg: ['#ffffff', '#efeaff', '#7a52ff'], ink: '#1a0b45', foil: '#7a52ff', label: 'WELCOME', sub: 'YOUR FIRST FIVE' },
    'god': { bg: ['#fff', '#f6e7ff', '#c7a6ff'], ink: '#2b1a5e', foil: '#f2b705', label: 'GOD PACK', sub: 'THE BEST OF ALL THREE' }
  };
  function packArt(set) {
    const k = PK[set] || PK['red-hot'], g = uid('p');
    let art = '';
    if (set === 'red-hot' || set === 'welcome') art = '<path d="M80 60c-8 22-30 30-30 60a30 30 0 0 0 60 0c0-16-8-24-16-32 0 12-4 20-12 20 4-16-2-32-2-48z" fill="' + (set === 'welcome' ? '#7a52ff' : '#ffb13d') + '" stroke="' + (set === 'welcome' ? '#1a0b45' : '#3a0b06') + '" stroke-width="3"/><path d="M80 96c-4 10-12 14-12 26a12 12 0 0 0 24 0c0-8-6-12-6-18-2 6-4 8-6 8z" fill="#fff"/>' + (set === 'red-hot' ? '<path d="M0 196l18-8 10 6 16-14 10 4 12-10 14 6 12-8 16 4 14-6 14 8 14-4" fill="none" stroke="#ffd27a" stroke-width="2.4"/><path d="M0 212l22-10 10 6 14-9 12 3 10-8 16 4 13-6 14 2 13-6 12 6 14-4" fill="none" stroke="#fff0b3" stroke-width="1.4" opacity=".8"/>' : '');
    if (set === 'golden-star') art = star(80, 112, 46, '#fff2b0') .replace('/>', ' stroke="#8a5a00" stroke-width="3"/>') + star(80, 112, 26, '#f2b705') + '<path d="M30 180c18-26 30 8 46-10s24-18 40-4 18-4 30-6" fill="none" stroke="#8a5a00" stroke-width="3.5" stroke-linecap="round"/>';
    if (set === 'european-nights') art = '<path d="M20 30L58 150h-26zM140 30L102 150h26z" fill="#fff" opacity=".12"/><path d="M80 44c-24 0-44 20-44 46 0 16 8 30 20 38h48c12-8 20-22 20-38 0-26-20-46-44-46z" fill="#0b1a4a" stroke="#cfe0ff" stroke-width="3"/><circle cx="80" cy="90" r="16" fill="#cfe0ff"/><path d="M16 150h128M22 162h116M30 174h100" stroke="#cfe0ff" stroke-width="3" opacity=".7"/>';
    if (set === 'god') art = Array.from({ length: 16 }, (_, i) => { const a = i * Math.PI / 8; return '<path d="M80 118L' + (80 + Math.cos(a - 0.09) * 150).toFixed(0) + ' ' + (118 + Math.sin(a - 0.09) * 150).toFixed(0) + 'L' + (80 + Math.cos(a + 0.09) * 150).toFixed(0) + ' ' + (118 + Math.sin(a + 0.09) * 150).toFixed(0) + 'z" fill="#fff" opacity=".6"/>'; }).join('') + '<ellipse cx="80" cy="84" rx="34" ry="9" fill="none" stroke="#f2b705" stroke-width="5"/><circle cx="80" cy="126" r="30" fill="#7a52ff" stroke="#2b1a5e" stroke-width="3"/>';
    let edge = 'M0 14'; for (let x = 8; x <= 160; x += 8) edge += 'L' + x + ' ' + (14 + ((x / 8) % 2 ? 6 : 0)); edge += 'L160 236'; for (let x = 152; x >= 0; x -= 8) edge += 'L' + x + ' ' + (236 - ((x / 8) % 2 ? 6 : 0)); edge += 'Z';
    return '<svg viewBox="0 0 160 250" aria-label="' + esc(k.label) + ' pack"><defs><linearGradient id="' + g + '" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="' + k.bg[0] + '"/><stop offset=".55" stop-color="' + k.bg[1] + '"/><stop offset="1" stop-color="' + k.bg[2] + '"/></linearGradient><linearGradient id="' + g + 'f" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity=".5"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient><clipPath id="' + g + 'c"><path d="' + edge + '"/></clipPath></defs>' +
      '<path d="' + edge + '" fill="#0b0b0f" transform="translate(0 4)"/><g clip-path="url(#' + g + 'c)"><rect width="160" height="250" fill="url(#' + g + ')"/>' + art +
      '<rect x="0" y="0" width="160" height="34" fill="#0b0b0f" opacity=".25"/><rect x="0" y="216" width="160" height="34" fill="#0b0b0f" opacity=".25"/>' +
      '<text x="80" y="206" text-anchor="middle" font-family="Coolvetica,Nunito,sans-serif" font-size="' + (k.label.length > 11 ? 16 : 21) + '" letter-spacing="1.5" fill="' + k.ink + '">' + esc(k.label) + '</text>' +
      '<text x="80" y="56" text-anchor="middle" font-family="Nunito,sans-serif" font-weight="800" font-size="7.5" letter-spacing="2" fill="' + k.ink + '" opacity=".85">BITZ · ' + esc(k.sub) + '</text>' +
      '<rect class="sheenbar" x="-70" y="0" width="70" height="250" fill="url(#' + g + 'f)"><animate attributeName="x" from="-70" to="200" dur="3.2s" repeatCount="indefinite"/></rect></g><path d="' + edge + '" fill="none" stroke="#0b0b0f" stroke-width="4" stroke-linejoin="round"/><path d="M0 26H160" stroke="' + k.foil + '" stroke-width="1.5" stroke-dasharray="3 3"/></svg>';
  }
  const pack = (set, n, cls) => '<div class="pk ' + (cls || '') + '" data-set="' + esc(set) + '">' + packArt(set) + (n ? '<b class="n">×' + n + '</b>' : '') + '</div>';
  function boxArt(set) {
    const k = PK[set] || PK['red-hot'], g = uid('b');
    return '<svg viewBox="0 0 200 200" aria-label="' + esc(k.label) + ' box"><defs><linearGradient id="' + g + '" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="' + k.bg[1] + '"/><stop offset="1" stop-color="' + k.bg[2] + '"/></linearGradient></defs>' +
      '<path d="M30 70l70-34 70 34v76l-70 34-70-34z" fill="#0b0b0f" transform="translate(0 6)"/><path d="M30 70l70-34 70 34-70 34z" fill="' + k.bg[0] + '"/><path d="M30 70l70 34v76l-70-34z" fill="url(#' + g + ')"/><path d="M170 70l-70 34v76l70-34z" fill="' + k.bg[1] + '"/>' +
      '<path d="M30 70l70-34 70 34v76l-70 34-70-34zM30 70l70 34 70-34M100 104v76" fill="none" stroke="#0b0b0f" stroke-width="4" stroke-linejoin="round"/>' +
      '<text x="100" y="80" text-anchor="middle" font-family="Coolvetica,Nunito,sans-serif" font-size="' + (k.label.length > 11 ? 13 : 17) + '" fill="' + (lum(k.bg[0]) > 0.6 ? '#0b0b0f' : '#fff') + '" transform="skewX(0)">' + esc(k.label) + '</text>' +
      '<text x="64" y="156" text-anchor="middle" font-family="Coolvetica,Nunito,sans-serif" font-size="22" fill="#fff" transform="skewY(26)">10 PACKS</text></svg>';
  }
  const box = (set, cls) => '<div class="pk box ' + (cls || '') + '" data-set="' + esc(set) + '">' + boxArt(set) + '</div>';
  const EDCOL = { 0: '#e9e7f0', 1: '#cfd3dc', 2: '#9fc3ff', 3: '#b388ff', 4: '#7cf9ff', 5: '#ffb13d', 6: '#ff6a3d', 7: '#f2b705', 8: '#ff4da6', 9: '#0b0b0f' };
  window.BZART = { setCatalogue, card, back, pack, packArt, box, crest, flag, signature, portrait, portraitSrc, player, club, ed, money, short, hash, NATION, TIER, SET_CLASS, EDCOL, esc, cat: CAT };
})();
