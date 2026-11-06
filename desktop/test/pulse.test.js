// pr.pulse / pr.pulseRemove on a pretend clip.
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const jsx = (f) => fs.readFileSync(path.join(__dirname, '../../extension/jsx', f), 'utf8');
function prop(v) {
  return { v, keys: [], tv: false, getValue() { return this.v; }, setValue(x) { this.v = x; }, isTimeVarying() { return this.tv; },
    setTimeVarying(b) { this.tv = b; if (!b) this.keys = []; }, addKey(t) { this.keys.push({ t: t.seconds }); },
    setValueAtKey(t, v) { this.keys.find((k) => Math.abs(k.t - t.seconds) < 1e-9).v = v; },
    getKeys() { return this.keys.map((k) => ({ seconds: k.t })); }, getValueAtKey(t) { return this.keys.find((k) => Math.abs(k.t - t.seconds) < 1e-9).v; } };
}
const scale = prop(110);
const comps = [{ matchName: 'AE.ADBE Motion', displayName: 'Motion', properties: [prop([0.5, 0.5]), scale] }]; comps.numItems = 1;
const clip = { mediaType: 'Video', components: comps, start: { seconds: 4 }, end: { seconds: 6 }, inPoint: { seconds: 1 } };
const sequence = { getSelection: () => [clip] };
const ctx = { BridgeTalk: { appName: 'premierepro' }, Time: function () { this.seconds = 0; }, app: { version: '26', project: { activeSequence: sequence } } };
vm.createContext(ctx);
vm.runInContext(jsx('host.jsx'), ctx);
vm.runInContext(jsx('premiere.jsx'), ctx);
const run = (t, a) => JSON.parse(ctx.EW.run(t, JSON.stringify(a || {})));

let r = run('pr.pulse', { times: [3.5, 4, 4.5, 5, 5.9], amount: 10, length: 0.2 });
assert.ok(r.ok, r.msg);
assert.strictEqual(scale.keys.length, 9, 'three bumps inside the clip (3.5 is before it, 5.9 runs past its end)');
assert.strictEqual(scale.keys[0].t, 1, 'the first bump starts at the clip in point');
assert.strictEqual(scale.keys[1].v, 121, 'peak is the clip scale +10%');
r = run('pr.pulse', { times: [4.5], amount: 5, length: 0.2 });
assert.strictEqual(scale.keys[1].v, 115.5, 'pulsing again builds on the clip scale, not the old peak');
r = run('pr.pulseRemove');
assert.ok(r.ok && !scale.tv && scale.v === 110, 'remove puts the clip scale back');
console.log('pulse ok');
