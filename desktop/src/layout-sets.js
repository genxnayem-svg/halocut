// Several Tool wheel layouts per app: the first is config.layouts[app] (as before), the others are
// config.extraLayouts[app]. Scrolling with the wheel open steps through them; the one used last opens next time
// (config.activeLayout[app]). Shared by the app and the settings page. © 2026 Imtayz Nayem
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.LayoutSets = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const MAX_LAYOUTS = 6;
  const copy = (x) => JSON.parse(JSON.stringify(x));

  // Every layout of an app, the main one first
  function list(config, app) {
    const main = config.layouts && config.layouts[app];
    if (!main) return [];
    return [main].concat((config.extraLayouts && config.extraLayouts[app]) || []);
  }

  // The layout the wheel opens on
  function active(config, app) {
    const n = list(config, app).length, i = (config.activeLayout && config.activeLayout[app]) || 0;
    return i >= 0 && i < n ? i : 0;
  }

  // dir: +1 next, -1 previous; goes round
  const step = (count, idx, dir) => (count < 2 ? 0 : (idx + (dir > 0 ? 1 : -1) + count) % count);

  // What to save so layout `idx` of `app` becomes `layout`
  function set(config, app, idx, layout) {
    if (idx === 0) return { layouts: { ...config.layouts, [app]: layout } };
    const extras = ((config.extraLayouts && config.extraLayouts[app]) || []).slice();
    extras[idx - 1] = layout;
    return { extraLayouts: { ...(config.extraLayouts || {}), [app]: extras } };
  }

  // A new layout: a copy of layout `from`, to change. → { ok, msg, index, patch }
  function add(config, app, from) {
    const all = list(config, app);
    if (!all.length) return { ok: false, msg: 'No Tool wheel for this app' };
    if (all.length >= MAX_LAYOUTS) return { ok: false, msg: `Up to ${MAX_LAYOUTS} layouts: delete one first` };
    const src = copy(all[from] || all[0]);
    const base = String(all[0].name || 'Layout').split(' · ')[0];
    let n = all.length + 1, name = `${base} · Layout ${n}`;
    while (all.some((l) => l.name === name)) name = `${base} · Layout ${++n}`;
    src.name = name;
    const extras = ((config.extraLayouts && config.extraLayouts[app]) || []).concat([src]);
    return { ok: true, msg: `${name} added: a copy to change. Scroll with the wheel open to switch`, index: all.length,
      patch: { extraLayouts: { ...(config.extraLayouts || {}), [app]: extras } } };
  }

  // The first layout stays (Reset puts it back to the default instead)
  function remove(config, app, idx) {
    const extras = ((config.extraLayouts && config.extraLayouts[app]) || []).slice();
    if (idx < 1 || idx > extras.length) return { ok: false, msg: 'The first layout stays: use Reset to put it back as it came' };
    const [gone] = extras.splice(idx - 1, 1);
    const act = active(config, app);
    return { ok: true, msg: `${gone.name} deleted`,
      patch: { extraLayouts: { ...(config.extraLayouts || {}), [app]: extras },
        activeLayout: { ...(config.activeLayout || {}), [app]: act === idx ? 0 : act > idx ? act - 1 : act } } };
  }

  function rename(config, app, idx, name) {
    const all = list(config, app), l = all[idx];
    const clean = String(name || '').trim().slice(0, 40);
    if (!l || !clean) return { ok: false, msg: '' };
    return { ok: true, msg: '', patch: set(config, app, idx, { ...l, name: clean }) };
  }

  // The short name shown on tabs and in the wheel: "Premiere Pro · Classic" → "Classic"
  const shortName = (layout) => String((layout && layout.name) || '').split(' · ').pop();

  return { MAX_LAYOUTS, list, active, step, set, add, remove, rename, shortName };
});
