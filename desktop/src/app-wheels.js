// Any app can have its own Tool wheel, Options wheel and buttons (DaVinci Resolve, Lightroom…): add it in Settings and it
// gets a tab of its own. Apps HaloCut knows start with a wheel of their default shortcuts; any other starts with the basics.
// An added app is told apart by its bundle id while it is in front.
// © 2026 Imtayz Nayem
const TC = require('./tool-catalog');

const PREFIX = 'app.';
const MAX_APPS = 12;
const idFor = (bundleId) => PREFIX + bundleId;
const isAdded = (id) => typeof id === 'string' && id.startsWith(PREFIX);

// Default shortcuts of apps HaloCut knows: [name, keys, icon]. A wheel of the most used ones comes with it.
const PACKS = [
  {
    name: 'DaVinci Resolve',
    bundleIds: ['com.blackmagic-design.DaVinciResolve', 'com.blackmagic-design.DaVinciResolveLite', 'com.blackmagic-design.DaVinciResolveStudio'],
    commands: [
      ['Razor at playhead', 'mod+b', 'scissorsAll'], ['Blade mode', 'b', 'scissors'], ['Selection mode', 'a', 'select'], ['Trim mode', 't', 'trim'],
      ['Ripple delete', 'shift+backspace', 'ripple'], ['Delete, leave gap', 'backspace', 'trash'], ['Enable / disable clip', 'd', 'eyeOff'],
      ['Linked selection', 'shift+mod+l', 'link'], ['Snapping', 'n', 'link'], ['Match frame', 'f', 'copy'],
      ['Add marker', 'm', 'flag'], ['Mark in', 'i', 'flag'], ['Mark out', 'o', 'flag'],
      ['Insert', 'f9', 'plus'], ['Overwrite', 'f10', 'layers'], ['Replace', 'f11', 'layersEach'], ['Place on top', 'f12', 'layers'],
      ['Retime controls', 'mod+r', 'clock'], ['Freeze frame', 'shift+r', 'freeze'], ['Add transition', 'mod+t', 'transition'],
      ['Zoom in', 'mod+=', 'zoomIn'], ['Zoom out', 'mod+-', 'zoomOut'], ['Zoom to fit', 'shift+z', 'fit'],
      ['Edit page', 'shift+4', 'timeline'], ['Media page', 'shift+2', 'layers'], ['Cut page', 'shift+3', 'scissors'], ['Fusion page', 'shift+5', 'shape'],
      ['Color page', 'shift+6', 'palette'], ['Fairlight page', 'shift+7', 'gain'], ['Deliver page', 'shift+8', 'save'],
      ['Serial node', 'alt+s', 'plus'], ['Parallel node', 'alt+p', 'layersEach'], ['Layer node', 'alt+l', 'layers'],
      ['Grab still', 'alt+mod+g', 'copy'], ['Bypass grades', 'shift+d', 'eyeOff'],
      ['Play / stop', 'space', 'play'], ['Undo', 'mod+z', 'undo'], ['Redo', 'shift+mod+z', 'redo'],
    ],
    wheel: [
      ['Edit', 'scissors', ['Razor at playhead', 'Blade mode', 'Selection mode', 'Trim mode', 'Ripple delete', 'Delete, leave gap', 'Enable / disable clip', 'Linked selection', 'Snapping', 'Match frame']],
      ['Marks', 'flag', ['Add marker', 'Mark in', 'Mark out', 'Insert', 'Overwrite', 'Replace', 'Place on top']],
      ['Timing', 'clock', ['Retime controls', 'Freeze frame', 'Add transition', 'Zoom in', 'Zoom out', 'Zoom to fit']],
      ['Pages', 'layers', ['Edit page', 'Media page', 'Cut page', 'Fusion page', 'Color page', 'Fairlight page', 'Deliver page']],
      ['Color', 'palette', ['Serial node', 'Parallel node', 'Layer node', 'Grab still', 'Bypass grades']],
      ['Playback', 'play', ['Play / stop', 'Undo', 'Redo']],
    ],
  },
  {
    name: 'Lightroom Classic',
    bundleIds: ['com.adobe.LightroomClassicCC7'],
    commands: [
      ['Develop', 'd', 'sliders'], ['Crop', 'r', 'fill'], ['Spot removal', 'q', 'dot'], ['Masking', 'shift+w', 'adjust'],
      ['Before / after', '\\', 'flipH'], ['Auto settings', 'mod+u', 'palette'], ['Black & white', 'v', 'opacity'], ['Reset settings', 'shift+mod+r', 'reset'],
      ['Copy settings', 'shift+mod+c', 'copy'], ['Paste settings', 'shift+mod+v', 'copy'], ['Sync settings', 'shift+mod+s', 'layers'],
      ['Paste from previous', 'alt+mod+v', 'copy'], ['Virtual copy', "mod+'", 'layersEach'],
      ['Pick', 'p', 'flag'], ['Reject', 'x', 'trash'], ['Unflag', 'u', 'reset'],
      ['Red label', '6', 'tag'], ['Yellow label', '7', 'tag'], ['Green label', '8', 'tag'], ['Blue label', '9', 'tag'],
      ['No stars', '0', 'tag'], ['1 star', '1', 'tag'], ['2 stars', '2', 'tag'], ['3 stars', '3', 'tag'], ['4 stars', '4', 'tag'], ['5 stars', '5', 'tag'],
      ['Library grid', 'g', 'list'], ['Loupe view', 'e', 'zoomIn'], ['Compare', 'c', 'transition'], ['Survey', 'n', 'layersEach'],
      ['Zoom', 'z', 'zoomIn'], ['Full screen preview', 'f', 'fill'], ['Hide panels', 'tab', 'fill'],
      ['Export', 'shift+mod+e', 'save'], ['Export with previous', 'alt+shift+mod+e', 'save'], ['Import', 'shift+mod+i', 'plus'],
      ['Rotate left', 'mod+[', 'rotateBack'], ['Rotate right', 'mod+]', 'rotate'], ['Undo', 'mod+z', 'undo'], ['Redo', 'shift+mod+z', 'redo'],
    ],
    wheel: [
      ['Develop', 'sliders', ['Develop', 'Crop', 'Spot removal', 'Masking', 'Before / after', 'Auto settings', 'Black & white', 'Reset settings']],
      ['Copy', 'copy', ['Copy settings', 'Paste settings', 'Sync settings', 'Paste from previous', 'Virtual copy']],
      ['Flags', 'flag', ['Pick', 'Reject', 'Unflag', 'Red label', 'Yellow label', 'Green label', 'Blue label']],
      ['Stars', 'tag', ['3 stars', 'No stars', '1 star', '2 stars', '4 stars', '5 stars']],
      ['View', 'fill', ['Library grid', 'Loupe view', 'Compare', 'Survey', 'Zoom', 'Full screen preview', 'Hide panels']],
      ['File', 'save', ['Export', 'Export with previous', 'Import', 'Rotate left', 'Rotate right', 'Undo', 'Redo']],
    ],
  },
];

