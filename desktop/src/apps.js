// Orbit switch: open apps, their windows and browser tabs, as a Tool-wheel-shaped layout.
// The ew-apps helper lists and raises apps on macOS and Windows; browser tabs (AppleScript) are macOS only.
const { spawn, execFile } = require('child_process');
const readline = require('readline');
const fs = require('fs');

const MAX_APPS = 12;
const MAX_ITEMS = 16; // windows or tabs fanned out per app
const COLORS = ['#ff7a45', '#ff5d7a', '#e5489a', '#c44bd6', '#8f5cf0', '#5a7cf5', '#3fb0e8', '#36c9a8', '#7cc84a', '#e8b33a', '#ef8a3d', '#d9536f'];

// AppleScript that lists tabs as "window<TAB>tab<TAB>title" lines, per browser.
const BROWSERS = {
  'com.google.Chrome': { app: 'Google Chrome', list: 'title of t', select: (w, t) => `set active tab index of window ${w} to ${t}\nset index of window ${w} to 1` },
  'com.microsoft.edgemac': { app: 'Microsoft Edge', list: 'title of t', select: (w, t) => `set active tab index of window ${w} to ${t}\nset index of window ${w} to 1` },
  'com.brave.Browser': { app: 'Brave Browser', list: 'title of t', select: (w, t) => `set active tab index of window ${w} to ${t}\nset index of window ${w} to 1` },
  'com.apple.Safari': { app: 'Safari', list: 'name of t', select: (w, t) => `set current tab of window ${w} to tab ${t} of window ${w}\nset index of window ${w} to 1` },
};

function osascript(script, timeoutMs = 1500) {
  return new Promise((resolve) => {
    execFile('osascript', ['-e', script], { timeout: timeoutMs }, (err, out) => resolve(err ? null : out));
  });
}

async function browserTabs(bundleId) {
  const b = BROWSERS[bundleId];
  if (!b) return null;
  const script = `
    set out to ""
    tell application "${b.app}"
      set wi to 0
      repeat with w in windows
        set wi to wi + 1
        set ti to 0
        repeat with t in tabs of w
          set ti to ti + 1
          set out to out & wi & tab & ti & tab & (${b.list}) & linefeed
        end repeat
      end repeat
    end tell
    return out`;
  const out = await osascript(script);
  if (out === null) return null; // not allowed yet, or the browser did not answer
  return out.split('\n').filter(Boolean).map((line) => {
    const [w, t, ...title] = line.split('\t');
    return { window: Number(w), tab: Number(t), title: title.join('\t') || 'Tab' };
  });
}

function selectTab(bundleId, w, t) {
  const b = BROWSERS[bundleId];
  return osascript(`tell application "${b.app}"\n${b.select(w, t)}\nactivate\nend tell`);
}

// "Adobe Premiere Pro 2026" → "Premiere Pro": short enough to sit in a slice
function shortName(name) {
  const n = String(name || 'App').replace(/^(Adobe|Microsoft|Google) (?=\S)/, '').replace(/ (19|20)\d\d$/, '').trim();
  return n || String(name || 'App');
}

// Which apps sit on the wheel, in order. prefs: { pinned: [{ bundleId, name, path }], hidden: [bundleId], showOthers }
// Pinned apps first, always in the same place, open or not. Then the other open apps (unless switched off), most
// recent first, with the app in front last (so the first of them is the one you used before it, like ⌘ Tab).
// Hidden apps never. → [{ app }] for open apps, [{ pin }] for pinned ones that aren't open.
function choose(running, prefs = {}) {
  const pinned = prefs.pinned || [], hidden = new Set((prefs.hidden || []).map((h) => (typeof h === 'string' ? h : h && h.bundleId)));
  const open = new Map();
  running.forEach((a) => { if (a.bundleId && !open.has(a.bundleId)) open.set(a.bundleId, a); });
  const out = [], pinnedIds = new Set();
  pinned.forEach((p) => {
    if (!p || !p.bundleId || pinnedIds.has(p.bundleId)) return;
    pinnedIds.add(p.bundleId);
    out.push(open.has(p.bundleId) ? { app: open.get(p.bundleId), pinned: true } : { pin: p, pinned: true });
  });
  if (prefs.showOthers !== false) {
    const rest = running.filter((a) => !pinnedIds.has(a.bundleId) && !hidden.has(a.bundleId));
    rest.filter((a) => !a.front).concat(rest.filter((a) => a.front)).forEach((a) => out.push({ app: a }));
  }
  return out.slice(0, MAX_APPS);
}

function windowsHint(a) {
  if (a.front) return 'Already in front';
  const n = a.windows.length;
  return n ? `${n} window${n === 1 ? '' : 's'}` : 'No windows open';
}

