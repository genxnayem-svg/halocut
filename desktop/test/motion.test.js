// HaloCut Motion: easing curves, directions, in-between looks and timing windows.
const assert = require('node:assert');
const M = require('../../extension/client/motion-core');
for (const [id, e] of Object.entries(M.EASES)) {
  assert.ok(Math.abs(e.f(0)) < 1e-9 && Math.abs(e.f(1) - 1) < 1e-9, `${id} starts at 0 and ends at 1`);
}
assert.ok(Math.max(...M.curve('overshoot', 'forward', 100)) > 1.05, 'overshoot goes past the end look');
const rt = M.curve('linear', 'roundtrip', 10);
assert.deepStrictEqual([rt[0], rt[5], rt[10]], [0, 1, 0], 'there and back');
assert.deepStrictEqual([M.curve('smooth', 'reverse', 4)[0], M.curve('smooth', 'reverse', 4)[4]], [1, 0], 'end to start');
const rise = M.LOOKS.find((l) => l.id === 'rise');
const mid = M.between(rise.start, rise.end, 0.5);
assert.strictEqual(mid.y, 54); assert.strictEqual(mid.opacity, 50);
assert.strictEqual(M.between(rise.start, rise.end, 1.3).opacity, 100, 'opacity never past 100');
assert.deepStrictEqual(M.window(2, { mode: 'start', seconds: 0.8 }), [0, 0.8]);
assert.deepStrictEqual(M.window(2, { mode: 'end', seconds: 0.8 }), [1.2, 2]);
assert.deepStrictEqual(M.window(0.5, { mode: 'start', seconds: 0.8 }), [0, 0.5], 'never longer than the clip');
assert.strictEqual(M.sample([0, 1], 0.25), 0.25);
assert.strictEqual(M.LOOKS.length, 12);
console.log('motion ok');
