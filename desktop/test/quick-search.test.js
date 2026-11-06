// Quick search (⌥Space): ranking, tabs, what you used lately, where the window goes, and its setting.
// © 2026 Imtayz Nayem
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const QS = require('../src/quick-search');
const TC = require('../src/tool-catalog');
const { tools } = require('../src/tools');
const { Config, defaults, fromBackup } = require('../src/config');

// HaloCut's own tools and Premiere's commands, plus a few of Premiere's effects as the catalog lists them
const fx = (name, group = 'effects') => ({ id: `custom.PPRO.${group === 'audio' ? 'afx' : group === 'transitions' ? 'tr' : 'fx'}:${name}`, label: name, hint: '', group, icon: 'fx', def: { kind: 'bridge', app: 'PPRO', tool: group === 'transitions' ? 'pr.transition' : 'pr.effect', args: { name, kind: group === 'audio' ? 'audio' : 'video' } } });
const items = TC.build({ tools, app: 'PPRO' }).concat([fx('Gaussian Blur'), fx('Directional Blur'), fx('Camera Blur'), fx('Lumetri Color'),
  fx('Push', 'transitions'), fx('Iris Round', 'transitions'), fx('DeNoise', 'audio')]);
const labels = (list) => list.map((i) => i.label);

// typed: every word, names starting with it first
let r = QS.rank(items, 'blur');
assert.ok(labels(r).includes('Gaussian Blur') && labels(r).includes('Directional Blur'));
assert.strictEqual(QS.rank(items, 'gau')[0].label, 'Gaussian Blur');
assert.strictEqual(QS.rank(items, 'cross')[0].id, 'pr.tr.cross', "HaloCut's own Cross Dissolve");
assert.deepStrictEqual(QS.rank(items, 'dip black').map((i) => i.id), ['pr.tr.dipBlack']);
assert.deepStrictEqual(labels(QS.rank(items, 'iris round')), ['Iris Round']);
assert.strictEqual(QS.rank(items, 'zzzz').length, 0);

// a tab keeps to its groups
r = QS.rank(items, 'blur', { tab: 'transitions' });
assert.strictEqual(r.length, 0, 'no blur among transitions');
r = QS.rank(items, '', { tab: 'audio' });
assert.deepStrictEqual(labels(r), ['DeNoise']);
assert.ok(QS.rank(items, 'speed', { tab: 'premiere' }).every((i) => i.group === 'prtools' || i.group === 'prcommands'));
assert.ok(QS.rank(items, '', { tab: 'halocut' }).some((i) => i.id === 'pr.adjust'), 'HaloCut tools, the new wheel ones too');

// what you used lately: first when nothing is typed, and first among equally good matches
const recent = QS.addRecent(QS.addRecent([], 'custom.PPRO.fx:Gaussian Blur'), 'custom.PPRO.fx:Camera Blur');
assert.deepStrictEqual(recent, ['custom.PPRO.fx:Camera Blur', 'custom.PPRO.fx:Gaussian Blur']);
assert.deepStrictEqual(labels(QS.rank(items, '', { recent }).slice(0, 2)), ['Camera Blur', 'Gaussian Blur']);
r = QS.rank(items, 'blur', { recent });
assert.ok(labels(r).indexOf('Camera Blur') < labels(r).indexOf('Directional Blur'), 'used lately goes first');
let many = [];
for (let i = 0; i < 30; i++) many = QS.addRecent(many, 'id' + i);
assert.strictEqual(many.length, QS.MAX_RECENT); assert.strictEqual(many[0], 'id29');
assert.deepStrictEqual(QS.addRecent(['a', 'b', 'c'], 'c'), ['c', 'a', 'b'], 'no doubles');
assert.ok(QS.rank(items, '').length <= 80, 'a short list when nothing is typed');

// tabs only for what there is (After Effects has no effect list)
assert.deepStrictEqual(QS.tabsFor(TC.build({ tools, app: 'AEFT' })).map((t) => t.id), ['all', 'halocut']);
assert.deepStrictEqual(QS.tabsFor(items).map((t) => t.id), ['all', 'effects', 'transitions', 'audio', 'premiere', 'halocut']);

// the window sits across the middle of the screen with the pointer, a little high
assert.deepStrictEqual(QS.place({ x: 1920, y: 0, width: 2560, height: 1440 }, { width: 640, height: 470 }), { x: 2880, y: 288, width: 640, height: 470 });
assert.deepStrictEqual(Object.keys(QS.slim(items[0])).sort(), ['group', 'hint', 'icon', 'id', 'label', 'tint']);

// HaloCut's own effect shortcuts are listed as effects, its own tools stay HaloCut
const asListed = (id) => QS.slim(items.find((i) => i.id === id), tools[id]).group;
assert.strictEqual(asListed('pr.fx.blur'), 'effects');
assert.strictEqual(asListed('pr.adjust'), 'halocut');
assert.strictEqual(QS.slim(fx('DeNoise', 'audio')).group, 'audio');
assert.strictEqual(QS.groupOf({ group: 'halocut' }, { tool: 'pr.effect', args: { name: 'DeNoise', kind: 'audio' } }), 'audio');
assert.strictEqual(QS.groupOf({ group: 'halocut' }, { tool: 'pr.transition', args: {} }), 'transitions');
const shown = items.map((i) => QS.slim(i, i.def || tools[i.id]));
assert.ok(QS.rank(shown, 'gaussian', { tab: 'effects' }).length === 2, "Premiere's Gaussian Blur and HaloCut's, both under Effects (the real catalog drops the double)");

// ⌥Space out of the box, kept from a settings file that predates it, and from a backup
assert.deepStrictEqual(defaults().search.triggers[0], QS.DEFAULT_TRIGGER);
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'halocut-search-'));
fs.writeFileSync(path.join(dir, 'config.json'), JSON.stringify({ wheel: { triggers: [null, null] } }));
assert.deepStrictEqual(new Config(dir).data.search, defaults().search);
fs.writeFileSync(path.join(dir, 'config.json'), JSON.stringify({ search: { recent: ['x'] } }));
const c = new Config(dir).data.search;
assert.ok(c.recent[0] === 'x' && c.triggers[0].name === 'Space', 'recent kept, trigger filled in');
assert.deepStrictEqual(fromBackup(JSON.stringify({ wheel: {} })).search, defaults().search);

// the window can talk to the app
const preload = fs.readFileSync(path.join(__dirname, '../src/preload.js'), 'utf8');
assert.ok(/'search:open'/.test(preload) && /startsWith\('search:'\)/.test(preload));

console.log('quick search ok ·', items.length, 'things to search in Premiere');
