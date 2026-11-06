/* HaloCut Transitions panel: pick a transition, preview it on two clips, apply it to cuts.
 * © 2026 Imtayz Nayem */
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var R = window.HaloTrans;
  var st = { id: "zoomIn", dir: "left", fps: 25, playing: true, t0: performance.now() };

  function say(t, busy) { $("tSum").className = "sum" + (busy ? " busy" : ""); $("tSumText").textContent = t; }
  function framesPerSide() { return Math.max(2, Math.round((+$("tDur").value / 2) * st.fps)); }
  function plan() { return R.plan(st.id, { frames: framesPerSide(), strength: +$("tStr").value, dir: st.dir }); }

  function chips() {
    var box = $("tList");
    box.innerHTML = "";
    R.TRANSITIONS.forEach(function (t) {
      var b = document.createElement("button");
      b.textContent = t.name; b.className = t.id === st.id ? "on" : "";
      b.addEventListener("click", function () { st.id = t.id; chips(); restart(); });
      box.appendChild(b);
    });
    var tr = R.get(st.id), d = $("tDirs");
    d.hidden = !tr.dirs;
    d.innerHTML = "";
    if (tr.dirs) Object.keys(R.DIRS).forEach(function (k) {
      var b = document.createElement("button");
      b.textContent = { left: "← Left", right: "Right →", up: "↑ Up", down: "Down ↓" }[k];
      b.className = st.dir === k ? "on" : "";
      b.addEventListener("click", function () { st.dir = k; chips(); restart(); });
      d.appendChild(b);
    });
  }

  function show() { $("tDurOut").textContent = (+$("tDur").value).toFixed(2) + " s"; $("tStrOut").textContent = Math.round(+$("tStr").value * 100) + "%"; }
  ["tDur", "tStr"].forEach(function (id) { $(id).addEventListener("input", function () { show(); restart(); }); });
  function restart() { st.t0 = performance.now(); }

  // ---- preview: clip A, the cut, clip B, played with the same values Premiere will get ----
  function card(g, W, H, v, colours, label) {
    g.save();
    var blur = v.blur * (W / 1920) * 1.4;
    var filters = [];
    if (blur > 0.2) filters.push("blur(" + blur.toFixed(1) + "px)");
    if (v.bright > 0.5) filters.push("brightness(" + (1 + v.bright / 60).toFixed(2) + ")");
    g.filter = filters.length ? filters.join(" ") : "none";
    g.globalAlpha = v.opacity / 100;
    g.translate(v.x * W, v.y * H);
    g.rotate((v.rot * Math.PI) / 180);
    var sw = (v.nonUniform ? v.scaleW : v.scale) / 100, sh = (v.nonUniform ? v.scaleH : v.scale) / 100;
    g.scale(sw, sh);
    var copies = v.len > 1 ? 6 : 1;
    for (var c = 0; c < copies; c++) {
      var off = copies > 1 ? ((c / (copies - 1)) - 0.5) * v.len * (W / 1920) : 0, ang = ((v.dir - 90) * Math.PI) / 180;
      g.globalAlpha = (v.opacity / 100) * (copies > 1 ? 0.28 : 1);
      g.save();
      g.translate(Math.cos(ang) * off, Math.sin(ang) * off);
      var grad = g.createLinearGradient(-W / 2, -H / 2, W / 2, H / 2);
      grad.addColorStop(0, colours[0]); grad.addColorStop(1, colours[1]);
      g.fillStyle = grad; g.fillRect(-W / 2, -H / 2, W, H);
      g.fillStyle = "rgba(255,255,255,.85)";
      g.font = "700 " + Math.round(H * 0.22) + "px -apple-system, sans-serif"; g.textAlign = "center"; g.textBaseline = "middle";
      g.fillText(label, 0, 0);
      g.restore();
    }
    g.restore();
  }

  function loop(now) {
    var c = $("tPreview"), dpr = window.devicePixelRatio || 1, W = c.clientWidth, H = c.clientHeight;
    if (c.width !== W * dpr) { c.width = W * dpr; c.height = H * dpr; }
    var g = c.getContext("2d");
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.fillStyle = "#000"; g.fillRect(0, 0, W, H);
    var p = plan(), n = p.A.length - 1, side = n / st.fps, cycle = side * 2 + 1.2;
    var t = st.playing ? ((now - st.t0) / 1000) % cycle - 0.6 : side; // −0.6 s of plain A, the transition, then plain B
    var v, a = true;
    if (t < 0) v = R.NEUTRAL;
    else if (t < side) v = p.A[Math.min(n, Math.round((t / side) * n))];
    else if (t < side * 2) { a = false; v = p.B[Math.min(n, Math.round(((t - side) / side) * n))]; }
    else { a = false; v = R.NEUTRAL; }
    card(g, W, H, R.full(v), a ? ["#5a4bd6", "#b0428f"] : ["#ff8a3d", "#e8457c"], a ? "A" : "B");
    requestAnimationFrame(loop);
  }
  $("tPlay").addEventListener("click", function () { st.playing = !st.playing; $("tPlay").textContent = st.playing ? "❚❚" : "▶"; restart(); });

  // ---- apply ---------------------------------------------------------------------------
  function apply() {
    if (!window.HaloBridge) return say("Open this panel in Premiere Pro to apply");
    say("Keying both sides of the cut…", true);
    window.HaloBridge.run("pr.transApply", { plan: plan() }).then(function (r) { say(r.msg); });
  }
  $("tApply").addEventListener("click", apply);
  $("tRemove").addEventListener("click", function () {
    if (!window.HaloBridge) return say("Open this panel in Premiere Pro");
    window.HaloBridge.run("pr.transRemove", {}).then(function (r) { say(r.msg); });
  });

  document.addEventListener("keydown", function (ev) {
    if (ev.target.tagName === "INPUT") return;
    var ids = R.TRANSITIONS.map(function (t) { return t.id; }), i = ids.indexOf(st.id);
    if (ev.key === " ") { $("tPlay").click(); ev.preventDefault(); }
    else if (ev.key === "ArrowRight") { st.id = ids[(i + 1) % ids.length]; chips(); restart(); }
    else if (ev.key === "ArrowLeft") { st.id = ids[(i - 1 + ids.length) % ids.length]; chips(); restart(); }
    else if (ev.key === "Enter") { apply(); ev.preventDefault(); }
  });

  window.onHaloReady = function () {
    if (!window.HaloBridge) return;
    window.HaloBridge.run("pr.guidesInfo", {}).then(function (r) {
      if (!r.ok) return;
      $("tPreview").style.aspectRatio = r.data.w + " / " + r.data.h;
    });
    window.HaloBridge.run("pr.markersList", {}).then(function (r) { if (r.ok) st.fps = r.data.fps || 25; });
  };

  show(); chips(); requestAnimationFrame(loop);
})();
