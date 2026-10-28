import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useSocket } from './hooks/useSocket.js';
import TopBar from './components/TopBar.jsx';
import { EquitiesPanel, NewsPanel, PositionsPanel } from './components/Panels.jsx';
import ChatPanel from './components/ChatPanel.jsx';
import QuoteTicket from './components/QuoteTicket.jsx';
import ExchangePanel from './components/ExchangePanel.jsx';
import ChartPanel from './components/ChartPanel.jsx';
import { CoachDrawer, HelpDrawer, LeaderboardDrawer } from './components/Drawers.jsx';
import { Briefing, Debrief, Final } from './components/Modals.jsx';
import { GaugeGrid } from './components/Gauge.jsx';
import { cls, money, usdSign } from './lib/format.js';
import { LINKS } from './lib/scoring.js';
import { marketAudio } from './lib/audio.js';

const SOUND_KEY = 'tl.sound.v3';

function readSoundPrefs() {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(SOUND_KEY) : null;
    if (raw) {
      const p = JSON.parse(raw);
      return { muted: Boolean(p.muted), volume: Number.isFinite(p.volume) ? p.volume : 0.55 };
    }
  } catch { /* ignore */ }
  return { muted: false, volume: 0.55 };
}

export default function App() {
  const { state, connected, send, notify, toasts } = useSocket();
  const [drawer, setDrawer] = useState(null);
  const [debriefDismissed, setDebriefDismissed] = useState(false);
  const [finalDismissed, setFinalDismissed] = useState(false);
  const [activeRoom, setActiveRoom] = useState('ib');
  const [quoteClient, setQuoteClient] = useState(null);
  const [selectedTicker, setSelectedTicker] = useState('MSFT');
  const [prefill, setPrefill] = useState(null);
  const [sound, setSound] = useState(readSoundPrefs);
  const [audioLive, setAudioLive] = useState(false);
  const lastEventRef = useRef(0);
  const lastSessionRef = useRef(null);

  const phase = state?.phase;
  const round = state?.round;
  const role = state?.role;

  const openGuide = useCallback(() => {
    if (typeof window !== 'undefined') window.open(LINKS.guide, '_blank', 'noopener');
  }, []);

  // ------------------------------------------------------------------- audio
  const applySound = useCallback((next) => {
    setSound(next);
    try { localStorage.setItem(SOUND_KEY, JSON.stringify(next)); } catch { /* ignore */ }
    marketAudio.setVolume(next.volume);
    marketAudio.setMuted(next.muted);
    return next;
  }, []);

  const toggleMute = useCallback(() => {
    const next = { ...sound, muted: !sound.muted };
    applySound(next);
    if (!next.muted) {
      marketAudio.enable().then(() => {
        setAudioLive(true);
        marketAudio.effect('ui');
      });
    }
  }, [sound, applySound]);

  const changeVolume = useCallback((volume) => {
    applySound({ ...sound, volume });
    if (!audioLive && volume > 0) {
      marketAudio.enable().then(() => setAudioLive(true));
    }
  }, [sound, applySound, audioLive]);

  const startSession = useCallback((opts) => {
    marketAudio.setVolume(sound.volume);
    marketAudio.setMuted(sound.muted);
    marketAudio.enable().then(() => {
      setAudioLive(true);
      if (!sound.muted) marketAudio.effect('open');
    });
    setDebriefDismissed(false);
    setFinalDismissed(false);
    setDrawer(null);
    send({ type: 'start', ...opts });
  }, [send, sound]);

  // Sound triggers from authoritative server events
  useEffect(() => {
    if (!state?.events) return;
    if (lastSessionRef.current !== state.sessionId) {
      lastSessionRef.current = state.sessionId;
      lastEventRef.current = state.lastEventId ?? 0;
      return;
    }
    const fresh = state.events.filter((e) => e.id > lastEventRef.current);
    if (fresh.length) {
      for (const ev of fresh) {
        if (ev.type === 'news') marketAudio.effect('news');
        else if (ev.type === 'rfq' || ev.type === 'quote') marketAudio.effect('ping');
        else if (ev.type === 'fill') marketAudio.effect('fill');
        else if (ev.type === 'alert') marketAudio.effect('alert');
        else if (ev.type === 'round') marketAudio.effect('open');
      }
      lastEventRef.current = state.lastEventId ?? lastEventRef.current;
    } else if ((state.lastEventId ?? 0) < lastEventRef.current) {
      lastEventRef.current = state.lastEventId;
    }
  }, [state?.lastEventId, state?.events, state?.sessionId]);

  // --------------------------------------------------------------- UI sync
  useEffect(() => {
    if (phase === 'round') {
      setDebriefDismissed(false);
      setFinalDismissed(false);
    }
  }, [phase, round]);

  useEffect(() => {
    if (!state) return;
    if (state.role === 'IB') {
      setActiveRoom('ib');
      setQuoteClient(state.contacts?.[0]?.id ?? null);
    } else {
      setActiveRoom('am');
      setQuoteClient(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.role, state?.round]);

  useEffect(() => {
    if (!state) return;
    setQuoteClient((cur) => cur ?? state.contacts?.[0]?.id ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.contacts?.length]);

  const selectRoom = useCallback((room) => {
    setActiveRoom(room);
    if (state?.contacts?.some((c) => c.id === room)) setQuoteClient(room);
    send({ type: 'readRoom', room });
  }, [state?.contacts, send]);

  const selectTicker = useCallback((ticker) => {
    if (!ticker) return;
    setSelectedTicker(ticker);
    send({ type: 'chart', ticker });
  }, [send]);

  const handlePrefill = useCallback((ticker, qty, roomId) => {
    if (roomId) {
      setActiveRoom(roomId);
      setQuoteClient(roomId);
    }
    if (ticker) {
      setSelectedTicker(ticker);
      send({ type: 'chart', ticker });
    }
    setPrefill({ ticker, qty, ts: Date.now() });
  }, [send]);

  // ------------------------------------------------------------- shortcuts
  useEffect(() => {
    const onKey = (e) => {
      const tag = (e.target?.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'select' || tag === 'textarea') return;
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
  const showFinal = phase === 'done' && state?.final && !showDebrief && !finalDismissed;

  const layout = role === 'AM' ? 'am-layout' : 'ib-layout';
  const sessionChip = state?.mode === 'dynamic' ? 'DYNAMIC' : 'REPLAY';

  let riskAlert = null;
  if (state?.phase === 'round') {
    if (role === 'AM' && (state?.risk?.cashPct ?? 100) < 5) riskAlert = 'CASH < 5 % — RÉDUISEZ UNE LIGNE';
    else if (role === 'AM' && (state?.risk?.maxWeightPct ?? 0) > 20) riskAlert = `LIGNE > 20 % (${state?.risk?.maxWeightPct} %)`;
    else if (role === 'IB' && Math.abs(state?.risk?.net ?? 0) > 3000000) riskAlert = 'NET EXPOSURE > $3M — HEDGEZ PAR CLIPS';
  }

  return (
    <div className={cls('app', layout)}>
      <TopBar
        state={state}
        send={send}
        drawer={drawer}
        onDrawer={(d) => setDrawer((cur) => (cur === d ? null : d))}
        connected={connected}
        audioMuted={sound.muted}
        audioVolume={sound.volume}
        onToggleMute={toggleMute}
        onVolume={changeVolume}
        onGuide={openGuide}
      />

      <main className="workspace">
        <div className="row row-top">
          <EquitiesPanel state={state} send={send} onSelectTicker={selectTicker} />
          <NewsPanel state={state} send={send} onSelectTicker={selectTicker} />
          <PositionsPanel state={state} send={send} onSelectTicker={selectTicker} />
        </div>

        <div className="row row-bottom">
          <ChatPanel
            state={state}
            send={send}
            activeRoom={activeRoom}
            onSelectRoom={selectRoom}
            onPrefillQuote={handlePrefill}
            onReadRoom={(room) => send({ type: 'readRoom', room })}
            selectedTicker={selectedTicker}
          />
          {role === 'IB' ? (
            <>
              <QuoteTicket
                state={state}
                send={send}
                clientId={quoteClient}
                prefill={prefill}
                selectedTicker={selectedTicker}
                onSelectTicker={selectTicker}
              />
              <ExchangePanel state={state} send={send} selectedTicker={selectedTicker} onSelectTicker={selectTicker} />
            </>
          ) : (
            <ExchangePanel state={state} send={send} selectedTicker={selectedTicker} onSelectTicker={selectTicker} />
          )}
          <ChartPanel state={state} send={send} onSelectTicker={selectTicker} />
        </div>

        <div className="gauge-strip">
          <div className="gs-kicker">
            <span>LIVE GAUGES</span>
            <b>{role === 'AM' ? 'AM-55 · $20M' : 'IB-55 · Market Maker'}</b>
          </div>
          <GaugeGrid gauges={state?.roleScore?.gauges ?? []} size={46} showWeight={false} />
          <div className="gs-total">
            <span>SCORE GLOBAL</span>
            <b style={{ color: (state?.roleScore?.total ?? 0) >= 90 ? 'var(--green)' : (state?.roleScore?.total ?? 0) >= 70 ? '#a3d94a' : 'var(--gold)' }}>
              {state?.roleScore?.total ?? 0}%
            </b>
          </div>
        </div>
      </main>

      <div className="session-strip mono">
        <span>{sessionChip}</span>
        <span>{state?.pace ? (state.pace === 'real' ? '30 MIN' : state.pace === 'express' ? '8 MIN' : '15 MIN') : `${Math.round((state?.roundSeconds ?? 0) / 60)} MIN`}</span>
        <span>{state?.roleBadge}</span>
        <span className="grow" />
        <span className="dim">CFA Institute × AmplifyME trainer · scores en direct</span>
      </div>

      {!state && (
        <div className="modal-backdrop">
          <div className="loading-card">
            <div className="av-logo big">AV</div>
            <h2>CONNEXION AU MOTEUR DE MARCHÉ</h2>
            <p>AmplifyME FlowTrader · chargement de l’univers BABA / BP / HSBC / MSFT / VW…</p>
            <div className="loader"><i /></div>
          </div>
        </div>
      )}

      {state && phase === 'briefing' && (
        <Briefing state={state} onStart={startSession} onGuide={openGuide} />
      )}

      {showDebrief && (
        <Debrief
          state={state}
          send={send}
          onGuide={openGuide}
          onClose={() => {
            setDebriefDismissed(true);
            send({ type: 'closeDebrief' });
          }}
        />
      )}

      {showFinal && (
        <Final
          state={state}
          onGuide={openGuide}
          onRestart={() => { setFinalDismissed(false); send({ type: 'restart' }); }}
          onLeaderboard={() => { setFinalDismissed(true); setDrawer('leaderboard'); }}
        />
      )}

      {phase === 'break' && !showDebrief && (
        <div className="break-bar">
          <div>
            <div className="kicker">ROUND {state.round} TERMINÉ</div>
            <div className="mono dim" style={{ fontSize: 11 }}>
              Session P&amp;L {usdSign(state.pnl?.sessionTotal ?? 0)} · Score global {state.roleScore?.total ?? 0}%
            </div>
          </div>
          <button type="button" className="btn ghost" onClick={() => setDebriefDismissed(false)}>Debrief</button>
          <button type="button" className="btn primary" onClick={() => send({ type: 'nextRound' })}>
            {state.round >= state.roundsTotal ? 'RÉSULTAT FINAL' : `▶ ROUND ${state.round + 1} — ${state.role === 'IB' ? 'AM-55' : 'IB-55'}`}
          </button>
        </div>
      )}

      {phase === 'done' && finalDismissed && (
        <button type="button" className="reopen-final" onClick={() => setFinalDismissed(false)}>
          Voir le résultat final
        </button>
      )}

      {drawer === 'coach' && <CoachDrawer state={state} onClose={() => setDrawer(null)} onGuide={openGuide} />}
      {drawer === 'leaderboard' && <LeaderboardDrawer state={state} onClose={() => setDrawer(null)} />}
      {drawer === 'help' && (
        <HelpDrawer
          state={state}
          onClose={() => setDrawer(null)}
          onGuide={openGuide}
          onRestart={() => { setDrawer(null); send({ type: 'restart' }); }}
        />
      )}

      {state && phase !== 'briefing' && (
        <a className="guide-fab" href={LINKS.guide} target="_blank" rel="noreferrer" title="Guide PDF complet — plan pour finir 1er">
          <span className="gf-ico">📄</span>
          <span className="gf-text">Guide PDF <b>Top 1 %</b></span>
        </a>
      )}

      <div className="toasts">
        {toasts.map((t) => (
          <div key={t.id} className={cls('toast', t.kind)}>{t.text}</div>
        ))}
      </div>

      {riskAlert && <div className="risk-flash">{riskAlert}</div>}

      <span className="sr-only">{money(state?.pnl?.total ?? 0)}</span>
    </div>
  );
}
