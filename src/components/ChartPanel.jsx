import React, { useEffect, useMemo, useRef, useState } from 'react';
import { aggregate, drawChart } from '../lib/chart.js';
import { cls, price as px, fmt2, money, shares } from '../lib/format.js';

const ZOOMS = [
  { label: '5min', sec: 35, bucket: 1 },
  { label: '15min', sec: 100, bucket: 1 },
  { label: '30min', sec: 200, bucket: 2 },
  { label: '60min', sec: 400, bucket: 3 },
  { label: 'All', sec: 0, bucket: 2 },
];

/* ============================================================ EXCHANGE PANEL */
export function ExchangePanel({ state, send, selectedTicker, onSelectTicker }) {
  const equities = state?.equities ?? [];
  const [ticker, setTicker] = useState(selectedTicker || 'BP');
  const [volInput, setVolInput] = useState('10000');

  useEffect(() => {
    if (selectedTicker) setTicker(selectedTicker);
  }, [selectedTicker]);

  const eq = equities.find((e) => e.ticker === ticker) || equities[0];
  const pos = state?.positions?.find((p) => p.ticker === (eq?.ticker ?? ticker));

  const qty = Math.max(0, Math.round(Number(volInput) || 0));

  // Compute exact client-side depth preview matching engine.depthQuote()
  const depth = useMemo(() => {
    if (!eq || qty <= 0) {
      return { sellPrice: eq?.bid ?? 0, buyPrice: eq?.offer ?? 0, notional: 0, commission: 0, halfBps: 42 };
    }
    const baseHalf = eq.exchangeBaseHalfSpread ?? 0.0042;
    const slope = eq.exchangeDepthSlope ?? 0.0052;
    const baseDepth = eq.baseDepth ?? 45000;
    const halfSpread = Math.min(0.045, baseHalf + slope * (qty / baseDepth));
    const dec = (eq.ref ?? 50) >= 100 ? 2 : 3;
    const sellPrice = Number((eq.last * (1 - halfSpread)).toFixed(dec));
    const buyPrice = Number((eq.last * (1 + halfSpread)).toFixed(dec));
    const notional = Math.round(qty * eq.last);
    const commission = Math.round(notional * (eq.feeRate ?? 0.00025));
    return {
      sellPrice,
      buyPrice,
      notional,
      commission,
      halfBps: Math.round(halfSpread * 10000),
    };
  }, [eq, qty]);

  const handleTicker = (tk) => {
    setTicker(tk);
    onSelectTicker?.(tk);
    send({ type: 'chart', ticker: tk });
  };

  const execute = (side) => {
    if (!eq || qty <= 0) return;
    send({ type: 'trade', ticker: eq.ticker, side, qty });
  };

  const prefillSmartClip = () => {
    if (!pos || pos.qty === 0 || !eq) return;
    const smartClip = Math.min(Math.abs(pos.qty), Math.round((eq.baseDepth || 40000) * 0.35 / 1000) * 1000 || 10000);
    setVolInput(String(Math.max(1000, smartClip)));
  };

  return (
    <section className="amp-panel area-exchange">
      <div className="amp-tabbar">
        <button type="button" className="amp-tab active">EXCHANGE</button>
        {pos && pos.qty !== 0 && (
          <button
            type="button"
            className="amp-pos-clip-chip"
            onClick={prefillSmartClip}
            title="Click to load a low-impact unwind clip from your open position"
          >
            Pos {pos.qty > 0 ? '+' : ''}{shares(pos.qty)}
          </button>
        )}
      </div>

      <div className="amp-exch-body">
        <select
          value={eq?.ticker || ticker}
          onChange={(e) => handleTicker(e.target.value)}
          className="amp-exch-select"
          aria-label="Exchange Ticker"
        >
          {equities.map((e) => (
            <option key={e.ticker} value={e.ticker}>{e.ticker}</option>
          ))}
        </select>

        <div className="amp-depth-row">
          <input
            type="number"
            step="1000"
            min="100"
            value={volInput}
            onChange={(e) => setVolInput(e.target.value)}
            placeholder="Enter volume to check market depth"
          />
          <button
            type="button"
            className="amp-depth-btn"
            onClick={() => setVolInput(String(qty || 10000))}
            title="Check market depth for entered volume"
          >
            ↵
          </button>
        </div>

        <div className="amp-exch-sides">
          <div className="exch-side-col">
            <span className="exch-side-lbl">SELL</span>
            <button
              type="button"
              className="exch-price-box sell"
              onClick={() => execute('SELL')}
              disabled={qty <= 0}
              title={`Execute SELL ${shares(qty)} ${eq?.ticker} @ $${px(depth.sellPrice)}`}
            >
              {px(depth.sellPrice)}
            </button>
          </div>

          <div className="exch-side-col">
            <span className="exch-side-lbl">BUY</span>
            <button
              type="button"
              className="exch-price-box buy"
              onClick={() => execute('BUY')}
              disabled={qty <= 0}
              title={`Execute BUY ${shares(qty)} ${eq?.ticker} @ $${px(depth.buyPrice)}`}
            >
              {px(depth.buyPrice)}
            </button>
          </div>
        </div>

        <label className="amp-exch-ro">
          <span>NOTIONAL VALUE</span>
          <input readOnly value={qty > 0 ? `$ ${money(depth.notional)}` : ''} />
        </label>

        <label className="amp-exch-ro">
          <span>COMMISSION</span>
          <input readOnly value={qty > 0 ? `$ ${money(depth.commission)}` : ''} />
        </label>

        <div className="exch-depth-note mono">
          Depth half-spread: <b>{depth.halfBps} bps</b>
        </div>
      </div>
    </section>
  );
}

