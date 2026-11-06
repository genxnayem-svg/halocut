// HaloCut Zoom maths: the box fills the target, the move starts and ends where the clip already is.
const assert = require('node:assert');
const Z = require('../../extension/client/zoom-core');
const frame = { w: 1920, h: 1080 }, close = (a, b, e = 1e-3) => Math.abs(a - b) < e;

// a clip that fills the frame targets the whole frame; one shown smaller targets just its own area
const base = { scale: 100, position: [0.5, 0.5] };
assert.deepStrictEqual(Z.target(frame, Z.clipRect(base, { w: 1920, h: 1080 }, frame)), { x: 0, y: 0, w: 1920, h: 1080 });
const small = Z.target(frame, Z.clipRect({ scale: 50, position: [0.25, 0.25] }, { w: 1920, h: 1080 }, frame));
assert.deepStrictEqual(small, { x: 0, y: 0, w: 960, h: 540 });
assert.deepStrictEqual(Z.target(frame, Z.clipRect({ scale: 200, position: [0.5, 0.5] }, { w: 1920, h: 1080 }, frame)), Z.full(frame), 'clamped to the frame');

// boxes take the target's shape, stay inside it, and never zoom past 8×
const tgt = Z.full(frame);
const b = Z.fitBox({ x: 1500, y: 700, w: 300, h: 300 }, tgt);
assert.ok(close(b.w / b.h, 16 / 9) && b.w >= 300 && b.h >= 300, 'holds the drawn box, in 16:9');
assert.ok(b.x + b.w <= 1920 && b.y + b.h <= 1080);
assert.ok(close(Z.fitBox({ x: 10, y: 10, w: 20, h: 20 }, tgt).w, 240), '8× at most');

// the plan: first key is the clip as it is, the hold fills the target with the box, the last key is back to normal
const box = Z.fitBox({ x: 1200, y: 100, w: 480, h: 270 }, tgt);
const p = Z.plan(tgt, box, { in: 0.5, hold: 2, out: 0.5 }, 30, 'smooth');
assert.strictEqual(p.zoom, 4);
assert.deepStrictEqual([p.keys[0].z, p.keys[0].a], [1, [0, 0]]);
const last = p.keys[p.keys.length - 1];
assert.ok(close(last.z, 1) && close(last.a[0], 0) && close(last.a[1], 0), 'back where it started');
assert.ok(close(last.t, 3) && close(p.seconds, 3));
assert.strictEqual(p.keys.length, 16 + 16, '15 frames in, 15 out, one key each end of the hold');
const hold = p.keys[15];
assert.ok(close(hold.t, 0.5) && close(p.keys[16].t, 2.5) && close(p.keys[16].z, hold.z));
// at the hold the box's corners land on the frame's corners
const tl = Z.apply(hold, [box.x, box.y]), br = Z.apply(hold, [box.x + box.w, box.y + box.h]);
assert.ok(close(tl[0], 0) && close(tl[1], 0) && close(br[0], 1920) && close(br[1], 1080), `box fills the frame ${tl} ${br}`);
// on the way in the box never leaves the frame
for (const k of p.keys) {
  const a = Z.apply(k, [box.x, box.y]), c = Z.apply(k, [box.x + box.w, box.y + box.h]);
  assert.ok(a[0] >= -1e-6 && a[1] >= -1e-6 && c[0] <= 1920 + 1e-6 && c[1] <= 1080 + 1e-6, 'box stays in view');
}
// a pure pan (same size box) still lands
const pan = Z.zoomAt(tgt, { x: 100, y: 0, w: 1920, h: 1080 }, 1);
assert.deepStrictEqual(pan, { z: 1, a: [-100, 0] });
// inside a framed clip, the box fills the hole, not the frame
const lay = Z.frameLayout(frame, Z.full(frame), 0.05);
assert.strictEqual(lay.k, 0.9);
assert.ok(close(lay.hole.x, 96) && close(lay.hole.w, 1728) && close(lay.hole.h, 972));
const inHole = Z.plan(lay.hole, Z.fitBox({ x: 600, y: 400, w: 400, h: 225 }, lay.hole), { in: 0.3, hold: 1, out: 0.3 }, 25, 'snappy');
const hk = inHole.keys[Math.round(0.3 * 25)], hb = Z.fitBox({ x: 600, y: 400, w: 400, h: 225 }, lay.hole);
const htl = Z.apply(hk, [hb.x, hb.y]);
assert.ok(close(htl[0], 96) && close(htl[1], lay.hole.y), 'fills the hole');
assert.strictEqual(Z.progressAt({ in: 0.5, hold: 1, out: 0.5 }, 1, 'linear'), 1);
assert.strictEqual(Z.progressAt({ in: 0.5, hold: 1, out: 0.5 }, 1.75, 'linear'), 0.5);

// crop: a box in the frame as percentages of a clip shown at 50% in the top-left quarter
const crop = Z.cropFor({ x: 480, y: 270, w: 240, h: 135 }, { scale: 50, position: [0.25, 0.25] }, { w: 1920, h: 1080 }, frame);
assert.deepStrictEqual(crop, { l: 50, t: 50, r: 25, b: 25 });

// clips that sit in the same place share a frame picture
const g = Z.groupByRect([{ id: 'a', rect: tgt }, { id: 'b', rect: { x: 0.2, y: 0, w: 1920, h: 1080 } }, { id: 'c', rect: small }]);
assert.deepStrictEqual(g.map((x) => x.ids), [['a', 'b'], ['c']]);

// callouts sit toward the middle, inside the frame, the arrow from the near edge
const co = Z.calloutLayout(frame, [1800, 80], { w: 300, h: 80 });
assert.ok(co.label.x + co.label.w <= 1920 && co.label.x < 1800 && co.label.y > 80, 'down and left of a top-right point');
assert.strictEqual(co.from[1], co.label.y, 'arrow from the top edge');
console.log('zoom ok');
