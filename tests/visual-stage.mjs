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
    await page.waitForSelector('#app[data-screen=home] #wbar [data-v=world]');
    await sleep(1500);
    await page.screenshot({path:path.join(output,config.name+'-expanded-world.png'),animations:'disabled'});
    await page.evaluate(()=>document.querySelector('#bload')?.remove());
    await page.locator('#wbar [data-a=page][data-v=me]').click();
    await page.locator('#side .seg.nav [data-a=page][data-v=create]').click();
    await sleep(700);
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
    const visual=await page.evaluate(()=>{
      let st=Engine.newRoom('VISA',{mode:35,max:6,timer:30});
      for(let i=0;i<6;i++)st=Engine.join(st,'qa'+i,'Player '+i,{skin:i%5,hair:'short',outfit:'tee'},'');
      st=Engine.start(st,0,{now:Date.now(),rand:()=>.45,die:()=>3});
      st.players.forEach(p=>p.pos=5);
      st.own[1]={o:0,h:5};st.own[3]={o:0,h:3};
      window.__qaVisualState=st;
      setScreen('game');
      B3.sync(st,true);
      B3.markStations([15,25,35]);B3.setTime(.9);B3.setChaos(true);
      const angleBefore=B3.dbg().az;
      B3.resize();B3.resize();
      return {before:angleBefore,after:B3.dbg().az,stats:B3.visualStats()};
    });
    assert.equal(visual.stats.districtCount,8);
    assert.equal(visual.stats.stations,4);
    assert.equal(visual.stats.utilities,2);
    assert.equal(visual.stats.hotels,1);
    assert.equal(visual.stats.tokens,6);
    assert.equal(visual.stats.stationHighlights,3);
    assert.equal(visual.stats.chaos,true);
    assert(visual.stats.crowdScale.every(n=>n<.75),'Six tokens should stay distinct on a shared station');
    assert(Math.abs(visual.before-visual.after)<.001,'Resize must not reset the 3D camera');
    await sleep(800);
    await page.screenshot({path:path.join(output,config.name+'-six-players-hotel.png'),animations:'disabled'});
    await page.evaluate(async()=>{
      await B3.trainTravel(0,5,15);
      window.__qaVisualState.players[0].pos=15;
      B3.sync(window.__qaVisualState,true);
    });
    assert.equal(await page.evaluate(()=>B3.visualStats().traveling),-1,'Travel animation should release moving state');
    await page.screenshot({path:path.join(output,config.name+'-station-arrival.png'),animations:'disabled'});
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
