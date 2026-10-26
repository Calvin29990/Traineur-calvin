// ---------------------------------------------------------------------------
// Universe & Content calibrated to the CFA Institute x AmplifyME
// Investing Simulator Challenge (FlowTrader IB + $20M Asset Manager).
// ---------------------------------------------------------------------------

export const INSTRUMENTS = [
  { ticker: 'BABA', name: 'Alibaba Group Holding', sector: 'ECOMMERCE', type: 'Equity O', ref: 474.10, vol: 0.0022, beta: 1.25, tick: 0.01, baseDepth: 12000 },
  { ticker: 'MSFT', name: 'Microsoft Corporation', sector: 'TECH', type: 'Equity O', ref: 404.45, vol: 0.0019, beta: 1.10, tick: 0.01, baseDepth: 15000 },
  { ticker: 'VW', name: 'Volkswagen AG', sector: 'AUTO', type: 'Equity O', ref: 38.65, vol: 0.0025, beta: 1.30, tick: 0.001, baseDepth: 45000 },
  { ticker: 'HSBC', name: 'HSBC Holdings plc', sector: 'BANKS', type: 'Equity O', ref: 50.64, vol: 0.0024, beta: 1.15, tick: 0.001, baseDepth: 45000 },
  { ticker: 'BP', name: 'BP plc', sector: 'ENERGY', type: 'Equity O', ref: 40.10, vol: 0.0028, beta: 1.10, tick: 0.001, baseDepth: 50000 },
  { ticker: 'DB', name: 'Deutsche Bank AG', sector: 'BANKS', type: 'Equity O', ref: 28.44, vol: 0.0030, beta: 1.40, tick: 0.001, baseDepth: 55000 },
];

