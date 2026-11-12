/* BITZ 2.0 Football Cards. Self-contained server-authoritative economy.
   Never modify existing cosmetic or account keys. Card records retain historic
   player IDs even if rosters are refreshed in a later season. */
import crypto from 'node:crypto';
import {awardXP} from './progression.js';
import {ITEMS} from './shop.js';
import {FOOTBALL_SEASON,FOOTBALL_SEED,PACKS,VARIANTS,PLAYERS,CLUBS,CLUB_BY_ID,PLAYER_BY_ID,RIVALS} from './football-catalogue.js';

const MAX_CARDS=3000, GOLD_PER_VIRTUAL_CENT=1000;
const TIERS=['Base','Bronze','Silver','Gold','Holographic','Legendary','Signature','Mythical','Masterpiece'];
const score={base:0,bronze:1,silver:2,gold:3,holo:4,legendary:5,signature:6,goldInk:7,blackInk:7,dual:7,numbered99:4,numbered25:6,numbered5:8,masterpiece:9};
const refuse=m=>{throw new CardError(m);};
export class CardError extends Error {}
const rnd=max=>crypto.randomInt(max);
const today=()=>new Date().toISOString().slice(0,10);
const PUBLIC_PACKS=Object.fromEntries(Object.entries(PACKS).map(([id,p])=>[id,{...p}]));
function validCards(w){return Array.isArray(w.football?.cards)?w.football.cards:[];}
function randomObjective(){
 const kinds=['receive-club','receive-silver','trade-gold','trade-legendary'];
 const kind=kinds[rnd(kinds.length)];
 const club=kind==='receive-club'?CLUBS[rnd(CLUBS.length)].id:null;
 return {id:crypto.randomUUID(),kind,club,createdAt:Date.now()};
}
function objectiveLabel(o){
 if(!o)return '';
 if(o.kind==='receive-club')return 'Receive a Silver-or-better '+(CLUB_BY_ID.get(o.club)?.name||'Premier League')+' card in a trade';
 if(o.kind==='receive-silver')return 'Receive any Gold-or-better card in a trade';
 if(o.kind==='trade-gold')return 'Trade away a Gold-or-better card';
 return 'Trade away a Legendary-or-better card';
}
function variantTier(id){return score[id]??0;}
function eligible(pack){return PLAYERS.filter(p=>pack.pool==='all'||pack.pool==='prem'&&p.league==='Premier League'||pack.pool==='elite'&&p.slot<=6);}
function weighted(odds){
 const entries=Object.entries(odds);const sum=entries.reduce((n,[,v])=>n+v,0);
 let n=rnd(sum);
 for(const [key,v] of entries){n-=v;if(n<0)return key;}
 return entries.at(-1)[0];
}
function acceptableForGuarantee(id,kind){
 if(kind==='signature')return ['signature','goldInk','blackInk','dual','masterpiece'].includes(id);
 return variantTier(id)>=score.legendary;
}
export function createFootballService({accounts,serials,offers,markDirty,resolvePlayer}){
 const touch=()=>markDirty();
 function ensure(w){
  if(!w.football||typeof w.football!=='object'){w.football={};touch();}
  const f=w.football;
  if(!Array.isArray(f.cards)){f.cards=[];touch();}
  if(!f.packs||typeof f.packs!=='object'){f.packs={'first-xi':2};touch();}
  if(!f.claimed||typeof f.claimed!=='object'){f.claimed={};touch();}
  if(!Array.isArray(f.favorites)){f.favorites=[];touch();}
  if(!f.objective||!f.objective.id){f.objective=randomObjective();touch();}
  if(!Array.isArray(f.objectiveHistory)){f.objectiveHistory=[];touch();}
  if(!f.questAt||typeof f.questAt!=='object'){f.questAt={};touch();}
  return f;
 }
 function owned(w,uid){return validCards(w).find(c=>c.uid===uid);}
 function uniquePlayerCount(f,club){
  const set=new Set();
  for(const card of f.cards)for(const id of card.players||[card.player]){const p=PLAYER_BY_ID.get(id);if(p?.club===club)set.add(id);}
  return set.size;
 }
 function album(w){
  const f=ensure(w);
  return CLUBS.map(c=>({id:c.id,name:c.name,slots:11,owned:uniquePlayerCount(f,c.id),claimed:!!f.claimed[FOOTBALL_SEASON+':'+c.id],reward:'elite-vault'}));
 }
 function rollPlayer(pool){return pool[rnd(pool.length)];}
 function roll(w,packId,pack,choice){
  const pool=eligible(pack);if(!pool.length)refuse('No eligible players in this pack.');
  const f=ensure(w);
  let variant=choice||weighted(pack.odds),def=VARIANTS[variant],players=[],p=null;
  for(let tries=0;tries<30;tries++){
   p=rollPlayer(pool);players=[p.id];
   if(variant==='dual'){
    const rival=RIVALS[p.club];const alternatives=pool.filter(x=>x.id!==p.id&&(rival?x.club===rival:x.club!==p.club));
    if(alternatives.length)players.push(rollPlayer(alternatives).id);
    else variant='signature';
   }
   def=VARIANTS[variant];
   const serialKey=FOOTBALL_SEASON+':'+packId+':'+variant+':'+players.join(':');
   if(!def?.serialMax||Number(serials.get(serialKey)||0)<def.serialMax)break;
   if(tries===29){variant='legendary';def=VARIANTS.legendary;players=[p.id];}
  }
  let serial=null,serialMax=def.serialMax||null;
  if(serialMax){
   const key=FOOTBALL_SEASON+':'+packId+':'+variant+':'+players.join(':');
   serial=(Number(serials.get(key))||0)+1;serials.set(key,serial);touch();
  }
  const card={uid:crypto.randomUUID(),players,player:p.id,variant,pack:packId,season:FOOTBALL_SEASON,
   serial,serialMax,valueCents:def.valueCents,createdAt:Date.now(),source:'server'};
  if(f.cards.length>=MAX_CARDS)refuse('Your card inventory is full. Quick-sell duplicates first.');
  f.cards.push(card);
  return card;
 }
 function buy(w,id){
  const p=PACKS[id];if(!p||p.questOnly)refuse('This pack cannot be bought.');
  const f=ensure(w),price=p.cost;
  if(!Number.isFinite(w.coins)||w.coins<price)refuse('Not enough gold.');
  w.coins-=price;f.packs[id]=(Number(f.packs[id])||0)+1;touch();
  return {pack:id,balance:w.coins};
 }
 function open(w,id){
  const p=PACKS[id],f=ensure(w);if(!p)refuse('Unknown pack.');
  if(!(f.packs[id]>0))refuse('You do not own that pack.');
  if(f.cards.length+p.cards>MAX_CARDS)refuse('Make space in your collection first.');
  f.packs[id]--;const made=[],bonus=[];
  for(let i=0;i<p.cards;i++){
   let choice=weighted(p.odds);
   const guarantee=p.guaranteed;const promised=guarantee?Number(guarantee.signature||guarantee.legendary||0):0;
   const minimum=guarantee?.signature?'signature':'legendary';
   const have=made.filter(c=>acceptableForGuarantee(c.variant,minimum)).length;
   if(promised>have&&p.cards-i<=promised-have){
    const eligibleTier=Object.fromEntries(Object.entries(p.odds).filter(([key])=>acceptableForGuarantee(key,minimum)));
    choice=weighted(eligibleTier);
   }
   const card=roll(w,id,p,choice);made.push(card);
   const reward=VARIANTS[card.variant]?.bonusGold||0;if(reward)bonus.push({uid:card.uid,gold:reward});
  }
  const gold=bonus.reduce((s,x)=>s+x.gold,0);w.coins=Math.floor(w.coins||0)+gold;
  awardXP(w,Math.min(180,made.length*20),ITEMS);
  touch();return {cards:made,bonusGold:gold,bonuses:bonus,pack:id,newAlbum:album(w)};
 }
 function sell(w,uid,id){
  const f=ensure(w),idx=f.cards.findIndex(x=>x.uid===uid);if(idx<0)refuse('You do not own this card.');
  if([...offers.values()].some(o=>o.status==='pending'&&((o.fromId===id&&o.fromCards.includes(uid))||(o.toId===id&&o.toCards.includes(uid)))))refuse('This card is reserved by a pending trade. Decline or cancel the offer first.');
  const [card]=f.cards.splice(idx,1);const gold=(Number(card.valueCents)||50)*GOLD_PER_VIRTUAL_CENT;
  w.coins=Math.floor(w.coins||0)+gold;f.favorites=f.favorites.filter(x=>x!==uid);touch();
  return {sold:card,gold};
 }
 function favorites(w,uids){
  const f=ensure(w);if(!Array.isArray(uids)||uids.length>5||uids.length!==new Set(uids).size)refuse('Choose up to five different cards.');
  if(!uids.every(x=>typeof x==='string'&&!!owned(w,x)))refuse('You can only display cards you own.');
  f.favorites=uids;touch();return {favorites:f.favorites};
 }
 function claim(w,clubId){
  const club=CLUBS.find(x=>x.id===clubId);if(!club)refuse('Unknown Premier League club.');
  const f=ensure(w),key=FOOTBALL_SEASON+':'+clubId;
  if(f.claimed[key])refuse('This season reward has already been claimed.');
  if(uniquePlayerCount(f,clubId)<11)refuse('Collect all eleven different players before claiming.');
  f.claimed[key]=Date.now();f.packs['elite-vault']=(Number(f.packs['elite-vault'])||0)+1;awardXP(w,160,ITEMS);touch();
  return {claimed:clubId,reward:'elite-vault',album:album(w)};
 }
 function publicCard(w,ident){
  const f=ensure(w);
  return {id:ident,name:w.name||'Player',level:w.level||1,top:f.favorites.map(uid=>owned(w,uid)).filter(Boolean),valueCents:f.cards.reduce((a,c)=>a+(Number(c.valueCents)||0),0),cards:f.cards.length,completion:album(w)};
 }
 function questComplete(obj,given,received){
  if(!obj)return false;
  const any=(cards,fn)=>cards.some(c=>fn(c,PLAYER_BY_ID.get(c.player)));
  switch(obj.kind){
   case 'receive-club':return any(received,(c,p)=>p?.club===obj.club&&variantTier(c.variant)>=2);
   case 'receive-silver':return any(received,c=>variantTier(c.variant)>=3);
   case 'trade-gold':return any(given,c=>variantTier(c.variant)>=3);
   case 'trade-legendary':return any(given,c=>variantTier(c.variant)>=5);
   default:return false;
  }
 }
 function rewardQuest(w,otherId,given,received,now){
  const f=ensure(w),obj=f.objective;if(!questComplete(obj,given,received))return false;
  const last=Number(f.questAt[otherId]||0);
  if(now-last<3600000)return false; // one qualifying reward per player-pair/hour
  const day=today(),daily=f.objectiveHistory.filter(x=>x.day===day).length;
  if(daily>=5)return false;
  if(f.objectiveHistory.some(x=>x.id===obj.id))return false;
  f.objectiveHistory.push({id:obj.id,otherId,day,at:now});f.objectiveHistory=f.objectiveHistory.slice(-120);
  f.questAt[otherId]=now;f.packs.god=(Number(f.packs.god)||0)+1;f.objective=randomObjective();awardXP(w,75,ITEMS);touch();
  return true;
 }
 function offer(fromId,targetCode,give,take){
  const toId=resolvePlayer(targetCode);if(!toId||toId===fromId)refuse('Select another player.');
  const from=accounts.get(fromId),to=accounts.get(toId);
  if(!from||!to)refuse('Player unavailable.');
  ensure(from);ensure(to);
  if(!Array.isArray(give)||!Array.isArray(take)||give.length>10||take.length>10||!give.length&&!take.length)refuse('Select the cards to exchange.');
  if(give.length!==new Set(give).size||take.length!==new Set(take).size)refuse('Duplicate card in offer.');
  if(!give.every(id=>owned(from,id))||!take.every(id=>owned(to,id)))refuse('A listed card has changed owner.');
  const active=[...offers.values()].filter(x=>x.status==='pending'&&(x.fromId===fromId||x.toId===fromId));
  if(active.length>=8)refuse('Too many pending trade offers.');
  const id=crypto.randomUUID(),now=Date.now();
  offers.set(id,{id,fromId,toId,fromCards:give,toCards:take,createdAt:now,expiresAt:now+24*3600000,status:'pending'});touch();
  return {offer:id};
 }
 function decision(id,tradeId,accept){
  const entry=offers.get(tradeId);if(!entry)refuse('Trade not found.');
  if(entry.status!=='pending')refuse('This trade has already been resolved.');
  if(entry.expiresAt<Date.now()){entry.status='expired';touch();refuse('Trade expired.');}
  if(!accept){if(id!==entry.toId&&id!==entry.fromId)refuse('Not your trade.');entry.status='declined';touch();return {declined:tradeId};}
  if(id!==entry.toId)refuse('Only the receiving player can accept.');
  const a=accounts.get(entry.fromId),b=accounts.get(entry.toId);
  if(!a||!b)refuse('One of the players is unavailable.');
  const fa=ensure(a),fb=ensure(b);
  const from=entry.fromCards.map(uid=>owned(a,uid)),to=entry.toCards.map(uid=>owned(b,uid));
  if(from.some(x=>!x)||to.some(x=>!x))refuse('The trade is no longer valid. A card has changed owner.');
  if(fa.cards.length-from.length+to.length>MAX_CARDS||fb.cards.length-to.length+from.length>MAX_CARDS)refuse('One player has no inventory space.');
  // Synchronous validation+commit with no await; one event loop operation.
  const giving=new Set(entry.fromCards),taking=new Set(entry.toCards);
  fa.cards=fa.cards.filter(x=>!giving.has(x.uid)).concat(to);
  fb.cards=fb.cards.filter(x=>!taking.has(x.uid)).concat(from);
  fa.favorites=fa.favorites.filter(x=>!giving.has(x));fb.favorites=fb.favorites.filter(x=>!taking.has(x));
  entry.status='accepted';entry.acceptedAt=Date.now();
  const rewarded=[rewardQuest(a,entry.toId,from,to,entry.acceptedAt),rewardQuest(b,entry.fromId,to,from,entry.acceptedAt)];
  touch();return {accepted:tradeId,rewarded,received:from,sent:to};
 }
 function trades(w,id){
  return [...offers.values()].filter(x=>x.toId===id||x.fromId===id).sort((a,b)=>b.createdAt-a.createdAt)
   .slice(0,50).map(x=>({...x,fromName:accounts.get(x.fromId)?.name||'Player',toName:accounts.get(x.toId)?.name||'Player'}));
 }
 function self(w,id){
  const f=ensure(w);
  return {season:FOOTBALL_SEASON,cards:f.cards,packs:f.packs,claimed:f.claimed,favorites:f.favorites,
   objective:{...f.objective,label:objectiveLabel(f.objective)},objectiveHistory:f.objectiveHistory,
   album:album(w),trades:trades(w,id),virtualValueCents:f.cards.reduce((s,c)=>s+(Number(c.valueCents)||0),0)};
 }
 function move(verb,w,id,b){
  let out;
  if(verb==='buy')out=buy(w,String(b.pack||''));
  else if(verb==='open')out=open(w,String(b.pack||''));
  else if(verb==='sell')out=sell(w,String(b.uid||''),id);
  else if(verb==='favorites')out=favorites(w,b.cards);
  else if(verb==='claim')out=claim(w,String(b.club||''));
  else if(verb==='offer')out=offer(id,String(b.to||''),b.give,b.take);
  else if(verb==='accept')out=decision(id,String(b.trade||''),true);
  else if(verb==='decline')out=decision(id,String(b.trade||''),false);
  else refuse('Unknown card action.');
  return {...out,state:self(w,id)};
 }
 return {ensure,album,publicCard,self,move,objectiveLabel,catalogue:()=>({season:FOOTBALL_SEASON,clubs:FOOTBALL_SEED.clubs,europe:FOOTBALL_SEED.europe,players:FOOTBALL_SEED.players, packs:PUBLIC_PACKS, variants:VARIANTS})};
}
