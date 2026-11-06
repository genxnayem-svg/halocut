// pr.splitBuild against a pretend Premiere: a new sequence, one nest per pane, sound only on the bottom copy.
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const P = require('../../extension/client/split-core');
const jsx = (f) => fs.readFileSync(path.join(__dirname, '../../extension/jsx', f), 'utf8');
let id = 1;
const list = (a) => { Object.defineProperty(a, 'numItems', { get() { return a.length; } }); return a; };
function prop(v) { return { v, setValue(x) { this.v = x; }, getValue() { return this.v; }, isTimeVarying: () => false }; }
function clip(pi) { // a track item; `owner` is its track's clip list
  const comps = list([{ matchName: 'AE.ADBE Motion', displayName: 'Motion', properties: list([prop([0.5, 0.5]), prop(100)]) },
    { matchName: 'AE.ADBE Crop', displayName: 'Crop', properties: list([prop(0), prop(0), prop(0), prop(0)]) }]);
  return { nodeId: 't' + id++, projectItem: pi, components: comps, remove() { this.owner.splice(this.owner.indexOf(this), 1); } };
}
function track(kind, ns) {
  const t = { clips: list([]) };
  t.overwriteClip = (pi) => {
    const c = clip(pi); c.owner = t.clips; t.clips.push(c);
    if (kind === 'video') { const a = clip(pi); a.owner = ns.audioTracks[0].clips; ns.audioTracks[0].clips.push(a); } // like Premiere: its sound comes too
  };
  return t;
}
const srcItem = { nodeId: 'src', name: 'Stream' };
const binItem = { nodeId: 'b', name: 'HaloCut Split screens', type: 2, children: list([]) };
const root = { nodeId: 'root', children: list([binItem]), createBin: () => binItem };
const src = { name: 'Stream', projectItem: srcItem, sequenceID: 's1', frameSizeHorizontal: 1920, frameSizeVertical: 1080 };
const ns = { name: 'Stream split', sequenceID: 's2', _set: null, getSettings: () => ({}), setSettings(st) { this._set = st; } };
ns.audioTracks = [track('audio', ns)]; ns.audioTracks.numTracks = 1;
ns.videoTracks = [track('video', ns), track('video', ns)]; ns.videoTracks.numTracks = 2;
const project = { rootItem: root, activeSequence: src, sequences: [],
  createNewSequenceFromClips(name, items) { ns.videoTracks[0].overwriteClip(items[0]); return ns; },
  openSequence(sid) { if (sid === 's2') project.activeSequence = ns; } };
const ctx = { BridgeTalk: { appName: 'premierepro' }, ProjectItemType: { BIN: 2 }, Time: function () {}, app: { version: '26', project, enableQE() {} } };
vm.createContext(ctx);
vm.runInContext(jsx('host.jsx'), ctx);
vm.runInContext(jsx('premiere.jsx'), ctx);

const frame = P.FRAMES['9:16'], cells = P.cells('faceTop', frame, 0), s = { w: 1920, h: 1080 };
const panes = [P.place(s, frame, P.fitWindow(s, cells[0]), cells[0]), P.place(s, frame, { x: 1440, y: 0, w: 480, h: 284.444 }, cells[1])];
const r = JSON.parse(ctx.EW.run('pr.splitBuild', JSON.stringify({ name: 'Stream split', frame, panes })));
assert.ok(r.ok, r.msg);
assert.deepStrictEqual([ns._set.videoFrameWidth, ns._set.videoFrameHeight], [1080, 1920], 'new sequence is 1080×1920');
assert.strictEqual(ns.videoTracks[1].clips.length, 1, 'a second nest on V2');
assert.strictEqual(ns.audioTracks[0].clips.length, 1, 'only the bottom copy keeps its sound');
const top = ns.videoTracks[1].clips[0];
assert.strictEqual(top.components[0].properties[1].v, panes[1].scale);
assert.strictEqual(top.components[1].properties[0].v, 75, 'top pane cropped to the face cam');
assert.strictEqual(project.activeSequence, ns, 'the new sequence is open');
console.log('split host ok ·', r.msg);
