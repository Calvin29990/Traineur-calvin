// End-to-end WebSocket protocol smoke test across both roles:
// Round 1 IB-55 (quote ticket -> client fills -> hedge) then Round 2 AM-55
// (dealer RFQ -> accept -> exchange trade), through to the final score.
// Usage: node scripts/smoke.mjs   (requires the app server on :8788)
import WebSocket from 'ws';

const URL = process.env.WS || 'ws://127.0.0.1:8788/ws';
const errors = [];
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const ws = new WebSocket(URL);
let state = null;
let quotesSent = 0;
let amActions = 0;
const seen = new Set();
const rfqs = new Set();

ws.on('message', (raw) => {
  const msg = JSON.parse(raw.toString());
  if (msg.type === 'state') state = msg.data;
  if (msg.type === 'error') errors.push(msg.message);
  if (msg.type === 'joined') console.log('joined', msg.sessionId);
});
await new Promise((res, rej) => { ws.on('open', res); ws.on('error', rej); });

ws.send(JSON.stringify({ type: 'join', nickname: 'Calvin MINANG' }));
await wait(300);
ws.send(JSON.stringify({ type: 'start', mode: 'replay', rounds: 2, roundSeconds: 120, nickname: 'Calvin MINANG', startRole: 'IB' }));
ws.send(JSON.stringify({ type: 'speed', value: 4 }));

const t0 = Date.now();
let lastRound = 0;
let debriefSeen = null;

while (Date.now() - t0 < 170000) {
  await wait(120);
  if (!state) continue;
  if (state.round !== lastRound) {
    lastRound = state.round;
    console.log(`round ${state.round} — role ${state.role} (${state.phase})`);
  }
  if (state.debrief?.open && state.phase === 'break' && !state.final) {
    if (debriefSeen !== state.debrief.round) {
      debriefSeen = state.debrief.round;
      console.log(`debrief R${state.debrief.round} (${state.debrief.role}) score=${state.debrief.scoreObj?.total} `
        + `gauges=${state.debrief.scoreObj?.gauges?.map((g) => `${g.code}:${g.score}`).join(',')}`);
      ws.send(JSON.stringify({ type: 'closeDebrief' }));
      await wait(150);
      ws.send(JSON.stringify({ type: 'nextRound' }));
      await wait(300);
    }
    continue;
  }

  if (state.phase === 'round' && state.role === 'IB') {
    for (const req of state.clientRequests || []) {
      if (seen.has(req.id)) continue;
      seen.add(req.id);
      const eq = state.equities.find((e) => e.ticker === req.ticker);
      const bid = Number((eq.last * 0.993).toFixed(eq.dp));
      const offer = Number((eq.last * 1.007).toFixed(eq.dp));
      ws.send(JSON.stringify({
        type: 'sendQuote', clientRoom: req.clientId, ticker: req.ticker,
        bid, offer, bidVol: req.qty, offerVol: req.qty, validFor: 45,
      }));
      quotesSent += 1;
    }
    for (const q of state.liveQuotes || []) {
      if (Math.abs((q.refAtQuote ?? 0) / 1 - 1) > 1) { /* noop */ }
    }
  } else if (state.phase === 'round' && state.role === 'AM') {
    if (amActions < 2) {
      ws.send(JSON.stringify({ type: 'requestQuote', dealerRoom: 'ALL', ticker: 'BP', qty: 25000 }));
      ws.send(JSON.stringify({ type: 'trade', ticker: 'MSFT', side: 'BUY', qty: 3000 }));
      amActions += 1;
    }
    for (const q of state.liveQuotes || []) {
      if (rfqs.has(q.id)) continue;
      rfqs.add(q.id);
      ws.send(JSON.stringify({ type: 'acceptQuote', quoteId: q.id, side: 'BUY', qty: Math.min(25000, q.offerVol) }));
      amActions += 1;
      break;
    }
  }

  if (state.phase === 'done') break;
}

await wait(400);
console.log(`IB quotes=${quotesSent} | AM actions=${amActions} | final score=${state?.final?.score} | rank=${state?.final?.rank}/${state?.final?.total} | errors=${errors.length}`);
if (errors.length) console.log(errors.slice(0, 6).join('\n'));
ws.close();

const ok = Boolean(state?.final) && errors.length === 0;
if (!ok) {
  console.error('✗ smoke failed');
  process.exit(1);
}
console.log('✓ smoke passed');
