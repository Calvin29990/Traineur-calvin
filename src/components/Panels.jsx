import React, { useEffect, useMemo, useRef, useState } from 'react';
import { cls, money, price, pct, shares, usd } from '../lib/format.js';

/* =============================================================== 1. EQUITIES */
export function EquitiesPanel({ state, send, onSelectTicker }) {
  const equities = state?.equities ?? [];
  const selected = state?.chart?.ticker;
  const [flash, setFlash] = useState(null);
  const prev = useRef({});

  useEffect(() => {
    for (const e of equities) {
      const p = prev.current[e.ticker];
      if (p != null && e.last !== p) {
        setFlash(e.ticker);
        const t = setTimeout(() => setFlash(null), 420);
        prev.current[e.ticker] = e.last;
        return () => clearTimeout(t);
      }
      prev.current[e.ticker] = e.last;
    }
  }, [equities]);

  const pick = (t) => {
    send?.({ type: 'chart', ticker: t });
    onSelectTicker?.(t);
  };

  return (
    <section className="panel area-equities">
      <div className="panel-head">
        <span className="panel-tab active">1. EQUITIES</span>
        <span className="panel-meta mono">5 SECURITIES · Equity O</span>
      </div>
      <div className="panel-body no-pad">
        <table className="data-table equities-table">
          <thead>
            <tr>
              <th>TICKER</th>
              <th className="num">REFPRICE</th>
              <th className="num">% CHG</th>
              <th className="num">TYPE</th>
            </tr>
          </thead>
          <tbody>
            {equities.map((e) => {
              const dp = e.dp ?? 2;
              return (
                <tr
                  key={e.ticker}
                  className={cls('clickable', selected === e.ticker && 'selected', flash === e.ticker && (e.dir > 0 ? 'tick-up' : 'tick-down'))}
                  onClick={() => pick(e.ticker)}
                  title={`${e.name} — ${e.sector} · bid ${e.bid} / offer ${e.offer}`}
                >
                  <td className="tk">{e.ticker}</td>
                  <td className={cls('num mono', e.dir > 0 ? 'pos' : 'neg')}>
                    {price(e.last, dp)} <span className="arrow">{e.dir > 0 ? '↑' : '↓'}</span>
                  </td>
                  <td className={cls('num mono', e.chgPct >= 0 ? 'pos' : 'neg')}>{pct(e.chgPct, 2)}</td>
                  <td className="num type-cell">Equity O</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="equities-foot">
          <span className="dim">Click a ticker to load Quote / Exchange / Chart</span>
          <span className="mono dim">REF = live mid</span>
        </div>
      </div>
    </section>
  );
}

/* ================================================================ NEWS WIRE */
export function NewsPanel({ state, send, onSelectTicker }) {
  const [q, setQ] = useState('');
  const [openId, setOpenId] = useState(null);
  const news = state?.news ?? [];
  const assist = state?.assistMode;
  const top = news[0];
  const isHot = top && state?.totalSim != null && Math.abs(state.totalSim - top.simAt) < 7;

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return news;
    return news.filter((n) => `${n.ticker} ${n.headline} ${n.detail || ''}`.toLowerCase().includes(term));
  }, [news, q]);

  const handleRow = (n) => {
    setOpenId((cur) => (cur === n.id ? null : n.id));
    if (n.kind === 'STOCK' && n.ticker) {
      send?.({ type: 'chart', ticker: n.ticker });
      onSelectTicker?.(n.ticker);
    }
  };

  return (
    <section className="panel area-news">
      <div className="panel-head news-head">
        <span className="panel-tab active">NEWS WIRE</span>
        <span className={cls('live-dot', isHot && 'hot')} />
        <span className="news-search">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search keywords" aria-label="Search news" />
          <span aria-hidden="true">🔍</span>
        </span>
      </div>
      <div className="panel-body no-pad news-body">
        <div className="news-list">
          {rows.map((n) => {
            const isTop = n.id === news[0]?.id;
            const isNote = n.kind === 'NOTE';
            const isOpen = openId === n.id;
            return (
              <div key={n.id} className={cls('news-item', isTop && 'fresh', isNote && 'note', isOpen && 'open')}>
                <button type="button" className="news-row" onClick={() => handleRow(n)}>
                  <span className={cls('news-tk mono', n.kind?.toLowerCase())}>{n.ticker || n.kind}</span>
                  <span className="news-hl">
                    {n.headline}
                    {isTop && <span className="new-badge">NEW</span>}
                  </span>
                  <span className="news-time mono">{n.time}</span>
                </button>
                {isOpen && (
                  <div className="news-detail">
                    <p>{n.detail || n.headline}</p>
                    {assist && n.hint && <p className="news-hint">💡 Coach : {n.hint}</p>}
                    {n.kind === 'STOCK' && (
                      <button type="button" className="mini-link" onClick={() => { onSelectTicker?.(n.ticker); send?.({ type: 'chart', ticker: n.ticker }); }}>
                        Trade {n.ticker} →
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
          {!rows.length && <div className="empty">Waiting for the first wire headline…</div>}
        </div>
      </div>
    </section>
  );
}

/* ============================================== POSITIONS & TRADE BLOTTER */
export function PositionsPanel({ state, send, onSelectTicker }) {
  const [tab, setTab] = useState('pos');
  const [seenSeq, setSeenSeq] = useState(state?.tradeSeq ?? 0);
  const role = state?.role ?? 'IB';
  const positions = state?.positions ?? [];
  const blotter = state?.blotter ?? [];
  const risk = state?.risk ?? {};
  const seq = state?.tradeSeq ?? 0;
  const round = state?.round ?? 0;

  useEffect(() => {
    setSeenSeq(seq);
  }, [round]);

  useEffect(() => {
    if (tab === 'blotter') setSeenSeq(seq);
  }, [tab, seq]);

  const newTrades = Math.max(0, seq - seenSeq);

  return (
    <section className="panel area-positions">
      <div className="panel-head">
        <button type="button" className={cls('panel-tab', tab === 'pos' && 'active')} onClick={() => setTab('pos')}>
          POSITIONS
        </button>
        <button type="button" className={cls('panel-tab', tab === 'blotter' && 'active')} onClick={() => setTab('blotter')}>
          TRADE BLOTTER
          {newTrades > 0 && <span className="new-trades">{newTrades} New Trades</span>}
        </button>
        <span className="panel-meta mono">{role === 'AM' ? '$20M MANDATE' : 'IB-55 BOOK'}</span>
      </div>

      <div className="panel-body no-pad">
        {tab === 'pos' ? (
          <table className={cls('data-table positions-table', role === 'AM' && 'eight')}>
            <thead>
              <tr>
                <th>SECURITY</th>
                <th className="num">NET POS</th>
                <th className="num">AVG. PRICE</th>
                <th className="num">MARK</th>
                <th className="num">UNREALISED<br />P/L</th>
                <th className="num">REALISED<br />P/L</th>
                <th className="num">NET<br />P/L</th>
                {role === 'AM' && <th className="num">% OF<br />PORTFOLIO</th>}
              </tr>
            </thead>
            <tbody>
              {positions.map((p) => {
                const dp = state?.equities?.find((e) => e.ticker === p.ticker)?.dp ?? 2;
                return (
                  <tr key={p.ticker} className="clickable" onClick={() => { onSelectTicker?.(p.ticker); send?.({ type: 'chart', ticker: p.ticker }); }}>
                    <td className="tk">{p.ticker}</td>
                    <td className={cls('num mono', p.qty > 0 ? 'pos' : p.qty < 0 ? 'neg' : '')}>{shares(p.qty)}</td>
                    <td className="num mono">{p.qty === 0 ? '—' : price(p.avg, dp)}</td>
                    <td className="num mono">{price(p.mark, dp)}</td>
                    <td className={cls('num mono', p.unreal > 0 ? 'pos' : p.unreal < 0 ? 'neg' : '')}>{money(p.unreal)}</td>
                    <td className={cls('num mono', p.realised > 0 ? 'pos' : p.realised < 0 ? 'neg' : '')}>{money(p.realised)}</td>
                    <td className={cls('num mono strong', p.netPnl > 0 ? 'pos' : p.netPnl < 0 ? 'neg' : '')}>{money(p.netPnl)}</td>
                    {role === 'AM' && (
                      <td className="num mono pct-cell">
                        <span>{(p.pctOfPortfolio ?? 0).toFixed(1)}%</span>
                        <i className="pct-bar"><b style={{ width: `${Math.min(100, (p.pctOfPortfolio ?? 0) * 3.2)}%`, background: (p.pctOfPortfolio ?? 0) > 20 ? '#eb5757' : (p.pctOfPortfolio ?? 0) > 15 ? '#f1c40f' : '#2ecc71' }} /></i>
                      </td>
                    )}
                  </tr>
                );
              })}
              {!positions.length && (
                <tr>
                  <td colSpan={role === 'AM' ? 8 : 7} className="empty">
                    {role === 'AM'
                      ? 'No positions yet — deploy the $20,000,000 mandate via dealer quotes or Exchange.'
                      : 'No positions yet — quote two-way prices to AM / HF clients in Chat.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        ) : (
          <table className="data-table blotter-table">
            <thead>
              <tr>
                <th>TIME</th>
                <th>SECURITY</th>
                <th>SIDE</th>
                <th className="num">VOLUME</th>
                <th className="num">PRICE</th>
                <th>VENUE / MM</th>
                <th className="num">COMM.</th>
              </tr>
            </thead>
            <tbody>
              {blotter.map((b) => (
                <tr key={b.id}>
                  <td className="mono dim">{b.clock}</td>
                  <td className="tk">{b.ticker}</td>
                  <td className={cls('mono', b.side === 'BUY' ? 'pos' : 'neg')}>{b.side}</td>
                  <td className="num mono">{shares(b.qty)}</td>
                  <td className="num mono">{price(b.price, state?.equities?.find((e) => e.ticker === b.ticker)?.dp ?? 2)}</td>
                  <td className="mono venue">{b.venue || b.source}</td>
                  <td className={cls('num mono', b.commSigned > 0 ? 'pos' : 'dim')}>{b.commSigned > 0 ? `+${money(b.commSigned)}` : money(b.commSigned)}</td>
                </tr>
              ))}
              {!blotter.length && <tr><td colSpan={7} className="empty">No trades executed in this round.</td></tr>}
            </tbody>
          </table>
        )}
      </div>

      <div className="panel-foot risk-foot">
        <div className="rf">
          <span>GROSS</span>
          <b className="mono">{usd(risk.gross ?? 0)}</b>
        </div>
        <div className="rf">
          <span>NET</span>
          <b className={cls('mono', (risk.net ?? 0) > 0 ? 'pos' : (risk.net ?? 0) < 0 ? 'neg' : '')}>{usd(risk.net ?? 0)}</b>
        </div>
        {role === 'AM' ? (
          <>
            <div className="rf">
              <span>CASH</span>
              <b className={cls('mono', (risk.cashPct ?? 0) < 5 ? 'neg' : '')}>{usd(state?.pnl?.cashAvailable ?? 0)} <em>({risk.cashPct ?? 0}%)</em></b>
            </div>
            <div className="rf">
              <span>MAX LINE</span>
              <b className={cls('mono', (risk.maxWeightPct ?? 0) > 25 ? 'neg' : '')}>{risk.maxWeightPct ?? 0}%</b>
            </div>
          </>
        ) : (
          <div className="rf">
            <span>FFC</span>
            <b className={cls('mono', (state?.coach?.stats?.fatFingers ?? 0) > 0 ? 'neg' : 'pos')}>{state?.coach?.stats?.fatFingers ?? 0}</b>
          </div>
        )}
      </div>
    </section>
  );
}
