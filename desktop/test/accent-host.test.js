// HaloCut Accents on a pretend After Effects: each accent's keys land on its group's transform, trim and stroke,
// from the playhead, at the position asked for.
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const A = require('../../extension/client/accent-core');
const jsx = (f) => fs.readFileSync(path.join(__dirname, '../../extension/jsx', f), 'utf8');
const PT = { PROPERTY: 6812, NAMED_GROUP: 6814 };
const PVT = { NO_VALUE: 6412, ThreeD_SPATIAL: 6413, ThreeD: 6414, TwoD_SPATIAL: 6415, TwoD: 6416, OneD: 6417, COLOR: 6418, SHAPE: 6420 };
class Prop {
  constructor(m, v, type = PVT.OneD, spatial = false) { Object.assign(this, { name: m, matchName: m, value: v, propertyType: PT.PROPERTY, propertyValueType: type, isSpatial: spatial, keys: [], easeDims: [] }); }
  get numKeys() { return this.keys.length; }
  setValue(v) { this.value = v; } setValueAtTime(t, v) { this.keys.push({ t, v }); }
  setTemporalEaseAtKey(k, inE) { this.easeDims.push(inE.length); }
}
const ITEMS = {
  'ADBE Vector Group': () => new Group('Group', 'ADBE Vector Group', [new Group('Contents', 'ADBE Vectors Group'),
    new Group('Transform', 'ADBE Vector Transform Group', [new Prop('ADBE Vector Anchor', [0, 0], PVT.TwoD_SPATIAL, true), new Prop('ADBE Vector Position', [0, 0], PVT.TwoD_SPATIAL, true),
      new Prop('ADBE Vector Scale', [100, 100], PVT.TwoD), new Prop('ADBE Vector Rotation', 0), new Prop('ADBE Vector Group Opacity', 100)])]),
  'ADBE Vector Shape - Group': () => new Group('Path', 'ADBE Vector Shape - Group', [new Prop('ADBE Vector Shape', null, PVT.SHAPE)]),
  'ADBE Vector Graphic - Fill': () => new Group('Fill', 'ADBE Vector Graphic - Fill', ['ADBE Vector Fill Color', 'ADBE Vector Fill Opacity', 'ADBE Vector Fill Rule'].map((m) => new Prop(m, 0))),
  'ADBE Vector Graphic - Stroke': () => new Group('Stroke', 'ADBE Vector Graphic - Stroke', ['ADBE Vector Stroke Color', 'ADBE Vector Stroke Width', 'ADBE Vector Stroke Opacity', 'ADBE Vector Stroke Line Cap', 'ADBE Vector Stroke Line Join'].map((m) => new Prop(m, 0))),
  'ADBE Vector Filter - Trim': () => new Group('Trim', 'ADBE Vector Filter - Trim', [new Prop('ADBE Vector Trim Start', 0), new Prop('ADBE Vector Trim End', 100), new Prop('ADBE Vector Trim Offset', 0)]),
};
class Group {
  constructor(name, matchName, kids = []) { Object.assign(this, { name, matchName, propertyType: PT.NAMED_GROUP, kids: [] }); kids.forEach((k) => this.add(k)); }
  add(c) { c.parentProperty = this; this.kids.push(c); c.propertyIndex = this.kids.length; return c; }
  get numProperties() { return this.kids.length; }
  property(k) { return typeof k === 'number' ? this.kids[k - 1] : this.kids.find((c) => c.matchName === k || c.name === k); }
  addProperty(m) { return this.add(ITEMS[m]()); }
}
function Shape() {} function CompItem() {}
const made = [];
const comp = Object.assign(Object.create(CompItem.prototype), { width: 1920, height: 1080, time: 3, frameDuration: 0.04, selectedLayers: [],
  layers: { addShape() { const L = new Group('Shape Layer', 'ADBE Vector Layer', [new Group('Contents', 'ADBE Root Vectors Group'), new Group('Transform', 'ADBE Transform Group', [new Prop('ADBE Position', [0, 0], PVT.TwoD_SPATIAL, true)])]); made.push(L); return L; } } });
const ctx = { BridgeTalk: { appName: 'aftereffects' }, PropertyType: PT, PropertyValueType: PVT, CompItem, Shape, KeyframeEase: function () {}, MarkerValue: function () {},
  CameraLayer: function () {}, LightLayer: function () {}, TextLayer: function () {}, ShapeLayer: function () {}, FolderItem: function () {}, FootageItem: function () {}, SolidSource: function () {},
  app: { version: '26', beginUndoGroup() {}, endUndoGroup() {}, project: { activeItem: comp } } };
