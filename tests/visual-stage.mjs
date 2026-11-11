import assert from 'node:assert/strict';
import {chromium,devices} from 'playwright';
import {spawn} from 'node:child_process';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {setTimeout as sleep} from 'node:timers/promises';
import {fileURLToPath} from 'node:url';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const root=fileURLToPath(new URL('../',import.meta.url));
const hold=createServer();hold.listen(0,'127.0.0.1');await once(hold,'listening');
const port=hold.address().port;await new Promise(r=>hold.close(r));
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'stakkz-visual-'));
const child=spawn(process.execPath,['server.js'],{cwd:root,env:{...process.env,
  PORT:String(port),DATA_FILE:path.join(dir,'state.json'),STAKKZ_SECRET:'beta-visual-qa-secret'}});
let logs='',browser;
child.stdout.on('data',b=>logs+=b.toString());child.stderr.on('data',b=>logs+=b.toString());
const url='http://127.0.0.1:'+port+'/';
const output=path.join(root,'qa-3d-screenshots');fs.mkdirSync(output,{recursive:true});
try {
  for(let i=0;i<75;i++){
    if(child.exitCode!==null)throw Error('Server quit: '+logs);
    try {const r=await fetch(url+'api/ping');if(r.ok)break;}catch(e){}
    await sleep(100);
  }
  browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',headless:true,
    args:['--no-sandbox','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader']});
  for(const config of [
    {name:'desktop-1440',opts:{viewport:{width:1440,height:900},deviceScaleFactor:1}},
    {name:'iphone-390',opts:{...devices['iPhone 13'],viewport:{width:390,height:844}}}
  ]) {
    const {defaultBrowserType,...options}=config.opts;
    const context=await browser.newContext(options);
    const page=await context.newPage();
    const errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.goto(url,{waitUntil:'domcontentloaded'});
    await page.waitForSelector('#title .tgo [data-v=create]');
    await page.locator('#title .tgo [data-v=create]').click();
    await sleep(1200);
    const ok=await page.evaluate(()=>typeof B3!=='undefined'&&B3.ok);
    assert(ok,config.name+' WebGL 3D renderer unavailable on GitHub runner');
    const r=await page.evaluate(()=>{
      const s=document.querySelector('#stage').getBoundingClientRect();
      return {stage:[s.x,s.y,s.width,s.height],screen:document.querySelector('#app').dataset.screen};
    });
    assert.equal(r.screen,'home');
    await page.screenshot({path:path.join(output,config.name+'-create.png'),animations:'disabled'});
    await page.locator('#side .seg.nav [data-v=me]').click();
    await sleep(700);
    await page.screenshot({path:path.join(output,config.name+'-profile.png'),animations:'disabled'});
    assert.equal(errors.length,0,config.name+' browser errors: '+errors.join(', '));
    console.log(config.name+' WebGL 3D screenshots captured and UI rendered, stage: '+JSON.stringify(r.stage));
    await context.close();
  }
} finally {
  if(browser)await browser.close();
  if(child.exitCode===null){child.kill('SIGTERM');await Promise.race([once(child,'exit'),sleep(4000)]);}
  if(child.exitCode===null)child.kill('SIGKILL');
  fs.rmSync(dir,{recursive:true,force:true});
}
