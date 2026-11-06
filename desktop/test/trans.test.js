// HaloCut Transitions plans.
const assert = require('node:assert');
const R = require('../../extension/client/trans-core');
assert.strictEqual(R.TRANSITIONS.length, 11);
for (const t of R.TRANSITIONS) {
  const p = R.plan(t.id, { frames: 10, strength: 1, dir: 'left' });
  assert.strictEqual(p.A.length, 11); assert.strictEqual(p.B.length, 11);
  for (const v of [p.A[0], p.B[10]]) {       // far from the cut: the clip looks normal
    for (const k of Object.keys(R.NEUTRAL)) if (!(t.id === 'whip' && k === 'dir')) assert.ok(Math.abs(v[k] - R.NEUTRAL[k]) < 1e-6, `${t.id} ${k} neutral away from the cut (${v[k]})`);
  }
}
const z = R.plan('zoomIn', { frames: 10 });
assert.ok(z.A[10].scale > 160 && z.B[0].scale > 160, 'strongest at the cut on both sides');
assert.ok(z.A[5].scale < z.A[8].scale, 'A builds up');
const w = R.plan('whip', { frames: 8, dir: 'right' });
assert.ok(w.A[8].x > 0.5 && w.B[0].x < 0.5, 'whip right: A leaves to the right, B comes in from the left');
assert.strictEqual(w.A[8].dir, 90);
assert.ok(R.plan('stretch', { frames: 4 }).nonUniform, 'stretch needs non-uniform scale');
assert.deepStrictEqual(R.plan('shake', { frames: 6 }), R.plan('shake', { frames: 6 }), 'the same shake every time');
assert.strictEqual(R.plan('fadeBlack', { frames: 4 }).A[4].opacity, 0, 'black at the cut');
console.log('transitions ok');
