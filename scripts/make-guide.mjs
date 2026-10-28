// ---------------------------------------------------------------------------
// Generates public/guide-amplifyme-top1.pdf — a real, multi-page French PDF
// (no external dependency) covering the platform, the 11 AmplifyME gauges,
// classic traps and minute-by-minute plans to reach Top 1 %.
// ---------------------------------------------------------------------------
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'public', 'guide-amplifyme-top1.pdf');

const W = 595.28;
const H = 841.89;
const M = 44;
const CW = W - M * 2;

const C = {
  navy: '#0A2231',
  deep: '#061722',
  accent: '#1E9BD7',
  accent2: '#39C0F5',
  gold: '#E4B22C',
  goldSoft: '#F6E7B9',
  green: '#1F9D5B',
  red: '#C43D3D',
  amber: '#C98A15',
  text: '#142631',
  body: '#334A57',
  muted: '#6C818D',
  line: '#D6E2E8',
  panel: '#F2F7FA',
  panel2: '#E9F2F7',
  white: '#FFFFFF',
};

const hex = (h) => {
  const s = h.replace('#', '');
  return [parseInt(s.slice(0, 2), 16) / 255, parseInt(s.slice(2, 4), 16) / 255, parseInt(s.slice(4, 6), 16) / 255];
};
const rgbCmd = (h, stroke = false) => {
  const [r, g, b] = hex(h);
  return `${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)} ${stroke ? 'RG' : 'rg'}`;
};

const SPECIAL = {
  '—': '\x97', '–': '\x96', '’': '\x92', '‘': '\x91', '“': '\x93', '”': '\x94',
  '…': '\x85', '€': '\x80', 'œ': '\x9c', 'Œ': '\x8c', '•': '\x95', '™': '\x99',
  '→': '>', '←': '<', '≥': '>=', '≤': '<=', '≈': '~', '×': 'x', '−': '-',
  '‑': '-', '\u00a0': ' ', '✓': '>', '✔': '>', '✕': 'x', '🔊': '(son)', '📄': '',
};

function toWinAnsi(str) {
  let out = '';
  for (const ch of String(str)) {
    if (SPECIAL[ch] != null) { out += SPECIAL[ch]; continue; }
    const cp = ch.codePointAt(0);
    if (cp === 10 || cp === 13) { out += ch; continue; }
    if (cp <= 255) { out += ch; continue; }
    out += '?';
  }
  return out;
}

function pdfString(str) {
  const s = toWinAnsi(str);
  let out = '';
  for (const ch of s) {
    const cp = ch.codePointAt(0);
    if (ch === '\\') out += '\\\\';
    else if (ch === '(') out += '\\(';
    else if (ch === ')') out += '\\)';
    else if (cp > 126 || cp < 32) out += `\\${cp.toString(8).padStart(3, '0')}`;
    else out += ch;
  }
  return out;
}

// Helvetica AFM widths (1/1000 em)
const WIDTHS = {
  ' ': 278, '!': 278, '"': 355, '#': 556, $: 556, '%': 889, '&': 667, "'": 191,
  '(': 333, ')': 333, '*': 389, '+': 584, ',': 278, '-': 333, '.': 278, '/': 278,
  0: 556, 1: 556, 2: 556, 3: 556, 4: 556, 5: 556, 6: 556, 7: 556, 8: 556, 9: 556,
  ':': 278, ';': 278, '<': 584, '=': 584, '>': 584, '?': 556, '@': 1015,
  A: 667, B: 667, C: 722, D: 722, E: 667, F: 611, G: 778, H: 722, I: 278, J: 500,
  K: 667, L: 556, M: 833, N: 722, O: 778, P: 667, Q: 778, R: 722, S: 667, T: 611,
  U: 722, V: 667, W: 944, X: 667, Y: 667, Z: 611, '[': 278, '\\': 278, ']': 278,
  '^': 469, _: 556, '`': 333, a: 556, b: 556, c: 500, d: 556, e: 556, f: 278,
  g: 556, h: 556, i: 222, j: 222, k: 500, l: 222, m: 833, n: 556, o: 556, p: 556,
  q: 556, r: 333, s: 500, t: 278, u: 556, v: 500, w: 722, x: 500, y: 500, z: 500,
  '{': 334, '|': 260, '}': 334, '~': 584,
};
const ACCENT_BASE = {
  é: 'e', è: 'e', ê: 'e', ë: 'e', á: 'a', à: 'a', â: 'a', ä: 'a', ã: 'a', å: 'a',
  í: 'i', ì: 'i', î: 'i', ï: 'i', ó: 'o', ò: 'o', ô: 'o', ö: 'o', õ: 'o',
  ú: 'u', ù: 'u', û: 'u', ü: 'u', ç: 'c', ñ: 'n', ý: 'y', ÿ: 'y',
  É: 'E', È: 'E', Ê: 'E', Ë: 'E', Á: 'A', À: 'A', Â: 'A', Ä: 'A', Ã: 'A', Å: 'A',
  Í: 'I', Ì: 'I', Î: 'I', Ï: 'I', Ó: 'O', Ò: 'O', Ô: 'O', Ö: 'O', Õ: 'O',
  Ú: 'U', Ù: 'U', Û: 'U', Ü: 'U', Ç: 'C', Ñ: 'N', 'œ': 'oe', 'Œ': 'OE', '’': "'", '‘': "'", '“': '"', '”': '"',
  '—': '-', '–': '-', '…': '.', '•': '.', '€': 'EUR', '≥': '>=', '≤': '<=', '≈': '~', '×': 'x', '→': '>', '−': '-',
};

class Page {
  constructor({ header = null, section = null, pageNo = null, pagesTotal = null } = {}) {
    this.ops = [];
    this.y = 0;
    if (header) this.header(header, section, pageNo, pagesTotal);
    this.contentTop = header ? 74 : M;
    this.y = this.contentTop;
  }

  raw(s) { this.ops.push(s); }

  fill(hexColor) { this.raw(rgbCmd(hexColor)); }
  stroke(hexColor) { this.raw(rgbCmd(hexColor, true)); }

  rect(x, y, w, h, fill = null, stroke = null, lw = 0.8) {
    if (fill) { this.fill(fill); this.raw(`${x.toFixed(2)} ${(H - y - h).toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re f`); }
    if (stroke) {
      this.stroke(stroke); this.raw(`${lw} w`);
      this.raw(`${x.toFixed(2)} ${(H - y - h).toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re S`);
    }
  }

  line(x1, y1, x2, y2, color = C.line, lw = 0.8, dash = null) {
    this.stroke(color); this.raw(`${lw} w`);
    if (dash) this.raw(`[${dash}] 0 d`);
    this.raw(`${x1.toFixed(2)} ${(H - y1).toFixed(2)} m ${x2.toFixed(2)} ${(H - y2).toFixed(2)} l S`);
    if (dash) this.raw('[] 0 d');
  }

  circle(cx, cy, r, fill = null, stroke = null, lw = 0.8) {
    const k = 0.5522847498 * r;
    const path = [
      `${cx + r} ${H - cy} m`,
      `${cx + r} ${H - cy - k} ${cx + k} ${H - cy - r} ${cx} ${H - cy - r} c`,
      `${cx - k} ${H - cy - r} ${cx - r} ${H - cy - k} ${cx - r} ${H - cy} c`,
      `${cx - r} ${H - cy + k} ${cx - k} ${H - cy + r} ${cx} ${H - cy + r} c`,
      `${cx + k} ${H - cy + r} ${cx + r} ${H - cy + k} ${cx + r} ${H - cy} c`,
    ].join(' ');
    if (fill) { this.fill(fill); this.raw(`${path} f`); }
    if (stroke) { this.stroke(stroke); this.raw(`${lw} w ${path} S`); }
  }

  ring(cx, cy, r, thick, score, color, bg = '#DCE7EC') {
    const bgSteps = 72;
    let d = '';
    for (let i = 0; i <= bgSteps; i++) {
      const a = -Math.PI / 2 + (i / bgSteps) * Math.PI * 2;
      const x = cx + Math.cos(a) * r;
      const y = cy + Math.sin(a) * r;
      d += `${i === 0 ? '' : ' L '}${x.toFixed(2)} ${(H - y).toFixed(2)}`;
    }
    this.stroke(bg); this.raw(`${thick} w 1 J [ ] 0 d ${cx + r} ${H - cy} m${d} S`);
    const steps = Math.max(2, Math.round((score / 100) * 72));
    let d2 = '';
    for (let i = 0; i <= steps; i++) {
      const a = -Math.PI / 2 + (i / steps) * (score / 100) * Math.PI * 2;
      const x = cx + Math.cos(a) * r;
      const y = cy + Math.sin(a) * r;
      d2 += `${i === 0 ? '' : ' L '}${x.toFixed(2)} ${(H - y).toFixed(2)}`;
    }
    this.stroke(color); this.raw(`${thick} w 1 J ${cx + r} ${H - cy} m${d2} S`);
  }

  width(str, size, bold = false) {
    let total = 0;
    for (const ch of String(str)) {
      const base = ACCENT_BASE[ch] || ch;
      if (base.length > 1) total += 278 * base.length;
      else total += WIDTHS[base] ?? 520;
    }
    return (total / 1000) * size * (bold ? 1.045 : 1);
  }

