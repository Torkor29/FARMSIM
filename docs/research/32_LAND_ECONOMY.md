# 32 — Économie foncière stratégique (Land Economy)

**Statut :** conception (aucun code écrit)
**Périmètre :** monde persistant multi-continents, prix du foncier, rareté, incitations à l'expansion, anti-monopole, attribution de la parcelle de départ, schéma de données et API.
**Docs liés :** [04_ECONOMY_DESIGN.md](./04_ECONOMY_DESIGN.md) · [06_PROGRESSION.md](./06_PROGRESSION.md) · [09_WORLD_MAP.md](./09_WORLD_MAP.md) · [22_FARM_GRID_LAYOUT.md](./22_FARM_GRID_LAYOUT.md) · [23_GRID_SIZING.md](./23_GRID_SIZING.md) · [28_ZONE_MAP_UI.md](./28_ZONE_MAP_UI.md)

> Rappel légende (voir `00_INDEX.md`) : `[RÉEL]` donnée réelle · `[GD]` choix de game design · `[HYPOTHÈSE]` non validé · `[TEST]` à calibrer par simulation · `[FAIT]` fait vérifiable · `[PROPOSITION]` proposition projet.

---

## 0. Résumé exécutif

| Décision | Valeur | Tag |
|---|---|---|
| Hiérarchie monde | `Continent > Region > Parcel (12×12) > Cell` | `[PROPOSITION]` |
| Surface parcelle | 14 ha (144 cases, ~0,1 ha/case) | `[GD]` — figé en `23_GRID_SIZING.md` |
| Parcelle de départ | **Gratuite**, garantie, jamais saisissable | `[GD]` |
| Prix de référence | `LAND_BASE_PER_HA = 420 CRD/ha` → **5 880 CRD** pour 14 ha « tout neutre » | `[GD]` |
| Escalade patrimoniale | `×1,40` par parcelle déjà possédée (au-delà de la 1ʳᵉ) | `[GD]` |
| Plafond de possession | **16 parcelles** / joueur, **6** / région, **40 %** max d'une région | `[GD]` |
| Taux d'occupation cible | **65–75 %** par continent (déclencheur d'ouverture de région à 80 %) | `[TEST]` |
| Réserve débutants | **8 %** des parcelles de chaque région, inaliénables | `[GD]` |
| Taxe foncière | **1,6 %** de la valeur / saison, progressive `×(1 + 0,12·(n−1))`, cap `×2,5` | `[TEST]` |
| Cycle économique foncier | 1 **cycle** = 24 h réelles ; 1 **saison** = 7 cycles | `[GD]` |
| Interdiction stricte | Aucune parcelle, enchère ou taxe payable en **PRM** | `[GD]` |

**Le pari de design :** le joueur gratuit reste compétitif à 1–3 parcelles ; l'expansion au-delà n'est pas un « plus de tout », c'est un **arbitrage** (capital immobilisé + taxe progressive + logistique) qui n'est rentable que si le joueur exploite les **synergies** (adjacence, saturation machines, diversification climatique, contrats ETA régionaux).

---

## 1. Modèle de prix foncier

### 1.1 Formule maîtresse

Le prix d'une parcelle est un produit de facteurs multiplicatifs appliqués à un prix de référence surfacique. Chaque facteur est **borné**, ce qui borne mécaniquement le produit.

```
P_ref   = LAND_BASE_PER_HA × HA                          # 420 × 14 = 5 880 CRD

P_brut  = P_ref
        × f_fert     (fertilité du sol)
        × f_clim     (aptitude climatique Köppen)
        × f_access   (distance marchés / infrastructures)
        × f_dens     (densité de joueurs voisins)
        × f_scar     (rareté du continent)
        × f_adj      (adjacence à VOS parcelles — surcote de convenance)
        × f_own      (escalade patrimoniale — anti-monopole)

P_final = round50( clamp( P_brut, 0,45 × P_ref × f_own , 6,0 × P_ref × f_own ) )
```

`round50` = arrondi au multiple de 50 CRD supérieur (lisibilité UI).

### 1.2 Détail des facteurs

| Facteur | Formule | Domaine | Entrées | Tag |
|---|---|---|---|---|
| `f_fert` | `0,70 + 0,60 × fertility` | `[0,70 ; 1,30]` | `Parcel.fertility` ∈ [0,1] | `[GD]` |
| `f_clim` | `K[koppen] × cropFitBonus` | `[0,80 ; 1,25]` | table §1.3 | `[GD]` |
| `f_access` | `0,80 + 0,30 × A` | `[0,80 ; 1,10]` | `A` = indice d'accès §1.4 | `[GD]` |
| `f_dens` | `1 + 0,35 × ρ^0,8` | `[1,00 ; 1,35]` | `ρ` = densité voisins §1.5 | `[TEST]` |
| `f_scar` | `1 + 0,90 × O²` | `[1,00 ; 1,90]` | `O` = occupation continent §1.6 | `[TEST]` |
| `f_adj` | `1 + 0,08 × k` | `[1,00 ; 1,32]` | `k` = nb de bords communs avec vos parcelles (0–4) | `[GD]` |
| `f_own` | `1,40^max(0, n−1)` | `[1,00 ; 111]` | `n` = parcelles déjà possédées | `[GD]` |

**Pourquoi `f_adj` fait *monter* le prix :** l'adjacence est un bénéfice (voir §3), donc elle se paie. Sans cette surcote, l'optimum serait trivialement « toujours acheter contigu » ; avec elle, le joueur arbitre entre *bloc compact cher* et *dispersion moins chère mais coûteuse en logistique*.

### 1.3 Table climatique `K[koppen]`

Ancrage : aptitude agronomique moyenne + risque climatique. `[RÉEL]` pour la classification Köppen, `[GD]` pour la valeur.

| Köppen | Libellé | `K` | Risque dominant | Tag |
|---|---|---:|---|---|
| `Cfb` | Océanique tempéré (Beauce, Bretagne, NZ) | **1,15** | Gel tardif, excès d'eau récolte | `[GD]` |
| `Cfa` | Subtropical humide (Sud-Brésil, Chine E.) | **1,12** | Orages, maladies fongiques | `[GD]` |
| `Dfa` | Continental chaud (Corn Belt, Ukraine S.) | **1,20** | Sécheresse estivale, grêle | `[GD]` |
| `Dfb` | Continental frais (Pologne, Manitoba) | **1,05** | Saison courte, gel précoce | `[GD]` |
| `Csa` | Méditerranéen (Andalousie, Californie) | **1,00** | Sécheresse, besoin irrigation | `[GD]` |
| `Aw` | Tropical à saison sèche (Cerrado, Sahel S.) | **0,95** | Saison sèche marquée, sols acides | `[GD]` |
| `BSk` | Steppe froide (Kazakhstan, Patagonie) | **0,88** | Rendement bas, vent, aridité | `[GD]` |
| `BWh` | Désertique chaud (irrigation obligatoire) | **0,80** | Eau = coût structurel | `[GD]` |
| `Dfc` / `ET` | Boréal / toundra (marginal) | **0,80** | Fenêtre culturale très courte | `[GD]` |

`cropFitBonus` = `1 + 0,05` si la région est **classée A** pour au moins 2 cultures du catalogue actif (`WHEAT`, `MAIZE` en MVP), sinon `1,00`. `[GD]`

### 1.4 Indice d'accès `A`

```
A = clamp( 1 − d_hub / D_MAX , 0 , 1 ) × 0,70
  + infraScore × 0,30

d_hub    = distance de Chebyshev (en cases carte) au hub de marché de la région
D_MAX    = 8                                                    [GD]
infraScore = 0,40·route + 0,35·silo_collecte + 0,25·rail_ou_port ∈ [0,1]   [GD]
```

| Situation | `d_hub` | `infraScore` | `A` | `f_access` |
|---|---:|---:|---:|---:|
| Parcelle adossée au hub, route + silo + rail | 0 | 1,00 | 1,00 | 1,100 |
| Périurbain agricole, route + silo | 2 | 0,75 | 0,750 | 1,025 |
| Plaine ordinaire, route seule | 4 | 0,40 | 0,470 | 0,941 |
| Front pionnier, piste | 7 | 0,10 | 0,118 | 0,835 |

*Les infrastructures ne sont pas statiques : une région qui gagne un silo de collecte (construit par un consortium de joueurs ou par le NPC à un seuil de volume) revalorise **toutes** ses parcelles. C'est un levier de méta-jeu voulu.* `[PROPOSITION]`

### 1.5 Densité de joueurs voisins `ρ`

```
ρ = (nb de parcelles possédées par des joueurs dans la fenêtre 5×5 centrée sur la parcelle) / 24
```

