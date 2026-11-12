import assert from 'node:assert/strict';
import {chromium,devices} from 'playwright';
import {spawn} from 'node:child_process';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {setTimeout as delay} from 'node:timers/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
const root=fileURLToPath(new URL('../',import.meta.url)),dir=fs.mkdtempSync(path.join(os.tmpdir(),'bitz2-browser-'));
let state=null,logs='',browser=null;
const cloud=createServer(async(req,res)=>{
 res.setHeader('Content-Type','application/json');
 if(req.method==='GET')return res.end(JSON.stringify(state?[{state}]:[]));
 if(req.method==='POST'){let s='';for await(const b of req)s+=b;state=JSON.parse(s)[0].state;res.writeHead(201);return res.end('{}');}
 res.writeHead(405);res.end('{}');
});
cloud.listen(0,'127.0.0.1');await once(cloud,'listening');
const reserve=createServer();reserve.listen(0,'127.0.0.1');await once(reserve,'listening');
const port=reserve.address().port;await new Promise(r=>reserve.close(r));
const app=spawn(process.execPath,['server.js'],{cwd:root,env:{...process.env,PORT:String(port),DATA_FILE:path.join(dir,'state.json'),STAKKZ_SECRET:'bitz2-browser-qa-key',STAKKZ_STORE_URL:'http://127.0.0.1:'+cloud.address().port+'/rest/v1/stakkz_state',STAKKZ_STORE_KEY:'test-key'}});
app.stdout.on('data',b=>logs+=b);app.stderr.on('data',b=>logs+=b);
const out=path.join(root,'qa-bitz2');fs.mkdirSync(out,{recursive:true});
try{
 let ready=false;for(let n=0;n<120;n++){if(app.exitCode!==null)throw Error('Server exited: '+logs);
  try{if((await fetch('http://127.0.0.1:'+port+'/api/ping')).ok){ready=true;break;}}catch(e){}await delay(100);
 }assert.ok(ready,'Server not listening: '+logs);
 browser=await chromium.launch({headless:true,executablePath:'/usr/bin/google-chrome',args:['--no-sandbox','--enable-unsafe-swiftshader','--use-angle=swiftshader']});
 for(const {name,options} of [{name:'desktop',options:{viewport:{width:1440,height:900},deviceScaleFactor:1}},{name:'phone',options:devices['iPhone 13']}]){
  const {defaultBrowserType,...opts}=options,context=await browser.newContext(opts),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:'+port,{waitUntil:'domcontentloaded'});
  await page.waitForSelector('#app[data-screen=home] #wbar [data-a=stuff]',{timeout:20000});
  await page.locator('#bload').waitFor({state:'detached',timeout:15000});
  assert.equal(await page.locator('#wbar [data-a=explore],#wbar [data-a=clans],#wbar [data-a=zombies]').count(),0);
  assert.equal(await page.locator('#wbar [data-a=stuff]').count(),1);
  assert.equal(await page.locator('#wui #wfire').isVisible(),false);
  assert.equal(await page.locator('#wui #whp').isVisible(),false);
  await page.screenshot({path:path.join(out,name+'-world.png'),animations:'disabled'});
  const world=await page.evaluate(()=>({webgl:!!document.createElement('canvas').getContext('webgl'),running:typeof B3!=='undefined'&&B3.ok,world:typeof B3!=='undefined'&&!!B3.world}));
  assert(world.world,'Character/world renderer missing');
  if(world.webgl)assert(world.running,'WebGL available but world did not render');
  await page.locator('#wbar [data-a=stuff]').click();
  await page.waitForSelector('#modal[data-kind=stuff]');
  assert.equal(await page.locator('#shopbig').isVisible(),false);
  await page.screenshot({path:path.join(out,name+'-inventory.png'),animations:'disabled'});
  await page.locator('#modal [data-a=close]').first().click();
  await page.locator('#wbar [data-a=loot]').click();
  await page.waitForSelector('#modal[data-kind=loot] .bx-odds');
  assert.equal(await page.locator('#modal .bx-theme-picker button').count(),3);
  const odds=await page.locator('#modal .bx-odds').innerText();
  assert(odds.includes('EPIC')&&odds.includes('LEGENDARY')&&odds.includes('MYTHICAL')&&odds.includes('SECRET'),'Rarity odds absent: '+odds);
  await page.locator('#modal .bx-theme-picker [data-v=cosmic]').click();
  assert((await page.locator('#modal .bx-cost').innerText()).includes('2,500,000'),'Theme price did not update');
  assert.equal(await page.locator('#shopbig').isVisible(),false);
  await page.screenshot({path:path.join(out,name+'-mystery-box.png'),animations:'disabled'});
  await page.locator('#modal [data-a=close]').first().click();
  await page.locator('#shopbig').click();
  await page.waitForSelector('#app[data-page=shop] #side .items',{timeout:15000});
  assert((await page.locator('#side').innerText()).includes('Shop'),'Shop not visible');
  await page.screenshot({path:path.join(out,name+'-shop.png'),animations:'disabled'});
  await page.locator('#leveltop').click();
  await page.waitForSelector('#modal[data-kind=level]');
  assert.equal(await page.locator('#shopbig').isVisible(),false);
  await page.locator('#modal [data-a=close]').first().click();
  const layout=await page.evaluate(()=>{
   const html=document.documentElement,r=(id)=>{const x=document.getElementById(id);if(!x||getComputedStyle(x).display==='none')return null;const a=x.getBoundingClientRect();return {x:a.x,y:a.y,width:a.width,height:a.height};};
   const overlap=(a,b)=>!!(a&&b&&a.x<b.x+b.width&&b.x<a.x+a.width&&a.y<b.y+b.height&&b.y<a.y+a.height);
   return {overflow:html.scrollWidth-html.clientWidth,shop:r('shopbig'),gold:r('goldtop'),level:r('leveltop'),overlapGoldLevel:overlap(r('goldtop'),r('leveltop')),overlapShopGold:overlap(r('shopbig'),r('goldtop'))};
  });
  assert(layout.overflow<=6,'Horizontal overflow '+JSON.stringify(layout));
  assert(!layout.overlapGoldLevel&&!layout.overlapShopGold,'Top controls overlap '+JSON.stringify(layout));
  assert.deepEqual(errors,[],'Uncaught JS errors '+errors.join(' | '));
  await context.close();console.log('PASS '+name+': lobby, inventory, Shop, themed boxes, progress, responsive controls, no browser errors');
 }
}finally{
 if(browser)await browser.close();
 if(app.exitCode===null){app.kill('SIGTERM');await Promise.race([once(app,'exit'),delay(4000)]);}
 if(app.exitCode===null)app.kill('SIGKILL');
 await new Promise(r=>cloud.close(r));fs.rmSync(dir,{recursive:true,force:true});
}
