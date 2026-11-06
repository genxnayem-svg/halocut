/* HaloCut Caption Styles panel: words in, a look picked and tuned, then a timed picture per caption state on the video.
 * © 2026 Imtayz Nayem */
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var S = window.HaloStyles, C = window.HaloCaptions, SIL = window.HaloSilence;
  var req = window.cep_node ? window.cep_node.require : window.require;
  var FONTS = ["Inter", "Helvetica Neue", "Arial", "Arial Black", "Avenir Next", "Futura", "Gill Sans", "Montserrat", "Poppins", "Roboto", "Impact", "Georgia", "Times New Roman", "Menlo"];
  var SAMPLE = "Your words show up here, timed to the way you speak";
  var st = { look: "yellow", family: "Highlight", own: { size: 1, maxChars: 32, words: 2 }, words: [], lines: [], info: null, img: null,
    playing: true, t0: performance.now(), font: "", custom: "" };

  function say(t, busy) { $("ySum").className = "sum" + (busy ? " busy" : ""); $("ySumText").textContent = t; }
  function saved(key, fallback) { try { var v = JSON.parse(localStorage.getItem(key)); return v === null ? fallback : v; } catch (e) { return fallback; } }
  function store(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) {} }

  // ---- the look, with your changes ---------------------------------------------------------------
  function current() {
    var base = S.look(st.look), o = st.own;
    var font = st.font === "custom" ? (st.custom ? "'" + st.custom + "', sans-serif" : null) : st.font ? "'" + st.font + "', sans-serif" : null;
    // karaoke: the text colour is the colour before a word is said, the highlight the colour after
    return S.styled(st.look, { size: base.size * o.size, y: o.y, font: font, fill: base.mode === "karaoke" ? undefined : o.fill, dim: base.mode === "karaoke" ? o.dimFill : undefined,
      accent: o.accent, maxChars: o.maxChars, words: o.words,
      upper: o.caseMode ? o.caseMode === "upper" : undefined, lower: o.caseMode ? o.caseMode === "lower" : undefined, motion: o.motion });
  }
  function frame() { return st.info ? st.info.frame : { w: 1920, h: 1080 }; }

  var mctx = document.createElement("canvas").getContext("2d");
  function measure(text, font) { mctx.font = font; return mctx.measureText(text).width; }

  function sampleWords() {
    var t = 0.2;
    return SAMPLE.split(" ").map(function (w) { var o = { text: w, start: t, end: t + 0.3 }; t += 0.34; return o; });
  }
  function regroup() { st.lines = S.group(st.words.length ? st.words : sampleWords(), current()); renderLines(); }

  // ---- drawing one caption state (frame pixels; px = device pixels per frame pixel) -------------------
  function rrect(g, x, y, w, h, r) {
    r = Math.max(0, Math.min(r, w / 2, h / 2)); g.beginPath();
    g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
  }
  function drawState(g, L, lay, state, px) {
    var size = lay.size, shown = [];
    for (var j = 0; j < lay.words.length; j++) shown.push(S.wordLook(L, state, j));
    if (L.bg) { // the bubble around what is showing, one per row
      var pad = L.bg.pad * size, rows = {};
      lay.words.forEach(function (w, i) {
        if (!shown[i]) return;
        var r = rows[w.row] || (rows[w.row] = { x0: w.x, x1: w.x + w.w, y: w.y });
        r.x0 = Math.min(r.x0, w.x); r.x1 = Math.max(r.x1, w.x + w.w);
      });
      g.fillStyle = L.bg.color;
      Object.keys(rows).forEach(function (k) { var r = rows[k]; rrect(g, r.x0 - pad, r.y - size * 0.6 - pad * 0.45, r.x1 - r.x0 + pad * 2, size * 1.2 + pad * 0.9, L.bg.radius * size); g.fill(); });
    }
    g.font = lay.font; g.textAlign = "center"; g.textBaseline = "middle"; g.lineJoin = "round"; g.miterLimit = 2;
    lay.words.forEach(function (w, i) {
      var wl = shown[i];
      if (!wl) return;
      g.save(); g.translate(w.x + w.w / 2, w.y); g.scale(wl.scale, wl.scale);
      if (wl.box) { var bp = size * 0.18; g.fillStyle = wl.box; rrect(g, -w.w / 2 - bp, -size * 0.62, w.w + bp * 2, size * 1.24, size * 0.24); g.fill(); }
      if (L.stroke) { g.strokeStyle = L.stroke.color; g.lineWidth = L.stroke.width * size * 2; g.strokeText(w.text, 0, size * 0.04); }
      if (L.shadow) { g.shadowColor = L.shadow.color; g.shadowBlur = L.shadow.blur * size * px; g.shadowOffsetY = L.shadow.y * size * px; }
      g.fillStyle = wl.fill; g.fillText(w.text, 0, size * 0.04);
      g.restore();
    });
  }
  var layouts = {};
  function layoutOf(L, i) {
    var key = i + "|" + L.font + L.size + L.y + L.upper + L.lower + frame().w;
    if (!layouts[key]) layouts[key] = S.layout(st.lines[i].words.map(function (w) { return w.text; }), L, frame(), measure);
    return layouts[key];
  }

  // A stand-in shot under the preview: someone talking to the camera.
  function drawShot(g, F) {
    if (st.img) { g.drawImage(st.img, 0, 0, F.w, F.h); return; }
    var bg = g.createLinearGradient(0, 0, F.w, F.h); bg.addColorStop(0, "#3b4a63"); bg.addColorStop(1, "#5b3a4f");
    g.fillStyle = bg; g.fillRect(0, 0, F.w, F.h);
    var u = Math.min(F.w, F.h) / 100, cx = F.w / 2, cy = F.h * 0.52;
    g.fillStyle = "#26324a"; g.beginPath(); g.ellipse(cx, cy + u * 62, u * 46, u * 40, 0, Math.PI, 0); g.fill();
    g.fillStyle = "#c99a86"; g.beginPath(); g.ellipse(cx, cy - u * 6, u * 17, u * 21, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = "#2e2220"; g.beginPath(); g.ellipse(cx, cy - u * 19, u * 18, u * 11, 0, Math.PI, 0); g.fill();
  }

  // ---- the preview -------------------------------------------------------------------------------------
  function stateAt(states, t) { for (var i = 0; i < states.length; i++) if (t >= states[i].start && t < states[i].end) return states[i]; return null; }
  function paint() {
    var c = $("yStage"), F = frame(), dpr = window.devicePixelRatio || 1, box = c.parentNode.clientWidth - 2 || 320;
    var W = Math.min(box, 340 * F.w / F.h), H = W * F.h / F.w;
    c.style.width = W + "px"; c.style.height = H + "px";
    if (c.width !== Math.round(W * dpr)) { c.width = Math.round(W * dpr); c.height = Math.round(H * dpr); }
    var g = c.getContext("2d"), k = c.width / F.w;
    g.setTransform(k, 0, 0, k, 0, 0); drawShot(g, F);
    if (!st.lines.length) return;
    var L = current(), states = S.states(st.lines, L, 30), first = st.lines[0].start, last = st.lines[Math.min(st.lines.length - 1, 5)].end + 0.6;
    var t = st.playing ? first + ((performance.now() - st.t0) / 1000) % (last - first) : first + 0.75;
    var s = stateAt(states, t) || states[0];
    if (!s) return;
    var lay = layoutOf(L, s.line);
    // the arrival motion, as Premiere will play it
    var age = (t - st.lines[s.line].start) * 30, sc = 1, dy = 0, alpha = 1;
    if (L.motion === "pop" && age < 4) sc = age < 2 ? 0.86 + 0.09 * age : 1.04 - 0.02 * (age - 2);
    if (L.motion === "rise" && age < 5) { dy = 0.025 * F.h * (1 - age / 5); alpha = age / 5; }
    if (L.motion === "fade" && age < 4) alpha = age / 4;
    var cx = lay.box.x + lay.box.w / 2, cy = lay.box.y + lay.box.h / 2;
    g.save(); g.globalAlpha = Math.max(0, Math.min(1, alpha)); g.translate(cx, cy + dy); g.scale(sc, sc); g.translate(-cx, -cy);
    drawState(g, L, lay, s, k);
    g.restore();
  }
  (function loop() { if (st.playing || st.dirty) { st.dirty = false; paint(); } requestAnimationFrame(loop); })();
  function draw() { st.dirty = true; }
  $("yPlay").addEventListener("click", function () { st.playing = !st.playing; st.t0 = performance.now(); $("yPlay").textContent = st.playing ? "❚❚" : "▶"; draw(); });

  // ---- the look gallery -----------------------------------------------------------------------------------
  function tiles() {
    var box = $("yTiles"); box.innerHTML = "";
    S.LOOKS.filter(function (l) { return l.family === st.family; }).forEach(function (l) {
      var b = document.createElement("button"), c = document.createElement("canvas"), name = document.createElement("span");
      b.className = "y-tile" + (l.id === st.look ? " on" : ""); name.textContent = l.name;
      b.appendChild(c); b.appendChild(name); box.appendChild(b);
      b.addEventListener("click", function () { st.look = l.id; store("halocut.styleLook", l.id); layouts = {}; regroup(); controls(); tiles(); draw(); });
      requestAnimationFrame(function () {
        var dpr = window.devicePixelRatio || 1, W = c.clientWidth || 150, H = 64;
        c.width = Math.round(W * dpr); c.height = Math.round(H * dpr);
        var F = { w: 960, h: 960 * H / W }, g = c.getContext("2d"), k = c.width / F.w;
        g.setTransform(k, 0, 0, k, 0, 0);
        var bg = g.createLinearGradient(0, 0, F.w, F.h); bg.addColorStop(0, "#2a3346"); bg.addColorStop(1, "#46283c");
        g.fillStyle = bg; g.fillRect(0, 0, F.w, F.h);
        var L = S.styled(l.id, { size: l.size * (l.mode === "chunk" ? 2.6 : 3.4), y: 0.5 });
        var text = l.mode === "chunk" ? ["Like", "this", "one"].slice(0, l.words || 2) : ["Like", "this", "one"];
        var lay = S.layout(text, L, F, measure);
        drawState(g, L, lay, { active: 1 }, k);
      });
    });
  }

  // ---- adjust ---------------------------------------------------------------------------------------------
  function fontAvailable(name) {
    var probe = "mmmmmmmmmmlli1WQ", a = measure(probe, "40px monospace"), b = measure(probe, "40px serif");
    return measure(probe, "40px '" + name + "', monospace") !== a || measure(probe, "40px '" + name + "', serif") !== b;
  }
  function chipRow(id, items, cur, pick) {
    var box = $(id); box.innerHTML = "";
    items.forEach(function (it) {
      var b = document.createElement("button"); b.textContent = it.name; b.className = it.id === cur ? "on" : "";
      b.addEventListener("click", function () { pick(it.id); layouts = {}; regroup(); controls(); tiles(); draw(); });
      box.appendChild(b);
    });
  }
  function slider(id, key, fmt, regroups) {
    var el = $(id), out = $(id + "Out");
    el.value = st.own[key];
    out.textContent = fmt(+el.value);
    if (el._wired) return;
    el._wired = true;
    el.addEventListener("input", function () { st.own[key] = +el.value; out.textContent = fmt(+el.value); layouts = {}; if (regroups) regroup(); store("halocut.styleOwn", st.own); draw(); });
  }
  function controls() {
    var base = S.look(st.look), L = current();
    if (st.own.y === undefined || st.own.lookY !== st.look) { st.own.y = base.y || 0.8; st.own.lookY = st.look; }
    chipRow("yFamilies", S.FAMILIES.map(function (f) { return { id: f, name: f }; }), st.family, function (f) {
      st.family = f; var first = S.LOOKS.filter(function (l) { return l.family === f; })[0]; st.look = first.id; st.own.y = undefined;
    });
    slider("ySize", "size", function (v) { return Math.round(v * 100) + " %"; });
    slider("yY", "y", function (v) { return Math.round(v * 100) + " %"; });
    slider("yChars", "maxChars", String, true);
    slider("yWords", "words", String, true);
    $("yCharsRow").hidden = base.mode === "chunk"; $("yWordsRow").hidden = base.mode !== "chunk";
    chipRow("yCase", [{ id: "", name: "Look's" }, { id: "none", name: "Aa" }, { id: "upper", name: "AA" }, { id: "lower", name: "aa" }], st.own.caseMode || "", function (v) { st.own.caseMode = v; });
    chipRow("yMotion", [{ id: "", name: "Look's" }, { id: "none", name: "None" }, { id: "pop", name: "Pop" }, { id: "rise", name: "Rise" }, { id: "fade", name: "Fade" }], st.own.motion || "", function (v) { st.own.motion = v; });
    $("yFill").value = toHex(L.fill);
    var acc = base.mode === "karaoke" ? L.fill : base.active ? base.active.bg || base.active.fill : null;
    $("yAccentRow").hidden = !acc && base.mode !== "karaoke";
    if (acc) $("yAccent").value = toHex(st.own.accent || acc);
    if (base.mode === "karaoke") $("yFill").value = toHex(st.own.fill || base.dim);
  }
  function toHex(c) { if (/^#[0-9a-f]{6}$/i.test(c || "")) return c; mctx.fillStyle = c || "#ffffff"; var v = mctx.fillStyle; return /^#/.test(v) ? v : "#ffffff"; }
  $("yFill").addEventListener("input", function () {
    if (S.look(st.look).mode === "karaoke") st.own.dimFill = $("yFill").value; else st.own.fill = $("yFill").value;
    draw(); tiles();
  });
  $("yAccent").addEventListener("input", function () { st.own.accent = $("yAccent").value; draw(); });

  function fonts() {
    var sel = $("yFont"); sel.innerHTML = "";
    sel.add(new Option("The look's own", ""));
    FONTS.filter(fontAvailable).forEach(function (f) { sel.add(new Option(f, f)); });
    sel.add(new Option("Another font…", "custom"));
    sel.value = st.font;
  }
  $("yFont").addEventListener("change", function () { st.font = $("yFont").value; $("yCustomRow").hidden = st.font !== "custom"; layouts = {}; draw(); });
  $("yCustom").addEventListener("input", function () { st.custom = $("yCustom").value.trim(); layouts = {}; draw(); });

  // ---- captions list -------------------------------------------------------------------------------------
  function tc(sec) { var m = Math.floor(sec / 60), s = sec - m * 60; return (m < 10 ? "0" : "") + m + ":" + (s < 10 ? "0" : "") + s.toFixed(1); }
  function renderLines() {
    var box = $("yLines"); box.innerHTML = "";
    if (!st.words.length) { box.hidden = true; $("yCount").textContent = ""; return; }
    st.lines.forEach(function (l, i) {
      var row = document.createElement("div"), t = document.createElement("span"), txt = document.createElement("div");
      row.className = "line"; t.className = "tc"; t.textContent = tc(l.start);
      txt.className = "txt"; txt.contentEditable = "true"; txt.textContent = l.text;
      txt.addEventListener("blur", function () {
        var text = txt.innerText.replace(/\s+/g, " ").trim();
        if (text === l.text) return;
        var fresh = S.retext(l, text), before = st.words.indexOf(l.words[0]);
        st.words.splice(before, l.words.length);
        if (fresh) Array.prototype.splice.apply(st.words, [before, 0].concat(fresh));
        layouts = {}; regroup(); draw();
      });
      row.appendChild(t); row.appendChild(txt); box.appendChild(row);
    });
    box.hidden = false;
    $("yCount").textContent = "· " + st.lines.length + " · " + st.words.length + " words";
  }
  function useWords(words, from) {
    st.words = words.map(function (w) { return { text: w.text, start: w.start, end: w.end }; }).sort(function (a, b) { return a.start - b.start; });
    layouts = {}; regroup(); draw();
    say(st.words.length ? st.words.length + " words from " + from + " · pick a look, then Put on video" : "No words in " + from);
  }

  // ---- getting the words ------------------------------------------------------------------------------------
  function extensionDir() { try { return new CSInterface().getSystemPath(SystemPath.EXTENSION); } catch (e) { return ""; } }
  if (C) {
    Object.keys(C.LANGUAGES).forEach(function (k) { $("yLang").add(new Option(C.LANGUAGES[k].name, k)); });
    $("yLang").value = saved("halocut.capLang", "hinglish");
    var models = C.installedModels();
    models.forEach(function (m) { $("yModel").add(new Option(m.name, m.file)); });
    if (!models.length) { $("yModel").add(new Option("No speech model", "")); $("yListen").disabled = true; }
  } else { $("yLang").add(new Option("Languages load in Premiere", "")); $("yModel").add(new Option("—", "")); $("yListen").disabled = true; }
  $("yLang").addEventListener("change", function () { store("halocut.capLang", $("yLang").value); });

  $("yListen").addEventListener("click", function () {
    var ff = SIL && SIL.findFfmpeg(saved("halocut.ffmpeg", null)), whisper = C.findWhisper(extensionDir());
    if (!ff) return say("FFmpeg not found on this computer");
    if (!whisper) return say("The speech engine is missing from HaloCut");
    say("Reading the timeline…", true);
    window.HaloBridge.run("pr.studioClips", {}).then(function (res) {
      if (!res.ok) return say(res.msg);
      var clips = res.data.clips, all = [], i = 0;
      (function next() {
        if (i >= clips.length) return useWords(all, plural(clips.length, "clip"));
        var clip = clips[i++];
        say("Listening to clip " + i + " of " + clips.length + "…", true);
        C.transcribe({ ffmpeg: ff, whisper: whisper, file: clip.path, inSec: clip.inPoint, outSec: clip.outPoint, language: $("yLang").value, model: $("yModel").value, fixes: saved("halocut.fixes", {}) },
          function (err, got) {
            if (err) return say("Clip " + i + ": " + err.message);
            got.forEach(function (w) { all.push({ text: w.text, start: clip.start + w.start, end: clip.start + w.end }); });
            next();
          });
      })();
    });
  });
  function plural(n, w) { return n + " " + w + (n === 1 ? "" : "s"); }

  $("yLast").addEventListener("click", function () {
    if (!req) return say("Open this panel in Premiere Pro");
    var path = req("path"), os = req("os"), fs = req("fs");
    try {
      var d = JSON.parse(fs.readFileSync(path.join(os.homedir(), "Library", "Application Support", "HaloCut", "last-transcript.json"), "utf8"));
      useWords(d.words || [], "Studio (" + (d.sequence || "last run") + ")");
    } catch (e) { say("No Studio words yet: run Captions in HaloCut Studio first"); }
  });
  $("ySrt").addEventListener("click", function () {
    if (window.cep && window.cep.fs && window.cep.fs.showOpenDialog && req) {
      var r = window.cep.fs.showOpenDialog(false, false, "Captions file", "", ["srt"]);
      if (!r || r.err || !r.data || !r.data.length) return;
      useWords(S.fromSrt(req("fs").readFileSync(r.data[0], "utf8")), r.data[0].split("/").pop());
    } else $("ySrtFile").click();
  });
  $("ySrtFile").addEventListener("change", function () {
    var f = $("ySrtFile").files[0]; if (!f) return;
    var rd = new FileReader(); rd.onload = function () { useWords(S.fromSrt(rd.result), f.name); }; rd.readAsText(f);
  });

  // ---- Premiere ---------------------------------------------------------------------------------------------
  function run(tool, args) {
    if (!window.HaloBridge) return Promise.reject("Open this panel in Premiere Pro");
    return window.HaloBridge.run(tool, args || {}).then(function (r) { if (!r.ok) throw r.msg; return r; });
  }
  function info() { return run("pr.capsInfo").then(function (r) { var size = !st.info || st.info.frame.w !== r.data.frame.w; st.info = r.data; if (size) { layouts = {}; } return r.data; }); }

  $("yGrab").addEventListener("click", function () {
    var path = req("path"), os = req("os"), fs = req("fs"), file = path.join(os.tmpdir(), "halocut-styles-" + Date.now() + ".png");
    say("Grabbing the frame…", true);
    info().then(function () { return run("pr.exportFrame", { file: file }); }).then(function () {
      var tries = 0;
      (function wait() {
        var ok = false; try { ok = fs.statSync(file).size > 0; } catch (e) {}
        if (!ok) { if (++tries > 40) return say("Premiere didn't write the frame"); return setTimeout(wait, 150); }
        var img = new Image(); img.onload = function () { st.img = img; draw(); say("Frame grabbed"); }; img.src = "file://" + file;
      })();
    }).catch(function (m) { say(String(m)); });
  });

  function assetsDir(d) {
    var path = req("path"), fs = req("fs"), os = req("os"), stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    var name = "Captions " + (d.sequence || "Sequence").replace(/[^\w\- ]+/g, "").trim() + " " + stamp, dirs = [];
    if (d.project) dirs.push(path.join(path.dirname(d.project), "HaloCut assets", name));
    dirs.push(path.join(os.homedir(), "Documents", "HaloCut", "Assets", name));
    for (var i = 0; i < dirs.length; i++) { try { fs.mkdirSync(dirs[i], { recursive: true }); fs.accessSync(dirs[i], fs.constants.W_OK); return dirs[i]; } catch (e) {} }
    throw "Couldn't make a folder for the caption pictures";
  }

  // Draws every state as a frame-sized picture, a few at a time so the panel stays responsive.
  function drawAll(d, L, states, dir, done) {
    var path = req("path"), fs = req("fs"), F = d.frame, c = document.createElement("canvas"), g = c.getContext("2d"), out = [], i = 0;
    c.width = F.w; c.height = F.h;
    (function batch() {
      var stop = Math.min(states.length, i + 12);
      try {
        for (; i < stop; i++) {
          var s = states[i], lay = S.layout(st.lines[s.line].words.map(function (w) { return w.text; }), L, F, measure);
          g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, F.w, F.h);
          drawState(g, L, lay, s, 1);
          var file = path.join(dir, "cap-" + ("0000" + i).slice(-5) + ".png");
          fs.writeFileSync(file, Buffer.from(c.toDataURL("image/png").split(",")[1], "base64"));
          out.push({ file: file, name: st.lines[s.line].text.slice(0, 40), start: s.start, end: s.end, motion: s.first ? L.motion : "none",
            anchor: [(lay.box.x + lay.box.w / 2) / F.w, (lay.box.y + lay.box.h / 2) / F.h] });
        }
      } catch (e) { return done(String(e.message || e)); }
      say("Drawing captions " + i + " of " + states.length + "…", true);
      if (i < states.length) setTimeout(batch, 0); else done(null, out);
    })();
  }

  function place(list, span, done) {
    var track = -1, i = 0, n = 30;
    (function next() {
      if (i >= list.length) return done(null, track);
      say("Placing " + Math.min(list.length, i + n) + " of " + list.length + "…", true);
      run("pr.capsPlace", { files: list.slice(i, i + n), span: span, track: track }).then(function (r) { track = r.data.track; i += n; next(); })
        .catch(function (m) { done(m); });
    })();
  }

  $("yGo").addEventListener("click", function () {
    if (!st.words.length) return say("Get the words first: transcribe, use Studio's, or load an .srt");
    if (!req || !window.HaloBridge) return say("Open this panel in Premiere Pro");
    var L = current(), d;
    info().then(function (x) {
      d = x;
      return $("yReplace").checked && d.placed ? run("pr.capsRemove") : null;
    }).then(function () {
      var states = S.states(st.lines, L, d.fps), dir = assetsDir(d);
      if (!states.length) throw "Nothing to place";
      drawAll(d, L, states, dir, function (err, list) {
        if (err) return say("Couldn't draw the captions: " + err);
        place(list, [states[0].start, states[states.length - 1].end], function (err2, track) {
          if (err2) return say(String(err2));
          say("Placed " + list.length + " caption pictures on V" + (track + 1) + " · pictures in " + dir.split("/").slice(-2).join("/"));
        });
      });
    }).catch(function (m) { say(String(m)); });
  });
  $("yRemove").addEventListener("click", function () { run("pr.capsRemove").then(function (r) { say(r.msg); }).catch(function (m) { say(String(m)); }); });

  window.onHaloReady = function () { info().then(draw).catch(function () {}); };
  st.look = saved("halocut.styleLook", st.look); st.family = S.look(st.look).family;
  var own = saved("halocut.styleOwn", null); if (own) { for (var k in own) st.own[k] = own[k]; }
  fonts(); regroup(); controls(); tiles(); draw();
  if (!window.HaloBridge) say("A stand-in preview: open this panel in Premiere Pro to caption your video");
})();
