// The Premiere Tool wheel's own tools against a pretend Premiere: adjustment layers, colour mattes, speed and gain.
// Also: a saved layout that is still the old default moves to the new one, and a changed one stays.
// © 2026 Imtayz Nayem
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const vm = require('vm');
const { Config } = require('../src/config');
const { layouts, previousLayouts, tools } = require('../src/tools');

// ---- the new default, and moving to it
assert.deepStrictEqual(layouts.PPRO.segments.map((s) => s.name), ['Adjustment', 'Timeline', 'Speed', 'Effects', 'Color matte', 'Gain', 'Colour', 'Sequence']);
for (const s of layouts.PPRO.segments) {
  assert.ok(s.tools.length <= 12 && s.tools.includes(s.main), s.name);
  for (const id of s.tools) assert.ok(tools[id], id);
}
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'halocut-wheel-'));
const save = (pr) => fs.writeFileSync(path.join(dir, 'config.json'), JSON.stringify({ layouts: { PPRO: pr, AEFT: layouts.AEFT } }));
for (const old of previousLayouts.PPRO) {
  save(old);
  assert.deepStrictEqual(new Config(dir).data.layouts.PPRO, JSON.parse(JSON.stringify(layouts.PPRO)), 'an earlier default moves to the new one');
}
assert.ok(layouts.PPRO.segments.find((s) => s.name === 'Effects').tools.includes('pr.tr.dipWhite'), 'Dip to White on the Effects segment');
const mine = JSON.parse(JSON.stringify(previousLayouts.PPRO[0]));
mine.segments[0].tools.push('pr.flipH');
save(mine);
assert.deepStrictEqual(new Config(dir).data.layouts.PPRO, mine, 'a layout you changed stays yours');

// ---- a pretend Premiere
const jsx = (f) => fs.readFileSync(path.join(__dirname, '../../extension/jsx', f), 'utf8');
const list = (a) => { Object.defineProperty(a, 'numItems', { get() { return a.length; } }); return a; };
const tracksOf = (a) => { Object.defineProperty(a, 'numTracks', { get() { return a.length; } }); return a; };
const TYPE = { CLIP: 1, BIN: 2, ROOT: 3, FILE: 4 };

function level(v) {
  return { displayName: 'Level', v, tv: false, keys: [], vals: {},
    getValue() { return this.v; }, setValue(x) { this.v = x; }, isTimeVarying() { return this.tv; }, setTimeVarying(b) { this.tv = b; if (!b) { this.keys = []; this.vals = {}; } },
    getKeys() { return this.keys; }, getValueAtKey(t) { return this.vals[t]; }, setValueAtKey(t, x) { this.vals[t] = x; } };
}

