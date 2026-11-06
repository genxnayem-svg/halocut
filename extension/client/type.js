/* HaloCut Type panel (After Effects): live previews of each style, then real text animators on the layers.
 * © 2026 Imtayz Nayem */
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var T = window.HaloType;
  var st = { group: "In", style: "rise", based: 0, info: null, t0: performance.now() };
  var RND = {}; // a fixed shuffled order per unit count, for the random styles
  function order(n) {
    if (RND[n]) return RND[n];
    var a = [], seed = 7; for (var i = 0; i < n; i++) a.push(i);
    for (var j = n - 1; j > 0; j--) { seed = (seed * 9301 + 49297) % 233280; var k = Math.floor(seed / 233280 * (j + 1)), t = a[j]; a[j] = a[k]; a[k] = t; }
    var pos = []; a.forEach(function (u, p) { pos[u] = p; }); return (RND[n] = pos);
  }

  function say(t, busy) { $("tSum").className = "sum" + (busy ? " busy" : ""); $("tSumText").textContent = t; }
  function run(tool, args) {
    if (!window.HaloBridge) return Promise.reject("Open this panel in After Effects");
    if (window.HaloBridge.appId && window.HaloBridge.appId !== "AEFT") return Promise.reject("HaloCut Type is for After Effects");
    return window.HaloBridge.run(tool, args || {}).then(function (r) { if (!r.ok) throw r.msg; return r; });
  }
  function dur() { return +$("tDur").value; }
  function delay() { return +$("tDelay").value; }

  // ---- drawing a style at time t on any canvas ------------------------------------------------------
  function drawText(c, text, s, t, size, based) {
    var dpr = window.devicePixelRatio || 1, W = c.clientWidth || 100, H = c.clientHeight || 40;
    if (c.width !== Math.round(W * dpr)) { c.width = Math.round(W * dpr); c.height = Math.round(H * dpr); }
    var g = c.getContext("2d"); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
    var b = based || s.based, us = T.units(text, b), n = us.length, L = s.look, fs = size;
    g.font = "800 " + fs + "px -apple-system, 'Segoe UI', Inter, sans-serif"; g.textBaseline = "middle"; g.textAlign = "left";
    var rows = b === 4 ? us.map(function (u) { return [u]; }) : [us], widths = rows.map(function (r) { return r.reduce(function (w, u) { return w + g.measureText(u).width; }, 0); });
    var lh = fs * 1.15, top = H / 2 - (rows.length - 1) * lh / 2, idx = 0, rnd = s.random ? order(n) : null, extra = L.tracking ? 1 : 0;
    rows.forEach(function (row, ri) {
      var trackW = 0;
      if (extra) row.forEach(function (u, ui) { trackW += T.amount(s, idx + ui, n, t, 1, rnd) * L.tracking * fs * 0.25; });
      var x = (W - widths[ri] - trackW) / 2;
      row.forEach(function (u) {
        var a = T.amount(s, idx, n, t, 1, rnd), w = g.measureText(u).width, cx = x + w / 2, cy = top + ri * lh;
        var dx = (L.x || 0) * fs * a, dy = (L.y || 0) * fs * a, sc = L.scale !== undefined ? 1 + a * (L.scale / 100 - 1) : 1, rot = (L.rotation || 0) * a * Math.PI / 180;
        if (s.drive === "wiggle") { dx = Math.sin(t * 23 + idx * 7.1) * (L.x || 0) * fs; dy = Math.cos(t * 19 + idx * 3.7) * (L.y || 0) * fs; }
        g.save(); g.globalAlpha = L.opacity !== undefined ? 1 - a : 1;
        if (L.blur) g.filter = "blur(" + (L.blur * fs * a * 0.4).toFixed(1) + "px)";
        g.translate(cx + dx, cy + dy); g.rotate(rot); g.scale(sc, sc);
        g.fillStyle = "#fff"; g.fillText(u, -w / 2, 0);
        g.restore();
        x += w + (extra ? a * L.tracking * fs * 0.25 : 0); idx++;
      });
    });
  }
  // progress through one loop of the preview: hold, move, hold
  function clock(s, now, d) {
    var cyc = d + 1.2, t = ((now - st.t0) / 1000) % cyc;
    if (s.drive === "wave" || s.drive === "wiggle") return ((now - st.t0) / 1000) / d;
    return Math.max(0, Math.min(1, (t - 0.3) / d));
  }
  function loop(now) {
    var s = T.style(st.style), text = $("tText").value || "Text";
    drawText($("tStage"), text, s, clock(s, now, dur()), 40, st.based || 0);
    var tiles = document.querySelectorAll(".t-style canvas");
    for (var i = 0; i < tiles.length; i++) { var ts = T.style(tiles[i].getAttribute("data-id")); drawText(tiles[i], "Type", ts, clock(ts, now, 1), 20); }
    requestAnimationFrame(loop);
  }

  // ---- choosing ------------------------------------------------------------------------------------------
  function chips(id, items, cur, pick) {
    var box = $(id); box.innerHTML = "";
    items.forEach(function (it) {
      var b = document.createElement("button"); b.textContent = it.name; b.className = it.id === cur ? "on" : "";
      b.addEventListener("click", function () { pick(it.id); render(); });
      box.appendChild(b);
    });
  }
  function render() {
    chips("tGroups", T.GROUPS.map(function (g) { return { id: g, name: g }; }), st.group, function (g) { st.group = g; st.style = T.STYLES.filter(function (s) { return s.group === g; })[0].id; st.t0 = performance.now(); });
    var box = $("tStyles"); box.innerHTML = "";
    T.STYLES.filter(function (s) { return s.group === st.group; }).forEach(function (s) {
      var b = document.createElement("button"), c = document.createElement("canvas"), n = document.createElement("span");
      b.className = "t-style" + (s.id === st.style ? " on" : ""); c.setAttribute("data-id", s.id); n.textContent = s.name;
      b.appendChild(c); b.appendChild(n);
      b.addEventListener("click", function () { st.style = s.id; st.t0 = performance.now(); render(); });
      box.appendChild(b);
    });
    chips("tBased", [{ id: 0, name: "Style's" }].concat(T.BASED), st.based, function (v) { st.based = v; st.t0 = performance.now(); });
  }
  ["tDur", "tDelay"].forEach(function (id) {
    var el = $(id), out = $(id + "Out"); function show() { out.textContent = el.value + " s"; } el.addEventListener("input", function () { show(); st.t0 = performance.now(); }); show();
  });

  // ---- After Effects --------------------------------------------------------------------------------------
  function info() {
    return run("ae.typeInfo").then(function (r) {
      st.info = r.data;
      var ls = r.data.layers;
      if (!ls.length) throw r.data.selected ? "Those aren't text layers" : "Select text layers";
      $("tFrom").textContent = "· from " + ls[0].name;
      if (ls[0].text) $("tText").value = ls[0].text.replace(/\r/g, " ");
      return r.data;
    });
  }
  $("tApply").addEventListener("click", function () {
    say("Building the animator…", true);
    info().then(function (d) {
      var jobs = d.layers.map(function (l) {
        return Object.assign({ index: l.index }, T.job(st.style, { fontSize: l.fontSize, inPoint: l.inPoint, outPoint: l.outPoint, duration: dur(), delay: delay(), based: st.based || undefined, ease: $("tEase").checked }));
      });
      return run("ae.typeApply", { jobs: jobs });
    }).then(function (r) { say(r.msg); }).catch(function (m) { say(String(m)); });
  });
  $("tRetime").addEventListener("click", function () { run("ae.typeRetime", { duration: dur() }).then(function (r) { say(r.msg); }).catch(function (m) { say(String(m)); }); });
  $("tRemove").addEventListener("click", function () { run("ae.typeRemove").then(function (r) { say(r.msg); }).catch(function (m) { say(String(m)); }); });
  $("tLines").addEventListener("click", function () { run("ae.typeLines").then(function (r) { say(r.msg); }).catch(function (m) { say(String(m)); }); });

  window.onHaloReady = function () { info().then(function (d) { var have = d.layers[0].styles; say(have.length ? "On " + d.layers[0].name + ": " + have.join(", ") : "Pick a style, then Apply"); }).catch(function () {}); };
  render(); requestAnimationFrame(loop);
  if (!window.HaloBridge) say("Open this panel in After Effects to use it");
})();
