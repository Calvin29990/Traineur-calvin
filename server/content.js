// ---------------------------------------------------------------------------
// Content calibrated to the CFA Institute x AmplifyME Investing Simulator
// Challenge (FlowTrader IB-55 sell-side market maker + AM-55 $20M buy-side).
// Universe, official Round 1 / Round 2 press releases and desks are exact.
// ---------------------------------------------------------------------------

export const INSTRUMENTS = [
  { ticker: 'BABA', name: 'Alibaba Group Holding', sector: 'ECOMMERCE', type: 'Equity O', ref: 476.93, dp: 2, vol: 0.0022, beta: 1.25, baseDepth: 9000 },
  { ticker: 'BP', name: 'BP plc', sector: 'ENERGY', type: 'Equity O', ref: 40.277, dp: 3, vol: 0.0028, beta: 1.10, baseDepth: 42000 },
  { ticker: 'HSBC', name: 'HSBC Holdings plc', sector: 'BANKS', type: 'Equity O', ref: 47.839, dp: 3, vol: 0.0024, beta: 1.15, baseDepth: 40000 },
  { ticker: 'MSFT', name: 'Microsoft Corporation', sector: 'TECH', type: 'Equity O', ref: 404.85, dp: 2, vol: 0.0019, beta: 1.10, baseDepth: 12000 },
  { ticker: 'VW', name: 'Volkswagen AG', sector: 'AUTO', type: 'Equity O', ref: 38.990, dp: 3, vol: 0.0026, beta: 1.30, baseDepth: 45000 },
];

export const TICKERS = INSTRUMENTS.map((i) => i.ticker);

export const PACES = {
  express: { id: 'express', label: 'Express', seconds: 480, minutes: 8 },
  standard: { id: 'standard', label: 'Standard', seconds: 900, minutes: 15 },
  real: { id: 'real', label: 'Conditions réelles', seconds: 1800, minutes: 30 },
};

export const ROLE_BADGES = { IB: 'IB-55', AM: 'AM-55' };
export const ROLE_LABELS = {
  IB: { short: 'Investment Bank', title: 'Market Maker Sell-Side', sub: 'IB-55 · Market Maker Sell-Side' },
  AM: { short: 'Asset Manager', title: 'Portfolio Manager Buy-Side', sub: 'AM-55 · $20,000,000 Mandate' },
};

const M0 = { BABA: 0, BP: 0, HSBC: 0, MSFT: 0, VW: 0 };
const moves = (over = {}) => ({ ...M0, ...over });

