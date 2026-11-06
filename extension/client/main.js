/* HaloCut bridge — panel side.
 * Two roles share this file:
 *   "bridge" (bg.html, hidden, starts with the app): runs the commands the desktop app sends, via ExtendScript.
 *   "status" (index.html, the visible panel): only shows whether the app and the bridge are up. */
(function () {
  var PORT = 47820;
  var ROLE = window.EW_ROLE || "status";
  var cs = new CSInterface();
  var env = cs.getHostEnvironment();
  var appId = env.appId; // "PPRO" or "AEFT"
  var appName = appId === "PPRO" ? "Premiere Pro" : appId === "AEFT" ? "After Effects" : appId;
  var socket = null;
  var hostReady = false;

  function el(id) { return document.getElementById(id); }

  function setStatus(kind, text) {
    if (!el("status")) return;
    el("status").className = "status " + kind;
    el("statusText").textContent = text;
  }

  function log(name, res) {
    var ul = el("log");
    if (!ul) return;
    var li = document.createElement("li");
    li.className = res.ok ? "" : "fail";
    var a = document.createElement("span");
    a.textContent = name;
    var b = document.createElement("span");
    b.className = "msg";
    b.textContent = res.msg || (res.ok ? "done" : "failed");
    li.appendChild(a);
    li.appendChild(b);
    ul.insertBefore(li, ul.firstChild);
    while (ul.children.length > 12) ul.removeChild(ul.lastChild);
  }

  if (el("host")) el("host").textContent = "Bridge · " + appName;

  function host(script) {
    return new Promise(function (resolve) {
      cs.evalScript(script, function (out) { resolve(out); });
    });
  }

  function runTool(id, args) {
    var call = "EW.run(" + JSON.stringify(id) + "," + JSON.stringify(JSON.stringify(args || {})) + ")";
    return host(call).then(function (out) {
      try { return JSON.parse(out); }
      catch (e) { return { ok: false, msg: "Host said: " + out }; }
    });
  }

  function loadHost() {
    var jsxFolder = cs.getSystemPath(SystemPath.EXTENSION) + "/jsx";
    return host("$.evalFile(new File(" + JSON.stringify(jsxFolder + "/host.jsx") + "));" +
                "EW.load(" + JSON.stringify(jsxFolder) + ")");
  }

  function send(obj) {
    if (socket && socket.readyState === 1) socket.send(JSON.stringify(obj));
  }

  function connect() {
    if (socket) return;
    var ws;
    try { ws = new WebSocket("ws://127.0.0.1:" + PORT); }
    catch (e) { return; }
    socket = ws;

    ws.onopen = function () {
      setStatus("ok", "Connected to the HaloCut app");
      send({ type: "hello", role: ROLE, app: appId, appVersion: env.appVersion, panel: "0.1.1" });
      if (ROLE === "status") send({ type: "status?" });
    };
    ws.onclose = function () {
      if (socket === ws) socket = null; // the watchdog reconnects
      setStatus("bad", "HaloCut app is not running. Retrying…");
    };
    ws.onerror = function () { /* onclose follows */ };
    ws.onmessage = function (ev) {
      var msg;
      try { msg = JSON.parse(ev.data); } catch (e) { return; }
      if (msg.type === "run" && ROLE === "bridge") {
        runTool(msg.tool, msg.args).then(function (res) {
          send({ type: "result", id: msg.id, ok: res.ok, msg: res.msg, data: res.data });
        });
      } else if (msg.type === "status" && ROLE === "status") {
        var up = msg.bridge && msg.bridge[appId];
        setStatus(up ? "ok" : "bad", up
          ? "Ready: the Tool wheel works in " + appName
          : "App is running, but the " + appName + " bridge is not. Restart " + appName + ".");
      } else if (msg.type === "ran" && ROLE === "status" && msg.app === appId) {
        log(msg.label || msg.tool, msg);
        if (window.onHaloRan) window.onHaloRan(msg);
      }
    };
  }

  // A steady watchdog instead of chained retries: survives throttled timers in hidden panels.
  function start() {
    connect();
    setInterval(connect, 2000);
    if (ROLE === "status") setInterval(function () { send({ type: "status?" }); }, 3000);
  }

  // The Studio panel runs its own tools through this, without the HaloCut app.
  window.HaloBridge = { run: runTool, appId: appId };

  loadHost().then(function (out) {
    var res = {};
    try { res = JSON.parse(out); } catch (e) {}
    hostReady = !!res.ok;
    start();
    if (window.onHaloReady) window.onHaloReady(hostReady);
  });
})();
