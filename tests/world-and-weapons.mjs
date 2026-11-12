import assert from 'node:assert/strict';
import '../public/world-layout.js';
import '../public/weapon-defs.js';
import '../public/loot-rules.js';
import * as core from '../src/core.js';
const m=globalThis.STAKKZ_WORLD_LAYOUT;
assert(m.field>150*Math.sqrt(4.5),'new map should cover about five times the old area');
assert(m.caves.length>=3);
assert(m.destinations.some(d=>d.id==='waterfall'));
assert(m.destinations.every(d=>Math.abs(d.x)<=m.limit&&Math.abs(d.z)<=m.limit),'destinations within server limits');
assert(globalThis.BITZ_WEAPONS.length===24);
for(const w of globalThis.BITZ_WEAPONS){assert(core.ITEMS[w.id],w.id+' in server shop');assert(w.dmg>0&&w.cd>0&&w.range>0);}
assert(globalThis.BITZ_WEAPONS.some(w=>w.execute));
assert(globalThis.BITZ_WEAPONS.some(w=>w.knockback));
assert(globalThis.BITZ_WEAPONS.some(w=>w.healOnKill));
console.log('World layout, 5x area, three caves, waterfall and 24 weapons pass');
