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

### Des parcelles entières, qu'on achète à côté et qu'on réunit

On démarre avec **sa parcelle entière** (12×12), et l'on s'agrandit comme dans
un jeu de ferme : en rachetant **la parcelle d'à côté**, entière — libre, ou
cédée par une ferme PNJ, jamais celle d'un autre joueur. Il y a eu des lots de
6×6 à grappiller autour de sa parcelle pour la compléter, carré par carré :
« je préfère pouvoir acheter les parcelles voisines ». Les lots ont disparu
(`/parcels/:id/lots/buy` répond 410) ; ce qui a été acheté ainsi reste.

- **Ce qui s'achète.** Une parcelle collée par un côté à l'une des siennes
  (`colleeAuxSiennes`) — de l'autre côté d'un chemin ou de la route s'il le
  faut, jamais en diagonale ni plus loin. Le paysage la marque d'une pancarte
  « À vendre » ; sa fiche donne la surface, la culture, le prix, et
  « Acheter / Racheter cette parcelle », ou le refus du serveur. Les
  parcelles du catalogue vont de 8×8 à 16×16 cases. Les plafonds de niveau et
  de nombre de parcelles (`canAcquire`) s'appliquent.
- **Prix** (`prixParcelle`) : le barème de la terre du jeu, celui qu'avaient
  les lots — `cases × 505,6 €` (5 200 €/ha, 14 ha pour 144 cases) × 0,5 ×
  fertilité × prix régional × √(cases possédées / 144), arrondi aux 50 €.
  Une 10×10 vaut environ 23 000 € en début de partie, une 14×14 environ
  47 000 € ; plus la ferme est grande, plus sa terre se paie cher, en pente
  douce. Une parcelle PNJ se rachète avec son bâti et son cheptel ; ses
  engins restent au voisin.
- **Le paysage.** La parcelle achetée reste exactement où on l'a vue, et son
  chemin d'accès se construit depuis la route. Les parcelles à soi et à
  vendre se dessinent aussi en amont (la lisière recule derrière elles), et
  l'orientation de la commune ne dépend plus que de sa géographie : acheter
  ne fait plus pivoter le pays. Le domaine s'arrête au bord de ce qu'on
  possède ; la campagne à façonner commence juste derrière.

**Réunir.** Deux parcelles à soi, collées et séparées par un **chemin de
terre**, se réunissent en **un seul champ** (`POST /parcels/:id/reunir`). On
touche dans le paysage la parcelle qu'on veut réunir à celle où l'on est : sa
fiche propose « Réunir en un seul champ », avec le prix — 50 € par case de
chemin défrichée, nivelée et labourée (`PRIX_REUNION_PAR_CASE`), 84 cases pour
deux parcelles de 12 et 14 cases, soit 4 200 €.

- **Ce qui ne s'efface pas.** La **route goudronnée**, qui court entre le
  rang du siège et le suivant d'un bout à l'autre de la commune
  (`separeesParLaRoute`), et la **cour** du siège, entre lui et sa voisine de
  l'ouest (`separeesParLaCour`). Ces deux-là se refusent avec leur raison.
- **Ce qui se passe.** Le siège reçoit toujours (il porte la cour) ; sinon,
  la parcelle d'où l'on réunit. L'autre lui passe ses cases, ses bâtiments
  (et leurs troupeaux), son décor, sa campagne façonnée et ses caisses
  livrées, décalés de sa place sur la trame (`decalageDansHote`). Le chemin
  entre les deux devient du champ, sur toute la longueur où elles se font face
  (`couloirEntre`) ; ce qu'on y avait creusé ou planté dans la campagne passe
  dans la ferme tel quel. La parcelle absorbée reste à la ferme
  (`Parcel.fusionneeDans`) — c'est toujours sa case de la commune, elle compte
  dans ce qu'on possède et ouvre ses propres voisines à l'achat — mais elle ne
  se joue plus à part. On peut réunir de proche en proche : trois, quatre,
  neuf parcelles finissent en un champ immense. Refusé tant qu'un chantier
  tourne sur la parcelle absorbée.
