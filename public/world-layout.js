/* BITZ world layout, shared by the page and the server: where the three stands and two circles are, how far anyone
   can walk, how fast, and how close you must be to use a stand. A voxel-grass market world with real shop entrances; everything is seconds from spawn. */
(function (root) {
  const spots = Object.freeze({
    seller: Object.freeze({ id: 'seller', name: 'PACK SELLER', who: 'Marco', x: -17, z: -16, r: 6.5, face: 0.82 }),
    buyer: Object.freeze({ id: 'buyer', name: 'CARD BUYER', who: 'Vera', x: 17, z: -16, r: 6.5, face: -0.82 }),
    dealer: Object.freeze({ id: 'dealer', name: 'THE DEALER', who: 'Ace', x: 0, z: -27, r: 6.5, face: 0 })
  });
  const circles = Object.freeze({
    gold: Object.freeze({ id: 'gold', x: -14, z: 17, r: 5.5 }),
    purple: Object.freeze({ id: 'purple', x: 14, z: 17, r: 5.5 })
  });
  root.STAKKZ_WORLD_LAYOUT = Object.freeze({ size: 400, limit: 60, speed: 7, run: 11, spots, circles });
})(globalThis);
