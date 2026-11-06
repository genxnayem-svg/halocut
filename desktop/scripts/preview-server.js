// Serves a folder on localhost for previewing panels in a browser.
//   node scripts/preview-server.js <folder relative to desktop/> [port]
const http = require('http');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', process.argv[2] || '../extension/client');
const port = Number(process.env.PORT || process.argv[3] || 8765);
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml' };

// ?mock=ew on an HTML page puts in a stand-in for the desktop app (scripts/ew-mock.js), so the settings window
// can be looked at in a browser; it reads its starting data from /__ew-data.json.
function ewData() {
  const { defaults } = require('../src/config');
  const { tools } = require('../src/tools');
  return { config: defaults(), tools, geometry: require('../src/wheel-geometry').R, platform: 'darwin',
    status: { bridge: {}, frontApp: 'Premiere Pro', frontAppId: 'PPRO', accessibility: true, inputError: null, canBlock: true, seenButtons: ['left', 'right'], version: 'preview', paused: false, extensionInstalled: true } };
}

http.createServer((req, res) => {
  const rel = decodeURIComponent(req.url.split('?')[0]);
  if (rel === '/__ew-data.json') { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(ewData())); return; }
  const mock = /[?&]mock=ew\b/.test(req.url);
  const file = path.join(root, rel === '/' ? 'index.html' : rel);
  if (!file.startsWith(root)) { res.writeHead(403); res.end(); return; }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); res.end('Not found'); return; }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream' });
    if (mock && /\.html$/i.test(file)) data = String(data).replace('<script', '<script src="/scripts/ew-mock.js"></script>\n  <script');
    res.end(data);
  });
}).listen(port, '127.0.0.1', () => console.log(`Serving ${root} on http://127.0.0.1:${port}`));