  wrap(str, width, size, bold = false) {
    const words = String(str).split(/\s+/).filter(Boolean);
    const lines = [];
    let cur = '';
    for (const w of words) {
      const test = cur ? `${cur} ${w}` : w;
      if (this.width(test, size, bold) <= width || !cur) cur = test;
      else { lines.push(cur); cur = w; }
    }
    if (cur) lines.push(cur);
    return lines;
  }

  text(str, x, y, { size = 9, bold = false, color = C.text, align = 'left' } = {}) {
    if (!str) return;
    let xx = x;
    const wdt = this.width(str, size, bold);
    if (align === 'right') xx = x - wdt;
    else if (align === 'center') xx = x - wdt / 2;
    this.fill(color);
    this.raw(`BT /${bold ? 'F2' : 'F1'} ${size} Tf ${xx.toFixed(2)} ${(H - y - size * 0.78).toFixed(2)} Td (${pdfString(str)}) Tj ET`);
  }

  para(str, x, y, width, {
    size = 9, leading = 12.6, color = C.body, bold = false, after = 0, align = 'left',
  } = {}) {
    let yy = y;
    for (const [pi, block] of String(str).split('\n').entries()) {
      const lines = this.wrap(block, width, size, bold);
      for (const line of lines) {
        this.text(line, align === 'center' ? x + width / 2 : (align === 'right' ? x + width : x), yy, { size, bold, color, align });
        yy += leading;
      }
      if (pi < String(str).split('\n').length - 1) yy += 3;
    }
    return yy + after;
  }

  bullet(str, x, y, width, { size = 9, leading = 12.4, color = C.body, bulletColor = C.accent, after = 2.4, bold = false } = {}) {
    this.circle(x + 2.6, y + size * 0.42, 1.9, bulletColor);
    const yy = this.para(str, x + 10, y, width - 10, { size, leading, color, bold });
    return Math.max(yy, y + leading) + after;
  }

  label(str, x, y, width, color = C.muted, size = 6.8) {
    this.text(str.toUpperCase(), x, y, { size, bold: true, color });
    return y + 10;
  }

  panel(x, y, w, h, { fill = C.panel, stroke = C.line, lw = 0.7 } = {}) {
    this.rect(x, y, w, h, fill, stroke, lw);
  }

  header(title, section, pageNo, pagesTotal) {
    this.rect(0, 0, W, 58, C.navy);
    this.rect(0, 58, W, 2.2, C.gold);
    this.text('GUIDE TOP 1 %', M, 12, { size: 7.2, bold: true, color: C.gold });
    this.text(section ? `${section}` : 'CFA INSTITUTE × AMPLIFYME', M, 25, { size: 13.2, bold: true, color: C.white });
    this.text(title, M, 43, { size: 7.2, color: '#A9C3D0' });
    if (pageNo) {
      this.text(`${String(pageNo).padStart(2, '0')} / ${String(pagesTotal).padStart(2, '0')}`, W - M, 26, { size: 8.4, bold: true, color: C.white, align: 'right' });
      this.text('IB-55 · AM-55', W - M, 42, { size: 6.8, color: '#A9C3D0', align: 'right' });
    }
  }

  footer(pageNo, pagesTotal) {
    this.line(M, H - 32, W - M, H - 32, C.line, 0.6);
    this.text('CFA Institute × AmplifyME — Guide d’entraînement indépendant · tradelab-zlp6.onrender.com', M, H - 26, { size: 6.4, color: C.muted });
    this.text(`${pageNo} / ${pagesTotal}`, W - M, H - 26, { size: 6.4, color: C.muted, align: 'right' });
  }
}

// ------------------------------------------------------------------ builders
function badge(p, x, y, label, { bg = C.panel2, fg = C.accent, w = null, h = 15, size = 6.6 } = {}) {
  const width = w || p.width(label, size, true) + 10;
  p.rect(x, y, width, h, bg, null);
  p.text(label, x + 5, y + 3.6, { size, bold: true, color: fg });
  return width;
}

function kpiBox(p, x, y, w, h, value, label, { color = C.accent } = {}) {
  p.panel(x, y, w, h, { fill: C.panel });
  p.rect(x, y, 3, h, color);
  p.text(value, x + 11, y + 7, { size: 17, bold: true, color });
  p.text(label, x + 11, y + 30, { size: 6.6, color: C.muted });
}

function sectionTitle(p, num, title, subtitle = null, y = null) {
  let yy = y ?? p.y;
  p.text(String(num).padStart(2, '0'), M, yy, { size: 17, bold: true, color: C.gold });
  p.text(title, M + 30, yy + 1, { size: 15, bold: true, color: C.text });
  yy += 22;
  if (subtitle) yy = p.para(subtitle, M, yy, CW, { size: 9.2, color: C.muted, leading: 12.5 });
  p.line(M, yy + 3, W - M, yy + 3, C.line, 0.7);
  p.y = yy + 12;
  return p.y;
}

function gaugeBlock(p, x, y, w, code, label, weight, { color = C.accent, score = 92 } = {}) {
  p.ring(x + 22, y + 22, 16, 4.4, score, color);
  p.text(String(score), x + 22, y + 17, { size: 9, bold: true, color, align: 'center' });
  p.text(code, x + 44, y + 4, { size: 9.2, bold: true, color });
  p.text(`${label} · ${weight} %`, x + 44, y + 16, { size: 7.4, color: C.body });
  return y + 48;
}

function tableRow(p, x, y, cols, widths, { size = 8.2, bold = false, color = C.body, fill = null, h = 17 } = {}) {
  if (fill) p.rect(x, y, widths.reduce((a, b) => a + b, 0), h, fill);
  let xx = x;
  for (let i = 0; i < cols.length; i++) {
    p.text(cols[i], xx + 5, y + 5, { size, bold, color });
    xx += widths[i];
  }
  return y + h;
}

// ------------------------------------------------------------------- pages
const pages = [];
const TOTAL = 12;

function newPage(opts) {
  const p = new Page({ pageNo: pages.length + 1, pagesTotal: TOTAL, ...opts });
  pages.push(p);
  return p;
}

// 1. COVER ---------------------------------------------------------------
{
  const p = new Page();
  pages.push(p);
  p.rect(0, 0, W, H, C.navy);
  p.rect(0, 0, 9, H, C.gold);
  // decorative chart
  const pts = [[M, 610], [90, 592], [140, 598], [190, 560], [240, 568], [300, 512], [355, 524], [410, 460], [465, 472], [520, 408]];
  for (let i = 1; i < pts.length; i++) {
    p.line(pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1], i > 4 ? C.gold : C.accent, 1.2);
  }
  for (const [x, y] of pts) p.circle(x, y, 1.7, iColor(x), null);

  p.text('CFA INSTITUTE × AMPLIFYME', M, 70, { size: 8, bold: true, color: C.gold });
  p.text('INVESTING SIMULATOR', M, 92, { size: 9.2, bold: true, color: '#9FC3D4' });
  p.text('GUIDE', M, 134, { size: 68, bold: true, color: C.white });
  p.text('TOP 1 %', M, 196, { size: 68, bold: true, color: C.gold });
  p.text('IB-55 · Market Maker Sell-Side        AM-55 · Asset Manager $20M', M, 270, { size: 12.5, bold: true, color: C.white });
  p.para('Le manuel d’entraînement complet pour finir 1er aux deux exercices officiels : les 11 jauges de score, les pièges qui coûtent 20 à 40 points, les dépêches réelles et un plan d’action minute par minute.', M, 292, 430, { size: 10.2, color: '#BFD6E2', leading: 15 });

  p.rect(M, 366, 300, 1, '#2A4B60');
  const stats = [
    ['11', 'jauges officielles'],
    ['18', 'dépêches réelles'],
    ['90 %+', 'objectif Top 1 %'],
    ['8/15/30', 'min de round'],
  ];
  stats.forEach(([v, l], i) => {
    const x = M + i * 120;
    p.text(v, x, 386, { size: 22, bold: true, color: i === 2 ? C.gold : C.white });
    p.text(l, x, 413, { size: 7.4, color: '#93B4C5' });
  });

  // gauge strip
  p.text('LES 11 JAUGES AMPLIFYME', M, 452, { size: 7.4, bold: true, color: C.gold });
  const codes = [['COMM', 92], ['FFC', 100], ['CT', 88], ['SSRM', 84], ['ETM', 90], ['PnL', 86], ['BSRM', 91], ['ES', 88], ['RA', 90], ['ROI', 87], ['FFC', 100]];
  codes.forEach(([code, score], i) => {
    const x = M + 22 + i * 46;
    p.ring(x, 486, 14, 3.8, score, i >= 6 ? C.accent2 : C.gold, '#173B4E');
    p.text(String(score), x, 482, { size: 7.6, bold: true, color: C.white, align: 'center' });
    p.text(code, x, 509, { size: 6.2, bold: true, color: '#93B4C5', align: 'center' });
  });

  // links box
  p.rect(M, 548, CW, 128, '#0C2A3B', '#1B465C');
  p.text('ACCÈS DIRECT', M + 14, 562, { size: 7.2, bold: true, color: C.gold });
  p.text('GitHub', M + 14, 580, { size: 7.8, bold: true, color: C.white });
  p.text('github.com/Calvin29990/Traineur-calvin', M + 68, 580, { size: 8.2, color: C.accent2 });
  p.text('Application', M + 14, 600, { size: 7.8, bold: true, color: C.white });
  p.text('tradelab-zlp6.onrender.com', M + 68, 600, { size: 8.2, color: C.accent2 });
  p.text('Plateforme live', M + 14, 620, { size: 7.8, bold: true, color: C.white });
  p.text('flow936161.amplifyme.com/#main', M + 68, 620, { size: 8.2, color: C.accent2 });
  p.text('Guide PDF', M + 14, 640, { size: 7.8, bold: true, color: C.white });
  p.text('/guide-amplifyme-top1.pdf', M + 68, 640, { size: 8.2, color: C.accent2 });
  p.text('Simon Fraser University · Édition 2026 · Document pédagogique indépendant, non affilié au CFA Institute ni à AmplifyME.', M + 14, 662, { size: 6.4, color: '#8AAABC' });
  p.text('Préparé par Calvin MINANG — d’après la session live animée par Aaron Edmonds et le REX personnel.', M, 790, { size: 7, color: '#8AAABC' });
  p.text('Aucun argent réel. Aucun conseil en investissement.', W - M, 790, { size: 7, color: '#8AAABC', align: 'right' });
}

