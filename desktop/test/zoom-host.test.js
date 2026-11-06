// HaloCut Zoom host tools against a pretend Premiere: zoom keys, the frame, overlays, a blur copy and cards.
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const Z = require('../../extension/client/zoom-core');
const jsx = (f) => fs.readFileSync(path.join(__dirname, '../../extension/jsx', f), 'utf8');
const list = (a) => { Object.defineProperty(a, 'numItems', { get() { return a.length; } }); return a; };
const close = (a, b, e = 1e-3) => Math.abs(a - b) < e;

function prop(name, v) { // a keyable value with linear interpolation, like Premiere's
  return { displayName: name, v, keys: [], tv: false,
    getValue() { return this.v; }, setValue(x) { this.v = x; }, isTimeVarying() { return this.tv; },
    setTimeVarying(b) { this.tv = b; if (!b) this.keys = []; },
    getKeys() { return this.keys.slice().sort((x, y) => x.t - y.t).map((k) => ({ seconds: k.t })); },
    find(t) { return this.keys.find((k) => Math.abs(k.t - t) < 1e-6); },
    addKey(t) { if (!this.find(t.seconds)) this.keys.push({ t: t.seconds, v: this.getValueAtTime(t) }); },
    setValueAtKey(t, v) { this.find(t.seconds).v = v; }, getValueAtKey(t) { return this.find(t.seconds).v; },
    removeKeyRange(a, b) { this.keys = this.keys.filter((k) => k.t < a.seconds - 1e-6 || k.t > b.seconds + 1e-6); },
    getValueAtTime(t) {
      const ks = this.keys.slice().sort((x, y) => x.t - y.t), s = t.seconds;
      if (!ks.length) return this.v;
      if (s <= ks[0].t) return ks[0].v;
      for (let i = 1; i < ks.length; i++) if (s <= ks[i].t) {
        const p = (s - ks[i - 1].t) / (ks[i].t - ks[i - 1].t), a = ks[i - 1].v, b = ks[i].v;
        return Array.isArray(a) ? [a[0] + (b[0] - a[0]) * p, a[1] + (b[1] - a[1]) * p] : a + (b - a) * p;
      }
      return ks[ks.length - 1].v;
    } };
}
let id = 1;
function clip(pi, start, len, inPt, kind = 'Video') {
  const comps = list([
    { matchName: 'AE.ADBE Motion', displayName: 'Motion', properties: list([prop('Position', [0.5, 0.5]), prop('Scale', 100), prop('Scale Width', 100), prop('Uniform Scale', true), prop('Rotation', 0), prop('Anchor Point', [0.5, 0.5])]) },
    { matchName: 'AE.ADBE Opacity', displayName: 'Opacity', properties: list([prop('Opacity', 100)]) }]);
  return { nodeId: 'c' + id++, name: pi.name, mediaType: kind, projectItem: pi, components: comps,
    start: { seconds: start }, end: { seconds: start + len }, inPoint: { seconds: inPt },
    move(tm) { this.start = { seconds: this.start.seconds + tm.seconds }; this.end = { seconds: this.end.seconds + tm.seconds }; },
    remove() { this.owner.splice(this.owner.indexOf(this), 1); } };
}
function track() {
  const t = { clips: list([]), isLocked: () => false };
  t.add = (c) => { c.owner = t.clips; t.clips.push(c); return c; };
  t.overwriteClip = (pi, at) => t.add(clip(pi, at, pi._out - pi._in, pi._in));
  return t;
}
const tracks = (a) => { Object.defineProperty(a, 'numTracks', { get() { return a.length; } }); return a; };
function media(name, file) {
  return { nodeId: 'p' + id++, name, _in: 0, _out: 3600, _path: file, subs: [],
    getProjectMetadata: () => '<VideoInfo>1920 x 1080 (1.0)</VideoInfo>', isSequence: () => false, getMediaPath() { return this._path; },
    setInPoint(v) { this._in = v; }, setOutPoint(v) { this._out = v; },
    createSubClip(n, a, b, hard, video, audio) { const s = media(n, file); s._in = a.seconds; s._out = b.seconds; s.audio = audio; this.subs.push(s); return s; },
    moveBin() {} };
}
const binItem = { nodeId: 'bin', name: 'HaloCut Zoom', type: 2, children: list([]) };
const root = { nodeId: 'root', children: list([binItem]), createBin: () => binItem };
const rec = media('Recording.mov', '/rec.mov');
const s = { name: 'Demo', frameSizeHorizontal: 1920, frameSizeVertical: 1080, _at: 1, _sel: [],
  videoTracks: tracks([track()]), audioTracks: tracks([track()]),
  getSelection() { return this._sel; }, getSettings: () => ({ videoFrameRate: { seconds: 0.04 } }), getPlayerPosition() { return { seconds: this._at }; } };
