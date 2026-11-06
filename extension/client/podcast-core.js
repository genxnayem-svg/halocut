/* HaloCut Podcast — who is talking, which camera to show, and where the music dips under the voices.
 * Levels are dB every 10 ms in sequence time. Plain maths; the panel reads the sound, Premiere does the edit.
 * © 2026 Imtayz Nayem */
(function (root) {
  var STEP = 0.01;

  // One level track across [from, to] from clips: [{ start, end, levels }] (levels from each clip's own start).
  function timeline(clips, from, to) {
    var n = Math.max(0, Math.ceil((to - from) / STEP)), out = new Float32Array(n);
    for (var i = 0; i < n; i++) out[i] = -120;
    clips.forEach(function (c) {
      var a = Math.max(0, Math.round((c.start - from) / STEP)), b = Math.min(n, Math.round((c.end - from) / STEP));
      for (var k = a; k < b; k++) { var v = c.levels[k - Math.round((c.start - from) / STEP)]; if (v !== undefined) out[k] = Math.max(out[k], v); }
    });
    return out;
  }

  function percentile(arr, q) {
    var s = Array.prototype.slice.call(arr).filter(function (v) { return v > -119; }).sort(function (a, b) { return a - b; });
    return s.length ? s[Math.min(s.length - 1, Math.floor(q * s.length))] : -120;
  }

  // Per 100 ms: who is talking. Each mic is judged against its own quiet level, so a hot mic doesn't win by default.
  // → [{ t, who: index | -1 (nobody) | -2 (two at once) }]
  function talkers(mics, opts) {
    opts = opts || {};
    var gate = opts.gate || 10, both = opts.both || 3, bin = 10, n = mics.length ? mics[0].length : 0, floors = mics.map(function (m) { return percentile(m, 0.15); });
    var out = [];
    for (var b = 0; b * bin < n; b++) {
      var best = -1, bestV = -1e9, second = -1e9;
      for (var m = 0; m < mics.length; m++) {
        var sum = 0, cnt = 0;
        for (var k = b * bin; k < Math.min(n, (b + 1) * bin); k++) { sum += Math.pow(10, mics[m][k] / 10); cnt++; }
        var db = 10 * Math.log10(sum / Math.max(1, cnt) + 1e-12), over = db - floors[m];
        if (over < gate) continue;
        if (db > bestV) { second = bestV; bestV = db; best = m; } else if (db > second) second = db;
      }
      out.push({ t: Math.round(b * bin * STEP * 1000) / 1000, who: best >= 0 && bestV - second < both ? -2 : best });
    }
    return out;
  }

  // Talk → shots. opts: { minShot (s), delay (s a new voice must last), wide (camera index or -1), wideAfter (s of silence) }
  // → [{ start, end, cam }] covering [0, length]
  function shots(talk, length, opts) {
    opts = opts || {};
    var minShot = opts.minShot || 2, delay = opts.delay || 0.4, wide = opts.wide === undefined ? -1 : opts.wide, wideAfter = opts.wideAfter || 4, binS = 0.1;
    var cur = -1, curStart = 0, out = [], cand = null, candStart = 0, quiet = 0;
    for (var i = 0; i < talk.length; i++) {
      var w = talk[i].who, want;
      if (w >= 0) { want = w; quiet = 0; }
      else if (w === -2) { want = wide >= 0 ? wide : cur; quiet = 0; }
      else { quiet += binS; want = wide >= 0 && quiet >= wideAfter ? wide : cur; }
      if (cur < 0) { if (want >= 0) { cur = want; curStart = 0; } continue; } // the first voice opens the edit
      if (want === cur || want < 0) { cand = null; continue; }
      if (cand !== want) { cand = want; candStart = talk[i].t; }
      // switch once the new voice has lasted `delay`, but never before the current shot is minShot long
      var sw = Math.max(candStart, curStart + minShot);
      if (talk[i].t + binS - candStart >= delay && talk[i].t + binS >= sw) {
        out.push({ start: curStart, end: sw, cam: cur });
        cur = cand; curStart = sw; cand = null;
      }
    }
    if (cur < 0) cur = wide >= 0 ? wide : 0;
    out.push({ start: curStart, end: length, cam: cur });
    // round to frames later in Premiere; keep tidy numbers here
    return out.map(function (s) { return { start: Math.round(s.start * 1000) / 1000, end: Math.round(s.end * 1000) / 1000, cam: s.cam }; });
  }

  // Where any voice talks: [{ start, end }], gaps shorter than `hold` joined, blips shorter than `min` dropped.
  function speech(voices, opts) {
    opts = opts || {};
    var gate = opts.gate || 10, hold = opts.hold === undefined ? 0.6 : opts.hold, min = opts.min || 0.25, n = voices.length ? voices[0].length : 0;
    var floors = voices.map(function (v) { return percentile(v, 0.15); }), out = [], start = -1;
    for (var k = 0; k <= n; k++) {
      var on = false;
      for (var v = 0; v < voices.length && k < n && !on; v++) on = voices[v][k] - floors[v] >= gate;
      if (on && start < 0) start = k;
      if (!on && start >= 0) { out.push({ start: start * STEP, end: k * STEP }); start = -1; }
    }
    var joined = [];
    out.forEach(function (r) { var l = joined[joined.length - 1]; if (l && r.start - l.end < hold) l.end = r.end; else joined.push(r); });
    return joined.filter(function (r) { return r.end - r.start >= min; })
      .map(function (r) { return { start: Math.round(r.start * 1000) / 1000, end: Math.round(r.end * 1000) / 1000 }; });
  }

  // Volume keys for the music in [from, to]: down `depth` dB before each voice, back up after it.
  // base: the music's own level in dB. → [{ t, db }] in sequence time, in order
  function duckKeys(regions, from, to, base, opts) {
    opts = opts || {};
    var depth = opts.depth === undefined ? 14 : opts.depth, att = opts.attack || 0.3, rel = opts.release || 0.8, low = base - depth;
    // dips closer than a fade down and up apart stay down between them
    var rs = [];
    regions.forEach(function (r) { var l = rs[rs.length - 1]; if (l && r.start - att - (l.end + rel) < 0.2) l.end = Math.max(l.end, r.end); else rs.push({ start: r.start, end: r.end }); });
    var env = [];
    rs.forEach(function (r) { env.push({ t: r.start - att, db: base }, { t: r.start, db: low }, { t: r.end, db: low }, { t: r.end + rel, db: base }); });
    function at(t) {
      for (var i = 1; i < env.length; i++) if (t <= env[i].t) return t <= env[i - 1].t ? env[i - 1].db : env[i - 1].db + (env[i].db - env[i - 1].db) * (t - env[i - 1].t) / (env[i].t - env[i - 1].t);
      return base;
    }
    var keys = [], touched = false;
    env.forEach(function (k) { if (k.t > from && k.t < to) { keys.push({ t: k.t, db: k.db }); touched = true; } });
    if (!touched && at((from + to) / 2) === base) return [];
    keys.unshift({ t: from, db: at(from) }); keys.push({ t: to, db: at(to) });
    return keys.map(function (k) { return { t: Math.round(k.t * 1000) / 1000, db: Math.round(k.db * 100) / 100 }; });
  }

  // Premiere's clip Level control: 1.0 is +15 dB.
  function dbToLevel(db) { return Math.pow(10, (db - 15) / 20); }
  function levelToDb(v) { return v > 0 ? 20 * Math.log10(v) + 15 : -120; }

  function share(cuts, cams) {
    var t = {}, total = 0;
    cuts.forEach(function (c) { t[c.cam] = (t[c.cam] || 0) + c.end - c.start; total += c.end - c.start; });
    return cams.map(function (c, i) { return total ? Math.round((t[i] || 0) / total * 100) : 0; });
  }

  var api = { STEP: STEP, timeline: timeline, percentile: percentile, talkers: talkers, shots: shots, speech: speech, duckKeys: duckKeys, dbToLevel: dbToLevel, levelToDb: levelToDb, share: share };
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.HaloPodcast = api;
})(typeof self !== "undefined" ? self : this);
