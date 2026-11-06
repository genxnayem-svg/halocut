/* HaloCut Command panel: keyboard-first. Type, ↑↓, ↩. Shortcuts for anything, combos of anything.
 * © 2026 Imtayz Nayem */
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var C = window.HaloCommand, MAC = /Mac/.test(navigator.platform);
  var req = window.cep_node ? window.cep_node.require : window.require;
  // keys the search box needs for text, and the one that sets shortcuts
  var RESERVED = { "mod+a": 1, "mod+c": 1, "mod+v": 1, "mod+x": 1, "mod+z": 1, "shift+mod+z": 1, "shift+mod+k": 1 };
  var st = { items: [], shown: [], at: 0, group: "all", effects: saved("halocut.cmd.effects", null), shortcuts: saved("halocut.cmd.keys", {}),
    combos: saved("halocut.cmd.combos", []), recent: saved("halocut.cmd.recent", []), capture: null, combo: null, busy: false, fps: 25 };

  function saved(key, fallback) { try { var v = JSON.parse(localStorage.getItem(key)); return v === null ? fallback : v; } catch (e) { return fallback; } }
  function store(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) {} }
  function say(t, busy) { $("kSum").className = "sum" + (busy ? " busy" : ""); $("kSumText").textContent = t; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }

  // ---- the list ----------------------------------------------------------------------------------------
  function rebuild() {
    st.items = C.build({ effects: st.effects || {}, toolbar: window.HaloToolbar, grade: window.HaloGrade, motion: window.HaloMotion, trans: window.HaloTrans, combos: st.combos });
    show();
  }
  function byId(id) { for (var i = 0; i < st.items.length; i++) if (st.items[i].id === id) return st.items[i]; return null; }
  var GROUP_NAME = {}; C.GROUPS.forEach(function (g) { GROUP_NAME[g.id] = g.name; });

  function show() {
    st.shown = C.search(st.items, $("kSearch").value, st.group, st.recent, 80);
    st.at = Math.min(st.at, Math.max(0, st.shown.length - 1));
    var box = $("kList"); box.innerHTML = "";
    if (!st.shown.length) box.innerHTML = '<div class="k-empty">' + (st.items.length ? "Nothing by that name" : "Loading…") + "</div>";
    st.shown.forEach(function (it, i) {
      var row = document.createElement("div"), keys = C.keysFor(st.shortcuts, it.id);
      row.className = "k-item" + (i === st.at ? " on" : "");
      row.innerHTML = '<div class="t"><b>' + esc(it.name) + '</b><small><span class="g">' + GROUP_NAME[it.group] + "</span>" + esc(it.hint || "") + '</small></div><div class="r">' +
        (keys ? "<kbd>" + esc(C.label(keys, MAC)) + "</kbd>" : "") + '<button class="set" title="Set a shortcut">⌨</button>' +
        (it.group === "combos" ? '<button class="set" data-edit title="Edit this combo">✎</button>' : "") + "</div>";
      row.addEventListener("click", function (ev) {
        st.at = i;
        if (ev.target.hasAttribute && ev.target.hasAttribute("data-edit")) { editCombo(it.id.slice(6)); return focus(); }
        if (ev.target.classList.contains("set")) { capture(it); return focus(); }
        show(); go(it); focus();
      });
      box.appendChild(row);
    });
    $("kCount").textContent = st.items.length ? st.shown.length + (st.shown.length === 80 ? "+" : "") : "";
    var on = box.querySelector(".k-item.on"); if (on && on.scrollIntoView) on.scrollIntoView({ block: "nearest" });
    groups();
  }
  function groups() {
    var box = $("kGroups"); box.innerHTML = "";
    C.GROUPS.forEach(function (g) {
      var b = document.createElement("button"); b.textContent = g.name; b.className = g.id === st.group ? "on" : "";
      b.addEventListener("click", function () { st.group = g.id; st.at = 0; show(); focus(); });
      box.appendChild(b);
    });
  }
  function focus() { if (!st.capture) $("kSearch").focus(); }

  // ---- running ---------------------------------------------------------------------------------------------
  function run(tool, args) {
    if (!window.HaloBridge) return Promise.reject("Open this panel in Premiere Pro");
    return window.HaloBridge.run(tool, args || {}).then(function (r) { if (!r.ok) throw r.msg; return r; });
  }
  function ctx() { return { grade: window.HaloGrade, motion: window.HaloMotion, trans: window.HaloTrans, fps: st.fps, byId: byId }; }
  function needsFps(list) { return list.some(function (s) { return s.tool === "pr.transApply"; }); }
  // One command, whatever kind it is → a promise of its message. It becomes plain Premiere steps (the same ones
  // the HaloCut app runs for a shortcut), done one after another; a combo stops at the first that can't be done.
  function exec(it) {
    var list;
    try { list = C.steps(it, ctx()); } catch (e) { return Promise.reject(e.message); }
    if (!needsFps(list)) return runList(list);
    return run("pr.capsInfo").then(function (r) { st.fps = (r.data && r.data.fps) || st.fps; return runList(C.steps(it, ctx())); });
  }
  function runList(list) {
    var i = 0, last = "", many = list.length > 1;
    return new Promise(function (resolve, reject) {
      (function next() {
        if (i >= list.length) return resolve(many ? "Ran " + list.length + " steps" : last);
        var s = list[i++];
        if (many) say("Step " + i + " of " + list.length + " · " + s.name + "…", true);
        run(s.tool, s.args).then(function (r) { last = r.msg; setTimeout(next, 60); }, function (m) { reject(many ? "Step " + i + " (" + s.name + "): " + m : m); });
      })();
    });
  }
  function go(it) {
    if (!it || st.busy) return;
    st.busy = true; say(it.name + "…", true);
    st.recent = C.remember(st.recent, it.id); store("halocut.cmd.recent", st.recent);
    exec(it).then(function (m) { say(m); }, function (m) { say(String(m)); }).then(function () { st.busy = false; });
  }

  // ---- shortcuts -------------------------------------------------------------------------------------------
  function capture(it) {
    st.capture = it; $("kCapture").hidden = false; $("kCaptureName").textContent = it.name;
    $("kSearch").blur(); say("Press the keys, or Esc");
  }
  function endCapture(msg) { st.capture = null; $("kCapture").hidden = true; if (msg) say(msg); show(); focus(); }
  // The shortcuts also go to a file as ready-to-run Premiere steps, so the HaloCut app can run them wherever you
  // are in Premiere Pro, not only in this panel. A shortcut whose command isn't loaded yet keeps what it had.
  var KEYS_FILE = null;
  function keysFile() {
    if (KEYS_FILE || !req) return KEYS_FILE;
    try { var path = req("path"), os = req("os"); KEYS_FILE = path.join(os.homedir(), "Library", "Application Support", "HaloCut", "command-shortcuts.json"); } catch (e) {}
    return KEYS_FILE;
  }
  function saveKeys() {
    store("halocut.cmd.keys", st.shortcuts);
    try {
      var fs = req("fs"), path = req("path"), file = keysFile(), before = {}, out = {};
      try { before = JSON.parse(fs.readFileSync(file, "utf8")).shortcuts || {}; } catch (e) {}
      for (var k in st.shortcuts) {
        var id = st.shortcuts[k], it = byId(id);
        if (it) { try { out[k] = { id: id, name: it.name, steps: C.steps(it, ctx()) }; } catch (e) {} }
        else if (before[k] && before[k].id === id && before[k].steps) out[k] = before[k];
      }
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, JSON.stringify({ app: "PPRO", version: 2, shortcuts: out }, null, 2));
    } catch (e) {}
    listen();
  }
  // Ask Premiere Pro to hand these keys to the panel while it has focus, instead of using them itself.
  function listen() {
    if (!MAC) return;
    try { new CSInterface().registerKeyEventsInterest(JSON.stringify(C.interest(st.shortcuts).concat(C.interest({ "shift+mod+k": 1 })))); } catch (e) {}
  }

  document.addEventListener("keydown", function (e) {
    if (st.capture) {
      e.preventDefault();
      if (e.key === "Escape") return endCapture("No change");
      if (e.key === "Backspace" || e.key === "Delete") { st.shortcuts = C.assign(st.shortcuts, st.capture.id, null).map; saveKeys(); return endCapture("Shortcut cleared"); }
      var k = C.keyOf(e, MAC);
      if (!k) return; // still holding modifiers, or a plain letter
      if (RESERVED[k]) return say(C.label(k, MAC) + " is kept for editing text: pick another");
      var res = C.assign(st.shortcuts, st.capture.id, k), name = st.capture.name, took = res.took && byId(res.took);
      st.shortcuts = res.map; saveKeys();
      return endCapture(C.label(k, MAC) + " runs " + name + (took ? " · it was " + took.name + "'s" : ""));
    }
    var key = C.keyOf(e, MAC);
    if (key === "shift+mod+k") { e.preventDefault(); if (st.shown[st.at]) capture(st.shown[st.at]); return; }
    if (key && st.shortcuts[key]) { e.preventDefault(); var it = byId(st.shortcuts[key]); if (it) go(it); return; }
    if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); st.at = Math.max(0, Math.min(st.shown.length - 1, st.at + (e.key === "ArrowDown" ? 1 : -1))); show(); return; }
    if (e.key === "Enter") {
      e.preventDefault();
      var cur = st.shown[st.at]; if (!cur) return;
      if (e.shiftKey) return addStep(cur);
      return go(cur);
    }
    if (e.key === "Tab") {
      e.preventDefault();
      var ids = C.GROUPS.map(function (g) { return g.id; }), i = ids.indexOf(st.group);
      st.group = ids[(i + (e.shiftKey ? ids.length - 1 : 1)) % ids.length]; st.at = 0; show(); return;
    }
    if (e.key === "Escape") { if ($("kSearch").value) { $("kSearch").value = ""; st.at = 0; show(); } else if (st.group !== "all") { st.group = "all"; show(); } return; }
    if (document.activeElement !== $("kSearch") && document.activeElement !== $("kComboName") && e.key.length === 1 && !e.metaKey && !e.ctrlKey) focus();
  });
  $("kSearch").addEventListener("input", function () { st.at = 0; show(); });

  // ---- combos -----------------------------------------------------------------------------------------------
  function openCombo(c) { st.combo = c; $("kCombo").hidden = false; $("kNewCombo").hidden = true; $("kComboName").value = c.name === "My combo" ? "" : c.name; drawCombo(); }
  function closeCombo() { st.combo = null; $("kCombo").hidden = true; $("kNewCombo").hidden = false; focus(); }
  function addStep(it) {
    if (it.group === "combos") return say("Combos can't hold other combos");
    if (!st.combo) openCombo(C.newCombo());
    st.combo.steps.push(it.id); drawCombo(); say("Step " + st.combo.steps.length + ": " + it.name);
  }
  function editCombo(id) { var c = st.combos.filter(function (x) { return x.id === id; })[0]; if (c) openCombo(JSON.parse(JSON.stringify(c))); }
  function drawCombo() {
    var box = $("kSteps"), gone = C.missing(st.combo, st.items); box.innerHTML = "";
    st.combo.steps.forEach(function (sid, i) {
      var li = document.createElement("li"), it = byId(sid);
      li.className = gone.indexOf(sid) >= 0 ? "gone" : "";
      li.innerHTML = "<span>" + esc(it ? it.name : sid.replace(/^\w+:/, "") + " (not available)") + '</span> <button data-up title="Earlier">↑</button><button data-x title="Remove">✕</button>';
      li.querySelector("[data-up]").addEventListener("click", function () { if (i) { var s = st.combo.steps; s.splice(i - 1, 0, s.splice(i, 1)[0]); drawCombo(); } focus(); });
      li.querySelector("[data-x]").addEventListener("click", function () { st.combo.steps.splice(i, 1); drawCombo(); focus(); });
      box.appendChild(li);
    });
    $("kComboHint").hidden = st.combo.steps.length > 1;
    $("kComboDelete").hidden = !st.combos.some(function (c) { return c.id === st.combo.id; });
  }
  $("kNewCombo").addEventListener("click", function () { openCombo(C.newCombo()); focus(); });
  $("kComboClose").addEventListener("click", closeCombo);
  $("kComboRun").addEventListener("click", function () {
    if (!st.combo.steps.length) return say("Add a step first");
    st.busy = true; exec({ name: st.combo.name, run: { combo: st.combo.steps } }).then(function (m) { say(m); }, function (m) { say(String(m)); }).then(function () { st.busy = false; focus(); });
  });
  $("kComboSave").addEventListener("click", function () {
    if (!st.combo.steps.length) return say("Add a step first");
    st.combo.name = $("kComboName").value.trim() || "Combo " + (st.combos.length + 1);
    var others = st.combos.filter(function (c) { return c.id !== st.combo.id; });
    st.combos = others.concat([st.combo]); store("halocut.cmd.combos", st.combos);
    say("Saved “" + st.combo.name + "” · find it under Combos, and give it a shortcut with ⌘⇧K");
    closeCombo(); rebuild();
  });
  $("kComboDelete").addEventListener("click", function () {
    var id = st.combo.id; st.combos = st.combos.filter(function (c) { return c.id !== id; }); store("halocut.cmd.combos", st.combos);
    st.shortcuts = C.assign(st.shortcuts, "combo:" + id, null).map; saveKeys();
    say("Combo deleted"); closeCombo(); rebuild();
  });

  // ---- start ------------------------------------------------------------------------------------------------
  function loadEffects() {
    run("pr.listEffects").then(function (r) {
      st.effects = r.data; store("halocut.cmd.effects", r.data); rebuild();
      say(st.items.length + " things to run · type to find one");
      // everything is loaded now: refresh the file the HaloCut app reads (cuts are timed for this sequence's frame rate)
      return run("pr.capsInfo").then(function (c) { st.fps = (c.data && c.data.fps) || st.fps; }, function () {}).then(saveKeys);
    }).catch(function (m) { say(String(m)); });
  }
  window.onHaloReady = function () { loadEffects(); listen(); };
  // a shortcut pressed elsewhere in Premiere Pro is run by the HaloCut app: say how it went
  window.onHaloRan = function (m) { if (!st.busy) say((m.ok ? "" : "✕ ") + (m.label || m.tool) + " · " + (m.msg || (m.ok ? "done" : "failed"))); };
  rebuild(); focus();
  if (!window.HaloBridge) {
    if (!st.effects) { st.effects = { video: ["Gaussian Blur", "Lumetri Color", "Crop", "Warp Stabilizer", "Ultra Key"], audio: ["DeNoise", "Parametric Equalizer"], transitions: ["Cross Dissolve", "Dip to Black", "Film Dissolve"] }; rebuild(); }
    say("Open this panel in Premiere Pro to run things · the list here is a sample");
  }
})();
