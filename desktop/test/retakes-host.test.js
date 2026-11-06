// Retakes end to end on a pretend timeline: found in the words, cut with pr.studioCut, picture and sound together.
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const R = require('../../extension/client/retakes-core');
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


// a take with a false start and an "um": the words sit on the timeline from 0 s
let t = 0.4;
const words = 'so we are so we are going to um build it'.split(' ').map((w) => { const o = { text: w, start: +t.toFixed(2), end: +(t + 0.3).toFixed(2) }; t += 0.4; return o; });
const found = R.find(words, {});
assert.deepStrictEqual(found.map((f) => f.kind), ['retake', 'sound']);
const regions = R.regions(words, found);
const res = JSON.parse(ctx.EW.run('pr.studioCut', JSON.stringify({ regions, keepCopy: false, skipAudio: [1] })));
assert.ok(res.ok, res.msg);
const spans = (tr) => tr.clips.map((c) => [Math.round(c._s * 100) / 100, Math.round(c._e * 100) / 100]);
assert.deepStrictEqual(spans(A1), spans(V1), 'sound stays with picture');
assert.deepStrictEqual(spans(A2), [[0, 10]], 'music bed untouched');
const kept = 10 - R.total(regions);
assert.ok(Math.abs(V1.clips[V1.clips.length - 1]._e - kept) < 0.09, `about ${R.total(regions)} s shorter`);

// listening to a spot first
const seek = JSON.parse(ctx.EW.run('pr.seek', JSON.stringify({ t: 1.6 })));
assert.ok(seek.ok && Math.abs(cti - 1.6) < 1e-9);
console.log('retakes host ok ·', res.msg);
