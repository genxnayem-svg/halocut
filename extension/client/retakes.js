/* HaloCut Retakes panel: listen, mark the fillers, stutters, false starts and mumbles, then cut them in sync.
 * © 2026 Imtayz Nayem */
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var R = window.HaloRetakes, C = window.HaloCaptions, SIL = window.HaloSilence;
  var req = window.cep_node ? window.cep_node.require : window.require;
  // example text with fillers in it, so Whisper writes them down instead of tidying them away
  var FILLER_PROMPT = "Umm, so, uh, I was, like, hmm, thinking. Uh, you know, umm, okay.";
  var FINDS = [
    { id: "retakes", kind: "retake", name: "False starts", note: "a sentence begun again" },
    { id: "sounds", kind: "sound", name: "Filler sounds", note: "um, uh, hmm" },
    { id: "stutters", kind: "stutter", name: "Stutters", note: "I I, b- but" },
    { id: "mumbles", kind: "mumble", name: "Mumbles", note: "sound with no words" },
    { id: "words", kind: "word", name: "Filler words", note: "like, you know…" },
  ];
  var COLORS = { retake: "#e8457c", sound: "#ff8a3d", stutter: "#ffd24a", word: "#36c2ff", mumble: "#a35bf0" };
  var st = { words: [], tracks: [], items: [], kept: {}, finds: saved("halocut.retakeFinds", { retakes: true, sounds: true, stutters: true, mumbles: true, words: false }),
    wordList: saved("halocut.retakeWords", R.FILLER_WORDS.join(", ")) };

  function saved(key, fallback) { try { var v = JSON.parse(localStorage.getItem(key)); return v === null ? fallback : v; } catch (e) { return fallback; } }
  function store(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) {} }
  function say(t, busy) { $("rSum").className = "sum" + (busy ? " busy" : ""); $("rSumText").textContent = t; }
  function plural(n, w) { return n + " " + w + (n === 1 ? "" : "s"); }
  function key(it) { return it.kind + "@" + it.start.toFixed(2); }

  // ---- finding ------------------------------------------------------------------------------------
  function findAll() {
    var f = st.finds, list = st.wordList.split(",").map(function (s) { return s.trim(); }).filter(Boolean);
    var items = R.find(st.words, { retakes: f.retakes, sounds: f.sounds, stutters: f.stutters, words: f.words, wordList: list });
    if (f.mumbles && st.tracks.length) items = items.concat(R.mumbles(st.words, st.tracks));
    items.sort(function (a, b) { return a.start - b.start; });
    items.forEach(function (it) { if (st.kept[key(it)]) it.on = false; });
    st.items = items;
    render();
  }

  function finds() {
    var box = $("rFinds"); box.innerHTML = "";
    FINDS.forEach(function (fd) {
      var row = document.createElement("label"), cb = document.createElement("input"), dot = document.createElement("i"), name = document.createElement("span"), n = document.createElement("b");
      row.className = "r-find"; cb.type = "checkbox"; cb.checked = !!st.finds[fd.id]; dot.style.background = COLORS[fd.kind];
      name.innerHTML = fd.name + " <small>" + fd.note + "</small>";
      var count = st.items.filter(function (it) { return it.kind === fd.kind; }).length;
      n.textContent = st.words.length ? String(count) : "";
      if (fd.id === "mumbles" && st.words.length && !st.tracks.length) { n.textContent = "—"; row.title = "Needs a fresh Listen, so HaloCut can hear the gaps"; }
      cb.addEventListener("change", function () { st.finds[fd.id] = cb.checked; store("halocut.retakeFinds", st.finds); findAll(); finds(); });
      row.appendChild(cb); row.appendChild(dot); row.appendChild(name); row.appendChild(n);
      box.appendChild(row);
    });
    $("rWordsRow").hidden = !st.finds.words;
  }
  $("rWordList").value = st.wordList;
  $("rWordList").addEventListener("change", function () { st.wordList = $("rWordList").value; store("halocut.retakeWords", st.wordList); findAll(); finds(); });

  // ---- the transcript, with the marked bits ----------------------------------------------------------------
  function tc(sec) { var m = Math.floor(sec / 60), s = sec - m * 60; return (m < 10 ? "0" : "") + m + ":" + (s < 10 ? "0" : "") + s.toFixed(0); }
  function render() {
    var box = $("rText"); box.innerHTML = "";
    if (!st.words.length) { box.hidden = $("rHint").hidden = true; summary(); return; }
    var starts = {}, mumbleAt = {};
    st.items.forEach(function (it) { if (it.kind === "mumble") (mumbleAt[it.from] = mumbleAt[it.from] || []).push(it); else starts[it.from] = it; });
    var lastStamp = -99;
    for (var i = 0; i < st.words.length; i++) {
      var w = st.words[i];
      if (w.start - lastStamp > 20) { var t = document.createElement("span"); t.className = "tc"; t.textContent = tc(w.start); box.appendChild(t); lastStamp = w.start; }
      (mumbleAt[i] || []).forEach(function (it) { box.appendChild(mark(it, "♪ sound")); box.appendChild(document.createTextNode(" ")); });
      var it = starts[i];
      if (it) { box.appendChild(mark(it, it.text)); box.appendChild(document.createTextNode(" ")); i = it.to - 1; continue; }
      var span = document.createElement("span"); span.className = "w"; span.textContent = w.text;
      span.addEventListener("click", seekTo.bind(null, w.start));
      box.appendChild(span); box.appendChild(document.createTextNode(" "));
    }
    box.hidden = $("rHint").hidden = false;
    summary();
  }
  function mark(it, text) {
    var s = document.createElement("span");
    s.className = "cut k-" + it.kind + (it.on ? "" : " off"); s.textContent = text;
    s.title = R.KINDS[it.kind] + (it.on ? " · will be cut (click to keep)" : " · kept (click to cut)");
    s.addEventListener("click", function () { it.on = !it.on; st.kept[key(it)] = !it.on; render(); });
    return s;
  }
  function seekTo(t) { if (window.HaloBridge) window.HaloBridge.run("pr.seek", { t: Math.max(0, t - 0.5) }); }

  function summary() {
    var rs = R.regions(st.words, st.items), on = st.items.filter(function (it) { return it.on; }).length;
    $("rCount").textContent = st.words.length ? "· " + plural(st.words.length, "word") : "";
    $("rCut").disabled = !rs.length;
    if (st.words.length) say(rs.length ? "Cutting " + plural(on, "bit") + " · " + R.total(rs).toFixed(1) + " s shorter" : "Nothing marked to cut");
  }

  // ---- listening ------------------------------------------------------------------------------------------
  function extensionDir() { try { return new CSInterface().getSystemPath(SystemPath.EXTENSION); } catch (e) { return ""; } }
  if (C) {
    Object.keys(C.LANGUAGES).forEach(function (k) { $("rLang").add(new Option(C.LANGUAGES[k].name, k)); });
    $("rLang").value = saved("halocut.capLang", "hinglish");
    var models = C.installedModels();
    models.forEach(function (m) { $("rModel").add(new Option(m.name, m.file)); });
    if (!models.length) { $("rModel").add(new Option("No speech model", "")); $("rListen").disabled = true; }
  } else { $("rLang").add(new Option("Languages load in Premiere", "")); $("rModel").add(new Option("—", "")); $("rListen").disabled = true; }
  $("rLang").addEventListener("change", function () { store("halocut.capLang", $("rLang").value); });

  function useWords(words, tracks, from) {
    st.words = words.map(function (w) { return { text: w.text, start: w.start, end: w.end }; }).sort(function (a, b) { return a.start - b.start; });
    st.tracks = tracks; st.kept = {};
    findAll(); finds();
    if (!st.words.length) say("No words in " + from);
  }

  function musicTracks(names) {
    var sel = $("rMusic"), was = sel.value; sel.innerHTML = "";
    sel.add(new Option("None", "-1"));
    names.forEach(function (n, i) { sel.add(new Option("A" + (i + 1) + (n && n !== "A" + (i + 1) ? " · " + n : ""), String(i))); });
    sel.value = was || "-1";
  }

  $("rListen").addEventListener("click", function () {
    var ff = SIL && SIL.findFfmpeg(saved("halocut.ffmpeg", null)), whisper = C.findWhisper(extensionDir());
    if (!ff) return say("FFmpeg not found on this computer");
    if (!whisper) return say("The speech engine is missing from HaloCut");
    say("Reading the timeline…", true);
    window.HaloBridge.run("pr.studioClips", {}).then(function (res) {
      if (!res.ok) return say(res.msg);
      musicTracks(res.data.audioTracks || []);
      var clips = res.data.clips, all = [], tracks = [], i = 0;
      (function next() {
        if (i >= clips.length) return useWords(all, tracks, plural(clips.length, "clip"));
        var clip = clips[i++];
        say("Listening to clip " + i + " of " + clips.length + "…", true);
        C.transcribe({ ffmpeg: ff, whisper: whisper, file: clip.path, inSec: clip.inPoint, outSec: clip.outPoint, language: $("rLang").value,
          model: $("rModel").value, fixes: saved("halocut.fixes", {}), extraPrompt: FILLER_PROMPT }, function (err, got) {
          if (err) return say("Clip " + i + ": " + err.message);
          got.forEach(function (w) { all.push({ text: w.text, start: clip.start + w.start, end: clip.start + w.end }); });
          say("Hearing the gaps in clip " + i + "…", true);
          SIL.readLevels(ff, clip.path, clip.inPoint, clip.outPoint, function (err2, levels) {
            if (!err2) tracks.push({ start: clip.start, levels: levels });
            next();
          });
        });
      })();
    });
  });

  $("rLast").addEventListener("click", function () {
    if (!req) return say("Open this panel in Premiere Pro");
    var path = req("path"), os = req("os"), fs = req("fs");
    try {
      var d = JSON.parse(fs.readFileSync(path.join(os.homedir(), "Library", "Application Support", "HaloCut", "last-transcript.json"), "utf8"));
      useWords(d.words || [], [], "Studio");
      if (window.HaloBridge) window.HaloBridge.run("pr.studioClips", {}).then(function (r) { if (r.ok) musicTracks(r.data.audioTracks || []); });
    } catch (e) { say("No Studio words yet: run Captions in HaloCut Studio first"); }
  });

  // ---- cutting ------------------------------------------------------------------------------------------------
  $("rCut").addEventListener("click", function () {
    var regions = R.regions(st.words, st.items);
    if (!regions.length) return;
    var music = +$("rMusic").value;
    $("rCut").disabled = true;
    say("Cutting " + plural(regions.length, "bit") + "…", true);
    window.HaloBridge.run("pr.studioCut", { regions: regions, keepCopy: $("rCopy").checked, skipAudio: music >= 0 ? [music] : [], noun: "bit" }).then(function (res) {
      if (!res.ok) { $("rCut").disabled = false; return say(res.msg); }
      // the timeline moved: these word times are out of date now
      st.words = []; st.items = []; st.tracks = []; render(); finds();
      say("Done · " + res.msg + " · Listen again to look for more");
    });
  });

  // a stand-in transcript in the browser preview, so the layout can be seen
  if (!window.HaloBridge) {
    var t = 0.5, demo = "so today I want to so today I want to show you um the new panel and and how it uh works you know it is really fast".split(" ").map(function (w) { var o = { text: w, start: t, end: t + 0.3 }; t += 0.36; return o; });
    useWords(demo, [], "the stand-in");
    say("A stand-in transcript: open this panel in Premiere Pro to use yours");
  } else finds();
})();
