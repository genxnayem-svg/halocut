/* HaloCut Studio — Silence tab. Listens to the selected clips, marks the pauses, cuts them in sync.
 * © 2026 Imtayz Nayem */
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var S = window.HaloSilence;
  var PRESETS = {
    gentle: { th: -48, min: 0.6, keep: 0.2 },
    normal: { th: -40, min: 0.4, keep: 0.12 },
    tight: { th: -34, min: 0.25, keep: 0.06 }
  };
  var state = { clips: [], regions: [], from: 0, to: 0, kept: {} };

  // ---- tabs ------------------------------------------------------------------
  var SOON = {};
  Array.prototype.forEach.call(document.querySelectorAll("#tabs button"), function (b) {
    b.addEventListener("click", function () {
      Array.prototype.forEach.call(document.querySelectorAll("#tabs button"), function (x) { x.classList.toggle("on", x === b); });
      var tab = b.dataset.tab, soon = !!SOON[tab];
      $("tab-silence").hidden = tab !== "silence";
      $("tab-guides").hidden = tab !== "guides";
      $("tab-captions").hidden = tab !== "captions";
      $("tab-timeline").hidden = tab !== "timeline";
      $("tab-effects").hidden = tab !== "effects";
      if (tab === "effects" && window.onEffectsTab) window.onEffectsTab();
      $("tab-soon").hidden = !soon;
      if (tab === "guides" && window.onGuidesTab) window.onGuidesTab();
      if (soon) $("soonTitle").textContent = SOON[b.dataset.tab];
    });
  });

  // ---- settings ----------------------------------------------------------------
  function opts() { return { thresholdDb: +$("th").value, minPause: +$("min").value, keep: +$("keep").value }; }

  function showValues() {
    $("thOut").textContent = $("th").value + " dB";
    $("minOut").textContent = (+$("min").value).toFixed(2) + " s";
    $("keepOut").textContent = (+$("keep").value).toFixed(2) + " s";
  }

  ["th", "min", "keep"].forEach(function (id) {
    $(id).addEventListener("input", function () {
      showValues();
      Array.prototype.forEach.call(document.querySelectorAll(".presets button"), function (x) { x.classList.remove("on"); });
      recompute();
    });
  });

  Array.prototype.forEach.call(document.querySelectorAll(".presets button"), function (b) {
    b.addEventListener("click", function () {
      var p = PRESETS[b.dataset.p];
      $("th").value = p.th; $("min").value = p.min; $("keep").value = p.keep;
      Array.prototype.forEach.call(document.querySelectorAll(".presets button"), function (x) { x.classList.toggle("on", x === b); });
      showValues();
      recompute();
    });
  });

  function setSum(text, busy) {
    $("sum").className = "sum" + (busy ? " busy" : "");
    $("sum").lastChild.textContent = text;
  }

  function fmt(sec) {
    var m = Math.floor(sec / 60), s = sec - m * 60;
    return m + ":" + (s < 10 ? "0" : "") + s.toFixed(1);
  }

  // ---- analyse -----------------------------------------------------------------
  function ffmpegPath() {
    var saved = null;
    try { saved = localStorage.getItem("halocut.ffmpeg"); } catch (e) {}
    return S.findFfmpeg(saved);
  }

  $("analyse").addEventListener("click", function () {
    if (!window.HaloBridge) return setSum("Still starting, try again");
    var ff = ffmpegPath();
    if (!ff) return setSum("FFmpeg not found on this computer");
    setSum("Reading the timeline…", true);
    window.HaloBridge.run("pr.studioClips", {}).then(function (res) {
      if (!res.ok) return setSum(res.msg);
      var info = res.data;
      fillTracks(info.audioTracks);
      var music = +$("music").value;
      var list = info.clips.filter(function (c) { return c.track !== music; });
      state = { clips: [], regions: [], from: 0, to: 0, kept: {} };
      var left = list.length;
      if (!left) return setSum("Only the music track is selected");
      setSum("Listening to " + left + " clip" + (left === 1 ? "" : "s") + "…", true);
      list.forEach(function (clip) {
        S.readLevels(ff, clip.path, clip.inPoint, clip.outPoint, function (err, levels) {
          if (err) clip.error = err.message; else { clip.levels = levels; state.clips.push(clip); }
          if (--left === 0) done();
        });
      });
      function done() {
        if (!state.clips.length) return setSum(list[0].error || "Could not read the sound");
        state.from = Math.min.apply(null, state.clips.map(function (c) { return c.start; }));
        state.to = Math.max.apply(null, state.clips.map(function (c) { return c.end; }));
        $("waveBox").hidden = false;
        recompute();
      }
    });
  });

  function fillTracks(names) {
    var sel = $("music"), was = sel.value;
    sel.innerHTML = '<option value="-1">None</option>';
    names.forEach(function (n, i) { sel.add(new Option("A" + (i + 1) + (n && n !== "A" + (i + 1) ? " · " + n : ""), String(i))); });
    if (+was < names.length) sel.value = was;
  }

  // ---- pauses ------------------------------------------------------------------
  var key = function (r) { return Math.round(r.start * 10) + ":" + Math.round(r.end * 10); };

  function recompute() {
    if (!state.clips.length) return;
    var o = opts();
    state.regions = S.toTimeline(state.clips.map(function (c) {
      return { timelineStart: c.start, pauses: S.detectPauses(c.levels, o) };
    }));
    state.regions.forEach(function (r) { if (state.kept[key(r)]) r.on = false; });
    draw();
    summary();
  }

  function summary() {
    var on = state.regions.filter(function (r) { return r.on; });
    var secs = on.reduce(function (n, r) { return n + (r.end - r.start); }, 0);
    setSum(on.length + " pause" + (on.length === 1 ? "" : "s") + " · −" + secs.toFixed(1) + " s");
    $("remove").disabled = !on.length;
  }

  // ---- waveform ----------------------------------------------------------------
  function draw() {
    var c = $("wave"), dpr = window.devicePixelRatio || 1;
    var w = c.clientWidth, h = c.clientHeight;
    c.width = w * dpr; c.height = h * dpr;
    var g = c.getContext("2d");
    g.scale(dpr, dpr);
    g.clearRect(0, 0, w, h);
    var span = Math.max(0.01, state.to - state.from);
    var x = function (t) { return ((t - state.from) / span) * w; };

    state.regions.forEach(function (r) {
      g.fillStyle = r.on ? "rgba(232, 69, 124, 0.28)" : "rgba(255, 255, 255, 0.06)";
      g.fillRect(x(r.start), 0, Math.max(1, x(r.end) - x(r.start)), h);
    });

    var grad = g.createLinearGradient(0, 0, w, 0);
    grad.addColorStop(0, "#ff8a3d"); grad.addColorStop(0.6, "#e8457c"); grad.addColorStop(1, "#a35bf0");
    g.fillStyle = grad;
    state.clips.forEach(function (clip) {
      var x0 = x(clip.start), x1 = x(clip.end), bars = Math.max(1, Math.floor((x1 - x0) / 2));
      var sum = S.summary(clip.levels, bars);
      for (var i = 0; i < bars; i++) {
        var bh = Math.max(1, sum[i] * (h - 6));
        g.fillRect(x0 + i * 2, (h - bh) / 2, 1.4, bh);
      }
    });

    state.regions.forEach(function (r) {
      if (r.on) return;
      g.strokeStyle = "rgba(255,255,255,.5)";
      g.setLineDash([3, 3]);
      g.strokeRect(x(r.start) + 0.5, 0.5, Math.max(1, x(r.end) - x(r.start)) - 1, h - 1);
      g.setLineDash([]);
    });
    $("waveFrom").textContent = fmt(state.from);
    $("waveTo").textContent = fmt(state.to);
  }

  $("wave").addEventListener("click", function (ev) {
    var rect = ev.target.getBoundingClientRect();
    var t = state.from + ((ev.clientX - rect.left) / rect.width) * (state.to - state.from);
    var hit = state.regions.filter(function (r) { return t >= r.start - 0.05 && t <= r.end + 0.05; })[0];
    if (!hit) return;
    hit.on = !hit.on;
    state.kept[key(hit)] = !hit.on;
    draw();
    summary();
  });

  window.addEventListener("resize", function () { if (state.clips.length) draw(); });

  // ---- remove ------------------------------------------------------------------
  $("remove").addEventListener("click", function () {
    var regions = state.regions.filter(function (r) { return r.on; }).map(function (r) { return { start: r.start, end: r.end }; });
    if (!regions.length) return;
    var music = +$("music").value;
    $("remove").disabled = true;
    setSum("Cutting " + regions.length + " pauses…", true);
    window.HaloBridge.run("pr.studioCut", { regions: regions, keepCopy: $("copy").checked, skipAudio: music >= 0 ? [music] : [] })
      .then(function (res) {
        setSum(res.ok ? "Done · " + res.msg : res.msg);
        if (res.ok) { state = { clips: [], regions: [], from: 0, to: 0, kept: {} }; $("waveBox").hidden = true; }
        else $("remove").disabled = false;
      });
  });

  showValues();
})();