// ---------------------------------------------------------------------------
// OFFICIAL ROUND 1 — exact press releases from the live AmplifyME session.
// `moves` = log-return impact applied to REFPRICE (hidden from the player).
// ---------------------------------------------------------------------------
export const OFFICIAL_ROUND_1 = [
  {
    kind: 'MACRO', ticker: 'MACRO', tone: 1,
    headline: 'MACRO: The Federal Reserve, US Central Bank, cut interest rates to 0% and relaunch quantitative easing',
    moves: moves({ BABA: 0.048, BP: 0.042, HSBC: 0.036, MSFT: 0.044, VW: 0.052 }),
    hint: 'Détente monétaire massive : risk-on général. Achetez le panier, surtout les cycliques (VW, BP, HSBC).',
  },
  {
    kind: 'STOCK', ticker: 'MSFT', tone: 1,
    headline: 'MSFT: Microsoft become the second company in history to reach a market cap of $1 trillion',
    moves: moves({ MSFT: 0.056, BABA: 0.008, BP: 0.002, HSBC: 0.002, VW: 0.003 }),
    hint: 'Momentum tech sur MSFT : le marché va chasser les offres. Relevez votre offer, gardez le bid serré.',
  },
  {
    kind: 'STOCK', ticker: 'VW', tone: -1,
    headline: 'VW: VW announce delays in the development of their all electric SUV',
    moves: moves({ VW: -0.052, BABA: -0.003, BP: -0.002, HSBC: -0.002, MSFT: -0.004 }),
    hint: 'News négative sur VW : les clients vendent. Achetez le bid à bon prix ou baissez votre fourchette.',
  },
  {
    kind: 'MACRO', ticker: 'MACRO', tone: 1,
    headline: "MACRO: Donald Trump tweets his approval of the Fed's latest stimulus plan",
    moves: moves({ BABA: 0.032, BP: 0.030, HSBC: 0.026, MSFT: 0.028, VW: 0.031 }),
    hint: 'Confirmation politique du stimulus : poursuite du rallye. Restez acheteur en AM.',
  },
  {
    kind: 'STOCK', ticker: 'HSBC', tone: -1,
    headline: 'HSBC: UK Government announces a one-off tax on bank profits',
    moves: moves({ HSBC: -0.058, BABA: -0.004, BP: -0.004, MSFT: -0.003, VW: -0.004 }),
    hint: 'Taxe exceptionnelle sur les banques : HSBC sous pression. Vendez / shortez HSBC.',
  },
  {
    kind: 'STOCK', ticker: 'BABA', tone: 1,
    headline: 'BABA: Alibaba wow the tech world by announcing the launch of their new smartphone AliPhone.',
    moves: moves({ BABA: 0.070, MSFT: -0.010, BP: 0.002, HSBC: 0.002, VW: 0.003 }),
    hint: 'Catalyseur produit majeur sur BABA. Attention : 10k titres ≈ 4,8 M$ de notionnel.',
  },
  {
    kind: 'NOTE', ticker: 'NOTE', tone: 0, halfway: true,
    headline: 'NOTE: We are now half way through Round 1, there are 15 minutes left of trading',
    moves: moves(),
    hint: 'Moitié du round : coupez les expositions non voulues et préparez la seconde moitié.',
  },
  {
    kind: 'STOCK', ticker: 'MSFT', tone: 1,
    headline: 'MSFT: Microsoft announce much better than expected earnings for Q1',
    moves: moves({ MSFT: 0.060, BABA: 0.006, BP: 0.002, HSBC: 0.002, VW: 0.003 }),
    hint: 'Beat earnings net sur MSFT : nouvelle jambe haussière. Ne restez pas short.',
  },
  {
    kind: 'STOCK', ticker: 'BP', tone: 1,
    headline: 'BP: OPEC increase their oil demand forecasts for this year and next year',
    moves: moves({ BP: 0.052, VW: 0.004, BABA: 0.002, HSBC: 0.002, MSFT: 0.002 }),
    hint: "Relevé de la demande pétrolière : BP profite du brut. Achetez BP en AM, relevez l'offer en IB.",
  },
  {
    kind: 'STOCK', ticker: 'VW', tone: -1,
    headline: 'VW: VW announce their Q2 earnings slightly below analyst expectations at $62bn',
    moves: moves({ VW: -0.038, BABA: -0.002, BP: -0.002, HSBC: -0.002, MSFT: -0.002 }),
    hint: 'Déception modérée sur les résultats VW : vendez le rebond, pas de panique.',
  },
  {
    kind: 'MACRO', ticker: 'MACRO', tone: 1,
    headline: 'MACRO: China announce better than expected economic data',
    moves: moves({ BABA: 0.044, BP: 0.022, HSBC: 0.014, MSFT: 0.012, VW: 0.018 }),
    hint: 'Données chinoises solides : BABA en première ligne, BP et VW en bénéficiaires indirects.',
  },
  {
    kind: 'MACRO', ticker: 'MACRO', tone: 1,
    headline: 'MACRO: Federal Reserve Chairman Jerome Powell urges US Government deliver a Fiscal Stimulus package',
    moves: moves({ BABA: 0.026, BP: 0.026, HSBC: 0.024, MSFT: 0.025, VW: 0.027 }),
    hint: 'Powell appelle au stimulus budgétaire : dernier catalyseur haussier du round. Restez long.',
  },
];

