// HaloCut Flow host tools on a pretend After Effects: cut transitions keyed on both layers, overlap wipes on the later one.
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const TR = require('../../extension/client/trans-core');
const F = require('../../extension/client/flow-core');
const jsx = (f) => fs.readFileSync(path.join(__dirname, '../../extension/jsx', f), 'utf8');
const PT = { PROPERTY: 6812, NAMED_GROUP: 6814 };
class Prop {
  constructor(name, value) { Object.assign(this, { name, matchName: name, value, propertyType: PT.PROPERTY, keys: [], eased: 0 }); }
  get numKeys() { return this.keys.length; }
  setValue(v) { this.value = v; }
  setValueAtTime(t, v) { this.keys = this.keys.filter((k) => Math.abs(k.t - t) > 1e-9); this.keys.push({ t, v }); this.keys.sort((a, b) => a.t - b.t); }
  setTemporalEaseAtKey() { this.eased++; }
}
class Group {
  constructor(name, matchName, kids = []) { Object.assign(this, { name, matchName, propertyType: PT.NAMED_GROUP, kids: [] }); kids.forEach((k) => this.add(k)); }
  add(c) { c.parentProperty = this; this.kids.push(c); return c; }
  get numProperties() { return this.kids.length; }
  property(k) { return typeof k === 'number' ? this.kids[k - 1] : this.kids.find((c) => c.matchName === k || c.name === k); }
}
const FX = { 'ADBE Geometry2': ['Anchor Point', 'Position', 'Uniform Scale', 'Scale', 'Scale Width', 'Skew', 'Skew Axis', 'Rotation', 'Opacity', "Use Composition's Shutter Angle", 'Shutter Angle', 'Sampling'],
  'ADBE Gaussian Blur 2': ['Blurriness', 'Blur Dimensions', 'Repeat Edge Pixels'], 'ADBE Linear Wipe': ['Transition Completion', 'Wipe Angle', 'Feather'] };
class Effects extends Group {
  addProperty(m) { const e = this.add(new Group(m, m, FX[m].map((n) => new Prop(n, 0)))); e.remove = () => this.kids.splice(this.kids.indexOf(e), 1); return e; }
}
function CompItem() {} function CameraLayer() {} function LightLayer() {} function TextLayer() {} function FolderItem() {}
let comp;
function layer(name, inP, outP, maxOut) {
  const L = { name, width: 1920, height: 1080, _in: inP, _out: outP, kids: [new Effects('Effects', 'ADBE Effect Parade')], property: Group.prototype.property,
    get inPoint() { return this._in; }, get outPoint() { return this._out; }, set outPoint(v) { this._out = Math.min(v, maxOut === undefined ? 1e9 : maxOut); },
    moveBefore(o) { comp.ls.splice(comp.ls.indexOf(this), 1); comp.ls.splice(comp.ls.indexOf(o), 0, this); comp.ls.forEach((x, i) => { x.index = i + 1; }); } };
  return L;
}
const A = layer('Shot A', 0, 4), B = layer('Shot B', 4, 8, 8), C = layer('Shot C', 8, 12);
comp = Object.assign(Object.create(CompItem.prototype), { ls: [C, B, A], frameDuration: 0.04, time: 0 });
comp.ls.forEach((x, i) => { x.index = i + 1; });
comp.layer = (i) => comp.ls[i - 1];
Object.defineProperty(comp, 'selectedLayers', { get() { return comp.sel; } });
comp.sel = [A, B, C];
const ctx = { BridgeTalk: { appName: 'aftereffects' }, PropertyType: PT, PropertyValueType: {}, CompItem, CameraLayer, LightLayer, TextLayer, FolderItem, ShapeLayer: function () {},
  KeyframeEase: function () {}, MarkerValue: function () {}, FootageItem: function () {}, SolidSource: function () {},
  app: { version: '26', beginUndoGroup() {}, endUndoGroup() {}, project: { activeItem: comp } } };
vm.createContext(ctx);
vm.runInContext(jsx('host.jsx'), ctx);
vm.runInContext(jsx('aftereffects.jsx'), ctx);
const run = (t, a) => JSON.parse(ctx.EW.run(t, JSON.stringify(a || {})));
const fx = (L, n) => L.kids[0].kids.find((e) => e.name === 'HaloCut Flow · ' + n);

let r = run('ae.flowInfo');
const pairs = F.pairs(r.data.layers);
assert.deepStrictEqual(pairs.map((p) => [comp.layer(p.a).name, comp.layer(p.b).name]), [['Shot A', 'Shot B'], ['Shot B', 'Shot C']]);
// a zoom on both cuts, 6 frames a side
r = run('ae.flowCut', { plan: TR.plan('zoomIn', { frames: 6 }), pairs });
assert.ok(r.ok, r.msg);
const tA = fx(A, 'Transform'), tB = fx(B, 'Transform');
assert.ok(tA && tB && fx(A, 'Blur'), 'Transform and blur on both sides');
const scaleA = tA.property('Scale'), scaleB = tB.property('Scale');
assert.deepStrictEqual(scaleA.keys.map((k) => +k.t.toFixed(2)), [3.76, 3.8, 3.84, 3.88, 3.92, 3.96, 4], 'A builds up to the cut');
assert.ok(scaleA.keys[6].v > 160 && scaleA.keys[0].v === 100);
assert.strictEqual(scaleB.keys.length, 14, 'B: out of one cut and into the next');
assert.strictEqual(tA.property("Use Composition's Shutter Angle").value, 0, 'its own motion blur');
assert.strictEqual(tA.property('Position').keys.length, 0, 'zoom leaves Position alone');

// a linear wipe over an overlap: A has to run on under B; B goes on top
r = run('ae.flowRemove');
assert.ok(r.ok && !fx(A, 'Transform'), r.msg);
comp.sel = [A, B];
r = run('ae.flowOverlap', { pairs: F.pairs(run('ae.flowInfo').data.layers), job: F.overlapJob('linear', { seconds: 1, dir: 'right' }) });
assert.ok(r.ok, r.msg);
assert.strictEqual(A.outPoint, 5, 'A extended under the wipe');
assert.ok(comp.ls.indexOf(B) < comp.ls.indexOf(A), 'B above A');
const wipe = fx(B, 'Linear wipe');
assert.deepStrictEqual(wipe.property('Transition Completion').keys.map((k) => [k.t, k.v]), [[4, 100], [5, 0]]);
assert.strictEqual(wipe.property('Wipe Angle').value, 90);
// footage that can't run on: the wipe gets shorter, and says so
comp.sel = [B, C];
r = run('ae.flowOverlap', { pairs: F.pairs(run('ae.flowInfo').data.layers), job: F.overlapJob('linear', { seconds: 1 }) });
assert.ok(!r.ok && /footage past the cut/.test(r.msg), 'B ends at 8 and cannot run on');
console.log('flow host ok ·', r.msg);
