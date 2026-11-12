/* BITZ plaza layout, shared by the page and the server: where the stands and circles are, how far anyone can walk,
   and how close you must be to use a stand. A flat white world; everything is a few seconds from spawn. */
(function (root) {
  const spots = Object.freeze({
    seller: Object.freeze({ id: 'seller', name: 'PACK SELLER', x: -24, z: -20, r: 7, face: 0.75 }),
    buyer: Object.freeze({ id: 'buyer', name: 'CARD BUYER', x: 24, z: -20, r: 7, face: -0.75 }),
    dealer: Object.freeze({ id: 'dealer', name: 'THE DEALER', x: 0, z: -34, r: 7, face: 0 }),
    wardrobe: Object.freeze({ id: 'wardrobe', name: 'WARDROBE', x: -34, z: 10, r: 7, face: 1.57 })
  });
  const circles = Object.freeze({
    gold: Object.freeze({ id: 'gold', x: -13, z: 18, r: 5.5 }),
    purple: Object.freeze({ id: 'purple', x: 13, z: 18, r: 5.5 })
  });
  const hall = Object.freeze({ x: 0, z: -52, w: 30, h: 13 });
  root.STAKKZ_WORLD_LAYOUT = Object.freeze({ size: 400, field: 62, limit: 60, speed: 20, spots, circles, hall, caves: Object.freeze([]), waterfall: null, destinations: Object.freeze([]) });
})(globalThis);
