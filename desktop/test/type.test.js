// HaloCut Type: styles become animator values in pixels and selector keys; the preview maths agrees.
const assert = require('node:assert');
const T = require('../../extension/client/type-core');

assert.strictEqual(new Set(T.STYLES.map((s) => s.id)).size, T.STYLES.length);
assert.ok(T.STYLES.length >= 17 && T.STYLES.every((s) => T.GROUPS.includes(s.group)));
const rise = T.job('rise', { fontSize: 80, inPoint: 1, outPoint: 6, duration: 0.8 });
assert.deepStrictEqual(rise.props, { opacity: 0, position: [0, 48] }, 'offsets in em become pixels');
assert.deepStrictEqual(rise.keys, { prop: 'start', times: [1, 1.8], values: [0, 100], ease: true });
assert.strictEqual(rise.name, 'HaloCut Type · Rise');
const out = T.job('sink', { fontSize: 80, inPoint: 0, outPoint: 6, duration: 1, delay: 0.5 });
assert.deepStrictEqual(out.keys, { prop: 'end', times: [4.5, 5.5], values: [0, 100], ease: true }, 'out moves end at the layer end');
assert.deepStrictEqual(T.job('track', { fontSize: 50, inPoint: 0, duration: 1 }).keys.values, [100, 0], 'all at once through Amount');
assert.strictEqual(T.job('type', { inPoint: 0, duration: 1 }).smooth, 0);
assert.ok(T.job('random', { inPoint: 0, duration: 1 }).random);
assert.ok(T.job('wave', { inPoint: 0, duration: 2 }).wave.speed === 50 && !T.job('wave', { inPoint: 0, duration: 2 }).keys);
assert.strictEqual(T.job('slide', { inPoint: 0, duration: 1 }).based, 3);
assert.strictEqual(T.job('slide', { inPoint: 0, duration: 1, based: 4 }).based, 4, 'your choice of units wins');

// preview: letters go from fully selected to free in order; out does the opposite
const s = T.style('fade');
assert.strictEqual(T.amount(s, 0, 5, 0, 1), 1); assert.strictEqual(T.amount(s, 4, 5, 1, 1), 0);
assert.ok(T.amount(s, 0, 5, 0.5, 1) < T.amount(s, 4, 5, 0.5, 1), 'the first letter is ahead');
assert.strictEqual(T.amount(T.style('fadeOut'), 0, 5, 0, 1), 0);
assert.strictEqual(T.amount(T.style('type'), 2, 5, 0.6, 1), 0, 'hard edges: on or off');
assert.deepStrictEqual(T.units('Hi there', 3), ['Hi', ' ', 'there']);
assert.deepStrictEqual(T.units('one\rtwo', 4), ['one', 'two']);
assert.deepStrictEqual(T.lines('Big title\r\rsmall line', 60), [{ text: 'Big title', dy: 0 }, { text: 'small line', dy: 120 }], 'empty lines keep their space');
console.log('type ok ·', T.STYLES.length, 'styles');
