import React, { useState } from 'react';
import { cls, usdSign, money, signCls } from '../lib/format.js';

function Modal({ children, wide }) {
  return (
    <div className="modal-wrap">
      <div className="modal" style={wide ? { width: 'min(880px, 96vw)' } : undefined}>{children}</div>
    </div>
  );
}

const safeGet = (k, fb = '') => {
  try { return localStorage.getItem(k) || fb; } catch { return fb; }
};
const safeSet = (k, v) => {
  try { localStorage.setItem(k, v); } catch { /* ignore */ }
};

/* ================================================================ BRIEFING */
export function Briefing({ state, send, connected }) {
  const [name, setName] = useState(safeGet('tl.nick', 'calvin'));
  const [mode, setMode] = useState('challenge');
  const [startRole, setStartRole] = useState('IB');
  const [roundSeconds, setRoundSeconds] = useState(300);
  const [assistMode, setAssistMode] = useState(false);

  const roundsCount = mode === 'challenge' ? 2 : 2;

  const start = () => {
    const n = name.trim() || 'ib1test1';
    safeSet('tl.nick', n);
    send({
      type: 'start',
      nickname: n,
      mode,
      startRole,
      rounds: roundsCount,
      roundSeconds: Number(roundSeconds),
      assistMode,
    });
  };

  return (
    <Modal wide>
      <div className="kicker">CFA Institute × AmplifyME · Investing Simulator Challenge Trainer</div>
      <h1>A M P L I F Y &nbsp; FlowTrader &amp; $20M Asset Manager</h1>
      <p className="lede" style={{ fontSize: 13 }}>
        Réplique fidèle de l'interface et du moteur d'évaluation du <b>CFA Institute × AmplifyME Investing Simulator Challenge</b> :
        alternez les rôles de <b>Trader en Banque d'Investissement (IB 1)</b> et de <b>Gestionnaire d'Actifs 20 M$ (AM 1)</b> pour
        viser le <b>Top 10 % qualificatif</b> en finale mondiale.
      </p>

      <div className="steps">
        <div className="step">
          <div className="n">IB</div>
          <div className="t">Round Sell-Side (IB 1)</div>
          <div className="d">
            Répondez aux clients <code>HF 1–3</code> &amp; <code>AM 1–2</code> dans le Chat, saisissez vos prix dans <code>SEND QUOTE</code>,
            engrangez les <b>Commissions</b>, annulez vos quotes sur les news et débouclez par clips sur <code>EXCHANGE</code>.
          </div>
        </div>
        <div className="step">
          <div className="n">AM</div>
          <div className="t">Round Buy-Side (AM 1 · $20M)</div>
          <div className="d">
            Gérez un portefeuille de <b>20 000 000 $</b> face aux actualités <code>MACRO</code> et actions : demandez des cotations blocs
            aux banques (<code>IB 1–3</code>) ou traitez en direct sur <code>EXCHANGE</code> tout en diversifiant le risque.
          </div>
        </div>
        <div className="step">
          <div className="n">10%</div>
          <div className="t">Scoring Officiel AmplifyME</div>
          <div className="d">
            Évaluation combinée sur 100 pts : P+L &amp; ROI, volume/commissions clients, qualité d'exécution, gestion du risque
            et <b>0 Fat Finger (FFC)</b>.
          </div>
        </div>
      </div>

      <div className="briefing-grid">
        <label className="field">
          <span className="field-label">Identifiant Candidat</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="ib1test1 / calvin"
            maxLength={22}
            onKeyDown={(e) => e.key === 'Enter' && start()}
          />
        </label>

        <label className="field">
          <span className="field-label">Format de Simulation</span>
          <select value={mode} onChange={(e) => setMode(e.target.value)}>
            <option value="challenge">Challenge Complet (Rotation IB 1 ↔ AM 1)</option>
            <option value="ib">Entraînement IB 1 seul (Market Maker &amp; Sales)</option>
            <option value="am">Entraînement AM 1 seul ($20M Asset Manager)</option>
          </select>
        </label>

        {mode === 'challenge' && (
          <label className="field">
            <span className="field-label">Rôle du Round 1</span>
            <select value={startRole} onChange={(e) => setStartRole(e.target.value)}>
              <option value="IB">Round 1 : IB 1 → Round 2 : AM 1</option>
              <option value="AM">Round 1 : AM 1 → Round 2 : IB 1</option>
            </select>
          </label>
        )}

        <label className="field">
          <span className="field-label">Durée par Round</span>
          <select value={roundSeconds} onChange={(e) => setRoundSeconds(Number(e.target.value))}>
            <option value={240}>4 min / round (Sprint intensif)</option>
            <option value={300}>5 min / round (Standard)</option>
            <option value={600}>10 min / round (Conditions longues)</option>
          </select>
        </label>

        <label className="field">
          <span className="field-label">Conditions d'Affichage</span>
          <select value={assistMode ? 'assist' : 'exam'} onChange={(e) => setAssistMode(e.target.value === 'assist')}>
            <option value="exam">Mode Examen (100 % identique AmplifyME)</option>
            <option value="assist">Mode Coach Assisté (traduction news + boutons skew)</option>
          </select>
        </label>
      </div>

      <div className="modal-actions">
        <span className="hint" style={{ marginRight: 'auto' }}>
          {connected ? '● Moteur temps réel connecté' : '○ Connexion au serveur…'}
        </span>
        <button
          type="button"
          className="btn primary"
          onClick={start}
          disabled={!connected}
          style={{ padding: '10px 24px', fontSize: 12 }}
        >
          ▶ Lancer la Simulation (Round 1)
        </button>
      </div>
      <p className="hint" style={{ marginTop: 12, marginBottom: 0 }}>
        Simulateur d'entraînement indépendant conçu pour préparer le format CFA Institute × AmplifyME. Aucun argent réel.
      </p>
    </Modal>
  );
}

