/* HaloCut Accents (After Effects) — little motion accents built as shape layers: bursts, sparkles, ripples,
 * underlines, scribbles, arrows, ticks, confetti… Each is a list of shapes (After Effects form: { v, i, o, c } paths)
 * with keyframes for its group: trim (start, end, offset), position, scale, rotation, opacity and stroke width.
 * Times are seconds from the start, for a one-second accent; the host stretches them to the length you pick.
 * © 2026 Imtayz Nayem */
(function (root) {
  var K = 0.5522847498;
  function line(a, b) { return { v: [a, b], i: [[0, 0], [0, 0]], o: [[0, 0], [0, 0]], c: false }; }
  function poly(pts, closed) { return { v: pts, i: pts.map(function () { return [0, 0]; }), o: pts.map(function () { return [0, 0]; }), c: !!closed }; }
  function circle(r, cx, cy) {
    cx = cx || 0; cy = cy || 0; var k = K * r;
    return { v: [[cx + r, cy], [cx, cy + r], [cx - r, cy], [cx, cy - r]], i: [[0, -k], [k, 0], [0, k], [-k, 0]], o: [[0, k], [-k, 0], [0, -k], [k, 0]], c: true };
  }
  function star(r, inner, n) { var pts = []; for (var i = 0; i < n * 2; i++) { var a = -Math.PI / 2 + i * Math.PI / n, rr = i % 2 ? inner : r; pts.push([Math.cos(a) * rr, Math.sin(a) * rr]); } return poly(pts, true); }
  function rnd(seed) { var x = Math.sin(seed * 12.9898) * 43758.5453; return x - Math.floor(x); }
  function stroke(o, w) { return { rgb: o.rgb, opacity: 100, width: w, cap: 2, join: 2 }; }
  function fill(o) { return { rgb: o.rgb, opacity: 100 }; }

  // Each maker: (o = { size, rgb, width }) → [{ name, paths, fill, stroke, anim }]
  var ACCENTS = [
    { id: "burst", name: "Burst", make: function (o) {
      var out = [], n = 8, r1 = o.size * 0.45, r2 = o.size;
      for (var i = 0; i < n; i++) {
        var a = i / n * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
        out.push({ name: "ray " + (i + 1), paths: [line([c * r1, s * r1], [c * r2, s * r2])], stroke: stroke(o, o.width),
          anim: { trimEnd: [[0, 0], [0.45, 100]], trimStart: [[0.3, 0], [0.8, 100]] } });
      }
      return out;
    } },
    { id: "sparkle", name: "Sparkle", make: function (o) {
      return [{ name: "sparkle", paths: [star(o.size, o.size * 0.22, 4)], fill: fill(o),
        anim: { scale: [[0, [0, 0]], [0.35, [115, 115]], [0.5, [100, 100]], [0.75, [100, 100]], [1, [0, 0]]], rotation: [[0, -40], [1, 40]] } },
        { name: "sparkle small", paths: [star(o.size * 0.4, o.size * 0.09, 4)], fill: fill(o),
          anim: { position: [[0, [o.size * 0.9, -o.size * 0.7]], [1, [o.size * 0.9, -o.size * 0.7]]], scale: [[0.15, [0, 0]], [0.45, [110, 110]], [0.6, [100, 100]], [0.85, [0, 0]]] } }];
    } },
    { id: "ripple", name: "Ripple", make: function (o) {
      return [0, 0.22].map(function (d, i) {
        return { name: "ring " + (i + 1), paths: [circle(o.size)], stroke: stroke(o, o.width * 1.5),
          anim: { scale: [[d, [0, 0]], [d + 0.7, [100, 100]]], opacity: [[d, 100], [d + 0.45, 100], [d + 0.7, 0]], strokeWidth: [[d, o.width * 2], [d + 0.7, o.width * 0.3]] } };
      });
    } },
    { id: "underline", name: "Underline", make: function (o) {
      var w = o.size * 2.4;
      return [{ name: "underline", paths: [{ v: [[-w / 2, 0], [w / 2, -o.size * 0.06]], i: [[0, 0], [-w * 0.3, o.size * 0.08]], o: [[w * 0.3, o.size * 0.08], [0, 0]], c: false }], stroke: stroke(o, o.width * 1.4),
        anim: { trimEnd: [[0, 0], [0.6, 100]] } }];
    } },
    { id: "scribble", name: "Circle it", make: function (o) {
      var rx = o.size * 1.6, ry = o.size * 0.8, k = K;
      // an oval drawn by hand: it overshoots its start a little
      var p = { v: [[rx, -ry * 0.1], [0, ry], [-rx, 0], [0, -ry * 1.05], [rx * 1.05, ry * 0.15]], i: [[0, -k * ry], [k * rx, 0], [0, k * ry], [-k * rx, 0], [0, -k * ry * 0.9]],
        o: [[0, k * ry], [-k * rx, 0], [0, -k * ry], [k * rx, 0], [0, 0]], c: false };
      return [{ name: "circle it", paths: [p], stroke: stroke(o, o.width), anim: { trimEnd: [[0, 0], [0.7, 100]] } }];
    } },
    { id: "arrow", name: "Arrow", make: function (o) {
      var s = o.size, body = { v: [[-s * 1.2, s * 0.6], [s * 0.6, -s * 0.2]], i: [[0, 0], [-s * 0.6, -s * 0.6]], o: [[s * 0.3, -s * 0.9], [0, 0]], c: false };
      var head = poly([[s * 0.2, -s * 0.5], [s * 0.6, -s * 0.2], [s * 0.15, s * 0.1]], false);
      return [{ name: "arrow body", paths: [body], stroke: stroke(o, o.width), anim: { trimEnd: [[0, 0], [0.55, 100]] } },
        { name: "arrow head", paths: [head], stroke: stroke(o, o.width), anim: { trimStart: [[0.5, 50], [0.75, 0]], trimEnd: [[0.5, 50], [0.75, 100]] } }];
    } },
    { id: "tick", name: "Tick", make: function (o) {
      var s = o.size;
      return [{ name: "tick", paths: [poly([[-s * 0.6, 0], [-s * 0.15, s * 0.45], [s * 0.7, -s * 0.5]], false)], stroke: stroke(o, o.width * 1.6), anim: { trimEnd: [[0, 0], [0.5, 100]] } }];
    } },
    { id: "cross", name: "Cross", make: function (o) {
      var s = o.size * 0.6;
      return [{ name: "stroke 1", paths: [line([-s, -s], [s, s])], stroke: stroke(o, o.width * 1.6), anim: { trimEnd: [[0, 0], [0.35, 100]] } },
        { name: "stroke 2", paths: [line([s, -s], [-s, s])], stroke: stroke(o, o.width * 1.6), anim: { trimEnd: [[0.3, 0], [0.65, 100]] } }];
    } },
    { id: "confetti", name: "Confetti", make: function (o) {
      var out = [];
      for (var i = 0; i < 16; i++) {
        var a = rnd(i + 1) * Math.PI * 2, d = o.size * (0.8 + rnd(i + 30) * 0.9), w = o.size * 0.09, h = o.size * (0.16 + rnd(i + 60) * 0.1);
        var x = Math.cos(a) * d, y = Math.sin(a) * d + o.size * 0.3;
        out.push({ name: "bit " + (i + 1), paths: [poly([[-w, -h / 2], [w, -h / 2], [w, h / 2], [-w, h / 2]], true)], fill: { rgb: i % 3 === 0 ? [1, 1, 1] : o.rgb, opacity: 100 },
          anim: { position: [[0, [0, 0]], [0.55, [x, y - o.size * 0.4]], [1, [x * 1.1, y + o.size * 0.35]]], rotation: [[0, 0], [1, (rnd(i + 90) - 0.5) * 720]],
            scale: [[0, [0, 0]], [0.12, [100, 100]]], opacity: [[0.7, 100], [1, 0]] } });
      }
      return out;
    } },
    { id: "dots", name: "Pop dots", make: function (o) {
      var out = [], n = 6;
      for (var i = 0; i < n; i++) {
        var a = i / n * Math.PI * 2 - Math.PI / 2, x = Math.cos(a) * o.size, y = Math.sin(a) * o.size;
        out.push({ name: "dot " + (i + 1), paths: [circle(o.size * 0.12)], fill: fill(o),
          anim: { position: [[0, [x * 0.3, y * 0.3]], [0.6, [x, y]]], scale: [[0, [100, 100]], [0.3, [130, 130]], [0.7, [0, 0]]] } });
      }
      return out;
    } },
    { id: "swoosh", name: "Swoosh", make: function (o) {
      var s = o.size;
      return [{ name: "swoosh", paths: [{ v: [[-s * 1.6, s * 0.4], [s * 1.6, -s * 0.5]], i: [[0, 0], [-s * 1.2, s * 0.9]], o: [[s * 1.1, -s * 0.1], [0, 0]], c: false }], stroke: stroke(o, o.width * 1.3),
        anim: { trimEnd: [[0, 0], [0.55, 100]], trimStart: [[0.25, 0], [0.8, 100]] } }];
    } },
    { id: "shine", name: "Shine lines", make: function (o) {
      var s = o.size, out = [];
      [[-50, 0.5], [-20, 0.7], [10, 0.5]].forEach(function (d, i) {
        var a = d[0] * Math.PI / 180 - Math.PI / 2, c = Math.cos(a), sn = Math.sin(a), r1 = s * 0.5, r2 = s * (0.5 + d[1]);
        out.push({ name: "shine " + (i + 1), paths: [line([c * r1, sn * r1], [c * r2, sn * r2])], stroke: stroke(o, o.width),
          anim: { trimEnd: [[i * 0.08, 0], [0.4 + i * 0.08, 100]], trimStart: [[0.55 + i * 0.05, 0], [0.9 + i * 0.05, 100]] } });
      });
      return out;
    } },
  ];

  function accent(id) { for (var i = 0; i < ACCENTS.length; i++) if (ACCENTS[i].id === id) return ACCENTS[i]; return ACCENTS[0]; }

  // The shapes with their keys stretched to `seconds`.
  function make(id, o) {
    var a = accent(id), secs = o.seconds || 1, list = a.make({ size: o.size || 120, rgb: o.rgb || [1, 0.54, 0.24], width: o.width || 8 });
    list.forEach(function (s) { for (var k in s.anim) s.anim[k] = s.anim[k].map(function (key) { return [Math.round(key[0] * secs * 1000) / 1000, key[1]]; }); });
    return list;
  }

  // A key list's value at t, eased (in and out) between keys; before the first or after the last it holds.
  function at(keys, t, def) {
    if (!keys || !keys.length) return def;
    if (t <= keys[0][0]) return keys[0][1];
    for (var i = 1; i < keys.length; i++) {
      if (t <= keys[i][0]) {
        var p = (t - keys[i - 1][0]) / (keys[i][0] - keys[i - 1][0] || 1); p = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
        var a = keys[i - 1][1], b = keys[i][1];
        return a instanceof Array ? a.map(function (v, j) { return v + (b[j] - v) * p; }) : a + (b - a) * p;
      }
    }
    return keys[keys.length - 1][1];
  }

  // A path as points along it (for drawing it trimmed in the preview).
  function flatten(p, steps) {
    steps = steps || 16;
    var pts = [p.v[0]], n = p.v.length, segs = n - 1 + (p.c ? 1 : 0);
    for (var j = 0; j < segs; j++) {
      var a = p.v[j], b = p.v[(j + 1) % n], c1 = [a[0] + p.o[j][0], a[1] + p.o[j][1]], c2 = [b[0] + p.i[(j + 1) % n][0], b[1] + p.i[(j + 1) % n][1]];
      for (var s = 1; s <= steps; s++) {
        var t = s / steps, u = 1 - t;
        pts.push([u * u * u * a[0] + 3 * u * u * t * c1[0] + 3 * u * t * t * c2[0] + t * t * t * b[0], u * u * u * a[1] + 3 * u * u * t * c1[1] + 3 * u * t * t * c2[1] + t * t * t * b[1]]);
      }
    }
    return pts;
  }
  // The part of a point list between start% and end% of its length.
  function trimmed(pts, start, end) {
    var len = [0];
    for (var i = 1; i < pts.length; i++) len.push(len[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    var L = len[len.length - 1], a = Math.min(start, end) / 100 * L, b = Math.max(start, end) / 100 * L, out = [];
    function lerp(d) { for (var k = 1; k < pts.length; k++) if (len[k] >= d) { var p = (d - len[k - 1]) / (len[k] - len[k - 1] || 1); return [pts[k - 1][0] + (pts[k][0] - pts[k - 1][0]) * p, pts[k - 1][1] + (pts[k][1] - pts[k - 1][1]) * p]; } return pts[pts.length - 1]; }
    if (b - a <= 1e-6) return out;
    out.push(lerp(a));
    for (var m = 0; m < pts.length; m++) if (len[m] > a && len[m] < b) out.push(pts[m]);
    out.push(lerp(b));
    return out;
  }

  var api = { ACCENTS: ACCENTS, accent: accent, make: make, at: at, flatten: flatten, trimmed: trimmed };
  if (typeof module === "object" && module.exports) module.exports = api;
  // in the panels Node is switched on, so `module` exists there too: the page still needs the global
  if (typeof window !== "undefined") window.HaloAccent = api; else if (typeof module !== "object") root.HaloAccent = api;
})(typeof self !== "undefined" ? self : this);
