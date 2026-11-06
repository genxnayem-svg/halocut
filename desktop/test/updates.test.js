// Update notifications: version order, where the repository is, and reading GitHub's latest release.
// © 2026 Imtayz Nayem
const assert = require('node:assert');
const U = require('../src/updates');

assert.strictEqual(U.compare('0.2.1', '0.2.0'), 1);
assert.strictEqual(U.compare('v0.3', '0.3.0'), 0);
assert.strictEqual(U.compare('1.2.10', '1.2.9'), 1, 'numbers, not text');
assert.strictEqual(U.compare('0.3.0-beta', '0.3.0'), -1, 'a beta is older than the release');
assert.strictEqual(U.compare('0.2.0', '0.10.0'), -1);

assert.strictEqual(U.repoOf('github:imtayz/halocut'), 'imtayz/halocut');
assert.strictEqual(U.repoOf('https://github.com/imtayz/halocut.git'), 'imtayz/halocut');
assert.strictEqual(U.repoOf({ url: 'git@github.com:imtayz/HaloCut.git' }), 'imtayz/HaloCut');
assert.strictEqual(U.repoOf('github:OWNER/halocut'), '', 'the placeholder means not set yet');
assert.strictEqual(U.repoOf(undefined), '');

const rel = { tag_name: 'v0.2.1', html_url: 'https://github.com/x/y/releases/tag/v0.2.1', body: 'New wheels',
  assets: [{ name: 'HaloCut-0.2.1.dmg', browser_download_url: 'https://dl/dmg' }, { name: 'HaloCut-0.2.1.pkg', browser_download_url: 'https://dl/pkg' }] };
assert.deepStrictEqual(U.readRelease(rel, '0.2.0'), { newer: true, version: '0.2.1', notes: 'New wheels', page: rel.html_url, download: 'https://dl/pkg' });
assert.strictEqual(U.readRelease(rel, '0.2.1').newer, false, 'already on it');
assert.strictEqual(U.readRelease({ ...rel, draft: true }, '0.1.0').newer, false, 'drafts are never offered');
assert.strictEqual(U.readRelease({ ...rel, assets: [] }, '0.2.0').download, rel.html_url, 'no files: the release page');

(async () => {
  const fake = (status, body) => async (url, opts) => {
    assert.ok(url === 'https://api.github.com/repos/x/y/releases/latest' && opts.headers['User-Agent']);
    return { status, ok: status < 300, json: async () => body };
  };
  let r = await U.check({ repo: 'x/y', current: '0.2.0', fetchImpl: fake(200, rel) });
  assert.ok(r.ok && r.newer && r.version === '0.2.1');
  r = await U.check({ repo: 'x/y', current: '0.2.0', fetchImpl: fake(404, {}) });
  assert.ok(r.ok && !r.newer && /No releases/.test(r.msg));
  r = await U.check({ repo: 'x/y', current: '0.2.0', fetchImpl: async () => { throw new Error('offline'); } });
  assert.ok(!r.ok && r.msg === 'offline', 'offline never throws');
  r = await U.check({ repo: '', current: '0.2.0' });
  assert.ok(!r.ok);
  console.log('updates ok');
})().catch((e) => { console.error(e); process.exit(1); });
