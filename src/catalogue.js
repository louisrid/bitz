/* The catalogue the whole game reads: clubs, players, lookups and the validation that guards the roster.
   Player ids are name slugs ('bukayo-saka'), stable across club changes. */
import { SEASON, CLUBS, EURO_CLUBS, UCL_STARS } from './roster.js';
export { SEASON };
const slug = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const mkClub = (c, league) => ({ id: c[0], name: c[1], short: c[2], primary: c[3], accent: c[4], kit: c[5], league });
export const PL_CLUBS = CLUBS.map(c => mkClub(c, 'PL'));
export const EU_CLUBS = EURO_CLUBS.map(c => mkClub(c, 'EU'));
export const ALL_CLUBS = [...PL_CLUBS, ...EU_CLUBS];
export const CLUB_BY_ID = new Map(ALL_CLUBS.map(c => [c.id, c]));
export const PLAYERS = [];
CLUBS.forEach((c, ci) => {
  let main = 0;
  c[6].forEach(p => {
    const flags = p[4] || '', bonus = flags.includes('b');
    if (!bonus) main++;
    PLAYERS.push({ id: slug(p[0]), name: p[0], pos: p[1], nation: p[2], d: p[3], club: c[0], group: bonus ? 'bonus' : 'main', slot: bonus ? 0 : main, young: flags.includes('y'), ucl: false });
  });
});
UCL_STARS.forEach(p => PLAYERS.push({ id: slug(p[0]), name: p[0], pos: p[1], nation: p[2], d: p[3], club: p[4], group: 'ucl', slot: 0, young: (p[5] || '').includes('y'), ucl: true }));
export const PLAYER_BY_ID = new Map(PLAYERS.map(p => [p.id, p]));
export const MAIN_BY_CLUB = new Map(PL_CLUBS.map(c => [c.id, PLAYERS.filter(p => p.club === c.id && p.group === 'main')]));
export const tierOf = d => d >= 30 ? 'Icon' : d >= 10 ? 'Superstar' : d >= 3 ? 'Star' : d >= 1.2 ? 'Starter' : 'Squad';
/* every count the roster promises, checked at import so a bad edit can never ship */
export function validate() {
  const errors = [];
  if (PL_CLUBS.length !== 20) errors.push('expected 20 Premier League clubs, found ' + PL_CLUBS.length);
  for (const c of PL_CLUBS) { const n = MAIN_BY_CLUB.get(c.id).length; if (n !== 11) errors.push(c.name + ' has ' + n + ' main players'); }
  const main = PLAYERS.filter(p => p.group === 'main').length, bonus = PLAYERS.filter(p => p.group === 'bonus').length, ucl = PLAYERS.filter(p => p.group === 'ucl').length;
  if (main !== 220) errors.push('expected 220 main players, found ' + main);
  if (bonus !== 25) errors.push('expected 25 bonus players, found ' + bonus);
  if (ucl !== 20) errors.push('expected 20 Champions League stars, found ' + ucl);
  if (PLAYERS.length !== 265) errors.push('expected 265 players, found ' + PLAYERS.length);
  const ids = new Set(), names = new Set();
  for (const p of PLAYERS) {
    if (ids.has(p.id)) errors.push('duplicate id ' + p.id); ids.add(p.id);
    if (names.has(p.name)) errors.push('duplicate name ' + p.name); names.add(p.name);
    if (!CLUB_BY_ID.has(p.club)) errors.push(p.name + ' has unknown club ' + p.club);
    if (!(p.d > 0 && p.d <= 40)) errors.push(p.name + ' has desirability out of range');
    if (!/^(GK|DEF|MID|FWD)$/.test(p.pos)) errors.push(p.name + ' has bad position');
    if (!/^[A-Z]{3}$/.test(p.nation)) errors.push(p.name + ' has bad nation code');
  }
  return errors;
}
const problems = validate();
if (problems.length) throw new Error('Roster invalid: ' + problems.join('; '));
/* what the page needs: no server-only fields */
export const PUBLIC_CATALOGUE = Object.freeze({ season: SEASON, clubs: ALL_CLUBS, players: PLAYERS.map(p => ({ id: p.id, name: p.name, pos: p.pos, nation: p.nation, club: p.club, group: p.group, slot: p.slot, d: p.d, tier: tierOf(p.d), young: p.young })) });
