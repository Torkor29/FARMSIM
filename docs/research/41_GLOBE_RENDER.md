# 41 — Rendu du globe : de la géométrie à la peinture

**Statut :** Implémenté  
**Date :** 2026-08-12  
**Remplace :** la recette « globe low-poly » de [33_ART_DIRECTION](./33_ART_DIRECTION.md)

---

## Deux échecs avant de changer d'approche

| Version | Ce qu'elle faisait | Verdict |
|---------|--------------------|---------|
| 1 | Grappes de tuiles hexagonales sur une sphère | « pas beau, pas détaillé, quand ça zoom ça fait rien » |
| 2 | Masses continentales extrudées, bruit fractal, côtes organiques | 3/5 puis 4,5/5 — « polygones géométriques apparents, surtout en zoom » |
| 3 | Sphère lisse + textures procédurales | **5/5 en vue d'ensemble, 5/5 en zoom maximal** |

Entre la 1 et la 2, j'ai corrigé beaucoup de choses — subdivision, éclairage,
coloration par sommet au lieu de par triangle. Chaque correction améliorait le
rendu sans jamais régler le problème de fond : **une géométrie facettée trahit
toujours ses facettes**. Monter la subdivision déplace le seuil, elle ne le
supprime pas.

La bonne question n'était pas « combien de polygones » mais « pourquoi le
détail vient-il de la géométrie ».

---

## L'approche retenue

Une seule `SphereGeometry` en 256×128, lissée, avec un déplacement modeste
pour donner du volume à la silhouette. Tout le détail visible vient de trois
textures équirectangulaires calculées en procédural, en 2048×1024.

| Carte | Contenu | Effet |
|-------|---------|-------|
| **Couleur** | Biomes, littoraux sableux, roche des crêtes, neige des pôles, dégradé de profondeur océanique | L'aspect |
| **Relief** (bump) | Altitude en niveaux de gris | L'ombrage du terrain, sans un triangle de plus |
| **Rugosité** | Eau lisse, terre mate | Le reflet du soleil sur l'océan |

Une quatrième carte, non affichée, mémorise **quel continent occupe chaque
texel**. C'est elle qui répond au clic : plus besoin de maillages séparés pour
savoir ce que le joueur vise.

### Ce que la peinture contient

- **Océan** : profondeur croissante au large, hauts-fonds clairs près des
  côtes, teinte polaire au-delà de 62°, tropicale en deçà de 26°, houle en
  longues ondulations plutôt qu'un bruit uniforme
- **Terre** : couleur du continent nuancée par l'altitude et l'aridité, forêt
  en zone humide, sable en zone sèche, roche sur les crêtes, ligne de neige
  qui descend avec la latitude
- **Littoral** : frange de sable puis falaise, sur une bande étroite
- **Grain fin** commun à tout : c'est lui qui empêche les aplats en gros plan

---

## Afficher tout de suite, affiner ensuite

Peindre deux millions de texels de bruit fractal prend plusieurs secondes. La
première version montrait donc une bille bleue pendant six à huit secondes.

La peinture se fait maintenant en deux temps :

1. Une planète **complète en 256×128**, calculée en quelques dizaines de
   millisecondes et affichée immédiatement
2. La version **2048×1024** en arrière-plan, par tranches limitées à **10 ms
   par image**, qui remplace la première quand elle est prête

Le budget par image remplace un nombre de lignes fixe : une bande peut coûter
dix fois plus qu'une autre selon qu'elle traverse un océan vide ou trois
continents. Un compte de lignes constant provoquait des à-coups.

Les deux résultats sont mis en cache pour la session, avec la géométrie.

**Mesuré :** planète visible en moins d'une seconde, version fine en place en
deux à trois secondes, transition imperceptible, rotation fluide à 60 images
par seconde pendant le calcul.

---

## Ce qui n'a pas changé

Le halo fresnel, les nuages en spirale de Fibonacci, les repères dorés avec
anneau pulsant, la rotation avec inertie, le zoom molette et le vol vers le
continent sélectionné. Ces éléments n'ont jamais été mis en cause.

---

## Reste à faire

- Le survol ne met plus le continent en surbrillance : avec une seule surface,
  l'ancien réglage d'émissive par maillage n'a plus de support. Seul le repère
  réagit. Un halo local sur la carte de couleur ferait mieux.
- La résolution de texture plafonne le détail au zoom extrême ; une carte de
  détail répétée en surimpression le repousserait sans coûter de mémoire.
- La peinture pourrait migrer dans un Worker : elle ne bloque plus, mais elle
  occupe le fil principal pendant deux à trois secondes.
