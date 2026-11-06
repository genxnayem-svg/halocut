/* HaloCut Retakes — finds filler sounds, filler words, stutters, false starts and mumbles in a transcript,
 * and turns the ones you keep ticked into cuts. Plain maths on words with times.
 * © 2026 Imtayz Nayem */
(function (root) {
  var SOUND = /^(u+h*m*|u+m+|e+r+m*|a+h+|a+m+|h+m+|m{2,}|e+h+|h+u+h+)$/;
  var FILLER_WORDS = ["you know", "i mean", "like", "basically", "actually", "literally", "sort of", "kind of", "matlab", "yaani", "na"];
  var KINDS = { sound: "Filler sound", word: "Filler word", stutter: "Stutter", retake: "False start", mumble: "Mumble" };

  function core(t) { return String(t).toLowerCase().replace(/[^\p{L}\p{N}']/gu, ""); }
  function isSound(t) { var c = core(t); return !!c && SOUND.test(c); }
  function ends(t) { return /[.?!।]$/.test(String(t)); }

  // opts: { sounds, words, wordList, stutters, retakes, maxRetake }
  function find(words, opts) {
    opts = opts || {};
    var c = words.map(function (w) { return core(w.text); }), items = [], used = {};
    function add(kind, from, to) {
      for (var k = from; k < to; k++) if (used[k]) return;
      for (var m = from; m < to; m++) used[m] = true;
      items.push({ kind: kind, from: from, to: to, start: words[from].start, end: words[to - 1].end,
        text: words.slice(from, to).map(function (w) { return w.text; }).join(" "), on: true });
    }

    // false starts first: the abandoned attempt is everything before the phrase starts over
    if (opts.retakes !== false) {
      var maxR = opts.maxRetake || 14;
      for (var i = 0; i < words.length; i++) {
        if (isSound(words[i].text)) continue;
        var best = null, bestK = 0;
        for (var j = i + 1; j <= Math.min(words.length - 2, i + maxR) && !best; j++) {
          if (c[j] !== c[i] || !c[i]) continue;
          var k = 0;
          while (j + k < words.length && i + k < j && c[i + k] === c[j + k]) k++;
          var gap = words[j].start - words[j - 1].end, len = j - i;
          var restart = k >= 3 || (k === 2 && len <= 4 && (gap >= 0.2 || /[-–—]$/.test(words[j - 1].text)));
          if (restart && words[j].start - words[i].start < 12 && !(k === len && len === 1)) { best = j; bestK = k; }
        }
        if (best !== null) {
          // a finished sentence that the next one doesn't repeat in full is two sentences, not a restart
          var whole = false;
          for (var q = i; q < best; q++) if (ends(words[q].text)) whole = true;
          if (!whole || bestK >= best - i) { add("retake", i, best); i = best - 1; }
        }
      }
    }
    for (var n = 0; n < words.length; n++) {
      if (used[n]) continue;
      if (opts.sounds !== false && isSound(words[n].text)) { add("sound", n, n + 1); continue; }
      // a stutter: the same word twice in a row, or a cut-off start ("b- but")
      if (opts.stutters !== false && n + 1 < words.length && c[n] && !/^\d+$/.test(c[n])) {
        var next = c[n + 1], close = words[n + 1].start - words[n].end < 0.8;
        var cut = /-$/.test(words[n].text) && next.indexOf(c[n]) === 0 && c[n].length < next.length;
        if (close && (c[n] === next || cut)) { add("stutter", n, n + 1); continue; }
      }
    }
    if (opts.words) {
      var list = (opts.wordList || FILLER_WORDS).map(function (p) { return p.split(" ").map(core); });
      for (var w = 0; w < words.length; w++) {
        for (var p = 0; p < list.length; p++) {
          var ph = list[p], ok = true;
          for (var x = 0; x < ph.length && ok; x++) ok = c[w + x] === ph[x] && !used[w + x];
          if (ok) { add("word", w, w + ph.length); w += ph.length - 1; break; }
        }
      }
    }
    items.sort(function (a, b) { return a.start - b.start; });
    return items;
  }

  // Sound between words with no words in it: a mumble the transcript left out.
  // tracks: [{ start (sequence s), levels (dB per 10 ms) }]
  function mumbles(words, tracks, opts) {
    opts = opts || {};
    var step = 0.01, all = [], minLen = opts.minLen || 0.25;
    function level(t) {
      for (var i = 0; i < tracks.length; i++) {
        var k = Math.floor((t - tracks[i].start) / step);
        if (k >= 0 && k < tracks[i].levels.length) return tracks[i].levels[k];
      }
      return -120;
    }
    words.forEach(function (w) { for (var t = w.start; t < w.end; t += step) all.push(level(t)); });
    if (!all.length) return [];
    all.sort(function (a, b) { return a - b; });
    var ref = all[Math.floor(all.length * 0.6)], th = ref - (opts.below || 12), out = [];
    for (var i = 0; i + 1 < words.length; i++) {
      var a = words[i].end + 0.06, b = words[i + 1].start - 0.06;
      if (b - a < minLen) continue;
      var first = -1, last = -1, loud = 0;
      for (var t = a; t < b; t += step) if (level(t) > th) { loud++; if (first < 0) first = t; last = t + step; }
      if (loud * step >= minLen) out.push({ kind: "mumble", from: i + 1, to: i + 1, start: round(first - 0.03), end: round(last + 0.03), text: "(sound, no words)", on: true });
    }
    return out;
  }

  function round(x) { return Math.round(x * 1000) / 1000; }

  // Ticked items → cuts in sequence time: from the item to just before the next word, never into a kept word.
  function regions(words, items, pad) {
    pad = pad === undefined ? 0.04 : pad;
    var out = [];
    items.filter(function (it) { return it.on; }).forEach(function (it) {
      var prev = words[it.from - 1], next = words[it.kind === "mumble" ? it.from : it.to];
      var s = it.kind === "mumble" ? it.start : words[it.from].start - pad, e = it.kind === "mumble" ? it.end : next ? next.start - pad : words[it.to - 1].end + pad;
      if (prev) s = Math.max(s, prev.end + 0.01);
      if (next) e = Math.min(e, next.start - 0.01);
      if (e - s > 0.03) out.push({ start: round(s), end: round(e) });
    });
    out.sort(function (a, b) { return a.start - b.start; });
    var merged = [];
    out.forEach(function (r) { var l = merged[merged.length - 1]; if (l && r.start <= l.end + 0.02) l.end = Math.max(l.end, r.end); else merged.push(r); });
    return merged;
  }

  function total(rs) { var s = 0; rs.forEach(function (r) { s += r.end - r.start; }); return round(s); }

  var api = { KINDS: KINDS, FILLER_WORDS: FILLER_WORDS, core: core, isSound: isSound, find: find, mumbles: mumbles, regions: regions, total: total };
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.HaloRetakes = api;
})(typeof self !== "undefined" ? self : this);
