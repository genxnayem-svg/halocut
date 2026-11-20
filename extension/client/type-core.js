/* HaloCut Type (After Effects) — kinetic type styles built from AE's own text animators, so they stay editable.
 * A style names the look a letter (or word, or line) has while it is "selected"; the Range Selector then sweeps
 * across the text. Offsets are in em (times the font size), so they suit any size of text.
 * © 2026 Imtayz Nayem */
(function (root) {
  // based: 1 letters, 3 words, 4 lines · drive: start (a sweep), amount (all at once), wave (a loop), wiggle (a loop)
  var STYLES = [
    { id: "fade", name: "Fade in", group: "In", based: 1, look: { opacity: 0 }, drive: "start" },
    { id: "rise", name: "Rise", group: "In", based: 1, look: { opacity: 0, y: 0.6 }, drive: "start" },
    { id: "drop", name: "Drop", group: "In", based: 1, look: { opacity: 0, y: -0.6 }, drive: "start" },
    { id: "slide", name: "Slide in words", group: "In", based: 3, look: { opacity: 0, x: -1.2 }, drive: "start" },
    { id: "pop", name: "Pop", group: "In", based: 1, look: { opacity: 0, scale: 0 }, drive: "start" },
    { id: "spin", name: "Spin in", group: "In", based: 1, look: { opacity: 0, rotation: 90 }, drive: "start" },
    { id: "blur", name: "Blur in", group: "In", based: 1, look: { opacity: 0, blur: 0.5 }, drive: "start" },
    { id: "zoom", name: "Big to small", group: "In", based: 3, look: { opacity: 0, scale: 300 }, drive: "start" },
    { id: "track", name: "Tracking in", group: "In", based: 1, look: { opacity: 0, tracking: 1.2 }, drive: "amount" },
    { id: "type", name: "Typewriter", group: "In", based: 1, look: { opacity: 0 }, drive: "start", hard: true },
    { id: "random", name: "Letters at random", group: "In", based: 1, look: { opacity: 0 }, drive: "start", random: true },
    { id: "flicker", name: "Flicker on", group: "In", based: 1, look: { opacity: 0 }, drive: "start", random: true, hard: true },
    { id: "fadeOut", name: "Fade out", group: "Out", based: 1, look: { opacity: 0 }, drive: "start", out: true },
    { id: "sink", name: "Sink out", group: "Out", based: 1, look: { opacity: 0, y: 0.6 }, drive: "start", out: true },
    { id: "blurOut", name: "Blur out", group: "Out", based: 1, look: { opacity: 0, blur: 0.5 }, drive: "start", out: true },
    { id: "wave", name: "Wave", group: "Loop", based: 1, look: { y: -0.3 }, drive: "wave" },
    { id: "jitter", name: "Jitter", group: "Loop", based: 1, look: { x: 0.08, y: 0.08 }, drive: "wiggle" },
  ];
  var GROUPS = ["In", "Out", "Loop"];
  var BASED = [{ id: 1, name: "Letters" }, { id: 3, name: "Words" }, { id: 4, name: "Lines" }];
  var NAME = "HaloCut Type · ";

  function style(id) { for (var i = 0; i < STYLES.length; i++) if (STYLES[i].id === id) return STYLES[i]; return STYLES[0]; }

  // What the host builds: the animator's values in pixels and the keys of its selector.
  // o: { fontSize, inPoint, outPoint, duration, delay, based, ease }
  function job(id, o) {
    var s = style(id), fs = o.fontSize || 100, L = s.look, dur = Math.max(0.05, o.duration || 1), props = {};
    if (L.opacity !== undefined) props.opacity = L.opacity;
    if (L.x !== undefined || L.y !== undefined) props.position = [Math.round((L.x || 0) * fs * 100) / 100, Math.round((L.y || 0) * fs * 100) / 100];
    if (L.scale !== undefined) props.scale = [L.scale, L.scale];
    if (L.rotation !== undefined) props.rotation = L.rotation;
    if (L.blur !== undefined) props.blur = [Math.round(L.blur * fs), Math.round(L.blur * fs)];
    if (L.tracking !== undefined) props.tracking = Math.round(L.tracking * fs);
    var t0 = s.out ? o.outPoint - dur - (o.delay || 0) : o.inPoint + (o.delay || 0), keys = null;
    // a sweep: Start runs 0 → 100 % (in: letters leave the selected look; out: End runs 0 → 100 % so they gain it)
    if (s.drive === "start") keys = s.out ? { prop: "end", from: 0, to: 100 } : { prop: "start", from: 0, to: 100 };
    if (s.drive === "amount") keys = { prop: "amount", from: 100, to: 0 };
    return { name: NAME + s.name, style: s.id, based: o.based || s.based, props: props, smooth: s.hard ? 0 : 100, random: !!s.random,
      keys: keys ? { prop: keys.prop, times: [t0, t0 + dur], values: [keys.from, keys.to], ease: o.ease !== false } : null,
      wave: s.drive === "wave" ? { speed: Math.round(100 / dur), width: 25 } : null, wiggle: s.drive === "wiggle" };
  }

  // How "selected" (0..1) unit i of n is at time t (seconds from the start of the move), for the panel's preview.
  function amount(s, i, n, t, dur, rnd) {
    var p = Math.max(0, Math.min(1, t / dur));
    if (s.drive === "amount") return 1 - ease(p);
    if (s.drive === "wave") { var c = (((t / dur) * 100) % 125) - 25, at = (i + 0.5) / n * 100; return Math.max(0, 1 - Math.abs(at - (c + 12.5)) / 12.5); }
    if (s.drive === "wiggle") return 1;
    var pos = (rnd ? rnd[i] : i), edge = ease(p) * n - pos; // how far the sweep has passed this unit
    var a = s.hard ? (edge >= 1 ? 0 : 1) : 1 - Math.max(0, Math.min(1, edge));
    return s.out ? 1 - a : a;
  }
  function ease(p) { return p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2; }

  // Text → the units a style moves: letters (spaces kept as units, like AE), words, or lines.
  function units(text, based) {
    if (based === 4) return String(text).split(/\r\n|\r|\n/);
    if (based === 3) return String(text).split(/(\s+)/).filter(function (w) { return w.length; });
    return String(text).split("");
  }

  // Lines to layers: one layer per line, each moved down by its line's offset. leading in px.
  function lines(text, leading) {
    return String(text).split(/\r\n|\r|\n/).map(function (t, i) { return { text: t, dy: i * leading }; }).filter(function (l) { return l.text.replace(/\s/g, "").length; });
  }

  var api = { STYLES: STYLES, GROUPS: GROUPS, BASED: BASED, NAME: NAME, style: style, job: job, amount: amount, units: units, lines: lines };
  if (typeof module === "object" && module.exports) module.exports = api;
  // in the panels Node is switched on, so `module` exists there too: the page still needs the global
  if (typeof window !== "undefined") window.HaloType = api; else if (typeof module !== "object") root.HaloType = api;
})(typeof self !== "undefined" ? self : this);