function iColor(x) {
  return x > 460 ? C.gold : C.accent;
}

// 2. SOMMAIRE / FORMULE ---------------------------------------------------
{
  const p = newPage({ header: 'Sommaire & formule de score', section: 'Le plan de bataille' });
  p.text('La formule gagnante', M, 80, { size: 20, bold: true, color: C.text });
  p.para('Le score AmplifyME n’est pas un concours de P&L. C’est un composite de jauges : vous pouvez gagner $743k et finir à 53 %, ou perdre de l’argent et rester au-dessus de la moyenne. Chaque jauge mesure un comportement de desk.', M, 110, CW, { size: 9.6, leading: 14 });

  p.rect(M, 150, CW, 62, C.navy);
  p.text('SCORE GLOBAL', M + 14, 162, { size: 7.4, bold: true, color: C.gold });
  p.text('Σ (score de jauge × poids) / 100', M + 14, 178, { size: 17, bold: true, color: C.white });
  p.text('IB-55 : 6 jauges  ·  AM-55 : 5 jauges  ·  objectif : chaque jauge ≥ 85 %', M + 14, 199, { size: 7.4, color: '#A9C3D0' });

  p.y = 232;
  sectionTitle(p, 1, 'Ce que contient ce guide', null, 232);
  const toc = [
    ['La plateforme en 60 secondes', 3, 'Univers exact, News Wire rouge, modes replay/dynamique, audio de salle.'],
    ['IB-55 : interface & 6 jauges', 4, 'Chat clients, Quote Ticket, Exchange, Chart, et ce que mesure chaque jauge.'],
    ['IB-55 : les 7 pièges', 5, 'Exposition non couverte, spreads 425/469, quotes snipées, dumps de 60k.'],
    ['IB-55 : plan minute par minute', 6, 'Le déroulé exact d’un round de 15 min, adaptable en 8 et 30 min.'],
    ['AM-55 : interface & 5 jauges', 7, 'Mandat $20M, 5 dealers, quotes en 1 clic, benchmark.'],
    ['AM-55 : les 7 pièges', 8, 'Cash à $3 701, 47 % sur MSFT, 88 trades, abus de l’Exchange.'],
    ['AM-55 : plan minute par minute', 9, 'Construire le portefeuille sans exploser le BSRM.'],
    ['Le REX décodé', 10, 'Pourquoi 53 % avec +$743k et 36 % avec 88 trades — et comment corriger.'],
    ['Les 18 dépêches officielles', 11, 'Round 1 & Round 2, avec la lecture directionnelle de chaque headline.'],
    ['Checklist & plan 7 jours', 12, 'Liens, raccourcis, progression et dernier contrôle avant le live.'],
  ];
  let yy = 252;
  toc.forEach(([title, page, desc], i) => {
    p.text(String(i + 1).padStart(2, '0'), M, yy, { size: 8, bold: true, color: C.gold });
    p.text(title, M + 24, yy, { size: 9.6, bold: true, color: C.text });
    p.text(String(page), W - M, yy, { size: 9.6, bold: true, color: C.accent, align: 'right' });
    p.para(desc, M + 24, yy + 13, CW - 30, { size: 8.1, color: C.muted, leading: 11.4 });
    p.line(M, yy + 29, W - M, yy + 29, C.line, 0.55);
    yy += 38;
  });

  p.rect(M, 660, CW, 100, C.panel2, C.line);
  p.text('LES 3 VéRITéS QUI FONT +30 POINTS', M + 12, 672, { size: 8, bold: true, color: C.accent });
  const truths = [
    '1. Le risque non couvert coûte plus cher que le P&L ne rapporte : -$4,8M d’exposition nette détruit ETM.',
    '2. Un spread hors marché (425/469 sur 445 = 494 bps) met SSRM à zéro et coupe le flux client (COMM, CT).',
    '3. La répétition sur le replay officiel est décisive : les 18 headlines sont connues, votre réaction doit être automatique.',
  ];
  let ty = 688;
  truths.forEach((t) => { ty = p.para(t, M + 12, ty, CW - 24, { size: 8.3, color: C.body, leading: 11.6 }); });
  p.footer(2, TOTAL);
}

// 3. PLATEFORME -----------------------------------------------------------
{
  const p = newPage({ header: 'La plateforme en 60 secondes', section: 'L’outil d’entraînement' });
  sectionTitle(p, 2, 'Un terminal complet, calibré sur AmplifyME', 'Tout ce que vous voyez ici existe dans l’application : replay officiel, news en rouge, carnet, chat, jauges et guide.', 78);

  const features = [
    ['01', 'Univers exact', 'BABA 476.93 (2 déc.), BP 40.277, HSBC 47.839, MSFT 404.85, VW 38.990 (3 déc.). Le REFPRICE est le mid live.'],
    ['02', 'News Wire temps réel', 'La dernière dépêche s’affiche en ROUGE vif en haut, puis repasse en blanc/gris. 18 headlines officielles + 18 stories dynamiques.'],
    ['03', 'Deux scénarios', 'Replay Round 1 & Round 2 réels (déterministe) ou mode dynamique (news variées). Choix du rôle de départ et de la durée 8/15/30 min.'],
    ['04', 'Audio de salle', 'Brouhaha, claviers, squawk sur breaking news, ping RFQ, fill et alertes de risque — synthétisés en Web Audio, sans fichier externe.'],
    ['05', 'Coach & jauges', '6 jauges IB / 5 jauges AM en temps réel, conseils contextuels, débrief de fin de round et score global classé sur 260 candidats.'],
    ['06', 'Guide & déploiement', 'Ce PDF est servi par l’application ; le code est sur GitHub et déployé sur Render à chaque merge sur main.'],
  ];
  let fy = 145;
  features.forEach(([n, title, desc], i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = M + col * (CW / 2 + 4);
    const y = fy + row * 92;
    p.panel(x, y, CW / 2 - 4, 84, { fill: i % 3 === 0 ? C.panel : C.white });
    p.text(n, x + 10, y + 8, { size: 7.2, bold: true, color: C.gold });
    p.text(title, x + 10, y + 19, { size: 10.2, bold: true, color: C.text });
    p.para(desc, x + 10, y + 34, CW / 2 - 24, { size: 7.9, color: C.body, leading: 10.8 });
  });

  p.y = 438;
  p.text('L’UNIVERS EXACT', M, 438, { size: 8, bold: true, color: C.accent });
  const widths = [80, 130, 100, 100, 96];
  tableRow(p, M, 450, ['TICKER', 'NOM', 'REFPRICE', 'DÉCIMALES', 'TYPE'], widths, { size: 6.6, bold: true, color: C.muted, fill: C.panel2, h: 16 });
  const uni = [
    ['BABA', 'Alibaba Group', '476.93', '2', 'Equity O'],
    ['BP', 'BP plc', '40.277', '3', 'Equity O'],
    ['HSBC', 'HSBC Holdings', '47.839', '3', 'Equity O'],
    ['MSFT', 'Microsoft', '404.85', '2', 'Equity O'],
    ['VW', 'Volkswagen AG', '38.990', '3', 'Equity O'],
  ];
  uni.forEach((row, i) => {
    tableRow(p, M, 466 + i * 16, row, widths, { size: 7.6, color: C.body, fill: i % 2 ? C.panel : null, h: 16 });
  });
  p.para('Attention aux décimales : un prix BP tapé à 40.28 au lieu de 40.277 est un fat finger potentiel. Le champ Quote Ticket arrondit au tick exact, mais vérifiez toujours le REFPRICE affiché.', M, 552, CW, { size: 8, color: C.muted, leading: 11 });

  p.rect(M, 582, CW, 96, C.navy);
  p.text('L’ACCÈS', M + 14, 594, { size: 7.2, bold: true, color: C.gold });
  p.text('Application Render', M + 14, 612, { size: 9, bold: true, color: C.white });
  p.text('https://tradelab-zlp6.onrender.com/', M + 130, 612, { size: 8.4, color: C.accent2 });
  p.text('Code source GitHub', M + 14, 632, { size: 9, bold: true, color: C.white });
  p.text('https://github.com/Calvin29990/Traineur-calvin', M + 130, 632, { size: 8.4, color: C.accent2 });
  p.text('Plateforme officielle', M + 14, 652, { size: 9, bold: true, color: C.white });
  p.text('https://flow936161.amplifyme.com/#main', M + 130, 652, { size: 8.4, color: C.accent2 });
  p.text('Déploiement continu : merge sur main → Render rebuild → URL live.', M + 14, 666, { size: 6.6, color: '#A9C3D0' });

  p.para('Comment lancer une session : choisissez le scénario (replay ou dynamique), la durée (8, 15 ou 30 min), le rôle de départ (IB-55 ou AM-55), puis « LANCER LA SESSION ». L’audio démarre avec le round ; le bouton 🔊 de la TopBar coupe le son et règle le volume.', M, 692, CW, { size: 8.2, color: C.body, leading: 11.4 });
  p.footer(3, TOTAL);
}

