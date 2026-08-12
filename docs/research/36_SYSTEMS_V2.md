# 36 — Mise en œuvre : monde étendu, foncier v2, bâtiments à paliers

**Statut :** Implémenté  
**Date :** 2026-08-12  
**Sources :** [32_LAND_ECONOMY](./32_LAND_ECONOMY.md) · [33_ART_DIRECTION](./33_ART_DIRECTION.md) · [34_WORLD_GEOGRAPHY](./34_WORLD_GEOGRAPHY.md)

Ce document consigne ce qui est passé des trois documents de conception au
code, et ce qui reste en attente.

---

## 1. Monde : 24 → 36 régions

`packages/shared/src/climate.ts` apporte `EXTRA_REGIONS`, recollé dans `WORLD`
au chargement. Chaque continent compte désormais six régions.

| Continent | Régions ajoutées |
|-----------|------------------|
| AUR Auralie | Marais de Sluvenne, Vallée de Solane |
| KOR Kortavie | + 2 |
| SAV Savannis | + 2 |
| MER Méridie | + 2 |
| YAN Yanashi | + 2 |
| AUS Australis | + 2 |

**615 parcelles** au total en base après amorçage.

Un test vérifie que chaque région se trouve bien dans l'hémisphère de son
continent, et qu'aucun code n'est dupliqué.

---

## 2. Météo : 4 familles → 19 codes Köppen × 4 saisons

`CLIMATE_WEATHER` remplace `weatherOdds()` dans le tick serveur. Chaque
distribution somme exactement à 1, ce qu'un test parcourt exhaustivement.

Ce que ça change concrètement :

- Un été **méditerranéen** (Csa) est nettement plus sec qu'un été **océanique** (Cfb) — l'ancienne table les confondait
- Il ne neige plus jamais en climat tropical, quelle que soit la saison
- La mousson (Am, Cwa) a une saison humide et une saison sèche distinctes

`climateYieldFactor(koppen, season)` est exposé dans `GET /parcels/:id` pour
que l'interface puisse afficher le rendement attendu du moment.

---

## 3. Foncier v2

`packages/shared/src/land.ts` remplace intégralement les fonctions v1 qui
vivaient dans `world.ts`.

### Prix

```
prix = 420 CRD/ha × 14 ha
     × f_fertilité × f_climat × f_accès × f_densité × f_rareté
     × f_adjacence × 1,40^(n−1)
```

Chaque facteur est **borné**, ce qui empêche l'emballement, et le tout est
plafonné dans `[0,45 ; 6,0] × prix_référence × f_patrimoine`.

Exemple réel mesuré sur une parcelle d'Auralie :

| Rang | Prix demandé |
|------|--------------|
| 1ʳᵉ | Offerte |
| 2ᵉ | 12 700 CRD |
| 4ᵉ | 24 200 CRD |
| 8ᵉ | 92 950 CRD |
| 16ᵉ | 1 371 600 CRD |

### Deux prix

| Notion | Rôle |
|--------|------|
| `marketValue` | Valeur publique — taxe, enchères, affichage des terres d'autrui. Ignore l'acheteur. |
| `askPrice` | Prix pour **cet** acheteur — ajoute adjacence et escalade patrimoniale. |

`GET /parcels/:id/quote` renvoie le prix **et** son `breakdown` facteur par
facteur. L'escalade `1,40^n` n'est acceptable que si le joueur la voit.

### Anti-monopole

| Levier | Valeur |
|--------|--------|
| Plafond global | 16 parcelles |
| Plafond par région | 6 parcelles |
| Part maximale d'une région | 40 % |
| Taxe | 1,6 % de la valeur publique par saison, progressive, 1ʳᵉ parcelle exonérée |
| Charge de gestion | `n^1,25` |
| Statuts d'inactivité | ACTIVE → DORMANT → FALLOW → SEIZED |

Le refus d'acquisition renvoie un motif explicite, affiché tel quel dans
l'interface.

---

## 4. Bâtiments à cinq paliers

| Niveau | Nom | Coût (× coût de base) | Capacités | Niveau joueur |
|--------|-----|----------------------|-----------|---------------|
| 1 | Rudimentaire | — | ×1 | 1 |
| 2 | Consolidé | ×0,8 | ×1,6 | 1 |
| 3 | Agrandi | ×1,5 | ×2,4 | 3 |
| 4 | Mécanisé | ×2,6 | ×3,4 | 6 |
| 5 | Industriel | ×4,2 | ×4,6 | 10 |

Le coût croît plus vite que la capacité : agrandir reste rentable, jamais
gratuit.

**Rendu 3D par palier** — le bâtiment gagne 16 % de hauteur par niveau, plus
une cheminée au niveau 3, une annexe au niveau 4, une citerne au niveau 5. Un
silo gagne une cuve tous les deux paliers.

`POST /buildings/:id/upgrade` applique le palier ; `getFarmBonuses()` lit les
capacités via `buildingStatsAtLevel()`, donc un bâtiment amélioré augmente
réellement le stockage et les bonus.

---

## 5. Graphismes

Huit illustrations isométriques générées dans le style de la planche de
référence : toit vert sarcelle, murs bois miel, socle en tuile d'herbe.

`apps/web/public/assets/buildings/*.webp` — 320 px, fond détouré, **204 Ko au
total** (9,5 Mo avant traitement).

Les matériaux 3D suivent la même charte : `ROOF_TEAL` pour tous les toits,
`WOOD_WARM` pour les bois, ce qui donne à la ferme une unité visuelle que les
couleurs disparates précédentes n'avaient pas.

---

## 6. Reste à faire

- **Enchères** : les fonctions de calcul existent (`auctionStartPrice`, `minimumBid`), le modèle de données et les routes non
- **Jachère** : les statuts se calculent, mais aucune tâche de fond ne les applique ni ne restaure une parcelle saisie
- **Taxe** : `landTax()` est testée mais n'est pas encore prélevée par le tick
- **Générateur de régions** à 80 % d'occupation
- **Cultures verrouillées par climat** — le jeu ne connaît que blé et maïs
- **Paliers de bâtiment visibles sur la planche d'art** : les niveaux 1 à 5 de la référence changent de forme, pas seulement de taille
