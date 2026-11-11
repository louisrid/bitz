import assert from 'node:assert/strict';
import { chromium, devices } from 'playwright';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';

const root=fileURLToPath(new URL('../',import.meta.url));
const storage={state:null};
const cloud=createServer(async(req,res)=>{
  res.setHeader('Content-Type','application/json');
  if(req.method==='GET')return res.end(JSON.stringify(storage.state?[{state:storage.state}]:[]));
  if(req.method==='POST'){
    let body='';for await(const b of req)body+=b;
    storage.state=JSON.parse(body)[0].state;
    res.writeHead(201);return res.end('{}');
  }
  res.writeHead(405);res.end();
});
cloud.listen(0,'127.0.0.1');await once(cloud,'listening');
const hold=createServer();hold.listen(0,'127.0.0.1');await once(hold,'listening');
const port=hold.address().port;await new Promise(r=>hold.close(r));
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'stakkz-ui-'));
const server=spawn(process.execPath,['server.js'],{
  cwd:root,env:{...process.env,PORT:String(port),DATA_FILE:path.join(tmp,'data.json'),
    STAKKZ_SECRET:'browser-e2e-testing-key-only',
    STAKKZ_STORE_URL:'http://127.0.0.1:'+cloud.address().port+'/rest/v1/stakkz_state',
    STAKKZ_STORE_KEY:'test-only'}
});
let serverLogs='',browser;
server.stdout.on('data',b=>{serverLogs+=b.toString()});
server.stderr.on('data',b=>{serverLogs+=b.toString()});
const url='http://127.0.0.1:'+port+'/';
const errors=[];
async function observe(page,name){
  page.on('pageerror',e=>errors.push(name+': '+e.message));
  await page.goto(url,{waitUntil:'domcontentloaded'});
  await page.waitForSelector('#title [data-a=go]');
}
async function openPage(page,name){
  await observe(page,name);
  await page.locator('#title .tmore [data-a=go][data-v=me]').click();
  await page.waitForSelector('#side [data-a=authregister]');
}
try {
  for(let i=0;i<80;i++){
    if(server.exitCode!==null)throw Error('Server exited: '+serverLogs);
    try{const r=await fetch(url+'api/ping');if(r.ok)break;}catch(e){}
    await delay(100);
  }
  browser=await chromium.launch({headless:true,executablePath:'/usr/bin/google-chrome',
    args:['--no-sandbox','--use-angle=swiftshader','--disable-software-rasterizer=false']});
  const desktop=await browser.newContext({viewport:{width:1440,height:900},deviceScaleFactor:1});
  const pc=await desktop.newPage();
  await openPage(pc,'desktop');
  await pc.locator('#side #auth-username').fill('BrowserTester');
  await pc.locator('#side #auth-password').fill('LongTestPassword2026!');
  await pc.locator('#side [data-a=authregister]').click();
  await pc.waitForFunction(()=>document.querySelector('#side .account-box')?.textContent.includes('Signed in'));
  console.log('Desktop user account created.');
  await pc.locator('#side [data-a=page][data-v=create]').click();
  await pc.locator('#side [data-a=settings]').click();
  await pc.evaluate(()=>{window.__oldControl=document.querySelector('#modal [data-a=set][data-k=music][data-v="0"]')});
  await pc.locator('#modal [data-a=set][data-k=music][data-v="0"]').click();
  assert(await pc.evaluate(()=>document.querySelector('#modal [data-a=set][data-k=music][data-v="0"]')===window.__oldControl),
    'Music toggle must update its own element without rebuilding the modal');
  await pc.locator('#modal [data-a=close]').first().click();
  await pc.locator('#side [data-a=seg][data-k=bots][data-v="2"]').click();
  await pc.locator('#side [data-a=seg][data-k=difficulty][data-v="hard"]').click();
  await pc.locator('#side [data-a=create]').click();
  await pc.waitForFunction(()=>document.querySelectorAll('#side .who:not(.empty)').length>=3);
  assert.equal(await pc.locator('#side .who:not(.empty)').count(),3);
  await pc.locator('#side [data-a=start]').click();
  await pc.waitForSelector('#app[data-screen=game]',{timeout:20000});
  console.log('Desktop modal, party, AI opponents and start-game UI passed.');

  const {defaultBrowserType, ...iphone} = devices['iPhone 13'];
  const phoneContext=await browser.newContext(iphone);
  const phone=await phoneContext.newPage();
  await observe(phone,'iPhone');
  await phone.locator('#title .tmore [data-a=go][data-v=me]').click();
  await phone.locator('#side #auth-username').fill('BrowserTester');
  await phone.locator('#side #auth-password').fill('LongTestPassword2026!');
  await phone.locator('#side [data-a=authlogin]').click();
  await phone.waitForSelector('#app[data-screen=game]',{timeout:20000});
  const size=await phone.evaluate(()=>({width:document.documentElement.scrollWidth,view:document.documentElement.clientWidth,
    screen:document.querySelector('#app').dataset.screen}));
  assert.equal(size.screen,'game');
  assert(size.width<=size.view+5,'Mobile page overflows horizontally: '+JSON.stringify(size));
  console.log('iPhone emulation: signed in to same account and resumed live game, no horizontal overflow.');
  if(errors.length) throw Error('Browser errors: '+errors.join(' | '));
} finally {
  if(browser)await browser.close();
  if(server.exitCode===null){server.kill('SIGTERM');await Promise.race([once(server,'exit'),delay(4000)])}
  if(server.exitCode===null)server.kill('SIGKILL');
  await new Promise(r=>cloud.close(r));
  fs.rmSync(tmp,{recursive:true,force:true});
}
