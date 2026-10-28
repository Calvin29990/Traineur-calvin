import React, { useEffect, useMemo, useRef, useState } from 'react';
import { cls, price, shares } from '../lib/format.js';

function initials(name = '') {
  return name.split(/[\s-]+/).map((p) => p[0]).join('').slice(0, 2).toUpperCase();
}

function ChatMessage({ m }) {
  const isMine = m.kind === 'me';
  const isSystem = m.kind === 'system';
  const isBreaking = isSystem && /BREAKING|MACRO FLASH|FAT FINGER|RISK ALERT/i.test(m.text);
  return (
    <div className={cls('chat-msg', isMine && 'mine', isSystem && 'system', isBreaking && 'breaking')}>
      <span className="cm-time mono">{m.clock?.slice(0, 5)}</span>
      <span className="cm-from">{isMine ? 'You' : m.from}</span>
      <span className="cm-text">{m.text}</span>
    </div>
  );
}

export default function ChatPanel({
  state, send, activeRoom, onSelectRoom, onPrefillQuote, onReadRoom, selectedTicker,
}) {
  const role = state?.role ?? 'IB';
  const messages = state?.messages ?? [];
  const contacts = state?.contacts ?? [];
  const requests = state?.clientRequests ?? [];
  const liveQuotes = state?.liveQuotes ?? [];
  const oldQuotes = state?.oldQuotes ?? [];
  const [text, setText] = useState('');
  const [quoteTab, setQuoteTab] = useState('live');
  const listRef = useRef(null);

  const activeContact = contacts.find((c) => c.id === activeRoom) || null;
  const roomMessages = useMemo(
    () => messages.filter((m) => m.room === activeRoom),
    [messages, activeRoom],
  );
  const roomReq = activeContact ? requests.find((r) => r.clientId === activeContact.id) : null;

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [roomMessages.length, activeRoom]);

  useEffect(() => {
    if (activeRoom) onReadRoom?.(activeRoom);
  }, [activeRoom, onReadRoom]);

  const submit = () => {
    const t = text.trim();
    if (!t) return;
    send({ type: 'chat', room: activeRoom, text: t });
    setText('');
  };

  const quickRfq = (tk, qty) => {
    if (!activeContact) return;
    send({ type: 'requestQuote', dealerRoom: activeContact.id, ticker: tk, qty });
  };

  const shopAll = () => {
    send({ type: 'requestQuote', dealerRoom: 'ALL', ticker: selectedTicker || 'MSFT', qty: 10000 });
  };

  const execute = (q, side) => {
    const qty = side === 'BUY' ? q.offerVol : q.bidVol;
    send({ type: 'acceptQuote', quoteId: q.id, side, qty });
  };

  const prefill = (ticker, qty) => {
    onPrefillQuote?.(ticker, qty, activeContact?.id);
  };

  return (
    <section className={cls('panel area-chat chat-panel', role === 'AM' && 'am')}>
      <div className="panel-head">
        <span className="panel-tab active">CHAT</span>
        <div className="room-tabs">
          {(state?.chatRooms ?? []).map((r) => (
            <button
              key={r.id}
              type="button"
              className={cls('room-tab', activeRoom === r.id && 'active')}
              onClick={() => onSelectRoom?.(r.id)}
            >
              {r.name}
            </button>
          ))}
          {activeContact && (
            <button type="button" className="room-tab active contact-tab">
              {activeContact.name} · {activeContact.team}
            </button>
          )}
        </div>
      </div>

      <div className="chat-main">
        <aside className="contacts">
          <div className="contacts-head">
            <span>NAME</span>
            <span>TEAM</span>
          </div>
          <div className="contacts-list">
            {contacts.map((c) => {
              const open = role === 'IB' ? c.openRfq : liveQuotes.some((q) => q.dealerId === c.id);
              return (
                <button
                  key={c.id}
                  type="button"
                  className={cls('contact', activeRoom === c.id && 'active', open && 'has-flow')}
                  onClick={() => {
                    onSelectRoom?.(c.id);
                    onReadRoom?.(c.id);
                    if (role === 'IB' && c.openRfq) prefill(c.openRfq.ticker, c.openRfq.qty);
                  }}
                  title={role === 'IB'
                    ? `${c.name} — ${c.team} · ${c.trades} trades${c.openRfq ? ' · open RFQ' : ''}`
                    : `${c.name} — dealer · ${c.trades} fills`}
                >
                  <span className="avatar sm" style={{ background: `${c.color}22`, color: c.color, borderColor: `${c.color}66` }}>
                    {initials(c.name)}
                  </span>
                  <span className="ct-name">{c.name}</span>
                  <span className="ct-team mono">{c.team}</span>
                  {c.unread > 0 && <span className="unread">{c.unread}</span>}
                  {open && <span className="flow-dot" title="Live quote / RFQ" />}
                </button>
              );
            })}
          </div>
          <div className="contacts-foot mono">{role === 'IB' ? `${contacts.length} clients` : `${contacts.length} dealers`}</div>
        </aside>

        <div className="chat-window">
          <div className="chat-head">
            <div>
              <b>{activeContact ? `${activeContact.name} — ${activeContact.team}` : (activeRoom === 'deal' ? 'Deal Room' : (role === 'IB' ? 'IB Room' : 'AM Room'))}</b>
              <small className="mono">{activeContact ? activeContact.phone : 'MULTI-DESK · FLOOR WIRE'}</small>
            </div>
            {roomReq && (
              <button type="button" className="rfq-pill" onClick={() => prefill(roomReq.ticker, roomReq.qty)} title="Prefill the Quote Ticket">
                ↳ {shares(roomReq.qty)} {roomReq.ticker} · {roomReq.ttlLeft}s
              </button>
            )}
          </div>

          <div className="messages" ref={listRef}>
            {roomMessages.map((m) => <ChatMessage key={m.id} m={m} />)}
            {!roomMessages.length && (
              <div className="empty chat-empty">
                {role === 'IB'
                  ? 'Send a message to the client or reply with a two-way price via the Quote Ticket.'
                  : 'Request a price from a dealer: “MSFT 10k pls”, or use the quick RFQ buttons.'}
              </div>
            )}
          </div>

          {role === 'AM' && activeContact && (
            <div className="quick-rfq">
              {[['MSFT', 10000], ['BP', 50000], ['HSBC', 25000], ['VW', 100000], ['BABA', 5000]].map(([tk, q]) => (
                <button key={tk} type="button" onClick={() => quickRfq(tk, q)} title={`Request a price for ${shares(q)} ${tk}`}>
                  {tk} {q / 1000}k pls
                </button>
              ))}
              <button type="button" className="shop-all" onClick={shopAll} title="Shop all 5 dealers simultaneously">
                SHOP ALL 5
              </button>
            </div>
          )}

          {role === 'IB' && activeContact && (
            <div className="quick-rfq">
              <button type="button" onClick={() => setText('Market has moved — do you need a new price?')}>Market moved?</button>
              <button type="button" onClick={() => setText('Happy to show you a tighter two-way here.')}>Offer tighter</button>
              <button type="button" onClick={() => setText('Working on your order now.')}>Working</button>
            </div>
          )}

          <div className="chat-input">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); submit(); } }}
              placeholder={role === 'AM' && activeContact ? `Message ${activeContact.name} — “MSFT 10k pls”` : 'Type a message…'}
              maxLength={240}
              aria-label="Chat message"
            />
            <button type="button" className="btn-send" onClick={submit} disabled={!text.trim()}>SEND</button>
          </div>
        </div>
      </div>

      {role === 'AM' && (
        <div className="chat-quotes">
          <div className="quote-tabs">
            <button type="button" className={cls('panel-tab', quoteTab === 'live' && 'active')} onClick={() => setQuoteTab('live')}>
              LIVE CHAT QUOTES <span className="count">{liveQuotes.length}</span>
            </button>
            <button type="button" className={cls('panel-tab', quoteTab === 'old' && 'active')} onClick={() => setQuoteTab('old')}>
              OLD CHAT QUOTES
            </button>
            <span className="panel-meta mono">1-click execution</span>
          </div>
          <div className="quotes-scroll">
            <table className="data-table quotes-table">
              <thead>
                <tr>
                  <th>MM</th>
                  <th>SECURITY</th>
                  <th className="num">BID VOL</th>
                  <th className="num">BID</th>
                  <th className="num">OFFER</th>
                  <th className="num">OFFER VOL</th>
                  <th className="num">VALID FOR</th>
                  <th className="act">{quoteTab === 'live' ? 'EXECUTE' : 'STATUS'}</th>
                </tr>
              </thead>
              <tbody>
                {(quoteTab === 'live' ? liveQuotes : oldQuotes).map((q) => {
                  const dp = state?.equities?.find((e) => e.ticker === q.ticker)?.dp ?? 2;
                  return (
                    <tr key={q.id} className={cls(quoteTab === 'live' && 'live-quote')}>
                      <td className="mono mm">{q.team || q.name}</td>
                      <td className="tk">{q.ticker}</td>
                      <td className="num mono dim">{shares(q.bidVol)}</td>
                      <td className="num mono pos strong">{price(q.bid, dp)}</td>
                      <td className="num mono neg strong">{price(q.offer, dp)}</td>
                      <td className="num mono dim">{shares(q.offerVol)}</td>
                      <td className="num mono">{q.validFor ?? ''}{quoteTab === 'live' ? 's' : ''}</td>
                      <td className="act">
                        {quoteTab === 'live' ? (
                          <span className="exec-btns">
                            <button type="button" className="exec sell" onClick={() => execute(q, 'SELL')} title={`Sell ${shares(q.bidVol)} ${q.ticker} at ${q.bid}`}>SELL</button>
                            <button type="button" className="exec buy" onClick={() => execute(q, 'BUY')} title={`Buy ${shares(q.offerVol)} ${q.ticker} at ${q.offer}`}>BUY</button>
                          </span>
                        ) : (
                          <span className={cls('status-chip', q.status)}>
                            {q.status}{q.fillPrice ? ` @ ${q.fillPrice}` : ''}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {!(quoteTab === 'live' ? liveQuotes : oldQuotes).length && (
                  <tr><td colSpan={8} className="empty">{quoteTab === 'live' ? 'No live dealer quotes — send an RFQ.' : 'No closed quotes yet.'}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}
