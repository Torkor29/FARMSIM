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

## 3. Stratégie runtime : hybride (recommandé)

| Approche | Pros | Cons |
|----------|------|------|
| Météo live réelle | Marketing | Fragile, unfair, quotas API, licence commerciale Open-Meteo |
| Historique rejoué | Réalisme | Prédictible / datamining |
| Simulation paramétrée | Contrôle, fair | Moins « vrai temps » |
| **Hybride** | Ancrage géo + équilibre MMO | Un peu plus complexe |

**Choix `[PROPOSITION]` :**  
1. **Bake statique** : Köppen + norms WorldClim + sol résumé (SoilGrids offline).  
2. **Runtime** : climatologie + bruit spatial corrélé (seed serveur) + événements calibrés.  
3. **Optionnel plus tard** : mode « Live Weather » (Open-Meteo commercial / self-host) pour serveurs RP — pas le défaut MMO.

**[FAIT]** Open-Meteo API gratuite = usage non commercial / quotas ; un jeu monétisé nécessite plan commercial ou self-host (terms Open-Meteo).

---

## 4. Modèle simplifié (cellule météo → parcelle)

**Ne jamais** simuler la météo au m² ni à chaque parcelle.

| Niveau | Exemple | Rôle |
|--------|---------|------|
| Cellule météo | H3 res 5–6 (~36–250 km²) ou grille ~0.1° | 1 tick météo / jour |
| Bloc sol | H3 res 7–8 (bake) | Profil sol |
| Parcelle | 5–20 ha MVP | État culture (eau, stade, biomasse) |

Chaque `Zone` / cellule :
- `climateZone` (Köppen)
- `tempMonth[12]`, `precipMonth[12]` (norms)
- `extremeRisk` (grêle, gel, sécheresse, inondation)

### Bilan journalier minimal `[PROPOSITION]` (inspiré FAO-56)

```
GDD += max(0, (Tmin+Tmax)/2 − Tbase)
ETc = Kc(stade) × ET0
Δeau = pluie + irrigation − ETc − ruissellement_simplifié
W = clamp(eau / eau_utile, 0, 1)   # stress hydrique
Δbiomasse ∝ f(GDD) × W × f_therm × f_maladies
```

Grêle / inondation locale : **événements stochastiques** conditionnés par climat (mal couverts en réanalyse à 10–25 km).

Parcelles **inactives** : pas de sim granuleuse — agrégats régionaux pour le marché seulement.

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
