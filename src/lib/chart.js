// Canvas chart renderer reproducing the AmplifyME CHART panel:
// PRICE / VOLUME · LINE / CANDLESTICK · SMA · BENCHMARK · Maximum/Minimum
// dotted lines and AVERAGE SHORT / AVERAGE LONG position lines.

const fmt = (v, d = 2) => new Intl.NumberFormat('en-US', {
  minimumFractionDigits: d,
  maximumFractionDigits: d,
}).format(v);

export function aggregate(candles, bucketSim) {
  if (!candles?.length) return [];
  const bSize = Math.max(1, bucketSim || 1);
  const out = [];
  let cur = null;
  for (const c of candles) {
    const b = Math.floor(c[0] / bSize);
    if (!cur || cur.b !== b) {
      cur = { b, t: b * bSize, o: c[1], h: c[2], l: c[3], c: c[4], v: c[5] };
      out.push(cur);
    } else {
      cur.h = Math.max(cur.h, c[2]);
      cur.l = Math.min(cur.l, c[3]);
      cur.c = c[4];
      cur.v += c[5];
    }
  }
  return out;
}

const ZOOM_FRACTION = { '5min': 0.12, '15min': 0.28, '30min': 0.5, '60min': 0.75, all: 1 };

export function drawChart(canvas, candles, opts = {}) {
  const {
    mode = 'line',
    metric = 'price',
    showSma = false,
    showBenchmark = false,
    benchmark = [],
    zoom = 'all',
    dp = 2,
    markers = [],
    avgLong = null,
    avgShort = null,
    hoverX = null,
    roundSeconds = 900,
    emptyLabel = 'Waiting for market ticks…',
  } = opts;

  const rect = canvas.getBoundingClientRect?.();
  if (!rect) return null;
  const dpr = (typeof window !== 'undefined' && window.devicePixelRatio) || 1;
  const w = Math.max(80, rect.width);
  const h = Math.max(60, rect.height);
  if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
  }
  const ctx = canvas.getContext?.('2d');
  if (!ctx) return null;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);

  const C = {
    bg: '#071e2b',
    grid: 'rgba(120, 165, 188, 0.15)',
    axis: '#7fa1b5',
    line: '#f2c94c',
    lineGlow: 'rgba(242, 201, 76, 0.16)',
    sma: '#4fc3f7',
    up: '#2ecc71',
    down: '#eb5757',
    max: 'rgba(46, 204, 113, 0.75)',
    min: 'rgba(235, 87, 87, 0.75)',
    bmk: '#9b8cff',
    avgLong: '#2ecc71',
    avgShort: '#ff9f43',
    text: '#cfe6f2',
    dim: '#6c8ea2',
  };

  const padL = 6;
  const padR = 54;
  const padT = 10;
  const timeH = 16;
  const plotW = w - padL - padR;
  const plotH = h - padT - timeH;
  if (plotW < 24 || plotH < 24) return null;

  const fraction = ZOOM_FRACTION[zoom] ?? 1;
  const count = Math.max(6, Math.round(candles.length * fraction));
  const data = candles.slice(-count);
  if (!data.length) {
    ctx.fillStyle = C.dim;
    ctx.font = '11px ui-monospace, monospace';
    ctx.fillText(emptyLabel, 14, h / 2);
    return null;
  }

  const closes = data.map((c) => c[4]);
  const highs = data.map((c) => c[2]);
  const lows = data.map((c) => c[3]);
  const vols = data.map((c) => c[5]);
  const maxP = Math.max(...highs);
  const minP = Math.min(...lows);
  const pad = Math.max((maxP - minP) * 0.12, maxP * 0.0015);

  // Benchmark normalized on the visible window's first close
  let bmkSeries = [];
  if (showBenchmark && benchmark?.length) {
    const t0 = data[0][0];
    const b0 = benchmark.find((b) => b[0] >= t0)?.[1] ?? benchmark[0]?.[1] ?? 100;
    const price0 = closes[0];
    bmkSeries = benchmark
      .filter((b) => b[0] >= t0)
      .map(([t, v]) => [t, price0 * (v / b0)]);
  }

  let hi = maxP + pad;
  let lo = minP - pad;
  for (const [, v] of bmkSeries) { hi = Math.max(hi, v + pad * 0.4); lo = Math.min(lo, v - pad * 0.4); }
  for (const v of [avgLong, avgShort]) {
    if (Number.isFinite(v) && v > 0) { hi = Math.max(hi, v + pad * 0.2); lo = Math.min(lo, v - pad * 0.2); }
  }

  const isVol = metric === 'volume';
  const maxVol = Math.max(1, ...vols);
  const yPrice = (v) => padT + (1 - (v - lo) / (hi - lo || 1)) * plotH;
  const xAt = (i) => padL + (i / Math.max(1, data.length - 1)) * plotW;

  // Background
  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, w, h);

  // Grid + price axis
  ctx.font = '9px ui-monospace, monospace';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  for (let i = 0; i <= 4; i++) {
    const y = padT + (plotH * i) / 4;
    ctx.strokeStyle = C.grid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padL, Math.round(y) + 0.5);
    ctx.lineTo(padL + plotW, Math.round(y) + 0.5);
    ctx.stroke();
    const val = hi - ((hi - lo) * i) / 4;
    ctx.fillStyle = C.dim;
    ctx.fillText(isVol ? `${Math.round((maxVol * (1 - i / 4)) / 1000)}k` : fmt(val, dp), w - 5, y);
  }

  // Time axis labels
  const scale = (4 * 3600) / Math.max(1, roundSeconds);
  ctx.textAlign = 'center';
  for (let i = 0; i < 5; i++) {
    const idx = Math.round((data.length - 1) * (i / 4));
    const t = data[idx][0] + roundSeconds;
    const total = 13 * 3600 + t * scale;
    const hh = Math.floor(total / 3600) % 24;
    const mm = Math.floor((total % 3600) / 60);
    ctx.fillStyle = C.dim;
    ctx.fillText(`${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`, xAt(idx), h - 5);
  }

  // Volume histogram (always subtle; full height in VOLUME mode)
  for (let i = 0; i < data.length; i++) {
    const bh = (vols[i] / maxVol) * (isVol ? plotH * 0.86 : plotH * 0.16);
    const y = padT + plotH - bh;
    ctx.fillStyle = isVol
      ? (data[i][4] >= data[i][1] ? 'rgba(46,204,113,0.55)' : 'rgba(235,87,87,0.5)')
      : (data[i][4] >= data[i][1] ? 'rgba(46,204,113,0.16)' : 'rgba(235,87,87,0.14)');
    const bw = Math.max(1, plotW / data.length - 1);
    ctx.fillRect(xAt(i) - bw / 2, y, bw, bh);
  }

  if (!isVol) {
    if (mode === 'candles') {
      const bw = Math.max(1, plotW / data.length - 1);
      for (let i = 0; i < data.length; i++) {
        const [, o, hh, ll, c] = data[i];
        const up = c >= o;
        const color = up ? C.up : C.down;
        const x = xAt(i);
        ctx.strokeStyle = color;
        ctx.fillStyle = color;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x + 0.5, yPrice(Math.max(hh, ll)));
        ctx.lineTo(x + 0.5, yPrice(Math.min(hh, ll)));
        ctx.stroke();
        const yo = yPrice(o);
        const yc = yPrice(c);
        const top = Math.min(yo, yc);
        const bh = Math.max(1, Math.abs(yc - yo));
        if (bw >= 2) {
          if (up) ctx.fillRect(x - bw / 2, top, bw, bh);
          else {
            ctx.fillRect(x - bw / 2, top, bw, bh);
            ctx.strokeRect(x - bw / 2 + 0.5, top + 0.5, Math.max(1, bw - 1), Math.max(1, bh - 1));
          }
        } else {
          ctx.fillRect(x, top, 1, bh || 1);
        }
      }
    } else {
      // Gold price line with soft area
      const grad = ctx.createLinearGradient(0, padT, 0, padT + plotH);
      grad.addColorStop(0, 'rgba(242, 201, 76, 0.20)');
      grad.addColorStop(1, 'rgba(242, 201, 76, 0.01)');
      ctx.beginPath();
      ctx.moveTo(xAt(0), yPrice(closes[0]));
      for (let i = 1; i < data.length; i++) ctx.lineTo(xAt(i), yPrice(closes[i]));
      ctx.lineTo(xAt(data.length - 1), padT + plotH);
      ctx.lineTo(xAt(0), padT + plotH);
      ctx.closePath();
      ctx.fillStyle = grad;
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(xAt(0), yPrice(closes[0]));
      for (let i = 1; i < data.length; i++) ctx.lineTo(xAt(i), yPrice(closes[i]));
      ctx.strokeStyle = C.line;
      ctx.lineWidth = 1.6;
      ctx.lineJoin = 'round';
      ctx.stroke();
    }

    // SMA(20) computed on the full candle series
    if (showSma && candles.length > 5) {
      const period = 20;
      const start = candles.length - data.length;
      ctx.beginPath();
      let started = false;
      for (let i = 0; i < data.length; i++) {
        const absIdx = start + i;
        if (absIdx < period - 1) continue;
        let sum = 0;
        for (let k = absIdx - period + 1; k <= absIdx; k++) sum += candles[k][4];
        const v = sum / period;
        const x = xAt(i);
        const y = yPrice(v);
        if (!started) { ctx.moveTo(x, y); started = true; } else ctx.lineTo(x, y);
      }
      if (started) {
        ctx.strokeStyle = C.sma;
        ctx.lineWidth = 1.2;
        ctx.stroke();
      }
    }

    // BENCHMARK overlay
    if (bmkSeries.length > 1) {
      ctx.beginPath();
      let started = false;
      for (let i = 0; i < data.length; i++) {
        const b = bmkSeries.find(([t]) => t === data[i][0]) || bmkSeries[Math.min(i, bmkSeries.length - 1)];
        if (!b) continue;
        const x = xAt(i);
        const y = yPrice(b[1]);
        if (!started) { ctx.moveTo(x, y); started = true; } else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = C.bmk;
      ctx.lineWidth = 1.3;
      ctx.setLineDash([4, 3]);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Maximum / Minimum dotted lines
    const maxClose = Math.max(...highs);
    const minClose = Math.min(...lows);
    ctx.setLineDash([3, 3]);
    ctx.lineWidth = 1;
    ctx.strokeStyle = C.max;
    ctx.beginPath();
    ctx.moveTo(padL, yPrice(maxClose));
    ctx.lineTo(padL + plotW, yPrice(maxClose));
    ctx.stroke();
    ctx.strokeStyle = C.min;
    ctx.beginPath();
    ctx.moveTo(padL, yPrice(minClose));
    ctx.lineTo(padL + plotW, yPrice(minClose));
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.font = '8.5px ui-monospace, monospace';
    ctx.textAlign = 'left';
    ctx.fillStyle = C.max;
    ctx.fillText(`MAX ${fmt(maxClose, dp)}`, padL + 3, yPrice(maxClose) - 6);
    ctx.fillStyle = C.min;
    ctx.fillText(`MIN ${fmt(minClose, dp)}`, padL + 3, yPrice(minClose) + 8);

    // Average long / short position lines
    const drawAvg = (value, color, label) => {
      if (!Number.isFinite(value) || value <= 0) return;
      const y = yPrice(value);
      if (y < padT || y > padT + plotH) return;
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(padL, y);
      ctx.lineTo(padL + plotW, y);
      ctx.stroke();
      ctx.fillStyle = color;
      ctx.textAlign = 'right';
      ctx.font = '8.5px ui-monospace, monospace';
      ctx.fillText(label, padL + plotW - 3, y - 5);
    };
    drawAvg(avgLong, C.avgLong, 'AVERAGE LONG');
    drawAvg(avgShort, C.avgShort, 'AVERAGE SHORT');

    // Trade markers
    ctx.textAlign = 'center';
    for (const m of markers || []) {
      const idx = data.findIndex((c) => c[0] >= m.t);
      if (idx < 0) continue;
      const x = xAt(idx);
      const y = yPrice(m.price);
      const up = m.side === 'BUY';
      ctx.fillStyle = up ? C.up : C.down;
      ctx.beginPath();
      ctx.moveTo(x, y + (up ? 4 : -4));
      ctx.lineTo(x - 3, y + (up ? 9 : -9));
      ctx.lineTo(x + 3, y + (up ? 9 : -9));
      ctx.closePath();
      ctx.fill();
    }
  }

  // Hover crosshair + OHLC tooltip
  if (hoverX != null && hoverX >= padL && hoverX <= padL + plotW && data.length) {
    const idx = Math.round(((hoverX - padL) / plotW) * (data.length - 1));
    const c = data[Math.max(0, Math.min(data.length - 1, idx))];
    const x = xAt(idx);
    ctx.strokeStyle = 'rgba(207, 230, 242, 0.35)';
    ctx.setLineDash([2, 3]);
    ctx.beginPath();
    ctx.moveTo(x, padT);
    ctx.lineTo(x, padT + plotH);
    ctx.stroke();
    ctx.setLineDash([]);
    const total = 13 * 3600 + (c[0] + roundSeconds) * scale;
    const hh = String(Math.floor(total / 3600) % 24).padStart(2, '0');
    const mm = String(Math.floor((total % 3600) / 60)).padStart(2, '0');
    const lines = [
      `${hh}:${mm}`,
      `O ${fmt(c[1], dp)}  H ${fmt(c[2], dp)}`,
      `L ${fmt(c[3], dp)}  C ${fmt(c[4], dp)}`,
      `VOL ${Math.round(c[5]).toLocaleString('en-US')}`,
    ];
    const bw = 132;
    const bh = 13 * lines.length + 8;
    const bx = Math.min(w - bw - 4, Math.max(4, x + 8));
    const by = padT + 6;
    ctx.fillStyle = 'rgba(4, 21, 31, 0.93)';
    ctx.strokeStyle = 'rgba(32, 168, 230, 0.45)';
    ctx.lineWidth = 1;
    ctx.fillRect(bx, by, bw, bh);
    ctx.strokeRect(bx + 0.5, by + 0.5, bw, bh);
    ctx.textAlign = 'left';
    ctx.font = '9.5px ui-monospace, monospace';
    lines.forEach((line, i) => {
      ctx.fillStyle = i === 0 ? C.line : C.text;
      ctx.fillText(line, bx + 7, by + 13 + i * 13);
    });
  }

  ctx.textAlign = 'left';
  return { w, h };
}
