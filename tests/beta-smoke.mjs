import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';
import { AccountAuth } from '../src/auth.js';
import * as core from '../src/core.js';
import { isBot, nextBotAction } from '../src/bots.js';

const html = fs.readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)];
assert(scripts.length > 0, 'browser inline script not found');
for (const [, script] of scripts) new vm.Script(script);
console.log('Browser inline JavaScript parses');

let changed = 0;
const auth = new AccountAuth({}, () => { changed++; });
const registration = auth.register('TestPlayer_01', 'LongMemorablePassword-42', 'p_test');
assert(registration.token.startsWith('s_'));
assert.equal(auth.login('testplayer_01', 'LongMemorablePassword-42').id, 'p_test');
assert.equal(auth.authenticate(registration.token).id, 'p_test');
assert.throws(() => auth.login('testplayer_01','wrongpassword'));
assert.throws(() => auth.register('TestPlayer_01','another_long_password','p_other'));
auth.logout(registration.token);
assert.equal(auth.authenticate(registration.token), null);
assert(changed >= 3);
console.log('Username/password registration, login and session revocation pass');

const now = Date.now();
const human = { id:'p_human',name:'Human',look:{skin:0,hair:'short'},pet:'' };
const made = core.partyOp(null,'create',human,{mode:25,bots:3,difficulty:'hard'},now,'ABCD');
const lobby = made.state;
assert.equal(lobby.players.length,4);
assert.equal(lobby.players.filter(isBot).length,3);
assert(lobby.players.filter(isBot).every(p => p.bot === 'hard'));
const started = core.partyOp(lobby,'start',human,{},now+100,'ABCD');
assert.equal(started.state.phase,'play');
const maybeBot = nextBotAction(started.state);
if (maybeBot) {
  assert.equal(maybeBot.id.startsWith('bot:ABCD:'),true);
  const next = core.partyOp(started.state,'act',{id:maybeBot.id}, {a:maybeBot.a},now+1500,'ABCD');
  assert(next.state.v > started.state.v, 'bot must advance game state');
}
assert.throws(()=>core.partyOp(started.state,'act',{id:'p_intruder'}, {a:{t:'roll'}},now+2000,'ABCD'));
console.log('Server-side bot seating, game start, optional bot turn and access control pass');
