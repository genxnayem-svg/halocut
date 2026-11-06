/* HaloCut Split panel: grab a frame, place a window per pane on it, preview the new frame, build the sequence.
 * © 2026 Imtayz Nayem */
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var P = window.HaloSplit;
  var req = window.cep_node ? window.cep_node.require : window.require;
  var COLORS = ["#ff8a3d", "#36c2ff", "#4be3b0", "#c084fc"];
  var st = { src: { w: 1920, h: 1080 }, name: "Sequence", frame: "9:16", layout: "faceTop", gap: 0, wins: [], zooms: [], sel: 0, img: null };

  function say(t, busy) { $("sSum").className = "sum" + (busy ? " busy" : ""); $("sSumText").textContent = t; }

  // ---- windows follow the cells -------------------------------------------------------
  function frame() { return P.FRAMES[st.frame]; }
  function cells() { return P.cells(st.layout, frame(), st.gap); }

  function refit(keepCentres) {
    var cs = cells();
    st.wins = cs.map(function (c, i) {
      var old = keepCentres && st.wins[i], z = st.zooms[i] || (st.layout === "faceTop" && i === 1 ? 3 : 1);
      st.zooms[i] = z;
      var cx = old ? old.x + old.w / 2 : (st.layout === "faceTop" && i === 1 ? st.src.w * 0.85 : undefined);
      var cy = old ? old.y + old.h / 2 : (st.layout === "faceTop" && i === 1 ? st.src.h * 0.18 : undefined);
      return P.fitWindow(st.src, c, cx, cy, z);
    });
    st.sel = Math.min(st.sel, st.wins.length - 1);
  }

  // ---- chips ------------------------------------------------------------------------------
  function chips() {
    var fb = $("sFrames"); fb.innerHTML = "";
    Object.keys(P.FRAMES).forEach(function (k) {
      var b = document.createElement("button"); b.textContent = k; b.className = st.frame === k ? "on" : "";
      b.addEventListener("click", function () { st.frame = k; refit(true); all(); });
      fb.appendChild(b);
    });
    var lb = $("sLayouts"); lb.innerHTML = "";
    P.LAYOUTS.forEach(function (l) {
      var b = document.createElement("button"); b.textContent = l.name; b.className = st.layout === l.id ? "on" : "";
      b.addEventListener("click", function () { st.layout = l.id; st.zooms = []; refit(false); all(); });
      lb.appendChild(b);
    });
  }

  function panes() {
    var box = $("sPanes"); box.innerHTML = "";
    st.wins.forEach(function (w, i) {
      var row = document.createElement("div"); row.className = "s-pane" + (i === st.sel ? " on" : "");
      var dot = document.createElement("i"); dot.style.background = COLORS[i];
      var name = document.createElement("span");
      name.innerHTML = "Pane " + (i + 1) + (i === 0 ? " <small>· keeps the sound</small>" : "");
      var z = document.createElement("input"); z.type = "range"; z.min = "1"; z.max = "6"; z.step = "0.05"; z.value = st.zooms[i];
      z.title = "Zoom " + Math.round(st.zooms[i] * 100) + "%";
      z.addEventListener("input", function () { zoom(i, +z.value); });
      row.addEventListener("click", function () { st.sel = i; panes(); draw(); });
      row.appendChild(dot); row.appendChild(name); row.appendChild(z);
      box.appendChild(row);
    });
  }

  function zoom(i, z) {
    st.zooms[i] = Math.max(1, Math.min(6, z));
    var w = st.wins[i];
    st.wins[i] = P.fitWindow(st.src, cells()[i], w.x + w.w / 2, w.y + w.h / 2, st.zooms[i]);
    draw();
  }

  // ---- drawing -------------------------------------------------------------------------------
  function paintSource(g, sx, sy, sw, sh, dx, dy, dw, dh) {
    if (st.img) { g.drawImage(st.img, sx, sy, sw, sh, dx, dy, dw, dh); return; }
    // no frame grabbed yet: a stand-in "stream" with a face cam in the corner
    g.save();
    g.beginPath(); g.rect(dx, dy, dw, dh); g.clip();
    var kx = dw / sw, ky = dh / sh;
    g.translate(dx - sx * kx, dy - sy * ky); g.scale(kx, ky);
    var grad = g.createLinearGradient(0, 0, st.src.w, st.src.h);
    grad.addColorStop(0, "#2a2350"); grad.addColorStop(1, "#5b2457");
    g.fillStyle = grad; g.fillRect(0, 0, st.src.w, st.src.h);
    g.fillStyle = "rgba(255,255,255,.12)";
    for (var i = 0; i < 6; i++) g.fillRect(st.src.w * 0.06, st.src.h * (0.12 + i * 0.12), st.src.w * (0.35 + (i % 3) * 0.12), st.src.h * 0.05);
    g.fillStyle = "#e8457c"; g.fillRect(st.src.w * 0.72, st.src.h * 0.02, st.src.w * 0.26, st.src.h * 0.32);
    g.fillStyle = "#ffd0a0"; g.beginPath(); g.arc(st.src.w * 0.85, st.src.h * 0.16, st.src.h * 0.08, 0, Math.PI * 2); g.fill();
    g.restore();
  }

  function draw() {
    // source with the pane windows
    var c = $("sSource"), dpr = window.devicePixelRatio || 1, W = c.clientWidth, H = W * st.src.h / st.src.w;
    c.style.height = H + "px"; c.width = W * dpr; c.height = H * dpr;
    var g = c.getContext("2d"); g.setTransform(dpr, 0, 0, dpr, 0, 0);
    var k = W / st.src.w;
    paintSource(g, 0, 0, st.src.w, st.src.h, 0, 0, W, H);
    st.wins.forEach(function (w, i) {
      g.strokeStyle = COLORS[i]; g.lineWidth = i === st.sel ? 3 : 1.5;
      g.strokeRect(w.x * k, w.y * k, w.w * k, w.h * k);
      g.fillStyle = COLORS[i]; g.font = "700 12px -apple-system, sans-serif";
      g.fillText(String(i + 1), w.x * k + 6, w.y * k + 16);
    });
    // the new frame
    var o = $("sOut"), f = frame(), boxW = o.parentNode.clientWidth - 16, scale = Math.min(boxW / f.w, 260 / f.h);
    var OW = f.w * scale, OH = f.h * scale;
    o.style.width = OW + "px"; o.style.height = OH + "px"; o.width = OW * dpr; o.height = OH * dpr;
    var h = o.getContext("2d"); h.setTransform(dpr, 0, 0, dpr, 0, 0);
    h.fillStyle = "#000"; h.fillRect(0, 0, OW, OH);
    cells().forEach(function (cell, i) {
      var w = st.wins[i];
      paintSource(h, w.x, w.y, w.w, w.h, cell.x * scale, cell.y * scale, cell.w * scale, cell.h * scale);
      h.strokeStyle = COLORS[i]; h.lineWidth = 1; h.strokeRect(cell.x * scale + 0.5, cell.y * scale + 0.5, cell.w * scale - 1, cell.h * scale - 1);
    });
  }

  function all() { chips(); panes(); draw(); $("sGapOut").textContent = st.gap + " px"; }

  // ---- drag and zoom on the source ---------------------------------------------------------------
  var drag = null;
  function at(ev) { var r = $("sSource").getBoundingClientRect(), k = st.src.w / r.width; return { x: (ev.clientX - r.left) * k, y: (ev.clientY - r.top) * k }; }
  function hit(p) {
    for (var i = st.wins.length - 1; i >= 0; i--) { var w = st.wins[i]; if (p.x >= w.x && p.x <= w.x + w.w && p.y >= w.y && p.y <= w.y + w.h) return i; }
    return -1;
  }
  $("sSource").addEventListener("pointerdown", function (ev) {
    var p = at(ev), i = hit(p);
    if (i < 0) return;
    st.sel = i; drag = { i: i, dx: p.x - st.wins[i].x, dy: p.y - st.wins[i].y };
    $("sSource").classList.add("dragging"); $("sSource").setPointerCapture(ev.pointerId); panes(); draw();
  });
  $("sSource").addEventListener("pointermove", function (ev) {
    if (!drag) return;
    var p = at(ev), w = st.wins[drag.i];
    st.wins[drag.i] = P.clampWindow(st.src, { x: p.x - drag.dx, y: p.y - drag.dy, w: w.w, h: w.h });
    draw();
  });
  window.addEventListener("pointerup", function () { drag = null; $("sSource").classList.remove("dragging"); });
  $("sSource").addEventListener("wheel", function (ev) {
    var i = hit(at(ev));
    if (i < 0) return;
    ev.preventDefault();
    st.sel = i; zoom(i, st.zooms[i] * (ev.deltaY < 0 ? 1.06 : 1 / 1.06)); panes();
  }, { passive: false });

  $("sGap").addEventListener("input", function () { st.gap = +$("sGap").value; refit(true); all(); });

  // ---- grab a frame from the sequence ------------------------------------------------------------
  function grab() {
    if (!window.HaloBridge) return say("Open this panel in Premiere Pro to grab a frame");
    window.HaloBridge.run("pr.splitSource", {}).then(function (r) {
      if (!r.ok) return say(r.msg);
      st.src = { w: r.data.w, h: r.data.h }; st.name = r.data.name;
      refit(false); all();
      var path = req("path"), os = req("os"), fs = req("fs"), file = path.join(os.tmpdir(), "halocut-split-" + Date.now() + ".png");
      say("Grabbing the frame at the playhead…", true);
      window.HaloBridge.run("pr.exportFrame", { file: file }).then(function (r2) {
        if (!r2.ok) return say(r2.msg);
        var tries = 0;
        (function wait() {
          var ok = false;
          try { ok = fs.statSync(file).size > 0; } catch (e) {}
          if (!ok) { if (++tries > 40) return say("Premiere didn't write the frame"); return setTimeout(wait, 150); }
          var img = new Image();
          img.onload = function () { st.img = img; draw(); say("Frame from “" + st.name + "” · drag the windows"); };
          img.src = "file://" + file;
        })();
      });
    });
  }
  $("sGrab").addEventListener("click", grab);

  // ---- build ---------------------------------------------------------------------------------------
  $("sBuild").addEventListener("click", function () {
    if (!window.HaloBridge) return say("Open this panel in Premiere Pro to build");
    var f = frame(), cs = cells();
    var paneList = st.wins.map(function (w, i) { return P.place(st.src, f, w, cs[i]); });
    say("Building the sequence…", true);
    window.HaloBridge.run("pr.splitBuild", { name: st.name + " · " + st.frame + " split", frame: f, panes: paneList }).then(function (r) { say(r.msg); });
  });

  window.addEventListener("resize", draw);
  window.onHaloReady = function () { if (window.HaloBridge) grab(); };
  refit(false); all();
})();
