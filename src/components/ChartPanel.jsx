import React, { useEffect, useMemo, useRef, useState } from 'react';
import { aggregate, drawChart } from '../lib/chart.js';
import { cls, price as px, pct, fmt2, compact, signCls, money } from '../lib/format.js';

const TFS = [
  { label: '5m', sec: 300 },
  { label: '15m', sec: 900 },
  { label: '30m', sec: 1800 },
  { label: '60m', sec: 3600 },
  { label: 'Tout', sec: 0 },
];

export default function ChartPanel({ state }) {
  const canvasRef = useRef(null);
  const [tf, setTf] = useState(900);
  const [mode, setMode] = useState('line');
  const [hover, setHover] = useState(null);
  const chart = state?.chart;
  const ticker = chart?.ticker ?? 'BP';
  const equity = state?.equities?.find((e) => e.ticker === ticker);
  const pos = state?.positions?.find((p) => p.ticker === ticker);

  const data = useMemo(() => {
    const bucket = tf ? Math.max(1, Math.round(tf / 15)) : Math.max(1, Math.ceil((chart?.candles?.length ?? 1) / 90));
    return aggregate(chart?.candles ?? [], bucket);
  }, [chart?.candles?.length, tf, ticker, chart?.candles?.[chart?.candles.length - 1]?.[4]]);

  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const hoverX = hover?.x ?? null;
    drawChart(cv, data, { mode, ref: chart?.ref, hoverX, maxPoints: 160, markers: chart?.markers ?? [] });
  }, [data, mode, chart?.ref, hover?.x, chart?.markers?.length]);

  useEffect(() => {
    let raf = 0;
    const onResize = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => window.dispatchEvent(new Event('resize'))); };
    const cv = canvasRef.current;
    if (!cv) return undefined;
    const ro = new ResizeObserver(() => {
      drawChart(cv, data, { mode, ref: chart?.ref, hoverX: hover?.x ?? null, maxPoints: 160, markers: chart?.markers ?? [] });
    });
    ro.observe(cv);
    return () => { ro.disconnect(); cancelAnimationFrame(raf); };
  }, [data, mode, chart?.ref]);

  const onMove = (e) => {
    const cv = canvasRef.current;
    if (!cv || !data.length) return;
    const rect = cv.getBoundingClientRect();
    const x = e.clientX - rect.left;
    setHover({ x });
  };

  const hovered = useMemo(() => {
    if (!hover || !data.length) return null;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return null;
    const padR = 48, padL = 2;
    const plotW = rect.width - padL - padR;
    const xStep = plotW / Math.max(1, data.length - 1);
    const i = Math.max(0, Math.min(data.length - 1, Math.round((hover.x - padL) / xStep)));
    return data[i];
  }, [hover, data]);

  return (
    <div className="panel" style={{ flex: 1, minHeight: 0 }}>
      <div className="panel-head">
        <span className="panel-title">
          {ticker} <span className="dim mono" style={{ fontSize: 9, fontWeight: 400 }}>{equity?.name}</span>
        </span>
        <span className="mono" style={{ fontSize: 12.5, color: '#eaf7ff' }}>{px(equity?.last ?? 0)}</span>
        <span className={cls('mono', signCls(equity?.chgPct ?? 0))} style={{ fontSize: 10.5 }}>{pct(equity?.chgPct ?? 0)}</span>
        {pos && <span className="badge warn mono">{pos.qty > 0 ? '+' : ''}{compact(pos.qty)}</span>}
        <div className="spacer" />
        <div className="tf-group">
          {TFS.map((t) => (
            <button key={t.label} className={cls('chip-btn', tf === t.sec && 'on')} style={{ minWidth: 26 }} onClick={() => setTf(t.sec)}>
              {t.label}
            </button>
          ))}
        </div>
        <div className="tf-group">
          {[['line', 'LIGNE'], ['candles', 'CHANDELLES'], ['area', 'AIRE']].map(([m, l]) => (
            <button key={m} className={cls('chip-btn', mode === m && 'on')} style={{ minWidth: 30, fontSize: 8.5 }} onClick={() => setMode(m)}>
              {l}
            </button>
          ))}
        </div>
      </div>
      <div className="chart-wrap">
        <canvas
          ref={canvasRef}
          className="chart-canvas"
          onMouseMove={onMove}
          onMouseLeave={() => setHover(null)}
        />
        {hovered && (
          <div className="chart-tooltip" style={{ left: 8, top: 6 }}>
            <span className="dim">O</span> {fmt2(hovered.o)} <span className="dim">H</span> {fmt2(hovered.h)} <span className="dim">L</span> {fmt2(hovered.l)} <span className="dim">C</span> {fmt2(hovered.c)}
          </div>
        )}
        <div style={{ position: 'absolute', right: 52, bottom: 20, fontSize: 8.5, color: 'var(--muted)', letterSpacing: 0.6 }}>
          TRADELAB · sim
        </div>
      </div>
    </div>
  );
}

