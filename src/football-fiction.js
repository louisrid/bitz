/* BITZ League: every club and player is fictional. Card IDs are unchanged (saved cards keep working);
   only what is shown is replaced. Names, nations, positions, numbers, ratings and looks are generated
   deterministically from each player's ID, so they never change between restarts or servers. */

/* club id -> [name, short, primary, secondary, kit pattern, crest shape, crest motif] */
export const CLUB_FICTION = {
  'bournemouth': ['Cliffside Athletic', 'CLA', '#d7263d', '#151217', 'stripes', 'shield', 'cliff'],
  'arsenal': ['Kingsgate FC', 'KGT', '#e3232c', '#ffffff', 'sleeves', 'shield', 'cannonball'],
  'aston-villa': ['Ashby Castle', 'ASH', '#7a1f3d', '#8fd3ff', 'plain', 'round', 'tower'],
  'brentford': ['Thameside Rovers', 'THR', '#d91d31', '#ffffff', 'stripes', 'round', 'bee'],
  'brighton': ['Gullhaven', 'GUL', '#1f6fd6', '#ffffff', 'stripes', 'round', 'wave'],
  'chelsea': ['Westbridge', 'WBR', '#1847b8', '#ffffff', 'plain', 'round', 'lion'],
  'coventry': ['Spirefield City', 'SPC', '#4aa8e8', '#ffffff', 'plain', 'shield', 'spire'],
  'crystal-palace': ['Southmere', 'SOU', '#1f4bbd', '#d62a3a', 'halves', 'shield', 'wing'],
  'everton': ['Harbourside FC', 'HBS', '#1d4aa6', '#ffffff', 'plain', 'round', 'anchor'],
  'fulham': ['Elmbridge', 'ELM', '#f4f4f4', '#141414', 'plain', 'shield', 'oak'],
  'hull': ['Northcoast United', 'NCU', '#f5a623', '#121212', 'hoops', 'shield', 'claw'],
  'ipswich': ['Eastwick Town', 'EWT', '#2550c6', '#ffffff', 'plain', 'round', 'horse'],
  'leeds': ['Whitestone United', 'WSU', '#f7f7f2', '#f2c40f', 'plain', 'diamond', 'rose'],
  'liverpool': ['Redwater FC', 'RWF', '#c8102e', '#f6c55b', 'plain', 'shield', 'bird'],
  'man-city': ['Skyline City', 'SKY', '#6cb8f5', '#ffffff', 'plain', 'round', 'star'],
  'man-united': ['Ironworks United', 'IRU', '#d0213a', '#f2be5c', 'plain', 'shield', 'gear'],
  'newcastle': ['Blackfriars', 'BLK', '#141414', '#ffffff', 'stripes', 'shield', 'castle'],
  'nottingham': ['Oakhurst', 'OAK', '#d6202f', '#ffffff', 'plain', 'round', 'tree'],
  'sunderland': ['Lighthouse Athletic', 'LHA', '#d01f35', '#ffffff', 'stripes', 'shield', 'lighthouse'],
  'tottenham': ['Lionsgate', 'LGT', '#ffffff', '#16233f', 'plain', 'shield', 'crown'],
  'real-madrid': ['Club Meridiano', 'MER', '#f6f1e2', '#c9a24a', 'plain', 'round', 'crown'],
  'barcelona': ['Costa Blau', 'CBL', '#9b1d4a', '#1f47c4', 'stripes', 'shield', 'sun'],
  'atletico': ['Atlético Sierra', 'ATS', '#cb1f36', '#ffffff', 'stripes', 'shield', 'bear'],
  'bayern': ['FC Alpenburg', 'ALP', '#d8212f', '#ffffff', 'plain', 'round', 'peak'],
  'dortmund': ['Ruhrstadt 09', 'R09', '#f7d417', '#161616', 'plain', 'round', 'bolt'],
  'psg': ['Lumière FC', 'LUM', '#18295f', '#e1263b', 'sash', 'round', 'flame'],
  'inter': ['Lago Azzurro', 'LAZ', '#1f4fb2', '#141414', 'stripes', 'round', 'snake'],
  'napoli': ['Vesuvio Calcio', 'VES', '#2f8ee0', '#ffffff', 'plain', 'round', 'volcano'],
  'juventus': ['Sabauda', 'SAB', '#f4f4f4', '#141414', 'stripes', 'diamond', 'zebra'],
  'milan': ['Duomo Rosso', 'DUO', '#c41f2c', '#141414', 'stripes', 'shield', 'cross']
};
const LEAGUE_OF = { 'real-madrid': 'Liga Sol', 'barcelona': 'Liga Sol', 'atletico': 'Liga Sol', 'bayern': 'Erste Liga', 'dortmund': 'Erste Liga', 'psg': 'Ligue Étoile', 'inter': 'Serie Oro', 'napoli': 'Serie Oro', 'juventus': 'Serie Oro', 'milan': 'Serie Oro' };

