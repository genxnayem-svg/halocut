// HaloCut Podcast: who talks, which camera, and the music dipping under the voices.
const assert = require('node:assert');
const P = require('../../extension/client/podcast-core');

// three mics over 60 s: each picks up its own person loud and the others faintly
const len = 60, n = len / P.STEP, talk = [[0, 10], [10, 14], [14, 20], [20, 24], [30, 45]], who = [0, 1, 0, 'both', 2];
const mics = [0, 1, 2].map(() => new Float32Array(n).fill(-60));
talk.forEach(([a, b], i) => {
  for (let k = Math.round(a / P.STEP); k < Math.round(b / P.STEP); k++) for (let m = 0; m < 3; m++) {
    const me = who[i] === m || (who[i] === 'both' && m < 2);
    mics[m][k] = Math.max(mics[m][k], me ? -18 : -32) + (k % 7) * 0.1;
  }
});
const tk = P.talkers(mics);
const at = (t) => tk[Math.round(t / 0.1)].who;
assert.deepStrictEqual([at(5), at(12), at(22), at(27), at(35)], [0, 1, -2, -1, 2], 'bleed from the other mics does not count');

const cuts = P.shots(tk, len, { minShot: 2, delay: 0.4, wide: 3, wideAfter: 4 });
const simple = cuts.map((c) => [c.cam, Math.round(c.start), Math.round(c.end)]);
assert.deepStrictEqual(simple, [[0, 0, 10], [1, 10, 14], [0, 14, 20], [3, 20, 30], [2, 30, 49], [3, 49, 60]], JSON.stringify(simple));
assert.ok(cuts.every((c, i) => !i || Math.abs(c.start - cuts[i - 1].end) < 1e-9), 'one shot after another, no holes');
// a voice that starts early in a shot: the switch waits for the shot to be long enough, and so does the way back
const quick = P.shots([...Array(50)].map((_, i) => ({ t: i / 10, who: i >= 10 && i < 30 ? 1 : 0 })), 5, { minShot: 2, delay: 0.3 });
assert.deepStrictEqual(quick.map((c) => [c.cam, c.start, c.end]), [[0, 0, 2], [1, 2, 4], [0, 4, 5]], JSON.stringify(quick));
// no wide shot: two at once stays on whoever had it
// a blip shorter than the time left in a shot is ignored
assert.strictEqual(P.shots([...Array(50)].map((_, i) => ({ t: i / 10, who: i >= 10 && i < 16 ? 1 : 0 })), 5, { minShot: 2, delay: 0.3 }).length, 1);
const noWide = P.shots(tk, len, { minShot: 2, delay: 0.4 });
assert.ok(noWide.every((c) => c.cam >= 0 && c.cam <= 2));
assert.deepStrictEqual(P.share(cuts, [0, 1, 2, 3]).reduce((a, b) => a + b, 0) >= 99, true);

// speech for ducking: any voice, short gaps joined
const sp = P.speech(mics, { hold: 0.6 });
assert.deepStrictEqual(sp.map((r) => [Math.round(r.start), Math.round(r.end)]), [[0, 24], [30, 45]]);
// duck keys: down before the voice, up after, merged dips, cut to the clip
const keys = P.duckKeys([{ start: 2, end: 5 }, { start: 5.5, end: 9 }, { start: 20, end: 22 }], 0, 30, -6, { depth: 14, attack: 0.3, release: 0.8 });
assert.deepStrictEqual(keys.map((k) => [k.t, k.db]), [[0, -6], [1.7, -6], [2, -20], [9, -20], [9.8, -6], [19.7, -6], [20, -20], [22, -20], [22.8, -6], [30, -6]]);
assert.deepStrictEqual(P.duckKeys([{ start: 2, end: 9 }], 3, 8, -6, {}).map((k) => [k.t, k.db]), [[3, -20], [8, -20]], 'a clip inside a dip stays down');
assert.strictEqual(P.duckKeys([{ start: 2, end: 3 }], 10, 20, -6, {}).length, 0, 'no voice under this clip: no keys');
assert.ok(Math.abs(P.dbToLevel(0) - 0.17783) < 1e-5 && Math.abs(P.levelToDb(P.dbToLevel(-14)) + 14) < 1e-9);
console.log('podcast ok ·', cuts.length, 'shots');
