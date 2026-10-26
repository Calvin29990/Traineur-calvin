// Test de bout en bout du protocole websocket : simule un joueur complet.
import WebSocket from 'ws';

const URL = process.env.WS || 'ws://127.0.0.1:8788/ws';
const errors = [];

function connect() {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(URL);
    ws.on('open', () => resolve(ws));
    ws.on('error', reject);
  });
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const ws = await connect();
let state = null;
let rfqSeen = 0;
let quotesSent = 0;
let fills = 0;
let lastRfqId = null;

ws.on('message', (raw) => {
  const msg = JSON.parse(raw.toString());
  if (msg.type === 'state') state = msg.data;
  if (msg.type === 'error') { errors.push(msg.message); }
  if (msg.type === 'joined') console.log('joined', msg.sessionId);
});

ws.send(JSON.stringify({ type: 'join', nickname: 'TestBot' }));
await wait(400);
ws.send(JSON.stringify({ type: 'start', rounds: 3, nickname: 'TestBot' }));
ws.send(JSON.stringify({ type: 'speed', value: 4 }));

const t0 = Date.now();
let lastRound = 0;
let hedges = 0;
let trades = 0;

while (Date.now() - t0 < 170000) {
  await wait(120);
  if (!state) continue;
  if (state.round !== lastRound) { lastRound = state.round; console.log(`round ${state.round} (${state.phase})`); }

  if (state.debrief && state.debrief.open && state.phase !== 'round' && !state.final) {
    console.log('debrief round', state.debrief.round, 'pnl', state.debrief.stats.pnl);
    ws.send(JSON.stringify({ type: 'nextRound' }));
    await wait(300);
    if (state.phase === 'done') break;
  }

  const rfq = state.rfq;
  if (rfq && rfq.id !== lastRfqId) {
    lastRfqId = rfq.id;
    rfqSeen++;
    const eq = state.equities.find((e) => e.ticker === rfq.ticker);
    const mid = eq.last;
    const spread = [8, 12, 20][rfqSeen % 3] / 10000;
    const skew = (rfqSeen % 4 === 0 ? 1 : 0) * 0.001;
    const bid = Math.round(mid * (1 - spread + skew) * 100) / 100;
    const offer = Math.round(mid * (1 + spread + skew) * 100) / 100;
    ws.send(JSON.stringify({ type: 'quote', rfqId: rfq.id, bid, offer, bidVol: rfq.qty, offerVol: rfq.qty, ttl: 45 }));
    quotesSent++;
  }

  if (state.blotter.length > 0 && state.blotter[0].source === 'RFQ' && state.blotter[0].id !== fills) {
    fills = state.blotter[0].id;
  }

  // couvre les positions > 4 M$
  if (rfqSeen % 3 === 0) {
    for (const p of state.positions) {
      if (Math.abs(p.qty * p.mark) > 4000000 && Math.random() < 0.35) {
        ws.send(JSON.stringify({ type: 'hedge', ticker: p.ticker }));
        hedges++;
      }
    }
  }
  if (rfqSeen === 6) {
    ws.send(JSON.stringify({ type: 'chat', room: 'deal', text: 'Any colour on BP?' }));
    ws.send(JSON.stringify({ type: 'trade', ticker: 'MSFT', side: 'BUY', qty: 2000 }));
    trades++;
  }
  if (state.phase === 'done') break;
}

await wait(500);
console.log(`\nRFQ vues: ${rfqSeen} | prix envoyés: ${quotesSent} | couvertures: ${hedges} | trades: ${trades}`);
console.log('phase', state?.phase, '| round', state?.round, '| pnl', state?.pnl, '| classement', state?.leaderboard?.rank, '/', state?.leaderboard?.total, '| top', state?.leaderboard?.topPct?.toFixed(1));
console.log('coach', state?.coach);
console.log('final', state?.final);
console.log('erreurs', errors);
if (!state?.final) console.log('!! session non terminée');
ws.close();
