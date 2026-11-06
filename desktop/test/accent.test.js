// HaloCut Accents: every accent is drawable, its keys fit its length, and the preview maths agrees.
const assert = require('node:assert');
const A = require('../../extension/client/accent-core');
assert.strictEqual(new Set(A.ACCENTS.map((a) => a.id)).size, A.ACCENTS.length);
assert.ok(A.ACCENTS.length >= 12);
const KINDS = ['trimStart', 'trimEnd', 'trimOffset', 'position', 'scale', 'rotation', 'opacity', 'strokeWidth'];
for (const a of A.ACCENTS) {
  const list = A.make(a.id, { size: 100, seconds: 2 });
  assert.ok(list.length >= 1, a.id);
  for (const s of list) {
    assert.ok(s.fill || s.stroke, a.id + ' paints something');
    for (const p of s.paths) assert.ok(p.v.length >= 2 && p.v.length === p.i.length && p.i.length === p.o.length, a.id + ' path shape');
    for (const k in s.anim) {
      assert.ok(KINDS.includes(k), a.id + ' ' + k);
      const ts = s.anim[k].map((x) => x[0]);
      assert.ok(ts.every((t, i) => !i || t >= ts[i - 1]) && ts[ts.length - 1] <= 2 + 1e-9, a.id + ' keys in order, inside its length');
    }
  }
}
// stretched to the length you pick
assert.deepStrictEqual(A.make('tick', { seconds: 2 })[0].anim.trimEnd, [[0, 0], [1, 100]]);
// value at a time: holds outside, eases between
const keys = [[0, 0], [1, 100]];
assert.strictEqual(A.at(keys, -1), 0); assert.strictEqual(A.at(keys, 2), 100); assert.strictEqual(A.at(keys, 0.5), 50);
assert.ok(A.at(keys, 0.25) < 25, 'eased');
assert.deepStrictEqual(A.at([[0, [0, 0]], [1, [100, 50]]], 1), [100, 50]);
assert.strictEqual(A.at(undefined, 1, 7), 7);
// trimming a straight line to its middle half
const line = { v: [[0, 0], [100, 0]], i: [[0, 0], [0, 0]], o: [[0, 0], [0, 0]], c: false };
const half = A.trimmed(A.flatten(line, 4), 25, 75);
assert.ok(Math.abs(half[0][0] - 25) < 1e-6 && Math.abs(half[half.length - 1][0] - 75) < 1e-6);
assert.strictEqual(A.trimmed(A.flatten(line), 40, 40).length, 0, 'nothing left when start meets end');
const ring = A.flatten(A.make('ripple', { size: 50 })[0].paths[0], 32);
assert.ok(ring.every((p) => Math.abs(Math.hypot(p[0], p[1]) - 50) < 0.2), 'the ring is round');
console.log('accent ok ·', A.ACCENTS.length, 'accents');
