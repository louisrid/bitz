/* BITZ world: a flat white plain fading into fog, soft shadows, three wooden stands with their NPCs, the Gold and
   Purple circles, you, everyone else and their pets. Third-person camera, keyboard and touch controls, tapping people
   and NPCs, prompts, zones and celebrations. The server owns positions; this draws them. */
(function () {
  'use strict';
  const L = globalThis.STAKKZ_WORLD_LAYOUT, AV = globalThis.BZAVATAR;
  const W = { ok: false, on: false, me: null, others: new Map(), you: null, joy: { x: 0, y: 0 }, keys: {}, zoom: 1, blocked: () => false, onPrompt: null, onInteract: null, onPick: null, onZone: null, onMove: null, prompt: null, zone: '', spots: {}, npcs: {}, reduced: false };
  let THREE, renderer, scene, cam, sun, hemi, worldG, ground, raycaster, canvas, last = 0, t0 = 0, cAz = 0.0, cEl = 0.46, cT, userHold = 0, hidden = false, bubbles = [];
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const col3 = c => new THREE.Color(c);
  const OUT = () => new THREE.MeshBasicMaterial({ color: 0x0b0b0f, side: THREE.BackSide });
  function lam(c) { return new THREE.MeshLambertMaterial({ color: c }); }
  function box(par, w, h, d, c, x, y, z, ol) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), typeof c === 'object' ? c : lam(c)); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; if (ol !== 0) { const o = new THREE.Mesh(m.geometry, OUT()); o.scale.set(1 + (ol || 0.05) / w * 0.3 + 0.02, 1 + (ol || 0.05) / h * 0.3 + 0.02, 1 + (ol || 0.05) / d * 0.3 + 0.02); o.castShadow = false; m.add(o); } par.add(m); return m; }
  function cyl(par, rt, rb, h, c, x, y, z, seg, ol) { const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg || 24), typeof c === 'object' ? c : lam(c)); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; if (ol !== 0) { const o = new THREE.Mesh(m.geometry, OUT()); o.scale.set(1.06, 1.03, 1.06); o.castShadow = false; m.add(o); } par.add(m); return m; }
  function label(text, opts) {
    opts = opts || {}; const c = document.createElement('canvas'); c.width = 512; c.height = 128; const tex = new THREE.CanvasTexture(c); tex.anisotropy = 4;
    const draw = (txt) => { const k = c.getContext('2d'); k.clearRect(0, 0, 512, 128); k.font = (opts.brand ? '400 ' + (opts.size || 56) + 'px Coolvetica, Nunito, sans-serif' : '800 ' + (opts.size || 44) + 'px Nunito, system-ui, sans-serif'); const w = Math.min(500, k.measureText(txt).width + 54), h = opts.h || 86, y = 64 - h / 2;
      k.fillStyle = '#0b0b0f'; rr(k, 256 - w / 2 + 3, y + 6, w, h, 22); k.fill(); k.fillStyle = opts.bg || '#fff'; rr(k, 256 - w / 2, y, w, h, 22); k.fill(); k.lineWidth = 6; k.strokeStyle = '#0b0b0f'; k.stroke();
      k.fillStyle = opts.fg || '#0b0b0f'; k.textAlign = 'center'; k.textBaseline = 'middle'; k.fillText(txt, 256, 64, 460); tex.needsUpdate = true; };
    draw(text); if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => draw(text));
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthWrite: false, transparent: true })); sp.scale.set((opts.w || 6) , (opts.w || 6) / 4, 1); sp.renderOrder = 5; sp.userData.draw = draw; return sp;
  }
  function rr(k, x, y, w, h, r) { k.beginPath(); k.moveTo(x + r, y); k.arcTo(x + w, y, x + w, y + h, r); k.arcTo(x + w, y + h, x, y + h, r); k.arcTo(x, y + h, x, y, r); k.arcTo(x, y, x + w, y, r); k.closePath(); }

  /* ---------------- building the plaza ---------------- */
  const anim = [];   // {fn(t,dt)}
  function buildPlaza() {
    const g = worldG;
    /* spawn pad: a black ring, a purple centre and the BITZ mark */
    const ring = new THREE.Mesh(new THREE.RingGeometry(3.3, 3.7, 64), new THREE.MeshBasicMaterial({ color: 0x0b0b0f })); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.02; g.add(ring);
    const centre = new THREE.Mesh(new THREE.CircleGeometry(1.1, 48), new THREE.MeshBasicMaterial({ color: 0x7a52ff })); centre.rotation.x = -Math.PI / 2; centre.position.y = 0.021; g.add(centre);
    /* dotted paths from spawn to each place */
    const dots = []; const targets = [...Object.values(L.spots), ...Object.values(L.circles)];
    for (const tgt of targets) { const len = Math.hypot(tgt.x, tgt.z), n = Math.floor((len - 9) / 2.2); for (let i = 0; i < n; i++) { const k = (4.2 + i * 2.2) / len; if (len * (1 - k) < (tgt.r || 5) + 0.5) break; dots.push([tgt.x * k, tgt.z * k]); } }
    const dotM = new THREE.InstancedMesh(new THREE.CircleGeometry(0.22, 16), new THREE.MeshBasicMaterial({ color: 0x0b0b0f, transparent: true, opacity: 0.18 }), dots.length), d = new THREE.Object3D();
    dots.forEach((p, i) => { d.position.set(p[0], 0.015, p[1]); d.rotation.set(-Math.PI / 2, 0, 0); d.updateMatrix(); dotM.setMatrixAt(i, d.matrix); }); g.add(dotM);
    /* stands */
    for (const s of Object.values(L.spots)) buildStand(s);
    buildCircle(L.circles.gold, 0xf2b705, 0xffe08a); buildCircle(L.circles.purple, 0x7a52ff, 0xc9b5ff);
    /* a few benches and bollards so the plaza reads as a place */
    [[-7, 8, 0.5], [7, 8, -0.5]].forEach(b => { const grp = new THREE.Group(); grp.position.set(b[0], 0, b[1]); grp.rotation.y = b[2]; box(grp, 3.2, 0.18, 0.9, 0xffffff, 0, 0.9, 0); box(grp, 3.2, 0.14, 0.2, 0xffffff, 0, 1.3, -0.4); [-1.2, 1.2].forEach(x => { box(grp, 0.16, 0.9, 0.8, 0x0b0b0f, x, 0.45, 0, 0); box(grp, 0.16, 0.5, 0.14, 0x0b0b0f, x, 1.1, -0.4, 0); }); g.add(grp); });
    for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2, r = 44; cyl(g, 0.22, 0.26, 1.0, 0x0b0b0f, Math.sin(a) * r, 0.5, Math.cos(a) * r, 12, 0); cyl(g, 0.3, 0.3, 0.12, 0x7a52ff, Math.sin(a) * r, 1.06, Math.cos(a) * r, 12, 0); }
    /* banners near the seller: one per collection */
    const flags = [[0xff4d1c, 'RED HOT'], [0xf2b705, 'GOLDEN STAR'], [0x0d1b3d, 'EUROPEAN NIGHTS']];
    flags.forEach((f, i) => { const s = L.spots.seller, grp = new THREE.Group(), a = s.face + Math.PI / 2; grp.position.set(s.x + Math.sin(a) * (i - 1) * 2.4 - Math.sin(s.face) * 5.4, 0, s.z + Math.cos(a) * (i - 1) * 2.4 - Math.cos(s.face) * 5.4); /* a row of three flags behind the stand */ grp.rotation.y = s.face; cyl(grp, 0.07, 0.09, 5.6, 0x0b0b0f, 0, 2.8, 0, 10, 0); const fl = box(grp, 1.6, 1.0, 0.06, f[0], 0.85, 5.0, 0); fl.userData.flag = i; anim.push({ fn: t => { fl.rotation.y = Math.sin(t * 2.2 + i) * 0.18; fl.scale.x = 1 + Math.sin(t * 4 + i) * 0.04; } }); g.add(grp); });
  }
  function buildStand(s) {
    const g = new THREE.Group(); g.position.set(s.x, 0, s.z); g.rotation.y = s.face; worldG.add(g); W.spots[s.id] = g;
    const pad = new THREE.Mesh(new THREE.CircleGeometry(s.r - 0.8, 48), new THREE.MeshLambertMaterial({ color: 0xf1f0f6 })); pad.rotation.x = -Math.PI / 2; pad.position.y = 0.012; pad.receiveShadow = true; g.add(pad);
    const padRing = new THREE.Mesh(new THREE.RingGeometry(s.r - 0.85, s.r - 0.6, 64), new THREE.MeshBasicMaterial({ color: 0x0b0b0f, transparent: true, opacity: 0.85 })); padRing.rotation.x = -Math.PI / 2; padRing.position.y = 0.018; g.add(padRing);
    const WOOD = 0xb07a4a, WOOD2 = 0x8c5a33, DARK = 0x2a2733, accent = s.id === 'seller' ? 0x7a52ff : s.id === 'buyer' ? 0xf2b705 : 0x0b0b0f;
    const stand = new THREE.Group(); stand.position.z = -1.6; g.add(stand);
    if (s.id !== 'dealer') {
      box(stand, 4.0, 1.15, 1.3, WOOD, 0, 0.58, 0); for (let i = 0; i < 6; i++) box(stand, 0.08, 1.1, 0.03, WOOD2, -1.7 + i * 0.68, 0.58, 0.66, 0);
      box(stand, 4.4, 0.16, 1.7, WOOD2, 0, 1.24, 0); box(stand, 4.4, 0.08, 0.2, accent, 0, 1.36, 0.78, 0);
      [-1.85, 1.85].forEach(x => box(stand, 0.2, 4.3, 0.2, DARK, x, 2.15, -0.9));
      const roof = new THREE.Group(); roof.position.set(0, 4.3, -0.3); roof.rotation.x = 0.22; stand.add(roof);
      for (let i = 0; i < 9; i++) box(roof, 0.5, 0.1, 1.9, i % 2 ? 0xffffff : accent, -2.0 + i * 0.5, 0, 0, 0);
      box(roof, 4.6, 0.12, 2.0, DARK, 0, -0.08, 0, 0); for (let i = 0; i < 9; i++) box(roof, 0.5, 0.26, 0.08, i % 2 ? 0xffffff : accent, -2.0 + i * 0.5, -0.1, 0.98, 0);
    } else {
      box(stand, 2.6, 1.0, 1.4, DARK, 0, 0.5, 0); box(stand, 2.8, 0.1, 1.6, 0x0b0b0f, 0, 1.02, 0, 0); box(stand, 2.4, 0.06, 1.2, 0x3b3650, 0, 1.08, 0, 0);
      const bag = new THREE.Group(); bag.position.set(0.1, 1.1, 0.05); stand.add(bag); box(bag, 1.3, 0.3, 0.9, 0x0b0b0f, 0, 0.15, 0); const lid = box(bag, 1.3, 0.9, 0.05, 0x0b0b0f, 0, 0.72, -0.44); lid.rotation.x = -0.25; box(bag, 1.1, 0.1, 0.7, 0x7a52ff, 0, 0.3, 0, 0);
      for (let i = 0; i < 4; i++) box(bag, 0.5, 0.02, 0.7, 0xffffff, -0.35 + i * 0.24, 0.33 + i * 0.03, 0.02, 0);
      [-1.2, 1.2].forEach(x => cyl(stand, 0.08, 0.1, 4.0, 0x0b0b0f, x, 2.0, -0.7, 10, 0)); box(stand, 2.9, 0.9, 0.12, 0x0b0b0f, 0, 3.6, -0.7, 0);
      const neon = label('RACES', { bg: '#0b0b0f', fg: '#c9b5ff', brand: true, size: 64, w: 2.6 }); neon.position.set(0, 3.6, -0.6); stand.add(neon);
      const clock = new THREE.Group(); clock.position.set(2.4, 3.3, -0.4); stand.add(clock); cyl(clock, 0.6, 0.6, 0.12, 0xffffff, 0, 0, 0, 32); const hand = box(clock, 0.06, 0.46, 0.04, 0x0b0b0f, 0, 0.2, 0.1, 0); hand.geometry.translate(0, -0.2, 0); const hand2 = box(clock, 0.06, 0.32, 0.04, 0x7a52ff, 0, 0.14, 0.12, 0); hand2.geometry.translate(0, -0.14, 0); clock.rotation.x = Math.PI / 2; clock.rotation.z = 0; const cg = clock; cg.rotation.set(Math.PI / 2, 0, 0); anim.push({ fn: t => { hand.rotation.z = -t * 0.8; hand2.rotation.z = -t * 0.07; } }); cyl(stand, 0.07, 0.09, 3.3, 0x0b0b0f, 2.4, 1.65, -0.4, 10, 0);
    }
    if (s.id === 'seller') {
      const sets = [[0xc81e0a, 0xffb13d], [0xf3cf5a, 0xfff6c8], [0x0e1f5a, 0xcfe0ff]];
      sets.forEach((c, i) => { for (let k = 0; k < 3; k++) { const p = box(stand, 0.46, 0.7, 0.08, c[0], -1.2 + i * 1.2 + k * 0.06, 1.68 + k * 0.02, -0.1 - k * 0.12, 0); p.rotation.x = -0.12; box(p, 0.46, 0.12, 0.02, c[1], 0, 0.22, 0.045, 0); } });
      box(stand, 0.6, 0.4, 0.5, 0xffffff, 1.6, 1.52, 0.3); box(stand, 0.5, 0.06, 0.4, 0xf2b705, 1.6, 1.74, 0.3, 0);
      const lamp = new THREE.Group(); lamp.position.set(-1.85, 3.1, 0.6); stand.add(lamp); box(lamp, 0.3, 0.4, 0.3, new THREE.MeshBasicMaterial({ color: 0xfff0b8 }), 0, 0, 0, 0); box(lamp, 0.36, 0.06, 0.36, 0x0b0b0f, 0, 0.23, 0, 0); const pl = new THREE.PointLight(0xffd27a, 0.5, 9, 2); pl.position.y = -0.2; lamp.add(pl);
    }
    if (s.id === 'buyer') {
      const sc = new THREE.Group(); sc.position.set(-1.3, 1.32, 0.1); stand.add(sc); cyl(sc, 0.08, 0.1, 1.0, 0x0b0b0f, 0, 0.5, 0, 10, 0); box(sc, 1.4, 0.06, 0.06, 0x0b0b0f, 0, 1.0, 0, 0); [-0.6, 0.6].forEach(x => { const plate = cyl(sc, 0.3, 0.3, 0.05, 0xf2b705, x, 0.55, 0, 20, 0); plate.userData.x = x; anim.push({ fn: t => { plate.position.y = 0.55 + Math.sin(t * 1.5) * 0.08 * Math.sign(x); } }); });
      for (let k = 0; k < 5; k++) box(stand, 0.55, 0.03, 0.8, k % 2 ? 0xffffff : 0xefeef5, 1.2 + k * 0.03, 1.34 + k * 0.03, 0.15, 0);
      box(stand, 0.7, 0.5, 0.5, 0x0b0b0f, 0.1, 1.57, -0.2); box(stand, 0.5, 0.3, 0.05, 0xf2b705, 0.1, 1.6, 0.06, 0);
      const sign = label('WE BUY CARDS', { bg: '#f2b705', brand: true, size: 54, w: 3.4 }); sign.position.set(0, 2.5, 0.9); stand.add(sign);
    }
    /* the NPC: a bigger, more characterful figure behind the counter */
    const looks = { seller: { look: { skin: 2, hair: 'short', hc: 1, outfit: 'overalls', hat: 'cap', acc: '' }, col: '#7a52ff' }, buyer: { look: { skin: 1, hair: 'bun', hc: 0, outfit: 'tux', hat: 'tophat', acc: 'shades' }, col: '#0b0b0f' }, dealer: { look: { skin: 4, hair: 'none', hc: 0, outfit: 'hoodie', hat: '', acc: 'chain' }, col: '#0b0b0f' } }[s.id];
    const npc = AV.make(THREE, looks.look, looks.col); npc.position.set(0, 0, -2.75); npc.scale.setScalar(1.12); npc.rotation.y = Math.PI; g.add(npc);
    if (s.id === 'seller') { const apron = box(npc.userData.body, 0.46, 0.5, 0.03, 0x7a52ff, 0, 0.62, 0.17, 0); apron.renderOrder = 1; box(npc.userData.body, 0.3, 0.12, 0.04, 0xffffff, 0, 0.56, 0.19, 0); }
    if (s.id === 'dealer') { const h = npc.userData.head; box(h, 0.62, 0.1, 0.03, 0x0b0b0f, 0, 0.32, 0.31, 0); [-1, 1].forEach(sg => box(h, 0.22, 0.14, 0.03, 0x0b0b0f, sg * 0.15, 0.3, 0.31, 0)); box(npc.userData.body, 0.52, 0.2, 0.34, 0x0b0b0f, 0, 0.96, -0.05, 0); }
    const name = label(s.who + ' · ' + s.name, { brand: true, size: 50, w: 5.2 }); name.position.set(0, 5.6, -2.0); g.add(name);
    const bubble = label('', { w: 7, size: 40, h: 90 }); bubble.position.set(0, 4.6, -1.6); bubble.visible = false; g.add(bubble); bubbles.push(bubble);
    W.npcs[s.id] = { g, npc, bubble, until: 0, nearT: 0, waveAt: 0 };
    anim.push({ fn: (t, dt) => { const n = W.npcs[s.id], me = W.me, near = me ? Math.hypot(me.x - s.x, me.z - s.z) < s.r + 2 : false; n.npc.userData.anim(t, dt, {});
      if (near && t > n.waveAt) { n.waveAt = t + 9; n.npc.userData.emote('wave'); } if (n.bubble.visible && t > n.until) n.bubble.visible = false;
      if (me && near) { const dx = me.x - s.x, dz = me.z - s.z; const want = Math.atan2(dx, dz) - s.face; n.npc.rotation.y += (Math.atan2(Math.sin(want - n.npc.rotation.y), Math.cos(want - n.npc.rotation.y))) * 0.08; } else n.npc.rotation.y += (Math.atan2(Math.sin(Math.PI - n.npc.rotation.y), Math.cos(Math.PI - n.npc.rotation.y))) * 0.04; } });
  }
  function buildCircle(c, color, pale) {
    const g = new THREE.Group(); g.position.set(c.x, 0, c.z); worldG.add(g);
    const disc = new THREE.Mesh(new THREE.CircleGeometry(c.r, 64), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.16 })); disc.rotation.x = -Math.PI / 2; disc.position.y = 0.014; g.add(disc);
    const ring = new THREE.Mesh(new THREE.RingGeometry(c.r - 0.35, c.r, 96), new THREE.MeshBasicMaterial({ color })); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.02; g.add(ring);
    const ring2 = new THREE.Mesh(new THREE.RingGeometry(c.r - 0.55, c.r - 0.45, 96), new THREE.MeshBasicMaterial({ color: 0x0b0b0f, transparent: true, opacity: 0.6 })); ring2.rotation.x = -Math.PI / 2; ring2.position.y = 0.022; g.add(ring2);
    const inner = new THREE.Mesh(new THREE.RingGeometry(1.2, 1.5, 48), new THREE.MeshBasicMaterial({ color })); inner.rotation.x = -Math.PI / 2; inner.position.y = 0.024; g.add(inner);
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(c.r - 0.2, c.r - 0.2, 5, 48, 1, true), new THREE.MeshBasicMaterial({ color: pale, transparent: true, opacity: 0.1, side: THREE.DoubleSide, depthWrite: false })); beam.position.y = 2.5; g.add(beam);
    const N = 26, parts = new THREE.InstancedMesh(new THREE.BoxGeometry(0.16, 0.16, 0.16), new THREE.MeshBasicMaterial({ color }), N), d = new THREE.Object3D(), seeds = Array.from({ length: N }, () => [Math.random() * Math.PI * 2, 0.6 + Math.random() * (c.r - 1), Math.random() * 4, 0.5 + Math.random()]);
    g.add(parts); const pl = new THREE.PointLight(color, 0.7, 14, 2); pl.position.y = 1.5; g.add(pl);
    const glyph = label(c.id === 'gold' ? '×3 CASH' : 'FREE PACKS', { bg: c.id === 'gold' ? '#f2b705' : '#7a52ff', fg: c.id === 'gold' ? '#0b0b0f' : '#fff', brand: true, size: 56, w: 4 }); glyph.position.y = 3.6; g.add(glyph);
    anim.push({ fn: t => { ring.scale.setScalar(1 + Math.sin(t * 2) * 0.012); inner.rotation.z = t * 0.6; disc.material.opacity = 0.14 + Math.sin(t * 2) * 0.04; beam.material.opacity = 0.08 + Math.sin(t * 1.4) * 0.03; glyph.position.y = 3.6 + Math.sin(t * 1.5) * 0.12;
      for (let i = 0; i < N; i++) { const s = seeds[i], y = (s[2] + t * s[3]) % 4; d.position.set(Math.sin(s[0] + t * 0.3) * s[1], y, Math.cos(s[0] + t * 0.3) * s[1]); d.rotation.set(t, t * 0.7, 0); const k = 1 - y / 4; d.scale.setScalar(0.4 + k * 0.8); d.updateMatrix(); parts.setMatrixAt(i, d.matrix); } parts.instanceMatrix.needsUpdate = true; } });
  }

  /* ---------------- people ---------------- */
  function figure(o, col) {
    const g = new THREE.Group(), av = AV.make(THREE, o.l || {}, col); g.add(av);
    const tag = label((o.n || 'Player') + (o.level ? '  ·  Lv ' + o.level : ''), { size: 44, w: 3.4, h: 84 }); tag.position.y = 4.7; g.add(tag);
    let pet = null; if (o.pet) { pet = AV.pet(THREE, o.pet); pet.position.set(1.3, 0, -0.6); g.add(pet); }
    g.userData = { av, tag, pet, col };
    return g;
  }
  function add(o, col) {
    if (!o || !o.i) return; drop(o.i);
    const g = figure(o, col || '#7a52ff'); g.position.set(o.p ? o.p[0] : 0, o.p ? o.p[1] : 0, o.p ? o.p[2] : 0); g.rotation.y = o.p ? o.p[3] : 0; worldG.add(g);
    W.others.set(o.i, { i: o.i, f: o.f, n: o.n, l: o.l, pet: o.pet, level: o.level, nw: o.nw, g, x: g.position.x, y: g.position.y, z: g.position.z, ry: g.rotation.y, tx: g.position.x, ty: g.position.y, tz: g.position.z, try: g.rotation.y, moving: false, lastAt: performance.now() });
  }
  function drop(i) { const o = W.others.get(i); if (!o) return; worldG.remove(o.g); dispose(o.g); W.others.delete(i); }
  function dispose(g) { g.traverse(q => { if (q.material && q.material.map && q.isSprite) q.material.map.dispose(); }); }
  function snap(rows) { const now = performance.now(); for (const r of rows) { const o = W.others.get(r[0]); if (!o) continue; o.tx = r[1]; o.ty = r[2]; o.tz = r[3]; o.try = r[4]; o.moving = !!r[5] || Math.hypot(o.tx - o.x, o.tz - o.z) > 0.05; o.lastAt = now; } }
  function emote(i, e) { const o = i === 'me' ? W.me : W.others.get(i); if (o && o.g) o.g.userData.av.userData.emote(e); }
  function stat(i, nw, level) { const o = W.others.get(i); if (!o) return; o.nw = nw; o.level = level; o.g.userData.tag.userData.draw((o.n || 'Player') + '  ·  Lv ' + level); }
  function clear() { for (const i of [...W.others.keys()]) drop(i); }
  function setMe(look, name, pet, col) {
    const keep = W.me ? { x: W.me.x, y: W.me.y, z: W.me.z, ry: W.me.ry } : null;
    if (W.me) { worldG.remove(W.me.g); dispose(W.me.g); }
    const g = figure({ n: name, l: look, pet, level: W.level }, col); worldG.add(g);
    W.me = Object.assign({ g, x: 0, y: 0, z: 2, ry: 0, vy: 0, moving: false, running: false, grounded: true, name, look, pet, col }, keep || {});
    g.position.set(W.me.x, W.me.y, W.me.z); g.rotation.y = W.me.ry;
  }
  function spawnAt(x, z) { if (!W.me) return; W.me.x = x; W.me.z = z; W.me.y = 0; W.me.vy = 0; }
  function pose() { const m = W.me; return m ? [m.x, m.y, m.z, m.ry, m.moving ? 1 : 0] : null; }
  function jump() { const m = W.me; if (!m || !m.grounded || (W.blocked && W.blocked())) return; m.vy = 9.5; m.grounded = false; W.touched(); }

  /* ---------------- input ---------------- */
  const K = {}; let touch = false, lastW = 0, ptr = new Map(), dragged = 0, downAt = 0, pinch0 = 0, zoom0 = 1;
  function bindInput() {
    addEventListener('keydown', e => { if (/^(INPUT|TEXTAREA)$/.test(e.target.tagName)) return; const k = e.key.toLowerCase(); if (W.blocked && W.blocked()) { K.w = K.a = K.s = K.d = false; return; } W.touched();
      if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' ', 'shift'].includes(k)) e.preventDefault();
      K[k] = true; if (k === ' ') jump(); if (k === 'e' && W.prompt && W.onInteract) W.onInteract(W.prompt); if (k === 'shift') W.me && (W.me.running = true); });
    addEventListener('keyup', e => { const k = e.key.toLowerCase(); K[k] = false; if (k === 'shift' && W.me) W.me.running = false; });
    addEventListener('blur', () => { for (const k in K) K[k] = false; });
    canvas.addEventListener('pointerdown', e => { if (e.pointerType === 'touch') { touch = true; document.documentElement.classList.add('touch'); } ptr.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY }); dragged = 0; downAt = performance.now(); if (ptr.size === 2) { const p = [...ptr.values()]; pinch0 = Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y); zoom0 = W.zoom; } canvas.setPointerCapture && canvas.setPointerCapture(e.pointerId); W.touched(); });
    canvas.addEventListener('pointermove', e => { const p = ptr.get(e.pointerId); if (!p) return; const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY; dragged += Math.abs(dx) + Math.abs(dy);
      if (ptr.size === 1) { cAz -= dx * 0.0062; cEl = clamp(cEl + dy * 0.004, 0.12, 1.25); userHold = performance.now() + 1500; }
      else if (ptr.size === 2) { const q = [...ptr.values()]; const d = Math.hypot(q[0].x - q[1].x, q[0].y - q[1].y); if (pinch0) W.zoom = clamp(zoom0 * pinch0 / d, 0.55, 2.2); } });
    const up = e => { const p = ptr.get(e.pointerId); ptr.delete(e.pointerId); if (!p) return; if (dragged < 10 && performance.now() - downAt < 450 && ptr.size === 0) pick(e.clientX, e.clientY); };
    canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
    canvas.addEventListener('wheel', e => { e.preventDefault(); W.zoom = clamp(W.zoom * (e.deltaY > 0 ? 1.1 : 0.9), 0.55, 2.2); }, { passive: false });
    canvas.addEventListener('contextmenu', e => e.preventDefault());
  }
  function pick(cx, cy) {
    if ((W.blocked && W.blocked()) || !W.onPick) return;
    const r = canvas.getBoundingClientRect(), v = new THREE.Vector2(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
    raycaster.setFromCamera(v, cam);
    const targets = []; W.others.forEach(o => targets.push(o.g)); for (const id in W.npcs) targets.push(W.npcs[id].npc);
    const hits = raycaster.intersectObjects(targets, true); if (!hits.length) return;
    let obj = hits[0].object; while (obj && !targets.includes(obj)) obj = obj.parent; if (!obj) return;
    for (const o of W.others.values()) if (o.g === obj) { W.onPick(o); return; }
    for (const id in W.npcs) if (W.npcs[id].npc === obj) { const s = L.spots[id], me = W.me; if (me && Math.hypot(me.x - s.x, me.z - s.z) <= s.r + 1 && W.onInteract) W.onInteract(s); else W.say(id, 'Come closer!', 2); return; }
  }
  W.touched = () => { W.lastInput = performance.now(); };
  W.say = (id, text, secs) => { const n = W.npcs[id]; if (!n) return; n.bubble.userData.draw(text); n.bubble.visible = true; n.until = (performance.now() - t0) / 1000 + (secs || 3); };

  /* ---------------- celebrations ---------------- */
  const fx = [];
  function celebrate(kind, at) {
    const m = W.me; const x = at ? at.x : m ? m.x : 0, z = at ? at.z : m ? m.z : 0, cols = kind === 'gold' ? [0xf2b705, 0xffe08a, 0xffffff] : kind === 'one' ? [0xffffff, 0xf2b705, 0x7a52ff, 0xff4d1c] : [0x7a52ff, 0xc9b5ff, 0xffffff, 0x0b0b0f];
    const n = kind === 'one' ? 90 : 40, mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.22, 0.3, 0.06), new THREE.MeshBasicMaterial({ color: 0xffffff }), n), d = new THREE.Object3D(), c3 = new THREE.Color();
    const parts = []; for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, sp = 3 + Math.random() * 6; parts.push({ x, y: 2.5, z, vx: Math.sin(a) * sp, vy: 6 + Math.random() * 8, vz: Math.cos(a) * sp, r: Math.random() * 6, rs: (Math.random() - 0.5) * 10 }); mesh.setColorAt(i, c3.set(cols[i % cols.length])); }
    mesh.instanceColor.needsUpdate = true; worldG.add(mesh); fx.push({ mesh, parts, d, t: 0, life: kind === 'one' ? 4 : 2.6 });
    if (kind === 'one') { flash(0xfff3b0, 1.2); if (m) m.g.userData.av.userData.emote('cheer'); }
    if (m && m.g.userData.pet) m.g.userData.excited = (performance.now() - t0) / 1000 + 3;
  }
  let flashUntil = 0, flashCol = null;
  function flash(color, secs) { flashCol = new THREE.Color(color); flashUntil = (performance.now() - t0) / 1000 + secs; }
  let orbit = null;
  function setOrbit(on) { if (on && !orbit) { orbit = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.22, 0.22, 0.08, 12), new THREE.MeshBasicMaterial({ color: 0xf2b705 }), 8); worldG.add(orbit); } if (!on && orbit) { worldG.remove(orbit); orbit = null; } }

  /* ---------------- the frame ---------------- */
  function frame(now) {
    requestAnimationFrame(frame);
    if (hidden || !W.on) { last = now; return; }
    const dt = Math.min(0.05, (now - last) / 1000 || 0.016); last = now; const t = (now - t0) / 1000;
    const m = W.me, locked = !!(W.blocked && W.blocked());
    if (m) {
      let ix = 0, iz = 0;
      if (!locked) { if (K.w || K.arrowup) iz -= 1; if (K.s || K.arrowdown) iz += 1; if (K.a || K.arrowleft) ix -= 1; if (K.d || K.arrowright) ix += 1; ix += W.joy.x; iz += W.joy.y; }
      const len = Math.hypot(ix, iz); if (len > 1) { ix /= len; iz /= len; }
      const moving = len > 0.08, running = moving && (m.running || len > 0.96 && touch && len > 0.98);
      if (moving) {
        const sp = (running ? L.run : L.speed) * Math.min(1, len), fx2 = Math.sin(cAz) * -iz + Math.cos(cAz) * ix, fz2 = Math.cos(cAz) * -iz - Math.sin(cAz) * ix;
        m.x = clamp(m.x + fx2 * sp * dt, -L.limit, L.limit); m.z = clamp(m.z + fz2 * sp * dt, -L.limit, L.limit);
        const want = Math.atan2(fx2, fz2); m.ry += Math.atan2(Math.sin(want - m.ry), Math.cos(want - m.ry)) * Math.min(1, dt * 14);
        /* keep out of the stands themselves: a rectangle behind each counter, in the stand's own frame */
        for (const s of Object.values(L.spots)) { const lx = m.x - s.x, lz = m.z - s.z, c = Math.cos(s.face), sn = Math.sin(s.face), rx = c * lx - sn * lz; let rz = sn * lx + c * lz;
          if (Math.abs(rx) < 2.6 && rz < -0.5 && rz > -4.6) { rz = rz > -2.5 ? -0.5 : -4.6; m.x = s.x + rx * c + rz * sn; m.z = s.z - rx * sn + rz * c; } }
        W.touched();
      }
      m.moving = moving; m.runningNow = running;
      if (!m.grounded || m.vy) { m.vy -= 26 * dt; m.y += m.vy * dt; if (m.y <= 0) { m.y = 0; m.vy = 0; if (!m.grounded) { m.grounded = true; m.g.userData.av.userData.M.scale.set(2.15, 1.8, 2.15); } } }
      const Ms = m.g.userData.av.userData.M.scale; Ms.x += (2 - Ms.x) * 0.2; Ms.y += (2 - Ms.y) * 0.2; Ms.z += (2 - Ms.z) * 0.2;
      m.g.position.set(m.x, m.y, m.z); m.g.rotation.y = m.ry;
      m.g.userData.av.userData.anim(t, dt, { moving, running, speed: running ? 1.5 : 1, jumping: !m.grounded });
      if (m.g.userData.pet) petFollow(m.g, m, t, dt, moving, m.g.userData.excited > t);
      /* prompt and zone */
      let best = null, bd = 1e9; for (const s of Object.values(L.spots)) { const d = Math.hypot(m.x - s.x, m.z - s.z); if (d <= s.r && d < bd) { bd = d; best = s; } }
      if ((best && best.id) !== (W.prompt && W.prompt.id)) { W.prompt = best; if (W.onPrompt) W.onPrompt(best); }
      const zone = Math.hypot(m.x - L.circles.gold.x, m.z - L.circles.gold.z) <= L.circles.gold.r ? 'gold' : Math.hypot(m.x - L.circles.purple.x, m.z - L.circles.purple.z) <= L.circles.purple.r ? 'purple' : '';
      if (zone !== W.zone) { W.zone = zone; if (W.onZone) W.onZone(zone); }
      /* camera: behind and above, with the user's orbit kept */
      const dist = 24 * W.zoom, ty = 2.6 + m.y * 0.5; if (!cT) cT = new THREE.Vector3(m.x, ty, m.z); cT.lerp(new THREE.Vector3(m.x, ty, m.z), 0.18);
      cam.position.set(cT.x + Math.sin(cAz) * Math.cos(cEl) * dist, Math.max(1.2, cT.y + Math.sin(cEl) * dist), cT.z + Math.cos(cAz) * Math.cos(cEl) * dist); cam.lookAt(cT);
      sun.position.set(m.x + 26, 48, m.z + 20); sun.target.position.set(m.x, 0, m.z); sun.target.updateMatrixWorld();
      if (orbit) { const d = new THREE.Object3D(); for (let i = 0; i < 8; i++) { const a = t * 1.6 + i / 8 * Math.PI * 2; d.position.set(m.x + Math.sin(a) * 1.9, 1.6 + Math.sin(t * 3 + i) * 0.3, m.z + Math.cos(a) * 1.9); d.rotation.set(Math.PI / 2 + Math.sin(t + i) * 0.4, 0, a); d.updateMatrix(); orbit.setMatrixAt(i, d.matrix); } orbit.instanceMatrix.needsUpdate = true; }
    }
    W.others.forEach(o => { const k = Math.min(1, dt * 10); o.x += (o.tx - o.x) * k; o.y += (o.ty - o.y) * k; o.z += (o.tz - o.z) * k; let d = o.try - o.ry; d = Math.atan2(Math.sin(d), Math.cos(d)); o.ry += d * k; if (now - o.lastAt > 400) o.moving = false;
      o.g.position.set(o.x, o.y, o.z); o.g.rotation.y = o.ry; o.g.userData.av.userData.anim(t, dt, { moving: o.moving, speed: 1 }); if (o.g.userData.pet) petFollow(o.g, o, t, dt, o.moving, false); });
    for (const a of anim) a.fn(t, dt);
    for (let i = fx.length - 1; i >= 0; i--) { const f = fx[i]; f.t += dt; const g = 18; f.parts.forEach((p, k) => { p.vy -= g * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; if (p.y < 0.05) { p.y = 0.05; p.vy = 0; p.vx *= 0.9; p.vz *= 0.9; } p.r += p.rs * dt; f.d.position.set(p.x, p.y, p.z); f.d.rotation.set(p.r, p.r * 0.7, 0); f.d.scale.setScalar(Math.max(0.01, 1 - Math.max(0, f.t - f.life + 0.6) / 0.6)); f.d.updateMatrix(); f.mesh.setMatrixAt(k, f.d.matrix); }); f.mesh.instanceMatrix.needsUpdate = true; if (f.t > f.life) { worldG.remove(f.mesh); fx.splice(i, 1); } }
    if (flashCol) { const k = Math.max(0, flashUntil - t); scene.background.copy(new THREE.Color(0xffffff)).lerp(flashCol, Math.min(1, k) * 0.7); scene.fog.color.copy(scene.background); if (k <= 0) flashCol = null; }
    renderer.render(scene, cam);
  }
  function petFollow(g, o, t, dt, moving, excited) {
    const pet = g.userData.pet, want = new THREE.Vector3(-Math.sin(o.ry + 2.2) * 1.5, 0, -Math.cos(o.ry + 2.2) * 1.5);
    pet.position.lerp(want, Math.min(1, dt * 4)); pet.rotation.y = Math.atan2(-pet.position.x, -pet.position.z) + Math.PI; pet.userData.anim(t, moving, excited);
  }
  function resize() { const w = innerWidth, h = innerHeight; renderer.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); }

  function init(cv) {
    THREE = window.THREE; if (!THREE) return false; canvas = cv;
    try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' }); } catch (e) { return false; }
    const small = Math.min(innerWidth, innerHeight) < 700;
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, small ? 2 : 2)); renderer.setClearColor(0xffffff, 1); renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    scene = new THREE.Scene(); scene.background = new THREE.Color(0xffffff); scene.fog = new THREE.Fog(0xffffff, 70, 210);
    cam = new THREE.PerspectiveCamera(42, 1, 0.5, 500); raycaster = new THREE.Raycaster();
    hemi = new THREE.HemisphereLight(0xffffff, 0xe6e3f0, 0.9); scene.add(hemi);
    sun = new THREE.DirectionalLight(0xffffff, 0.78); sun.position.set(26, 48, 20); sun.castShadow = true; sun.shadow.mapSize.set(small ? 1024 : 2048, small ? 1024 : 2048);
    Object.assign(sun.shadow.camera, { left: -44, right: 44, top: 44, bottom: -44, near: 1, far: 160 }); sun.shadow.camera.updateProjectionMatrix(); sun.shadow.bias = -0.0008; sun.shadow.normalBias = 0.02; sun.shadow.radius = 3; scene.add(sun); scene.add(sun.target);
    worldG = new THREE.Group(); scene.add(worldG);
    ground = new THREE.Mesh(new THREE.PlaneGeometry(L.size * 2, L.size * 2), new THREE.MeshLambertMaterial({ color: 0xffffff })); ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
    const edge = new THREE.Mesh(new THREE.RingGeometry(L.limit + 0.3, L.limit + 0.8, 128), new THREE.MeshBasicMaterial({ color: 0x0b0b0f, transparent: true, opacity: 0.12 })); edge.rotation.x = -Math.PI / 2; edge.position.y = 0.01; scene.add(edge);
    buildPlaza(); bindInput(); resize(); addEventListener('resize', resize);
    document.addEventListener('visibilitychange', () => { hidden = document.hidden; });
    t0 = performance.now(); last = t0; W.ok = true; requestAnimationFrame(frame);
    return true;
  }
  Object.assign(W, { init, add, drop, snap, emote, stat, clear, setMe, spawnAt, pose, jump, celebrate, flash, setOrbit, L, camera: () => cam, renderer: () => renderer });
  globalThis.BZWORLD = W;
})();
