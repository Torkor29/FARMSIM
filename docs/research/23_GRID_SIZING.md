# Dimensionnement optimal de la grille d’exploitation

> **Verdict MVP : 12×12 (144 cases) ≈ 14 ha narratifs.**  
> 8×8 est trop juste dès qu’on place infra + cultures. 16×16 trop lourd sans outils brush.

---

## 1. Ce que le mockup montre (et le problème)

Le concept iso low-poly (France hex + ferme surélevée) affiche **« 10 Ha (8×8) »**. Visuellement c’est beau, mais le **budget cases** ne tient pas :

| Emprise réaliste (catalogue) | Cases |
|------------------------------|------:|
| Maison + atelier + 2 hangars | ~12 |
| 2 silos + grange | ~6 |
| Étable + porcherie | ~18 |
| Circulation / accès machines | ~8–12 |
| **Sous-total infra** | **~40–50** |
| Reste pour cultures sur 8×8 (64) | **14–24** |

→ Moins d’un quart de la parcelle cultivable = **frustrant** pour un jeu « ferme ».  
Le mockup « remplit » l’écran mais **sous-estime** l’occupation réelle des footprints.

---

## 2. Contraintes à optimiser

| Critère | Impact |
|---------|--------|
| Cases cultivables après infra | Fun céréales / rotations |
| Emprises bâtiments (3×4 élevage) | Ne pas bloquer toute la grille |
| Cliqueable à la souris | Cases trop petites = rage quit |
| Perf Three.js / sync API | O(N²) cells × parcelles |
| Lecture iso | Trop grand = « mer de verts » |
| Expansion (achat adjacent) | Multi-parcelles = multi-grilles |

---

## 3. Comparatif chiffré

Hypothèse : **infra typique mid-early** ≈ **45 cases** occupées.

| Grille | Total | Libre après infra | % culture | Surface narrative* | Verdict |
|--------|------:|------------------:|----------:|--------------------:|---------|
| 6×6 | 36 | −9 | 0 % | ~5 ha | Mort |
| **8×8** (mockup) | 64 | **19** | **30 %** | **10 ha** | **Trop juste** |
| 10×10 | 100 | 55 | 55 % | ~12 ha | Acceptable early |
| **12×12** | **144** | **99** | **69 %** | **~14 ha** | **Sweet spot MVP** |
| 14×14 | 196 | 151 | 77 % | ~17 ha | Bon si brush |
| 16×16 | 256 | 211 | 82 % | ~20 ha | Trop pour 1 clic/case |
| 20×20 | 400 | 355 | 89 % | ~25 ha | Besoin outils zone |

\*Calibration : ~0,1 ha / case → 12×12 ≈ 14,4 ha (arrondi **14 ha** UI).

**Pourquoi pas « 10 ha = 8×8 » figé ?**  
On privilégie le **fun layout** sur la cohérence ha stricte. Les ha restent un **label économique** (prix terre, stats), pas une simulation cadastrale.

---

## 4. Formule de décision

```
cases_utiles ≈ N² − Σ(emprises) − marge_circulation(~10 %)
objectif_culture_early ≥ 60 % des cases
⇒ N² × 0.9 − 45 ≥ 0.6 × N²
⇒ 0.3 N² ≥ 45
⇒ N² ≥ 150
⇒ N ≥ ~12.2
```

→ **N = 12** est le plus petit entier qui respecte l’objectif mid-early.

Early game (maison + 1 hangar + 1 silo ≈ 12 cases) :
- 8×8 → 81 % culture (OK)
- 12×12 → 92 % culture (large, mais laisse place à l’expansion d’infra)

Late (infra lourde 70 cases) :
- 8×8 → **plein / bloqué**
- 12×12 → encore ~50 % culture

---

## 5. Interaction avec le nombre de parcelles

| Stratégie | Grille | Parcelles mid | Cases totales | Commentaire |
|-----------|--------|---------------|---------------|-------------|
| Petites nombreuses | 8×8 | 6 | 384 | Micro-gestion lourde, UI multi-onglets |
| **Moyennes** | **12×12** | **3–4** | **~500** | **Équilibre** |
| Grosses rares | 16×16 | 2 | 512 | Même volume, moins de frontières / achats |

**Recommandation design :**
1. **MVP** : une parcelle **12×12** active à l’écran ; autres en liste / carte.
2. **V1** : fusion visuelle des parcelles **adjacentes** → une mega-grille (somme des emprises) avec joints de propriété.
3. Ne pas monter à 16×16 **par parcelle** tant que le brush (semer zone) n’existe pas.

---

## 6. Décision produit (figée pour le code)

| Paramètre | Valeur |
|-----------|--------|
| `DEFAULT_GRID` | `{ w: 12, h: 12 }` |
| `PARCEL_HECTARES` | `14` |
| UI label | « 14 Ha (12×12) » |
| Mockup 8×8 | **référence style**, pas taille de prod |
| Upgrade futur | parcels premium 14×14 / 16×16 (payant ou late) |

---

## 7. Style visuel (aligné mockup)

Indépendant de N, à implémenter :

- Vue **isométrique** low-poly (Three.js)
- Plateforme ferme **surélevée** + bordure haie / clôture
- Fond **carte hex** (zone / pays) floutée ou stylisée
- UI dark translucide : contexte géo, menu bâtiments, barre Till / Sow / Fertilize / Harvest / **ETA**
- Cases cultivées = extrusions couleur (vert pousse → or mature)
- Bâtiments = boîtes low-poly + toits colorés
- Highlight bordure verte sur case / parcelle sélectionnée

---

## 8. Perf (ordre de grandeur)

| | 8×8 | 12×12 | 16×16 |
|--|----:|------:|------:|
| Meshes cases (1 parcelle) | 64 | 144 | 256 |
| 4 parcelles fusionnées | 256 | 576 | 1024 |
| Budget confort navigateur (instanced) | ✅ | ✅ | ⚠️ sans LOD |

12×12 × 4 parcelles reste confortable avec **InstancedMesh**.

---

*Doc décision grille — FARMSIM*
