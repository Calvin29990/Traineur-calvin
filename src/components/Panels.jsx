import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  cls, pct, money, price as px, refPriceStr, shares,
} from '../lib/format.js';

/* =============================================================== 1. EQUITIES */
export function EquitiesPanel({ state, send, onSelectTicker }) {
  const [sortCol, setSortCol] = useState('default');
  const [sortAsc, setSortAsc] = useState(true);
  const equities = state?.equities ?? [];
  const selected = state?.chart?.ticker;
  const watched = state?.watchedTickers ?? [];

  const toggleSort = (col) => {
    if (sortCol === col) setSortAsc(!sortAsc);
    else { setSortCol(col); setSortAsc(true); }
  };

  const rows = useMemo(() => {
    const arr = [...equities];
    if (sortCol === 'ticker') arr.sort((a, b) => (sortAsc ? a.ticker.localeCompare(b.ticker) : b.ticker.localeCompare(a.ticker)));
    else if (sortCol === 'ref') arr.sort((a, b) => (sortAsc ? a.last - b.last : b.last - a.last));
    else if (sortCol === 'chg') arr.sort((a, b) => (sortAsc ? a.chgPct - b.chgPct : b.chgPct - a.chgPct));
    return arr;
  }, [equities, sortCol, sortAsc]);

  const handlePick = (tk) => {
    send({ type: 'chart', ticker: tk });
    if (onSelectTicker) onSelectTicker(tk);
  };

  return (
    <section className="amp-panel area-equities">
      <div className="amp-tabbar">
        <button type="button" className="amp-tab active">1. EQUITIES</button>
      </div>

      <div className="amp-panel-body">
        <table className="amp-table">
          <thead>
            <tr>
              <th onClick={() => toggleSort('ticker')} className="sortable">
                TICKER <span className="sort-ico">{sortCol === 'ticker' ? (sortAsc ? '▲' : '▼') : '▴▾'}</span>
              </th>
              <th onClick={() => toggleSort('ref')} className="sortable num-col">
                REFPRICE <span className="sort-ico">{sortCol === 'ref' ? (sortAsc ? '▲' : '▼') : '▴▾'}</span>
              </th>
              <th onClick={() => toggleSort('chg')} className="sortable num-col">
                % CHG <span className="sort-ico">{sortCol === 'chg' ? (sortAsc ? '▲' : '▼') : '▴▾'}</span>
              </th>
              <th className="num-col">
                TYPE <span className="sort-ico">▴▾</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((e) => {
              const tickUp = e.dir >= 0;
              const chgUp = e.chgPct >= 0;
              return (
                <tr
                  key={e.ticker}
                  className={cls('clickable', selected === e.ticker && 'selected')}
                  onClick={() => handlePick(e.ticker)}
                  onDoubleClick={() => send({ type: 'watchTicker', ticker: e.ticker })}
                  title="Click to select across Quote, Exchange & Chart · Double-click to pin below"
                >
                  <td className="tk-cell">{e.ticker}</td>
                  <td className={cls('num-col mono', tickUp ? 'pos' : 'neg')}>
                    {refPriceStr(e.last)} <span className="dir-arrow">{tickUp ? '↑' : '↓'}</span>
                  </td>
                  <td className={cls('num-col mono', chgUp ? 'pos' : 'neg')}>
                    {pct(e.chgPct, 2)}
                  </td>
                  <td className="num-col type-cell">{e.type || 'Equity O'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* AmplifyME dashed quick-watch slot beneath Equities table (matches image-1.png) */}
        <div className="amp-watch-slot">
          {watched.length === 0 ? (
            <span className="watch-placeholder">Double-click a ticker above to pin quick-watch</span>
          ) : (
            watched.map((tk) => {
              const eq = equities.find((x) => x.ticker === tk);
              if (!eq) return null;
              return (
                <button
                  key={tk}
                  type="button"
                  className={cls('watch-chip', selected === tk && 'active')}
                  onClick={() => handlePick(tk)}
                >
                  <b>{tk}</b>
                  <span className={eq.chgPct >= 0 ? 'pos' : 'neg'}>${px(eq.last)}</span>
                </button>
              );
            })
          )}
        </div>
      </div>
    </section>
  );
}

/* ================================================================ NEWS WIRE */
export function NewsPanel({ state, onSelectTicker, send }) {
  const [q, setQ] = useState('');
  const [openId, setOpenId] = useState(null);
  const news = state?.news ?? [];
  const assistMode = state?.assistMode;

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return news;
    return news.filter(
      (n) =>
        (n.ticker || '').toLowerCase().includes(term) ||
        (n.headline || '').toLowerCase().includes(term) ||
        (n.detail || '').toLowerCase().includes(term)
    );
  }, [news, q]);

  const topId = news[0]?.id;

  const handleRowClick = (n) => {
    setOpenId((cur) => (cur === n.id ? null : n.id));
    if (n.kind === 'STOCK' && n.ticker) {
      send?.({ type: 'chart', ticker: n.ticker });
      onSelectTicker?.(n.ticker);
    }
  };

  return (
    <section className="amp-panel area-news">
      <div className="amp-news-search">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search keywords"
          aria-label="Search news keywords"
        />
        <span className="search-ico" aria-hidden="true">🔍</span>
      </div>

      <div className="amp-panel-body">
        <table className="amp-table news-table">
          <thead>
            <tr>
              <th style={{ width: 62 }}>TICKER</th>
              <th>HEADLINE</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((n) => {
              const isOpen = openId === n.id;
              return (
                <React.Fragment key={n.id}>
                  <tr
                    className={cls('clickable news-row', n.id === topId && 'fresh', isOpen && 'selected')}
                    onClick={() => handleRowClick(n)}
                  >
                    <td className={cls('news-tk', n.kind === 'MACRO' && 'macro', n.kind === 'NOTE' && 'note')}>
                      {n.ticker || n.kind}
                    </td>
                    <td className="news-hl">
                      <span>{n.headline}</span>
                      <span className="news-time-inline">{n.time}</span>
                    </td>
                  </tr>
                  {isOpen && n.detail && (
                    <tr className="news-detail-row">
                      <td colSpan={2}>
                        <div className="news-wire-box">
                          <div>{n.detail}</div>
                          {assistMode && n.frHint && (
                            <div className="news-fr-hint">💡 Coach : {n.frHint}</div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
            {!rows.length && (
              <tr>
                <td colSpan={2} className="amp-empty">
                  Waiting for market wire headlines…
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/* ============================================== POSITIONS & TRADE BLOTTER */
export function PositionsPanel({ state, send, onSelectTicker }) {
  const [tab, setTab] = useState('pos');
  const [sortCol, setSortCol] = useState('default');
  const [sortAsc, setSortAsc] = useState(false);

  const positions = state?.positions ?? [];
  const blotter = state?.blotter ?? [];
  const risk = state?.risk;
  const role = state?.role ?? 'IB';

  const sortedPos = useMemo(() => {
    const arr = [...positions];
    if (sortCol === 'sec') arr.sort((a, b) => (sortAsc ? a.ticker.localeCompare(b.ticker) : b.ticker.localeCompare(a.ticker)));
    else if (sortCol === 'pos') arr.sort((a, b) => (sortAsc ? a.qty - b.qty : b.qty - a.qty));
    else if (sortCol === 'net') arr.sort((a, b) => (sortAsc ? a.netPnl - b.netPnl : b.netPnl - a.netPnl));
    return arr;
  }, [positions, sortCol, sortAsc]);

  const toggleSort = (col) => {
    if (sortCol === col) setSortAsc(!sortAsc);
    else { setSortCol(col); setSortAsc(false); }
  };

  return (
    <section className="amp-panel area-positions">
      <div className="amp-tabbar">
        <button
          type="button"
          className={cls('amp-tab', tab === 'pos' && 'active')}
          onClick={() => setTab('pos')}
        >
          POSITIONS
        </button>
        <button
          type="button"
          className={cls('amp-tab', tab === 'blotter' && 'active')}
          onClick={() => setTab('blotter')}
        >
          TRADE BLOTTER
        </button>
        <button
          type="button"
          className={cls('amp-tab', tab === 'risk' && 'active')}
          onClick={() => setTab('risk')}
          title="Exposure & Mandate Limits"
        >
          {role === 'AM' ? '$20M MANDATE' : 'RISK LIMITS'}
        </button>
      </div>

      <div className="amp-panel-body">
        {tab === 'pos' && (
          <table className="amp-table pos-table">
            <thead>
              <tr>
                <th className="sortable" onClick={() => toggleSort('sec')}>SECURITY ▴▾</th>
                <th className="num-col sortable" onClick={() => toggleSort('pos')}>NET<br />POS ▴▾</th>
                <th className="num-col">AVG.<br />PRICE ▴▾</th>
                <th className="num-col">POS.<br />VALUE($) ▴▾</th>
                <th className="num-col">UNREALISED<br />P/L ▴▾</th>
                <th className="num-col">REALISED<br />P/L ▴▾</th>
                <th className="num-col sortable" onClick={() => toggleSort('net')}>NET<br />P/L ▴▾</th>
              </tr>
            </thead>
            <tbody>
              {sortedPos.map((p) => (
                <tr
                  key={p.ticker}
                  className="clickable"
                  onClick={() => {
                    send?.({ type: 'chart', ticker: p.ticker });
                    onSelectTicker?.(p.ticker);
                  }}
                >
                  <td className="tk-cell">{p.ticker}</td>
                  <td className={cls('num-col mono', p.qty > 0 ? 'pos' : p.qty < 0 ? 'neg' : '')}>
                    {shares(p.qty)}
                  </td>
                  <td className="num-col mono">{p.qty === 0 ? '0' : px(p.avg)}</td>
                  <td className="num-col mono">{p.qty === 0 ? '0' : money(p.notional)}</td>
                  <td className={cls('num-col mono', p.unreal > 0 ? 'pos' : p.unreal < 0 ? 'neg' : '')}>
                    {money(p.unreal)}
                  </td>
                  <td className={cls('num-col mono', p.realised > 0 ? 'pos' : p.realised < 0 ? 'neg' : '')}>
                    {money(p.realised)}
                  </td>
                  <td className={cls('num-col mono', p.netPnl > 0 ? 'pos' : p.netPnl < 0 ? 'neg' : '')}>
                    {money(p.netPnl)}
                  </td>
                </tr>
              ))}
              {!sortedPos.length && (
                <tr>
                  <td colSpan={7} className="amp-empty">
                    {role === 'IB'
                      ? 'No positions yet — send two-way quotes to HF / AM clients in Chat.'
                      : 'No positions yet — deploy your $20,000,000 fund via IB Quotes or Exchange.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}

        {tab === 'blotter' && (
          <table className="amp-table pos-table">
            <thead>
              <tr>
                <th>TIME</th>
                <th>SECURITY</th>
                <th>SIDE</th>
                <th className="num-col">VOLUME</th>
                <th className="num-col">PRICE</th>
                <th>VENUE</th>
                <th className="num-col">COMM.</th>
              </tr>
            </thead>
            <tbody>
              {blotter.map((b) => (
                <tr key={b.id}>
                  <td className="mono">{b.clock}</td>
                  <td className="tk-cell">{b.ticker}</td>
                  <td className={b.side === 'BUY' ? 'pos' : 'neg'}>{b.side}</td>
                  <td className="num-col mono">{shares(b.qty)}</td>
                  <td className="num-col mono">{px(b.price)}</td>
                  <td className="mono">{b.venue || b.client || b.source}</td>
                  <td className={cls('num-col mono', b.commSigned > 0 ? 'pos' : 'dim')}>
                    {b.commSigned > 0 ? `+${money(b.commSigned)}` : money(b.commSigned)}
                  </td>
                </tr>
              ))}
              {!blotter.length && (
                <tr>
                  <td colSpan={7} className="amp-empty">No trades executed in this round.</td>
                </tr>
              )}
            </tbody>
          </table>
        )}

        {tab === 'risk' && (
          <div className="amp-risk-pane">
            <div className="risk-summary-row">
              <div>
                <div className="risk-lbl">Gross Exposure</div>
                <div className="mono">${money(risk?.gross ?? 0)} / ${money(risk?.limit ?? 20000000)}</div>
              </div>
              <div>
                <div className="risk-lbl">Net Exposure</div>
                <div className={cls('mono', (risk?.net ?? 0) >= 0 ? 'pos' : 'neg')}>
                  ${money(risk?.net ?? 0)}
                </div>
              </div>
              {role === 'AM' && (
                <div>
                  <div className="risk-lbl">Portfolio Value</div>
                  <div className="mono">${money(state?.pnl?.portfolioValue ?? 20000000)}</div>
                </div>
              )}
            </div>

            <div className="amp-gauge">
              <i style={{ width: `${Math.min(100, ((risk?.gross ?? 0) / (risk?.limit || 1)) * 100)}%` }} />
            </div>

            {(risk?.perTicker ?? []).map((r) => (
              <div key={r.ticker} className="risk-tk-row">
                <div className="row" style={{ justifyContent: 'space-between', fontSize: 10 }}>
                  <b className="mono">{r.ticker}</b>
                  <span className="mono dim">
                    ${money(r.notional)} ({Math.round(r.pct)}% of ${(risk.perTickerLimit / 1e6).toFixed(0)}M limit)
                  </span>
                </div>
                <div className={cls('amp-gauge small', r.pct > 80 && 'danger')}>
                  <i style={{ width: `${Math.min(100, r.pct)}%` }} />
                </div>
              </div>
            ))}

            <div className="row" style={{ marginTop: 6, justifyContent: 'space-between' }}>
              <span className="dim" style={{ fontSize: 9.5 }}>
                Tip: Unwind large inventory in 10k–15k clips on EXCHANGE to minimize depth slippage.
              </span>
              {positions.some((p) => p.qty !== 0) && (
                <button type="button" className="amp-mini-btn" onClick={() => send({ type: 'flatten' })}>
                  Flatten All
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

/* ============================================================== CHAT PANEL */
export function ChatPanel({ state, send, activeRoom, onSelectRoom, onPrefillQuote }) {
  const [search, setSearch] = useState('');
  const [text, setText] = useState('');
  const [seenMap, setSeenMap] = useState({});
  const listRef = useRef(null);

  const rooms = state?.chatRooms ?? [
    { id: 'deal', name: 'Deal Room', team: '', headerTitle: 'DEAL ROOM', subTitle: 'MULTI-DESK' },
    { id: 'ib', name: 'IB Room', team: '', headerTitle: 'IB ROOM', subTitle: 'INTERNAL' },
  ];
  const messages = state?.messages ?? [];

  // Ensure activeRoom is valid when roles switch between IB and AM
  useEffect(() => {
    if (!rooms.some((r) => r.id === activeRoom)) {
      const firstContact = rooms.find((r) => r.team) || rooms[0];
      if (firstContact && onSelectRoom) onSelectRoom(firstContact.id);
    }
  }, [rooms, activeRoom, onSelectRoom]);

  const currentRoom = rooms.find((r) => r.id === activeRoom) || rooms[0];
  const roomMsgs = useMemo(
    () => messages.filter((m) => m.room === currentRoom?.id),
    [messages, currentRoom?.id]
  );

  // Track unread counts per room
  const unread = useMemo(() => {
    const out = {};
    for (const r of rooms) {
      const rMsgs = messages.filter((m) => m.room === r.id && m.kind !== 'me');
      const lastSeenId = seenMap[r.id];
      if (!rMsgs.length) { out[r.id] = 0; continue; }
      if (!lastSeenId) {
        out[r.id] = r.id === currentRoom?.id ? 0 : rMsgs.length;
      } else {
        const idx = rMsgs.findIndex((m) => m.id === lastSeenId);
        out[r.id] = r.id === currentRoom?.id ? 0 : (idx === -1 ? rMsgs.length : rMsgs.length - 1 - idx);
      }
    }
    return out;
  }, [messages, rooms, seenMap, currentRoom?.id]);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
    const rMsgs = messages.filter((m) => m.room === currentRoom?.id && m.kind !== 'me');
    const last = rMsgs[rMsgs.length - 1];
    if (last && currentRoom?.id) {
      setSeenMap((prev) => (prev[currentRoom.id] === last.id ? prev : { ...prev, [currentRoom.id]: last.id }));
    }
  }, [roomMsgs.length, currentRoom?.id, messages]);

  const filteredRooms = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return rooms;
    return rooms.filter(
      (r) => r.name.toLowerCase().includes(term) || (r.team || '').toLowerCase().includes(term)
    );
  }, [rooms, search]);

  const submit = (e) => {
    e?.preventDefault();
    if (!text.trim() || !currentRoom) return;
    send({ type: 'chat', room: currentRoom.id, text: text.trim() });
    setText('');
  };

  return (
    <section className="amp-panel area-chat">
      <div className="amp-chat-split">
        {/* Left column: Search + NAME | TEAM directory (matches image-1.png) */}
        <div className="amp-chat-dir">
          <div className="amp-dir-search">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name or team"
            />
            <span className="search-ico" aria-hidden="true">🔍</span>
          </div>

          <div className="amp-dir-head">
            <span>NAME</span>
            <span>TEAM</span>
          </div>

          <div className="amp-dir-list">
            {filteredRooms.map((r) => (
              <div
                key={r.id}
                className={cls('amp-dir-row', currentRoom?.id === r.id && 'active')}
                onClick={() => {
                  onSelectRoom?.(r.id);
                  if (r.openRfq && onPrefillQuote) {
                    onPrefillQuote(r.openRfq.ticker, r.openRfq.qty, r.id);
                  }
                }}
              >
                <span className="dir-name">
                  {r.hasOpenRfq && <i className="rfq-live-dot" title="Active trade inquiry!" />}
                  {r.name}
                </span>
                <span className="dir-team">
                  {r.team}
                  {unread[r.id] > 0 && <b className="dir-badge">{Math.min(9, unread[r.id])}</b>}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Right column: Selected room header + messages + Input + SEND MESSAGE */}
        <div className="amp-chat-conv">
          <div className="amp-conv-head">
            <div className="conv-avatar" aria-hidden="true">👤</div>
            <div style={{ minWidth: 0 }}>
              <div className="conv-title">{currentRoom?.headerTitle || currentRoom?.name}</div>
              <div className="conv-sub">{currentRoom?.subTitle || 'SINGLE'}</div>
            </div>
            {currentRoom?.openRfq && (
              <button
                type="button"
                className="amp-rfq-pill"
                onClick={() => onPrefillQuote?.(currentRoom.openRfq.ticker, currentRoom.openRfq.qty, currentRoom.id)}
                title="Click to load ticker & volume into Quote Ticket"
              >
                RFQ: {shares(currentRoom.openRfq.qty)} {currentRoom.openRfq.ticker} →
              </button>
            )}
          </div>

          <div className="amp-conv-msgs" ref={listRef}>
            {roomMsgs.map((m) => (
              <div key={m.id} className={cls('amp-msg', m.kind)}>
                <span className="msg-ts">[{m.clock}]</span>{' '}
                <span className="msg-from">{m.from}:</span>{' '}
                <span className="msg-txt">{m.text}</span>
              </div>
            ))}
            {!roomMsgs.length && (
              <div className="amp-empty" style={{ padding: 14 }}>
                {state?.role === 'IB' && currentRoom?.team
                  ? `Proactive Sales Tip: Say "hi, seen the news in BP? need a price?" to solicit client flow!`
                  : 'No messages yet in this room.'}
              </div>
            )}
          </div>

          <form className="amp-conv-form" onSubmit={submit}>
            <textarea
              rows={2}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  submit(e);
                }
              }}
              placeholder={
                state?.role === 'IB'
                  ? 'Input your message or @quote (e.g. @quote BP 54 56 50000)'
                  : 'Message dealer or @rfq (e.g. @rfq BP 50000)'
              }
            />
            <button type="submit" className="amp-blue-btn">
              SEND MESSAGE
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}
