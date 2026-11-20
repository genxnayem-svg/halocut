/* HaloCut Studio — captions engine (Node). Transcribes on this computer with whisper.cpp,
 * keeps word timings, writes Hinglish in Roman letters with one spelling per word, and groups words into captions.
 * © 2026 Imtayz Nayem */
(function (root, factory) {
  // in the panels Node is switched on, so `module` exists there too: the page still needs the global
  if (typeof window !== "undefined") root.HaloCaptions = factory(window.cep_node ? window.cep_node.require : window.require);
  else module.exports = factory(require);
})(typeof self !== "undefined" ? self : this, function (req) {
  var cp = req("child_process");
  var fs = req("fs");
  var path = req("path");
  var os = req("os");

  var MODELS_DIR = path.join(os.homedir(), "Library", "Application Support", "HaloCut", "models");
  var MODELS = [
    { id: "small", file: "ggml-small.bin", name: "Small · accurate" },
    { id: "medium", file: "ggml-medium.bin", name: "Medium · most accurate" },
    { id: "base", file: "ggml-base.bin", name: "Base · fastest" },
  ];

  // Whisper follows the style of a short example: this one makes it write Hinglish in Roman letters
  // and keep English words in English, instead of translating or switching to Devanagari.
  var HINGLISH_PROMPT = "haan bhai, main aaj ek video bana raha hoon. yeh clip dekho, thoda zoom karo, phir cut kar dena. accha, theek hai.";

  var LANGUAGES = {
    hinglish: { name: "Hinglish (Roman letters)", whisper: "en", prompt: HINGLISH_PROMPT, normalise: true },
    hindi: { name: "Hindi (Devanagari)", whisper: "hi" },
    english: { name: "English", whisper: "en" },
    auto: { name: "Detect the language", whisper: "auto" },
  };

  // One spelling per word: how people usually type Hinglish. Only unambiguous variants;
  // English words are never in this list, so they are never changed.
  var SPELLING = {
    mai: "main", maine: "maine", hu: "hoon", hun: "hoon", hoo: "hoon",
    achha: "accha", acha: "accha", achchha: "accha", achcha: "accha", accha: "accha",
    bohot: "bahut", bahot: "bahut", bohat: "bahut", bhut: "bahut",
    karthe: "karte", karthi: "karti", kartha: "karta",
    parega: "padega", padhega: "padega", pare: "pade", parta: "padta", parti: "padti",
    nahin: "nahi", nai: "nahi", nahee: "nahi",
    yeh: "ye", woh: "wo", voh: "wo", vo: "wo",
    kyun: "kyun", kyon: "kyun", kiyon: "kyun", kyunki: "kyunki", kyuki: "kyunki", kyonki: "kyunki",
    thik: "theek", teek: "theek",
    jyada: "zyada", jada: "zyada", ziada: "zyada", zyaada: "zyada",
    kuchh: "kuch", kuchch: "kuch",
    jese: "jaise", jaisa: "jaisa", vaise: "waise", wese: "waise",
    pahle: "pehle", pehele: "pehle", pehla: "pehla",
    samaj: "samajh", samjh: "samajh",
    lekhin: "lekin", hamne: "humne", ham: "hum", apko: "aapko", aapka: "aapka", apka: "aapka",
    muje: "mujhe", mujhko: "mujhe", tuje: "tujhe", hamara: "humara", hamari: "humari",
    bilkool: "bilkul", khus: "khush", kush: "khush", sahee: "sahi", bahar: "bahar", andar: "andar",
    dekho: "dekho", dekhiye: "dekhiye", chalo: "chalo", raha: "raha", rahi: "rahi", rahe: "rahe",
  };
  // Two words that are one in Hinglish typing
  var JOIN = { "mai ne": "maine", "main ne": "maine", "ham ne": "humne", "hum ne": "humne", "tum ne": "tumne", "us ne": "usne", "jis ne": "jisne" };

  function findWhisper(extensionDir) {
    var list = [path.join(extensionDir || "", "bin", "whisper-cli"), "/opt/homebrew/bin/whisper-cli", "/usr/local/bin/whisper-cli"];
    for (var i = 0; i < list.length; i++) { try { if (fs.statSync(list[i]).isFile()) return list[i]; } catch (e) {} }
    return null;
  }

  function installedModels() {
    return MODELS.filter(function (m) { try { return fs.statSync(path.join(MODELS_DIR, m.file)).size > 1e7; } catch (e) { return false; } });
  }

  function run(bin, args, done) {
    var p = cp.spawn(bin, args), err = "";
    p.stderr.on("data", function (c) { err += c; });
    p.on("error", done);
    p.on("close", function (code) { done(code === 0 ? null : new Error(err.split("\n").filter(Boolean).slice(-2).join(" ") || "exit " + code)); });
  }

  // Transcribe [inSec, outSec] of a media file. Calls done(err, words) with words in seconds from inSec.
  function transcribe(o, done) {
    var tmp = path.join(os.tmpdir(), "halocut-cap-" + process.pid + "-" + Date.now());
    var wav = tmp + ".wav";
    run(o.ffmpeg, ["-v", "error", "-y", "-ss", String(o.inSec), "-t", String(Math.max(0.1, o.outSec - o.inSec)),
      "-i", o.file, "-vn", "-ac", "1", "-ar", "16000", wav], function (err) {
      if (err) return done(err);
      var lang = LANGUAGES[o.language] || LANGUAGES.hinglish;
      var args = ["-m", path.join(MODELS_DIR, o.model || "ggml-small.bin"), "-f", wav, "-l", lang.whisper, "-ojf", "-of", tmp, "-np"];
      // extraPrompt: more example text, e.g. fillers, so Whisper writes "um" instead of leaving it out
      var prompt = [lang.prompt, o.extraPrompt].filter(Boolean).join(" ");
      if (prompt) args.push("--prompt", prompt);
      run(o.whisper, args, function (err2) {
        try { fs.unlinkSync(wav); } catch (e) {}
        if (err2) return done(err2);
        var json;
        try { json = JSON.parse(fs.readFileSync(tmp + ".json", "utf8")); fs.unlinkSync(tmp + ".json"); }
        catch (e) { return done(new Error("Whisper gave no transcript")); }
        var words = wordsFrom(json);
        if (lang.normalise) words = normalise(words);
        done(null, applyFixes(words, o.fixes || {}));
      });
    });
  }

  // Whisper tokens -> words with start/end seconds. A token starting with a space begins a new word.
  function wordsFrom(json) {
    var words = [];
    (json.transcription || []).forEach(function (seg) {
      (seg.tokens || []).forEach(function (t) {
        var text = t.text || "";
        if (/^\[_.*_\]$/.test(text.trim()) || /^\[.*\]$/.test(text.trim())) return; // [_BEG_], [_TT_123]
        var start = (t.offsets ? t.offsets.from : 0) / 1000, end = (t.offsets ? t.offsets.to : 0) / 1000;
        var last = words[words.length - 1];
        if (/^\s/.test(text) || !last) words.push({ text: text.trim(), start: start, end: end });
        else { last.text += text; last.end = end; }
      });
    });
    return words.filter(function (w) { return w.text; });
  }

  function splitPunct(word) {
    var m = /^([^\p{L}\p{N}']*)([\p{L}\p{N}']+)([^\p{L}\p{N}']*)$/u.exec(word);
    return m ? { pre: m[1], core: m[2], post: m[3] } : { pre: "", core: word, post: "" };
  }

  function keepCase(src, dst) {
    if (src[0] && src[0] === src[0].toUpperCase() && src[0] !== src[0].toLowerCase()) return dst[0].toUpperCase() + dst.slice(1);
    return dst;
  }

  // Hinglish one-spelling pass.
  function normalise(words) {
    var out = [];
    for (var i = 0; i < words.length; i++) {
      var w = words[i], p = splitPunct(w.text), low = p.core.toLowerCase();
      var next = words[i + 1];
      if (next && !p.post) {
        var np = splitPunct(next.text), pair = low + " " + np.core.toLowerCase();
        if (JOIN[pair]) {
          out.push({ text: p.pre + keepCase(p.core, JOIN[pair]) + np.post, start: w.start, end: next.end, fixed: true });
          i++;
          continue;
        }
      }
      var fix = SPELLING[low];
      if (fix && fix !== low) out.push({ text: p.pre + keepCase(p.core, fix) + p.post, start: w.start, end: w.end, fixed: true });
      else out.push(w);
    }
    return out;
  }

  // "Remember this fix": your own replacements, applied to every new transcript.
  function applyFixes(words, fixes) {
    var keys = Object.keys(fixes);
    if (!keys.length) return words;
    return words.map(function (w) {
      var p = splitPunct(w.text), hit = fixes[p.core.toLowerCase()];
      return hit ? { text: p.pre + hit + p.post, start: w.start, end: w.end, fixed: true } : w;
    });
  }

  // Words -> caption lines: at most maxChars, at most maxSec long, a new line after a full stop or a pause.
  function group(words, opts) {
    opts = opts || {};
    var maxChars = opts.maxChars || 32, maxSec = opts.maxSec || 3, gap = opts.gap || 0.6;
    var lines = [], cur = null;
    words.forEach(function (w, i) {
      var prev = words[i - 1];
      var breakHere = !cur
        || (cur.text + " " + w.text).length > maxChars
        || w.end - cur.start > maxSec
        || (prev && w.start - prev.end > gap)
        || (prev && /[.?!।]$/.test(prev.text));
      if (breakHere) { cur = { start: w.start, end: w.end, text: w.text, words: [w] }; lines.push(cur); }
      else { cur.text += " " + w.text; cur.end = w.end; cur.words.push(w); }
    });
    return lines;
  }

  function srtTime(sec) {
    var ms = Math.max(0, Math.round(sec * 1000));
    var h = Math.floor(ms / 3600000), m = Math.floor(ms / 60000) % 60, s = Math.floor(ms / 1000) % 60, r = ms % 1000;
    var p = function (n, l) { n = String(n); while (n.length < l) n = "0" + n; return n; };
    return p(h, 2) + ":" + p(m, 2) + ":" + p(s, 2) + "," + p(r, 3);
  }

  function toSrt(lines) {
    return lines.map(function (l, i) {
      return (i + 1) + "\n" + srtTime(l.start) + " --> " + srtTime(Math.max(l.end, l.start + 0.3)) + "\n" + l.text + "\n";
    }).join("\n");
  }

  return {
    MODELS: MODELS, MODELS_DIR: MODELS_DIR, LANGUAGES: LANGUAGES, findWhisper: findWhisper, installedModels: installedModels,
    transcribe: transcribe, wordsFrom: wordsFrom, normalise: normalise, applyFixes: applyFixes, group: group, toSrt: toSrt,
  };
});
