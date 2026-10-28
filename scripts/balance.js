// Calibration benchmark — CFA Institute × AmplifyME dual-role engine (IB-55 + AM-55 $20M).
// Runs three archetypal candidates over 2 rounds and prints score / rank / P&L.
import { Session, BALANCE } from '../server/engine.js';

const ROUND_SECONDS = Number(process.env.ROUND_SECONDS || 900);
const SEEDS = [7, 21, 42, 99];

const TICKERS = ['BABA', 'BP', 'HSBC', 'MSFT', 'VW'];

function clipFor(session, ticker, notional) {
  const mid = session.inst[ticker].mid;
  return Math.max(1000, Math.round(notional / mid / 1000) * 1000);
}

function play(strategy, seed) {
  const s = new Session({
    id: `bal-${seed}-${strategy.name}`,
    seed,
    nickname: 'CANDIDATE',
    mode: 'replay',
    rounds: 2,
    roundSeconds: ROUND_SECONDS,
  });
  s.beginRound();

  const quoted = new Set();
  const rfqAt = new Map();
  let lastNews = null;
  let sinceHedge = 0;
  let initialDeployed = false;
  let sinceClip = 0;
  let trades = 0;

  for (let step = 0; step < 20000 && s.phase !== 'done'; step++) {
    s.step(0.25);
    if (s.phase === 'break') {
      if (s.debrief?.open) s.debrief.open = false;
      quoted.clear();
      rfqAt.clear();
      lastNews = null;
      initialDeployed = false;
      s.beginRound();
      continue;
    }
    if (s.phase !== 'round') continue;
    sinceHedge += 0.25;
    sinceClip += 0.25;

    const topNews = s.news.find((n) => n.kind !== 'NOTE');
    if (topNews && topNews.id !== lastNews) {
      lastNews = topNews.id;
      if (s.role === 'IB' && strategy.pullOnNews) {
        for (const q of [...s.liveQuotes]) s.cancelQuote(q.id);
      }
      if (s.role === 'AM' && strategy.newsAlpha && topNews.kind !== 'NOTE') {
        const dir = topNews.impact >= 0 ? 'BUY' : 'SELL';
        const targets = topNews.kind === 'STOCK' ? [topNews.ticker] : strategy.amNewsTargets;
        for (const tk of targets) {
          const qty = clipFor(s, tk, strategy.amTicket);
          const r = s.requestQuote({ dealerRoom: 'ALL', ticker: tk, qty, silent: true });
          if (!r?.error) rfqAt.set(`${tk}:${qty}`, { dir, tk, qty, at: s.totalSim });
        }
      }
    }

    if (s.role === 'AM' && strategy.amInitial && !initialDeployed) {
      initialDeployed = true;
      for (const tk of TICKERS) {
        const qty = clipFor(s, tk, strategy.amInitial);
        const r = s.requestQuote({ dealerRoom: 'ALL', ticker: tk, qty, silent: true });
        if (!r?.error) rfqAt.set(`${tk}:${qty}`, { dir: 'BUY', tk, qty, at: s.totalSim });
      }
    }

    if (s.role === 'IB' && strategy.quoteClients) {
      for (const req of s.clientRequests) {
        if (req.status !== 'open' || quoted.has(req.id)) continue;
        quoted.add(req.id);
        const eq = s.inst[req.ticker];
        let skew = 0;
        if (strategy.skewNews && topNews && s.totalSim - topNews.simAt < 40) {
          if (topNews.kind === 'STOCK' && topNews.ticker === req.ticker) skew = Math.sign(topNews.impact) * 0.007;
          else if (topNews.kind === 'MACRO') skew = Math.sign(topNews.impact) * 0.004;
        }
        const half = strategy.ibHalfSpread / 1e4;
        const bid = Number((eq.mid * (1 - half + skew)).toFixed(eq.dp));
        const offer = Number((eq.mid * (1 + half + skew)).toFixed(eq.dp));
        if (!(bid < offer)) continue;
        const r = s.sendQuote({
          clientRoom: req.clientId,
          ticker: req.ticker,
          bid,
          offer,
          bidVol: req.qty,
          offerVol: req.qty,
          validFor: 45,
        });
        if (r?.error) quoted.delete(req.id);
      }
      if (strategy.hedge && sinceHedge > strategy.hedgeEvery) {
        sinceHedge = 0;
        let biggest = null;
        for (const tk of TICKERS) {
          const p = s.positions[tk];
          if (!p || !p.qty) continue;
          const notional = Math.abs(p.qty * s.inst[tk].mid);
          if (notional > (strategy.hedgeAbove || 0) && (!biggest || notional > biggest.notional)) {
            biggest = { tk, notional };
          }
        }
        if (biggest) {
          const qty = clipFor(s, biggest.tk, strategy.clip);
          s.hedge(biggest.tk);
          trades += 1;
          void qty;
        }
      }
    }

    if (s.role === 'AM' && strategy.useDealerQuotes) {
      // take the best live quote for each pending RFQ direction
      if (rfqAt.size) {
        for (const [key, want] of [...rfqAt]) {
          const candidates = s.liveQuotes.filter((q) => q.ticker === want.tk && q.status === 'live');
          if (!candidates.length) {
            if (s.totalSim - want.at > 20) rfqAt.delete(key);
            continue;
          }
          const best = candidates.sort((a, b) => (want.dir === 'BUY'
            ? Number(a.offer) - Number(b.offer)
            : Number(b.bid) - Number(a.bid)))[0];
          const qty = Math.min(want.qty, best.bidVol);
          const r = s.acceptDealerQuote({ quoteId: best.id, side: want.dir, qty });
          if (!r?.error) {
            rfqAt.delete(key);
            trades += 1;
          } else if (s.totalSim - want.at > 12) rfqAt.delete(key);
        }
      }
    } else if (s.role === 'AM' && strategy.dumpExchange && sinceClip > strategy.clipEvery) {
      sinceClip = 0;
      const tk = TICKERS[Math.floor(s.totalSim / 7) % TICKERS.length];
      s.tradeExchange(tk, Math.random() > 0.5 ? 'BUY' : 'SELL', clipFor(s, tk, strategy.clipNotional || 900000));
      trades += 1;
    }
  }

  const final = s.final || {};
  return {
    score: final.score ?? s.leaderboard().myScore,
    rank: final.rank ?? s.leaderboard().rank,
    total: final.total ?? s.leaderboard().total,
    topPct: final.topPct ?? s.leaderboard().topPct,
    pnl: final.pnl ?? 0,
    fatFingers: final.fatFingers ?? 0,
    trades,
    history: s.roundHistory.map((r) => ({ role: r.role, pnl: r.pnl, score: r.scoreObj?.total, gauges: r.scoreObj?.gauges?.map((g) => `${g.code}:${Math.round(g.score)}`) })),
  };
}

