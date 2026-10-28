// ---------------------------------------------------------------------------
// Authoritative simulation engine — CFA Institute x AmplifyME Investing
// Simulator Challenge format.
//   Role 1: Investment Bank Market Maker (IB-55, sell-side, OTC chat quotes)
//   Role 2: Asset Manager (AM-55, buy-side, $20,000,000 mandate)
// Official Round 1 / Round 2 press releases replay + dynamic training mode.
// ---------------------------------------------------------------------------

import {
  INSTRUMENTS, TICKERS, PACES, ROLE_BADGES, ROLE_LABELS,
  OFFICIAL_ROUND_1, OFFICIAL_ROUND_2, DYNAMIC_NEWS, ALL_NEWS,
  IB_CLIENTS, AM_DEALERS, DESK_TRADERS, DEAL_ROOM_LINES,
  CLIENT_MESSAGE_TEMPLATES, CLIENT_REPLIES, AM_ROOM_LINES, DEALER_CHATTER,
  BOT_NAMES, BOT_FIRMS,
} from './content.js';

export const BALANCE = {
  // Round pacing
  defaultRoundSeconds: PACES.standard.seconds,
  rounds: 2,
  marketOpenSeconds: 4 * 3600,          // every round maps 13:00 -> 17:00

  // Price discovery
  priceConvergence: 0.040,              // per second pull towards news target
  newsImpactScale: 0.28,                // qualitative wire -> calibrated % moves

  // Exchange microstructure
  ibExchangeHalfBps: 9,                 // IB crosses a tight public book
  ibExchangeSlopeBps: 30,               // +30 bps per 1x baseDepth clip
  amExchangeHalfBps: 35,                // AM Exchange is much wider than IB quotes
  amExchangeSlopeBps: 58,
  ibExchangeFeeBps: 2,
  amExchangeFeeBps: 8,

  // OTC economics
  ibClientCommBps: 12,
  amDealerCommBps: 3,
  ibQuoteTargetHalfBps: 55,             // ideal sell-side half-spread around REFPRICE
  ibQuoteWideHalfBps: 150,              // beyond this = uncompetitive
  ibMaxSingleNotional: 12000000,
  ibMaxGrossNotional: 24000000,

  // AM mandate
  amFundCapital: 20000000,
  amMaxSingleNotional: 12000000,        // hard cap 60%; soft penalties above 20%
  amMaxGrossNotional: 30000000,
  amTargetMaxWeightPct: 20,
  amTargetCashMinPct: 5,
  amTargetCashMaxPct: 15,

  // Client flow
  rfqIntervalMin: 8,
  rfqIntervalMax: 14,
  rfqExpiry: 55,
  decisionDelayMin: 1.6,
  decisionDelayMax: 3.6,
  chatterMin: 16,
  chatterMax: 30,

  // Scoring targets
  ibCommissionTarget: 32000,
  ibClientTradesTarget: 12,
  ibClientNotionalTarget: 28000000,
  ibPnlTarget: 220000,
  amRoiTargetPct: 2.0,
  amSlippageTargetBps: 18,
};

const r2 = (n) => Math.round(n * 100) / 100;
const r3 = (n) => Math.round(n * 1000) / 1000;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const clamp01 = (v) => clamp(v, 0, 1);

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeRng(seed) {
  const rnd = mulberry32(seed);
  const gauss = () => {
    let u = 0; let v = 0;
    while (u === 0) u = rnd();
    while (v === 0) v = rnd();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };
  return {
    next: rnd,
    gauss,
    range: (a, b) => a + rnd() * (b - a),
    pick: (arr) => arr[Math.floor(rnd() * arr.length)],
    int: (a, b) => Math.floor(a + rnd() * (b - a + 1)),
    chance: (p) => rnd() < p,
  };
}

