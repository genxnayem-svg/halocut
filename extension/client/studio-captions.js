/* HaloCut Studio — Captions tab: transcribe the selected clips, fix words, put captions on the timeline.
 * © 2026 Imtayz Nayem */
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var C = window.HaloCaptions, S = window.HaloSilence;
  var req = window.cep_node ? window.cep_node.require : window.require;
  var words = [], lines = [], sequenceName = "Sequence";

  // ---- settings ----------------------------------------------------------------
  function saved(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) || fallback; } catch (e) { return fallback; } }
  function store(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) {} }

  Object.keys(C.LANGUAGES).forEach(function (k) { $("cLang").add(new Option(C.LANGUAGES[k].name, k)); });
  $("cLang").value = saved("halocut.capLang", "hinglish");
  $("cLang").addEventListener("change", function () { store("halocut.capLang", $("cLang").value); });

  function fillModels() {
    var sel = $("cModel"), have = C.installedModels();
    sel.innerHTML = "";
    if (!have.length) { sel.add(new Option("No model installed", "")); $("cGo").disabled = true; return; }
    have.forEach(function (m) { sel.add(new Option(m.name, m.file)); });
    $("cGo").disabled = false;
  }

  $("cChars").value = saved("halocut.capChars", 32);
  function showChars() { $("cCharsOut").textContent = $("cChars").value; }
  $("cChars").addEventListener("input", function () { showChars(); store("halocut.capChars", +$("cChars").value); regroup(); });

  function say(text, busy) {
    $("cSum").className = "sum" + (busy ? " busy" : "");
    $("cSumText").textContent = text;
  }

  // ---- transcribe ----------------------------------------------------------------
  function extensionDir() { try { return new CSInterface().getSystemPath(SystemPath.EXTENSION); } catch (e) { return ""; } }

  $("cGo").addEventListener("click", function () {
    var ff = S.findFfmpeg((function () { try { return localStorage.getItem("halocut.ffmpeg"); } catch (e) { return null; } })());
    var whisper = C.findWhisper(extensionDir());
    if (!ff) return say("FFmpeg not found on this computer");
    if (!whisper) return say("The speech engine is missing from HaloCut");
    say("Reading the timeline…", true);
    window.HaloBridge.run("pr.studioClips", {}).then(function (res) {
      if (!res.ok) return say(res.msg);
      sequenceName = res.data.sequence || "Sequence";
      var clips = res.data.clips, all = [], i = 0;
      (function next() {
        if (i >= clips.length) {
          words = all.sort(function (a, b) { return a.start - b.start; });
          keepForStyles();
          regroup();
          return;
        }
        var clip = clips[i++];
        say("Listening to clip " + i + " of " + clips.length + "…", true);
        C.transcribe({
          ffmpeg: ff, whisper: whisper, file: clip.path, inSec: clip.inPoint, outSec: clip.outPoint,
          language: $("cLang").value, model: $("cModel").value, fixes: saved("halocut.fixes", {}),
        }, function (err, got) {
          if (err) { say("Clip " + i + ": " + err.message); return; }
          got.forEach(function (w) { all.push({ text: w.text, start: clip.start + w.start, end: clip.start + w.end, fixed: w.fixed }); });
          next();
        });
      })();
    });
  });

  // The words go to a file too, so HaloCut Caption Styles can use them without listening again.
  function keepForStyles() {
    try {
      var fs = req("fs"), path = req("path"), os = req("os"), dir = path.join(os.homedir(), "Library", "Application Support", "HaloCut");
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, "last-transcript.json"), JSON.stringify({ sequence: sequenceName, saved: new Date().toISOString(), words: words }));
    } catch (e) {}
  }

  // ---- transcript ----------------------------------------------------------------
  function tc(sec) {
    var m = Math.floor(sec / 60), s = sec - m * 60;
    return (m < 10 ? "0" : "") + m + ":" + (s < 10 ? "0" : "") + s.toFixed(1);
  }

  function regroup() {
    if (!words.length) return;
    lines = C.group(words, { maxChars: +$("cChars").value });
    render();
  }

  function render() {
    var box = $("cLines");
    box.innerHTML = "";
    lines.forEach(function (l) {
      var row = document.createElement("div");
      row.className = "line";
      var t = document.createElement("span");
      t.className = "tc";
      t.textContent = tc(l.start);
      var txt = document.createElement("div");
      txt.className = "txt";
      txt.contentEditable = "true";
      l.words.forEach(function (w, k) {
        var span = document.createElement("span");
        if (w.fixed) { span.className = "fixed"; span.title = "Spelling made consistent"; }
        span.textContent = w.text;
        txt.appendChild(span);
        if (k < l.words.length - 1) txt.appendChild(document.createTextNode(" "));
      });
      txt.addEventListener("blur", function () { l.text = txt.innerText.replace(/\s+/g, " ").trim(); });
      txt.addEventListener("mouseup", function () {
        var sel = String(window.getSelection()).trim();
        if (sel && sel.length < 40) { $("cFrom").value = sel; $("cTo").focus(); }
      });
      row.appendChild(t);
      row.appendChild(txt);
      box.appendChild(row);
    });
    box.hidden = !lines.length;
    $("cFix").hidden = !lines.length;
    $("cSave").disabled = $("cAdd").disabled = !lines.length;
    say(lines.length + " captions · " + words.length + " words");
  }

  // ---- fixes -----------------------------------------------------------------------
  function escapeRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

  $("cReplace").addEventListener("click", function () {
    var from = $("cFrom").value.trim(), to = $("cTo").value.trim();
    if (!from || !to) return;
    var re = new RegExp("(^|[^\\p{L}\\p{N}])" + escapeRe(from) + "(?=$|[^\\p{L}\\p{N}])", "giu");
    var n = 0;
    lines.forEach(function (l) { l.text = l.text.replace(re, function (m, pre) { n++; return pre + to; }); });
    // single words also change underneath, so regrouping keeps the fix
    if (from.indexOf(" ") < 0) words.forEach(function (w) { if (w.text.toLowerCase().replace(/[^\p{L}\p{N}']/gu, "") === from.toLowerCase()) { w.text = w.text.replace(new RegExp(escapeRe(from), "i"), to); w.fixed = true; } });
    if ($("cRemember").checked && from.indexOf(" ") < 0) {
      var fixes = saved("halocut.fixes", {});
      fixes[from.toLowerCase()] = to;
      store("halocut.fixes", fixes);
    }
    lines.forEach(function (l) { l.words = l.text.split(" ").map(function (t) { return { text: t, fixed: false }; }); });
    render();
    say("Replaced " + n + "×" + ($("cRemember").checked ? " · remembered for next time" : ""));
  });

  // ---- out ---------------------------------------------------------------------------
  function writeSrt() {
    var fs = req("fs"), path = req("path"), os = req("os");
    var dir = path.join(os.homedir(), "Documents", "HaloCut", "Captions");
    fs.mkdirSync(dir, { recursive: true });
    var safe = sequenceName.replace(/[^\w\- ]+/g, "").trim() || "Sequence";
    var file = path.join(dir, safe + " " + new Date().toISOString().slice(0, 16).replace(/[T:]/g, "-") + ".srt");
    fs.writeFileSync(file, C.toSrt(lines), "utf8");
    return file;
  }

  $("cSave").addEventListener("click", function () {
    try { var f = writeSrt(); say("Saved " + f.split("/").slice(-3).join("/")); } catch (e) { say("Could not save: " + e.message); }
  });

  $("cAdd").addEventListener("click", function () {
    var file;
    try { file = writeSrt(); } catch (e) { return say("Could not save: " + e.message); }
    say("Adding captions…", true);
    window.HaloBridge.run("pr.captionsPlace", { file: file }).then(function (res) { say(res.msg); });
  });

  showChars();
  fillModels();
})();
