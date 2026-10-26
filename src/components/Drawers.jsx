import React from 'react';
import { cls, usd, usdSign, money, signCls } from '../lib/format.js';

function DrawerShell({ title, onClose, children, width }) {
  return (
    <>
      <div className="scrim" onClick={onClose} />
      <aside className="drawer" style={width ? { width } : undefined}>
        <div className="drawer-head">
          <h2>{title}</h2>
          <button type="button" className="drawer-close" onClick={onClose}>×</button>
        </div>
        <div className="drawer-body">{children}</div>
      </aside>
    </>
  );
}

/* ============================================================ LEADERBOARD */
export function LeaderboardDrawer({ state, onClose }) {
  const lb = state?.leaderboard;
  if (!lb) return null;
  const topPct = Math.max(0.1, lb.topPct);
  const topBand = Math.max(1, Math.round(100 - topPct));
  const qualified = topBand <= 10;
  const scholarshipZone = lb.rank <= 5;
  const scoreGap = (lb.scoreThreshold ?? 78) - (lb.myScore ?? 50);
  const rows = lb.around?.length ? lb.around : lb.rows;

  return (
    <DrawerShell title="🏆 Classement Global CFA × AmplifyME" onClose={onClose}>
      <div className="result-hero" style={{ gap: 18 }}>
        <div>
          <div className="metric-label">Votre rang actuel</div>
          <div className="big-num" style={{ color: qualified ? 'var(--green)' : 'var(--text)' }}>
            TOP {topBand}%
          </div>
          <div className="mono dim" style={{ fontSize: 10.5 }}>
            #{lb.rank} / {lb.total} étudiants · Score <b>{lb.myScore}/100</b>
          </div>
        </div>
        <div style={{ flex: 1, minWidth: 160 }}>
          <div className="row" style={{ justifyContent: 'space-between', fontSize: 9.5, color: 'var(--muted)', marginBottom: 4 }}>
            <span> Cohorte</span><span>Top 25%</span><span>Top 10% (Finale)</span><span>Top 5 (Bourse CFA)</span>
          </div>
          <div style={{ position: 'relative', height: 10, borderRadius: 6, background: 'linear-gradient(90deg,#1f3344,#165370,#1a9ad6,#2ecc71)' }}>
            <div style={{
              position: 'absolute',
              left: `${Math.min(98, topPct)}%`,
              top: -3,
              width: 4,
              height: 16,
              background: '#f1c40f',
              boxShadow: '0 0 8px #f1c40f',
              borderRadius: 2,
              transform: 'translateX(-50%)',
            }} />
          </div>
          <div className="mono" style={{ fontSize: 10.5, color: 'var(--text-dim)', marginTop: 6 }}>
            {scholarshipZone
              ? '🌟 Zone Bourse CFA® Program Scholarship (Top 5 mondial) !'
              : qualified
                ? '✓ Qualifié pour la Finale Globale (Top 10 % atteint)'
                : `Objectif Finale : encore +${Math.max(1, scoreGap)} pts de score AmplifyME`}
          </div>
        </div>
      </div>

      <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
        <div className="stat">
          <div className="k">Score Composite</div>
          <div className={cls('v', qualified ? 'pos' : '')}>{lb.myScore} / 100</div>
        </div>
        <div className="stat">
          <div className="k">Seuil Top 10 %</div>
          <div className="v">{lb.scoreThreshold ?? 78} / 100</div>
        </div>
        <div className="stat">
          <div className="k">P+L Cumulé</div>
          <div className={cls('v', signCls(lb.myPnl))}>{usdSign(lb.myPnl)}</div>
        </div>
      </div>

      <div className="section-title">Autour de votre position</div>
      {rows.map((r, i) => (
        <div key={`ar-${r.name}-${i}`} className={cls('lb-row', r.me && 'me')}>
          <div className="rk">#{r.rank ?? i + 1}</div>
          <div style={{ minWidth: 0 }}>
            <div className="nm">{r.name}</div>
            <div className="firm">{r.firm}</div>
          </div>
          <div className="mono" style={{ fontSize: 10.5, color: '#8fd8ff', marginRight: 8 }}>
            {r.score} pts
          </div>
          <div className={cls('pl', signCls(r.pnl))}>{usdSign(r.pnl)}</div>
        </div>
      ))}

      <div className="section-title">Top 12 — Zone Finale & Bourses CFA®</div>
      {lb.rows.slice(0, 12).map((r, i) => (
        <div key={`top-${r.name}-${i}`} className={cls('lb-row', r.me && 'me')}>
          <div className="rk">{r.rank <= 5 ? `🏅${r.rank}` : `#${r.rank}`}</div>
          <div style={{ minWidth: 0 }}>
            <div className="nm">{r.name}</div>
            <div className="firm">{r.firm}</div>
          </div>
          <div className="mono" style={{ fontSize: 10.5, color: '#8fd8ff', marginRight: 8 }}>
            {r.score} pts
          </div>
          <div className={cls('pl', signCls(r.pnl))}>{usdSign(r.pnl)}</div>
        </div>
      ))}

      <div className="section-title">Comment AmplifyME classe les candidats</div>
      <p className="hint" style={{ lineHeight: 1.6 }}>
        Contrairement à un jeu purement basé sur un coup de chance directionnel, le classement officiel
        <b> CFA Institute × AmplifyME</b> combine la performance sur les <b>deux rôles</b> (Sell-Side IB Trader + Buy-Side Asset Manager) :
        P+L généré, commissions clients, qualité d’exécution (IB vs Exchange), gestion du risque/diversification et
        <b> Fat Finger Count (0 erreur de saisie)</b>.
      </p>
    </DrawerShell>
  );
}

