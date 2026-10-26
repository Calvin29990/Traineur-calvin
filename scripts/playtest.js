// Complete 2-Round CFA × AmplifyME Playthrough (Round 1: IB 1 -> Round 2: AM 1 $20M)
import { Session } from '../server/engine.js';

const seed = Number(process.argv[2] || 42);
const s = new Session({ id: 'play', seed, nickname: 'calvin', mode: 'challenge', rounds: 2, roundSeconds: 240 });

const quoted = new Set();
let lastNewsId = null;

s.beginRound();
for (let i = 0; i < 4000 && s.phase !== 'done'; i++) {
  s.step(0.25);

  if (s.debrief?.open && s.phase === 'break') {
    console.log(
      `\n── ROUND ${s.debrief.round} (${s.debrief.role}) : P+L $${Math.round(s.debrief.stats.pnl).toLocaleString('en-US')} `
      + `| Comm $${Math.round(s.debrief.stats.commission).toLocaleString('en-US')} `
      + `| Score ${s.debrief.scoreObj.total}/100 | Rang #${s.leaderboard().rank}/${s.leaderboard().total}`
    );
    for (const t of s.debrief.tips) console.log('   •', t.text);
    s.debrief.open = false;
    quoted.clear();
    lastNewsId = null;
    s.beginRound();
    continue;
  }

  const topNews = s.news.find((n) => n.kind !== 'NOTE');
  if (topNews && topNews.id !== lastNewsId) {
    lastNewsId = topNews.id;
    if (s.role === 'IB') {
      for (const lq of [...s.liveQuotes]) s.cancelQuote(lq.id);
    } else if (s.role === 'AM') {
      const tks = topNews.kind === 'STOCK' ? [topNews.ticker] : ['MSFT', 'BP', 'VW'];
      for (const tk of tks) {
        const qty = Math.max(2000, Math.round((2800000 / s.inst[tk].mid) / 1000) * 1000);
        s.requestQuote({ dealerRoom: 'ALL', ticker: tk, qty });
        s._dir = topNews.impact >= 0 ? 'BUY' : 'SELL';
      }
    }
  }

  if (s.role === 'IB') {
    for (const req of s.clientRequests) {
      if (req.status !== 'open' || quoted.has(req.id)) continue;
      quoted.add(req.id);
      const mid = s.inst[req.ticker].mid;
      const skew = topNews && topNews.ticker === req.ticker ? Math.sign(topNews.impact) * 0.008 : 0;
      const bid = Number((mid * (1 - 0.014 + skew)).toFixed(2));
      const offer = Number((mid * (1 + 0.014 + skew)).toFixed(2));
      s.sendQuote({ clientRoom: req.clientRoom, ticker: req.ticker, bid, offer, bidVol: req.qty, offerVol: req.qty, validFor: 45, rfqId: req.id });
    }
    if (i % 6 === 0) {
      for (const t of Object.keys(s.positions)) {
        const p = s.positions[t];
        if (Math.abs(p.qty * s.inst[t].mid) > 600000) {
          const clip = Math.min(Math.abs(p.qty), Math.round(s.inst[t].baseDepth * 0.35));
          s.tradeExchange(t, p.qty > 0 ? 'SELL' : 'BUY', clip);
        }
      }
    }
  } else if (s.role === 'AM' && s.liveQuotes.length > 0 && s._dir) {
    const best = [...s.liveQuotes].sort((a, b) => (s._dir === 'BUY' ? a.offer - b.offer : b.bid - a.bid))[0];
    s.acceptDealerQuote({ quoteId: best.id, side: s._dir, qty: best.bidVol });
    s._dir = null;
  }
}

const f = s.final;
console.log('\n══ BILAN CHALLENGE CFA × AMPLIFYME ══');
console.log(`Score Global : ${f.score}/100  |  Rang : #${f.rank}/${f.total} (Top ${Math.max(1, Math.round(100 - f.topPct))}%)`);
console.log(`P+L Cumulé   : $${f.pnl.toLocaleString('en-US')}  |  Fat Finger Count : ${f.fatFingers}`);