const A = s.videoTracks[0].add(clip(rec, 0, 10, 0));
const Aa = s.audioTracks[0].add(clip(rec, 0, 10, 0, 'Audio'));
const effects = { 'Gaussian Blur': ['AE.ADBE Gaussian Blur 2', ['Blurriness', 0], ['Blur Dimensions', 1], ['Repeat Edge Pixels', false]],
  Mosaic: ['AE.ADBE Mosaic', ['Horizontal Blocks', 10], ['Vertical Blocks', 10]], Crop: ['AE.ADBE Crop', ['Left', 0], ['Top', 0], ['Right', 0], ['Bottom', 0]] };
const qeSeqMock = { CTI: { timecode: '00:00:00:00' },
  addTracks(n) { for (let i = 0; i < n; i++) s.videoTracks.push(track()); },
  getVideoTrackAt(i) { const cl = s.videoTracks[i].clips; return { numItems: cl.length, getItemAt: (j) => ({ type: 'Clip', start: { secs: cl[j].start.seconds },
    addVideoEffect(fx) { const d = effects[fx.name]; cl[j].components.push({ matchName: d[0], displayName: fx.name, properties: list(d.slice(1).map(([n, v]) => prop(n, v))) }); } }) }; } };
const project = { rootItem: root, activeSequence: s, path: '/Projects/Demo.prproj', sequences: { numSequences: 0 },
  importFiles([file], q, bin) { const pi = media('pic', file); pi._out = 1e9; bin.children.push(pi); return true; } };
const ctx = { BridgeTalk: { appName: 'premierepro' }, ProjectItemType: { BIN: 2 }, Time: function () { this.seconds = 0; },
  app: { version: '26', project, enableQE() {} }, qe: { project: { getActiveSequence: () => qeSeqMock, getVideoEffectByName: (n) => ({ name: n }) } } };
vm.createContext(ctx);
vm.runInContext(jsx('host.jsx'), ctx);
vm.runInContext(jsx('premiere.jsx'), ctx);
const run = (t, a) => JSON.parse(ctx.EW.run(t, JSON.stringify(a || {})));
const motionOf = (c) => c.components[0].properties, keysOf = (p) => p.keys.slice().sort((x, y) => x.t - y.t);

// info: the clip under the playhead fills the frame
let r = run('pr.zoomInfo');
assert.ok(r.ok, r.msg);
assert.strictEqual(r.data.here.id, A.nodeId);
assert.deepStrictEqual(r.data.here.rect, { x: 0, y: 0, w: 1920, h: 1080 });
assert.strictEqual(r.data.fps, 25); assert.strictEqual(r.data.project, '/Projects/Demo.prproj');

// a 4× zoom at 1 s: in 0.4, hold 2, out 0.4
const tgt = Z.target(r.data.frame, r.data.here.rect), box = Z.fitBox({ x: 1200, y: 100, w: 480, h: 270 }, tgt);
const plan = Z.plan(tgt, box, { in: 0.4, hold: 2, out: 0.4 }, 25, 'smooth');
r = run('pr.zoomAdd', { id: A.nodeId, at: 1, keys: plan.keys });
assert.ok(r.ok, r.msg);
assert.match(r.msg, /^Zoomed 4× for 2\.8 s/);
const sc = keysOf(motionOf(A)[1]), pos = keysOf(motionOf(A)[0]);
assert.strictEqual(sc.length, plan.keys.length);
assert.ok(close(sc[0].t, 1) && sc[0].v === 100 && close(sc[sc.length - 1].t, 3.8) && sc[sc.length - 1].v === 100, 'starts and ends as it was');
const hold = sc.find((k) => close(k.t, 1.4)), hp = pos.find((k) => close(k.t, 1.4));
assert.strictEqual(hold.v, 400);
// the box's centre is now the frame's centre: position = (a + z·P0) / frame
const c = [box.x + box.w / 2, box.y + box.h / 2];
assert.ok(close(hp.v[0] * 1920 + 4 * (c[0] - 960), 960, 0.01) && close(hp.v[1] * 1080 + 4 * (c[1] - 540), 540, 0.01), `box centred ${hp.v}`);
r = run('pr.zoomAdd', { id: A.nodeId, at: 8, keys: plan.keys });
assert.ok(!r.ok && /past the end/.test(r.msg), 'a zoom that runs off the clip is refused');

