/* HaloCut Flow (After Effects) — transitions between layers.
 * Cut transitions (shared with HaloCut Transitions in Premiere, from trans-core.js) move both layers at the cut.
 * Overlap transitions reveal the later layer over the earlier one with one of AE's own transition effects.
 * © 2026 Imtayz Nayem */
(function (root) {
  // fx: the AE effect · prop: which of its controls is keyed (by index, so any language works) · from → to
  var OVERLAPS = [
    { id: "crossfade", name: "Crossfade", fx: "ADBE Geometry2", prop: { names: ["Opacity"], index: 9 }, from: 0, to: 100 },
    { id: "linear", name: "Linear wipe", dirs: true, fx: "ADBE Linear Wipe", prop: { names: ["Transition Completion"], index: 1 }, from: 100, to: 0,
      set: function (o) { return [{ names: ["Wipe Angle"], index: 2, value: { left: 270, right: 90, up: 0, down: 180 }[o.dir || "left"] }, { names: ["Feather"], index: 3, value: 60 }]; } },
    { id: "radial", name: "Radial wipe", fx: "ADBE Radial Wipe", prop: { names: ["Transition Completion"], index: 1 }, from: 100, to: 0,
      set: function () { return [{ names: ["Feather"], index: 5, value: 40 }]; } },
    { id: "iris", name: "Iris open", fx: "ADBE Iris Wipe", prop: { names: ["Outer Radius"], index: 3 }, from: 0, to: "diagonal",
      set: function () { return [{ names: ["Iris Points"], index: 2, value: 32 }, { names: ["Feather"], index: 7, value: 30 }]; } },
    { id: "blinds", name: "Blinds", dirs: true, fx: "ADBE Venetian Blinds", prop: { names: ["Transition Completion"], index: 1 }, from: 100, to: 0,
      set: function (o) { return [{ names: ["Direction"], index: 2, value: { left: 90, right: 270, up: 0, down: 180 }[o.dir || "left"] }, { names: ["Width"], index: 3, value: 60 }]; } },
    { id: "dissolve", name: "Block dissolve", fx: "ADBE Block Dissolve", prop: { names: ["Transition Completion"], index: 1 }, from: 100, to: 0,
      set: function () { return [{ names: ["Block Width"], index: 2, value: 24 }, { names: ["Block Height"], index: 3, value: 24 }, { names: ["Feather"], index: 4, value: 8 }]; } },
  ];
  var NAME = "HaloCut Flow · ";

  function overlap(id) { for (var i = 0; i < OVERLAPS.length; i++) if (OVERLAPS[i].id === id) return OVERLAPS[i]; return null; }

  // Layers into pairs at each cut, earliest first: [{ a, b }] by layer index
  function pairs(layers) {
    var ls = layers.slice().sort(function (x, y) { return x.inPoint - y.inPoint || y.index - x.index; }), out = [];
    for (var i = 0; i + 1 < ls.length; i++) out.push({ a: ls[i].index, b: ls[i + 1].index, cut: ls[i + 1].inPoint, gap: ls[i + 1].inPoint - ls[i].outPoint });
    return out;
  }

  // What the host needs for an overlap transition on layer B.
  function overlapJob(id, o) {
    var t = overlap(id), w = o.width || 1920, h = o.height || 1080;
    return { id: t.id, name: NAME + t.name, fx: t.fx, prop: t.prop, from: t.from, to: t.to === "diagonal" ? Math.ceil(Math.sqrt(w * w + h * h) / 2) : t.to,
      set: t.set ? t.set(o) : [], seconds: o.seconds, ease: o.ease !== false, extend: o.extend !== false };
  }

  // How far through (0..1) an overlap transition is at t of d, eased like the keys will be.
  function progress(t, d) { var p = Math.max(0, Math.min(1, t / d)); return p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2; }

  var api = { OVERLAPS: OVERLAPS, NAME: NAME, overlap: overlap, pairs: pairs, overlapJob: overlapJob, progress: progress };
  if (typeof module === "object" && module.exports) module.exports = api;
  // in the panels Node is switched on, so `module` exists there too: the page still needs the global
  if (typeof window !== "undefined") window.HaloFlow = api; else if (typeof module !== "object") root.HaloFlow = api;
})(typeof self !== "undefined" ? self : this);
