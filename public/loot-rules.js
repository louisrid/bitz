/* Shared loot odds, weighted on the server. Frontend uses this only to display
   probabilities and animate results. Owned exclusives cannot be rolled again. */
(function(root){
 'use strict';
 const order=Object.freeze(['epic','legendary','mythical','secret']);
 const base=Object.freeze({epic:70,legendary:22,mythical:7,secret:1});
 const themes=Object.freeze({
  season:Object.freeze({name:'Season One',price:2000000,odds:base,ids:null}),
  cosmic:Object.freeze({name:'Cosmic',price:2500000,odds:Object.freeze({epic:62,legendary:24,mythical:12,secret:2}),ids:Object.freeze(['x_cosmic','x_sun','x_void','x_abyss','x_starforge','x_prism','x_glitch'])}),
  legends:Object.freeze({name:'Legends',price:1800000,odds:Object.freeze({epic:74,legendary:20,mythical:5,secret:1}),ids:Object.freeze(['x_volt','x_ghost','x_alien','x_mafia','x_ninja','x_reaper','x_storm','x_frost','x_samurai','x_pharaoh','x_crystal'])})
 });
 const secret=new Set(['x_sun','x_void','x_glitch']);
 const legendary=new Set(['x_volt','x_ghost','x_alien','x_mafia','x_ninja','x_reaper','x_storm','x_frost']);
 const themeOf=name=>themes[name]||themes.season;
 function tier(id,items){
  const item=items&&items[id];if(!item||item[3]!==1||item[0]!=='outfit')return null;
  if(secret.has(id))return 'secret';if(legendary.has(id))return 'legendary';return item[2]>=9000000?'mythical':'epic';
 }
 function eligible(items,owned,theme){
  const seen=new Set(owned||[]),cfg=themeOf(theme);
  return Object.keys(items||{}).filter(id=>tier(id,items)&&!seen.has(id)&&(!cfg.ids||cfg.ids.includes(id)));
 }
 function distribution(ids,items,theme){
  const present=new Set((ids||[]).map(id=>tier(id,items))),cfg=themeOf(theme).odds;
  const sum=order.reduce((a,t)=>a+(present.has(t)?cfg[t]:0),0),out={};
  order.forEach(t=>{out[t]=sum&&present.has(t)?cfg[t]/sum:0;});return out;
 }
 function odds(ids,items,theme){
  const d=distribution(ids,items,theme),out={epic:0,legendary:0,mythical:0,secret:0};
  const present=order.filter(t=>d[t]>0);let remain=1000;
  present.forEach((t,i)=>{const n=i===present.length-1?remain:Math.round(d[t]*1000);out[t]=n/10;remain-=n;});return out;
 }
 function pick(ids,items,random,theme){
  if(!ids||!ids.length)return null;
  const rand=typeof random==='function'?random:Math.random,d=distribution(ids,items,theme),r=Math.max(0,Math.min(.999999999,rand()));
  let acc=0,selected=order.find(t=>d[t]>0);
  for(const t of order){acc+=d[t];if(r<acc){selected=t;break;}}
  const matches=ids.filter(id=>tier(id,items)===selected),pool=matches.length?matches:ids;
  return pool[Math.floor(Math.max(0,Math.min(.999999999,rand()))*pool.length)];
 }
 root.BITZ_LOOT_RULES=Object.freeze({order,base,themes,themeOf,tier,eligible,distribution,odds,pick});
})(globalThis);
