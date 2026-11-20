// The looks: one list for the settings window and the wheels, every colour valid, and the defaults.
// © 2026 Imtayz Nayem
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const A = require('../src/appearance');
const { defaults } = require('../src/config');

const hex = /^#[0-9a-f]{6}$/i;
assert.ok(Object.keys(A.ACCENTS).length >= 13 && Object.keys(A.BACKGROUNDS).length >= 9);
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
// one resolved theme for the window, the wheels and the Premiere panel
const hx = /^#[0-9a-f]{6}$/i;
for (const bg of Object.keys(A.BACKGROUNDS)) for (const ac of ['sunset', 'lime']) {
  const t = A.theme({ accent: ac, background: bg });
  assert.ok(hx.test(t.a1) && hx.test(t.disc[0]) && hx.test(t.disc[1]) && t.text && t.card && t.line && t.side, bg);
  assert.ok(hx.test(t.panel.accent1) && hx.test(t.panel.accent2) && hx.test(t.panel.bg) && hx.test(t.panel.glow), bg);
}
const paper = A.theme({ background: 'paper' }), dusk = A.theme({});
assert.ok(paper.light && paper.text === '#231d2b' && !dusk.light && dusk.text === '#efebf4');
assert.deepStrictEqual(paper.disc, ['#2a2230', '#151118'], 'the wheels stay dark over a light window');
assert.strictEqual(paper.panel.bg, '#1b1720', 'so does the Premiere panel');
assert.strictEqual(A.theme({ accent: 'lime', background: 'forest' }).panel.accent1, '#c6f24e');
assert.strictEqual(A.shade('#808080', 0.5), '#c0c0c0'); assert.strictEqual(A.shade('#808080', -0.5), '#404040');
// the panel follows it: hub.js reads theme.json, and its tints come from the accent
const client = (f) => fs.readFileSync(path.join(__dirname, '../../extension/client', f), 'utf8');
assert.ok(/theme\.json/.test(client('hub.js')) && /--accent1-rgb/.test(client('hub.js')) && /--accent1-rgb: 255, 138, 61/.test(client('style.css')));
assert.ok(!/rgba\(255, 138, 61/.test(client('hub.css')), 'no tint left that ignores the accent');
console.log('appearance ok ·', Object.keys(A.ACCENTS).length, 'accents,', Object.keys(A.BACKGROUNDS).length, 'backgrounds');
