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
 browser=await chromium.launch({headless:true,executablePath:'/usr/bin/google-chrome',args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-gpu-sandbox']});
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
  assert.equal(await page.locator('#goldtop').isVisible(),true,'Gold balance must be visible in lobby');
  const world=await page.evaluate(()=>({webgl:!!document.createElement('canvas').getContext('webgl'),running:typeof B3!=='undefined'&&B3.ok,world:typeof B3!=='undefined'&&!!B3.world}));
  console.log(name+' graphics: '+JSON.stringify(world));
  assert(world.world,'Character/world renderer missing');
  if(world.webgl){
    assert(world.running,'WebGL available but world did not render');
    await page.waitForFunction(()=>B3.world?.on && B3.world?.me,null,{timeout:12000});
    const gfx=await page.evaluate(()=>new Promise(done=>requestAnimationFrame(()=>{
      const s=document.getElementById('stage'),a=document.getElementById('app'),renderer=B3._r;
      const bg={stage:getComputedStyle(s).backgroundColor,app:getComputedStyle(a).backgroundColor};
      const gl=renderer.getContext(),px=new Uint8Array(4),unique=new Set(),w=gl.drawingBufferWidth,h=gl.drawingBufferHeight;
      for(let x=2;x<=18;x++)for(let y=2;y<=13;y++){
        gl.readPixels(Math.floor(w*x/20),Math.floor(h*y/15),1,1,gl.RGBA,gl.UNSIGNED_BYTE,px);
        unique.add(px.join(','));
      }
      done({background:bg,uniquePixels:unique.size,player:!!B3.world.me,worldActive:!!B3.world.on});
    })));
    const isTransparent=color=>color==='transparent'||color==='rgba(0, 0, 0, 0)';
    assert(isTransparent(gfx.background.stage)&&isTransparent(gfx.background.app),'Opaque layers cover the 3D canvas: '+JSON.stringify(gfx));
    assert(gfx.player&&gfx.worldActive,'Lobby character not active: '+JSON.stringify(gfx));
    assert(gfx.uniquePixels>3,'World renderer appears blank: '+JSON.stringify(gfx));
    console.log(name+' lobby render: '+JSON.stringify(gfx));
  }
  await page.screenshot({path:path.join(out,name+'-world.png'),animations:'disabled'});
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
  await page.waitForTimeout(150);
  if(name==='phone'){const visible=await page.locator('#modal .bx-cta').first().evaluate(el=>{const r=el.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight+2;});assert(visible,'Mystery-box Buy/Open button is below the visible phone viewport');}
  assert((await page.locator('#modal .bx-cost').innerText()).includes('2,500,000'),'Theme price did not update');
  assert.equal(await page.locator('#shopbig').isVisible(),false);
  await page.screenshot({path:path.join(out,name+'-mystery-box.png'),animations:'disabled'});
  await page.locator('#modal [data-a=close]').first().click();
  await page.locator('#leveltop').click();
  await page.waitForSelector('#modal[data-kind=level]');
  await page.locator('#modal [data-a=close]').first().click();
  // Football cards overlay: classic Shop remains intact and cards are independent.
  await page.locator('#wbar [data-a=football]').click();
  await page.waitForSelector('#fc-overlay:not([hidden]) .fc-pack-grid',{timeout:20000});
  assert.equal(await page.locator('#fc-overlay .fc-pack-product').count(),9);
  assert.equal(await page.locator('#shopbig').isVisible(),false);
  await page.screenshot({path:path.join(out,name+'-football-packs.png'),animations:'disabled'});
  await page.locator('#fc-overlay [data-fc=tab][data-v=album]').click();
  await page.waitForSelector('#fc-overlay .fc-album-slots');
  assert.equal(await page.locator('#fc-overlay .fc-album-slot').count(),11);
  await page.screenshot({path:path.join(out,name+'-football-album.png'),animations:'disabled'});
  await page.locator('#fc-overlay [data-fc=tab][data-v=packs]').click();
  await page.locator('#fc-overlay [data-fc=open-select][data-v="first-xi"]').first().click();
  await page.waitForSelector('#fc-overlay #fc-rip');
  await page.locator('#fc-overlay [data-fc=unseal]').click();
  await page.waitForSelector('#fc-overlay #fc-flick',{timeout:20000});
  const distinct=await page.locator('#fc-overlay .fc-card').count();
  assert(distinct>=1,'A minted card must render during opening');
  await page.screenshot({path:path.join(out,name+'-football-reveal.png'),animations:'disabled'});
  await page.locator('#fc-overlay [data-fc=skip-open]').click();
  await page.waitForSelector('#fc-overlay .fc-open-summary');
  assert.equal(await page.locator('#fc-overlay .fc-summary-grid .fc-card').count(),5);
  await page.locator('#fc-overlay [data-fc=summary-collection]').click();
  await page.waitForSelector('#fc-overlay .fc-owned-grid .fc-owned');
  assert.equal(await page.locator('#fc-overlay .fc-owned-grid .fc-owned').count(),5);
  await page.locator('#fc-overlay .fc-owned [data-fc=favorite]').first().click();
  await page.waitForTimeout(350);
  assert((await page.locator('#fc-overlay .fc-owned [data-fc=favorite]').first().innerText()).includes('FAVOURITE'));
  await page.locator('#fc-overlay [data-fc=tab][data-v=trade]').click();
  await page.waitForSelector('#fc-overlay .fc-quest');
  await page.screenshot({path:path.join(out,name+'-football-trading.png'),animations:'disabled'});
  const overflow=await page.evaluate(()=>{const c=document.getElementById('fc-window');return c.scrollWidth-c.clientWidth;});
  assert(overflow<=5,'Football menu horizontally overflows: '+overflow);
  await page.locator('#fc-overlay .fc-top [data-fc=close]').click();
  await page.locator('#fc-overlay').waitFor({state:'hidden'});
  await page.evaluate(()=>profileOpen({self:true}));
  await page.waitForSelector('#fc-profile-favorites .fc-profile-grid .fc-card',{timeout:12000});
  assert.equal(await page.locator('#fc-profile-favorites .fc-card').count(),1);
  await page.evaluate(()=>profileClose());
  await page.locator('#shopbig').click();
  await page.waitForSelector('#app[data-page=shop] #side .items',{timeout:15000});
  assert((await page.locator('#side').innerText()).includes('Shop'),'Shop not visible');
  await page.screenshot({path:path.join(out,name+'-shop.png'),animations:'disabled'});
  assert.equal(await page.locator('#leveltop').isVisible(),false,'Level HUD must not cover the Shop');
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
