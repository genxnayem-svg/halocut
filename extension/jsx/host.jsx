// HaloCut bridge — host side (ExtendScript, ES3).
// Loaded by the panel's ScriptPath in both Premiere Pro and After Effects.
// The panel calls EW.run("<tool id>", "<args as JSON text>") and gets back a JSON string.

var EW = EW || {};

(function () {
  function esc(s) {
    s = String(s);
    var out = "";
    for (var i = 0; i < s.length; i++) {
      var c = s.charAt(i), code = s.charCodeAt(i);
      if (c === '"') out += '\\"';
      else if (c === "\\") out += "\\\\";
      else if (c === "\n") out += "\\n";
      else if (c === "\r") out += "\\r";
      else if (c === "\t") out += "\\t";
      else if (code < 32) out += " ";
      else out += c;
    }
    return out;
  }

  // Tiny JSON.stringify for plain data (ExtendScript has no JSON object).
  EW.stringify = function (v) {
    if (v === null || v === undefined) return "null";
    var t = typeof v;
    if (t === "number") return isFinite(v) ? String(v) : "null";
    if (t === "boolean") return v ? "true" : "false";
    if (t === "string") return '"' + esc(v) + '"';
    if (Object.prototype.toString.call(v) === "[object Array]") {
      var a = [];
      for (var i = 0; i < v.length; i++) a.push(EW.stringify(v[i]));
      return "[" + a.join(",") + "]";
    }
    var parts = [];
    for (var k in v) if (v.hasOwnProperty(k)) parts.push('"' + esc(k) + '":' + EW.stringify(v[k]));
    return "{" + parts.join(",") + "}";
  };

  EW.parse = function (text) {
    if (!text) return {};
    return eval("(" + text + ")"); // text comes only from our own panel
  };

  EW.ok = function (msg, data) { return { ok: true, msg: msg || "", data: data }; };
  EW.fail = function (msg) { return { ok: false, msg: msg }; };

  EW.appId = function () {
    var n = BridgeTalk.appName;
    if (n === "premierepro") return "PPRO";
    if (n === "aftereffects") return "AEFT";
    return n;
  };

  EW.tools = {};

  EW.run = function (id, argsText) {
    var res;
    try {
      var fn = EW.tools[id];
      if (!fn) res = EW.fail("Unknown tool: " + id);
      else res = fn(EW.parse(argsText)) || EW.ok();
    } catch (e) {
      res = EW.fail((e && e.message ? e.message : String(e)) + (e && e.line ? " (line " + e.line + ")" : ""));
    }
    return EW.stringify(res);
  };

  // Load the command file for whichever app we're running in.
  EW.load = function (jsxFolder) {
    var file = EW.appId() === "PPRO" ? "premiere.jsx" : "aftereffects.jsx";
    $.evalFile(new File(jsxFolder + "/" + file));
    return EW.stringify(EW.ok("loaded " + file, { app: EW.appId(), version: app.version }));
  };
})();
