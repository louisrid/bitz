/* BITZ 2.0 progression, calculated by the server and stored on existing wallets. */
export const LEVEL_GOLD=75000, MAX_LEVEL=100;
export const MILESTONES=Object.freeze({5:'bp_tricorn',10:'bp_crab',15:'bp_captain',20:'bp_turtle'});
export const XP_PER_PURCHASE=35, XP_PER_BOX=60, XP_PER_PARTICIPATION=5;
export function xpThreshold(level){const n=Math.max(0,Math.min(MAX_LEVEL,Math.floor(Number(level)||1))-1);return n*100+n*(n-1)*35/2;}
export function progressOf(w){
 const xp=Math.max(0,Math.floor(Number(w.xp)||0));let level=1;
 while(level<MAX_LEVEL&&xp>=xpThreshold(level+1))level++;
 const start=xpThreshold(level),end=level<MAX_LEVEL?xpThreshold(level+1):start;
 return {xp,level,levelXp:xp-start,nextXp:end-start,percent:end>start?Math.round((xp-start)/(end-start)*100):100};
}
export function awardXP(w,amount,items){
 const before=progressOf(w).level,gain=Math.max(0,Math.min(5000,Math.floor(Number(amount)||0)));
 if(!gain)return {xp:0,level:before,rewards:[]};
 w.xp=Math.min(xpThreshold(MAX_LEVEL),Math.max(0,Math.floor(Number(w.xp)||0))+gain);
 const after=progressOf(w);w.level=after.level;const rewards=[];w.own=Array.isArray(w.own)?w.own:[];
 for(let level=before+1;level<=after.level;level++){
  const id=MILESTONES[level],available=id&&items&&items[id]&&!w.own.includes(id);
  if(available){w.own.push(id);rewards.push({level,item:id});}
  else{w.coins=Math.floor(w.coins||0)+LEVEL_GOLD;rewards.push({level,gold:LEVEL_GOLD});}
 }
 return {xp:gain,level:after.level,rewards};
}
