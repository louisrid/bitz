/* BITZ hub lobby: a small floating voxel island. Grass, flowers, blossom trees, a pond, lanterns, drifting petals,
   soft fog and warm light, with a stone plaza in the middle and four glowing portals to the games.
   Built from instanced boxes, so it is a few dozen draw calls. The old worlds live in legacy/. */
(function () {
  'use strict';
  function build(THREE, root) {
    const world = new THREE.Group(); world.name = 'BITZ Hub'; root.add(world);
    const L = globalThis.STAKKZ_WORLD_LAYOUT || { destinations: [] }, HALF = 35, TILE = 2;
    let seed = 20261112; const rand = () => { seed = (seed * 48271) % 2147483647; return seed / 2147483647; };
    const lam = c => new THREE.MeshLambertMaterial({ color: c });
    const unit = new THREE.BoxGeometry(1, 1, 1);
    function instanced(parts, colours, shadow, mat) {
      if (!parts.length) return null;
      const m = new THREE.InstancedMesh(unit, mat || lam(0xffffff), parts.length), d = new THREE.Object3D(), col = new THREE.Color();
      parts.forEach((p, i) => { d.position.set(p[0], p[1], p[2]); d.rotation.set(0, p[3] || 0, 0); d.scale.set(p[4], p[5], p[6]); d.updateMatrix(); m.setMatrixAt(i, d.matrix); m.setColorAt(i, col.set(colours[(p[7] | 0) % colours.length])); });
      m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true;
      m.castShadow = !!shadow; m.receiveShadow = true; world.add(m); return m;
    }
    /* the island's outline: a rounded square, so every corner a player can reach is solid ground */
    const onIsland = (x, z, pad) => { const h = HALF - (pad || 0), r = 7, ax = Math.max(0, Math.abs(x) - (h - r)), az = Math.max(0, Math.abs(z) - (h - r)); return Math.hypot(ax, az) <= r; };
    const portals = (L.destinations || []).map(d => Object.assign({}, d));   // the shared layout is frozen; keep our own copies to hang meshes on
    const nearPortal = (x, z, d) => portals.some(p => Math.hypot(x - p.x, z - p.z) < d);
    const onPath = (x, z, w) => (Math.abs(x) < w && Math.abs(z) < 24) || (Math.abs(z) < w && Math.abs(x) < 24);
    const PLAZA = 9.5;

    /* ---- ground: grass blocks, a stone plaza, four paths, dirt and rock under the edge ---- */
    const GRASS = [0x4fae4f, 0x48a649, 0x57b656, 0x43a045, 0x5dbb59, 0x4caa4c], STONE = [0xd9cfbf, 0xd0c5b3, 0xe0d7c8, 0xc8bca8], PATHC = [0xcdb994, 0xc4ae86, 0xd4c19e];
    const grass = [], stone = [], path = [], dirt = [];
    for (let x = -HALF + 1; x < HALF; x += TILE) for (let z = -HALF + 1; z < HALF; z += TILE) {
      if (!onIsland(x, z)) continue;
      const r = Math.hypot(x, z), n = Math.abs(Math.round(Math.sin(x * 0.7) * 3 + Math.cos(z * 0.6) * 3 + x * 0.13 + z * 0.29));
      if (r < PLAZA) stone.push([x, -0.5, z, 0, TILE, 1, TILE, (Math.abs(x) + Math.abs(z)) / 2 + (r < 3 ? 2 : 0)]);
      else if (onPath(x, z, 2.2)) path.push([x, -0.47, z, 0, TILE, 1, TILE, n]);
      else grass.push([x, -0.5 + (n % 5 === 0 ? 0.08 : 0), z, 0, TILE, 1, TILE, n]);
      if (!onIsland(x, z, 2.2)) for (let k = 1; k <= 3; k++) if (onIsland(x, z, -k * 0.6 + 1)) dirt.push([x, -0.5 - k * 1.6, z, 0, TILE * (1 - k * 0.12), 1.6, TILE * (1 - k * 0.12), k]);
    }
    instanced(grass, GRASS); instanced(stone, STONE); instanced(path, PATHC);
    instanced(dirt, [0x9a6b45, 0x8a5f3d, 0x7d7a86, 0x6f6c78]);
    /* the plaza: a ring of lilac trim and the BITZ star in the middle */
    const trim = []; for (let i = 0; i < 64; i++) { const a = i / 64 * Math.PI * 2; trim.push([Math.sin(a) * PLAZA, 0.06, Math.cos(a) * PLAZA, a, 0.9, 0.14, 0.5, i % 2]); }
    instanced(trim, [0x9b7dff, 0xb9a4ff]);
    const starShape = new THREE.Shape(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? 1.25 : 2.9; if (!i) starShape.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); else starShape.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
    const star = new THREE.Mesh(new THREE.ShapeGeometry(starShape), new THREE.MeshLambertMaterial({ color: 0x7a52ff })); star.rotation.x = -Math.PI / 2; star.position.y = 0.03; star.receiveShadow = true; world.add(star);

    /* ---- trees: round blossom and green trees around the edge, never on paths or portals ---- */
    const trunks = [], leaves = [], blossom = [];
    for (let i = 0; i < 140 && trunks.length < 34; i++) {
      const a = rand() * Math.PI * 2, r = 25 + rand() * 9, x = Math.sin(a) * r, z = Math.cos(a) * r;
      if (!onIsland(x, z, 2.5) || onPath(x, z, 4) || nearPortal(x, z, 7)) continue;
      const s = 0.8 + rand() * 0.55, h = 2.6 * s, pink = rand() < 0.42;
      trunks.push([x, h / 2, z, rand(), 0.7 * s, h, 0.7 * s, i]);
      const into = pink ? blossom : leaves;
      into.push([x, h + 1.2 * s, z, rand(), 3.4 * s, 2.4 * s, 3.4 * s, i]);
      into.push([x + 0.5 * s, h + 2.6 * s, z - 0.3 * s, rand(), 2.3 * s, 1.6 * s, 2.3 * s, i + 1]);
      if (rand() < 0.6) into.push([x - 1.2 * s, h + 0.7 * s, z + 0.9 * s, rand(), 1.6 * s, 1.3 * s, 1.6 * s, i + 2]);
    }
    instanced(trunks, [0x8a5a36, 0x7a4e2f], true);
    instanced(leaves, [0x3f9a4c, 0x48a653, 0x388d44], true);
    instanced(blossom, [0xf58cc4, 0xf7a0cf, 0xec7fbb, 0xd59cf5], true);

    /* ---- bushes, flowers, grass tufts and rocks ---- */
    const bushes = [], stems = [], heads = [], tufts = [], rocks = [];
    const free = (x, z, d) => onIsland(x, z, 1.5) && Math.hypot(x, z) > PLAZA + 1 && !onPath(x, z, 2.6) && !nearPortal(x, z, d || 4.5);
    for (let i = 0; i < 70; i++) { const x = (rand() * 2 - 1) * 32, z = (rand() * 2 - 1) * 32; if (!free(x, z, 5) || Math.hypot(x, z) < 15) continue; const s = 0.6 + rand() * 0.7; bushes.push([x, 0.45 * s, z, rand() * 3, 1.6 * s, 0.95 * s, 1.6 * s, i]); }
    /* flowers grow in little meadows, so the colour clusters instead of speckling */
    const patches = []; for (let i = 0; i < 26; i++) { const a = rand() * Math.PI * 2, r = 12 + rand() * 19; patches.push([Math.sin(a) * r, Math.cos(a) * r, Math.floor(rand() * 5)]); }
    patches.forEach((p, k) => { for (let i = 0; i < 18; i++) { const x = p[0] + (rand() - 0.5) * 6, z = p[1] + (rand() - 0.5) * 6; if (!free(x, z, 3.5)) continue; const h = 0.35 + rand() * 0.25; stems.push([x, h / 2, z, 0, 0.09, h, 0.09, 0]); heads.push([x, h + 0.08, z, rand(), 0.3, 0.2, 0.3, p[2] + (i % 3 === 0 ? 1 : 0)]); } });
    for (let i = 0; i < 520; i++) { const x = (rand() * 2 - 1) * 33, z = (rand() * 2 - 1) * 33; if (!free(x, z, 3.2)) continue; tufts.push([x, 0.18, z, rand() * 3, 0.16, 0.36 + rand() * 0.3, 0.16, i]); }
    for (let i = 0; i < 26; i++) { const x = (rand() * 2 - 1) * 31, z = (rand() * 2 - 1) * 31; if (!free(x, z, 5)) continue; const s = 0.5 + rand() * 0.9; rocks.push([x, 0.3 * s, z, rand() * 3, 1.2 * s, 0.7 * s, 1 * s, i]); }
    instanced(bushes, [0x3f9a4c, 0x37904a, 0x4aa857], true);
    instanced(stems, [0x3f8f48]);
    instanced(heads, [0xff6fae, 0xffd23f, 0xffffff, 0xa98bff, 0xff8f5c, 0x7dd3ff]);
    instanced(tufts, [0x3d9446, 0x46a04f, 0x52ac58]);
    instanced(rocks, [0xc9c3d6, 0xb8b1c7, 0xd6d0e0], true);

    /* ---- a little pond with lily pads, between two portals ---- */
    const pond = new THREE.Mesh(new THREE.CylinderGeometry(4.6, 4.6, 0.12, 40), new THREE.MeshLambertMaterial({ color: 0x3f9fe8, transparent: true, opacity: 0.88 }));
    pond.position.set(-15, 0.04, 15); world.add(pond);
    const pondRim = []; for (let i = 0; i < 30; i++) { const a = i / 30 * Math.PI * 2; pondRim.push([-15 + Math.sin(a) * 4.9, 0.12, 15 + Math.cos(a) * 4.9, a, 1.1, 0.3, 0.6, i % 3]); }
    instanced(pondRim, STONE);
    instanced([[-16.4, 0.13, 14.2, 0.3, 1.1, 0.06, 1.1, 0], [-13.6, 0.13, 16.1, 1.1, 0.9, 0.06, 0.9, 1], [-15.2, 0.13, 17.3, 2, 0.7, 0.06, 0.7, 0]], [0x4fae5b, 0x5bbd63]);

    /* ---- lanterns round the plaza: warm glow at dusk-like light ---- */
    const posts = [], lamps = [];
    for (let i = 0; i < 8; i++) { const a = (i + 0.5) / 8 * Math.PI * 2, x = Math.sin(a) * (PLAZA + 1.6), z = Math.cos(a) * (PLAZA + 1.6); posts.push([x, 1.1, z, 0, 0.26, 2.2, 0.26, 0]); posts.push([x, 2.25, z, 0, 0.6, 0.12, 0.6, 0]); lamps.push([x, 2.62, z, 0, 0.46, 0.6, 0.46, i % 2]); }
    instanced(posts, [0x2a2733], true);
    instanced(lamps, [0xffe2a0, 0xfff0c8], false, new THREE.MeshBasicMaterial({ color: 0xffffff }));
    const glow = new THREE.PointLight(0xffc27a, 0.35, 22, 2); glow.position.set(0, 4, 0); world.add(glow);

    /* ---- portals: a stone arch with a glowing pane, a pad you walk onto, and a floating name ---- */
    const panes = [];
    portals.forEach(p => {
      const g = new THREE.Group(); g.position.set(p.x, 0, p.z); g.rotation.y = Math.atan2(p.x, p.z); world.add(g);
      const add = (w, h, d, c, x, y, z, mat) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat || lam(c)); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; g.add(m); return m; };
      add(1.1, 5.6, 1.1, 0xe4dccd, -2.6, 2.8, 0.6); add(1.1, 5.6, 1.1, 0xe4dccd, 2.6, 2.8, 0.6); add(6.6, 1.1, 1.3, 0xe4dccd, 0, 6.0, 0.6);
      add(1.4, 0.5, 1.4, 0x2a2733, -2.6, 0.25, 0.6); add(1.4, 0.5, 1.4, 0x2a2733, 2.6, 0.25, 0.6); add(7.2, 0.35, 1.6, 0x2a2733, 0, 6.65, 0.6);
      const col = new THREE.Color(p.col);
      const pane = add(4.1, 4.9, 0.12, 0, 0, 3.0, 0.6, new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false }));
      pane.castShadow = false; panes.push(pane);
      const pad = new THREE.Mesh(new THREE.CylinderGeometry(p.r, p.r, 0.12, 36), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.38 })); pad.position.set(0, 0.06, -1.6); g.add(pad);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(p.r, 0.12, 8, 48), new THREE.MeshBasicMaterial({ color: col })); ring.rotation.x = Math.PI / 2; ring.position.set(0, 0.14, -1.6); g.add(ring);
      p._pad = pad; p._ring = ring;
      /* the name floats above the arch */
      const c = document.createElement('canvas'); c.width = 512; c.height = 128; const tex = new THREE.CanvasTexture(c);
      const draw = () => { const k = c.getContext('2d'); k.clearRect(0, 0, 512, 128); k.font = '400 58px Coolvetica, "Archivo Black", sans-serif'; const w = Math.min(492, k.measureText(p.name).width + 56);
        k.fillStyle = '#0d0c12'; roundRect(k, 256 - w / 2 + 4, 20, w, 90, 26); k.fill(); k.fillStyle = '#ffffff'; roundRect(k, 256 - w / 2, 12, w, 90, 26); k.fill(); k.lineWidth = 7; k.strokeStyle = '#0d0c12'; k.stroke();
        k.fillStyle = '#0d0c12'; k.textAlign = 'center'; k.textBaseline = 'middle'; k.fillText(p.name, 256, 60, 470); tex.needsUpdate = true; };
      draw(); if (document.fonts && document.fonts.ready) document.fonts.ready.then(draw);
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthWrite: false })); sp.scale.set(7.6, 1.9, 1); sp.position.set(0, 8.3, 0.6); sp.renderOrder = 4; g.add(sp); p._label = sp;
    });
    function roundRect(k, x, y, w, h, r) { k.beginPath(); k.moveTo(x + r, y); k.arcTo(x + w, y, x + w, y + h, r); k.arcTo(x + w, y + h, x, y + h, r); k.arcTo(x, y + h, x, y, r); k.arcTo(x, y, x + w, y, r); k.closePath(); }

    /* ---- clouds drifting below and around the island ---- */
    const clouds = [];
    for (let i = 0; i < 9; i++) {
      const g = new THREE.Group(), a = i / 9 * Math.PI * 2 + rand(), r = 52 + rand() * 30, y = -10 + rand() * 30;
      const mat = new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.92 });
      for (let k = 0; k < 4; k++) { const m = new THREE.Mesh(unit, mat); m.scale.set(6 + rand() * 6, 2 + rand() * 2, 4 + rand() * 4); m.position.set((k - 1.5) * 4, rand() * 1.5, (rand() - 0.5) * 3); g.add(m); }
      g.position.set(Math.sin(a) * r, y, Math.cos(a) * r); world.add(g); clouds.push({ g, a, r, y, sp: 0.004 + rand() * 0.006 });
    }

    /* ---- petals and fireflies drifting in the air ---- */
    const N = 140, pos = new Float32Array(N * 3), base = [];
    for (let i = 0; i < N; i++) { const x = (rand() * 2 - 1) * 34, z = (rand() * 2 - 1) * 34, y = 0.5 + rand() * 9; base.push([x, y, z, rand() * 6]); pos.set([x, y, z], i * 3); }
    const pgeo = new THREE.BufferGeometry(); pgeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const pcan = document.createElement('canvas'); pcan.width = pcan.height = 32; { const k = pcan.getContext('2d'), gr = k.createRadialGradient(16, 16, 0, 16, 16, 16); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.4, 'rgba(255,220,240,.9)'); gr.addColorStop(1, 'rgba(255,200,230,0)'); k.fillStyle = gr; k.fillRect(0, 0, 32, 32); }
    const petals = new THREE.Points(pgeo, new THREE.PointsMaterial({ size: 0.42, map: new THREE.CanvasTexture(pcan), transparent: true, depthWrite: false, color: 0xffd6ec }));
    world.add(petals);

    /* ---- sky and soft light ---- */
    const hemi = new THREE.HemisphereLight(0xcfe0ff, 0xffd9b8, 0.12); world.add(hemi);
    const skyC = document.createElement('canvas'); skyC.width = 4; skyC.height = 256; { const k = skyC.getContext('2d'), gr = k.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, '#a9c8ff'); gr.addColorStop(0.45, '#dcd3ff'); gr.addColorStop(0.75, '#ffe3f1'); gr.addColorStop(1, '#fff1e6'); k.fillStyle = gr; k.fillRect(0, 0, 4, 256); }
    const sky = new THREE.CanvasTexture(skyC);
    const fog = new THREE.Fog(0xf3e4f6, 58, 150);

    return {
      world, arena: 9, ring: 10, field: 33, size: 82, animals: [], pickups: [], boostPoints: [], sky, fog,
      animate(t) {
        for (let i = 0; i < N; i++) { const b = base[i]; pos[i * 3] = b[0] + Math.sin(t * 0.3 + b[3]) * 1.6; pos[i * 3 + 1] = b[1] + Math.sin(t * 0.6 + b[3] * 2) * 0.6; pos[i * 3 + 2] = b[2] + Math.cos(t * 0.25 + b[3]) * 1.6; }
        pgeo.attributes.position.needsUpdate = true;
        clouds.forEach(c => { c.a += c.sp * 0.02; c.g.position.set(Math.sin(c.a) * c.r, c.y + Math.sin(t * 0.2 + c.r) * 0.8, Math.cos(c.a) * c.r); });
        panes.forEach((m, i) => { m.material.opacity = 0.42 + Math.sin(t * 2 + i) * 0.14; });
        portals.forEach((p, i) => { if (p._ring) { const s = 1 + Math.sin(t * 2.4 + i) * 0.06; p._ring.scale.set(s, s, 1); } if (p._label) p._label.position.y = 8.3 + Math.sin(t * 1.6 + i) * 0.18; });
        pond.material.opacity = 0.8 + Math.sin(t * 1.3) * 0.05;
      }
    };
  }
  globalThis.STAKKZ_BUILD_WORLD = build;
})();
