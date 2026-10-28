const us0 = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
const us2 = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const us3 = new Intl.NumberFormat('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
const us1 = new Intl.NumberFormat('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export const fmt0 = (v) => us0.format(Math.round(v ?? 0));
export const fmt1 = (v) => us1.format(v ?? 0);
export const fmt2 = (v) => us2.format(v ?? 0);
export const fmt3 = (v) => us3.format(v ?? 0);

/** AmplifyME P&L integer format: "106,820" or "-12,450" */
export const money = (v) => {
  const n = Math.round(v ?? 0);
  if (n === 0) return '0';
  return `${n < 0 ? '-' : ''}${us0.format(Math.abs(n))}`;
};

export const moneySign = (v) => {
  const n = Math.round(v ?? 0);
  if (n === 0) return '0';
  return `${n > 0 ? '+' : ''}${money(n)}`;
};

export const usd = (v) => {
  const n = Math.round(v ?? 0);
  return `${n < 0 ? '-$' : '$'}${us0.format(Math.abs(n))}`;
};

export const usdSign = (v) => {
  const n = Math.round(v ?? 0);
  if (n === 0) return '$0';
  return `${n > 0 ? '+$' : '-$'}${us0.format(Math.abs(n))}`;
};

/** Price with the exact AmplifyME decimals: BABA/MSFT 2dp, BP/HSBC/VW 3dp. */
export const price = (v, dp = 2) => {
  const x = Number(v ?? 0);
  if (!Number.isFinite(x)) return '0';
  return dp === 3 ? us3.format(x) : us2.format(x);
};

export const refPriceStr = (v, dp = 2) => `$ ${price(v, dp)}`;

export const num = (v, d = 2) =>
  new Intl.NumberFormat('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }).format(v ?? 0);

export const pct = (v, d = 2) => `${num(v, d)} %`;
export const pctSign = (v, d = 2) => `${(v ?? 0) > 0 ? '+' : ''}${num(v, d)} %`;
export const bps = (v) => `${(v ?? 0) > 0 ? '+' : ''}${num(v, 1)} bps`;

export const compact = (v) => {
  const n = Math.abs(v ?? 0);
  if (n >= 1e9) return `${fmt1(v / 1e9)}B`;
  if (n >= 1e6) return `${fmt1(v / 1e6)}M`;
  if (n >= 1e3) return `${us0.format(Math.round(v / 1e3))}k`;
  return us0.format(v ?? 0);
};

export const shares = (v) => us0.format(Math.round(v ?? 0));

export const cls = (...a) => a.filter(Boolean).join(' ');

/** AmplifyME P&L coloring: >0 green, <0 red, ===0 yellow */
export const signCls = (v) => {
  const n = Math.round(v ?? 0);
  if (n > 0) return 'pos';
  if (n < 0) return 'neg';
  return 'zero-val';
};

export const clockFromSim = (t, scale = 16) => {
  const total = Math.max(0, 13 * 3600 + Math.round(t * scale));
  const h = Math.floor(total / 3600) % 24;
  const m = Math.floor((total % 3600) / 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

export const mmss = (sec) => {
  const s = Math.max(0, Math.round(sec ?? 0));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};

export const priceDp = (ticker) => (ticker === 'BP' || ticker === 'HSBC' || ticker === 'VW' ? 3 : 2);
