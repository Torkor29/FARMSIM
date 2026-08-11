# 02 — Farming Simulator Analysis

**Périmètre :** Farming Simulator 22 / 25 (mécaniques principales)  
**Sources principales :** Manuel officiel FS25 (wiki.gg), guides communautaires, site Giants  
**Règle :** ne jamais présenter une invention projet comme mécanique FS.

---

## 1. Positionnement de FS

Farming Simulator (GIANTS Software) est une **simulation agricole 3D** centrée sur :
- la conduite et l’usage de **machines licenciées** ;
- la gestion de **champs** et d’une **ferme** ;
- une économie **locale à la map** (points de vente NPC, prix saisonniers) ;
- du solo / coop / serveurs dédiés — **pas** un MMO économie mondiale.

**[FAIT]** Franchise > 40 M d’exemplaires ; FS25 ≈ 4 M en ~1 an (annonces Giants 2025).

Ce qui plaît :
- fantasy « vrai métier » ;
- catalogue machines ;
- boucle concrète champ → récolte → vente ;
- progression matérielle tangible ;
- mods / maps (rétention massive).

Ce qui est lourd pour un navigateur :
- physique véhicule 1:1 ;
- milliers d’assets 3D marqués ;
- maps locales détaillées ;
- dépendance licences constructeurs.

---

## 2. Agriculture (mécaniques FS)

### 2.1 Préparation du sol `[FS]`
- Labour (plow) quand le champ « needs plowing » → bonus rendement (~15 %). Sous-soleuse alternative (ne bloque pas adventices).
- Cultivateur / déchaumeur pour lit de semence (sauf semoir direct).
- Chaume : mulching avant culture suivante (~2,5–5 % selon guides).
- Rouleau après semis (~2,5–5 %).
- Chaux (lime) tous les ~3 cycles → ~15 % si besoin signalé.
- Pierres : endommagent le matériel (pas le rendement).

### 2.2 Semis `[FS]`
- Semoirs / planteuses selon culture ; certains fertilisent / travaillent en même temps.
- Semoirs directs sans cultivateur préalable.
- Calendrier saisonnier optionnel (planting windows) ; hors fenêtre → flétrissement.
- ~25 cultures principales en FS25 (céréales, oléagineux, racines, riz, etc.).

### 2.3 Fertilisation `[FS]`
- Jusqu’à **2 applications** par cycle ; ~**+23 %** chacune selon guides Gamepressure (ordre de grandeur ; guides varient).
- Types : engrais minéral solide/liquide, fumier, lisier, digestat, engrais vert (radis oléagineux).
- Fumier/lisier : double rate possible en un passage.
- Precision Farming (DLC) : cartographie N/pH, score environnemental (± jusqu’à ~15 %).

### 2.4 Désherbage `[FS]`
- Adventices ~**−20 %** rendement.
- Herse / bineuse / pulvérisateur herbicide ; labour profond réduit l’apparition.

### 2.5 Croissance & saisons `[FS]`
- Stades visibles + calendrier (ex. blé semis sept–oct, récolte juil–août).
- Année par défaut très compressée (souvent ~12 jours = 12 mois).
- Pluie/neige : **récolte pénalisée** ; option seasonal growth on/off.

### 2.6 Récolte, rendement, qualité `[FS]`
- Rendement = checklist d’actions (ferti, lime, weeds, plow, roll, mulch…) — **pas** de qualité grain fine (protéines/humidité) en vanilla.
- Precision Farming ajoute profondeur sol optionnelle.
- FS25 : déformation sol / ornières ; rizières avec gestion d’eau.

### 2.7 Rotation / maladies / ravageurs `[FS]`
- **Vanilla : pas de maladies/ravageurs ni rotation pathogène** — domaine des mods.
- Besoin de labour après certaines cultures = proxy structure sol.

**À reprendre :** boucle sol → fertilisation → adventices → calendrier → rendement empilable.  
**À ne pas copier 1:1 :** Precision Farming complet, déformation 3D, maladies mods, catalogue culture-spécifique dès MVP.

---

## 3. Machines `[FS]`

Attributs typiques :
- prix d’achat élevé ;
- puissance (kW/hp) et compatibilité outils ;
- largeur de travail ;
- vitesse de travail ;
- capacité trémie / cuve ;
- carburant / AdBlue ;
- état / maintenance (condition) ;
- heures d’utilisation.

Catégories : tracteurs, moissonneuses, semoirs, pulvérisateurs, épandeurs, remorques, chargeurs, outils sol, équipements animaux, chaînes de production.

**Leçon :** le matériel est la **vraie progression** — pas un niveau RPG.  
**Pour navigateur :** abstraire en stats (puissance, largeur, conso, usure, coût) + skin stylisé, **sans** catalogue licencié au MVP.

---

## 4. Économie `[FS]`

