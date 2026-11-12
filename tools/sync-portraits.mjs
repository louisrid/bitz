/**
 * BITZ portrait importer. Uses Wikidata P18 and the Wikimedia Commons API.
 * It does NOT scrape FootyRenders or copy images without machine-readable reuse rights.
 * Run: node tools/sync-portraits.mjs [--test] [--limit=20]
 * Outputs /public/portraits/{playerId}.{jpg,png,webp}, manifest.js, credits.json, report.json.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PLAYERS } from '../src/catalogue.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIR = path.join(ROOT, 'public', 'portraits');
const API = 'https://www.wikidata.org/w/api.php';
const COMMONS = 'https://commons.wikimedia.org/w/api.php';
const UA = 'BITZFootballPortraitImport/1.0 (https://github.com/louisrid/bitz; licensed Wikimedia attribution import)';
const norm = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[øØ]/g, 'o').replace(/[łŁ]/g, 'l').replace(/[ß]/g, 'ss').replace(/[æÆ]/g, 'ae').replace(/[œŒ]/g, 'oe').replace(/[ıİ]/g, 'i').replace(/[đĐðÐ]/g, 'd').replace(/[^a-z0-9]+/g, ' ').trim();
const sleep = ms => new Promise(r => setTimeout(r, ms));

/* Explicit identities verified against Wikidata records, not fuzzy name matching.
   This prevents using the wrong Alex Scott, Joao Pedro or similar-name footballer. */
const VERIFIED_QID = Object.freeze({
  'alex-scott':'Q106778648',
  'andrew-robertson':'Q15915040',
  'antonin-kinsky':'Q124647398',
  'diego-gomez':'Q115978703',
  'estevao-willian':'Q115332579',
  'gabriel-magalhaes':'Q25175970',
  'joao-pedro':'Q64005114',
  'jorgen-strand-larsen':'Q28933132',
  'matheus-cunha':'Q35831063',
  'nico-gonzalez':'Q106625792',
  'pascal-gross':'Q509489',
  'raphinha':'Q28861547',
  'wesley-fofana':'Q65029821'
});
const SEARCH_ALIASES = Object.freeze({
  'martin-odegaard': ['Martin Ødegaard'],
  'jorgen-strand-larsen': ['Jørgen Strand Larsen'],
  'pascal-gross': ['Pascal Groß'],
  'ferdi-kadioglu': ['Ferdi Kadıoğlu'],
  'antonin-kinsky': ['Antonín Kinský'],
  'mohamed-belloumi': ['Mohamed Belloumi'],
  'junior-kroupi': ['Eli Junior Kroupi'],
  'andrew-robertson': ['Andy Robertson'],
  'gonzalo-garcia': ['Gonzalo García Torres'],
  'geovany-quenda': ['Geovany Quenda']
});
const hints = {
  ENG: ['english','british'], SCO: ['scottish','british'], WAL: ['welsh','british'], NIR: ['northern irish','british'],
  BRA: ['brazilian'], ESP: ['spanish'], FRA: ['french'], GER: ['german'], ITA: ['italian'], NED: ['dutch'],
  POR: ['portuguese'], BEL: ['belgian'], ARG: ['argentine','argentinian'], URU: ['uruguayan'], COL: ['colombian'],
  DEN: ['danish'], NOR: ['norwegian'], SWE: ['swedish'], FIN: ['finnish'], POL: ['polish'], IRL: ['irish'],
  JPN: ['japanese'], USA: ['american'], CAN: ['canadian'], AUS: ['australian'], TUR: ['turkish'],
  SEN: ['senegalese'], MAR: ['moroccan'], NGA: ['nigerian'], GHA: ['ghanaian'], CIV: ['ivorian','ivory coast'],
  ALG: ['algerian'], TUN: ['tunisian'], EGY: ['egyptian'], CMR: ['cameroonian'], COD: ['congolese'],
  GEO: ['georgian'], GAB: ['gabonese'], ISR: ['israeli'], CRO: ['croatian'], SRB: ['serbian'],
  SVK: ['slovak'], SVN: ['slovenian'], CZE: ['czech'], SUI: ['swiss'], AUT: ['austrian'],
  BIH: ['bosnian'], KOS: ['kosovan','kosovar'], UKR: ['ukrainian'], ROU: ['romanian'], HUN: ['hungarian'],
  ECU: ['ecuadorian'], PAR: ['paraguayan'], BOL: ['bolivian'], CHI: ['chilean'], MEX: ['mexican'],
  GRE: ['greek'], ALB: ['albanian'], JAM: ['jamaican'], ANG: ['angolan'], ZAM: ['zambian']
};
const licenceOk = lic => /^(CC BY(?:-SA)?(?:\s|$)|CC0(?:\s|$)|PUBLIC DOMAIN(?:\s|$)|PD(?:\s|-|$))/.test(String(lic || '').toUpperCase());
const htmlText = x => String(x || '').replace(/<[^>]*>/g, ' ').replace(/&(?:amp|quot|lt|gt|nbsp);/g, z => ({'&amp;':'&','&quot;':'"','&lt;':'<','&gt;':'>','&nbsp;':' '}[z])).replace(/\s+/g,' ').trim().slice(0, 240);
const mval = (m, k) => htmlText(m?.[k]?.value || '');
const batches = (arr, n) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));
const wikidataUrl = params => API + '?' + new URLSearchParams({format:'json', ...params});
const commonsUrl = params => COMMONS + '?' + new URLSearchParams({format:'json', ...params});

