# 45 — Parc matériel 3D : des engins montés, riggés, animés

**Date :** 2026-08-13
**Portée :** `apps/web/src/machines3d.ts`, `MachineView3D.tsx`, `MachineShowcase.tsx`,
intégration dans `IsoFarmView.tsx`, page atelier `/machines.html`.

---

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

### Style et budget

Règles de la charte (`33_ART_DIRECTION.md`) respectées : facettes assumées,
aucune texture, révolutions à 6/8/10 segments, couleurs plates, variation de
teinte de ±3 % par instance. La palette reprend celle des illustrations 2D du
catalogue : tracteur vert à jantes jaunes, moissonneuse rouge à barre de coupe
or, épandeur gris à châssis jaune, déchaumeur brun à disques d'acier.

**Écart assumé sur le budget géométrique.** La charte prévoit 180–260 triangles
pour un tracteur ; ces engins sont deux à trois fois plus lourds. C'est délibéré :
ils sont les seuls objets mobiles, ils portent le regard, et ils ne sont jamais
plus d'une poignée à l'écran. La compensation est ailleurs :

- **fusion par matériau** (`mergeGeometries`) : capot, calandre, tôles et
  marchepieds d'un tracteur ne font qu'un seul maillage. Environ 8 appels de
  rendu par machine au lieu d'une quarantaine ;
- **cache de géométrie** marqué partagé (`markShared`) : la vue iso reconstruit
  sa scène plusieurs fois par seconde, monter un engin ne coûte plus que des
  maillages et des matériaux ;
- **matériaux propres à l'instance**, libérés par `rig.dispose()`.

Corollaire : `disposeObject3D()` de la vue iso ignore désormais les géométries
marquées partagées. Sans cela, la première machine détruite viderait le cache et
laisserait les suivantes sans maillage.

### Poussière

`createDustTrail()` : huit bouffées recyclées derrière l'engin au travail,
conformément au budget particules de la charte (§8.2). C'est le détail qui fait
qu'une machine *pèse* sur le sol au lieu de flotter dessus.

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

## Essai : un tracteur « héros »

`tractor-hero.ts` pousse **un seul engin** au-delà de la charte, pour mesurer
ce qu'on gagne à quitter le low-poly :

| | Modèle du jeu | Modèle détaillé |
|---|---|---|
| Triangles | ~700 | ~14 000 |
| Volumes | boîtes et cylindres facettés | capot extrudé galbé, tôles à arêtes cassées, pneus et jantes tournés au tour |
| Ombrage | facettes assumées | lisse sur les tôles, facettes sur les crampons |
| Matières | `MeshLambert`, couleurs plates | peinture vernie (`clearcoat`), chrome, fonte mate, verre teinté |
| Éclairage | soleil + hémisphère | idem + environnement PMREM, ACES, ombres 2048 |
| Détail | calandre, phares, attelage suggérés | calandre à lames, phares à enjoliveur, panneaux de porte, marchepieds, relevage trois points complet avec rotules, prise de force cannelée, flexibles hydrauliques courbés, rétroviseurs, gyrophare |

Il expose la même interface que le parc (`MachineRig`) : il se substitue à
`createMachineRig("TRACTOR")` sans rien changer à l'appelant, et répond aux
mêmes commandes d'animation.

**Ce que ça coûte, honnêtement.** La peinture vernie tire `MeshPhysicalMaterial`
et l'environnement tire `PMREMGenerator` : le morceau `three` partagé passe de
523 à 563 kB (143 → 144 kB gzip). Comme la page de jeu charge le même morceau,
elle paie aujourd'hui pour une pièce qu'elle n'utilise pas. À régler si le
modèle détaillé entre en jeu — en séparant le `three` de l'atelier de celui du
jeu, ou en réservant le modèle à un écran qui charge son propre bundle.

Verdict à trancher : le modèle détaillé est fait pour un **garage ou un
catalogue** — un engin à l'écran, vu de près, sur plateau tournant. Dans la
parcelle, à 40 px de haut et à plusieurs exemplaires, il n'apporterait presque
rien de visible pour vingt fois le coût.

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
- Le modèle détaillé n'existe que pour le tracteur, et n'est branché nulle
  part ailleurs que dans l'atelier
