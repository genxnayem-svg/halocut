// HaloCut Command's sharper Premiere commands on a pretend timeline: nudge, move to the playhead, close one gap,
// delete switched-off clips, jump between markers, mute a clip's sound.
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const jsx = (f) => fs.readFileSync(path.join(__dirname, '../../extension/jsx', f), 'utf8');
const TICKS = 254016000000, fd = 0.04;
const T = (sec) => ({ seconds: sec, ticks: String(Math.round(sec * TICKS)) });
const list = (a) => { Object.defineProperty(a, 'numItems', { get() { return a.length; } }); return a; };
let id = 1;
function clip(name, s, e, o = {}) {
  return { name, nodeId: 'n' + id++, _s: s, _e: e, mediaType: o.audio ? 'Audio' : 'Video', disabled: !!o.disabled, projectItem: { name },
    get start() { return T(this._s); }, get end() { return T(this._e); },
    move(t) { this._s += t.seconds; this._e += t.seconds; if (this.partner) { this.partner._s += t.seconds; this.partner._e += t.seconds; } },
    remove() { this.track.list.splice(this.track.list.indexOf(this), 1); } };
}
function track(clips) {
  const tr = { list: [], isLocked: () => false };
  clips.forEach((c) => { c.track = tr; tr.list.push(c); });
  Object.defineProperty(tr, 'clips', { get() { return list(tr.list.slice().sort((x, y) => x._s - y._s)); } });
  return tr;
}
const tracks = (a) => { Object.defineProperty(a, 'numTracks', { get() { return a.length; } }); return a; };
// V1: A 0–4, B 6–10 (a 2 s gap), C 10–12 switched off; A1: A's sound, linked to it
const A = clip('A', 0, 4), B = clip('B', 6, 10), C = clip('C', 10, 12, { disabled: true }), Aa = clip('A', 0, 4, { audio: true });
A.partner = Aa; // moving the picture takes its sound along, as Premiere does with linked clips
const V1 = track([A, B, C]), A1 = track([Aa]);
let cti = 5, sel = [];
const markers = [2, 7, 11].map((t) => ({ start: T(t) }));
const s = { videoTracks: tracks([V1]), audioTracks: tracks([A1]), getSelection: () => sel, getSettings: () => ({ videoFrameRate: { seconds: fd } }),
  getPlayerPosition: () => T(cti), setPlayerPosition: (ticks) => { cti = Number(ticks) / TICKS; },
  markers: { getFirstMarker: () => markers[0], getNextMarker: (m) => markers[markers.indexOf(m) + 1] } };
const ctx = { BridgeTalk: { appName: 'premierepro' }, Time: function () { this.seconds = 0; }, app: { version: '26', enableQE() {}, project: { activeSequence: s } } };
vm.createContext(ctx);
vm.runInContext(jsx('host.jsx'), ctx);
vm.runInContext(jsx('premiere.jsx'), ctx);
const run = (t, a) => JSON.parse(ctx.EW.run(t, JSON.stringify(a || {})));
const r2 = (x) => Math.round(x * 100) / 100;

// nudge the linked pair: moved once, not twice
sel = [A, Aa];
let r = run('pr.nudge', { frames: 5 });
assert.ok(r.ok, r.msg);
assert.deepStrictEqual([r2(A._s), r2(Aa._s)], [0.2, 0.2], 'picture and sound moved 5 frames, once');
r = run('pr.nudge', { frames: -10 });
assert.ok(!r.ok && /start of the sequence/.test(r.msg), r.msg);
run('pr.nudge', { frames: -5 });
assert.strictEqual(r2(A._s), 0);
sel = [];
assert.ok(!run('pr.nudge', { frames: 1 }).ok, 'nothing selected');

// close only the gap under the playhead (4–6), on every track
cti = 5;
r = run('pr.closeGapHere');
assert.ok(r.ok, r.msg);
assert.deepStrictEqual(V1.clips.map((c) => [r2(c._s), r2(c._e)]), [[0, 4], [4, 8], [8, 10]]);
cti = 1;
assert.ok(!run('pr.closeGapHere').ok, 'no gap where something plays');

// move to the playhead
sel = [B]; cti = 6;
r = run('pr.moveToPlayhead');
assert.ok(r.ok && r2(B._s) === 6, r.msg);

// delete switched-off clips
r = run('pr.deleteDisabled');
assert.ok(r.ok && !V1.list.includes(C), r.msg);
assert.ok(!run('pr.deleteDisabled').ok);

// markers: next and previous from the playhead
cti = 3;
run('pr.markerJump', { dir: 1 }); assert.strictEqual(cti, 7);
run('pr.markerJump', { dir: -1 }); assert.strictEqual(cti, 2);
assert.ok(!run('pr.markerJump', { dir: -1 }).ok, 'nothing before the first');

// mute: selecting the picture finds its own sound, and the second press turns it back on
sel = [A];
r = run('pr.muteClips');
assert.ok(r.ok && Aa.disabled && !A.disabled, r.msg);
r = run('pr.muteClips');
assert.ok(r.ok && !Aa.disabled && /Unmuted/.test(r.msg), r.msg);
console.log('command host ok ·', r.msg);
