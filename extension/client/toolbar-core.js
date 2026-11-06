/* HaloCut Toolbar — the one-click jobs, how search ranks them, and the pinned ones on keys 1–9.
 * A job runs a Premiere tool (tool + args) or one of the panel's own actions (do).
 * © 2026 Imtayz Nayem */
(function (root) {
  var JOBS = [
    { id: "cut", name: "Cut", group: "Edit", icon: "scissors", tool: "pr.cut", hint: "Targeted tracks", words: "razor split" },
    { id: "cutAll", name: "Cut all tracks", group: "Edit", icon: "scissorsAll", tool: "pr.cutAll", words: "razor split" },
    { id: "ripple", name: "Ripple delete", group: "Edit", icon: "ripple", tool: "pr.rippleDelete", words: "remove close" },
    { id: "enable", name: "Enable / disable", group: "Edit", icon: "eyeOff", tool: "pr.toggleEnable", words: "switch off hide" },
    { id: "link", name: "Link", group: "Edit", icon: "link", tool: "pr.link" },
    { id: "unlink", name: "Unlink", group: "Edit", icon: "unlink", tool: "pr.unlink" },
    { id: "selectHere", name: "Select at playhead", group: "Edit", icon: "select", tool: "pr.selectAtPlayhead" },
    { id: "selectFwd", name: "Select forward", group: "Edit", icon: "forward", tool: "pr.selectForward" },
    { id: "center", name: "Centre", group: "Frame", icon: "center", tool: "pr.center", words: "middle position" },
    { id: "fill", name: "Fill frame", group: "Frame", icon: "fill", tool: "pr.fillFrame", hint: "No black bars", words: "scale cover" },
    { id: "fit", name: "Fit frame", group: "Frame", icon: "fit", tool: "pr.fitFrame", words: "scale contain" },
    { id: "fillW", name: "Fill width", group: "Frame", icon: "fillW", tool: "pr.fillWidth" },
    { id: "fillH", name: "Fill height", group: "Frame", icon: "fillH", tool: "pr.fillHeight" },
    { id: "scale100", name: "Scale 100 %", group: "Frame", icon: "hundred", tool: "pr.scale100" },
    { id: "punchIn", name: "Punch in", group: "Frame", icon: "zoomIn", tool: "pr.punchIn", setting: "punch", words: "zoom crop" },
    { id: "punchOut", name: "Punch out", group: "Frame", icon: "zoomOut", tool: "pr.punchOut", setting: "punch", words: "zoom" },
    { id: "rotCW", name: "Rotate +90°", group: "Frame", icon: "rotate", tool: "pr.rotate", args: { degrees: 90 } },
    { id: "rotCCW", name: "Rotate −90°", group: "Frame", icon: "rotateBack", tool: "pr.rotate", args: { degrees: -90 } },
    { id: "flipH", name: "Flip horizontal", group: "Frame", icon: "flipH", tool: "pr.flipH", words: "mirror" },
    { id: "flipV", name: "Flip vertical", group: "Frame", icon: "flipV", tool: "pr.flipV" },
    { id: "reset", name: "Reset motion", group: "Frame", icon: "reset", tool: "pr.resetMotion" },
    { id: "gaps", name: "Close all gaps", group: "Timeline", icon: "gaps", tool: "pr.closeGaps", hint: "Only where every track is empty", words: "ripple space" },
    { id: "zoomAlt", name: "Zoom every other clip", group: "Timeline", icon: "zoomAlt", tool: "pr.zoomAlternate", args: { factor: 1.15 }, words: "jump cut punch" },
    { id: "unnest", name: "Unnest", group: "Timeline", icon: "layers", tool: "pr.unnest", args: { keepCopy: true }, words: "nested sequence" },
    { id: "freeze", name: "Freeze frame", group: "Timeline", icon: "freeze", do: "freeze", setting: "freeze", hint: "Over the clip", words: "hold still" },
    { id: "freezeIn", name: "Freeze frame, make room", group: "Timeline", icon: "freeze", do: "freeze", insert: true, setting: "freeze", hint: "Pushes the rest later", words: "hold still insert" },
    { id: "stairDown", name: "Stair down", group: "Timeline", icon: "stairDown", tool: "pr.stair", setting: "stair", words: "stagger steps offset" },
    { id: "stairUp", name: "Stair up", group: "Timeline", icon: "stairUp", tool: "pr.stair", args: { up: true }, setting: "stair", words: "stagger steps offset" },
    { id: "jcut", name: "J cut", group: "Timeline", icon: "jcut", tool: "pr.jlCut", args: { kind: "j" }, setting: "jl", hint: "Next sound starts early", words: "audio lead split edit" },
    { id: "lcut", name: "L cut", group: "Timeline", icon: "lcut", tool: "pr.jlCut", args: { kind: "l" }, setting: "jl", hint: "Sound runs on", words: "audio tail split edit" },
    { id: "mute", name: "Mute targeted", group: "Timeline", icon: "mute", tool: "pr.muteTargeted", words: "audio silence" },
    { id: "marker", name: "Add marker", group: "Timeline", icon: "flag", tool: "pr.marker" },
    { id: "copyFrame", name: "Copy frame", group: "Pictures", icon: "copy", do: "copyFrame", hint: "To the clipboard", words: "screenshot still export" },
    { id: "paste", name: "Paste picture", group: "Pictures", icon: "paste", do: "paste", hint: "From the clipboard, at the playhead", words: "image clipboard" },
    { id: "guides", name: "Show / hide guides", group: "Pictures", icon: "grid", do: "guides", words: "safe zone" },
    { id: "qc", name: "QC check", group: "Check", icon: "check", do: "qc", hint: "Gaps, flash frames, offline media", words: "quality export black" },
  ];
  var GROUPS = ["Edit", "Frame", "Timeline", "Pictures", "Check"];

  // Line icons the Tool wheel doesn't have (24×24, stroke = currentColor). Our own.
  var EXTRA_ICONS = {
    gaps: '<rect x="3" y="7" width="6" height="10" rx="1.5"/><rect x="15" y="7" width="6" height="10" rx="1.5"/><path d="M10.5 12h3M12 10.5 13.5 12 12 13.5"/>',
    zoomAlt: '<rect x="3" y="7" width="5" height="10" rx="1"/><rect x="9.5" y="5" width="5" height="14" rx="1"/><rect x="16" y="7" width="5" height="10" rx="1"/>',
    stairDown: '<rect x="3" y="4" width="9" height="4" rx="1"/><rect x="7" y="10" width="9" height="4" rx="1"/><rect x="11" y="16" width="9" height="4" rx="1"/>',
    stairUp: '<rect x="11" y="4" width="9" height="4" rx="1"/><rect x="7" y="10" width="9" height="4" rx="1"/><rect x="3" y="16" width="9" height="4" rx="1"/>',
    jcut: '<rect x="3" y="5" width="8" height="5" rx="1"/><rect x="13" y="5" width="8" height="5" rx="1"/><path d="M3 15h5M10 15h11M10 13v4"/>',
    lcut: '<rect x="3" y="5" width="8" height="5" rx="1"/><rect x="13" y="5" width="8" height="5" rx="1"/><path d="M3 15h11M16 15h5M14 13v4"/>',
    paste: '<rect x="5" y="5" width="14" height="16" rx="2"/><path d="M9 5V3.5h6V5M9 12l3 3 3-3M12 9v6"/>',
    grid: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16M15 4v16M3 10h18M3 14h18"/>',
    check: '<circle cx="12" cy="12" r="9"/><path d="m8 12.5 2.7 2.7L16.5 9"/>',
  };

  function norm(s) { return String(s || "").toLowerCase(); }

  // Every word of the query has to start a word in the name, hint or keywords; names count most.
  function search(jobs, q) {
    var words = norm(q).split(/\s+/).filter(Boolean);
    if (!words.length) return jobs.slice();
    var out = [];
    jobs.forEach(function (j, i) {
      var name = norm(j.name), rest = norm([j.hint, j.words, j.group].join(" ")), score = 0, ok = true;
      words.forEach(function (w) {
        var inName = (" " + name.replace(/[^\w\s]/g, " ")).indexOf(" " + w) >= 0, inRest = (" " + rest).indexOf(" " + w) >= 0;
        if (inName) score += name.indexOf(w) === 0 ? 4 : 3; else if (inRest) score += 1; else ok = false;
      });
      if (ok) out.push({ job: j, score: score, i: i });
    });
    out.sort(function (a, b) { return b.score - a.score || a.i - b.i; });
    return out.map(function (o) { return o.job; });
  }

  function byId(jobs, id) { for (var i = 0; i < jobs.length; i++) if (jobs[i].id === id) return jobs[i]; return null; }
  function pinned(jobs, pins) { return (pins || []).map(function (id) { return byId(jobs, id); }).filter(Boolean).slice(0, 9); }
  function togglePin(pins, id) {
    var p = (pins || []).slice(), i = p.indexOf(id);
    if (i >= 0) p.splice(i, 1); else if (p.length < 9) p.push(id);
    return p;
  }

  // What a job sends to Premiere, with the panel's settings filled in.
  function argsFor(job, set) {
    var a = {}, k;
    for (k in job.args || {}) a[k] = job.args[k];
    set = set || {};
    if (job.setting === "punch") a.factor = set.punch || 1.2;
    if (job.setting === "stair") a.frames = set.stair || 5;
    if (job.setting === "jl") a.frames = set.jl || 12;
    if (job.setting === "freeze") { a.len = set.freeze || 2; a.insert = !!job.insert; }
    return a;
  }

  var api = { JOBS: JOBS, GROUPS: GROUPS, EXTRA_ICONS: EXTRA_ICONS, search: search, byId: byId, pinned: pinned, togglePin: togglePin, argsFor: argsFor };
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.HaloToolbar = api;
})(typeof self !== "undefined" ? self : this);
