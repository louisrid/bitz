/* When BITZ moves to a new address, the old service runs only this: it never touches the database.
   Each visitor's page hands its sign-in to the new address (through a one-time code) and goes there,
   so guests keep their gold and items and signed-in players stay signed in.  Set STAKKZ_MOVED_TO to the new address. */
import http from 'node:http';
const TO = String(process.env.STAKKZ_MOVED_TO || '').replace(/\/$/, '');
const PORT = Number(process.env.PORT) || 3000;
const page = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>BITZ</title>
<style>html,body{margin:0;height:100%;background:#0d3320;color:#fff;font:700 18px/1.4 system-ui,sans-serif;display:grid;place-items:center;text-align:center}b{display:block;font:900 64px/1 system-ui,sans-serif;letter-spacing:.02em;text-shadow:4px 5px 0 #000}</style></head>
<body><div><b>BITZ</b>Taking you to the new address&hellip;</div><script>(function(){var TO=${JSON.stringify(TO)},done=false;
function go(c){if(done)return;done=true;location.replace(TO+'/'+(c?'#h='+c:''));}
var k=null,s=null;try{k=JSON.parse(localStorage.getItem('stakkz-key'));s=JSON.parse(localStorage.getItem('stakkz-session'));}catch(e){}
if(!k&&!s)return go('');setTimeout(function(){go('');},6000);
fetch(TO+'/api/handoff',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({key:k,session:s})}).then(function(r){return r.json();}).then(function(j){go(j&&j.code);}).catch(function(){go('');});})();</script></body></html>`;
http.createServer((req, res) => {
  const u = req.url || '/';
  if (/^\/api\/ping/.test(u)) { res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); return res.end(JSON.stringify({ ok: true, build: 'moved', movedTo: TO })); }
  if (/^\/api\//.test(u)) { res.writeHead(410, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); return res.end(JSON.stringify({ message: 'BITZ has moved to ' + TO + '. Refresh the page.' })); }
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(page);
}).on('upgrade', (req, socket) => socket.destroy()).listen(PORT, () => console.log('BITZ moved: forwarding everyone to ' + TO));
