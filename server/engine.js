// ---------------------------------------------------------------------------
// Authoritative Simulation Engine — CFA Institute x AmplifyME Format
// Roles: Sell-Side Investment Bank Trader (IB 1) & Buy-Side Asset Manager (AM 1)
// ---------------------------------------------------------------------------

import {
  INSTRUMENTS, STOCK_NEWS, MACRO_NEWS, IB_CLIENT_ROOMS, AM_DEALER_ROOMS,
  DEAL_ROOM_LINES, DESK_TRADERS, CLIENT_RFQ_TEMPLATES, BOT_NAMES, BOT_FIRMS,
} from './content.js';

export const BALANCE = {
  roundSeconds: 300,                 // 5 min default per round (configurable: 240 / 300 / 600)
  rounds: 2,                         // Official 2-round rotation: Round 1 (IB 1) -> Round 2 (AM 1)
  marketSecondsPerSimSecond: 9,      // Smooth market clock progression (e.g. 13:00 -> 13:45)
  priceConvergence: 0.048,           // News target convergence (~20-40s realistic price discovery)
  exchangeBaseHalfSpread: 0.0022,    // 22 bps base half-spread on Exchange for small 10k unwind clips
  exchangeDepthSlope: 0.0175,        // +175 bps per 1x baseDepth shares (punishes 50k dumps, rewards IB quotes!)
  exchangeImpactSlope: 0.0010,       // Market impact when hitting Exchange in size
  ibClientCommRate: 0.0012,          // +12 bps positive commission earned by IB on client fills
  ibExchangeFeeRate: 0.0002,         // 2 bps clearing fee paid by IB on Exchange unwinds
  amIbCommRate: 0.0006,              // 6 bps commission paid by AM when executing via IB quote
  amExchangeFeeRate: 0.0010,         // 10 bps fee paid by AM when executing directly on Exchange
  ibMaxSingleNotional: 8000000,      // $8M single-stock inventory limit for IB
  ibMaxGrossNotional: 20000000,      // $20M gross book limit for IB
  amFundCapital: 20000000,           // $20,000,000 Asset Management Mandate
  amMaxSingleNotional: 8000000,      // Max 40% ($8M) in a single stock for AM diversification
  amMaxGrossNotional: 25000000,      // Max $25M gross exposure (1.25x) for AM
  rfqIntervalMin: 7.5,
  rfqIntervalMax: 13.0,
  rfqExpiry: 50,
  decisionDelayMin: 1.8,
  decisionDelayMax: 4.2,
  adverseHorizon: 12,
  chatterMin: 14,
  chatterMax: 28,
};

const r2 = (n) => Math.round(n * 100) / 100;
const r3 = (n) => Math.round(n * 1000) / 1000;

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
    let u = 0, v = 0;
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

