/* Visual test of ACTUAL BITZ card generator with real cached portraits.
   Requires Playwright Chromium: node tests/portrait-visual.mjs */
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { PUBLIC_CATALOGUE } from '../src/catalogue.js';
import { SETS, EDITIONS } from '../src/econ.js';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUB=path.join(ROOT,'public'),OUT=path.join(ROOT,'qa-screens');
fs.mkdirSync(OUT,{recursive:true});
const types={'.html':'text/html','.css':'text/css','.js':'text/javascript','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.otf':'font/otf'};
const server=http.createServer((req,res)=>{
  const url=decodeURIComponent(new URL(req.url,'http://localhost').pathname),full=path.resolve(PUB,'.'+url);
  if(!full.startsWith(PUB+path.sep)){res.writeHead(403);return res.end();}
  fs.readFile(full,(err,bytes)=>{
    if(err){res.writeHead(404);return res.end();}
    res.writeHead(200,{'Content-Type':types[path.extname(full)]||'application/octet-stream','Cache-Control':'no-store'});res.end(bytes);
  });
});
await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
const base='http://127.0.0.1:'+server.address().port;
const credits=JSON.parse(fs.readFileSync(path.join(PUB,'portraits/credits.json'),'utf8'));
const priority=['kylian-mbappe','lamine-yamal','vinicius-junior','jude-bellingham','harry-kane','khvicha-kvaratskhelia','virgil-van-dijk','kaoru-mitoma','bart-verbruggen','trent-alexander-arnold','arda-guler','jurrien-timber','georginio-rutter','ian-maatsen','kiernan-dewsbury-hall','jaden-philogene'];
const players=PUBLIC_CATALOGUE.players.filter(p=>credits[p.id]).sort((a,b)=>{
  const x=priority.indexOf(a.id),y=priority.indexOf(b.id);
  return (x<0?1000:x)-(y<0?1000:y);
}).slice(0,12);
if(players.length<6)throw Error('Need at least six real portraits for visual QA');
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
try{
  for(const [label,w,h,dpr] of [['desktop',1600,1130,1],['mobile',390,844,2]]){
    const page=await browser.newPage({viewport:{width:w,height:h},deviceScaleFactor:dpr,hasTouch:label==='mobile'});
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto(base+'/portraits/manifest.js',{waitUntil:'domcontentloaded'});
    const style='<style>html,body{height:auto;overflow:auto;user-select:auto;background:#f2f0f4;touch-action:auto}body{padding:24px 14px 48px}.qa{max-width:1460px;margin:0 auto}h1{font-size:32px;margin-bottom:6px}.sub{margin:0 0 22px;color:#555;font-size:14px}.cards{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:24px 14px;justify-items:center}.entry{width:100%;min-width:0;display:flex;flex-direction:column;align-items:center;gap:8px}.entry .bc{--w:min(100%,185px)}.label{font:800 13px system-ui;text-align:center}.entry .status{font:12px system-ui;color:#444}@media(max-width:650px){body{padding:16px 8px 32px}.cards{grid-template-columns:repeat(2,minmax(0,1fr));gap:22px 6px}.entry .bc{--w:min(100%,164px)}}</style>';
    const html='<!doctype html><html><head><meta charset="utf-8"><base href="'+base+'/"><link rel="stylesheet" href="'+base+'/bitz.css">'+style+'</head><body><main class="qa"><h1>BITZ portrait QA</h1><p class="sub">RED HOT · GOLDEN STAR · EUROPEAN NIGHTS</p><div id="cards" class="cards"></div></main></body></html>';
    await page.setContent(html,{waitUntil:'domcontentloaded'});
    await page.addScriptTag({url:base+'/portraits/manifest.js'});
    await page.addScriptTag({url:base+'/cards-art.js'});
    const list=players.map((p,i)=>({id:p.id,ed:i%3===0?'rh-fire':i%3===1?'gs-auto':'en-fullart',set:i%3===0?'red-hot':i%3===1?'golden-star':'european-nights'}));
    await page.evaluate(({catalogue,editions,sets,list})=>{
      window.BZART.setCatalogue({...catalogue,editions,sets});
      document.querySelector('#cards').innerHTML=list.map((r,i)=>{
        const p=window.BZART.player(r.id),c={uid:'qa'+i,player:r.id,players:[r.id],set:r.set,ed:r.ed,v:34000+i*19000};
        return '<div class="entry">'+window.BZART.card(c)+'<span class="label">'+p.name+'</span><span class="status">'+r.set+'</span></div>';
      }).join('');
    },{catalogue:PUBLIC_CATALOGUE,editions:EDITIONS,sets:SETS,list});
    await page.evaluate(()=>Promise.all([...document.querySelectorAll('.bc img')].map(img=>img.decode().catch(()=>{}))));
    const inspected=await page.evaluate(()=>[...document.querySelectorAll('.entry')].map(e=>{
      const img=e.querySelector('img'),r=img.getBoundingClientRect();
      return {player:e.querySelector('.label').textContent,src:img.currentSrc,loaded:img.complete&&img.naturalWidth>0,placeholder:img.currentSrc.endsWith('/placeholder.png'),source:[img.naturalWidth,img.naturalHeight],rendered:[Math.round(r.width),Math.round(r.height)]};
    }));
    if(errors.length)throw Error('Page errors: '+errors.join('; '));
    if(inspected.some(x=>!x.loaded||x.placeholder||x.rendered[0]<70||x.rendered[1]<70))throw Error('Image rendering failed: '+JSON.stringify(inspected));
    const signatures=await page.evaluate(()=>[...document.querySelectorAll('.bc.has-auto')].map(x=>({text:x.querySelector('svg.autograph text')?.textContent,zone:x.querySelector('.sig')?.getBoundingClientRect().height}))); if(!signatures.length||signatures.some(s=>!s.text||s.zone<12))throw Error('Signature treatment did not render: '+JSON.stringify(signatures));
    const outfile=path.join(OUT,'portrait-'+label+'.png');
    await page.screenshot({path:outfile,fullPage:true,animations:'disabled'});
    console.log(label.toUpperCase(),JSON.stringify(inspected),'\nScreenshot:',outfile);
    await page.close();
  }
}finally{await browser.close();await new Promise(ok=>server.close(ok));}
