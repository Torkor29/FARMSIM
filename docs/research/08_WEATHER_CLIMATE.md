# 08 — Weather & Climate

---

## 1. Objectifs

- Rendre la **localisation** significative.
- Alimenter le **marché mondial** via chocs d’offre.
- Rester calculable à grande échelle.

---

## 2. Données réelles utilisables `[FAIT]`

| Dataset | Usage | Licence / notes |
|---------|-------|-----------------|
| Köppen-Geiger (Beck et al.) | Zone climatique parcelle | Données recherche / cartes 1 km |
| WorldClim | Normes T° / précipitations mensuelles | Calibration |
| Open-Meteo | Météo / historique API | Bon pour outils ; **pas** dépendance runtime critique |
| ERA5 / Copernicus | Reanalyses | Lourds ; offline bake |
| SoilGrids / ISRIC | Types de sol | Bake attributs parcelle |

---

## 3. Stratégie runtime : simulation > live feed

| Approche | Pros | Cons |
|----------|------|------|
| Météo live réelle | Marketing | Fragile, unfair (vrai climat change), ops |
| Historique rejoué | Réalisme | Prédictible / datamining |
| **Simulation paramétrée par climat** | Contrôle, fair, stable | Moins « vrai temps » |

**Choix `[PROPOSITION]` :** simulation serveur pilotée par profil climatique de la région (norms WorldClim/Köppen), avec bruit stochastique + événements scriptés.  
Option cosmétique : « inspiré des moyennes 1991–2020 de ta région ».

---

## 4. Modèle simplifié

Chaque `Region` :
- `climateZone` (Köppen)
- `tempMonth[12]`, `precipMonth[12]` (norms)
- `extremeRisk` (grêle, gel, sécheresse, inondation)

Chaque jour-jeu (ou tick 4–6 h) :
- tire T°, pluie ;
- met à jour humidité sols des parcelles actives ;
- chance d’événement.

Parcelles **inactives / non peuplées** : pas de sim granuleuse — seulement agrégats régionaux pour le marché.

---

## 5. Effets gameplay

| Phénomène | Croissance | Travaux | Qualité | Marché |
|-----------|------------|---------|---------|--------|
| Pluie modérée | + | peut bloquer récolte | =/+ | = |
| Sécheresse | −− | irrigation utile | − | prix ↑ si large |
| Canicule | − animaux/cultures | stress | − | variable |
| Gel | dégâts stades sensibles | — | −− | local |
| Grêle | dégâts champs | — | −− | local/région |
| Inondation | −− / délai | bloqué | − | local |
| Tempête | usure / dégâts | risque | — | — |

---

## 6. Scalabilité

Ne **jamais** simuler 1 M de parcelles au pas horaire détaillé.

Architecture :
1. Tick régional (climat) léger — toujours.
2. Tick parcelle **seulement si** culture en cours / animaux / joueur récent.
3. Formules fermées de croissance entre logins (catch-up serveur).

---

## 7. MVP météo

- 4–5 états : clair, nuageux, pluie, orage, neige (si zone).
- Impact : croissance ±, blocage récolte sous pluie, 1 type événement (sécheresse OU grêle).
- Affichage prévision 3 jours.

V1 : risques par Köppen, humidité sol, événements marché liés.
V2 : irrigation, assurances, multi-aléas.

---

## 8. Challenge

Trop de punition RNG frustrante pour casual.  
Mitigation : prévisions, assurances, variétés résistantes, irrigation, diversification spatiale (coûteuse).
