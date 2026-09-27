# La forge d'assets 3D : recherche et développement

> Objectif : produire, **de façon reproductible et pilotable par un agent**,
> des modèles 3D et des décors dans le style « île douillette » des images de
> référence (moulin, sanctuaire, puits, serre, étals de la fête des récoltes,
> port au clair de lune), pour FARMSIM, un jeu navigateur en three.js qui doit
> tourner sur téléphone.

Mode d'emploi : [`apps/web/blender/README.md`](../apps/web/blender/README.md).
Atelier de contrôle en jeu : `http://localhost:5173/decor.html`.

---

## 1. Ce que montrent les références

Cinq captures d'un jeu de construction d'île « cosy » (même famille que Tiny
Glade, Townscaper, Islanders). Ce qui fait le style, par ordre d'importance :

| Trait | Observation | Conséquence pour la production |
| --- | --- | --- |
| **Silhouettes gonflées** | Arbres en nuages de gros lobes ronds, buissons en choux-fleurs, toits en cloche, pierres galets. Aucun angle vif. | Il faut un outil de *fonte* de volumes (union douce) et des biseaux partout. |
| **Palette tendre et saturée** | Verts jaunes, terre rousse, sable pâle, bois miel, rouge brique (torii, auvents), lavande, pierre gris chaud. Pas de texture. | Une palette nommée, une couleur unie par matière ; l'ombre fait le relief. |
| **Ombre douce et occlusion** | Le creux d'un buisson, le pied d'un tronc, le dessous d'un toit sont sombres ; ombres portées floues. | Cuire l'occlusion ambiante dans les sommets (gratuit au rendu). |
| **Proportions jouet** | Tours trapues, portes larges, chapeaux énormes ; détails peu nombreux mais lisibles de loin. | Modéliser en mètres réels, puis exagérer ; lire l'aperçu à l'échelle du jeu. |
| **Terrain en gâteau** | Terrasses aux flancs de terre, dessus d'herbe en bourrelet, rivage de sable. | Des pièces de sol : `plateau`, `contour_organique`, `dalles`. |
| **Saisons et nuit** | Tout le feuillage roussit à l'automne ; la nuit, lanternes et bougies brillent. | Couleurs de saison par **nom de matière** ; matière émissive `lumiere`. |
| **Repères combinables** | « Moulin + épouvantail + serre = fête des récoltes » ; « phare + sanctuaire + puits = port au clair de lune ». | Chaque repère est une pièce nommée, avec étiquettes au manifeste. |

## 2. Les contraintes de FARMSIM

- **three.js 0.185**, caméra **orthographique iso** (position (18, 16, 18),
  soit azimut 45°, élévation ≈ 32°), lumières hémisphère + ambiante + soleil
  (`IsoFarmView.tsx`). Pas de post-traitement.
- **Téléphone** : la vue d'ouverture mesurait 930 000 triangles et 1 167
  maillages avant l'optimisation du 25/09 ; on vise quelques centaines
  d'appels de rendu au total.
- **Existant** : le décor est très majoritairement construit en code
  (`decor3d.ts`, `village3d.ts`), sauf le rucher et les pancartes, déjà
  modélisés par script Blender (`bpy`) et chargés en `.glb` meshopt
  (`modeles-decor.ts`). Ce sont eux qui ont prouvé l'approche : trois
  versions « en pavés » du rucher avaient été rejetées.

## 3. Les options étudiées

### A. Tout en code three.js (l'existant)

