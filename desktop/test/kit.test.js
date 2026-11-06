// HaloCut Kit: every rig's expression runs in a stand-in for AE's expression engine and does what it says,
// and the layer maths (rename, stagger, sequence, align, tidy) lands where it should.
const assert = require('node:assert');
const K = require('../../extension/client/kit-core');

// a small stand-in for the expression language: value, time, controls by name, vector maths, a few AE functions
function evaluate(rig, opts) {
  const j = K.job(rig, opts.controls);
  const ctl = {}; j.controls.forEach((c) => { ctl[c.name] = c.value; });
  const vec = (f) => (a, b) => (Array.isArray(a) ? a.map((v, i) => f(v, Array.isArray(b) ? b[i] : b)) : f(a, b));
  const keys = opts.keys || [];
  const env = {
    value: opts.value, time: opts.time, inPoint: opts.inPoint || 0, outPoint: opts.outPoint || 10, index: opts.index || 1,
    thisComp: { frameDuration: 1 / 25, layer: (i) => opts.layers[i] }, thisLayer: {}, anchorPoint: [0, 0], toComp: (p) => opts.at || [0, 0],
    effect: (name) => { assert.ok(name in ctl, 'a control called ' + name); return () => (opts.layerControl && /Target/.test(name) ? opts.layerControl : ctl[name]); },
    add: vec((a, b) => a + b), sub: vec((a, b) => a - b), mul: vec((a, b) => a * b),
    wiggle: (f, a) => (Array.isArray(opts.value) ? opts.value.map((v) => v + a / 2) : opts.value + a / 2),
    loopOut: (type) => 'loop:' + type, posterizeTime: () => {}, linear: (t, a, b, x, y) => (t <= a ? x : t >= b ? y : x + (y - x) * (t - a) / (b - a)),
    ease: (t, a, b, x, y) => { const p = Math.max(0, Math.min(1, (t - a) / (b - a))); return x + (y - x) * (0.5 - Math.cos(p * Math.PI) / 2); },
    radiansToDegrees: (r) => (r * 180) / Math.PI, numKeys: keys.length, key: (i) => keys[i - 1],
    nearestKey: (t) => { let best = 1; keys.forEach((k, i) => { if (Math.abs(k.time - t) < Math.abs(keys[best - 1].time - t)) best = i + 1; }); return { index: best }; },
    velocityAtTime: () => opts.velocity || [0, 0], Math,
  };
  const expr = j.expr;
  assert.strictEqual(K.rigOf(expr), rig, 'tagged so it can be found again');
  // eslint-disable-next-line no-new-func
  return new Function('env', 'with (env) { return eval(' + JSON.stringify(expr) + '); }')(env);
}
const near = (a, b, e = 1e-6) => (Array.isArray(a) ? a.every((v, i) => Math.abs(v - b[i]) < e) : Math.abs(a - b) < e);

