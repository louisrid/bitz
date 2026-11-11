/* Server-authoritative Stakkz bot opponents. No client controls their turns.
   Easy makes frequent financial mistakes; Medium protects cash; Hard values completed sets
   and returns on investment. All three remain fallible casual Monopoly opponents. */
import '../public/engine.js';
const E = globalThis.Engine, T = E.T;
export const BOT_NAMES = ['Pixel', 'Byte', 'Volt', 'Glitch'];
export const BOT_LOOKS = [
  { skin: 1, hair: 'bob', hc: 1, outfit: 'hoodie' },
  { skin: 3, hair: 'spiky', hc: 0, outfit: 'tee' },
  { skin: 0, hair: 'bun', hc: 3, outfit: 'hoodie' },
  { skin: 2, hair: 'short', hc: 2, outfit: 'tee' }
];
const noise = (a,b) => a + Math.random() * (b-a);
const clamp = (n,a,b) => Math.max(a, Math.min(b,n));
export const isBot = p => !!(p && p.bot && /^bot:[A-Z]{4}:[1-4]$/.test(p.id));
const skillOf = p => p.bot === 'easy' ? 0 : p.bot === 'hard' ? 2 : 1;
function groupValue(s, pi, tile) {
  const t = T[tile]; if (!t || !t.p) return 0;
  if (t.t === 'rail') return 1.05 + E.props(s,pi).filter(i=>T[i].t==='rail').length * .15;
  if (t.t === 'util') return .83 + E.props(s,pi).filter(i=>T[i].t==='util').length * .17;
  const group = E.setOf(tile), owned = group.filter(i => E.owner(s,i) === pi).length;
  const rival = group.filter(i => E.owner(s,i) >= 0 && E.owner(s,i) !== pi).length;
  return clamp(1 + owned * .30 + (owned === group.length-1 ? .65 : 0) - rival * .25, .6, 2.4);
}
function value(s, pi, tile, skill) {
  const t = T[tile]; if (!t || !t.p) return 0;
  return t.p * (skill === 0 ? noise(.65,1.35) : skill === 1 ? 1.03 : 1.15) * groupValue(s,pi,tile);
}
function buildPick(s,pi,skill) {
  const p=s.players[pi], reserve=[90,240,390][skill];
  const options=E.props(s,pi).filter(i => T[i].t === 'st' && E.canBuild(s,pi,i) && p.cash-E.HC[T[i].g]>=reserve);
  if (!options.length) return null;
  options.sort((a,b)=>{
    const roi = i => (T[i].r[E.lvl(s,i)===3?5:Math.min(5,E.lvl(s,i)+1)] - T[i].r[E.lvl(s,i)]) / E.HC[T[i].g];
    return roi(b)-roi(a);
  });
  if (skill===0 && Math.random()<.62) return null;
  if (skill===1 && Math.random()<.30) return null;
  return {t:'build',tile:skill===0 ? options[Math.floor(Math.random()*options.length)] : options[0]};
}
function handleDebt(s,pi) {
  const mine=E.props(s,pi);
  const houses=mine.filter(i=>E.canSellHouse(s,pi,i)).sort((a,b)=>E.lvl(s,a)-E.lvl(s,b));
  if(houses.length) return {t:'sellHouse',tile:houses[0]};
  const own=mine.filter(i=>E.canSellProp(s,pi,i)).sort((a,b)=>groupValue(s,pi,a)-groupValue(s,pi,b) || T[a].p-T[b].p);
  return own.length?{t:'sellProp',tile:own[0]}:{t:'bankrupt'};
}
function tradeDecision(s,pi,skill) {
  const q=s.trade;
  const gain=q.gc + q.gp.reduce((sum,i)=>sum+value(s,pi,i,skill),0);
  const loss=q.tc + q.tp.reduce((sum,i)=>sum+value(s,pi,i,skill),0);
  const threshold=[.8,1.04,1.17][skill];
  return {t: gain >= loss*threshold && s.players[pi].cash >= q.tc ? 'accept':'reject'};
}
export function nextBotAction(s) {
  if(!s || s.phase!=='play') return null;
  let pi=-1;
  if(s.rush>=0 && isBot(s.players[s.rush])) pi=s.rush;
  else if(s.trade && isBot(s.players[s.trade.to])) pi=s.trade.to;
  else if(s.stage==='auction' && s.auc && isBot(s.players[s.auc.who])) pi=s.auc.who;
  else if(isBot(s.players[E.cur(s)])) pi=E.cur(s);
  if(pi<0) return null;
  const p=s.players[pi], skill=skillOf(p);
  if(p.out) return null;
  let a=null;
  if(s.rush===pi) a={t:'rush',n:Math.round(noise(2+skill*2,7+skill*2))};
  else if(s.trade && s.trade.to===pi) a=tradeDecision(s,pi,skill);
  else if(s.stage==='auction' && s.auc && s.auc.who===pi){
    const tile=s.auc.tile, price=T[tile].p, min=Math.max(10,s.auc.bid+10);
    const reserve=[75,190,300][skill];
    const cap=Math.min(p.cash-reserve, Math.round(value(s,pi,tile,skill)*[.77,.94,1.03][skill]));
    a=min<=cap && (skill>0 || Math.random()>.16) ? {t:'bid',amt:Math.min(cap,Math.max(min,s.auc.bid+noise(12,skill===2?75:40)|0))} : {t:'pass'};
  } else if(E.cur(s)===pi) {
    if(s.stage==='travel') {
      const fee=E.owner(s,s.station)===pi?0:50;
      const opts=E.RAILS.filter(i=>i!==s.station);
      // Assess the next roll: move near affordable vacant properties, while
      // keeping more cash in Hard mode. No destination rent or Start bonus.
      const score=i=>[2,3,4,5,6,7,8,9,10,11,12].reduce((v,step)=>{
        const t=(i+step)%40;return v+(E.isProp(t)&&E.owner(s,t)<0&&T[t].p<p.cash-fee?Math.max(0,12-step):0);
      },0);
      opts.sort((a,b)=>score(b)-score(a));
      const go=p.cash>=fee+([40,140,280][skill]) && Math.random()<[.37,.62,.82][skill];
      a=go?{t:'travel',tile:skill===0?opts[Math.floor(Math.random()*opts.length)]:opts[0]}:{t:'stay'};
    }
    else if(s.stage==='debt') a=handleDebt(s,pi);
    else if(s.stage==='buy'){
      const t=T[p.pos], remain=p.cash-(t.p||0), reserve=[75,170,260][skill];
      const ideal=value(s,pi,p.pos,skill);
      const willing=remain>=reserve || (skill===2 && remain>40 && ideal>t.p*1.5);
      a={t:willing && (skill!==0 || Math.random()>.22) ? 'buy':'skip'};
    } else if(s.stage==='roll'){
      const b=buildPick(s,pi,skill);
      if(b) a=b;
      else if(p.jail && p.gojf && p.gojf.length) a={t:'useCard'};
      else if(p.jail && p.cash>=50+[90,180,240][skill] && (skill===2 || Math.random()>.35)) a={t:'payJail'};
      else a={t:'roll'};
    } else if(s.stage==='act') a=buildPick(s,pi,skill)||{t:'end'};
  }
  return a?{id:p.id,a,skill:p.bot}:null;
}
