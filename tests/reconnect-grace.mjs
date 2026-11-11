import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createServer} from 'node:http';
import {once} from 'node:events';
import crypto from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../',import.meta.url));
let state=null;
const cloud=createServer(async(req,res)=>{
  res.setHeader('Content-Type','application/json');
  if(req.method==='GET')return res.end(JSON.stringify(state?[{state}]:[]));
  if(req.method==='POST'){let body='';for await(const chunk of req)body+=chunk;
    state=JSON.parse(body)[0].state;res.writeHead(201);return res.end('{}');}
  res.writeHead(405);res.end();
});
cloud.listen(0,'127.0.0.1');await once(cloud,'listening');
const unused=createServer();unused.listen(0,'127.0.0.1');await once(unused,'listening');
const port=unused.address().port;await new Promise(resolve=>unused.close(resolve));
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'stakkz-grace-'));
let logs='',child;
const base='http://127.0.0.1:'+port+'/api/';
const guest=crypto.randomBytes(24).toString('hex');
const username='grace_'+crypto.randomBytes(4).toString('hex');
const password='TestPasswordLong'+crypto.randomBytes(8).toString('hex');
async function request(p,token,body){
  const resp=await fetch(base+p,{method:body===undefined?'GET':'POST',
    headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
    body:body===undefined?undefined:JSON.stringify(body)});
  return {status:resp.status,...await resp.json()};
}
try {
  child=spawn(process.execPath,['server.js'],{cwd:root,env:{...process.env,
    NODE_ENV:'test',STAKKZ_TEST_GRACE_MS:'4000',PORT:String(port),
    STAKKZ_SECRET:'grace-test-only',DATA_FILE:path.join(dir,'data.json'),
    STAKKZ_STORE_URL:'http://127.0.0.1:'+cloud.address().port+'/rest/v1/stakkz_state',
    STAKKZ_STORE_KEY:'test-cloud-only'}});
  child.stdout.on('data',b=>logs+=b.toString());
  child.stderr.on('data',b=>logs+=b.toString());
  let ready=false;for(let i=0;i<90;i++){if(child.exitCode!==null)throw Error('Server terminated: '+logs);
    try{const r=await request('ping','');if(r.ok){ready=true;break;}}catch(e){}await delay(100);}
  assert(ready,'server did not start: '+logs);
  const registered=await request('auth/register',guest,{username,password});
  assert.equal(registered.status,200,JSON.stringify(registered));
  const room=await request('party',registered.token,{bots:2,difficulty:'medium',mode:25});
  assert.equal(room.status,200);
  const code=room.state.code;
  assert.equal((await request('party/'+code,registered.token,{op:'start'})).status,200);
  await delay(2350);
  // Phone has gone offline. A laptop authenticates as the same player before
  // the four-second accelerated grace expires.
  const laptop=await request('auth/login','', {username,password});
  assert.equal(laptop.status,200);
  assert.equal(laptop.id,registered.id);
  assert.equal((await request('my-party',laptop.token)).code,code);
  await delay(2350);
  const alive=(await request('party/'+code,'')).state;
  assert(alive.players.some(p=>p.id===registered.id&&!p.out),
    'Rejoining from second device must keep the player in the game');
  console.log('A second device reclaimed the active seat inside the grace period.');
  // Do not call an authenticated endpoint here: that would reset presence.
  await delay(5000);
  const expired=(await request('party/'+code,'')).state;
  assert(expired,'bot seats should continue independently after player timeout');
  const p=expired.players.find(p=>p.id===registered.id);
  assert(p?.out,'Server should forfeit a disconnected player after the grace period');
  assert.equal((await request('my-party',laptop.token)).code,null);
  console.log('Offline player was removed when the grace elapsed; account and bot game survive.');
  console.log('Production grace stays hardcoded to 120 seconds; 4 seconds is test-only.');
} finally {
  if(child?.exitCode===null){child.kill('SIGTERM');await Promise.race([once(child,'exit'),delay(4500)]);}
  if(child?.exitCode===null)child.kill('SIGKILL');
  await new Promise(resolve=>cloud.close(resolve));
  fs.rmSync(dir,{recursive:true,force:true});
}
