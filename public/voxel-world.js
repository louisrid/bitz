/* Stakkz open world: one huge flat grass field that runs to the horizon, with trees, bushes, rocks,
   flowers and wandering animals, and a flat circle of grass in the middle where everyone fights.
   Everything is generated here at runtime. No external or copied assets.
   Built almost entirely from instanced meshes, so a phone draws the whole field in a few dozen calls.
   Scale: a player stands about 2.4 units tall, so a tree is 7 to 11 units and a boulder reaches the waist. */
(function () {
  const SIZE = 460, FIELD = 150, ARENA = 15, RING = 16.4;

  function build(THREE, root) {
    const world = new THREE.Group(); world.name = 'Stakkz Grassland'; root.add(world);
    let seed = 20261111; const rand = () => { seed = (seed * 48271) % 2147483647; return seed / 2147483647; };
    const lam = c => new THREE.MeshLambertMaterial({ color: c });
    const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);

    /* one instanced mesh per shape; the colour of every copy is picked from a small palette */
    function instanced(geo, parts, colours, shadow) {
      if (!parts.length) return null;
      const m = new THREE.InstancedMesh(geo, lam(0xffffff), parts.length), d = new THREE.Object3D();
      parts.forEach((p, i) => {
        d.position.set(p[0], p[1], p[2]); d.rotation.set(0, p[3] || 0, 0); d.scale.set(p[4] || 1, p[5] || p[4] || 1, p[6] || p[4] || 1);
        d.updateMatrix(); m.setMatrixAt(i, d.matrix); m.setColorAt(i, new THREE.Color(colours[(p[7] | 0) % colours.length]));
      });
      m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true;
      m.castShadow = !!shadow; m.receiveShadow = true; world.add(m); return m;
    }

    /* ---- the ground: a slab far wider than anyone can walk, so grass meets the sky on every side ---- */
    const ground = new THREE.Mesh(box(SIZE, 2, SIZE), lam(0x2e6f3a)); ground.position.y = -1; ground.receiveShadow = true; world.add(ground);

    /* a grid of grass blocks over the walkable field, each one a slightly different green */
    const TILE = 4, GREENS = [0x30753f, 0x2e7039, 0x337a43, 0x2c6f3c, 0x357f45, 0x2b6b38];
    const tiles = [];
    for (let x = -FIELD; x <= FIELD; x += TILE) for (let z = -FIELD; z <= FIELD; z += TILE) {
      const r = Math.hypot(x, z); if (r > FIELD) continue;
      tiles.push([x, 0.03, z, 0, TILE, 0.1, TILE, Math.abs(Math.round(x * 7.3 + z * 3.1))]);
    }
    instanced(box(1, 1, 1), tiles, GREENS);

    /* tufts of longer grass, so the ground is not a flat sheet of colour */
    const tufts = [], TUFTC = [0x3f9150, 0x47a059, 0x368547];
    for (let i = 0; i < 2600; i++) {
      const a = rand() * Math.PI * 2, r = 3 + Math.sqrt(rand()) * (FIELD - 6), x = Math.sin(a) * r, z = Math.cos(a) * r;
      if (r < ARENA - 1) continue;
      tufts.push([x, 0.22, z, rand() * 3, 0.3 + rand() * 0.3, 0.42 + rand() * 0.4, 0.3 + rand() * 0.3, i]);
    }
    instanced(box(1, 1, 1), tufts, TUFTC);

    /* ---- the fighting circle: flat, clear and obvious, with a low kerb of pale stone ---- */
    const arena = new THREE.Mesh(new THREE.CylinderGeometry(ARENA, ARENA, 0.3, 56), lam(0x47994f));
    arena.position.y = 0.07; arena.receiveShadow = true; world.add(arena);
    const bull = new THREE.Mesh(new THREE.CylinderGeometry(4.2, 4.2, 0.34, 40), lam(0x51a858));
    bull.position.y = 0.09; bull.receiveShadow = true; world.add(bull);
    const kerb = [], STONE = [0xc3c9b8, 0xb2b9a8, 0xd0d6c5, 0xa8b09f];
    for (let i = 0; i < 84; i++) { const a = i / 84 * Math.PI * 2; kerb.push([Math.sin(a) * RING, 0.2, Math.cos(a) * RING, a, 1.25, 0.42 + rand() * 0.22, 0.75, i]); }
    instanced(box(1, 1, 1), kerb, STONE, true);
    /* four striped posts, so the middle of the map is findable from anywhere */
    const posts = [], POSTC = [0xf7e04d, 0xfbfbf4];
    [[0, RING + 1.6], [0, -RING - 1.6], [RING + 1.6, 0], [-RING - 1.6, 0]].forEach(p => {
      for (let i = 0; i < 6; i++) posts.push([p[0], 0.45 + i * 0.9, p[1], 0, 0.42, 0.9, 0.42, i % 2]);
      posts.push([p[0], 5.9, p[1], 0, 1.0, 0.44, 1.0, 1]);
    });
    instanced(box(1, 1, 1), posts, POSTC, true);

    /* ---- trees, bushes, rocks, flowers and fallen logs across the whole field ---- */
    const trunks = [], leaves = [], bushes = [], rocks = [], flowers = [], logs = [];
    const TRUNKC = [0x6b4a2f, 0x5c4028, 0x74542f], LEAFC = [0x236139, 0x2a7342, 0x1d5531, 0x2f8048, 0x256a3c];
    const BUSHC = [0x2e8044, 0x266d3c, 0x35874a], ROCKC = [0x9aa095, 0x888f84, 0xa7ada1], FLOWERC = [0xffe14d, 0xff8ad8, 0xffffff, 0xff6b5a, 0xb388ff];
    const outside = (x, z, pad) => Math.hypot(x, z) > RING + (pad || 0);
    for (let i = 0; i < 620; i++) {
      const a = rand() * Math.PI * 2, r = (RING + 9) + Math.pow(rand(), 0.62) * (FIELD - RING - 14), x = Math.sin(a) * r, z = Math.cos(a) * r;
      if (!outside(x, z, 9)) continue;
      const s = 0.72 + rand() * 0.8, h = (4.3 + rand() * 2.6) * s, ry = rand() * 3;
      trunks.push([x, h / 2, z, ry, 0.72 * s, h, 0.72 * s, i]);
      const tiers = rand() > 0.5 ? 3 : 4;
      for (let k = 0; k < tiers; k++) {
        const w = (3.9 - k * 0.78) * s;
        leaves.push([x, h + 0.35 + k * 0.95 * s, z, ry, w, 1.1 * s, w, (i + k)]);
      }
    }
    for (let i = 0; i < 900; i++) {
      const a = rand() * Math.PI * 2, r = (RING + 3) + Math.pow(rand(), 0.62) * (FIELD - RING - 6), x = Math.sin(a) * r, z = Math.cos(a) * r;
      if (!outside(x, z, 3)) continue;
      const s = 0.55 + rand() * 0.75;
      bushes.push([x, 0.42 * s, z, rand() * 3, 1.5 * s, 0.85 * s, 1.5 * s, i]);
      if (rand() > 0.55) bushes.push([x + (rand() - 0.5) * 1.6, 0.32 * s, z + (rand() - 0.5) * 1.6, rand() * 3, 1 * s, 0.62 * s, 1 * s, i + 1]);
    }
    for (let i = 0; i < 380; i++) {
      const a = rand() * Math.PI * 2, r = (RING + 2) + Math.pow(rand(), 0.7) * (FIELD - RING - 4), x = Math.sin(a) * r, z = Math.cos(a) * r;
      if (!outside(x, z, 2)) continue;
      const s = 0.4 + rand() * 0.8;
      rocks.push([x, 0.26 * s, z, rand() * 3, 1.15 * s, 0.72 * s, 0.95 * s, i]);
    }
    for (let i = 0; i < 950; i++) {
      const a = rand() * Math.PI * 2, r = (RING + 1) + Math.pow(rand(), 0.6) * (FIELD - RING - 3), x = Math.sin(a) * r, z = Math.cos(a) * r;
      if (!outside(x, z, 1)) continue;
      flowers.push([x, 0.2, z, rand() * 3, 0.1, 0.34, 0.1, i]);
      flowers.push([x, 0.4, z, rand() * 3, 0.24, 0.16, 0.24, i]);
    }
    for (let i = 0; i < 34; i++) {
      const a = rand() * Math.PI * 2, r = RING + 6 + rand() * (FIELD - RING - 20), x = Math.sin(a) * r, z = Math.cos(a) * r;
      logs.push([x, 0.38, z, rand() * 3, 2.8 + rand() * 1.8, 0.76, 0.76, i]);
    }
    instanced(box(1, 1, 1), trunks, TRUNKC, true);
    instanced(box(1, 1, 1), leaves, LEAFC, true);
    instanced(box(1, 1, 1), bushes, BUSHC, true);
    instanced(box(1, 1, 1), rocks, ROCKC, true);
    /* flowers removed: from above they read as floating bits */
    instanced(box(1, 1, 1), logs, TRUNKC, true);

    /* ---- animals. They wander the field on their own and keep out of the fighting circle. ---- */
    const animals = [];
    const KINDS = [
      { n: 'sheep', body: 0xf2f0e6, head: 0x3a3a42, w: 1.3, h: 1.0, d: 1.85, hw: 0.82, hh: 0.78, legs: 0.55, sp: 1.5, wool: true },
      { n: 'deer', body: 0xa9703c, head: 0xbb8049, w: 1.15, h: 1.1, d: 2.0, hw: 0.72, hh: 0.7, legs: 1.0, sp: 3.2, horns: true },
      { n: 'chicken', body: 0xfdfdfb, head: 0xfdfdfb, w: 0.62, h: 0.62, d: 0.9, hw: 0.46, hh: 0.46, legs: 0.44, sp: 2.0, beak: true },
      { n: 'fox', body: 0xe06a28, head: 0xee8440, w: 0.8, h: 0.72, d: 1.55, hw: 0.6, hh: 0.58, legs: 0.52, sp: 4.4, tail: true },
      { n: 'cow', body: 0x4a4a52, head: 0x3b3b43, w: 1.5, h: 1.2, d: 2.3, hw: 1.0, hh: 0.92, legs: 0.82, sp: 1.3, spots: true, horns: true }
    ];
    function makeAnimal(k) {
      const g = new THREE.Group(), legs = [];
      const put = (w, h, d, c, x, y, z, par) => { const m = new THREE.Mesh(box(w, h, d), lam(c)); m.position.set(x, y, z); m.castShadow = true; (par || g).add(m); return m; };
      const y0 = k.legs + k.h / 2;
      put(k.w, k.h, k.d, k.body, 0, y0, 0);
      if (k.wool) { put(k.w + 0.24, k.h + 0.22, k.d - 0.55, k.body, 0, y0 + 0.08, -0.12); put(k.w * 0.7, 0.32, 0.3, k.body, 0, y0 + 0.26, k.d / 2 - 0.12); }
      if (k.spots) { put(k.w + 0.05, 0.48, 0.62, 0xf2f0e6, 0, y0 + 0.12, -0.34); put(k.w + 0.05, 0.36, 0.44, 0xf2f0e6, 0, y0 - 0.22, 0.46); }
      put(k.hw, k.hh, k.hw + 0.16, k.head, 0, y0 + k.h * 0.34, k.d / 2 + 0.2);
      [-1, 1].forEach(s => put(0.11, 0.11, 0.05, 0x15151c, s * k.hw * 0.28, y0 + k.h * 0.4, k.d / 2 + k.hw * 0.66));
      if (k.beak) { put(0.22, 0.15, 0.22, 0xffb000, 0, y0 + k.h * 0.2, k.d / 2 + k.hw * 0.66); put(0.3, 0.3, 0.12, 0xd93b2f, 0, y0 + k.h * 0.74, k.d / 2 + 0.12); }
      if (k.horns) [-1, 1].forEach(s => { put(0.13, 0.46, 0.13, 0xe8e2cf, s * k.hw * 0.42, y0 + k.h * 0.8, k.d / 2 + 0.12); put(0.32, 0.13, 0.13, 0xe8e2cf, s * (k.hw * 0.42 + 0.2), y0 + k.h * 1.0, k.d / 2 + 0.12); });
      if (k.tail) { const t = put(0.36, 0.36, 1.05, k.head, 0, y0 + 0.1, -k.d / 2 - 0.45); put(0.32, 0.32, 0.32, 0xffffff, 0, y0 + 0.1, -k.d / 2 - 0.92); g.userData.tail = t; }
      [[-1, 1], [1, 1], [-1, -1], [1, -1]].forEach(p => {
        const q = new THREE.Group(); q.position.set(p[0] * k.w * 0.32, k.legs, p[1] * k.d * 0.3); g.add(q);
        const m = new THREE.Mesh(box(0.28, k.legs, 0.28), lam(k.head)); m.position.y = -k.legs / 2; m.castShadow = true; q.add(m);
        legs.push(q);
      });
      g.userData.legs = legs; return g;
    }
    for (let i = 0; i < 30; i++) {
      const k = KINDS[i % KINDS.length], g = makeAnimal(k);
      const a = rand() * Math.PI * 2, r = RING + 6 + rand() * 70;
      const st = { g: g, k: k, x: Math.sin(a) * r, z: Math.cos(a) * r, ry: rand() * 6, tx: 0, tz: 0, wait: rand() * 4, sp: 0, ph: rand() * 9 };
      st.tx = st.x; st.tz = st.z; g.position.set(st.x, 0, st.z); world.add(g); animals.push(st);
    }

    let last = 0;
    return {
      world: world, arena: ARENA, ring: RING, field: FIELD, size: SIZE, animals: animals, pickups: [], boostPoints: [],
      animate(t) {
        const dt = Math.min(0.1, last ? t - last : 0); last = t;
        animals.forEach(a => {
          if (a.wait > 0) { a.wait -= dt; a.sp = Math.max(0, a.sp - dt * 4); }
          else {
            const dx = a.tx - a.x, dz = a.tz - a.z, l = Math.hypot(dx, dz);
            if (l < 0.8) {   /* pick a new spot out on the grass, never inside the fighting circle */
              let nx, nz, tries = 0;
              do { const ang = Math.random() * Math.PI * 2, rr = 7 + Math.random() * 24; nx = a.x + Math.sin(ang) * rr; nz = a.z + Math.cos(ang) * rr; tries++; }
              while (tries < 8 && (Math.hypot(nx, nz) < RING + 4 || Math.hypot(nx, nz) > FIELD - 12));
              a.tx = nx; a.tz = nz; a.wait = 1.5 + Math.random() * 5;
            } else {
              const v = a.k.sp; a.x += dx / l * v * dt; a.z += dz / l * v * dt; a.sp = v;
              let d = Math.atan2(dx, dz) - a.ry; d = Math.atan2(Math.sin(d), Math.cos(d)); a.ry += d * Math.min(1, dt * 4);
            }
          }
          a.g.position.set(a.x, a.sp > 0.2 ? Math.abs(Math.sin(t * a.k.sp * 2 + a.ph)) * 0.07 : 0, a.z);
          a.g.rotation.y = a.ry;
          const sw = Math.sin(t * (4 + a.k.sp * 1.6) + a.ph) * Math.min(0.75, a.sp * 0.22);
          a.g.userData.legs.forEach((q, i) => { q.rotation.x = (i === 0 || i === 3) ? sw : -sw; });
          if (a.g.userData.tail) a.g.userData.tail.rotation.y = Math.sin(t * 3 + a.ph) * 0.3;
        });
      }
    };
  }
  globalThis.STAKKZ_BUILD_WORLD = build;
})();
