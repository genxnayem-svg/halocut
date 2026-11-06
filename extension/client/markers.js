/* HaloCut Markers panel: list, edit and filter sequence markers; chapters, files and cuts from them.
 * © 2026 Imtayz Nayem */
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var K = window.HaloMarkers;
  var req = window.cep_node ? window.cep_node.require : window.require;
  var st = { markers: [], fps: 25, end: 0, sequence: "Sequence", filter: null, checked: {} };

  function say(text, busy) { $("kSum").className = "sum" + (busy ? " busy" : ""); $("kSumText").textContent = text; }

  function bridge(tool, args) {
    if (!window.HaloBridge) { say("Open this panel in Premiere Pro"); return Promise.resolve({ ok: false }); }
    say("Working…", true);
    return window.HaloBridge.run(tool, args || {}).then(function (res) { say(res.msg); return res; });
  }

  // ---- read -----------------------------------------------------------------------
  function refresh() {
    if (!window.HaloBridge) { // a browser preview: sample markers so the layout can be seen
      st.markers = [{ guid: "a", start: 0, end: 0, name: "Intro", color: 0 }, { guid: "b", start: 12, end: 12, name: "Why this matters", color: 3 },
        { guid: "c", start: 75, end: 75, name: "Setup", color: 0 }, { guid: "d", start: 260.4, end: 260.4, name: "Silence remover", color: 1 }];
      st.end = 400; return render();
    }
    bridge("pr.markersList").then(function (res) {
      if (!res.ok) return;
      st.markers = res.data.markers; st.fps = res.data.fps; st.end = res.data.end; st.sequence = res.data.sequence;
      st.checked = {};
      render();
    });
  }

  function shown() { return st.markers.filter(function (m) { return st.filter === null || m.color === st.filter; }).sort(function (a, b) { return a.start - b.start; }); }
  function targets() {
    var list = shown(), ticked = list.filter(function (m) { return st.checked[m.guid]; });
    return ticked.length ? ticked : list;
  }

  // ---- list ----------------------------------------------------------------------------
  function colorBar() {
    var box = $("kColors");
    box.innerHTML = "";
    var all = document.createElement("button");
    all.className = "all" + (st.filter === null ? " on" : "");
    all.textContent = "All";
    all.addEventListener("click", function () { st.filter = null; render(); });
    box.appendChild(all);
    K.COLORS.forEach(function (c, i) {
      var b = document.createElement("button");
      b.style.background = c[1];
      b.title = c[0];
      b.className = st.filter === i ? "on" : "";
      b.addEventListener("click", function () { st.filter = st.filter === i ? null : i; render(); });
      box.appendChild(b);
    });
  }

  function render() {
    colorBar();
    var list = shown(), box = $("kList");
    box.innerHTML = "";
    if (!list.length) box.innerHTML = '<div class="k-empty">' + (st.markers.length ? "No markers in this colour" : "No markers in this sequence yet") + "</div>";
    list.forEach(function (m) {
      var row = document.createElement("div");
      row.className = "k-item";
      var cb = document.createElement("input");
      cb.type = "checkbox"; cb.checked = !!st.checked[m.guid];
      cb.addEventListener("change", function () { st.checked[m.guid] = cb.checked; });
      var dot = document.createElement("button");
      dot.className = "k-dot"; dot.style.background = K.COLORS[m.color] ? K.COLORS[m.color][1] : "#888";
      dot.title = "Click for the next colour";
      dot.addEventListener("click", function () {
        var c = (m.color + 1) % K.COLORS.length;
        bridge("pr.markersUpdate", { changes: [{ guid: m.guid, color: c }] }).then(function (r) { if (r.ok || !window.HaloBridge) { m.color = c; render(); } });
      });
      var time = document.createElement("span");
      time.className = "k-time"; time.textContent = K.clock(m.start); time.title = K.timecode(m.start, st.fps);
      var name = document.createElement("input");
      name.className = "k-name"; name.value = m.name; name.placeholder = "Unnamed";
      name.addEventListener("change", function () {
        m.name = name.value;
        bridge("pr.markersUpdate", { changes: [{ guid: m.guid, name: name.value }] }).then(chapters);
      });
      var x = document.createElement("button");
      x.className = "k-x"; x.textContent = "×"; x.title = "Delete this marker";
      x.addEventListener("click", function () { bridge("pr.markersDelete", { guids: [m.guid] }).then(refresh); });
      [cb, dot, time, name, x].forEach(function (n) { row.appendChild(n); });
      box.appendChild(row);
    });
    $("kCount").textContent = st.markers.length + " marker" + (st.markers.length === 1 ? "" : "s") + (st.filter === null ? "" : " · " + list.length + " shown");
    $("kAll").checked = list.length > 0 && list.every(function (m) { return st.checked[m.guid]; });
    chapters();
  }

  $("kAll").addEventListener("change", function () { shown().forEach(function (m) { st.checked[m.guid] = $("kAll").checked; }); render(); });
  $("kRefresh").addEventListener("click", refresh);

  // ---- chapters ----------------------------------------------------------------------
  function chapters() {
    var y = K.youtubeChapters(shown(), { end: st.end });
    $("kChapters").value = y.text;
    $("kProblems").innerHTML = "";
    y.problems.forEach(function (p) { var li = document.createElement("li"); li.textContent = p; $("kProblems").appendChild(li); });
    return y;
  }

  function copy(text, done) {
    var cp = req("child_process"), mac = process.platform === "darwin";
    var p = cp.spawn(mac ? "pbcopy" : "clip");
    p.on("close", function (code) { done(code === 0); });
    p.stdin.end(text);
  }

  $("kCopy").addEventListener("click", function () {
    var y = chapters();
    if (!y.text) return say("No markers to copy");
    try { copy(y.text, function (ok) { say(ok ? "Copied " + y.count + " chapters · paste them into the description" : "Couldn't copy"); }); }
    catch (e) { say("Couldn't copy: " + e.message); }
  });

  // ---- batch ----------------------------------------------------------------------------
  K.COLORS.forEach(function (c, i) { $("kRecolour").add(new Option(c[0], String(i))); });
  var after = function (r) { if (r.ok) refresh(); };
  var guids = function (list) { return list.map(function (m) { return m.guid; }); };

  $("kDoRecolour").addEventListener("click", function () {
    var c = +$("kRecolour").value;
    bridge("pr.markersUpdate", { changes: targets().map(function (m) { return { guid: m.guid, color: c }; }) }).then(after);
  });
  $("kDoNumber").addEventListener("click", function () { bridge("pr.markersUpdate", { changes: K.numbered(targets(), $("kPrefix").value.trim() || "Chapter") }).then(after); });
  $("kDoShift").addEventListener("click", function () {
    var d = parseFloat($("kShift").value) || 0;
    bridge("pr.markersUpdate", { changes: targets().map(function (m) { return { guid: m.guid, start: Math.max(0, m.start + d) }; }) }).then(after);
  });
  $("kDoSnap").addEventListener("click", function () {
    bridge("pr.cutTimes").then(function (r) {
      if (!r.ok) return;
      var moves = K.snapTargets(targets(), r.data.cuts, 2);
      if (!moves.length) return say("No cut within 2 s of these markers");
      bridge("pr.markersUpdate", { changes: moves }).then(after);
    });
  });
  $("kDoDedupe").addEventListener("click", function () {
    var extra = K.duplicates(st.markers, st.fps);
    if (!extra.length) return say("No duplicates");
    bridge("pr.markersDelete", { guids: guids(extra) }).then(after);
  });
  $("kDoDelete").addEventListener("click", function () {
    var list = targets();
    if (!list.length) return;
    if (!window.confirm("Delete " + list.length + " marker" + (list.length === 1 ? "" : "s") + "?")) return;
    bridge("pr.markersDelete", { guids: guids(list) }).then(after);
  });
  $("kDoCut").addEventListener("click", function () {
    bridge("pr.cutAt", { times: targets().map(function (m) { return m.start; }), all: $("kEvery").checked });
  });

  // ---- files ------------------------------------------------------------------------------
  function save(ext, text) {
    var fs = req("fs"), path = req("path"), os = req("os");
    var dir = path.join(os.homedir(), "Documents", "HaloCut", "Markers");
    fs.mkdirSync(dir, { recursive: true });
    var safe = st.sequence.replace(/[^\w\- ]+/g, "").trim() || "Sequence";
    var file = path.join(dir, safe + " markers." + ext);
    fs.writeFileSync(file, text, "utf8");
    if (process.platform === "darwin") req("child_process").execFile("open", ["-R", file]);
    return file;
  }

  Array.prototype.forEach.call(document.querySelectorAll("[data-x]"), function (b) {
    b.addEventListener("click", function () {
      var list = shown(), x = b.dataset.x;
      if (!list.length) return say("No markers to export");
      var text = x === "csv" ? K.toCsv(list, st.fps) : x === "txt" ? K.toTxt(list, st.fps) : x === "srt" ? K.toSrt(list) : K.toJson(list);
      try { var f = save(x, text); say("Saved " + f.split(/[\\/]/).pop() + " in Documents/HaloCut/Markers"); }
      catch (e) { say("Couldn't save: " + e.message); }
    });
  });

  $("kImport").addEventListener("input", function () {
    var n = K.parseImport($("kImport").value, st.fps).length;
    $("kImportInfo").textContent = n ? n + " marker" + (n === 1 ? "" : "s") + " found" : "Also reads HaloCut's own CSV";
  });
  $("kDoImport").addEventListener("click", function () {
    var items = K.parseImport($("kImport").value, st.fps);
    if (!items.length) return say("Paste lines like “1:15 Setup” first");
    var color = st.filter === null ? 0 : st.filter;
    bridge("pr.markersAdd", { items: items.map(function (i) { return { start: i.start, name: i.name, color: color }; }) }).then(function (r) {
      if (r.ok) { $("kImport").value = ""; refresh(); }
    });
  });

  window.onHaloReady = refresh;
  if (!window.cep_node && !window.__adobe_cep__) refresh();
})();
