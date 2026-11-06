// HaloCut Resize host tools on a pretend After Effects: versions made, laid out by rule, rebuilt on update.
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const R = require('../../extension/client/resize-core');
const jsx = (f) => fs.readFileSync(path.join(__dirname, '../../extension/jsx', f), 'utf8');
const PT = { PROPERTY: 6812, NAMED_GROUP: 6814 };

class Prop {
  constructor(name, matchName, value) { Object.assign(this, { name, matchName, value, propertyType: PT.PROPERTY, keys: [] }); }
  get numKeys() { return this.keys.length; }
  valueAtTime() { return this.value; }
  setValue(v) { this.value = v; }
  keyValue(k) { return this.keys[k - 1].v; }
  setValueAtKey(k, v) { this.keys[k - 1].v = v; }
}
class Group {
  constructor(name, matchName, kids = []) { Object.assign(this, { name, matchName, propertyType: PT.NAMED_GROUP, kids }); }
  property(k) { return typeof k === 'number' ? this.kids[k - 1] : this.kids.find((c) => c.matchName === k || c.name === k); }
}
function CompItem() {} function FolderItem() {} function CameraLayer() {} function LightLayer() {} function TextLayer() {} function ShapeLayer() {}
function layer(proto, name, o) {
  const L = Object.create(proto.prototype);
  const tr = new Group('Transform', 'ADBE Transform Group', [new Prop('Anchor Point', 'ADBE Anchor Point', [o.w / 2, o.h / 2]), new Prop('Position', 'ADBE Position', o.pos),
    new Prop('Scale', 'ADBE Scale', [100, 100]), new Prop('Rotation', 'ADBE Rotate Z', 0)]);
  tr.property('ADBE Position').dimensionsSeparated = false;
  if (o.keys) tr.property('ADBE Position').keys = o.keys.map((v) => ({ v }));
  return Object.assign(L, { name, comment: o.comment || '', parent: o.parent || null, nullLayer: false, kids: [tr], property: Group.prototype.property,
    sourceRectAtTime: () => ({ left: 0, top: 0, width: o.w, height: o.h }) });
}
const clone = (L) => { const c = Object.create(Object.getPrototypeOf(L)); Object.assign(c, L); c.kids = [new Group('Transform', 'ADBE Transform Group', L.kids[0].kids.map((p) => { const q = new Prop(p.name, p.matchName, Array.isArray(p.value) ? p.value.slice() : p.value); q.keys = p.keys.map((k) => ({ v: k.v.slice() })); return q; }))]; c.kids[0].property('ADBE Position').dimensionsSeparated = false; return c; };
const items = [];
const folderOf = (name) => { const f = Object.assign(Object.create(FolderItem.prototype), { name, list: [], item(i) { return this.list[i - 1]; } }); Object.defineProperty(f, 'numItems', { get() { return f.list.length; } }); return f; };
const root = folderOf('Root');
function place(it, f) { if (it._folder) it._folder.list.splice(it._folder.list.indexOf(it), 1); it._folder = f; f.list.push(it); }
function makeComp(name, w, h, ls) {
  const c = Object.assign(Object.create(CompItem.prototype), { name, width: w, height: h, duration: 10, frameDuration: 1 / 25, time: 0, ls, selectedLayers: [], usedIn: [], guides: [] });
  Object.defineProperty(c, 'numLayers', { get() { return c.ls.length; } });
  Object.defineProperty(c, 'parentFolder', { get() { return c._folder; }, set(f) { place(c, f); } });
  c.layer = (i) => c.ls[i - 1];
  c.duplicate = () => { const d = makeComp(c.name + ' 2', c.width, c.height, c.ls.map(clone)); place(d, c._folder); return d; };
  c.remove = () => { c._folder.list.splice(c._folder.list.indexOf(c), 1); c.removed = true; };
  c.addGuide = (o, p) => c.guides.push([o, p]);
  items.push(c);
  return c;
}
const bg = layer(Object, 'Background', { w: 1920, h: 1080, pos: [960, 540] });
const logo = layer(Object, 'Logo', { w: 160, h: 80, pos: [1800, 80] });
const title = layer(TextLayer, 'Title', { w: 600, h: 100, pos: [960, 540], keys: [[960, 600], [960, 540]], comment: 'halocut:resize=fit' });
const child = layer(Object, 'Badge', { w: 40, h: 40, pos: [10, 10], parent: logo });
const master = makeComp('Promo', 1920, 1080, [bg, logo, title, child]);
place(master, root);
const queue = [];
const ctx = { BridgeTalk: { appName: 'aftereffects' }, PropertyType: PT, PropertyValueType: {}, CompItem, FolderItem, CameraLayer, LightLayer, TextLayer, ShapeLayer,
  KeyframeEase: function () {}, MarkerValue: function () {}, FootageItem: function () {}, SolidSource: function () {},
  app: { version: '26', beginUndoGroup() {}, endUndoGroup() {}, project: { activeItem: master, rootFolder: root, renderQueue: { items: { add: (c) => queue.push(c.name) } },
    items: { addFolder: (n) => { const f = folderOf(n); Object.defineProperty(f, 'parentFolder', { set(p) { place(f, p); }, get() { return f._folder; } }); return f; } } } } };
