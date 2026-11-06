// HaloCut Toolbar host tools on a pretend timeline: QC check, freeze frames, stairs, J and L cuts.
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const jsx = (f) => fs.readFileSync(path.join(__dirname, '../../extension/jsx', f), 'utf8');
const TICKS = 254016000000, fd = 0.04;
const T = (sec) => ({ seconds: sec, ticks: String(Math.round(sec * TICKS)) });
const list = (a) => { Object.defineProperty(a, 'numItems', { get() { return a.length; } }); return a; };
const prop = (v) => ({ v, getValue() { return this.v; }, isTimeVarying: () => false });
let id = 1;
// a clip whose start and end trim it (as Premiere's do), within the media it has
function clip(name, s, e, o = {}) {
  const c = { name, nodeId: 'n' + id++, _s: s, _e: e, mediaType: o.audio ? 'Audio' : 'Video', disabled: !!o.disabled, _sel: false,
    minStart: o.minStart ?? -1e9, maxEnd: o.maxEnd ?? 1e9,
    projectItem: { name: o.pi || name, isOffline: () => !!o.offline, getProjectMetadata: () => '<VideoInfo>1920 x 1080</VideoInfo>', isSequence: () => false },
    components: list([{ matchName: 'AE.ADBE Motion', displayName: 'Motion', properties: list([prop([0.5, 0.5]), prop(o.scale || 100)]) }]),
    get start() { return T(this._s); }, set start(t) { if (t.seconds >= this.minStart && t.seconds < this._e) this._s = t.seconds; },
    get end() { return T(this._e); }, set end(t) { if (t.seconds <= this.maxEnd && t.seconds > this._s) this._e = t.seconds; },
    get inPoint() { return T(0); },
    move(t) { this._s += t.seconds; this._e += t.seconds; }, remove() { this.track.list.splice(this.track.list.indexOf(this), 1); },
    setSelected(b) { this._sel = b; } };
  return c;
}
function track(clips) {
  const tr = { list: [], isLocked: () => false };
  tr.add = (c) => { c.track = tr; tr.list.push(c); return c; };
  clips.forEach(tr.add);
  Object.defineProperty(tr, 'clips', { get() { const a = tr.list.slice().sort((x, y) => x._s - y._s); return list(a); } });
  tr.overwriteClip = (pi, at) => tr.add(clip(pi.name, at, at + pi._out - pi._in, { pi: pi.name }));
  tr.razor = (tc) => { const at = Number(tc); const c = tr.list.find((x) => x._s < at - 1e-6 && x._e > at + 1e-6); if (c) { const b = clip(c.name, at, c._e, { audio: c.mediaType === 'Audio' }); tr.add(b); c._e = at; } };
  return tr;
}
const tracks = (a) => { Object.defineProperty(a, 'numTracks', { get() { return a.length; } }); return a; };

// V1: A 0–4, B 4–8 (a cut at 4), C 8.04–8.08 (a one-frame flash after a black frame), D 9–12 shrunk; V2: an offline title, a switched-off clip
const A = clip('A', 0, 4), B = clip('B', 4, 8), C = clip('C', 8.04, 8.08), D = clip('D', 9, 12, { scale: 80 });
const Aa = clip('A', 0, 4, { audio: true, maxEnd: 4.6 }), Ba = clip('B', 4, 8, { audio: true, minStart: 3.4 });
const V1 = track([A, B, C, D]), V2 = track([clip('Title', 1, 3, { offline: true }), clip('Old', 5, 6, { disabled: true })]), A1 = track([Aa, Ba]);
let cti = 4, sel = [];
const s = { name: 'QC', frameSizeHorizontal: 1920, frameSizeVertical: 1080, videoTracks: tracks([V1, V2]), audioTracks: tracks([A1]),
  getSelection: () => sel, getSettings: () => ({ videoFrameRate: { seconds: fd } }), getPlayerPosition: () => T(cti),
  setPlayerPosition: (ticks) => { cti = Number(ticks) / TICKS; }, linkSelection() {}, unlinkSelection() {} };
