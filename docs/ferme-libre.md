# La ferme libre — conception

Branche `claude/farmsim-ferme-libre`. Ce document fixe les choix avant
l'implémentation ; il s'appuie sur le code tel qu'il est, pas sur un plan
générique.

## 1. Ce qui existe (audit)

| Sujet | Où | Ce qu'on en garde |
|---|---|---|
| Stack | pnpm monorepo — `apps/api` (Express, Prisma, Postgres, un `main.ts` de 14 k lignes), `apps/web` (React + Vite + three.js), `packages/shared` (règles pures), `packages/sim` | tout |
| Terrain | `Parcel` (`gridW`×`gridH`, 12×12 au départ = 14 ha) et une ligne `ParcelCell` par case | la case reste l'unité ; **une ligne = une case possédée** |
| État agricole | `ParcelCell` : culture, stade, adventices, fumure, chaumes, rotation… | intact : le moteur économique ne bouge pas |
| Bâtiments | `Building` (origine, `rotation` en quarts de tour, niveau), `orientedFootprint`, routes `build` / `rotate` / `move` / `sell`, fenêtre de regret, `buildingMoveCost`, `buildingResaleValue` | réutilisés tels quels ; seule la validation de place change |
| Terres | achat de parcelles du monde au devis (`askPrice`, 420 €/ha, escalade ×1,4 par parcelle possédée, `LAND_CAPS`), parcelles voisines travaillées sans changer de terrain | intact : ce sont les « annexes » de fin de partie |
| Économie | 12 000 € au départ ; blé 0,35 t/case en 28 h pour 15 € de semence ; bâtiments de 1 050 € (râtelier) à 28 000 € (laiterie) | calibre les nouveaux prix |
| Effet spatial | `pollinationBonusAt` : les ruches aident colza et pois à portée | même mécanique pour les effets du décor |
| Travaux des champs | tous passent par `resolveFieldAccess` | c'est là qu'on exige une case de champ |
| Migrations | SQL Prisma à la main + reprises idempotentes au démarrage (`redecouperLesLotsLibres`) | même méthode |
| Rendu | `IsoFarmView.tsx` : une dalle `Mesh` par case, recolorée à chaque image ; île centrée ; cour de stationnement à l'ouest ; campagne autour | dalles passées en **instances** (une grille de 24×24 ferait 576 appels de rendu) |
| Construction côté jeu | outil `BUILD` : fantôme au survol, place figée au clic, rotation, confirmation, déplacement ; validation **recopiée** du serveur | fantôme gardé, validation remplacée par un module partagé unique |

### Problèmes du système actuel

1. **Tout est champ.** Chaque case est cultivable ; il n'existe ni pré, ni
   chemin, ni eau. Deux fermes de même niveau se ressemblent forcément.
2. **La grille est figée.** Grandir, c'est acheter une autre parcelle ailleurs
   sur la carte, séparée de la ferme par un chemin : la ferme ne s'agrandit pas,
   elle se disperse.
3. **La validation de place est écrite deux fois**, côté jeu et côté serveur,
   bornée à `gridW`/`gridH` : impossible d'y ajouter une règle sans la recopier.
4. **Le rendu ne tient pas une grande ferme** : une dalle et un matériau par
   case, une boucle sur toutes les cases à chaque image.

## 2. Modèle retenu

### Terrain et propriété

- Le **siège** d'une ferme (sa première parcelle, celle de la cour) devient un
  **domaine** : sa grille d'origine plus une **marge** tout autour
  (`Parcel.domaineMarge`, 6 cases). Une ferme de 12×12 s'inscrit dans un domaine
  de 24×24 : quatre fois sa surface de départ.
- **Une ligne `ParcelCell` = une case possédée.** Les cases du domaine sans
  ligne sont en **friche** : visibles, achetables, inutilisables. Les
  coordonnées peuvent être négatives (la marge ouest et nord) : **aucune donnée
  existante n'est déplacée**, aucun chantier ni ordre de travail n'est réécrit.
- Chaque case possédée porte un **sol** (`SolCase`) : `CHAMP` (cultivable),
  `PRE` (herbe, libre pour bâtir et décorer) ou `EAU` (étang) — et un
  **revêtement** facultatif (`TERRE`, `GRAVIER`, `PAVE`) : les chemins.
- Les parcelles annexes achetées sur la carte ne changent pas (marge 0, tout en
  champ).

### Champs

Un champ n'est plus une parcelle : c'est une **zone de cases `CHAMP` contiguës**
que le joueur peint où il veut. `champsDe()` (partagé) en déduit des
`FieldEntity` — identifiant, cases, surface, cultures, état — sans table en plus.
La culture reste **par case** : semis, croissance, rendement, adventices,
rotation, chaumes, historique ne changent pas. Seule règle nouvelle : les
travaux (`resolveFieldAccess`) refusent une case qui n'est pas un champ.

### Objets posables : un catalogue

`packages/shared/src/amenagement.ts` décrit tout ce qui se pose, en données :

```ts
{
  id: "haie", categorie: "NATURE", nom: "Haie", pose: "OBJET",
  emprise: { w: 1, h: 1 }, rotations: [0], prix: 60, revente: 0.5,
  niveauMin: 1, regle: "DECOR", connecte: true,
  effet: { bonusRendement: 0.02, portee: 2, cultures: "TOUTES" },
}
```

Trois façons de poser (`pose`) :

