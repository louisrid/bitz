/* Shared BITZ weapon data: world, shop previews and zombie-boss combat. */
(function(root){
  const list=[
    {id:'g_blaster',n:'Blaster',col:0x19e3ff,dmg:18,cd:300,range:34,rad:1.1},
    {id:'g_pulse',n:'Pulse',col:0xff2bd6,dmg:40,cd:1100,range:24,rad:2.4,all:true},
    {id:'g_cannon',n:'Cannon',col:0xff9f1c,dmg:58,cd:1900,range:24,rad:3.4,all:true},
    {id:'g_scatter',n:'Scatter',col:0xffd60a,dmg:15,cd:800,range:15,rad:1,pellets:5,spread:.22},
    {id:'g_longshot',n:'Longshot',col:0xff3b3b,dmg:95,cd:2300,range:75,rad:.8},
    {id:'g_ember',price:1250000,n:'Emberthrower',col:0xff7b39,dmg:28,cd:410,range:24,rad:1.4,burnMs:3500,burnDamage:14,ability:'Ignite zombies'},
    {id:'g_frostgun',price:1650000,n:'Frostcaster',col:0x6cecff,dmg:30,cd:420,range:30,rad:1.4,slowMs:3200,ability:'Freeze and slow'},
    {id:'g_tesla',price:2400000,n:'Tesla Arc',col:0xaaa1ff,dmg:48,cd:1000,range:35,rad:1.5,chain:3,ability:'Chain lightning'},
    {id:'g_railgun',price:4000000,n:'Rail Piercer',col:0xffd09a,dmg:100,cd:1600,range:95,rad:.75,all:true,bossMult:1.3,ability:'Pierces targets'},
    {id:'g_sunburst',price:5500000,n:'Sunburst Cannon',col:0xffeb63,dmg:70,cd:1700,range:36,rad:1.8,splash:7,bossMult:1.6,ability:'Solar area blast'},
    {id:'g_voidgun',price:7000000,n:'Void Puller',col:0xc18aff,dmg:39,cd:850,range:33,rad:1.7,splash:4.5,slowMs:2500,ability:'Gravity field'},
    {id:'g_starfall',price:11000000,n:'Starfall Launcher',col:0xaeefff,dmg:105,cd:2300,range:45,rad:1.9,splash:8,bossMult:1.9,ability:'Meteor impact'},
    {id:'g_venom',price:1500000,n:'Venom Sprayer',col:0x80ff80,dmg:12,cd:260,range:18,rad:1.0,pellets:3,spread:.22,burnMs:4500,burnDamage:12,ability:'Corrosive damage'},
    {id:'g_phoenixgun',price:8000000,n:'Phoenix Lance',col:0xff9150,dmg:63,cd:980,range:41,rad:1.2,chain:2,burnMs:3500,burnDamage:18,ability:'Fire arcs'},
    {id:'g_crystalgun',price:3400000,n:'Crystal Storm',col:0xffa8f9,dmg:31,cd:480,range:31,rad:1.1,pellets:3,spread:.13,slowMs:1800,ability:'Shard barrage'},
    {id:'g_gravity',price:6500000,n:'Gravity Cannon',col:0x8ebaff,dmg:76,cd:1700,range:40,rad:1.8,splash:5.5,slowMs:3500,ability:'Gravity shockwave'},
    {id:'g_spectral',price:15000000,n:'Spectral Beam',col:0xffcff6,dmg:115,cd:1450,range:90,rad:1.1,all:true,bossMult:2.1,ability:'Boss destroyer'}
  ];
  root.BITZ_WEAPONS=Object.freeze(list.map(x=>Object.freeze(x)));
})(globalThis);