- **La trame tombe juste.** Son pas vaut un nombre entier de cases
  (`PAS_TRAME_CASES` = 20) : une parcelle réunie se pose exactement à sa
  place, et réunir par étapes ou d'un coup donne la même île. L'orientation de
  la commune vient du serveur (`quart` du voisinage, fixée par le siège) : le
  paysage et la réunion lisent la même.
- **À l'écran.** L'île est calée sur la grille d'origine de sa parcelle, plus
  sur son rectangle englobant : la partie réunie se dessine là où était la
  parcelle. Le socle est une dalle par rectangle de cases
  (`rectanglesDeCases`) et la haie suit le bord réel des cases
  (`pansDeHaie`) — une île en L ou en T ne couvre jamais le champ du voisin
  qui occupe l'encoche, et la haie passe autour, jamais entre. Vue depuis une
  autre parcelle, une île réunie se dessine d'un seul tenant : pas de haie
  entre ses morceaux, et une bande de champ à la place du chemin. La caméra
  vise le milieu de l'île, et ne recule pas au-delà d'une grande parcelle et
  demie : une ferme de neuf parcelles se parcourt à la molette.

La limite de propriété n'est plus une clôture posée d'office : c'est un liseré
clair, montré en mode construction. Les **clôtures et les haies, c'est le
joueur qui les trace**, au glissé, où il veut (`/parcels/:id/amenagements/trace`
pose un objet d'une case sur chaque case valide du tracé, d'un seul paiement).

### Terraformage : des lacs qu'on dessine

> Ces gestes se font désormais **dans la campagne**, autour de la ferme, et
> non plus sur elle : voir « La campagne à façonner ».

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

> Ces gestes se font désormais **dans la campagne**, autour de la ferme, et
> non plus sur elle : voir « La campagne à façonner ».

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

### La campagne à façonner

Le gros terraformage (relief, eau, bois, prairies) se fait **hors de la
ferme** : dans la campagne qui l'entoure, juste derrière son bord. La
ferme garde sa place pour les cultures, et la campagne devient un terrain
de jeu à part, où l'on revient façonner entre deux chantiers.

- **Où.** Partout à 30 cases au plus des bornes du domaine
  (`dansCampagne`, `PORTEE_CAMPAGNE`), hors de la ferme. La vue refuse une case sous une route, la cour, le village ou le
  champ d'un voisin (« Une route, la cour, le village ou le champ d'un
  voisin est là ») : c'est elle qui connaît la campagne, comme pour la
  décoration libre.
- **Quoi.** Creuser (lacs, rivières, berges), surélever et abaisser
  (buttes, falaises, cascades), boiser et couper, semer une **prairie
  fleurie** (10 €/case), remettre en herbe. On paie le geste, pas la terre.
  En campagne, un bois se coupe partout : pas d'engins, pas de lisière à
  respecter.
- **Sur la ferme.** Relief, eau, bois et prairie y sont refusés (« Relief,
  eau, bois et prairies se font dans la campagne, autour de la ferme »). Les
  lacs et reliefs déjà faits restent, et se façonnent encore : berges,
  coupe, remise en herbe, ponts et rampes. Champs, prés, chemins, haies,
  clôtures et décor se posent sur la ferme comme avant.
- **Stockage.** La table `CaseCampagne` (parcelle, x, y, sol, fleurie,
  niveau, forme, âge du bois), dans le repère des cases du siège. Seules les
  cases façonnées existent : une case absente est de l'herbe. Routes :
  `POST /parcels/:id/campagne` et `/campagne/berges`.
- **Agrandir.** Quand une réunion fait d'un chemin du champ, la campagne
  façonnée qu'il portait passe dans la ferme telle quelle : un lac reste un
  lac, un bois garde son âge.
- **Le moulin** prend l'eau de la campagne par un **bief** : une cascade ou
  une rivière à 8 cases au plus fait tourner sa roue (`PORTEE_BIEF`).
