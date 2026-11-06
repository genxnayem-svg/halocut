/* HaloCut Kit panel (After Effects): pick a rig and tune it, or tidy layers and the project.
 * © 2026 Imtayz Nayem */
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var K = window.HaloKit;
  var ALIGN = [
    { id: "left", name: "Left edges", svg: '<path d="M4 3v18M8 7h10v4H8zM8 14h6v4H8z"/>' },
    { id: "hcenter", name: "Centres across", svg: '<path d="M12 3v18M6 7h12v4H6zM8.5 14h7v4h-7z"/>' },
    { id: "right", name: "Right edges", svg: '<path d="M20 3v18M6 7h10v4H6zM10 14h6v4h-6z"/>' },
    { id: "distH", name: "Spread evenly across", svg: '<path d="M3 4v16M21 4v16M8 8h3v8H8zM14 8h3v8h-3z"/>' },
    { id: "top", name: "Top edges", svg: '<path d="M3 4h18M7 8v10h4V8zM14 8v6h4V8z"/>' },
    { id: "vcenter", name: "Centres down", svg: '<path d="M3 12h18M7 6v12h4V6zM14 8.5v7h4v-7z"/>' },
    { id: "bottom", name: "Bottom edges", svg: '<path d="M3 20h18M7 6v10h4V6zM14 10v6h4v-6z"/>' },
    { id: "distV", name: "Spread evenly down", svg: '<path d="M4 3h16M4 21h16M8 8h8v3H8zM8 14h8v3H8z"/>' },
  ];
  var st = { tab: "rigs", group: "Motion", rig: "wiggle", values: {}, alignTo: "selection", layers: [], confirm: null };

  function say(t, busy) { $("kSum").className = "sum" + (busy ? " busy" : ""); $("kSumText").textContent = t; }
  function run(tool, args) {
    if (!window.HaloBridge) return Promise.reject("Open this panel in After Effects");
    if (window.HaloBridge.appId && window.HaloBridge.appId !== "AEFT") return Promise.reject("HaloCut Kit is for After Effects");
    return window.HaloBridge.run(tool, args || {}).then(function (r) { if (!r.ok) throw r.msg; return r; });
  }
  function act(p, busy) { say(busy || "Working…", true); return p.then(function (r) { say(r.msg); return r; }).catch(function (m) { say(String(m)); }); }

  // ---- tabs -----------------------------------------------------------------------------------------
  $("kTabs").addEventListener("click", function (ev) {
    var t = ev.target.getAttribute && ev.target.getAttribute("data-tab"); if (!t) return;
    st.tab = t;
    var bs = $("kTabs").querySelectorAll("button");
    for (var i = 0; i < bs.length; i++) bs[i].className = bs[i].getAttribute("data-tab") === t ? "on" : "";
    var ps = document.querySelectorAll("[data-pane]");
    for (var j = 0; j < ps.length; j++) ps[j].hidden = ps[j].getAttribute("data-pane") !== t;
  });

  // ---- rigs -----------------------------------------------------------------------------------------
  var WHERE = { selected: "selected property", position: "Position", rotation: "Rotation", scale: "Scale", opacity: "Opacity", sourceText: "text" };
  function rigs() {
    var g = $("kGroups"); g.innerHTML = "";
    K.GROUPS.forEach(function (name) {
      var b = document.createElement("button"); b.textContent = name; b.className = name === st.group ? "on" : "";
      b.addEventListener("click", function () { st.group = name; var first = K.RIGS.filter(function (r) { return r.group === name; })[0]; pick(first.id); });
      g.appendChild(b);
    });
    var box = $("kRigs"); box.innerHTML = "";
    K.RIGS.filter(function (r) { return r.group === st.group; }).forEach(function (r) {
      var b = document.createElement("button"); b.className = "k-rig" + (r.id === st.rig ? " on" : "");
      b.innerHTML = "<b></b><small></small>";
      b.querySelector("b").textContent = r.name;
      b.querySelector("small").textContent = "on " + WHERE[r.target] + (r.target === "selected" ? ", or " + WHERE[r.fallback] : "");
      b.addEventListener("click", function () { pick(r.id); });
      box.appendChild(b);
    });
    controls();
  }
  function pick(id, values) {
    st.rig = id; st.group = K.rig(id).group;
    st.values = {};
    K.rig(id).controls.forEach(function (c) { st.values[c.key] = values && values[c.key] !== undefined ? values[c.key] : c.def; });
    rigs();
  }
  function controls() {
    var box = $("kControls"), r = K.rig(st.rig); box.innerHTML = "";
    if (!r.controls.length) { box.innerHTML = '<p class="hint small">No settings: it loops the keyframes you already have.</p>'; return; }
    r.controls.forEach(function (c) {
      var row = document.createElement("label"), name = document.createElement("span"), v = st.values[c.key];
      row.className = "row"; name.textContent = c.name; row.appendChild(name);
      if (c.type === "checkbox") {
        var cb = document.createElement("input"); cb.type = "checkbox"; cb.checked = !!v;
        cb.addEventListener("change", function () { st.values[c.key] = cb.checked ? 1 : 0; });
        row.appendChild(cb);
      } else if (c.type === "layer") {
        var sel = document.createElement("select");
        sel.add(new Option("None", "0"));
        st.layers.forEach(function (l) { sel.add(new Option(l.index + " · " + l.name, String(l.index))); });
        sel.value = String(v || 0);
        sel.addEventListener("focus", loadLayers);
        sel.addEventListener("change", function () { st.values[c.key] = +sel.value; });
        row.appendChild(sel);
      } else {
        var wrap = document.createElement("span"), range = document.createElement("input"), num = document.createElement("input");
        wrap.className = "inline";
        var max = c.type === "angle" ? 180 : Math.max(10, Math.abs(c.def) * 4), min = c.type === "angle" ? -180 : 0;
        range.type = "range"; range.min = min; range.max = max; range.step = max <= 10 ? 0.05 : 1; range.value = v;
        num.type = "number"; num.value = v; num.step = "any";
        range.addEventListener("input", function () { st.values[c.key] = +range.value; num.value = range.value; });
        num.addEventListener("change", function () { st.values[c.key] = +num.value; range.value = num.value; });
        wrap.appendChild(range); wrap.appendChild(num); row.appendChild(wrap);
      }
      box.appendChild(row);
    });
  }
  function loadLayers() {
    run("ae.kitLayers").then(function (r) { var had = st.layers.length; st.layers = r.data.layers; if (!had) controls(); }).catch(function () {});
  }

  $("kApply").addEventListener("click", function () { act(run("ae.rigApply", K.job(st.rig, st.values)), "Rigging…").then(scan); });
  $("kUpdate").addEventListener("click", function () {
    act(run("ae.rigUpdate", { controls: K.job(st.rig, st.values).controls.map(function (c) { return { name: c.name, value: c.value }; }) }), "Updating…");
  });
  $("kBake").addEventListener("click", function () { act(run("ae.rigBake", { id: st.rig }), "Baking into keyframes…").then(scan); });
  $("kRemove").addEventListener("click", function () { act(run("ae.rigRemove", { id: st.rig }), "Removing…").then(scan); });

  // what's already on the selected layers; click one to tune it
  function scan() {
    return run("ae.rigScan").then(function (r) {
      var box = $("kFound"); box.innerHTML = "";
      if (!r.data.rigs.length) { box.innerHTML = '<span class="muted small">' + (r.data.layers ? "No HaloCut rigs on the selected layers" : "Select layers, then Look") + "</span>"; return; }
      r.data.rigs.forEach(function (x) {
        var R = K.rig(x.id); if (!R) return;
        var b = document.createElement("button"), vals = {};
        R.controls.forEach(function (c) { var v = x.values[K.controlName(R, c)]; if (v !== undefined) vals[c.key] = typeof v === "number" ? Math.round(v * 1000) / 1000 : v; });
        b.innerHTML = "<span></span> <small></small>";
        b.querySelector("span").textContent = R.name; b.querySelector("small").textContent = x.layer + " › " + x.prop;
        b.addEventListener("click", function () { pick(x.id, vals); say(R.name + " on " + x.layer + " · change the sliders, then Update"); });
        box.appendChild(b);
      });
    }).catch(function (m) { say(String(m)); });
  }
  $("kScan").addEventListener("click", scan);

  // ---- layers -----------------------------------------------------------------------------------------
  function frames(id) { var el = $(id), out = $(id + "Out"); function show() { out.textContent = el.value + " fr"; } el.addEventListener("input", show); show(); }
  frames("kStep"); frames("kOverlap");
  $("kRename").addEventListener("click", function () {
    var pattern = $("kPattern").value.trim(), find = $("kFind").value;
    if (!pattern && !find) return say("Type a name pattern, or something to find");
    act(run("ae.kitRename", { pattern: pattern, find: find, replace: $("kReplace").value, start: +$("kStart").value, pad: +$("kPad").value }), "Renaming…");
  });
  $("kStagger").addEventListener("click", function () { act(run("ae.kitTime", { mode: "stagger", frames: +$("kStep").value, reverse: $("kReverse").checked })); });
  $("kSequence").addEventListener("click", function () { act(run("ae.kitTime", { mode: "sequence", overlap: +$("kOverlap").value, reverse: $("kReverse").checked })); });

  function alignTo() {
    var box = $("kAlignTo"); box.innerHTML = "";
    [{ id: "selection", name: "Selection" }, { id: "comp", name: "Comp" }].forEach(function (o) {
      var b = document.createElement("button"); b.textContent = o.name; b.className = o.id === st.alignTo ? "on" : "";
      b.addEventListener("click", function () { st.alignTo = o.id; alignTo(); });
      box.appendChild(b);
    });
  }
  ALIGN.forEach(function (a) {
    var b = document.createElement("button"); b.title = a.name; b.innerHTML = '<svg viewBox="0 0 24 24">' + a.svg + "</svg>";
    b.addEventListener("click", function () {
      act(run("ae.kitBoxes").then(function (r) {
        var boxes = r.data.boxes;
        if (!boxes.length) throw r.data.skipped ? "Those layers are parented or rotated: align works on plain 2D layers" : "Select layers";
        if (a.id.indexOf("dist") === 0 && boxes.length < 3) throw "Select three or more layers to spread";
        var moves = K.align(boxes, a.id, st.alignTo === "comp" && a.id.indexOf("dist") < 0 ? r.data.comp : null);
        return run("ae.kitMove", { moves: moves.map(function (m, i) { return { index: boxes[i].index, dx: m[0], dy: m[1] }; }) })
          .then(function (res) { if (r.data.skipped) res.msg += " · " + r.data.skipped + " parented or rotated left alone"; return res; });
      }), "Aligning…");
    });
    $("kAlign").appendChild(b);
  });

  // ---- project ----------------------------------------------------------------------------------------
  $("kTidy").addEventListener("click", function () { act(run("ae.kitTidy"), "Tidying the project…"); });
  $("kUnused").addEventListener("click", function () {
    if (st.confirm !== "unused") { st.confirm = "unused"; $("kUnused").textContent = "Click again to remove"; setTimeout(function () { st.confirm = null; $("kUnused").textContent = "Remove unused footage"; }, 3000); return; }
    st.confirm = null; $("kUnused").textContent = "Remove unused footage";
    act(run("ae.kitUnused"), "Removing unused footage…");
  });

  window.onHaloReady = function () { loadLayers(); };
  pick("wiggle"); alignTo();
  if (!window.HaloBridge) say("Open this panel in After Effects to use it");
})();
