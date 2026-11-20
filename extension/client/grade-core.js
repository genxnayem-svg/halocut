/* HaloCut Grade — the colour model behind the preview, the click-to-grade pickers, Auto, Match and .cube export.
 * Values use Lumetri Color's own units, so they go straight onto the clip. The preview is HaloCut's close
 * approximation of Lumetri; Premiere renders the exact result.
 * © 2026 Imtayz Nayem */
(function (root) {
  var KEYS = ["exposure", "contrast", "highlights", "shadows", "whites", "blacks", "temperature", "tint", "saturation", "vibrance", "faded", "vignette"];
  var NEUTRAL = { exposure: 0, contrast: 0, highlights: 0, shadows: 0, whites: 0, blacks: 0, temperature: 0, tint: 0, saturation: 100, vibrance: 0, faded: 0, vignette: 0 };
  var RANGES = { exposure: [-4, 4, 0.05], contrast: [-100, 100, 1], highlights: [-100, 100, 1], shadows: [-100, 100, 1], whites: [-100, 100, 1],
    blacks: [-100, 100, 1], temperature: [-100, 100, 1], tint: [-100, 100, 1], saturation: [0, 200, 1], vibrance: [-100, 100, 1], faded: [0, 100, 1], vignette: [-3, 3, 0.05] };
  var LOOKS = [
    { id: "clean", name: "Clean", v: { contrast: 10, whites: 6, blacks: -6, vibrance: 18 } },
    { id: "warm", name: "Warm", v: { temperature: 18, tint: 4, contrast: 8, saturation: 106, vibrance: 8 } },
    { id: "cool", name: "Cool", v: { temperature: -20, tint: -3, contrast: 6, highlights: -8 } },
    { id: "punchy", name: "Punchy", v: { contrast: 28, whites: 12, blacks: -14, shadows: 8, vibrance: 28 } },
    { id: "faded", name: "Faded", v: { contrast: -18, faded: 35, saturation: 82, highlights: -10, temperature: 6 } },
    { id: "mono", name: "Mono", v: { saturation: 0, contrast: 22, whites: 8, blacks: -10 } },
  ];
  var SKIN_ANGLE = 123; // degrees on the vectorscope, from +Cb toward +Cr

  function values(v) { var o = {}; for (var i = 0; i < KEYS.length; i++) o[KEYS[i]] = v && v[KEYS[i]] !== undefined ? +v[KEYS[i]] : NEUTRAL[KEYS[i]]; return o; }
  function look(id) { for (var i = 0; i < LOOKS.length; i++) if (LOOKS[i].id === id) return values(LOOKS[i].v); return values(); }
  function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
  function clampKey(k, v) { var r = RANGES[k]; return Math.max(r[0], Math.min(r[1], v)); }

  // sRGB in and out
  var TO_LIN = new Float32Array(256), DISP = new Float32Array(4098);
  for (var i = 0; i < 256; i++) { var c = i / 255; TO_LIN[i] = c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
  for (var j = 0; j <= 4097; j++) { var v = Math.min(1, j / 4096); DISP[j] = v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055; }
  function disp(v) { if (v <= 0) return 0; if (v >= 1) return 1; var x = v * 4096, n = x | 0; return DISP[n] + (DISP[n + 1] - DISP[n]) * (x - n); }

  // White balance in linear light: temperature trades red for blue, tint trades green for magenta.
  var TK = 0.55, NK = 0.35;
  function gains(p) {
    var kT = p.temperature / 100, kN = p.tint / 100, e = Math.pow(2, p.exposure);
    var r = Math.exp(TK * kT + NK / 2 * kN), g = Math.exp(-NK * kN), b = Math.exp(-TK * kT + NK / 2 * kN), y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    return [r / y * e, g / y * e, b / y * e];
  }
  function bell(y, m, w) { var d = (y - m) / w; return Math.exp(-d * d); }

  // The tone curve on display luma: contrast, highlights, shadows, whites, blacks and fade.
  function toneCurve(p) {
    var lut = new Float32Array(1026), c = p.contrast / 100, a = c >= 0 ? 1.4 * c : 0.8 * c;
    var h = p.highlights / 100, s = p.shadows / 100, w = p.whites / 100, k = p.blacks / 100, f = p.faded / 100;
    for (var i = 0; i <= 1025; i++) {
      var y = Math.min(1, i / 1024);
      var t = y < 0.5 ? 0.5 * Math.pow(2 * y, 1 + a) : 1 - 0.5 * Math.pow(2 * (1 - y), 1 + a);
      t += 0.28 * h * bell(t, 0.78, 0.2) + 0.28 * s * bell(t, 0.22, 0.2);
      t += 0.45 * w * t * t + 0.35 * k * (1 - t) * (1 - t);
      t = t * (1 - 0.2 * f) + 0.07 * f;
      lut[i] = clamp01(t);
      if (i && lut[i] < lut[i - 1]) lut[i] = lut[i - 1];
    }
    return lut;
  }
  function lutAt(lut, y) { if (y <= 0) return lut[0]; if (y >= 1) return lut[1024]; var x = y * 1024, n = x | 0; return lut[n] + (lut[n + 1] - lut[n]) * (x - n); }

  function prepare(p) { p = values(p); return { g: gains(p), lut: toneCurve(p), sat: p.saturation / 100, vib: p.vibrance / 100, vig: p.vignette }; }

  // One pixel (0..255 in) through the grade: [r, g, b] 0..1 out. nx, ny: -1..1 from the frame centre, for the vignette.
  function pixel(G, r8, g8, b8, nx, ny) {
    var r = disp(TO_LIN[r8] * G.g[0]), g = disp(TO_LIN[g8] * G.g[1]), b = disp(TO_LIN[b8] * G.g[2]);
    var y = 0.2126 * r + 0.7152 * g + 0.0722 * b, y2 = lutAt(G.lut, y);
    if (y > 1e-4) { var k = y2 / y; r *= k; g *= k; b *= k; } else { r = g = b = y2; }
    var mx = Math.max(r, g, b), mn = Math.min(r, g, b), s = G.sat * (1 + G.vib * (1 - Math.min(1, (mx - mn) * 1.6)));
    r = y2 + (r - y2) * s; g = y2 + (g - y2) * s; b = y2 + (b - y2) * s;
    if (G.vig && nx !== undefined) {
      var d = Math.sqrt(nx * nx + ny * ny) / 1.4142, q = Math.max(0, Math.min(1, (d - 0.35) / 0.65)), m = 1 + G.vig * 0.18 * q * q * (3 - 2 * q);
      r *= m; g *= m; b *= m;
    }
    return [clamp01(r), clamp01(g), clamp01(b)];
  }

  // A whole picture: src and out are { data, width, height } with RGBA bytes.
  function grade(src, p, out) {
    var G = prepare(p), w = src.width, h = src.height, d = src.data, o = out.data;
    for (var y = 0; y < h; y++) {
      var ny = h > 1 ? y / (h - 1) * 2 - 1 : 0;
      for (var x = 0; x < w; x++) {
        var i = (y * w + x) * 4, px = pixel(G, d[i], d[i + 1], d[i + 2], w > 1 ? x / (w - 1) * 2 - 1 : 0, ny);
        o[i] = px[0] * 255 + 0.5; o[i + 1] = px[1] * 255 + 0.5; o[i + 2] = px[2] * 255 + 0.5; o[i + 3] = 255;
      }
    }
    return out;
  }

  function luma(r, g, b) { return 0.2126 * r + 0.7152 * g + 0.0722 * b; }
  function chroma(r, g, b) { return { cb: -0.1146 * r - 0.3854 * g + 0.5 * b, cr: 0.5 * r - 0.4542 * g - 0.0458 * b }; }
  function hueOf(px) { var c = chroma(px[0], px[1], px[2]); return { angle: Math.atan2(c.cr, c.cb) * 180 / Math.PI, amount: Math.sqrt(c.cb * c.cb + c.cr * c.cr) }; }

  // Luma percentiles and the average colour of a picture, graded by p (or as it is).
  function stats(src, p) {
    var G = p ? prepare(p) : null, d = src.data, n = src.width * src.height, ys = new Float32Array(n), cb = 0, cr = 0, ch = 0;
    for (var i = 0; i < n; i++) {
      var px = G ? pixel(G, d[i * 4], d[i * 4 + 1], d[i * 4 + 2]) : [d[i * 4] / 255, d[i * 4 + 1] / 255, d[i * 4 + 2] / 255];
      ys[i] = luma(px[0], px[1], px[2]);
      var c = chroma(px[0], px[1], px[2]);
      cb += c.cb; cr += c.cr; ch += Math.sqrt(c.cb * c.cb + c.cr * c.cr);
    }
    ys.sort();
    var at = function (q) { return ys[Math.min(n - 1, Math.max(0, Math.round(q * (n - 1))))]; };
    return { p: [at(0.02), at(0.1), at(0.25), at(0.5), at(0.75), at(0.9), at(0.98)], cb: cb / n, cr: cr / n, chroma: ch / n };
  }

  var MATCH_KEYS = ["exposure", "contrast", "whites", "blacks", "highlights", "shadows", "temperature", "tint", "saturation"];
  function distance(a, b, p) {
    var e = 0, wts = [2, 3, 4, 5, 4, 3, 2];
    for (var i = 0; i < 7; i++) e += wts[i] * (a.p[i] - b.p[i]) * (a.p[i] - b.p[i]);
    e += 40 * ((a.cb - b.cb) * (a.cb - b.cb) + (a.cr - b.cr) * (a.cr - b.cr)) + 20 * (a.chroma - b.chroma) * (a.chroma - b.chroma);
    for (var k = 0; k < MATCH_KEYS.length; k++) { var key = MATCH_KEYS[k], r = RANGES[key], dv = (p[key] - NEUTRAL[key]) / (r[1] - r[0]); e += 0.0004 * dv * dv; }
    return e;
  }

  // Settles the values that make `src` look like the reference stats, one slider at a time, finer each round.
  function match(src, ref, start) {
    var p = values(start), best = distance(stats(src, p), ref, p);
    var steps = { exposure: 0.5, contrast: 20, whites: 20, blacks: 20, highlights: 20, shadows: 20, temperature: 20, tint: 20, saturation: 20 };
    for (var round = 0; round < 7; round++) {
      for (var k = 0; k < MATCH_KEYS.length; k++) {
        var key = MATCH_KEYS[k], moved = true, guard = 0;
        while (moved && guard++ < 8) {
          moved = false;
          for (var sgn = -1; sgn <= 1; sgn += 2) {
            var q = values(p); q[key] = clampKey(key, p[key] + sgn * steps[key]);
            var e = distance(stats(src, q), ref, q);
            if (e < best - 1e-9) { best = e; p = q; moved = true; break; }
          }
        }
        steps[key] /= 2;
      }
    }
    return tidy(p);
  }

  function tidy(p) { var o = values(p); for (var i = 0; i < KEYS.length; i++) { var k = KEYS[i], st = RANGES[k][2]; o[k] = Math.round(clampKey(k, o[k]) / st) * st; o[k] = Math.round(o[k] * 1000) / 1000; } return o; }

  // Click on something that should be grey: temperature and tint that make it so.
  function neutralAt(p, rgb) {
    var lr = Math.max(1e-4, TO_LIN[rgb[0]]), lg = Math.max(1e-4, TO_LIN[rgb[1]]), lb = Math.max(1e-4, TO_LIN[rgb[2]]);
    var kT = Math.log(lb / lr) / (2 * TK), kN = -Math.log(Math.sqrt(lr * lb) / lg) / (1.5 * NK), q = values(p);
    q.temperature = Math.max(-100, Math.min(100, kT * 100)); q.tint = Math.max(-100, Math.min(100, kN * 100));
    return tidy(q);
  }

  function angleGap(a, b) { var d = ((a - b) % 360 + 540) % 360 - 180; return Math.abs(d); }

  // Click on skin: nudge temperature and tint until it sits on the skin line, moving as little as needed.
  function skinAt(p, rgb) {
    var base = values(p), best = null;
    function cost(t, n) {
      var q = values(base); q.temperature = clampKey("temperature", t); q.tint = clampKey("tint", n);
      var h = hueOf(pixel(prepare(q), rgb[0], rgb[1], rgb[2])), g = angleGap(h.angle, SKIN_ANGLE);
      return g * g + 0.004 * ((t - base.temperature) * (t - base.temperature) + (n - base.tint) * (n - base.tint));
    }
    for (var step = 8, t0 = base.temperature, n0 = base.tint, r = 0; r < 4; r++, step /= 3) {
      for (var dt = -5; dt <= 5; dt++) for (var dn = -5; dn <= 5; dn++) {
        var t = t0 + dt * step, n = n0 + dn * step, e = cost(t, n);
        if (!best || e < best.e) best = { e: e, t: t, n: n };
      }
      t0 = best.t; n0 = best.n;
    }
    var o = values(base); o.temperature = best.t; o.tint = best.n;
    return tidy(o);
  }

  // A value for one key that puts the clicked pixel's luma at `goal` (the key moves the luma one way only).
  function solveKey(p, rgb, key, goal) {
    var r = RANGES[key], lo = r[0], hi = r[1];
    function yAt(v) { var q = values(p); q[key] = v; var px = pixel(prepare(q), rgb[0], rgb[1], rgb[2]); return luma(px[0], px[1], px[2]); }
    var up = yAt(hi) > yAt(lo);
    for (var i = 0; i < 40; i++) { var mid = (lo + hi) / 2, y = yAt(mid); if ((y < goal) === up) lo = mid; else hi = mid; }
    var o = values(p); o[key] = (lo + hi) / 2;
    return tidy(o);
  }
  function whiteAt(p, rgb) { return solveKey(p, rgb, "whites", 0.94); }
  function blackAt(p, rgb) { return solveKey(p, rgb, "blacks", 0.04); }

  // Auto: grey the average midtone, then set the ends of the range.
  function auto(src) {
    var d = src.data, n = src.width * src.height, sr = 0, sg = 0, sb = 0, cnt = 0;
    for (var i = 0; i < n; i++) {
      var y = luma(d[i * 4], d[i * 4 + 1], d[i * 4 + 2]) / 255;
      if (y < 0.15 || y > 0.85) continue;
      sr += TO_LIN[d[i * 4]]; sg += TO_LIN[d[i * 4 + 1]]; sb += TO_LIN[d[i * 4 + 2]]; cnt++;
    }
    var p = values();
    if (cnt) {
      var mr = sr / cnt, mg = sg / cnt, mb = sb / cnt;
      var kT = Math.log(mb / mr) / (2 * TK), kN = -Math.log(Math.sqrt(mr * mb) / mg) / (1.5 * NK);
      p.temperature = clampKey("temperature", kT * 100 * 0.8); p.tint = clampKey("tint", kN * 100 * 0.8); // most of the way: a little of the light's character stays
    }
    var s = stats(src, p), goal = { p: [0.03, s.p[1], s.p[2], s.p[3], s.p[4], s.p[5], 0.96], cb: s.cb, cr: s.cr, chroma: s.chroma };
    // spread the range: whites and blacks only, so the middle keeps its place
    var keys = ["whites", "blacks"];
    for (var round = 0, step = 25; round < 6; round++, step /= 2) {
      for (var k = 0; k < 2; k++) {
        var cur = distance(stats(src, p), goal, p);
        for (var sgn = -1; sgn <= 1; sgn += 2) {
          var q = values(p); q[keys[k]] = clampKey(keys[k], p[keys[k]] + sgn * step);
          var e = distance(stats(src, q), goal, q);
          if (e < cur) { p = q; cur = e; }
        }
      }
    }
    return tidy(p);
  }

  // The grade as a 3D .cube LUT (no vignette: a LUT can't know where a pixel is).
  function cube(p, size, title) {
    size = size || 33;
    var G = prepare(p), lines = ['TITLE "' + (title || "HaloCut grade") + '"', "LUT_3D_SIZE " + size, "DOMAIN_MIN 0 0 0", "DOMAIN_MAX 1 1 1"];
    G.vig = 0;
    for (var b = 0; b < size; b++) for (var g = 0; g < size; g++) for (var r = 0; r < size; r++) {
      var q = function (v) { return Math.round(v / (size - 1) * 255); };
      var px = pixel(G, q(r), q(g), q(b));
      lines.push(px[0].toFixed(6) + " " + px[1].toFixed(6) + " " + px[2].toFixed(6));
    }
    return lines.join("\n") + "\n";
  }

  var api = { KEYS: KEYS, NEUTRAL: NEUTRAL, RANGES: RANGES, LOOKS: LOOKS, SKIN_ANGLE: SKIN_ANGLE, values: values, look: look, tidy: tidy,
    prepare: prepare, pixel: pixel, grade: grade, luma: luma, chroma: chroma, hueOf: hueOf, stats: stats, match: match,
    neutralAt: neutralAt, skinAt: skinAt, whiteAt: whiteAt, blackAt: blackAt, auto: auto, cube: cube };
  if (typeof module === "object" && module.exports) module.exports = api;
  // in the panels Node is switched on, so `module` exists there too: the page still needs the global
  if (typeof window !== "undefined") window.HaloGrade = api; else if (typeof module !== "object") root.HaloGrade = api;
})(typeof self !== "undefined" ? self : this);
