// Saved copies of the settings: one a day by itself, one per press, the newest 20 kept, and a copy reads back.
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const B = require('../src/backups');
const { defaults, toBackup, fromBackup } = require('../src/config');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'halocut-backups-'));
assert.deepStrictEqual(B.list(dir), []);
const d = defaults(); d.orbit.triggers[0] = { kind: 'key', name: 'F7', mods: [], delayMs: 0 };
const text = toBackup(d, '0.2.0');
const day = new Date(2026, 10, 11, 9, 0, 0);
assert.ok(B.save(dir, text, 'auto', day));
assert.strictEqual(B.save(dir, text, 'auto', new Date(2026, 10, 11, 18, 0, 0)), null, 'one automatic copy a day');
assert.ok(B.save(dir, text, 'auto', new Date(2026, 10, 12, 9, 0, 0)));
assert.ok(B.save(dir, text, 'saved', new Date(2026, 10, 12, 9, 5, 0)) && B.save(dir, text, 'saved', new Date(2026, 10, 12, 9, 6, 0)), 'every press');
let l = B.list(dir);
assert.strictEqual(l.length, 4);
assert.ok(/2026-11-12 09\.06\.00 saved\.json$/.test(l[0].name), 'newest first: ' + l[0].name);
assert.strictEqual(fromBackup(fs.readFileSync(l[0].file, 'utf8')).orbit.triggers[0].name, 'F7', 'a copy reads back');
for (let i = 0; i < 30; i++) B.save(dir, text, 'saved', new Date(2026, 10, 13, 10, i, 0));
l = B.list(dir);
assert.strictEqual(l.length, B.KEEP);
assert.ok(/10\.29\.00/.test(l[0].name) && !l.some((b) => /2026-11-11/.test(b.name)), 'the oldest go');
const main = fs.readFileSync(path.join(__dirname, '../src/main.js'), 'utf8');
assert.ok(/settings:saveNow/.test(main) && /settings:restore/.test(main) && /'before-restore'/.test(main));
console.log('backups ok ·', B.KEEP, 'copies kept');
