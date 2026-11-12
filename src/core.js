/* Accounts: the wallet shape, profile (name, look, pet) and the cosmetics shop. Cards, cash earning and net worth live in cards.js. */
import { ITEMS, HAIRS } from './shop.js';
import { progressOf, awardXP } from './progression.js';
export { ITEMS, progressOf };
const int = (v, lo, hi) => Math.max(lo, Math.min(hi, Math.floor(Number(v) || 0)));
export class Refused extends Error {}
const refuse = m => { throw new Refused(m); };
export function freshWallet() {
  return { v: 3, t: 0, coins: 0, xp: 0, level: 1, own: [], stats: { earned: 0 }, name: '', look: { skin: 0, hair: 'short', hc: 0, outfit: 'tee', hat: '', acc: '', bg: 'paper' }, pet: '' };
}
const owns = (w, id) => !!ITEMS[id] && (ITEMS[id][2] === 0 || (w.own || []).includes(id));
export function setProfile(w, b = {}) {
  if (typeof b.name === 'string') w.name = b.name.replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 12);
  const l = b.look && typeof b.look === 'object' ? b.look : (w.look || {}), out = { skin: int(l.skin, 0, 4), hc: int(l.hc, 0, 6), hair: 'short', outfit: 'tee', hat: '', acc: '', bg: 'paper' };
  if (HAIRS.includes(l.hair)) out.hair = l.hair;
  ['outfit', 'hat', 'acc', 'bg'].forEach(k => { const id = l[k]; if (typeof id === 'string' && id && owns(w, id) && ITEMS[id][0] === k) out[k] = id; });
  if (out.hc > 3 && !owns(w, 'dye')) out.hc = 0;
  w.look = out; const pet = typeof b.pet === 'string' ? b.pet : w.pet;
  w.pet = pet && owns(w, pet) && ITEMS[pet][0] === 'pet' ? pet : '';
}
/* the cosmetics shop: outfits, hats, extras, pets and scenes for cash. Exclusives come from milestones and club albums, never from here. */
export function buyItem(w, item) {
  w.own = Array.isArray(w.own) ? w.own : [];
  const it = ITEMS[item]; if (!it || it[2] <= 0) refuse('That item is unavailable.');
  if (it[3]) refuse(it[3] === 3 ? 'Complete that club in your collector book to earn this.' : 'That item is a milestone reward.');
  if (owns(w, item)) return { owned: true };
  if ((w.coins || 0) < it[2]) refuse('You need $' + (it[2] - Math.floor(w.coins || 0)).toLocaleString('en-US') + ' more.');
  w.coins = Math.floor(w.coins) - it[2]; w.own.push(item);
  return { bought: item, xp: awardXP(w, 15, ITEMS) };
}
