/* HaloCut Zoom panel: draw on the frame at the playhead, then add zooms, a frame, focus boxes, callouts and cards.
 * © 2026 Imtayz Nayem */
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var Z = window.HaloZoom;
  var req = window.cep_node ? window.cep_node.require : window.require;
  var BGS = [
    { id: "dusk", name: "Dusk", stops: ["#ff9a4d", "#e8457c", "#7b3fe4"] },
    { id: "ocean", name: "Ocean", stops: ["#0f2a6b", "#1572c9", "#38d6e8"] },
    { id: "mint", name: "Mint", stops: ["#0b6b55", "#19b48a", "#b6f2d8"] },
    { id: "grape", name: "Grape", stops: ["#2a1456", "#6d28d9", "#db2777"] },
    { id: "graphite", name: "Graphite", stops: ["#0e1116", "#252b35", "#3a4250"] },
    { id: "paper", name: "Paper", stops: ["#f7f4ef", "#ece6dc", "#ddd3c4"], light: true },
    { id: "solid", name: "Solid" },
  ];
  var MODES = [{ id: "spot", name: "Spotlight" }, { id: "blur", name: "Blur" }, { id: "pixel", name: "Pixelate" }, { id: "box", name: "Black box" }];
  var STYLES = {
    light: { name: "Light", fill: "#ffffff", text: "#16121a", line: "#ffffff" },
    dark: { name: "Dark", fill: "#16121a", text: "#ffffff", line: "#16121a" },
    glow: { name: "Glow", fill: ["#ff8a3d", "#e8457c"], text: "#ffffff", line: "#ff8a3d" },
  };
  var st = {
    tab: "zoom", info: null, frame: { w: 1920, h: 1080 }, img: null, box: null, fbox: null, point: null, playing: 0,
    zoom: { in: 0.5, hold: 2, out: 0.5, ease: "smooth" },
    fr: { pad: 0.06, radius: 28, shadow: 60, bg: "dusk", color: "#1d1b22" },
    focus: { mode: "spot", dim: 60, feather: 24, radius: 18, blur: 40, block: 24, len: 3, fade: true },
    call: { text: "Click here", style: "light", size: 1.3, arrow: true, len: 3, fade: true },
    card: { where: "intro", title: "How it works", sub: "A two-minute tour", bg: "dusk", len: 3, push: true, fade: true },
  };

  function say(t, busy) { $("zSum").className = "sum" + (busy ? " busy" : ""); $("zSumText").textContent = t; }
  function bg(id) { for (var i = 0; i < BGS.length; i++) if (BGS[i].id === id) return BGS[i]; return BGS[0]; }
  function tgt() { return Z.target(st.frame, st.info && st.info.here ? st.info.here.rect : null); }
  function secs(v) { return (Math.round(v * 10) / 10) + " s"; }

  function resetBoxes() {
    var T = tgt(), F = st.frame;
    st.box = Z.fitBox({ x: T.x + T.w * 0.5, y: T.y + T.h * 0.12, w: T.w * 0.4, h: T.h * 0.4 }, T);
    st.fbox = { x: F.w * 0.12, y: F.h * 0.3, w: F.w * 0.32, h: F.h * 0.16 };
    st.point = [F.w * 0.66, F.h * 0.36];
  }

  // ---- drawing helpers (all in frame pixels; px = device pixels per frame pixel, for blur and shadow sizes) ----
  function rrect(g, r, rad) {
    var k = Math.max(0, Math.min(rad, r.w / 2, r.h / 2));
    g.beginPath();
    g.moveTo(r.x + k, r.y); g.arcTo(r.x + r.w, r.y, r.x + r.w, r.y + r.h, k); g.arcTo(r.x + r.w, r.y + r.h, r.x, r.y + r.h, k);
    g.arcTo(r.x, r.y + r.h, r.x, r.y, k); g.arcTo(r.x, r.y, r.x + r.w, r.y, k); g.closePath();
  }
  function fillBg(g, id, color, F) {
    var b = bg(id);
    if (!b.stops) g.fillStyle = color;
    else {
      var gr = g.createLinearGradient(0, 0, F.w, F.h);
      b.stops.forEach(function (c, i) { gr.addColorStop(i / (b.stops.length - 1), c); });
      g.fillStyle = gr;
    }
    g.fillRect(0, 0, F.w, F.h);
  }
  function layer(w, h, fn) { var c = document.createElement("canvas"); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); fn(c.getContext("2d")); return c; }

  // The frame at the playhead, or a stand-in screen recording before one is grabbed.
  function drawShot(g) {
    var F = st.frame;
    if (st.img) { g.drawImage(st.img, 0, 0, F.w, F.h); return; }
    var gr = g.createLinearGradient(0, 0, F.w, F.h);
    gr.addColorStop(0, "#1c2a44"); gr.addColorStop(1, "#3b2346");
    g.fillStyle = gr; g.fillRect(0, 0, F.w, F.h);
    var win = { x: F.w * 0.06, y: F.h * 0.08, w: F.w * 0.88, h: F.h * 0.84 }, u = F.h / 100;
    g.fillStyle = "#f4f3f7"; rrect(g, win, u * 1.6); g.fill();
    g.fillStyle = "#e3e1ea"; g.fillRect(win.x, win.y + u * 6, win.w * 0.2, win.h - u * 6);
    ["#ff6159", "#ffbd2e", "#28c941"].forEach(function (c, i) { g.fillStyle = c; g.beginPath(); g.arc(win.x + u * (3 + i * 2.6), win.y + u * 3, u * 0.9, 0, 7); g.fill(); });
    g.fillStyle = "#c9c5d4";
    for (var i = 0; i < 7; i++) g.fillRect(win.x + u * 2.5, win.y + u * (10 + i * 6), win.w * 0.13, u * 2);
    g.fillStyle = "#2b2633"; g.fillRect(win.x + win.w * 0.25, win.y + u * 10, win.w * 0.3, u * 4);
    g.fillStyle = "#d7d3df";
    for (var j = 0; j < 5; j++) g.fillRect(win.x + win.w * 0.25, win.y + u * (20 + j * 7), win.w * (0.5 - (j % 2) * 0.12), u * 2.4);
    g.fillStyle = "#e8457c"; rrect(g, { x: win.x + win.w * 0.72, y: win.y + u * 10, w: win.w * 0.18, h: u * 6 }, u * 3); g.fill();
    g.fillStyle = "#fff"; g.font = "600 " + Math.round(u * 2.6) + "px -apple-system, sans-serif"; g.textBaseline = "middle";
    g.fillText("Sign up", win.x + win.w * 0.765, win.y + u * 13.1);
  }

  function drawFrameOverlay(g, hole, o, F, px) {
    fillBg(g, o.bg, o.color, F);
    if (o.shadow > 0) {
      g.save();
      g.shadowColor = "rgba(0,0,0," + (o.shadow / 100 * 0.65) + ")";
      g.shadowBlur = (F.h * 0.06 * o.shadow / 100 + 2) * px; g.shadowOffsetY = F.h * 0.015 * o.shadow / 100 * px;
      g.fillStyle = "#000"; rrect(g, hole, o.radius); g.fill();
      g.restore();
    }
    // the hole, a pixel inside the clip's edge so no sliver of its border shows
    g.save(); g.globalCompositeOperation = "destination-out";
    rrect(g, { x: hole.x + 1, y: hole.y + 1, w: hole.w - 2, h: hole.h - 2 }, Math.max(0, o.radius - 1)); g.fill();
    g.restore();
  }

  function drawSpot(g, box, o, F, px) {
    g.fillStyle = "rgba(0,0,0," + o.dim / 100 + ")"; g.fillRect(0, 0, F.w, F.h);
    g.save(); g.globalCompositeOperation = "destination-out";
    if (o.feather) g.filter = "blur(" + (o.feather * px) + "px)";
    rrect(g, box, o.radius); g.fill();
    g.restore();
  }

  function drawBlackBox(g, box, o) { g.fillStyle = "#0b0a0e"; rrect(g, box, o.radius); g.fill(); }

  function drawCallout(g, o, point, F, px) {
    var fs = Math.round(F.h * 0.034 * o.size), sty = STYLES[o.style] || STYLES.light, text = o.text || " ";
    g.font = "700 " + fs + "px -apple-system, 'Segoe UI', Inter, sans-serif";
    var padX = fs * 0.85, padY = fs * 0.55, size = { w: g.measureText(text).width + padX * 2, h: fs + padY * 2 };
    var L = Z.calloutLayout(F, point, size, F.h * 0.13 * o.size), ring = fs * 0.62;
    var lineCol = sty.line;
    g.lineCap = "round"; g.lineJoin = "round";
    g.save(); g.shadowColor = "rgba(0,0,0,.35)"; g.shadowBlur = fs * 0.4 * px;
    g.strokeStyle = lineCol; g.lineWidth = Math.max(2, fs * 0.13);
    g.beginPath(); g.arc(point[0], point[1], ring, 0, Math.PI * 2); g.stroke();
    g.fillStyle = lineCol; g.beginPath(); g.arc(point[0], point[1], fs * 0.17, 0, Math.PI * 2); g.fill();
    if (o.arrow) {
      var fx = L.from[0], fy = L.from[1], dx = point[0] - fx, dy = point[1] - fy, d = Math.sqrt(dx * dx + dy * dy) || 1;
      var ex = point[0] - dx / d * ring * 1.5, ey = point[1] - dy / d * ring * 1.5;
      var cx = (fx + ex) / 2 - dy / d * d * 0.18, cy = (fy + ey) / 2 + dx / d * d * 0.18;
      if (d > ring * 3) {
        g.beginPath(); g.moveTo(fx, fy); g.quadraticCurveTo(cx, cy, ex, ey); g.stroke();
        var ax = ex - cx, ay = ey - cy, al = Math.sqrt(ax * ax + ay * ay) || 1, hl = fs * 0.55;
        ax /= al; ay /= al;
        g.beginPath();
        g.moveTo(ex - ax * hl - ay * hl * 0.6, ey - ay * hl + ax * hl * 0.6); g.lineTo(ex, ey);
        g.lineTo(ex - ax * hl + ay * hl * 0.6, ey - ay * hl - ax * hl * 0.6); g.stroke();
      }
    }
    g.restore();
    g.save();
    g.shadowColor = "rgba(0,0,0,.38)"; g.shadowBlur = fs * 0.7 * px; g.shadowOffsetY = fs * 0.14 * px;
    if (sty.fill instanceof Array) {
      var gr = g.createLinearGradient(L.label.x, 0, L.label.x + L.label.w, 0);
      gr.addColorStop(0, sty.fill[0]); gr.addColorStop(1, sty.fill[1]); g.fillStyle = gr;
    } else g.fillStyle = sty.fill;
    rrect(g, L.label, size.h / 2); g.fill();
    g.restore();
    g.fillStyle = sty.text; g.textBaseline = "middle";
    g.fillText(text, L.label.x + padX, L.label.y + size.h / 2 + fs * 0.04);
  }

  function drawCard(g, o, F) {
    fillBg(g, o.bg, "#1d1b22", F);
    var light = bg(o.bg).light, title = o.title || "", sub = o.sub || "";
    var glow = g.createRadialGradient(F.w * 0.5, F.h * 0.45, 0, F.w * 0.5, F.h * 0.45, F.w * 0.55);
    glow.addColorStop(0, light ? "rgba(255,255,255,.5)" : "rgba(255,255,255,.12)"); glow.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = glow; g.fillRect(0, 0, F.w, F.h);
    var ts = F.h * 0.085;
    g.font = "800 " + ts + "px -apple-system, 'Segoe UI', Inter, sans-serif";
    while (g.measureText(title).width > F.w * 0.84 && ts > F.h * 0.03) { ts *= 0.94; g.font = "800 " + ts + "px -apple-system, 'Segoe UI', Inter, sans-serif"; }
    g.textAlign = "center"; g.textBaseline = "middle";
    g.fillStyle = light ? "#18141c" : "#ffffff";
    g.fillText(title, F.w / 2, F.h * (sub ? 0.44 : 0.5));
    var bar = g.createLinearGradient(F.w * 0.46, 0, F.w * 0.54, 0);
    bar.addColorStop(0, "#ff8a3d"); bar.addColorStop(1, "#e8457c");
    g.fillStyle = bar; rrect(g, { x: F.w * 0.47, y: F.h * (sub ? 0.44 : 0.5) + ts * 0.72, w: F.w * 0.06, h: F.h * 0.008 }, F.h * 0.004); g.fill();
    if (sub) {
      var ss = F.h * 0.042;
      g.font = "500 " + ss + "px -apple-system, 'Segoe UI', Inter, sans-serif";
      g.fillStyle = light ? "rgba(24,20,28,.7)" : "rgba(255,255,255,.78)";
      g.fillText(sub, F.w / 2, F.h * 0.44 + ts * 0.72 + F.h * 0.07);
    }
    g.textAlign = "start";
  }

  function frameLayout() { return Z.frameLayout(st.frame, st.info && st.info.here ? st.info.here.rect : null, st.fr.pad); }

  // ---- the stage ------------------------------------------------------------------------------
  function draw(progress) {
    var c = $("zStage"), dpr = window.devicePixelRatio || 1, W = c.clientWidth || 320, F = st.frame, H = W * F.h / F.w;
    c.style.height = H + "px"; c.width = Math.round(W * dpr); c.height = Math.round(H * dpr);
    var g = c.getContext("2d"), k = W / F.w, px = dpr * k;
    g.setTransform(dpr * k, 0, 0, dpr * k, 0, 0);
    g.fillStyle = "#000"; g.fillRect(0, 0, F.w, F.h);
    var u = 1 / k; // one screen pixel, in frame pixels
    if (st.tab === "cards") { drawCard(g, st.card, F); return; }

    if (st.tab === "zoom") {
      var T = tgt();
      if (progress !== undefined) {
        var m = Z.zoomAt(T, st.box, progress);
        g.save(); g.beginPath(); g.rect(T.x, T.y, T.w, T.h); g.clip();
        g.transform(m.z, 0, 0, m.z, m.a[0], m.a[1]); drawShot(g); g.restore();
        return;
      }
      drawShot(g);
      var b = st.box;
      g.save(); g.fillStyle = "rgba(0,0,0,.42)"; g.beginPath(); g.rect(0, 0, F.w, F.h); g.rect(b.x, b.y + b.h, b.w, -b.h); g.fill("evenodd"); g.restore();
      if (T.w < F.w - 1 || T.h < F.h - 1) { g.save(); g.setLineDash([6 * u, 5 * u]); g.strokeStyle = "rgba(255,255,255,.5)"; g.lineWidth = u; g.strokeRect(T.x, T.y, T.w, T.h); g.restore(); }
      outline(g, b, u, "#ff8a3d");
      tag(g, b, u, Math.round(Z.zoomFactor(T, b) * 10) / 10 + "×");
      return;
    }

    if (st.tab === "frame") {
      var lay = frameLayout();
      g.save(); g.translate(F.w / 2, F.h / 2); g.scale(lay.k, lay.k); g.translate(-F.w / 2, -F.h / 2); drawShot(g); g.restore();
      g.drawImage(layer(c.width, c.height, function (h) { h.scale(px, px); drawFrameOverlay(h, lay.hole, st.fr, F, px); }), 0, 0, F.w, F.h);
      return;
    }

    drawShot(g);
    if (st.tab === "focus") {
      var fb = st.fbox, o = st.focus;
      if (o.mode === "spot") g.drawImage(layer(c.width, c.height, function (h) { h.scale(px, px); drawSpot(h, fb, o, F, px); }), 0, 0, F.w, F.h);
      else if (o.mode === "box") drawBlackBox(g, fb, o);
      else if (o.mode === "blur") {
        g.save(); g.beginPath(); g.rect(fb.x, fb.y, fb.w, fb.h); g.clip(); g.filter = "blur(" + (o.blur * 0.5 * px) + "px)"; drawShot(g); g.restore();
      } else {
        var bw = Math.max(1, Math.round(F.w / o.block)), bh = Math.max(1, Math.round(F.h / o.block));
        var small = layer(bw, bh, function (h) { h.scale(bw / F.w, bh / F.h); drawShot(h); });
        g.save(); g.beginPath(); g.rect(fb.x, fb.y, fb.w, fb.h); g.clip(); g.imageSmoothingEnabled = false; g.drawImage(small, 0, 0, F.w, F.h); g.restore();
      }
      outline(g, fb, u, "#36c2ff", true);
      return;
    }
    if (st.tab === "callout") drawCallout(g, st.call, st.point, F, px);
  }

  function outline(g, b, u, col, dashed) {
    g.save(); g.strokeStyle = col; g.lineWidth = 2 * u; if (dashed) g.setLineDash([7 * u, 5 * u]);
    g.strokeRect(b.x, b.y, b.w, b.h); g.setLineDash([]);
    g.fillStyle = col; g.fillRect(b.x + b.w - 5 * u, b.y + b.h - 5 * u, 10 * u, 10 * u);
    g.restore();
  }
  function tag(g, b, u, text) {
    g.save(); g.font = "700 " + 11 * u + "px -apple-system, sans-serif";
    var w = g.measureText(text).width + 12 * u, x = b.x, y = b.y - 20 * u < 0 ? b.y + 4 * u : b.y - 20 * u;
    g.fillStyle = "#ff8a3d"; rrect(g, { x: x, y: y, w: w, h: 16 * u }, 8 * u); g.fill();
    g.fillStyle = "#1a0f16"; g.textBaseline = "middle"; g.fillText(text, x + 6 * u, y + 8.5 * u);
    g.restore();
  }

  // ---- pointer: draw, move and resize the box; place the callout point ----------------------------
  var drag = null;
  function at(ev) { var r = $("zStage").getBoundingClientRect(), k = st.frame.w / r.width; return [(ev.clientX - r.left) * k, (ev.clientY - r.top) * k]; }
  function boxNow() { return st.tab === "zoom" ? st.box : st.fbox; }
  function setBox(b) {
    if (st.tab === "zoom") { st.box = Z.fitBox(b, tgt()); return; }
    var F = st.frame, w = Math.max(16, Math.min(F.w, b.w)), h = Math.max(16, Math.min(F.h, b.h));
    st.fbox = { x: Math.max(0, Math.min(F.w - w, b.x)), y: Math.max(0, Math.min(F.h - h, b.y)), w: w, h: h };
  }
  function shaped(x0, y0, dx, dy) { // a box from a corner, the zoom's shape on the Zoom tab
    var w = Math.abs(dx), h = Math.abs(dy);
    if (st.tab === "zoom") { var T = tgt(), a = T.w / T.h; w = Math.max(w, h * a); h = w / a; }
    return { x: dx < 0 ? x0 - w : x0, y: dy < 0 ? y0 - h : y0, w: w, h: h };
  }
  $("zStage").addEventListener("pointerdown", function (ev) {
    if (st.tab === "cards" || st.tab === "frame") return;
    var p = at(ev), k = st.frame.w / $("zStage").getBoundingClientRect().width;
    $("zStage").setPointerCapture(ev.pointerId);
    if (st.tab === "callout") { st.point = p; drag = { mode: "point" }; draw(); return; }
    var b = boxNow();
    if (Math.abs(p[0] - (b.x + b.w)) < 12 * k && Math.abs(p[1] - (b.y + b.h)) < 12 * k) drag = { mode: "size", b: b };
    else if (p[0] > b.x && p[0] < b.x + b.w && p[1] > b.y && p[1] < b.y + b.h) drag = { mode: "move", dx: p[0] - b.x, dy: p[1] - b.y, b: b };
    else drag = { mode: "draw", s: p };
    $("zStage").classList.toggle("moving", drag.mode === "move");
  });
  $("zStage").addEventListener("pointermove", function (ev) {
    if (!drag) return;
    var p = at(ev);
    if (drag.mode === "point") st.point = [Math.max(0, Math.min(st.frame.w, p[0])), Math.max(0, Math.min(st.frame.h, p[1]))];
    else if (drag.mode === "move") setBox({ x: p[0] - drag.dx, y: p[1] - drag.dy, w: drag.b.w, h: drag.b.h });
    else if (drag.mode === "size") setBox(shaped(drag.b.x, drag.b.y, Math.max(8, p[0] - drag.b.x), Math.max(8, p[1] - drag.b.y)));
    else if (Math.abs(p[0] - drag.s[0]) + Math.abs(p[1] - drag.s[1]) > 6) setBox(shaped(drag.s[0], drag.s[1], p[0] - drag.s[0], p[1] - drag.s[1]));
    draw();
  });
  window.addEventListener("pointerup", function () { drag = null; $("zStage").classList.remove("moving"); });
  $("zStage").addEventListener("wheel", function (ev) {
    if (st.tab !== "zoom" && st.tab !== "focus") return;
    ev.preventDefault();
    var b = boxNow(), f = ev.deltaY < 0 ? 1 / 1.06 : 1.06, cx = b.x + b.w / 2, cy = b.y + b.h / 2;
    setBox({ x: cx - b.w * f / 2, y: cy - b.h * f / 2, w: b.w * f, h: b.h * f });
    draw();
  }, { passive: false });

  // ---- preview the zoom ------------------------------------------------------------------------------
  function play() {
    if (st.tab !== "zoom") return;
    if (st.playing) { cancelAnimationFrame(st.playing); st.playing = 0; $("zPlay").textContent = "▶"; draw(); return; }
    var tm = { in: st.zoom.in, hold: Math.min(st.zoom.hold, 1.2), out: st.zoom.out }, t0 = performance.now();
    $("zPlay").textContent = "❚❚";
    (function step(now) {
      var t = (now - t0) / 1000;
      if (t > tm.in + tm.hold + tm.out + 0.3) { st.playing = 0; $("zPlay").textContent = "▶"; draw(); return; }
      draw(Z.progressAt(tm, t, st.zoom.ease));
      st.playing = requestAnimationFrame(step);
    })(t0);
  }
  $("zPlay").addEventListener("click", play);

  // ---- controls ----------------------------------------------------------------------------------------
  function chips(boxId, items, cur, pick, swatch) {
    var box = $(boxId); box.innerHTML = "";
    items.forEach(function (it) {
      var b = document.createElement("button"); b.className = it.id === cur ? "on" : "";
      if (swatch && it.stops) { var i = document.createElement("i"); i.style.background = "linear-gradient(135deg," + it.stops.join(",") + ")"; b.appendChild(i); }
      b.appendChild(document.createTextNode(it.name));
      b.addEventListener("click", function () { pick(it.id); refresh(); });
      box.appendChild(b);
    });
  }
  function slider(id, obj, key, fmt) {
    var el = $(id), out = $(id + "Out");
    el.value = obj[key];
    if (out) out.textContent = fmt(obj[key]);
    if (!el._wired) { el._wired = true; el.addEventListener("input", function () { obj[key] = +el.value; if (out) out.textContent = fmt(obj[key]); draw(); }); }
  }
  function check(id, obj, key) {
    var el = $(id); el.checked = !!obj[key];
    if (!el._wired) { el._wired = true; el.addEventListener("change", function () { obj[key] = el.checked; refresh(); }); }
  }
  function text(id, obj, key) {
    var el = $(id); if (document.activeElement !== el) el.value = obj[key];
    if (!el._wired) { el._wired = true; el.addEventListener("input", function () { obj[key] = el.value; draw(); }); }
  }

  var ACTIONS = {
    zoom: { go: "Add zoom", alt: "Clear zooms", hint: "Drag to draw what to zoom into · drag it to move · scroll to resize" },
    frame: { go: "Frame clips", alt: "Remove frame", hint: "Frames the selected clips, or the one at the playhead" },
    focus: { go: "Add at playhead", hint: "Drag to draw the box · drag it to move · corner to resize" },
    callout: { go: "Add at playhead", hint: "Click where the callout points" },
    cards: { go: "Add intro card", hint: "A title card at the start or the end of the sequence" },
  };

  function refresh() {
    var tabs = $("zTabs").querySelectorAll("button");
    for (var i = 0; i < tabs.length; i++) tabs[i].className = tabs[i].getAttribute("data-tab") === st.tab ? "on" : "";
    var panes = document.querySelectorAll(".z-pane");
    for (var p = 0; p < panes.length; p++) panes[p].hidden = panes[p].getAttribute("data-pane") !== st.tab;
    var A = ACTIONS[st.tab];
    $("zGo").textContent = st.tab === "cards" ? (st.card.where === "intro" ? "Add intro card" : "Add outro card") : A.go;
    $("zAlt").textContent = A.alt || ""; $("zAlt").hidden = !A.alt;
    $("zStageHint").textContent = A.hint;
    $("zStageLabel").textContent = st.tab === "cards" ? "The card" : "Frame at the playhead";
    $("zPlay").hidden = st.tab !== "zoom";
    $("zGrab").hidden = st.tab === "cards";

    chips("zEase", Z.EASE_LIST, st.zoom.ease, function (id) { st.zoom.ease = id; });
    slider("zIn", st.zoom, "in", secs); slider("zHold", st.zoom, "hold", secs); slider("zOut", st.zoom, "out", secs);

    chips("zBgs", BGS, st.fr.bg, function (id) { st.fr.bg = id; }, true);
    $("zColorRow").hidden = st.fr.bg !== "solid";
    $("zColor").value = st.fr.color;
    slider("zPad", st.fr, "pad", function (v) { return Math.round(v * 100) + " %"; });
    slider("zRad", st.fr, "radius", function (v) { return v + " px"; });
    slider("zShadow", st.fr, "shadow", function (v) { return v + " %"; });

    chips("zModes", MODES, st.focus.mode, function (id) { st.focus.mode = id; });
    var rows = document.querySelectorAll("[data-mode]");
    for (var r = 0; r < rows.length; r++) rows[r].hidden = rows[r].getAttribute("data-mode").split(" ").indexOf(st.focus.mode) < 0;
    slider("zDim", st.focus, "dim", function (v) { return v + " %"; });
    slider("zFeather", st.focus, "feather", function (v) { return v + " px"; });
    slider("zFRad", st.focus, "radius", function (v) { return v + " px"; });
    slider("zBlur", st.focus, "blur", function (v) { return v; });
    slider("zBlock", st.focus, "block", function (v) { return v + " px"; });
    slider("zFLen", st.focus, "len", secs);
    check("zFFade", st.focus, "fade");

    text("zText", st.call, "text");
    chips("zStyles", Object.keys(STYLES).map(function (k) { return { id: k, name: STYLES[k].name }; }), st.call.style, function (id) { st.call.style = id; });
    slider("zCSize", st.call, "size", function (v) { return Math.round(v * 100) + " %"; });
    check("zArrow", st.call, "arrow");
    slider("zCLen", st.call, "len", secs);
    check("zCFade", st.call, "fade");

    chips("zWhere", [{ id: "intro", name: "Intro" }, { id: "outro", name: "Outro" }], st.card.where, function (id) { st.card.where = id; });
    text("zTitle", st.card, "title"); text("zSub", st.card, "sub");
    chips("zCardBgs", BGS.filter(function (b) { return b.stops; }), st.card.bg, function (id) { st.card.bg = id; }, true);
    slider("zKLen", st.card, "len", secs);
    $("zPushRow").hidden = st.card.where !== "intro";
    check("zPush", st.card, "push"); check("zKFade", st.card, "fade");
    draw();
  }
  $("zTabs").addEventListener("click", function (ev) {
    var t = ev.target.getAttribute && ev.target.getAttribute("data-tab");
    if (!t) return;
    if (st.playing) play();
    st.tab = t; refresh();
  });
  $("zColor").addEventListener("input", function () { st.fr.color = $("zColor").value; draw(); });

  // ---- Premiere ---------------------------------------------------------------------------------------
  // Resolves with { msg, data }; a tool that says no rejects with its message.
  function run(tool, args) {
    if (!window.HaloBridge) return Promise.reject("Open this panel in Premiere Pro");
    return window.HaloBridge.run(tool, args || {}).then(function (r) { if (!r.ok) throw r.msg; return r; });
  }
  function fresh() {
    return run("pr.zoomInfo").then(function (r) {
      var d = r.data;
      var size = d.frame.w !== st.frame.w || d.frame.h !== st.frame.h;
      st.info = d; st.frame = d.frame;
      if (size || !st.box) resetBoxes();
      else st.box = Z.fitBox(st.box, tgt());
      return d;
    });
  }
  function grab() {
    say("Grabbing the frame at the playhead…", true);
    fresh().then(function (d) {
      draw();
      var path = req("path"), os = req("os"), fs = req("fs"), file = path.join(os.tmpdir(), "halocut-zoom-" + Date.now() + ".png");
      return run("pr.exportFrame", { file: file }).then(function () {
        var tries = 0;
        (function wait() {
          var ok = false;
          try { ok = fs.statSync(file).size > 0; } catch (e) {}
          if (!ok) { if (++tries > 40) return say("Premiere didn't write the frame"); return setTimeout(wait, 150); }
          var img = new Image();
          img.onload = function () {
            st.img = img; draw();
            var h = d.here;
            say(!h ? "No clip at the playhead" : h.inZoom ? "The playhead is inside a zoom: move it out to see the whole frame" : "“" + h.name + "” · draw on the frame");
          };
          img.src = "file://" + file;
        })();
      });
    }).catch(function (m) { say(String(m)); });
  }
  $("zGrab").addEventListener("click", grab);

  function assetsDir(info) {
    var path = req("path"), fs = req("fs"), os = req("os"), dirs = [];
    if (info.project) dirs.push(path.join(path.dirname(info.project), "HaloCut assets"));
    dirs.push(path.join(os.homedir(), "Documents", "HaloCut", "Assets"));
    for (var i = 0; i < dirs.length; i++) {
      try { fs.mkdirSync(dirs[i], { recursive: true }); fs.accessSync(dirs[i], fs.constants.W_OK); return dirs[i]; } catch (e) {}
    }
    return os.tmpdir();
  }
  // Draws a picture the size of the sequence frame and saves it where the project can keep it.
  function savePicture(info, kind, paint) {
    var path = req("path"), fs = req("fs"), F = info.frame;
    var c = layer(F.w, F.h, function (g) { paint(g, F); });
    var file = path.join(assetsDir(info), "halocut-" + kind + "-" + Date.now() + ".png");
    fs.writeFileSync(file, Buffer.from(c.toDataURL("image/png").split(",")[1], "base64"));
    return file;
  }

  function addZoom(d) {
    var h = d.here;
    if (!h) throw "Park the playhead on the clip to zoom";
    var tm = { in: st.zoom.in, hold: st.zoom.hold, out: st.zoom.out }, room = h.end - d.at - tm.in - tm.out;
    if (room < 0) throw "Only " + secs(h.end - d.at) + " of the clip left after the playhead: move it earlier";
    tm.hold = Math.min(tm.hold, room);
    var p = Z.plan(tgt(), st.box, tm, d.fps, st.zoom.ease);
    return run("pr.zoomAdd", { id: h.id, at: d.at, keys: p.keys });
  }
  function addFrame(d) {
    if (!d.clips.length) throw "Select clips, or park the playhead on one";
    var groups = Z.groupByRect(d.clips).map(function (gp) {
      var lay = Z.frameLayout(d.frame, gp.rect, st.fr.pad);
      return { ids: gp.ids, file: savePicture(d, "frame", function (g, F) { drawFrameOverlay(g, lay.hole, st.fr, F, 1); }) };
    });
    return run("pr.zoomFrame", { k: Z.frameLayout(d.frame, null, st.fr.pad).k, groups: groups });
  }
  function addFocus(d) {
    var o = st.focus, b = st.fbox;
    if (o.mode === "spot" || o.mode === "box") {
      var file = savePicture(d, o.mode, function (g, F) { if (o.mode === "spot") drawSpot(g, b, o, F, 1); else drawBlackBox(g, b, o); });
      return run("pr.zoomOverlay", { file: file, name: o.mode === "spot" ? "Spotlight" : "Black box", len: o.len, fade: o.fade ? 0.25 : 0 });
    }
    var h = d.here;
    if (!h) throw "Park the playhead on the clip";
    var crop = Z.cropFor(b, { scale: h.scale, position: h.position }, h.src, d.frame), k = h.scale / 100;
    var block = o.block / k;
    return run("pr.zoomBlur", { id: h.id, len: o.len, crop: crop, mode: o.mode, amount: Math.round(o.blur / k),
      blocks: [Math.max(1, Math.round(h.src.w / block)), Math.max(1, Math.round(h.src.h / block))] });
  }
  function addCallout(d) {
    if (!st.call.text) throw "Type the callout text";
    var file = savePicture(d, "callout", function (g, F) { drawCallout(g, st.call, st.point, F, 1); });
    return run("pr.zoomOverlay", { file: file, name: "Callout · " + st.call.text, len: st.call.len, fade: st.call.fade ? 0.2 : 0 });
  }
  function addCard(d) {
    var file = savePicture(d, "card", function (g, F) { drawCard(g, st.card, F); });
    return run("pr.zoomCard", { file: file, title: st.card.title, where: st.card.where, len: st.card.len, push: st.card.push, fade: st.card.fade ? 0.4 : 0 });
  }
  var DO = { zoom: addZoom, frame: addFrame, focus: addFocus, callout: addCallout, cards: addCard };

  function act(fn, busy) {
    say(busy, true);
    fresh().then(fn).then(function (r) { say(r.msg); }).catch(function (m) { say(String(m)); });
  }

  $("zGo").addEventListener("click", function () { act(DO[st.tab], "Working…"); });
  $("zAlt").addEventListener("click", function () {
    if (st.tab === "zoom") act(function () { return run("pr.zoomClear"); }, "Clearing zooms…");
    if (st.tab === "frame") act(function () { return run("pr.zoomUnframe"); }, "Removing the frame…");
  });

  window.addEventListener("resize", function () { draw(); });
  window.onHaloReady = function () { if (window.HaloBridge) grab(); };
  resetBoxes(); refresh();
  if (!window.HaloBridge) say("A stand-in frame: open this panel in Premiere Pro to use yours");
})();
