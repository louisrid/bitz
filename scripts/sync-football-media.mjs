/* Cache openly licensed Wikimedia photos without generating human likenesses.
 Run: node scripts/sync-football-media.mjs --limit=294 [--refresh]
 All downloaded assets retain author, licence and source URL metadata. */
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {FOOTBALL_SEED} from '../src/football-catalogue.js';
const root=fileURLToPath(new URL('../',import.meta.url));
const dir=path.join(root,'public/football'),photos=path.join(dir,'portraits');
const max=FOOTBALL_SEED.players.length;
const limit=Math.max(0,Math.min(max,Number((process.argv.find(x=>x.startsWith('--limit='))||'').split('=')[1])||max));
const refresh=process.argv.includes('--refresh');
await fs.mkdir(photos,{recursive:true});
let manifest={};try{manifest=JSON.parse(await fs.readFile(path.join(dir,'media.json'),'utf8'));}catch(e){}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const clean=s=>String(s||'').replace(/<[^>]*>/g,' ').replace(/&nbsp;/g,' ').replace(/\s+/g,' ').trim().slice(0,220);
const free=s=>{const v=String(s||'').toLowerCase();return !/non.?commercial|no.?deriv|all rights reserved|unknown|cc-by-nc|cc-by-nd/.test(v)&&(/cc by|cc-by|cc0|public domain|pd-/.test(v));};
async function get(url){
 let last;for(let a=0;a<3;a++){
  try{const r=await fetch(url,{headers:{'User-Agent':'BITZ-licensed-football-portrait-cache/1.0',Accept:'application/json'},signal:AbortSignal.timeout(13000)});
   if(r.ok)return await r.json();last=Error('HTTP '+r.status);if(r.status!==429&&r.status<500)break;
  }catch(e){last=e;}await sleep(750*(a+1));
 }throw last||Error('API unavailable');
}
async function one(p){
 const q='https://en.wikipedia.org/w/api.php?action=query&format=json&redirects=1&prop=pageimages&piprop=name%7Cthumbnail&pithumbsize=720&titles='+encodeURIComponent(p.name);
 const wiki=await get(q),page=Object.values(wiki.query?.pages||{})[0];
 if(!page?.pageimage)throw Error('No image');
 const file='File:'+page.pageimage.replace(/^File:/,'');
 const endpoint='https://commons.wikimedia.org/w/api.php?action=query&format=json&prop=imageinfo&iiprop=url%7Cextmetadata&iiurlwidth=720&titles='+encodeURIComponent(file);
 const commons=await get(endpoint),info=Object.values(commons.query?.pages||{})[0]?.imageinfo?.[0];
 if(!info)throw Error('No Commons file');
 const license=clean(info.extmetadata?.LicenseShortName?.value||info.extmetadata?.UsageTerms?.value||'');
 if(!free(license))throw Error('No freely reusable licence: '+license);
 const url=info.thumburl||info.url;
 if(!url?.startsWith('https://upload.wikimedia.org/wikipedia/commons/'))throw Error('Untrusted image origin');
 const r=await fetch(url,{signal:AbortSignal.timeout(15000)});
 if(!r.ok)throw Error('Image HTTP '+r.status);
 const ct=r.headers.get('content-type')||'';
 const ext=ct.includes('image/png')?'png':ct.includes('image/webp')?'webp':ct.includes('image/jpeg')?'jpg':null;
 if(!ext)throw Error('Unexpected image type');
 const bytes=Buffer.from(await r.arrayBuffer());if(bytes.length>1800000||bytes.length<1000)throw Error('Image size refused');
 const local='football/portraits/'+p.id+'.'+ext;
 await fs.writeFile(path.join(dir,'portraits',p.id+'.'+ext),bytes);
 return {local,thumbnail:url,sourcePage:info.descriptionurl||'https://commons.wikimedia.org/wiki/'+encodeURIComponent(file),
   file,license,artist:clean(info.extmetadata?.Artist?.value||info.extmetadata?.Credit?.value||'See source page'),
   retrievedAt:new Date().toISOString().slice(0,10),provider:'Wikimedia Commons'};
}
let i=0,downloaded=0,skipped=0,missing=0;
const errors=[];
async function worker(){
 while(i<limit){
  const p=FOOTBALL_SEED.players[i++];
  if(!refresh&&manifest[p.id]?.local){
   try{await fs.access(path.join(dir,manifest[p.id].local.replace(/^football\//,'')));skipped++;continue;}catch(e){}
  }
  try{manifest[p.id]=await one(p);downloaded++;}catch(e){missing++;errors.push([p.name,e.message]);}
  if(downloaded&&downloaded%25===0)console.log('Licensed portraits:',downloaded);
  await sleep(180);
 }
}
await Promise.all([worker(),worker(),worker(),worker()]);
await fs.writeFile(path.join(dir,'media.json'),JSON.stringify(Object.fromEntries(Object.entries(manifest).sort()),null,2)+'\n');
const lines=['# Licensed football portrait credits','','All photographs are cached from Wikimedia Commons with source and licence metadata. No synthetic faces or replica signatures are used.',''];
for(const [id,m] of Object.entries(manifest).sort()){
 const player=FOOTBALL_SEED.players.find(p=>p.id===id);
 lines.push('- **'+(player?.name||id)+'**: '+m.artist+'; '+m.license+'; '+m.sourcePage);
}
await fs.writeFile(path.join(dir,'CREDITS.md'),lines.join('\n')+'\n');
console.log('Media sync',JSON.stringify({processed:limit,downloaded,skipped,missing,available:Object.keys(manifest).length}));
if(errors.length)console.log('Missing samples',JSON.stringify(errors.slice(0,12)));
if(limit&&!downloaded&&!skipped)process.exitCode=2;
