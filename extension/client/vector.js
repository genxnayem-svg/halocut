/* HaloCut Vector panel (After Effects): read an SVG, show it as it will import, build the shape layers.
 * © 2026 Imtayz Nayem */
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var V = window.HaloVector;
  var req = window.cep_node ? window.cep_node.require : window.require;
  var SAMPLE = '<svg viewBox="0 0 120 120"><g id="badge"><circle cx="60" cy="60" r="48" fill="#ff8a3d"/><circle cx="60" cy="60" r="48" fill="none" stroke="#ffffff" stroke-width="4" stroke-dasharray="0"/>' +
    '<path d="M38 62 L54 78 L84 44" fill="none" stroke="#16121a" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/></g>' +
    '<g id="sparks"><path d="M100 14 l4 10 10 4 -10 4 -4 10 -4 -10 -10 -4 10 -4z" fill="#e8457c"/><circle cx="18" cy="100" r="6" fill="#36c2ff"/></g></svg>';
  var st = { art: null, name: "SVG", size: "fit", layers: "groups", draw: "none" };

  function say(t, busy) { $("vSum").className = "sum" + (busy ? " busy" : ""); $("vSumText").textContent = t; }
  function run(tool, args) {
    if (!window.HaloBridge) return Promise.reject("Open this panel in After Effects");
    if (window.HaloBridge.appId && window.HaloBridge.appId !== "AEFT") return Promise.reject("HaloCut Vector is for After Effects");
    return window.HaloBridge.run(tool, args || {}).then(function (r) { if (!r.ok) throw r.msg; return r; });
  }

  // ---- reading ----------------------------------------------------------------------------------------
  function use(text, name) {
    try { st.art = V.read(text); st.name = (name || "SVG").replace(/\.svg$/i, ""); }
    catch (e) { st.art = null; draw(); $("vReport").textContent = ""; $("vImport").disabled = true; return say(e.message || String(e)); }
    report(); draw(); $("vImport").disabled = !st.art.shapes.length;
    say(st.art.shapes.length ? "Ready · pick how it comes in, then Import" : "Nothing drawable in that SVG");
  }
  function report() {
    var a = st.art, groups = {}, notes = [];
    a.shapes.forEach(function (s) { if (s.group) groups[s.group] = 1; });
    var paths = a.shapes.reduce(function (n, s) { return n + s.paths.length; }, 0);
    var html = "<b>" + a.shapes.length + "</b> shapes · <b>" + paths + "</b> paths · <b>" + Object.keys(groups).length + "</b> groups";
    if (a.report.gradients) notes.push(a.report.gradients > 1 ? a.report.gradients + " gradients came in as their first colour" : "1 gradient came in as its first colour");
    for (var k in a.report.skipped) notes.push(a.report.skipped[k] + " × " + k + " left out");
    $("vReport").innerHTML = html + (notes.length ? '<div class="warn"></div>' : "");
    if (notes.length) $("vReport").querySelector(".warn").textContent = notes.join(" · ");
  }
  $("vOpen").addEventListener("click", function () {
    if (window.cep && window.cep.fs && window.cep.fs.showOpenDialog && req) {
      var r = window.cep.fs.showOpenDialog(false, false, "SVG file", "", ["svg"]);
      if (!r || r.err || !r.data || !r.data.length) return;
      use(req("fs").readFileSync(r.data[0], "utf8"), r.data[0].split("/").pop());
    } else $("vFile").click();
  });
  $("vFile").addEventListener("change", function () {
    var f = $("vFile").files[0]; if (!f) return;
    var rd = new FileReader(); rd.onload = function () { use(rd.result, f.name); }; rd.readAsText(f);
  });
  $("vPasteBtn").addEventListener("click", function () { $("vPaste").hidden = !$("vPaste").hidden; if (!$("vPaste").hidden) $("vPaste").focus(); });
  $("vPaste").addEventListener("input", function () { if (/<\/svg>\s*$/i.test($("vPaste").value.trim())) use($("vPaste").value, "Pasted SVG"); });

  // ---- the preview: drawn from the same shapes After Effects will get ---------------------------------------
  function shapes(fit) {
    var s = V.toAE(st.art, fit);
    return $("vRecolour").checked ? V.recolour(s, hex($("vColour").value)) : s;
  }
  function hex(h) { return [parseInt(h.substr(1, 2), 16) / 255, parseInt(h.substr(3, 2), 16) / 255, parseInt(h.substr(5, 2), 16) / 255]; }
  function css(rgb, op) { return "rgba(" + rgb.map(function (v) { return Math.round(v * 255); }).join(",") + "," + op / 100 + ")"; }
  function draw() {
    var c = $("vStage"), dpr = window.devicePixelRatio || 1, W = c.clientWidth || 320, H = c.clientHeight || 200;
    c.width = Math.round(W * dpr); c.height = Math.round(H * dpr);
    var g = c.getContext("2d"); g.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (!st.art) return;
    var list = shapes(Math.min(W, H) * 0.86);
    g.translate(W / 2, H / 2); g.lineCap = "round";
    list.forEach(function (s) {
      g.beginPath();
      s.paths.forEach(function (p) {
        var n = p.v.length; g.moveTo(p.v[0][0], p.v[0][1]);
        for (var j = 0; j < n - 1 + (p.c ? 1 : 0); j++) {
          var a = p.v[j], b = p.v[(j + 1) % n], o = p.o[j], i = p.i[(j + 1) % n];
          g.bezierCurveTo(a[0] + o[0], a[1] + o[1], b[0] + i[0], b[1] + i[1], b[0], b[1]);
        }
        if (p.c) g.closePath();
      });
      if (s.fill) { g.fillStyle = css(s.fill.rgb, s.fill.opacity); g.fill(s.fill.evenOdd ? "evenodd" : "nonzero"); }
      if (s.stroke) { g.strokeStyle = css(s.stroke.rgb, s.stroke.opacity); g.lineWidth = s.stroke.width; g.lineCap = ["butt", "butt", "round", "square"][s.stroke.cap]; g.lineJoin = ["miter", "miter", "round", "bevel"][s.stroke.join]; g.stroke(); }
    });
  }
  $("vRecolour").addEventListener("change", draw); $("vColour").addEventListener("input", function () { if ($("vRecolour").checked) draw(); });
  window.addEventListener("resize", draw);

  // ---- options ----------------------------------------------------------------------------------------------
  function chips(id, items, cur, pick) {
    var box = $(id); box.innerHTML = "";
    items.forEach(function (it) {
      var b = document.createElement("button"); b.textContent = it.name; b.className = it.id === cur ? "on" : "";
      b.addEventListener("click", function () { pick(it.id); options(); });
      box.appendChild(b);
    });
  }
  function options() {
    chips("vSize", [{ id: "fit", name: "Fit the comp" }, { id: "own", name: "Its own size" }], st.size, function (v) { st.size = v; });
    chips("vLayers", [{ id: "one", name: "One" }, { id: "groups", name: "Per group" }, { id: "shapes", name: "Per shape" }], st.layers, function (v) { st.layers = v; });
    chips("vDraw", [{ id: "none", name: "No" }, { id: "together", name: "Together" }, { id: "stagger", name: "One by one" }], st.draw, function (v) { st.draw = v; });
    $("vDrawRow").hidden = st.draw === "none";
  }
  (function () { var el = $("vSecs"), out = $("vSecsOut"); function show() { out.textContent = el.value + " s"; } el.addEventListener("input", show); show(); })();

  // ---- import -------------------------------------------------------------------------------------------------
  $("vImport").addEventListener("click", function () {
    if (!st.art) return;
    say("Building shape layers…", true);
    run("ae.resizeInfo").then(function (r) {
      // fit: the artwork's longer side to 60 % of the comp's shorter side; the host centres it
      var list = shapes(st.size === "fit" ? Math.round(Math.min(r.data.w, r.data.h) * 0.6) : 0), layers = V.layersOf(list, st.layers, st.name);
      var secs = +$("vSecs").value;
      return run("ae.vectorBuild", { layers: layers, drawOn: { mode: st.draw, seconds: secs, stagger: Math.max(0.05, secs / Math.max(4, list.length)) } });
    }).then(function (r) { say(r.msg); }).catch(function (m) { say(String(m)); });
  });

  options(); use(SAMPLE, "HaloCut sample");
  if (!window.HaloBridge) say("A sample SVG: open this panel in After Effects to import yours");
})();
