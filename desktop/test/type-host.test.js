// HaloCut Type host tools on a pretend After Effects text layer: animators built, retimed, removed; lines split.
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const T = require('../../extension/client/type-core');
const jsx = (f) => fs.readFileSync(path.join(__dirname, '../../extension/jsx', f), 'utf8');
const PT = { PROPERTY: 6812, NAMED_GROUP: 6814 };

class Prop {
  constructor(name, matchName, value) { Object.assign(this, { name, matchName, value, propertyType: PT.PROPERTY, keys: [], expression: '', eased: 0 }); }
  get numKeys() { return this.keys.length; }
  setValue(v) { this.value = v; }
  setValueAtTime(t, v) { this.keys = this.keys.filter((k) => Math.abs(k.t - t) > 1e-9); this.keys.push({ t, v }); this.keys.sort((a, b) => a.t - b.t); }
  keyTime(k) { return this.keys[k - 1].t; } keyValue(k) { return this.keys[k - 1].v; }
  removeKey(k) { this.keys.splice(k - 1, 1); } setTemporalEaseAtKey() { this.eased++; }
  setValueAtKey(k, v) { this.keys[k - 1].v = v; }
}
class Group {
  constructor(name, matchName, kids = [], adds) { Object.assign(this, { name, matchName, propertyType: PT.NAMED_GROUP, kids: [], adds }); kids.forEach((k) => this.add(k)); }
  add(c) { c.parentProperty = this; this.kids.push(c); this.kids.forEach((k, i) => { k.propertyIndex = i + 1; }); return c; }
  get numProperties() { return this.kids.length; }
  property(k) { return typeof k === 'number' ? this.kids[k - 1] : this.kids.find((c) => c.matchName === k || c.name === k); }
  addProperty(m) { const c = this.add(this.adds(m)); c.remove = () => { this.kids.splice(this.kids.indexOf(c), 1); this.kids.forEach((k, i) => { k.propertyIndex = i + 1; }); }; return c; }
}
const selector = (m) => (m === 'ADBE Text Wiggly Selector' ? new Group('Wiggly Selector 1', m)
  : new Group('Range Selector 1', m, [new Prop('Start', 'ADBE Text Percent Start', 0), new Prop('End', 'ADBE Text Percent End', 100), new Prop('Offset', 'ADBE Text Percent Offset', 0),
    new Group('Advanced', 'ADBE Text Range Advanced', ['ADBE Text Range Units', 'ADBE Text Range Type2', 'ADBE Text Selector Max Amount', 'ADBE Text Range Shape', 'ADBE Text Selector Smoothness', 'ADBE Text Randomize Order']
      .map((x) => new Prop(x, x, x === 'ADBE Text Selector Max Amount' ? 100 : 1)))]));
const animator = () => new Group('Animator 1', 'ADBE Text Animator', [new Group('Selectors', 'ADBE Text Selectors', [], selector), new Group('Properties', 'ADBE Text Animator Properties', [], (m) => new Prop(m, m, 0))]);
function CompItem() {} function TextLayer() {} function CameraLayer() {} function LightLayer() {} function FolderItem() {}
let comp;
function textLayer(name, text, o = {}) {
  const L = Object.create(TextLayer.prototype);
  const doc = new Prop('Source Text', 'ADBE Text Document', { text, fontSize: o.size || 80, leading: 0, autoLeading: true });
  const pos = new Prop('Position', 'ADBE Position', o.pos || [960, 400]); pos.dimensionsSeparated = false;
  Object.assign(L, { name, enabled: true, inPoint: 1, outPoint: 6, kids: [] });
  L.property = Group.prototype.property;
  L.kids = [new Group('Text', 'ADBE Text Properties', [doc, new Group('Animators', 'ADBE Text Animators', [], animator)]), new Group('Transform', 'ADBE Transform Group', [pos])];
  L.duplicate = () => {
    const d = textLayer(name, L.kids[0].property(1).value.text, { size: o.size, pos: L.kids[1].property(1).value.slice() });
    comp.ls.splice(comp.ls.indexOf(L), 0, d); comp.ls.forEach((x, i) => { x.index = i + 1; });
    return d;
  };
  return L;
}
const A = textLayer('Title', 'Make it move'), B = textLayer('Credits', 'Directed by\rSomeone\r\rMusic by');
comp = Object.assign(Object.create(CompItem.prototype), { name: 'Main', ls: [A, B], time: 0, frameDuration: 0.04 });
comp.ls.forEach((x, i) => { x.index = i + 1; });
comp.layer = (i) => comp.ls[i - 1];
Object.defineProperty(comp, 'selectedLayers', { get() { return comp.sel; } });
comp.sel = [A, B];
const ctx = { BridgeTalk: { appName: 'aftereffects' }, PropertyType: PT, PropertyValueType: {}, CompItem, TextLayer, CameraLayer, LightLayer, FolderItem, ShapeLayer: function () {},
  KeyframeEase: function (s, i) { this.influence = i; }, MarkerValue: function () {}, FootageItem: function () {}, SolidSource: function () {},
  app: { version: '26', beginUndoGroup() {}, endUndoGroup() {}, project: { activeItem: comp } } };
