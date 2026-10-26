import React, { useState } from 'react';
import { cls, usd, usdSign, money, signCls, pct, compact } from '../lib/format.js';

function Modal({ children, wide }) {
  return (
    <div className="modal-wrap">
      <div className="modal" style={wide ? { width: 'min(860px, 96vw)' } : undefined}>{children}</div>
    </div>
  );
}

/* ---------------------------------------------------------------- briefing */
export function Briefing({ state, send, connected }) {
  const [name, setName] = useState(localStorage.getItem('tl.nick') || '');
  const [rounds, setRounds] = useState(3);

  const start = () => {
    const n = name.trim() || 'Trader anonyme';
    localStorage.setItem('tl.nick', n);
    send({ type: 'start', nickname: n, rounds });
  };

  return (
    <Modal wide>
      <div className="kicker">Simulateur d'entraînement · market making actions</div>
      <h1>TradeLab</h1>
      <p className="lede" style={{ fontSize: 13.5 }}>
        Des clients vous demandent des prix à double sens sur 6 actions. Vous gagnez le <b>spread</b>,
        vous perdez quand le marché bouge après votre exécution. Votre objectif : <b>terminer dans le top 10 %</b> du classement.
      </p>

      <div className="steps">
        <div className="step">
          <div className="n">1</div>
          <div className="t">Cotez un prix</div>
          <div className="d">Un client arrive : proposez un bid (où vous achetez) et un offer (où vous vendez). C'est votre spread.</div>
        </div>
        <div className="step">
          <div className="n">2</div>
          <div className="t">Lisez le flux</div>
          <div className="d">News, flux client, couleur du desk : détectez si la contrepartie est informée et skewez vos prix.</div>
        </div>
        <div className="step">
          <div className="n">3</div>
          <div className="t">Gérez le risque</div>
          <div className="d">Couvrez l'exposition toxique, gardez le flux sain. Le P&amp;L se construit sur la répétition.</div>
        </div>
      </div>

      <div className="row" style={{ gap: 14, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <label className="field" style={{ width: 220 }}>
          <span className="field-label">Votre nom de trader</span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="ex. Calvin" maxLength={22} onKeyDown={(e) => e.key === 'Enter' && start()} />
        </label>
        <label className="field" style={{ width: 150 }}>
          <span className="field-label">Nombre de rounds</span>
          <select value={rounds} onChange={(e) => setRounds(Number(e.target.value))}>
            <option value={1}>1 × 3 min (express)</option>
            <option value={3}>3 × 3 min (session)</option>
            <option value={5}>5 × 3 min (endurance)</option>
          </select>
        </label>
        <div className="spacer" />
        <div className="mono" style={{ fontSize: 10, color: 'var(--muted)', textAlign: 'right' }}>
          3 minutes par round · 15 à 20 demandes clients<br />
          classement actualisé en continu
        </div>
      </div>

      <div className="modal-actions">
        <span className="hint" style={{ marginRight: 'auto' }}>
          {connected ? '● connecté au moteur de marché' : '○ connexion au moteur…'}
        </span>
        <button className="btn primary" onClick={start} disabled={!connected} style={{ padding: '9px 22px', fontSize: 12 }}>
          ▶ Commencer le round 1
        </button>
      </div>
      <p className="hint" style={{ marginTop: 14, marginBottom: 0, lineHeight: 1.6 }}>
        Simulateur pédagogique indépendant, inspiré du format des challenges de simulation de marché.
        Aucune affiliation, aucun argent réel, aucune recommandation d'investissement.
      </p>
    </Modal>
  );
}

/* ------------------------------------------------------------------ debrief */
export function Debrief({ state, send, onClose }) {
  const d = state?.debrief;
  if (!d) return null;
  const st = d.stats;
  const lb = state.leaderboard;
  const last = state.round >= state.roundsTotal;

  return (
    <Modal wide>
      <div className="kicker">Round {d.round} terminé</div>
      <h2>Débrief du round</h2>

      <div className="result-hero">
        <div>
          <div className="metric-label">P&amp;L du round</div>
          <div className={cls('big-num', signCls(st.pnl))}>{usdSign(st.pnl)}</div>
        </div>
        <div>
          <div className="metric-label">Cumul session</div>
          <div className={cls('mono', signCls(st.total))} style={{ fontSize: 18 }}>{usdSign(st.total)}</div>
        </div>
        <div className="spacer" />
        <div style={{ textAlign: 'right' }}>
          <div className="metric-label">Classement</div>
          <div className="mono" style={{ fontSize: 15, color: 'var(--accent)' }}>#{lb.rank} / {lb.total}</div>
          <div className="mono dim" style={{ fontSize: 10 }}>top {Math.max(1, Math.round(100 - lb.topPct))} %</div>
        </div>
      </div>

      <div className="stat-grid">
        <div className="stat"><div className="k">Exécutions clients</div><div className="v">{st.fills}</div></div>
        <div className="stat"><div className="k">Couvrements marché</div><div className="v">{st.exchangeTrades}</div></div>
        <div className="stat"><div className="k">Spread capturé</div><div className={cls('v', signCls(st.capture))}>{money(st.capture)}</div></div>
        <div className="stat"><div className="k">Sélection adverse</div><div className={cls('v', signCls(st.adverse))}>{money(st.adverse)}</div></div>
        <div className="stat"><div className="k">Prix proposés</div><div className="v">{st.quotes}</div></div>
        <div className="stat"><div className="k">Risque max</div><div className="v" style={{ fontSize: 12 }}>{usd(state.coach.maxRisk)}</div></div>
      </div>

      <div className="section-title">Ce que le coach a vu</div>
      {(d.tips ?? []).map((t, i) => (
        <div key={i} className={cls('tip', t.tone)}>
          <span>{t.tone === 'good' ? '✓' : t.tone === 'bad' ? '✕' : t.tone === 'warn' ? '⚠' : 'ℹ'}</span>
          <span>{t.text}</span>
        </div>
      ))}

      {((d.worst ?? []).length > 0 || (d.best ?? []).length > 0) && (
        <>
          <div className="section-title">Vos exécutions, 10 secondes plus tard</div>
          <div className="hint mb6">
            Le <b>markout</b> mesure ce que l'exécution a rapporté si vous aviez fermé la position au mid 10 s après.
            Négatif = le client savait quelque chose.
          </div>
          {(d.worst ?? []).map((x, i) => (
            <div key={`w${i}`} className="exec-row bad">
              <span className="mono dim">{x.clock}</span>
              <span className={cls('badge', x.side === 'BUY' ? 'buy' : 'sell')}>{x.side === 'BUY' ? 'ACH' : 'VEN'}</span>
              <span className="mono">{x.ticker} · {compact(x.qty)} @ {x.price}</span>
              <span className="mono dim">{x.client}</span>
              <span className={cls('mono', signCls(x.markout))}>{money(x.markout)} $</span>
            </div>
          ))}
          {(d.best ?? []).map((x, i) => (
            <div key={`b${i}`} className="exec-row good">
              <span className="mono dim">{x.clock}</span>
              <span className={cls('badge', x.side === 'BUY' ? 'buy' : 'sell')}>{x.side === 'BUY' ? 'ACH' : 'VEN'}</span>
              <span className="mono">{x.ticker} · {compact(x.qty)} @ {x.price}</span>
              <span className="mono dim">{x.client}</span>
              <span className={cls('mono', signCls(x.markout))}>{money(x.markout)} $</span>
            </div>
          ))}
        </>
      )}

      <div className="section-title">Qui était informé ?</div>
      <div style={{ fontSize: 10.3, color: 'var(--muted)', marginBottom: 6 }}>
        Révélation de fin de round : la part de flux informé de chaque contrepartie.
      </div>
      {(d.clients ?? []).map((c) => (
        <div key={c.name} className="client-row">
          <div className="nm"><span className="client-dot" style={{ background: c.color }} />{c.name}</div>
          <div className="mono" style={{ fontSize: 9.5, color: 'var(--muted)' }}>{c.label}</div>
          <div className="note">{c.note}</div>
          <div className="num">
            {c.trades} trades
            <div style={{ fontSize: 9, color: c.informedTrades > c.trades / 2 && c.trades > 0 ? 'var(--red)' : 'var(--muted)' }}>
              {c.informedTrades} informés
            </div>
          </div>
        </div>
      ))}

      <div className="modal-actions">
        <button className="btn ghost" onClick={onClose}>Voir le desk</button>
        <button className="btn primary" onClick={() => (last ? onClose() : send({ type: 'nextRound' }))}>
          {last ? 'Voir le résultat final' : `▶ Round ${state.round + 1}`}
        </button>
      </div>
    </Modal>
  );
}

/* -------------------------------------------------------------------- final */
export function Final({ state, send, onRestart, onLeaderboard }) {
  const f = state?.final;
  if (!f) return null;
  const topBand = Math.max(1, Math.round(100 - f.topPct));
  const won = f.topPct >= 90;
  const top1 = f.topPct >= 99;

  return (
    <Modal wide>
      <div className="kicker">Session terminée · {state.roundsTotal} rounds</div>
      <h2>Résultat final</h2>

      <div className="result-hero">
        <div>
          <div className="metric-label">P&amp;L total</div>
          <div className={cls('big-num', signCls(f.pnl))}>{usdSign(f.pnl)}</div>
        </div>
        <div>
          <div className="metric-label">Classement</div>
          <div className="mono" style={{ fontSize: 17 }}>#{f.rank} / {f.total}</div>
        </div>
        <div className="spacer" />
        <div style={{ textAlign: 'right' }}>
          <div className={cls('verdict', won ? 'pos' : 'amber')}>
            {top1 ? 'TOP 1 % — élite du desk' : won ? 'TOP 10 % ATTEINT' : topBand <= 25 ? 'TOP 25 %' : 'EN PROGRESSION'}
          </div>
          <div className="mono" style={{ fontSize: 22, color: won ? 'var(--green)' : 'var(--text)' }}>TOP {topBand}%</div>
        </div>
      </div>

      <p className="lede">
        {won
          ? "Vous faites partie du top 10 % : spread maîtrisé, flux informé filtré, risque sous contrôle. C'est exactement le profil recherché sur un desk de market making."
          : "Le P&L est dominé par deux erreurs classiques : coter trop serré face à du flux informé, et laisser courir une position directionnelle. Rejouez en appliquant le skew après chaque news."}
      </p>

      <div className="stat-grid">
        <div className="stat"><div className="k">Spread capturé</div><div className={cls('v', signCls(f.capture))}>{money(f.capture)}</div></div>
        <div className="stat"><div className="k">Sélection adverse</div><div className={cls('v', signCls(f.adverse))}>{money(f.adverse)}</div></div>
        <div className="stat"><div className="k">Commissions</div><div className="v" style={{ color: 'var(--text-dim)' }}>{money(f.fees)}</div></div>
        <div className="stat"><div className="k">Prix envoyés</div><div className="v">{f.quotes}</div></div>
        <div className="stat"><div className="k">Taux d'exécution</div><div className="v">{Math.round(f.hitRate * 100)} %</div></div>
        <div className="stat"><div className="k">Exécutions</div><div className="v">{f.trades}</div></div>
      </div>

      <div className="section-title">À travailler ensuite</div>
      {(f.tips ?? []).map((t, i) => (
        <div key={i} className={cls('tip', t.tone)}>
          <span>{t.tone === 'good' ? '✓' : t.tone === 'bad' ? '✕' : t.tone === 'warn' ? '⚠' : 'ℹ'}</span>
          <span>{t.text}</span>
        </div>
      ))}

      <div className="modal-actions">
        <button className="btn ghost" onClick={onLeaderboard}>Voir le classement</button>
        <button className="btn primary" onClick={onRestart}>↻ Nouvelle session</button>
      </div>
    </Modal>
  );
}
