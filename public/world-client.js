/* Stakkz open-world client, deliberately separate from the dormant board UI. */
(function(){
'use strict';
const css=`
#sw-root{position:fixed;inset:0;z-index:999;background:#95ccf4;color:#fff;font:600 14px system-ui;overflow:hidden}
#sw-canvas,#sw-profile-canvas{position:absolute;inset:0;width:100%;height:100%}
#sw-header{position:absolute;top:12px;left:12px;right:222px;display:flex;align-items:center;flex-wrap:wrap;gap:7px}
#sw-root button{background:#fff;color:#162339;border:2px solid #162339;border-radius:11px;padding:10px 12px;font:700 13px system-ui;cursor:pointer}
#sw-root button:disabled{opacity:.5}
#sw-root .sw-gold{background:#172d3eeb;border:1px solid #8cdd9d;border-radius:11px;padding:11px;white-space:nowrap}
#sw-side{position:absolute;right:0;top:0;bottom:0;width:214px;padding:15px 10px;box-sizing:border-box;background:#14293bea;border-left:2px solid #8eda99;overflow:auto}
#sw-side h2{font-size:17px;margin:0 0 10px}
#sw-side h3{font-size:14px}
#sw-side button{width:100%;margin:3px 0;text-align:left;background:#30445b;color:white;border:1px solid #6c97a9}
#sw-menu{position:absolute;top:73px;left:12px;bottom:18px;width:min(460px,calc(100vw - 242px));overflow:auto;padding:18px;box-sizing:border-box;border:2px solid #9af2a4;border-radius:18px;background:#142c3def}
#sw-menu[hidden],#sw-profile[hidden]{display:none}
#sw-menu h2{margin:0 0 10px;font-size:24px}
#sw-menu p{font-weight:400;line-height:1.4}
.sw-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
.sw-grid button{min-height:80px;text-align:left}
.sw-grid small{display:block;font-size:11px;font-weight:500;margin-top:5px}
.sw-tabs{display:flex;gap:6px;flex-wrap:wrap;margin:10px 0}
.sw-tabs button{padding:8px}
#sw-profile{position:absolute;inset:0 216px 0 0;background:linear-gradient(130deg,#132b49,#264d68)}
#sw-profile-box{position:absolute;left:24px;top:22px;background:#132b40ea;border:2px solid #a7ddec;border-radius:18px;max-width:340px;max-height:75%;overflow:auto;padding:18px;box-sizing:border-box}
#sw-profile-box h2{margin:8px 0;font-size:26px}
#sw-help{position:absolute;bottom:12px;left:14px;background:#14283be3;border-radius:10px;padding:10px;pointer-events:none}
#sw-alert{position:absolute;bottom:65px;left:14px;background:#14283b;padding:10px;border-radius:10px}
#sw-root input{padding:10px;background:white;color:black;border-radius:8px;max-width:88%}
#sw-combat{position:absolute;bottom:65px;right:232px;background:#172e42e9;border:2px solid #91eea3;border-radius:14px;padding:12px;display:flex;align-items:center;gap:8px;flex-wrap:wrap;max-width:400px}
#sw-combat button.active{background:#ffdc65}
#sw-hp{white-space:nowrap;min-width:100px}
#sw-crosshair{position:absolute;top:50%;left:calc((100% - 216px)/2);transform:translate(-50%,-50%);font-size:28px;color:#fff;pointer-events:none;text-shadow:0 0 4px #000}
#sw-combat .sw-weapon{font-size:12px;padding:8px}
@media(max-width:640px){#sw-side{width:145px;padding:8px}#sw-header{right:147px;top:5px;left:5px}#sw-menu{top:145px;left:5px;width:calc(100vw - 155px);padding:9px}#sw-profile{right:145px}#sw-profile-box{top:5px;left:5px;right:5px;padding:10px;max-height:52%}#sw-help{font-size:11px;max-width:48vw}}
`;
const style=document.createElement('style');style.textContent=css;document.head.appendChild(style);
const root=document.createElement('div');root.id='sw-root';root.innerHTML=`
<canvas id="sw-canvas"></canvas>
<div id="sw-header"><strong class="sw-gold">STAKKZ WORLD</strong><span id="sw-gold" class="sw-gold">1,000,000 gold</span><span class="sw-gold">+1,000/s</span><button data-sw="loot">Loot boxes</button><button data-sw="shop">Shop</button><button data-sw="wardrobe">Customise</button><button data-sw="self">Profile</button></div>
<aside id="sw-side"><h2>Online players</h2><div id="sw-roster">Connecting...</div><h3>Friend requests</h3><div id="sw-requests"></div><h3>Friends</h3><div id="sw-friends"></div></aside>
<div id="sw-menu" hidden></div>
<div id="sw-profile" hidden><canvas id="sw-profile-canvas"></canvas><div id="sw-profile-box"></div></div>
<div id="sw-combat"><span id="sw-hp">Health 100/100</span><button class="sw-weapon active" data-sw="weapon" data-id="blaster">1 · Blaster</button><button class="sw-weapon" data-sw="weapon" data-id="pulse">2 · Pulse</button><button data-sw="shoot">Shoot (F)</button></div><div id="sw-crosshair">+</div>
<div id="sw-help">WASD walk · Arrow keys rotate camera · Space jump · F shoot · 1/2 switch weapons · Click a character for profile</div><div id="sw-alert" hidden></div>`;
document.body.appendChild(root);
const $w=id=>document.getElementById(id);
const escapeHTML=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const gold=n=>Math.max(0,Math.floor(n)).toLocaleString('en-GB');
let players=new Map(),self='',ws=null,tab='',filter='outfit',profileId='',friends={friends:[],incoming:[],outgoing:[]},keys=new Set(),yaw=0,vy=0,last=performance.now(),lastSend=0,modelScene,renderer,cam,profScene,profRenderer,profCam,profModel,position=new THREE.Vector3();
let count=0, selectedWeapon='blaster',shotFX=[];
function alertMsg(t){$w('sw-alert').textContent=t;$w('sw-alert').hidden=false;clearTimeout(alertMsg.timer);alertMsg.timer=setTimeout(()=>$w('sw-alert').hidden=true,3000)}
function request(type,rest={}){if(ws?.readyState===1)ws.send(JSON.stringify({type,...rest}))}
function setup(){
 renderer=new THREE.WebGLRenderer({canvas:$w('sw-canvas'),antialias:true});
 renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.75));
 modelScene=new THREE.Scene();modelScene.background=new THREE.Color(0x98d4f1);modelScene.fog=new THREE.Fog(0x98d4f1,50,135);
 cam=new THREE.PerspectiveCamera(64,1,.1,175);
 modelScene.add(new THREE.HemisphereLight(0xffffff,0x5e7948,1.45));
 const sun=new THREE.DirectionalLight(0xfff9da,1.1);sun.position.set(22,35,20);modelScene.add(sun);
 const grass=new THREE.Mesh(new THREE.PlaneGeometry(150,150),new THREE.MeshLambertMaterial({color:0x68b95e}));grass.rotation.x=-Math.PI/2;grass.position.y=-.05;modelScene.add(grass);
 for(let i=0;i<65;i++){const a=i*2.399,r=15+(i*13%52),x=Math.sin(a)*r,z=Math.cos(a)*r;
   const trunk=new THREE.Mesh(new THREE.CylinderGeometry(.2,.26,2.2,6),new THREE.MeshLambertMaterial({color:0x6f563c}));trunk.position.set(x,1.1,z);
   const canopy=new THREE.Mesh(new THREE.IcosahedronGeometry(1.55,0),new THREE.MeshLambertMaterial({color:i%3?0x4a9b52:0x82cb66}));canopy.position.set(x,2.7,z);modelScene.add(trunk,canopy);
 }
 profRenderer=new THREE.WebGLRenderer({canvas:$w('sw-profile-canvas'),alpha:true,antialias:true});profRenderer.setPixelRatio(Math.min(devicePixelRatio||1,1.5));
 profScene=new THREE.Scene();profScene.add(new THREE.HemisphereLight(0xffffff,0x7380a3,1.7));
 const lt=new THREE.DirectionalLight(0xffe8ca,1.5);lt.position.set(5,8,6);profScene.add(lt);
 profCam=new THREE.PerspectiveCamera(34,1,.1,60);
}
function addWeaponVisual(q){
 if(!q.obj)return;
 const old=q.obj.getObjectByName('stakkz-weapon');if(old)q.obj.remove(old);
 const holder=new THREE.Group();holder.name='stakkz-weapon';
 // Parent geometry lives on the character group, visible to every player.
 const pulse=q.weapon==='pulse';
 const body=new THREE.Mesh(new THREE.BoxGeometry(pulse?.27:.2,pulse?.2:.18,pulse?1.02:.7),new THREE.MeshLambertMaterial({color:pulse?0x35cdea:0x404855}));
 body.position.set(.8,1.55,.42);holder.add(body);
 const barrel=new THREE.Mesh(new THREE.CylinderGeometry(pulse?.11:.075,pulse?.11:.075,pulse?.4:.28,8),new THREE.MeshBasicMaterial({color:pulse?0x7ffff0:0xffd977}));
 barrel.rotation.x=Math.PI/2;barrel.position.set(.8,1.55,pulse?1.02:.87);holder.add(barrel);
 const grip=new THREE.Mesh(new THREE.BoxGeometry(.13,.36,.16),new THREE.MeshLambertMaterial({color:0x20242c}));grip.position.set(.8,1.34,.35);holder.add(grip);
 q.obj.add(holder);
}
function avatar(q){
 if(q.obj)modelScene.remove(q.obj);
 q.obj=B3.createAvatar(q.look||{},q.id===self?'#f9d34a':'#87dded');
 q.obj.position.set(q.x||0,q.y||0,q.z||0);
 q.obj.rotation.y=q.yaw||0;
 q.obj.traverse(node=>node.userData.swid=q.id);
 modelScene.add(q.obj);addWeaponVisual(q);
}
function upsert(q){
 if(!q?.id)return;
 let p=players.get(q.id),changed=!p||JSON.stringify(p.look)!==JSON.stringify(q.look);
 if(!p){p={...q};players.set(q.id,p);}else Object.assign(p,q);
 if(changed||!p.obj)avatar(p);
 if(q.id===self&&p.obj){position.set(p.x||0,p.y||0,p.z||0);yaw=p.yaw||0;}
 renderRoster();
 if(profileId===q.id)showProfile(q.id);
}
function renderRoster(){
 const a=[...players.values()].sort((x,y)=>x.id===self?-1:y.id===self?1:0);
 $w('sw-roster').innerHTML=a.map(p=>'<button data-sw="profile" data-id="'+escapeHTML(p.id)+'">'+escapeHTML(p.name||'Player')+(p.id===self?' (you)':'')+' · '+(p.swag??-100)+' swag</button>').join('')||'No players';
 $w('sw-requests').innerHTML=(friends.incoming||[]).map(id=>'<button data-sw="profile" data-id="'+id+'">'+escapeHTML(players.get(id)?.name||'Friend request')+'</button><button data-sw="friend" data-op="accept" data-id="'+id+'">Accept</button>').join('')||'<p>None</p>';
 $w('sw-friends').innerHTML=(friends.friends||[]).map(id=>'<div><button data-sw="profile" data-id="'+id+'">'+escapeHTML(players.get(id)?.name||'Friend')+'</button><button data-sw="friend" data-op="remove" data-id="'+id+'">Remove friend</button></div>').join('')||'<p>No friends yet</p>';
}
function connect(){
 if(ws&&ws.readyState===1)return;
 ws=new WebSocket((location.protocol==='https:'?'wss://':'ws://')+location.host+'/api/world/ws');
 ws.onopen=()=>request('hello',{token:activeKey});
 ws.onmessage=e=>{
 let m;try{m=JSON.parse(e.data)}catch(_){return}
 if(m.type==='snapshot'){
 self=m.self;friends={friends:m.friends||[],incoming:m.incoming||[],outgoing:m.outgoing||[]};
 players.forEach(p=>p.obj&&modelScene.remove(p.obj));players.clear();
 m.players.forEach(upsert);renderRoster();
 }else if(m.type==='profile')upsert(m.player);
 else if(m.type==='leave'){let p=players.get(m.id);if(p?.obj)modelScene.remove(p.obj);players.delete(m.id);renderRoster();}
 else if(m.type==='move'){let p=players.get(m.id);if(p&&m.id!==self){p.x=m.x;p.z=m.z;p.y=m.y;p.yaw=m.yaw;}}
 else if(m.type==='combat')combatEvent(m);
 else if(m.type==='friends'){friends={friends:m.friends||[],incoming:m.incoming||[],outgoing:m.outgoing||[]};renderRoster();}
 };
 ws.onclose=()=>{setTimeout(connect,2000);};
}
function combatEvent(m){
 const p=players.get(m.id);
 if(m.event==='equip'){if(p){p.weapon=m.weapon;addWeaponVisual(p);}return;}
 if(m.event==='health'){if(p)p.hp=m.hp;if(m.id===self)$w('sw-hp').textContent='Health '+m.hp+'/100';return;}
 if(m.event==='ko'){
   if(p){p.hp=0;p.respawnAt=m.respawnAt;}
   const attacker=players.get(m.by);if(attacker)attacker.knockouts=m.knockouts;
   alertMsg((p?.name||'A player')+' was eliminated'+(attacker?' by '+attacker.name:'')+'. Respawning...');
   return;
 }
 if(m.event==='respawn'){
   if(p){p.hp=100;p.respawnAt=0;p.x=m.x;p.z=m.z;if(p.obj)p.obj.position.set(m.x,0,m.z);}
   if(m.id===self){position.set(m.x,0,m.z);vy=0;$w('sw-hp').textContent='Health 100/100';}
   return;
 }
 if(m.event==='shot'){
   const from=new THREE.Vector3(m.x,2.1+(m.y||0),m.z);
   const to=m.hit&&players.get(m.hit)?new THREE.Vector3(players.get(m.hit).x,2.1+(players.get(m.hit).y||0),players.get(m.hit).z):new THREE.Vector3(m.x+Math.sin(m.yaw)*24,2.1+(m.y||0),m.z+Math.cos(m.yaw)*24);
   const direction=to.clone().sub(from),length=direction.length();
   if(length<.1)return;
   const geometry=new THREE.CylinderGeometry(.04,.04,length,6);
   const material=new THREE.MeshBasicMaterial({color:m.weapon==='pulse'?0x6bf7ff:0xffdf6e,transparent:true,opacity:.87});
   const beam=new THREE.Mesh(geometry,material);
   beam.position.copy(from).addScaledVector(direction,.5);
   beam.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),direction.normalize());
   modelScene.add(beam);shotFX.push({obj:beam,until:performance.now()+150});
 }
}
function shoot(){if(profileId)return;const p=players.get(self);if(!p||p.hp===0)return;request('shoot');}
function equipWeapon(w){if(!['blaster','pulse'].includes(w))return;selectedWeapon=w;const me=players.get(self);if(me){me.weapon=w;addWeaponVisual(me);}request('weapon',{weapon:w});document.querySelectorAll('[data-sw="weapon"]').forEach(b=>b.classList.toggle('active',b.dataset.id===w));}
function equip(id){if(!ITEMS[id]||!wallet.own.includes(id)&&ITEMS[id][2]!==0)return;
 let slot=ITEMS[id][0];if(slot==='pet')F.pet=id;else if(slot==='dye'){F.look.hc=4;}else F.look[slot]=id;
 styleChanged();api('me',acctBody()).then(()=>{if(players.has(self)){let p=players.get(self);p.look={...F.look};p.pet=F.pet;avatar(p);}}).catch(()=>{});}
