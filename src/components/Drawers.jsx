import React from 'react';
import { cls, money, pct, usd } from '../lib/format.js';
import { GaugeGrid, ScoreRing, gaugeColor } from './Gauge.jsx';
import { GAUGE_DEFS, LINKS, TOP1_TARGET } from '../lib/scoring.js';

function DrawerShell({ title, kicker, onClose, children, wide = false }) {
  return (
    <div className="drawer-backdrop" onClick={onClose} role="presentation">
      <aside className={cls('drawer', wide && 'wide')} onClick={(e) => e.stopPropagation()}>
        <header className="drawer-head">
          <div>
            <div className="kicker">{kicker}</div>
            <h2>{title}</h2>
          </div>
          <button type="button" className="modal-x" onClick={onClose} aria-label="Fermer">✕</button>
        </header>
        <div className="drawer-body">{children}</div>
      </aside>
    </div>
  );
}

/* ============================================================ COACH TEMPS RÉEL */
export function CoachDrawer({ state, onClose, onGuide }) {
  const role = state?.role ?? 'IB';
  const score = state?.roleScore?.total ?? 0;
  const gauges = state?.roleScore?.gauges ?? [];
  const tips = state?.coach?.tips ?? [];
  const stats = state?.coach?.stats ?? {};
  const isIB = role === 'IB';

  return (
    <DrawerShell title="Coach temps réel" kicker={`${state?.roleBadge ?? 'IB-55'} · JAUGES AMPLIFYME`} onClose={onClose}>
      <div className="coach-top">
        <ScoreRing score={score} size={118} label="GLOBAL" />
        <div className="coach-stats">
          {isIB ? (
            <>
              <div><span>Chat trades</span><b className="mono">{stats.clientFills ?? 0}</b></div>
              <div><span>Notionnel OTC</span><b className="mono">{usd(stats.clientNotional ?? 0)}</b></div>
              <div><span>Spread moyen</span><b className="mono">{state?.roleScore?.gauges?.find((g) => g.code === 'SSRM')?.detail?.match(/Spread moyen (\d+)/)?.[1] ?? '—'} bps</b></div>
              <div><span>Expo nette</span><b className="mono">{usd(stats.netExposure ?? 0)}</b></div>
            </>
          ) : (
            <>
              <div><span>Cash</span><b className={cls('mono', (stats.cashPct ?? 0) < 5 ? 'neg' : '')}>{pct(stats.cashPct ?? 0, 1)}</b></div>
              <div><span>Max ligne</span><b className={cls('mono', (stats.maxWeightPct ?? 0) > 25 ? 'neg' : '')}>{pct(stats.maxWeightPct ?? 0, 1)}</b></div>
              <div><span>Coût exéc.</span><b className="mono">{stats.avgSlippageBps != null ? `${stats.avgSlippageBps} bps` : '—'}</b></div>
              <div><span>Trades dealers</span><b className="mono">{stats.amDealerTrades ?? 0}</b></div>
            </>
          )}
          <div><span>Fat fingers</span><b className={cls('mono', stats.fatFingers ? 'neg' : 'pos')}>{stats.fatFingers ?? 0}</b></div>
          <div><span>Top 1 %</span><b className="mono amber">≥ {TOP1_TARGET} %</b></div>
        </div>
      </div>

      <GaugeGrid gauges={gauges} size={80} />

      <div className="coach-gap">
        {score >= TOP1_TARGET
          ? 'Vous êtes dans la zone Top 1 %. Tenez la discipline jusqu’au gong final.'
          : `Il manque ${TOP1_TARGET - score} points. Corrigez les jauges rouges ci-dessous.`}
      </div>

      <h3 className="drawer-sub">Conseils en direct</h3>
      <div className="tips-block tight">
        {tips.map((t, i) => (
          <div key={i} className={cls('tip', t.tone)}>
            <span>{t.tone === 'good' ? '✓' : t.tone === 'bad' ? '✕' : '!'}</span>
            <p>{t.text}</p>
          </div>
        ))}
        {!tips.length && <p className="dim">Aucune alerte. Continuez à coter / exécuter proprement.</p>}
      </div>

      <h3 className="drawer-sub">Détail des jauges</h3>
      <div className="gauge-details compact">
        {gauges.map((g) => (
          <div key={g.code} className="gd-row">
            <span className="gd-code" style={{ color: gaugeColor(g.score) }}>{g.code}</span>
            <span className="gd-bar"><i style={{ width: `${g.score}%`, background: gaugeColor(g.score) }} /></span>
            <span className="gd-score mono">{g.score}%</span>
            <span className="gd-detail">{g.detail}</span>
          </div>
        ))}
      </div>

      <button type="button" className="btn block" onClick={onGuide}>📄 Télécharger le Guide PDF Top 1 %</button>
    </DrawerShell>
  );
}

