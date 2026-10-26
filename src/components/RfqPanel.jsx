import React, { useEffect, useMemo, useRef, useState } from 'react';
import { cls, fmt1, money, compact, pct, signCls, num, price as px } from '../lib/format.js';

const SPREADS = [4, 8, 12, 20, 35];
const SKEWS = [-15, -8, 0, 8, 15];

function TimerRing({ left, total }) {
  const r = 14;
  const c = 2 * Math.PI * r;
  const frac = Math.max(0, Math.min(1, left / total));
  const urgent = left < 8;
  return (
    <div className={cls('timer-ring', urgent && 'urgent')} title={`La demande expire dans ${Math.ceil(left)} s`}>
      <svg width="34" height="34" viewBox="0 0 34 34">
        <circle cx="17" cy="17" r={r} fill="none" stroke="#12344a" strokeWidth="3" />
        <circle
          cx="17" cy="17" r={r} fill="none"
          stroke={urgent ? '#ff5d5d' : '#29b6f6'} strokeWidth="3" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - frac)}
        />
      </svg>
      <div className="val">{Math.max(0, Math.ceil(left))}</div>
    </div>
  );
}

export default function RfqPanel({ state, send }) {
  const rfq = state?.rfq;
  const equities = state?.equities ?? [];
  const equity = equities.find((e) => e.ticker === rfq?.ticker);
  const news = state?.news ?? [];

  const [mode, setMode] = useState('auto');
  const [spreadBps, setSpreadBps] = useState(12);
  const [skewBps, setSkewBps] = useState(0);
  const [manualBid, setManualBid] = useState('');
  const [manualOffer, setManualOffer] = useState('');
  const [volPct, setVolPct] = useState(100);
  const [ttl, setTtl] = useState(30);
  const [lastFill, setLastFill] = useState(null);
  const seenFill = useRef(null);

  useEffect(() => {
    if (rfq?.id) {
      setMode('auto');
      setSpreadBps(12);
      setSkewBps(0);
      setManualBid('');
      setManualOffer('');
      setVolPct(100);
    }
  }, [rfq?.id]);

  const topFill = state?.blotter?.[0];
  useEffect(() => {
    if (topFill && topFill.source === 'RFQ' && topFill.id !== seenFill.current) {
      seenFill.current = topFill.id;
      setLastFill({ ...topFill, shownAt: Date.now() });
    }
  }, [topFill?.id]);
  useEffect(() => {
    if (!lastFill) return undefined;
    const t = setTimeout(() => setLastFill(null), 5000);
    return () => clearTimeout(t);
  }, [lastFill]);

  const mid = equity?.last ?? 0;
  const autoBid = mid ? Math.round(mid * (1 - spreadBps / 1e4 + skewBps / 1e4) * 100) / 100 : 0;
  const autoOffer = mid ? Math.round(mid * (1 + spreadBps / 1e4 + skewBps / 1e4) * 100) / 100 : 0;
  const bid = mode === 'auto' || !manualBid ? autoBid : Number(manualBid);
  const offer = mode === 'auto' || !manualOffer ? autoOffer : Number(manualOffer);
  const effSpread = mid && bid && offer ? ((offer - bid) / 2 / mid) * 10000 : 0;
  const effSkew = mid && bid && offer ? (((bid + offer) / 2) / mid - 1) * 10000 : 0;
  const qty = rfq ? Math.max(1000, Math.round((rfq.qty * volPct) / 100 / 1000) * 1000) : 0;
  const theo = bid && offer ? ((offer - bid) / 2) * qty : 0;

  const ctx = useMemo(() => {
    if (!equity) return null;
    const cs = (state?.chart?.candles ?? []).filter((c) => c[0] <= (state?.totalSim ?? 0));
    const back = cs.length > 45 ? cs[cs.length - 46][4] : cs[0]?.[4];
    const var30 = back ? ((equity.last / back - 1) * 100) : 0;
    const lastNews = news.find((n) => n.ticker === equity.ticker || n.kind === 'MACRO');
    return { var30, lastNews };
  }, [equity?.ticker, equity?.last, news[0]?.id, state?.totalSim]);

  const submit = (e) => {
    e?.preventDefault();
    if (!rfq) return;
    send({ type: 'quote', rfqId: rfq.id, bid, offer, bidVol: qty, offerVol: qty, ttl });
  };

  const applySpread = (b) => { setSpreadBps(b); setMode('auto'); setManualBid(''); setManualOffer(''); };
  const applySkew = (b) => { setSkewBps(b); setMode('auto'); setManualBid(''); setManualOffer(''); };
  const quoted = Boolean(rfq && rfq.bid != null);

  return (
    <div className="panel" style={{ flex: 1, minHeight: 0 }}>
      <div className="panel-head">
        <span className="panel-title">🎯 Demande client <span className="badge src mono" style={{ fontSize: 8 }}>RFQ</span></span>
        <div className="spacer" />
        {rfq && (
          <button className="btn tiny ghost" onClick={() => send({ type: 'pass', rfqId: rfq.id })} title="Ne pas coter (P)">
            Passer ✕
          </button>
        )}
      </div>

      <div className="rfq-body">
        {lastFill && (
          <div style={{ padding: '6px 8px 0' }}>
            <div className={cls('fill-flash', lastFill.side === 'SELL' && 'sell')}>
              <b>EXÉCUTION</b> — {lastFill.client || 'Client'} {lastFill.side === 'BUY' ? 'achète' : 'vend'} {compact(lastFill.qty)} {lastFill.ticker} @ {px(lastFill.price)}
              <div style={{ fontSize: 9.6, opacity: 0.85, marginTop: 2 }}>
                Edge vs mid <span className={signCls(lastFill.capture)}>{money(lastFill.capture)} $</span>
                {' · '}position <span className={lastFill.posAfter >= 0 ? 'pos' : 'neg'}>{compact(lastFill.posAfter)}</span>
              </div>
            </div>
          </div>
        )}

        {!rfq && (
          <div className="idle-box">
            <div className="radar" />
            <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>Aucune demande en cours</div>
            <div style={{ fontSize: 10.5, maxWidth: 290, lineHeight: 1.5 }}>
              Les clients arrivent en continu. Préparez votre prix : spread, skew, taille.
            </div>
            <div className="hint" style={{ marginTop: 6, maxWidth: 300, lineHeight: 1.55 }}>
              Après une <b>news</b>, le flux arrive dans le sens de l'information. Skewez vos prix pour ne pas
              être la contrepartie facile.
            </div>
          </div>
        )}

        {rfq && equity && (
          <div className="rfq-live">
            <div className="rfq-top">
              <div className="rfq-client" style={{ borderColor: `${rfq.color}55` }} title={rfq.archLabel}>
                <span className="client-dot" style={{ background: rfq.color }} />
                <div>
                  <div className="nm">{rfq.clientName}</div>
                  <div className="ar">{rfq.archLabel}</div>
                </div>
              </div>
              {rfq.urgency === 'high' && <span className="badge warn" style={{ alignSelf: 'center' }}>PRESSÉ</span>}
              <div className="spacer" />
              <div style={{ textAlign: 'right' }}>
                <div className="mono" style={{ fontSize: 12.5, color: '#eaf7ff' }}>{px(mid)}</div>
                <div className={cls('mono', signCls(equity.chgPct), 'tiny-text')}>{pct(equity.chgPct)}</div>
              </div>
              <TimerRing left={rfq.ttlLeft} total={30} />
            </div>

            <div className="rfq-instrument">
              <span className="rfq-ticker">{rfq.ticker}</span>
              <span className="rfq-size">{compact(rfq.qty)} titres</span>
              <span className="rfq-notional">≈ {fmt1((rfq.qty * mid) / 1e6)} M$</span>
            </div>

            <div className="ctx-strip">
              <div className="ctx-cell">
                <div className="k">Var 45 s</div>
                <div className={cls('v', signCls(ctx?.var30))}>{pct(ctx?.var30 ?? 0)}</div>
              </div>
              <div className="ctx-cell">
                <div className="k">Flux client</div>
                <div className={cls('v', signCls(equity.flow?.net ?? 0))}>
                  {(equity.flow?.net ?? 0) > 0 ? 'ACHAT' : (equity.flow?.net ?? 0) < 0 ? 'VENTE' : '—'}
                  <span className="dim" style={{ fontSize: 9 }}>
                    {(equity.flow?.net ?? 0) !== 0 ? ` ${compact(Math.abs(equity.flow.net))}` : ''}
                  </span>
                </div>
              </div>
              <div className="ctx-cell" title={ctx?.lastNews?.headline || ''}>
                <div className="k">Dernière news</div>
                <div className="v" style={{ fontSize: 9.4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {ctx?.lastNews ? `${ctx.lastNews.kind === 'MACRO' ? 'MACRO' : ctx.lastNews.ticker} · ${ctx.lastNews.time}` : '—'}
                </div>
              </div>
            </div>

            <form className="quote-box" onSubmit={submit}>
              <div className="quote-grid">
                <label className="field bid-input">
                  <span className="field-label" style={{ color: 'var(--green)' }}>Bid — vous achetez</span>
                  <input
                    type="number" step="0.01"
                    value={mode === 'auto' ? autoBid.toFixed(2) : manualBid}
                    onChange={(e) => { setMode('manual'); setManualBid(e.target.value); if (!manualOffer) setManualOffer(autoOffer.toFixed(2)); }}
                    className="mono"
                  />
                </label>
                <label className="field ask-input">
                  <span className="field-label" style={{ color: 'var(--red)' }}>Offer — vous vendez</span>
                  <input
                    type="number" step="0.01"
                    value={mode === 'auto' ? autoOffer.toFixed(2) : manualOffer}
                    onChange={(e) => { setMode('manual'); setManualOffer(e.target.value); if (!manualBid) setManualBid(autoBid.toFixed(2)); }}
                    className="mono"
                  />
                </label>
              </div>

              <div className="presets">
                <span className="lbl">Spread</span>
                {SPREADS.map((s) => (
                  <button type="button" key={s} className={cls('chip-btn', mode === 'auto' && spreadBps === s && 'on')} onClick={() => applySpread(s)}>
                    {s}
                  </button>
                ))}
              </div>
              <div className="presets">
                <span className="lbl">Skew</span>
                {SKEWS.map((s) => (
                  <button
                    type="button" key={s}
                    className={cls('chip-btn', mode === 'auto' && skewBps === s && 'on')}
                    onClick={() => applySkew(s)}
                    title="Décale les deux prix : + si vous pensez que le vrai prix est plus haut"
                  >
                    {s > 0 ? `+${s}` : s}
                  </button>
                ))}
                <span className="hint" style={{ marginLeft: 4, fontSize: 9 }}>bps</span>
              </div>

              <div className="row" style={{ gap: 6 }}>
                <label className="field" style={{ flex: 1 }}>
                  <span className="field-label">Taille proposée (titres)</span>
                  <input
                    type="number" step="1000" value={qty}
                    onChange={(e) => setVolPct(Math.max(1, Math.min(300, (Number(e.target.value) / rfq.qty) * 100)))}
                    className="mono"
                  />
                </label>
                <label className="field" style={{ width: 74 }}>
                  <span className="field-label">Valide</span>
                  <select value={ttl} onChange={(e) => setTtl(Number(e.target.value))} style={{ padding: '5px 4px' }}>
                    <option value={15}>15 s</option>
                    <option value={30}>30 s</option>
                    <option value={45}>45 s</option>
                    <option value={60}>60 s</option>
                  </select>
                </label>
              </div>

              <div className="quote-meta">
                <span>spread <b>{num(effSpread, 1)}</b> bps</span>
                <span>skew <b>{effSkew > 0 ? '+' : ''}{num(effSkew, 1)}</b> bps</span>
                <span>edge <b className="pos">{money(theo)} $</b></span>
                <span className="dim">{num(volPct, 0)} % de la demande</span>
              </div>

              <div className="row" style={{ gap: 5 }}>
                <button type="submit" className="btn primary grow">
                  {quoted ? '↻ Mettre à jour' : 'Envoyer le prix'}
                </button>
                <button type="button" className="btn ghost" onClick={() => send({ type: 'pass', rfqId: rfq.id })} title="Ne pas coter (P)">
                  Passer
                </button>
              </div>

              {quoted && (
                <div className="live-quote">
                  <div className="row">
                    <span className="pulse-dot" />
                    <span style={{ fontSize: 9.5, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--green)' }}>
                      Prix live — le client réfléchit
                    </span>
                  </div>
                  <div className="row">
                    <span className="mono" style={{ color: 'var(--green)' }}>{px(rfq.bid)} × {compact(rfq.bidVol)}</span>
                    <div className="spacer" />
                    <span className="mono" style={{ color: 'var(--red)' }}>{compact(rfq.offerVol)} × {px(rfq.offer)}</span>
                  </div>
                </div>
              )}
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
