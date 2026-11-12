import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {FOOTBALL_SEED,PACKS,VARIANTS,PLAYER_BY_ID} from '../src/football-catalogue.js';
import {createFootballService,CardError} from '../src/football.js';
import * as core from '../src/core.js';
const check=(name,fn)=>{fn();console.log('PASS',name);};
const first='p_'+'a'.repeat(24),second='p_'+'b'.repeat(24);
const a=core.freshWallet(),b=core.freshWallet();a.name='FootballA';b.name='FootballB';a.coins=b.coins=100000000;
const accounts=new Map([[first,a],[second,b]]),serials=new Map(),offers=new Map();
let changes=0;
const game=createFootballService({accounts,serials,offers,markDirty:()=>changes++,resolvePlayer:f=>[...accounts.keys()].find(id=>id===f||id.slice(2,12)===f)});
check('exactly 20 Premier League clubs, each 11 players, and curated Europe',()=>{
 assert.equal(FOOTBALL_SEED.clubs.length,20);
 for(const club of FOOTBALL_SEED.clubs)assert.equal(FOOTBALL_SEED.players.filter(p=>p.club===club.id).length,11);
 assert.equal(FOOTBALL_SEED.players.filter(p=>p.league==='Premier League').length,220);
 assert(FOOTBALL_SEED.europe.length>=5);
});
check('five collections plus God and premium guaranteed autograph packs',()=>{
 for(const id of ['first-xi','electric-nights','blackout','crown-glory','derby-day','god','signature','triple-auto','elite-vault']){
  const p=PACKS[id];assert(p&&p.cards===5);
  assert.equal(Object.values(p.odds).reduce((v,n)=>v+n,0),10000);
 }
 assert.equal(VARIANTS.base.valueCents,50);
 assert.equal(VARIANTS.legendary.bonusGold,20000);
 assert.equal(VARIANTS.masterpiece.bonusGold,50000);
});
check('welcome packs, server-priced buy and five server-minted cards',()=>{
 const s=game.self(a,first);assert.equal(s.packs['first-xi'],2);
 const old=a.coins;
 game.move('buy',a,first,{pack:'first-xi'});
 assert.equal(a.coins,old-PACKS['first-xi'].cost);
 const r=game.move('open',a,first,{pack:'first-xi'});
 assert.equal(r.cards.length,5);assert.equal(new Set(r.cards.map(x=>x.uid)).size,5);
 r.cards.forEach(c=>{assert(PLAYER_BY_ID.get(c.player));assert(c.valueCents>0);assert(c.season);});
 assert.equal(game.self(a,first).packs['first-xi'],2);
 assert.throws(()=>game.move('buy',a,first,{pack:'god'}),CardError);
});
check('signature packs meet guaranteed auto requirements',()=>{
 const variants=new Set(['signature','goldInk','blackInk','dual','masterpiece']);
 for(const [id,minimum] of [['signature',1],['triple-auto',3]]){
  game.move('buy',a,first,{pack:id});
  const r=game.move('open',a,first,{pack:id});
  assert.equal(r.cards.length,5);
  assert(r.cards.filter(x=>variants.has(x.variant)).length>=minimum);
 }
 game.move('buy',a,first,{pack:'elite-vault'});
 const r=game.move('open',a,first,{pack:'elite-vault'});
 assert(r.cards.some(c=>['legendary','signature','goldInk','blackInk','dual','numbered25','numbered5','masterpiece'].includes(c.variant)));
});
check('most standard pulls are commons and duplicates are possible',()=>{
 const f=game.ensure(a);f.packs['first-xi']=35;
 const pulled=[];
 for(let j=0;j<35;j++)pulled.push(...game.move('open',a,first,{pack:'first-xi'}).cards);
 const common=pulled.filter(x=>['base','bronze','silver'].includes(x.variant)).length;
 assert(common>=140,'Too few ordinary pulls');
 assert(pulled.length===175);
 assert(new Set(pulled.map(x=>x.uid)).size===175);
 const appearances=pulled.map(x=>x.player);
 assert(new Set(appearances).size<appearances.length,'Duplicates unexpectedly impossible');
});
check('five-card favourites, quick-sale valuation and protection',()=>{
 const cards=game.self(a,first).cards;
 const fav=cards.slice(0,5).map(c=>c.uid);
 game.move('favorites',a,first,{cards:fav});
 assert.deepEqual(game.self(a,first).favorites,fav);
 assert.throws(()=>game.move('favorites',a,first,{cards:[...fav,fav[0]]}),CardError);
 const before=a.coins;
 const sale=game.move('sell',a,first,{uid:fav[0]});
 assert.equal(a.coins,before+sale.gold);
 assert(!game.self(a,first).favorites.includes(fav[0]));
 assert.throws(()=>game.move('sell',a,first,{uid:fav[0]}),CardError);
});
check('eleven unique club player slots require an explicit one-time claim',()=>{
 const club='arsenal',f=game.ensure(b),players=FOOTBALL_SEED.players.filter(x=>x.club===club);
 assert.equal(players.length,11);
 for(const p of players)f.cards.push({uid:crypto.randomUUID(),player:p.id,players:[p.id],pack:'first-xi',season:'2026-27',variant:'base',valueCents:50});
 const before=game.self(b,second).packs['elite-vault']||0;
 const completion=game.album(b).find(x=>x.id===club);
 assert.equal(completion.owned,11);
 game.move('claim',b,second,{club});
 assert.equal(game.self(b,second).packs['elite-vault'],before+1);
 assert.throws(()=>game.move('claim',b,second,{club}),CardError);
 assert.equal(f.cards.filter(x=>players.some(p=>p.id===x.player)).length,11);
});
check('atomic trades, reserved cards, both quests and God rewards',()=>{
 const fA=game.ensure(a),fB=game.ensure(b);
 const player=FOOTBALL_SEED.players.find(p=>p.club==='man-united');
 const manU={uid:crypto.randomUUID(),player:player.id,players:[player.id],variant:'gold',pack:'first-xi',valueCents:350};
 const rare={uid:crypto.randomUUID(),player:player.id,players:[player.id],variant:'legendary',pack:'first-xi',valueCents:2200};
 const starter={uid:crypto.randomUUID(),player:FOOTBALL_SEED.players[0].id,players:[FOOTBALL_SEED.players[0].id],variant:'base',pack:'first-xi',valueCents:50};
 fA.cards.push(starter);fB.cards.push(manU,rare);
 fA.objective={id:crypto.randomUUID(),kind:'receive-club',club:'man-united'};
 fB.objective={id:crypto.randomUUID(),kind:'trade-legendary'};
 assert.throws(()=>game.move('offer',a,first,{to:second.slice(2,12),give:[rare.uid],take:[]}),CardError);
 const offer=game.move('offer',a,first,{to:second.slice(2,12),give:[starter.uid],take:[manU.uid,rare.uid]});
 assert.throws(()=>game.move('sell',b,second,{uid:manU.uid}),CardError);
 assert.throws(()=>game.move('accept',a,first,{trade:offer.offer}),CardError);
 const result=game.move('accept',b,second,{trade:offer.offer});
 assert.deepEqual(result.rewarded,[true,true]);
 assert.equal(game.self(a,first).packs.god,1);assert.equal(game.self(b,second).packs.god,1);
 assert(game.self(a,first).cards.some(x=>x.uid===rare.uid));
 assert(game.self(b,second).cards.some(x=>x.uid===starter.uid));
 assert.throws(()=>game.move('accept',b,second,{trade:offer.offer}),CardError);
 assert.notEqual(game.self(a,first).objective.id,fA.objectiveHistory[0].id);
 assert.equal([...accounts.values()].flatMap(x=>game.self(x,x===a?first:second).cards).filter(x=>x.uid===rare.uid).length,1);
});
check('serial issuance map remains safe and saved state is JSON serialisable',()=>{
 for(const value of serials.values())assert(value>=1);
 const raw=JSON.stringify({a,b,offers:[...offers.values()],serials:[...serials]});
 assert(raw.includes('accepted')&&raw.includes('football'));
 assert(changes>0);
});
console.log('BITZ Football unit validation complete');
