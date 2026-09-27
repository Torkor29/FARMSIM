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
| Terres | achat de parcelles du monde au devis (`askPrice`, `LAND_BASE_PER_HA` = 5 200 €/ha, escalade ×1,4 par parcelle possédée, `LAND_CAPS`), parcelles voisines travaillées sans changer de terrain | intact : ce sont les « annexes » de fin de partie |
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

### Un seul système de terrain, sans limite

Il n'y a plus qu'**une** façon d'avoir de la terre : agrandir sa ferme autour
d'elle. Acheter une parcelle ailleurs dans le monde (`/parcels/:id/buy`) est
fermé — on payait une parcelle, puis chaque lot autour, deux systèmes qui se
marchaient dessus. Le voisinage ne chiffre plus rien, ses pancartes « À vendre »
ont disparu, et la fiche d'une parcelle voisine comme le Bureau proposent
« Agrandir ma ferme », qui ouvre le mode construction. Les parcelles déjà
acquises restent à leur propriétaire et grandissent de la même façon.

La terre est découpée en **lots de 6×6 cases** (3,5 ha) sur une **trame
globale** : le lot `i:j` couvre les cases `6i…6i+5` × `6j…6j+5`, négatives
comprises. Les **bornes du domaine ne sont plus fixes** : c'est la boîte de ce
qu'on possède, calée sur la trame, plus **un anneau d'un lot** de friche à
vendre (`bornesDuDomaine`). Acheter un lot au bord repousse la friche d'un lot
dans cette direction seulement : la ferme grandit aussi loin qu'on veut, et son
bord, la friche, la caméra et la campagne suivent. Un lot est achetable s'il
touche par un côté une case possédée ; un coin qui ne touche que par un angle
est enclavé.

La limite de propriété n'est plus une clôture posée d'office : c'est un liseré
clair, montré en mode construction. Les **clôtures et les haies, c'est le
joueur qui les trace**, au glissé, où il veut (`/parcels/:id/amenagements/trace`
pose un objet d'une case sur chaque case valide du tracé, d'un seul paiement).

**Prix** : `cases × 505,6 €` (le prix de la terre du jeu : 5 200 €/ha, 14 ha
pour 144 cases) × **0,5** × fertilité × prix régional × **√(cases possédées /
144)**, arrondi aux 50 € supérieurs. Une escalade par lot (×1,18 à chaque achat)
faisait un mur : le trentième lot aurait coûté cent fois le premier. Avec la
racine, une ferme quatre fois plus grande paie sa terre deux fois plus cher,
seize fois plus grande quatre fois. À fertilité moyenne : premier lot ≈
10 200 €, ≈ 20 400 € à 576 cases, ≈ 40 800 € à 2 304 cases. Le premier lot coûte
à peu près la trésorerie de départ : c'est le premier vrai choix — un lot, une
machine ou un bâtiment. **Niveau** : un palier doux (`1, 1, 2, 3, 4, 5, 6, 7, 8,
10, 12, 14`), puis un niveau tous les deux lots, plafonné à 60.

### Terraformage : des lacs qu'on dessine

Creuser l'eau se fait **à main levée** (une mare, un lac, une rivière), dès le
niveau 1, à 30 €/case. L'eau n'est plus un carré bleu par case : c'est une
nappe d'un seul tenant (`apps/web/src/eau3d.ts`) creusée sous le pré, avec
sa berge d'herbe, son talus de terre et son fond.

- **La forme.** Chaque case d'eau sait quelle part d'elle est de l'eau : une
  rive recule d'une berge, un coin saillant prend son style, un coin rentrant
  s'adoucit d'un congé. On échantillonne cette forme finement et on en tire le
  contour, affiné par dichotomie : les arcs sont ronds, pas en escalier.
- **Les berges.** L'outil *Berges* (gratuit) vise un coin : il s'allume, le
  contour qu'il prendrait se dessine, et chaque clic le fait passer de rond à
  d'équerre puis en biseau. La forme tient dans `ParcelCell.forme` (deux bits
  par coin) ; reboucher une case l'oublie. Route : `POST /parcels/:id/berges`.
