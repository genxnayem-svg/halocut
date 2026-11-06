// HaloCut desktop app: tray/menu-bar app that owns the Tool wheel, mouse buttons
// and the bridge into Premiere Pro and After Effects.
const path = require('path');
const fs = require('fs');
const os = require('os');
const { execFile } = require('child_process');
const {
  app, BrowserWindow, Tray, Menu, ipcMain, screen, shell, nativeImage, systemPreferences, clipboard, dialog, Notification,
} = require('electron');

const { Bridge } = require('./bridge');
const { Config, toBackup, fromBackup, WHEEL_SCALE, NOTE_MS } = require('./config');
const { createInput, FrontApp, sendKeys, normMods, IS_MAC } = require('./input');
const { tools } = require('./tools');
const { AppsHelper } = require('./apps');
const G = require('./wheel-geometry');
const OG = require('./options-geometry');
const commandKeys = require('./command-keys');
const TC = require('./tool-catalog');
const QS = require('./quick-search');
const AppWheels = require('./app-wheels');
const Updates = require('./updates');

const PRODUCT = 'HaloCut';
const COPYRIGHT = '© 2026 Imtayz Nayem';
const EXTENSION_ID = 'com.samistudio.halocut';
const WHEEL_SIZE = 2 * (Math.max(G.R.tools + 48, OG.R.rings[2][1] + 24));
const TAP_MS = 250;
const general = () => config.data.general || {};
const wheelScale = () => WHEEL_SCALE[general().wheelSize] || 1;
const noteMs = () => NOTE_MS[general().noteLength] || NOTE_MS.normal;

let config, bridge, input, front, tray, wheelWin, settingsWin, searchWin, apps;
let commandShortcuts = [], commandBusy = false; // HaloCut Command's shortcuts, saved by its panel
let inputError = null;
let inputReady = false;
const seenButtons = new Set(); // mouse buttons pressed since start (Devices page)
let wheel = null; // state of the open wheel

if (!app.requestSingleInstanceLock()) app.quit();

// ---------------------------------------------------------------- windows

function createWheelWindow() {
  wheelWin = new BrowserWindow({
    width: WHEEL_SIZE, height: WHEEL_SIZE, show: false, frame: false, transparent: true,
    resizable: false, movable: false, focusable: false, skipTaskbar: true, hasShadow: false,
    alwaysOnTop: true, fullscreenable: false, type: IS_MAC ? 'panel' : 'toolbar',
    backgroundColor: '#00000000',
    webPreferences: { preload: path.join(__dirname, 'preload.js') },
  });
  wheelWin.setAlwaysOnTop(true, 'screen-saver');
  wheelWin.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  wheelWin.setIgnoreMouseEvents(true);
  wheelWin.loadFile(path.join(__dirname, '../renderer/wheel.html'));
}

// Quick search: a panel that takes the typing while the editor stays the active app, so focus goes straight back
const SEARCH_SIZE = { width: 640, height: 470 };
function createSearchWindow() {
  searchWin = new BrowserWindow({
    ...SEARCH_SIZE, show: false, frame: false, transparent: true, resizable: false, movable: false, skipTaskbar: true,
    hasShadow: false, alwaysOnTop: true, fullscreenable: false, focusable: true, type: IS_MAC ? 'panel' : 'toolbar',
    backgroundColor: '#00000000',
    webPreferences: { preload: path.join(__dirname, 'preload.js') },
  });
  searchWin.setAlwaysOnTop(true, 'screen-saver');
  searchWin.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  searchWin.on('blur', () => closeSearch()); // clicked back into the editor
  searchWin.loadFile(path.join(__dirname, '../renderer/search.html'));
}

function openSettings() {
  if (settingsWin && !settingsWin.isDestroyed()) { settingsWin.show(); settingsWin.focus(); return; }
  settingsWin = new BrowserWindow({
    width: 1120, height: 720, minWidth: 900, minHeight: 600, title: PRODUCT,
    titleBarStyle: IS_MAC ? 'hiddenInset' : 'default', backgroundColor: '#17131b',
    webPreferences: { preload: path.join(__dirname, 'preload.js') },
  });
  settingsWin.loadFile(path.join(__dirname, '../renderer/settings.html'));
  if (IS_MAC) app.dock.show();
  settingsWin.on('closed', () => { settingsWin = null; if (IS_MAC) app.dock.hide(); });
}

function pushStatus() {
  if (settingsWin && !settingsWin.isDestroyed()) settingsWin.webContents.send('status', statusSnapshot());
  updateTray();
}

function statusSnapshot() {
  return {
    bridge: bridge.status(),
    frontApp: front.name,
    frontAppId: front.appId(),
    frontAppName: (() => { const a = (config.data.apps || []).find((x) => x.id === front.appId()); return a ? a.name : ''; })(),
    accessibility: IS_MAC ? systemPreferences.isTrustedAccessibilityClient(false) && inputReady : true,
    inputError,
    canBlock: input ? input.canBlock() : false,
    seenButtons: [...seenButtons],
    version: app.getVersion(),
    paused: config.data.paused,
    extensionInstalled: fs.existsSync(extensionTarget()),
  };
}