// inside the zoom, info still reports the clip's own size and says the frame is zoomed
s._at = 2;
r = run('pr.zoomInfo');
assert.ok(r.data.here.inZoom && r.data.here.scale === 100);

// frame: clip shrinks to 90 % with its keys, a picture with a hole goes above it, and back again
r = run('pr.zoomFrame', { k: 0.9, groups: [{ file: '/Projects/HaloCut assets/frame.png', ids: [A.nodeId] }] });
assert.ok(r.ok, r.msg);
const frameClip = s.videoTracks[1].clips[0];
assert.ok(frameClip && frameClip.start.seconds === 0 && frameClip.end.seconds === 10 && frameClip.projectItem.name === 'HaloCut Frame ×0.900');
assert.strictEqual(keysOf(motionOf(A)[1]).find((k) => close(k.t, 1.4)).v, 360);
assert.ok(close(keysOf(motionOf(A)[0])[0].v[0], 0.5), 'centred clips stay centred');
assert.ok(!run('pr.zoomFrame', { k: 0.9, groups: [{ file: '/x.png', ids: [A.nodeId] }] }).ok, 'not framed twice');
r = run('pr.zoomUnframe');
assert.ok(r.ok && s.videoTracks[1].clips.length === 0, r.msg);
assert.strictEqual(keysOf(motionOf(A)[1]).find((k) => close(k.t, 1.4)).v, 400, 'zoom keys back as they were');

// spotlight: on top of everything at the playhead, fading in and out
r = run('pr.zoomOverlay', { file: '/spot.png', name: 'Spotlight', len: 3, fade: 0.25 });
assert.ok(r.ok, r.msg);
const spot = s.videoTracks[1].clips[0];
assert.ok(spot.start.seconds === 2 && close(spot.end.seconds, 5) && spot.projectItem.name === 'HaloCut Spotlight');
assert.deepStrictEqual(keysOf(spot.components[1].properties[0]).map((k) => k.v), [0, 100, 100, 0]);

// blur: a picture-only copy above the clip, moving with it, blurred and then cropped to the box
r = run('pr.zoomBlur', { id: A.nodeId, len: 1.6, crop: { l: 10, t: 20, r: 60, b: 50 }, mode: 'blur', amount: 30 });
assert.ok(r.ok, r.msg);
assert.strictEqual(rec.subs[0].audio, 0, 'no sound in the copy');
assert.strictEqual(s.videoTracks.length, 3, 'V2 was busy with the spotlight: a new track on top');
const copy = s.videoTracks[2].clips[0];
assert.ok(copy.start.seconds === 2 && close(copy.end.seconds, 3.6));
assert.deepStrictEqual(copy.components.slice(2).map((x) => x.displayName), ['Gaussian Blur', 'Crop'], 'blur before crop');
assert.strictEqual(copy.components[2].properties[0].v, 30); assert.strictEqual(copy.components[2].properties[2].v, true);
assert.deepStrictEqual(copy.components[3].properties.map((x) => x.v), [10, 20, 60, 50]);
const cs = motionOf(copy)[1];
assert.ok(cs.tv && close(cs.getValueAtTime({ seconds: copy.inPoint.seconds + 0.5 }), motionOf(A)[1].getValueAtTime({ seconds: 2.5 })), 'zooms with the clip');
assert.strictEqual(s.audioTracks[0].clips.length, 1, 'audio untouched');

// intro card that pushes everything later, then an outro after the end
r = run('pr.zoomCard', { file: '/intro.png', title: 'Welcome', where: 'intro', len: 2, push: true, fade: 0.4 });
assert.ok(r.ok, r.msg);
assert.ok(A.start.seconds === 2 && Aa.start.seconds === 2 && spot.start.seconds === 4 && copy.start.seconds === 4, 'everything moved 2 s');
const intro = s.videoTracks[0].clips.find((x) => x.start.seconds === 0);
assert.ok(intro && intro.projectItem.name === 'HaloCut Card · Welcome');
assert.deepStrictEqual(keysOf(intro.components[1].properties[0]).map((k) => k.v), [100, 0], 'fades out into the video');
r = run('pr.zoomCard', { file: '/outro.png', where: 'outro', len: 3, fade: 0 });
assert.ok(r.ok, r.msg);
assert.ok(s.videoTracks[0].clips.find((x) => x.start.seconds === 12), 'outro straight after the last clip');

// clear: the clip's own scale back, no keys
s._at = 3;
r = run('pr.zoomClear');
assert.ok(r.ok && !motionOf(A)[1].tv && motionOf(A)[1].v === 100 && motionOf(A)[0].v[0] === 0.5, r.msg);
console.log('zoom host ok ·', r.msg);
