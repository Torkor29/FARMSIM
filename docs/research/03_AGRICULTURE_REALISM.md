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

| Type | Source | Effet principal | Secondaire | Coût relatif `[GD]` |
|------|--------|-----------------|------------|---------------------|
| Minéral NPK | Achat NPC | +N rapide | Peu d’effet matière organique | Moyen |
| Fumier | Élevage / marché | +N + structure lente | Qualité sol | Variable |
| Lisier | Élevage | +N rapide | Transport / fenêtre | Variable |
| Compost | Plus tard | Structure / qualité | Lent | Élevé effort |
| Engrais vert | Culture intercalaire | +N partiel | Temps perdu | Faible cash |

Combinaison avec rotation + variété + météo = levier stratégique (pas un bouton +50 %).

---

## 6. Eau & irrigation

- Pluie régionale alimente `humidité`.
- Sécheresse → stress → −rendement / −qualité.
- Irrigation `[V1]` : capex + opex (énergie/eau) ; plafonnée selon réglementation locale future.
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
- (élevage) alimentation & santé.

Prix marché = prix base × multiplicateur grade.

---

## 10. Élevage (aperçu — détail `07`)

Variables clés réelles à garder :
- conversion alimentaire (kg aliment → produit) ;
- courbe de croissance ;
- reproduction ;
- santé / mortalité ;
- bâtiments (capacité, confort) ;
- effluents (fumier/lisier) comme co-produit économique.

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
