// One Tool wheel layout as a file, to give to another editor or move to another Mac. The file holds the layout and
// the tools you added that it uses (shortcuts, effects, macros, looks). Loading it adds a new layout; nothing is replaced.
// © 2026 Imtayz Nayem
const KINDS = { keys: 1, bridge: 1, macro: 1 };
const copy = (x) => JSON.parse(JSON.stringify(x));
const idsOf = (layout) => [...new Set(layout.segments.flatMap((s) => [s.main].concat(s.tools)))];

function toFile(layout, customTools, app, appName, version) {
  const tools = {};
  idsOf(layout).forEach((id) => { if ((customTools || {})[id]) tools[id] = customTools[id]; });
  return JSON.stringify({ app: 'HaloCut', kind: 'wheel', version, saved: new Date().toISOString(), forApp: app, appName, layout, tools }, null, 2);
}

function cleanDef(d, app) {
  if (!d || typeof d !== 'object' || !KINDS[d.kind] || typeof d.label !== 'string' || !d.label) return null;
  if (d.app && d.app !== app) return null;
  if (d.kind === 'keys' && typeof d.keys !== 'string') return null;
  if (d.kind === 'bridge' && !/^(pr|ae)\.[\w.]+$/.test(d.tool || '')) return null;
  if (d.kind === 'macro') {
    if (!Array.isArray(d.steps) || d.steps.length < 2 || d.steps.length > 8) return null;
    if (d.steps.some((s) => !s || typeof s.id !== 'string' || (s.def && (s.def.kind === 'macro' || !cleanDef(s.def, app))))) return null;
  }
  return copy(d);
}

// text: the file · app: the tab it is loaded into · builtIn: HaloCut's own tools by id
// → { ok, msg, layout, customTools } (customTools: the ones to add; ones you already have are left as they are)
function fromFile(text, app, builtIn, existing) {
  let raw;
  try { raw = JSON.parse(text); } catch { return { ok: false, msg: "That file isn't a HaloCut wheel (it isn't JSON)" }; }
  if (!raw || raw.app !== 'HaloCut') return { ok: false, msg: "That file isn't a HaloCut wheel" };
  if (raw.kind === 'settings') return { ok: false, msg: 'That file is all of HaloCut\'s settings: load it on the General page' };
  if (raw.kind !== 'wheel' || !raw.layout) return { ok: false, msg: "That file isn't a HaloCut wheel" };
  if (raw.forApp !== app) return { ok: false, msg: `That wheel is for ${raw.appName || raw.forApp}: open that app's tab first` };
  const segs = raw.layout.segments;
  if (!Array.isArray(segs) || !segs.length || segs.length > 10) return { ok: false, msg: 'That wheel has no segments HaloCut can use' };
  const customTools = {}, missing = [];
  const layout = { name: String(raw.layout.name || 'Shared wheel').slice(0, 40), segments: [] };
  for (const s of segs) {
    if (!s || !Array.isArray(s.tools)) return { ok: false, msg: 'That wheel file is damaged' };
    const tools = [];
    for (const id of s.tools.slice(0, 12)) {
      if (typeof id !== 'string') continue;
      if ((builtIn || {})[id] || (existing || {})[id]) { tools.push(id); continue; }
      const def = cleanDef((raw.tools || {})[id], app);
      if (!def || !id.startsWith('custom.')) { missing.push(id); continue; }
      customTools[id] = def; tools.push(id);
    }
    if (!tools.length) continue;
    layout.segments.push({ name: String(s.name || 'Segment').slice(0, 16), icon: typeof s.icon === 'string' ? s.icon : 'dot',
      color: /^#[0-9a-f]{6}$/i.test(s.color || '') ? s.color : '#ff7a45', main: tools.includes(s.main) ? s.main : tools[0], tools });
  }
  if (!layout.segments.length) return { ok: false, msg: 'None of the tools in that wheel exist in this HaloCut' };
  const n = layout.segments.reduce((a, s) => a + s.tools.length, 0);
  return { ok: true, layout, customTools,
    msg: `${layout.name} loaded: ${layout.segments.length} segments, ${n} tools${missing.length ? ` · ${missing.length} left out (not in this HaloCut)` : ''}` };
}

module.exports = { toFile, fromFile };
