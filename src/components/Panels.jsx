import React, { useMemo, useState } from 'react';
import {
  cls, pct, compact, usd, usdSign, price as px, signCls, money, num,
} from '../lib/format.js';

/* ------------------------------------------------------------------ spark */
function Spark({ data, up, width = 46, height = 16 }) {
  if (!data || data.length < 2) return <svg className="spark" width={width} height={height} />;
  const lo = Math.min(...data), hi = Math.max(...data);
  const span = hi - lo || 1;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * width},${height - ((v - lo) / span) * (height - 2) - 1}`);
  return (
    <svg className="spark" width={width} height={height}>
      <polyline
        points={pts.join(' ')}
        fill="none"
        stroke={up ? 'var(--green)' : 'var(--red)'}
        strokeWidth="1.2"
        strokeLinejoin="round"
        opacity="0.9"
      />
    </svg>
  );
}

/* -------------------------------------------------------------- equities */
export function EquitiesPanel({ state, send }) {
  const [q, setQ] = useState('');
  const equities = state?.equities ?? [];
  const selected = state?.chart?.ticker;
  const posMap = useMemo(() => {
    const m = {};
    (state?.positions ?? []).forEach((p) => { m[p.ticker] = p; });
    return m;
  }, [state?.positions]);
  const rows = equities.filter((e) =>
    !q || e.ticker.toLowerCase().includes(q.toLowerCase()) || e.name.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="panel area-equities">
      <div className="panel-head">
        <span className="panel-title"><span className="idx">1</span> EQUITIES</span>
        <div className="spacer" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Rechercher…"
          style={{ width: 104, height: 19, padding: '0 6px', fontSize: 10 }}
        />
      </div>
      <div className="panel-body">
        <table className="grid">
          <thead>
            <tr>
              <th>Ticker</th>
              <th>Dernier</th>
              <th>% Chg</th>
              <th>Flux 45s</th>
              <th style={{ textAlign: 'center' }}>Tendance</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((e) => {
              const pos = posMap[e.ticker];
              const up = e.chgPct >= 0;
              const net = e.flow?.net ?? 0;
              const tot = (e.flow?.buy ?? 0) + (e.flow?.sell ?? 0);
              const buyW = tot > 0 ? ((e.flow?.buy ?? 0) / tot) * 100 : 50;
              return (
                <tr
                  key={e.ticker}
                  className={cls('clickable', selected === e.ticker && 'selected')}
                  onClick={() => send({ type: 'chart', ticker: e.ticker })}
                >
                  <td>
                    <div className="tk">
                      {pos && <span className="pos-dot" title={`Position ${pos.qty}`} />}
                      {e.ticker}
                    </div>
                    <div className="sub">{e.sector}</div>
                  </td>
                  <td>
                    <div className="mono" style={{ fontSize: 11.5, color: '#eaf7ff' }}>{px(e.last)}</div>
                    <div className="sub mono" style={{ fontSize: 8.6 }}>ref {px(e.ref)}</div>
                  </td>
                  <td>
                    <span className={cls('chg-pill', up ? 'up' : 'down')}>{pct(e.chgPct)}</span>
                  </td>
                  <td>
                    <div className="flow-wrap">
                      <div className="flow-bar" title={`Achats clients ${compact(Math.round((e.flow?.buy ?? 0)))} $ / ventes ${compact(Math.round(e.flow?.sell ?? 0))} $`}>
                        <i className="b" style={{ width: `${buyW}%` }} />
                        <i className="s" style={{ width: `${100 - buyW}%` }} />
                      </div>
                      <span className={cls('flow-txt', net > 0 ? 'pos' : net < 0 ? 'neg' : 'dim')}>
                        {net > 0 ? '▲' : net < 0 ? '▼' : '—'}
                      </span>
                    </div>
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <Spark data={e.spark} up={up} />
                  </td>
                </tr>
              );
            })}
            {!rows.length && (
              <tr><td colSpan={5} className="empty">Aucun titre</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="panel-foot" style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'var(--muted)' }}>
        <span>Cliquez un titre pour l'afficher sur le graphique</span>
        <span className="mono">1 s sim = 15 s marché</span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------- news */
export function NewsPanel({ state }) {
  const [open, setOpen] = useState(null);
  const [q, setQ] = useState('');
  const news = state?.news ?? [];
  const rows = news.filter((n) => !q || n.headline.toLowerCase().includes(q.toLowerCase()));
  const lastId = news[0]?.id;

  return (
    <div className="panel area-news">
      <div className="panel-head">
        <span className="panel-title">📡 Fil d'actualité</span>
        <div className="spacer" />
        <span className="badge src mono" style={{ fontSize: 8 }}>{news.length} PUBLI.</span>
      </div>
      <div className="panel-body">
        {!rows.length && (
          <div className="empty">
            <div style={{ fontSize: 20, marginBottom: 6 }}>📰</div>
            Les publications arriveront pendant le round.<br />
            Une news = un flux informé dans les secondes qui suivent.
          </div>
        )}
        <div className="news-list">
          {rows.map((n) => {
            const isOpen = open === n.id;
            return (
              <div
                key={n.id}
                className={cls('news-item', isOpen && 'open', n.id === lastId && 'fresh')}
                onClick={() => setOpen(isOpen ? null : n.id)}
              >
                <div className="news-top">
                  <span className={cls('news-tag', n.kind === 'MACRO' ? 'macro' : 'stock')}>
                    {n.kind === 'MACRO' ? 'MACRO' : n.ticker}
                  </span>
                  <span className="news-time">{n.time}</span>
                  {n.kind === 'MACRO' && <span className="badge warn" style={{ fontSize: 8 }}>TOUT LE MARCHÉ</span>}
                </div>
                <div className="news-head">{n.headline}</div>
                {isOpen && (
                  <div className="news-detail">
                    {n.detail}
                    <div className="impact dim">
                      {n.kind === 'STOCK'
                        ? `Impact estimé ${pct(n.impact * 100)} sur ${n.ticker} — corrige le flux client dans les prochaines secondes.`
                        : `Choc transversal de ${pct(n.impact * 100)} amplifié par le bêta sectoriel de chaque titre.`}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------- positions */
export function PositionsPanel({ state, send }) {
  const [tab, setTab] = useState('pos');
  const positions = state?.positions ?? [];
  const blotter = state?.blotter ?? [];
  const risk = state?.risk;

  return (
    <div className="panel area-positions">
      <div className="panel-head">
        <span className="panel-title">POSITIONS</span>
        <div className="tabs" style={{ marginLeft: 6 }}>
          <button className={cls('tab', tab === 'pos' && 'active')} onClick={() => setTab('pos')}>Positions</button>
          <button className={cls('tab', tab === 'blotter' && 'active')} onClick={() => setTab('blotter')}>Blotter</button>
          <button className={cls('tab', tab === 'risk' && 'active')} onClick={() => setTab('risk')}>Risque</button>
        </div>
      </div>

      <div className="panel-body">
        {tab === 'pos' && (
          <table className="grid">
            <thead>
              <tr><th>Sec</th><th>Qty</th><th>Avg</th><th>Px</th><th>Unreal</th><th></th></tr>
            </thead>
            <tbody>
              {positions.map((p) => (
                <tr key={p.ticker}>
                  <td><div className="tk">{p.ticker}</div></td>
                  <td className={p.qty > 0 ? 'pos' : 'neg'}>{compact(p.qty)}</td>
                  <td>{px(p.avg)}</td>
                  <td>{px(p.mark)}</td>
                  <td className={signCls(p.unreal)}>{usdSign(p.unreal)}</td>
                  <td>
                    <button className="btn tiny ghost" onClick={(ev) => { ev.stopPropagation(); send({ type: 'hedge', ticker: p.ticker }); }}>
                      Couvrir
                    </button>
                  </td>
                </tr>
              ))}
              {!positions.length && (
                <tr><td colSpan={6} className="empty">Book à plat. Cotez des prix pour prendre du risque.</td></tr>
              )}
            </tbody>
          </table>
        )}

        {tab === 'blotter' && (
          <table className="grid">
            <thead>
              <tr><th>Hre</th><th>Côté</th><th>Qté</th><th>Prix</th><th>Source</th><th>Edge</th></tr>
            </thead>
            <tbody>
              {blotter.map((b) => (
                <tr key={b.id}>
                  <td className="mono" style={{ fontSize: 9.5 }}>{b.clock}</td>
                  <td><span className={cls('badge', b.side === 'BUY' ? 'buy' : 'sell')}>{b.side === 'BUY' ? 'ACH' : 'VEN'}</span></td>
                  <td>{compact(b.qty)}</td>
                  <td>{px(b.price)}</td>
                  <td className="mono" style={{ fontSize: 8.8, color: 'var(--muted)' }}>
                    {b.source === 'RFQ' ? (b.client?.split('-')[0] || 'RFQ') : 'MARCHÉ'}
                  </td>
                  <td className={signCls(b.capture)}>{money(b.capture)}</td>
                </tr>
              ))}
              {!blotter.length && <tr><td colSpan={6} className="empty">Aucune exécution</td></tr>}
            </tbody>
          </table>
        )}

        {tab === 'risk' && (
          <div style={{ padding: 9, display: 'flex', flexDirection: 'column', gap: 9 }}>
            <div>
              <div className="row" style={{ justifyContent: 'space-between', marginBottom: 3 }}>
                <span className="tiny-text upper dim">Risque brut</span>
                <span className="mono tiny-text">{usd(risk?.gross ?? 0)} / {usd(risk?.limit ?? 0)}</span>
              </div>
              <div className={cls('gauge', ((risk?.gross ?? 0) / (risk?.limit ?? 1)) > 0.8 ? 'bad' : ((risk?.gross ?? 0) / (risk?.limit ?? 1)) > 0.5 ? 'warn' : 'ok')}>
                <i style={{ width: `${Math.min(100, ((risk?.gross ?? 0) / (risk?.limit ?? 1)) * 100)}%` }} />
              </div>
            </div>
            {(risk?.perTicker ?? []).map((r) => (
              <div key={r.ticker}>
                <div className="row" style={{ justifyContent: 'space-between', marginBottom: 3 }}>
                  <span className="mono tiny-text">{r.ticker}</span>
                  <span className={cls('mono tiny-text', r.pct > 80 ? 'neg' : 'dim')}>{num(r.pct, 0)} % de la limite</span>
                </div>
                <div className={cls('gauge', r.pct > 80 ? 'bad' : r.pct > 50 ? 'warn' : 'ok')}>
                  <i style={{ width: `${Math.min(100, r.pct)}%` }} />
                </div>
              </div>
            ))}
            {!(risk?.perTicker ?? []).length && <div className="empty">Aucune position ouverte</div>}
            <button className="btn tiny" onClick={() => send({ type: 'flatten' })} style={{ alignSelf: 'flex-start' }}>
              Tout couvrir au marché
            </button>
            <div className="hint">
              Limite : {usd(risk?.perTickerLimit ?? 6e6)} de notionnel par titre, {usd(risk?.limit ?? 15e6)} au total.
              Au-delà, vos cotations et exécutions sont refusées par le risk manager.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------- chat */
export function ChatPanel({ state, send }) {
  const [room, setRoom] = useState('ht');
  const [text, setText] = useState('');
  const [seen, setSeen] = useState({});
  const listRef = React.useRef(null);
  const messages = state?.messages ?? [];
  const roomMsgs = messages.filter((m) => m.room === room);

  const unread = useMemo(() => {
    const u = {};
    for (const m of messages) {
      if (!u[m.room]) u[m.room] = 0;
      if (m.room !== room && m.id !== seen[m.room] && (seen[m.room] || '') < m.id) u[m.room] += 1;
    }
    return u;
  }, [messages, room, seen]);

  React.useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
    const last = roomMsgs[roomMsgs.length - 1];
    if (last) setSeen((s) => ({ ...s, [room]: last.id }));
  }, [roomMsgs.length, room]);

  const rooms = [
    { id: 'ht', name: 'Clients', desc: 'Flux RFQ' },
    { id: 'deal', name: 'Deal Room', desc: 'Desk' },
    { id: 'ib', name: 'IB Room', desc: 'Wire' },
  ];

  const submit = (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    send({ type: 'chat', room, text: text.trim() });
    setText('');
  };

  return (
    <div className="panel area-chat">
      <div className="panel-head">
        <span className="panel-title">💬 Chat</span>
        <div className="spacer" />
        <span className="badge src mono" style={{ fontSize: 8 }}>EN LIGNE</span>
      </div>
      <div className="chat">
        <div className="chat-body">
          <div className="rooms">
            {rooms.map((r) => (
              <div key={r.id} className={cls('room', room === r.id && 'active')} onClick={() => setRoom(r.id)}>
                <div style={{ minWidth: 0 }}>
                  <div className="room-name">{r.name}</div>
                  <div className="room-name" style={{ fontSize: 8, opacity: 0.6 }}>{r.desc}</div>
                </div>
                {unread[r.id] > 0 && room !== r.id && <span className="room-unread">{Math.min(9, unread[r.id])}</span>}
              </div>
            ))}
          </div>
          <div className="msgs" ref={listRef}>
            {roomMsgs.map((m) => (
              <div key={m.id} className={cls('msg', m.kind)}>
                <span className="who">{m.from}</span>
                <span className="txt">{m.text}</span>
              </div>
            ))}
            {!roomMsgs.length && <div className="empty">Pas de message</div>}
          </div>
        </div>
        <form className="chat-input" onSubmit={submit}>
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Écrire au desk…"
            maxLength={200}
            style={{ fontSize: 11, padding: '4px 7px' }}
          />
          <button className="btn tiny" type="submit" style={{ padding: '4px 9px' }}>↵</button>
        </form>
      </div>
    </div>
  );
}
