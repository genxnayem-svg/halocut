// HaloCut — After Effects commands.
// Each tool is one undo step. Menu-command tools use AE's English menu names.

(function () {
  var T = EW.tools;

  function comp() {
    var c = app.project.activeItem;
    if (!c || !(c instanceof CompItem)) throw new Error("Open a composition first");
    return c;
  }

  function layers(c, need) {
    var sel = c.selectedLayers;
    if (need && !sel.length) throw new Error("Select a layer");
    return sel;
  }

  function plural(n, word) { return n + " " + word + (n === 1 ? "" : "s"); }

  // Run fn inside one undo group; return its result.
  function undoable(name, fn) {
    return function (a) {
      app.beginUndoGroup("HaloCut: " + name);
      try { return fn(a || {}); }
      finally { app.endUndoGroup(); }
    };
  }

  function menu(name) {
    var id = app.findMenuCommandId(name);
    if (!id) throw new Error("Menu command not found: " + name);
    app.executeCommand(id);
  }

  function menuTool(name, needLayer) {
    return function () {
      var c = comp();
      if (needLayer) layers(c, true);
      menu(name);
      return EW.ok(name.replace(/\.\.\.$/, ""));
    };
  }

  // Selected properties that can hold keyframes or expressions.
  function selectedProps(c) {
    var out = [], ls = layers(c, true);
    for (var i = 0; i < ls.length; i++) {
      var ps = ls[i].selectedProperties;
      for (var j = 0; j < ps.length; j++) {
        if (ps[j].propertyType === PropertyType.PROPERTY) out.push(ps[j]);
      }
    }
    return out;
  }

  function easeDims(prop) {
    var t = prop.propertyValueType;
    if (prop.isSpatial) return 1;
    if (t === PropertyValueType.TwoD) return 2;
    if (t === PropertyValueType.ThreeD) return 3;
    return 1;
  }

  function ease(mode) {
    return undoable("Easy ease", function () {
      var props = selectedProps(comp()), keys = 0;
      for (var i = 0; i < props.length; i++) {
        var p = props[i], ks = p.selectedKeys;
        var dims = easeDims(p), arr = [];
        for (var d = 0; d < dims; d++) arr.push(new KeyframeEase(0, 33.333));
        for (var k = 0; k < ks.length; k++) {
          var inE = mode === "out" ? p.keyInTemporalEase(ks[k]) : arr;
          var outE = mode === "in" ? p.keyOutTemporalEase(ks[k]) : arr;
          p.setTemporalEaseAtKey(ks[k], inE, outE);
          keys++;
        }
      }
      if (!keys) return EW.fail("Select keyframes");
      return EW.ok("Eased " + plural(keys, "key"));
    });
  }

  function expression(label, expr) {
    return undoable(label, function () {
      var props = selectedProps(comp()), n = 0;
      for (var i = 0; i < props.length; i++) {
        if (props[i].canSetExpression) { props[i].expression = expr; n++; }
      }
      if (!n) return EW.fail("Select a property, e.g. Position");
      return EW.ok(label + " on " + n + (n === 1 ? " property" : " properties"));
    });
  }

  // Layer bounds in its own space (text/shape aware).
  function bounds(layer, t) {
    if (layer.sourceRectAtTime) {
      var r = layer.sourceRectAtTime(t, false);
      return { l: r.left, t: r.top, w: r.width, h: r.height };
    }
    return { l: 0, t: 0, w: layer.width, h: layer.height };
  }

  // Move the anchor to a spot in the layer (0..1, 0..1) without the layer moving on screen.
  function setAnchor(layer, fx, fy, t) {
    var tr = layer.property("ADBE Transform Group");
    var ap = tr.property("ADBE Anchor Point"), pos = tr.property("ADBE Position");
    var sc = tr.property("ADBE Scale").valueAtTime(t, false);
    var rot = tr.property("ADBE Rotate Z").valueAtTime(t, false) * Math.PI / 180;
    var b = bounds(layer, t);
    var oldA = ap.valueAtTime(t, false);
    var nx = b.l + b.w * fx, ny = b.t + b.h * fy;
    var dx = (nx - oldA[0]) * sc[0] / 100, dy = (ny - oldA[1]) * sc[1] / 100;
    var rx = dx * Math.cos(rot) - dy * Math.sin(rot);
    var ry = dx * Math.sin(rot) + dy * Math.cos(rot);
    var newA = oldA.length === 3 ? [nx, ny, oldA[2]] : [nx, ny];
    if (ap.numKeys) ap.setValueAtTime(t, newA); else ap.setValue(newA);
    if (!pos.dimensionsSeparated) {
      var p = pos.valueAtTime(t, false);
      var np = p.length === 3 ? [p[0] + rx, p[1] + ry, p[2]] : [p[0] + rx, p[1] + ry];
      if (pos.numKeys) {
        for (var k = 1; k <= pos.numKeys; k++) {
          var kv = pos.keyValue(k);
          pos.setValueAtKey(k, kv.length === 3 ? [kv[0] + rx, kv[1] + ry, kv[2]] : [kv[0] + rx, kv[1] + ry]);
        }
      } else pos.setValue(np);
    }
  }

  function newLayerAbove(c, layer) {
    var sel = c.selectedLayers;
    if (sel.length) {
      var top = sel[0];
      for (var i = 1; i < sel.length; i++) if (sel[i].index < top.index) top = sel[i];
      layer.moveBefore(top);
      layer.inPoint = top.inPoint;
      layer.outPoint = top.outPoint;
    }
    return layer;
  }

  // ---- Tools ---------------------------------------------------------------

  T["ping"] = function () {
    var c = app.project.activeItem;
    return EW.ok("pong", { app: "AEFT", comp: c && c instanceof CompItem ? c.name : null });
  };

  // Comp & layers
  T["ae.precompose"] = undoable("Pre-compose", function () {
    var c = comp(), ls = layers(c, true), idx = [];
    for (var i = 0; i < ls.length; i++) idx.push(ls[i].index);
    var name = (ls.length === 1 ? ls[0].name : c.name) + " comp";
    c.layers.precompose(idx, name, true);
    return EW.ok("Pre-composed " + plural(idx.length, "layer"));
  });

  T["ae.precomposeEach"] = undoable("Pre-compose each", function () {
    var c = comp(), ls = layers(c, true), n = ls.length, idx = [];
    for (var i = 0; i < n; i++) idx.push(ls[i].index);
    idx.sort(function (a, b) { return b - a; }); // bottom first keeps indices valid
    for (var j = 0; j < idx.length; j++) {
      c.layers.precompose([idx[j]], c.layer(idx[j]).name + " comp", true);
    }
    return EW.ok("Pre-composed " + plural(n, "layer") + " separately");
  });

  T["ae.splitLayer"] = menuTool("Split Layer", true);
  T["ae.duplicate"] = menuTool("Duplicate", true);
  T["ae.freezeFrame"] = menuTool("Freeze Frame", true);
  T["ae.timeReverse"] = menuTool("Time-Reverse Layer", true);
  T["ae.fitToComp"] = menuTool("Fit to Comp", true);
  T["ae.fitWidth"] = menuTool("Fit to Comp Width", true);
  T["ae.fitHeight"] = menuTool("Fit to Comp Height", true);
  T["ae.trimToWorkArea"] = menuTool("Trim Comp to Work Area", false);

  T["ae.timeRemap"] = undoable("Time remap", function () {
    var ls = layers(comp(), true), n = 0;
    for (var i = 0; i < ls.length; i++) if (ls[i].canSetTimeRemapEnabled) { ls[i].timeRemapEnabled = true; n++; }
    return n ? EW.ok("Time remap on " + plural(n, "layer")) : EW.fail("These layers can't be time-remapped");
  });

  // New layers
  T["ae.newNull"] = undoable("New null", function () {
    var c = comp(), l = c.layers.addNull(c.duration);
    newLayerAbove(c, l);
    return EW.ok("Null added");
  });

  T["ae.nullParent"] = undoable("Null + parent", function () {
    var c = comp(), ls = layers(c, true), t = c.time;
    var sx = 0, sy = 0;
    for (var i = 0; i < ls.length; i++) {
      var p = ls[i].property("ADBE Transform Group").property("ADBE Position").valueAtTime(t, false);
      sx += p[0]; sy += p[1];
    }
    var nul = c.layers.addNull(c.duration);
    nul.name = "Null " + (ls.length === 1 ? ls[0].name : "group");
    nul.property("ADBE Transform Group").property("ADBE Position").setValue([sx / ls.length, sy / ls.length]);
    newLayerAbove(c, nul);
    for (var j = 0; j < ls.length; j++) if (!ls[j].parent) ls[j].parent = nul;
    return EW.ok("Null + parent for " + plural(ls.length, "layer"));
  });

  T["ae.newAdjustment"] = undoable("Adjustment layer", function () {
    var c = comp();
    var l = c.layers.addSolid([1, 1, 1], "Adjustment Layer", c.width, c.height, c.pixelAspect, c.duration);
    l.adjustmentLayer = true;
    newLayerAbove(c, l);
    return EW.ok("Adjustment layer added");
  });

  T["ae.newSolid"] = undoable("New solid", function (a) {
    var c = comp(), col = a.color || [0.1, 0.1, 0.12];
    var l = c.layers.addSolid(col, "Solid", c.width, c.height, c.pixelAspect, c.duration);
    newLayerAbove(c, l);
    return EW.ok("Solid added");
  });

  T["ae.newText"] = undoable("New text", function (a) {
    var c = comp(), l = c.layers.addText(a.text || "Text");
    l.property("ADBE Transform Group").property("ADBE Position").setValue([c.width / 2, c.height / 2]);
    newLayerAbove(c, l);
    return EW.ok("Text layer added");
  });

  T["ae.newShape"] = undoable("New shape", function () {
    var c = comp(), l = c.layers.addShape();
    newLayerAbove(c, l);
    return EW.ok("Shape layer added");
  });

  T["ae.newCamera"] = undoable("New camera", function () {
    var c = comp();
    c.layers.addCamera("Camera", [c.width / 2, c.height / 2]);
    return EW.ok("Camera added");
  });

  // Anchor & position
  T["ae.anchor"] = undoable("Move anchor", function (a) {
    var c = comp(), ls = layers(c, true);
    var fx = a.x === undefined ? 0.5 : a.x, fy = a.y === undefined ? 0.5 : a.y;
    for (var i = 0; i < ls.length; i++) setAnchor(ls[i], fx, fy, c.time);
    return EW.ok("Anchor moved on " + plural(ls.length, "layer"));
  });

  T["ae.centerLayer"] = undoable("Centre in comp", function () {
    var c = comp(), ls = layers(c, true), n = 0;
    for (var i = 0; i < ls.length; i++) {
      var l = ls[i];
      if (l.parent) continue;
      setAnchor(l, 0.5, 0.5, c.time);
      var pos = l.property("ADBE Transform Group").property("ADBE Position");
      if (pos.dimensionsSeparated) continue;
      var p = pos.valueAtTime(c.time, false);
      var np = p.length === 3 ? [c.width / 2, c.height / 2, p[2]] : [c.width / 2, c.height / 2];
      if (pos.numKeys) pos.setValueAtTime(c.time, np); else pos.setValue(np);
      n++;
    }
    return EW.ok("Centred " + plural(n, "layer"));
  });

  // Keyframes & expressions
  T["ae.easyEase"] = ease("both");
  T["ae.easeIn"] = ease("in");
  T["ae.easeOut"] = ease("out");
  T["ae.loopOut"] = expression("Loop", 'loopOut("cycle")');
  T["ae.pingPong"] = expression("Ping-pong", 'loopOut("pingpong")');
  T["ae.wiggle"] = expression("Wiggle", "wiggle(3, 30)");
  T["ae.clearExpression"] = expression("Clear expression", "");

  // Effects (match names). With nothing selected, it goes on a new adjustment layer.
  T["ae.effect"] = undoable("Add effect", function (a) {
    var c = comp(), ls = c.selectedLayers;
    if (!ls.length) {
      var adj = c.layers.addSolid([1, 1, 1], "Adjustment Layer", c.width, c.height, c.pixelAspect, c.duration);
      adj.adjustmentLayer = true;
      ls = [adj];
    }
    var n = 0;
    for (var i = 0; i < ls.length; i++) {
      var fx = ls[i].property("ADBE Effect Parade");
      if (fx.canAddProperty(a.matchName)) { fx.addProperty(a.matchName); n++; }
    }
    return n ? EW.ok((a.name || a.matchName) + " on " + plural(n, "layer")) : EW.fail("Can't add " + (a.name || a.matchName));
  });

  T["ae.listEffects"] = function () {
    var out = [];
    for (var i = 0; i < app.effects.length; i++) {
      var e = app.effects[i];
      out.push({ name: e.displayName, matchName: e.matchName, category: e.category });
    }
    return EW.ok("effects", { effects: out });
  };

  // Markers
  T["ae.marker"] = undoable("Marker", function (a) {
    var c = comp(), ls = c.selectedLayers, mv = new MarkerValue(a.name || "");
    if (!ls.length) {
      if (!c.markerProperty) return EW.fail("Select a layer");
      c.markerProperty.setValueAtTime(c.time, mv);
      return EW.ok("Comp marker added");
    }
    for (var i = 0; i < ls.length; i++) ls[i].property("ADBE Marker").setValueAtTime(c.time, mv);
    return EW.ok("Marker on " + plural(ls.length, "layer"));
  });

  // ---- HaloCut Kit: expression rigs with their own controls, and layer tools ---------------------

  var RIG_TAG = /^\/\/ HaloCut rig: (\w+)/;
  var TARGETS = {
    position: ["ADBE Transform Group", "ADBE Position"], rotation: ["ADBE Transform Group", "ADBE Rotate Z"],
    scale: ["ADBE Transform Group", "ADBE Scale"], opacity: ["ADBE Transform Group", "ADBE Opacity"],
    sourceText: ["ADBE Text Properties", "ADBE Text Document"]
  };

  function named(layer, path) { var p = layer; for (var i = 0; i < path.length && p; i++) p = p.property(path[i]); return p; }
  // Adding an effect makes AE forget property objects, so targets are kept as index paths and found again.
  function pathOf(p) { var path = []; while (p && p.parentProperty) { path.unshift(p.propertyIndex); p = p.parentProperty; } return path; }
  function byPath(layer, path) { var p = layer; for (var i = 0; i < path.length; i++) p = p.property(path[i]); return p; }
  function props(n) { return n + (n === 1 ? " property" : " properties"); }

  function picked(layer) {
    var out = [], ps = layer.selectedProperties;
    for (var i = 0; i < ps.length; i++) if (ps[i].propertyType === PropertyType.PROPERTY && ps[i].canSetExpression) out.push(ps[i]);
    return out;
  }

  // The properties a rig goes on: the selected ones when you picked any (on any layer), else each layer's usual one.
  function rigTargets(layer, job, anyPicked) {
    if (job.target === "selected" && anyPicked) return picked(layer);
    var p = named(layer, TARGETS[job.target === "selected" ? job.fallback : job.target]);
    return p && p.canSetExpression ? [p] : [];
  }

  // HaloCut controls nothing reads any more (a rig was replaced by another) go.
  function tidyControls(layer) {
    var used = {}, found = rigsOn(layer), fx = layer.property("ADBE Effect Parade"), drop = [];
    for (var i = 0; i < found.length; i++) for (var k = 0; k < found[i].controls.length; k++) used[found[i].controls[k]] = true;
    for (var j = 1; j <= fx.numProperties; j++) { var n = fx.property(j).name; if (n.indexOf("HaloCut ") === 0 && n.indexOf(" \u00B7 ") > 0 && !used[n]) drop.push(n); }
    removeControls(layer, drop);
  }

  function effectNamed(layer, name) {
    var fx = layer.property("ADBE Effect Parade");
    for (var i = 1; i <= fx.numProperties; i++) if (fx.property(i).name === name) return fx.property(i);
    return null;
  }

  function setControls(layer, controls, add) {
    for (var i = 0; i < controls.length; i++) {
      var c = controls[i], e = effectNamed(layer, c.name);
      if (!e && add) { e = layer.property("ADBE Effect Parade").addProperty(c.effect); e.name = c.name; }
      if (e) e.property(1).setValue(c.value);
    }
  }

  function eachProp(group, fn, depth) {
    for (var i = 1; i <= group.numProperties; i++) {
      var p = group.property(i);
      if (p.propertyType === PropertyType.PROPERTY) fn(p);
      else if (depth < 5) eachProp(p, fn, depth + 1);
    }
  }

  // Every HaloCut rig on a layer, as index paths: [{ id, path, name, controls: [control names] }]
  function rigsOn(layer, id) {
    var out = [];
    eachProp(layer, function (p) {
      var m = p.canSetExpression && p.expressionEnabled !== false ? RIG_TAG.exec(p.expression || "") : null;
      if (!m || (id && m[1] !== id)) return;
      var names = [], re = /effect\("([^"]+)"\)/g, hit;
      while ((hit = re.exec(p.expression))) names.push(hit[1]);
      out.push({ id: m[1], path: pathOf(p), name: p.name, controls: names });
    }, 0);
    return out;
  }

  function removeControls(layer, names) {
    for (var i = 0; i < names.length; i++) { var e = effectNamed(layer, names[i]); if (e) e.remove(); }
  }

  // args: { id, name, target, fallback, expr, controls: [{ name, effect, value }] }
  T["ae.rigApply"] = undoable("Rig", function (a) {
    var c = comp(), ls = layers(c, true), n = 0, err = "", anyPicked = false;
    for (var s0 = 0; s0 < ls.length; s0++) if (picked(ls[s0]).length) anyPicked = true;
    for (var i = 0; i < ls.length; i++) {
      var L = ls[i], ts = rigTargets(L, a, anyPicked), paths = [];
      for (var t = 0; t < ts.length; t++) paths.push(pathOf(ts[t]));
      if (!paths.length) continue;
      setControls(L, a.controls, true);
      for (var k = 0; k < paths.length; k++) {
        var p = byPath(L, paths[k]);
        p.expression = a.expr;
        if (p.expressionError && !err) err = p.expressionError;
        n++;
      }
      tidyControls(L);
    }
    if (!n) return EW.fail(a.target === "sourceText" ? "Select a text layer" : "Select a layer, and the property to drive if you like");
    return err ? EW.fail(a.name + " is on, but AE says: " + err) : EW.ok(a.name + " on " + props(n) + " · tune it with the sliders, or in Effect Controls");
  });

  // args: { controls: [{ name, value }] }: new values for rigs already on the selected layers
  T["ae.rigUpdate"] = undoable("Rig settings", function (a) {
    var ls = layers(comp(), true);
    for (var i = 0; i < ls.length; i++) setControls(ls[i], a.controls, false);
    return EW.ok("Updated on " + plural(ls.length, "layer"));
  });

  T["ae.rigScan"] = function () {
    var c = comp(), ls = c.selectedLayers, out = [];
    for (var i = 0; i < ls.length; i++) {
      var found = rigsOn(ls[i]);
      for (var k = 0; k < found.length; k++) {
        var vals = {};
        for (var n = 0; n < found[k].controls.length; n++) { var e = effectNamed(ls[i], found[k].controls[n]); if (e) vals[found[k].controls[n]] = e.property(1).value; }
        out.push({ layer: ls[i].name, id: found[k].id, prop: found[k].name, values: vals });
      }
    }
    return EW.ok(plural(out.length, "rig"), { rigs: out, layers: ls.length });
  };

  // args: { id }: off the selected layers (all HaloCut rigs without an id), controls and all
  T["ae.rigRemove"] = undoable("Remove rig", function (a) {
    var ls = layers(comp(), true), n = 0;
    for (var i = 0; i < ls.length; i++) {
      var found = rigsOn(ls[i], a.id), names = [];
      for (var k = 0; k < found.length; k++) { byPath(ls[i], found[k].path).expression = ""; names = names.concat(found[k].controls); n++; }
      removeControls(ls[i], names);
    }
    return n ? EW.ok("Removed from " + props(n)) : EW.fail("No HaloCut rig on the selected layers");
  });

  // args: { id }: the rig's movement becomes plain keyframes, one a frame, and the rig goes
  T["ae.rigBake"] = undoable("Bake rig", function (a) {
    var c = comp(), ls = layers(c, true), n = 0, keys = 0, fd = c.frameDuration;
    for (var i = 0; i < ls.length; i++) {
      var L = ls[i], found = rigsOn(L, a.id), names = [], plans = [];
      var t0 = Math.max(0, L.inPoint), t1 = Math.min(c.duration, L.outPoint);
      for (var k = 0; k < found.length; k++) { // sample everything first: the expressions need their controls
        var p = byPath(L, found[k].path), times = [], vals = [];
        for (var t = t0; t < t1 - fd / 2; t += fd) { times.push(t); vals.push(p.valueAtTime(t, false)); }
        plans.push({ path: found[k].path, times: times, vals: vals });
        names = names.concat(found[k].controls);
      }
      for (var q = 0; q < plans.length; q++) {
        var pr = byPath(L, plans[q].path);
        pr.expression = "";
        for (var r = pr.numKeys; r >= 1; r--) pr.removeKey(r);
        if (plans[q].times.length) pr.setValuesAtTimes(plans[q].times, plans[q].vals);
        keys += plans[q].times.length; n++;
      }
      removeControls(L, names);
    }
    return n ? EW.ok("Baked " + props(n) + " into " + keys + " keyframes") : EW.fail("No HaloCut rig on the selected layers");
  });

  // Layers in stacking order (top first), or the other way.
  function inOrder(ls, reverse) {
    var arr = []; for (var i = 0; i < ls.length; i++) arr.push(ls[i]);
    arr.sort(function (x, y) { return reverse ? y.index - x.index : x.index - y.index; });
    return arr;
  }

  T["ae.kitLayers"] = function () {
    var c = comp(), out = [];
    for (var i = 1; i <= c.numLayers; i++) out.push({ index: i, name: c.layer(i).name });
    return EW.ok(c.name, { comp: c.name, layers: out, selected: c.selectedLayers.length });
  };

  // args: { pattern ({n}, {name}), find, replace, start, pad }
  T["ae.kitRename"] = undoable("Rename layers", function (a) {
    var ls = inOrder(layers(comp(), true)), start = a.start === undefined ? 1 : a.start;
    for (var i = 0; i < ls.length; i++) {
      var num = String(start + i); while (num.length < (a.pad || 0)) num = "0" + num;
      var s = a.pattern ? a.pattern.replace(/\{n\}/g, num).replace(/\{name\}/g, ls[i].name) : ls[i].name;
      if (a.find) s = s.split(a.find).join(a.replace || "");
      ls[i].name = s;
    }
    return EW.ok("Renamed " + plural(ls.length, "layer"));
  });

  // args: { mode: "stagger" | "sequence", frames, overlap (frames), reverse }
  T["ae.kitTime"] = undoable("Stagger layers", function (a) {
    var c = comp(), ls = inOrder(layers(c, true), a.reverse), fd = c.frameDuration;
    if (ls.length < 2) return EW.fail("Select two or more layers");
    var at = ls[0].inPoint;
    for (var i = 1; i < ls.length; i++) {
      var prev = ls[i - 1];
      at = a.mode === "sequence" ? prev.outPoint - (a.overlap || 0) * fd : at + (a.frames || 2) * fd;
      ls[i].startTime += at - ls[i].inPoint;
    }
    return EW.ok((a.mode === "sequence" ? "Sequenced " : "Staggered ") + plural(ls.length, "layer"));
  });

  // Where a layer sits in the comp at time t (2D, no parent, no rotation), or null.
  function compBox(L, t) {
    var tr = L.property("ADBE Transform Group");
    if (L.parent || L instanceof CameraLayer || L instanceof LightLayer || Math.abs(tr.property("ADBE Rotate Z").valueAtTime(t, false)) > 0.01) return null;
    var b = bounds(L, t), an = tr.property("ADBE Anchor Point").valueAtTime(t, false), sc = tr.property("ADBE Scale").valueAtTime(t, false);
    var p = tr.property("ADBE Position").valueAtTime(t, false);
    var x0 = p[0] + (b.l - an[0]) * sc[0] / 100, x1 = p[0] + (b.l + b.w - an[0]) * sc[0] / 100;
    var y0 = p[1] + (b.t - an[1]) * sc[1] / 100, y1 = p[1] + (b.t + b.h - an[1]) * sc[1] / 100;
    return { x: Math.min(x0, x1), y: Math.min(y0, y1), w: Math.abs(x1 - x0), h: Math.abs(y1 - y0), at: [p[0], p[1]] };
  }

  // Where each selected layer sits in the comp (2D, no parent, no rotation): [{ index, x, y, w, h }]
  T["ae.kitBoxes"] = function () {
    var c = comp(), ls = layers(c, true), out = [], skipped = 0;
    for (var i = 0; i < ls.length; i++) {
      var b = compBox(ls[i], c.time);
      if (!b) { skipped++; continue; }
      out.push({ index: ls[i].index, x: b.x, y: b.y, w: b.w, h: b.h });
    }
    return EW.ok("boxes", { boxes: out, skipped: skipped, comp: { x: 0, y: 0, w: c.width, h: c.height } });
  };

  function shift(p, d) {
    function plus(v) { if (typeof v === "number") return v + d; var o = []; for (var i = 0; i < v.length; i++) o.push(i < d.length ? v[i] + d[i] : v[i]); return o; }
    if (p.numKeys) { for (var k = 1; k <= p.numKeys; k++) p.setValueAtKey(k, plus(p.keyValue(k))); }
    else p.setValue(plus(p.value));
  }

  // args: { moves: [{ index, dx, dy }] }: the whole animation moves with it
  T["ae.kitMove"] = undoable("Align layers", function (a) {
    var c = comp(), n = 0;
    for (var i = 0; i < a.moves.length; i++) {
      var m = a.moves[i];
      if (Math.abs(m.dx) < 1e-6 && Math.abs(m.dy) < 1e-6) continue;
      var tr = c.layer(m.index).property("ADBE Transform Group"), pos = tr.property("ADBE Position");
      if (pos.dimensionsSeparated) { shift(tr.property("ADBE Position_0"), m.dx); shift(tr.property("ADBE Position_1"), m.dy); }
      else shift(pos, [m.dx, m.dy]);
      n++;
    }
    return EW.ok(n ? "Moved " + plural(n, "layer") : "Already lined up");
  });

  var KIT_IMAGES = /\.(png|jpe?g|psd|ai|eps|tiff?|gif|svg|exr|webp|heic|bmp|tga|dpx)$/i, KIT_AUDIO = /\.(wav|mp3|aiff?|m4a|aac|flac|ogg)$/i;
  // Loose items at the top of the project go into Comps, Footage, Images, Audio and Solids.
  T["ae.kitTidy"] = undoable("Tidy project", function () {
    var rootF = app.project.rootFolder, loose = [], counts = {}, moved = 0;
    for (var i = 1; i <= rootF.numItems; i++) if (!(rootF.item(i) instanceof FolderItem)) loose.push(rootF.item(i));
    function folder(name) {
      for (var j = 1; j <= rootF.numItems; j++) { var it = rootF.item(j); if (it instanceof FolderItem && it.name === name) return it; }
      return app.project.items.addFolder(name);
    }
    for (var k = 0; k < loose.length; k++) {
      var it = loose[k], file = it.file ? it.file.name : it.name, dest;
      if (it instanceof CompItem) dest = "Comps";
      else if (it.mainSource && it.mainSource instanceof SolidSource) dest = "Solids";
      else dest = KIT_IMAGES.test(file) ? "Images" : KIT_AUDIO.test(file) ? "Audio" : "Footage";
      it.parentFolder = folder(dest);
      counts[dest] = (counts[dest] || 0) + 1; moved++;
    }
    var parts = []; for (var f in counts) parts.push(counts[f] + " to " + f);
    return moved ? EW.ok("Tidied " + plural(moved, "item") + ": " + parts.join(", ")) : EW.ok("Nothing loose at the top of the project");
  });

  T["ae.kitUnused"] = undoable("Remove unused footage", function () {
    var n = app.project.removeUnusedFootage();
    return EW.ok(n ? "Removed " + plural(n, "unused item") + " · Undo brings them back" : "No unused footage");
  });

  // ---- HaloCut Resize: one master comp into other sizes, each layer by its own rule ---------------

  function kindOf(L) {
    if (L instanceof CameraLayer) return "camera";
    if (L instanceof LightLayer) return "light";
    if (L instanceof TextLayer) return "text";
    if (L instanceof ShapeLayer) return "shape";
    return L.nullLayer ? "null" : "layer";
  }

  T["ae.resizeInfo"] = function () {
    var c = comp(), out = [];
    for (var i = 1; i <= c.numLayers; i++) {
      var L = c.layer(i), b = compBox(L, c.time);
      out.push({ index: i, name: L.name, kind: kindOf(L), parented: !!L.parent, comment: L.comment || "", box: b });
    }
    return EW.ok(c.name, { name: c.name, w: c.width, h: c.height, duration: c.duration, layers: out });
  };

  // args: { index, comment }: the layer's rule lives in its comment, so it travels with the project
  T["ae.resizeRule"] = undoable("Resize rule", function (a) {
    var c = comp(); c.layer(a.index).comment = a.comment;
    return EW.ok("Rule saved on " + c.layer(a.index).name);
  });

  function moveKeys(p, fn) {
    if (p.numKeys) { for (var k = 1; k <= p.numKeys; k++) p.setValueAtKey(k, fn(p.keyValue(k))); }
    else p.setValue(fn(p.value));
  }

  // One layer in a new size: x' = m·x + bx, y' = m·y + by, scale × k (the whole animation, keys and all).
  function resizeLayer(L, j) {
    var tr = L.property("ADBE Transform Group"), pos = tr.property("ADBE Position");
    if (pos.dimensionsSeparated) {
      moveKeys(tr.property("ADBE Position_0"), function (v) { return j.m * v + j.bx; });
      moveKeys(tr.property("ADBE Position_1"), function (v) { return j.m * v + j.by; });
    } else moveKeys(pos, function (v) { var o = [j.m * v[0] + j.bx, j.m * v[1] + j.by]; if (v.length > 2) o.push(v[2]); return o; });
    if (j.k !== 1) moveKeys(tr.property("ADBE Scale"), function (v) { var o = [v[0] * j.k, v[1] * j.k]; if (v.length > 2) o.push(v[2]); return o; });
    if (L instanceof CameraLayer || L instanceof LightLayer) { // the point of interest moves with the camera
      var poi = tr.property("ADBE Anchor Point");
      if (poi) moveKeys(poi, function (v) { var o = [j.m * v[0] + j.bx, j.m * v[1] + j.by]; if (v.length > 2) o.push(v[2]); return o; });
    }
  }

  // args: { sizes: [{ name, w, h, layers: [{ index, k, m, bx, by }], guides: { vertical, horizontal } }], queue }
  T["ae.resizeMake"] = undoable("Make sizes", function (a) {
    var master = comp(), made = [], kept = [];
    var home = master.parentFolder || app.project.rootFolder, folder = null, fname = master.name + " sizes";
    for (var f = 1; f <= home.numItems; f++) if (home.item(f) instanceof FolderItem && home.item(f).name === fname) folder = home.item(f);
    if (!folder) { folder = app.project.items.addFolder(fname); folder.parentFolder = home; }
    for (var i = 0; i < a.sizes.length; i++) {
      var sz = a.sizes[i], old = null;
      for (var k = 1; k <= folder.numItems; k++) if (folder.item(k) instanceof CompItem && folder.item(k).name === sz.name) old = folder.item(k);
      if (old) {
        if (old.usedIn && old.usedIn.length) { old.name = sz.name + " (old)"; kept.push(sz.name); } // used in another comp: keep it, renamed
        else old.remove();
      }
      var v = master.duplicate();
      v.name = sz.name; v.width = sz.w; v.height = sz.h; v.parentFolder = folder;
      for (var n = 0; n < sz.layers.length; n++) resizeLayer(v.layer(sz.layers[n].index), sz.layers[n]);
      if (sz.guides && v.addGuide) {
        try {
          for (var g = 0; g < sz.guides.vertical.length; g++) v.addGuide(1, sz.guides.vertical[g]);
          for (var h = 0; h < sz.guides.horizontal.length; h++) v.addGuide(0, sz.guides.horizontal[h]);
        } catch (e) {}
      }
      if (a.queue) app.project.renderQueue.items.add(v);
      made.push(v.name);
    }
    return EW.ok("Made " + plural(made.length, "size") + " in “" + fname + "”" + (a.queue ? ", all in the Render Queue" : "") + (kept.length ? " · the old " + kept.join(", ") + " is used elsewhere, so it was kept and renamed" : ""), { made: made });
  });

  // ---- HaloCut Type: kinetic type built from AE's own text animators ---------------------------------

  var TYPE_NAME = "HaloCut Type \u00B7 ";
  var TYPE_PROPS = { opacity: "ADBE Text Opacity", position: "ADBE Text Position 3D", scale: "ADBE Text Scale 3D",
    rotation: "ADBE Text Rotation", blur: "ADBE Text Blur", tracking: "ADBE Text Tracking Amount" };

  function textLayersOf(c) {
    var ls = layers(c, true), out = [];
    for (var i = 0; i < ls.length; i++) if (ls[i] instanceof TextLayer) out.push(ls[i]);
    if (!out.length) throw new Error("Select a text layer");
    return out;
  }
  function animatorsOf(L) { return L.property("ADBE Text Properties").property("ADBE Text Animators"); }
  function docOf(L) { return L.property("ADBE Text Properties").property("ADBE Text Document"); }
  function hcAnimators(L) {
    var g = animatorsOf(L), out = [];
    for (var i = 1; i <= g.numProperties; i++) if (g.property(i).name.indexOf(TYPE_NAME) === 0) out.push(i);
    return out;
  }

  T["ae.typeInfo"] = function () {
    var c = comp(), ls = c.selectedLayers, out = [];
    for (var i = 0; i < ls.length; i++) {
      if (!(ls[i] instanceof TextLayer)) continue;
      var d = docOf(ls[i]).value, names = [], hc = hcAnimators(ls[i]);
      for (var k = 0; k < hc.length; k++) names.push(animatorsOf(ls[i]).property(hc[k]).name.substr(TYPE_NAME.length));
      out.push({ index: ls[i].index, name: ls[i].name, fontSize: d.fontSize, text: String(d.text).substr(0, 300), inPoint: ls[i].inPoint, outPoint: ls[i].outPoint, styles: names });
    }
    return EW.ok(plural(out.length, "text layer"), { layers: out, selected: ls.length });
  };

  // args: { jobs: [{ index, name, based, props, smooth, random, keys, wave, wiggle }] }: one animator per job
  // (AE forgets property objects after every add, so each step finds its way back by index)
  T["ae.typeApply"] = undoable("Kinetic type", function (a) {
    var c = comp(), n = 0;
    for (var j = 0; j < a.jobs.length; j++) {
      var job = a.jobs[j], L = c.layer(job.index);
      if (!(L instanceof TextLayer)) continue;
      var made = animatorsOf(L).addProperty("ADBE Text Animator"), ai = made.propertyIndex;
      made.name = job.name;
      var an = function () { return animatorsOf(L).property(ai); };
      for (var key in job.props) an().property("ADBE Text Animator Properties").addProperty(TYPE_PROPS[key]);
      for (var key2 in job.props) {
        var v = job.props[key2], pr = an().property("ADBE Text Animator Properties").property(TYPE_PROPS[key2]);
        if (key2 === "position") v = [v[0], v[1], 0];
        if (key2 === "scale") v = [v[0], v[1], 100];
        pr.setValue(v);
      }
      if (job.wiggle) { an().property("ADBE Text Selectors").addProperty("ADBE Text Wiggly Selector"); n++; continue; }
      an().property("ADBE Text Selectors").addProperty("ADBE Text Selector");
      var S = an().property("ADBE Text Selectors").property(1), adv = S.property("ADBE Text Range Advanced");
      adv.property("ADBE Text Range Type2").setValue(job.based);
      adv.property("ADBE Text Selector Smoothness").setValue(job.smooth);
      if (job.random) adv.property("ADBE Text Randomize Order").setValue(1);
      if (job.keys) {
        var kp = job.keys.prop === "start" ? S.property("ADBE Text Percent Start") : job.keys.prop === "end" ? S.property("ADBE Text Percent End") : adv.property("ADBE Text Selector Max Amount");
        kp.setValueAtTime(job.keys.times[0], job.keys.values[0]);
        kp.setValueAtTime(job.keys.times[1], job.keys.values[1]);
        if (job.keys.ease) for (var k = 1; k <= kp.numKeys; k++) { var e = [new KeyframeEase(0, 60)]; kp.setTemporalEaseAtKey(k, e, e); }
      }
      if (job.wave) {
        S.property("ADBE Text Percent End").setValue(job.wave.width);
        adv.property("ADBE Text Range Shape").setValue(5); // round: a hump that travels along the line
        S.property("ADBE Text Percent Offset").expression = "// HaloCut Type wave\n((time - inPoint) * " + job.wave.speed + ") % " + (100 + job.wave.width) + " - " + job.wave.width + ";";
      }
      n++;
    }
    return n ? EW.ok(a.jobs[0].name.substr(TYPE_NAME.length) + " on " + plural(n, "text layer") + " · it's a text animator, so you can tweak it in the timeline") : EW.fail("Select a text layer");
  });

  T["ae.typeRemove"] = undoable("Remove kinetic type", function () {
    var ls = textLayersOf(comp()), n = 0;
    for (var i = 0; i < ls.length; i++) {
      var hc = hcAnimators(ls[i]);
      for (var k = hc.length - 1; k >= 0; k--) { animatorsOf(ls[i]).property(hc[k]).remove(); n++; }
    }
    return n ? EW.ok("Removed " + plural(n, "animator")) : EW.fail("No HaloCut type on the selected layers");
  });

  // args: { duration }: the sweep of every HaloCut style takes this long (ins keep their start, outs their end)
  T["ae.typeRetime"] = undoable("Retime kinetic type", function (a) {
    var ls = textLayersOf(comp()), n = 0;
    for (var i = 0; i < ls.length; i++) {
      var hc = hcAnimators(ls[i]);
      for (var k = 0; k < hc.length; k++) {
        var S = animatorsOf(ls[i]).property(hc[k]).property("ADBE Text Selectors").property(1);
        if (!S || !S.property("ADBE Text Percent Start")) continue;
        var cands = [S.property("ADBE Text Percent Start"), S.property("ADBE Text Percent End"), S.property("ADBE Text Range Advanced").property("ADBE Text Selector Max Amount")];
        for (var q = 0; q < cands.length; q++) {
          var p = cands[q];
          if (p.numKeys !== 2) continue;
          var t0 = p.keyTime(1), t1 = p.keyTime(2), v0 = p.keyValue(1), v1 = p.keyValue(2), out = q === 1;
          var nt0 = out ? t1 - a.duration : t0, nt1 = out ? t1 : t0 + a.duration;
          p.removeKey(2); p.removeKey(1);
          p.setValueAtTime(nt0, v0); p.setValueAtTime(nt1, v1);
          for (var e = 1; e <= 2; e++) { var ez = [new KeyframeEase(0, 60)]; p.setTemporalEaseAtKey(e, ez, ez); }
          n++;
        }
      }
    }
    return n ? EW.ok("Retimed " + plural(n, "style") + " to " + a.duration + " s") : EW.fail("No HaloCut type with keyframes on the selected layers");
  });

  // Each line of a text layer becomes a layer of its own, in the same place; the original is switched off.
  T["ae.typeLines"] = undoable("Lines to layers", function () {
    var ls = textLayersOf(comp()), made = 0;
    for (var i = 0; i < ls.length; i++) {
      var L = ls[i], d = docOf(L).value, lines = String(d.text).split(/\r\n|\r|\n/), lead = d.autoLeading || !d.leading ? d.fontSize * 1.2 : d.leading;
      if (lines.length < 2) continue;
      for (var k = 0; k < lines.length; k++) { // each copy lands just above the original: line 1 ends up on top
        if (!lines[k].replace(/\s/g, "").length) continue;
        var dup = L.duplicate(), dd = docOf(dup).value;
        dd.text = lines[k]; docOf(dup).setValue(dd);
        dup.name = L.name + " \u00B7 line " + (k + 1);
        var tr = dup.property("ADBE Transform Group"), pos = tr.property("ADBE Position"), dy = k * lead;
        if (pos.dimensionsSeparated) moveKeys(tr.property("ADBE Position_1"), function (v) { return v + dy; });
        else moveKeys(pos, function (v) { var o = [v[0], v[1] + dy]; if (v.length > 2) o.push(v[2]); return o; });
        made++;
      }
      L.enabled = false;
    }
    return made ? EW.ok("Split into " + plural(made, "line layer") + " · the original is switched off, not deleted") : EW.fail("These text layers have one line each");
  });

  // ---- HaloCut Flow: transitions between layers ------------------------------------------------------

  var FLOW_NAME = "HaloCut Flow \u00B7 ";
  var FLOW_FX = { transform: ["ADBE Geometry2", "Transform"], blur: ["ADBE Gaussian Blur 2", "Blur"],
    directional: ["ADBE Motion Blur", "Directional blur"], bright: ["ADBE Brightness & Contrast 2", "Brightness"] };

  function fxProp(effect, names, index) {
    for (var i = 1; i <= effect.numProperties; i++) for (var n = 0; n < names.length; n++) if (effect.property(i).name === names[n]) return effect.property(i);
    return index <= effect.numProperties ? effect.property(index) : null;
  }
  // The layer's HaloCut copy of an effect: added once, then found again by its name.
  function flowEffect(L, matchName, label) {
    var nm = FLOW_NAME + label;
    if (!effectNamed(L, nm)) { var e = L.property("ADBE Effect Parade").addProperty(matchName); e.name = nm; }
    return effectNamed(L, nm);
  }

  // The controls a cut transition drives on each effect, and how to read each from a frame's values.
  function flowControls(fx, L, nonUniform) {
    var w = L.width || 1920, h = L.height || 1080;
    if (fx === "transform") return [
      { names: ["Position"], index: 2, get: function (v) { return [v.x * w, v.y * h]; }, base: [0.5 * w, 0.5 * h] },
      { names: nonUniform ? ["Scale Height", "Scale"] : ["Scale", "Scale Height"], index: 4, get: function (v) { return nonUniform ? v.scaleH : v.scale; }, base: 100 },
      { names: ["Scale Width"], index: 5, get: function (v) { return v.scaleW; }, base: 100, only: nonUniform },
      { names: ["Rotation"], index: 8, get: function (v) { return v.rot; }, base: 0 },
      { names: ["Opacity"], index: 9, get: function (v) { return v.opacity; }, base: 100 },
      { names: ["Shutter Angle"], index: 11, get: function (v) { return v.shutter; }, base: 0 }];
    if (fx === "blur") return [{ names: ["Blurriness"], index: 1, get: function (v) { return v.blur; }, base: 0 }];
    if (fx === "directional") return [{ names: ["Direction"], index: 1, get: function (v) { return v.dir; }, base: 0 }, { names: ["Blur Length"], index: 2, get: function (v) { return v.len; }, base: 0 }];
    return [{ names: ["Brightness"], index: 1, get: function (v) { return v.bright; }, base: 0 }];
  }
  function same(x, y) { if (x instanceof Array) { for (var i = 0; i < x.length; i++) if (Math.abs(x[i] - y[i]) > 1e-6) return false; return true; } return Math.abs(x - y) < 1e-6; }

  T["ae.flowInfo"] = function () {
    var c = comp(), ls = c.selectedLayers, out = [];
    for (var i = 0; i < ls.length; i++) out.push({ index: ls[i].index, name: ls[i].name, inPoint: ls[i].inPoint, outPoint: ls[i].outPoint, width: ls[i].width, height: ls[i].height });
    return EW.ok(plural(out.length, "layer"), { layers: out, fps: Math.round(1 / c.frameDuration * 1000) / 1000 });
  };

  // args: { plan: { fx, A: [values per frame], B: [...], nonUniform }, pairs: [{ a, b }] }
  // A builds up to the cut over its last frames, B settles out of it over its first; A now ends where B starts.
  T["ae.flowCut"] = undoable("Transition", function (a) {
    var c = comp(), fd = c.frameDuration, n = a.plan.A.length - 1, keys = 0, pairs = [];
    for (var p = 0; p < a.pairs.length; p++) pairs.push({ A: c.layer(a.pairs[p].a), B: c.layer(a.pairs[p].b) });
    for (var q = 0; q < pairs.length; q++) {
      var A = pairs[q].A, B = pairs[q].B, cut = B.inPoint;
      if (A.outPoint > cut + fd / 2) A.outPoint = cut;
      var sides = [[A, "A"], [B, "B"]];
      for (var s = 0; s < 2; s++) {
        var L = sides[s][0], side = sides[s][1], vals = a.plan[side], frames = Math.min(n, Math.floor((L.outPoint - L.inPoint) / fd / 2));
        var todo = [];
        for (var f = 0; f < a.plan.fx.length; f++) {
          var fx = a.plan.fx[f], ctl = flowControls(fx, L, a.plan.nonUniform), moving = [];
          for (var k = 0; k < ctl.length; k++) {
            if (ctl[k].only === false) continue;
            for (var v = 0; v < vals.length; v++) if (!same(ctl[k].get(vals[v]), ctl[k].base)) { moving.push(ctl[k]); break; }
          }
          if (moving.length) { flowEffect(L, FLOW_FX[fx][0], FLOW_FX[fx][1]); todo.push({ fx: fx, ctl: moving }); }
        }
        for (var d = 0; d < todo.length; d++) { // every effect is in place: now find each one fresh and key it
          var e = effectNamed(L, FLOW_NAME + FLOW_FX[todo[d].fx][1]);
          if (todo[d].fx === "transform") {
            var uni = fxProp(e, ["Uniform Scale"], 3); if (uni) { try { uni.setValue(a.plan.nonUniform ? 0 : 1); } catch (e1) {} }
            var own = fxProp(e, ["Use Composition\u2019s Shutter Angle", "Use Composition's Shutter Angle"], 10); if (own) { try { own.setValue(0); } catch (e2) {} }
          }
          if (todo[d].fx === "blur") { var rep = fxProp(e, ["Repeat Edge Pixels"], 3); if (rep) { try { rep.setValue(1); } catch (e3) {} } }
          for (var m = 0; m < todo[d].ctl.length; m++) {
            var cp = todo[d].ctl[m], pr = fxProp(e, cp.names, cp.index);
            if (!pr) continue;
            for (var fr = 0; fr <= frames; fr++) {
              var idx = side === "A" ? n - frames + fr : fr, t = side === "A" ? cut - (frames - fr) * fd : cut + fr * fd;
              pr.setValueAtTime(t, cp.get(vals[idx]));
              keys++;
            }
          }
        }
      }
    }
    return EW.ok("Transition on " + plural(pairs.length, "cut") + " · " + keys + " keyframes on HaloCut Flow effects");
  });

  // args: { pairs: [{ a, b }], job: { name, fx, prop, from, to, set, seconds, ease } }
  // The later layer goes on top and is revealed over the earlier one, which stays under it for the length of it.
  T["ae.flowOverlap"] = undoable("Transition", function (a) {
    var c = comp(), fd = c.frameDuration, job = a.job, pairs = [], made = 0, short = 0;
    for (var p = 0; p < a.pairs.length; p++) pairs.push({ A: c.layer(a.pairs[p].a), B: c.layer(a.pairs[p].b) });
    for (var q = 0; q < pairs.length; q++) {
      var A = pairs[q].A, B = pairs[q].B, start = B.inPoint, dur = job.seconds;
      if (A.outPoint < start + dur - fd / 2) A.outPoint = start + dur;  // footage without enough left stops where it ends
      if (A.outPoint < start + dur - fd / 2) { dur = A.outPoint - start; short++; }
      if (dur < 2 * fd) continue;
      if (B.index > A.index) B.moveBefore(A);
      flowEffect(B, job.fx, job.name.substr(FLOW_NAME.length));
      var e = effectNamed(B, job.name);
      for (var i = 0; i < job.set.length; i++) { var sp = fxProp(e, job.set[i].names, job.set[i].index); if (sp) sp.setValue(job.set[i].value); }
      var kp = fxProp(e, job.prop.names, job.prop.index);
      kp.setValueAtTime(start, job.from); kp.setValueAtTime(start + dur, job.to);
      if (job.ease) for (var k = 1; k <= kp.numKeys; k++) { var ez = [new KeyframeEase(0, 60)]; kp.setTemporalEaseAtKey(k, ez, ez); }
      made++;
    }
    if (!made) return EW.fail("The earlier layer needs footage past the cut to show under the transition");
    return EW.ok(job.name.substr(FLOW_NAME.length) + " on " + plural(made, "cut") + (short ? " · " + short + " shorter, the footage ran out" : ""));
  });

  T["ae.flowRemove"] = undoable("Remove transitions", function () {
    var ls = layers(comp(), true), n = 0;
    for (var i = 0; i < ls.length; i++) {
      var fx = ls[i].property("ADBE Effect Parade"), names = [];
      for (var k = 1; k <= fx.numProperties; k++) if (fx.property(k).name.indexOf(FLOW_NAME) === 0) names.push(fx.property(k).name);
      removeControls(ls[i], names); n += names.length;
    }
    return n ? EW.ok("Removed " + plural(n, "transition effect")) : EW.fail("No HaloCut transitions on the selected layers");
  });

  // ---- HaloCut Vector: SVG artwork as native shape layers ---------------------------------------------

  function shapeFrom(p) { var sh = new Shape(); sh.vertices = p.v; sh.inTangents = p.i; sh.outTangents = p.o; sh.closed = p.c; return sh; }
  // Keys [[t, value]...] from t0, eased in and out (one ease per dimension, as AE wants for non-spatial values).
  function keyAll(p, t0, keys) {
    for (var k = 0; k < keys.length; k++) p.setValueAtTime(t0 + keys[k][0], keys[k][1]);
    var dims = easeDims(p), arr = [];
    for (var d = 0; d < dims; d++) arr.push(new KeyframeEase(0, 55));
    for (var j = 1; j <= p.numKeys; j++) { try { p.setTemporalEaseAtKey(j, arr, arr); } catch (e) {} }
  }
  function trimKeys(tp, t0, secs) { keyAll(tp, t0, [[0, 0], [secs, 100]]); }

  // args: { layers: [{ name, shapes: [{ name, paths: [{ v, i, o, c }], fill, stroke }] }], drawOn: { mode, seconds, stagger } }
  // Each step finds its group again by index: AE forgets property objects whenever something is added.
  T["ae.vectorBuild"] = undoable("Import SVG", function (a) {
    var c = comp(), made = 0, paths = 0, d = a.drawOn || { mode: "none" }, t0 = c.time;
    for (var l = 0; l < a.layers.length; l++) {
      var job = a.layers[l], L = c.layers.addShape();
      L.name = job.name;
      L.property("ADBE Transform Group").property("ADBE Position").setValue(job.position || [c.width / 2, c.height / 2]);
      var root = function () { return L.property("ADBE Root Vectors Group"); };
      // the first shape in the SVG is the furthest back; AE draws the top of the list in front, so add from the last
      for (var s = job.shapes.length - 1; s >= 0; s--) {
        var sh = job.shapes[s], gi = root().addProperty("ADBE Vector Group").propertyIndex;
        root().property(gi).name = sh.name;
        var vecs = function () { return root().property(gi).property("ADBE Vectors Group"); };
        for (var p = 0; p < sh.paths.length; p++) {
          var pi = vecs().addProperty("ADBE Vector Shape - Group").propertyIndex;
          vecs().property(pi).property("ADBE Vector Shape").setValue(shapeFrom(sh.paths[p]));
          paths++;
        }
        var an = sh.anim || {};
        if (d.mode === "stagger") { // one after another, in the SVG's order
          var ti = vecs().addProperty("ADBE Vector Filter - Trim").propertyIndex;
          trimKeys(vecs().property(ti).property("ADBE Vector Trim End"), t0 + s * (d.stagger || 0.1), d.seconds || 1);
        } else if (an.trimStart || an.trimEnd || an.trimOffset) { // an accent's own trim keys
          var tj = vecs().addProperty("ADBE Vector Filter - Trim").propertyIndex, TR = vecs().property(tj);
          if (an.trimStart) keyAll(TR.property("ADBE Vector Trim Start"), t0, an.trimStart);
          if (an.trimEnd) keyAll(vecs().property(tj).property("ADBE Vector Trim End"), t0, an.trimEnd);
          if (an.trimOffset) keyAll(vecs().property(tj).property("ADBE Vector Trim Offset"), t0, an.trimOffset);
        }
        if (sh.stroke) {
          var si = vecs().addProperty("ADBE Vector Graphic - Stroke").propertyIndex, S = vecs().property(si);
          S.property("ADBE Vector Stroke Color").setValue(sh.stroke.rgb.concat([1]));
          S.property("ADBE Vector Stroke Width").setValue(sh.stroke.width);
          S.property("ADBE Vector Stroke Opacity").setValue(sh.stroke.opacity);
          try { S.property("ADBE Vector Stroke Line Cap").setValue(sh.stroke.cap); S.property("ADBE Vector Stroke Line Join").setValue(sh.stroke.join); } catch (e) {}
          if (an.strokeWidth) keyAll(vecs().property(si).property("ADBE Vector Stroke Width"), t0, an.strokeWidth);
        }
        if (sh.fill) {
          var fi = vecs().addProperty("ADBE Vector Graphic - Fill").propertyIndex, Fp = vecs().property(fi);
          Fp.property("ADBE Vector Fill Color").setValue(sh.fill.rgb.concat([1]));
          Fp.property("ADBE Vector Fill Opacity").setValue(sh.fill.opacity);
          if (sh.fill.evenOdd) { try { Fp.property("ADBE Vector Fill Rule").setValue(2); } catch (e2) {} }
        }
        // the group's own transform: where it is, how big, turned, see-through
        var XF = { position: "ADBE Vector Position", scale: "ADBE Vector Scale", rotation: "ADBE Vector Rotation", opacity: "ADBE Vector Group Opacity" };
        for (var key in XF) if (an[key]) keyAll(root().property(gi).property("ADBE Vector Transform Group").property(XF[key]), t0, an[key]);
      }
      if (d.mode === "together") {
        var ri = root().addProperty("ADBE Vector Filter - Trim").propertyIndex;
        trimKeys(root().property(ri).property("ADBE Vector Trim End"), t0, d.seconds || 1);
      }
      made++;
    }
    return EW.ok("Imported " + plural(made, "shape layer") + " · " + plural(paths, "path") + (d.mode !== "none" ? " · drawing on from the playhead" : ""));
  });

  // Layer switches
  T["ae.toggleShy"] = undoable("Shy", function () {
    var ls = layers(comp(), true), v = !ls[0].shy;
    for (var i = 0; i < ls.length; i++) ls[i].shy = v;
    return EW.ok((v ? "Shy on " : "Shy off ") + plural(ls.length, "layer"));
  });

  T["ae.toggleMotionBlur"] = undoable("Motion blur", function () {
    var c = comp(), ls = layers(c, true), v = !ls[0].motionBlur;
    for (var i = 0; i < ls.length; i++) ls[i].motionBlur = v;
    c.motionBlur = true;
    return EW.ok((v ? "Motion blur on " : "Motion blur off ") + plural(ls.length, "layer"));
  });

  T["ae.toggle3D"] = undoable("3D layer", function () {
    var ls = layers(comp(), true), v = !ls[0].threeDLayer;
    for (var i = 0; i < ls.length; i++) if (!(ls[i] instanceof CameraLayer) && !(ls[i] instanceof LightLayer)) ls[i].threeDLayer = v;
    return EW.ok((v ? "3D on " : "3D off ") + plural(ls.length, "layer"));
  });
})();
