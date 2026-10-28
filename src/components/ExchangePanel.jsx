import React, { useEffect, useState } from 'react';
import { cls, money, price, shares, usd } from '../lib/format.js';

export default function ExchangePanel({ state, send, selectedTicker, onSelectTicker }) {
  const role = state?.role ?? 'IB';
  const equities = state?.equities ?? [];
  const [ticker, setTicker] = useState(selectedTicker || 'MSFT');
  const [qty, setQty] = useState('10000');
  const depth = state?.depth && state.depth.ticker === ticker ? state.depth : null;
  const eq = equities.find((e) => e.ticker === ticker) || equities[0];
  const dp = eq?.dp ?? 2;
  const pos = state?.positions?.find((p) => p.ticker === ticker);

  useEffect(() => {
    if (selectedTicker && selectedTicker !== ticker) setTicker(selectedTicker);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTicker]);

  const checkDepth = () => {
    const q = Math.round(Number(qty));
    if (!q || q <= 0) return;
    send({ type: 'depth', ticker, qty: q });
  };

  const trade = (side) => {
    const q = Math.round(Number(qty));
    if (!q || q <= 0) return;
    send({ type: 'trade', ticker, side, qty: q });
    // refresh the book so NOTIONAL / COMMISSION reflect the post-trade price
    send({ type: 'depth', ticker, qty: q });
  };

  const approxNotional = depth?.notional ?? Math.round((Number(qty) || 0) * (eq?.last ?? 0));
  const approxFee = depth?.commission ?? Math.round(approxNotional * (role === 'IB' ? 0.0002 : 0.0008));

  return (
    <section className="panel area-exchange">
      <div className="panel-head">
        <span className="panel-tab active">EXCHANGE</span>
        <span className="panel-meta mono">{role === 'AM' ? 'WIDER THAN IB QUOTES' : 'PUBLIC BOOK'}</span>
      </div>

      <div className="exchange-body">
        <label className="field tight">
          <span>Ticker</span>
          <select value={ticker} onChange={(e) => { setTicker(e.target.value); onSelectTicker?.(e.target.value); }}>
            {equities.map((e) => <option key={e.ticker} value={e.ticker}>{e.ticker}</option>)}
          </select>
        </label>

        <label className="field depth-field">
          <span>Type volume to check market depth and press Enter</span>
          <div className="depth-input">
            <input
              value={qty}
              onChange={(e) => setQty(e.target.value.replace(/[^\d]/g, ''))}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); checkDepth(); } }}
              inputMode="numeric"
              aria-label="Volume for market depth"
            />
            <button type="button" className="enter-btn" onClick={checkDepth} title="Check market depth">↵</button>
          </div>
        </label>

        <div className={cls('depth-card', depth && 'live')}>
          <div className="depth-head">
            <span>MARKET DEPTH</span>
            <span className="mono">{depth ? `${depth.halfSpreadBps} bps half-spread` : 'Press ↵ to quote'}</span>
          </div>
          <div className="depth-prices">
            <div className="sell-side">
              <span>SELL</span>
              <b className="mono">{depth ? price(depth.sellPrice, dp) : price(eq?.bid ?? 0, dp)}</b>
            </div>
            <div className="buy-side">
              <span>BUY</span>
              <b className="mono">{depth ? price(depth.buyPrice, dp) : price(eq?.offer ?? 0, dp)}</b>
            </div>
          </div>
          <div className="depth-meta">
            <div><span>NOTIONAL VALUE</span><b className="mono">{usd(approxNotional)}</b></div>
            <div><span>COMMISSION</span><b className="mono">{money(approxFee)}</b></div>
          </div>
        </div>

        <div className="exchange-actions">
          <button type="button" className="ex-btn sell" onClick={() => trade('SELL')} disabled={!Number(qty)}>
            SELL <span>{shares(Number(qty) || 0)}</span>
          </button>
          <button type="button" className="ex-btn buy" onClick={() => trade('BUY')} disabled={!Number(qty)}>
            BUY <span>{shares(Number(qty) || 0)}</span>
          </button>
        </div>

        <div className="exchange-foot">
          <div className="pos-mini">
            <span>POS {ticker}</span>
            <b className={cls('mono', (pos?.qty ?? 0) > 0 ? 'pos' : (pos?.qty ?? 0) < 0 ? 'neg' : '')}>{shares(pos?.qty ?? 0)}</b>
          </div>
          <button type="button" className="mini-btn" onClick={() => send({ type: 'hedge', ticker })} title="Unwind 50% of this position in one clip">
            HEDGE
          </button>
          <button type="button" className="mini-btn danger" onClick={() => send({ type: 'flatten' })} title="Flatten every open position">
            FLATTEN
          </button>
        </div>
        <div className="exchange-hint">
          {role === 'IB'
            ? 'Débouclez par clips de 5k–10k : un bloc de 60k coûte beaucoup plus cher en impact.'
            : 'L’Exchange est plus large que les quotes IB : shoppez les dealers pour les blocs.'}
        </div>
      </div>
    </section>
  );
}
