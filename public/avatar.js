/* BITZ avatars: chunky voxel people and pets with thick black outlines, proper faces, blinking, a real walk cycle and
   emotes. Every owned cosmetic still renders: the outfit, hat, extra and pet specs come from avatar-data.js. */
(function () {
  'use strict';
  const D = globalThis.BITZ_AVATAR_DATA;
  function make(THREE, look, col, part) {
    look = Object.assign({ skin: 0, hair: 'short', hc: 0, outfit: 'tee', hat: '', acc: '' }, look || {});
    const FX = D.FULLV[look.outfit]; if (FX) look = Object.assign({}, look, { hat: '', acc: '', hair: 'none' });
    const cache = new Map();
    const L = c => { const k = 'l' + c; if (!cache.has(k)) cache.set(k, new THREE.MeshLambertMaterial({ color: c })); return cache.get(k); };
    const OUT = new THREE.MeshBasicMaterial({ color: 0x0b0b0f, side: THREE.BackSide });
    const BX = (w, h, d) => new THREE.BoxGeometry(w, h, d);
    const mesh = (geo, mat, x, y, z, outline) => { const m = new THREE.Mesh(geo, mat); m.position.set(x || 0, y || 0, z || 0); m.castShadow = true; m.receiveShadow = false; if (outline) { const o = new THREE.Mesh(geo, OUT); o.scale.setScalar(1 + outline); o.castShadow = false; m.add(o); } return m; };
    const voxMat = (c, f) => { const hex = new THREE.Color(c).getHex();
      return f === 'g' || f === 'o' ? new THREE.MeshPhongMaterial({ color: hex, emissive: hex, emissiveIntensity: 0.75 }) : f === 'f' || f === 'p' ? new THREE.MeshPhongMaterial({ color: hex, emissive: hex, emissiveIntensity: 1, transparent: true, opacity: 0.92 })
        : f === 't' ? new THREE.MeshPhongMaterial({ color: hex, transparent: true, opacity: 0.5, emissive: hex, emissiveIntensity: 0.25 }) : f === 's' ? new THREE.MeshPhongMaterial({ color: hex, shininess: 110, specular: 0xffffff }) : L(hex); };
    const FL = [];
    const voxBuild = (par, spec, colourOf) => (spec || []).forEach(q => { const o = mesh(BX(q[0], q[1], q[2]), voxMat(colourOf ? colourOf(q[3]) : q[3], q[7]), q[4], q[5], q[6], 0); if (q[7] === 'f' || q[7] === 'p' || q[7] === 'o') { const u = o.userData; u.fl = Math.random() * 9; u.y0 = q[5]; u.h = q[1]; u.x0 = q[4]; if (q[7] === 'p') { u.p = 1; u.w = 0.5 + Math.random() * 0.5; } if (q[7] === 'o') { u.o = 1; u.r = Math.hypot(q[4], q[6]); u.a0 = Math.atan2(q[4], q[6]); u.w = 0.9 + (q[5] * 7 % 1) * 0.6; } FL.push(o); } par.add(o); });
    const G = new THREE.Group(), M = new THREE.Group(), body = new THREE.Group(), bacc = new THREE.Group(), head = new THREE.Group(), core = new THREE.Group(), hatG = new THREE.Group(), hacc = new THREE.Group(), face = new THREE.Group();
    G.add(M); M.add(body); M.add(bacc); M.add(head); head.add(core); head.add(hatG); head.add(hacc); core.add(face);
    M.scale.setScalar(2); M.position.y = 0.23; head.position.set(0, 0.94, 0);
    const add = (par, w, h, d, c, x, y, z, ol) => { const o = mesh(BX(w, h, d), typeof c === 'object' ? c : L(c), x, y, z, ol == null ? 0.06 : ol); par.add(o); return o; };
    const sk = D.SKIN[look.skin | 0] || D.SKIN[0], hc = D.HAIRC[look.hc | 0] || D.HAIRC[0], o = D.OUTC[look.outfit] ? look.outfit : 'tee', oc = D.OUTC[o];
    const gold = new THREE.MeshPhongMaterial({ color: 0xffd60a, shininess: 90, specular: 0xffffff });
    const OX = D.OUTX[o] || (FX ? { m: FX.m } : {}), hsk = FX && FX.hand ? FX.hand : sk, omat = c => OX.m ? voxMat(c, OX.m) : L(c), cOf = c => c === 'hc' ? hc : c === 'sk' ? sk : c === 'col' ? col : c, vox = (par, spec) => voxBuild(par, spec, cOf);
    const top = o === 'gold' ? gold : omat(oc[0] === 'team' ? col : oc[0]), pants = o === 'gold' ? gold : omat(oc[1]), bare = o === 'tee' || o === 'overalls';
    /* legs: thigh + shin + shoe, so they bend a little when walking */
    const legs = [-1, 1].map(sg => { const q = new THREE.Group(); q.position.set(sg * 0.13, 0.42, 0); add(q, 0.22, 0.34, 0.24, pants, 0, -0.17, 0); add(q, 0.25, 0.1, 0.31, oc[2], 0, -0.38, 0.03); if (o === 'track') add(q, 0.03, 0.32, 0.1, 0xffffff, sg * 0.118, -0.16, 0, 0); body.add(q); return q; });
    add(body, 0.52, 0.5, 0.3, top, 0, 0.67, 0);
    add(body, 0.5, 0.06, 0.3, pants, 0, 0.44, 0, 0);
    if (o === 'rain') add(body, 0.58, 0.16, 0.36, top, 0, 0.47, 0);
    const arms = [-1, 1].map(sg => { const q = new THREE.Group(); q.position.set(sg * 0.34, 0.9, 0); add(q, 0.14, bare ? 0.2 : 0.36, 0.2, top, 0, bare ? -0.1 : -0.18, 0); add(q, 0.14, bare ? 0.28 : 0.12, 0.2, hsk, 0, bare ? -0.34 : -0.42, 0); if (o === 'track') add(q, 0.03, 0.36, 0.1, 0xffffff, sg * 0.078, -0.18, 0, 0); body.add(q); return q; });
    if (o === 'hoodie') { add(body, 0.42, 0.14, 0.12, top, 0, 0.9, -0.2); add(body, 0.28, 0.03, 0.02, 0x111111, 0, 0.58, 0.16, 0); }
    if (o === 'overalls') { add(body, 0.34, 0.26, 0.03, oc[1], 0, 0.6, 0.16, 0); add(body, 0.07, 0.22, 0.03, oc[1], -0.13, 0.82, 0.16, 0); add(body, 0.07, 0.22, 0.03, oc[1], 0.13, 0.82, 0.16, 0); }
    if (o === 'track') add(body, 0.04, 0.5, 0.02, 0xffffff, 0, 0.67, 0.16, 0);
    if (OX.deco) vox(body, OX.deco);
    if (FX) { vox(body, FX.b); vox(bacc, FX.k); vox(hatG, FX.h); }
    if (o === 'chef') { [0.78, 0.66, 0.54].forEach(y => add(body, 0.05, 0.05, 0.02, 0x151515, 0.1, y, 0.16, 0)); add(body, 0.4, 0.3, 0.02, 0xffffff, 0, 0.5, 0.17, 0); }
    if (o === 'camo') [[-0.14, 0.78], [0.12, 0.6], [-0.05, 0.52], [0.16, 0.84]].forEach(q => add(body, 0.14, 0.1, 0.02, 0x2f3d1c, q[0], q[1], 0.16, 0));
    if (o === 'punk') { add(body, 0.04, 0.5, 0.02, 0xff4b3e, 0.05, 0.67, 0.16, 0); [[-0.18, 0.86], [0.18, 0.86]].forEach(q => add(body, 0.06, 0.06, 0.03, 0xdddddd, q[0], q[1], 0.16, 0)); }
    if (o === 'ninja') add(body, 0.56, 0.07, 0.34, 0xff4b3e, 0, 0.46, 0);
    if (o === 'royal') { add(body, 0.56, 0.08, 0.34, 0xffd60a, 0, 0.88, 0); add(body, 0.06, 0.5, 0.03, 0xffd60a, 0, 0.67, 0.16, 0); add(body, 0.6, 0.62, 0.05, 0x7b2cbf, 0, 0.62, -0.19); }
    if (o === 'cosmic') { const glow = new THREE.MeshPhongMaterial({ color: 0xb388ff, emissive: 0x6a2cff, emissiveIntensity: 0.9, shininess: 80 }); add(body, 0.06, 0.5, 0.03, glow, 0, 0.67, 0.16, 0); [[-0.15, 0.8], [0.16, 0.58], [-0.1, 0.52], [0.14, 0.82]].forEach(q => add(body, 0.05, 0.05, 0.02, 0xffffff, q[0], q[1], 0.16, 0)); add(body, 0.58, 0.06, 0.36, glow, 0, 0.44, 0); }
    if (o === 'tux') { add(body, 0.16, 0.42, 0.02, 0xffffff, 0, 0.69, 0.16, 0); add(body, 0.2, 0.07, 0.03, 0xff4b3e, 0, 0.87, 0.17, 0); }
    if (o === 'astro') { add(body, 0.28, 0.16, 0.03, 0x3fa9ff, 0, 0.72, 0.16, 0); add(body, 0.4, 0.4, 0.16, 0x9aa0a6, 0, 0.7, -0.23); const h = add(body, 0.82, 0.76, 0.76, new THREE.MeshLambertMaterial({ color: 0xbfe9ff, transparent: true, opacity: 0.32 }), 0, 1.24, 0, 0); h.castShadow = false; }
    if (look.acc === 'scarf') { add(bacc, 0.58, 0.1, 0.38, 0xff4b3e, 0, 0.95, 0); add(bacc, 0.12, 0.26, 0.04, 0xff4b3e, 0.14, 0.8, 0.18); }
    if (/^scarf_/.test(look.acc)) { const cc = D.CLUBCOL && D.CLUBCOL[look.acc.slice(6)] || ['#7a52ff', '#ffffff']; add(bacc, 0.6, 0.11, 0.4, cc[0], 0, 0.95, 0); add(bacc, 0.6, 0.04, 0.41, cc[1], 0, 0.95, 0, 0); add(bacc, 0.12, 0.3, 0.04, cc[0], -0.14, 0.78, 0.19); add(bacc, 0.12, 0.08, 0.05, cc[1], -0.14, 0.66, 0.19, 0); }
    if (look.acc === 'cape') add(bacc, 0.52, 0.64, 0.04, 0xff4b3e, 0, 0.62, -0.18);
    if (D.ACCV[look.acc]) { vox(bacc, D.ACCV[look.acc].b); vox(hacc, D.ACCV[look.acc].h); }
    if (look.acc === 'phoenix') { const fire = [0xff4b3e, 0xff9f1c, 0xffd60a].map(c => new THREE.MeshPhongMaterial({ color: c, emissive: c, emissiveIntensity: 0.6 })); [-1, 1].forEach(sg => { add(bacc, 0.22, 0.46, 0.05, fire[0], sg * 0.34, 0.8, -0.2); add(bacc, 0.16, 0.36, 0.05, fire[1], sg * 0.53, 0.92, -0.2); add(bacc, 0.12, 0.26, 0.05, fire[2], sg * 0.68, 1.04, -0.2); }); }
    if (look.acc === 'wings') [-1, 1].forEach(sg => { add(bacc, 0.2, 0.4, 0.05, 0xffffff, sg * 0.33, 0.78, -0.2); add(bacc, 0.14, 0.28, 0.05, 0xffffff, sg * 0.5, 0.88, -0.2); add(bacc, 0.1, 0.16, 0.05, 0xffffff, sg * 0.62, 0.96, -0.2); });
    /* the head and a face that can blink, look around and smile */
    add(core, 0.64, 0.58, 0.58, FX && FX.head ? voxMat(FX.head, FX.hm) : sk, 0, 0.28, 0);
    const eyes = [];
    if (!(FX && FX.head)) {
      [-1, 1].forEach(sg => {
        const e = new THREE.Group(); e.position.set(sg * 0.15, 0.3, 0.29); face.add(e); eyes.push(e);
        add(e, 0.16, 0.17, 0.02, 0xffffff, 0, 0, 0, 0); add(e, 0.08, 0.1, 0.02, 0x0b0b0f, -sg * 0.015, -0.015, 0.012, 0); add(e, 0.03, 0.03, 0.02, 0xffffff, -sg * 0.035, 0.02, 0.02, 0);
        add(face, 0.15, 0.028, 0.02, hc === '#F4F4F4' ? 0x7a7a7a : 0x2a1d14, sg * 0.15, 0.42, 0.295, 0).rotation.z = sg * 0.06;
        add(face, 0.09, 0.045, 0.02, 0xffb3c4, sg * 0.24, 0.19, 0.29, 0);
      });
      add(face, 0.14, 0.035, 0.02, 0x5b2b25, 0, 0.13, 0.295, 0); add(face, 0.04, 0.03, 0.02, 0x5b2b25, -0.08, 0.145, 0.295, 0); add(face, 0.04, 0.03, 0.02, 0x5b2b25, 0.08, 0.145, 0.295, 0);
    }
    const hat = look.hat, hair = D.NOHAIR.indexOf(hat) >= 0 ? 'none' : hat && D.TALLH.indexOf(look.hair) >= 0 ? 'short' : look.hair;
    if (D.HAIRV[hair]) vox(core, D.HAIRV[hair]);
    if (hair !== 'none' && !D.HAIRV[hair]) { add(core, 0.66, 0.13, 0.6, hc, 0, 0.6, 0, 0.02); add(core, 0.66, hair === 'bob' ? 0.5 : 0.26, 0.07, hc, 0, hair === 'bob' ? 0.3 : 0.44, -0.3, 0.02); add(core, 0.6, 0.07, 0.05, hc, 0, 0.53, 0.3, 0); add(core, 0.22, 0.1, 0.05, hc, -0.18, 0.5, 0.3, 0); }
    if (hair === 'bob') [-1, 1].forEach(sg => add(core, 0.06, 0.44, 0.5, hc, sg * 0.35, 0.3, -0.03));
    if (hair === 'spiky') [-0.2, 0, 0.2].forEach(x => add(core, 0.14, 0.13, 0.14, hc, x, 0.7, x ? 0.05 : -0.08));
    if (hair === 'bun') add(core, 0.24, 0.2, 0.24, hc, 0, 0.74, -0.1);
    if (look.acc === 'glasses') { add(hacc, 0.6, 0.04, 0.02, 0x000000, 0, 0.365, 0.3, 0); [-1, 1].forEach(sg => { add(hacc, 0.2, 0.03, 0.02, 0x000000, sg * 0.15, 0.18, 0.3, 0); add(hacc, 0.03, 0.2, 0.02, 0x000000, sg * 0.25, 0.27, 0.3, 0); add(hacc, 0.03, 0.2, 0.02, 0x000000, sg * 0.05, 0.27, 0.3, 0); }); }
    if (hat === 'beanie') { add(hatG, 0.7, 0.2, 0.64, 0x3fa9ff, 0, 0.66, 0); add(hatG, 0.72, 0.08, 0.66, 0xffffff, 0, 0.54, 0); add(hatG, 0.16, 0.14, 0.16, 0xffffff, 0, 0.83, 0); }
    if (hat === 'cap') { add(hatG, 0.68, 0.14, 0.62, 0x3d5afe, 0, 0.63, 0); add(hatG, 0.56, 0.08, 0.5, 0x3d5afe, 0, 0.74, 0); add(hatG, 0.44, 0.05, 0.4, 0x3d5afe, 0, 0.8, 0); add(hatG, 0.5, 0.05, 0.32, 0x3d5afe, 0, 0.575, 0.45); }
    if (hat === 'party') { add(hatG, 0.34, 0.16, 0.34, 0xff8ad8, 0, 0.64, 0); add(hatG, 0.24, 0.16, 0.24, 0xffd60a, 0, 0.8, 0); add(hatG, 0.14, 0.16, 0.14, 0xff8ad8, 0, 0.96, 0); add(hatG, 0.1, 0.1, 0.1, 0xffd60a, 0, 1.09, 0); }
    if (hat === 'cowboy') { add(hatG, 0.98, 0.05, 0.92, 0xa0703c, 0, 0.585, 0); add(hatG, 0.5, 0.26, 0.46, 0xa0703c, 0, 0.74, 0); add(hatG, 0.52, 0.07, 0.48, 0x3b2412, 0, 0.65, 0, 0); }
    if (hat === 'wizard') { add(hatG, 1.04, 0.05, 1.0, 0x7b3fc4, 0, 0.585, 0); add(hatG, 0.54, 0.1, 0.54, 0x111111, 0, 0.66, 0); add(hatG, 0.14, 0.12, 0.03, 0xffd60a, 0, 0.66, 0.28, 0); [[0.48, 0.8, 0], [0.38, 0.98, 0.03], [0.28, 1.16, 0.08], [0.18, 1.33, 0.15], [0.12, 1.45, 0.24]].forEach(q => add(hatG, q[0], 0.18, q[0], 0x7b3fc4, q[2], q[1], 0)); }
    if (D.HATV[hat]) vox(hatG, D.HATV[hat]);
    if (hat === 'headband') { add(hatG, 0.68, 0.1, 0.62, 0xff4b3e, 0, 0.46, 0); add(hatG, 0.06, 0.2, 0.04, 0xff4b3e, 0.1, 0.36, -0.32); }
    if (hat === 'chefhat') { add(hatG, 0.62, 0.12, 0.58, 0xffffff, 0, 0.6, 0); add(hatG, 0.56, 0.36, 0.52, 0xffffff, 0, 0.82, 0); add(hatG, 0.7, 0.16, 0.64, 0xffffff, 0, 1.04, 0); }
    if (hat === 'pirate') { add(hatG, 0.96, 0.08, 0.5, 0x151515, 0, 0.62, 0); add(hatG, 0.62, 0.24, 0.42, 0x151515, 0, 0.76, 0); add(hatG, 0.14, 0.1, 0.03, 0xffffff, 0, 0.76, 0.22, 0); }
    if (hat === 'halo') { const glow = new THREE.MeshPhongMaterial({ color: 0xffe14d, emissive: 0xffc400, emissiveIntensity: 1, shininess: 90 }), ring = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.05, 8, 24), glow); ring.rotation.x = Math.PI / 2; ring.position.set(0, 0.98, 0); hatG.add(ring); }
    if (hat === 'crown') { add(hatG, 0.64, 0.14, 0.58, gold, 0, 0.63, 0); [[-0.26, 0.23], [0.26, 0.23], [-0.26, -0.23], [0.26, -0.23], [0, 0.23]].forEach(q => add(hatG, 0.12, 0.14, 0.12, gold, q[0], 0.77, q[1])); add(hatG, 0.1, 0.1, 0.03, 0xff4b3e, 0, 0.64, 0.3, 0); }
    if (FX && part === 'outfit') part = 'bust';
    if (part && part !== 'fig') { if (part !== 'bust') { if (part !== 'outfit') M.remove(body); head.remove(core); if (part !== 'hat') head.remove(hatG); if (part !== 'acc') { head.remove(hacc); M.remove(bacc); } } }
    /* animation state lives on the group */
    const A = { legs, arms, head, body, M, eyes, FL, blinkAt: 2 + Math.random() * 3, blinkT: 0, em: null, emT: 0, phase: Math.random() * 6, look: 0, lookT: 0 };
    G.userData = A;
    G.userData.anim = function (t, dt, st) {
      st = st || {}; const mv = st.moving ? Math.min(1.6, st.speed || 1) : 0, run = st.running ? 1.5 : 1;
      const w = t * 9 * run + A.phase, swing = mv ? Math.sin(w) * 0.75 * Math.min(1, mv) : 0;
      legs[0].rotation.x += (swing - legs[0].rotation.x) * 0.3; legs[1].rotation.x += (-swing - legs[1].rotation.x) * 0.3;
      let armL = -swing * 0.8, armR = swing * 0.8, armZ = 0.08, bodyY = 0.23 + (mv ? Math.abs(Math.sin(w)) * 0.045 * mv : Math.sin(t * 1.6 + A.phase) * 0.01), lean = mv ? 0.08 * Math.min(1, mv) : 0;
      if (st.jumping) { armL = armR = -2.4; legs[0].rotation.x = -0.4; legs[1].rotation.x = 0.5; }
      if (A.em) { A.emT += dt; const e = A.em, k = A.emT; if (k > 2.6) A.em = null;
        if (e === 'wave') { armR = -2.6 + Math.sin(k * 14) * 0.5; armZ = 0.08; }
        else if (e === 'cheer') { armL = armR = -2.8 + Math.sin(k * 10) * 0.2; bodyY += Math.abs(Math.sin(k * 10)) * 0.08; }
        else if (e === 'dance') { armL = -1.2 + Math.sin(k * 8) * 0.9; armR = -1.2 - Math.sin(k * 8) * 0.9; M.rotation.y = Math.sin(k * 4) * 0.5; bodyY += Math.abs(Math.sin(k * 8)) * 0.06; legs[0].rotation.x = Math.sin(k * 8) * 0.4; legs[1].rotation.x = -Math.sin(k * 8) * 0.4; }
      } else M.rotation.y += (0 - M.rotation.y) * 0.2;
      arms[0].rotation.x += (armL - arms[0].rotation.x) * 0.3; arms[1].rotation.x += (armR - arms[1].rotation.x) * 0.3; arms[0].rotation.z = -armZ; arms[1].rotation.z = armZ;
      M.position.y += (bodyY - M.position.y) * 0.4; body.rotation.x += (lean - body.rotation.x) * 0.1;
      /* idle: breathe, glance around, blink */
      const breathe = 1 + Math.sin(t * 1.8 + A.phase) * 0.012; body.scale.set(1, breathe, 1);
      A.lookT -= dt; if (A.lookT <= 0) { A.lookT = 2 + Math.random() * 4; A.look = mv ? 0 : (Math.random() - 0.5) * 0.9; }
      head.rotation.y += ((mv ? 0 : A.look) - head.rotation.y) * 0.05; head.rotation.z = Math.sin(t * 1.3 + A.phase) * 0.03; head.rotation.x = st.pitch || 0;
      if (eyes.length) { A.blinkAt -= dt; if (A.blinkAt <= 0) { A.blinkT = 0.13; A.blinkAt = 2.5 + Math.random() * 3.5; } if (A.blinkT > 0) { A.blinkT -= dt; eyes.forEach(e => { e.scale.y = 0.12; }); } else eyes.forEach(e => { e.scale.y += (1 - e.scale.y) * 0.5; }); }
      for (const f of FL) { const u = f.userData; if (u.p) { const k = ((t * u.w + u.fl) % 1); f.position.y = u.y0 + k * 0.5; f.material.opacity = 0.9 * (1 - k); } else if (u.o) { const a = u.a0 + t * u.w; f.position.x = Math.sin(a) * u.r; f.position.z = Math.cos(a) * u.r; } else { f.scale.y = 1 + Math.sin(t * 7 + u.fl) * 0.25; } }
    };
    G.userData.emote = e => { A.em = e; A.emT = 0; };
    return G;
  }
  function pet(THREE, kind) {
    const G = new THREE.Group(), M = new THREE.Group(), wings = []; G.add(M); M.scale.setScalar(1.5);
    const OUT = new THREE.MeshBasicMaterial({ color: 0x0b0b0f, side: THREE.BackSide });
    const L = c => new THREE.MeshLambertMaterial({ color: c });
    const add = (w, h, d, c, x, y, z, par, ol) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), typeof c === 'object' ? c : L(c)); o.position.set(x, y, z); o.castShadow = true; if (ol !== 0) { const b = new THREE.Mesh(o.geometry, OUT); b.scale.setScalar(1.08); o.add(b); } (par || M).add(o); return o; };
    const wing = (sg, w, d, c, y) => { const g = new THREE.Group(); g.position.set(sg * 0.15, y, 0); add(w, 0.04, d, c, sg * w / 2, 0, 0, g); g.userData.sg = sg; M.add(g); wings.push(g); };
    const voxMat = (c, f) => { const hex = new THREE.Color(c).getHex(); return f === 'g' || f === 'o' ? new THREE.MeshPhongMaterial({ color: hex, emissive: hex, emissiveIntensity: 0.75 }) : f === 't' ? new THREE.MeshPhongMaterial({ color: hex, transparent: true, opacity: 0.5 }) : L(hex); };
    if (D.PETV[kind]) D.PETV[kind].forEach(q => add(q[0], q[1], q[2], voxMat(q[3], q[7]), q[4], q[5], q[6], M, 0));
    else if (kind === 'pig') { add(0.4, 0.3, 0.5, 0xffb3c7, 0, 0.27, 0); add(0.32, 0.3, 0.26, 0xffb3c7, 0, 0.36, 0.34); add(0.16, 0.12, 0.06, 0xff8ad8, 0, 0.32, 0.49, M, 0); add(0.06, 0.06, 0.06, 0xff8ad8, 0, 0.36, -0.27, M, 0); [-1, 1].forEach(sg => { add(0.05, 0.06, 0.02, 0x000000, sg * 0.09, 0.42, 0.475, M, 0); add(0.08, 0.1, 0.06, 0xff8ad8, sg * 0.12, 0.54, 0.3); add(0.1, 0.14, 0.1, 0xffb3c7, sg * 0.13, 0.07, 0.17); add(0.1, 0.14, 0.1, 0xffb3c7, sg * 0.13, 0.07, -0.17); }); }
    else if (kind === 'penguin') { add(0.32, 0.46, 0.28, 0x222222, 0, 0.3, 0); add(0.22, 0.3, 0.02, 0xffffff, 0, 0.26, 0.145, M, 0); add(0.1, 0.05, 0.08, 0xff9f1c, 0, 0.4, 0.17, M, 0); [-1, 1].forEach(sg => { add(0.06, 0.06, 0.02, 0xffffff, sg * 0.08, 0.46, 0.145, M, 0); add(0.03, 0.03, 0.02, 0x000000, sg * 0.07, 0.455, 0.156, M, 0); add(0.12, 0.05, 0.16, 0xff9f1c, sg * 0.09, 0.03, 0.05); add(0.05, 0.26, 0.14, 0x222222, sg * 0.185, 0.3, 0); }); }
    else if (kind === 'dragon') { add(0.34, 0.3, 0.5, 0x2ecc71, 0, 0.2, 0); add(0.3, 0.26, 0.3, 0x2ecc71, 0, 0.4, 0.3); add(0.2, 0.12, 0.12, 0x27ae60, 0, 0.34, 0.5); add(0.16, 0.14, 0.2, 0x2ecc71, 0, 0.18, -0.34); add(0.1, 0.1, 0.16, 0x2ecc71, 0, 0.16, -0.5); [0.1, -0.06, -0.22].forEach(z => add(0.08, 0.08, 0.08, 0xff4b3e, 0, 0.39, z, M, 0)); [-1, 1].forEach(sg => { add(0.06, 0.07, 0.02, 0xffd60a, sg * 0.1, 0.46, 0.455, M, 0); add(0.06, 0.12, 0.06, 0xffd60a, sg * 0.1, 0.58, 0.24); wing(sg, 0.36, 0.3, 0xff4b3e, 0.32); }); }
    else { add(0.26, 0.24, 0.34, 0x3fa9ff, 0, 0.2, 0); add(0.22, 0.2, 0.2, 0x3fa9ff, 0, 0.38, 0.14); add(0.18, 0.12, 0.02, 0xffffff, 0, 0.16, 0.175, M, 0); add(0.08, 0.06, 0.1, 0xff9f1c, 0, 0.36, 0.29, M, 0); add(0.14, 0.05, 0.14, 0x2b6fd0, 0, 0.24, -0.23); [-1, 1].forEach(sg => { add(0.05, 0.06, 0.02, 0x000000, sg * 0.07, 0.42, 0.245, M, 0); wing(sg, 0.24, 0.22, 0x2b6fd0, 0.28); }); }
    const fly = kind === 'bird' || kind === 'dragon' || D.FLYP.indexOf(kind) >= 0, phase = Math.random() * 6;
    G.userData = { fly, wings, anim(t, moving, excited) { const hop = moving ? Math.abs(Math.sin(t * 10 + phase)) * 0.25 : excited ? Math.abs(Math.sin(t * 14)) * 0.5 : 0; M.position.y = fly ? 1.1 + Math.sin(t * 3 + phase) * 0.15 : hop; M.rotation.z = moving ? Math.sin(t * 10 + phase) * 0.08 : 0; wings.forEach(w => { w.rotation.z = w.userData.sg * Math.sin(t * (fly ? 14 : 6) + phase) * (fly ? 0.7 : 0.25); }); } };
    return G;
  }
  /* a small renderer for profile cards and the wardrobe: one figure, turning slowly */
  function preview(THREE, canvas, look, petKind, col) {
    let renderer; try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true }); } catch (e) { return { update() {}, stop() {} }; }
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2)); renderer.shadowMap.enabled = true;
    const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
    scene.add(new THREE.HemisphereLight(0xffffff, 0xe8e4f4, 0.95)); const sun = new THREE.DirectionalLight(0xffffff, 0.7); sun.position.set(3, 6, 4); sun.castShadow = true; scene.add(sun);
    const floor = new THREE.Mesh(new THREE.CircleGeometry(1.6, 32), new THREE.ShadowMaterial({ opacity: 0.18 })); floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
    let fig = null, pt = null, running = true, t0 = performance.now();
    const fit = () => { const w = canvas.clientWidth || 200, h = canvas.clientHeight || 260; renderer.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); };
    function update(l, p, c) { if (fig) scene.remove(fig); if (pt) scene.remove(pt); fig = make(THREE, l, c || '#7a52ff'); scene.add(fig); pt = p ? pet(THREE, p) : null; if (pt) { pt.position.set(0.9, 0, 0.3); pt.scale.setScalar(0.8); scene.add(pt); } }
    update(look, petKind, col);
    (function frame() { if (!running) return; requestAnimationFrame(frame); fit(); const t = (performance.now() - t0) / 1000; if (fig) { fig.userData.anim(t, 1 / 60, {}); fig.rotation.y = Math.sin(t * 0.7) * 0.5; } if (pt) pt.userData.anim(t, false, false); cam.position.set(0, 2.4, 7.2); cam.lookAt(0, 2.1, 0); renderer.render(scene, cam); })();
    return { update, stop() { running = false; renderer.dispose(); renderer.forceContextLoss && renderer.forceContextLoss(); } };
  }
  globalThis.BZAVATAR = { make, pet, preview };
})();
