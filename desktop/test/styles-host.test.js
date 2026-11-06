// pr.capsPlace / pr.capsRemove: caption pictures in batches on one free track, with their arrival motion.
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const jsx = (f) => fs.readFileSync(path.join(__dirname, '../../extension/jsx', f), 'utf8');
const list = (a) => { Object.defineProperty(a, 'numItems', { get() { return a.length; } }); return a; };
const tracks = (a) => { Object.defineProperty(a, 'numTracks', { get() { return a.length; } }); return a; };
function prop(name, v) {
  return { displayName: name, v, keys: [], tv: false, getValue() { return this.v; }, setValue(x) { this.v = x; }, isTimeVarying() { return this.tv; },
    setTimeVarying(b) { this.tv = b; if (!b) this.keys = []; }, addKey(t) { this.keys.push({ t: t.seconds }); },
    setValueAtKey(t, v) { this.keys.find((k) => Math.abs(k.t - t.seconds) < 1e-9).v = v; } };
}
let id = 1;
function clip(pi, start, len) {
  const comps = list([
    { matchName: 'AE.ADBE Motion', displayName: 'Motion', properties: list([prop('Position', [0.5, 0.5]), prop('Scale', 100), prop('Scale Width', 100), prop('Uniform Scale', true), prop('Rotation', 0), prop('Anchor Point', [0.5, 0.5])]) },
    { matchName: 'AE.ADBE Opacity', displayName: 'Opacity', properties: list([prop('Opacity', 100)]) }]);
  return { nodeId: 'c' + id++, name: pi.name, mediaType: 'Video', projectItem: pi, components: comps, start: { seconds: start }, end: { seconds: start + len }, inPoint: { seconds: 0 },
    remove() { this.owner.splice(this.owner.indexOf(this), 1); } };
}
function track() {
  const t = { clips: list([]), isLocked: () => false };
  t.overwriteClip = (pi, at) => { const c = clip(pi, at, pi._out - pi._in); c.owner = t.clips; t.clips.push(c); };
  return t;
}
const still = (file) => ({ nodeId: 'p' + id++, name: path.basename(file), _in: 0, _out: 1e9, getMediaPath: () => file, setInPoint(v) { this._in = v; }, setOutPoint(v) { this._out = v; } });
const bin = { nodeId: 'bin', name: 'HaloCut Captions', type: 2, children: list([]) };
const video = { nodeId: 'v', name: 'Talk.mov', _in: 0, _out: 20 };
const s = { name: 'Talk', frameSizeHorizontal: 1080, frameSizeVertical: 1920, videoTracks: tracks([track()]), audioTracks: tracks([]),
  getSelection: () => [], getSettings: () => ({ videoFrameRate: { seconds: 1 / 30 } }), getPlayerPosition: () => ({ seconds: 0 }) };
s.videoTracks[0].overwriteClip(video, 0);
let imports = 0;
const ctx = { BridgeTalk: { appName: 'premierepro' }, ProjectItemType: { BIN: 2 }, Time: function () { this.seconds = 0; },
  app: { version: '26', enableQE() {}, project: { activeSequence: s, path: '/P/Talk.prproj', rootItem: { children: list([bin]), createBin: () => bin },
    importFiles(paths) { imports++; paths.forEach((p) => bin.children.push(still(p))); return true; } } },
  qe: { project: { getActiveSequence: () => ({ addTracks(n) { for (let i = 0; i < n; i++) s.videoTracks.push(track()); } }) } } };
vm.createContext(ctx);
vm.runInContext(jsx('host.jsx'), ctx);
vm.runInContext(jsx('premiere.jsx'), ctx);
const run = (t, a) => JSON.parse(ctx.EW.run(t, JSON.stringify(a || {})));

let r = run('pr.capsInfo');
assert.ok(r.ok && r.data.fps === 30 && r.data.frame.w === 1080 && r.data.placed === 0);
const files = [0, 1, 2, 3].map((i) => ({ file: `/P/HaloCut assets/cap-${i}.png`, name: 'word ' + i, start: i * 0.5, end: i * 0.5 + 0.5, motion: i === 0 ? 'pop' : 'none', anchor: [0.5, 0.78] }));
r = run('pr.capsPlace', { files: files.slice(0, 2), span: [0, 2], track: -1 });
assert.ok(r.ok, r.msg);
assert.strictEqual(r.data.track, 1, 'V1 has the video: a new track above it');
r = run('pr.capsPlace', { files: files.slice(2), span: [0, 2], track: r.data.track });
assert.ok(r.ok && imports === 2, 'two batches, one import each');
const caps = s.videoTracks[1].clips;
assert.deepStrictEqual(caps.map((c) => c.start.seconds), [0, 0.5, 1, 1.5]);
assert.ok(caps.every((c) => Math.abs(c.end.seconds - c.start.seconds - 0.5) < 1e-9 && c.projectItem.name.startsWith('HaloCut Caption · ')));
const m = caps[0].components[0].properties;
assert.deepStrictEqual(Array.from(m[5].v), [0.5, 0.78], 'pop grows about the caption');
assert.deepStrictEqual(Array.from(m[0].v), [0.5, 0.78]);
assert.deepStrictEqual(m[1].keys.map((k) => k.v), [86, 104, 100]);
assert.ok(!caps[1].components[0].properties[1].tv, 'no motion on later words');
assert.strictEqual(run('pr.capsInfo').data.placed, 4);
r = run('pr.capsRemove');
assert.ok(r.ok && caps.length === 0 && s.videoTracks[0].clips.length === 1, 'only the caption pictures go');
console.log('styles host ok ·', r.msg);