- **L'irrigation.** La campagne touche la ferme : une case d'eau de
  campagne irrigue de là où elle est (`eauxDeLaCampagne`), +3 % à 3 cases,
  +4 % à 2 cases si l'eau coule.
- **Quand le pays se redessine.** Si la ferme grandit, la route peut glisser
  d'un couloir, un voisin s'installer, l'île s'élargir. Deux cas se
  présentent :
  - **Le village cède la place.** Ses lieux (coopérative, rucher, mare du
    décor…) ne tiennent à aucun endroit. Ils prennent le premier
    emplacement libre qui ne recouvre ni une case façonnée ni une
    décoration du joueur.
  - **Une route, la cour, l'île ou le champ d'un voisin, eux, ne bougent
    pas.** La vue relève les cases façonnées qui se retrouvent dessous (une
    fois le voisinage chargé, pour ne rien juger sur un pays provisoire)
    et les retire aussitôt de l'écran. `POST /parcels/:id/campagne/enfouies`
    les rend à l'herbe et rembourse leur travail (`valeurCaseCampagne`) :
    l'eau 30 €, chaque niveau de relief 40 €, le bois 25 €, les fleurs 10 €.
    Une futaie part en plus à la scierie (70 €). Un toast le dit. Ce qu'un
    client déclarerait à tort ne lui rapporte jamais plus que ce qu'il a
    payé.
- **À l'écran.** La campagne façonnée se dessine au niveau du sol de la
  campagne, sous l'île. L'eau y affleure, une butte porte son propre dessus
  d'herbe, un bois sa litière. Le décor tiré au sort (arbres, touffes) lui
  laisse la place. En construction, on vise une case de campagne hors de
  l'île, et un rectangle commencé dans la campagne s'y étend.

### La biodiversité

Règles dans `packages/shared/src/biodiversite.ts`.

- **Les habitats** se lisent sur les cases et le décor, sans rien saisir :
  - prairie fleurie (semée dans la campagne) et pré fauché ;
  - massif fleuri, haie, buissons, arbre isolé ;
  - jeune bois, futaie, vieux bois (2 ans) et lisière ;
  - mare, rivière, roselière ;
  - rocaille (bord de falaise).

  La campagne compte pleinement ; ce qui reste de gros terraformage sur la
  ferme compte **deux fois moins**. Dans la campagne, une case non façonnée
  est de l'herbe : la voisine d'un bois fait sa lisière, celle d'une mare sa
  berge.
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
- **Calibrage.** 36 cases de campagne bien aménagées visent environ 35/100 ;
  trois fois plus approchent 80.
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
  par case de campagne aménagée (plafond 400 cases), pleines à partir d'un
  score de 50. Versées au journal sous « Aides », avec un rattrapage d'une
  saison au plus. 36 cases de campagne aménagées et en bonne santé rapportent environ
  720 € par saison.
- **Floraison** : les prairies refleurissent à mesure que les pollinisateurs
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

> Ces gestes se font désormais **dans la campagne**, autour de la ferme, et
> non plus sur elle : voir « La campagne à façonner ».

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
| Prairie fleurie (campagne) | 10 €/case | rien |
| Boiser | 25 €/case | rien (la coupe rapporte 70 €/case de futaie, chaque année) |
| Chemin de terre / gravier / pavés | 4 / 9 / 18 €/case | rien |
| Objet de décor | 25 à 400 € | 50 % (100 % dans la fenêtre de regret) |
| Bâtiment | inchangé | inchangé (40 %, 100 % dans la fenêtre de regret) |

### Effets du décor (peu, et lisibles)

- **Haie** : brise-vent, +2 % de rendement sur les champs à 2 cases ou moins.
- **Étang** : irrigation, +3 % sur les champs à 3 cases ou moins — depuis la
  campagne, comptées à partir du bord de la ferme (les rigoles).
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
  domaine et la grille apparaît discrètement. La terre, elle, s'achète dans
  le paysage, parcelle par parcelle (voir plus haut).
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
