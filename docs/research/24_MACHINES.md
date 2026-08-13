# 24 — Machines (achat, usure, prérequis)

> **MVP :** tracteur obligatoire pour semer / ferti ; moissonneuse pour récolter.  
> Usure = sink TRN. Hangar −15 % usure. Atelier −coût réparation.  
> Barème calé sur la grille **12×12** : une machine T1 survit à **au moins une parcelle** avant le seuil.

---

## Catalogue T1

Ancre : révision complète ≈ **20 %** du prix d'achat. Rafistolage = moitié du chemin vers le neuf (0 % → 50 %, moitié du coût).

| Type | Achat | Usure / case | Réparer 1 pt | Révision 0→100 | 12×12 (une parcelle) |
|------|------:|-------------:|-------------:|---------------:|----------------------|
| TRACTOR | 2800 | 0,25 | 6 | 560 | −36 pts, reste 64 |
| HARVESTER | 4000 | 0,32 | 8 | 800 | −46 pts, reste 54 |
| SPREADER | 1500 | 0,20 | 3 | 300 | −29 pts |
| DISC_HARROW | 1600 | 0,18 | 4 | 400 | −26 pts |

`minCondition` = **15** : en dessous → rafistoler ou réviser.

Avant (usure 1,1 / case) : une moisson 12×12 tuait la moissonneuse (158 pts). C'est ça qui laissait l'engin HS et une révision inabordable.

## Réparer

| Geste | Cible | Ex. moissonneuse à 0 % |
|-------|-------|------------------------|
| **Rafistoler** | `condition + (100 − condition) / 2` | 50 %, **400 TRN** |
| **Réviser** | 100 % | **800 TRN** |

Les deux boutons sont dans le garage. Le prix est sur le bouton. On peut rafistoler si on n'a pas de quoi réviser.

## Prestation (faire venir une entreprise)

`quote = 80 + taux × cases`. Une parcelle entière coûte **moins** que l'engin.

| Travail | Taux / case | 24 cases | 144 cases | vs achat |
|---------|------------:|---------:|----------:|----------|
| Semis | 8 | 272 | 1 232 | tracteur 2 800 |
| Épandage | 6 | 224 | 944 | épandeur 1 500 |
| Moisson | 12 | 368 | 1 808 | moissonneuse 4 000 |
| Labour | 5 | 200 | 800 | |
| Déchaumage | 4 | 176 | 656 | |

Seuil d'achat moissonneuse : `4000 / 12 ≈ 334 cases` ≈ 2,3 parcelles sous-traitées.

## Départ

| Spé | Machines |
|-----|----------|
| Céréalier / Éleveur | 1× TRACTOR |
| ETA | 1× TRACTOR + 1× HARVESTER |

Le céréalier doit **acheter une moissonneuse** (ou sous-traiter) pour récolter.

## Flux

```
achat → (optionnel park / hangar) → travail cases → usure → rafistoler | réviser
```

## API

- `GET /meta/machines`
- `POST /machines/buy` `{ userId, type }`
- `POST /machines/:id/repair` `{ userId, extent?: "half" | "full" }`
- plant / fertilize / harvest consomment la machine adaptée

## Formules (`@farmsim/shared`)

- `applyMachineWear` (sim)
- `repairQuote` / `repairHalfwayTarget`
- `contractorQuote`
