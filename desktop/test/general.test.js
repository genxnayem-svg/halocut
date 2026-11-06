// The General page's settings: defaults, older settings files, backups in and out, reset.
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { Config, defaults, toBackup, fromBackup, WHEEL_SCALE, NOTE_MS } = require('../src/config');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'halocut-general-'));
// a settings file from before the General page: it gets the new defaults, and keeps what it had
fs.writeFileSync(path.join(dir, 'config.json'), JSON.stringify({ paused: false, appearance: { accent: 'ocean', background: 'midnight', glow: false }, wheel: { triggers: [{ kind: 'key', name: 'F7', mods: [], delayMs: 0 }, null] } }));
const c = new Config(dir);
assert.deepStrictEqual(c.data.general, defaults().general);
assert.strictEqual(c.data.wheel.triggers[0].name, 'F7');
assert.strictEqual(c.data.appearance.accent, 'ocean');
// a partly set General section keeps its own values
c.update({ general: { ...c.data.general, wheelSize: 'large', notes: false } });
assert.deepStrictEqual([new Config(dir).data.general.wheelSize, new Config(dir).data.general.notes, new Config(dir).data.general.animation], ['large', false, 'smooth']);

// backups: out and back in, with the header; a raw settings file is fine too; anything else is refused
const text = toBackup(c.data, '0.3.0');
assert.strictEqual(JSON.parse(text).app, 'HaloCut');
const back = fromBackup(text);
assert.strictEqual(back.general.wheelSize, 'large'); assert.strictEqual(back.appearance.background, 'midnight');
assert.ok(back.layouts.PPRO && back.options && back.profiles.other, 'missing parts filled from the defaults');
assert.strictEqual(fromBackup(JSON.stringify({ ...c.data, paused: true })).paused, false, 'never comes back paused');
assert.throws(() => fromBackup('not json'), /isn't JSON/);
assert.throws(() => fromBackup('{"hello": 1}'), /isn't HaloCut settings/);
c.replace(back);
assert.strictEqual(new Config(dir).data.general.wheelSize, 'large');
// reset: everything as HaloCut starts
c.reset();
assert.deepStrictEqual(new Config(dir).data, defaults());
assert.deepStrictEqual([WHEEL_SCALE.small < 1, WHEEL_SCALE.large > 1, NOTE_MS.short < NOTE_MS.long], [true, true, true]);
fs.rmSync(dir, { recursive: true, force: true });
console.log('general ok');