- ✅ Aucun outil externe, paramétrable au runtime, déjà en place.
- ❌ Primitives pauvres (pas de biseau, pas d'union douce, pas de cuisson) :
  c'est précisément le « pavé de code » que les joueurs ont rejeté.
- ❌ Chaque décor ajoute du poids au bundle et du travail au démarrage.
- **Verdict** : garder pour le paramétrique pur (clôtures, champs, silos) ;
  pas pour le décor « modelé ».

### B. L'approche vibe3d (source-first, [vibe-stack/vibe3d](https://github.com/vibe-stack/vibe3d))

Registre de modèles three.js distribués **en source** (`models.json`,
`models.lock.json` avec empreintes), et une compétence d'agent `vibe-model`
dont la boucle est : *source → aperçu déterministe → critique indépendante →
correction la plus rentable*. Arrêt à un score de ressemblance ≥ 85, après
deux scores qui plafonnent, ou dix itérations. Un `coplanar-check` refuse les
faces confondues (z-fighting). Règles notables : biseaux budgétés selon le
rôle perceptif, jeu de 1,5 cm minimum entre couches, « construire, cuire,
puis fusionner », ancres sémantiques stables.

- ✅ La boucle et les règles sont excellentes, et transposables.
- ❌ Taillé pour le *hard-surface* (sci-fi) en three.js : pas de fonte
  organique, pas de cuisson d'AO. Le style visé ici est organique.
- **Verdict** : on **reprend la méthode** (aperçu déterministe, critique,
  contrôle de coplanarité, empreinte de source, manifeste), pas le moteur.

### C. Blender procédural par script (`bpy`) — **retenu**

Blender 4.2 existe en module Python (`pip install bpy`, Python 3.11) : pas
d'interface, pas de GPU nécessaire.

- ✅ Toute la boîte à outils d'un modeleur : biseaux (`bmesh.ops.bevel`),
  **remaillage voxel + lissage + décimation** (la fonte des feuillages),
  solidification, bruit, booléens.
- ✅ **Cuisson de l'occlusion ambiante** dans les couleurs de sommets
  (Cycles CPU) → `COLOR_0`, que three.js multiplie d'office.
- ✅ Exportateur glTF officiel (nœuds nommés, hiérarchie, matières PBR,
  émission, transparence), puis `gltf-transform meshopt` (÷ 3 à 4 en poids).
- ✅ Rendu Cycles sans tête : un aperçu déterministe en 1 à 3 s par pièce,
  que l'agent **regarde** pour se corriger.
- ✅ Déjà éprouvé dans le dépôt (rucher, pancartes).
- ❌ Dépendance lourde (~500 Mo) hors du `package.json`, Python 3.11 imposé.
  Mitigé : `scripts/forge.sh` crée l'environnement au premier appel ; le jeu
  et la CI ne consomment que les `.glb` versionnés.

### D. Geometry Nodes de Blender

Puissants (dispersion, instances, champs), mais un graphe de nœuds est
**opaque pour un agent** et pour la revue de code. Réservé à plus tard, pour
la dispersion (herbe, fleurs) si le besoin dépasse `random`.

### E. IA générative texte/image → 3D

État de l'art 2025–2026 : modèles ouverts (TRELLIS, Hunyuan3D 2.x, Stable
Fast 3D / SPAR3D, TripoSR…) et services (Meshy, Tripo, Rodin…). Ils
produisent en quelques secondes un maillage texturé à partir d'une image.

- ✅ Formidables pour les formes organiques uniques (un personnage, une
  statue) et comme **ébauche** à partir d'un concept-art.
- ❌ Soupe de triangles dense (dizaines de milliers), textures cuites qui
  jurent avec une palette unie, **pas de pièces nommées, pas de pivots**
  (des ailes de moulin qui ne tournent pas), rendu variable d'un tirage à
  l'autre, licences et coûts d'API à vérifier au cas par cas, GPU requis en
  local.
- **Verdict** : pas au cœur de la chaîne. Piste d'expérimentation (phase 3) :
  une étape `importer` dans la forge qui prend un `.glb` généré, le décime,
  **quantifie ses couleurs vers la palette** (une matière par couleur),
  cuit l'AO et l'inscrit au manifeste comme n'importe quelle recette.

### F. Packs d'assets (Kenney, Quaternius, KayKit — CC0)

Rapides, légers, mais d'un style « low-poly facetté » qui n'est pas celui
visé. Utiles comme **maquettes de proportions**, pas comme livrables.

## 4. L'architecture retenue

