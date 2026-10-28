import React, { useState } from 'react';
import { cls, money, pct, price, usd } from '../lib/format.js';
import { GaugeGrid, ScoreRing, gaugeColor } from './Gauge.jsx';
import { GAUGE_DEFS, LINKS, TOP1_TARGET, UNIVERSE } from '../lib/scoring.js';

function GapNote({ score }) {
  const gap = Math.max(0, TOP1_TARGET - Math.round(score));
  if (gap === 0) {
    return <div className="gap-note elite">TOP 1 % — objectif 90 % atteint. Conservez cette discipline.</div>;
  }
  return (
    <div className="gap-note">
      Objectif Top 1 % : <b>{TOP1_TARGET} %</b> · il manque <b>{gap} pts</b> — le détail des jauges ci-dessous indique quoi corriger.
    </div>
  );
}

/* ================================================================= BRIEFING */
export function Briefing({ state, onStart, onGuide }) {
  const [nickname, setNickname] = useState(state?.nickname || 'Calvin MINANG');
  const [mode, setMode] = useState('replay');
  const [pace, setPace] = useState('standard');
  const [startRole, setStartRole] = useState('IB');
  const [assistMode, setAssistMode] = useState(false);

  const launch = () => {
    onStart?.({ nickname: nickname.trim() || 'Calvin MINANG', mode, pace, startRole, assistMode });
  };

  return (
    <div className="modal-backdrop briefing-backdrop">
      <div className="briefing-card">
        <header className="briefing-head">
          <div className="bh-brand">
            <div className="av-logo big">AV</div>
            <div>
              <div className="bh-kicker">CFA INSTITUTE × AMPLIFYME</div>
              <h1>Investing Simulator Challenge — Trainer</h1>
              <p>Les 2 exercices officiels : <b>IB-55</b> market maker sell-side & <b>AM-55</b> asset manager $20M.</p>
            </div>
          </div>
          <div className="bh-badge">TOP 1 %<small>90 %+</small></div>
        </header>

        <div className="briefing-grid">
          <div className="bg-col">
            <div className="bstep">
              <div className="bstep-title"><span>1</span> Identité</div>
              <label className="field">
                <span>Nom affiché sur le leaderboard</span>
                <input value={nickname} onChange={(e) => setNickname(e.target.value)} maxLength={24} placeholder="Calvin MINANG" />
              </label>
            </div>

            <div className="bstep">
              <div className="bstep-title"><span>2</span> Scénario</div>
              <button type="button" className={cls('choice-card', mode === 'replay' && 'on')} onClick={() => setMode('replay')}>
                <span className="cc-ico">🎬</span>
                <span className="cc-body">
                  <b>Scénario Officiel — Replay</b>
                  <small>Round 1 &amp; Round 2 réels · 12 + 6 dépêches AmplifyME exactes · marché déterministe.</small>
                </span>
                <span className="cc-check" />
              </button>
              <button type="button" className={cls('choice-card', mode === 'dynamic' && 'on')} onClick={() => setMode('dynamic')}>
                <span className="cc-ico">🎲</span>
                <span className="cc-body">
                  <b>Mode Entraînement Dynamique</b>
                  <small>30+ dépêches variées (macro, résultats, M&amp;A, réglementaire) · tirages aléatoires à chaque round.</small>
                </span>
                <span className="cc-check" />
              </button>
            </div>

            <div className="bstep">
              <div className="bstep-title"><span>3</span> Durée du round</div>
              <div className="pace-row">
                {[
                  ['express', 'Express', '8 min', 'Sprint de qualification'],
                  ['standard', 'Standard', '15 min', 'Format recommandé'],
                  ['real', 'Conditions réelles', '30 min', 'Comme la session live'],
                ].map(([id, label, mins, sub]) => (
                  <button key={id} type="button" className={cls('pace-card', pace === id && 'on')} onClick={() => setPace(id)}>
                    <b>{label}</b>
                    <span>{mins}</span>
                    <small>{sub}</small>
                  </button>
                ))}
              </div>
            </div>

            <label className="assist-row">
              <input type="checkbox" checked={assistMode} onChange={(e) => setAssistMode(e.target.checked)} />
              <span>Afficher les indices du coach sur les dépêches (mode entraînement)</span>
            </label>
          </div>

          <div className="bg-col">
            <div className="bstep">
              <div className="bstep-title"><span>4</span> Commencer par</div>
              <div className="role-choice">
                <button type="button" className={cls('role-card ib', startRole === 'IB' && 'on')} onClick={() => setStartRole('IB')}>
                  <div className="rc-top"><span className="rc-badge">IB-55</span><span className="rc-ico">🏦</span></div>
                  <b>Investment Bank</b>
                  <small>Market Maker Sell-Side</small>
                  <ul>
                    <li>Quote two-way aux clients AM / HF</li>
                    <li>Commissions + gestion d’inventaire</li>
                    <li>6 jauges · COMM, FFC, CT, SSRM, ETM, PnL</li>
                  </ul>
                  <span className="rc-tag">Round 1 → IB-55 · Round 2 → AM-55</span>
                </button>
                <button type="button" className={cls('role-card am', startRole === 'AM' && 'on')} onClick={() => setStartRole('AM')}>
                  <div className="rc-top"><span className="rc-badge">AM-55</span><span className="rc-ico">📊</span></div>
                  <b>Asset Manager</b>
                  <small>Portefeuille $20,000,000</small>
                  <ul>
                    <li>Long / short sur les 5 actions</li>
                    <li>RFQ dealers IB-2 → IB-57</li>
                    <li>5 jauges · BSRM, ES, FFC, RA, ROI</li>
                  </ul>
                  <span className="rc-tag">Round 1 → AM-55 · Round 2 → IB-55</span>
                </button>
              </div>
            </div>

            <div className="bstep">
              <div className="bstep-title"><span>5</span> Univers &amp; barème</div>
              <div className="universe-row">
                {UNIVERSE.map((u) => (
                  <div key={u.ticker} className="uni-chip">
                    <b>{u.ticker}</b>
                    <span className="mono">{u.price}</span>
                    <em>{u.dp} déc.</em>
                  </div>
                ))}
              </div>
              <div className="gauge-preview">
                <div>
                  <h4>IB-55 · 6 jauges</h4>
                  {GAUGE_DEFS.IB.map((g) => (
                    <div key={g.code} className="gp-row"><b>{g.code}</b><span>{g.label}</span><em>{g.weight}%</em></div>
                  ))}
                </div>
                <div>
                  <h4>AM-55 · 5 jauges</h4>
                  {GAUGE_DEFS.AM.map((g) => (
                    <div key={g.code} className="gp-row"><b>{g.code}</b><span>{g.label}</span><em>{g.weight}%</em></div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        <footer className="briefing-foot">
          <div className="bf-links">
            <a href={LINKS.github} target="_blank" rel="noreferrer">GitHub</a>
            <a href={LINKS.render} target="_blank" rel="noreferrer">Version déployée</a>
            <button type="button" className="link-btn" onClick={onGuide}>📄 Guide PDF Top 1 %</button>
            <span className="dim">Simulateur pédagogique indépendant — aucun argent réel.</span>
          </div>
          <button type="button" className="launch-btn" onClick={launch}>
            LANCER LA SESSION <span>→</span>
          </button>
        </footer>
      </div>
    </div>
  );
}

/* ================================================================== DEBRIEF */
export function Debrief({ state, send, onClose, onGuide }) {
  const d = state?.debrief;
  if (!d) return null;
  const score = d.scoreObj?.total ?? 0;
  const gauges = d.scoreObj?.gauges ?? [];
  const stats = d.stats ?? {};
  const isIB = d.role === 'IB';

  const nextLabel = d.nextRole
    ? `▶ ROUND ${(d.round ?? 1) + 1} — ${d.nextRole === 'IB' ? 'IB-55 · Market Maker' : 'AM-55 · Asset Manager'}`
    : 'RÉSULTAT FINAL →';

  return (
    <div className="modal-backdrop">
      <div className="debrief-card">
        <header className="debrief-head">
          <div>
            <div className="kicker">ROUND {d.round} TERMINÉ</div>
            <h2>{isIB ? 'IB-55 · Market Maker Sell-Side' : 'AM-55 · Asset Manager $20M'}</h2>
            <p>Voici votre débrief AmplifyME — chaque jauge compte dans le score global.</p>
          </div>
          <button type="button" className="modal-x" onClick={onClose} aria-label="Fermer">✕</button>
        </header>

        <div className="debrief-top">
          <ScoreRing score={score} size={150} label="SCORE ROUND" />
          <div className="debrief-kpis">
            <div className="kpi"><span>Total P&amp;L</span><b className={cls('mono', stats.pnl > 0 ? 'pos' : stats.pnl < 0 ? 'neg' : '')}>{usd(stats.pnl ?? 0)}</b></div>
            <div className="kpi"><span>{isIB ? 'Commission' : 'Portfolio Value'}</span><b className="mono">{isIB ? usd(stats.commission ?? 0) : usd(stats.portfolioValue ?? 0)}</b></div>
            <div className="kpi"><span>{isIB ? 'Chat trades' : 'Trades'}</span><b className="mono">{stats.clientFills ?? stats.fills ?? 0}</b></div>
            <div className="kpi"><span>{isIB ? 'Quotes envoyées' : 'Cash restant'}</span><b className="mono">{isIB ? (stats.quotes ?? 0) : usd(stats.cash ?? 0)}</b></div>
            <div className="kpi"><span>Fat Fingers</span><b className={cls('mono', stats.fatFingers ? 'neg' : 'pos')}>{stats.fatFingers ?? 0}</b></div>
            <div className="kpi"><span>{isIB ? 'Exposition nette' : 'Max ligne'}</span><b className="mono">{isIB ? usd(state?.risk?.net ?? 0) : pct(stats.maxWeight ?? 0, 1)}</b></div>
          </div>
        </div>

        <GapNote score={score} />
        <GaugeGrid gauges={gauges} size={84} />

        <div className="gauge-details">
          {gauges.map((g) => (
            <div key={g.code} className="gd-row">
              <span className="gd-code" style={{ color: gaugeColor(g.score) }}>{g.code}</span>
              <span className="gd-bar"><i style={{ width: `${g.score}%`, background: gaugeColor(g.score) }} /></span>
              <span className="gd-score mono">{g.score}%</span>
              <span className="gd-detail">{g.detail}</span>
            </div>
          ))}
        </div>

        <div className="tips-block">
          <h3>Coach — actions concrètes</h3>
          {d.tips?.map((t, i) => (
            <div key={i} className={cls('tip', t.tone)}>
              <span>{t.tone === 'good' ? '✓' : t.tone === 'bad' ? '✕' : '!'}</span>
              <p>{t.text}</p>
            </div>
          ))}
          {!d.tips?.length && <p className="dim">Exécution propre sur ce round.</p>}
        </div>

        <footer className="debrief-foot">
          <button type="button" className="btn ghost" onClick={onGuide}>📄 Guide PDF</button>
          <button type="button" className="btn ghost" onClick={onClose}>Voir le marché</button>
          <button
            type="button"
            className="btn primary"
            onClick={() => { if (d.nextRole) send({ type: 'nextRound' }); else onClose?.(); }}
          >
            {nextLabel}
          </button>
        </footer>
      </div>
    </div>
  );
}

/* ==================================================================== FINAL */
export function Final({ state, onRestart, onGuide, onLeaderboard }) {
  const f = state?.final;
  if (!f) return null;
  const rounds = f.rounds ?? [];
  const topBand = Math.max(1, Math.round(100 - (f.topPct ?? 0)));
  const elite = f.score >= TOP1_TARGET;

  return (
    <div className="modal-backdrop">
      <div className="final-card">
        <div className={cls('final-banner', elite && 'elite')}>
          <div>
            <div className="kicker">CFA INSTITUTE × AMPLIFYME — CHALLENGE TERMINÉ</div>
            <h1>{elite ? 'TOP 1 % — OBJECTIF ATTEINT' : `RANG #${f.rank} / ${f.total}`}</h1>
            <p>
              Score composite <b>{f.score} %</b> · Top <b>{topBand} %</b> du cohort · P&amp;L total <b>{usd(f.pnl)}</b>
            </p>
          </div>
          <ScoreRing score={f.score} size={140} label="GLOBAL" />
        </div>

        <div className="final-rounds">
          {rounds.map((r) => (
            <div key={r.round} className="round-card">
              <div className="rc-head">
                <span className="rc-badge">{r.role === 'IB' ? 'IB-55' : 'AM-55'}</span>
                <span>Round {r.round}</span>
                <b style={{ color: gaugeColor(r.scoreObj?.total) }}>{r.scoreObj?.total ?? 0}%</b>
              </div>
              <div className="rc-body">
                <div><span>P&amp;L</span><b className={cls('mono', r.pnl > 0 ? 'pos' : r.pnl < 0 ? 'neg' : '')}>{usd(r.pnl)}</b></div>
                <div><span>{r.role === 'IB' ? 'Commission' : 'PV'}</span><b className="mono">{r.role === 'IB' ? usd(r.commission) : usd(r.portfolioValue)}</b></div>
                <div><span>{r.role === 'IB' ? 'Chat trades' : 'Max ligne'}</span><b className="mono">{r.role === 'IB' ? r.clientFills : `${r.maxWeight}%`}</b></div>
                <div><span>FFC</span><b className={cls('mono', r.fatFingers ? 'neg' : 'pos')}>{r.fatFingers}</b></div>
              </div>
              <div className="rc-gauges">
                {r.scoreObj?.gauges?.map((g) => (
                  <span key={g.code} title={`${g.label} — ${g.score}%`} style={{ borderColor: `${gaugeColor(g.score)}55` }}>
                    <b style={{ color: gaugeColor(g.score) }}>{g.code}</b>
                    <em>{g.score}</em>
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>

        <GapNote score={f.score} />

        <div className="final-tips">
          <h3>Plan d’action pour la prochaine session</h3>
          {(f.tips ?? []).map((t, i) => (
            <div key={i} className={cls('tip', t.tone)}>
              <span>{t.tone === 'good' ? '✓' : t.tone === 'bad' ? '✕' : '!'}</span>
              <p>{t.text}</p>
            </div>
          ))}
        </div>

        <footer className="debrief-foot">
          <button type="button" className="btn ghost" onClick={onLeaderboard}>🏆 Leaderboard</button>
          <button type="button" className="btn ghost" onClick={onGuide}>📄 Guide PDF Top 1 %</button>
          <button type="button" className="btn primary" onClick={onRestart}>↻ REJOUER</button>
        </footer>
      </div>
    </div>
  );
}