// 4. IB INTERFACE & GAUGES ----------------------------------------------
{
  const p = newPage({ header: 'IB-55 : interface & barème', section: 'Exercice 1 — Investment Bank' });
  sectionTitle(p, 3, 'Market Maker Sell-Side : votre desk', 'Vous êtes le market maker. Les clients AM et HF vous demandent des prix dans le chat ; vous cotez, vous encaissez la commission, puis vous gérez l’inventaire sur l’Exchange.', 78);

  const cards = [
    ['CHAT', 'Onglets IB Room / Deal Room + liste clients NAME | TEAM (Aaron AM-2, akshay AM-28…). Cliquez une demande pour préremplir le ticket.'],
    ['QUOTE TICKET', 'Ticker, validité 45 s, bid (client sell), offer (client buy), volumes, SEND QUOTE. En dessous : LIVE / OLD CHAT QUOTES.'],
    ['EXCHANGE', 'Vérifiez la profondeur par volume (↵), puis SELL/BUY. Un clip de 10k coûte beaucoup moins cher qu’un bloc de 60k.'],
    ['CHART', 'PRICE/VOLUME, LINE/CANDLESTICK, SMA, zoom 5/15/30/60/All, Maximum/Minimum et AVERAGE LONG/SHORT.'],
  ];
  let cy = 148;
  cards.forEach(([title, desc], i) => {
    const x = M + (i % 2) * (CW / 2 + 4);
    const y = cy + Math.floor(i / 2) * 62;
    p.panel(x, y, CW / 2 - 4, 55, { fill: i % 2 ? C.white : C.panel });
    p.text(title, x + 10, y + 8, { size: 8.4, bold: true, color: C.accent });
    p.para(desc, x + 10, y + 20, CW / 2 - 24, { size: 7.6, color: C.body, leading: 10.2 });
  });

  p.y = 278;
  sectionTitle(p, 4, 'Les 6 jauges IB-55', 'Chaque jauge est notée sur 100, puis pondérée. La somme des poids fait 100 %.', 278);

  const gauges = [
    ['COMM', 'Commission', '16', 'Commissions encaissées sur le flux client. Cible d’entraînement : $32 000. Chaque fill client paie 12 bps de notionnel.', 88],
    ['FFC', 'Fat Finger Count', '10', '100 % = zéro erreur. Bid ≥ offer, volume aberrant, prix > 30 % du REFPRICE : -25 points par erreur.', 100],
    ['CT', 'Chat Trades', '16', 'Nombre et volume de trades clients conclus en OTC. Cible : 12 fills / $28M de notionnel.', 86],
    ['SSRM', 'Sell-Side Risk Mgmt', '16', 'Compétitivité du spread autour du REFPRICE. 20–80 bps : optimal ; > 150 bps : jauge détruite.', 82],
    ['ETM', 'Exchange Trade Metrics', '17', 'Temps passé avec une exposition nette > $3M + qualité des clips de débouclage. Objectif : < $1M au gong.', 90],
    ['PnL', 'Total P&L', '25', 'Realised + Unrealised. Cible : $220 000. Un P&L négatif ne met pas la jauge à zéro si le risque est propre.', 84],
  ];
  let gy = 318;
  gauges.forEach(([code, label, weight, desc, score], i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = M + col * (CW / 2 + 4);
    const y = gy + row * 82;
    p.panel(x, y, CW / 2 - 4, 74, { fill: i === 5 ? '#FBF5E4' : C.panel });
    const color = i === 5 ? C.gold : (i === 1 ? C.green : C.accent);
    p.ring(x + 27, y + 33, 19, 4.8, score, color);
    p.text(String(score), x + 27, y + 27, { size: 10, bold: true, color, align: 'center' });
    p.text(code, x + 55, y + 9, { size: 10.2, bold: true, color: C.text });
    p.text(`${label} · ${weight} % du score`, x + 55, y + 22, { size: 7.4, bold: true, color: C.accent });
    p.para(desc, x + 55, y + 35, CW / 2 - 66, { size: 7.1, color: C.body, leading: 9.6 });
  });

  p.y = 578;
  p.rect(M, 588, CW, 66, '#F7FBFD', C.line);
  p.text('LE WORKFLOW EN 5 GESTES', M + 12, 599, { size: 7.4, bold: true, color: C.accent });
  const wf = [
    '1. Lisez la dépêche rouge, identifiez le titre et la direction.',
    '2. Ouvrez le client dans CHAT, cliquez la demande pour préremplir.',
    '3. Cotez 20–80 bps autour du REFPRICE, volumes ≥ taille demandée.',
    '4. Annulez les quotes live dès qu’une news tombe (anti-sniping).',
    '5. Couvrez l’inventaire par clips de 5–10k ; gardez le net < $3M.',
  ];
  let wy = 612;
  wf.forEach((t) => { p.text(t, M + 12, wy, { size: 7.6, color: C.body }); wy += 11; });

  p.para('Le P&L est la jauge la plus lourde (25 %), mais les cinq autres mesurent la qualité du desk. Un market maker discipliné à 0 fat finger, spreads 40 bps et inventaire couvert score 90 % même avec un P&L modeste.', M, 676, CW, { size: 8.2, color: C.body, leading: 11.2 });
  p.footer(4, TOTAL);
}

// 5. IB TRAPS -------------------------------------------------------------
{
  const p = newPage({ header: 'IB-55 : les 7 pièges qui coûtent le plus', section: 'Exercice 1 — Investment Bank' });
  sectionTitle(p, 5, 'Ce qui fait chuter un score IB', 'Les erreurs observées sur les sessions réelles et le REX. Pour chaque piège : le symptôme, la jauge touchée et le correctif.', 78);

  const traps = [
    ['Exposition nette non couverte', 'Terminer avec -$4,8M de net exposure (le cas du REX) fait chuter ETM et plombe le score malgré un P&L de +$743k.', 'ETM', 'Débouclez par clips de 5–10k dès $3M de net. Objectif < $1M au gong.'],
    ['Spread hors marché', '425 / 469 sur un titre à 445 = 494 bps de half-spread. SSRM tombe à zéro et aucun client ne traite : COMM et CT s’effondrent aussi.', 'SSRM · COMM · CT', 'Cotez 20–80 bps autour du REFPRICE. 425/469 n’est jamais une “marge de sécurité”.'],
    ['Quote laissée pendant une news', 'La dépêche déplace le mid au travers de votre offer : votre quote est snipée au pire prix.', 'SSRM · PnL', 'Annulez toutes les LIVE CHAT QUOTES dans la seconde qui suit une news.'],
    ['Volumes trop petits', 'Vous cotillez 5k pour une demande de 50k : le client refuse, CT ne monte pas.', 'CT', 'Affichez au moins la taille demandée (bidVol = offerVol = qty).'],
    ['Dumps sur l’Exchange', 'Vider 60k d’un coup élargit la profondeur et coûte 3 à 5 fois plus qu’un débouclage en clips.', 'ETM · PnL', 'Clips de 5–10k, 2 à 4 par minute si nécessaire.'],
    ['Fat fingers de saisie', 'Bid ≥ offer, prix à 550 sur un titre à 40, volume à 10x. Chaque erreur = -25 pts FFC.', 'FFC', 'Recentrez avec les boutons ±bps, relisez le REFPRICE avant SEND QUOTE.'],
    ['Rester passif dans le chat', 'Attendre que les clients viennent : peu de fills, commissions faibles, placement moyen.', 'COMM · CT', 'Relancez les clients après chaque news : “need a new price?”. Proactif = conversions.'],
  ];
  let ty = 142;
  traps.forEach(([title, desc, gauge, fix], i) => {
    p.panel(M, ty, CW, 82, { fill: i % 2 ? C.white : C.panel });
    p.text(String(i + 1).padStart(2, '0'), M + 10, ty + 10, { size: 15, bold: true, color: C.red });
    p.text(title, M + 40, ty + 9, { size: 9.8, bold: true, color: C.text });
    p.text(gauge, W - M - 10, ty + 9, { size: 7.2, bold: true, color: C.red, align: 'right' });
    p.para(desc, M + 40, ty + 24, CW - 130, { size: 7.6, color: C.body, leading: 10 });
    p.text('Correctif :', M + 40, ty + 55, { size: 7, bold: true, color: C.green });
    p.para(fix, M + 86, ty + 55, CW - 134, { size: 7.2, color: C.body, leading: 9.5 });
    ty += 88;
  });

  p.rect(M, ty + 2, CW, 74, '#FFF8E8', '#E8D3A0');
  p.text('LE PARADOXE DU REX', M + 12, ty + 13, { size: 7.6, bold: true, color: C.amber });
  p.para('+$743k de P&L, 95 % sur la jauge P&L… et 53 % de score global. La raison : ETM et SSRM ont été massacrées par une exposition non couverte et des spreads trop larges. Le P&L ne rachète jamais le risque.', M + 12, ty + 25, CW - 24, { size: 8.2, color: C.body, leading: 11 });
  p.footer(5, TOTAL);
}