// ---------------------------------------------------------------------------
// OFFICIAL ROUND 2 — exact press releases from the live AmplifyME session.
// ---------------------------------------------------------------------------
export const OFFICIAL_ROUND_2 = [
  {
    kind: 'STOCK', ticker: 'HSBC', tone: -1,
    headline: 'HSBC: HSBC CEO resigns with immediate effect. UK Gov announces full enquiry...',
    moves: moves({ HSBC: -0.085, BABA: -0.006, BP: -0.005, MSFT: -0.005, VW: -0.006 }),
    hint: 'Choc de gouvernance HSBC : gap baissier violent. Coupez toute exposition acheteuse immédiatement.',
  },
  {
    kind: 'STOCK', ticker: 'MSFT', tone: 1,
    headline: "MSFT: Microsoft announce they are in final stages of purchasing TikTok's US operations",
    moves: moves({ MSFT: 0.075, BABA: -0.012, BP: 0.004, HSBC: 0.004, VW: 0.005 }),
    hint: 'M&A transformante pour MSFT (TikTok US) : forte hausse attendue, BABA sous pression.',
  },
  {
    kind: 'STOCK', ticker: 'VW', tone: 1,
    headline: 'VW: VW announce a new battery supplier to coincide with journalist publishing 5 star reviews for new SUV',
    moves: moves({ VW: 0.062, BABA: 0.003, BP: 0.003, HSBC: 0.003, MSFT: 0.003 }),
    hint: 'Double catalyseur VW (supply chain + demande). Flux acheteur massif attendu.',
  },
  {
    kind: 'MACRO', ticker: 'MACRO', tone: 1,
    headline: 'MACRO: US Government announce a record breaking $2 trillion economic rescue package',
    moves: moves({ BABA: 0.052, BP: 0.058, HSBC: 0.048, MSFT: 0.050, VW: 0.062 }),
    hint: 'Plan de sauvetage 2 000 Md$ : rallye général, cycliques et auto en tête.',
  },
  {
    kind: 'MACRO', ticker: 'MACRO', tone: 1,
    headline: "MACRO: US President Trump signals his approval of the Microsoft acquisition of TikTok's US operations",
    moves: moves({ MSFT: 0.050, BABA: 0.015, BP: 0.016, HSBC: 0.014, VW: 0.018 }),
    hint: 'Feu vert politique au deal MSFT/TikTok : MSFT surperforme, tech en général soutenue.',
  },
  {
    kind: 'STOCK', ticker: 'BABA', tone: -1,
    headline: 'BABA: Jack Ma, storms out of press conference after refusing to confirm a new AliPhone delivery date.',
    moves: moves({ BABA: -0.064, MSFT: 0.008, BP: -0.002, HSBC: -0.002, VW: -0.002 }),
    hint: 'Clash de gouvernance BABA : décote brutale. Shortez BABA en AM, élargissez votre bid en IB.',
  },
];

