// HaloCut Split maths: cells, windows, crop and placement.
const assert = require('node:assert');
const P = require('../../extension/client/split-core');
const src = { w: 1920, h: 1080 }, frame = P.FRAMES['9:16'];
const [bottom, top] = P.cells('faceTop', frame, 0);
assert.deepStrictEqual(top, { x: 0, y: 0, w: 1080, h: 640 });
assert.deepStrictEqual(P.cells('halves', frame, 20)[0], { x: 0, y: 970, w: 1080, h: 950 }, 'gap only between cells');
const win = P.fitWindow(src, bottom);
assert.ok(Math.abs(win.w / win.h - bottom.w / bottom.h) < 1e-9, 'the window takes the cell shape');
assert.strictEqual(win.h, 1080); assert.strictEqual(win.x, (1920 - win.w) / 2, 'centred');
assert.ok(P.fitWindow(src, bottom, 0, 0, 2).x === 0 && P.fitWindow(src, bottom, 0, 0, 2).y === 0, 'kept inside the source');

// Reframe: the middle of a 16:9 source as a full 9:16 frame
const re = P.place(src, frame, P.fitWindow(src, P.cells('reframe', frame, 0)[0]), P.cells('reframe', frame, 0)[0]);
assert.strictEqual(re.scale, 177.778, '1080 → 1920 tall');
assert.deepStrictEqual(re.position, [0.5, 0.5]);
assert.ok(Math.abs(re.crop.l - re.crop.r) < 1e-9 && re.crop.t === 0 && re.crop.b === 0);

// Face cam in the top-right corner of the source, onto the top third
const face = { x: 1440, y: 0, w: 480, h: 480 * 640 / 1080 };
const f = P.place(src, frame, face, top);
// the window's centre must land on the cell's centre: check by mapping it through the placement
const k = f.scale / 100, X = f.position[0] * frame.w + k * (face.x + face.w / 2 - src.w / 2), Y = f.position[1] * frame.h + k * (face.y + face.h / 2 - src.h / 2);
assert.ok(Math.abs(X - 540) < 0.01 && Math.abs(Y - 320) < 0.01, `lands centred in the cell (${X}, ${Y})`);
assert.strictEqual(f.scale, 225); assert.strictEqual(f.crop.l, 75); assert.strictEqual(f.crop.r, 0);
console.log('split ok');
