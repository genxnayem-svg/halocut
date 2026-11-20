// Your own looks on the wheel: the Lumetri Color of a clip you graded, saved under a name. Picking it puts the same
// colour on the selected clips. A look is a custom tool that runs pr.gradeLook with the saved values.
// Shared by the app and the settings page.
// © 2026 Imtayz Nayem
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Presets = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 24) || 'look';

  // read: what pr.gradeRead answered ({ here: { name }, values, had }) → { ok, msg, id, def }
  function fromGrade(name, read, existing) {
    const label = String(name || '').trim().slice(0, 24);
    if (!label) return { ok: false, msg: 'Give the look a name' };
    if (!read || !read.here) return { ok: false, msg: 'Park the playhead on the clip you graded' };
    const values = {};
    Object.keys(read.values || {}).forEach((k) => { if (typeof read.values[k] === 'number' && isFinite(read.values[k])) values[k] = read.values[k]; });
    if (!read.had || !Object.keys(values).length) return { ok: false, msg: `${read.here.name} has no Lumetri Color to save` };
    let id = `custom.PPRO.look:${slug(label)}`, n = 2;
    while (existing && existing[id]) id = `custom.PPRO.look:${slug(label)}-${n++}`;
    return { ok: true, id, msg: `Look "${label}" saved from ${read.here.name}`,
      def: { label, hint: `Your look · from ${read.here.name}`, icon: 'palette', kind: 'bridge', app: 'PPRO', tool: 'pr.gradeLook', args: { values }, own: 'look' } };
  }

  return { fromGrade };
});
