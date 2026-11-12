/* BITZ hub lobby layout, shared by the page and the server (movement limit).
   A small floating island: a plaza in the middle and four portals you can walk into. */
(function (root) {
  const destinations = Object.freeze([
    Object.freeze({ id: 'cards', name: 'FOOTBALL CARDS', x: 0, z: -22, r: 2.8, col: 0x7a52ff }),
    Object.freeze({ id: 'monopoly', name: 'MONOPOLY', x: 22, z: 0, r: 2.8, col: 0x2fbf71 }),
    Object.freeze({ id: 'boxes', name: 'MYSTERY BOXES', x: 0, z: 22, r: 2.8, col: 0xffb020 }),
    Object.freeze({ id: 'shop', name: 'SHOP', x: -22, z: 0, r: 2.8, col: 0xff5ca8 })
  ]);
  root.STAKKZ_WORLD_LAYOUT = Object.freeze({ size: 82, field: 33, limit: 32, caves: Object.freeze([]), waterfall: null, destinations });
})(globalThis);