// ---------------------------------------------------------------------------
// DYNAMIC TRAINING POOL — additional realistic wire stories for varied reps.
// ---------------------------------------------------------------------------
export const DYNAMIC_NEWS = [
  {
    kind: 'STOCK', ticker: 'MSFT', tone: 1,
    headline: 'MSFT: Azure AI revenue accelerates 41% as enterprise Copilot seats double year-on-year',
    moves: moves({ MSFT: 0.064, BABA: 0.010, BP: 0.002, HSBC: 0.002, VW: 0.003 }),
    hint: 'Surprise positive sur le cloud IA : MSFT haussier, léger effet halo sur BABA.',
  },
  {
    kind: 'STOCK', ticker: 'MSFT', tone: -1,
    headline: 'MSFT: EU regulators open formal antitrust probe into Microsoft Teams and Azure bundling',
    moves: moves({ MSFT: -0.072, BABA: -0.008, BP: -0.003, HSBC: -0.003, VW: -0.004 }),
    hint: 'Risque réglementaire : MSFT baissier, prudence sur tout le tech.',
  },
  {
    kind: 'STOCK', ticker: 'MSFT', tone: 1,
    headline: 'MSFT: Microsoft raises quarterly dividend 12% and unveils $60bn buyback programme',
    moves: moves({ MSFT: 0.041, BABA: 0.004, BP: 0.002, HSBC: 0.002, VW: 0.002 }),
    hint: 'Retour aux actionnaires : soutien du cours MSFT, move plus modéré.',
  },
  {
    kind: 'STOCK', ticker: 'BP', tone: -1,
    headline: 'BP: North Sea pipeline leak forces production halt, clean-up provision estimated at $2.8bn',
    moves: moves({ BP: -0.078, VW: -0.004, BABA: -0.003, HSBC: -0.003, MSFT: -0.002 }),
    hint: 'Risque opérationnel BP : forte baisse, provision exceptionnelle.',
  },
  {
    kind: 'STOCK', ticker: 'BP', tone: 1,
    headline: 'BP: record refining margins prompts $3.5bn buyback and 20% dividend increase',
    moves: moves({ BP: 0.068, VW: 0.004, BABA: 0.003, HSBC: 0.003, MSFT: 0.002 }),
    hint: 'Cash return massif BP : haussier, les clients vont acheter du volume.',
  },
  {
    kind: 'STOCK', ticker: 'HSBC', tone: 1,
    headline: 'HSBC: record $4bn share buyback and special dividend after Asian wealth surge',
    moves: moves({ HSBC: 0.061, BABA: 0.004, BP: 0.003, MSFT: 0.002, VW: 0.003 }),
    hint: 'Rachat d’actions surprise HSBC : haussier, spread à resserrer à l’achat.',
  },
  {
    kind: 'STOCK', ticker: 'HSBC', tone: -1,
    headline: 'HSBC: provisions surge on Chinese commercial property exposure, CET1 falls below target',
    moves: moves({ HSBC: -0.069, BABA: -0.010, BP: -0.004, MSFT: -0.003, VW: -0.004 }),
    hint: 'Qualité de crédit dégradée : HSBC et BABA baissiers.',
  },
  {
    kind: 'STOCK', ticker: 'BABA', tone: 1,
    headline: "BABA: Singles' Day GMV smashes record at $84bn as international commerce jumps 38%",
    moves: moves({ BABA: 0.082, MSFT: -0.004, BP: 0.003, HSBC: 0.003, VW: 0.003 }),
    hint: 'Record Singles’ Day : BABA très haussier, forte demande de blocs.',
  },
  {
    kind: 'STOCK', ticker: 'BABA', tone: -1,
    headline: 'BABA: Chinese regulator opens new anti-monopoly investigation into platform fees',
    moves: moves({ BABA: -0.074, MSFT: -0.004, BP: -0.003, HSBC: -0.003, VW: -0.003 }),
    hint: 'Risque réglementaire chinois : BABA baissier, attendez-vous à des ventes de blocs.',
  },
  {
    kind: 'STOCK', ticker: 'VW', tone: -1,
    headline: 'VW: recall of 120,000 electric SUVs after battery software fault; deliveries delayed',
    moves: moves({ VW: -0.066, BABA: -0.004, BP: -0.003, HSBC: -0.003, MSFT: -0.003 }),
    hint: 'Rappel produit VW : baissier, la news domine le carnet.',
  },
  {
    kind: 'STOCK', ticker: 'VW', tone: 1,
    headline: 'VW: China joint-venture sales jump 24% and EV order book reaches all-time high',
    moves: moves({ VW: 0.057, BABA: 0.008, BP: 0.003, HSBC: 0.003, MSFT: 0.002 }),
    hint: 'Momentum commercial VW : haussier, soutenu par la Chine.',
  },
  {
    kind: 'MACRO', ticker: 'MACRO', tone: -1,
    headline: 'MACRO: US core CPI surprises at 4.3% and the Fed signals rates stay higher for longer',
    moves: moves({ BABA: -0.048, BP: -0.034, HSBC: -0.030, MSFT: -0.046, VW: -0.052 }),
    hint: 'Choc de taux hawkish : risk-off généralisé, les valeurs de croissance souffrent le plus.',
  },
  {
    kind: 'MACRO', ticker: 'MACRO', tone: 1,
    headline: 'MACRO: US Non-Farm Payrolls beat at +285k while wage inflation cools to 2.9%',
    moves: moves({ BABA: 0.038, BP: 0.040, HSBC: 0.034, MSFT: 0.036, VW: 0.042 }),
    hint: 'Goldilocks : croissance solide, inflation maîtrisée. Achetez le marché.',
  },
  {
    kind: 'MACRO', ticker: 'MACRO', tone: -1,
    headline: 'MACRO: global trade summit collapses, 25% retaliatory tariffs announced on autos and tech',
    moves: moves({ BABA: -0.058, BP: -0.030, HSBC: -0.028, MSFT: -0.052, VW: -0.068 }),
    hint: 'Guerre commerciale : VW, BABA et MSFT en première ligne. Réduisez le risque.',
  },
  {
    kind: 'MACRO', ticker: 'MACRO', tone: 1,
    headline: 'MACRO: ECB delivers surprise 50bp cut and launches a new corporate bond purchase programme',
    moves: moves({ BABA: 0.035, BP: 0.030, HSBC: 0.036, MSFT: 0.033, VW: 0.046 }),
    hint: 'Détente BCE : banques et auto européennes surperforment.',
  },
  {
    kind: 'MACRO', ticker: 'MACRO', tone: -1,
    headline: 'MACRO: Brent crude spikes above $110/bbl after Middle East supply disruption',
    moves: moves({ BABA: -0.024, BP: 0.055, HSBC: -0.012, MSFT: -0.022, VW: -0.040 }),
    hint: 'Choc pétrolier : BP bénéficiaire, VW et BABA pénalisés par les coûts.',
  },
  {
    kind: 'MACRO', ticker: 'MACRO', tone: 1,
    headline: 'MACRO: US and China sign a Phase-One trade truce, removing tariffs on $300bn of goods',
    moves: moves({ BABA: 0.066, BP: 0.030, HSBC: 0.028, MSFT: 0.040, VW: 0.050 }),
    hint: 'Détente commerciale : rallye général, BABA et VW les plus sensibles.',
  },
  {
    kind: 'MACRO', ticker: 'MACRO', tone: -1,
    headline: 'MACRO: IMF cuts global growth forecast and warns of a synchronised recession in 2026',
    moves: moves({ BABA: -0.044, BP: -0.038, HSBC: -0.032, MSFT: -0.038, VW: -0.048 }),
    hint: 'Alerte récession : risk-off, réduisez l’exposition brute.',
  },
];

