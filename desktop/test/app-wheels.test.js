// Any app with its own Tool wheel, Options wheel and buttons: the starter wheels, adding and removing an app, and
// telling it apart while it is in front. © 2026 Imtayz Nayem
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const W = require('../src/app-wheels');
const TC = require('../src/tool-catalog');
const { tools } = require('../src/tools');
const { Config, defaults } = require('../src/config');
const { FrontApp, parseFront } = require('../src/input');

const RESOLVE = { bundleId: 'com.blackmagic-design.DaVinciResolve', name: 'DaVinci Resolve', path: '/Applications/DaVinci Resolve/DaVinci Resolve.app' };
const LRC = { bundleId: 'com.adobe.LightroomClassicCC7', name: 'Adobe Lightroom Classic', path: '/Applications/Adobe Lightroom Classic/Adobe Lightroom Classic.app' };
const CAPCUT = { bundleId: 'com.lemon.lvpro', name: 'CapCut', path: '/Applications/CapCut.app' };

// every pack: shortcuts HaloCut can press, no two commands on the same keys, a wheel that fits
for (const p of [...W.PACKS, W.BASICS]) {
  const keys = p.commands.map((c) => c[1]);
  assert.strictEqual(new Set(keys).size, keys.length, `${p.name || 'basics'}: two commands share keys`);
  p.commands.forEach(([name, k, icon]) => assert.ok(TC.cleanKeys(k) === k && icon, `${name}: ${k}`));
  assert.ok(p.wheel.length <= TC.MAX_SEGMENTS && p.wheel.every(([, , names]) => names.length && names.length <= TC.MAX_TOOLS));
}

// the starter wheels: every tool is a shortcut tool the app can run
for (const app of [RESOLVE, LRC, CAPCUT]) {
  const a = { ...app, id: W.idFor(app.bundleId) };
  const s = W.starter(a);
  for (const seg of s.layout.segments) {
    assert.ok(seg.tools.includes(seg.main));
    for (const id of seg.tools) {
      const t = s.customTools[id];
      assert.ok(t && t.kind === 'keys' && t.app === a.id && TC.cleanKeys(t.keys) === t.keys, `${app.name} ${id}`);
    }
  }
}
assert.deepStrictEqual(W.starter({ ...RESOLVE, id: W.idFor(RESOLVE.bundleId) }).layout.segments.map((s) => s.name), ['Edit', 'Marks', 'Timing', 'Pages', 'Color', 'Playback']);
assert.deepStrictEqual(W.starter({ ...LRC, id: W.idFor(LRC.bundleId) }).layout.segments.map((s) => s.name), ['Develop', 'Copy', 'Flags', 'Stars', 'View', 'File']);
assert.deepStrictEqual(W.starter({ ...CAPCUT, id: W.idFor(CAPCUT.bundleId) }).layout.segments.map((s) => s.name), ['Edit', 'File', 'View'], 'an app HaloCut does not know: the basics');

// adding: a tab, a Tool wheel, the Options wheel and buttons of "any app" to start from
const base = defaults();
base.options.wheels.other.rings[0][0] = { label: 'Mine', action: { type: 'keys', keys: 'mod+k' } };
let r = W.add(base, RESOLVE);
assert.ok(r.ok && r.patch && r.id === 'app.com.blackmagic-design.DaVinciResolve' && /its own shortcuts/.test(r.msg), r.msg);
const d1 = { ...base, ...r.patch };
assert.deepStrictEqual(d1.apps, [{ id: r.id, bundleId: RESOLVE.bundleId, name: 'DaVinci Resolve', path: RESOLVE.path }]);
assert.strictEqual(d1.layouts[r.id].name, 'DaVinci Resolve · Default');
assert.deepStrictEqual(d1.options.wheels[r.id], base.options.wheels.other);
assert.notStrictEqual(d1.options.wheels[r.id], base.options.wheels.other, 'a copy, not the same wheel');
assert.deepStrictEqual(d1.profiles[r.id], base.profiles.other);
assert.ok(d1.layouts.PPRO && d1.options.wheels.PPRO && d1.options.triggers, 'everything else stays');
assert.strictEqual(base.apps.length, 0, 'the settings passed in are never changed');
assert.ok(W.add(d1, RESOLVE).ok && W.add(d1, RESOLVE).patch === null, 'added already: nothing to do');
assert.ok(!W.add(d1, { bundleId: 'com.adobe.PremierePro.26', name: 'Adobe Premiere Pro 2026' }).ok, 'Premiere has its own tab');
assert.ok(!W.add(d1, { name: 'No id' }).ok);
r = W.add(d1, CAPCUT);
const d2 = { ...d1, ...r.patch };
assert.ok(/a basic wheel/.test(r.msg) && d2.apps.length === 2);
let full = d2;
for (let i = 0; full.apps.length < W.MAX_APPS; i++) full = { ...full, ...W.add(full, { bundleId: 'x.' + i, name: 'X' + i }).patch };
assert.ok(!W.add(full, LRC).ok, `up to ${W.MAX_APPS}`);

