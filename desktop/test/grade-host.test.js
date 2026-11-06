// pr.gradeRead / pr.gradeApply against a pretend Lumetri Color with Premiere's repeated control names.
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const jsx = (f) => fs.readFileSync(path.join(__dirname, '../../extension/jsx', f), 'utf8');
const list = (a) => { Object.defineProperty(a, 'numItems', { get() { return a.length; } }); return a; };
const prop = (name, v) => ({ displayName: name, v, tv: false, getValue() { return this.v; }, setValue(x) { this.v = x; }, isTimeVarying() { return this.tv; } });
// the order Lumetri lists them: section headers, then controls; Shadows, Highlights and Saturation appear twice
const LUMETRI = [['Basic Correction'], ['Input LUT', 0], ['Temperature', 0], ['Tint', 0], ['Exposure', 0], ['Contrast', 0], ['Highlights', 0], ['Shadows', 0],
  ['Whites', 0], ['Blacks', 0], ['Saturation', 100], ['Creative'], ['Faded Film', 0], ['Sharpen', 0], ['Vibrance', 0], ['Saturation', 100],
  ['Color Wheels'], ['Shadows', 0], ['Highlights', 0], ['Vignette'], ['Amount', 0], ['Midpoint', 50]];
let id = 1;
function clip(start) {
  const comps = list([{ matchName: 'AE.ADBE Motion', displayName: 'Motion', properties: list([prop('Position', [0.5, 0.5]), prop('Scale', 100)]) }]);
  return { nodeId: 'c' + id++, name: 'Shot ' + id, mediaType: 'Video', projectItem: { name: 'Shot.mov' }, components: comps, start: { seconds: start }, end: { seconds: start + 5 }, inPoint: { seconds: 0 } };
}
const A = clip(0), B = clip(5);
const v1 = { clips: list([A, B]) };
const s = { videoTracks: [v1], audioTracks: [], _sel: [], _at: 1, getSelection() { return this._sel; }, getPlayerPosition() { return { seconds: this._at }; },
  getSettings: () => ({ videoFrameRate: { seconds: 0.04 } }), frameSizeHorizontal: 1920, frameSizeVertical: 1080 };
s.videoTracks.numTracks = 1; s.audioTracks.numTracks = 0;
let added = 0;
const qeSeqMock = { getVideoTrackAt: () => ({ numItems: v1.clips.length, getItemAt: (j) => ({ type: 'Clip', start: { secs: v1.clips[j].start.seconds },
  addVideoEffect() { added++; v1.clips[j].components.push({ matchName: 'AE.ADBE Lumetri', displayName: 'Lumetri Color', properties: list(LUMETRI.map(([n, v]) => prop(n, v))) }); } }) }) };
const ctx = { BridgeTalk: { appName: 'premierepro' }, Time: function () {}, app: { version: '26', project: { activeSequence: s }, enableQE() {} },
  qe: { project: { getActiveSequence: () => qeSeqMock, getVideoEffectByName: (n) => ({ name: n }) } } };
vm.createContext(ctx);
vm.runInContext(jsx('host.jsx'), ctx);
vm.runInContext(jsx('premiere.jsx'), ctx);
const run = (t, a) => JSON.parse(ctx.EW.run(t, JSON.stringify(a || {})));
const lum = (c) => c.components.find((x) => x.displayName === 'Lumetri Color').properties;

let r = run('pr.gradeRead');
assert.ok(r.ok && r.data.here.id === A.nodeId && !r.data.had, 'no Lumetri yet');
r = run('pr.gradeApply', { ids: [A.nodeId], values: { temperature: 20, saturation: 120, vibrance: 15, highlights: -30, vignette: -1.2, exposure: 0.4 } });
assert.ok(r.ok, r.msg); assert.strictEqual(added, 1, 'Lumetri added once');
const L = lum(A);
assert.strictEqual(L[2].v, 20); assert.strictEqual(L[4].v, 0.4);
assert.strictEqual(L[10].v, 120, 'Basic saturation, not the Creative one'); assert.strictEqual(L[15].v, 100);
assert.strictEqual(L[6].v, -30, 'the Basic highlights, not the colour wheel'); assert.strictEqual(L[18].v, 0);
assert.strictEqual(L[14].v, 15); assert.strictEqual(L[20].v, -1.2, 'vignette amount');

// a clean grab: values come back and the controls go neutral, then they're put back
r = run('pr.gradeRead', { neutral: true });
assert.ok(r.data.had && r.data.values.temperature === 20 && r.data.values.saturation === 120);
assert.ok(L[2].v === 0 && L[10].v === 100 && L[20].v === 0, 'neutral for the grab');
r = run('pr.gradeApply', { ids: [A.nodeId], values: r.data.values, add: false });
assert.ok(r.ok && L[2].v === 20 && L[20].v === -1.2, 'put back');

// several clips at once; keyframed controls are left alone
s._sel = [A, B];
L[3].tv = true;
r = run('pr.gradeRead');
assert.deepStrictEqual(r.data.ids, [A.nodeId, B.nodeId]);
r = run('pr.gradeApply', { ids: r.data.ids, values: { tint: 9, contrast: 12 } });
assert.ok(r.ok && /Graded 2 clips/.test(r.msg) && /keyframed/.test(r.msg), r.msg);
assert.ok(L[3].v === 0 && L[5].v === 12 && lum(B)[3].v === 9);

// HaloCut Command's one-call look: the selection, else the clip at the playhead
s._sel = [];
s._at = 6;
r = run('pr.gradeLook', { values: { exposure: 0.7 } });
assert.ok(r.ok && lum(B)[4].v === 0.7 && L[4].v === 0.4 && /Graded 1 clip/.test(r.msg), r.msg);
s._sel = [A];
r = run('pr.gradeLook', { values: { exposure: -0.2 } });
assert.ok(r.ok && L[4].v === -0.2 && lum(B)[4].v === 0.7, r.msg);
s._sel = []; s._at = 99;
assert.ok(!run('pr.gradeLook', { values: { exposure: 1 } }).ok, 'nothing selected, nothing under the playhead');
console.log('grade host ok ·', r.msg);
