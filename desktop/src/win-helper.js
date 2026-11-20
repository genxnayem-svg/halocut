// Windows: HaloCut's two small helpers (ew-input, ew-apps) are C# sources that are built on the PC itself, the first
// time HaloCut starts, with the C# compiler every Windows 10 and 11 already has. Nothing has to be built on a Mac.
// A helper that was built ahead of time (an .exe next to its source) is used as it is.
// © 2026 Imtayz Nayem
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const REFS = {
  'ew-input': ['System.Web.Extensions.dll'],
  'ew-apps': ['System.Web.Extensions.dll', 'System.Drawing.dll'],
};

// The compiler that ships with Windows (.NET Framework 4), or null
function compiler(windir = process.env.WINDIR || 'C:\\Windows', exists = fs.existsSync) {
  for (const dir of ['Framework64', 'Framework']) {
    const p = path.win32.join(windir, 'Microsoft.NET', dir, 'v4.0.30319', 'csc.exe');
    if (exists(p)) return p;
  }
  return null;
}

// What the compiler is asked: no console banner, optimised, one .exe
function compileArgs(name, src, out) {
  return ['/nologo', '/optimize+', '/target:exe', `/out:${out}`, ...(REFS[name] || []).map((r) => `/r:${r}`), src];
}

// The built helper's file name carries a hash of its source, so a new HaloCut builds a new helper
function builtName(name, source) {
  return `${name}-${crypto.createHash('sha1').update(source).digest('hex').slice(0, 12)}.exe`;
}

// name: 'ew-input' | 'ew-apps' · sourceDir: where <name>.cs is · userData: where the built .exe is kept
// → { file } when the helper is ready, { file: null, error } when it could not be built
function ensure(name, sourceDir, userData) {
  const ready = path.join(sourceDir, `${name}.exe`);
  if (fs.existsSync(ready)) return { file: ready };
  const src = path.join(sourceDir, `${name}.cs`);
  if (!fs.existsSync(src)) return { file: null, error: `${name}.cs is missing` };
  const dir = path.join(userData, 'helpers');
  const out = path.join(dir, builtName(name, fs.readFileSync(src)));
  if (fs.existsSync(out)) return { file: out };
  const csc = compiler();
  if (!csc) return { file: null, error: 'The C# compiler of Windows (.NET Framework 4) was not found' };
  try {
    fs.mkdirSync(dir, { recursive: true });
    for (const old of fs.readdirSync(dir)) {
      if (old.startsWith(`${name}-`) && old.endsWith('.exe')) { try { fs.unlinkSync(path.join(dir, old)); } catch { /* still running */ } }
    }
    execFileSync(csc, compileArgs(name, src, out), { windowsHide: true, timeout: 60000, stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (e) {
    const said = String((e.stdout && e.stdout.toString()) || e.message || '').trim().split('\n').slice(0, 3).join(' · ');
    return { file: null, error: `${name} could not be built: ${said}` };
  }
  return fs.existsSync(out) ? { file: out } : { file: null, error: `${name} could not be built` };
}

module.exports = { ensure, compiler, compileArgs, builtName };
