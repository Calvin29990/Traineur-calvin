import express from 'express';
import { WebSocketServer } from 'ws';
import http from 'http';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { Session, BALANCE } from './engine.js';
import { PACES, GAUGE_DEFS, INSTRUMENTS, ROLE_BADGES } from './content.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const PORT = Number(process.env.PORT || 8788);

const app = express();
app.use(express.json());

const dist = path.join(ROOT, 'dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist, {
    index: 'index.html',
    maxAge: '1h',
    setHeaders: (res, filePath) => {
      if (filePath.endsWith('index.html') || filePath.endsWith('.pdf')) {
        res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
      }
    },
  }));
}

app.get('/api/health', (_req, res) => res.json({
  ok: true,
  version: '3.0.0',
  sessions: sessions.size,
  balance: BALANCE,
  universe: INSTRUMENTS.map((i) => i.ticker),
  paces: PACES,
  roles: ROLE_BADGES,
}));

app.get('/api/gauges', (_req, res) => res.json(GAUGE_DEFS));

app.get('/api/leaderboard-sample', (_req, res) => {
  const s = new Session({ id: 'sample', seed: 1234 });
  s.round = 2;
  s.roundHistory = [{ pnl: 900000, scoreObj: { total: 88 } }, { pnl: 700000, scoreObj: { total: 91 } }];
  s.phase = 'done';
  res.json(s.leaderboard());
});

// Guide PDF (built by scripts/make-guide.mjs into public/) — served from dist in prod
app.get('/guide-amplifyme-top1.pdf', (_req, res) => {
  const candidates = [
    path.join(dist, 'guide-amplifyme-top1.pdf'),
    path.join(ROOT, 'public', 'guide-amplifyme-top1.pdf'),
  ];
  const found = candidates.find((p) => fs.existsSync(p));
  if (!found) return res.status(404).send('Guide PDF not built yet — run npm run make:guide');
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'inline; filename="guide-amplifyme-top1.pdf"');
  return res.sendFile(found);
});

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });
const sessions = new Map();
let seq = 0;

function newSession(nickname, opts = {}) {
  const id = `s${++seq}-${Date.now().toString(36)}`;
  const s = new Session({
    id,
    seed: opts.seed,
    rounds: opts.rounds,
    roundSeconds: opts.roundSeconds,
    pace: opts.pace,
    mode: opts.mode === 'dynamic' ? 'dynamic' : 'replay',
    startRole: opts.startRole === 'AM' ? 'AM' : 'IB',
    assistMode: Boolean(opts.assistMode),
    nickname: nickname || 'Calvin MINANG',
  });
  sessions.set(id, { s, sockets: new Set(), lastSent: 0, lastAction: Date.now() });
  return sessions.get(id);
}

const TICK = 250;
setInterval(() => {
  const now = Date.now();
  for (const [id, entry] of sessions) {
    const { s } = entry;
    if (!s.paused && entry.sockets.size > 0 && s.phase === 'round') {
      s.step((TICK / 1000) * s.speed);
    }
    if (now - entry.lastSent > 240) {
      entry.lastSent = now;
      let payload;
      try { payload = JSON.stringify({ type: 'state', data: s.snapshot() }); } catch { continue; }
      for (const ws of entry.sockets) {
        if (ws.readyState === 1) {
          try { ws.send(payload); } catch { /* ignore */ }
        }
      }
    }
    if (now - entry.lastAction > 4 * 3600 * 1000) {
      for (const ws of entry.sockets) { try { ws.close(); } catch { /* ignore */ } }
      sessions.delete(id);
    }
  }
}, TICK);

function send(entry, payload) {
  const raw = JSON.stringify(payload);
  for (const ws of entry.sockets) {
    if (ws.readyState === 1) {
      try { ws.send(raw); } catch { /* ignore */ }
    }
  }
}

function toast(entry, message, kind = 'err') {
  send(entry, { type: kind === 'err' ? 'error' : 'info', message });
}

function handleResult(entry, r) {
  if (r?.error) toast(entry, r.error, 'err');
}

