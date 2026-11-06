/* HaloCut Resize panel (After Effects): pick sizes, check each layer's rule, make the versions.
 * © 2026 Imtayz Nayem */
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var R = window.HaloResize;
  var COLORS = { fill: "#3a3442", fit: "#36c2ff", pin: "#ff8a3d", keep: "#c084fc" };
  var st = { info: null, sizes: saved("halocut.resizeSizes", ["9x16", "1x1", "4x5"]), custom: saved("halocut.resizeCustom", []), rules: {} };

  function saved(key, fallback) { try { var v = JSON.parse(localStorage.getItem(key)); return v === null ? fallback : v; } catch (e) { return fallback; } }
  function store(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) {} }
  function say(t, busy) { $("zSum").className = "sum" + (busy ? " busy" : ""); $("zSumText").textContent = t; }
  function run(tool, args) {
    if (!window.HaloBridge) return Promise.reject("Open this panel in After Effects");
    if (window.HaloBridge.appId && window.HaloBridge.appId !== "AEFT") return Promise.reject("HaloCut Resize is for After Effects");
    return window.HaloBridge.run(tool, args || {}).then(function (r) { if (!r.ok) throw r.msg; return r; });
  }

  function allSizes() { return R.SIZES.concat(st.custom.map(function (c) { return { id: c.w + "x" + c.h + "c", name: c.w + "×" + c.h, note: "Your size", w: c.w, h: c.h, custom: true }; })); }
  function from() { return st.info ? { w: st.info.w, h: st.info.h } : { w: 1920, h: 1080 }; }
  function same(sz) { var f = from(); return sz.w === f.w && sz.h === f.h; }
  function chosen() { return allSizes().filter(function (s) { return st.sizes.indexOf(s.id) >= 0 && !same(s); }); }

  // ---- sizes ---------------------------------------------------------------------------------------
  function sizes() {
    var box = $("zSizes"); box.innerHTML = "";
    allSizes().forEach(function (s) {
      var l = document.createElement("label"), cb = document.createElement("input"), t = document.createElement("span");
      l.className = "r-size" + (same(s) ? " same" : ""); cb.type = "checkbox"; cb.checked = st.sizes.indexOf(s.id) >= 0 && !same(s); cb.disabled = same(s);
      t.innerHTML = "<b></b><small></small>"; t.querySelector("b").textContent = s.name; t.querySelector("small").textContent = same(s) ? "The master's own size" : s.note + " · " + s.w + "×" + s.h;
      cb.addEventListener("change", function () {
        st.sizes = st.sizes.filter(function (x) { return x !== s.id; }); if (cb.checked) st.sizes.push(s.id);
        store("halocut.resizeSizes", st.sizes); previews(); ready();
      });
      l.appendChild(cb); l.appendChild(t); box.appendChild(l);
    });
  }
  $("zAdd").addEventListener("click", function () {
    var w = Math.round(+$("zW").value), h = Math.round(+$("zH").value);
    if (!(w >= 16 && h >= 16 && w <= 8192 && h <= 8192)) return say("Width and height from 16 to 8192");
    if (!st.custom.some(function (c) { return c.w === w && c.h === h; })) st.custom.push({ w: w, h: h });
    st.sizes.push(w + "x" + h + "c"); store("halocut.resizeCustom", st.custom); store("halocut.resizeSizes", st.sizes);
    $("zW").value = $("zH").value = ""; sizes(); previews(); ready();
  });

  // ---- layers and their rules -------------------------------------------------------------------------
  function ruleFor(l) { return st.rules[l.index] || R.ruleOf(l.comment, l.box, from()); }
  function layers() {
    var box = $("zLayers"); box.innerHTML = "";
    if (!st.info) { box.innerHTML = '<p class="hint small">Read the open comp to see its layers</p>'; return; }
    st.info.layers.forEach(function (l) {
      var row = document.createElement("div"), name = document.createElement("div");
      row.className = "r-layer";
      name.innerHTML = "<b></b><small></small>"; name.querySelector("b").textContent = l.index + " · " + l.name;
      if (l.parented) name.querySelector("small").textContent = "Follows its parent";
      else if (l.kind === "camera" || l.kind === "light") name.querySelector("small").textContent = "Moves with the frame";
      else if (!l.box) name.querySelector("small").textContent = "Rotated: kept from the middle";
      row.appendChild(name);
      if (!l.parented && l.kind !== "camera" && l.kind !== "light") {
        var chips = document.createElement("div"), cur = l.box ? ruleFor(l) : "keep";
        chips.className = "chips";
        R.RULES.forEach(function (r) {
          var b = document.createElement("button"); b.className = r.id === cur ? "on" : "";
          b.innerHTML = '<i style="background:' + COLORS[r.id] + '"></i>' + r.name;
          b.addEventListener("click", function () {
            st.rules[l.index] = r.id; l.comment = R.tagged(l.comment, r.id);
            run("ae.resizeRule", { index: l.index, comment: l.comment }).catch(function (m) { say(String(m)); });
            layers(); previews();
          });
          chips.appendChild(b);
        });
        row.appendChild(chips);
      }
      box.appendChild(row);
    });
  }

  // ---- previews: every size as a little frame with the layers where they will land -------------------------
  function frame(size, label, place) {
    var wrap = document.createElement("div"), c = document.createElement("canvas"), t = document.createElement("span");
    var H = 92, W = Math.round(H * size.w / size.h); if (W > 150) { W = 150; H = Math.round(W * size.h / size.w); }
    var dpr = window.devicePixelRatio || 1; c.width = W * dpr; c.height = H * dpr; c.style.width = W + "px"; c.style.height = H + "px";
    wrap.className = "r-preview"; t.textContent = label; wrap.appendChild(c); wrap.appendChild(t);
    var g = c.getContext("2d"), k = W * dpr / size.w; g.setTransform(k, 0, 0, k, 0, 0);
    place(g, k);
    return wrap;
  }
  function previews() {
    var box = $("zPreviews"); box.innerHTML = "";
    var f = from(), ls = (st.info ? st.info.layers : demoLayers()).slice().reverse(); // bottom layer first
    function paint(size) {
      return function (g, k) {
        ls.forEach(function (l) {
          if (!l.box || l.parented) return;
          var rule = ruleFor(l), b = size === f ? l.box : R.placeBox(l.box, l.box.at, R.plan(rule, l.box, f, size));
          g.fillStyle = COLORS[rule]; g.globalAlpha = rule === "fill" ? 1 : 0.85; g.fillRect(b.x, b.y, b.w, b.h); g.globalAlpha = 1;
        });
        g.strokeStyle = "rgba(255,255,255,.35)"; g.lineWidth = 1 / k;
        var gd = R.guides(size);
        if ($("zGuides").checked && size !== f) { g.setLineDash([3 / k, 3 / k]); gd.vertical.forEach(function (x) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, size.h); g.stroke(); }); gd.horizontal.forEach(function (y) { g.beginPath(); g.moveTo(0, y); g.lineTo(size.w, y); g.stroke(); }); }
      };
    }
    box.appendChild(frame(f, "Master " + f.w + "×" + f.h, paint(f)));
    chosen().forEach(function (s) { box.appendChild(frame(s, s.name, paint(s))); });
  }
  $("zGuides").addEventListener("change", previews);
  function demoLayers() { // a stand-in comp for the browser preview, top layer first like AE lists them
    return [{ index: 1, box: { x: 1700, y: 50, w: 170, h: 80, at: [1785, 90] }, comment: "" }, { index: 2, box: { x: 610, y: 470, w: 700, h: 140, at: [960, 540] }, comment: "" },
      { index: 3, box: { x: 80, y: 880, w: 520, h: 110, at: [340, 935] }, comment: "" }, { index: 4, box: { x: 0, y: 0, w: 1920, h: 1080, at: [960, 540] }, comment: "" }];
  }

  // ---- After Effects -----------------------------------------------------------------------------------------
  function read() {
    say("Reading the comp…", true);
    return run("ae.resizeInfo").then(function (r) {
      st.info = r.data; st.rules = {};
      $("zName").textContent = r.data.name; $("zSize").textContent = r.data.w + "×" + r.data.h + " · " + r.data.layers.length + " layers";
      sizes(); layers(); previews(); ready();
      say("Check the rules, pick the sizes, then Make");
    }).catch(function (m) { say(String(m)); });
  }
  $("zRead").addEventListener("click", read);
  function ready() { $("zMake").disabled = !st.info || !chosen().length; }

  $("zMake").addEventListener("click", function () {
    var f = from(), jobs = chosen().map(function (s) {
      return { name: R.versionName(st.info.name, s), w: s.w, h: s.h, guides: $("zGuides").checked ? R.guides(s) : null,
        layers: st.info.layers.filter(function (l) { return !l.parented; }).map(function (l) {
          var rule = l.kind === "camera" || l.kind === "light" || !l.box ? "keep" : ruleFor(l), a = R.affine(rule, l.box || { x: 0, y: 0, w: f.w, h: f.h }, f, s);
          return { index: l.index, k: a.k, m: a.m, bx: a.bx, by: a.by };
        }) };
    });
    say("Making " + jobs.length + " sizes…", true);
    run("ae.resizeMake", { sizes: jobs, queue: $("zQueue").checked }).then(function (r) { say(r.msg); }).catch(function (m) { say(String(m)); });
  });

  window.onHaloReady = function () { read(); };
  sizes(); layers(); previews();
  if (!window.HaloBridge) say("A stand-in comp: open this panel in After Effects to use yours");
})();
