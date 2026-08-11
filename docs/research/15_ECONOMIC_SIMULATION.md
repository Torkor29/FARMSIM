# 15 — Economic Simulation

**But :** tester la stabilité avant code production.  
Les chiffres ci-dessous sont **`[TEST]` / `[GD]`** sauf mention.

---

## 1. Unités & hypothèses de base

- 1 tick marché = 1 heure réelle (accélérable en lab)
- 1 jour-jeu = 24 ticks accélérés ou catch-up
- Prix blé initial `P0 = 220 CRD/t` (ancre ~€/t calme)
- Parcelle MVP produit en moyenne `Y = 8 t` blé / cycle (abstraction, pas ha réels)
- Cycle cultural moyen = 14 jours réels `[TEST]` (compression temps)
- Coût cycle (semences+engrais+fuel+usure) = `C = 900 CRD`
- Marge brute spot si tout vendu à 220 : `8*220 - 900 = 860 CRD` / cycle

---

## 2. Modèle monétaire simplifié

Soit `N` joueurs actifs céréaliers.

Production vendue / cycle monde ≈ `N * Y * sellRatio`

Demande NPC / cycle `D = D0 * (1 - ε * (P - P0)/P0)` avec `ε = 0.4`

Faucet net ≈ `sum(sales) - sum(costs NPC) - storageFees - taxes`

Cible : faucet net ≈ 0 ± 10 % sur 90 jours simulés.

---

## 3. Scénarios N joueurs

### 1 000 joueurs
- Assume 70 % céréaliers actifs = 700
- Offre cycle ≈ 700 * 8 * 0.85 ≈ 4760 t
- Si D0 = 5000 t → prix stables ~P0
- Risque faible ; tuning facile

### 10 000 joueurs
- Offre ×10 → il **faut** scaler D0 et sinks (terrains, machines)
- Sinon prix → Pmin et CRD raréfiée chez vendeurs… ou inverse si D fixe trop haut
- **Règle :** demande NPC = f(population active) avec amortissement

### 100 000 joueurs
- Shard logique / marchés régionaux ou demande multi-couches
- Caps anti-bot critiques
- Sinks structurels (expansions, R&D, buildings) obligatoires
- Sans scaling demande : hyperdeflation prix + frustration

---

## 4. Scénario sécheresse

- −30 % yield sur 20 % des zones productives
- Offre globale −6 %
- Prix +12–20 % selon κ
- Stockeurs gagnent ; non-assurés perdent
- **Validité design :** événement lisible, pas wipe total

---

## 5. Scénario trop d’éleveurs

- Demande feed ↑ → prix céréales ↑
- Marges éleveurs ↓ → switch spé / réduction cheptel
- Filet aliments NPC empêche extinction

### Trop de céréaliers
- Prix grain ↓ ; viande ↑ ; engrais organiques rares ↑
- Incite diversification

---

## 6. Spéculation stockage

Si frais stockage trop bas + volatilité haute → dominant strategy store forever.  
Si frais trop hauts → never store.  
Cible : EV(storage) légèrement négative en moyenne, positive si skill forecast.

---

## 7. Inflation CRD

Mesure : panier (blé, diesel, semence, terrain starter).  
Si panier ↑ > 5 %/mois → hausser sinks / baisser faucets.  
Publier transparence style MER (inspiration EVE).

---

## 8. Simulation lab (outil futur)

Script Python/TS :
- agents aléatoires (vendeur immédiat, stockeur, presta)
- 90–180 jours
- export courbes prix / Gini / faucet net

**Livrable code de sim :** après phase docs, avant économie production — pas le jeu client.

---

## 9. Tableau balancing initial blé

| Élément | Valeur | Source | Justification |
|---------|--------|--------|---------------|
| Prix initial | 220 CRD/t | `[RÉEL]` ancré | Zone calme Euronext-like |
| Prix min | 120 | `[GD]` | Évite death spiral revenus |
| Prix max | 450 | `[RÉEL]` inspiré pic 2022 | Rare, événementiel |
| Yield cycle | 8 t | `[GD]` | Abstraction parcelle |
| Coût cycle | 900 | `[TEST]` | Marge ~40 % skill moyen |
| Frais stock /jour | 0.5 % | `[TEST]` | Anti-hoard |
| Bonus spé max | +10 % | `[GD]` | Design |
| Bonus level max | +10 % | `[GD]` | Design |

---

## 10. Conclusions sim préliminaires

1. Demande NPC **doit croître avec la population**.
2. Sans sinks machines/terrains, CRD s’accumule.
3. Interdépendance élevage OK avec filets.
4. Prix réels live inutiles au runtime.
5. Besoin d’un harness de simulation dès le début du dev économie.