export function ExchangePanel({ state, send }) {
  const [ticker, setTicker] = useState('BP');
  const [qty, setQty] = useState(25000);
  const equities = state?.equities ?? [];
  const eq = equities.find((e) => e.ticker === ticker) ?? equities[0];
  const pos = state?.positions?.find((p) => p.ticker === (eq?.ticker ?? ticker));

  const doTrade = (side) => send({ type: 'trade', ticker: eq.ticker, side, qty: Number(qty) });
  const setFromPos = (f) => {
    if (!pos) return;
    setQty(Math.max(1000, Math.round((Math.abs(pos.qty) * f) / 1000) * 1000));
  };

  return (
    <div className="panel" style={{ flex: '0 0 114px' }}>
      <div className="panel-head">
        <span className="panel-title">Bourse</span>
        <span className="dim mono" style={{ fontSize: 8.5 }} title="Spread 0,6 % + commission 0,5 % par côté (soit ~11 bps de coût de couverture)">
          coût ≈ {money(Math.round((Number(qty) || 0) * (eq?.last ?? 0) * 0.0011))} $
        </span>
        <div className="spacer" />
        {pos && <span className="badge warn mono">position {compact(pos.qty)}</span>}
      </div>
      <div className="exchange">
        <div className="ex-row">
          <select value={ticker} onChange={(e) => setTicker(e.target.value)} style={{ width: 82, padding: '3px 5px', fontSize: 10.5 }}>
            {equities.map((e) => <option key={e.ticker} value={e.ticker}>{e.ticker}</option>)}
          </select>
          <input
            type="number" step="5000" value={qty}
            onChange={(e) => setQty(e.target.value)}
            style={{ width: 88, padding: '3px 6px', fontSize: 10.5 }}
          />
          <div className="btn-sm-group" style={{ width: 112 }}>
            <button className="chip-btn" onClick={() => setQty(25000)}>25k</button>
            <button className="chip-btn" onClick={() => setQty(50000)}>50k</button>
            <button className="chip-btn" onClick={() => setFromPos(1)}>pos.</button>
          </div>
          <div className="spacer" />
          <button className="btn tiny ghost" onClick={() => send({ type: 'hedge', ticker: eq.ticker })} title="Ramène la position à zéro (H)">
            ⇄ Couvrir
          </button>
        </div>
        <div className="ex-quotes">
          <button className="ex-quote b" onClick={() => doTrade('SELL')}>
            <div className="l">VENDRE AU BID</div>
            <div className="p">{px(eq?.bid ?? 0)}</div>
          </button>
          <button className="ex-quote s" onClick={() => doTrade('BUY')}>
            <div className="l">ACHETER À L'OFFER</div>
            <div className="p">{px(eq?.offer ?? 0)}</div>
          </button>
        </div>
      </div>
    </div>
  );
}
