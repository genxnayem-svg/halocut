/* HaloCut Toolbar panel: search, pin to 1–9, four layouts, and the jobs that need the panel (pictures, QC).
 * © 2026 Imtayz Nayem */
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var B = window.HaloToolbar, ICONS = window.ICONS || {};
  var req = window.cep_node ? window.cep_node.require : window.require;
  var LAYOUTS = [{ id: "list", name: "List" }, { id: "cards", name: "Cards" }, { id: "icons", name: "Icons" }, { id: "row", name: "Row" }];
  var st = { q: "", layout: saved("halocut.barLayout", "list"), pins: saved("halocut.barPins", ["cut", "ripple", "fill", "punchIn", "gaps", "freeze", "jcut", "lcut", "qc"]),
    set: saved("halocut.barSet", { punch: 1.2, freeze: 2, stair: 5, jl: 12 }), busy: false };

  function saved(key, fallback) { try { var v = JSON.parse(localStorage.getItem(key)); return v === null ? fallback : v; } catch (e) { return fallback; } }
  function store(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) {} }
  function say(t, busy) { $("bSum").className = "sum" + (busy ? " busy" : ""); $("bSumText").textContent = t; }
  function icon(name) { return '<svg viewBox="0 0 24 24">' + (B.EXTRA_ICONS[name] || ICONS[name] || ICONS.dot || "") + "</svg>"; }

  // ---- drawing the tools ---------------------------------------------------------------------------
  function button(job, num, first) {
    var b = document.createElement("button"), pinned = st.pins.indexOf(job.id) >= 0;
    b.className = "b-tool" + (first ? " hit" : "");
    b.title = job.name + (job.hint ? " · " + job.hint : "") + (num ? " · key " + num : "");
    b.innerHTML = (num ? '<span class="num">' + num + "</span>" : "") + '<span class="ic">' + icon(job.icon) + "</span>" +
      '<span class="txt"><b></b><small></small></span><span class="pin' + (pinned ? " on" : "") + '" title="' + (pinned ? "Unpin" : "Pin to a number key") + '">' + (pinned ? "★" : "☆") + "</span>";
    b.querySelector("b").textContent = job.name;
    b.querySelector("small").textContent = job.hint || "";
    b.addEventListener("click", function (ev) {
      if (ev.target.classList.contains("pin")) { st.pins = B.togglePin(st.pins, job.id); store("halocut.barPins", st.pins); render(); return; }
      go(job);
    });
    return b;
  }
  function render() {
    document.body.className = "lay-" + st.layout;
    var chips = $("bLayouts"); chips.innerHTML = "";
    LAYOUTS.forEach(function (l) {
      var c = document.createElement("button"); c.textContent = l.name; c.className = l.id === st.layout ? "on" : "";
      c.addEventListener("click", function () { st.layout = l.id; store("halocut.barLayout", l.id); render(); });
      chips.appendChild(c);
    });
    var pins = B.pinned(B.JOBS, st.pins), box = $("bPinned"), all = $("bAll");
    box.innerHTML = ""; all.innerHTML = "";
    $("bPinnedBox").hidden = !!st.q || !pins.length;
    pins.forEach(function (j, i) { box.appendChild(button(j, i + 1)); });
    if (st.q) {
      var found = B.search(B.JOBS, st.q), g = group("Found " + found.length);
      found.forEach(function (j, i) { g.list.appendChild(button(j, null, i === 0)); });
      if (!found.length) g.list.innerHTML = '<p class="hint">No tool by that name</p>';
      return;
    }
    B.GROUPS.forEach(function (name) {
      var g = group(name);
      B.JOBS.filter(function (j) { return j.group === name; }).forEach(function (j) { g.list.appendChild(button(j)); });
    });
  }
  function group(title) {
    var wrap = document.createElement("div"), head = document.createElement("div"), list = document.createElement("div");
    wrap.className = "b-group"; head.className = "section"; head.textContent = title; list.className = "b-tools";
    wrap.appendChild(head); wrap.appendChild(list); $("bAll").appendChild(wrap);
    return { list: list };
  }

  // ---- search and keys ------------------------------------------------------------------------------
  $("bSearch").addEventListener("input", function () { st.q = $("bSearch").value; render(); });
  $("bSearch").addEventListener("keydown", function (ev) {
    if (ev.key === "Enter") { var f = B.search(B.JOBS, st.q)[0]; if (f) go(f); }
    if (ev.key === "Escape") { $("bSearch").value = st.q = ""; $("bSearch").blur(); render(); }
  });
  document.addEventListener("keydown", function (ev) {
    var typing = /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName);
    if (ev.key === "/" && !typing) { ev.preventDefault(); $("bSearch").focus(); return; }
    if (!typing && /^[1-9]$/.test(ev.key) && !ev.metaKey && !ev.ctrlKey) {
      var j = B.pinned(B.JOBS, st.pins)[+ev.key - 1];
      if (j) { ev.preventDefault(); go(j); }
    }
  });

  // ---- amounts --------------------------------------------------------------------------------------------
  $("bSettingsBtn").addEventListener("click", function () { $("bSettings").hidden = !$("bSettings").hidden; });
  [["bPunch", "punch", function (v) { return "×" + v.toFixed(2); }], ["bFreeze", "freeze", function (v) { return v + " s"; }],
    ["bStair", "stair", function (v) { return v + " fr"; }], ["bJl", "jl", function (v) { return v + " fr"; }]].forEach(function (s) {
    var el = $(s[0]), out = $(s[0] + "Out");
    el.value = st.set[s[1]]; out.textContent = s[2](+el.value);
    el.addEventListener("input", function () { st.set[s[1]] = +el.value; out.textContent = s[2](+el.value); store("halocut.barSet", st.set); });
  });

  // ---- running ------------------------------------------------------------------------------------------------
  function run(tool, args) {
    if (!window.HaloBridge) return Promise.reject("Open this panel in Premiere Pro");
    return window.HaloBridge.run(tool, args || {}).then(function (r) { if (!r.ok) throw r.msg; return r; });
  }
  function go(job) {
    if (st.busy) return;
    var p = job.tool ? run(job.tool, B.argsFor(job, st.set)) : ACTIONS[job.do](job);
    st.busy = true; say(job.name + "…", true);
    Promise.resolve(p).then(function (r) { if (r && r.msg) say(r.msg); }).catch(function (m) { say(String(m)); })
      .then(function () { st.busy = false; });
  }

  function osascript(script) {
    return new Promise(function (resolve, reject) {
      if (!req || process.platform !== "darwin") return reject("This one works on a Mac for now");
      req("child_process").execFile("osascript", ["-e", script], function (err, out) { if (err) reject(err.message.split("\n").pop()); else resolve(String(out).trim()); });
    });
  }
  function exportTo(file) {
    var fs = req("fs");
    return run("pr.exportFrame", { file: file }).then(function () {
      return new Promise(function (resolve, reject) {
        var tries = 0;
        (function wait() {
          var ok = false; try { ok = fs.statSync(file).size > 0; } catch (e) {}
          if (ok) return setTimeout(function () { resolve(file); }, 80);
          if (++tries > 40) return reject("Premiere didn't write the frame");
          setTimeout(wait, 150);
        })();
      });
    });
  }
  // pictures the project keeps: next to the project file, or in Documents
  function keepDir(kind) {
    return run("pr.capsInfo").then(function (r) {
      var path = req("path"), fs = req("fs"), os = req("os"), dirs = [];
      if (r.data.project) dirs.push(path.join(path.dirname(r.data.project), "HaloCut assets", kind));
      dirs.push(path.join(os.homedir(), "Documents", "HaloCut", "Assets", kind));
      for (var i = 0; i < dirs.length; i++) { try { fs.mkdirSync(dirs[i], { recursive: true }); fs.accessSync(dirs[i], fs.constants.W_OK); return dirs[i]; } catch (e) {} }
      throw "Couldn't make a folder for the picture";
    });
  }
  function stamp() { return new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-"); }

  var ACTIONS = {
    copyFrame: function () {
      if (!req) return Promise.reject("Open this panel in Premiere Pro");
      var file = req("path").join(req("os").tmpdir(), "halocut-copy-" + Date.now() + ".png");
      return exportTo(file).then(function () {
        return osascript('set the clipboard to (read (POSIX file "' + file + '") as «class PNGf»)');
      }).then(function () { return { msg: "Frame copied: paste it anywhere" }; });
    },
    paste: function () {
      if (!req) return Promise.reject("Open this panel in Premiere Pro");
      return keepDir("Pasted").then(function (dir) {
        var file = req("path").join(dir, "paste-" + stamp() + ".png");
        return osascript([
          'try', 'set png to the clipboard as «class PNGf»', 'on error', 'return "none"', 'end try',
          'set fh to open for access (POSIX file "' + file + '") with write permission', 'set eof fh to 0', 'write png to fh', 'close access fh', 'return "ok"',
        ].join("\n")).then(function (out) {
          if (out !== "ok") throw "There's no picture on the clipboard";
          return run("pr.placeImage", { file: file, seconds: 5 });
        });
      });
    },
    freeze: function (job) {
      if (!req) return Promise.reject("Open this panel in Premiere Pro");
      return keepDir("Freeze frames").then(function (dir) {
        return exportTo(req("path").join(dir, "freeze-" + stamp() + ".png"));
      }).then(function (file) { var a = B.argsFor(job, st.set); a.file = file; return run("pr.freeze", a); });
    },
    guides: function () {
      return run("pr.guidesInfo").then(function (r) {
        if (!r.data.placed) throw "No guides yet: place them from HaloCut Studio › Guides";
        return run("pr.guidesShow", { show: !r.data.showing });
      });
    },
    qc: function () {
      return run("pr.qcCheck").then(function (r) { showQc(r.data.issues, r.data.fps); return r; });
    },
  };

  function tc(sec, fps) {
    var f = Math.round(sec * fps), fr = f % Math.round(fps), s = Math.floor(f / Math.round(fps)), m = Math.floor(s / 60);
    return m + ":" + ("0" + (s % 60)).slice(-2) + ":" + ("0" + fr).slice(-2);
  }
  var TAGS = { gap: "Black", flash: "Flash", offline: "Offline", disabled: "Off", edges: "Edges", guides: "Guides" };
  function showQc(issues, fps) {
    var box = $("bQc"); box.innerHTML = "";
    $("bQcBox").hidden = false;
    $("bQcCount").textContent = issues.length ? "· " + issues.length : "";
    if (!issues.length) { box.innerHTML = '<div class="b-ok">All clear: no gaps, flash frames or offline media</div>'; return; }
    issues.forEach(function (it) {
      var b = document.createElement("button");
      b.className = "b-issue " + it.kind;
      b.innerHTML = '<span class="tc"></span><span class="t"></span><span class="tag"></span>';
      b.querySelector(".tc").textContent = tc(it.start, fps || 25);
      b.querySelector(".t").textContent = (it.track ? it.track + " · " : "") + it.text;
      b.querySelector(".tag").textContent = TAGS[it.kind] || it.kind;
      b.addEventListener("click", function () { run("pr.seek", { t: it.start }).catch(function () {}); });
      box.appendChild(b);
    });
  }

  render();
  if (!window.HaloBridge) {
    say("Open this panel in Premiere Pro to use the tools");
    showQc([{ kind: "gap", start: 12.4, text: "Black for 3 frames" }, { kind: "flash", start: 31.08, track: "V1", text: "B-roll 04: only 1 frame" },
      { kind: "offline", start: 48, track: "V2", text: "Logo.png is offline" }], 25);
  }
})();