- Prix NPC par point de vente, fluctuation saisonnière / demande locale.
- Stocker pour vendre au pic ; saturer un produit tire le prix vers le bas.
- Contrats de travaux (missions) pour cashflow early ; matériel emprunté possible (déduit de la paye).
- Crédit / prêt (guides : tranches, plafond, intérêts journaliers punitifs — **ne pas** reproduire 0,8 %/jour en navigateur).
- Location machines : ~5 % à l’entrée + ~1 %/mois (guides Gamepressure).
- Productions (moulins, etc.) : transformation valeur ajoutée (FS22+).
- **Pas** de marché mondial multi-joueurs persistant type MMO.

**À reprendre :** contrats débutant, location, transformation (plus tard), stockage stratégique.  
**À inventer :** marché mondial, stocks globaux, chocs climatiques macro.

---

## 5. Travail `[FS]`

- Joueur conduit presque tout.
- **AI workers** : Go to / Field Work / Deliver / Load & Deliver ; rachat auto carburant/semences (coûteux).
- Contrats NPC : labourer/semer/récolter ; plusieurs en parallèle.
- Multi coop : partager ferme / travaux.
- Employés nommés / RH : **pas en vanilla** (mods).

**Gap vs notre vision :** pas de **marché de prestations P2P** structuré.  
**Navigateur :** abstraire helpers en timers + coûts ; pas de pathfinding 3D.

---

## 6. Animaux `[FS]`

Espèces : vaches, cochons, moutons, chevaux, poules, abeilles (+ buffles FS25).  
Alimentation vaches (guides stables) : herbe **40 %** · foin **80 %** · **TMR 100 %**.  
Outputs : lait, œufs, laine, miel, fumier, lisier, vente animaux.  
Santé/propreté abstraites ; pas de génétique / épidémies fines.  
Rentabilité souvent discutée (setup lourd, ROI long).

**À reprendre :** lien aliment ↔ production ↔ effluents ; 2 qualités d’alimentation.  
**À simplifier :** pas de TMR multi-étapes ni transport animaux 3D au MVP.

---

## 7. Progression `[FS]`

Modes : New Farmer / Farm Manager / Start from Scratch.  
Progression = argent → terres → machines → productions → optimisation.  
Peu de « niveaux RPG » ; skill implicite du joueur.

**Aligné avec notre philosophie :** machines & décisions > XP.

---

## 8. Tableau de décision projet

| Mécanique FS | Présente en FS ? | Adapter ? | Inventer chez nous ? |
|--------------|------------------|-----------|----------------------|
| Labour / cultivate | Oui | Oui (simplifié) | — |
| Fertilisation multi-types | Oui | Oui | Qualité sol persistante régionale |
| Adventices | Oui | Oui léger | Maladies/ravageurs régionaux |
| Saisons calendrier | Oui | Oui lié latitude | Hémisphères / tropiques |
| Météo locale | Oui | Oui | Météo **régionale mondiale** + chocs marché |
| Qualité grain fine | Limitée | Étendre | Grades qualité marché |
| Catalogue licences | Oui | Non MVP | Skins génériques / partenariats tardifs |
| AI workers | Oui | Plus tard | Prestations **joueurs** d’abord |
| Marché mondial | Non | — | **Cœur différenciant** |
| Carte Terre | Non | — | **Cœur différenciant** |
| Spécialisations +% | Non (hors career) | — | Oui, faibles |
| R&D semences | Non / mods | — | Oui |
| Politique locale | Non | — | Post-MVP |
| OGM régulation | Non | — | Post-MVP |

---

## 9. Ce qu’il ne faut surtout pas reproduire

1. **Conduite véhicule comme gameplay principal** — trop cher, trop FS, mauvais fit navigateur casual.
2. **Parité catalogue machines** — guerre perdue vs Giants + marques.
3. **Maps locales photoréalistes** — mauvais différenciateur.
4. **Économie trop « solo confort »** sans sinks MMO — explosion monétaire en persistant.
5. **Complexité Precision Farming dès le jour 1**.

---

## 10. Ce que FS fait bien (à respecter en esprit)

- Feedback clair « j’ai amélioré mon champ ».
- Progression matérielle visible.
- Multiple ways to play (détente vs optimisation).
- Contrats pour bootstrap.
- Lien animals ↔ crops (effluents / aliments).

---

## Sources

- https://farmingsimulator.wiki.gg/wiki/Farming_Simulator_25/Manual
- https://simulatorguides.com/fs25-soil-management-and-yield-guide/
- https://www.gamepressure.com/farming-simulator-25/fertilizing/z5116d9
- https://gamerant.com/farming-simulator-25-how-maximize-increase-crop-yields/
- https://www.thegamer.com/farming-simulator-25-seasonal-farming-every-crop-month/
- Annonces Giants Software (ventes FS25 / franchise)
