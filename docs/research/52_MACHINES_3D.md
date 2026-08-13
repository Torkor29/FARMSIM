# 45 — Parc matériel 3D : des engins montés, riggés, animés

**Date :** 2026-08-13
**Numérotation :** ce document était le 45 sur sa branche ; `main` ayant pris
ce numéro entre-temps (rotation des cultures), il passe au 52.

**Portée :** `apps/web/src/machine-kit.ts`, `machines3d.ts`, `MachineView3D.tsx`,
`MachineShowcase.tsx`, intégration dans `IsoFarmView.tsx`, page atelier
`/machines.html`, export glTF (`scripts/export-machines.mjs` → `models/`).

---

## Fusion : deux implémentations pour un même besoin

Ce travail a été mené sur une branche pendant que `main` avançait de son côté —
et `main` a reçu **sa propre version des engins 3D** (`machine-meshes.ts`,
page `preview-machines.html`) : primitives facettées, roues et rabatteur qui
tournent. C'est, à peu de choses près, la première étape de cette branche.

À la fusion, la version détaillée l'emporte et remplace l'autre : mêmes rôles
animés, mais géométrie galbée, matières PBR, champ vivant, projections et
export glTF. Ce qui venait de `main` et n'existait pas ici est conservé — le
gouverneur de qualité (`render-quality.ts`), les bâtiments en illustration,
le va-et-vient rang par rang du chantier, les ouvriers sur la parcelle.

Les particules et l'environnement PBR ne s'allument que si le gouverneur juge
la machine capable (`quality.shadows`) : sur mobile modeste, il reste la
poussière et la fumée, sans gerbes ni reflets.

## Le problème

Les quatre machines du jeu — tracteur, moissonneuse, épandeur, déchaumeur —
étaient des **boîtes**. Le tracteur : un pavé de 0,55 × 0,28, plus un cube pour
la cabine. La moissonneuse : le même pavé, en rouge, avec une planche devant.
Aucune roue, aucune pièce mobile. À l'écran, un engin au travail glissait sur
le champ comme un jeton sur un plateau.

C'est d'autant plus dommageable que **les engins sont les seuls objets mobiles
de la ferme**. Les bâtiments ne bougent pas, les cultures poussent par paliers,
les bêtes vont brouter deux fois par jour. L'œil du joueur va sur ce qui bouge :
c'est précisément là que le jeu était le plus pauvre.

## Ce qui a été fait

### Un *rig*, pas un maillage

`createMachineRig(type, options)` rend un objet animable :

```ts
const rig = createMachineRig("HARVESTER");
scene.add(rig.group);
rig.update({ t, distance, working: true, steer, unloading });
rig.dispose();
```

Les pièces mobiles sont des nœuds nommés, pilotés par `update()` :

| Rôle | Pièce | Pilotage |
|---|---|---|
| `wheel` | roues | **distance parcourue** ÷ rayon |
| `steer` | essieu directeur | braquage, ±0,34 rad |
| `reel` | rabatteur de moissonneuse | distance × 1,25 ÷ rayon |
| `gang` | trains de disques du déchaumeur | distance ÷ rayon, sens opposé par train |
| `spinner` | disques d'épandage | régime moteur (temps), seulement au travail |
| `tool` | bec de coupe, porte-disques | posé au travail, relevé en déplacement |
| `auger` | vis de déchargement | déployée à 90° quand la trémie se vide |
| `beacon` | gyrophare | battement à ~2 Hz, éteint moteur coupé |

**Le choix qui compte : les roues tournent avec la distance, pas avec le
temps.** Un engin à l'arrêt a des roues immobiles ; un engin qui accélère a des
roues qui accélèrent ; un engin qui recule a des roues qui reculent. C'est ce
qui sépare une machine d'un sprite qui glisse.

### Outils traînés

Un épandeur et un déchaumeur n'ont pas de moteur. Ils sont donc livrés :

- **dételés** au parc matériel — béquille sur la flèche, comme dans le
  catalogue (`MACHINE_ART`) ;
- **attelés derrière un tracteur** dès qu'ils travaillent (`{ towed: true }`),
  l'anneau d'attelage de l'outil posé exactement sur la chape du tracteur.

### Le niveau de détail

Le parc a d'abord été monté au budget low-poly de la charte
(`33_ART_DIRECTION.md` §4.2 : 180–260 triangles pour un tracteur). Le résultat
était juste, mais restait un assemblage de boîtes peintes. Les engins étant les
seuls objets mobiles de la ferme — donc ceux que l'œil suit —, ils sont passés
au niveau au-dessus, et **tout le parc au même niveau** : une seule machine
détaillée au milieu de trois autres taillées à la serpe serait pire que quatre
machines sobres.

