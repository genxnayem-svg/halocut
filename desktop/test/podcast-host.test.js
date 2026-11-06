// HaloCut Podcast host tools on a pretend three-camera talk: switching cameras keeps every mic on; ducking the music.
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const P = require('../../extension/client/podcast-core');
const jsx = (f) => fs.readFileSync(path.join(__dirname, '../../extension/jsx', f), 'utf8');
const TICKS = 254016000000;
const T = (sec) => ({ seconds: sec, ticks: String(Math.round(sec * TICKS)) });
const list = (a) => { Object.defineProperty(a, 'numItems', { get() { return a.length; } }); return a; };
function prop(name, v) {
  return { displayName: name, v, keys: [], tv: false, getValue() { return this.v; }, setValue(x) { this.v = x; }, isTimeVarying() { return this.tv; },
    setTimeVarying(b) { this.tv = b; if (!b) this.keys = []; }, getKeys() { return this.keys.map((k) => ({ seconds: k.t })); },
    getValueAtKey(t) { return this.keys.find((k) => Math.abs(k.t - t.seconds) < 1e-9).v; },
    addKey(t) { this.keys.push({ t: t.seconds, v: this.v }); }, setValueAtKey(t, v) { this.keys.find((k) => Math.abs(k.t - t.seconds) < 1e-9).v = v; } };
}
let id = 1;
function clip(name, s, e, o = {}) {
  const c = { name, nodeId: 'n' + id++, _s: s, _e: e, _off: false, partner: null, mediaType: o.audio ? 'Audio' : 'Video',
    projectItem: { name, getMediaPath: () => '/media/' + name + '.wav' },
    components: list(o.volume ? [{ matchName: 'audioVolume', displayName: 'Volume', properties: list([prop('Bypass', false), prop('Level', o.volume)]) }] : []),
    get start() { return T(this._s); }, get end() { return T(this._e); }, get inPoint() { return T(0); }, get outPoint() { return T(this._e - this._s); },
    // like a linked clip in Premiere might: switching the picture off switches its sound off too
    get disabled() { return this._off; }, set disabled(b) { this._off = b; if (this.partner && b) this.partner._off = true; } };
  return c;
}
function track(name, clips) {
  const tr = { name, list: [], isLocked: () => false };
  tr.add = (c) => { c.track = tr; tr.list.push(c); return c; };
  clips.forEach(tr.add);
  Object.defineProperty(tr, 'clips', { get() { return list(tr.list.slice().sort((x, y) => x._s - y._s)); } });
  tr.razor = (tc) => { const at = Number(tc); const c = tr.list.find((x) => x._s < at - 1e-6 && x._e > at + 1e-6); if (c) { const b = clip(c.name, at, c._e); b.partner = c.partner; tr.add(b); c._e = at; } };
  return tr;
}
const tracks = (a) => { Object.defineProperty(a, 'numTracks', { get() { return a.length; } }); return a; };
const mics = [clip('Mic 1', 0, 20, { audio: true }), clip('Mic 2', 0, 20, { audio: true })];
const cams = [clip('Cam 1', 0, 20), clip('Cam 2', 0, 20), clip('Wide', 0, 20)];
cams[0].partner = mics[0]; cams[1].partner = mics[1];
const music = clip('Music', 0, 20, { audio: true, volume: P.dbToLevel(-6) });
let cti = 0;
const s = { name: 'Talk', videoTracks: tracks(cams.map((c, i) => track('V' + (i + 1), [c]))), audioTracks: tracks([track('Host', [mics[0]]), track('Guest', [mics[1]]), track('Music', [music])]),
  getSelection: () => [], getSettings: () => ({ videoFrameRate: { seconds: 0.04 } }), getPlayerPosition: () => T(cti),
  setPlayerPosition: (ticks) => { cti = Number(ticks) / TICKS; }, clone: () => true };
const ctx = { BridgeTalk: { appName: 'premierepro' }, Time: function () { this.seconds = 0; },
  app: { version: '26', enableQE() {}, project: { activeSequence: s } },
  qe: { project: { getActiveSequence: () => ({ get CTI() { return { timecode: String(cti) }; }, getVideoTrackAt: (i) => s.videoTracks[i] }) } } };
vm.createContext(ctx);
vm.runInContext(jsx('host.jsx'), ctx);
vm.runInContext(jsx('premiere.jsx'), ctx);
const run = (t, a) => JSON.parse(ctx.EW.run(t, JSON.stringify(a || {})));

let r = run('pr.podTracks');
assert.ok(r.ok && r.data.video.length === 3 && r.data.audio[1].name === 'Guest' && r.data.end === 20);
r = run('pr.podClips', { audio: [0, 2] });
assert.strictEqual(r.data.tracks[0].clips[0].path, '/media/Mic 1.wav');
assert.ok(Math.abs(P.levelToDb(r.data.tracks[1].clips[0].level) + 6) < 1e-9, "the music's own level");

// host, guest, wide, host
const cuts = [{ start: 0, end: 6, cam: 0 }, { start: 6, end: 11, cam: 1 }, { start: 11, end: 14, cam: 2 }, { start: 14, end: 20, cam: 0 }];
r = run('pr.autoCam', { cams: [0, 1, 2], cuts, keepCopy: true });
assert.ok(r.ok, r.msg);
const on = (tr) => s.videoTracks[tr].clips.map((c) => (c._off ? '-' : 'x') + c._s).join(' ');
assert.strictEqual(on(0), 'x0 -6 -11 x14');
assert.strictEqual(on(1), '-0 x6 -11 -14');
assert.strictEqual(on(2), '-0 -6 x11 -14');
assert.ok(mics.every((m) => !m._off) && !music._off, 'every mic and the music stay on');

// duck: keys from the core, written as Level values
const keys = P.duckKeys([{ start: 2, end: 5 }], 0, 20, -6, { depth: 12 }).map((k) => ({ t: k.t, v: P.dbToLevel(k.db) }));
r = run('pr.duck', { clips: [{ id: music.nodeId, keys }] });
assert.ok(r.ok, r.msg);
const lvl = music.components[0].properties[1];
assert.ok(lvl.tv && lvl.keys.length === keys.length);
assert.ok(Math.abs(P.levelToDb(lvl.keys.find((k) => k.t === 2).v) + 18) < 1e-6, 'down 12 dB under the voice');
r = run('pr.duckClear', { track: 2 });
assert.ok(r.ok && !lvl.tv && Math.abs(P.levelToDb(lvl.v) + 6) < 1e-6, 'back to its own level');
console.log('podcast host ok ·', r.msg);
