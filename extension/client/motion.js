/* HaloCut Motion panel: pick or tune a start and an end look, preview the move, apply it as keyframes.
 * © 2026 Imtayz Nayem */
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var M = window.HaloMotion;
  var clone = function (o) { return JSON.parse(JSON.stringify(o)); };
  var state = { look: M.LOOKS[0], start: clone(M.LOOKS[0].start), end: clone(M.LOOKS[0].end), ease: M.LOOKS[0].ease, editing: "start" };
  var frame = { w: 1920, h: 1080 };
  var FIELDS = [["x", "X %"], ["y", "Y %"], ["scale", "Scale %"], ["rotation", "Turn °"], ["opacity", "Opacity %"],
    ["crop.l", "Crop left"], ["crop.t", "Crop top"], ["crop.r", "Crop right"], ["crop.b", "Crop bottom"]];

  function say(text, busy) { $("mSum").className = "sum" + (busy ? " busy" : ""); $("mSumText").textContent = text; }

  // ---- looks and easing chips --------------------------------------------------
  function chips() {
    var box = $("mLooks");
    box.innerHTML = "";
    M.LOOKS.forEach(function (l) {
      var b = document.createElement("button");
      b.textContent = l.name;
      b.className = state.look && state.look.id === l.id ? "on" : "";
      b.addEventListener("click", function () {
        state.look = l; state.start = clone(l.start); state.end = clone(l.end); state.ease = l.ease;
        if (l.whole) $("mWhen").value = "whole";
        refresh(true);
      });
      box.appendChild(b);
    });
    var eb = $("mEases");
    eb.innerHTML = "";
    Object.keys(M.EASES).forEach(function (k) {
      var b = document.createElement("button");
      b.textContent = M.EASES[k].name;
      b.className = state.ease === k ? "on" : "";
      b.addEventListener("click", function () { state.ease = k; refresh(true); });
      eb.appendChild(b);
    });
  }

  // ---- start / end values -------------------------------------------------------
  function get(l, key) { return key.indexOf("crop.") === 0 ? l.crop[key.slice(5)] : l[key]; }
  function set(l, key, v) { if (key.indexOf("crop.") === 0) l.crop[key.slice(5)] = v; else l[key] = v; }

  function fields() {
    var box = $("mFields"), l = state[state.editing];
    box.innerHTML = "";
    FIELDS.forEach(function (f) {
      var lab = document.createElement("label");
      lab.textContent = f[1];
      var inp = document.createElement("input");
      inp.type = "number"; inp.step = f[0] === "rotation" ? "5" : "1";
      inp.value = Math.round(get(l, f[0]) * 10) / 10;
      inp.addEventListener("input", function () {
        var v = parseFloat(inp.value);
        if (isNaN(v)) return;
        set(state[state.editing], f[0], v);
        state.look = null; // now your own look
        chips(); restart();
      });
      lab.appendChild(inp);
      box.appendChild(lab);
    });
    Array.prototype.forEach.call(document.querySelectorAll("#mWhich [data-w]"), function (b) { b.classList.toggle("on", b.dataset.w === state.editing); });
  }

  Array.prototype.forEach.call(document.querySelectorAll("#mWhich [data-w]"), function (b) {
    b.addEventListener("click", function () { state.editing = b.dataset.w; fields(); });
  });
  $("mSwap").addEventListener("click", function () { var t = state.start; state.start = state.end; state.end = t; state.look = null; refresh(true); });

  // ---- timing -------------------------------------------------------------------------
  function showLen() {
    $("mLenOut").textContent = (+$("mLen").value).toFixed(1) + " s";
    $("mLenRow").style.display = $("mWhen").value === "whole" ? "none" : "";
  }
  $("mLen").addEventListener("input", function () { showLen(); restart(); });
  $("mWhen").addEventListener("change", function () { showLen(); restart(); });
  $("mDir").addEventListener("change", restart);

  // ---- preview: a clip card on a frame, moving the way it will in Premiere ------------
  var anim = { t0: 0, playing: true };
  function restart() { anim.t0 = performance.now(); }

  function drawClip(g, W, H, k) {
    g.save();
    g.globalAlpha = k.opacity / 100;
    g.translate((k.x / 100) * W, (k.y / 100) * H);
    g.rotate((k.rotation * Math.PI) / 180);
    var s = k.scale / 100, w = W * s, h = H * s;
    var x0 = -w / 2 + (k.crop.l / 100) * w, y0 = -h / 2 + (k.crop.t / 100) * h;
    var cw = w * (1 - (k.crop.l + k.crop.r) / 100), ch = h * (1 - (k.crop.t + k.crop.b) / 100);
    if (cw > 0 && ch > 0) {
      g.beginPath(); g.rect(x0, y0, cw, ch); g.clip();
      var grad = g.createLinearGradient(-w / 2, -h / 2, w / 2, h / 2);
      grad.addColorStop(0, "#5a4bd6"); grad.addColorStop(0.55, "#b0428f"); grad.addColorStop(1, "#ff8a3d");
      g.fillStyle = grad;
      g.fillRect(-w / 2, -h / 2, w, h);
      g.fillStyle = "rgba(255,255,255,.9)";
      g.beginPath(); g.arc(-w * 0.18, -h * 0.05, h * 0.16, 0, Math.PI * 2); g.fill();
      g.fillRect(-w * 0.02, -h * 0.12, w * 0.3, h * 0.06);
      g.fillRect(-w * 0.02, h * 0.02, w * 0.22, h * 0.06);
    }
    g.restore();
  }

  function frameLoop(now) {
    var c = $("mPreview"), dpr = window.devicePixelRatio || 1;
    var W = c.clientWidth, H = c.clientHeight;
    if (c.width !== W * dpr) { c.width = W * dpr; c.height = H * dpr; }
    var g = c.getContext("2d");
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.fillStyle = "#0d0a10"; g.fillRect(0, 0, W, H);
    g.strokeStyle = "rgba(255,255,255,.06)";
    for (var gx = W / 8; gx < W; gx += W / 8) { g.beginPath(); g.moveTo(gx, 0); g.lineTo(gx, H); g.stroke(); }
    var len = $("mWhen").value === "whole" ? 3 : +$("mLen").value;
    var cycle = len + 0.7;
    var t = ((now - anim.t0) / 1000) % cycle;
    var curve = M.curve(state.ease, $("mDir").value, 120);
    // paused: show the look being edited, so changing a number shows straight away
    var k = anim.playing ? M.between(state.start, state.end, M.sample(curve, Math.min(1, t / len))) : state[state.editing];
    drawClip(g, W, H, k);
    g.strokeStyle = "rgba(255,255,255,.25)"; g.strokeRect(0.5, 0.5, W - 1, H - 1);
    requestAnimationFrame(frameLoop);
  }

  $("mPlay").addEventListener("click", toggle);
  function toggle() { anim.playing = !anim.playing; $("mPlay").textContent = anim.playing ? "❚❚" : "▶"; restart(); }

  // ---- apply / remove ---------------------------------------------------------------
  function apply() {
    if (!window.HaloBridge) return say("Open this panel in Premiere Pro to apply");
    say("Writing keyframes…", true);
    window.HaloBridge.run("pr.motionApply", {
      start: state.start, end: state.end, curve: M.curve(state.ease, $("mDir").value, 120),
      timing: { mode: $("mWhen").value, seconds: +$("mLen").value },
    }).then(function (res) { say(res.msg); });
  }
  $("mApply").addEventListener("click", apply);
  $("mRemove").addEventListener("click", function () {
    if (!window.HaloBridge) return say("Open this panel in Premiere Pro");
    window.HaloBridge.run("pr.motionRemove", {}).then(function (res) { say(res.msg); });
  });

  document.addEventListener("keydown", function (ev) {
    if (ev.target.tagName === "INPUT" || ev.target.tagName === "SELECT") return;
    if (ev.key === " ") { toggle(); ev.preventDefault(); }
    if (ev.key === "Enter") { apply(); ev.preventDefault(); }
  });

  function refresh(again) { chips(); fields(); if (again) restart(); }

  // use the sequence's own frame shape for the preview
  window.onHaloReady = function () {
    if (!window.HaloBridge) return;
    window.HaloBridge.run("pr.guidesInfo", {}).then(function (res) {
      if (!res.ok) return;
      frame = { w: res.data.w, h: res.data.h };
      $("mPreview").style.aspectRatio = frame.w + " / " + frame.h;
    });
  };

  showLen();
  refresh(true);
  requestAnimationFrame(frameLoop);
})();
