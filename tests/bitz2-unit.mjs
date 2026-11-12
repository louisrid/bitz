import assert from 'node:assert/strict';
import * as core from '../src/core.js';
import {awardXP,xpThreshold,LEVEL_GOLD,MILESTONES} from '../src/progression.js';
const rules=globalThis.BITZ_LOOT_RULES;
const {ITEMS}=core;
function test(name,fn){try{fn();console.log('PASS',name);}catch(e){console.error('FAIL',name);throw e;}}
test('legacy wallets keep owned possessions and gold',()=>{
 const w=core.freshWallet();w.coins=9345321;w.own=['g_pulse','x_sun','cat'];
 core.setProfile(w,{name:'Friend',look:{skin:1,hair:'short',hc:1,outfit:'tee'},pet:'cat'});
 assert.equal(w.pet,'cat');assert.equal(w.coins,9345321);
 assert.deepEqual(w.own,['g_pulse','x_sun','cat']);
 assert.equal(w.level,1);
});
test('gold accrues server-side at configured rate without extreme offline catch-up',()=>{
 const w=core.freshWallet();w.gt=1_000_000;const before=w.coins;
 assert.equal(core.earn(w,1_010_000),0,'no passive income');
 assert.equal(w.coins,before,'balance untouched by time');
 const d=core.claimDaily(w,1_010_000);assert.ok(d.daily.gold>=core.DAILY_BASE);assert.throws(()=>core.claimDaily(w,1_020_000));
 assert.equal(core.earn(w,1_110_000),0);
});
test('shop purchases, unlocks, and rejects archived guns',()=>{
 const w=core.freshWallet();const prior=w.coins;const got=core.shop(w,'buy','cat');
 assert.equal(w.coins,prior-ITEMS.cat[2]);assert.ok(w.own.includes('cat'));
 assert.equal(got.progress.xp,35);
 core.shop(w,'buy','cat');assert.equal(w.own.filter(id=>id==='cat').length,1);
 assert.throws(()=>core.shop(w,'buy','g_pulse'),core.Refused);
 assert.throws(()=>core.shop(w,'reset'),core.Refused);
});
test('cumulative XP awards gold and collectible milestones without duplicates',()=>{
 const w=core.freshWallet();const before=w.coins;
 const outcome=awardXP(w,xpThreshold(5),ITEMS);
 assert.equal(w.level,5);assert.ok(outcome.rewards.some(r=>r.level===5));
 assert.ok(w.own.includes(MILESTONES[5]));
 assert.ok(w.coins>=before+LEVEL_GOLD*3);
 awardXP(w,100,ITEMS);assert.equal(w.own.filter(id=>id===MILESTONES[5]).length,1);
 assert.equal(core.progressOf(w).level,w.level);
});
test('shared rarity percentages are normalised and weighted',()=>{
 const ids=rules.eligible(ITEMS,[]);assert.ok(ids.length>=15);
 const odds=rules.odds(ids,ITEMS);assert.ok(Math.abs(Object.values(odds).reduce((a,b)=>a+b,0)-100)<.001);
 let seed=137;const random=()=>((seed=Math.imul(seed,1664525)+1013904223|0)>>>0)/4294967296;
 const hist={epic:0,legendary:0,mythical:0,secret:0},draws=30000;
 for(let i=0;i<draws;i++)hist[rules.tier(rules.pick(ids,ITEMS,random),ITEMS)]++;
 for(const name of rules.order)assert.ok(Math.abs(hist[name]*100/draws-odds[name])<2,'Mismatch for '+name);
});
test('independent themed boxes and server-selected unique rewards',()=>{
 for(const theme of Object.keys(rules.themes)){
  const pool=rules.eligible(ITEMS,[],theme),cfg=rules.themeOf(theme);
  assert.ok(pool.length>0,theme+' has no rewards');
  assert.ok(cfg.price>0);assert.ok(Math.abs(Object.values(rules.odds(pool,ITEMS,theme)).reduce((a,b)=>a+b,0)-100)<.001);
  const w=core.freshWallet();w.coins=500000000;const won=new Set();
  for(let i=0;i<pool.length;i++){
   core.shop(w,'box',theme);const result=core.shop(w,'open',theme);
   assert.ok(pool.includes(result.prize.item));assert.ok(!won.has(result.prize.item));
   won.add(result.prize.item);
  }
  assert.equal(won.size,pool.length);assert.throws(()=>core.shop(w,'box',theme),core.Refused);
 }
});
console.log('BITZ 2.0 unit validation complete');
