// HaloCut Vector: SVG in, After Effects shapes out — paths, arcs, transforms, classes, <use>, colours and the report.
const assert = require('node:assert');
const V = require('../../extension/client/vector-core');
const near = (a, b, e = 1e-3) => Math.abs(a - b) < e;

// colours
assert.deepStrictEqual(V.color('#f80').rgb.map((v) => +v.toFixed(3)), [1, 0.533, 0]);
assert.strictEqual(V.color('rgba(255, 0, 0, .5)').a, 0.5);
assert.strictEqual(V.color('none'), null);
assert.deepStrictEqual(V.color('teal').rgb.map((v) => Math.round(v * 255)), [0, 128, 128]);
// transforms
const m = V.transform('translate(10 20) scale(2)');
assert.deepStrictEqual(m, [2, 0, 0, 2, 10, 20]);
const r = V.transform('rotate(90 5 5)');
assert.ok(near(r[0] * 10 + r[2] * 5 + r[4], 5) && near(r[1] * 10 + r[3] * 5 + r[5], 10), 'rotate about a point');
// paths: relative commands, H/V, smooth curves, quadratic and arcs all become cubic segments
const p = V.parsePath('m10 10 h20 v20 h-20 z M0 0 Q10 0 10 10 T20 20 S30 30 40 40');
assert.strictEqual(p.length, 2);
assert.deepStrictEqual(p[0].pts.slice(-1)[0], [10, 30]); assert.ok(p[0].closed);
assert.deepStrictEqual(p[1].pts.slice(-1)[0], [40, 40]);
const arc = V.arcToCubics(0, 0, 10, 10, 0, 0, 1, 20, 0);
assert.strictEqual(arc.length, 2, 'a half circle is two quarter curves');
assert.ok(near(arc[0][2][0], 10) && near(Math.abs(arc[0][2][1]), 10) && near(arc[1][2][0], 20));

const svg = `<?xml version="1.0"?>
<!-- made by hand -->
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 100" width="200" height="100">
  <defs>
    <style>.brand{fill:#e8457c}.edge{stroke:#000;stroke-width:4;fill:none}</style>
    <linearGradient id="g1"><stop offset="0" stop-color="#36c2ff"/><stop offset="1" stop-color="#000"/></linearGradient>
    <circle id="dot" r="5"/>
  </defs>
  <g id="logo" transform="translate(100 50)">
    <rect class="brand" x="-40" y="-20" width="80" height="40" rx="8"/>
    <circle cx="0" cy="0" r="10" fill="url(#g1)" opacity=".5"/>
  </g>
  <g id="lines"><line x1="0" y1="90" x2="200" y2="90" class="edge"/><use href="#dot" x="20" y="20" fill="white"/></g>
  <text x="0" y="0">Hi</text>
  <path d="M0 0" fill="red"/>
</svg>`;
const art = V.read(svg);
assert.deepStrictEqual(art.box, { x: 0, y: 0, w: 200, h: 100 });
assert.deepStrictEqual(art.shapes.map((s) => s.name + ':' + s.group), ['rect:logo', 'circle:logo', 'line:lines', 'dot:lines']);
const rect = art.shapes[0];
assert.deepStrictEqual(rect.fill.rgb.map((v) => Math.round(v * 255)), [232, 69, 124], 'a class from <style>');
assert.ok(near(rect.paths[0].pts[0][0], 68) && near(rect.paths[0].pts[0][1], 30), 'moved by its group');
const circle = art.shapes[1];
assert.deepStrictEqual(circle.fill.rgb.map((v) => Math.round(v * 255)), [54, 194, 255], 'a gradient becomes its first colour');
assert.strictEqual(circle.fill.opacity, 50);
assert.ok(!art.shapes[2].fill && art.shapes[2].stroke.width === 4, 'lines are stroked, not filled');
assert.ok(near(art.shapes[3].paths[0].pts[0][0], 25) && near(art.shapes[3].paths[0].pts[0][1], 20), '<use> placed at its x, y');
assert.deepStrictEqual(art.report.skipped, { 'Text (outline it first)': 1 });
assert.strictEqual(art.report.gradients, 1);

// After Effects form: centred, scaled to fit, closed paths without a doubled point, tangents relative to their vertex
const ae = V.toAE(art, 1000);
const c = ae[1].paths[0];
assert.strictEqual(c.v.length, 4); assert.ok(c.c);
assert.ok(near(c.v[0][0], 50) && near(c.v[0][1], 0), 'r 10 at 5× from the middle');
assert.ok(near(c.o[0][0], 0) && near(c.o[0][1], 50 * 0.5523, 0.01), 'out tangent points down the circle');
assert.ok(near(c.i[0][0], 0) && near(c.i[0][1], -50 * 0.5523, 0.01), 'in tangent of the first point comes from the last curve');
const sq = V.toAE(V.read('<svg viewBox="0 0 10 10"><path d="M0 0 L10 0 L10 10 L0 10 Z"/></svg>'), 0)[0].paths[0];
assert.deepStrictEqual(sq.v, [[-5, -5], [5, -5], [5, 5], [-5, 5]]); assert.ok(sq.c && sq.o.every((t) => t[0] === 0 && t[1] === 0));
// layers and recolouring
assert.deepStrictEqual(V.layersOf(ae, 'groups', 'Art').map((l) => l.name + ' ' + l.shapes.length), ['logo 2', 'lines 2']);
assert.strictEqual(V.layersOf(ae, 'one', 'Art').length, 1); assert.strictEqual(V.layersOf(ae, 'shapes', 'Art').length, 4);
const white = V.recolour(ae, [1, 1, 1]);
assert.deepStrictEqual(white[0].fill.rgb, [1, 1, 1]); assert.deepStrictEqual(ae[0].fill.rgb.map((v) => Math.round(v * 255)), [232, 69, 124], 'the original is untouched');
assert.throws(() => V.read('<html></html>'), /isn't an SVG/);
console.log('vector ok ·', art.shapes.length, 'shapes');
