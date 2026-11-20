/* HaloCut Motion — looks, easing and the move between a start look and an end look.
 * A look: { x, y } position in % of the frame (50, 50 = centred), scale %, rotation °, opacity %,
 * crop { l, t, r, b } in %. © 2026 Imtayz Nayem */
(function (root) {
  var NORMAL = { x: 50, y: 50, scale: 100, rotation: 0, opacity: 100, crop: { l: 0, t: 0, r: 0, b: 0 } };

  function look(over) {
    var o = JSON.parse(JSON.stringify(NORMAL));
    for (var k in over) if (k === "crop") for (var c in over.crop) o.crop[c] = over.crop[c]; else o[k] = over[k];
    return o;
  }

  // start → end; "in" looks end on the normal frame, "out-of-normal" looks start on it
  var LOOKS = [
    { id: "rise", name: "Rise in", start: look({ y: 58, opacity: 0 }), end: look({}), ease: "smooth" },
    { id: "pop", name: "Pop", start: look({ scale: 55, opacity: 0 }), end: look({}), ease: "overshoot" },
    { id: "slideL", name: "Slide from left", start: look({ x: -50 }), end: look({}), ease: "smooth" },
    { id: "slideR", name: "Slide from right", start: look({ x: 150 }), end: look({}), ease: "smooth" },
    { id: "drop", name: "Drop in", start: look({ y: -50 }), end: look({}), ease: "bounce" },
    { id: "spin", name: "Spin in", start: look({ rotation: -90, scale: 40, opacity: 0 }), end: look({}), ease: "overshoot" },
    { id: "fade", name: "Fade in", start: look({ opacity: 0 }), end: look({}), ease: "easeOut" },
    { id: "zoom", name: "Zoom reveal", start: look({ scale: 130, opacity: 0 }), end: look({}), ease: "smooth" },
    { id: "wipe", name: "Wipe open", start: look({ crop: { l: 50, r: 50 } }), end: look({}), ease: "smooth" },
    { id: "letterbox", name: "Letterbox", start: look({}), end: look({ crop: { t: 12, b: 12 } }), ease: "smooth" },
    { id: "pip", name: "Picture in picture", start: look({}), end: look({ x: 76, y: 74, scale: 36 }), ease: "spring" },
    { id: "kenburns", name: "Ken Burns", start: look({}), end: look({ x: 54, y: 48, scale: 116 }), ease: "linear", whole: true },
  ];

  // ---- easing: t in 0..1 -> progress (may go past 1 for overshoot and spring) ----
  var EASES = {
    linear: { name: "Linear", f: function (t) { return t; } },
    easeIn: { name: "Ease in", f: function (t) { return t * t * t; } },
    easeOut: { name: "Ease out", f: function (t) { return 1 - Math.pow(1 - t, 3); } },
    smooth: { name: "Smooth", f: function (t) { return t < 0.5 ? 16 * Math.pow(t, 5) : 1 - Math.pow(-2 * t + 2, 5) / 2; } },
    overshoot: { name: "Overshoot", f: function (t) { var c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); } },
    spring: { name: "Spring", f: function (t) { return t === 0 || t === 1 ? t : 1 - Math.cos(t * 4.5 * Math.PI) * Math.exp(-t * 6); } },
    bounce: { name: "Bounce", f: function (t) {
      var n = 7.5625, d = 2.75;
      if (t < 1 / d) return n * t * t;
      if (t < 2 / d) return n * (t -= 1.5 / d) * t + 0.75;
      if (t < 2.5 / d) return n * (t -= 2.25 / d) * t + 0.9375;
      return n * (t -= 2.625 / d) * t + 0.984375;
    } },
  };

  // Progress samples the host script reads back: easing and direction baked in.
  // direction: "forward" (start→end), "reverse" (end→start), "roundtrip" (start→end→start)
  function curve(ease, direction, samples) {
    var f = (EASES[ease] || EASES.smooth).f, n = samples || 120, out = [];
    for (var i = 0; i <= n; i++) {
      var t = i / n, p;
      if (direction === "reverse") p = 1 - f(t);
      else if (direction === "roundtrip") p = t < 0.5 ? f(t * 2) : f(2 - t * 2);
      else p = f(t);
      out.push(Math.round(p * 10000) / 10000);
    }
    return out;
  }

  function mix(a, b, p) { return a + (b - a) * p; }

  // The look part-way through the move (p = progress from the curve).
  function between(a, b, p) {
    return {
      x: mix(a.x, b.x, p), y: mix(a.y, b.y, p), scale: mix(a.scale, b.scale, p),
      rotation: mix(a.rotation, b.rotation, p), opacity: Math.max(0, Math.min(100, mix(a.opacity, b.opacity, p))),
      crop: { l: clamp(mix(a.crop.l, b.crop.l, p)), t: clamp(mix(a.crop.t, b.crop.t, p)), r: clamp(mix(a.crop.r, b.crop.r, p)), b: clamp(mix(a.crop.b, b.crop.b, p)) },
    };
  }
  function clamp(v) { return Math.max(0, Math.min(100, v)); }

  function sample(curveArr, t) {
    var n = curveArr.length - 1, x = Math.max(0, Math.min(1, t)) * n, i = Math.floor(x);
    return i >= n ? curveArr[n] : mix(curveArr[i], curveArr[i + 1], x - i);
  }

  // When the move happens inside a clip of length L: { mode: "start" | "end" | "whole", seconds }
  function window_(L, timing) {
    if (timing.mode === "whole") return [0, L];
    var a = Math.min(timing.seconds || 0.8, L);
    return timing.mode === "end" ? [L - a, L] : [0, a];
  }

  var api = { NORMAL: NORMAL, LOOKS: LOOKS, EASES: EASES, look: look, curve: curve, between: between, sample: sample, window: window_ };
  if (typeof module === "object" && module.exports) module.exports = api;
  // in the panels Node is switched on, so `module` exists there too: the page still needs the global
  if (typeof window !== "undefined") window.HaloMotion = api; else if (typeof module !== "object") root.HaloMotion = api;
})(typeof self !== "undefined" ? self : this);
