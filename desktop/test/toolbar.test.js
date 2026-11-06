// HaloCut Toolbar: every job runs something real, search ranks names first, pins stop at nine.
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const B = require('../../extension/client/toolbar-core');
const jsx = fs.readFileSync(path.join(__dirname, '../../extension/jsx/premiere.jsx'), 'utf8');
const icons = fs.readFileSync(path.join(__dirname, '../../extension/client/icons.js'), 'utf8');

assert.strictEqual(new Set(B.JOBS.map((j) => j.id)).size, B.JOBS.length, 'ids are unique');
for (const j of B.JOBS) {
  assert.ok(B.GROUPS.includes(j.group), j.id);
  assert.ok(j.tool ? jsx.includes(`T["${j.tool}"]`) : ['freeze', 'copyFrame', 'paste', 'guides', 'qc'].includes(j.do), `${j.id} runs something that exists`);
  assert.ok(B.EXTRA_ICONS[j.icon] || icons.includes(`  ${j.icon}:`), `${j.id} has an icon`);
}
assert.deepStrictEqual(B.search(B.JOBS, 'cut').slice(0, 2).map((j) => j.id), ['cut', 'cutAll'], 'names that start with it first');
assert.ok(B.search(B.JOBS, 'cut').some((j) => j.id === 'jcut'), 'J cut matches too');
assert.deepStrictEqual(B.search(B.JOBS, 'stagger').map((j) => j.id), ['stairDown', 'stairUp'], 'keywords find them');
assert.deepStrictEqual(B.search(B.JOBS, 'fill w').map((j) => j.id), ['fillW']);
assert.strictEqual(B.search(B.JOBS, 'zzz').length, 0);
let pins = [];
B.JOBS.slice(0, 11).forEach((j) => { pins = B.togglePin(pins, j.id); });
assert.strictEqual(pins.length, 9, 'nine keys, nine pins');
pins = B.togglePin(pins, 'cut');
assert.ok(!pins.includes('cut') && B.pinned(B.JOBS, ['qc', 'gone', 'fill']).map((j) => j.id).join() === 'qc,fill');
assert.deepStrictEqual(B.argsFor(B.byId(B.JOBS, 'lcut'), { jl: 8 }), { kind: 'l', frames: 8 });
assert.deepStrictEqual(B.argsFor(B.byId(B.JOBS, 'freezeIn'), {}), { len: 2, insert: true });
assert.deepStrictEqual(B.argsFor(B.byId(B.JOBS, 'punchIn'), { punch: 1.35 }), { factor: 1.35 });
console.log('toolbar ok ·', B.JOBS.length, 'jobs');