// ---------------------------------------------------------------- tray

function updateTray() {
  if (!tray) return;
  const s = bridge.status();
  const dot = (id) => (s[id] ? '●' : '○');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: `${PRODUCT} ${app.getVersion()}`, enabled: false },
    { label: COPYRIGHT, enabled: false },
    { label: `${dot('PPRO')} Premiere Pro bridge`, enabled: false },
    { label: `${dot('AEFT')} After Effects bridge`, enabled: false },
    { type: 'separator' },
    ...(update && update.newer ? [{ label: `Download ${PRODUCT} ${update.version}…`, click: () => shell.openExternal(update.download) }, { type: 'separator' }] : []),
    { label: 'Open settings', click: openSettings },
    { label: config.data.paused ? 'Resume controls' : 'Pause controls', click: togglePause },
    { label: 'Check for updates', click: () => checkUpdates(true) },
    { type: 'separator' },
    { label: `Quit ${PRODUCT}`, role: 'quit' },
  ]));
  if (IS_MAC) tray.setTitle(config.data.paused ? ' paused' : '');
}

function togglePause() {
  config.update({ paused: !config.data.paused });
  if (wheel) closeWheel();
  updateBlocking();
  pushStatus();
}

// ---------------------------------------------------------------- the wheel

// A tool by id: HaloCut's own, or one added on the settings page
const toolDef = (id) => tools[id] || (config.data.customTools || {})[id];
const allTools = () => ({ ...tools, ...(config.data.customTools || {}) });

function resolvedLayout(appId) {
  const layout = config.data.layouts[appId];
  if (!layout) return null;
  const info = (id) => {
    const t = toolDef(id) || { label: id, icon: 'dot' };
    return { id, label: t.label, icon: t.icon, tint: t.tint, hint: t.hint };
  };
  return {
    name: layout.name,
    segments: layout.segments.map((s) => ({
      name: s.name, icon: s.icon, color: s.color, main: info(s.main), tools: s.tools.map(info),
    })),
  };
}

// mode "tool": the Tool wheel (Premiere Pro / After Effects). mode "options": the Options wheel (any app).
function optionsFor(appId) {
  const w = config.data.options.wheels;
  return w[appId] || w.other;
}

function openWheel(source, mode = 'tool', ready = null) {
  if (config.data.paused || wheel) return;
  const appId = front.appId();
  const layout = mode === 'orbit' ? ready : mode === 'tool' ? config.data.layouts[appId] : optionsFor(appId);
  if (!layout) return; // the Tool wheel lives in Premiere Pro and After Effects only

  // the window grows or shrinks with the wheel size picked on the General page
  const scale = wheelScale(), size = Math.round(WHEEL_SIZE * scale);
  const p = screen.getCursorScreenPoint();
  const area = screen.getDisplayNearestPoint(p).bounds;
  const x = Math.round(Math.min(Math.max(p.x - size / 2, area.x), area.x + area.width - size));
  const y = Math.round(Math.min(Math.max(p.y - size / 2, area.y), area.y + area.height - size));

  wheel = { mode, appId, layout, source, cx: p.x, cy: p.y, winX: x, winY: y, openSeg: -1, ringStep: 0, scale,
    hit: { seg: -1, tool: -1, ring: -1, slot: -1 }, openedAt: Date.now(), sticky: false };
  wheelWin.setBounds({ x, y, width: size, height: size });
  wheelWin.webContents.send('wheel:open', {
    mode, app: appId, center: { x: p.x - x, y: p.y - y }, scale, size, animation: general().animation || 'smooth',
    layout: mode === 'tool' ? resolvedLayout(appId) : mode === 'orbit' ? layout : null,
    rings: mode === 'options' ? layout.rings : null,
    accent: (config.data.appearance || {}).accent,
    glass: !!(config.data.appearance || {}).glass,
  });
  wheelWin.showInactive();
  if (mode === 'options') updateBlocking(); // middle click steps out a ring while it is open
}

// The Orbit switch needs the live list of apps first; tabs arrive after the wheel is up.
let orbitPending = null;
async function openOrbit(source) {
  if (config.data.paused || wheel || orbitPending || !apps) return;
  const pending = orbitPending = { source, released: false };
  const layout = await apps.layout(config.data.orbit);
  orbitPending = null;
  if (!layout || !layout.segments.length) return;
  openWheel(source, 'orbit', layout);
  if (!wheel) return;
  if (pending.released) { wheel.sticky = true; wheelWin.setIgnoreMouseEvents(false); } // tapped: stay open
  if (config.data.orbit.showTabs) {
    const changed = await apps.addTabs(layout);
    if (changed && wheel && wheel.layout === layout) wheelWin.webContents.send('wheel:layout', layout);
  }
}

