# 42 — Vendre sa récolte : trois débouchés

**Statut :** Implémenté  
**Date :** 2026-08-12

---

## Le constat de départ

Vendre existait déjà, mais le client ne l'avait jamais trouvé. Le bouton était
au fond du panneau « Bureau », sous les missions et l'expansion, et il vendait
**tout le stock d'un coup** au cours du jour. Aucune décision, aucune
visibilité.

Un jeu d'économie n'a d'intérêt que si vendre est un arbitrage.

---

## Trois canaux

| Canal | Prix | Délai | Risque |
|-------|------|-------|--------|
| **Négociant** | 60 % du cours, fixe | Immédiat | Aucun |
| **Cours mondial** | Cours du jour, moins la décote de volume | Immédiat | Le cours bouge |
| **Criée** | Vous fixez le prix | Attente | Peut ne pas trouver preneur |

### Le négociant — le plancher

Il rachète tout, tout de suite, à **60 % du cours**. On ne se retrouve jamais
avec un silo plein et zéro CRD.

Le taux doit rester franchement décevant : plus haut, personne ne prendrait la
peine de suivre le marché. C'est un filet de sécurité, pas une stratégie.

### Le cours mondial — l'impact du volume

Écouler un gros lot d'un coup **fait plonger le prix obtenu**. La décote suit
une racine carrée du rapport volume/profondeur, plafonnée à 35 % :

```
décote = min(0,35 ; √(tonnes / profondeur) × 0,9)
```

Une petite vente ne coûte presque rien, une vente massive fait mal. C'est ce
qui rend l'étalement des ventes réellement plus rentable — un test le vérifie
en comparant 200 t d'un bloc au même tonnage vendu par petits lots.

### La criée — entre joueurs

Le vendeur fixe son prix, entre 30 % et 250 % du cours. Le lot quitte le silo
au dépôt et attend un acheteur pendant une saison (15 minutes).

| Frais | Taux | Remboursé ? |
|-------|------|-------------|
| Dépôt | 2 % du montant demandé | **Non**, même si le lot ne part pas |
| Commission | 5 % à la vente | — |

Les frais non remboursés découragent les annonces spéculatives à tout-va. Six
annonces ouvertes au maximum par joueur.

À l'expiration, la marchandise revient au silo — mais pas les frais.

---

## Ce que voit le joueur

Un bouton **💰 Vendre** dans la barre d'action, qui affiche le tonnage en
silo. Il ouvre un écran qui montre **les trois offres côte à côte**, chiffrées
pour la quantité choisie, avec le meilleur net mis en évidence.

La quantité se règle au curseur : on ne vend plus forcément tout.

Un grain trop humide affiche un avertissement et un bouton « Sécher » — la
décote s'applique aux trois canaux.

Un second onglet liste les lots des autres joueurs, du moins cher au plus
cher, avec leur humidité et leur vendeur.

---

## Mesuré en jeu

Sur 40 t de blé, cours à 450 CRD/t :

```
DEALER     270.0 CRD/t → 10 800 CRD  (garanti)
MARKET     292.5 CRD/t → 11 700 CRD  (garanti)  décote de volume −35 %
LISTING    250.0 CRD/t →  9 300 CRD  (incertain) frais 200 CRD + 5 %
```

Circuit complet vérifié entre deux comptes : dépôt de 10 t à 250 CRD/t (frais
50 CRD), achat par un autre joueur pour 2 500 CRD, le vendeur touche 2 375 CRD
après commission.

Gardes vérifiées : prix trop bas, prix irréaliste, stock insuffisant,
auto-achat, et retrait qui rend la marchandise.

---

## API

| Route | Rôle |
|-------|------|
| `GET /market/quote` | Les trois devis pour un lot donné |
| `POST /market/dealer` | Rachat immédiat garanti |
| `POST /market/sell` | Cours mondial, décote de volume comprise |
| `GET /market/listings` | Annonces ouvertes |
| `POST /market/listings` | Dépôt d'un lot |
| `POST /market/listings/:id/buy` | Achat |
| `POST /market/listings/:id/cancel` | Retrait |

Les annonces expirées sont fermées et rendues à leur vendeur au premier accès
suivant.