/* ================================================================= DEBRIEF */
export function Debrief({ state, send, onClose }) {
  const d = state?.debrief;
  if (!d) return null;
  const st = d.stats || {};
  const sc = d.scoreObj || state?.roleScore;
  const lb = state?.leaderboard || { rank: 1, total: 260, topPct: 50 };
  const last = (state?.round ?? 1) >= (state?.roundsTotal ?? 2);
  const roleLabel = d.role === 'AM' ? 'Asset Manager (AM 1 · $20M)' : 'Investment Bank Trader (IB 1)';

  return (
    <Modal wide>
      <div className="kicker">Round {d.round} terminé · {roleLabel}</div>
      <h2>Performance Profile — Round {d.round}</h2>

      <div className="result-hero">
        <div>
          <div className="metric-label">Total P+L du Round</div>
          <div className={cls('big-num', signCls(st.pnl))}>{usdSign(st.pnl ?? 0)}</div>
        </div>
        <div>
          <div className="metric-label">Score AmplifyME</div>
          <div className="mono" style={{ fontSize: 22, fontWeight: 700, color: '#6fd4ff' }}>
            {sc?.total ?? 50} / 100
          </div>
        </div>
        <div className="spacer" />
        <div style={{ textAlign: 'right' }}>
          <div className="metric-label">Classement provisoire</div>
          <div className="mono" style={{ fontSize: 16, color: 'var(--accent)' }}>#{lb.rank} / {lb.total}</div>
          <div className="mono dim" style={{ fontSize: 10.5 }}>Top {Math.max(1, Math.round(100 - lb.topPct))} %</div>
        </div>
      </div>

      {sc?.breakdown && (
        <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: 12 }}>
          {sc.breakdown.map((b) => (
            <div key={b.label} className="stat">
              <div className="k">{b.label}</div>
              <div className={cls('v', b.score >= 75 ? 'pos' : b.score < 45 ? 'neg' : '')}>{b.score}%</div>
            </div>
          ))}
        </div>
      )}

      <div className="stat-grid">
        <div className="stat"><div className="k">Trades Clients / IB</div><div className="v">{st.fills ?? 0}</div></div>
        <div className="stat"><div className="k">Trades Exchange</div><div className="v">{st.exchangeTrades ?? 0}</div></div>
        <div className="stat"><div className="k">Commission</div><div className={cls('v', d.role === 'IB' ? signCls(st.commission) : '')}>{money(st.commission ?? 0)}</div></div>
        <div className="stat"><div className="k">Fat Finger Count</div><div className={cls('v', (st.fatFingers ?? 0) > 0 ? 'neg' : 'pos')}>{st.fatFingers ?? 0}</div></div>
        <div className="stat"><div className="k">Quotes envoyées</div><div className="v">{st.quotes ?? 0}</div></div>
        <div className="stat"><div className="k">Quotes snipées</div><div className={cls('v', (st.staleSniped ?? 0) > 0 ? 'neg' : 'pos')}>{st.staleSniped ?? 0}</div></div>
      </div>

      <div className="section-title">Analyse Coach pour viser le Top 10 %</div>
      {(d.tips ?? []).map((t, i) => (
        <div key={i} className={cls('tip', t.tone)}>
          <span>{t.tone === 'good' ? '✓' : t.tone === 'bad' ? '✕' : t.tone === 'warn' ? '⚠' : 'ℹ'}</span>
          <span>{t.text}</span>
        </div>
      ))}

      {!last && d.nextRole && (
        <div className="role-switch-banner">
          <b>Rotation des rôles au Round {d.round + 1} :</b> vous passez maintenant côté{' '}
          <b>{d.nextRole === 'AM' ? 'Buy-Side Asset Manager (AM 1 — portefeuille de 20 000 000 $)' : 'Sell-Side Investment Bank Trader (IB 1 — Market Making & Sales)'}</b> !
        </div>
      )}

      <div className="modal-actions">
        <button type="button" className="btn ghost" onClick={onClose}>Inspecter le terminal</button>
        <button
          type="button"
          className="btn primary"
          onClick={() => (last ? onClose() : send({ type: 'nextRound' }))}
        >
          {last ? 'Voir le bilan final →' : `▶ Lancer le Round ${(state?.round ?? 1) + 1} (${d.nextRole || state?.role})`}
        </button>
      </div>
    </Modal>
  );
}

