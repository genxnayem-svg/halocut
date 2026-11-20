/* HaloCut Studio — silence engine (Node, runs inside the CEP panel and in plain Node for tests).
 * Reads a clip's sound with FFmpeg, measures its level every 10 ms, and finds the pauses.
 * © 2026 Imtayz Nayem */
(function (root, factory) {
  // in the panels Node is switched on, so `module` exists there too: the page still needs the global
  if (typeof window !== "undefined") root.HaloSilence = factory(window.cep_node ? window.cep_node.require : window.require);
  else module.exports = factory(require);
})(typeof self !== "undefined" ? self : this, function (req) {
  var cp = req("child_process");
  var fs = req("fs");
  var path = req("path");
  var os = req("os");

  var RATE = 8000;          // samples per second we ask FFmpeg for (plenty for loudness)
  var WINDOW = 0.01;        // seconds per level reading

  // Where FFmpeg usually lives. A path set in Studio's settings is tried first.
  function findFfmpeg(preferred) {
    var home = os.homedir();
    var list = [preferred,
      "/opt/homebrew/bin/ffmpeg", "/usr/local/bin/ffmpeg", "/usr/bin/ffmpeg",
      path.join(home, ".local/node/bin/ffmpeg"), path.join(home, ".local/bin/ffmpeg"),
      "C:\\ffmpeg\\bin\\ffmpeg.exe"];
    (process.env.PATH || "").split(path.delimiter).forEach(function (d) {
      list.push(path.join(d, process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg"));
    });
    for (var i = 0; i < list.length; i++) {
      try { if (list[i] && fs.statSync(list[i]).isFile()) return list[i]; } catch (e) {}
    }
    return null;
  }

  // Level in dB for every 10 ms of `file` between inSec and outSec (source time).
  // filter: an optional FFmpeg audio filter, e.g. "lowpass=f=150" to hear only the kick drum.
  function readLevels(ffmpeg, file, inSec, outSec, done, filter) {
    var args = ["-v", "error", "-ss", String(inSec), "-t", String(Math.max(0.01, outSec - inSec)),
      "-i", file, "-vn", "-ac", "1", "-ar", String(RATE)];
    if (filter) args.push("-af", filter);
    args.push("-f", "f32le", "-");
    var proc = cp.spawn(ffmpeg, args);
    var chunks = [], err = "";
    proc.stdout.on("data", function (c) { chunks.push(c); });
    proc.stderr.on("data", function (c) { err += c; });
    proc.on("error", function (e) { done(e); });
    proc.on("close", function (code) {
      if (code !== 0) return done(new Error(err.trim() || "FFmpeg could not read " + path.basename(file)));
      var buf = Buffer.concat(chunks);
      var n = Math.floor(buf.length / 4);
      var per = Math.round(RATE * WINDOW);
      var levels = new Float32Array(Math.ceil(n / per));
      for (var w = 0; w < levels.length; w++) {
        var sum = 0, count = 0;
        for (var i = w * per; i < Math.min(n, (w + 1) * per); i++) {
          var v = buf.readFloatLE(i * 4);
          sum += v * v; count++;
        }
        var rms = Math.sqrt(sum / Math.max(1, count));
        levels[w] = rms > 0 ? 20 * Math.log10(rms) : -120;
      }
      done(null, levels);
    });
  }

  // Pauses in clip-relative seconds.
  //   thresholdDb: quieter than this is silence
  //   minPause:    shortest pause that counts (s)
  //   keep:        room left around speech on each side (s)
  function detectPauses(levels, opts) {
    var th = opts.thresholdDb, min = opts.minPause, keep = opts.keep;
    var out = [], start = -1;
    for (var i = 0; i <= levels.length; i++) {
      var quiet = i < levels.length && levels[i] < th;
      if (quiet && start < 0) start = i;
      if (!quiet && start >= 0) {
        var s = start * WINDOW, e = i * WINDOW;
        var isHead = start === 0, isTail = i === levels.length;
        // keep room next to speech, but not at the very start or end of the clip
        var a = isHead ? s : s + keep, b = isTail ? e : e - keep;
        if (e - s >= min && b - a > 0.02) out.push({ start: round(a), end: round(b), on: true });
        start = -1;
      }
    }
    return out;
  }

  function round(x) { return Math.round(x * 1000) / 1000; }

  // Clip pauses -> sequence time, merged across clips that overlap in time.
  function toTimeline(clipPauses) {
    var all = [];
    clipPauses.forEach(function (cp) {
      cp.pauses.forEach(function (p) {
        all.push({ start: round(cp.timelineStart + p.start), end: round(cp.timelineStart + p.end), on: true });
      });
    });
    all.sort(function (x, y) { return x.start - y.start; });
    var merged = [];
    all.forEach(function (p) {
      var last = merged[merged.length - 1];
      if (last && p.start <= last.end) last.end = Math.max(last.end, p.end);
      else merged.push(p);
    });
    return merged;
  }

  // A small picture of the levels for drawing: one value 0..1 per bucket.
  function summary(levels, buckets) {
    var out = new Array(buckets), per = levels.length / buckets;
    for (var b = 0; b < buckets; b++) {
      var peak = -120;
      for (var i = Math.floor(b * per); i < Math.floor((b + 1) * per); i++) if (levels[i] > peak) peak = levels[i];
      out[b] = Math.max(0, Math.min(1, (peak + 60) / 60));
    }
    return out;
  }

  return { WINDOW: WINDOW, findFfmpeg: findFfmpeg, readLevels: readLevels, detectPauses: detectPauses, toTimeline: toTimeline, summary: summary };
});
