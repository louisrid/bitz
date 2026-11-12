import assert from 'node:assert/strict';
import {chromium,devices} from 'playwright';
import {spawn} from 'node:child_process';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {setTimeout as sleep} from 'node:timers/promises';
import {fileURLToPath} from 'node:url';
import fs from 'node:fs';import path from 'node:path';import os from 'node:os';
const root=fileURLToPath(new URL('../',import.meta.url));
const hold=createServer();hold.listen(0,'127.0.0.1');await once(hold,'listening');
const port=hold.address().port;await new Promise(r=>hold.close(r));
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'bitz-visual-'));
const child=spawn(process.execPath,['server.js'],{cwd:root,env:{...process.env,PORT:String(port),DATA_FILE:path.join(dir,'state.json'),STAKKZ_SECRET:'visual-qa-key'}});
let logs='',browser;child.stdout.on('data',b=>logs+=b);child.stderr.on('data',b=>logs+=b);
const url='http://127.0.0.1:'+port+'/',output=path.join(root,'qa-3d-screenshots');
fs.mkdirSync(output,{recursive:true});
try{
 for(let i=0;i<80;i++){if(child.exitCode!==null)throw Error('Server quit: '+logs);try{if((await fetch(url+'api/ping')).ok)break;}catch(e){}await sleep(100);}
 browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader']});
 for(const config of [{name:'desktop-1440',opts:{viewport:{width:1440,height:900},deviceScaleFactor:1}},{name:'iphone-390',opts:{...devices['iPhone 13'],viewport:{width:390,height:844}}}]){
  const {defaultBrowserType,...opts}=config.opts,context=await browser.newContext(opts),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(url,{waitUntil:'domcontentloaded'});
  await page.waitForSelector('#app[data-screen=home] #wbar [data-v=world]');
  await page.evaluate(()=>document.querySelector('#bload')?.remove());
  await sleep(1400);
  const v=await page.evaluate(()=>{
   const map=globalThis.STAKKZ_WORLD_LAYOUT, b=globalThis.B3;
   return {three:!!globalThis.THREE,renderer:!!(b&&b.ok),env:!!globalThis.STAKKZ_BUILD_WORLD,layout:!!map,caves:map?.caves.length,field:map?.field,weaponCount:globalThis.BITZ_WEAPONS?.length,stage:document.querySelector('#stage').getBoundingClientRect().toJSON()};
  });
  assert(v.three&&v.renderer&&v.env&&v.layout,config.name+' WebGL scene not ready '+JSON.stringify(v));
  assert.equal(v.caves,3);
  assert(v.field>330);
  assert.equal(v.weaponCount,24);
  assert(v.stage.width>160&&v.stage.height>110);
  await page.screenshot({path:path.join(output,config.name+'-world.png'),animations:'disabled'});
  await page.locator('#wbar [data-a=explore]').click();
  await page.waitForSelector('#modal[data-kind=explore] .explore-place');
  await page.screenshot({path:path.join(output,config.name+'-explore.png'),animations:'disabled'});
  await page.locator('#modal [data-a=close]').first().click();
  await page.locator('#wbar [data-a=loot]').click();
  await page.waitForSelector('#modal[data-kind=loot] .bx-reel-track');
  await page.screenshot({path:path.join(output,config.name+'-mystery-box.png'),animations:'disabled'});
  assert.equal(errors.length,0,config.name+' page errors: '+errors.join(' | '));
  console.log(config.name+' WebGL 3D and gameplay menus rendered',JSON.stringify(v));
  await context.close();
 }
}finally{
 if(browser)await browser.close();
 if(child.exitCode===null){child.kill('SIGTERM');await Promise.race([once(child,'exit'),sleep(4000)]);}
 if(child.exitCode===null)child.kill('SIGKILL');
 fs.rmSync(dir,{recursive:true,force:true});
}
