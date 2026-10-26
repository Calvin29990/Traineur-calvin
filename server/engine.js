// ---------------------------------------------------------------------------
// Moteur de simulation : marché, flux clients, exécution, P&L, classement.
// Serveur autoritaire — le client ne fait qu'envoyer des intentions.
// ---------------------------------------------------------------------------

import {
  INSTRUMENTS, STOCK_NEWS, MACRO_NEWS, CLIENT_ARCHETYPES,
  DEAL_ROOM_LINES, DESK_TRADERS, BOT_NAMES, BOT_FIRMS, BOT_CHAT_LINES,
} from './content.js';

// ------------------------------- Paramétrage -------------------------------
export const BALANCE = {
  roundSeconds: 180,
  rounds: 3,
  marketSecondsPerSimSecond: 15,   // 1 s simulée = 15 s de marché (horloge)
  priceConvergence: 0.085,          // vitesse de retour vers la valeur "juste" (tau ~ 12 s)
  legacySpreadBps: 12,              // spread par défaut proposé au joueur
  exchangeHalfSpread: 0.0006,       // 6 bps de chaque côté (spread + impact)
  exchangeFee: 0.0005,              // 5 bps de commission par côté
  impactPer100k: 0.000015,          // impact de marché
  maxOrderShares: 150000,
  maxPosNotionalPerTicker: 6000000,
  maxGrossNotional: 15000000,
  rfqIntervalMin: 7,
  rfqIntervalMax: 12,
  rfqExpiry: 30,
  decisionDelayMin: 2.0,
  decisionDelayMax: 6.0,
  informedMaxEdge: 0.0042,
  noiseEdgeSigma: 0.0034,
  minClipNotional: 1500000,
  maxClipNotional: 6000000,
  clientHurdle: 0.0002,
  adverseHorizon: 10,
  chatterMin: 12,
  chatterMax: 26,
};

const r2 = (n) => Math.round(n * 100) / 100;

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