function renderMenu(){
 const menu=$w('sw-menu');if(!tab){menu.hidden=true;return;}menu.hidden=false;
 const close='<button data-sw="close">Close</button>';
 if(tab==='shop'||tab==='wardrobe'){
 const slots=['outfit','hat','acc','pet','bg'];
 const ids=Object.keys(ITEMS).filter(id=>ITEMS[id][0]===filter&&(tab==='shop'?ITEMS[id][2]>0:wallet.own.includes(id)||ITEMS[id][2]===0)).sort((a,b)=>ITEMS[a][2]-ITEMS[b][2]);
 menu.innerHTML='<h2>'+(tab==='shop'?'Shop':'Customise')+'</h2><p>'+gold(wallet.coins)+' gold. Earn 1,000 gold every second. All purchases are permanent.</p>'+
 '<div class="sw-tabs">'+slots.map(s=>'<button data-sw="filter" data-id="'+s+'">'+s.toUpperCase()+'</button>').join('')+'</div><div class="sw-grid">'+ids.map(id=>{
 const it=ITEMS[id],own=wallet.own.includes(id)||it[2]===0;
 return '<button data-sw="'+(tab==='shop'&&!own?'buy':'equip')+'" data-id="'+id+'" '+(tab==='shop'&&!own&&it[2]>wallet.coins?'disabled':'')+'><strong>'+escapeHTML(it[1])+'</strong><small>'+(own?'Owned · Click to equip':gold(it[2])+' gold')+'</small></button>';
 }).join('')+'</div>'+close;
 }else if(tab==='loot'){
 menu.innerHTML='<h2>Mythic loot boxes</h2><p><b>'+wallet.boxes+' boxes ready.</b> Each box costs 500,000 gold. Every box contains an exclusive legendary or mythical costume, never ordinary shop items or coins.</p><p>One box every 8 minutes 20 seconds. Mythicals are much rarer than legendaries. Your opening is decided securely by the server.</p>'+
 '<div class="sw-grid">'+globalThis.STAKKZ_CATALOG.EXCLUSIVES.map(id=>'<button disabled><strong>'+escapeHTML(ITEMS[id][1])+'</strong><small>'+(ITEMS[id][3]||'Legendary')+'</small></button>').join('')+'</div>'+
 '<p><button data-sw="boxbuy" '+(wallet.coins<BOX_PRICE?'disabled':'')+'>Buy box · 500,000 gold</button> <button data-sw="boxopen" '+(!wallet.boxes?'disabled':'')+'>Open loot box ('+wallet.boxes+')</button></p>'+close;
 }else if(tab==='settings'){
 menu.innerHTML='<h2>Profile & account</h2><p>Signed in: '+escapeHTML(authInfo.username||'Guest')+'</p><p>Current swag: '+(players.get(self)?.swag??-100)+' / 9999</p><p>Name: '+escapeHTML(F.name||'Player')+'</p><p>Use the existing profile customisation menu to set your name, then come back to the world.</p>'+close;
 }
}
async function showProfile(id){
 profileId=id;$w('sw-profile').hidden=false;
 let p=players.get(id);
 if(!p){try{const q=await api('world-profile/'+encodeURIComponent(id));p={...q,id};}catch(e){alertMsg('Player not found');return;}}
 if(!p)return;
 if(profModel)profScene.remove(profModel);
 profModel=B3.createAvatar(p.look||{},'#ffdc5c');profScene.add(profModel);
 const equipped=[p.look?.outfit,p.look?.hat,p.look?.acc,p.look?.bg,p.pet].filter(Boolean);
 const mine=id===self, isFriend=friends.friends.includes(id), incoming=friends.incoming.includes(id),pending=friends.outgoing.includes(id);
 let actions=mine?'':isFriend?'<button data-sw="friend" data-op="remove" data-id="'+id+'">Remove friend</button>':incoming?'<button data-sw="friend" data-op="accept" data-id="'+id+'">Accept friend</button>':pending?'<button disabled>Request sent</button>':'<button data-sw="friend" data-op="request" data-id="'+id+'">Add friend</button>';
 $w('sw-profile-box').innerHTML='<button data-sw="profileclose">Back to world</button><h2>'+escapeHTML(p.name||'Player')+'</h2><h3>SWAG LEVEL: '+(p.swag??-100)+' / 9999</h3><p>Swag is calculated from the rarity of equipped items and the size of the collection. Everyone starts at -100.</p><h3>Wearing</h3><div>'+equipped.map(k=>'<p>• '+escapeHTML(ITEMS[k]?.[1]||k)+' · '+(ITEMS[k]?.[3]||'Shop')+'</p>').join('')+'</div>'+actions;
 const bg=p.look?.bg||'paper';const palette=ITEMS[bg]?.[4]||['#c8f0ff','#486c9c'];$w('sw-profile').style.background='linear-gradient(140deg,'+palette[0]+','+palette[1]+')';
}
async function act(e){
 const btn=e.target.closest('[data-sw]');if(!btn)return;const action=btn.dataset.sw,id=btn.dataset.id;
 if(action==='profile')return showProfile(id);
 if(action==='weapon'){equipWeapon(id);return;}
 if(action==='shoot'){shoot();return;}
 if(action==='profileclose'){profileId='';$w('sw-profile').hidden=true;return;}
 if(action==='self')return showProfile(self);
 if(action==='close'){tab='';renderMenu();return;}
 if(action==='shop'||action==='loot'||action==='wardrobe'||action==='settings'){tab=tab===action?'':action;renderMenu();return;}
 if(action==='filter'){filter=id;renderMenu();return;}
 if(action==='equip'){equip(id);renderMenu();return;}
 if(action==='buy'){try{await api('shop',{op:'buy',item:id});equip(id);alertMsg('Purchased '+ITEMS[id][1]);}catch(er){alertMsg(er.message||'Purchase failed')}renderMenu();return;}
 if(action==='boxbuy'){try{await api('shop',{op:'box'});alertMsg('Loot box purchased');}catch(er){alertMsg(er.message||'Not enough gold')}renderMenu();return;}
 if(action==='boxopen'){try{const r=await api('shop',{op:'open'});const won=r.prize?.item;alertMsg('YOU UNBOXED: '+(ITEMS[won]?.[1]||'Surprise!'));}catch(er){alertMsg(er.message||'Could not open box')}renderMenu();return;}
 if(action==='friend'){try{friends=await api('friends',{op:btn.dataset.op,target:id});renderRoster();showProfile(id);alertMsg('Friends updated')}catch(er){alertMsg(er.message||'Could not update friend')}return;}
}
root.addEventListener('click',act);
$w('sw-canvas').addEventListener('contextmenu',e=>{e.preventDefault();shoot();});
window.addEventListener('keydown',e=>{if(/^(INPUT|TEXTAREA)$/.test(document.activeElement?.tagName||''))return;
  if(e.key.toLowerCase()==='f'){e.preventDefault();if(!e.repeat)shoot();}
  if(e.key==='1')equipWeapon('blaster');if(e.key==='2')equipWeapon('pulse');
},true);
window.addEventListener('keydown',e=>{if(/^(INPUT|TEXTAREA)$/.test(document.activeElement?.tagName||''))return;
 if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown',' ','w','a','s','d','W','A','S','D'].includes(e.key)){keys.add(e.key.toLowerCase());e.preventDefault();}},true);
window.addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()),true);
window.addEventListener('blur',()=>keys.clear());
const raycaster=new THREE.Raycaster(),mouse=new THREE.Vector2();
$w('sw-canvas').addEventListener('click',e=>{
 const r=$w('sw-canvas').getBoundingClientRect();mouse.set(((e.clientX-r.left)/r.width)*2-1,-((e.clientY-r.top)/r.height)*2+1);
 raycaster.setFromCamera(mouse,cam);
 const targets=[...players.values()].filter(p=>p.id!==self).map(p=>p.obj).filter(Boolean);
 const hits=raycaster.intersectObjects(targets,true);
 if(hits.length){let n=hits[0].object;while(n&&!n.userData.swid)n=n.parent;if(n?.userData.swid)showProfile(n.userData.swid);}
});
function frame(now){
 requestAnimationFrame(frame);
 let dt=Math.min(.05,(now-last)/1000);last=now;
 const w=$w('sw-canvas').clientWidth,h=$w('sw-canvas').clientHeight;
 if(w&&h&&(renderer.domElement.width!==Math.round(w*renderer.getPixelRatio())||renderer.domElement.height!==Math.round(h*renderer.getPixelRatio()))){renderer.setSize(w,h,false);cam.aspect=w/h;cam.updateProjectionMatrix();}
 const me=players.get(self);
 if(me&&me.obj){
 if(me.hp===0)keys.clear();
 const x=(keys.has('d')?1:0)-(keys.has('a')?1:0),z=(keys.has('w')?1:0)-(keys.has('s')?1:0);
 if(keys.has('arrowleft'))yaw+=dt*2.1;
 if(keys.has('arrowright'))yaw-=dt*2.1;
 const len=Math.hypot(x,z)||1,speed=6.5;
 const dx=(Math.sin(yaw)*z+Math.cos(yaw)*x)/len*speed*dt,dz=(Math.cos(yaw)*z-Math.sin(yaw)*x)/len*speed*dt;
 position.x=Math.max(-72,Math.min(72,position.x+dx));position.z=Math.max(-72,Math.min(72,position.z+dz));
 if(keys.has(' ')&&position.y<.01)vy=7;
 vy-=18*dt;position.y=Math.max(0,position.y+vy*dt);if(position.y===0)vy=0;
 me.x=position.x;me.z=position.z;me.y=position.y;me.yaw=yaw;
 me.obj.position.copy(position);me.obj.rotation.y=yaw;
 const cy=keys.has('arrowup')?1:keys.has('arrowdown')?-1:0;
 frame.pitch=Math.max(-.35,Math.min(.75,(frame.pitch||.17)+cy*dt));
 const a=yaw,dist=8;
 cam.position.set(position.x-Math.sin(a)*dist,position.y+4.3+frame.pitch*4,position.z-Math.cos(a)*dist);
 cam.lookAt(position.x,position.y+2,position.z);
 if(now-lastSend>90){request('move',{x:position.x,z:position.z,y:position.y,yaw});lastSend=now;}
 }
 for(const p of players.values()){
 if(!p.obj)continue;
 if(p.id!==self){p.obj.position.lerp(new THREE.Vector3(p.x||0,p.y||0,p.z||0),Math.min(1,dt*11));p.obj.rotation.y=p.yaw||0;}
 p.obj.userData.animateFX?.(now/1000);
 }
 for(let i=shotFX.length-1;i>=0;i--){const q=shotFX[i];if(now>=q.until){modelScene.remove(q.obj);q.obj.geometry.dispose();q.obj.material.dispose();shotFX.splice(i,1);}}
 renderer.render(modelScene,cam);
 if(profileId&&profModel){
 const ww=$w('sw-profile').clientWidth,hh=$w('sw-profile').clientHeight;
 if(ww>0&&hh>0){profRenderer.setSize(ww,hh,false);profCam.aspect=ww/hh;profCam.updateProjectionMatrix();
 profCam.position.set(5,3.9,11.7);profCam.lookAt(0,1.9,0);
 profModel.rotation.y=now*.0003;profModel.userData.animateFX?.(now/1000);profRenderer.render(profScene,profCam);}
 }
 if(count++%8===0){
 const estimate=wallet.coins+Math.min(600000,Math.max(0,(Date.now()+skew-(wallet.earnAt||Date.now()))/1000))*1000;
 $w('sw-gold').textContent=gold(estimate)+' gold';}
}
async function boot(){
 setup();requestAnimationFrame(frame);
 await capsReady;
 try{await api('me');}catch(_){}
 connect();
 renderRoster();
 setInterval(async()=>{try{await api('me');if(tab)renderMenu();}catch(_){ }},4500);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden&&(!ws||ws.readyState!==1))connect();});
}
boot();
})();