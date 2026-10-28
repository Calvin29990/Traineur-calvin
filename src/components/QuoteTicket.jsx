import React, { useEffect, useMemo, useState } from 'react';
import { cls, price, shares } from '../lib/format.js';

const roundDp = (v, dp) => Number(Number(v).toFixed(dp));

export default function QuoteTicket({
  state, send, clientId, prefill, selectedTicker, onSelectTicker,
}) {
  const role = state?.role ?? 'IB';
  const equities = state?.equities ?? [];
  const contacts = state?.contacts ?? [];
  const requests = state?.clientRequests ?? [];
  const liveQuotes = state?.liveQuotes ?? [];
  const oldQuotes = state?.oldQuotes ?? [];
  const client = contacts.find((c) => c.id === clientId) || null;
  const openReq = client ? requests.find((r) => r.clientId === client.id) : null;

  const [ticker, setTicker] = useState(selectedTicker || 'MSFT');
  const [validFor, setValidFor] = useState('45');
  const [bid, setBid] = useState('');
  const [offer, setOffer] = useState('');
  const [bidVol, setBidVol] = useState('');
  const [offerVol, setOfferVol] = useState('');
  const [tab, setTab] = useState('live');

  const eq = equities.find((e) => e.ticker === ticker) || equities[0];
  const dp = eq?.dp ?? 2;
  const ref = eq?.last ?? 0;

  const center = (bps = 50) => {
    if (!ref) return;
    setBid(String(roundDp(ref * (1 - bps / 10000), dp)));
    setOffer(String(roundDp(ref * (1 + bps / 10000), dp)));
  };

  // Follow the ticker selected in EQUITIES / CHART
  useEffect(() => {
    if (selectedTicker && selectedTicker !== ticker) {
      setTicker(selectedTicker);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTicker]);

  // Recentre when ticker changes
  useEffect(() => {
    if (!ref) return;
    setBid(String(roundDp(ref * (1 - 50 / 10000), dp)));
    setOffer(String(roundDp(ref * (1 + 50 / 10000), dp)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticker]);

  // Prefill from chat click / RFQ pill
  useEffect(() => {
    if (!prefill) return;
    const tk = prefill.ticker || ticker;
    setTicker(tk);
    if (prefill.qty) {
      setBidVol(String(prefill.qty));
      setOfferVol(String(prefill.qty));
    }
    const e = equities.find((x) => x.ticker === tk);
    if (e) {
      const d = e.dp ?? 2;
      setBid(String(roundDp(e.last * (1 - 50 / 10000), d)));
      setOffer(String(roundDp(e.last * (1 + 50 / 10000), d)));
    }
    setValidFor('45');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefill?.ts]);

  // When a client is selected with an open RFQ, prefill size
  useEffect(() => {
    if (!openReq) return;
    setTicker(openReq.ticker);
    setBidVol(String(openReq.qty));
    setOfferVol(String(openReq.qty));
    const e = equities.find((x) => x.ticker === openReq.ticker);
    if (e) {
      const d = e.dp ?? 2;
      setBid(String(roundDp(e.last * (1 - 50 / 10000), d)));
      setOffer(String(roundDp(e.last * (1 + 50 / 10000), d)));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openReq?.id, client?.id]);

  const nums = useMemo(() => {
    const b = Number(bid);
    const o = Number(offer);
    const mid = b > 0 && o > 0 ? (b + o) / 2 : 0;
    const spreadBps = mid > 0 ? ((o - b) / mid) * 10000 : 0;
    return { b, o, spreadBps };
  }, [bid, offer]);

  const invalid = !nums.b || !nums.o || nums.b >= nums.o || !Number(bidVol) || !Number(offerVol);

  const sendQuote = () => {
    send({
      type: 'sendQuote',
      clientRoom: client?.id,
      ticker,
      bid: nums.b,
      offer: nums.o,
      bidVol: Number(bidVol),
      offerVol: Number(offerVol),
      validFor: Number(validFor) || 45,
    });
  };

  const myLive = role === 'IB' ? liveQuotes : [];
  const myOld = role === 'IB' ? oldQuotes : [];

  return (
    <section className="panel area-ticket ticket-panel">
      <div className="panel-head">
        <span className="panel-tab active">QUOTE TICKET</span>
        <span className="panel-meta mono">
          {client ? `${client.name} · ${client.team}` : 'NO CLIENT SELECTED'}
        </span>
      </div>

      <div className="ticket-body">
        <div className="ticket-ref">
          <span className="ref-ticker">{ticker}</span>
          <span className="ref-price mono">REF {price(ref, dp)}</span>
          {openReq && <span className="ref-rfq mono">RFQ {shares(openReq.qty)} · {openReq.ttlLeft}s</span>}
          {!client && <span className="ref-warn">Sélectionnez un client dans CHAT</span>}
        </div>

        <div className="ticket-grid">
          <label className="field">
            <span>Ticker</span>
            <select
              value={ticker}
              onChange={(e) => { setTicker(e.target.value); onSelectTicker?.(e.target.value); }}
            >
              {equities.map((e) => <option key={e.ticker} value={e.ticker}>{e.ticker}</option>)}
            </select>
          </label>
          <label className="field">
            <span>Valid for seconds</span>
            <input value={validFor} onChange={(e) => setValidFor(e.target.value.replace(/[^\d]/g, ''))} inputMode="numeric" />
          </label>
          <label className="field">
            <span>Bid Price (Client Sell)</span>
            <input value={bid} onChange={(e) => setBid(e.target.value)} inputMode="decimal" step={dp === 3 ? '0.001' : '0.01'} />
          </label>
          <label className="field">
            <span>Offer Price (Client Buy)</span>
            <input value={offer} onChange={(e) => setOffer(e.target.value)} inputMode="decimal" step={dp === 3 ? '0.001' : '0.01'} />
          </label>
          <label className="field">
            <span>Bid Volume</span>
            <input value={bidVol} onChange={(e) => setBidVol(e.target.value.replace(/[^\d]/g, ''))} inputMode="numeric" />
          </label>
          <label className="field">
            <span>Offer Volume</span>
            <input value={offerVol} onChange={(e) => setOfferVol(e.target.value.replace(/[^\d]/g, ''))} inputMode="numeric" />
          </label>
        </div>

        <div className="ticket-quick">
          {[25, 50, 100, 200].map((bps) => (
            <button key={bps} type="button" onClick={() => center(bps)}>±{bps}bps</button>
          ))}
          <span className={cls('spread-chip', nums.spreadBps > 250 ? 'bad' : nums.spreadBps > 120 ? 'warn' : 'ok')}>
            {nums.spreadBps > 0 ? `${nums.spreadBps.toFixed(0)} bps spread` : '—'}
          </span>
        </div>

        <button type="button" className="send-quote" onClick={sendQuote} disabled={invalid || !client}>
          SEND QUOTE
        </button>
        {invalid && <div className="ticket-error">Bid doit être &lt; Offer · volumes &gt; 0</div>}
      </div>

      <div className="ticket-quotes">
        <div className="quote-tabs">
          <button type="button" className={cls('panel-tab', tab === 'live' && 'active')} onClick={() => setTab('live')}>
            LIVE CHAT QUOTES <span className="count">{myLive.length}</span>
          </button>
          <button type="button" className={cls('panel-tab', tab === 'old' && 'active')} onClick={() => setTab('old')}>
            OLD CHAT QUOTES
          </button>
        </div>
        <div className="quotes-scroll">
          <table className="data-table quotes-table">
            <thead>
              <tr>
                <th>HF</th>
                <th>SECURITY</th>
                <th className="num">BID VOL</th>
                <th className="num">BID</th>
                <th className="num">OFFER</th>
                <th className="num">OFFER VOL</th>
                <th className="num">VALID FOR</th>
                <th className="act" />
              </tr>
            </thead>
            <tbody>
              {(tab === 'live' ? myLive : myOld).map((q) => {
                const qdp = equities.find((e) => e.ticker === q.ticker)?.dp ?? 2;
                return (
                  <tr key={q.id} className={cls(tab === 'live' && 'live-quote')}>
                    <td className="mono mm">{q.team}</td>
                    <td className="tk">{q.ticker}</td>
                    <td className="num mono dim">{shares(q.bidVol)}</td>
                    <td className="num mono pos strong">{price(q.bid, qdp)}</td>
                    <td className="num mono neg strong">{price(q.offer, qdp)}</td>
                    <td className="num mono dim">{shares(q.offerVol)}</td>
                    <td className="num mono">{q.validFor ?? ''}{tab === 'live' ? 's' : ''}</td>
                    <td className="act">
                      {tab === 'live' ? (
                        <button type="button" className="x-btn" title="Cancel quote" onClick={() => send({ type: 'cancelQuote', quoteId: q.id })}>✕</button>
                      ) : (
                        <span className={cls('status-chip', q.status)}>{q.status}{q.fillPrice ? ` @ ${q.fillPrice}` : ''}</span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {!(tab === 'live' ? myLive : myOld).length && (
                <tr><td colSpan={8} className="empty">{tab === 'live' ? 'No live quotes — send one to a client.' : 'No closed quotes yet.'}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
