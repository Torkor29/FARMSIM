# 27 — Humidité de récolte & séchage (V1 MVP)

**Statut :** implémenté côté code (shared / sim / API / UI)  
**Réf. :** `03_AGRICULTURE_REALISM.md` §9b · brief Discord (humidité + cellule sécheuse)

---

## Objectif

Rendre la **météo à la récolte** tangible : grain humide → malus à la vente, avec option de **sécher** (coût CRD) avant de vendre.

## Modèle MVP `[GD]` / `[TEST]`

| Concept | Implémentation |
|--------|----------------|
| Humidité à la récolte | `harvestMoisture(weather)` → fraction 0–1 stockée sur `InventoryItem.moisture` |
| Malus rendement | inchangé : `moisturePenalty` (pluie/orage/neige) dans `simulateCell` |
| Séchage | `dryInventory({ moisture, tons, passes, barnBonus })` |
| Coût | `DRYING.costPerTonPerPass` × tonnes × passes |
| Réduction | `moistureReductionPerPass` (+ bonus SILO / HAY_BARN) |
| Plancher | `moistureFloor` (pas de sur-séchage gratuit) |
| Vente | si `moisture > sellThreshold` → `sellPenaltyAbove` passé à `sellToMarket` |

### Soft dryer (pas de bâtiment DRYER dédié)

SILO ou HAY_BARN sur la ferme active `barnBonus` : réduction d’humidité supplémentaire par passe (`barnExtraReduction`). Pas de nouveau `BuildingType` en MVP.

## Flux

1. **Récolte** — météo zone → `harvestMoisture` ; merge stock avec moyenne pondérée qty×moisture ; qualité ↓ si humidité élevée.
2. **Sécher** — `POST /inventory/dry` { userId, itemId, tons?, passes? } : débit CRD, baisse `moisture`.
3. **Vendre** — malus si humidité > seuil (indépendant du grade qualité, qui reste un signal soft).

## Constantes

Voir `DRYING` dans `@farmsim/shared`. Valeurs marquées `[TEST]` — à calibrer en playtest.

## Hors scope MVP

- Durée / file d’attente séchoir, capacité max t/h, énergie dédiée, bâtiment DRYER 1×1.
