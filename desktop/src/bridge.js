// Local WebSocket server the Adobe panels connect to.
// "bridge" clients (one per app, hidden, start with the app) run commands.
// "status" clients (the visible HaloCut panel) only receive status and a log of what ran.
const { EventEmitter } = require('events');
const { WebSocketServer } = require('ws');

const PORT = 47820;

class Bridge extends EventEmitter {
  constructor(port = PORT) {
    super();
    this.port = port;
    this.clients = new Map(); // app id ("PPRO" / "AEFT") -> { ws, info }
    this.watchers = new Set(); // status panels
    this.pending = new Map();
    this.nextId = 1;
  }

  start() {
    this.wss = new WebSocketServer({ host: '127.0.0.1', port: this.port });
    this.wss.on('error', (err) => this.emit('error', err));
    this.wss.on('connection', (ws) => {
      let appId = null;
      ws.on('message', (raw) => {
        let msg;
        try { msg = JSON.parse(raw); } catch { return; }
        if (msg.type === 'hello') {
          if (msg.role === 'status') {
            this.watchers.add(ws);
          } else {
            appId = msg.app;
            this.clients.set(appId, { ws, info: msg });
            this.emit('change', this.status());
            this.broadcastStatus();
          }
        } else if (msg.type === 'status?') {
          ws.send(JSON.stringify({ type: 'status', bridge: this.status() }));
        } else if (msg.type === 'result' && this.pending.has(msg.id)) {
          const { resolve, timer, meta } = this.pending.get(msg.id);
          clearTimeout(timer);
          this.pending.delete(msg.id);
          const res = { ok: msg.ok, msg: msg.msg, data: msg.data };
          this.tell({ type: 'ran', ...meta, ok: res.ok, msg: res.msg });
          resolve(res);
        }
      });
      ws.on('close', () => {
        this.watchers.delete(ws);
        if (appId && this.clients.get(appId)?.ws === ws) {
          this.clients.delete(appId);
          this.emit('change', this.status());
          this.broadcastStatus();
        }
      });
    });
  }

  tell(obj) {
    const text = JSON.stringify(obj);
    for (const w of this.watchers) if (w.readyState === 1) w.send(text);
  }

  broadcastStatus() { this.tell({ type: 'status', bridge: this.status() }); }

  status() {
    const out = {};
    for (const [id, c] of this.clients) out[id] = { appVersion: c.info.appVersion, panel: c.info.panel };
    return out;
  }

  isConnected(appId) { return this.clients.has(appId); }

  run(appId, tool, args = {}, label = tool, timeoutMs = 8000) {
    const client = this.clients.get(appId);
    if (!client) {
      const name = appId === 'PPRO' ? 'Premiere Pro' : 'After Effects';
      return Promise.resolve({ ok: false, msg: `${name} bridge not running: restart ${name}` });
    }
    const id = this.nextId++;
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        resolve({ ok: false, msg: 'No answer from the bridge' });
      }, timeoutMs);
      this.pending.set(id, { resolve, timer, meta: { app: appId, tool, label } });
      client.ws.send(JSON.stringify({ type: 'run', id, tool, args, label }));
    });
  }
}

module.exports = { Bridge, PORT };
