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
    const draw = (txt) => { const k = c.getContext('2d'); k.clearRect(0, 0, 512, 128); k.font = (opts.brand ? '900 ' + (opts.size || 56) + 'px "Barlow Condensed", Coolvetica, sans-serif' : '800 ' + (opts.size || 44) + 'px "Plus Jakarta Sans", system-ui, sans-serif'); const w = Math.min(500, k.measureText(txt).width + 54), h = opts.h || 86, y = 64 - h / 2;
      k.fillStyle = '#0b0b0f'; rr(k, 256 - w / 2 + 3, y + 6, w, h, 22); k.fill(); k.fillStyle = opts.bg || '#fff'; rr(k, 256 - w / 2, y, w, h, 22); k.fill(); k.lineWidth = 6; k.strokeStyle = '#0b0b0f'; k.stroke();
      k.fillStyle = opts.fg || '#0b0b0f'; k.textAlign = 'center'; k.textBaseline = 'middle'; k.fillText(txt, 256, 64, 460); tex.needsUpdate = true; };
    draw(text); if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => draw(text));
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthWrite: false, transparent: true })); sp.scale.set((opts.w || 6) , (opts.w || 6) / 4, 1); sp.renderOrder = 5; sp.userData.draw = draw; return sp;
  }
  function rr(k, x, y, w, h, r) { k.beginPath(); k.moveTo(x + r, y); k.arcTo(x + w, y, x + w, y + h, r); k.arcTo(x + w, y + h, x, y + h, r); k.arcTo(x, y + h, x, y, r); k.arcTo(x, y, x + w, y, r); k.closePath(); }

  /* ---------------- pixel grass landscape ----------------
     A small hand-built, nearest-neighbour grass tile and instanced plants.
     No external terrain assets, no terrain collision changes, and no per-frame plant work. */
  function grassTexture() {
    const cv = document.createElement('canvas'); cv.width = 128; cv.height = 128;
    const ctx = cv.getContext('2d'), greens = ['#548a42','#619449','#477f40','#6b9c4e','#78a65b','#4a8442','#5c9250','#719c51'];
    let seed = 14329; const rand = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      ctx.fillStyle = greens[Math.floor(rand() * greens.length)];
      ctx.fillRect(x * 8, y * 8, 8, 8);
      if (rand() < 0.54) { ctx.fillStyle = rand() > 0.5 ? '#83a961' : '#3e783b'; ctx.fillRect(x * 8 + (rand() > .5 ? 4 : 1), y * 8 + (rand() > .5 ? 1 : 5), 3, 2); }
    }
    const tex = new THREE.CanvasTexture(cv);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(L.size / 4, L.size / 4);
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestMipmapNearestFilter;
    tex.colorSpace = THREE.SRGBColorSpace || tex.colorSpace;
    tex.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 4);
    return tex;
  }
  function landscape() {
    // A textured green carpet with a restrained, blocky palette: intentionally not a plain green plane.
    ground.material = new THREE.MeshLambertMaterial({ map: grassTexture(), color: 0xffffff });
    const seed = 57031, hash = n => { let a = Math.sin(n * 123.567 + seed) * 43758.5453; return a - Math.floor(a); };
    const clear = (x, z) => {
      if (Math.hypot(x, z) < 9) return true;
      for (const p of Object.values(L.spots)) if (Math.hypot(x - p.x, z - p.z) < 10) return true;
      for (const c of Object.values(L.circles)) if (Math.hypot(x - c.x, z - c.z) < c.r + 2) return true;
      for (const p of [...Object.values(L.spots), ...Object.values(L.circles)]) {
        let tx = p.x, tz = p.z;
        if (p.face != null) { tx += Math.sin(p.face) * 3.5; tz += Math.cos(p.face) * 3.5; }
        const t = clamp((x * tx + z * tz) / (tx * tx + tz * tz), 0, 1);
        if (Math.hypot(x - t * tx, z - t * tz) < 2.5) return true;
      }
      return false;
    };
    const tufts = new THREE.InstancedMesh(new THREE.BoxGeometry(0.09, 0.23, 0.12), new THREE.MeshLambertMaterial({color:0xffffff, side:THREE.DoubleSide}), 1350);
    const dummy = new THREE.Object3D(), tint = new THREE.Color(), tcols = [0x317539,0x477f40,0x69a34f,0x79a959,0x4c8e47];
    let used = 0;
    for (let n = 0; n < 3200 && used < tufts.count; n++) {
      const x = (hash(n*4+1)-.5)*152, z = (hash(n*4+2)-.5)*152;
      if (clear(x,z)) continue;
      dummy.position.set(x,0.11,z); dummy.rotation.set(0,hash(n*4+3)*6.28318,0);
      const h = .6 + hash(n*4+4)*1.1; dummy.scale.set(.75,h,.8); dummy.updateMatrix();
      tufts.setMatrixAt(used,dummy.matrix); tufts.setColorAt(used,tint.setHex(tcols[n%tcols.length])); used++;
    }
    tufts.count = used; tufts.instanceMatrix.needsUpdate = true; worldG.add(tufts);
    const stems = new THREE.InstancedMesh(new THREE.BoxGeometry(0.085,0.35,0.085),lam(0x427b3c),86);
    const heads = new THREE.InstancedMesh(new THREE.BoxGeometry(0.30,0.20,0.30),new THREE.MeshLambertMaterial({color:0xffffff}),86);
    const petals=[0xf7e3a2,0xf6f0e8,0x9476d6,0xf1b6c5,0xf6d56e];
    let flowers=0;
    for(let n=0;n<420 && flowers<86;n++){
      const x=(hash(7000+n*5)-.5)*130,z=(hash(7001+n*5)-.5)*130;
      if(clear(x,z))continue;
      dummy.rotation.set(0,hash(7003+n*5)*Math.PI,0);dummy.scale.setScalar(1);
      dummy.position.set(x,0.18,z);dummy.updateMatrix();stems.setMatrixAt(flowers,dummy.matrix);
      dummy.position.y=.40;dummy.updateMatrix();heads.setMatrixAt(flowers,dummy.matrix);
      heads.setColorAt(flowers,tint.setHex(petals[n%petals.length]));flowers++;
    }
    stems.count=heads.count=flowers;stems.instanceMatrix.needsUpdate=true;heads.instanceMatrix.needsUpdate=true;
    worldG.add(stems,heads);
  }
  function steppingPaths() {
    const dest = [...Object.values(L.spots), ...Object.values(L.circles)];
    const pieces=[];
    dest.forEach(target=>{
      const tx=target.x+(target.face===undefined?0:Math.sin(target.face)*3.1);
      const tz=target.z+(target.face===undefined?0:Math.cos(target.face)*3.1);
      const len=Math.hypot(tx,tz), steps=Math.floor((len-4.5)/1.48);
      for(let n=0;n<steps;n++){
        const t=(3.8+n*1.48)/len; if(t>=1)break;
        const x=tx*t,z=tz*t;
        for(let side=-1;side<=1;side++)pieces.push([x+Math.cos(Math.atan2(tx,tz))*side*1.4,z-Math.sin(Math.atan2(tx,tz))*side*1.4,n,side]);
      }
    });
    const stones=new THREE.InstancedMesh(new THREE.BoxGeometry(1.41,0.09,1.43),new THREE.MeshLambertMaterial({color:0xffffff}),pieces.length);
    const d=new THREE.Object3D(),col=new THREE.Color(),shades=[0xccc6ad,0xdad3b9,0xbeb69a,0xe4d7bc];
    pieces.forEach((p,i)=>{d.position.set(p[0],0.045,p[1]);d.rotation.set(0,0,0);d.scale.setScalar(1);d.updateMatrix();stones.setMatrixAt(i,d.matrix);stones.setColorAt(i,col.setHex(shades[(p[2]+p[3]+8)%4]));});
    stones.instanceMatrix.needsUpdate=true;stones.receiveShadow=true;worldG.add(stones);
  }

  /* ---------------- building the plaza ---------------- */
  const anim = [];   // {fn(t,dt)}
  function buildPlaza() {
    const g = worldG;
    /* spawn pad: a black ring, a purple centre and the BITZ mark */
    const ring = new THREE.Mesh(new THREE.RingGeometry(3.3, 3.7, 64), new THREE.MeshBasicMaterial({ color: 0x0b0b0f })); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.02; g.add(ring);
    const centre = new THREE.Mesh(new THREE.CircleGeometry(1.1, 48), new THREE.MeshBasicMaterial({ color: 0x7a52ff })); centre.rotation.x = -Math.PI / 2; centre.position.y = 0.021; g.add(centre);
    /* warm stone paths lead to each actual shop entrance and both circles */
    steppingPaths();
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
  /* Shop rooms share one lightweight timber structure. The open entry is at local +Z.
     Front half of roof is uncovered so third-person cameras can look inside. */
  function buildStand(s) {
    const g=new THREE.Group(); g.position.set(s.x,0,s.z); g.rotation.y=s.face;
    worldG.add(g); W.spots[s.id]=g;
    const isSeller=s.id==='seller',isBuyer=s.id==='buyer';
    const accent=isSeller?0x825cf5:isBuyer?0xf1bd42:0x29243a;
    const wood=0x9c734c,lightWood=0xd7ab70,darkWood=0x513a31,stone=0xe6dfcb,deep=0x1c1b22;
    const interior=new THREE.Group(); g.add(interior);

    // Coloured stone floor and individual square pavers.
    box(interior,9.5,0.12,8.8,stone,0,0,-0.60,0);
    for(let x=-4;x<=4;x++) for(let z=-4;z<=3;z++){
      const odd=(x+z+32)%3===0, colour=odd?0xd5cbb0:((x+z)%2===0?0xe7ddc3:0xeee7d3);
      box(interior,.94,.012,.94,colour,x,0.068,z,0);
    }
    const mat=box(interior,4.3,.045,1.05,accent,0,.09,2.85,0);
    mat.receiveShadow=true;

    // Substantial timber shell: side/back walls, framing and an open front door.
    for(const sign of [-1,1]){
      box(interior,.34,2.35,8.2,wood,sign*4.65,1.24,-.65,0);
      box(interior,.54,5.8,.55,darkWood,sign*4.62,2.9,3.36);
      box(interior,.54,5.8,.55,darkWood,sign*4.62,2.9,-4.75);
      box(interior,.22,.26,8.6,lightWood,sign*4.64,2.55,-.65,0);
      for(const z of [-3.45,-1.55,.45,2.45])box(interior,.26,2.1,.26,darkWood,sign*4.62,1.40,z,0);
      // Two proper front sections, leaving an easy-to-see 4.8-unit door opening.
      box(interior,2.18,2.05,.36,wood,sign*3.55,1.09,3.4,0);
      box(interior,2.22,.24,.40,lightWood,sign*3.55,2.26,3.4,0);
      // Shop-window sill and glass high above the low wall.
      const pane=new THREE.Mesh(new THREE.PlaneGeometry(5.2,1.28),new THREE.MeshBasicMaterial({color:0xdff4e3,transparent:true,opacity:.27,side:THREE.DoubleSide,depthWrite:false}));
      pane.position.set(sign*4.40,3.38,-.6);pane.rotation.y=Math.PI/2;interior.add(pane);
    }
    box(interior,9.4,2.6,.37,wood,0,1.33,-4.90,0);
    box(interior,9.5,.28,.55,darkWood,0,2.73,-4.90,0);
    box(interior,9.8,.5,.62,darkWood,0,5.60,3.35);
    box(interior,9.8,.35,.68,darkWood,0,5.52,-4.80);
    for(const z of [-4.7,-2.8,-.9,1.0,3.35])box(interior,9.8,.20,.42,lightWood,0,5.4,z,0);
    for(const x of [-3.45,-1.15,1.15,3.45])box(interior,.22,.20,8.4,darkWood,x,5.50,-.72,0);
    // Partial tiled roof only above the counter, leaving the entry visible to the camera.
    for(let i=0;i<8;i++){
      const x=-4.13+i*1.18;
      box(interior,1.10,.13,3.5,i%2?0x795542:0x9d7459,x,5.73,-3.05,0);
    }
    // Visible, oversized sign and entry invitation.
    const sign=label(isSeller?'THE PACK SHOP':isBuyer?'CARD BUYER':'THE DEALER',{
      bg:isSeller?'#825cf5':isBuyer?'#f1bd42':'#17151d',fg:isBuyer?'#141217':'#ffffff',brand:true,size:66,w:7.8
    });
    sign.position.set(0,6.13,3.75);g.add(sign);
    const sub=label('WALK INSIDE  •  PRESS E',{bg:'#fff7e8',fg:'#2d2420',size:35,w:5.6});
    sub.position.set(0,4.78,3.57);g.add(sub);
    // A weathered timber welcome board hangs to one side of the door.
    box(interior,.45,3.0,.45,darkWood,-2.45,1.5,3.55,0);
    box(interior,.45,3.0,.45,darkWood,2.45,1.5,3.55,0);
    box(interior,5.30,.35,.45,lightWood,0,3.12,3.55,0);

    // Counter, shelving, crates and lighting make it a genuine interior.
    box(interior,5.9,1.12,1.0,lightWood,0,.67,-2.30);
    box(interior,6.35,.25,1.3,darkWood,0,1.35,-2.30,0);
    box(interior,6.20,.10,.28,accent,0,1.52,-1.65,0);
    for(const x of [-2.35,-1.4,-.45,.45,1.4,2.35]) box(interior,.085,.95,.08,wood,x,.61,-1.79,0);
    for(const side of [-1,1]){
      // Side-wall stock shelving, deliberately outside the central walking aisle.
      for(const y of [1.02,2.16,3.30]){
        box(interior,1.55,.18,3.2,darkWood,side*3.65,y,-.75,0);
        for(const z of [-1.65,-.60,.46]){
          const shade=isSeller?(y>2.2?0x182d62:0xcc3d2c):isBuyer?0xecc34d:0x574179;
          box(interior,.53,.48,.45,shade,side*3.65,y+.32,z,0);
          box(interior,.45,.06,.04,0xfff0d5,side*3.65,y+.29,z+.24,0);
        }
      }
      box(interior,.22,2.9,.24,darkWood,side*3.65,1.45,1.35,0);
      // Warm lantern with decorative square gold housing, no expensive extra dynamic shadow.
      box(interior,.20,.82,.22,deep,side*3.0,4.57,1.55,0);
      const glass=box(interior,.48,.55,.48,new THREE.MeshBasicMaterial({color:0xffe2a3}),side*3,4.01,1.55,0);
      box(interior,.55,.12,.55,deep,side*3,4.33,1.55,0);
      glass.castShadow=false;
    }
    const labels={seller:['RED HOT','GOLDEN STAR','EUROPEAN NIGHTS'],buyer:['SELL CARDS','CASH PAID','SAFE TRADES'],dealer:['STANDING ORDERS','LIVE RACES','BIG REWARDS']};
    labels[s.id].forEach((txt,i)=>{
      const c=isSeller?['#b52b14','#c19222','#182b63'][i]:isBuyer?'#f0d16e':'#6550a2';
      const plate=label(txt,{bg:c,fg:isSeller&&i!==1?'#ffffff':'#15131a',brand:true,size:42,w:3.25});
      plate.position.set((i-1)*2.85,3.65,-4.49);g.add(plate);
    });
    // Different shop contents give the rooms character without separate systems.
    if(isSeller){
      const colours=[0xc82c1b,0xe8b631,0x203b7a];
      colours.forEach((c,i)=>{
        for(let k=0;k<3;k++){
          const p=box(interior,.54,.85,.13,c,(i-1)*1.75+k*.15,1.98,-2.05-k*.06,0);
          p.rotation.x=-.12;
          box(interior,.45,.12,.025,0xfaf0dc,(i-1)*1.75+k*.15,2.00,-1.94-k*.06,0);
        }
      });
      box(interior,1.40,.80,.65,0x221e2a,3.37,.62,1.45,0);
      box(interior,1.05,.15,.40,0xe5c455,3.37,1.08,1.45,0);
    }else if(isBuyer){
      // Golden brass trading scale, stacks of penny sleeves and vault cases.
      cyl(interior,.08,.1,.86,0x30303a,-1.35,1.83,-2.00,10,0);
      box(interior,1.25,.11,.12,0xe2b94c,-1.35,2.20,-2.00,0);
      for(const x of [-1.75,-.95])cyl(interior,.38,.38,.055,0xf1c247,x,1.85,-2.0,20,0);
      for(let k=0;k<4;k++)box(interior,.85,.05,.65,k%2?0xfff8e8:0xd6c49c,1.30,1.57+k*.06,-2.0,0);
      box(interior,1.20,.92,.82,0x27242b,3.3,.52,1.50,0);
      box(interior,.94,.14,.18,0xf1c247,3.3,1.02,1.91,0);
    }else{
      const clipboard=box(interior,4.45,2.20,.17,0x292331,0,3.28,-4.53);
      box(clipboard,4.02,1.78,.035,0xe6d9be,0,0,0.105,0);
      for(let i=0;i<4;i++){
        box(interior,3.37,.10,.07,i===0?0x7b58e3:0x5f5349,0,3.87-i*.34,-4.39,0);
        box(interior,.23,.18,.07,0xf1bf54,-1.74,3.87-i*.34,-4.28,0);
      }
      // Countdown clock, open pack and a pile of completed request cards.
      cyl(interior,.55,.55,.14,0xf6e9bc,3.4,3.8,-4.42,24,0);
      box(interior,.07,.37,.06,0x211e23,3.4,3.85,-4.29,0);
      for(let i=0;i<5;i++)box(interior,.65,.09,.85,i%2?0x32263f:0x9f8ab6,-1.25+i*.15,1.62+i*.07,-2.05,0);
    }

    // NPC stays in the shop, behind its counter.
    const looks={
      seller:{look:{skin:2,hair:'short',hc:1,outfit:'overalls',hat:'cap',acc:''},col:'#825cf5'},
      buyer:{look:{skin:1,hair:'bun',hc:0,outfit:'tux',hat:'tophat',acc:'shades'},col:'#0b0b0f'},
      dealer:{look:{skin:4,hair:'none',hc:0,outfit:'hoodie',hat:'',acc:'chain'},col:'#825cf5'}
    }[s.id];
    const npc=AV.make(THREE,looks.look,looks.col);npc.position.set(0,0,-3.42);npc.scale.setScalar(1.2);npc.rotation.y=Math.PI;g.add(npc);
    if(isSeller){box(npc.userData.body,.46,.50,.035,accent,0,.62,.17,0);box(npc.userData.body,.30,.1,.04,0xffffff,0,.56,.19,0);}
    if(s.id==='dealer'){box(npc.userData.head,.62,.1,.04,0x0b0b0f,0,.32,.31,0);box(npc.userData.body,.53,.17,.35,0x0b0b0f,0,.92,-.05,0);}
    const bubble=label('',{w:7,size:40,h:90});bubble.position.set(0,4.05,-2.82);bubble.visible=false;g.add(bubble);bubbles.push(bubble);
    W.npcs[s.id]={g,npc,bubble,until:0,nearT:0,waveAt:0};
    anim.push({fn:(t,dt)=>{
      const n=W.npcs[s.id],me=W.me,near=me&&Math.hypot(me.x-s.x,me.z-s.z)<s.r+2;
      n.npc.userData.anim(t,dt,{});
      if(near&&t>n.waveAt){n.waveAt=t+9;n.npc.userData.emote('wave');}
      if(n.bubble.visible&&t>n.until)n.bubble.visible=false;
      if(me&&near){
        const dx=me.x-s.x,dz=me.z-s.z,want=Math.atan2(dx,dz)-s.face;
        n.npc.rotation.y+=Math.atan2(Math.sin(want-n.npc.rotation.y),Math.cos(want-n.npc.rotation.y))*.08;
      }else n.npc.rotation.y+=Math.atan2(Math.sin(Math.PI-n.npc.rotation.y),Math.cos(Math.PI-n.npc.rotation.y))*.04;
    }});
  }
  function insideShop(s,x,z){
    if(!s)return false;
    const dx=x-s.x,dz=z-s.z,cs=Math.cos(s.face),sn=Math.sin(s.face);
    const rx=cs*dx-sn*dz,rz=sn*dx+cs*dz;
    return Math.abs(rx)<4.35&&rz>-4.35&&rz<3.05;
  }
  function shopWall(s,x,z){
    const dx=x-s.x,dz=z-s.z,cs=Math.cos(s.face),sn=Math.sin(s.face);
    const rx=cs*dx-sn*dz,rz=sn*dx+cs*dz,ax=Math.abs(rx);
    // The entrance is open for ±2.3 units, but the front side walls are solid.
    return (ax>4.34&&ax<5.02&&rz>-4.85&&rz<3.63)||
      (rz< -4.65&&rz>-5.21&&ax<4.86)||
      (rz>3.12&&rz<3.70&&ax>2.3&&ax<4.95)||
      (rz>-2.83&&rz<-1.69&&ax<3.12);
  }

  function buildCircle(c, color, pale) {
    const g = new THREE.Group(); g.position.set(c.x, 0, c.z); worldG.add(g);
    const disc = new THREE.Mesh(new THREE.CircleGeometry(c.r, 64), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.16 })); disc.rotation.x = -Math.PI / 2; disc.position.y = 0.014; g.add(disc);
    const ring = new THREE.Mesh(new THREE.RingGeometry(c.r - 0.35, c.r, 96), new THREE.MeshBasicMaterial({ color })); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.02; g.add(ring);
    const ring2 = new THREE.Mesh(new THREE.RingGeometry(c.r - 0.55, c.r - 0.45, 96), new THREE.MeshBasicMaterial({ color: 0x0b0b0f, transparent: true, opacity: 0.6 })); ring2.rotation.x = -Math.PI / 2; ring2.position.y = 0.022; g.add(ring2);
    const inner = new THREE.Mesh(new THREE.RingGeometry(1.2, 1.5, 48), new THREE.MeshBasicMaterial({ color })); inner.rotation.x = -Math.PI / 2; inner.position.y = 0.024; g.add(inner);
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(c.r - 0.3, c.r - 0.3, 2.2, 48, 1, true), new THREE.MeshBasicMaterial({ color: pale, transparent: true, opacity: 0.045, side: THREE.DoubleSide, depthWrite: false })); beam.position.y = 1.1; g.add(beam);
    const N = 26, parts = new THREE.InstancedMesh(new THREE.BoxGeometry(0.16, 0.16, 0.16), new THREE.MeshBasicMaterial({ color }), N), d = new THREE.Object3D(), seeds = Array.from({ length: N }, () => [Math.random() * Math.PI * 2, 0.6 + Math.random() * (c.r - 1), Math.random() * 4, 0.5 + Math.random()]);
    g.add(parts); const pl = new THREE.PointLight(color, 0.7, 14, 2); pl.position.y = 1.5; g.add(pl);
    const glyph = label(c.id === 'gold' ? '×3 CASH' : 'FREE PACKS', { bg: c.id === 'gold' ? '#f2b705' : '#7a52ff', fg: c.id === 'gold' ? '#0b0b0f' : '#fff', brand: true, size: 56, w: 4 }); glyph.position.y = 3.6; g.add(glyph);
    anim.push({ fn: t => { ring.scale.setScalar(1 + Math.sin(t * 2) * 0.012); inner.rotation.z = t * 0.6; disc.material.opacity = 0.14 + Math.sin(t * 2) * 0.04; beam.material.opacity = 0.04 + Math.sin(t * 1.4) * 0.015; glyph.position.y = 3.6 + Math.sin(t * 1.5) * 0.12;
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
  function stat(i, nw, level) { const o = i === 'me' ? W.me : W.others.get(i); if (!o || !o.g) return; o.nw = nw; o.level = level; W.level = i === 'me' ? level : W.level; o.g.userData.tag.userData.draw((i === 'me' ? o.name : o.n || 'Player') + '  ·  Lv ' + level); }
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
    for (const id in W.npcs) if (W.npcs[id].npc === obj) { const s = L.spots[id], me = W.me; if (me && insideShop(s,me.x,me.z) && W.onInteract) W.onInteract(s); else W.say(id, 'Come closer!', 2); return; }
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
        const prevX=m.x,prevZ=m.z;
        m.x = clamp(m.x + fx2 * sp * dt, -L.limit, L.limit); m.z = clamp(m.z + fz2 * sp * dt, -L.limit, L.limit);
        const want = Math.atan2(fx2, fz2); m.ry += Math.atan2(Math.sin(want - m.ry), Math.cos(want - m.ry)) * Math.min(1, dt * 14);
        /* solid shop walls and counters, with a central entrance that players walk through */
        if(Object.values(L.spots).some(s=>shopWall(s,m.x,m.z))){
          m.x=prevX;m.z=prevZ;
        }
        W.touched();
      }
      m.moving = moving; m.runningNow = running;
      if (!m.grounded || m.vy) { m.vy -= 26 * dt; m.y += m.vy * dt; if (m.y <= 0) { m.y = 0; m.vy = 0; if (!m.grounded) { m.grounded = true; m.g.userData.av.userData.M.scale.set(2.15, 1.8, 2.15); } } }
      const Ms = m.g.userData.av.userData.M.scale; Ms.x += (2 - Ms.x) * 0.2; Ms.y += (2 - Ms.y) * 0.2; Ms.z += (2 - Ms.z) * 0.2;
      m.g.position.set(m.x, m.y, m.z); m.g.rotation.y = m.ry;
      m.g.userData.av.userData.anim(t, dt, { moving, running, speed: running ? 1.5 : 1, jumping: !m.grounded });
      if (m.g.userData.pet) petFollow(m.g, m, t, dt, moving, m.g.userData.excited > t);
      /* prompt and zone */
      let best = null, bd = 1e9; for (const s of Object.values(L.spots)) { const d = Math.hypot(m.x - s.x, m.z - s.z); if (insideShop(s,m.x,m.z) && d < bd) { bd = d; best = s; } }
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
    if (flashCol) { const k = Math.max(0, flashUntil - t); scene.background.copy(new THREE.Color(0xd8e8e9)).lerp(flashCol, Math.min(1, k) * 0.7); scene.fog.color.copy(scene.background); if (k <= 0) flashCol = null; }
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
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, small ? 2 : 2)); renderer.setClearColor(0xd8e8e9, 1); renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    scene = new THREE.Scene(); scene.background = new THREE.Color(0xd8e8e9); scene.fog = new THREE.Fog(0xd8e8e9, 78, 235);
    cam = new THREE.PerspectiveCamera(42, 1, 0.5, 500); raycaster = new THREE.Raycaster();
    hemi = new THREE.HemisphereLight(0xf9f6eb, 0x769368, 1.05); scene.add(hemi);
    sun = new THREE.DirectionalLight(0xffffff, 0.78); sun.position.set(26, 48, 20); sun.castShadow = true; sun.shadow.mapSize.set(small ? 1024 : 2048, small ? 1024 : 2048);
    Object.assign(sun.shadow.camera, { left: -44, right: 44, top: 44, bottom: -44, near: 1, far: 160 }); sun.shadow.camera.updateProjectionMatrix(); sun.shadow.bias = -0.0008; sun.shadow.normalBias = 0.02; sun.shadow.radius = 3; scene.add(sun); scene.add(sun.target);
    worldG = new THREE.Group(); scene.add(worldG);
    ground = new THREE.Mesh(new THREE.PlaneGeometry(L.size * 2, L.size * 2), new THREE.MeshLambertMaterial({ color: 0xffffff })); ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
    landscape();
    const edge = new THREE.Mesh(new THREE.RingGeometry(L.limit + 0.3, L.limit + 0.8, 128), new THREE.MeshBasicMaterial({ color: 0x0b0b0f, transparent: true, opacity: 0.12 })); edge.rotation.x = -Math.PI / 2; edge.position.y = 0.01; scene.add(edge);
    buildPlaza(); bindInput(); resize(); addEventListener('resize', resize);
    document.addEventListener('visibilitychange', () => { hidden = document.hidden; });
    W.zoom = innerHeight > innerWidth ? 1.25 : 1;   // portrait phones see a little more of the plaza
    t0 = performance.now(); last = t0; W.ok = true; requestAnimationFrame(frame);
    return true;
  }
  Object.assign(W, { init, add, drop, snap, emote, stat, clear, setMe, spawnAt, pose, jump, celebrate, flash, setOrbit, L, insideShop: (id,x,z)=>insideShop(L.spots[id],x,z), ground: ()=>ground, camera: () => cam, renderer: () => renderer });
  globalThis.BZWORLD = W;
})();
