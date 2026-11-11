/* Original dark voxel village for the Stakkz social world.
   All geometry generated at runtime. No external or copied game assets. */
(function(){
  function build(THREE,root){
    const mats=new Map();
    const mat=(colour,glow=false)=>{
      const key=colour+':'+glow;if(!mats.has(key))mats.set(key,glow?new THREE.MeshBasicMaterial({color:colour}):new THREE.MeshLambertMaterial({color:colour,flatShading:true}));return mats.get(key);
    };
    const box=(grp,x,y,z,w,h,d,c,glow=false)=>{
      const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat(c,glow));m.position.set(x,y,z);grp.add(m);return m;
    };
    const inst=(grp,geo,colours,positions)=>{
      const o=new THREE.InstancedMesh(geo,mat(0xffffff),positions.length);
      const dummy=new THREE.Object3D();
      positions.forEach((p,i)=>{dummy.position.set(...p);dummy.updateMatrix();o.setMatrixAt(i,dummy.matrix);o.setColorAt(i,new THREE.Color(colours[i%colours.length]));});
      o.instanceMatrix.needsUpdate=true;grp.add(o);return o;
    };
    const world=new THREE.Group();world.name='Dark Voxel Village';root.add(world);
    const ground=box(world,0,-.23,0,130,.36,130,0x214c30);
    const tiles=[];
    for(let x=-61.5;x<=61.5;x+=3)for(let z=-61.5;z<=61.5;z+=3){
      const h=((Math.abs(Math.floor(x*7+z*13))%17)===0)?0.035:0;
      tiles.push([x,-.04+h,z]);
    }
    const grass=inst(world,new THREE.BoxGeometry(2.92,.08,2.92),[0x244f32,0x275734,0x285b37,0x295338,0x215331,0x325f3a,0x295a35],tiles);
    const stonemat=[0x555c54,0x4e5b50,0x5b645b,0x4a584f];
    for(let x=-30;x<=30;x+=2)for(let z=-30;z<=30;z+=2){
      const cross=Math.abs(x)<3 || Math.abs(z)<3 || (Math.abs(x)>17 && Math.abs(z)>17 && Math.abs(x)<23 && Math.abs(z)<23);
      if(cross)box(world,x,.028,z,1.96,.13,1.96,stonemat[Math.abs(x*5+z*7)%4]);
    }
    // Enclosing woodland, laid out to keep the central world open for multiplayer.
    let seed=1247991;const rand=()=>{seed=(seed*48271)%2147483647;return seed/2147483647};
    const fir=(x,z,s)=>{
      box(world,x,.8*s,z,.48*s,1.6*s,.48*s,0x5c4934);
      for(let k=0;k<3;k++)box(world,x,(1.75+k*.67)*s,z,(2.6-k*.64)*s,.8*s,(2.6-k*.64)*s,k===0?0x225a3b:k===1?0x276544:0x2c774c);
    };
    const sakura=(x,z,s)=>{
      box(world,x,.85*s,z,.37*s,1.7*s,.37*s,0x634f45);
      for(const [dx,dz] of [[-.55,0],[.55,0],[0,-.55],[0,.55],[0,0]])box(world,x+dx*s,2.1*s+rand()*.25,z+dz*s,1.15*s,.72*s,1.2*s,rand()>.5?0xb8799d:0xda98b3);
    };
    for(let i=0;i<105;i++){
      const a=i*2.39996,r=33+rand()*30,x=Math.sin(a)*r,z=Math.cos(a)*r;
      if(Math.abs(x)>63||Math.abs(z)>63)continue;
      if(i%8===0)sakura(x,z,.8+rand()*.5);else fir(x,z,.68+rand()*.65);
    }
    const tower=(x,z,w,d,h,main,trim,windowColour)=>{
      const g=new THREE.Group();g.position.set(x,0,z);world.add(g);
      box(g,0,h/2,0,w,h,d,main);
      for(let k=0;k<Math.floor(h/1.2);k++){
        const y=1+k*1.2;
        if(y>h-.6)break;
        for(let side of [-1,1]){
          box(g,side*(w/2+.026),y,0,.06,.5,Math.max(.45,d*.5),windowColour,true);
          box(g,0,y,side*(d/2+.026),Math.max(.45,w*.5),.5,.06,windowColour,true);
        }
      }
      box(g,0,h+.18,0,w+.8,.35,d+.8,trim);
      box(g,0,h+.43,0,w+.24,.18,d+.24,main);
      return g;
    };
    // Eight distinctive original landmark structures with generous walking room.
    tower(-19,-22,7,7,8.5,0x313b46,0x49c8bb,0x7fe5db);
    tower(22,-23,8,6,6.2,0x4f3b49,0xdc698b,0xffc1db);
    tower(-24,19,6.5,8,8,0x3a4b58,0x7ecbff,0x98ecff);
    tower(20,21,8,7,10,0x40353f,0xdfa758,0xffd48a);
    tower(-33,0,6,6,4.4,0x3e5040,0x8ac777,0xb9ef94);
    tower(32,0,6,6,4.4,0x3f4e61,0x789de2,0xafd5ff);
    // A voxel torii arch and lantern-lined path.
    for(let z of [-12,12]){
      for(let x of [-2.6,2.6])box(world,x,2,z,.6,4,.6,0xb83b3e);
      box(world,0,4.2,z,7.5,.5,.8,0xcf4d4a);box(world,0,4.68,z,8.2,.25,1,0x4b2c35);
    }
    for(let x of [-9,-5,5,9])for(let z of [-8,8]){
      box(world,x,1,z,.25,2,.25,0x303d3d);
      box(world,x,2.25,z,.82,.67,.76,0xffd393,true);
      box(world,x,2.67,z,1.1,.16,1.05,0x39484b);
    }
    // Original voxel kiosks, benches, stepping stones and garden planters.
    for(const [x,z,c] of [[-12,13,0x3a6a66],[12,13,0x70425a],[-12,-14,0x545f7c],[12,-14,0x796548]]){
      box(world,x,1.25,z,4,2.5,3.2,c);
      box(world,x,2.8,z,5,.45,4.2,0x252f39);
      box(world,x,1.65,z+1.64,2.6,.9,.13,0x6edbcf,true);
      box(world,x,1,z+1.95,2.6,.18,.8,0x1f2833);
    }
    for(let k=0;k<30;k++){
      let x=(rand()-.5)*60,z=(rand()-.5)*60;
      if(Math.abs(x)<12&&Math.abs(z)<12)continue;
      if(k%3===0){
        box(world,x,.35,z,1.8,.7,1.3,0x5d5549);
        box(world,x,.82,z,2,.15,1.5,0x7a6955);
      }else{
        box(world,x,.33,z,.9,.6,.9,0x475448);
        const colour=[0x367a52,0x2f6c46,0x365e3b][k%3];
        for(let b=0;b<3;b++)box(world,x+(b-1)*.36,.82,z+.1,.46,.55,.54,colour);
      }
    }
    const pickups=[];
    const boostPoints=[[-8,-5],[8,-5],[-8,6],[8,6],[0,-9],[0,9]];
    boostPoints.forEach(([x,z],i)=>{
      const g=new THREE.Group();g.position.set(x,1.15,z);world.add(g);
      box(g,0,0,0,.58,.58,.58,0xffd95a,true);
      box(g,0,.42,0,.3,.2,.3,0xfff9c2,true);
      box(g,0,-.58,0,1,.14,1,0x335f4e);
      pickups.push({id:i,x,z,mesh:g,origin:1.15});
    });
    return {world,pickups,boostPoints,animate(t){pickups.forEach((p,i)=>{p.mesh.rotation.y=t*.75+i;p.mesh.position.y=p.origin+Math.sin(t*2.4+i)*.25;});}};
  }
  globalThis.STAKKZ_BUILD_WORLD=build;
})();