// Realistic AmplifyME-style breaking headlines (meaningful % moves so dollar spreads & unwinding matter)
export const STOCK_NEWS = [
  {
    ticker: 'MSFT', move: 0.115,
    headline: "Microsoft announce they are in final stages of purchasing TikTok's US operations",
    detail: "Microsoft's board confirmed advanced exclusivity talks to acquire TikTok's North American business, creating a high-growth consumer ad platform alongside Azure cloud.",
    frHint: "Haussier fort sur MSFT (+11 % cible) : achetez MSFT en AM ; en IB, relevez immédiatement bid/offer et tirez vos anciennes quotes.",
  },
  {
    ticker: 'MSFT', move: -0.082,
    headline: 'US DOJ & EU Regulators open joint antitrust investigation into Microsoft enterprise cloud bundling',
    detail: 'Competition authorities announced formal proceedings into enterprise cloud licensing practices, raising potential remedies and fine exposure.',
    frHint: 'Baissier sur MSFT (-8 %) : vendez/allégez MSFT en AM ; en IB, abaissez votre fourchette bid/offer.',
  },
  {
    ticker: 'VW', move: 0.135,
    headline: 'VW announce a new battery supplier to coincide with journalist publishing 5 star reviews for new SUV',
    detail: 'Volkswagen secured long-term solid-state battery supply ahead of schedule while automotive press awarded unanimous 5-star ratings to its flagship electric SUV.',
    frHint: 'Haussier fort sur VW (+13 %) : catalyseur double (supply chain + demande SUV). Flux acheteur massif attendu.',
  },
  {
    ticker: 'VW', move: -0.105,
    headline: 'VW issues profit warning as semiconductor shortage forces 18% cut to European Q4 production',
    detail: 'Management lowered full-year operating margin guidance by 150 bps following unexpected supply bottlenecks at two tier-1 chip suppliers.',
    frHint: 'Baissier marqué sur VW (-10 %) : les clients HF vont vendre agressivement.',
  },
  {
    ticker: 'HSBC', move: -0.145,
    headline: 'HSBC CEO resigns with immediate effect, UK Gov announces full enquiry into money laundering scandal',
    detail: 'The Board confirmed the immediate departure of the Group CEO as UK authorities launched a statutory inquiry into historical compliance failures.',
    frHint: 'Choc baissier majeur sur HSBC (-14 %) : coupez immédiatement toute exposition acheteuse et passez short en AM.',
  },
  {
    ticker: 'HSBC', move: 0.095,
    headline: 'HSBC announces record $4bn share buyback and special dividend after Asian wealth surge',
    detail: 'Net interest income and Hong Kong wealth management fees beat consensus by 16%, lifting CET1 capital well above target.',
    frHint: 'Haussier sur HSBC (+9,5 %) : rachat massif d’actions et surprise positive sur les résultats.',
  },
  {
    ticker: 'BP', move: 0.155,
    headline: 'BP reports record refining margins and unveils major Gulf of Mexico high-margin oil discovery',
    detail: 'Quarterly cash flow beat expectations by 24% alongside confirmation of a 1.2 billion barrel recoverable reserve discovery and accelerated buybacks.',
    frHint: 'Haussier majeur sur BP (+15 %) : forte revalorisation, attendez-vous à des demandes de 50k+ titres sur BP.',
  },
  {
    ticker: 'BP', move: -0.115,
    headline: 'BP halts flagship North Sea platform after pipeline leak; clean-up provisions estimated at $2.8bn',
    detail: 'Offshore operations representing 8% of upstream output have been suspended pending regulatory safety clearance.',
    frHint: 'Baissier fort sur BP (-11,5 %) : risque opérationnel et provision immédiate.',
  },
  {
    ticker: 'BABA', move: 0.108,
    headline: 'Alibaba Cloud unveils flagship enterprise AI chips and reports 38% surge in international commerce',
    detail: 'Institutional brokers upgraded BABA across the board following triple-digit AI cloud backlog growth and stronger domestic merchant monetization.',
    frHint: 'Haussier sur BABA (+11 %) : attention au prix unitaire élevé (~480$), 10 000 titres = 4,8 M$ de notionnel !',
  },
  {
    ticker: 'BABA', move: -0.098,
    headline: 'New semiconductor export controls restrict advanced AI accelerator shipments to Chinese cloud providers',
    detail: 'Updated trade restrictions tighten access to high-bandwidth memory and server GPUs, pressuring medium-term cloud growth estimates.',
    frHint: 'Baissier sur BABA (-10 %) : réduisez rapidement la taille cotée à l’achat.',
  },
  {
    ticker: 'DB', move: 0.122,
    headline: 'Deutsche Bank crushes FIC trading estimates and raises RoTE target with €2.5bn capital return plan',
    detail: 'Fixed Income & Currencies revenue jumped 29% YoY while restructuring costs came in €600m below plan.',
    frHint: 'Haussier fort sur DB (+12 %) : petit prix facial (~28$), les volumes clients montent vite à 75k-100k titres.',
  },
  {
    ticker: 'DB', move: -0.118,
    headline: 'BaFin orders special audit at Deutsche Bank over derivatives valuation controls; €900m provision booked',
    detail: 'Regulators appointed an independent monitor and required additional capital buffers until remediation is completed.',
    frHint: 'Baissier fort sur DB (-12 %) : vendez le rebond ou élargissez fortement le bid.',
  },
  {
    ticker: 'MSFT', move: 0.068,
    headline: 'Microsoft wins $10bn Pentagon & sovereign cloud infrastructure mandate ahead of rivals',
    detail: 'Multi-year contract expands high-margin Intelligent Cloud recurring revenue visibility over five years.',
    frHint: 'Haussier modéré sur MSFT (+6,8 %).',
  },
  {
    ticker: 'BP', move: 0.078,
    headline: 'OPEC+ announces surprise 1.5m bpd production cut, sending Brent crude above $92/bbl',
    detail: 'Integrated oil majors rally sharply as upstream cash flow forecasts are revised higher across the energy sector.',
    frHint: 'Haussier sur BP (+7,8 %) via la flambée du brut.',
  },
  {
    ticker: 'BABA', move: 0.074,
    headline: 'Beijing announces targeted consumer stimulus vouchers and reiterates support for platform tech champions',
    detail: 'Domestic e-commerce GMV projections lifted by 400 bps for the upcoming holiday quarter.',
    frHint: 'Haussier sur BABA (+7,4 %).',
  },
  {
    ticker: 'VW', move: 0.065,
    headline: 'European EV fleet tax incentives extended by three years; VW order book jumps 24%',
    detail: ' Fleet managers accelerated electric transition orders across Germany, France, and the UK.',
    frHint: 'Haussier sur VW (+6,5 %).',
  },
];

