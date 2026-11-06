const assert = require('node:assert');
const G = require('../src/wheel-geometry');
const { layouts } = require('../src/tools');

const L = layouts.PPRO;
const n = L.segments.length;
const at = (r, deg) => [r * Math.sin(deg * Math.PI / 180), -r * Math.cos(deg * Math.PI / 180)];

// Centre cancels
assert.deepStrictEqual(G.resolve(G.hit(5, 5, L, -1), L), null);

// Each segment on the inner ring resolves to its main tool
L.segments.forEach((s, i) => {
  const [x, y] = at(100, G.segmentAngle(i, n));
  const h = G.hit(x, y, L, -1);
  assert.strictEqual(h.seg, i);
  assert.strictEqual(G.resolve(h, L), s.main);
});

// Every tool slot on the outer ring resolves to that tool, and far flicks still count
L.segments.forEach((s, i) => {
  const { slots } = G.toolSlots(i, n, s.tools.length);
  slots.forEach((a, k) => {
    for (const r of [200, 400]) {
      const [x, y] = at(r, a);
      const h = G.hit(x, y, L, i);
      assert.strictEqual(G.resolve(h, L), s.tools[k], `${s.name} tool ${k} at r=${r}`);
    }
  });
});

// Open segment wins over its neighbour when its arc spreads past the boundary (the segment with the most tools)
const labels = L.segments.reduce((best, s, i) => (s.tools.length > L.segments[best].tools.length ? i : best), 0);
const { slots } = G.toolSlots(labels, n, L.segments[labels].tools.length);
const [x, y] = at(200, slots[slots.length - 1]);
assert.strictEqual(G.hit(x, y, L, labels).seg, labels);

console.log('geometry ok');

// ---- Options wheel ----
const OG = require('../src/options-geometry');
const { defaultOptions, RING_SIZES } = require('../src/options');
const opt = defaultOptions();
for (const app of ['PPRO', 'AEFT', 'other']) {
  const rings = opt.wheels[app].rings;
  assert.deepStrictEqual(rings.map((r) => r.length), RING_SIZES, `${app} ring sizes`);
  rings.forEach((ring, ri) => ring.forEach((slot, si) => {
    const [r0, r1] = OG.R.rings[ri];
    const [x, y] = at((r0 + r1) / 2, OG.slotAngle(si, ring.length));
    const h = OG.hit(x, y, rings);
    assert.deepStrictEqual([h.ring, h.slot], [ri, si], `${app} ring ${ri} slot ${si}`);
  }));
}
const pr = opt.wheels.PPRO.rings;
assert.strictEqual(OG.resolve(OG.hit(2, 2, pr), pr), null, 'centre cancels');
assert.strictEqual(OG.hit(...at(90, 0), pr, 1).ring, 1, 'middle click steps out a ring');
assert.strictEqual(OG.hit(...at(90, 0), pr, 5).ring, 2, 'step stops at the outer ring');
assert.strictEqual(OG.hit(...at(500, 0), pr).ring, 2, 'past the edge is the outer ring');
console.log('options geometry ok');
