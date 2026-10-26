// Script de calibrage : fait jouer plusieurs stratégies au moteur et compare
// les P&L. Permet de vérifier que le jeu est "gagnable" et où se situe le top 10 %.
import { Session, BALANCE } from '../server/engine.js';

const ROUNDS = 3;

function playSession(strategy, seed) {
  const s = new Session({ id: 'x', seed, nickname: 'BOT' });
  s.beginRound();

  let lastQuoteFor = null;
  let history = {};
  const fillDiscount = 0.72; // un humain ne quote pas 100 % des demandes

  for (let step = 0; step < Math.ceil((ROUNDS * BALANCE.roundSeconds) / 0.25) + 2000; step++) {
    s.step(0.25);
    if (s.phase === 'break') { s.beginRound(); lastQuoteFor = null; continue; }
    if (s.phase === 'done') break;

    const rfq = s.activeRfq();
    if (rfq && rfq.id !== lastQuoteFor) {
      lastQuoteFor = rfq.id;
      const i = s.inst[rfq.ticker];
      const mid = i.mid;
      const tr = history[rfq.ticker] || (history[rfq.ticker] = []);
      tr.push(mid);
      if (tr.length > 40) tr.shift();
      const mom = tr.length > 12 ? (mid / tr[tr.length - 12] - 1) : 0;

      let half = strategy.half;
      let skew = 0;
      if (strategy.skewNews) skew = Math.max(-0.006, Math.min(0.006, mom * strategy.skewFactor));
      if (strategy.wideAfterNews) {
        const recent = s.news.find((n) => n.time && Math.abs(s.totalSim - (n.at ?? 0)) < 0);
        if (recent) half *= 1.6;
      }
      if (strategy.noQuoteInformed && Math.abs(mom) > 0.004) {
        s.passRfq(rfq.id);
        continue;
      }
      if (Math.random() > fillDiscount) { s.passRfq(rfq.id); continue; }

      const bid = mid * (1 - half + skew);
      const offer = mid * (1 + half + skew);
      s.quoteRfq(rfq.id, Math.round(bid * 100) / 100, Math.round(offer * 100) / 100, rfq.qty, rfq.qty, 45);
    }

    if (strategy.hedgeAt && step % 4 === 0) {
      for (const t of Object.keys(s.positions)) {
        const p = s.positions[t];
        if (Math.abs(p.qty * s.inst[t].mid) > strategy.hedgeAt) s.hedge(t);
      }
    }
  }
  return s;
}

const strategies = {
  'naïf 8bps': { half: 0.0008 },
  'symétrique 12bps': { half: 0.0012 },
  'symétrique 20bps': { half: 0.0020 },
  'large 35bps': { half: 0.0035 },
  'skew momentum x2': { half: 0.0011, skewNews: true, skewFactor: 2 },
  'skew momentum x3 + hedge 8M': { half: 0.0011, skewNews: true, skewFactor: 3, hedgeAt: 8000000 },
  'skew + hedge + pass toxique': { half: 0.0010, skewNews: true, skewFactor: 2.5, hedgeAt: 10000000, noQuoteInformed: true },
  'couvre tout 12bps': { half: 0.0012, hedgeAt: 1 },
  'couvre tout 25bps': { half: 0.0025, hedgeAt: 1 },
};

const N = 24;
console.log(`Rounds: ${ROUNDS}x${BALANCE.roundSeconds}s — ${N} sessions par stratégie\n`);
console.log('Stratégie'.padEnd(30), 'moy.'.padStart(11), 'méd.'.padStart(11), 'p90'.padStart(11), 'p10'.padStart(11), 'spread'.padStart(10), 'adv.'.padStart(9), 'fills'.padStart(7), 'rfqs'.padStart(6));
for (const [name, st] of Object.entries(strategies)) {
  const res = [];
  for (let k = 0; k < N; k++) {
    const s = playSession(st, 1000 + k * 37);
    res.push({ pnl: s.totalPnl(), cap: s.metrics.spreadCapture, adv: s.metrics.adverse, fees: s.fees, fills: s.metrics.rfqFills, rfqs: s.rfqs.length });
  }
  const pnls = res.map((r) => r.pnl).sort((a, b) => a - b);
  const mean = pnls.reduce((a, b) => a + b, 0) / N;
  const med = pnls[Math.floor(N / 2)];
  const p90 = pnls[Math.floor(N * 0.9)];
  const p10 = pnls[Math.floor(N * 0.1)];
  const fills = res.reduce((a, b) => a + b.fills, 0) / N;
  const rfqs = res.reduce((a, b) => a + b.rfqs, 0) / N;
  const cap = res.reduce((a, b) => a + b.cap, 0) / N;
  const adv = res.reduce((a, b) => a + b.adv, 0) / N;
  const fees = res.reduce((a, b) => a + b.fees, 0) / N;
  const f = (v) => Math.round(v).toLocaleString('fr-FR');
  console.log(name.padEnd(30), f(mean).padStart(11), f(med).padStart(11), f(p90).padStart(11), f(p10).padStart(11), f(cap).padStart(10), f(adv).padStart(9), fills.toFixed(1).padStart(7), rfqs.toFixed(0).padStart(6));
}

// seuil top 10 % du classement
const s = new Session({ id: 'lb', seed: 42, nickname: 'BOT' });
s.round = ROUNDS;
s.phase = 'done';
const lb = s.leaderboard();
console.log(`\nClassement : ${lb.total} participants — seuil top 10 % = ${Math.round(lb.firstThreshold).toLocaleString('fr-FR')} $`);
const totals = s.botPool.map((b) => b.rounds.reduce((a, c) => a + c, 0)).sort((a, b) => b - a);
console.log('Bots — p50:', Math.round(totals[Math.floor(totals.length / 2)]), '| p75:', Math.round(totals[Math.floor(totals.length * 0.25)]), '| p90:', Math.round(totals[Math.floor(totals.length * 0.10)]), '| p99:', Math.round(totals[Math.floor(totals.length * 0.01)]));
