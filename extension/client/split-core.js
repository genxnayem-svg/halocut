/* HaloCut Split — layouts, frames, and the maths that turns "this part of the source goes in that cell"
 * into Crop percentages and a Motion scale and position. Rects are { x, y, w, h }.
 * © 2026 Imtayz Nayem */
(function (root) {
  var FRAMES = { "9:16": { w: 1080, h: 1920 }, "1:1": { w: 1080, h: 1080 }, "4:5": { w: 1080, h: 1350 }, "16:9": { w: 1920, h: 1080 } };

  // Cells in 0..1 of the new frame, bottom pane first (it keeps the sound).
  var LAYOUTS = [
    { id: "halves", name: "Stacked halves", cells: [{ x: 0, y: 0.5, w: 1, h: 0.5 }, { x: 0, y: 0, w: 1, h: 0.5 }] },
    { id: "faceTop", name: "Face on top (⅓)", cells: [{ x: 0, y: 1 / 3, w: 1, h: 2 / 3 }, { x: 0, y: 0, w: 1, h: 1 / 3 }] },
    { id: "corner", name: "Big with a corner", cells: [{ x: 0, y: 0, w: 1, h: 1 }, { x: 0.62, y: 0.04, w: 0.34, h: 0.24 }], overlap: true },
    { id: "sideBySide", name: "Side by side", cells: [{ x: 0, y: 0, w: 0.5, h: 1 }, { x: 0.5, y: 0, w: 0.5, h: 1 }] },
    { id: "rows3", name: "Three rows", cells: [{ x: 0, y: 2 / 3, w: 1, h: 1 / 3 }, { x: 0, y: 1 / 3, w: 1, h: 1 / 3 }, { x: 0, y: 0, w: 1, h: 1 / 3 }] },
    { id: "grid4", name: "Grid of four", cells: [{ x: 0, y: 0.5, w: 0.5, h: 0.5 }, { x: 0.5, y: 0.5, w: 0.5, h: 0.5 }, { x: 0, y: 0, w: 0.5, h: 0.5 }, { x: 0.5, y: 0, w: 0.5, h: 0.5 }] },
    { id: "reframe", name: "Reframe (one)", cells: [{ x: 0, y: 0, w: 1, h: 1 }] },
  ];

  function layout(id) { for (var i = 0; i < LAYOUTS.length; i++) if (LAYOUTS[i].id === id) return LAYOUTS[i]; return LAYOUTS[0]; }

  // Cells in pixels of the new frame, with `gap` pixels between cells that touch (never at the frame edge).
  function cells(id, frame, gap) {
    var L = layout(id), g = (gap || 0) / 2;
    return L.cells.map(function (c, i) {
      var r = { x: c.x * frame.w, y: c.y * frame.h, w: c.w * frame.w, h: c.h * frame.h };
      if (L.overlap && i > 0) return r; // a corner box floats over the big pane
      var l = c.x > 0 ? g : 0, t = c.y > 0 ? g : 0, rr = c.x + c.w < 1 - 1e-6 ? g : 0, b = c.y + c.h < 1 - 1e-6 ? g : 0;
      return { x: r.x + l, y: r.y + t, w: r.w - l - rr, h: r.h - t - b };
    });
  }

  // A window on the source, the cell's shape, centred and as big as it can be (zoom 1 = fills the source height or width).
  function fitWindow(src, cell, cx, cy, zoom) {
    var a = cell.w / cell.h, w, h;
    if (src.w / src.h > a) { h = src.h; w = h * a; } else { w = src.w; h = w / a; }
    w /= zoom || 1; h /= zoom || 1;
    return clampWindow(src, { x: (cx === undefined ? src.w / 2 : cx) - w / 2, y: (cy === undefined ? src.h / 2 : cy) - h / 2, w: w, h: h });
  }

  function clampWindow(src, r) {
    var w = Math.min(r.w, src.w), h = Math.min(r.h, src.h);
    return { x: Math.max(0, Math.min(src.w - w, r.x)), y: Math.max(0, Math.min(src.h - h, r.y)), w: w, h: h };
  }

  // Where the clip has to sit so the window lands exactly on the cell:
  // Crop in % of the source, Motion scale in %, Motion position in 0..1 of the new frame.
  function place(src, frame, win, cell) {
    var k = cell.w / win.w;
    var wcx = win.x + win.w / 2, wcy = win.y + win.h / 2;
    var ccx = cell.x + cell.w / 2, ccy = cell.y + cell.h / 2;
    var px = ccx - k * (wcx - src.w / 2), py = ccy - k * (wcy - src.h / 2);
    var pct = function (v, of) { return Math.round((v / of) * 100 * 1000) / 1000; };
    return {
      scale: Math.round(k * 100 * 1000) / 1000,
      position: [Math.round((px / frame.w) * 1e5) / 1e5, Math.round((py / frame.h) * 1e5) / 1e5],
      crop: { l: pct(win.x, src.w), t: pct(win.y, src.h), r: pct(src.w - win.x - win.w, src.w), b: pct(src.h - win.y - win.h, src.h) },
    };
  }

  var api = { FRAMES: FRAMES, LAYOUTS: LAYOUTS, layout: layout, cells: cells, fitWindow: fitWindow, clampWindow: clampWindow, place: place };
  if (typeof module === "object" && module.exports) module.exports = api;
  // in the panels Node is switched on, so `module` exists there too: the page still needs the global
  if (typeof window !== "undefined") window.HaloSplit = api; else if (typeof module !== "object") root.HaloSplit = api;
})(typeof self !== "undefined" ? self : this);
