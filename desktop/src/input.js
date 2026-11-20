// Global input: one event model on every platform.
//   press   { kind: "mouse"|"key", name, mods, blocked, repeat }
//   release { kind, name, blocked }
//   move    {}
//   recorded { kind, name, mods } / recordCancelled
// macOS and Windows use the native ew-input helper (can block buttons and keys); elsewhere, or when the helper
// is missing, uiohook (watch only).
const { EventEmitter } = require('events');
const { execFile, spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const readline = require('readline');
const { uIOhook, UiohookKey } = require('uiohook-napi');

const IS_MAC = process.platform === 'darwin';
const IS_WIN = process.platform === 'win32';

// ---- names ------------------------------------------------------------------

// macOS virtual key codes
const MAC_KEYS = {
  122: 'F1', 120: 'F2', 99: 'F3', 118: 'F4', 96: 'F5', 97: 'F6', 98: 'F7', 100: 'F8', 101: 'F9', 109: 'F10',
  103: 'F11', 111: 'F12', 105: 'F13', 107: 'F14', 113: 'F15', 106: 'F16', 64: 'F17', 79: 'F18', 80: 'F19', 90: 'F20',
  0: 'A', 11: 'B', 8: 'C', 2: 'D', 14: 'E', 3: 'F', 5: 'G', 4: 'H', 34: 'I', 38: 'J', 40: 'K', 37: 'L', 46: 'M',
  45: 'N', 31: 'O', 35: 'P', 12: 'Q', 15: 'R', 1: 'S', 17: 'T', 32: 'U', 9: 'V', 13: 'W', 7: 'X', 16: 'Y', 6: 'Z',
  29: '0', 18: '1', 19: '2', 20: '3', 21: '4', 23: '5', 22: '6', 26: '7', 28: '8', 25: '9',
  49: 'Space', 36: 'Enter', 48: 'Tab', 51: 'Backspace', 117: 'Delete', 53: 'Escape', 50: 'Backquote',
  24: 'Equal', 27: 'Minus', 33: 'BracketLeft', 30: 'BracketRight', 41: 'Semicolon', 39: 'Quote',
  42: 'Backslash', 43: 'Comma', 47: 'Period', 44: 'Slash', 115: 'Home', 119: 'End', 116: 'PageUp', 121: 'PageDown',
  123: 'ArrowLeft', 124: 'ArrowRight', 125: 'ArrowDown', 126: 'ArrowUp',
};
const MAC_CODES = Object.fromEntries(Object.entries(MAC_KEYS).map(([c, n]) => [n, Number(c)]));

// Windows virtual-key codes, under the same names
const WIN_KEYS = {
  8: 'Backspace', 9: 'Tab', 13: 'Enter', 27: 'Escape', 32: 'Space', 33: 'PageUp', 34: 'PageDown', 35: 'End', 36: 'Home',
  37: 'ArrowLeft', 38: 'ArrowUp', 39: 'ArrowRight', 40: 'ArrowDown', 46: 'Delete',
  186: 'Semicolon', 187: 'Equal', 188: 'Comma', 189: 'Minus', 190: 'Period', 191: 'Slash', 192: 'Backquote',
  219: 'BracketLeft', 220: 'Backslash', 221: 'BracketRight', 222: 'Quote',
};
for (let i = 0; i < 10; i++) WIN_KEYS[48 + i] = String(i);
for (let i = 0; i < 26; i++) WIN_KEYS[65 + i] = String.fromCharCode(65 + i);
for (let i = 1; i <= 24; i++) WIN_KEYS[111 + i] = `F${i}`;
const WIN_CODES = Object.fromEntries(Object.entries(WIN_KEYS).map(([c, n]) => [n, Number(c)]));

// Mouse buttons by number (0 = left). Names are what the config stores.
function mouseName(n) {
  return ({ 0: 'left', 1: 'right', 2: 'middle', 3: 'mouse4', 4: 'mouse5' })[n] || `mouse${n + 1}`;
}
function mouseNumber(name) {
  const fixed = { left: 0, right: 1, middle: 2, mouse4: 3, mouse5: 4 };
  if (name in fixed) return fixed[name];
  const m = /^mouse(\d+)$/.exec(name);
  return m ? Number(m[1]) - 1 : -1;
}

const MOD_ORDER = ['ctrl', 'alt', 'shift', 'cmd'];
function normMods(mods) { return MOD_ORDER.filter((m) => (mods || []).includes(m)); }

// "Ctrl + Right button", "F10"
function describe(t) {
  if (!t) return 'None';
  const MOD = IS_MAC ? { ctrl: '⌃', alt: '⌥', shift: '⇧', cmd: '⌘' } : { ctrl: 'Ctrl', alt: 'Alt', shift: 'Shift', cmd: 'Win' };
  const BTN = { right: 'Right button', middle: 'Middle button', mouse4: 'Mouse 4 (back)', mouse5: 'Mouse 5 (forward)', left: 'Left button' };
  const name = t.kind === 'mouse' ? (BTN[t.name] || t.name.replace('mouse', 'Mouse ')) : t.name;
  return [...normMods(t.mods).map((m) => MOD[m]), name].join(IS_MAC ? '' : ' + ');
}

// ---- keystrokes (uiohook can type on both platforms) --------------------------

const KEY_ALIASES = {
  mod: IS_MAC ? 'Meta' : 'Ctrl', cmd: 'Meta', command: 'Meta', meta: 'Meta', win: 'Meta',
  ctrl: 'Ctrl', control: 'Ctrl', alt: 'Alt', option: 'Alt', opt: 'Alt', shift: 'Shift',
  space: 'Space', enter: 'Enter', return: 'Enter', esc: 'Escape', escape: 'Escape', tab: 'Tab',
  delete: 'Delete', del: 'Delete', backspace: 'Backspace', equal: 'Equal', '=': 'Equal',
  minus: 'Minus', '-': 'Minus', left: 'ArrowLeft', right: 'ArrowRight', up: 'ArrowUp', down: 'ArrowDown',
  comma: 'Comma', period: 'Period', slash: 'Slash',
  '[': 'BracketLeft', ']': 'BracketRight', ';': 'Semicolon', "'": 'Quote', '\\': 'Backslash', '`': 'Backquote',
  ',': 'Comma', '.': 'Period', '/': 'Slash', pageup: 'PageUp', pagedown: 'PageDown', home: 'Home', end: 'End',
};

function keyCode(name) {
  const alias = KEY_ALIASES[name.toLowerCase()];
  const k = alias || (name.length === 1 ? name.toUpperCase() : name[0].toUpperCase() + name.slice(1));
  if (!(k in UiohookKey)) throw new Error(`Unknown key: ${name}`);
  return UiohookKey[k];
}

// "mod+shift+k" -> keyTap(K, [Meta, Shift])
function sendKeys(combo) {
  const parts = combo.split('+').map((p) => p.trim()).filter(Boolean);
  const main = parts.pop();
  uIOhook.keyTap(keyCode(main), parts.map(keyCode));
}

// ---- front app ----------------------------------------------------------------

// lsappinfo's answer → { name, bundleId }. Usually "LSDisplayName"="Adobe Premiere Pro 2026"; some macOS builds print
// the name in quotes first, then bundleID="com.adobe.PremierePro.26".
function parseFront(out) {
  const n = String(out || '').match(/"LSDisplayName"="([^"]*)"/) || String(out || '').match(/^"([^"]+)"/);
  const b = String(out || '').match(/bundleID="([^"]+)"/) || String(out || '').match(/"CFBundleIdentifier"="([^"]+)"/);
  return { name: n ? n[1] : '', bundleId: b ? b[1] : '' };
}

class FrontApp extends EventEmitter {
  constructor() { super(); this.name = ''; this.bundleId = ''; this.added = []; }
  start() {
    const poll = () => {
      if (IS_MAC) {
        execFile('/bin/sh', ['-c', 'lsappinfo info -only name -only bundleid "$(lsappinfo front)"'], (err, out) => {
          const f = err ? { name: '', bundleId: '' } : parseFront(out);
          this.set(f.name, f.bundleId);
        });
      }
    };
    if (!IS_MAC) return; // Windows: the input helper says which app is in front (see main.js)
    poll();
    this.timer = setInterval(poll, 400);
  }
  set(name, bundleId = '') {
    if (name !== this.name || bundleId !== this.bundleId) { this.name = name; this.bundleId = bundleId; this.emit('change', name); }
  }
  // the apps added in Settings ([{ id, bundleId }]): each gets its own wheels while it is in front
  setApps(list) { this.added = list || []; this.emit('change', this.name); }
  // "PPRO", "AEFT", an added app's id ("app.<bundle id>") or "other". On Windows the id is the .exe's name
  // ("adobe premiere pro.exe", "afterfx.exe").
  appId() {
    if (/premiere/i.test(this.name) || /premiere pro/i.test(this.bundleId)) return 'PPRO';
    if (/after effects/i.test(this.name) || /^afterfx/i.test(this.bundleId)) return 'AEFT';
    const a = this.bundleId && this.added.find((x) => x.bundleId === this.bundleId);
    return a ? a.id : 'other';
  }
}

// ---- macOS and Windows: native helper --------------------------------------------

class HelperInput extends EventEmitter {
  // keys: the platform's key codes by number · codes: the same, by name
  constructor(helperPath, keys = MAC_KEYS, codes = MAC_CODES) { super(); this.helperPath = helperPath; this.rules = []; this.keys = keys; this.codes = codes; }

  start() {
    if (!fs.existsSync(this.helperPath)) throw new Error(`Input helper missing: ${this.helperPath}`);
    this.spawnHelper();
  }

  spawnHelper() {
    const p = spawn(this.helperPath, [], { stdio: ['pipe', 'pipe', 'inherit'], windowsHide: true });
    this.proc = p;
    readline.createInterface({ input: p.stdout }).on('line', (line) => {
      let m;
      try { m = JSON.parse(line); } catch { return; }
      this.onHelper(m);
    });
    p.on('exit', (code) => {
      this.proc = null;
      if (this.stopped) return;
      // No permission (code 2, reported via 'error'): keep trying, so granting it in System Settings
      // starts the wheels without a restart. Crashed: bring it back quickly.
      setTimeout(() => this.spawnHelper(), code === 2 ? 3000 : 1000);
    });
    this.send({ cmd: 'rules', rules: this.rules });
  }

  onHelper(m) {
    const name = (kind, code) => (kind === 'mouse' ? mouseName(code) : this.keys[code] || `key${code}`);
    switch (m.e) {
      case 'ready': this.emit('ready', { listenOnly: !!m.listenOnly }); break;
      case 'error': this.emit('error', new Error(m.msg)); break;
      case 'move': this.emit('move'); break;
      case 'scroll': this.emit('scroll', { dy: m.dy }); break;
      case 'down': this.emit('press', { kind: m.kind, name: name(m.kind, m.code), mods: normMods(m.mods), blocked: m.blocked, repeat: !!m.repeat }); break;
      case 'up': this.emit('release', { kind: m.kind, name: name(m.kind, m.code), blocked: m.blocked }); break;
      case 'recorded': this.emit('recorded', { kind: m.kind, name: name(m.kind, m.code), mods: normMods(m.mods) }); break;
      case 'recordCancelled': this.emit('recordCancelled'); break;
      case 'front': this.emit('front', { name: m.name || '', id: m.id || '', path: m.path || '' }); break; // Windows
      default: break;
    }
  }

  send(obj) { if (this.proc) this.proc.stdin.write(JSON.stringify(obj) + '\n'); }

  // triggers: [{ kind, name, mods, delayMs }]
  setBlocking(list) {
    this.rules = list.map((t) => ({
      kind: t.kind,
      // a key HaloCut has no name for is kept as "key<code>" (the § key is key10): it is taken over like any other
      code: t.kind === 'mouse' ? mouseNumber(t.name) : (this.codes[t.name] !== undefined ? this.codes[t.name] : (/^key(\d+)$/.test(t.name) ? Number(t.name.slice(3)) : undefined)),
      mods: normMods(t.mods),
      delayMs: t.delayMs || 0,
    })).filter((r) => r.code !== undefined && r.code >= 0);
    this.send({ cmd: 'rules', rules: this.rules });
  }

  // on: report the scroll wheel (and keep it from the app) while a wheel with several layouts is open
  setScroll(on) { this.send({ cmd: 'scroll', on: !!on }); }
  record() { this.send({ cmd: 'record' }); }
  cancelRecord() { this.send({ cmd: 'cancelRecord' }); }
  canBlock() { return true; }
  stop() { this.stopped = true; if (this.proc) this.proc.kill(); }
}

// ---- without the helper: uiohook (watch only) ----------------------------------

const HOOK_BUTTONS = { 1: 'left', 2: 'right', 3: 'middle', 4: 'mouse4', 5: 'mouse5' };
const HOOK_KEYS = Object.fromEntries(Object.entries(UiohookKey).map(([n, c]) => [c, n]));

class HookInput extends EventEmitter {
  constructor() { super(); this.down = new Set(); this.recording = false; }

  start() {
    const mods = (e) => normMods([e.ctrlKey && 'ctrl', e.altKey && 'alt', e.shiftKey && 'shift', e.metaKey && 'cmd'].filter(Boolean));
    const press = (ev) => {
      if (this.recording && !ev.repeat && !(ev.kind === 'mouse' && ev.name === 'left' && ev.mods.length === 0)) {
        this.recording = false;
        if (ev.kind === 'key' && ev.name === 'Escape') this.emit('recordCancelled');
        else this.emit('recorded', { kind: ev.kind, name: ev.name, mods: ev.mods });
        return;
      }
      this.emit('press', ev);
    };
    uIOhook.on('keydown', (e) => {
      const repeat = this.down.has(e.keycode);
      this.down.add(e.keycode);
      press({ kind: 'key', name: HOOK_KEYS[e.keycode] || `key${e.keycode}`, mods: mods(e), blocked: false, repeat });
    });
    uIOhook.on('keyup', (e) => {
      this.down.delete(e.keycode);
      this.emit('release', { kind: 'key', name: HOOK_KEYS[e.keycode] || `key${e.keycode}`, blocked: false });
    });
    uIOhook.on('mousedown', (e) => press({ kind: 'mouse', name: HOOK_BUTTONS[e.button] || `mouse${e.button}`, mods: mods(e), blocked: false }));
    uIOhook.on('mouseup', (e) => this.emit('release', { kind: 'mouse', name: HOOK_BUTTONS[e.button] || `mouse${e.button}`, blocked: false }));
    uIOhook.on('mousemove', () => this.emit('move'));
    uIOhook.start();
    this.emit('ready');
  }

  setBlocking() { /* uiohook can watch, not swallow */ }
  setScroll() { /* nor the scroll wheel */ }
  record() { this.recording = true; }
  cancelRecord() { this.recording = false; }
  canBlock() { return false; }
  stop() { uIOhook.stop(); }
}

// helperPath: the built ew-input for this platform, or nothing when there is none (then: watch only)
function createInput(helperPath) {
  if (IS_MAC) return new HelperInput(helperPath);
  if (IS_WIN && helperPath) return new HelperInput(helperPath, WIN_KEYS, WIN_CODES);
  return new HookInput();
}

module.exports = {
  parseFront, createInput, FrontApp, sendKeys, describe, normMods, IS_MAC, IS_WIN, HelperInput, WIN_KEYS, WIN_CODES };
