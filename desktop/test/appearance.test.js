// The looks: one list for the settings window and the wheels, every colour valid, and the defaults.
// © 2026 Imtayz Nayem
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const A = require('../src/appearance');
const { defaults } = require('../src/config');

const hex = /^#[0-9a-f]{6}$/i;
assert.ok(Object.keys(A.ACCENTS).length >= 9);
for (const [id, a] of Object.entries(A.ACCENTS)) assert.ok(a.name && a.c.length === 2 && a.c.every((c) => hex.test(c)), id);
for (const [id, b] of Object.entries(A.BACKGROUNDS)) assert.ok(b.name && ['bg', 'bg2', 'glow1', 'glow2'].every((k) => hex.test(b[k])), id);
// the six from before keep their colours, so nobody's look changes
assert.deepStrictEqual(A.accentOf('sunset'), ['#ff8a3d', '#e8457c']);
assert.deepStrictEqual(A.accentOf('ocean'), ['#36c2ff', '#5b6cff']);
assert.strictEqual(A.backgroundOf('midnight').bg, '#0d1018');
// unknown names fall back
assert.deepStrictEqual(A.accentOf('nope'), A.accentOf('sunset'));
assert.strictEqual(A.backgroundOf(undefined).name, 'Dusk');
// the settings default matches, see-through off
assert.deepStrictEqual(defaults().appearance, A.DEFAULT);
// the wheels and the settings window both read this list, and neither keeps a copy of its own
const read = (f) => fs.readFileSync(path.join(__dirname, '../renderer', f), 'utf8');
assert.ok(read('wheel.html').includes('../src/appearance.js') && read('settings.html').includes('../src/appearance.js'));
assert.ok(!/sunset:\s*\[/.test(read('wheel.js')) && !/sunset:\s*\[/.test(read('settings.js')), 'no second accent list');
assert.ok(/data\.glass/.test(read('wheel.js')) && /glass: !!/.test(fs.readFileSync(path.join(__dirname, '../src/main.js'), 'utf8')));
console.log('appearance ok ·', Object.keys(A.ACCENTS).length, 'accents,', Object.keys(A.BACKGROUNDS).length, 'backgrounds');