// 6. IB MINUTE PLAN -------------------------------------------------------
{
  const p = newPage({ header: 'IB-55 : plan minute par minute', section: 'Exercice 1 — Investment Bank' });
  sectionTitle(p, 6, 'Le round de 15 minutes, minute par minute', 'Déroulé pour un round Standard. Pour 8 min, multipliez les temps par 0,53 ; pour 30 min, par 2. Gardez les mêmes enchaînements.', 78);

  const plan = [
    ['00:00 – 01:00', 'Lire la première dépêche, vérifier les 5 REFPRICE, identifier la direction (macro = panier).', 'Préparation'],
    ['01:00 – 03:00', 'Répondre aux 2–3 premières RFQ : spread 40–80 bps, volumes = taille demandée. Ouvrir un client par valeur.', 'COMM · CT · SSRM'],
    ['03:00 – 06:00', 'À chaque news : annuler les quotes live, recoter avec skew directionnel, encaisser le flux. Couvrir au-delà de $3M de net.', 'SSRM · ETM'],
    ['06:00 – 08:00', 'Mi-round : réduire l’inventaire en clips de 5–10k, vérifier la commission cumulée et le spread moyen.', 'ETM · COMM'],
    ['08:00 – 12:00', 'Deuxième vague de headlines : rester acheteur/vendeur côté news, relancer les clients silencieux, éviter les quotes larges.', 'CT · PnL'],
    ['12:00 – 14:00', 'Alerte “1 minute restante” : plus de nouvelle quote, déboucler le net en clips, annuler le reste.', 'ETM'],
    ['14:00 – 15:00', 'Vérifier Net Exposure < $1M, FFC = 0, aucune quote live. Le score est figé au gong.', 'Tout'],
  ];
  const tw = [92, 350, 65];
  tableRow(p, M, 140, ['TEMPS', 'ACTION', 'JAUGE'], tw, { size: 6.6, bold: true, color: C.muted, fill: C.panel2, h: 17 });
  plan.forEach((row, i) => {
    const y = 157 + i * 43;
    p.rect(M, y, CW, 41, i % 2 ? C.white : C.panel);
    p.text(row[0], M + 6, y + 7, { size: 8, bold: true, color: C.accent });
    p.para(row[1], M + 100, y + 5, 342, { size: 7.6, color: C.body, leading: 9.8 });
    p.text(row[2], W - M - 6, y + 7, { size: 6.6, bold: true, color: C.gold, align: 'right' });
  });

  p.y = 469;
  sectionTitle(p, 7, 'Les 3 réflexes qui font la différence', null, 469);
  const reflexes = [
    ['ANTI-SNIPE', 'Une dépêche tombe → ESC sur toutes les quotes. Le coût d’une quote snipée est toujours supérieur au spread espéré.'],
    ['SKEW', 'Si la news est haussière, remontez bid ET offer : vous achetez le flux vendeur avant la hausse, au lieu de vendre au mauvais prix.'],
    ['CLIPS', 'Un inventaire de 30k se déboucle en 3 clips de 10k, pas en un bloc. L’impact de profondeur est quadratique avec la taille.'],
  ];
  let ry = 500;
  reflexes.forEach(([title, text], i) => {
    const x = M + i * (CW / 3 + 2);
    p.panel(x, ry, CW / 3 - 4, 70, { fill: C.white });
    p.text(title, x + 9, ry + 8, { size: 7.4, bold: true, color: C.accent });
    p.para(text, x + 9, ry + 21, CW / 3 - 22, { size: 7.2, color: C.body, leading: 9.6 });
  });

  p.rect(M, 590, CW, 112, C.navy);
  p.text('OBJECTIFS CHIFFRÉS POUR UN ROUND STANDARD', M + 14, 603, { size: 7.4, bold: true, color: C.gold });
  const targets = [
    ['12+', 'trades clients'], ['$28M+', 'notionnel OTC'], ['$32k+', 'commissions'],
    ['< 80', 'bps spread moyen'], ['< $1M', 'net au gong'], ['0', 'fat finger'],
  ];
  targets.forEach(([v, l], i) => {
    const x = M + 14 + (i % 3) * 170;
    const y = 620 + Math.floor(i / 3) * 38;
    p.text(v, x, y, { size: 15, bold: true, color: i === 5 ? C.gold : C.white });
    p.text(l, x + 4, y + 18, { size: 6.6, color: '#A9C3D0' });
  });
  p.para('Si vous atteignez ces six chiffres, les six jauges sont au vert et le score dépasse 90 %.', M + 14, 690, CW - 28, { size: 7.4, color: '#A9C3D0' });
  p.footer(6, TOTAL);
}

// 7. AM INTERFACE & GAUGES ------------------------------------------------
{
  const p = newPage({ header: 'AM-55 : interface & barème', section: 'Exercice 2 — Asset Manager $20M' });
  sectionTitle(p, 8, 'Le mandat $20 000 000', 'Vous gérez un fonds actions de 20 M$. Vous demandez des prix aux banques (IB-2 → IB-57), vous exécutez en un clic, et vous gardez une réserve de cash saine.', 78);

  const rows = [
    ['TopBar (2 lignes)', 'Shares Owned, Realised P+L, Unrealised P+L, Available cash, Total PnL, Portfolio Value — puis Net Exposure et le badge AM-55.'],
    ['POSITIONS / BLOTTER', '7 colonnes + la 8e % OF PORTFOLIO en AM. Un badge rouge “X New Trades” signale l’activité.'],
    ['CHAT', 'AM Room, Deal Room et 5 dealers (IB-2, IB-14, IB-28, IB-41, IB-57). La quote dealer apparaît directement en bas du chat avec SELL/BUY.'],
    ['EXCHANGE', 'Spread volontairement plus large que les IB : c’est le fallback pour les urgences, pas le canal principal.'],
    ['CHART', 'Bouton BENCHMARK : compare votre titre à l’indice équipondéré des 5 valeurs.'],
  ];
  let ry = 146;
  rows.forEach(([title, desc], i) => {
    p.panel(M, ry, CW, 34, { fill: i % 2 ? C.white : C.panel });
    p.text(title, M + 9, ry + 6, { size: 7.8, bold: true, color: C.accent });
    p.para(desc, M + 122, ry + 5, CW - 132, { size: 7.2, color: C.body, leading: 9.2 });
    ry += 37;
  });

  p.y = 330;
  sectionTitle(p, 9, 'Les 5 jauges AM-55', 'Le BSRM et le ROI pèsent 54 % du score : le risque et le rendement d’abord.', 330);

  const amGauges = [
    ['BSRM', 'Buy-Side Risk Mgmt', '24', 'Cash 5–15 %, aucune ligne > 20 %, 4–5 valeurs ≥ 3 %, 10–35 trades. Un cash à $3 701 ou 47 % sur MSFT détruit la jauge.', 56],
    ['ES', 'Execution Score', '18', 'Prix d’exécution vs REFPRICE. Cible < 12 bps. Shopper 3 dealers bat systématiquement l’Exchange.', 88],
    ['FFC', 'Fat Finger Count', '8', '100 % si zéro erreur de taille ou d’exécution. Chaque erreur coûte 25 points.', 100],
    ['RA', 'Risk Appetite', '20', 'Alignement des trades avec les news (62 %) et exposition brute 55–110 % du fonds (38 %).', 86],
    ['ROI', 'Return on Investment', '30', 'Rendement sur $20M. Cible +2 % ($400k) pour 100 %. Un ROI négatif ne met pas tout à zéro si le risque est maîtrisé.', 82],
  ];
  let gy = 370;
  amGauges.forEach(([code, label, weight, desc, score], i) => {
    const y = gy + i * 68;
    p.panel(M, y, CW, 61, { fill: i === 4 ? '#FBF5E4' : (i % 2 ? C.white : C.panel) });
    const color = i === 4 ? C.gold : (i === 1 ? C.green : C.accent);
    p.ring(M + 27, y + 28, 18, 4.6, score, color);
    p.text(String(score), M + 27, y + 23, { size: 9.6, bold: true, color, align: 'center' });
    p.text(code, M + 55, y + 7, { size: 9.8, bold: true, color: C.text });
    p.text(`${label} · ${weight} %`, M + 55, y + 20, { size: 7.2, bold: true, color: C.accent });
    p.para(desc, M + 190, y + 7, CW - 200, { size: 7.4, color: C.body, leading: 9.6 });
  });

  p.rect(M, 720, CW, 58, C.panel2, C.line);
  p.text('RÈGLES DE MANDAT À NE PAS FRANCHIR', M + 12, 731, { size: 7.2, bold: true, color: C.accent });
  p.text('Cash 5–15 %  ·  ligne max 20 %  ·  brut 55–110 %  ·  trades 10–35  ·  0 fat finger', M + 12, 746, { size: 8.2, bold: true, color: C.text });
  p.text('Le hard cap de $12M par ligne existe, mais viser 47 % est un choix perdant : BSRM s’effondre bien avant.', M + 12, 762, { size: 7.2, color: C.muted });

  p.footer(7, TOTAL);
}

