import React, { useEffect, useMemo, useState } from 'react';
import { useSocket } from './hooks/useSocket.js';
import TopBar from './components/TopBar.jsx';
import { EquitiesPanel, NewsPanel, PositionsPanel, ChatPanel } from './components/Panels.jsx';
import RfqPanel from './components/RfqPanel.jsx';
import ChartPanel, { ExchangePanel } from './components/ChartPanel.jsx';
import { LeaderboardDrawer, CoachDrawer, HelpDrawer } from './components/Drawers.jsx';
import { Briefing, Debrief, Final } from './components/Modals.jsx';
import { cls, usdSign, money } from './lib/format.js';

export default function App() {
  const { state, connected, send, notify, toasts } = useSocket();
  const [drawer, setDrawer] = useState(null);
  const [debriefDismissed, setDebriefDismissed] = useState(false);
  const [finalDismissed, setFinalDismissed] = useState(false);

  const phase = state?.phase;
  const round = state?.round;

  useEffect(() => {
    if (phase === 'round') { setDebriefDismissed(false); setFinalDismissed(false); }
  }, [phase, round]);

  // raccourcis clavier
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
        const biggest = [...(state.positions ?? [])].sort((a, b) => Math.abs(b.qty * b.mark) - Math.abs(a.qty * a.mark))[0];
        if (biggest) send({ type: 'hedge', ticker: biggest.ticker });
        else notify('Aucune position à couvrir', 'err');
      } else if (e.key.toLowerCase() === 'p') {
        if (state.rfq) send({ type: 'pass', rfqId: state.rfq.id });
      } else if (['1', '2', '3'].includes(e.key)) {
        send({ type: 'speed', value: [0.5, 1, 2][Number(e.key) - 1] });
      } else if (e.key.toLowerCase() === 'k') {
        setDrawer((d) => (d === 'leaderboard' ? null : 'leaderboard'));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [state, send, notify]);

  const showDebrief = Boolean(state?.debrief?.open) && !debriefDismissed && phase !== 'briefing';
  const showFinal = phase === 'done' && state?.final && !finalDismissed && !showDebrief;

  const status = useMemo(() => {
    if (!state) return 'connexion au moteur…';
    if (phase === 'briefing') return 'en attente de démarrage';
    if (phase === 'round') return `round ${round}/${state.roundsTotal} — marché ouvert`;
    if (phase === 'break') return `round ${round} terminé`;
    return 'session terminée';
  }, [state, phase, round]);

  return (
    <div className="app">
      <TopBar
        state={state}
        send={send}
        drawer={drawer}
        onDrawer={(d) => setDrawer((cur) => (cur === d ? null : d))}
        connected={connected}
      />

      <div className="workspace">
        <EquitiesPanel state={state} send={send} />
        <NewsPanel state={state} />
        <PositionsPanel state={state} send={send} />
        <ChatPanel state={state} send={send} />
        <div className="area-rfq" style={{ display: 'flex', flexDirection: 'column', gap: 7, minHeight: 0, minWidth: 0 }}>
          <RfqPanel state={state} send={send} />
        </div>
        <div className="area-chart" style={{ display: 'flex', flexDirection: 'column', gap: 7, minHeight: 0, minWidth: 0 }}>
          <ChartPanel state={state} />
          <ExchangePanel state={state} send={send} />
        </div>
      </div>

      <div className="statusbar">
        <span><span className={cls('dot', !connected && 'off')} />{connected ? 'moteur connecté' : 'déconnecté'}</span>
        <span>{status}</span>
        <span className="mono">session {state?.sessionId?.slice(-6) ?? '—'}</span>
        <div className="spacer" style={{ flex: 1 }} />
        <span className="kbd-hint">
          <kbd>Entrée</kbd> envoyer · <kbd>P</kbd> passer · <kbd>H</kbd> couvrir · <kbd>Espace</kbd> pause · <kbd>K</kbd> classement
        </span>
        <span style={{ color: 'var(--muted)' }}>simulateur pédagogique — données synthétiques</span>
      </div>

      {!state && (
        <div className="modal-wrap">
          <div className="modal" style={{ textAlign: 'center', width: 380 }}>
            <div className="brand-mark" style={{ margin: '0 auto 10px', width: 34, height: 34, fontSize: 18 }}>T</div>
            <h2>Connexion au moteur de marché…</h2>
            <p className="hint">Initialisation des carnets et du flux client.</p>
          </div>
        </div>
      )}

      {state && phase === 'briefing' && <Briefing state={state} send={send} connected={connected} />}
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
            <div className="kicker" style={{ marginBottom: 2 }}>Round {state.round} terminé</div>
            <div className="mono" style={{ fontSize: 11, color: 'var(--muted)' }}>
              Cumul {usdSign(state.pnl.total)} · top {Math.max(1, Math.round(100 - state.leaderboard.topPct))} %
            </div>
          </div>
          <button className="btn ghost" onClick={() => setDebriefDismissed(false)}>Revoir le débrief</button>
          <button className="btn primary" onClick={() => send({ type: 'nextRound' })}>
            {state.round >= state.roundsTotal ? 'Résultat final' : `▶ Round ${state.round + 1}`}
          </button>
        </div>
      )}

      {phase === 'done' && finalDismissed && (
        <button
          className="btn primary"
          style={{ position: 'fixed', bottom: 40, left: '50%', transform: 'translateX(-50%)', zIndex: 40 }}
          onClick={() => setFinalDismissed(false)}
        >
          Voir le résultat final
        </button>
      )}

      {drawer === 'leaderboard' && <LeaderboardDrawer state={state} onClose={() => setDrawer(null)} />}
      {drawer === 'coach' && <CoachDrawer state={state} onClose={() => setDrawer(null)} />}
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