function inCentre(h) { return wheel.mode === 'options' ? h.ring < 0 : h.seg < 0; }

function trackPointer(force = false) {
  if (!wheel || wheel.closing) return;
  const p = screen.getCursorScreenPoint();
  const dx = (p.x - wheel.cx) / wheel.scale, dy = (p.y - wheel.cy) / wheel.scale; // the wheel's own size, whatever it draws at
  if (wheel.mode === 'options') {
    const h = OG.hit(dx, dy, wheel.layout.rings, wheel.ringStep);
    if (force || h.ring !== wheel.hit.ring || h.slot !== wheel.hit.slot) {
      wheel.hit = h;
      wheelWin.webContents.send('wheel:hover', { ring: h.ring, slot: h.slot, ringStep: wheel.ringStep });
    }
    return;
  }
  const h = G.hit(dx, dy, wheel.layout, wheel.openSeg);
  if (h.seg >= 0) wheel.openSeg = h.seg;
  if (h.seg !== wheel.hit.seg || h.tool !== wheel.hit.tool) {
    wheel.hit = h;
    wheelWin.webContents.send('wheel:hover', { seg: h.seg, tool: h.tool, openSeg: wheel.openSeg });
  }
}

function closeWheel() {
  if (!wheel) return;
  const wasOptions = wheel.mode === 'options';
  wheel = null;
  wheelWin.setIgnoreMouseEvents(true);
  wheelWin.webContents.send('wheel:close');
  wheelWin.hide();
  if (wasOptions) updateBlocking();
}

// Trigger released (or a click while the wheel is stuck open).
function releaseWheel() {
  if (!wheel || wheel.closing) return;
  trackPointer();
  const quick = Date.now() - wheel.openedAt < TAP_MS;
  if (!wheel.sticky && quick && inCentre(wheel.hit) && config.data.wheel.tapToStick) {
    wheel.sticky = true; // stays open; the next click picks
    wheelWin.setIgnoreMouseEvents(false);
    return;
  }
  const appId = wheel.appId;
  if (wheel.mode === 'orbit') {
    const item = G.resolve(wheel.hit, wheel.layout);
    closeWheel();
    if (item) apps.switchTo(item.id);
    return;
  }
  if (wheel.mode === 'options') {
    const slot = OG.resolve(wheel.hit, wheel.layout.rings);
    if (!slot) { closeWheel(); return; }
    wheel.closing = true;
    closeWheel(); // the slot acts on the app in front, so get out of its way first
    runAction(slot.action, appId);
    return;
  }
  const toolId = G.resolve(wheel.hit, wheel.layout);
  if (!toolId) { closeWheel(); return; }
  wheel.closing = true;
  runTool(toolId, appId, true);
}

function insideWheelWindow() {
  const p = screen.getCursorScreenPoint();
  const b = wheelWin.getBounds();
  return p.x >= b.x && p.y >= b.y && p.x < b.x + b.width && p.y < b.y + b.height;
}

// ---------------------------------------------------------------- running tools

