// The Tool wheel takes anything from Premiere Pro: its tools and commands, every effect and transition, HaloCut's
// looks and commands, any shortcut. And the layout edits the settings page makes.
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const T = require('../src/tool-catalog');
const { tools, layouts } = require('../src/tools');
const { Config } = require('../src/config');
const ext = (f) => require(path.join(__dirname, '../../extension/client', f));
const cores = { command: ext('command-core.js'), toolbar: ext('toolbar-core.js'), grade: ext('grade-core.js'), motion: ext('motion-core.js'), trans: ext('trans-core.js') };
const effects = { video: ['Gaussian Blur', 'Crop', 'Twirl'], audio: ['DeNoise'], transitions: ['Cross Dissolve', 'Dip to Black', 'Iris Round'] };
const jsx = fs.readFileSync(path.join(__dirname, '../../extension/jsx/premiere.jsx'), 'utf8');

// ---- the catalog
const pr = T.build({ tools, app: 'PPRO', cores, effects, fps: 25 });
assert.strictEqual(new Set(pr.map((i) => i.id)).size, pr.length, 'ids are unique');
const by = (id) => pr.find((i) => i.id === id);
const inGroup = (g) => pr.filter((i) => i.group === g);
assert.strictEqual(inGroup('prtools').length, T.PR_TOOLS.length);
assert.strictEqual(inGroup('prcommands').length, T.PR_COMMANDS.length);
assert.deepStrictEqual(by('custom.PPRO.key:c').def, { label: 'Razor', hint: 'C', icon: 'scissors', kind: 'keys', keys: 'c', app: 'PPRO' });
assert.strictEqual(by('custom.PPRO.key:mod+k').label, 'Add Edit');
assert.ok(by('custom.PPRO.fx:Twirl') && by('custom.PPRO.afx:DeNoise').group === 'audio' && by('custom.PPRO.tr:Iris Round').group === 'transitions');
assert.deepStrictEqual(by('custom.PPRO.tr:Iris Round').def, { label: 'Iris Round', hint: 'On the selected clips', icon: 'transition', kind: 'bridge', app: 'PPRO', tool: 'pr.transition', args: { name: 'Iris Round', seconds: 1 } });
assert.ok(!by('custom.PPRO.tr:Dip to Black') && !by('custom.PPRO.tr:Cross Dissolve') && by('pr.tr.dipBlack'), "HaloCut's own Dip to Black and Cross Dissolve aren't listed twice");
assert.strictEqual(by('custom.PPRO.grade:warm').def.tool, 'pr.gradeLook');
assert.ok(inGroup('looks').some((i) => i.id.startsWith('custom.PPRO.motion:')) && pr.some((i) => i.id.startsWith('custom.PPRO.cut:')));
assert.ok(by('custom.PPRO.cmd:closeGapHere') || by('custom.PPRO.cmd:gapHere'), 'HaloCut commands too');
assert.ok(!by('custom.PPRO.fx:Gaussian Blur') && by('pr.fx.blur'), "HaloCut's own Gaussian Blur isn't listed twice");
assert.ok(!pr.some((i) => i.def && i.def.tool === 'pr.punchIn' && JSON.stringify(i.def.args) === '{"factor":1.2}'), 'nor its Punch in');
assert.ok(!pr.some((i) => i.id.startsWith('ae.')), 'no After Effects tools on the Premiere wheel');
for (const it of pr) {
  const d = it.def || tools[it.id];
  assert.ok(d && d.label && it.label && it.icon, it.id);
  if (d.kind === 'bridge') assert.ok(jsx.includes(`T["${d.tool || it.id}"]`), `${it.id} → ${d.tool || it.id} exists in Premiere`);
  else assert.ok(T.cleanKeys(d.keys) && (!it.def || T.cleanKeys(d.keys) === d.keys), `${it.id}: HaloCut can press ${d.keys}`);
}
assert.doesNotThrow(() => JSON.stringify(pr));
console.log('catalog · Premiere Pro:', pr.length, 'things for the wheel');

// without Premiere's list (not open yet) and without the extension: still its tools, commands and HaloCut's own
const bare = T.build({ tools, app: 'PPRO', cores: null });
assert.ok(bare.length === Object.values(tools).filter((t) => !t.app || t.app === 'PPRO').length + T.PR_TOOLS.length + T.PR_COMMANDS.length);
const ae = T.build({ tools, app: 'AEFT', cores, effects });
assert.ok(ae.every((i) => i.group === 'halocut' && (!tools[i.id].app || tools[i.id].app === 'AEFT')) && ae.some((i) => i.id === 'ae.precompose'));

// search
assert.strictEqual(T.search(pr, 'razor')[0].label, 'Razor');
assert.strictEqual(T.search(pr, 'gauss')[0].id, 'pr.fx.blur');
assert.strictEqual(T.search(pr, 'cross')[0].id, 'pr.tr.cross');
assert.ok(T.search(pr, 'ripple trim').every((i) => /ripple trim/i.test(i.label)) && T.search(pr, 'ripple trim').length === 2);
assert.ok(T.search(pr, '', 'transitions').every((i) => i.group === 'transitions'));
assert.ok(T.search(pr, 'twirl', 'audio').length === 0);