export function fmtClock(simSec) {
  // Starts at 13:00:00 (with pre-history from 12:45:00) matching AmplifyME screenshot
  const start = 13 * 3600;
  const t = Math.max(0, start + simSec * BALANCE.marketSecondsPerSimSecond);
  const h = Math.floor(t / 3600) % 24;
  const m = Math.floor((t % 3600) / 60);
  const s = Math.floor(t % 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

let seqId = 0;
const uid = (p) => `${p}${++seqId}`;

export class Session {
  constructor({
    id, seed, rounds, roundSeconds, nickname,
    mode = 'challenge', startRole = 'IB', assistMode = false,
  }) {
    this.id = id || uid('s');
    this.seed = seed ?? Math.floor(Math.random() * 1e9);
    this.rng = makeRng(this.seed);
    this.mode = ['challenge', 'ib', 'am'].includes(mode) ? mode : 'challenge';
    this.startRole = startRole === 'AM' ? 'AM' : 'IB';
    this.assistMode = Boolean(assistMode);
    this.roundsTotal = rounds ?? (this.mode === 'challenge' ? 2 : 2);
    this.roundSeconds = roundSeconds ?? BALANCE.roundSeconds;
    this.nickname = nickname || 'calvin';

    this.phase = 'briefing'; // briefing | round | break | done
    this.round = 0;
    this.role = this.roleForRound(1); // 'IB' | 'AM'
    this.speed = 1;
    this.paused = false;
    this.simTime = 0;
    this.totalSim = 0;
    this.roundStartSim = 0;
    this.breakTime = 0;
    this.oneMinWarned = false;

    this.chartTicker = 'BP';
    this.watchedTickers = ['BP', 'MSFT'];
    this.usedStockNews = new Set();
    this.usedMacroNews = new Set();

    // Round-level financial state
    this.realized = 0;
    this.ibCommissionEarned = 0;
    this.exchangeFeesPaid = 0;
    this.amCommPaid = 0;
    this.positions = {};
    this.candles = {};
    this.news = [];
    this.messages = [];
    this.blotter = [];
    this.liveQuotes = [];
    this.oldQuotes = [];
    this.clientRequests = []; // Inbound client RFQs in IB mode
    this.pendingDealerQuotes = []; // Pending IB dealer replies in AM mode
    this.pendingClientReplies = []; // Pending proactive sales replies in IB mode
    this.flow = {};
    this.hedgeCooldown = 0;

    // Cumulative multi-round tracking
    this.roundHistory = [];
    this.roundStats = null;
    this.debrief = null;
    this.final = null;

    this.initMetrics();
    this.initMarket(true);
    this.botPool = this.buildBotPool();

    this.pendingNews = [];
    this.nextRfqAt = 0;
    this.nextChatterAt = this.rng.range(6, 12);

    this.say('system', 'ib', `AmplifyME FlowTrader Engine ready — Mode: ${this.mode.toUpperCase()} (${this.roundsTotal} rounds).`, 'SYSTEM');
  }

  roleForRound(r) {
    if (this.mode === 'ib') return 'IB';
    if (this.mode === 'am') return 'AM';
    const first = this.startRole || 'IB';
    const second = first === 'IB' ? 'AM' : 'IB';
    return r % 2 === 1 ? first : second;
  }

  initMetrics() {
    this.metrics = {
      quotesSent: 0,
      quotesCancelled: 0,
      fills: 0,
      rfqFills: 0,
      exchangeTrades: 0,
      spreadCapture: 0,
      adverse: 0,
      staleSniped: 0,
      markoutsPending: [],
      maxAbsNotional: 0,
      passes: 0,
      rejects: 0,
      fatFingers: 0,
      proactiveSales: 0,
      proactiveConversions: 0,
      volumeQuoted: 0,
      volumeTraded: 0,
      clipsUnwoundWell: 0,
      oversizedExchangeDumps: 0,
      amIbBlocks: 0,
      amExchangeBlocks: 0,
      maxDiversifiedCount: 0,
      peakPnl: 0,
      maxDrawdown: 0,
    };
  }

  initMarket(initial = false) {
    this.inst = {};
    this.positions = {};
    this.candles = {};
    this.flow = {};

    for (const base of INSTRUMENTS) {
      // Slight fresh jitter on round 2+ while preserving familiar price scale
      const mult = initial ? 1 : this.rng.range(0.94, 1.06);
      const openRef = base.ref >= 100 ? r2(base.ref * mult) : r2(base.ref * mult);
      this.inst[base.ticker] = {
        ...base,
        ref: openRef,
        open: openRef,
        prevClose: openRef,
        logV: Math.log(openRef),
        logTarget: Math.log(openRef),
        mid: openRef,
        last: openRef,
        bid: openRef * (1 - BALANCE.exchangeBaseHalfSpread),
        offer: openRef * (1 + BALANCE.exchangeBaseHalfSpread),
        chg: 0,
        chgPct: 0,
        dir: 1,
      };
      this.positions[base.ticker] = {
        qty: 0,
        avg: 0,
        realisedPnl: 0,
        traded: false,
      };
      this.candles[base.ticker] = [];
    }

    // Pre-seed 100 buckets of historical pre-round price action (-100s .. 0s, i.e., 12:45 -> 13:00)
    // so charts, candlesticks, and SMA(20) look rich and authentic right at round open!
    for (const t of Object.keys(this.inst)) {
      const i = this.inst[t];
      let lv = Math.log(i.open * this.rng.range(0.985, 1.015));
      const targetEnd = Math.log(i.open);
      for (let step = -100; step <= 0; step++) {
        const pull = (targetEnd - lv) * 0.06;
        const o = Math.exp(lv);
        const c1 = Math.exp(lv + pull * 0.4 + i.vol * this.rng.gauss() * 0.7);
        const c2 = Math.exp(lv + pull * 0.8 + i.vol * this.rng.gauss() * 0.7);
        lv = lv + pull + i.vol * this.rng.gauss() * 0.65;
        if (step === 0) lv = targetEnd;
        const cl = Math.exp(lv);
        const hi = Math.max(o, c1, c2, cl);
        const lo = Math.min(o, c1, c2, cl);
        const dec = i.ref >= 100 ? r2 : r3;
        const vol = Math.round(18000 + this.rng.next() * 48000);
        this.candles[t].push([step, dec(o), dec(hi), dec(lo), dec(cl), vol]);
      }
      i.logV = Math.log(i.open);
      i.logTarget = Math.log(i.open);
      i.mid = i.open;
      i.last = i.open;
    }

    // Counterparty stats for IB mode
    this.clients = IB_CLIENT_ROOMS.map((c) => ({
      ...c,
      id: c.roomId,
      name: c.traderCode,
      trades: 0,
      informedTrades: 0,
      volume: 0,
      lastOutreachAt: -999,
    }));

    // Dealer stats for AM mode
    this.dealers = AM_DEALER_ROOMS.map((d) => ({
      ...d,
      id: d.roomId,
      name: d.traderCode,
      trades: 0,
    }));
  }

  // ----------------------------------------------------------- Market Depth
  depthQuote(ticker, rawQty = 10000) {
    const i = this.inst[ticker];
    if (!i) return null;
    const qty = Math.max(100, Math.round(Number(rawQty) || 10000));
    const depthRatio = qty / i.baseDepth;
    const halfSpread = Math.min(0.045, BALANCE.exchangeBaseHalfSpread + BALANCE.exchangeDepthSlope * depthRatio);
    const dec = i.ref >= 100 ? r2 : r3;
    const sellPrice = dec(i.mid * (1 - halfSpread));
    const buyPrice = dec(i.mid * (1 + halfSpread));
    const midNotional = qty * i.mid;
    const feeRate = this.role === 'IB' ? BALANCE.ibExchangeFeeRate : BALANCE.amExchangeFeeRate;
    const commission = Math.round(midNotional * feeRate);
    return {
      ticker,
      qty,
      mid: dec(i.mid),
      halfSpreadBps: Math.round(halfSpread * 10000),
      sellPrice,
      buyPrice,
      notional: Math.round(midNotional),
      commission,
    };
  }

  // --------------------------------------------------------------- P&L Math
  roundCommissionDisplay() {
    if (this.role === 'IB') {
      // Positive net commission earned from facilitating client flow (exact AmplifyME IB formula)
      return Math.round(this.ibCommissionEarned - this.exchangeFeesPaid);
    }
    // In AM role, commission is fees paid on trades
    return Math.round(this.amCommPaid);
  }

  unrealised() {
    let v = 0;
    for (const t of Object.keys(this.positions)) {
      const p = this.positions[t];
      if (p.qty !== 0) v += p.qty * (this.inst[t].mid - p.avg);
    }
    return v;
  }

  roundTotalPnl() {
    const unr = this.unrealised();
    if (this.role === 'IB') {
      return this.realized + unr + (this.ibCommissionEarned - this.exchangeFeesPaid);
    }
    return this.realized + unr - this.amCommPaid;
  }

  totalPnl() {
    const past = this.roundHistory.reduce((acc, r) => acc + r.pnl, 0);
    if (this.phase === 'break' || this.phase === 'done') return past;
    return past + this.roundTotalPnl();
  }

  grossNotional() {
    let v = 0;
    for (const t of Object.keys(this.positions)) {
      v += Math.abs(this.positions[t].qty * this.inst[t].mid);
    }
    return v;
  }

  netNotional() {
    let v = 0;
    for (const t of Object.keys(this.positions)) {
      v += this.positions[t].qty * this.inst[t].mid;
    }
    return v;
  }

  // ----------------------------------------------------- Multi-Metric Score
  computeRoleScore() {
    const m = this.metrics;
    const pnl = this.roundTotalPnl();

    if (this.role === 'IB') {
      // 1. P&L + Commission Generation (0..40 pts) — target ~$90k+ for full marks
      const pnlPts = Math.max(0, Math.min(40, ((pnl + 25000) / 125000) * 40));
      // 2. Client Flow & Commission Activity (0..25 pts) — target 8+ client trades & proactive outreach
      const commPts = Math.min(17, (this.ibCommissionEarned / 24000) * 17);
      const salesPts = Math.min(8, m.rfqFills * 1.1 + m.proactiveConversions * 2.0);
      const flowPts = Math.min(25, commPts + salesPts);
      // 3. Risk Management & Inventory Unwinding (0..20 pts)
      const maxLim = BALANCE.ibMaxGrossNotional;
      const riskRatio = m.maxAbsNotional / maxLim;
      let riskPts = 16;
      if (riskRatio > 0.85) riskPts -= 5;
      if (m.staleSniped > 0) riskPts -= Math.min(8, m.staleSniped * 3);
      if (m.oversizedExchangeDumps > 0) riskPts -= Math.min(6, m.oversizedExchangeDumps * 2);
      riskPts += Math.min(4, m.clipsUnwoundWell * 0.8);
      riskPts = Math.max(0, Math.min(20, riskPts));
      // 4. Operational Accuracy / Fat Finger Count (0..15 pts)
      const ffcPts = Math.max(0, 15 - m.fatFingers * 5);

      const total = Math.round(Math.max(5, Math.min(99, pnlPts + flowPts + riskPts + ffcPts)));
      return {
        role: 'IB',
        total,
        breakdown: [
          { label: 'Trading & Spread P&L', score: Math.round((pnlPts / 40) * 100), weight: '40%' },
          { label: 'Client Flow & Commissions', score: Math.round((flowPts / 25) * 100), weight: '25%' },
          { label: 'Risk & Unwind Discipline', score: Math.round((riskPts / 20) * 100), weight: '20%' },
          { label: 'Operational Accuracy (0 FFC)', score: Math.round((ffcPts / 15) * 100), weight: '15%' },
        ],
      };
    }

    // AM Role ($20M Fund) Score:
    const roiPct = (pnl / BALANCE.amFundCapital) * 100;
    // 1. Portfolio Return / ROI (0..45 pts) — target +4% to +8% return on $20M ($800k - $1.6M)
    const roiPts = Math.max(0, Math.min(45, ((roiPct + 1.0) / 6.5) * 45));
    // 2. Diversification & Drawdown Control (0..25 pts)
    let divPts = Math.min(15, m.maxDiversifiedCount * 4.2);
    const ddPct = (m.maxDrawdown / BALANCE.amFundCapital) * 100;
    const ddPts = Math.max(0, 10 - ddPct * 2.5);
    const riskPts = Math.max(0, Math.min(25, divPts + ddPts));
    // 3. Execution Quality: IB Quotes vs Exchange Impact (0..15 pts)
    const totalBlocks = m.amIbBlocks + m.amExchangeBlocks;
    const ibShare = totalBlocks > 0 ? m.amIbBlocks / totalBlocks : 0.5;
    const execPts = totalBlocks === 0 ? 4 : Math.min(15, 6 + ibShare * 9 - m.oversizedExchangeDumps * 2);
    // 4. Operational Accuracy / Fat Finger Count (0..15 pts)
    const ffcPts = Math.max(0, 15 - m.fatFingers * 5);

    const total = Math.round(Math.max(5, Math.min(99, roiPts + Math.max(0, execPts) + riskPts + ffcPts)));
    return {
      role: 'AM',
      total,
      roiPct: r2(roiPct),
      breakdown: [
        { label: 'Portfolio Return (ROI %)', score: Math.round((roiPts / 45) * 100), weight: '45%' },
        { label: 'Diversification & Risk Control', score: Math.round((riskPts / 25) * 100), weight: '25%' },
        { label: 'Execution Quality (IB vs Exch)', score: Math.round((Math.max(0, execPts) / 15) * 100), weight: '15%' },
        { label: 'Operational Accuracy (0 FFC)', score: Math.round((ffcPts / 15) * 100), weight: '15%' },
      ],
    };
  }

  overallChallengeScore() {
    const scores = this.roundHistory.map((r) => r.scoreObj?.total ?? 50);
    if (this.phase === 'round') scores.push(this.computeRoleScore().total);
    if (!scores.length) return 50;
    return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
  }

  // ------------------------------------------------------------ Leaderboard
  buildBotPool() {
    const pool = [];
    const n = 259; // +1 player = 260 global university students in session
    for (let i = 0; i < n; i++) {
      let sk = 0.50 + this.rng.gauss() * 0.165;
      sk = Math.max(0.08, Math.min(0.96, sk));
      const rounds = [];
      for (let r = 1; r <= 6; r++) {
        const rRole = this.roleForRound(r);
        if (rRole === 'IB') {
          const pnl = Math.round((sk - 0.36) * 185000 + this.rng.gauss() * 28000);
          const score = Math.round(Math.max(12, Math.min(97, sk * 92 + this.rng.gauss() * 6)));
          rounds.push({ pnl, score });
        } else {
          // AM $20M round P&L scale
          const pnl = Math.round((sk - 0.35) * 1450000 + this.rng.gauss() * 240000);
          const score = Math.round(Math.max(12, Math.min(97, sk * 92 + this.rng.gauss() * 6)));
          rounds.push({ pnl, score });
        }
      }
      pool.push({
        id: `b${i}`,
        name: BOT_NAMES[i % BOT_NAMES.length] + (i >= BOT_NAMES.length ? ` #${Math.floor(i / BOT_NAMES.length) + 1}` : ''),
        firm: BOT_FIRMS[Math.floor(this.rng.next() * BOT_FIRMS.length)],
        skill: sk,
        rounds,
      });
    }
    return pool;
  }

  leaderboard() {
    const progress = this.phase === 'round'
      ? Math.max(0.05, Math.min(1, this.simTime / this.roundSeconds))
      : this.phase === 'briefing' ? 0 : 1;

    const myScore = this.overallChallengeScore();
    const myPnl = Math.round(this.totalPnl());

    const rows = this.botPool.map((b) => {
      let pnl = 0;
      const scList = [];
      const maxR = Math.max(1, this.round || 1);
      for (let r = 0; r < maxR; r++) {
        const br = b.rounds[r] || b.rounds[0];
        if (r < (this.round - 1)) {
          pnl += br.pnl;
          scList.push(br.score);
        } else if (this.phase !== 'briefing') {
          pnl += br.pnl * progress;
          scList.push(Math.round(50 + (br.score - 50) * progress));
        }
      }
      const score = scList.length ? Math.round(scList.reduce((a, c) => a + c, 0) / scList.length) : 50;
      return { name: b.name, firm: b.firm, pnl: Math.round(pnl), score, me: false };
    });

    rows.push({
      name: this.nickname,
      firm: 'CFA Candidate (You)',
      pnl: myPnl,
      score: myScore,
      me: true,
    });

    // CFA x AmplifyME ranks by Composite Assessment Score, breaking ties by Total P&L
    rows.sort((a, b) => (b.score - a.score) || (b.pnl - a.pnl));
    rows.forEach((r, idx) => { r.rank = idx + 1; });

    const idx = rows.findIndex((r) => r.me);
    const total = rows.length;
    const rank = idx + 1;
    const percentile = Math.max(0.1, Math.min(99.9, (1 - idx / (total - 1)) * 100));
    const top10Idx = Math.max(0, Math.floor(total * 0.10) - 1);

    return {
      rows: rows.slice(0, 12),
      around: rows.slice(Math.max(0, idx - 3), idx + 4),
      rank,
      total,
      topPct: percentile,
      myPnl,
      myScore,
      firstThreshold: rows[top10Idx]?.pnl ?? 0,
      scoreThreshold: rows[top10Idx]?.score ?? 78,
    };
  }

  // -------------------------------------------------------------- Messaging
  say(kind, room, text, from) {
    const clock = fmtClock(this.totalSim);
    this.messages.push({
      id: uid('m'),
      at: this.totalSim,
      clock,
      room,
      kind,
      from: from || (kind === 'desk' ? this.rng.pick(DESK_TRADERS) : 'SYSTEM'),
      text,
    });
    if (this.messages.length > 160) this.messages.shift();
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
      time: fmtClock(this.totalSim),
      impact: 0,
    });
    if (this.news.length > 28) this.news.pop();
  }

  // -------------------------------------------------------------- Execution
  applyFill(ticker, signedQty, price, commAmount, source, meta = {}) {
    const pos = this.positions[ticker];
    const side = signedQty > 0 ? 'BUY' : 'SELL';
    const qty = Math.abs(signedQty);
    pos.traded = true;

    // Average cost & per-security Realised P&L (FIFO/avg cost standard)
    if (pos.qty !== 0 && Math.sign(pos.qty) !== Math.sign(signedQty)) {
      const closed = Math.min(qty, Math.abs(pos.qty));
      const pnlClosed = (price - pos.avg) * closed * Math.sign(pos.qty);
      pos.realisedPnl += pnlClosed;
      this.realized += pnlClosed;
      if (qty > Math.abs(pos.qty)) {
        pos.avg = price;
      }
    } else if (qty > 0) {
      pos.avg = (pos.avg * Math.abs(pos.qty) + price * qty) / (Math.abs(pos.qty) + qty);
    }

    pos.qty += signedQty;
    if (pos.qty === 0) pos.avg = 0;

    // Commission accounting by Role & Venue
    if (this.role === 'IB') {
      if (source === 'CLIENT') {
        this.ibCommissionEarned += commAmount;
      } else {
        this.exchangeFeesPaid += commAmount;
      }
    } else {
      this.amCommPaid += commAmount;
    }

    const mid = this.inst[ticker].mid;
    const capture = (mid - price) * signedQty;
    this.metrics.volumeTraded += qty;
    this.metrics.fills += 1;

    const dec = this.inst[ticker].ref >= 100 ? r2 : r3;
    const trade = {
      id: uid('tr'),
      at: Math.round(this.totalSim * 10) / 10,
      clock: fmtClock(this.totalSim),
      ticker,
      side,
      qty,
      price: dec(price),
      fee: Math.round(commAmount),
      commSigned: this.role === 'IB' && source === 'CLIENT' ? Math.round(commAmount) : -Math.round(commAmount),
      source,
      capture: Math.round(capture),
      ...meta,
      posAfter: pos.qty,
      pnlAfter: Math.round(this.roundTotalPnl()),
    };
    this.blotter.unshift(trade);
    if (this.blotter.length > 80) this.blotter.pop();

    if (this.role === 'IB' && source === 'CLIENT') {
      this.metrics.markoutsPending.push({
        dueAt: this.totalSim + BALANCE.adverseHorizon,
        price,
        signedQty,
        ticker,
        tradeId: trade.id,
      });
      this.metrics.spreadCapture += capture;
      this.metrics.rfqFills += 1;
      (this.flow[ticker] || (this.flow[ticker] = [])).push({
        at: this.totalSim,
        signed: signedQty,
        notional: qty * price,
      });
    }

    // Track AM diversification
    if (this.role === 'AM') {
      const activeNames = Object.keys(this.positions).filter(
        (k) => Math.abs(this.positions[k].qty * this.inst[k].mid) >= 1000000
      ).length;
      if (activeNames > this.metrics.maxDiversifiedCount) {
        this.metrics.maxDiversifiedCount = activeNames;
      }
    }

    return trade;
  }

  processMarkouts() {
    const keep = [];
    for (const m of this.metrics.markoutsPending) {
      if (this.totalSim >= m.dueAt) {
        const mo = (this.inst[m.ticker].mid - m.price) * m.signedQty;
        this.metrics.adverse += mo;
        const tr = this.blotter.find((b) => b.id === m.tradeId);
        if (tr) tr.markout = Math.round(mo);
      } else {
        keep.push(m);
      }
    }
    this.metrics.markoutsPending = keep;
  }

  // --------------------------------------------------------- Exchange Trade
  tradeExchange(ticker, side, qty) {
    if (this.phase !== 'round') return { error: 'Round is not currently active' };
    const inst = this.inst[ticker];
    if (!inst) return { error: 'Unknown security ticker' };

    qty = Math.round(Number(qty));
    if (!Number.isFinite(qty) || qty <= 0) {
      this.metrics.fatFingers += 1;
      return { error: 'Fat Finger (FFC +1): Invalid volume entered on Exchange' };
    }

    const notionalMid = qty * inst.mid;
    if (notionalMid > 12000000) {
      this.metrics.fatFingers += 1;
      this.say('system', 'ib', `FAT FINGER BLOCKED: Exchange order ${qty.toLocaleString()} ${ticker} ($${(notionalMid / 1e6).toFixed(1)}M) exceeds single-clip desk limit! (FFC +1)`, 'RISK-MGR');
      return { error: `Fat Finger (FFC +1): Single order notional ($${(notionalMid / 1e6).toFixed(1)}M) exceeds $12M clip limit!` };
    }

    const pos = this.positions[ticker];
    const signed = side === 'BUY' ? qty : -qty;
    const newQty = pos.qty + signed;
    const reducing = Math.abs(newQty) < Math.abs(pos.qty);

    const maxSingle = this.role === 'IB' ? BALANCE.ibMaxSingleNotional : BALANCE.amMaxSingleNotional;
    const maxGross = this.role === 'IB' ? BALANCE.ibMaxGrossNotional : BALANCE.amMaxGrossNotional;

    if (!reducing) {
      if (Math.abs(newQty * inst.mid) > maxSingle) {
        return { error: `Single-security risk limit reached on ${ticker} ($${(maxSingle / 1e6).toFixed(0)}M max)` };
      }
      const nextGross = this.grossNotional() - Math.abs(pos.qty * inst.mid) + Math.abs(newQty * inst.mid);
      if (nextGross > maxGross) {
        return { error: `Portfolio gross exposure limit reached ($${(maxGross / 1e6).toFixed(0)}M max)` };
      }
    }

    const dq = this.depthQuote(ticker, qty);
    const execPrice = side === 'BUY' ? dq.buyPrice : dq.sellPrice;
    const comm = dq.commission;

    // Track unwind clip discipline
    if (reducing) {
      if (qty <= inst.baseDepth * 0.45) this.metrics.clipsUnwoundWell += 1;
      else if (qty >= inst.baseDepth * 1.15) this.metrics.oversizedExchangeDumps += 1;
    } else if (this.role === 'AM' && notionalMid >= 1800000) {
      this.metrics.amExchangeBlocks += 1;
      if (qty >= inst.baseDepth * 1.1) this.metrics.oversizedExchangeDumps += 1;
    }

    this.applyFill(ticker, signed, execPrice, comm, 'EXCHANGE', {
      client: 'EXCHANGE',
      venue: 'EXCHANGE',
    });

    // Realistic market impact on Exchange mid
    const impact = BALANCE.exchangeImpactSlope * (qty / inst.baseDepth) * (side === 'BUY' ? 1 : -1);
    inst.logV += impact;
    inst.logTarget += impact * 0.35;
    this.metrics.exchangeTrades += 1;

    return { ok: true, price: execPrice, qty };
  }

  hedge(ticker) {
    const pos = this.positions[ticker];
    if (!pos || pos.qty === 0) return { error: 'No open position to unwind' };
    if (this.hedgeCooldown > 0) return { ok: true };
    const inst = this.inst[ticker];
    // Unwind smartly up to 1x baseDepth clip
    const clip = Math.min(Math.abs(pos.qty), Math.round(inst.baseDepth * 0.5));
    this.hedgeCooldown = 0.3;
    return this.tradeExchange(ticker, pos.qty > 0 ? 'SELL' : 'BUY', clip);
  }

  // ------------------------------------------------ IB Role: Quotes & Flow
  spawnClientRfq(forcedClient = null, forcedTicker = null, fromProactive = false) {
    if (this.role !== 'IB') return null;
    const rng = this.rng;

    let c = forcedClient;
    if (!c) {
      const candidates = this.clients.filter((cl) =>
        !this.clientRequests.some((r) => r.clientRoom === cl.roomId && r.status === 'open')
      );
      if (!candidates.length) return null;
      c = rng.pick(candidates);
    }

    // Weight towards stocks with recent breaking news / active price discovery
    const tickers = Object.keys(this.inst);
    let ticker = forcedTicker && this.inst[forcedTicker] ? forcedTicker : null;
    if (!ticker) {
      const weights = tickers.map((t) => {
        const i = this.inst[t];
        const gap = Math.abs(i.logTarget - i.logV);
        const recent = this.news[0] && (this.news[0].ticker === t || this.news[0].kind === 'MACRO') ? 2.2 : 0.7;
        return 0.8 + gap * 18 + recent;
      });
      const sum = weights.reduce((a, b) => a + b, 0);
      let x = rng.next() * sum;
      let idx = 0;
      while (x > weights[idx] && idx < weights.length - 1) { x -= weights[idx]; idx++; }
      ticker = tickers[idx];
    }

    const inst = this.inst[ticker];
    const targetNotional = rng.pick(c.notionalPref);
    const step = inst.ref >= 150 ? 1000 : 5000;
    const qty = Math.max(step, Math.round((targetNotional / inst.mid) / step) * step);

    const gap = inst.logTarget - inst.logV;
    const informed = rng.chance(c.informedness);
    let edgePct;
    if (informed && Math.abs(gap) > 0.008) {
      const dir = Math.sign(gap);
      edgePct = dir * Math.min(0.026, Math.max(0.011, Math.abs(gap) * 0.42)) * rng.range(0.8, 1.15);
    } else {
      // Liquidity / rebalancing client willing to pay tighter than Exchange block spread (~1.7%)
      edgePct = (rng.chance(0.5) ? 1 : -1) * rng.range(0.011, 0.021);
    }

    const req = {
      id: uid('rfq'),
      clientRoom: c.roomId,
      team: c.team,
      traderCode: c.traderCode,
      arch: c.arch,
      archLabel: c.label,
      ticker,
      qty,
      createdAt: this.totalSim,
      expiresAt: this.totalSim + BALANCE.rfqExpiry,
      status: 'open',
      informed,
      fromProactive,
      edgePct,
      fairPrice: inst.mid * (1 + edgePct),
    };

    // Replace any older open request in the same client room
    for (const old of this.clientRequests) {
      if (old.clientRoom === c.roomId && old.status === 'open') old.status = 'replaced';
    }
    this.clientRequests.push(req);
    if (this.clientRequests.length > 50) this.clientRequests.shift();

    const line = fromProactive
      ? `y pls - ${qty.toLocaleString('en-US')} ${ticker}`
      : rng.pick(CLIENT_RFQ_TEMPLATES).replace('{qty}', qty.toLocaleString('en-US')).replace('{t}', ticker);

    this.say('client', c.roomId, line, c.traderCode);
    return req;
  }

  sendQuote({ clientRoom, ticker, bid, offer, bidVol, offerVol, validFor = 45, rfqId = null }) {
    if (this.phase !== 'round') return { error: 'Round is not active' };
    if (this.role !== 'IB') return { error: 'Switch to IB role to send market-making quotes' };

    // Resolve target client
    let targetRoom = clientRoom;
    if (!targetRoom && rfqId) {
      const found = this.clientRequests.find((r) => r.id === rfqId);
      if (found) targetRoom = found.clientRoom;
    }
    const client = this.clients.find((c) => c.roomId === targetRoom) || this.clients[0];
    if (!client) return { error: 'Select a valid HF / AM client in Chat' };

    const tk = String(ticker || '').toUpperCase().trim();
    const inst = this.inst[tk];
    if (!inst) return { error: `Unknown ticker "${tk}"` };

    bid = Number(bid);
    offer = Number(offer);
    bidVol = Math.round(Number(bidVol));
    offerVol = Math.round(Number(offerVol));
    const ttl = Math.max(5, Math.min(120, Math.round(Number(validFor) || 45)));

    if (![bid, offer, bidVol, offerVol].every(Number.isFinite) || bid <= 0 || offer <= 0) {
      this.metrics.fatFingers += 1;
      return { error: 'Fat Finger (FFC +1): Enter valid positive Bid, Offer, and Volumes' };
    }
    if (bid >= offer) {
      this.metrics.fatFingers += 1;
      this.say('system', 'ib', `FAT FINGER (FFC +1): Inverted quote on ${tk} (Bid ${bid} >= Offer ${offer})!`, 'RISK-MGR');
      return { error: 'Fat Finger (FFC +1): Bid price must be strictly lower than Offer price!' };
    }
    if (bidVol < 500 || offerVol < 500 || bidVol > 250000 || offerVol > 250000) {
      this.metrics.fatFingers += 1;
      return { error: 'Fat Finger (FFC +1): Quote volume must be between 500 and 250,000 shares' };
    }

    const mid = inst.mid;
    // Extreme typo check (e.g. 550 instead of 55, or 5.5 instead of 55)
    if (bid < mid * 0.65 || offer > mid * 1.35 || bid > mid * 1.30 || offer < mid * 0.70) {
      this.metrics.fatFingers += 1;
      this.say('system', 'ib', `FAT FINGER BLOCKED (FFC +1): ${tk} quote ${bid}/${offer} is >30% away from RefPrice $${mid.toFixed(2)}!`, 'RISK-MGR');
      return { error: `Fat Finger Blocked (FFC +1): Quote (${bid} / ${offer}) is far off RefPrice ($${mid.toFixed(2)})` };
    }

    // Warn & count FFC if badly off-market (>8% crossed against RefPrice)
    if (bid > mid * 1.08 || offer < mid * 0.92) {
      this.metrics.fatFingers += 1;
      this.say('system', 'ib', `WARNING (FFC +1): Off-market quote sent on ${tk} (${bid}/${offer} vs Ref $${mid.toFixed(2)})!`, 'RISK-MGR');
    }

    //Supersede any existing live quote for same client + same ticker
    for (const q of this.liveQuotes) {
      if (q.status === 'live' && q.clientRoom === client.roomId && q.ticker === tk) {
        q.status = 'replaced';
        q.closedClock = fmtClock(this.totalSim);
        this.oldQuotes.unshift({ ...q });
      }
    }
    this.liveQuotes = this.liveQuotes.filter((q) => q.status === 'live');

    const matchingReq = this.clientRequests.find(
      (r) => r.clientRoom === client.roomId && r.ticker === tk && r.status === 'open'
    );

    const dec = inst.ref >= 100 ? r2 : r3;
    const quote = {
      id: uid('q'),
      role: 'IB',
      clientRoom: client.roomId,
      team: client.team,
      traderCode: client.traderCode,
      ticker: tk,
      bid: dec(bid),
      offer: dec(offer),
      bidVol,
      offerVol,
      validFor: ttl,
      createdAt: this.totalSim,
      expiresAt: this.totalSim + ttl,
      decideAt: this.totalSim + this.rng.range(BALANCE.decisionDelayMin, BALANCE.decisionDelayMax),
      evaluatedOnce: false,
      rfqId: matchingReq?.id || null,
      status: 'live',
    };

    this.liveQuotes.unshift(quote);
    this.metrics.quotesSent += 1;
    this.metrics.volumeQuoted += Math.round((bidVol + offerVol) / 2);

    // Exact AmplifyME chat confirmation line (matches image-1.png!)
    this.say(
      'me',
      client.roomId,
      `Quote was created. ${tk}, bid:${quote.bid}, offer:${quote.offer}, bidvol:${bidVol}, offervol:${offerVol}`,
      'You'
    );

    return { ok: true, quoteId: quote.id };
  }

  cancelQuote(quoteId) {
    const idx = this.liveQuotes.findIndex((q) => q.id === quoteId && q.status === 'live');
    if (idx === -1) return { error: 'Quote is no longer live' };
    const q = this.liveQuotes[idx];
    q.status = 'cancelled';
    q.closedClock = fmtClock(this.totalSim);
    this.liveQuotes.splice(idx, 1);
    this.oldQuotes.unshift(q);
    if (this.oldQuotes.length > 40) this.oldQuotes.pop();
    this.metrics.quotesCancelled += 1;
    this.say('me', q.clientRoom || q.dealerRoom, `Quote cancelled on ${q.ticker}.`, 'You');
    return { ok: true };
  }

  evaluateIbQuotes() {
    const stillLive = [];
    for (const q of this.liveQuotes) {
      if (q.status !== 'live') continue;

      if (this.totalSim >= q.expiresAt) {
        q.status = 'expired';
        q.closedClock = fmtClock(this.totalSim);
        this.oldQuotes.unshift(q);
        continue;
      }

      if (this.totalSim < q.decideAt) {
        stillLive.push(q);
        continue;
      }

      const inst = this.inst[q.ticker];
      const mid = inst.mid;
      const client = this.clients.find((c) => c.roomId === q.clientRoom);
      const req = this.clientRequests.find((r) => r.id === q.rfqId && r.status === 'open');

      let clientSide = null;
      if (!q.evaluatedOnce) {
        // Initial evaluation when client checks your fresh quote
        const desiredQty = req ? req.qty : Math.min(q.bidVol, q.offerVol);
        const exch = this.depthQuote(q.ticker, desiredQty);
        const fair = req ? req.fairPrice : mid * (1 + (this.rng.chance(0.5) ? 0.008 : -0.008));

        if (req && !req.informed) {
          // Liquidity client executes if your price beats the Exchange block depth price!
          if (req.edgePct > 0 && q.offer <= Math.max(fair, exch.buyPrice * 0.996)) clientSide = 'BUY';
          else if (req.edgePct < 0 && q.bid >= Math.min(fair, exch.sellPrice * 1.004)) clientSide = 'SELL';
        } else {
          if (q.offer <= fair) clientSide = 'BUY';
          else if (q.bid >= fair) clientSide = 'SELL';
        }

        if (!clientSide) {
          q.evaluatedOnce = true;
          const widthPct = ((q.offer - q.bid) / mid) * 100;
          if (req && widthPct > 3.6 && this.rng.chance(0.7)) {
            this.say('client', q.clientRoom, 'That spread is too wide vs Exchange — watching if market moves.', q.traderCode);
          }
          stillLive.push(q);
          continue;
        }
      } else {
        // Quote was left open in LIVE CHAT QUOTES: only sniped if market mid moves meaningfully through your quote!
        if (mid >= q.offer * 1.008) clientSide = 'BUY';
        else if (mid <= q.bid * 0.992) clientSide = 'SELL';
        else {
          stillLive.push(q);
          continue;
        }
      }

      // Client wants to execute!
      const execPrice = clientSide === 'BUY' ? q.offer : q.bid;
      const availVol = clientSide === 'BUY' ? q.offerVol : q.bidVol;
      const fillQty = req ? Math.min(req.qty, availVol) : availVol;
      const ourSigned = clientSide === 'BUY' ? -fillQty : fillQty;

      // Risk limit check on our IB book
      const pos = this.positions[q.ticker];
      const newQty = pos.qty + ourSigned;
      const reducing = Math.abs(newQty) < Math.abs(pos.qty);
      const nextGross = this.grossNotional() - Math.abs(pos.qty * mid) + Math.abs(newQty * mid);

      if (!reducing && (Math.abs(newQty * mid) > BALANCE.ibMaxSingleNotional || nextGross > BALANCE.ibMaxGrossNotional)) {
        q.status = 'rejected';
        q.closedClock = fmtClock(this.totalSim);
        this.oldQuotes.unshift(q);
        this.metrics.rejects += 1;
        this.say('system', 'ib', `RISK REJECT: Client fill on ${q.ticker} blocked — single-stock ($8M) or gross ($20M) limit exceeded! Unwind inventory!`, 'RISK-MGR');
        continue;
      }

      const wasStaleSnipe = q.evaluatedOnce && ((clientSide === 'BUY' && mid > q.offer * 1.005) || (clientSide === 'SELL' && mid < q.bid * 0.995));
      if (wasStaleSnipe) {
        this.metrics.staleSniped += 1;
        this.say('system', 'ib', `SNIPED: ${q.traderCode} picked off your stale ${q.ticker} quote @ ${execPrice} after market moved to $${mid.toFixed(2)}! Cancel old quotes on news!`, 'FLOW-DESK');
      }

      const commEarned = fillQty * execPrice * BALANCE.ibClientCommRate;
      this.applyFill(q.ticker, ourSigned, execPrice, commEarned, 'CLIENT', {
        client: q.traderCode,
        team: q.team,
        venue: q.team,
      });

      q.status = 'filled';
      q.fillSide = clientSide;
      q.fillQty = fillQty;
      q.fillPrice = execPrice;
      q.closedClock = fmtClock(this.totalSim);
      this.oldQuotes.unshift(q);

      if (req) {
        req.status = 'done';
        if (req.fromProactive) this.metrics.proactiveConversions += 1;
      }
      if (client) {
        client.trades += 1;
        client.volume += fillQty;
        if (req?.informed) client.informedTrades += 1;
      }

      this.say(
        'client',
        q.clientRoom,
        clientSide === 'BUY'
          ? `Done! Bought ${fillQty.toLocaleString('en-US')} ${q.ticker} @ ${execPrice} (Comm +$${Math.round(commEarned).toLocaleString('en-US')})`
          : `Done! Sold ${fillQty.toLocaleString('en-US')} ${q.ticker} @ ${execPrice} (Comm +$${Math.round(commEarned).toLocaleString('en-US')})`,
        q.traderCode
      );
    }

    this.liveQuotes = stillLive;
    if (this.oldQuotes.length > 45) this.oldQuotes.length = 45;

    // Expire unanswered client requests cleanly
    for (const r of this.clientRequests) {
      if (r.status === 'open' && this.totalSim >= r.expiresAt) {
        r.status = 'expired';
        this.say('client', r.clientRoom, `Moving on — went elsewhere on ${r.ticker}.`, r.traderCode);
      }
    }
  }

  // ------------------------------------------------ AM Role: Dealer Quotes
  requestQuote({ dealerRoom = 'ALL', ticker, qty }) {
    if (this.phase !== 'round') return { error: 'Round is not active' };
    if (this.role !== 'AM') return { error: 'Request Quote is for Asset Manager (AM) role' };

    const tk = String(ticker || '').toUpperCase().trim();
    const inst = this.inst[tk];
    if (!inst) return { error: `Unknown security "${tk}"` };

    qty = Math.round(Number(qty));
    if (!Number.isFinite(qty) || qty < 500 || qty > 250000) {
      this.metrics.fatFingers += 1;
      return { error: 'Fat Finger (FFC +1): Request volume must be between 500 and 250,000 shares' };
    }

    const targets = dealerRoom === 'ALL'
      ? this.dealers
      : this.dealers.filter((d) => d.roomId === dealerRoom);
    if (!targets.length) return { error: 'Select an IB dealer' };

    for (const d of targets) {
      this.say('me', d.roomId, `Could you make me a price for ${qty.toLocaleString('en-US')} ${tk} please?`, 'You');
      const delay = this.rng.range(d.speedSec[0], d.speedSec[1]);
      this.pendingDealerQuotes.push({
        dueAt: this.totalSim + delay,
        dealer: d,
        ticker: tk,
        qty,
      });
    }
    return { ok: true };
  }

  processDealerReplies() {
    if (this.role !== 'AM') return;
    const rem = [];
    for (const p of this.pendingDealerQuotes) {
      if (this.totalSim < p.dueAt) {
        rem.push(p);
        continue;
      }
      const inst = this.inst[p.ticker];
      const d = p.dealer;
      const isSpec = d.specialty.includes(p.ticker);
      const depthRatio = p.qty / inst.baseDepth;
      // IB dealers offer significantly tighter block spreads than the Exchange!
      let halfBps = d.baseHalfBps * (isSpec ? 0.72 : 1.0) + depthRatio * 14 + this.rng.range(-4, 6);
      halfBps = Math.max(20, Math.min(130, halfBps));
      const skew = this.rng.gauss() * 0.0008;
      const dec = inst.ref >= 100 ? r2 : r3;
      const bid = dec(inst.mid * (1 - halfBps / 10000 + skew));
      const offer = dec(inst.mid * (1 + halfBps / 10000 + skew));

      // Replace prior live quote from same IB on same ticker
      for (const q of this.liveQuotes) {
        if (q.status === 'live' && q.dealerRoom === d.roomId && q.ticker === p.ticker) {
          q.status = 'replaced';
          q.closedClock = fmtClock(this.totalSim);
          this.oldQuotes.unshift({ ...q });
        }
      }
      this.liveQuotes = this.liveQuotes.filter((q) => q.status === 'live');

      const quote = {
        id: uid('ibq'),
        role: 'AM',
        dealerRoom: d.roomId,
        team: d.team,
        traderCode: d.traderCode,
        ticker: p.ticker,
        bid,
        offer,
        bidVol: p.qty,
        offerVol: p.qty,
        validFor: 35,
        createdAt: this.totalSim,
        expiresAt: this.totalSim + 35,
        status: 'live',
      };
      this.liveQuotes.unshift(quote);
      this.say(
        'client',
        d.roomId,
        `Quote was created. ${p.ticker}, bid:${bid}, offer:${offer}, bidvol:${p.qty}, offervol:${p.qty}`,
        d.traderCode
      );
    }
    this.pendingDealerQuotes = rem;

    // Expire old dealer quotes
    const keep = [];
    for (const q of this.liveQuotes) {
      if (this.totalSim >= q.expiresAt) {
        q.status = 'expired';
        q.closedClock = fmtClock(this.totalSim);
        this.oldQuotes.unshift(q);
      } else {
        keep.push(q);
      }
    }
    this.liveQuotes = keep;
  }

  acceptDealerQuote({ quoteId, side, qty }) {
    if (this.phase !== 'round' || this.role !== 'AM') return { error: 'Not in active AM round' };
    const idx = this.liveQuotes.findIndex((q) => q.id === quoteId && q.status === 'live');
    if (idx === -1) return { error: 'Dealer quote expired or no longer available' };

    const q = this.liveQuotes[idx];
    const inst = this.inst[q.ticker];
    const maxVol = side === 'BUY' ? q.offerVol : q.bidVol;
    const fillQty = qty ? Math.min(Math.round(Number(qty)), maxVol) : maxVol;
    if (!Number.isFinite(fillQty) || fillQty <= 0) return { error: 'Invalid trade volume' };

    const signed = side === 'BUY' ? fillQty : -fillQty;
    const pos = this.positions[q.ticker];
    const newQty = pos.qty + signed;
    const reducing = Math.abs(newQty) < Math.abs(pos.qty);

    if (!reducing) {
      if (Math.abs(newQty * inst.mid) > BALANCE.amMaxSingleNotional) {
        return { error: `Mandate Limit: Max $8M (40%) per security (${q.ticker})` };
      }
      const nextGross = this.grossNotional() - Math.abs(pos.qty * inst.mid) + Math.abs(newQty * inst.mid);
      if (nextGross > BALANCE.amMaxGrossNotional) {
        return { error: 'Mandate Limit: Max $25M gross fund exposure reached' };
      }
    }

    const execPrice = side === 'BUY' ? q.offer : q.bid;
    const comm = fillQty * execPrice * BALANCE.amIbCommRate;

    this.applyFill(q.ticker, signed, execPrice, comm, 'IB_QUOTE', {
      client: q.traderCode,
      team: q.team,
      venue: q.team,
    });
    this.metrics.amIbBlocks += 1;

    q.status = 'filled';
    q.fillSide = side;
    q.fillQty = fillQty;
    q.fillPrice = execPrice;
    q.closedClock = fmtClock(this.totalSim);
    this.liveQuotes.splice(idx, 1);
    this.oldQuotes.unshift(q);

    const d = this.dealers.find((x) => x.roomId === q.dealerRoom);
    if (d) d.trades += 1;

    this.say(
      'me',
      q.dealerRoom,
      `${side === 'BUY' ? 'Mine (BUY)' : 'Yours (SELL)'} — ${fillQty.toLocaleString('en-US')} ${q.ticker} @ ${execPrice}`,
      'You'
    );
    this.say('client', q.dealerRoom, `Confirmed! Pleasure doing business on ${q.ticker}.`, q.traderCode);
    return { ok: true, price: execPrice, qty: fillQty };
  }

  // --------------------------------------------------- Chat & @quote Parser
  chat(room, rawText) {
    const text = String(rawText || '').slice(0, 260).trim();
    if (!text) return { ok: false };

    // Support AmplifyME @quote command directly in chat input:
    // e.g. "@quote BP 54 56 50000 50000" or "@quote BP 54 56 50000"
    if (text.toLowerCase().startsWith('@quote')) {
      const parts = text.split(/[\s,]+/).slice(1);
      if (parts.length >= 3) {
        const [tk, b, o, bv = '25000', ov = bv, ttl = '45'] = parts;
        const parseVol = (s) => (String(s).toLowerCase().endsWith('k') ? parseFloat(s) * 1000 : Number(s));
        return this.sendQuote({
          clientRoom: room,
          ticker: tk,
          bid: Number(b),
          offer: Number(o),
          bidVol: parseVol(bv),
          offerVol: parseVol(ov),
          validFor: Number(ttl) || 45,
        });
      }
      return { error: 'Syntax: @quote TICKER BID OFFER BIDVOL [OFFERVOL]' };
    }

    // Support @rfq TICKER QTY in AM role:
    if (text.toLowerCase().startsWith('@rfq')) {
      const parts = text.split(/[\s,]+/).slice(1);
      if (parts.length >= 2) {
        const parseVol = (s) => (String(s).toLowerCase().endsWith('k') ? parseFloat(s) * 1000 : Number(s));
        return this.requestQuote({
          dealerRoom: this.dealers.some((d) => d.roomId === room) ? room : 'ALL',
          ticker: parts[0],
          qty: parseVol(parts[1]),
        });
      }
      return { error: 'Syntax: @rfq TICKER VOLUME' };
    }

    this.say('me', room, text, 'You');

    // Proactive Sales Outreach in IB role!
    if (this.phase === 'round' && this.role === 'IB') {
      const client = this.clients.find((c) => c.roomId === room);
      if (client && this.totalSim - client.lastOutreachAt > 14) {
        client.lastOutreachAt = this.totalSim;
        this.metrics.proactiveSales += 1;
        const upper = text.toUpperCase();
        const mentionedTicker = Object.keys(this.inst).find((t) => upper.includes(t)) || null;
        const hasOpen = this.clientRequests.some((r) => r.clientRoom === room && r.status === 'open');
        if (!hasOpen && this.rng.chance(0.82)) {
          this.pendingClientReplies.push({
            dueAt: this.totalSim + this.rng.range(1.4, 3.0),
            client,
            ticker: mentionedTicker,
          });
        }
      }
    }

    // Natural AM chat RFQ parsing (e.g. "price in 50000 BP pls" in an IB dealer room)
    if (this.phase === 'round' && this.role === 'AM') {
      const dealer = this.dealers.find((d) => d.roomId === room);
      if (dealer) {
        const upper = text.toUpperCase();
        const tk = Object.keys(this.inst).find((t) => upper.includes(t));
        const mQty = text.match(/(\d+(?:\.\d+)?)\s*(k)?/i);
        if (tk && mQty) {
          const qv = mQty[2] ? Math.round( parseFloat(mQty[1]) * 1000 ) : Math.round(Number(mQty[1]));
          if (qv >= 500 && qv <= 250000) {
            this.pendingDealerQuotes.push({
              dueAt: this.totalSim + this.rng.range(1.2, 2.4),
              dealer,
              ticker: tk,
              qty: qv,
            });
          }
        }
      }
    }

    // Deal room banter reply
    if (room === 'deal' && this.rng.chance(0.55)) {
      this.pendingReplyAt = this.totalSim + this.rng.range(1.8, 4.0);
    }
    return { ok: true };
  }

  // Backward-compatible helpers for balance/playtest scripts
  activeRfq() {
    const r = this.clientRequests.find((x) => x.status === 'open');
    if (!r) return null;
    const alreadyQuoted = this.liveQuotes.some((q) => q.rfqId === r.id && q.status === 'live');
    return {
      ...r,
      status: alreadyQuoted ? 'quoted' : 'open',
      clientName: r.traderCode,
    };
  }

  quoteRfq(rfqId, bid, offer, bidVol, offerVol, ttl) {
    const req = this.clientRequests.find((r) => r.id === rfqId);
    if (!req) return { error: 'Request not found' };
    return this.sendQuote({
      clientRoom: req.clientRoom,
      ticker: req.ticker,
      bid,
      offer,
      bidVol,
      offerVol,
      validFor: ttl,
      rfqId,
    });
  }

  passRfq(rfqId) {
    const req = this.clientRequests.find((r) => r.id === rfqId && r.status === 'open');
    if (!req) return { error: 'Nothing to pass' };
    req.status = 'passed';
    this.metrics.passes += 1;
    return { ok: true };
  }

  // ------------------------------------------------------------------ Market
  updatePrices(dt) {
    for (const t of Object.keys(this.inst)) {
      const i = this.inst[t];
      const k = BALANCE.priceConvergence;
      i.logV += (i.logTarget - i.logV) * (1 - Math.exp(-k * dt));
      i.logV += i.vol * Math.sqrt(dt) * this.rng.gauss() * 0.85;
      const prev = i.mid;
      i.mid = Math.exp(i.logV);
      if (Math.abs(i.mid - prev) > 1e-6) {
        i.dir = i.mid >= prev ? 1 : -1;
      }
      i.last = i.mid;
      i.bid = i.mid * (1 - BALANCE.exchangeBaseHalfSpread);
      i.offer = i.mid * (1 + BALANCE.exchangeBaseHalfSpread);
      i.chg = i.mid - i.open;
      i.chgPct = (i.mid / i.open - 1) * 100;
    }
    this.hedgeCooldown = Math.max(0, this.hedgeCooldown - dt);

    // Track peak P&L & drawdown
    const cur = this.roundTotalPnl();
    if (cur > this.metrics.peakPnl) this.metrics.peakPnl = cur;
    const dd = this.metrics.peakPnl - cur;
    if (dd > this.metrics.maxDrawdown) this.metrics.maxDrawdown = dd;
  }

  updateCandles() {
    const bucket = Math.floor(this.simTime);
    for (const t of Object.keys(this.inst)) {
      const i = this.inst[t];
      const dec = i.ref >= 100 ? r2 : r3;
      const arr = this.candles[t];
      const last = arr[arr.length - 1];
      const px = dec(i.mid);
      if (!last || last[0] !== bucket) {
        const vol = Math.round(22000 + this.rng.next() * 55000);
        arr.push([bucket, px, px, px, px, vol]);
        if (arr.length > 720) arr.shift();
      } else {
        last[2] = Math.max(last[2], px);
        last[3] = Math.min(last[3], px);
        last[4] = px;
        last[5] += Math.round(this.rng.next() * 1400);
      }
    }
  }

  // ------------------------------------------------------------------- News
  scheduleRoundNews() {
    const rng = this.rng;
    const items = [];
    const nMacro = Math.max(2, Math.round(this.roundSeconds / 140));
    const nStock = Math.max(4, Math.round(this.roundSeconds / 55));

    const availStock = STOCK_NEWS.filter((_, idx) => !this.usedStockNews.has(idx));
    const poolS = availStock.length >= nStock ? [...availStock] : [...STOCK_NEWS];
    for (let k = 0; k < Math.min(nStock, poolS.length); k++) {
      const idx = Math.floor(rng.next() * poolS.length);
      const picked = poolS.splice(idx, 1)[0];
      const origIdx = STOCK_NEWS.indexOf(picked);
      if (origIdx >= 0) this.usedStockNews.add(origIdx);
      items.push({ kind: 'STOCK', ...picked, at: 0 });
    }

    const availMacro = MACRO_NEWS.filter((_, idx) => !this.usedMacroNews.has(idx));
    const poolM = availMacro.length >= nMacro ? [...availMacro] : [...MACRO_NEWS];
    for (let k = 0; k < Math.min(nMacro, poolM.length); k++) {
      const idx = Math.floor(rng.next() * poolM.length);
      const picked = poolM.splice(idx, 1)[0];
      const origIdx = MACRO_NEWS.indexOf(picked);
      if (origIdx >= 0) this.usedMacroNews.add(origIdx);
      items.push({ kind: 'MACRO', ...picked, at: 0 });
    }

    const slots = items.length;
    const first = 9;
    const lastAt = Math.max(30, this.roundSeconds - 28);
    items.forEach((it, idx) => {
      it.at = Math.round((first + ((lastAt - first) * idx) / Math.max(1, slots - 1) + rng.range(-4, 4)) * 10) / 10;
      it.at = Math.max(6, Math.min(this.roundSeconds - 16, it.at));
    });
    items.sort((a, b) => a.at - b.at);
    this.pendingNews = items.map((it, idx) => ({
      ...it,
      id: `n${this.round}-${idx}`,
      fired: false,
      round: this.round,
    }));
  }

  fireNews(n) {
    n.fired = true;
    if (n.kind === 'STOCK') {
      const i = this.inst[n.ticker];
      i.logTarget += n.move;
      this.news.unshift({
        id: n.id,
        at: this.round,
        simAt: this.totalSim,
        kind: 'STOCK',
        ticker: n.ticker,
        headline: n.headline,
        detail: n.detail,
        frHint: n.frHint,
        time: fmtClock(this.totalSim),
        impact: n.move,
      });
      this.say('system', 'ib', `BREAKING [${n.ticker}] — ${n.headline}`, 'NEWSWIRE');
      // Surge client RFQ interest right after stock news in IB mode!
      if (this.role === 'IB') {
        this.nextRfqAt = Math.min(this.nextRfqAt, this.totalSim + this.rng.range(1.5, 3.2));
      }
    } else {
      const moves = {};
      for (const t of Object.keys(this.inst)) {
        const i = this.inst[t];
        const boost = n.sectorBoost?.[i.sector] ?? 1.0;
        const m = n.tone * n.size * i.beta * boost;
        i.logTarget += m;
        moves[t] = m;
      }
      this.news.unshift({
        id: n.id,
        at: this.round,
        simAt: this.totalSim,
        kind: 'MACRO',
        ticker: 'MACRO',
        headline: n.headline,
        detail: n.detail,
        frHint: n.frHint,
        time: fmtClock(this.totalSim),
        impact: n.tone * n.size,
        moves,
      });
      this.say('system', 'ib', `MACRO FLASH — ${n.headline}`, 'NEWSWIRE');
      if (this.role === 'IB') {
        this.nextRfqAt = Math.min(this.nextRfqAt, this.totalSim + this.rng.range(1.8, 3.5));
      }
    }
    if (this.news.length > 28) this.news.pop();

    const hotTicker = n.kind === 'STOCK' ? n.ticker : this.rng.pick(Object.keys(this.inst));
    this.say('desk', 'deal', `Headline out on ${n.kind === 'STOCK' ? hotTicker : 'MACRO'}! Watch live quotes and ${hotTicker} depth.`);
  }

  // ------------------------------------------------------------------ Rounds
  beginRound() {
    if (this.round >= this.roundsTotal) return;
    this.round += 1;
    this.role = this.roleForRound(this.round);
    this.phase = 'round';
    this.simTime = 0;
    this.totalSim = 0;
    this.roundStartSim = 0;
    this.oneMinWarned = false;

    // Reset per-round book cleanly so IB and AM roles have crisp accounting
    this.realized = 0;
    this.ibCommissionEarned = 0;
    this.exchangeFeesPaid = 0;
    this.amCommPaid = 0;
    this.blotter = [];
    this.liveQuotes = [];
    this.oldQuotes = [];
    this.clientRequests = [];
    this.pendingDealerQuotes = [];
    this.pendingClientReplies = [];
    this.news = [];
    this.messages = [];

    this.initMetrics();
    this.initMarket(this.round === 1);
    this.scheduleRoundNews();

    this.nextRfqAt = this.rng.range(3.0, 5.5);
    this.nextChatterAt = this.rng.range(8, 15);

    const roleTitle = this.role === 'IB'
      ? 'Investment Bank Trader (IB 1 — Market Making & Sales)'
      : 'Asset Manager (AM 1 — $20,000,000 Equity Portfolio)';

    this.postNote(
      `Round ${this.round} of the simulation has started — Active Role: ${roleTitle}`,
      this.role === 'IB'
        ? 'Quote two-way prices to HF & AM clients in Chat, earn client commissions, pull stale quotes on news, and unwind inventory risk in clips on the Exchange.'
        : 'Deploy your $20,000,000 fund across equities in response to breaking MACRO and STOCK headlines. Request tight block quotes from IB 1–3 or execute urgent clips on the Exchange.'
    );
    this.say('system', 'ib', `ROUND ${this.round}/${this.roundsTotal} LIVE — Role: ${roleTitle}.`, 'AMPLIFY-HOST');

    if (this.role === 'IB') {
      // Initial friendly greeting from HF1-1 so user immediately sees where client flow happens
      this.say('client', 'hf1test1', 'Hi desk — let me know when you are ready to show prices.', 'HF1-1');
    } else {
      this.say('client', 'ib1test1', 'Morning! IB 1 desk open — send RFQs any time for tight block pricing.', 'IB1-1');
      this.say('client', 'ib2test1', 'IB 2 standing by for Banks & Energy block flow.', 'IB2-1');
    }
  }

  closeAllPositionsAtEnd() {
    for (const t of Object.keys(this.positions)) {
      const p = this.positions[t];
      if (p.qty === 0) continue;
      const i = this.inst[t];
      const side = p.qty > 0 ? 'SELL' : 'BUY';
      const qty = Math.abs(p.qty);
      const dq = this.depthQuote(t, qty);
      const execPrice = side === 'SELL' ? dq.sellPrice : dq.buyPrice;
      this.applyFill(t, side === 'SELL' ? -qty : qty, execPrice, dq.commission, 'EOD_CLOSE', {
        client: 'AUTO-CLOSE',
        venue: 'EOD',
      });
    }
  }

  endRound() {
    // Settle any remaining markouts & close open positions at end of round
    this.closeAllPositionsAtEnd();
    for (const q of this.liveQuotes) {
      q.status = 'expired';
      q.closedClock = fmtClock(this.totalSim);
      this.oldQuotes.unshift(q);
    }
    this.liveQuotes = [];
    for (const r of this.clientRequests) {
      if (r.status === 'open') r.status = 'expired';
    }

    this.postNote(`Round ${this.round} of the simulation has now ended`);
    this.phase = 'break';

    const roundPnl = Math.round(this.roundTotalPnl());
    const commDisplay = this.roundCommissionDisplay();
    const scoreObj = this.computeRoleScore();

    const record = {
      round: this.round,
      role: this.role,
      pnl: roundPnl,
      realized: Math.round(this.realized),
      commission: commDisplay,
      fills: this.metrics.rfqFills + this.metrics.amIbBlocks,
      exchangeTrades: this.metrics.exchangeTrades,
      quotes: this.metrics.quotesSent,
      capture: Math.round(this.metrics.spreadCapture),
      adverse: Math.round(this.metrics.adverse),
      fatFingers: this.metrics.fatFingers,
      staleSniped: this.metrics.staleSniped,
      proactiveConversions: this.metrics.proactiveConversions,
      scoreObj,
      total: Math.round(this.roundHistory.reduce((a, r) => a + r.pnl, 0) + roundPnl),
    };
    this.roundHistory.push(record);
    this.roundStats = record;

    const revealClients = this.role === 'IB'
      ? this.clients.map((c) => ({
          name: c.traderCode,
          team: c.team,
          label: c.label,
          trades: c.trades,
          informedTrades: c.informedTrades,
          note: c.note,
        }))
      : this.dealers.map((d) => ({
          name: d.traderCode,
          team: d.team,
          label: `Specialty: ${d.specialty.join(', ')}`,
          trades: d.trades,
          informedTrades: 0,
          note: d.note,
        }));

    const nextRole = this.round < this.roundsTotal ? this.roleForRound(this.round + 1) : null;

    this.debrief = {
      open: true,
      round: this.round,
      role: this.role,
      nextRole,
      stats: record,
      scoreObj,
      clients: revealClients,
      tips: this.buildTips(),
    };

    if (this.round >= this.roundsTotal) {
      this.finish();
    }
  }

  finish() {
    this.phase = 'done';
    const lb = this.leaderboard();
    const totalPnl = this.roundHistory.reduce((a, r) => a + r.pnl, 0);
    const totalComm = this.roundHistory.reduce((a, r) => a + r.commission, 0);
    const totalFfc = this.roundHistory.reduce((a, r) => a + r.fatFingers, 0);
    const totalTrades = this.roundHistory.reduce((a, r) => a + r.fills + r.exchangeTrades, 0);
    const totalQuotes = this.roundHistory.reduce((a, r) => a + r.quotes, 0);

    this.final = {
      pnl: Math.round(totalPnl),
      commission: Math.round(totalComm),
      fatFingers: totalFfc,
      score: lb.myScore,
      rank: lb.rank,
      total: lb.total,
      topPct: lb.topPct,
      trades: totalTrades,
      quotes: totalQuotes,
      rounds: this.roundHistory,
      tips: this.buildTips(),
    };
  }

  buildTips() {
    const m = this.metrics;
    const tips = [];
    if (m.fatFingers > 0) {
      tips.push({
        tone: 'bad',
        text: `Fat Finger Count = ${m.fatFingers}. Sur AmplifyME, chaque erreur de saisie (bid >= offer, zéro en trop, volume hors limite) pénalise directement votre score de qualification Top 10 %.`,
      });
    }
    if (this.role === 'IB') {
      if (m.staleSniped > 0) {
        tips.push({
          tone: 'bad',
          text: `${m.staleSniped} quote(s) laissée(s) active(s) dans LIVE CHAT QUOTES ont été « snipées » après une news. Annulez (✕) toujours vos quotes ouvertes dès qu'un titre bouge !`,
        });
      }
      if (m.rfqFills < 5) {
        tips.push({
          tone: 'warn',
          text: `Seulement ${m.rfqFills} trades clients exécutés : relancez les clients dans le Chat (« seen the news in BP? need a price? ») et cotez un spread plus compétitif que l'Exchange (~0,5 % à 0,9 %) pour engranger les commissions IB !`,
        });
      }
      if (m.oversizedExchangeDumps > 0) {
        tips.push({
          tone: 'warn',
          text: `Vous avez débouclé ${m.oversizedExchangeDumps} gros bloc(s) d'un seul coup sur l'Exchange : la profondeur de marché élargit le spread ! Débouclez par tranches de 10k–15k titres.`,
        });
      }
      if (m.proactiveConversions > 0) {
        tips.push({
          tone: 'good',
          text: `Excellent Sales Trading : ${m.proactiveConversions} trade(s) généré(s) grâce à vos messages proactifs aux clients dans le Chat.`,
        });
      }
    } else {
      const roi = (this.roundTotalPnl() / BALANCE.amFundCapital) * 100;
      if (m.maxDiversifiedCount < 3) {
        tips.push({
          tone: 'warn',
          text: `Portefeuille trop concentré (${m.maxDiversifiedCount} ligne(s) significative(s)). Sur le mandat 20 M$ AmplifyME, répartissez le risque sur 3 à 5 actions (long sur les catalyseurs positifs, short sur les négatifs).`,
        });
      }
      if (m.amExchangeBlocks > m.amIbBlocks && m.amExchangeBlocks >= 2) {
        tips.push({
          tone: 'info',
          text: `Pour les blocs > 2 M$, demandez un prix aux banques (IB 1 / IB 2 / IB 3) plutôt que de taper l'Exchange : vous économisez plus de 50 % de spread d'impact !`,
        });
      }
      if (roi >= 3.5) {
        tips.push({
          tone: 'good',
          text: `Performance solide (+${roi.toFixed(2)} % sur le fonds de 20 M$) : excellente réactivité aux annonces MACRO et micro.`,
        });
      }
    }

    if (!tips.length) {
      tips.push({
        tone: 'good',
        text: 'Exécution propre : 0 Fat Finger, bon contrôle du risque et lecture cohérente du flux d’actualités.',
      });
    }
    return tips.slice(0, 4);
  }

  liveTips() {
    const tips = [];
    const m = this.metrics;
    if (m.fatFingers > 0) {
      tips.push({ tone: 'bad', text: `Attention : ${m.fatFingers} Fat Finger enregistré(s). Vérifiez toujours le RefPrice avant SEND QUOTE.` });
    }
    if (this.role === 'IB') {
      const stale = this.liveQuotes.filter((q) => {
        const mid = this.inst[q.ticker]?.mid ?? 0;
        return mid > q.offer * 0.998 || mid < q.bid * 1.002;
      });
      if (stale.length) {
        tips.push({ tone: 'bad', text: `URGENT : votre quote live sur ${stale[0].ticker} est proche/franchie par le marché ! Annulez-la (✕) dans LIVE CHAT QUOTES.` });
      }
      const bigPos = Object.keys(this.positions).find((t) => Math.abs(this.positions[t].qty * this.inst[t].mid) > 4500000);
      if (bigPos) {
        tips.push({ tone: 'warn', text: `Inventaire élevé sur ${bigPos} : débouclez par clips de 10k sur EXCHANGE ou biaisez (skew) votre prochaine quote.` });
      }
    } else {
      if (this.grossNotional() < 4000000 && this.simTime > 35) {
        tips.push({ tone: 'info', text: `Seulement ${(this.grossNotional() / 1e6).toFixed(1)} M$ déployés sur vos 20 M$ : exploitez les news en Long/Short via IB Quotes !` });
      }
    }
    if (this.assistMode && this.news[0]?.frHint && this.news[0].kind !== 'NOTE') {
      tips.push({ tone: 'info', text: `Lecture News [${this.news[0].ticker}] : ${this.news[0].frHint}` });
    }
    return tips.slice(0, 3);
  }

  // --------------------------------------------------------------- Main Tick
  step(dt) {
    if (this.phase !== 'round' && this.phase !== 'break') return;

    if (this.phase === 'round') {
      this.simTime += dt;
      this.totalSim += dt;

      // 1-minute left official AmplifyME NOTE
      const left = this.roundSeconds - this.simTime;
      if (!this.oneMinWarned && left <= 60 && this.roundSeconds >= 90) {
        this.oneMinWarned = true;
        this.postNote(`There is one minute left until the end of Round ${this.round} of the simulation`);
        this.say('system', 'ib', `1 MINUTE REMAINING in Round ${this.round} — manage open risk before close!`, 'AMPLIFY-HOST');
      }

      // Fire scheduled news
      for (const n of this.pendingNews) {
        if (!n.fired && this.simTime >= n.at) this.fireNews(n);
      }

      // Proactive sales replies in IB mode
      const keepReplies = [];
      for (const pr of this.pendingClientReplies) {
        if (this.totalSim >= pr.dueAt) {
          this.spawnClientRfq(pr.client, pr.ticker, true);
        } else {
          keepReplies.push(pr);
        }
      }
      this.pendingClientReplies = keepReplies;

      // Regular inbound client RFQs in IB mode
      if (this.role === 'IB' && this.totalSim >= this.nextRfqAt) {
        this.spawnClientRfq();
        this.nextRfqAt = this.totalSim + this.rng.range(BALANCE.rfqIntervalMin, BALANCE.rfqIntervalMax);
      }

      this.updatePrices(dt);
      this.updateCandles();

      if (this.role === 'IB') {
        this.evaluateIbQuotes();
      } else {
        this.processDealerReplies();
      }

      this.processMarkouts();

      // Deal room chatter
      if (this.totalSim >= this.nextChatterAt) {
        this.nextChatterAt = this.totalSim + this.rng.range(BALANCE.chatterMin, BALANCE.chatterMax);
        const tk = this.rng.pick(Object.keys(this.inst));
        this.say('desk', 'deal', this.rng.pick(DEAL_ROOM_LINES).replace('{t}', tk));
      }
      if (this.pendingReplyAt && this.totalSim >= this.pendingReplyAt) {
        this.pendingReplyAt = null;
        this.say('desk', 'deal', 'Copy that — watching the tape closely here.');
      }

      const gn = this.grossNotional();
      if (gn > this.metrics.maxAbsNotional) this.metrics.maxAbsNotional = gn;

      if (this.simTime >= this.roundSeconds) {
        this.simTime = this.roundSeconds;
        this.endRound();
      }
    } else if (this.phase === 'break') {
      this.breakTime += dt;
    }
  }

  setChartTicker(t) {
    if (this.inst[t]) this.chartTicker = t;
  }

  toggleWatchTicker(t) {
    if (!this.inst[t]) return;
    if (this.watchedTickers.includes(t)) {
      this.watchedTickers = this.watchedTickers.filter((x) => x !== t);
    } else {
      this.watchedTickers = [...this.watchedTickers, t];
    }
  }

  // ---------------------------------------------------------------- Snapshot
  snapshot() {
    const lb = this.leaderboard();
    const unr = this.unrealised();
    const comm = this.roundCommissionDisplay();
    const roundTotal = this.roundTotalPnl();
    const roleScore = this.computeRoleScore();
    const maxSingle = this.role === 'IB' ? BALANCE.ibMaxSingleNotional : BALANCE.amMaxSingleNotional;
    const maxGross = this.role === 'IB' ? BALANCE.ibMaxGrossNotional : BALANCE.amMaxGrossNotional;

    // Build AmplifyME-exact POSITIONS rows (includes any security traded this round even if NET POS == 0!)
    const positionRows = Object.keys(this.positions)
      .filter((t) => this.positions[t].qty !== 0 || this.positions[t].traded)
      .map((t) => {
        const p = this.positions[t];
        const mid = this.inst[t].mid;
        const dec = this.inst[t].ref >= 100 ? r2 : r3;
        const posVal = Math.round(Math.abs(p.qty) * mid);
        const unrealPnl = p.qty !== 0 ? Math.round(p.qty * (mid - p.avg)) : 0;
        const realPnl = Math.round(p.realisedPnl);
        const netPnl = realPnl + unrealPnl;
        return {
          ticker: t,
          qty: p.qty,
          avg: p.qty !== 0 ? dec(p.avg) : 0,
          mark: dec(mid),
          notional: posVal,
          unreal: unrealPnl,
          realised: realPnl,
          netPnl,
          pctOfLimit: Math.min(100, (posVal / maxSingle) * 100),
        };
      });

    // Chat rooms list tailored to current Role
    const contactRooms = this.role === 'IB'
      ? this.clients.map((c) => {
          const openReq = this.clientRequests.find((r) => r.clientRoom === c.roomId && r.status === 'open');
          return {
            id: c.roomId,
            name: c.roomId,
            team: c.team,
            headerTitle: `${c.traderCode} - ${c.phone}`,
            subTitle: 'SINGLE',
            hasOpenRfq: Boolean(openReq),
            openRfq: openReq ? { id: openReq.id, ticker: openReq.ticker, qty: openReq.qty } : null,
          };
        })
      : this.dealers.map((d) => ({
          id: d.roomId,
          name: d.roomId,
          team: d.team,
          headerTitle: `${d.traderCode} - ${d.phone}`,
          subTitle: `INSTITUTIONAL · ${d.specialty.join('/')}`,
          hasOpenRfq: this.liveQuotes.some((q) => q.dealerRoom === d.roomId && q.status === 'live'),
          openRfq: null,
        }));

    const chatRooms = [
      { id: 'deal', name: 'Deal Room', team: '', headerTitle: 'DEAL ROOM — GLOBAL FLOOR', subTitle: 'MULTI-DESK', hasOpenRfq: false },
      { id: 'ib', name: 'IB Room', team: '', headerTitle: 'DESK WIRE & RISK ALERTS', subTitle: 'INTERNAL', hasOpenRfq: false },
      ...contactRooms,
    ];

    const activeReq = this.clientRequests.find((r) => r.status === 'open') || null;

    return {
      sessionId: this.id,
      nickname: this.nickname,
      mode: this.mode,
      startRole: this.startRole,
      assistMode: this.assistMode,
      phase: this.phase,
      role: this.role, // 'IB' | 'AM'
      roleBadge: this.role === 'IB' ? 'IB 1' : 'AM 1',
      round: this.round,
      roundsTotal: this.roundsTotal,
      roundSeconds: this.roundSeconds,
      totalSim: Math.round(this.totalSim * 10) / 10,
      simTime: Math.round(this.simTime * 10) / 10,
      timeLeft: Math.max(0, Math.round((this.roundSeconds - this.simTime) * 10) / 10),
      progress: this.phase === 'round' ? Math.min(1, this.simTime / this.roundSeconds) : this.phase === 'briefing' ? 0 : 1,
      speed: this.speed,
      paused: this.paused,
      clock: fmtClock(this.totalSim),
      pnl: {
        realized: Math.round(this.realized),
        unrealised: Math.round(unr),
        fees: comm, // In IB: positive net commission earned! In AM: fees paid.
        commission: comm,
        total: Math.round(roundTotal),
        sessionTotal: Math.round(this.totalPnl()),
        roiPct: this.role === 'AM' ? r2((roundTotal / BALANCE.amFundCapital) * 100) : null,
        fundCapital: BALANCE.amFundCapital,
        portfolioValue: Math.round(BALANCE.amFundCapital + roundTotal),
        cashAvailable: Math.round(BALANCE.amFundCapital + this.realized - this.amCommPaid - this.grossNotional()),
      },
      positions: positionRows,
      grossNotional: Math.round(this.grossNotional()),
      netNotional: Math.round(this.netNotional()),
      watchedTickers: this.watchedTickers,
      equities: Object.keys(this.inst).map((t) => {
        const e = this.inst[t];
        const dec = e.ref >= 100 ? r2 : r3;
        const dq10k = this.depthQuote(t, 10000);
        return {
          ticker: t,
          name: e.name,
          sector: e.sector,
          type: e.type,
          ref: dec(e.open),
          last: dec(e.mid),
          bid: dq10k.sellPrice,
          offer: dq10k.buyPrice,
          baseDepth: e.baseDepth,
          exchangeBaseHalfSpread: BALANCE.exchangeBaseHalfSpread,
          exchangeDepthSlope: BALANCE.exchangeDepthSlope,
          feeRate: this.role === 'IB' ? BALANCE.ibExchangeFeeRate : BALANCE.amExchangeFeeRate,
          chg: dec(e.mid - e.open),
          chgPct: (e.mid / e.open - 1) * 100,
          dir: e.dir,
        };
      }),
      chart: {
        ticker: this.chartTicker,
        candles: this.candles[this.chartTicker] || [],
        ref: this.inst[this.chartTicker]?.open ?? 0,
        markers: this.blotter
          .filter((b) => b.ticker === this.chartTicker && b.source !== 'EOD_CLOSE')
          .slice(0, 20)
          .map((b) => ({ t: b.at, price: b.price, side: b.side, source: b.source })),
      },
      news: this.news.slice(0, 22),
      chatRooms,
      messages: this.messages.slice(-90),
      liveQuotes: this.liveQuotes.map((q) => ({
        id: q.id,
        role: q.role,
        room: q.clientRoom || q.dealerRoom,
        team: q.team,
        traderCode: q.traderCode,
        ticker: q.ticker,
        bid: q.bid,
        offer: q.offer,
        bidVol: q.bidVol,
        offerVol: q.offerVol,
        validFor: Math.max(0, Math.ceil(q.expiresAt - this.totalSim)),
      })),
      oldQuotes: this.oldQuotes.slice(0, 25).map((q) => ({
        id: q.id,
        team: q.team,
        traderCode: q.traderCode,
        ticker: q.ticker,
        bid: q.bid,
        offer: q.offer,
        bidVol: q.bidVol,
        offerVol: q.offerVol,
        status: q.status,
        fillSide: q.fillSide || null,
        fillPrice: q.fillPrice || null,
        closedClock: q.closedClock || '',
      })),
      rfq: activeReq
        ? {
            id: activeReq.id,
            clientRoom: activeReq.clientRoom,
            team: activeReq.team,
            clientName: activeReq.traderCode,
            ticker: activeReq.ticker,
            qty: activeReq.qty,
            ttlLeft: Math.max(0, Math.ceil(activeReq.expiresAt - this.totalSim)),
          }
        : null,
      clientRequests: this.clientRequests
        .filter((r) => r.status === 'open')
        .map((r) => ({
          id: r.id,
          clientRoom: r.clientRoom,
          team: r.team,
          traderCode: r.traderCode,
          ticker: r.ticker,
          qty: r.qty,
          ttlLeft: Math.max(0, Math.ceil(r.expiresAt - this.totalSim)),
        })),
      blotter: this.blotter.slice(0, 35),
      leaderboard: lb,
      roleScore,
      roundHistory: this.roundHistory,
      coach: {
        quotesSent: this.metrics.quotesSent,
        quotesCancelled: this.metrics.quotesCancelled,
        fills: this.metrics.rfqFills + this.metrics.amIbBlocks,
        exchangeTrades: this.metrics.exchangeTrades,
        hitRate: this.metrics.quotesSent ? this.metrics.rfqFills / this.metrics.quotesSent : 0,
        capture: Math.round(this.metrics.spreadCapture),
        adverse: Math.round(this.metrics.adverse),
        staleSniped: this.metrics.staleSniped,
        fatFingers: this.metrics.fatFingers,
        proactiveSales: this.metrics.proactiveSales,
        proactiveConversions: this.metrics.proactiveConversions,
        fees: comm,
        netEdge: Math.round(this.metrics.spreadCapture + this.metrics.adverse),
        maxRisk: Math.round(this.metrics.maxAbsNotional),
        tips: this.phase === 'round' ? this.liveTips() : [],
      },
      clients: (this.role === 'IB' ? this.clients : this.dealers).map((c) => ({
        id: c.id,
        name: c.traderCode,
        team: c.team,
        label: c.label || `Dealer (${c.specialty?.join(', ')})`,
        trades: c.trades,
        note: c.note,
      })),
      roundStats: this.roundStats,
      debrief: this.debrief,
      final: this.final,
      risk: {
        gross: Math.round(this.grossNotional()),
        net: Math.round(this.netNotional()),
        limit: maxGross,
        perTickerLimit: maxSingle,
        perTicker: positionRows
          .filter((p) => p.qty !== 0)
          .map((p) => ({ ticker: p.ticker, notional: p.notional, pct: p.pctOfLimit })),
      },
    };
  }
}
