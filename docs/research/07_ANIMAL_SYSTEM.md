# 07 — Animal System

**Statut :** documenté pour V1+ ; **hors MVP strict**.

---

## 1. Objectifs

- Créer une demande structurelle pour céréales/protéines.
- Produire viande, lait, œufs, fumier/lisier.
- Offrir un fantasy « éleveur » distinct.
- Rester jouable en sessions courtes (pas micro-gestion minute).

---

## 2. Entités

- `AnimalGroup` (troupeau/lot) plutôt qu’animal individuel au début.
- Stats agrégées : effectif, âge moyen, santé, satiété, stress, qualité génétique, poids moyen.
- Individus possibles plus tard pour prestige / breeding show.

Espèces V1 : bovins lait, bovins viande, porcs, poules pondeuses.  
V2 : ovins, volaille chair, etc.

---

## 3. Alimentation configurable

| Ration | Coût | Croissance / prod | Qualité |
|--------|------|-------------------|---------|
| Basique | Bas | 100 % | 100 % |
| Optimisée | Moyen | 110–115 % | 105 % |
| Premium | Haut | 120 % | 115–125 % |

Mélange multi-ingrédients (blé, maïs, soja, foin…) avec besoins protéine/énergie simplifiés (2 jauges).

Filet NPC : aliments composés achetables si marché joueur sec.

---

## 4. Production & reproduction

- Lait : flux quotidien si santé/satiété OK.
- Œufs : idem.
- Viande : croissance → abattage / vente lots (décision stratégique).
- Reproduction : cycles, bâtiments, plafonds densité.

Mortalité si santé basse / bâtiments surchargés / canicule sans mitigation.

---

## 5. Bâtiments

Capacité, confort, automatisation (abreuvoir, raclage), coût entretien, effect fumier.

Upgrade = sink + qualité de vie.

---

## 6. Santé & traitements

Traitements intensifs : +survie / +prod, **−qualité** / −prix premium.  
Approche préventive / bio : −risque moyen, +qualité, −volume.  
Neutre économiquement ; la région peut subventionner.

---

## 7. Effluents

Fumier / lisier = co-produits vendables ou auto-consommés.  
Boucle avec céréaliers.  
Si trop d’élevage : prix effluents s’effondrent (toujours utiles en sink stockage/épandage).

---

## 8. Rentabilité — warning design

`[HYPOTHÈSE]` : comme en FS, l’élevage peut être ROI long / punitif si mal calibré.  
Calibrer pour que :
- early éleveur viable avec petit cheptel ;
- late scale nécessite capital et feed stable ;
- pas strictement dominant vs céréales.

---

## 9. Lien spécialisation

Bonus éleveur sur conversion, santé, qualité — faibles.  
Céréalier peut garder un petit lot « fumier » sans être optimal.
