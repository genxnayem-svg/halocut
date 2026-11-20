// Several Tool wheel layouts per app: listing, the one used last, stepping by scroll, adding, renaming, deleting,
// and that settings from before get the Classic Premiere layout. © 2026 Imtayz Nayem
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const LS = require('../src/layout-sets');
const TC = require('../src/tool-catalog');
const W = require('../src/app-wheels');
const { Config, defaults } = require('../src/config');
const { tools, layouts, extraLayouts } = require('../src/tools');

const d = defaults();
// out of the box: Premiere has two (the new wheel, then Classic), After Effects one
assert.deepStrictEqual(LS.list(d, 'PPRO').map(LS.shortName), ['Default', 'Classic']);
assert.deepStrictEqual(extraLayouts.PPRO[0].segments.map((s) => s.name), ['Frame', 'Transform', 'Markers', 'Labels', 'Playback']);
for (const s of extraLayouts.PPRO[0].segments) for (const id of s.tools) assert.ok(tools[id], id);
assert.strictEqual(LS.list(d, 'AEFT').length, 1);
assert.deepStrictEqual(LS.list(d, 'nope'), []);
assert.strictEqual(LS.active(d, 'PPRO'), 0);
assert.strictEqual(LS.active({ ...d, activeLayout: { PPRO: 1 } }, 'PPRO'), 1);
assert.strictEqual(LS.active({ ...d, activeLayout: { PPRO: 9 } }, 'PPRO'), 0, 'a layout that is gone: the first');

// scrolling goes round; one layout never moves
assert.deepStrictEqual([LS.step(3, 0, 1), LS.step(3, 2, 1), LS.step(3, 0, -1), LS.step(1, 0, 1)], [1, 0, 2, 0]);

// a new layout is a copy to change, and editing one leaves the others alone
let r = LS.add(d, 'PPRO', 0);
assert.ok(r.ok && r.index === 2 && /Layout 3/.test(r.msg), r.msg);
let c = { ...d, ...r.patch };
assert.deepStrictEqual(LS.list(c, 'PPRO')[2].segments, d.layouts.PPRO.segments);
assert.notStrictEqual(LS.list(c, 'PPRO')[2].segments, d.layouts.PPRO.segments);
const edited = TC.removeSegment(LS.list(c, 'PPRO')[2], 0).layout;
c = { ...c, ...LS.set(c, 'PPRO', 2, edited) };
assert.strictEqual(LS.list(c, 'PPRO')[2].segments.length, d.layouts.PPRO.segments.length - 1);
assert.deepStrictEqual(c.layouts.PPRO, d.layouts.PPRO, 'the first layout is untouched');
c = { ...c, ...LS.set(c, 'PPRO', 0, { ...c.layouts.PPRO, name: 'Mine' }) };
assert.strictEqual(c.layouts.PPRO.name, 'Mine');
r = LS.rename(c, 'PPRO', 2, '  Colour work  ');
c = { ...c, ...r.patch };
assert.strictEqual(LS.shortName(LS.list(c, 'PPRO')[2]), 'Colour work');
assert.ok(!LS.rename(c, 'PPRO', 2, '   ').ok);
let full = c;
while (LS.list(full, 'PPRO').length < LS.MAX_LAYOUTS) full = { ...full, ...LS.add(full, 'PPRO', 0).patch };
assert.ok(!LS.add(full, 'PPRO', 0).ok, 'a limit');
assert.strictEqual(new Set(LS.list(full, 'PPRO').map((l) => l.name)).size, LS.MAX_LAYOUTS, 'names never repeat');

// deleting: not the first; the wheel falls back sensibly
assert.ok(!LS.remove(c, 'PPRO', 0).ok);
c = { ...c, activeLayout: { PPRO: 2 } };
r = LS.remove(c, 'PPRO', 1);
c = { ...c, ...r.patch };
assert.ok(r.ok && LS.list(c, 'PPRO').length === 2 && c.activeLayout.PPRO === 1, 'the one after moves up');
r = LS.remove(c, 'PPRO', 1);
c = { ...c, ...r.patch };
assert.ok(LS.list(c, 'PPRO').length === 1 && c.activeLayout.PPRO === 0);

// a shortcut tool used only on a second layout is kept
const custom = { 'custom.PPRO.key:mod+j': { label: 'J', kind: 'keys', keys: 'mod+j', app: 'PPRO' } };
const withTool = { ...d, extraLayouts: { PPRO: [{ name: 'X', segments: [{ name: 'S', main: 'custom.PPRO.key:mod+j', tools: ['custom.PPRO.key:mod+j'] }] }] } };
assert.deepStrictEqual(TC.prune(custom, withTool), custom);
assert.deepStrictEqual(TC.prune(custom, d), {});

// settings from before this: Classic arrives; your own extra layouts, or none, are kept as saved
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'halocut-layouts-'));
fs.writeFileSync(path.join(dir, 'config.json'), JSON.stringify({ layouts }));
assert.deepStrictEqual(LS.list(new Config(dir).data, 'PPRO').map(LS.shortName), ['Default', 'Classic']);
fs.writeFileSync(path.join(dir, 'config.json'), JSON.stringify({ layouts, extraLayouts: { PPRO: [] } }));
assert.strictEqual(LS.list(new Config(dir).data, 'PPRO').length, 1, 'deleted stays deleted');

// removing an added app takes its other layouts too
let a = W.add(d, { bundleId: 'x.y', name: 'X', path: '/x' });
let withApp = { ...d, ...a.patch };
withApp = { ...withApp, ...LS.add(withApp, a.id, 0).patch, activeLayout: { [a.id]: 1 } };
const gone = { ...withApp, ...W.remove(withApp, a.id).patch };
assert.ok(!gone.extraLayouts[a.id] && gone.activeLayout[a.id] === undefined && gone.extraLayouts.PPRO.length === 1);

// the helper reports scrolling only while asked, and the wheel names the layout
const swift = fs.readFileSync(path.join(__dirname, '../helper/ew-input.swift'), 'utf8');
assert.ok(/case \.scrollWheel:\s*\n\s*\/\/[^\n]*\n\s*guard scrollOn/.test(swift) && /\.scrollWheel,\n\]/.test(swift));
assert.ok(/of \$\{L\.count\}/.test(fs.readFileSync(path.join(__dirname, '../renderer/wheel.js'), 'utf8')));
console.log('layout sets ok · Premiere:', LS.list(d, 'PPRO').map(LS.shortName).join(' + '));