// 8. AM TRAPS -------------------------------------------------------------
{
  const p = newPage({ header: 'AM-55 : les 7 pièges qui coûtent le plus', section: 'Exercice 2 — Asset Manager' });
  sectionTitle(p, 9, 'Ce qui fait chuter un score AM', 'Le REX est sans ambiguïté : 36 % de score avec un cash vidé à $3 701, 47 % sur MSFT et 88 trades. Voici les correctifs.', 78);

  const traps = [
    ['Vider tout le cash', 'Terminer avec $3 701 de cash (0,02 % du fonds) met BSRM à zéro : plus aucune marge de manœuvre si une news tombe.', 'BSRM', 'Conservez 5–15 % de cash. Après chaque achat, vérifiez Available cash dans la TopBar.'],
    ['Concentration à 47 %', '47 % du portefeuille sur MSFT : un mouvement de -5 % coûte 2,35 % au fonds et la jauge BSRM chute.', 'BSRM · RA', '5–15 % par ligne, 4 à 5 valeurs. Rééquilibrez après chaque gros mouvement.'],
    ['Sur-trading (88 trades)', '88 trades sur un round : commissions, bruit, FFC et BSRM se dégradent sans améliorer le ROI.', 'BSRM · ES', '10–35 trades de qualité. Une exécution par catalyseur suffit.'],
    ['Abuser de l’Exchange', 'Le spread AM y est plus large que les quotes IB : chaque bloc exécuté à l’Exchange coûte 30–60 bps de plus.', 'ES · ROI', 'Shoppez 3 dealers, comparez, exécutez la meilleure quote en 1 clic.'],
    ['Ignorer la direction des news', 'Trader contre le signal macro/micro fait baisser RA et le ROI en même temps.', 'RA · ROI', 'Lisez la dépêche rouge, puis traitez dans le sens du choc.'],
    ['Payer des fat fingers', 'Taille > volume coté, quantité à 0, demande > $12M : erreurs comptées, exécution bloquée.', 'FFC', 'Utilisez les boutons rapides et vérifiez la taille avant SELL/BUY.'],
    ['Trop peu diversifier', 'Deux lignes seulement : la jauge de diversification reste basse et le drawdown explose.', 'BSRM', 'Visez 4–5 lignes ≥ 3 %, avec des pondérations 5–15 %.'],
  ];
  let ty = 142;
  traps.forEach(([title, desc, gauge, fix], i) => {
    p.panel(M, ty, CW, 79, { fill: i % 2 ? C.white : C.panel });
    p.text(String(i + 1).padStart(2, '0'), M + 10, ty + 9, { size: 14, bold: true, color: C.red });
    p.text(title, M + 39, ty + 8, { size: 9.4, bold: true, color: C.text });
    p.text(gauge, W - M - 10, ty + 9, { size: 7, bold: true, color: C.red, align: 'right' });
    p.para(desc, M + 39, ty + 22, CW - 100, { size: 7.4, color: C.body, leading: 9.6 });
    p.text('Correctif :', M + 39, ty + 50, { size: 7, bold: true, color: C.green });
    p.para(fix, M + 84, ty + 50, CW - 96, { size: 7.2, color: C.body, leading: 9.2 });
    ty += 84;
  });

  p.rect(M, ty + 4, CW, 58, '#FFF8E8', '#E8D3A0');
  p.text('LE PIÈGE DU “TOUT INVESTI”', M + 12, ty + 15, { size: 7.4, bold: true, color: C.amber });
  p.para('Un fonds 100 % investi avec 0 % de cash paraît performant sur un marché haussier, mais il n’a plus d’option. AmplifyME valorise la capacité à réagir : garder 5–15 % de cash est un choix gagnant, pas une sous-performance.', M + 12, ty + 26, CW - 24, { size: 7.8, color: C.body, leading: 10.4 });
  p.footer(8, TOTAL);
}

// 9. AM MINUTE PLAN -------------------------------------------------------
{
  const p = newPage({ header: 'AM-55 : plan minute par minute', section: 'Exercice 2 — Asset Manager' });
  sectionTitle(p, 10, 'Construire le portefeuille sans exploser le BSRM', 'Round Standard de 15 minutes. Adaptez les durées (×0,53 en 8 min, ×2 en 30 min) mais gardez l’ordre des priorités.', 78);

  const plan = [
    ['00:00 – 01:30', 'Lire la première news, vérifier les REFPRICE, choisir 2–3 valeurs exposées. Ne pas acheter “le marché” sans direction.', 'RA'],
    ['01:30 – 04:00', 'Premier catalyseur : demander un prix à 3 dealers (ou SHOP ALL 5), comparer, exécuter la meilleure quote. Taille 3–5 % par ligne.', 'ES · ROI'],
    ['04:00 – 07:00', 'Deuxième news : ajouter dans la direction, diversifier vers 4–5 lignes, garder chaque poids entre 5 et 15 %.', 'BSRM · RA'],
    ['07:00 – 10:00', 'Zone macro : ajuster les pondérations, prendre quelques profits sur les gagnants, conserver 5–15 % de cash.', 'BSRM · ROI'],
    ['10:00 – 13:00', 'Dernière vague : ne plus créer de concentration > 20 %, éviter les trades de panique, vérifier le coût moyen d’exécution.', 'ES · BSRM'],
    ['13:00 – 14:00', 'Préparer le gong : pas de nouvelle ligne, vérifier cash > 5 %, FFC = 0, aucune position > 20 %.', 'Tout'],
    ['14:00 – 15:00', 'Geler le portefeuille. Le Portfolio Value final et le ROI sont calculés au gong.', 'ROI'],
  ];
  const tw = [86, 368, 55];
  tableRow(p, M, 140, ['TEMPS', 'ACTION', 'JAUGE'], tw, { size: 6.6, bold: true, color: C.muted, fill: C.panel2, h: 17 });
  plan.forEach((row, i) => {
    const y = 157 + i * 42;
    p.rect(M, y, CW, 40, i % 2 ? C.white : C.panel);
    p.text(row[0], M + 6, y + 7, { size: 7.8, bold: true, color: C.accent });
    p.para(row[1], M + 96, y + 5, 360, { size: 7.5, color: C.body, leading: 9.6 });
    p.text(row[2], W - M - 6, y + 7, { size: 6.6, bold: true, color: C.gold, align: 'right' });
  });

  p.y = 468;
  sectionTitle(p, 11, 'La méthode de shopping des dealers', null, 468);
  const dealers = [
    ['IB-2', 'MSFT · BABA', 'Tech US/Asie — souvent la meilleure sur MSFT'],
    ['IB-14', 'BP · VW', 'Énergie & auto — la référence sur BP/VW'],
    ['IB-28', 'HSBC · MSFT', 'Banques & mega-cap — rapide, spread variable'],
    ['IB-41', 'VW · BABA', 'Européen & Asie — bon en VW'],
    ['IB-57', 'HSBC · BP', 'Banks & Energy — alternative crédible'],
  ];
  tableRow(p, M, 498, ['MM', 'SPÉCIALITÉ', 'QUAND LA CHOISIR'], [60, 110, 340], { size: 6.6, bold: true, color: C.muted, fill: C.panel2, h: 16 });
  dealers.forEach((d, i) => {
    tableRow(p, M, 514 + i * 17, d, [60, 110, 340], { size: 7.4, color: C.body, fill: i % 2 ? C.panel : null, h: 17 });
  });

  p.rect(M, 610, CW, 94, C.navy);
  p.text('OBJECTIFS CHIFFRÉS POUR UN ROUND STANDARD', M + 14, 622, { size: 7.4, bold: true, color: C.gold });
  const targets = [
    ['5–15 %', 'de cash'], ['5–15 %', 'par ligne'], ['4–5', 'lignes'],
    ['10–35', 'trades'], ['< 12 bps', 'coût moyen'], ['+2 %', 'ROI ($400k)'],
  ];
  targets.forEach(([v, l], i) => {
    const x = M + 14 + (i % 3) * 170;
    const y = 640 + Math.floor(i / 3) * 30;
    p.text(v, x, y, { size: 14, bold: true, color: i === 5 ? C.gold : C.white });
    p.text(l, x + 4, y + 16, { size: 6.5, color: '#A9C3D0' });
  });
  p.footer(9, TOTAL);
}