```
apps/web/blender/
├── atelier.py            lanceur (python atelier.py --help)
├── requirements.txt      bpy==4.2.0, pillow
├── forge/
│   ├── palette.py        couleurs nommées + couleurs de saison
│   ├── atelier.py        Atelier : pièces, nœuds, repères, matières, verser/realiser
│   ├── formes.py         boite, tour, tube, tore, toit, toile, dalles, plateau, citrouille…
│   ├── nature.py         fondre, arbre_rond, sapin, buisson, rocher, roseaux, lavande…
│   ├── controle.py       budgets, pose au sol, faces confondues
│   ├── cuisson.py        AO → COLOR_0
│   ├── apercu.py         rendu Cycles iso + planche contact (+ référence)
│   ├── sortie.py         export glTF, meshopt, manifeste, empreinte
│   ├── silence.py        la sortie standard reste au rapport JSON
│   └── cli.py            liste | construire | apercu
└── recettes/             une recette = un .glb (nature, moulin, puits, serre, etal, epouvantail, fete, sol)

apps/web/public/assets/decor3d/
├── <id>.glb              livrés, versionnés
└── manifest.json         ce que le jeu et l'atelier lisent

apps/web/src/modeles-decor.ts   chargerModele, poserPiece, instancierPiece,
                                chargerManifeste, teinterSaison, animerDecor
apps/web/decor.html             l'atelier web (DecorShowcase.tsx)
scripts/forge.sh                crée .forge-env/ au besoin, puis lance la forge
```

### Conventions

- **Unités** : mètres réels dans la recette, `echelle` → unités du jeu.
- **Axes** : Z en haut dans Blender, façades vers −Y ; le glTF passe en Y en
  haut et le −Y de Blender devient le +Z du jeu (le côté de la caméra).
- **Nommage** : pièce `moulin` ; maillage `moulin:<matière>` ; nœud animable
  `moulin:ailes` et ses maillages `moulin:ailes:<matière>`.
- **Un maillage par (nœud, matière)** : une pièce coûte autant d'appels de
  rendu qu'elle a de matières, quel que soit le nombre de morceaux.
- **Animation par convention** : `…:ailes` tournent autour de leur Z local,
  `…:treuil` autour de X (`animerDecor`). Pas de clips d'animation : le jeu
  pilote.
- **Saisons** : le manifeste liste, par asset, les couleurs de saison des
  matières qu'il utilise ; `teinterSaison(objet, asset.saisons.automne)`
  repeint (matières partagées → un appel repeint toute la carte).

### Le manifeste

```jsonc
{
  "version": 1,
  "assets": {
    "moulin": {
      "titre": "Moulin à vent",
      "url": "/assets/decor3d/moulin.glb",
      "octets": 126000,
      "echelle": 1.0,
      "source": "apps/web/blender/recettes/moulin.py",
      "empreinte": "448ae9e16ad4ad33",   // sha256 recette + forge : périmé si ≠
      "matieres": { "enduit": "#f1eadb", … },
      "saisons": { "automne": { … } },
      "pieces": {
        "moulin": { "triangles": 6778, "appels": 13, "taille": [5.2, 7.5, 3.1], "noeuds": ["ailes"], … }
      },
      "etiquettes": ["repere", "fete-des-recoltes"]
    }
  }
}
```

## 5. La boucle de modelage (humaine ou agentique)

```
recette ─▶ scripts/forge.sh apercu <id> [--piece p] [--reference ref.png] [--json]
   ▲                         │
   │                         ▼
   │           .apercus/<id>/planche.png  (référence à gauche si fournie)
   │                         │
   └── la correction la plus visible ◀── critique : silhouette, masses, repères
                                          distinctifs, couleurs, détails
```

Reprise de `vibe-model`, adaptée :

1. **Aperçu tôt** : dès que la silhouette et les masses principales existent.
2. **Critique** : un score de ressemblance à la référence, ce qui est juste,
   au plus **trois** corrections classées — et, séparément, les **erreurs de
   modelage** (pièce qui flotte, face confondue, élément traversant) avec
   leur position. Un score n'est pas une acceptation.
3. **Arrêt** : score ≥ 85, deux scores qui plafonnent (changer de
   représentation), ou dix itérations.
