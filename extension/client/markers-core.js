/* HaloCut Markers — YouTube chapters, exports and import parsing for sequence markers.
 * A marker here: { guid, start, end, name, comments, color } with times in seconds.
 * © 2026 Imtayz Nayem */
(function (root) {
  var COLORS = [["Green", "#3fc46b"], ["Red", "#e4473c"], ["Purple", "#a35bd6"], ["Orange", "#f08b2a"],
    ["Yellow", "#e9d33c"], ["White", "#f0f0f0"], ["Blue", "#3e8ef0"], ["Cyan", "#3ed6e0"]];

  function pad(n, l) { n = String(n); while (n.length < (l || 2)) n = "0" + n; return n; }

  // 75.5 -> "1:15" (YouTube style), or "1:01:15" past an hour
  function clock(sec) {
    sec = Math.max(0, Math.floor(sec + 1e-6));
    var h = Math.floor(sec / 3600), m = Math.floor(sec / 60) % 60, s = sec % 60;
    return h ? h + ":" + pad(m) + ":" + pad(s) : m + ":" + pad(s);
  }

  // 75.5 at 25 fps -> "00:01:15:12"
  function timecode(sec, fps) {
    fps = Math.round(fps || 25);
    var f = Math.round(sec * fps), ff = f % fps, s = Math.floor(f / fps);
    return pad(Math.floor(s / 3600)) + ":" + pad(Math.floor(s / 60) % 60) + ":" + pad(s % 60) + ":" + pad(ff);
  }

  function sorted(markers) { return markers.slice().sort(function (a, b) { return a.start - b.start; }); }

  // YouTube needs: the first chapter at 0:00, at least three, each at least 10 seconds long.
  function youtubeChapters(markers, opts) {
    opts = opts || {};
    var list = sorted(markers).filter(function (m) { return opts.colors ? opts.colors.indexOf(m.color) >= 0 : true; });
    var problems = [];
    if (list.length && list[0].start >= 1) list.unshift({ start: 0, name: opts.introName || "Intro", added: true });
    if (!list.length) return { text: "", problems: ["No markers to turn into chapters"], count: 0 };
    var lines = list.map(function (m, i) { return clock(m.start) + " " + (m.name || "Chapter " + (i + 1)); });
    if (list.length < 3) problems.push("YouTube needs at least 3 chapters (" + list.length + " now)");
    for (var i = 0; i < list.length; i++) {
      var next = i + 1 < list.length ? list[i + 1].start : opts.end;
      if (next !== undefined && next - list[i].start < 10) problems.push("“" + (list[i].name || "Chapter " + (i + 1)) + "” is shorter than 10 s");
    }
    return { text: lines.join("\n"), problems: problems, count: list.length, addedIntro: !!list[0].added };
  }

  function csvCell(s) { s = String(s == null ? "" : s); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }

  function toCsv(markers, fps) {
    var rows = [["Name", "Start", "End", "Duration", "Colour", "Comments"]];
    sorted(markers).forEach(function (m) {
      rows.push([m.name, timecode(m.start, fps), timecode(m.end, fps), timecode(Math.max(0, m.end - m.start), fps), COLORS[m.color] ? COLORS[m.color][0] : "", m.comments || ""]);
    });
    return rows.map(function (r) { return r.map(csvCell).join(","); }).join("\n") + "\n";
  }

  function toTxt(markers, fps) {
    return sorted(markers).map(function (m) { return timecode(m.start, fps) + "  " + (m.name || ""); }).join("\n") + "\n";
  }

  function srtTime(sec) {
    var ms = Math.max(0, Math.round(sec * 1000));
    return pad(Math.floor(ms / 3600000)) + ":" + pad(Math.floor(ms / 60000) % 60) + ":" + pad(Math.floor(ms / 1000) % 60) + "," + pad(ms % 1000, 3);
  }

  // A marker with no length lasts until the next one (or 3 s for the last).
  function toSrt(markers) {
    var list = sorted(markers);
    return list.map(function (m, i) {
      var end = m.end > m.start + 0.01 ? m.end : (i + 1 < list.length ? list[i + 1].start : m.start + 3);
      return (i + 1) + "\n" + srtTime(m.start) + " --> " + srtTime(end) + "\n" + (m.name || m.comments || "Marker " + (i + 1)) + "\n";
    }).join("\n");
  }

  function toJson(markers) {
    return JSON.stringify(sorted(markers).map(function (m) {
      return { start: m.start, end: m.end, name: m.name, comments: m.comments, colour: COLORS[m.color] ? COLORS[m.color][0] : null };
    }), null, 2);
  }

  // "1:15", "01:15", "1:01:15", "00:01:15:12" (with frames) or plain seconds -> seconds
  function parseTime(t, fps) {
    t = String(t).trim();
    if (/^\d+(\.\d+)?$/.test(t)) return parseFloat(t);
    var p = t.split(/[:;]/).map(Number);
    if (p.some(isNaN)) return null;
    if (p.length === 4) return p[0] * 3600 + p[1] * 60 + p[2] + p[3] / (fps || 25);
    if (p.length === 3) return p[0] * 3600 + p[1] * 60 + p[2];
    if (p.length === 2) return p[0] * 60 + p[1];
    return null;
  }

  // Pasted chapters ("0:00 Intro"), timecode lists or our CSV -> [{ start, name }]
  function parseImport(text, fps) {
    var out = [];
    String(text || "").split(/\r?\n/).forEach(function (line) {
      line = line.trim();
      if (!line || /^name,start/i.test(line)) return;
      var csv = line.split(",");
      if (csv.length >= 2 && parseTime(csv[1], fps) !== null && parseTime(csv[0], fps) === null) {
        out.push({ start: parseTime(csv[1], fps), name: csv[0].replace(/^"|"$/g, "") });
        return;
      }
      var m = /^\(?((?:\d+[:;])*\d+(?:\.\d+)?)\)?\s*[-–—:|]?\s*(.*)$/.exec(line);
      if (m && parseTime(m[1], fps) !== null) out.push({ start: parseTime(m[1], fps), name: m[2].trim() });
    });
    return out.sort(function (a, b) { return a.start - b.start; });
  }

  // Markers within a frame of another with the same name: the extra ones.
  function duplicates(markers, fps) {
    var fd = 1 / (fps || 25), seen = [], extra = [];
    sorted(markers).forEach(function (m) {
      if (seen.some(function (s) { return Math.abs(s.start - m.start) < fd && (s.name || "") === (m.name || ""); })) extra.push(m);
      else seen.push(m);
    });
    return extra;
  }

  // "Chapter" -> Chapter 01, Chapter 02… in time order
  function numbered(markers, prefix) {
    var list = sorted(markers), digits = String(list.length).length < 2 ? 2 : String(list.length).length;
    return list.map(function (m, i) { return { guid: m.guid, name: (prefix || "Marker") + " " + pad(i + 1, digits) }; });
  }

  // The nearest cut (any clip's start or end) to each marker, within `maxSec`.
  function snapTargets(markers, cuts, maxSec) {
    return markers.map(function (m) {
      var best = null;
      cuts.forEach(function (c) { if (Math.abs(c - m.start) <= (maxSec || 2) && (best === null || Math.abs(c - m.start) < Math.abs(best - m.start))) best = c; });
      return { guid: m.guid, start: best };
    }).filter(function (x) { return x.start !== null; });
  }

  var api = { COLORS: COLORS, clock: clock, timecode: timecode, youtubeChapters: youtubeChapters, toCsv: toCsv, toTxt: toTxt,
    toSrt: toSrt, toJson: toJson, parseTime: parseTime, parseImport: parseImport, duplicates: duplicates, numbered: numbered, snapTargets: snapTargets };
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.HaloMarkers = api;
})(typeof self !== "undefined" ? self : this);
