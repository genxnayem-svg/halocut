// Macros: one wheel slot that runs several tools, one after another (cut, ripple delete, add a dissolve…).
// A macro is a custom tool: { label, hint, icon, kind: 'macro', app, steps: [{ id, label, def }] }.
// Each step carries its own tool (def), so the macro keeps working when that tool leaves the wheel.
// Shared by the app and the settings page.
// © 2026 Imtayz Nayem
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Macros = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const MAX_STEPS = 8;
  const GAP_MS = 180; // between steps, so the editor finishes one before the next

  const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 24) || 'macro';

  // name: what the wheel shows · steps: [{ id, label, def }] (def: null for a built-in tool) → { ok, msg, id, def }
  function make(app, name, steps, existing) {
    const label = String(name || '').trim().slice(0, 24);
    if (!label) return { ok: false, msg: 'Give the macro a name' };
    if (!steps || steps.length < 2) return { ok: false, msg: 'A macro needs two steps or more' };
    if (steps.length > MAX_STEPS) return { ok: false, msg: `Up to ${MAX_STEPS} steps` };
    if (steps.some((s) => s.def && s.def.kind === 'macro')) return { ok: false, msg: "A macro can't run another macro" };
    let id = `custom.${app}.macro:${slug(label)}`, n = 2;
    while (existing && existing[id]) id = `custom.${app}.macro:${slug(label)}-${n++}`;
    const clean = steps.map((s) => ({ id: s.id, label: s.label, def: s.def || null }));
    return { ok: true, msg: `Macro "${label}" made`, id,
      def: { label, hint: `Macro · ${clean.map((s) => s.label).join(' → ')}`, icon: 'layersEach', kind: 'macro', app, steps: clean } };
  }

  // Runs the steps in order and stops at the first that fails.
  // exec(step) → { ok, msg } · wait(ms) → promise. Returns { ok, msg, done }.
  async function run(macro, exec, wait) {
    const steps = (macro && macro.steps) || [];
    let done = 0;
    for (const step of steps) {
      let r;
      try { r = await exec(step); } catch (e) { r = { ok: false, msg: e.message }; }
      if (!r || r.ok === false) return { ok: false, done, msg: `Stopped at step ${done + 1} (${step.label}): ${(r && r.msg) || 'it failed'}` };
      done++;
      if (done < steps.length && wait) await wait(GAP_MS);
    }
    return { ok: true, done, msg: `${done} steps done` };
  }

  return { MAX_STEPS, GAP_MS, make, run };
});
