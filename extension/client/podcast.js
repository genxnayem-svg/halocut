/* HaloCut Podcast panel: cameras follow the voices, music dips under them.
 * © 2026 Imtayz Nayem */
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var P = window.HaloPodcast, SIL = window.HaloSilence;
  var COLORS = ["#ff8a3d", "#36c2ff", "#4be3b0", "#c084fc", "#ffd24a", "#ff5ca8", "#7dd3fc", "#a3e635"], WIDE = "#9a93a6";
  var st = { tab: "cam", tracks: null, cams: saved("halocut.podCams", [{ v: 0, a: 0 }, { v: 1, a: 1 }]), wide: saved("halocut.podWide", -1),
    set: saved("halocut.podSet", { minShot: 2, delay: 0.5, wideAfter: 4, depth: 14, attack: 0.3, release: 0.8 }),
    music: saved("halocut.podMusic", -1), voices: saved("halocut.podVoices", null), levels: {}, cuts: null, regions: null, busy: false };

  function saved(key, fallback) { try { var v = JSON.parse(localStorage.getItem(key)); return v === null ? fallback : v; } catch (e) { return fallback; } }
  function store(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) {} }
  function say(t, busy) { $("pSum").className = "sum" + (busy ? " busy" : ""); $("pSumText").textContent = t; }
  function plural(n, w) { return n + " " + w + (n === 1 ? "" : "s"); }
  function saveAll() { store("halocut.podCams", st.cams); store("halocut.podWide", st.wide); store("halocut.podSet", st.set); store("halocut.podMusic", st.music); store("halocut.podVoices", st.voices); }

  // ---- tracks -----------------------------------------------------------------------------------------
  function trackOptions(sel, list, kind, cur, none) {
    sel.innerHTML = "";
    if (none) sel.add(new Option(none, "-1"));
    list.forEach(function (t) { sel.add(new Option(kind + (t.index + 1) + (t.name && t.name !== kind + (t.index + 1) ? " · " + t.name : "") + (t.clips ? "" : " (empty)"), String(t.index))); });
    sel.value = String(cur);
  }
  function cams() {
    var box = $("pCams"), T = st.tracks || { video: [0, 1, 2].map(function (i) { return { index: i, clips: 1 }; }), audio: [0, 1, 2].map(function (i) { return { index: i, clips: 1 }; }) };
    box.innerHTML = "";
    st.cams.forEach(function (c, i) {
      var row = document.createElement("div"), tag = document.createElement("i"), v = document.createElement("select"), a = document.createElement("select"), x = document.createElement("button");
      row.className = "p-cam"; tag.textContent = i + 1; tag.style.background = COLORS[i];
      trackOptions(v, T.video, "V", c.v); trackOptions(a, T.audio, "A", c.a);
      v.title = "Camera"; a.title = "Its mic";
      v.addEventListener("change", function () { c.v = +v.value; st.cuts = null; saveAll(); draw(); });
      a.addEventListener("change", function () { c.a = +a.value; st.cuts = null; saveAll(); draw(); });
      x.textContent = "×"; x.title = "Remove"; x.disabled = st.cams.length <= 2;
      x.addEventListener("click", function () { st.cams.splice(i, 1); st.cuts = null; saveAll(); cams(); draw(); });
      row.appendChild(tag); row.appendChild(v); row.appendChild(a); row.appendChild(x); box.appendChild(row);
    });
    $("pAdd").hidden = st.cams.length >= 8;
    trackOptions($("pWide"), T.video, "V", st.wide, "None");
    $("pAfterRow").hidden = st.wide < 0;
    trackOptions($("pMusic"), T.audio, "A", st.music, "Pick the music");
    var vb = $("pVoices"); vb.innerHTML = "";
    if (!st.voices) st.voices = T.audio.filter(function (t) { return t.index !== st.music && t.clips; }).map(function (t) { return t.index; });
    T.audio.filter(function (t) { return t.index !== st.music; }).forEach(function (t) {
      var l = document.createElement("label"), cb = document.createElement("input");
      cb.type = "checkbox"; cb.checked = st.voices.indexOf(t.index) >= 0;
      cb.addEventListener("change", function () { st.voices = st.voices.filter(function (x) { return x !== t.index; }); if (cb.checked) st.voices.push(t.index); st.regions = null; saveAll(); draw(); });
      l.appendChild(cb); l.appendChild(document.createTextNode("A" + (t.index + 1) + (t.name && t.name !== "A" + (t.index + 1) ? " · " + t.name : "")));
      vb.appendChild(l);
    });
  }
  $("pAdd").addEventListener("click", function () {
    var used = st.cams.map(function (c) { return c.v; }), n = st.cams.length;
    st.cams.push({ v: used.indexOf(n) < 0 ? n : 0, a: n }); st.cuts = null; saveAll(); cams(); draw();
  });
  $("pWide").addEventListener("change", function () { st.wide = +$("pWide").value; st.cuts = null; saveAll(); cams(); refit(); });
  $("pMusic").addEventListener("change", function () { st.music = +$("pMusic").value; st.voices = null; st.regions = null; saveAll(); cams(); draw(); });

  // ---- settings -----------------------------------------------------------------------------------------
  [["pMin", "minShot", "s"], ["pDelay", "delay", "s"], ["pAfter", "wideAfter", "s"], ["pDepth", "depth", "dB"], ["pAttack", "attack", "s"], ["pRelease", "release", "s"]].forEach(function (d) {
    var el = $(d[0]), out = $(d[0] + "Out");
    el.value = st.set[d[1]]; out.textContent = (d[2] === "dB" ? "−" : "") + st.set[d[1]] + " " + d[2];
    el.addEventListener("input", function () { st.set[d[1]] = +el.value; out.textContent = (d[2] === "dB" ? "−" : "") + el.value + " " + d[2]; saveAll(); refit(); });
  });

  // ---- tabs ---------------------------------------------------------------------------------------------
  $("pTabs").addEventListener("click", function (ev) {
    var t = ev.target.getAttribute && ev.target.getAttribute("data-tab"); if (!t) return;
    st.tab = t; tabs();
  });
  function tabs() {
    var bs = $("pTabs").querySelectorAll("button");
    for (var i = 0; i < bs.length; i++) bs[i].className = bs[i].getAttribute("data-tab") === st.tab ? "on" : "";
    var ps = document.querySelectorAll("[data-pane]");
    for (var j = 0; j < ps.length; j++) ps[j].hidden = ps[j].getAttribute("data-pane") !== st.tab;
    $("pAlt").hidden = st.tab !== "duck";
    draw();
  }

  // ---- analysis (cheap to redo when a setting moves, once the levels are read) -----------------------------
  function length() { return st.tracks ? st.tracks.end : 60; }
  function refit() {
    var L = length();
    if (st.tab === "cam" && st.cams.every(function (c) { return st.levels[c.a]; })) {
      var mics = st.cams.map(function (c) { return st.levels[c.a]; }), wideIx = st.wide >= 0 ? st.cams.length : -1;
      st.cuts = P.shots(P.talkers(mics), L, { minShot: st.set.minShot, delay: st.set.delay, wide: wideIx, wideAfter: st.set.wideAfter });
      var sh = P.share(st.cuts, st.cams.concat(wideIx >= 0 ? [{}] : []));
      say(plural(st.cuts.length - 1, "switch") + " · " + sh.map(function (p, i) { return (i < st.cams.length ? "Cam " + (i + 1) : "Wide") + " " + p + "%"; }).join(" · "));
    }
    if (st.tab === "duck" && st.voices && st.voices.length && st.voices.every(function (a) { return st.levels[a]; })) {
      st.regions = P.speech(st.voices.map(function (a) { return st.levels[a]; }));
      var talk = 0; st.regions.forEach(function (r) { talk += r.end - r.start; });
      say(st.regions.length + (st.regions.length === 1 ? " stretch" : " stretches") + " of talk · music dips for " + Math.round(talk) + " s");
    }
    $("pApply").disabled = st.tab === "cam" ? !st.cuts : !(st.regions && st.music >= 0);
    draw();
  }

  function strip(id, paint) {
    var c = $(id), dpr = window.devicePixelRatio || 1, W = c.clientWidth || 300, H = 46;
    c.width = Math.round(W * dpr); c.height = Math.round(H * dpr);
    var g = c.getContext("2d"); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.fillStyle = "#07050a"; g.fillRect(0, 0, W, H);
    paint(g, W, H, W / Math.max(1, length()));
  }
  function draw() {
    if (st.tab === "cam") {
      strip("pCamStrip", function (g, W, H, k) {
        if (!st.cuts) { g.fillStyle = "rgba(255,255,255,.35)"; g.font = "11px -apple-system, sans-serif"; g.fillText("Listen to see the cuts here", 10, 27); return; }
        st.cuts.forEach(function (c) { g.fillStyle = c.cam < st.cams.length ? COLORS[c.cam] : WIDE; g.fillRect(c.start * k, 8, Math.max(1, (c.end - c.start) * k - 1), H - 16); });
      });
      var lg = $("pLegend"); lg.innerHTML = "";
      st.cams.forEach(function (c, i) { lg.innerHTML += '<span><i style="background:' + COLORS[i] + '"></i>Cam ' + (i + 1) + " · V" + (c.v + 1) + "</span>"; });
      if (st.wide >= 0) lg.innerHTML += '<span><i style="background:' + WIDE + '"></i>Wide · V' + (st.wide + 1) + "</span>";
    } else {
      strip("pDuckStrip", function (g, W, H, k) {
        if (!st.regions) { g.fillStyle = "rgba(255,255,255,.35)"; g.font = "11px -apple-system, sans-serif"; g.fillText("Listen to see where the music dips", 10, 27); return; }
        g.fillStyle = "rgba(54,194,255,.35)";
        st.regions.forEach(function (r) { g.fillRect(r.start * k, 6, Math.max(1, (r.end - r.start) * k), H - 12); });
        var keys = P.duckKeys(st.regions, 0, length(), 0, st.set), y = function (db) { return 8 + (-db / 30) * (H - 16); };
        g.strokeStyle = "#ff8a3d"; g.lineWidth = 1.5; g.beginPath(); g.moveTo(0, y(0));
        keys.forEach(function (kk) { g.lineTo(kk.t * k, y(kk.db)); }); g.lineTo(W, y(0)); g.stroke();
      });
    }
  }

  // ---- Premiere -------------------------------------------------------------------------------------------
  function run(tool, args) {
    if (!window.HaloBridge) return Promise.reject("Open this panel in Premiere Pro");
    return window.HaloBridge.run(tool, args || {}).then(function (r) { if (!r.ok) throw r.msg; return r; });
  }
  function loadTracks() { return run("pr.podTracks").then(function (r) { var changed = !st.tracks || st.tracks.end !== r.data.end; st.tracks = r.data; if (changed) st.levels = {}; cams(); return r.data; }); }

  // Reads every needed audio track's sound once; settings can then move freely.
  function listen() {
    var need = st.tab === "cam" ? st.cams.map(function (c) { return c.a; }) : (st.voices || []);
    need = need.filter(function (a, i) { return need.indexOf(a) === i && !st.levels[a]; });
    var ff = SIL && SIL.findFfmpeg((function () { try { return localStorage.getItem("halocut.ffmpeg"); } catch (e) { return null; } })());
    if (!ff) return Promise.reject("FFmpeg not found on this computer");
    if (!need.length) return Promise.resolve();
    return run("pr.podClips", { audio: need }).then(function (r) {
      var jobs = [];
      r.data.tracks.forEach(function (t) { t.clips.forEach(function (c) { jobs.push({ track: t.index, clip: c }); }); });
      var got = {}, i = 0;
      return new Promise(function (resolve, reject) {
        (function next() {
          if (i >= jobs.length) {
            need.forEach(function (a) { st.levels[a] = P.timeline(got[a] || [], 0, length()); });
            return resolve();
          }
          var j = jobs[i++];
          say("Listening to A" + (j.track + 1) + " · clip " + i + " of " + jobs.length + "…", true);
          SIL.readLevels(ff, j.clip.path, j.clip.inPoint, j.clip.outPoint, function (err, levels) {
            if (err) return reject("A" + (j.track + 1) + ": " + err.message);
            (got[j.track] = got[j.track] || []).push({ start: j.clip.start, end: j.clip.end, levels: levels });
            next();
          });
        })();
      });
    });
  }

  $("pListen").addEventListener("click", function () {
    if (st.busy) return;
    if (st.tab === "duck" && st.music < 0) return say("Pick the music track first");
    var vs = st.cams.map(function (c) { return c.v; }).concat(st.wide >= 0 ? [st.wide] : []);
    if (st.tab === "cam" && vs.some(function (v, i) { return vs.indexOf(v) !== i; })) return say("Each camera needs its own video track");
    st.busy = true; say("Reading the tracks…", true);
    loadTracks().then(listen).then(function () { refit(); }).catch(function (m) { say(String(m)); }).then(function () { st.busy = false; });
  });

  $("pApply").addEventListener("click", function () {
    if (st.busy) return;
    st.busy = true;
    var job;
    if (st.tab === "cam") {
      say("Switching cameras…", true);
      job = run("pr.autoCam", { cams: st.cams.map(function (c) { return c.v; }).concat(st.wide >= 0 ? [st.wide] : []), cuts: st.cuts, keepCopy: $("pCopy").checked });
    } else {
      say("Dipping the music…", true);
      job = run("pr.podClips", { audio: [st.music] }).then(function (r) {
        var clips = r.data.tracks[0].clips.map(function (c) {
          var base = c.level === null ? 0 : P.levelToDb(c.level);
          return { id: c.id, keys: P.duckKeys(st.regions, c.start, c.end, base, st.set).map(function (k) { return { t: k.t, v: P.dbToLevel(k.db) }; }) };
        });
        return run("pr.duck", { clips: clips });
      });
    }
    job.then(function (r) { say(r.msg); if (st.tab === "cam") { st.cuts = null; $("pApply").disabled = true; draw(); } })
      .catch(function (m) { say(String(m)); }).then(function () { st.busy = false; });
  });
  $("pAlt").addEventListener("click", function () {
    if (st.music < 0) return say("Pick the music track first");
    run("pr.duckClear", { track: st.music }).then(function (r) { say(r.msg); }).catch(function (m) { say(String(m)); });
  });

  window.addEventListener("resize", draw);
  window.onHaloReady = function () { loadTracks().catch(function (m) { say(String(m)); }); };
  cams(); tabs();
  if (!window.HaloBridge) { // a stand-in run in the browser preview
    st.cuts = [{ start: 0, end: 9, cam: 0 }, { start: 9, end: 15, cam: 1 }, { start: 15, end: 19, cam: 2 }, { start: 19, end: 31, cam: 0 }, { start: 31, end: 44, cam: 1 }, { start: 44, end: 60, cam: 0 }];
    st.wide = 2; st.cams = st.cams.slice(0, 2); cams();
    st.regions = [{ start: 3, end: 14 }, { start: 16, end: 30 }, { start: 35, end: 52 }];
    draw(); say("A stand-in: open this panel in Premiere Pro to use your tracks");
  }
})();
