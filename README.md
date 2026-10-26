# AMPLIFY Simulator Trainer — Préparation CFA Institute × AmplifyME

Simulateur d'entraînement haute fidélité conçu pour reproduire l'interface, les mécaniques de marché et le barème d'évaluation du **CFA Institute × AmplifyME Investing Simulator Challenge** afin de s'entraîner dans les conditions réelles et viser le **Top 10 % qualificatif** (Finale Globale & bourses *CFA® Program Scholarship*).

> Simulateur pédagogique indépendant — aucune affiliation officielle avec le CFA Institute ou AmplifyME, aucun argent réel.

---

## Ce qui est simulé (100 % conforme au format du Challenge)

### 1. Rotation sur les 2 Rôles Officiels
- **Sell-Side — Investment Bank Trader (`IB 1`)** :
  - Flux clients en direct dans le **Chat** (`hf1test1 / HF 1` à `HF 3`, `am1test1 / AM 1` à `AM 2`) + relance commerciale proactive (*Sales Trading*).
  - Saisie manuelle des cotations dans le ticket **`SEND QUOTE`** (`Ticker`, `Valid for seconds`, `Bid Price`, `Offer Price`, `Bid Volume`, `Offer Volume`) ou via la commande `@quote BP 54 56 50000 50000` dans le Chat.
  - Suivi en temps réel dans **`LIVE CHAT QUOTES`** et **`OLD CHAT QUOTES`** avec possibilité d'annuler (`✕`) immédiatement une cotation ouverte lorsqu'une actualité tombe (*anti-sniping*).
  - **Commissions positives (`+12 bps`)** encaissées sur chaque transaction client (`Total P+L = Realised P+L + Unrealised P+L + Commission`).
  - Débouclage de l'inventaire sur le panneau **`EXCHANGE`** avec **profondeur de marché dynamique (*Market Depth*)** : liquider en petites tranches (`10k–15k`) coûte beaucoup moins cher que de liquider un bloc entier d'un seul clic.
- **Buy-Side — Asset Manager (`AM 1` · Portefeuille de 20 000 000 $)** :
  - Gestion active Long / Short d'un fonds actions de **20 M$** face aux annonces **`MACRO`** et microéconomiques.
  - Double canal d'exécution : **demande de cotation bloc (`REQUEST QUOTE` / `@rfq`)** auprès des banques d'investissement (`IB 1`, `IB 2`, `IB 3`) avec comparaison dans `LIVE CHAT QUOTES`, ou exécution instantanée sur **`EXCHANGE`**.
  - Contraintes de mandat et de diversification (limite de concentration de 8 M$ / 40 % par titre, exposition brute max 25 M$).

### 2. Interface Fidèle (Disposition 7 Panneaux AmplifyME FlowTrader)
- **Barre supérieure** : `A M P L I F Y ▼`, horloge marché, `Realised P+L`, `Unrealised P+L`, `Commission`, `Total P+L`, lecteur audio *Trading Floor Squawk*, profil rôle (`IB 1` / `AM 1` · *Single User Mode*).
- **Ligne supérieure (3 panneaux)** :
  1. `1. EQUITIES` (`TICKER`, `REFPRICE` avec flèche de tick `↑/↓`, `% CHG`, `TYPE: Equity O` + zone d'épinglage rapide)
  2. `NEWS WIRE` (`Search keywords 🔍`, colonnes `TICKER` [`MACRO`, actions, `NOTE`] & `HEADLINE`)
  3. `POSITIONS` | `TRADE BLOTTER` | `RISK / $20M MANDATE` (maintien des lignes soldées avec leur `REALISED P/L` et `NET P/L`)
- **Ligne inférieure (4 panneaux)** :
  1. `CHAT` (`Search name or team`, `Deal Room`, `IB Room`, salons contreparties + `SEND MESSAGE` / `@quote`)
  2. `QUOTE TICKET` + `LIVE CHAT QUOTES` / `OLD CHAT QUOTES`
  3. `EXCHANGE` (vérificateur de profondeur `Enter volume to check market depth ↵`, `SELL` / `BUY`, `NOTIONAL VALUE`, `COMMISSION`)
  4. `CHART` (`PRICE / VOLUME`, `LINE / CANDLESTICK`, indicateur `SMA`, `Zoom 5min..All`, navigateur temporel bas)

### 3. Scoring Multi-Critères AmplifyME & Détection des *Fat Fingers*
- Score sur **100 points** combinant P+L / ROI, flux & commissions clients, discipline de risque / débouclage, qualité d'exécution (IB vs Exchange) et **Fat Finger Count (`FFC`)**.

---

## Démarrage local & Déploiement Render

```bash
npm install
npm run serve        # compile le front (Vite) et démarre le serveur sur http://0.0.0.0:8788
```

Scripts de vérification et calibrage :

```bash
npm run balance              # benchmark des stratégies (Débutant vs Intermédiaire vs Playbook Top 10%)
node scripts/playtest.js     # simule une session complète 2 rounds (IB 1 -> AM 1)
node scripts/render-test.mjs # test de rendu SSR de tous les composants
node scripts/smoke.mjs       # test bout-en-bout WebSocket
```

Compatible déploiement 1-clic sur **Render** (`render.yaml`), **Railway** (`railway.json`) et **Docker** (`Dockerfile`).
