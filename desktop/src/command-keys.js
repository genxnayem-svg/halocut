// HaloCut Command shortcuts, anywhere in Premiere Pro (not only while the Command panel has focus).
// The panel writes them to a file as ready-to-run Premiere steps; this reads that file and turns its keys
// ("shift+mod+b") into the helper's triggers ({ kind: 'key', name: 'B', mods: ['shift', 'cmd'] }).
// © 2026 Imtayz Nayem
const fs = require('fs');
const path = require('path');
const os = require('os');

// Same place as the panel writes it (extension/client/command.js)
const FILE = process.platform === 'win32'
  ? path.join(process.env.APPDATA || os.homedir(), 'HaloCut', 'command-shortcuts.json')
  : path.join(os.homedir(), 'Library', 'Application Support', 'HaloCut', 'command-shortcuts.json');

const NAMES = {
  left: 'ArrowLeft', right: 'ArrowRight', up: 'ArrowUp', down: 'ArrowDown', '\\': 'Backslash', '/': 'Slash', ',': 'Comma',
  '.': 'Period', ';': 'Semicolon', "'": 'Quote', '[': 'BracketLeft', ']': 'BracketRight', '-': 'Minus', '=': 'Equal', '`': 'Backquote',
};
const MODS = { ctrl: 'ctrl', alt: 'alt', shift: 'shift', mod: 'cmd' };
const MOD_ORDER = ['ctrl', 'alt', 'shift', 'cmd'];

function keyName(k) {
  if (/^[a-z]$/.test(k)) return k.toUpperCase();
  if (/^\d$/.test(k)) return k;
  if (/^f([1-9]|1\d|20)$/.test(k)) return k.toUpperCase();
  return NAMES[k] || null;
}

// "shift+mod+b" → the trigger the input helper matches and blocks; null for anything it can't be
function toTrigger(keys) {
  const parts = String(keys || '').split('+');
  const name = keyName(parts.pop());
  if (!name || parts.some((p) => !MODS[p])) return null;
  const mods = MOD_ORDER.filter((m) => parts.some((p) => MODS[p] === m));
  return { kind: 'key', name, mods, delayMs: 0 };
}

const validStep = (s) => s && typeof s.tool === 'string' && /^pr\.\w+$/.test(s.tool) && (s.args === undefined || (s.args && typeof s.args === 'object'));

// The file's contents → [{ trigger, keys, id, name, steps }], leaving out anything malformed
function parse(data) {
  if (!data || data.app !== 'PPRO' || !data.shortcuts || typeof data.shortcuts !== 'object') return [];
  const out = [];
  for (const [keys, sc] of Object.entries(data.shortcuts)) {
    const trigger = toTrigger(keys);
    if (!trigger || !sc || !Array.isArray(sc.steps) || !sc.steps.length || !sc.steps.every(validStep)) continue;
    out.push({ trigger, keys, id: sc.id, name: sc.name || sc.id || keys, steps: sc.steps.map((s) => ({ tool: s.tool, args: s.args || {}, name: s.name || sc.name })) });
  }
  return out;
}

function load(file = FILE) {
  try { return parse(JSON.parse(fs.readFileSync(file, 'utf8'))); }
  catch { return []; }
}

// The shortcut a key press belongs to, if any
function find(list, ev) {
  if (!ev || ev.kind !== 'key') return null;
  const mods = MOD_ORDER.filter((m) => (ev.mods || []).includes(m)).join();
  return list.find((s) => s.trigger.name === ev.name && s.trigger.mods.join() === mods) || null;
}

// Runs the steps one after another through run(tool, args, name) → { ok, msg }; stops at the first that fails
async function runSteps(sc, run) {
  let last = { ok: true, msg: sc.name };
  for (let i = 0; i < sc.steps.length; i++) {
    const s = sc.steps[i];
    last = await run(s.tool, s.args, s.name);
    if (!last || !last.ok) {
      const msg = (last && last.msg) || 'Failed';
      return { ok: false, msg: sc.steps.length > 1 ? `Step ${i + 1} (${s.name}): ${msg}` : msg };
    }
  }
  return sc.steps.length > 1 ? { ok: true, msg: `Ran ${sc.steps.length} steps` } : last;
}

// Calls onChange(list) now and whenever the panel saves the file (polled: works before the file exists, too)
function watch(onChange, file = FILE) {
  onChange(load(file));
  const listener = (cur, prev) => { if (cur.mtimeMs !== prev.mtimeMs || cur.size !== prev.size) onChange(load(file)); };
  fs.watchFile(file, { interval: 1000 }, listener);
  return () => fs.unwatchFile(file, listener);
}

module.exports = { FILE, toTrigger, parse, load, find, runSteps, watch };