const bin = { nodeId: 'bin', name: 'HaloCut Freeze frames', type: 2, children: list([]) };
const ctx = { BridgeTalk: { appName: 'premierepro' }, ProjectItemType: { BIN: 2 }, Time: function () { this.seconds = 0; },
  app: { version: '26', enableQE() {}, project: { activeSequence: s, sequences: { numSequences: 0 }, rootItem: { children: list([bin]), createBin: () => bin },
    importFiles([file]) { bin.children.push({ name: 'f', _in: 0, _out: 1e9, getMediaPath: () => file, setInPoint(v) { this._in = v; }, setOutPoint(v) { this._out = v; } }); return true; } } },
  qe: { project: { getActiveSequence: () => ({ get CTI() { return { timecode: String(cti) }; }, getVideoTrackAt: (i) => s.videoTracks[i], getAudioTrackAt: (i) => s.audioTracks[i],
    addTracks(n) { for (let i = 0; i < n; i++) s.videoTracks.push(track([])); } }) } } };
vm.createContext(ctx);
vm.runInContext(jsx('host.jsx'), ctx);
vm.runInContext(jsx('premiere.jsx'), ctx);
const run = (t, a) => JSON.parse(ctx.EW.run(t, JSON.stringify(a || {})));
const r2 = (x) => Math.round(x * 100) / 100;

// QC
let r = run('pr.qcCheck');
assert.ok(r.ok, r.msg);
const kinds = r.data.issues.map((i) => i.kind).sort();
assert.deepStrictEqual(kinds, ['disabled', 'edges', 'flash', 'gap', 'gap', 'offline'].sort(), kinds.join(','));
const gaps = r.data.issues.filter((i) => i.kind === 'gap');
assert.deepStrictEqual(gaps.map((g) => [r2(g.start), r2(g.end)]), [[8, 8.04], [8.08, 9]]);
assert.strictEqual(gaps[0].text, 'Black for 1 frame');
assert.match(r.data.issues.find((i) => i.kind === 'edges').text, /^D doesn't fill/);

// L cut: A's sound runs 12 frames into B; the picture stays put and the clips are linked again
r = run('pr.jlCut', { kind: 'l', frames: 12 });
assert.ok(r.ok, r.msg);
assert.deepStrictEqual([r2(Aa._e), r2(Ba._s)], [4.48, 4.48]);
assert.deepStrictEqual([A._e, B._s], [4, 4], 'picture cut unchanged');
// a J cut on top that asks for more sound than B has before its start: refused, every edge back as it was
r = run('pr.jlCut', { kind: 'j', frames: 20 });
assert.ok(!r.ok && /extra sound/.test(r.msg), r.msg);
assert.deepStrictEqual([r2(Aa._e), r2(Ba._s)], [4.48, 4.48], 'the L cut is still there');
r = run('pr.jlCut', { kind: 'j', frames: 10 });
assert.ok(r.ok && r2(Ba._s) === 3.6 && r2(Aa._e) === 3.6, r.msg);

// freeze over the clip, then one that makes room
cti = 2;
r = run('pr.freeze', { file: '/tmp/f1.png', len: 1.5 });
assert.ok(r.ok, r.msg);
const still = s.videoTracks.map((t) => t.list.find((c) => c.name.startsWith('HaloCut Freeze') && c._s === 2)).find(Boolean);
assert.ok(still && r2(still._e - still._s) === 1.52, 'held for 1.5 s, on frames');
assert.ok(s.videoTracks.indexOf(still.track) >= 1, 'above the clip');
cti = 6;
r = run('pr.freeze', { file: '/tmp/f2.png', len: 1, insert: true });
assert.ok(r.ok, r.msg);
const held = V1.list.find((c) => c._s === 6 && c.name.startsWith('HaloCut Freeze'));
assert.ok(held && r2(held._e) === 7, 'in the gap it made on the clip’s own track');
assert.deepStrictEqual(V1.clips.map((c) => [r2(c._s), r2(c._e)]).slice(-3), [[7, 9], [9.04, 9.08], [10, 13]], 'the rest of B and everything after moved 1 s');

// stairs: select clips on V1 and V2, stair down puts the top one first
const top = V2.list[0];
sel = [D, top];
r = run('pr.stair', { frames: 5 });
assert.ok(r.ok, r.msg);
assert.ok(r2(D._s - top._s) === 0.2, 'the lower clip starts 5 frames later');
console.log('toolbar host ok ·', r.msg);
