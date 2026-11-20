// Windows: key names, the helper's messages, which app is in front, building the helpers, and the download offered.
// The helpers themselves (helper/win/*.cs) only run on Windows; this covers everything around them.
// © 2026 Imtayz Nayem
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { HelperInput, WIN_KEYS, WIN_CODES, FrontApp } = require('../src/input');
const W = require('../src/win-helper');
const U = require('../src/updates');
const AppWheels = require('../src/app-wheels');

// key names are the ones the settings store, whatever the platform
assert.strictEqual(WIN_KEYS[0x70], 'F1');
assert.strictEqual(WIN_KEYS[0x87], 'F24');
assert.strictEqual(WIN_KEYS[0x41], 'A');
assert.strictEqual(WIN_KEYS[0x5A], 'Z');
assert.strictEqual(WIN_KEYS[0x30], '0');
assert.strictEqual(WIN_KEYS[0xC0], 'Backquote');
assert.strictEqual(WIN_CODES.Space, 0x20);
assert.strictEqual(WIN_CODES.ArrowUp, 0x26);
assert.strictEqual(Object.keys(WIN_CODES).length, Object.keys(WIN_KEYS).length, 'no two codes share a name');

// triggers → the helper's rules, in Windows key codes
const input = new HelperInput('nowhere', WIN_KEYS, WIN_CODES);
const sent = [];
input.send = (m) => sent.push(m);
input.setBlocking([
  { kind: 'mouse', name: 'right', mods: ['ctrl'], delayMs: 180 },
  { kind: 'mouse', name: 'mouse5', mods: [] },
  { kind: 'key', name: 'F10', mods: ['shift', 'ctrl'] },
  { kind: 'key', name: 'key226', mods: [] },   // a key without a name keeps its code
  { kind: 'key', name: 'Nonsense', mods: [] }, // dropped
]);
assert.deepStrictEqual(sent[0], { cmd: 'rules', rules: [
  { kind: 'mouse', code: 1, mods: ['ctrl'], delayMs: 180 },
  { kind: 'mouse', code: 4, mods: [], delayMs: 0 },
  { kind: 'key', code: 0x79, mods: ['ctrl', 'shift'], delayMs: 0 },
  { kind: 'key', code: 226, mods: [], delayMs: 0 },
] });

// the helper's messages → HaloCut's events
const got = [];
['press', 'release', 'recorded', 'front', 'scroll'].forEach((e) => input.on(e, (v) => got.push([e, v])));
input.onHelper({ e: 'down', kind: 'key', code: 0x42, mods: ['shift', 'ctrl'], blocked: true, repeat: false });
input.onHelper({ e: 'up', kind: 'mouse', code: 3, blocked: false });
input.onHelper({ e: 'recorded', kind: 'key', code: 0xBF, mods: [] });
input.onHelper({ e: 'front', name: 'Adobe Premiere Pro 2026', id: 'adobe premiere pro.exe', path: 'C:\\x.exe' });
input.onHelper({ e: 'scroll', dy: -1 });
assert.deepStrictEqual(got, [
  ['press', { kind: 'key', name: 'B', mods: ['ctrl', 'shift'], blocked: true, repeat: false }],
  ['release', { kind: 'mouse', name: 'mouse4', blocked: false }],
  ['recorded', { kind: 'key', name: 'Slash', mods: [] }],
  ['front', { name: 'Adobe Premiere Pro 2026', id: 'adobe premiere pro.exe', path: 'C:\\x.exe' }],
  ['scroll', { dy: -1 }],
]);

// which app is in front, from what Windows says about its .exe
const front = new FrontApp();
front.setApps([{ id: 'app.photoshop.exe', bundleId: 'photoshop.exe' }]);
front.set('Adobe Premiere Pro 2026', 'adobe premiere pro.exe');
assert.strictEqual(front.appId(), 'PPRO');
front.set('AfterFX', 'afterfx.exe');
assert.strictEqual(front.appId(), 'AEFT', 'After Effects by its .exe, even with no description');
front.set('Adobe Photoshop 2026', 'photoshop.exe');
assert.strictEqual(front.appId(), 'app.photoshop.exe');
front.set('Notepad', 'notepad.exe');
assert.strictEqual(front.appId(), 'other');

