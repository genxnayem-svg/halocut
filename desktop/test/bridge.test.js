// Starts the bridge server, connects a fake panel and runs a tool round trip.
const assert = require('node:assert');
const WebSocket = require('ws');
const { Bridge } = require('../src/bridge');
const PORT = 47899; // not the real app's port

(async () => {
  const b = new Bridge(PORT);
  b.start();
  const missing = await b.run('AEFT', 'ping');
  assert.strictEqual(missing.ok, false);

  const ws = new WebSocket(`ws://127.0.0.1:${PORT}`);
  await new Promise((r) => ws.on('open', r));
  ws.on('message', (raw) => {
    const m = JSON.parse(raw);
    if (m.type === 'run') ws.send(JSON.stringify({ type: 'result', id: m.id, ok: true, msg: `ran ${m.tool}`, data: m.args }));
  });
  const changed = new Promise((r) => b.once('change', r));
  ws.send(JSON.stringify({ type: 'hello', app: 'PPRO', appVersion: '26.0', panel: '0.1.0' }));
  await changed;
  assert.ok(b.isConnected('PPRO'));

  const res = await b.run('PPRO', 'pr.rotate', { degrees: 90 });
  assert.deepStrictEqual(res, { ok: true, msg: 'ran pr.rotate', data: { degrees: 90 } });

  // A status panel gets told what ran, and is never sent commands
  const watcher = new WebSocket(`ws://127.0.0.1:${PORT}`);
  await new Promise((r) => watcher.on('open', r));
  const seen = [];
  watcher.on('message', (raw) => seen.push(JSON.parse(raw)));
  watcher.send(JSON.stringify({ type: 'hello', role: 'status', app: 'PPRO' }));
  watcher.send(JSON.stringify({ type: 'status?' }));
  await new Promise((r) => setTimeout(r, 50));
  await b.run('PPRO', 'pr.cut');
  await new Promise((r) => setTimeout(r, 50));
  assert.ok(seen.some((m) => m.type === 'status' && m.bridge.PPRO));
  assert.ok(seen.some((m) => m.type === 'ran' && m.tool === 'pr.cut' && m.ok));
  assert.ok(b.isConnected('PPRO'), 'status panel must not replace the bridge');
  watcher.close();

  ws.close();
  await new Promise((r) => b.once('change', r));
  assert.ok(!b.isConnected('PPRO'));
  b.wss.close();
  console.log('bridge ok');
})().catch((e) => { console.error(e); process.exit(1); });
