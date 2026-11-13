// Socket shell for the matchmaking server: HTTP health check, WebSocket at /ws, keepalive,
// a once-a-second tick, and a graceful drain on SIGTERM/SIGINT for rolling updates.
import { createServer } from 'node:http';
import { WebSocketServer, WebSocket } from 'ws';
import { Matchmaker } from './matchmaker';
import type { Conn } from './matchmaker';
import { PRIVATE_FILL_WAIT_S, PUBLIC_FILL_WAIT_S } from '../../src/net/protocol';

const PORT = Number(process.env.PORT) || 8787;

const mm = new Matchmaker({
  publicWaitS: Number(process.env.MM_PUBLIC_WAIT_S) || PUBLIC_FILL_WAIT_S,
  privateWaitS: Number(process.env.MM_PRIVATE_WAIT_S) || PRIVATE_FILL_WAIT_S,
  now: Date.now,
  random: Math.random,
});

// ---------------------------------------------------------------- HTTP

const http = createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const path = new URL(req.url ?? '/', 'http://x').pathname;
  if (req.method === 'GET' && path === '/healthz') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify(mm.stats()));
    return;
  }
  if (req.method === 'GET' && path === '/') {
    res.writeHead(200, { 'content-type': 'text/plain' });
    res.end('Lawn Gnome Panic matchmaking. Connect a WebSocket to /ws.');
    return;
  }
  res.writeHead(404, { 'content-type': 'text/plain' });
  res.end('Not found');
});

// ---------------------------------------------------------------- WebSocket

const wss = new WebSocketServer({ noServer: true, maxPayload: 64 * 1024 });

http.on('upgrade', (req, socket, head) => {
  const path = new URL(req.url ?? '/', 'http://x').pathname;
  if (path !== '/ws') {
    socket.destroy();
    return;
  }
  wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req));
});

let nextId = 1;
/** Sockets that answered the last ping (or opened since). Anything else is terminated. */
const alive = new WeakSet<WebSocket>();

wss.on('connection', (ws) => {
  const id = nextId++;
  alive.add(ws);
  ws.on('pong', () => alive.add(ws));

  const conn: Conn = {
    id,
    send: (msg) => {
      if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
    },
    close: () => ws.close(),
  };
  mm.connect(conn);

  ws.on('message', (data, isBinary) => {
    if (isBinary) return;
    let parsed: unknown;
    try {
      parsed = JSON.parse(data.toString());
    } catch {
      return;
    }
    mm.handle(conn, parsed);
  });
  ws.on('close', () => mm.disconnect(conn));
  ws.on('error', () => {}); // close follows
});

setInterval(() => {
  for (const ws of wss.clients) {
    if (!alive.has(ws)) {
      ws.terminate();
      continue;
    }
    alive.delete(ws);
    ws.ping();
  }
}, 20_000);

setInterval(() => mm.tick(), 1000);

// ---------------------------------------------------------------- shutdown

let draining = false;

function shutdown(signal: string): void {
  if (draining) {
    process.exit(0); // second signal: stop now
  }
  draining = true;
  console.log(`${signal}: draining`);
  mm.drain();
  const timer = setInterval(() => {
    if (mm.stats().matches > 0) return;
    clearInterval(timer);
    wss.close();
    http.close();
    process.exit(0);
  }, 1000);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

http.listen(PORT, () => {
  console.log(`matchmaking on :${PORT}`);
});
