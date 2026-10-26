// Joue une session complète avec un profil de joueur "attentif" (skew basé sur
// l'information publique : news + flux), et affiche le déroulé et le résultat.
import { Session } from '../server/engine.js';

const seed = Number(process.argv[2] || 7);
const s = new Session({ id: 'play', seed, nickname: 'Player' });

const hist = {};
let lastRfq = null;
let quotes = 0;
let skips = 0;

s.beginRound();
for (let i = 0; i < 4000 && s.phase !== 'done'; i++) {
  s.step(0.25);

  if (s.debrief?.open && s.phase === 'break') {
    console.log(`\n── ROUND ${s.debrief.round} : P&L ${Math.round(s.debrief.stats.pnl).toLocaleString('fr-FR')} $ `
      + `| total ${Math.round(s.totalPnl()).toLocaleString('fr-FR')} $ | rang ${s.leaderboard().rank}/${s.leaderboard().total}`);
    for (const t of s.debrief.tips) console.log('   •', t.text.slice(0, 120));
    s.debrief.open = false;
    s.beginRound();
  }

  const rfq = s.activeRfq();
  if (rfq && rfq.id !== lastRfq) {
    lastRfq = rfq.id;
    // décision : on regarde la news la plus récente et le prix sur 45 s
    const inst = s.inst[rfq.ticker];
    const tr = hist[rfq.ticker] || (hist[rfq.ticker] = []);
    tr.push(inst.mid);
    if (tr.length > 200) tr.shift();
    const mom = tr.length > 45 ? inst.mid / tr[tr.length - 46] - 1 : 0;
    const lastNews = s.news[0];
    const newsAge = lastNews ? (lastNews.kind === 'MACRO' || lastNews.ticker === rfq.ticker) ? s.totalSim - (s.roundStartSim + lastNews.at) : 99 : 99;
    const newsDir = lastNews?.kind === 'STOCK' ? Math.sign(lastNews.impact) : 0;

    // skew : momentum + news récente
    let skew = 0;
    if (Math.abs(mom) > 0.0004) skew += Math.max(-0.0025, Math.min(0.0025, mom * 1.2));
    if (newsAge < 35 && newsDir) skew += newsDir * 0.0012;
    // spread : 18 bps de base, 28 bps dans les 35 s qui suivent une news
    const half = (newsAge < 35 ? 0.0028 : 0.0018);
    if (Math.abs(skew) > 0.0026 && Math.random() < 0.35) { s.passRfq(rfq.id); skips++; continue; }

    const bid = Math.round(inst.mid * (1 - half + skew) * 100) / 100;
    const offer = Math.round(inst.mid * (1 + half + skew) * 100) / 100;
    s.quoteRfq(rfq.id, bid, offer, Math.round(rfq.qty * 0.8), Math.round(rfq.qty * 0.8), 30);
    quotes++;
  }

  // couverture : au-delà de 6 M$ de notionnel
  if (i % 6 === 0) {
    for (const t of Object.keys(s.positions)) {
      const p = s.positions[t];
      if (Math.abs(p.qty * s.inst[t].mid) > 6000000) s.hedge(t);
    }
  }
}

const lb = s.leaderboard();
const f = s.final;
console.log('\n══ RÉSULTAT ══');
console.log(`P&L total      : ${Math.round(f.pnl).toLocaleString('fr-FR')} $`);
console.log(`Rang           : ${f.rank} / ${f.total}  →  top ${Math.max(1, Math.round(100 - f.topPct))} %`);
console.log(`Spread capturé : ${Math.round(f.capture).toLocaleString('fr-FR')} $ | adverse ${Math.round(f.adverse).toLocaleString('fr-FR')} $ | frais ${Math.round(f.fees).toLocaleString('fr-FR')} $`);
console.log(`Prix envoyés   : ${quotes} (dont ${skips} passés) | exécutions ${f.trades} | taux ${Math.round(f.hitRate * 100)} %`);
console.log(`Seuil top 10 % : ${Math.round(lb.firstThreshold).toLocaleString('fr-FR')} $`);