// removing takes everything that app had, and nothing else
const mineTool = { label: 'Mine', kind: 'keys', keys: 'mod+j', app: 'PPRO' };
const d3 = { ...d2, customTools: { ...d2.customTools, 'custom.PPRO.key:mod+j': mineTool } };
r = W.remove(d3, 'app.com.blackmagic-design.DaVinciResolve');
const d4 = { ...d3, ...r.patch };
assert.ok(r.ok && d4.apps.length === 1 && d4.apps[0].name === 'CapCut');
assert.ok(!d4.layouts['app.com.blackmagic-design.DaVinciResolve'] && !d4.options.wheels['app.com.blackmagic-design.DaVinciResolve'] && !d4.profiles['app.com.blackmagic-design.DaVinciResolve']);
assert.ok(!Object.values(d4.customTools).some((t) => t.app === 'app.com.blackmagic-design.DaVinciResolve'));
assert.deepStrictEqual(d4.customTools['custom.PPRO.key:mod+j'], mineTool);
assert.ok(d4.layouts['app.com.lemon.lvpro'] && d4.layouts.PPRO);
assert.ok(!W.remove(d4, 'PPRO').ok);

// in front: told apart by bundle id; Premiere and After Effects as before
assert.deepStrictEqual(parseFront('"DaVinci Resolve" ASN:0x0-0x1: (in front) \n    bundleID="com.blackmagic-design.DaVinciResolve"\n'), { name: 'DaVinci Resolve', bundleId: RESOLVE.bundleId });
assert.deepStrictEqual(parseFront('"LSDisplayName"="Finder"\n"CFBundleIdentifier"="com.apple.finder"'), { name: 'Finder', bundleId: 'com.apple.finder' });
const front = new FrontApp();
let changes = 0;
front.on('change', () => changes++);
front.setApps(d2.apps);
front.set('DaVinci Resolve', RESOLVE.bundleId);
assert.strictEqual(front.appId(), 'app.com.blackmagic-design.DaVinciResolve');
front.set('Adobe Lightroom Classic', LRC.bundleId);
assert.strictEqual(front.appId(), 'other', 'not added: the "any app" wheels');
front.set('Adobe Premiere Pro 2026', 'com.adobe.PremierePro.26');
assert.strictEqual(front.appId(), 'PPRO');
assert.ok(changes >= 4, 'a change for each app and for the new list');
assert.strictEqual(W.match(d2.apps, CAPCUT.bundleId), 'app.com.lemon.lvpro');
assert.strictEqual(W.match(d2.apps, ''), null);

// the picker for an added app: its own shortcuts as a group, plus HaloCut's keys for any app
const items = TC.build({ tools, app: W.idFor(RESOLVE.bundleId), pack: W.commandsFor(RESOLVE.bundleId) });
const own = items.filter((i) => i.group === 'appcommands');
assert.strictEqual(own.length, W.packFor(RESOLVE.bundleId).commands.length);
assert.ok(own.every((i) => i.def && i.def.app === 'app.com.blackmagic-design.DaVinciResolve'));
assert.ok(items.some((i) => i.id === 'key.undo') && !items.some((i) => i.id.startsWith('pr.')), 'no Premiere tools on DaVinci');
assert.ok(TC.GROUPS.some((g) => g.id === 'appcommands'));

// settings: none at first, and kept once added
assert.deepStrictEqual(defaults().apps, []);
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'halocut-apps-'));
fs.writeFileSync(path.join(dir, 'config.json'), JSON.stringify({ apps: d2.apps, layouts: d2.layouts }));
const c = new Config(dir).data;
assert.ok(c.apps.length === 2 && c.layouts['app.com.blackmagic-design.DaVinciResolve'] && c.layouts.PPRO);

console.log('app wheels ok ·', W.PACKS.map((p) => `${p.name} ${p.commands.length} shortcuts`).join(', '));
