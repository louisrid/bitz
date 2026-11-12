/**
 * Read-only BITZ public launch smoke test.
 * BITZ_PUBLIC_URL=https://stakkz.onrender.com/ node tools/launch-smoke.mjs
 * BITZ_EXPECT_SHA=$GITHUB_SHA node tools/launch-smoke.mjs
 */
const BASE = (process.env.BITZ_PUBLIC_URL || 'https://stakkz.onrender.com/').replace(/\/+$/, '');
const SHA = String(process.env.BITZ_EXPECT_SHA || '').trim().slice(0, 12);
const MAX_MS = Math.max(15000, Math.min(720000, Number(process.env.BITZ_SMOKE_TIMEOUT_MS) || (SHA ? 540000 : 120000)));
const start = Date.now();
const sleep = n => new Promise(resolve => setTimeout(resolve,n));
const assert = (ok, why) => { if (!ok) throw new Error(why); };
async function get(path, type='text') {
  const uri = BASE + path + (path.includes('?') ? '&' : '?') + '_check=' + Date.now();
  const res = await fetch(uri, {
    method: type === 'head' ? 'HEAD' : 'GET',
    headers: { 'Accept': type === 'json' ? 'application/json' : '*/*', 'Cache-Control':'no-cache' },
    redirect:'follow', signal:AbortSignal.timeout(25000)
  });
  if (!res.ok) throw new Error(path + ' HTTP ' + res.status + ' (' + res.url + ')');
  return { res, body: type === 'json' ? await res.json() : type === 'head' ? null : await res.text() };
}
async function check() {
  const {body:ping} = await get('/api/ping', 'json');
  assert(ping?.ok === true, 'Server health is not OK');
  assert(ping?.persistent === true, 'Production has NO connected persistent account database. Do not launch with ephemeral guest data.');
  assert(typeof ping.build === 'string' && ping.build.length >= 7, 'Server did not report a deployment build ID');
  assert(ping.build !== 'moved', 'This address is a redirect, not the canonical BITZ game');
  if (SHA) assert(ping.build.startsWith(SHA.slice(0,7)), 'Live build ' + ping.build + ' is not the new main commit ' + SHA + ' yet');
  const {res:home,body:html} = await get('/');
  assert(/text\/html/i.test(home.headers.get('content-type')||''),'Homepage must be HTML');
  assert(/<title>BITZ/i.test(html), 'BITZ homepage is missing its title');
  assert(/<canvas id="gl"/.test(html) && /id="hud"/.test(html),'Gameplay canvas/HUD missing');
  assert(/src="world\.js\?v=\d+"/.test(html),'Versioned world script missing');
  assert(/src="cards-art\.js\?v=\d+"/.test(html),'Card renderer missing');
  assert(/src="portraits\/manifest\.js\?v=\d+"/.test(html),'Football photo manifest missing');
  const assets=['bitz.css','world.js','cards-art.js','cards-ui.js','app.js','portraits/manifest.js'];
  for (const file of assets) {
    const ref = html.match(new RegExp('(?:href|src)="' + file.replace(/\./g,'\\.') + '(?:\\?[^"]*)?"'));
    const url = ref ? ref[0].split('"')[1] : file;
    const {res,body}=await get('/'+url);
    assert(body.length > 1000,'Unexpectedly small '+file+' ('+body.length+' characters)');
    assert(/(?:text|javascript|css)/i.test(res.headers.get('content-type')||''),'Wrong content type: '+file);
  }
  const {body:credits} = await get('/portraits/credits.html');
  assert(/football photograph credits/i.test(credits),'Football photo attribution page missing');
  for(const file of ['portraits/kylian-mbappe.jpg','portraits/placeholder.png']) {
    const {res} = await get('/'+file,'head');
    assert(/image\/(?:png|jpeg|webp)/.test(res.headers.get('content-type')||''),file+' not served as an image');
  }
  console.log(JSON.stringify({status:'PASS',site:BASE,build:ping.build,season:ping.season,persistent:ping.persistent,online:ping.online,assetsChecked:assets.length,checkedAt:new Date().toISOString()},null,2));
}
let failures=0,last;
while (Date.now()-start < MAX_MS) {
  try { await check(); process.exit(0); }
  catch(error){ failures++;last=error;console.log('Attempt '+failures+': '+error.message);const remaining=MAX_MS-(Date.now()-start);if(remaining<=0)break;await sleep(Math.min(18000,remaining));}
}
console.error('BITZ LIVE RELEASE CHECK FAILED after '+failures+' attempts: '+(last?.message || 'unknown problem'));
console.error('GitHub main may be ready, but the one public URL has not passed the checks. Verify Render deployment and database.');
process.exitCode=1;