async function runTool(toolId, appId, fromWheel = false) {
  const t = toolDef(toolId);
  if (!t) return finish({ ok: false, msg: `Unknown tool ${toolId}` });

  if (t.kind === 'keys') {
    if (fromWheel) closeWheel();
    // Give the editor its focus back before typing into it.
    await new Promise((r) => setTimeout(r, 40));
    try { sendKeys(t.keys); return { ok: true, msg: t.label }; }
    catch (e) { return { ok: false, msg: e.message }; }
  }

  const target = t.app || appId;
  const res = await bridge.run(target, t.tool || toolId, t.args || {}, t.label);
  return finish(res);

  function finish(r) {
    if (fromWheel) {
      // the note by the pointer can be switched off on the General page (a failure still shows)
      if (general().notes === false && r.ok) { closeWheel(); return r; }
      wheelWin.webContents.send('wheel:toast', { ok: r.ok, label: t ? t.label : toolId, msg: r.msg });
      setTimeout(() => { if (wheel && wheel.closing) closeWheel(); }, noteMs());
    }
    return r;
  }
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// Pastes text, then puts the clipboard back the way it was.
async function typeText(text) {
  const before = clipboard.readText();
  clipboard.writeText(text);
  await wait(30);
  sendKeys('mod+v');
  await wait(400);
  clipboard.writeText(before);
}

function launch(target) {
  if (/^https?:\/\//i.test(target)) return shell.openExternal(target);
  const expanded = target.replace(/^~(?=\/|$)/, os.homedir());
  if (expanded.includes('/') || expanded.includes('\\')) return shell.openPath(expanded);
  if (IS_MAC) return new Promise((r) => execFile('open', ['-a', expanded], () => r()));
  return shell.openPath(expanded); // TODO(windows): look up apps by name
}

// Runs a button / Options wheel action. Returns { ok, msg }.
async function runAction(action, appId) {
  if (!action || action.type === 'none') return { ok: true };
  try {
    switch (action.type) {
      case 'tool': return await runTool(action.id, appId);
      case 'keys': await wait(30); sendKeys(action.keys); return { ok: true };
      case 'text': await typeText(action.text || ''); return { ok: true };
      case 'launch': await launch(action.target || ''); return { ok: true };
      case 'macro':
        for (const step of action.steps || []) {
          const r = await runAction(step, appId);
          if (r && r.ok === false) return r;
          await wait(step.delayMs || 60);
        }
        return { ok: true };
      default: return { ok: false, msg: `Unknown action ${action.type}` };
    }
  } catch (e) {
    return { ok: false, msg: e.message };
  }
}

// A HaloCut Command shortcut: its Premiere steps, one after another (a combo stops at the first that fails).
// What happened shows in the Command panel, which hears every result from the bridge.
async function runCommandShortcut(sc) {
  if (commandBusy) return;
  commandBusy = true;
  try { return await commandKeys.runSteps(sc, (tool, args, name) => bridge.run('PPRO', tool, args, name, 20000)); }
  finally { commandBusy = false; }
}

// Everything the Tool wheel's picker offers. For Premiere Pro that includes every effect and transition it has
// (asked for while it runs, remembered for when it doesn't) and HaloCut's looks and commands from the extension.
const EFFECTS_CACHE = () => path.join(app.getPath('userData'), 'premiere-effects.json');
function commandCores() {
  const dir = path.join(extensionSource('extension'), 'client');
  const load = (f) => require(path.join(dir, f));
  return { command: load('command-core.js'), toolbar: load('toolbar-core.js'), grade: load('grade-core.js'), motion: load('motion-core.js'), trans: load('trans-core.js') };
}
// ask: false = only what is remembered (instant), for Quick search; true also asks Premiere for its current list
async function toolCatalog(appId, ask = true) {
  let effects = null, fps = 25, live = false, cores = null, note = '';
  if (appId === 'PPRO') {
    try { effects = JSON.parse(fs.readFileSync(EFFECTS_CACHE(), 'utf8')); } catch { /* not listed yet */ }
    if (ask && bridge.isConnected('PPRO')) {
      const r = await bridge.run('PPRO', 'pr.listEffects', {}, 'Effect list for the Tool wheel', 15000);
      if (r.ok && r.data) { effects = r.data; live = true; try { fs.writeFileSync(EFFECTS_CACHE(), JSON.stringify(effects)); } catch { /* keep going */ } }
      const c = await bridge.run('PPRO', 'pr.capsInfo', {}, 'Frame rate for the Tool wheel', 5000);
      if (c.ok && c.data && c.data.fps) fps = c.data.fps;
    }
    try { cores = commandCores(); } catch (e) { note = `HaloCut looks unavailable: ${e.message}`; }
    if (!effects) note = 'Open Premiere Pro (with HaloCut installed in it) to list every effect and transition it has.';
    else if (!live) note = 'Effects as Premiere Pro listed them last time. Open Premiere to refresh the list.';
  }
  const added = (config.data.apps || []).find((a) => a.id === appId);
  if (added) return { items: TC.build({ tools, app: appId, pack: AppWheels.commandsFor(added.bundleId) }), groups: TC.GROUPS, note: '', live: false };
  return { items: TC.build({ tools, app: appId, cores, effects, fps }), groups: TC.GROUPS, note, live };
}

// ---------------------------------------------------------------- updates

// Every copy of HaloCut asks GitHub for the newest release (desktop/package.json "repository"), a minute after it
// starts and every 6 hours. A newer one: a notification once per version, and a Download item in the menu bar.
const UPDATE_EVERY = 6 * 60 * 60 * 1000;
let update = null; // { newer, version, download, page, notes } from the last check
async function checkUpdates(asked = false) {
  let pkg = {};
  try { pkg = require(path.join(__dirname, '../package.json')); } catch { /* no repository then */ }
  const r = await Updates.check({ repo: Updates.repoOf(pkg.repository), current: app.getVersion() });
  if (r.ok) update = r;
  updateTray();
  if (r.ok && r.newer && (asked || config.data.updateToldFor !== r.version)) {
    config.update({ updateToldFor: r.version }); // once per version, unless you ask
    if (Notification.isSupported()) {
      const n = new Notification({ title: `${PRODUCT} ${r.version} is ready`, body: 'Click to download it. Install it over this one; your settings stay.' });
      n.on('click', () => shell.openExternal(r.download));
      n.show();
    }
  } else if (asked && Notification.isSupported()) {
    new Notification({ title: PRODUCT, body: r.ok ? `You have the newest version (${app.getVersion()})` : `Couldn't check for updates: ${r.msg}` }).show();
  }
  return r;
}

// ---------------------------------------------------------------- Quick search

const APP_NAMES = { PPRO: 'Premiere Pro', AEFT: 'After Effects' };
const searchCache = {}; // appId → { items, byId, note, at }
let search = null; // { appId } while the window is up
const searchOpen = () => !!(searchWin && !searchWin.isDestroyed() && searchWin.isVisible());

// The catalog to search: what is remembered opens at once; Premiere's own list is asked for in the background
// (at most every 10 minutes) and is there the next time.
async function searchItems(appId) {
  const keep = (c) => {
    const byId = {};
    c.items.forEach((it) => { byId[it.id] = it; });
    return (searchCache[appId] = { items: c.items, byId, note: c.note, at: Date.now() });
  };
  const have = searchCache[appId] || keep(await toolCatalog(appId, false));
  if (Date.now() - have.at > 10 * 60 * 1000 || (appId === 'PPRO' && !have.asked && bridge.isConnected('PPRO'))) {
    have.asked = true;
    toolCatalog(appId, true).then((c) => { keep(c).asked = true; }).catch(() => { /* try again next time */ });
  }
  return have;
}

async function openSearch(appId, extra = {}) {
  if (config.data.paused || !searchWin || searchWin.isDestroyed()) return;
  const c = await searchItems(appId);
  search = { appId };
  const area = screen.getDisplayNearestPoint(screen.getCursorScreenPoint()).workArea;
  searchWin.setBounds(QS.place(area, SEARCH_SIZE));
  searchWin.webContents.send('search:open', {
    app: appId, appName: APP_NAMES[appId] || appId, items: c.items.map((it) => QS.slim(it, it.def || toolDef(it.id))),
    recent: (config.data.search || {}).recent || [], note: c.note, error: extra.error || '', query: extra.query || '',
  });
  searchWin.show();
  searchWin.focus();
  updateBlocking(); // while it is up, keys go to the box, not to shortcuts
}

function closeSearch() {
  if (!searchOpen()) return;
  searchWin.hide();
  search = null;
  updateBlocking();
}

// Runs a pick on the selected clips. Window first out of the way (keys go to the editor); a failure brings it back
// with what went wrong, so you can select a clip and press Return again.
async function runSearchPick({ id, query }) {
  const appId = search ? search.appId : front.appId();
  const c = searchCache[appId], it = c && c.byId[id];
  closeSearch();
  if (!it) return { ok: false, msg: 'That is gone from the list: search again' };
  const def = it.def || toolDef(it.id);
  if (!def) return { ok: false, msg: `Unknown tool ${it.id}` };
  config.update({ search: { ...config.data.search, recent: QS.addRecent((config.data.search || {}).recent, it.id) } });
  let r;
  try {
    if (def.kind === 'keys') { await wait(80); sendKeys(def.keys); r = { ok: true, msg: it.label }; }
    else r = await bridge.run(def.app || appId, def.tool || it.id, def.args || {}, def.label || it.label, 20000);
  } catch (e) { r = { ok: false, msg: e.message }; }
  if (!r.ok) openSearch(appId, { error: `${it.label}: ${r.msg}`, query });
  return r;
}

// ---------------------------------------------------------------- input wiring

const PERMISSION_OFF = /(Accessibility|Input Monitoring) is off/;

const sameInput = (a, b) => !!a && !!b && a.kind === b.kind && a.name === b.name;
const sameMods = (a, b) => normMods(a.mods).join() === normMods(b.mods).join();
const isAdobe = (appId) => appId === 'PPRO' || appId === 'AEFT';
// Premiere Pro, After Effects and every app added in Settings have a Tool wheel
const hasToolWheel = (appId) => (isAdobe(appId) || AppWheels.isAdded(appId)) && !!config.data.layouts[appId];

function profileFor(appId) {
  return config.data.profiles[appId] || config.data.profiles.other || {};
}

// What the helper should swallow right now, so the app under the pointer never sees it.
function updateBlocking() {
  if (!input) return;
  if (config.data.paused) { input.setBlocking([]); return; }
  const appId = front.appId();
  const list = [];
  const add = (t) => { if (t && !list.some((x) => sameInput(x, t) && sameMods(x, t))) list.push(t); };
  const searchTriggers = (config.data.search || {}).triggers || [];
  if (searchOpen()) { searchTriggers.forEach(add); input.setBlocking(list); return; } // typing goes to the search box
  if (isAdobe(appId)) searchTriggers.forEach(add);
  if (hasToolWheel(appId)) config.data.wheel.triggers.forEach(add);
  config.data.options.triggers.forEach(add); // the Options wheel works everywhere
  if (apps) config.data.orbit.triggers.forEach(add);
  if (wheel && wheel.mode === 'options') add({ kind: 'mouse', name: 'middle', mods: [], delayMs: 0 });
  if (appId === 'PPRO') commandShortcuts.forEach((sc) => add(sc.trigger));
  for (const [name, action] of Object.entries(profileFor(appId))) {
    if (action && action.type !== 'none') add({ kind: 'mouse', name, mods: [], delayMs: 0 });
  }
  input.setBlocking(list);
}

let recordWaiter = null;

function recordInput() {
  if (recordWaiter) recordWaiter(null);
  return new Promise((resolve) => {
    const timer = setTimeout(() => finish(null), 15000);
    function finish(value) {
      clearTimeout(timer);
      recordWaiter = null;
      input.cancelRecord();
      resolve(value);
    }
    recordWaiter = finish;
    input.record();
  });
}

function wireInput() {
  const helper = app.isPackaged ? path.join(process.resourcesPath, 'ew-input') : path.join(__dirname, '../build/ew-input');
  input = createInput(helper);
  let holdTimer = null, holdSource = null;

  input.on('ready', () => { inputReady = true; inputError = null; updateBlocking(); pushStatus(); });
  let toldAboutPermission = false;
  input.on('error', (e) => {
    inputReady = false; inputError = e.message; pushStatus();
    // macOS won't let HaloCut see the mouse and keys (usually after a new install): no wheel can open, so say so once
    if (!toldAboutPermission && PERMISSION_OFF.test(e.message)) { toldAboutPermission = true; openSettings(); }
  });
  input.on('recorded', (t) => recordWaiter && recordWaiter(t));
  input.on('recordCancelled', () => recordWaiter && recordWaiter(null));
  input.on('move', () => { if (wheel) trackPointer(); });

  input.on('press', (ev) => {
    if (ev.kind === 'mouse' && !ev.repeat) {
      seenButtons.add(ev.name);
      if (settingsWin && !settingsWin.isDestroyed()) settingsWin.webContents.send('input', ev);
    }
    if (config.data.paused || ev.repeat) return;
    const isSearchKey = () => ((config.data.search || {}).triggers || []).some((t) => t && sameInput(t, ev) && sameMods(t, ev));
    if (searchOpen()) { if (isSearchKey()) closeSearch(); return; } // the box has the keyboard
    if (wheel && ev.kind === 'key' && ev.name === 'Escape') { closeWheel(); return; }
    if (wheel && wheel.sticky && ev.kind === 'mouse' && ev.name === 'left') {
      if (insideWheelWindow()) releaseWheel(); else closeWheel();
      return;
    }
    if (wheel && wheel.mode === 'options' && ev.kind === 'mouse' && ev.name === 'middle') {
      wheel.ringStep = (wheel.ringStep + 1) % 3; // middle click steps out to the next ring
      trackPointer(true);
      return;
    }
    if (wheel) return;

    const appId = front.appId();
    const matches = (list) => list.find((t) => t && sameInput(t, ev) && sameMods(t, ev));
    if (isAdobe(appId) && isSearchKey()) { openSearch(appId); return; }
    const toolTrig = hasToolWheel(appId) && matches(config.data.wheel.triggers);
    const optTrig = !toolTrig && matches(config.data.options.triggers);
    const orbitTrig = !toolTrig && !optTrig && apps && matches(config.data.orbit.triggers);
    const trig = toolTrig || optTrig || orbitTrig;
    if (trig) {
      const source = { kind: ev.kind, name: ev.name };
      const mode = toolTrig ? 'tool' : optTrig ? 'options' : 'orbit';
      const open = () => (mode === 'orbit' ? openOrbit(source) : openWheel(source, mode));
      clearTimeout(holdTimer);
      holdSource = source;
      if (trig.delayMs > 0) holdTimer = setTimeout(open, trig.delayMs);
      else open();
      return;
    }
    const sc = appId === 'PPRO' && commandKeys.find(commandShortcuts, ev);
    if (sc) { runCommandShortcut(sc); return; }
    if (ev.kind !== 'mouse' || ev.mods.length) return;
    const action = profileFor(appId)[ev.name];
    if (!action || action.type === 'none') return;
    if (action.type === 'wheel') { openWheel({ kind: 'mouse', name: ev.name }); return; }
    if (action.type === 'options') { openWheel({ kind: 'mouse', name: ev.name }, 'options'); return; }
    if (action.type === 'orbit') { openOrbit({ kind: 'mouse', name: ev.name }); return; }
    runAction(action, appId);
  });

  input.on('release', (ev) => {
    if (wheel && sameInput(wheel.source, ev)) { releaseWheel(); return; }
    if (orbitPending && sameInput(orbitPending.source, ev)) { orbitPending.released = true; return; }
    if (sameInput(holdSource, ev)) { clearTimeout(holdTimer); holdSource = null; } // tapped before the delay
  });

  try { input.start(); }
  catch (e) { inputError = e.message; }
}

// ---------------------------------------------------------------- extension install

// The Adobe extension that ships with HaloCut: the bridge (Premiere Pro + After Effects).
const EXTENSIONS = [{ id: EXTENSION_ID, folder: 'extension' }];

function extensionSource(folder) {
  return app.isPackaged ? path.join(process.resourcesPath, folder) : path.join(__dirname, '../..', folder);
}

function extensionsDir() {
  return IS_MAC
    ? path.join(os.homedir(), 'Library/Application Support/Adobe/CEP/extensions')
    : path.join(process.env.APPDATA || '', 'Adobe/CEP/extensions');
}

function extensionTarget(id = EXTENSION_ID) { return path.join(extensionsDir(), id); }

function allowUnsignedPanels() {
  // Unsigned (development) panels need PlayerDebugMode. A signed .zxp build won't need this.
  for (const v of [9, 10, 11, 12, 13]) {
    if (IS_MAC) execFile('defaults', ['write', `com.adobe.CSXS.${v}`, 'PlayerDebugMode', '1']);
    else execFile('reg', ['add', `HKCU\\Software\\Adobe\\CSXS.${v}`, '/v', 'PlayerDebugMode', '/t', 'REG_SZ', '/d', '1', '/f']);
  }
}

function installExtension() {
  fs.mkdirSync(extensionsDir(), { recursive: true });
  for (const { id, folder } of EXTENSIONS) {
    const src = extensionSource(folder), dst = extensionTarget(id);
    if (!fs.existsSync(src)) continue;
    fs.rmSync(dst, { recursive: true, force: true });
    if (app.isPackaged) fs.cpSync(src, dst, { recursive: true });
    else fs.symlinkSync(src, dst, 'junction'); // development: edits show up after reopening the panel
  }
  allowUnsignedPanels();
  pushStatus();
  return { ok: true, msg: `Installed. Restart Premiere Pro / After Effects: the bridge starts by itself.` };
}

// ---------------------------------------------------------------- IPC

function wireIpc() {
  ipcMain.handle('settings:get', () => ({
    config: config.data, tools: allTools(), geometry: G.R, status: statusSnapshot(), platform: process.platform,
  }));
  ipcMain.handle('settings:set', (_e, patch) => { config.update(patch); updateBlocking(); pushStatus(); return config.data; });
  ipcMain.handle('settings:record', () => recordInput());
  ipcMain.handle('settings:checkUpdates', () => checkUpdates(true));
  ipcMain.handle('search:run', (_e, pick) => runSearchPick(pick || {}));
  ipcMain.handle('search:close', () => closeSearch());
  ipcMain.handle('settings:quit', () => app.quit());
  ipcMain.handle('settings:orbitPreview', async () => {
    if (!apps) return null;
    const layout = await apps.layout(config.data.orbit);
    if (layout && config.data.orbit.showTabs) await apps.addTabs(layout);
    return layout;
  });
  // Orbit switch: the apps open now (to pin or hide) and the apps installed (to pin)
  ipcMain.handle('settings:orbitApps', async () => {
    if (!apps) return null;
    const r = await apps.running();
    if (!r) return null;
    const open = await Promise.all(r.apps.map(async (a) => ({ name: a.name, bundleId: a.bundleId, path: a.path, image: await apps.icon(a.path) })));
    const icons = {};
    for (const p of config.data.orbit.pinned || []) icons[p.bundleId] = await apps.icon(p.path);
    return { open, icons };
  });
  ipcMain.handle('settings:installedApps', () => (apps ? apps.installed() : []));
  ipcMain.handle('settings:resetOptions', (_e, appId) => { config.resetOptions(appId); return config.data; });
  ipcMain.handle('settings:runSlot', async (_e, action, appId) => {
    if (action && action.type === 'keys') return { ok: true, msg: 'Keystrokes run in the app in front: try it from the wheel' };
    return runAction(action, appId);
  });
  ipcMain.handle('settings:resetLayout', (_e, appId) => {
    const added = (config.data.apps || []).find((a) => a.id === appId);
    if (!added) { config.resetLayout(appId); return config.data; }
    const s = AppWheels.starter(added); // an added app goes back to the wheel it started with
    config.update({ layouts: { ...config.data.layouts, [appId]: s.layout }, customTools: { ...(config.data.customTools || {}), ...s.customTools } });
    return config.data;
  });
  // An app of your own: its tab, Tool wheel, Options wheel and buttons. app: { bundleId, name, path }
  ipcMain.handle('settings:addApp', (_e, appInfo) => {
    const r = AppWheels.add(config.data, appInfo);
    if (r.patch) config.update(r.patch);
    front.setApps(config.data.apps);
    updateBlocking(); pushStatus();
    return { ok: r.ok, msg: r.msg, id: r.id, config: config.data };
  });
  ipcMain.handle('settings:removeApp', (_e, id) => {
    const r = AppWheels.remove(config.data, id);
    if (r.patch) config.update(r.patch);
    front.setApps(config.data.apps);
    updateBlocking(); pushStatus();
    return { ok: r.ok, msg: r.msg, config: config.data };
  });
  ipcMain.handle('settings:layout', (_e, appId) => resolvedLayout(appId));
  ipcMain.handle('settings:catalog', (_e, appId) => toolCatalog(appId));
  ipcMain.handle('settings:install', () => {
    try { return installExtension(); } catch (e) { return { ok: false, msg: e.message }; }
  });
  ipcMain.handle('settings:test', (_e, toolId, appId) => runTool(toolId, appId));
  ipcMain.handle('settings:permissions', () => {
    if (IS_MAC) {
      // the pane for whichever permission is still missing: Accessibility first, then Input Monitoring
      const ax = systemPreferences.isTrustedAccessibilityClient(true);
      const pane = ax && /Input Monitoring/.test(inputError || '') ? 'Privacy_ListenEvent' : 'Privacy_Accessibility';
      shell.openExternal(`x-apple.systempreferences:com.apple.preference.security?${pane}`);
    }
  });
  ipcMain.handle('settings:openConfig', () => shell.showItemInFolder(config.file));
  // General page
  ipcMain.handle('settings:loginItem', (_e, on) => {
    if (on !== undefined) { app.setLoginItemSettings({ openAtLogin: !!on, openAsHidden: true }); config.update({ general: { ...general(), openAtLogin: !!on } }); }
    return { openAtLogin: app.getLoginItemSettings().openAtLogin, packaged: app.isPackaged };
  });
  ipcMain.handle('settings:export', async () => {
    const r = await dialog.showSaveDialog(settingsWin, { title: 'Save HaloCut settings', defaultPath: path.join(app.getPath('documents'), `HaloCut settings ${new Date().toISOString().slice(0, 10)}.json`),
      filters: [{ name: 'HaloCut settings', extensions: ['json'] }] });
    if (r.canceled || !r.filePath) return { ok: false, msg: 'Not saved' };
    fs.writeFileSync(r.filePath, toBackup(config.data, app.getVersion()));
    return { ok: true, msg: `Saved to ${path.basename(r.filePath)}` };
  });
  ipcMain.handle('settings:import', async () => {
    const r = await dialog.showOpenDialog(settingsWin, { title: 'Load HaloCut settings', properties: ['openFile'], filters: [{ name: 'HaloCut settings', extensions: ['json'] }] });
    if (r.canceled || !r.filePaths.length) return { ok: false, msg: 'Nothing loaded' };
    try {
      config.replace(fromBackup(fs.readFileSync(r.filePaths[0], 'utf8')));
    } catch (e) { return { ok: false, msg: e.message }; }
    if (wheel) closeWheel();
    updateBlocking(); pushStatus();
    return { ok: true, msg: `Loaded ${path.basename(r.filePaths[0])}`, config: config.data };
  });
  ipcMain.handle('settings:reset', () => {
    if (wheel) closeWheel();
    config.reset();
    updateBlocking(); pushStatus();
    return { ok: true, msg: 'Everything is back to how HaloCut starts', config: config.data };
  });
  ipcMain.on('wheel:click', () => { if (wheel && wheel.sticky) releaseWheel(); });
}

// The app was called EditWheel before 0.2: bring its settings along once.
function carryOverSettings() {
  const now = path.join(app.getPath('userData'), 'config.json');
  const before = path.join(app.getPath('appData'), 'EditWheel', 'config.json');
  if (!fs.existsSync(now) && fs.existsSync(before)) {
    fs.mkdirSync(path.dirname(now), { recursive: true });
    fs.copyFileSync(before, now);
  }
}

// ---------------------------------------------------------------- start

app.whenReady().then(() => {
  if (IS_MAC) app.dock.hide();
  carryOverSettings();
  config = new Config(app.getPath('userData'));
  bridge = new Bridge();
  bridge.on('change', () => {
    pushStatus();
    // Premiere's panel is up: have its whole effect list ready for the first ⌥Space
    if (bridge.isConnected('PPRO')) searchItems('PPRO').catch(() => { /* asked again on the next ⌥Space */ });
  });
  bridge.on('error', (e) => { inputError = `Bridge port busy: ${e.message}`; pushStatus(); });
  bridge.start();

  front = new FrontApp();
  front.setApps(config.data.apps);
  front.on('change', () => { updateBlocking(); pushStatus(); });
  front.start();
  commandKeys.watch((list) => { commandShortcuts = list; updateBlocking(); });

  const trayIcon = nativeImage.createFromPath(path.join(__dirname, '../assets/trayTemplate.png'));
  trayIcon.setTemplateImage(true);
  tray = new Tray(trayIcon);
  tray.setToolTip(PRODUCT);
  updateTray();

  if (IS_MAC) {
    const appsHelper = app.isPackaged ? path.join(process.resourcesPath, 'ew-apps') : path.join(__dirname, '../build/ew-apps');
    try { apps = new AppsHelper(appsHelper); apps.start(); }
    catch (e) { apps = null; console.warn(e.message); } // TODO(windows): Orbit switch helper
  }

  createWheelWindow();
  createSearchWindow();
  wireIpc();
  wireInput();
  if (general().showOnStart !== false) openSettings();
  setTimeout(() => checkUpdates(), 60 * 1000);
  setInterval(() => checkUpdates(), UPDATE_EVERY);
});

app.on('second-instance', openSettings);
app.on('window-all-closed', (e) => e.preventDefault()); // keep running in the tray
app.on('before-quit', () => {
  try { input && input.stop(); } catch { /* already stopped */ }
  if (apps) apps.stop();
});