// All official + dynamic stories for the "Mode Entraînement Dynamique"
export const ALL_NEWS = [...OFFICIAL_ROUND_1, ...OFFICIAL_ROUND_2, ...DYNAMIC_NEWS];

// ---------------------------------------------------------------------------
// IB clients — exact AmplifyME naming (NAME | TEAM)
// ---------------------------------------------------------------------------
export const IB_CLIENTS = [
  {
    id: 'am2', name: 'Aaron', team: 'AM-2', arch: 'AM', archLabel: 'Asset Manager',
    phone: '44 20 7946 0221', informedness: 0.22, aggression: 0.72,
    notionalPref: [1800000, 2400000, 3200000], color: '#3fb6ff',
    note: 'Gérant actions long-only : envoie de gros blocs de réallocation. Sensible au spread.',
  },
  {
    id: 'am28', name: 'akshay', team: 'AM-28', arch: 'AM', archLabel: 'Asset Manager',
    phone: '44 20 7946 0288', informedness: 0.18, aggression: 0.66,
    notionalPref: [900000, 1400000, 2000000], color: '#59d7a3',
    note: 'Mandat équilibré, tickets moyens. Répond très bien aux relances commerciales.',
  },
  {
    id: 'hf4', name: 'Sophie', team: 'HF-4', arch: 'HF', archLabel: 'Hedge Fund',
    phone: '44 20 7946 0410', informedness: 0.48, aggression: 0.90,
    notionalPref: [2200000, 2800000, 3600000], color: '#f1a33c',
    note: 'Flux directionnel rapide post-news. Très dangereux si votre quote traîne.',
  },
  {
    id: 'hf11', name: 'Liam', team: 'HF-11', arch: 'HF', archLabel: 'Hedge Fund',
    phone: '44 20 7946 0411', informedness: 0.44, aggression: 0.86,
    notionalPref: [1600000, 2200000, 2800000], color: '#d984ff',
    note: 'Chasse les annonces MACRO et les cassures. Compare votre spread à l’Exchange.',
  },
  {
    id: 'am7', name: 'Mei', team: 'AM-7', arch: 'AM', archLabel: 'Asset Manager',
    phone: '44 20 7946 0207', informedness: 0.15, aggression: 0.58,
    notionalPref: [1400000, 2000000, 2600000], color: '#58c8e0',
    note: 'Flux institutionnel régulier. Excellente source de commissions.',
  },
  {
    id: 'hf19', name: 'Diego', team: 'HF-19', arch: 'HF', archLabel: 'Hedge Fund',
    phone: '44 20 7946 0419', informedness: 0.40, aggression: 0.82,
    notionalPref: [1200000, 1800000, 2400000], color: '#ff8a8a',
    note: 'Multi-strategy, tickets moyens. Teste vos prix sur les deux côtés.',
  },
];

