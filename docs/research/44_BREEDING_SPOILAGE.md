# 44 — Reproduction du cheptel et péremption des denrées

**Statut :** Implémenté  
**Date :** 2026-08-12  
**Complète :** [43_LIVESTOCK_PRODUCE](./43_LIVESTOCK_PRODUCE.md)

---

## Deux mécaniques qui se répondent

Le troupeau grossit tout seul si on l'entretient bien, mais ce qu'il produit ne
se garde pas. L'élevage cesse d'être une file d'achats pour devenir un capital
qu'on soigne — et une production qu'on écoule sans traîner.

---

## Reproduction

Une naissance récompense une conduite suivie. Cinq conditions, toutes
vérifiées à chaque tick :

| Condition | Seuil | Motif affiché en cas de refus |
|-----------|-------|-------------------------------|
| Effectif | ≥ 2 bêtes | « Il faut au moins deux bêtes » |
| Bien-être | ≥ 0,55 | « Le troupeau est trop stressé » |
| Ration | ≥ 50 % du besoin | « Un troupeau sous-alimenté ne se reproduit pas » |
| Place libre | ≥ 1 | « Plus de place : agrandissez le bâtiment » |
| Pas de gestation en cours | — | « Gestation en cours » |

Le refus est **affiché**, pas silencieux : le joueur voit ce qui manque.

### Rythme

| Espèce | Gestation | Portée |
|--------|-----------|--------|
| Vache | 8 cycles (2 h de jeu) | 1 veau |
| Truie | 4 cycles (1 h de jeu) | 4 porcelets |

La portée est plafonnée par la place restante : on ne fait pas naître une bête
pour la mettre à l'étroit, ce qui ferait chuter le bien-être de tout le lot.

Un troupeau négligé **stagne**. C'est une sanction plus juste que de le voir
mourir : le joueur perd du potentiel, pas son capital.

---

## Péremption

| Denrée | Perte par cycle | Demi-vie |
|--------|-----------------|----------|
| Lait | **12 %** | ~5,4 cycles |
| Viande | **5 %** | ~13,5 cycles |
| Grain, fourrage | — | — |

La décroissance est **exponentielle**, pas linéaire : la perte est
proportionnelle à ce qu'il reste. Un stock ne peut donc jamais devenir négatif,
et le résultat ne dépend pas du découpage des ticks — quatre quarts de cycle
donnent exactement le même résultat qu'un cycle entier. Un test le vérifie.

### Ce que ça débloque dans le commerce

C'est le contrepoids qui manquait au système de vente. Jusqu'ici, attendre ne
coûtait rien : la criée dominait toujours le négociant. Un lot de lait perd
12 % par cycle, donc encaisser tout de suite à 60 % du cours redevient
défendable face à une criée qui paie mieux mais fait attendre.

**Déposer à la criée ne permet pas d'échapper à la péremption** : la
marchandise rendue à l'expiration a vieilli en vitrine. Sans cette règle, la
criée aurait été un réfrigérateur gratuit.

---

## Mesuré en jeu

```
troupeau stressé   : « Le troupeau est trop stressé pour se reproduire »
troupeau serein    : gestation 0 % → 0,6 % → 1,3 %
mise bas           : 5 bêtes → 6 bêtes, nouvelle gestation enchaînée
lait en silo       : 2,640 → 1,100 → 1,091 → 1,085 hL
viande en silo     : 0,180 → 0,079 t
```

---

## Données et API

Trois champs s'ajoutent : `Herd.gestatingSince`, `Herd.lastCalvedAt`, et
`InventoryItem.lastDecayAt`.

La gestation est gérée dans `settleHerd()`. La péremption tourne dans le tick
monde, avec les courtiers et les annonces expirées.

`GET /parcels/:id/livestock` expose `gestation` (0 à 1) et `breedRefusal`.

---

## Deuxième passe : deux mécaniques écrites mais invisibles

Les deux systèmes existaient, étaient testés, et le joueur ne les voyait
pourtant pas. Chaque fois pour une raison de câblage, pas de logique.

### Le cheptel ne grandissait que par achat

`settleHerd()` n'était appelé que par `GET /parcels/:id/livestock`, c'est-à-dire
par le sondage de l'écran d'élevage. Un joueur qui ne l'ouvrait pas ne voyait
jamais une gestation démarrer : son troupeau vivait à l'arrêt. Le reproche
était exact, et sa cause tenait en une ligne manquante.

`settleAllHerds()` fait désormais vivre tous les troupeaux à chaque tick du
monde. Une bête vit qu'on la regarde ou non.

Vérifié sans jamais appeler l'écran d'élevage : la gestation démarre seule sur
un tick, et un troupeau de trois vaches arrivé à terme passe à quatre.

### Le lait ne semblait jamais tourner

Là, le serveur faisait son travail — la quantité en base baissait bien à
chaque tick. Mais l'inventaire du joueur n'était rechargé qu'après une action
de sa part : le silo restait figé à l'écran pendant des minutes, et la
péremption paraissait décorative.

Le stock est maintenant rafraîchi avec le reste, toutes les dix secondes.
Mesuré sur deux minutes : cent tonnes de lait tombent à 98,5.

**La leçon, une fois de plus :** une mécanique n'existe que si le joueur la
voit bouger. Une fonction pure, testée et correcte, ne prouve rien tant que la
chaîne complète — planificateur, écriture, rafraîchissement de l'écran — n'a
pas été parcourue de bout en bout.

---

## Reste à faire

- Pas de chambre froide : aucun bâtiment ne ralentit la péremption, alors
  qu'un silo ralentit déjà le séchage du grain
- La consanguinité et la génétique n'existent pas : toutes les bêtes se valent
- Une bête ne vieillit pas individuellement — l'âge est celui du lot, si bien
  qu'un veau né aujourd'hui compte comme ses aînés à l'abattage
- Pas de mortalité : un troupeau affamé se stresse sans jamais perdre de bête