// shortcuts typed or recorded
assert.strictEqual(T.keysFromRecord({ kind: 'key', name: 'ArrowLeft', mods: ['cmd', 'shift'] }), 'shift+mod+left');
assert.strictEqual(T.keysFromRecord({ kind: 'key', name: 'N', mods: ['ctrl'] }, false), 'mod+n', 'Ctrl is the main key on Windows');
assert.strictEqual(T.keysFromRecord({ kind: 'key', name: 'Semicolon', mods: [] }), ';');
assert.strictEqual(T.cleanKeys(' Cmd + Shift + N '), 'shift+mod+n');
assert.strictEqual(T.cleanKeys('option+f5'), 'alt+f5');
assert.strictEqual(T.cleanKeys('hyper+x'), ''); assert.strictEqual(T.cleanKeys('mod+'), ''); assert.strictEqual(T.cleanKeys('mod+banana'), '');
assert.strictEqual(T.keysLabel('shift+mod+k'), '⇧⌘K'); assert.strictEqual(T.keysLabel('alt+x', false), 'Alt+X');
const own = T.keysItem('PPRO', 'Nest', 'alt+mod+n');
assert.deepStrictEqual(own, { id: 'custom.PPRO.key:alt+mod+n', label: 'Nest', hint: '⌥⌘N', group: 'keys', icon: 'keyboard', def: { label: 'Nest', hint: '⌥⌘N', icon: 'keyboard', kind: 'keys', keys: 'alt+mod+n', app: 'PPRO' } });

// ---- editing a layout
let L = JSON.parse(JSON.stringify(layouts.PPRO));
const before = JSON.stringify(L);
let r = T.addTool(L, 0, 'custom.PPRO.key:c', 'Razor');
assert.ok(r.ok && r.layout.segments[0].tools.at(-1) === 'custom.PPRO.key:c' && new RegExp('Added Razor to ' + L.segments[0].name).test(r.msg), r.msg);
assert.strictEqual(JSON.stringify(L), before, 'the layout passed in is never changed');
L = r.layout;
r = T.addTool(L, 0, 'custom.PPRO.key:c', 'Razor');
assert.ok(!r.ok && new RegExp('already in ' + L.segments[0].name).test(r.msg));
let full = L;
for (let i = 0; full.segments[0].tools.length < T.MAX_TOOLS; i++) full = T.addTool(full, 0, 'x' + i).layout;
r = T.addTool(full, 0, 'one-more');
assert.ok(!r.ok && /full/.test(r.msg));
r = T.setMain(L, 0, 'custom.PPRO.key:c');
assert.ok(r.ok && r.layout.segments[0].main === 'custom.PPRO.key:c');
r = T.removeTool(r.layout, 0, r.layout.segments[0].tools.length - 1);
assert.ok(r.ok && r.layout.segments[0].main === r.layout.segments[0].tools[0], 'removing the main tool makes the first one main');
r = T.moveTool(L, 0, 0, 1);
assert.deepStrictEqual(r.layout.segments[0].tools.slice(0, 2), [L.segments[0].tools[1], L.segments[0].tools[0]]);
assert.ok(!T.moveTool(L, 0, 0, -1).ok, "can't move past the start");
r = T.addSegment(L, 'Effects', 'custom.PPRO.fx:Twirl', 'fx');
const seg = r.layout.segments.at(-1);
assert.ok(r.ok && seg.name === 'Effects' && seg.main === 'custom.PPRO.fx:Twirl' && seg.tools.length === 1 && seg.icon === 'fx');
assert.ok(!L.segments.some((s) => s.color === seg.color), 'a colour no other segment has');
let many = r.layout;
while (many.segments.length < T.MAX_SEGMENTS) many = T.addSegment(many, 'S', 'x').layout;
assert.ok(!T.addSegment(many, 'S', 'x').ok);
r = T.removeTool(r.layout, r.layout.segments.length - 1, 0);
assert.ok(!r.ok && /delete the segment/.test(r.msg), 'a segment keeps one tool');
r = T.moveSegment(L, 0, 1);
assert.deepStrictEqual(r.layout.segments.slice(0, 2).map((s) => s.name), [L.segments[1].name, L.segments[0].name]);
assert.ok(T.removeSegment(L, 0).layout.segments.length === L.segments.length - 1);
assert.ok(!T.removeSegment({ segments: [L.segments[0]] }, 0).ok, 'one segment stays');
assert.strictEqual(T.renameSegment(L, 0, '  Cut it up and make it shorter ').layout.segments[0].name, 'Cut it up and ma');
assert.ok(!T.renameSegment(L, 0, '  ').ok);
assert.notStrictEqual(T.recolorSegment(L, 0).layout.segments[0].color, L.segments[0].color);

// ---- custom tools: kept while something uses them, saved with the settings
const customs = { 'custom.PPRO.key:c': by('custom.PPRO.key:c').def, 'custom.PPRO.fx:Twirl': by('custom.PPRO.fx:Twirl').def, 'custom.PPRO.key:q': by('custom.PPRO.key:q').def };
const conf = { layouts: { PPRO: L }, options: {}, profiles: { PPRO: { mouse4: { type: 'tool', id: 'custom.PPRO.key:q' } } } };
assert.deepStrictEqual(Object.keys(T.prune(customs, conf)), ['custom.PPRO.key:c', 'custom.PPRO.key:q'], 'Twirl is on nothing any more');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'halocut-conf-'));
const c1 = new Config(dir);
assert.deepStrictEqual(c1.data.customTools, {});
c1.update({ layouts: { ...c1.data.layouts, PPRO: L }, customTools: customs });
const c2 = new Config(dir);
assert.deepStrictEqual(c2.data.customTools, customs); assert.ok(c2.data.layouts.PPRO.segments[0].tools.includes('custom.PPRO.key:c'));
fs.rmSync(dir, { recursive: true });
console.log('tool catalog ok · layout edits, shortcuts and saved tools');
