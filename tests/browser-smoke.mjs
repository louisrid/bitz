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
const root=fileURLToPath(new URL('../',import.meta.url));
const store={state:null};
const cloud=createServer(async(req,res)=>{
 res.setHeader('Content-Type','application/json');
 if(req.method==='GET')return res.end(JSON.stringify(store.state?[{state:store.state}]:[]));
 if(req.method==='POST'){let body='';for await(const b of req)body+=b;store.state=JSON.parse(body)[0].state;res.writeHead(201);return res.end('{}');}
 res.writeHead(405);res.end();
});
cloud.listen(0,'127.0.0.1');await once(cloud,'listening');
const hold=createServer();hold.listen(0,'127.0.0.1');await once(hold,'listening');
const port=hold.address().port;await new Promise(r=>hold.close(r));
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'bitz-browser-'));
const server=spawn(process.execPath,['server.js'],{cwd:root,env:{...process.env,PORT:String(port),DATA_FILE:path.join(tmp,'data.json'),STAKKZ_SECRET:'browser-e2e-test-only',STAKKZ_STORE_URL:'http://127.0.0.1:'+cloud.address().port+'/rest/v1/stakkz_state',STAKKZ_STORE_KEY:'test-key'}});
let logs='',browser;server.stdout.on('data',b=>logs+=b);server.stderr.on('data',b=>logs+=b);
const url='http://127.0.0.1:'+port+'/';
const output=path.join(root,'qa-screenshots');fs.mkdirSync(output,{recursive:true});
try{
 for(let i=0;i<90;i++){if(server.exitCode!==null)throw Error('Server exited '+logs);try{if((await fetch(url+'api/ping')).ok)break;}catch(e){}await delay(100);}
 browser=await chromium.launch({headless:true,executablePath:'/usr/bin/google-chrome',args:['--no-sandbox','--enable-unsafe-swiftshader','--use-angle=swiftshader']});
 for(const config of [{name:'desktop',opts:{viewport:{width:1440,height:900},deviceScaleFactor:1}},{name:'phone',opts:devices['iPhone 13']}]){
  const {defaultBrowserType,...opts}=config.opts;
  const context=await browser.newContext(opts),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{
   const get=HTMLCanvasElement.prototype.getContext;
   HTMLCanvasElement.prototype.getContext=function(type,...args){return ['webgl','webgl2','experimental-webgl'].includes(type)?null:get.call(this,type,...args);};
  });
  await page.goto(url,{waitUntil:'domcontentloaded'});
  await page.waitForSelector('#app[data-screen=home] #wbar [data-a=page][data-v=world]');
  await page.evaluate(()=>document.querySelector('#bload')?.remove());
  assert(await page.locator('#wbar [data-a=stuff]').count(),'My Stuff shortcut absent');
  assert(await page.locator('#wbar [data-a=explore]').count(),'Explore shortcut absent');
  assert(await page.locator('#wbar [data-a=clans]').count(),'Clans shortcut absent');
  await page.locator('#wbar [data-a=stuff]').click();
  await page.waitForSelector('#modal[data-kind=stuff]');
  assert(await page.locator('#shopbig').isHidden(),'Shop overlaps inventory modal');
  await page.screenshot({path:path.join(output,config.name+'-stuff.png'),animations:'disabled'});
  await page.locator('#modal [data-a=close]').first().click();
  await page.locator('#wbar [data-a=explore]').click();
  await page.waitForSelector('#modal[data-kind=explore] .explore-place');
  assert.equal(await page.locator('.explore-place').count(),5,'Expected centre, three caves and waterfall');
  await page.screenshot({path:path.join(output,config.name+'-explore.png'),animations:'disabled'});
  await page.locator('#modal [data-a=close]').first().click();
  await page.locator('#wbar [data-a=clans]').click();
  await page.waitForSelector('#modal[data-kind=clans] .clan-panel',{timeout:15000});
  await page.screenshot({path:path.join(output,config.name+'-clans.png'),animations:'disabled'});
  assert(await page.locator('#shopbig').isHidden(),'Shop overlaps clan modal');
  await page.locator('#modal [data-a=close]').first().click();
  await page.locator('#wbar [data-a=loot]').click();
  await page.waitForSelector('#modal[data-kind=loot] .bx-odds');
  const odds=await page.locator('#modal .bx-odds').innerText();
  for(const value of ['5%','15%','45%','35%'])assert(odds.includes(value),'Missing rate '+value);
  assert(await page.locator('#modal .bx-reel-track .bx-card').count()>0,'No prize ticker');
  await page.screenshot({path:path.join(output,config.name+'-loot.png'),animations:'disabled'});
  assert(await page.locator('#shopbig').isHidden(),'Shop overlaps loot');
  await page.locator('#modal [data-a=close]').first().click();
  await page.locator('#shopbig').click();
  await page.waitForSelector('#app[data-page=shop] #side .items');
  await page.screenshot({path:path.join(output,config.name+'-shop.png'),animations:'disabled'});
  await page.locator('#side .seg.nav [data-v=me]').click();
  await page.waitForSelector('#side .account-box');
  await page.screenshot({path:path.join(output,config.name+'-profile.png'),animations:'disabled'});
  const dims=await page.evaluate(()=>({total:document.documentElement.scrollWidth,width:document.documentElement.clientWidth}));
  assert(dims.total<=dims.width+6,'Horizontal overflow '+JSON.stringify(dims));
  assert.equal(errors.length,0,'Uncaught browser errors '+errors.join(' | '));
  await context.close();
  console.log(config.name+': inventory, clans, explore, real odds, shop, profile, no overlays or JS errors pass');
 }
}finally{
 if(browser)await browser.close();
 if(server.exitCode===null){server.kill('SIGTERM');await Promise.race([once(server,'exit'),delay(4000)]);}
 if(server.exitCode===null)server.kill('SIGKILL');
 await new Promise(r=>cloud.close(r));fs.rmSync(tmp,{recursive:true,force:true});
}