4. **Contrôles** : `construire` refuse d'exporter si un budget est dépassé
   ou si une pièce flotte (code de sortie 1).
5. **Acceptation** : l'atelier web (`decor.html`), qui montre le `.glb` réel
   sous l'éclairage du jeu. C'est l'œil du demandeur qui accepte.

Le rapport `--json` (sortie standard propre : Cycles et l'exportateur sont
réduits au silence) donne pour chaque pièce triangles, appels, sommets,
taille, matières, nœuds, alertes et erreurs, ainsi que les chemins des
aperçus. C'est l'interface d'un agent : il lit le JSON, ouvre la planche, se
corrige. La compétence `.claude/skills/forge-assets/SKILL.md` décrit cette
boucle pour Claude.

## 6. Budgets

| Rôle | Triangles / pièce | Appels / pièce | Exemples |
| --- | --- | --- | --- |
| Instancié par centaines | ≤ 500 | 1–2 | touffe, fleurs, rocher |
| Semé par dizaines | ≤ 2 600 | ≤ 6 | arbres, buissons, lavande |
| Accessoire | ≤ 3 500 | ≤ 8 | citrouilles, tonneau, lanterne |
| Repère unique | ≤ 12 000 | ≤ 16 | moulin, puits, serre, étal |
| Terrain | ≤ 8 000 | ≤ 8 | terrasses, mare, îlot |

Poids : moins de 512 Ko par `.glb` (testé). L'occlusion cuite coûte 4 octets
par sommet après quantification (u8).

## 7. Résultats de la première livraison

| Asset | Pièces | Triangles (max / pièce) | Poids |
| --- | --- | --- | --- |
| `nature` | 3 feuillus + 1 roux, 2 sapins, 4 buissons (2 fleuris), 3 rochers, roseaux, lavande, fleurs, touffe | 1 576 | ~140 Ko |
| `moulin` | moulin (nœud `ailes`) | 6 778 | ~125 Ko |
| `puits` | puits (nœud `treuil`) | 6 398 | ~125 Ko |
| `serre` | serre vitrée sur dallage | 6 268 | ~105 Ko |
| `etal` | 3 étals rayés (rouge, vert, orange) garnis | ~5 500 | ~150 Ko |
| `epouvantail` | épouvantail et son corbeau | 1 941 | ~35 Ko |
| `fete` | citrouilles, botte de foin, tonneau, caisse, lanterne, guirlandes (fanions, lumineuse), bateau-bougie | 2 220 | ~100 Ko |
| `sol` | terrasses, îlot, dallages, pas japonais, mare | 7 552 | ~255 Ko |
| `jardin` | bain d'oiseaux, lanterne de pierre, ruche en paille, nichoir, banc, pots fleuris, lampion, sacs | ~2 300 | — |
| `source_chaude` | la source chaude complète (dallage, bassin, gué, nénuphars, vapeur, bambou, lanternes…) | ~26 000 | — |

**Deuxième passe (détail)** : les feuillages sont éclairés par le dessus
(dessous assombri à la cuisson), la lavande est une gerbe dense d'épis, les
étals portent des lampions, des pots de miel, des sacs et une ardoise, le
moulin une allée dallée, des sacs de farine, un tonneau et des jardinières,
l'épouvantail ses citrouilles. Les scènes composées (`scenes-decor.ts`)
posent ces pièces comme le jeu le fera : `decor.html?scene=fete-des-recoltes`
et `?scene=source-chaude`.

Planche des aperçus : [`docs/forge/apercus.webp`](forge/apercus.webp).

Rien n'est encore **posé dans la carte** : c'est volontaire, l'intégration
(où, combien, à quelle échelle) est une décision de jeu. `poserPiece`,
`instancierPiece`, `teinterSaison` et `animerDecor` suffisent à le faire.

## 8. Rendu en jeu : ce qui rapprocherait encore des références

Par ordre de rapport effet / coût sur téléphone :

