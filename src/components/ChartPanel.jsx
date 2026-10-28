import React, { useEffect, useRef, useState } from 'react';
import { cls, pct, price } from '../lib/format.js';
import { drawChart } from '../lib/chart.js';

const ZOOMS = [
  ['5min', '5min'],
  ['15min', '15min'],
  ['30min', '30min'],
  ['60min', '60min'],
  ['all', 'All'],
];

export default function ChartPanel({ state, send, onSelectTicker }) {
  const chart = state?.chart ?? {};
  const equities = state?.equities ?? [];
  const role = state?.role ?? 'IB';
  const [mode, setMode] = useState('line');
  const [metric, setMetric] = useState('price');
  const [sma, setSma] = useState(false);
  const [benchmark, setBenchmark] = useState(false);
  const [zoom, setZoom] = useState('all');
  const [hoverX, setHoverX] = useState(null);
  const canvasRef = useRef(null);
  const wrapRef = useRef(null);
  const [box, setBox] = useState({ w: 0, h: 0 });

  const eq = equities.find((e) => e.ticker === chart.ticker) || equities[0];

  useEffect(() => {
    if (!wrapRef.current || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver((entries) => {
      const r = entries[0]?.contentRect;
      if (r) setBox({ w: r.width, h: r.height });
    });
    ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !box.w || !box.h) return;
    drawChart(canvas, chart.candles ?? [], {
      mode,
      metric,
      showSma: sma,
      showBenchmark: benchmark && role === 'AM',
      benchmark: chart.benchmark ?? [],
      zoom,
      dp: chart.dp ?? 2,
      markers: chart.markers ?? [],
      avgLong: chart.avgLong,
      avgShort: chart.avgShort,
      hoverX,
      roundSeconds: state?.roundSeconds ?? 900,
      emptyLabel: state?.phase === 'briefing' ? 'Session not started' : 'Waiting for market ticks…',
    });
  }, [canvasRef, box, chart, mode, metric, sma, benchmark, zoom, hoverX, role, state?.phase, state?.roundSeconds]);

  const onMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setHoverX(e.clientX - rect.left);
  };

  return (
    <section className="panel area-chart chart-panel">
      <div className="panel-head">
        <span className="panel-tab active">CHART</span>
        <select
          className="chart-ticker-select"
          value={chart.ticker || 'MSFT'}
          onChange={(e) => { send?.({ type: 'chart', ticker: e.target.value }); onSelectTicker?.(e.target.value); }}
          aria-label="Chart ticker"
        >
          {equities.map((e) => <option key={e.ticker} value={e.ticker}>{e.ticker}</option>)}
        </select>
        {eq && (
          <span className="chart-price mono">
            {price(eq.last, eq.dp ?? 2)}
            <em className={eq.chgPct >= 0 ? 'pos' : 'neg'}>{pct(eq.chgPct, 2)}</em>
          </span>
        )}
        <span className="panel-meta mono chart-company">{eq?.name}</span>
      </div>

      <div className="chart-controls">
        <div className="seg">
          <button type="button" className={cls(metric === 'price' && 'on')} onClick={() => setMetric('price')}>PRICE</button>
          <button type="button" className={cls(metric === 'volume' && 'on')} onClick={() => setMetric('volume')}>VOLUME</button>
        </div>
        <div className="seg">
          <button type="button" className={cls(mode === 'line' && 'on')} onClick={() => setMode('line')}>LINE</button>
          <button type="button" className={cls(mode === 'candles' && 'on')} onClick={() => setMode('candles')}>CANDLESTICK</button>
        </div>
        <button type="button" className={cls('chip-btn', sma && 'on')} onClick={() => setSma((v) => !v)} title="Simple moving average (20)">
          SMA
        </button>
        {role === 'AM' && (
          <button type="button" className={cls('chip-btn bmk', benchmark && 'on')} onClick={() => setBenchmark((v) => !v)} title="Equal-weight benchmark of the 5 stocks">
            BENCHMARK
          </button>
        )}
        <div className="zoom-group">
          {ZOOMS.map(([id, label]) => (
            <button key={id} type="button" className={cls(zoom === id && 'on')} onClick={() => setZoom(id)}>{label}</button>
          ))}
        </div>
      </div>

      <div className="chart-wrap" ref={wrapRef}>
        <canvas
          ref={canvasRef}
          onMouseMove={onMove}
          onMouseLeave={() => setHoverX(null)}
          aria-label="AmplifyME price chart"
        />
      </div>

      <div className="chart-legend">
        <span className="lg max">Maximum</span>
        <span className="lg min">Minimum</span>
        {chart.avgLong != null && <span className="lg avgl">AVERAGE LONG {price(chart.avgLong, chart.dp ?? 2)}</span>}
        {chart.avgShort != null && <span className="lg avgs">AVERAGE SHORT {price(chart.avgShort, chart.dp ?? 2)}</span>}
        {sma && <span className="lg sma">SMA 20</span>}
        {benchmark && role === 'AM' && <span className="lg bmk">BENCHMARK</span>}
        <span className="lg dim">Last {chart.candles?.length ?? 0} ticks</span>
      </div>
    </section>
  );
}
