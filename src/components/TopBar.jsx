import React from 'react';
import { cls, money, shares, mmss } from '../lib/format.js';

function Metric({ label, value, tone = '', extra = null, small = false }) {
  return (
    <div className={cls('top-metric', small && 'small')}>
      <span className="tm-label">{label}</span>
      <span className={cls('tm-value mono', tone)}>{value}</span>
      {extra}
    </div>
  );
}

function SoundControl({ muted, volume, onToggle, onVolume }) {
  return (
    <div className="sound-ctrl" title="Bruitage salle de marché — Web Audio">
      <button
        type="button"
        className={cls('icon-btn sound-btn', !muted && 'on')}
        onClick={onToggle}
        aria-label={muted ? 'Unmute market floor audio' : 'Mute market floor audio'}
      >
        {muted ? '🔇' : '🔊'}
      </button>
      <input
        type="range"
        min="0"
        max="100"
        value={Math.round(volume * 100)}
        onChange={(e) => onVolume(Number(e.target.value) / 100)}
        className="vol-slider"
        aria-label="Volume"
        title={`Volume ${Math.round(volume * 100)}%`}
      />
    </div>
  );
}

function UserBadge({ state, onHelp }) {
  const role = state?.role ?? 'IB';
  const badge = state?.roleBadge ?? 'IB-55';
  const name = state?.nickname || 'Calvin MINANG';
  const roleText = role === 'AM' ? 'Asset Manager' : '(all roles)';
  const initials = name.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase();
  return (
    <div className="user-badge">
      <div className="avatar">{initials || 'CM'}</div>
      <div className="ub-meta">
        <div className="ub-name" title={name}>{name}</div>
        <div className="ub-role">/ {roleText} / <b>{badge}</b></div>
      </div>
      <button type="button" className="qmark" onClick={onHelp} title="Aide, règles & barème">?</button>
    </div>
  );
}

