# 03 — Agriculture Realism (modèle simplifié crédible)

**But :** identifier les variables nécessaires à une simulation **crédible**, pas reproduire l’agronomie universitaire.

---

## 1. Principes de simplification

On conserve :
- calendrier cultural lié au climat ;
- rendement = f(sol, climat, intrants, variété, stress) ;
- qualité = f(stress, variété, pratiques) ;
- rotation / fatigue simplifiée ;
- eau et azote comme ressources clés ;
- risques (sécheresse, gel, grêle, maladies légères).

On abandonne au MVP :
- bilans hydriques journaliers complets ;
- microbiologie du sol ;
- épandage réglementaire précis ;
- modèles ravageurs multi-espèces.

---

## 2. Cultures MVP recommandées

| Culture | Rôle gameplay | Rendement ordres de grandeur `[RÉEL]` | Notes |
|---------|---------------|----------------------------------------|-------|
| Blé tendre | Base céréalière | FR ~6,2–7,4 t/ha (2023–24) ; monde ~2–8 | Meunerie : protéines souvent ≥11–11,5 % |
| Maïs grain | Fourrage/énergie, sensible eau | FR ~9–10 ; US ~11 t/ha ; Brésil ~5–6 | Stress floraison très punitif |
| Soja | Protéine, lien élevage | FR ~2,5–2,7 ; US/BR ~3,4 ; Arg ~3,0 | Peu/pas d’N minéral (fixation) |
| Colza | Oléagineux, rotation | FR ~3,0–3,7 t/ha | Retour ≥3–4 ans conseillé |
| Orge | Alternative blé / fourrage / brassicole | FR ~6–7 t/ha | Brassage : protéines plafonnées |

Sources : Agreste, FranceAgriMer, USDA PSD/IPAD, FAOSTAT, Terres Univia.

**Calendriers `[RÉEL]` :** HN — blé/colza semis automne ; maïs/soja printemps (sol ≥10 °C). HS : décalage ~+6 mois. FAO Crop Calendar / SEMAE / Chambres d’agriculture.

**Valeurs de jeu `[GD]` :** unités IG OK si les **ratios** entre cultures et régions collent à ces bornes.

---

## 3. Calendrier cultural (hémisphères)

### Tempéré Nord (ex. Europe, Midwest)
- Blé d’hiver : semis automne → récolte été
- Maïs : semis printemps → récolte automne
- Soja : printemps → automne
- Colza : souvent semis fin été / automne

### Tempéré Sud
Calendrier décalé de ~6 mois.

### Tropical / subtropical
Fenêtres plus larges ; contraintes = pluie / saison sèche / chaleur ; parfois multi-cycles/`[GD]` 2 récoltes/an max selon zone.

**Implémentation `[PROPOSITION]` :** chaque `Region` a un `cropCalendar` dérivé de la zone Köppen + hémisphère, pas un calendrier unique mondial.

---

## 4. Sol — modèle à 4 axes `[PROPOSITION]`

| Axe | Range | Effet |
|-----|-------|-------|
| Fertilité (N dispo) | 0–100 | Rendement |
| Structure / labour | 0–100 | Bonus type plow FS |
| pH / amendement | OK / NeedsLime | Malus si négligé |
| Humidité réservoir | 0–100 | Stress hydrique |

Mise à jour :
- culture consomme N ;
- engrais / fumier restaurent N (profils différents) ;
- rotation légumineuse (soja) restaure partiellement N ;
- monoculture réduite structure + hausse risque maladie `[GD]`.

---

## 5. Engrais

### Besoins N indicatifs (méthode bilan COMIFER) `[RÉEL]`
`Dose N ≈ besoin culture − fournitures sol`  
Ex. : blé ~2,8–3,2 kg N/q ; maïs grain ~2,1–2,3 kg N/q ; soja ≈ 0–30 kg starter.

| Type | Source | Effet principal | Secondaire | Coût relatif `[GD]` |
|------|--------|-----------------|------------|---------------------|
| Minéral NPK | Achat NPC | +N rapide | Peu d’effet matière organique | Moyen |
| Fumier bovin | Élevage / marché | +N lent (~4–6 kg N/t) ; Keq année 1 ~0,3 | Structure / MO | Variable |
| Lisier | Élevage | +N plus disponible (Keq ~0,45–0,6) | Transport / fenêtre | Variable |
| Compost | Plus tard | Structure / qualité | Lent | Élevé effort |
| Engrais vert / légumineuse | Précédent | +20–60 kg N/ha équivalent `[A]` | Temps / place rotation | Faible cash |