export function fmtClock(simSec, scale = 16) {
  const t = Math.max(0, 13 * 3600 + simSec * scale);
  const h = Math.floor(t / 3600) % 24;
  const m = Math.floor((t % 3600) / 60);
  const s = Math.floor(t % 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

let seqId = 0;
const uid = (p) => `${p}${++seqId}`;
let eventSeq = 0;

const PRICE_DEC = (inst) => (inst.dp === 3 ? r3 : r2);
const priceStr = (v, dp) => (dp === 3 ? r3(v) : r2(v));

export class Session {
  constructor({
    id, seed, rounds, roundSeconds, nickname,
    mode = 'replay', startRole = 'IB', assistMode = false, pace = 'standard',
  }) {
    this.id = id || uid('s');
    this.seed = seed ?? Math.floor(Math.random() * 1e9);
    this.rng = makeRng(this.seed);
    this.mode = mode === 'dynamic' ? 'dynamic' : 'replay';
    this.startRole = startRole === 'AM' ? 'AM' : 'IB';
    this.assistMode = Boolean(assistMode);
    this.roundsTotal = clamp(Number(rounds) || 2, 1, 4);
    this.pace = PACES[pace] ? pace : null;
    this.roundSeconds = clamp(
      Number(roundSeconds) || (this.pace ? PACES[this.pace].seconds : BALANCE.defaultRoundSeconds),
      120, 2400,
    );
    this.clockScale = BALANCE.marketOpenSeconds / this.roundSeconds;
    this.nickname = nickname || 'Calvin MINANG';

    this.phase = 'briefing';
    this.round = 0;
    this.speed = 1;
    this.paused = false;
    this.simTime = 0;
    this.totalSim = 0;
    this.roundStartSim = 0;
    this.breakTime = 0;
    this.oneMinWarned = false;

    this.chartTicker = 'MSFT';
    this.watchedTickers = ['MSFT', 'BP'];
    this.usedNews = new Set();

    this.roundHistory = [];
    this.roundStats = null;
    this.debrief = null;
    this.final = null;
    this.events = [];
    this.lastEventId = 0;

    this.hedgeCooldown = 0;
    this.initMetrics();
    this.initMarket(true);
    this.botPool = this.buildBotPool();
    this.pendingNews = [];
    this.nextRfqAt = 0;
    this.nextChatterAt = 0;
    this.pendingClientReplies = [];
    this.pendingDealerQuotes = [];
    this.clientRequests = [];
    this.liveQuotes = [];
    this.oldQuotes = [];
    this.messages = [];
    this.news = [];
    this.blotter = [];

    this.say('system', 'ib', 'AmplifyME FlowTrader engine ready — CFA Institute Investing Simulator.', 'SYSTEM');
  }

  // ------------------------------------------------------------------ Setup
  roleForRound(r) {
    const first = this.startRole || 'IB';
    const second = first === 'IB' ? 'AM' : 'IB';
    return r % 2 === 1 ? first : second;
  }

  get role() {
    return this._role || this.roleForRound(Math.max(1, this.round));
  }

  set role(v) {
    this._role = v;
  }

  initMetrics() {
    this.metrics = {
      quotesSent: 0,
      quotesCancelled: 0,
      staleSniped: 0,
      quoteSpreadSum: 0,
      quoteSpreadCount: 0,
      quoteQualitySum: 0,
      wideQuotes: 0,
      razorQuotes: 0,
      clientFills: 0,
      clientVolume: 0,
      clientNotional: 0,
      ibCommission: 0,
      exchangeFees: 0,
      exchangeTrades: 0,
      exchangeNotional: 0,
      fatFingers: 0,
      clipsGood: 0,
      dumps: 0,
      netSamples: 0,
      netOverSamples: 0,
      netPeak: 0,
      grossPeak: 0,
      netAlerted: false,
      cashAlerted: false,
      concentrationAlerted: false,
      amDealerTrades: 0,
      amDealerNotional: 0,
      amExchangeTrades: 0,
      amExchangeNotional: 0,
      execCostSum: 0,
      execNotionalSum: 0,
      alignedNotional: 0,
      totalTradedNotional: 0,
      amTrades: 0,
      cashMin: BALANCE.amFundCapital,
      maxWeight: 0,
      diversified: 0,
      peakPnl: 0,
      maxDrawdown: 0,
      markouts: [],
      adverse: 0,
      spreadCapture: 0,
      proactiveReplies: 0,
      proactiveConversions: 0,
      tradeSeq: 0,
    };
  }

  resetRoundState() {
    this.realized = 0;
    this.ibCommissionEarned = 0;
    this.exchangeFeesPaid = 0;
    this.amCommPaid = 0;
    this.cash = BALANCE.amFundCapital;
    this.blotter = [];
    this.liveQuotes = [];
    this.oldQuotes = [];
    this.clientRequests = [];
    this.pendingDealerQuotes = [];
    this.pendingClientReplies = [];
    this.messages = [];
    this.news = [];
    this.positions = {};
    this.candles = {};
    this.chartTicker = 'MSFT';
    this.netAlerted = false;
    this.oneMinWarned = false;
    this.equityCurve = [];
    this.lastSampleAt = 0;
    this.nextRfqAt = this.rng.range(2.5, 4.5);
    this.nextChatterAt = this.rng.range(7, 13);
    this.lastDepth = null;
    this.newsSignal = Object.fromEntries(TICKERS.map((t) => [t, 0]));
    this.macroSignal = 0;
    this.initMetrics();
  }

  initMarket(initial = false) {
    this.inst = {};
    this.positions = {};
    this.candles = {};
    this.flow = {};

    for (const base of INSTRUMENTS) {
      const jitter = initial || this.mode === 'replay' ? 1 : this.rng.range(0.985, 1.015);
      const open = priceStr(base.ref * jitter, base.dp);
      this.inst[base.ticker] = {
        ...base,
        open,
        prevClose: open,
        logV: Math.log(open),
        logTarget: Math.log(open),
        mid: open,
        last: open,
        dir: 1,
        high: open,
        low: open,
      };
      this.positions[base.ticker] = { qty: 0, avg: 0, realisedPnl: 0, traded: false };
      this.candles[base.ticker] = [];
    }

    // Pre-seed ~80 historical candles (400s of tape) so charts look live at open.
    for (const t of TICKERS) {
      const inst = this.inst[t];
      const dec = (v) => priceStr(v, inst.dp);
      let lv = Math.log(inst.open * this.rng.range(0.994, 1.006));
      const target = Math.log(inst.open);
      for (let step = -80; step <= 0; step++) {
        const o = Math.exp(lv);
        const pull = (target - lv) * 0.08;
        const c1 = Math.exp(lv + pull * 0.5 + inst.vol * this.rng.gauss() * 0.55);
        const c2 = Math.exp(lv + pull + inst.vol * this.rng.gauss() * 0.55);
        const cl = step === 0 ? inst.open : c2;
        if (step === 0) lv = target; else lv = Math.log(c2);
        const hi = Math.max(o, c1, c2, cl);
        const lo = Math.min(o, c1, c2, cl);
        const volume = Math.round(14000 + this.rng.next() * 52000);
        this.candles[t].push([step * 5, dec(o), dec(hi), dec(lo), dec(cl), volume]);
      }
      inst.logV = Math.log(inst.open);
      inst.logTarget = Math.log(inst.open);
      inst.mid = inst.open;
      inst.last = inst.open;
      inst.high = inst.open;
      inst.low = inst.open;
    }

    this.clients = IB_CLIENTS.map((c) => ({
      ...c, trades: 0, volume: 0, lastOutreachAt: -999, unread: 0,
    }));
    this.dealers = AM_DEALERS.map((d) => ({ ...d, quotes: 0, fills: 0 }));
    this.cash = BALANCE.amFundCapital;
  }

  // --------------------------------------------------------- Market mechanics
  halfSpreadBps(qty, ticker) {
    const inst = this.inst[ticker];
    const fromIB = this.role === 'IB';
    const base = fromIB ? BALANCE.ibExchangeHalfBps : BALANCE.amExchangeHalfBps;
    const slope = fromIB ? BALANCE.ibExchangeSlopeBps : BALANCE.amExchangeSlopeBps;
    const ratio = Math.max(0, Number(qty) || 0) / inst.baseDepth;
    return base + slope * ratio;
  }

  depthQuote(ticker, rawQty = 10000) {
    const inst = this.inst[ticker];
    if (!inst) return null;
    const qty = Math.max(1, Math.round(Number(rawQty) || 10000));
    const halfBps = this.halfSpreadBps(qty, ticker);
    const dec = (v) => priceStr(v, inst.dp);
    const mid = inst.mid;
    const sellPrice = dec(mid * (1 - halfBps / 1e4));
    const buyPrice = dec(mid * (1 + halfBps / 1e4));
    const notional = Math.round(qty * mid);
    const feeBps = this.role === 'IB' ? BALANCE.ibExchangeFeeBps : BALANCE.amExchangeFeeBps;
    return {
      ticker,
      qty,
      mid: dec(mid),
      halfSpreadBps: Math.round(halfBps * 10) / 10,
      sellPrice,
      buyPrice,
      notional,
      commission: Math.round((notional * feeBps) / 1e4),
      feeBps,
    };
  }

  // --------------------------------------------------------------- P&L maths
  commissionDisplay() {
    return Math.round(this.role === 'IB'
      ? this.ibCommissionEarned - this.exchangeFeesPaid
      : this.amCommPaid);
  }

  unrealised(ticker = null) {
    let v = 0;
    const tks = ticker ? [ticker] : TICKERS;
    for (const t of tks) {
      const p = this.positions[t];
      if (!p || p.qty === 0) continue;
      v += p.qty * (this.inst[t].mid - p.avg);
    }
    return v;
  }

  roundTotalPnl() {
    if (this.phase === 'briefing') return 0;
    const unr = this.unrealised();
    if (this.role === 'IB') {
      return this.realized + unr + this.ibCommissionEarned - this.exchangeFeesPaid;
    }
    return this.realized + unr - this.amCommPaid;
  }

  portfolioValue() {
    return this.cash + TICKERS.reduce((acc, t) => acc + this.positions[t].qty * this.inst[t].mid, 0);
  }

  grossNotional() {
    return TICKERS.reduce((acc, t) => acc + Math.abs(this.positions[t].qty * this.inst[t].mid), 0);
  }

  netNotional() {
    return TICKERS.reduce((acc, t) => acc + this.positions[t].qty * this.inst[t].mid, 0);
  }

  sharesOwned() {
    return TICKERS.reduce((acc, t) => acc + this.positions[t].qty, 0);
  }

  maxPositionWeightPct() {
    const pv = Math.max(1, this.portfolioValue());
    let max = 0;
    for (const t of TICKERS) {
      const w = Math.abs(this.positions[t].qty * this.inst[t].mid) / pv * 100;
      if (w > max) max = w;
    }
    return max;
  }

  diversifiedCount() {
    const pv = Math.max(1, this.portfolioValue());
    return TICKERS.filter((t) => (Math.abs(this.positions[t].qty * this.inst[t].mid) / pv) >= 0.03).length;
  }

  totalPnl() {
    const past = this.roundHistory.reduce((a, r) => a + r.pnl, 0);
    if (this.phase === 'round') return past + this.roundTotalPnl();
    return past;
  }

  // ---------------------------------------------------------------- Scoring
  scoreSpreadQuote(halfBps) {
    // 100 = ideal 15..110 bps around REFPRICE. Too wide is heavily penalised,
    // razor-thin quotes are risky (adverse selection) and capped at 55.
    if (!Number.isFinite(halfBps) || halfBps <= 0) return 0;
    if (halfBps < 8) return 45;
    if (halfBps < 15) return 70;
    if (halfBps <= 110) return 100;
    if (halfBps <= 160) return 100 - (halfBps - 110) * 1.1;
    if (halfBps <= 260) return 45 - (halfBps - 160) * 0.35;
    return Math.max(0, 10 - (halfBps - 260) * 0.2);
  }

  computeRoleScore() {
    const m = this.metrics;
    const pnl = this.roundTotalPnl();
    if (this.role === 'IB') {
      const comm = Math.max(0, this.ibCommissionEarned);
      const commScore = clamp01(comm / BALANCE.ibCommissionTarget) * 100;
      const ffcScore = clamp(100 - m.fatFingers * 25, 0, 100);
      const ctFills = clamp01(m.clientFills / BALANCE.ibClientTradesTarget) * 100;
      const ctVolume = clamp01(m.clientNotional / BALANCE.ibClientNotionalTarget) * 100;
      const ctScore = clamp(0.55 * ctFills + 0.45 * ctVolume, 0, 100);
      const avgSpread = m.quoteSpreadCount ? m.quoteSpreadSum / m.quoteSpreadCount : 0;
      const spreadBase = m.quoteSpreadCount ? (m.quoteQualitySum / m.quoteSpreadCount) * 100 : 0;
      const ssrmScore = clamp(spreadBase - m.staleSniped * 14 - m.wideQuotes * 3.5, 0, 100);
      const netRatio = Math.min(1, Math.abs(this.netNotional()) / 5000000);
      const overShare = m.netSamples ? m.netOverSamples / m.netSamples : 0;
      const struct = clamp(100 * (1 - Math.min(1, overShare * 1.35)), 0, 100);
      const flat = clamp(100 * (1 - netRatio), 0, 100);
      const clips = m.clipsGood === 0 && m.dumps === 0 ? 100 : clamp(m.clipsGood * 9, 0, 100);
      const etmScore = clamp(0.48 * struct + 0.37 * flat + 0.15 * clips - m.dumps * 5, 0, 100);
      const pnlScore = clamp(((pnl + 50000) / (BALANCE.ibPnlTarget + 50000)) * 100, 0, 100);

      const gauges = [
        { code: 'COMM', label: 'Commission', score: Math.round(commScore), weight: 16, detail: `$${Math.round(comm).toLocaleString('en-US')} encaissés sur le flux client (cible $${BALANCE.ibCommissionTarget.toLocaleString('en-US')}).` },
        { code: 'FFC', label: 'Fat Finger Count', score: Math.round(ffcScore), weight: 10, detail: m.fatFingers ? `${m.fatFingers} erreur(s) de saisie détectée(s).` : 'Zéro erreur de saisie — parfait.' },
        { code: 'CT', label: 'Chat Trades', score: Math.round(ctScore), weight: 16, detail: `${m.clientFills} trade(s) client · $${Math.round(m.clientNotional).toLocaleString('en-US')} de notionnel OTC.` },
        { code: 'SSRM', label: 'Sell-Side Risk Mgmt', score: Math.round(ssrmScore), weight: 16, detail: `Spread moyen ${avgSpread.toFixed(0)} bps autour du REFPRICE · ${m.staleSniped} quote(s) snipée(s) · ${m.wideQuotes} spread(s) trop large(s).` },
        { code: 'ETM', label: 'Exchange Trade Metrics', score: Math.round(etmScore), weight: 17, detail: `Exposition nette finale $${Math.round(this.netNotional()).toLocaleString('en-US')} · ${Math.round(overShare * 100)}% du temps au-delà de $3M · ${m.dumps} dump(s) massif(s).` },
        { code: 'PnL', label: 'Total P&L', score: Math.round(pnlScore), weight: 25, detail: `Realised + Unrealised = $${Math.round(pnl).toLocaleString('en-US')} (cible $${BALANCE.ibPnlTarget.toLocaleString('en-US')}).` },
      ];
      const total = Math.round(gauges.reduce((a, g) => a + g.score * g.weight, 0) / 100);
      return { role: 'IB', total, gauges, pnl: Math.round(pnl), commission: Math.round(comm) };
    }

    // --- AM-55 -------------------------------------------------------------
    const pv = Math.max(1, this.portfolioValue());
    const pnlAm = this.roundTotalPnl();
    const cashPct = (this.cash / pv) * 100;
    const maxWeight = this.maxPositionWeightPct();
    const diversified = this.diversifiedCount();

    let cashScore;
    if (cashPct < BALANCE.amTargetCashMinPct) cashScore = clamp((cashPct / BALANCE.amTargetCashMinPct) * 100, 0, 100);
    else if (cashPct <= BALANCE.amTargetCashMaxPct) cashScore = 100;
    else cashScore = clamp(100 - (cashPct - BALANCE.amTargetCashMaxPct) * 2.6, 0, 100);

    const weightScore = maxWeight <= BALANCE.amTargetMaxWeightPct
      ? 100
      : clamp(100 - (maxWeight - BALANCE.amTargetMaxWeightPct) * 3.3, 0, 100);
    const divScore = clamp((diversified / 5) * 100, 0, 100);
    const nTrades = m.amTrades;
    let tradeScore;
    if (nTrades === 0) tradeScore = 0;
    else if (nTrades < 6) tradeScore = 45 + nTrades * 9;
    else if (nTrades <= 36) tradeScore = 100;
    else tradeScore = clamp(100 - (nTrades - 36) * 2.2, 0, 100);
    const bsrmScore = clamp(0.35 * cashScore + 0.30 * weightScore + 0.20 * divScore + 0.15 * tradeScore, 0, 100);

    const avgCost = m.execNotionalSum > 0 ? m.execCostSum / m.execNotionalSum : 999;
    const costScore = m.execNotionalSum > 0 ? clamp(100 - Math.max(0, avgCost - BALANCE.amSlippageTargetBps) * 2.0, 0, 100) : 0;
    const dealerShare = m.totalTradedNotional > 0 ? m.amDealerNotional / m.totalTradedNotional : 0.5;
    const esScore = m.totalTradedNotional > 0 ? clamp(0.72 * costScore + 0.28 * dealerShare * 100, 0, 100) : 0;

    const ffcScore = clamp(100 - m.fatFingers * 25, 0, 100);

    const alignScore = m.totalTradedNotional > 0
      ? clamp((m.alignedNotional / m.totalTradedNotional) * 100, 0, 100)
      : 50;
    const grossRatio = this.grossNotional() / pv;
    let deployScore;
    if (grossRatio < 0.55) deployScore = clamp((grossRatio / 0.55) * 100, 0, 100);
    else if (grossRatio <= 1.1) deployScore = 100;
    else deployScore = clamp(100 - (grossRatio - 1.1) * 220, 0, 100);
    const raScore = clamp(0.62 * alignScore + 0.38 * deployScore, 0, 100);

    const roiPct = (pnlAm / BALANCE.amFundCapital) * 100;
    const roiScore = clamp(((roiPct + 1.0) / (BALANCE.amRoiTargetPct + 1.0)) * 100, 0, 100);

    const gauges = [
      { code: 'BSRM', label: 'Buy-Side Risk Mgmt', score: Math.round(bsrmScore), weight: 24, detail: `Cash ${cashPct.toFixed(1)}% · max ${maxWeight.toFixed(0)}% sur une ligne · ${diversified}/5 lignes ≥3% · ${nTrades} trades.` },
      { code: 'ES', label: 'Execution Score', score: Math.round(esScore), weight: 18, detail: `Coût moyen vs REFPRICE ${m.execNotionalSum > 0 ? avgCost.toFixed(1) : '—'} bps · ${(dealerShare * 100).toFixed(0)}% exécuté via les banques.` },
      { code: 'FFC', label: 'Fat Finger Count', score: Math.round(ffcScore), weight: 8, detail: m.fatFingers ? `${m.fatFingers} erreur(s) d'exécution / taille.` : 'Zéro erreur — exécution propre.' },
      { code: 'RA', label: 'Risk Appetite', score: Math.round(raScore), weight: 20, detail: `Alignement news ${alignScore.toFixed(0)}% · exposition brute ${(grossRatio * 100).toFixed(0)}% du fonds.` },
      { code: 'ROI', label: 'Return on Investment', score: Math.round(roiScore), weight: 30, detail: `Performance $${Math.round(pnlAm).toLocaleString('en-US')} = ${roiPct.toFixed(2)}% sur $20M (cible ${BALANCE.amRoiTargetPct.toFixed(1)}%).` },
    ];
    const total = Math.round(gauges.reduce((a, g) => a + g.score * g.weight, 0) / 100);
    return { role: 'AM', total, gauges, pnl: Math.round(pnlAm), roiPct: r2(roiPct) };
  }

  overallChallengeScore() {
    const scores = this.roundHistory.map((r) => r.scoreObj?.total ?? 50);
    if (this.phase === 'round') scores.push(this.computeRoleScore().total);
    if (!scores.length) return 0;
    return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
  }

  // -------------------------------------------------------------- Leaderboard
  buildBotPool() {
    const pool = [];
    for (let i = 0; i < 259; i++) {
      let skill = 0.48 + this.rng.gauss() * 0.17;
      skill = clamp(skill, 0.08, 0.97);
      const scores = [];
      const pnls = [];
      for (let r = 1; r <= 4; r++) {
        const role = this.roleForRound(r);
        const baseScore = clamp((0.30 + skill * 0.64) * 100 + this.rng.gauss() * 4.5, 12, 97);
        const pnl = role === 'AM'
          ? Math.round((skill - 0.38) * 1650000 + this.rng.gauss() * 190000)
          : Math.round((skill - 0.36) * 300000 + this.rng.gauss() * 45000);
        scores.push(Math.round(baseScore));
        pnls.push(pnl);
      }
      pool.push({
        id: `b${i}`,
        name: BOT_NAMES[i % BOT_NAMES.length] + (i >= BOT_NAMES.length ? ` #${Math.floor(i / BOT_NAMES.length) + 1}` : ''),
        firm: BOT_FIRMS[Math.floor(this.rng.next() * BOT_FIRMS.length)],
        skill,
        scores,
        pnls,
      });
    }
    return pool;
  }

  leaderboard() {
    const progress = this.phase === 'round'
      ? clamp(this.simTime / this.roundSeconds, 0.02, 1)
      : this.phase === 'briefing' ? 0 : 1;
    const myScore = this.overallChallengeScore();
    const myPnl = Math.round(this.totalPnl());
    const completed = this.roundHistory.length;
    const currentRound = this.phase === 'round' ? this.round : null;

    const rows = this.botPool.map((b) => {
      let score = 0;
      let pnl = 0;
      let n = 0;
      for (let r = 0; r < Math.max(1, this.round); r++) {
        const base = b.scores[r] ?? b.scores[0];
        const roundPnl = b.pnls[r] ?? b.pnls[0];
        if (r < completed) {
          score += base;
          pnl += roundPnl;
          n += 1;
        } else if (currentRound && r === currentRound - 1) {
          score += 50 + (base - 50) * progress;
          pnl += (roundPnl * progress);
          n += 1;
        }
      }
      if (!n) { score = 50; pnl = 0; }
      return {
        name: b.name,
        firm: b.firm,
        score: Math.round(clamp(n ? score / n : 50, 5, 99)),
        pnl: Math.round(pnl),
        me: false,
      };
    });

    rows.push({ name: this.nickname, firm: 'CFA Candidate (You)', score: myScore, pnl: myPnl, me: true });
    rows.sort((a, b) => (b.score - a.score) || (b.pnl - a.pnl));
    rows.forEach((r, idx) => { r.rank = idx + 1; });

    const idx = rows.findIndex((r) => r.me);
    const total = rows.length;
    const percentile = clamp((1 - idx / (total - 1)) * 100, 0.1, 99.9);
    return {
      rows: rows.slice(0, 14),
      around: rows.slice(Math.max(0, idx - 3), idx + 4),
      rank: idx + 1,
      total,
      topPct: percentile,
      myScore,
      myPnl,
      scoreThreshold: rows[Math.max(0, Math.floor(total * 0.01) - 1)]?.score ?? 90,
    };
  }

  // ---------------------------------------------------------------- Messaging
  say(kind, room, text, from) {
    const msg = {
      id: uid('m'),
      at: Math.round(this.totalSim * 10) / 10,
      clock: fmtClock(this.totalSim, this.clockScale),
      room,
      kind,
      from: from || (kind === 'desk' ? this.rng.pick(DESK_TRADERS) : 'SYSTEM'),
      text,
    };
    this.messages.push(msg);
    if (this.messages.length > 220) this.messages.shift();
    return msg;
  }

  emitEvent(type, payload = {}) {
    const ev = { id: ++eventSeq, type, at: Math.round(this.totalSim * 10) / 10, ...payload };
    this.events.push(ev);
    if (this.events.length > 45) this.events.shift();
    this.lastEventId = ev.id;
    return ev;
  }

  newsRoom() {
    return this.role === 'IB' ? 'ib' : 'deal';
  }

  postNote(headline, detail = '') {
    this.news.unshift({
      id: uid('note'),
      at: this.round,
      simAt: this.totalSim,
      kind: 'NOTE',
      ticker: 'NOTE',
      headline,
      detail: detail || headline,
      time: fmtClock(this.totalSim, this.clockScale),
      impact: 0,
    });
    if (this.news.length > 40) this.news.pop();
  }

  // ---------------------------------------------------------------- Execution
  applyFill(ticker, signedQty, price, commission, source, meta = {}) {
    const pos = this.positions[ticker];
    const inst = this.inst[ticker];
    const side = signedQty > 0 ? 'BUY' : 'SELL';
    const qty = Math.abs(signedQty);
    pos.traded = true;

    if (pos.qty === 0) {
      pos.avg = price;
      pos.qty = signedQty;
    } else if (Math.sign(pos.qty) === Math.sign(signedQty)) {
      pos.avg = (pos.avg * Math.abs(pos.qty) + price * qty) / (Math.abs(pos.qty) + qty);
      pos.qty += signedQty;
    } else {
      const closingQty = Math.min(qty, Math.abs(pos.qty));
      const pnl = (price - pos.avg) * closingQty * Math.sign(pos.qty);
      pos.realisedPnl += pnl;
      this.realized += pnl;
      const flipped = qty > Math.abs(pos.qty);
      pos.qty += signedQty;
      if (pos.qty === 0) pos.avg = 0;
      else if (flipped) pos.avg = price;
    }

    if (this.role === 'IB') {
      if (source === 'CLIENT') this.ibCommissionEarned += commission;
      else this.exchangeFeesPaid += commission;
    } else {
      this.amCommPaid += commission;
      if (signedQty > 0) this.cash -= qty * price + commission;
      else this.cash += qty * price - commission;
    }

    const capture = (inst.mid - price) * signedQty;
    if (this.role === 'IB' && source === 'CLIENT') this.metrics.spreadCapture += capture;

    const trade = {
      id: uid('tr'),
      at: Math.round(this.totalSim * 10) / 10,
      clock: fmtClock(this.totalSim, this.clockScale),
      ticker,
      side,
      qty,
      price: priceStr(price, inst.dp),
      fee: Math.round(commission),
      commSigned: this.role === 'IB' && source === 'CLIENT' ? Math.round(commission) : -Math.round(commission),
      source,
      venue: meta.venue || source,
      counterparty: meta.counterparty || '',
      capture: Math.round(capture),
      posAfter: pos.qty,
      pnlAfter: Math.round(this.roundTotalPnl()),
    };
    this.blotter.unshift(trade);
    this.metrics.tradeSeq += 1;
    if (this.blotter.length > 120) this.blotter.pop();
    this.emitEvent('fill', { ticker, side, qty, price: trade.price });
    return trade;
  }

  recordExecutionCost(ticker, side, price, notional) {
    if (this.role !== 'AM') return;
    const ref = this.inst[ticker].mid;
    const sign = side === 'BUY' ? 1 : -1;
    const costBps = ((price - ref) / ref) * 1e4 * sign;
    this.metrics.execCostSum += costBps * notional;
    this.metrics.execNotionalSum += notional;
  }

  // ------------------------------------------------------------ Exchange
  tradeExchange(ticker, side, qty) {
    if (this.phase !== 'round') return { error: 'Round is not active' };
    const inst = this.inst[ticker];
    if (!inst) return { error: 'Unknown security' };
    const n = Math.round(Number(qty));
    if (!Number.isFinite(n) || n <= 0) {
      this.metrics.fatFingers += 1;
      this.emitEvent('alert', { kind: 'fatfinger' });
      return { error: 'Fat Finger (FFC +1): volume invalide sur l’Exchange' };
    }
    const notional = n * inst.mid;
    if (notional > 12000000) {
      this.metrics.fatFingers += 1;
      this.emitEvent('alert', { kind: 'fatfinger' });
      this.say('system', 'ib', `FAT FINGER BLOCKED — ${n.toLocaleString('en-US')} ${ticker} ($${(notional / 1e6).toFixed(1)}M) above single-clip limit. (FFC +1)`, 'RISK-MGR');
      return { error: `Fat Finger (FFC +1): clip > $12M sur ${ticker}` };
    }

    const pos = this.positions[ticker];
    const signed = side === 'BUY' ? n : -n;
    const newQty = pos.qty + signed;
    const reducing = Math.abs(newQty) < Math.abs(pos.qty);

    if (this.role === 'AM') {
      if (side === 'BUY') {
        const dq0 = this.depthQuote(ticker, n);
        if (n * dq0.buyPrice + dq0.commission > this.cash + 1) {
          return { error: 'Insufficient available cash for this purchase' };
        }
      }
      if (!reducing && Math.abs(newQty * inst.mid) > BALANCE.amMaxSingleNotional) {
        return { error: `Single-security limit: $${(BALANCE.amMaxSingleNotional / 1e6).toFixed(0)}M max per line` };
      }
      const nextGross = this.grossNotional() - Math.abs(pos.qty * inst.mid) + Math.abs(newQty * inst.mid);
      if (nextGross > BALANCE.amMaxGrossNotional) {
        return { error: 'Gross exposure limit reached ($30M max)' };
      }
    } else {
      if (!reducing && Math.abs(newQty * inst.mid) > BALANCE.ibMaxSingleNotional) {
        return { error: 'IB inventory limit reached ($12M per security)' };
      }
      const nextGross = this.grossNotional() - Math.abs(pos.qty * inst.mid) + Math.abs(newQty * inst.mid);
      if (nextGross > BALANCE.ibMaxGrossNotional) {
        return { error: 'IB gross exposure limit reached ($24M)' };
      }
    }

    const dq = this.depthQuote(ticker, n);
    const price = side === 'BUY' ? dq.buyPrice : dq.sellPrice;
    const feeBps = this.role === 'IB' ? BALANCE.ibExchangeFeeBps : BALANCE.amExchangeFeeBps;
    const commission = Math.round((n * price * feeBps) / 1e4);

    if (this.role === 'IB') {
      if (reducing) {
        if (n <= inst.baseDepth * 0.45) this.metrics.clipsGood += 1;
        else if (n >= inst.baseDepth * 1.1) this.metrics.dumps += 1;
      }
      this.applyFill(ticker, signed, price, commission, 'EXCHANGE', { venue: 'EXCHANGE', counterparty: 'EXCHANGE' });
      this.metrics.exchangeTrades += 1;
      this.metrics.exchangeNotional += n * price;
    } else {
      this.applyFill(ticker, signed, price, commission, 'EXCHANGE', { venue: 'EXCHANGE', counterparty: 'EXCHANGE' });
      this.metrics.amExchangeTrades += 1;
      this.metrics.amExchangeNotional += n * price;
      this.metrics.amTrades += 1;
      this.recordExecutionCost(ticker, side, price, n * price);
      this.metrics.totalTradedNotional += n * price;
      this.metrics.alignedNotional += this.isAligned(ticker, side) ? n * price : 0;
      if (n >= inst.baseDepth * 1.15) this.metrics.dumps += 1;
    }

    // Market impact
    const impact = (n / inst.baseDepth) * (side === 'BUY' ? 1 : -1) * 0.0009;
    inst.logV += impact;
    inst.logTarget += impact * 0.35;

    return { ok: true, price, qty: n, commission };
  }

  hedge(ticker) {
    const pos = this.positions[ticker];
    if (!pos || pos.qty === 0) return { error: 'Aucune position à couvrir' };
    if (this.hedgeCooldown > 0) return { ok: true };
    const clip = Math.min(Math.abs(pos.qty), Math.round(this.inst[ticker].baseDepth * 0.5));
    this.hedgeCooldown = 0.25;
    return this.tradeExchange(ticker, pos.qty > 0 ? 'SELL' : 'BUY', clip);
  }

  isAligned(ticker, side) {
    const signal = this.newsSignal[ticker] + this.macroSignal * 0.6;
    if (Math.abs(signal) < 0.001) return true; // neutral news: not penalised
    return Math.sign(signal) === (side === 'BUY' ? 1 : -1);
  }

  // --------------------------------------------------------- IB client flow
  spawnClientRfq({ client = null, ticker = null, proactive = false } = {}) {
    if (this.role !== 'IB') return null;
    let c = client;
    if (!c) {
      const busy = new Set(this.clientRequests.filter((r) => r.status === 'open').map((r) => r.clientId));
      const free = this.clients.filter((cl) => !busy.has(cl.id));
      if (!free.length) return null;
      c = this.rng.pick(free);
    }

    let tk = ticker && this.inst[ticker] ? ticker : null;
    if (!tk) {
      const weights = TICKERS.map((t) => {
        const gap = Math.abs(this.inst[t].logTarget - this.inst[t].logV);
        const recent = this.news[0] && (this.news[0].ticker === t || this.news[0].kind === 'MACRO') ? 2.2 : 0.6;
        return 0.7 + gap * 22 + recent;
      });
      const sum = weights.reduce((a, b) => a + b, 0);
      let x = this.rng.next() * sum;
      let idx = 0;
      while (x > weights[idx] && idx < TICKERS.length - 1) { x -= weights[idx]; idx += 1; }
      tk = TICKERS[idx];
    }

    const inst = this.inst[tk];
    const targetNotional = this.rng.pick(c.notionalPref);
    const step = inst.mid >= 150 ? 1000 : 5000;
    const qty = Math.max(step, Math.round((targetNotional / inst.mid) / step) * step);
    const k = Math.round(qty / 1000);

    const gap = inst.logTarget - inst.logV;
    const informed = this.rng.chance(c.informedness);
    const dir = Math.sign(gap) || (this.rng.chance(0.5) ? 1 : -1);
    // Informed flow keeps part of its edge, but the market maker's 20-110 bps
    // spread must stay profitable on average (otherwise SSRM/PnL are unwinnable).
    const edgePct = informed && Math.abs(gap) > 0.002
      ? dir * Math.min(0.0042, Math.max(0.0012, Math.abs(gap) * 0.18)) * this.rng.range(0.8, 1.2)
      : (this.rng.chance(0.5) ? 1 : -1) * this.rng.range(0.0002, 0.0018);

    let template = this.rng.pick(CLIENT_MESSAGE_TEMPLATES);
    let sideBias = 0;
    if (informed && Math.abs(gap) > 0.012) sideBias = Math.sign(gap);
    else if (template.includes('Buy price')) sideBias = 1;
    else if (template.includes('Sell price')) sideBias = -1;
    else if (this.rng.chance(0.22)) sideBias = this.rng.chance(0.5) ? 1 : -1;

    const line = template
      .replaceAll('{ticker}', tk)
      .replaceAll('{tickerLower}', tk.toLowerCase())
      .replaceAll('{k}', String(k));

    const req = {
      id: uid('rfq'),
      clientId: c.id,
      clientName: c.name,
      team: c.team,
      ticker: tk,
      qty,
      sideBias,
      message: line,
      createdAt: this.totalSim,
      expiresAt: this.totalSim + BALANCE.rfqExpiry,
      status: 'open',
      informed,
      edgePct,
      fairPrice: inst.mid * (1 + edgePct),
      fromProactive: proactive,
    };
    for (const old of this.clientRequests) {
      if (old.clientId === c.id && old.status === 'open') old.status = 'replaced';
    }
    this.clientRequests.push(req);
    if (this.clientRequests.length > 60) this.clientRequests.shift();

    this.say('client', c.id, line, `${c.name} · ${c.team}`);
    c.unread = (c.unread || 0) + 1;
    this.emitEvent('rfq', { ticker: tk, qty, team: c.team });
    if (proactive) this.metrics.proactiveConversions += 0;
    return req;
  }

  sendQuote({ clientRoom, ticker, bid, offer, bidVol, offerVol, validFor = 45 }) {
    if (this.phase !== 'round') return { error: 'Round is not active' };
    if (this.role !== 'IB') return { error: 'Quote Ticket is only available in IB-55 role' };

    const client = this.clients.find((c) => c.id === clientRoom || c.team === clientRoom) || null;
    if (!client) return { error: 'Select a client in the Chat panel first' };

    const tk = String(ticker || '').toUpperCase().trim();
    const inst = this.inst[tk];
    if (!inst) return { error: `Unknown ticker "${tk}"` };

    const b = Number(bid); const o = Number(offer);
    const bv = Math.round(Number(bidVol)); const ov = Math.round(Number(offerVol));
    const ttl = clamp(Math.round(Number(validFor) || 45), 5, 120);

    if (![b, o, bv, ov].every(Number.isFinite) || b <= 0 || o <= 0) {
      this.metrics.fatFingers += 1;
      this.emitEvent('alert', { kind: 'fatfinger' });
      return { error: 'Fat Finger (FFC +1): bid, offer et volumes doivent être positifs' };
    }
    if (b >= o) {
      this.metrics.fatFingers += 1;
      this.emitEvent('alert', { kind: 'fatfinger' });
      this.say('system', 'ib', `FAT FINGER (FFC +1) — inverted quote on ${tk} (${b} / ${o}).`, 'RISK-MGR');
      return { error: 'Fat Finger (FFC +1): le bid doit être strictement inférieur à l’offer' };
    }
    if (bv < 500 || ov < 500 || bv > 500000 || ov > 500000) {
      this.metrics.fatFingers += 1;
      this.emitEvent('alert', { kind: 'fatfinger' });
      return { error: 'Fat Finger (FFC +1): volumes entre 500 et 500 000 titres' };
    }
    const mid = inst.mid;
    if (b < mid * 0.7 || o > mid * 1.3 || b > mid * 1.2 || o < mid * 0.8) {
      this.metrics.fatFingers += 1;
      this.emitEvent('alert', { kind: 'fatfinger' });
      this.say('system', 'ib', `FAT FINGER BLOCKED (FFC +1) — ${tk} ${b} / ${o} is >30% away from REFPRICE ${mid.toFixed(inst.dp)}.`, 'RISK-MGR');
      return { error: `Fat Finger Blocked (FFC +1): prix trop loin du REFPRICE (${mid.toFixed(inst.dp)})` };
    }

    const dec = (v) => priceStr(v, inst.dp);
    const halfSpreadBps = (((o - b) / 2) / mid) * 1e4;

    // supersede existing live quote for same client/ticker
    for (const q of this.liveQuotes) {
      if (q.status === 'live' && q.clientId === client.id && q.ticker === tk) {
        q.status = 'replaced';
        q.closedClock = fmtClock(this.totalSim, this.clockScale);
        this.oldQuotes.unshift({ ...q });
      }
    }
    this.liveQuotes = this.liveQuotes.filter((q) => q.status === 'live');

    const matching = this.clientRequests.find(
      (r) => r.clientId === client.id && r.ticker === tk && r.status === 'open',
    );

    const quote = {
      id: uid('q'),
      role: 'IB',
      clientId: client.id,
      team: client.team,
      clientName: client.name,
      ticker: tk,
      bid: dec(b),
      offer: dec(o),
      bidVol: bv,
      offerVol: ov,
      validFor: ttl,
      refAtQuote: mid,
      createdAt: this.totalSim,
      expiresAt: this.totalSim + ttl,
      decideAt: this.totalSim + this.rng.range(BALANCE.decisionDelayMin, BALANCE.decisionDelayMax),
      status: 'live',
      rfqId: matching?.id || null,
    };
    this.liveQuotes.unshift(quote);
    this.metrics.quotesSent += 1;
    this.metrics.quoteSpreadSum += halfSpreadBps;
    this.metrics.quoteSpreadCount += 1;
    this.metrics.quoteQualitySum += this.scoreSpreadQuote(halfSpreadBps);
    if (halfSpreadBps > BALANCE.ibQuoteWideHalfBps) this.metrics.wideQuotes += 1;
    if (halfSpreadBps < 8) this.metrics.razorQuotes += 1;

    this.say('me', client.id, `Quote was created. ${tk}, bid:${quote.bid}, offer:${quote.offer}, bidvol:${bv}, offervol:${ov}`, 'You');
    if (matching) matching.quoted = true;
    return { ok: true, quoteId: quote.id, halfSpreadBps: Math.round(halfSpreadBps * 10) / 10 };
  }

  cancelQuote(quoteId) {
    const idx = this.liveQuotes.findIndex((q) => q.id === quoteId && q.status === 'live');
    if (idx === -1) return { error: 'Quote is no longer live' };
    const q = this.liveQuotes[idx];
    q.status = 'cancelled';
    q.closedClock = fmtClock(this.totalSim, this.clockScale);
    this.liveQuotes.splice(idx, 1);
    this.oldQuotes.unshift(q);
    if (this.oldQuotes.length > 40) this.oldQuotes.pop();
    this.metrics.quotesCancelled += 1;
    this.say('me', q.clientId || q.dealerId, `Quote cancelled on ${q.ticker}.`, 'You');
    return { ok: true };
  }

  executeClientQuote(q, side, qty, price, label = 'client') {
    const inst = this.inst[q.ticker];
    const signed = side === 'BUY' ? qty : -qty;
    const commission = Math.round((qty * price * BALANCE.ibClientCommBps) / 1e4);
    const trade = this.applyFill(q.ticker, signed, price, commission, 'CLIENT', {
      counterparty: q.team,
      venue: 'OTC',
    });
    this.metrics.clientFills += 1;
    this.metrics.clientVolume += qty;
    this.metrics.clientNotional += qty * price;
    const client = this.clients.find((c) => c.id === q.clientId);
    if (client) {
      client.trades += 1;
      client.volume += qty;
    }
    const cat = q.team.startsWith('AM') ? 'AM' : 'HF';
    const action = side === 'BUY' ? 'sell' : 'buy';
    this.say(
      'client',
      q.clientId,
      `The quote has been executed on by ${cat}. ${q.ticker}, hfaction:${action}, volume:${qty}, price:${priceStr(price, inst.dp)}`,
      `${q.clientName} · ${q.team}`,
    );
    q.status = 'filled';
    q.fillSide = side;
    q.fillPrice = priceStr(price, inst.dp);
    q.fillQty = qty;
    q.closedClock = fmtClock(this.totalSim, this.clockScale);
    this.oldQuotes.unshift({ ...q });
    if (this.oldQuotes.length > 40) this.oldQuotes.pop();
    void label;
    return trade;
  }

  evaluateIbQuotes() {
    const still = [];
    for (const q of this.liveQuotes) {
      if (q.status !== 'live') continue;
      const inst = this.inst[q.ticker];
      const req = this.clientRequests.find((r) => r.id === q.rfqId) || null;
      const openReq = req && req.status === 'open' ? req : this.clientRequests.find(
        (r) => r.clientId === q.clientId && r.ticker === q.ticker && r.status === 'open',
      );

      if (this.totalSim >= q.expiresAt) {
        q.status = 'expired';
        q.closedClock = fmtClock(this.totalSim, this.clockScale);
        this.oldQuotes.unshift({ ...q });
        continue;
      }

      // A live quote is "subject to market": if the REFPRICE drifts more than
      // 35 bps away, the quote lapses instead of becoming a free option for
      // informed flow. The MM must re-quote on the new mid (core skill).
      const mid = inst.mid;
      const driftBps = Math.abs(mid / (q.refAtQuote || mid) - 1) * 1e4;
      if (driftBps > 35) {
        q.status = 'stale';
        q.closedClock = fmtClock(this.totalSim, this.clockScale);
        this.oldQuotes.unshift({ ...q });
        continue;
      }
      // News-crossed stale quote → immediate sniping at our quoted price.
      const crossedOffer = mid > q.offer * 1.0035;
      const crossedBid = mid < q.bid * 0.9965;
      if (crossedOffer || crossedBid) {
        // Client lifts our offer (we sell) or hits our bid (we buy).
        const clientBuys = crossedOffer;
        const qty = Math.min(openReq?.qty || 10000, clientBuys ? q.offerVol : q.bidVol);
        if (qty >= 500) {
          const price = clientBuys ? q.offer : q.bid;
          this.metrics.staleSniped += 1;
          this.metrics.adverse += (mid - price) * (clientBuys ? -qty : qty);
          if (openReq) openReq.status = 'filled';
          this.executeClientQuote(q, clientBuys ? 'SELL' : 'BUY', qty, price);
          continue;
        }
      }

      if (this.totalSim < q.decideAt || !openReq) { still.push(q); continue; }

      const fair = openReq.fairPrice || mid;
      const qtyAsked = openReq.qty;
      const canBuy = q.offerVol >= Math.max(500, qtyAsked * 0.5);
      const canSell = q.bidVol >= Math.max(500, qtyAsked * 0.5);

      let wantBuy = openReq.sideBias > 0;
      if (openReq.sideBias === 0) wantBuy = fair >= mid ? this.rng.chance(0.62) : this.rng.chance(0.38);

      const offerEdgeBps = ((fair - q.offer) / mid) * 1e4;
      const bidEdgeBps = ((q.bid - fair) / mid) * 1e4;
      const offerVsRefBps = ((q.offer - mid) / mid) * 1e4;
      const bidVsRefBps = ((mid - q.bid) / mid) * 1e4;

      let prob = 0;
      let tradeSide = null;
      if (wantBuy && canBuy) {
        if (offerEdgeBps > 1) prob = 0.9;
        else if (offerVsRefBps <= 130) prob = 0.8 - offerVsRefBps * 0.002;
        else prob = Math.max(0, 0.54 - (offerVsRefBps - 130) * 0.0032);
        tradeSide = 'BUY';
      } else if (!wantBuy && canSell) {
        if (bidEdgeBps > 1) prob = 0.9;
        else if (bidVsRefBps <= 130) prob = 0.8 - bidVsRefBps * 0.002;
        else prob = Math.max(0, 0.54 - (bidVsRefBps - 130) * 0.0032);
        tradeSide = 'SELL';
      }

      // clients dislike one-way volumes that are too small for the request
      const available = tradeSide === 'BUY' ? q.offerVol : q.bidVol;
      if (available < qtyAsked * 0.5) prob = 0;
      prob = clamp(prob * (0.6 + openReq.informed * 0.5), 0, 0.95);

      if (tradeSide && this.rng.chance(prob)) {
        const fillQty = Math.min(qtyAsked, available);
        // tradeSide is the CLIENT direction: a client buyer lifts our offer
        // (we sell), a client seller hits our bid (we buy).
        const price = tradeSide === 'BUY' ? q.offer : q.bid;
        const mmSide = tradeSide === 'BUY' ? 'SELL' : 'BUY';
        openReq.status = 'filled';
        this.executeClientQuote(q, mmSide, fillQty, price);
        continue;
      }
      still.push(q);
    }
    this.liveQuotes = still.filter((q) => q.status === 'live');
  }

  // --------------------------------------------------------- AM dealer flow
  requestQuote({ dealerRoom = 'ALL', ticker, qty, silent = false }) {
    if (this.phase !== 'round') return { error: 'Round is not active' };
    if (this.role !== 'AM') return { error: 'RFQ is only available in AM-55 role' };
    const tk = String(ticker || '').toUpperCase().trim();
    const inst = this.inst[tk];
    if (!inst) return { error: `Unknown ticker "${tk}"` };
    const n = Math.round(Number(qty));
    if (!Number.isFinite(n) || n < 100) return { error: 'Invalid quantity' };
    if (n * inst.mid > 12000000) {
      this.metrics.fatFingers += 1;
      this.emitEvent('alert', { kind: 'fatfinger' });
      return { error: 'Fat Finger (FFC +1): demande de quote > $12M' };
    }

    const targets = dealerRoom === 'ALL'
      ? this.dealers
      : this.dealers.filter((d) => d.id === dealerRoom);
    if (!targets.length) return { error: 'Unknown dealer' };

    for (const d of targets) {
      const spec = d.specialty.includes(tk);
      const base = d.baseHalfBps + (spec ? 0 : 13);
      const sizeBps = (n / (inst.baseDepth * 2)) * 9;
      const halfBps = Math.max(3.5, base + sizeBps + this.rng.range(-3.5, 6.5));
      const delay = this.rng.range(d.speedSec[0], d.speedSec[1]) + (dealerRoom === 'ALL' ? 0.3 : 0);
      this.pendingDealerQuotes.push({
        id: uid('dq'),
        dealerId: d.id,
        ticker: tk,
        qty: n,
        halfBps,
        dueAt: this.totalSim + delay,
        validFor: Math.round(this.rng.range(25, 45)),
        createdAt: this.totalSim,
        refAtRequest: inst.mid,
      });
      d.quotes += 1;
    }
    if (!silent) {
      if (dealerRoom === 'ALL') {
        this.say('me', 'am', `Shopping all dealers — ${n.toLocaleString('en-US')} ${tk}`, 'You');
      } else {
        this.say('me', dealerRoom, `${n.toLocaleString('en-US')} ${tk} pls`, 'You');
      }
    }
    return { ok: true, pending: targets.length };
  }

  processDealerReplies() {
    const keep = [];
    for (const p of this.pendingDealerQuotes) {
      if (this.totalSim < p.dueAt) { keep.push(p); continue; }
      const d = this.dealers.find((x) => x.id === p.dealerId);
      if (!d) continue;
      const inst = this.inst[p.ticker];
      if (!inst) continue;
      const dec = (v) => priceStr(v, inst.dp);
      const mid = inst.mid;
      const bid = dec(mid * (1 - p.halfBps / 1e4));
      const offer = dec(mid * (1 + p.halfBps / 1e4));
      const vol = Math.round((p.qty * this.rng.range(1.0, 1.8)) / 1000) * 1000;
      const q = {
        id: p.id,
        role: 'AM',
        dealerId: d.id,
        dealerName: d.name,
        team: d.name,
        ticker: p.ticker,
        bid,
        offer,
        bidVol: vol,
        offerVol: vol,
        validFor: p.validFor,
        refAtQuote: mid,
        createdAt: this.totalSim,
        expiresAt: this.totalSim + p.validFor,
        status: 'live',
        halfBps: Math.round(p.halfBps * 10) / 10,
        qtyRequested: p.qty,
      };
      this.liveQuotes.unshift(q);
      if (this.liveQuotes.length > 24) this.liveQuotes.pop();
      this.say(
        'client',
        d.id,
        `${p.ticker} ${Math.round(p.qty / 1000)}k — ${bid} / ${offer} · ${vol.toLocaleString('en-US')} × ${vol.toLocaleString('en-US')} · valid ${p.validFor}s`,
        `${d.name} · Dealer`,
      );
      this.emitEvent('quote', { ticker: p.ticker, dealer: d.name });
    }
    this.pendingDealerQuotes = keep;
  }

  acceptDealerQuote({ quoteId, side = 'BUY', qty = null }) {
    if (this.phase !== 'round') return { error: 'Round is not active' };
    if (this.role !== 'AM') return { error: 'Only AM-55 can execute dealer quotes' };
    const idx = this.liveQuotes.findIndex((q) => q.id === quoteId && q.status === 'live');
    if (idx === -1) return { error: 'Quote is no longer live' };
    const q = this.liveQuotes[idx];
    if (this.totalSim > q.expiresAt) {
      this.liveQuotes.splice(idx, 1);
      return { error: 'Quote has expired' };
    }
    const n = Math.round(Number(qty) || q.offerVol);
    if (!Number.isFinite(n) || n <= 0) {
      this.metrics.fatFingers += 1;
      this.emitEvent('alert', { kind: 'fatfinger' });
      return { error: 'Fat Finger (FFC +1): invalid size' };
    }
    if (n > q.bidVol * 1.02) {
      return { error: `Size above quoted volume (${q.bidVol.toLocaleString('en-US')})` };
    }
    const inst = this.inst[q.ticker];
    const price = side === 'BUY' ? q.offer : q.bid;
    const notional = n * price;
    const commission = Math.round((notional * BALANCE.amDealerCommBps) / 1e4);
    if (side === 'BUY' && notional + commission > this.cash) {
      return { error: `Insufficient available cash ($${Math.round(this.cash).toLocaleString('en-US')})` };
    }
    const signed = side === 'BUY' ? n : -n;
    const pos = this.positions[q.ticker];
    const newQty = pos.qty + signed;
    if (!(Math.abs(newQty) < Math.abs(pos.qty)) && Math.abs(newQty * inst.mid) > BALANCE.amMaxSingleNotional) {
      return { error: `Single-security limit: $${(BALANCE.amMaxSingleNotional / 1e6).toFixed(0)}M max per line` };
    }
    this.applyFill(q.ticker, signed, price, commission, 'DEALER', {
      venue: q.dealerName,
      counterparty: q.dealerName,
    });
    this.metrics.amDealerTrades += 1;
    this.metrics.amDealerNotional += notional;
    this.metrics.amTrades += 1;
    this.metrics.totalTradedNotional += notional;
    this.recordExecutionCost(q.ticker, side, price, notional);
    if (this.isAligned(q.ticker, side)) this.metrics.alignedNotional += notional;

    const dealer = this.dealers.find((d) => d.id === q.dealerId);
    if (dealer) dealer.fills += 1;
    const dec = (v) => priceStr(v, inst.dp);
    this.say('client', q.dealerId, `Done — you ${side === 'BUY' ? 'bought' : 'sold'} ${n.toLocaleString('en-US')} ${q.ticker} at ${dec(price)}.`, `${q.dealerName} · Dealer`);
    q.status = 'filled';
    q.fillSide = side;
    q.fillQty = n;
    q.fillPrice = dec(price);
    q.closedClock = fmtClock(this.totalSim, this.clockScale);
    this.oldQuotes.unshift({ ...q });
    this.liveQuotes.splice(idx, 1);
    return { ok: true, price: dec(price), qty: n };
  }

  // -------------------------------------------------------------------- Chat
  chat(room, rawText) {
    if (this.phase !== 'round') return { error: 'Round is not active' };
    const text = String(rawText || '').trim().slice(0, 240);
    if (!text) return null;

    const client = this.clients.find((c) => c.id === room);
    const dealer = this.dealers.find((d) => d.id === room);

    this.say('me', room, text, 'You');

    if (this.role === 'IB') {
      if (client) {
        client.lastOutreachAt = this.totalSim;
        const mentioned = TICKERS.find((t) => text.toUpperCase().includes(t));
        this.pendingClientReplies.push({
          dueAt: this.totalSim + this.rng.range(1.4, 3.2),
          clientId: client.id,
          ticker: mentioned || null,
          proactive: true,
        });
        this.metrics.proactiveReplies += 1;
        return { ok: true };
      }
      const tk = this.rng.pick(TICKERS);
      this.pendingClientReplies.push({
        dueAt: this.totalSim + this.rng.range(1.8, 3.8),
        clientId: null,
        ticker: tk,
        proactive: false,
        roomReply: room,
      });
      return { ok: true };
    }

    if (dealer) {
      const tk = TICKERS.find((t) => text.toUpperCase().includes(t));
      if (tk) {
        const qty = this.parseQty(text, tk) || Math.round(2000000 / this.inst[tk].mid / 1000) * 1000;
        const res = this.requestQuote({ dealerRoom: dealer.id, ticker: tk, qty, silent: true });
        return res?.error ? res : { ok: true };
      }
      this.pendingClientReplies.push({
        dueAt: this.totalSim + this.rng.range(1.5, 3.0),
        roomReply: dealer.id,
        dealerId: dealer.id,
        textReplay: true,
      });
      return { ok: true };
    }

    // AM Room / Deal Room: a typed price request shops every dealer, exactly
    // like "MSFT 10k pls" on the AmplifyME chat.
    const tkLoose = TICKERS.find((t) => new RegExp(`\\b${t}\\b`, 'i').test(text));
    if (tkLoose) {
      const qty = this.parseQty(text, tkLoose) || Math.round(2000000 / this.inst[tkLoose].mid / 1000) * 1000;
      const res = this.requestQuote({ dealerRoom: 'ALL', ticker: tkLoose, qty, silent: true });
      return res?.error ? res : { ok: true };
    }

    this.pendingClientReplies.push({
      dueAt: this.totalSim + this.rng.range(1.8, 3.6),
      roomReply: room,
      textReplay: true,
    });
    return { ok: true };
  }

  parseQty(text, ticker) {
    const cleaned = text.toUpperCase().replace(ticker, ' ');
    const m = cleaned.match(/(\d+(?:[.,]\d+)?)\s*(K|M)?/);
    if (!m) return null;
    let n = Number(m[1].replace(',', '.'));
    if (m[2] === 'K') n *= 1000;
    else if (m[2] === 'M') n *= 1000000;
    else if (n < 1000) n *= 1000; // "MSFT 10" → 10k
    return clamp(Math.round(n), 100, 500000);
  }

  processClientReplies() {
    const keep = [];
    for (const p of this.pendingClientReplies) {
      if (this.totalSim < p.dueAt) { keep.push(p); continue; }
      if (p.clientId) {
        const c = this.clients.find((x) => x.id === p.clientId);
        if (c) {
          this.spawnClientRfq({ client: c, ticker: p.ticker, proactive: true });
          if (p.proactive) this.metrics.proactiveConversions += 1;
        }
      } else if (p.dealerId) {
        const d = this.dealers.find((x) => x.id === p.dealerId);
        if (d) {
          const tk = this.rng.pick(d.specialty);
          this.say('client', d.id, this.rng.pick(DEALER_CHATTER).replaceAll('{t}', tk), `${d.name} · Dealer`);
        }
      } else if (p.roomReply === 'deal') {
        this.say('desk', 'deal', this.rng.pick(DEAL_ROOM_LINES).replaceAll('{t}', this.rng.pick(TICKERS)));
      } else if (p.roomReply === 'ib' || p.roomReply === 'am') {
        this.say('desk', p.roomReply, 'Copy that — desk is watching the tape.', this.rng.pick(DESK_TRADERS));
      } else {
        this.say('desk', p.roomReply, this.rng.pick(AM_ROOM_LINES), 'Desk chatter');
      }
    }
    this.pendingClientReplies = keep;
  }

  // -------------------------------------------------------------------- News
  buildSchedule() {
    const base = this.mode === 'replay'
      ? (this.round === 1 ? OFFICIAL_ROUND_1 : OFFICIAL_ROUND_2)
      : null;

    let items = [];
    if (base) {
      const fracs = base.length >= 10
        ? [0.004, 0.11, 0.18, 0.25, 0.32, 0.39, 0.5, 0.58, 0.66, 0.74, 0.86, 0.94]
        : [0.02, 0.2, 0.38, 0.55, 0.72, 0.88];
      items = base.map((n, i) => ({
        ...n,
        at: Math.round(this.roundSeconds * (fracs[i] ?? (0.1 + (0.85 * i) / base.length)) * 10) / 10,
      }));
    } else {
      const count = clamp(Math.round(this.roundSeconds / 75), 5, 15);
      const pool = [...ALL_NEWS];
      const picked = [];
      // guarantee at least 2 macro and 3 single stocks for a balanced wire
      const pickOne = (filter) => {
        const idxs = pool.map((n, i) => (filter(n) ? i : -1)).filter((i) => i >= 0);
        if (!idxs.length) return;
        const i = idxs[Math.floor(this.rng.next() * idxs.length)];
        picked.push(pool.splice(i, 1)[0]);
      };
      pickOne((n) => n.kind === 'MACRO');
      pickOne((n) => n.kind === 'MACRO');
      pickOne((n) => n.kind === 'STOCK');
      pickOne((n) => n.kind === 'STOCK');
      pickOne((n) => n.kind === 'STOCK');
      while (picked.length < count && pool.length) {
        const i = Math.floor(this.rng.next() * pool.length);
        picked.push(pool.splice(i, 1)[0]);
      }
      const noteAt = 0.5;
      picked.sort(() => this.rng.next() - 0.5);
      const usable = picked.slice(0, count - 1);
      items = usable.map((n, i) => ({
        ...n,
        at: Math.round(this.roundSeconds * (0.06 + (0.86 * i) / Math.max(1, usable.length - 1)) * 10) / 10,
      }));
      items.push({
        kind: 'NOTE', ticker: 'NOTE', tone: 0, halfway: true,
        headline: `NOTE: We are now half way through Round ${this.round}, there are ${Math.round(this.roundSeconds / 120)} minutes left of trading`,
        moves: {},
        hint: 'Moitié du round : coupez les expositions non voulues.',
        at: Math.round(this.roundSeconds * noteAt * 10) / 10,
      });
    }
    items.sort((a, b) => a.at - b.at);
    this.pendingNews = items.map((n, i) => ({ ...n, id: `n${this.round}-${i}`, fired: false, round: this.round }));
  }

  fireNews(n) {
    n.fired = true;
    if (n.kind === 'NOTE') {
      this.postNote(n.headline, n.hint);
      this.say('system', this.newsRoom(), n.headline, 'NEWSWIRE');
      this.emitEvent('news', { ticker: 'NOTE' });
      return;
    }
    const rawMoves = n.moves || {};
    const scale = BALANCE.newsImpactScale;
    const impactMap = {};
    for (const t of TICKERS) {
      const mv = (Number(rawMoves[t]) || 0) * scale;
      impactMap[t] = mv;
      if (!mv) continue;
      this.inst[t].logTarget += mv;
      this.newsSignal[t] += mv;
    }
    const macroImpact = n.kind === 'MACRO'
      ? TICKERS.reduce((a, t) => a + (impactMap[t] || 0), 0) / TICKERS.length
      : 0;
    if (macroImpact) this.macroSignal += macroImpact;

    this.news.unshift({
      id: n.id,
      at: this.round,
      simAt: Math.round(this.totalSim * 10) / 10,
      kind: n.kind,
      ticker: n.kind === 'MACRO' ? 'MACRO' : n.ticker,
      headline: n.headline,
      hint: n.hint,
      time: fmtClock(this.totalSim, this.clockScale),
      impact: n.tone * (macroImpact || Math.abs(impactMap[n.ticker] || 0)),
      moves: impactMap,
    });
    if (this.news.length > 40) this.news.pop();

    this.say('system', this.newsRoom(), `BREAKING — ${n.headline}`, 'NEWSWIRE');
    this.emitEvent('news', { ticker: n.kind === 'MACRO' ? 'MACRO' : n.ticker });

    if (this.role === 'IB') {
      this.nextRfqAt = Math.min(this.nextRfqAt, this.totalSim + this.rng.range(1.2, 2.8));
    }
  }

  // ------------------------------------------------------------------ Rounds
  beginRound() {
    if (this.round >= this.roundsTotal) return;
    this.round += 1;
    this.role = this.roleForRound(this.round);
    this.phase = 'round';
    this.debrief = this.debrief ? { ...this.debrief, open: false } : null;
    this.simTime = 0;
    this.totalSim = 0;
    this.roundStartSim = 0;
    this.breakTime = 0;
    this.resetRoundState();
    this.usedNewsClear();
    this.initMarket(this.round === 1);
    this.buildSchedule();
    this.nextRfqAt = this.rng.range(3, 5);
    this.nextChatterAt = this.rng.range(8, 14);

    const title = this.role === 'IB'
      ? 'Investment Bank — Market Maker Sell-Side (IB-55)'
      : 'Asset Manager — $20,000,000 Fund (AM-55)';
    this.postNote(
      `Round ${this.round} of the simulation has started — Active role: ${title}`,
      this.role === 'IB'
        ? 'Quote two-way prices to AM / HF clients, earn commissions, pull stale quotes on breaking news and unwind inventory in clips on the Exchange.'
        : 'Deploy the $20,000,000 mandate across the 5 equities, shop dealer quotes from IB-2 → IB-57 and keep a healthy cash buffer.',
    );
    this.say('system', this.newsRoom(), `ROUND ${this.round}/${this.roundsTotal} LIVE — ${title}`, 'AMPLIFY-HOST');

    if (this.role === 'IB') {
      this.say('client', this.clients[0].id, 'Hi desk — let me know when you are ready to show prices.', `${this.clients[0].name} · ${this.clients[0].team}`);
      this.say('desk', 'deal', 'Morning all, flow desk is open. Watch the wire for headline risk.', 'FLOW-DESK');
    } else {
      this.say('client', this.dealers[0].id, 'IB-2 desk open — send your RFQs, tight markets on MSFT and BABA.', 'IB-2 · Dealer');
      this.say('desk', 'am', 'Morning — remember to shop at least three dealers before hitting the Exchange.', 'AM-28');
    }
    this.emitEvent('round', { round: this.round, role: this.role });
  }

  usedNewsClear() {
    this.usedNews = new Set();
  }

  endRound() {
    for (const q of this.liveQuotes) {
      q.status = 'expired';
      q.closedClock = fmtClock(this.totalSim, this.clockScale);
      this.oldQuotes.unshift({ ...q });
    }
    this.liveQuotes = [];
    for (const r of this.clientRequests) if (r.status === 'open') r.status = 'expired';
    this.pendingDealerQuotes = [];
    this.pendingClientReplies = [];

    this.postNote(`Round ${this.round} of the simulation has now ended`);
    this.phase = 'break';

    const pnl = Math.round(this.roundTotalPnl());
    const scoreObj = this.computeRoleScore();
    const record = {
      round: this.round,
      role: this.role,
      pnl,
      realized: Math.round(this.realized),
      commission: this.commissionDisplay(),
      fills: this.metrics.clientFills + this.metrics.amTrades,
      exchangeTrades: this.metrics.exchangeTrades + this.metrics.amExchangeTrades,
      quotes: this.metrics.quotesSent,
      fatFingers: this.metrics.fatFingers,
      clientFills: this.metrics.clientFills,
      clientNotional: Math.round(this.metrics.clientNotional),
      cash: Math.round(this.cash),
      portfolioValue: Math.round(this.portfolioValue()),
      maxWeight: Math.round(this.maxPositionWeightPct()),
      scoreObj,
      total: Math.round(this.roundHistory.reduce((a, r) => a + r.pnl, 0) + pnl),
    };
    this.roundHistory.push(record);
    this.roundStats = record;

    const nextRole = this.round < this.roundsTotal ? this.roleForRound(this.round + 1) : null;
    this.debrief = {
      open: true,
      round: this.round,
      role: this.role,
      nextRole,
      stats: record,
      scoreObj,
      clients: (this.role === 'IB' ? this.clients : this.dealers).map((c) => ({
        name: c.name,
        team: c.team,
        trades: c.trades,
        note: c.note,
      })),
      tips: this.buildTips(),
    };

    if (this.round >= this.roundsTotal) this.finish();
  }

  finish() {
    this.phase = 'done';
    const lb = this.leaderboard();
    const totalPnl = this.roundHistory.reduce((a, r) => a + r.pnl, 0);
    this.final = {
      pnl: Math.round(totalPnl),
      score: lb.myScore,
      rank: lb.rank,
      total: lb.total,
      topPct: lb.topPct,
      fatFingers: this.roundHistory.reduce((a, r) => a + r.fatFingers, 0),
      rounds: this.roundHistory,
      tips: this.buildTips(),
    };
  }

  buildTips() {
    const m = this.metrics;
    const tips = [];
    const score = this.computeRoleScore();
    const g = Object.fromEntries(score.gauges.map((x) => [x.code, x.score]));

    if (m.fatFingers > 0) {
      tips.push({ tone: 'bad', text: `FFC = ${m.fatFingers}. Chaque erreur de saisie (bid ≥ offer, taille aberrante, prix hors marché) coûte 25 points sur la jauge FFC.` });
    }
    if (this.role === 'IB') {
      if (g.COMM < 60) tips.push({ tone: 'warn', text: 'COMM sous 60 % : vous n’avez pas assez coté le flux client. Répondez à chaque RFQ et relancez les clients dans le chat.' });
      if (g.SSRM < 60) tips.push({ tone: 'warn', text: `SSRM à ${g.SSRM} % : votre spread moyen est trop large (ou trop fin) autour du REFPRICE. Visez une demi-fourchette de 20–80 bps autour du REFPRICE et coupez les quotes avant chaque news.` });
      if (g.ETM < 60) tips.push({ tone: 'warn', text: `ETM à ${g.ETM} % : vous avez laissé une exposition nette non couverte ($${Math.round(this.netNotional()).toLocaleString('en-US')}). Débouclez en clips de 10k–15k sur l’Exchange.` });
      if (g.CT < 60) tips.push({ tone: 'warn', text: `CT à ${g.CT} % : ${m.clientFills} trades clients seulement. Priorisez les demandes de 25k–50k et affichez des volumes suffisants.` });
      if (m.staleSniped > 0) tips.push({ tone: 'bad', text: `${m.staleSniped} quote(s) snipée(s) sur news. Annulez systématiquement vos LIVE CHAT QUOTES dès qu’une dépêche rouge tombe.` });
      if (g.PnL >= 70) tips.push({ tone: 'good', text: `P&L solide ($${Math.round(score.pnl).toLocaleString('en-US')}) : conservez le même rythme de cotation et de couverture.` });
    } else {
      if (g.BSRM < 60) tips.push({ tone: 'warn', text: `BSRM à ${g.BSRM} % : cash ${(this.cash / Math.max(1, this.portfolioValue()) * 100).toFixed(1)} %, max ${this.maxPositionWeightPct().toFixed(0)} % sur une ligne. Gardez 5–15 % de cash et 5–15 % par valeur.` });
      if (g.ES < 60) tips.push({ tone: 'warn', text: `ES à ${g.ES} % : exécutez via les quotes dealers (IB-2…IB-57) plutôt que l’Exchange et comparez au moins 3 banques.` });
      if (g.RA < 60) tips.push({ tone: 'warn', text: `RA à ${g.RA} % : votre exposition n’est pas alignée avec les news. Traitez chaque dépêche dans le bon sens et gardez 60–110 % d’exposition brute.` });
      if (g.ROI < 60) tips.push({ tone: 'warn', text: `ROI à ${g.ROI} % : le mandat doit générer au moins +1,5 % ($300k). Prenez du risque sur les catalyseurs macro et micro.` });
      if (g.BSRM >= 75 && g.ROI >= 60) tips.push({ tone: 'good', text: 'Excellent équilibre risque / performance : c’est le profil Top 1 %. Maintiens cette discipline sur le second round.' });
    }
    if (!tips.length) {
      tips.push({ tone: 'good', text: 'Exécution propre, zéro fat finger, risque maîtrisé. Continuez comme ça pour sécuriser le Top 1 %.' });
    }
    return tips.slice(0, 5);
  }

  liveTips() {
    const tips = [];
    const m = this.metrics;
    if (this.role === 'IB') {
      const stale = this.liveQuotes.filter((q) => {
        const mid = this.inst[q.ticker]?.mid || 0;
        return mid > q.offer * 1.002 || mid < q.bid * 0.998;
      });
      if (stale.length) tips.push({ tone: 'bad', text: `URGENT : quote live sur ${stale[0].ticker} franchie par le marché — annulez-la (✕) immédiatement.` });
      if (Math.abs(this.netNotional()) > 3000000) tips.push({ tone: 'warn', text: `Exposition nette $${Math.round(this.netNotional()).toLocaleString('en-US')} : débouclez par clips de 10k sur l’Exchange pour protéger ETM.` });
      if (m.clientFills < 4 && this.simTime > this.roundSeconds * 0.35) tips.push({ tone: 'info', text: 'Répondez à chaque RFQ et relancez les clients : les commissions (COMM) et le volume (CT) pèsent 32 % du score IB.' });
      if (m.quoteSpreadCount && m.quoteSpreadSum / m.quoteSpreadCount > 120) tips.push({ tone: 'warn', text: 'Spread moyen trop large : visez une demi-fourchette de 20–80 bps autour du REFPRICE (SSRM).' });
    } else {
      if (this.cash / Math.max(1, this.portfolioValue()) < 0.05 && this.simTime > this.roundSeconds * 0.4) tips.push({ tone: 'bad', text: 'Cash quasi nul : le BSRM chute. Vendez une ligne pour reconstituer 5–15 % de réserve.' });
      if (this.maxPositionWeightPct() > 30) tips.push({ tone: 'warn', text: `Concentration ${this.maxPositionWeightPct().toFixed(0)} % sur une ligne : réduisez à 5–15 % par valeur.` });
      if (this.metrics.amExchangeTrades > this.metrics.amDealerTrades && this.metrics.amExchangeTrades >= 2) tips.push({ tone: 'warn', text: 'Vous passez trop par l’Exchange : shoppez les banques IB-2 → IB-57 pour un meilleur prix (ES).' });
      if (this.grossNotional() < 6000000 && this.simTime > this.roundSeconds * 0.3) tips.push({ tone: 'info', text: 'Capital sous-déployé : visez 60–100 % d’exposition brute sur les catalyseurs.' });
      if (m.amDealerTrades >= 3 && this.metrics.execNotionalSum > 0 && this.metrics.execCostSum / this.metrics.execNotionalSum < 25) tips.push({ tone: 'good', text: 'Exécution serrée face au REFPRICE — continuez la mise en concurrence des dealers.' });
    }
    if (this.assistMode && this.news[0]?.hint && this.news[0].kind !== 'NOTE') {
      tips.push({ tone: 'info', text: `Lecture news : ${this.news[0].hint}` });
    }
    return tips.slice(0, 3);
  }

  // -------------------------------------------------------------------- Tick
  step(dt) {
    if (this.phase !== 'round') return;
    this.simTime += dt;
    this.totalSim += dt;
    if (this.hedgeCooldown > 0) this.hedgeCooldown = Math.max(0, this.hedgeCooldown - dt);

    const left = this.roundSeconds - this.simTime;
    if (!this.oneMinWarned && left <= 60 && this.roundSeconds >= 150) {
      this.oneMinWarned = true;
      this.postNote('NOTE: There is one minute left until the end of the simulation');
      this.say('system', this.newsRoom(), `1 MINUTE REMAINING in Round ${this.round} — manage open risk before the close!`, 'AMPLIFY-HOST');
      this.emitEvent('alert', { kind: 'minute' });
    }

    for (const n of this.pendingNews) {
      if (!n.fired && this.simTime >= n.at) this.fireNews(n);
    }

    this.processClientReplies();

    if (this.role === 'IB' && this.totalSim >= this.nextRfqAt) {
      this.spawnClientRfq();
      const target = clamp(Math.sqrt(this.roundSeconds) * 0.92, 8, 42);
      this.nextRfqAt = this.totalSim + this.rng.range(target * 0.72, target * 1.28);
    }

    this.updatePrices(dt);
    this.updateCandles();

    if (this.role === 'IB') this.evaluateIbQuotes();
    else this.processDealerReplies();

    if (this.totalSim >= this.nextChatterAt) {
      this.nextChatterAt = this.totalSim + this.rng.range(BALANCE.chatterMin, BALANCE.chatterMax);
      const tk = this.rng.pick(TICKERS);
      if (this.role === 'IB') {
        this.say('desk', 'deal', this.rng.pick(DEAL_ROOM_LINES).replaceAll('{t}', tk));
      } else {
        this.say('desk', 'am', this.rng.pick(AM_ROOM_LINES), `AM-${this.rng.int(2, 41)}`);
        const d = this.rng.pick(this.dealers);
        this.say('client', d.id, this.rng.pick(DEALER_CHATTER).replaceAll('{t}', tk), `${d.name} · Dealer`);
      }
    }

    // Risk / behaviour sampling once per simulated second
    if (this.totalSim - this.lastSampleAt >= 1) {
      this.lastSampleAt = this.totalSim;
      const m = this.metrics;
      const net = Math.abs(this.netNotional());
      m.netSamples += 1;
      if (net > 3000000) m.netOverSamples += 1;
      m.netPeak = Math.max(m.netPeak, net);
      m.grossPeak = Math.max(m.grossPeak, this.grossNotional());
      if (this.role === 'IB' && net > 4500000 && !m.netAlerted) {
        m.netAlerted = true;
        this.emitEvent('alert', { kind: 'exposure' });
        this.say('system', 'ib', `RISK ALERT — net exposure $${Math.round(net).toLocaleString('en-US')} above $4.5M limit. Hedge in clips.`, 'RISK-MGR');
      }
      if (this.role === 'AM') {
        const pv = Math.max(1, this.portfolioValue());
        m.cashMin = Math.min(m.cashMin, this.cash);
        m.maxWeight = Math.max(m.maxWeight, this.maxPositionWeightPct());
        m.diversified = Math.max(m.diversified, this.diversifiedCount());
        if (this.cash / pv < 0.015 && !m.cashAlerted) {
          m.cashAlerted = true;
          this.emitEvent('alert', { kind: 'cash' });
        }
        if (this.maxPositionWeightPct() > 0.4 * 100 && !m.concentrationAlerted) {
          m.concentrationAlerted = true;
          this.emitEvent('alert', { kind: 'concentration' });
        }
      }
      const pnl = this.roundTotalPnl();
      if (pnl > m.peakPnl) m.peakPnl = pnl;
      if (m.peakPnl - pnl > m.maxDrawdown) m.maxDrawdown = m.peakPnl - pnl;
      this.equityCurve.push([Math.round(this.totalSim), Math.round(pnl)]);
      if (this.equityCurve.length > 900) this.equityCurve.shift();
    }

    if (this.simTime >= this.roundSeconds) {
      this.simTime = this.roundSeconds;
      this.endRound();
    }
  }

  updatePrices(dt) {
    for (const t of TICKERS) {
      const i = this.inst[t];
      const prev = i.mid;
      const pull = (i.logTarget - i.logV) * BALANCE.priceConvergence * dt;
      const shock = i.vol * this.rng.gauss() * Math.sqrt(dt) * 0.38;
      i.logV += pull + shock;
      const mid = priceStr(Math.exp(i.logV), i.dp);
      i.mid = mid;
      i.last = mid;
      i.dir = mid >= prev ? 1 : -1;
      if (mid > i.high) i.high = mid;
      if (mid < i.low) i.low = mid;
    }
  }

  updateCandles() {
    const bucket = Math.floor(this.totalSim / 5) * 5;
    for (const t of TICKERS) {
      const i = this.inst[t];
      const arr = this.candles[t];
      const last = arr[arr.length - 1];
      const dec = (v) => priceStr(v, i.dp);
      if (!last || last[0] < bucket) {
        arr.push([bucket, dec(i.mid), dec(i.mid), dec(i.mid), dec(i.mid), Math.round(4000 + this.rng.next() * 22000)]);
      } else {
        last[2] = Math.max(last[2], dec(i.mid));
        last[3] = Math.min(last[3], dec(i.mid));
        last[4] = dec(i.mid);
        last[5] += Math.round(600 + this.rng.next() * 3800);
      }
      if (arr.length > 900) arr.shift();
    }
  }

  setChartTicker(t) {
    if (this.inst[t]) this.chartTicker = t;
  }

  toggleWatchTicker(t) {
    if (!this.inst[t]) return;
    this.watchedTickers = this.watchedTickers.includes(t)
      ? this.watchedTickers.filter((x) => x !== t)
      : [...this.watchedTickers, t].slice(-4);
  }

  benchmarkSeries() {
    const buckets = new Map();
    for (const t of TICKERS) {
      const open = this.inst[t].open;
      for (const c of this.candles[t]) {
        const b = c[0];
        if (!buckets.has(b)) buckets.set(b, { sum: 0, n: 0 });
        const cur = buckets.get(b);
        cur.sum += (c[4] / open) * 100;
        cur.n += 1;
      }
    }
    return [...buckets.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([t, v]) => [t, Math.round((v.sum / v.n) * 1000) / 1000]);
  }

  // ---------------------------------------------------------------- Snapshot
  snapshot() {
    const lb = this.leaderboard();
    const role = this.role;
    const unr = this.unrealised();
    const pv = this.portfolioValue();
    const commission = this.commissionDisplay();
    const roundPnl = this.roundTotalPnl();
    const roleScore = this.computeRoleScore();
    const pvBase = this.phase === 'briefing' ? BALANCE.amFundCapital : pv;

    const positions = TICKERS
      .filter((t) => this.positions[t].traded || this.positions[t].qty !== 0)
      .map((t) => {
        const p = this.positions[t];
        const inst = this.inst[t];
        const notional = Math.round(p.qty * inst.mid);
        return {
          ticker: t,
          qty: p.qty,
          avg: p.qty !== 0 ? priceStr(p.avg, inst.dp) : 0,
          mark: priceStr(inst.mid, inst.dp),
          notional,
          absNotional: Math.abs(notional),
          unreal: Math.round(p.qty !== 0 ? p.qty * (inst.mid - p.avg) : 0),
          realised: Math.round(p.realisedPnl),
          netPnl: Math.round(p.realisedPnl + (p.qty !== 0 ? p.qty * (inst.mid - p.avg) : 0)),
          pctOfPortfolio: pvBase > 0 ? Math.round((Math.abs(notional) / pvBase) * 1000) / 10 : 0,
          pctOfLimit: Math.min(100, Math.round((Math.abs(notional) / BALANCE.amMaxSingleNotional) * 1000) / 10),
        };
      });

    const contactList = role === 'IB'
      ? this.clients.map((c) => ({
          id: c.id,
          name: c.name,
          team: c.team,
          phone: c.phone,
          color: c.color,
          unread: c.unread || 0,
          openRfq: this.clientRequests.find((r) => r.clientId === c.id && r.status === 'open') || null,
          trades: c.trades,
        }))
      : this.dealers.map((d) => ({
          id: d.id,
          name: d.name,
          team: d.team,
          phone: d.phone,
          color: d.color,
          unread: 0,
          openRfq: this.liveQuotes.find((q) => q.dealerId === d.id && q.status === 'live') || null,
          trades: d.fills,
        }));

    const roomTabs = role === 'IB'
      ? [{ id: 'ib', name: 'IB Room' }, { id: 'deal', name: 'Deal Room' }]
      : [{ id: 'am', name: 'AM Room' }, { id: 'deal', name: 'Deal Room' }];

    const chartInst = this.inst[this.chartTicker] || this.inst.MSFT;
    const chartPos = this.positions[this.chartTicker];

    return {
      sessionId: this.id,
      nickname: this.nickname,
      mode: this.mode,
      pace: this.pace,
      startRole: this.startRole,
      assistMode: this.assistMode,
      phase: this.phase,
      role,
      roleBadge: ROLE_BADGES[role],
      roleLabel: ROLE_LABELS[role],
      round: this.round,
      roundsTotal: this.roundsTotal,
      roundSeconds: this.roundSeconds,
      totalSim: Math.round(this.totalSim * 10) / 10,
      simTime: Math.round(this.simTime * 10) / 10,
      timeLeft: Math.max(0, Math.round((this.roundSeconds - this.simTime) * 10) / 10),
      progress: this.phase === 'round' ? clamp(this.simTime / this.roundSeconds, 0, 1) : this.phase === 'briefing' ? 0 : 1,
      speed: this.speed,
      paused: this.paused,
      clock: fmtClock(this.totalSim, this.clockScale),
      pnl: {
        realized: Math.round(this.realized),
        unrealised: Math.round(unr),
        commission,
        total: Math.round(roundPnl),
        sessionTotal: Math.round(this.totalPnl()),
        roiPct: role === 'AM' ? r2((roundPnl / BALANCE.amFundCapital) * 100) : null,
        fundCapital: BALANCE.amFundCapital,
        portfolioValue: Math.round(pv),
        cashAvailable: Math.round(this.cash),
        sharesOwned: this.sharesOwned(),
      },
      risk: {
        gross: Math.round(this.grossNotional()),
        net: Math.round(this.netNotional()),
        netPct: pv > 0 ? Math.round((this.netNotional() / pv) * 1000) / 10 : 0,
        limit: role === 'IB' ? BALANCE.ibMaxGrossNotional : BALANCE.amMaxGrossNotional,
        netLimit: 3000000,
        cashPct: role === 'AM' ? Math.round((this.cash / Math.max(1, pv)) * 1000) / 10 : null,
        maxWeightPct: role === 'AM' ? Math.round(this.maxPositionWeightPct() * 10) / 10 : null,
        perTicker: positions.filter((p) => p.qty !== 0).map((p) => ({
          ticker: p.ticker, notional: p.notional, pct: p.pctOfLimit, pctOfPortfolio: p.pctOfPortfolio,
        })),
      },
      equities: TICKERS.map((t) => {
        const e = this.inst[t];
        const d10 = this.depthQuote(t, 10000);
        return {
          ticker: t,
          name: e.name,
          sector: e.sector,
          type: e.type,
          dp: e.dp,
          ref: priceStr(e.mid, e.dp),
          open: e.open,
          last: priceStr(e.mid, e.dp),
          bid: d10?.sellPrice ?? null,
          offer: d10?.buyPrice ?? null,
          chg: Math.round((e.mid - e.open) * 100) / 100,
          chgPct: Math.round((e.mid / e.open - 1) * 10000) / 100,
          dir: e.dir,
        };
      }),
      positions,
      blotter: this.blotter.slice(0, 60),
      newTrades: this.blotter.length,
      tradeSeq: this.metrics.tradeSeq,
      chart: {
        ticker: this.chartTicker,
        dp: chartInst.dp,
        candles: this.candles[this.chartTicker] || [],
        benchmark: role === 'AM' ? this.benchmarkSeries() : [],
        ref: chartInst.open,
        avgLong: chartPos && chartPos.qty > 0 ? priceStr(chartPos.avg, chartInst.dp) : null,
        avgShort: chartPos && chartPos.qty < 0 ? priceStr(chartPos.avg, chartInst.dp) : null,
        markers: this.blotter
          .filter((b) => b.ticker === this.chartTicker)
          .slice(0, 25)
          .map((b) => ({ t: b.at, price: b.price, side: b.side, venue: b.venue })),
      },
      news: this.news.slice(0, 30).map((n) => ({
        ...n,
        headline: String(n.headline || '').replace(/^(MACRO|NOTE|[A-Z]{2,6}):\s*/, ''),
      })),
      messages: this.messages.slice(-140),
      chatRooms: roomTabs,
      contacts: contactList,
      clients: contactList,
      clientRequests: this.clientRequests
        .filter((r) => r.status === 'open')
        .map((r) => ({
          id: r.id,
          clientId: r.clientId,
          clientName: r.clientName,
          team: r.team,
          ticker: r.ticker,
          qty: r.qty,
          sideBias: r.sideBias,
          message: r.message,
          ttlLeft: Math.max(0, Math.ceil(r.expiresAt - this.totalSim)),
          informed: r.informed,
        })),
      liveQuotes: this.liveQuotes
        .filter((q) => q.status === 'live')
        .map((q) => ({
          id: q.id,
          role: q.role,
          room: q.clientId || q.dealerId,
          team: q.team,
          name: q.clientName || q.dealerName,
          ticker: q.ticker,
          bid: q.bid,
          offer: q.offer,
          bidVol: q.bidVol,
          offerVol: q.offerVol,
          validFor: Math.max(0, Math.ceil(q.expiresAt - this.totalSim)),
          expiresAt: Math.round(q.expiresAt * 10) / 10,
          halfBps: q.halfBps ?? (Math.round((((q.offer - q.bid) / 2) / q.refAtQuote) * 1e4 * 10) / 10),
          qtyRequested: q.qtyRequested || null,
        })),
      oldQuotes: this.oldQuotes.slice(0, 25).map((q) => ({
        id: q.id,
        team: q.team,
        name: q.clientName || q.dealerName,
        ticker: q.ticker,
        bid: q.bid,
        offer: q.offer,
        bidVol: q.bidVol,
        offerVol: q.offerVol,
        status: q.status,
        fillSide: q.fillSide || null,
        fillPrice: q.fillPrice || null,
        fillQty: q.fillQty || null,
        closedClock: q.closedClock || '',
      })),
      roleScore,
      coach: {
        gauges: roleScore.gauges,
        total: roleScore.total,
        tips: this.phase === 'round' ? this.liveTips() : [],
        stats: {
          clientFills: this.metrics.clientFills,
          clientNotional: Math.round(this.metrics.clientNotional),
          quotesSent: this.metrics.quotesSent,
          quotesCancelled: this.metrics.quotesCancelled,
          staleSniped: this.metrics.staleSniped,
          fatFingers: this.metrics.fatFingers,
          amDealerTrades: this.metrics.amDealerTrades,
          amExchangeTrades: this.metrics.amExchangeTrades,
          avgSlippageBps: this.metrics.execNotionalSum > 0
            ? Math.round((this.metrics.execCostSum / this.metrics.execNotionalSum) * 10) / 10
            : null,
          netExposure: Math.round(this.netNotional()),
          cashPct: role === 'AM' ? Math.round((this.cash / Math.max(1, pv)) * 1000) / 10 : null,
          maxWeightPct: role === 'AM' ? Math.round(this.maxPositionWeightPct() * 10) / 10 : null,
        },
      },
      leaderboard: lb,
      roundHistory: this.roundHistory,
      roundStats: this.roundStats,
      debrief: this.debrief,
      final: this.final,
      events: this.events.slice(-30),
      lastEventId: this.lastEventId,
      depth: this.lastDepth,
      sound: { enabled: true },
    };
  }
}