async function request(url, bytes = false) {
  let last;
  for (let n = 0; n < 4; n++) {
    try {
      const res = await fetch(url, {headers: {'User-Agent': UA, Accept: bytes ? 'image/*' : 'application/json'}, signal: AbortSignal.timeout(28000)});
      if (res.ok) {
        if (!bytes) return await res.json();
        const size = Number(res.headers.get('content-length') || 0);
        if (size > 8_000_000) throw new Error('image too large');
        const buffer = Buffer.from(await res.arrayBuffer());
        if (buffer.length > 8_000_000 || buffer.length < 800) throw new Error('image outside safe size limit');
        return buffer;
      }
      last = new Error('HTTP ' + res.status);
      if (![429,500,502,503,504].includes(res.status)) break;
    } catch(e) { last = e; }
    await sleep(450 * (n + 1) ** 2);
  }
  throw last || new Error('request failed');
}
async function parallel(items, worker, count = 3) {
  let index = 0;
  return Promise.all(Array.from({length: count}, async () => {
    while (index < items.length) {
      const i = index++;
      try { await worker(items[i], i); }
      catch (error) { console.error('ERROR', items[i].id || items[i], String(error)); }
    }
  }));
}
function score(result, player) {
  const name = norm(player.name), label = norm(result.label), desc = norm(result.description);
  if (!/(football|soccer)/.test(desc)) return -1;
  let value = label === name ? 100 : label.startsWith(name + ' ') ? 66 : -1;
  if (value < 0) return -1;
  const national = hints[player.nation] || [];
  if (national.some(x => desc.includes(x))) value += 17;
  if (name.length < 7 && !national.some(x => desc.includes(x))) return -1; // one-name ambiguity
  return value;
}
function extOf(buf) {
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpg';
  if (buf.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) return 'png';
  if (buf.toString('ascii',0,4) === 'RIFF' && buf.toString('ascii',8,12) === 'WEBP') return 'webp';
  return null;
}
function fileKey(name) { return norm(name.replace(/^File:/i, '').replace(/_/g, ' ')); }
function entityFile(e) { return e?.claims?.P18?.find(c => c.mainsnak?.datavalue?.value)?.mainsnak.datavalue.value || ''; }
function footballer(e) {
  const occ = e?.claims?.P106 || [];
  return occ.some(c => c.mainsnak?.datavalue?.value?.id === 'Q937857' || c.mainsnak?.datavalue?.value?.id === 'Q2066131');
}
async function writeManifest(entries, report) {
  const map = Object.fromEntries(Object.entries(entries).sort(([a],[b])=>a.localeCompare(b)));
  await fs.writeFile(path.join(DIR,'credits.json'), JSON.stringify(map, null, 2) + '\n');
  await fs.writeFile(path.join(DIR,'manifest.js'), '/* Generated by tools/sync-portraits.mjs. Wikimedia-sourced images only; see credits.json. */\nwindow.BITZ_PORTRAITS = Object.freeze(' + JSON.stringify(map) + ');\n');
  await fs.writeFile(path.join(DIR,'report.json'), JSON.stringify(report,null,2) + '\n');
}
async function main() {
  if (process.argv.includes('--test')) {
    const assert = (condition, message) => { if(!condition) throw new Error(message); };
    assert(norm('Kylian Mbappé') === 'kylian mbappe', 'accents');
    assert(score({label:'Kylian Mbappé',description:'French association football player'}, {name:'Kylian Mbappe',nation:'FRA'}) === 117, 'identity');
    assert(score({label:'John Smith',description:'English politician'}, {name:'John Smith',nation:'ENG'}) < 0, 'wrong occupation');
    assert(licenceOk('CC BY-SA 4.0') && licenceOk('CC0 1.0') && !licenceOk('All rights reserved') && !licenceOk('CC BY-NC 4.0'), 'licence');
    assert(extOf(Buffer.from([0xff,0xd8,0xff,0x00])) === 'jpg', 'jpeg magic');
    console.log('Portrait importer offline tests PASS');
    return;
  }
  const limit = Number((process.argv.find(v => v.startsWith('--limit=')) || '').split('=')[1] || PLAYERS.length);
  const list = [...PLAYERS].sort((a,b) => Number(b.ucl) - Number(a.ucl)).slice(0,Math.min(PLAYERS.length,Math.max(1,limit)));
  await fs.mkdir(DIR,{recursive:true});
  let previous = {};
  try { previous = JSON.parse(await fs.readFile(path.join(DIR,'credits.json'),'utf8')); } catch {}
  const entries = {}, unresolved = [], lookup = [];
  for (const p of list) {
    const present = (await Promise.all(['webp','png','jpg'].map(async ext => {try{await fs.stat(path.join(DIR, p.id+'.'+ext)); return ext;}catch{return null;}}))).find(Boolean);
    if (present) {
      const existing = previous[p.id] || {};
      entries[p.id] = {...existing, file:p.id+'.'+present};
    } else lookup.push(p);
  }
  console.log('Portraits:', list.length, 'already present:', Object.keys(entries).length, 'to resolve:', lookup.length);
  const proposed = [];
  await parallel(lookup, async p => {
    if (VERIFIED_QID[p.id]) { proposed.push({p,entity:VERIFIED_QID[p.id]}); return; }
    const all = new Map();
    const queries = [p.name, ...(SEARCH_ALIASES[p.id] || [])];
    for (const name of queries) {
      try {
        const found = await request(wikidataUrl({action:'wbsearchentities',search:name,language:'en',limit:'15',type:'item'}));
        for (const r of found.search || []) {
          const n = score(r,p), prior = all.get(r.id);
          if (!prior || prior.score<n) all.set(r.id,{...r,score:n});
        }
      } catch(e) { console.warn('Lookup',p.name,String(e)); }
    }
    const scored = [...all.values()].filter(r=>r.score>=65).sort((a,b)=>b.score-a.score);
    if (!scored.length || (scored[1] && scored[0].score-scored[1].score<10)) {
      unresolved.push({id:p.id,name:p.name,reason:'No unambiguous footballer identity on Wikidata'}); return;
    }
    proposed.push({p,entity:scored[0].id});
  });
  console.log('Identified:', proposed.length, 'unmatched:', unresolved.length);
  const entities = new Map();
  for (const part of batches([...new Set(proposed.map(x=>x.entity))],40)) {
    try {
      const r = await request(wikidataUrl({action:'wbgetentities',ids:part.join('|'),props:'claims',languages:'en'}));
      for (const [id,e] of Object.entries(r.entities || {})) entities.set(id,e);
    } catch(e) { console.error('Wikidata batch failed', String(e)); }
  }
  const files = [], chosen = [];
  for (const {p,entity} of proposed) {
    const en = entities.get(entity), f = entityFile(en);
    if (!en || !footballer(en) || !f) {
      unresolved.push({id:p.id,name:p.name,reason:'No verified footballer P18 photograph'}); continue;
    }
    files.push(f); chosen.push({p,file:f,entity});
  }
  // Individually checked Commons files for players whose Wikidata P18 is missing or ambiguous.
  // Each file still passes the Commons image metadata, MIME and licence verification below.
  const curated = {
    'chris-wood': 'Chris Wood (cropped).jpg',
    'reece-james': 'Reece James FIFA Club World Cup final extraction.jpg',
    'joao-gomes': 'Joao Gomes.png',
    'sven-botman': 'Sven Botman 24052026 (6) (cropped).jpg',
    'murillo': 'Murillo and Tony Loughlan 22122025 (1) (Murillo Santiago Costa dos Santos).jpg',
    'rayan': 'Rayan 2026.png',
    'julio-enciso': 'Enciso 220826.jpg',
    'junior-kroupi': 'Eli Junior Kroupi (cropped).jpg',
    'adam-smith': 'Adam Smith 27122025 (2).jpg',
    'lewis-miley': 'Lewis Miley 2026.png'
  };
  for (const p of lookup) {
    if (!curated[p.id]) continue;
    const file = curated[p.id];
    const existing = chosen.find(x => x.p.id === p.id);
    if (existing) existing.file = file;
    else chosen.push({p,file,entity:'Commons-verified-'+p.id});
    files.push(file);
  }
  const media = new Map();
  for (const part of batches([...new Set(files)],35)) {
    try {
      const r = await request(commonsUrl({action:'query',titles:part.map(f=>'File:'+f).join('|'),prop:'imageinfo',iiprop:'url|mime|extmetadata',iiurlwidth:'720'}));
      for (const page of Object.values(r.query?.pages || {})) {
        const info = page.imageinfo?.[0];
        if (info) media.set(fileKey(page.title), { ...info, title:page.title });
      }
    } catch(e) { console.error('Commons metadata batch failed', String(e)); }
  }
  let completed = 0;
  await parallel(chosen, async ({p,file,entity}) => {
    const info = media.get(fileKey(file));
    if (!info) { unresolved.push({id:p.id,name:p.name,reason:'Commons photo unavailable'}); return; }
    const lic = mval(info.extmetadata,'LicenseShortName');
    if (!licenceOk(lic)) { unresolved.push({id:p.id,name:p.name,reason:'No permitted reusable image licence: '+lic}); return; }
    if (!/^image\/(?:jpeg|png|webp)$/.test(info.mime || '')) { unresolved.push({id:p.id,name:p.name,reason:'Unsupported source image format'}); return; }
    const source = info.descriptionurl;
    if (!/^https:\/\/commons\.wikimedia\.org\/wiki\/File:/.test(source || '')) { unresolved.push({id:p.id,name:p.name,reason:'Missing verifiable Commons file page'}); return; }
    let bytes;
    try { bytes = await request(info.thumburl || info.url, true); }
    catch(e) { unresolved.push({id:p.id,name:p.name,reason:'Download failed: '+String(e)}); return; }
    const ext = extOf(bytes);
    if (!ext) { unresolved.push({id:p.id,name:p.name,reason:'Not a recognised raster image'}); return; }
    const output = p.id+'.'+ext;
    await fs.writeFile(path.join(DIR,output),bytes);
    entries[p.id] = {
      file:output, player:p.name, wikidata:entity,
      source, artist:mval(info.extmetadata,'Artist') || 'See Wikimedia Commons',
      licence:lic, licenceUrl:mval(info.extmetadata,'LicenseUrl'),
      attribution:'Wikimedia Commons', adapted:false
    };
    completed++;
    if (completed % 25 === 0) console.log('Downloaded',completed,'licensed player images');
  });
  const missing = list.filter(p=>!entries[p.id]).map(p=>unresolved.find(x=>x.id===p.id)||{id:p.id,name:p.name,reason:'No licensed photograph located'});
  const report = {total:list.length,imported:Object.keys(entries).length,downloadedNow:completed,missing:missing.length,
    missingPlayers:missing.sort((a,b)=>a.name.localeCompare(b.name)),source:'Wikidata P18 / Wikimedia Commons',generatedAt:new Date().toISOString()};
  await writeManifest(entries,report);
  console.log('FINAL COVERAGE:',report.imported+'/'+report.total,'licensed portraits');
  if(missing.length) console.log('Unresolved players:',missing.map(p=>p.name).join(', '));
}
main().catch(e=>{console.error(e);process.exitCode=1;});
