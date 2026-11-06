// pr.motionApply / pr.motionRemove against a pretend clip.
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const M = require('../../extension/client/motion-core');
const jsx = (f) => fs.readFileSync(path.join(__dirname, '../../extension/jsx', f), 'utf8');

function prop(v) {
  return { v, keys: [], tv: false, getValue() { return this.v; }, setValue(x) { this.v = x; }, isTimeVarying() { return this.tv; },
    setTimeVarying(b) { this.tv = b; if (!b) this.keys = []; }, addKey(t) { this.keys.push({ t: t.seconds, v: null }); },
    setValueAtKey(t, v) { const k = this.keys.find((x) => Math.abs(x.t - t.seconds) < 1e-9); k.v = v; } };
}
const motion = { matchName: 'AE.ADBE Motion', displayName: 'Motion', properties: [prop([0.5, 0.5]), prop(100), prop(100), prop(true), prop(0)] };
const opacity = { matchName: 'AE.ADBE Opacity', displayName: 'Opacity', properties: [prop(100)] };
const comps = [motion, opacity]; comps.numItems = 2;
const clip = { mediaType: 'Video', components: comps, start: { seconds: 10 }, end: { seconds: 12 }, inPoint: { seconds: 3 } };
const sequence = { getSelection: () => [clip], getSettings: () => ({ videoFrameRate: { seconds: 0.04 } }) };
const ctx = { BridgeTalk: { appName: 'premierepro' }, Time: function () { this.seconds = 0; },
  app: { version: '26', project: { activeSequence: sequence }, enableQE() {} }, qe: { project: {} } };
vm.createContext(ctx);
vm.runInContext(jsx('host.jsx'), ctx);
vm.runInContext(jsx('premiere.jsx'), ctx);
const run = (id, a) => JSON.parse(ctx.EW.run(id, JSON.stringify(a || {})));

const rise = M.LOOKS.find((l) => l.id === 'rise');
let r = run('pr.motionApply', { start: rise.start, end: rise.end, curve: M.curve('smooth', 'forward'), timing: { mode: 'start', seconds: 0.8 } });
assert.ok(r.ok, r.msg);
const pos = motion.properties[0], op = opacity.properties[0];
assert.strictEqual(pos.keys.length, 21, 'one key a frame over 0.8 s at 25 fps');
assert.strictEqual(pos.keys[0].t, 3, 'keys sit in clip time: in point + offset');
assert.ok(Math.abs(pos.keys[20].t - 3.8) < 1e-9);
assert.deepStrictEqual(Array.from(pos.keys[0].v, (v) => +v.toFixed(3)), [0.5, 0.58], 'starts lower');
assert.deepStrictEqual(Array.from(pos.keys[20].v), [0.5, 0.5], 'lands centred');
assert.strictEqual(op.keys[0].v, 0); assert.strictEqual(op.keys[20].v, 100);
assert.strictEqual(motion.properties[1].keys.length, 0, 'scale does not move in Rise in: no keys');
r = run('pr.motionRemove');
assert.ok(r.ok && !pos.tv && pos.keys.length === 0 && op.v === 100, 'remove puts the clip back');
console.log('motion host ok ·', 'Rise in on a 2 s clip');
