# 34 — Géographie du monde imaginaire

**Statut :** bible de worldbuilding — référence pour `packages/shared/src/world.ts`
**Voir aussi :** `08_WEATHER_CLIMATE.md` · `09_WORLD_MAP.md` · `03_AGRICULTURE_REALISM.md` · `32_LAND_ECONOMY.md`

> **Demande client :** « des noms de villes, pays etc. en imaginaires mais avec les climats à chaque fois qui correspondent au lieu et à la saison ».

---

## Sommaire

1. [Principes de conception](#1--principes-de-conception)
2. [Les six continents](#2--les-six-continents)
3. [Les 36 régions](#3--les-36-régions)
4. [Système de saisons et hémisphères](#4--système-de-saisons-et-hémisphères)
5. [Climat × saison → météo](#5--climat--saison--météo)
6. [Générateur de noms](#6--générateur-de-noms)
7. [Structure de données TypeScript](#7--structure-de-données-typescript)
8. [Cohérence : la formule de rendement](#8--cohérence--la-formule-de-rendement)
9. [Intégration au code existant](#9--intégration-au-code-existant)
10. [Résumé](#10--résumé)

---

## 1 — Principes de conception

Trois règles ont guidé la construction du monde.

**Les noms sont inventés, la physique ne l'est pas.** Aucun toponyme réel n'apparaît, mais chaque région porte un code Köppen-Geiger authentique, et ses températures, ses pluies et sa saisonnalité sont celles que ce climat produit réellement à cette latitude. Un `Cfb` à 50° de latitude a bien 10 °C au printemps et 950 mm étalés sur l'année ; un `BWh` à 27° a bien 35 °C en été et 90 mm par an. Le joueur qui connaît la géographie réelle n'est jamais pris en défaut, et celui qui l'ignore apprend un modèle juste.

**La latitude commande tout.** Elle fixe la température, la photopériode, l'amplitude saisonnière, et surtout l'hémisphère — donc l'inversion des saisons. C'est la variable dont découlent le calendrier cultural, le risque et le prix du foncier.

**Chaque région doit avoir une raison d'être achetée.** Une région ne se résume pas à « meilleure » ou « moins bonne » : la Plaine de Sel Blanc est stérile mais donne trois coupes de luzerne sous pivot, les Marches de Taïga ne produisent presque rien mais coûtent 0,40 × le prix de base, et le Cap Austral moissonne quand Auralie est sous la neige. Le tableau des [multiplicateurs de rendement](#83--rendements-obtenus-par-région) montre qu'aucune région n'est dominante sur toutes les cultures.

### Lexique des difficultés

| Doc | Enum `Difficulty` | Ce que ça veut dire pour le joueur |
|-----|-------------------|------------------------------------|
| Débutant | `EASY` | Pluies régulières, gel prévisible, aucune irrigation, marché liquide |
| Intermédiaire | `MEDIUM` | Une contrainte forte à gérer (sécheresse d'été, mousson, hiver long) |
| Expert | `HARD` | Deux contraintes cumulées, irrigation ou séchage obligatoires, logistique coûteuse |

---

## 2 — Les six continents

| Code | Nom | Ambiance | Latitudes | Köppen dominant | Palette (terres / accent / ombre) | Difficulté | Foncier |
|------|-----|----------|-----------|-----------------|-----------------------------------|------------|---------|
| `AUR` | **Auralie** | Bocages brumeux, clochers d'ardoise, plaines à blé. Le berceau du jeu. | 44–52° N | `Cfb` océanique tempéré | `#6fae5a` · `#a8d98b` · `#33552a` | Débutant | ×1.00 |
| `KOR` | **Kortavie** | Immensités continentales, silos-cathédrales, hivers qui ferment les routes. | 37–56° N | `Dfa` continental à été chaud | `#c9a94e` · `#e6cd7f` · `#6b5620` | Intermédiaire | ×0.95 |
| `SAV` | **Savannis** | Savanes à termitières, fleuves en crue, canopée équatoriale. | 22° S – 2° S | `Aw` savane tropicale | `#d9944a` · `#f0bd7e` · `#7a4a1c` | Intermédiaire | ×0.75 |
| `MER` | **Méridie** | Terrasses d'oliviers, ergs ocres, fleuves-oasis. L'eau est la vraie monnaie. | 27–40° N | `Csa` méditerranéen | `#cf7f4f` · `#eba97a` · `#71391c` | Expert | ×1.10 |
| `YAN` | **Yanashi** | Moussons, deltas de rizières, typhons de fin d'été. | 8–44° N | `Cfa` subtropical humide | `#5fae86` · `#95d9b4` · `#28553d` | Intermédiaire | ×1.05 |
| `AUS` | **Australis** | Vent constant, blé austral, fjords. Quand le nord dort, Australis moissonne. | 55° S – 25° S | `BSk` steppique froid | `#b98c5e` · `#dcb98c` · `#5e432a` | Expert | ×0.90 |

**Répartition par hémisphère :** quatre continents au nord (`AUR`, `KOR`, `MER`, `YAN`), deux au sud (`SAV`, `AUS`). Le déséquilibre est volontaire : les terres australes sont plus rares, donc plus stratégiques, et les deux continents du sud sont ceux qui possèdent le foncier le moins cher — un joueur peut s'y installer tôt pour lisser ses revenus sans se ruiner.

**Continents équatoriaux :** `SAV` et la pointe sud de `YAN` chevauchent la zone intertropicale. Les régions concernées portent le drapeau `equatorial: true` et vivent en saison **humide / sèche** plutôt qu'en quatre saisons thermiques (voir [§4.4](#44--le-cas-tropical--humide--sec)).

---

## 3 — Les 36 régions

Chaque continent compte **six régions**, soit 36 au total. Pour chacune : code, nom, ville-marché, climat Köppen, latitude, températures et pluies par saison **locale**, fertilité de base, cultures adaptées avec leur aptitude agronomique (0–1), risques dominants et multiplicateur de prix foncier.

**Lecture des colonnes T° et Pluie :** les quatre valeurs sont données dans l'ordre **Printemps / Été / Automne / Hiver**, en saison **locale**. Pour une région australe, « Été » désigne donc bien son été à elle, qui tombe pendant l'hiver d'Auralie. La mention **·irr.** signale une région où l'irrigation est indispensable à toute agriculture rentable.

### 3.1 — AUR · Auralie

Auralie est le continent d'apprentissage. Son climat océanique amortit tout : les pluies sont réparties sur les quatre saisons, l'hiver descend rarement sous zéro, et l'amplitude thermique reste faible. Le blé d'hiver y est la culture de référence du monde entier — c'est le rendement du Val-de-Blé qui sert d'étalon économique au marché. Les deux marges du continent introduisent en douceur les difficultés à venir : les Hautes-Collines coupent trois semaines de saison par l'altitude, la Vallée de Solane bascule en `Cfa` et fait découvrir la sécheresse estivale.

| Code | Région | Ville-marché | Köppen | Lat. | T° P/É/A/H (°C) | Pluie P/É/A/H mm (an) | Fert. | Cultures adaptées (aptitude) | Risques dominants | Foncier |
|------|--------|--------------|--------|------|-----------------|------------------------|-------|------------------------------|-------------------|---------|
| `AUR-VALBLE` | Val-de-Blé | **Meunelle** | Cfb | 48.6°N | 11 / 19 / 12 / 4 | 160 / 170 / 175 / 155 (660) | 0.82 | Blé 0.95, Colza 0.88, Orge 0.85, Maïs 0.62 | Gel tardif, Grêle, Orage | ×1.00 |
| `AUR-BRUMES` | Côte des Brumes | **Portvarne** | Cfb | 50.4°N | 10 / 17 / 12 / 5 | 220 / 200 / 280 / 250 (950) | 0.74 | Luzerne 0.90, Orge 0.80, Pomme de terre 0.78, Blé 0.70 | Inondation, Orage, Ravageurs / maladies | ×0.90 |
| `AUR-COLLINES` | Hautes-Collines | **Cranmont** | Cfb | 46.2°N | 9 / 17 / 10 / 1 | 260 / 230 / 290 / 270 (1050) | 0.68 | Luzerne 0.86, Orge 0.74, Pomme de terre 0.72, Blé 0.66 | Gel tardif, Grêle, Tempête de vent | ×0.85 |
| `AUR-ORVAL` | Bassin d'Orval | **Sainte-Grange** | Cfb | 47.4°N | 10 / 19 / 11 / 2 | 180 / 210 / 190 / 160 (740) | 0.86 | Blé 0.93, Maïs 0.80, Colza 0.85, Orge 0.80 | Gel tardif, Sécheresse, Grêle | ×1.20 |
| `AUR-MARAIS` | Marais de Sluvenne | **Sluvenne** | Cfb | 51.3°N | 10 / 18 / 12 / 4 | 180 / 200 / 215 / 185 (780) | 0.90 | Pomme de terre 0.94, Blé 0.90, Colza 0.82, Orge 0.78 | Inondation, Orage, Ravageurs / maladies | ×1.30 |
| `AUR-SOLANE` | Vallée de Solane | **Vaubrise** | Cfa | 44.1°N | 13 / 23 / 15 / 6 | 210 / 150 / 220 / 170 (750) | 0.78 | Maïs 0.92, Tournesol 0.86, Vigne 0.84, Blé 0.80 | Sécheresse, Canicule, Grêle | ×1.10 |

### 3.2 — KOR · Kortavie

Kortavie est le continent des grands nombres : parcelles vastes, rendements d'été spectaculaires, hivers qui interdisent toute activité pendant une saison entière. La contrainte structurante n'est pas la pluie mais la **fenêtre** — le gel de la Grande Plaine et des Lacs Gelés ferme le calendrier, et une récolte manquée ne se rattrape pas avant l'année suivante. Le continent expose deux gradients : d'ouest en est, l'aridité (Vent-Noir à 360 mm) ; du sud au nord, le froid (des Terres du Bas-Soleil à 5 °C d'hiver aux Marches de Taïga à −17 °C).

| Code | Région | Ville-marché | Köppen | Lat. | T° P/É/A/H (°C) | Pluie P/É/A/H mm (an) | Fert. | Cultures adaptées (aptitude) | Risques dominants | Foncier |
|------|--------|--------------|--------|------|-----------------|------------------------|-------|------------------------------|-------------------|---------|
| `KOR-GRANDPLAINE` | Grande Plaine | **Silobourg** | Dfa | 41.8°N | 11 / 24 / 12 / -5 | 250 / 300 / 180 / 80 (810) | 0.88 | Maïs 0.95, Soja 0.90, Blé 0.78, Tournesol 0.72 | Sécheresse, Grêle, Orage | ×1.15 |
| `KOR-VENTNOIR` | Terres de Vent-Noir | **Rochelame** | BSk | 43.5°N | 10 / 22 / 9 / -6 | 120 / 130 / 70 / 40 (360) | 0.58 | Blé 0.72, Mil 0.70, Tournesol 0.66, Orge 0.66 | Sécheresse, Tempête de poussière, Tempête de vent | ×0.60 **·irr.** |
| `KOR-LACSGELES` | Lacs Gelés | **Fort-Givre** | Dfb | 46.9°N | 8 / 19 / 8 / -10 | 180 / 240 / 170 / 110 (700) | 0.72 | Blé 0.85, Orge 0.84, Colza 0.78, Pomme de terre 0.75 | Blizzard, Gel tardif, Grêle | ×0.80 |
| `KOR-RIVEDOR` | Rive-d'Or | **Ambremoulin** | Dfa | 39.2°N | 13 / 25 / 14 / -2 | 280 / 300 / 220 / 140 (940) | 0.84 | Maïs 0.92, Soja 0.88, Blé 0.80, Luzerne 0.70 | Inondation, Orage, Grêle | ×1.10 |
| `KOR-TAIGA` | Marches de Taïga | **Karvenn** | Dfc | 55.4°N | 4 / 15 / 3 / -17 | 100 / 190 / 110 / 80 (480) | 0.48 | Orge 0.70, Pomme de terre 0.68, Luzerne 0.60, Colza 0.45 | Blizzard, Gel tardif, Ravageurs / maladies | ×0.40 |
| `KOR-BASSOLEIL` | Terres du Bas-Soleil | **Corneval** | Cfa | 37.5°N | 16 / 27 / 17 / 5 | 300 / 280 / 250 / 220 (1050) | 0.80 | Soja 0.90, Coton 0.82, Maïs 0.85, Blé 0.72 | Orage, Canicule, Ravageurs / maladies | ×1.00 |

### 3.3 — SAV · Savannis

Savannis vit au rythme de la mousson australe, pas à celui du thermomètre : la température varie de 6 °C dans l'année, la pluie d'un facteur douze. Toute la stratégie tient dans la date d'installation des pluies, et l'aléa `MONSOON_DELAY` peut coûter une campagne entière. C'est aussi le continent des sols fragiles — latérites acides de la Terre Rouge, sols lessivés de la Canopée — où la fertilisation n'est pas une optimisation mais une condition de survie. En contrepartie, deux cycles par an y sont possibles, et le foncier est le moins cher du monde après Australis.

| Code | Région | Ville-marché | Köppen | Lat. | T° P/É/A/H (°C) | Pluie P/É/A/H mm (an) | Fert. | Cultures adaptées (aptitude) | Risques dominants | Foncier |
|------|--------|--------------|--------|------|-----------------|------------------------|-------|------------------------------|-------------------|---------|
| `SAV-HERBESHAUTES` | Hautes Herbes | **Kaledoumé** | Aw | 11.4°S | 26 / 25 / 24 / 20 | 180 / 480 / 230 / 40 (930) | 0.70 | Maïs 0.85, Sorgho 0.88, Mil 0.84, Coton 0.70 | Sécheresse, Incendie, Ravageurs / maladies | ×0.70 |
| `SAV-TERREROUGE` | Terre Rouge | **Nzalé** | Aw | 14.8°S | 27 / 26 / 24 / 19 | 150 / 430 / 180 / 30 (790) | 0.64 | Soja 0.82, Maïs 0.78, Sorgho 0.80, Manioc 0.76 | Sécheresse, Incendie, Ravageurs / maladies | ×0.60 |
| `SAV-GRANDFLEUVE` | Grand Fleuve | **Bahari-Sud** | Am | 8.2°S | 28 / 27 / 27 / 25 | 330 / 760 / 470 / 160 (1720) | 0.87 | Riz 0.94, Canne à sucre 0.90, Maïs 0.75, Manioc 0.70 | Inondation, Orage, Mousson retardée | ×1.05 |
| `SAV-PLATEAUX` | Plateaux d'Ombre | **Tessaran** | Cwb | 17.5°S | 19 / 20 / 17 / 13 | 220 / 430 / 230 / 60 (940) | 0.76 | Café 0.93, Maïs 0.82, Pomme de terre 0.78, Blé 0.70 | Grêle, Gel, Sécheresse | ×0.85 |
| `SAV-CANOPEE` | Canopée de Mbaraka | **Mbaraka** | Af | 2.1°S | 26 / 26 / 27 / 26 | 550 / 530 / 580 / 500 (2160) | 0.45 | Manioc 0.90, Riz 0.82, Canne à sucre 0.78, Maïs 0.55 | Inondation, Ravageurs / maladies, Orage | ×0.55 |
| `SAV-EPINES` | Brousse d'Épines | **Zawadhun** | BSh | 21.3°S | 24 / 26 / 21 / 15 | 60 / 140 / 50 / 20 (270) | 0.40 | Mil 0.70, Sorgho 0.68, Orge 0.55, Luzerne 0.50 | Sécheresse, Tempête de poussière, Canicule | ×0.35 **·irr.** |

### 3.4 — MER · Méridie

Méridie inverse le calendrier auquel un débutant s'attend : on y sème à l'automne et on récolte au début de l'été, parce que l'été est agronomiquement mort. Le continent forme un gradient continu du méditerranéen `Csa` au désert `BWh`, et l'eau y remplace la terre comme facteur limitant — quatre régions sur six exigent l'irrigation. Le Limon de Serapha est l'exception qui résume le continent : 90 mm de pluie par an et pourtant la meilleure fertilité de Méridie, parce qu'un fleuve la traverse.

| Code | Région | Ville-marché | Köppen | Lat. | T° P/É/A/H (°C) | Pluie P/É/A/H mm (an) | Fert. | Cultures adaptées (aptitude) | Risques dominants | Foncier |
|------|--------|--------------|--------|------|-----------------|------------------------|-------|------------------------------|-------------------|---------|
| `MER-OLIVERAIE` | Grande Oliveraie | **Calathée** | Csa | 37.4°N | 15 / 27 / 18 / 9 | 130 / 30 / 180 / 180 (520) | 0.72 | Olivier 0.94, Vigne 0.90, Blé 0.78, Orge 0.74 | Sécheresse, Incendie, Canicule | ×1.25 |
| `MER-SELBLANC` | Plaine de Sel Blanc | **Ourmiane** | BWh | 31.1°N | 23 / 36 / 25 / 12 | 20 / 5 / 25 / 30 (80) | 0.42 | Luzerne 0.60, Blé 0.55, Coton 0.50 | Sécheresse, Tempête de poussière, Canicule | ×0.45 **·irr.** |
| `MER-DEUXVENTS` | Cap des Deux-Vents | **Port-Alcaze** | Csa | 39.6°N | 14 / 25 / 17 / 9 | 150 / 40 / 210 / 200 (600) | 0.79 | Vigne 0.92, Blé 0.82, Tournesol 0.74, Olivier 0.72 | Tempête de vent, Grêle, Sécheresse | ×1.35 |
| `MER-OASIS` | Oasis de Zerán | **Zerán** | BSh | 29.4°N | 21 / 33 / 23 / 12 | 45 / 15 / 60 / 80 (200) | 0.61 | Orge 0.70, Mil 0.66, Coton 0.62, Maïs 0.58 | Sécheresse, Tempête de poussière, Canicule | ×0.70 **·irr.** |
| `MER-CEDRES` | Monts des Cèdres | **Cedravel** | Csb | 35.8°N | 12 / 22 / 14 / 4 | 200 / 60 / 260 / 260 (780) | 0.58 | Vigne 0.86, Pomme de terre 0.76, Orge 0.72, Olivier 0.68 | Gel tardif, Grêle, Incendie | ×0.80 |
| `MER-LIMON` | Limon de Serapha | **Serapha** | BWh | 27.8°N | 22 / 35 / 25 / 13 | 20 / 10 / 25 / 35 (90) | 0.88 | Blé 0.90, Coton 0.86, Riz 0.80, Maïs 0.78 | Inondation, Canicule, Ravageurs / maladies | ×1.30 **·irr.** |

### 3.5 — YAN · Yanashi

Yanashi est le continent le plus riche et le plus dangereux. L'eau ne manque jamais, la chaleur non plus, et la double culture y est la norme plutôt que l'exception : riz puis blé au Delta de Jade, deux cycles de riz aux Îles de Perle. Le prix à payer est le `CYCLONE` de fin d'été, qui frappe précisément quand la première récolte est mûre, et une amplitude interne extrême — 40 °C séparent l'été des Îles de Perle de l'hiver de la Steppe du Nord.

| Code | Région | Ville-marché | Köppen | Lat. | T° P/É/A/H (°C) | Pluie P/É/A/H mm (an) | Fert. | Cultures adaptées (aptitude) | Risques dominants | Foncier |
|------|--------|--------------|--------|------|-----------------|------------------------|-------|------------------------------|-------------------|---------|
| `YAN-DELTAJADE` | Delta de Jade | **Shirogawa** | Cfa | 30.8°N | 17 / 27 / 19 / 6 | 350 / 520 / 280 / 150 (1300) | 0.90 | Riz 0.96, Maïs 0.85, Soja 0.80, Blé 0.74 | Cyclone, Inondation, Ravageurs / maladies | ×1.40 |
| `YAN-COLLINESTHE` | Collines du Thé | **Rin-No-Sato** | Cwa | 27.2°N | 19 / 27 / 20 / 9 | 380 / 620 / 300 / 100 (1400) | 0.78 | Riz 0.88, Café 0.80, Maïs 0.78, Canne à sucre 0.72 | Inondation, Ravageurs / maladies, Orage | ×1.00 |
| `YAN-STEPPENORD` | Steppe du Nord | **Baltunn** | Dwa | 43.7°N | 10 / 23 / 10 / -13 | 95 / 385 / 100 / 20 (600) | 0.66 | Maïs 0.82, Soja 0.78, Blé 0.70, Mil 0.66 | Blizzard, Gel tardif, Sécheresse | ×0.65 |
| `YAN-ILESPERLE` | Îles de Perle | **Amitsu** | Am | 21.4°N | 25 / 28 / 26 / 19 | 300 / 900 / 450 / 150 (1800) | 0.83 | Riz 0.94, Canne à sucre 0.90, Manioc 0.72, Maïs 0.70 | Cyclone, Inondation, Mousson retardée | ×1.15 |
| `YAN-HAUTSNEIGES` | Hauts de Neige-Bleue | **Yukimine** | Dfb | 39.4°N | 10 / 22 / 11 / -4 | 230 / 330 / 260 / 180 (1000) | 0.70 | Orge 0.82, Pomme de terre 0.80, Blé 0.76, Colza 0.70 | Blizzard, Gel tardif, Grêle | ×0.75 |
| `YAN-BAIECORAIL` | Baie de Corail | **Tsumaru** | Af | 8.6°N | 27 / 27 / 27 / 26 | 520 / 560 / 620 / 500 (2200) | 0.52 | Manioc 0.86, Canne à sucre 0.84, Riz 0.80, Café 0.60 | Inondation, Ravageurs / maladies, Cyclone | ×0.60 |

### 3.6 — AUS · Australis

Australis est le continent de l'arbitrage. Ses six régions n'ont pas d'intérêt agronomique décisif prises isolément — la Vallée Verte est excellente, le reste est âpre — mais leur saisonnalité est **inversée** par rapport aux quatre continents du nord. Posséder une parcelle ici, c'est moissonner en janvier pendant qu'Auralie est sous la neige, vendre sur un marché mondial en pénurie, et amortir la même moissonneuse deux fois par an. La Vallée Verte est le jumeau climatique du Val-de-Blé à six mois de décalage ; les Coteaux de Solivera sont ceux de la Grande Oliveraie.

| Code | Région | Ville-marché | Köppen | Lat. | T° P/É/A/H (°C) | Pluie P/É/A/H mm (an) | Fert. | Cultures adaptées (aptitude) | Risques dominants | Foncier |
|------|--------|--------------|--------|------|-----------------|------------------------|-------|------------------------------|-------------------|---------|
| `AUS-BLEDESUD` | Ceinture du Blé-Sud | **Warrindal** | BSk | 33.6°S | 15 / 24 / 15 / 8 | 90 / 70 / 110 / 130 (400) | 0.62 | Blé 0.80, Orge 0.78, Colza 0.70, Luzerne 0.62 | Sécheresse, Tempête de vent, Canicule | ×0.70 |
| `AUS-VALLEEVERTE` | Vallée Verte | **Tamerook** | Cfb | 38.1°S | 13 / 19 / 14 / 8 | 170 / 140 / 200 / 210 (720) | 0.85 | Blé 0.90, Orge 0.86, Colza 0.82, Luzerne 0.80 | Gel tardif, Orage, Grêle | ×1.20 |
| `AUS-ROCHEROUGE` | Roche Rouge | **Kalgarra** | BWh | 25.9°S | 26 / 34 / 24 / 14 | 40 / 60 / 30 / 20 (150) | 0.38 | Luzerne 0.52, Sorgho 0.48, Blé 0.40 | Sécheresse, Tempête de poussière, Canicule | ×0.35 **·irr.** |
| `AUS-CAPAUSTRAL` | Cap Austral | **Fjordhaven** | Cfc | 44.2°S | 9 / 14 / 10 / 5 | 300 / 260 / 330 / 320 (1210) | 0.55 | Luzerne 0.84, Pomme de terre 0.72, Orge 0.60, Blé 0.50 | Orage, Tempête de vent, Inondation | ×0.50 |
| `AUS-SOLIVERA` | Coteaux de Solivera | **Solivera** | Csb | 34.8°S | 14 / 22 / 15 / 8 | 110 / 40 / 180 / 220 (550) | 0.64 | Vigne 0.93, Olivier 0.82, Blé 0.72, Tournesol 0.66 | Sécheresse, Incendie, Gel tardif | ×1.00 **·irr.** |
| `AUS-NYVARDEN` | Rives de Nyvarden | **Nyvarden** | ET | 54.6°S | 3 / 8 / 3 / -3 | 120 / 130 / 130 / 120 (500) | 0.22 | Pomme de terre 0.45, Orge 0.35, Luzerne 0.30 | Blizzard, Gel, Tempête de vent | ×0.18 |

---

## 4 — Système de saisons et hémisphères

### 4.1 — Durée d'une saison en temps réel

Le monde tourne sur un cycle de quatre saisons, en boucle infinie : `SPRING → SUMMER → AUTUMN → WINTER → SPRING…`

| Échelle | 1 jour-jeu | 1 saison | 1 année | Usage |
|---------|-----------|----------|---------|-------|
| **MVP (livré)** | ≈ 32 s | **15 min réelles** | 1 h réelle | Itération rapide, tests, découverte. Constante `SEASON_DURATION_MS` |
| **Monde persistant (cible)** | 6 h réelles | **7 jours réels** (28 jours-jeu) | 28 jours réels (112 jours-jeu) | MMO ; une saison = une semaine de vie réelle |

La cible persistante est choisie pour qu'une saison corresponde à une **semaine calendaire** : un joueur qui se connecte le week-end vit une saison complète entre deux sessions, et l'année de jeu tient dans un mois d'abonnement. Le passage d'une échelle à l'autre ne change aucune donnée climatique — seul le nombre de millisecondes par jour-jeu varie (`WORLD_CALENDAR.mvpSeasonMs` vs `liveMsPerGameDay`).

Le tick météo reste calé sur **un état météo par jour-jeu et par région**, conformément à `08_WEATHER_CLIMATE.md`.

### 4.2 — L'inversion hémisphérique

C'est le mécanisme stratégique central du jeu.

Le serveur maintient **une seule saison de référence**, exprimée dans le référentiel de l'hémisphère nord. Chaque région en déduit sa saison locale par un décalage de deux crans si elle est australe :

```
saison_locale = hémisphère === "S" ? saisons[(index + 2) % 4] : saison_référence
```

| Saison de référence (serveur) | Hémisphère **Nord** (`AUR`, `KOR`, `MER`, `YAN`) | Hémisphère **Sud** (`SAV`, `AUS`) |
|-------------------------------|--------------------------------------------------|-----------------------------------|
| `SPRING` | Printemps | **Automne** |
| `SUMMER` | Été | **Hiver** |
| `AUTUMN` | Automne | **Printemps** |
| `WINTER` | Hiver | **Été** |

Conséquence immédiate : **quand Auralie moissonne, Australis sème**, et réciproquement. Les deux hémisphères ne sont jamais en pénurie en même temps.

### 4.3 — Effet des saisons sur les cultures

Le tableau ci-dessous se lit en saison **locale** — il s'applique donc à l'identique aux deux hémisphères, à six mois d'écart.

| Saison locale | Travaux possibles | Effet sur les cultures | Météo dominante | Marché |
|---------------|-------------------|------------------------|-----------------|--------|
| **Printemps** | Semis de printemps (maïs, soja, tournesol, pomme de terre), fertilisation, désherbage | Reprise de végétation des cultures d'hiver ; implantation des cultures d'été. Risque `LATE_FROST` sur les jeunes levées | Alternance pluie / éclaircies | Stocks de report au plus bas, prix hauts |
| **Été** | Récolte des cultures d'hiver, irrigation, fenaison | Floraison et remplissage du grain : **la saison qui fait le rendement**. `DROUGHT` et `HEATWAVE` y coûtent le plus cher | Sec et chaud (climats C et B), orageux (climats A et D) | Arrivée de la récolte, prix en baisse |
| **Automne** | Semis d'hiver (blé, orge, colza), labour, récolte des cultures d'été | Implantation avant dormance ; maturation des cultures semées au printemps. Récolte sous pluie ⇒ malus d'humidité | Pluvieux, jours qui raccourcissent | Pic d'offre mondiale, prix planchers |
| **Hiver** | Entretien du matériel, élevage, séchage, planification | Dormance des cultures d'hiver ; **aucune croissance** pour les cultures d'été. Un hiver trop rude détruit les semis d'automne (`frostKillFactor`) | Neige (climats D et E), pluie (climats C), sec (climats B et Cs) | Offre tarie, prix en hausse |

**Le facteur qui rend l'inversion rentable :** en hiver nord, les prix mondiaux montent parce que quatre continents sur six ne produisent rien — et c'est exactement le moment où Australis et Savannis récoltent. Le code prévoit déjà une prime explicite pour cette diversification (`HEMISPHERE_HEDGE_BONUS`, +5 % de rendement si le joueur possède des terres dans les deux hémisphères), qui s'ajoute à l'avantage économique naturel.

### 4.4 — Le cas tropical : humide / sec

Les régions marquées `equatorial: true` ne connaissent pas quatre saisons thermiques. Leur température varie de moins de 8 °C dans l'année, mais leur pluviométrie varie d'un facteur 5 à 20. On y substitue une phase de mousson :

| Saison locale | Phase tropicale (`Af`) | Phase tropicale (`Am`, `Aw`, `Cwa`, `Cwb`) |
|---------------|------------------------|---------------------------------------------|
| Printemps | Humide | Transition — installation des pluies |
| Été | Humide | **Humide** — mousson, l'essentiel du cumul annuel |
| Automne | Humide | Transition — retrait des pluies |
| Hiver | Humide | **Sèche** — quasi aucune pluie |

En `Af` (Canopée de Mbaraka, Baie de Corail), il n'y a pas de saison sèche du tout : trois cycles courts par an sont possibles, mais la fertilité s'effondre si rien n'est restitué au sol. En `Aw`, semer avant l'installation des pluies est la faute la plus punitive du jeu.

### 4.5 — Fenêtres de semis par hémisphère

| Culture | Semis (saison locale) | Cycle | Récolte (saison locale) | Nord : mois-jeu | Sud : mois-jeu |
|---------|----------------------|-------|-------------------------|-----------------|----------------|
| Blé, orge, colza (hiver) | Automne | 4 saisons (dont 1 en dormance) | Été | Semis auto. → récolte été | Décalé de 6 mois |
| Blé, orge (printemps) | Printemps | 2–3 saisons | Automne | Semis print. → récolte auto. | Décalé de 6 mois |
| Maïs, tournesol, pomme de terre | Printemps | 2 saisons | Automne | Semis print. → récolte auto. | Décalé de 6 mois |
| Soja, sorgho, riz | Printemps ou été | 2 saisons | Automne / hiver | Double culture possible en `Cfa`/`Cwa` | Idem, décalé |
| Mil | Été | 1 saison | Automne | Culture de rattrapage post-sécheresse | Idem, décalé |
| Canne à sucre, manioc, café, vigne, olivier | Pluriannuel | 4 saisons+ | Selon espèce | Immobilise la parcelle | Idem, décalé |

---

## 5 — Climat × saison → météo

### 5.1 — États météo

Le projet définit cinq états dans `packages/shared/src/index.ts` (`WeatherState`) — la table ci-dessous n'en invente aucun :

| Code | Libellé (`WEATHER_LABELS`) | Effet gameplay actuel |
|------|---------------------------|------------------------|
| `CLEAR` | Clair | `weatherYieldFactor` ×1.02 ; humidité de récolte 0.12 |
| `CLOUDY` | Nuageux | ×1.00 ; humidité 0.14 |
| `RAIN` | Pluie | ×1.00 mais humidité 0.22 → malus de séchage |
| `STORM` | Orage | ×0.88 ; humidité 0.25 ; choc d'offre sur le marché |
| `SNOW` | Neige | ×0.75 ; humidité 0.28 ; travaux bloqués |

### 5.2 — Table de probabilités

Chaque ligne donne la probabilité qu'un jour-jeu donné prenne cet état, **par climat Köppen et par saison locale**. Chaque ligne somme à 100 % — c'est vérifié par test. Comme les saisons sont locales, la même table sert aux deux hémisphères sans transformation.

Cette table remplace la fonction `weatherOdds()` actuelle, qui ne distingue que la famille Köppen (`A`/`B`/`C`/`D`) : on passe de 4 profils à 19, ce qui rend enfin distincts un `Csa` méditerranéen (été à 80 % de ciel clair) et un `Cfb` océanique (été à 26 % de pluie).

**Famille A**

| Climat | Saison locale | CLEAR | CLOUDY | RAIN | STORM | SNOW |
|--------|---------------|-------|--------|------|-------|------|
| **Af** — Équatorial humide | Printemps | 20 % | 34 % | 36 % | 10 % | 0 % |
|  | Été | 18 % | 34 % | 38 % | 10 % | 0 % |
|  | Automne | 19 % | 34 % | 37 % | 10 % | 0 % |
|  | Hiver | 22 % | 35 % | 34 % | 9 % | 0 % |
| **Am** — Tropical de mousson | Printemps | 30 % | 30 % | 30 % | 10 % | 0 % |
|  | Été | 10 % | 28 % | 47 % | 15 % | 0 % |
|  | Automne | 18 % | 30 % | 42 % | 10 % | 0 % |
|  | Hiver | 50 % | 28 % | 18 % | 4 % | 0 % |
| **Aw** — Tropical de savane (hiver sec) | Printemps | 40 % | 28 % | 25 % | 7 % | 0 % |
|  | Été | 18 % | 30 % | 40 % | 12 % | 0 % |
|  | Automne | 35 % | 30 % | 28 % | 7 % | 0 % |
|  | Hiver | 65 % | 23 % | 10 % | 2 % | 0 % |

**Famille B**

| Climat | Saison locale | CLEAR | CLOUDY | RAIN | STORM | SNOW |
|--------|---------------|-------|--------|------|-------|------|
| **BWh** — Désertique chaud | Printemps | 78 % | 15 % | 5 % | 2 % | 0 % |
|  | Été | 72 % | 17 % | 7 % | 4 % | 0 % |
|  | Automne | 80 % | 14 % | 5 % | 1 % | 0 % |
|  | Hiver | 76 % | 17 % | 6 % | 1 % | 0 % |
| **BWk** — Désertique froid | Printemps | 70 % | 20 % | 7 % | 3 % | 0 % |
|  | Été | 74 % | 18 % | 6 % | 2 % | 0 % |
|  | Automne | 72 % | 20 % | 7 % | 1 % | 0 % |
|  | Hiver | 62 % | 24 % | 6 % | 1 % | 7 % |
| **BSh** — Steppique chaud | Printemps | 62 % | 22 % | 12 % | 4 % | 0 % |
|  | Été | 50 % | 24 % | 20 % | 6 % | 0 % |
|  | Automne | 64 % | 22 % | 12 % | 2 % | 0 % |
|  | Hiver | 68 % | 22 % | 9 % | 1 % | 0 % |
| **BSk** — Steppique froid | Printemps | 55 % | 25 % | 15 % | 5 % | 0 % |
|  | Été | 58 % | 22 % | 14 % | 6 % | 0 % |
|  | Automne | 60 % | 24 % | 14 % | 2 % | 0 % |
|  | Hiver | 50 % | 28 % | 10 % | 2 % | 10 % |

**Famille C**

| Climat | Saison locale | CLEAR | CLOUDY | RAIN | STORM | SNOW |
|--------|---------------|-------|--------|------|-------|------|
| **Csa** — Méditerranéen à été chaud | Printemps | 50 % | 25 % | 20 % | 5 % | 0 % |
|  | Été | 80 % | 13 % | 5 % | 2 % | 0 % |
|  | Automne | 42 % | 26 % | 26 % | 6 % | 0 % |
|  | Hiver | 35 % | 30 % | 32 % | 3 % | 0 % |
| **Csb** — Méditerranéen à été tempéré | Printemps | 45 % | 27 % | 23 % | 5 % | 0 % |
|  | Été | 70 % | 18 % | 10 % | 2 % | 0 % |
|  | Automne | 35 % | 28 % | 32 % | 5 % | 0 % |
|  | Hiver | 25 % | 30 % | 40 % | 3 % | 2 % |
| **Cfa** — Subtropical humide | Printemps | 38 % | 27 % | 27 % | 8 % | 0 % |
|  | Été | 40 % | 24 % | 25 % | 11 % | 0 % |
|  | Automne | 45 % | 25 % | 25 % | 5 % | 0 % |
|  | Hiver | 35 % | 30 % | 30 % | 3 % | 2 % |
| **Cfb** — Océanique tempéré | Printemps | 35 % | 30 % | 29 % | 6 % | 0 % |
|  | Été | 40 % | 28 % | 26 % | 6 % | 0 % |
|  | Automne | 30 % | 32 % | 33 % | 5 % | 0 % |
|  | Hiver | 25 % | 34 % | 34 % | 2 % | 5 % |
| **Cfc** — Océanique subpolaire | Printemps | 22 % | 34 % | 38 % | 6 % | 0 % |
|  | Été | 28 % | 34 % | 34 % | 4 % | 0 % |
|  | Automne | 20 % | 34 % | 40 % | 4 % | 2 % |
|  | Hiver | 16 % | 34 % | 36 % | 2 % | 12 % |
| **Cwa** — Subtropical à hiver sec | Printemps | 42 % | 26 % | 26 % | 6 % | 0 % |
|  | Été | 22 % | 28 % | 38 % | 12 % | 0 % |
|  | Automne | 50 % | 25 % | 22 % | 3 % | 0 % |
|  | Hiver | 66 % | 22 % | 11 % | 1 % | 0 % |
| **Cwb** — Subtropical d'altitude à hiver sec | Printemps | 45 % | 26 % | 24 % | 5 % | 0 % |
|  | Été | 25 % | 30 % | 36 % | 9 % | 0 % |
|  | Automne | 50 % | 26 % | 21 % | 3 % | 0 % |
|  | Hiver | 68 % | 22 % | 10 % | 0 % | 0 % |

**Famille D**

| Climat | Saison locale | CLEAR | CLOUDY | RAIN | STORM | SNOW |
|--------|---------------|-------|--------|------|-------|------|
| **Dfa** — Continental à été chaud | Printemps | 36 % | 27 % | 28 % | 7 % | 2 % |
|  | Été | 45 % | 23 % | 22 % | 10 % | 0 % |
|  | Automne | 42 % | 28 % | 25 % | 3 % | 2 % |
|  | Hiver | 30 % | 30 % | 10 % | 0 % | 30 % |
| **Dfb** — Continental à été tempéré | Printemps | 34 % | 28 % | 28 % | 6 % | 4 % |
|  | Été | 42 % | 26 % | 24 % | 8 % | 0 % |
|  | Automne | 36 % | 30 % | 26 % | 3 % | 5 % |
|  | Hiver | 24 % | 30 % | 7 % | 0 % | 39 % |
| **Dfc** — Subarctique (taïga) | Printemps | 28 % | 30 % | 24 % | 4 % | 14 % |
|  | Été | 38 % | 28 % | 28 % | 6 % | 0 % |
|  | Automne | 28 % | 30 % | 22 % | 2 % | 18 % |
|  | Hiver | 18 % | 28 % | 4 % | 0 % | 50 % |
| **Dwa** — Continental à hiver sec (mousson) | Printemps | 48 % | 26 % | 20 % | 6 % | 0 % |
|  | Été | 26 % | 28 % | 36 % | 10 % | 0 % |
|  | Automne | 55 % | 25 % | 17 % | 2 % | 1 % |
|  | Hiver | 50 % | 26 % | 4 % | 0 % | 20 % |

**Famille E**

| Climat | Saison locale | CLEAR | CLOUDY | RAIN | STORM | SNOW |
|--------|---------------|-------|--------|------|-------|------|
| **ET** — Toundra | Printemps | 22 % | 32 % | 16 % | 2 % | 28 % |
|  | Été | 30 % | 34 % | 28 % | 4 % | 4 % |
|  | Automne | 22 % | 32 % | 16 % | 2 % | 28 % |
|  | Hiver | 14 % | 28 % | 2 % | 0 % | 56 % |

**Points de calibration à retenir :**

- Le `SNOW` n'apparaît **jamais** dans les familles `A` (tropical) ni dans les climats chauds `BWh`, `BSh`, `Csa`, `Cwa` — un joueur ne verra jamais neiger sur l'Oasis de Zerán.
- L'été méditerranéen (`Csa`, 80 % `CLEAR`, 5 % `RAIN`) est le meilleur créneau de moisson du monde : humidité de récolte minimale, donc aucun coût de séchage.
- L'hiver continental (`Dfb` 39 % `SNOW`, `Dfc` 50 %) bloque de fait les travaux une saison entière.
- La mousson (`Am` en été : 47 % `RAIN` + 15 % `STORM`) rend la récolte quasi impossible pendant sa saison humide — d'où des calendriers tropicaux calés sur la fin de mousson.
- L'`ET` (toundra) est le seul climat où il neige encore 28 % du temps au printemps et à l'automne, ce qui réduit la fenêtre utile à la seule saison d'été.

---

## 6 — Générateur de noms

Le monde doit pouvoir nommer des milliers de villages et de parcelles sans intervention humaine, tout en restant crédible : un hameau de Kortavie ne peut pas s'appeler comme un port de Yanashi. Chaque continent dispose donc de sa propre banque de morphèmes, avec au minimum **20 préfixes et 20 suffixes**.

### 6.1 — Règle de composition

```
nom = [qualificatif ?] + Préfixe + Suffixe
```

1. **Trois tirages indépendants.** Le préfixe, le suffixe et le qualificatif sont tirés par trois hachages FNV-1a **salés différemment** (`seed + "#prefix"`, `#suffix`, `#qualifier`). Sans ce salage, des parcelles voisines — dont les seeds ne diffèrent que d'un caractère — produisent des noms corrélés (par exemple huit villages d'affilée portant tous un qualificatif).
2. **Déterminisme.** Un même seed donne toujours le même nom : les toponymes n'ont pas besoin d'être stockés en base, on les régénère à la volée depuis `zoneCode:mapX:mapY`.
3. **Élision.** Si le préfixe se termine par une voyelle et que le suffixe commence par une voyelle, la voyelle du préfixe tombe : `Mira` + `ana` → *Mirana* et non *Miraana*. `Uz` + `mira` → *Uzmira*.
4. **Qualificatif dans 25 % des cas.** Il donne du relief au maillage local (*Haut-*, *Novo-*, *Kita-*, *Sidi-*…) et évite l'uniformité.
5. **Capitale initiale**, le reste en minuscules, y compris après élision.

L'espace nominal utile est d'environ **4 000 noms par continent** (20 × 20 combinaisons × 6 variantes de qualificatif). Au-delà de quelques centaines de tirages, des collisions apparaissent : les **parcelles** ajoutent donc un numéro romain (`makeParcelName`), qui garantit l'unicité à l'intérieur d'une zone.

### 6.2 — Banques par continent

**AUR — Auralie** (22 préfixes, 22 suffixes)

| | |
|---|---|
| **Préfixes** | Aub · Bel · Cler · Dun · Éper · Fon · Gran · Haut · Iver · Jol · Kaer · Lan · Mar · Noue · Orme · Pré · Quen · Roc · Sau · Til · Val · Ver |
| **Suffixes** | anne · ac · brie · court · dole · elle · esse · fort · gny · lieu · mont · nay · ombre · ord · pierre · queux · rive · sac · thal · val · vonne · yse |
| **Qualificatifs** | Haut- · Bas- · Vieux- · Petit- · Grand- |

**KOR — Kortavie** (20 préfixes, 20 suffixes)

| | |
|---|---|
| **Préfixes** | Amber · Brask · Chorn · Dvor · Elsk · Grod · Halv · Isker · Jarn · Kras · Lyt · Mor · Nyv · Ostra · Pel · Rud · Skal · Torv · Vest · Zhel |
| **Suffixes** | grad · ovka · sk · stad · mark · halm · vik · bor · dal · lund · nitsa · por · rud · shen · taj · ur · venn · yr · zov · kaya |
| **Qualificatifs** | Novo- · Staro- · Verkh- · Nizhne- · Bolche- |

**SAV — Savannis** (20 préfixes, 20 suffixes)

| | |
|---|---|
| **Préfixes** | Ba · Chi · Dumé · Ede · Fela · Gwa · Hama · Iri · Jala · Kale · Lomba · Mba · Ndo · Oke · Pemba · Rufi · Sanja · Tala · Ubu · Zawa |
| **Suffixes** | bara · cho · dala · engo · fura · gongo · hun · imba · jaya · kwe · lundu · mba · ndo · oka · pura · rana · sika · tui · wene · zima |
| **Qualificatifs** | Kwa- · Ma- · Bo- · Ti- · Nova- |

**MER — Méridie** (21 préfixes, 20 suffixes)

| | |
|---|---|
| **Préfixes** | Al · Bar · Cas · Dar · Elz · Far · Gis · Hal · Ibra · Jal · Kar · Lem · Mira · Nah · Ora · Pal · Qasr · Sab · Tar · Uz · Zer |
| **Suffixes** | ana · bat · cala · dara · ène · fira · halim · im · jan · kesh · lune · mira · nis · oud · pal · rah · sim · tar · ura · zan |
| **Qualificatifs** | Aïn- · Dar- · Bab- · Sidi- · Ras- |

**YAN — Yanashi** (20 préfixes, 20 suffixes)

| | |
|---|---|
| **Préfixes** | Ama · Bal · Chi · Dai · Fuji · Gen · Haru · Ishi · Jun · Kaza · Mizu · Nagi · Oku · Rin · Saku · Take · Uki · Wata · Yuki · Zen |
| **Suffixes** | bara · dani · gawa · hama · ishi · jima · kura · mine · moto · naga · no-sato · oka · raku · saki · shiro · tsu · umi · wan · yama · zaki |
| **Qualificatifs** | Kita- · Minami- · Higashi- · Nishi- · Ō- |

**AUS — Australis** (20 préfixes, 20 suffixes)

| | |
|---|---|
| **Préfixes** | Ald · Bran · Curra · Drif · Eld · Fjall · Gorm · Hrim · Isa · Kald · Lyng · Myr · Norn · Orm · Rask · Skar · Tamer · Ur · Vind · Warri |
| **Suffixes** | aal · brekk · dalur · eng · fjell · gard · havn · isen · jokk · kar · laup · mork · nes · ord · pyn · rand · skaal · tind · vaag · ravn |
| **Qualificatifs** | Store- · Lille- · Ytre- · Indre- · Nord- |

Chaque banque a une signature sonore assumée : Auralie tire vers le roman occidental (*-court*, *-mont*, *-lieu*), Kortavie vers le slavo-nordique (*-grad*, *-ovka*, *-dal*), Savannis vers les langues bantoues et austronésiennes (*-gongo*, *-imba*, *-jaya*), Méridie vers le levantin et l'ibéro-arabe (*-halim*, *-kesh*, *Qasr-*), Yanashi vers le japonais (*-gawa*, *-yama*, *-jima*), Australis vers le scandinave austral (*-fjell*, *-havn*, *-dalur*).

### 6.3 — Échantillons générés

| Continent | Villages générés (seed → nom) |
|-----------|-------------------------------|
| **AUR** Auralie | Vieux-Iverord, Rocrive, Clersac, Rocombre, Petit-Ormesac, Fonanne, Marelle, Dunesse |
| **KOR** Kortavie | Nizhne-Skallund, Torvdal, Lytpor, Dvorzov, Staro-Elskovka, Braskmark, Vestkaya, Dvortaj |
| **SAV** Savannis | Lombazima, Ededala, Kwa-Batui, Kalejaya, Dumimba, Zawadala, Kwa-Feloka, Gwafura |
| **MER** Méridie | Sidi-Gisoud, Mirajan, Uzmira, Zerura, Aïn-Gistar, Qasrsim, Palrah, Gispal |
| **YAN** Yanashi | Kita-Ukinaga, Kazishi, Chihama, Zengawa, Kita-Junsaki, Balraku, Yukitsu, Zenyama |
| **AUS** Australis | Fjallskaal, Nord-Tamertind, Hrimhavn, Gormravn, Urjokk, Indre-Eldord, Hrimhavn, Lyngisen |

Pour les parcelles, le numéro romain garantit l'unicité dans la zone :

| Seed | Nom de parcelle |
|------|-----------------|
| `AUR-VALBLE:3:2` | Kaersac IV |
| `KOR-GRANDPLAINE:0:5` | Krasrud XII |
| `SAV-GRANDFLEUVE:2:1` | Mbalundu I |
| `MER-OASIS:1:1` | Dar-Baroud IX |
| `YAN-DELTAJADE:4:0` | Nagigawa XXI |
| `AUS-VALLEEVERTE:2:3` | Gormisen III |

---

## 7 — Structure de données TypeScript

Le module ci-dessous est **complet, compilé et testé** (`tsc --strict`, cible ES2022, module NodeNext). Il est prêt à copier tel quel dans `packages/shared/src/world-climate.ts`, puis à exposer via `packages/shared/src/index.ts` :

```ts
export * from "./world-climate.js";
```

Il **complète** `world.ts` sans le contredire : mêmes codes de continent, mêmes codes de région, mêmes villes, mêmes fertilités, mêmes multiplicateurs fonciers, mêmes latitudes. Les types `Hemisphere`, `Season` et `Difficulty` sont importés de `world.ts` plutôt que redéclarés, ce qui garantit qu'une divergence future casserait la compilation au lieu de passer silencieusement. Les six régions supplémentaires par continent (12 au total, portant l'effectif de 24 à 36) sont additives : aucune région existante n'est renommée ni supprimée.

<details>
<summary><strong>Interfaces principales</strong> (résumé avant le code complet)</summary>

| Interface / constante | Rôle |
|-----------------------|------|
| `Continent` | Code, nom, ambiance, hémisphère, bornes de latitude, Köppen dominant, palette, difficulté, foncier |
| `Region` | Code, nom, ville-marché, Köppen, latitude, hémisphère, températures et pluies par saison, fertilité, cultures, aléas, foncier, irrigation |
| `CONTINENTS` | Les 6 continents, indexés par code |
| `REGIONS` | Les 36 régions, avec `REGIONS_BY_CODE` et `regionsOf()` |
| `WEATHER_BY_CLIMATE` | 19 climats × 4 saisons × 5 états, en % |
| `NAME_BANKS` | Préfixes, suffixes et qualificatifs par continent |
| `CROP_CLIMATE` | Profil agroclimatique des 17 cultures (T° optimale, besoin en eau, fenêtre de semis, vernalisation) |
| `climateYieldFactor()` | Facteur de rendement décomposé (thermique, hydrique, photopériode, aptitude, fertilité, fenêtre, gel) |
| `regionalYieldMultiplier()` | Le même, normalisé par culture sur une échelle 0–1 |

</details>

```ts
/**
 * Couche climatique du monde imaginaire de Farming Navigator.
 *
 * Complète `world.ts` : mêmes continents, mêmes codes de région, mêmes villes.
 * On y ajoute la climatologie fine (Köppen exact, températures et pluies par
 * saison locale), les aléas, le générateur toponymique et la formule de
 * rendement climat × saison × hémisphère.
 *
 * @see docs/research/34_WORLD_GEOGRAPHY.md
 */

import type { WeatherState } from "./index.js";
import type { Difficulty, Hemisphere, Season } from "./world.js";

/* ------------------------------------------------------------------ */
/* 1. Types                                                            */
/* ------------------------------------------------------------------ */

export const SEASON_ORDER: readonly Season[] = [
  "SPRING",
  "SUMMER",
  "AUTUMN",
  "WINTER",
] as const;

/** Sous-ensemble Köppen-Geiger utilisé par le monde FARMSIM. */
export type KoppenCode =
  | "Af"
  | "Am"
  | "Aw"
  | "BWh"
  | "BWk"
  | "BSh"
  | "BSk"
  | "Csa"
  | "Csb"
  | "Cfa"
  | "Cfb"
  | "Cfc"
  | "Cwa"
  | "Cwb"
  | "Dfa"
  | "Dfb"
  | "Dfc"
  | "Dwa"
  | "ET";

export const KOPPEN_LABELS: Record<KoppenCode, string> = {
  Af: "Équatorial humide",
  Am: "Tropical de mousson",
  Aw: "Tropical de savane (hiver sec)",
  BWh: "Désertique chaud",
  BWk: "Désertique froid",
  BSh: "Steppique chaud",
  BSk: "Steppique froid",
  Csa: "Méditerranéen à été chaud",
  Csb: "Méditerranéen à été tempéré",
  Cfa: "Subtropical humide",
  Cfb: "Océanique tempéré",
  Cfc: "Océanique subpolaire",
  Cwa: "Subtropical à hiver sec",
  Cwb: "Subtropical d'altitude à hiver sec",
  Dfa: "Continental à été chaud",
  Dfb: "Continental à été tempéré",
  Dfc: "Subarctique (taïga)",
  Dwa: "Continental à hiver sec (mousson)",
  ET: "Toundra",
};

/** Cultures du monde. WHEAT/MAIZE existent déjà dans `CROP_DEFS` (MVP). */
export type WorldCropCode =
  | "WHEAT"
  | "MAIZE"
  | "BARLEY"
  | "RAPESEED"
  | "SOY"
  | "SUNFLOWER"
  | "POTATO"
  | "RICE"
  | "SORGHUM"
  | "MILLET"
  | "COTTON"
  | "SUGARCANE"
  | "CASSAVA"
  | "COFFEE"
  | "VINE"
  | "OLIVE"
  | "ALFALFA";

export type Hazard =
  | "LATE_FROST"
  | "FROST"
  | "HAIL"
  | "DROUGHT"
  | "FLOOD"
  | "STORM"
  | "WINDSTORM"
  | "HEATWAVE"
  | "BLIZZARD"
  | "DUST_STORM"
  | "WILDFIRE"
  | "CYCLONE"
  | "MONSOON_DELAY"
  | "PEST";

export const HAZARD_LABELS: Record<Hazard, string> = {
  LATE_FROST: "Gel tardif",
  FROST: "Gel",
  HAIL: "Grêle",
  DROUGHT: "Sécheresse",
  FLOOD: "Inondation",
  STORM: "Orage",
  WINDSTORM: "Tempête de vent",
  HEATWAVE: "Canicule",
  BLIZZARD: "Blizzard",
  DUST_STORM: "Tempête de poussière",
  WILDFIRE: "Incendie",
  CYCLONE: "Cyclone",
  MONSOON_DELAY: "Mousson retardée",
  PEST: "Ravageurs / maladies",
};

export type ContinentCode = "AUR" | "KOR" | "SAV" | "MER" | "YAN" | "AUS";

export interface Continent {
  code: ContinentCode;
  name: string;
  /** Pitch éditorial affiché à la sélection de départ. */
  mood: string;
  hemisphere: Hemisphere;
  /** Bornes de latitude signées (négatif = sud). */
  latRange: [number, number];
  dominantKoppen: KoppenCode;
  /** Palette UI : [terres, accent, ombre] en hex. */
  palette: [string, string, string];
  difficulty: Difficulty;
  /** Multiplicateur foncier du continent (référence 1.0 = Auralie). */
  priceMult: number;
}

export interface CropAptitude {
  crop: WorldCropCode;
  /** Aptitude agronomique régionale 0–1 (0.9+ = terroir de référence). */
  aptitude: number;
}

export interface Region {
  code: string;
  continent: ContinentCode;
  name: string;
  /** Ville-marché : hub de vente, de contrats ETA et de recrutement. */
  city: string;
  koppen: KoppenCode;
  /** Latitude signée du centroïde (négatif = sud). */
  lat: number;
  hemisphere: Hemisphere;
  /** Régime tropical à deux saisons (humide / sèche) plutôt qu'à quatre. */
  equatorial: boolean;
  /** Température moyenne (°C) par saison LOCALE. */
  tempBySeason: Record<Season, number>;
  /** Cumul de précipitations (mm) par saison LOCALE. */
  rainBySeason: Record<Season, number>;
  annualRainfallMm: number;
  /** Fertilité de base du sol, 0–1. */
  fertility: number;
  crops: CropAptitude[];
  hazards: Hazard[];
  /** Multiplicateur de prix foncier régional. */
  priceMult: number;
  /** Irrigation indispensable pour une agriculture rentable. */
  irrigationRequired: boolean;
  flavor: string;
}

/* ------------------------------------------------------------------ */
/* 2. Calendrier & saisons                                             */
/* ------------------------------------------------------------------ */

/**
 * Horloge du monde.
 * MVP (valeur en production, cf. `SEASON_DURATION_MS`) : 1 saison = 15 min
 * réelles, l'année complète en 1 h.
 * Cible monde persistant : 1 jour-jeu = 6 h réelles → saison de 28 jours-jeu
 * = 7 jours réels, année de 112 jours-jeu = 28 jours réels.
 */
export const WORLD_CALENDAR = {
  daysPerSeason: 28,
  seasonsPerYear: 4,
  daysPerYear: 112,
  /** Durée réelle d'une saison en MVP `[TEST]` — aligné sur `SEASON_DURATION_MS`. */
  mvpSeasonMs: 15 * 60 * 1000,
  /** Durée réelle d'un jour-jeu en monde persistant `[GD]`. */
  liveMsPerGameDay: 6 * 60 * 60 * 1000,
} as const;

/** Décale une saison de référence (hémisphère nord) vers la saison locale. */
export function localSeason(reference: Season, hemisphere: Hemisphere): Season {
  if (hemisphere !== "S") return reference;
  const i = SEASON_ORDER.indexOf(reference);
  return SEASON_ORDER[(i + 2) % 4] as Season;
}

/** Saison locale au jour-jeu absolu (jour 0 = 1er jour du printemps nord). */
export function seasonOfDay(gameDay: number, hemisphere: Hemisphere): Season {
  const idx =
    Math.floor(gameDay / WORLD_CALENDAR.daysPerSeason) % WORLD_CALENDAR.seasonsPerYear;
  const wrapped = ((idx % 4) + 4) % 4;
  return localSeason(SEASON_ORDER[wrapped] as Season, hemisphere);
}

/** Régime tropical : les zones A et Cw vivent en saison humide / sèche. */
export type TropicalPhase = "WET" | "DRY" | "TRANSITION";

export function tropicalPhase(koppen: KoppenCode, local: Season): TropicalPhase {
  if (koppen === "Af") return "WET";
  if (koppen === "Am" || koppen === "Aw" || koppen === "Cwa" || koppen === "Cwb") {
    if (local === "SUMMER") return "WET";
    if (local === "WINTER") return "DRY";
    return "TRANSITION";
  }
  return "TRANSITION";
}

/* ------------------------------------------------------------------ */
/* 3. Continents                                                       */
/* ------------------------------------------------------------------ */

export const CONTINENTS: Record<ContinentCode, Continent> = {
  AUR: {
    code: "AUR",
    name: "Auralie",
    mood:
      "Bocages brumeux, clochers d'ardoise et plaines à blé. Le berceau du jeu : pluies " +
      "régulières, gels francs mais prévisibles, marchés liquides.",
    hemisphere: "N",
    latRange: [44, 52],
    dominantKoppen: "Cfb",
    palette: ["#6fae5a", "#a8d98b", "#33552a"],
    difficulty: "EASY",
    priceMult: 1,
  },
  KOR: {
    code: "KOR",
    name: "Kortavie",
    mood:
      "Immensités continentales, silos-cathédrales et hivers qui ferment les routes. " +
      "Rendements d'été énormes, fenêtre de travaux étroite.",
    hemisphere: "N",
    latRange: [37, 56],
    dominantKoppen: "Dfa",
    palette: ["#c9a94e", "#e6cd7f", "#6b5620"],
    difficulty: "MEDIUM",
    priceMult: 0.95,
  },
  SAV: {
    code: "SAV",
    name: "Savannis",
    mood:
      "Savanes à termitières, fleuves en crue et canopée équatoriale. Deux récoltes par " +
      "an pour qui lit le ciel, terre craquelée pour les autres.",
    hemisphere: "S",
    latRange: [-22, -2],
    dominantKoppen: "Aw",
    palette: ["#d9944a", "#f0bd7e", "#7a4a1c"],
    difficulty: "MEDIUM",
    priceMult: 0.75,
  },
  MER: {
    code: "MER",
    name: "Méridie",
    mood:
      "Terrasses d'oliviers, ergs ocres et fleuves-oasis. L'eau est la vraie monnaie ; " +
      "les cultures d'hiver y sont la norme.",
    hemisphere: "N",
    latRange: [27, 40],
    dominantKoppen: "Csa",
    palette: ["#cf7f4f", "#eba97a", "#71391c"],
    difficulty: "HARD",
    priceMult: 1.1,
  },
  YAN: {
    code: "YAN",
    name: "Yanashi",
    mood:
      "Moussons, deltas de rizières et typhons de fin d'été. L'eau ne manque jamais, " +
      "le calendrier ne pardonne rien.",
    hemisphere: "N",
    latRange: [8, 44],
    dominantKoppen: "Cfa",
    palette: ["#5fae86", "#95d9b4", "#28553d"],
    difficulty: "MEDIUM",
    priceMult: 1.05,
  },
  AUS: {
    code: "AUS",
    name: "Australis",
    mood:
      "Quand le nord dort sous la neige, Australis moissonne. Terre âpre, vent constant, " +
      "et la clé de l'arbitrage mondial.",
    hemisphere: "S",
    latRange: [-55, -25],
    dominantKoppen: "BSk",
    palette: ["#b98c5e", "#dcb98c", "#5e432a"],
    difficulty: "HARD",
    priceMult: 0.9,
  },
};

/* ------------------------------------------------------------------ */
/* 4. Régions                                                          */
/* ------------------------------------------------------------------ */

export const REGIONS: Region[] = [
  /* ---------------- AURALIE — tempéré océanique, hémisphère nord ---------------- */
  {
    code: "AUR-VALBLE",
    continent: "AUR",
    name: "Val-de-Blé",
    city: "Meunelle",
    koppen: "Cfb",
    lat: 48.6,
    hemisphere: "N",
    equatorial: false,
    tempBySeason: { SPRING: 11, SUMMER: 19, AUTUMN: 12, WINTER: 4 },
    rainBySeason: { SPRING: 160, SUMMER: 170, AUTUMN: 175, WINTER: 155 },
    annualRainfallMm: 660,
    fertility: 0.82,
    crops: [
      { crop: "WHEAT", aptitude: 0.95 },
      { crop: "RAPESEED", aptitude: 0.88 },
      { crop: "BARLEY", aptitude: 0.85 },
      { crop: "MAIZE", aptitude: 0.62 },
    ],
    hazards: ["LATE_FROST", "HAIL", "STORM"],
    priceMult: 1.0,
    irrigationRequired: false,
    flavor:
      "Limons profonds sans un caillou : la plaine-école du jeu, où rater une récolte " +
      "relève de la faute de gestion et non du climat.",
  },
  {
    code: "AUR-BRUMES",
    continent: "AUR",
    name: "Côte des Brumes",
    city: "Portvarne",
    koppen: "Cfb",
    lat: 50.4,
    hemisphere: "N",
    equatorial: false,
    tempBySeason: { SPRING: 10, SUMMER: 17, AUTUMN: 12, WINTER: 5 },
    rainBySeason: { SPRING: 220, SUMMER: 200, AUTUMN: 280, WINTER: 250 },
    annualRainfallMm: 950,
    fertility: 0.74,
    crops: [
      { crop: "ALFALFA", aptitude: 0.9 },
      { crop: "BARLEY", aptitude: 0.8 },
      { crop: "POTATO", aptitude: 0.78 },
      { crop: "WHEAT", aptitude: 0.7 },
    ],
    hazards: ["FLOOD", "STORM", "PEST"],
    priceMult: 0.9,
    irrigationRequired: false,
    flavor:
      "Prairies permanentes sous crachin marin : pays d'élevage laitier où toute récolte " +
      "de grain passe par le séchoir.",
  },
  {
    code: "AUR-COLLINES",
    continent: "AUR",
    name: "Hautes-Collines",
    city: "Cranmont",
    koppen: "Cfb",
    lat: 46.2,
    hemisphere: "N",
    equatorial: false,
    tempBySeason: { SPRING: 9, SUMMER: 17, AUTUMN: 10, WINTER: 1 },
    rainBySeason: { SPRING: 260, SUMMER: 230, AUTUMN: 290, WINTER: 270 },
    annualRainfallMm: 1050,
    fertility: 0.68,
    crops: [
      { crop: "ALFALFA", aptitude: 0.86 },
      { crop: "BARLEY", aptitude: 0.74 },
      { crop: "POTATO", aptitude: 0.72 },
      { crop: "WHEAT", aptitude: 0.66 },
    ],
    hazards: ["LATE_FROST", "HAIL", "WINDSTORM"],
    priceMult: 0.85,
    irrigationRequired: false,
    flavor:
      "L'altitude raccourcit la saison de trois semaines ; on y monte les troupeaux " +
      "plutôt qu'on n'y sème.",
  },
  {
    code: "AUR-ORVAL",
    continent: "AUR",
    name: "Bassin d'Orval",
    city: "Sainte-Grange",
    koppen: "Cfb",
    lat: 47.4,
    hemisphere: "N",
    equatorial: false,
    tempBySeason: { SPRING: 10, SUMMER: 19, AUTUMN: 11, WINTER: 2 },
    rainBySeason: { SPRING: 180, SUMMER: 210, AUTUMN: 190, WINTER: 160 },
    annualRainfallMm: 740,
    fertility: 0.86,
    crops: [
      { crop: "WHEAT", aptitude: 0.93 },
      { crop: "MAIZE", aptitude: 0.8 },
      { crop: "RAPESEED", aptitude: 0.85 },
      { crop: "BARLEY", aptitude: 0.8 },
    ],
    hazards: ["LATE_FROST", "DROUGHT", "HAIL"],
    priceMult: 1.2,
    irrigationRequired: false,
    flavor:
      "Les terres les plus riches du continent, donc les plus disputées : le foncier " +
      "y monte plus vite que les rendements.",
  },
  {
    code: "AUR-MARAIS",
    continent: "AUR",
    name: "Marais de Sluvenne",
    city: "Sluvenne",
    koppen: "Cfb",
    lat: 51.3,
    hemisphere: "N",
    equatorial: false,
    tempBySeason: { SPRING: 10, SUMMER: 18, AUTUMN: 12, WINTER: 4 },
    rainBySeason: { SPRING: 180, SUMMER: 200, AUTUMN: 215, WINTER: 185 },
    annualRainfallMm: 780,
    fertility: 0.9,
    crops: [
      { crop: "POTATO", aptitude: 0.94 },
      { crop: "WHEAT", aptitude: 0.9 },
      { crop: "RAPESEED", aptitude: 0.82 },
      { crop: "BARLEY", aptitude: 0.78 },
    ],
    hazards: ["FLOOD", "STORM", "PEST"],
    priceMult: 1.3,
    irrigationRequired: false,
    flavor:
      "Polders gagnés sur la mer : sols de rêve derrière les digues, et une prime " +
      "d'assurance submersion qui rappelle chaque saison où l'on se trouve.",
  },
  {
    code: "AUR-SOLANE",
    continent: "AUR",
    name: "Vallée de Solane",
    city: "Vaubrise",
    koppen: "Cfa",
    lat: 44.1,
    hemisphere: "N",
    equatorial: false,
    tempBySeason: { SPRING: 13, SUMMER: 23, AUTUMN: 15, WINTER: 6 },
    rainBySeason: { SPRING: 210, SUMMER: 150, AUTUMN: 220, WINTER: 170 },
    annualRainfallMm: 750,
    fertility: 0.78,
    crops: [
      { crop: "MAIZE", aptitude: 0.92 },
      { crop: "SUNFLOWER", aptitude: 0.86 },
      { crop: "VINE", aptitude: 0.84 },
      { crop: "WHEAT", aptitude: 0.8 },
    ],
    hazards: ["DROUGHT", "HEATWAVE", "HAIL"],
    priceMult: 1.1,
    irrigationRequired: false,
    flavor:
      "La marche sud d'Auralie, plus lumineuse et plus sèche : le maïs y bat des records " +
      "les années arrosées et ruine les imprudents les autres.",
  },

  /* ---------------- KORTAVIE — continental, hémisphère nord ---------------- */
  {
    code: "KOR-GRANDPLAINE",
    continent: "KOR",
    name: "Grande Plaine",
    city: "Silobourg",
    koppen: "Dfa",
    lat: 41.8,
    hemisphere: "N",
    equatorial: false,
    tempBySeason: { SPRING: 11, SUMMER: 24, AUTUMN: 12, WINTER: -5 },
    rainBySeason: { SPRING: 250, SUMMER: 300, AUTUMN: 180, WINTER: 80 },
    annualRainfallMm: 810,
    fertility: 0.88,
    crops: [
      { crop: "MAIZE", aptitude: 0.95 },
      { crop: "SOY", aptitude: 0.9 },
      { crop: "WHEAT", aptitude: 0.78 },
      { crop: "SUNFLOWER", aptitude: 0.72 },
    ],
    hazards: ["DROUGHT", "HAIL", "STORM"],
    priceMult: 1.15,
    irrigationRequired: false,
    flavor:
      "Terres noires à un mètre de profondeur : le grenier à maïs du monde, à condition " +
      "d'encaisser la sécheresse de fin d'été.",
  },
  {
    code: "KOR-VENTNOIR",
    continent: "KOR",
    name: "Terres de Vent-Noir",
    city: "Rochelame",
    koppen: "BSk",
    lat: 43.5,
    hemisphere: "N",
    equatorial: false,
    tempBySeason: { SPRING: 10, SUMMER: 22, AUTUMN: 9, WINTER: -6 },
    rainBySeason: { SPRING: 120, SUMMER: 130, AUTUMN: 70, WINTER: 40 },
    annualRainfallMm: 360,
    fertility: 0.58,
    crops: [
      { crop: "WHEAT", aptitude: 0.72 },
      { crop: "MILLET", aptitude: 0.7 },
      { crop: "SUNFLOWER", aptitude: 0.66 },
      { crop: "BARLEY", aptitude: 0.66 },
    ],
    hazards: ["DROUGHT", "DUST_STORM", "WINDSTORM"],
    priceMult: 0.6,
    irrigationRequired: true,
    flavor:
      "Steppe à jachère : une année sur deux en repos hydrique, ou bien du pivot " +
      "d'irrigation et une facture d'énergie qui mange la marge.",
  },
  {
    code: "KOR-LACSGELES",
    continent: "KOR",
    name: "Lacs Gelés",
    city: "Fort-Givre",
    koppen: "Dfb",
    lat: 46.9,
    hemisphere: "N",
    equatorial: false,
    tempBySeason: { SPRING: 8, SUMMER: 19, AUTUMN: 8, WINTER: -10 },
    rainBySeason: { SPRING: 180, SUMMER: 240, AUTUMN: 170, WINTER: 110 },
    annualRainfallMm: 700,
    fertility: 0.72,
    crops: [
      { crop: "WHEAT", aptitude: 0.85 },
      { crop: "BARLEY", aptitude: 0.84 },
      { crop: "RAPESEED", aptitude: 0.78 },
      { crop: "POTATO", aptitude: 0.75 },
    ],
    hazards: ["BLIZZARD", "LATE_FROST", "HAIL"],
    priceMult: 0.8,
    irrigationRequired: false,
    flavor:
      "Une seule campagne par an, mais des jours d'été très longs : l'orge de printemps " +
      "y boucle son cycle en 100 jours-jeu.",
  },
  {
    code: "KOR-RIVEDOR",
    continent: "KOR",
    name: "Rive-d'Or",
    city: "Ambremoulin",
    koppen: "Dfa",
    lat: 39.2,
    hemisphere: "N",
    equatorial: false,
    tempBySeason: { SPRING: 13, SUMMER: 25, AUTUMN: 14, WINTER: -2 },
    rainBySeason: { SPRING: 280, SUMMER: 300, AUTUMN: 220, WINTER: 140 },
    annualRainfallMm: 940,
    fertility: 0.84,
    crops: [
      { crop: "MAIZE", aptitude: 0.92 },
      { crop: "SOY", aptitude: 0.88 },
      { crop: "WHEAT", aptitude: 0.8 },
      { crop: "ALFALFA", aptitude: 0.7 },
    ],
    hazards: ["FLOOD", "STORM", "HAIL"],
    priceMult: 1.1,
    irrigationRequired: false,
    flavor:
      "Alluvions d'un grand fleuve : la crue de printemps enrichit les terres basses " +
      "et retarde les semis d'une saison sur trois.",
  },
  {
    code: "KOR-TAIGA",
    continent: "KOR",
    name: "Marches de Taïga",
    city: "Karvenn",
    koppen: "Dfc",
    lat: 55.4,
    hemisphere: "N",
    equatorial: false,
    tempBySeason: { SPRING: 4, SUMMER: 15, AUTUMN: 3, WINTER: -17 },
    rainBySeason: { SPRING: 100, SUMMER: 190, AUTUMN: 110, WINTER: 80 },
    annualRainfallMm: 480,
    fertility: 0.48,
    crops: [
      { crop: "BARLEY", aptitude: 0.7 },
      { crop: "POTATO", aptitude: 0.68 },
      { crop: "ALFALFA", aptitude: 0.6 },
      { crop: "RAPESEED", aptitude: 0.45 },
    ],
    hazards: ["BLIZZARD", "LATE_FROST", "PEST"],
    priceMult: 0.4,
    irrigationRequired: false,
    flavor:
      "Clairières arrachées à la forêt, jours d'été interminables : la photopériode " +
      "compense en partie la brièveté de la fenêtre culturale.",
  },
  {
    code: "KOR-BASSOLEIL",
    continent: "KOR",
    name: "Terres du Bas-Soleil",
    city: "Corneval",
    koppen: "Cfa",
    lat: 37.5,
    hemisphere: "N",
    equatorial: false,
    tempBySeason: { SPRING: 16, SUMMER: 27, AUTUMN: 17, WINTER: 5 },
    rainBySeason: { SPRING: 300, SUMMER: 280, AUTUMN: 250, WINTER: 220 },
    annualRainfallMm: 1050,
    fertility: 0.8,
    crops: [
      { crop: "SOY", aptitude: 0.9 },
      { crop: "COTTON", aptitude: 0.82 },
      { crop: "MAIZE", aptitude: 0.85 },
      { crop: "WHEAT", aptitude: 0.72 },
    ],
    hazards: ["STORM", "HEATWAVE", "PEST"],
    priceMult: 1.0,
    irrigationRequired: false,
    flavor:
      "La transition subtropicale du continent : assez chaude pour une culture " +
      "dérobée après la moisson, assez humide pour tout faire pourrir.",
  },

  /* ---------------- SAVANNIS — tropical, hémisphère sud ---------------- */
  {
    code: "SAV-HERBESHAUTES",
    continent: "SAV",
    name: "Hautes Herbes",
    city: "Kaledoumé",
    koppen: "Aw",
    lat: -11.4,
    hemisphere: "S",
    equatorial: true,
    tempBySeason: { SPRING: 26, SUMMER: 25, AUTUMN: 24, WINTER: 20 },
    rainBySeason: { SPRING: 180, SUMMER: 480, AUTUMN: 230, WINTER: 40 },
    annualRainfallMm: 930,
    fertility: 0.7,
    crops: [
      { crop: "MAIZE", aptitude: 0.85 },
      { crop: "SORGHUM", aptitude: 0.88 },
      { crop: "MILLET", aptitude: 0.84 },
      { crop: "COTTON", aptitude: 0.7 },
    ],
    hazards: ["DROUGHT", "WILDFIRE", "PEST"],
    priceMult: 0.7,
    irrigationRequired: false,
    flavor:
      "Savane arborée où tout se joue sur la date d'installation des pluies : semer " +
      "dix jours trop tôt coûte la parcelle entière.",
  },
  {
    code: "SAV-TERREROUGE",
    continent: "SAV",
    name: "Terre Rouge",
    city: "Nzalé",
    koppen: "Aw",
    lat: -14.8,
    hemisphere: "S",
    equatorial: true,
    tempBySeason: { SPRING: 27, SUMMER: 26, AUTUMN: 24, WINTER: 19 },
    rainBySeason: { SPRING: 150, SUMMER: 430, AUTUMN: 180, WINTER: 30 },
    annualRainfallMm: 790,
    fertility: 0.64,
    crops: [
      { crop: "SOY", aptitude: 0.82 },
      { crop: "MAIZE", aptitude: 0.78 },
      { crop: "SORGHUM", aptitude: 0.8 },
      { crop: "CASSAVA", aptitude: 0.76 },
    ],
    hazards: ["DROUGHT", "WILDFIRE", "PEST"],
    priceMult: 0.6,
    irrigationRequired: false,
    flavor:
      "Sols latéritiques acides à chauler avant tout : sans amendement, la troisième " +
      "récolte consécutive ne paie plus les semences.",
  },
  {
    code: "SAV-GRANDFLEUVE",
    continent: "SAV",
    name: "Grand Fleuve",
    city: "Bahari-Sud",
    koppen: "Am",
    lat: -8.2,
    hemisphere: "S",
    equatorial: true,
    tempBySeason: { SPRING: 28, SUMMER: 27, AUTUMN: 27, WINTER: 25 },
    rainBySeason: { SPRING: 330, SUMMER: 760, AUTUMN: 470, WINTER: 160 },
    annualRainfallMm: 1720,
    fertility: 0.87,
    crops: [
      { crop: "RICE", aptitude: 0.94 },
      { crop: "SUGARCANE", aptitude: 0.9 },
      { crop: "MAIZE", aptitude: 0.75 },
      { crop: "CASSAVA", aptitude: 0.7 },
    ],
    hazards: ["FLOOD", "STORM", "MONSOON_DELAY"],
    priceMult: 1.05,
    irrigationRequired: false,
    flavor:
      "Delta extrêmement fertile où la mousson fait la récolte : deux cycles de riz " +
      "par an, et un orage de trop qui en emporte un.",
  },
  {
    code: "SAV-PLATEAUX",
    continent: "SAV",
    name: "Plateaux d'Ombre",
    city: "Tessaran",
    koppen: "Cwb",
    lat: -17.5,
    hemisphere: "S",
    equatorial: true,
    tempBySeason: { SPRING: 19, SUMMER: 20, AUTUMN: 17, WINTER: 13 },
    rainBySeason: { SPRING: 220, SUMMER: 430, AUTUMN: 230, WINTER: 60 },
    annualRainfallMm: 940,
    fertility: 0.76,
    crops: [
      { crop: "COFFEE", aptitude: 0.93 },
      { crop: "MAIZE", aptitude: 0.82 },
      { crop: "POTATO", aptitude: 0.78 },
      { crop: "WHEAT", aptitude: 0.7 },
    ],
    hazards: ["HAIL", "FROST", "DROUGHT"],
    priceMult: 0.85,
    irrigationRequired: false,
    flavor:
      "L'altitude annule la latitude : nuits fraîches, café d'altitude, et un gel de " +
      "radiation possible sous les tropiques.",
  },
  {
    code: "SAV-CANOPEE",
    continent: "SAV",
    name: "Canopée de Mbaraka",
    city: "Mbaraka",
    koppen: "Af",
    lat: -2.1,
    hemisphere: "S",
    equatorial: true,
    tempBySeason: { SPRING: 26, SUMMER: 26, AUTUMN: 27, WINTER: 26 },
    rainBySeason: { SPRING: 550, SUMMER: 530, AUTUMN: 580, WINTER: 500 },
    annualRainfallMm: 2160,
    fertility: 0.45,
    crops: [
      { crop: "CASSAVA", aptitude: 0.9 },
      { crop: "RICE", aptitude: 0.82 },
      { crop: "SUGARCANE", aptitude: 0.78 },
      { crop: "MAIZE", aptitude: 0.55 },
    ],
    hazards: ["FLOOD", "PEST", "STORM"],
    priceMult: 0.55,
    irrigationRequired: false,
    flavor:
      "Pas de saison sèche du tout : on cultive toute l'année sur des latérites " +
      "lessivées, et la pression des ravageurs ne retombe jamais.",
  },
  {
    code: "SAV-EPINES",
    continent: "SAV",
    name: "Brousse d'Épines",
    city: "Zawadhun",
    koppen: "BSh",
    lat: -21.3,
    hemisphere: "S",
    equatorial: false,
    tempBySeason: { SPRING: 24, SUMMER: 26, AUTUMN: 21, WINTER: 15 },
    rainBySeason: { SPRING: 60, SUMMER: 140, AUTUMN: 50, WINTER: 20 },
    annualRainfallMm: 270,
    fertility: 0.4,
    crops: [
      { crop: "MILLET", aptitude: 0.7 },
      { crop: "SORGHUM", aptitude: 0.68 },
      { crop: "BARLEY", aptitude: 0.55 },
      { crop: "ALFALFA", aptitude: 0.5 },
    ],
    hazards: ["DROUGHT", "DUST_STORM", "HEATWAVE"],
    priceMult: 0.35,
    irrigationRequired: true,
    flavor:
      "La marge aride du continent : élevage extensif, mil de survie, et des hectares " +
      "à prix dérisoire pour qui accepte le pari de l'irrigation.",
  },

  /* ---------------- MÉRIDIE — méditerranéen / aride, hémisphère nord ---------------- */
  {
    code: "MER-OLIVERAIE",
    continent: "MER",
    name: "Grande Oliveraie",
    city: "Calathée",
    koppen: "Csa",
    lat: 37.4,
    hemisphere: "N",
    equatorial: false,
    tempBySeason: { SPRING: 15, SUMMER: 27, AUTUMN: 18, WINTER: 9 },
    rainBySeason: { SPRING: 130, SUMMER: 30, AUTUMN: 180, WINTER: 180 },
    annualRainfallMm: 520,
    fertility: 0.72,
    crops: [
      { crop: "OLIVE", aptitude: 0.94 },
      { crop: "VINE", aptitude: 0.9 },
      { crop: "WHEAT", aptitude: 0.78 },
      { crop: "BARLEY", aptitude: 0.74 },
    ],
    hazards: ["DROUGHT", "WILDFIRE", "HEATWAVE"],
    priceMult: 1.25,
    irrigationRequired: false,
    flavor:
      "Terrasses de pierre sèche : le semis d'automne est obligatoire, l'été est " +
      "agronomiquement mort et sert à entretenir le matériel.",
  },
  {
    code: "MER-SELBLANC",
    continent: "MER",
    name: "Plaine de Sel Blanc",
    city: "Ourmiane",
    koppen: "BWh",
    lat: 31.1,
    hemisphere: "N",
    equatorial: false,
    tempBySeason: { SPRING: 23, SUMMER: 36, AUTUMN: 25, WINTER: 12 },
    rainBySeason: { SPRING: 20, SUMMER: 5, AUTUMN: 25, WINTER: 30 },
    annualRainfallMm: 80,
    fertility: 0.42,
    crops: [
      { crop: "ALFALFA", aptitude: 0.6 },
      { crop: "WHEAT", aptitude: 0.55 },
      { crop: "COTTON", aptitude: 0.5 },
    ],
    hazards: ["DROUGHT", "DUST_STORM", "HEATWAVE"],
    priceMult: 0.45,
    irrigationRequired: true,
    flavor:
      "Cercles verts de pivots posés sur l'ocre : sans nappe fossile rien ne pousse, " +
      "avec elle trois coupes de luzerne par an.",
  },
  {
    code: "MER-DEUXVENTS",
    continent: "MER",
    name: "Cap des Deux-Vents",
    city: "Port-Alcaze",
    koppen: "Csa",
    lat: 39.6,
    hemisphere: "N",
    equatorial: false,
    tempBySeason: { SPRING: 14, SUMMER: 25, AUTUMN: 17, WINTER: 9 },
    rainBySeason: { SPRING: 150, SUMMER: 40, AUTUMN: 210, WINTER: 200 },
    annualRainfallMm: 600,
    fertility: 0.79,
    crops: [
      { crop: "VINE", aptitude: 0.92 },
      { crop: "WHEAT", aptitude: 0.82 },
      { crop: "SUNFLOWER", aptitude: 0.74 },
      { crop: "OLIVE", aptitude: 0.72 },
    ],
    hazards: ["WINDSTORM", "HAIL", "DROUGHT"],
    priceMult: 1.35,
    irrigationRequired: false,
    flavor:
      "Deux vents s'y croisent : ils assèchent les maladies, couchent les tournesols, " +
      "et le port offre les meilleures primes de vente du monde.",
  },
  {
    code: "MER-OASIS",
    continent: "MER",
    name: "Oasis de Zerán",
    city: "Zerán",
    koppen: "BSh",
    lat: 29.4,
    hemisphere: "N",
    equatorial: false,
    tempBySeason: { SPRING: 21, SUMMER: 33, AUTUMN: 23, WINTER: 12 },
    rainBySeason: { SPRING: 45, SUMMER: 15, AUTUMN: 60, WINTER: 80 },
    annualRainfallMm: 200,
    fertility: 0.61,
    crops: [
      { crop: "BARLEY", aptitude: 0.7 },
      { crop: "MILLET", aptitude: 0.66 },
      { crop: "COTTON", aptitude: 0.62 },
      { crop: "MAIZE", aptitude: 0.58 },
    ],
    hazards: ["DROUGHT", "DUST_STORM", "HEATWAVE"],
    priceMult: 0.7,
    irrigationRequired: true,
    flavor:
      "Nappe limitée, parcelles petites mais sûres : la seule région du continent où " +
      "le rendement ne dépend pas du ciel, seulement du quota d'eau.",
  },
  {
    code: "MER-CEDRES",
    continent: "MER",
    name: "Monts des Cèdres",
    city: "Cedravel",
    koppen: "Csb",
    lat: 35.8,
    hemisphere: "N",
    equatorial: false,
    tempBySeason: { SPRING: 12, SUMMER: 22, AUTUMN: 14, WINTER: 4 },
    rainBySeason: { SPRING: 200, SUMMER: 60, AUTUMN: 260, WINTER: 260 },
    annualRainfallMm: 780,
    fertility: 0.58,
    crops: [
      { crop: "VINE", aptitude: 0.86 },
      { crop: "POTATO", aptitude: 0.76 },
      { crop: "BARLEY", aptitude: 0.72 },
      { crop: "OLIVE", aptitude: 0.68 },
    ],
    hazards: ["LATE_FROST", "HAIL", "WILDFIRE"],
    priceMult: 0.8,
    irrigationRequired: false,
    flavor:
      "Amplitude thermique et nuits fraîches : le terroir qualitatif de Méridie, avec " +
      "des parcelles en pente qui usent le matériel deux fois plus vite.",
  },
  {
    code: "MER-LIMON",
    continent: "MER",
    name: "Limon de Serapha",
    city: "Serapha",
    koppen: "BWh",
    lat: 27.8,
    hemisphere: "N",
    equatorial: false,
    tempBySeason: { SPRING: 22, SUMMER: 35, AUTUMN: 25, WINTER: 13 },
    rainBySeason: { SPRING: 20, SUMMER: 10, AUTUMN: 25, WINTER: 35 },
    annualRainfallMm: 90,
    fertility: 0.88,
    crops: [
      { crop: "WHEAT", aptitude: 0.9 },
      { crop: "COTTON", aptitude: 0.86 },
      { crop: "RICE", aptitude: 0.8 },
      { crop: "MAIZE", aptitude: 0.78 },
    ],
    hazards: ["FLOOD", "HEATWAVE", "PEST"],
    priceMult: 1.3,
    irrigationRequired: true,
    flavor:
      "Le limon d'un grand fleuve traversant le désert : fertilité maximale du " +
      "continent, à condition de vivre au rythme de la crue.",
  },

  /* ---------------- YANASHI — moussons, hémisphère nord ---------------- */
  {
    code: "YAN-DELTAJADE",
    continent: "YAN",
    name: "Delta de Jade",
    city: "Shirogawa",
    koppen: "Cfa",
    lat: 30.8,
    hemisphere: "N",
    equatorial: false,
    tempBySeason: { SPRING: 17, SUMMER: 27, AUTUMN: 19, WINTER: 6 },
    rainBySeason: { SPRING: 350, SUMMER: 520, AUTUMN: 280, WINTER: 150 },
    annualRainfallMm: 1300,
    fertility: 0.9,
    crops: [
      { crop: "RICE", aptitude: 0.96 },
      { crop: "MAIZE", aptitude: 0.85 },
      { crop: "SOY", aptitude: 0.8 },
      { crop: "WHEAT", aptitude: 0.74 },
    ],
    hazards: ["CYCLONE", "FLOOD", "PEST"],
    priceMult: 1.4,
    irrigationRequired: false,
    flavor:
      "Les meilleures terres du monde, et le typhon de fin d'été qui vient les " +
      "réclamer : double culture riz puis blé pour qui sait moissonner vite.",
  },
  {
    code: "YAN-COLLINESTHE",
    continent: "YAN",
    name: "Collines du Thé",
    city: "Rin-No-Sato",
    koppen: "Cwa",
    lat: 27.2,
    hemisphere: "N",
    equatorial: false,
    tempBySeason: { SPRING: 19, SUMMER: 27, AUTUMN: 20, WINTER: 9 },
    rainBySeason: { SPRING: 380, SUMMER: 620, AUTUMN: 300, WINTER: 100 },
    annualRainfallMm: 1400,
    fertility: 0.78,
    crops: [
      { crop: "RICE", aptitude: 0.88 },
      { crop: "COFFEE", aptitude: 0.8 },
      { crop: "MAIZE", aptitude: 0.78 },
      { crop: "SUGARCANE", aptitude: 0.72 },
    ],
    hazards: ["FLOOD", "PEST", "STORM"],
    priceMult: 1.0,
    irrigationRequired: false,
    flavor:
      "Terrasses en pente : chaque passage machine y prend 30 % de temps en plus, mais " +
      "l'hiver sec sécurise la récolte.",
  },
  {
    code: "YAN-STEPPENORD",
    continent: "YAN",
    name: "Steppe du Nord",
    city: "Baltunn",
    koppen: "Dwa",
    lat: 43.7,
    hemisphere: "N",
    equatorial: false,
    tempBySeason: { SPRING: 10, SUMMER: 23, AUTUMN: 10, WINTER: -13 },
    rainBySeason: { SPRING: 95, SUMMER: 385, AUTUMN: 100, WINTER: 20 },
    annualRainfallMm: 600,
    fertility: 0.66,
    crops: [
      { crop: "MAIZE", aptitude: 0.82 },
      { crop: "SOY", aptitude: 0.78 },
      { crop: "WHEAT", aptitude: 0.7 },
      { crop: "MILLET", aptitude: 0.66 },
    ],
    hazards: ["BLIZZARD", "LATE_FROST", "DROUGHT"],
    priceMult: 0.65,
    irrigationRequired: false,
    flavor:
      "Hiver glacial et parfaitement sec : 64 % de la pluie annuelle tombe en une " +
      "seule saison, tout le calendrier en découle.",
  },
  {
    code: "YAN-ILESPERLE",
    continent: "YAN",
    name: "Îles de Perle",
    city: "Amitsu",
    koppen: "Am",
    lat: 21.4,
    hemisphere: "N",
    equatorial: false,
    tempBySeason: { SPRING: 25, SUMMER: 28, AUTUMN: 26, WINTER: 19 },
    rainBySeason: { SPRING: 300, SUMMER: 900, AUTUMN: 450, WINTER: 150 },
    annualRainfallMm: 1800,
    fertility: 0.83,
    crops: [
      { crop: "RICE", aptitude: 0.94 },
      { crop: "SUGARCANE", aptitude: 0.9 },
      { crop: "CASSAVA", aptitude: 0.72 },
      { crop: "MAIZE", aptitude: 0.7 },
    ],
    hazards: ["CYCLONE", "FLOOD", "MONSOON_DELAY"],
    priceMult: 1.15,
    irrigationRequired: false,
    flavor:
      "Climat généreux, logistique insulaire coûteuse : chaque tonne exportée paie " +
      "son passage, chaque cyclone paie son dû.",
  },
  {
    code: "YAN-HAUTSNEIGES",
    continent: "YAN",
    name: "Hauts de Neige-Bleue",
    city: "Yukimine",
    koppen: "Dfb",
    lat: 39.4,
    hemisphere: "N",
    equatorial: false,
    tempBySeason: { SPRING: 10, SUMMER: 22, AUTUMN: 11, WINTER: -4 },
    rainBySeason: { SPRING: 230, SUMMER: 330, AUTUMN: 260, WINTER: 180 },
    annualRainfallMm: 1000,
    fertility: 0.7,
    crops: [
      { crop: "BARLEY", aptitude: 0.82 },
      { crop: "POTATO", aptitude: 0.8 },
      { crop: "WHEAT", aptitude: 0.76 },
      { crop: "RAPESEED", aptitude: 0.7 },
    ],
    hazards: ["BLIZZARD", "LATE_FROST", "HAIL"],
    priceMult: 0.75,
    irrigationRequired: false,
    flavor:
      "Vallées enneigées cinq mois par an : la fonte irrigue naturellement les semis " +
      "de printemps, le blizzard coupe les livraisons.",
  },
  {
    code: "YAN-BAIECORAIL",
    continent: "YAN",
    name: "Baie de Corail",
    city: "Tsumaru",
    koppen: "Af",
    lat: 8.6,
    hemisphere: "N",
    equatorial: true,
    tempBySeason: { SPRING: 27, SUMMER: 27, AUTUMN: 27, WINTER: 26 },
    rainBySeason: { SPRING: 520, SUMMER: 560, AUTUMN: 620, WINTER: 500 },
    annualRainfallMm: 2200,
    fertility: 0.52,
    crops: [
      { crop: "CASSAVA", aptitude: 0.86 },
      { crop: "SUGARCANE", aptitude: 0.84 },
      { crop: "RICE", aptitude: 0.8 },
      { crop: "COFFEE", aptitude: 0.6 },
    ],
    hazards: ["FLOOD", "PEST", "CYCLONE"],
    priceMult: 0.6,
    irrigationRequired: false,
    flavor:
      "Équatorial pur : aucune saison morte, trois cycles courts possibles, et une " +
      "fertilité qui s'effondre si l'on ne rend rien au sol.",
  },

  /* ---------------- AUSTRALIS — austral, hémisphère sud ---------------- */
  {
    code: "AUS-BLEDESUD",
    continent: "AUS",
    name: "Ceinture du Blé-Sud",
    city: "Warrindal",
    koppen: "BSk",
    lat: -33.6,
    hemisphere: "S",
    equatorial: false,
    tempBySeason: { SPRING: 15, SUMMER: 24, AUTUMN: 15, WINTER: 8 },
    rainBySeason: { SPRING: 90, SUMMER: 70, AUTUMN: 110, WINTER: 130 },
    annualRainfallMm: 400,
    fertility: 0.62,
    crops: [
      { crop: "WHEAT", aptitude: 0.8 },
      { crop: "BARLEY", aptitude: 0.78 },
      { crop: "RAPESEED", aptitude: 0.7 },
      { crop: "ALFALFA", aptitude: 0.62 },
    ],
    hazards: ["DROUGHT", "WINDSTORM", "HEATWAVE"],
    priceMult: 0.7,
    irrigationRequired: false,
    flavor:
      "Grandes surfaces bon marché et pluviométrie erratique : on y sème large en " +
      "sachant qu'une année sur quatre ne rentrera pas.",
  },
  {
    code: "AUS-VALLEEVERTE",
    continent: "AUS",
    name: "Vallée Verte",
    city: "Tamerook",
    koppen: "Cfb",
    lat: -38.1,
    hemisphere: "S",
    equatorial: false,
    tempBySeason: { SPRING: 13, SUMMER: 19, AUTUMN: 14, WINTER: 8 },
    rainBySeason: { SPRING: 170, SUMMER: 140, AUTUMN: 200, WINTER: 210 },
    annualRainfallMm: 720,
    fertility: 0.85,
    crops: [
      { crop: "WHEAT", aptitude: 0.9 },
      { crop: "BARLEY", aptitude: 0.86 },
      { crop: "RAPESEED", aptitude: 0.82 },
      { crop: "ALFALFA", aptitude: 0.8 },
    ],
    hazards: ["LATE_FROST", "STORM", "HAIL"],
    priceMult: 1.2,
    irrigationRequired: false,
    flavor:
      "Jumeau climatique du Val-de-Blé à six mois de décalage : la même moissonneuse " +
      "peut servir deux fois par an si l'on assume le transport.",
  },
  {
    code: "AUS-ROCHEROUGE",
    continent: "AUS",
    name: "Roche Rouge",
    city: "Kalgarra",
    koppen: "BWh",
    lat: -25.9,
    hemisphere: "S",
    equatorial: false,
    tempBySeason: { SPRING: 26, SUMMER: 34, AUTUMN: 24, WINTER: 14 },
    rainBySeason: { SPRING: 40, SUMMER: 60, AUTUMN: 30, WINTER: 20 },
    annualRainfallMm: 150,
    fertility: 0.38,
    crops: [
      { crop: "ALFALFA", aptitude: 0.52 },
      { crop: "SORGHUM", aptitude: 0.48 },
      { crop: "WHEAT", aptitude: 0.4 },
    ],
    hazards: ["DROUGHT", "DUST_STORM", "HEATWAVE"],
    priceMult: 0.35,
    irrigationRequired: true,
    flavor:
      "Quasi-désert réservé aux joueurs qui irriguent : le foncier le moins cher du " +
      "monde, et la facture d'eau la plus lourde.",
  },
  {
    code: "AUS-CAPAUSTRAL",
    continent: "AUS",
    name: "Cap Austral",
    city: "Fjordhaven",
    koppen: "Cfc",
    lat: -44.2,
    hemisphere: "S",
    equatorial: false,
    tempBySeason: { SPRING: 9, SUMMER: 14, AUTUMN: 10, WINTER: 5 },
    rainBySeason: { SPRING: 300, SUMMER: 260, AUTUMN: 330, WINTER: 320 },
    annualRainfallMm: 1210,
    fertility: 0.55,
    crops: [
      { crop: "ALFALFA", aptitude: 0.84 },
      { crop: "POTATO", aptitude: 0.72 },
      { crop: "BARLEY", aptitude: 0.6 },
      { crop: "WHEAT", aptitude: 0.5 },
    ],
    hazards: ["STORM", "WINDSTORM", "FLOOD"],
    priceMult: 0.5,
    irrigationRequired: false,
    flavor:
      "Saison très courte et pluie horizontale : élevage plutôt que cultures, et un " +
      "séchage obligatoire sur tout ce qui se moissonne.",
  },
  {
    code: "AUS-SOLIVERA",
    continent: "AUS",
    name: "Coteaux de Solivera",
    city: "Solivera",
    koppen: "Csb",
    lat: -34.8,
    hemisphere: "S",
    equatorial: false,
    tempBySeason: { SPRING: 14, SUMMER: 22, AUTUMN: 15, WINTER: 8 },
    rainBySeason: { SPRING: 110, SUMMER: 40, AUTUMN: 180, WINTER: 220 },
    annualRainfallMm: 550,
    fertility: 0.64,
    crops: [
      { crop: "VINE", aptitude: 0.93 },
      { crop: "OLIVE", aptitude: 0.82 },
      { crop: "WHEAT", aptitude: 0.72 },
      { crop: "SUNFLOWER", aptitude: 0.66 },
    ],
    hazards: ["DROUGHT", "WILDFIRE", "LATE_FROST"],
    priceMult: 1.0,
    irrigationRequired: true,
    flavor:
      "Vallées adossées à une cordillère, irriguées par la fonte des neiges : le miroir " +
      "austral de la Grande Oliveraie, et son partenaire d'arbitrage naturel.",
  },
  {
    code: "AUS-NYVARDEN",
    continent: "AUS",
    name: "Rives de Nyvarden",
    city: "Nyvarden",
    koppen: "ET",
    lat: -54.6,
    hemisphere: "S",
    equatorial: false,
    tempBySeason: { SPRING: 3, SUMMER: 8, AUTUMN: 3, WINTER: -3 },
    rainBySeason: { SPRING: 120, SUMMER: 130, AUTUMN: 130, WINTER: 120 },
    annualRainfallMm: 500,
    fertility: 0.22,
    crops: [
      { crop: "POTATO", aptitude: 0.45 },
      { crop: "BARLEY", aptitude: 0.35 },
      { crop: "ALFALFA", aptitude: 0.3 },
    ],
    hazards: ["BLIZZARD", "FROST", "WINDSTORM"],
    priceMult: 0.18,
    irrigationRequired: false,
    flavor:
      "Toundra à lichens : culture sous serre uniquement, mais un marché local captif " +
      "où la pomme de terre se vend au prix du blé de qualité meunière.",
  },
];

export const REGIONS_BY_CODE: Record<string, Region> = Object.fromEntries(
  REGIONS.map((r) => [r.code, r]),
);

export function regionsOf(continent: ContinentCode): Region[] {
  return REGIONS.filter((r) => r.continent === continent);
}

/* ------------------------------------------------------------------ */
/* 5. Climat × saison → météo                                          */
/* ------------------------------------------------------------------ */

export type WeatherProbabilities = Record<WeatherState, number>;

function w(
  clear: number,
  cloudy: number,
  rain: number,
  storm: number,
  snow: number,
): WeatherProbabilities {
  return { CLEAR: clear, CLOUDY: cloudy, RAIN: rain, STORM: storm, SNOW: snow };
}

/**
 * Probabilités (en %) de l'état météo du jour, par climat et par saison LOCALE.
 * Chaque ligne somme à 100. Remplace `weatherOdds()` par une table exacte au
 * code Köppen plutôt qu'à la famille.
 */
export const WEATHER_BY_CLIMATE: Record<
  KoppenCode,
  Record<Season, WeatherProbabilities>
> = {
  Af: {
    SPRING: w(20, 34, 36, 10, 0),
    SUMMER: w(18, 34, 38, 10, 0),
    AUTUMN: w(19, 34, 37, 10, 0),
    WINTER: w(22, 35, 34, 9, 0),
  },
  Am: {
    SPRING: w(30, 30, 30, 10, 0),
    SUMMER: w(10, 28, 47, 15, 0),
    AUTUMN: w(18, 30, 42, 10, 0),
    WINTER: w(50, 28, 18, 4, 0),
  },
  Aw: {
    SPRING: w(40, 28, 25, 7, 0),
    SUMMER: w(18, 30, 40, 12, 0),
    AUTUMN: w(35, 30, 28, 7, 0),
    WINTER: w(65, 23, 10, 2, 0),
  },
  BWh: {
    SPRING: w(78, 15, 5, 2, 0),
    SUMMER: w(72, 17, 7, 4, 0),
    AUTUMN: w(80, 14, 5, 1, 0),
    WINTER: w(76, 17, 6, 1, 0),
  },
  BWk: {
    SPRING: w(70, 20, 7, 3, 0),
    SUMMER: w(74, 18, 6, 2, 0),
    AUTUMN: w(72, 20, 7, 1, 0),
    WINTER: w(62, 24, 6, 1, 7),
  },
  BSh: {
    SPRING: w(62, 22, 12, 4, 0),
    SUMMER: w(50, 24, 20, 6, 0),
    AUTUMN: w(64, 22, 12, 2, 0),
    WINTER: w(68, 22, 9, 1, 0),
  },
  BSk: {
    SPRING: w(55, 25, 15, 5, 0),
    SUMMER: w(58, 22, 14, 6, 0),
    AUTUMN: w(60, 24, 14, 2, 0),
    WINTER: w(50, 28, 10, 2, 10),
  },
  Csa: {
    SPRING: w(50, 25, 20, 5, 0),
    SUMMER: w(80, 13, 5, 2, 0),
    AUTUMN: w(42, 26, 26, 6, 0),
    WINTER: w(35, 30, 32, 3, 0),
  },
  Csb: {
    SPRING: w(45, 27, 23, 5, 0),
    SUMMER: w(70, 18, 10, 2, 0),
    AUTUMN: w(35, 28, 32, 5, 0),
    WINTER: w(25, 30, 40, 3, 2),
  },
  Cfa: {
    SPRING: w(38, 27, 27, 8, 0),
    SUMMER: w(40, 24, 25, 11, 0),
    AUTUMN: w(45, 25, 25, 5, 0),
    WINTER: w(35, 30, 30, 3, 2),
  },
  Cfb: {
    SPRING: w(35, 30, 29, 6, 0),
    SUMMER: w(40, 28, 26, 6, 0),
    AUTUMN: w(30, 32, 33, 5, 0),
    WINTER: w(25, 34, 34, 2, 5),
  },
  Cfc: {
    SPRING: w(22, 34, 38, 6, 0),
    SUMMER: w(28, 34, 34, 4, 0),
    AUTUMN: w(20, 34, 40, 4, 2),
    WINTER: w(16, 34, 36, 2, 12),
  },
  Cwa: {
    SPRING: w(42, 26, 26, 6, 0),
    SUMMER: w(22, 28, 38, 12, 0),
    AUTUMN: w(50, 25, 22, 3, 0),
    WINTER: w(66, 22, 11, 1, 0),
  },
  Cwb: {
    SPRING: w(45, 26, 24, 5, 0),
    SUMMER: w(25, 30, 36, 9, 0),
    AUTUMN: w(50, 26, 21, 3, 0),
    WINTER: w(68, 22, 10, 0, 0),
  },
  Dfa: {
    SPRING: w(36, 27, 28, 7, 2),
    SUMMER: w(45, 23, 22, 10, 0),
    AUTUMN: w(42, 28, 25, 3, 2),
    WINTER: w(30, 30, 10, 0, 30),
  },
  Dfb: {
    SPRING: w(34, 28, 28, 6, 4),
    SUMMER: w(42, 26, 24, 8, 0),
    AUTUMN: w(36, 30, 26, 3, 5),
    WINTER: w(24, 30, 7, 0, 39),
  },
  Dfc: {
    SPRING: w(28, 30, 24, 4, 14),
    SUMMER: w(38, 28, 28, 6, 0),
    AUTUMN: w(28, 30, 22, 2, 18),
    WINTER: w(18, 28, 4, 0, 50),
  },
  Dwa: {
    SPRING: w(48, 26, 20, 6, 0),
    SUMMER: w(26, 28, 36, 10, 0),
    AUTUMN: w(55, 25, 17, 2, 1),
    WINTER: w(50, 26, 4, 0, 20),
  },
  ET: {
    SPRING: w(22, 32, 16, 2, 28),
    SUMMER: w(30, 34, 28, 4, 4),
    AUTUMN: w(22, 32, 16, 2, 28),
    WINTER: w(14, 28, 2, 0, 56),
  },
};

const WEATHER_ORDER: readonly WeatherState[] = [
  "CLEAR",
  "CLOUDY",
  "RAIN",
  "STORM",
  "SNOW",
] as const;

/**
 * Tire l'état météo du jour pour une région.
 * `reference` est la saison de l'hémisphère nord ; l'inversion australe est
 * appliquée en interne. `rng` ∈ [0,1).
 */
export function rollWeather(
  region: Region,
  reference: Season,
  rng: number = Math.random(),
): WeatherState {
  const season = localSeason(reference, region.hemisphere);
  const row = WEATHER_BY_CLIMATE[region.koppen][season];
  let acc = 0;
  for (const state of WEATHER_ORDER) {
    acc += row[state] / 100;
    if (rng < acc) return state;
  }
  return "CLEAR";
}

/* ------------------------------------------------------------------ */
/* 6. Générateur de noms                                               */
/* ------------------------------------------------------------------ */

export interface NameBank {
  prefixes: string[];
  suffixes: string[];
  /** Qualificatifs antéposés, tirés dans 25 % des cas. */
  qualifiers: string[];
  /** Séparateur employé entre préfixe et suffixe. */
  joiner: string;
}

export const NAME_BANKS: Record<ContinentCode, NameBank> = {
  AUR: {
    prefixes: [
      "Aub", "Bel", "Cler", "Dun", "Éper", "Fon", "Gran", "Haut", "Iver", "Jol",
      "Kaer", "Lan", "Mar", "Noue", "Orme", "Pré", "Quen", "Roc", "Sau", "Til",
      "Val", "Ver",
    ],
    suffixes: [
      "anne", "ac", "brie", "court", "dole", "elle", "esse", "fort", "gny", "lieu",
      "mont", "nay", "ombre", "ord", "pierre", "queux", "rive", "sac", "thal", "val",
      "vonne", "yse",
    ],
    qualifiers: ["Haut-", "Bas-", "Vieux-", "Petit-", "Grand-"],
    joiner: "",
  },
  KOR: {
    prefixes: [
      "Amber", "Brask", "Chorn", "Dvor", "Elsk", "Grod", "Halv", "Isker", "Jarn", "Kras",
      "Lyt", "Mor", "Nyv", "Ostra", "Pel", "Rud", "Skal", "Torv", "Vest", "Zhel",
    ],
    suffixes: [
      "grad", "ovka", "sk", "stad", "mark", "halm", "vik", "bor", "dal", "lund",
      "nitsa", "por", "rud", "shen", "taj", "ur", "venn", "yr", "zov", "kaya",
    ],
    qualifiers: ["Novo-", "Staro-", "Verkh-", "Nizhne-", "Bolche-"],
    joiner: "",
  },
  SAV: {
    prefixes: [
      "Ba", "Chi", "Dumé", "Ede", "Fela", "Gwa", "Hama", "Iri", "Jala", "Kale",
      "Lomba", "Mba", "Ndo", "Oke", "Pemba", "Rufi", "Sanja", "Tala", "Ubu", "Zawa",
    ],
    suffixes: [
      "bara", "cho", "dala", "engo", "fura", "gongo", "hun", "imba", "jaya", "kwe",
      "lundu", "mba", "ndo", "oka", "pura", "rana", "sika", "tui", "wene", "zima",
    ],
    qualifiers: ["Kwa-", "Ma-", "Bo-", "Ti-", "Nova-"],
    joiner: "",
  },
  MER: {
    prefixes: [
      "Al", "Bar", "Cas", "Dar", "Elz", "Far", "Gis", "Hal", "Ibra", "Jal",
      "Kar", "Lem", "Mira", "Nah", "Ora", "Pal", "Qasr", "Sab", "Tar", "Uz",
      "Zer",
    ],
    suffixes: [
      "ana", "bat", "cala", "dara", "ène", "fira", "halim", "im", "jan", "kesh",
      "lune", "mira", "nis", "oud", "pal", "rah", "sim", "tar", "ura", "zan",
    ],
    qualifiers: ["Aïn-", "Dar-", "Bab-", "Sidi-", "Ras-"],
    joiner: "",
  },
  YAN: {
    prefixes: [
      "Ama", "Bal", "Chi", "Dai", "Fuji", "Gen", "Haru", "Ishi", "Jun", "Kaza",
      "Mizu", "Nagi", "Oku", "Rin", "Saku", "Take", "Uki", "Wata", "Yuki", "Zen",
    ],
    suffixes: [
      "bara", "dani", "gawa", "hama", "ishi", "jima", "kura", "mine", "moto", "naga",
      "no-sato", "oka", "raku", "saki", "shiro", "tsu", "umi", "wan", "yama", "zaki",
    ],
    qualifiers: ["Kita-", "Minami-", "Higashi-", "Nishi-", "Ō-"],
    joiner: "",
  },
  AUS: {
    prefixes: [
      "Ald", "Bran", "Curra", "Drif", "Eld", "Fjall", "Gorm", "Hrim", "Isa", "Kald",
      "Lyng", "Myr", "Norn", "Orm", "Rask", "Skar", "Tamer", "Ur", "Vind", "Warri",
    ],
    suffixes: [
      "aal", "brekk", "dalur", "eng", "fjell", "gard", "havn", "isen", "jokk", "kar",
      "laup", "mork", "nes", "ord", "pyn", "rand", "skaal", "tind", "vaag", "ravn",
    ],
    qualifiers: ["Store-", "Lille-", "Ytre-", "Indre-", "Nord-"],
    joiner: "",
  },
};

/** Hash déterministe 32 bits (FNV-1a) — un même seed donne toujours le même nom. */
export function hashSeed(seed: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

const VOWELS = "aàâeéèêiîoôuûy";

/**
 * Compose un toponyme cohérent avec la culture du continent.
 * Règle : `[qualificatif ?] + Préfixe + joiner + Suffixe`, avec élision si le
 * préfixe se termine et le suffixe commence par une voyelle.
 */
export function makePlaceName(continent: ContinentCode, seed: string): string {
  const bank = NAME_BANKS[continent];
  // Trois tirages salés indépendamment : des seeds voisins (parcelles d'une
  // même zone) ne doivent pas produire des noms corrélés.
  const hp = hashSeed(seed + "#prefix");
  const hs = hashSeed(seed + "#suffix");
  const hq = hashSeed(seed + "#qualifier");
  const prefix = bank.prefixes[hp % bank.prefixes.length] as string;
  const suffix = bank.suffixes[hs % bank.suffixes.length] as string;
  const qualifier =
    hq % 4 === 0 ? (bank.qualifiers[(hq >>> 8) % bank.qualifiers.length] as string) : "";

  const lastPrefixChar = prefix.slice(-1).toLowerCase();
  const firstSuffixChar = suffix.slice(0, 1).toLowerCase();
  const elide = VOWELS.includes(lastPrefixChar) && VOWELS.includes(firstSuffixChar);
  const core = elide ? prefix.slice(0, -1) + suffix : prefix + bank.joiner + suffix;

  return qualifier + core.charAt(0).toUpperCase() + core.slice(1);
}

/** Nom de parcelle : toponyme + numéro romain. */
export function makeParcelName(
  continent: ContinentCode,
  seed: string,
  index: number,
): string {
  return `${makePlaceName(continent, seed)} ${toRoman(index)}`;
}

function toRoman(n: number): string {
  if (n <= 0 || n > 3999) return String(n);
  const table: Array<[number, string]> = [
    [1000, "M"], [900, "CM"], [500, "D"], [400, "CD"],
    [100, "C"], [90, "XC"], [50, "L"], [40, "XL"],
    [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"],
  ];
  let rest = n;
  let out = "";
  for (const [value, sym] of table) {
    while (rest >= value) {
      out += sym;
      rest -= value;
    }
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* 7. Rendement : climat × saison × hémisphère                         */
/* ------------------------------------------------------------------ */

export interface CropClimateProfile {
  /** Température moyenne optimale du cycle (°C). */
  tOpt: number;
  /** Largeur de la cloche thermique (°C) — plus grand = plus tolérant. */
  tSigma: number;
  /** Zéro de végétation (°C) : en dessous, croissance nulle. */
  tBase: number;
  /** Besoin en eau sur le cycle (mm). */
  waterNeedMm: number;
  /** Sensibilité photopériodique 0–1 (1 = plante de jours longs). */
  photoSensitivity: number;
  /** Saisons LOCALES de semis autorisées. */
  sowSeasons: Season[];
  /** Nombre de saisons locales occupées par le cycle. */
  cycleSeasons: number;
  /**
   * Culture d'hiver à vernalisation : semée à l'automne, elle passe l'hiver en
   * dormance. L'hiver ne compte donc pas dans sa moyenne thermique, mais un
   * hiver trop rude la détruit (`frostKillFactor`).
   */
  vernalizing?: boolean;
}

export const CROP_CLIMATE: Record<WorldCropCode, CropClimateProfile> = {
  WHEAT: { vernalizing: true, tOpt: 18, tSigma: 7, tBase: 4, waterNeedMm: 450, photoSensitivity: 0.8, sowSeasons: ["AUTUMN", "SPRING"], cycleSeasons: 3 },
  MAIZE: { tOpt: 25, tSigma: 6, tBase: 10, waterNeedMm: 550, photoSensitivity: 0.3, sowSeasons: ["SPRING"], cycleSeasons: 2 },
  BARLEY: { vernalizing: true, tOpt: 16, tSigma: 7, tBase: 3, waterNeedMm: 320, photoSensitivity: 0.8, sowSeasons: ["AUTUMN", "SPRING"], cycleSeasons: 2 },
  RAPESEED: { vernalizing: true, tOpt: 17, tSigma: 6, tBase: 4, waterNeedMm: 420, photoSensitivity: 0.7, sowSeasons: ["AUTUMN"], cycleSeasons: 3 },
  SOY: { tOpt: 24, tSigma: 6, tBase: 10, waterNeedMm: 500, photoSensitivity: 0.9, sowSeasons: ["SPRING", "SUMMER"], cycleSeasons: 2 },
  SUNFLOWER: { tOpt: 23, tSigma: 7, tBase: 8, waterNeedMm: 400, photoSensitivity: 0.4, sowSeasons: ["SPRING"], cycleSeasons: 2 },
  POTATO: { tOpt: 17, tSigma: 5, tBase: 6, waterNeedMm: 450, photoSensitivity: 0.6, sowSeasons: ["SPRING"], cycleSeasons: 2 },
  RICE: { tOpt: 28, tSigma: 5, tBase: 12, waterNeedMm: 1100, photoSensitivity: 0.5, sowSeasons: ["SPRING", "SUMMER"], cycleSeasons: 2 },
  SORGHUM: { tOpt: 28, tSigma: 7, tBase: 11, waterNeedMm: 400, photoSensitivity: 0.3, sowSeasons: ["SPRING", "SUMMER"], cycleSeasons: 2 },
  MILLET: { tOpt: 29, tSigma: 8, tBase: 12, waterNeedMm: 300, photoSensitivity: 0.3, sowSeasons: ["SPRING", "SUMMER"], cycleSeasons: 1 },
  COTTON: { tOpt: 29, tSigma: 6, tBase: 14, waterNeedMm: 750, photoSensitivity: 0.2, sowSeasons: ["SPRING"], cycleSeasons: 3 },
  SUGARCANE: { tOpt: 28, tSigma: 6, tBase: 15, waterNeedMm: 1500, photoSensitivity: 0.2, sowSeasons: ["SPRING", "AUTUMN"], cycleSeasons: 4 },
  CASSAVA: { tOpt: 27, tSigma: 7, tBase: 13, waterNeedMm: 900, photoSensitivity: 0.1, sowSeasons: ["SPRING", "SUMMER", "AUTUMN"], cycleSeasons: 4 },
  COFFEE: { tOpt: 20, tSigma: 4, tBase: 10, waterNeedMm: 1400, photoSensitivity: 0.2, sowSeasons: ["SPRING"], cycleSeasons: 4 },
  VINE: { tOpt: 22, tSigma: 6, tBase: 10, waterNeedMm: 450, photoSensitivity: 0.4, sowSeasons: ["SPRING"], cycleSeasons: 3 },
  OLIVE: { tOpt: 22, tSigma: 7, tBase: 9, waterNeedMm: 500, photoSensitivity: 0.2, sowSeasons: ["SPRING"], cycleSeasons: 4 },
  ALFALFA: { tOpt: 20, tSigma: 8, tBase: 5, waterNeedMm: 700, photoSensitivity: 0.5, sowSeasons: ["SPRING", "AUTUMN"], cycleSeasons: 2 },
};

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

/**
 * Survie hivernale d'une culture semée à l'automne, selon la température
 * moyenne de l'hiver local. Au-delà de −20 °C sans couvert neigeux fiable,
 * la culture d'hiver n'est plus une option : il faut semer au printemps.
 */
export function frostKillFactor(winterTempC: number): number {
  if (winterTempC >= -6) return 1;
  if (winterTempC <= -20) return 0.25;
  return clamp(1 - 0.75 * ((-6 - winterTempC) / 14), 0.25, 1);
}

/** Facteur thermique : cloche gaussienne autour de `tOpt`, nul sous `tBase`. */
export function thermalFactor(tempC: number, profile: CropClimateProfile): number {
  if (tempC <= profile.tBase) return 0;
  const d = tempC - profile.tOpt;
  return clamp(Math.exp(-(d * d) / (2 * profile.tSigma * profile.tSigma)), 0, 1);
}

/**
 * Facteur hydrique : W = eau disponible / besoin du cycle.
 * Le déficit est puni fortement, l'excès plus doucement (asphyxie, maladies).
 */
export function waterFactor(availableMm: number, profile: CropClimateProfile): number {
  const ratio = availableMm / profile.waterNeedMm;
  if (ratio < 1) return clamp(0.05 + 0.95 * Math.pow(ratio, 1.1), 0.05, 1);
  return clamp(1 - 0.25 * (ratio - 1), 0.65, 1);
}

/** Index de durée du jour 0–1 pour une latitude et une saison locale. */
export function daylightIndex(lat: number, local: Season): number {
  const absLat = Math.min(66, Math.abs(lat));
  const amplitude = absLat / 66;
  const seasonBias: Record<Season, number> = {
    SPRING: 0.15,
    SUMMER: 1,
    AUTUMN: -0.15,
    WINTER: -1,
  };
  return clamp(0.5 + 0.42 * amplitude * seasonBias[local], 0, 1);
}

/** Facteur photopériode : les plantes de jours longs gagnent aux hautes latitudes en été. */
export function photoFactor(
  lat: number,
  local: Season,
  profile: CropClimateProfile,
): number {
  const d = daylightIndex(lat, local);
  return clamp(1 - profile.photoSensitivity * 0.3 * (1 - d), 0.6, 1.08);
}

/** Le semis tombe-t-il dans la fenêtre culturale locale ? */
export function isSowWindow(
  region: Region,
  crop: WorldCropCode,
  reference: Season,
): boolean {
  return CROP_CLIMATE[crop].sowSeasons.includes(
    localSeason(reference, region.hemisphere),
  );
}

export interface YieldInput {
  region: Region;
  crop: WorldCropCode;
  /** Saison de semis exprimée dans le référentiel nord. */
  sowSeason: Season;
  /** Irrigation cumulée sur le cycle (mm). */
  irrigationMm?: number;
  /** Facteur de conduite (labour, fertilisation, désherbage) — cf. `packages/sim`. */
  managementFactor?: number;
  /** Impact des aléas subis, 0–1 (1 = aucun dégât). */
  hazardFactor?: number;
}

export interface YieldBreakdown {
  thermal: number;
  water: number;
  photo: number;
  aptitude: number;
  fertility: number;
  window: number;
  /** Survie hivernale (cultures d'hiver uniquement, sinon 1). */
  frost: number;
  total: number;
}

/**
 * Facteur de rendement climatique, à multiplier par le rendement de base de la
 * culture (`CROP_DEFS[...].yieldPerCell`).
 */
export function climateYieldFactor(input: YieldInput): YieldBreakdown {
  const { region, crop } = input;
  const profile = CROP_CLIMATE[crop];
  const local = localSeason(input.sowSeason, region.hemisphere);

  // Une culture d'hiver passe une saison de plus au champ, en dormance.
  const overwinters = profile.vernalizing === true && local === "AUTUMN";
  const span = Math.max(1, profile.cycleSeasons) + (overwinters ? 1 : 0);

  const startIdx = SEASON_ORDER.indexOf(local);
  const seasons: Season[] = [];
  for (let i = 0; i < span; i++) {
    seasons.push(SEASON_ORDER[(startIdx + i) % 4] as Season);
  }
  // L'eau tombée en dormance recharge le profil de sol : elle compte toujours.
  // La croissance, elle, ne compte que hors dormance.
  const active = overwinters ? seasons.filter((s) => s !== "WINTER") : seasons;

  // Rampe de poids : la fin de cycle (floraison, remplissage du grain) pèse
  // davantage que l'implantation. Poids 1, 2, 3… sur les saisons actives.
  const weights = active.map((_, i) => i + 1);
  const weightSum = weights.reduce((a, b) => a + b, 0);
  const weighted = (f: (s: Season) => number) =>
    active.reduce((acc, se, i) => acc + f(se) * (weights[i] as number), 0) / weightSum;

  const meanTemp = weighted((se) => region.tempBySeason[se]);
  const water =
    seasons.reduce((s, se) => s + region.rainBySeason[se], 0) + (input.irrigationMm ?? 0);

  const thermal = thermalFactor(meanTemp, profile);
  const hydric = waterFactor(water, profile);
  const photo = weighted((se) => photoFactor(region.lat, se, profile));
  const frost = overwinters ? frostKillFactor(region.tempBySeason.WINTER) : 1;
  const aptitude = region.crops.find((c) => c.crop === crop)?.aptitude ?? 0.35;
  const fertility = 0.4 + 0.6 * region.fertility;
  const window = profile.sowSeasons.includes(local) ? 1 : 0.45;

  const total = clamp(
    thermal *
      hydric *
      photo *
      aptitude *
      fertility *
      window *
      frost *
      (input.managementFactor ?? 1) *
      (input.hazardFactor ?? 1),
    0,
    1.6,
  );

  return { thermal, water: hydric, photo, aptitude, fertility, window, frost, total };
}

/**
 * Étalon économique du monde : blé d'hiver au Val-de-Blé, région de départ.
 * C'est ce rendement-là qui vaut le prix de base du marché.
 */
export const YIELD_REFERENCE = climateYieldFactor({
  region: REGIONS_BY_CODE["AUR-VALBLE"] as Region,
  crop: "WHEAT",
  sowSeason: "AUTUMN",
}).total;

/** Millimètres d'irrigation nécessaires pour combler le déficit du cycle. */
export function irrigationTopUp(
  region: Region,
  crop: WorldCropCode,
  sowSeason: Season,
): number {
  const profile = CROP_CLIMATE[crop];
  const local = localSeason(sowSeason, region.hemisphere);
  const overwinters = profile.vernalizing === true && local === "AUTUMN";
  const span = Math.max(1, profile.cycleSeasons) + (overwinters ? 1 : 0);
  const startIdx = SEASON_ORDER.indexOf(local);
  let rain = 0;
  for (let i = 0; i < span; i++) {
    rain += region.rainBySeason[SEASON_ORDER[(startIdx + i) % 4] as Season];
  }
  return Math.max(0, Math.round(profile.waterNeedMm - rain));
}

/**
 * Meilleur facteur climatique atteignable dans le monde pour chaque culture,
 * calculé sur toutes les régions et toutes leurs fenêtres de semis, irrigation
 * comprise là où elle est obligatoire. Sert d'échelle 0–1 par culture.
 */
export const CROP_YIELD_REFERENCE: Record<WorldCropCode, number> = (() => {
  const out = {} as Record<WorldCropCode, number>;
  for (const crop of Object.keys(CROP_CLIMATE) as WorldCropCode[]) {
    let best = 0;
    for (const region of REGIONS) {
      for (const local of CROP_CLIMATE[crop].sowSeasons) {
        // On repasse en référentiel nord pour interroger le modèle.
        const sowSeason = localSeason(local, region.hemisphere);
        const irrigationMm = region.irrigationRequired
          ? irrigationTopUp(region, crop, sowSeason)
          : 0;
        const f = climateYieldFactor({ region, crop, sowSeason, irrigationMm }).total;
        if (f > best) best = f;
      }
    }
    out[crop] = best > 0 ? best : 1;
  }
  return out;
})();

/**
 * Multiplicateur lisible par le game design, normalisé PAR CULTURE :
 * 1.00 = meilleur terroir mondial pour cette culture, 0.50 = moitié moins.
 */
export function regionalYieldMultiplier(input: YieldInput): number {
  return clamp(
    climateYieldFactor(input).total / CROP_YIELD_REFERENCE[input.crop],
    0,
    1,
  );
}
```

---

## 8 — Cohérence : la formule de rendement

### 8.1 — Comment climat, saison et hémisphère se combinent

La chaîne causale est toujours la même, dans cet ordre :

```
latitude + hémisphère  →  saison locale
saison locale          →  température & pluie de la région (tempBySeason, rainBySeason)
saison locale + climat →  probabilités météo du jour (WEATHER_BY_CLIMATE)
saison locale + culture→  la fenêtre de semis est-elle ouverte ? (sowSeasons)
tout ce qui précède    →  facteur de rendement climatique
```

La formule s'insère dans celle de `03_AGRICULTURE_REALISM.md` § 12 : elle en fournit le bloc `baseYield(crop, region) × waterFactor × weatherEventFactor`, les autres facteurs (variété, conduite, spécialisation, niveau) restant inchangés.

```
facteurClimat =  fTherm × fEau × fPhoto × aptitude × fFertilité × fFenêtre × fGel

avec :
  fTherm     = exp( −(T̄ − Topt)² / (2 σ²) )      , nul si T̄ ≤ Tbase
  fEau       = 0.05 + 0.95 · W^1.1                si W < 1        (déficit)
             = 1 − 0.25 · (W − 1)                 si W ≥ 1, plancher 0.65 (excès)
               où W = (pluie du cycle + irrigation) / besoin de la culture
  fPhoto     = 1 − sensibilité · 0.3 · (1 − jourIndex(latitude, saison))
  aptitude   = aptitude agronomique de la culture dans la région (0–1)
  fFertilité = 0.4 + 0.6 · fertilité du sol
  fFenêtre   = 1 si la saison locale de semis est autorisée, sinon 0.45
  fGel       = 1 si T̄hiver ≥ −6 °C ; 0.25 si ≤ −20 °C ; linéaire entre les deux
               (cultures d'hiver uniquement)

rendement = rendementDeBase(culture)
          × facteurClimat
          × facteurConduite (labour, fertilisation, désherbage)
          × facteurAléas    (grêle, inondation, canicule subis)
          × bonusSpécialisation (≤ 1.10)
          × bonusNiveau        (≤ 1.10)
          × bonusPatrimoine    (adjacence + prime bi-hémisphère)
```

Trois subtilités agronomiques sont explicitement modélisées, parce que sans elles le modèle produisait des résultats faux :

**La moyenne thermique est pondérée vers la fin du cycle.** Les saisons du cycle reçoivent des poids croissants (1, 2, 3…) : la floraison et le remplissage du grain déterminent le rendement bien plus que l'implantation. Sans cette pondération, le maïs de la Grande Plaine était pénalisé par un printemps frais alors que c'est son été chaud qui compte.

**Les cultures d'hiver dorment.** Une culture à vernalisation (blé, orge, colza) semée à l'automne passe **une saison de plus** au champ, et l'hiver est exclu de sa moyenne thermique : elle est en dormance, elle ne pousse pas, mais elle ne souffre pas non plus de la température. En revanche la pluie hivernale compte toujours, puisqu'elle recharge la réserve du sol.

**Un hiver trop rude tue les semis d'automne.** C'est `fGel`. Il traduit une réalité qui structure tout le calendrier de Kortavie et du nord de Yanashi : au-delà de −20 °C de moyenne hivernale, la culture d'hiver n'est plus jouable et il faut passer aux variétés de printemps.

### 8.2 — Quatre cas travaillés

Chiffres produits par le module lui-même, pas estimés à la main.

**a) L'étalon — blé d'hiver au Val-de-Blé (`Cfb`, 48.6° N)**

| fTherm | fEau | fPhoto | aptitude | fFertilité | fFenêtre | fGel | **total** |
|--------|------|--------|----------|-----------|----------|------|-----------|
| 0.921 | 0.883 | 0.919 | 0.95 | 0.892 | 1 | 1.00 | **0.634** |

Rien n'est limitant : c'est la définition d'une région pour débutants, et ce 0.634 sert d'ancre au prix de base du marché.

**b) L'inversion, en bien et en mal — maïs aux Hautes Herbes (`Aw`, 11.4° S)**

| Semis (référence serveur) | Saison locale | fEau | fFenêtre | total | Multiplicateur |
|---------------------------|---------------|------|----------|-------|----------------|
| `AUTUMN` | Printemps austral ✓ | 0.950 | 1 | 0.635 | **0.92** |
| `SPRING` | Automne austral ✗ | 0.484 | 0.45 | 0.120 | **0.17** |

Le même joueur, la même parcelle, la même culture : semer selon le réflexe de l'hémisphère nord divise le rendement par cinq. C'est la leçon la plus importante que le monde doit enseigner.

**c) S'adapter au froid — Marches de Taïga (`Dfc`, 55.4° N, hiver à −17 °C)**

| Choix | fTherm | fGel | aptitude | total | Multiplicateur |
|-------|--------|------|----------|-------|----------------|
| Blé d'hiver | 0.465 | **0.41** | 0.35 | 0.042 | **0.06** |
| Orge de printemps | 0.801 | 1.00 | 0.70 | 0.327 | **0.47** |

La région n'est pas « mauvaise », elle est **exigeante** : elle interdit une pratique et en récompense une autre. Près de huit fois plus de rendement sur le même hectare, uniquement par le choix de la culture et de la fenêtre de semis.

**d) L'eau comme monnaie — coton au Limon de Serapha (`BWh`, 27.8° N, 90 mm/an)**

| Conduite | fEau | total | Multiplicateur |
|----------|------|-------|----------------|
| Pluvial | 0.104 | 0.079 | **0.10** |
| Irrigué (+695 mm) | 1.000 | 0.762 | **1.00** |

Le meilleur coton du monde pousse dans un désert — à condition de payer 695 mm d'irrigation. Toute l'économie de Méridie tient dans cet écart : la terre est bon marché, l'eau ne l'est pas.

### 8.3 — Rendements obtenus par région

Multiplicateurs normalisés **par culture** : `1.00` désigne le meilleur terroir mondial pour cette culture, `0.50` la moitié de ce potentiel. Les régions à irrigation obligatoire sont évaluées irriguées.

| Région | Blé (hiver) | Maïs (print.) | Meilleure culture | Irrigation |
|--------|-------------|---------------|-------------------|------------|
| Val-de-Blé | 0.95 | 0.16 | Colza 1.00 | — |
| Côte des Brumes | 0.49 | 0.07 | Orge 0.82 | — |
| Hautes-Collines | 0.39 | 0.07 | Luzerne 0.73 | — |
| Bassin d'Orval | 0.88 | 0.24 | Orge 0.92 | — |
| Marais de Sluvenne | 0.83 | 0.09 | Pomme de terre 1.00 | — |
| Vallée de Solane | 0.79 | 0.49 | Tournesol 1.00 | — |
| Grande Plaine | 0.79 | 0.84 | Tournesol 0.90 | — |
| Terres de Vent-Noir | 0.71 | 0.19 | Blé 0.71 | obligatoire |
| Lacs Gelés | 0.54 | 0.09 | Orge 0.85 | — |
| Rive-d'Or | 0.71 | 0.93 | Luzerne 1.00 | — |
| Marches de Taïga | 0.06 | 0.01 | Orge 0.47 | — |
| Terres du Bas-Soleil | 0.50 | 1.00 | Soja 1.00 | — |
| Hautes Herbes | 0.17 | 0.92 | Sorgho 1.00 | — |
| Terre Rouge | 0.16 | 0.82 | Manioc 0.99 | — |
| Grand Fleuve | 0.11 | 0.67 | Riz 1.00 | — |
| Plateaux d'Ombre | 0.58 | 0.63 | Pomme de terre 0.71 | — |
| Canopée de Mbaraka | 0.10 | 0.38 | Manioc 0.78 | — |
| Brousse d'Épines | 0.20 | 0.31 | Mil 0.81 | obligatoire |
| Grande Oliveraie | 0.75 | 0.11 | Olivier 1.00 | — |
| Plaine de Sel Blanc | 0.12 | 0.17 | Luzerne 0.65 | obligatoire |
| Cap des Deux-Vents | 0.86 | 0.12 | Vigne 1.00 | — |
| Oasis de Zerán | 0.15 | 0.50 | Mil 0.87 | obligatoire |
| Monts des Cèdres | 0.29 | 0.10 | Vigne 0.62 | — |
| Limon de Serapha | 0.33 | 0.65 | Coton 1.00 | obligatoire |
| Delta de Jade | 0.51 | 0.94 | Maïs 0.94 | — |
| Collines du Thé | 0.20 | 0.75 | Café 1.00 | — |
| Steppe du Nord | 0.43 | 0.46 | Mil 0.73 | — |
| Îles de Perle | 0.13 | 0.59 | Riz 0.96 | — |
| Hauts de Neige-Bleue | 0.57 | 0.20 | Pomme de terre 0.85 | — |
| Baie de Corail | 0.09 | 0.25 | Manioc 0.80 | — |
| Ceinture du Blé-Sud | 0.73 | 0.09 | Orge 0.74 | — |
| Vallée Verte | 0.92 | 0.10 | Blé 1.00 | — |
| Roche Rouge | 0.08 | 0.18 | Luzerne 0.57 | obligatoire |
| Cap Austral | 0.22 | 0.04 | Luzerne 0.60 | — |
| Coteaux de Solivera | 0.73 | 0.25 | Vigne 0.83 | obligatoire |
| Rives de Nyvarden | 0.05 | 0.00 | Orge 0.07 | — |

Ce tableau est la preuve que le monde est équilibré : **aucune région n'est première partout**. La Vallée Verte domine le blé, les Terres du Bas-Soleil le maïs, le Grand Fleuve le riz, le Limon de Serapha le coton, le Cap des Deux-Vents la vigne, les Marais de Sluvenne la pomme de terre. Deux régions seulement sont franchement hostiles — les Marches de Taïga et les Rives de Nyvarden — et elles coûtent respectivement 0.40 × et 0.18 × le prix du foncier de référence.

---

## 9 — Intégration au code existant

Ce document décrit le monde tel qu'il doit être ; `packages/shared/src/world.ts` en implémente déjà le squelette. Voici précisément ce qui coïncide et ce qui reste à faire.

| Élément | État |
|---------|------|
| 6 continents, codes, noms, hémisphères, difficultés, palettes, `priceMult` | **Déjà livré**, repris à l'identique ici |
| 24 régions (4 par continent) : codes, villes, Köppen, latitudes, fertilités, `priceMult` | **Déjà livré**, repris à l'identique ici |
| Inversion des saisons (`currentSeason`, décalage de 2 crans au sud) | **Déjà livré**, conforme à [§4.2](#42--linversion-hémisphérique) |
| Durée de saison MVP (`SEASON_DURATION_MS` = 15 min) | **Déjà livré** ; l'échelle persistante est proposée en [§4.1](#41--durée-dune-saison-en-temps-réel) |
| Prime bi-hémisphère (`HEMISPHERE_HEDGE_BONUS`) | **Déjà livré** |
| 12 régions supplémentaires (6 par continent) | À ajouter — additif, aucune rupture |
| Températures et pluies par saison, aléas, drapeau d'irrigation | À ajouter (`Region` de ce document) |
| Table météo à 19 climats (`WEATHER_BY_CLIMATE`) | À ajouter — remplace `weatherOdds()`, qui ne distingue que 4 familles |
| Générateur toponymique (`NAME_BANKS`, `makePlaceName`) | À ajouter |
| Profils agroclimatiques des 17 cultures (`CROP_CLIMATE`) | À ajouter ; `CROP_DEFS` ne couvre que `WHEAT` et `MAIZE` au MVP |
| Formule de rendement climatique (`climateYieldFactor`) | À ajouter ; se branche sur `packages/sim` en amont de `managementFactor` |

**Ordre d'intégration recommandé :** (1) copier le module, (2) brancher `WEATHER_BY_CLIMATE` sur le tick météo à la place de `weatherOdds`, (3) seeder les 12 régions manquantes en base, (4) exposer températures et pluies dans l'UI de sélection de parcelle, (5) brancher `climateYieldFactor` dans le calcul de rendement. Les étapes 1 à 3 sont sans risque de régression ; l'étape 5 modifie l'équilibrage économique et demande une passe de calibrage du marché.

**Cultures :** le MVP ne connaît que le blé et le maïs. Les 17 cultures décrites ici sont la cible ; les régions dont la meilleure culture n'est pas encore implémentée resteront temporairement sous-exploitées — ce n'est pas un bug de données mais une dette de contenu, à combler par ordre de valeur gameplay (orge, colza, soja, riz d'abord).

---

## 10 — Résumé

1. **Six continents**, 36 régions, 36 villes-marché : `AUR` Auralie (tempéré océanique, débutant), `KOR` Kortavie (continental), `SAV` Savannis (tropical, austral), `MER` Méridie (méditerranéen à désertique), `YAN` Yanashi (moussons), `AUS` Australis (austral froid et sec).
2. **Noms 100 % imaginaires, climats 100 % réels** : chaque région porte un code Köppen authentique, cohérent avec sa latitude, ses températures et sa pluviométrie saisonnières.
3. **Quatre continents au nord, deux au sud** : les terres australes sont rares, bon marché et stratégiques.
4. **Saisons inversées** entre hémisphères par un décalage de deux crans, appliqué à partir d'une unique saison de référence serveur.
5. **Durée d'une saison** : 15 min réelles en MVP (déjà livré), cible persistante à 7 jours réels — soit une année de jeu par mois.
6. **19 climats × 4 saisons × 5 états météo** (`CLEAR`, `CLOUDY`, `RAIN`, `STORM`, `SNOW`), en probabilités sommant à 100 %, remplaçant les 4 profils actuels.
7. **Générateur toponymique** par continent : 20+ préfixes, 20+ suffixes, qualificatifs, trois tirages salés, déterministe et sans stockage.
8. **Rendement = climat × saison × hémisphère**, avec pondération de fin de cycle, dormance hivernale et destruction par le gel explicitement modélisées.
9. **Aucune région dominante** : chaque culture a son meilleur terroir ailleurs, et posséder les deux hémisphères lisse les revenus sur l'année entière.
10. **Le code TypeScript du §7 compile en `--strict` et passe ses tests de cohérence** : sommes de probabilités, cumuls pluviométriques, accord latitude/hémisphère et alignement avec `world.ts` déjà livré.