function fmtClock(totalSimSeconds) {
  const start = 13 * 3600 + 2 * 60; // 13:02:00
  const t = start + totalSimSeconds * BALANCE.marketSecondsPerSimSecond;
  const h = Math.floor(t / 3600) % 24;
  const m = Math.floor((t % 3600) / 60);
  const s = Math.floor(t % 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

let msgSeq = 0;
const nextMsgId = () => `m${++msgSeq}`;

export class Session {
  constructor({ id, seed, rounds, roundSeconds, nickname }) {
    this.id = id;
    this.seed = seed ?? Math.floor(Math.random() * 1e9);
    this.rng = makeRng(this.seed);
    this.roundsTotal = rounds ?? BALANCE.rounds;
    this.roundSeconds = roundSeconds ?? BALANCE.roundSeconds;
    this.nickname = nickname || 'Vous';

    this.phase = 'briefing';      // briefing | round | break | done
    this.round = 0;
    this.speed = 1;
    this.paused = false;
    this.simTime = 0;             // temps dans le round courant
    this.totalSim = 0;            // temps cumulé (horloge marché)
    this.roundStartSim = 0;
    this.breakTime = 0;

    this.cash = 0;
    this.fees = 0;
    this.realized = 0;

    this.positions = {};
    this.candles = {};
    this.news = [];
    this.messages = [];
    this.blotter = [];
    this.rfqs = [];
    this.flow = {};
    this.clientStats = {};
    this.hedgeCooldown = 0;

    this.metrics = {
      quotesSent: 0, fills: 0, rfqFills: 0, exchangeTrades: 0,
      spreadCapture: 0, adverse: 0, markoutsPending: [],
      inventorySeconds: 0, maxAbsNotional: 0, passes: 0, rejects: 0,
      volumeQuoted: 0, volumeTraded: 0, skewUsed: 0,
    };

    this.roundStats = null;
    this.debrief = null;
    this.final = null;
    this.chartTicker = 'BP';

    // instruments
    this.inst = {};
    for (const i of INSTRUMENTS) {
      this.inst[i.ticker] = {
        ...i,
        logV: Math.log(i.ref),
        logTarget: Math.log(i.ref),
        mid: i.ref,
        prevClose: i.ref,
        open: i.ref,
        bid: i.ref * (1 - BALANCE.exchangeHalfSpread),
        offer: i.ref * (1 + BALANCE.exchangeHalfSpread),
        last: i.ref,
        dir: 0,
        hist: [],
      };
      this.positions[i.ticker] = { qty: 0, avg: 0 };
      this.candles[i.ticker] = [];
    }

    // clients
    this.clients = [];
    const perArch = {};
    for (let k = 0; k < 9; k++) {
      const arch = CLIENT_ARCHETYPES[k % CLIENT_ARCHETYPES.length];
      perArch[arch.id] = (perArch[arch.id] || 0) + 1;
      const id = `c${k}`;
      this.clients.push({
        id, name: `${arch.id}-${perArch[arch.id]}`, arch,
        informedness: arch.informedness * this.rng.range(0.8, 1.15),
        sizePref: arch.sizePref,
        aggression: arch.aggression,
        trades: 0, hitUs: 0, ourCapture: 0,
      });
      this.clientStats[id] = { trades: 0, informedTrades: 0, capture: 0 };
    }

    // classement bots
    this.botPool = this.buildBotPool();

    this.pendingNews = [];
    this.pendingRfq = null;
    this.nextRfqAt = 0;
    this.nextChatterAt = this.rng.range(4, 9);

    this.say('system', 'ib', `Session initialisée — ${this.roundsTotal} rounds de ${this.roundSeconds}s.`);
  }

  // ------------------------------------------------------------------ utils
  log(ticker, price) {
    return Math.log(price / this.inst[ticker].ref);
  }

  say(kind, room, text, from) {
    this.messages.push({
      id: nextMsgId(), at: this.totalSim, room, kind,
      from: from || (kind === 'desk' ? this.rng.pick(DESK_TRADERS) : kind === 'client' ? 'CLIENT' : 'DESK'),
      text,
    });
    if (this.messages.length > 90) this.messages.shift();
  }

  buildBotPool() {
    const pool = [];
    const n = 260;
    for (let i = 0; i < n; i++) {
      // skill ~ distribution étalée autour de 0.45
      let sk = 0.45 + this.rng.gauss() * 0.17;
      sk = Math.max(0.03, Math.min(0.97, sk));
      pool.push({
        id: `b${i}`,
        name: BOT_NAMES[i % BOT_NAMES.length] + (i >= BOT_NAMES.length ? ` ${String.fromCharCode(65 + Math.floor(i / BOT_NAMES.length))}` : ''),
        firm: BOT_FIRMS[Math.floor(this.rng.next() * BOT_FIRMS.length)],
        skill: sk,
        rounds: [],
      });
    }
    // P&L par round, tiré une fois pour toute la session
    for (const b of pool) {
      for (let r = 0; r < this.roundsTotal; r++) {
        const base = (b.skill - 0.46) * 58000;
        const noise = this.rng.gauss() * 9000;
        b.rounds.push(Math.round(base + noise));
      }
    }
    return pool;
  }

  botTotal(b, progress) {
    let t = 0;
    for (let r = 0; r < this.roundsTotal; r++) {
      if (r < this.round - 1) t += b.rounds[r];
      else if (r === this.round - 1 || this.phase === 'briefing') t += b.rounds[r] * progress;
    }
    return t;
  }

  leaderboard() {
    const progress = this.phase === 'round'
      ? Math.max(0, Math.min(1, this.simTime / this.roundSeconds))
      : this.phase === 'break' ? 1 : this.phase === 'done' ? 1 : 0;
    const myTotal = this.totalPnl();
    const rows = this.botPool.map((b) => ({ name: b.name, firm: b.firm, pnl: Math.round(this.botTotal(b, progress)), me: false }));
    rows.push({ name: this.nickname, firm: 'Votre desk', pnl: Math.round(myTotal), me: true });
    rows.sort((a, b) => b.pnl - a.pnl);
    rows.forEach((r, i) => { r.rank = i + 1; });
    const idx = rows.findIndex((r) => r.me);
    const total = rows.length;
    const rank = idx + 1;
    const percentile = Math.max(0.1, Math.min(99.9, (1 - idx / (total - 1)) * 100));
    return {
      rows: rows.slice(0, 12), rank, total,
      topPct: percentile,
      around: rows.slice(Math.max(0, idx - 3), idx + 4),
      myPnl: Math.round(myTotal),
      firstThreshold: rows[Math.max(0, Math.floor(total * 0.1) - 1)]?.pnl ?? 0,
    };
  }

  // ------------------------------------------------------------------- P&L
  totalPnl() {
    let v = this.cash;
    for (const t of Object.keys(this.positions)) v += this.positions[t].qty * this.inst[t].mid;
    return v;
  }

  unrealised() {
    let v = 0;
    for (const t of Object.keys(this.positions)) {
      const p = this.positions[t];
      if (p.qty !== 0) v += p.qty * (this.inst[t].mid - p.avg);
    }
    return v;
  }

  grossNotional() {
    let v = 0;
    for (const t of Object.keys(this.positions)) v += Math.abs(this.positions[t].qty * this.inst[t].mid);
    return v;
  }

  positionNotional(ticker) {
    return Math.abs(this.positions[ticker].qty * this.inst[ticker].mid);
  }

  // ------------------------------------------------------------- exécution
  applyFill(ticker, signedQty, price, fee, source, meta = {}) {
    const pos = this.positions[ticker];
    const side = signedQty > 0 ? 'BUY' : 'SELL';
    const qty = Math.abs(signedQty);

    // réalisé sur la partie qui solde
    if (pos.qty !== 0 && Math.sign(pos.qty) !== Math.sign(signedQty)) {
      const closed = Math.min(qty, Math.abs(pos.qty));
      this.realized += (price - pos.avg) * closed * Math.sign(pos.qty);
      if (Math.abs(signedQty) > Math.abs(pos.qty)) pos.avg = price;
    } else {
      pos.avg = (pos.avg * Math.abs(pos.qty) + price * qty) / (Math.abs(pos.qty) + qty);
    }
    pos.qty += signedQty;
    if (pos.qty === 0) pos.avg = 0;

    this.cash -= signedQty * price + fee;
    this.fees += fee;

    const mid = this.inst[ticker].mid;
    const capture = (mid - price) * signedQty; // >0 si on exécute mieux que le mid
    this.metrics.volumeTraded += qty;

    const trade = {
      id: `t${this.blotter.length + 1}`,
      at: Math.round(this.totalSim * 10) / 10,
      clock: fmtClock(this.totalSim),
      ticker, side, qty, price: r2(price), fee: r2(fee),
      source, capture: Math.round(capture), ...meta,
      posAfter: pos.qty,
      pnlAfter: Math.round(this.totalPnl()),
    };
    this.blotter.unshift(trade);
    if (this.blotter.length > 60) this.blotter.pop();

    // markout pour mesurer la sélection adverse
    if (source === 'RFQ') {
      this.metrics.markoutsPending.push({ dueAt: this.totalSim + BALANCE.adverseHorizon, price, signedQty, ticker, tradeId: trade.id });
      this.metrics.spreadCapture += capture;
      this.metrics.rfqFills += 1;
      (this.flow[ticker] || (this.flow[ticker] = [])).push({ at: this.totalSim, signed: signedQty, notional: qty * price });
    }
    this.metrics.fills += 1;
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
      } else keep.push(m);
    }
    this.metrics.markoutsPending = keep;
  }

  tradeExchange(ticker, side, qty) {
    const inst = this.inst[ticker];
    if (!inst) return { error: 'Titre inconnu' };
    qty = Math.round(Number(qty));
    if (!Number.isFinite(qty) || qty <= 0) return { error: 'Volume invalide' };
    if (qty > BALANCE.maxOrderShares) return { error: `Taille maximale ${BALANCE.maxOrderShares.toLocaleString('fr-FR')} titres par ordre` };
    const pos = this.positions[ticker];
    const signed = side === 'BUY' ? qty : -qty;
    const newQty = pos.qty + signed;
    if (Math.abs(newQty * inst.mid) > BALANCE.maxPosNotionalPerTicker) {
      return { error: `Limite de position atteinte sur ${ticker} (${(BALANCE.maxPosNotionalPerTicker / 1e6).toFixed(0)} M$ de notionnel)` };
    }
    if (this.grossNotional() + qty * inst.mid > BALANCE.maxGrossNotional) return { error: 'Limite de risque globale atteinte' };

    const price = side === 'BUY' ? inst.offer : inst.bid;
    const fee = price * qty * BALANCE.exchangeFee;
    const impact = BALANCE.impactPer100k * (qty / 100000) * (side === 'BUY' ? 1 : -1);
    this.applyFill(ticker, signed, price, fee, 'EXCHANGE');
    inst.logV += impact;
    inst.logTarget += impact * 0.55;
    this.metrics.exchangeTrades += 1;
    return { ok: true };
  }

  hedge(ticker) {
    const pos = this.positions[ticker];
    if (!pos || pos.qty === 0) return { error: 'Aucune position à couvrir' };
    if (this.hedgeCooldown > 0) return { ok: true };
    const qty = Math.min(Math.abs(pos.qty), BALANCE.maxOrderShares);
    this.hedgeCooldown = 0.35;
    return this.tradeExchange(ticker, pos.qty > 0 ? 'SELL' : 'BUY', qty);
  }

  // ------------------------------------------------------------------ marché
  updatePrices(dt) {
    for (const t of Object.keys(this.inst)) {
      const i = this.inst[t];
      const k = BALANCE.priceConvergence;
      i.logV += (i.logTarget - i.logV) * (1 - Math.exp(-k * dt));
      i.logV += i.vol * Math.sqrt(dt) * this.rng.gauss() * 0.85;
      const prev = i.mid;
      i.mid = Math.exp(i.logV);
      i.dir = Math.sign(i.mid - prev);
      i.last = i.mid;
      i.bid = i.mid * (1 - BALANCE.exchangeHalfSpread);
      i.offer = i.mid * (1 + BALANCE.exchangeHalfSpread);
      i.chg = i.mid - i.prevClose;
      i.chgPct = (i.mid / i.prevClose - 1) * 100;
    }
    this.hedgeCooldown = Math.max(0, this.hedgeCooldown - dt);
  }

  updateCandles() {
    const bucket = Math.floor(this.totalSim);
    for (const t of Object.keys(this.inst)) {
      const i = this.inst[t];
      const arr = this.candles[t];
      const last = arr[arr.length - 1];
      if (!last || last[0] !== bucket) {
        const vol = Math.round(20000 + this.rng.next() * 60000);
        arr.push([bucket, r2(i.mid), r2(i.mid), r2(i.mid), r2(i.mid), vol]);
        if (arr.length > 620) arr.shift();
      } else {
        last[2] = Math.max(last[2], r2(i.mid));
        last[3] = Math.min(last[3], r2(i.mid));
        last[4] = r2(i.mid);
        last[5] += Math.round(this.rng.next() * 900);
      }
    }
  }

  // ------------------------------------------------------------------- news
  scheduleRound() {
    const rng = this.rng;
    const items = [];
    const nMacro = this.round === this.roundsTotal ? 2 : rng.int(1, 2);
    const nStock = rng.int(3, 5);

    const stockPool = [...STOCK_NEWS];
    for (let k = 0; k < nStock; k++) {
      const idx = Math.floor(rng.next() * stockPool.length);
      const s = stockPool.splice(idx, 1)[0];
      items.push({ kind: 'STOCK', ...s, at: 0 });
    }
    for (let k = 0; k < nMacro; k++) {
      const m = rng.pick(MACRO_NEWS);
      items.push({ kind: 'MACRO', ...m, at: 0 });
    }
    // timing étalé, avec un premier événement assez tôt pour lancer le jeu
    const slots = items.length;
    const first = rng.range(10, 16);
    const lastAt = this.roundSeconds - 30;
    items.forEach((it, idx) => {
      it.at = Math.round((first + ((lastAt - first) * idx) / Math.max(1, slots - 1) + rng.range(-6, 6)) * 10) / 10;
      it.at = Math.max(8, Math.min(this.roundSeconds - 18, it.at));
    });
    items.sort((a, b) => a.at - b.at);
    this.pendingNews = items.map((it, idx) => ({ ...it, id: `n${this.round}-${idx}`, fired: false, round: this.round }));
  }

  fireNews(n) {
    n.fired = true;
    if (n.kind === 'STOCK') {
      const i = this.inst[n.ticker];
      i.logTarget += n.move;
      this.news.unshift({
        id: n.id, at: this.round, headline: n.headline, detail: n.detail,
        kind: 'STOCK', ticker: n.ticker, time: fmtClock(this.totalSim),
        impact: n.move,
      });
      this.say('system', 'ib', `FLASH ${n.ticker} — ${n.headline}`, 'NEWSWIRE');
    } else {
      const moves = {};
      for (const t of Object.keys(this.inst)) {
        const i = this.inst[t];
        let m = n.tone * n.size * i.beta;
        if (n.headline.includes('pétrole') && i.sector === 'ENERGY') m = Math.abs(m) * 1.6;
        if (n.headline.includes('bancaire') && i.sector === 'BANKS') m = Math.abs(m) * 1.5;
        if (n.headline.includes('tech') && i.sector === 'TECH') m = Math.abs(m) * 1.4;
        i.logTarget += m;
        moves[t] = m;
      }
      this.news.unshift({
        id: n.id, at: this.round, headline: n.headline, detail: n.detail,
        kind: 'MACRO', time: fmtClock(this.totalSim), impact: n.size, moves,
      });
      this.say('system', 'ib', `MACRO — ${n.headline}`, 'NEWSWIRE');
    }
    if (this.news.length > 16) this.news.pop();

    // le desk réagit
    const t = this.rng.pick(Object.keys(this.inst));
    this.say('desk', 'deal', this.rng.pick([
      `That ${t} headline is a big one. Careful on the offer side.`,
      `Tape is moving, who is showing prices?`,
      `I am widening everything for the next minute.`,
      `Can someone check ${t}? Looks like a 2% move in the making.`,
    ]));
  }

  // -------------------------------------------------------------------- RFQ
  spawnRfq() {
    const rng = this.rng;
    // choisit un client, en évitant les 2 derniers
    let c = rng.pick(this.clients);
    let guard = 0;
    while (this.lastClients?.includes(c.id) && guard++ < 20) c = rng.pick(this.clients);
    this.lastClients = [...(this.lastClients || []).slice(-1), c.id];

    // choisit un titre : pondéré par l'activité récente
    const tickers = Object.keys(this.inst);
    const weights = tickers.map((t) => {
      const i = this.inst[t];
      const gap = Math.abs(i.logTarget - i.logV);
      const recent = this.news[0] && (this.news[0].ticker === t || this.news[0].kind === 'MACRO') ? 1.6 : 0.6;
      return 0.7 + gap * 45 + recent;
    });
    const sum = weights.reduce((a, b) => a + b, 0);
    let x = rng.next() * sum, ti = 0;
    while (x > weights[ti] && ti < weights.length - 1) { x -= weights[ti]; ti++; }
    const ticker = tickers[ti];

    const targetNotional = rng.pick(c.arch.notional || [2000000, 3500000]);
    const rawQty = targetNotional / this.inst[ticker].mid;
    const qty = Math.max(5000, Math.round(rawQty / 5000) * 5000);
    const rfq = {
      id: `r${this.round}-${this.rfqs.length}`,
      clientId: c.id, clientName: c.name, arch: c.arch.id, archLabel: c.arch.label, color: c.arch.color,
      ticker, qty,
      createdAt: this.totalSim,
      expiresAt: this.totalSim + BALANCE.rfqExpiry,
      status: 'open',      // open | quoted | done | passed | expired
      bid: null, offer: null, bidVol: null, offerVol: null,
      quoteAt: null, quoteTtl: null, decisionAt: null,
      fill: null,
      urgency: c.aggression > 0.85 && rng.chance(0.7) ? 'high' : rng.chance(0.25) ? 'high' : 'normal',
      informed: rng.chance(c.informedness),
      edgePct: 0,
    };
    // edge signé : les clients informés connaissent l'écart à la valeur juste
    const i = this.inst[ticker];
    const gap = i.logTarget - i.logV;
    let edge;
    if (rfq.informed) {
      const dir = Math.sign(gap) || (rng.chance(0.5) ? 1 : -1);
      const strength = Math.min(BALANCE.informedMaxEdge, Math.max(0.0025, Math.abs(gap) * 0.55));
      edge = dir * strength * i.mid * rng.range(0.6, 1.15);
    } else {
      edge = rng.gauss() * BALANCE.noiseEdgeSigma * i.mid;
    }
    rfq.edge = edge;
    rfq.fairPrice = i.mid + edge;      // valeur "juste" du client, figée à la demande
    rfq.edgePct = (edge / i.mid) * 100;
    this.rfqs.push(rfq);
    if (this.rfqs.length > 40) this.rfqs.shift();

    this.say('client', 'ht', `Hi, can I get a two-way price in ${ticker} for ${(qty / 1000)}k?`, c.name);
    this.say('system', 'ht', `${c.name} (${c.arch.label}) demande un prix ${ticker} — ${qty.toLocaleString('fr-FR')} titres`, 'DESK');
    return rfq;
  }

  activeRfq() {
    return this.rfqs.find((r) => r.status === 'open' || r.status === 'quoted') || null;
  }

  quoteRfq(rfqId, bid, offer, bidVol, offerVol, ttl) {
    const rfq = this.rfqs.find((r) => r.id === rfqId);
    if (!rfq) return { error: 'Demande introuvable' };
    if (rfq.status !== 'open' && rfq.status !== 'quoted') return { error: 'Cette demande est déjà traitée' };
    bid = Number(bid); offer = Number(offer);
    bidVol = Number(bidVol); offerVol = Number(offerVol);
    if (![bid, offer, bidVol, offerVol].every(Number.isFinite)) return { error: 'Valeurs invalides' };
    if (bid >= offer) return { error: "Le bid doit être inférieur à l'offer" };
    const mid = this.inst[rfq.ticker].mid;
    if (bid < mid * 0.9 || offer > mid * 1.1) return { error: 'Prix trop éloigné du marché' };
    if (bidVol < 1000 || offerVol < 1000) return { error: 'Volume minimum 1 000 titres' };

    rfq.bid = bid; rfq.offer = offer;
    rfq.bidVol = Math.min(bidVol, 500000); rfq.offerVol = Math.min(offerVol, 500000);
    rfq.quoteAt = this.totalSim;
    rfq.quoteTtl = Math.max(3, Math.min(120, Number(ttl) || 45));
    rfq.status = 'quoted';
    // une mise à jour de prix ne permet pas de repousser indéfiniment la décision
    if (!rfq.decisionAt) {
      rfq.decisionAt = this.totalSim + this.rng.range(BALANCE.decisionDelayMin, BALANCE.decisionDelayMax);
    } else {
      rfq.decisionAt = Math.min(rfq.decisionAt, this.totalSim + 1.2);
    }
    this.metrics.quotesSent += 1;
    this.metrics.volumeQuoted += rfq.qty;
    const skew = ((bid + offer) / 2 / mid - 1) * 10000;
    this.metrics.skewUsed = this.metrics.skewUsed * 0.8 + Math.abs(skew) * 0.2;
    this.say('client', 'ht', 'Working on it — price is live.', rfq.clientName);
    return { ok: true };
  }

  passRfq(rfqId) {
    const rfq = this.rfqs.find((r) => r.id === rfqId);
    if (!rfq || (rfq.status !== 'open' && rfq.status !== 'quoted')) return { error: 'Rien à passer' };
    rfq.status = 'passed';
    this.metrics.passes += 1;
    this.say('client', 'ht', 'No worries, talk later.', rfq.clientName);
    return { ok: true };
  }

  resolveDueRfqs() {
    for (const rfq of this.rfqs) {
      if (rfq.status === 'open' && this.totalSim >= rfq.expiresAt) {
        rfq.status = 'expired';
        this.say('client', 'ht', 'Client left the line — no price given.', 'DESK');
        this.say('system', 'ht', `${rfq.clientName} a quitté la ligne sans prix sur ${rfq.ticker}`, 'DESK');
      }
      if (rfq.status === 'quoted') {
        const ttlEnd = rfq.quoteAt + rfq.quoteTtl;
        const decideAt = Math.min(rfq.decisionAt, ttlEnd, rfq.expiresAt);
        if (this.totalSim >= decideAt) this.decide(rfq, this.totalSim >= ttlEnd);
      }
    }
  }

  decide(rfq, expiredQuote) {
    const i = this.inst[rfq.ticker];
    const mid = i.mid;
    const fair = rfq.fairPrice ?? mid + rfq.edge;
    const hurdle = mid * BALANCE.clientHurdle;
    const client = this.clients.find((c) => c.id === rfq.clientId);

    if (expiredQuote) {
      rfq.status = 'expired';
      if (client) this.clientStats[client.id].expired = (this.clientStats[client.id].expired || 0) + 1;
      if (this.rng.chance(0.6)) this.say('client', 'ht', this.rng.pick(['Your price is gone, sorry.', 'Too slow, market moved.', 'I need it live, not a snapshot.']), rfq.clientName);
      return;
    }

    let side = null;
    if (fair >= rfq.offer + hurdle) side = 'BUY';
    else if (fair <= rfq.bid - hurdle) side = 'SELL';

    // les clients peu agressifs refusent parfois même si le prix leur convient
    if (side && this.rng.next() > client.aggression + 0.15) side = null;

    if (!side) {
      rfq.status = 'passed';
      if (this.rng.chance(0.45)) {
        this.say('client', 'ht', this.rng.pick(['That is too wide for me.', 'Nothing for me at that level.', 'I will pass, thanks.', 'Can you tighten it up?']), rfq.clientName);
      }
      return;
    }

    const price = side === 'BUY' ? rfq.offer : rfq.bid;
    const avail = side === 'BUY' ? rfq.offerVol : rfq.bidVol;
    const qty = Math.min(rfq.qty, avail);
    if (qty <= 0) { rfq.status = 'passed'; return; }

    const signed = side === 'BUY' ? qty : -qty; // côté client → nous prenons l'opposé
    const ourSigned = -signed;

    // limites de position
    const pos = this.positions[rfq.ticker];
    if (Math.abs(pos.qty + ourSigned) * mid > BALANCE.maxPosNotionalPerTicker) {
      rfq.status = 'passed';
      rfq.fill = { rejected: true };
      this.metrics.rejects += 1;
      this.say('system', 'ht', `Refus interne : limite de position sur ${rfq.ticker}`, 'RISK');
      return;
    }

    this.applyFill(rfq.ticker, ourSigned, price, 0, 'RFQ', { client: rfq.clientName, arch: rfq.archLabel });
    rfq.status = 'done';
    rfq.fill = { side, qty, price: r2(price), clock: fmtClock(this.totalSim) };
    if (client) {
      client.trades += 1;
      this.clientStats[client.id].trades += 1;
      this.clientStats[client.id].informedTrades += rfq.informed ? 1 : 0;
    }
    this.say('client', 'ht',
      side === 'BUY'
        ? `Done — I buy ${(qty / 1000)}k ${rfq.ticker} at ${r2(price).toFixed(2)}.`
        : `Done — I sell ${(qty / 1000)}k ${rfq.ticker} at ${r2(price).toFixed(2)}.`,
      rfq.clientName);
  }

  // ------------------------------------------------------------------ chats
  tickChatter() {
    if (this.totalSim >= this.nextChatterAt) {
      this.nextChatterAt = this.totalSim + this.rng.range(BALANCE.chatterMin, BALANCE.chatterMax);
      const hottest = Object.keys(this.inst).sort((a, b) => {
        const ga = Math.abs(this.inst[a].logTarget - this.inst[a].logV);
        const gb = Math.abs(this.inst[b].logTarget - this.inst[b].logV);
        return gb - ga;
      })[0];
      const t = this.rng.chance(0.65) ? hottest : this.rng.pick(Object.keys(this.inst));
      const line = this.rng.pick(DEAL_ROOM_LINES).replace('{t}', t);
      this.say('desk', 'deal', line);
    }
    // le desk peut aussi répondre au joueur
    if (this.pendingReplyAt && this.totalSim >= this.pendingReplyAt) {
      this.pendingReplyAt = null;
      this.say('desk', this.replyRoom || 'deal', this.rng.pick(BOT_CHAT_LINES).replace('.', ', noted.'));
    }
  }

  chat(room, text) {
    text = String(text).slice(0, 240);
    if (!text.trim()) return;
    this.say('me', room, text, this.nickname);
    if (this.rng.chance(0.75)) {
      this.pendingReplyAt = this.totalSim + this.rng.range(1.5, 4);
      this.replyRoom = room;
    }
  }

  // ------------------------------------------------------------------ rounds
  beginRound() {
    if (this.round >= this.roundsTotal) return;
    this.round += 1;
    this.phase = 'round';
    this.simTime = 0;
    this.roundStartSim = this.totalSim;
    this.nextRfqAt = this.totalSim + this.rng.range(4, 7);
    this.roundSnapshotStart = {
      pnl: this.totalPnl(), fills: this.metrics.fills,
      capture: this.metrics.spreadCapture, adverse: this.metrics.adverse,
    };
    this.scheduleRound();
    this.say('system', 'ib', `ROUND ${this.round} — le marché ouvre. ${this.pendingNews.length} publications attendues.`);
  }

  closeAllPositions() {
    let cost = 0;
    for (const t of Object.keys(this.positions)) {
      const p = this.positions[t];
      if (p.qty === 0) continue;
      const i = this.inst[t];
      const side = p.qty > 0 ? 'SELL' : 'BUY';
      const price = side === 'SELL' ? i.bid : i.offer;
      const qty = Math.abs(p.qty);
      const fee = price * qty * BALANCE.exchangeFee;
      this.applyFill(t, side === 'SELL' ? -qty : qty, price, fee, 'CLOSE');
      cost += fee;
    }
    this.fees += 0; // déjà comptabilisé dans applyFill
    return cost;
  }

  endRound() {
    if (this.metrics.fills > 0) this.closeAllPositions();
    for (const r of this.rfqs) {
      if (r.status === 'open' || r.status === 'quoted') r.status = 'expired';
    }
    this.phase = 'break';
    const startPnl = this.roundSnapshotStart?.pnl ?? 0;
    const pnl = this.totalPnl() - startPnl;
    const rfqTrades = this.blotter.filter((b) => b.source === 'RFQ' && b.at >= this.roundStartSim);
    const exTrades = this.blotter.filter((b) => b.source === 'EXCHANGE' && b.at >= this.roundStartSim);

    // révélation des clients : qui était informé
    const reveal = this.clients.map((c) => {
      const st = this.clientStats[c.id];
      const trades = this.rfqs.filter((r) => r.clientId === c.id && r.status === 'done');
      const avgEdge = trades.length ? trades.reduce((a, r) => a + (r.edge / this.inst[r.ticker].mid) * 100, 0) / trades.length : 0;
      return {
        name: c.name, arch: c.arch.id, label: c.arch.label, color: c.arch.color,
        trades: st.trades, informedTrades: st.informedTrades,
        note: c.arch.note,
      };
    }).sort((a, b) => b.trades - a.trades);

    const rfqRound = this.blotter
      .filter((b) => b.source === 'RFQ' && b.at >= this.roundStartSim && typeof b.markout === 'number')
      .sort((a, b) => a.markout - b.markout);
    const worst = rfqRound.slice(0, 3).filter((b) => b.markout < 0);
    const best = [...rfqRound].reverse().slice(0, 2).filter((b) => b.markout > 0);

    this.roundStats = {
      round: this.round, pnl: Math.round(pnl),
      rfqTrades: rfqTrades.length, exchangeTrades: exTrades.length,
      capture: Math.round(this.metrics.spreadCapture - (this.roundSnapshotStart?.capture ?? 0)),
      adverse: Math.round(this.metrics.adverse - (this.roundSnapshotStart?.adverse ?? 0)),
      quotes: this.rfqs.filter((r) => r.status === 'done' || r.status === 'passed').length,
      fills: rfqTrades.length,
      total: Math.round(this.totalPnl()),
    };
    this.debrief = {
      open: true, round: this.round, stats: this.roundStats, clients: reveal, tips: this.buildTips(),
      worst: worst.map((b) => ({ ticker: b.ticker, side: b.side, qty: b.qty, price: b.price, client: b.client, markout: b.markout, clock: b.clock })),
      best: best.map((b) => ({ ticker: b.ticker, side: b.side, qty: b.qty, price: b.price, client: b.client, markout: b.markout, clock: b.clock })),
    };
    this.say('system', 'ib', `FIN DU ROUND ${this.round} — P&L du round : ${Math.round(pnl).toLocaleString('fr-FR')} $.`);
    if (this.round >= this.roundsTotal) this.finish();
  }

  finish() {
    this.phase = 'done';
    const lb = this.leaderboard();
    this.final = {
      pnl: Math.round(this.totalPnl()),
      realized: Math.round(this.realized),
      unrealised: Math.round(this.unrealised()),
      fees: Math.round(this.fees),
      rank: lb.rank, total: lb.total, topPct: lb.topPct,
      trades: this.blotter.length,
      quotes: this.metrics.quotesSent,
      hitRate: this.metrics.quotesSent ? this.metrics.rfqFills / this.metrics.quotesSent : 0,
      capture: Math.round(this.metrics.spreadCapture),
      adverse: Math.round(this.metrics.adverse),
      tips: this.buildTips(),
    };
  }

  buildTips() {
    const m = this.metrics;
    const tips = [];
    const hit = m.quotesSent ? m.rfqFills / m.quotesSent : 0;
    if (m.quotesSent >= 4 && hit > 0.75) tips.push({ tone: 'warn', text: "Vous êtes touché sur plus de 75 % des prix proposés : votre marché est trop serré (vous êtes la contrepartie facile). Élargissez de 3 à 5 bps." });
    if (m.quotesSent >= 4 && hit < 0.3) tips.push({ tone: 'info', text: "Moins de 30 % de vos prix sont traités : vous êtes trop large, vous laissez le spread aux autres. Resserrez le côté passif." });
    if (m.adverse < -4000) tips.push({ tone: 'bad', text: `Sélection adverse de ${Math.round(m.adverse).toLocaleString('fr-FR')} $ : le flux informé vous a pris à contre-pied. Skewez vos prix dans le sens de la news au lieu de coter symétrique.` });
    if (m.adverse > 4000) tips.push({ tone: 'good', text: "Markout positif : vos exécutions sont suivies d'un mouvement favorable. Votre lecture du flux est bonne." });
    if (Math.abs(this.unrealised()) > 15000) tips.push({ tone: 'warn', text: "Position directionnelle importante en fin de round : couvrez avant la publication suivante pour ne pas transformer un gain de spread en pari." });
    if (m.fees > 12000) tips.push({ tone: 'info', text: `Commissions ${Math.round(m.fees).toLocaleString('fr-FR')} $ : vous couvrez trop souvent. Laissez les flux non informés se compenser naturellement.` });
    if (!tips.length) tips.push({ tone: 'good', text: "Bon équilibre spread / risque sur ce round. Continuez à coter régulièrement et à couvrir uniquement le flux toxique." });
    return tips.slice(0, 3);
  }

  // ------------------------------------------------------------------ boucle
  step(dt) {
    if (this.phase !== 'round' && this.phase !== 'break') return;

    if (this.phase === 'round') {
      this.simTime += dt;
      this.totalSim += dt;

      for (const n of this.pendingNews) {
        if (!n.fired && this.simTime >= n.at) this.fireNews(n);
      }
      if (!this.activeRfq() && this.totalSim >= this.nextRfqAt) {
        this.pendingRfq = this.spawnRfq();
        this.nextRfqAt = this.totalSim + this.rng.range(BALANCE.rfqIntervalMin, BALANCE.rfqIntervalMax);
      }
      this.updatePrices(dt);
      this.updateCandles();
      this.resolveDueRfqs();
      this.processMarkouts();
      this.tickChatter();

      // suivi du risque
      const gn = this.grossNotional();
      if (gn > this.metrics.maxAbsNotional) this.metrics.maxAbsNotional = gn;

      if (this.simTime >= this.roundSeconds) {
        this.simTime = this.roundSeconds;
        this.endRound();
      }
    } else if (this.phase === 'break') {
      this.breakTime += dt;
      this.totalSim += dt * 0.15;
    }
  }

  // --------------------------------------------------------------- snapshot
  snapshot() {
    const lb = this.leaderboard();
    const active = this.activeRfq();
    const i = this.inst[this.chartTicker] || this.inst['BP'];
    const total = this.totalPnl();
    const unr = this.unrealised();

    return {
      sessionId: this.id,
      nickname: this.nickname,
      phase: this.phase,
      round: this.round,
      roundsTotal: this.roundsTotal,
      roundSeconds: this.roundSeconds,
      totalSim: Math.round(this.totalSim * 10) / 10,
      simTime: Math.round(this.simTime * 10) / 10,
      timeLeft: Math.max(0, Math.round((this.roundSeconds - this.simTime) * 10) / 10),
      progress: this.phase === 'round' ? Math.min(1, this.simTime / this.roundSeconds) : this.phase === 'briefing' ? 0 : 1,
      speed: this.speed, paused: this.paused,
      clock: fmtClock(this.totalSim),
      pnl: {
        realized: Math.round(this.realized),
        unrealised: Math.round(unr),
        fees: Math.round(this.fees),
        total: Math.round(total),
      },
      positions: Object.keys(this.positions)
        .filter((t) => this.positions[t].qty !== 0)
        .map((t) => {
          const p = this.positions[t];
          return {
            ticker: t, qty: p.qty, avg: r2(p.avg),
            notional: Math.round(Math.abs(p.qty * this.inst[t].mid)),
            unreal: Math.round(p.qty * (this.inst[t].mid - p.avg)),
            mark: r2(this.inst[t].mid),
            pctOfLimit: Math.min(100, (Math.abs(p.qty * this.inst[t].mid) / BALANCE.maxPosNotionalPerTicker) * 100),
          };
        }),
      grossNotional: Math.round(this.grossNotional()),
      equities: Object.keys(this.inst).map((t) => {
        const e = this.inst[t];
        const f = (this.flow[t] || []).filter((x) => this.totalSim - x.at <= 45);
        const buy = f.filter((x) => x.signed > 0).reduce((a, x) => a + x.notional, 0);
        const sell = f.filter((x) => x.signed < 0).reduce((a, x) => a + x.notional, 0);
        return {
          flow: { buy: Math.round(buy), sell: Math.round(sell), net: Math.round(buy - sell), total: Math.round(buy + sell) },
          ticker: t, name: e.name, sector: e.sector,
          ref: r2(e.open), last: r2(e.mid), bid: r2(e.bid), offer: r2(e.offer),
          chg: r2(e.mid - e.open), chgPct: (e.mid / e.open - 1) * 100,
          dir: e.dir,
          spark: this.spark(t),
        };
      }),
      chart: {
        ticker: this.chartTicker,
        candles: this.candles[this.chartTicker] || [],
        ref: r2(this.inst[this.chartTicker]?.open ?? 0),
        markers: this.blotter
          .filter((b) => b.ticker === this.chartTicker && b.source === 'RFQ')
          .slice(0, 14)
          .map((b) => ({ t: b.at, price: b.price, side: b.side })),
      },
      news: this.news.slice(0, 10),
      messages: this.messages.slice(-45),
      rfq: active ? this.publicRfq(active) : null,
      pendingRfqCount: this.rfqs.filter((r) => r.status === 'open' || r.status === 'quoted').length,
      clients: this.clients.map((c) => ({
        id: c.id, name: c.name, arch: c.arch.id, label: c.arch.label, color: c.arch.color,
        trades: c.trades, note: c.arch.note,
        informedness: this.phase === 'done' || this.phase === 'break' ? Math.round(c.informedness * 100) : null,
      })),
      blotter: this.blotter.slice(0, 18),
      leaderboard: { ...lb, rows: lb.rows, around: lb.around },
      coach: {
        quotesSent: this.metrics.quotesSent,
        fills: this.metrics.rfqFills,
        hitRate: this.metrics.quotesSent ? this.metrics.rfqFills / this.metrics.quotesSent : 0,
        capture: Math.round(this.metrics.spreadCapture),
        adverse: Math.round(this.metrics.adverse),
        fees: Math.round(this.fees),
        netEdge: Math.round(this.metrics.spreadCapture + this.metrics.adverse),
        avgClip: this.metrics.rfqFills ? Math.round(this.metrics.spreadCapture / this.metrics.rfqFills) : 0,
        maxRisk: Math.round(this.metrics.maxAbsNotional),
        tips: this.phase === 'round' ? this.liveTips() : [],
      },
      roundStats: this.roundStats,
      debrief: this.debrief,
      final: this.final,
      risk: {
        gross: Math.round(this.grossNotional()),
        limit: BALANCE.maxGrossNotional,
        perTickerLimit: BALANCE.maxPosNotionalPerTicker,
        perTicker: Object.keys(this.positions).map((t) => ({
          ticker: t, pct: Math.min(100, (Math.abs(this.positions[t].qty * this.inst[t].mid) / BALANCE.maxPosNotionalPerTicker) * 100),
        })).filter((x) => x.pct > 0),
      },
    };
  }

  spark(t) {
    const arr = this.candles[t] || [];
    const n = Math.min(24, arr.length);
    return arr.slice(arr.length - n).map((c) => c[4]);
  }

  publicRfq(r) {
    return {
      id: r.id, ticker: r.ticker, qty: r.qty,
      clientName: r.clientName, arch: r.arch, archLabel: r.archLabel, color: r.color,
      status: r.status, urgency: r.urgency,
      bid: r.bid, offer: r.offer, bidVol: r.bidVol, offerVol: r.offerVol,
      createdAt: r.createdAt, expiresAt: r.expiresAt,
      ttlLeft: Math.max(0, r.expiresAt - this.totalSim),
      edgePct: this.phase === 'done' ? r.edgePct : null,
    };
  }

  liveTips() {
    const tips = [];
    const m = this.metrics;
    const open = this.positions;
    const big = Object.keys(open).filter((t) => Math.abs(open[t].qty * this.inst[t].mid) > 8000000);
    if (big.length) tips.push({ tone: 'warn', text: `Exposition ${big[0]} > 8 M$ — pensez à couvrir (bouton HEDGE).` });
    if (m.spreadCapture + m.adverse < -2000) tips.push({ tone: 'bad', text: 'Flux toxique : privilégiez un skew directionnel plutôt qu\'un spread symétrique.' });
    const hot = Object.keys(this.inst).map((t) => ({ t, gap: Math.abs(this.inst[t].logTarget - this.inst[t].logV) })).sort((a, b) => b.gap - a.gap)[0];
    if (hot && hot.gap > 0.004) tips.push({ tone: 'info', text: `${hot.t} est encore loin de son niveau post-news : attendez-vous à du flux informé directionnel.` });
    return tips.slice(0, 3);
  }

  setChartTicker(t) {
    if (this.inst[t]) this.chartTicker = t;
  }
}
