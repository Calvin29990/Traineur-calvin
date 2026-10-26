// ---------------------------------------------------------------------------
// Contenu du simulateur : instruments, actualités, clients, ambiance desk.
// Tous les textes et scénarios sont originaux (simulateur non officiel).
// ---------------------------------------------------------------------------

export const INSTRUMENTS = [
  { ticker: 'BABA', name: 'Alibaba Group', sector: 'ECOMMERCE', ref: 481.26, vol: 0.00026, beta: 1.25, tick: 0.01 },
  { ticker: 'MSFT', name: 'Microsoft Corp', sector: 'TECH', ref: 519.82, vol: 0.00020, beta: 1.0, tick: 0.01 },
  { ticker: 'VW', name: 'Volkswagen AG', sector: 'AUTO', ref: 49.01, vol: 0.00024, beta: 1.3, tick: 0.01 },
  { ticker: 'HSBC', name: 'HSBC Holdings', sector: 'BANKS', ref: 42.97, vol: 0.00028, beta: 1.15, tick: 0.01 },
  { ticker: 'BP', name: 'BP plc', sector: 'ENERGY', ref: 57.35, vol: 0.00033, beta: 1.05, tick: 0.01 },
  { ticker: 'DB', name: 'Deutsche Bank AG', sector: 'BANKS', ref: 28.44, vol: 0.00037, beta: 1.45, tick: 0.01 },
];

const SECTOR_MULT = { TECH: 0.85, BANKS: 1.35, AUTO: 1.15, ENERGY: 0.95, ECOMMERCE: 1.1 };

