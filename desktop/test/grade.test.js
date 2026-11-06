// HaloCut Grade model: neutral changes nothing, each slider moves the right way, pickers, Auto, Match and .cube.
const assert = require('node:assert');
const G = require('../../extension/client/grade-core');
const at = (p, rgb) => G.pixel(G.prepare(p), rgb[0], rgb[1], rgb[2]).map((v) => v * 255);
const near = (a, b, e) => a.every((v, i) => Math.abs(v - b[i]) <= e);

// neutral is a no-op
for (const c of [[0, 0, 0], [255, 255, 255], [128, 64, 200], [12, 240, 90], [200, 180, 170]]) assert.ok(near(at(G.values(), c), c, 0.75), `neutral keeps ${c}`);

// each slider moves the right way
const grey = [128, 128, 128], y = (px) => G.luma(px[0], px[1], px[2]);
assert.ok(y(at({ exposure: 1 }, grey)) > 170 && y(at({ exposure: -1 }, grey)) < 100, 'exposure in stops');
const warm = at({ temperature: 40 }, grey); assert.ok(warm[0] > warm[2] + 15, 'warmer: more red than blue');
const mag = at({ tint: 40 }, grey); assert.ok(mag[1] < mag[0] && mag[1] < mag[2], 'tint + is magenta');
assert.ok(y(at({ contrast: 50 }, [200, 200, 200])) > 200 && y(at({ contrast: 50 }, [50, 50, 50])) < 50, 'contrast spreads');
assert.ok(y(at({ highlights: -60 }, [210, 210, 210])) < 205 && Math.abs(y(at({ highlights: -60 }, [40, 40, 40])) - 40) < 3, 'highlights leave shadows');
assert.ok(y(at({ shadows: 60 }, [50, 50, 50])) > 60, 'shadows lift');
assert.ok(y(at({ blacks: -60 }, [20, 20, 20])) < 14 && y(at({ whites: 60 }, [220, 220, 220])) > 235);
assert.ok(y(at({ faded: 100 }, [0, 0, 0])) > 12, 'faded film lifts the blacks');
const mono = at({ saturation: 0 }, [200, 60, 60]); assert.ok(Math.abs(mono[0] - mono[1]) < 1 && Math.abs(mono[1] - mono[2]) < 1, 'saturation 0 is grey');
const dull = [140, 120, 110], vivid = [230, 30, 30];
const dv = at({ vibrance: 80 }, dull), vv = at({ vibrance: 80 }, vivid);
assert.ok((dv[0] - dv[2]) / (dull[0] - dull[2]) > (vv[0] - vv[2] + 1) / (vivid[0] - vivid[2]), 'vibrance lifts the dull colours more');
const corner = G.pixel(G.prepare({ vignette: -2 }), 128, 128, 128, 1, 1), middle = G.pixel(G.prepare({ vignette: -2 }), 128, 128, 128, 0, 0);
assert.ok(corner[0] < middle[0] * 0.8 && Math.abs(middle[0] * 255 - 128) < 1, 'vignette darkens the corners only');

// pickers
const bluish = [120, 130, 160];
const n = G.neutralAt(G.values(), bluish), np = at(n, bluish);
assert.ok(n.temperature > 0, 'a blue cast gets warmed');
assert.ok(Math.max(...np) - Math.min(...np) < 2.5, `picked grey comes out grey ${np}`);
const skin = [200, 170, 175]; // a little pink
const sk = G.skinAt(G.values(), skin), before = Math.abs(G.hueOf(at({}, skin).map((v) => v / 255)).angle - G.SKIN_ANGLE);
const after = Math.abs(G.hueOf(at(sk, skin).map((v) => v / 255)).angle - G.SKIN_ANGLE);
assert.ok(after < 3 && after < before, `skin onto the skin line (${before.toFixed(1)}° → ${after.toFixed(1)}°)`);
const wp = G.whiteAt(G.values(), [190, 190, 190]); assert.ok(wp.whites > 0 && Math.abs(y(at(wp, [190, 190, 190])) / 255 - 0.94) < 0.01);
const bp = G.blackAt(G.values(), [40, 40, 40]); assert.ok(bp.blacks < 0 && Math.abs(y(at(bp, [40, 40, 40])) / 255 - 0.04) < 0.01);

// a synthetic shot: a gradient with a coloured patch
function shot(w, h, cast) {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const k = (j * w + i) * 4, v = 30 + (i / (w - 1)) * 190, patch = i > w * 0.6 && j < h * 0.4;
    data[k] = Math.min(255, (patch ? v * 1.2 : v) * cast[0]); data[k + 1] = Math.min(255, (patch ? v * 0.8 : v) * cast[1]); data[k + 2] = Math.min(255, (patch ? v * 0.6 : v) * cast[2]); data[k + 3] = 255;
  }
  return { data, width: w, height: h };
}
// Auto pulls a cast out and spreads the range
const cast = shot(64, 36, [0.85, 0.95, 1.15]), A = G.auto(cast), sa = G.stats(cast, A), s0 = G.stats(cast);
assert.ok(A.temperature > 0 && Math.abs(sa.cb) < Math.abs(s0.cb), 'auto warms a cold shot');
assert.ok(sa.p[6] > s0.p[6] && sa.p[0] < s0.p[0], 'auto spreads the range');

// Match: grade a shot with a known look, then match the plain shot to it
const plain = shot(64, 36, [1, 1, 1]), goal = G.values({ exposure: 0.4, contrast: 20, temperature: 25, saturation: 120 });
const ref = G.stats(plain, goal), m = G.match(plain, ref), got = G.stats(plain, m);
assert.ok(Math.abs(got.p[3] - ref.p[3]) < 0.02 && Math.abs(got.cb - ref.cb) < 0.01 && Math.abs(got.cr - ref.cr) < 0.01, `matched: ${JSON.stringify(m)}`);
assert.ok(m.temperature > 5, 'finds the warmth');

// .cube
const lut = G.cube(G.values(), 17).trim().split('\n');
assert.strictEqual(lut.length, 4 + 17 ** 3);
assert.strictEqual(lut[1], 'LUT_3D_SIZE 17');
assert.strictEqual(lut[4], '0.000000 0.000000 0.000000'); assert.strictEqual(lut[lut.length - 1], '1.000000 1.000000 1.000000');
assert.ok(lut[5].startsWith('0.06'), 'red changes fastest');
assert.deepStrictEqual(G.look('mono').saturation, 0);
console.log('grade ok · match', JSON.stringify(m));
