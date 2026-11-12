import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { PLAYERS, validate } from '../src/catalogue.js';

const ROOT = path.resolve(import.meta.dirname, '..');
const dir = path.join(ROOT, 'public', 'portraits');
const manifest = fs.readFileSync(path.join(dir,'manifest.js'),'utf8');
const credits = JSON.parse(fs.readFileSync(path.join(dir,'credits.json'),'utf8'));
const ids = new Set(PLAYERS.map(p=>p.id));
assert.equal(PLAYERS.length,265,'265 unique footballers');
assert.deepEqual(validate(),[],'valid unique player identities');
assert.equal(ids.size,265,'unique stable IDs');
assert.match(manifest,/BITZ_PORTRAITS/,'portrait map is loaded');
assert.match(fs.readFileSync(path.join(ROOT,'public','index.html'),'utf8'),/src="portraits\/manifest\.js/);
assert.match(fs.readFileSync(path.join(ROOT,'public','cards-art.js'),'utf8'),/BITZ_PORTRAITS/);
assert.ok(fs.existsSync(path.join(dir,'placeholder.png')),'fallback exists');
for (const [id, x] of Object.entries(credits)) {
  assert.ok(ids.has(id),'image belongs to actual roster entry: '+id);
  assert.match(x.file,/^[a-z0-9-]+\.(?:jpg|png|webp)$/);
  assert.ok(fs.existsSync(path.join(dir,x.file)),'missing local photograph for '+id);
  assert.ok((x.source||'').startsWith('https://commons.wikimedia.org/wiki/File:'),'uncredited source '+id);
  assert.ok(x.licence && x.artist,'missing photographer/licence for '+id);
  assert.ok(manifest.includes(x.file),'photo not available to renderer '+id);
}
console.log('Portrait asset validation OK:', Object.keys(credits).length,'of',PLAYERS.length,'players have licensed, locally cached images.');