// Actualité actions : impact direct sur le titre
export const STOCK_NEWS = [
  { ticker: 'MSFT', move: 0.0092, headline: 'Microsoft confirme des discussions pour racheter un réseau social pour 68 Md$',
    detail: "Dans une lettre ouverte aux actionnaires, Microsoft détaille une stratégie agressive : utiliser cette acquisition pour créer un pôle publicitaire et lancer un objectif à moyen terme de conquérir des parts de marché face aux grands acteurs du secteur." },
  { ticker: 'MSFT', move: -0.0068, headline: 'Microsoft : le régulateur ouvre une enquête sur les pratiques de licence cloud',
    detail: "L'autorité de la concurrence annonce une enquête formelle sur le bundling des licences cloud. Les analystes estiment le risque financier à 2-3 Md$ dans le scénario le plus défavorable." },
  { ticker: 'BABA', move: 0.0107, headline: 'Alibaba dévoile son pôle cloud IA et vise 40 % de croissance',
    detail: "Le groupe présente sa nouvelle division intelligence artificielle, avec un objectif de croissance du chiffre d'affaires de 40 % sur l'exercice. Plusieurs brokers relèvent leur objectif de cours dans la foulée." },
  { ticker: 'BABA', move: -0.0097, headline: "Alibaba : nouvelles restrictions à l'export de puces vers la Chine",
    detail: "Washington annonce un élargissement des restrictions technologiques. Les investisseurs craignent un impact sur la feuille de route data-center du groupe." },
  { ticker: 'VW', move: 0.0077, headline: 'Volkswagen annonce un partenariat batteries avec un fournisseur asiatique',
    detail: "Le constructeur sécurise 40 GWh de capacité pour ses plateformes électriques jusqu'en 2029. Le marché salue une réduction du risque d'exécution sur le plan produit." },
  { ticker: 'VW', move: -0.0116, headline: 'Volkswagen prévient : la pénurie de semi-conducteurs coupera la production de 15 %',
    detail: "La direction abaisse sa guidance de livraisons pour le trimestre. Deux analystes passent à « conserver » et évoquent une pression sur les marges au second semestre." },
  { ticker: 'HSBC', move: -0.0126, headline: "HSBC : démission immédiate du directeur général, le régulateur ouvre une enquête",
    detail: "Le conseil d'administration annonce un départ avec effet immédiat et la nomination d'un intérimaire. L'autorité britannique ouvre une enquête sur des flux de blanchiment non déclarés." },
  { ticker: 'HSBC', move: 0.0087, headline: 'HSBC relève son programme de rachat à 3 Md$ après des résultats solides',
    detail: "La banque publie un résultat net supérieur de 12 % aux attentes et annonce un rachat d'actions supplémentaire. Le ratio CET1 reste au-dessus de l'objectif." },
  { ticker: 'BP', move: 0.0073, headline: 'BP augmente son rachat trimestriel à 3,5 Md$ après des marges de raffinage record',
    detail: "Le groupe profite d'un environnement de raffinage exceptionnel et confirme sa trajectoire de désendettement. Le dividende est maintenu, avec une hausse de 4 % envisagée." },
  { ticker: 'BP', move: -0.0087, headline: 'BP : incident majeur sur une plateforme en mer du Nord, production interrompue',
    detail: "La production est suspendue sur un actif représentant environ 6 % du volume total du groupe. Les équipes techniques estiment une reprise sous 10 jours." },
  { ticker: 'DB', move: -0.0135, headline: 'Deutsche Bank : nouvelle amende dans un dossier de manipulation de changes',
    detail: "Le régulateur inflige une sanction de 700 M€ et impose un audit indépendant des systèmes de conformité. La banque indique avoir provisionné l'essentiel du montant." },
  { ticker: 'DB', move: 0.0102, headline: "Deutsche Bank : restructuration plus rapide que prévu, objectifs relevés",
    detail: "La banque réduit ses coûts plus vite que le plan initial et relève son objectif de rentabilité. La direction évoque un retour à une distribution aux actionnaires dès cette année." },
  { ticker: 'MSFT', move: 0.0053, headline: 'Microsoft signe un contrat cloud de 4 Md$ avec un groupe industriel',
    detail: "Contrat pluriannuel portant sur l'infrastructure et les services IA. Les analystes relèvent légèrement leurs estimations de revenus du segment Intelligent Cloud." },
  { ticker: 'BABA', move: 0.0063, headline: "Alibaba : la plateforme de paiement affiliée dépasse les attentes sur le trimestre",
    detail: "Le volume de paiements progresse de 18 % en glissement annuel. La filiale logistique annonce par ailleurs une réduction de ses pertes opérationnelles." },
  { ticker: 'VW', move: 0.0043, headline: 'Volkswagen : les ventes de véhicules électriques en hausse de 22 % en Europe',
    detail: "Les immatriculations de la marque progressent plus vite que le marché. Les analystes restent prudents sur les marges du segment électrique." },
  { ticker: 'BP', move: 0.0058, headline: 'BP annonce un projet éolien offshore de 2 GW avec un partenaire japonais',
    detail: "Le projet représente 4 Md$ d'investissement sur cinq ans, avec un retour attendu à deux chiffres. La direction confirme son cap vers les énergies renouvelables." },
  { ticker: 'HSBC', move: 0.0048, headline: 'HSBC : la marge nette d\'intérêts dépasse les attentes au T3',
    detail: "La hausse des taux soutient les revenus. La banque relève légèrement sa guidance de revenus pour l'exercice en cours." },
  { ticker: 'DB', move: 0.0043, headline: 'Deutsche Bank cède sa division de gestion d\'actifs pour 1,4 Md€',
    detail: "La cession améliore le ratio de capital de 60 points de base. Le produit de la vente sera en partie redistribué aux actionnaires." },
  { ticker: 'MSFT', move: -0.0058, headline: 'Microsoft : panne majeure d\'un service cloud, des milliers de clients affectés',
    detail: "L'incident a duré quatre heures sur une région majeure. La direction promet un rapport post-mortem et des crédits de service." },
  { ticker: 'BABA', move: -0.0053, headline: 'Alibaba : la croissance des ventes en ligne ralentit à 3 %',
    detail: "La consommation reste fragile et la concurrence s'intensifie. La direction maintient ses objectifs annuels mais reconnaît un environnement plus difficile." },
];

