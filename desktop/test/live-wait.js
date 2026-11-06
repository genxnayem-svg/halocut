// Holds the bridge port and runs the read-only suite for each app as its panel connects.
const { Bridge } = require('../src/bridge');
const b = new Bridge();
b.on('error', (e) => { console.error('Port busy:', e.message); process.exit(1); });
b.start();
const done = new Set();
console.log('Waiting for panels…');
b.on('change', async () => {
  for (const app of ['PPRO', 'AEFT']) {
    if (!b.isConnected(app) || done.has(app)) continue;
    done.add(app);
    console.log(`[${app}] connected ${JSON.stringify(b.status()[app])}`);
    for (const tool of ['ping', app === 'PPRO' ? 'pr.listEffects' : 'ae.listEffects']) {
      const r = await b.run(app, tool, {}, tool, 20000);
      const extra = r.data ? (tool === 'ping' ? JSON.stringify(r.data)
        : Object.entries(r.data).map(([k, v]) => `${k}:${v.length}`).join(' ')) : '';
      console.log(`[${app}] ${r.ok ? 'PASS' : 'FAIL'} ${tool} — ${r.msg} ${extra}`);
    }
  }
});
