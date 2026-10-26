// Calibration benchmark for CFA Institute × AmplifyME Dual-Role Engine
// Verifies Round 1 (IB 1) + Round 2 (AM 1 $20M) strategies against the 260-student cohort.
import { Session, BALANCE } from '../server/engine.js';

function playChallenge(strategy, seed) {
  const s = new Session({ id: 'cal', seed, nickname: 'CANDIDATE', mode: 'challenge', rounds: 2, roundSeconds: 300 });
  s.beginRound();

  let quotedIds = new Set();
  let lastNewsSeen = null;
  let lastOutreach = 0;

  for (let step = 0; step < 3000; step++) {
    s.step(0.25);
    if (s.phase === 'break') {
      s.beginRound();
      quotedIds = new Set();
      lastNewsSeen = null;
      lastOutreach = 0;
      continue;
    }
    if (s.phase === 'done') break;

    const topNews = s.news.find((n) => n.kind !== 'NOTE');
    const isFreshNews = topNews && topNews.id !== lastNewsSeen;
    if (isFreshNews) {
      lastNewsSeen = topNews.id;
      if (s.role === 'IB' && strategy.pullOnNews) {
        // Pull stale live quotes immediately when breaking news hits!
        for (const lq of [...s.liveQuotes]) s.cancelQuote(lq.id);
      }
      if (s.role === 'AM' && strategy.amNewsAlpha) {
        // React to news as $20M Asset Manager
        if (topNews.kind === 'STOCK') {
          const tk = topNews.ticker;
          const dir = topNews.impact > 0 ? 'BUY' : 'SELL';
          const eq = s.inst[tk];
          const qty = Math.max(2000, Math.round((3500000 / eq.mid) / 1000) * 1000);
          if (strategy.amUseIbQuotes) {
            s.requestQuote({ dealerRoom: 'ib1test1', ticker: tk, qty });
            s._wantSide = { tk, dir };
          } else {
            s.tradeExchange(tk, dir, qty);
          }
        } else if (topNews.kind === 'MACRO') {
          const dir = topNews.impact > 0 ? 'BUY' : 'SELL';
          for (const tk of ['MSFT', 'BP', 'VW']) {
            const eq = s.inst[tk];
            const qty = Math.max(1000, Math.round((2400000 / eq.mid) / 1000) * 1000);
            if (strategy.amUseIbQuotes) {
              s.requestQuote({ dealerRoom: 'ib2test1', ticker: tk, qty });
              s._wantSide = { tk, dir };
            } else {
              s.tradeExchange(tk, dir, qty);
            }
          }
        }
      }
    }

    if (s.role === 'IB') {
      // Proactive client outreach in chat
      if (strategy.proactiveChat && s.totalSim - lastOutreach > 24) {
        lastOutreach = s.totalSim;
        const cl = s.clients[Math.floor(step) % s.clients.length];
        s.chat(cl.roomId, 'hi there - seen the news? can I help you trade BP?');
      }

      // Answer open client RFQs
      for (const req of s.clientRequests) {
        if (req.status !== 'open' || quotedIds.has(req.id)) continue;
        quotedIds.add(req.id);
        const eq = s.inst[req.ticker];
        let skew = 0;
        if (strategy.skewNews && topNews && (s.totalSim - topNews.simAt) < 35) {
          if (topNews.kind === 'STOCK' && topNews.ticker === req.ticker) skew = Math.sign(topNews.impact) * 0.008;
          else if (topNews.kind === 'MACRO') skew = Math.sign(topNews.impact) * 0.005;
        }
        const half = strategy.ibHalfSpread;
        const bid = Number((eq.mid * (1 - half + skew)).toFixed(2));
        const offer = Number((eq.mid * (1 + half + skew)).toFixed(2));
        s.sendQuote({
          clientRoom: req.clientRoom,
          ticker: req.ticker,
          bid,
          offer,
          bidVol: req.qty,
          offerVol: req.qty,
          validFor: 45,
          rfqId: req.id,
        });
      }

      // Unwind IB inventory
      if (strategy.unwind && step % 6 === 0) {
        for (const t of Object.keys(s.positions)) {
          const p = s.positions[t];
          const eq = s.inst[t];
          if (Math.abs(p.qty * eq.mid) > strategy.unwindThreshold) {
            const clip = strategy.smartClips
              ? Math.min(Math.abs(p.qty), Math.round(eq.baseDepth * 0.35))
              : Math.abs(p.qty);
            s.tradeExchange(t, p.qty > 0 ? 'SELL' : 'BUY', clip);
          }
        }
      }
    } else if (s.role === 'AM') {
      // Accept incoming IB dealer quotes if we requested them
      if (strategy.amUseIbQuotes && s.liveQuotes.length > 0 && s._wantSide) {
        const q = s.liveQuotes[0];
        const dir = topNews && topNews.impact < 0 ? 'SELL' : 'BUY';
        s.acceptDealerQuote({ quoteId: q.id, side: dir, qty: q.bidVol });
      }
    }
  }
  return s;
}

const strategies = {
  'Débutant passif (sans pull/skew)': {
    ibHalfSpread: 0.009, pullOnNews: false, skewNews: false, unwind: false, amNewsAlpha: false,
  },
  'Intermédiaire (dump Exchange)': {
    ibHalfSpread: 0.015, pullOnNews: true, skewNews: false, unwind: true, unwindThreshold: 1200000, smartClips: false,
    amNewsAlpha: true, amUseIbQuotes: false,
  },
  'Candidat Top 10% (Playbook CFA)': {
    ibHalfSpread: 0.014, pullOnNews: true, skewNews: true, proactiveChat: true,
    unwind: true, unwindThreshold: 500000, smartClips: true,
    amNewsAlpha: true, amUseIbQuotes: true,
  },
};

const N = 16;
console.log(`CFA × AmplifyME Calibration (2 Rounds: IB 1 + AM 1 $20M, ${BALANCE.roundSeconds}s/round, N=${N})\n`);
for (const [name, st] of Object.entries(strategies)) {
  const runs = [];
  for (let k = 0; k < N; k++) {
    const s = playChallenge(st, 2000 + k * 41);
    const lb = s.leaderboard();
    runs.push({
      score: lb.myScore,
      rank: lb.rank,
      topBand: Math.max(1, Math.round(100 - lb.topPct)),
      ibPnl: s.roundHistory[0]?.pnl ?? 0,
      ibComm: s.roundHistory[0]?.commission ?? 0,
      amPnl: s.roundHistory[1]?.pnl ?? 0,
    });
  }
  const avg = (fn) => runs.reduce((a, r) => a + fn(r), 0) / N;
  console.log(
    name.padEnd(34),
    `| Score: ${avg((r) => r.score).toFixed(1)}/100`,
    `| Rang moy: #${Math.round(avg((r) => r.rank))}/260 (Top ${Math.round(avg((r) => r.topBand))}%)`,
    `| IB P+L: $${Math.round(avg((r) => r.ibPnl)).toLocaleString('en-US')} (Comm +$${Math.round(avg((r) => r.ibComm)).toLocaleString('en-US')})`,
    `| AM P+L: $${Math.round(avg((r) => r.amPnl)).toLocaleString('en-US')}`
  );
}
