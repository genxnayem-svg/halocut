/* HaloCut Bins — plans for tidying a Premiere project: where each item goes, new names, labels, a report.
 * An item: { id, name, kind, path, bin (its bin's path, "" at the top), used, offline, label, size }.
 * Nothing here touches Premiere; the panel sends the plan to the host script. © 2026 Imtayz Nayem */
(function (root) {
  var EXT = {
    video: "mov mp4 m4v mxf avi mkv mts m2ts r3d braw crm ari mpg mpeg webm wmv 3gp dv hevc insv",
    audio: "wav mp3 aif aiff m4a aac flac ogg wma caf bwf",
    image: "png jpg jpeg tif tiff psd gif bmp heic heif exr dpx tga webp svg ai",
    graphics: "mogrt aegraphic prtl aep",
  };
  var BY_EXT = {};
  Object.keys(EXT).forEach(function (k) { EXT[k].split(" ").forEach(function (e) { BY_EXT[e] = k; }); });

  var KINDS = {
    sequence: { name: "Sequences", bin: "01 Sequences", label: 0 },
    video: { name: "Footage", bin: "02 Footage", label: 4 },
    audio: { name: "Audio", bin: "03 Audio", label: 13 },
    image: { name: "Images", bin: "04 Images", label: 7 },
    graphics: { name: "Graphics", bin: "05 Graphics", label: 11 },
    other: { name: "Other", bin: "06 Other", label: 12 },
  };
  var UNUSED_BIN = "99 Unused", DUPES_BIN = "98 Duplicates";

  function kindOf(path, isSequence) {
    if (isSequence) return "sequence";
    if (!path) return "graphics"; // colour mattes, adjustment layers, titles: things with no file
    var m = /\.([a-z0-9]+)$/i.exec(path);
    return (m && BY_EXT[m[1].toLowerCase()]) || "other";
  }

  function inLocked(binPath, locked) {
    return (locked || []).some(function (l) { return binPath === l || binPath.indexOf(l + "/") === 0; });
  }

  // First rule that fits says the bin. rules: [{ contains, bin }] tried before the type bins.
  function organise(items, opts) {
    opts = opts || {};
    var rules = (opts.rules || []).filter(function (r) { return r.contains && r.bin; });
    var bins = opts.bins || {};
    var moves = [];
    items.forEach(function (it) {
      if (inLocked(it.bin, opts.locked)) return;
      var to = null;
      for (var i = 0; i < rules.length && !to; i++) if (it.name.toLowerCase().indexOf(rules[i].contains.toLowerCase()) >= 0) to = rules[i].bin;
      if (!to && opts.unusedToBin && !it.used && it.kind !== "sequence") to = UNUSED_BIN;
      if (!to) to = bins[it.kind] || KINDS[it.kind].bin;
      if (to !== it.bin) moves.push({ id: it.id, name: it.name, from: it.bin, bin: to });
    });
    return moves;
  }

  function unused(items) { return items.filter(function (it) { return !it.used && it.kind !== "sequence"; }); }
  function offline(items) { return items.filter(function (it) { return it.offline; }); }

  // The same file imported more than once: every copy after the first.
  function duplicates(items) {
    var seen = {}, out = [];
    items.forEach(function (it) {
      if (!it.path) return;
      var k = it.path.toLowerCase();
      if (seen[k]) out.push({ id: it.id, name: it.name, of: seen[k].name, bin: it.bin, path: it.path });
      else seen[k] = it;
    });
    return out;
  }

  // opts: { find, replace, prefix, suffix, number: bool, start, digits }. Keeps the file extension in the name.
  function rename(items, opts) {
    opts = opts || {};
    var n = opts.start === undefined ? 1 : opts.start, out = [];
    items.forEach(function (it) {
      var m = /^(.*?)(\.[a-z0-9]{2,5})?$/i.exec(it.name), stem = m[1], ext = m[2] || "";
      var name = stem;
      if (opts.find) name = name.split(opts.find).join(opts.replace || "");
      if (opts.number) { var d = String(n++); while (d.length < (opts.digits || 2)) d = "0" + d; name = name + " " + d; }
      name = (opts.prefix || "") + name + (opts.suffix || "") + ext;
      if (name !== it.name) out.push({ id: it.id, from: it.name, name: name });
    });
    return out;
  }

  function labels(items, map) {
    map = map || {};
    return items.map(function (it) {
      var l = map[it.kind] !== undefined ? map[it.kind] : KINDS[it.kind].label;
      return { id: it.id, label: l, from: it.label };
    }).filter(function (x) { return x.label !== x.from; });
  }

  // A file name -> where it is now, searching a folder and the folders inside it (fsLike: { readdir, isDir }).
  function findFiles(names, folder, fsLike, pathJoin, limit) {
    var want = {}, found = {}, left = 0;
    names.forEach(function (n) { if (!want[n.toLowerCase()]) { want[n.toLowerCase()] = true; left++; } });
    var queue = [folder], seen = 0;
    while (queue.length && left > 0 && seen < (limit || 20000)) {
      var dir = queue.shift(), entries;
      try { entries = fsLike.readdir(dir); } catch (e) { continue; }
      for (var i = 0; i < entries.length; i++) {
        var p = pathJoin(dir, entries[i]); seen++;
        if (entries[i][0] === ".") continue;
        if (fsLike.isDir(p)) queue.push(p);
        else if (want[entries[i].toLowerCase()] && !found[entries[i].toLowerCase()]) { found[entries[i].toLowerCase()] = p; left--; }
      }
    }
    return found;
  }

  function bytes(n) {
    if (!n) return "0 B";
    var u = ["B", "KB", "MB", "GB", "TB"], i = Math.min(u.length - 1, Math.floor(Math.log(n) / Math.log(1024)));
    return (n / Math.pow(1024, i)).toFixed(i ? 1 : 0) + " " + u[i];
  }

  function report(items, projectName) {
    var by = {}, size = 0, unusedSize = 0;
    Object.keys(KINDS).forEach(function (k) { by[k] = { n: 0, size: 0 }; });
    items.forEach(function (it) {
      by[it.kind].n++; by[it.kind].size += it.size || 0; size += it.size || 0;
      if (!it.used && it.kind !== "sequence") unusedSize += it.size || 0;
    });
    var lines = ["Project report: " + (projectName || "Project"), ""];
    Object.keys(KINDS).forEach(function (k) {
      if (by[k].n) lines.push(KINDS[k].name + ": " + by[k].n + (by[k].size ? " · " + bytes(by[k].size) : ""));
    });
    lines.push("", "Media on disk: " + bytes(size),
      "Unused: " + unused(items).length + " items · " + bytes(unusedSize),
      "Offline: " + offline(items).length, "Duplicate imports: " + duplicates(items).length);
    return { text: lines.join("\n"), by: by, size: size, unusedSize: unusedSize };
  }

  var api = { KINDS: KINDS, UNUSED_BIN: UNUSED_BIN, DUPES_BIN: DUPES_BIN, kindOf: kindOf, organise: organise, unused: unused,
    offline: offline, duplicates: duplicates, rename: rename, labels: labels, findFiles: findFiles, report: report, bytes: bytes };
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.HaloBins = api;
})(typeof self !== "undefined" ? self : this);
