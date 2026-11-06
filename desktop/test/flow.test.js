// HaloCut Flow: layers pair up at their cuts, and overlap transitions carry the right AE controls.
const assert = require('node:assert');
const F = require('../../extension/client/flow-core');
const ls = [{ index: 3, inPoint: 4, outPoint: 8 }, { index: 1, inPoint: 0, outPoint: 4 }, { index: 2, inPoint: 8, outPoint: 12 }];
assert.deepStrictEqual(F.pairs(ls).map((p) => [p.a, p.b, p.cut]), [[1, 3, 4], [3, 2, 8]], 'in time order, whatever the stacking');
const lin = F.overlapJob('linear', { dir: 'up', seconds: 1 });
assert.deepStrictEqual([lin.fx, lin.from, lin.to, lin.name], ['ADBE Linear Wipe', 100, 0, 'HaloCut Flow · Linear wipe']);
assert.deepStrictEqual(lin.set.find((s) => s.names[0] === 'Wipe Angle').value, 0);
assert.strictEqual(F.overlapJob('iris', { width: 1920, height: 1080, seconds: 1 }).to, 1102, 'the iris opens to the corners');
assert.strictEqual(F.overlapJob('crossfade', { seconds: 1 }).prop.index, 9, 'the Transform effect’s Opacity');
assert.ok(F.OVERLAPS.every((o) => /^ADBE /.test(o.fx) && o.prop.index >= 1));
assert.strictEqual(F.progress(0.5, 1), 0.5); assert.strictEqual(F.progress(2, 1), 1);
console.log('flow ok ·', F.OVERLAPS.length, 'overlap transitions');
