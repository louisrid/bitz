/* BITZ browser test: real Chrome, desktop and iPhone sizes. Loading screen, voxel grass world and enterable shops, welcome pack, buying
   at the Pack Seller, bulk opening with skip, the book, selling at the Card Buyer, menus, profiles and overlaps.
   Screenshots land in qa-screens/.   Needs: npm install --no-save playwright && npx playwright install chromium */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { chromium } from 'playwright';
import '../public/world-layout.js';
const L = globalThis.STAKKZ_WORLD_LAYOUT, PORT = 4600 + Math.floor(Math.random() * 300), BASE = 'http://127.0.0.1:' + PORT;
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bitz-br-')), OUT = path.resolve('qa-screens'); fs.mkdirSync(OUT, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const log = (...a) => console.log('PASS', ...a);
const server = spawn(process.execPath, ['server.js'], { env: { ...process.env, PORT, DATA_FILE: path.join(dir, 'data.json'), NODE_ENV: 'test', BITZ_FAST_TIMERS: '1', BITZ_FILE_ACCOUNTS: '1', BITZ_TEST_CASH: '2000000', STAKKZ_SECRET: 'browser-test' }, stdio: ['ignore', 'pipe', 'pipe'] });
let slog = ''; server.stdout.on('data', d => { slog += d; }); server.stderr.on('data', d => { slog += d; });
for (let i = 0; i < 300; i++) { try { if ((await fetch(BASE + '/api/ping')).ok) break; } catch (e) {} await sleep(100); }
const browser = await chromium.launch(process.env.PW_CHANNEL ? { channel: process.env.PW_CHANNEL, args: ['--ignore-gpu-blocklist'] } : { args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });   // locally: PW_CHANNEL=chrome uses the installed Google Chrome
const errors = [];
async function page(viewport, mobile) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: mobile ? 2 : 1, isMobile: !!mobile, hasTouch: !!mobile, userAgent: mobile ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' : undefined });
  const p = await ctx.newPage();
  p.on('console', m => { if (m.type() === 'error') errors.push(viewport.width + ': ' + m.text()); }); p.on('pageerror', e => errors.push(viewport.width + ': ' + e.message));
  await p.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
  return p;
}
const walk = async (p, x, z) => { for (let i = 0; i < 80; i++) { const done = await p.evaluate(([x, z]) => { const m = BZWORLD.me; const dx = x - m.x, dz = z - m.z, d = Math.hypot(dx, dz); if (d < 0.4) return true; const k = Math.min(1, 2.4 / d); BZWORLD.spawnAt(m.x + dx * k, m.z + dz * k); return false; }, [x, z]); if (done) break; await sleep(130); } await sleep(500); };
const advance = async (p, tap) => { for (let i = 0; i < 14; i++) { if (await p.$('#stage .sum')) return; if (tap) await p.tap('#stage .deck', { force: true }); else await p.keyboard.press('ArrowRight'); await sleep(1400); } await p.waitForSelector('#stage .sum', { timeout: 10000 }); };   // rare pulls hold the card longer, so keep advancing until the summary shows
const shot = (p, name) => p.screenshot({ path: path.join(OUT, name + '.png') });
const noOverlap = async (p, sels) => { const boxes = []; for (const s of sels) { const b = await p.$eval(s, el => { const r = el.getBoundingClientRect(); return el.offsetParent === null && getComputedStyle(el).position !== 'fixed' && getComputedStyle(el).position !== 'absolute' ? null : { x: r.left, y: r.top, w: r.width, h: r.height, s: el.id }; }).catch(() => null); if (b && b.w && b.h) boxes.push(b); } for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) { const a = boxes[i], b = boxes[j]; const hit = a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h; assert(!hit, 'HUD overlap: ' + a.s + ' and ' + b.s); } };
try {
  /* ---------- desktop ---------- */
  const d = await page({ width: 1440, height: 900 });
  await d.waitForSelector('#load', { state: 'detached', timeout: 30000 }); log('desktop: loading screen left on its own');
  await d.waitForSelector('.sheet.in'); await shot(d, 'desktop-01-welcome');
  await d.click('.sheet [data-wel]'); await d.waitForSelector('#stage .sealed'); await sleep(400); await shot(d, 'desktop-02-sealed');
  await d.click('#stage .sealed', { force: true }); await d.waitForSelector('#stage .oc.flipped', { timeout: 8000 }); await sleep(700); await shot(d, 'desktop-03-first-card');
  const first = await d.$eval('#stage .oc.flipped .face.front .bc .plate b', el => el.textContent); assert(first.length > 2, 'player name on card'); log('desktop: welcome pack tears and the first card flips (' + first + ')');
  await advance(d); await shot(d, 'desktop-04-summary');
  const vals = await d.$$eval('#stage .sum .cell .v', els => els.map(e => e.textContent)); assert.equal(vals.length, 5); assert(vals.every(v => /\$\d/.test(v)), 'every card shows a value'); log('desktop: summary lists five cards with values');
  await d.click('#stage .sum [data-a="close"]'); await sleep(300);
  const names = await d.evaluate(() => BZ.state.cards.map(c => BZART.player(c.player).name)); assert.equal(names.length, 5); log('desktop: real player names: ' + names.join(', '));
  const broken = await d.evaluate(async () => { const imgs = [...document.images]; await Promise.all(imgs.map(i => i.complete ? 0 : new Promise(r => { i.onload = i.onerror = r; }))); return imgs.filter(i => !i.naturalWidth).length; }); assert.equal(broken, 0, 'no broken images'); log('desktop: placeholder portraits load, no broken images');
  // Launch gate: genuine WASD, arrow and sprint keyboard events must move the avatar.
  const pose = () => d.evaluate(() => ({x:BZWORLD.me.x,z:BZWORLD.me.z}));
  const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
  for(const key of ['w','s','a','d','ArrowUp','ArrowDown']){
    const start=await pose();await d.keyboard.down(key);await sleep(510);await d.keyboard.up(key);await sleep(80);
    const end=await pose();assert(distance(start,end)>.65,'WASD/arrow movement broken for '+key+': '+JSON.stringify({start,end}));
  }
  const beforeShift=await pose();await d.keyboard.down('Shift');await d.keyboard.down('w');await sleep(450);
  await d.keyboard.up('w');await d.keyboard.up('Shift');assert(distance(beforeShift,await pose())>1.1,'Shift+W sprint must move avatar');
  log('desktop: actual WASD, arrows and Shift+W update world position');
  // A menu blocks movement, then closing it returns control to walking normally.
  await d.click('#btn-menu');await d.waitForSelector('.menu-grid');
  const beforeModal=await pose();await d.keyboard.down('w');await sleep(330);await d.keyboard.up('w');
  assert(distance(beforeModal,await pose())<.12,'WASD must not move beneath open menu');
  await d.click('[data-m="settings"]');await d.waitForSelector('[data-s="music"]');
  const initialAudio=await d.evaluate(()=>BITZAUDIO.state());
  assert(initialAudio.enabled,'Original background music must be enabled by default');
  await d.click('[data-s="music"]');
  assert.equal(await d.evaluate(()=>BITZAUDIO.state().enabled),false,'Music should mute separately from sound effects');
  await d.click('[data-s="music"]');
  assert.equal(await d.evaluate(()=>BITZAUDIO.state().enabled),true,'Music must resume after unmuting');
  await d.evaluate(()=>BZ.close(true));await sleep(200);
  const resumed=await pose();await d.keyboard.down('w');await sleep(400);await d.keyboard.up('w');
  assert(distance(resumed,await pose())>.6,'Walking must resume after closing menu');
  log('desktop: original music toggle works and modal focus cannot break movement');

  await sleep(600); await shot(d, 'desktop-05-world');
  const px = await d.evaluate(() => new Promise(res => requestAnimationFrame(() => { const c = document.getElementById('gl'); const g = c.getContext('webgl2') || c.getContext('webgl'); const b = new Uint8Array(4); g.readPixels(Math.floor(c.width / 2), Math.floor(c.height * 0.8), 1, 1, g.RGBA, g.UNSIGNED_BYTE, b); res([...b]); }))).catch(() => null);
  const grass = await d.evaluate(() => {
    const tex = BZWORLD.ground()?.material?.map;
    if (!tex?.image) return { tile: false };
    const cv = tex.image, data = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
    const tones = new Set(), samples = [];
    for (let i = 0; i < data.length; i += 128) {
      const rgb = [data[i], data[i + 1], data[i + 2]];
      tones.add(rgb.join(','));
      samples.push(rgb[1] > rgb[0] + 18 && rgb[1] > rgb[2]);
    }
    return { tile: true, tones: tones.size, greenRatio: samples.filter(Boolean).length / samples.length };
  });
  assert(grass.tile && grass.tones >= 5 && grass.greenRatio > 0.7, 'voxel grass needs distinct earthy green tiles: ' + JSON.stringify(grass));
  assert(px && px.some(v => v > 60), 'world should draw real terrain and shops, not black: ' + px);
  log('desktop: pixel grass terrain renders (' + grass.tones + ' colours, '+ Math.round(grass.greenRatio * 100) + '% green)');
  await noOverlap(d, ['#hud-tl', '#hud-tr', '#hud-bottom']); log('desktop: HUD panels do not overlap');
  /* earn: gold circle */
  await walk(d, L.circles.gold.x, L.circles.gold.z); await d.waitForFunction(() => BZ.zone === 'gold'); await sleep(2600); const zoneText = await d.$eval('#hud-zone', e => e.textContent); assert(/GOLD/.test(zoneText)); log('desktop: Gold Circle recognised on the HUD');
  await walk(d, L.circles.purple.x, L.circles.purple.z); await d.waitForFunction(() => BZ.zone === 'purple'); await d.waitForFunction(() => (BZ.state.packs || {})['red-hot'] >= 1, null, { timeout: 15000 }); log('desktop: Purple Circle delivered a Red Hot pack');
  /* seller */
  await walk(d, L.spots.seller.x + Math.sin(L.spots.seller.face) * 7.7, L.spots.seller.z + Math.cos(L.spots.seller.face) * 7.7);
  await d.waitForFunction(() => !BZWORLD.prompt);
  assert.equal(await d.evaluate(() => BZWORLD.insideShop('seller', BZWORLD.me.x, BZWORLD.me.z)), false, 'shop unavailable from outside');
  await walk(d, L.spots.seller.x + Math.sin(L.spots.seller.face) * 2.5, L.spots.seller.z + Math.cos(L.spots.seller.face) * 2.5);
  await d.waitForFunction(() => BZWORLD.prompt?.id === 'seller');
  assert.equal(await d.evaluate(() => BZWORLD.insideShop('seller', BZWORLD.me.x, BZWORLD.me.z)), true, 'seller must be entered');
  await d.waitForSelector('#btn-act:not([hidden])'); await sleep(400); await shot(d, 'desktop-06-at-seller');
  log('desktop: player walks into an actual shop before it can be used');
  await d.keyboard.press('e'); await d.waitForSelector('.setcard'); await sleep(300); await shot(d, 'desktop-07-seller');
  assert.equal(await d.$$eval('.setcard', e => e.length), 3); log('desktop: Pack Seller shows exactly three collections');
  await d.click('[data-odds="golden-star"]'); await d.waitForSelector('.odds'); await shot(d, 'desktop-08-odds'); await d.click('.sheet [data-a="close"]'); await sleep(250);
  await d.click('[data-buy="red-hot"][data-kind="box"]'); await d.waitForSelector('[data-open="red-hot"]'); await d.click('[data-open="red-hot"]'); await d.waitForSelector('#stage .oc', { timeout: 10000 }); await sleep(900); await shot(d, 'desktop-09-bulk');
  await d.click('#stage [data-skip]'); await d.waitForSelector('#stage .sum'); await shot(d, 'desktop-10-bulk-summary');
  const n = await d.$$eval('#stage .sum .cell', e => e.length); assert.equal(n, 50, 'a box opens 50 cards'); const owned = await d.evaluate(() => BZ.state.cards.length); assert.equal(owned, 55); log('desktop: box of ten opened, skip bulk, 50 cards all saved');
  await d.click('#stage .sum [data-a="close"]'); await sleep(200);
  await d.click('[data-buy="golden-star"][data-kind="pack"]'); await d.waitForSelector('[data-open="golden-star"]'); await d.click('[data-open="golden-star"]'); await d.waitForSelector('#stage .sealed'); await d.click('#stage .sealed', { force: true }); await d.waitForSelector('#stage .oc.flipped', { timeout: 8000 });
  await advance(d); await shot(d, 'desktop-11-golden-star');
  const autos = await d.evaluate(() => BZ.state.cards.filter(c => c.set === 'golden-star' && BZ.cat.editions[c.ed].auto).length); assert(autos >= 1, 'Golden Star guaranteed an autograph'); log('desktop: Golden Star pack guaranteed an autograph');
  await d.click('#stage .sum [data-a="close"]'); await sleep(200); await d.click('.shead [data-a="close"]', { force: true }); await sleep(200);
  /* buyer */
  await walk(d, L.spots.buyer.x + Math.sin(L.spots.buyer.face) * 2.5, L.spots.buyer.z + Math.cos(L.spots.buyer.face) * 2.5); await d.waitForFunction(() => BZWORLD.prompt && BZWORLD.prompt.id === 'buyer'); await d.keyboard.press('e'); await d.waitForSelector('[data-selall="dupes"]'); await d.click('[data-selall="dupes"]'); await sleep(300); await shot(d, 'desktop-12-buyer');
  const selN = await d.evaluate(() => document.querySelectorAll('.bc.sel').length); assert(selN >= 1, 'duplicates selected'); const cashBefore = await d.evaluate(() => BZ.me.coins);
  await d.click('#mc-go'); await d.waitForSelector('#sell-go'); await shot(d, 'desktop-13-sell-confirm'); await d.click('#sell-go'); await d.waitForFunction(b => BZ.me.coins > b, cashBefore); log('desktop: sold ' + selN + ' duplicates at the Card Buyer');
  await d.click('.shead [data-a="close"]', { force: true }); await sleep(200);
  /* book, menu, profile, top 5, board, ones, inspect */
  await d.evaluate(() => CARDS.open('book')); await d.waitForSelector('.book'); await sleep(300); await shot(d, 'desktop-14-book');
  const bookBest = await d.evaluate(() => Object.keys(BZ.state.book).length); assert(bookBest >= 20, 'book remembers packed players'); log('desktop: collector book shows ' + bookBest + ' packed players');
  await d.click('.shead [data-a="close"]', { force: true }); await d.click('#btn-menu'); await d.waitForSelector('.menu-grid'); await sleep(350); await shot(d, 'desktop-15-menu'); await d.click('[data-m="top"]'); await d.waitForSelector('[data-pick]'); await d.click('[data-pick]'); await d.waitForSelector('#mc-go'); for (let i = 1; i <= 5; i++) { await d.click('.cardgrid .cell:nth-child(' + i + ') .bc'); await sleep(120); } await d.click('#mc-go'); await d.waitForFunction(() => BZ.state.top.length === 5); log('desktop: Top 5 saved');
  await d.evaluate(() => CARDS.profile(BZ.code, 'me')); await d.waitForSelector('.prof canvas'); await sleep(600); await shot(d, 'desktop-16-profile'); assert.equal(await d.$$eval('.toprow', rows => rows[0].querySelectorAll('.bc').length), 5); log('desktop: profile shows the Top 5 and a 3D avatar');
  await d.click('.toprow .bc'); await d.waitForSelector('#inspect .bc.huge'); await d.mouse.move(700, 300); await d.mouse.move(760, 340); await sleep(300); await shot(d, 'desktop-17-inspect'); log('desktop: full-screen inspection with tilt'); await d.click('#inspect .x'); await d.click('.shead [data-a="close"]', { force: true });
  await d.evaluate(() => CARDS.open('board')); await d.waitForSelector('.boardlist .friend'); await shot(d, 'desktop-18-board'); await d.click('.shead [data-a="close"]', { force: true });
  await d.evaluate(() => CARDS.open('ones')); await d.waitForSelector('.one1'); await shot(d, 'desktop-19-ones'); await d.click('.shead [data-a="close"]', { force: true });
  await d.evaluate(() => CARDS.open('dealer')); await d.waitForSelector('.order'); await shot(d, 'desktop-20-dealer'); assert.equal(await d.$$eval('.order', e => e.length), 4); log('desktop: the Dealer lists four standing orders'); await d.click('.shead [data-a="close"]', { force: true });
  await d.evaluate(() => CARDS.open('style')); await d.waitForSelector('.wardrobe canvas'); await sleep(500); await shot(d, 'desktop-21-style'); await d.click('.shead [data-a="close"]', { force: true });
  await d.evaluate(() => CARDS.open('ms')); await d.waitForSelector('.ms'); const ready = await d.$$eval('.ms.ready', e => e.length); assert(ready >= 1, 'a milestone is claimable with test cash'); await d.click('.ms.ready [data-claim]'); await d.waitForFunction(() => Object.keys(BZ.state.ms).length >= 1); log('desktop: milestone claimed'); await shot(d, 'desktop-22-milestones'); await d.click('.shead [data-a="close"]', { force: true });
  const beforeReload = await d.evaluate(() => ({ cards: BZ.state.cards.length, top: BZ.state.top.length, book: Object.keys(BZ.state.book).length }));
  await d.reload({ waitUntil: 'domcontentloaded' }); await d.waitForSelector('#load', { state: 'detached', timeout: 30000 }); await d.waitForFunction(() => BZ.state && BZ.state.cards.length > 0); const after = await d.evaluate(() => ({ cards: BZ.state.cards.length, top: BZ.state.top.length, book: Object.keys(BZ.state.book).length })); assert.deepEqual(after, beforeReload); log('desktop: refresh keeps cards (' + after.cards + '), Top 5 and the book');
  await d.context().close();
  /* ---------- iPhone size ---------- */
  const m = await page({ width: 390, height: 844 }, true);
  await m.waitForSelector('#load', { state: 'detached', timeout: 30000 }); await m.waitForSelector('.sheet.in'); await shot(m, 'mobile-01-welcome');
  const sheetW = await m.$eval('.sheet', e => e.getBoundingClientRect().width); assert(sheetW <= 390.5, 'sheet fits the phone');
  await m.tap('.sheet [data-wel]'); await m.waitForSelector('#stage .sealed'); await m.tap('#stage .sealed', { force: true }); await m.waitForSelector('#stage .oc.flipped', { timeout: 8000 }); await sleep(600); await shot(m, 'mobile-02-card');
  await advance(m, true); await shot(m, 'mobile-03-summary'); await m.tap('#stage .sum [data-a="close"]'); await sleep(300);
  await shot(m, 'mobile-04-world'); const hiddenAction = await m.evaluate(() => document.querySelector('#btn-act').hidden && getComputedStyle(document.querySelector('#btn-act')).display === 'none'); assert(hiddenAction, 'non-interacting mobile player must not see a blank action button'); await noOverlap(m, ['#hud-tl', '#hud-tr', '#hud-bottom', '#stick', '#btn-jump']); log('mobile: HUD, stick and jump button do not overlap');
  const stickShown = await m.$eval('#stick', e => getComputedStyle(e).display !== 'none'); assert(stickShown, 'touch stick visible on a phone'); log('mobile: touch controls shown');
  const scrollW = await m.evaluate(() => document.documentElement.scrollWidth); assert(scrollW <= 390, 'no horizontal overflow'); log('mobile: no horizontal overflow');
  await m.tap('#btn-menu'); await m.waitForSelector('.menu-grid'); await sleep(350); await shot(m, 'mobile-05-menu'); await m.tap('[data-m="cards"]'); await m.waitForSelector('.cardgrid'); await shot(m, 'mobile-06-cards'); await m.tap('.cardgrid .bc'); await m.waitForSelector('#inspect .bc.huge'); await shot(m, 'mobile-07-inspect'); await m.tap('#inspect .x'); await m.tap('.shead [data-a="close"]', { force: true });
  await m.evaluate(() => CARDS.open('book')); await m.waitForSelector('.book'); await shot(m, 'mobile-08-book'); await m.tap('.shead [data-a="close"]', { force: true }); await m.evaluate(() => BZ.close(true)); await sleep(200);
  await walk(m, L.spots.seller.x + Math.sin(L.spots.seller.face) * 2.5, L.spots.seller.z + Math.cos(L.spots.seller.face) * 2.5); await m.waitForSelector('#btn-act:not([hidden])'); await m.tap('#btn-act'); await m.waitForSelector('.setcard'); await sleep(350); await shot(m, 'mobile-09-seller'); log('mobile: contextual interaction button opens the Pack Seller');
  await m.context().close();
  const bad = errors.filter(e => !/favicon|fonts.googleapis|ERR_INTERNET|net::ERR/.test(e)); assert.deepEqual(bad, [], 'console errors: ' + bad.join(' | ')); log('no console or page errors on desktop or mobile');
  console.log('BITZ browser validation complete. Screens in', OUT);
} catch (e) { console.error('server log tail:', slog.slice(-800)); throw e; }
finally { await browser.close(); const gone = new Promise(r => { if (server.exitCode !== null) return r(); server.once('exit', r); setTimeout(r, 4000); }); server.kill('SIGTERM'); await gone; fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }); }
