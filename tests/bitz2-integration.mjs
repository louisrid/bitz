import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {setTimeout as delay} from 'node:timers/promises';
import {fileURLToPath} from 'node:url';
import {mkdtempSync,rmSync} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import WebSocket from 'ws';
const root=fileURLToPath(new URL('../',import.meta.url));
const dir=mkdtempSync(path.join(os.tmpdir(),'bitz2-qa-'));
let data=null,writes=0,child=null,logs='';
const cloud=createServer(async(req,res)=>{
 res.setHeader('Content-Type','application/json');
 const url=new URL(req.url,'http://qa');if(url.pathname!=='/rest/v1/stakkz_state'){res.writeHead(404);return res.end('{}');}
 if(req.method==='GET')return res.end(JSON.stringify(data?[{state:data}]:[]));
 if(req.method==='POST'){let str='';for await(const b of req)str+=b;data=JSON.parse(str)[0].state;writes++;res.writeHead(201);return res.end('{}');}
 res.writeHead(405);res.end('{}');
});
async function ephemeralPort(){const s=createServer();s.listen(0,'127.0.0.1');await once(s,'listening');const p=s.address().port;await new Promise(ok=>s.close(ok));return p;}
const closeCloud=()=>new Promise(ok=>cloud.close(ok));
let port,base;
async function start(){
 child=spawn(process.execPath,['server.js'],{cwd:root,env:{...process.env,PORT:String(port),DATA_FILE:path.join(dir,'save.json'),STAKKZ_SECRET:'bitz2-qa-persistent-secret',STAKKZ_STORE_URL:'http://127.0.0.1:'+cloud.address().port+'/rest/v1/stakkz_state',STAKKZ_STORE_KEY:'test-key',BITZ_TEST_BETRAYAL:'1',STAKKZ_ADMINS:'louis'}});
 child.stdout.on('data',b=>logs+=b.toString());child.stderr.on('data',b=>logs+=b.toString());
 for(let n=0;n<100;n++){if(child.exitCode!==null)throw Error('Server crashed: '+logs);
  try{const r=await fetch(base+'/api/ping');if(r.ok){const j=await r.json();assert.equal(j.persistent,true);return;}}catch(e){}await delay(100);
 }throw Error('Server failed to start: '+logs);
}
async function stop(){
 if(!child)return;const c=child;child=null;
 if(c.exitCode===null){c.kill('SIGTERM');await Promise.race([once(c,'exit'),delay(4500).then(()=>{if(c.exitCode===null)c.kill('SIGKILL');})]);}
}
async function api(p,key='',body){
 const response=await fetch(base+'/api/'+p,{method:body===undefined?'GET':'POST',headers:{Authorization:'Bearer '+key,...(body===undefined?{}:{'Content-Type':'application/json'})},body:body===undefined?undefined:JSON.stringify(body)});
 return {status:response.status,...await response.json()};
}
function waitFor(ws,choose,ms=4000){
 return new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>{cleanup();reject(Error('WebSocket timed out'));},ms);
  const receive=d=>{let j;try{j=JSON.parse(String(d));}catch(e){return;}if(choose(j)){cleanup();resolve(j);}};
  const close=()=>{cleanup();reject(Error('WebSocket closed'));};
  const cleanup=()=>{clearTimeout(timer);ws.off('message',receive);ws.off('close',close);};
  ws.on('message',receive);ws.on('close',close);
 });
}
async function connect(key){
 const ws=new WebSocket('ws://127.0.0.1:'+port+'/api/plaza/ws');
 await once(ws,'open');const opened=waitFor(ws,j=>j.you);
 ws.send(JSON.stringify({hello:key}));return {ws,hello:await opened};
}
cloud.listen(0,'127.0.0.1');
await once(cloud,'listening');port=await ephemeralPort();base='http://127.0.0.1:'+port;
try{
 await start();
 const g1='a'.repeat(48),g2='b'.repeat(48);
 const one=await api('auth/register',g1,{username:'louis',password:'secret-qa-test'});
 const two=await api('auth/register',g2,{username:'bobqa',password:'secret-qa-test'});
 assert.equal(one.status,200);assert.equal(two.status,200);
 const first=await api('me',one.token),second=await api('me',two.token);
 assert.equal(first.status,200);assert.equal(second.status,200);
 assert.equal(first.wallet.boxes,1);
 const friend=await api('friends',one.token);assert.ok(friend.friends.some(f=>f.u==='bobqa'));
 const f=friend.friends.find(f=>f.u==='bobqa');
 assert.equal((await api('friends',one.token,{op:'remove',friend:f.f})).status,200);
 assert.ok((await api('friends',one.token)).hidden.some(x=>x.u==='bobqa'));
 assert.equal((await api('friends',one.token,{op:'restore',friend:f.f})).status,200);
 assert.equal((await api('party',one.token)).status,410);
 assert.equal((await api('clan',one.token)).status,410);
 const purchase=await api('shop',one.token,{op:'buy',item:'cat'});
 assert.equal(purchase.status,200,JSON.stringify(purchase));
 assert.ok(purchase.wallet.own.includes('cat'));
 assert.equal((await api('shop',one.token,{op:'buy',item:'g_pulse'})).status,400);
 const style=await api('me',one.token,{name:'louis',look:{skin:2,hair:'short',hc:0,outfit:'tee',bg:'paper'},pet:'cat'});
 assert.equal(style.status,200);assert.equal(style.wallet.pet,'cat');
 const prize=await api('shop',one.token,{op:'open',item:'season'});
 assert.equal(prize.status,200,JSON.stringify(prize));assert.ok(prize.prize.item);
 assert.ok(prize.wallet.own.includes(prize.prize.item));assert.equal(prize.wallet.boxes,0);
 assert.ok(prize.progress.xp>=60);
 assert.equal((await api('shop',one.token,{op:'open',item:'season'})).status,400);
 const a=await connect(one.token);
 const b=await connect(two.token);
 assert.ok(b.hello.all.some(x=>x.pet==='cat'));
 const moved=waitFor(b.ws,j=>Array.isArray(j.s)&&j.s.some(x=>x[0]===a.hello.you));
 a.ws.send(JSON.stringify({p:[2,0,2,0,0]}));await moved;
 const experiment=waitFor(a.ws,j=>j.testBetrayal);
 a.ws.send(JSON.stringify({testBetrayal:{target:b.hello.you}}));
 const trial=await experiment;assert.equal(trial.testBetrayal.dryRun,true);assert.equal(trial.testBetrayal.itemsLost,0);
 a.ws.send(JSON.stringify({trade:{op:'ask',to:b.hello.you},shoot:true,wpn:1,admin:{k:'zom',on:true}}));
 const inventory=await api('inv/'+one.id.slice(2,12),two.token);
 assert.equal(inventory.status,200);assert.ok(inventory.own.includes('cat'));assert.ok(inventory.own.includes(prize.prize.item));
 a.ws.close();b.ws.close();await delay(100);
 const secondDevice=await api('auth/login','',{username:'louis',password:'secret-qa-test'});
 assert.equal(secondDevice.status,200);
 await stop();assert.ok(writes>0,'Cloud data not persisted');
 await start();
 const restored=await api('me',secondDevice.token);
 assert.equal(restored.status,200,JSON.stringify(restored));
 assert.ok(restored.wallet.own.includes('cat'));assert.ok(restored.wallet.own.includes(prize.prize.item));
 assert.equal(restored.wallet.pet,'cat');
 assert.ok(restored.progress.xp>=60);
 assert.equal((await api('auth/login','',{username:'bobqa',password:'secret-qa-test'})).status,200);
 console.log('PASS auth, cross-device persistence, shop, loot, pets, profiles, friends, movement, admin dry-run, archived API routes');
}finally{await stop();await closeCloud();rmSync(dir,{recursive:true,force:true});}
if(logs.includes('uncaught'))throw Error('Server logged uncaught error: '+logs);
console.log('BITZ 2.0 API and multiplayer integration complete');
