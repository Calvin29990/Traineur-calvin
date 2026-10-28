# AmplifyME Trainer — CFA Institute Investing Simulator (IB-55 / AM-55)

Simulateur d'entraînement complet reproduisant les **deux exercices officiels** du *CFA Institute × AmplifyME Investing Simulator Challenge* :

- **Round / Exercice 1 — Investment Bank `IB-55`** : market maker sell-side, flux clients OTC dans le chat, Quote Ticket, couverture d'inventaire sur l'Exchange.
- **Round / Exercice 2 — Asset Manager `AM-55`** : mandat de **$20 000 000**, demandes de prix aux 5 banques (IB-2 → IB-57), exécution en un clic, gestion du cash et de la diversification.

> Simulateur pédagogique indépendant — aucune affiliation avec le CFA Institute, AmplifyME ou Flow Traders. Aucun argent réel, aucun conseil en investissement.

**En ligne :** [tradelab-zlp6.onrender.com](https://tradelab-zlp6.onrender.com/) · **Code :** [github.com/Calvin29990/Traineur-calvin](https://github.com/Calvin29990/Traineur-calvin) · **Guide :** [`/guide-amplifyme-top1.pdf`](https://tradelab-zlp6.onrender.com/guide-amplifyme-top1.pdf)

---

## 1. Univers exact — 5 actions `Equity O`

| Ticker | Société | REFPRICE | Décimales |
|---|---|---|---|
| `BABA` | Alibaba Group Holding | 476.93 | 2 |
| `BP` | BP plc | 40.277 | 3 |
| `HSBC` | HSBC Holdings plc | 47.839 | 3 |
| `MSFT` | Microsoft Corporation | 404.85 | 2 |
| `VW` | Volkswagen AG | 38.990 | 3 |

Le **REFPRICE** affiché est le mid live du carnet interne. Aucun autre instrument n'est négociable.

## 2. News Wire officiel

- **Dernière dépêche en rouge vif** en haut de la wire, les précédentes en blanc/gris.
- **Scénario Officiel — Replay** : les **12 dépêches du Round 1** et les **6 du Round 2** de la session live AmplifyME, rejouées dans le même ordre.
- **Mode Entraînement Dynamique** : 18 dépêches supplémentaires (macro, résultats, M&A, réglementaire), tirées aléatoirement à chaque round.
- Durées : **Express 8 min**, **Standard 15 min**, **Conditions réelles 30 min**. Rôle de départ au choix (IB-55 ou AM-55), rotation automatique sur les 2 rounds.
- Les headlines `NOTE` (mi-parcours, dernière minute) n'ont aucun impact prix : ce sont des signaux de gestion du risque.

## 3. IB-55 — Market Maker Sell-Side

**TopBar (1 ligne)** : logo `AV`, horloge marché + barre de temps, `Realised P+L`, `Unrealised P+L`, `Net Exposure` (vert/rouge), `Commission`, `Total P+L`, `||` pause, `🔊` mute + volume, badge `Calvin MINANG / (all roles) / IB-55` et `?`.

**4 panneaux** :

1. **CHAT** — onglets `IB Room` / `Deal Room`, liste clients `NAME | TEAM` (Aaron AM-2, akshay AM-28…), requêtes réelles (`HSBC 50k plz`, `mfst 10k`, `Buy price for HSBC please`). Un clic pré-remplit le Quote Ticket ; les fills s'affichent en clair : `The quote has been executed on by HF. BP, hfaction:sell, volume:10000, price:40.277`.
2. **QUOTE TICKET** — `Ticker`, `Valid for seconds` (45), `Bid Price (Client Sell)`, `Offer Price (Client Buy)`, `Bid Volume`, `Offer Volume`, boutons ±bps, `SEND QUOTE`. En dessous : `LIVE CHAT QUOTES` / `OLD CHAT QUOTES` (`HF | SECURITY | BID VOL | BID | OFFER | OFFER VOL | VALID FOR`), annulation instantanée.
3. **EXCHANGE** — `Ticker`, champ `Type volume to check market depth and press Enter` + `↵`, profondeur live, `SELL` / `BUY`, `NOTIONAL VALUE`, `COMMISSION`, `HEDGE` / `FLATTEN`. Les clips de 5k–10k sont bien moins chers qu'un bloc de 60k.
4. **CHART** — `PRICE | VOLUME`, `LINE | CANDLESTICK`, `SMA`, zoom `5min / 15min / 30min / 60min / All`, lignes pointillées verte `Maximum` et rouge `Minimum`, `AVERAGE LONG` / `AVERAGE SHORT`.

**6 jauges circulaires** : `COMM` (commissions, cible $32 000), `FFC` (fat fingers), `CT` (trades/notionnel client), `SSRM` (qualité du spread — 425/469 sur un titre à $445 = 494 bps → 0), `ETM` (exposition nette, clips vs dumps), `PnL`.

## 4. AM-55 — Asset Manager $20 000 000

**TopBar (2 lignes)** — L1 : `Shares Owned`, `Realised P+L`, `Unrealised P+L`, `Available cash`, `Total PnL`, `Portfolio Value` (départ **$20 000 000**) ; L2 : `Net Exposure` et badge `Calvin MINANG / Asset Manager / AM-55`.

- `POSITIONS | TRADE BLOTTER X New Trades` (badge rouge) avec la **8ᵉ colonne `% OF PORTFOLIO`**.
- **3 panneaux** (pas de Quote Ticket) :
  1. **CHAT** — `AM Room`, `Deal Room`, 5 dealers (`IB-2`, `IB-14`, `IB-28`, `IB-41`, `IB-57`). Demande de prix (« MSFT 10k pls » ou boutons rapides / `SHOP ALL 5`) → la cote arrive en bas du panneau dans `LIVE CHAT QUOTES | OLD CHAT QUOTES` (`MM | SECURITY | BID VOL | BID | OFFER | OFFER VOL | VALID FOR`) avec `SELL` / `BUY` en un clic. Les spreads diffèrent par banque : il faut les mettre en concurrence.
  2. **EXCHANGE** — élargi, spread volontairement moins bon que les quotes IB (canal de secours).
  3. **CHART** — élargi, avec le bouton `BENCHMARK` (indice équipondéré des 5 valeurs).
- **5 jauges** : `BSRM` (cash 5–15 %, ligne max 20 %, diversification, 10–35 trades), `ES` (prix d'exécution vs REFPRICE, part dealer), `FFC`, `RA` (alignement news + exposition brute), `ROI` (cible +2 % sur $20M).

## 5. Ambiance sonore (Web Audio, zéro fichier externe)

Brouhaha de salle filtré, frappes de clavier, rumeur de floor, **squawk sur breaking news**, ping sur RFQ / cote, son de `Fill`, alertes **Fat Finger**, dépassement de `Net Exposure` et de `% OF PORTFOLIO`. Bouton mute + slider de volume dans la TopBar ; l'audio démarre au lancement du round (politique navigateur).

## 6. Coach, débrief et Guide PDF

- **Coach temps réel** (`C` ou bouton `◎`) : score global, 6/5 jauges détaillées, statistiques de desk et conseils contextuels.
- **Débrief de fin de round** : score, P&L, commissions, jauges, top 3 des actions à corriger.
- **Guide PDF français de 12 pages** généré dans `public/guide-amplifyme-top1.pdf` : présentation de la plateforme, liens, analyse des pièges IB/AM (dont le REX « +$743k mais 53 % » et « cash $3 701 / 47 % MSFT / 88 trades »), plan d'action minute par minute et les 18 dépêches officielles. Le fichier est régénéré à chaque `npm run build` (`scripts/make-guide.mjs`, sans dépendance externe).

## 7. Démarrage & déploiement

```bash
npm install
npm run serve          # build Vite + serveur Express/WebSocket sur http://0.0.0.0:8788
npm run dev            # front Vite (proxy /api et /ws vers :8788)
```

Render (`render.yaml`) : `npm ci --include=dev && npm run build` puis `node server/index.js`, **autoDeploy sur `main`**. Docker et Railway sont également supportés.

### Scripts de validation

```bash
npm run make:guide           # régénère public/guide-amplifyme-top1.pdf
npm run balance              # calibrage 4 seeds × 2 rounds (passif / impulsif / playbook Top 1 %)
npm run playtest             # session complète 2 rounds avec le playbook, objectif ≥ 88/100
npm run build                # guide + build Vite dans dist/
node scripts/render-test.mjs # rendu SSR de tous les panneaux, drawers et modales (serveur :8788 requis)
node scripts/smoke.mjs       # test bout-en-bout WebSocket des deux rôles (serveur :8788 requis)
```

### API

- `GET /api/health` — version, calibrage, univers, durées.
- `GET /api/gauges` — définitions des 11 jauges.
- `GET /api/leaderboard-sample` — classement de démonstration (260 candidats déterministes).
- `GET /guide-amplifyme-top1.pdf` — guide PDF.
- `WS /ws` — protocole `join`, `start`, `sendQuote`, `requestQuote`, `acceptQuote`, `trade`, `hedge`, `chat`, `depth`, `chart`, `pause`, `nextRound`, `restart`… état poussé toutes les 240 ms.
