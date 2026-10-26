// Rendu du graphique de prix sur canvas (aucune dépendance externe).

const frNum = (v, d) => new Intl.NumberFormat('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d }).format(v);

export function aggregate(candles, bucketSim) {
  if (!candles?.length) return [];
  if (bucketSim <= 1) return candles;
  const out = [];
  let cur = null;
  for (const c of candles) {
    const b = Math.floor(c[0] / bucketSim);
    if (!cur || cur.b !== b) {
      cur = { b, t: b * bucketSim, o: c[1], h: c[2], l: c[3], c: c[4], v: c[5] };
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
    mode = 'line', ref = null, dpr = window.devicePixelRatio || 1,
    hoverX = null, maxPoints = 140, markers = [],
  } = opts;
  const rect = canvas.getBoundingClientRect();
  const w = Math.max(60, rect.width);
  const h = Math.max(60, rect.height);
  if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
  }
  const ctx = canvas.getContext?.('2d');
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);

  const C = {
    grid: 'rgba(29, 66, 88, 0.55)',
    axis: '#6f8ea3',
    line: '#ffb74d',
    up: '#23d47c',
    down: '#ff5d5d',
    vol: 'rgba(41, 182, 246, 0.22)',
  };

  const padR = 48, padL = 2, padT = 6, padB = 14;
  const volH = Math.round((h - padT - padB) * 0.18);
  const plotW = w - padL - padR;
  const plotH = h - padT - padB - volH - 6;
  const data = candles.slice(-maxPoints);

  if (!data.length || plotW < 10 || plotH < 10) {
    ctx.fillStyle = C.axis;
    ctx.font = '11px ui-monospace, monospace';
    ctx.fillText('En attente de cotations…', 10, h / 2);
    return;
  }

  let lo = Infinity, hi = -Infinity;
  for (const c of data) { lo = Math.min(lo, c.l); hi = Math.max(hi, c.h); }
  if (ref) { lo = Math.min(lo, ref); hi = Math.max(hi, ref); }
  const span = Math.max(hi - lo, hi * 0.0008);
  lo -= span * 0.10; hi += span * 0.10;
  const priceToY = (p) => padT + plotH - ((p - lo) / (hi - lo)) * plotH;
  const n = data.length;
  const xStep = plotW / Math.max(1, n - 1);
  const xAt = (i) => padL + (n === 1 ? plotW / 2 : i * xStep);

  // --- grille horizontale + axe des prix
  ctx.font = '9.5px ui-monospace, monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  const rows = 5;
  for (let r = 0; r <= rows; r++) {
    const p = lo + ((hi - lo) * r) / rows;
    const y = Math.round(priceToY(p)) + 0.5;
    ctx.strokeStyle = C.grid;
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(w - padR, y); ctx.stroke();
    ctx.fillStyle = C.axis;
    const dec = p >= 100 ? 1 : 2;
    ctx.fillText(frNum(p, dec), w - padR + 5, y);
  }

  // --- grille verticale + heures
  ctx.textAlign = 'center';
  const cols = Math.min(6, Math.max(2, Math.floor(plotW / 78)));
  for (let cIdx = 0; cIdx <= cols; cIdx++) {
    const i = Math.min(n - 1, Math.round((cIdx * (n - 1)) / cols));
    const x = Math.round(xAt(i)) + 0.5;
    ctx.strokeStyle = C.grid;
    ctx.beginPath(); ctx.moveTo(x, padT); ctx.lineTo(x, padT + plotH); ctx.stroke();
    const t = data[i][0];
    const total = 13 * 3600 + 2 * 60 + Math.round(t * 15);
    const hh = String(Math.floor(total / 3600) % 24).padStart(2, '0');
    const mm = String(Math.floor((total % 3600) / 60)).padStart(2, '0');
    ctx.fillStyle = C.axis;
    ctx.fillText(`${hh}:${mm}`, x, h - 5);
  }

  // --- ligne de référence (cours d'ouverture)
  if (ref) {
    const y = priceToY(ref);
    ctx.save();
    ctx.setLineDash([5, 4]);
    ctx.strokeStyle = 'rgba(255, 93, 93, 0.6)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(w - padR, y); ctx.stroke();
    ctx.restore();
    ctx.fillStyle = 'rgba(255, 120, 120, 0.85)';
    ctx.font = '8.5px ui-monospace, monospace';
    ctx.textAlign = 'left';
    ctx.fillText('OUV.', padL + 3, y - 7);
  }

  // --- volume
  const vMax = Math.max(...data.map((c) => c.v), 1);
  const volTop = padT + plotH + 6;
  data.forEach((c, i) => {
    const bh = (c.v / vMax) * volH;
    ctx.fillStyle = c.c >= c.o ? 'rgba(35, 212, 124, 0.28)' : 'rgba(255, 93, 93, 0.28)';
    const bw = Math.max(1, xStep * 0.62);
    ctx.fillRect(xAt(i) - bw / 2, volTop + (volH - bh), bw, bh);
  });

  // --- série
  if (mode === 'candles') {
    const bw = Math.max(1.5, xStep * 0.6);
    data.forEach((c, i) => {
      const up = c.c >= c.o;
      ctx.strokeStyle = up ? C.up : C.down;
      ctx.fillStyle = up ? C.up : C.down;
      const x = xAt(i);
      ctx.beginPath();
      ctx.moveTo(x, priceToY(c.h));
      ctx.lineTo(x, priceToY(c.l));
      ctx.stroke();
      const yo = priceToY(c.o), yc = priceToY(c.c);
      const top = Math.min(yo, yc), hh = Math.max(1, Math.abs(yc - yo));
      ctx.fillRect(x - bw / 2, top, bw, hh);
    });
  } else {
    const grad = ctx.createLinearGradient(0, padT, 0, padT + plotH);
    grad.addColorStop(0, 'rgba(255, 183, 77, 0.30)');
    grad.addColorStop(1, 'rgba(255, 183, 77, 0.00)');
    ctx.beginPath();
    data.forEach((c, i) => {
      const x = xAt(i), y = priceToY(c.c);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    if (mode === 'area') {
      ctx.save();
      ctx.lineTo(xAt(n - 1), padT + plotH);
      ctx.lineTo(xAt(0), padT + plotH);
      ctx.closePath();
      ctx.fillStyle = grad;
      ctx.fill();
      ctx.restore();
      ctx.beginPath();
      data.forEach((c, i) => {
        const x = xAt(i), y = priceToY(c.c);
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      });
    }
    ctx.strokeStyle = C.line;
    ctx.lineWidth = 1.6;
    ctx.shadowColor = 'rgba(255, 183, 77, 0.35)';
    ctx.shadowBlur = 6;
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  // --- dernier prix
  const last = data[n - 1];
  const lastY = priceToY(last.c);
  const up = last.c >= data[0].o;
  ctx.fillStyle = up ? C.up : C.down;
  ctx.beginPath();
  ctx.arc(xAt(n - 1), lastY, 2.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = up ? 'rgba(35, 212, 124, 0.9)' : 'rgba(255, 93, 93, 0.9)';
  const label = frNum(last.c, 2);
  const lw = ctx.measureText(label).width + 10;
  ctx.fillRect(w - padR + 2, lastY - 7, Math.min(padR - 4, lw), 14);
  ctx.fillStyle = '#04131d';
  ctx.textAlign = 'left';
  ctx.font = 'bold 9.5px ui-monospace, monospace';
  ctx.fillText(label, w - padR + 6, lastY);

  // --- marqueurs d'exécution client
  if (markers?.length) {
    const bucket = n > 1 ? data[n - 1].t - data[n - 2].t : 1;
    const t0 = data[0].t;
    for (const m of markers) {
      const i = (m.t - t0) / Math.max(1, bucket);
      if (i < 0 || i > n - 1) continue;
      const x = xAt(Math.round(i));
      const y = priceToY(m.price);
      ctx.beginPath();
      if (m.side === 'BUY') {
        // le client achète : nous vendons → triangle vers le haut au-dessus du prix
        ctx.moveTo(x, y - 7);
        ctx.lineTo(x - 3.4, y - 0.5);
        ctx.lineTo(x + 3.4, y - 0.5);
      } else {
        ctx.moveTo(x, y + 7);
        ctx.lineTo(x - 3.4, y + 0.5);
        ctx.lineTo(x + 3.4, y + 0.5);
      }
      ctx.closePath();
      ctx.fillStyle = m.side === 'BUY' ? 'rgba(35, 212, 124, 0.95)' : 'rgba(255, 93, 93, 0.95)';
      ctx.fill();
    }
  }

  // --- crosshair
  if (hoverX != null && hoverX >= padL && hoverX <= padL + plotW) {
    const i = Math.max(0, Math.min(n - 1, Math.round((hoverX - padL) / xStep)));
    const c = data[i];
    const x = xAt(i);
    ctx.save();
    ctx.strokeStyle = 'rgba(207, 227, 239, 0.28)';
    ctx.setLineDash([3, 3]);
    ctx.beginPath(); ctx.moveTo(x, padT); ctx.lineTo(x, padT + plotH); ctx.stroke();
    const y = priceToY(c.c);
    ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(w - padR, y); ctx.stroke();
    ctx.restore();
  }
  return { data, priceToY, xAt, padL, padR, plotW };
}