---

## Traité depuis

**Des courtiers PNJ** passent à chaque tick et raflent les lots dont le prix
ne dépasse pas 118 % du cours, après un délai de quatre-vingt-dix secondes.
Plus le vendeur est gourmand, plus il attend ; au-delà du seuil, personne ne
mord et le lot expire. La criée fonctionne donc dès le premier joueur.

**La profondeur du carnet ne tombe plus à zéro** : un plancher à 30 % de la
profondeur nominale empêche qu'une vente ordinaire subisse la décote maximale.

---

## L'historique des cours

Une cotation seule ne veut rien dire : 265 CRD la tonne est une bonne affaire
ou une braderie selon d'où le cours vient. Sans mémoire des prix, le joueur ne
pouvait ni juger l'offre du jour ni décider d'attendre — il vendait au hasard,
et les trois canaux de vente ne servaient qu'à comparer entre eux, jamais à
choisir son moment.

Chaque tick archive les cours dans `MarketTick`. L'écran de vente en tire une
courbe sous la cotation courante : pas d'axes ni de graduations, juste la
forme — ça monte, ça descend, ça stagne — avec l'amplitude de la période et la
variation en pourcentage, colorée selon le sens.

La fenêtre glisse sur douze heures et les relevés plus anciens sont élagués au
même tick. Personne ne spécule sur le cours d'avant-hier, et la table
grossirait sinon de cinq lignes toutes les vingt secondes.

`GET /market/history?commodity=WHEAT&hours=3` renvoie la série, du plus ancien
au plus récent.

---

## Vendre « tout » était refusé

Signalé en jeu : le bouton de vente ne faisait rien, l'écran répondait
« Stock insuffisant », et il fallait redescendre le curseur à tâtons — vers
80 % — pour qu'une vente passe. Impossible de vendre la totalité d'un lot.

Deux causes s'additionnaient, et la première suffisait.

**L'écran proposait plus que le stock.** La quantité par défaut valait
`Math.round(qty * 100) / 100`, soit un arrondi **au plus proche** d'un stock
qui compte trois décimales. Pour 83,716 t en silo, l'écran demandait 83,72 t.
Le serveur comparait strictement et refusait. Pire, le curseur affichait la
valeur bornée au stock : le joueur voyait donc une quantité correcte et un
bouton sans effet. Une fois sur deux, selon la troisième décimale.

Le curseur n'atteignait pas non plus son maximum : il avance par pas de 0,01 t
depuis 0,01, si bien qu'aucune position ne tombe jamais sur 83,716. D'où le
« je ne pouvais pas mettre 100 % ».

**La denrée tournait entre l'affichage et le clic.** Le lait perd 12 % par
cycle et le serveur le décompte à chaque tick, quand l'écran ne se rafraîchit
que toutes les dix secondes. Pour une denrée périssable, demander la totalité
était donc voué à l'échec par construction, quel que soit l'arrondi.

**Correction.** L'écran tronque au lieu d'arrondir, son maximum est une
position réellement atteignable, et un bouton « Tout » l'y amène d'un geste.
Côté serveur, `settleSaleTons` vend ce qui est là plutôt que de refuser : un
négociant ne renvoie pas le chargement parce qu'il pèse trois kilos de moins
que l'annonce. La tolérance vaut 2 % du lot ou 20 kg, le plus grand des deux ;
au-delà, la demande n'est plus un écart d'arrondi mais une erreur, et elle
reste refusée. Les trois canaux partagent la même règle — la criée avait le
même défaut, elle ne se manifestait simplement pas au même moment.

Vérifié contre l'API : 83,72 t demandées sur 83,716 t en silo vident le lot ;
40,123 t de lait demandées après un tick en vendent 40,065 ; 99 999 t restent
refusées.

**La leçon :** une valeur affichée bornée mais envoyée brute est un piège. Le
joueur voit ce qu'il attend et ne comprend pas le refus — c'est la pire forme
de bug, celle qui fait passer le jeu pour cassé sans laisser de trace.

---

## Reste à faire

- La courbe ne marque pas les ventes du joueur : il ne peut pas voir a
  posteriori s'il a bien ou mal vendu.
