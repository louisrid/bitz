import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';

const root = fileURLToPath(new URL('../', import.meta.url));
const cloud = { state:null, writes:0 };
const storage = createServer(async (req,res) => {
  const u = new URL(req.url,'http://local');
  if(u.pathname!=='/rest/v1/stakkz_state') {res.writeHead(404);res.end();return;}
  res.setHeader('Content-Type','application/json');
  if(req.method==='GET') return res.end(JSON.stringify(cloud.state?[{state:cloud.state}]:[]));
  if(req.method==='POST') {
    let b='';for await (const chunk of req)b+=chunk;
    const rows=JSON.parse(b);cloud.state=rows[0].state;cloud.writes++;
    res.writeHead(201);res.end('{}');return;
  }
  res.writeHead(405);res.end();
});
storage.listen(0,'127.0.0.1');await once(storage,'listening');
const cloudPort=storage.address().port;
const hold = createServer();hold.listen(0,'127.0.0.1');await once(hold,'listening');
const port=hold.address().port;await new Promise(r=>hold.close(r));
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'stakkz-beta-'));
let child=null, logs='';
const base='http://127.0.0.1:'+port;
async function start() {
  child=spawn(process.execPath,['server.js'],{
    cwd:root,
    env:{...process.env,PORT:String(port),STAKKZ_SECRET:'beta-test-stable-key-2000',
      STAKKZ_STORE_URL:'http://127.0.0.1:'+cloudPort+'/rest/v1/stakkz_state',
      STAKKZ_STORE_KEY:'test-only-cloud-key',DATA_FILE:path.join(dir,'state.json')}
  });
  child.stdout.on('data',b=>{logs+=b.toString();});child.stderr.on('data',b=>{logs+=b.toString();});
  for(let n=0;n<80;n++) {
    if(child.exitCode!==null) throw Error('Stakkz server exited early: '+logs);
    try {const r=await fetch(base+'/api/ping'); if(r.ok){const j=await r.json();assert.equal(j.persistent,true);return;}}catch(e){}
    await delay(100);
  }
  throw Error('Stakkz server did not start: '+logs);
}
async function stop() {
  if(!child)return;const prior=child;child=null;
  if(prior.exitCode===null){prior.kill('SIGTERM');await Promise.race([once(prior,'exit'),delay(5000)]);}
  if(prior.exitCode===null)prior.kill('SIGKILL');
}
async function request(path,key,body) {
  const r=await fetch(base+'/api/'+path,{method:body===undefined?'GET':'POST',
    headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},
    body:body===undefined?undefined:JSON.stringify(body)});
  const j=await r.json();return {status:r.status,...j};
}
try {
  await start();
  const guestA='a'.repeat(48),guestB='b'.repeat(48),other='c'.repeat(48);
  const before=await request('me',guestA);
  assert.equal(before.status,200);assert.equal(before.fresh,true);
  const registered=await request('auth/register',guestA,{username:'BetaAlice',password:'CorrectHorsePassword123'});
  assert.equal(registered.status,200,JSON.stringify(registered));
  assert(registered.token.startsWith('s_'));
  assert.equal((await request('me',guestA)).status,401,'registered account must reject old guest key');
  const bad=await request('auth/login',guestB,{username:'BetaAlice',password:'not-right'});
  assert.equal(bad.status,400);
  const laptop=await request('auth/login',guestB,{username:'betaalice',password:'CorrectHorsePassword123'});
  assert.equal(laptop.status,200,JSON.stringify(laptop));
  assert.equal(laptop.id,registered.id,'phone and laptop must reference the same account');
  const me=await request('me',laptop.token);
  assert.equal(me.status,200);assert.equal(me.id,registered.id);
  // Leaving a bot-only lobby must delete it, not leave an AI as host.
  const botOnly=await request('party',other,{mode:25,bots:2,difficulty:'easy'});
  assert.equal(botOnly.status,200);
  const botOnlyCode=botOnly.state.code;
  assert.equal((await request('party/'+botOnlyCode,other,{op:'leave'})).status,200);
  assert.equal((await request('party/'+botOnlyCode,other)).state,null,'bot-only abandoned lobby must close');
  // If the human host leaves but another human stays, give that human the seat
  // at index 0. Keep AI players after humans so only a human can start.
  const host='d'.repeat(48),friend='e'.repeat(48);
  const transfer=await request('party',host,{mode:25,bots:2,difficulty:'medium'});
  const transferCode=transfer.state.code;
  assert.equal((await request('party/'+transferCode,friend,{op:'join'})).status,200);
  const handoff=await request('party/'+transferCode,host,{op:'leave'});
  assert.equal(handoff.status,200);
  assert.equal(handoff.state.players[0].id,(await request('me',friend)).id,'host should transfer to remaining human');
  assert.equal(handoff.state.players.filter(p=>p.bot).length,2);
  assert.equal((await request('party/'+transferCode,friend,{op:'start'})).state.phase,'play');
  console.log('Leaving bot-only lobby and human host handoff passed.');
  // Real HTTP API: a host, four server-controlled bots and one friend must
  // form six distinct seats with purchased deeds and adaptive 30s turns.
  const sixHost='f'.repeat(48),sixFriend='1'.repeat(48);
  const sixRoom=await request('party',sixHost,{mode:35,bots:4,difficulty:'hard'});
  assert.equal(sixRoom.status,200);
  assert.equal(sixRoom.state.players.length,5);
  const sixCode=sixRoom.state.code;
  const sixJoined=await request('party/'+sixCode,sixFriend,{op:'join'});
  assert.equal(sixJoined.status,200);
  assert.equal(sixJoined.state.players.length,6);
  assert.equal(sixJoined.state.max,6);
  const sixStarted=await request('party/'+sixCode,sixHost,{op:'start'});
  assert.equal(sixStarted.status,200,JSON.stringify(sixStarted));
  assert.equal(sixStarted.state.phase,'play');
  assert.equal(sixStarted.state.timer,30);
  assert.equal(Object.keys(sixStarted.state.own).length,12);
  assert(sixStarted.state.players.every((p,i)=>{
    const deeds=Object.entries(sixStarted.state.own).filter(([,o])=>o.o===i);
    return deeds.length===2;
  }));
  console.log('Six-player HTTP lobby, live server bots, fair paid opening deeds and adaptive timer passed.');
  const room=await request('party',registered.token,{mode:25,bots:2,difficulty:'hard'});
  assert.equal(room.status,200,JSON.stringify(room));
  assert.equal(room.state.players.length,3);
  assert.equal(room.state.players.filter(p=>p.bot==='hard').length,2);
  const code=room.state.code;
  assert.equal((await request('my-party',laptop.token)).code,code);
  assert.equal((await request('my-party',other)).code,null);
  const started=await request('party/'+code,registered.token,{op:'start'});
  assert.equal(started.status,200,JSON.stringify(started));assert.equal(started.state.phase,'play');
  assert.equal((await request('heartbeat',laptop.token,{})).status,200);
  await delay(4500);
  assert(cloud.writes>0,'persistent cloud snapshot was not saved');
  assert(cloud.state.accounts[registered.id],'account must be stored');
  assert(cloud.state.parties[code],'party must be stored');
  assert(cloud.state.auth.users.betaalice,'password account must be stored');
  await stop();
  await start();
  const restored=await request('auth/me',laptop.token);
  assert.equal(restored.status,200);
  assert.equal(restored.registered,true);
  assert.equal((await request('my-party',laptop.token)).code,code);
  assert.equal((await request('party/'+code,laptop.token)).state.phase,'play');
  console.log('Persistent auth, separate-device sign-in, bots, active-game resume and restart recovery all passed');
} finally {
  await stop();
  await new Promise(r=>storage.close(r));
  fs.rmSync(dir,{recursive:true,force:true});
}
