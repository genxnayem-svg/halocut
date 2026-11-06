// HaloCut Resize: rules per layer, and where every layer lands in each new size.
const assert = require('node:assert');
const R = require('../../extension/client/resize-core');
const from = { w: 1920, h: 1080 }, tall = { w: 1080, h: 1920 }, square = { w: 1080, h: 1080 };
const near = (a, b, e = 1e-6) => a.every((v, i) => Math.abs(v - b[i]) < e);
const inside = (b, f) => b.x >= -1e-6 && b.y >= -1e-6 && b.x + b.w <= f.w + 1e-6 && b.y + b.h <= f.h + 1e-6;
const covers = (b, f) => b.x <= 1e-6 && b.y <= 1e-6 && b.x + b.w >= f.w - 1e-6 && b.y + b.h >= f.h - 1e-6;

// rules: frame-sized layers fill, the rest pin, and a tag in the layer comment wins
assert.strictEqual(R.guess({ x: 0, y: 0, w: 1920, h: 1080 }, from), 'fill');
assert.strictEqual(R.guess({ x: 100, y: 100, w: 400, h: 80 }, from), 'pin');
assert.strictEqual(R.ruleOf('notes halocut:resize=fit', { x: 0, y: 0, w: 1920, h: 1080 }, from), 'fit');
assert.strictEqual(R.tagged('my note halocut:resize=pin', 'keep'), 'my note halocut:resize=keep');
assert.strictEqual(R.tagged('', 'fill'), 'halocut:resize=fill');

function land(rule, box, to) { const pivot = [box.x + box.w / 2, box.y + box.h / 2]; return R.placeBox(box, pivot, R.plan(rule, box, from, to)); }
// a background fills the tall frame, even when it sits a little off-centre
const bg = { x: -10, y: 0, w: 1940, h: 1080 };
assert.ok(covers(land('fill', bg, tall), tall) && covers(land('fill', bg, square), square));
// a logo in the top-right corner stays in the top-right corner, the same (scaled) distance from the edges
const logo = { x: 1720, y: 40, w: 160, h: 80 }, l9 = land('pin', logo, tall);
assert.ok(inside(l9, tall), JSON.stringify(l9));
const u = 1080 / 1920;
assert.ok(Math.abs(tall.w - (l9.x + l9.w) - 40 * u) < 1e-6 && Math.abs(l9.y - 40 * u) < 1e-6, 'same margins, scaled');
// a lower third on the left stays bottom-left
const lt = { x: 80, y: 860, w: 700, h: 140 }, ltn = land('pin', lt, tall);
assert.ok(Math.abs(ltn.x - 80 * u) < 1e-6 && Math.abs(tall.h - (ltn.y + ltn.h) - 80 * u) < 1e-6);
// a centred title stays centred
const title = { x: 660, y: 490, w: 600, h: 100 }, tn = land('pin', title, square);
assert.ok(Math.abs(tn.x + tn.w / 2 - 540) < 1e-6 && Math.abs(tn.y + tn.h / 2 - 540) < 1e-6);
// fit keeps the whole layer inside; keep doesn't scale
assert.ok(inside(land('fit', { x: 0, y: 0, w: 1920, h: 1080 }, tall), tall));
const kp = R.plan('keep', title, from, square);
assert.strictEqual(kp.k, 1); assert.ok(near(kp.map([960, 540, 0]), [540, 540, 0]), '3D positions keep their depth');
// anchors
assert.deepStrictEqual(R.anchorOf(logo, from), [1, 0]); assert.deepStrictEqual(R.anchorOf(title, from), [0.5, 0.5]);
// guides: more room at the top and bottom of tall frames
const g = R.guides(R.SIZES[0]);
assert.deepStrictEqual(g, { vertical: [54, 1026], horizontal: [192, 1536] });
assert.strictEqual(R.versionName('Promo', R.SIZES[0]), 'Promo · 9x16');
console.log('resize ok');
// the plain-number form After Effects gets is the same plan
for (const [rule, box] of [['fill', bg], ['fit', title], ['pin', logo], ['pin', lt], ['keep', title]]) {
  const a = R.affine(rule, box, from, tall), pl = R.plan(rule, box, from, tall);
  for (const p of [[0, 0], [300, 900], [1900, 20]]) assert.ok(near([a.m * p[0] + a.bx, a.m * p[1] + a.by], pl.map(p)), rule);
  assert.strictEqual(a.k, pl.k);
}
console.log('resize affine ok');
