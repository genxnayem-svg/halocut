// Builds HaloCut for Windows (64-bit) into ../dist/HaloCut-win32-x64, zips it, and makes the installer
// ../dist/HaloCut-Setup-<version>.exe (installer-win.json): npm run package:win
// Works from a Mac: nothing is compiled here. The two helpers go along as C# sources (helper/win) and are built on the
// PC the first time HaloCut starts (src/win-helper.js).
// © 2026 Imtayz Nayem
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { packager } = require('@electron/packager');

const root = path.join(__dirname, '..');
const pkg = require('../package.json');

// An .ico is a small table followed by the pictures; Windows reads PNG pictures in it as they are.
function icoFrom(pngs) {
  const head = Buffer.alloc(6);
  head.writeUInt16LE(1, 2);
  head.writeUInt16LE(pngs.length, 4);
  const entries = [];
  let offset = 6 + 16 * pngs.length;
  for (const { size, data } of pngs) {
    const e = Buffer.alloc(16);
    e.writeUInt8(size >= 256 ? 0 : size, 0);
    e.writeUInt8(size >= 256 ? 0 : size, 1);
    e.writeUInt16LE(1, 4);
    e.writeUInt16LE(32, 6);
    e.writeUInt32LE(data.length, 8);
    e.writeUInt32LE(offset, 12);
    offset += data.length;
    entries.push(e);
  }
  return Buffer.concat([head, ...entries, ...pngs.map((p) => p.data)]);
}

function makeIcon() {
  const build = path.join(root, 'build');
  fs.mkdirSync(build, { recursive: true });
  const src = path.join(root, 'assets/logo-1024.png');
  const pngs = [256, 64, 48, 32, 16].map((size) => {
    const out = path.join(build, `icon-${size}.png`);
    execFileSync('sips', ['-z', String(size), String(size), src, '--out', out], { stdio: 'ignore' }); // macOS's own image tool
    const data = fs.readFileSync(out);
    fs.unlinkSync(out);
    return { size, data };
  });
  const ico = path.join(build, 'HaloCut.ico');
  fs.writeFileSync(ico, icoFrom(pngs));
  return ico;
}

(async () => {
  const [dir] = await packager({
    dir: root, name: 'HaloCut', platform: 'win32', arch: 'x64', out: path.join(root, '../dist'), overwrite: true,
    icon: makeIcon(), appCopyright: pkg.copyright,
    extraResource: [path.join(root, '../extension'), path.join(root, 'helper/win')],
    ignore: [/^\/test/, /^\/build/, /^\/helper/, /^\/scripts/, /^\/installer-win\.json/],
    win32metadata: { CompanyName: pkg.author, FileDescription: 'HaloCut', ProductName: 'HaloCut', InternalName: 'HaloCut' },
  });
  // the Mac-only speech binary stays out of the Windows build
  fs.rmSync(path.join(dir, 'resources/extension/bin/whisper-cli'), { force: true });
  const zip = path.join(root, '../dist', `HaloCut-${pkg.version}-win-x64.zip`);
  fs.rmSync(zip, { force: true });
  execFileSync('zip', ['-qry', zip, path.basename(dir)], { cwd: path.dirname(dir) });
  // the installer: one click, for the person installing (no administrator), Start menu and desktop shortcuts
  const dist = path.join(root, '../dist');
  execFileSync(path.join(root, 'node_modules/.bin/electron-builder'),
    ['--win', 'nsis', '--x64', '--prepackaged', dir, '--config', 'installer-win.json', '--publish', 'never'], { cwd: root, stdio: 'inherit' });
  const setup = path.join(dist, `HaloCut-Setup-${pkg.version}.exe`);
  for (const extra of [`${setup}.blockmap`, path.join(dist, 'latest.yml'), path.join(dist, 'builder-debug.yml'), path.join(dir, 'resources/elevate.exe')]) fs.rmSync(extra, { force: true });
  if (!fs.existsSync(setup)) throw new Error(`No ${setup}`);
  console.log(`Built ${dir}\nZipped ${zip}\nInstaller ${setup}`);
})().catch((e) => { console.error(e); process.exit(1); });
