// HaloCut — Premiere Pro commands (ExtendScript + QE DOM).
// Each tool takes an args object and returns EW.ok(...) or EW.fail(...).

(function () {
  var T = EW.tools;

  function seq() {
    var s = app.project.activeSequence;
    if (!s) throw new Error("Open a sequence first");
    return s;
  }

  function qeSeq() {
    app.enableQE();
    var q = qe.project.getActiveSequence();
    if (!q) throw new Error("Open a sequence first");
    return q;
  }

  function now(s) { return s.getPlayerPosition().seconds; }

  // Every clip (video + audio) in the active sequence, with its track info.
  function allItems(s) {
    var out = [], kinds = [["video", s.videoTracks], ["audio", s.audioTracks]];
    for (var k = 0; k < kinds.length; k++) {
      var tracks = kinds[k][1];
      for (var t = 0; t < tracks.numTracks; t++) {
        var tr = tracks[t];
        for (var c = 0; c < tr.clips.numItems; c++) {
          out.push({ item: tr.clips[c], kind: kinds[k][0], track: t, trackObj: tr });
        }
      }
    }
    return out;
  }

  function selected(s, videoOnly) {
    var sel = s.getSelection(), out = [];
    for (var i = 0; i < sel.length; i++) {
      if (videoOnly && sel[i].mediaType !== "Video") continue;
      out.push(sel[i]);
    }
    return out;
  }

  function requireSelection(s, videoOnly) {
    var sel = selected(s, videoOnly);
    if (!sel.length) throw new Error(videoOnly ? "Select a video clip" : "Select a clip");
    return sel;
  }

  function plural(n, word) { return n + " " + word + (n === 1 ? "" : "s"); }

  // ---- Components (Motion, Opacity) ----------------------------------------

  function component(item, matchName, displayName) {
    for (var i = 0; i < item.components.numItems; i++) {
      var c = item.components[i];
      if (c.matchName === matchName || c.displayName === displayName) return c;
    }
    return null;
  }

  // Motion: 0 Position, 1 Scale, 2 Scale Width, 3 Uniform Scale, 4 Rotation, 5 Anchor Point
  function motion(item) {
    var m = component(item, "AE.ADBE Motion", "Motion");
    if (!m) throw new Error("This clip has no Motion settings");
    return m;
  }

  function setProp(prop, value) {
    if (prop.isTimeVarying && prop.isTimeVarying()) {
      // Keyframed: write a key at the playhead instead of overwriting the animation.
      var t = app.project.activeSequence.getPlayerPosition();
      prop.addKey(t);
      prop.setValueAtKey(t, value, true);
    } else {
      prop.setValue(value, true);
    }
  }

  function forEachVideo(fn) {
    var s = seq(), sel = requireSelection(s, true);
    for (var i = 0; i < sel.length; i++) fn(sel[i], s);
    return sel.length;
  }

  // Source frame size from the project item's metadata ("1920 x 1080 (1.0)").
  function sourceSize(item) {
    var pi = item.projectItem;
    if (!pi) return null;
    var md = pi.getProjectMetadata();
    var m = md.match(/VideoInfo>\s*(\d+)\s*x\s*(\d+)/);
    if (!m) return null;
    return { w: parseInt(m[1], 10), h: parseInt(m[2], 10) };
  }

  function frameSize(s) {
    return { w: s.frameSizeHorizontal, h: s.frameSizeVertical };
  }

  function scaleTo(mode) {
    var skipped = 0;
    var n = forEachVideo(function (item, s) {
      var src = sourceSize(item), f = frameSize(s);
      if (!src) { skipped++; return; }
      var sx = f.w / src.w, sy = f.h / src.h;
      var k = mode === "fill" ? Math.max(sx, sy)
            : mode === "fit" ? Math.min(sx, sy)
            : mode === "width" ? sx : sy;
      var m = motion(item);
      setProp(m.properties[0], [0.5, 0.5]);
      setProp(m.properties[1], Math.round(k * 10000) / 100);
    });
    return EW.ok(plural(n - skipped, "clip") + (skipped ? " (" + skipped + " without size info)" : ""));
  }

  // ---- QE helpers (razor, effects) ------------------------------------------

  function qeTrack(q, kind, index) {
    return kind === "video" ? q.getVideoTrackAt(index) : q.getAudioTrackAt(index);
  }

  // Find the QE item that matches a DOM TrackItem (QE lists include empty gaps).
  function qeItemFor(q, item) {
    var kind = item.mediaType === "Video" ? "video" : "audio";
    var s = seq();
    var tracks = kind === "video" ? s.videoTracks : s.audioTracks;
    for (var t = 0; t < tracks.numTracks; t++) {
      var tr = tracks[t];
      for (var c = 0; c < tr.clips.numItems; c++) {
        if (tr.clips[c].nodeId === item.nodeId) {
          var qt = qeTrack(q, kind, t);
          for (var i = 0; i < qt.numItems; i++) {
            var qi = qt.getItemAt(i);
            if (qi.type !== "Empty" && Math.abs(qi.start.secs - item.start.seconds) < 0.0005) return qi;
          }
        }
      }
    }
    return null;
  }

  function razorTracks(onlyTargeted) {
    var s = seq(), q = qeSeq();
    var tc = q.CTI.timecode, n = 0;
    var kinds = [["video", s.videoTracks], ["audio", s.audioTracks]];
    for (var k = 0; k < kinds.length; k++) {
      var tracks = kinds[k][1];
      for (var t = 0; t < tracks.numTracks; t++) {
        var tr = tracks[t];
        if (tr.isLocked && tr.isLocked()) continue;
        if (onlyTargeted && !tr.isTargeted()) continue;
        qeTrack(q, kinds[k][0], t).razor(tc);
        n++;
      }
    }
    if (!n) return EW.fail(onlyTargeted ? "No targeted tracks" : "No unlocked tracks");
    return EW.ok("Cut " + plural(n, "track"));
  }

  function applyEffect(name, kind) {
    var s = seq(), q = qeSeq(), sel = requireSelection(s, kind === "video");
    var fx = kind === "audio" ? qe.project.getAudioEffectByName(name) : qe.project.getVideoEffectByName(name);
    if (!fx) return EW.fail("Effect not found: " + name);
    var n = 0;
    for (var i = 0; i < sel.length; i++) {
      var isVideo = sel[i].mediaType === "Video";
      if ((kind === "audio") === isVideo) continue;
      var qi = qeItemFor(q, sel[i]);
      if (!qi) continue;
      if (kind === "audio") qi.addAudioEffect(fx); else qi.addVideoEffect(fx);
      n++;
    }
    return n ? EW.ok(name + " on " + plural(n, "clip")) : EW.fail("Select a " + kind + " clip");
  }

  // ---- Tools ---------------------------------------------------------------

  T["ping"] = function () {
    var s = app.project.activeSequence;
    return EW.ok("pong", { app: "PPRO", sequence: s ? s.name : null });
  };

  // Edit
  T["pr.cut"] = function () { return razorTracks(true); };
  T["pr.cutAll"] = function () { return razorTracks(false); };

  T["pr.rippleDelete"] = function () {
    var sel = requireSelection(seq());
    for (var i = sel.length - 1; i >= 0; i--) sel[i].remove(true, true);
    return EW.ok("Removed " + plural(sel.length, "clip") + ", gap closed");
  };

  T["pr.delete"] = function () {
    var sel = requireSelection(seq());
    for (var i = sel.length - 1; i >= 0; i--) sel[i].remove(false, true);
    return EW.ok("Removed " + plural(sel.length, "clip"));
  };

  T["pr.toggleEnable"] = function () {
    var sel = requireSelection(seq());
    var turnOff = !sel[0].disabled;
    for (var i = 0; i < sel.length; i++) sel[i].disabled = turnOff;
    return EW.ok((turnOff ? "Disabled " : "Enabled ") + plural(sel.length, "clip"));
  };

  T["pr.link"] = function () { seq().linkSelection(); return EW.ok("Linked"); };
  T["pr.unlink"] = function () { seq().unlinkSelection(); return EW.ok("Unlinked"); };

  T["pr.selectAtPlayhead"] = function () {
    var s = seq(), t = now(s), items = allItems(s), n = 0;
    for (var i = 0; i < items.length; i++) {
      var it = items[i].item;
      var hit = it.start.seconds <= t && it.end.seconds > t && !(items[i].trackObj.isLocked && items[i].trackObj.isLocked());
      it.setSelected(hit, true);
      if (hit) n++;
    }
    return EW.ok("Selected " + plural(n, "clip"));
  };

  T["pr.selectForward"] = function () {
    var s = seq(), t = now(s), items = allItems(s), n = 0;
    for (var i = 0; i < items.length; i++) {
      var it = items[i].item;
      var hit = it.end.seconds > t;
      it.setSelected(hit, true);
      if (hit) n++;
    }
    return EW.ok("Selected " + plural(n, "clip"));
  };

  // Transform
  T["pr.center"] = function () {
    var n = forEachVideo(function (item) { setProp(motion(item).properties[0], [0.5, 0.5]); });
    return EW.ok("Centred " + plural(n, "clip"));
  };

  T["pr.scale100"] = function () {
    var n = forEachVideo(function (item) { setProp(motion(item).properties[1], 100); });
    return EW.ok("Scale 100% on " + plural(n, "clip"));
  };

  T["pr.fitFrame"] = function () { return scaleTo("fit"); };
  T["pr.fillFrame"] = function () { return scaleTo("fill"); };
  T["pr.fillWidth"] = function () { return scaleTo("width"); };
  T["pr.fillHeight"] = function () { return scaleTo("height"); };

  T["pr.punchIn"] = function (a) {
    var k = a.factor || 1.2;
    var n = forEachVideo(function (item) {
      var p = motion(item).properties[1];
      setProp(p, Math.round(p.getValue() * k * 100) / 100);
    });
    return EW.ok("Punched in on " + plural(n, "clip"));
  };

  T["pr.punchOut"] = function (a) {
    var k = a.factor || 1.2;
    var n = forEachVideo(function (item) {
      var p = motion(item).properties[1];
      setProp(p, Math.round(p.getValue() / k * 100) / 100);
    });
    return EW.ok("Punched out on " + plural(n, "clip"));
  };

  T["pr.rotate"] = function (a) {
    var deg = a.degrees || 90;
    var n = forEachVideo(function (item) {
      var p = motion(item).properties[4];
      setProp(p, p.getValue() + deg);
    });
    return EW.ok("Rotated " + deg + "° on " + plural(n, "clip"));
  };

  T["pr.resetMotion"] = function () {
    var n = forEachVideo(function (item) {
      var m = motion(item);
      setProp(m.properties[0], [0.5, 0.5]);
      setProp(m.properties[1], 100);
      setProp(m.properties[4], 0);
    });
    return EW.ok("Reset motion on " + plural(n, "clip"));
  };

  T["pr.opacity"] = function (a) {
    var v = a.value === undefined ? 100 : a.value;
    var n = forEachVideo(function (item) {
      var o = component(item, "AE.ADBE Opacity", "Opacity");
      if (o) setProp(o.properties[0], v);
    });
    return EW.ok("Opacity " + v + "% on " + plural(n, "clip"));
  };

  T["pr.flipH"] = function () { return applyEffect("Horizontal Flip", "video"); };
  T["pr.flipV"] = function () { return applyEffect("Vertical Flip", "video"); };

  // Effects
  T["pr.effect"] = function (a) { return applyEffect(a.name, a.kind || "video"); };

  // A video transition at the end of each selected clip (or at the start of the first one). args: { name, seconds }
  T["pr.transition"] = function (a) {
    var s = seq(), q = qeSeq(), sel = requireSelection(s, true);
    var tr = qe.project.getVideoTransitionByName(a.name);
    if (!tr) return EW.fail("Transition not found: " + a.name);
    var fps = 1 / (s.getSettings().videoFrameRate.seconds || 0.04);
    var frames = String(Math.max(1, Math.round((a.seconds || 1) * fps)));
    var n = 0;
    for (var i = 0; i < sel.length; i++) {
      var qi = qeItemFor(q, sel[i]);
      if (!qi) continue;
      try { qi.addTransition(tr, false, frames, "0", 0.5, false, true); n++; }
      catch (e) { try { qi.addTransition(tr, false); n++; } catch (e2) {} }
    }
    return n ? EW.ok(a.name + " on " + plural(n, "clip")) : EW.fail("Premiere would not add " + a.name + " here");
  };

  T["pr.listEffects"] = function () {
    app.enableQE();
    function arr(list) { var o = []; for (var i = 0; i < list.length; i++) o.push(list[i]); return o; }
    return EW.ok("effects", {
      video: arr(qe.project.getVideoEffectList()),
      audio: arr(qe.project.getAudioEffectList()),
      transitions: arr(qe.project.getVideoTransitionList())
    });
  };

  // Markers (colour index 0–7: green, red, purple, orange, yellow, white, blue, cyan)
  T["pr.marker"] = function (a) {
    var s = seq();
    var m = s.markers.createMarker(now(s));
    if (a.color !== undefined) m.setColorByIndex(a.color);
    if (a.name) m.name = a.name;
    return EW.ok("Marker added");
  };

  // Labels (index 0–15). Scripts can only colour the source item, so every use of it changes.
  T["pr.label"] = function (a) {
    var sel = requireSelection(seq()), n = 0;
    for (var i = 0; i < sel.length; i++) {
      if (sel[i].projectItem) { sel[i].projectItem.setColorLabel(a.index); n++; }
    }
    return EW.ok("Label on " + plural(n, "clip") + " (source)");
  };

  // ---- Studio: silence remover --------------------------------------------

  var TICKS = 254016000000;

  // The clips to listen to: selected audio clips (or the sound linked to selected video).
  T["pr.studioClips"] = function () {
    var s = seq(), sel = s.getSelection(), out = [], seen = {};
    var audio = [];
    for (var i = 0; i < sel.length; i++) if (sel[i].mediaType === "Audio") audio.push(sel[i]);
    if (!audio.length) {
      // only video selected: use the audio clips that sit under it in time
      var items = allItems(s);
      for (var v = 0; v < sel.length; v++) {
        for (var k = 0; k < items.length; k++) {
          var it = items[k].item;
          if (items[k].kind === "audio" && it.start.seconds < sel[v].end.seconds && it.end.seconds > sel[v].start.seconds) audio.push(it);
        }
      }
    }
    for (var j = 0; j < audio.length; j++) {
      var a = audio[j];
      if (seen[a.nodeId] || !a.projectItem) continue;
      seen[a.nodeId] = true;
      var trackIndex = -1;
      for (var t = 0; t < s.audioTracks.numTracks; t++) {
        for (var c = 0; c < s.audioTracks[t].clips.numItems; c++) if (s.audioTracks[t].clips[c].nodeId === a.nodeId) trackIndex = t;
      }
      out.push({
        name: a.name, path: a.projectItem.getMediaPath(), track: trackIndex,
        inPoint: a.inPoint.seconds, outPoint: a.outPoint.seconds,
        start: a.start.seconds, end: a.end.seconds
      });
    }
    if (!out.length) return EW.fail("Select the clips to listen to");
    var tracks = [];
    for (var n = 0; n < s.audioTracks.numTracks; n++) tracks.push(s.audioTracks[n].name || ("A" + (n + 1)));
    return EW.ok(plural(out.length, "clip"), { clips: out, audioTracks: tracks, sequence: s.name });
  };

  function frameSnap(s, sec) {
    var fd = s.getSettings().videoFrameRate.seconds || (1 / 25);
    return Math.round(sec / fd) * fd;
  }

  // Timecode for a time, in the sequence's own format, read back from the playhead.
  function timecodeAt(s, q, sec) {
    s.setPlayerPosition(String(Math.round(sec * TICKS)));
    return q.CTI.timecode;
  }

  function trackList(s, skipAudio) {
    var out = [];
    for (var v = 0; v < s.videoTracks.numTracks; v++) out.push({ kind: "video", index: v, track: s.videoTracks[v] });
    for (var a = 0; a < s.audioTracks.numTracks; a++) {
      if (skipAudio[a]) continue; // the music bed: left exactly as it is
      out.push({ kind: "audio", index: a, track: s.audioTracks[a] });
    }
    var keep = [];
    for (var i = 0; i < out.length; i++) if (!(out[i].track.isLocked && out[i].track.isLocked())) keep.push(out[i]);
    return keep;
  }

  function findById(tracks, id) {
    for (var i = 0; i < tracks.length; i++) {
      var clips = tracks[i].track.clips;
      for (var c = 0; c < clips.numItems; c++) if (clips[c].nodeId === id) return clips[c];
    }
    return null;
  }

  // Moves every clip that starts at or after `at` left by `len`, on every given track.
  // Works out where each clip must land first, then moves each one there, so a clip that moved
  // together with its linked partner is never moved twice.
  function shiftLeft(tracks, at, len) {
    var eps = 0.0005, targets = [];
    for (var t = 0; t < tracks.length; t++) {
      var cl = tracks[t].track.clips;
      for (var c = 0; c < cl.numItems; c++) {
        if (cl[c].start.seconds >= at - eps) targets.push({ id: cl[c].nodeId, to: cl[c].start.seconds - len });
      }
    }
    targets.sort(function (x, y) { return x.to - y.to; });
    for (var m = 0; m < targets.length; m++) {
      var item = findById(tracks, targets[m].id);
      if (!item) continue;
      var off = targets[m].to - item.start.seconds;
      if (Math.abs(off) < eps) continue;
      var tm = new Time(); tm.seconds = off;
      item.move(tm);
    }
  }

  // The same the other way: every clip at or after `at` moves right by `len`, the last one first.
  function shiftRight(tracks, at, len) {
    var eps = 0.0005, targets = [];
    for (var t = 0; t < tracks.length; t++) {
      var cl = tracks[t].track.clips;
      for (var c = 0; c < cl.numItems; c++) {
        if (cl[c].start.seconds >= at - eps) targets.push({ id: cl[c].nodeId, to: cl[c].start.seconds + len });
      }
    }
    targets.sort(function (x, y) { return y.to - x.to; });
    for (var m = 0; m < targets.length; m++) {
      var item = findById(tracks, targets[m].id);
      if (!item) continue;
      var off = targets[m].to - item.start.seconds;
      if (Math.abs(off) < eps) continue;
      var tm = new Time(); tm.seconds = off;
      item.move(tm);
    }
  }

  // Cut pauses out and close them up on every track, so picture and sound stay together.
  // args: { regions: [{start, end}], keepCopy, skipAudio: [track index, ...] }
  T["pr.studioCut"] = function (a) {
    var s = seq(), q = qeSeq();
    var regions = a.regions || [];
    if (!regions.length) return EW.fail("No pauses to cut");
    var skip = {};
    for (var k = 0; k < (a.skipAudio || []).length; k++) skip[a.skipAudio[k]] = true;
    var before = s.getPlayerPosition().ticks;

    if (a.keepCopy) {
      if (!s.clone()) return EW.fail("Could not make a copy of the sequence, nothing was cut");
      s = app.project.activeSequence; // cloning can change the active sequence; edit the original
    }

    var tracks = trackList(s, skip);
    var eps = 0.0005, cut = 0, removedTime = 0;
    regions.sort(function (x, y) { return y.start - x.start; }); // last first: earlier times stay valid

    for (var r = 0; r < regions.length; r++) {
      var st = frameSnap(s, regions[r].start), en = frameSnap(s, regions[r].end);
      if (en - st < 0.02) continue;
      var tcA = timecodeAt(s, q, st), tcB = timecodeAt(s, q, en);
      for (var t = 0; t < tracks.length; t++) {
        var qt = tracks[t].kind === "video" ? q.getVideoTrackAt(tracks[t].index) : q.getAudioTrackAt(tracks[t].index);
        qt.razor(tcB); qt.razor(tcA);
      }
      // remove what is inside the pause, without rippling
      for (var t2 = 0; t2 < tracks.length; t2++) {
        var clips = tracks[t2].track.clips;
        for (var c = clips.numItems - 1; c >= 0; c--) {
          var it = clips[c];
          if (it.start.seconds >= st - eps && it.end.seconds <= en + eps) { try { it.remove(false, false); } catch (e1) {} }
        }
      }
      var len = en - st;
      shiftLeft(tracks, en, len);
      cut++; removedTime += len;
    }
    s.setPlayerPosition(before);
    return EW.ok("Cut " + plural(cut, a.noun || "pause") + ", " + (Math.round(removedTime * 10) / 10) + " s shorter" + (a.keepCopy ? ", copy kept" : ""),
      { cut: cut, seconds: removedTime });
  };

  // Moves the playhead, so you can hear a spot before cutting it. args: { t } sequence seconds
  T["pr.seek"] = function (a) {
    var s = seq();
    s.setPlayerPosition(String(Math.round(Math.max(0, a.t) * TICKS)));
    return EW.ok("Playhead at " + (Math.round(a.t * 10) / 10) + " s");
  };

  // ---- Studio: timeline tools ----------------------------------------------

  function allTrackList(s) {
    var out = [];
    for (var v = 0; v < s.videoTracks.numTracks; v++) out.push({ kind: "video", index: v, track: s.videoTracks[v] });
    for (var a = 0; a < s.audioTracks.numTracks; a++) out.push({ kind: "audio", index: a, track: s.audioTracks[a] });
    return out;
  }

  // Closes only the gaps where no track has anything, so nothing ever slips out of sync.
  T["pr.closeGaps"] = function () {
    var s = seq(), all = allTrackList(s), fd = s.getSettings().videoFrameRate.seconds || 0.04;
    var spans = [];
    for (var t = 0; t < all.length; t++) {
      var cl = all[t].track.clips;
      for (var c = 0; c < cl.numItems; c++) spans.push([cl[c].start.seconds, cl[c].end.seconds, all[t]]);
    }
    if (!spans.length) return EW.fail("The sequence is empty");
    spans.sort(function (x, y) { return x[0] - y[0]; });
    var gaps = [], cursor = 0;
    for (var i = 0; i < spans.length; i++) {
      if (spans[i][0] - cursor >= fd * 0.99) gaps.push([cursor, spans[i][0]]);
      cursor = Math.max(cursor, spans[i][1]);
    }
    if (!gaps.length) return EW.ok("No gaps: every moment has a clip on some track");
    var tracks = trackList(s, {});
    for (var k = 0; k < spans.length; k++) {
      var locked = spans[k][2].track.isLocked && spans[k][2].track.isLocked();
      if (locked && spans[k][0] >= gaps[0][1] - 0.0005) return EW.fail("Unlock " + (spans[k][2].kind === "video" ? "V" : "A") + (spans[k][2].index + 1) + " first: its clips would fall out of sync");
    }
    var total = 0;
    for (var g = gaps.length - 1; g >= 0; g--) { shiftLeft(tracks, gaps[g][1], gaps[g][1] - gaps[g][0]); total += gaps[g][1] - gaps[g][0]; }
    return EW.ok("Closed " + plural(gaps.length, "gap") + ", " + (Math.round(total * 10) / 10) + " s");
  };

  // Every other clip punched in, so jump cuts read like a second camera. args: { factor, back }
  T["pr.zoomAlternate"] = function (a) {
    var s = seq(), list = selected(s, true);
    if (list.length < 2) { list = []; var v1 = s.videoTracks[0].clips; for (var c = 0; c < v1.numItems; c++) list.push(v1[c]); }
    if (list.length < 2) return EW.fail("Select at least two clips, or put them on V1");
    list.sort(function (x, y) { return x.start.seconds - y.start.seconds; });
    var k = a.factor || 1.15, n = 0;
    for (var i = 1; i < list.length; i += 2) {
      var p = motion(list[i]).properties[1];
      setProp(p, Math.round((a.back ? p.getValue() / k : p.getValue() * k) * 100) / 100);
      n++;
    }
    return EW.ok((a.back ? "Zoomed back out " : "Punched in ") + plural(n, "clip"));
  };

  // The frame under the playhead as a PNG. args: { file }
  T["pr.exportFrame"] = function (a) {
    var s = seq(), q = qeSeq();
    q.exportFramePNG(q.CTI.timecode, a.file);
    return EW.ok("Frame exported", { file: a.file });
  };

  function importOne(binName, file) {
    var bin = childBin(binName), before = bin.children.numItems;
    if (!app.project.importFiles([file], true, bin, false)) return null;
    for (var c = bin.children.numItems - 1; c >= 0; c--) {
      var ch = bin.children[c];
      if (ch.getMediaPath && ch.getMediaPath() === file) return ch;
    }
    return bin.children.numItems > before ? bin.children[bin.children.numItems - 1] : null;
  }

  // A still at the playhead, on the lowest video track that is free there. args: { file, seconds }
  T["pr.placeImage"] = function (a) {
    var s = seq(), at = now(s), len = a.seconds || 5;
    var item = importOne("HaloCut Images", a.file);
    if (!item) return EW.fail("Premiere could not import the picture");
    item.setInPoint(0, 4); item.setOutPoint(len, 4);
    var target = null;
    for (var t = 1; t < s.videoTracks.numTracks && !target; t++) {
      var tr = s.videoTracks[t], free = true;
      for (var c = 0; c < tr.clips.numItems; c++) if (tr.clips[c].start.seconds < at + len && tr.clips[c].end.seconds > at) free = false;
      if (free) target = tr;
    }
    if (!target) {
      try { qeSeq().addTracks(1, s.videoTracks.numTracks, 0); } catch (e) {}
      target = s.videoTracks[s.videoTracks.numTracks - 1];
      for (var k = 0; k < target.clips.numItems; k++) if (target.clips[k].start.seconds < at + len && target.clips[k].end.seconds > at) return EW.fail("Add an empty video track on top first");
    }
    target.overwriteClip(item, at);
    return EW.ok("Picture placed at the playhead");
  };

  // Unnest (beta): the nest's clips come back where it was, trimmed to the part it played.
  // Scripts can't copy and paste in Premiere, so effects applied inside the nest are not carried over.
  T["pr.unnest"] = function (a) {
    var s = seq(), sel = s.getSelection(), nest = null;
    for (var i = 0; i < sel.length && !nest; i++) if (sel[i].projectItem && sel[i].projectItem.isSequence()) nest = sel[i];
    if (!nest) return EW.fail("Select a nested sequence on the timeline");
    var inner = null;
    for (var q = 0; q < app.project.sequences.numSequences; q++) {
      if (app.project.sequences[q].projectItem.nodeId === nest.projectItem.nodeId) inner = app.project.sequences[q];
    }
    if (!inner) return EW.fail("Could not open the nested sequence");
    if (a.keepCopy && !s.clone()) return EW.fail("Could not make a copy of the sequence, nothing changed");

    var nStart = nest.start.seconds, nIn = nest.inPoint.seconds, nOut = nest.outPoint.seconds;
    var baseV = 0, baseA = 0, nestNode = nest.projectItem.nodeId;
    var all = allTrackList(s);
    for (var t = 0; t < all.length; t++) {
      var cl = all[t].track.clips;
      for (var c = 0; c < cl.numItems; c++) {
        if (cl[c].projectItem && cl[c].projectItem.nodeId === nestNode && Math.abs(cl[c].start.seconds - nStart) < 0.001) {
          if (all[t].kind === "video") baseV = all[t].index; else baseA = all[t].index;
        }
      }
    }

    // what is on the timeline now, so anything Premiere adds by itself can be told apart
    var existing = {};
    for (var e1 = 0; e1 < all.length; e1++) for (var e2 = 0; e2 < all[e1].track.clips.numItems; e2++) existing[all[e1].track.clips[e2].nodeId] = true;

    var plan = [], skipped = 0;
    var kinds = [["video", inner.videoTracks, s.videoTracks, baseV], ["audio", inner.audioTracks, s.audioTracks, baseA]];
    for (var k = 0; k < kinds.length; k++) {
      for (var it = 0; it < kinds[k][1].numTracks; it++) {
        var clips = kinds[k][1][it].clips;
        for (var ci = 0; ci < clips.numItems; ci++) {
          var src = clips[ci];
          var a0 = Math.max(src.start.seconds, nIn), a1 = Math.min(src.end.seconds, nOut);
          if (a1 - a0 < 0.001) continue;
          if (!src.projectItem) { skipped++; continue; }
          plan.push({ kind: kinds[k][0], track: kinds[k][3] + it, item: src.projectItem,
            srcIn: src.inPoint.seconds + (a0 - src.start.seconds), len: a1 - a0, at: nStart + (a0 - nIn) });
        }
      }
    }
    if (!plan.length) return EW.fail("The nest has nothing in the part it plays");
    for (var p = 0; p < plan.length; p++) {
      var tracks = plan[p].kind === "video" ? s.videoTracks : s.audioTracks;
      if (plan[p].track >= tracks.numTracks) return EW.fail("Add " + (plan[p].track - tracks.numTracks + 1) + " more " + plan[p].kind + " track(s) first");
    }

    // take the nest out (its picture and its sound), then lay its clips in
    for (var r1 = 0; r1 < all.length; r1++) {
      var cr = all[r1].track.clips;
      for (var r2 = cr.numItems - 1; r2 >= 0; r2--) {
        if (cr[r2].projectItem && cr[r2].projectItem.nodeId === nestNode && Math.abs(cr[r2].start.seconds - nStart) < 0.001) cr[r2].remove(false, false);
      }
    }
    for (var m = 0; m < plan.length; m++) {
      var pl = plan[m], pi = pl.item;
      var prevIn = pi.getInPoint ? pi.getInPoint().seconds : 0, prevOut = pi.getOutPoint ? pi.getOutPoint().seconds : null;
      pi.setInPoint(pl.srcIn, 4);
      pi.setOutPoint(pl.srcIn + pl.len, 4);
      (pl.kind === "video" ? s.videoTracks : s.audioTracks)[pl.track].overwriteClip(pi, pl.at);
      pi.setInPoint(prevIn, 4);
      if (prevOut !== null) pi.setOutPoint(prevOut, 4);
    }

    // Premiere may lay a clip's linked sound or picture on a track of its own choosing: keep only what was planned
    var removedExtra = 0;
    var after = allTrackList(s);
    for (var x = 0; x < after.length; x++) {
      var cx = after[x].track.clips;
      for (var y = cx.numItems - 1; y >= 0; y--) {
        var ti = cx[y];
        if (existing[ti.nodeId]) continue;
        var wanted = false;
        for (var z = 0; z < plan.length && !wanted; z++) {
          wanted = plan[z].kind === after[x].kind && plan[z].track === after[x].index && Math.abs(plan[z].at - ti.start.seconds) < 0.002;
        }
        if (!wanted) { ti.remove(false, false); removedExtra++; }
      }
    }
    return EW.ok("Unnested " + plural(plan.length, "clip") + (skipped ? " (" + skipped + " graphics left out)" : "") + (a.keepCopy ? ", copy kept" : ""));
  };

  // ---- HaloCut Motion: a start look, an end look, the eased move between --------

  function cropComponent(item, add) {
    var c = component(item, "AE.ADBE Crop", "Crop");
    if (c || !add) return c;
    var q = qeSeq(), qi = qeItemFor(q, item), fx = qe.project.getVideoEffectByName("Crop");
    if (qi && fx) qi.addVideoEffect(fx);
    return component(item, "AE.ADBE Crop", "Crop");
  }

  function usesCrop(l) { return l.crop && (l.crop.l || l.crop.t || l.crop.r || l.crop.b); }

  // The properties a look drives, with how to read each value out of a look.
  function motionProps(item, withCrop) {
    var m = motion(item), out = [
      { p: m.properties[0], get: function (k) { return [k.x / 100, k.y / 100]; }, base: [0.5, 0.5] },
      { p: m.properties[1], get: function (k) { return k.scale; }, base: 100 },
      { p: m.properties[4], get: function (k) { return k.rotation; }, base: 0 }
    ];
    var o = component(item, "AE.ADBE Opacity", "Opacity");
    if (o) out.push({ p: o.properties[0], get: function (k) { return k.opacity; }, base: 100 });
    var c = cropComponent(item, withCrop);
    if (c) {
      out.push({ p: c.properties[0], get: function (k) { return k.crop.l; }, base: 0 });
      out.push({ p: c.properties[1], get: function (k) { return k.crop.t; }, base: 0 });
      out.push({ p: c.properties[2], get: function (k) { return k.crop.r; }, base: 0 });
      out.push({ p: c.properties[3], get: function (k) { return k.crop.b; }, base: 0 });
    }
    return out;
  }

  function same(a, b) {
    if (a instanceof Array) return Math.abs(a[0] - b[0]) < 1e-6 && Math.abs(a[1] - b[1]) < 1e-6;
    return Math.abs(a - b) < 1e-6;
  }

  function mixLook(a, b, p) {
    var m = function (x, y) { return x + (y - x) * p; }, c = function (v) { return Math.max(0, Math.min(100, v)); };
    return { x: m(a.x, b.x), y: m(a.y, b.y), scale: m(a.scale, b.scale), rotation: m(a.rotation, b.rotation),
      opacity: c(m(a.opacity, b.opacity)), crop: { l: c(m(a.crop.l, b.crop.l)), t: c(m(a.crop.t, b.crop.t)), r: c(m(a.crop.r, b.crop.r)), b: c(m(a.crop.b, b.crop.b)) } };
  }

  function sampleCurve(cv, t) {
    var n = cv.length - 1, x = Math.max(0, Math.min(1, t)) * n, i = Math.floor(x);
    return i >= n ? cv[n] : cv[i] + (cv[i + 1] - cv[i]) * (x - i);
  }

  // args: { start, end, curve: [progress...], timing: { mode, seconds } }
  T["pr.motionApply"] = function (a) {
    var s = seq(), sel = selected(s, true);
    if (!sel.length) return EW.fail("Select video clips on the timeline");
    if (sel.length > 40) return EW.fail("Up to 40 clips at once");
    var fd = s.getSettings().videoFrameRate.seconds || 0.04;
    var withCrop = usesCrop(a.start) || usesCrop(a.end);
    var keys = 0;
    for (var i = 0; i < sel.length; i++) {
      var item = sel[i], L = item.end.seconds - item.start.seconds, src = item.inPoint.seconds;
      var t = a.timing || {}, w;
      if (t.mode === "whole") w = [0, L];
      else { var len = Math.min(t.seconds || 0.8, L); w = t.mode === "end" ? [L - len, L] : [0, len]; }
      var props = motionProps(item, withCrop);
      for (var k = 0; k < props.length; k++) {
        var pr = props[k], v0 = pr.get(a.start), v1 = pr.get(a.end);
        var still = true;
        for (var c = 0; c < a.curve.length && still; c++) still = same(pr.get(mixLook(a.start, a.end, a.curve[c])), v0);
        if (still && same(v0, v1)) continue; // this property doesn't move in this look
        if (pr.p.isTimeVarying()) pr.p.setTimeVarying(false);
        pr.p.setTimeVarying(true);
        var frames = Math.max(1, Math.round((w[1] - w[0]) / fd));
        for (var f = 0; f <= frames; f++) {
          var at = w[0] + Math.min(w[1] - w[0], f * fd);
          var look = mixLook(a.start, a.end, sampleCurve(a.curve, frames ? f / frames : 1));
          var tm = new Time(); tm.seconds = src + at;
          pr.p.addKey(tm);
          pr.p.setValueAtKey(tm, pr.get(look), f === frames);
          keys++;
        }
      }
    }
    return EW.ok("Moved " + plural(sel.length, "clip") + " · " + keys + " keyframes, Premiere's own");
  };

  // Clips back to how they looked: keys cleared, values reset.
  T["pr.motionRemove"] = function () {
    var s = seq(), sel = selected(s, true);
    if (!sel.length) return EW.fail("Select video clips on the timeline");
    for (var i = 0; i < sel.length; i++) {
      var props = motionProps(sel[i], false);
      for (var k = 0; k < props.length; k++) {
        if (props[k].p.isTimeVarying()) props[k].p.setTimeVarying(false);
        props[k].p.setValue(props[k].base, true);
      }
    }
    return EW.ok("Motion removed from " + plural(sel.length, "clip"));
  };

  // ---- HaloCut Markers ---------------------------------------------------------

  function eachMarker(s, fn) {
    var mk = s.markers, m = mk.getFirstMarker(), list = [];
    while (m) { list.push(m); m = mk.getNextMarker(m); }
    for (var i = 0; i < list.length; i++) fn(list[i], i);
    return list;
  }

  function markerByGuid(s, guid) {
    var hit = null;
    eachMarker(s, function (m) { if (m.guid === guid) hit = m; });
    return hit;
  }

  T["pr.markersList"] = function () {
    var s = seq(), out = [];
    eachMarker(s, function (m) {
      var color = 0;
      try { color = m.getColorByIndex(); } catch (e) {}
      out.push({ guid: m.guid, start: m.start.seconds, end: m.end.seconds, name: m.name || "", comments: m.comments || "", color: color, type: m.type || "" });
    });
    var fd = s.getSettings().videoFrameRate.seconds || 0.04;
    return EW.ok(plural(out.length, "marker"), { markers: out, fps: Math.round(1 / fd * 1000) / 1000, sequence: s.name, end: Number(s.end) / TICKS });
  };

  // args: { changes: [{ guid, name?, comments?, color?, start? }] }
  T["pr.markersUpdate"] = function (a) {
    var s = seq(), n = 0;
    for (var i = 0; i < a.changes.length; i++) {
      var c = a.changes[i], m = markerByGuid(s, c.guid);
      if (!m) continue;
      if (c.name !== undefined) m.name = c.name;
      if (c.comments !== undefined) m.comments = c.comments;
      if (c.color !== undefined) m.setColorByIndex(c.color);
      if (c.start !== undefined) {
        var len = m.end.seconds - m.start.seconds, tm = new Time(), te = new Time();
        tm.seconds = c.start; te.seconds = c.start + Math.max(0, len);
        m.start = tm; m.end = te;
      }
      n++;
    }
    return EW.ok("Updated " + plural(n, "marker"));
  };

  // args: { items: [{ start, name, color, comments }] }
  T["pr.markersAdd"] = function (a) {
    var s = seq();
    for (var i = 0; i < a.items.length; i++) {
      var it = a.items[i], m = s.markers.createMarker(it.start);
      if (it.name) m.name = it.name;
      if (it.comments) m.comments = it.comments;
      if (it.color !== undefined) m.setColorByIndex(it.color);
    }
    return EW.ok("Added " + plural(a.items.length, "marker"));
  };

  T["pr.markersDelete"] = function (a) {
    var s = seq(), n = 0;
    for (var i = 0; i < a.guids.length; i++) {
      var m = markerByGuid(s, a.guids[i]);
      if (m) { s.markers.deleteMarker(m); n++; }
    }
    return EW.ok("Deleted " + plural(n, "marker"));
  };

  // Every clip start and end in the sequence, for snapping markers onto cuts.
  T["pr.cutTimes"] = function () {
    var s = seq(), items = allItems(s), seen = {}, out = [];
    for (var i = 0; i < items.length; i++) {
      var a = items[i].item.start.seconds, b = items[i].item.end.seconds;
      if (!seen[a]) { seen[a] = 1; out.push(a); }
      if (!seen[b]) { seen[b] = 1; out.push(b); }
    }
    return EW.ok("cuts", { cuts: out });
  };

  // Markers into edits: an add-edit at each time. args: { times: [s], all: bool }
  T["pr.cutAt"] = function (a) {
    var s = seq(), q = qeSeq(), before = s.getPlayerPosition().ticks, n = 0;
    var kinds = [["video", s.videoTracks], ["audio", s.audioTracks]];
    for (var t = 0; t < a.times.length; t++) {
      var tc = timecodeAt(s, q, frameSnap(s, a.times[t]));
      for (var k = 0; k < kinds.length; k++) {
        for (var i = 0; i < kinds[k][1].numTracks; i++) {
          var tr = kinds[k][1][i];
          if ((tr.isLocked && tr.isLocked()) || (!a.all && !tr.isTargeted())) continue;
          qeTrack(q, kinds[k][0], i).razor(tc);
        }
      }
      n++;
    }
    s.setPlayerPosition(before);
    return EW.ok("Cut at " + plural(n, "marker") + (a.all ? " on every track" : " on targeted tracks"));
  };

  // ---- HaloCut Beat ----------------------------------------------------------------

  var BEAT_NOTE = "HaloCut beat";

  // A scale bump on each beat time that falls inside each selected clip. args: { times: [s], amount: %, length: s }
  T["pr.pulse"] = function (a) {
    var s = seq(), sel = selected(s, true);
    if (!sel.length) return EW.fail("Select the video clips to pulse");
    var amt = (a.amount || 6) / 100, len = a.length || 0.18, bumps = 0;
    for (var i = 0; i < sel.length; i++) {
      var item = sel[i], p = motion(item).properties[1];
      var base = p.getValue();
      if (p.isTimeVarying()) { // pulsed before: the first key holds the clip's own scale
        var ks = p.getKeys ? p.getKeys() : null;
        base = ks && ks.length ? p.getValueAtKey(ks[0]) : 100;
      }
      if (p.isTimeVarying()) p.setTimeVarying(false);
      p.setValue(base, true);
      p.setTimeVarying(true);
      var t0 = item.start.seconds, t1 = item.end.seconds, src = item.inPoint.seconds, any = false;
      for (var k = 0; k < a.times.length; k++) {
        var t = a.times[k];
        if (t < t0 || t + len > t1) continue;
        var peak = Math.round(base * (1 + amt) * 100) / 100, marks = [[0, base], [len * 0.3, peak], [len, base]];
        for (var m = 0; m < marks.length; m++) {
          var tm = new Time(); tm.seconds = src + (t - t0) + marks[m][0];
          p.addKey(tm);
          p.setValueAtKey(tm, marks[m][1], false);
        }
        bumps++; any = true;
      }
      if (!any) { p.setTimeVarying(false); p.setValue(base, true); }
    }
    return bumps ? EW.ok("Pulsed " + bumps + " beats on " + plural(sel.length, "clip")) : EW.fail("No beats fall inside the selected clips");
  };

  T["pr.pulseRemove"] = function () {
    var s = seq(), sel = selected(s, true);
    if (!sel.length) return EW.fail("Select the video clips");
    for (var i = 0; i < sel.length; i++) {
      var p = motion(sel[i]).properties[1];
      if (!p.isTimeVarying()) continue;
      var keys = p.getKeys ? p.getKeys() : null;
      var base = keys && keys.length ? p.getValueAtKey(keys[0]) : 100;
      p.setTimeVarying(false);
      p.setValue(base, true);
    }
    return EW.ok("Pulse removed from " + plural(sel.length, "clip"));
  };

  // Only the markers HaloCut Beat added (they carry its note), never your own.
  T["pr.beatMarkersRemove"] = function () {
    var s = seq(), n = 0, gone = [];
    eachMarker(s, function (m) { if (m.comments === BEAT_NOTE) gone.push(m); });
    for (var i = 0; i < gone.length; i++) { s.markers.deleteMarker(gone[i]); n++; }
    return EW.ok(n ? "Removed " + plural(n, "beat marker") : "No beat markers to remove");
  };

  // ---- HaloCut Bins -------------------------------------------------------------

  // Every item and bin in the project, with the bin each one sits in.
  function walkProject() {
    var root = app.project.rootItem, items = [], bins = [{ id: root.nodeId, path: "", item: root }], byId = {}, parentOf = {};
    byId[root.nodeId] = root;
    (function walk(bin, path) {
      for (var i = 0; i < bin.children.numItems; i++) {
        var ch = bin.children[i];
        byId[ch.nodeId] = ch; parentOf[ch.nodeId] = bin.nodeId;
        if (ch.type === ProjectItemType.BIN) {
          var p = path ? path + "/" + ch.name : ch.name;
          bins.push({ id: ch.nodeId, path: p, item: ch });
          walk(ch, p);
        } else items.push({ item: ch, bin: path });
      }
    })(root, "");
    return { root: root, items: items, bins: bins, byId: byId, parentOf: parentOf };
  }

  function usedIds() {
    var used = {};
    for (var q = 0; q < app.project.sequences.numSequences; q++) {
      var sq = app.project.sequences[q], kinds = [sq.videoTracks, sq.audioTracks];
      for (var k = 0; k < 2; k++) for (var t = 0; t < kinds[k].numTracks; t++) {
        var cl = kinds[k][t].clips;
        for (var c = 0; c < cl.numItems; c++) if (cl[c].projectItem) used[cl[c].projectItem.nodeId] = true;
      }
    }
    return used;
  }

  T["pr.binScan"] = function () {
    if (!app.project) return EW.fail("Open a project first");
    var w = walkProject(), used = usedIds(), out = [];
    for (var i = 0; i < w.items.length; i++) {
      var it = w.items[i].item, isSeq = it.isSequence ? it.isSequence() : false, path = "";
      try { path = isSeq ? "" : (it.getMediaPath() || ""); } catch (e) {}
      var label = 0, off = false;
      try { label = it.getColorLabel(); } catch (e2) {}
      try { off = it.isOffline ? it.isOffline() : false; } catch (e3) {}
      out.push({ id: it.nodeId, name: it.name, isSequence: isSeq, path: path, bin: w.items[i].bin, label: label, offline: off, used: isSeq || !!used[it.nodeId] });
    }
    var bins = [];
    for (var b = 1; b < w.bins.length; b++) bins.push(w.bins[b].path);
    return EW.ok(plural(out.length, "item"), { items: out, bins: bins, project: app.project.name });
  };

  // What is selected in the Project panel (for Rename).
  T["pr.binSelection"] = function () {
    var sel = app.getCurrentProjectViewSelection ? app.getCurrentProjectViewSelection() : null, ids = [];
    if (sel) for (var i = 0; i < sel.length; i++) if (sel[i].type !== ProjectItemType.BIN) ids.push(sel[i].nodeId);
    return ids.length ? EW.ok(plural(ids.length, "item") + " selected", { ids: ids }) : EW.fail("Select items in the Project panel first");
  };

  // A bin by its path ("02 Footage/B-roll"), made if it isn't there.
  function ensureBin(w, path) {
    if (!path) return w.root;
    var parts = path.split("/"), bin = w.root, sofar = "";
    for (var i = 0; i < parts.length; i++) {
      sofar = sofar ? sofar + "/" + parts[i] : parts[i];
      var found = null;
      for (var c = 0; c < bin.children.numItems && !found; c++) {
        var ch = bin.children[c];
        if (ch.type === ProjectItemType.BIN && ch.name === parts[i]) found = ch;
      }
      if (!found) {
        var made = bin.createBin(parts[i]);
        found = made && made.nodeId ? made : null;
        for (var d = 0; d < bin.children.numItems && !found; d++) {
          if (bin.children[d].type === ProjectItemType.BIN && bin.children[d].name === parts[i]) found = bin.children[d];
        }
        w.byId[found.nodeId] = found;
      }
      bin = found;
    }
    return bin;
  }

  // args: { moves: [{ id, bin | binId }], renames: [{ id, name }], labels: [{ id, label }], relinks: [{ id, path }] }
  // Gives back the opposite of what it did, so the panel can Restore it.
  T["pr.binApply"] = function (a) {
    var w = walkProject(), undo = { moves: [], renames: [], labels: [], relinks: [] }, n = { moves: 0, renames: 0, labels: 0, relinks: 0 }, skipped = 0;
    var i, it;
    for (i = 0; i < (a.moves || []).length; i++) {
      var mv = a.moves[i]; it = w.byId[mv.id];
      if (!it) { skipped++; continue; }
      var dest = mv.binId ? w.byId[mv.binId] : ensureBin(w, mv.bin);
      if (!dest || dest.nodeId === w.parentOf[mv.id]) continue;
      undo.moves.push({ id: mv.id, binId: w.parentOf[mv.id] });
      it.moveBin(dest); w.parentOf[mv.id] = dest.nodeId; n.moves++;
    }
    for (i = 0; i < (a.renames || []).length; i++) {
      it = w.byId[a.renames[i].id];
      if (!it) { skipped++; continue; }
      undo.renames.push({ id: it.nodeId, name: it.name });
      it.name = a.renames[i].name; n.renames++;
    }
    for (i = 0; i < (a.labels || []).length; i++) {
      it = w.byId[a.labels[i].id];
      if (!it) { skipped++; continue; }
      var was = 0;
      try { was = it.getColorLabel(); } catch (e) {}
      undo.labels.push({ id: it.nodeId, label: was });
      it.setColorLabel(a.labels[i].label); n.labels++;
    }
    for (i = 0; i < (a.relinks || []).length; i++) {
      it = w.byId[a.relinks[i].id];
      if (!it || (it.canChangeMediaPath && !it.canChangeMediaPath())) { skipped++; continue; }
      var old = "";
      try { old = it.getMediaPath(); } catch (e4) {}
      if (it.changeMediaPath(a.relinks[i].path, true)) { undo.relinks.push({ id: it.nodeId, path: old }); n.relinks++; } else skipped++;
    }
    var parts = [];
    if (n.moves) parts.push("moved " + n.moves);
    if (n.renames) parts.push("renamed " + n.renames);
    if (n.labels) parts.push("labelled " + n.labels);
    if (n.relinks) parts.push("relinked " + n.relinks);
    var msg = parts.length ? parts.join(", ").replace(/^./, function (c) { return c.toUpperCase(); }) : "Nothing to change";
    return EW.ok(msg + (skipped ? " · " + skipped + " skipped" : ""), { undo: undo, done: n });
  };

  // ---- HaloCut Transitions -----------------------------------------------------------

  var TRANS_FX = {
    transform: ["AE.ADBE Geometry2", "Transform"], blur: ["AE.ADBE Gaussian Blur 2", "Gaussian Blur"],
    directional: ["AE.ADBE Motion Blur", "Directional Blur"], bright: ["AE.ADBE Brightness & Contrast 2", "Brightness & Contrast"]
  };

  function fxComponent(item, key, add) {
    var c = component(item, TRANS_FX[key][0], TRANS_FX[key][1]);
    if (c || !add) return c;
    var q = qeSeq(), qi = qeItemFor(q, item), fx = qe.project.getVideoEffectByName(TRANS_FX[key][1]);
    if (qi && fx) qi.addVideoEffect(fx);
    return component(item, TRANS_FX[key][0], TRANS_FX[key][1]);
  }

  function propNamed(comp, names, fallback) {
    for (var i = 0; i < comp.properties.numItems; i++) {
      for (var n = 0; n < names.length; n++) if (comp.properties[i].displayName === names[n]) return comp.properties[i];
    }
    return fallback !== undefined && fallback < comp.properties.numItems ? comp.properties[fallback] : null;
  }

  // The keyable values a plan drives, for one clip: [{ prop, get(values) }]
  function transProps(item, fx, nonUniform, add) {
    var out = [], c;
    for (var f = 0; f < fx.length; f++) {
      c = fxComponent(item, fx[f], add);
      if (!c) continue;
      if (fx[f] === "transform") {
        var uni = propNamed(c, ["Uniform Scale"], 2);
        if (uni && add) { try { uni.setValue(!nonUniform, true); } catch (e) {} }
        var shut = propNamed(c, ["Use Composition's Shutter Angle", "Use Composition\u2019s Shutter Angle"], 9);
        if (shut && add) { try { shut.setValue(false, true); } catch (e2) {} }
        out.push({ prop: propNamed(c, ["Position"], 1), get: function (v) { return [v.x, v.y]; }, base: [0.5, 0.5] });
        out.push({ prop: propNamed(c, nonUniform ? ["Scale Height", "Scale"] : ["Scale", "Scale Height"], 3), get: function (v) { return nonUniform ? v.scaleH : v.scale; }, base: 100 });
        if (nonUniform) out.push({ prop: propNamed(c, ["Scale Width"], 4), get: function (v) { return v.scaleW; }, base: 100 });
        out.push({ prop: propNamed(c, ["Rotation"], 7), get: function (v) { return v.rot; }, base: 0 });
        out.push({ prop: propNamed(c, ["Opacity"], 8), get: function (v) { return v.opacity; }, base: 100 });
        out.push({ prop: propNamed(c, ["Shutter Angle"], 10), get: function (v) { return v.shutter; }, base: 0 });
      } else if (fx[f] === "blur") {
        out.push({ prop: propNamed(c, ["Blurriness"], 0), get: function (v) { return v.blur; }, base: 0 });
      } else if (fx[f] === "directional") {
        out.push({ prop: propNamed(c, ["Direction"], 0), get: function (v) { return v.dir; }, base: 0 });
        out.push({ prop: propNamed(c, ["Blur Length"], 1), get: function (v) { return v.len; }, base: 0 });
      } else if (fx[f] === "bright") {
        out.push({ prop: propNamed(c, ["Brightness"], 0), get: function (v) { return v.bright; }, base: 0 });
      }
    }
    var keep = [];
    for (var k = 0; k < out.length; k++) if (out[k].prop) keep.push(out[k]);
    return keep;
  }

  function trackOfItem(s, item) {
    for (var t = 0; t < s.videoTracks.numTracks; t++) {
      var cl = s.videoTracks[t].clips;
      for (var c = 0; c < cl.numItems; c++) if (cl[c].nodeId === item.nodeId) return t;
    }
    return -1;
  }

  // The cuts to work on: between selected clips that touch on the same track, or the cut at the playhead.
  function cutsToDo(s) {
    var fd = s.getSettings().videoFrameRate.seconds || 0.04, sel = selected(s, true), pairs = [];
    if (sel.length >= 2) {
      for (var i = 0; i < sel.length; i++) for (var j = 0; j < sel.length; j++) {
        if (i !== j && Math.abs(sel[j].start.seconds - sel[i].end.seconds) < fd / 2 && trackOfItem(s, sel[i]) === trackOfItem(s, sel[j])) pairs.push([sel[i], sel[j]]);
      }
      return pairs;
    }
    var at = now(s);
    for (var t = 0; t < s.videoTracks.numTracks && !pairs.length; t++) {
      var cl = s.videoTracks[t].clips;
      for (var c = 0; c + 1 < cl.numItems; c++) {
        var a = cl[c], b = cl[c + 1];
        if (Math.abs(a.end.seconds - at) <= fd * 1.5 && Math.abs(b.start.seconds - a.end.seconds) < fd / 2) { pairs.push([a, b]); break; }
      }
    }
    return pairs;
  }

  // args: { plan: { fx, A: [values per frame], B: [...], nonUniform } }
  T["pr.transApply"] = function (a) {
    var s = seq(), fd = s.getSettings().videoFrameRate.seconds || 0.04, pairs = cutsToDo(s);
    if (!pairs.length) return EW.fail("Park the playhead on a cut, or select the clips on both sides of the cuts");
    var jobs = {}, order = [];
    function job(item) { if (!jobs[item.nodeId]) { jobs[item.nodeId] = { item: item, sides: [] }; order.push(item.nodeId); } return jobs[item.nodeId]; }
    for (var p = 0; p < pairs.length; p++) { job(pairs[p][0]).sides.push("A"); job(pairs[p][1]).sides.push("B"); }
    var keys = 0, n = a.plan.A.length - 1;
    for (var o = 0; o < order.length; o++) {
      var jb = jobs[order[o]], item = jb.item, L = item.end.seconds - item.start.seconds, src = item.inPoint.seconds;
      var props = transProps(item, a.plan.fx, a.plan.nonUniform, true);
      for (var k = 0; k < props.length; k++) {
        var pr = props[k], moves = false;
        for (var sd = 0; sd < jb.sides.length && !moves; sd++) {
          var vals = a.plan[jb.sides[sd]];
          for (var f = 0; f < vals.length && !moves; f++) moves = !same(pr.get(vals[f]), pr.base);
        }
        if (!moves) continue;
        if (pr.prop.isTimeVarying()) pr.prop.setTimeVarying(false);
        pr.prop.setTimeVarying(true);
        for (var sd2 = 0; sd2 < jb.sides.length; sd2++) {
          var side = jb.sides[sd2], v = a.plan[side], frames = Math.min(n, Math.floor(L / fd / 2));
          for (var fr = 0; fr <= frames; fr++) {
            // A: the last frames up to the cut; B: the first frames after it
            var idx = side === "A" ? n - frames + fr : fr;
            var at = side === "A" ? L - (frames - fr) * fd : fr * fd;
            var tm = new Time(); tm.seconds = src + Math.min(L, Math.max(0, at));
            pr.prop.addKey(tm);
            pr.prop.setValueAtKey(tm, pr.get(v[idx]), false);
            keys++;
          }
        }
      }
    }
    return EW.ok("Transition on " + plural(pairs.length, "cut") + " · " + keys + " keyframes");
  };

  // Scripts can't delete effects in Premiere: this sets the ones HaloCut uses back to neutral.
  T["pr.transRemove"] = function () {
    var s = seq(), sel = selected(s, true);
    if (!sel.length) return EW.fail("Select the clips");
    for (var i = 0; i < sel.length; i++) {
      var tf = fxComponent(sel[i], "transform", false), uni = tf ? propNamed(tf, ["Uniform Scale"], 2) : null;
      if (uni) { try { uni.setValue(true, true); } catch (e0) {} }
      var props = transProps(sel[i], ["transform", "blur", "directional", "bright"], false, false);
      for (var k = 0; k < props.length; k++) {
        if (props[k].prop.isTimeVarying()) props[k].prop.setTimeVarying(false);
        try { props[k].prop.setValue(props[k].base, true); } catch (e) {}
      }
    }
    return EW.ok("Transitions set back to neutral on " + plural(sel.length, "clip"));
  };

  // ---- HaloCut Split -------------------------------------------------------------

  T["pr.splitSource"] = function () {
    var s = seq();
    return EW.ok(s.name, { w: s.frameSizeHorizontal, h: s.frameSizeVertical, name: s.name });
  };

  // A new sequence with the active one nested once per pane, each cropped and placed.
  // args: { name, frame: { w, h }, panes: [{ scale, position, crop: { l, t, r, b } }] } (bottom pane first: it keeps the sound)
  T["pr.splitBuild"] = function (a) {
    var src = seq(), srcItem = src.projectItem;
    if (!srcItem) return EW.fail("Save the sequence in the project first");
    var bin = childBin("HaloCut Split screens");
    var made = app.project.createNewSequenceFromClips(a.name || (src.name + " split"), [srcItem], bin);
    if (!made) return EW.fail("Premiere would not make the new sequence");
    var ns = made;
    try {
      var st = ns.getSettings();
      st.videoFrameWidth = a.frame.w; st.videoFrameHeight = a.frame.h;
      ns.setSettings(st);
    } catch (e) { return EW.fail("Made the sequence, but could not set its size: " + e.message); }
    try { app.project.openSequence(ns.sequenceID); } catch (e2) {}
    // effects go on through the active sequence: never touch the source by mistake
    if (!app.project.activeSequence || app.project.activeSequence.sequenceID !== ns.sequenceID) {
      return EW.fail("Made “" + ns.name + "”, but Premiere didn't open it: open it and press Build again");
    }

    var need = a.panes.length;
    if (ns.videoTracks.numTracks < need) {
      try { app.enableQE(); qe.project.getActiveSequence().addTracks(need - ns.videoTracks.numTracks, ns.videoTracks.numTracks, 0); } catch (e3) {}
    }
    if (ns.videoTracks.numTracks < need) return EW.fail("Made the sequence, but it needs " + need + " video tracks");

    // only the first copy keeps its sound
    var keepAudio = {};
    for (var at = 0; at < ns.audioTracks.numTracks; at++) for (var c0 = 0; c0 < ns.audioTracks[at].clips.numItems; c0++) keepAudio[ns.audioTracks[at].clips[c0].nodeId] = true;
    for (var i = 1; i < need; i++) ns.videoTracks[i].overwriteClip(srcItem, 0);
    for (var at2 = 0; at2 < ns.audioTracks.numTracks; at2++) {
      var ac = ns.audioTracks[at2].clips;
      for (var c1 = ac.numItems - 1; c1 >= 0; c1--) if (!keepAudio[ac[c1].nodeId]) ac[c1].remove(false, false);
    }

    for (var p = 0; p < need; p++) {
      var clip = ns.videoTracks[p].clips[0], pane = a.panes[p];
      if (!clip) continue;
      var m = motion(clip);
      m.properties[0].setValue(pane.position, true);
      m.properties[1].setValue(pane.scale, true);
      var cr = pane.crop;
      if (cr.l || cr.t || cr.r || cr.b) {
        var crop = cropComponent(clip, true);
        if (crop) { crop.properties[0].setValue(cr.l, true); crop.properties[1].setValue(cr.t, true); crop.properties[2].setValue(cr.r, true); crop.properties[3].setValue(cr.b, true); }
      }
    }
    return EW.ok("Built “" + ns.name + "” · " + a.frame.w + "×" + a.frame.h + ", " + plural(need, "pane") + ". The source is untouched");
  };

  // ---- HaloCut Zoom: zooms, frame, focus, callouts and cards for screen recordings ----

  var ZOOM_BIN = "HaloCut Zoom";

  function isOverlay(item) {
    var n = item.projectItem ? item.projectItem.name : "";
    return n.indexOf("HaloCut ") === 0 || n === GUIDE_NAME;
  }

  function videoById(s, id) {
    for (var t = 0; t < s.videoTracks.numTracks; t++) {
      var cl = s.videoTracks[t].clips;
      for (var c = 0; c < cl.numItems; c++) if (cl[c].nodeId === id) return cl[c];
    }
    return null;
  }

  function covers(item, at) { return item.start.seconds <= at + 0.0005 && item.end.seconds > at + 0.0005; }

  // The clip at the playhead: a selected one under it, else the top clip under it.
  function clipHere(s) {
    var at = now(s), sel = selected(s, true);
    for (var i = 0; i < sel.length; i++) if (!isOverlay(sel[i]) && covers(sel[i], at)) return sel[i];
    for (var t = s.videoTracks.numTracks - 1; t >= 0; t--) {
      var cl = s.videoTracks[t].clips;
      for (var c = 0; c < cl.numItems; c++) if (!isOverlay(cl[c]) && covers(cl[c], at)) return cl[c];
    }
    return null;
  }

  // The selected clips (HaloCut's own pictures left out), or the one at the playhead.
  function clipsToFrame(s) {
    var sel = selected(s, true), out = [];
    for (var i = 0; i < sel.length; i++) if (!isOverlay(sel[i])) out.push(sel[i]);
    if (!out.length) { var h = clipHere(s); if (h) out.push(h); }
    return out;
  }

  // A HaloCut zoom always comes back to where the clip started, so its first key is the clip's own value.
  function baseOf(p) {
    if (p.isTimeVarying()) { var k = p.getKeys(); if (k && k.length) return p.getValueAtKey(k[0]); }
    return p.getValue();
  }

  function clipTime(item, t) { var tm = new Time(); tm.seconds = item.inPoint.seconds + (t - item.start.seconds); return tm; }

  function mediaSize(item, s) {
    var sz = sourceSize(item), pi = item.projectItem;
    if (sz) return sz;
    if (pi && pi.isSequence && pi.isSequence()) {
      for (var i = 0; i < app.project.sequences.numSequences; i++) {
        var q = app.project.sequences[i];
        if (q.projectItem && q.projectItem.nodeId === pi.nodeId) return { w: q.frameSizeHorizontal, h: q.frameSizeVertical };
      }
    }
    return frameSize(s);
  }

  function clipInfo(item, s) {
    var m = motion(item), f = frameSize(s), sc = baseOf(m.properties[1]), ps = baseOf(m.properties[0]), src = mediaSize(item, s);
    var w = src.w * sc / 100, h = src.h * sc / 100, inZoom = false;
    if (m.properties[1].isTimeVarying() && covers(item, now(s))) {
      try { inZoom = Math.abs(m.properties[1].getValueAtTime(clipTime(item, now(s))) - sc) > 0.01; } catch (e) {}
    }
    return { id: item.nodeId, name: item.name, start: item.start.seconds, end: item.end.seconds, track: trackOfItem(s, item),
      scale: sc, position: [ps[0], ps[1]], src: src, rect: { x: ps[0] * f.w - w / 2, y: ps[1] * f.h - h / 2, w: w, h: h }, inZoom: inZoom };
  }

  function isFree(tr, t0, t1) {
    for (var c = 0; c < tr.clips.numItems; c++) if (tr.clips[c].start.seconds < t1 - 0.001 && tr.clips[c].end.seconds > t0 + 0.001) return false;
    return true;
  }

  // The lowest video track from `from` up with nothing in [t0, t1]; a new one on top if none.
  function freeTrack(s, from, t0, t1) {
    for (var t = Math.max(0, from); t < s.videoTracks.numTracks; t++) if (isFree(s.videoTracks[t], t0, t1)) return t;
    try { qeSeq().addTracks(1, s.videoTracks.numTracks, 0); } catch (e) {}
    var last = s.videoTracks.numTracks - 1;
    return last >= from && isFree(s.videoTracks[last], t0, t1) ? last : -1;
  }

  // Just above everything that plays in [t0, t1].
  function aboveAll(s, t0, t1) {
    var top = -1;
    for (var t = 0; t < s.videoTracks.numTracks; t++) if (!isFree(s.videoTracks[t], t0, t1)) top = t;
    return top + 1;
  }

  function startingAt(tr, at) {
    for (var c = 0; c < tr.clips.numItems; c++) if (Math.abs(tr.clips[c].start.seconds - at) < 0.001) return tr.clips[c];
    return null;
  }

  function placeStill(s, pi, at, len, from) {
    var t = freeTrack(s, from, at, at + len);
    if (t < 0) return null;
    pi.setInPoint(0, 4); pi.setOutPoint(len, 4);
    s.videoTracks[t].overwriteClip(pi, at);
    return startingAt(s.videoTracks[t], at);
  }

  function fade(item, fin, fout) {
    var o = component(item, "AE.ADBE Opacity", "Opacity");
    if (!o || (!fin && !fout)) return;
    var p = o.properties[0], L = item.end.seconds - item.start.seconds, pts = [];
    if (fin) pts.push([0, 0], [fin, 100]);
    if (fout) pts.push([L - fout, 100], [L, 0]);
    p.setTimeVarying(true);
    for (var i = 0; i < pts.length; i++) {
      var tm = new Time(); tm.seconds = item.inPoint.seconds + pts[i][0];
      p.addKey(tm); p.setValueAtKey(tm, pts[i][1], i === pts.length - 1);
    }
  }

  T["pr.zoomInfo"] = function () {
    var s = seq(), fd = s.getSettings().videoFrameRate.seconds || 0.04, here = clipHere(s), list = clipsToFrame(s), clips = [];
    for (var i = 0; i < list.length; i++) clips.push(clipInfo(list[i], s));
    return EW.ok(s.name, { sequence: s.name, frame: frameSize(s), fps: Math.round(1000 / fd) / 1000, at: now(s),
      project: app.project.path || "", here: here ? clipInfo(here, s) : null, clips: clips });
  };

  // args: { id, at, keys: [{ t, z, a: [x, y] }] }: t in seconds from `at`, a in frame pixels
  T["pr.zoomAdd"] = function (a) {
    var s = seq(), item = videoById(s, a.id), f = frameSize(s), keys = a.keys;
    if (!item) return EW.fail("That clip is gone: grab the frame again");
    var len = keys[keys.length - 1].t;
    if (a.at < item.start.seconds - 0.001 || a.at + len > item.end.seconds + 0.001) return EW.fail("The zoom runs past the end of the clip: move the playhead earlier or shorten the hold");
    var m = motion(item), pp = m.properties[0], sp = m.properties[1], P0 = baseOf(pp), S0 = baseOf(sp);
    var t0 = clipTime(item, a.at), t1 = clipTime(item, a.at + len), both = [pp, sp], top = 1;
    for (var i = 0; i < 2; i++) {
      if (both[i].isTimeVarying()) { try { both[i].removeKeyRange(t0, t1, false); } catch (e) {} }
      else both[i].setTimeVarying(true);
    }
    for (var k = 0; k < keys.length; k++) {
      var tm = clipTime(item, a.at + keys[k].t), z = keys[k].z;
      top = Math.max(top, z);
      sp.addKey(tm); sp.setValueAtKey(tm, Math.round(S0 * z * 1000) / 1000, false);
      pp.addKey(tm); pp.setValueAtKey(tm, [(keys[k].a[0] + z * P0[0] * f.w) / f.w, (keys[k].a[1] + z * P0[1] * f.h) / f.h], k === keys.length - 1);
    }
    return EW.ok("Zoomed " + (Math.round(top * 10) / 10) + "× for " + (Math.round(len * 10) / 10) + " s · " + (keys.length * 2) + " keyframes");
  };

  T["pr.zoomClear"] = function () {
    var s = seq(), list = clipsToFrame(s), n = 0;
    for (var i = 0; i < list.length; i++) {
      var m = motion(list[i]), had = false;
      for (var p = 0; p < 2; p++) {
        var pr = m.properties[p];
        if (!pr.isTimeVarying()) continue;
        var b = baseOf(pr);
        pr.setTimeVarying(false); pr.setValue(b, true); had = true;
      }
      if (had) n++;
    }
    return n ? EW.ok("Zooms cleared on " + plural(n, "clip")) : EW.fail("No zooms on this clip");
  };

  // Scales a clip about the frame centre, keys and all, so zooms already on it still fit.
  function scaleAbout(item, k) {
    var m = motion(item);
    function each(p, fn) {
      if (!p.isTimeVarying()) { p.setValue(fn(p.getValue()), true); return; }
      var ks = p.getKeys() || [];
      for (var i = 0; i < ks.length; i++) p.setValueAtKey(ks[i], fn(p.getValueAtKey(ks[i])), i === ks.length - 1);
    }
    each(m.properties[1], function (v) { return Math.round(v * k * 1000) / 1000; });
    each(m.properties[0], function (v) { return [0.5 + k * (v[0] - 0.5), 0.5 + k * (v[1] - 0.5)]; });
  }

  // The frame picture above a clip, and how much it shrank the clip.
  function frameOver(s, item) {
    for (var t = trackOfItem(s, item) + 1; t < s.videoTracks.numTracks; t++) {
      var cl = s.videoTracks[t].clips;
      for (var c = 0; c < cl.numItems; c++) {
        var o = cl[c], n = o.projectItem ? o.projectItem.name : "";
        if (n.indexOf("HaloCut Frame") === 0 && Math.abs(o.start.seconds - item.start.seconds) < 0.001) {
          var m = n.match(/×([\d.]+)/);
          return { item: o, k: m ? parseFloat(m[1]) : 1 };
        }
      }
    }
    return null;
  }

  // args: { k, groups: [{ file, ids }] }: each clip shrinks by k and its frame picture goes on the track above
  T["pr.zoomFrame"] = function (a) {
    var s = seq(), n = 0, skipped = 0;
    for (var g = 0; g < a.groups.length; g++) {
      var pi = importOne(ZOOM_BIN, a.groups[g].file);
      if (!pi) return EW.fail("Premiere could not import the frame picture");
      pi.name = "HaloCut Frame ×" + a.k.toFixed(3);
      for (var i = 0; i < a.groups[g].ids.length; i++) {
        var item = videoById(s, a.groups[g].ids[i]);
        if (!item || frameOver(s, item)) { skipped++; continue; }
        var it = placeStill(s, pi, item.start.seconds, item.end.seconds - item.start.seconds, trackOfItem(s, item) + 1);
        if (!it) return EW.fail("No free video track above " + item.name);
        scaleAbout(item, a.k);
        n++;
      }
    }
    if (!n) return EW.fail("These clips already have a HaloCut frame");
    return EW.ok("Framed " + plural(n, "clip") + (skipped ? " · " + skipped + " already framed" : ""));
  };

  T["pr.zoomUnframe"] = function () {
    var s = seq(), list = clipsToFrame(s), n = 0;
    for (var i = 0; i < list.length; i++) {
      var fr = frameOver(s, list[i]);
      if (!fr) continue;
      fr.item.remove(false, false);
      scaleAbout(list[i], 1 / fr.k);
      n++;
    }
    return n ? EW.ok("Frame removed from " + plural(n, "clip")) : EW.fail("No HaloCut frame on these clips");
  };

  // A still on top at the playhead: a spotlight, callout or black box. args: { file, name, len, fade }
  T["pr.zoomOverlay"] = function (a) {
    var s = seq(), at = now(s), len = Math.max(frameSnap(s, a.len || 3), 0.1);
    var pi = importOne(ZOOM_BIN, a.file);
    if (!pi) return EW.fail("Premiere could not import the picture");
    pi.name = "HaloCut " + a.name;
    var it = placeStill(s, pi, at, len, aboveAll(s, at, at + len));
    if (!it) return EW.fail("No free video track for it");
    if (a.fade) fade(it, Math.min(a.fade, len / 3), Math.min(a.fade, len / 3));
    return EW.ok(a.name + " on V" + (trackOfItem(s, it) + 1) + " for " + (Math.round(len * 10) / 10) + " s");
  };

  // The copy moves exactly like the clip: the same values, and keys where the clip has them.
  function followMotion(from, to, t0, t1) {
    var a = motion(from).properties, b = motion(to).properties;
    for (var i = 0; i < a.numItems && i < b.numItems; i++) {
      var p = a[i], q = b[i];
      try {
        if (!p.isTimeVarying()) { q.setValue(p.getValue(), true); continue; }
        q.setTimeVarying(true);
        var times = [t0, t1], ks = p.getKeys() || [];
        for (var k = 0; k < ks.length; k++) {
          var st = from.start.seconds + (ks[k].seconds - from.inPoint.seconds);
          if (st > t0 + 0.0005 && st < t1 - 0.0005) times.push(st);
        }
        for (var j = 0; j < times.length; j++) {
          var tm = clipTime(to, times[j]);
          q.addKey(tm); q.setValueAtKey(tm, p.getValueAtTime(clipTime(from, times[j])), j === times.length - 1);
        }
      } catch (e) {}
    }
  }

  // A picture-only copy of the clip at the playhead, blurred or pixelated, then cropped to the box.
  // args: { id, len, crop: { l, t, r, b }, mode: "blur" | "pixel", amount, blocks: [across, down] }
  T["pr.zoomBlur"] = function (a) {
    var s = seq(), at = now(s), fd = s.getSettings().videoFrameRate.seconds || 0.04, item = videoById(s, a.id);
    if (!item || !covers(item, at)) item = clipHere(s);
    if (!item) return EW.fail("Park the playhead on the clip");
    var pi = item.projectItem;
    if (!pi || (pi.isSequence && pi.isSequence())) return EW.fail("Blur needs a clip from a media file, not a nested sequence");
    var len = Math.min(frameSnap(s, a.len || 3), item.end.seconds - at);
    if (len < fd) return EW.fail("Park the playhead inside the clip");
    var sub = null;
    // a subclip without sound, so nothing lands on (or over) your audio tracks
    try { sub = pi.createSubClip("HaloCut Blur · " + pi.name, clipTime(item, at), clipTime(item, at + len), 0, 1, 0); } catch (e) {}
    if (!sub) return EW.fail("Premiere would not make a picture-only copy of this clip");
    try { sub.moveBin(childBin(ZOOM_BIN)); } catch (e1) {}
    var tr = freeTrack(s, trackOfItem(s, item) + 1, at, at + len);
    if (tr < 0) return EW.fail("No free video track above the clip");
    s.videoTracks[tr].overwriteClip(sub, at);
    var copy = startingAt(s.videoTracks[tr], at);
    if (!copy) return EW.fail("Premiere didn't place the copy");
    followMotion(item, copy, at, at + len - fd);
    // effects run before Motion, in the order added: blur first, then crop, so the box keeps a clean edge
    var pixel = a.mode === "pixel", q = qeSeq(), qi = qeItemFor(q, copy);
    var fx = qe.project.getVideoEffectByName(pixel ? "Mosaic" : "Gaussian Blur");
    if (qi && fx) qi.addVideoEffect(fx);
    var c = pixel ? component(copy, "AE.ADBE Mosaic", "Mosaic") : component(copy, "AE.ADBE Gaussian Blur 2", "Gaussian Blur");
    if (!c) return EW.fail("Placed the copy, but couldn't add " + (pixel ? "Mosaic" : "Gaussian Blur"));
    if (pixel) {
      propNamed(c, ["Horizontal Blocks"], 0).setValue(a.blocks[0], false);
      propNamed(c, ["Vertical Blocks"], 1).setValue(a.blocks[1], true);
    } else {
      propNamed(c, ["Blurriness"], 0).setValue(a.amount || 40, true);
      var edge = propNamed(c, ["Repeat Edge Pixels"], 2);
      if (edge) { try { edge.setValue(true, true); } catch (e2) {} }
    }
    var crop = cropComponent(copy, true);
    if (!crop) return EW.fail("Blurred the copy, but couldn't add Crop to fit it to the box");
    crop.properties[0].setValue(a.crop.l, false); crop.properties[1].setValue(a.crop.t, false);
    crop.properties[2].setValue(a.crop.r, false); crop.properties[3].setValue(a.crop.b, true);
    return EW.ok((pixel ? "Pixelated" : "Blurred") + " the box on V" + (tr + 1) + " for " + (Math.round(len * 10) / 10) + " s");
  };

  // args: { file, title, where: "intro" | "outro", len, push, fade }
  T["pr.zoomCard"] = function (a) {
    var s = seq(), len = frameSnap(s, a.len || 3), outro = a.where === "outro", all = allTrackList(s), endAt = 0, at = 0, from = 0;
    for (var t = 0; t < all.length; t++) {
      var cl = all[t].track.clips;
      for (var c = 0; c < cl.numItems; c++) endAt = Math.max(endAt, cl[c].end.seconds);
    }
    if (outro) at = endAt;
    else if (a.push) {
      for (var t2 = 0; t2 < all.length; t2++) {
        var tr = all[t2].track;
        if (tr.isLocked && tr.isLocked() && tr.clips.numItems) return EW.fail("Unlock " + (all[t2].kind === "video" ? "V" : "A") + (all[t2].index + 1) + " first: its clips would fall out of sync");
      }
      shiftRight(trackList(s, {}), 0, len);
    } else from = aboveAll(s, 0, len);
    var pi = importOne(ZOOM_BIN, a.file);
    if (!pi) return EW.fail("Premiere could not import the card");
    pi.name = "HaloCut Card · " + (a.title || (outro ? "Outro" : "Intro"));
    var it = placeStill(s, pi, at, len, from);
    if (!it) return EW.fail("No free video track for the card");
    if (a.fade) { var fl = Math.min(a.fade, len / 2); if (outro) fade(it, fl, 0); else fade(it, 0, fl); }
    var secs = Math.round(len * 10) / 10;
    return EW.ok((outro ? "Outro" : "Intro") + " card, " + secs + " s" + (!outro && a.push ? " · everything else moved " + secs + " s later (markers and captions stay put)" : ""));
  };

  // ---- HaloCut Caption Styles: a picture per caption state, on a track of its own -------------

  var CAPS_NAME = "HaloCut Caption";

  function captionItems(s) {
    var out = [];
    for (var t = 0; t < s.videoTracks.numTracks; t++) {
      var cl = s.videoTracks[t].clips;
      for (var c = 0; c < cl.numItems; c++) if (cl[c].projectItem && cl[c].projectItem.name.indexOf(CAPS_NAME) === 0) out.push(cl[c]);
    }
    return out;
  }

  T["pr.capsInfo"] = function () {
    var s = seq(), fd = s.getSettings().videoFrameRate.seconds || 0.04;
    return EW.ok(s.name, { sequence: s.name, frame: frameSize(s), fps: Math.round(1000 / fd) / 1000, project: app.project.path || "", placed: captionItems(s).length, at: now(s) });
  };

  // A caption arriving: pop (grows a little past full size), rise (slides up) or fade, over its first frames.
  function captionMotion(item, kind, anchor, s) {
    var fd = s.getSettings().videoFrameRate.seconds || 0.04, src = item.inPoint.seconds, m = motion(item);
    if ((item.end.seconds - item.start.seconds) / fd < 5) return; // too short to see it move
    function key(p, f, v, last) { var tm = new Time(); tm.seconds = src + f * fd; p.addKey(tm); p.setValueAtKey(tm, v, last); }
    if (kind === "pop") {
      if (anchor) { m.properties[5].setValue(anchor, true); m.properties[0].setValue(anchor, true); } // grow about the caption, not the frame's middle
      var sp = m.properties[1];
      sp.setTimeVarying(true);
      key(sp, 0, 86, false); key(sp, 2, 104, false); key(sp, 4, 100, true);
    } else if (kind === "rise") {
      var pp = m.properties[0], base = pp.getValue();
      pp.setTimeVarying(true);
      key(pp, 0, [base[0], base[1] + 0.025], false); key(pp, 5, [base[0], base[1]], true);
    }
    if (kind === "fade" || kind === "rise") {
      var o = component(item, "AE.ADBE Opacity", "Opacity");
      if (o) { var op = o.properties[0]; op.setTimeVarying(true); key(op, 0, 0, false); key(op, kind === "fade" ? 4 : 5, 100, true); }
    }
  }

  // args: { files: [{ file, name, start, end, motion, anchor }], span: [t0, t1], track }
  // The first batch picks a free track above everything in the span (track -1); later batches pass it back.
  T["pr.capsPlace"] = function (a) {
    var s = seq(), list = a.files, paths = [];
    for (var i = 0; i < list.length; i++) paths.push(list[i].file);
    var bin = childBin("HaloCut Captions");
    if (!app.project.importFiles(paths, true, bin, false)) return EW.fail("Premiere could not import the caption pictures");
    var byPath = {};
    for (var c = 0; c < bin.children.numItems; c++) { var ch = bin.children[c]; if (ch.getMediaPath) byPath[ch.getMediaPath()] = ch; }
    var tr = a.track;
    if (tr === undefined || tr === null || tr < 0) tr = freeTrack(s, aboveAll(s, a.span[0], a.span[1]), a.span[0], a.span[1]);
    if (tr < 0) return EW.fail("No free video track for the captions");
    var track = s.videoTracks[tr], placed = 0;
    for (var j = 0; j < list.length; j++) {
      var f = list[j], pi = byPath[f.file];
      if (!pi) continue;
      pi.name = CAPS_NAME + " · " + f.name;
      pi.setInPoint(0, 4); pi.setOutPoint(f.end - f.start, 4);
      track.overwriteClip(pi, f.start);
      var it = startingAt(track, f.start);
      if (it && f.motion && f.motion !== "none") captionMotion(it, f.motion, f.anchor, s);
      placed++;
    }
    return EW.ok("Placed " + plural(placed, "caption picture") + " on V" + (tr + 1), { track: tr, placed: placed });
  };

  T["pr.capsRemove"] = function () {
    var s = seq(), list = captionItems(s);
    for (var i = list.length - 1; i >= 0; i--) list[i].remove(false, false);
    return list.length ? EW.ok("Removed " + plural(list.length, "caption picture")) : EW.fail("No HaloCut styled captions in this sequence");
  };

  // ---- HaloCut Toolbar: QC check, freeze frames, stairs, J and L cuts ------------------------

  // Everything worth a second look before export. Each issue: { kind, start, end, track, text }
  T["pr.qcCheck"] = function () {
    var s = seq(), fd = s.getSettings().videoFrameRate.seconds || 0.04, f = frameSize(s), issues = [], spans = [], end = 0;
    function frames(sec) { return Math.round(sec / fd); }
    for (var t = 0; t < s.videoTracks.numTracks; t++) {
      var cl = s.videoTracks[t].clips;
      for (var c = 0; c < cl.numItems; c++) {
        var it = cl[c], st = it.start.seconds, en = it.end.seconds, pi = it.projectItem, name = it.name, tag = "V" + (t + 1);
        end = Math.max(end, en);
        if (pi && pi.name === GUIDE_NAME) continue;
        if (it.disabled) { issues.push({ kind: "disabled", start: st, end: en, track: tag, text: name + " is switched off" }); continue; }
        spans.push([st, en]);
        if (frames(en - st) <= 2) issues.push({ kind: "flash", start: st, end: en, track: tag, text: name + ": only " + plural(frames(en - st), "frame") });
        if (pi && pi.isOffline && pi.isOffline()) issues.push({ kind: "offline", start: st, end: en, track: tag, text: name + " is offline" });
        if (t === 0 && !isOverlay(it)) {
          // the bottom layer: anything it doesn't cover shows black
          try {
            var m = motion(it), sc = baseOf(m.properties[1]) / 100, ps = baseOf(m.properties[0]), src = mediaSize(it, s);
            var w = src.w * sc, h = src.h * sc, x = ps[0] * f.w - w / 2, y = ps[1] * f.h - h / 2;
            if (x > 1 || y > 1 || x + w < f.w - 1 || y + h < f.h - 1) issues.push({ kind: "edges", start: st, end: en, track: tag, text: name + " doesn't fill the frame" });
          } catch (e) {}
        }
      }
    }
    for (var a = 0; a < s.audioTracks.numTracks; a++) {
      var ac = s.audioTracks[a].clips;
      for (var k = 0; k < ac.numItems; k++) {
        var ai = ac[k]; end = Math.max(end, ai.end.seconds);
        if (ai.projectItem && ai.projectItem.isOffline && ai.projectItem.isOffline()) issues.push({ kind: "offline", start: ai.start.seconds, end: ai.end.seconds, track: "A" + (a + 1), text: ai.name + " is offline" });
      }
    }
    spans.sort(function (x, y) { return x[0] - y[0]; });
    var cursor = 0;
    for (var g = 0; g < spans.length; g++) {
      if (spans[g][0] - cursor >= fd * 0.99) {
        var n = frames(spans[g][0] - cursor);
        issues.push({ kind: "gap", start: cursor, end: spans[g][0], track: "", text: "Black for " + (n <= 12 ? plural(n, "frame") : (Math.round((spans[g][0] - cursor) * 10) / 10) + " s") });
      }
      cursor = Math.max(cursor, spans[g][1]);
    }
    var guides = guideItems(s);
    for (var q = 0; q < guides.length; q++) if (!guides[q].disabled) { issues.push({ kind: "guides", start: 0, end: end, track: "", text: "Guides are showing: they would be in the export" }); break; }
    issues.sort(function (x, y) { return x.start - y.start; });
    return EW.ok(issues.length ? plural(issues.length, "thing") + " to look at" : "All clear", { issues: issues, end: end, fps: Math.round(1000 / fd) / 1000 });
  };

  // The frame at the playhead held for `len` s. args: { file, len, insert }
  // Insert makes room (everything after moves later); otherwise the still covers the clip on the track above.
  T["pr.freeze"] = function (a) {
    var s = seq(), at = frameSnap(s, now(s)), len = Math.max(frameSnap(s, a.len || 2), 0.04), here = clipHere(s);
    if (!here) return EW.fail("Park the playhead on a clip");
    var track = trackOfItem(s, here), name = here.name;
    var pi = importOne("HaloCut Freeze frames", a.file);
    if (!pi) return EW.fail("Premiere could not import the frame");
    pi.name = "HaloCut Freeze · " + name;
    var it;
    if (a.insert) {
      var all = allTrackList(s);
      for (var i = 0; i < all.length; i++) if (all[i].track.isLocked && all[i].track.isLocked() && all[i].track.clips.numItems) return EW.fail("Unlock " + (all[i].kind === "video" ? "V" : "A") + (all[i].index + 1) + " first: its clips would fall out of sync");
      var q = qeSeq(), before = s.getPlayerPosition().ticks, tc = timecodeAt(s, q, at), tracks = trackList(s, {});
      for (var t = 0; t < tracks.length; t++) qeTrack(q, tracks[t].kind, tracks[t].index).razor(tc);
      shiftRight(tracks, at, len);
      s.setPlayerPosition(before);
      it = placeStill(s, pi, at, len, track);
    } else it = placeStill(s, pi, at, len, track + 1);
    if (!it) return EW.fail("No free video track for the frame");
    return EW.ok("Froze " + name + " for " + (Math.round(len * 10) / 10) + " s" + (a.insert ? " · everything after moved later" : " on V" + (trackOfItem(s, it) + 1)));
  };

  // Selected clips in steps across their tracks. args: { frames, up }: down = the top track first.
  T["pr.stair"] = function (a) {
    var s = seq(), fd = s.getSettings().videoFrameRate.seconds || 0.04, sel = selected(s, true), list = [];
    for (var i = 0; i < sel.length; i++) list.push({ item: sel[i], track: trackOfItem(s, sel[i]) });
    if (list.length < 2) return EW.fail("Select two or more clips on different tracks");
    list.sort(function (x, y) { return a.up ? x.track - y.track : y.track - x.track; });
    var base = list[0].item.start.seconds, step = (a.frames || 5) * fd, targets = [];
    for (var k = 0; k < list.length; k++) targets.push({ id: list[k].item.nodeId, to: base + k * step });
    // the furthest move first, so nothing lands on a clip that hasn't moved yet
    targets.sort(function (x, y) { return y.to - x.to; });
    for (var m = 0; m < targets.length; m++) {
      var it = videoById(s, targets[m].id), off = targets[m].to - it.start.seconds;
      if (Math.abs(off) < 0.0005) continue;
      var tm = new Time(); tm.seconds = off; it.move(tm);
    }
    return EW.ok("Stair " + (a.up ? "up" : "down") + ": " + plural(list.length, "clip") + ", " + (a.frames || 5) + " frames apart");
  };

  function setEdge(item, which, sec) { var tm = new Time(); tm.seconds = sec; item[which] = tm; }
  function near(x, y) { return Math.abs(x - y) < 0.002; }
  // A clip's own sound: the same media, lined up with its far edge (the edge at the cut may already be a J or L cut).
  function soundOf(s, v, before) {
    var out = [], name = v.projectItem ? v.projectItem.name : null;
    for (var t = 0; t < s.audioTracks.numTracks; t++) {
      var cl = s.audioTracks[t].clips;
      for (var c = 0; c < cl.numItems; c++) {
        var it = cl[c], same = !name || (it.projectItem && it.projectItem.name === name);
        var lined = before ? near(it.start.seconds, v.start.seconds) && Math.abs(it.end.seconds - v.end.seconds) < 3
          : near(it.end.seconds, v.end.seconds) && Math.abs(it.start.seconds - v.start.seconds) < 3;
        if (same && lined) out.push(it);
      }
    }
    return out;
  }

  // J cut: the next clip's sound starts early. L cut: this clip's sound runs on. args: { kind: "j" | "l", frames }
  // Each trim is checked straight after; if Premiere did anything else, it is put back.
  T["pr.jlCut"] = function (a) {
    var s = seq(), fd = s.getSettings().videoFrameRate.seconds || 0.04, pairs = cutsToDo(s);
    if (!pairs.length) return EW.fail("Park the playhead on a cut between two clips");
    var A = pairs[0][0], B = pairs[0][1], cut = A.end.seconds, n = (a.frames || 12) * fd, j = a.kind === "j";
    var As = soundOf(s, A, true), Bs = soundOf(s, B, false);
    if (!As.length || !Bs.length) return EW.fail("Both clips need their own sound under them");
    var vA = [A.start.seconds, A.end.seconds], vB = [B.start.seconds, B.end.seconds];
    // unlink so only the sound is trimmed; linked again after
    var sel = s.getSelection();
    for (var i = 0; i < sel.length; i++) sel[i].setSelected(false, false);
    var group = [A, B].concat(As, Bs);
    for (var g = 0; g < group.length; g++) group[g].setSelected(true, false);
    s.unlinkSelection();
    var ok = true, why = "";
    function relink() {
      for (var x = 0; x < group.length; x++) group[x].setSelected(false, false);
      A.setSelected(true, false); for (var p = 0; p < As.length; p++) As[p].setSelected(true, false);
      s.linkSelection();
      A.setSelected(false, false); for (var p2 = 0; p2 < As.length; p2++) As[p2].setSelected(false, false);
      B.setSelected(true, false); for (var q = 0; q < Bs.length; q++) Bs[q].setSelected(true, false);
      s.linkSelection();
      B.setSelected(false, false); for (var q2 = 0; q2 < Bs.length; q2++) Bs[q2].setSelected(false, true);
    }
    // shorten first, then lengthen into the room that made
    var first = j ? As : Bs, second = j ? Bs : As, edge1 = j ? "end" : "start", edge2 = j ? "start" : "end", to = j ? cut - n : cut + n;
    var was1 = [], was2 = [];
    for (var w1 = 0; w1 < first.length; w1++) was1.push(first[w1][edge1].seconds);
    for (var w2 = 0; w2 < second.length; w2++) was2.push(second[w2][edge2].seconds);
    for (var f = 0; f < first.length && ok; f++) {
      var keep = edge1 === "start" ? first[f].end.seconds : first[f].start.seconds;
      setEdge(first[f], edge1, to);
      var other = edge1 === "start" ? first[f].end.seconds : first[f].start.seconds;
      if (!near(first[f][edge1].seconds, to) || !near(other, keep)) { ok = false; why = "Premiere wouldn't trim the sound there"; }
    }
    for (var h = 0; h < second.length && ok; h++) {
      var keep2 = edge2 === "start" ? second[h].end.seconds : second[h].start.seconds;
      setEdge(second[h], edge2, to);
      var other2 = edge2 === "start" ? second[h].end.seconds : second[h].start.seconds;
      if (!near(other2, keep2)) { ok = false; why = "Premiere moved the sound instead of trimming it"; }
      else if (!near(second[h][edge2].seconds, to)) { ok = false; why = "There isn't " + (a.frames || 12) + " frames of extra sound in the media to stretch into"; }
    }
    if (!near(A.start.seconds, vA[0]) || !near(A.end.seconds, vA[1]) || !near(B.start.seconds, vB[0]) || !near(B.end.seconds, vB[1])) { ok = false; why = "The picture moved too"; }
    if (!ok) { // put every edge back where it was: the lengthened ones first, so they make room again
      for (var r = 0; r < second.length; r++) setEdge(second[r], edge2, was2[r]);
      for (var r2 = 0; r2 < first.length; r2++) setEdge(first[r2], edge1, was1[r2]);
    }
    relink();
    return ok ? EW.ok((j ? "J cut: the next sound starts " : "L cut: the sound runs on ") + (a.frames || 12) + " frames " + (j ? "early" : "past the cut")) : EW.fail(why + ": nothing changed");
  };

  // ---- HaloCut Command: Premiere commands, made a little sharper ----------------------------------

  function anyById(s, id) {
    var kinds = [s.videoTracks, s.audioTracks];
    for (var k = 0; k < 2; k++) for (var t = 0; t < kinds[k].numTracks; t++) {
      var cl = kinds[k][t].clips;
      for (var c = 0; c < cl.numItems; c++) if (cl[c].nodeId === id) return cl[c];
    }
    return null;
  }

  // Moves clips by `d` seconds: worked out first, then the furthest-travelling end first, so a clip that went
  // along with its linked partner is never moved twice and nothing runs into a clip that hasn't moved yet.
  function moveAll(s, list, d) {
    var targets = [];
    for (var i = 0; i < list.length; i++) targets.push({ id: list[i].nodeId, to: list[i].start.seconds + d });
    targets.sort(function (x, y) { return d > 0 ? y.to - x.to : x.to - y.to; });
    for (var m = 0; m < targets.length; m++) {
      var it = anyById(s, targets[m].id);
      if (!it) continue;
      var off = targets[m].to - it.start.seconds;
      if (Math.abs(off) < 0.0005) continue;
      var tm = new Time(); tm.seconds = off; it.move(tm);
    }
  }

  // args: { frames } (negative = left)
  T["pr.nudge"] = function (a) {
    var s = seq(), sel = s.getSelection(), fd = s.getSettings().videoFrameRate.seconds || 0.04, list = [];
    for (var i = 0; i < sel.length; i++) list.push(sel[i]);
    if (!list.length) return EW.fail("Select clips to nudge");
    var d = (a.frames || 1) * fd, first = 1e9;
    for (var j = 0; j < list.length; j++) first = Math.min(first, list[j].start.seconds);
    if (first + d < -0.0005) return EW.fail("They're already at the start of the sequence");
    moveAll(s, list, d);
    var n = Math.abs(a.frames || 1);
    return EW.ok("Nudged " + plural(list.length, "clip") + " " + plural(n, "frame") + ((a.frames || 1) < 0 ? " left" : " right"));
  };

  T["pr.moveToPlayhead"] = function () {
    var s = seq(), sel = s.getSelection(), list = [], first = 1e9;
    for (var i = 0; i < sel.length; i++) { list.push(sel[i]); first = Math.min(first, sel[i].start.seconds); }
    if (!list.length) return EW.fail("Select clips to move");
    var d = frameSnap(s, now(s)) - first;
    if (Math.abs(d) < 0.0005) return EW.ok("Already at the playhead");
    moveAll(s, list, d);
    return EW.ok("Moved " + plural(list.length, "clip") + " to the playhead");
  };

  // The gap the playhead sits in, closed on every track (and only that one).
  T["pr.closeGapHere"] = function () {
    var s = seq(), t = now(s), all = allTrackList(s), before = 0, after = 1e9;
    for (var k = 0; k < all.length; k++) {
      var cl = all[k].track.clips;
      for (var c = 0; c < cl.numItems; c++) {
        var a0 = cl[c].start.seconds, a1 = cl[c].end.seconds;
        if (a0 <= t + 0.0005 && a1 > t + 0.0005) return EW.fail("No gap at the playhead: something plays there on " + (all[k].kind === "video" ? "V" : "A") + (all[k].index + 1));
        if (a1 <= t + 0.0005) before = Math.max(before, a1);
        if (a0 > t) after = Math.min(after, a0);
      }
    }
    if (after === 1e9) return EW.fail("Nothing comes after the playhead");
    for (var l = 0; l < all.length; l++) {
      var tr = all[l].track;
      if (tr.isLocked && tr.isLocked()) for (var q = 0; q < tr.clips.numItems; q++) if (tr.clips[q].start.seconds >= after - 0.0005) return EW.fail("Unlock " + (all[l].kind === "video" ? "V" : "A") + (all[l].index + 1) + " first: its clips would fall out of sync");
    }
    shiftLeft(trackList(s, {}), after, after - before);
    return EW.ok("Closed a gap of " + (Math.round((after - before) * 100) / 100) + " s");
  };

  T["pr.deleteDisabled"] = function () {
    var s = seq(), all = allTrackList(s), n = 0;
    for (var k = 0; k < all.length; k++) {
      var cl = all[k].track.clips;
      for (var c = cl.numItems - 1; c >= 0; c--) if (cl[c].disabled) { cl[c].remove(false, false); n++; }
    }
    return n ? EW.ok("Deleted " + plural(n, "switched-off clip")) : EW.fail("No switched-off clips in this sequence");
  };

  // args: { dir: 1 | -1 }
  T["pr.markerJump"] = function (a) {
    var s = seq(), t = now(s), best = null, fwd = (a.dir || 1) > 0;
    eachMarker(s, function (m) {
      var at = m.start.seconds;
      if (fwd ? at > t + 0.001 && (best === null || at < best) : at < t - 0.001 && (best === null || at > best)) best = at;
    });
    if (best === null) return EW.fail(fwd ? "No marker after the playhead" : "No marker before the playhead");
    s.setPlayerPosition(String(Math.round(best * TICKS)));
    return EW.ok("At the " + (fwd ? "next" : "previous") + " marker");
  };

  // The sound of the selected clips (and the sound that belongs to selected pictures) switched off, or back on.
  T["pr.muteClips"] = function () {
    var s = seq(), sel = s.getSelection(), sounds = [], seen = {};
    function add(it) { if (!seen[it.nodeId]) { seen[it.nodeId] = 1; sounds.push(it); } }
    for (var i = 0; i < sel.length; i++) {
      if (sel[i].mediaType === "Audio") { add(sel[i]); continue; }
      var name = sel[i].projectItem ? sel[i].projectItem.name : null;
      for (var t = 0; t < s.audioTracks.numTracks; t++) {
        var cl = s.audioTracks[t].clips;
        for (var c = 0; c < cl.numItems; c++) {
          var a = cl[c];
          if (Math.abs(a.start.seconds - sel[i].start.seconds) < 0.002 && Math.abs(a.end.seconds - sel[i].end.seconds) < 0.002 && (!name || (a.projectItem && a.projectItem.name === name))) add(a);
        }
      }
    }
    if (!sounds.length) return EW.fail("Select clips with sound");
    var off = !sounds[0].disabled;
    for (var k = 0; k < sounds.length; k++) sounds[k].disabled = off;
    return EW.ok((off ? "Muted " : "Unmuted ") + plural(sounds.length, "sound clip"));
  };

  // ---- HaloCut Podcast: the camera of whoever talks, and music that dips under the voices -----

  T["pr.podTracks"] = function () {
    var s = seq(), fd = s.getSettings().videoFrameRate.seconds || 0.04, v = [], au = [], end = 0;
    function list(tracks, kind, out) {
      for (var t = 0; t < tracks.numTracks; t++) {
        var tr = tracks[t], cl = tr.clips;
        for (var c = 0; c < cl.numItems; c++) end = Math.max(end, cl[c].end.seconds);
        out.push({ index: t, name: tr.name || (kind + (t + 1)), clips: cl.numItems, first: cl.numItems ? cl[0].name : "" });
      }
    }
    list(s.videoTracks, "V", v); list(s.audioTracks, "A", au);
    return EW.ok(s.name, { sequence: s.name, video: v, audio: au, end: end, fps: Math.round(1000 / fd) / 1000 });
  };

  function levelProp(item) {
    var v = component(item, "audioVolume", "Volume");
    return v ? propNamed(v, ["Level"], 1) : null;
  }

  // args: { audio: [track index...] } → the clips on those tracks, with the music's own Level
  T["pr.podClips"] = function (a) {
    var s = seq(), out = [];
    for (var i = 0; i < a.audio.length; i++) {
      var tr = s.audioTracks[a.audio[i]], clips = [];
      if (!tr) continue;
      for (var c = 0; c < tr.clips.numItems; c++) {
        var it = tr.clips[c], pi = it.projectItem, path = pi && pi.getMediaPath ? pi.getMediaPath() : "";
        if (!path) continue;
        var lp = null; try { lp = levelProp(it); } catch (e) {}
        clips.push({ id: it.nodeId, name: it.name, path: path, inPoint: it.inPoint.seconds, outPoint: it.outPoint.seconds,
          start: it.start.seconds, end: it.end.seconds, level: lp ? baseOf(lp) : null });
      }
      out.push({ index: a.audio[i], clips: clips });
    }
    return EW.ok("clips", { tracks: out });
  };

  // args: { cams: [video track index per camera], cuts: [{ start, end, cam }], keepCopy }
  // Every camera track is cut at each switch; each piece stays on only while its camera is the one talking.
  T["pr.autoCam"] = function (a) {
    var s = seq(), q = qeSeq(), cams = a.cams, cuts = a.cuts;
    if (!cams || cams.length < 2 || !cuts || !cuts.length) return EW.fail("Pick two or more cameras, then Analyse");
    for (var l = 0; l < cams.length; l++) if (s.videoTracks[cams[l]].isLocked && s.videoTracks[cams[l]].isLocked()) return EW.fail("Unlock V" + (cams[l] + 1) + " first");
    if (a.keepCopy) {
      if (!s.clone()) return EW.fail("Could not make a copy of the sequence, nothing was changed");
      s = app.project.activeSequence; q = qeSeq();
    }
    // the sound is never switched off: remember it and put back anything Premiere switches with the picture
    var wasOff = [];
    for (var at = 0; at < s.audioTracks.numTracks; at++) for (var ac = 0; ac < s.audioTracks[at].clips.numItems; ac++) {
      var ai = s.audioTracks[at].clips[ac];
      if (ai.disabled) wasOff.push({ t: at, start: ai.start.seconds, end: ai.end.seconds });
    }
    var before = s.getPlayerPosition().ticks;
    for (var i = 1; i < cuts.length; i++) {
      var tc = timecodeAt(s, q, frameSnap(s, cuts[i].start));
      for (var c = 0; c < cams.length; c++) q.getVideoTrackAt(cams[c]).razor(tc);
    }
    s.setPlayerPosition(before);
    var pieces = 0;
    for (var k = 0; k < cams.length; k++) {
      var cl = s.videoTracks[cams[k]].clips;
      for (var p = 0; p < cl.numItems; p++) {
        var it = cl[p], mid = (it.start.seconds + it.end.seconds) / 2, shot = null;
        for (var u = 0; u < cuts.length && !shot; u++) if (mid >= cuts[u].start && mid < cuts[u].end) shot = cuts[u];
        if (!shot) continue;
        it.disabled = shot.cam !== k;
        pieces++;
      }
    }
    for (var b = 0; b < s.audioTracks.numTracks; b++) for (var bc = 0; bc < s.audioTracks[b].clips.numItems; bc++) {
      var sc = s.audioTracks[b].clips[bc], m2 = (sc.start.seconds + sc.end.seconds) / 2, keepOff = false;
      if (!sc.disabled) continue;
      for (var w = 0; w < wasOff.length; w++) if (wasOff[w].t === b && m2 > wasOff[w].start && m2 < wasOff[w].end) keepOff = true;
      if (!keepOff) sc.disabled = false;
    }
    return EW.ok("Switched cameras " + plural(cuts.length - 1, "time") + " across " + plural(cams.length, "camera") + (a.keepCopy ? ", copy kept" : "") + " · switched-off pieces are still there to swap");
  };

  // args: { clips: [{ id, keys: [{ t, v }] }] }: the music's Level keys, in sequence time. Replaces its volume keys.
  T["pr.duck"] = function (a) {
    var s = seq(), n = 0, keys = 0;
    for (var i = 0; i < a.clips.length; i++) {
      var it = null;
      for (var t = 0; t < s.audioTracks.numTracks && !it; t++) {
        var cl = s.audioTracks[t].clips;
        for (var c = 0; c < cl.numItems; c++) if (cl[c].nodeId === a.clips[i].id) it = cl[c];
      }
      if (!it) continue;
      var lp = levelProp(it);
      if (!lp) return EW.fail("Couldn't find the volume of " + it.name);
      var base = baseOf(lp);
      if (lp.isTimeVarying()) lp.setTimeVarying(false);
      lp.setValue(base, true);
      var ks = a.clips[i].keys;
      if (!ks.length) continue;
      lp.setTimeVarying(true);
      for (var k = 0; k < ks.length; k++) {
        var tm = clipTime(it, ks[k].t);
        lp.addKey(tm); lp.setValueAtKey(tm, ks[k].v, k === ks.length - 1);
        keys++;
      }
      n++;
    }
    return n ? EW.ok("Music dips under the voices · " + keys + " volume keyframes on " + plural(n, "clip")) : EW.fail("No music under the voices to dip");
  };

  // args: { track }: the music's volume keys off, back at its own level
  T["pr.duckClear"] = function (a) {
    var s = seq(), tr = s.audioTracks[a.track], n = 0;
    if (!tr) return EW.fail("Pick the music track");
    for (var c = 0; c < tr.clips.numItems; c++) {
      var lp = levelProp(tr.clips[c]);
      if (!lp || !lp.isTimeVarying()) continue;
      var base = baseOf(lp);
      lp.setTimeVarying(false); lp.setValue(base, true); n++;
    }
    return n ? EW.ok("Music back at its own level on " + plural(n, "clip")) : EW.fail("No volume keys on that track");
  };

  // ---- HaloCut Grade: Lumetri Color values on clips ------------------------------------------

  // Each HaloCut value and the Lumetri control it drives: the first with that name (after the named section, if one is given).
  var LUMETRI = {
    temperature: ["Temperature"], tint: ["Tint"], exposure: ["Exposure"], contrast: ["Contrast"], highlights: ["Highlights"],
    shadows: ["Shadows"], whites: ["Whites"], blacks: ["Blacks"], saturation: ["Saturation"], vibrance: ["Vibrance"],
    faded: ["Faded Film"], vignette: ["Amount", "Vignette"]
  };
  var LUMETRI_NEUTRAL = { temperature: 0, tint: 0, exposure: 0, contrast: 0, highlights: 0, shadows: 0, whites: 0, blacks: 0, saturation: 100, vibrance: 0, faded: 0, vignette: 0 };

  function lumetri(item, add) {
    var c = component(item, "AE.ADBE Lumetri", "Lumetri Color");
    if (c || !add) return c;
    var q = qeSeq(), qi = qeItemFor(q, item), fx = qe.project.getVideoEffectByName("Lumetri Color");
    if (qi && fx) qi.addVideoEffect(fx);
    return component(item, "AE.ADBE Lumetri", "Lumetri Color");
  }

  function lumetriProp(c, key) {
    var want = LUMETRI[key], from = 0, ps = c.properties;
    if (want[1]) {
      from = -1;
      for (var i = 0; i < ps.numItems && from < 0; i++) if (ps[i].displayName === want[1]) from = i + 1;
      if (from < 0) return null;
    }
    for (var j = from; j < ps.numItems; j++) if (ps[j].displayName === want[0]) return ps[j];
    return null;
  }

  function readGrade(c) {
    var out = {};
    for (var k in LUMETRI) {
      var p = lumetriProp(c, k);
      if (!p) continue;
      try { var v = p.getValue(); if (typeof v === "number") out[k] = v; } catch (e) {}
    }
    return out;
  }

  // The clip at the playhead and its Lumetri values. args: { neutral }: also sets them to neutral, so the
  // frame grabbed next is the clip as shot (Grade puts them back after).
  T["pr.gradeRead"] = function (a) {
    var s = seq(), here = clipHere(s), list = clipsToFrame(s), ids = [];
    for (var i = 0; i < list.length; i++) ids.push(list[i].nodeId);
    if (!here) return EW.ok("No clip at the playhead", { here: null, ids: ids, values: {}, had: false });
    var c = lumetri(here, false), vals = c ? readGrade(c) : {}, keyed = [];
    if (c && a.neutral) {
      for (var k in vals) {
        var p = lumetriProp(c, k);
        if (p.isTimeVarying()) { keyed.push(k); continue; }
        p.setValue(LUMETRI_NEUTRAL[k], true);
      }
    }
    return EW.ok(here.name, { here: { id: here.nodeId, name: here.name }, ids: ids, values: vals, had: !!c, keyed: keyed });
  };

  // args: { ids, values, add }: the values into each clip's Lumetri Color, adding one where there is none (unless add is false)
  T["pr.gradeApply"] = function (a) {
    var s = seq(), n = 0, missing = {}, keyed = 0;
    for (var i = 0; i < a.ids.length; i++) {
      var item = videoById(s, a.ids[i]);
      if (!item) continue;
      var c = lumetri(item, a.add !== false);
      if (!c) { if (a.add === false) continue; return EW.fail("Couldn't add Lumetri Color to " + item.name); }
      for (var k in a.values) {
        if (!LUMETRI[k]) continue;
        var p = lumetriProp(c, k);
        if (!p) { missing[k] = true; continue; }
        if (p.isTimeVarying()) { keyed++; continue; }
        p.setValue(a.values[k], true);
      }
      n++;
    }
    if (!n) return EW.fail("Select clips, or park the playhead on one");
    var miss = [];
    for (var m in missing) miss.push(LUMETRI[m][0]);
    return EW.ok("Graded " + plural(n, "clip") + " in Lumetri Color" + (miss.length ? " · not found: " + miss.join(", ") : "") + (keyed ? " · keyframed controls left alone" : ""), { missing: miss });
  };

  // One call for a look: the selected clips (or the one at the playhead) get these Lumetri values. args: { values }
  T["pr.gradeLook"] = function (a) {
    var s = seq(), list = clipsToFrame(s), ids = [];
    for (var i = 0; i < list.length; i++) ids.push(list[i].nodeId);
    if (!ids.length) return EW.fail("Select clips, or park the playhead on one");
    return T["pr.gradeApply"]({ ids: ids, values: a.values });
  };

  // ---- Studio: safe-zone guides --------------------------------------------

  var GUIDE_NAME = "\u26A0 GUIDES (HaloCut)";
  var GUIDE_BIN = "HaloCut Guides";
  var MAGENTA = 11;

  function guideItems(s) {
    var out = [];
    for (var t = 0; t < s.videoTracks.numTracks; t++) {
      var clips = s.videoTracks[t].clips;
      for (var c = 0; c < clips.numItems; c++) {
        var it = clips[c];
        if (it.projectItem && it.projectItem.name === GUIDE_NAME) out.push(it);
      }
    }
    return out;
  }

  function childBin(name) {
    var root = app.project.rootItem;
    for (var i = 0; i < root.children.numItems; i++) {
      if (root.children[i].type === ProjectItemType.BIN && root.children[i].name === name) return root.children[i];
    }
    return root.createBin(name);
  }

  T["pr.guidesInfo"] = function () {
    var s = seq(), g = guideItems(s), showing = false;
    for (var i = 0; i < g.length; i++) if (!g[i].disabled) showing = true;
    return EW.ok("guides", { w: s.frameSizeHorizontal, h: s.frameSizeVertical, sequence: s.name, placed: g.length > 0, showing: showing });
  };

  // args: { file } a PNG at the sequence's frame size
  T["pr.guidesPlace"] = function (a) {
    var s = seq();
    var old = guideItems(s);
    for (var i = old.length - 1; i >= 0; i--) old[i].remove(false, false);

    var bin = childBin(GUIDE_BIN);
    var before = bin.children.numItems;
    if (!app.project.importFiles([a.file], true, bin, false)) return EW.fail("Premiere could not import the guide picture");
    var item = null;
    for (var c = bin.children.numItems - 1; c >= 0 && !item; c--) {
      var ch = bin.children[c];
      if (ch.getMediaPath && ch.getMediaPath() === a.file) item = ch;
    }
    if (!item && bin.children.numItems > before) item = bin.children[bin.children.numItems - 1];
    if (!item) return EW.fail("Imported, but could not find the guide picture");
    item.name = GUIDE_NAME;
    item.setColorLabel(MAGENTA);
    var endSec = Number(s.end) / TICKS;
    item.setInPoint(0, 4);
    item.setOutPoint(Math.max(1, endSec), 4);

    // a track of its own, on top; the footage is never moved or changed
    var top = s.videoTracks[s.videoTracks.numTracks - 1];
    if (top.clips.numItems > 0) {
      try { qeSeq().addTracks(1, s.videoTracks.numTracks, 0); } catch (e) {}
      top = s.videoTracks[s.videoTracks.numTracks - 1];
      if (top.clips.numItems > 0) return EW.fail("Add an empty video track on top first");
    }
    top.overwriteClip(item, 0);
    return EW.ok("Guides on V" + s.videoTracks.numTracks + ". Hide them before you export");
  };

  T["pr.guidesShow"] = function (a) {
    var g = guideItems(seq());
    if (!g.length) return EW.fail("No guides in this sequence");
    for (var i = 0; i < g.length; i++) g[i].disabled = !a.show;
    return EW.ok(a.show ? "Guides showing: hide them before you export" : "Guides hidden: they won't export");
  };

  T["pr.guidesRemove"] = function () {
    var g = guideItems(seq());
    for (var i = g.length - 1; i >= 0; i--) g[i].remove(false, false);
    return EW.ok(g.length ? "Guides removed" : "No guides to remove");
  };

  // ---- Studio: captions ------------------------------------------------------

  // args: { file } an .srt with sequence times. Goes on Premiere's own caption track, editable there.
  T["pr.captionsPlace"] = function (a) {
    var s = seq();
    var bin = childBin("HaloCut Captions");
    var before = bin.children.numItems;
    if (!app.project.importFiles([a.file], true, bin, false)) return EW.fail("Premiere could not import the captions");
    var item = null;
    for (var c = bin.children.numItems - 1; c >= 0 && !item; c--) {
      var ch = bin.children[c];
      if (ch.getMediaPath && ch.getMediaPath() === a.file) item = ch;
    }
    if (!item && bin.children.numItems > before) item = bin.children[bin.children.numItems - 1];
    if (!item) return EW.fail("Imported, but could not find the captions");
    var fmt = (typeof Sequence !== "undefined" && Sequence.CAPTION_FORMAT_SUBTITLE !== undefined) ? Sequence.CAPTION_FORMAT_SUBTITLE : 0;
    var ok = s.createCaptionTrack(item, 0, fmt);
    if (ok === false) return EW.fail("Premiere would not make a caption track: the .srt is in the HaloCut Captions bin");
    return EW.ok("Captions added on a caption track, editable in Premiere");
  };

  // Tracks
  T["pr.muteTargeted"] = function () {
    var s = seq(), n = 0, turnOn = null;
    for (var t = 0; t < s.audioTracks.numTracks; t++) {
      var tr = s.audioTracks[t];
      if (!tr.isTargeted()) continue;
      if (turnOn === null) turnOn = !tr.isMuted();
      tr.setMute(turnOn ? 1 : 0);
      n++;
    }
    if (!n) return EW.fail("No targeted audio tracks");
    return EW.ok((turnOn ? "Muted " : "Unmuted ") + plural(n, "track"));
  };

  // ---- Tool wheel: adjustment layers, colour mattes, speed and gain ------------------------------------

  // The time to cover: the selected clips, else the clip at the playhead, else `len` s from the playhead.
  function spanHere(s, len, clipToo) {
    var sel = selected(s, false), t0 = null, t1 = null;
    for (var i = 0; i < sel.length; i++) {
      t0 = t0 === null ? sel[i].start.seconds : Math.min(t0, sel[i].start.seconds);
      t1 = t1 === null ? sel[i].end.seconds : Math.max(t1, sel[i].end.seconds);
    }
    if (t0 === null && clipToo) { var h = footageHere(s); if (h) { t0 = h.start.seconds; t1 = h.end.seconds; } }
    if (t0 === null) { t0 = frameSnap(s, now(s)); t1 = t0 + (len || 5); }
    return { t0: t0, t1: t1 };
  }

  function isAdjustment(item) { try { return !!item.isAdjustmentLayer(); } catch (e) { return false; } }

  // The top clip under the playhead that is footage: not an adjustment layer, not one of HaloCut's own pictures
  function footageHere(s) {
    var at = now(s);
    for (var t = s.videoTracks.numTracks - 1; t >= 0; t--) {
      var cl = s.videoTracks[t].clips;
      for (var c = 0; c < cl.numItems; c++) if (covers(cl[c], at) && !isOverlay(cl[c]) && !isAdjustment(cl[c])) return cl[c];
    }
    return null;
  }

  function sequenceEnd(s) {
    var items = allItems(s), end = 0;
    for (var i = 0; i < items.length; i++) end = Math.max(end, items[i].item.end.seconds);
    return end;
  }

  function findInBins(bin, test, depth) {
    if (depth > 8) return null;
    for (var i = 0; i < bin.children.numItems; i++) {
      var ch = bin.children[i];
      if (ch.type === ProjectItemType.BIN) { var f = findInBins(ch, test, depth + 1); if (f) return f; }
      else if (test(ch)) return ch;
    }
    return null;
  }

  // Scripts can't make a new adjustment layer in Premiere, so HaloCut reuses one: from this sequence, else from the project.
  function adjustmentItem(s) {
    for (var t = 0; t < s.videoTracks.numTracks; t++) {
      var cl = s.videoTracks[t].clips;
      for (var c = 0; c < cl.numItems; c++) {
        try { if (cl[c].isAdjustmentLayer() && cl[c].projectItem) return cl[c].projectItem; } catch (e) {}
      }
    }
    return findInBins(app.project.rootItem, function (pi) {
      var media = "";
      try { media = pi.getMediaPath ? pi.getMediaPath() : ""; } catch (e) {}
      return pi.type === ProjectItemType.CLIP && /adjustment layer/i.test(pi.name) && !media;
    }, 0);
  }

  // A project item over [t0, t1] on video track `from` or the first free one above it (a new track if none is free).
  function placeOver(s, pi, t0, t1, from) {
    var t = freeTrack(s, from, t0, t1);
    if (t < 0) return null;
    pi.setInPoint(0, 4); pi.setOutPoint(t1 - t0, 4);
    s.videoTracks[t].overwriteClip(pi, t0);
    return startingAt(s.videoTracks[t], t0);
  }

  function selectOnly(s, item) {
    var sel = s.getSelection();
    for (var i = 0; i < sel.length; i++) { try { sel[i].setSelected(false, false); } catch (e) {} }
    try { item.setSelected(true, true); } catch (e2) {}
  }

  function secs(x) { return (Math.round(x * 10) / 10) + " s"; }

  // An adjustment layer above the selected clips (or the clip at the playhead), with an effect on it if asked.
  // args: { effect, whole }: whole = from the start to the end of the sequence
  T["pr.adjustment"] = function (a) {
    var s = seq(), pi = adjustmentItem(s);
    if (!pi) return EW.fail("Make one adjustment layer first (File › New › Adjustment Layer): HaloCut reuses it from then on");
    var sp = a.whole ? { t0: 0, t1: sequenceEnd(s) } : spanHere(s, 5, true);
    if (sp.t1 - sp.t0 < 0.02) return EW.fail("The sequence is empty");
    var it = placeOver(s, pi, sp.t0, sp.t1, aboveAll(s, sp.t0, sp.t1));
    if (!it) return EW.fail("No free video track for the adjustment layer");
    var fxNote = "";
    if (a.effect) {
      var q = qeSeq(), qi = qeItemFor(q, it), fx = qe.project.getVideoEffectByName(a.effect);
      if (qi && fx) { qi.addVideoEffect(fx); fxNote = " with " + a.effect; }
      else fxNote = " (" + a.effect + " not found)";
    }
    selectOnly(s, it);
    return EW.ok("Adjustment layer" + fxNote + " on V" + (trackOfItem(s, it) + 1) + " · " + secs(sp.t1 - sp.t0));
  };

  // ---- Colour mattes: a picture of one colour at the sequence's size, made once and kept

  function repeatStr(str, n) {
    var out = "", p = str;
    while (n > 0) { if (n & 1) out += p; n >>= 1; if (n) p += p; }
    return out;
  }

  function le(n, bytes) {
    var out = "";
    for (var i = 0; i < bytes; i++) out += String.fromCharCode((n >>> (8 * i)) & 255);
    return out;
  }

  // A 24-bit BMP (Premiere imports it as a still) in HaloCut's folder: written once per colour and size.
  function matteFile(hex, w, h) {
    var dir = new Folder(Folder.userData.fsName + "/HaloCut/Mattes");
    if (!dir.exists) dir.create();
    var f = new File(dir.fsName + "/Matte " + hex.substr(1) + " " + w + "x" + h + ".bmp");
    var rowBytes = w * 3, pad = (4 - rowBytes % 4) % 4, row = rowBytes + pad, size = 54 + row * h;
    if (f.exists && f.length === size) return f.fsName;
    var r = parseInt(hex.substr(1, 2), 16), g = parseInt(hex.substr(3, 2), 16), b = parseInt(hex.substr(5, 2), 16);
    var head = "BM" + le(size, 4) + le(0, 4) + le(54, 4) + le(40, 4) + le(w, 4) + le(h, 4) + le(1, 2) + le(24, 2) +
      le(0, 4) + le(row * h, 4) + le(2835, 4) + le(2835, 4) + le(0, 4) + le(0, 4);
    var line = repeatStr(String.fromCharCode(b, g, r), w) + repeatStr(String.fromCharCode(0), pad);
    var block = 64, chunk = repeatStr(line, Math.min(block, h)), left = h;
    f.encoding = "BINARY";
    if (!f.open("w")) throw new Error("Couldn't write the matte in " + dir.fsName);
    f.write(head);
    while (left >= block) { f.write(chunk); left -= block; }
    if (left > 0) f.write(repeatStr(line, left));
    f.close();
    return f.fsName;
  }

  function findOrImport(binName, file) {
    var bin = childBin(binName);
    for (var c = 0; c < bin.children.numItems; c++) {
      var ch = bin.children[c];
      try { if (ch.getMediaPath && ch.getMediaPath() === file) return ch; } catch (e) {}
    }
    return importOne(binName, file);
  }

  // A colour matte at the playhead (5 s) or over the selected clips, on the lowest video track free there.
  // args: { color: "#RRGGBB", name, seconds }
  T["pr.matte"] = function (a) {
    var s = seq(), hex = String(a.color || "#000000").toUpperCase();
    if (!/^#[0-9A-F]{6}$/.test(hex)) return EW.fail("Not a colour: " + a.color);
    var f = frameSize(s);
    if (!(f.w > 0 && f.h > 0)) return EW.fail("Couldn't read the sequence's frame size");
    var pi = findOrImport("HaloCut Mattes", matteFile(hex, f.w, f.h));
    if (!pi) return EW.fail("Premiere could not import the matte");
    var name = (a.name || hex) + " matte";
    try { if (pi.name !== name) pi.name = name; } catch (e) {}
    var sp = spanHere(s, a.seconds || 5, false);
    var it = placeOver(s, pi, sp.t0, sp.t1, 0);
    if (!it) return EW.fail("No free video track for the matte");
    return EW.ok(name + " on V" + (trackOfItem(s, it) + 1) + " · " + secs(sp.t1 - sp.t0));
  };

  // ---- Speed: through QE's setSpeed. Whether it takes a percent or a multiplier is learned from the first change
  // (wrong units make the clip 100× shorter), then kept for the session.

  function itemByNode(s, id) {
    var items = allItems(s);
    for (var i = 0; i < items.length; i++) if (items[i].item.nodeId === id) return items[i].item;
    return null;
  }

  function speedOf(item) {
    var v = 1;
    try { v = Math.abs(item.getSpeed()); } catch (e) {}
    if (!(v > 0)) v = 1;
    return v > 50 ? v / 100 : v; // a percent, not a multiplier
  }

  function reversed(item) { try { return !!item.isSpeedReversed(); } catch (e) { return false; } }

  function setClipSpeed(s, q, item, pct, rev) {
    var qi = qeItemFor(q, item);
    if (!qi) return false;
    var id = item.nodeId, d0 = item.end.seconds - item.start.seconds, want = d0 * speedOf(item) / (pct / 100);
    var fd = s.getSettings().videoFrameRate.seconds || 0.04, div = EW.qeSpeedDiv || 1;
    try { qi.setSpeed(pct / div, "", rev, false, false); }
    catch (e) {
      if (EW.qeSpeedDiv) throw e;
      EW.qeSpeedDiv = 100; qi.setSpeed(pct / 100, "", rev, false, false); return true;
    }
    if (!EW.qeSpeedDiv) {
      var it = itemByNode(s, id), d1 = it ? it.end.seconds - it.start.seconds : d0;
      if (it && d1 * 20 < want) {
        EW.qeSpeedDiv = 100;
        var again = qeItemFor(q, it);
        if (again) again.setSpeed(pct / 100, "", rev, false, false);
      } else if (it && (Math.abs(d1 - d0) > fd || Math.abs(want - d0) < fd)) EW.qeSpeedDiv = 1;
    }
    return true;
  }

  // The selected clips (a selected video brings its linked sound), else the clip at the playhead
  function clipsForSpeed(s) {
    var sel = selected(s, false);
    if (sel.length) return sel;
    var h = clipHere(s);
    return h ? [h] : [];
  }

  // args: { percent }: 100 = normal. Keeps a reversed clip reversed. No ripple, like Premiere's own default.
  T["pr.speed"] = function (a) {
    var s = seq(), q = qeSeq(), list = clipsForSpeed(s), pct = a.percent || 100, n = 0;
    if (!list.length) return EW.fail("Select clips, or park the playhead on one");
    var ids = [];
    for (var i = 0; i < list.length; i++) ids.push(list[i].nodeId);
    for (var k = 0; k < ids.length; k++) {
      var it = itemByNode(s, ids[k]);
      if (it && setClipSpeed(s, q, it, pct, reversed(it))) n++;
    }
    if (!n) return EW.fail("Premiere wouldn't change the speed here: try Speed/Duration (⌘R)");
    return EW.ok("Speed " + pct + "% on " + plural(n, "clip"));
  };

  T["pr.reverse"] = function () {
    var s = seq(), q = qeSeq(), list = clipsForSpeed(s), n = 0, on = null;
    if (!list.length) return EW.fail("Select clips, or park the playhead on one");
    var ids = [];
    for (var i = 0; i < list.length; i++) ids.push(list[i].nodeId);
    for (var k = 0; k < ids.length; k++) {
      var it = itemByNode(s, ids[k]);
      if (!it) continue;
      if (on === null) on = !reversed(it);
      if (setClipSpeed(s, q, it, Math.round(speedOf(it) * 10000) / 100, on)) n++;
    }
    if (!n) return EW.fail("Premiere wouldn't reverse these: try Speed/Duration (⌘R)");
    return EW.ok((on ? "Reversed " : "Forwards again: ") + plural(n, "clip"));
  };

  // ---- Gain: the clip's Volume level, in dB. With keyframes, every key moves by the same amount.

  function dbToLevel(db) { return db <= -96 ? 0 : Math.pow(10, (Math.min(db, 15) - 15) / 20); }
  function levelToDb(v) { return v > 0 ? 20 * Math.log(v) / Math.LN10 + 15 : -96; }
  function dbText(db) { return (db > 0 ? "+" : db < 0 ? "−" : "") + Math.abs(Math.round(db * 10) / 10) + " dB"; }

  // args: { db } to raise or lower, or { set } for a level (0 = as recorded).
  // The selected clips with sound, else the sound under the playhead on the targeted audio tracks.
  T["pr.gain"] = function (a) {
    var s = seq(), sel = selected(s, false), list = [], n = 0, last = null;
    for (var i = 0; i < sel.length; i++) if (sel[i].mediaType === "Audio") list.push(sel[i]);
    if (!sel.length) {
      var at = now(s);
      for (var t = 0; t < s.audioTracks.numTracks; t++) {
        var tr = s.audioTracks[t];
        if (!tr.isTargeted()) continue;
        for (var c = 0; c < tr.clips.numItems; c++) if (covers(tr.clips[c], at)) list.push(tr.clips[c]);
      }
    }
    if (!list.length) return EW.fail("Select clips with sound");
    for (var k = 0; k < list.length; k++) {
      var lp = levelProp(list[k]);
      if (!lp) continue;
      if (a.set !== undefined) {
        if (lp.isTimeVarying()) lp.setTimeVarying(false);
        lp.setValue(dbToLevel(a.set), true);
        last = a.set;
      } else if (lp.isTimeVarying()) {
        var ks = lp.getKeys() || [];
        for (var j = 0; j < ks.length; j++) lp.setValueAtKey(ks[j], dbToLevel(levelToDb(lp.getValueAtKey(ks[j])) + a.db), j === ks.length - 1);
      } else {
        last = Math.min(15, levelToDb(lp.getValue()) + a.db);
        lp.setValue(dbToLevel(last), true);
      }
      n++;
    }
    if (!n) return EW.fail("Couldn't find the volume of those clips");
    var what = a.set !== undefined ? "Volume " + dbText(a.set) : dbText(a.db);
    return EW.ok(what + " on " + plural(n, "sound clip") + (n === 1 && last !== null && a.set === undefined ? " · now " + dbText(last) : ""));
  };

  // ---- Tool wheel: colour copy and paste (the Lumetri Color controls HaloCut Grade knows) -------------------
  // The copied colour stays for the session, so one copy can go on many clips.

  T["pr.colorCopy"] = function () {
    var s = seq(), here = clipHere(s);
    if (!here) return EW.fail("Park the playhead on the clip whose colour you want");
    var c = lumetri(here, false);
    if (!c) return EW.fail(here.name + " has no Lumetri Color to copy");
    var vals = readGrade(c), n = 0;
    for (var k in vals) n++;
    if (!n) return EW.fail("Couldn't read the colour of " + here.name);
    EW.copiedColor = { name: here.name, values: vals };
    return EW.ok("Copied the colour of " + here.name + " · now Paste colour on other clips");
  };

  T["pr.colorPaste"] = function () {
    var cc = EW.copiedColor;
    if (!cc) return EW.fail("Copy a colour first: park on a graded clip and use Copy colour");
    var s = seq(), list = clipsToFrame(s), ids = [];
    for (var i = 0; i < list.length; i++) ids.push(list[i].nodeId);
    if (!ids.length) return EW.fail("Select clips, or park the playhead on one");
    var r = T["pr.gradeApply"]({ ids: ids, values: cc.values });
    if (r.ok) r.msg = "Colour of " + cc.name + " on " + plural(ids.length, "clip") + (r.data && r.data.missing && r.data.missing.length ? " · not found: " + r.data.missing.join(", ") : "");
    return r;
  };

  // Lumetri Color back to neutral on the selected clips (or the one at the playhead); clips without one are left alone
  T["pr.colorReset"] = function () {
    var s = seq(), list = clipsToFrame(s), ids = [];
    for (var i = 0; i < list.length; i++) ids.push(list[i].nodeId);
    if (!ids.length) return EW.fail("Select clips, or park the playhead on one");
    var r = T["pr.gradeApply"]({ ids: ids, values: LUMETRI_NEUTRAL, add: false });
    if (!r.ok) return EW.fail("No Lumetri Color on those clips to reset");
    r.msg = r.msg.replace(/^Graded/, "Colour reset on");
    return r;
  };

  // ---- Tool wheel: sequences

  // A new sequence with the settings of the clip at the playhead (or the selected one), opened at once
  T["pr.seqFromClip"] = function () {
    var s = seq(), sel = selected(s, true), clip = sel.length ? sel[0] : clipHere(s);
    if (!clip || !clip.projectItem) return EW.fail("Select a clip, or park the playhead on one");
    var pi = clip.projectItem;
    var made = app.project.createNewSequenceFromClips(pi.name.replace(/\.[^.]+$/, ""), [pi], null);
    if (!made) return EW.fail("Premiere would not make the sequence");
    try { app.project.openSequence(made.sequenceID); } catch (e) {}
    return EW.ok("New sequence “" + made.name + "”, " + made.frameSizeHorizontal + "×" + made.frameSizeVertical + ", with " + pi.name);
  };

  // A copy of the open sequence, opened so you work on the copy
  T["pr.seqDuplicate"] = function () {
    var s = seq(), id = s.sequenceID, name = s.name, before = {};
    for (var i = 0; i < app.project.sequences.numSequences; i++) before[app.project.sequences[i].sequenceID] = 1;
    if (!s.clone()) return EW.fail("Premiere would not copy " + name);
    for (var j = 0; j < app.project.sequences.numSequences; j++) {
      var q = app.project.sequences[j];
      if (!before[q.sequenceID] && q.sequenceID !== id) {
        try { app.project.openSequence(q.sequenceID); } catch (e) {}
        return EW.ok("Copied " + name + " to “" + q.name + "” and opened it");
      }
    }
    return EW.ok("Copied " + name + " (in the Project panel)");
  };
})();