// Actualité macro : touche tout le marché, amplifié par le bêta sectoriel
export const MACRO_NEWS = [
  { tone: 1, size: 0.0053, headline: 'La Fed signale une pause dans son cycle de hausse des taux',
    detail: "Le communiqué évoque une inflation qui « se rapproche de la cible ». Les marchés actions progressent, les valeurs bancaires et cycliques surperforment, le dollar recule." },
  { tone: -1, size: 0.0063, headline: 'Fed : tonalité plus dure, les rendements obligataires bondissent',
    detail: "Deux membres du comité évoquent une hausse supplémentaire. Le 10 ans prend 14 points de base, les valorisations actions sont sous pression." },
  { tone: -1, size: 0.0077, headline: "Le gouvernement annonce un plan de sauvetage de 2 000 Md$ pour le secteur bancaire",
    detail: "Le plan prévoit des garanties publiques sur les dépôts et un accès élargi à la liquidité. Les marchés reprennent leur souffle après trois séances de baisse, les bancaires rebondissent fortement." },
  { tone: 1, size: 0.0048, headline: 'Le président envisage une remise à zéro des droits de douane sur la tech',
    detail: "Selon deux sources proches du dossier, un accord cadre pourrait être annoncé avant la fin du mois. Les valeurs technologiques et e-commerce sont recherchées." },
  { tone: -1, size: 0.0043, headline: "L'IPC américain ressort au-dessus des attentes",
    detail: "L'inflation sous-jacente accélère à 3,4 %. Les marchés repoussent la première baisse de taux et les valeurs de croissance accusent le coup." },
  { tone: 1, size: 0.0038, headline: 'Les commandes industrielles allemandes surprennent à la hausse',
    detail: "La publication rassure sur le cycle manufacturier européen. L'automobile et la chimie progressent, l'énergie suit." },
  { tone: -1, size: 0.0058, headline: "Tensions géopolitiques : les prix du pétrole s'envolent de 6 %",
    detail: "Les approvisionnements sont menacés dans une zone clé. L'énergie surperforme alors que le reste du marché recule face à la crainte d'un choc des coûts." },
  { tone: 1, size: 0.0034, headline: 'La BCE laisse ses taux inchangés et se dit prête à soutenir la croissance',
    detail: "Le ton est jugé plus accommodant que prévu. Les banques profitent d'une courbe plus pentue, les cycliques accélèrent." },
  { tone: -1, size: 0.0048, headline: "Dégradation de la perspective de croissance mondiale par le FMI",
    detail: "Le FMI abaisse sa prévision 2026 de 0,4 point et cite les tensions commerciales. Les secteurs cycliques sont pénalisés en priorité." },
  { tone: 1, size: 0.0043, headline: 'Un accord commercial majeur serait imminent entre les deux blocs',
    detail: "Les négociateurs évoquent une signature rapide. Les exportateurs et les valeurs automobiles bondissent, l'e-commerce profite de l'ouverture des marchés." },
];