/* =================================================================== HELP */
export function HelpDrawer({ state, onClose, onRestart, onGuide }) {
  const role = state?.role ?? 'IB';
  return (
    <DrawerShell title="Règles & barème officiel" kicker="CFA INSTITUTE × AMPLIFYME" onClose={onClose} wide>
      <p className="drawer-lead">
        Deux exercices, deux mandats. Le score composite repose sur <b>6 jauges en IB-55</b> et <b>5 jauges en AM-55</b>.
        Le P&amp;L seul ne suffit pas : la gestion du risque pèse la moitié du score — c’est exactement le piège du REX
        « 53 % avec +$743k ».
      </p>

      <div className="help-cols">
        <div className="help-col">
          <h3>IB-55 — Market Maker Sell-Side</h3>
          <ul className="rules-list">
            <li><b>CHAT :</b> répondez aux RFQ clients avec le <b>Quote Ticket</b> (bid = client sell, offer = client buy).</li>
            <li><b>LIVE CHAT QUOTES :</b> annulez vos quotes dès qu’une news tombe, sinon elles sont snipées.</li>
            <li><b>EXCHANGE :</b> débouclez l’inventaire par clips de 5k–10k ; vider 60k d’un coup coûte très cher.</li>
            <li><b>SSRM :</b> visez 20–80 bps de fourchette autour du REFPRICE ; 425/469 sur 445 = 494 bps → 0.</li>
            <li><b>ETM :</b> gardez une exposition nette &lt; $3M ; -$4.8M non couvert = jauge détruite.</li>
          </ul>
          {GAUGE_DEFS.IB.map((g) => (
            <div key={g.code} className="gp-row help"><b>{g.code}</b><span>{g.short}</span><em>{g.weight}%</em></div>
          ))}
        </div>
        <div className="help-col">
          <h3>AM-55 — Asset Manager $20M</h3>
          <ul className="rules-list">
            <li><b>CHAT :</b> demandez un prix à plusieurs banques (IB-2 → IB-57) avant d’exécuter.</li>
            <li><b>LIVE CHAT QUOTES :</b> SELL / BUY en 1 clic sur la meilleure quote ; l’Exchange est plus large.</li>
            <li><b>BSRM :</b> gardez 5–15 % de cash, 5–15 % par ligne, 4–5 valeurs, 10–35 trades.</li>
            <li><b>ES :</b> exécutez au plus près du REFPRICE via les quotes dealers.</li>
            <li><b>RA / ROI :</b> prenez du risque aligné avec les news pour viser +2 % sur $20M.</li>
          </ul>
          {GAUGE_DEFS.AM.map((g) => (
            <div key={g.code} className="gp-row help"><b>{g.code}</b><span>{g.short}</span><em>{g.weight}%</em></div>
          ))}
        </div>
      </div>

      <h3 className="drawer-sub">Raccourcis clavier</h3>
      <div className="shortcuts">
        <span><kbd>Espace</kbd> pause</span>
        <span><kbd>C</kbd> coach</span>
        <span><kbd>K</kbd> leaderboard</span>
        <span><kbd>H</kbd> couvrir la plus grosse position</span>
        <span><kbd>?</kbd> aide</span>
      </div>

      <h3 className="drawer-sub">Liens</h3>
      <ul className="links-list">
        <li><a href={LINKS.github} target="_blank" rel="noreferrer">Code source — GitHub</a></li>
        <li><a href={LINKS.render} target="_blank" rel="noreferrer">Version déployée — Render</a></li>
        <li><button type="button" className="link-btn" onClick={onGuide}>📄 Guide PDF Top 1 % (français)</button></li>
        <li><a href="https://flow936161.amplifyme.com/#main" target="_blank" rel="noreferrer">Plateforme officielle AmplifyME (session live)</a></li>
      </ul>

      <div className="help-actions">
        <button type="button" className="btn ghost" onClick={onRestart}>↻ Nouvelle session</button>
        <button type="button" className="btn primary" onClick={onClose}>Compris</button>
      </div>
      <p className="disclaimer">
        Simulateur pédagogique indépendant, non affilié au CFA Institute ou à AmplifyME. Rôle actif : {role === 'IB' ? 'IB-55' : 'AM-55'}.
      </p>
    </DrawerShell>
  );
}

