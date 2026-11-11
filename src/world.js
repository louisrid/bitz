/* Public shared-world presence. Position packets are ephemeral; identities, looks and
   friendship requests come from the existing authenticated server-side account. */
import crypto from 'node:crypto';
import { WebSocketServer } from 'ws';
const MAX_CLIENTS = 48;
const isGuest = v => typeof v === 'string' && /^[a-f0-9]{48}$/.test(v);
const idOf = key => 'p_' + crypto.createHash('sha256').update('stakkz:' + key).digest('hex').slice(0, 24);
const cleanList = x => Array.isArray(x) ? [...new Set(x.filter(y => typeof y === 'string' && /^p_[a-f0-9]{24}$/.test(y)))].slice(0, 100) : [];
export function setupWorld({ auth, account, accounts, getSwag, onChange }) {
  const wss = new WebSocketServer({ noServer: true, maxPayload: 2048 });
  const live = new Map();
  const send = (ws, msg) => { try { if (ws.readyState === 1) ws.send(JSON.stringify(msg)); } catch (_) {} };
  const broadcast = msg => { const d = JSON.stringify(msg); for (const peer of wss.clients) try { if (peer.readyState === 1 && peer.worldId) peer.send(d); } catch (_) {} };
  const state = id => {
    const w = account(id);
    const info = live.get(id);
    return {
      id, name: (w.name || auth().username(id) || 'Player').slice(0, 20),
      look: w.look || {}, pet: w.pet || '', swag: getSwag(w),
      x: info?.x || 0, z: info?.z || 0, y: info?.y || 0, yaw: info?.yaw || 0
    };
  };
  const friends = id => {
    const w = account(id);
    return { friends: cleanList(w.friends), incoming: cleanList(w.incoming), outgoing: cleanList(w.outgoing) };
  };
  const personal = id => {
    const rec = live.get(id);
    if (rec) for (const peer of rec.sockets) send(peer, { type:'friends', ...friends(id) });
  };
  const refresh = id => { if (live.has(id)) broadcast({ type:'profile', player:state(id) }); };
  const close = ws => {
    const id = ws.worldId;
    if (!id) return;
    ws.worldId = null;
    const p = live.get(id);
    if (!p) return;
    p.sockets.delete(ws);
    if (p.sockets.size === 0) { live.delete(id); broadcast({ type:'leave', id }); }
  };
  wss.on('connection', ws => {
    if (wss.clients.size > MAX_CLIENTS) return ws.close(1013,'World busy');
    const timeout = setTimeout(() => { if (!ws.worldId) ws.close(1008,'Login required'); }, 8000);
    ws.on('message', raw => {
      let msg; try { msg = JSON.parse(String(raw)); } catch (_) { return; }
      if (!msg || typeof msg !== 'object') return;
      if (!ws.worldId) {
        if (msg.type !== 'hello') return ws.close(1008,'Login required');
        const token = msg.token;
        const session = auth().authenticate(token);
        if (!session && !isGuest(token)) return ws.close(1008,'Invalid session');
        const id = session ? session.id : idOf(token);
        if (!session && auth().username(id)) return ws.close(1008,'Sign-in required');
        clearTimeout(timeout);
        ws.worldId = id;
        let player = live.get(id);
        if (!player) {
          const angle = Math.random() * Math.PI * 2;
          player = { x: Math.cos(angle)*2.8, z: Math.sin(angle)*2.8, y:0, yaw:0, last:Date.now(), sockets:new Set() };
          live.set(id, player);
        }
        player.sockets.add(ws);
        const roster = [...live.keys()].map(state);
        send(ws, { type:'snapshot', self:id, players:roster, ...friends(id), now:Date.now() });
        broadcast({ type:'profile', player:state(id) });
        return;
      }
      if (msg.type === 'ping') return send(ws, {type:'pong',now:Date.now()});
      if (msg.type !== 'move') return;
      const p=live.get(ws.worldId);
      if (!p) return;
      const now=Date.now();
      if (now-p.last < 45) return;
      const x=Number(msg.x),z=Number(msg.z),y=Number(msg.y),yaw=Number(msg.yaw);
      if (![x,z,y,yaw].every(Number.isFinite)) return;
      if (Math.max(Math.abs(x),Math.abs(z))>75 || y < -0.01 || y>4.5 || Math.abs(yaw)>10000) return;
      const dt=Math.min(1, Math.max(0.05,(now-p.last)/1000));
      if(Math.hypot(x-p.x,z-p.z)>Math.max(1.75,dt*17))return;
      p.x=x;p.z=z;p.y=y;p.yaw=yaw;p.last=now;
      broadcast({type:'move',id:ws.worldId,x,z,y,yaw,now});
    });
    ws.on('close',()=>{clearTimeout(timeout);close(ws);});
    ws.on('error',()=>{clearTimeout(timeout);close(ws);});
  });
  function friendOp(id,target,op) {
    if (typeof target !== 'string' || !/^p_[a-f0-9]{24}$/.test(target) || target===id || !accounts.has(target)) throw new Error('That player cannot be found.');
    const a=account(id), b=account(target);
    for(const w of [a,b]) { w.friends=cleanList(w.friends); w.incoming=cleanList(w.incoming); w.outgoing=cleanList(w.outgoing); }
    const add=(arr,v)=>{if(!arr.includes(v))arr.push(v);};
    const del=(arr,v)=>{const i=arr.indexOf(v);if(i>=0)arr.splice(i,1);};
    if(op==='request'){
      if(!a.friends.includes(target)){ add(a.outgoing,target);add(b.incoming,id); }
    }else if(op==='accept'){
      if(!a.incoming.includes(target))throw new Error('No friend request from this player.');
      add(a.friends,target);add(b.friends,id);
      del(a.incoming,target);del(b.outgoing,id);del(a.outgoing,target);del(b.incoming,id);
    }else if(op==='remove'||op==='decline'){
      for(const [w,other] of [[a,target],[b,id]]) {
        del(w.friends,other);del(w.incoming,other);del(w.outgoing,other);
      }
    }else throw new Error('Unknown friend action.');
    onChange();personal(id);personal(target);return friends(id);
  }
  return {
    upgrade(req,socket,head){ wss.handleUpgrade(req,socket,head,ws=>wss.emit('connection',ws,req)); },
    refresh,friendOp,friends
  };
}
