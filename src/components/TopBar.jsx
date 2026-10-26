import React from 'react';
import { usd, usdSign, cls, signCls, num } from '../lib/format.js';

export default function TopBar({ state, send, onDrawer, drawer, connected }) {
  const pnl = state?.pnl ?? { realized: 0, unrealised: 0, fees: 0, total: 0 };
  const p = state?.progress ?? 0;
  const topPct = state?.leaderboard?.topPct ?? 0;
  const rank = state?.leaderboard?.rank ?? 0;
  const topBand = Math.max(1, Math.round(100 - topPct));

  return (
    <div className="topbar">
      <div className="brand">
        <div className="brand-mark">T</div>
        <div>
          <div className="brand-name">TRADELAB</div>
          <div className="brand-sub">Market Making Desk</div>
        </div>
      </div>

      <div className="clock">{state?.clock ?? '--:--:--'}</div>

      <div className="metric">
        <span className="metric-label">Realised P&amp;L</span>
        <span className={cls('metric-value', signCls(pnl.realized))}>{usd(pnl.realized)}</span>
      </div>
      <div className="metric">
        <span className="metric-label">Unrealised P&amp;L</span>
        <span className={cls('metric-value', signCls(pnl.unrealised))}>{usd(pnl.unrealised)}</span>
      </div>
      <div className="metric hide-md">
        <span className="metric-label">Commission</span>
        <span className="metric-value small" style={{ color: 'var(--text-dim)' }}>{usd(pnl.fees)}</span>
      </div>
      <div className="metric">
        <span className="metric-label">Total P&amp;L</span>
        <span className={cls('metric-value', signCls(pnl.total))} style={{ fontSize: 15, fontWeight: 700 }}>
          {usdSign(pnl.total)}
        </span>
      </div>

      <div className="spacer" />

      <div className="rounds">
        {Array.from({ length: state?.roundsTotal ?? 3 }).map((_, i) => {
          const n = i + 1;
          const isDone = (state?.round ?? 0) > n || state?.phase === 'done';
          const isActive = state?.round === n && state?.phase === 'round';
          return (
            <div key={n} className={cls('round-chip', isDone && 'done', isActive && 'active')}>
              {isDone ? '✓' : n}
            </div>
          );
        })}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'var(--muted)', letterSpacing: 0.6 }}>
          <span>{state?.phase === 'round' ? `ROUND ${state.round}` : state?.phase === 'break' ? 'PAUSE' : state?.phase === 'done' ? 'TERMINÉ' : 'BRIEFING'}</span>
          <span className="mono">{state?.phase === 'round' ? `${num(state.timeLeft, 0)} s` : ''}</span>
        </div>
        <div className="progress-track">
          <div className="progress-fill" style={{ width: `${Math.round(p * 100)}%` }} />
        </div>
      </div>

      <div className="rank-badge" title="Classement en temps réel (percentile sur l'ensemble des participants)">
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span className="metric-label">Classement</span>
          <span className="mono tiny-text" style={{ color: 'var(--text-dim)' }}>#{rank} / {state?.leaderboard?.total ?? '—'}</span>
        </div>
        <div className="big">TOP {topBand}%</div>
      </div>

      <div className="speed-group" title="Vitesse de la simulation">
        {[0.5, 1, 2].map((v) => (
          <button
            key={v}
            className={cls('speed-btn', state?.speed === v && 'active')}
            onClick={() => send({ type: 'speed', value: v })}
          >{v}x</button>
        ))}
      </div>

      <button className={cls('topbar-btn', state?.paused && 'active')} onClick={() => send({ type: 'pause' })} title="Pause (Espace)">
        {state?.paused ? '▶' : '❚❚'}
      </button>

      <button className={cls('topbar-btn', drawer === 'leaderboard' && 'active')} onClick={() => onDrawer('leaderboard')} title="Classement (K)">
        🏆<span className="hide-md"> Classement</span>
      </button>
      <button className={cls('topbar-btn', drawer === 'coach' && 'active')} onClick={() => onDrawer('coach')} title="Coach">
        ◎<span className="hide-md"> Coach</span>
      </button>
      <button className={cls('topbar-btn', drawer === 'help' && 'active')} onClick={() => onDrawer('help')} title="Méthode & règles">
        ?<span className="hide-md"> Méthode</span>
      </button>
    </div>
  );
}
