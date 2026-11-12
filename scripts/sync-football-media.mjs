/* BITZ football photo importer: batch Wikipedia pageimage and Wikimedia Commons
   licence queries, then cache only openly reusable photographs with attribution.
   Batch size avoids Wikimedia 429 limits; old player images are never deleted. */
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {FOOTBALL_SEED} from '../src/football-catalogue.js';
const root=fileURLToPath(new URL('../',import.meta.url)),dir=path.join(root,'public/football');
const imageDir=path.join(dir,'portraits');
const max=FOOTBALL_SEED.players.length;
const arg=process.argv.find(x=>x.startsWith('--limit='));
const limit=Math.max(0,Math.min(max,arg===undefined?max:Math.trunc(Number(arg.split('=')[1])||0)));
const refresh=process.argv.includes('--refresh');
await fs.mkdir(imageDir,{recursive:true});
let manifest={};try{manifest=JSON.parse(await fs.readFile(path.join(dir,'media.json'),'utf8'));}catch(e){}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const clean=s=>String(s||'').replace(/<[^>]*>/g,' ').replace(/&nbsp;/g,' ').replace(/\s+/g,' ').trim().slice(0,230);
const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
function free(s){const v=String(s||'').toLowerCase();return !/non.?commercial|no.?deriv|all rights reserved|unknown|cc-by-nc|cc-by-nd/.test(v)&&/cc by|cc-by|cc0|public domain|pd-/.test(v);}
async function json(endpoint){
 let last;
 for(let n=0;n<5;n++){
  try{
   const r=await fetch(endpoint,{headers:{'User-Agent':'BITZ-football-photo-cache/2.0 (freely reusable Wikimedia images; provides attribution)',Accept:'application/json'},signal:AbortSignal.timeout(18000)});
   if(r.ok)return await r.json();
   last=Error('HTTP '+r.status);
   if(r.status!==429&&r.status<500)break;
  }catch(e){last=e;}
  await sleep(Math.min(25000,2500*Math.pow(2,n)));
 }
 throw last||Error('Wikimedia API unavailable');
}
async function licenseBatch(players){
 const names=players.map(p=>p.name);
 const query='https://en.wikipedia.org/w/api.php?format=json&action=query&redirects=1&prop=pageimages&piprop=name&titles='+encodeURIComponent(names.join('|'));
 const wiki=await json(query);
 const pages=Object.values(wiki.query?.pages||{});
 const redirects=new Map((wiki.query?.redirects||[]).map(r=>[norm(r.from),norm(r.to)]));
 const normalized=new Map((wiki.query?.normalized||[]).map(r=>[norm(r.from),norm(r.to)]));
 const byTitle=new Map(pages.map(p=>[norm(p.title),p]));
 const selected=players.map(p=>{
  let name=norm(p.name);
  for(let j=0;j<3;j++)name=redirects.get(name)||normalized.get(name)||name;
  const page=byTitle.get(name);
  return {player:p,file:page?.pageimage};
 }).filter(x=>x.file);
 if(!selected.length)return [];
 const files=[...new Set(selected.map(x=>'File:'+x.file.replace(/^File:/,'')))];
 const url='https://commons.wikimedia.org/w/api.php?format=json&action=query&prop=imageinfo&iiprop=url%7Cextmetadata&iiurlwidth=640&titles='+encodeURIComponent(files.join('|'));
 const q=await json(url);
 const details=new Map(Object.values(q.query?.pages||{}).map(p=>[norm(p.title),p.imageinfo?.[0]]));
 const ready=[];
 for(const item of selected){
  const filename='File:'+item.file.replace(/^File:/,'');
  const info=details.get(norm(filename)),license=clean(info?.extmetadata?.LicenseShortName?.value||info?.extmetadata?.UsageTerms?.value||'');
  const src=info?.thumburl||info?.url;
  if(!info||!free(license)||!src?.startsWith('https://upload.wikimedia.org/wikipedia/commons/'))continue;
  ready.push({player:item.player,src,license,file:filename,
   page:info.descriptionurl||'https://commons.wikimedia.org/wiki/'+encodeURIComponent(filename),
   artist:clean(info.extmetadata?.Artist?.value||info.extmetadata?.Credit?.value||'See source page')});
 }
 return ready;
}
async function download(x){
 const r=await fetch(x.src,{signal:AbortSignal.timeout(18000)});
 if(!r.ok)throw Error('Image HTTP '+r.status);
 const ct=r.headers.get('content-type')||'';
 const ext=ct.includes('image/jpeg')?'jpg':ct.includes('image/png')?'png':ct.includes('image/webp')?'webp':null;
 if(!ext)throw Error('Invalid media type');
 const data=Buffer.from(await r.arrayBuffer());
 if(data.length<1500||data.length>1800000)throw Error('Invalid photo size');
 const local='football/portraits/'+x.player.id+'.'+ext;
 await fs.writeFile(path.join(imageDir,x.player.id+'.'+ext),data);
 manifest[x.player.id]={local,thumbnail:x.src,sourcePage:x.page,file:x.file,license:x.license,
  artist:x.artist,provider:'Wikimedia Commons',retrievedAt:new Date().toISOString().slice(0,10)};
}
const candidates=[];
for(const p of FOOTBALL_SEED.players.slice(0,limit)){
 if(!refresh&&manifest[p.id]?.local){
  try{await fs.access(path.join(dir,manifest[p.id].local.replace(/^football\//,'')));continue;}catch(e){}
 }
 candidates.push(p);
}
let found=0,downloaded=0,failed=0;
const BATCH=16;
for(let i=0;i<candidates.length;i+=BATCH){
 const batch=candidates.slice(i,i+BATCH);
 let photo=[];
 try{photo=await licenseBatch(batch);}catch(e){failed+=batch.length;console.warn('Batch',i/BATCH+1,'API:',e.message);}
 const tasks=photo.map(async item=>{
  try{await download(item);downloaded++;}catch(e){failed++;console.warn('Photo',item.player.name,e.message);}
 });
 await Promise.all(tasks);
 found+=photo.length;
 console.log('Batch',Math.floor(i/BATCH)+1,'of',Math.ceil(candidates.length/BATCH),': licensed',photo.length,', downloaded',downloaded);
 await sleep(1500);
}
await fs.writeFile(path.join(dir,'media.json'),JSON.stringify(Object.fromEntries(Object.entries(manifest).sort()),null,2)+'\n');
const lines=['# Licensed football image credits','','Photographs are cached from freely licensed Wikimedia Commons pages. All autograph artwork in BITZ is virtual and unauthenticated.',''];
for(const [id,m] of Object.entries(manifest).sort()){
 const player=FOOTBALL_SEED.players.find(p=>p.id===id);
 lines.push('- **'+(player?.name||id)+'**: '+m.artist+'; '+m.license+'; '+m.sourcePage);
}
await fs.writeFile(path.join(dir,'CREDITS.md'),lines.join('\n')+'\n');
console.log('MEDIA COMPLETE',JSON.stringify({requested:limit,candidates:candidates.length,licensed:found,downloaded,missing:candidates.length-found,failed,cached:Object.keys(manifest).length}));
if(limit&&!Object.keys(manifest).length)process.exitCode=2;
