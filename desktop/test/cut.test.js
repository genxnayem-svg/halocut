// Runs pr.studioCut on a pretend Premiere timeline and checks every track stays in sync.
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const jsx = (f) => fs.readFileSync(path.join(__dirname, '../../extension/jsx', f), 'utf8');

let nextId = 1;
const T = (sec) => ({ seconds: sec, ticks: String(Math.round(sec * 254016000000)) });
function clip(name, s, e) {
  return { name, nodeId: String(nextId++), get start() { return T(this._s); }, get end() { return T(this._e); }, _s: s, _e: e,
    remove() { this.track.list.splice(this.track.list.indexOf(this), 1); },
    move(t) { this._s += t.seconds; this._e += t.seconds; } };
}
function track(name, clips) {
  const tr = { name, list: [], isLocked: () => false };
  clips.forEach((c) => { c.track = tr; tr.list.push(c); });
  Object.defineProperty(tr, 'clips', { get() { const a = tr.list.slice().sort((x, y) => x._s - y._s); a.numItems = a.length; return a; } });
  tr.razor = (tc) => {
    const at = Number(tc);
    const c = tr.list.find((x) => x._s < at - 1e-6 && x._e > at + 1e-6);
    if (!c) return;
    const b = clip(c.name, at, c._e); b.track = tr; tr.list.push(b); c._e = at;
  };
  return tr;
}
const tracks = (list) => { const a = list.slice(); a.numTracks = a.length; list.forEach((t, i) => { a[i] = t; }); return a; };

// V1: one long take. A1: its sound. A2: music bed. A3: empty.
const V1 = track('V1', [clip('Take', 0, 10)]);
const A1 = track('A1', [clip('Take audio', 0, 10)]);
const A2 = track('A2', [clip('Music', 0, 10)]);
const A3 = track('A3', []);
let cti = 0;
const sequence = {
  name: 'Seq', videoTracks: tracks([V1]), audioTracks: tracks([A1, A2, A3]),
  getPlayerPosition: () => T(cti), setPlayerPosition: (ticks) => { cti = Number(ticks) / 254016000000; },
  getSettings: () => ({ videoFrameRate: { seconds: 0.04 } }), clone: () => true, getSelection: () => [],
};
const qeTrack = (t) => ({ razor: (tc) => t.razor(tc) });
const ctx = {
  BridgeTalk: { appName: 'premierepro' }, Time: function () { this.seconds = 0; },
  app: { version: '26', project: { activeSequence: sequence }, enableQE() {} },
  qe: { project: { getActiveSequence: () => ({
    get CTI() { return { timecode: String(cti) }; },
    getVideoTrackAt: (i) => qeTrack([V1][i]), getAudioTrackAt: (i) => qeTrack([A1, A2, A3][i]),
  }) } },
};
vm.createContext(ctx);
vm.runInContext(jsx('host.jsx'), ctx);
vm.runInContext(jsx('premiere.jsx'), ctx);

// Cut 2.00–3.00 and 6.00–6.52 (snaps to 6.00–6.52), leave the music on A2 alone.
const res = JSON.parse(ctx.EW.run('pr.studioCut', JSON.stringify({ regions: [{ start: 2, end: 3 }, { start: 6, end: 6.52 }], keepCopy: true, skipAudio: [1] })));
assert.ok(res.ok, res.msg);
const spans = (t) => t.clips.map((c) => [Math.round(c._s * 100) / 100, Math.round(c._e * 100) / 100]);
assert.deepStrictEqual(spans(V1), [[0, 2], [2, 5], [5, 8.48]], 'picture closes both gaps');
assert.deepStrictEqual(spans(A1), spans(V1), 'sound stays in sync with picture');
assert.deepStrictEqual(spans(A2), [[0, 10]], 'music bed untouched');
assert.deepStrictEqual(spans(A3), [], 'empty track stays empty');
assert.strictEqual(cti, 0, 'playhead put back');
console.log('cut ok', res.msg);
