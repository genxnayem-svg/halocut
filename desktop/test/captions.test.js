// Captions engine: Hinglish one-spelling pass, fixes, grouping and SRT; then a real transcription if whisper is here.
const assert = require('node:assert');
const path = require('path');
const os = require('os');
const fs = require('fs');
const { execFileSync } = require('child_process');
const C = require('../../extension/client/captions');
const S = require('../../extension/client/silence');

const w = (t, s, e) => ({ text: t, start: s, end: e });
const n = C.normalise([w('mai', 0, 0.2), w('ne', 0.2, 0.3), w('pehle', 0.3, 0.6), w('yeh', 0.6, 0.7), w('clip', 0.7, 1), w('select', 1, 1.4),
  w('kya.', 1.4, 1.6), w('Achha,', 2, 2.3), w('thoda', 2.3, 2.6), w('zoom', 2.6, 2.9), w('karthe', 2.9, 3.2), w('parega.', 3.2, 3.6)]);
assert.strictEqual(n.map((x) => x.text).join(' '), 'maine pehle ye clip select kya. Accha, thoda zoom karte padega.');
assert.strictEqual(n[0].start, 0); assert.strictEqual(n[0].end, 0.3, 'joined words keep both timings');
const f = C.applyFixes([w('mouse', 0, 1), w('click', 1, 2), w('Halocut,', 2, 3)], { halocut: 'HaloCut' });
assert.strictEqual(f[2].text, 'HaloCut,', 'remember-this-fix keeps punctuation');
const lines = C.group(n, { maxChars: 24 });
assert.ok(lines.length >= 2 && lines.every((l) => l.text.length <= 24 || l.words.length === 1));
assert.ok(/^1\n00:00:00,000 --> 00:00:0/.test(C.toSrt(lines)), 'srt timing');

const ff = S.findFfmpeg(), whisper = C.findWhisper(path.join(__dirname, '../../extension'));
if (!ff || !whisper || !C.installedModels().length) { console.log('captions ok (no live transcription: whisper or model missing)'); process.exit(0); }
const wav = path.join(os.tmpdir(), 'halocut-caption-test.aiff');
execFileSync('say', ['-v', 'Lekha', '-o', wav, 'मैं आज बहुत खुश हूँ। मैंने पहले ये clip select किया। अच्छा, थोड़ा zoom करते हैं।']);
C.transcribe({ ffmpeg: ff, whisper, file: wav, inSec: 0, outSec: 8, language: 'hinglish' }, (err, words) => {
  assert.ifError(err);
  const text = words.map((x) => x.text).join(' ').toLowerCase();
  ['clip', 'select', 'zoom', 'bahut', 'maine'].forEach((k) => assert.ok(text.includes(k), `"${k}" in: ${text}`));
  assert.ok(!/[ऀ-ॿ]/.test(text), 'Roman letters only');
  assert.ok(words.every((x, i) => i === 0 || x.start >= words[i - 1].start), 'timings in order');
  console.log('captions ok ·', text);
});