class AppsHelper {
  constructor(helperPath) {
    this.helperPath = helperPath;
    this.pending = new Map();
    this.nextId = 1;
    this.icons = new Map(); // path -> data URL
  }

  start() {
    if (!fs.existsSync(this.helperPath)) throw new Error(`Apps helper missing: ${this.helperPath}`);
    this.proc = spawn(this.helperPath, [], { stdio: ['pipe', 'pipe', 'inherit'], windowsHide: true });
    readline.createInterface({ input: this.proc.stdout }).on('line', (line) => {
      let m;
      try { m = JSON.parse(line); } catch { return; }
      const p = this.pending.get(m.id);
      if (p) { this.pending.delete(m.id); clearTimeout(p.timer); p.resolve(m); }
    });
    this.proc.on('exit', () => {
      this.proc = null;
      if (!this.stopped) setTimeout(() => this.start(), 1000);
    });
  }

  request(cmd, extra = {}, timeoutMs = 1500) {
    if (!this.proc) return Promise.resolve(null);
    const id = this.nextId++;
    return new Promise((resolve) => {
      const timer = setTimeout(() => { this.pending.delete(id); resolve(null); }, timeoutMs);
      this.pending.set(id, { resolve, timer });
      this.proc.stdin.write(JSON.stringify({ id, cmd, ...extra }) + '\n');
    });
  }

  async icon(path) {
    if (!path) return null;
    if (this.icons.has(path)) return this.icons.get(path);
    const r = await this.request('icon', { path, size: 64 });
    const url = r && r.png ? `data:image/png;base64,${r.png}` : null;
    this.icons.set(path, url);
    return url;
  }

  // Open apps, straight from the helper (most recently used first)
  async running() {
    const r = await this.request('list');
    return r && r.apps ? r : null;
  }

  // Apps installed on this Mac, with icons, for pinning: [{ name, bundleId, path, image }]
  async installed() {
    const r = await this.request('installed', {}, 5000);
    if (!r || !r.apps) return [];
    for (const a of r.apps) a.image = await this.icon(a.path);
    return r.apps;
  }

  // Layout for the wheel: segments are apps, their tools are windows. Fast: no browser calls.
  async layout(prefs = {}) {
    const r = await this.running();
    if (!r) return null;
    const segments = await Promise.all(choose(r.apps, prefs).map(async (c, i) => {
      const color = COLORS[i % COLORS.length];
      if (c.pin) {
        const p = c.pin;
        return { name: shortName(p.name), image: await this.icon(p.path), color, bundleId: p.bundleId, badge: 0, dim: true, pinned: true,
          main: { id: `launch:${p.path}`, label: p.name, hint: 'Not open · let go to open it' }, tools: [] };
      }
      const a = c.app;
      return {
        name: shortName(a.name), image: await this.icon(a.path), color, bundleId: a.bundleId, pinned: !!c.pinned,
        badge: a.windows.length > 1 ? a.windows.length : 0,
        main: { id: `app:${a.pid}`, label: a.name, hint: windowsHint(a) },
        tools: a.windows.slice(0, MAX_ITEMS).map((w, wi) => ({
          id: `win:${a.pid}:${wi}`, label: w.title || `${a.name} window ${wi + 1}`, hint: w.minimized ? 'Minimised' : a.name,
        })),
      };
    }));
    return { name: 'Orbit switch', segments, trusted: r.trusted };
  }

  // Swaps each browser's windows for its tabs. Slower (asks the browsers), so it runs after the wheel is up.
  async addTabs(layout) {
    let changed = false;
    await Promise.all(layout.segments.map(async (seg) => {
      if (!BROWSERS[seg.bundleId]) return;
      const tabs = await browserTabs(seg.bundleId);
      if (!tabs || !tabs.length) return;
      seg.tools = tabs.slice(0, MAX_ITEMS).map((t) => ({
        id: `tab:${seg.bundleId}:${t.window}:${t.tab}`, label: t.title, hint: `${seg.name} · window ${t.window}`,
      }));
      seg.badge = tabs.length > 1 ? tabs.length : 0;
      changed = true;
    }));
    return changed;
  }

  async switchTo(id) {
    if (id.startsWith('launch:')) return this.request('launch', { path: id.slice(7) }, 8000);
    const [kind, a, b, c] = id.split(':');
    if (kind === 'app') return this.request('activate', { pid: Number(a) });
    if (kind === 'win') return this.request('raise', { pid: Number(a), index: Number(b) });
    if (kind === 'tab') return selectTab(a, Number(b), Number(c));
    return null;
  }

  stop() { this.stopped = true; if (this.proc) this.proc.kill(); }
}

module.exports = { AppsHelper, choose, shortName, MAX_APPS };
