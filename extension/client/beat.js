/* HaloCut Beat panel: analyse the music clip, then markers, cuts and pulses on its beats.
 * © 2026 Imtayz Nayem */
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var B = window.HaloBeat, S = window.HaloSilence, K = window.HaloMarkers;
  var st = null; // { clip, levels, a: analysis }
  var taps = [];

  function say(text, busy) { $("bSum").className = "sum" + (busy ? " busy" : ""); $("bSumText").textContent = text; }
  function bridge(tool, args) {
    if (!window.HaloBridge) { say("Open this panel in Premiere Pro"); return Promise.resolve({ ok: false }); }
    say("Working…", true);
    return window.HaloBridge.run(tool, args || {}).then(function (r) { say(r.msg); return r; });
  }

  K.COLORS.forEach(function (c, i) { $("bMarkColor").add(new Option(c[0] + " markers", String(i))); });
  $("bMarkColor").value = "6";

  // ---- analyse --------------------------------------------------------------------
  $("bGo").addEventListener("click", function () {
    var ff = S.findFfmpeg((function () { try { return localStorage.getItem("halocut.ffmpeg"); } catch (e) { return null; } })());
    if (!ff) return say("FFmpeg not found on this computer");
    bridge("pr.studioClips").then(function (res) {
      if (!res.ok) return;
      var clip = res.data.clips.sort(function (x, y) { return (y.end - y.start) - (x.end - x.start); })[0]; // the longest selected
      say("Listening to “" + clip.name + "”…", true);
      S.readLevels(ff, clip.path, clip.inPoint, clip.outPoint, function (err, full) {
        if (err) return say(err.message);
        S.readLevels(ff, clip.path, clip.inPoint, clip.outPoint, function (err2, low) {
          var a = B.analyse(full, err2 ? null : low);
          st = { clip: clip, levels: full, a: a };
          show();
          say("Found " + a.bpm + " BPM in “" + clip.name + "” · " + a.beats.length + " beats");
        }, "lowpass=f=150");
      });
    });
  });

  // Beat times on the timeline, inside the clip
  function onTimeline(list) {
    return list.map(function (t) { return st.clip.start + t; }).filter(function (t) { return t >= st.clip.start - 1e-6 && t <= st.clip.end + 1e-6; });
  }

  function show() {
    $("bResult").hidden = false; $("bWaveBox").hidden = false;
    $("bBpm").textContent = String(Math.round(st.a.bpm * 10) / 10);
    $("bConf").textContent = st.a.confidence < 0.35 ? "· not sure: check with Tap" : "";
    draw();
  }

  // same as HaloSilence.summary, for a browser preview where the Node module isn't there
  function summary(levels, buckets) {
    var out = [], per = levels.length / buckets;
    for (var b = 0; b < buckets; b++) {
      var peak = -120;
      for (var i = Math.floor(b * per); i < Math.floor((b + 1) * per); i++) if (levels[i] > peak) peak = levels[i];
      out.push(Math.max(0, Math.min(1, (peak + 60) / 60)));
    }
    return out;
  }

  function draw() {
    var c = $("bWave"), dpr = window.devicePixelRatio || 1, w = c.clientWidth, h = c.clientHeight;
    c.width = w * dpr; c.height = h * dpr;
    var g = c.getContext("2d");
    g.scale(dpr, dpr);
    var len = st.a.length, x = function (t) { return (t / len) * w; };
    var grad = g.createLinearGradient(0, 0, w, 0);
    grad.addColorStop(0, "#ff8a3d"); grad.addColorStop(0.6, "#e8457c"); grad.addColorStop(1, "#a35bf0");
    g.fillStyle = grad;
    var bars = Math.max(1, Math.floor(w / 2)), sum = S ? S.summary(st.levels, bars) : summary(st.levels, bars);
    for (var i = 0; i < bars; i++) { var bh = Math.max(1, sum[i] * (h - 14)); g.fillRect(i * 2, (h - bh) / 2, 1.4, bh); }
    st.a.beats.forEach(function (t, k) {
      var bar = ((k - st.a.bar) % 4 + 4) % 4 === 0;
      g.fillStyle = bar ? "rgba(255,255,255,.9)" : "rgba(255,255,255,.35)";
      g.fillRect(Math.round(x(t)), bar ? 0 : h - 8, 1, bar ? h : 8);
    });
    $("bFrom").textContent = "0:00";
    $("bTo").textContent = Math.floor(len / 60) + ":" + ("0" + Math.floor(len % 60)).slice(-2);
  }

  // ---- fix the tempo ------------------------------------------------------------------
  function retempo(bpm) {
    if (!st) return;
    var anchor = st.a.beats[Math.min(st.a.beats.length - 1, Math.max(0, st.a.bar))] || 0;
    st.a.beats = B.regrid(anchor, bpm, st.a.length);
    st.a.bpm = bpm;
    var idx = 0;
    st.a.beats.forEach(function (t, k) { if (Math.abs(t - anchor) < 1e-3) idx = k; });
    st.a.bar = idx % 4;
    show();
    say("Now " + (Math.round(bpm * 10) / 10) + " BPM, kept on the first bar");
  }
  $("bHalf").addEventListener("click", function () { if (st) retempo(st.a.bpm / 2); });
  $("bDouble").addEventListener("click", function () { if (st) retempo(st.a.bpm * 2); });
  $("bTap").addEventListener("click", function () {
    var now = performance.now() / 1000;
    if (taps.length && now - taps[taps.length - 1] > 2) taps = [];
    taps.push(now);
    $("bTap").classList.add("tapping");
    var bpm = B.tapBpm(taps);
    if (bpm && taps.length >= 4) { $("bTap").textContent = bpm; retempo(bpm); }
    clearTimeout($("bTap").t);
    $("bTap").t = setTimeout(function () { taps = []; $("bTap").textContent = "Tap"; $("bTap").classList.remove("tapping"); }, 2200);
  });

  // ---- use the beats ---------------------------------------------------------------------
  function need() { if (!st) { say("Analyse the music first"); return false; } return true; }

  $("bMark").addEventListener("click", function () {
    if (!need()) return;
    var every = $("bMarkEvery").value, times = onTimeline(B.pick(st.a, every)), color = +$("bMarkColor").value;
    var items = times.map(function (t, i) { return { start: t, name: every === "hits" ? "Hit " + (i + 1) : (every === "bar" ? "Bar " : "Beat ") + (i + 1), color: color, comments: "HaloCut beat" }; });
    if (!items.length) return say("No beats inside the clip");
    bridge("pr.markersAdd", { items: items });
  });
  $("bMarkRemove").addEventListener("click", function () { bridge("pr.beatMarkersRemove"); });

  $("bCut").addEventListener("click", function () {
    if (!need()) return;
    var times = onTimeline(B.pick(st.a, $("bCutEvery").value)).filter(function (t) { return t > st.clip.start + 0.01; });
    if (!times.length) return say("No beats inside the clip");
    bridge("pr.cutAt", { times: times, all: $("bEvery").checked });
  });

  function showAmt() { $("bAmtOut").textContent = $("bAmt").value + "%"; }
  $("bAmt").addEventListener("input", showAmt);
  $("bPulse").addEventListener("click", function () {
    if (!need()) return;
    var period = 60 / st.a.bpm;
    bridge("pr.pulse", { times: onTimeline(B.pick(st.a, $("bPulseEvery").value)), amount: +$("bAmt").value, length: Math.min(0.25, period * 0.45) });
  });
  $("bPulseRemove").addEventListener("click", function () { bridge("pr.pulseRemove"); });

  window.addEventListener("resize", function () { if (st) draw(); });
  showAmt();

  // a browser preview: a made-up 120 BPM analysis so the layout can be seen
  if (!window.cep_node && !window.__adobe_cep__) {
    var lv = new Float32Array(1600);
    for (var i = 0; i < lv.length; i++) lv[i] = -40 + 30 * Math.exp(-((i % 50) / 6)) + Math.random() * 4;
    st = { clip: { start: 0, end: 16 }, levels: lv, a: { bpm: 120, confidence: 0.8, beats: B.regrid(0, 120, 16), bar: 0, hits: [], length: 16 } };
    show();
  }
})();
