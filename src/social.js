/* BITZ 2.0 multiplayer.
   The archived server implementation preserves combat, drops, travel, zombies,
   clans and trading. None of those processes or message handlers runs here. */
export function mountSocial({server,wss,core,getAuth,account,idOf,isAdmin,markDirty}){
 const plaza=new Map();let sequence=0;
 const map=globalThis.STAKKZ_WORLD_LAYOUT,lim=map.limit;
 const clamp=n=>Math.max(-lim,Math.min(lim,n));
 const testEnabled=process.env.BITZ_TEST_BETRAYAL==='1';
 const send=(ws,m)=>{if(ws.readyState!==1)return;try{ws.send(typeof m==='string'?m:JSON.stringify(m));}catch(e){}};
 const all=(m,except)=>{const json=JSON.stringify(m);plaza.forEach((q,ws)=>{if(ws!==except&&q.i)send(ws,json);});};
 const card=q=>({i:q.i,f:q.id.slice(2,12),n:q.n,l:q.l,pet:q.pet,p:q.p,sw:q.sw,nw:q.nw,level:q.level});
 const spawn=()=>{const a=Math.random()*Math.PI*2,r=Math.sqrt(Math.random())*9;return [Math.sin(a)*r,0,Math.cos(a)*r,0,0];};
 function identity(key){
  const auth=getAuth(),session=auth.authenticate(key);
  if(!session&&!/^[a-f0-9]{48}$/.test(key))return null;
  const id=session?session.id:idOf(key);
  if(!session&&auth.username(id))return null;
  const w=account(id);
  return {id,n:(w.name||auth.username(id)||'Guest').slice(0,12),l:w.look||{},pet:w.pet||'',sw:core.swag(w),nw:core.worth(w),level:core.progressOf(w).level};
 }
 function receive(ws,raw){
  const q=plaza.get(ws);if(!q)return;
  let msg;try{msg=JSON.parse(raw);}catch(e){return;}
  if(!msg||typeof msg!=='object'||Array.isArray(msg))return;
  if(!q.i){
   if(typeof msg.hello!=='string')return;
   const who=identity(msg.hello);
   if(!who){send(ws,{error:'Sign in again to enter the lobby.'});return ws.close();}
   if([...plaza.values()].filter(p=>p.i).length>=80){send(ws,{error:'Lobby is full.'});return ws.close();}
   const back=Array.isArray(msg.at)&&msg.at.length>=3&&msg.at.slice(0,3).every(Number.isFinite)
    ?[clamp(msg.at[0]),0,clamp(msg.at[1]),msg.at[2]%(Math.PI*2),0]:null;
   Object.assign(q,who,{i:'w'+(++sequence),p:back||spawn(),lastAt:Date.now(),participationAt:Date.now(),moved:false});
   send(ws,{you:q.i,admin:isAdmin(q),world:{zom:false,wild:false,gift:false,forage:false},all:[...plaza.values()].filter(o=>o.i&&o!==q).map(card),ents:[],testBetrayal:testEnabled&&isAdmin(q)});
   all({join:card(q)},ws);return;
  }
  if(Array.isArray(msg.p)&&msg.p.length===5&&msg.p.every(Number.isFinite)){
   const now=Date.now(),np=[clamp(msg.p[0]),Math.max(0,Math.min(12,msg.p[1])),clamp(msg.p[2]),msg.p[3]%(Math.PI*2),msg.p[4]|0];
   const step=Math.hypot(np[0]-q.p[0],np[2]-q.p[2]),dt=Math.min(2,Math.max(.1,(now-(q.lastAt||now))/1000)),max=15*dt+3;
   if(step>max){const k=max/step;np[0]=q.p[0]+(np[0]-q.p[0])*k;np[2]=q.p[2]+(np[2]-q.p[2])*k;}
   if(step>.02&&now-(q.participationAt||now)>45000){
    const w=account(q.id);core.participate(w);w.t=now;markDirty();
    q.participationAt=now;q.level=core.progressOf(w).level;
    send(ws,{progress:core.progressOf(w)});all({level:[q.i,q.level]});
   }
   q.p=np;q.lastAt=now;q.moved=true;
  }else if(msg.restyle){
   const auth=getAuth(),w=account(q.id);
   Object.assign(q,{n:(w.name||auth.username(q.id)||'Guest').slice(0,12),l:w.look||{},pet:w.pet||'',sw:core.swag(w),nw:core.worth(w),level:core.progressOf(w).level});
   all({look:card(q)});
  }else if(typeof msg.emote==='string'&&/^(wave|dance|cheer|jump)$/.test(msg.emote)){
   const now=Date.now();if(now-(q.lastEmote||0)<700)return;q.lastEmote=now;
   all({emote:{i:q.i,e:msg.emote}});
  }else if(testEnabled&&msg.testBetrayal&&isAdmin(q)){
   const now=Date.now();if(now-(q.lastTest||0)<5000)return;q.lastTest=now;
   const target=[...plaza.values()].find(x=>x.i===msg.testBetrayal.target&&x!==q&&x.i);
   if(!target)return send(ws,{testBetrayal:{error:'Player unavailable.'}});
   send(ws,{testBetrayal:{target:target.i,success:Math.random()<.35,dryRun:true,itemsLost:0,goldLost:0}});
  }
  // All legacy trade, shoot, travel, weapon and world-admin messages are ignored.
 }
 setInterval(()=>{
  const rows=[];plaza.forEach(q=>{if(q.i&&q.moved){q.moved=false;rows.push([q.i,...q.p.map(v=>Math.round(v*100)/100)]);}});
  if(rows.length)all({s:rows});
 },100).unref();
 setInterval(()=>{
  const seen=new Set();
  plaza.forEach((q,ws)=>{if(!q.i||seen.has(q.id))return;seen.add(q.id);
   const w=account(q.id);send(ws,{gold:w.coins,rate:0,progress:core.progressOf(w)});});
 },5000).unref();
 setInterval(()=>plaza.forEach((q,ws)=>{
  if(!ws.alive){try{ws.terminate();}catch(e){}return;}ws.alive=false;try{ws.ping();}catch(e){}
 }),15000).unref();
 server.on('upgrade',(req,socket,head)=>{
  let pathname;try{pathname=new URL(req.url,'http://x').pathname;}catch(e){return socket.destroy();}
  if(pathname!=='/api/plaza/ws')return socket.destroy();
  wss.handleUpgrade(req,socket,head,ws=>{
   plaza.set(ws,{});let count=0,since=Date.now();ws.alive=true;
   ws.on('pong',()=>{ws.alive=true;});
   ws.on('message',d=>{
    const m=String(d);if(m==='ping')return send(ws,'pong');
    const now=Date.now();if(now-since>1000){count=0;since=now;}if(++count>40)return;
    try{receive(ws,m);}catch(e){console.error('plaza',e?.stack||e);}
   });
   ws.on('close',()=>{const q=plaza.get(ws);plaza.delete(ws);if(q?.i)all({leave:q.i});});
   ws.on('error',()=>{});
  });
 });
 return plaza;
}