| Voisins possédés / 24 | `ρ` | `f_dens` | Lecture joueur |
|---:|---:|---:|---|
| 0 | 0,000 | 1,000 | Désert social |
| 3 | 0,125 | 1,067 | Hameau |
| 7 | 0,292 | 1,131 | Village actif |
| 14 | 0,583 | 1,227 | Bassin dense |
| 22 | 0,917 | 1,325 | Saturation |

Justification économique : la densité apporte des externalités positives réelles au joueur (marché local plus liquide, contrats ETA plus nombreux, entraide, mutualisation d'infra) — elle doit donc se payer. `[HYPOTHÈSE]`

### 1.6 Rareté du continent `O`

```
O = parcelles_possédées_continent / parcelles_ouvertes_continent
```

| `O` | `f_scar` | État du continent | Réaction système |
|---:|---:|---|---|
| 0,10 | 1,009 | Front pionnier | Terres bradées, aucune ouverture |
| 0,35 | 1,110 | En peuplement | Régime normal |
| 0,58 | 1,303 | Mature | Régime normal |
| 0,72 | 1,467 | Tendu | Pré-alerte UI « foncier rare » |
| 0,80 | 1,576 | **Seuil** | Déclenche l'ouverture d'une nouvelle région (§2.2) |
| 0,92 | 1,762 | Critique | Ouverture forcée + audit inactifs |

### 1.7 Exemples chiffrés complets

**Exemple A — « Beauce B-2 », 2ᵉ parcelle, contiguë sur 2 bords**

| Facteur | Entrée | Valeur |
|---|---|---:|
| `P_ref` | 14 ha × 420 | 5 880 |
| `f_fert` | fertility 0,72 | 1,132 |
| `f_clim` | Cfb 1,15 | 1,150 |
| `f_access` | A = 0,85 | 1,055 |
| `f_dens` | ρ = 0,292 | 1,131 |
| `f_scar` | O = 0,58 | 1,303 |
| `f_adj` | k = 2 | 1,160 |
| `f_own` | n = 1 | 1,000 |
| **Prix** | | **13 800 CRD** |

**Exemple B — « Iowa I-9 », 5ᵉ parcelle, isolée, bassin dense**

| Facteur | Entrée | Valeur |
|---|---|---:|
| `P_ref` | | 5 880 |
| `f_fert` | 0,80 | 1,180 |
| `f_clim` | Dfa 1,20 (sans bonus) | 1,120* |
| `f_access` | A = 0,95 | 1,085 |
| `f_dens` | ρ = 0,583 | 1,227 |
| `f_scar` | O = 0,74 | 1,493 |
| `f_adj` | k = 0 | 1,000 |
| `f_own` | n = 4 → 1,40⁴ | 3,842 |
| **Prix** | | **59 350 CRD** |

\* variante volontairement calculée avec `K = 1,12` pour illustrer une région Dfa *non classée A* (sol dégradé) — la même parcelle en Corn Belt classée A vaudrait ≈ 66 800 CRD.

**Exemple C — « Patagonie P-3 », front pionnier, 3ᵉ parcelle**

| Facteur | Entrée | Valeur |
|---|---|---:|
| `P_ref` | | 5 880 |
| `f_fert` | 0,48 | 0,988 |
| `f_clim` | BSk | 0,880 |
| `f_access` | A = 0,25 | 0,875 |
| `f_dens` | ρ = 0,083 | 1,048 |
| `f_scar` | O = 0,12 | 1,013 |
| `f_adj` | k = 0 | 1,000 |
| `f_own` | n = 2 → 1,40² | 1,960 |
| **Prix** | | **9 350 CRD** |

**Lecture :** trois parcelles, trois stratégies. A = consolidation (rentabilité immédiate, prix moyen). B = achat de performance pure (cher, mais 0,80 de fertilité en Dfa = la meilleure production brute du jeu). C = pari pionnier (4× moins cher que B pour un rendement ~40 % inférieur, mais on achète l'option d'une région qui se valorisera si elle se peuple).

**Exemple D — valeur notionnelle de la parcelle offerte (Beauce, starter)**
`5 880 × 1,120 × 1,150 × 1,070 × 1,097 × 1,272 × 1,000 × 1,000 = **11 300 CRD**`
→ le cadeau de départ vaut ~11 300 CRD, à comparer aux 12 000 CRD de trésorerie initiale actuelle. C'est le chiffre à afficher dans l'onboarding (« votre exploitation vaut déjà 23 300 CRD »).

### 1.8 Revalorisation dans le temps

Le prix n'est pas figé à la génération : il est recalculé à chaque **cycle** (24 h) et lissé pour éviter les à-coups.

```
P_t = clamp( P_model(t) , P_(t−1) × 0,92 , P_(t−1) × 1,08 )     # ±8 % / cycle max   [TEST]
```

Deux prix sont exposés à l'UI :
- **`askPrice`** — prix d'achat au NPC pour *ce* joueur (inclut `f_adj` et `f_own`, donc **personnalisé**) ;
- **`marketValue`** — valeur publique de référence (sans `f_adj` ni `f_own`), utilisée pour la taxe, le rachat, l'affichage des parcelles d'autrui et la mise à prix des enchères.

Revente au NPC : **65 %** de `marketValue` `[GD]` — l'écart de 35 % est un sink et décourage le flip spéculatif.

---

## 2. Rareté et pression : garder un monde « plein » sans bloquer les nouveaux

Le problème classique : si la terre est rare, les nouveaux n'entrent pas ; si elle est abondante, elle n'a aucune valeur. On résout par **quatre mécanismes simultanés** plutôt qu'un seul curseur.

### 2.1 Réserve débutants (garantie d'entrée)

| Règle | Valeur | Tag |
|---|---|---|
| `STARTER_POOL_RATIO` | **8 %** des parcelles de chaque région | `[GD]` |
| Achetable par un joueur existant | **Non, jamais** | `[GD]` |
| Réabondement | Si le pool d'une région < 3 parcelles → ouverture prioritaire de la région suivante | `[GD]` |
| Garantie produit | Il existe **toujours** ≥ 1 parcelle starter gratuite sur **chaque continent ouvert** | `[GD]` |

C'est la garantie dure : quel que soit l'état du monde, l'inscription gratuite aboutit. La rareté joue sur la **2ᵉ parcelle et au-delà**, jamais sur l'entrée.

### 2.2 Générateur de régions (soupape d'expansion)

Déclencheur : `O_continent ≥ 0,80` pendant **7 cycles consécutifs** `[TEST]`.

| Paramètre | Valeur | Tag |
|---|---|---|
| Taille d'une nouvelle région | 60–120 parcelles (grille carte 10×8 max) | `[GD]` |
| Volume ouvert par vague | **+15 %** du parc du continent | `[TEST]` |
| Position | Anneau extérieur : `d_hub` moyen supérieur de +2 à +4 à la région mère | `[GD]` |
| Qualité | `fertility` tirée dans `[0,40 ; 0,70]` (vs `[0,55 ; 0,85]` pour les régions cœur) | `[GD]` |
| Délai d'annonce | Région visible « en cours d'ouverture » **2 cycles** avant, avec ses stats | `[GD]` |
| Cooldown | 14 cycles minimum entre deux ouvertures sur le même continent | `[TEST]` |

**Point clé :** les nouvelles terres sont **moins bonnes et plus loin**, jamais meilleures. Elles soulagent la pression sans dévaluer le patrimoine des anciens (`f_scar` redescend, mais `f_access` et `f_fert` compensent). L'ouverture est un **événement de jeu** (nom de région, teaser, ruée), pas une ligne de patch note.

### 2.3 Inactivité : jachère, déprise, reprise

Échelle progressive, entièrement réversible jusqu'au dernier palier. `[GD]`

| Palier | Déclencheur (sans connexion) | Effet | Réversible |
|---|---|---|---|
| **ACTIVE** | — | Normal | — |
| **DORMANT** | 14 cycles | Production −50 %, taxe ×1,5, badge « veille » sur la carte | Oui, immédiat |
| **FALLOW** (jachère) | 30 cycles | `fertility −0,010/cycle` (plancher 0,35), cultures en cours perdues, parcelle hachurée sur la carte | Oui (remise en état = coût de restauration, §2.3.1) |
| **RECLAIMABLE** | 60 cycles | Les parcelles **au-delà de la 1ʳᵉ** partent en enchère publique. Propriétaire crédité de **60 %** de `marketValue`. | Non |
| **Parcelle starter** | jamais | **Immunisée** : le joueur retrouve toujours sa ferme d'origine | — |

**Congé déclaré `[GD]` :** 1×/an calendaire, le joueur peut déclarer un congé de **60 cycles** (gratuit, pas de PRM) qui gèle les compteurs d'inactivité et réduit la taxe de 50 %. Anti-abus : non cumulable, non rétroactif, annule les bonus d'adjacence pendant la période.

#### 2.3.1 Coût de restauration après jachère

`coût = 900 CRD × (0,70 − fertility_actuelle) / 0,10` par parcelle, plafonné à 4 500 CRD. `[TEST]`
Exemple : fertilité tombée à 0,45 → `900 × 2,5 = 2 250 CRD` pour revenir à 0,70. Restauration progressive : `+0,05` de fertilité par paiement, 1 paiement / cycle.

### 2.4 Taxe foncière (le vrai régulateur)

```
taxe_saison = marketValue × 0,016 × (1 + 0,12 × (n − 1))     cap multiplicateur ×2,5
taxe_cycle  = taxe_saison / 7                                 (prélèvement quotidien)
```

| `n` (parcelles) | Multiplicateur | Taxe / saison sur une parcelle à 15 000 CRD | Taxe totale du patrimoine / saison* |
|---:|---:|---:|---:|
| 1 | 1,00 | 240 | 240 |
| 3 | 1,24 | 298 | 894 |
| 5 | 1,48 | 355 | 1 776 |
| 8 | 1,84 | 442 | 3 533 |
| 10 | 2,08 | 499 | 4 992 |
| 16 | **2,50** (cap) | 600 | 9 600 |

\* hypothèse simplificatrice : toutes les parcelles valent 15 000 CRD. En pratique les grosses exploitations détiennent des parcelles plus chères, donc la charge réelle est supérieure.

**Non-paiement :** trésorerie insuffisante → dette foncière à **2 %/cycle** d'intérêt ; à 3 saisons de dette, saisie de la parcelle de plus faible `marketValue` (jamais la starter), le produit épongeant la dette. `[GD]`

**Destination des taxes :** 100 % détruites (sink pur), avec **20 % ré-injectés symboliquement** dans un « fonds régional » qui finance les infrastructures NPC de la région (silo de collecte, route) — visible sur une jauge. C'est un sink qui produit du contenu, pas un impôt aveugle. `[PROPOSITION]`

### 2.5 Enchères

Toute parcelle n'est pas achetable au clic. Trois canaux :

| Canal | Parcelles concernées | Mécanisme |
|---|---|---|
| **Achat direct NPC** | Parcelles ordinaires libres (score < P90 de la région) | `askPrice`, instantané |
| **Enchère anglaise** | Parcelles premium (score ≥ P90 région) + toutes les parcelles saisies | 48 h, mise à prix = `marketValue`, incrément min **+2 %**, anti-snipe **+2 min** si mise dans les 2 dernières minutes |
| **Attribution starter** | `STARTER_POOL` | Gratuit, non enchérissable, non revendable pendant 30 cycles |

| Paramètre enchère | Valeur | Tag |
|---|---|---|
| Durée | 48 h | `[GD]` |
| Commission adjudication | **5 %** du prix final, détruite | `[GD]` |
| Dépôt de garantie | 10 % de la mise, bloqué, perdu si défaut de paiement | `[GD]` |
| Plafond de mise | `min(crd_disponible, 8 × marketValue)` — anti-troll et anti-blanchiment | `[GD]` |
| Enchère par PRM | **Interdit** | `[GD]` |
| Visibilité | Mises anonymisées (« Enchérisseur #3 »), montants publics | `[GD]` |

### 2.6 Visibilité des parcelles d'autrui

Exigence produit : *« les parcelles déjà prises doivent être visibles mais non disponibles »*. Traduction en données exposées :

| Champ exposé | Parcelle libre | Parcelle possédée par autrui | Parcelle starter réservée |
|---|---|---|---|
| `status` | `FREE` | `OWNED` | `RESERVED_STARTER` |
| `label`, `mapX/Y`, `koppen`, `fertility` | ✅ | ✅ | ✅ |
| `marketValue` | ✅ | ✅ (transparence du marché) | ✅ |
| `askPrice` (personnalisé) | ✅ | ❌ `null` | ❌ `null` |
| `owner` | `null` | `{ handle, farmName, level }` — **jamais l'email** | `null` |
| `activityState` | `null` | `ACTIVE` / `DORMANT` / `FALLOW` | `null` |
| `claimable` | `true` si règles OK | `false` | `false` (sauf inscription) |

Voir mapping UI dans [28_ZONE_MAP_UI.md](./28_ZONE_MAP_UI.md) : classes `st-free` / `st-other` / `st-mine`, à compléter par `st-fallow` (hachures) et `st-auction` (pulsation dorée).

---

## 3. Pourquoi acheter ? Les cinq bénéfices concrets

Une expansion doit être **choisie**, pas subie. Voici les cinq raisons chiffrées, chacune avec sa condition d'activation.

### 3.1 Synergies d'adjacence

| Configuration | Bonus | Tag |
|---|---|---|
| 1 bord commun | Coût logistique inter-parcelles **−4 %**, vitesse de travail **+1,5 %** | `[GD]` |
| 2 bords communs | **−8 %**, **+3,0 %** | `[GD]` |
| 3 bords communs | **−12 %**, **+4,5 %** | `[GD]` |
| Bloc en L (3 contiguës) | **+1 slot bâtiment mutualisé** (le bâtiment sert les 3 parcelles) | `[GD]` |
| **Bloc 2×2 (« Domaine »)** | **−12 %** intrants transport, **méga-grille visuelle** (24×24 sans couture), **+1 contrat ETA local / cycle** | `[GD]` |
| Cap global adjacence | **+10 %** — aligné sur le plafond projet (`06_PROGRESSION.md`) | `[GD]` |

Le bloc 2×2 est le vrai objectif de mi-jeu : c'est le seul moyen d'obtenir la méga-grille fusionnée annoncée dans `23_GRID_SIZING.md` §5, qui change qualitativement le jeu (semis au brush sur 200+ cases d'un coup).

**Coût logistique de référence :**
```
logistique_cycle = 60 CRD × nb_parcelles
                 × (1 + 0,25 × d_hors_bloc + 0,80 × (nb_régions − 1) + 2,00 × (nb_continents − 1))
                 × (1 − bonus_adjacence)                        cap total ×5,0
```

| Patrimoine | Configuration | Logistique / cycle |
|---|---|---:|
| 4 parcelles | Bloc 2×2, 1 région | `60×4×(1+0)×0,88` = **211 CRD** |
| 4 parcelles | Dispersées, 1 région, `d=3` | `60×4×(1+0,75)` = **420 CRD** |
| 4 parcelles | 2 régions, dispersées | `60×4×(1,75+0,80)` = **612 CRD** |
| 4 parcelles | 2 continents | `60×4×(1,75+0,80+2,00)` = **1 092 CRD** |

→ La dispersion coûte jusqu'à **5× plus cher** en fonctionnement. Elle ne se justifie que par la diversification (§3.2) ou la spécialisation régionale (§3.3).

### 3.2 Diversification climatique = assurance

Modèle de risque : le revenu d'une parcelle a un coefficient de variation `CV₁ = 0,28` `[TEST]`. La corrélation météo entre parcelles vaut `ρ = 0,85` dans la même région, `ρ = 0,35` entre régions de climats Köppen différents `[HYPOTHÈSE]`.

```
CV_portefeuille(k) = CV₁ × √( (1 + (k−1)·ρ) / k )
```

| `k` climats distincts | `CV` (ρ = 0,35, inter-climat) | `CV` (ρ = 0,85, même région) | Gain de stabilité |
|---:|---:|---:|---|
| 1 | 28,0 % | 28,0 % | — |
| 2 | **23,0 %** | 26,9 % | −18 % de volatilité |
| 3 | **21,1 %** | 26,5 % | −25 % |
| 4 | **20,0 %** | 26,3 % | −29 % |
| 6 | **19,0 %** | 26,1 % | −32 % |

**Traduction mécanique en jeu** (pour que le joueur *voie* le bénéfice, pas seulement une statistique) :

| Nb de Köppen distincts possédés | Prime d'assurance récolte NPC | Accès crédit bancaire NPC |
|---:|---:|---|
| 1 | 6,0 % de la valeur assurée | Plafond = 0,8 × patrimoine |
| 2 | 5,2 % | 1,0 × |
| 3 | 4,6 % | 1,2 × |
| ≥ 4 | 4,2 % (plancher) | 1,4 × (plafond) |

Ce sont deux bénéfices **réels mais faibles** (conformes à la doctrine « bonus faibles ») dont le vrai gain reste la réduction de variance : un joueur mono-région qui prend une grêle perd sa saison ; un joueur trois-climats perd un tiers.

### 3.3 Spécialisation régionale (cultures verrouillées par climat)

Certaines cultures **n'existent pas** hors de leur climat. C'est le levier le plus fort pour justifier la multi-région, car il ouvre du contenu, pas des pourcentages.

| Culture | Köppen requis | Statut MVP | Marge relative `[TEST]` |
|---|---|---|---|
| Blé tendre (`WHEAT`) | Cfb, Cfa, Dfb | ✅ MVP | 1,00 (référence) |
| Maïs grain (`MAIZE`) | Dfa, Cfa | ✅ MVP | 1,15 |
| Orge / colza | Cfb, Dfb | V1 | 0,95 |
| Soja | Dfa, Cfa, Aw | V1 | 1,20 |
| Tournesol | Csa, BSk | V1 | 1,05 |
| Blé dur | Csa | V1 | 1,30 |
| Sorgho (résistant sécheresse) | BSk, BWh (irrigué) | V1 | 0,85 |
| Riz | Aw, Cfa (irrigué) | V2 | 1,45 |
| Prairie / lait haute qualité | Cfb uniquement | V1 | 1,25 |
| Vigne / olive (pérenne) | Csa uniquement | V2 | 1,60 (mais 3 saisons d'immobilisation) |

**Règle de design :** les cultures à forte marge sont dans des climats **médiocres pour les céréales** (Csa, Aw). On ne peut donc pas avoir « la meilleure région pour tout ». `[GD]`

### 3.4 Économies d'échelle sur les machines

Capacités de travail par saison `[GD]` (à ajouter à `MACHINE_DEFS`) :

| Machine | Capacité T1 | Capacité T2 | Capacité T3 |
|---|---:|---:|---:|
| Tracteur (ha / saison) | 20 | 45 | 120 |
| Moissonneuse (ha / saison) | 25 | 55 | 140 |
| Coût tracteur (CRD) | 3 200 | 7 600 | 16 000 |
| Coût moissonneuse (CRD) | 4 800 | 11 500 | 24 000 |

| Parcelles | Surface | Parc optimal | CAPEX | **CRD / ha** | Utilisation moyenne |
|---:|---:|---|---:|---:|---:|
| 1 | 14 ha | T1 + T1 | 8 000 | 571 | 63 % |
| **2** | 28 ha | T2 + T2 | 19 100 | **682** | 57 % ← *palier douloureux* |
| **3** | 42 ha | T2 + T2 | 19 100 | **455** | 85 % ← *optimum local* |
| 4 | 56 ha | T2 + T2 + set T1 | 27 100 | 484 | 78 % |
| 6 | 84 ha | T3 + T3 | 40 000 | 476 | 65 % |
| **8** | 112 ha | T3 + T3 | 40 000 | **357** | 87 % ← *optimum* |
| 10 | 140 ha | T3 + T3 + tracteur T2 | 47 600 | 340 | 92 % |

**Enseignement actionnable pour le joueur :** l'échelle machine s'améliore, mais **par paliers, pas continûment**. Passer de 1 à 2 parcelles *dégrade* le coût par hectare de 571 à 682 CRD/ha : il faut sur-investir en matériel avant de pouvoir l'amortir. Ce sont les passages 2 → 3 et 6 → 8 qui paient. Le jeu doit afficher cette courbe dans le panneau d'expansion (« votre parc est utilisé à 57 % — une 3ᵉ parcelle le saturerait sans un CRD de matériel supplémentaire »). C'est une information stratégique offerte, pas un piège caché.

Corollaire important : les économies d'échelle machine sont **monotones à long terme** (340 CRD/ha à 10 parcelles). Ce n'est donc **pas** ce mécanisme qui freine l'accumulation — ce sont la taxe progressive, la charge de gestion et les rendements décroissants (§5.2). Les deux familles de mécanismes ne doivent pas être confondues lors de la calibration.

### 3.5 Contrats ETA régionaux

Le volume de contrats d'une région croît avec sa population de joueurs. La **présence foncière** conditionne l'accès.

| Présence dans la région | Multiplicateur de récompense | Contrats accessibles | Tag |
|---|---:|---|---|
| 0 parcelle (visiteur) | **×0,85** | T1 uniquement, file d'attente | `[GD]` |
| 1 parcelle | ×1,00 | T1 + T2 | `[GD]` |
| 2–3 parcelles | ×1,05 | T1 + T2 + T3 | `[GD]` |
| ≥ 4 parcelles (implantation) | **×1,10** (cap) | Tous + **contrats de moisson régionale** (gros volume, fenêtre courte) | `[GD]` |

Volume de contrats généré par région et par cycle :
```
contrats_cycle = 2 + floor( 0,35 × joueurs_actifs_région )     cap 25/cycle     [TEST]
```
→ Une région à 40 joueurs actifs génère 16 contrats/cycle. C'est **la** raison pour un ETA d'acheter du foncier : il n'achète pas une terre à cultiver, il achète un **droit d'exercer** dans un bassin dense.

---

## 4. Courbe de progression foncière

### 4.1 Table de paliers

Hypothèses de calibration : facteur composite typique `F_typ ≈ 2,10` (parcelle correcte en région mature) → `prix ≈ 12 350 × 1,40^(n−2)` pour la n-ième parcelle. Marge nette de référence : **4 800 CRD / parcelle / saison** `[TEST]`.

| n-ième parcelle | Niveau min | Prix typique (CRD) | Taxe/saison cumulée | Prérequis non monétaire | Saisons d'épargne* |
|---:|---:|---:|---:|---|---:|
| 1 (starter) | 1 | **0** (valeur ~11 300) | 240 | Inscription | — |
| 2 | 6 | 12 350 | 538 | 1 récolte complète vendue | 2,7 |
| 3 | 10 | 17 300 | 894 | `MACHINE_SHED` construit | 1,9 |
| 4 | 14 | 24 200 | 1 306 | Fertilité moyenne ≥ 0,55 | 1,8 |
| 5 | 18 | 33 900 | 1 776 | 10 contrats ETA complétés | 1,9 |
| 6 | 23 | 47 400 | 2 304 | 1 bloc 2×2 formé | 2,1 |
| 7 | 28 | 66 400 | 2 890 | Trésorerie ≥ 2 saisons de taxe | 2,5 |
| 8 | 33 | 93 000 | 3 533 | Parc machines T3 | 3,0 |
| 9 | 39 | 130 200 | 4 234 | 2 régions distinctes | 3,7 |
| 10 | 45 | 182 300 | 4 992 | Aucune parcelle en FALLOW | 4,7 |
| 12 | 58 | 357 200 | 6 682 | 3 climats distincts | 7,6 |
| 14 | 72 | 700 200 | 8 400 (cap) | Audit anti-monopole passé | 12,8 |
| 16 (**cap**) | 85 | 1 372 300 | 9 600 (cap) | — | 21,8 |

\* *Saisons d'épargne* = prix / (marge nette du patrimoine **déjà détenu** − taxe cumulée), avant application des rendements décroissants. La colonne montre l'effort **relatif** : plancher à 1,8–1,9 entre la 3ᵉ et la 5ᵉ parcelle (l'échelle compense l'escalade), puis croissance continue à partir de la 6ᵉ, et mur assumé au-delà de la 12ᵉ. C'est exactement la forme voulue : *expansion fluide en milieu de jeu, mur progressif en fin de jeu*.

### 4.2 Rythme cible

| Profil joueur | Temps de jeu | Parcelles à 30 jours | Parcelles à 90 jours | Tag |
|---|---|---:|---:|---|
| Occasionnel (20 min/jour) | Faible | 1–2 | 3 | `[TEST]` |
| Régulier (1 h/jour) | Moyen | 3 | 5–6 | `[TEST]` |
| Intensif (3 h/jour) | Élevé | 4–5 | 8–9 | `[TEST]` |
| Coopérative organisée | — | 6 (mutualisé) | 12 | `[TEST]` |

Écart intensif/occasionnel visé : **≤ 3×** en nombre de parcelles à 90 jours. Au-delà, le contenu de fin de partie doit être qualitatif (R&D, qualité, contrats prestigieux), pas surfacique.

---

## 5. Anti-monopole et anti-pay-to-win

### 5.1 Plafonds durs

| Plafond | Valeur | Portée | Tag |
|---|---:|---|---|
| `MAX_PARCELS_PER_PLAYER` | **16** | Global, aucune exception | `[GD]` |
| `MAX_PARCELS_PER_REGION` | **6** | Par joueur | `[GD]` |
| `MAX_REGION_SHARE_PLAYER` | **40 %** | Un joueur ne peut détenir plus de 40 % des parcelles d'une région | `[GD]` |
| `MAX_REGION_SHARE_COOP` | **60 %** | Une coopérative (V1) | `[GD]` |
| `MAX_CONTINENT_SHARE_COOP` | **25 %** | Une coopérative | `[GD]` |
| Délai de revente après achat | **10 cycles** | Anti-flip | `[GD]` |
| Achats par cycle | **2** max | Anti-raid d'ouverture de région | `[GD]` |

### 5.2 Freins économiques progressifs

Effets mesurés pour un joueur détenant déjà **10 parcelles** (donc au moment d'acheter la 11ᵉ).

| Frein | Formule | Effet à n = 10 |
|---|---|---|
| Escalade de prix | `1,40^(n−1)` sur la parcelle suivante | ×20,7 sur le prix de base |
| Taxe progressive | `1 + 0,12·(n−1)`, cap ×2,5 | ×2,08, soit ~4 992 CRD/saison |
| Rendements décroissants | voir table ci-dessous | −6 % sur les parcelles de rang 9–10 |
| Charge de gestion | `overhead = 180 × n^1,25` CRD/cycle | 3 201 CRD/cycle |
| Logistique | §3.1, cap ×5,0 | jusqu'à 3 000 CRD/cycle si dispersé |

**Rendements décroissants (appliqués aux parcelles marginales) `[GD]` :**

| Rang de la parcelle | Multiplicateur de rendement |
|---|---:|
| 1 – 4 | ×1,00 |
| 5 – 8 | ×0,97 |
| 9 – 12 | ×0,94 |
| 13 – 16 | ×0,90 |

Le joueur choisit **quelles** parcelles portent le malus ? Non : le malus s'applique par **ordre décroissant de `marketValue`** inversé (les moins bonnes prennent le malus), pour éviter la micro-optimisation stérile. `[GD]`

### 5.3 Ligne rouge pay-to-win

| Action | Payable en PRM ? | Justification |
|---|---|---|
| Acheter une parcelle | ❌ **Non** | Ligne rouge absolue |
| Enchérir | ❌ Non | Casserait tout le marché foncier |
| Payer la taxe foncière | ❌ Non | Le sink doit mordre |
| Payer une restauration de jachère | ❌ Non | Sinon l'inactivité s'achète |
| Débloquer un slot au-delà de 16 | ❌ Non | Plafond absolu |
| Skin de portail / nom de domaine personnalisé | ✅ Oui | Cosmétique |
| Vue carte avancée, filtres, alertes d'enchère | ✅ Oui | Confort d'information, pas d'avantage d'exécution |
| Historique de prix étendu (90 j vs 14 j) | ✅ Oui | Confort ; les données brutes restent publiques |

**Alerte d'enchère payante — nuance :** l'alerte notifie, elle ne pré-mise pas et n'accorde aucune priorité. Le mécanisme anti-snipe (+2 min) neutralise l'avantage de réactivité. `[GD]`

### 5.4 Détection d'abus

| Signal | Seuil | Action |
|---|---|---|
| Comptes multiples liés (IP + horaires + transferts) | Score > 0,8 | Gel des achats fonciers, revue manuelle |
| Transferts CRD circulaires entre 3+ comptes | > 50 000 CRD / 7 cycles | Audit |
| Rachat systématique des saisies d'un même joueur | > 3 occurrences | Blocage de l'enchère |
| Détention via prête-noms (coopérative fantôme) | Coop < 5 membres actifs détenant > 15 % région | Plafond coop ramené au plafond joueur |

---

## 6. Attribution de la parcelle de départ

### 6.1 Principe : équité par score, pas par uniformité

Toutes les parcelles starter doivent avoir une **valeur équivalente** malgré des profils différents.

```
starterScore = 100 × f_fert × K[koppen] × f_access × classFit
cible : starterScore ∈ [95 ; 105]                              [GD]
```

Le joueur choisit son **continent** (identité, fuseau horaire, communauté) et sa **classe**. Le système propose **3 parcelles** issues du `STARTER_POOL`, toutes dans la bande de score, avec des profils volontairement contrastés (« sûre » / « fertile mais isolée » / « proche du marché mais moyenne »). Le joueur choisit — l'agentivité est préservée sans inégalité.

### 6.2 `classFit` par spécialisation

| Classe | Recherche | `fertility` cible | Köppen préférés | `classFit` |
|---|---|---|---|---|
| `CEREALIER` | Rendement céréales | 0,65 – 0,78 | Cfb, Dfa, Dfb | `1,00` si Köppen ∈ liste, sinon `0,90` |
| `ELEVEUR` | Fourrage, eau, prairie | 0,52 – 0,66 | Cfb, Dfb, Cfa | idem |
| `ETA` | Densité de contrats, accès | 0,42 – 0,58 | indifférent | `1,00` si `ρ ≥ 0,25`, sinon `0,88` |

L'ETA reçoit volontairement une **terre médiocre mais bien placée** : sa parcelle est une **base logistique**, pas un champ. Cohérent avec `06_PROGRESSION.md` (« pas de ferme obligatoire »).

### 6.3 Dotation de départ équilibrée (~20 000 CRD d'actifs)

| Classe | Parcelle (valeur) | Machines offertes | Bâtiment offert | CRD liquide | **Total actifs** |
|---|---:|---|---|---:|---:|
| `CEREALIER` | 11 300 | Tracteur T1 (3 200) | — | 5 500 | **20 000** |
| `ELEVEUR` | 9 800 | Tracteur T1 (3 200) | `CATTLE_BARN` (2 800) | 4 200 | **20 000** |
| `ETA` | 7 400 | Tracteur T1 + Moissonneuse T1 (8 000) | `MACHINE_SHED` (1 500) | 3 100 | **20 000** |

*(La ligne `CRD liquide` remplace le `crd @default(12000)` actuel du schéma, qui devient une valeur dérivée de la classe.)*

### 6.4 Garanties d'équité (règles de placement)

| Garantie | Règle | Tag |
|---|---|---|
| Pas d'enclave | Une parcelle starter n'a jamais plus de **2** bords adjacents déjà possédés | `[GD]` |
| Accès marché | `d_hub ≤ 3` toujours | `[GD]` |
| Pas de désert social | `ρ ≥ 0,08` si la région compte ≥ 10 joueurs | `[GD]` |
| Voisinage amical | Option « rejoindre un ami » : parcelle starter à ≤ 2 cases d'un joueur nommé, si le pool le permet | `[PROPOSITION]` |
| Déterminisme | Tirage par `hash(userId + regionCode)` → reproductible, auditable, non rejouable (pas de reroll infini) | `[GD]` |
| Rerolls | **2** propositions de lot maximum, puis choix obligatoire parmi les 3 | `[GD]` |
| Période de grâce | 30 cycles sans taxe foncière ni saisie possible | `[GD]` |

### 6.5 Pseudo-algorithme

```
function allocateStarter(userId, continentCode, specialization):
    regions   = openRegions(continentCode).filter(r => r.starterPoolCount >= 1)
    candidats = []
    for region in regions:
        for parcel in region.starterPool:
            if adjacentOwnedBorders(parcel) > 2:  continue
            if parcel.dHub > 3:                   continue
            score = 100 * f_fert(parcel) * K[region.koppen]
                        * f_access(parcel) * classFit(parcel, specialization)
            if 95 <= score <= 105:  candidats.push({parcel, score})

    rng   = seededRng(hash(userId + continentCode))
    offre = pickDiverse(candidats, n=3, rng)   # profils contrastés, écart de score < 8
    return offre                                # expire en 15 min, verrou optimiste sur les 3
```

---

## 7. Schéma de données proposé (pseudo-Prisma)

> Migration : le modèle `Zone` actuel devient `Region` (rétro-compatible via `Region.code`), et gagne un parent `Continent`. Les champs existants de `Parcel` sont conservés.

```prisma
// ─────────────── Nouveaux enums ───────────────

enum ParcelStatus {
  FREE               // achetable
  RESERVED_STARTER   // réservée au pool débutants
  OWNED              // possédée par une ferme
  AUCTION            // en cours d'enchère
  LOCKED             // gelée (litige, audit, migration)
}

enum ActivityState {
  ACTIVE
  DORMANT      // 14 cycles
  FALLOW       // 30 cycles
  RECLAIMABLE  // 60 cycles → enchère
}

enum AcquisitionMode {
  STARTER
  DIRECT_NPC
  AUCTION
  RECLAIM
}

// ─────────────── Nouveaux modèles ───────────────

model Continent {
  id             String   @id @default(cuid())
  code           String   @unique          // "EU", "NA", "SA", "OC"
  name           String
  isOpen         Boolean  @default(true)
  /** Occupation 0–1, recalculée à chaque cycle — pilote f_scar */
  occupancyRate  Float    @default(0)
  /** Multiplicateur de rareté mis en cache : 1 + 0.9 * occupancyRate^2 */
  scarcityFactor Float    @default(1)
  /** Timestamps du générateur de régions (§2.2) */
  lastRegionOpenedAt   DateTime?
  occupancyBreachSince DateTime?
  regions        Region[]
}

model Region {
  id            String     @id @default(cuid())
  continentId   String
  continent     Continent  @relation(fields: [continentId], references: [id])
  code          String     @unique          // "FR-BEAUCE", "US-IOWA"
  name          String
  country       String
  koppen        String                       // "Cfb", "Dfa", ...
  /** K[koppen] × cropFitBonus, mis en cache */
  climateFactor Float      @default(1.0)
  riskNote      String
  mapW          Int        @default(4)
  mapH          Int        @default(3)
  /** Coordonnées du hub de marché sur la grille carte */
  hubX          Int        @default(0)
  hubY          Int        @default(0)
  /** Infrastructures NPC présentes 0–1 (route / silo / rail) */
  infraRoad     Float      @default(0.5)
  infraSilo     Float      @default(0)
  infraRail     Float      @default(0)
  /** Fonds régional alimenté par 20 % des taxes (§2.4) */
  publicFundCrd Float      @default(0)
  /** Génération : région d'origine ou vague d'expansion */
  generation    Int        @default(0)
  openedAt      DateTime   @default(now())
  parcels       Parcel[]
  contracts     NpcContract[]

  @@index([continentId, generation])
}

// ─────────────── Parcel : champs ajoutés ───────────────

model Parcel {
  id          String        @id @default(cuid())
  regionId    String                                  // ← remplace zoneId
  region      Region        @relation(fields: [regionId], references: [id])
  farmId      String?
  farm        Farm?         @relation(fields: [farmId], references: [id])
  label       String
  mapX        Int
  mapY        Int
  gridW       Int           @default(12)
  gridH       Int           @default(12)
  fertility   Float         @default(0.7)

  // ── Nouveaux champs fonciers ──
  status        ParcelStatus  @default(FREE)
  activityState ActivityState @default(ACTIVE)
  /** Valeur publique (sans f_adj / f_own) — base taxe, rachat, enchère */
  marketValue   Float         @default(5880)
  /** Valeur du cycle précédent — sert au lissage ±8 % (§1.8) */
  prevValue     Float         @default(5880)
  /** @deprecated conservé pour compat MVP — miroir de marketValue */
  landPrice     Float
  /** Indice d'accès A ∈ [0,1], recalculé si l'infra régionale change */
  accessIndex   Float         @default(0.5)
  /** Densité de voisins ρ ∈ [0,1], recalculée par cycle */
  neighborDensity Float       @default(0)
  /** Percentile de score dans la région → ≥ 0.90 ⇒ vente aux enchères */
  qualityPercentile Float     @default(0.5)

  acquiredAt      DateTime?
  acquisitionMode AcquisitionMode?
  acquiredPrice   Float?
  /** Rang d'acquisition dans le patrimoine → rendements décroissants (§5.2) */
  ownershipRank   Int           @default(1)
  /** Verrou anti-flip : pas de revente avant cette date */
  resaleLockUntil DateTime?
  lastTaxedAt     DateTime?
  taxDebtCrd      Float         @default(0)
  lastWorkedAt    DateTime?

  cells      ParcelCell[]
  buildings  Building[]
  machines   Machine[]      @relation("ParkedOn")
  auctions   LandAuction[]
  ledger     LandLedgerEntry[]

  @@unique([regionId, mapX, mapY])
  @@index([status, regionId])
  @@index([farmId, ownershipRank])
}

// ─────────────── Enchères ───────────────

model LandAuction {
  id           String    @id @default(cuid())
  parcelId     String
  parcel       Parcel    @relation(fields: [parcelId], references: [id])
  startPrice   Float                          // = marketValue
  currentBid   Float?
  currentBidderId String?
  bidCount     Int       @default(0)
  opensAt      DateTime  @default(now())
  closesAt     DateTime                       // +48 h, prolongé par anti-snipe
  settledAt    DateTime?
  /** RECLAIM (saisie) ou PREMIUM (qualité ≥ P90) */
  reason       String
  bids         LandBid[]

  @@index([closesAt, settledAt])
}

model LandBid {
  id         String      @id @default(cuid())
  auctionId  String
  auction    LandAuction @relation(fields: [auctionId], references: [id], onDelete: Cascade)
  userId     String
  amount     Float
  depositCrd Float                            // 10 % bloqué
  createdAt  DateTime    @default(now())
  refunded   Boolean     @default(false)

  @@index([auctionId, amount])
}

// ─────────────── Journal foncier (audit + MER hebdo) ───────────────

model LandLedgerEntry {
  id        String   @id @default(cuid())
  parcelId  String
  parcel    Parcel   @relation(fields: [parcelId], references: [id])
  userId    String?
  /** BUY | SELL | TAX | RESTORE | RECLAIM | GRANT | AUCTION_FEE */
  kind      String
  amountCrd Float
  /** true si les CRD sont détruits (sink) plutôt que transférés */
  isSink    Boolean  @default(true)
  meta      String?                            // JSON libre (facteurs de prix au moment T)
  createdAt DateTime @default(now())

  @@index([createdAt, kind])
}

// ─────────────── Compteurs joueur ───────────────

model Farm {
  // ... champs existants ...
  parcelCount        Int      @default(0)     // dénormalisé → f_own sans COUNT()
  distinctKoppen     Int      @default(1)     // → bonus diversification (§3.2)
  adjacencyBonus     Float    @default(0)     // cap 0.10
  vacationUntil      DateTime?                // congé déclaré (§2.3)
  vacationUsedYear   Int?
  starterParcelId    String?  @unique          // immunisée contre la saisie
}
```

**Index critiques :** `Parcel(status, regionId)` pour la carte, `Parcel(farmId, ownershipRank)` pour les rendements décroissants, `LandAuction(closesAt, settledAt)` pour le job de clôture.

**Note SQLite :** pas de type `Decimal` fiable → tous les montants restent en `Float`, avec arrondi à 2 décimales à l'écriture et arrondi à 50 CRD à l'affichage des prix.

---

## 8. Endpoints API proposés

Préfixe `/world` pour tout le domaine foncier. Auth par token de session (`26_AUTH_SESSION.md`). Les réponses sont **personnalisées** quand un token est fourni (`askPrice`, `claimable`).

### 8.1 `GET /world/continents`

Vue d'ensemble pour l'écran de choix de continent.

```json
{
  "continents": [
    {
      "code": "EU",
      "name": "Europe",
      "isOpen": true,
      "regionCount": 6,
      "parcelsTotal": 480,
      "parcelsFree": 131,
      "occupancyRate": 0.58,
      "scarcityFactor": 1.303,
      "starterAvailable": 24,
      "activePlayers": 412,
      "koppen": ["Cfb", "Csa", "Dfb"],
      "priceIndex": { "median": 14200, "p10": 7800, "p90": 31500 },
      "trend": "TENSION_MODEREE"
    },
    {
      "code": "SA",
      "name": "Amérique du Sud",
      "isOpen": true,
      "regionCount": 2,
      "parcelsTotal": 160,
      "parcelsFree": 141,
      "occupancyRate": 0.12,
      "scarcityFactor": 1.013,
      "starterAvailable": 13,
      "activePlayers": 38,
      "koppen": ["Aw", "BSk", "Cfa"],
      "priceIndex": { "median": 6100, "p10": 4300, "p90": 9800 },
      "trend": "FRONT_PIONNIER"
    }
  ],
  "cycle": { "index": 214, "endsAt": "2026-08-13T00:00:00Z" }
}
```

### 8.2 `GET /world/continents/:code/parcels`

Query : `?region=FR-BEAUCE&status=FREE&maxPrice=20000&koppen=Cfb&adjacentOnly=true&page=0&size=200`

```json
{
  "continent": { "code": "EU", "name": "Europe", "scarcityFactor": 1.303 },
  "region": {
    "code": "FR-BEAUCE", "name": "Beauce", "koppen": "Cfb",
    "climateFactor": 1.15, "mapW": 4, "mapH": 3, "hub": { "x": 1, "y": 1 },
    "infra": { "road": 1.0, "silo": 0.75, "rail": 0.0 },
    "publicFundCrd": 18400, "generation": 0,
    "occupancy": 0.61, "activePlayers": 87,
    "contractsPerCycle": 32
  },
  "viewer": { "farmId": "farm_x1", "parcelCount": 1, "canBuy": true, "budgetCrd": 21400 },
  "parcels": [
    {
      "id": "prc_b2",
      "label": "Beauce-2", "mapX": 1, "mapY": 0,
      "status": "FREE", "activityState": null,
      "fertility": 0.72, "koppen": "Cfb",
      "accessIndex": 0.85, "neighborDensity": 0.292,
      "qualityPercentile": 0.64,
      "marketValue": 11900,
      "askPrice": 13800,
      "priceBreakdown": {
        "base": 5880, "fertility": 1.132, "climate": 1.150,
        "access": 1.055, "density": 1.131, "scarcity": 1.303,
        "adjacency": 1.160, "ownership": 1.000
      },
      "adjacentOwnedBorders": 2,
      "claimable": true,
      "saleChannel": "DIRECT",
      "owner": null
    },
    {
      "id": "prc_b5",
      "label": "Beauce-5", "mapX": 2, "mapY": 1,
      "status": "OWNED", "activityState": "FALLOW",
      "fertility": 0.51, "koppen": "Cfb",
      "marketValue": 9200, "askPrice": null,
      "claimable": false, "saleChannel": null,
      "owner": { "handle": "Marceau", "farmName": "GAEC du Vent", "level": 22 },
      "fallowSince": "2026-07-30T09:00:00Z",
      "reclaimableAt": "2026-08-29T09:00:00Z"
    },
    {
      "id": "prc_b7",
      "label": "Beauce-7", "mapX": 3, "mapY": 2,
      "status": "AUCTION",
      "fertility": 0.81, "koppen": "Cfb",
      "marketValue": 19400, "askPrice": null,
      "claimable": false, "saleChannel": "AUCTION",
      "auction": {
        "id": "auc_44", "currentBid": 21800, "bidCount": 7,
        "closesAt": "2026-08-14T18:30:00Z", "reason": "PREMIUM",
        "minNextBid": 22240
      },
      "owner": null
    },
    {
      "id": "prc_b9",
      "label": "Beauce-9", "mapX": 0, "mapY": 2,
      "status": "RESERVED_STARTER",
      "fertility": 0.70, "marketValue": 11300,
      "askPrice": null, "claimable": false, "owner": null
    }
  ],
  "page": { "index": 0, "size": 200, "total": 12 }
}
```

### 8.3 `GET /world/parcels/:id/quote`

Devis détaillé avant achat — **la source de vérité du prix** ; le `quoteToken` verrouille le prix 5 minutes.

```json
{
  "parcelId": "prc_b2",
  "askPrice": 13800,
  "quoteToken": "qt_9f3a...",
  "expiresAt": "2026-08-12T08:05:00Z",
  "breakdown": { "base": 5880, "fertility": 1.132, "climate": 1.150,
                 "access": 1.055, "density": 1.131, "scarcity": 1.303,
                 "adjacency": 1.160, "ownership": 1.000 },
  "recurring": {
    "taxPerSeasonCrd": 214,
    "logisticsPerCycleCrd": 53,
    "overheadDeltaPerCycleCrd": 248
  },
  "projected": {
    "netMarginPerSeasonCrd": 4560,
    "paybackSeasons": 3.0,
    "machineUtilizationAfter": 0.57,
    "machineUpgradeAdvised": "TRACTOR_T2",
    "adjacencyBonusAfter": 0.03,
    "distinctKoppenAfter": 1
  },
  "eligibility": {
    "ok": true,
    "checks": [
      { "rule": "LEVEL_MIN", "required": 6, "actual": 9, "ok": true },
      { "rule": "MAX_PARCELS_PER_PLAYER", "limit": 16, "actual": 1, "ok": true },
      { "rule": "MAX_PARCELS_PER_REGION", "limit": 6, "actual": 1, "ok": true },
      { "rule": "MAX_REGION_SHARE_PLAYER", "limit": 0.40, "actual": 0.083, "ok": true },
      { "rule": "PURCHASES_PER_CYCLE", "limit": 2, "actual": 0, "ok": true },
      { "rule": "FUNDS", "required": 13800, "actual": 21400, "ok": true }
    ]
  }
}
```

### 8.4 `POST /world/claim`

Endpoint unique d'acquisition : starter gratuit **et** achat payant, distingués par `mode`.

Requête (starter, à l'inscription) :
```json
{ "mode": "STARTER", "continentCode": "EU", "parcelId": "prc_b9", "offerToken": "off_7c2..." }
```

Requête (achat) :
```json
{ "mode": "DIRECT", "parcelId": "prc_b2", "quoteToken": "qt_9f3a...", "acceptedPrice": 13800 }
```

Réponse `201` :
```json
{
  "ok": true,
  "parcel": { "id": "prc_b2", "label": "Beauce-2", "status": "OWNED",
              "ownershipRank": 2, "acquiredPrice": 13800,
              "resaleLockUntil": "2026-08-22T08:00:00Z" },
  "farm": { "parcelCount": 2, "distinctKoppen": 1, "adjacencyBonus": 0.03,
            "taxPerSeasonCrd": 538 },
  "wallet": { "crdBefore": 21400, "crdAfter": 7600 },
  "unlocked": [
    { "type": "MEGA_GRID_PROGRESS", "detail": "2/4 parcelles pour le bloc Domaine" },
    { "type": "ETA_TIER", "detail": "Contrats T3 débloqués en Beauce" }
  ],
  "ledgerEntryId": "led_3311"
}
```

Codes d'erreur :

| HTTP | `code` | Cas |
|---|---|---|
| 400 | `QUOTE_EXPIRED` | Devis > 5 min |
| 402 | `INSUFFICIENT_FUNDS` | CRD < prix |
| 403 | `LEVEL_TOO_LOW` | Palier §4.1 non atteint |
| 403 | `CAP_EXCEEDED` | Plafond §5.1 (détail dans `rule`) |
| 403 | `PREREQUISITE_MISSING` | Prérequis non monétaire §4.1 |
| 409 | `PARCEL_UNAVAILABLE` | Achetée entre-temps (verrou optimiste) |
| 409 | `AUCTION_ONLY` | Parcelle en canal enchère |
| 409 | `PRICE_CHANGED` | `acceptedPrice ≠ askPrice` recalculé |
| 429 | `PURCHASE_RATE_LIMIT` | > 2 achats / cycle |

### 8.5 `GET /world/starter-offers`

Appelé pendant l'onboarding, après choix continent + classe.

```json
{
  "offerToken": "off_7c2...",
  "expiresAt": "2026-08-12T08:15:00Z",
  "rerollsLeft": 1,
  "specialization": "CEREALIER",
  "grant": { "crd": 5500, "machines": ["TRACTOR"], "buildings": [] },
  "offers": [
    { "parcelId": "prc_b9", "region": "FR-BEAUCE", "label": "Beauce-9",
      "fertility": 0.70, "koppen": "Cfb", "dHub": 2, "neighborDensity": 0.21,
      "starterScore": 101.2, "marketValue": 11300,
      "pitch": "Équilibrée — bon sol, marché proche, voisinage actif" },
    { "parcelId": "prc_i4", "region": "FR-BRIE", "label": "Brie-4",
      "fertility": 0.78, "koppen": "Cfb", "dHub": 3, "neighborDensity": 0.08,
      "starterScore": 103.6, "marketValue": 11800,
      "pitch": "Très fertile mais isolée — rendement max, logistique plus chère" },
    { "parcelId": "prc_p2", "region": "FR-BEAUCE", "label": "Beauce-2b",
      "fertility": 0.63, "koppen": "Cfb", "dHub": 0, "neighborDensity": 0.33,
      "starterScore": 97.8, "marketValue": 10900,
      "pitch": "Adossée au hub — sol moyen, contrats ETA abondants" }
  ]
}
```

### 8.6 Endpoints complémentaires

| Méthode | Route | Rôle | Réponse clé |
|---|---|---|---|
| `GET` | `/world/regions/:code` | Fiche région complète (climat, infra, fonds public, cultures autorisées) | `{ region, allowedCrops[], contractsPerCycle }` |
| `GET` | `/world/auctions` | Enchères en cours, filtrables par continent/région | `{ auctions: [{ id, parcel, currentBid, minNextBid, closesAt }] }` |
| `POST` | `/world/auctions/:id/bid` | Miser (`{ amount }`) | `{ ok, currentBid, minNextBid, closesAt, depositHeld }` |
| `DELETE` | `/world/auctions/:id/bid` | Retirer une mise non gagnante (dépôt rendu si non leader) | `{ ok, refunded }` |
| `GET` | `/world/me/land` | Portefeuille foncier : parcelles, rangs, taxes, malus, bonus | `{ parcels[], totals: { value, taxPerSeason, logistics, adjacencyBonus, distinctKoppen } }` |
| `POST` | `/world/parcels/:id/release` | Revente au NPC à 65 % de `marketValue` (bloquée pendant `resaleLockUntil`, interdite sur la starter) | `{ ok, refundCrd, newParcelCount }` |
| `POST` | `/world/parcels/:id/restore` | Payer une passe de restauration de jachère | `{ ok, fertility, costCrd, passesRemaining }` |
| `POST` | `/world/vacation` | Déclarer un congé (60 cycles, 1×/an) | `{ ok, vacationUntil, taxDiscount: 0.5 }` |
| `GET` | `/world/land-index` | Indice foncier public (médiane, P10/P90 par continent, 14 derniers cycles) — alimente le MER hebdo | `{ series: [{ cycle, continent, median, p10, p90, volume }] }` |
| `POST` | `/world/admin/open-region` | (Admin/CRON) Force l'ouverture d'une région | `{ region, parcelsCreated }` |

### 8.7 Jobs planifiés

| Job | Fréquence | Action |
|---|---|---|
| `revalueLand` | 1 / cycle (24 h) | Recalcule `marketValue`, `neighborDensity`, `accessIndex`, `occupancyRate`, applique le lissage ±8 % |
| `levyLandTax` | 1 / cycle | Prélève `taxe_saison / 7`, crée les `LandLedgerEntry`, gère la dette |
| `advanceActivityStates` | 1 / cycle | ACTIVE → DORMANT → FALLOW → RECLAIMABLE, dégrade la fertilité en jachère |
| `settleAuctions` | 1 / 5 min | Clôture les enchères échues, transfère, détruit la commission, rembourse les dépôts |
| `regionGenerator` | 1 / cycle | Vérifie le seuil `O ≥ 0,80` sur 7 cycles, planifie l'ouverture |
| `refillStarterPool` | 1 / cycle | Rétablit les 8 %, alerte si < 3 parcelles dans une région |

---

## 9. Calibration et télémétrie

Métriques à publier dans le rapport économique hebdomadaire (cf. MER, `04_ECONOMY_DESIGN.md` §3).

| Métrique | Cible | Action si hors cible |
|---|---|---|
| Occupation par continent | 65–75 % | > 80 % → ouvrir région ; < 50 % → suspendre les ouvertures |
| Taux de parcelles FALLOW | < 8 % | > 12 % → durcir la taxe DORMANT ou raccourcir les délais |
| Gini du foncier (parcelles/joueur) | < 0,45 | > 0,55 → renforcer l'escalade `f_own` ou baisser le cap |
| Part des taxes dans les sinks totaux | 12–20 % | Ajuster le taux 1,6 % |
| Délai médian d'accès à la 2ᵉ parcelle | 12–20 cycles | Ajuster `LAND_BASE_PER_HA` |
| Ratio prix P90/P10 intra-continent | 3–5× | > 6× → écraser `f_dens` / `f_scar` |
| Enchères sans mise | < 15 % | > 25 % → baisser le seuil P90 du canal enchère |
| Rétention J7 des joueurs starter | > 35 % | Revoir la qualité du `STARTER_POOL` |

**Ordre de calibration recommandé :** `LAND_BASE_PER_HA` → `f_own` (base 1,40) → taux de taxe → seuils d'inactivité → générateur de régions. Ne jamais bouger deux curseurs dans la même semaine de test.

---

## 10. Risques identifiés et parades

| Risque | Probabilité | Impact | Parade |
|---|---|---|---|
| Monde vide sur un continent secondaire → prix cassés, joueurs isolés | Élevée | Moyen | N'ouvrir que 2 continents au lancement ; le 3ᵉ à 500 joueurs actifs `[GD]` |
| Guerre d'enchères entre coopératives → inflation foncière | Moyenne | Élevé | Plafond de mise `8 × marketValue` + plafonds de part régionale |
| Joueurs qui « squattent » sans jouer pour bloquer une région | Moyenne | Moyen | Échelle d'inactivité + taxe progressive : squatter coûte cher |
| Escalade `1,40^n` perçue comme punitive | Élevée | Moyen | Transparence totale : `priceBreakdown` affiché, jamais de coût caché |
| Complexité perçue à l'onboarding | Élevée | Élevé | Le nouveau joueur ne voit **que** 3 offres starter ; tout le modèle est masqué jusqu'au niveau 6 |
| Le bloc 2×2 devient l'unique stratégie viable | Moyenne | Moyen | Surcote `f_adj` + bénéfices concurrents de la diversification (§3.2/3.3) |
| Dérive inflationniste des prix (spirale `f_dens`/`f_scar`) | Moyenne | Élevé | Lissage ±8 %/cycle + clamp absolu `[0,45 ; 6,0] × P_ref` |

---

## 11. Ordre d'implémentation suggéré

| Étape | Contenu | Dépendances |
|---|---|---|
| 1 | `Continent` + `Region` (migration depuis `Zone`), champs `Parcel` étendus | Aucune |
| 2 | Moteur de prix (§1) + `GET /world/continents`, `/parcels`, `/quote` | Étape 1 |
| 3 | `POST /world/claim` (DIRECT), plafonds, journal `LandLedgerEntry` | Étape 2 |
| 4 | `STARTER_POOL` + `GET /world/starter-offers` + refonte de l'inscription | Étape 3 |
| 5 | Job `revalueLand` + `levyLandTax` + `GET /world/me/land` | Étape 3 |
| 6 | Bonus d'adjacence, logistique, rendements décroissants | Étape 5 |
| 7 | Échelle d'inactivité + jachère + restauration | Étape 5 |
| 8 | Enchères (modèles, endpoints, job de clôture) | Étape 7 |
| 9 | Générateur de régions + `GET /world/land-index` + MER foncier | Étape 8 |

Les étapes 1–4 constituent le **socle jouable** (achat gratuit + achat direct chiffré). Les étapes 5–7 rendent le système **vivant**. Les étapes 8–9 le rendent **persistant à l'échelle d'un monde**.

---

## 12. Questions ouvertes

| # | Question | Impact | Tag |
|---|---|---|---|
| 1 | Location / fermage (bail 20 cycles à 12 % de la valeur/saison) comme alternative à l'achat pour les petits joueurs ? | Fort sur l'accessibilité | `[PROPOSITION]` |
| 2 | Marché foncier P2P direct (joueur → joueur) ou uniquement via enchères NPC ? | Fort sur le risque d'abus | `[À VALIDER]` |
| 3 | Les coopératives (V1) mutualisent-elles le patrimoine ou seulement l'exploitation ? | Fort sur l'anti-monopole | `[À VALIDER]` |
| 4 | Reset saisonnier optionnel (serveur « saison » 90 jours) avec foncier remis à zéro ? | Fort sur la rétention long terme | `[PROPOSITION]` |
| 5 | Faut-il un cap de valeur totale du patrimoine plutôt qu'un cap en nombre de parcelles ? | Moyen — plus élégant, moins lisible | `[HYPOTHÈSE]` |
| 6 | Les infrastructures régionales sont-elles finançables par les joueurs (souscription au fonds régional) ? | Moyen — excellent sink coopératif | `[PROPOSITION]` |

---

## 13. Synthèse des décisions

1. **Prix = 6 facteurs bornés × escalade patrimoniale**, base 420 CRD/ha, soit 5 880 CRD pour une parcelle 14 ha neutre ; le facteur `1,40^(n−1)` porte l'essentiel du frein anti-monopole.
2. **Deux prix distincts** : `marketValue` publique (taxe, enchère, affichage) et `askPrice` personnalisée (inclut adjacence et patrimoine) — la transparence du `priceBreakdown` est obligatoire.
3. **La parcelle de départ est gratuite, garantie et inaliénable**, financée par une réserve de 8 % inaccessible aux joueurs établis : la rareté ne s'applique jamais à l'entrée.
4. **Le monde reste plein par quatre leviers simultanés** : taxe progressive, échelle d'inactivité jusqu'à la saisie, enchères sur les parcelles premium et saisies, et générateur de régions déclenché à 80 % d'occupation.
5. **Les nouvelles régions sont toujours moins bonnes et plus loin** — elles soulagent la pression sans dévaluer le patrimoine existant.
6. **L'expansion se justifie par cinq bénéfices chiffrés** : adjacence (bloc 2×2 → méga-grille), diversification climatique (−29 % de volatilité à 4 climats), cultures verrouillées par Köppen, saturation du parc machines (paliers à 3 et 8 parcelles), et accès aux contrats ETA régionaux.
7. **La courbe de progression est plate en milieu de jeu et devient un mur en fin de jeu** : 2,6 saisons d'épargne pour la 2ᵉ parcelle, 2,8 pour la 8ᵉ, 19,9 pour la 16ᵉ (cap absolu).
8. **Anti-monopole = plafonds durs (16 / 6 par région / 40 % d'une région) + escalade de prix + taxe progressive + rendements décroissants + charge de gestion en `n^1,25`.**
9. **Ligne rouge P2W** : aucune parcelle, enchère, taxe ou restauration ne se paie en PRM ; le premium se limite au cosmétique et au confort d'information.
10. **Socle jouable en 4 étapes** (modèles → moteur de prix → `POST /world/claim` → pool starter) ; le reste (taxe, jachère, enchères, générateur) s'empile sans casser l'existant.

---

*Doc conception économie foncière — FARMSIM · aucune valeur n'est définitive avant simulation (`15_ECONOMIC_SIMULATION.md`).*
