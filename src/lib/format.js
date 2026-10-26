const nf0 = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });
const nf2 = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const nf1 = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export const fmt0 = (v) => nf0.format(v ?? 0);
export const fmt2 = (v) => nf2.format(v ?? 0);
export const fmt1 = (v) => nf1.format(v ?? 0);

/** montant avec séparateurs, sans devise */
export const money = (v) => {
  const n = Math.round(v ?? 0);
  return `${n < 0 ? '-' : ''}${nf0.format(Math.abs(n))}`;
};
export const moneySign = (v) => `${v > 0 ? '+' : ''}${money(v)}`;
export const usd = (v) => `${money(v)} $`;
export const usdSign = (v) => `${moneySign(v)} $`;
export const price = (v) => fmt2(v);

export const num = (v, d = 2) => new Intl.NumberFormat('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d }).format(v ?? 0);
export const pct = (v, d = 2) => `${v > 0 ? '+' : ''}${num(v, d)} %`;
export const bps = (v) => `${v > 0 ? '+' : ''}${num(v, 1)} bps`;

/** "45k", "1,2 M" */
export const compact = (v) => {
  const n = Math.abs(v ?? 0);
  if (n >= 1e9) return `${fmt1(v / 1e9)} Md`;
  if (n >= 1e6) return `${fmt1(v / 1e6)} M`;
  if (n >= 1e3) return `${nf0.format(Math.round(v / 1e3))}k`;
  return nf0.format(v);
};
export const notional = (v) => `${fmt1((v ?? 0) / 1e6)} M$`;
export const shares = (v) => `${nf0.format(v ?? 0)}`;

export const cls = (...a) => a.filter(Boolean).join(' ');
export const signCls = (v) => (v > 0 ? 'pos' : v < 0 ? 'neg' : 'neutral');

export const clockFromSim = (t) => {
  const base = 13 * 3600 + 2 * 60;
  const total = base + Math.round(t * 15);
  const h = Math.floor(total / 3600) % 24;
  const m = Math.floor((total % 3600) / 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

export const uuid = () => Math.random().toString(36).slice(2, 10);
