// Everything the Tool wheel can hold: HaloCut's own tools, Premiere Pro's tools and commands (by their default
// shortcuts), every effect and transition Premiere has, HaloCut's looks and commands, or any keyboard shortcut.
// Also the small edits the settings page makes to a layout. Shared by the app and the settings page.
// © 2026 Imtayz Nayem
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.ToolCatalog = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const GROUPS = [
    { id: 'all', name: 'All' },
    { id: 'halocut', name: 'HaloCut' },
    { id: 'prtools', name: 'Premiere tools' },
    { id: 'prcommands', name: 'Premiere commands' },
    { id: 'appcommands', name: 'App shortcuts' },
    { id: 'effects', name: 'Video effects' },
    { id: 'audio', name: 'Audio effects' },
    { id: 'transitions', name: 'Transitions' },
    { id: 'looks', name: 'Looks' },
    { id: 'keys', name: 'Any shortcut' },
    { id: 'macro', name: 'Macros' },
    { id: 'mylook', name: 'My looks' },
  ];

  // Premiere Pro's own tools, picked with their default keys
  const PR_TOOLS = [
    ['Selection', 'v', 'select'], ['Track Select Forward', 'a', 'forward'], ['Track Select Backward', 'shift+a', 'reverse'],
    ['Ripple Edit', 'b', 'ripple'], ['Rolling Edit', 'n', 'trim'], ['Rate Stretch', 'r', 'clock'], ['Razor', 'c', 'scissors'],
    ['Slip', 'y', 'forward'], ['Slide', 'u', 'forward'], ['Pen', 'p', 'shape'], ['Hand', 'h', 'select'], ['Zoom', 'z', 'zoomIn'], ['Type', 't', 'text'],
  ];
  // Premiere Pro commands by their default shortcuts. For anything else, give it a shortcut in Premiere and use "Any shortcut".
  const PR_COMMANDS = [
    ['Add Edit', 'mod+k', 'scissors'], ['Add Edit to All Tracks', 'shift+mod+k', 'scissorsAll'],
    ['Ripple Trim Previous Edit to Playhead', 'q', 'trim'], ['Ripple Trim Next Edit to Playhead', 'w', 'trim'],
    ['Extend Selected Edit to Playhead', 'e', 'trim'], ['Select Clip at Playhead', 'd', 'select'], ['Match Frame', 'f', 'copy'],
    ['Speed/Duration…', 'mod+r', 'clock'], ['Mark In', 'i', 'flag'], ['Mark Out', 'o', 'flag'], ['Mark Clip', 'x', 'flag'],
    ['Clear In and Out', 'alt+x', 'trash'], ['Go to In', 'shift+i', 'reverse'], ['Go to Out', 'shift+o', 'forward'],
    ['Lift', ';', 'trash'], ['Extract', "'", 'ripple'], ['Insert', ',', 'plus'], ['Overwrite', '.', 'layers'],
    ['Snap in Timeline', 's', 'link'], ['Link', 'mod+l', 'link'], ['Group', 'mod+g', 'layers'], ['Ungroup', 'shift+mod+g', 'layersEach'],
    ['Apply Video Transition', 'mod+d', 'transition'], ['Apply Audio Transition', 'shift+mod+d', 'transition'],
    ['Apply Default Transitions to Selection', 'shift+d', 'transition'], ['Increase Clip Volume', ']', 'opacityFull'],
    ['Decrease Clip Volume', '[', 'opacity'], ['Paste Attributes…', 'alt+mod+v', 'copy'], ['Add Marker', 'm', 'flag'],
    ['Next Edit Point', 'down', 'forward'], ['Previous Edit Point', 'up', 'reverse'], ['Render In to Out', 'return', 'play'],
    ['Export Media…', 'mod+m', 'save'], ['Import…', 'mod+i', 'plus'], ['Zoom to Sequence', '\\', 'fit'],
    ['Maximise Panel', '`', 'fill'], ['Full Screen', 'ctrl+`', 'fill'],
  ];

  const COLORS = ['#ff7a45', '#ff5d7a', '#e5489a', '#c44bd6', '#8f5cf0', '#5a7cf5', '#3fb0e8', '#36c9a8', '#7bc950', '#e9b949'];
  const MAX_TOOLS = 12, MAX_SEGMENTS = 10;

  const keyId = (app, keys) => `custom.${app}.key:${keys}`;
  // A tool that presses keys in the app in front. label: what the wheel shows.
  function keysItem(app, label, keys, group, icon) {
    return { id: keyId(app, keys), label, hint: keysLabel(keys), group: group || 'keys', icon: icon || 'keyboard',
      def: { label, hint: keysLabel(keys), icon: icon || 'keyboard', kind: 'keys', keys, app } };
  }
  function keysLabel(keys, mac = true) {
    const SYM = mac ? { mod: '⌘', ctrl: '⌃', alt: '⌥', shift: '⇧', cmd: '⌘' } : { mod: 'Ctrl+', ctrl: 'Ctrl+', alt: 'Alt+', shift: 'Shift+', cmd: 'Win+' };
    const NAME = { left: '←', right: '→', up: '↑', down: '↓', return: '↩', enter: '↩', space: 'Space', escape: 'Esc', esc: 'Esc', tab: 'Tab',
      equal: '=', minus: '−', comma: ',', period: '.', slash: '/', backspace: '⌫', delete: '⌦', home: 'Home', end: 'End', pageup: 'Page Up', pagedown: 'Page Down' };
    const p = String(keys).split('+'), k = p.pop();
    const order = ['ctrl', 'alt', 'shift', 'mod', 'cmd'];
    return p.sort((a, b) => order.indexOf(a) - order.indexOf(b)).map((m) => SYM[m] || m).join('') + (NAME[k] || k.toUpperCase());
  }

  // A key recorded by the input helper ({ name: 'ArrowLeft', mods: ['shift', 'cmd'] }) → keys HaloCut can press ("shift+mod+left")
  const FROM_HELPER = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down', BracketLeft: '[', BracketRight: ']', Semicolon: ';',
    Quote: "'", Backslash: '\\', Comma: ',', Period: '.', Slash: '/', Backquote: '`', Equal: '=', Minus: '-', Enter: 'return', Space: 'space',
    Tab: 'tab', Escape: 'escape', Backspace: 'backspace', Delete: 'delete', PageUp: 'pageup', PageDown: 'pagedown', Home: 'home', End: 'end' };
  const MOD_ORDER = ['ctrl', 'alt', 'shift', 'mod', 'cmd'];
  function keysFromRecord(got, mac = true) {
    const k = FROM_HELPER[got.name] || String(got.name).toLowerCase();
    const mods = (got.mods || []).map((m) => ((m === 'cmd' && mac) || (m === 'ctrl' && !mac) ? 'mod' : m));
    return mods.sort((a, b) => MOD_ORDER.indexOf(a) - MOD_ORDER.indexOf(b)).concat([k]).join('+');
  }
  // Typed keys ("Cmd + Shift + N") → "shift+mod+n", or '' when HaloCut couldn't press them
  const KEY_OK = /^([a-z0-9;'\\,./`[\]=-]|f([1-9]|1\d|20)|left|right|up|down|return|enter|space|tab|escape|esc|delete|backspace|home|end|pageup|pagedown|equal|minus|comma|period|slash)$/;
  const MOD_WORD = { mod: 'mod', cmd: 'mod', command: 'mod', '⌘': 'mod', ctrl: 'ctrl', control: 'ctrl', '⌃': 'ctrl', alt: 'alt', option: 'alt', opt: 'alt', '⌥': 'alt', shift: 'shift', '⇧': 'shift' };
  function cleanKeys(text) {
    const parts = String(text || '').toLowerCase().replace(/\s+/g, '').split('+').filter(Boolean);
    const k = parts.pop();
    if (!k || !KEY_OK.test(k) || parts.some((p) => !MOD_WORD[p])) return '';
    const mods = [...new Set(parts.map((p) => MOD_WORD[p]))].sort((a, b) => MOD_ORDER.indexOf(a) - MOD_ORDER.indexOf(b));
    return mods.concat([k]).join('+');
  }

  const GROUP_OF = { 'fx:': 'effects', 'afx:': 'audio', 'tr:': 'transitions', 'cut:': 'transitions', 'grade:': 'looks', 'motion:': 'looks', 'cmd:': 'halocut', 'tool:': 'halocut' };
  const ICON_OF = { effects: 'fx', audio: 'sliders', transitions: 'transition', looks: 'palette', halocut: 'dot' };

  // src: { tools (HaloCut's catalog), app: 'PPRO'|'AEFT'|added app id, cores: { command, toolbar, grade, motion, trans } | null,
  //       effects, fps, pack: an added app's shortcuts [[name, keys, icon]] }
  function build(src) {
    const out = [], seen = {}, builtIn = {};
    const push = (it) => { if (!seen[it.id]) { seen[it.id] = 1; out.push(it); } };
    for (const id of Object.keys(src.tools)) {
      const t = src.tools[id];
      if (t.app && t.app !== src.app) continue;
      push({ id, label: t.label, hint: t.hint || (t.kind === 'keys' ? keysLabel(t.keys) : ''), group: 'halocut', icon: t.icon || t.listIcon || 'dot', tint: t.tint, def: null });
      if (t.kind === 'bridge') { builtIn[(t.tool || id) + JSON.stringify(t.args || {})] = 1; builtIn[(t.tool || id) + '|' + t.label.toLowerCase()] = 1; }
    }
    // an app added in Settings: its default shortcuts, when HaloCut knows them ([name, keys, icon])
    (src.pack || []).forEach(([name, keys, icon]) => push(keysItem(src.app, name, keys, 'appcommands', icon)));
    if (src.app !== 'PPRO') return out;
    PR_TOOLS.forEach(([name, keys, icon]) => push(keysItem('PPRO', name, keys, 'prtools', icon)));
    PR_COMMANDS.forEach(([name, keys, icon]) => push(keysItem('PPRO', name, keys, 'prcommands', icon)));
    const K = src.cores;
    if (!K) return out;
    const items = K.command.build({ effects: src.effects || {}, toolbar: K.toolbar, grade: K.grade, motion: K.motion, trans: K.trans, combos: [] });
    const byId = (id) => items.find((i) => i.id === id);
    const ctx = { grade: K.grade, motion: K.motion, trans: K.trans, fps: src.fps || 25, byId };
    for (const it of items) {
      const prefix = (/^\w+:/.exec(it.id) || [''])[0], group = GROUP_OF[prefix];
      if (!group) continue;
      let steps;
      try { steps = K.command.steps(it, ctx); } catch { continue; }
      if (steps.length !== 1) continue;
      const s = steps[0];
      if (builtIn[s.tool + JSON.stringify(s.args || {})] || builtIn[s.tool + '|' + it.name.toLowerCase()]) continue; // HaloCut already has this one
      const icon = ICON_OF[group];
      push({ id: `custom.PPRO.${it.id}`, label: it.name, hint: it.hint || '', group, icon,
        def: { label: it.name, hint: it.hint || '', icon, kind: 'bridge', app: 'PPRO', tool: s.tool, args: s.args || {} } });
    }
    return out;
  }

  // Every word has to be there; names that start with what you typed come first.
  function search(items, query, group, limit = 300) {
    const q = String(query || '').toLowerCase().trim(), words = q.split(/\s+/).filter(Boolean);
    const gname = {}; GROUPS.forEach((g) => { gname[g.id] = g.name.toLowerCase(); });
    const scored = [];
    items.forEach((it, i) => {
      if (group && group !== 'all' && it.group !== group) return;
      const name = it.label.toLowerCase(), hay = `${name} ${(it.hint || '').toLowerCase()} ${gname[it.group] || ''}`;
      if (!words.every((w) => hay.includes(w))) return;
      scored.push([!q ? 0 : name.startsWith(q) ? 0 : name.includes(q) ? 1 : 2, i, it]);
    });
    scored.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    return scored.slice(0, limit).map((s) => s[2]);
  }

  // ---- editing a layout: { name, segments: [{ name, icon, color, main, tools: [id] }] } → { ok, layout, msg }
  const copy = (l) => JSON.parse(JSON.stringify(l));
  const fail = (layout, msg) => ({ ok: false, layout, msg });
  const done = (layout, msg) => ({ ok: true, layout, msg });

  function addTool(layout, seg, id, label) {
    const l = copy(layout), s = l.segments[seg];
    if (!s) return fail(layout, 'No such segment');
    if (s.tools.includes(id)) return fail(layout, `${label || 'That'} is already in ${s.name}`);
    if (s.tools.length >= MAX_TOOLS) return fail(layout, `${s.name} is full (${MAX_TOOLS} tools): start a new segment`);
    s.tools.push(id);
    if (!s.main) s.main = id;
    return done(l, `Added ${label || id} to ${s.name}`);
  }
  function removeTool(layout, seg, idx) {
    const l = copy(layout), s = l.segments[seg];
    if (!s || !s.tools[idx]) return fail(layout, 'Nothing there');
    if (s.tools.length === 1) return fail(layout, 'A segment needs one tool: delete the segment instead');
    const [gone] = s.tools.splice(idx, 1);
    if (s.main === gone) s.main = s.tools[0];
    return done(l, 'Removed');
  }
  function moveTool(layout, seg, idx, dir) {
    const l = copy(layout), t = l.segments[seg] && l.segments[seg].tools, to = idx + dir;
    if (!t || to < 0 || to >= t.length) return fail(layout, '');
    t.splice(to, 0, t.splice(idx, 1)[0]);
    return done(l, '');
  }
  function setMain(layout, seg, id) {
    const l = copy(layout), s = l.segments[seg];
    if (!s || !s.tools.includes(id)) return fail(layout, 'Not in this segment');
    s.main = id;
    return done(l, `Main tool of ${s.name}`);
  }
  function addSegment(layout, name, id, icon) {
    const l = copy(layout);
    if (l.segments.length >= MAX_SEGMENTS) return fail(layout, `The wheel holds ${MAX_SEGMENTS} segments`);
    const used = l.segments.map((s) => s.color);
    const color = COLORS.find((c) => !used.includes(c)) || COLORS[l.segments.length % COLORS.length];
    l.segments.push({ name: String(name || 'New').slice(0, 16), icon: icon || 'dot', color, main: id, tools: [id] });
    return done(l, `New segment: ${l.segments[l.segments.length - 1].name}`);
  }
  function removeSegment(layout, seg) {
    const l = copy(layout);
    if (l.segments.length <= 1) return fail(layout, 'The wheel needs one segment');
    l.segments.splice(seg, 1);
    return done(l, 'Segment deleted');
  }
  function moveSegment(layout, seg, dir) {
    const l = copy(layout), to = seg + dir;
    if (to < 0 || to >= l.segments.length) return fail(layout, '');
    l.segments.splice(to, 0, l.segments.splice(seg, 1)[0]);
    return done(l, '');
  }
  function renameSegment(layout, seg, name) {
    const l = copy(layout), n = String(name || '').trim().slice(0, 16);
    if (!n) return fail(layout, 'Give it a name');
    l.segments[seg].name = n;
    return done(l, '');
  }
  function recolorSegment(layout, seg) {
    const l = copy(layout), s = l.segments[seg];
    s.color = COLORS[(COLORS.indexOf(s.color) + 1) % COLORS.length];
    return done(l, '');
  }

  // Custom tools nothing uses any more (no wheel slot, Options slice or mouse button) are dropped.
  function prune(customTools, config) {
    const used = JSON.stringify({ layouts: config.layouts, extraLayouts: config.extraLayouts, options: config.options, profiles: config.profiles });
    const out = {};
    for (const id of Object.keys(customTools || {})) if (used.includes(JSON.stringify(id))) out[id] = customTools[id];
    return out;
  }

  return { GROUPS, PR_TOOLS, PR_COMMANDS, COLORS, MAX_TOOLS, MAX_SEGMENTS, build, search, keysItem, keysLabel, keysFromRecord, cleanKeys,
    addTool, removeTool, moveTool, setMain, addSegment, removeSegment, moveSegment, renameSegment, recolorSegment, prune };
});
