// Effect search ranking.
const assert = require('node:assert');
const E = require('../../extension/client/effect-search');
const fx = ['Gaussian Blur', 'Camera Blur', 'Directional Blur', 'Blur', 'Sharpen', 'Unsharp Mask', 'Lumetri Color',
  'Cross Dissolve', 'Dip to Black', 'Ultra Key', 'Crop', 'Constant Power', 'Warp Stabilizer'].map((name) => ({ name }));
const names = (q) => E.rank(fx, q).map((x) => x.name);
assert.deepStrictEqual(names('blur').slice(0, 2), ['Blur', 'Camera Blur'], 'exact first, then a word that starts with it');
assert.strictEqual(names('gaus')[0], 'Gaussian Blur', 'starts-with');
assert.strictEqual(names('gblur')[0], 'Gaussian Blur', 'letters in order');
assert.strictEqual(names('cr')[0], 'Crop', 'shortest starts-with first');
assert.deepStrictEqual(names('dip black'), ['Dip to Black'], 'every word has to match');
assert.ok(names('sharp').indexOf('Sharpen') < names('sharp').indexOf('Unsharp Mask'), 'starts-with beats inside a word');
assert.deepStrictEqual(names('zzz'), []);
console.log('effect search ok');
