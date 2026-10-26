import React, { useEffect, useRef, useState } from 'react';
import { money, cls, signCls, pctSign } from '../lib/format.js';

function playFloorChime(kind = 'news') {
  try {
    if (typeof window === 'undefined') return;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(kind === 'warn' ? 660 : 880, ctx.currentTime);
    if (kind === 'news') {
      osc.frequency.exponentialRampToValueAtTime(1175, ctx.currentTime + 0.09);
    }
    gain.gain.setValueAtTime(0.06, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.22);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.23);
    setTimeout(() => { try { ctx.close(); } catch { /* ignore */ } }, 350);
  } catch {
    /* ignore audio errors */
  }
}

export default function TopBar({ state, send, onDrawer, drawer }) {
  const pnl = state?.pnl ?? { realized: 0, unrealised: 0, commission: 0, total: 0 };
  const role = state?.role ?? 'IB';
  const roleBadge = state?.roleBadge ?? 'IB 1';
  const topPct = state?.leaderboard?.topPct ?? 50;
  const topBand = Math.max(1, Math.round(100 - topPct));
  const ffc = state?.coach?.fatFingers ?? 0;

  const [squawkOn, setSquawkOn] = useState(false);
  const lastNewsRef = useRef(null);

  useEffect(() => {
    const topNews = state?.news?.[0];
    if (!topNews || topNews.id === lastNewsRef.current) return;
    lastNewsRef.current = topNews.id;
    if (squawkOn && state?.phase === 'round') {
      playFloorChime(topNews.kind === 'NOTE' ? 'warn' : 'news');
    }
  }, [state?.news?.[0]?.id, squawkOn, state?.phase]);

  const timeLeft = Math.max(0, Math.round(state?.timeLeft ?? 0));
  const mm = String(Math.floor(timeLeft / 60)).padStart(2, '0');
  const ss = String(timeLeft % 60).padStart(2, '0');

  return (
    <header className="amp-topbar">
      <div className="amp-brand" title="CFA Institute × AmplifyME Investing Simulator Training">
        <span className="amp-wordmark">A M P L I F Y</span>
        <span className="amp-tri">▼</span>
      </div>

      <div className="amp-clock">{state?.clock ?? '13:00:00'}</div>

      <div className="amp-metrics">
        <div className="amp-metric">
          <span className="amp-mlabel">Realised P+L</span>
          <span className={cls('amp-mval', signCls(pnl.realized))}>{money(pnl.realized)}</span>
        </div>

        <div className="amp-metric">
          <span className="amp-mlabel">Unrealised P+L</span>
          <span className={cls('amp-mval', signCls(pnl.unrealised))}>{money(pnl.unrealised)}</span>
        </div>

        <div className="amp-metric">
          <span className="amp-mlabel">Commission</span>
          <span
            className={cls(
              'amp-mval',
              role === 'IB' ? signCls(pnl.commission) : (pnl.commission > 0 ? 'zero-val' : 'zero-val')
            )}
            title={role === 'IB' ? 'Net IB Commission earned on client trades' : 'Execution commissions paid ($20M Fund)'}
          >
            {money(pnl.commission)}
          </span>
        </div>

        <div className="amp-metric">
          <span className="amp-mlabel">Total P+L</span>
          <span className={cls('amp-mval', signCls(pnl.total))}>{money(pnl.total)}</span>
          {role === 'AM' && pnl.roiPct != null && (
            <span className={cls('amp-roi-pill', signCls(pnl.total))} title="Return on $20,000,000 Asset Management Mandate">
              {pctSign(pnl.roiPct, 2)}
            </span>
          )}
        </div>
      </div>

      <div className="spacer" />

      {/* Round timer & simulation controls */}
      <div className="amp-sim-strip">
        <span className={cls('amp-role-tag', role === 'AM' && 'am')} title={role === 'IB' ? 'Sell-Side Investment Bank Market Maker' : 'Buy-Side $20M Asset Manager'}>
          R{state?.round || 1}/{state?.roundsTotal || 2} · {roleBadge}
          {state?.phase === 'round' ? ` · ${mm}:${ss}` : ''}
        </span>

        {ffc > 0 && (
          <span className="amp-ffc-badge" title="Fat Finger Count — clerical errors penalize your AmplifyME score!">
            FFC {ffc}
          </span>
        )}

        <button
          type="button"
          className={cls('amp-tool-btn', topBand <= 10 && 'top10', drawer === 'leaderboard' && 'active')}
          onClick={() => onDrawer('leaderboard')}
          title="Global CFA × AmplifyME Leaderboard (Shortcut: K)"
        >
          🏆 Top {topBand}%
        </button>

        <button
          type="button"
          className={cls('amp-tool-btn', drawer === 'coach' && 'active')}
          onClick={() => onDrawer('coach')}
          title="AmplifyME Score Breakdown & Real-Time Coach"
        >
          ◎ Score {state?.roleScore?.total ?? 50}
        </button>

        <button
          type="button"
          className={cls('amp-tool-btn hide-sm', state?.paused && 'active')}
          onClick={() => send({ type: 'pause' })}
          title="Pause / Resume simulation (Space)"
        >
          {state?.paused ? '▶' : '❚❚'}
        </button>
      </div>

      {/* AmplifyME Live Floor Audio Squawk Player (exact match to image-1.png) */}
      <button
        type="button"
        className={cls('amp-audio-pill', squawkOn && 'on')}
        onClick={() => {
          const next = !squawkOn;
          setSquawkOn(next);
          if (next) playFloorChime('news');
        }}
        title="Live Trading Floor Audio Alerts (chimes on breaking news & 1-min warning)"
      >
        <span className="play-ico">{squawkOn ? '❚❚' : '▶'}</span>
        <span className="audio-bar">
          <i style={{ width: `${Math.round((state?.progress ?? 0) * 100)}%` }} />
        </span>
        <span className="spk-ico">{squawkOn ? '🔊' : '🔈'}</span>
      </button>

      {/* AmplifyME User / Role Profile Block (exact match to image-1.png) */}
      <div className="amp-user-box">
        <div className="amp-avatar" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
            <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z" />
          </svg>
        </div>
        <div className="amp-user-meta">
          <div className="amp-user-line1">
            {state?.nickname || 'ib1test1'} / (all roles) / <b>{roleBadge}</b>
          </div>
          <div className="amp-user-line2">
            Single User Mode
            <button
              type="button"
              className="amp-qmark"
              onClick={() => onDrawer('help')}
              title="CFA × AmplifyME Rules & Top 10% Playbook"
            >
              ?
            </button>
          </div>
        </div>
      </div>

      <button
        type="button"
        className="amp-exit-btn"
        onClick={() => send({ type: 'restart' })}
        title="New Session / Change Role Mode"
      >
        ↪
      </button>
    </header>
  );
}
