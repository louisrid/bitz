/* Shared, authoritative world landmarks for the server and renderer. */
(function(root){'use strict';
 const caves=[{id:'crystal',name:'Crystal Cave',x:-196,z:-152,rot:0},{id:'shadow',name:'Shadow Cave',x:208,z:-160,rot:1.05},{id:'frost',name:'Frost Cave',x:-112,z:252,rot:-.8}];
 const waterfall={id:'waterfall',name:'Waterfall',x:224,z:219};
 const destinations=[{id:'centre',name:'Town Centre',x:0,z:0,desc:'Return to the arena'},...caves.map(c=>({id:c.id,name:c.name,x:c.x,z:c.z+12,desc:'Find treasure and cave zombies'})),{id:'waterfall',name:'Waterfall',x:waterfall.x-15,z:waterfall.z-10,desc:'Visit the falls and search for gold'}];
 root.STAKKZ_WORLD_LAYOUT=Object.freeze({size:980,field:340,limit:331,caves:Object.freeze(caves.map(Object.freeze)),waterfall:Object.freeze(waterfall),destinations:Object.freeze(destinations.map(Object.freeze))});
})(globalThis);
