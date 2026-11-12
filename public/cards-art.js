/* BITZ card art: everything on a card is drawn here as SVG, so it is crisp on every screen and needs no images.
   Fictional players (voxel portraits that match the game's characters), original club crests, national flags,
   virtual signatures, pack wrappers and the card frames for every rarity. */
(function () {
  'use strict';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  function hash(s) { let h = 2166136261; s = String(s); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function rng(seed) { let a = seed || 1; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  let uidN = 0; const uid = p => p + (++uidN).toString(36);

  /* ---------------- flags (30 x 20) ---------------- */
  const star = (cx, cy, r, f) => { let d = ''; for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.42 : r; d += (i ? 'L' : 'M') + (cx + Math.cos(a) * rr).toFixed(2) + ' ' + (cy + Math.sin(a) * rr).toFixed(2); } return '<path d="' + d + 'Z" fill="' + f + '"/>'; };
  const H = (...c) => c.map((col, i) => '<rect x="0" y="' + (20 / c.length * i) + '" width="30" height="' + (20 / c.length + 0.05) + '" fill="' + col + '"/>').join('');
  const V = (...c) => c.map((col, i) => '<rect x="' + (30 / c.length * i) + '" y="0" width="' + (30 / c.length + 0.05) + '" height="20" fill="' + col + '"/>').join('');
  const NORD = (bg, cr, inner) => '<rect width="30" height="20" fill="' + bg + '"/><rect x="8" y="0" width="5" height="20" fill="' + cr + '"/><rect x="0" y="7.5" width="30" height="5" fill="' + cr + '"/>' + (inner ? '<rect x="9.25" y="0" width="2.5" height="20" fill="' + inner + '"/><rect x="0" y="8.75" width="30" height="2.5" fill="' + inner + '"/>' : '');
  const FLAGS = {
    ENG: '<rect width="30" height="20" fill="#fff"/><rect x="12.5" width="5" height="20" fill="#ce1124"/><rect y="7.5" width="30" height="5" fill="#ce1124"/>',
    SCO: '<rect width="30" height="20" fill="#0065bd"/><path d="M0 0L30 20M30 0L0 20" stroke="#fff" stroke-width="3.6"/>',
    WAL: H('#fff', '#00b140') + '<path d="M8 13l3-4 3 1 2-3 3 2 3-1-1 3 3 2-4 1-2 3-3-2-3 1z" fill="#d30731"/>',
    IRL: V('#169b62', '#fff', '#ff883e'), FRA: V('#0055a4', '#fff', '#ef4135'), ITA: V('#009246', '#fff', '#ce2b37'), BEL: V('#1a1a1a', '#fdda24', '#ef3340'),
    ESP: '<rect width="30" height="20" fill="#aa151b"/><rect y="5" width="30" height="10" fill="#f1bf00"/><rect x="7" y="7.5" width="3.4" height="5" rx="1" fill="#aa151b" opacity=".8"/>',
    POR: '<rect width="30" height="20" fill="#da291c"/><rect width="12" height="20" fill="#046a38"/><circle cx="12" cy="10" r="4" fill="#ffe900" stroke="#da291c" stroke-width=".6"/>',
    BRA: '<rect width="30" height="20" fill="#009c3b"/><path d="M15 2.5L27 10 15 17.5 3 10z" fill="#ffdf00"/><circle cx="15" cy="10" r="4.6" fill="#002776"/><path d="M10.6 9.2q4.4-1.6 8.8 1.4" stroke="#fff" stroke-width=".9" fill="none"/>',
    ARG: H('#74acdf', '#fff', '#74acdf') + '<circle cx="15" cy="10" r="2.2" fill="#f6b40e"/>',
    URU: Array.from({ length: 9 }, (_, i) => '<rect y="' + (i * 20 / 9) + '" width="30" height="' + (20 / 9 + 0.05) + '" fill="' + (i % 2 ? '#0038a8' : '#fff') + '"/>').join('') + '<rect width="11" height="11.1" fill="#fff"/><circle cx="5.5" cy="5.5" r="3" fill="#fcd116"/>',
    COL: '<rect width="30" height="20" fill="#ce1126"/><rect width="30" height="15" fill="#003893"/><rect width="30" height="10" fill="#fcd116"/>',
    MEX: V('#006847', '#fff', '#ce1126') + '<circle cx="15" cy="10" r="2.4" fill="#8c6a32"/>',
    USA: Array.from({ length: 13 }, (_, i) => '<rect y="' + (i * 20 / 13) + '" width="30" height="' + (20 / 13 + 0.05) + '" fill="' + (i % 2 ? '#fff' : '#b22234') + '"/>').join('') + '<rect width="13" height="10.8" fill="#3c3b6e"/>' + [2, 5, 8, 11].map(x => [2.5, 5.4, 8.3].map(y => '<circle cx="' + x + '" cy="' + y + '" r=".7" fill="#fff"/>').join('')).join(''),
    GER: H('#000', '#dd0000', '#ffce00'), NED: H('#ae1c28', '#fff', '#21468b'), AUT: H('#ed2939', '#fff', '#ed2939'), POL: H('#fff', '#dc143c'), UKR: H('#0057b7', '#ffd700'),
    CRO: H('#ff0000', '#fff', '#171796') + '<rect x="12.2" y="5.2" width="5.6" height="7.4" fill="#fff" stroke="#171796" stroke-width=".5"/>' + [0, 1, 2, 3].map(r => [0, 1, 2, 3].map(c => (r + c) % 2 ? '' : '<rect x="' + (12.2 + c * 1.4) + '" y="' + (5.2 + r * 1.85) + '" width="1.4" height="1.85" fill="#ff0000"/>').join('')).join(''),
    SRB: H('#c6363c', '#0c4076', '#fff') + '<rect x="7" y="5" width="4" height="8" rx="1.4" fill="#c6363c" stroke="#edb92e" stroke-width=".6"/>',
    NOR: NORD('#ba0c2f', '#fff', '#00205b'), DEN: NORD('#c8102e', '#fff'), SWE: NORD('#006aa7', '#fecc00'),
    SUI: '<rect width="30" height="20" fill="#da291c"/><rect x="13" y="4" width="4" height="12" fill="#fff"/><rect x="9" y="8" width="12" height="4" fill="#fff"/>',
    NGA: V('#008751', '#fff', '#008751'), CIV: V('#f77f00', '#fff', '#009e60'),
    GHA: H('#ce1126', '#fcd116', '#006b3f') + star(15, 10, 3.2, '#000'),
    SEN: V('#00853f', '#fdef42', '#e31b23') + star(15, 10, 3, '#00853f'),
    CMR: V('#007a5e', '#ce1126', '#fcd116') + star(15, 10, 2.8, '#fcd116'),
    MAR: '<rect width="30" height="20" fill="#c1272d"/>' + star(15, 10.4, 4.6, 'none').replace('fill="none"', 'fill="none" stroke="#006233" stroke-width="1"'),
    EGY: H('#ce1126', '#fff', '#000') + '<rect x="13.6" y="8" width="2.8" height="4" fill="#c09300"/>',
    JPN: '<rect width="30" height="20" fill="#fff"/><circle cx="15" cy="10" r="6" fill="#bc002d"/>',
    KOR: '<rect width="30" height="20" fill="#fff"/><circle cx="15" cy="10" r="4.6" fill="#0047a0"/><path d="M10.4 10a4.6 4.6 0 0 1 9.2 0a2.3 2.3 0 0 1-4.6 0a2.3 2.3 0 0 0-4.6 0z" fill="#cd2e3a"/>' + [[5, 4, 35], [25, 4, -35], [5, 16, -35], [25, 16, 35]].map(b => '<g transform="rotate(' + b[2] + ' ' + b[0] + ' ' + b[1] + ')"><rect x="' + (b[0] - 2.4) + '" y="' + (b[1] - 1.6) + '" width="4.8" height=".8" fill="#000"/><rect x="' + (b[0] - 2.4) + '" y="' + (b[1] - 0.4) + '" width="4.8" height=".8" fill="#000"/><rect x="' + (b[0] - 2.4) + '" y="' + (b[1] + 0.8) + '" width="4.8" height=".8" fill="#000"/></g>').join(''),
    AUS: '<rect width="30" height="20" fill="#012169"/><rect width="13" height="10" fill="#012169"/><path d="M0 0L13 10M13 0L0 10" stroke="#fff" stroke-width="2"/><path d="M0 0L13 10M13 0L0 10" stroke="#c8102e" stroke-width=".8"/><rect x="5.5" width="2" height="10" fill="#fff"/><rect y="4" width="13" height="2" fill="#fff"/><rect x="6" width="1" height="10" fill="#c8102e"/><rect y="4.5" width="13" height="1" fill="#c8102e"/>' + star(6.5, 15, 2.2, '#fff') + star(22, 5, 1.2, '#fff') + star(25, 10, 1.2, '#fff') + star(22, 16, 1.2, '#fff') + star(19, 9, 1.1, '#fff')
  };
  const NATION = { ENG: 'England', SCO: 'Scotland', WAL: 'Wales', IRL: 'Ireland', FRA: 'France', ESP: 'Spain', POR: 'Portugal', BRA: 'Brazil', ARG: 'Argentina', URU: 'Uruguay', COL: 'Colombia', MEX: 'Mexico', USA: 'USA', GER: 'Germany', NED: 'Netherlands', BEL: 'Belgium', ITA: 'Italy', CRO: 'Croatia', SRB: 'Serbia', POL: 'Poland', UKR: 'Ukraine', NOR: 'Norway', DEN: 'Denmark', SWE: 'Sweden', SUI: 'Switzerland', AUT: 'Austria', NGA: 'Nigeria', GHA: 'Ghana', SEN: 'Senegal', CIV: 'Ivory Coast', CMR: 'Cameroon', MAR: 'Morocco', EGY: 'Egypt', JPN: 'Japan', KOR: 'South Korea', AUS: 'Australia' };
  function flag(code, w) { const id = uid('fl'); return '<svg class="bz-flag" viewBox="0 0 30 20" width="' + (w || 30) + '" height="' + ((w || 30) * 2 / 3) + '" role="img" aria-label="' + esc(NATION[code] || code) + '"><defs><clipPath id="' + id + '"><rect width="30" height="20" rx="2.2"/></clipPath></defs><g clip-path="url(#' + id + ')">' + (FLAGS[code] || H('#ccc', '#eee')) + '<rect width="30" height="20" fill="url(#bzflagsheen)" opacity=".35"/></g><rect x=".5" y=".5" width="29" height="19" rx="2" fill="none" stroke="rgba(0,0,0,.45)"/></svg>'; }

  /* ---------------- crests (100 x 120), original designs ---------------- */
  const MOTIF = {
    star: '<path d="M50 30l6.5 13.4 14.7 2.1-10.6 10.4 2.5 14.6L50 63.6l-13.1 6.9 2.5-14.6-10.6-10.4 14.7-2.1z"/>',
    crown: '<path d="M30 66h40l4-28-12 10-12-16-12 16-12-10z"/><rect x="30" y="68" width="40" height="6" rx="1.5"/>',
    tower: '<path d="M37 74V42h-4V32h7v5h5v-5h10v5h5v-5h7v10h-4v32z"/>',
    anchor: '<path d="M47 34a5 5 0 1 1 6 0v7h8v5h-8v20c6-1 10-5 11-10l5 2c-2 9-10 14-19 14s-17-5-19-14l5-2c1 5 5 9 11 10V46h-8v-5h8z"/>',
    wave: '<path d="M26 56c6-8 12-8 18 0s12 8 18 0 8-6 12-2v8c-4-4-6-2-12 2-6 8-12 8-18 0s-12-8-18 0z"/><path d="M26 44c6-8 12-8 18 0s12 8 18 0 8-6 12-2v6c-4-4-6-2-12 2-6 8-12 8-18 0s-12-8-18 0z" opacity=".6"/>',
    lion: '<path d="M50 30l6 6 8-2-1 8 7 5-6 5 3 8-8 0-3 8-6-5-6 5-3-8-8 0 3-8-6-5 7-5-1-8 8 2z"/><circle cx="50" cy="52" r="9" fill="var(--k2)"/><circle cx="46.5" cy="50" r="1.6"/><circle cx="53.5" cy="50" r="1.6"/><path d="M47 56h6l-3 3z"/>',
    bee: '<ellipse cx="50" cy="54" rx="11" ry="15"/><path d="M39 50h22M39 58h22" stroke="var(--k2)" stroke-width="4"/><ellipse cx="38" cy="40" rx="9" ry="6" opacity=".6"/><ellipse cx="62" cy="40" rx="9" ry="6" opacity=".6"/>',
    cliff: '<path d="M26 74l10-26 8 6 8-20 8 14 6-4 8 30z"/><path d="M48 44l4-8 4 8z" fill="var(--k2)"/>',
    cannonball: '<circle cx="47" cy="56" r="15"/><path d="M58 42l6-8 4 3-6 8z"/><circle cx="66" cy="32" r="3"/>',
    spire: '<path d="M50 26l9 30h-4v18H45V56h-4z"/>',
    wing: '<path d="M28 66c4-18 18-30 44-34-6 6-8 10-8 14 4-2 6-2 8-1-6 4-8 7-9 11 3-1 5 0 6 1-8 4-18 8-41 9z"/>',
    oak: '<path d="M50 28c-4 6-12 6-12 14 0 4 4 6 2 10-2 4-8 4-8 10 0 6 8 8 14 6l2 8h4l2-8c6 2 14 0 14-6 0-6-6-6-8-10-2-4 2-6 2-10 0-8-8-8-12-14z"/>',
    claw: '<path d="M34 34l10 4-6 36-6-2zM47 30l9 3-3 41h-7zM60 34l10 2-10 38-6-1z"/>',
    horse: '<path d="M40 74h28l-2-8c0-10-4-16-4-22 0-6-4-12-14-14l2 6-10 8 2 6 8-2c0 6-6 12-10 20z"/>',
    rose: '<circle cx="50" cy="48" r="13"/><circle cx="50" cy="48" r="7" fill="var(--k2)"/><circle cx="50" cy="48" r="3"/><path d="M48 60h4v14h-4z"/><path d="M52 66c6-4 10-2 12 0-4 4-8 4-12 2z"/>',
    bird: '<path d="M26 54c10-4 18-14 26-14 6 0 10 4 12 8l10 2-8 4c-2 10-12 18-26 18l6-8c-8 0-14-4-20-10z"/><circle cx="58" cy="46" r="1.8" fill="var(--k2)"/>',
    gear: '<path d="M46 28h8l2 7 6 3 7-3 5 6-4 6 1 7 7 3v8l-7 2-3 6 3 7-6 5-6-4-7 1-2 7h-8l-2-7-6-3-7 4-5-6 4-6-1-7-7-2v-8l7-2 3-6-4-7 6-5 6 4 7-1z"/><circle cx="50" cy="54" r="8" fill="var(--k2)"/>',
    castle: '<path d="M28 74V44h6v6h6v-6h6v6h8v-6h6v6h6v-6h6v30H56V62a6 6 0 0 0-12 0v12z"/>',
    tree: '<circle cx="50" cy="44" r="15"/><circle cx="38" cy="52" r="9"/><circle cx="62" cy="52" r="9"/><rect x="46" y="56" width="8" height="18"/>',
    lighthouse: '<path d="M44 74l3-36h6l3 36z"/><rect x="43" y="30" width="14" height="8"/><path d="M50 24l7 6H43z"/><path d="M57 34l16-6v12z" opacity=".55"/><path d="M47 48h6v4h-6zM46 60h8v4h-8z" fill="var(--k2)"/>',
    sun: '<circle cx="50" cy="52" r="11"/>' + Array.from({ length: 12 }, (_, i) => { const a = i * Math.PI / 6; return '<path d="M' + (50 + Math.cos(a) * 14).toFixed(1) + ' ' + (52 + Math.sin(a) * 14).toFixed(1) + 'L' + (50 + Math.cos(a + 0.13) * 22).toFixed(1) + ' ' + (52 + Math.sin(a + 0.13) * 22).toFixed(1) + 'L' + (50 + Math.cos(a - 0.13) * 22).toFixed(1) + ' ' + (52 + Math.sin(a - 0.13) * 22).toFixed(1) + 'z"/>'; }).join(''),
    bear: '<circle cx="50" cy="54" r="15"/><circle cx="38" cy="40" r="6"/><circle cx="62" cy="40" r="6"/><ellipse cx="50" cy="60" rx="6" ry="4" fill="var(--k2)"/><circle cx="45" cy="51" r="1.8" fill="var(--k2)"/><circle cx="55" cy="51" r="1.8" fill="var(--k2)"/>',
    peak: '<path d="M24 74l18-32 8 10 10-18 16 40z"/><path d="M54 40l6-6 5 9-5-2z" fill="var(--k2)"/>',
    bolt: '<path d="M56 26L36 56h12l-6 22 22-32H52z"/>',
    flame: '<path d="M50 26c4 10 16 14 16 30a16 16 0 0 1-32 0c0-8 4-12 8-16 0 6 2 10 6 10-2-8 0-16 2-24z"/>',
    snake: '<path d="M60 32c-14-4-24 4-20 12s20 6 22 16-10 16-22 12l2-6c8 2 14 0 13-5s-15-5-20-14 6-24 27-20z"/><circle cx="58" cy="34" r="1.6" fill="var(--k2)"/>',
    volcano: '<path d="M24 74l16-28h20l16 28z"/><path d="M44 46c0-8 4-14 6-20 2 6 6 12 6 20z" opacity=".6"/>',
    zebra: '<circle cx="50" cy="52" r="17"/><path d="M38 40l8 24M46 36l8 30M56 36l6 22" stroke="var(--k2)" stroke-width="4"/>',
    cross: '<path d="M44 30h12v16h16v12H56v16H44V58H28V46h16z"/>'
  };
  const SHAPES = {
    shield: 'M10 8h80v46c0 30-22 48-40 58C32 102 10 84 10 54z',
    round: 'M50 6a52 52 0 1 1-.01 0z',
    diamond: 'M50 4l46 54-46 58L4 58z'
  };
  function crest(club, size) {
    if (!club) return '';
    const id = uid('cr'), sh = SHAPES[club.crest] || SHAPES.shield, p = club.primary || '#333', a = club.accent || '#fff';
    const light = luminance(p) > 0.62, ink = light ? '#141414' : '#fff';
    let pat = '';
    if (club.kit === 'stripes') pat = [20, 40, 60, 80].map(x => '<rect x="' + (x - 5) + '" y="0" width="10" height="120" fill="' + a + '" opacity=".9"/>').join('');
    else if (club.kit === 'hoops') pat = [24, 52, 80].map(y => '<rect x="0" y="' + y + '" width="100" height="12" fill="' + a + '" opacity=".9"/>').join('');
    else if (club.kit === 'halves') pat = '<rect x="50" y="0" width="50" height="120" fill="' + a + '"/>';
    else if (club.kit === 'sash') pat = '<path d="M-10 30L30 -10 110 70 70 110z" fill="' + a + '" opacity=".85"/>';
    else pat = '<circle cx="50" cy="52" r="30" fill="' + a + '" opacity=".14"/>';
    return '<svg class="bz-crest" viewBox="0 0 100 120" width="' + (size || 40) + '" height="' + ((size || 40) * 1.2) + '" role="img" aria-label="' + esc(club.name) + ' crest" style="--k2:' + p + '">' +
      '<defs><clipPath id="' + id + '"><path d="' + sh + '"/></clipPath><linearGradient id="' + id + 'g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".35"/><stop offset=".5" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".22"/></linearGradient></defs>' +
      '<path d="' + sh + '" fill="#0d0c12" transform="translate(0 3)"/>' +
      '<g clip-path="url(#' + id + ')"><rect width="100" height="120" fill="' + p + '"/>' + pat +
      '<circle cx="50" cy="52" r="25" fill="' + p + '" stroke="' + (light ? '#141414' : a) + '" stroke-width="3"/>' +
      '<g fill="' + ink + '">' + (MOTIF[club.motif] || MOTIF.star) + '</g>' +
      '<rect x="0" y="86" width="100" height="18" fill="#0d0c12" opacity=".85"/><text x="50" y="99.5" text-anchor="middle" font-family="Coolvetica,Archivo Black,sans-serif" font-size="13" letter-spacing="2" fill="#fff">' + esc(club.short || '') + '</text>' +
      '<rect width="100" height="120" fill="url(#' + id + 'g)"/></g>' +
      '<path d="' + sh + '" fill="none" stroke="#0d0c12" stroke-width="4"/></svg>';
  }
  function luminance(hex) { const h = String(hex).replace('#', ''); if (h.length < 6) return 0.5; const r = parseInt(h.slice(0, 2), 16) / 255, g = parseInt(h.slice(2, 4), 16) / 255, b = parseInt(h.slice(4, 6), 16) / 255; return 0.2126 * r + 0.7152 * g + 0.0722 * b; }

  /* ---------------- voxel portraits (100 x 100): the same blocky people as the game's characters ---------------- */
  const SKIN = ['#f6d7c3', '#eebf9c', '#d9a074', '#b97b4f', '#8b5a36', '#5e3a22'];
  const HAIR = ['#1b1513', '#3d2a1c', '#6b4528', '#b07a3b', '#e6c77f', '#8a8a8a'];
  const EYE = ['#2a1d14', '#2b4c7e', '#3f6b3a'];
  const shade = (hex, k) => { const h = hex.replace('#', ''); const c = [0, 2, 4].map(i => Math.max(0, Math.min(255, Math.round(parseInt(h.slice(i, i + 2), 16) * k)))); return '#' + c.map(x => x.toString(16).padStart(2, '0')).join(''); };
  function portrait(player, club) {
    const L = player && player.look || { skin: 1, hair: 1, hairCol: 1 }, sk = SKIN[L.skin % 6], hc = HAIR[L.hairCol % 6], skD = shade(sk, 0.84), hcD = shade(hc, 0.7);
    const p = club && club.primary || '#7a52ff', a = club && club.accent || '#fff', R = (x, y, w, h, f, extra) => '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" fill="' + f + '"' + (extra || '') + '/>';
    let kit = R(12, 74, 76, 30, p, ' rx="7"');
    if (club && club.kit === 'stripes') kit += [22, 38, 54, 70].map(x => R(x, 74, 8, 30, a)).join('');
    else if (club && club.kit === 'hoops') kit += R(12, 82, 76, 6, a) + R(12, 94, 76, 6, a);
    else if (club && club.kit === 'halves') kit += R(50, 74, 38, 30, a, ' rx="7"') + R(50, 74, 8, 30, a);
    else if (club && club.kit === 'sash') kit += '<path d="M20 74h14l40 30H58z" fill="' + a + '"/>';
    else if (club && club.kit === 'sleeves') kit += R(12, 76, 14, 28, a, ' rx="5"') + R(74, 76, 14, 28, a, ' rx="5"');
    kit += R(70, 74, 18, 30, '#000', ' opacity=".14" rx="7"') + '<path d="M40 74h20l-10 9z" fill="' + (luminance(p) > 0.6 ? '#141414' : a) + '"/>' + R(41, 66, 18, 10, skD);
    const num = '<text x="70" y="96" text-anchor="middle" font-family="Coolvetica,Archivo Black,sans-serif" font-size="11" fill="' + (luminance(p) > 0.6 ? '#141414' : '#fff') + '" opacity=".9">' + esc(player && player.num || '') + '</text>';
    let back = '', top = '';
    switch (L.hair % 9) {
      case 0: top = R(30, 20, 40, 7, hc) + R(30, 27, 4, 10, hc) + R(66, 27, 4, 10, hc); break;                               // buzz
      case 1: top = R(28, 16, 44, 12, hc) + R(28, 28, 6, 10, hc) + R(66, 28, 6, 10, hc) + R(34, 28, 12, 4, hc); break;        // short with a fringe
      case 2: top = R(28, 18, 44, 10, hc) + R(34, 8, 26, 12, hc) + R(28, 28, 5, 9, hc) + R(67, 28, 5, 9, hc); break;          // quiff
      case 3: top = [28, 36, 44, 52, 60, 66].map((x, i) => R(x, 10 + (i % 2) * 4, 8, 16, i % 2 ? hc : hcD)).join('') + R(28, 24, 44, 5, hc); break; // curls
      case 4: back = R(24, 22, 52, 40, hc, ' rx="3"'); top = R(26, 15, 48, 13, hc) + R(26, 28, 6, 26, hc) + R(68, 28, 6, 26, hc); break; // long
      case 5: top = R(28, 17, 44, 11, hc) + R(42, 5, 16, 13, hc, ' rx="3"') + R(28, 28, 5, 8, hc) + R(67, 28, 5, 8, hc); break;  // bun
      case 6: top = R(44, 6, 12, 20, hc) + R(30, 22, 4, 12, hcD) + R(66, 22, 4, 12, hcD); break;                                 // mohawk
      case 7: top = R(30, 21, 40, 3, skD); break;                                                                                // bald
      default: back = R(18, 8, 64, 36, hc, ' rx="10"'); top = R(22, 10, 56, 18, hc, ' rx="8"') + R(22, 28, 8, 12, hc) + R(70, 28, 8, 12, hc); // afro
    }
    const face = R(30, 22, 40, 44, sk) + R(62, 22, 8, 44, '#000', ' opacity=".09"') + R(30, 22, 40, 4, '#fff', ' opacity=".12"') + R(26, 40, 5, 9, skD) + R(69, 40, 5, 9, skD);
    const bw = [3, 4, 5][L.brow % 3], eyes = R(37, 34 - bw + 2, 10, bw, hcD) + R(53, 34 - bw + 2, 10, bw, hcD) + R(38, 39, 8, 6, '#fff') + R(54, 39, 8, 6, '#fff') + R(41, 40, 4, 5, EYE[L.eye % 3]) + R(57, 40, 4, 5, EYE[L.eye % 3]);
    const nose = R(47, 46, 6, 8, skD), mouth = R(43, 57, 14, 3, '#5b2b25') + R(45, 60, 10, 1.5, '#000', ' opacity=".12"');
    let beard = '';
    if (L.beard === 1) beard = R(30, 52, 40, 14, hc, ' opacity=".35"');
    else if (L.beard === 2) beard = R(30, 54, 40, 12, hc) + R(42, 56, 16, 4, sk) + R(43, 57, 14, 3, '#5b2b25');
    else if (L.beard === 3) beard = R(43, 60, 14, 6, hc) + R(41, 54, 18, 3, hc);
    const band = L.band ? R(29, 26, 42, 4, a) : '';
    return '<svg class="bz-face" viewBox="0 0 100 100" aria-hidden="true">' + back + kit + num + face + top + band + eyes + nose + mouth + beard + '</svg>';
  }

  /* ---------------- virtual signatures ---------------- */
  function signature(name, ink) {
    const r = rng(hash('sig:' + name)), parts = String(name || 'Player').split(' '), letters = (parts[0][0] + parts.slice(-1)[0]).length + 5;
    let x = 12, y = 32, d = 'M' + x + ' ' + (y + 6);
    d += ' C ' + (x + 4) + ' ' + (y - 26) + ', ' + (x + 22) + ' ' + (y - 22) + ', ' + (x + 14) + ' ' + (y + 6); x += 16;  // the big first letter
    for (let i = 0; i < letters; i++) {
      const w = 6 + r() * 9, up = 8 + r() * 16, loop = r() < 0.3;
      d += ' C ' + (x + w * 0.2).toFixed(1) + ' ' + (y - up).toFixed(1) + ', ' + (x + w * (loop ? 1.3 : 0.7)).toFixed(1) + ' ' + (y - up * 0.6).toFixed(1) + ', ' + (x + w).toFixed(1) + ' ' + (y + 2 + r() * 4).toFixed(1);
      x += w; if (i === 2) { x += 6; d += ' M ' + x + ' ' + (y - 8); }
    }
    d += ' M 10 ' + (y + 12) + ' C ' + (x * 0.4) + ' ' + (y + 22) + ', ' + (x * 0.8) + ' ' + (y + 4) + ', ' + Math.min(196, x + 18) + ' ' + (y + 8);   // the underline swoosh
    return '<svg class="bz-sig" viewBox="0 0 ' + Math.max(160, x + 24) + ' 60" preserveAspectRatio="xMidYMid meet" aria-label="Virtual signature"><path d="' + d + '" fill="none" stroke="' + (ink || '#1b2a8f') + '" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  }

  /* ---------------- rarities ---------------- */
  const RARITY = {
    base: ['Base', 'rk0'], bronze: ['Bronze', 'rk1'], silver: ['Silver', 'rk2'], gold: ['Gold', 'rk3'], holo: ['Holo', 'rk4'], legendary: ['Legendary', 'rk5'],
    signature: ['Signature', 'rk6'], goldInk: ['Golden Ink', 'rk7'], blackInk: ['Black Ink', 'rk7'], dual: ['Dual Signature', 'rk7'],
    numbered99: ['Limited /99', 'rk4'], numbered25: ['Limited /25', 'rk6'], numbered5: ['Limited /5', 'rk7'], masterpiece: ['1 of 1 Masterpiece', 'rk8']
  };
  const rank = v => Number((RARITY[v] || RARITY.base)[1].slice(2));

  /* ---------------- the card ---------------- */
  function card(c, cat, opt) {
    opt = opt || {};
    const ids = c.players || [c.player], P = ids.map(i => cat.player(i)).filter(Boolean), p = P[0] || { name: 'Unknown', look: {} }, club = cat.club(p.club);
    const v = c.variant || 'base', R = RARITY[v] || RARITY.base, dual = P.length > 1, inkCol = v === 'goldInk' ? '#c8961e' : v === 'blackInk' ? '#0b0b0b' : v === 'dual' ? '#3a1d8f' : '#1b2a8f';
    const sig = (v === 'signature' || v === 'goldInk' || v === 'blackInk' || v === 'dual');
    const art = dual ? '<div class="bc-pair">' + P.slice(0, 2).map(q => '<div class="bc-half" style="--c1:' + (cat.club(q.club) || {}).primary + '">' + portrait(q, cat.club(q.club)) + '</div>').join('') + '</div>' : portrait(p, club);
    const name = dual ? P.slice(0, 2).map(q => q.name.split(' ').slice(-1)[0]).join(' & ') : p.name;
    return '<div class="bc v-' + v + ' ' + R[1] + ' pk-' + esc(c.pack || 'first-xi') + (opt.cls ? ' ' + opt.cls : '') + '" style="--c1:' + (club && club.primary || '#7a52ff') + ';--c2:' + (club && club.accent || '#fff') + '"' + (c.uid ? ' data-uid="' + esc(c.uid) + '"' : '') + (opt.attrs || '') + '>' +
      '<div class="bc-frame"><div class="bc-art"><i class="bc-pat"></i>' + art + '<i class="bc-holo"></i></div>' +
      '<div class="bc-top"><span class="bc-rt"><b>' + (p.rating || '') + '</b><small>' + esc(p.pos || '') + '</small></span><span class="bc-ids">' + flag(p.nation, 26) + crest(club, 26) + '</span></div>' +
      (sig ? '<div class="bc-sigwrap">' + signature(p.name, inkCol) + (dual ? signature(P[1].name, inkCol) : '') + '</div>' : '') +
      '<div class="bc-plate"><b class="bc-name">' + esc(name) + '</b><span class="bc-club">' + esc(dual ? 'Derby Duo' : (club ? club.name : '')) + '</span></div>' +
      '<div class="bc-foot"><span class="bc-tier">' + esc(R[0]) + '</span>' + (c.serial ? '<span class="bc-serial">' + String(c.serial).padStart(String(c.serialMax || '').length, '0') + '/' + c.serialMax + '</span>' : '<span class="bc-season">26/27</span>') + '</div>' +
      '<i class="bc-glare"></i></div></div>';
  }

  /* ---------------- pack wrappers (160 x 250) ---------------- */
  const PACK = {
    'first-xi': { bg: ['#fff4d6', '#e9c97a'], ink: '#2a1f08', foil: '#c9962f', label: 'FIRST XI', sub: 'CLASSIC', art: 'xi' },
    'electric-nights': { bg: ['#1a0b45', '#5b2cff'], ink: '#fff', foil: '#7df9ff', label: 'ELECTRIC NIGHTS', sub: 'FLOODLIT', art: 'bolt' },
    'blackout': { bg: ['#0a0a0d', '#26262e'], ink: '#e9d9a8', foil: '#b89b52', label: 'BLACKOUT', sub: 'SHADOW CHROME', art: 'eclipse' },
    'crown-glory': { bg: ['#2b0d4a', '#6a2aa8'], ink: '#ffe7a3', foil: '#e2bd5c', label: 'CROWN & GLORY', sub: 'ROYAL', art: 'crown' },
    'derby-day': { bg: ['#1356c4', '#e0333f'], ink: '#fff', foil: '#fff', label: 'DERBY DAY', sub: 'RIVALS', art: 'vs' },
    'god': { bg: ['#fbe9ff', '#ffe7b3'], ink: '#3b2463', foil: '#c58cff', label: 'GOD PACK', sub: 'EARNED ONLY', art: 'halo' },
    'signature': { bg: ['#fffaf0', '#efe1ff'], ink: '#2b2160', foil: '#7a52ff', label: 'SIGNATURE', sub: 'AUTOGRAPHED', art: 'pen' },
    'triple-auto': { bg: ['#121214', '#2c2a24'], ink: '#f2d5a3', foil: '#f2d5a3', label: 'TRIPLE AUTO', sub: '3 SIGNATURES', art: 'triple' },
    'elite-vault': { bg: ['#c9ccd3', '#7f8592'], ink: '#14161c', foil: '#2a2d36', label: 'ELITE VAULT', sub: 'LEGENDARY+', art: 'vault' }
  };
  function packArt(id, n) {
    const k = PACK[id] || PACK['first-xi'], g = uid('pk'), cx = 80;
    let art = '';
    if (k.art === 'xi') art = '<text x="80" y="140" text-anchor="middle" font-family="Coolvetica,Archivo Black,sans-serif" font-size="92" fill="' + k.foil + '" stroke="#5a3d05" stroke-width="2">XI</text>' + Array.from({ length: 9 }, (_, i) => '<line x1="' + (12 + i * 17) + '" y1="36" x2="' + (12 + i * 17) + '" y2="214" stroke="#b8862a" stroke-opacity=".18" stroke-width="2"/>').join('');
    if (k.art === 'bolt') art = '<g opacity=".7">' + [20, 58, 102, 140].map(x => '<path d="M' + x + ' 36l18 70" stroke="#7df9ff" stroke-opacity=".18" stroke-width="14"/>').join('') + '</g><path d="M92 58L56 132h26l-14 64 46-86H86z" fill="#7df9ff" stroke="#fff" stroke-width="3" filter="url(#' + g + 'gl)"/>' + Array.from({ length: 6 }, (_, i) => '<line x1="0" y1="' + (150 + i * 12) + '" x2="160" y2="' + (150 + i * 12) + '" stroke="#ff5ce1" stroke-opacity=".28"/>').join('');
    if (k.art === 'eclipse') art = '<circle cx="80" cy="118" r="46" fill="#000" stroke="' + k.foil + '" stroke-width="3"/><circle cx="96" cy="108" r="40" fill="#1a1a20"/><path d="M0 70L160 190" stroke="#fff" stroke-opacity=".06" stroke-width="40"/>';
    if (k.art === 'crown') art = '<g opacity=".18">' + Array.from({ length: 20 }, (_, i) => '<path d="M' + ((i % 4) * 44 + 10) + ' ' + (Math.floor(i / 4) * 42 + 44) + 'l8 10-8 10-8-10z" fill="#ffe7a3"/>').join('') + '</g><path d="M40 146h80l8-56-24 20-24-34-24 34-24-20z" fill="' + k.foil + '" stroke="#5a3d05" stroke-width="3" stroke-linejoin="round"/><rect x="40" y="150" width="80" height="12" rx="3" fill="' + k.foil + '" stroke="#5a3d05" stroke-width="3"/><circle cx="80" cy="74" r="6" fill="#ff5c8a" stroke="#5a3d05" stroke-width="2"/>';
    if (k.art === 'vs') art = '<path d="M0 30L160 30 160 90 0 170z" fill="#1356c4"/><path d="M160 90L160 220 0 220 0 170z" fill="#e0333f"/><path d="M0 172L160 88" stroke="#fff" stroke-width="6"/><text x="80" y="146" text-anchor="middle" font-family="Coolvetica,Archivo Black,sans-serif" font-size="58" fill="#fff" stroke="#0d0c12" stroke-width="3" transform="rotate(-12 80 130)">VS</text>';
    if (k.art === 'halo') art = Array.from({ length: 16 }, (_, i) => { const a = i * Math.PI / 8; return '<path d="M80 118L' + (80 + Math.cos(a - 0.09) * 140).toFixed(0) + ' ' + (118 + Math.sin(a - 0.09) * 140).toFixed(0) + 'L' + (80 + Math.cos(a + 0.09) * 140).toFixed(0) + ' ' + (118 + Math.sin(a + 0.09) * 140).toFixed(0) + 'z" fill="#fff" opacity=".5"/>'; }).join('') + '<ellipse cx="80" cy="84" rx="34" ry="9" fill="none" stroke="#e8b84a" stroke-width="5"/><circle cx="80" cy="128" r="30" fill="url(#' + g + 'pearl)" stroke="#3b2463" stroke-width="3"/>';
    if (k.art === 'pen') art = '<path d="M30 160c20-50 40 10 56-30s24-40 44-10" fill="none" stroke="#2b2160" stroke-width="4" stroke-linecap="round"/><path d="M104 60l28 28-40 40-16 4 4-16z" fill="#7a52ff" stroke="#2b2160" stroke-width="3" stroke-linejoin="round"/><path d="M80 128l12-12" stroke="#fff" stroke-width="2"/>';
    if (k.art === 'triple') art = [86, 112, 138].map((y, i) => '<path d="M28 ' + y + 'c14-22 26 8 40-10s22-14 34 2 14-6 30-4" fill="none" stroke="' + k.foil + '" stroke-width="3" stroke-linecap="round" opacity="' + (1 - i * 0.2) + '"/>').join('') + '<rect x="18" y="60" width="124" height="112" rx="8" fill="none" stroke="' + k.foil + '" stroke-width="2" stroke-dasharray="4 5"/>';
    if (k.art === 'vault') art = '<circle cx="80" cy="120" r="52" fill="#9aa0ac" stroke="#2a2d36" stroke-width="4"/><circle cx="80" cy="120" r="36" fill="#c3c7cf" stroke="#2a2d36" stroke-width="3"/>' + Array.from({ length: 8 }, (_, i) => { const a = i * Math.PI / 4; return '<rect x="76" y="64" width="8" height="18" rx="2" fill="#2a2d36" transform="rotate(' + (i * 45) + ' 80 120)"/>'; }).join('') + '<circle cx="80" cy="120" r="10" fill="#2a2d36"/>' + [[22, 48], [138, 48], [14, 120], [146, 120]].map(q => '<circle cx="' + q[0] + '" cy="' + q[1] + '" r="4" fill="#2a2d36"/>').join('');
    let edge = 'M0 14'; for (let x = 8; x <= 160; x += 8) edge += 'L' + x + ' ' + (14 + ((x / 8) % 2 ? 6 : 0)); edge += 'L160 236'; for (let x = 152; x >= 0; x -= 8) edge += 'L' + x + ' ' + (236 - ((x / 8) % 2 ? 6 : 0)); edge += 'Z';   // crimped foil top and bottom
    return '<div class="bp bp-' + esc(id) + '"><svg viewBox="0 0 160 250" class="bp-svg" aria-label="' + esc(k.label) + ' pack"><defs>' +
      '<linearGradient id="' + g + '" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="' + k.bg[0] + '"/><stop offset="1" stop-color="' + k.bg[1] + '"/></linearGradient>' +
      '<linearGradient id="' + g + 'f" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity=".55"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>' +
      '<radialGradient id="' + g + 'pearl"><stop offset="0" stop-color="#fff"/><stop offset=".5" stop-color="#ffd9f6"/><stop offset="1" stop-color="#c8b4ff"/></radialGradient>' +
      '<filter id="' + g + 'gl"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>' +
      '<clipPath id="' + g + 'c"><path d="' + edge + '"/></clipPath></defs>' +
      '<g clip-path="url(#' + g + 'c)"><rect width="160" height="250" fill="url(#' + g + ')"/>' + art +
      '<rect x="0" y="0" width="160" height="34" fill="#000" opacity=".22"/><rect x="0" y="216" width="160" height="34" fill="#000" opacity=".22"/>' +
      '<text x="80" y="200" text-anchor="middle" font-family="Coolvetica,Archivo Black,sans-serif" font-size="' + (k.label.length > 11 ? 15 : 19) + '" letter-spacing="1" fill="' + k.ink + '">' + esc(k.label) + '</text>' +
      '<text x="80" y="54" text-anchor="middle" font-family="Coolvetica,Archivo Black,sans-serif" font-size="9" letter-spacing="3" fill="' + k.ink + '" opacity=".8">BITZ · ' + esc(k.sub) + '</text>' +
      '<rect class="bp-sheen" x="-60" y="0" width="60" height="250" fill="url(#' + g + 'f)"/></g>' +
      '<path d="M0 24H160" stroke="' + k.foil + '" stroke-width="1.5" stroke-dasharray="3 3" opacity=".7"/></svg>' +
      (n ? '<b class="bp-count">×' + n + '</b>' : '') + '</div>';
  }

  window.BZART = { card, packArt, crest, flag, portrait, signature, NATION, RARITY, rank, PACK, hash };
  /* shared gradient used to give every flag the same soft sheen */
  document.addEventListener('DOMContentLoaded', () => { if (document.getElementById('bzflagsheen')) return; const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); s.setAttribute('width', '0'); s.setAttribute('height', '0'); s.style.position = 'absolute'; s.innerHTML = '<defs><linearGradient id="bzflagsheen" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff"/><stop offset=".5" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".5"/></linearGradient></defs>'; document.body.appendChild(s); });
})();