// ---------------------------------------------------------------------------
// Clients (contreparties) — chaque profil a un comportement propre
// informedness : probabilité que le client trade avec une information
// ---------------------------------------------------------------------------
export const CLIENT_ARCHETYPES = [
  { id: 'HF', label: 'Hedge Fund', informedness: 0.85, sizePref: [50, 75, 100], notional: [4000000, 6000000, 8000000], aggression: 0.95, color: '#ff8a4c',
    note: "Flux informé, agressif, taille moyenne. Se trompe rarement sur les 60 prochaines secondes." },
  { id: 'PROP', label: 'Prop Trader', informedness: 0.55, sizePref: [25, 50, 75], notional: [2500000, 4000000, 6000000], aggression: 0.9, color: '#ffd166',
    note: "Suit la tendance, souvent aligné avec le mouvement en cours. Réagit vite aux news." },
  { id: 'AM', label: 'Asset Manager', informedness: 0.18, sizePref: [75, 100, 150], notional: [6000000, 8000000, 10000000], aggression: 0.55, color: '#4cc9f0',
    note: "Gros volume, flux de rééquilibrage. Peu informé : source principale de spread." },
  { id: 'RTL', label: 'Retail Broker', informedness: 0.08, sizePref: [25, 25, 50], notional: [2000000, 3000000, 4000000], aggression: 0.5, color: '#9aa5b1',
    note: "Petites tailles, flux quasi aléatoire. Marge faible mais régulière." },
  { id: 'CORP', label: 'Corporate', informedness: 0.25, sizePref: [50, 100, 150], notional: [5000000, 7000000, 9000000], aggression: 0.45, color: '#b388ff',
    note: "Flux lié à des opérations de couverture, peu sensible au prix. Accepte des spreads larges." },
  { id: 'PB', label: 'Private Bank', informedness: 0.2, sizePref: [50, 75, 100], notional: [4000000, 5500000, 7000000], aggression: 0.6, color: '#7ee787',
    note: "Exécute pour le compte de clients finaux. Sensible au spread, compare avec le marché." },
];

export const CLIENT_NAMES = ['HFI-1', 'HFI-2', 'PROP-1', 'PROP-2', 'AM-1', 'AM-2', 'RTL-1', 'RTL-2', 'CORP-1', 'PB-1', 'PB-2', 'HFI-3'];

export const ROOMS = [
  { id: 'deal', name: 'Deal Room', desc: 'Salle commune' },
  { id: 'ib', name: 'IB Room', desc: 'Votre desk' },
  { id: 'ht', name: 'ht11test1', desc: 'Client privé' },
];

export const DESK_TRADERS = ['MK-ALPHA', 'SPREADY', 'VOL-GUY', 'QUOTE-QUEEN', 'DELTA-ONE', 'PIP-SENPAI', 'RISK-MONK', 'TAPE-READER'];

export const DEAL_ROOM_LINES = [
  'Who has colour on {t}? Looks heavy into the close.',
  '{t} bid side is thin, careful if you are long.',
  'Anyone see that {t} headline? Tape is waking up.',
  'Spreads are wide today, don\'t show your hand too early.',
  'I am flat into the news, not worth the risk.',
  'Big seller in {t} on the exchange, I can see the prints.',
  '{t} feels bid to me. Everyone is chasing the same hedge.',
  'If you are short {t} on that print you are brave.',
  'Reminder: inventory limits are tight this session.',
  'The client flow is one-sided again. Someone knows something.',
  'Just got lifted twice in {t}. Widening my offer.',
  'Careful on {t}, the last three prints all went the same way.',
];

export const BOT_CHAT_LINES = [
  'Done, thanks.',
  'That is a bit wide for me.',
  'Can you tighten that up?',
  'I will take it.',
  'Working on it, give me a second.',
  'Appreciate the market.',
  'Nothing for me at that level, sorry.',
  'Still there?',
  'I need a two-way price, not a one-way.',
  'Market is moving, requote?',
];

export const BOT_NAMES = ['A. Moreau', 'L. Chen', 'S. Okafor', 'M. Rossi', 'J. Karlsson', 'D. Nakamura', 'P. Dubois', 'R. Silva', 'T. Novak', 'K. Haddad', 'E. Larsson', 'N. Petrov', 'V. Garcia', 'H. Tanaka', 'F. Girard', 'B. O\'Neill'];

export const BOT_FIRMS = ['Nordkap AM', 'Helvetia Capital', 'Bluewater Partners', 'Meridian Trading', 'Kestrel Asset Mgmt', 'Orion Markets', 'Sagitta Capital', 'Riverstone PB', 'Delta Nine', 'Cobalt Advisors'];