/* nation code -> [first names, last names]. Mixed at random, so no real player's name is used on purpose. */
const N = {
  ENG: ['Harvey Callum Reece Jamie Ollie Tyler Kian Luke Mason Charlie Alfie Jack Leo Ethan Ryan Josh Connor Danny', 'Ashworth Bramley Caddick Dunmore Elstead Fairley Garside Hollins Ingleby Jessop Kirkham Lowther Marsden Northcott Oakes Pembury Radcliffe Selby Thorne Upton Varley Whitlock Yardley'],
  SCO: ['Euan Callum Fraser Lewis Rory Ewan Craig Blair', 'MacAllan Strachan Dunlop Kerr Rennie Moffat Baird Lennox Cairns'],
  WAL: ['Rhys Gethin Dylan Ieuan Owain Tomos', 'Pritchard Vaughan Pugh Llewellyn Prosser Bevan'],
  IRL: ['Cian Darragh Eoin Seán Conor Niall', 'Brennan Doherty Gallagher Kinsella Moran Quigley'],
  FRA: ['Mathis Enzo Théo Lucas Hugo Rayan Nolan Yanis Axel Malo', 'Duval Fontaine Garnier Lacroix Marchand Perrin Rousseau Vasseur Bonnet Chevalier'],
  ESP: ['Álvaro Pablo Iker Hugo Marcos Unai Sergio Javi Dani Adrián', 'Arrieta Benítez Cabrera Delgado Echeverría Fuentes Gallardo Herrera Ibarra Lozano'],
  POR: ['Tiago Duarte Rafael Gonçalo Rúben Diogo Vitor', 'Azevedo Barreto Carvalho Esteves Faria Machado Quaresma Teixeira'],
  BRA: ['Caio Davi Enzo Gabriel Igor Kauã Matheus Rian Thiago Vinicius', 'Albuquerque Barbosa Cardoso Damasceno Esteves Ferraz Guimarães Moraes Nogueira Prates'],
  ARG: ['Facundo Lautaro Thiago Nahuel Gonzalo Franco Valentín', 'Aguirre Bustos Coronel Ferreyra Ledesma Medina Ponce Sosa'],
  URU: ['Agustín Bruno Santiago Matías', 'Cabrera Olivera Píriz Techera'],
  COL: ['Andrés Camilo Jhon Sebastián Yerson', 'Cuesta Mosquera Palacios Rentería Zapata'],
  MEX: ['Diego Emiliano Ulises Raúl', 'Corona Guzmán Orozco Villalobos'],
  USA: ['Brady Cole Gavin Landon Tanner Wyatt', 'Becker Callahan Dawson Hartley Mercer Sullivan'],
  GER: ['Jonas Lukas Finn Niklas Moritz Leon Felix Jannik', 'Achterberg Brandt Engel Hoffmann Keller Lindner Richter Vogt'],
  NED: ['Daan Bram Sem Luuk Milan Thijs Jesse', 'Bakker de Wit van Dalen Kuipers Meijer Smit Visser'],
  BEL: ['Arne Wout Senne Lander Robbe', 'Claes Goossens Janssens Peeters Wouters'],
  ITA: ['Lorenzo Matteo Riccardo Davide Federico Tommaso', 'Bianchi Colombo De Luca Esposito Ferrari Marino Rinaldi'],
  CRO: ['Luka Ivan Josip Marko Ante', 'Babić Jurić Knežević Petrović Vuković'],
  SRB: ['Nikola Stefan Lazar Uroš', 'Janković Milić Ristić Stanković'],
  POL: ['Kacper Jakub Mateusz Szymon', 'Kowal Nowicki Wójcik Zieliński'],
  UKR: ['Artem Bohdan Danylo Oleh', 'Hrytsenko Kovalenko Melnyk Tkachenko'],
  NOR: ['Sondre Eirik Magnus Vetle Jørgen', 'Berge Haugland Lunde Solberg Vik'],
  DEN: ['Mads Rasmus Jonas Mikkel', 'Damsholt Kjær Lindholm Vestergaard'],
  SWE: ['Viktor Oscar Hugo Elias Isak', 'Bergström Holm Lindqvist Nyberg Sjöberg'],
  SUI: ['Noah Luca Nico Fabian', 'Brunner Gerber Meier Steiner'],
  AUT: ['Florian Maximilian Stefan', 'Gruber Huber Pichler'],
  NGA: ['Chidi Emeka Femi Kelechi Tunde Uche', 'Adeyemi Babatunde Eze Nwosu Okafor Olaniyan'],
  GHA: ['Kwame Kofi Yaw Kwabena', 'Agyeman Boateng Mensah Owusu'],
  SEN: ['Moussa Ibrahima Cheikh Pape', 'Diallo Faye Ndiaye Sarr Seck'],
  CIV: ['Yao Serge Franck Wilfried', 'Bamba Koné Kouassi Traoré'],
  CMR: ['Samuel Junior Bryan', 'Ekambi Mbarga Ngadeu'],
  MAR: ['Achraf Hakim Sofiane Yassine Ilias', 'Amrani Belhaj El Idrissi Tazi Zerouali'],
  EGY: ['Omar Karim Mostafa Ahmed', 'Hegazy Mansour Rashad Soliman'],
  JPN: ['Haruto Sota Ren Yuki Kaito', 'Fujita Ishikawa Kobayashi Nakano Sato'],
  KOR: ['Min-jun Ji-ho Seo-jun Do-yun', 'Han Jeong Kang Park'],
  AUS: ['Lachlan Riley Jayden Cooper', 'Hendry McKenna Rowe Tilley']
};
/* how likely each nation is in each league (weights) */
const MIX = {
  prem: { ENG: 30, SCO: 4, WAL: 3, IRL: 3, FRA: 6, ESP: 4, POR: 4, BRA: 6, ARG: 3, URU: 1, COL: 2, MEX: 1, USA: 2, GER: 3, NED: 4, BEL: 3, ITA: 1, CRO: 1, SRB: 1, POL: 1, UKR: 1, NOR: 2, DEN: 2, SWE: 2, SUI: 1, AUT: 1, NGA: 3, GHA: 2, SEN: 2, CIV: 2, CMR: 1, MAR: 2, EGY: 1, JPN: 2, KOR: 2, AUS: 1 },
  'Liga Sol': { ESP: 45, ARG: 8, URU: 5, COL: 5, BRA: 8, FRA: 6, POR: 5, MAR: 5, MEX: 3, CRO: 3, GER: 2, NED: 2, JPN: 3 },
  'Erste Liga': { GER: 45, AUT: 8, SUI: 6, NED: 6, DEN: 5, POL: 5, FRA: 5, CRO: 4, KOR: 4, USA: 4, JPN: 4, BEL: 4 },
  'Ligue Étoile': { FRA: 45, SEN: 8, CIV: 8, MAR: 8, CMR: 6, BEL: 5, POR: 6, BRA: 6, ESP: 4, ITA: 4 },
  'Serie Oro': { ITA: 45, ARG: 8, BRA: 6, SRB: 6, CRO: 6, NED: 5, POL: 5, FRA: 5, NGA: 4, URU: 4, DEN: 3, SUI: 3 }
};
const POS = ['FWD', 'MID', 'FWD', 'DEF', 'MID', 'GK', 'DEF', 'MID', 'DEF', 'FWD', 'DEF'];
const NUM = { GK: [1, 13, 31], DEF: [2, 3, 4, 5, 6, 12, 15, 22, 24, 33], MID: [8, 10, 14, 16, 17, 18, 20, 23, 25, 28], FWD: [7, 9, 11, 19, 21, 27, 29, 99] };
const STRONG = { 'man-city': 3, 'liverpool': 3, 'arsenal': 3, 'chelsea': 2, 'man-united': 1, 'tottenham': 1, 'newcastle': 1, 'aston-villa': 1, 'real-madrid': 4, 'barcelona': 3, 'bayern': 3, 'psg': 3, 'inter': 2, 'atletico': 2, 'dortmund': 1, 'napoli': 1, 'juventus': 1, 'milan': 1 };

