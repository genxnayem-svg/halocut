// pr.binScan / pr.binApply against a pretend project, and Restore with the undo it gives back.
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const jsx = (f) => fs.readFileSync(path.join(__dirname, '../../extension/jsx', f), 'utf8');
const TYPE = { CLIP: 1, BIN: 2, ROOT: 3, FILE: 4 };
let id = 1;
function kids(list) { Object.defineProperty(list, 'numItems', { get() { return list.length; } }); return list; }
function bin(name, type = TYPE.BIN) {
  const b = { nodeId: 'n' + id++, name, type, children: kids([]),
    createBin(n) { const c = bin(n); c.parent = b; b.children.push(c); return c; } };
  return b;
}
function item(name, p, o = {}) {
  return { nodeId: 'n' + id++, name, type: TYPE.CLIP, _label: 0, _path: p, _seq: !!o.seq, _off: !!o.off,
    isSequence() { return this._seq; }, getMediaPath() { return this._path; }, isOffline() { return this._off; },
    getColorLabel() { return this._label; }, setColorLabel(l) { this._label = l; }, canChangeMediaPath() { return true; },
    changeMediaPath(np) { this._path = np; this._off = false; return true; },
    moveBin(dest) { this.parent.children.splice(this.parent.children.indexOf(this), 1); dest.children.push(this); this.parent = dest; } };
}
const root = bin('Root', TYPE.ROOT);
const add = (parent, x) => { x.parent = parent; parent.children.push(x); return x; };
const seqItem = add(root, item('Main edit', '', { seq: true }));
const clipA = add(root, item('A001.mov', '/cards/A001.mov'));
const old = add(root, bin('Old'));
const logo = add(old, item('Logo.png', '/gfx/Logo.png', { off: true }));
const trackOf = (items) => { const c = kids(items.map((pi) => ({ projectItem: pi }))); return { clips: c }; };
const tracks = (list) => { const a = list.slice(); a.numTracks = a.length; return a; };
const seqs = [{ videoTracks: tracks([trackOf([clipA])]), audioTracks: tracks([]) }]; seqs.numSequences = 1;
const ctx = { BridgeTalk: { appName: 'premierepro' }, ProjectItemType: TYPE, Time: function () {},
  app: { version: '26', project: { name: 'Wedding', rootItem: root, sequences: seqs } } };
vm.createContext(ctx);
vm.runInContext(jsx('host.jsx'), ctx);
vm.runInContext(jsx('premiere.jsx'), ctx);
const run = (t, a) => JSON.parse(ctx.EW.run(t, JSON.stringify(a || {})));

let r = run('pr.binScan');
const by = Object.fromEntries(r.data.items.map((x) => [x.name, x]));
assert.ok(by['Main edit'].isSequence && by['Main edit'].used);
assert.ok(by['A001.mov'].used, 'used in a sequence');
assert.ok(!by['Logo.png'].used && by['Logo.png'].offline && by['Logo.png'].bin === 'Old');
assert.deepStrictEqual(r.data.bins, ['Old']);

r = run('pr.binApply', { moves: [{ id: clipA.nodeId, bin: '02 Footage/Cam A' }, { id: logo.nodeId, bin: '99 Unused' }],
  renames: [{ id: clipA.nodeId, name: 'Cam A 01.mov' }], labels: [{ id: logo.nodeId, label: 7 }], relinks: [{ id: logo.nodeId, path: '/new/Logo.png' }] });
assert.ok(r.ok, r.msg);
assert.strictEqual(r.msg, 'Moved 2, renamed 1, labelled 1, relinked 1');
assert.strictEqual(clipA.parent.name, 'Cam A'); assert.strictEqual(clipA.parent.parent.name, '02 Footage', 'nested bins made on the way');
assert.strictEqual(clipA.name, 'Cam A 01.mov'); assert.strictEqual(logo._label, 7); assert.strictEqual(logo._path, '/new/Logo.png');

r = run('pr.binApply', r.data.undo);
assert.ok(r.ok, r.msg);
assert.strictEqual(clipA.parent, root, 'restore moves it back'); assert.strictEqual(logo.parent, old);
assert.strictEqual(clipA.name, 'A001.mov'); assert.strictEqual(logo._label, 0); assert.strictEqual(logo._path, '/gfx/Logo.png');
console.log('bins host ok ·', r.msg);
