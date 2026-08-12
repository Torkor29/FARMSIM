# 40 — Hygiène de console : traiter les avertissements

**Statut :** Implémenté  
**Date :** 2026-08-12

---

## Pourquoi

Un avertissement qu'on laisse passer en cache un autre. Au bout de quelques
semaines, la console est un mur de jaune où plus personne ne voit la vraie
erreur qui vient d'apparaître. Ce document recense ce qui a été trouvé, ce qui
a été corrigé, et ce qui reste — avec la raison.

L'inventaire a été fait en ouvrant réellement la console, tous niveaux
activés, sur un parcours complet. Les rapports de seconde main se sont révélés
imprécis dans les deux sens.

---

## Corrigé

| Avertissement | Cause | Correction |
|---------------|-------|------------|
| `Clock: This module has been deprecated. Please use THREE.Timer instead.` | Déprécié en r183 | `THREE.Timer`, avancé explicitement à chaque image |
| `THREE.WebGL.ShadowMap: PCFSoftShadowMap has been deprecated. Using PCFShadowMap instead.` | Déprécié en r185 | `THREE.PCFShadowMap` |
| `[Violation] 'click' handler took 388ms` | Six continents de bruit fractal construits d'un bloc | Un continent par image, plus cache de session |
| `POST /api/parcels/…/harvest 409` | Le client demandait un refus qu'il pouvait prédire | Bouton désactivé quand rien n'est mûr |
| Deux familles de polices chargées pour rien | `index.html` était resté sur Fraunces et Source Sans 3 | Baloo 2 et Nunito, chargées une seule fois |
| `apple-mobile-web-app-capable` seul | Préfixe déprécié depuis Chrome 132 | `mobile-web-app-capable` ajouté, le préfixe reste pour iOS |
| `theme-color` sombre sur thème clair | Vestige de l'ancien thème | `#fdf8ec` |
| Avertissement Vite « chunk > 500 kB » | Three.js dans le lot principal | Lot séparé, chargé à la demande |
| `ExperimentalWarning: VM Modules` à chaque test | Imposé par Jest en ESM | `--disable-warning=ExperimentalWarning`, ciblé |

### Une fuite que personne n'avait signalée

`renderer.dispose()` ne rend pas le contexte WebGL : il attend le ramasse-
miettes. Un navigateur en plafonne une quinzaine et supprime silencieusement
les plus anciens au-delà.

Le jeu monte trois personnages sur l'écran des métiers, un globe, un vol
d'approche et une ferme — le tout en double sous StrictMode en développement.
La limite était à portée, et le symptôme aurait été des canevas noirs **sans
la moindre erreur en console**.

`three-cleanup.ts` libère scène et contexte, tolère un canevas déjà retiré par
React, et sait épargner les géométries partagées mises en cache. Vérifié sur
quatre cycles de déconnexion/reconnexion : aucun contexte perdu.

### Effet de bord bienvenu

Isoler Three.js et le charger à la demande fait tomber le lot initial de
**794 à 247 kB**. L'écran de connexion ne télécharge plus le moteur 3D.

---

## Ce qui reste, et pourquoi

| Message | Raison de ne rien faire |
|---------|-------------------------|
| `Automatic fallback to software WebGL has been deprecated` | Chrome sans GPU dans l'environnement de test. N'apparaît pas sur une vraie machine. |
| `[vite] connecting` / `connected` | Serveur de développement uniquement |
| `Download the React DevTools…` | Message de React en mode développement |

---

## Une erreur d'analyse à retenir

J'ai d'abord conclu que `PCFSoftShadowMap` n'était pas déprécié, en cherchant
dans `three.core.js`. L'avertissement vit dans `three.module.js`, du côté du
renderer. La console disait vrai, mon grep était incomplet.

De même, un `ReferenceError` observé en cours de route venait d'un module à
moitié remplacé par le rechargement à chaud de Vite pendant que j'éditais, pas
du code. Un redémarrage à cache vidé l'a levé.

**La console fait foi, mais il faut la lire dans un état stable.**

---

## Deuxième passe (après le commerce et l'élevage)

Un audit a été refait une fois le code neuf livré — écran de vente, marché
entre joueurs, actions d'élevage, remodelage des bâtiments. Résultat : aucune
dépréciation, aucun avertissement React, aucune erreur, aucun 404, aucune
fuite de contexte. Mais cinq violations de performance, dont une à 1 702 ms.

| Violation | Cause réelle | Correction |
|-----------|--------------|------------|
| `'click' handler took 1702ms` | `window.confirm()` gèle le fil principal tant que la boîte est ouverte : Chrome comptait le temps de lecture de l'utilisateur | Boîte de confirmation intégrée, échappement au clavier |
| `'message' handler took 228–502ms`, **toutes les 4 s** | La parcelle est sondée en continu et renvoie des objets neufs ; `layout()` détruisait et reconstruisait les 144 dalles, cultures, engins et bâtiments à chaque fois | Signature de l'état réel de la scène ; plus aucune reconstruction inutile |
| Coût du premier montage | 144 géométries de dalle identiques allouées une à une | Une seule géométrie partagée |
| `POST …/build 402` | Le fantôme rouge signalait le manque de CRD mais le clic partait quand même | Le budget entre dans la condition de placement |

**Mesuré après correction :** zéro violation sur quarante secondes
d'inactivité, là où il y en avait une toutes les quatre secondes. Il reste
trois violations de 215 à 453 ms au premier chargement, inhérentes à la
construction initiale de la scène.

