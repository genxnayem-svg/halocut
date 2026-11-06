// HaloCut Kit host tools against a pretend After Effects: rigs on, retuned, baked, removed; rename, stagger, align, tidy.
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const K = require('../../extension/client/kit-core');
const jsx = (f) => fs.readFileSync(path.join(__dirname, '../../extension/jsx', f), 'utf8');
const PT = { PROPERTY: 6812, INDEXED_GROUP: 6813, NAMED_GROUP: 6814 };

class Prop {
  constructor(name, matchName, value) { Object.assign(this, { name, matchName, value, propertyType: PT.PROPERTY, canSetExpression: true, expression: '', expressionError: '', keys: [], fake: null }); }
  get numKeys() { return this.keys.length; }
  valueAtTime(t, pre) { return !pre && this.expression && this.fake ? this.fake(t) : this.value; }
  setValue(v) { this.value = v; }
  setValuesAtTimes(ts, vs) { ts.forEach((t, i) => this.keys.push({ t, v: vs[i] })); }
  removeKey(k) { this.keys.splice(k - 1, 1); }
  keyValue(k) { return this.keys[k - 1].v; }
  setValueAtKey(k, v) { this.keys[k - 1].v = v; }
}
class Group {
  constructor(name, matchName, kids = []) { Object.assign(this, { name, matchName, propertyType: PT.NAMED_GROUP, kids: [] }); kids.forEach((k) => this.add(k)); }
  add(c) { c.parentProperty = this; this.kids.push(c); this.renumber(); return c; }
  renumber() { this.kids.forEach((k, i) => { k.propertyIndex = i + 1; }); }
  get numProperties() { return this.kids.length; }
  property(k) { return typeof k === 'number' ? this.kids[k - 1] : this.kids.find((c) => c.matchName === k || c.name === k); }
}
class Effects extends Group {
  addProperty(matchName) {
    const e = this.add(new Group(matchName, matchName, [new Prop('Value', matchName + '-0001', 0)]));
    e.remove = () => { this.kids.splice(this.kids.indexOf(e), 1); this.renumber(); };
    return e;
  }
}
function CompItem() {} function FolderItem() {} function FootageItem() {} function SolidSource() {} function CameraLayer() {} function LightLayer() {}
let idx = 0;
function layer(name, o = {}) {
  const tr = new Group('Transform', 'ADBE Transform Group', [new Prop('Anchor Point', 'ADBE Anchor Point', [0, 0]), new Prop('Position', 'ADBE Position', o.pos || [100, 100]),
    new Prop('Scale', 'ADBE Scale', [100, 100]), new Prop('Rotation', 'ADBE Rotate Z', 0), new Prop('Opacity', 'ADBE Opacity', 100)]);
  const kids = [new Effects('Effects', 'ADBE Effect Parade'), tr];
  if (o.text) kids.unshift(new Group('Text', 'ADBE Text Properties', [new Prop('Source Text', 'ADBE Text Document', 'Hi')]));
  const L = new Group(name, 'ADBE Vector Layer', kids);
  L.parentProperty = null; L.index = ++idx; L.selectedProperties = []; L.parent = null; L.startTime = 0; L._in = 0; L._len = o.len || 1;
  Object.defineProperty(L, 'inPoint', { get() { return this.startTime + this._in; } });
  Object.defineProperty(L, 'outPoint', { get() { return this.startTime + this._in + this._len; } });
  L.sourceRectAtTime = () => ({ left: 0, top: 0, width: o.w || 50, height: o.h || 20 });
  tr.property('ADBE Position').dimensionsSeparated = false;
  return L;
}
const A = layer('Box', { pos: [100, 100] }), B = layer('Title', { text: true, pos: [400, 300], w: 200 }), C = layer('Dot', { pos: [700, 50], len: 2 });
const comp = Object.assign(new CompItem(), { name: 'Main', width: 1920, height: 1080, duration: 10, frameDuration: 0.04, time: 0, layers: [A, B, C], selectedLayers: [A, B] });
comp.layer = (i) => comp.layers[i - 1];
const root = { numItems: 0, list: [], item(i) { return this.list[i - 1]; } };
Object.defineProperty(root, 'numItems', { get() { return root.list.length; } });
const item = (proto, name, extra = {}) => { const it = Object.assign(Object.create(proto.prototype), { name }, extra); root.list.push(it); return it; };
item(CompItem, 'Main'); item(FootageItem, 'logo.png', { file: { name: 'logo.png' } }); item(FootageItem, 'music.wav', { file: { name: 'music.wav' } });
item(FootageItem, 'Black Solid', { mainSource: new SolidSource() }); item(FootageItem, 'take1.mov', { file: { name: 'take1.mov' } });
const ctx = { BridgeTalk: { appName: 'aftereffects' }, PropertyType: PT, PropertyValueType: {}, CompItem, FolderItem, FootageItem, SolidSource, CameraLayer, LightLayer,
  KeyframeEase: function () {}, MarkerValue: function () {},
  app: { version: '26', beginUndoGroup() {}, endUndoGroup() {}, project: { activeItem: comp, rootFolder: root, removeUnusedFootage: () => 2,
    items: { addFolder: (n) => item(FolderItem, n) } } } };
