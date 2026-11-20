/* HaloCut Command — one keyboard-first list of everything HaloCut can do in Premiere Pro: installed effects and
 * transitions, HaloCut's ready-made looks, its tools, sharper versions of Premiere commands, and your own combos.
 * Plus the shortcuts you give any of them. Plain data and maths; the panel runs things.
 * © 2026 Imtayz Nayem */
(function (root) {
  var GROUPS = [{ id: "all", name: "All" }, { id: "effects", name: "Effects" }, { id: "transitions", name: "Transitions" },
    { id: "looks", name: "Looks" }, { id: "commands", name: "Commands" }, { id: "tools", name: "Tools" }, { id: "combos", name: "Combos" }];

  // Premiere commands, made a little sharper. Each runs a HaloCut tool in Premiere.
  var COMMANDS = [
    { id: "cmd:nudgeL1", name: "Nudge left 1 frame", hint: "Selected clips, sound and all", run: { tool: "pr.nudge", args: { frames: -1 } } },
    { id: "cmd:nudgeR1", name: "Nudge right 1 frame", hint: "Selected clips, sound and all", run: { tool: "pr.nudge", args: { frames: 1 } } },
    { id: "cmd:nudgeL5", name: "Nudge left 5 frames", hint: "Selected clips, sound and all", run: { tool: "pr.nudge", args: { frames: -5 } } },
    { id: "cmd:nudgeR5", name: "Nudge right 5 frames", hint: "Selected clips, sound and all", run: { tool: "pr.nudge", args: { frames: 5 } } },
    { id: "cmd:toPlayhead", name: "Move selection to the playhead", hint: "The earliest clip starts at the playhead", run: { tool: "pr.moveToPlayhead" } },
    { id: "cmd:gapHere", name: "Close the gap at the playhead", hint: "Only that gap, on every track", run: { tool: "pr.closeGapHere" } },
    { id: "cmd:deleteOff", name: "Delete switched-off clips", hint: "Every disabled clip in the sequence", run: { tool: "pr.deleteDisabled" } },
    { id: "cmd:nextMarker", name: "Go to next marker", hint: "Sequence markers", run: { tool: "pr.markerJump", args: { dir: 1 } } },
    { id: "cmd:prevMarker", name: "Go to previous marker", hint: "Sequence markers", run: { tool: "pr.markerJump", args: { dir: -1 } } },
    { id: "cmd:muteClips", name: "Mute the selected clips' sound", hint: "Switches their audio off or on", run: { tool: "pr.muteClips" } },
  ];

  // Everything in one list. src: { effects: { video, audio, transitions }, toolbar, grade, motion, trans, combos }
  function build(src) {
    var out = [], fx = src.effects || {};
    (fx.video || []).forEach(function (n) { out.push({ id: "fx:" + n, name: n, group: "effects", hint: "Video effect", run: { tool: "pr.effect", args: { name: n, kind: "video" } } }); });
    (fx.audio || []).forEach(function (n) { out.push({ id: "afx:" + n, name: n, group: "effects", hint: "Audio effect", run: { tool: "pr.effect", args: { name: n, kind: "audio" } } }); });
    (fx.transitions || []).forEach(function (n) { out.push({ id: "tr:" + n, name: n, group: "transitions", hint: "On the selected clips", run: { tool: "pr.transition", args: { name: n, seconds: 1 } } }); });
    if (src.trans) src.trans.TRANSITIONS.forEach(function (t) {
      out.push({ id: "cut:" + t.id, name: t.name + " (cut)", group: "transitions", hint: "HaloCut · on the cut at the playhead", run: { cut: t.id } });
    });
    if (src.grade) src.grade.LOOKS.forEach(function (l) {
      out.push({ id: "grade:" + l.id, name: "Grade · " + l.name, group: "looks", hint: "Lumetri Color on the selected clips", run: { grade: l.id } });
    });
    if (src.motion) src.motion.LOOKS.forEach(function (l) {
      out.push({ id: "motion:" + l.id, name: "Motion · " + l.name, group: "looks", hint: "Keyframes on the selected clips", run: { motion: l.id } });
    });
    COMMANDS.forEach(function (c) { out.push({ id: c.id, name: c.name, group: "commands", hint: c.hint, run: c.run }); });
    if (src.toolbar) src.toolbar.JOBS.forEach(function (j) {
      if (!j.tool) return; // the jobs that need their own panel stay in the Toolbar
      out.push({ id: "tool:" + j.id, name: j.name, group: "tools", hint: j.hint || "HaloCut tool", run: { tool: j.tool, args: src.toolbar.argsFor(j, {}) } });
    });
    (src.combos || []).forEach(function (c) { out.push({ id: "combo:" + c.id, name: c.name, group: "combos", hint: c.steps.length + " step" + (c.steps.length === 1 ? "" : "s"), run: { combo: c.steps } }); });
    return out;
  }

  // ---- search: exact, starts with, a word starts with it, anywhere, letters in order ----------------------
  function score(name, q) {
    var n = name.toLowerCase();
    if (n === q) return 0;
    if (n.indexOf(q) === 0) return 1;
    if ((" " + n.replace(/[^a-z0-9 ]/g, " ")).indexOf(" " + q) >= 0) return 2;
    if (n.indexOf(q) >= 0) return 3;
    var i = 0;
    for (var k = 0; k < n.length && i < q.length; k++) if (n[k] === q[i]) i++;
    return i === q.length ? 5 : -1;
  }
  // recent: ids, most recent first. With no query: recent ones, then the rest in group order.
  function search(items, query, group, recent, limit) {
    recent = recent || [];
    var pool = group && group !== "all" ? items.filter(function (it) { return it.group === group; }) : items;
    var words = String(query || "").toLowerCase().trim().split(/\s+/).filter(Boolean), ranked = [];
    pool.forEach(function (it, idx) {
      var total = 0, hay = it.name + " " + (it.hint || "");
      for (var w = 0; w < words.length; w++) {
        var s = score(it.name, words[w]);
        if (s < 0) { s = score(hay, words[w]); if (s < 0 || s === 5) return; s += 3; } // the hint counts, but less
        total += s;
      }
      var r = recent.indexOf(it.id);
      ranked.push({ it: it, s: total - (r >= 0 ? 1.5 - r * 0.05 : 0), idx: idx, r: r });
    });
    if (!words.length) ranked.sort(function (a, b) { return (a.r < 0 ? 1e9 : a.r) - (b.r < 0 ? 1e9 : b.r) || a.idx - b.idx; });
    else ranked.sort(function (a, b) { return a.s - b.s || a.it.name.length - b.it.name.length || a.idx - b.idx; });
    return ranked.slice(0, limit || 60).map(function (x) { return x.it; });
  }

  // ---- shortcuts ------------------------------------------------------------------------------------------
  var MODS = ["ctrl", "alt", "shift", "mod"];
  // A key event → "mod+shift+k". Letters and digits by their place on the keyboard, so any layout works.
  function keyOf(e, mac) {
    var code = e.code || "", k = null;
    if (/^Key[A-Z]$/.test(code)) k = code.slice(3).toLowerCase();
    else if (/^Digit\d$/.test(code)) k = code.slice(5);
    else if (/^F\d{1,2}$/.test(code)) k = code.toLowerCase();
    else k = { ArrowLeft: "left", ArrowRight: "right", ArrowUp: "up", ArrowDown: "down", Backslash: "\\", Slash: "/", Comma: ",", Period: ".",
      Semicolon: ";", Quote: "'", BracketLeft: "[", BracketRight: "]", Minus: "-", Equal: "=", Backquote: "`" }[code] || null;
    if (!k) return null;
    var mods = [];
    if (mac ? e.ctrlKey : false) mods.push("ctrl");
    if (e.altKey) mods.push("alt");
    if (e.shiftKey) mods.push("shift");
    if (mac ? e.metaKey : e.ctrlKey) mods.push("mod");
    // plain letters are for typing in the search box; a shortcut needs ⌘, ⌃ or ⌥ (or an F key)
    if (!/^f\d+$/.test(k) && mods.filter(function (m) { return m !== "shift"; }).length === 0) return null;
    return mods.concat([k]).join("+");
  }
  function label(keys, mac) {
    if (!keys) return "";
    var parts = keys.split("+"), k = parts.pop(), MAC = { ctrl: "⌃", alt: "⌥", shift: "⇧", mod: "⌘" }, WIN = { ctrl: "Ctrl", alt: "Alt", shift: "Shift", mod: "Ctrl" };
    var name = { left: "←", right: "→", up: "↑", down: "↓" }[k] || k.toUpperCase();
    var m = parts.sort(function (a, b) { return MODS.indexOf(a) - MODS.indexOf(b); }).map(function (p) { return (mac ? MAC : WIN)[p]; });
    return mac ? m.join("") + name : m.concat([name]).join("+");
  }
  // Give `id` the shortcut `keys`; whatever had it before loses it. → { map, took }
  function assign(map, id, keys) {
    var out = {}, took = null;
    for (var k in map) { if (k === keys) took = map[k]; else if (map[k] !== id) out[k] = map[k]; }
    if (keys) out[keys] = id;
    return { map: out, took: took !== id ? took : null };
  }
  function keysFor(map, id) { for (var k in map) if (map[k] === id) return k; return null; }

  // macOS key codes, so the panel can ask Premiere Pro to pass these keys to it while it has focus.
  var MAC_CODES = { a: 0, s: 1, d: 2, f: 3, h: 4, g: 5, z: 6, x: 7, c: 8, v: 9, b: 11, q: 12, w: 13, e: 14, r: 15, y: 16, t: 17, "1": 18, "2": 19, "3": 20, "4": 21, "6": 22, "5": 23,
    "=": 24, "9": 25, "7": 26, "-": 27, "8": 28, "0": 29, "]": 30, o: 31, u: 32, "[": 33, i: 34, p: 35, l: 37, j: 38, "'": 39, k: 40, ";": 41, "\\": 42, ",": 43, "/": 44,
    n: 45, m: 46, ".": 47, "`": 50, f1: 122, f2: 120, f3: 99, f4: 118, f5: 96, f6: 97, f7: 98, f8: 100, f9: 101, f10: 109, f11: 103, f12: 111, left: 123, right: 124, down: 125, up: 126 };
  function interest(map) {
    var out = [];
    for (var keys in map) {
      var p = keys.split("+"), k = p.pop(), code = MAC_CODES[k];
      if (code === undefined) continue;
      out.push({ keyCode: code, ctrlKey: p.indexOf("ctrl") >= 0, altKey: p.indexOf("alt") >= 0, shiftKey: p.indexOf("shift") >= 0, metaKey: p.indexOf("mod") >= 0 });
    }
    return out;
  }

  // ---- what actually runs ------------------------------------------------------------------------------------
  // Any command → the Premiere tools to run, in order: [{ tool, args, name }]. The panel runs these, and the
  // HaloCut app runs the very same list for a shortcut pressed anywhere in Premiere Pro.
  // ctx: { grade, motion, trans (the cores), fps, byId(id) }
  function steps(it, ctx) {
    var R = it.run, one = function (tool, args) { return [{ tool: tool, args: args || {}, name: it.name }]; };
    if (R.tool) return one(R.tool, R.args);
    if (R.grade) return one("pr.gradeLook", { values: ctx.grade.look(R.grade) });
    if (R.motion) {
      var L = ctx.motion.LOOKS.filter(function (l) { return l.id === R.motion; })[0];
      if (!L) throw new Error("No such look: " + R.motion);
      return one("pr.motionApply", { start: L.start, end: L.end, curve: ctx.motion.curve(L.ease, "forward", 120), timing: { mode: L.whole ? "whole" : "start", seconds: 0.8 } });
    }
    if (R.cut) return one("pr.transApply", { plan: ctx.trans.plan(R.cut, { frames: Math.max(2, Math.round(0.3 * (ctx.fps || 25))), strength: 1, dir: "left" }) });
    if (R.combo) {
      var out = [];
      R.combo.forEach(function (sid, i) {
        var sub = ctx.byId(sid);
        if (!sub) throw new Error("Step " + (i + 1) + " isn't available any more");
        if (sub.run.combo) throw new Error("Step " + (i + 1) + " is a combo itself: combos can't run combos");
        out = out.concat(steps(sub, ctx));
      });
      return out;
    }
    throw new Error("Nothing to run");
  }

  // ---- combos ---------------------------------------------------------------------------------------------
  function newCombo(name, steps) { return { id: "c" + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36), name: name || "My combo", steps: (steps || []).slice() }; }
  // Steps that no longer exist (an effect that was uninstalled) are kept but reported.
  function missing(combo, items) { var have = {}; items.forEach(function (it) { have[it.id] = 1; }); return combo.steps.filter(function (s) { return !have[s]; }); }
  function remember(recent, id) { return [id].concat(recent.filter(function (r) { return r !== id; })).slice(0, 12); }

  var api = { GROUPS: GROUPS, COMMANDS: COMMANDS, build: build, search: search, keyOf: keyOf, label: label, assign: assign, keysFor: keysFor,
    MAC_CODES: MAC_CODES, interest: interest, steps: steps, newCombo: newCombo, missing: missing, remember: remember };
  if (typeof module === "object" && module.exports) module.exports = api;
  // in the panels Node is switched on, so `module` exists there too: the page still needs the global
  if (typeof window !== "undefined") window.HaloCommand = api; else if (typeof module !== "object") root.HaloCommand = api;
})(typeof self !== "undefined" ? self : this);
