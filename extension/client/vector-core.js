/* HaloCut Vector (After Effects) — reads an SVG and turns it into shapes After Effects can build natively:
 * Bezier paths (vertices with in/out tangents), fills and strokes, with transforms, groups, classes and <use> resolved.
 * Runs in the panel and in plain Node (it has its own small XML reader). © 2026 Imtayz Nayem */
(function (root) {
  // ---- a small XML reader: elements, attributes, text (for <style>) ------------------------------------
  function parseXML(src) {
    var rootEl = { name: "#root", attrs: {}, kids: [], text: "" }, stack = [rootEl], i = 0, s = String(src);
    while (i < s.length) {
      var lt = s.indexOf("<", i);
      if (lt < 0) break;
      if (lt > i) stack[stack.length - 1].text += s.slice(i, lt);
      if (s.substr(lt, 4) === "<!--") { i = s.indexOf("-->", lt) + 3; if (i < 3) break; continue; }
      if (s.substr(lt, 9) === "<![CDATA[") { var e = s.indexOf("]]>", lt); stack[stack.length - 1].text += s.slice(lt + 9, e); i = e + 3; continue; }
      if (s[lt + 1] === "?" || s[lt + 1] === "!") { i = s.indexOf(">", lt) + 1; continue; }
      var gt = lt, q = null;
      while (gt < s.length) { var ch = s[gt]; if (q) { if (ch === q) q = null; } else if (ch === '"' || ch === "'") q = ch; else if (ch === ">") break; gt++; }
      var tag = s.slice(lt + 1, gt);
      if (tag[0] === "/") { if (stack.length > 1) stack.pop(); i = gt + 1; continue; }
      var self = /\/\s*$/.test(tag); if (self) tag = tag.replace(/\/\s*$/, "");
      var m = /^([^\s]+)/.exec(tag), el = { name: m ? m[1].replace(/^svg:/, "") : "", attrs: {}, kids: [], text: "" };
      var re = /([^\s=]+)\s*=\s*("([^"]*)"|'([^']*)')/g, a;
      while ((a = re.exec(tag))) el.attrs[a[1].replace(/^xlink:/, "")] = a[3] !== undefined ? a[3] : a[4];
      stack[stack.length - 1].kids.push(el);
      if (!self) stack.push(el);
      i = gt + 1;
    }
    return rootEl;
  }
  function find(el, name) { if (el.name === name) return el; for (var i = 0; i < el.kids.length; i++) { var f = find(el.kids[i], name); if (f) return f; } return null; }
  function each(el, fn) { fn(el); el.kids.forEach(function (k) { each(k, fn); }); }

  // ---- colours -----------------------------------------------------------------------------------------
  var NAMED = { black: "#000000", white: "#ffffff", red: "#ff0000", green: "#008000", blue: "#0000ff", yellow: "#ffff00", orange: "#ffa500", purple: "#800080",
    pink: "#ffc0cb", gray: "#808080", grey: "#808080", silver: "#c0c0c0", navy: "#000080", teal: "#008080", maroon: "#800000", olive: "#808000", lime: "#00ff00",
    aqua: "#00ffff", cyan: "#00ffff", fuchsia: "#ff00ff", magenta: "#ff00ff", brown: "#a52a2a", gold: "#ffd700", indigo: "#4b0082", violet: "#ee82ee", coral: "#ff7f50",
    tomato: "#ff6347", crimson: "#dc143c", salmon: "#fa8072", tan: "#d2b48c", beige: "#f5f5dc", ivory: "#fffff0", khaki: "#f0e68c", lavender: "#e6e6fa", turquoise: "#40e0d0" };
  // → { rgb: [0..1 ×3], a } or null for none
  function color(v, gradients) {
    v = String(v || "").trim().toLowerCase();
    if (!v || v === "none" || v === "transparent") return null;
    if (v === "currentcolor") v = "#000000";
    var g = /^url\(\s*['"]?#([^'")\s]+)['"]?\s*\)/.exec(v);
    if (g) return gradients && gradients[g[1]] ? { rgb: gradients[g[1]].rgb, a: gradients[g[1]].a, gradient: true } : { rgb: [0, 0, 0], a: 1, gradient: true };
    if (NAMED[v]) v = NAMED[v];
    var h = /^#([0-9a-f]{3,8})$/.exec(v);
    if (h) {
      var x = h[1];
      if (x.length === 3 || x.length === 4) x = x.split("").map(function (c) { return c + c; }).join("");
      var n = function (k) { return parseInt(x.substr(k, 2), 16) / 255; };
      return { rgb: [n(0), n(2), n(4)], a: x.length === 8 ? n(6) : 1 };
    }
    var r = /^rgba?\(([^)]+)\)$/.exec(v);
    if (r) {
      var p = r[1].split(/[\s,\/]+/).filter(Boolean).map(function (t) { return /%$/.test(t) ? parseFloat(t) / 100 * 255 : parseFloat(t); });
      return { rgb: [p[0] / 255, p[1] / 255, p[2] / 255], a: p.length > 3 ? (p[3] > 1 ? p[3] / 255 : p[3]) : 1 };
    }
    return { rgb: [0, 0, 0], a: 1, unknown: true };
  }

  // ---- transforms: [a, b, c, d, e, f] like SVG's matrix() ---------------------------------------------------
  var I = [1, 0, 0, 1, 0, 0];
  function mul(m, n) { return [m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1], m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3], m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5]]; }
  function apply(m, p) { return [m[0] * p[0] + m[2] * p[1] + m[4], m[1] * p[0] + m[3] * p[1] + m[5]]; }
  function transform(str) {
    var m = I, re = /(matrix|translate|scale|rotate|skewX|skewY)\s*\(([^)]*)\)/g, t;
    while ((t = re.exec(String(str || "")))) {
      var a = t[2].split(/[\s,]+/).filter(Boolean).map(parseFloat), n;
      if (t[1] === "matrix") n = a;
      else if (t[1] === "translate") n = [1, 0, 0, 1, a[0] || 0, a[1] || 0];
      else if (t[1] === "scale") n = [a[0], 0, 0, a.length > 1 ? a[1] : a[0], 0, 0];
      else if (t[1] === "rotate") {
        var r = (a[0] || 0) * Math.PI / 180, c = Math.cos(r), s = Math.sin(r), rot = [c, s, -s, c, 0, 0];
        n = a.length > 2 ? mul(mul([1, 0, 0, 1, a[1], a[2]], rot), [1, 0, 0, 1, -a[1], -a[2]]) : rot;
      } else if (t[1] === "skewX") n = [1, 0, Math.tan(a[0] * Math.PI / 180), 1, 0, 0];
      else n = [1, Math.tan(a[0] * Math.PI / 180), 0, 1, 0, 0];
      m = mul(m, n);
    }
    return m;
  }

  // ---- paths: everything becomes cubic segments; subpaths as { pts: [[x,y]...], ctl: [[c1,c2]...], closed } ----
  function tokens(d) { var out = [], re = /([MmLlHhVvCcSsQqTtAaZz])|(-?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?)/g, m; while ((m = re.exec(d))) out.push(m[1] || parseFloat(m[2])); return out; }
  function arcToCubics(x1, y1, rx, ry, phi, large, sweep, x2, y2) {
    // endpoint → centre (SVG implementation notes), then cut into quarter turns
    if (!rx || !ry) return [[[x1, y1], [x2, y2], [x2, y2]]];
    rx = Math.abs(rx); ry = Math.abs(ry);
    var cp = Math.cos(phi), sp = Math.sin(phi), dx = (x1 - x2) / 2, dy = (y1 - y2) / 2, x1p = cp * dx + sp * dy, y1p = -sp * dx + cp * dy;
    var lam = x1p * x1p / (rx * rx) + y1p * y1p / (ry * ry); if (lam > 1) { rx *= Math.sqrt(lam); ry *= Math.sqrt(lam); }
    var num = rx * rx * ry * ry - rx * rx * y1p * y1p - ry * ry * x1p * x1p, den = rx * rx * y1p * y1p + ry * ry * x1p * x1p;
    var co = (large === sweep ? -1 : 1) * Math.sqrt(Math.max(0, num / den)), cxp = co * rx * y1p / ry, cyp = -co * ry * x1p / rx;
    var cx = cp * cxp - sp * cyp + (x1 + x2) / 2, cy = sp * cxp + cp * cyp + (y1 + y2) / 2;
    function ang(ux, uy, vx, vy) { var a = Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy); return a; }
    var t1 = ang(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry), dt = ang((x1p - cxp) / rx, (y1p - cyp) / ry, (-x1p - cxp) / rx, (-y1p - cyp) / ry);
    if (!sweep && dt > 0) dt -= 2 * Math.PI; else if (sweep && dt < 0) dt += 2 * Math.PI;
    var segs = Math.max(1, Math.ceil(Math.abs(dt) / (Math.PI / 2))), step = dt / segs, k = 4 / 3 * Math.tan(step / 4), out = [];
    function pt(t) { var c = Math.cos(t), s = Math.sin(t); return [cx + rx * c * cp - ry * s * sp, cy + rx * c * sp + ry * s * cp]; }
    function dv(t) { var c = Math.cos(t), s = Math.sin(t); return [-rx * s * cp - ry * c * sp, -rx * s * sp + ry * c * cp]; }
    for (var i = 0; i < segs; i++) {
      var a0 = t1 + i * step, a1 = a0 + step, p0 = pt(a0), p1 = pt(a1), d0 = dv(a0), d1 = dv(a1);
      out.push([[p0[0] + k * d0[0], p0[1] + k * d0[1]], [p1[0] - k * d1[0], p1[1] - k * d1[1]], p1]);
    }
    return out;
  }
  function parsePath(d) {
    var t = tokens(d), i = 0, cmd = "", cur = [0, 0], start = [0, 0], lastC = null, lastQ = null, subs = [], sub = null;
    function num() { return t[i++]; }
    function begin(p) { sub = { pts: [p], ctl: [], closed: false }; subs.push(sub); }
    function cubic(c1, c2, p) { if (!sub) begin(cur.slice()); sub.ctl.push([c1, c2]); sub.pts.push(p); cur = p; }
    function line(p) { cubic(cur.slice(), p.slice(), p); }
    while (i < t.length) {
      if (typeof t[i] === "string") cmd = t[i++];
      var rel = cmd === cmd.toLowerCase(), C = cmd.toUpperCase(), bx = rel ? cur[0] : 0, by = rel ? cur[1] : 0;
      if (C === "Z") { if (sub) { sub.closed = true; cur = start.slice(); } lastC = lastQ = null; sub = null; continue; }
      if (typeof t[i] !== "number") { i++; continue; }
      if (C === "M") { var p = [bx + num(), by + num()]; begin(p); cur = p; start = p.slice(); cmd = rel ? "l" : "L"; lastC = lastQ = null; continue; }
      if (C === "L") { line([bx + num(), by + num()]); lastC = lastQ = null; }
      else if (C === "H") { line([(rel ? cur[0] : 0) + num(), cur[1]]); lastC = lastQ = null; }
      else if (C === "V") { line([cur[0], (rel ? cur[1] : 0) + num()]); lastC = lastQ = null; }
      else if (C === "C") { var c1 = [bx + num(), by + num()], c2 = [bx + num(), by + num()], e = [bx + num(), by + num()]; cubic(c1, c2, e); lastC = c2; lastQ = null; }
      else if (C === "S") { var r1 = lastC ? [2 * cur[0] - lastC[0], 2 * cur[1] - lastC[1]] : cur.slice(), s2 = [bx + num(), by + num()], se = [bx + num(), by + num()]; cubic(r1, s2, se); lastC = s2; lastQ = null; }
      else if (C === "Q" || C === "T") {
        var qc = C === "Q" ? [bx + num(), by + num()] : (lastQ ? [2 * cur[0] - lastQ[0], 2 * cur[1] - lastQ[1]] : cur.slice()), qe = [bx + num(), by + num()], p0 = cur.slice();
        cubic([p0[0] + 2 / 3 * (qc[0] - p0[0]), p0[1] + 2 / 3 * (qc[1] - p0[1])], [qe[0] + 2 / 3 * (qc[0] - qe[0]), qe[1] + 2 / 3 * (qc[1] - qe[1])], qe);
        lastQ = qc; lastC = null;
      } else if (C === "A") {
        var rx = num(), ry = num(), rot = num() * Math.PI / 180, la = num() ? 1 : 0, sw = num() ? 1 : 0, ae = [bx + num(), by + num()];
        arcToCubics(cur[0], cur[1], rx, ry, rot, la, sw, ae[0], ae[1]).forEach(function (c) { cubic(c[0], c[1], c[2]); });
        lastC = lastQ = null;
      } else i++;
    }
    return subs.filter(function (s) { return s.pts.length > 1; });
  }
  var K = 0.5522847498; // a quarter circle as a cubic
  function ellipsePath(cx, cy, rx, ry) {
    return [{ pts: [[cx + rx, cy], [cx, cy + ry], [cx - rx, cy], [cx, cy - ry], [cx + rx, cy]],
      ctl: [[[cx + rx, cy + K * ry], [cx + K * rx, cy + ry]], [[cx - K * rx, cy + ry], [cx - rx, cy + K * ry]], [[cx - rx, cy - K * ry], [cx - K * rx, cy - ry]], [[cx + K * rx, cy - ry], [cx + rx, cy - K * ry]]], closed: true }];
  }
  function polyPath(points, closed) { var n = String(points || "").trim().split(/[\s,]+/).map(parseFloat), d = ""; for (var i = 0; i + 1 < n.length; i += 2) d += (i ? "L" : "M") + n[i] + " " + n[i + 1] + " "; return parsePath(d + (closed ? "Z" : "")); }
  function rectPath(x, y, w, h, rx, ry) {
    if (!rx && !ry) return parsePath("M" + x + " " + y + "H" + (x + w) + "V" + (y + h) + "H" + x + "Z");
    rx = Math.min(rx || ry, w / 2); ry = Math.min(ry || rx, h / 2);
    return parsePath("M" + (x + rx) + " " + y + "H" + (x + w - rx) + "A" + rx + " " + ry + " 0 0 1 " + (x + w) + " " + (y + ry) + "V" + (y + h - ry) + "A" + rx + " " + ry + " 0 0 1 " + (x + w - rx) + " " + (y + h) +
      "H" + (x + rx) + "A" + rx + " " + ry + " 0 0 1 " + x + " " + (y + h - ry) + "V" + (y + ry) + "A" + rx + " " + ry + " 0 0 1 " + (x + rx) + " " + y + "Z");
  }

  // ---- styles: presentation attributes, style="", and simple <style> rules (.class, element, #id) ---------------
  var PAINT = ["fill", "stroke", "stroke-width", "fill-opacity", "stroke-opacity", "opacity", "fill-rule", "stroke-linecap", "stroke-linejoin", "display", "visibility"];
  function decls(text) { var o = {}; String(text || "").split(";").forEach(function (d) { var k = d.indexOf(":"); if (k > 0) o[d.slice(0, k).trim().toLowerCase()] = d.slice(k + 1).trim(); }); return o; }
  function sheet(doc) {
    var rules = [];
    each(doc, function (el) {
      if (el.name !== "style") return;
      var css = el.text.replace(/\/\*[\s\S]*?\*\//g, ""), re = /([^{}]+)\{([^}]*)\}/g, m;
      while ((m = re.exec(css))) m[1].split(",").forEach(function (sel) { sel = sel.trim(); if (sel) rules.push({ sel: sel, d: decls(m[2]) }); });
    });
    return rules;
  }
  function own(el, rules) {
    var o = {}, cls = String(el.attrs["class"] || "").split(/\s+/).filter(Boolean);
    PAINT.forEach(function (k) { if (el.attrs[k] !== undefined) o[k] = el.attrs[k]; });
    rules.forEach(function (r) {
      var hit = r.sel === el.name || (r.sel[0] === "." && cls.indexOf(r.sel.slice(1)) >= 0) || (r.sel[0] === "#" && el.attrs.id === r.sel.slice(1));
      if (hit) for (var k in r.d) o[k] = r.d[k];
    });
    var inline = decls(el.attrs.style); for (var k2 in inline) o[k2] = inline[k2];
    return o;
  }

  // ---- the walk: every drawable element → { name, paths (in document space), fill, stroke } -------------------------
  function read(src) {
    var doc = parseXML(src), svg = find(doc, "svg"), report = { skipped: {}, gradients: 0, shapes: 0 };
    if (!svg) throw new Error("That isn't an SVG");
    var rules = sheet(doc), ids = {}, gradients = {};
    each(svg, function (el) { if (el.attrs.id) ids[el.attrs.id] = el; });
    each(svg, function (el) {
      if (!/Gradient$/.test(el.name)) return;
      var stop = null; each(el, function (s) { if (s.name === "stop" && !stop) stop = s; });
      if (!stop && el.attrs.href && ids[el.attrs.href.replace(/^#/, "")]) each(ids[el.attrs.href.replace(/^#/, "")], function (s) { if (s.name === "stop" && !stop) stop = s; });
      if (stop) { var st = own(stop, rules), c = color(st["stop-color"] || decls(stop.attrs.style)["stop-color"] || stop.attrs["stop-color"] || "#000"); if (c) gradients[el.attrs.id] = c; }
    });
    var vb = String(svg.attrs.viewBox || "").split(/[\s,]+/).filter(Boolean).map(parseFloat);
    var box = vb.length === 4 ? { x: vb[0], y: vb[1], w: vb[2], h: vb[3] } : { x: 0, y: 0, w: parseFloat(svg.attrs.width) || 100, h: parseFloat(svg.attrs.height) || 100 };
    var out = [], SKIP = { defs: 1, clipPath: 1, mask: 1, pattern: 1, symbol: 1, marker: 1, metadata: 1, title: 1, desc: 1, style: 1, linearGradient: 1, radialGradient: 1, filter: 1 };
    var UNSUPPORTED = { text: "Text (outline it first)", image: "Pictures", foreignObject: "Embedded HTML" };
    function walk(el, inherit, m, depth, group) {
      if (SKIP[el.name] || depth > 40) return;
      if (UNSUPPORTED[el.name]) { report.skipped[UNSUPPORTED[el.name]] = (report.skipped[UNSUPPORTED[el.name]] || 0) + 1; return; }
      var style = {}; for (var k in inherit) style[k] = inherit[k];
      var mine = own(el, rules);
      for (var k2 in mine) style[k2] = mine[k2];
      // opacity multiplies down the tree instead of replacing
      style.opacity = (parseFloat(inherit.opacity === undefined ? 1 : inherit.opacity)) * (mine.opacity !== undefined ? parseFloat(mine.opacity) : 1);
      if (style.display === "none" || style.visibility === "hidden") return;
      var mm = mul(m, transform(el.attrs.transform)), A = el.attrs, f = parseFloat, paths = null;
      if (el.name === "use") {
        var ref = ids[String(A.href || "").replace(/^#/, "")];
        if (ref) walk(ref.name === "symbol" ? { name: "g", attrs: {}, kids: ref.kids } : ref, style, mul(mm, [1, 0, 0, 1, f(A.x) || 0, f(A.y) || 0]), depth + 1, group);
        return;
      }
      if (el.name === "path") paths = parsePath(A.d || "");
      else if (el.name === "rect") paths = rectPath(f(A.x) || 0, f(A.y) || 0, f(A.width) || 0, f(A.height) || 0, f(A.rx) || 0, f(A.ry) || 0);
      else if (el.name === "circle") paths = ellipsePath(f(A.cx) || 0, f(A.cy) || 0, f(A.r) || 0, f(A.r) || 0);
      else if (el.name === "ellipse") paths = ellipsePath(f(A.cx) || 0, f(A.cy) || 0, f(A.rx) || 0, f(A.ry) || 0);
      else if (el.name === "line") paths = parsePath("M" + (f(A.x1) || 0) + " " + (f(A.y1) || 0) + "L" + (f(A.x2) || 0) + " " + (f(A.y2) || 0));
      else if (el.name === "polyline" || el.name === "polygon") paths = polyPath(A.points, el.name === "polygon");
      if (paths) {
        var fill = style.fill === undefined ? color("#000") : color(style.fill, gradients), stroke = color(style.stroke, gradients);
        if (fill && fill.gradient) report.gradients++;
        if (stroke && stroke.gradient) report.gradients++;
        var scale = Math.sqrt(Math.abs(mm[0] * mm[3] - mm[1] * mm[2])), op = style.opacity;
        // lines are never filled unless the SVG asks for it
        var filled = fill && (style.fill !== undefined || (el.name !== "line" && el.name !== "polyline"));
        var shape = { name: A.id || A["inkscape:label"] || el.name, group: group, paths: paths.map(function (p) { return { pts: p.pts.map(function (q) { return apply(mm, q); }), ctl: p.ctl.map(function (c) { return [apply(mm, c[0]), apply(mm, c[1])]; }), closed: p.closed }; }),
          fill: filled ? { rgb: fill.rgb, opacity: Math.round(fill.a * op * parseFloat(style["fill-opacity"] === undefined ? 1 : style["fill-opacity"]) * 1000) / 10, evenOdd: style["fill-rule"] === "evenodd" } : null,
          stroke: stroke ? { rgb: stroke.rgb, opacity: Math.round(stroke.a * op * parseFloat(style["stroke-opacity"] === undefined ? 1 : style["stroke-opacity"]) * 1000) / 10,
            width: Math.round((parseFloat(style["stroke-width"] === undefined ? 1 : style["stroke-width"]) || 1) * scale * 100) / 100,
            cap: { butt: 1, round: 2, square: 3 }[style["stroke-linecap"]] || 1, join: { miter: 1, round: 2, bevel: 3 }[style["stroke-linejoin"]] || 1 } : null };
        if (shape.paths.length && (shape.fill || shape.stroke)) { out.push(shape); report.shapes++; }
        return;
      }
      var next = group === undefined && depth === 1 && el.name === "g" ? (A.id || "group " + (out.length + 1)) : group;
      el.kids.forEach(function (kid) { walk(kid, style, mm, depth + 1, next); });
    }
    walk(svg, {}, I, 0, undefined);
    return { box: box, shapes: out, report: report };
  }

  // ---- After Effects form: vertices with tangents relative to each vertex, centred and scaled ----------------------
  // fit: the artwork's longest side in comp pixels (or 0 to keep its size). Returns shapes with paths as { v, i, o, c }.
  function toAE(art, fit) {
    var b = art.box, k = fit ? fit / Math.max(b.w, b.h) : 1, cx = b.x + b.w / 2, cy = b.y + b.h / 2;
    function P(p) { return [Math.round((p[0] - cx) * k * 1000) / 1000, Math.round((p[1] - cy) * k * 1000) / 1000]; }
    return art.shapes.map(function (s) {
      return { name: s.name, group: s.group, fill: s.fill, stroke: s.stroke && { rgb: s.stroke.rgb, opacity: s.stroke.opacity, width: Math.round(s.stroke.width * k * 100) / 100, cap: s.stroke.cap, join: s.stroke.join },
        paths: s.paths.map(function (p) {
          var pts = p.pts.slice(), ctl = p.ctl.slice(), closed = p.closed;
          // a closed path that comes back to its start: the last point is the first one again
          var f0 = pts[0], l0 = pts[pts.length - 1];
          if (pts.length > 2 && Math.abs(f0[0] - l0[0]) < 1e-6 && Math.abs(f0[1] - l0[1]) < 1e-6) { pts.pop(); closed = true; }
          var n = pts.length, v = pts.map(P), ins = [], outs = [];
          for (var j = 0; j < n; j++) { ins.push([0, 0]); outs.push([0, 0]); }
          for (var c = 0; c < ctl.length; c++) {
            var from = c, to = (c + 1) % n, c1 = P(ctl[c][0]), c2 = P(ctl[c][1]);
            if (c + 1 >= n && !closed) break;
            outs[from] = [Math.round((c1[0] - v[from][0]) * 1000) / 1000, Math.round((c1[1] - v[from][1]) * 1000) / 1000];
            ins[to] = [Math.round((c2[0] - v[to][0]) * 1000) / 1000, Math.round((c2[1] - v[to][1]) * 1000) / 1000];
          }
          return { v: v, i: ins, o: outs, c: closed };
        }) };
    });
  }

  // Groups of shapes, one per layer: "one" (all together), "groups" (top-level <g>s), "shapes" (each its own)
  function layersOf(shapes, mode, name) {
    if (mode === "shapes") return shapes.map(function (s, i) { return { name: s.name + " " + (i + 1), shapes: [s] }; });
    if (mode === "groups") {
      var by = {}, order = [];
      shapes.forEach(function (s) { var g = s.group || name; if (!by[g]) { by[g] = []; order.push(g); } by[g].push(s); });
      return order.map(function (g) { return { name: g, shapes: by[g] }; });
    }
    return [{ name: name, shapes: shapes }];
  }

  function recolour(shapes, rgb) {
    return shapes.map(function (s) { var o = {}; for (var k in s) o[k] = s[k]; if (s.fill) o.fill = { rgb: rgb, opacity: s.fill.opacity, evenOdd: s.fill.evenOdd }; if (s.stroke) { o.stroke = {}; for (var j in s.stroke) o.stroke[j] = s.stroke[j]; o.stroke.rgb = rgb; } return o; });
  }

  var api = { parseXML: parseXML, color: color, transform: transform, parsePath: parsePath, arcToCubics: arcToCubics, read: read, toAE: toAE, layersOf: layersOf, recolour: recolour };
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.HaloVector = api;
})(typeof self !== "undefined" ? self : this);
