# 39 — Travail du sol : déchaumage ou labour

**Statut :** Implémenté  
**Date :** 2026-08-12  
**Voir aussi :** [38_HARVEST_WINDOW](./38_HARVEST_WINDOW.md)

---

## Le principe

Une moisson ne rend pas une case nue : elle laisse des **chaumes**. On ne
resème pas dessus. Le joueur choisit alors entre deux outils, et c'est un vrai
arbitrage, pas une formalité.

| Outil | Coût / case | Effet sur le compteur | Bonus |
|-------|-------------|----------------------|-------|
| **Déchaumeur à disques** | 5 CRD | Inchangé | Résidus incorporés → rendement |
| **Charrue** | 12 CRD | **Remis à zéro** | Aucun, mais entretient le sol |

Au bout de **3 récoltes sans labour**, le déchaumeur refuse : sol tassé,
pression d'adventices trop forte. La charrue devient obligatoire.

---

## Le déchaumeur

Travail superficiel, 5 à 15 cm. Il incorpore la paille de la récolte
précédente, qui se décompose et nourrit la culture suivante. Il fait aussi un
faux-semis, donc il **détruit les adventices** (`weedsControlled = true`).

Le gain est **décroissant** — la première incorporation apporte l'essentiel de
la matière organique disponible :

| Déchaumages consécutifs | Bonus de rendement |
|-------------------------|--------------------|
| 1 | +5 % |
| 2 | +9 % |

Sans cette décroissance, la stratégie optimale serait triviale.

C'est une machine à part (`DISC_HARROW`, 2 100 CRD) : sans elle, seule la
charrue est possible. Elle s'use moins qu'un tracteur, puisqu'elle ne
retourne rien.

---

## Mesuré en jeu

Trois cycles enchaînés sur les mêmes cases, blé, tout le reste égal :

| Cycle | Sol avant semis | Récolte |
|-------|-----------------|---------|
| 1 | Labouré | **0,330 t** |
| 2 | 1 déchaumage | **0,524 t** |
| 3 | 2 déchaumages | **0,544 t** |

Puis, à la quatrième tentative :

```
Sol épuisé après 3 récoltes — le labour est obligatoire
2 cases labourées · 24 CRD · fertilité +0.016
après labour : récoltes=0 résidus=0 chaumes=False
```

L'écart entre le cycle 1 et le cycle 2 dépasse le seul bonus de résidus : le
faux-semis du déchaumeur maîtrise aussi les adventices, ce que le labour du
départ ne faisait pas.

---

## La charrue

Elle traite deux situations : les chaumes après moisson, et les cultures
perdues faute d'avoir été récoltées à temps.

- Sur des chaumes, c'est un **entretien** : elle décompacte et enfouit la
  pression d'adventices, donc elle **regagne** 0,008 point de fertilité par case.
- Sur une culture perdue, elle **coûte** 0,01 point de fertilité par case.

Un labour d'entretien améliore donc le sol, un rattrapage l'appauvrit.

---

## Ce que voit le joueur

| Signal | Contenu |
|--------|---------|
| Couleur de la case | Chaume clair après moisson, terre sombre une fois les résidus incorporés |
| Encart d'alerte | Nombre de cases en chaumes, et combien exigent la charrue |
| Inspection | « Chaumes · 2 récoltes avant labour », ou « Résidus incorporés · +5 % de rendement » |
| Refus de semis | « Case 9,9 : chaumes en place — déchaumez ou labourez d'abord » |

---

## Données et API

Trois champs s'ajoutent à `ParcelCell` : `harvestsSincePlow`, `residuePasses`,
`hasStubble`.

| Route | Effet |
|-------|-------|
| `POST /parcels/:id/stubble` | Incorpore les résidus, compteur inchangé, refuse au seuil |
| `POST /parcels/:id/plow` | Remet le sol à zéro, bonus compris |
| `POST /parcels/:id/plant` | Refuse une case portant des chaumes, sauf en semis direct |
| `POST /parcels/:id/contractor` | Accepte `work: "STUBBLE"` |

---

## Le semis direct, troisième voie

Déchaumer ou labourer supposait qu'il fallait forcément travailler le sol. Le
semis direct s'en dispense : le semoir ouvre un sillon dans les chaumes et
referme derrière lui. Un passage entier économisé, un sol qui garde son
humidité et sa structure, et une couverture permanente qui le protège de
l'érosion.

Ce n'est pas gratuit. Les résidus restent en surface au lieu d'être
incorporés, donc aucun bonus de décomposition — le compteur de résidus
retombe à zéro. La terre se réchauffe plus lentement au printemps et la levée
est moins régulière, d'où la perte de rendement. Surtout, rien ne décompacte :
le semis direct fait avancer le compteur du labour obligatoire au lieu de le
laisser en place, si bien qu'on ne peut pas en vivre indéfiniment.