vm.createContext(ctx);
vm.runInContext(jsx('host.jsx'), ctx);
vm.runInContext(jsx('aftereffects.jsx'), ctx);
const run = (t, a) => JSON.parse(ctx.EW.run(t, JSON.stringify(a || {})));
const build = (id, extra) => run('ae.vectorBuild', { layers: [Object.assign({ name: 'HaloCut Accent · ' + A.accent(id).name, shapes: A.make(id, { size: 100, seconds: 2 }) }, extra || {})], drawOn: { mode: 'none' } });
// a group by its name, and one of its parts
const group = (L, name) => L.property('ADBE Root Vectors Group').kids.find((g) => g.name === name);
const xf = (g, m) => g.property('ADBE Vector Transform Group').property(m);
const inside = (g, m) => g.property('ADBE Vectors Group').kids.find((k) => k.matchName === m);
const times = (p) => p.keys.map((k) => k.t);

// sparkle: scale and rotation keyed on the group, from the playhead (3 s), stretched to 2 s
let r = build('sparkle', { position: [400, 300] });
assert.ok(r.ok, r.msg);
const sp = made[0];
assert.strictEqual(sp.name, 'HaloCut Accent · Sparkle');
assert.deepStrictEqual(Array.from(sp.property('ADBE Transform Group').property('ADBE Position').value), [400, 300], 'the position asked for');
const big = group(sp, 'sparkle');
assert.deepStrictEqual(times(xf(big, 'ADBE Vector Scale')), [3, 3.7, 4, 4.5, 5]);
assert.deepStrictEqual(Array.from(xf(big, 'ADBE Vector Scale').keys[1].v), [115, 115]);
assert.ok(xf(big, 'ADBE Vector Scale').easeDims.every((n) => n === 2), 'a 2D scale gets an ease per dimension');
assert.deepStrictEqual(xf(big, 'ADBE Vector Rotation').keys.map((k) => [k.t, k.v]), [[3, -40], [5, 40]]);
assert.ok(xf(big, 'ADBE Vector Rotation').easeDims.every((n) => n === 1));
assert.ok(inside(big, 'ADBE Vector Graphic - Fill') && !inside(big, 'ADBE Vector Graphic - Stroke'), 'a filled star');
assert.ok(!inside(big, 'ADBE Vector Filter - Trim'), 'no trim when the accent has none');
const small = group(sp, 'sparkle small');
assert.ok(xf(small, 'ADBE Vector Position').easeDims.every((n) => n === 1), 'a spatial position gets one ease');

// ripple: two rings, each with stroke width and opacity keys; the second starts later
r = build('ripple');
assert.ok(r.ok, r.msg);
const rp = made[1];
assert.deepStrictEqual(Array.from(rp.property('ADBE Transform Group').property('ADBE Position').value), [960, 540], 'the comp centre when no position is given');
const ring1 = group(rp, 'ring 1'), ring2 = group(rp, 'ring 2');
const width1 = inside(ring1, 'ADBE Vector Graphic - Stroke').property('ADBE Vector Stroke Width');
assert.deepStrictEqual(width1.keys.map((k) => [k.t, k.v]), [[3, 16], [4.4, 2.4]], 'the ring thins as it grows');
assert.strictEqual(xf(ring2, 'ADBE Vector Scale').keys[0].t, 3.44);
assert.deepStrictEqual(xf(ring1, 'ADBE Vector Group Opacity').keys.map((k) => k.v), [100, 100, 0]);

// arrow: the body draws on, then the head grows out of its tip
r = build('arrow');
assert.ok(r.ok, r.msg);
const head = inside(group(made[2], 'arrow head'), 'ADBE Vector Filter - Trim');
assert.deepStrictEqual(head.property('ADBE Vector Trim Start').keys.map((k) => [k.t, k.v]), [[4, 50], [4.5, 0]]);
assert.deepStrictEqual(head.property('ADBE Vector Trim End').keys.map((k) => [k.t, k.v]), [[4, 50], [4.5, 100]]);
assert.strictEqual(head.property('ADBE Vector Trim Offset').keys.length, 0);
const body = inside(group(made[2], 'arrow body'), 'ADBE Vector Filter - Trim');
assert.deepStrictEqual(times(body.property('ADBE Vector Trim End')), [3, 4.1]);
// trim comes after the path and before the stroke, so the stroke draws the trimmed path
assert.deepStrictEqual(group(made[2], 'arrow head').property('ADBE Vectors Group').kids.map((k) => k.matchName),
  ['ADBE Vector Shape - Group', 'ADBE Vector Filter - Trim', 'ADBE Vector Graphic - Stroke']);

// confetti: sixteen bits, each with position, rotation, scale and opacity keys
r = build('confetti');
assert.ok(r.ok && made[3].property('ADBE Root Vectors Group').numProperties === 16, r.msg);
const bit = group(made[3], 'bit 1');
for (const m of ['ADBE Vector Position', 'ADBE Vector Rotation', 'ADBE Vector Scale', 'ADBE Vector Group Opacity']) assert.ok(xf(bit, m).keys.length >= 2, m);
console.log('accent host ok ·', made.length, 'accents built');
