/* Stakkz beta account auth. Usernames and passwords; no emails or IP identity.
   A successful sign-in issues a random, revocable bearer session for each device.
   Passwords are salted and scrypt-hashed; raw tokens never enter persistent storage. */
import crypto from 'node:crypto';
const USERNAME = /^[a-zA-Z0-9_]{3,20}$/;
const SESSION_LIFE = 60 * 24 * 60 * 60 * 1000;
const hashToken = t => crypto.createHash('sha256').update(t).digest('hex');
const passwordHash = (pass, salt) => crypto.scryptSync(pass, salt, 64, { N: 16384, r: 8, p: 1 }).toString('hex');
function checkPassword(pass) {
  return typeof pass === 'string' && pass.length >= 10 && pass.length <= 128;
}
export class AccountAuth {
  constructor(saved, changed) {
    const data = saved && typeof saved === 'object' ? saved : {};
    this.users = new Map(Object.entries(data.users || {}));
    this.sessions = new Map(Object.entries(data.sessions || {}));
    this.changed = changed;
  }
  export() {
    return { users: Object.fromEntries(this.users), sessions: Object.fromEntries(this.sessions) };
  }
  username(id) {
    for (const v of this.users.values()) if (v.id === id) return v.username;
    return null;
  }
  authenticate(token) {
    if (typeof token !== 'string' || !/^s_[a-f0-9]{64}$/.test(token)) return null;
    const k = hashToken(token), s = this.sessions.get(k);
    if (!s) return null;
    if (s.until <= Date.now()) { this.sessions.delete(k); this.changed(); return null; }
    return { id: s.id, username: this.username(s.id) };
  }
  newSession(id) {
    const token = 's_' + crypto.randomBytes(32).toString('hex');
    // Limit retained sessions. Multiple devices remain signed in concurrently.
    const mine = [...this.sessions.entries()].filter(([,v]) => v.id === id).sort((a,b)=>a[1].until-b[1].until);
    while (mine.length >= 8) this.sessions.delete(mine.shift()[0]);
    this.sessions.set(hashToken(token), { id, until: Date.now() + SESSION_LIFE });
    this.changed();
    return token;
  }
  register(username, password, guestId) {
    username = String(username || '').trim();
    if (!USERNAME.test(username)) throw new Error('Use 3–20 letters, numbers or underscores for your username.');
    if (!checkPassword(password)) throw new Error('Use a password of 10–128 characters.');
    const key = username.toLowerCase();
    if (this.users.has(key)) throw new Error('That username is already taken.');
    if (this.username(guestId)) throw new Error('This player already has an account. Sign in instead.');
    const salt = crypto.randomBytes(16).toString('hex');
    this.users.set(key, { id: guestId, username, salt, hash: passwordHash(password,salt) });
    this.changed();
    return { token: this.newSession(guestId), username, id: guestId };
  }
  login(username, password) {
    const rec = this.users.get(String(username || '').trim().toLowerCase());
    // Hash a dummy value too so a missing username is not a cheap timing oracle.
    const salt = rec ? rec.salt : '00000000000000000000000000000000';
    const found = passwordHash(typeof password === 'string' ? password.slice(0,128) : '', salt);
    if (!rec || typeof password !== 'string' || password.length > 128 ||
      !crypto.timingSafeEqual(Buffer.from(found,'hex'),Buffer.from(rec.hash,'hex')))
      throw new Error('Incorrect username or password.');
    return { token: this.newSession(rec.id), username: rec.username, id: rec.id };
  }
  logout(token) {
    if (this.sessions.delete(hashToken(String(token)))) this.changed();
  }
}
