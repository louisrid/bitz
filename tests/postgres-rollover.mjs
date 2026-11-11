import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {setTimeout as delay} from 'node:timers/promises';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const folder=fs.mkdtempSync(path.join(os.tmpdir(),'stakkz-pg-'));
const url=process.env.STAKKZ_DATABASE_URL;
assert(url?.startsWith('postgres'),'A dedicated test PostgreSQL URL is required');
const running=[];
async function unusedPort(){
  const server=createServer();server.listen(0,'127.0.0.1');await once(server,'listening');
  const port=server.address().port;await new Promise(r=>server.close(r));return port;
}
async function start(label) {
  const port=await unusedPort(), logs=[];
  const child=spawn(process.execPath,['server.js'],{
    cwd:root,env:{...process.env,PORT:String(port),STAKKZ_SECRET:'postgres-rolling-deploy-test-secret',
      DATA_FILE:path.join(folder,label+'.json'),STAKKZ_STORE_URL:'',STAKKZ_STORE_KEY:''}
  });
  child.stdout.on('data',b=>logs.push(b.toString()));
  child.stderr.on('data',b=>logs.push(b.toString()));
  const app={port,child,logs};running.push(app);
  for(let i=0;i<150;i++){
    if(child.exitCode!==null)throw Error(label+' exited: '+logs.join(''));
    try{
      const r=await fetch('http://127.0.0.1:'+port+'/api/ping');
      if(r.ok){const j=await r.json();if(j.persistent)return app;}
    }catch(e){}
    await delay(100);
  }
  throw Error(label+' did not boot: '+logs.join(''));
}
async function api(app,p,token,body){
  const r=await fetch('http://127.0.0.1:'+app.port+'/api/'+p,{
    method:body===undefined?'GET':'POST',
    headers:{Authorization:'Bearer '+(token||''),'Content-Type':'application/json'},
    body:body===undefined?undefined:JSON.stringify(body)});
  return {status:r.status,...await r.json()};
}
async function stop(app){
  if(app.child.exitCode===null) {
    app.child.kill('SIGTERM');
    await Promise.race([once(app.child,'exit'),delay(4500)]);
    if(app.child.exitCode===null)app.child.kill('SIGKILL');
  }
}
try {
  const old=await start('old');
  const oldSignup=await api(old,'auth/register','a'.repeat(48),{username:'RolloverOne',password:'StrongTestPassword-A1'});
  assert.equal(oldSignup.status,200,JSON.stringify(oldSignup));
  const next=await start('next');
  assert.equal((await api(next,'auth/login','',{username:'RolloverOne',password:'StrongTestPassword-A1'})).status,200);
  const second=await api(next,'auth/register','b'.repeat(48),{username:'RolloverTwo',password:'StrongTestPassword-B2'});
  assert.equal(second.status,200,JSON.stringify(second));
  // Simulate stale outgoing instance receiving a last-minute write while the
  // newer process has already committed changes to the shared Postgres row.
  const stale=await api(old,'auth/register','c'.repeat(48),{username:'RolloverStale',password:'StrongTestPassword-C3'});
  assert.equal(stale.status,503,'Outdated process must refuse to overwrite newer state');
  await stop(old);await stop(next);
  const restarted=await start('restart');
  for(const item of [
    {username:'RolloverOne',password:'StrongTestPassword-A1'},
    {username:'RolloverTwo',password:'StrongTestPassword-B2'}
  ]) {
    const result=await api(restarted,'auth/login','',item);
    assert.equal(result.status,200,'User not retained after rolling deploy: '+item.username);
  }
  assert.equal((await api(restarted,'auth/login','',{username:'RolloverStale',password:'StrongTestPassword-C3'})).status,400);
  console.log('Real PostgreSQL: rolling deployment refuses stale writes and preserves both new accounts through server restart.');
} finally {
  for(const app of running)await stop(app);
  fs.rmSync(folder,{recursive:true,force:true});
}
