// HaloCut Quick search (⌥Space in Premiere Pro / After Effects): type an effect, transition, look or command, press
// Return, and it goes on the selected clips. The ranking, the tabs and the recent list, shared by the app and the window.
// © 2026 Imtayz Nayem
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./tool-catalog'));
  else root.QuickSearch = factory(root.ToolCatalog);
})(typeof self !== 'undefined' ? self : this, function (TC) {
  // The tabs along the top: each is one or more catalog groups
  const TABS = [
    { id: 'all', name: 'All', groups: null },
    { id: 'effects', name: 'Effects', groups: ['effects'] },
    { id: 'transitions', name: 'Transitions', groups: ['transitions'] },
    { id: 'audio', name: 'Audio', groups: ['audio'] },
    { id: 'looks', name: 'Looks', groups: ['looks'] },
    { id: 'premiere', name: 'Premiere', groups: ['prtools', 'prcommands'] },
    { id: 'halocut', name: 'HaloCut', groups: ['halocut', 'keys'] },
  ];
  const GROUP_TAG = { effects: 'Effect', audio: 'Audio effect', transitions: 'Transition', looks: 'Look', prtools: 'Premiere tool',
    prcommands: 'Premiere', halocut: 'HaloCut', keys: 'Shortcut' };
  const MAX_RECENT = 12;
  const DEFAULT_TRIGGER = { kind: 'key', name: 'Space', mods: ['alt'], delayMs: 0 };

  // Only the tabs that have something in them (After Effects has no effect list yet)
  function tabsFor(items) {
    const have = {};
    items.forEach((it) => { have[it.group] = 1; });
    return TABS.filter((t) => !t.groups || t.groups.some((g) => have[g]));
  }

  // What to show for a query. Nothing typed: what you used last, then the rest. Typed: every word must match, names
  // that start with it first, and among those the ones you used lately go first.
  function rank(items, query, opts = {}) {
    const tab = TABS.find((t) => t.id === opts.tab) || TABS[0];
    const recent = opts.recent || [], limit = opts.limit || 80;
    const pool = tab.groups ? items.filter((it) => tab.groups.includes(it.group)) : items;
    const q = String(query || '').trim().toLowerCase();
    const used = {};
    recent.forEach((id, i) => { used[id] = i + 1; });
    if (!q) {
      const first = recent.map((id) => pool.find((it) => it.id === id)).filter(Boolean);
      return first.concat(pool.filter((it) => !used[it.id])).slice(0, limit);
    }
    const found = TC.search(pool, q, 'all', 2000);
    const head = (it) => (it.label.toLowerCase().startsWith(q) ? 0 : 1);
    return found
      .map((it, i) => [head(it), used[it.id] ? used[it.id] : MAX_RECENT + 1, i, it])
      .sort((a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2])
      .slice(0, limit)
      .map((x) => x[3]);
  }

  function addRecent(list, id) {
    return [id].concat((list || []).filter((x) => x !== id)).slice(0, MAX_RECENT);
  }

  // Where the window goes: across the middle of the screen the pointer is on, a little above centre
  function place(area, size) {
    return {
      x: Math.round(area.x + (area.width - size.width) / 2),
      y: Math.round(area.y + Math.max(40, area.height * 0.2)),
      width: size.width, height: size.height,
    };
  }

  // HaloCut's own shortcuts to an effect or a transition (Gaussian Blur, Lumetri Color…) are listed with Premiere's
  const GROUP_BY_TOOL = {
    'pr.effect': (a) => (a && a.kind === 'audio' ? 'audio' : 'effects'), 'pr.transition': () => 'transitions', 'ae.effect': () => 'effects',
  };
  function groupOf(it, def) {
    const f = def && GROUP_BY_TOOL[def.tool];
    return f ? f(def.args) : it.group;
  }

  // The bits of a catalog item the window needs (what runs stays in the app). def: what it runs, when it isn't on the item.
  const slim = (it, def) => ({ id: it.id, label: it.label, hint: it.hint || '', group: groupOf(it, def || it.def), icon: it.icon, tint: it.tint });

  return { TABS, GROUP_TAG, MAX_RECENT, DEFAULT_TRIGGER, tabsFor, rank, addRecent, place, slim, groupOf };
});
