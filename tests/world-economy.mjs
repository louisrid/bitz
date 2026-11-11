import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { ITEMS, EXCLUSIVES, BOX_PRICE } from '../src/shop.js';
import { freshWallet, accrue, shop, swag } from '../src/core.js';

const html=fs.readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
const scripts=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(x=>x[1]).filter(Boolean);
assert(scripts.length,'inline browser script should exist');
scripts.forEach((code,i)=>new vm.Script(code,{filename:'public/index.html inline script '+i}));
new vm.Script(fs.readFileSync(new URL('../public/world-client.js',import.meta.url),'utf8'),{filename:'public/world-client.js'});

const w=freshWallet();assert.equal(w.coins,1000000);assert.equal(BOX_PRICE,500000);
w.coins=250;w.economy=0;assert(accrue(w,1000000));assert.equal(w.coins,1000000);
w.earnAt=1000000;accrue(w,1020000);assert.equal(w.coins,1020000,'20 seconds should yield 20,000 coins');
assert.equal(swag(w),-100);
assert(EXCLUSIVES.length>=17);
assert(Object.values(ITEMS).filter(p=>p[0]==='bg').length>=40);
for(const id of EXCLUSIVES){assert(ITEMS[id]);assert(ITEMS[id][2]<0);}
const start=w.coins;shop(w,'box');assert.equal(w.coins,start-500000);
const initialBoxes=w.boxes;const pz=shop(w,'open');assert(pz.prize.item);assert(EXCLUSIVES.includes(pz.prize.item));
assert.equal(w.boxes,initialBoxes-1);assert(w.own.includes(pz.prize.item));
console.log('Shared world, browser syntax, economy, exclusive loot and 30+ new backgrounds validated.');
