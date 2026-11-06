/* HaloCut Studio — Effects tab: find any installed effect or transition by typing, apply it to the selection.
 * © 2026 Imtayz Nayem */
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var E = window.HaloEffectSearch;
  var items = null, shown = [], active = 0;

  function saved(key) { try { return JSON.parse(localStorage.getItem(key)) || []; } catch (e) { return []; } }
  function store(key, v) { try { localStorage.setItem(key, JSON.stringify(v)); } catch (e) {} }
  var same = function (a, b) { return a.name === b.name && a.kind === b.kind; };

  function load() {
    if (items) return Promise.resolve(items);
    if (!window.HaloBridge) { // outside Premiere (a browser preview): a few names so the layout can be seen
      items = ["Gaussian Blur", "Warp Stabilizer", "Lumetri Color", "Ultra Key", "Crop", "Drop Shadow"].map(function (n) { return { name: n, kind: "Video effect" }; })
        .concat([{ name: "Cross Dissolve", kind: "Transition" }, { name: "DeNoise", kind: "Audio effect" }]);
      $("eCount").textContent = "Preview: a few sample effects. In Premiere this lists every installed one.";
      return Promise.resolve(items);
    }
    return window.HaloBridge.run("pr.listEffects", {}).then(function (res) {
      if (!res.ok) { $("eCount").textContent = res.msg; return []; }
      var d = res.data, list = [];
      d.video.forEach(function (n) { list.push({ name: n, kind: "Video effect" }); });
      d.audio.forEach(function (n) { list.push({ name: n, kind: "Audio effect" }); });
      d.transitions.forEach(function (n) { list.push({ name: n, kind: "Transition" }); });
      items = list;
      $("eCount").textContent = d.video.length + " video effects · " + d.audio.length + " audio effects · " + d.transitions.length + " transitions";
      return items;
    });
  }

  function render() {
    var q = $("eQuery").value.trim(), pinned = saved("halocut.fxPinned");
    if (q) shown = E.rank(items || [], q, 40);
    else {
      shown = pinned.slice();
      saved("halocut.fxRecent").forEach(function (r) { if (!shown.some(function (x) { return same(x, r); })) shown.push(r); });
    }
    active = Math.min(active, Math.max(0, shown.length - 1));
    var box = $("eResults");
    box.innerHTML = "";
    shown.forEach(function (it, i) {
      var row = document.createElement("div");
      row.className = "result" + (i === active ? " on" : "");
      var name = document.createElement("b");
      if (pinned.some(function (p) { return same(p, it); })) { var star = document.createElement("i"); star.className = "pin"; star.textContent = "★"; name.appendChild(star); }
      name.appendChild(document.createTextNode(it.name));
      var kind = document.createElement("span");
      kind.textContent = it.kind;
      row.appendChild(name);
      row.appendChild(kind);
      row.addEventListener("mouseenter", function () { active = i; mark(); });
      row.addEventListener("click", function (ev) { apply(it, ev.shiftKey); });
      box.appendChild(row);
    });
    if (!shown.length && q) box.innerHTML = '<div class="result"><span>No effect matches “' + q.replace(/[<&]/g, "") + '”</span></div>';
  }

  function mark() {
    Array.prototype.forEach.call($("eResults").children, function (r, i) { r.classList.toggle("on", i === active); });
    var on = $("eResults").children[active];
    if (on && on.scrollIntoView) on.scrollIntoView({ block: "nearest" });
  }

  function remember(it, pin) {
    var recent = saved("halocut.fxRecent").filter(function (r) { return !same(r, it); });
    recent.unshift(it);
    store("halocut.fxRecent", recent.slice(0, 12));
    if (pin) {
      var p = saved("halocut.fxPinned");
      if (!p.some(function (x) { return same(x, it); })) { p.push(it); store("halocut.fxPinned", p); }
    }
  }

  function apply(it, pin) {
    var tool = it.kind === "Transition" ? "pr.transition" : "pr.effect";
    var args = it.kind === "Transition" ? { name: it.name } : { name: it.name, kind: it.kind === "Audio effect" ? "audio" : "video" };
    var done = function (res) {
      $("eAdded").hidden = false;
      $("eAdded").textContent = res.ok ? "↵ " + it.name + " added" + (pin ? " · pinned" : "") : res.msg;
      if (res.ok) { remember(it, pin); if (pin || !$("eQuery").value) render(); }
    };
    if (!window.HaloBridge) return done({ ok: true });
    window.HaloBridge.run(tool, args).then(done);
  }

  $("eQuery").addEventListener("input", function () { active = 0; render(); });
  $("eQuery").addEventListener("keydown", function (ev) {
    if (ev.key === "ArrowDown") { active = Math.min(shown.length - 1, active + 1); mark(); ev.preventDefault(); }
    else if (ev.key === "ArrowUp") { active = Math.max(0, active - 1); mark(); ev.preventDefault(); }
    else if (ev.key === "Enter" && shown[active]) { apply(shown[active], ev.shiftKey); ev.preventDefault(); }
    else if (ev.key === "Escape") { $("eQuery").value = ""; render(); }
  });

  window.onEffectsTab = function () {
    load().then(function () { render(); $("eQuery").focus(); });
  };
})();
