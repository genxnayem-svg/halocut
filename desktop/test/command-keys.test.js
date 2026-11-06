// HaloCut Command shortcuts anywhere in Premiere Pro: the panel's file → the helper's triggers → Premiere steps.
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const K = require('../src/command-keys');
const C = require('../../extension/client/command-core');

// every key the panel can save becomes a trigger with a name the input helper knows
const known = new Set([...fs.readFileSync(path.join(__dirname, '../src/input.js'), 'utf8').matchAll(/\d+: '([A-Za-z0-9]+)'/g)].map((m) => m[1]));
const ev = (code, o = {}) => Object.assign({ code, metaKey: false, ctrlKey: false, altKey: false, shiftKey: false }, o);
const codes = [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'].map((c) => 'Key' + c).concat([...'0123456789'].map((d) => 'Digit' + d),
  Array.from({ length: 12 }, (_, i) => 'F' + (i + 1)), ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Backslash', 'Slash', 'Comma', 'Period', 'Semicolon', 'Quote', 'BracketLeft', 'BracketRight', 'Minus', 'Equal', 'Backquote']);
for (const code of codes) {
  const keys = C.keyOf(ev(code, { metaKey: true, shiftKey: true }), true);
  const t = K.toTrigger(keys);
  assert.ok(t && known.has(t.name), `${code} → ${keys} → ${t && t.name}`);
  assert.deepStrictEqual(t.mods, ['shift', 'cmd']);
}
assert.deepStrictEqual(K.toTrigger('ctrl+alt+shift+mod+left'), { kind: 'key', name: 'ArrowLeft', mods: ['ctrl', 'alt', 'shift', 'cmd'], delayMs: 0 });
assert.deepStrictEqual(K.toTrigger('f5'), { kind: 'key', name: 'F5', mods: [], delayMs: 0 });
assert.strictEqual(K.toTrigger('alt+3').name, '3');
assert.strictEqual(K.toTrigger('hyper+b'), null, 'unknown modifier');
assert.strictEqual(K.toTrigger('mod+'), null);

// the file: what the panel writes for a real command list
const src = { effects: { video: ['Crop'], audio: [], transitions: ['Cross Dissolve'] }, toolbar: require('../../extension/client/toolbar-core'),
  grade: require('../../extension/client/grade-core'), motion: require('../../extension/client/motion-core'), trans: require('../../extension/client/trans-core'),
  combos: [{ id: 'c1', name: 'Punch and flash', steps: ['tool:punchIn', 'cut:flash'] }] };
const items = C.build(src), byId = (id) => items.find((i) => i.id === id), ctx = { grade: src.grade, motion: src.motion, trans: src.trans, fps: 25, byId };
const entry = (id) => ({ id, name: byId(id).name, steps: C.steps(byId(id), ctx) });
const file = { app: 'PPRO', version: 2, shortcuts: {
  'shift+mod+b': entry('fx:Crop'), 'alt+1': entry('combo:c1'), 'f5': entry('grade:warm'),
  'mod+x+y': entry('fx:Crop'), 'alt+2': { id: 'old', name: 'Old', run: { panel: 'command' } }, 'alt+3': { id: 'bad', steps: [{ tool: 'app.quit' }] },
} };
const list = K.parse(JSON.parse(JSON.stringify(file)));
assert.deepStrictEqual(list.map((s) => s.keys), ['shift+mod+b', 'alt+1', 'f5'], 'malformed, old-style and non-Premiere entries are left out');
assert.strictEqual(K.parse({ app: 'AEFT', shortcuts: file.shortcuts }).length, 0);
assert.strictEqual(K.parse(null).length, 0);

// matching a key press from the helper (its mods can come in any order)
assert.strictEqual(K.find(list, { kind: 'key', name: 'B', mods: ['cmd', 'shift'] }).id, 'fx:Crop');
assert.strictEqual(K.find(list, { kind: 'key', name: 'B', mods: ['cmd'] }), null, 'needs the same modifiers');
assert.strictEqual(K.find(list, { kind: 'key', name: '1', mods: ['alt'] }).id, 'combo:c1');
assert.strictEqual(K.find(list, { kind: 'mouse', name: 'middle', mods: [] }), null);

(async () => {
  // running: one step → its own message; a combo → every step in order, stopping at the first that fails
  const calls = [];
  const ok = async (tool, args, name) => { calls.push(tool); return { ok: true, msg: name + ' done' }; };
  let r = await K.runSteps(K.find(list, { kind: 'key', name: 'B', mods: ['shift', 'cmd'] }), ok);
  assert.deepStrictEqual(r, { ok: true, msg: 'Crop done' });
  assert.deepStrictEqual(calls, ['pr.effect']);
  calls.length = 0;
  r = await K.runSteps(K.find(list, { kind: 'key', name: '1', mods: ['alt'] }), ok);
  assert.deepStrictEqual(calls, ['pr.punchIn', 'pr.transApply']); assert.strictEqual(r.msg, 'Ran 2 steps');
  calls.length = 0;
  r = await K.runSteps(list[1], async (tool) => { calls.push(tool); return { ok: false, msg: 'Select a clip' }; });
  assert.deepStrictEqual(calls, ['pr.punchIn'], 'stopped after the first');
  assert.ok(!r.ok && /^Step 1 \(.+\): Select a clip$/.test(r.msg), r.msg);
  const g = list.find((s) => s.keys === 'f5').steps[0];
  assert.strictEqual(g.tool, 'pr.gradeLook'); assert.deepStrictEqual(g.args.values, src.grade.look('warm'));

  // the app picks up the file when the panel saves it, and when it first appears
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'halocut-keys-')), f = path.join(dir, 'command-shortcuts.json');
  const seen = [];
  const stop = K.watch((l) => seen.push(l.length), f);
  assert.deepStrictEqual(seen, [0], 'no file yet: no shortcuts');
  fs.writeFileSync(f, JSON.stringify(file));
  for (let i = 0; i < 40 && seen.length < 2; i++) await new Promise((res) => setTimeout(res, 100));
  stop();
  fs.rmSync(dir, { recursive: true });
  assert.deepStrictEqual(seen, [0, 3], 'reloaded after the save');
  console.log('command keys ok ·', list.length, 'shortcuts from the file');
})().catch((e) => { console.error(e); process.exit(1); });