// the apps HaloCut knows come with their wheel on Windows too
assert.strictEqual(AppWheels.add({ apps: [] }, { bundleId: 'photoshop.exe', name: 'Adobe Photoshop 2026', path: 'C:\\ps.exe' }).ok, true);
assert.ok(/own shortcuts/.test(AppWheels.add({ apps: [] }, { bundleId: 'resolve.exe', name: 'DaVinci Resolve', path: 'C:\\r.exe' }).msg));
assert.strictEqual(AppWheels.add({ apps: [] }, { bundleId: 'afterfx.exe', name: 'AfterFX', path: 'C:\\ae.exe' }).ok, false, 'After Effects has its own tab');

// building the helpers on the PC
assert.strictEqual(W.compiler('C:\\Windows', (p) => /Framework64/.test(p)), 'C:\\Windows\\Microsoft.NET\\Framework64\\v4.0.30319\\csc.exe');
assert.strictEqual(W.compiler('C:\\Windows', (p) => /Framework\\/.test(p)), 'C:\\Windows\\Microsoft.NET\\Framework\\v4.0.30319\\csc.exe', '32-bit Windows');
assert.strictEqual(W.compiler('C:\\Windows', () => false), null);
assert.deepStrictEqual(W.compileArgs('ew-apps', 'a.cs', 'a.exe'),
  ['/nologo', '/optimize+', '/target:exe', '/out:a.exe', '/r:System.Web.Extensions.dll', '/r:System.Drawing.dll', 'a.cs']);
assert.ok(/^ew-input-[0-9a-f]{12}\.exe$/.test(W.builtName('ew-input', 'x')));
assert.notStrictEqual(W.builtName('ew-input', 'x'), W.builtName('ew-input', 'y'), 'new source, new helper');
assert.deepStrictEqual(W.ensure('ew-input', path.join(__dirname, 'nowhere'), __dirname), { file: null, error: 'ew-input.cs is missing' });

// the sources ship, and stay in the C# the Windows compiler understands (no C# 6 and later)
for (const name of ['ew-input', 'ew-apps']) {
  const src = fs.readFileSync(path.join(__dirname, '../helper/win', `${name}.cs`), 'utf8');
  assert.ok(!/\$"/.test(src), `${name}: no string interpolation`);
  assert.ok(!/\?\.|\?\[/.test(src.replace(/\/\/.*$/gm, '')), `${name}: no ?. operator`);
  assert.ok(!/\bnameof\(|=> [^;]*;\s*$/m.test(src.replace(/\/\/.*$/gm, '')), `${name}: no nameof or expression bodies`);
  assert.ok(!/out (var|int|uint|double|string) \w+\)/.test(src.replace(/static extern.*$/gm, '')), `${name}: no inline out variables`);
  let depth = 0;
  for (const c of src.replace(/"(\\.|[^"\\])*"|'(\\.|[^'\\])'|\/\/.*$/gm, '')) { if (c === '{') depth++; if (c === '}') depth--; }
  assert.strictEqual(depth, 0, `${name}: braces balance`);
}

// the update offered on Windows
const rel = { tag_name: 'v0.3.0', html_url: 'https://page', body: '', assets: [
  { name: 'HaloCut-0.3.0.pkg', browser_download_url: 'https://dl/pkg' },
  { name: 'HaloCut-0.3.0-win-x64.zip', browser_download_url: 'https://dl/zip' },
] };
assert.strictEqual(U.readRelease(rel, '0.2.0', 'win32').download, 'https://dl/zip');
assert.strictEqual(U.readRelease(rel, '0.2.0', 'darwin').download, 'https://dl/pkg');
assert.strictEqual(U.readRelease({ ...rel, assets: [...rel.assets, { name: 'HaloCut-Setup.exe', browser_download_url: 'https://dl/exe' }] }, '0.2.0', 'win32').download, 'https://dl/exe');
assert.strictEqual(U.readRelease({ ...rel, assets: rel.assets.slice(0, 1) }, '0.2.0', 'win32').download, 'https://page', 'no Windows file: the release page');

console.log('windows: ok');