vm.createContext(ctx);
vm.runInContext(jsx('host.jsx'), ctx);
vm.runInContext(jsx('aftereffects.jsx'), ctx);
const run = (t, a) => JSON.parse(ctx.EW.run(t, JSON.stringify(a || {})));
const fxNames = (L) => L.property('ADBE Effect Parade').kids.map((e) => e.name);
const pos = (L) => L.property('ADBE Transform Group').property('ADBE Position');

// a rig on both selected layers: no property selected, so it goes on Position
let r = run('ae.rigApply', K.job('wiggle', { a: 40 }));
assert.ok(r.ok, r.msg);
assert.ok(/^\/\/ HaloCut rig: wiggle/.test(pos(A).expression) && pos(B).expression === pos(A).expression);
assert.deepStrictEqual(fxNames(A), ['HaloCut Wiggle · Frequency', 'HaloCut Wiggle · Amount']);
assert.strictEqual(A.property('ADBE Effect Parade').property(2).property(1).value, 40);
// a selected property wins over the usual one
const opac = A.property('ADBE Transform Group').property('ADBE Opacity');
A.selectedProperties = [opac];
r = run('ae.rigApply', K.job('hold'));
assert.ok(r.ok && /HaloCut rig: hold/.test(opac.expression) && /HaloCut rig: wiggle/.test(pos(A).expression), r.msg);
A.selectedProperties = [];
// text rigs only go on text layers
r = run('ae.rigApply', K.job('counter'));
assert.ok(r.ok && /on 1 property/.test(r.msg) && /rig: counter/.test(B.property('ADBE Text Properties').property(1).expression), r.msg);

r = run('ae.rigScan');
assert.deepStrictEqual(r.data.rigs.map((x) => x.layer + ':' + x.id).sort(), ['Box:hold', 'Box:wiggle', 'Title:counter', 'Title:wiggle']);
assert.strictEqual(r.data.rigs.find((x) => x.id === 'counter').values['HaloCut Number counter · To'], 1000);
r = run('ae.rigUpdate', { controls: [{ name: 'HaloCut Wiggle · Amount', value: 99 }] });
assert.strictEqual(B.property('ADBE Effect Parade').property('HaloCut Wiggle · Amount').property(1).value, 99);

// bake: one key a frame from what the rig does, then the rig and its controls go
pos(A).fake = (t) => [100 + t * 100, 100];
r = run('ae.rigBake', { id: 'wiggle' });
assert.ok(r.ok, r.msg);
assert.strictEqual(pos(A).expression, '');
assert.strictEqual(pos(A).keys.length, 25, 'a second at 25 fps');
assert.deepStrictEqual(pos(A).keys[10].v, [140, 100]);
assert.ok(!fxNames(A).some((n) => /Wiggle/.test(n)) && fxNames(A).some((n) => /Choppy/.test(n)), 'only the baked rig’s controls go');
r = run('ae.rigRemove', { id: 'counter' });
assert.ok(r.ok && B.property('ADBE Text Properties').property(1).expression === '' && !fxNames(B).some((n) => /counter/.test(n)), r.msg);
assert.ok(!run('ae.rigRemove', { id: 'counter' }).ok);

// rename, stagger, sequence
comp.selectedLayers = [C, A, B];
r = run('ae.kitRename', { pattern: 'Shot {n} {name}', pad: 2 });
assert.deepStrictEqual([A.name, B.name, C.name], ['Shot 01 Box', 'Shot 02 Title', 'Shot 03 Dot'], 'numbered top to bottom');
run('ae.kitRename', { find: 'Shot 0' });
r = run('ae.kitTime', { frames: 5 });
assert.deepStrictEqual([A, B, C].map((l) => +l.inPoint.toFixed(3)), [0, 0.2, 0.4]);
r = run('ae.kitTime', { mode: 'sequence', overlap: 0 });
assert.deepStrictEqual([A, B, C].map((l) => +l.inPoint.toFixed(3)), [0, 1, 2]);

// align: boxes from the layers, moves from the kit maths, the whole animation shifts
r = run('ae.kitBoxes');
const moves = K.align(r.data.boxes, 'left').map((m, i) => ({ index: r.data.boxes[i].index, dx: m[0], dy: m[1] }));
r = run('ae.kitMove', { moves });
assert.ok(r.ok, r.msg);
assert.ok(pos(B).keys.length && pos(B).keys.every((k) => k.v[0] === 100), 'lined up with the leftmost, every baked key moved with it');
assert.strictEqual(pos(C).value[0], 100);
assert.ok(pos(A).keys.every((k) => k.v[0] >= 100), 'keyframes kept, not touched since it was already left');

// tidy and unused
r = run('ae.kitTidy');
assert.ok(r.ok, r.msg);
const where = (n) => root.list.find((i) => i.name === n).parentFolder.name;
assert.deepStrictEqual(['Main', 'logo.png', 'music.wav', 'Black Solid', 'take1.mov'].map(where), ['Comps', 'Images', 'Audio', 'Solids', 'Footage']);
assert.match(run('ae.kitUnused').msg, /Removed 2 unused items/);
console.log('kit host ok ·', r.msg);
