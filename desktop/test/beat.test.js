// HaloCut Beat on generated drum tracks: kick on every beat (louder on beat 2 of each bar of 4), hi-hat off the beat.
const assert = require('node:assert');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const S = require('../../extension/client/silence');
const B = require('../../extension/client/beat-core');

assert.strictEqual(B.tapBpm([0, 0.5, 1, 1.52, 2]), 120, 'tap tempo');
assert.deepStrictEqual(B.regrid(0.75, 120, 2), [0.25, 0.75, 1.25, 1.75], 'regrid keeps the anchor beat');

const ff = S.findFfmpeg();
if (!ff) { console.log('beat ok (no ffmpeg for the live part)'); process.exit(0); }

function track(bpm, seconds) {
  const p = 60 / bpm, file = path.join(os.tmpdir(), `halocut-beat-${bpm}.wav`);
  const accent = `(1+1.2*eq(mod(floor(t/${p}),4),1))`;
  const kick = `0.5*${accent}*sin(2*PI*55*t)*exp(-28*mod(t,${p}))`;
  const hat = `0.08*sin(2*PI*7000*t)*exp(-90*mod(t+${p / 2},${p}))`;
  execFileSync(ff, ['-v', 'error', '-y', '-f', 'lavfi', '-i', `aevalsrc='${kick}+${hat}':s=44100:d=${seconds}`, file]);
  return file;
}

function levels(file, filter) {
  return new Promise((res, rej) => S.readLevels(ff, file, 0, 16, (e, l) => (e ? rej(e) : res(l)), filter));
}

(async () => {
  for (const bpm of [120, 95]) {
    const file = track(bpm, 16);
    const a = B.analyse(await levels(file), await levels(file, 'lowpass=f=150'));
    const p = 60 / bpm;
    assert.ok(Math.abs(a.bpm - bpm) <= 1.5, `${bpm} BPM found as ${a.bpm}`);
    const off = a.beats.map((t) => Math.abs(t / p - Math.round(t / p)) * p);
    assert.ok(Math.max(...off) < 0.035, `beats land within 35 ms (worst ${Math.max(...off).toFixed(3)} s)`);
    assert.ok(a.beats.length >= Math.floor(16 / p) - 1, 'a beat all the way through');
    const barBeat = Math.round(B.pick(a, 'bar')[0] / p) % 4;
    assert.strictEqual(barBeat, 1, `the accented beat starts the bar (got ${barBeat})`);
    const two = B.pick(a, '2');
    assert.ok(two.every((t, i) => i === 0 || Math.abs(t - two[i - 1] - 2 * p) < 0.05), 'every 2 beats is two beats apart');
    console.log(`beat ok · ${bpm} BPM → ${a.bpm} BPM, ${a.beats.length} beats, bar on beat ${barBeat}, ${a.hits.length} hits`);
  }
})().catch((e) => { console.error(e.message); process.exit(1); });