function hash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function rng(seed) { let a = seed || 1; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const pick = (r, arr) => arr[Math.floor(r() * arr.length)];
function weighted(r, w) { const e = Object.entries(w), sum = e.reduce((s, x) => s + x[1], 0); let n = r() * sum; for (const [k, v] of e) { n -= v; if (n < 0) return k; } return e[0][0]; }
const SKIN = { default: [0, 1, 2, 3, 4, 5], west: [0, 0, 1, 1, 2, 3, 4], africa: [4, 5, 5, 3], asia: [1, 1, 2], latam: [1, 2, 2, 3, 3, 4, 5] };
const AREA = { NGA: 'africa', GHA: 'africa', SEN: 'africa', CIV: 'africa', CMR: 'africa', JPN: 'asia', KOR: 'asia', BRA: 'latam', COL: 'latam', MEX: 'latam', ARG: 'west', URU: 'west' };

export function applyFiction(seed) {
  const used = new Set(), shirts = new Map();
  for (const c of [...seed.clubs, ...seed.europe]) {
    const f = CLUB_FICTION[c.id]; if (!f) continue;
    Object.assign(c, { name: f[0], short: f[1], primary: f[2], accent: f[3], kit: f[4], crest: f[5], motif: f[6], division: LEAGUE_OF[c.id] || 'BITZ Premier Division' });   // league stays: pack pools depend on it
  }
  for (const p of seed.players) {
    const r = rng(hash('bitz-fiction:' + p.id)), club = seed.clubs.find(c => c.id === p.club) || seed.europe.find(c => c.id === p.club);
    const lg = LEAGUE_OF[p.club] || 'prem', nation = weighted(r, MIX[lg] || MIX.prem), pool = N[nation];
    const firsts = pool[0].split(' '), lasts = pool[1].split(' ');
    let name = '', tries = 0;
    do { name = pick(r, firsts) + ' ' + pick(r, lasts); tries++; } while (used.has(name) && tries < 40);
    used.add(name);
    const pos = POS[(p.slot - 1) % 11] || 'MID', taken = shirts.get(p.club) || new Set(); shirts.set(p.club, taken);
    let num = pick(r, NUM[pos]); if (taken.has(num)) num = NUM[pos].find(n => !taken.has(n)) || Array.from({ length: 49 }, (_, i) => i + 2).find(n => !taken.has(n)); taken.add(num);   // one shirt number per player in a club
    const rating = Math.max(66, Math.min(95, Math.round(84 - (p.slot - 1) * 1.6 + (STRONG[p.club] || 0) * 1.6 + (r() * 4 - 2))));
    const skin = pick(r, SKIN[AREA[nation] || 'west']), hair = Math.floor(r() * 9), hairCol = skin >= 4 ? pick(r, [0, 0, 1, 5]) : pick(r, [0, 1, 1, 2, 3, 4, 5]);
    Object.assign(p, {
      name, nation, pos, num, rating, division: club ? club.division : 'BITZ Premier Division',
      look: { skin, hair, hairCol, beard: r() < 0.38 ? 1 + Math.floor(r() * 3) : 0, brow: Math.floor(r() * 3), eye: Math.floor(r() * 3), band: r() < 0.08 ? 1 : 0 },
      portrait: null, source: null
    });
  }
  seed.source = { clubs: 'BITZ League (fictional)', roster: 'fictional', portraits: 'drawn in-game' };
  return seed;
}