- **La dopamine.** La pelle fait gicler des mottes, l'eau monte dans le trou
  case après case dans l'ordre du geste, une éclaboussure l'accueille ; un
  coin retouché jette des éclats ; chaque geste a son son (synthétisé). Un lac
  qui franchit un palier (1, 4, 9, 16, 25… cases) se fête d'une fanfare et
  d'un message. L'eau vit : claire au bord, sombre au large, écume, reflets,
  nénuphars, roseaux, des canards dès six cases, un poisson qui saute.

### Relief, rivières, ponts et cascades

L'autre moitié du terraformage. Les règles vivent dans
`packages/shared/src/relief.ts`, le rendu dans `apps/web/src/domaine3d.ts`.

- **Les niveaux.** Une case a un niveau, de 0 (la plaine) à 3
  (`ParcelCell.niveau`). *Surélever* (40 €/case) et *Abaisser* (20 €/case) se
  tirent en rectangle, sur du pré, du champ nu ou un chemin ; le sol ne change
  pas. Entre deux niveaux se dresse une falaise : un socle, des strates, une
  lèvre d'herbe, quelques rochers. On cultive sur une terrasse comme en
  plaine ; **un bâtiment se pose en plaine**.
- **L'accès des engins.** Les engins arrivent par le bord de la ferme, en
  plaine, et roulent de case en case à niveau. L'eau les arrête, sauf sur un
  **pont** posé dans son axe (180 €). Une falaise les arrête aussi, sauf par
  une **rampe** posée au pied et tournée vers la terrasse (120 €, un niveau
  d'écart exactement). Un champ que les engins n'atteignent pas ne se travaille
  pas : les travaux, les demandes d'aide et les prestataires le refusent avec
  « N cases coupées de la cour… — posez un pont ou une rampe ». En
  construction, un voile orangé montre ces champs. Une ferme toute plate reste
  entièrement accessible, comme avant.
- **L'eau qui coule.** Deux cases d'eau voisines de niveaux différents font
  une **cascade**. Une étendue d'un seul niveau qui se déverse par une
  cascade **coule** vers elle : c'est une rivière, rayée de stries qui filent
  dans le sens du courant. L'étendue d'en bas reste un lac, sauf au pied de la
  chute où l'eau bouillonne. Chaque niveau a sa propre nappe. Une cascade a un
  rideau d'eau, une lèvre d'écume, des bouillons à son pied, et une brume qui
  monte au-dessus de la falaise. La brume la signale même quand elle tombe du
  côté opposé à la caméra. La première cascade se fête.
- **À quoi ça sert.**
  - Une rivière irrigue mieux qu'un lac : +4 % à 2 cases, en plus des +3 % de
    l'étang.
  - Un **coteau** rapporte +2 % : un champ en terrasse dont la voisine du sud
    est plus basse.
  - Le **moulin** tourne ×2 au bord d'une eau qui coule, et ×3 au pied d'une
    cascade (débit de l'atelier et bureau).
  - Chaque cascade ajoute +3 de charme, un pont +3, une rampe +1.

### La réserve naturelle

Le terraformage se fait surtout **à côté des champs**, sur une terre faite
pour lui. Chaque case a une vocation (`ParcelCell.vocation`) : culture ou
nature.

- **Acheter.** Un lot de friche s'achète au choix en terre de culture (prix
  habituel) ou en **réserve naturelle**, au quart du prix
  (`PART_PRIX_NATURE`). Le dialogue d'achat propose les deux.
- **Ce qu'on y fait.** Tout le terraformage : relief, eau, bois, prairies,
  haies, décor. Ce qu'on n'y fait pas : un champ, un bâtiment. Seule
  exception, le rucher (`BATIMENTS_EN_RESERVE`).
- **Changer d'avis.** L'outil *Réserve ou culture* (onglet Terrain) touche un
  lot à soi :
  - une réserve se rend à la culture en payant la différence avec le prix
    agricole du jour ;
  - une terre de culture passe en réserve gratuitement, sans remboursement,
    une fois le lot libre (ni culture en terre, ni bâtiment autre qu'un
    rucher). Ses champs nus redeviennent du pré.
  - Route : `POST /parcels/:id/lots/vocation`.
- **À l'écran.** Une prairie non fauchée : herbes hautes, coquelicots,
  bleuets, marguerites, boutons d'or. Une limite en piquets et cordelette,
  toujours visible. Sur les lots à vendre, le prix en réserve s'affiche sous
  le prix agricole.

### La biodiversité

Règles dans `packages/shared/src/biodiversite.ts`.

- **Les habitats** se lisent sur les cases et le décor, sans rien saisir :
  - prairie fleurie (pré de réserve) et pré fauché ;
  - massif fleuri, haie, buissons, arbre isolé ;
  - jeune bois, futaie, vieux bois (2 ans) et lisière ;
  - mare, rivière, roselière ;
  - rocaille (bord de falaise).

  Le gros terraformage fait en terre de culture compte **deux fois moins**
  qu'en réserve.
- **Cinq groupes de faune** : pollinisateurs, auxiliaires, oiseaux, rapaces,
  faune des mares. Chacun a ses affinités (`AFFINITES`) et une cible qui
  sature. Les rapaces veulent un perchoir et de la prairie où chasser.
- **La mosaïque paie** : de 0,55 pour un seul habitat à 1 à partir de sept.
- **Le temps.** Chaque groupe s'installe avec sa demi-vie : un jour de jeu
  pour les pollinisateurs, six pour les rapaces. Il part deux fois plus vite
  qu'il ne vient. La faune est stockée sur la ferme (`Farm.fauneJson`) et
  rattrapée à chaque lecture du domaine.
- **La décoration libre compte** : nichoirs, bains d'oiseaux, ruches en
  paille, fleurs, lavande, roseaux, mares, arbres, rochers, chacun avec un
  plafond (`refugesDecor`).
- **Calibrage.** Un lot de réserve bien aménagé vise environ 35/100, trois
  lots approchent 80.
- **À l'écran.** La pastille 🐝 du panneau de construction donne le score et
  sa cible (« 0 · Terre nue ↗ 34 »). Touchée, elle ouvre la fiche des cinq
  groupes (population, cible, habitats préférés), la légende, un conseil, et
  la **carte des habitats** sur le terrain.

### Ce que la biodiversité rapporte

Tout est en bonus, jamais en malus : une ferme qui ignore la nature tourne
comme avant.

- **Pollinisation sauvage** : colza et pois, jusqu'à +6 %. L'effet suit la
  population de pollinisateurs : plein à 4 cases des fleurs (prairie, massif,
  lisière, haie), puis il décroît sans tomber sous un quart. Il s'ajoute au
  rucher (+8 %).
- **Régulation naturelle** : toute culture, jusqu'à +4 %. L'effet suit les
  auxiliaires (60 %) et les oiseaux (40 %), à 5 cases de leurs abris (haie,
  buissons, lisière, prairie, arbre, jeune bois).
- **Élevage** : un paysage vivant (haie, bois, mare, prairie) à trois cases
  d'un abri lui vaut un **point d'installation** de plus, au même titre que
  l'enclos, l'abreuvoir ou le râtelier. L'écran d'élevage l'affiche.
- **Aides agro-environnementales** : chaque jour de jeu, 20 € par saison et
  par case de réserve aménagée (plafond 400 cases), pleines à partir d'un
  score de 50. Versées au journal sous « Aides », avec un rattrapage d'une
  saison au plus. Une réserve d'un lot en bonne santé rapporte environ
  720 € par saison.
- **Floraison** : la réserve refleurit à mesure que les pollinisateurs
  s'installent, de deux à sept fleurs par case.
- La fiche de biodiversité dit ce que tout cela vaut aujourd'hui.

### La faune vivante et le carnet de nature

- **À l'écran** (`apps/web/src/faune3d.ts`) : la quantité suit la population
  de chaque groupe.
  - des papillons et des abeilles sur les fleurs ;
  - des bandes d'oiseaux autour des haies et des bois ;
  - une buse qui plane en grands cercles dès que les rapaces s'installent ;
  - des libellules qui filent au ras des mares ;
  - des grenouilles qui sautent sur les berges.

  Chaque espèce est un seul maillage instancié.
- **Le carnet** (`packages/shared/src/especes.ts`) compte 32 espèces : osmie,
  machaon, coccinelle, hérisson, mésange, pic vert, loriot, grue cendrée,
  buse, chouette hulotte, grand-duc, grenouille, héron, martin-pêcheur,
  salamandre, etc. Chacune a :
  - un seuil de population ;
  - parfois un habitat exigé (6 cases de futaie pour la hulotte, 8 de rocaille
    pour le grand-duc, une rivière pour le martin-pêcheur) ;
  - parfois une saison.
- **Les observations.** Chaque jour de jeu, une espèce qui peut se montrer a
  de 8 % à 38 % de chances de le faire. Le tirage est déterministe (ferme,
  espèce, jour), rattrapé à la lecture sur 14 jours au plus, sans rien
  rattraper avant la première lecture. Le carnet est stocké sur la ferme
  (`Farm.carnetJson`, `carnetJour`).
- **La fête.** Une première observation déclenche un trille d'oiseau et un
  message (« 🦅 Première observation : Faucon crécerelle ! »). Chaque espèce
  vue ajoute un point de charme.
- **Le carnet à l'écran.** On l'ouvre depuis la fiche de biodiversité. Les
  espèces vues ont leur note et leur date ; les autres, leur silhouette et
  l'indice de ce qu'il leur faut.

### Le bois

Règles dans `packages/shared/src/bois.ts`, rendu dans `verserBois`
(`apps/web/src/domaine3d.ts`).

- **Planter.** *Boiser* (onglet Nature, 25 €/case, tracé à main levée) fait
  d'un pré ou d'un champ nu un sol `BOIS`. L'âge des arbres est dans
  `ParcelCell.boiseDepuis`. La pousse passe par trois stades : des plants dans
  leurs manchons, un jeune bois (à 30 % de la pousse), puis une futaie au bout
  d'une année de jeu (≈ 36 h réelles). Feuillus et résineux sont mêlés, sur
  une litière. Une futaie a parfois ses champignons. Aucun travail entre-temps.
- **Couper.** *Couper* (même onglet) se tire en rectangle sur une futaie. La
  scierie paie 70 € la case (poste « Cultures » du journal). Les souches
  rejettent : la case repart en plants, sans rien racheter. Seule une case **à
  la lisière** se coupe, c'est-à-dire voisine d'une case où roulent les
  engins ; le cœur d'un grand bois demande un chemin. Un chemin se trace à
  travers le bois (c'est un layon : la case redevient du pré). Les arbres
  tombent un par un, avec copeaux, feuilles et le son de la hache.
- **Ce qu'il change.**
  - Un bois levé (jeune bois ou futaie) coupe le vent : +3 % à 2 cases. Il
    remplace la haie (+2 %) au lieu de s'y ajouter.
  - Le charme monte de +0,25 par case de jeune bois et +0,5 par case de futaie.
  - Un bois **arrête les engins** comme l'eau : un champ enclos derrière un
    bois ne se travaille plus, jusqu'à ce qu'un chemin l'ouvre.
  - Survolé avec *Couper*, un bois dit son stade et le temps qu'il lui reste
    avant la coupe.
- **Défricher.** *Remettre en herbe* rend le pré.

### Coûts d'aménagement

| Geste | Coût | Rendu à la suppression |
|---|---|---|
| Mettre en culture (pré → champ) | 12 €/case | rien (retour en pré gratuit si la case est nue) |
| Creuser un étang | 30 €/case | remblai 8 €/case |
| Surélever / abaisser d'un niveau | 40 / 20 €/case | rien |
| Pont / rampe | 180 / 120 € | 50 % |
| Lot en réserve naturelle | ¼ du prix agricole | la différence pour le rendre à la culture |
| Boiser | 25 €/case | rien (la coupe rapporte 70 €/case de futaie, chaque année) |
| Chemin de terre / gravier / pavés | 4 / 9 / 18 €/case | rien |
| Objet de décor | 25 à 400 € | 50 % (100 % dans la fenêtre de regret) |
| Bâtiment | inchangé | inchangé (40 %, 100 % dans la fenêtre de regret) |

### Effets du décor (peu, et lisibles)

- **Haie** : brise-vent, +2 % de rendement sur les champs à 2 cases ou moins.
- **Étang** : irrigation, +3 % sur les champs à 3 cases ou moins.
- **Rivière** (eau qui coule) : +4 % de plus à 2 cases ou moins.
- **Coteau** : +2 % sur un champ en terrasse exposé au sud.
- **Bois** : brise-vent, +3 % à 2 cases (remplace celui d'une haie).
- **Arbres, fleurs, chemins, bancs…** : pas de bonus de rendement, mais ils
  comptent dans le **charme** de la ferme, affiché (et prêt pour de futurs
  classements).

Bonus non cumulables d'une même source, plafonnés à +8 %. Une ferme jolie ne
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