vm.createContext(ctx);
vm.runInContext(jsx('host.jsx'), ctx);
vm.runInContext(jsx('aftereffects.jsx'), ctx);
const run = (t, a) => JSON.parse(ctx.EW.run(t, JSON.stringify(a || {})));
const anims = (L) => L.kids[0].property('ADBE Text Animators');

let r = run('ae.typeInfo');
assert.ok(r.ok && r.data.layers.length === 2 && r.data.layers[0].fontSize === 80);
const jobs = r.data.layers.map((l) => Object.assign({ index: l.index }, T.job('rise', { fontSize: l.fontSize, inPoint: l.inPoint, outPoint: l.outPoint, duration: 0.8 })));
r = run('ae.typeApply', { jobs });
assert.ok(r.ok, r.msg);
const an = anims(A).property(1);
assert.strictEqual(an.name, 'HaloCut Type · Rise');
const props = an.property('ADBE Text Animator Properties');
assert.strictEqual(props.property('ADBE Text Opacity').value, 0);
assert.deepStrictEqual(Array.from(props.property('ADBE Text Position 3D').value), [0, 48, 0], 'position in pixels, 3D');
const sel = an.property('ADBE Text Selectors').property(1), start = sel.property('ADBE Text Percent Start');
assert.deepStrictEqual(start.keys.map((k) => [k.t, k.v]), [[1, 0], [1.8, 100]]);
assert.strictEqual(start.eased, 2);
assert.strictEqual(sel.property('ADBE Text Range Advanced').property('ADBE Text Range Type2').value, 1, 'by letters');

// wave and jitter loops
run('ae.typeApply', { jobs: [Object.assign({ index: 1 }, T.job('wave', { fontSize: 80, inPoint: 1, duration: 2 }))] });
const wave = anims(A).property(2).property('ADBE Text Selectors').property(1);
assert.ok(/HaloCut Type wave/.test(wave.property('ADBE Text Percent Offset').expression) && wave.property('ADBE Text Percent End').value === 25);
run('ae.typeApply', { jobs: [Object.assign({ index: 1 }, T.job('jitter', { fontSize: 80, inPoint: 1, duration: 1 }))] });
assert.strictEqual(anims(A).property(3).property('ADBE Text Selectors').property(1).matchName, 'ADBE Text Wiggly Selector');
assert.deepStrictEqual(run('ae.typeInfo').data.layers[0].styles, ['Rise', 'Wave', 'Jitter']);

// an out style, then retime: ins keep their start, outs their end
run('ae.typeApply', { jobs: [Object.assign({ index: 2 }, T.job('fadeOut', { fontSize: 80, inPoint: 1, outPoint: 6, duration: 1 }))] });
r = run('ae.typeRetime', { duration: 0.5 });
assert.ok(r.ok, r.msg);
assert.deepStrictEqual(start.keys.map((k) => k.t), [1, 1.5]);
const endP = anims(B).property(2).property('ADBE Text Selectors').property(1).property('ADBE Text Percent End');
assert.deepStrictEqual(endP.keys.map((k) => k.t), [5.5, 6]);

// remove takes only HaloCut animators
anims(A).addProperty('ADBE Text Animator').name = 'My own';
comp.sel = [A];
r = run('ae.typeRemove');
assert.ok(r.ok && anims(A).numProperties === 1 && anims(A).property(1).name === 'My own', r.msg);

// lines to layers: one per line, in reading order, each a line lower; the empty line keeps its gap
comp.sel = [B];
r = run('ae.typeLines');
assert.ok(r.ok, r.msg);
const made = comp.ls.filter((l) => / · line /.test(l.name));
assert.deepStrictEqual(made.map((l) => l.kids[0].property(1).value.text), ['Directed by', 'Someone', 'Music by'], 'line 1 on top');
assert.deepStrictEqual(made.map((l) => l.kids[1].property(1).value[1]), [400, 496, 688]);
assert.strictEqual(B.enabled, false);
console.log('type host ok ·', r.msg);