// Dealer banks when the player is AM-55
export const AM_DEALERS = [
  {
    id: 'ib2', name: 'IB-2', team: 'IB-2', phone: '44 20 7946 0102', color: '#3fb6ff',
    specialty: ['MSFT', 'BABA'], baseHalfBps: 15, speedSec: [1.2, 2.6], reliability: 0.94,
    note: 'Spécialiste Tech US/Asie (MSFT, BABA). Fourchette la plus serrée sur les blocs tech.',
  },
  {
    id: 'ib14', name: 'IB-14', team: 'IB-14', phone: '44 20 7946 0114', color: '#59d7a3',
    specialty: ['BP', 'VW'], baseHalfBps: 17, speedSec: [1.4, 3.0], reliability: 0.92,
    note: 'Leader Énergie & Auto européen (BP, VW). Absorbe les gros blocs sans décaler ses prix.',
  },
  {
    id: 'ib28', name: 'IB-28', team: 'IB-28', phone: '44 20 7946 0128', color: '#f1a33c',
    specialty: ['HSBC', 'MSFT'], baseHalfBps: 18, speedSec: [1.1, 2.5], reliability: 0.95,
    note: 'Banques & Mega-cap tech (HSBC, MSFT). Répond vite, spread variable.',
  },
  {
    id: 'ib41', name: 'IB-41', team: 'IB-41', phone: '44 20 7946 0141', color: '#d984ff',
    specialty: ['VW', 'BABA'], baseHalfBps: 19, speedSec: [1.5, 3.2], reliability: 0.90,
    note: 'Desk européen & Asie (VW, BABA). Bon en VW, plus large en BABA.',
  },
  {
    id: 'ib57', name: 'IB-57', team: 'IB-57', phone: '44 20 7946 0157', color: '#ff8a8a',
    specialty: ['HSBC', 'BP'], baseHalfBps: 20, speedSec: [1.3, 2.8], reliability: 0.93,
    note: 'Banks & Energy (HSBC, BP). Alternative crédible pour la mise en concurrence.',
  },
];

