/* HaloCut Studio — Guides tab: pick a platform, preview it at the sequence's size, put it on its own track.
 * © 2026 Imtayz Nayem */
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var G = window.HaloGuides;
  var frame = { w: 1080, h: 1920 };
  var current = G.PRESETS[1]; // Instagram Reels until we know the sequence
  var placed = false, showing = false;

  function opts() {
    return { zone: $("gZone").checked, ui: $("gUi").checked, centre: $("gCentre").checked, thirds: $("gThirds").checked, grid: $("gGrid").checked };
  }

  function preview() {
    // draw at full size, show scaled down: what you see is the picture that goes on the timeline
    G.draw($("gPreview"), current, frame.w, frame.h, opts());
    var c = $("gPreview"), box = 300;
    var k = Math.min(box / frame.h, ($("gPreview").parentNode.clientWidth - 16) / frame.w);
    c.style.width = Math.round(frame.w * k) + "px";
    c.style.height = Math.round(frame.h * k) + "px";
    var m = current.m, pct = function (v) { return Math.round(v * 100) + "%"; };
    $("gMargins").textContent = "Top " + pct(m[0]) + " · Bottom " + pct(m[1]) + " · Left " + pct(m[2]) + " · Right " + pct(m[3]);
    $("gFrame").textContent = frame.w + " × " + frame.h;
  }

  function presets() {
    var box = $("gPresets");
    box.innerHTML = "";
    G.forFrame(frame.w, frame.h).forEach(function (p) {
      var b = document.createElement("button");
      b.className = p.id === current.id ? "on" : "";
      b.innerHTML = p.name + "<small>" + (p.ratio === "any" ? "" : p.ratio) + "</small>";
      b.addEventListener("click", function () { current = p; presets(); preview(); });
      box.appendChild(b);
    });
  }

  function state(info) {
    placed = info.placed; showing = info.showing;
    $("gToggle").disabled = !placed;
    $("gRemove").disabled = !placed;
    $("gToggle").textContent = showing ? "Hide" : "Show";
    $("gWarn").hidden = !showing;
    $("gAdd").textContent = placed ? "Replace guides" : "Add guides";
  }

  function refresh() {
    if (!window.HaloBridge) return;
    window.HaloBridge.run("pr.guidesInfo", {}).then(function (res) {
      if (!res.ok) { $("gFrame").textContent = res.msg; return; }
      var first = frame.w !== res.data.w || frame.h !== res.data.h;
      frame = { w: res.data.w, h: res.data.h };
      if (first) current = G.forFrame(frame.w, frame.h)[0];
      presets(); preview(); state(res.data);
    });
  }

  // The picture goes in ~/Documents/HaloCut/Guides, one file per placement.
  function writePng() {
    var req = window.cep_node ? window.cep_node.require : window.require;
    var fs = req("fs"), path = req("path"), os = req("os");
    var dir = path.join(os.homedir(), "Documents", "HaloCut", "Guides");
    fs.mkdirSync(dir, { recursive: true });
    var file = path.join(dir, current.id + "-" + frame.w + "x" + frame.h + "-" + Date.now() + ".png");
    var data = $("gPreview").toDataURL("image/png").split(",")[1];
    fs.writeFileSync(file, Buffer.from(data, "base64"));
    return file;
  }

  function say(res) {
    $("gFrame").textContent = res.msg;
    setTimeout(refresh, 1800);
  }

  $("gAdd").addEventListener("click", function () {
    preview();
    var file;
    try { file = writePng(); } catch (e) { $("gFrame").textContent = "Could not save the picture: " + e.message; return; }
    window.HaloBridge.run("pr.guidesPlace", { file: file }).then(function (res) {
      say(res);
      if (res.ok) state({ placed: true, showing: true });
    });
  });
  $("gToggle").addEventListener("click", function () {
    window.HaloBridge.run("pr.guidesShow", { show: !showing }).then(function (res) {
      say(res);
      if (res.ok) state({ placed: true, showing: !showing });
    });
  });
  $("gRemove").addEventListener("click", function () {
    window.HaloBridge.run("pr.guidesRemove", {}).then(function (res) { say(res); if (res.ok) state({ placed: false, showing: false }); });
  });
  ["gZone", "gUi", "gCentre", "gThirds", "gGrid"].forEach(function (id) { $(id).addEventListener("change", preview); });

  window.onGuidesTab = function () { presets(); preview(); refresh(); };
})();
