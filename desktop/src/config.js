// Settings stored as JSON in the app's user-data folder.
const fs = require('fs');
const path = require('path');
const { layouts, previousLayouts } = require('./tools');

// Same segments, in the same order, with the same tools
function sameLayout(a, b) {
  const sig = (L) => JSON.stringify((L.segments || []).map((s) => [s.name, s.main, s.tools]));
  return !!a && !!b && sig(a) === sig(b);
}
const { defaultOptions } = require('./options');

const defaults = () => ({
  version: 1,
  paused: false,
  appearance: { accent: 'sunset', background: 'dusk', glow: true, glass: false },
  // General page. wheelSize: small | medium | large · animation: smooth | fast | off · noteLength: short | normal | long
  general: { openAtLogin: false, showOnStart: true, wheelSize: 'medium', animation: 'smooth', notes: true, noteLength: 'normal' },
  wheel: {
    // Up to two triggers. Each is a key or mouse button, with optional modifiers.
    // delayMs: hold that long before the wheel opens; a quicker tap is passed on as a normal click.
    triggers: [
      { kind: 'key', name: 'F10', mods: [], delayMs: 0 },
      null,
    ],
    tapToStick: true,    // a quick tap keeps the wheel open; click a slice to run it
  },
  layouts: JSON.parse(JSON.stringify(layouts)),
  // Tools added from the settings page (Premiere effects, transitions, commands, shortcuts…), by id, like the built-in catalog
  customTools: {},
  options: defaultOptions(),
  // pinned: apps always on the Orbit switch, open or not ([{ bundleId, name, path }]) · hidden: bundle ids never shown
  // showOthers: also the other open apps
  orbit: { triggers: [{ kind: 'key', name: 'F9', mods: [], delayMs: 0 }, null], showTabs: true, pinned: [], hidden: [], showOthers: true },
  // Apps added in Settings, each with its own Tool wheel, Options wheel and buttons: [{ id: 'app.<bundle id>', bundleId, name, path }]
  apps: [],
  // Quick search in Premiere Pro / After Effects: type an effect, transition or command, Return puts it on the selected clips.
  // recent: what was picked lately (catalog ids), first at the top when nothing is typed
  search: { triggers: [{ kind: 'key', name: 'Space', mods: ['alt'], delayMs: 0 }, null], recent: [] },
  // Per-app mouse buttons. Actions: { type: "none" } | { type: "tool", id } | { type: "keys", keys } | { type: "wheel" }
  profiles: {
    PPRO: { mouse4: { type: 'tool', id: 'pr.cut' }, mouse5: { type: 'tool', id: 'pr.rippleDelete' }, middle: { type: 'none' } },
    AEFT: { mouse4: { type: 'tool', id: 'ae.splitLayer' }, mouse5: { type: 'tool', id: 'ae.easyEase' }, middle: { type: 'none' } },
    other: { mouse4: { type: 'none' }, mouse5: { type: 'none' }, middle: { type: 'none' } },
  },
});

// 0.1.0 stored { key, mouse, holdDelayMs }; now it is a list of triggers.
function migrateWheel(w) {
  if (w.triggers) return w;
  const { key, mouse, holdDelayMs, ...rest } = w;
  if (key === undefined && mouse === undefined) return rest;
  return {
    ...rest,
    triggers: [
      key ? { kind: 'key', name: key, mods: [], delayMs: 0 } : null,
      mouse && mouse !== 'none' ? { kind: 'mouse', name: mouse, mods: [], delayMs: holdDelayMs || 0 } : null,
    ],
  };
}

class Config {
  constructor(dir) {
    this.file = path.join(dir, 'config.json');
    this.data = defaults();
    try {
      const saved = JSON.parse(fs.readFileSync(this.file, 'utf8'));
      this.data = {
        ...this.data, ...saved,
        wheel: { ...this.data.wheel, ...migrateWheel(saved.wheel || {}) },
        options: { ...this.data.options, ...(saved.options || {}) },
        orbit: { ...this.data.orbit, ...(saved.orbit || {}) },
        search: { ...this.data.search, ...(saved.search || {}) },
        general: { ...this.data.general, ...(saved.general || {}) },
      };
    } catch { /* first run */ }
    // The SyncOS merge was undone: drop its Studio segment if a saved layout picked it up.
    const pr = this.data.layouts.PPRO;
    if (pr) pr.segments = pr.segments.filter((s) => s.name !== 'Studio');
    // 0.2.1: Premiere's Tool wheel became Adjustment · Timeline · Speed · Effects · Color matte · Gain.
    // A saved layout still exactly the old default moves to the new one; a layout you changed stays yours.
    // 0.2.2: Dip to Black / White and three dissolves joined the Effects segment.
    if (pr && previousLayouts.PPRO.some((old) => sameLayout(pr, old))) this.data.layouts.PPRO = JSON.parse(JSON.stringify(layouts.PPRO));
  }

  save() {
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    fs.writeFileSync(this.file, JSON.stringify(this.data, null, 2));
  }

  update(patch) {
    this.data = { ...this.data, ...patch };
    this.save();
  }

  resetLayout(appId) {
    this.data.layouts[appId] = JSON.parse(JSON.stringify(layouts[appId]));
    this.save();
  }

  // Everything back to how HaloCut starts.
  reset() {
    this.data = defaults();
    this.save();
  }

  // Settings from a backup file (already checked by fromBackup).
  replace(data) {
    this.data = data;
    this.save();
  }

  resetOptions(appId) {
    this.data.options.wheels[appId] = defaultOptions().wheels[appId];
    this.save();
  }
}

// How big the wheels draw, and how long the note after an action stays.
const WHEEL_SCALE = { small: 0.82, medium: 1, large: 1.2 };
const NOTE_MS = { short: 600, normal: 1100, long: 2000 };

// A backup file: the settings with a small header saying what they are.
function toBackup(data, version) {
  return JSON.stringify({ app: 'HaloCut', kind: 'settings', version, saved: new Date().toISOString(), settings: data }, null, 2);
}

// A backup file's text → settings to use, filled in from the defaults where the file has nothing.
// Throws with a plain message when the file isn't HaloCut settings.
function fromBackup(text) {
  let raw;
  try { raw = JSON.parse(text); } catch { throw new Error("That file isn't HaloCut settings (it isn't JSON)"); }
  const s = raw && raw.app === 'HaloCut' && raw.settings ? raw.settings : raw;
  if (!s || typeof s !== 'object' || !(s.wheel || s.layouts || s.options || s.profiles)) throw new Error("That file isn't HaloCut settings");
  const d = defaults();
  const out = {
    ...d, ...s,
    appearance: { ...d.appearance, ...(s.appearance || {}) },
    general: { ...d.general, ...(s.general || {}) },
    wheel: { ...d.wheel, ...migrateWheel(s.wheel || {}) },
    options: { ...d.options, ...(s.options || {}) },
    orbit: { ...d.orbit, ...(s.orbit || {}) },
    search: { ...d.search, ...(s.search || {}) },
    layouts: { ...d.layouts, ...(s.layouts || {}) },
    profiles: { ...d.profiles, ...(s.profiles || {}) },
  };
  out.paused = false; // never come back paused
  return out;
}

module.exports = { Config, defaults, migrateWheel, toBackup, fromBackup, WHEEL_SCALE, NOTE_MS };
