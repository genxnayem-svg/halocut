/* HaloCut Accents panel (After Effects): every accent previews itself; the chosen one becomes a shape layer.
 * The previews are drawn from the same shapes and keys After Effects gets. © 2026 Imtayz Nayem */
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var A = window.HaloAccent;
  var st = { pick: "burst", where: "centre", t0: performance.now() };

  function say(t, busy) { $("aSum").className = "sum" + (busy ? " busy" : ""); $("aSumText").textContent = t; }
  function run(tool, args) {
    if (!window.HaloBridge) return Promise.reject("Open this panel in After Effects");
    if (window.HaloBridge.appId && window.HaloBridge.appId !== "AEFT") return Promise.reject("HaloCut Accents is for After Effects");
    return window.HaloBridge.run(tool, args || {}).then(function (r) { if (!r.ok) throw r.msg; return r; });
  }
  function hex(h) { return [parseInt(h.substr(1, 2), 16) / 255, parseInt(h.substr(3, 2), 16) / 255, parseInt(h.substr(5, 2), 16) / 255]; }
  function css(rgb, op) { return "rgba(" + rgb.map(function (v) { return Math.round(v * 255); }).join(",") + "," + op / 100 + ")"; }
  function opts(size) { return { size: size, rgb: hex($("aColour").value), width: +$("aWidth").value * size / +$("aSize").value, seconds: +$("aSecs").value }; }

  // ---- drawing one accent at time t, centred in a canvas ----------------------------------------------
  function bezier(g, p) {
    var n = p.v.length;
    g.moveTo(p.v[0][0], p.v[0][1]);
    for (var j = 0; j < n - 1 + (p.c ? 1 : 0); j++) {
      var a = p.v[j], b = p.v[(j + 1) % n], o = p.o[j], i = p.i[(j + 1) % n];
      g.bezierCurveTo(a[0] + o[0], a[1] + o[1], b[0] + i[0], b[1] + i[1], b[0], b[1]);
    }
    if (p.c) g.closePath();
  }
  function paint(c, shapes, t, size) {
    var dpr = window.devicePixelRatio || 1, W = c.clientWidth || 100, H = c.clientHeight || 50;
    if (c.width !== Math.round(W * dpr) || c.height !== Math.round(H * dpr)) { c.width = Math.round(W * dpr); c.height = Math.round(H * dpr); }
    var g = c.getContext("2d"), k = Math.min(W / (size * 3.6), H / (size * 2.6)); // the widest accents are about 3.4 sizes across
    g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
    g.translate(W / 2, H / 2); g.scale(k, k);
    shapes.forEach(function (s) { // first in the list is furthest back, as in After Effects
      var an = s.anim || {}, pos = A.at(an.position, t, [0, 0]), sc = A.at(an.scale, t, [100, 100]), rot = A.at(an.rotation, t, 0), op = A.at(an.opacity, t, 100);
      var start = A.at(an.trimStart, t, 0), end = A.at(an.trimEnd, t, 100), cut = start > 0.01 || end < 99.99;
      if (op <= 0.5 || (sc[0] <= 0.01 && sc[1] <= 0.01)) return;
      g.save();
      g.translate(pos[0], pos[1]); g.rotate(rot * Math.PI / 180); g.scale(sc[0] / 100, sc[1] / 100);
      g.globalAlpha = op / 100;
      g.beginPath();
      var any = false;
      s.paths.forEach(function (p) {
        if (!cut) { bezier(g, p); any = true; return; }
        var pts = A.trimmed(A.flatten(p, 24), start, end);
        if (pts.length < 2) return;
        g.moveTo(pts[0][0], pts[0][1]); for (var m = 1; m < pts.length; m++) g.lineTo(pts[m][0], pts[m][1]);
        any = true;
      });
      if (any) {
        if (s.fill) { g.fillStyle = css(s.fill.rgb, s.fill.opacity); g.fill(); }
        if (s.stroke) { g.strokeStyle = css(s.stroke.rgb, s.stroke.opacity); g.lineWidth = A.at(an.strokeWidth, t, s.stroke.width); g.lineCap = "round"; g.lineJoin = "round"; g.stroke(); }
      }
      g.restore();
    });
  }

  // ---- the loop: every accent plays, rests a moment, plays again --------------------------------------------
  var cache = {};
  function shapesFor(id, size) {
    var key = id + "|" + size + "|" + $("aColour").value + "|" + $("aWidth").value + "|" + $("aSecs").value + "|" + $("aSize").value;
    if (!cache[key]) cache[key] = A.make(id, opts(size));
    return cache[key];
  }
  function loop(now) {
    var secs = +$("aSecs").value, t = ((now - st.t0) / 1000) % (secs + 0.7);
    paint($("aStage"), shapesFor(st.pick, 100), t, 100);
    var tiles = document.querySelectorAll(".a-tile canvas");
    for (var i = 0; i < tiles.length; i++) paint(tiles[i], shapesFor(tiles[i].getAttribute("data-id"), 100), t, 100);
    requestAnimationFrame(loop);
  }

  // ---- choosing ---------------------------------------------------------------------------------------------
  function tiles() {
    var box = $("aTiles"); box.innerHTML = "";
    A.ACCENTS.forEach(function (a) {
      var b = document.createElement("button"), c = document.createElement("canvas"), n = document.createElement("span");
      b.className = "a-tile" + (a.id === st.pick ? " on" : ""); c.setAttribute("data-id", a.id); n.textContent = a.name;
      b.appendChild(c); b.appendChild(n);
      b.addEventListener("click", function () { st.pick = a.id; st.t0 = performance.now(); tiles(); say(a.name + " · add it at the playhead"); });
      box.appendChild(b);
    });
  }
  function where() {
    var box = $("aWhere"); box.innerHTML = "";
    [{ id: "centre", name: "Comp centre" }, { id: "layer", name: "On the selected layer" }].forEach(function (w) {
      var b = document.createElement("button"); b.textContent = w.name; b.className = w.id === st.where ? "on" : "";
      b.addEventListener("click", function () { st.where = w.id; where(); });
      box.appendChild(b);
    });
  }
  [["aSize", " px"], ["aWidth", " px"], ["aSecs", " s"]].forEach(function (d) {
    var el = $(d[0]), out = $(d[0] + "Out");
    function show() { out.textContent = el.value + d[1]; cache = {}; }
    el.addEventListener("input", function () { show(); st.t0 = performance.now(); }); show();
  });
  $("aColour").addEventListener("input", function () { cache = {}; });

  // ---- After Effects -----------------------------------------------------------------------------------------
  // On the selected layer: the middle of its box in the comp (plain 2D layers; parented or rotated ones have none)
  function position() {
    if (st.where !== "layer") return Promise.resolve(null);
    return run("ae.kitBoxes").then(function (r) {
      var b = r.data.boxes[0];
      if (!b) throw r.data.skipped ? "That layer is parented or rotated: use Comp centre, or pick a plain layer" : "Select the layer to put it on";
      return [Math.round((b.x + b.w / 2) * 10) / 10, Math.round((b.y + b.h / 2) * 10) / 10];
    });
  }
  $("aAdd").addEventListener("click", function () {
    var a = A.accent(st.pick), size = +$("aSize").value;
    say("Adding " + a.name + "…", true);
    position().then(function (pos) {
      var layer = { name: "HaloCut Accent · " + a.name, shapes: A.make(a.id, opts(size)) };
      if (pos) layer.position = pos;
      return run("ae.vectorBuild", { layers: [layer], drawOn: { mode: "none" } });
    }).then(function () { say(a.name + " added at the playhead · its keys are on the shape groups, ready to retime"); })
      .catch(function (m) { say(String(m)); });
  });

  tiles(); where(); requestAnimationFrame(loop);
  if (!window.HaloBridge) say("Open this panel in After Effects to use it");
})();
