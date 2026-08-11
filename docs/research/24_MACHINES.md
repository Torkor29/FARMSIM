# 24 — Machines (achat, usure, prérequis)

> **MVP :** tracteur obligatoire pour semer / ferti ; moissonneuse pour récolter.  
> Usure = sink CRD. Hangar −15 % usure. Atelier −coût réparation.

---

## Catalogue T1

| Type | Coût | Usure / case | Travaux |
|------|-----:|-------------:|---------|
| TRACTOR | 3200 | 0.7 | Plant, ferti, labour |
| HARVESTER | 4800 | 1.1 | Récolte |
| SPREADER | 1800 | 0.45 | Ferti (plus soft) |

`minCondition` ≈ 12 : en dessous → réparation obligatoire.

## Départ

| Spé | Machines |
|-----|----------|
| Céréalier / Éleveur | 1× TRACTOR |
| ETA | 1× TRACTOR + 1× HARVESTER |

Le céréalier doit **acheter une moissonneuse** (ou faire appel ETA plus tard) pour récolter.

## Flux

```
achat → (optionnel park / hangar) → travail cases → usure → réparation
```

## API

- `GET /meta/machines`
- `POST /machines/buy` `{ userId, type }`
- `POST /machines/:id/repair` `{ userId }`
- plant / fertilize / harvest consomment la machine adaptée
- contrats NPC : machine requise + usure forfaitaire (~10 cases)

## Formules (`@farmsim/sim`)

- `applyMachineWear({ condition, wearPerCell, cells, inShed?, etaBonus? })`
- `repairMachineCost({ condition, repairCostPerPoint, workshopDiscount? })`
