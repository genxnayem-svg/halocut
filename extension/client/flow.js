/* HaloCut Flow panel (After Effects): preview a transition between two stand-in shots, then put it on the layers.
 * © 2026 Imtayz Nayem */
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var TR = window.HaloTrans, F = window.HaloFlow;
  var st = { pick: "zoomIn", dir: "left", t0: performance.now() };
  function isOver() { return !!F.overlap(st.pick); }
  function say(t, busy) { $("fSum").className = "sum" + (busy ? " busy" : ""); $("fSumText").textContent = t; }
  function run(tool, args) {
    if (!window.HaloBridge) return Promise.reject("Open this panel in After Effects");
    if (window.HaloBridge.appId && window.HaloBridge.appId !== "AEFT") return Promise.reject("HaloCut Flow is for After Effects");
    return window.HaloBridge.run(tool, args || {}).then(function (r) { if (!r.ok) throw r.msg; return r; });
  }

  // ---- stand-in shots --------------------------------------------------------------------------------
  function shot(g, W, H, which) {
    var gr = g.createLinearGradient(0, 0, W, H);
    if (which === "A") { gr.addColorStop(0, "#ff9a4d"); gr.addColorStop(1, "#b8336a"); } else { gr.addColorStop(0, "#1f6fd1"); gr.addColorStop(1, "#38d6e8"); }
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    g.fillStyle = "rgba(255,255,255,.18)";
    for (var i = 0; i < 6; i++) g.fillRect(W * (0.08 + i * 0.15), H * 0.72, W * 0.1, H * 0.12);
    g.fillStyle = "#fff"; g.font = "800 " + Math.round(H * 0.34) + "px -apple-system, sans-serif"; g.textAlign = "center"; g.textBaseline = "middle";
    g.fillText(which, W / 2, H * 0.42);
  }
  function withValues(g, W, H, which, v) {
    g.save();
    g.globalAlpha = Math.max(0, Math.min(1, v.opacity / 100));
    var f = [];
    if (v.blur) f.push("blur(" + (v.blur * W / 1920 * 0.8).toFixed(1) + "px)");
    if (v.len) f.push("blur(" + (v.len * W / 1920 * 0.25).toFixed(1) + "px)");
    if (v.bright) f.push("brightness(" + (1 + v.bright / 60).toFixed(2) + ")");
    if (f.length) g.filter = f.join(" ");
    g.translate(v.x * W, v.y * H); g.rotate(v.rot * Math.PI / 180);
    var sx = (v.nonUniform ? v.scaleW : v.scale) / 100, sy = (v.nonUniform ? v.scaleH : v.scale) / 100;
    g.scale(sx, sy); g.translate(-W / 2, -H / 2);
    shot(g, W, H, which);
    g.restore();
  }

  // ---- the preview loop ----------------------------------------------------------------------------------
  function loop(now) {
    var c = $("fStage"), dpr = window.devicePixelRatio || 1, W = c.clientWidth || 320, H = c.clientHeight || 180;
    if (c.width !== Math.round(W * dpr)) { c.width = Math.round(W * dpr); c.height = Math.round(H * dpr); }
    var g = c.getContext("2d"); g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.fillStyle = "#000"; g.fillRect(0, 0, W, H);
    var d = +$("fDur").value, cyc = d + 1.4, t = ((now - st.t0) / 1000) % cyc - 0.7; // 0.7 s of A, the move, 0.7 s of B
    if (isOver()) overlapFrame(g, W, H, t, d); else cutFrame(g, W, H, t, d);
    requestAnimationFrame(loop);
  }
  function cutFrame(g, W, H, t, d) {
    var n = Math.max(2, Math.round(d / 2 * 25)), plan = TR.plan(st.pick, { frames: n, strength: +$("fStr").value, dir: st.dir }), half = d / 2;
    // A builds up over the first half to the cut, B settles over the second
    if (t < half) withValues(g, W, H, "A", plan.A[Math.max(0, Math.min(n, Math.round(t / half * n)))]);
    else withValues(g, W, H, "B", plan.B[Math.max(0, Math.min(n, Math.round((t - half) / half * n)))]);
  }
  function overlapFrame(g, W, H, t, d) {
    shot(g, W, H, "A");
    var p = t < 0 ? 0 : F.progress(t, d);
    if (p <= 0) return;
    g.save(); g.beginPath();
    var id = st.pick, cx = W / 2, cy = H / 2;
    if (id === "crossfade") { g.globalAlpha = p; g.rect(0, 0, W, H); }
    else if (id === "linear") {
      var dir = st.dir, amt = p;
      if (dir === "left") g.rect(0, 0, W * amt, H); else if (dir === "right") g.rect(W * (1 - amt), 0, W * amt, H);
      else if (dir === "up") g.rect(0, 0, W, H * amt); else g.rect(0, H * (1 - amt), W, H * amt);
    } else if (id === "radial") { g.moveTo(cx, cy); g.arc(cx, cy, W, -Math.PI / 2, -Math.PI / 2 + p * Math.PI * 2); g.closePath(); }
    else if (id === "iris") { g.arc(cx, cy, p * Math.sqrt(cx * cx + cy * cy), 0, Math.PI * 2); }
    else if (id === "blinds") { var n = 8, vert = st.dir === "left" || st.dir === "right"; for (var i = 0; i < n; i++) { if (vert) g.rect(i * W / n, 0, W / n * p, H); else g.rect(0, i * H / n, W, H / n * p); } }
    else if (id === "dissolve") { var b = 12, cols = Math.ceil(W / b), rows = Math.ceil(H / b); for (var y = 0; y < rows; y++) for (var x = 0; x < cols; x++) { var r = Math.abs(Math.sin(x * 12.9898 + y * 78.233) * 43758.5453) % 1; if (r < p) g.rect(x * b, y * b, b, b); } }
    g.clip(); shot(g, W, H, "B"); g.restore();
  }

  // ---- choosing ------------------------------------------------------------------------------------------
  function chips(id, items, cur, pick) {
    var box = $(id); box.innerHTML = "";
    items.forEach(function (it) {
      var b = document.createElement("button"); b.textContent = it.name; b.className = it.id === cur ? "on" : "";
      b.addEventListener("click", function () { pick(it.id); st.t0 = performance.now(); render(); });
      box.appendChild(b);
    });
  }
  function render() {
    chips("fCut", TR.TRANSITIONS, st.pick, function (id) { st.pick = id; });
    chips("fOver", F.OVERLAPS, st.pick, function (id) { st.pick = id; });
    var t = F.overlap(st.pick) || TR.get(st.pick);
    if (t.dirs) chips("fDirs", [{ id: "left", name: "← Left" }, { id: "right", name: "Right →" }, { id: "up", name: "↑ Up" }, { id: "down", name: "Down ↓" }], st.dir, function (d) { st.dir = d; });
    else $("fDirs").innerHTML = "";
    $("fStrRow").hidden = isOver();
  }
  ["fDur", "fStr"].forEach(function (id) {
    var el = $(id), out = $(id + "Out"); function show() { out.textContent = id === "fDur" ? el.value + " s" : "×" + (+el.value).toFixed(2); }
    el.addEventListener("input", function () { show(); st.t0 = performance.now(); }); show();
  });

  // ---- After Effects ------------------------------------------------------------------------------------------
  $("fApply").addEventListener("click", function () {
    say("Reading the layers…", true);
    run("ae.flowInfo").then(function (r) {
      var ls = r.data.layers, pairs = F.pairs(ls), d = +$("fDur").value;
      if (ls.length < 2) throw "Select two or more layers that follow each other";
      if (isOver()) return run("ae.flowOverlap", { pairs: pairs, job: F.overlapJob(st.pick, { seconds: d, dir: st.dir, width: ls[0].width, height: ls[0].height }) });
      var plan = TR.plan(st.pick, { frames: Math.max(2, Math.round(d / 2 * r.data.fps)), strength: +$("fStr").value, dir: st.dir });
      return run("ae.flowCut", { plan: plan, pairs: pairs });
    }).then(function (r) { say(r.msg); }).catch(function (m) { say(String(m)); });
  });
  $("fRemove").addEventListener("click", function () { run("ae.flowRemove").then(function (r) { say(r.msg); }).catch(function (m) { say(String(m)); }); });

  render(); requestAnimationFrame(loop);
  if (!window.HaloBridge) say("Open this panel in After Effects to use it");
})();