// Macro news impacting all equities by sector sensitivity
export const MACRO_NEWS = [
  {
    tone: 1, size: 0.072,
    headline: 'US Government announce a record breaking $2 trillion economic rescue package',
    detail: 'Bipartisan fiscal stimulus package includes infrastructure, clean energy, and corporate liquidity support, sparking a broad risk-on rally across global equities.',
    sectorBoost: { BANKS: 1.25, AUTO: 1.3, ENERGY: 1.2, TECH: 1.0, ECOMMERCE: 1.05 },
    frHint: 'MACRO TRÈS HAUSSIÈRE : tout le marché monte, surtout les cycliques, banques et énergie !',
  },
  {
    tone: 1, size: 0.055,
    headline: "US President signals his approval of cross-border tech M&A including Microsoft's TikTok deal",
    detail: 'Constructive trade and regulatory remarks from Washington eased geopolitical risk premia, boosting global technology and e-commerce leaders.',
    sectorBoost: { TECH: 1.65, ECOMMERCE: 1.45, BANKS: 0.8, AUTO: 0.85, ENERGY: 0.7 },
    frHint: 'MACRO HAUSSIÈRE TECH : MSFT et BABA surperforment nettement le reste de la cote.',
  },
  {
    tone: -1, size: 0.068,
    headline: 'Federal Reserve delivers hawkish shock, signalling emergency 50 bps rate hike after hot CPI print',
    detail: 'Core inflation unexpectedly accelerated to 4.3% YoY, prompting FOMC officials to warn rates will stay restrictive for longer.',
    sectorBoost: { TECH: 1.35, ECOMMERCE: 1.25, AUTO: 1.2, BANKS: 0.75, ENERGY: 0.85 },
    frHint: 'MACRO BAISSIÈRE : choc de taux, les valeurs tech/croissance et cycliques reculent fortement.',
  },
  {
    tone: 1, size: 0.058,
    headline: 'Federal Reserve announces surprise 50 bps rate cut and liquidity backstop to support global growth',
    detail: 'Central bank pivot drives sharp compression in yields and broad institutional inflows into global equities.',
    sectorBoost: { TECH: 1.3, ECOMMERCE: 1.25, AUTO: 1.2, BANKS: 1.1, ENERGY: 1.0 },
    frHint: 'MACRO HAUSSIÈRE : baisse des taux surprise, achetez le panier actions.',
  },
  {
    tone: -1, size: 0.062,
    headline: 'Global trade summit collapses without agreement; 25% retaliatory tariffs announced on autos and tech',
    detail: 'Cross-border supply chains face immediate tariff surcharges starting next quarter, weighing heavily on exporters.',
    sectorBoost: { AUTO: 1.55, ECOMMERCE: 1.4, TECH: 1.25, BANKS: 1.0, ENERGY: 0.9 },
    frHint: 'MACRO BAISSIÈRE : VW, BABA et MSFT sont en première ligne sur les droits de douane.',
  },
  {
    tone: 1, size: 0.048,
    headline: 'US Non-Farm Payrolls beat expectations (+285k) while wage inflation cools to 2.9% — goldilocks print',
    detail: 'Soft-landing macro data boosts institutional risk appetite across US, European, and Asian equities.',
    sectorBoost: { BANKS: 1.2, AUTO: 1.15, TECH: 1.15, ENERGY: 1.1, ECOMMERCE: 1.1 },
    frHint: 'MACRO HAUSSIÈRE (« Goldilocks ») : croissance solide sans inflation.',
  },
];

// Counterparties when player is IB 1 (Sell-Side Market Maker / Sales Trader)
export const IB_CLIENT_ROOMS = [
  {
    roomId: 'hf1test1', team: 'HF 1', traderCode: 'HF1-1', phone: '123 4567 89 00',
    arch: 'HF', label: 'Hedge Fund Alpha', informedness: 0.58, aggression: 0.92,
    notionalPref: [1600000, 2200000, 2800000],
    note: 'Flux directionnel rapide post-news. Très réactif mais dangereux si votre quote traîne.',
  },
  {
    roomId: 'hf2test1', team: 'HF 2', traderCode: 'HF2-1', phone: '123 4567 89 01',
    arch: 'HF', label: 'Macro Momentum HF', informedness: 0.48, aggression: 0.88,
    notionalPref: [1400000, 2000000, 2600000],
    note: 'Chasse les annonces MACRO et les cassures de prix. Compare votre spread à la Bourse.',
  },
  {
    roomId: 'hf3test1', team: 'HF 3', traderCode: 'HF3-1', phone: '123 4567 89 02',
    arch: 'PROP', label: 'Multi-Strategy HF', informedness: 0.35, aggression: 0.85,
    notionalPref: [1200000, 1800000, 2400000],
    note: 'Actif fréquemment sur des tailles moyennes. Sensible à la compétitivité du spread.',
  },
  {
    roomId: 'am1test1', team: 'AM 1', traderCode: 'AM1-1', phone: '123 4567 89 10',
    arch: 'AM', label: 'Global Pension AM', informedness: 0.16, aggression: 0.78,
    notionalPref: [1800000, 2500000, 3200000],
    note: 'Gros blocs de réallocation peu informés : excellente source de spread et de commissions !',
  },
  {
    roomId: 'am2test1', team: 'AM 2', traderCode: 'AM2-1', phone: '123 4567 89 11',
    arch: 'AM', label: 'Sovereign Equity AM', informedness: 0.18, aggression: 0.76,
    notionalPref: [1600000, 2400000, 3000000],
    note: 'Flux institutionnel régulier. Répond très bien aux relances commerciales dans le chat.',
  },
];

