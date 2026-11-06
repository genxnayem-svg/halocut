// HaloCut Markers core: chapters, exports, import, duplicates, numbering, snapping.
const assert = require('node:assert');
const K = require('../../extension/client/markers-core');
const m = (start, name, color = 0, end = start) => ({ guid: 'g' + start, start, end, name, color, comments: '' });
const ms = [m(75, 'Setup'), m(260.4, 'Silence remover', 1), m(12, 'Why this matters'), m(3725, 'Wrap up', 1)];

let y = K.youtubeChapters(ms, { end: 4000 });
assert.strictEqual(y.text.split('\n')[0], '0:00 Intro', 'adds 0:00 when the first marker is later');
assert.strictEqual(y.text.split('\n')[2], '1:15 Setup');
assert.strictEqual(y.text.split('\n')[4], '1:02:05 Wrap up', 'hours shown past an hour');
assert.strictEqual(y.count, 5); assert.deepStrictEqual(y.problems, []);
y = K.youtubeChapters([m(0, 'A'), m(5, 'B')], { end: 30 });
assert.ok(y.problems.some((p) => /at least 3/.test(p)) && y.problems.some((p) => /“A” is shorter/.test(p)));
assert.strictEqual(K.youtubeChapters(ms, { colors: [1] }).count, 3, 'chapters from chosen colours only (+ intro)');

assert.strictEqual(K.timecode(75.5, 25), '00:01:15:13');
assert.ok(K.toCsv(ms, 25).startsWith('Name,Start,End,Duration,Colour,Comments\nWhy this matters,00:00:12:00'));
assert.ok(/^1\n00:00:12,000 --> 00:01:15,000\nWhy this matters/.test(K.toSrt(ms)), 'a marker without length runs to the next');

const imp = K.parseImport('0:00 Intro\n1:15 - Setup\n01:02:05 Wrap up\n(4:20) Silence remover\nnonsense line\n00:00:10:12 Frames');
assert.deepStrictEqual(imp.map((x) => [x.start, x.name]), [[0, 'Intro'], [10.48, 'Frames'], [75, 'Setup'], [260, 'Silence remover'], [3725, 'Wrap up']]);
assert.deepStrictEqual(K.parseImport('Name,Start,End\nHook,00:00:05:00,00:00:06:00', 25).map((x) => [x.start, x.name]), [[5, 'Hook']], 'reads our own CSV back');

assert.deepStrictEqual(K.duplicates([m(1, 'A'), m(1.01, 'A'), m(1.01, 'B'), m(9, 'A')], 25).map((x) => x.name), ['A']);
assert.deepStrictEqual(K.numbered([m(5, 'x'), m(1, 'y')], 'Scene').map((x) => x.name), ['Scene 01', 'Scene 02']);
assert.deepStrictEqual(K.snapTargets([m(10.3, 'a'), m(50, 'b')], [0, 10, 11, 30], 2).map((x) => [x.guid, x.start]), [['g10.3', 10]], 'snaps within 2 s only');
console.log('markers ok');