assert.ok(near(evaluate('wiggle', { value: [100, 100], time: 1 }), [115, 115]));
assert.ok(near(evaluate('jitter', { value: 50, time: 1, controls: { a: 10 } }), 55));
assert.ok(near(evaluate('float', { value: [100, 100, 0], time: 0 }), [100, 100, 0]), '3D stays 3D');
assert.ok(near(evaluate('orbit', { value: [100, 100], time: 0 }), [180, 100]), 'starts a radius to the right');
assert.strictEqual(evaluate('cycle', { value: 1, time: 1 }), 'loop:cycle');
assert.strictEqual(evaluate('pingpong', { value: 1, time: 1 }), 'loop:pingpong');
const leader = { transform: { position: { valueAtTime: (t) => [t * 100, 0] } } };
assert.ok(near(evaluate('follow', { value: [50, 50], time: 2, index: 2, layers: { 1: leader }, controls: { d: 5 } }), [230, 50]), 'five frames behind, its own offset kept');
assert.ok(near(evaluate('lookat', { value: 0, time: 1, layerControl: { toComp: () => [0, 100], anchorPoint: [0, 0] } }), 90));
assert.strictEqual(evaluate('lookat', { value: 7, time: 1, layerControl: null }), 7, 'no target: left as it is');
const after = evaluate('bounce', { value: [10, 10], time: 1.1, keys: [{ time: 0 }, { time: 1 }], velocity: [100, 0] });
assert.ok(after[0] !== 10 && near([after[1]], [10]), 'bounces along its last movement');
assert.ok(near(evaluate('bounce', { value: [10, 10], time: 0.5, keys: [{ time: 0 }, { time: 1 }] }), [10, 10]), 'still between keys');
assert.strictEqual(evaluate('spin', { value: 10, time: 2 }), 190);
assert.ok(near(evaluate('pendulum', { value: 0, time: 0.25, controls: { d: 0 } }), 25), 'a quarter swing is the full angle');
assert.ok(near(evaluate('pulse', { value: [100, 100], time: 0.125 }), [108, 108]));
const sq = evaluate('squash', { value: [100, 100], time: 1 / 12 });
assert.ok(sq[0] > 100 && sq[1] < 100, 'wide while short');
assert.strictEqual(evaluate('blink', { value: 100, time: 0.1 }), 100); assert.strictEqual(evaluate('blink', { value: 100, time: 0.3 }), 0);
assert.strictEqual(evaluate('fade', { value: 100, time: 0.25 }), 50); assert.strictEqual(evaluate('fade', { value: 100, time: 5 }), 100);
assert.strictEqual(evaluate('counter', { value: '', time: 5 }), '1,000');
assert.strictEqual(evaluate('counter', { value: '', time: 1, controls: { b: 12345.678, d: 1 } }), '6,172.8');
assert.strictEqual(evaluate('typewriter', { value: 'Hello world', time: 0.3, controls: { c: 0 } }), 'Hello');
assert.strictEqual(evaluate('clock', { value: '', time: 75 }), '01:15');
assert.strictEqual(evaluate('clock', { value: '', time: 3, controls: { s: 10, d: 1 } }), '00:07');
assert.strictEqual(evaluate('hold', { value: 4, time: 1 }), 4);
assert.ok(K.RIGS.every((r) => K.GROUPS.includes(r.group)) && new Set(K.RIGS.map((r) => r.id)).size === K.RIGS.length);
assert.strictEqual(K.job('wiggle', { f: 5 }).controls[0].value, 5);
assert.strictEqual(K.job('wiggle').controls[0].effect, 'ADBE Slider Control');

// rename, stagger, sequence
assert.deepStrictEqual(K.renamed(['a', 'b', 'c'], { pattern: 'Shot {n} {name}', pad: 2 }), ['Shot 01 a', 'Shot 02 b', 'Shot 03 c']);
assert.deepStrictEqual(K.renamed(['Layer 1 copy', 'Layer 2 copy'], { find: ' copy' }), ['Layer 1', 'Layer 2']);
assert.deepStrictEqual(K.timing([{ inPoint: 1, outPoint: 3 }, { inPoint: 0, outPoint: 4 }, { inPoint: 0, outPoint: 1 }], { step: 0.2 }).map((t) => +t.toFixed(3)), [1, 1.2, 1.4]);
assert.deepStrictEqual(K.timing([{ inPoint: 1, outPoint: 3 }, { inPoint: 0, outPoint: 4 }, { inPoint: 0, outPoint: 1 }], { mode: 'sequence', overlap: 0.5 }), [1, 2.5, 6]);
// align and distribute
const boxes = [{ x: 0, y: 0, w: 10, h: 10 }, { x: 50, y: 20, w: 20, h: 10 }, { x: 200, y: 5, w: 10, h: 30 }];
assert.deepStrictEqual(K.align(boxes, 'left'), [[0, 0], [-50, 0], [-200, 0]]);
assert.deepStrictEqual(K.align(boxes, 'vcenter', { x: 0, y: 0, w: 1920, h: 1080 }).map((m) => m[1]), [535, 515, 520]);
assert.deepStrictEqual(K.align(boxes, 'distH').map((m) => m[0]), [0, 45, 0], 'the middle one moves to halfway');
assert.deepStrictEqual(['comp', 'solid', 'x.PNG', 'a.wav', 'b.mov'].map((k, i) => K.folderFor(i < 2 ? { kind: k } : { kind: 'footage', file: k })), ['Comps', 'Solids', 'Images', 'Audio', 'Footage']);
console.log('kit ok ·', K.RIGS.length, 'rigs');
