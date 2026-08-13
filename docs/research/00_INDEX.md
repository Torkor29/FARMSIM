# Farming Navigateur — Documentation de recherche & conception

**Statut :** Phase recherche / conception (aucun code jeu)  
**Branche :** `cursor/farming-navigateur-research-6eea`  
**Date :** 2026-08-11  
**Nom de travail :** Farming Navigateur (FARMSIM)

---

## Légende des classifications

Chaque valeur chiffrée dans cette documentation est classée :

| Tag | Signification |
|-----|---------------|
| `[RÉEL]` | Donnée agricole, économique ou climatique issue de sources publiques |
| `[FS]` | Mécanique ou valeur observée dans Farming Simulator |
| `[HYPOTHÈSE]` | Hypothèse de recherche non encore validée |
| `[GD]` | Valeur de game design (choix volontaire) |
| `[TEST]` | Valeur provisoire à calibrer par simulation |
| `[FAIT]` | Fait vérifiable (technique, juridique, marché) |
| `[PROPOSITION]` | Proposition de design du projet |
| `[À VALIDER JURIDIQUE]` | Nécessite revue avocat / compliance |

---

## Livrables

| # | Fichier | Contenu |
|---|---------|---------|
| 01 | [01_GAME_DESIGN_DOCUMENT.md](./01_GAME_DESIGN_DOCUMENT.md) | Vision complète du jeu |
| 02 | [02_FARMING_SIMULATOR_ANALYSIS.md](./02_FARMING_SIMULATOR_ANALYSIS.md) | Analyse FS (FS22/FS25) |
| 03 | [03_AGRICULTURE_REALISM.md](./03_AGRICULTURE_REALISM.md) | Agriculture réelle simplifiée |
| 04 | [04_ECONOMY_DESIGN.md](./04_ECONOMY_DESIGN.md) | Modèle économique complet |
| 05 | [05_MARKET_DESIGN.md](./05_MARKET_DESIGN.md) | Marché mondial |
| 06 | [06_PROGRESSION.md](./06_PROGRESSION.md) | Niveaux, spécialisations, machines, R&D |
| 07 | [07_ANIMAL_SYSTEM.md](./07_ANIMAL_SYSTEM.md) | Élevage et alimentation |
| 08 | [08_WEATHER_CLIMATE.md](./08_WEATHER_CLIMATE.md) | Météo, climat, événements |
| 09 | [09_WORLD_MAP.md](./09_WORLD_MAP.md) | Carte et parcelles |
| 10 | [10_MULTIPLAYER.md](./10_MULTIPLAYER.md) | Interactions joueurs |
| 11 | [11_MONETIZATION.md](./11_MONETIZATION.md) | Monétisation & premium |
| 12 | [12_LEGAL_REGULATORY.md](./12_LEGAL_REGULATORY.md) | Argent réel / monnaies virtuelles |
| 13 | [13_TECHNICAL_ARCHITECTURE.md](./13_TECHNICAL_ARCHITECTURE.md) | Architecture technique |
| 14 | [14_DATABASE.md](./14_DATABASE.md) | Schéma de données |
| 15 | [15_ECONOMIC_SIMULATION.md](./15_ECONOMIC_SIMULATION.md) | Simulations économiques |
| 16 | [16_MVP_ROADMAP.md](./16_MVP_ROADMAP.md) | Roadmap concrète |
| — | [00b_BRIEF_CAPTURE.md](./00b_BRIEF_CAPTURE.md) | Inventaire exhaustif du brief |
| — | [17_EXECUTIVE_REPORT.md](./17_EXECUTIVE_REPORT.md) | Rapport final A–P |
| — | [18_SYNTHESIS_CROSS.md](./18_SYNTHESIS_CROSS.md) | Synthèse multi-agents |
| — | [19_SOURCES.md](./19_SOURCES.md) | Bibliographie & sources |
| — | [20_GAME_ECONOMIES_DEEP_DIVE.md](./20_GAME_ECONOMIES_DEEP_DIVE.md) | Deep dive économies MMO (Dofus/EVE/Albion…) |
| — | [21_MULTIAGENT_FINAL_SYNTHESIS.md](./21_MULTIAGENT_FINAL_SYNTHESIS.md) | Synthèse finale tous agents |
| — | [22_FARM_GRID_LAYOUT.md](./22_FARM_GRID_LAYOUT.md) | Grille parcelle, bâtiments, parking, adjacence |
| — | [23_GRID_SIZING.md](./23_GRID_SIZING.md) | Calcul taille grille optimale (12×12) |
| — | [24_MACHINES.md](./24_MACHINES.md) | Catalogue machines, usure, prérequis |
| — | [25_WEATHER_MARKET_TICK.md](./25_WEATHER_MARKET_TICK.md) | Tick météo/marché + brush |
| — | [26_AUTH_SESSION.md](./26_AUTH_SESSION.md) | Login, token, résumé de retour |
| — | [28_ZONE_MAP_UI.md](./28_ZONE_MAP_UI.md) | Grille carte zones (onboarding + expansion) |
| — | [27_MOISTURE_DRYING.md](./27_MOISTURE_DRYING.md) | Humidité récolte + séchage MVP |
| — | [29_ISO_POLISH.md](./29_ISO_POLISH.md) | Animations machines iso + feedback action |
| — | [30_FIRST_PLAYABLE.md](./30_FIRST_PLAYABLE.md) | Checklist première version jouable |
| — | [31_UX_MOBILE.md](./31_UX_MOBILE.md) | Splash, auth mobile, tutoriel, icônes, preview bâtiment |
| — | [32_LAND_ECONOMY.md](./32_LAND_ECONOMY.md) | Système foncier stratégique : prix, rareté, anti-monopole |
| — | [33_ART_DIRECTION.md](./33_ART_DIRECTION.md) | Direction artistique : palette claire, typo, low-poly, globe |
| — | [34_WORLD_GEOGRAPHY.md](./34_WORLD_GEOGRAPHY.md) | Monde imaginaire : continents, régions, climats, saisons |
| — | [35_ONBOARDING_FLOW.md](./35_ONBOARDING_FLOW.md) | Parcours d’entrée : porte, installation guidée, arrivée |
| — | [36_SYSTEMS_V2.md](./36_SYSTEMS_V2.md) | Mise en œuvre : 36 régions, foncier v2, bâtiments à paliers |
| — | [37_LIVESTOCK_SERVICES.md](./37_LIVESTOCK_SERVICES.md) | Élevage au pré, prestation ETA, revente, assets |
| — | [38_HARVEST_WINDOW.md](./38_HARVEST_WINDOW.md) | Fenêtre de récolte : décote de sur-maturité et labour |
| — | [39_SOIL_WORK.md](./39_SOIL_WORK.md) | Travail du sol : déchaumage, labour obligatoire, résidus |
| — | [40_CONSOLE_HYGIENE.md](./40_CONSOLE_HYGIENE.md) | Avertissements traités, fuite WebGL, allègement du bundle |
| — | [41_GLOBE_RENDER.md](./41_GLOBE_RENDER.md) | Globe : sphère lisse et textures procédurales |
| — | [42_TRADE.md](./42_TRADE.md) | Vendre : négociant, cours mondial, criée entre joueurs |
| — | [43_LIVESTOCK_PRODUCE.md](./43_LIVESTOCK_PRODUCE.md) | Traire, abattre, nourrir ; courette à porcs ; formes des bâtiments |
| — | [44_BREEDING_SPOILAGE.md](./44_BREEDING_SPOILAGE.md) | Reproduction du cheptel et péremption des denrées |
| — | [45_ROTATION.md](./45_ROTATION.md) | Rotation des cultures : le blé sur blé se paie |
| — | [46_MOBILE_SHELL.md](./46_MOBILE_SHELL.md) | Coque mobile : tiroirs du bas, gestes sur la grille |
| — | [47_FUTURES.md](./47_FUTURES.md) | Contrats à terme : engager une récolte à venir |

---

## Ordre de lecture recommandé

1. `17_EXECUTIVE_REPORT.md` (vue d’ensemble décisionnelle)
2. `01_GAME_DESIGN_DOCUMENT.md`
3. `16_MVP_ROADMAP.md`
4. Documents thématiques selon besoin
5. `12_LEGAL_REGULATORY.md` avant toute décision cash-out / marketplace argent réel
