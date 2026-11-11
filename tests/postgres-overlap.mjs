// Render zero-downtime deploy: the new instance boots, then the OLD instance saves once more.
// The new, live instance must keep saving (merging the old one's new records), and nothing may be lost on restart.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import { setTimeout as sleep } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const url = process.env.STAKKZ_DATABASE_URL;
assert(url?.startsWith('postgres'), 'A dedicated test PostgreSQL URL is required');
const running = [];
const start = port => {
  const c = spawn(process.execPath, ['server.js'], { cwd: root, env: { ...process.env, PORT: String(port), STAKKZ_SECRET: 'overlap-test-secret', STAKKZ_STORE_URL: '', STAKKZ_STORE_KEY: '' } });
  c.logs = ''; c.stdout.on('data', d => c.logs += d); c.stderr.on('data', d => c.logs += d); running.push(c); return c;
};
const req = async (port, path, token, body) => {
  const r = await fetch(`http://127.0.0.1:${port}/api/${path}`, { method: body === undefined ? 'GET' : 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: r.status, ...(await r.json()) };
};
const up = async port => { for (let i = 0; i < 100; i++) { try { if ((await req(port, 'ping', '')).persistent) return; } catch {} await sleep(150); } throw Error('server on ' + port + ' did not boot'); };
const pass = 'Overlap-test-pass-1';
const reg = (port, name) => req(port, 'auth/register', crypto.randomBytes(24).toString('hex'), { username: name, password: pass });
const login = (port, name) => req(port, 'auth/login', '', { username: name, password: pass });
const tag = crypto.randomBytes(3).toString('hex');
try {
  const A = start(4811); await up(4811);
  assert.equal((await reg(4811, 'olda' + tag)).status, 200);
  const B = start(4812); await up(4812);
  assert.equal((await reg(4811, 'oldb' + tag)).status, 200, 'old instance saves once more after the new one booted');
  A.kill('SIGTERM'); await sleep(2000);
  const g = await reg(4812, 'newc' + tag);
  assert.equal(g.status, 200, 'the new live instance must still be able to save: ' + g.message);
  await sleep(4500);
  B.kill('SIGTERM'); await sleep(2500);
  start(4813); await up(4813);
  for (const n of ['olda', 'oldb', 'newc']) assert.equal((await login(4813, n + tag)).status, 200, n + ' lost after restart');
  console.log('Deploy overlap: the new instance merged the old one\'s last save, kept saving, and every account survived a restart.');
} finally { running.forEach(c => { try { c.kill('SIGKILL'); } catch {} }); }
