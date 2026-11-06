/* HaloCut Kit (After Effects) — expression rigs with their own controls, written so the same text runs in
 * both of AE's expression engines (vector maths through add/sub/mul, no array + array).
 * Each expression starts with "// HaloCut rig: <id>" so the panel can find, retune, bake or remove it later.
 * © 2026 Imtayz Nayem */
(function (root) {
  // target: the property a rig goes on when none is selected ("selected" = any selected property)
  var RIGS = [
    { id: "wiggle", name: "Wiggle", group: "Motion", target: "selected", fallback: "position",
      controls: [{ key: "f", name: "Frequency", type: "slider", def: 2 }, { key: "a", name: "Amount", type: "slider", def: 30 }],
      body: "wiggle(C.f, C.a);" },
    { id: "jitter", name: "Stepped jitter", group: "Motion", target: "selected", fallback: "position",
      controls: [{ key: "j", name: "Jumps per second", type: "slider", def: 8 }, { key: "a", name: "Amount", type: "slider", def: 12 }],
      body: "posterizeTime(C.j);\nwiggle(C.j, C.a);" },
    { id: "float", name: "Float", group: "Motion", target: "position",
      controls: [{ key: "a", name: "Height", type: "slider", def: 12 }, { key: "s", name: "Speed", type: "slider", def: 0.5 }],
      body: "var t = time - inPoint, x = C.a * 0.3 * Math.sin(t * C.s * Math.PI), y = C.a * Math.sin(t * C.s * 2 * Math.PI);\nadd(value, value.length > 2 ? [x, y, 0] : [x, y]);" },
    { id: "orbit", name: "Orbit", group: "Motion", target: "position",
      controls: [{ key: "r", name: "Radius", type: "slider", def: 80 }, { key: "s", name: "Turns per second", type: "slider", def: 0.25 }],
      body: "var t = (time - inPoint) * C.s * 2 * Math.PI, x = C.r * Math.cos(t), y = C.r * Math.sin(t);\nadd(value, value.length > 2 ? [x, y, 0] : [x, y]);" },
    { id: "follow", name: "Follow the layer above", group: "Motion", target: "position",
      controls: [{ key: "d", name: "Delay (frames)", type: "slider", def: 4 }],
      body: "var L = index > 1 ? thisComp.layer(index - 1) : null;\nif (L) {\n  var p = L.transform.position;\n  add(p.valueAtTime(time - C.d * thisComp.frameDuration), sub(value, p.valueAtTime(inPoint)));\n} else value;" },
    { id: "lookat", name: "Look at a layer", group: "Motion", target: "rotation",
      controls: [{ key: "l", name: "Target", type: "layer", def: 0 }, { key: "o", name: "Offset", type: "angle", def: 0 }],
      body: "try {\n  var T = C.l, v = sub(T.toComp(T.anchorPoint), toComp(anchorPoint));\n  radiansToDegrees(Math.atan2(v[1], v[0])) + C.o;\n} catch (e) { value; }" },
    { id: "cycle", name: "Loop", group: "Loops", target: "selected", fallback: "position", controls: [], body: 'loopOut("cycle");' },
    { id: "pingpong", name: "Ping-pong", group: "Loops", target: "selected", fallback: "position", controls: [], body: 'loopOut("pingpong");' },
    { id: "offset", name: "Loop and keep going", group: "Loops", target: "selected", fallback: "position", controls: [], body: 'loopOut("offset");' },
    { id: "bounce", name: "Bounce after keys", group: "Loops", target: "selected", fallback: "position",
      controls: [{ key: "a", name: "Strength", type: "slider", def: 6 }, { key: "f", name: "Speed", type: "slider", def: 3 }, { key: "d", name: "Settle", type: "slider", def: 6 }],
      body: "var out = value;\nif (numKeys > 1) {\n  var k = nearestKey(time).index;\n  if (key(k).time > time) k--;\n  var t = k > 0 ? time - key(k).time : 0;\n  if (k > 0 && t > 0) {\n    var v = velocityAtTime(key(k).time - thisComp.frameDuration / 10);\n    out = add(value, mul(v, C.a / 100 * Math.sin(C.f * t * 2 * Math.PI) / Math.exp(C.d * t)));\n  }\n}\nout;" },
    { id: "spin", name: "Spin", group: "Rotate", target: "rotation",
      controls: [{ key: "s", name: "Degrees per second", type: "slider", def: 90 }], body: "value + (time - inPoint) * C.s;" },
    { id: "pendulum", name: "Pendulum", group: "Rotate", target: "rotation",
      controls: [{ key: "a", name: "Swing", type: "angle", def: 25 }, { key: "f", name: "Swings per second", type: "slider", def: 1 }, { key: "d", name: "Settle", type: "slider", def: 0.6 }],
      body: "var t = time - inPoint;\nvalue + C.a * Math.sin(t * C.f * 2 * Math.PI) * Math.exp(-C.d * t);" },
    { id: "pulse", name: "Pulse", group: "Scale", target: "scale",
      controls: [{ key: "a", name: "Amount %", type: "slider", def: 8 }, { key: "s", name: "Beats per second", type: "slider", def: 2 }],
      body: "mul(value, 1 + C.a / 100 * Math.sin((time - inPoint) * C.s * 2 * Math.PI));" },
    { id: "squash", name: "Squash and stretch", group: "Scale", target: "scale",
      controls: [{ key: "a", name: "Amount %", type: "slider", def: 15 }, { key: "f", name: "Speed", type: "slider", def: 3 }, { key: "d", name: "Settle", type: "slider", def: 3 }],
      body: "var t = time - inPoint, w = C.a / 100 * Math.sin(t * C.f * 2 * Math.PI) / Math.exp(C.d * t);\nvalue.length > 2 ? [value[0] * (1 + w), value[1] * (1 - w), value[2]] : [value[0] * (1 + w), value[1] * (1 - w)];" },
    { id: "blink", name: "Blink", group: "Opacity", target: "opacity",
      controls: [{ key: "r", name: "Blinks per second", type: "slider", def: 2 }, { key: "o", name: "On for %", type: "slider", def: 50 }],
      body: "((time - inPoint) * C.r) % 1 < C.o / 100 ? value : 0;" },
    { id: "fade", name: "Fade in and out", group: "Opacity", target: "opacity",
      controls: [{ key: "i", name: "Fade in (s)", type: "slider", def: 0.5 }, { key: "o", name: "Fade out (s)", type: "slider", def: 0.5 }],
      body: "var a = C.i > 0 ? linear(time, inPoint, inPoint + C.i, 0, 1) : 1, b = C.o > 0 ? linear(time, outPoint - C.o, outPoint, 1, 0) : 1;\nvalue * Math.min(a, b);" },
    { id: "counter", name: "Number counter", group: "Text", target: "sourceText",
      controls: [{ key: "a", name: "From", type: "slider", def: 0 }, { key: "b", name: "To", type: "slider", def: 1000 }, { key: "s", name: "Over (s)", type: "slider", def: 2 },
        { key: "d", name: "Decimals", type: "slider", def: 0 }, { key: "c", name: "Thousands commas", type: "checkbox", def: 1 }],
      body: "var n = C.s > 0 ? ease(time, inPoint, inPoint + C.s, C.a, C.b) : C.b, txt = n.toFixed(Math.max(0, Math.min(6, Math.round(C.d))));\nif (C.c) { var parts = txt.split(\".\"); parts[0] = parts[0].replace(/\\B(?=(\\d{3})+(?!\\d))/g, \",\"); txt = parts.join(\".\"); }\ntxt;" },
    { id: "typewriter", name: "Typewriter", group: "Text", target: "sourceText",
      controls: [{ key: "s", name: "Letters per second", type: "slider", def: 18 }, { key: "c", name: "Cursor", type: "checkbox", def: 1 }],
      body: "var all = String(value), n = Math.max(0, Math.floor((time - inPoint) * C.s));\nall.substr(0, n) + (C.c && n < all.length && Math.floor(time * 3) % 2 == 0 ? \"|\" : \"\");" },
    { id: "clock", name: "Clock", group: "Text", target: "sourceText",
      controls: [{ key: "s", name: "Start (s)", type: "slider", def: 0 }, { key: "d", name: "Count down", type: "checkbox", def: 0 }],
      body: "var t = C.d ? Math.max(0, C.s - (time - inPoint)) : C.s + time - inPoint, m = Math.floor(t / 60), sec = Math.floor(t % 60);\n(m < 10 ? \"0\" : \"\") + m + \":\" + (sec < 10 ? \"0\" : \"\") + sec;" },
    { id: "hold", name: "Choppy (fewer frames)", group: "Time", target: "selected", fallback: "position",
      controls: [{ key: "f", name: "Frames per second", type: "slider", def: 8 }], body: "posterizeTime(C.f);\nvalue;" },
  ];
  var GROUPS = ["Motion", "Loops", "Rotate", "Scale", "Opacity", "Text", "Time"];
  var TAG = "// HaloCut rig: ";
  var EFFECTS = { slider: "ADBE Slider Control", checkbox: "ADBE Checkbox Control", angle: "ADBE Angle Control", layer: "ADBE Layer Control" };

  function rig(id) { for (var i = 0; i < RIGS.length; i++) if (RIGS[i].id === id) return RIGS[i]; return null; }
  function controlName(r, c) { return "HaloCut " + r.name + " · " + c.name; }

  // The expression text: the tag, one line reading each control, then the body.
  function expression(r) {
    var lines = [TAG + r.id];
    if (r.controls.length) {
      lines.push("var C = {};");
      r.controls.forEach(function (c) { lines.push("C." + c.key + ' = effect("' + controlName(r, c) + '")(1);'); });
    }
    return lines.join("\n") + "\n" + r.body;
  }
  function rigOf(expr) { var m = /^\/\/ HaloCut rig: (\w+)/.exec(String(expr || "")); return m ? m[1] : null; }

  // What the host needs to put a rig on: { id, name, target, fallback, expr, controls: [{ name, effect, value }] }
  function job(id, values) {
    var r = rig(id); if (!r) return null;
    values = values || {};
    return { id: r.id, name: r.name, target: r.target, fallback: r.fallback || r.target, expr: expression(r),
      controls: r.controls.map(function (c) { return { name: controlName(r, c), effect: EFFECTS[c.type], type: c.type, value: values[c.key] !== undefined ? values[c.key] : c.def }; }) };
  }

  // Layer names from a pattern: {n} the number (zero-padded to `pad`), {name} the old name; then find → replace.
  function renamed(names, o) {
    o = o || {};
    var start = o.start === undefined ? 1 : o.start, pad = o.pad || 0;
    return names.map(function (old, i) {
      var n = String(start + i); while (n.length < pad) n = "0" + n;
      var s = o.pattern ? o.pattern.replace(/\{n\}/g, n).replace(/\{name\}/g, old) : old;
      if (o.find) s = s.split(o.find).join(o.replace || "");
      return s;
    });
  }

  // New in points: stagger (each `step` s after the one before) or sequence (end to end, `overlap` s shared).
  // layers: [{ inPoint, outPoint }] in the order to place them → [inPoint...]
  function timing(layers, o) {
    var out = [], base = layers.length ? layers[0].inPoint : 0;
    for (var i = 0; i < layers.length; i++) {
      if (o.mode === "sequence") out.push(i ? out[i - 1] + (layers[i - 1].outPoint - layers[i - 1].inPoint) - (o.overlap || 0) : base);
      else out.push(base + i * (o.step || 0));
    }
    return out;
  }

  // Moves for aligning boxes ({ x, y, w, h } in comp space) to a frame box, or spreading them evenly.
  function align(boxes, how, frame) {
    var f = frame || boxes.reduce(function (u, b) {
      return u ? { x: Math.min(u.x, b.x), y: Math.min(u.y, b.y), w: Math.max(u.x + u.w, b.x + b.w) - Math.min(u.x, b.x), h: Math.max(u.y + u.h, b.y + b.h) - Math.min(u.y, b.y) } : { x: b.x, y: b.y, w: b.w, h: b.h };
    }, null);
    if (how === "distH" || how === "distV") {
      var hz = how === "distH", order = boxes.map(function (b, i) { return i; }).sort(function (a, b) { return hz ? boxes[a].x - boxes[b].x : boxes[a].y - boxes[b].y; });
      var moves = boxes.map(function () { return [0, 0]; });
      if (boxes.length < 3) return moves;
      var c0 = centre(boxes[order[0]]), c1 = centre(boxes[order[order.length - 1]]);
      order.forEach(function (bi, k) {
        var want = (hz ? c0[0] : c0[1]) + ((hz ? c1[0] : c1[1]) - (hz ? c0[0] : c0[1])) * k / (order.length - 1), c = centre(boxes[bi]);
        moves[bi] = hz ? [want - c[0], 0] : [0, want - c[1]];
      });
      return moves;
    }
    return boxes.map(function (b) {
      switch (how) {
        case "left": return [f.x - b.x, 0];
        case "right": return [f.x + f.w - b.x - b.w, 0];
        case "hcenter": return [f.x + f.w / 2 - b.x - b.w / 2, 0];
        case "top": return [0, f.y - b.y];
        case "bottom": return [0, f.y + f.h - b.y - b.h];
        case "vcenter": return [0, f.y + f.h / 2 - b.y - b.h / 2];
      }
      return [0, 0];
    });
  }
  function centre(b) { return [b.x + b.w / 2, b.y + b.h / 2]; }

  // Which project folder an item belongs in, by kind and file type.
  var IMAGES = /\.(png|jpe?g|psd|ai|eps|tiff?|gif|svg|exr|webp|heic|bmp|tga|dpx)$/i, AUDIO = /\.(wav|mp3|aiff?|m4a|aac|flac|ogg)$/i;
  function folderFor(item) {
    if (item.kind === "comp") return "Comps";
    if (item.kind === "solid") return "Solids";
    if (IMAGES.test(item.file || "")) return "Images";
    if (AUDIO.test(item.file || "")) return "Audio";
    return "Footage";
  }

  var api = { RIGS: RIGS, GROUPS: GROUPS, TAG: TAG, EFFECTS: EFFECTS, rig: rig, controlName: controlName, expression: expression, rigOf: rigOf, job: job,
    renamed: renamed, timing: timing, align: align, folderFor: folderFor };
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.HaloKit = api;
})(typeof self !== "undefined" ? self : this);
