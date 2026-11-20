/* HaloCut Transitions — transitions on a cut, as values for Premiere's own effects on both sides of it.
 * The outgoing clip (A) builds up to the cut, the incoming clip (B) settles out of it.
 * Values (all neutral at intensity 0):
 *   scale, scaleW, scaleH (%; scaleW/H mean non-uniform), x, y (frame units, 0.5 = centre), rot (°),
 *   opacity (%), shutter (motion blur, 0–360°), blur (Gaussian), dir + len (Directional Blur), bright (Brightness)
 * © 2026 Imtayz Nayem */
(function (root) {
  var DIRS = { left: [-1, 0, 270], right: [1, 0, 90], up: [0, -1, 0], down: [0, 1, 180] };

  // a repeatable wobble, so a preview and Premiere get the same shake
  function noise(i, seed) { var x = Math.sin(i * 12.9898 + seed * 78.233) * 43758.5453; return (x - Math.floor(x)) * 2 - 1; }

  // Each: (p = intensity 0..1, with 1 at the cut; side "A" | "B"; o = { strength 0..2, dir, frame }) -> values
  var TRANSITIONS = [
    { id: "zoomIn", name: "Zoom in", fx: ["transform", "blur"], at: function (p, s, o) { return { scale: 100 + 70 * p * o.strength, shutter: 270 * p, blur: 18 * p * o.strength }; } },
    { id: "zoomOut", name: "Zoom out", fx: ["transform", "blur"], at: function (p, s, o) {
      return { scale: s === "A" ? 100 - 35 * p * o.strength : 100 + 45 * p * o.strength, shutter: 270 * p, blur: 14 * p * o.strength }; } },
    { id: "whip", name: "Whip", dirs: true, fx: ["transform", "directional"], at: function (p, s, o) {
      var d = DIRS[o.dir] || DIRS.left, k = (s === "A" ? 1 : -1) * 0.35 * p * o.strength;
      return { x: 0.5 + d[0] * k, y: 0.5 + d[1] * k, dir: d[2], len: 240 * p * o.strength, shutter: 360 * p }; } },
    { id: "spin", name: "Spin", fx: ["transform", "blur"], at: function (p, s, o) {
      return { rot: (s === "A" ? 1 : -1) * 120 * p * p * o.strength, scale: 100 + 25 * p, shutter: 300 * p, blur: 8 * p }; } },
    { id: "slide", name: "Slide push", dirs: true, fx: ["transform"], at: function (p, s, o) {
      var d = DIRS[o.dir] || DIRS.left, k = (s === "A" ? 1 : -1) * Math.min(1, 1.0 * p * o.strength);
      return { x: 0.5 + d[0] * k, y: 0.5 + d[1] * k, shutter: 220 * p }; } },
    { id: "blurThrough", name: "Blur through", fx: ["blur"], at: function (p, s, o) { return { blur: 80 * p * o.strength }; } },
    { id: "flash", name: "Light flash", fx: ["bright", "blur"], at: function (p, s, o) { return { bright: 100 * Math.pow(p, 1.5) * Math.min(1, o.strength), blur: 10 * p }; } },
    { id: "shake", name: "Shake hit", fx: ["transform"], at: function (p, s, o) {
      var f = o.frame || 0, a = p * o.strength;
      return { x: 0.5 + 0.025 * a * noise(f, 1), y: 0.5 + 0.025 * a * noise(f, 2), rot: 3 * a * noise(f, 3), scale: 100 + 8 * a, shutter: 180 * p }; } },
    { id: "stretch", name: "Stretch", fx: ["transform", "blur"], at: function (p, s, o) {
      return { scaleW: 100 + 90 * p * o.strength, scaleH: 100 - 15 * p * o.strength, shutter: 240 * p, blur: 6 * p }; } },
    { id: "glitch", name: "Glitch jump", fx: ["transform"], at: function (p, s, o) {
      var f = Math.floor((o.frame || 0) / 2), on = p > 0.25 && noise(f, 7) > -0.2;
      return on ? { x: 0.5 + 0.06 * p * o.strength * noise(f, 4), scaleW: 100 + 12 * p * noise(f, 5) * o.strength, opacity: 100 - 25 * p * Math.max(0, noise(f, 6)) }
        : { x: 0.5 }; } },
    { id: "fadeBlack", name: "Fade through black", fx: ["transform"], at: function (p) { return { opacity: 100 * (1 - p) }; } },
  ];

  var NEUTRAL = { scale: 100, scaleW: 100, scaleH: 100, x: 0.5, y: 0.5, rot: 0, opacity: 100, shutter: 0, blur: 0, dir: 0, len: 0, bright: 0 };

  function get(id) { for (var i = 0; i < TRANSITIONS.length; i++) if (TRANSITIONS[i].id === id) return TRANSITIONS[i]; return TRANSITIONS[0]; }

  function full(v) { var o = {}; for (var k in NEUTRAL) o[k] = v[k] !== undefined ? v[k] : NEUTRAL[k]; if (v.scaleW !== undefined || v.scaleH !== undefined) o.nonUniform = true; return o; }

  // How strong the transition is at frame k of n on each side: A speeds up into the cut, B eases out of it.
  function intensity(side, k, n) {
    var t = n ? k / n : 1;
    return side === "A" ? t * t * t : Math.pow(1 - t, 3);
  }

  // Values for every frame on both sides. frames: per side. Sent to the host script as plain numbers.
  function plan(id, opts) {
    var tr = get(id), n = Math.max(2, opts.frames || 12), out = { id: tr.id, fx: tr.fx, A: [], B: [], nonUniform: false };
    ["A", "B"].forEach(function (side) {
      for (var k = 0; k <= n; k++) {
        var v = full(tr.at(intensity(side, k, n), side, { strength: opts.strength === undefined ? 1 : opts.strength, dir: opts.dir, frame: k + (side === "B" ? n : 0) }));
        if (v.nonUniform) out.nonUniform = true;
        out[side].push(v);
      }
    });
    return out;
  }

  var api = { TRANSITIONS: TRANSITIONS, NEUTRAL: NEUTRAL, DIRS: DIRS, get: get, plan: plan, intensity: intensity, full: full };
  if (typeof module === "object" && module.exports) module.exports = api;
  // in the panels Node is switched on, so `module` exists there too: the page still needs the global
  if (typeof window !== "undefined") window.HaloTrans = api; else if (typeof module !== "object") root.HaloTrans = api;
})(typeof self !== "undefined" ? self : this);
