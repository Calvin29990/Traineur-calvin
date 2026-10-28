export const GAUGE_DEFS = {
  IB: [
    { code: 'COMM', label: 'Commission', weight: 16, short: 'Commissions générées sur le flux client OTC.' },
    { code: 'FFC', label: 'Fat Finger Count', weight: 10, short: 'Précision des prix — 100 % = zéro erreur de saisie.' },
    { code: 'CT', label: 'Chat Trades', weight: 16, short: 'Volume et nombre de trades clients conclus.' },
    { code: 'SSRM', label: 'Sell-Side Risk Mgmt', weight: 16, short: 'Compétitivité des spreads autour du REFPRICE.' },
    { code: 'ETM', label: 'Exchange Trade Metrics', weight: 17, short: 'Discipline de couverture / débouclage.' },
    { code: 'PnL', label: 'Total P&L', weight: 25, short: 'Realised P+L + Unrealised P+L.' },
  ],
  AM: [
    { code: 'BSRM', label: 'Buy-Side Risk Mgmt', weight: 24, short: 'Cash, diversification, pas de sur-trading.' },
    { code: 'ES', label: 'Execution Score', weight: 18, short: 'Prix d’exécution face au REFPRICE.' },
    { code: 'FFC', label: 'Fat Finger Count', weight: 8, short: '100 % si zéro erreur d’exécution / taille.' },
    { code: 'RA', label: 'Risk Appetite', weight: 20, short: 'Cohérence du risque face aux news.' },
    { code: 'ROI', label: 'Return on Investment', weight: 30, short: 'Rendement généré sur les $20M.' },
  ],
};

export const UNIVERSE = [
  { ticker: 'BABA', price: '476.93', dp: 2, name: 'Alibaba' },
  { ticker: 'BP', price: '40.277', dp: 3, name: 'BP plc' },
  { ticker: 'HSBC', price: '47.839', dp: 3, name: 'HSBC' },
  { ticker: 'MSFT', price: '404.85', dp: 2, name: 'Microsoft' },
  { ticker: 'VW', price: '38.990', dp: 3, name: 'Volkswagen' },
];

export const LINKS = {
  github: 'https://github.com/Calvin29990/Traineur-calvin',
  render: 'https://tradelab-zlp6.onrender.com/',
  guide: '/guide-amplifyme-top1.pdf',
};

export const TOP1_TARGET = 90;
