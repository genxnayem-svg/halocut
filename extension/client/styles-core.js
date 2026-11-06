/* HaloCut Caption Styles — looks, how words group into captions, the timed states that become pictures,
 * and where each word sits. Drawing happens in the panel; everything here is plain maths.
 * © 2026 Imtayz Nayem */
(function (root) {
  var SANS = "Inter, 'Helvetica Neue', Arial, sans-serif", SERIF = "Georgia, 'Times New Roman', serif", MONO = "'SF Mono', Menlo, Consolas, monospace";
  var DARK = { color: "rgba(0,0,0,.55)", blur: 0.18, y: 0.06 };
  // mode: line (whole caption), highlight (the spoken word stands out), karaoke (spoken words fill in),
  //       reveal (words appear as they're said), chunk (one to three big words at a time)
  var LOOKS = [
    { id: "clean", family: "Clean", name: "Clean", mode: "line", weight: 700, size: 0.05, fill: "#ffffff", shadow: DARK, motion: "fade" },
    { id: "subtle", family: "Clean", name: "Subtle", mode: "line", weight: 600, size: 0.042, y: 0.87, fill: "#f4f2f7", shadow: DARK, motion: "none" },
    { id: "serif", family: "Clean", name: "Serif", mode: "line", font: SERIF, weight: 700, italic: true, size: 0.052, fill: "#ffffff", shadow: DARK, motion: "fade" },
    { id: "yellow", family: "Highlight", name: "Yellow word", mode: "highlight", weight: 800, upper: true, size: 0.055, fill: "#ffffff", stroke: { color: "#000", width: 0.09 }, active: { fill: "#ffd43b", scale: 1.08 }, motion: "pop" },
    { id: "green", family: "Highlight", name: "Green word", mode: "highlight", weight: 800, upper: true, size: 0.055, fill: "#ffffff", stroke: { color: "#000", width: 0.09 }, active: { fill: "#4be36b", scale: 1.08 }, motion: "pop" },
    { id: "pink", family: "Highlight", name: "Pink word", mode: "highlight", weight: 800, upper: true, size: 0.055, fill: "#ffffff", stroke: { color: "#000", width: 0.09 }, active: { fill: "#ff5ca8", scale: 1.08 }, motion: "pop" },
    { id: "box-orange", family: "Box", name: "Orange box", mode: "highlight", weight: 800, size: 0.055, fill: "#ffffff", shadow: DARK, active: { bg: "#ff7a1a" }, motion: "pop" },
    { id: "box-blue", family: "Box", name: "Blue box", mode: "highlight", weight: 800, size: 0.055, fill: "#ffffff", shadow: DARK, active: { bg: "#2f6bff" }, motion: "pop" },
    { id: "box-purple", family: "Box", name: "Purple box", mode: "highlight", weight: 800, size: 0.055, fill: "#ffffff", shadow: DARK, active: { bg: "#8b5cf6" }, motion: "pop" },
    { id: "kara-gold", family: "Karaoke", name: "Gold fill", mode: "karaoke", weight: 800, size: 0.055, fill: "#ffd43b", dim: "#ffffff", stroke: { color: "#000", width: 0.08 }, motion: "fade" },
    { id: "kara-cyan", family: "Karaoke", name: "Cyan fill", mode: "karaoke", weight: 800, size: 0.055, fill: "#39d5ff", dim: "rgba(255,255,255,.6)", shadow: DARK, motion: "fade" },
    { id: "stack", family: "Bold", name: "Two at a time", mode: "chunk", words: 2, weight: 900, upper: true, size: 0.085, y: 0.62, fill: "#ffffff", stroke: { color: "#000", width: 0.1 }, motion: "pop" },
    { id: "one", family: "Bold", name: "One word", mode: "chunk", words: 1, weight: 900, upper: true, size: 0.1, y: 0.6, fill: "#ffe14d", stroke: { color: "#000", width: 0.1 }, motion: "pop" },
    { id: "three", family: "Bold", name: "Three, red word", mode: "chunk", words: 3, weight: 900, upper: true, size: 0.075, y: 0.62, fill: "#ffffff", stroke: { color: "#000", width: 0.1 }, active: { fill: "#ff4d4d" }, motion: "pop" },
    { id: "outline", family: "Outline", name: "Black outline", mode: "line", weight: 800, size: 0.052, fill: "#ffffff", stroke: { color: "#000", width: 0.14 }, motion: "none" },
    { id: "neon", family: "Outline", name: "Neon glow", mode: "line", weight: 700, size: 0.052, fill: "#ffffff", shadow: { color: "rgba(54,194,255,.95)", blur: 0.45, y: 0 }, motion: "fade" },
    { id: "bubble-dark", family: "Bubble", name: "Dark bubble", mode: "line", weight: 700, size: 0.046, fill: "#ffffff", bg: { color: "rgba(14,11,18,.84)", pad: 0.42, radius: 0.36 }, motion: "rise" },
    { id: "bubble-light", family: "Bubble", name: "Light bubble", mode: "line", weight: 700, size: 0.046, fill: "#16121a", bg: { color: "#ffffff", pad: 0.42, radius: 0.36 }, motion: "rise" },
    { id: "bubble-brand", family: "Bubble", name: "Pink bubble", mode: "line", weight: 800, size: 0.046, fill: "#ffffff", bg: { color: "#e8457c", pad: 0.42, radius: 0.36 }, motion: "rise" },
    { id: "type", family: "Reveal", name: "Word by word", mode: "reveal", weight: 700, size: 0.05, fill: "#ffffff", shadow: DARK, motion: "none" },
    { id: "type-pop", family: "Reveal", name: "Word pop", mode: "reveal", weight: 800, upper: true, size: 0.055, fill: "#ffffff", stroke: { color: "#000", width: 0.09 }, active: { fill: "#ffd43b", scale: 1.15 }, motion: "none" },
    { id: "type-box", family: "Reveal", name: "Bubble reveal", mode: "reveal", weight: 700, size: 0.046, fill: "#ffffff", bg: { color: "rgba(14,11,18,.84)", pad: 0.42, radius: 0.36 }, motion: "none" },
    { id: "lower", family: "Minimal", name: "lowercase", mode: "line", weight: 500, lower: true, size: 0.042, fill: "#ffffff", shadow: { color: "rgba(0,0,0,.4)", blur: 0.12, y: 0.04 }, motion: "fade" },
    { id: "mono", family: "Minimal", name: "Mono tag", mode: "line", font: MONO, weight: 600, size: 0.038, fill: "#ffffff", bg: { color: "rgba(0,0,0,.62)", pad: 0.3, radius: 0.12 }, motion: "none" },
  ];
  var FAMILIES = [];
  LOOKS.forEach(function (l) { if (FAMILIES.indexOf(l.family) < 0) FAMILIES.push(l.family); });

  function look(id) { for (var i = 0; i < LOOKS.length; i++) if (LOOKS[i].id === id) return LOOKS[i]; return LOOKS[0]; }

  // The look with your changes on top: { size, y, font, fill, accent, upper, lower, motion, maxChars, words }
  function styled(id, own) {
    var base = look(id), o = {}, k;
    for (k in base) o[k] = base[k];
    own = own || {};
    for (k in own) if (own[k] !== undefined && own[k] !== null && own[k] !== "") o[k] = own[k];
    if (own.accent) {
      o.active = {}; for (k in base.active || {}) o.active[k] = base.active[k];
      if (base.mode === "karaoke") o.fill = own.accent;
      else if (o.active.bg) o.active.bg = own.accent; else o.active.fill = own.accent;
    }
    if (o.y === undefined) o.y = 0.8;
    o.font = o.font || SANS;
    return o;
  }

  function cased(text, L) { return L.upper ? text.toUpperCase() : L.lower ? text.toLowerCase() : text; }

  // Words → captions. Chunk looks: a few words at a time. Others: up to maxChars, a new caption after a stop or a pause.
  function group(words, L) {
    var lines = [], cur = null, maxChars = L.maxChars || 32, max = L.mode === "chunk" ? (L.words || 2) : 0;
    for (var i = 0; i < words.length; i++) {
      var w = words[i], prev = words[i - 1];
      var brk = !cur || (prev && w.start - prev.end > (max ? 0.35 : 0.6)) || (prev && /[.?!।]$/.test(prev.text))
        || (max ? cur.words.length >= max : (cur.text + " " + w.text).length > maxChars || w.end - cur.start > 3.5);
      if (brk) { cur = { start: w.start, end: w.end, text: w.text, words: [w] }; lines.push(cur); }
      else { cur.text += " " + w.text; cur.end = w.end; cur.words.push(w); }
    }
    return lines;
  }

  // The timeline of pictures: one per caption for line looks, one per spoken word otherwise.
  // Frame-snapped, in order, never overlapping. Each: { line, active, start, end, first }
  function states(lines, L, fps) {
    var out = [], snap = function (t) { return Math.round(t * fps) / fps; }, perWord = L.mode !== "line";
    for (var i = 0; i < lines.length; i++) {
      var ln = lines[i], next = lines[i + 1], end = ln.end + 0.4;
      if (next && next.start < end + 0.25) end = next.start; // close gaps: no flicker between captions
      if (!perWord) { push(i, -1, ln.start, end, true); continue; }
      for (var k = 0; k < ln.words.length; k++) push(i, k, k ? ln.words[k].start : ln.start, k < ln.words.length - 1 ? ln.words[k + 1].start : end, k === 0);
    }
    function push(line, active, s, e, first) {
      s = snap(s); e = snap(e);
      var last = out[out.length - 1];
      if (last && s < last.end) s = last.end;
      if (e - s < 1 / fps - 1e-9) { if (last && last.line === line && !first) { last.end = Math.max(last.end, e); } return; }
      out.push({ line: line, active: active, start: Math.round(s * 1e6) / 1e6, end: Math.round(e * 1e6) / 1e6, first: first });
    }
    return out;
  }

  function fontOf(L, px) { return (L.italic ? "italic " : "") + (L.weight || 700) + " " + Math.round(px) + "px " + (L.font || SANS); }

  // Where every word goes, in frame pixels: rows centred, at most `maxRows` (2), the block centred on y.
  // measure(text, font) → width in px.
  function layout(texts, L, frame, measure) {
    var size = L.size * frame.h, font = fontOf(L, size), maxW = frame.w * 0.84;
    // a little more than a space: heavy, outlined and boxed words need the room
    var space = measure(" ", font) + size * (0.08 + (L.stroke ? L.stroke.width : 0) + (L.active && L.active.bg ? 0.2 : 0));
    var words = texts.map(function (t) { var c = cased(t, L); return { text: c, w: measure(c, font) }; });
    var rows = [[]], widths = [0];
    for (var i = 0; i < words.length; i++) {
      var r = rows.length - 1, add = (rows[r].length ? space : 0) + words[i].w;
      if (rows[r].length && widths[r] + add > maxW && rows.length < (L.maxRows || 2)) { rows.push([]); widths.push(0); r++; add = words[i].w; }
      rows[r].push(i); widths[r] += add;
    }
    var lh = size * 1.2, top = L.y * frame.h - rows.length * lh / 2, box = null;
    rows.forEach(function (row, ri) {
      var x = (frame.w - widths[ri]) / 2, cy = top + lh * (ri + 0.5);
      row.forEach(function (wi, j) {
        if (j) x += space;
        words[wi].x = x; words[wi].y = cy; words[wi].row = ri; x += words[wi].w;
      });
      var rb = { x: (frame.w - widths[ri]) / 2, y: cy - lh / 2, w: widths[ri], h: lh };
      box = box ? { x: Math.min(box.x, rb.x), y: box.y, w: Math.max(box.x + box.w, rb.x + rb.w) - Math.min(box.x, rb.x), h: rb.y + rb.h - box.y } : rb;
    });
    return { size: size, font: font, words: words, rows: rows.length, lineHeight: lh, box: box || { x: frame.w / 2, y: L.y * frame.h, w: 0, h: 0 } };
  }

  // How each word looks in a state: hidden, its colour, its scale, and whether it sits in the word box.
  function wordLook(L, state, j) {
    var a = state.active, act = L.active || {};
    if (L.mode === "reveal" && j > a) return null;
    if (L.mode === "karaoke") return { fill: j <= a ? L.fill : L.dim, scale: 1, box: null };
    var on = j === a && L.mode !== "line";
    return { fill: on && act.fill ? act.fill : L.fill, scale: on && act.scale ? act.scale : 1, box: on && act.bg ? act.bg : null };
  }

  // .srt → words, spread over each caption by length (no word timings in an .srt).
  function fromSrt(text) {
    var words = [], blocks = String(text).replace(/\r/g, "").split(/\n\s*\n/);
    function sec(t) { var m = /(\d+):(\d+):(\d+)[,.](\d+)/.exec(t); return m ? +m[1] * 3600 + +m[2] * 60 + +m[3] + +m[4] / 1000 : null; }
    blocks.forEach(function (b) {
      var ls = b.split("\n").filter(function (l) { return l.trim(); }), ti = -1;
      for (var i = 0; i < ls.length; i++) if (ls[i].indexOf("-->") > 0) { ti = i; break; }
      if (ti < 0) return;
      var parts = ls[ti].split("-->"), s = sec(parts[0]), e = sec(parts[1]);
      var ws = ls.slice(ti + 1).join(" ").replace(/<[^>]+>/g, "").split(/\s+/).filter(Boolean);
      if (s === null || e === null || !ws.length) return;
      var total = 0; ws.forEach(function (w) { total += w.length + 1; });
      var t = s;
      ws.forEach(function (w) { var d = (e - s) * (w.length + 1) / total; words.push({ text: w, start: t, end: t + d }); t += d; });
    });
    return words;
  }

  // An edited caption: same timing, its new words spread over it when the count changed.
  function retext(line, text) {
    var ws = String(text).split(/\s+/).filter(Boolean);
    if (!ws.length) return null;
    if (ws.length === line.words.length) return ws.map(function (w, i) { return { text: w, start: line.words[i].start, end: line.words[i].end }; });
    var total = 0; ws.forEach(function (w) { total += w.length + 1; });
    var t = line.start;
    return ws.map(function (w) { var d = (line.end - line.start) * (w.length + 1) / total, o = { text: w, start: t, end: t + d }; t += d; return o; });
  }

  var api = { LOOKS: LOOKS, FAMILIES: FAMILIES, look: look, styled: styled, cased: cased, group: group, states: states,
    fontOf: fontOf, layout: layout, wordLook: wordLook, fromSrt: fromSrt, retext: retext };
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.HaloStyles = api;
})(typeof self !== "undefined" ? self : this);
