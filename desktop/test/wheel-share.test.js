const assert = require('assert');
const W = require('../src/wheel-share');
const builtIn = { 'pr.cut': {}, 'pr.rippleDelete': {} };
const key = { label: 'Nest', kind: 'keys', keys: 'mod+shift+n', app: 'PPRO' };
const layout = { name: 'Mine', segments: [{ name: 'Edit', icon: 'scissors', color: '#ff7a45', main: 'pr.cut', tools: ['pr.cut', 'custom.PPRO.key:mod+shift+n'] }] };
const text = W.toFile(layout, { 'custom.PPRO.key:mod+shift+n': key, 'custom.PPRO.key:x': { label: 'unused', kind: 'keys', keys: 'x' } }, 'PPRO', 'Premiere Pro', '0.2.0');
const f = JSON.parse(text);
assert.deepStrictEqual(Object.keys(f.tools), ['custom.PPRO.key:mod+shift+n']);
let r = W.fromFile(text, 'PPRO', builtIn, {});
assert.ok(r.ok); assert.deepStrictEqual(r.layout.segments[0].tools, layout.segments[0].tools);
assert.deepStrictEqual(r.customTools['custom.PPRO.key:mod+shift+n'], key);
assert.strictEqual(W.fromFile(text, 'AEFT', builtIn, {}).ok, false);
assert.strictEqual(W.fromFile('nope', 'PPRO', builtIn, {}).ok, false);
assert.strictEqual(W.fromFile(JSON.stringify({ app: 'HaloCut', kind: 'settings', settings: {} }), 'PPRO', builtIn, {}).ok, false);
// an unknown tool and a bad definition are left out; the rest loads
const bad = JSON.parse(text);
bad.layout.segments[0].tools.push('pr.gone', 'custom.PPRO.evil');
bad.tools['custom.PPRO.evil'] = { label: 'x', kind: 'bridge', tool: 'system.exec', app: 'PPRO' };
r = W.fromFile(JSON.stringify(bad), 'PPRO', builtIn, {});
assert.ok(r.ok); assert.strictEqual(r.layout.segments[0].tools.length, 2); assert.ok(/2 left out/.test(r.msg));
// a tool you already have is kept as yours
r = W.fromFile(text, 'PPRO', builtIn, { 'custom.PPRO.key:mod+shift+n': { label: 'Mine' } });
assert.deepStrictEqual(r.customTools, {});
console.log('wheel share ok');