1. **Occlusion cuite** — fait (COLOR_0).
2. **Ombres douces** : `PCFSoftShadowMap` et un rayon de flou ; le soleil du
   jeu projette déjà.
3. **Tone mapping** : `ACESFilmicToneMapping` ou `AgXToneMapping` avec une
   exposition réglée donne le « moelleux » des hautes lumières (à essayer sur
   tout le jeu d'un coup, pas asset par asset).
4. **Balancement au vent** : poids stocké dans l'alpha de `COLOR_0`
   (0 au pied, 1 en haut du feuillage), lu par un `onBeforeCompile`.
5. **Eau** : un matériau à part (dégradé de profondeur, liseré d'écume).
6. **Nuit** : l'émissif existe (`lumiere`) ; un bloom léger seulement sur
   ordinateur (réglage de qualité).

## 9. La lumière du jour et la météo

La ferme était éclairée en plein midi, toujours. Elle suit maintenant un jour
complet (`apps/web/src/ambiance.ts`, testé) :

- **Tout se règle sur la hauteur du soleil**, pas sur l'heure : nuit bleue
  (la lune éclaire, la ferme reste lisible), heure bleue, aube rose, heure
  dorée (soleil fort et chaud, peu de lumière d'appoint : les longues ombres
  font l'effet), midi de la saison (l'ancien barème), coucher orangé,
  crépuscule violet. L'aube et le soir diffèrent sous l'horizon.
- **Le soleil se déplace** : il se lève à gauche, passe côté caméra à midi,
  se couche à droite ; sa hauteur de midi et ses heures de lever/coucher
  dépendent de la saison. La direction ne descend pas sous 7° (pas d'ombres
  infinies) ; les couleurs, elles, suivent la vraie hauteur.
- **La météo voile** : gris de pluie, blanc de neige, sombre d'orage ; la
  brume se rapproche sous la pluie ; les lampes s'allument sous l'orage.
- **Le jour est tassé** : la journée prend les trois quarts du cycle réel
  (un jour de jeu ≈ 86 minutes), la nuit un quart.
- **Le ciel CSS suit** (`SeasonSky`) : voile d'heure par-dessus la palette de
  saison, soleil et lune qui traversent le ciel, étoiles.
- **Pluie, neige, orage dans la scène** (`meteo3d.ts`) : traits de pluie
  obliques et éclaboussures au sol, flocons qui se balancent, éclairs en
  double battement. Tout est animé dans le shader : un appel de rendu par
  couche, aucun calcul par image côté processeur ; moitié moins de
  particules en qualité réduite.
- **Les fenêtres s'allument** le soir (nouvelle matière `window` des
  bâtiments), les lampes brillent plus, et la matière `lumiere` des décors
  de la forge (lanternes, guirlandes, bougies) aussi (`lumieres.ts`).
- **Pour voir sans attendre** : `?heure=19.2`, `?vitesse=60` (un jour en
  une minute et demie), `?meteo=RAIN|STORM|SNOW|CLOUDY|CLEAR` — dans le jeu
  comme dans l'atelier (`decor.html`, qui a aussi un curseur d'heure et un
  bouton « le jour passe »).

Pistes suivantes : reflets du ciel sur l'eau, sol mouillé plus sombre sous
la pluie, neige qui s'accumule sur les toits, lucioles d'été la nuit, bloom
léger sur ordinateur (réglage de qualité).

## 10. Une seule direction artistique pour tout le jeu

Les décors de la forge ne suffisaient pas : posés au milieu d'un décor en
code à facettes franches, ils juraient. La troisième passe aligne tout le
reste sur leur style :