La leçon de cette passe : **une violation n'est pas toujours un problème de
performance**. La pire des cinq mesurait le temps qu'un humain passait à lire
une boîte de dialogue. Il faut chercher la cause avant d'optimiser.

---

## Troisième passe : deux bugs cachés derrière la console

En reprenant un rapport de console au lieu de le croire sur parole, deux
défauts réels sont apparus — dont un qu'aucun audit n'avait signalé.

### Le lait et la viande étaient invendables

Les endpoints marchands validaient `z.enum(["WHEAT", "MAIZE"])`. Le lait et la
viande se produisaient donc normalement, s'empilaient au silo, et n'avaient
**aucun débouché** : toute la boucle d'élevage livrée juste avant ne rapportait
rien.

Le bug ne produisait aucune erreur visible tant qu'on ne tentait pas la vente.
Un test de non-régression parcourt désormais chaque marchandise vendable et
vérifie que les trois canaux la cotent.

### Le `ReferenceError` fantôme avait une cause structurelle

J'avais attribué un `readyCellCount is not defined` au rechargement à chaud et
je m'étais arrêté là. C'était incomplet.

React Fast Refresh n'applique une mise à jour **sans réexécuter le module** que
si celui-ci n'exporte que des composants. Or `MarketPanel` réexportait une
constante partagée pour rien, et `TutorialOverlay` exportait sa clé de
stockage. Ces deux modules faisaient donc échouer l'optimisation, et un import
pointant dessus pouvait se retrouver momentanément indéfini.

Les constantes vivent maintenant dans `storage-keys.ts`, hors de tout module de
composant.

**Règle à tenir :** un fichier de composant n'exporte que des composants et des
types. Toute constante partagée va dans un module ordinaire.

---

## Quatrième passe : mesurer avant d'optimiser

Il restait les violations du premier chargement, que la passe précédente avait
classées « inhérentes à la construction de la scène ». C'était une supposition,
pas une mesure. Deux causes ont été cherchées, et une seule des deux était la
bonne — l'écart entre les deux est la vraie leçon de cette passe.

### Le globe testait soixante-cinq mille triangles à chaque clic

`pick()` lançait un rayon sur le maillage de la planète. Depuis le passage à
une sphère lisse texturée, ce maillage compte 256 × 128 segments, et Three les
teste un à un faute d'arbre de partitionnement. La fonction tournait à chaque
clic **et à chaque mouvement de souris**.

Le repli analytique existait déjà juste en dessous : intersection avec une
sphère, puis lecture de la carte d'index des continents. La planète a été
retirée des cibles de raycast, et ce chemin en temps constant est devenu le
seul. Les violations au survol et au clic ont disparu.

### Les allocations de géométrie n'y étaient pour rien

Même raisonnement appliqué à la ferme — géométries d'hexagone et de culture
mutualisées, matériaux indexés par teinte — pour un gain **nul** sur les
violations du chargement. L'hypothèse était fausse.

Le profileur a tranché : sur un enregistrement de 20,5 s, **94,5 % du temps
était de la peinture** (19 347 ms) contre 4,8 % de JavaScript (985 ms). Ce
n'étaient pas nos calculs qui coûtaient, c'était la rasterisation.

### Qualité de rendu adaptative

La machine de test n'a pas de carte graphique et rasterise au processeur. On
pourrait s'arrêter là et parler d'artefact d'environnement — sauf qu'un
téléphone d'entrée de gamme se comporte de la même façon, et que le jeu se veut
mobile. `render-quality.ts` reconnaît les rasteriseurs logiciels connus et,
surtout, surveille le temps réellement passé par image pour déclasser un
appareil que sa chaîne de caractères ne trahit pas. Le réglage sobre coupe les
ombres portées — une passe de rendu complète en moins par image —, ramène la
densité de pixels à un, désactive l'antialiasing et bride à trente images. Les
trois vues 3D en profitent, et aucune ne peint plus quand l'onglet est caché.

| | Avant | Après |
|---|---|---|
| Peinture | 19 347 ms | 72 ms |
| Violations au chargement de la ferme | 229, 318, 459, 506 ms | aucune |
| Violation au clic sur un continent | 444 ms | aucune |
| Violations sur 45 s d'inactivité | aucune | aucune |

Le style bas-poly encaisse la perte des ombres sans dommage : les volumes
restent lisibles grâce à l'éclairage directionnel, et trente images par seconde
suffisent à ce rythme de jeu.

### La sonde a d'abord fait planter le navigateur

Première version de la détection : ouvrir un contexte WebGL jetable, lire le
nom du rasteriseur, puis le rendre avec `loseContext()`. Sous SwiftShader,
cette allocation supplémentaire faisait tomber le processus de composition de
Chrome au chargement — soit exactement la machine que la sonde cherchait à
reconnaître, rendue totalement injouable.

Le contexte du rendu existe déjà au moment où l'on veut savoir qui rasterise.
On l'interroge lui, par une simple lecture de paramètre, sans rien allouer.

**Deux règles retenues :** ne jamais optimiser sur une hypothèse quand un
profileur peut trancher, et se méfier d'un diagnostic qui alloue des ressources
pour se renseigner.

---

## Entretien

À faire avant chaque livraison :

```bash
pnpm --filter @farmsim/web build     # aucun avertissement attendu
pnpm --filter @farmsim/sim test      # sortie propre
pnpm --filter @farmsim/api exec tsc -p tsconfig.json --noEmit
```

Puis ouvrir la console du navigateur sur un parcours complet, tous niveaux
activés. Tout nouveau message se traite ou se documente ici.