Le vocabulaire de formes est dans `machine-kit.ts`, et rien n'y est une boîte :

- capots et caisses : **profils de côté extrudés** et biseautés ;
- tôles : **boîtes aux arêtes cassées** — une tôle n'a jamais d'arête vive ;
- pneus, jantes, disques d'épandage, disques de déchaumeur : **tournés au
  tour** (`LatheGeometry`), crampons en chevron sur deux rangées ;
- garde-boue : tôle cintrée avec bourrelet de bord ;
- flexibles et mains courantes : **courbes** (`TubeGeometry`), pas des bâtons.

Les matières sont PBR : peinture vernie (une couche spéculaire nette par-dessus
la couleur — c'est elle qui distingue une carrosserie d'un aplat), chrome,
fonte mate, caoutchouc, verre teinté. La scène doit fournir un environnement
(`attachStudioEnvironment`), faute de quoi les métaux paraissent éteints.

Compter ~10 000 à 20 000 triangles par engin, contre ~700 pour la version
sobre. Ce qui tient le coût :

- **fusion par matière** (`mergeGeometries`) : capot, calandre, tôles et
  marchepieds ne font qu'un maillage. Une quinzaine d'appels de rendu par
  machine au lieu d'une centaine ;
- **cache de plans de montage** marqués partagés (`markShared`) : la vue iso
  reconstruit sa scène plusieurs fois par seconde, monter un engin ne crée
  plus que des maillages et des matériaux ;
- **matériaux propres à l'instance**, libérés par `rig.dispose()` ;
- jamais plus d'une poignée d'engins à l'écran.

Corollaire : `disposeObject3D()` de la vue iso ignore désormais les géométries
marquées partagées. Sans cela, la première machine détruite viderait le cache et
laisserait les suivantes sans maillage.

Coût de bundle : la peinture vernie et l'environnement font passer le morceau
`three` de 523 à 563 kB (132 → 144 kB gzip).

### Le champ vit

Une culture était rendue par **une boîte colorée par case** : lisible, mais
morte. Une parcelle de blé, c'est d'abord du mouvement.

`crop-field.ts` sème quarante brins par case — une lame plate à trois
segments et son épi, quatorze faces — dans **une seule `InstancedMesh` pour
tout le champ** : cent quarante-quatre cases tiennent en un appel de rendu.

- **La houle** est calculée dans le nuancier, pas sur le processeur : le brin
  se courbe comme le carré de sa hauteur, pied planté et épi qui balaie, sur
  deux fréquences déphasées pour que le vent ne soit pas un métronome. Sa
  force suit la météo — calme par beau temps, rafale sous l'orage.
- **La fauche est un instant, pas un interrupteur.** Chaque brin porte l'heure
  à laquelle il a été coupé ; le nuancier le couche et le tasse en un tiers de
  seconde, avec un léger décalage d'un brin à l'autre. La moissonneuse laisse
  donc un andain derrière elle au lieu d'un champ qui clignote.
- La dalle sous les brins montre désormais **sa terre** : ce sont les épis qui
  portent la couleur de la culture et le signal de maturité.

### Poussière

`createDustTrail()` : huit bouffées recyclées derrière l'engin au travail,
conformément au budget particules de la charte (§8.2). C'est le détail qui fait
qu'une machine *pèse* sur le sol au lieu de flotter dessus.

`createExhaustSmoke()` en est le réglage léger : des bouffées grises, plus
lentes, plus diluées, émises à la **sortie réelle du pot** — le rig expose un
nœud `exhaust` dont la vue lit la position monde après cap et échelle. Un
moteur en charge fume ; moteur coupé, rien ne sort.

### Ce que chaque machine projette

`particles.ts` : des projections **balistiques**, à distinguer de la poussière
et de la fumée qui, elles, montent et se diluent. Une gerbe part avec une
vitesse, retombe sous la gravité, s'écrase au sol et s'éteint. Un bassin par
effet, un seul appel de rendu chacun, particules mortes mises à l'échelle zéro
plutôt que retirées du tampon.

| Machine | Projection | Départ |
|---|---|---|
| Moissonneuse | grain doré en parabole vers la trémie ; flux serré sous la vis quand elle vide | nœud `reel`, puis `auger` |
| Déchaumeur | mottes de terre en gerbe basse vers l'arrière | nœuds `gang` |
| Épandeur | engrais en éventail, chaque disque dans son sens de rotation | nœuds `spinner` |
| Ferme (palier 3+) | fumée lente au conduit de cheminée | position du conduit |

Les points d'émission ne sont pas approximés : le rig expose ses nœuds animés
(`rig.anchors(role)`), et la vue lit leur position monde après cap et échelle.
La gerbe part donc de la pièce qui la produit.

