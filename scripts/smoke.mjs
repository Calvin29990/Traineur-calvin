// End-to-end WebSocket protocol smoke test across both CFA × AmplifyME roles (IB 1 & AM 1)
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
let quotesSent = 0;
let amRfqs = 0;
const seenReqs = new Set();

ws.on('message', (raw) => {
  const msg = JSON.parse(raw.toString());
  if (msg.type === 'state') state = msg.data;
  if (msg.type === 'error') errors.push(msg.message);
  if (msg.type === 'joined') console.log('joined', msg.sessionId);
});

ws.send(JSON.stringify({ type: 'join', nickname: 'SmokeBot' }));
await wait(300);
ws.send(JSON.stringify({ type: 'start', mode: 'challenge', rounds: 2, roundSeconds: 90, nickname: 'SmokeBot' }));
ws.send(JSON.stringify({ type: 'speed', value: 4 }));

const t0 = Date.now();
let lastRound = 0;

while (Date.now() - t0 < 80000) {
  await wait(120);
  if (!state) continue;
  if (state.round !== lastRound) {
    lastRound = state.round;
    console.log(`round ${state.round} — role ${state.role} (${state.phase})`);
  }

  if (state.debrief?.open && state.phase === 'break' && !state.final) {
    console.log(`debrief R${state.debrief.round} (${state.debrief.role}) score=${state.debrief.scoreObj?.total}`);
    ws.send(JSON.stringify({ type: 'nextRound' }));
    await wait(250);
  }

  if (state.phase === 'round' && state.role === 'IB') {
    for (const req of state.clientRequests || []) {
      if (seenReqs.has(req.id)) continue;
      seenReqs.add(req.id);
      const eq = state.equities.find((e) => e.ticker === req.ticker);
      const bid = Number((eq.last * 0.986).toFixed(2));
      const offer = Number((eq.last * 1.014).toFixed(2));
      ws.send(JSON.stringify({
        type: 'sendQuote',
        clientRoom: req.clientRoom,
        ticker: req.ticker,
        bid,
        offer,
        bidVol: req.qty,
        offerVol: req.qty,
        validFor: 45,
        rfqId: req.id,
      }));
      quotesSent++;
    }
  } else if (state.phase === 'round' && state.role === 'AM') {
    if (amRfqs === 0) {
      ws.send(JSON.stringify({ type: 'requestQuote', dealerRoom: 'ALL', ticker: 'BP', qty: 25000 }));
      ws.send(JSON.stringify({ type: 'trade', ticker: 'MSFT', side: 'BUY', qty: 3000 }));
      amRfqs++;
    }
    if (state.liveQuotes?.length > 0 && amRfqs === 1) {
      ws.send(JSON.stringify({ type: 'acceptQuote', quoteId: state.liveQuotes[0].id, side: 'BUY', qty: 25000 }));
      amRfqs++;
    }
  }

  if (state.phase === 'done') break;
}

await wait(300);
console.log(`IB quotes=${quotesSent} | AM actions=${amRfqs} | final score=${state?.final?.score} | rank=${state?.final?.rank}/${state?.final?.total} | errors=${errors.length}`);
ws.close();
if (!state?.final || errors.length > 0) process.exit(1);