vm.createContext(ctx);
vm.runInContext(jsx('host.jsx'), ctx);
vm.runInContext(jsx('aftereffects.jsx'), ctx);
const run = (t, a) => JSON.parse(ctx.EW.run(t, JSON.stringify(a || {})));

let r = run('ae.resizeInfo');
assert.ok(r.ok && r.data.layers.length === 4);
const info = r.data, from = { w: info.w, h: info.h };
assert.deepStrictEqual(info.layers.map((l) => l.kind), ['layer', 'layer', 'text', 'layer']);
assert.ok(info.layers[3].parented && info.layers[3].box === null, 'parented layers have no box of their own');
const rules = info.layers.map((l) => (l.parented ? null : R.ruleOf(l.comment, l.box, from)));
assert.deepStrictEqual(rules, ['fill', 'pin', 'fit', null]);

function job(size) {
  return { name: R.versionName(info.name, size), w: size.w, h: size.h, guides: R.guides(size),
    layers: info.layers.filter((l, i) => rules[i]).map((l, i) => Object.assign({ index: l.index }, R.affine(rules[l.index - 1], l.box, from, size))) };
}
r = run('ae.resizeMake', { sizes: [job(R.SIZES[0]), job(R.SIZES[1])], queue: true });
assert.ok(r.ok, r.msg);
const folder = root.list.find((x) => x.name === 'Promo sizes');
assert.ok(folder && folder.list.map((c) => c.name).join() === 'Promo · 9x16,Promo · 1x1');
const tall = folder.list[0], P = (c, i) => c.layer(i).kids[0].property('ADBE Position'), S = (c, i) => c.layer(i).kids[0].property('ADBE Scale');
assert.deepStrictEqual([tall.width, tall.height], [1080, 1920]);
assert.ok(Math.abs(S(tall, 1).value[0] - 100 * 1920 / 1080) < 1e-6, 'the background grows to cover the tall frame');
const u = 1080 / 1920;
assert.ok(Math.abs(P(tall, 2).value[0] - (1080 - 120 * u)) < 1e-6 && Math.abs(P(tall, 2).value[1] - 80 * u) < 1e-6, 'logo stays top-right');
assert.deepStrictEqual(P(tall, 3).keys.map((k) => Array.from(k.v, (v) => Math.round(v))), [[540, 994], [540, 960]], 'every key of the title moves');
assert.deepStrictEqual(P(tall, 4).value, [10, 10], 'the parented badge follows its parent untouched');
assert.deepStrictEqual(P(master, 2).value, [1800, 80], 'the master is untouched');
assert.ok(tall.guides.length === 4 && queue.length === 2);

// update: the old version goes and a fresh one takes its place; one used in another comp is kept, renamed
folder.list[1].usedIn = [{}];
r = run('ae.resizeMake', { sizes: [job(R.SIZES[0]), job(R.SIZES[1])], queue: false });
assert.ok(r.ok && tall.removed, r.msg);
assert.deepStrictEqual(folder.list.map((c) => c.name).sort(), ['Promo · 1x1', 'Promo · 1x1 (old)', 'Promo · 9x16']);
assert.match(r.msg, /used elsewhere/);
console.log('resize host ok ·', r.msg);
