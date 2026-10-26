import React, { useCallback, useEffect, useState } from 'react';
import { useSocket } from './hooks/useSocket.js';
import TopBar from './components/TopBar.jsx';
import { EquitiesPanel, NewsPanel, PositionsPanel, ChatPanel } from './components/Panels.jsx';
import RfqPanel from './components/RfqPanel.jsx';
import ChartPanel, { ExchangePanel } from './components/ChartPanel.jsx';
import { LeaderboardDrawer, CoachDrawer, HelpDrawer } from './components/Drawers.jsx';
import { Briefing, Debrief, Final } from './components/Modals.jsx';
import { cls, usdSign } from './lib/format.js';

export default function App() {
  const { state, connected, send, notify, toasts } = useSocket();
  const [drawer, setDrawer] = useState(null);
  const [debriefDismissed, setDebriefDismissed] = useState(false);
  const [finalDismissed, setFinalDismissed] = useState(false);
  const [activeRoom, setActiveRoom] = useState('hf1test1');
  const [selectedTicker, setSelectedTicker] = useState('BP');
  const [prefill, setPrefill] = useState(null);

  const phase = state?.phase;
  const round = state?.round;
  const role = state?.role;

  useEffect(() => {
    if (phase === 'round') {
      setDebriefDismissed(false);
      setFinalDismissed(false);
    }
  }, [phase, round]);

  // Switch default active chat room when role rotates between IB and AM
  useEffect(() => {
    if (role === 'IB') setActiveRoom('hf1test1');
    else if (role === 'AM') setActiveRoom('ib1test1');
  }, [role, round]);

  useEffect(() => {
    if (state?.chart?.ticker && state.chart.ticker !== selectedTicker) {
      setSelectedTicker(state.chart.ticker);
    }
  }, [state?.chart?.ticker]);

  const handlePrefillQuote = useCallback((ticker, qty, roomId) => {
    if (roomId) setActiveRoom(roomId);
    if (ticker) {
      setSelectedTicker(ticker);
      send({ type: 'chart', ticker });
    }
    setPrefill({ ticker, qty, ts: Date.now() });
  }, [send]);

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e) => {
      const tag = (e.target?.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'select' || tag === 'textarea') return;
      if (tag === 'button' && e.code === 'Space') return;
      if (e.key === 'Escape') { setDrawer(null); return; }
      if (!state) return;
      if (e.code === 'Space') {
        e.preventDefault();
        send({ type: 'pause' });
      } else if (e.key.toLowerCase() === 'h') {
        const biggest = [...(state.positions ?? [])]
          .filter((p) => p.qty !== 0)
          .sort((a, b) => Math.abs(b.notional) - Math.abs(a.notional))[0];
        if (biggest) send({ type: 'hedge', ticker: biggest.ticker });
        else notify('No open position to unwind', 'err');
      } else if (e.key.toLowerCase() === 'k') {
        setDrawer((d) => (d === 'leaderboard' ? null : 'leaderboard'));
      } else if (e.key.toLowerCase() === 'c') {
        setDrawer((d) => (d === 'coach' ? null : 'coach'));
      } else if (e.key === '?') {
        setDrawer((d) => (d === 'help' ? null : 'help'));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [state, send, notify]);

  const showDebrief = Boolean(state?.debrief?.open) && !debriefDismissed && phase !== 'briefing';
  const showFinal = phase === 'done' && state?.final && !finalDismissed && !showDebrief;

  return (
    <div className="amp-app">
      <TopBar
        state={state}
        send={send}
        drawer={drawer}
        onDrawer={(d) => setDrawer((cur) => (cur === d ? null : d))}
        connected={connected}
      />

      {/* AmplifyME 2-Row Workspace: Top 3 panels + Bottom 4 panels */}
      <main className="amp-workspace">
        <div className="amp-row-top">
          <EquitiesPanel
            state={state}
            send={send}
            onSelectTicker={setSelectedTicker}
          />
          <NewsPanel
            state={state}
            send={send}
            onSelectTicker={setSelectedTicker}
          />
          <PositionsPanel
            state={state}
            send={send}
            onSelectTicker={setSelectedTicker}
          />
        </div>

        <div className="amp-row-bottom">
          <ChatPanel
            state={state}
            send={send}
            activeRoom={activeRoom}
            onSelectRoom={setActiveRoom}
            onPrefillQuote={handlePrefillQuote}
          />
          <RfqPanel
            state={state}
            send={send}
            activeRoom={activeRoom}
            onSelectRoom={setActiveRoom}
            selectedTicker={selectedTicker}
            onSelectTicker={setSelectedTicker}
            prefill={prefill}
          />
          <ExchangePanel
            state={state}
            send={send}
            selectedTicker={selectedTicker}
            onSelectTicker={setSelectedTicker}
          />
          <ChartPanel
            state={state}
            send={send}
            onSelectTicker={setSelectedTicker}
          />
        </div>
      </main>

      {!state && (
        <div className="modal-wrap">
          <div className="modal" style={{ textAlign: 'center', width: 380 }}>
            <h2 style={{ letterSpacing: 3 }}>A M P L I F Y ▼</h2>
            <p className="hint">Connecting to market simulation engine…</p>
          </div>
        </div>
      )}

      {state && phase === 'briefing' && (
        <Briefing state={state} send={send} connected={connected} />
      )}

      {showDebrief && (
        <Debrief
          state={state}
          send={send}
          onClose={() => setDebriefDismissed(true)}
        />
      )}

      {showFinal && (
        <Final
          state={state}
          send={send}
          onRestart={() => { setFinalDismissed(false); send({ type: 'restart' }); }}
          onLeaderboard={() => { setFinalDismissed(true); setDrawer('leaderboard'); }}
        />
      )}

      {phase === 'break' && !showDebrief && (
        <div className="round-cta">
          <div>
            <div className="kicker" style={{ marginBottom: 2 }}>Round {state.round} ended</div>
            <div className="mono" style={{ fontSize: 11, color: 'var(--muted)' }}>
              Session P+L {usdSign(state.pnl.sessionTotal ?? state.pnl.total)} · Top {Math.max(1, Math.round(100 - state.leaderboard.topPct))}%
            </div>
          </div>
          <button type="button" className="btn ghost" onClick={() => setDebriefDismissed(false)}>
            Debrief
          </button>
          <button type="button" className="btn primary" onClick={() => send({ type: 'nextRound' })}>
            {state.round >= state.roundsTotal ? 'Final Result' : `▶ Start Round ${state.round + 1}`}
          </button>
        </div>
      )}

      {phase === 'done' && finalDismissed && (
        <button
          type="button"
          className="btn primary"
          style={{ position: 'fixed', bottom: 18, left: '50%', transform: 'translateX(-50%)', zIndex: 40 }}
          onClick={() => setFinalDismissed(false)}
        >
          View Final Challenge Result
        </button>
      )}

      {drawer === 'leaderboard' && <LeaderboardDrawer state={state} onClose={() => setDrawer(null)} />}
      {drawer === 'coach' && <CoachDrawer state={state} send={send} onClose={() => setDrawer(null)} />}
      {drawer === 'help' && (
        <HelpDrawer
          state={state}
          onClose={() => setDrawer(null)}
          onRestart={() => { setDrawer(null); send({ type: 'restart' }); }}
        />
      )}

      <div className="toasts">
        {toasts.map((t) => (
          <div key={t.id} className={cls('toast', t.kind)}>{t.text}</div>
        ))}
      </div>
    </div>
  );
}