// 10. REX DECODED ---------------------------------------------------------
{
  const p = newPage({ header: 'Le REX décodé', section: 'Pourquoi les scores s’effondrent' });
  sectionTitle(p, 12, 'Deux sessions, deux diagnostics', 'Les cas réels du REX : ce sont les schémas que le coach détecte et que les jauges sanctionnent.', 78);

  // case IB
  p.panel(M, 140, CW, 238, { fill: '#FDF4F4', stroke: '#E8C0C0' });
  p.text('CAS 1 — IB-55', M + 14, 152, { size: 7.4, bold: true, color: C.red });
  p.text('+$743 000 de P&L, 95 % sur la jauge P&L… mais 53 % au global', M + 14, 168, { size: 13, bold: true, color: C.text });
  p.text('Score global', M + 14, 192, { size: 6.8, color: C.muted });
  p.text('53 %', M + 14, 204, { size: 30, bold: true, color: C.red });
  p.text('P&L', M + 134, 192, { size: 6.8, color: C.muted });
  p.text('+$743k', M + 134, 204, { size: 20, bold: true, color: C.green });
  p.text('Exposition nette', M + 262, 192, { size: 6.8, color: C.muted });
  p.text('-$4,8M', M + 262, 204, { size: 20, bold: true, color: C.red });
  p.text('Spread extrême', M + 382, 192, { size: 6.8, color: C.muted });
  p.text('425/469', M + 382, 204, { size: 18, bold: true, color: C.red });

  const diag = [
    'ETM : l’exposition nette de -$4,8M n’a jamais été couverte. Même avec un P&L excellent, la jauge tombe à quelques points.',
    'SSRM : une fourchette 425/469 sur un titre à $445 représente 494 bps de half-spread. Aucun client ne traite à ce prix, et la jauge est à zéro.',
    'COMM / CT : sans flux client, les deux jauges de commissions et de volume restent basses, alors qu’elles pèsent 32 % du score.',
    'PnL : 95 % ne suffit pas. Le score est une moyenne pondérée : 0 en ETM et SSRM annule le bénéfice du P&L.',
  ];
  let dy = 226;
  diag.forEach((t) => { dy = p.bullet(t, M + 14, dy, CW - 28, { size: 7.6, leading: 10, color: C.body }); });

  // case AM
  p.panel(M, 392, CW, 238, { fill: '#FDF4F4', stroke: '#E8C0C0' });
  p.text('CAS 2 — AM-55', M + 14, 404, { size: 7.4, bold: true, color: C.red });
  p.text('$3 701 de cash, 47 % sur MSFT, 88 trades… 36 % au global', M + 14, 420, { size: 13, bold: true, color: C.text });
  p.text('Score global', M + 14, 444, { size: 6.8, color: C.muted });
  p.text('36 %', M + 14, 456, { size: 30, bold: true, color: C.red });
  p.text('Cash final', M + 134, 444, { size: 6.8, color: C.muted });
  p.text('$3 701', M + 134, 456, { size: 20, bold: true, color: C.red });
  p.text('Poids MSFT', M + 262, 444, { size: 6.8, color: C.muted });
  p.text('47 %', M + 262, 456, { size: 20, bold: true, color: C.red });
  p.text('Trades', M + 382, 444, { size: 6.8, color: C.muted });
  p.text('88', M + 382, 456, { size: 20, bold: true, color: C.red });

  const diag2 = [
    'BSRM : cash vidé à 0,02 % du fonds et 47 % sur une seule ligne. Les deux composantes majeures de la jauge sont à zéro.',
    'Sur-trading : 88 trades multiplient les commissions et les petites erreurs sans améliorer le ROI ; la jauge de discipline chute.',
    'ES : les blocs exécutés sur l’Exchange (plus large que les IB) font monter le coût moyen au-dessus de 30 bps.',
    'ROI : sans cash, impossible d’acheter la news suivante. Le rendement se bloque, alors que le mandat exige de la réactivité.',
  ];
  let dy2 = 478;
  diag2.forEach((t) => { dy2 = p.bullet(t, M + 14, dy2, CW - 28, { size: 7.6, leading: 10, color: C.body }); });

  p.rect(M, 648, CW, 110, C.navy);
  p.text('LES 5 LEVIERS QUI FONT +20 POINTS', M + 14, 660, { size: 7.4, bold: true, color: C.gold });
  const levers = [
    '1. Annuler chaque quote live dès qu’une news tombe.',
    '2. Déboucler en clips de 5–10k et finir sous $1M de net.',
    '3. Coter 20–80 bps autour du REFPRICE, jamais 400+.',
    '4. Garder 5–15 % de cash et 5–15 % par ligne en AM.',
    '5. Shopper 3 dealers avant chaque bloc > $2M.',
  ];
  let ly = 676;
  levers.forEach((l) => { p.text(l, M + 14, ly, { size: 7.8, color: '#CFE3EE' }); ly += 13; });
  p.footer(10, TOTAL);
}

// 11. OFFICIAL NEWS -------------------------------------------------------
{
  const p = newPage({ header: 'Les 18 dépêches officielles', section: 'Replay Round 1 & Round 2' });
  p.text('Round 1 — 12 dépêches', M, 78, { size: 12, bold: true, color: C.text });
  p.text('Direction attendue', M + 300, 78, { size: 7, bold: true, color: C.muted });

  const round1 = [
    ['MACRO', 'The Federal Reserve, US Central Bank, cut interest rates to 0% and relaunch quantitative easing', 'HAUSSE'],
    ['MSFT', 'Microsoft become the second company in history to reach a market cap of $1 trillion', 'HAUSSE'],
    ['VW', 'VW announce delays in the development of their all electric SUV', 'BAISSE'],
    ['MACRO', "Donald Trump tweets his approval of the Fed's latest stimulus plan", 'HAUSSE'],
    ['HSBC', 'UK Government announces a one-off tax on bank profits', 'BAISSE'],
    ['BABA', 'Alibaba wow the tech world by announcing the launch of their new smartphone AliPhone.', 'HAUSSE'],
    ['NOTE', 'We are now half way through Round 1, there are 15 minutes left of trading', 'NEUTRE'],
    ['MSFT', 'Microsoft announce much better than expected earnings for Q1', 'HAUSSE'],
    ['BP', 'OPEC increase their oil demand forecasts for this year and next year', 'HAUSSE'],
    ['VW', 'VW announce their Q2 earnings slightly below analyst expectations at $62bn', 'BAISSE'],
    ['MACRO', 'China announce better than expected economic data', 'HAUSSE'],
    ['MACRO', 'Federal Reserve Chairman Jerome Powell urges US Government deliver a Fiscal Stimulus package.', 'HAUSSE'],
  ];
  let ny = 94;
  round1.forEach(([tk, text, dir], i) => {
    if (i % 2 === 0 && i > 0) { /* keep spacing */ }
    p.rect(M, ny, 34, 11, dir === 'HAUSSE' ? '#E7F6EE' : dir === 'BAISSE' ? '#FBEAEA' : C.panel2);
    p.text(tk, M + 4, ny + 2.4, { size: 5.9, bold: true, color: dir === 'HAUSSE' ? C.green : dir === 'BAISSE' ? C.red : C.muted });
    p.para(text, M + 40, ny + 1.4, CW - 118, { size: 7.1, color: C.body, leading: 8.8 });
    const lines = p.wrap(text, CW - 118, 7.1).length;
    p.text(dir, W - M, ny + 2, { size: 5.8, bold: true, color: dir === 'HAUSSE' ? C.green : dir === 'BAISSE' ? C.red : C.muted, align: 'right' });
    ny += Math.max(15, lines * 8.8 + 3);
  });

  p.text('Round 2 — 6 dépêches', M, 404, { size: 12, bold: true, color: C.text });
  const round2 = [
    ['HSBC', 'HSBC CEO resigns with immediate effect. UK Gov announces full enquiry...', 'BAISSE'],
    ['MSFT', "Microsoft announce they are in final stages of purchasing TikTok's US operations", 'HAUSSE'],
    ['VW', 'VW announce a new battery supplier to coincide with journalist publishing 5 star reviews for new SUV', 'HAUSSE'],
    ['MACRO', 'US Government announce a record breaking $2 trillion economic rescue package', 'HAUSSE'],
    ['MACRO', "US President Trump signals his approval of the Microsoft acquisition of TikTok's US operations", 'HAUSSE'],
    ['BABA', 'Jack Ma, storms out of press conference after refusing to confirm a new AliPhone delivery date.', 'BAISSE'],
  ];
  let ry = 420;
  round2.forEach(([tk, text, dir], i) => {
    p.rect(M, ry, 34, 11, dir === 'HAUSSE' ? '#E7F6EE' : '#FBEAEA');
    p.text(tk, M + 4, ry + 2.4, { size: 5.9, bold: true, color: dir === 'HAUSSE' ? C.green : C.red });
    p.para(text, M + 40, ry + 1.4, CW - 118, { size: 7.1, color: C.body, leading: 8.8 });
    const lines = p.wrap(text, CW - 118, 7.1).length;
    p.text(dir, W - M, ry + 2, { size: 5.8, bold: true, color: dir === 'HAUSSE' ? C.green : C.red, align: 'right' });
    ry += Math.max(15, lines * 8.8 + 3);
  });

  p.para('Ces 18 dépêches sont rejouées à l’identique en mode Scénario Officiel. Le NOTE “half way” n’a aucun impact prix : c’est un signal de gestion du risque. En mode dynamique, des headlines supplémentaires (résultats, M&A, réglementaire, CPI, tarifs) sont tirées aléatoirement.', M, 530, CW, { size: 7.8, color: C.muted, leading: 10.4 });

  p.rect(M, 566, CW, 126, C.panel);
  p.text('LECTURE RAPIDE DES CHOCS', M + 12, 578, { size: 7.2, bold: true, color: C.accent });
  const notes = [
    ['MACRO', 'Un choc macro déplace les 5 valeurs ; les plus sensibles sont VW, BP et BABA (bêta et secteurs).'],
    ['MSFT / BABA', 'Les news tech sont idiosyncratiques : un gain pour l’un peut être une pression pour l’autre.'],
    ['HSBC / BP / VW', 'Les news sectorielles restent largement contenues au titre concerné.'],
    ['NOTE', 'Aucun impact prix : c’est le moment de vérifier cash, net exposure et quotes live.'],
  ];
  let nny = 592;
  notes.forEach(([tag, txt]) => {
    p.text(tag, M + 12, nny, { size: 7, bold: true, color: C.gold });
    p.para(txt, M + 92, nny - 1, CW - 104, { size: 7.4, color: C.body, leading: 9.4 });
    nny += 22;
  });
  p.footer(11, TOTAL);
}