/* =================================================================== FINAL */
export function Final({ state, onRestart, onLeaderboard }) {
  const f = state?.final;
  if (!f) return null;
  const topBand = Math.max(1, Math.round(100 - (f.topPct ?? 50)));
  const qualified = topBand <= 10;
  const scholarship = (f.rank ?? 99) <= 5;

  return (
    <Modal wide>
      <div className="kicker">CFA Institute × AmplifyME Investing Simulator · Résultat Final</div>
      <h2>Bilan Global de la Simulation</h2>

      <div className="result-hero">
        <div>
          <div className="metric-label">Score Global AmplifyME</div>
          <div className={cls('big-num', qualified ? 'pos' : '')}>{f.score ?? 50} / 100</div>
          <div className="mono dim" style={{ fontSize: 11 }}>Cumul P+L : {usdSign(f.pnl ?? 0)}</div>
        </div>
        <div>
          <div className="metric-label">Rang Mondial</div>
          <div className="mono" style={{ fontSize: 18 }}>#{f.rank} / {f.total}</div>
        </div>
        <div className="spacer" />
        <div style={{ textAlign: 'right' }}>
          <div className={cls('verdict', qualified ? 'pos' : 'amber')}>
            {scholarship
              ? '🏆 TOP 5 MONDIAL — ZONE BOURSE CFA®'
              : qualified
                ? '✓ QUALIFIÉ FINALE GLOBALE (TOP 10 %)'
                : topBand <= 25
                  ? 'TOP 25 % — PROCHE DE LA QUALIFICATION'
                  : 'EN PROGRESSION'}
          </div>
          <div className="mono" style={{ fontSize: 24, color: qualified ? 'var(--green)' : 'var(--text)' }}>
            TOP {topBand}%
          </div>
        </div>
      </div>

      {(f.rounds ?? []).length > 0 && (
        <>
          <div className="section-title">Détail par Rôle (Sell-Side IB &amp; Buy-Side AM)</div>
          <div className="stat-grid" style={{ gridTemplateColumns: `repeat(${Math.min(3, f.rounds.length)}, 1fr)` }}>
            {f.rounds.map((r) => (
              <div key={r.round} className="stat">
                <div className="k">Round {r.round} · Rôle {r.role}</div>
                <div className="v" style={{ color: '#7fd8ff' }}>{r.scoreObj?.total ?? 50}/100</div>
                <div className={cls('mono', signCls(r.pnl))} style={{ fontSize: 11, marginTop: 3 }}>
                  P+L {usdSign(r.pnl)} · FFC {r.fatFingers}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <div className="stat-grid" style={{ marginTop: 8 }}>
        <div className="stat"><div className="k">Total Trades</div><div className="v">{f.trades ?? 0}</div></div>
        <div className="stat"><div className="k">Quotes Envoyées</div><div className="v">{f.quotes ?? 0}</div></div>
        <div className="stat"><div className="k">Fat Finger Total</div><div className={cls('v', (f.fatFingers ?? 0) > 0 ? 'neg' : 'pos')}>{f.fatFingers ?? 0}</div></div>
      </div>

      <div className="section-title">Axes de progression prioritaires</div>
      {(f.tips ?? []).map((t, i) => (
        <div key={i} className={cls('tip', t.tone)}>
          <span>{t.tone === 'good' ? '✓' : t.tone === 'bad' ? '✕' : t.tone === 'warn' ? '⚠' : 'ℹ'}</span>
          <span>{t.text}</span>
        </div>
      ))}

      <div className="modal-actions">
        <button type="button" className="btn ghost" onClick={onLeaderboard}>Voir le classement complet</button>
        <button type="button" className="btn primary" onClick={onRestart}>↻ Nouvelle session d'entraînement</button>
      </div>
    </Modal>
  );
}
