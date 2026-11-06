// The Tool wheel's Colour and Sequence tools against a pretend Premiere: copy a Lumetri grade, paste it on other clips,
// reset it; a sequence from a clip, and a copy of the open sequence. © 2026 Imtayz Nayem
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { tools, layouts } = require('../src/tools');
const jsx = (f) => fs.readFileSync(path.join(__dirname, '../../extension/jsx', f), 'utf8');
const list = (a) => { Object.defineProperty(a, 'numItems', { get() { return a.length; } }); return a; };
const prop = (name, v) => ({ displayName: name, v, getValue() { return this.v; }, setValue(x) { this.v = x; }, isTimeVarying() { return false; } });
const LUMETRI = [['Basic Correction'], ['Input LUT', 0], ['Temperature', 0], ['Tint', 0], ['Exposure', 0], ['Contrast', 0], ['Highlights', 0], ['Shadows', 0],
  ['Whites', 0], ['Blacks', 0], ['Saturation', 100], ['Creative'], ['Faded Film', 0], ['Sharpen', 0], ['Vibrance', 0], ['Saturation', 100],
  ['Color Wheels'], ['Shadows', 0], ['Highlights', 0], ['Vignette'], ['Amount', 0], ['Midpoint', 50]];
const lumetriComp = () => ({ matchName: 'AE.ADBE Lumetri', displayName: 'Lumetri Color', properties: list(LUMETRI.map(([n, v]) => prop(n, v))) });
let id = 1;
function clip(start, graded) {
  const comps = list([{ matchName: 'AE.ADBE Motion', displayName: 'Motion', properties: list([prop('Position', [0.5, 0.5]), prop('Scale', 100)]) }]);
  if (graded) comps.push(lumetriComp());
  return { nodeId: 'c' + id++, name: 'Shot ' + id, mediaType: 'Video', projectItem: { name: `Shot ${id}.mov` }, components: comps,
    start: { seconds: start }, end: { seconds: start + 5 }, inPoint: { seconds: 0 }, setSelected() {} };
}
const A = clip(0, true), B = clip(5, false), C = clip(10, true);
const v1 = { clips: list([A, B, C]) };
const seqs = [];
const mkSeq = (name, w, h) => { const q = { name, sequenceID: 'seq' + (seqs.length + 1), frameSizeHorizontal: w, frameSizeVertical: h, projectItem: { name } }; seqs.push(q); return q; };
const s = { ...mkSeq('Edit', 1920, 1080), videoTracks: [v1], audioTracks: [], _sel: [], _at: 1, getSelection() { return this._sel; }, getPlayerPosition() { return { seconds: this._at }; },
  getSettings: () => ({ videoFrameRate: { seconds: 0.04 } }), clone() { mkSeq(this.name + ' Copy', 1920, 1080); return true; } };
seqs[0] = s;
s.videoTracks.numTracks = 1; s.audioTracks.numTracks = 0;
let opened = null;
const sequences = { get numSequences() { return seqs.length; } };
for (let i = 0; i < 10; i++) Object.defineProperty(sequences, i, { get: () => seqs[i] });
const qeSeqMock = { getVideoTrackAt: () => ({ numItems: v1.clips.length, getItemAt: (j) => ({ type: 'Clip', start: { secs: v1.clips[j].start.seconds },
  addVideoEffect() { v1.clips[j].components.push(lumetriComp()); } }) }) };
const ctx = { BridgeTalk: { appName: 'premierepro' }, Time: function () {},
  app: { version: '26', enableQE() {}, project: { activeSequence: s, sequences,
    createNewSequenceFromClips: (name, items) => mkSeq(name, 3840, 2160), openSequence: (sid) => { opened = sid; } } },
  qe: { project: { getActiveSequence: () => qeSeqMock, getVideoEffectByName: (n) => ({ name: n }) } } };
vm.createContext(ctx);
vm.runInContext(jsx('host.jsx'), ctx);
vm.runInContext(jsx('premiere.jsx'), ctx);
const run = (t, a) => JSON.parse(ctx.EW.run(t, JSON.stringify(a || {})));
const lum = (c) => c.components.find((x) => x.displayName === 'Lumetri Color').properties;

// colour: nothing copied yet
assert.ok(!run('pr.colorPaste').ok);
// copy A's grade (playhead on A)
lum(A)[2].v = 25; lum(A)[4].v = 0.6; lum(A)[10].v = 130; lum(A)[20].v = -1.5;
let r = run('pr.colorCopy');
assert.ok(r.ok && /Copied the colour of Shot/.test(r.msg), r.msg);
// a clip without Lumetri can't be copied from
s._at = 6;
assert.ok(!run('pr.colorCopy').ok, 'B has no grade');
// paste on B (gets a Lumetri) and C, selected
s._sel = [B, C];
r = run('pr.colorPaste');
assert.ok(r.ok && /on 2 clips/.test(r.msg), r.msg);
assert.deepStrictEqual([lum(B)[2].v, lum(B)[4].v, lum(B)[10].v, lum(B)[20].v], [25, 0.6, 130, -1.5]);
assert.deepStrictEqual([lum(C)[2].v, lum(C)[10].v], [25, 130]);
assert.strictEqual(lum(B)[15].v, 100, 'the Creative saturation is not the Basic one');
// reset B back to neutral; a clip without Lumetri can't be reset
s._sel = [B];
r = run('pr.colorReset');
assert.ok(r.ok && /Colour reset on 1 clip/.test(r.msg), r.msg);
assert.deepStrictEqual([lum(B)[2].v, lum(B)[4].v, lum(B)[10].v, lum(B)[20].v], [0, 0, 100, 0]);

// sequences: from the selected clip, opened
r = run('pr.seqFromClip');
assert.ok(r.ok && /3840×2160/.test(r.msg) && opened === seqs.at(-1).sequenceID, r.msg);
assert.ok(!/\.mov/.test(seqs.at(-1).name), 'named after the clip, without .mov');
// a copy of the open sequence, opened
r = run('pr.seqDuplicate');
assert.ok(r.ok && /Edit Copy/.test(r.msg) && opened === seqs.at(-1).sequenceID, r.msg);

// on the wheel
const names = layouts.PPRO.segments.map((x) => x.name);
assert.ok(names.includes('Colour') && names.includes('Sequence') && names.length <= 10);
for (const t of ['pr.colorCopy', 'pr.colorPaste', 'pr.colorReset', 'pr.seqFromClip', 'pr.seqDuplicate', 'pr.unnest']) assert.ok(tools[t] && jsx('premiere.jsx').includes(`T["${t}"]`), t);
assert.ok(layouts.PPRO.segments.find((x) => x.name === 'Sequence').tools.includes('pr.key.nest') && tools['pr.key.nest'].keys === 'ctrl+alt+n');
console.log('colour & sequence ok');
