# 35 — Parcours d'entrée : porte, installation guidée, arrivée

**Statut :** Implémenté  
**Date :** 2026-08-12  
**Voir aussi :** [32_LAND_ECONOMY](./32_LAND_ECONOMY.md) · [33_ART_DIRECTION](./33_ART_DIRECTION.md) · [34_WORLD_GEOGRAPHY](./34_WORLD_GEOGRAPHY.md)

---

## Problème résolu

L'accueil mélangeait inscription, choix de métier et choix de parcelle sur un
seul écran sombre. Personne ne comprenait ce qu'était une « parcelle », ni
pourquoi choisir la Beauce plutôt que l'Iowa.

Le parcours est désormais découpé en moments distincts, chacun avec une seule
décision à prendre.

---

## Séquence

| # | Écran | Composant | Ce que le joueur fait |
|---|-------|-----------|------------------------|
| 0 | Splash | `SplashScreen.tsx` | Rien — le logo s'installe, 2,7 s |
| 1 | Porte | `AuthScreen.tsx` | Se connecter **ou** créer un compte. Rien d'autre. |
| 2 | Métier | `Onboarding.tsx` + `LowPolyCharacter.tsx` | Choisit parmi trois personnages 3D animés |
| 3 | Continent | `GlobeView.tsx` | Fait tourner un globe, clique un continent |
| 4 | Région & terre | `Onboarding.tsx` | Choisit une région puis une parcelle libre |
| 5 | Récapitulatif | `Onboarding.tsx` | Vérifie et valide |
| 6 | Arrivée | `ArrivalTransition.tsx` | Vol depuis le globe jusqu'à la ferme, 2,4 s |
| 7 | Jeu | `App.tsx` + `IsoFarmView.tsx` | Tutoriel 7 étapes puis jeu libre |

L'arrivée rejoue à **chaque connexion**, pas seulement à l'inscription : elle
rappelle où l'on se trouve dans le monde.

---

## Choix du métier

Chaque classe est incarnée par un personnage low-poly construit en primitives
Three.js, qui tourne lentement et s'anime quand sa carte est sélectionnée.

| Classe | Signature visuelle | Ce qui change vraiment |
|--------|--------------------|------------------------|
| Céréalier | Chapeau de paille, épi de blé | +2 % rendement, semences moins chères |
| Éleveur | Casquette, veau à ses pieds | +2 % conversion alimentaire, revenus lissés |
| ETA | Casque et gilet orange, clé | +2 % vitesse, **deux** machines au départ, contrats immédiats |

Avantages et inconvénients sont listés côte à côte : le joueur voit le coût de
son choix avant de le faire, et le choix est définitif.

---

## Globe

- Océan : icosaèdre subdivisé, `flatShading`, un seul bleu plat
- Continents : grappes de tuiles hexagonales générées par un bruit **déterministe**
  (graine dérivée du code continent) — le monde a toujours la même forme
- Relief : ~20 % des tuiles surélevées et teintées en couleur d'accent
- Marqueurs : cônes dorés, gris quand le continent est complet
- Interaction : glisser pour tourner, cliquer un continent ; la sélection ramène
  automatiquement le continent face caméra et rapproche la caméra

---

## Sélection de la terre

La grille de parcelles reproduit la disposition réelle de la région
(`mapW × mapH`). L'intensité du vert traduit la fertilité, ce qui rend la
comparaison immédiate sans lire un seul chiffre.

| État | Rendu | Cliquable |
|------|-------|-----------|
| Libre | Vert, intensité = fertilité | Oui |
| Occupée | Gris, nom du propriétaire au survol | Non |
| Choisie | Contour doré | — |

Le panneau latéral donne la ville-marché, le climat Köppen en clair, la météo
du moment, la saison et le risque dominant de la région.

---

## API ajoutée

| Route | Rôle |
|-------|------|
| `GET /world` | Les six continents, saison courante par hémisphère, occupation |
| `GET /world/:continent` | Régions, parcelles, propriétaires, météo |
| `POST /world/claim` | Attribue la parcelle de départ (gratuite, une seule fois) |
| `GET /meta/classes` | Profils de classe pour l'UI |

`POST /auth/register` ne demande plus ni métier ni parcelle : le compte existe
d'abord, l'exploitation ensuite.

---

## Reste à faire

- Aperçu 3D de la parcelle avant validation (actuellement une tuile 2D)
- Voir les fermes des autres joueurs sur le globe, pas seulement les repères
- Réserve de parcelles de départ garantie (§3 de `32_LAND_ECONOMY.md`)
- Cultures verrouillées par climat — le MVP ne connaît que blé et maïs
