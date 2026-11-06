// HaloCut Bins plans.
const assert = require('node:assert');
const path = require('path');
const B = require('../../extension/client/bins-core');
const it = (id, name, p, o = {}) => ({ id, name, path: p, kind: B.kindOf(p, o.seq), bin: o.bin || '', used: o.used !== false, offline: !!o.offline, label: o.label || 0, size: o.size || 0 });
const items = [
  it('1', 'Main edit', '', { seq: true }), it('2', 'A001.mov', '/cards/A001.mov', { size: 2e9 }),
  it('3', 'Song.wav', '/music/Song.wav', { bin: 'Music' }), it('4', 'Logo.png', '/gfx/Logo.png', { used: false, size: 5e5 }),
  it('5', 'Lower third.mogrt', '/t/Lower third.mogrt'), it('6', 'Color Matte', ''), it('7', 'A001.mov', '/cards/A001.mov', { bin: 'Old' }),
  it('8', 'Interview B-roll.mp4', '/cards/b.mp4', { offline: true }), it('9', 'notes.txt', '/x/notes.txt', { bin: '01 Sequences/Keep' }),
];
assert.deepStrictEqual(items.map((x) => x.kind), ['sequence', 'video', 'audio', 'image', 'graphics', 'graphics', 'video', 'video', 'other']);
let moves = B.organise(items, { locked: ['01 Sequences/Keep'], rules: [{ contains: 'b-roll', bin: '02 Footage/B-roll' }] });
const to = Object.fromEntries(moves.map((m) => [m.id, m.bin]));
assert.strictEqual(to['1'], '01 Sequences');
assert.strictEqual(to['8'], '02 Footage/B-roll', 'your rule comes before the type');
assert.strictEqual(to['9'], undefined, 'nothing moves out of a locked bin');
assert.strictEqual(to['6'], '05 Graphics', 'things with no file are graphics');
moves = B.organise(items, { unusedToBin: true });
assert.strictEqual(moves.find((m) => m.id === '4').bin, B.UNUSED_BIN);
assert.deepStrictEqual(B.duplicates(items).map((d) => d.id), ['7']);
assert.deepStrictEqual(B.offline(items).map((d) => d.id), ['8']);
assert.deepStrictEqual(B.rename([items[1], items[3]], { find: 'A0', replace: 'Cam A ', prefix: 'Wed_', number: true }).map((r) => r.name),
  ['Wed_Cam A 01 01.mov', 'Wed_Logo 02.png'], 'find/replace, prefix, numbering; the extension stays at the end');
assert.ok(B.labels(items).every((l) => l.label !== l.from));
const r = B.report(items, 'Wedding');
assert.ok(/Footage: 3 · 1\.9 GB/.test(r.text) && /Unused: 1 items · 488\.3 KB/.test(r.text), r.text);
// relink search over a pretend disk
const disk = { '/d': ['cam', 'b.mp4.bak', '.hidden'], '/d/cam': ['deep', 'B.MP4'], '/d/cam/deep': [] };
const found = B.findFiles(['b.mp4'], '/d', { readdir: (p) => disk[p], isDir: (p) => !!disk[p] }, path.join);
assert.deepStrictEqual(found, { 'b.mp4': '/d/cam/B.MP4' }, 'finds it in a folder inside, ignoring case');
console.log('bins ok');
