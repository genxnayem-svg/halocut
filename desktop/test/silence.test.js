// Silence engine against a generated file: tone 1 s, silence 0.8 s, tone 1 s, silence 0.3 s, tone 1 s.
const assert = require('node:assert');
const path = require('path');
const S = require('../../extension/client/silence');
const os = require('os');
const { execFileSync } = require('child_process');
const ff = S.findFfmpeg();
if (!ff) { console.log('silence test skipped (no ffmpeg)'); process.exit(0); }
const file = path.join(os.tmpdir(), 'halocut-silence-test.wav');
execFileSync(ff, ['-v', 'error', '-y',
  '-f', 'lavfi', '-i', 'sine=f=440:d=1', '-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=mono:d=0.8',
  '-f', 'lavfi', '-i', 'sine=f=300:d=1', '-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=mono:d=0.3',
  '-f', 'lavfi', '-i', 'sine=f=500:d=1', '-filter_complex', '[0][1][2][3][4]concat=n=5:v=0:a=1', '-ar', '48000', file]);
S.readLevels(ff, file, 0, 4.1, (err, levels) => {
  assert.ifError(err);
  assert.ok(Math.abs(levels.length - 410) <= 2, 'one level per 10 ms');
  const pauses = S.detectPauses(levels, { thresholdDb: -40, minPause: 0.4, keep: 0.1 });
  assert.strictEqual(pauses.length, 1, 'only the 0.8 s pause is long enough');
  assert.ok(Math.abs(pauses[0].start - 1.1) < 0.03 && Math.abs(pauses[0].end - 1.7) < 0.03, JSON.stringify(pauses));
  const short = S.detectPauses(levels, { thresholdDb: -40, minPause: 0.2, keep: 0.05 });
  assert.strictEqual(short.length, 2, 'with a 0.2 s minimum both pauses count');
  const tl = S.toTimeline([{ timelineStart: 10, pauses }, { timelineStart: 10.5, pauses: [{ start: 0.7, end: 1.5 }] }]);
  assert.deepStrictEqual(tl.map((p) => [p.start, p.end]), [[11.1, 12]], 'overlapping pauses merge');
  console.log('silence ok', JSON.stringify(pauses));
});
