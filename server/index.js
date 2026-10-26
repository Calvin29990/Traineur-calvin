import express from 'express';
import { WebSocketServer } from 'ws';
import http from 'http';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { Session, BALANCE } from './engine.js';

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
      if (filePath.endsWith('index.html')) res.setHeader('Cache-Control', 'no-cache');
    },
  }));
}

app.get('/api/health', (_req, res) => res.json({ ok: true, sessions: sessions.size, balance: BALANCE }));

app.get('/api/leaderboard-sample', (_req, res) => {
  const s = new Session({ id: 'sample', seed: 1234 });
  s.round = s.roundsTotal;
  s.phase = 'done';
  res.json(s.leaderboard());
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
    mode: opts.mode || 'challenge',
    startRole: opts.startRole || 'IB',
    assistMode: Boolean(opts.assistMode),
    nickname: nickname || 'calvin',
  });
  sessions.set(id, { s, sockets: new Set(), lastSent: 0, lastAction: Date.now() });
  return sessions.get(id);
}

const TICK = 250;
setInterval(() => {
  const now = Date.now();
  for (const [id, entry] of sessions) {
    const { s } = entry;
    if (!s.paused && entry.sockets.size > 0) s.step((TICK / 1000) * s.speed);
    if (now - entry.lastSent > 240) {
      entry.lastSent = now;
      const payload = JSON.stringify({ type: 'state', data: s.snapshot() });
      for (const ws of entry.sockets) {
        if (ws.readyState === 1) {
          try { ws.send(payload); } catch { /* ignore */ }
        }
      }
    }
    if (now - entry.lastAction > 3 * 3600 * 1000) {
      for (const ws of entry.sockets) { try { ws.close(); } catch { /* ignore */ } }
      sessions.delete(id);
    }
  }
}, TICK);

function broadcastToast(entry, message, kind = 'err') {
  const payload = JSON.stringify({ type: kind === 'err' ? 'error' : 'info', message });
  for (const ws of entry.sockets) {
    if (ws.readyState === 1) {
      try { ws.send(payload); } catch { /* ignore */ }
    }
  }
}

wss.on('connection', (ws) => {
  let entry = null;

  ws.send(JSON.stringify({ type: 'hello', balance: BALANCE }));

  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw.toString()); } catch { return; }
    const { type } = msg;

    if (type === 'join') {
      if (msg.sessionId && sessions.has(msg.sessionId)) {
        entry = sessions.get(msg.sessionId);
      } else {
        entry = newSession(msg.nickname, {
          rounds: msg.rounds,
          roundSeconds: msg.roundSeconds,
          seed: msg.seed,
          mode: msg.mode,
          startRole: msg.startRole,
          assistMode: msg.assistMode,
        });
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
        if (s.phase === 'briefing') {
          if (msg.nickname) s.nickname = String(msg.nickname).slice(0, 22);
          if (msg.mode && ['challenge', 'ib', 'am'].includes(msg.mode)) s.mode = msg.mode;
          if (msg.startRole && ['IB', 'AM'].includes(msg.startRole)) s.startRole = msg.startRole;
          if (typeof msg.assistMode === 'boolean') s.assistMode = msg.assistMode;
          if (msg.rounds) s.roundsTotal = Math.max(1, Math.min(6, Number(msg.rounds)));
          if (msg.roundSeconds) s.roundSeconds = Math.max(90, Math.min(1800, Number(msg.roundSeconds)));
          s.botPool = s.buildBotPool();
          s.beginRound();
        }
        break;
      }
      case 'nextRound': {
        if (s.phase === 'break') {
          s.debrief = { ...s.debrief, open: false };
          s.beginRound();
        } else if (s.phase === 'round' && msg.force) {
          s.simTime = s.roundSeconds;
        }
        break;
      }
      case 'closeDebrief':
        s.debrief = s.debrief ? { ...s.debrief, open: false } : null;
        break;
      case 'restart': {
        const ns = newSession(s.nickname, {
          rounds: msg.rounds ?? s.roundsTotal,
          roundSeconds: msg.roundSeconds ?? s.roundSeconds,
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
      case 'sendQuote': {
        const r = s.sendQuote({
          clientRoom: msg.clientRoom,
          ticker: msg.ticker,
          bid: msg.bid,
          offer: msg.offer,
          bidVol: msg.bidVol,
          offerVol: msg.offerVol,
          validFor: msg.validFor,
          rfqId: msg.rfqId,
        });
        if (r.error) broadcastToast(entry, r.error, 'err');
        break;
      }
      case 'cancelQuote': {
        const r = s.cancelQuote(msg.quoteId);
        if (r.error) broadcastToast(entry, r.error, 'err');
        break;
      }
      case 'requestQuote': {
        const r = s.requestQuote({
          dealerRoom: msg.dealerRoom,
          ticker: msg.ticker,
          qty: msg.qty,
        });
        if (r.error) broadcastToast(entry, r.error, 'err');
        break;
      }
      case 'acceptQuote': {
        const r = s.acceptDealerQuote({
          quoteId: msg.quoteId,
          side: msg.side,
          qty: msg.qty,
        });
        if (r.error) broadcastToast(entry, r.error, 'err');
        break;
      }
      case 'quote': {
        const r = s.quoteRfq(msg.rfqId, msg.bid, msg.offer, msg.bidVol, msg.offerVol, msg.ttl);
        if (r.error) broadcastToast(entry, r.error, 'err');
        break;
      }
      case 'pass': {
        const r = s.passRfq(msg.rfqId);
        if (r.error) broadcastToast(entry, r.error, 'err');
        break;
      }
      case 'trade': {
        const r = s.tradeExchange(msg.ticker, msg.side, msg.qty);
        if (r.error) broadcastToast(entry, r.error, 'err');
        break;
      }
      case 'hedge': {
        const r = s.hedge(msg.ticker);
        if (r.error) broadcastToast(entry, r.error, 'err');
        break;
      }
      case 'flatten': {
        for (const t of Object.keys(s.positions)) {
          if (s.positions[t].qty !== 0) {
            s.hedgeCooldown = 0;
            const qty = Math.abs(s.positions[t].qty);
            s.tradeExchange(t, s.positions[t].qty > 0 ? 'SELL' : 'BUY', qty);
          }
        }
        break;
      }
      case 'chat': {
        const r = s.chat(msg.room || 'deal', msg.text);
        if (r?.error) broadcastToast(entry, r.error, 'err');
        break;
      }
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
