// Close gaps and Unnest on a pretend Premiere timeline.
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const jsx = (f) => fs.readFileSync(path.join(__dirname, '../../extension/jsx', f), 'utf8');
const TICKS = 254016000000;
let nextId = 1;
const T = (sec) => ({ seconds: sec, ticks: String(Math.round(sec * TICKS)) });

function media(name, opts = {}) {
  return { name, nodeId: 'pi' + nextId++, hasAudio: !!opts.audio, nest: opts.nest || false, _in: 0, _out: null,
    isSequence() { return this.nest; }, getInPoint() { return T(this._in); }, getOutPoint() { return T(this._out === null ? 999 : this._out); },
    setInPoint(s) { this._in = s; }, setOutPoint(s) { this._out = s; } };
}
function clip(pi, s, e, inPt = 0) {
  return { nodeId: 'ti' + nextId++, projectItem: pi, _s: s, _e: e, _in: inPt, name: pi ? pi.name : 'Graphic',
    get start() { return T(this._s); }, get end() { return T(this._e); }, get inPoint() { return T(this._in); }, get outPoint() { return T(this._in + this._e - this._s); },
    remove() { this.track.list.splice(this.track.list.indexOf(this), 1); }, move(t) { this._s += t.seconds; this._e += t.seconds; } };
}
function track(name, clips, seqRef) {
  const tr = { name, list: [], isLocked: () => false };
  const add = (c) => { c.track = tr; tr.list.push(c); };
  clips.forEach(add);
  Object.defineProperty(tr, 'clips', { get() { const a = tr.list.slice().sort((x, y) => x._s - y._s); a.numItems = a.length; return a; } });
  // like Premiere: overwriting with an A/V clip on a video track also lays its sound on the same-numbered audio track
  tr.overwriteClip = (pi, at) => {
    const len = (pi._out === null ? 5 : pi._out) - pi._in;
    tr.list = tr.list.filter((c) => !(c._s < at + len && c._e > at));
    add(clip(pi, at, at + len, pi._in));
    const seq = seqRef();
    if (tr.kind === 'video' && pi.hasAudio) {
      const at2 = seq.audioTracks[tr.index];
      if (at2) { const c = clip(pi, at, at + len, pi._in); c.track = at2; at2.list.push(c); }
    }
  };
  return tr;
}
function tracks(list, kind) { const a = list.slice(); a.numTracks = a.length; list.forEach((t, i) => { a[i] = t; t.kind = kind; t.index = i; }); return a; }
function sequence(name, v, a, pi) {
  const s = { name, projectItem: pi, getSettings: () => ({ videoFrameRate: { seconds: 0.04 } }), getPlayerPosition: () => T(0), setPlayerPosition() {}, clone: () => true, sel: [] };
  s.videoTracks = tracks(v, 'video'); s.audioTracks = tracks(a, 'audio'); s.getSelection = () => s.sel;
  return s;
}

// ---- inner (nested) sequence: A 0–6 with sound, B 6–14 picture only in here
const A = media('A', { audio: true }), B = media('B', { audio: true }), intro = media('Intro', { audio: true }), nestPI = media('Nest 01', { nest: true });
let parent;
const iV1 = track('V1', [clip(A, 0, 6, 0), clip(B, 6, 14, 1)], () => inner);
const iA1 = track('A1', [clip(A, 0, 6, 0)], () => inner);
const inner = sequence('Nest 01', [iV1], [iA1], nestPI);
// ---- parent: Intro 0–5, then the nest 5–15 playing nest time 2–12, gap 15–17, Outro 17–20
const outro = media('Outro');
const pV1 = track('V1', [clip(intro, 0, 5), clip(nestPI, 5, 15, 2), clip(outro, 17, 20)], () => parent);
const pA1 = track('A1', [clip(intro, 0, 5), clip(nestPI, 5, 15, 2)], () => parent);
parent = sequence('Main', [pV1], [pA1], media('Main'));
parent.sel = [pV1.list[1]];

const seqs = [parent, inner]; seqs.numSequences = 2; seqs.forEach((x, i) => { seqs[i] = x; });
const ctx = { BridgeTalk: { appName: 'premierepro' }, Time: function () { this.seconds = 0; },
  app: { version: '26', project: { activeSequence: parent, sequences: seqs }, enableQE() {} }, qe: { project: { getActiveSequence: () => ({}) } } };
vm.createContext(ctx);
vm.runInContext(jsx('host.jsx'), ctx);
vm.runInContext(jsx('premiere.jsx'), ctx);
const run = (id, a) => JSON.parse(ctx.EW.run(id, JSON.stringify(a || {})));
const spans = (t) => t.clips.map((c) => `${c.name}@${+c._s.toFixed(2)}-${+c._e.toFixed(2)}`);

let r = run('pr.unnest', { keepCopy: true });
assert.ok(r.ok, r.msg);
assert.deepStrictEqual(spans(pV1), ['Intro@0-5', 'A@5-9', 'B@9-15', 'Outro@17-20'], 'picture comes back trimmed to what the nest played');
assert.deepStrictEqual(spans(pA1), ['Intro@0-5', 'A@5-9'], 'only the sound the nest had: no doubled or stray audio');
assert.strictEqual(B._in, 0, 'the project item gets its own in point back');

r = run('pr.closeGaps');
assert.ok(r.ok, r.msg);
assert.deepStrictEqual(spans(pV1), ['Intro@0-5', 'A@5-9', 'B@9-15', 'Outro@15-18'], 'the 2 s gap closes');
assert.deepStrictEqual(spans(pA1), ['Intro@0-5', 'A@5-9'], 'sound before the gap stays put');
console.log('timeline ok ·', r.msg);