/* ============================================================== LEADERBOARD */
export function LeaderboardDrawer({ state, onClose }) {
  const lb = state?.leaderboard;
  if (!lb) return null;
  const rows = lb.rows ?? [];
  const meInRows = rows.some((r) => r.me);
  const around = (lb.around ?? []).filter((r) => !rows.some((x) => x.rank === r.rank));
  const topBand = Math.max(1, Math.round(100 - (lb.topPct ?? 0)));

  return (
    <DrawerShell title="Leaderboard mondial" kicker={`${lb.total} CANDIDATS · CFA × AMPLIFYME`} onClose={onClose} wide>
      <div className="lb-summary">
        <div><span>Votre rang</span><b>#{lb.rank}</b></div>
        <div><span>Top</span><b>{topBand}%</b></div>
        <div><span>Score</span><b>{lb.myScore}%</b></div>
        <div><span>P&amp;L</span><b>{usd(lb.myPnl)}</b></div>
      </div>
      <table className="data-table lb-table">
        <thead>
          <tr><th>#</th><th>NAME</th><th>UNIVERSITY</th><th className="num">SCORE</th><th className="num">P&amp;L</th></tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={`${r.rank}-${r.name}`} className={cls(r.me && 'me')}>
              <td className="mono">{r.rank}</td>
              <td>{r.name}</td>
              <td className="dim">{r.firm}</td>
              <td className="num mono" style={{ color: gaugeColor(r.score) }}>{r.score}%</td>
              <td className={cls('num mono', r.pnl > 0 ? 'pos' : r.pnl < 0 ? 'neg' : '')}>{money(r.pnl)}</td>
            </tr>
          ))}
          {!meInRows && around.length > 0 && (
            <>
              <tr className="lb-sep"><td colSpan={5}>…</td></tr>
              {around.map((r) => (
                <tr key={`a-${r.rank}-${r.name}`} className={cls(r.me && 'me')}>
                  <td className="mono">{r.rank}</td>
                  <td>{r.name}</td>
                  <td className="dim">{r.firm}</td>
                  <td className="num mono" style={{ color: gaugeColor(r.score) }}>{r.score}%</td>
                  <td className={cls('num mono', r.pnl > 0 ? 'pos' : r.pnl < 0 ? 'neg' : '')}>{money(r.pnl)}</td>
                </tr>
              ))}
            </>
          )}
        </tbody>
      </table>
      <p className="lb-note">
        Classement par score composite, puis par P&amp;L. Seuil Top 1 % actuel : <b>{lb.scoreThreshold ?? 90} %</b>.
        Objectif : <b>≥ 90 %</b> sur les deux exercices.
      </p>
    </DrawerShell>
  );
}
