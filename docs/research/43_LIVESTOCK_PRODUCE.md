# 43 — Traire, abattre, nourrir : l'élevage devient une boucle

**Statut :** Implémenté  
**Date :** 2026-08-12  
**Complète :** [37_LIVESTOCK_SERVICES](./37_LIVESTOCK_SERVICES.md)

---

## Ce qui manquait

Le lait et la viande étaient **calculés et affichés, mais jamais récoltés**.
Le fourrage était modélisé sans jamais être consommé. Les porcs n'avaient pas
d'aire de sortie. L'élevage était une vitrine, pas une activité.

---

## La boucle refermée

```
cultiver du maïs  →  nourrir le troupeau  →  bonheur  →  lait et viande  →  vendre
                          ↑
              ou acheter du fourrage au négociant
```

Le fourrage est la **première marchandise que le joueur achète** au lieu de la
vendre. C'est ce qui donne un sens économique au maïs : le produire coûte du
temps, l'acheter coûte de l'argent, et la ration conditionne toute la
production animale.

---

## Nouvelles marchandises

| Code | Nom | Unité | Cours | Vendable | Achetable |
|------|-----|-------|-------|----------|-----------|
| `MILK` | Lait | hL | 42 | Oui | Non |
| `MEAT` | Viande | t | 1 450 | Oui | Non |
| `HAY` | Fourrage | t | 95 | Oui | **Oui** |

Le négociant vend le fourrage **25 % plus cher qu'il ne le rachète** : produire
son propre maïs reste avantageux.

Le lait varie peu (30–62 CRD) : c'est un revenu régulier, pas un pari. La
viande oscille beaucoup plus (900–2 300).

---

## La faim

Un troupeau non nourri ne meurt pas — il maigrit et se stresse. La cible de
bien-être s'effondre, donc lait et viande suivent.

| Réserve | Pénalité de bien-être |
|---------|----------------------|
| Pleine | 0 |
| Moitié | ~0,27 |
| Vide | **0,55** |

C'est, avec le surpeuplement, le seul levier qui puisse pousser sous le
plancher de l'enfermement. Oublier de nourrir doit coûter cher.

Au pré, les bêtes se servent seules : la consommation tombe à **65 %**.

### Un piège d'échelle corrigé en cours de route

La ration était comptée en tonnes alors que les besoins d'une bête
s'expriment en kilos par jour. Une vache réclamait donc **14 tonnes de foin
par cycle**, et vingt tonnes achetées ne couvraient pas un seul repas —
le troupeau restait affamé quoi qu'on fasse.

Le stock se compte en tonnes, la ration en kilos, et `feedUnits()` fait la
conversion. Un test verrouille la règle : une tonne de foin doit nourrir une
bête plus de cinquante cycles.

---

## Les actions

| Action | Effet |
|--------|-------|
| **Nourrir** | Vide du fourrage ou du maïs du silo vers la réserve du troupeau |
| **Traire** | Convertit la production accumulée en hectolitres au silo |
| **Abattre** | Convertit des bêtes en tonnes de viande, définitivement |

La traite accumule entre deux passages, plafonnée à deux cycles : laisser
traîner ne fait pas fructifier. Un délai minimal empêche de traire en boucle.

L'abattage rend une viande d'autant plus lourde que la bête est âgée
(plateau à 30 cycles) et heureuse. La qualité passe à 4 au-dessus de 0,7 de
bien-être : un troupeau soigné se vend mieux.

---

## La courette à porcs

Nouveau bâtiment `PIG_YARD`, 2×3, 780 CRD — moins cher que l'enclos, parce
qu'une souille close n'est pas une prairie.

L'aire de sortie est **liée à l'espèce** : une étable appelle un enclos de
pâture, une porcherie une courette. Sortir des vaches dans une souille est
refusé, et l'inverse aussi.

En 3D, la courette est brune et boueuse là où l'enclos est vert.

---

## Les bâtiments changent de forme

Les niveaux ne faisaient que grandir de 16 %. Chaque palier remodèle
désormais la silhouette :

| Niveau | Silhouette |
|--------|-----------|
| 1 | Corps simple, toit à deux pans bas |
| 2 | **Appentis accolé** sur le flanc |
| 3 | **Pignon relevé** et lucarne |
| 4 | **Aile en L** qui déborde de l'emprise |
| 5 | **Toiture industrielle**, lanterneau, deux citernes et passerelle |

L'amélioration se lit de loin, sans avoir à comparer deux captures.

---

## Mesuré en jeu

```
achat de fourrage  : 20 t à 119,91 CRD/t = 2 398 CRD
ration distribuée  : 2 000 kg
traite             : 264 L → 2,64 hL au silo
abattage           : 180 kg · maturité 45 % · reste 5 bêtes
silo               : WHEAT 25 t · HAY 10 t · MILK 2,64 hL · MEAT 0,18 t
```

---

## Traité depuis

**Les cours ne saturent plus.** Trois marchandises sur cinq étaient collées à
leur plafond : le déséquilibre offre/demande poussait le prix sans jamais de
rappel. Un retour vers le prix de référence les fait respirer, et un test
simule cinq cents ticks pour interdire la récidive dans les deux sens.

**La ration au maïs est jouable.** Un second bouton la propose face au
fourrage. Mesuré : 110 L de lait par cycle au fourrage, **132 L au maïs** —
mais c'est du maïs qu'on ne vend pas.

**`feedConsumption` n'est plus du code mort.** Elle faisait doublon avec
`feedBurn`, qui ignorait le niveau d'étable ; c'est désormais elle qui calcule
la consommation, et l'isolation du bâtiment économise réellement du foin.

---

## Reste à faire

- Le lait et la viande sont marqués périssables mais ne se dégradent pas
  encore.
- Pas de reproduction : le cheptel ne croît que par achat.