function make(units) {
  let nid = 1;
  const effects = [], speedCalls = [];
  function clip(kind, start, end, o = {}) {
    const comps = kind === 'Audio' ? [{ matchName: 'audioVolume', displayName: 'Volume', properties: list([{ displayName: 'Bypass' }, o.level || level(0.1778279410038923)]) }] : [];
    return { nodeId: 'n' + nid++, name: o.name || 'Shot', mediaType: kind, projectItem: o.pi || { name: (o.name || 'Shot') + '.mov' }, components: list(comps),
      start: { seconds: start }, end: { seconds: end }, inPoint: { seconds: 0 }, selected: false, speed: 1, rev: false, adj: !!o.adj,
      setSelected(b) { this.selected = b; }, isAdjustmentLayer() { return this.adj; }, getSpeed() { return this.speed; }, isSpeedReversed() { return this.rev ? 1 : 0; } };
  }
  function track(clips, kind) {
    return { clips: list(clips), targeted: true, kind, isTargeted() { return this.targeted; }, isLocked() { return false; },
      overwriteClip(pi, at) {
        const it = clip(kind === 'audio' ? 'Audio' : 'Video', at, at + (pi._out - pi._in), { pi, name: pi.name, adj: pi._adj });
        this.clips.push(it); this.clips.sort((x, y) => x.start.seconds - y.start.seconds);
      } };
  }
  const A = clip('Video', 0, 5, { name: 'A' }), B = clip('Video', 5, 10, { name: 'B' });
  const a = clip('Audio', 0, 5, { name: 'a' }), b = clip('Audio', 5, 10, { name: 'b' });
  const s = { videoTracks: tracksOf([track([A, B], 'video'), track([], 'video')]), audioTracks: tracksOf([track([a, b], 'audio')]),
    _sel: [], _at: 1, getSelection() { return this._sel; }, getPlayerPosition() { return { seconds: this._at, ticks: String(this._at * 254016000000) }; },
    getSettings: () => ({ videoFrameRate: { seconds: 0.04 } }), frameSizeHorizontal: 1922, frameSizeVertical: 1080 };
  const projectItem = (name, o = {}) => ({ name, type: TYPE.CLIP, _in: 0, _out: 0, _adj: !!o.adj, _path: o.path || '',
    setInPoint(v) { this._in = v; }, setOutPoint(v) { this._out = v; }, getMediaPath() { return this._path; } });
  const root = { type: TYPE.ROOT, children: list([]), createBin(name) { const bin = { name, type: TYPE.BIN, children: list([]) }; this.children.push(bin); return bin; } };
  let imports = 0;
  const project = { activeSequence: s, rootItem: root,
    importFiles(files, quiet, bin) { imports++; bin.children.push(projectItem(path.basename(files[0]), { path: files[0] })); return true; } };
  function qeItems(dom) {
    return { get numItems() { return dom.clips.length; }, getItemAt: (j) => {
      const it = dom.clips[j];
      return { type: 'Clip', start: { secs: it.start.seconds },
        addVideoEffect(fx) { effects.push([it.name, fx.name]); },
        setSpeed(v, tc, rev, ripple, pitch) {
          speedCalls.push([v, rev, ripple, pitch]);
          const real = units === 'pct' ? v / 100 : v;
          if (real > 200) throw new Error('Speed out of range');
          const media = (it.end.seconds - it.start.seconds) * it.speed;
          it.speed = real; it.rev = rev; it.end = { seconds: it.start.seconds + media / real };
        } };
    } };
  }
  const qeSeq = { getVideoTrackAt: (i) => qeItems(s.videoTracks[i]), getAudioTrackAt: (i) => qeItems(s.audioTracks[i]),
    addTracks() { s.videoTracks.push(track([], 'video')); }, CTI: { timecode: '00:00:00:00' } };
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'halocut-matte-'));
  function Folder(p) { this.fsName = p; }
  Folder.prototype = { get exists() { return fs.existsSync(this.fsName); }, create() { fs.mkdirSync(this.fsName, { recursive: true }); return true; } };
  Folder.userData = { fsName: tmp };
  function File(p) { this.fsName = p; this.encoding = 'UTF-8'; }
  File.prototype = { get exists() { return fs.existsSync(this.fsName); }, get length() { return fs.existsSync(this.fsName) ? fs.statSync(this.fsName).size : -1; },
    open() { this.buf = []; return true; }, write(x) { this.buf.push(Buffer.from(x, 'latin1')); return true; }, close() { fs.writeFileSync(this.fsName, Buffer.concat(this.buf)); return true; } };
  const ctx = { BridgeTalk: { appName: 'premierepro' }, Time: function () {}, ProjectItemType: TYPE, Folder, File,
    app: { version: '26', project, enableQE() {} },
    qe: { project: { getActiveSequence: () => qeSeq, getVideoEffectByName: (n) => ({ name: n }) } } };
  vm.createContext(ctx);
  vm.runInContext(jsx('host.jsx'), ctx);
  vm.runInContext(jsx('premiere.jsx'), ctx);
  const run = (t, args) => JSON.parse(ctx.EW.run(t, JSON.stringify(args || {})));
  return { run, s, A, B, a, b, root, projectItem, effects, speedCalls, ctx, tmp, imports: () => imports, TYPE };
}

// ---- adjustment layers
let P = make('pct');
let r = P.run('pr.adjustment');
assert.ok(!r.ok && /Make one adjustment layer first/.test(r.msg), r.msg);
const bin = P.root.createBin('Graphics');
bin.children.push(P.projectItem('Adjustment Layer', { adj: true }));
P.s._sel = [P.A]; P.A.selected = true;
r = P.run('pr.adjustment', { effect: 'Lumetri Color' });
assert.ok(r.ok && /with Lumetri Color on V2 · 5 s/.test(r.msg), r.msg);
const adj = P.s.videoTracks[1].clips[0];
assert.ok(adj.start.seconds === 0 && adj.end.seconds === 5 && adj.selected && !P.A.selected, 'over the selected clip, and selected for Effect Controls');
assert.deepStrictEqual(P.effects.at(-1), ['Adjustment Layer', 'Lumetri Color']);
P.s._sel = [];
r = P.run('pr.adjustment', { whole: true });
assert.ok(r.ok && /on V3 · 10 s/.test(r.msg) && P.s.videoTracks.length === 3, 'over everything, on a new track: ' + r.msg);
P.s._at = 6;
r = P.run('pr.adjustment');
assert.ok(r.ok && /V4 · 5 s/.test(r.msg), 'nothing selected: the clip at the playhead (B): ' + r.msg);
assert.strictEqual(P.s.videoTracks[3].clips[0].start.seconds, 5);

