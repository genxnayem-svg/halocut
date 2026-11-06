// Orbit switch: pinned apps keep their place (open or not), hidden apps never show, names fit a slice,
// and a lit slice never covers a neighbour's name.
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { AppsHelper, choose, shortName, MAX_APPS } = require('../src/apps');
const { defaults } = require('../src/config');

const app = (name, bundleId, o = {}) => ({ pid: o.pid || name.length * 100, name, bundleId, path: `/Applications/${name}.app`, front: !!o.front, windows: o.windows || [] });
// most recently used first, as the helper lists them; TextEdit is in front
const running = [app('TextEdit', 'com.apple.TextEdit', { front: true }), app('Adobe Premiere Pro 2026', 'com.adobe.PremierePro.26', { windows: [{ title: 'Teaser' }] }),
  app('Google Chrome', 'com.google.Chrome'), app('Clean Me', 'com.clean.me'), app('Finder', 'com.apple.finder', { windows: [{ title: 'a' }, { title: 'b' }] })];
const ids = (list) => list.map((c) => (c.app || c.pin).bundleId);

// nothing set: every open app, the one in front last (as before)
assert.deepStrictEqual(ids(choose(running)), ['com.adobe.PremierePro.26', 'com.google.Chrome', 'com.clean.me', 'com.apple.finder', 'com.apple.TextEdit']);
// pinned first in their own order, open or not; hidden never; the rest after
const prefs = { pinned: [{ bundleId: 'com.apple.finder', name: 'Finder', path: '/System/Library/CoreServices/Finder.app' }, { bundleId: 'com.apple.Notes', name: 'Notes', path: '/System/Applications/Notes.app' }, { bundleId: 'com.apple.finder', name: 'Finder twice' }],
  hidden: [{ bundleId: 'com.clean.me', name: 'Clean Me' }, 'com.nothing'] };
let c = choose(running, prefs);
assert.deepStrictEqual(ids(c), ['com.apple.finder', 'com.apple.Notes', 'com.adobe.PremierePro.26', 'com.google.Chrome', 'com.apple.TextEdit']);
assert.ok(c[0].app && c[0].pinned && c[1].pin && c[1].pinned && !c[2].pinned, 'Finder is open, Notes is not');
assert.deepStrictEqual(ids(choose(running, { ...prefs, showOthers: false })), ['com.apple.finder', 'com.apple.Notes'], 'only pinned apps');
assert.ok(!ids(choose(running, { hidden: ['com.apple.TextEdit'] })).includes('com.apple.TextEdit'), 'hidden as a plain id too');
const many = Array.from({ length: 20 }, (_, i) => app('App ' + i, 'id.' + i));
assert.strictEqual(choose(many).length, MAX_APPS);

// names that fit
assert.deepStrictEqual(['Adobe Premiere Pro 2026', 'Google Chrome', 'Microsoft Word', 'Adobe After Effects 2026', 'TextEdit', 'Adobe'].map(shortName),
  ['Premiere Pro', 'Chrome', 'Word', 'After Effects', 'TextEdit', 'Adobe']);

(async () => {
  // the layout the wheel gets
  const h = new AppsHelper('/nowhere');
  const sent = [];
  h.request = async (cmd, extra) => { sent.push([cmd, extra]); return cmd === 'list' ? { apps: running, trusted: true } : { ok: true }; };
  h.icon = async (p) => `data:image/png;base64,${Buffer.from(p).toString('base64')}`;
  const L = await h.layout(prefs);
  const seg = (b) => L.segments.find((s) => s.bundleId === b);
  assert.deepStrictEqual(L.segments.map((s) => s.name), ['Finder', 'Notes', 'Premiere Pro', 'Chrome', 'TextEdit']);
  assert.deepStrictEqual(seg('com.apple.Notes').main, { id: 'launch:/System/Applications/Notes.app', label: 'Notes', hint: 'Not open · let go to open it' });
  assert.ok(seg('com.apple.Notes').dim && seg('com.apple.Notes').tools.length === 0 && seg('com.apple.Notes').image);
  assert.strictEqual(seg('com.adobe.PremierePro.26').main.label, 'Adobe Premiere Pro 2026', 'the full name in the middle of the wheel');
  assert.strictEqual(seg('com.apple.finder').badge, 2);
  assert.strictEqual(seg('com.google.Chrome').main.hint, 'No windows open');
  assert.strictEqual(seg('com.apple.TextEdit').main.hint, 'Already in front');
  await h.switchTo('launch:/System/Applications/Notes.app');
  assert.deepStrictEqual(sent.at(-1), ['launch', { path: '/System/Applications/Notes.app' }], 'letting go on a closed app opens it');
  await h.switchTo('app:600');
  assert.deepStrictEqual(sent.at(-1), ['activate', { pid: 600 }]);

  // drawing: every slice first, then every name, so a lit slice can't hide a neighbour's name
  global.window = { WheelGeometry: require('../src/wheel-geometry') };
  eval(fs.readFileSync(path.join(__dirname, '../renderer/icons.js'), 'utf8'));
  eval(fs.readFileSync(path.join(__dirname, '../renderer/wheel-draw.js'), 'utf8'));
  const last = L.segments.length - 1;
  const svg = window.WheelDraw.render(L, { cx: 286, cy: 286, hover: { seg: last, tool: -1, openSeg: last } });
  const lastSlice = svg.lastIndexOf('<path'), firstName = svg.indexOf('class="seg-label"');
  assert.ok(firstName > lastSlice, 'names are drawn after all the slices');
  assert.ok(!/NaN|Infinity/.test(svg));
  const closed = window.WheelDraw.render(L, { cx: 286, cy: 286, hover: { seg: 1, tool: -1, openSeg: 1 } });
  assert.ok(!/NaN/.test(closed), 'resting on an app with no windows draws no broken arc');
  assert.ok(/opacity="\.45"/.test(svg), 'a pinned app that is closed is dimmed');

  // settings start empty and come back from a backup the same way
  assert.deepStrictEqual([defaults().orbit.pinned, defaults().orbit.hidden, defaults().orbit.showOthers], [[], [], true]);
  console.log('orbit ok ·', L.segments.length, 'apps:', L.segments.map((s) => s.name).join(', '));
})().catch((e) => { console.error(e); process.exit(1); });
