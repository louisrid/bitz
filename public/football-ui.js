/* Football card catalogue, pack store, album, profiles and server-ledger trading.
   No generated images are used. Photographs come from cached licensed Wikimedia
   assets or author/source-attributed Wikimedia URLs; the fallback is a clean
   graphic initial rather than a synthetic face. */
(function(){
 'use strict';
 const $=s=>document.querySelector(s), esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const money=c=>'$'+(Number(c||0)/100).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
 const gold=n=>Math.floor(Number(n)||0).toLocaleString('en-GB');
 const byId=new Map(),clubs=new Map();
 const state={tab:'packs',catalog:null,self:null,selected:'first-xi',open:null,club:'arsenal',europe:false,
   focus:null,favs:[],other:null,friendList:[],partner:'',partnerCards:[],give:[],take:[],sourceManifest:null,
   images:new Map(),pending:new Set(),busy:false,active:false,page:0};
 const shell=document.createElement('section');shell.id='fc-overlay';shell.hidden=true;shell.setAttribute('aria-label','Football cards');
 shell.innerHTML='<div class="fc-backdrop" data-fc="close"></div><div id="fc-window" role="dialog" aria-modal="true" aria-label="BITZ football cards"><div id="fc-content"></div></div>';
 document.body.appendChild(shell);
 function catalogReady(j){
  state.catalog=j;byId.clear();clubs.clear();
  (j.players||[]).forEach(x=>byId.set(x.id,x));
  [...j.clubs,...j.europe].forEach(x=>clubs.set(x.id,x));
 }
 function own(){return state.self?.cards||[];}
 function countPack(id){return Number(state.self?.packs?.[id]||0);}
 function cardName(c){return (c.players||[c.player]).map(id=>byId.get(id)?.name||id).join(' + ');}
 function clubOf(c){return clubs.get(byId.get(c.player)?.club);}
 function tier(c){return state.catalog?.variants?.[c.variant]?.tier||'Base';}
 function skin(c){return /^[a-zA-Z0-9-]+$/.test(c.pack)?c.pack:'first-xi';}
 function imgFor(id){
  const info=state.images.get(id)||state.sourceManifest?.[id];
  return typeof info==='string'?info:info?.local||info?.thumbnail||info?.url||byId.get(id)?.portrait||'';
 }
 function portrait(player){
  const id=player?.id||'',url=imgFor(id);
  if(url)return '<img class="fc-portrait" loading="lazy" referrerpolicy="no-referrer" alt="'+esc(player?.name||'Player')+'" src="'+esc(url)+'">';
  if(id)state.pending.add(id);
  const initials=String(player?.name||'?').split(' ').map(n=>n[0]).slice(0,2).join('');
  return '<div class="fc-no-photo"><span>'+esc(initials)+'</span><small>PORTRAIT PENDING</small></div>';
 }
 function frame(card,{small=false}={}){
  const id=card?.player||card?.players?.[0],player=byId.get(id),def=state.catalog?.variants?.[card?.variant]||{};
  const collection=state.catalog?.packs?.[card?.pack],club=clubOf(card),dual=(card?.players||[]).length>1;
  const partner=dual?byId.get(card.players[1]):null;
  const display=dual?'<div class="fc-portrait-pair">'+portrait(player)+portrait(partner)+'</div>':portrait(player);
  const autograph=def.signature?'<div class="fc-signature"><span>'+esc(String(player?.name||'Player').split(' ').map(n=>n[0]+'.').join(' '))+
   (dual?' | '+esc(String(partner?.name||'Player').split(' ').map(n=>n[0]+'.').join(' ')):'')+'</span><small>VIRTUAL SIGNATURE ART · NOT AUTHENTICATED</small></div>':'';
  const serial=card.serial?'<b class="fc-serial">'+String(card.serial).padStart(2,'0')+'/'+card.serialMax+'</b>':'';
  const value=money(card.valueCents||def.valueCents||50);
  return '<article class="fc-card fc-'+esc(card.variant||'base')+' fc-pack-'+esc(skin(card))+(small?' fc-small':'')+'" style="--club:'+esc(club?.primary||'#cdb8f5')+';--contrast:'+esc(club?.accent||'#fff')+'">'+
  '<div class="fc-layer"><header><strong>'+esc(collection?.name||'FIRST XI')+'</strong><em>BITZ</em></header><div class="fc-portrait-wrap">'+display+'</div>'+
  '<div class="fc-card-identity"><small>'+esc(club?.name||'EUROPEAN ALL-STARS')+'</small><h3>'+esc(cardName(card))+'</h3>'+
  '<b class="fc-card-tier">'+esc(def.name||card.variant||'Base')+'</b></div>'+autograph+
  '<footer><span>'+esc(card.season||state.catalog?.season||'2026-27')+'</span>'+serial+'<strong>'+value+'</strong></footer></div></article>';
 }
 function button(label,action,args='',className=''){return '<button type="button" class="fc-btn '+className+'" data-fc="'+action+'" '+args+'>'+label+'</button>';}
 function header(){
  return '<header class="fc-top"><div class="fc-brand"><strong>BITZ<span>.</span> CARDS</strong><small>COLLECT • TRADE • SHOW OFF</small></div>'+
   '<div class="fc-counters"><span>'+own().length+' CARDS</span><span>'+money(state.self?.virtualValueCents)+' VIRTUAL VALUE</span></div>'+
   button('×','close','','fc-x')+'</header>';
 }
 function navigation(){
  const names=[['packs','PACK SHOP'],['album','COLLECTOR BOOK'],['collection','MY CARDS'],['trade','TRADING']];
  return '<nav class="fc-nav">'+names.map(([id,name])=>button(name,'tab','data-v="'+id+'"',state.tab===id?'on':'')).join('')+'</nav>';
 }
 function packs(){
  const defs=state.catalog.packs;const ids=['first-xi','electric-nights','blackout','crown-glory','derby-day','god','signature','triple-auto','elite-vault'];
  return '<div class="fc-section-head"><h2>PACKS & BOXES</h2><p>Collect every day. Chase the extraordinary.</p></div>'+
  '<div class="fc-pack-grid">'+ids.map(id=>{
   const p=defs[id];if(!p)return '';return '<div class="fc-pack-product '+(state.selected===id?'selected':'')+'" style="--pack-a:'+p.colors[0]+';--pack-b:'+p.colors[1]+'">'+
   '<button class="fc-pack-art" data-fc="choose-pack" data-v="'+id+'"><div class="fc-pack-shimmer"></div><span class="fc-pack-top">BITZ FOOTBALL</span><b>'+esc(p.name)+'</b><em>'+p.cards+' CARDS</em><small>2026/27 SERIES</small></button>'+
   '<div class="fc-pack-info"><b>'+esc(p.name)+'</b><span>'+gold(p.cost||0)+(p.questOnly?' • QUEST':' GOLD')+'</span></div>'+
   '<p>'+esc(p.description)+'</p><div class="fc-pack-actions">'+(countPack(id)?button('OPEN ('+countPack(id)+')','open-select','data-v="'+id+'"','primary'):'')+
   (!p.questOnly?button('BUY '+gold(p.cost)+' GOLD','buy','data-v="'+id+'"',''):button('EARN FROM TRADES','tab','data-v="trade"',''))+'</div></div>';
  }).join('')+'</div><p class="fc-disclaimer">All dollar prices on cards are fictional in-game valuations. No cash-out or real-money purchases.</p>';
 }
 function album(){
  const all=state.europe?state.catalog.europe:state.catalog.clubs;
  const c=clubs.get(state.club)||all[0];
  if(!all.some(x=>x.id===c.id))state.club=all[0].id;
  const active=clubs.get(state.club);
  const players=state.catalog.players.filter(p=>p.club===active.id).sort((a,b)=>a.slot-b.slot);
  const collected=new Map();for(const card of own())for(const id of card.players||[card.player])if(!collected.has(id))collected.set(id,card);
  const found=players.filter(p=>collected.has(p.id)).length;
  const progress=state.self?.album?.find(c=>c.id===active.id);
  return '<div class="fc-section-head"><h2>COLLECTOR BOOK</h2><p>Every player fills their slot automatically. Claim your reward at 11/11.</p></div>'+
   '<div class="fc-album-tabs">'+button('20 PREMIER LEAGUE CLUBS','league','data-v="prem"',!state.europe?'on':'')+button('EUROPEAN STARS','league','data-v="europe"',state.europe?'on':'')+'</div>'+
   '<div class="fc-book"><div class="fc-book-cover"><div class="fc-album-turn">'+button('‹','club-prev')+
   '<div><small>2026/27 COLLECTOR EDITION</small><h3>'+esc(active.name)+'</h3><span>'+found+' / '+players.length+' COLLECTED</span></div>'+button('›','club-next')+'</div>'+
   '<div class="fc-progress"><i style="width:'+Math.round(found/players.length*100)+'%"></i></div>'+
   '<div class="fc-album-claim">'+(state.europe?'<span>European superstar collection</span>':
   progress?.claimed?'<strong>SEASON REWARD CLAIMED</strong>':found===11?button('CLAIM REWARD PACK','claim','data-v="'+active.id+'"','primary'):
   '<span>Fill all 11 unique players to unlock an Elite Vault pack</span>')+'</div></div>'+
   '<div class="fc-album-slots">'+players.map(p=>{
    const card=collected.get(p.id);
    return '<div class="fc-album-slot '+(card?'filled':'')+'">'+(card?frame(card,{small:true}):
     '<div class="fc-slot-empty"><b>'+String(p.slot).padStart(2,'0')+'</b><small>'+esc(p.name)+'</small></div>')+
     '<span>'+esc(p.name)+'</span></div>';
   }).join('')+'</div></div>';
 }
 function collection(){
  const sorted=[...own()].sort((a,b)=>(b.valueCents||0)-(a.valueCents||0));
  const favorites=new Set(state.self?.favorites||[]);
  return '<div class="fc-section-head"><h2>MY COLLECTION</h2><p>Mark five favourites for your player profile. Duplicates are tradable or quick-sellable.</p></div>'+
   '<div class="fc-collection-count">'+sorted.length+' CARDS · '+money(state.self?.virtualValueCents)+' VIRTUAL COLLECTION VALUE</div>'+
   '<div class="fc-owned-grid">'+sorted.map(c=>'<div class="fc-owned">'+frame(c,{small:true})+
    '<div class="fc-owned-tools">'+button(favorites.has(c.uid)?'★ FAVOURITE':'☆ FAVOURITE','favorite','data-uid="'+esc(c.uid)+'"',favorites.has(c.uid)?'on':'')+
     button('SELL '+money(c.valueCents),'sell','data-uid="'+esc(c.uid)+'"','')+'</div></div>').join('')+
   (sorted.length?'':'<p class="fc-empty">Open a pack to begin your collection.</p>')+'</div>';
 }
 function objectivePanel(){
  const o=state.self?.objective||{};
  return '<div class="fc-quest"><span>ACTIVE TRADING OBJECTIVE</span><h3>'+esc(o.label||'Earn your next God Pack')+'</h3>'+
  '<p>Complete this objective in an accepted trade to claim a God Pack. Both players can earn rewards from the same trade.</p></div>';
 }
 function selectorCards(cards,mode){
  const selected=new Set(mode==='give'?state.give:state.take);
  return '<div class="fc-select-cards">'+cards.map(c=>'<button class="fc-select-card '+(selected.has(c.uid)?'selected':'')+'" data-fc="'+(mode==='give'?'offer-give':'offer-take')+'" data-uid="'+esc(c.uid)+'" aria-pressed="'+selected.has(c.uid)+'">'+
    '<span>'+esc(cardName(c))+'</span><small>'+esc(tier(c))+' · '+money(c.valueCents)+'</small></button>').join('')+
    (cards.length?'':'<p class="fc-empty">No cards available.</p>')+'</div>';
 }
 function tradeView(){
  const friends=state.friendList||[],partner=state.partner;
  const offers=state.self?.trades||[];
  return '<div class="fc-section-head"><h2>SECURE CARD TRADING</h2><p>Every exchange is checked and completed by the BITZ server.</p></div>'+
  objectivePanel()+'<div class="fc-trade-create"><h3>PROPOSE A TRADE</h3><label for="fc-partner">Trade with</label>'+
  '<select id="fc-partner"><option value="">Select a player</option>'+friends.map(f=>'<option value="'+esc(f.f)+'" '+(partner===f.f?'selected':'')+'>'+esc(f.n||f.u||f.f)+'</option>').join('')+'</select>'+
  '<div class="fc-trade-columns"><div><h4>YOU GIVE ('+state.give.length+')</h4>'+selectorCards(own(),'give')+'</div>'+
  '<div><h4>YOU RECEIVE ('+state.take.length+')</h4>'+selectorCards(state.partnerCards,'take')+'</div></div>'+
  button('SEND TRADE OFFER','send-trade','','primary')+'</div>'+
  '<div class="fc-trades"><h3>TRADE OFFERS</h3>'+offers.map(x=>'<div class="fc-trade-line"><div><strong>'+
    esc(x.fromName)+' → '+esc(x.toName)+'</strong><small>'+x.fromCards.length+' given · '+x.toCards.length+' requested · '+esc(x.status.toUpperCase())+'</small></div>'+
    (x.status==='pending'&&x.toId?.slice(2,12)===state.selfId?
     button('ACCEPT','trade-accept','data-id="'+esc(x.id)+'"','primary')+button('DECLINE','trade-decline','data-id="'+esc(x.id)+'"',''):
    x.status==='pending'&&x.fromId?.slice(2,12)===state.selfId?
     button('CANCEL','trade-decline','data-id="'+esc(x.id)+'"',''):'')+'</div>').join('')+'</div>';
 }
 function stageView(){
  const s=state.open,p=state.catalog.packs[s.pack],name=p.name;
  if(s.phase==='sealed')return '<div class="fc-open-stage"><header><h2>RIP TO OPEN</h2>'+button('CLOSE','stop-open')+'</header>'+
   '<p>Drag or swipe across the pack to tear the foil seal.</p>'+
   '<div class="fc-foil-pack" id="fc-rip" style="--pack-a:'+p.colors[0]+';--pack-b:'+p.colors[1]+'"><b>'+esc(name)+'</b><span>BITZ FOOTBALL</span><i class="fc-rip-line"></i><em>DRAG TO RIP</em></div>'+
   button('TAP TO RIP','unseal','','primary')+'</div>';
  if(s.phase==='loading')return '<div class="fc-open-stage"><h2>UNSEALING...</h2><p>Choosing your cards securely.</p><div class="fc-spinner"></div></div>';
  if(s.phase==='reveal'){
   const c=s.cards[s.index],special=['legendary','signature','goldInk','blackInk','dual','numbered5','masterpiece'].includes(c.variant);
   return '<div class="fc-open-stage"><div class="fc-reveal-heading"><h2>'+esc(name)+'</h2><span>CARD '+(s.index+1)+' OF '+s.cards.length+'</span></div>'+
    '<div class="fc-card-stack '+(special?'fc-chase':'')+'" id="fc-flick">'+frame(c)+
    '<div class="fc-reveal-hint">SWIPE OR TAP TO REVEAL NEXT</div></div>'+
    '<div class="fc-open-actions">'+button(s.index+1===s.cards.length?'SEE RESULTS':'NEXT CARD','next-card','','primary')+
    button('SKIP','skip-open')+'</div></div>';
  }
  const made=s.cards;
  return '<div class="fc-open-summary"><h2>YOUR PACK RESULTS</h2><p>'+esc(name)+' · '+made.length+' CARDS · '+money(made.reduce((v,c)=>v+c.valueCents,0))+' VIRTUAL VALUE</p>'+
   '<div class="fc-summary-grid">'+made.map(c=>frame(c,{small:true})).join('')+'</div>'+
   '<div class="fc-bonus">RARE-PULL GOLD BONUS: +'+gold(s.bonusGold)+' GOLD</div>'+
   button('VIEW COLLECTION','summary-collection','','primary')+button('DONE','stop-open')+'</div>';
 }
 function render(){
  if(!state.active)return;
  const content=$('#fc-content');if(!content)return;
  content.innerHTML=header()+(state.open?stageView():navigation()+
   (state.tab==='packs'?packs():state.tab==='album'?album():state.tab==='collection'?collection():tradeView()));
  if(!state.open)loadVisiblePhotos(content);
 }
 async function getCatalog(){
  if(state.catalog)return;
  const j=await api('cards/catalogue');catalogReady(j);
  try{const r=await fetch('football/media.json',{cache:'no-store'});if(r.ok)state.sourceManifest=await r.json();}catch(e){}
 }
 async function sync(){
  await getCatalog();const j=await api('cards');state.self=j;
  state.selfId=String(myId||'').slice(2,12);
  render();
 }
 async function show(tab='packs'){
  if(modal)closeModal();if(typeof profileClose==='function')profileClose();
  state.tab=tab;state.active=true;shell.hidden=false;
  $('#fc-content').innerHTML='<div class="fc-wait">LOADING YOUR CARDS...</div>';
  try{await sync();if(tab==='trade')await loadFriends();}catch(e){$('#fc-content').innerHTML='<div class="fc-wait">Could not load your cards. '+esc(e.message||'Try again.')+button('CLOSE','close')+'</div>';}
 }
 function hide(){if(state.busy)return;state.active=false;state.open=null;shell.hidden=true;}
 async function mutate(payload){
  if(state.busy)return null;state.busy=true;
  try{
   const j=await api('cards',payload);
   if(j.state)state.self=j.state;
   if(typeof j.gold==='number'){wallet.coins=j.gold;goldPaint();}
   if(j.progress&&typeof levelSync==='function')levelSync(j.progress);
   return j;
  }catch(e){if(typeof toast==='function')toast(e.message||'Action could not be completed.');return null;}
  finally{state.busy=false;}
 }
 function sound(kind){
  try{
   const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)return;
   const a=window.__BITZ_CARD_AUDIO||(window.__BITZ_CARD_AUDIO=new Audio());
   if(a.state==='suspended')a.resume();
   const now=a.currentTime;
   const notes=kind==='rare'?[440,660,880,1320]:kind==='rip'?[170,130,100]:[280,450];
   notes.forEach((f,i)=>{const osc=a.createOscillator(),g=a.createGain();osc.type=kind==='rip'?'sawtooth':'triangle';osc.frequency.value=f;
    g.gain.setValueAtTime(.0001,now+i*.09);g.gain.exponentialRampToValueAtTime(.035,now+i*.09+.015);g.gain.exponentialRampToValueAtTime(.0001,now+i*.09+.16);
    osc.connect(g);g.connect(a.destination);osc.start(now+i*.09);osc.stop(now+i*.09+.17);
   });
  }catch(e){}
 }
 async function unseal(){
  if(!state.open||state.open.phase!=='sealed')return;
  const s=state.open;s.phase='loading';render();sound('rip');
  const j=await mutate({op:'open',pack:s.pack});
  if(!j){s.phase='sealed';render();return;}
  state.open={...s,phase:'reveal',cards:j.cards,index:0,bonusGold:j.bonusGold||0};
  sound(['legendary','masterpiece','dual'].includes(j.cards[0]?.variant)?'rare':'normal');render();
 }
 function next(){
  if(!state.open||state.open.phase!=='reveal')return;
  const s=state.open;
  if(s.index>=s.cards.length-1){s.phase='summary';render();return;}
  s.index++;sound(['legendary','masterpiece','dual','blackInk'].includes(s.cards[s.index].variant)?'rare':'normal');render();
 }
 function loadVisiblePhotos(root){
  const ids=[...root.querySelectorAll('.fc-card .fc-no-photo')].slice(0,12).map(x=>x.closest('.fc-card')).filter(Boolean);
  // Licensed images sync into /football/portraits; resolve missing ones from
  // Wikimedia page thumbnails during this browser session for immediate display.
  const keys=[...state.pending].slice(0,12);state.pending.clear();
  keys.forEach(async id=>{
   if(state.images.has(id))return;
   const p=byId.get(id);if(!p)return;
   state.images.set(id,'');
   try{
    const saved=sessionStorage.getItem('bitz-photo:'+id);
    if(saved){state.images.set(id,saved);refreshPhotos(id,saved);return;}
    const url='https://en.wikipedia.org/w/api.php?format=json&action=query&redirects=1&prop=pageimages&piprop=thumbnail&pithumbsize=640&origin=*&titles='+encodeURIComponent(p.name);
    const r=await fetch(url,{signal:AbortSignal.timeout(5500)});
    if(!r.ok)return;
    const data=await r.json(),page=Object.values(data.query?.pages||{})[0];
    const image=page?.thumbnail?.source;
    if(image&&image.startsWith('https://upload.wikimedia.org/')){
     state.images.set(id,image);sessionStorage.setItem('bitz-photo:'+id,image);refreshPhotos(id,image);
    }
   }catch(e){}
  });
 }
 function refreshPhotos(id,url){
  if(!state.active)return;
  const player=byId.get(id);if(!player)return;
  [...document.querySelectorAll('#fc-overlay .fc-no-photo')].forEach(q=>{
   const tag=q.closest('.fc-card'),c=tag?.querySelector('.fc-card-identity h3')?.textContent||'';
   if(!c.includes(player.name))return;
   const img=document.createElement('img');img.className='fc-portrait';img.loading='lazy';img.alt=player.name;img.src=url;img.referrerPolicy='no-referrer';q.replaceWith(img);
  });
 }
 async function loadFriends(){
  try{const f=await api('friends');state.friendList=[...(f.friends||[]),...(f.hidden||[])];render();}catch(e){}
 }
 async function choosePartner(code){
  state.partner=code;state.take=[];state.partnerCards=[];
  if(!code){render();return;}
  try{const r=await api('cards/inventory/'+encodeURIComponent(code));state.partnerCards=r.cards||[];}catch(e){toast(e.message||'Unable to load cards.');}
  render();
 }
 async function profileFavorites(p){
  const node=document.getElementById('fc-profile-favorites');
  if(!node||!p)return;
  node.innerHTML='<small>LOADING CARD SHOWCASE...</small>';
  try{
   if(!state.catalog)await getCatalog();
   const ref=String(p.f||myId?.slice(2,12)||'');
   const j=await api('cards/profile/'+encodeURIComponent(ref));
   if(!node.isConnected)return;
   node.innerHTML='<div class="fc-profile-heading"><b>TOP 5 FOOTBALL CARDS</b><span>'+money(j.valueCents)+' VIRTUAL VALUE</span></div>'+
    '<div class="fc-profile-grid">'+(j.top||[]).map(c=>frame(c,{small:true})).join('')+
    (j.top?.length?'':'<span class="fc-empty">No favourites selected</span>')+'</div>'+
    (p.self?button('EDIT FAVOURITES','show-collection','','primary'):'');
  }catch(e){if(node.isConnected)node.innerHTML='<small>Card showcase unavailable</small>';}
 }
 async function handle(action,el){
  const v=el.dataset.v,uid=el.dataset.uid;
  if(action==='close'){hide();return;}
  if(action==='tab'){state.tab=v;state.open=null;render();if(v==='trade')await loadFriends();return;}
  if(action==='buy'){const j=await mutate({op:'buy',pack:v});if(j){state.open={pack:v,phase:'sealed'};sound('normal');render();}return;}
  if(action==='choose-pack'){state.selected=v;render();return;}
  if(action==='open-select'){state.open={pack:v,phase:'sealed'};render();return;}
  if(action==='unseal'){await unseal();return;}
  if(action==='next-card'){next();return;}
  if(action==='skip-open'){state.open.phase='summary';render();return;}
  if(action==='stop-open'){state.open=null;render();return;}
  if(action==='summary-collection'){state.open=null;state.tab='collection';render();return;}
  if(action==='league'){state.europe=v==='europe';state.club=state.europe?state.catalog.europe[0].id:state.catalog.clubs[0].id;render();return;}
  if(action==='club-next'||action==='club-prev'){
   const arr=state.europe?state.catalog.europe:state.catalog.clubs;
   const idx=arr.findIndex(x=>x.id===state.club),diff=action==='club-next'?1:-1;
   state.club=arr[(idx+diff+arr.length)%arr.length].id;
   const book=$('#fc-content .fc-book');if(book)book.classList.add('turning');render();return;
  }
  if(action==='claim'){const j=await mutate({op:'claim',club:v});if(j){sound('rare');render();}return;}
  if(action==='sell'){
   if(!confirm('Quick-sell this card for '+money(own().find(x=>x.uid===uid)?.valueCents)+' virtual value in gold?'))return;
   const j=await mutate({op:'sell',uid});if(j)render();return;
  }
  if(action==='favorite'){
   const ids=[...(state.self.favorites||[])],idx=ids.indexOf(uid);
   if(idx>=0)ids.splice(idx,1);else if(ids.length<5)ids.push(uid);else{toast('Choose at most 5 favourites.');return;}
   const j=await mutate({op:'favorites',cards:ids});if(j)render();return;
  }
  if(action==='offer-give'||action==='offer-take'){
   const list=action==='offer-give'?state.give:state.take;const ix=list.indexOf(uid);
   if(ix>=0)list.splice(ix,1);else if(list.length<10)list.push(uid);render();return;
  }
  if(action==='send-trade'){
   if(!state.partner){toast('Choose a player first.');return;}
   const j=await mutate({op:'offer',to:state.partner,give:state.give,take:state.take});
   if(j){toast('Trade offer sent.');state.give=[];state.take=[];await sync();}return;
  }
  if(action==='trade-accept'||action==='trade-decline'){
   const j=await mutate({op:action==='trade-accept'?'accept':'decline',trade:el.dataset.id});
   if(j){if(j.rewarded?.some(Boolean)){sound('rare');toast('Trading objective complete. God Pack earned!');}await sync();}return;
  }
  if(action==='show-collection'){hide();await show('collection');return;}
 }
 document.addEventListener('click',async e=>{
  const entry=e.target.closest('[data-fc]');if(entry&&(!shell.hidden||entry.dataset.fc==='show-collection')){
   e.preventDefault();e.stopPropagation();await handle(entry.dataset.fc,entry);return;
  }
  if(e.target.closest('[data-a="football"]')){e.preventDefault();show('packs');}
 });
 shell.addEventListener('change',e=>{if(e.target.id==='fc-partner')choosePartner(e.target.value);});
 let down=null;
 shell.addEventListener('pointerdown',e=>{
  const target=e.target.closest('#fc-rip,#fc-flick');
  if(!target)return;down={x:e.clientX,y:e.clientY,type:target.id};
  target.setPointerCapture?.(e.pointerId);
 });
 shell.addEventListener('pointerup',e=>{
  if(!down)return;const distance=Math.hypot(e.clientX-down.x,e.clientY-down.y),type=down.type;down=null;
  if(type==='fc-rip'&&distance>60)unseal();
  if(type==='fc-flick'&&distance>40)next();
 });
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!shell.hidden){e.preventDefault();hide();}});
 window.BITZ_FOOTBALL={open:show,renderFavorites:profileFavorites};
})();