/* ================================================================== COACH */
export function CoachDrawer({ state, send, onClose }) {
  const c = state?.coach;
  const rs = state?.roleScore;
  if (!c) return null;
  const role = state?.role ?? 'IB';

  return (
    <DrawerShell title="◎ Performance Profile & Coach Top 10%" onClose={onClose}>
      {/* Simulation Training Settings */}
      <div className="coach-settings-bar">
        <div>
          <div style={{ fontWeight: 700, fontSize: 11, color: '#e6f6ff' }}>
            Mode d'entraînement : {state?.assistMode ? 'Guidé (Coach actif)' : 'Examen Réel (100% fidèle AmplifyME)'}
          </div>
          <div className="hint">En mode Examen, aucune aide artificielle n'est ajoutée au terminal.</div>
        </div>
        <button
          type="button"
          className={cls('btn tiny', state?.assistMode && 'primary')}
          onClick={() => send?.({ type: 'toggleAssist' })}
        >
          {state?.assistMode ? 'Passer en Mode Examen' : 'Activer Aides Coach'}
        </button>
      </div>

      <div className="row" style={{ justifyContent: 'space-between', margin: '8px 0 12px' }}>
        <span className="hint">Vitesse d'entraînement de l'horloge :</span>
        <div className="speed-group">
          {[0.5, 1, 2].map((v) => (
            <button
              key={v}
              type="button"
              className={cls('speed-btn', state?.speed === v && 'active')}
              onClick={() => send?.({ type: 'speed', value: v })}
            >
              {v}x
            </button>
          ))}
        </div>
        {state?.phase === 'round' && (
          <button
            type="button"
            className="btn tiny ghost"
            onClick={() => { send?.({ type: 'skipRound' }); onClose(); }}
          >
            Terminer ce round →
          </button>
        )}
      </div>

      <div className="section-title">
        Score AmplifyME temps réel ({role === 'IB' ? 'Investment Bank — IB 1' : 'Asset Manager — AM 1 ($20M)'}) : {rs?.total ?? 50}/100
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginBottom: 12 }}>
        {(rs?.breakdown ?? []).map((b) => (
          <div key={b.label}>
            <div className="row" style={{ justifyContent: 'space-between', fontSize: 10.5, marginBottom: 3 }}>
              <span>{b.label} <span className="dim">({b.weight})</span></span>
              <b className={cls('mono', b.score >= 75 ? 'pos' : b.score < 45 ? 'neg' : '')}>{b.score}%</b>
            </div>
            <div className={cls('amp-gauge small', b.score < 45 && 'danger')}>
              <i style={{ width: `${Math.min(100, b.score)}%` }} />
            </div>
          </div>
        ))}
      </div>

      <div className="stat-grid">
        <div className="stat"><div className="k">Fat Finger Count</div><div className={cls('v', c.fatFingers > 0 ? 'neg' : 'pos')}>{c.fatFingers}</div></div>
        <div className="stat"><div className="k">Trades Clients / IB</div><div className="v">{c.fills}</div></div>
        <div className="stat"><div className="k">Trades Exchange</div><div className="v">{c.exchangeTrades}</div></div>
        <div className="stat"><div className="k">Commission</div><div className={cls('v', role === 'IB' ? signCls(c.fees) : '')}>{money(c.fees)}</div></div>
        <div className="stat"><div className="k">Quotes Snipées</div><div className={cls('v', c.staleSniped > 0 ? 'neg' : 'pos')}>{c.staleSniped}</div></div>
        <div className="stat"><div className="k">Relances Chat</div><div className="v">{c.proactiveConversions}/{c.proactiveSales}</div></div>
      </div>

      <div className="section-title">Diagnostic en direct</div>
      {(c.tips ?? []).map((t, i) => (
        <div key={i} className={cls('tip', t.tone)}>
          <span>{t.tone === 'good' ? '✓' : t.tone === 'bad' ? '✕' : t.tone === 'warn' ? '⚠' : 'ℹ'}</span>
          <span>{t.text}</span>
        </div>
      ))}

      <div className="section-title">Contreparties actives ({role === 'IB' ? 'Clients Buy-Side' : 'Dealers Sell-Side'})</div>
      {(state?.clients ?? []).map((cl) => (
        <div key={cl.id} className="client-row">
          <div className="nm"><b>{cl.team}</b> · {cl.name}</div>
          <div className="mono dim" style={{ fontSize: 9.5 }}>{cl.label}</div>
          <div className="note">{cl.note}</div>
          <div className="num">{cl.trades} trades</div>
        </div>
      ))}
    </DrawerShell>
  );
}