const strategies = [
  { name: 'Débutant passif', quoteClients: false, pullOnNews: false, hedge: false, useDealerQuotes: false },
  {
    name: 'Dump Exchange (impulsif)',
    quoteClients: false,
    pullOnNews: false,
    hedge: false,
    dumpExchange: true,
    clipEvery: 3,
    clipNotional: 3200000,
  },
  {
    name: 'Playbook CFA (Top 1%)',
    quoteClients: true,
    pullOnNews: true,
    skewNews: true,
    ibHalfSpread: BALANCE.ibQuoteTargetHalfBps,
    hedge: true,
    hedgeAbove: 1200000,
    hedgeEvery: 12,
    clip: 900000,
    useDealerQuotes: true,
    newsAlpha: true,
    amTicket: 2200000,
    amInitial: 2000000,
    amNewsTargets: ['MSFT', 'BP', 'VW'],
  },
];

const rows = [];
for (const strat of strategies) {
  const runs = SEEDS.map((seed) => play(strat, seed));
  const avg = (k) => runs.reduce((a, r) => a + (r[k] || 0), 0) / runs.length;
  rows.push({ name: strat.name, score: avg('score'), rank: avg('rank'), topPct: avg('topPct'), pnl: avg('pnl'), ff: avg('fatFingers'), trades: avg('trades'), runs });
}

console.log(`\nCFA × AmplifyME calibration — ${SEEDS.length} seeds × 2 rounds × ${ROUND_SECONDS}s (IB-55 + AM-55 $20M)\n`);
for (const r of rows) {
  console.log(
    `${r.name.padEnd(28)} | score ${r.score.toFixed(1).padStart(5)}/100 | rang #${Math.round(r.rank)}/${r.runs[0].total} `
    + `(Top ${Math.max(1, Math.round(100 - r.topPct))}%) | P&L $${Math.round(r.pnl).toLocaleString('en-US')} `
    + `| FFC ${r.ff} | fills ${Math.round(r.trades)}`,
  );
}
for (const r of rows) {
  console.log(`\n${r.name}`);
  r.runs.forEach((run, i) => {
    console.log(`  seed ${SEEDS[i]} → ${run.score}/100 #${run.rank} · ${run.history.map((h) => `${h.role} R:${h.score} $${Math.round(h.pnl).toLocaleString('en-US')}`).join(' | ')}`);
    if (i === 0 && run.history[0]?.gauges) console.log(`    jauges R1 → ${run.history[0].gauges.join(' ')}`);
    if (i === 0 && run.history[1]?.gauges) console.log(`    jauges R2 → ${run.history[1].gauges.join(' ')}`);
  });
}

const top = rows[2].score;
const mid = rows[1].score;
if (top < 88) console.log(`\n⚠ playbook ${top.toFixed(1)} < 88 — calibration à revoir`);
if (mid > top - 8) console.log('\n⚠ écart playbook/impulsif trop faible');
