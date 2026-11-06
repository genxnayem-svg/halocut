// HaloCut Caption Styles: looks, grouping, the timed states and the layout of each caption.
const assert = require('node:assert');
const S = require('../../extension/client/styles-core');

assert.strictEqual(new Set(S.LOOKS.map((l) => l.id)).size, S.LOOKS.length, 'every look has its own id');
assert.ok(S.LOOKS.length >= 24 && S.FAMILIES.length >= 8);
for (const l of S.LOOKS) assert.ok(['line', 'highlight', 'karaoke', 'reveal', 'chunk'].includes(l.mode) && l.size > 0 && l.fill, l.id);

const say = 'so today I want to show you. how this panel works and why it is fast';
let t = 0;
const words = say.split(' ').map((w, i) => { const s = t; t += 0.3 + (i === 6 ? 0.8 : 0); return { text: w, start: s, end: s + 0.28 }; });

// lines: a break after the full stop; chunk looks hold only a few words
const lines = S.group(words, S.styled('clean'));
assert.strictEqual(lines[0].text, 'so today I want to show you.');
assert.ok(lines.every((l) => l.text.length <= 32));
const two = S.group(words, S.styled('stack'));
assert.ok(two.every((l) => l.words.length <= 2) && two[0].text === 'so today');

// states: one per caption for line looks, one per word otherwise; frame-snapped, in order, no overlaps
const fps = 25;
const st1 = S.states(lines, S.styled('clean'), fps);
assert.strictEqual(st1.length, lines.length);
const st2 = S.states(lines, S.styled('yellow'), fps);
assert.strictEqual(st2.length, words.length, 'a picture per spoken word');
for (let i = 0; i < st2.length; i++) {
  const s = st2[i];
  assert.ok(Math.abs(s.start * fps - Math.round(s.start * fps)) < 1e-6 && s.end > s.start, 'on frames');
  if (i) assert.ok(s.start >= st2[i - 1].end - 1e-9, 'no overlap');
}
assert.ok(st2[0].first && !st2[1].first && st2[7].first, 'first marks a new caption');
// a short gap between captions is closed so nothing flickers
assert.ok(Math.abs(st1[1].start - st1[0].end) < 1e-9 || st1[1].start - st1[0].end > 0.25);

// layout: centred rows, wrapped to the safe width, the block centred on the look's height
const frame = { w: 1920, h: 1080 }, measure = (txt, font) => txt.length * parseInt(/(\d+)px/.exec(font)[1], 10) * 0.55;
const L = S.styled('yellow'), lay = S.layout(lines[0].words.map((w) => w.text), L, frame, measure);
assert.strictEqual(lay.words[0].text, 'SO', 'upper case look');
const rowW = (r) => { const ws = lay.words.filter((w) => w.row === r); return ws[ws.length - 1].x + ws[ws.length - 1].w - ws[0].x; };
for (let r = 0; r < lay.rows; r++) {
  const ws = lay.words.filter((w) => w.row === r);
  assert.ok(Math.abs(ws[0].x + rowW(r) / 2 - 960) < 1, 'row centred');
  assert.ok(rowW(r) <= 1920 * 0.84 + 1, 'inside the safe width');
}
assert.ok(Math.abs(lay.box.y + lay.box.h / 2 - L.y * 1080) < 1, 'block centred on its height');
const big = S.layout('a very long caption that will certainly not fit on one single row of the frame at this size'.split(' '), S.styled('clean', { size: 0.09 }), frame, measure);
assert.strictEqual(big.rows, 2, 'wraps, two rows at most');

// how words look in a state
const hl = S.wordLook(L, { active: 2 }, 2), other = S.wordLook(L, { active: 2 }, 1);
assert.ok(hl.fill === '#ffd43b' && hl.scale > 1 && other.fill === '#ffffff' && other.scale === 1);
assert.strictEqual(S.wordLook(S.styled('type'), { active: 1 }, 2), null, 'reveal: not said yet');
assert.strictEqual(S.wordLook(S.styled('kara-gold'), { active: 1 }, 0).fill, '#ffd43b');
assert.strictEqual(S.wordLook(S.styled('kara-gold'), { active: 1 }, 3).fill, '#ffffff');
assert.strictEqual(S.wordLook(S.styled('box-blue'), { active: 0 }, 0).box, '#2f6bff');
// your own colour and size on top of a look
const mine = S.styled('box-blue', { accent: '#00ff88', size: 0.07, upper: true });
assert.ok(mine.active.bg === '#00ff88' && mine.size === 0.07 && mine.upper && S.look('box-blue').active.bg === '#2f6bff', 'the look itself is untouched');

// .srt in, and editing a caption's text
const srt = '1\n00:00:01,000 --> 00:00:03,000\nHello <i>there</i> friend\n\n2\n00:00:04,000 --> 00:00:05,000\nBye\n';
const sw = S.fromSrt(srt);
assert.deepStrictEqual(sw.map((w) => w.text), ['Hello', 'there', 'friend', 'Bye']);
assert.ok(Math.abs(sw[0].start - 1) < 1e-9 && Math.abs(sw[2].end - 3) < 1e-9 && sw[3].start === 4);
const re = S.retext(lines[0], 'so today I will show you something.');
assert.ok(re.length === 7 && Math.abs(re[0].start - lines[0].start) < 1e-9 && Math.abs(re[6].end - lines[0].end) < 1e-9);
assert.deepStrictEqual(S.retext(lines[1], lines[1].text.toUpperCase()).map((w) => w.start), lines[1].words.map((w) => w.start), 'same count keeps word timings');
console.log('styles ok ·', S.LOOKS.length, 'looks in', S.FAMILIES.length, 'families');
