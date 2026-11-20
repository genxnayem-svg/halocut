// Saved copies of the settings, kept next to them (userData/backups): one when HaloCut starts each day, one whenever
// you press "Save settings now". The newest 20 are kept. Restoring one goes through the same check as a settings file.
// © 2026 Imtayz Nayem
const fs = require('fs');
const path = require('path');

const KEEP = 20;
const dirOf = (userData) => path.join(userData, 'backups');
const stamp = (d) => { const p = (n) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}.${p(d.getMinutes())}.${p(d.getSeconds())}`; };

// Newest first: [{ file, name, when }]
function list(userData) {
  let names = [];
  try { names = fs.readdirSync(dirOf(userData)).filter((n) => /^HaloCut settings .*\.json$/.test(n)); } catch { return []; }
  return names.sort().reverse().map((name) => ({ name, file: path.join(dirOf(userData), name), when: name.slice(17, 36) }));
}

// text: the backup file's text (config.toBackup). kind: "auto" (at most one a day) or "saved" (every press).
function save(userData, text, kind = 'saved', now = new Date()) {
  const dir = dirOf(userData);
  fs.mkdirSync(dir, { recursive: true });
  const day = stamp(now).slice(0, 10);
  if (kind === 'auto' && list(userData).some((b) => b.name.includes(` ${day} `) && b.name.endsWith('auto.json'))) return null;
  const file = path.join(dir, `HaloCut settings ${stamp(now)} ${kind}.json`);
  fs.writeFileSync(file, text);
  list(userData).slice(KEEP).forEach((b) => { try { fs.unlinkSync(b.file); } catch { /* next time */ } });
  return file;
}

module.exports = { KEEP, dirOf, list, save };
