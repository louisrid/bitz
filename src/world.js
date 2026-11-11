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
      x: info?.x || 0, z: info?.z || 0, y: info?.y || 0, yaw: info?.yaw || 0, hp:info?.hp ?? 100, knockouts:info?.knockouts || 0, weapon:info?.weapon || 'blaster'
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
          player = { x: Math.cos(angle)*2.8, z: Math.sin(angle)*2.8, y:0, yaw:0, last:Date.now(), sockets:new Set(), hp:100, knockouts:0, weapon:'blaster', lastShot:0, respawnAt:0 };
          live.set(id, player);
        }
        player.sockets.add(ws);
        const roster = [...live.keys()].map(state);
        send(ws, { type:'snapshot', self:id, players:roster, ...friends(id), now:Date.now() });
        broadcast({ type:'profile', player:state(id) });
        return;
      }
      if (msg.type === 'ping') return send(ws, {type:'pong',now:Date.now()});
      if (msg.type === 'weapon') {
        const p = live.get(ws.worldId);
        if (!p || !['blaster','pulse'].includes(msg.weapon)) return;
        p.weapon = msg.weapon;
        broadcast({ type:'combat', event:'equip', id:ws.worldId, weapon:p.weapon });
        return;
      }
      if (msg.type === 'shoot') {
        const shooter = live.get(ws.worldId), now = Date.now();
        if (!shooter || now < shooter.respawnAt) return;
        const weapon = shooter.weapon === 'pulse' ? 'pulse' : 'blaster';
        if (now - shooter.lastShot < (weapon === 'pulse' ? 220 : 520)) return;
        shooter.lastShot = now;
        // Hits are chosen by the server, not by the shooting browser.
        let best = null, bestDist = Infinity;
        const heading = Number.isFinite(shooter.yaw) ? shooter.yaw : 0;
        const dx = Math.sin(heading), dz = Math.cos(heading);
        const reach = weapon === 'pulse' ? 19 : 28;
        for (const [id, q] of live) {
          if (id === ws.worldId || now < q.respawnAt) continue;
          const vx = q.x - shooter.x, vz = q.z - shooter.z;
          const forward = vx * dx + vz * dz;
          const lateral = Math.abs(vx * dz - vz * dx);
          if (forward <= 0 || forward >= reach || lateral > .85 + forward * .07) continue;
          if (Math.abs(q.y - shooter.y) > 4) continue;
          if (forward < bestDist) { best = [id, q]; bestDist = forward; }
        }
        let hit = null;
        if (best) {
          const [targetId,target] = best;
          target.hp = Math.max(0, target.hp - (weapon === 'pulse' ? 13 : 28));
          hit = targetId;
          if (!target.hp) {
            target.respawnAt = now + 3000;
            shooter.knockouts++;
            broadcast({type:'combat',event:'ko',id:targetId,by:ws.worldId,respawnAt:target.respawnAt,knockouts:shooter.knockouts});
          }
          broadcast({type:'combat',event:'health',id:targetId,hp:target.hp});
        }
        broadcast({type:'combat',event:'shot',id:ws.worldId,weapon,x:shooter.x,y:shooter.y,z:shooter.z,yaw:heading,hit});
        return;
      }
      if (msg.type !== 'move') return;
      const p=live.get(ws.worldId);
      if (!p) return;
      const now=Date.now();
      if (p.respawnAt && now >= p.respawnAt) {
        p.respawnAt = 0; p.hp = 100;
        p.x = (Math.random()-.5)*7; p.z = (Math.random()-.5)*7; p.y = 0;
        broadcast({type:'combat',event:'respawn',id:ws.worldId,x:p.x,z:p.z,hp:100});
      }
      if (now < p.respawnAt || now-p.last < 45) return;
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
