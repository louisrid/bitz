import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {setTimeout as sleep} from 'node:timers/promises';

const base = 'https://stakkz-beta-test-20261111.onrender.com/api/';
const account = 'qa_' + crypto.randomBytes(6).toString('hex');
const password = 'QA-' + crypto.randomBytes(22).toString('hex');
const guest = crypto.randomBytes(24).toString('hex');
async function request(path, token, body) {
  const res = await fetch(base + path, {
    method: body === undefined ? 'GET' : 'POST',
    headers: {Authorization:'Bearer '+token,'Content-Type':'application/json'},
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(90000)
  });
  const value=await res.json();return {status:res.status,...value};
}
let ping, err;
for (let i=0; i<12; i++) {
  try { ping=await request('ping',''); if(ping.ok && ping.persistent) break; err=new Error('Not connected: '+JSON.stringify(ping)); }
  catch(e) {err=e;}
  await sleep(7500);
}
assert(ping?.persistent, 'The hosted beta is not running with persistent storage: '+String(err));
console.log('Real Render beta reports persistent storage is connected.');
const created = await request('auth/register',guest,{username:account,password});
assert.equal(created.status,200,'Signup failed: '+JSON.stringify({status:created.status,message:created.message}));
assert(created.token?.startsWith('s_'));
const authenticated = await request('auth/login',guest,{username:account,password});
assert.equal(authenticated.status,200,'Login failed: '+JSON.stringify({status:authenticated.status,message:authenticated.message}));
assert.equal(authenticated.id,created.id);
assert.equal((await request('auth/me',authenticated.token)).registered,true);
console.log('Live database signup, password verification and second-device account identity passed.');

const party=await request('party',created.token,{mode:25,bots:2,difficulty:'medium'});
assert.equal(party.status,200,'Party failed: '+JSON.stringify({status:party.status,message:party.message}));
assert.equal(party.state.players.length,3);
assert.equal(party.state.players.filter(p=>p.bot==='medium').length,2);
const code=party.state.code;
assert.equal((await request('my-party',authenticated.token)).code,code);
const game=await request('party/'+code,authenticated.token,{op:'start'});
assert.equal(game.status,200,'Game start failed: '+JSON.stringify({status:game.status,message:game.message}));
assert.equal(game.state.phase,'play');
console.log('Live database-backed AI party, game start and same-account rejoin passed.');