export const DESK_TRADERS = ['IB2-Desk', 'IB14-Desk', 'HF4-Sales', 'FLOW-DESK', 'RISK-MGR', 'MARKET-OPS', 'AM28-Desk'];

export const DEAL_ROOM_LINES = [
  'Anyone seeing big two-way flow in {t}? Exchange depth is thinning out.',
  'Watch {t} — clients are asking for 50k clips back-to-back.',
  'Remember to pull old live quotes before macro headlines drop!',
  '{t} moving fast off the wire, don’t get picked off on stale offers.',
  'Unwinding {t} in 10k clips on the Exchange to save market impact.',
  'Tight quotes win the AM block flow — commissions are adding up nicely.',
  'Anyone long {t} here? Momentum looks strong on the 15min chart.',
  'Keep an eye on single-stock risk limits into the final minute.',
  'Coffee run before the next print? Floor is loud today.',
  'MSFT paper is bid all morning. Watch the offer side.',
  '{t} depth check: 25k clips are the sweet spot right now.',
];

export const CLIENT_MESSAGE_TEMPLATES = [
  '{ticker} {k}k plz',
  '{tickerLower} {k}k',
  'Buy price for {ticker} please',
  'Sell price for {ticker} please',
  'Need {ticker} {k}k two-way',
  '{ticker} {k}k pls, quick',
  'Can you make me {k}k {ticker}?',
  'Looking for {k}k {ticker} — price?',
  '{ticker} {k}k plz — need it now',
  'Two-way on {k}k {ticker} please',
];

export const CLIENT_REPLIES = [
  'Thanks — working the order now.',
  'Copy that, standing by.',
  'Appreciate the live market.',
  'Sending more flow your way if the price holds.',
  'That works. Keep me posted on the wire.',
  'Seen. I’ll come back to you.',
];

export const AM_ROOM_LINES = [
  'Just added 2% MSFT after that cloud print. Any better offers out there?',
  'Anyone else worried about the HSBC governance story?',
  'I’m keeping 12% cash — this tape is too headline-driven.',
  'Shopping three dealers on BP blocks before hitting any bid.',
  'VW looks cheap if the battery headline is confirmed.',
  'BABA is a headline machine today, size carefully.',
  'The $20M mandate is fully invested here. Risk budget is the constraint.',
  'Reminder: dealer quotes need to be shopped, the Exchange is too wide.',
];

export const DEALER_CHATTER = [
  'Desk is open — send your axes over.',
  'We are tight on {t} this morning, happy to show a market.',
  'Flow is two-way in {t}, come to us first.',
  'Just printed a 50k block in {t}. Market has moved.',
  'We can warehouse size on {t} if you need a clean exit.',
  'Quotes valid 30 seconds, give us a shout.',
];

export const BOT_NAMES = [
  'A. Devidal', 'I. Timson-Smidt', 'C. Faergemann', 'T. Köhler', 'J. Mak',
  'L. Chen', 'S. Okafor', 'M. Rossi', 'J. Karlsson', 'D. Nakamura',
  'P. Dubois', 'R. Silva', 'T. Novak', 'K. Haddad', 'E. Larsson',
  'N. Petrov', 'V. Garcia', 'H. Tanaka', 'F. Girard', "B. O'Neill",
  'A. Moreau', 'Y. Lyu', 'A. Sheikh', 'M. Al-Mansoor',
];

export const BOT_FIRMS = [
  'HEC Paris', 'LSE', 'EDHEC', 'Bocconi', 'NUS Singapore',
  'Imperial College', 'Wharton', 'Oxford Saïd', 'ESSEC', 'HKUST',
  'ETH Zürich', 'McGill', 'Rotman', 'Warwick', 'Sciences Po', 'Polytechnique',
];

// French scoring definitions used by the UI coach and the PDF guide.
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
