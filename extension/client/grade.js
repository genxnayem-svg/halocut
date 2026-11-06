/* HaloCut Grade panel: a clean grab of the frame, the grade previewed on it with scopes, then onto Lumetri Color.
 * © 2026 Imtayz Nayem */
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var G = window.HaloGrade;
  var req = window.cep_node ? window.cep_node.require : window.require;
  var LABELS = { exposure: "Exposure", contrast: "Contrast", highlights: "Highlights", shadows: "Shadows", whites: "Whites", blacks: "Blacks",
    temperature: "Temperature", tint: "Tint", saturation: "Saturation", vibrance: "Vibrance", faded: "Faded film", vignette: "Vignette" };
  var GROUPS = { gLight: ["exposure", "contrast", "highlights", "shadows", "whites", "blacks"], gColour: ["temperature", "tint", "saturation", "vibrance"], gFinish: ["faded", "vignette"] };
  var VIEWS = [{ id: "after", name: "After" }, { id: "before", name: "Before" }, { id: "split", name: "Split" }];
  var PICKS = [{ id: "grey", name: "Grey" }, { id: "skin", name: "Skin" }, { id: "white", name: "White" }, { id: "black", name: "Black" }];
  var SCOPES = [{ id: "wave", name: "Waveform" }, { id: "parade", name: "Parade" }, { id: "vector", name: "Vectorscope" }, { id: "hist", name: "Histogram" }];
  var st = { p: G.values(), img: null, small: null, sample: null, view: "after", split: 0.5, falseColour: false, pick: null, scope: "wave",
    ref: null, info: null, look: null, busy: false, frame: { w: 1920, h: 1080 } };

  function say(t, busy) { $("gSum").className = "sum" + (busy ? " busy" : ""); $("gSumText").textContent = t; }
  function fmt(k, v) { return k === "exposure" || k === "vignette" ? (v > 0 ? "+" : "") + (+v).toFixed(2) : String(Math.round(v)); }

  // ---- pictures --------------------------------------------------------------------------------
  function pixels(img, w, h) {
    var c = document.createElement("canvas"); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h));
    var g = c.getContext("2d"); g.drawImage(img, 0, 0, c.width, c.height);
    return g.getImageData(0, 0, c.width, c.height);
  }
  function blank(w, h) { return new ImageData(Math.max(1, w), Math.max(1, h)); }

  // A stand-in shot before one is grabbed: a person by a window, with a cold cast to fix.
  function standIn() {
    var c = document.createElement("canvas"); c.width = 960; c.height = 540;
    var g = c.getContext("2d"), sky = g.createLinearGradient(0, 0, 0, 540);
    sky.addColorStop(0, "#8fa9c9"); sky.addColorStop(0.55, "#c9d3df"); sky.addColorStop(1, "#5e6774");
    g.fillStyle = sky; g.fillRect(0, 0, 960, 540);
    g.fillStyle = "#3d4450"; g.fillRect(0, 380, 960, 160);
    g.fillStyle = "#e9eef4"; g.fillRect(560, 60, 300, 240); g.fillStyle = "#9fb4cc"; g.fillRect(575, 75, 130, 210); g.fillRect(715, 75, 130, 210);
    g.fillStyle = "#2c3a52"; g.beginPath(); g.ellipse(330, 520, 170, 210, 0, Math.PI, 0); g.fill();
    g.fillStyle = "#c79c8e"; g.beginPath(); g.ellipse(330, 230, 78, 96, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = "#3a2a26"; g.beginPath(); g.ellipse(330, 168, 84, 52, 0, Math.PI, 0); g.fill();
    g.fillStyle = "#a9a9ad"; g.fillRect(90, 300, 90, 120); g.fillStyle = "#ffffff"; g.fillRect(800, 420, 90, 40); g.fillStyle = "#101114"; g.fillRect(80, 430, 70, 50);
    var img = new Image(); img.src = c.toDataURL(); return img;
  }

  function setPicture(img, w, h) {
    st.img = img; st.frame = { w: w || img.naturalWidth || img.width, h: h || img.naturalHeight || img.height };
    st.small = null; st.sample = pixels(img, 256, 256 * st.frame.h / st.frame.w);
    st.fit = pixels(img, 96, 96 * st.frame.h / st.frame.w);
    draw();
  }

  // ---- the preview -----------------------------------------------------------------------------
  var FALSE = [[0.02, [74, 26, 122]], [0.1, [31, 79, 214]], [0.2, [42, 159, 216]], [0.42, null], [0.52, [59, 191, 90]], [0.6, null], [0.72, [233, 138, 176]], [0.92, null], [0.97, [244, 208, 63]], [2, [229, 50, 45]]];
  function falseColour(d) {
    for (var i = 0; i < d.length; i += 4) {
      var y = G.luma(d[i], d[i + 1], d[i + 2]) / 255, col = null;
      for (var k = 0; k < FALSE.length; k++) if (y < FALSE[k][0]) { col = FALSE[k][1]; break; }
      if (col) { d[i] = col[0]; d[i + 1] = col[1]; d[i + 2] = col[2]; } else { var v = y * 255 * 0.85; d[i] = d[i + 1] = d[i + 2] = v; }
    }
  }

  var queued = false;
  function draw() { if (queued) return; queued = true; requestAnimationFrame(function () { queued = false; paint(); scope(); }); }

  function paint() {
    var c = $("gStage"), dpr = window.devicePixelRatio || 1, W = c.clientWidth || 320, H = W * st.frame.h / st.frame.w;
    c.style.height = H + "px";
    var w = Math.round(W * dpr), h = Math.round(H * dpr);
    if (c.width !== w || c.height !== h) { c.width = w; c.height = h; st.small = null; }
    if (!st.img) return;
    if (!st.small) st.small = pixels(st.img, w, h);
    var g = c.getContext("2d"), out = blank(w, h);
    if (st.view === "before") out.data.set(st.small.data);
    else G.grade(st.small, st.p, out);
    if (st.view === "split") { // before on the left of the line, after on the right
      var cut = Math.round(w * st.split), s = st.small.data, o = out.data;
      for (var y = 0; y < h; y++) for (var x = 0; x < cut; x++) { var i = (y * w + x) * 4; o[i] = s[i]; o[i + 1] = s[i + 1]; o[i + 2] = s[i + 2]; }
    }
    if (st.falseColour) falseColour(out.data);
    g.putImageData(out, 0, 0);
    if (st.view === "split") {
      var lx = Math.round(w * st.split);
      g.fillStyle = "rgba(255,255,255,.9)"; g.fillRect(lx - dpr, 0, 2 * dpr, h);
      g.font = "600 " + 10 * dpr + "px -apple-system, sans-serif"; g.fillStyle = "rgba(0,0,0,.55)";
      g.fillRect(6 * dpr, 6 * dpr, 46 * dpr, 16 * dpr); g.fillRect(w - 46 * dpr, 6 * dpr, 40 * dpr, 16 * dpr);
      g.fillStyle = "#fff"; g.fillText("Before", 10 * dpr, 18 * dpr); g.fillText("After", w - 42 * dpr, 18 * dpr);
    }
  }

  // ---- scopes ------------------------------------------------------------------------------------
  function scope() {
    var c = $("gScope"), dpr = window.devicePixelRatio || 1, W = Math.round((c.clientWidth || 320) * dpr), H = Math.round(150 * dpr);
    c.width = W; c.height = H;
    var g = c.getContext("2d");
    g.fillStyle = "#07050a"; g.fillRect(0, 0, W, H);
    if (!st.sample) return;
    var src = st.sample, graded = G.grade(src, st.p, blank(src.width, src.height)), d = graded.data, n = src.width * src.height;
    var img = g.createImageData(W, H), o = img.data;
    function plot(x, y, r, gg, b) { // additive dots
      x |= 0; y |= 0; if (x < 0 || y < 0 || x >= W || y >= H) return;
      var i = (y * W + x) * 4; o[i] = Math.min(255, o[i] + r); o[i + 1] = Math.min(255, o[i + 1] + gg); o[i + 2] = Math.min(255, o[i + 2] + b); o[i + 3] = 255;
    }
    var pad = 6 * dpr, ih = H - pad * 2;
    if (st.scope === "wave" || st.scope === "parade") {
      var parade = st.scope === "parade", lanes = parade ? 3 : 1, lw = (W - pad * 2) / lanes, k = 26 * Math.max(1, 40000 / n);
      for (var p = 0; p < n; p++) {
        var x = p % src.width, r = d[p * 4] / 255, gg = d[p * 4 + 1] / 255, b = d[p * 4 + 2] / 255, fx = x / src.width * lw;
        if (!parade) { var yv = G.luma(r, gg, b); plot(pad + fx, pad + (1 - yv) * ih, k * 0.7, k, k * 0.75); continue; }
        plot(pad + fx, pad + (1 - r) * ih, k * 1.2, k * 0.15, k * 0.15);
        plot(pad + lw + fx, pad + (1 - gg) * ih, k * 0.15, k * 1.1, k * 0.2);
        plot(pad + 2 * lw + fx, pad + (1 - b) * ih, k * 0.25, k * 0.35, k * 1.3);
      }
      g.putImageData(img, 0, 0);
      g.strokeStyle = "rgba(255,255,255,.12)"; g.lineWidth = 1; g.font = 9 * dpr + "px ui-monospace, Menlo, monospace"; g.fillStyle = "rgba(255,255,255,.35)";
      [0, 25, 50, 75, 100].forEach(function (v) { var yy = pad + (1 - v / 100) * ih; g.beginPath(); g.moveTo(pad, yy); g.lineTo(W - pad, yy); g.stroke(); g.fillText(String(v), 2, yy - 2); });
      if (parade) for (var l = 1; l < 3; l++) { g.beginPath(); g.moveTo(pad + l * lw, pad); g.lineTo(pad + l * lw, H - pad); g.stroke(); }
    } else if (st.scope === "vector") {
      var cx = W / 2, cy = H / 2, R = ih / 2, kv = 30 * Math.max(1, 40000 / n);
      for (var q = 0; q < n; q++) {
        var rr = d[q * 4] / 255, g2 = d[q * 4 + 1] / 255, b2 = d[q * 4 + 2] / 255, ch = G.chroma(rr, g2, b2);
        plot(cx + ch.cb * 2 * R * 1.6, cy - ch.cr * 2 * R * 1.6, kv * (0.4 + rr), kv * (0.4 + g2), kv * (0.4 + b2));
      }
      g.putImageData(img, 0, 0);
      g.strokeStyle = "rgba(255,255,255,.16)"; g.lineWidth = 1;
      g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.stroke();
      g.beginPath(); g.moveTo(cx - R, cy); g.lineTo(cx + R, cy); g.moveTo(cx, cy - R); g.lineTo(cx, cy + R); g.stroke();
      var a = G.SKIN_ANGLE * Math.PI / 180;
      g.strokeStyle = "rgba(255,170,120,.55)"; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(a) * R, cy - Math.sin(a) * R); g.stroke();
      g.fillStyle = "rgba(255,255,255,.4)"; g.font = 9 * dpr + "px -apple-system, sans-serif";
      [["R", [1, 0, 0]], ["Y", [1, 1, 0]], ["G", [0, 1, 0]], ["C", [0, 1, 1]], ["B", [0, 0, 1]], ["M", [1, 0, 1]]].forEach(function (t) {
        var cc = G.chroma(t[1][0] * 0.75, t[1][1] * 0.75, t[1][2] * 0.75), tx = cx + cc.cb * 2 * R * 1.6, ty = cy - cc.cr * 2 * R * 1.6;
        g.strokeStyle = "rgba(255,255,255,.3)"; g.strokeRect(tx - 4 * dpr, ty - 4 * dpr, 8 * dpr, 8 * dpr); g.fillText(t[0], tx + 6 * dpr, ty + 3 * dpr);
      });
      g.fillStyle = "rgba(255,170,120,.7)"; g.fillText("skin", cx + Math.cos(a) * R * 0.9 - 24 * dpr, cy - Math.sin(a) * R * 0.9);
    } else {
      var bins = [new Float32Array(256), new Float32Array(256), new Float32Array(256)];
      for (var z = 0; z < n; z++) { bins[0][d[z * 4]]++; bins[1][d[z * 4 + 1]]++; bins[2][d[z * 4 + 2]]++; }
      var top = 1;
      for (var bi = 0; bi < 3; bi++) for (var v = 1; v < 255; v++) top = Math.max(top, bins[bi][v]);
      g.globalCompositeOperation = "lighter";
      ["rgba(229,60,60,.55)", "rgba(60,200,90,.55)", "rgba(70,120,240,.6)"].forEach(function (col, ci) {
        g.fillStyle = col; g.beginPath(); g.moveTo(pad, H - pad);
        for (var v2 = 0; v2 < 256; v2++) g.lineTo(pad + v2 / 255 * (W - pad * 2), H - pad - Math.min(1, bins[ci][v2] / top) * ih);
        g.lineTo(W - pad, H - pad); g.closePath(); g.fill();
      });
      g.globalCompositeOperation = "source-over";
    }
  }

  // ---- stage clicks: pickers and the split line ----------------------------------------------------
  function sampleAt(ev) {
    var c = $("gStage"), r = c.getBoundingClientRect(), s = st.small;
    if (!s) return null;
    var x = Math.round((ev.clientX - r.left) / r.width * (s.width - 1)), y = Math.round((ev.clientY - r.top) / r.height * (s.height - 1));
    var sum = [0, 0, 0], cnt = 0;
    for (var dy = -2; dy <= 2; dy++) for (var dx = -2; dx <= 2; dx++) {
      var xx = Math.max(0, Math.min(s.width - 1, x + dx)), yy = Math.max(0, Math.min(s.height - 1, y + dy)), i = (yy * s.width + xx) * 4;
      sum[0] += s.data[i]; sum[1] += s.data[i + 1]; sum[2] += s.data[i + 2]; cnt++;
    }
    return sum.map(function (v) { return Math.round(v / cnt); });
  }
  var splitting = false;
  $("gStage").addEventListener("pointerdown", function (ev) {
    if (st.pick) {
      var rgb = sampleAt(ev);
      if (!rgb) return;
      var was = st.p;
      st.p = st.pick === "grey" ? G.neutralAt(st.p, rgb) : st.pick === "skin" ? G.skinAt(st.p, rgb) : st.pick === "white" ? G.whiteAt(st.p, rgb) : G.blackAt(st.p, rgb);
      var moved = G.KEYS.filter(function (k) { return was[k] !== st.p[k]; }).map(function (k) { return LABELS[k] + " " + fmt(k, st.p[k]); });
      say(moved.length ? moved.join(" · ") : "Already there");
      st.look = null; refresh();
      return;
    }
    if (st.view === "split") { splitting = true; $("gStage").setPointerCapture(ev.pointerId); move(ev); }
  });
  function move(ev) { var r = $("gStage").getBoundingClientRect(); st.split = Math.max(0.02, Math.min(0.98, (ev.clientX - r.left) / r.width)); draw(); }
  $("gStage").addEventListener("pointermove", function (ev) { if (splitting) move(ev); });
  window.addEventListener("pointerup", function () { splitting = false; });

  // ---- controls ------------------------------------------------------------------------------------
  function chips(boxId, items, cur, pick) {
    var box = $(boxId); box.innerHTML = "";
    items.forEach(function (it) {
      var b = document.createElement("button"); b.textContent = it.name; b.className = it.id === cur ? "on" : "";
      b.addEventListener("click", function () { pick(it.id); refresh(); });
      box.appendChild(b);
    });
  }

  function buildSliders() {
    Object.keys(GROUPS).forEach(function (box) {
      $(box).innerHTML = "";
      GROUPS[box].forEach(function (k) {
        var r = G.RANGES[k], row = document.createElement("label"), name = document.createElement("span"), input = document.createElement("input"), out = document.createElement("b");
        name.textContent = LABELS[k]; input.type = "range"; input.min = r[0]; input.max = r[1]; input.step = r[2]; input.id = "gs-" + k;
        row.title = "Double-click to reset";
        input.addEventListener("input", function () { st.p[k] = +input.value; st.look = null; sync(); draw(); });
        row.addEventListener("dblclick", function () { st.p[k] = G.NEUTRAL[k]; st.look = null; refresh(); });
        row.appendChild(name); row.appendChild(input); row.appendChild(out);
        $(box).appendChild(row);
      });
    });
  }
  function sync() {
    G.KEYS.forEach(function (k) {
      var input = $("gs-" + k); if (!input) return;
      if (+input.value !== st.p[k]) input.value = st.p[k];
      input.nextSibling.textContent = fmt(k, st.p[k]);
      input.parentNode.className = st.p[k] !== G.NEUTRAL[k] ? "moved" : "";
    });
  }

  function refresh() {
    chips("gViews", VIEWS, st.view, function (id) { st.view = id; });
    chips("gPicks", PICKS, st.pick, function (id) { st.pick = st.pick === id ? null : id; });
    chips("gScopes", SCOPES, st.scope, function (id) { st.scope = id; });
    chips("gLooks", [{ id: "auto", name: "Auto" }].concat(G.LOOKS), st.look, function (id) {
      if (id === "auto") { if (st.fit) st.p = G.auto(st.fit); }
      else st.p = G.look(id);
      st.look = id;
    });
    $("gStage").className = st.pick ? "picking" : st.view === "split" ? "splitting" : "";
    $("gFalse").checked = st.falseColour;
    $("gMatch").disabled = !st.ref || !st.fit;
    sync(); draw();
  }
  $("gFalse").addEventListener("change", function () { st.falseColour = $("gFalse").checked; draw(); });

  // ---- Premiere -----------------------------------------------------------------------------------
  function run(tool, args) {
    if (!window.HaloBridge) return Promise.reject("Open this panel in Premiere Pro");
    return window.HaloBridge.run(tool, args || {}).then(function (r) { if (!r.ok) throw r.msg; return r; });
  }
  function exportFrame() {
    var path = req("path"), os = req("os"), fs = req("fs"), file = path.join(os.tmpdir(), "halocut-grade-" + Date.now() + ".png");
    return run("pr.exportFrame", { file: file }).then(function () {
      return new Promise(function (resolve, reject) {
        var tries = 0;
        (function wait() {
          var ok = false;
          try { ok = fs.statSync(file).size > 0; } catch (e) {}
          if (!ok) { if (++tries > 40) return reject("Premiere didn't write the frame"); return setTimeout(wait, 150); }
          setTimeout(function () { // read it as data, so the canvas can look at its pixels
            var img = new Image();
            img.onload = function () { resolve(img); };
            img.onerror = function () { reject("Couldn't read the frame"); };
            img.src = "data:image/png;base64," + fs.readFileSync(file).toString("base64");
          }, 60);
        })();
      });
    });
  }

  // The clip as shot: its Lumetri goes neutral for the grab and comes straight back.
  function grab() {
    if (st.busy) return;
    st.busy = true; say("Grabbing the frame at the playhead…", true);
    var info = null;
    run("pr.gradeRead", { neutral: true }).then(function (r) {
      info = r.data; st.info = info;
      if (!info.here) throw "No clip at the playhead";
      st.p = G.values(info.values); st.look = null;
      $("gName").textContent = info.here.name;
      return exportFrame();
    }).then(function (img) {
      setPicture(img); refresh();
      say(info.had ? "Read the clip's Lumetri Color · adjust, then Apply" : "No grade on this clip yet · adjust, then Apply");
    }).catch(function (m) { say(String(m)); })
      .then(function () {
        st.busy = false;
        if (info && info.had) return run("pr.gradeApply", { ids: [info.here.id], values: info.values, add: false }).catch(function (m) { say("Put the grade back by hand: " + m); });
      });
  }
  $("gGrab").addEventListener("click", grab);

  $("gApply").addEventListener("click", function () {
    if (st.busy) return;
    say("Writing to Lumetri Color…", true);
    run("pr.gradeRead").then(function (r) {
      if (!r.data.ids.length) throw "Select clips, or park the playhead on one";
      return run("pr.gradeApply", { ids: r.data.ids, values: st.p });
    }).then(function (r) { say(r.msg); }).catch(function (m) { say(String(m)); });
  });
  $("gReset").addEventListener("click", function () { st.p = G.values(); st.look = null; refresh(); say("Neutral · Apply to write it to the clip"); });

  $("gCube").addEventListener("click", function () {
    if (!req) return say("Open this panel in Premiere Pro to save files");
    var path = req("path"), fs = req("fs"), os = req("os"), dir = path.join(os.homedir(), "Documents", "HaloCut", "LUTs");
    var name = "HaloCut " + (st.look ? st.look + " " : "") + new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    try {
      fs.mkdirSync(dir, { recursive: true });
      var file = path.join(dir, name + ".cube");
      fs.writeFileSync(file, G.cube(st.p, 33, name), "utf8");
      say("Saved " + file + " · in Lumetri: Creative › Look › Browse");
    } catch (e) { say("Couldn't save the LUT: " + e.message); }
  });

  // ---- match ----------------------------------------------------------------------------------------
  function useReference(img, label) {
    st.ref = G.stats(pixels(img, 96, 96 * (img.naturalHeight || img.height) / (img.naturalWidth || img.width)));
    $("gRef").innerHTML = ""; var t = new Image(); t.src = img.src; t.title = label; $("gRef").appendChild(t);
    refresh(); say("Reference set · press Match to it");
  }
  $("gRefGrab").addEventListener("click", function () {
    say("Grabbing the reference…", true);
    exportFrame().then(function (img) { useReference(img, "Frame at the playhead"); }).catch(function (m) { say(String(m)); });
  });
  $("gRefLoad").addEventListener("click", function () {
    if (window.cep && window.cep.fs && window.cep.fs.showOpenDialog && req) {
      var res = window.cep.fs.showOpenDialog(false, false, "Reference picture", "", ["png", "jpg", "jpeg", "tif", "tiff", "bmp"]);
      if (!res || res.err || !res.data || !res.data.length) return;
      var fs = req("fs"), file = res.data[0], ext = file.split(".").pop().toLowerCase(), img = new Image();
      img.onload = function () { useReference(img, file); };
      img.onerror = function () { say("Couldn't read that picture"); };
      img.src = "data:image/" + (ext === "jpg" ? "jpeg" : ext) + ";base64," + fs.readFileSync(file).toString("base64");
    } else $("gFile").click();
  });
  $("gFile").addEventListener("change", function () {
    var f = $("gFile").files[0]; if (!f) return;
    var rd = new FileReader();
    rd.onload = function () { var img = new Image(); img.onload = function () { useReference(img, f.name); }; img.src = rd.result; };
    rd.readAsDataURL(f);
  });
  $("gMatch").addEventListener("click", function () {
    if (!st.ref || !st.fit) return;
    say("Matching…", true);
    setTimeout(function () { st.p = G.match(st.fit, st.ref); st.look = null; refresh(); say("Matched to the reference · Apply to write it"); }, 20);
  });

  window.addEventListener("resize", function () { st.small = null; draw(); });
  window.onHaloReady = function () { if (window.HaloBridge) grab(); };
  buildSliders();
  var demo = standIn();
  demo.onload = function () { if (!st.img) { setPicture(demo, 960, 540); refresh(); } };
  refresh();
  if (!window.HaloBridge) say("A stand-in shot: open this panel in Premiere Pro to grade yours");
})();
