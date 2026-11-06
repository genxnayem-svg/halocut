// Runs the ExtendScript host + Premiere commands in Node against a tiny fake Premiere DOM.
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const jsx = (f) => fs.readFileSync(path.join(__dirname, '../../extension/jsx', f), 'utf8');

function prop(v) { return { v, getValue() { return this.v; }, setValue(x) { this.v = x; }, isTimeVarying: () => false }; }
function clip(name) {
  const motion = { matchName: 'AE.ADBE Motion', displayName: 'Motion', properties: [prop([0.3, 0.3]), prop(150), prop(100), prop(true), prop(10)] };
  const comps = [motion]; comps.numItems = 1;
  return { name, mediaType: 'Video', components: comps, start: { seconds: 0 }, end: { seconds: 5 }, disabled: false,
    projectItem: { getProjectMetadata: () => '<x:VideoInfo>3840 x 2160 (1.0)</x:VideoInfo>' } };
}
const c = clip('A');
const ctx = {
  BridgeTalk: { appName: 'premierepro' },
  app: { version: '26.0', project: { activeSequence: {
    frameSizeHorizontal: 1080, frameSizeVertical: 1920,
    getSelection: () => [c], getPlayerPosition: () => ({ seconds: 1 }),
  } } },
};
vm.createContext(ctx);
vm.runInContext(jsx('host.jsx'), ctx);
vm.runInContext(jsx('premiere.jsx'), ctx);
const run = (id, args) => JSON.parse(ctx.EW.run(id, JSON.stringify(args || {})));

assert.strictEqual(run('nope').ok, false);
assert.ok(run('pr.rotate', { degrees: 90 }).ok);
assert.strictEqual(c.components[0].properties[4].v, 100);
assert.ok(run('pr.fillFrame').ok);            // 3840x2160 into 1080x1920 -> cover = 1920/2160
assert.strictEqual(c.components[0].properties[1].v, 88.89);
assert.ok(run('pr.fitFrame').ok);             // contain = 1080/3840
assert.strictEqual(c.components[0].properties[1].v, 28.13);
assert.ok(run('pr.toggleEnable').ok && c.disabled === true);
assert.strictEqual(ctx.EW.stringify({ a: [1, 'x"y', null, true] }), '{"a":[1,"x\\"y",null,true]}');
console.log('host ok');