// Any other app: the shortcuts nearly every Mac app has
const BASICS = {
  commands: [
    ['Undo', 'mod+z', 'undo'], ['Redo', 'shift+mod+z', 'redo'], ['Cut', 'mod+x', 'scissors'], ['Copy', 'mod+c', 'copy'], ['Paste', 'mod+v', 'copy'],
    ['Select all', 'mod+a', 'select'], ['Save', 'mod+s', 'save'], ['Zoom in', 'mod+=', 'zoomIn'], ['Zoom out', 'mod+-', 'zoomOut'],
    ['Full screen', 'ctrl+mod+f', 'fill'], ['Find', 'mod+f', 'dot'], ['New', 'mod+n', 'plus'],
  ],
  wheel: [
    ['Edit', 'copy', ['Undo', 'Redo', 'Cut', 'Copy', 'Paste', 'Select all']],
    ['File', 'save', ['Save', 'New', 'Find']],
    ['View', 'fill', ['Zoom in', 'Zoom out', 'Full screen']],
  ],
};

const packFor = (bundleId) => PACKS.find((p) => p.bundleIds.includes(bundleId)) || null;

// The starter wheel for an app, and the shortcut tools it uses (they go into customTools, like ones you add yourself)
function starter(app) {
  const pack = packFor(app.bundleId) || BASICS;
  const byName = {}, customTools = {};
  pack.commands.forEach(([name, keys, icon]) => { byName[name] = TC.keysItem(app.id, name, keys, 'appcommands', icon); });
  const segments = pack.wheel.map(([name, icon, names], i) => {
    const ids = names.map((n) => {
      const it = byName[n];
      if (!it) throw new Error(`${app.name}: no command called ${n}`);
      customTools[it.id] = it.def;
      return it.id;
    });
    return { name, icon, color: TC.COLORS[i % TC.COLORS.length], main: ids[0], tools: ids };
  });
  return { layout: { name: `${app.name} · Default`, segments }, customTools };
}

