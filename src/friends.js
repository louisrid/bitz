/* Friends: requests, acceptance and a list with presence. Nothing is automatic: a friend is someone who said yes. */
import { CardError } from './cards.js';
const refuse = m => { throw new CardError(m); };
export function createFriends({ accounts, auth, markDirty, online, nameOf, find, progressOf, worthOf }) {
  const fr = w => { if (!w.fr || typeof w.fr !== 'object') w.fr = { a: [], in: [], out: [] }; for (const k of ['a', 'in', 'out']) if (!Array.isArray(w.fr[k])) w.fr[k] = []; return w.fr; };
  const drop = (arr, id) => { const i = arr.indexOf(id); if (i >= 0) arr.splice(i, 1); };
  const row = (id, extra) => { const w = accounts.get(id); if (!w) return null; return Object.assign({ code: id.slice(2, 12), name: nameOf(id), user: auth.username(id) || '', level: progressOf(w).level, nw: worthOf(w), look: w.look || {}, pet: w.pet || '', online: online().includes(id), seen: w.t || 0 }, extra || {}); };
  function request(id, code) {
    const other = find(code); if (!other || other === id) refuse('Player not found.');
    if (!auth.username(id)) refuse('Sign up or sign in to add friends.');
    const me = fr(accounts.get(id)), them = fr(accounts.get(other));
    if (me.a.includes(other)) refuse('You are already friends.');
    if (me.in.includes(other)) return accept(id, code);
    if (me.out.includes(other)) refuse('Request already sent.');
    if (me.out.length >= 50) refuse('Too many pending requests.');
    me.out.push(other); them.in.push(id); markDirty(); return { requested: other.slice(2, 12), toId: other };
  }
  function accept(id, code) {
    const other = find(code); if (!other) refuse('Player not found.');
    const me = fr(accounts.get(id)), them = fr(accounts.get(other));
    if (!me.in.includes(other)) refuse('No request from that player.');
    drop(me.in, other); drop(them.out, id); if (!me.a.includes(other)) me.a.push(other); if (!them.a.includes(id)) them.a.push(id); markDirty();
    return { accepted: other.slice(2, 12), toId: other };
  }
  function decline(id, code) { const other = find(code); if (!other) refuse('Player not found.'); const me = fr(accounts.get(id)), them = fr(accounts.get(other)); drop(me.in, other); drop(them.out, id); drop(me.out, other); drop(them.in, id); markDirty(); return { declined: other.slice(2, 12) }; }
  function remove(id, code) { const other = find(code); if (!other) refuse('Player not found.'); const me = fr(accounts.get(id)), them = fr(accounts.get(other)); drop(me.a, other); drop(them.a, id); markDirty(); return { removed: other.slice(2, 12) }; }
  function list(id) { const me = fr(accounts.get(id)); const rows = k => me[k].map(x => row(x)).filter(Boolean); const out = { friends: rows('a').sort((a, b) => (b.online ? 1 : 0) - (a.online ? 1 : 0) || b.seen - a.seen), in: rows('in'), out: rows('out') }; return out; }
  const status = (id, other) => { const me = fr(accounts.get(id)); return me.a.includes(other) ? 'friends' : me.in.includes(other) ? 'incoming' : me.out.includes(other) ? 'sent' : 'none'; };
  const ids = id => fr(accounts.get(id)).a.slice();
  return { request, accept, decline, remove, list, status, ids };
}
