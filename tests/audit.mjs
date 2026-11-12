/* Screenshot audit: every screen on desktop and phone, two accounts, a trade and a friend request between them.
   Not a pass/fail test; it writes qa-screens/audit-*.png for a visual review. */
import { spawn } from 'node:child_process'; import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'; import { chromium } from 'playwright'; import '../public/world-layout.js';
const L = globalThis.STAKKZ_WORLD_LAYOUT, PORT = 5100 + Math.floor(Math.random() * 200), BASE = 'http://127.0.0.1:' + PORT, dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bitz-au-')), OUT = path.resolve('qa-screens'); fs.mkdirSync(OUT, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const server = spawn(process.execPath, ['server.js'], { env: { ...process.env, PORT, DATA_FILE: path.join(dir, 'd.json'), NODE_ENV: 'test', BITZ_FAST_TIMERS: '1', BITZ_FILE_ACCOUNTS: '1', BITZ_TEST_CASH: '3000000', STAKKZ_SECRET: 'audit' }, stdio: 'ignore' });
for (let i = 0; i < 300; i++) { try { if ((await fetch(BASE + '/api/ping')).ok) break; } catch (e) {} await sleep(100); }
const browser = await chromium.launch(process.env.PW_CHANNEL ? { channel: process.env.PW_CHANNEL } : {});
const errors = [];
async function open(viewport, mobile) { const ctx = await browser.newContext({ viewport, deviceScaleFactor: mobile ? 2 : 1, isMobile: !!mobile, hasTouch: !!mobile }); const p = await ctx.newPage(); p.on('console', m => { if (m.type() === 'error') errors.push(m.text()); }); p.on('pageerror', e => errors.push(e.message)); await p.goto(BASE + '/'); await p.waitForSelector('#load', { state: 'detached', timeout: 60000 }); await p.waitForSelector('.sheet.in'); return p; }
const walk = async (p, x, z) => { for (let i = 0; i < 80; i++) { const done = await p.evaluate(([x, z]) => { const m = BZWORLD.me; const dx = x - m.x, dz = z - m.z, d = Math.hypot(dx, dz); if (d < 0.4) return true; const k = Math.min(1, 2.4 / d); BZWORLD.spawnAt(m.x + dx * k, m.z + dz * k); return false; }, [x, z]); if (done) break; await sleep(130); } await sleep(500); };
const shot = async (p, name, wait = 400) => { await sleep(wait); await p.screenshot({ path: path.join(OUT, 'audit-' + name + '.png') }); };
const register = async (p, user) => { await p.evaluate(async u => { const r = await BZ.api('auth/register', { username: u, password: 'audit-pass-123' }); localStorage.setItem('stakkz-session', JSON.stringify(r.token)); }, user); await p.reload({ waitUntil: 'domcontentloaded' }); await p.waitForSelector('#load', { state: 'detached', timeout: 60000 }); await p.waitForFunction(() => window.BZ && BZ.state); await sleep(300); };
const closeAll = async p => { await p.evaluate(() => BZ.close(true)); await sleep(150); };
async function setup(p, name) {
  await p.click('.sheet [data-wel]'); await p.waitForSelector('#stage .sealed'); await p.click('#stage .sealed', { force: true }); await p.waitForSelector('#stage .oc.flipped', { timeout: 8000 }); await p.click('#stage [data-skip]'); await p.waitForSelector('#stage .sum'); await p.click('#stage .sum [data-a="close"]'); await sleep(200);
  await p.evaluate(n => BZ.api('me', { name: n }).then(j => { BZ.me = j.wallet; BZ.setLook({ look: j.wallet.look, pet: j.wallet.pet, name: j.wallet.name }); }), name); await sleep(200);
  await walk(p, L.spots.seller.x + Math.sin(L.spots.seller.face) * 2.5, L.spots.seller.z + Math.cos(L.spots.seller.face) * 2.5); await p.waitForSelector('#btn-act:not([hidden])');
  const err = await p.evaluate(async () => { try { await BZ.act({ op: 'buy', set: 'red-hot', kind: 'box' }); await BZ.act({ op: 'buy', set: 'golden-star', kind: 'pack' }); await BZ.act({ op: 'buy', set: 'european-nights', kind: 'pack' }); await BZ.act({ op: 'open', pack: 'red-hot', count: 10 }); await BZ.act({ op: 'open', pack: 'golden-star', count: 1 }); await BZ.act({ op: 'open', pack: 'european-nights', count: 1 }); return null; } catch (e) { return e.message || JSON.stringify(e); } });
  if (err) throw new Error('setup for ' + name + ': ' + err);
  await sleep(300);
}
try {
  const A = await open({ width: 1440, height: 900 }); await setup(A, 'Louis');
  const B = await open({ width: 1440, height: 900 }); await setup(B, 'Maya');
  await register(A, 'louis_' + PORT); await register(B, 'maya_' + PORT);
  const codeA = await A.evaluate(() => BZ.code), codeB = await B.evaluate(() => BZ.code);
  await A.evaluate(c => BZ.api('friends', { op: 'request', code: c }), codeB); await B.evaluate(c => BZ.api('friends', { op: 'accept', code: c }), codeA);
  await A.evaluate(() => BZ.refresh()); await B.evaluate(() => BZ.refresh());
  /* an incoming trade offer for A */
  const give = await B.evaluate(() => BZ.state.cards[0].uid), take = await A.evaluate(() => BZ.state.cards[0].uid);
  await B.evaluate(([to, g, t]) => BZ.act({ op: 'offer', to, give: [g], take: [t] }), [codeA, give, take]); await A.evaluate(() => BZ.refresh());
  await A.evaluate(() => BZWORLD.spawnAt(2, 4)); await sleep(800); await shot(A, 'd01-world-two-players');
  await A.evaluate(() => BZ.menu()); await shot(A, 'd02-menu'); await closeAll(A);
  await A.evaluate(() => CARDS.open('trade')); await A.waitForSelector('.offer'); await shot(A, 'd03-trades-inbox'); await A.click('[data-view]'); await A.waitForSelector('.sheet.in'); await shot(A, 'd04-trade-review'); await A.click('.sheet [data-accept]'); await sleep(600); await shot(A, 'd05-trade-done'); await closeAll(A);
  await A.evaluate(() => CARDS.open('trade')); await A.waitForSelector('[data-partner]'); await A.click('[data-partner]'); await A.waitForSelector('.sides'); await A.click('[data-pick="give"]'); await A.click('[data-pick="take"]'); await shot(A, 'd06-trade-builder'); await closeAll(A);
  await A.evaluate(() => CARDS.open('friends')); await A.waitForSelector('.friend'); await shot(A, 'd07-friends'); await A.click('.friend'); await A.waitForSelector('.prof canvas'); await shot(A, 'd08-friend-profile', 800); await closeAll(A);
  await A.evaluate(() => CARDS.open('style')); await A.waitForSelector('.wardrobe'); await shot(A, 'd09-style-outfits', 800); await A.click('[data-tab="pet"]'); await shot(A, 'd10-style-pets', 600); await A.click('[data-tab="body"]'); await shot(A, 'd11-style-body', 600); await closeAll(A);
  await A.evaluate(() => CARDS.open('cards')); await A.waitForSelector('.cardgrid'); await A.click('[data-filt="auto"]'); await shot(A, 'd12-cards-autos'); const auto = await A.$('.cardgrid .bc'); if (auto) { await auto.click(); await A.waitForSelector('#inspect'); await A.mouse.move(600, 300); await shot(A, 'd13-inspect-auto', 900); await A.click('#inspect .x'); } await A.click('[data-filt="european-nights"]'); await shot(A, 'd14-cards-euro'); await closeAll(A);
  await A.evaluate(() => CARDS.open('dealer')); await A.waitForSelector('.order'); await A.click('[data-order]'); await A.waitForSelector('.sheet.in'); await shot(A, 'd15-dealer-preview'); await closeAll(A);
  await A.evaluate(() => CARDS.open('ms')); await A.waitForSelector('.ms'); await shot(A, 'd16-milestones'); await closeAll(A);
  await A.evaluate(() => CARDS.open('ones')); await A.waitForSelector('.one1'); await shot(A, 'd17-ones'); await closeAll(A);
  await A.evaluate(() => CARDS.open('board')); await A.waitForSelector('.boardlist .friend'); await shot(A, 'd18-board'); await closeAll(A);
  await A.evaluate(() => CARDS.open('packs')); await sleep(300); await shot(A, 'd19-packs-empty'); await closeAll(A);
  await A.evaluate(() => { const el = BZ.screen({ title: 'SETTINGS', body: '' }); BZ.close(); }); await A.keyboard.press('m'); await A.waitForSelector('.menu-grid'); await A.click('[data-m="settings"]'); await shot(A, 'd20-settings'); await closeAll(A);
  await A.keyboard.press('m'); await A.waitForSelector('.menu-grid'); await A.click('[data-m="account"]'); await shot(A, 'd21-account'); await closeAll(A);
  await walk(A, L.spots.seller.x + Math.sin(L.spots.seller.face) * 2.5, L.spots.seller.z + Math.cos(L.spots.seller.face) * 2.5); await A.waitForSelector('#btn-act:not([hidden])'); await A.evaluate(() => BZ.act({ op: 'buy', set: 'red-hot', kind: 'pack' })); await A.evaluate(() => CARDS.openFlow('red-hot', 1)); await A.waitForSelector('#stage .sealed'); await A.click('#stage .sealed', { force: true }); await A.waitForSelector('#stage .oc.flipped', { timeout: 8000 }); for (let i = 0; i < 4; i++) { await A.keyboard.press('ArrowRight'); await sleep(1200); } await shot(A, 'd22-last-card', 900); await A.click('#stage [data-skip]').catch(() => {}); await sleep(300); await A.click('#stage .sum [data-a="close"]').catch(() => {});
  await A.evaluate(() => BZ.act({ op: 'buy', set: 'golden-star', kind: 'box' })); await A.evaluate(() => CARDS.openFlow('golden-star', 10)); await A.waitForSelector('#stage .oc'); await shot(A, 'd23-bulk-golden', 1200); await A.click('#stage [data-skip]'); await A.waitForSelector('#stage .sum'); await shot(A, 'd24-bulk-golden-summary'); await A.click('#stage .sum [data-a="close"]');
  await walk(A, L.circles.gold.x, L.circles.gold.z); await sleep(2500); await shot(A, 'd25-gold-circle');
  await walk(A, L.spots.dealer.x + Math.sin(L.spots.dealer.face) * 2.5, L.spots.dealer.z + Math.cos(L.spots.dealer.face) * 2.5); await sleep(600); await shot(A, 'd26-at-dealer');
  /* phone */
  const M = await open({ width: 390, height: 844 }, true); await setup(M, 'Zed');
  await M.evaluate(() => BZWORLD.spawnAt(0, 4)); await shot(M, 'm01-world', 800);
  for (const [name, k] of [['m02-cards', 'cards'], ['m03-book', 'book'], ['m04-trades', 'trade'], ['m05-friends', 'friends'], ['m06-style', 'style'], ['m07-dealer', 'dealer'], ['m08-board', 'board'], ['m09-ones', 'ones'], ['m10-ms', 'ms'], ['m11-top', 'top']]) { await M.evaluate(k => CARDS.open(k), k); await shot(M, name, 900); await closeAll(M); }
  await M.evaluate(() => CARDS.open('cards')); await M.waitForSelector('.cardgrid .bc'); await M.tap('.cardgrid .bc'); await M.waitForSelector('#inspect'); await shot(M, 'm12-inspect', 800); await closeAll(M);
  await M.evaluate(() => CARDS.profile(BZ.code)); await M.waitForSelector('.prof canvas'); await shot(M, 'm13-profile', 900); await closeAll(M);
  await walk(M, L.spots.buyer.x + Math.sin(L.spots.buyer.face) * 2.5, L.spots.buyer.z + Math.cos(L.spots.buyer.face) * 2.5); await M.waitForSelector('#btn-act:not([hidden])'); await shot(M, 'm14-at-buyer'); await M.tap('#btn-act'); await M.waitForSelector('[data-selall]'); await M.tap('[data-selall="dupes"]'); await shot(M, 'm15-buyer', 600); await M.tap('#mc-go'); await M.waitForSelector('#sell-go'); await shot(M, 'm16-sell-confirm'); await closeAll(M);
  await walk(M, L.spots.seller.x + Math.sin(L.spots.seller.face) * 2.5, L.spots.seller.z + Math.cos(L.spots.seller.face) * 2.5); await M.waitForSelector('#btn-act:not([hidden])'); await M.evaluate(() => BZ.act({ op: 'buy', set: 'red-hot', kind: 'pack' })); await M.evaluate(() => CARDS.openFlow('red-hot', 1)); await M.waitForSelector('#stage .sealed'); await shot(M, 'm17-sealed', 500);
  console.log('errors:', JSON.stringify(errors.filter(e => !/favicon|fonts.googleapis|net::ERR/.test(e))));
  console.log('audit complete');
} finally { await browser.close(); const gone = new Promise(r => { if (server.exitCode !== null) return r(); server.once('exit', r); setTimeout(r, 4000); }); server.kill('SIGTERM'); await gone; fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }); }
