// Premiere marker commands against a pretend marker collection.
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const jsx = (f) => fs.readFileSync(path.join(__dirname, '../../extension/jsx', f), 'utf8');
const T = (s) => ({ seconds: s });
let id = 1;
const list = [];
const mk = (s) => { const m = { guid: 'm' + id++, start: T(s), end: T(s), name: '', comments: '', _c: 0, type: 'Comment',
  getColorByIndex() { return this._c; }, setColorByIndex(i) { this._c = i; } }; list.push(m); return m; };
const markers = { createMarker: (s) => mk(s), deleteMarker: (m) => list.splice(list.indexOf(m), 1),
  getFirstMarker: () => list.slice().sort((a, b) => a.start.seconds - b.start.seconds)[0],
  getNextMarker: (m) => { const s = list.slice().sort((a, b) => a.start.seconds - b.start.seconds); return s[s.indexOf(m) + 1]; } };
const sequence = { name: 'Vlog', end: String(300 * 254016000000), markers, getSettings: () => ({ videoFrameRate: { seconds: 0.04 } }) };
const ctx = { BridgeTalk: { appName: 'premierepro' }, Time: function () { this.seconds = 0; }, app: { version: '26', project: { activeSequence: sequence } } };
vm.createContext(ctx);
vm.runInContext(jsx('host.jsx'), ctx);
vm.runInContext(jsx('premiere.jsx'), ctx);
const run = (t, a) => JSON.parse(ctx.EW.run(t, JSON.stringify(a || {})));

assert.ok(run('pr.markersAdd', { items: [{ start: 75, name: 'Setup', color: 3 }, { start: 12, name: 'Hook' }] }).ok);
let r = run('pr.markersList');
assert.deepStrictEqual(r.data.markers.map((m) => [m.start, m.name, m.color]), [[12, 'Hook', 0], [75, 'Setup', 3]], 'listed in time order');
assert.strictEqual(r.data.fps, 25); assert.strictEqual(r.data.end, 300);
const [hook, setup] = r.data.markers;
assert.ok(run('pr.markersUpdate', { changes: [{ guid: hook.guid, name: 'Why', color: 1 }, { guid: setup.guid, start: 80 }] }).ok);
r = run('pr.markersList');
assert.deepStrictEqual(r.data.markers.map((m) => [m.start, m.name, m.color]), [[12, 'Why', 1], [80, 'Setup', 3]]);
assert.ok(run('pr.markersDelete', { guids: [hook.guid] }).ok);
assert.strictEqual(run('pr.markersList').data.markers.length, 1);
console.log('markers host ok');
