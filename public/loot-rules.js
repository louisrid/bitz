/* Shared drop table for server and browser. Never determine rewards on the client. */
(function(root){
  'use strict';
  const order=['epic','legendary','mythical','secret'];
  const base=Object.freeze({epic:20,legendary:35,mythical:35,secret:10});
  const secret=new Set(['x_sun','x_void','x_glitch']);
  const legendary=new Set(['x_volt','x_ghost','x_alien','x_mafia','x_ninja','x_reaper','x_storm','x_frost']);
  function tier(id,items){
    const item=items && items[id];
    if(!item || item[3]!==1 || item[0]!=='outfit')return null;
    if(secret.has(id))return 'secret';
    if(legendary.has(id))return 'legendary';
    return item[2]>=9000000?'mythical':'epic';
  }
  function eligible(items,owned){
    const set=new Set(owned||[]);
    return Object.keys(items||{}).filter(id=>tier(id,items)&&!set.has(id));
  }
  function distribution(ids,items){
    const present=new Set((ids||[]).map(id=>tier(id,items)));
    const sum=order.reduce((a,t)=>a+(present.has(t)?base[t]:0),0);
    if(!sum)return {epic:0,legendary:0,mythical:0,secret:0};
    const out={};
    order.forEach(t=>{out[t]=present.has(t)?base[t]/sum:0;});
    return out;
  }
  function odds(ids,items){
    const d=distribution(ids,items),out={epic:0,legendary:0,mythical:0,secret:0};
    const present=order.filter(t=>d[t]>0);if(!present.length)return out;
    let remaining=1000;
    for(let i=0;i<present.length;i++){
      const t=present[i];
      const tenths=i===present.length-1?remaining:Math.round(d[t]*1000);
      out[t]=tenths/10;remaining-=tenths;
    }
    return out;
  }
  function pick(ids,items,random){
    if(!ids||!ids.length)return null;
    const d=distribution(ids,items),r=(random||Math.random)(),v=Math.max(0,Math.min(0.999999999,r));
    let acc=0,type=order[order.length-1];
    for(const t of order){acc+=d[t];if(v<acc){type=t;break;}}
    const options=ids.filter(id=>tier(id,items)===type);
    const pool=options.length?options:ids;
    return pool[Math.floor((random||Math.random)()*pool.length)];
  }
  root.BITZ_LOOT_RULES=Object.freeze({order:Object.freeze(order),base,tier,eligible,distribution,odds,pick});
})(globalThis);
