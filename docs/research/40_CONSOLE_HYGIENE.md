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

## Entretien

À faire avant chaque livraison :

```bash
pnpm --filter @farmsim/web build     # aucun avertissement attendu
pnpm --filter @farmsim/sim test      # sortie propre
pnpm --filter @farmsim/api exec tsc -p tsconfig.json --noEmit
```

Puis ouvrir la console du navigateur sur un parcours complet, tous niveaux
activés. Tout nouveau message se traite ou se documente ici.
