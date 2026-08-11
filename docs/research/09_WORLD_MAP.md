# 09 — World Map & Parcelles

---

## 1. Problème

Représenter la Terre sans simuler chaque m², tout en rendant lat/long **significatifs**.

---

## 2. Hierarchie spatiale `[PROPOSITION]`

```
World
 └─ Country (ISO)
     └─ MacroRegion (ex. "Bassin parisien", "Iowa")
         └─ Zone / cellule météo (H3 res 5–6 ≈ 36–250 km², ou grille 0.1°)
             └─ Parcel (unité achetable / jouable, 5–20 ha MVP)
                 └─ Cells (grille de travail machine)
```

| Niveau | Rôle | Sim |
|--------|------|-----|
| Country | UI, langue, flags légaux futurs | Règles |
| MacroRegion | Identité / marketing / marché local V1 | Stats |
| Zone (H3) | Climat, sol bake, **1 météo/jour** | Tick météo |
| Parcel | Propriété joueur | État cultural |
| Cell | Travaux machines | Animation / temps |

**[FAIT]** Aires H3 : res5 ≈ 253 km², res6 ≈ 36 km², res7 ≈ 5,2 km² (h3geo.org).  
Générer seulement cellules **occupées / adjacentes joueurs** + bassins productifs NPC pour le marché — pas toute la Terre en 0,1°.

---

## 3. Grille de parcelles

**Ne pas** mailler toute la planète en parcelles actives.

Approche :
- Zones **ouvrables** (terres agricoles potentielles) pré-générées / baked.
- Densité plus forte près des hotspots de population joueurs.
- Réserve de parcelles « fantômes » générées à la demande.

Taille parcelle MVP `[TEST]` :
- **2–10 ha** équivalent narratif ;
- grille **8×8 à 16×16 cells** ;
- 1 cell = unité de travail (temps + yield slice).

Trop petit → micro-gestion. Trop grand → sessions interminables sans presta.

---

## 4. Attribution au joueur

1. Carte globe (zoom pays → région → zone).
2. Filtres : climat, prix terre, cultures adaptées, risque.
3. Achat ou bail d’une parcelle libre.
4. Soft limit : 1 parcelle au départ.

Terrains « premium » (climat idéal, faible risque) plus chers = sink + spread géographique.

---

## 5. Vue parcelle (isométrique)

Contenu visible :
- cells & stades culture ;
- bâtiments ;
- machines en action ;
- animaux (V1) ;
- chemins ;
- feedback météo.

Hors parcelle : carte 2D vectorielle / globe léger (MapLibre / custom canvas) — **pas** Three.js pour le globe entier.

---

## 6. Génération attributs

Bake offline :
- Köppen
- T°/précip norms
- soil class
- aptitude cultures (0–1)
- risk weights
- base land price

Stocké en DB / tuiles ; pas recalculé à chaque requête.

---

## 7. Multi-parcelles & distance

Malus gestion si parcelles très éloignées (coût logistique IG).  
Encourage clusters régionaux → vie sociale / politique locale future.

---

## 8. Politique locale (futur)

Unité pertinente = **Zone** ou **MacroRegion** avec N joueurs minimum (ex. 50) pour élections.  
Voir `10_MULTIPLAYER.md`.

---

## 9. MVP carte

- 1–3 continents ouverts (ex. Europe + Midwest US) ;
- quelques centaines/milliers de parcelles préplacées ;
- sélection sur carte stylisée ;
- pas de couverture Terre complète jour 1.
