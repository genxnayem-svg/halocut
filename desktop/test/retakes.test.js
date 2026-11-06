// HaloCut Retakes: fillers, stutters, false starts and mumbles found in a transcript, and the cuts they make.
const assert = require('node:assert');
const R = require('../../extension/client/retakes-core');

function talk(text, gaps = {}) {
  let t = 1;
  return text.split(' ').map((w, i) => { t += gaps[i] || 0; const o = { text: w, start: +t.toFixed(3), end: +(t + 0.25).toFixed(3) }; t += 0.32; return o; });
}
const words = talk('so today we we are going to so today we are going to talk um about the uh new panel. I mean it really works', { 7: 0.3 });
const found = R.find(words, {});
const kinds = found.map((f) => f.kind + ':' + f.text);
assert.deepStrictEqual(kinds, ['retake:so today we we are going to', 'sound:um', 'sound:uh'], kinds.join(' | '));
assert.ok(!found.some((f) => f.kind === 'word'), 'filler words are off unless asked for');

// filler words when asked, and a stutter on its own
const more = R.find(talk('I I think it is like really good you know'), { words: true });
assert.deepStrictEqual(more.map((f) => f.kind + ':' + f.text), ['stutter:I', 'word:like', 'word:you know']);
assert.deepStrictEqual(R.find(talk('b- but that is fine')).map((f) => f.kind), ['stutter']);
assert.strictEqual(R.find(talk('we have 2 2 options')).length, 0, 'numbers repeat on purpose');

// two different sentences that start the same are not a false start
assert.strictEqual(R.find(talk('I think it works. I think it is fast too')).filter((f) => f.kind === 'retake').length, 0);
// a short restart after a pause is
const short = R.find(talk('the new the new panel is here', { 2: 0.3 }));
assert.deepStrictEqual(short.map((f) => f.kind + ':' + f.text), ['retake:the new']);

// cuts: from the item to just before the next word, never into a kept word, merged when they touch
const cuts = R.regions(words, found);
assert.strictEqual(cuts.length, 3);
assert.ok(Math.abs(cuts[0].start - (words[0].start - 0.04)) < 1e-6 && Math.abs(cuts[0].end - (words[7].start - 0.04)) < 1e-6, 'the whole first attempt');
const um = words.findIndex((w) => w.text === 'um');
assert.ok(cuts[1].start > words[um - 1].end && cuts[1].end < words[um + 1].start, 'um out, its neighbours kept');
assert.ok(Math.abs(R.total(cuts) - cuts.reduce((s, r) => s + r.end - r.start, 0)) < 1e-6);
found[1].on = false;
assert.strictEqual(R.regions(words, found).length, 2, 'unticked items stay');

// a mumble: loud sound in a gap with no words
const w2 = talk('hello there friend', { 2: 0.9 });
const levels = new Float32Array(400).fill(-70);
const mark = (a, b, db) => { for (let t = a; t < b; t += 0.01) levels[Math.round((t - 1) / 0.01)] = db; };
w2.forEach((w) => mark(w.start, w.end, -18));
mark(w2[1].end + 0.25, w2[1].end + 0.75, -22);
const mm = R.mumbles(w2, [{ start: 1, levels }]);
assert.strictEqual(mm.length, 1);
assert.ok(mm[0].start > w2[1].end && mm[0].end < w2[2].start && mm[0].end - mm[0].start > 0.4, JSON.stringify(mm[0]));
const mc = R.regions(w2, mm);
assert.ok(mc.length === 1 && mc[0].start >= w2[1].end && mc[0].end <= w2[2].start);
assert.strictEqual(R.mumbles(talk('hello there friend'), [{ start: 1, levels: new Float32Array(400).fill(-70) }]).length, 0, 'quiet gaps are pauses, not mumbles');
console.log('retakes ok ·', kinds.length, 'found,', R.total(cuts), 's');