// The commands HaloCut knows for an app, for the picker: [name, keys, icon]
const commandsFor = (bundleId) => (packFor(bundleId) || BASICS).commands;

// Premiere Pro and After Effects have their own tabs already
const ADOBE_EDITORS = /premiere|after effects/i;

// data: the settings · app: { bundleId, name, path } → { ok, msg, id, patch } (patch: what to save; nothing changes otherwise)
function add(data, app) {
  if (!app || !app.bundleId) return { ok: false, msg: "That app has no bundle id, so HaloCut can't tell when it's in front" };
  const id = idFor(app.bundleId), apps = data.apps || [];
  if (ADOBE_EDITORS.test(app.name || '') || ADOBE_EDITORS.test(app.bundleId)) return { ok: false, msg: `${app.name} has its own tab already` };
  if (apps.some((a) => a.id === id)) return { ok: true, id, msg: `${app.name} is added already`, patch: null };
  if (apps.length >= MAX_APPS) return { ok: false, msg: `Up to ${MAX_APPS} apps: remove one first` };
  const entry = { id, bundleId: app.bundleId, name: app.name || app.bundleId, path: app.path || '' };
  const s = starter(entry);
  const wheels = (data.options && data.options.wheels) || {};
  const copy = (x) => JSON.parse(JSON.stringify(x));
  return {
    ok: true, id,
    msg: `${entry.name} added: ${packFor(app.bundleId) ? 'a wheel of its own shortcuts' : 'a basic wheel'} to start from`,
    patch: {
      apps: apps.concat([entry]),
      layouts: { ...data.layouts, [id]: s.layout },
      customTools: { ...(data.customTools || {}), ...s.customTools },
      options: { ...data.options, wheels: { ...wheels, [id]: copy(wheels.other || { rings: [[], [], []] }) } },
      profiles: { ...data.profiles, [id]: copy((data.profiles || {}).other || {}) },
    },
  };
}

// Everything that app had: its tab, wheels, buttons and the shortcut tools only it used
function remove(data, id) {
  const app = (data.apps || []).find((a) => a.id === id);
  if (!app) return { ok: false, msg: 'Not an added app' };
  const drop = (o) => { const out = { ...(o || {}) }; delete out[id]; return out; };
  const customTools = {};
  Object.entries(data.customTools || {}).forEach(([k, t]) => { if (t.app !== id) customTools[k] = t; });
  return {
    ok: true, msg: `${app.name} removed`,
    patch: {
      apps: data.apps.filter((a) => a.id !== id),
      layouts: drop(data.layouts), customTools,
      options: { ...data.options, wheels: drop(data.options && data.options.wheels) },
      profiles: drop(data.profiles),
    },
  };
}

// The added app in front, by bundle id, or null
function match(apps, bundleId) {
  if (!bundleId) return null;
  const a = (apps || []).find((x) => x.bundleId === bundleId);
  return a ? a.id : null;
}

module.exports = { PACKS, BASICS, MAX_APPS, idFor, isAdded, packFor, starter, commandsFor, add, remove, match };
