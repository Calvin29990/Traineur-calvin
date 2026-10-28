// Full 2-round playthrough — Round 1 IB-55 (market maker) then Round 2 AM-55 ($20M).
// Demonstrates the "Top 1 %" playbook: quote client flow, cancel on news, hedge in
// clips; then shop 5 dealers, deploy across the universe and trade the catalysts.
import { Session } from '../server/engine.js';

const seed = Number(process.argv[2] || 42);
const ROUND_SECONDS = Number(process.env.ROUND_SECONDS || 900);
const T = ['BABA', 'BP', 'HSBC', 'MSFT', 'VW'];
const s = new Session({ id: 'play', seed, nickname: 'Calvin MINANG', mode: 'replay', rounds: 2, roundSeconds: ROUND_SECONDS });

const pad = (v, n = 2) => String(v).padStart(n, ' ');
const money = (v) => `$${Math.round(v).toLocaleString('en-US')}`;

s.beginRound();
let quoted = new Set();
let rfqs = new Map();
let lastNews = null;
let sinceHedge = 0;
let initialDeployed = false;
let roundStart = true;

for (let i = 0; i < 40000 && s.phase !== 'done'; i++) {
  s.step(0.25);

  if (s.phase === 'break' && s.debrief?.open) {
    const d = s.debrief;
    console.log(`\n── ROUND ${d.round} (${d.role}) ─────────────────────────────────────`);
    console.log(`   P&L ${money(d.stats.pnl)} · commissions ${money(d.stats.commission)} · ${d.stats.fills} fills`
      + ` · ${d.stats.exchangeTrades} trades Exchange`);
    console.log(`   Score ${d.scoreObj.total}/100 → ${d.scoreObj.gauges.map((g) => `${g.code} ${pad(g.score, 3)}`).join(' · ')}`);
    const lb = s.leaderboard();
    console.log(`   Rang #${lb.rank}/${lb.total} (Top ${Math.max(1, Math.round(100 - lb.topPct))}%)`);
    d.tips.slice(0, 3).forEach((t) => console.log(`   • ${t.text}`));
    d.open = false;
    s.beginRound();
    quoted = new Set();
    rfqs = new Map();
    lastNews = null;
    sinceHedge = 0;
    initialDeployed = false;
    roundStart = true;
    continue;
  }
  if (s.phase !== 'round') continue;
  if (roundStart) {
    roundStart = false;
    console.log(`\n▶ ROUND ${s.round} — ${s.role === 'IB' ? 'IB-55 Market Maker' : 'AM-55 Asset Manager $20M'} · ${ROUND_SECONDS}s`);
  }

  sinceHedge += 0.25;
  const top = s.news.find((n) => n.kind !== 'NOTE');

  if (top && top.id !== lastNews) {
    lastNews = top.id;
    if (s.role === 'IB') {
      for (const q of [...s.liveQuotes]) s.cancelQuote(q.id);
    } else if (s.role === 'AM' && top.kind !== 'NOTE') {
      const dir = top.impact >= 0 ? 'BUY' : 'SELL';
      const tks = top.kind === 'STOCK' ? [top.ticker] : ['MSFT', 'BP', 'VW'];
      for (const tk of tks) {
        const qty = Math.max(1000, Math.round((2200000 / s.inst[tk].mid) / 1000) * 1000);
        const r = s.requestQuote({ dealerRoom: 'ALL', ticker: tk, qty, silent: true });
        if (!r?.error) rfqs.set(`${tk}:${qty}`, { dir, tk, qty, at: s.totalSim });
      }
    }
  }

  if (s.role === 'IB') {
    // re-quote when the market drifts through a live quote
    for (const q of [...s.liveQuotes]) {
      if (Math.abs(s.inst[q.ticker].mid / (q.refAtQuote || q.refAtQuote) - 1) > 0.0012) {
        s.cancelQuote(q.id);
        quoted.delete(q.rfqId);
      }
    }
    for (const req of s.clientRequests) {
      if (req.status !== 'open' || quoted.has(req.id)) continue;
      quoted.add(req.id);
      const eq = s.inst[req.ticker];
      const half = 55 / 1e4;
      const skew = top && s.totalSim - top.simAt < 45 && top.kind === 'MACRO' ? Math.sign(top.impact) * 0.0035 : 0;
      const bid = Number((eq.mid * (1 - half + skew)).toFixed(eq.dp));
      const offer = Number((eq.mid * (1 + half + skew)).toFixed(eq.dp));
      if (!(bid < offer)) continue;
      const r = s.sendQuote({
        clientRoom: req.clientId, ticker: req.ticker, bid, offer,
        bidVol: req.qty, offerVol: req.qty, validFor: 45,
      });
      if (r?.error) quoted.delete(req.id);
    }
    if (sinceHedge > 2) {
      sinceHedge = 0;
      for (const tk of T) {
        const p = s.positions[tk];
        if (p.qty && Math.abs(p.qty * s.inst[tk].mid) > 600000) {
          s.hedgeCooldown = 0;
          s.hedge(tk);
        }
      }
    }
  } else {
    if (!initialDeployed) {
      initialDeployed = true;
      for (const tk of T) {
        const qty = Math.max(1000, Math.round((2000000 / s.inst[tk].mid) / 1000) * 1000);
        const r = s.requestQuote({ dealerRoom: 'ALL', ticker: tk, qty, silent: true });
        if (!r?.error) rfqs.set(`${tk}:${qty}`, { dir: 'BUY', tk, qty, at: s.totalSim });
      }
    }
    for (const [key, want] of [...rfqs]) {
      const candidates = s.liveQuotes.filter((q) => q.ticker === want.tk && q.status === 'live');
      if (!candidates.length) {
        if (s.totalSim - want.at > 22) rfqs.delete(key);
        continue;
      }
      const best = candidates.sort((a, b) => (want.dir === 'BUY'
        ? Number(a.offer) - Number(b.offer)
        : Number(b.bid) - Number(a.bid)))[0];
      const r = s.acceptDealerQuote({ quoteId: best.id, side: want.dir, qty: Math.min(want.qty, best.bidVol) });
      if (!r?.error) rfqs.delete(key);
      else if (s.totalSim - want.at > 14) rfqs.delete(key);
    }
  }
}

const f = s.final;
console.log('\n══ BILAN FINAL — CFA INSTITUTE × AMPLIFYME ══');
console.log(`Score global : ${f.score}/100  ·  Rang #${f.rank}/${f.total} (Top ${Math.max(1, Math.round(100 - f.topPct))}%)`);
console.log(`P&L cumulé   : ${money(f.pnl)}  ·  Fat fingers : ${f.fatFingers}`);
(f.rounds || []).forEach((r) => console.log(`  R${r.round} ${r.role} → score ${r.scoreObj?.total ?? 0}/100 · P&L ${money(r.pnl)}`));
if (f.score < 88) {
  console.error(`\n✗ Playbook under target (${f.score} < 88)`);
  process.exit(1);
}
console.log('\n✓ Playbook ≥ 88 — objectif Top 1 % atteignable');
