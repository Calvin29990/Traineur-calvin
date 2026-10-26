# TradeLab — simulateur d'entraînement au market making

Un desk de marché jouable dans le navigateur : on reçoit des **demandes de prix (RFQ)** de clients,
on cote un **bid / offer**, on gère le **flux informé** et on essaie de finir dans le **top 10 %**
du classement.

Le simulateur reprend le format des challenges de trading type « cotation continue + flux clients +
classement » (carnet d'ordres, news, contreparties, blotter, P&L réalisé/non réalisé, commissions),
avec un moteur et des contenus **originaux**. Aucune affiliation avec un organisme, aucun argent réel.

---

## Démarrage

```bash
npm install
npm run serve        # build + serveur unique sur http://localhost:8788
```

En développement (rechargement à chaud + proxy API) :

```bash
npm run dev          # vite sur :5173, qui relaie /api et /ws vers :8788
npm start            # API + moteur de marché sur :8788 (à lancer en parallèle)
```

Autres scripts :

| commande | usage |
|---|---|
| `npm run balance` | fait jouer plusieurs stratégies au moteur et compare les P&L (calibrage) |
| `node scripts/smoke.mjs` | test de bout en bout du protocole (session complète) |
| `node scripts/render-test.mjs` | rendu SSR de tous les composants avec un état réel |

---

## Comment on joue

1. **Un client arrive** (hedge fund, asset manager, corporate…). Il demande un prix sur une action
   pour un volume donné. Vous avez 30 s pour répondre.
2. **Vous cotez** : un bid (où vous achetez) et un offer (où vous vendez). L'écart est votre **spread**,
   votre marge si le prix ne bouge pas.
3. **Le client décide** : s'il juge votre prix bon, il traite. Vous devenez acheteur ou vendeur.
4. **Le marché bouge** : si le prix part contre vous après l'exécution, c'est la **sélection adverse**.
   C'est là que se joue la différence entre un bon et un mauvais market maker.
5. **Vous couvrez** l'exposition toxique au marché (spread + commission) ou vous la gardez si le flux
   est sain.

### Les trois leviers

- **Spread** : large = peu d'exécutions mais bonne marge ; serré = beaucoup de volume mais vous êtes
  la contrepartie facile du flux informé.
- **Skew** : décale les deux prix. Skew positif = vous pensez que le vrai prix est plus haut.
  Après une news haussière, un skew de +10 à +20 bps transforme une perte en gain.
- **Taille** : coter moins que la demande sur un client suspect limite l'exposition sans refuser le flux.

### Lire le marché

| signal | où | ce que ça dit |
|---|---|---|
| News | panneau « Fil d'actualité » | le « vrai prix » vient de changer ; le marché converge en 20-40 s |
| Flux 45 s | colonne du panneau Equities | sens des trades clients récents, un flux massif et unidirectionnel est un signal |
| Deal Room | chat | couleur du desk (indicatif, parfois faux) |
| Badge PRESSÉ | carte RFQ | client agressif, souvent informé |

Le graphique affiche aussi des **triangles** aux prix où les clients vous ont exécuté
(vert = le client achète, rouge = il vend) : c'est la lecture de la tape.

### Règles et limites

- 3 rounds de 3 minutes (configurable de 1 à 5).
- Limite de **6 M$ de notionnel par titre** et **15 M$ de risque brut**.
- Couverture au marché : ≈ 11 bps de coût (0,6 % de spread + 0,5 % de commission par côté).
- En fin de round, les positions restantes sont **soldées au marché** : votre P&L de round est définitif.
- Classement mis à jour en continu ; l'objectif affiché est le **seuil du top 10 %**.

### Repères de calibrage (session de 3 rounds)

| profil | P&L médian | commentaire |
|---|---|---|
| cotation 8 bps serrée, sans couverture | ≈ −35 000 $ | la contrepartie facile du flux informé |
| cotation 12 bps symétrique | ≈ +23 000 $ | correct, mais fragile |
| cotation 20 bps / skew après news | ≈ +32 000 à +60 000 $ | le seuil du top 10 % tourne autour de 38 000 $ |
| couverture systématique | ≈ −10 000 $ | couvrir coûte plus que le spread capturé |

C'est la combinaison **spread large + skew dans le sens de la news + couverture sélective**
qui fait la différence entre le milieu et le haut du classement.

### Raccourcis

`Entrée` envoyer le prix · `P` passer la demande · `H` couvrir la plus grosse position ·
`Espace` pause · `1`/`2`/`3` vitesse (0,5x / 1x / 2x) · `K` classement

---

## Architecture

```
server/
  content.js    instruments, actualités, profils de clients, ambiance du desk
  engine.js     moteur autoritaire : prix, news, RFQ, exécution, P&L, classement, coach
  index.js      express + websocket (état poussé 4x/s), sessions en mémoire
src/
  App.jsx       disposition du desk, raccourcis, modales
  components/   panneaux (equities, news, positions, chat, RFQ, bourse, graphique)
  lib/chart.js  rendu canvas du graphique (ligne / chandeliers / aire, volume, marqueurs)
scripts/        calibrage et tests
```

Le moteur tourne côté serveur : le client envoie des **intentions** (`quote`, `pass`, `trade`,
`hedge`, `chat`) et reçoit un **snapshot complet** à ~4 Hz. Aucune logique de prix côté navigateur.

## Notes de calibrage

`npm run balance` simule plusieurs profils de joueurs sur des dizaines de sessions pour vérifier que :

- une cotation symétrique serrée perd de l'argent (sélection adverse) ;
- un skew dans le sens de l'information et une couverture sélective gagnent ;
- le seuil du top 10 % reste atteignable en une session de trois rounds.

---

Simulateur pédagogique indépendant. Les prix, actualités et contreparties sont générés
par le moteur : rien n'est réel et rien ne constitue un conseil d'investissement.
