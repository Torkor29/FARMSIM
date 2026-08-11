# 28 — Zone Map UI (sélection parcelle)

**Statut :** MVP UI  
**Composant :** `apps/web/src/ZoneMap.tsx`  
**Styles :** `.zone-map*` dans `apps/web/src/styles.css`

---

## But

Remplacer / compléter la liste de boutons « parcelles libres » par une **grille visuelle** `mapW × mapH` par zone (ex. FR-BEAUCE, US-IOWA), alignée sur le HUD glass dark existant.

---

## États de case

| Classe | Signification |
|--------|----------------|
| `st-free` | Libre (`farmId` null) — cliquable si autorisée |
| `st-mine` | Appartient à la ferme du joueur (`myFarmId`) |
| `st-other` | Occupée par un autre joueur |
| `st-empty` | Coordonnée hors seed (pas de parcelle) |

Hover / `title` : label, `(mapX,mapY)`, prix CRD, statut.

---

## Intégration

1. **Register (onboarding)** — toutes les cases libres sont sélectionnables → `selectedParcelId` → `/auth/register`.
2. **Panel ETA / Expansion** — `selectableIds` = libres **adjacentes** (4-dir) aux parcelles possédées ; clic → `buyAdjacent` → `POST /parcels/:id/buy`.

Login / register hors carte inchangés.

---

## Props principales

- `zone` : code, name, koppen, mapW/H, parcels
- `myFarmId`, `selectedParcelId`, `selectableIds`, `onSelect`, `compact`, `showLegend`
