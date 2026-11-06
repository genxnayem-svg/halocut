// Live test against the real Premiere Pro / After Effects panel.
// Quit HaloCut first (this script takes its port), then:
//   node test/live.js PPRO          read-only checks
//   node test/live.js PPRO --edit   also runs editing tools on the current selection (use a test project!)
const { Bridge } = require('../src/bridge');

const appId = process.argv[2] || 'PPRO';
const edit = process.argv.includes('--edit');

const SUITES = {
  PPRO: {
    read: [['ping'], ['pr.listEffects']],
    edit: [
      ['pr.selectAtPlayhead'], ['pr.center'], ['pr.scale100'], ['pr.fillFrame'], ['pr.fitFrame'],
      ['pr.punchIn'], ['pr.punchOut'], ['pr.rotate', { degrees: 90 }], ['pr.rotate', { degrees: -90 }],
      ['pr.opacity', { value: 50 }], ['pr.opacity', { value: 100 }], ['pr.resetMotion'],
      ['pr.flipH'], ['pr.effect', { name: 'Gaussian Blur', kind: 'video' }],
      ['pr.marker', { color: 1 }], ['pr.label', { index: 7 }], ['pr.toggleEnable'], ['pr.toggleEnable'],
      ['pr.unlink'], ['pr.link'], ['pr.cut'], ['pr.muteTargeted'], ['pr.muteTargeted'],
      // Tool wheel: speed (QE's units are learned on the first change) and gain, each put back after
      ['pr.speed', { percent: 200 }], ['pr.speed', { percent: 100 }], ['pr.gain', { db: 3 }], ['pr.gain', { db: -3 }],
    ],
  },
  AEFT: {
    read: [['ping'], ['ae.listEffects']],
    edit: [
      ['ae.newSolid'], ['ae.newText', { text: 'HaloCut test' }], ['ae.centerLayer'],
      ['ae.anchor', { x: 0, y: 0 }], ['ae.anchor', { x: 0.5, y: 0.5 }], ['ae.fitToComp'],
      ['ae.effect', { matchName: 'ADBE Gaussian Blur 2', name: 'Gaussian Blur' }], ['ae.marker'],
      ['ae.toggleMotionBlur'], ['ae.toggle3D'], ['ae.toggle3D'], ['ae.toggleShy'], ['ae.toggleShy'],
      ['ae.nullParent'], ['ae.duplicate'], ['ae.splitLayer'], ['ae.timeRemap'], ['ae.precompose'],
    ],
  },
};

(async () => {
  const b = new Bridge();
  b.on('error', (e) => { console.error(`Port busy (${e.message}). Quit HaloCut first.`); process.exit(1); });
  b.start();
  console.log(`Waiting for the ${appId} panel to connect…`);
  if (!b.isConnected(appId)) {
    await new Promise((r) => b.on('change', () => b.isConnected(appId) && r()));
  }
  console.log('Connected:', JSON.stringify(b.status()[appId]));

  // --avoid <text>: refuse to edit when the open sequence/comp name contains it (protects real projects)
  const avoidAt = process.argv.indexOf('--avoid');
  if (edit && avoidAt > 0) {
    const ping = await b.run(appId, 'ping');
    const name = (ping.data && (ping.data.sequence || ping.data.comp)) || '';
    console.log(`Open: "${name}"`);
    if (!name || name.toLowerCase().includes(process.argv[avoidAt + 1].toLowerCase())) {
      console.log('STOP  not a test project — no edits made');
      process.exit(2);
    }
  }

  const suite = SUITES[appId];
  const list = suite.read.concat(edit ? suite.edit : []);
  let fails = 0;
  for (const [tool, args] of list) {
    const r = await b.run(appId, tool, args || {});
    if (!r.ok) fails++;
    let extra = '';
    if (r.data && tool.endsWith('listEffects')) {
      extra = ' ' + Object.entries(r.data).map(([k, v]) => `${k}:${v.length}`).join(' ');
    } else if (r.data) extra = ' ' + JSON.stringify(r.data);
    console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${tool}${args ? ' ' + JSON.stringify(args) : ''}  — ${r.msg}${extra}`);
  }
  console.log(`\n${list.length - fails}/${list.length} passed`);
  process.exit(fails ? 1 : 0);
})();
