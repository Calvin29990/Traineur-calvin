import React, { useEffect, useState } from 'react';
import { cls, price as px, shares, money } from '../lib/format.js';

export default function RfqPanel({
  state,
  send,
  activeRoom,
  onSelectRoom,
  selectedTicker,
  onSelectTicker,
  prefill,
}) {
  const role = state?.role ?? 'IB';
  const equities = state?.equities ?? [];
  const liveQuotes = state?.liveQuotes ?? [];
  const oldQuotes = state?.oldQuotes ?? [];
  const clientRequests = state?.clientRequests ?? [];
  const rooms = state?.chatRooms ?? [];
  const clientRooms = rooms.filter((r) => r.team);

  const [ticker, setTicker] = useState(selectedTicker || 'BP');
  const [validFor, setValidFor] = useState('45');
  const [bidPrice, setBidPrice] = useState('');
  const [offerPrice, setOfferPrice] = useState('');
  const [bidVol, setBidVol] = useState('');
  const [offerVol, setOfferVol] = useState('');
  const [dealerTarget, setDealerTarget] = useState('ALL');
  const [amQty, setAmQty] = useState('25000');
  const [qTab, setQTab] = useState('live');

  // Sync ticker when user clicks an equity or chart
  useEffect(() => {
    if (selectedTicker) setTicker(selectedTicker);
  }, [selectedTicker]);

  // Apply prefill when user clicks an open RFQ pill in Chat
  useEffect(() => {
    if (!prefill) return;
    if (prefill.ticker) setTicker(prefill.ticker);
    if (prefill.qty) {
      setBidVol(String(prefill.qty));
      setOfferVol(String(prefill.qty));
      setAmQty(String(prefill.qty));
    }
  }, [prefill]);

  // Resolve target client room in IB mode
  const activeIsContact = clientRooms.some((r) => r.id === activeRoom);
  const targetClientRoom = activeIsContact
    ? activeRoom
    : (clientRequests[0]?.clientRoom || clientRooms[0]?.id || 'hf1test1');

  const eq = equities.find((e) => e.ticker === ticker) || equities[0];
  const mid = eq?.last ?? 0;

  // Quick helper only in Assist Mode (kept clean in Exam Mode!)
  const prefillAroundRef = (halfPct = 0.006, skewPct = 0) => {
    if (!mid) return;
    const dec = mid >= 100 ? 2 : 2;
    setBidPrice((mid * (1 - halfPct + skewPct)).toFixed(dec));
    setOfferPrice((mid * (1 + halfPct + skewPct)).toFixed(dec));
    if (!bidVol) setBidVol('25000');
    if (!offerVol) setOfferVol('25000');
  };

  const submitIbQuote = (e) => {
    e?.preventDefault();
    send({
      type: 'sendQuote',
      clientRoom: targetClientRoom,
      ticker,
      bid: Number(bidPrice),
      offer: Number(offerPrice),
      bidVol: Number(bidVol || 10000),
      offerVol: Number(offerVol || bidVol || 10000),
      validFor: Number(validFor || 45),
    });
    setQTab('live');
  };

  const submitAmRfq = (e) => {
    e?.preventDefault();
    send({
      type: 'requestQuote',
      dealerRoom: dealerTarget,
      ticker,
      qty: Number(amQty || 25000),
    });
    setQTab('live');
  };

  const handleTickerChange = (tk) => {
    setTicker(tk);
    onSelectTicker?.(tk);
    send({ type: 'chart', ticker: tk });
  };

  const amNotional = (Number(amQty) || 0) * mid;
  const amPctOfFund = ((amNotional / 20000000) * 100).toFixed(1);

  return (
    <section className="amp-panel area-rfq">
      {role === 'IB' ? (
        <form className="amp-quote-form" onSubmit={submitIbQuote}>
          {/* Subtle client target bar + open RFQ quick-switch */}
          <div className="amp-qtarget-bar">
            <span className="dim">To Client:</span>
            <select
              value={targetClientRoom}
              onChange={(e) => onSelectRoom?.(e.target.value)}
              className="amp-qtarget-sel"
            >
              {clientRooms.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} ({r.team}){r.openRfq ? ` — RFQ ${shares(r.openRfq.qty)} ${r.openRfq.ticker}` : ''}
                </option>
              ))}
            </select>
            {eq && (
              <span className="mono dim" style={{ marginLeft: 'auto', fontSize: 10 }}>
                Ref: ${px(mid)}
              </span>
            )}
          </div>

          <div className="amp-qgrid">
            <label className="amp-qfield">
              <span>Ticker</span>
              <select value={ticker} onChange={(e) => handleTickerChange(e.target.value)}>
                {equities.map((e) => (
                  <option key={e.ticker} value={e.ticker}>{e.ticker}</option>
                ))}
              </select>
            </label>

            <label className="amp-qfield">
              <span>Valid for seconds</span>
              <input
                type="number"
                min="5"
                max="120"
                value={validFor}
                onChange={(e) => setValidFor(e.target.value)}
              />
            </label>

            <label className="amp-qfield">
              <span>Bid Price</span>
              <input
                type="number"
                step="any"
                value={bidPrice}
                onChange={(e) => setBidPrice(e.target.value)}
                placeholder={mid ? (mid * 0.993).toFixed(2) : '55'}
              />
            </label>

            <label className="amp-qfield">
              <span>Offer Price</span>
              <input
                type="number"
                step="any"
                value={offerPrice}
                onChange={(e) => setOfferPrice(e.target.value)}
                placeholder={mid ? (mid * 1.007).toFixed(2) : '61'}
              />
            </label>

            <label className="amp-qfield">
              <span>Bid Volume</span>
              <input
                type="number"
                step="1000"
                value={bidVol}
                onChange={(e) => {
                  setBidVol(e.target.value);
                  if (!offerVol) setOfferVol(e.target.value);
                }}
                placeholder="e.g 10000"
              />
            </label>

            <label className="amp-qfield">
              <span>Offer Volume</span>
              <input
                type="number"
                step="1000"
                value={offerVol}
                onChange={(e) => setOfferVol(e.target.value)}
                placeholder="e.g 10000"
              />
            </label>
          </div>

          {state?.assistMode && (
            <div className="amp-assist-strip">
              <span>Coach Assist:</span>
              <button type="button" onClick={() => prefillAroundRef(0.013, 0)}>Tight ±1.3%</button>
              <button type="button" onClick={() => prefillAroundRef(0.016, 0.009)}>Bull Skew ↑</button>
              <button type="button" onClick={() => prefillAroundRef(0.016, -0.009)}>Bear Skew ↓</button>
            </div>
          )}

          <button type="submit" className="amp-blue-btn">
            SEND QUOTE
          </button>
        </form>
      ) : (
        /* Buy-Side Asset Manager ($20M) RFQ Ticket */
        <form className="amp-quote-form" onSubmit={submitAmRfq}>
          <div className="amp-qtarget-bar">
            <span className="pos" style={{ fontWeight: 700 }}>AM 1 ($20M Fund)</span>
            <span className="mono dim" style={{ marginLeft: 'auto', fontSize: 10 }}>
              Ref: ${px(mid)}
            </span>
          </div>

          <div className="amp-qgrid">
            <label className="amp-qfield">
              <span>Ticker</span>
              <select value={ticker} onChange={(e) => handleTickerChange(e.target.value)}>
                {equities.map((e) => (
                  <option key={e.ticker} value={e.ticker}>{e.ticker}</option>
                ))}
              </select>
            </label>

            <label className="amp-qfield">
              <span>IB Counterparty</span>
              <select value={dealerTarget} onChange={(e) => setDealerTarget(e.target.value)}>
                <option value="ALL">All Banks (IB 1–3)</option>
                {clientRooms.map((r) => (
                  <option key={r.id} value={r.id}>{r.team} ({r.name})</option>
                ))}
              </select>
            </label>

            <label className="amp-qfield">
              <span>Block Volume</span>
              <input
                type="number"
                step="1000"
                value={amQty}
                onChange={(e) => setAmQty(e.target.value)}
                placeholder="e.g 25000"
              />
            </label>

            <label className="amp-qfield">
              <span>Est. Notional (% $20M)</span>
              <input
                readOnly
                value={`$${money(amNotional)} (${amPctOfFund}%)`}
                className="readonly-inp"
              />
            </label>
          </div>

          <button type="submit" className="amp-blue-btn">
            REQUEST QUOTE (RFQ)
          </button>
        </form>
      )}

      {/* LIVE CHAT QUOTES / OLD CHAT QUOTES (exact match to image-1.png) */}
      <div className="amp-tabbar sub-tabs">
        <button
          type="button"
          className={cls('amp-tab', qTab === 'live' && 'active')}
          onClick={() => setQTab('live')}
        >
          LIVE CHAT QUOTES {liveQuotes.length > 0 && `(${liveQuotes.length})`}
        </button>
        <button
          type="button"
          className={cls('amp-tab', qTab === 'old' && 'active')}
          onClick={() => setQTab('old')}
        >
          OLD CHAT QUOTES
        </button>
      </div>

      <div className="amp-panel-body">
        {qTab === 'live' ? (
          <table className="amp-table quotes-table">
            <thead>
              <tr>
                <th>{role === 'IB' ? 'HF' : 'IB'}</th>
                <th>SECURITY ▴▾</th>
                <th className="num-col">BID<br />VOL ▴▾</th>
                <th className="num-col">BID ▴▾</th>
                <th className="num-col">OFFER ▴▾</th>
                <th className="num-col">OFFER<br />VOL ▴▾</th>
                <th className="num-col">VALID<br />FOR ▴▾</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {liveQuotes.map((q) => (
                <tr key={q.id}>
                  <td>{q.team}</td>
                  <td className="tk-cell">{q.ticker}</td>
                  <td className="num-col mono">{shares(q.bidVol)}</td>
                  <td className="num-col mono">
                    {role === 'AM' ? (
                      <button
                        type="button"
                        className="quote-hit-btn sell"
                        onClick={() => send({ type: 'acceptQuote', quoteId: q.id, side: 'SELL', qty: q.bidVol })}
                        title={`Sell ${shares(q.bidVol)} ${q.ticker} @ ${q.bid} to ${q.team}`}
                      >
                        {px(q.bid)}
                      </button>
                    ) : (
                      <span className="pos">{px(q.bid)}</span>
                    )}
                  </td>
                  <td className="num-col mono">
                    {role === 'AM' ? (
                      <button
                        type="button"
                        className="quote-hit-btn buy"
                        onClick={() => send({ type: 'acceptQuote', quoteId: q.id, side: 'BUY', qty: q.offerVol })}
                        title={`Buy ${shares(q.offerVol)} ${q.ticker} @ ${q.offer} from ${q.team}`}
                      >
                        {px(q.offer)}
                      </button>
                    ) : (
                      <span className="neg">{px(q.offer)}</span>
                    )}
                  </td>
                  <td className="num-col mono">{shares(q.offerVol)}</td>
                  <td className={cls('num-col mono', q.validFor <= 8 && 'neg')}>{q.validFor}s</td>
                  <td className="num-col">
                    <button
                      type="button"
                      className="quote-cancel-x"
                      onClick={() => send({ type: 'cancelQuote', quoteId: q.id })}
                      title="Cancel / Pull live quote immediately"
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
              {!liveQuotes.length && (
                <tr>
                  <td colSpan={8} className="amp-empty">
                    {role === 'IB'
                      ? 'No live quotes — fill prices above and click SEND QUOTE.'
                      : 'No live IB quotes — click REQUEST QUOTE to poll IB 1–3.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        ) : (
          <table className="amp-table quotes-table">
            <thead>
              <tr>
                <th>{role === 'IB' ? 'HF' : 'IB'}</th>
                <th>SEC</th>
                <th className="num-col">BID</th>
                <th className="num-col">OFFER</th>
                <th>STATUS</th>
                <th className="num-col">TIME</th>
              </tr>
            </thead>
            <tbody>
              {oldQuotes.map((q) => (
                <tr key={q.id}>
                  <td>{q.team}</td>
                  <td className="tk-cell">{q.ticker}</td>
                  <td className="num-col mono">{px(q.bid)}</td>
                  <td className="num-col mono">{px(q.offer)}</td>
                  <td>
                    <span className={cls(
                      'qstatus-pill',
                      q.status === 'filled' && 'pos',
                      (q.status === 'rejected' || q.status === 'cancelled') && 'neg'
                    )}>
                      {q.status === 'filled' ? `FILLED (${q.fillSide} @ ${px(q.fillPrice)})` : q.status.toUpperCase()}
                    </span>
                  </td>
                  <td className="num-col mono dim">{q.closedClock}</td>
                </tr>
              ))}
              {!oldQuotes.length && (
                <tr>
                  <td colSpan={6} className="amp-empty">No historical quotes yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
