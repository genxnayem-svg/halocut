/* HaloCut Zoom — the maths behind screen-recording zooms, the rounded frame, focus boxes and callouts.
 * Rects are { x, y, w, h } in pixels of the sequence frame. A zoom key is { t, z, a: [x, y] }:
 * the clip's scale becomes z × its own, and its position a + z × its own (in frame pixels).
 * © 2026 Imtayz Nayem */
(function (root) {
  var EASES = {
    smooth: function (t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; },
    snappy: function (t) { return t >= 1 ? 1 : (1 - Math.pow(2, -10 * t)) / (1 - Math.pow(2, -10)); },
    gentle: function (t) { return -(Math.cos(Math.PI * t) - 1) / 2; },
    linear: function (t) { return t; },
  };
  var EASE_LIST = [{ id: "smooth", name: "Smooth" }, { id: "snappy", name: "Snappy" }, { id: "gentle", name: "Gentle" }, { id: "linear", name: "Linear" }];

  function full(frame) { return { x: 0, y: 0, w: frame.w, h: frame.h }; }

  function intersect(a, b) {
    var x = Math.max(a.x, b.x), y = Math.max(a.y, b.y), r = Math.min(a.x + a.w, b.x + b.w), btm = Math.min(a.y + a.h, b.y + b.h);
    return r - x > 1 && btm - y > 1 ? { x: x, y: y, w: r - x, h: btm - y } : null;
  }

  // Where the clip shows in the frame: its own size × its scale, centred on its position.
  function clipRect(base, src, frame) {
    var k = base.scale / 100, w = src.w * k, h = src.h * k;
    return { x: base.position[0] * frame.w - w / 2, y: base.position[1] * frame.h - h / 2, w: w, h: h };
  }

  // What a zoom fills: the part of the frame the clip covers (the whole frame, or the hole of a HaloCut frame).
  function target(frame, rect) { return (rect && intersect(rect, full(frame))) || full(frame); }

  // A box the target's shape that holds the drawn one, inside the target, never smaller than 1/maxZoom of it.
  function fitBox(box, tgt, maxZoom) {
    var a = tgt.w / tgt.h, cx = box.x + box.w / 2, cy = box.y + box.h / 2;
    var w = Math.max(box.w, box.h * a);
    w = Math.max(tgt.w / (maxZoom || 8), Math.min(tgt.w, w));
    var h = w / a;
    var x = Math.max(tgt.x, Math.min(tgt.x + tgt.w - w, cx - w / 2)), y = Math.max(tgt.y, Math.min(tgt.y + tgt.h - h, cy - h / 2));
    return { x: x, y: y, w: w, h: h };
  }

  // The move at progress p (0 = as it is, 1 = the box fills the target). It zooms steadily toward the one point
  // that stays put, so the box never slides out of view on the way in.
  function zoomAt(tgt, box, p) {
    var zf = tgt.w / box.w, cx = box.x + box.w / 2, cy = box.y + box.h / 2, tx = tgt.x + tgt.w / 2, ty = tgt.y + tgt.h / 2;
    if (zf < 1.001) return { z: 1, a: [p * (tx - cx), p * (ty - cy)] };
    var fx = (zf * cx - tx) / (zf - 1), fy = (zf * cy - ty) / (zf - 1), z = Math.pow(zf, p);
    return { z: z, a: [fx * (1 - z), fy * (1 - z)] };
  }

  function zoomFactor(tgt, box) { return tgt.w / box.w; }

  // One key per frame on the way in and out, two for the hold. Times are seconds from the start of the zoom.
  // timing: { in, hold, out } seconds
  function plan(tgt, box, timing, fps, ease) {
    var E = EASES[ease] || EASES.smooth, fd = 1 / fps;
    var nIn = Math.max(1, Math.round(timing.in * fps)), nHold = Math.max(0, Math.round(timing.hold * fps)), nOut = Math.max(1, Math.round(timing.out * fps));
    var keys = [], r = function (v) { return Math.round(v * 1e6) / 1e6; };
    function push(f, p) { var m = zoomAt(tgt, box, p); keys.push({ t: r(f * fd), z: r(m.z), a: [r(m.a[0]), r(m.a[1])] }); }
    for (var i = 0; i <= nIn; i++) push(i, E(i / nIn));
    for (var o = nHold ? 0 : 1; o <= nOut; o++) push(nIn + nHold + o, 1 - E(o / nOut));
    return { keys: keys, seconds: r((nIn + nHold + nOut) * fd), zoom: Math.round(zoomFactor(tgt, box) * 100) / 100 };
  }

  // Where a frame point lands under a key.
  function apply(key, q) { return [key.a[0] + key.z * q[0], key.a[1] + key.z * q[1]]; }

  // The progress at time t into a zoom, for the preview.
  function progressAt(timing, t, ease) {
    var E = EASES[ease] || EASES.smooth;
    if (t <= 0) return 0;
    if (t < timing.in) return E(t / timing.in);
    if (t <= timing.in + timing.hold) return 1;
    var o = t - timing.in - timing.hold;
    return o >= timing.out ? 0 : 1 - E(o / timing.out);
  }

  // A box in the frame as Crop percentages of the clip (effects run on the clip before Motion places it).
  function cropFor(box, base, src, frame) {
    var r = clipRect(base, src, frame), c = function (v) { return Math.round(Math.max(0, Math.min(100, v)) * 1000) / 1000; };
    return { l: c((box.x - r.x) / r.w * 100), t: c((box.y - r.y) / r.h * 100),
      r: c((r.x + r.w - box.x - box.w) / r.w * 100), b: c((r.y + r.h - box.y - box.h) / r.h * 100) };
  }

  // The rounded frame: the clip shrinks by k about the frame centre and shows through a hole of that size.
  function frameLayout(frame, rect, pad) {
    var k = Math.round((1 - 2 * pad) * 1000) / 1000, t = target(frame, rect), cx = frame.w / 2, cy = frame.h / 2;
    return { k: k, hole: { x: cx + k * (t.x - cx), y: cy + k * (t.y - cy), w: t.w * k, h: t.h * k } };
  }

  // Clips that show at the same place share one frame picture.
  function groupByRect(clips) {
    var groups = {}, order = [];
    for (var i = 0; i < clips.length; i++) {
      var r = clips[i].rect, key = [r.x, r.y, r.w, r.h].map(Math.round).join(",");
      if (!groups[key]) { groups[key] = { rect: r, ids: [] }; order.push(key); }
      groups[key].ids.push(clips[i].id);
    }
    return order.map(function (k) { return groups[k]; });
  }

  // A callout label beside its point, toward the middle of the frame and kept inside it.
  function calloutLayout(frame, point, size, gap) {
    var m = Math.round(frame.h * 0.04), dx = point[0] < frame.w / 2 ? 1 : -1, dy = point[1] < frame.h / 2 ? 1 : -1;
    var g = gap === undefined ? frame.h * 0.12 : gap;
    var cx = point[0] + dx * g * 1.2, cy = point[1] + dy * g;
    var x = Math.max(m, Math.min(frame.w - m - size.w, cx - size.w / 2)), y = Math.max(m, Math.min(frame.h - m - size.h, cy - size.h / 2));
    var label = { x: x, y: y, w: size.w, h: size.h };
    // the arrow leaves from the label edge nearest the point
    var from = [Math.max(x, Math.min(x + size.w, point[0])), dy > 0 ? y : y + size.h];
    if (point[1] > y && point[1] < y + size.h) from = [dx > 0 ? x : x + size.w, y + size.h / 2];
    return { label: label, from: from, to: point.slice() };
  }

  var api = { EASES: EASES, EASE_LIST: EASE_LIST, full: full, intersect: intersect, clipRect: clipRect, target: target, fitBox: fitBox,
    zoomAt: zoomAt, zoomFactor: zoomFactor, plan: plan, apply: apply, progressAt: progressAt, cropFor: cropFor,
    frameLayout: frameLayout, groupByRect: groupByRect, calloutLayout: calloutLayout };
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.HaloZoom = api;
})(typeof self !== "undefined" ? self : this);