export default function TopBar({
  state, send, drawer, onDrawer, connected,
  audioMuted, audioVolume, onToggleMute, onVolume, onGuide,
}) {
  const role = state?.role ?? 'IB';
  const pnl = state?.pnl ?? {};
  const risk = state?.risk ?? {};
  const score = state?.roleScore?.total ?? 0;
  const paused = Boolean(state?.paused);
  const timeLeft = state?.timeLeft ?? 0;
  const progress = state?.progress ?? 0;

  const handleRestart = () => {
    if (typeof window !== 'undefined' && !window.confirm('Quitter la session en cours et revenir au briefing ?')) return;
    send({ type: 'restart' });
  };

  const segment = cls('topbar', role === 'AM' ? 'am' : 'ib');

  const clockBlock = (
    <div className="clock-block">
      <div className="brand-inline">
        {/* eslint-disable-next-line jsx-a11y/alt-text */}
        <div className="av-logo" title="AmplifyME">AV</div>
        <div className="brand-word">
          <b>AmplifyME</b>
          <small>CFA Institute Challenge</small>
        </div>
        <span className={cls('conn-dot', connected ? 'ok' : 'bad')} title={connected ? 'Connected' : 'Reconnecting…'} />
      </div>
      <div className="clock-line">
        <span className="clock mono">{state?.clock ?? '13:00:00'}</span>
        <span className="round-line mono">
          R{state?.round ?? 1}/{state?.roundsTotal ?? 2} · {mmss(timeLeft)}
        </span>
      </div>
      <div className="time-bar"><i style={{ width: `${Math.round(progress * 100)}%` }} /></div>
    </div>
  );

  const controls = (
    <div className="top-controls">
      <button
        type="button"
        className={cls('icon-btn', drawer === 'coach' && 'active')}
        onClick={() => onDrawer('coach')}
        title="Coach temps réel & jauges de score (C)"
      >
        ◎
      </button>
      <span className={cls('score-chip', score >= 90 ? 'elite' : score >= 70 ? 'good' : score >= 50 ? 'mid' : 'low')} title="Score global AmplifyME">
        {score}%
      </span>
      <button type="button" className={cls('icon-btn', paused && 'active')} onClick={() => send({ type: 'pause' })} title="Pause / Reprendre (Espace)">
        {paused ? '▶' : '||'}
      </button>
      <SoundControl muted={audioMuted} volume={audioVolume} onToggle={onToggleMute} onVolume={onVolume} />
      <button type="button" className="icon-btn guide-ico" onClick={onGuide} title="Guide PDF Top 1%">📄</button>
      <button type="button" className="icon-btn" onClick={handleRestart} title="Nouvelle session">↻</button>
    </div>
  );

  if (role === 'AM') {
    const cash = pnl.cashAvailable ?? 0;
    const net = risk.net ?? 0;
    return (
      <header className={segment}>
        <div className="am-row1">
          {clockBlock}
          <div className="top-metrics six">
            <Metric label="Shares Owned" value={shares(pnl.sharesOwned ?? 0)} />
            <Metric label="Realised P+L" value={money(pnl.realized)} tone={pnl.realized > 0 ? 'pos' : pnl.realized < 0 ? 'neg' : ''} />
            <Metric label="Unrealised P+L" value={money(pnl.unrealised)} tone={pnl.unrealised > 0 ? 'pos' : pnl.unrealised < 0 ? 'neg' : ''} />
            <Metric label="Available cash" value={`$${money(cash)}`} tone={cash < 2000000 ? 'neg' : ''} />
            <Metric label="Total PnL" value={money(pnl.total)} tone={pnl.total > 0 ? 'pos' : pnl.total < 0 ? 'neg' : ''} />
            <Metric
              label="Portfolio Value"
              value={`$${money(pnl.portfolioValue ?? 0)}`}
              tone={(pnl.portfolioValue ?? 0) >= 20000000 ? 'pos' : 'neg'}
              extra={pnl.roiPct != null ? <span className={cls('roi-pill', pnl.roiPct >= 0 ? 'pos' : 'neg')}>{pnl.roiPct >= 0 ? '+' : ''}{pnl.roiPct}%</span> : null}
            />
          </div>
          {controls}
        </div>
        <div className="am-row2">
          <div className="net-exposure">
            <span className="tm-label">Net Exposure</span>
            <span className={cls('mono ne-value', net > 0 ? 'pos' : net < 0 ? 'neg' : '')}>
              {net > 0 ? '+' : net < 0 ? '-' : ''}${money(Math.abs(net))}
            </span>
            <span className="ne-pct mono">({(risk.netPct ?? 0) > 0 ? '+' : ''}{risk.netPct ?? 0}% du fonds)</span>
          </div>
          <div className="am-row2-spacer" />
          <UserBadge state={state} onHelp={() => onDrawer('help')} />
        </div>
      </header>
    );
  }

  const net = risk.net ?? 0;
  return (
    <header className={segment}>
      {clockBlock}
      <div className="top-metrics five">
        <Metric label="Realised P+L" value={money(pnl.realized)} tone={pnl.realized > 0 ? 'pos' : pnl.realized < 0 ? 'neg' : ''} />
        <Metric label="Unrealised P+L" value={money(pnl.unrealised)} tone={pnl.unrealised > 0 ? 'pos' : pnl.unrealised < 0 ? 'neg' : ''} />
        <Metric
          label="Net Exposure"
          value={`${net > 0 ? '+' : net < 0 ? '-' : ''}$${money(Math.abs(net))}`}
          tone={Math.abs(net) > 3000000 ? 'neg' : net > 0 ? 'pos' : net < 0 ? 'neg' : ''}
        />
        <Metric label="Commission" value={money(pnl.commission)} tone={pnl.commission > 0 ? 'pos' : pnl.commission < 0 ? 'neg' : ''} />
        <Metric label="Total P+L" value={money(pnl.total)} tone={pnl.total > 0 ? 'pos' : pnl.total < 0 ? 'neg' : ''} />
      </div>
      <div className="top-controls">
        <button type="button" className={cls('icon-btn', paused && 'active')} onClick={() => send({ type: 'pause' })} title="Pause / Reprendre (Espace)">
          {paused ? '▶' : '||'}
        </button>
        <SoundControl muted={audioMuted} volume={audioVolume} onToggle={onToggleMute} onVolume={onVolume} />
        <button
          type="button"
          className={cls('icon-btn', drawer === 'coach' && 'active')}
          onClick={() => onDrawer('coach')}
          title="Coach temps réel & jauges de score (C)"
        >
          ◎
        </button>
        <span className={cls('score-chip', score >= 90 ? 'elite' : score >= 70 ? 'good' : score >= 50 ? 'mid' : 'low')} title="Score global AmplifyME">
          {score}%
        </span>
        <button type="button" className="icon-btn guide-ico" onClick={onGuide} title="Guide PDF Top 1%">📄</button>
        <button type="button" className="icon-btn" onClick={handleRestart} title="Nouvelle session">↻</button>
      </div>
      <UserBadge state={state} onHelp={() => onDrawer('help')} />
    </header>
  );
}