- `TERRAIN` — on **peint** des cases (champ, pré, étang, chemins) en glissant ;
- `OBJET` — arbres, haies, clôtures, bancs, lampadaires, rochers, bottes… dans
  une table `Amenagement` (type, origine, rotation) ;
- `BATIMENT` — renvoie vers `BUILDING_DEFS` et les routes existantes.

Ajouter un objet, c'est ajouter une entrée (et, si besoin, un rendu).

### Occupation et collisions

Chaque case a trois **couches** : `sol`, `surface` (chemin), `volume`
(bâtiment, objet, culture). Chaque entrée du catalogue déclare une **règle**
(`CHAMP`, `PRE`, `EAU`, `CHEMIN`, `DECOR`, `BATIMENT`) qui dit quels sols elle
admet, quelles couches elle occupe et si elle transforme un champ nu en pré.
`validerPose()` rend `{ ok, raison, cases, cout }` : la **même** fonction sert
au serveur (refus) et au jeu (fantôme vert ou rouge, avec la raison). Aucune
chaîne de `if` par objet : un tableau de règles.

Exemples : une grange ne se pose ni sur un étang ni sur un semis ; un champ ne
se peint pas sous un bâtiment ; un chemin passe sur du pré, pas dans l'eau ;
rien ne se pose en friche.

### Rotation

Quarts de tour, comme les bâtiments : `empriseOrientee()` permute largeur et
profondeur pour les quarts impairs (une grange 3×4 tournée occupe 4×3).

### Extensions de terrain : des lots

Le domaine est découpé en **lots de 6×6 cases** (3,5 ha). Un lot est
achetable s'il touche par un côté une case déjà possédée : la ferme pousse
dans la direction que le joueur choisit, et sa silhouette devient la sienne.

**Prix** : `36 cases × 40,8 €` (le prix de la terre du jeu, 420 €/ha) × fertilité
× prix régional × **1,28 par lot déjà acheté**. Premier lot ≈ 1 500 €, sixième ≈
5 000 €, douzième ≈ 22 000 € — le douzième coûte le prix d'une étable ; les
premiers, celui d'un petit bâtiment. On hésite donc réellement entre un lot, une
machine et un agrandissement de bâtiment. **Niveau** : un palier doux (`1, 1,
2, 3, 4, 5, 6, 7, 8, 10, 12, 14`), pas de mur artificiel.

### Coûts d'aménagement

| Geste | Coût | Rendu à la suppression |
|---|---|---|
| Mettre en culture (pré → champ) | 12 €/case | rien (retour en pré gratuit si la case est nue) |
| Creuser un étang | 30 €/case | remblai 8 €/case |
| Chemin de terre / gravier / pavés | 4 / 9 / 18 €/case | rien |
| Objet de décor | 25 à 400 € | 50 % (100 % dans la fenêtre de regret) |
| Bâtiment | inchangé | inchangé (40 %, 100 % dans la fenêtre de regret) |

### Effets du décor (peu, et lisibles)

- **Haie** : brise-vent, +2 % de rendement sur les champs à 2 cases ou moins.
- **Étang** : irrigation, +3 % sur les champs à 3 cases ou moins.
- **Arbres, fleurs, chemins, bancs…** : pas de bonus de rendement, mais ils
  comptent dans le **charme** de la ferme, affiché (et prêt pour de futurs
  classements).

Bonus non cumulables d'une même source, plafonnés à +5 %. Une ferme jolie ne
paie donc aucune pénalité, et une ferme optimisée n'a pas de disposition
unique : haies et étangs se placent où l'on veut.

### Sauvegarde et migration

- Migration SQL : enum `SolCase`, colonnes `ParcelCell.sol` (défaut `CHAMP`,
  donc toutes les fermes existantes restent entièrement cultivables),
  `ParcelCell.revetement`, `Parcel.domaineMarge`, `Parcel.lotsAchetes`, table
  `Amenagement`. Les cases sous un bâtiment passent en `PRE`. Les sièges
  existants reçoivent leur marge.
- Une nouvelle ferme reçoit son domaine à l'inscription.
- Rien n'est recalculé à la lecture : la ferme rechargée est exactement celle
  qu'on a quittée (cases, sols, chemins, objets, bâtiments, rotations).

### Mode construction (jeu)

- Un bouton **Construire** (et `B`) ouvre le mode : la vue se recule sur le
  domaine, la grille apparaît discrètement, la friche montre ses lots
  achetables avec leur prix.
- Une barre en bas : catégories (Terrain, Agriculture, Bâtiments, Élevage,
  Nature, Chemins, Décoration) et leurs objets, verrouillés au besoin avec la
  raison.
- Objet choisi → fantôme vert ou rouge sous le curseur, avec la raison (« case
  en friche », « occupé par un bâtiment », « € insuffisants »…) ; `R` tourne ;
  clic pose ; le mode reste armé pour poser le suivant ; `Échap` ou clic droit
  annule.
- Terrain et chemins : on **glisse** un rectangle, le coût s'affiche.
- Clic sur un objet posé : Déplacer, Tourner, Vendre (confirmation pour un
  bâtiment).
- Chemins, haies, clôtures et étangs se **raccordent** tout seuls à leurs voisins.

## 3. Préparé pour la suite (non implémenté)

Visite des fermes (le domaine est une donnée publique comme les autres),
classement « charme », décor saisonnier (le rendu lit la saison), véhicules sur
les chemins (les chemins sont un graphe de cases), objets limités (champ
`niveauMin` et futur `deblocage`).
