/* BITZ 2.0 collecting economy. Legacy trading/Monopoly routines archived
   at legacy/core.monopoly.js, with Git rollback preserving the original. */
import {ITEMS,HAIRS} from './shop.js';
import '../public/loot-rules.js';
import {XP_PER_PURCHASE,XP_PER_BOX,XP_PER_PARTICIPATION,progressOf,awardXP} from './progression.js';
export {ITEMS,progressOf};
export const BOX_PRICE=2000000;
export const GOLD_RATE=Math.max(1000,Math.min(2000000,Number(process.env.BITZ_GOLD_PER_MINUTE)||500000))/60;
export const AWAY_MS=45000;
const R=globalThis.BITZ_LOOT_RULES;
const int=(v,lo,hi)=>Math.max(lo,Math.min(hi,Math.floor(Number(v)||0)));
const rnd=()=>{const a=new Uint32Array(1);crypto.getRandomValues(a);return a[0]/4294967296;};
export class Refused extends Error{}
const refuse=m=>{throw new Refused(m);};
export function freshWallet(){
 return {v:3,t:0,coins:1000000,m1:1,m10:1,e7:1,gt:0,boxes:1,themeBoxes:{},xp:0,level:1,own:[],claimed:[],games:{},gb:{},played:0,wins:0,soloAt:0,stats:{earned:0,rent:0,bought:0,kos:0,best:0,opened:0},name:'',look:{skin:0,hair:'short',hc:0,outfit:'tee',hat:'',acc:'',bg:'paper'},pet:''};
}
export function boostOf(w,now){const b=w.boost;return b&&b.until>now?b:null;}
export function earn(w,now){
 const from=w.gt||0;w.gt=now;if(!from||now<=from||now-from>AWAY_MS)return 0;
 const b=w.boost,boosted=b&&b.until>from?Math.min(now,b.until)-from:0,units=(now-from)+boosted*((b?b.x:1)-1);
 const perMin=GOLD_RATE*60,raw=Math.max(0,Math.round(units))*perMin+Math.max(0,Math.floor(w.goldCarry||0));
 const gain=Math.floor(raw/60000);w.goldCarry=raw%60000;
 if(gain){w.coins=Math.floor(w.coins||0)+gain;w.stats=w.stats||{};w.stats.earned=(w.stats.earned||0)+gain;}
 if(b&&b.until<=now)delete w.boost;return gain;
}
const owns=(w,id)=>!!ITEMS[id]&&(ITEMS[id][2]===0||(w.own||[]).includes(id));
export function setProfile(w,b={}){
 if(typeof b.name==='string')w.name=b.name.replace(/[\u0000-\u001f<>]/g,'').trim().slice(0,12);
 const l=b.look&&typeof b.look==='object'?b.look:(w.look||{}),out={skin:int(l.skin,0,4),hc:int(l.hc,0,6),hair:'short',outfit:'tee',hat:'',acc:'',bg:'paper'};
 if(HAIRS.includes(l.hair))out.hair=l.hair;
 ['outfit','hat','acc','bg'].forEach(k=>{const id=l[k];if(typeof id==='string'&&id&&owns(w,id)&&ITEMS[id][0]===k)out[k]=id;});
 if(out.hc>3&&!owns(w,'dye'))out.hc=0;
 w.look=out;const pet=typeof b.pet==='string'?b.pet:w.pet;
 w.pet=pet&&owns(w,pet)&&ITEMS[pet][0]==='pet'?pet:'';
}
const pool=(w,theme)=>R.eligible(ITEMS,Array.isArray(w.own)?w.own:[],theme);
const boxCount=(w,theme)=>theme==='season'?Math.floor(w.boxes||0):Math.floor(w.themeBoxes?.[theme]||0);
export function shop(w,what,item){
 w.own=Array.isArray(w.own)?w.own:[];w.themeBoxes=w.themeBoxes&&typeof w.themeBoxes==='object'?w.themeBoxes:{};w.stats=w.stats||{};
 if(what==='buy'){
  const it=ITEMS[item];if(!it||it[2]<=0||it[0]==='gun')refuse('That item is unavailable.');
  if(it[3])refuse(it[3]===2?'This collectible is not currently available.':'That collectible only comes from mystery boxes.');
  if(owns(w,item))return {};
  if(w.coins<it[2])refuse('You need '+(it[2]-w.coins).toLocaleString('en-GB')+' more gold.');
  w.coins-=it[2];w.own.push(item);return {progress:awardXP(w,XP_PER_PURCHASE,ITEMS)};
 }
 if(what==='box'||what==='open'){
  const theme=item==null||item===''?'season':String(item);
  if(!Object.hasOwn(R.themes,theme))refuse('Unknown mystery box.');
  if(what==='box'){
   if(!pool(w,theme).length)refuse('You have collected every reward in this box.');
   const price=R.themes[theme].price;
   if(w.coins<price)refuse('You need '+(price-w.coins).toLocaleString('en-GB')+' more gold.');
   w.coins-=price;
   if(theme==='season')w.boxes=Math.floor(w.boxes||0)+1;
   else w.themeBoxes[theme]=boxCount(w,theme)+1;
   return {theme};
  }
  if(boxCount(w,theme)<1)refuse('No '+R.themes[theme].name+' boxes left.');
  if(theme==='season')w.boxes--;else w.themeBoxes[theme]--;
  w.stats.opened=(w.stats.opened||0)+1;const options=pool(w,theme);
  if(!options.length){w.coins+=R.themes[theme].price;return {prize:{coins:R.themes[theme].price},theme};}
  const id=R.pick(options,ITEMS,rnd,theme);
  if(!id||w.own.includes(id))refuse('Could not select a unique reward.');
  w.own.push(id);return {prize:{item:id},theme,progress:awardXP(w,XP_PER_BOX,ITEMS)};
 }
 if(what==='reset')refuse('Accounts cannot be reset.');
 refuse('Unknown request.');
}
export function participate(w){return awardXP(w,XP_PER_PARTICIPATION,ITEMS);}
export function worth(w){return Math.floor(w.coins||0)+(Array.isArray(w.own)?w.own:[]).reduce((s,id)=>s+(ITEMS[id]&&ITEMS[id][2]>0?ITEMS[id][2]:0),0);}
const rarity=p=>p<=40000?0:p<=100000?1:p<=300000?2:p<=3000000?3:4;
export function swag(w){
 const own=Array.isArray(w.own)?w.own.filter(id=>ITEMS[id]):[],have=new Set(own),l=w.look||{};
 const worn=[l.outfit,l.hat,l.acc,l.bg,w.pet].reduce((s,id)=>{const it=ITEMS[id];if(!it||it[2]<=0||!have.has(id))return s;return s+[20,70,180,520,1500][rarity(it[2])]*(it[3]?2:1);},0);
 const kept=[...have].reduce((s,id)=>{const it=ITEMS[id];return s+[3,8,20,60,150][rarity(it[2])]*(it[3]?3:1);},0);
 return Math.max(-100,Math.min(9999,-100+worn+kept));
}
