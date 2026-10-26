// Highcharts-style AmplifyME canvas chart renderer (Price/Volume, Line/Candlestick, SMA, Navigator).

const usNum = (v, d) =>
  new Intl.NumberFormat('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }).format(v);

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

export function drawChart(canvas, candles, opts = {}) {
  const {
    mode = 'line',          // 'line' | 'candles'
    metric = 'price',       // 'price' | 'volume'
    showSma = false,
    showMarkers = true,
    ref = null,
    dpr = (typeof window !== 'undefined' && window.devicePixelRatio) || 1,
    hoverX = null,
    zoomRatio = 1,          // fraction of series shown (e.g. 0.25 .. 1.0)
    allCandles = null,
    markers = [],
  } = opts;

  const rect = canvas.getBoundingClientRect();
  const w = Math.max(80, rect.width);
  const h = Math.max(80, rect.height);
  if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
  }
  const ctx = canvas.getContext?.('2d');
  if (!ctx) return null;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);

  const C = {
    grid: 'rgba(130, 170, 190, 0.22)',
    axis: '#7fa1b5',
    line: '#e8b923',
    sma: '#29b6f6',
    up: '#2ecc71',
    down: '#e74c3c',
    navBg: 'rgba(8, 28, 40, 0.85)',
    navWindow: 'rgba(95, 165, 205, 0.24)',
    navBorder: 'rgba(140, 195, 225, 0.55)',
  };

  const navH = h >= 150 ? 22 : 0;
  const padL = 8;
  const padR = 46;
  const padT = 8;
  const timeAxisH = 16;
  const plotW = w - padL - padR;
  const plotH = h - padT - timeAxisH - (navH ? navH + 5 : 2);

  const fullSeries = allCandles?.length ? allCandles : candles;
  const data = candles;

  if (!data?.length || plotW < 20 || plotH < 20) {
    ctx.fillStyle = C.axis;
    ctx.font = '11px sans-serif';
    ctx.fillText('Waiting for market ticks…', 14, h / 2);
    return null;
  }

  const n = data.length;
  const xStep = plotW / Math.max(1, n - 1);
  const xAt = (i) => padL + (n === 1 ? plotW / 2 : i * xStep);

  // Y scale
  let lo = Infinity;
  let hi = -Infinity;
  if (metric === 'volume') {
    lo = 0;
    for (const c of data) hi = Math.max(hi, c.v);
    hi = Math.max(hi * 1.12, 1000);
  } else {
    for (const c of data) {
      lo = Math.min(lo, c.l);
      hi = Math.max(hi, c.h);
    }
    if (ref) {
      lo = Math.min(lo, ref);
      hi = Math.max(hi, ref);
    }
    const span = Math.max(hi - lo, (hi || 10) * 0.006);
    lo -= span * 0.10;
    hi += span * 0.10;
  }

  const valToY = (v) => padT + plotH - ((v - lo) / Math.max(1e-9, hi - lo)) * plotH;

  // Horizontal grid lines + right Y-axis labels
  ctx.font = '9.5px ui-monospace, monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  const rows = 5;
  for (let r = 0; r <= rows; r++) {
    const val = lo + ((hi - lo) * r) / rows;
    const y = Math.round(valToY(val)) + 0.5;
    ctx.strokeStyle = C.grid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padL, y);
    ctx.lineTo(padL + plotW, y);
    ctx.stroke();

    ctx.fillStyle = C.axis;
    if (metric === 'volume') {
      ctx.fillText(`${Math.round(val / 1000)}k`, padL + plotW + 4, y);
    } else {
      const dec = hi - lo > 12 ? 0 : val >= 100 ? 1 : 2;
      ctx.fillText(usNum(val, dec), padL + plotW + 4, y);
    }
  }

  // Vertical right-edge axis title ("price" or "volume", matching AmplifyME Highcharts)
  ctx.save();
  ctx.translate(w - 6, padT + plotH / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillStyle = '#698a9e';
  ctx.font = '9.5px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(metric === 'volume' ? 'volume' : 'price', 0, 0);
  ctx.restore();

  // X-axis timestamps (12:45 .. 13:25)
  ctx.textAlign = 'center';
  ctx.font = '9px ui-monospace, monospace';
  const cols = Math.min(7, Math.max(3, Math.floor(plotW / 66)));
  for (let cIdx = 0; cIdx <= cols; cIdx++) {
    const i = Math.min(n - 1, Math.round((cIdx * (n - 1)) / cols));
    const x = Math.round(xAt(i)) + 0.5;
    const simSec = data[i].t ?? data[i][0] ?? 0;
    const totalSec = Math.max(0, 13 * 3600 + Math.round(simSec * 9));
    const hh = String(Math.floor(totalSec / 3600) % 24).padStart(2, '0');
    const mm = String(Math.floor((totalSec % 3600) / 60)).padStart(2, '0');
    ctx.fillStyle = C.axis;
    ctx.fillText(`${hh}:${mm}`, x, padT + plotH + 9);
  }

  if (metric === 'volume') {
    const bw = Math.max(2, xStep * 0.65);
    data.forEach((c, i) => {
      const y = valToY(c.v);
      const bh = padT + plotH - y;
      ctx.fillStyle = c.c >= c.o ? 'rgba(46, 204, 113, 0.65)' : 'rgba(231, 76, 60, 0.65)';
      ctx.fillRect(xAt(i) - bw / 2, y, bw, Math.max(1, bh));
    });
  } else {
    // Reference open price dashed red horizontal line (exact match to image-1.png!)
    if (ref) {
      const yRef = Math.round(valToY(ref)) + 0.5;
      ctx.save();
      ctx.setLineDash([4, 3]);
      ctx.strokeStyle = 'rgba(231, 76, 60, 0.8)';
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.moveTo(padL, yRef);
      ctx.lineTo(padL + plotW, yRef);
      ctx.stroke();
      ctx.restore();
    }

    if (mode === 'candles') {
      const bw = Math.max(2, Math.min(9, xStep * 0.64));
      data.forEach((c, i) => {
        const up = c.c >= c.o;
        const col = up ? C.up : C.down;
        ctx.strokeStyle = col;
        ctx.fillStyle = col;
        const x = xAt(i);
        ctx.beginPath();
        ctx.moveTo(x, valToY(c.h));
        ctx.lineTo(x, valToY(c.l));
        ctx.stroke();
        const yo = valToY(c.o);
        const yc = valToY(c.c);
        const top = Math.min(yo, yc);
        const bh = Math.max(1.2, Math.abs(yc - yo));
        ctx.fillRect(x - bw / 2, top, bw, bh);
      });
    } else {
      // Crisp AmplifyME gold price line
      ctx.beginPath();
      data.forEach((c, i) => {
        const x = xAt(i);
        const y = valToY(c.c);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.strokeStyle = C.line;
      ctx.lineWidth = 1.65;
      ctx.lineJoin = 'round';
      ctx.stroke();
    }

    // Optional SMA(16) overlay
    if (showSma && data.length >= 4) {
      const win = Math.min(16, data.length);
      ctx.beginPath();
      let started = false;
      for (let i = 0; i < data.length; i++) {
        const start = Math.max(0, i - win + 1);
        let sum = 0;
        for (let k = start; k <= i; k++) sum += data[k].c;
        const avg = sum / (i - start + 1);
        const x = xAt(i);
        const y = valToY(avg);
        if (!started) { ctx.moveTo(x, y); started = true; } else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = C.sma;
      ctx.lineWidth = 1.3;
      ctx.stroke();
    }

    // Trade execution markers
    if (showMarkers && markers?.length) {
      const t0 = data[0].t;
      const tSpan = Math.max(1, (data[n - 1].t ?? n) - t0);
      for (const m of markers) {
        if (m.t < t0 || m.t > data[n - 1].t + 2) continue;
        const frac = (m.t - t0) / tSpan;
        const x = padL + frac * plotW;
        const y = valToY(m.price);
        ctx.beginPath();
        if (m.side === 'BUY') {
          ctx.moveTo(x, y - 6);
          ctx.lineTo(x - 3.5, y + 1);
          ctx.lineTo(x + 3.5, y + 1);
        } else {
          ctx.moveTo(x, y + 6);
          ctx.lineTo(x - 3.5, y - 1);
          ctx.lineTo(x + 3.5, y - 1);
        }
        ctx.closePath();
        ctx.fillStyle = m.side === 'BUY' ? C.up : C.down;
        ctx.fill();
      }
    }
  }

  // Hover crosshair
  if (hoverX != null && hoverX >= padL && hoverX <= padL + plotW) {
    const i = Math.max(0, Math.min(n - 1, Math.round((hoverX - padL) / xStep)));
    const c = data[i];
    const x = xAt(i);
    const y = valToY(metric === 'volume' ? c.v : c.c);
    ctx.save();
    ctx.strokeStyle = 'rgba(210, 235, 250, 0.35)';
    ctx.setLineDash([3, 3]);
    ctx.beginPath(); ctx.moveTo(x, padT); ctx.lineTo(x, padT + plotH); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(padL + plotW, y); ctx.stroke();
    ctx.restore();
  }

  // Bottom Navigator Minimap (matches Highcharts navigator at bottom of image-1.png!)
  if (navH > 0 && fullSeries?.length > 1) {
    const navTop = h - navH - 2;
    const navW = plotW;
    ctx.fillStyle = C.navBg;
    ctx.fillRect(padL, navTop, navW, navH);
    ctx.strokeStyle = 'rgba(110, 155, 180, 0.35)';
    ctx.strokeRect(padL + 0.5, navTop + 0.5, navW - 1, navH - 1);

    let nLo = Infinity;
    let nHi = -Infinity;
    for (const c of fullSeries) {
      const val = c.c ?? c[4];
      nLo = Math.min(nLo, val);
      nHi = Math.max(nHi, val);
    }
    const nSpan = Math.max(1e-6, nHi - nLo);
    ctx.beginPath();
    fullSeries.forEach((c, idx) => {
      const val = c.c ?? c[4];
      const nx = padL + (idx / Math.max(1, fullSeries.length - 1)) * navW;
      const ny = navTop + navH - 3 - ((val - nLo) / nSpan) * (navH - 6);
      if (idx === 0) ctx.moveTo(nx, ny);
      else ctx.lineTo(nx, ny);
    });
    ctx.strokeStyle = 'rgba(160, 205, 230, 0.65)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Shaded active zoom window on the right
    const winFrac = Math.max(0.12, Math.min(1, zoomRatio));
    const winW = navW * winFrac;
    const winX = padL + navW - winW;
    ctx.fillStyle = C.navWindow;
    ctx.fillRect(winX, navTop + 1, winW, navH - 2);
    ctx.strokeStyle = C.navBorder;
    ctx.strokeRect(winX + 0.5, navTop + 0.5, winW - 1, navH - 1);

    // Left & right navigator handles
    [winX, padL + navW - 3].forEach((hx) => {
      ctx.fillStyle = '#c8dce8';
      ctx.fillRect(hx, navTop + 5, 3, navH - 10);
    });
  }

  return { data, padL, padR, plotW };
}
