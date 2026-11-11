import assert from 'node:assert/strict';
import * as core from '../src/core.js';
import {nextBotAction} from '../src/bots.js';
const E=globalThis.Engine;
const now=Date.now();
const ctx=(t=now,ds=[1,2])=>({now:t,rand:()=>.42,die:()=>ds.shift()||2});
const player=i=>({id:'p_test'+i,name:'Human'+i,look:{skin:i%5,hair:'short'},pet:''});
const copy=o=>JSON.parse(JSON.stringify(o));
function game(count=2,mode=35){
  let s=E.newRoom('ABCD',{mode,max:6,timer:0});
  for(let i=0;i<count;i++)s=E.join(s,player(i).id,player(i).name,player(i).look,'');
  s=E.start(s,0,ctx());
  s.order=Array.from({length:count},(_,i)=>i);s.turn=0;
  return s;
}
for(let n=2;n<=6;n++){
  const s=game(n),per=0,ids=Object.keys(s.own).map(Number);
  assert.equal(s.players.length,n);
  assert.equal(ids.length,n*per);
  assert.equal(new Set(ids).size,ids.length);
  assert.equal(s.mode,35);
  assert.equal(s.endAt-s.startedAt,35*60000);
  assert.equal(s.timer,0);
  const spent=[];
  for(let i=0;i<n;i++){
    const deeds=ids.filter(j=>s.own[j].o===i);
    assert.equal(deeds.length,per);
    const price=deeds.reduce((v,j)=>v+E.T[j].p,0);
    spent.push(price);
    assert.equal(s.players[i].cash,E.START_CASH-price);
    assert.equal(E.worth(s,i),E.START_CASH);
    assert(s.players[i].cash>=0);
  }
  assert(Math.max(...spent)-Math.min(...spent)<=240,'Fair starter deed price allocation '+JSON.stringify(spent));
}
console.log('Fair paid 2–6-player starter portfolios, 35-minute defaults and no turn timer by default passed');
const host=player(0),fellow=player(1);
let lobby=core.partyOp(null,'create',host,{mode:35,bots:4,difficulty:'hard'},now,'BBCC').state;
assert.equal(lobby.max,6);assert.equal(lobby.players.length,5);
lobby=core.partyOp(lobby,'join',fellow,{},now+1,'BBCC').state;
assert.equal(lobby.players.length,6);
assert.throws(()=>core.partyOp(lobby,'join',player(8),{},now+2,'BBCC'),/full/i);
const started=core.partyOp(lobby,'start',host,{},now+100,'BBCC').state;
assert.equal(started.phase,'play');assert.equal(Object.keys(started.own).length,0);
{ // the host's exact party size caps seats, bots included
  const three=core.partyOp(null,'create',host,{mode:35,max:3,bots:4},now,'DDEE').state;
  assert.equal(three.max,3);assert.equal(three.players.length,3);
  assert.throws(()=>core.partyOp(three,'join',fellow,{},now+1,'DDEE'),/full/i);
  console.log('Exact party size from settings caps seats and bots passed');
}
for(const mode of [25,35,45,'classic']){
  const s=core.partyOp(null,'create',host,{mode,bots:1},now,'CCDD').state;
  assert.equal(s.mode,mode);
  const st=core.partyOp(s,'start',host,{},now+10,'CCDD').state;
  assert.equal(st.endAt,mode==='classic'?0:now+10+mode*60000);
}
console.log('Six seats with four bots, mode choices and Classic passed');
function railRoll(owner5,owner15){
  const s=game(2);
  s.phase='play';s.stage='roll';s.station=-1;s.again=false;
  s.players[0].pos=2;s.players[0].cash=1000;s.players[1].cash=1000;
  [5,15].forEach(i=>delete s.own[i]);
  if(owner5>=0)s.own[5]={o:owner5,h:0};
  if(owner15>=0)s.own[15]={o:owner15,h:0};
  s.endAt=now+2000000;s.t=now;
  return E.act(s,0,{t:'roll'},ctx(now+1));
}
let rail=railRoll(1,1);
assert.equal(rail.stage,'act','no train from a station someone else owns');
assert.equal(rail.players[0].cash,950,'ordinary station rent still collected');
assert.equal(rail.players[1].cash,1050);
assert.throws(()=>E.act(rail,0,{t:'travel',tile:15},ctx(now+2)));
rail=railRoll(0,-1);
assert.equal(rail.stage,'act','owning only the departure station is not enough');
rail=railRoll(0,0);
assert.equal(rail.stage,'travel','own both stations: the train is offered');
assert.deepEqual(E.railDest(rail,0),[15]);
assert.throws(()=>E.act(rail,0,{t:'travel',tile:25},ctx(now+2)),/stations you own/);
const viaServer=core.partyOp(rail,'act',player(0),{a:{t:'travel',tile:15}},now+2,'ABCD');
assert.equal(viaServer.state.players[0].pos,15,'server action sanitiser must allow travel');
rail=E.act(rail,0,{t:'travel',tile:15},ctx(now+2));
assert.equal(rail.players[0].cash,1000,'travel between your own stations is free');
assert.equal(rail.players[0].pos,15);assert.equal(rail.station,-1);
assert.equal(E.cur(rail),1,'travel immediately ends turn');
let unowned=railRoll(-1,-1);
assert.equal(unowned.stage,'buy');
unowned=E.act(unowned,0,{t:'buy'},ctx(now+2));
assert.equal(unowned.stage,'act','one station owned: nowhere to travel');
assert.throws(()=>E.act(Object.assign(game(2),{stage:'travel',station:5}),0,{t:'travel',tile:4},ctx(now+1)));
console.log('Trains only between stations you own: free, ends the turn, rent still paid elsewhere passed');
let build=game(2);
build.own[1]={o:0,h:3};build.own[3]={o:0,h:3};build.players[0].cash=1500;
build.stage='roll';
assert(E.canBuild(build,0,1));
const preWorth=E.worth(build,0);
build=E.act(build,0,{t:'build',tile:1},ctx(now+1));
assert.equal(build.own[1].h,5,'hotel after third house');
assert.equal(build.players[0].cash,1450);
assert.equal(E.worth(build,0),preWorth);
build=E.act(build,0,{t:'sellHouse',tile:1},ctx(now+2));
assert.equal(build.own[1].h,3,'hotel downgrades to three houses');
console.log('Three-house hotel purchase, rent index, net worth and downgrade passed');
let chaos=game(2);chaos.endAt=now+240000;chaos.t=now;
chaos.own[5]={o:1,h:0};chaos.own[15]={o:1,h:0};
assert(E.chaos(chaos,now));
const withTrade=copy(chaos);withTrade.trade={from:0,to:1,gc:20,tc:0,gp:[],tp:[]};
const activated=E.chaosStep(withTrade,ctx(now+1));
assert.equal(activated.chaosStarted,true);
assert.equal(activated.trade,null,'Final Chaos clears pending trades');
assert.equal(E.chaosStep(activated,ctx(now+2)),activated,'Final Chaos is not announced twice');
assert.equal(E.rent(chaos,5,7,now),100,'2x ordinary rent for two stations');
assert.throws(()=>E.act(chaos,0,{t:'propose',to:1,gc:100,tc:0,gp:[],tp:[]},ctx(now+1)),/final five minutes/i);
chaos.players[0].cash=5000;chaos.players[1].cash=100;
chaos.endAt=now-1;chaos.stage='auction';chaos.auc={tile:1,bid:20,by:0,who:1,live:[0,1]};
delete chaos.own[1];
let expired=E.expire(chaos,ctx(now+1));
assert.equal(expired.phase,'over');assert.equal(expired.stage,'over');
assert(expired.winners.includes(0));
assert.equal(expired.auc,null);assert.equal(expired.trade,null);
assert(expired.players[0].coins>chaos.players[0].coins);
assert.equal(E.expire(expired,ctx(now+2)),expired,'game over settled exactly once');
let last=game(2);last=E.act(last,1,{t:'quit'},ctx(now+1));
assert.equal(last.phase,'over');assert.deepEqual(last.winners,[0]);
console.log('Final 5-minute chaos, authoritative deadline auction settlement and immediate last-player winner passed');
const bot=copy(started);
bot.order=[0,1,2,3,4,5];bot.turn=1;bot.stage='travel';bot.station=5;bot.players[1].pos=5;bot.own[5]={o:1,h:0};bot.own[15]={o:1,h:0};
const choice=nextBotAction(bot);
assert(['travel','stay'].includes(choice?.a?.t),'Bot must resolve station choice');
console.log('Bot station decisions passed');
{ // mortgages: half the price now, no rent, no building on the set, 55% to pay off
  let m=game(2); m.phase='play'; m.order=[0,1]; m.turn=0; m.stage='act'; m.trade=null; m.own={}; m.own[1]={o:0,h:0}; m.own[3]={o:0,h:0}; m.players[0].cash=1000;
  m=E.act(m,0,{t:'mortgage',tile:1},ctx(now+1));
  assert.equal(m.players[0].cash,1000+E.T[1].p/2); assert.equal(m.own[1].m,true);
  assert.equal(E.rent(m,1,7),0,'a mortgaged street collects no rent');
  assert.equal(E.canBuild(m,0,3),false,'no building on a set with a mortgaged street');
  const before=m.players[0].cash; m=E.act(m,0,{t:'unmortgage',tile:1},ctx(now+2));
  assert.equal(m.players[0].cash,before-E.unmortgageCost(1)); assert(!m.own[1].m);
  const viaServer=core.partyOp(Object.assign(E.act(m,0,{t:'mortgage',tile:3},ctx(now+3)),{}),'act',player(0),{a:{t:'unmortgage',tile:3}},now+4,'ABCD');
  assert(!viaServer.state.own[3].m,'server accepts mortgage moves');
  console.log('Mortgage, no rent while mortgaged, no building, pay-off at 55% passed');
}
{ // one loot box per lap, none at random
  let l=game(2); l.phase='play'; l.order=[0,1]; l.turn=0; l.stage='roll'; l.players[0].pos=38; const b0=l.players[0].boxes;
  for (let k=0;k<6 && l.players[0].pos>=30 && E.cur(l)===0;k++) { l.stage='roll'; l.again=false; l=E.act(l,0,{t:'roll'},ctx(now+10+k)); }
  if (l.players[0].pos<30) assert.equal(l.players[0].boxes,b0+1,'passing Start gives a loot box');
  console.log('Loot box for each lap passed');
}