// 12. CHECKLIST / PLAN / LINKS -------------------------------------------
{
  const p = newPage({ header: 'Checklist, plan 7 jours & liens', section: 'Avant de lancer' });
  sectionTitle(p, 13, 'La checklist des 60 secondes avant le round', 'À cocher dans l’ordre. Si une case manque, le score baissera avant même le premier trade.', 78);

  const checks = [
    'Scénario choisi : Replay officiel (pour apprendre) ou Dynamique (pour progresser).',
    'Durée adaptée : 8 min pour un sprint, 15 min standard, 30 min conditions réelles.',
    'Rôle de départ : IB-55 si vous voulez travailler le flux client, AM-55 si vous voulez le mandat.',
    'Audio activé (🔊) et volume réglé — les alertes de news et de risque sont des signaux.',
    'Nom saisi et guide PDF téléchargé (bouton visible en bas à gauche).',
    'Objectifs en tête : IB 12 fills / $28M / 0 FFC ; AM 4–5 lignes / 5–15 % cash / +2 %.',
  ];
  let chy = 140;
  checks.forEach((c) => {
    p.rect(M, chy + 1, 9, 9, C.white, C.accent, 0.8);
    p.para(c, M + 17, chy, CW - 20, { size: 8.2, color: C.body, leading: 10.6 });
    chy += 21;
  });

  p.y = 282;
  sectionTitle(p, 14, 'Plan de progression sur 7 jours', null, 282);
  const days = [
    ['J1', 'Replay Round 1 en IB, 15 min. Objectif : 0 FFC, 10 fills, net < $2M.', 'IB'],
    ['J2', 'Replay Round 3 … en AM, 15 min. Objectif : 5 lignes 5–15 %, cash 10 %.', 'AM'],
    ['J3', 'Dynamic IB, 8 min. Enchaîner 3 sessions pour automatiser l’anti-snipe.', 'IB'],
    ['J4', 'Dynamic AM, 8 min. Shopper 3 dealers à chaque news, noter le coût moyen.', 'AM'],
    ['J5', 'Replay Round 2 en IB puis AM (rotation), 15 min. Viser 85 %+.', 'Mixte'],
    ['J6', 'Session complète 2 rounds, 15 min, sans coach. Debrief et corrections.', 'Mixte'],
    ['J7', 'Conditions réelles 30 min, audio ON, objectif 90 %+ et Top 1 %.', 'Live'],
  ];
  const dw = [32, 470, 45];
  tableRow(p, M, 312, ['JOUR', 'SESSION', 'ROLE'], dw, { size: 6.6, bold: true, color: C.muted, fill: C.panel2, h: 16 });
  days.forEach((d, i) => {
    tableRow(p, M, 328 + i * 20, d, dw, { size: 7.6, color: C.body, fill: i % 2 ? C.panel : null, h: 20 });
  });

  p.y = 488;
  sectionTitle(p, 15, 'Raccourcis & ressources', null, 488);
  const shortcuts = [
    ['Espace', 'Pause / reprendre'],
    ['C', 'Coach temps réel'],
    ['K', 'Leaderboard'],
    ['H', 'Couvrir la plus grosse position'],
    ['?', 'Règles & barème'],
  ];
  shortcuts.forEach(([k, v], i) => {
    const x = M + (i % 3) * 175;
    const y = 516 + Math.floor(i / 3) * 28;
    p.rect(x, y, 18, 14, C.panel2, C.line);
    p.text(k, x + 9, y + 3.4, { size: 6.8, bold: true, color: C.accent, align: 'center' });
    p.text(v, x + 24, y + 3.4, { size: 7.4, color: C.body });
  });

  p.rect(M, 570, CW, 150, C.navy);
  p.text('LIENS OFFICIELS DE LA PLATEFORME', M + 14, 582, { size: 7.2, bold: true, color: C.gold });
  const links = [
    ['Application', 'https://tradelab-zlp6.onrender.com/'],
    ['GitHub', 'https://github.com/Calvin29990/Traineur-calvin'],
    ['Guide PDF', '/guide-amplifyme-top1.pdf'],
    ['AmplifyME live', 'https://flow936161.amplifyme.com/#main'],
  ];
  let ly = 600;
  links.forEach(([label, url]) => {
    p.text(label, M + 14, ly, { size: 7.8, bold: true, color: C.white });
    p.text(url, M + 122, ly, { size: 7.9, color: C.accent2 });
    ly += 20;
  });
  p.text('Le déploiement Render se déclenche à chaque merge sur main. Le guide est régénéré par “npm run build” (scripts/make-guide.mjs).', M + 14, 690, { size: 6.5, color: '#9FBDCD' });

  p.para('Dernier conseil : ne cherchez pas à “faire du P&L”. Cherchez à exécuter proprement, à couvrir le risque et à répondre au flux. Sur AmplifyME, ce sont ces comportements qui remplissent les jauges — et le classement suit.', M, 738, CW, { size: 8.4, bold: true, color: C.text, leading: 11.6 });

  p.text('Simulateur pédagogique indépendant. Non affilié au CFA Institute, à AmplifyME ou à Flow Traders. Aucun argent réel, aucun conseil en investissement.', M, 782, { size: 6.4, color: C.muted });
  p.footer(12, TOTAL);
}

// ------------------------------------------------------------------------ PDF
const objects = [];
const obj = (s) => { objects.push(s); return objects.length; };

// Fixed object numbers 1..5
objects.push('<< /Type /Catalog /Pages 2 0 R >>');
objects.push(''); // Pages placeholder
objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
objects.push(`<< /Title (${pdfString('Guide Top 1 % — CFA Institute x AmplifyME')}) /Author (${pdfString('Calvin MINANG')}) /Subject (${pdfString('Guide d’entraînement IB-55 / AM-55 — plan pour finir 1er')}) /Creator (${pdfString('Traineur-calvin')}) /Producer (${pdfString('make-guide.mjs')}) >>`);

// object 6.. pages
const pageObjNums = [];
pages.forEach((p, i) => {
  const pageNum = objects.length + 1;
  const contentNum = pageNum + 1;
  pageObjNums.push(pageNum);
  objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W.toFixed(2)} ${H.toFixed(2)}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentNum} 0 R >>`);
  const content = p.ops.join('\n');
  objects.push(`<< /Length ${Buffer.byteLength(content, 'latin1')} >>\nstream\n${content}\nendstream`);
  void i;
});
objects[1] = `<< /Type /Pages /Kids [${pageObjNums.map((n) => `${n} 0 R`).join(' ')}] /Count ${pageObjNums.length} >>`;

const chunks = [];
let offset = 0;
const push = (s) => {
  const b = Buffer.from(s, 'latin1');
  chunks.push(b);
  offset += b.length;
};
push('%PDF-1.4\n');
push('%\u00E2\u00E3\u00CF\u00D3\n');
const offsets = [];
objects.forEach((o, i) => {
  offsets[i] = offset;
  push(`${i + 1} 0 obj\n${o}\nendobj\n`);
});
const xref = offset;
push(`xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`);
for (const off of offsets) push(`${String(off).padStart(10, '0')} 00000 n \n`);
push(`trailer\n<< /Size ${objects.length + 1} /Root 1 0 R /Info 5 0 R >>\nstartxref\n${xref}\n%%EOF\n`);

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, Buffer.concat(chunks));
console.log(`[guide] ${pages.length} pages · ${(fs.statSync(OUT).size / 1024).toFixed(1)} KB → ${path.relative(ROOT, OUT)}`);
