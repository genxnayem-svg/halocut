// HaloCut Command: one list of everything, keyboard search, shortcuts that never clash, combos.
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const C = require('../../extension/client/command-core');
const src = {
  effects: { video: ['Gaussian Blur', 'Lumetri Color', 'Crop', 'Horizontal Flip'], audio: ['DeNoise', 'Parametric Equalizer'], transitions: ['Cross Dissolve', 'Dip to Black'] },
  toolbar: require('../../extension/client/toolbar-core'), grade: require('../../extension/client/grade-core'),
  motion: require('../../extension/client/motion-core'), trans: require('../../extension/client/trans-core'),
  combos: [{ id: 'c1', name: 'Punch and flash', steps: ['tool:punchIn', 'cut:flash'] }],
};
const items = C.build(src);
assert.strictEqual(new Set(items.map((i) => i.id)).size, items.length, 'ids are unique');
const byId = (id) => items.find((i) => i.id === id);
assert.deepStrictEqual(byId('fx:Gaussian Blur').run, { tool: 'pr.effect', args: { name: 'Gaussian Blur', kind: 'video' } });
assert.deepStrictEqual(byId('afx:DeNoise').run.args.kind, 'audio');
assert.strictEqual(byId('tr:Cross Dissolve').group, 'transitions');
assert.deepStrictEqual(byId('cut:zoomIn').run, { cut: 'zoomIn' });
assert.deepStrictEqual(byId('grade:warm').run, { grade: 'warm' });
assert.ok(byId('motion:rise') && byId('cmd:nudgeL1') && byId('combo:c1'));
assert.ok(!items.some((i) => i.id === 'tool:qc'), 'jobs that need their own panel stay in the Toolbar');
assert.deepStrictEqual(byId('tool:punchIn').run, { tool: 'pr.punchIn', args: { factor: 1.2 } });

// every command runs a tool that exists in Premiere
const jsx = fs.readFileSync(path.join(__dirname, '../../extension/jsx/premiere.jsx'), 'utf8');
for (const it of items) if (it.run.tool) assert.ok(jsx.includes(`T["${it.run.tool}"]`), it.id + ' → ' + it.run.tool);

// search
assert.strictEqual(C.search(items, 'gauss')[0].id, 'fx:Gaussian Blur');
assert.strictEqual(C.search(items, 'gblur')[0].id, 'fx:Gaussian Blur', 'letters in order');
assert.strictEqual(C.search(items, 'cross')[0].id, 'tr:Cross Dissolve');
assert.strictEqual(C.search(items, 'nudge left 5')[0].id, 'cmd:nudgeL5');
assert.ok(C.search(items, 'warm').some((i) => i.id === 'grade:warm'));
assert.ok(C.search(items, 'blur', 'transitions').every((i) => i.group === 'transitions'), 'a group narrows it');
const recent = C.remember(C.remember([], 'fx:Crop'), 'tr:Dip to Black');
assert.deepStrictEqual(C.search(items, '', 'all', recent).slice(0, 2).map((i) => i.id), ['tr:Dip to Black', 'fx:Crop'], 'recent first');
assert.strictEqual(C.search(items, 'zzzz').length, 0);

// shortcuts
const ev = (code, o = {}) => Object.assign({ code, metaKey: false, ctrlKey: false, altKey: false, shiftKey: false }, o);
assert.strictEqual(C.keyOf(ev('KeyB', { metaKey: true, shiftKey: true }), true), 'shift+mod+b');
assert.strictEqual(C.keyOf(ev('KeyB'), true), null, 'a plain letter is for typing');
assert.strictEqual(C.keyOf(ev('KeyB', { shiftKey: true }), true), null);
assert.strictEqual(C.keyOf(ev('F5'), true), 'f5');
assert.strictEqual(C.keyOf(ev('Digit3', { altKey: true }), true), 'alt+3');
assert.strictEqual(C.keyOf(ev('KeyB', { ctrlKey: true }), false), 'mod+b', 'Ctrl is the main key on Windows');
assert.strictEqual(C.label('shift+mod+b', true), '⇧⌘B'); assert.strictEqual(C.label('ctrl+alt+left', true), '⌃⌥←');
assert.strictEqual(C.label('shift+mod+b', false), 'Shift+Ctrl+B');
let m = C.assign({}, 'fx:Crop', 'alt+1').map;
const r2 = C.assign(m, 'tr:Cross Dissolve', 'alt+1');
assert.deepStrictEqual(r2.map, { 'alt+1': 'tr:Cross Dissolve' }); assert.strictEqual(r2.took, 'fx:Crop', 'it says what lost the key');
m = C.assign(r2.map, 'tr:Cross Dissolve', 'alt+2').map;
assert.deepStrictEqual(m, { 'alt+2': 'tr:Cross Dissolve' }, 'one key per command');
assert.strictEqual(C.keysFor(m, 'tr:Cross Dissolve'), 'alt+2');
assert.deepStrictEqual(C.interest({ 'shift+mod+b': 'x', 'f5': 'y' }), [{ keyCode: 11, ctrlKey: false, altKey: false, shiftKey: true, metaKey: true }, { keyCode: 96, ctrlKey: false, altKey: false, shiftKey: false, metaKey: false }]);

// combos
const combo = C.newCombo('Intro', ['motion:rise', 'fx:Gone Effect']);
assert.ok(combo.id && combo.steps.length === 2);
assert.deepStrictEqual(C.missing(combo, items), ['fx:Gone Effect']);
assert.strictEqual(C.remember(['a', 'b'], 'b')[0], 'b');
// every command becomes plain Premiere steps the HaloCut app can run for a shortcut anywhere in Premiere
const ctx = { grade: src.grade, motion: src.motion, trans: src.trans, fps: 30, byId };
for (const it of items) {
  const list = C.steps(it, ctx);
  assert.ok(list.length >= 1, it.id);
  for (const s of list) assert.ok(jsx.includes(`T["${s.tool}"]`) && s.args && s.name, it.id + ' → ' + s.tool);
  assert.doesNotThrow(() => JSON.stringify(list));
}
assert.deepStrictEqual(C.steps(byId('fx:Crop'), ctx), [{ tool: 'pr.effect', args: { name: 'Crop', kind: 'video' }, name: 'Crop' }]);
const g = C.steps(byId('grade:warm'), ctx)[0];
assert.strictEqual(g.tool, 'pr.gradeLook'); assert.deepStrictEqual(g.args.values, src.grade.look('warm'));
const cut = C.steps(byId('cut:flash'), ctx)[0];
assert.strictEqual(cut.tool, 'pr.transApply'); assert.deepStrictEqual(cut.args.plan, src.trans.plan('flash', { frames: 9, strength: 1, dir: 'left' }), '0.3 s at 30 fps');
assert.strictEqual(C.steps(byId('motion:rise'), ctx)[0].tool, 'pr.motionApply');
assert.deepStrictEqual(C.steps(byId('combo:c1'), ctx).map((s) => s.tool), ['pr.punchIn', 'pr.transApply'], 'a combo flattens to its steps');
assert.throws(() => C.steps({ name: 'x', run: { combo: ['fx:Gone Effect'] } }, ctx), /isn't available/);
assert.throws(() => C.steps({ name: 'x', run: { combo: ['combo:c1'] } }, ctx), /combos can't run combos/);
console.log('command ok ·', items.length, 'commands');
