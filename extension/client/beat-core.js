/* HaloCut Beat — tempo and beat grid from loudness readings every 10 ms. Pure maths, no I/O.
 * Practical onset detection, not a neural beat tracker: strong on music with a clear pulse.
 * © 2026 Imtayz Nayem */
(function (root) {
  var HOP = 0.01; // seconds per reading

  // How sharply the sound gets louder at each reading (dB above the recent average, never negative).
  function onsets(levels) {
    var out = new Float32Array(levels.length), w = 4;
    for (var i = 0; i < levels.length; i++) {
      var sum = 0, n = 0;
      for (var k = Math.max(0, i - w); k < i; k++) { sum += Math.max(-80, levels[k]); n++; }
      var rise = Math.max(-80, levels[i]) - (n ? sum / n : -80);
      out[i] = rise > 0 ? rise : 0;
    }
    return out;
  }

  // Full sound plus the kick drum (low-passed), which carries most of the pulse.
  function strength(full, low) {
    var a = onsets(full), b = low ? onsets(low) : null, out = new Float32Array(a.length);
    for (var i = 0; i < a.length; i++) out[i] = a[i] + (b && i < b.length ? 1.5 * b[i] : 0);
    return out;
  }

  // Tempo from how the onset pattern repeats. A gentle preference for ~120 BPM breaks ties between 60/120/240.
  function tempo(o, minBpm, maxBpm) {
    minBpm = minBpm || 70; maxBpm = maxBpm || 180;
    var mean = 0, i;
    for (i = 0; i < o.length; i++) mean += o[i];
    mean /= Math.max(1, o.length);
    var x = new Float32Array(o.length);
    for (i = 0; i < o.length; i++) x[i] = o[i] - mean;
    var lo = Math.floor(60 / maxBpm / HOP), hi = Math.ceil(60 / minBpm / HOP), ac = {};
    var best = -Infinity, bestLag = lo;
    for (var lag = lo - 1; lag <= hi + 1; lag++) {
      var s = 0;
      for (i = 0; i + lag < x.length; i++) s += x[i] * x[i + lag];
      ac[lag] = s / Math.max(1, x.length - lag);
    }
    for (lag = lo; lag <= hi; lag++) {
      var bpm = 60 / (lag * HOP);
      var prior = Math.exp(-0.5 * Math.pow(Math.log(bpm / 120) / Math.LN2 / 0.9, 2));
      var v = ac[lag] * prior;
      if (v > best) { best = v; bestLag = lag; }
    }
    // a parabola through the peak gives a lag between whole readings
    var y0 = ac[bestLag - 1], y1 = ac[bestLag], y2 = ac[bestLag + 1], d = y0 - 2 * y1 + y2;
    var lagF = bestLag + (d !== 0 ? Math.max(-0.5, Math.min(0.5, 0.5 * (y0 - y2) / d)) : 0);
    var conf = y1 > 0 ? Math.min(1, y1 / (ac[lo] > 0 ? Math.max(ac[lo], y1) : y1)) : 0;
    return { bpm: 60 / (lagF * HOP), period: lagF, confidence: conf };
  }

  function at(o, f) { var i = Math.round(f); return i >= 0 && i < o.length ? o[i] : 0; }

  // Beat times (seconds) for a period in readings: the phase that lands on the most onsets,
  // then each beat nudged onto the strongest onset within 30 ms.
  function grid(o, period) {
    var bestPhase = 0, best = -1;
    for (var ph = 0; ph < period; ph++) {
      var s = 0;
      for (var f = ph; f < o.length; f += period) s += Math.max(at(o, f - 1), at(o, f), at(o, f + 1));
      if (s > best) { best = s; bestPhase = ph; }
    }
    var out = [];
    for (var g = bestPhase; g < o.length; g += period) {
      var peak = Math.round(g), pv = at(o, g);
      for (var k = -3; k <= 3; k++) if (at(o, g + k) > pv) { pv = at(o, g + k); peak = Math.round(g + k); }
      out.push(Math.round(peak * HOP * 1000) / 1000);
    }
    return out;
  }

  // Which beat in every four starts the bar: the one where the kick drum lands hardest.
  function barPhase(beats, low) {
    if (!low) return 0;
    var lo = onsets(low), sums = [0, 0, 0, 0];
    beats.forEach(function (t, k) { sums[k % 4] += at(lo, t / HOP); });
    return sums.indexOf(Math.max.apply(null, sums));
  }

  // The strongest onsets: well above the rest and at least 120 ms apart.
  function hits(o) {
    var mean = 0, sq = 0, i, n = o.length;
    for (i = 0; i < n; i++) { mean += o[i]; sq += o[i] * o[i]; }
    mean /= Math.max(1, n);
    var sd = Math.sqrt(Math.max(0, sq / Math.max(1, n) - mean * mean)), th = mean + 2.5 * sd, out = [], last = -1e9;
    for (i = 1; i < n - 1; i++) {
      if (o[i] >= th && o[i] >= o[i - 1] && o[i] >= o[i + 1] && i - last >= 12) { out.push(Math.round(i * HOP * 1000) / 1000); last = i; }
    }
    return out;
  }

  function analyse(full, low) {
    var o = strength(full, low), t = tempo(o), beats = grid(o, t.period);
    return { bpm: Math.round(t.bpm * 10) / 10, confidence: t.confidence, beats: beats, bar: barPhase(beats, low), hits: hits(o), length: full.length * HOP };
  }

  // A fresh grid at a set tempo, kept on the old grid's first beat (after tap tempo, ½× or 2×).
  function regrid(anchor, bpm, length) {
    var p = 60 / bpm, out = [];
    var t = anchor;
    while (t - p >= -1e-6) t -= p;
    for (; t <= length + 1e-6; t += p) out.push(Math.round(t * 1000) / 1000);
    return out;
  }

  // Tap tempo: the middle of the gaps between taps (in seconds).
  function tapBpm(taps) {
    if (taps.length < 3) return null;
    var gaps = [];
    for (var i = 1; i < taps.length; i++) gaps.push(taps[i] - taps[i - 1]);
    gaps.sort(function (a, b) { return a - b; });
    var mid = gaps[Math.floor(gaps.length / 2)];
    return mid > 0 ? Math.round(600 / mid) / 10 : null;
  }

  // Which beats to use: "beat", "2", "bar" (with the bar phase) or the hits.
  function pick(a, every) {
    if (every === "hits") return a.hits.slice();
    return a.beats.filter(function (t, k) {
      if (every === "2") return (k - a.bar) % 2 === 0;
      if (every === "bar") return ((k - a.bar) % 4 + 4) % 4 === 0;
      if (every === "4beats") return ((k - a.bar) % 4 + 4) % 4 === 0;
      if (every === "8beats") return ((k - a.bar) % 8 + 8) % 8 === 0;
      return true;
    });
  }

  var api = { HOP: HOP, onsets: onsets, strength: strength, tempo: tempo, grid: grid, barPhase: barPhase, hits: hits,
    analyse: analyse, regrid: regrid, tapBpm: tapBpm, pick: pick };
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.HaloBeat = api;
})(typeof self !== "undefined" ? self : this);
