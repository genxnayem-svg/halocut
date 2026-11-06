// Options wheel geometry: a cancel centre and three rings. Shared by main and renderers.
// Angles in degrees, 0 at the top, clockwise. Slot 0 of each ring is centred at the top.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.OptionsGeometry = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const R = { cancel: 54, rings: [[58, 132], [136, 202], [206, 270]] };

  const norm = (a) => ((a % 360) + 360) % 360;
  const slotAngle = (i, n) => (i * 360) / n;

  // ringStep: how many rings a middle click has pushed the selection outward.
  function hit(dx, dy, rings, ringStep = 0) {
    const dist = Math.hypot(dx, dy);
    const angle = norm((Math.atan2(dx, -dy) * 180) / Math.PI);
    if (dist < R.cancel) return { ring: -1, slot: -1, dist, angle };
    let ring = R.rings.findIndex(([, r1]) => dist < r1);
    if (ring < 0) ring = R.rings.length - 1; // past the edge still counts
    ring = Math.min(R.rings.length - 1, ring + ringStep);
    const n = rings[ring].length;
    const slot = Math.round(angle / (360 / n)) % n;
    return { ring, slot, dist, angle };
  }

  const resolve = (h, rings) => (h.ring < 0 ? null : rings[h.ring][h.slot] || null);

  return { R, norm, slotAngle, hit, resolve };
});
