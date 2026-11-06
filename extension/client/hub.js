/* HaloCut: every tool in one panel (Window → Extensions → HaloCut).
 * On each tool page the title becomes a switcher; hub.html is the home with every tool. The panel opens on the
 * tool you used last. Each tool can still open in a panel of its own, to dock two side by side.
 * © 2026 Imtayz Nayem */
(function () {
  var TOOLS = {
    PPRO: [
      { page: "toolbar.html", id: "toolbar", name: "Toolbar", hint: "One-click jobs, search, pins on 1–9, QC check" },
      { page: "command.html", id: "command", name: "Command", hint: "Search and run anything, shortcuts, combos" },
      { page: "index.html", id: "bridge", name: "Studio", hint: "Silence and more" },
      { page: "grade.html", id: "grade", name: "Grade", hint: "Click-to-grade with scopes, onto Lumetri Color" },
      { page: "motion.html", id: "motion", name: "Motion", hint: "Start look, end look, eased keyframes" },
      { page: "trans.html", id: "trans", name: "Transitions", hint: "Keyframed transitions on cuts" },
      { page: "zoom.html", id: "zoom", name: "Zoom", hint: "Zooms, focus, callouts for screen recordings" },
      { page: "split.html", id: "split", name: "Split", hint: "Split screens and reframes as a new sequence" },
      { page: "styles.html", id: "styles", name: "Caption Styles", hint: "Animated, timed captions on the video" },
      { page: "retakes.html", id: "retakes", name: "Retakes", hint: "Fillers, stutters and false starts, cut in sync" },
      { page: "podcast.html", id: "podcast", name: "Podcast", hint: "Cameras follow the voices, music dips under them" },
      { page: "beat.html", id: "beat", name: "Beat", hint: "Tempo, beat markers, cuts and pulses" },
      { page: "markers.html", id: "markers", name: "Markers", hint: "Chapters, files and cuts from markers" },
      { page: "bins.html", id: "bins", name: "Bins", hint: "Tidy the Project panel" },
    ],
    AEFT: [
      { page: "kit.html", id: "kit", name: "Kit", hint: "Expression rigs and layer tools" },
      { page: "type.html", id: "type", name: "Type", hint: "Kinetic type from text animators" },
      { page: "accent.html", id: "accent", name: "Accents", hint: "Motion accents as animated shape layers" },
      { page: "vector.html", id: "vector", name: "Vector", hint: "SVG into native shape layers" },
      { page: "flow.html", id: "flow", name: "Flow", hint: "Transitions between layers" },
      { page: "resize.html", id: "resize", name: "Resize", hint: "One comp into other sizes" },
    ],
  };
  var HUB_ID = "com.samistudio.halocut.hub", KEY = "halocut.hub.last.";

  function cs() { try { return window.__adobe_cep__ && window.CSInterface ? new CSInterface() : null; } catch (e) { return null; } }
  function page() { return decodeURIComponent(location.pathname.split("/").pop() || "hub.html"); }
  function find(h, p) { for (var i = 0; i < TOOLS[h].length; i++) if (TOOLS[h][i].page === p) return TOOLS[h][i]; return null; }
  function host() {
    var c = cs();
    if (c) { try { var n = c.getHostEnvironment().appName; if (TOOLS[n]) return n; } catch (e) {} }
    var q = /[?&]host=(PPRO|AEFT)/.exec(location.search);
    if (q) return q[1];
    return find("AEFT", page()) ? "AEFT" : "PPRO";
  }
  // In the one HaloCut panel (or a browser preview), rather than a tool's own panel
  function inHub() { var c = cs(); if (!c) return true; try { return c.getExtensionID() === HUB_ID; } catch (e) { return true; } }
  function remember(h, p) { try { localStorage.setItem(KEY + h, p); } catch (e) {} }
  function last(h) { try { return localStorage.getItem(KEY + h); } catch (e) { return null; } }
  function go(p) {
    var q = cs() ? null : /[?&](host=(PPRO|AEFT))/.exec(location.search); // a browser preview keeps its app
    location.href = p + (q ? (p.indexOf("?") >= 0 ? "&" : "?") + q[1] : "");
  }
  function openOwn(t) { var c = cs(); if (c) c.requestOpenExtension("com.samistudio.halocut." + t.id, ""); }
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text) e.textContent = text; return e; }

  // A row for a tool: its name and what it does; in the HaloCut panel, a button to open it in a panel of its own
  function row(t, cls, onPick) {
    var r = el("div", cls), txt = el("div", "hub-txt");
    txt.appendChild(el("b", "", t.name)); txt.appendChild(el("small", "", t.hint));
    r.appendChild(txt);
    r.addEventListener("click", function () { onPick(t); });
    if (cs() && inHub()) {
      var own = el("button", "hub-own", "⧉");
      own.title = "Open " + t.name + " in a panel of its own, to dock it beside this one";
      own.addEventListener("click", function (e) { e.stopPropagation(); openOwn(t); });
      r.appendChild(own);
    }
    return r;
  }

  // ---- a tool page: the title opens a menu of every tool
  function switcher(h, cur) {
    var name = document.querySelector("header .name");
    if (!name) return;
    name.classList.add("hub-name");
    name.title = "Switch to another HaloCut tool";
    name.appendChild(el("span", "hub-chev", "▾"));
    var menu = el("div", "hub-menu");
    menu.hidden = true;
    TOOLS[h].forEach(function (t) {
      menu.appendChild(row(t, "hub-item" + (t.page === cur.page ? " on" : ""), function (x) { if (x.page !== cur.page) go(x.page); else close(); }));
    });
    var all = el("div", "hub-item hub-all", "All tools");
    all.addEventListener("click", function () { go("hub.html?home=1"); });
    menu.appendChild(all);
    document.body.appendChild(menu);
    function close() { menu.hidden = true; name.classList.remove("open"); }
    name.addEventListener("click", function (e) {
      e.stopPropagation();
      if (!menu.hidden) return close();
      var r = name.getBoundingClientRect(), below = (name.closest("header") || name).getBoundingClientRect();
      menu.style.top = Math.round(below.bottom + 4 + window.scrollY) + "px";
      menu.style.left = Math.round(r.left) + "px";
      menu.hidden = false; name.classList.add("open");
    });
    document.addEventListener("click", function (e) { if (!menu.hidden && !menu.contains(e.target)) close(); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !menu.hidden) { e.stopPropagation(); close(); } }, true);
  }

  // ---- the home: every tool for this app
  function home(h) {
    var grid = document.getElementById("hubGrid");
    if (!grid) return;
    var cur = last(h);
    TOOLS[h].forEach(function (t) { grid.appendChild(row(t, "hub-card" + (t.page === cur ? " on" : ""), function (x) { go(x.page); })); });
    var name = document.getElementById("hubHost");
    if (name) name.textContent = (h === "AEFT" ? "After Effects" : "Premiere Pro") + " · " + TOOLS[h].length + " tools";
  }

  function start() {
    var h = host(), p = page();
    if (p === "hub.html") {
      var to = last(h);
      // straight to the tool you used last, unless you asked for the home
      if (!/[?&]home=1/.test(location.search) && to && find(h, to)) { location.replace(to + (cs() ? "" : location.search)); return; }
      home(h);
      return;
    }
    var cur = find(h, p);
    if (!cur) return;
    if (inHub()) remember(h, p);
    switcher(h, cur);
  }

  window.HaloHub = { TOOLS: TOOLS, HUB_ID: HUB_ID };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
