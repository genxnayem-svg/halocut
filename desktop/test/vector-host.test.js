// HaloCut Vector host tool on a pretend After Effects: shape layers with groups, paths, strokes, fills and draw-on.
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const V = require('../../extension/client/vector-core');
const jsx = (f) => fs.readFileSync(path.join(__dirname, '../../extension/jsx', f), 'utf8');
const PT = { PROPERTY: 6812, NAMED_GROUP: 6814 };
class Prop {
  constructor(m, v) { Object.assign(this, { name: m, matchName: m, value: v, propertyType: PT.PROPERTY, keys: [], eased: 0 }); }
  get numKeys() { return this.keys.length; }
  setValue(v) { this.value = v; } setValueAtTime(t, v) { this.keys.push({ t, v }); } setTemporalEaseAtKey() { this.eased++; }
}
const ITEMS = {
  'ADBE Vector Group': () => new Group('Group', 'ADBE Vector Group', [new Group('Contents', 'ADBE Vectors Group')]),
  'ADBE Vector Shape - Group': () => new Group('Path', 'ADBE Vector Shape - Group', [new Prop('ADBE Vector Shape', null)]),
  'ADBE Vector Graphic - Fill': () => new Group('Fill', 'ADBE Vector Graphic - Fill', ['ADBE Vector Fill Color', 'ADBE Vector Fill Opacity', 'ADBE Vector Fill Rule'].map((m) => new Prop(m, 0))),
  'ADBE Vector Graphic - Stroke': () => new Group('Stroke', 'ADBE Vector Graphic - Stroke', ['ADBE Vector Stroke Color', 'ADBE Vector Stroke Width', 'ADBE Vector Stroke Opacity', 'ADBE Vector Stroke Line Cap', 'ADBE Vector Stroke Line Join'].map((m) => new Prop(m, 0))),
  'ADBE Vector Filter - Trim': () => new Group('Trim', 'ADBE Vector Filter - Trim', [new Prop('ADBE Vector Trim Start', 0), new Prop('ADBE Vector Trim End', 100)]),
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
const comp = Object.assign(Object.create(CompItem.prototype), { width: 1920, height: 1080, time: 2, frameDuration: 0.04, selectedLayers: [],
  layers: { addShape() { const L = new Group('Shape Layer', 'ADBE Vector Layer', [new Group('Contents', 'ADBE Root Vectors Group'), new Group('Transform', 'ADBE Transform Group', [new Prop('ADBE Position', [0, 0])])]); made.push(L); return L; } } });
const ctx = { BridgeTalk: { appName: 'aftereffects' }, PropertyType: PT, PropertyValueType: {}, CompItem, Shape, KeyframeEase: function () {}, MarkerValue: function () {},
  CameraLayer: function () {}, LightLayer: function () {}, TextLayer: function () {}, ShapeLayer: function () {}, FolderItem: function () {}, FootageItem: function () {}, SolidSource: function () {},
  app: { version: '26', beginUndoGroup() {}, endUndoGroup() {}, project: { activeItem: comp } } };
vm.createContext(ctx);
vm.runInContext(jsx('host.jsx'), ctx);
vm.runInContext(jsx('aftereffects.jsx'), ctx);
const run = (t, a) => JSON.parse(ctx.EW.run(t, JSON.stringify(a || {})));

const art = V.read(`<svg viewBox="0 0 100 100"><g id="badge"><circle cx="50" cy="50" r="40" fill="#ff8a3d" stroke="#fff" stroke-width="2"/><path d="M30 50 L45 65 L70 35" fill="none" stroke="#000" stroke-width="6" stroke-linecap="round"/></g></svg>`);
const shapes = V.toAE(art, 500);
let r = run('ae.vectorBuild', { layers: V.layersOf(shapes, 'one', 'Badge'), drawOn: { mode: 'stagger', seconds: 1, stagger: 0.25 } });
assert.ok(r.ok, r.msg);
const L = made[0], root = L.property('ADBE Root Vectors Group');
assert.strictEqual(L.name, 'Badge');
assert.deepStrictEqual(Array.from(L.property('ADBE Transform Group').property('ADBE Position').value), [960, 540]);
assert.deepStrictEqual(root.kids.map((g) => g.name), ['path', 'circle'], 'the tick is drawn in front of the circle');
const circle = root.property(2).property('ADBE Vectors Group');
assert.deepStrictEqual(circle.kids.map((k) => k.matchName), ['ADBE Vector Shape - Group', 'ADBE Vector Filter - Trim', 'ADBE Vector Graphic - Stroke', 'ADBE Vector Graphic - Fill'], 'paths, trim, stroke over fill');
const sh = circle.property(1).property('ADBE Vector Shape').value;
assert.ok(sh instanceof Shape && sh.vertices.length === 4 && sh.closed);
assert.strictEqual(circle.property(4).property('ADBE Vector Fill Color').value.length, 4);
const tick = root.property(1).property('ADBE Vectors Group');
assert.ok(!tick.kids.some((k) => k.matchName === 'ADBE Vector Graphic - Fill'), 'no fill on the tick');
assert.strictEqual(tick.property(3).property('ADBE Vector Stroke Line Cap').value, 2, 'round cap');
assert.deepStrictEqual(circle.property(2).property('ADBE Vector Trim End').keys.map((k) => [k.t, k.v]), [[2, 0], [3, 100]], 'circle draws first, from the playhead');
assert.deepStrictEqual(tick.property(2).property('ADBE Vector Trim End').keys.map((k) => k.t), [2.25, 3.25]);
r = run('ae.vectorBuild', { layers: V.layersOf(shapes, 'shapes', 'Badge'), drawOn: { mode: 'together', seconds: 2 } });
assert.ok(r.ok && made.length === 3, r.msg);
assert.strictEqual(made[2].property('ADBE Root Vectors Group').kids.slice(-1)[0].matchName, 'ADBE Vector Filter - Trim', 'one trim for the whole layer');
console.log('vector host ok ·', r.msg);
