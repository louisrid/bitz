import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { AccountAuth } from '../src/auth.js';

let changes = 0;
const auth = new AccountAuth(null, () => { changes++; });
assert.throws(
  () => auth.register('NewWeak', 'short', 'g_weak'),
  /at least 10 characters/,
  'new signups must reject weak passwords'
);
assert.throws(
  () => auth.register('NewWeak', '123456789', 'g_weak'),
  /at least 10 characters/,
  'new signups must reject nine-character passwords'
);
const account = auth.register('CollectorOne', 'StrongPass123', 'g_collector');
assert.equal(account.username, 'CollectorOne');
assert.ok(/^s_[a-f0-9]{64}$/.test(account.token));
assert.equal(auth.authenticate(account.token)?.id, 'g_collector');
assert.equal(auth.login('collectorone', 'StrongPass123').id, 'g_collector');
assert.throws(() => auth.login('collectorone', 'WrongPass123'), /Incorrect username or password/);
assert.throws(() => auth.register('collectorone','AnotherPass123','g_duplicate'), /already taken/);
auth.logout(account.token);
assert.equal(auth.authenticate(account.token), null);

// Accounts registered under the earlier three-character rule remain usable.
// Do not invalidate saved accounts during a release-security improvement.
const legacySalt = crypto.randomBytes(16).toString('hex');
const legacyHash = crypto.scryptSync('old', legacySalt, 64, {N:16384,r:8,p:1}).toString('hex');
const previous = new AccountAuth({users:{
  oldcollector:{id:'g_legacy',username:'OldCollector',salt:legacySalt,hash:legacyHash}
}},()=>{});
assert.equal(previous.login('OldCollector','old').id,'g_legacy');
assert.ok(changes > 0);
console.log('BITZ authentication launch-safety checks PASS');
