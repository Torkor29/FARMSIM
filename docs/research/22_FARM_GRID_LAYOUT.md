# 22 — Farm Grid Layout (parcelle jouable)

**Statut :** design + MVP en cours  
**Source :** brief Discord (placement cultures / bâtiments / véhicules / silos)

---

## Vision

Chaque **parcelle** est une grille `gridW × gridH` (MVP : **8×8**).  
Le joueur y place librement :

| Contenu | Exemples |
|---------|----------|
| Cultures | Blé, maïs (cases libres) |
| Bâtiments élevage | Étable bovins, porcherie |
| Stockage | Silo grain, hangar paille/foin, hangar matériel |
| Véhicules | Tracteur, moissonneuse stationnés sur cases (ou rangés dans hangar) |

Les **parcelles** d’une zone sont aussi sur une grille carte (`mapX`, `mapY`) : on peut **acheter une parcelle adjacente** si elle est libre (pas de voisin propriétaire).

---

## Bâtiments (menu)

Chaque type a : coût CRD, emprise `w×h`, capacité stockage optionnelle, **bonus d’exploitation**.

| Code | Nom | Emprise | Rôle | Bonus `[GD]` |
|------|-----|---------|------|--------------|
| SILO | Silo à grain | 2×2 | Stock céréales | +capacité stock grain |
| HAY_BARN | Hangar paille/foin | 2×2 | Stock fourrage | +capacité foin/paille |
| MACHINE_SHED | Hangar matériel | 3×2 | Range engins | −usure au parking / +slots |
| CATTLE_BARN | Étable bovins | 3×3 | Élevage (V1+) | +capacité bovins ; léger +qualité fumier |
| PIGSTY | Porcherie | 2×3 | Élevage (V1+) | +capacité porcs |
| WORKSHOP | Atelier | 2×2 | Réparations | −coût réparation |
| FARMHOUSE | Maison d’exploitation | 2×2 | HQ | +2 % XP exploitation `[GD]` |

**Règle :** un bâtiment occupe toutes ses cases ; placement refusé si collision.  
Démolition : rembourse ~40 % (sink partiel).

---

## Véhicules

- Achat → inventaire « non placé » ou spawn sur HQ.
- **Stationner** sur une case libre (ou entrée hangar).
- Engin dans `MACHINE_SHED` : ne bloque pas la grille, compte dans capacité hangar.

---

## Adjacence

- Achat possible si `parcel` libre **et** partage un bord avec une parcelle déjà possédée (4-directions).
- ETA sans terre : peut d’abord acheter n’importe quelle parcelle libre (1ʳᵉ), puis adjacentes.

---

## Bonus agrégés

```
farmBonuses = sum(buildings.bonuses) capés
  yieldBonus ≤ +10 %
  storageGrain, storageHay, machineSlots, animalSlots…
```

Cohérent avec la règle globale « bonus faibles ».

---

## MVP implémenté

- Grille 8×8 interactive
- Placement bâtiments du catalogue
- Plantation case par case
- Parking machines
- Achat parcelle adjacente
- Bonus affichés (stock / yield léger)