| Ce qui change | Où | Comment |
| --- | --- | --- |
| Fin de la facette franche | `decor3d.ts` (campagne, village, voisins, voitures) | les normales de chaque forme suivent ses sommets : une boule reste ronde, un pavé garde ses biseaux arrondis |
| Arêtes chanfreinées | `paveChanfreine` (décor, bâtiments, engins) | 44 triangles par pavé, biseau fixe en unités du monde ; les lattes (< 6 cm) et les cases des champs voisins restent vives pour tenir les budgets |
| Arbres « nuage » | `ajouterArbre` | six lobes lisses, plus sombres dessous, racines au pied ; ils roussissent à l'automne et blanchissent l'hiver |
| Haie en boules | `geometrieHaie` | la haie de la ferme devient une suite de touffes rondes |
| Pré habité | `plan.herbes` + kit nature | touffes, fleurs, lavande, buissons, pierres instanciés autour de la ferme, teintés à la saison |
| Matières mates | `machine-kit.ts` | tuile et bois peint sans reflet métallique, vernis et chromes des engins adoucis |
| Palette | bâtiments, sol, granges voisines | vert sauge et tuile brique, herbe tendre, terre rousse — les couleurs de `palette.py` |
| Mare du village | `village3d.ts` | la mare de la forge (pierres, nénuphars, roseaux), la version en code en secours |

Budgets tenus : chaque bâtiment reste sous 3 500 triangles, la nappe des
parcelles voisines sous 220 000 sommets (tests existants), le bois de la
campagne passe d'environ 12 000 à 95 000 triangles.

### Les erreurs de placement, codées (`apps/web/src/placement.ts`)

Chaque décor déclare sa place au sol (cercle ou boîte) et son genre ; une
table de règles dit qui ne mord pas sur qui :

- un **tronc** ne pousse ni dans la route, ni dans un chemin, la cour, un
  champ, un bâtiment ou l'eau ; deux troncs gardent leurs distances ;
- une **couronne** ne déborde ni sur la cour, ni sur un bâtiment, ni sur la
  route, ni sur l'île du joueur ;
- le **masque** d'un arbre — le sol que sa ramure cache à la caméra
  isométrique, à ≈ 1,2 × sa hauteur derrière lui — ne recouvre ni route, ni
  chemin, ni cour, ni le champ du joueur (« l'arbre dans le bitume » vu
  d'en haut) ;
- **buissons, pierres, lavande** ne se fondent ni entre eux, ni dans un
  tronc, ni dans le dur ; les touffes ne poussent pas sur le dur.

Le plan de campagne pose arbres et détails de l'herbe par ces règles ; les
arbres des coins de la ferme cherchent une place libre hors de la haie ;
l'habillage des cours de bâtiments évite l'emprise réelle du bâti
(`Part.emprises`). `placement.test.ts` exige **zéro conflit** sur plusieurs
campagnes, avec et sans village.

## 11. Feuille de route

- **Phase 1 (cette livraison)** : la forge, 8 recettes, l'atelier web, les
  tests, la compétence d'agent.
- **Phase 2** : porter `rucher.py` et `pancartes.py` en recettes ; poser les
  décors dans la carte (arbres instanciés, repères du village) avec la
  version en code en secours ; lanterne et bateau de nuit reliés à l'heure du
  jeu ; poids de vent.
- **Phase 3** : phare, torii/sanctuaire, source chaude, cabane dans l'arbre,
  cerf-volant (les « 23 repères secrets ») ; atlas de palette (une texture
  16 × 16) pour tout dessiner en un appel ; niveaux de détail (LOD) générés
  par décimation ; étape `importer` pour les maillages issus d'IA.
- **CI** : un job facultatif qui lance `scripts/forge.sh liste --json` et
  signale les assets périmés (source modifiée sans reconstruction).

## 12. Limites connues

- L'aperçu Cycles n'est pas le rendu three.js (éclairage global réel,
  AgX/Standard) : il sert à juger la forme ; la couleur finale se juge dans
  `decor.html`.
- La cuisson d'AO sur CPU prend 1 à 15 s par asset (48 échantillons) ;
  `--vite` descend à 16 échantillons pour itérer.
- Le contrôle de coplanarité compare les triangles deux à deux dans chaque
  plan (ignoré au-delà de 400 faces par plan) ; il ne voit pas une face
  enfouie dans un autre solide (ce qui ne se dessine pas, et c'est bien).
- `bpy` 4.2 impose Python 3.11 ; une montée de version de Blender devra
  revalider l'exportateur (`export_vertex_color`) et le remaillage.
