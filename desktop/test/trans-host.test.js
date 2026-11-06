// pr.transApply on three clips in a row: the middle one gets keys at both ends, nothing is wiped.
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const R = require('../../extension/client/trans-core');
const jsx = (f) => fs.readFileSync(path.join(__dirname, '../../extension/jsx', f), 'utf8');
function prop(name, v) {
  return { displayName: name, v, keys: [], tv: false, getValue() { return this.v; }, setValue(x) { this.v = x; }, isTimeVarying() { return this.tv; },
    setTimeVarying(b) { this.tv = b; if (!b) this.keys = []; }, addKey(t) { this.keys.push({ t: t.seconds }); },
    setValueAtKey(t, v) { this.keys.find((k) => Math.abs(k.t - t.seconds) < 1e-9).v = v; } };
}
function props(list) { const a = list; a.numItems = a.length; return a; }
let id = 1;
function clip(start, end, inPt) {
  const tf = { matchName: 'AE.ADBE Geometry2', displayName: 'Transform', properties: props([prop('Anchor Point', [0.5, 0.5]), prop('Position', [0.5, 0.5]), prop('Uniform Scale', true),
    prop('Scale', 100), prop('Scale Width', 100), prop('Skew', 0), prop('Skew Axis', 0), prop('Rotation', 0), prop('Opacity', 100), prop("Use Composition's Shutter Angle", true), prop('Shutter Angle', 0)]) };
  const gb = { matchName: 'AE.ADBE Gaussian Blur 2', displayName: 'Gaussian Blur', properties: props([prop('Blurriness', 0)]) };
  const comps = [{ matchName: 'AE.ADBE Motion', displayName: 'Motion', properties: props([]) }, tf, gb]; comps.numItems = 3;
  return { nodeId: 'c' + id++, mediaType: 'Video', components: comps, start: { seconds: start }, end: { seconds: end }, inPoint: { seconds: inPt }, tf, gb };
}
const A = clip(0, 2, 10), Bc = clip(2, 4, 0), C = clip(4, 6, 5);
const v1 = props([A, Bc, C]);
const sequence = { videoTracks: [{ clips: v1 }], getSelection: () => [A, Bc, C], getSettings: () => ({ videoFrameRate: { seconds: 0.04 } }), getPlayerPosition: () => ({ seconds: 2 }) };
sequence.videoTracks.numTracks = 1;
const ctx = { BridgeTalk: { appName: 'premierepro' }, Time: function () { this.seconds = 0; }, app: { version: '26', project: { activeSequence: sequence }, enableQE() {} },
  qe: { project: { getActiveSequence: () => ({}) } } };
vm.createContext(ctx);
vm.runInContext(jsx('host.jsx'), ctx);
vm.runInContext(jsx('premiere.jsx'), ctx);
const run = (t, a) => JSON.parse(ctx.EW.run(t, JSON.stringify(a || {})));

const plan = R.plan('zoomIn', { frames: 4 });
let r = run('pr.transApply', { plan });
assert.ok(r.ok, r.msg);
assert.match(r.msg, /on 2 cuts/);
const scaleOf = (c) => c.tf.properties[3];
assert.deepStrictEqual(scaleOf(A).keys.map((k) => +(k.t - 10).toFixed(2)), [1.84, 1.88, 1.92, 1.96, 2], 'A: the last frames up to the cut');
assert.deepStrictEqual(scaleOf(C).keys.map((k) => +(k.t - 5).toFixed(2)), [0, 0.04, 0.08, 0.12, 0.16], 'C: the first frames after the cut');
assert.strictEqual(scaleOf(Bc).keys.length, 10, 'the middle clip keeps keys at both ends');
assert.ok(scaleOf(A).keys[4].v > 160 && scaleOf(C).keys[0].v > 160, 'zoomed in at the cut');
assert.strictEqual(A.tf.properties[9].v, false, 'its own shutter angle, so motion blur shows');
assert.ok(A.gb.properties[0].keys.length === 5);
r = run('pr.transRemove');
assert.ok(r.ok && !scaleOf(Bc).tv && scaleOf(Bc).v === 100 && Bc.tf.properties[2].v === true, 'remove: neutral again');
console.log('transitions host ok ·', r.msg);
