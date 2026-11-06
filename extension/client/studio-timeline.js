/* HaloCut Studio — Timeline tab: one-press jobs on the open sequence.
 * © 2026 Imtayz Nayem */
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var req = window.cep_node ? window.cep_node.require : window.require;

  function say(text, busy) {
    $("tSum").className = "sum" + (busy ? " busy" : "");
    $("tSumText").textContent = text;
  }

  function showZoom() { $("tZoomOut").textContent = $("tZoom").value + "%"; }
  $("tZoom").addEventListener("input", showZoom);

  function dir(name) {
    var fs = req("fs"), path = req("path"), os = req("os");
    var d = path.join(os.homedir(), "Documents", "HaloCut", name);
    fs.mkdirSync(d, { recursive: true });
    return d;
  }

  function osascript(lines, done) {
    var args = [];
    lines.forEach(function (l) { args.push("-e", l); });
    req("child_process").execFile("osascript", args, function (err, out) { done(err, String(out || "").trim()); });
  }

  function run(tool, args) {
    say("Working…", true);
    return window.HaloBridge.run(tool, args || {}).then(function (res) { say(res.msg); return res; });
  }

  // Premiere writes the PNG a moment after it is asked to; wait for it, then put it on the clipboard.
  function copyFrame() {
    if (process.platform !== "darwin") return say("Copy frame is macOS only for now");
    var path = req("path"), fs = req("fs");
    var file = path.join(dir("Frames"), "frame-" + Date.now() + ".png");
    run("pr.exportFrame", { file: file }).then(function (res) {
      if (!res.ok) return;
      say("Exporting the frame…", true);
      var tries = 0;
      (function wait() {
        var ok = false;
        try { ok = fs.statSync(file).size > 0; } catch (e) {}
        if (!ok) { if (++tries > 40) return say("Premiere didn't write the frame"); return setTimeout(wait, 150); }
        osascript(['set the clipboard to (read (POSIX file "' + file + '") as «class PNGf»)'], function (err) {
          say(err ? "Saved, but couldn't copy: " + file : "Frame copied · also saved in Documents/HaloCut/Frames");
        });
      })();
    });
  }

  // The clipboard picture as a PNG file (TIFF from Photoshop or Figma is converted), then onto the timeline.
  function pasteImage() {
    if (process.platform !== "darwin") return say("Paste image is macOS only for now");
    var path = req("path");
    var base = path.join(dir("Images"), "pasted-" + Date.now());
    var write = function (cls, file) {
      return ['try', 'set img to the clipboard as «class ' + cls + '»', 'on error', 'return "none"', 'end try',
        'set f to open for access (POSIX file "' + file + '") with write permission', 'set eof f to 0',
        'write img to f', 'close access f', 'return "ok"'];
    };
    say("Reading the clipboard…", true);
    osascript(write("PNGf", base + ".png"), function (err, out) {
      if (!err && out === "ok") return run("pr.placeImage", { file: base + ".png", seconds: 5 });
      osascript(write("TIFF", base + ".tiff"), function (err2, out2) {
        if (err2 || out2 !== "ok") return say("Copy a picture first");
        req("child_process").execFile("sips", ["-s", "format", "png", base + ".tiff", "--out", base + ".png"], function (err3) {
          if (err3) return say("Couldn't convert the picture");
          run("pr.placeImage", { file: base + ".png", seconds: 5 });
        });
      });
    });
  }

  var JOBS = {
    closeGaps: function () { run("pr.closeGaps"); },
    zoomIn: function () { run("pr.zoomAlternate", { factor: +$("tZoom").value / 100 }); },
    zoomBack: function () { run("pr.zoomAlternate", { factor: +$("tZoom").value / 100, back: true }); },
    copyFrame: copyFrame,
    pasteImage: pasteImage,
    unnest: function () { run("pr.unnest", { keepCopy: $("tCopy").checked }); },
  };

  Array.prototype.forEach.call(document.querySelectorAll("[data-job]"), function (b) {
    b.addEventListener("click", function () {
      if (!window.HaloBridge) return say("Still starting, try again");
      JOBS[b.dataset.job]();
    });
  });

  showZoom();
})();
