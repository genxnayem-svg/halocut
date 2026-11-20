/* HaloCut Studio — safe-zone guides. Draws a platform's interface and safe area as a transparent
 * picture at the sequence's size. Margins are approximate, measured from each app's own layout.
 * © 2026 Imtayz Nayem */
(function (root) {
  // Margins are a share of the frame (top, bottom, left, right). ui: which mock-ups to draw.
  var PRESETS = [
    { id: "tiktok", name: "TikTok", ratio: "9:16", m: [0.10, 0.20, 0.05, 0.14], ui: { side: true, caption: true, top: "tabs" } },
    { id: "reels", name: "Instagram Reels", ratio: "9:16", m: [0.14, 0.35, 0.06, 0.06], ui: { side: true, caption: true, top: "camera" } },
    { id: "shorts", name: "YouTube Shorts", ratio: "9:16", m: [0.12, 0.25, 0.05, 0.15], ui: { side: true, caption: true, top: "search" } },
    { id: "stories", name: "Stories", ratio: "9:16", m: [0.14, 0.20, 0.06, 0.06], ui: { progress: true, reply: true } },
    { id: "youtube", name: "YouTube", ratio: "16:9", m: [0.05, 0.12, 0.05, 0.05], ui: { player: true } },
    { id: "feed", name: "Feed", ratio: "4:5", m: [0.06, 0.06, 0.06, 0.06], ui: {} },
    { id: "square", name: "Square post", ratio: "1:1", m: [0.06, 0.06, 0.06, 0.06], ui: {} },
    { id: "tv", name: "TV title safe", ratio: "any", m: [0.10, 0.10, 0.10, 0.10], ui: { action: 0.05 } },
  ];

  function rr(g, x, y, w, h, r) {
    g.beginPath();
    g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
  }

  // Draws onto a canvas sized w×h. opts: { zone, ui, centre, thirds, grid }
  function draw(canvas, preset, w, h, opts) {
    canvas.width = w; canvas.height = h;
    var g = canvas.getContext("2d");
    g.clearRect(0, 0, w, h);
    var u = Math.min(w, h) / 1080; // scale for line widths and shapes
    var m = preset.m;
    var sx = m[2] * w, sy = m[0] * h, sw = w * (1 - m[2] - m[3]), sh = h * (1 - m[0] - m[1]);

    if (opts.zone !== false) {
      // shade what the app covers, with diagonal hatching
      g.save();
      g.beginPath();
      g.rect(0, 0, w, h);
      g.rect(sx, sy, sw, sh);
      g.clip("evenodd");
      g.fillStyle = "rgba(232, 69, 124, 0.20)";
      g.fillRect(0, 0, w, h);
      g.strokeStyle = "rgba(232, 69, 124, 0.35)";
      g.lineWidth = 3 * u;
      for (var d = -h; d < w; d += 28 * u) { g.beginPath(); g.moveTo(d, 0); g.lineTo(d + h, h); g.stroke(); }
      g.restore();
      g.strokeStyle = "#ffa23d";
      g.lineWidth = 5 * u;
      g.strokeRect(sx, sy, sw, sh);
      label(g, "SAFE ZONE", sx + sw / 2, sy + 26 * u, u, "#ffa23d");
      if (preset.ui.action) {
        var a = preset.ui.action;
        g.setLineDash([16 * u, 10 * u]);
        g.strokeRect(a * w, a * h, w * (1 - 2 * a), h * (1 - 2 * a));
        g.setLineDash([]);
      }
    }

    if (opts.ui !== false) drawUi(g, preset, w, h, u);

    g.strokeStyle = "rgba(255,255,255,0.55)";
    g.lineWidth = 2 * u;
    if (opts.centre) line(g, w / 2, 0, w / 2, h), line(g, 0, h / 2, w, h / 2);
    if (opts.thirds) {
      for (var i = 1; i < 3; i++) line(g, (w * i) / 3, 0, (w * i) / 3, h), line(g, 0, (h * i) / 3, w, (h * i) / 3);
    }
    if (opts.grid) {
      g.strokeStyle = "rgba(255,255,255,0.18)";
      var step = Math.min(w, h) / 12;
      for (var gx = step; gx < w; gx += step) line(g, gx, 0, gx, h);
      for (var gy = step; gy < h; gy += step) line(g, 0, gy, w, gy);
    }
    return canvas;
  }

  function line(g, x0, y0, x1, y1) { g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); }

  function label(g, text, x, y, u, color) {
    g.font = "700 " + Math.round(20 * u) + "px -apple-system, Segoe UI, sans-serif";
    var tw = g.measureText(text).width + 20 * u;
    g.fillStyle = color;
    rr(g, x - tw / 2, y - 15 * u, tw, 30 * u, 8 * u); g.fill();
    g.fillStyle = "#1a1016";
    g.textAlign = "center"; g.textBaseline = "middle";
    g.fillText(text, x, y + u);
  }

  // A plain mock-up of where the app puts its own buttons and text.
  function drawUi(g, p, w, h, u) {
    g.fillStyle = "rgba(255,255,255,0.85)";
    g.strokeStyle = "rgba(255,255,255,0.85)";
    g.lineWidth = 3 * u;
    var ui = p.ui;
    if (ui.side) {
      var cx = w - p.m[3] * w / 2, y = h * 0.52;
      for (var i = 0; i < 4; i++) { g.beginPath(); g.arc(cx, y + i * 120 * u, 34 * u, 0, Math.PI * 2); g.stroke(); }
    }
    if (ui.caption) {
      var bx = p.m[2] * w + 10 * u, by = h - p.m[1] * h + 40 * u;
      g.beginPath(); g.arc(bx + 30 * u, by + 30 * u, 30 * u, 0, Math.PI * 2); g.stroke();
      rr(g, bx + 76 * u, by + 14 * u, 220 * u, 26 * u, 13 * u); g.fill();
      rr(g, bx, by + 84 * u, Math.min(w * 0.6, 520 * u), 22 * u, 11 * u); g.fill();
      rr(g, bx, by + 120 * u, Math.min(w * 0.45, 380 * u), 22 * u, 11 * u); g.fill();
    }
    if (ui.top === "tabs") { rr(g, w / 2 - 170 * u, 60 * u, 140 * u, 24 * u, 12 * u); g.fill(); rr(g, w / 2 + 30 * u, 60 * u, 140 * u, 24 * u, 12 * u); g.fill(); }
    if (ui.top === "camera" || ui.top === "search") { g.beginPath(); g.arc(w - 80 * u, 80 * u, 26 * u, 0, Math.PI * 2); g.stroke(); }
    if (ui.progress) {
      for (var s = 0; s < 4; s++) { rr(g, 24 * u + s * (w - 48 * u) / 4, 24 * u, (w - 48 * u) / 4 - 8 * u, 6 * u, 3 * u); g.fill(); }
      g.beginPath(); g.arc(70 * u, 90 * u, 30 * u, 0, Math.PI * 2); g.stroke();
    }
    if (ui.reply) { g.lineWidth = 3 * u; rr(g, 40 * u, h - 140 * u, w - 220 * u, 80 * u, 40 * u); g.stroke(); }
    if (ui.player) {
      rr(g, 40 * u, h - 70 * u, w - 80 * u, 8 * u, 4 * u); g.fill();
      g.beginPath(); g.moveTo(60 * u, h - 140 * u); g.lineTo(60 * u, h - 100 * u); g.lineTo(92 * u, h - 120 * u); g.closePath(); g.fill();
    }
  }

  // The presets that fit a frame of w×h (closest ratio first), then the rest.
  function forFrame(w, h) {
    var r = w / h;
    var val = function (p) { if (p.ratio === "any") return 0.5; var a = p.ratio.split(":"); return Math.abs(Math.log((+a[0] / +a[1]) / r)); };
    return PRESETS.slice().sort(function (a, b) { return val(a) - val(b); });
  }

  var api = { PRESETS: PRESETS, draw: draw, forFrame: forFrame };
  if (typeof module === "object" && module.exports) module.exports = api;
  // in the panels Node is switched on, so `module` exists there too: the page still needs the global
  if (typeof window !== "undefined") window.HaloGuides = api; else if (typeof module !== "object") root.HaloGuides = api;
})(typeof self !== "undefined" ? self : this);
