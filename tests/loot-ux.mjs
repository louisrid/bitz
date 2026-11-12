import assert from 'node:assert/strict';
import '../public/loot-rules.js';
import * as core from '../src/core.js';
const rules=globalThis.BITZ_LOOT_RULES;
assert.deepEqual(rules.base,{epic:5,legendary:15,mythical:45,secret:35});
const pool=rules.eligible(core.ITEMS,[]);
assert(pool.length>10,'must have collectible outfits');
assert.deepEqual(rules.odds(pool,core.ITEMS),rules.base,'display odds equal server odds before ownership');
const rng=(v)=>()=>v;
for(const t of rules.order){
  const p=pool.filter(x=>rules.tier(x,core.ITEMS)===t);
  if(!p.length)continue;
  const d=rules.distribution(p,core.ITEMS);
  assert.equal(d[t],1,'exclusive tier normalises to 100% when others collected');
}
const w=core.freshWallet(); w.coins=20000000;
let seen=new Set(); for(let i=0;i<6;i++){core.shop(w,'box');const p=core.shop(w,'open').prize;assert(p.item&&!seen.has(p.item),'no duplicate drops');seen.add(p.item);}
assert.equal(w.own.length,6);
assert.equal(w.boxes,1);
console.log('Server-chosen loot, honest odds, dynamic tier normalisation and duplicate protection pass');