// Counterparties when player is AM 1 (Buy-Side $20M Asset Manager)
export const AM_DEALER_ROOMS = [
  {
    roomId: 'ib1test1', team: 'IB 1', traderCode: 'IB1-1', phone: '44 20 7946 0101',
    specialty: ['MSFT', 'BABA'], baseHalfBps: 65, speedSec: [1.2, 2.4],
    note: 'Spécialiste Tech & US/Asia (MSFT, BABA). Spreads blocs 2x plus serrés que l’Exchange.',
  },
  {
    roomId: 'ib2test1', team: 'IB 2', traderCode: 'IB2-1', phone: '44 20 7946 0202',
    specialty: ['BP', 'HSBC', 'DB'], baseHalfBps: 68, speedSec: [1.3, 2.6],
    note: 'Leader Banques & Énergie (BP, HSBC, DB). Absorbe les gros blocs sans décaler ses prix.',
  },
  {
    roomId: 'ib3test1', team: 'IB 3', traderCode: 'IB3-1', phone: '44 20 7946 0303',
    specialty: ['VW', 'BP'], baseHalfBps: 72, speedSec: [1.0, 2.1],
    note: 'Desk européen rapide (VW, BP). Cote vite avec une forte capacité en volume.',
  },
];

export const DESK_TRADERS = ['IB2- Desk', 'IB3- Desk', 'HF1-Sales', 'FLOW-DESK', 'RISK-MGR', 'MARKET-OPS'];

export const DEAL_ROOM_LINES = [
  'Anyone seeing big two-way flow in {t}? Exchange depth is thinning out.',
  'Watch {t} — clients are asking for 50k clips back-to-back.',
  'Remember to pull old live quotes before macro headlines drop!',
  '{t} moving fast off the wire, don\'t get picked off on stale offers.',
  'Unwinding {t} in 10k clips on the exchange to save market impact.',
  'Tight quotes win the AM block flow, commissions are adding up nicely.',
  'Anyone long {t} here? Momentum looks strong on the 15min chart.',
  'Keep an eye on single-stock risk limits into the final minute.',
];

export const CLIENT_RFQ_TEMPLATES = [
  'Could you make me a price for {qty} {t} please?',
  'Hi, can I get a two-way price in {qty} {t} pls?',
  'Price for {qty} {t} please?',
  'Looking to trade {t} — two-way on {qty} shares pls?',
];

export const BOT_NAMES = [
  'A. Devidal', 'I. Timson-Smidt', 'C. Faergemann', 'T. Köhler', 'J. Mak',
  'L. Chen', 'S. Okafor', 'M. Rossi', 'J. Karlsson', 'D. Nakamura',
  'P. Dubois', 'R. Silva', 'T. Novak', 'K. Haddad', 'E. Larsson',
  'N. Petrov', 'V. Garcia', 'H. Tanaka', 'F. Girard', 'B. O\'Neill',
  'A. Moreau', 'Y. Lyu', 'A. Sheikh', 'M. Al-Mansoor',
];

export const BOT_FIRMS = [
  'HEC Paris', 'LSE', 'EDHEC', 'Bocconi', 'NUS Singapore',
  'Imperial College', 'Wharton', 'Oxford Saïd', 'ESSEC', 'HKUST',
  'ETH Zürich', 'McGill', 'Rotman', 'Warwick', 'Sciences Po', 'Polytechnique',
];
