const assert = require('assert');
const U = require('../src/usage');
let u = {};
u = U.record(u, 'PPRO', 'pr.cut', 1); u = U.record(u, 'PPRO', 'pr.cut', 2); u = U.record(u, 'PPRO', 'pr.nest', 3);
u = U.record(u, 'PPRO', 'pr.gone', 4); u = U.record(u, 'AEFT', 'ae.x', 5);
assert.strictEqual(u.PPRO['pr.cut'].n, 2);
assert.deepStrictEqual(U.top(u, 'PPRO', (id) => id !== 'pr.gone'), ['pr.cut', 'pr.nest']);
assert.deepStrictEqual(U.top(u, 'PPRO'), ['pr.cut', 'pr.gone', 'pr.nest']); // tie: used last first
assert.deepStrictEqual(U.top(u, 'none'), []);
const layout = { name: 'L', segments: [{ name: 'A', tools: ['pr.cut'], main: 'pr.cut' }] };
assert.strictEqual(U.withFavourites(layout, ['pr.cut']), layout); // not enough yet
const f = U.withFavourites(layout, ['pr.cut', 'pr.nest']);
assert.strictEqual(f.segments.length, 2); assert.strictEqual(f.segments[1].name, 'Most used'); assert.strictEqual(layout.segments.length, 1);
const full = { name: 'F', segments: Array(10).fill(layout.segments[0]) };
assert.strictEqual(U.withFavourites(full, ['a', 'b']), full);
let big = {}; for (let i = 0; i < 260; i++) big = U.record(big, 'PPRO', 't' + i, i);
assert.ok(Object.keys(big.PPRO).length <= 200);
console.log('usage ok');
