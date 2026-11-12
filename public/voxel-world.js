/* BITZ 2.0 empty-plate lobby. Original adventure world: legacy/voxel-world.adventure.js.
   Restore by replacing this file and its matching world-layout file. */
(function(){
  'use strict';
  function build(THREE,root){
    const world=new THREE.Group(); world.name='BITZ 2.0 Social Lobby';root.add(world);
    const lam=c=>new THREE.MeshLambertMaterial({color:c});
    const basic=c=>new THREE.MeshBasicMaterial({color:c});
    function slab(w,h,d,color,x,y,z){
      const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),lam(color));
      m.position.set(x,y,z);m.receiveShadow=true;world.add(m);return m;
    }
    // Flat, quiet arena. Soft white in the middle, subtle purple edging, no obstacles.
    slab(82,1,82,0xf8f9fe,0,-0.55,0);
    slab(69,0.045,69,0xf0edff,0,-0.025,0);
    slab(63,0.04,63,0xffffff,0,0,0);
    const line=new THREE.MeshBasicMaterial({color:0xe7e5f4});
    for(let i=-28;i<=28;i+=7){
      const a=new THREE.Mesh(new THREE.BoxGeometry(.032,.012,63),line);a.position.set(i,.035,0);world.add(a);
      const b=new THREE.Mesh(new THREE.BoxGeometry(63,.012,.032),line);b.position.set(0,.035,i);world.add(b);
    }
    // Dark outer stroke and small blue-violet details echo the existing Shop.
    for(const side of [-1,1]){
      slab(66,.22,.22,0x101014,0,.09,side*33);
      slab(.22,.22,66,0x101014,side*33,.09,0);
    }
    const ringGeo=new THREE.RingGeometry(8.2,8.32,96);
    const ring=new THREE.Mesh(ringGeo,basic(0xdad3ff));
    ring.rotation.x=-Math.PI/2;ring.position.y=.07;world.add(ring);
    const ring2=new THREE.Mesh(new THREE.RingGeometry(10.2,10.28,96),basic(0xece9ff));
    ring2.rotation.x=-Math.PI/2;ring2.position.y=.067;world.add(ring2);
    // Four tiny landmark tiles, not buildings, pickups or navigation destinations.
    [[-27,-27,0xb9b4ff],[27,-27,0x9acbff],[27,27,0xb9b4ff],[-27,27,0x9acbff]].forEach(([x,z,c])=>{
      slab(3.3,.035,3.3,c,x,.04,z);
      slab(1.2,.04,1.2,0xffffff,x,.08,z);
    });
    return {world,arena:9,ring:10,field:33,size:82,animals:[],pickups:[],boostPoints:[],animate(){}};
  }
  globalThis.STAKKZ_BUILD_WORLD=build;
})();