**Une contrainte que ça impose au champ** : le blé montait jusqu'à 0,84 unité,
soit plus haut qu'un tracteur. L'engin au travail disparaissait derrière les
épis des rangs voisins. Une culture mûre plafonne désormais à hauteur de capot.

### Aire de stationnement

Les cases `VEHICLE` étaient peintes en `0x3a3f44` — un enrobé presque noir qui
faisait un trou dans la parcelle. Elles passent à la terre battue claire de la
charte (`0xd8c9a8`).

## L'atelier

`/machines.html` — page de travail, hors jeu, `noindex`. Les quatre engins sur
plateau tournant, à l'arrêt ou au travail, dételés ou attelés, avec un curseur
de vitesse ; puis les mêmes dans une vue ferme miniature, deux garés au parc et
un au chantier en boucle. C'est là qu'on juge une machine avant de l'envoyer au
champ : sous l'angle exact de la vue de jeu, et à l'échelle des cases.

Le composant `MachineView3D` est autonome : il peut être posé tel quel dans le
garage ou le catalogue à la place de l'illustration 2D.

### Assiette : les roues posent au sol

Trois défauts faisaient s'enfoncer les engins dans le terrain. Ils étaient
invisibles à l'œil nu sur une vignette, flagrants dès qu'on zoomait.

| Défaut | Effet | Cause |
|---|---|---|
| Crampons de pneu | −3 cm sur un rayon de 23 | `place()` tourne autour de X, puis Y, puis Z : après le `rotateZ` final, c'est l'axe **X** de la boîte qui pointe vers l'extérieur de la roue. La grande dimension du crampon était sur X, elle débordait donc de 13 % du rayon |
| Biseau d'extrusion | +1,2 cm sous chaque tôle | `bevelSize` pousse le contour vers l'**extérieur** : toute « boîte arrondie » mesurait 2 × bevelSize de trop |
| Attelage | −14 à −20 cm sur l'outil entier | L'anneau des outils était à y = 0,30 / 0,36, la chape du tracteur à y = 0,16 : atteler enfonçait l'outil de la différence |

Après correction, les huit combinaisons (quatre engins × dételé/attelé) posent
entre −2 mm et +2 mm de y = 0. Le contrôle est reproductible :
`window.machineBounds(type, état)` sur la page `export-models.html` rend les
bornes verticales et les trois pièces les plus basses.

### Échelle : une seule pour tout le parc

Chaque engin était mis à l'échelle de sa case, ce qui donnait un tracteur et
une moissonneuse **de même longueur**. Une seule valeur commune
(`MACHINE_SCALE`) préserve désormais les tailles relatives : la moissonneuse
déborde sur la case voisine, comme dans la réalité et comme le prévoit la
charte (§4.8).

### Le blé tombe derrière la moissonneuse

Une moissonneuse qui traverse un champ intact ne trompe personne : les cultures
des cases déjà parcourues sont masquées au passage de la machine.

## Des fichiers, pas seulement du code

Le jeu construit ses engins au chargement : il n'a aucun fichier de modèle à
télécharger. Mais un modèle qu'on ne peut ouvrir nulle part ailleurs n'est pas
vraiment un asset — impossible de le retoucher dans Blender, de le confier à un
graphiste, de le réutiliser ailleurs.

```bash
node scripts/export-machines.mjs      # → models/*.glb
```

Le script démarre le serveur de développement, ouvre `export-models.html` dans
un navigateur sans interface et récupère un `.glb` par machine. Chaque fichier
contient :

- la **hiérarchie nommée** — `wheel_1`…, `steer_1`, `reel_1`, `gang_1`,
  `spinner_1`, `tool_1`, `auger_1`, `beacon_1` : de quoi animer la machine dans
  n'importe quel outil ;
- une **animation « Travail »** déjà posée, en boucle de deux secondes ;
- les **matières PBR** d'origine.

Les fichiers vivent dans `models/`, hors de `public/` : ce sont des livrables
pour l'extérieur, pas des ressources chargées par le jeu.

## Reste à faire

- Le catalogue et le garage affichent toujours les `.webp` : le rendu 3D est
  disponible mais pas branché, faute d'un budget de contextes WebGL clair sur
  mobile
- Aucun **niveau de détail** : la même géométrie sert de près comme de loin
- L'usure ne se voit pas — une machine à 15 % de condition est aussi pimpante
  qu'une neuve, alors que la boue, la rouille ou un pot d'échappement noirci
  diraient l'état sans ouvrir le garage
- Le grain ne descend pas dans la trémie de la moissonneuse au fil de la
  moisson, et la vis se déploie sans rien déverser
- Pas de tier 2 : les quatre engins sont figés au niveau 1 du catalogue
- Les `.glb` sont lourds (1 à 3 Mo) : géométrie non indexée, sans compression
  Draco ni quantification