| | Coût / case | Rendement | Compteur labour | Résidus |
|---|---|---|---|---|
| Déchaumage | 5 CRD | +5 % puis +9 % | inchangé | incorporés |
| Labour | 12 CRD | — | remis à zéro | effacés |
| Semis direct | 3 CRD | −10 % | **+1** | laissés en surface |

L'arbitrage tient debout : le semis direct est le moins cher et le plus
rapide, mais c'est celui qui rapproche le plus vite de la charrue obligatoire.

Il exige des chaumes — sans eux, c'est un semis ordinaire et le joueur
paierait le surcoût du semoir lourd pour rien — et il est refusé dès que le
sol réclame la charrue, puisqu'il ne décompacte pas.

`ParcelCell.directSeeded` mémorise le choix ; `POST /parcels/:id/plant`
accepte `directSeed: true`. Vérifié contre l'API réelle : −9,8 % de rendement
et le compteur de labour passé de 1 à 2 sur la case semée en direct.

---

## Le sol devait se voir, pas seulement se calculer

Signalé en jeu, et c'est le meilleur résumé du défaut : « j'ai labouré et
pourtant je peux pas replanter, ça me dit qu'il faut que je laboure ; quand je
veux labourer, ça me dit qu'il n'y a rien à labourer. »

Aucune de ces deux réponses n'était fausse. Elles portaient simplement sur des
cases différentes — et **rien ne permettait de les distinguer à l'écran**. Le
joueur sélectionnait à l'aveugle, croyait avoir traité une case, et se voyait
opposer une règle qu'il ne pouvait pas vérifier.

Le comble : `cropColor` savait décrire les états du sol depuis le début. Mais
elle n'était appelée que pour les cases portant une culture. Les cases vides
gardaient leur damier vert, quel que soit leur état. La fonctionnalité existait
et n'était jamais affichée.

### Un relief par état

La couleur seule ne suffisait pas — la demande était explicite : « pas une
case, une gueule de terre ». Chaque état porte donc une matière :

| État | Couleur | Relief |
|------|---------|--------|
| Terre normale | vert terreux | aucun |
| Terre labourée | brun profond | sillons parallèles |
| Terre déchaumée | brun moyen | résidus hachés, épars et plats |
| Chaumes | paille claire | tiges coupées dressées |
| Terre sèche | ocre gris | craquelures, décalées d'une case à l'autre |

Tout passe par des maillages instanciés : un seul appel de dessin par type de
relief, quelle que soit la surface concernée. La leçon des passes de
performance précédentes valait d'être retenue.

### L'ordre de lecture compte

Le déchaumage et le labour laissent tous deux `fieldStage: "PREPARED"`. Seul le
compteur de résidus les sépare, que le labour remet à zéro. Les résidus se
lisent donc **avant** l'état préparé — sans quoi une terre déchaumée aurait
l'aspect d'un labour, et le joueur croirait son sol remis à neuf alors que le
compteur de récoltes court toujours.

### Les cultures aussi

Le maïs monte plus haut et plus étroit que le blé : on reconnaît une culture à
sa silhouette avant sa teinte. Une culture desséchée s'affaisse et penche, pour
se lire comme une perte et non comme une récolte qui attend. Des épis coiffent
les cultures mûres — plusieurs et fins pour le blé, un seul et trapu pour le
maïs — ce qui signale la récolte sur la grille même, sans passer par un
panneau.

### Le blocage lui-même

Par précaution, le labour accepte désormais une case arrivée à la limite de
récoltes même sans chaumes visibles. La refuser enfermerait le joueur, puisque
le déchaumage et le semis direct la refusent déjà pour cette raison exacte.

Et quand la sélection ne contient rien à labourer, le message ne se contente
plus de le constater : il indique combien de cases attendent la charrue
ailleurs sur la parcelle. Dire à quelqu'un ce qu'il ne peut pas faire ne l'aide
pas ; lui dire où aller, si.

**La leçon :** une règle que le joueur ne peut pas vérifier à l'écran est vécue
comme un bug, même quand elle fonctionne exactement comme prévu.

---

## Reste à faire

- Les résidus ne dépendent pas du volume récolté, alors qu'une grosse moisson
  laisse plus de paille
- Les adventices ont un effet de rendement mais aucune représentation : la
  planche de référence du joueur en prévoyait une
- Le relief est le même quelle que soit l'orientation de la case : de vrais
  sillons suivraient le sens du travail
- Le semis direct ne demande aucun désherbage supplémentaire, alors que c'est
  sa contrainte principale en pratique
- Aucun outil intermédiaire — décompacteur, strip-till — entre le déchaumeur
  et la charrue
