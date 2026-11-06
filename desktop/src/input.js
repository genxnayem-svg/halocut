// Global input: one event model on every platform.
//   press   { kind: "mouse"|"key", name, mods, blocked, repeat }
//   release { kind, name, blocked }
//   move    {}
//   recorded { kind, name, mods } / recordCancelled
// macOS uses the native ew-input helper (can block buttons and keys); elsewhere uiohook (watch only, for now).
const { EventEmitter } = require('events');
const { execFile, spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const readline = require('readline');
const { uIOhook, UiohookKey } = require('uiohook-napi');

const IS_MAC = process.platform === 'darwin';

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
      } else {
        // TODO(windows): native foreground-window lookup in the Windows build.
        this.set('');
      }
    };
    poll();
    this.timer = setInterval(poll, 400);
  }
  set(name, bundleId = '') {
    if (name !== this.name || bundleId !== this.bundleId) { this.name = name; this.bundleId = bundleId; this.emit('change', name); }
  }
  // the apps added in Settings ([{ id, bundleId }]): each gets its own wheels while it is in front
  setApps(list) { this.added = list || []; this.emit('change', this.name); }
  // "PPRO", "AEFT", an added app's id ("app.<bundle id>") or "other"
  appId() {
    if (/premiere/i.test(this.name)) return 'PPRO';
    if (/after effects/i.test(this.name)) return 'AEFT';
    const a = this.bundleId && this.added.find((x) => x.bundleId === this.bundleId);
    return a ? a.id : 'other';
  }
}

// ---- macOS: native helper -------------------------------------------------------

class MacInput extends EventEmitter {
  constructor(helperPath) { super(); this.helperPath = helperPath; this.rules = []; }

  start() {
    if (!fs.existsSync(this.helperPath)) throw new Error(`Input helper missing: ${this.helperPath}`);
    this.spawnHelper();
  }

  spawnHelper() {
    const p = spawn(this.helperPath, [], { stdio: ['pipe', 'pipe', 'inherit'] });
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
    const name = (kind, code) => (kind === 'mouse' ? mouseName(code) : MAC_KEYS[code] || `key${code}`);
    switch (m.e) {
      case 'ready': this.emit('ready'); break;
      case 'error': this.emit('error', new Error(m.msg)); break;
      case 'move': this.emit('move'); break;
      case 'down': this.emit('press', { kind: m.kind, name: name(m.kind, m.code), mods: normMods(m.mods), blocked: m.blocked, repeat: !!m.repeat }); break;
      case 'up': this.emit('release', { kind: m.kind, name: name(m.kind, m.code), blocked: m.blocked }); break;
      case 'recorded': this.emit('recorded', { kind: m.kind, name: name(m.kind, m.code), mods: normMods(m.mods) }); break;
      case 'recordCancelled': this.emit('recordCancelled'); break;
      default: break;
    }
  }

  send(obj) { if (this.proc) this.proc.stdin.write(JSON.stringify(obj) + '\n'); }

  // triggers: [{ kind, name, mods, delayMs }]
  setBlocking(list) {
    this.rules = list.map((t) => ({
      kind: t.kind,
      code: t.kind === 'mouse' ? mouseNumber(t.name) : MAC_CODES[t.name],
      mods: normMods(t.mods),
      delayMs: t.delayMs || 0,
    })).filter((r) => r.code !== undefined && r.code >= 0);
    this.send({ cmd: 'rules', rules: this.rules });
  }

  record() { this.send({ cmd: 'record' }); }
  cancelRecord() { this.send({ cmd: 'cancelRecord' }); }
  canBlock() { return true; }
  stop() { this.stopped = true; if (this.proc) this.proc.kill(); }
}

// ---- other platforms: uiohook (watch only) -------------------------------------

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

  setBlocking() { /* TODO(windows): low-level hook helper that can swallow events */ }
  record() { this.recording = true; }
  cancelRecord() { this.recording = false; }
  canBlock() { return false; }
  stop() { uIOhook.stop(); }
}

function createInput(helperPath) {
  return IS_MAC ? new MacInput(helperPath) : new HookInput();
}

module.exports = {
  parseFront, createInput, FrontApp, sendKeys, describe, normMods, IS_MAC };