/* ============================================================== CHART PANEL */
export default function ChartPanel({ state, send, onSelectTicker }) {
  const canvasRef = useRef(null);
  const [zoomLabel, setZoomLabel] = useState('60min');
  const [metric, setMetric] = useState('price');   // 'price' | 'volume'
  const [mode, setMode] = useState('line');        // 'line' | 'candles'
  const [showSma, setShowSma] = useState(false);
  const [showMarkers, setShowMarkers] = useState(true);
  const [hover, setHover] = useState(null);

  const equities = state?.equities ?? [];
  const chart = state?.chart;
  const ticker = chart?.ticker ?? 'BP';

  const zoomCfg = ZOOMS.find((z) => z.label === zoomLabel) || ZOOMS[3];

  const { visibleData, allAgg, zoomRatio } = useMemo(() => {
    const raw = chart?.candles ?? [];
    const agg = aggregate(raw, zoomCfg.bucket);
    if (!zoomCfg.sec || !raw.length) {
      return { visibleData: agg, allAgg: agg, zoomRatio: 1 };
    }
    const maxT = raw[raw.length - 1]?.[0] ?? 0;
    const minT = maxT - zoomCfg.sec;
    const filtered = agg.filter((c) => c.t >= minT);
    const vis = filtered.length >= 3 ? filtered : agg.slice(-20);
    const ratio = agg.length ? vis.length / agg.length : 1;
    return { visibleData: vis, allAgg: agg, zoomRatio: ratio };
  }, [chart?.candles?.length, zoomCfg.label, ticker, chart?.candles?.[chart?.candles.length - 1]?.[4]]);

  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    drawChart(cv, visibleData, {
      mode,
      metric,
      showSma,
      showMarkers,
      ref: chart?.ref,
      hoverX: hover?.x ?? null,
      zoomRatio,
      allCandles: allAgg,
      markers: chart?.markers ?? [],
    });
  }, [visibleData, allAgg, zoomRatio, mode, metric, showSma, showMarkers, chart?.ref, hover?.x, chart?.markers?.length]);

  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(() => {
      drawChart(cv, visibleData, {
        mode,
        metric,
        showSma,
        showMarkers,
        ref: chart?.ref,
        hoverX: hover?.x ?? null,
        zoomRatio,
        allCandles: allAgg,
        markers: chart?.markers ?? [],
      });
    });
    ro.observe(cv);
    return () => ro.disconnect();
  }, [visibleData, allAgg, zoomRatio, mode, metric, showSma, showMarkers, chart?.ref]);

  const onMove = (e) => {
    const cv = canvasRef.current;
    if (!cv || !visibleData.length) return;
    const rect = cv.getBoundingClientRect();
    setHover({ x: e.clientX - rect.left });
  };

  const hovered = useMemo(() => {
    if (!hover || !visibleData.length) return null;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return null;
    const padL = 8;
    const padR = 46;
    const plotW = rect.width - padL - padR;
    const xStep = plotW / Math.max(1, visibleData.length - 1);
    const i = Math.max(0, Math.min(visibleData.length - 1, Math.round((hover.x - padL) / xStep)));
    return visibleData[i];
  }, [hover, visibleData]);

  const handleSelect = (tk) => {
    send?.({ type: 'chart', ticker: tk });
    onSelectTicker?.(tk);
  };

  return (
    <section className="amp-panel area-chart">
      {/* Row 1: Ticker Search + PRICE|VOLUME + LINE|CANDLESTICK + SMA (exact match to image-1.png) */}
      <div className="amp-chart-bar1">
        <div className="chart-tk-box">
          <select
            value={ticker}
            onChange={(e) => handleSelect(e.target.value)}
            aria-label="Chart Security"
          >
            {equities.map((e) => (
              <option key={e.ticker} value={e.ticker}>{e.ticker}</option>
            ))}
          </select>
          <span className="search-ico" aria-hidden="true">🔍</span>
        </div>

        <div className="chart-toggle-pair">
          <button
            type="button"
            className={cls('chart-tbtn', metric === 'price' && 'active')}
            onClick={() => setMetric('price')}
          >
            PRICE
          </button>
          <button
            type="button"
            className={cls('chart-tbtn', metric === 'volume' && 'active')}
            onClick={() => setMetric('volume')}
          >
            VOLUME
          </button>
        </div>

        <div className="chart-toggle-pair">
          <button
            type="button"
            className={cls('chart-tbtn', mode === 'line' && 'active')}
            onClick={() => setMode('line')}
          >
            LINE
          </button>
          <button
            type="button"
            className={cls('chart-tbtn', mode === 'candles' && 'active')}
            onClick={() => setMode('candles')}
          >
            CANDLESTICK
          </button>
        </div>

        <div className="spacer" />

        <button
          type="button"
          className={cls('chart-sma-btn', showSma && 'active')}
          onClick={() => setShowSma(!showSma)}
          title="Toggle Simple Moving Average (SMA)"
        >
          SMA
        </button>
      </div>

      {/* Row 2: Zoom 5min 15min 30min 60min All + burger menu (exact match to image-1.png) */}
      <div className="amp-chart-bar2">
        <span className="zoom-lbl">Zoom</span>
        {ZOOMS.map((z) => (
          <button
            key={z.label}
            type="button"
            className={cls('zoom-pill', zoomLabel === z.label && 'active')}
            onClick={() => setZoomLabel(z.label)}
          >
            {z.label}
          </button>
        ))}
        <div className="spacer" />
        <button
          type="button"
          className={cls('chart-menu-btn', showMarkers && 'active')}
          onClick={() => setShowMarkers(!showMarkers)}
          title="Toggle execution fill markers on chart"
        >
          ☰
        </button>
      </div>

      <div className="chart-wrap">
        <canvas
          ref={canvasRef}
          className="chart-canvas"
          onMouseMove={onMove}
          onMouseLeave={() => setHover(null)}
        />
        {hovered && (
          <div className="chart-tooltip">
            <span className="dim">O</span> {fmt2(hovered.o)}{' '}
            <span className="dim">H</span> {fmt2(hovered.h)}{' '}
            <span className="dim">L</span> {fmt2(hovered.l)}{' '}
            <span className="dim">C</span> {fmt2(hovered.c)}
          </div>
        )}
      </div>
    </section>
  );
}
