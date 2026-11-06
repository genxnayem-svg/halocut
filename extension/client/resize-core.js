/* HaloCut Resize (After Effects) — one master comp into other sizes, each layer by its own rule.
 *   fill: covers the new frame (backgrounds)   fit: shrinks or grows to fit, keeps its place relative to the middle
 *   pin:  keeps its size readable and stays the same distance from its nearest edges (titles, logos, buttons)
 *   keep: stays exactly as it is, measured from the middle
 * Boxes are { x, y, w, h } in comp pixels. © 2026 Imtayz Nayem */
(function (root) {
  var SIZES = [
    { id: "9x16", name: "9:16", note: "Reels, Shorts, TikTok", w: 1080, h: 1920 },
    { id: "1x1", name: "1:1", note: "Square feed", w: 1080, h: 1080 },
    { id: "4x5", name: "4:5", note: "Portrait feed", w: 1080, h: 1350 },
    { id: "16x9", name: "16:9", note: "YouTube, TV", w: 1920, h: 1080 },
    { id: "21x9", name: "21:9", note: "Cinema banner", w: 2560, h: 1080 },
  ];
  var RULES = [{ id: "fill", name: "Fill" }, { id: "fit", name: "Fit" }, { id: "pin", name: "Pin" }, { id: "keep", name: "Keep" }];
  var TAG = /halocut:resize=(fill|fit|pin|keep)/;

  // A sensible rule for a layer: frame-sized things fill, everything else is pinned.
  function guess(box, comp) { return box && box.w >= comp.w * 0.9 && box.h >= comp.h * 0.9 ? "fill" : "pin"; }
  function ruleOf(comment, box, comp) { var m = TAG.exec(comment || ""); return m ? m[1] : guess(box, comp); }
  function tagged(comment, rule) {
    var c = String(comment || "").replace(/\s*halocut:resize=\w+/g, "").replace(/^\s+|\s+$/g, "");
    return (c ? c + " " : "") + "halocut:resize=" + rule;
  }

  // Which edge a layer belongs to, by where its middle sits: 0 left/top, 0.5 middle, 1 right/bottom.
  function anchorOf(box, comp) {
    var cx = (box.x + box.w / 2) / comp.w, cy = (box.y + box.h / 2) / comp.h;
    return [cx < 1 / 3 ? 0 : cx > 2 / 3 ? 1 : 0.5, cy < 1 / 3 ? 0 : cy > 2 / 3 ? 1 : 0.5];
  }

  // How a layer's position and scale change: { k (scale factor), map(point) → point }
  function plan(rule, box, from, to) {
    var sx = to.w / from.w, sy = to.h / from.h, u = Math.min(sx, sy), k, cx0 = from.w / 2, cy0 = from.h / 2, cx1 = to.w / 2, cy1 = to.h / 2;
    if (rule === "keep") return { k: 1, map: function (p) { return [cx1 + (p[0] - cx0), cy1 + (p[1] - cy0)].concat(p.slice(2)); } };
    if (rule === "fill" || rule === "fit") {
      k = rule === "fill" ? Math.max(sx, sy) : u;
      // a fill has to cover the new frame from where the layer actually sits, not just from the middle
      if (rule === "fill" && box) {
        var need = [[cx1, cx0 - box.x], [cx1, box.x + box.w - cx0], [cy1, cy0 - box.y], [cy1, box.y + box.h - cy0]];
        for (var i = 0; i < need.length; i++) if (need[i][1] > 1e-6) k = Math.max(k, need[i][0] / need[i][1]);
      }
      return { k: k, map: function (p) { return [cx1 + (p[0] - cx0) * k, cy1 + (p[1] - cy0) * k].concat(p.slice(2)); } };
    }
    var a = anchorOf(box, from);
    function one(v, f, t, an) { return an === 0 ? v * u : an === 1 ? t - (f - v) * u : t / 2 + (v - f / 2) * u; }
    return { k: u, map: function (p) { return [one(p[0], from.w, to.w, a[0]), one(p[1], from.h, to.h, a[1])].concat(p.slice(2)); } };
  }

  // The same plan as plain numbers for After Effects: x' = m·x + bx, y' = m·y + by, scale × k.
  function affine(rule, box, from, to) {
    var pl = plan(rule, box, from, to), o = pl.map([0, 0]), one = pl.map([1, 1]);
    return { k: pl.k, m: one[0] - o[0], bx: o[0], by: o[1] };
  }

  // Where a box lands under a plan (for the preview); the box scales about its own anchor point at `pivot`.
  function placeBox(box, pivot, pl) {
    var np = pl.map(pivot), k = pl.k;
    return { x: np[0] + (box.x - pivot[0]) * k, y: np[1] + (box.y - pivot[1]) * k, w: box.w * k, h: box.h * k };
  }

  // Title-safe margins for a size (comp guides): 5 % of the width at the sides, more at the top and bottom of tall frames
  // where the apps put their buttons.
  function guides(size) {
    var tall = size.h / size.w > 1.5, mx = Math.round(size.w * 0.05), top = Math.round(size.h * (tall ? 0.1 : 0.05)), bottom = Math.round(size.h * (tall ? 0.2 : 0.05));
    return { vertical: [mx, size.w - mx], horizontal: [top, size.h - bottom] };
  }

  function versionName(master, size) { return master + " · " + size.name.replace(":", "x"); }

  var api = { SIZES: SIZES, RULES: RULES, TAG: TAG, guess: guess, ruleOf: ruleOf, tagged: tagged, anchorOf: anchorOf, plan: plan, affine: affine, placeBox: placeBox, guides: guides, versionName: versionName };
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.HaloResize = api;
})(typeof self !== "undefined" ? self : this);