// ---- colour mattes: a BMP the sequence's size (1922 wide: rows padded to 4 bytes), imported once
P.s._at = 12;
r = P.run('pr.matte', { color: '#E5322D', name: 'Red' });
assert.ok(r.ok && /^Red matte on V1 · 5 s/.test(r.msg), r.msg);
const file = path.join(P.tmp, 'HaloCut/Mattes/Matte E5322D 1922x1080.bmp');
const bmp = fs.readFileSync(file), row = 1922 * 3 + 2;
assert.strictEqual(bmp.length, 54 + row * 1080);
assert.strictEqual(bmp.toString('latin1', 0, 2), 'BM');
assert.deepStrictEqual([bmp.readUInt32LE(2), bmp.readInt32LE(18), bmp.readInt32LE(22), bmp.readUInt16LE(28)], [bmp.length, 1922, 1080, 24]);
assert.deepStrictEqual([...bmp.subarray(54, 57)], [0x2d, 0x32, 0xe5], 'blue, green, red');
assert.deepStrictEqual([...bmp.subarray(54 + row - 5, 54 + row + 3)], [0x2d, 0x32, 0xe5, 0, 0, 0x2d, 0x32, 0xe5], 'two bytes of padding at the end of a row');
const placed = P.s.videoTracks[0].clips.at(-1);
assert.ok(placed.start.seconds === 12 && placed.end.seconds === 17 && placed.name === 'Red matte');
r = P.run('pr.matte', { color: '#e5322d', name: 'Red' });
assert.ok(r.ok && /V1/.test(r.msg) === false && P.imports() === 1, 'the same colour again: no second import, next free track: ' + r.msg);
assert.ok(!P.run('pr.matte', { color: 'red' }).ok);

// ---- speed, when QE's setSpeed takes a percent
P.s._sel = [P.B];
r = P.run('pr.speed', { percent: 200 });
assert.ok(r.ok && /Speed 200% on 1 clip/.test(r.msg), r.msg);
assert.strictEqual(P.B.end.seconds, 7.5); assert.strictEqual(P.ctx.EW.qeSpeedDiv, 1);
assert.deepStrictEqual(P.speedCalls.at(-1), [200, false, false, false], 'no ripple');
P.run('pr.speed', { percent: 100 });
assert.strictEqual(P.B.end.seconds, 10, 'back to normal');
r = P.run('pr.reverse');
assert.ok(r.ok && P.B.rev && P.B.end.seconds === 10 && /Reversed 1 clip/.test(r.msg), r.msg);
P.run('pr.speed', { percent: 50 });
assert.ok(P.B.rev && P.B.end.seconds === 15, 'a reversed clip stays reversed');
P.s._sel = []; P.s._at = 30;
assert.ok(!P.run('pr.speed', { percent: 50 }).ok, 'nothing to change');

// ... and when it takes a multiplier: the first change shows it, and is put right straight away
const near = (x, y) => Math.abs(x - y) < 1e-6;
const M = make('mult');
M.s._sel = [M.B];
r = M.run('pr.speed', { percent: 200 });
assert.ok(r.ok && near(M.B.end.seconds, 7.5) && M.ctx.EW.qeSpeedDiv === 100, 'learned: ' + M.B.end.seconds);
M.run('pr.speed', { percent: 50 });
assert.ok(near(M.B.end.seconds, 15), String(M.B.end.seconds));
const M2 = make('mult');
M2.s._sel = [M2.B];
assert.ok(M2.run('pr.speed', { percent: 400 }).ok && near(M2.B.end.seconds, 6.25) && M2.ctx.EW.qeSpeedDiv === 100, 'out of range at first try: learned too');

// ---- gain on the clip's volume
const dbOf = (v) => 20 * Math.log10(v) + 15;
P.s._sel = [P.a];
r = P.run('pr.gain', { db: 3 });
assert.ok(r.ok && r.msg === '+3 dB on 1 sound clip · now +3 dB', r.msg);
assert.ok(Math.abs(dbOf(P.a.components[0].properties[1].v) - 3) < 1e-9);
r = P.run('pr.gain', { db: 20 });
assert.ok(/now \+15 dB/.test(r.msg), 'Premiere stops at +15 dB: ' + r.msg);
const lv = P.b.components[0].properties[1];
lv.tv = true; lv.keys = [1, 2]; lv.vals = { 1: 0.1778279410038923, 2: 0.1 };
P.s._sel = [P.B, P.b]; // a video with its sound
r = P.run('pr.gain', { db: -6 });
assert.ok(r.ok && r.msg === '−6 dB on 1 sound clip', r.msg);
assert.ok(Math.abs(dbOf(lv.vals[1]) + 6) < 1e-9 && Math.abs(dbOf(lv.vals[2]) - (dbOf(0.1) - 6)) < 1e-9, 'every key moves');
r = P.run('pr.gain', { set: 0 });
assert.ok(r.ok && !lv.tv && Math.abs(dbOf(lv.v)) < 1e-9 && /Volume 0 dB on 1 sound clip/.test(r.msg), r.msg);
P.s._sel = []; P.s._at = 1;
r = P.run('pr.gain', { db: -3 });
assert.ok(r.ok && Math.abs(dbOf(P.a.components[0].properties[1].v) - 12) < 1e-9, 'nothing selected: the sound under the playhead on targeted tracks');
P.s._sel = [P.A];
assert.ok(!P.run('pr.gain', { db: 3 }).ok, 'a video without sound');

console.log('wheel tools ok · adjustment, matte, speed (both QE units), gain');