/* =================================================== GUIDE CFA × AMPLIFYME */
export function HelpDrawer({ onClose, onRestart }) {
  return (
    <DrawerShell title="? Guide Officiel Top 10% — CFA × AmplifyME" onClose={onClose} width="min(620px, 95vw)">
      <div className="kicker">Préparation ciblée · Investing Simulator Challenge</div>
      <p style={{ lineHeight: 1.55 }}>
        Lors du <b>CFA Institute × AmplifyME Investing Simulator Challenge</b> (~2h en direct), vous effectuez
        <b> 2 rounds</b> en alternant les deux grands métiers de salle de marché sur cette même interface :
        <b> Investment Bank Trader (IB 1)</b> côté sell-side, et <b>Asset Manager (AM 1 — portefeuille de 20 M$)</b> côté buy-side.
      </p>

      <div className="section-title">1. Réussir le round Investment Bank (IB 1 — Sell-Side)</div>
      <div className="tip good">
        <span>1</span>
        <span>
          <b>Générez du flux et des commissions positives :</b> chaque exécution avec un client (<code>HF 1..3</code>, <code>AM 1..2</code>)
          vous rapporte une <b>Commission positive</b> (+12 bps du notionnel) qui s'ajoute directement à votre <code>Total P+L</code>.
          Ne restez pas passif : écrivez aux clients dans le Chat (ex. <i>« hi, seen the news in BP? need a price? »</i>) !
        </span>
      </div>
      <div className="tip good">
        <span>2</span>
        <span>
          <b>Cotez plus serré que l'Exchange, mais skewez après les news :</b> un client traite avec vous si votre fourchette
          <code> Bid / Offer</code> est plus attractive que la profondeur de l'<code>EXCHANGE</code> (visez ~0,5 % à 0,9 % d'écart autour du <code>REFPRICE</code>).
          Si une news haussière tombe sur <code>BP</code>, décalez immédiatement les deux bornes vers le haut !
        </span>
      </div>
      <div className="tip bad">
        <span>3</span>
        <span>
          <b>Annulez (✕) vos LIVE CHAT QUOTES dès qu'une news sort :</b> c'est le piège n°1 sur AmplifyME !
          Une quote envoyée reste active pendant 45 s dans <code>LIVE CHAT QUOTES</code>. Si le prix bondit et que votre ancienne
          offre traîne encore, le Hedge Fund vous « snipera » à perte.
        </span>
      </div>
      <div className="tip info">
        <span>4</span>
        <span>
          <b>Débouclez votre inventaire par petites tranches (Market Depth) :</b> sur le panneau <code>EXCHANGE</code>,
          tapez <code>10000</code> plutôt que <code>50000</code> pour vérifier la profondeur (<code>↵</code>). Liquider 50 000 titres d'un coup élargit
          fortement le spread ; liquider en 4–5 clips de 10 000 titres préserve votre <code>Realised P+L</code> !
        </span>
      </div>

      <div className="section-title">2. Réussir le round Asset Manager (AM 1 — Fonds de 20 M$)</div>
      <div className="tip good">
        <span>1</span>
        <span>
          <b>Construisez un portefeuille diversifié (3 à 5 valeurs) :</b> ne mettez jamais vos 20 M$ sur une seule action
          (limite de 8 M$ par ligne). Combinez des positions <b>Long</b> (achat sur catalyseurs positifs) et <b>Short</b> (vente à découvert sur mauvaises nouvelles comme une démission de CEO ou un profit warning).
        </span>
      </div>
      <div className="tip good">
        <span>2</span>
        <span>
          <b>Comparez IB Quotes vs Exchange :</b> pour un gros bloc (&gt; 2 M$, ex. 50 000 <code>BP</code> ou <code>VW</code>), cliquez sur
          <code> REQUEST QUOTE</code> auprès des banques (<code>IB 1–3</code>) puis cliquez directement sur le meilleur prix dans
          <code> LIVE CHAT QUOTES</code> : le spread est deux fois plus fin que sur l'Exchange ! Réservez l'<code>EXCHANGE</code> aux petits ordres urgents dès la première seconde d'une news.
        </span>
      </div>

      <div className="section-title">3. Règle d'or : Zéro Fat Finger (FFC = 0)</div>
      <p className="hint" style={{ lineHeight: 1.6 }}>
        AmplifyME mesure votre <b>Fat Finger Count</b> : inverser <code>Bid</code> et <code>Offer</code>, oublier une décimale
        (taper <code>580</code> au lieu de <code>58</code>) ou dépasser la taille maximale retire immédiatement des points sur votre
        profil d'évaluation. Vérifiez toujours le <code>REFPRICE</code> avant de cliquer sur <code>SEND QUOTE</code> !
      </p>

      <div className="section-title">Astuce Raccourcis Chat AmplifyME</div>
      <p className="hint" style={{ lineHeight: 1.6 }}>
        Dans la zone de saisie du Chat, vous pouvez taper directement :
        <br />• En rôle IB : <code>@quote BP 54 56 50000 50000</code>
        <br />• En rôle AM : <code>@rfq BP 50000</code>
      </p>

      <div className="modal-actions">
        <button type="button" className="btn ghost" onClick={onRestart}>Nouvelle configuration de session</button>
        <button type="button" className="btn primary" onClick={onClose}>Retourner au terminal</button>
      </div>
    </DrawerShell>
  );
}