wss.on('connection', (ws) => {
  let entry = null;

  ws.send(JSON.stringify({ type: 'hello', balance: BALANCE, paces: PACES }));

  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw.toString()); } catch { return; }
    const { type } = msg;

    if (type === 'join') {
      if (msg.sessionId && sessions.has(msg.sessionId)) {
        entry = sessions.get(msg.sessionId);
      } else {
        entry = newSession(msg.nickname, msg);
      }
      entry.sockets.add(ws);
      entry.lastAction = Date.now();
      ws.send(JSON.stringify({ type: 'joined', sessionId: entry.s.id }));
      ws.send(JSON.stringify({ type: 'state', data: entry.s.snapshot() }));
      return;
    }

    if (!entry) return;
    const s = entry.s;
    entry.lastAction = Date.now();

    switch (type) {
      case 'start': {
        if (s.phase !== 'briefing') break;
        if (msg.nickname) s.nickname = String(msg.nickname).slice(0, 24);
        s.mode = msg.mode === 'dynamic' ? 'dynamic' : 'replay';
        s.startRole = msg.startRole === 'AM' ? 'AM' : 'IB';
        if (typeof msg.assistMode === 'boolean') s.assistMode = msg.assistMode;
        if (msg.rounds) s.roundsTotal = Math.max(1, Math.min(4, Number(msg.rounds)));
        if (msg.pace && PACES[msg.pace]) {
          s.pace = msg.pace;
          s.roundSeconds = PACES[msg.pace].seconds;
        } else if (msg.roundSeconds) {
          s.roundSeconds = Math.max(120, Math.min(2400, Number(msg.roundSeconds)));
          s.pace = null;
        }
        s.clockScale = (4 * 3600) / s.roundSeconds;
        s.beginRound();
        break;
      }
      case 'nextRound': {
        if (s.phase === 'break') {
          s.debrief = { ...s.debrief, open: false };
          s.beginRound();
        } else if (s.phase === 'done') {
          s.debrief = s.debrief ? { ...s.debrief, open: false } : null;
        } else if (s.phase === 'round' && msg.force) {
          s.simTime = s.roundSeconds;
        }
        break;
      }
      case 'closeDebrief':
        s.debrief = s.debrief ? { ...s.debrief, open: false } : null;
        break;
      case 'restart': {
        const ns = newSession(msg.nickname ?? s.nickname, {
          rounds: msg.rounds ?? s.roundsTotal,
          roundSeconds: msg.roundSeconds ?? s.roundSeconds,
          pace: msg.pace ?? s.pace,
          mode: msg.mode ?? s.mode,
          startRole: msg.startRole ?? s.startRole,
          assistMode: msg.assistMode ?? s.assistMode,
        });
        entry.sockets.delete(ws);
        entry = ns;
        entry.sockets.add(ws);
        ws.send(JSON.stringify({ type: 'joined', sessionId: entry.s.id }));
        ws.send(JSON.stringify({ type: 'state', data: entry.s.snapshot() }));
        break;
      }
      case 'sendQuote':
        handleResult(entry, s.sendQuote({
          clientRoom: msg.clientRoom,
          ticker: msg.ticker,
          bid: msg.bid,
          offer: msg.offer,
          bidVol: msg.bidVol,
          offerVol: msg.offerVol,
          validFor: msg.validFor,
        }));
        break;
      case 'cancelQuote':
        handleResult(entry, s.cancelQuote(msg.quoteId));
        break;
      case 'requestQuote':
        handleResult(entry, s.requestQuote({
          dealerRoom: msg.dealerRoom,
          ticker: msg.ticker,
          qty: msg.qty,
          silent: Boolean(msg.silent),
        }));
        break;
      case 'acceptQuote':
        handleResult(entry, s.acceptDealerQuote({
          quoteId: msg.quoteId,
          side: msg.side,
          qty: msg.qty,
        }));
        break;
      case 'trade':
        handleResult(entry, s.tradeExchange(msg.ticker, msg.side, msg.qty));
        break;
      case 'hedge':
        handleResult(entry, s.hedge(msg.ticker));
        break;
      case 'flatten':
        for (const t of Object.keys(s.positions)) {
          if (s.positions[t].qty !== 0) {
            s.hedgeCooldown = 0;
            const qty = Math.abs(s.positions[t].qty);
            handleResult(entry, s.tradeExchange(t, s.positions[t].qty > 0 ? 'SELL' : 'BUY', qty));
          }
        }
        break;
      case 'chat':
        handleResult(entry, s.chat(msg.room || (s.role === 'AM' ? 'am' : 'ib'), msg.text));
        break;
      case 'readRoom': {
        if (s.role === 'IB') {
          const c = s.clients.find((x) => x.id === msg.room);
          if (c) c.unread = 0;
        }
        break;
      }
      case 'depth':
        s.lastDepth = s.depthQuote(msg.ticker, msg.qty);
        break;
      case 'chart':
        s.setChartTicker(msg.ticker);
        break;
      case 'watchTicker':
        s.toggleWatchTicker(msg.ticker);
        break;
      case 'toggleAssist':
        s.assistMode = !s.assistMode;
        break;
      case 'speed':
        s.speed = [0.5, 1, 2, 4].includes(msg.value) ? msg.value : s.speed;
        break;
      case 'pause':
        s.paused = !s.paused;
        break;
      case 'skipRound':
        if (s.phase === 'round') s.simTime = s.roundSeconds;
        break;
      default:
        break;
    }
  });

  ws.on('close', () => {
    if (entry) entry.sockets.delete(ws);
  });
});

app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/ws')) return next();
  const index = path.join(dist, 'index.html');
  if (fs.existsSync(index)) return res.sendFile(index);
  res.status(200).send('Interface non compilée : lancez « npm run build » puis rechargez.');
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[amplify-sim] http://0.0.0.0:${PORT}`);
});
