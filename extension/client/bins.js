/* HaloCut Bins panel: read the project, show the plan, apply it, and Restore the last change.
 * © 2026 Imtayz Nayem */
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var B = window.HaloBins;
  var req = window.cep_node ? window.cep_node.require : window.require;
  var LABELS = ["Violet", "Iris", "Caribbean", "Lavender", "Cerulean", "Forest", "Rose", "Mango", "Purple", "Blue", "Teal", "Magenta", "Tan", "Green", "Brown", "Yellow"];
  var st = { items: [], bins: [], project: "Project", undo: null, found: {}, renameIds: [] };

  function saved(k, d) { try { return JSON.parse(localStorage.getItem(k)) || d; } catch (e) { return d; } }
  function store(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  var prefs = saved("halocut.bins", { rules: [{ contains: "b-roll", bin: "02 Footage/B-roll" }], bins: {}, locked: [], unusedBin: false, labels: {} });

  function say(t, busy) { $("nSum").className = "sum" + (busy ? " busy" : ""); $("nSumText").textContent = t; }
  function bridge(tool, args) {
    if (!window.HaloBridge) { say("Open this panel in Premiere Pro"); return Promise.resolve({ ok: false }); }
    say("Working…", true);
    return window.HaloBridge.run(tool, args || {}).then(function (r) { say(r.msg); return r; });
  }

  // ---- read the project ------------------------------------------------------------
  function sizeOf(p) { try { return p ? req("fs").statSync(p).size : 0; } catch (e) { return 0; } }

  function scan() {
    bridge("pr.binScan").then(function (r) {
      if (!r.ok) return;
      st.items = r.data.items.map(function (it) {
        it.kind = B.kindOf(it.path, it.isSequence);
        it.size = sizeOf(it.path);
        return it;
      });
      st.bins = r.data.bins; st.project = r.data.project;
      $("nCount").textContent = st.items.length + " items · " + st.bins.length + " bins";
      render();
    });
  }

  // ---- apply + restore ---------------------------------------------------------------
  function apply(plan) {
    return bridge("pr.binApply", plan).then(function (r) {
      if (r.ok && r.data) { st.undo = r.data.undo; $("nRestore").disabled = false; scan(); }
      return r;
    });
  }
  $("nRestore").addEventListener("click", function () {
    if (!st.undo) return;
    bridge("pr.binApply", st.undo).then(function (r) { if (r.ok) { st.undo = null; $("nRestore").disabled = true; say("Restored · " + r.msg); scan(); } });
  });
  $("nScan").addEventListener("click", scan);

  // ---- views --------------------------------------------------------------------------
  var view = "organise";
  Array.prototype.forEach.call(document.querySelectorAll("#nViews button"), function (b) {
    b.addEventListener("click", function () {
      view = b.dataset.v;
      Array.prototype.forEach.call(document.querySelectorAll("#nViews button"), function (x) { x.classList.toggle("on", x === b); });
      Array.prototype.forEach.call(document.querySelectorAll(".view"), function (v) { v.hidden = v.id !== "v-" + view; });
      render();
    });
  });

  function lines(box, rows, empty) {
    box.innerHTML = "";
    if (!rows.length) { box.innerHTML = '<div class="k-empty">' + empty + "</div>"; return; }
    rows.slice(0, 300).forEach(function (r) {
      var d = document.createElement("div");
      d.className = "n-line";
      var b = document.createElement("b"); b.textContent = r[0];
      var s = document.createElement("span"); s.textContent = r[1]; if (r[2]) s.className = "to";
      d.appendChild(b); d.appendChild(s); box.appendChild(d);
    });
    if (rows.length > 300) box.insertAdjacentHTML("beforeend", '<div class="k-empty">and ' + (rows.length - 300) + " more</div>");
  }

  function render() {
    ({ organise: organise, unused: unusedView, dupes: dupesView, offline: offlineView, rename: renameView, labels: labelsView, report: reportView })[view]();
  }

  // ---- organise -----------------------------------------------------------------------
  function saveRules() { store("halocut.bins", prefs); organise(); }

  function rulesUi() {
    var box = $("nRules");
    box.innerHTML = "";
    prefs.rules.forEach(function (r, i) {
      var row = document.createElement("div");
      row.className = "n-rule";
      var a = document.createElement("input"); a.value = r.contains; a.placeholder = "name contains";
      var arrow = document.createElement("span"); arrow.textContent = "→";
      var b = document.createElement("input"); b.value = r.bin; b.placeholder = "bin (a/b for inside)";
      var x = document.createElement("button"); x.className = "k-x"; x.textContent = "×";
      a.addEventListener("change", function () { r.contains = a.value.trim(); saveRules(); });
      b.addEventListener("change", function () { r.bin = b.value.trim(); saveRules(); });
      x.addEventListener("click", function () { prefs.rules.splice(i, 1); rulesUi(); saveRules(); });
      [a, arrow, b, x].forEach(function (n) { row.appendChild(n); });
      box.appendChild(row);
    });
  }
  $("nAddRule").addEventListener("click", function () { prefs.rules.push({ contains: "", bin: "" }); rulesUi(); });

  function typesUi() {
    var box = $("nTypes");
    box.innerHTML = "";
    Object.keys(B.KINDS).forEach(function (k) {
      var row = document.createElement("div"); row.className = "n-type";
      var lab = document.createElement("span"); lab.textContent = B.KINDS[k].name;
      var inp = document.createElement("input"); inp.value = prefs.bins[k] || B.KINDS[k].bin;
      inp.addEventListener("change", function () { prefs.bins[k] = inp.value.trim() || B.KINDS[k].bin; saveRules(); });
      row.appendChild(lab); row.appendChild(inp); box.appendChild(row);
    });
  }

  function locksUi() {
    var box = $("nLocks");
    if (!st.bins.length) return;
    box.innerHTML = "";
    st.bins.forEach(function (b) {
      var l = document.createElement("label"); l.className = "mini-check";
      var c = document.createElement("input"); c.type = "checkbox"; c.checked = prefs.locked.indexOf(b) >= 0;
      c.addEventListener("change", function () {
        prefs.locked = prefs.locked.filter(function (x) { return x !== b; });
        if (c.checked) prefs.locked.push(b);
        saveRules();
      });
      l.appendChild(c); l.appendChild(document.createTextNode(" " + b)); box.appendChild(l);
    });
  }

  $("nUnusedBin").checked = !!prefs.unusedBin;
  $("nUnusedBin").addEventListener("change", function () { prefs.unusedBin = $("nUnusedBin").checked; saveRules(); });

  function plan() { return B.organise(st.items, { rules: prefs.rules, bins: prefs.bins, locked: prefs.locked, unusedToBin: prefs.unusedBin }); }

  function organise() {
    locksUi();
    var moves = plan();
    $("nPlanCount").textContent = "· " + moves.length + " to move";
    lines($("nPlan"), moves.map(function (m) { return [m.name, (m.from || "top") + " → " + m.bin, true]; }), st.items.length ? "Already tidy" : "Read the project to see the plan");
  }
  $("nOrganise").addEventListener("click", function () {
    var moves = plan();
    if (!moves.length) return say("Nothing to move");
    apply({ moves: moves.map(function (m) { return { id: m.id, bin: m.bin }; }) });
  });

  // ---- unused, duplicates, offline ----------------------------------------------------------
  LABELS.forEach(function (n, i) { $("nUnusedLabel").add(new Option(n, String(i))); });
  $("nUnusedLabel").value = "14";

  function unusedView() {
    var u = B.unused(st.items), size = u.reduce(function (n, it) { return n + (it.size || 0); }, 0);
    lines($("nUnused"), u.map(function (it) { return [it.name, (it.bin || "top") + (it.size ? " · " + B.bytes(it.size) : "")]; }), st.items.length ? "Every item is used in a sequence" : "Read the project first");
    if (u.length) say(u.length + " unused · " + B.bytes(size) + " on disk");
  }
  $("nUnusedMove").addEventListener("click", function () {
    var u = B.unused(st.items).filter(function (it) { return it.bin !== B.UNUSED_BIN; });
    if (!u.length) return say("Nothing unused to move");
    apply({ moves: u.map(function (it) { return { id: it.id, bin: B.UNUSED_BIN }; }) });
  });
  $("nUnusedLabelGo").addEventListener("click", function () {
    var l = +$("nUnusedLabel").value;
    apply({ labels: B.unused(st.items).map(function (it) { return { id: it.id, label: l }; }) });
  });

  function dupesView() {
    lines($("nDupes"), B.duplicates(st.items).map(function (d) { return [d.name, "copy of “" + d.of + "” · " + (d.bin || "top")]; }), st.items.length ? "No file is imported twice" : "Read the project first");
  }
  $("nDupesMove").addEventListener("click", function () {
    var d = B.duplicates(st.items).filter(function (x) { return x.bin !== B.DUPES_BIN; });
    if (!d.length) return say("No duplicates to move");
    apply({ moves: d.map(function (x) { return { id: x.id, bin: B.DUPES_BIN }; }) });
  });

  function base(p) { return String(p).split(/[\\/]/).pop(); }
  function offlineView() {
    var off = B.offline(st.items);
    lines($("nOffline"), off.map(function (it) {
      var f = st.found[base(it.path).toLowerCase()];
      return [it.name, f ? "found: " + f.split(/[\\/]/).slice(-2).join("/") : (it.path || "no path"), !!f];
    }), st.items.length ? "Nothing is offline" : "Read the project first");
  }
  $("nPick").addEventListener("click", function () {
    var off = B.offline(st.items);
    if (!off.length) return say("Nothing is offline");
    var res = window.cep && window.cep.fs ? window.cep.fs.showOpenDialog(false, true, "The folder the media is in now", "") : null;
    var folder = res && res.data && res.data[0];
    if (!folder) return;
    say("Looking in " + base(folder) + "…", true);
    setTimeout(function () {
      var fs = req("fs"), path = req("path");
      st.found = B.findFiles(off.map(function (it) { return base(it.path); }), folder,
        { readdir: function (p) { return fs.readdirSync(p); }, isDir: function (p) { try { return fs.statSync(p).isDirectory(); } catch (e) { return false; } } }, path.join);
      var n = Object.keys(st.found).length;
      $("nFound").textContent = "Found " + n + " of " + off.length;
      $("nRelink").disabled = !n;
      offlineView();
      say(n ? "Found " + n + " · press Relink" : "None of them are in that folder");
    }, 30);
  });
  $("nRelink").addEventListener("click", function () {
    var rel = B.offline(st.items).map(function (it) { var f = st.found[base(it.path).toLowerCase()]; return f ? { id: it.id, path: f } : null; }).filter(Boolean);
    apply({ relinks: rel }).then(function () { st.found = {}; $("nRelink").disabled = true; });
  });

  // ---- rename ----------------------------------------------------------------------------------
  function renameOpts() {
    return { find: $("rFind").value, replace: $("rReplace").value, prefix: $("rPrefix").value, suffix: $("rSuffix").value, number: $("rNumber").checked, start: +$("rStart").value || 1 };
  }
  function renamePlan() {
    var chosen = st.items.filter(function (it) { return st.renameIds.indexOf(it.id) >= 0; });
    return B.rename(chosen, renameOpts());
  }
  function renameView() {
    var p = renamePlan();
    lines($("nRename"), p.map(function (r) { return [r.from, r.name, true]; }), st.renameIds.length ? "These settings change nothing" : "Select items in the Project panel, then Use the selection");
    $("rGo").disabled = !p.length;
  }
  ["rFind", "rReplace", "rPrefix", "rSuffix", "rNumber", "rStart"].forEach(function (id) { $(id).addEventListener("input", renameView); });
  $("rLoad").addEventListener("click", function () {
    bridge("pr.binSelection").then(function (r) { if (r.ok) { st.renameIds = r.data.ids; if (!st.items.length) scan(); renameView(); } });
  });
  $("rGo").addEventListener("click", function () { apply({ renames: renamePlan().map(function (r) { return { id: r.id, name: r.name }; }) }); });

  // ---- labels ----------------------------------------------------------------------------------
  function labelsView() {
    var box = $("nLabelMap");
    box.innerHTML = "";
    Object.keys(B.KINDS).forEach(function (k) {
      var row = document.createElement("div"); row.className = "n-type";
      var lab = document.createElement("span"); lab.textContent = B.KINDS[k].name;
      var sel = document.createElement("select");
      LABELS.forEach(function (n, i) { sel.add(new Option(n, String(i))); });
      sel.value = String(prefs.labels[k] !== undefined ? prefs.labels[k] : B.KINDS[k].label);
      sel.addEventListener("change", function () { prefs.labels[k] = +sel.value; store("halocut.bins", prefs); labelsView(); });
      row.appendChild(lab); row.appendChild(sel); box.appendChild(row);
    });
    $("nLabelCount").textContent = B.labels(st.items, prefs.labels).length + " to change";
  }
  $("nLabelGo").addEventListener("click", function () {
    var l = B.labels(st.items, prefs.labels);
    if (!l.length) return say("Labels already match");
    apply({ labels: l.map(function (x) { return { id: x.id, label: x.label }; }) });
  });

  // ---- report -----------------------------------------------------------------------------------
  function reportView() { $("nReport").value = st.items.length ? B.report(st.items, st.project).text : "Read the project first"; }
  $("nReportCopy").addEventListener("click", function () {
    var cp = req("child_process"), p = cp.spawn(process.platform === "darwin" ? "pbcopy" : "clip");
    p.on("close", function (c) { say(c === 0 ? "Report copied" : "Couldn't copy"); });
    p.stdin.end($("nReport").value);
  });

  rulesUi(); typesUi();
  window.onHaloReady = scan;
  if (!window.cep_node && !window.__adobe_cep__) { // a browser preview with a made-up project
    st.items = [["Main edit", "", true, ""], ["A001.mov", "/c/A001.mov", false, ""], ["Song.wav", "/m/Song.wav", false, "Music"], ["Logo.png", "/g/Logo.png", false, "Old"],
      ["Interview B-roll.mp4", "/c/b.mp4", false, ""]].map(function (x, i) { return { id: String(i), name: x[0], path: x[1], isSequence: x[2], bin: x[3], kind: B.kindOf(x[1], x[2]), used: i !== 3, offline: i === 4, label: 0, size: 1e8 * i }; });
    st.bins = ["Music", "Old"];
    $("nCount").textContent = "5 items · 2 bins (preview)";
    render();
  }
})();