Sources : COMIFER, ARVALIS, Protect’eau, APORTHE.

---

## 6. Eau & irrigation

Consommation sans stress indicative `[RÉEL]` (ARVALIS / Perspectives Agricoles) :
- Blé ~350–500 mm · Orge P ~220–350 · Maïs ~450–600 mm.

- Pluie régionale alimente `humidité` / RU.
- Sécheresse à floraison maïs → pertes fortes (méta-analyses jusqu’à ~−40 % en stress sévère).
- Irrigation `[V1]` : capex + opex ; efficience ordre ~2–4 q / 10 mm selon culture.
- Excès d’eau / inondation → pourriture / −qualité / blocage travaux.

---

## 7. Semences & variétés

Chaque `SeedVariant` :

| Attribut | Description |
|----------|-------------|
| yieldPotential | Plafond rendement |
| coldResist | Gel |
| droughtResist | Sécheresse |
| pestResist | Ravageurs/maladies |
| qualityBias | Qualité intrinsèque |
| growthSpeed | Durée cycle |
| waterNeed | Besoin eau |
| fertilizerNeed | Besoin N |
| cost | Prix semence |
| regulatoryFlags | OGM, bio, etc. |

**Compromis obligatoires `[PROPOSITION]` :** aucun variant n’est dominant sur tous les axes (pareto).  
Exemple : +15 % rendement ⇒ −5 % qualité ; +20 % drought ⇒ +10 % coût.

R&D joueur : voir `06_PROGRESSION.md`.

---

## 8. Maladies & ravageurs (léger)

Score de risque régional × monoculture × météo humide × résistance variété.  
Traitements : coût + éventuel −qualité perçue (surtout si intensif).  
Pas de sim phytopathologie complète.

---

## 9. Qualité

Grade 1–5 dérivé de :
- stress cumulé ;
- variété ;
- fertilisation équilibrée (pas seulement max N) ;
- timing récolte ;
- **humidité à la récolte** (voir §9b) ;
- (élevage) alimentation & santé.

Prix marché = prix base × multiplicateur grade.

---

## 9b. Humidité de récolte & séchage `[PROPOSITION]`

La rentabilité dépend de l’**hygrométrie** à la récolte :
- trop humide → malus prix immédiat (ou refus partiel) ;
- le joueur peut **vendre tel quel** (moins cher) ou envoyer en **cellule sécheuse** (+valeur, +temps, +coût énergie).

Variables : `grainMoisture`, `dryerCapacity`, `dryCost`, `dryDuration`.  
MVP : malus pluie à la récolte. V1 : séchage jouable.

---

## 10. Élevage (aperçu — détail `07`)

Ancres techniques `[RÉEL]` :
- Porc FR (IFIP 2023) : IC global ~2,76 ; ~25,3 porcs/truie/an ; GMQ engraissement ~842 g/j.
- Lait : cas-types souvent ~7 000–8 500 L/vache/an (EcoAlim / INRAE).
- Pondeuses : ~300–330 œufs/an ; poulet standard IC ~1,6–1,7 `[A]`.
- Efficience N animale souvent **<50 %** → reste en effluents (boucle fumier).

Variables à garder : IC, courbe croissance, reproduction, santé, bâtiments, effluents.

---

## 11. OGM & réglementation (neutre)

**Ne pas** faire « OGM = mal ».  
Traits typiques `[PROPOSITION]` : +rendement et/ou +résistance, coût semence +, flags région (autorisé / interdit / taxé / subventionné bio).  
Marché peut payer moins ou plus selon demande « perçue » régionale (paramètre économique, pas moralisateur).

---

## 12. Formule rendement conceptuelle `[GD]`

```
yield = baseYield(crop, region)
      × variety.yieldPotential
      × soilFertilityFactor
      × waterFactor
      × weedFactor
      × diseaseFactor
      × managementFactor (labour, lime…)
      × weatherEventFactor
      × specializationBonus (≤ 1.10)
      × levelBonus (≤ 1.10)
```

Tous les facteurs clampés pour éviter explosions (ex. productoire plafonnée).

---

## Sources

- USDA FAS PSD Online (rendements mondiaux blé ~3,5 t/ha)
- FAOSTAT Agricultural production statistics
- OECD-FAO Agricultural Outlook 2024–2033
- Purdue / agri benchmark soybean benchmarks
- Classification Köppen-Geiger (Beck et al.)
