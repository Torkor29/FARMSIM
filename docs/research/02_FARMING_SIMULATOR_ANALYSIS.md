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
- Labour (plow) quand le champ « needs plowing » → bonus rendement (~15 %).
- Cultivateur / déchaumeur pour préparation plus légère.
- Chaume : mulching avant culture suivante (~2,5 %).
- Rouleau après semis (~2,5 %).
- Chaux (lime) tous les ~3 cycles → ~15 % si besoin signalé.

### 2.2 Semis `[FS]`
- Semoirs / planteuses selon culture.
- Calendrier saisonnier optionnel (planting windows).
- ~25 cultures principales en FS25 (céréales, oléagineux, racines, riz, etc.).

### 2.3 Fertilisation `[FS]`
- Jusqu’à **2 applications** par cycle pour bonus max (~45 % cumulé selon guides ; chiffres guides varient légèrement — traiter comme ordre de grandeur).
- Types : engrais minéral solide/liquide, fumier, lisier, digestat, engrais vert (radis oléagineux).
- Fumier/lisier : double rate possible en un passage.
- Precision Farming (DLC/feature) : cartographie azote, optimisation.

### 2.4 Désherbage `[FS]`
- Adventices réduisent le rendement (~20 % si non traités).
- Herse / bineuse / pulvérisateur herbicide.
- Herse parfois préférable (moins de pénalité que certains herbicides selon guides).

### 2.5 Croissance & saisons `[FS]`
- Stades de croissance visibles.
- Saisons affectent fenêtres semis/récolte et ambiance.
- Option désactiver seasonal growth.
- Pluie/neige : **récolte interdite ou pénalisée** (guides : jusqu’à ~50 % perte si récolte sous pluie).

### 2.6 Récolte, rendement, qualité `[FS]`
- Moissonneuses + outils culture-spécifiques.
- Rendement = base culture × bonus (ferti, lime, weeds, plow, roll, mulch…).
- Qualité : présente surtout via animals / productions ; champs plutôt « yield-centric ».
- Grêle / tornades (événements) : dégâts champs / balles non stockées.

### 2.7 Rotation / maladies / ravageurs `[FS]`
- **Rotation profonde, maladies cryptogamiques, insectes complexes : très simplifiés ou absents** vs réalité.
- Besoin de labour après certaines cultures (maïs, pomme de terre, etc.) = proxy de structure sol.
- Pas de modèle épidémiologique riche type jeu « Plant Pathology ».

**À reprendre :** boucle sol → fertilisation → adventices → calendrier → rendement.  
**À ne pas copier 1:1 :** liste exhaustive d’outils, précision centimetrique, DLC Precision Farming complet.

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
- Contrats de travaux (missions) pour gagner de l’argent tôt.
- Crédit / prêt selon mode.
- Location de machines possible.
- Productions (moulins, filatures, etc.) : transformation valeur ajoutée (FS22+).
- **Pas** de marché mondial multi-joueurs persistant type MMO.
- **Pas** de vraie spéculation multi-agents à l’échelle planète.

**À reprendre :** contrats débutant, location, transformation (plus tard), stockage stratégique.  
**À inventer :** marché mondial, stocks globaux, chocs climatiques macro.

---

## 5. Travail `[FS]`

- Joueur conduit presque tout.
- **AI workers** : employés automatiques (coût, limitations, améliorations helpers).
- Contrats : labourer/semer/récolter pour NPC.
- Multi coop : partager ferme / travaux.

**Gap vs notre vision :** pas de **marché de prestations P2P** structuré (offres/demandes tarifées entre joueurs inconnus à l’échelle MMO).

---

## 6. Animaux `[FS]`

Espèces : vaches, cochons, moutons, chevaux, poules, etc.  
Mécaniques : bâtiments, nourriture (types), paille/litière, eau, propreté, reproduction, produits (lait, œufs, lisier, fumier, laine…).  
Santé/propreté impactent productivité.  
Rentabilité souvent discutée communautairment (setup lourd, ROI long).

**À reprendre :** lien aliment ↔ production ↔ effluents.  
**À simplifier :** pas de micro-gestion FS complète au MVP.

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
