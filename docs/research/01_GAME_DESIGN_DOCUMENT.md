# 01 — Game Design Document

**Projet :** Farming Navigateur  
**Version :** 0.1 (phase recherche)  
**Classification :** Document de vision — propositions marquées `[PROPOSITION]`

---

## 1. Pitch

**Farming Navigateur** est un jeu de gestion agricole **mondial, persistant et multijoueur**, jouable dans le navigateur.

Le joueur ne gère pas une ferme isolée sur une carte fictive générique : il **choisit une parcelle située sur une représentation de la Terre**, et développe une exploitation dont le succès dépend du **climat, du sol, des saisons, de la météo, du marché mondial et des interactions avec d’autres joueurs**.

> Originalité centrale = **Terre réelle + agriculture + économie mondiale + multijoueur + services entre joueurs + climat**.

Ce n’est **pas** un Farming Simulator dans le navigateur. FS inspire le *feeling* d’exploitation agricole ; le produit se différencie par la macro-économie, la géographie et le multi persistant.

---

## 2. Fantasy du joueur

« Je suis un exploitant agricole du XXIe siècle. Ma parcelle est quelque part sur Terre. Je décide quoi cultiver, comment investir, quand vendre, pour qui travailler, et comment me spécialiser — dans un marché mondial vivant. »

Profils cibles simultanés :

| Profil | Session | Motivation |
|--------|---------|------------|
| Casual | 5–10 min | Vérifier champs, vendre, lancer actions |
| Régulier | 30–60 min | Optimiser, travailler, commercer |
| Hardcore | Plusieurs heures | Macro-économie, services, R&D, multi-activités |
| Stratège | Variable | Prix, stockage, spéculation raisonnée |
| Social / entrepreneur | Variable | Prestations machines pour d’autres |
| Relax | Variable | Petite ferme, rythme lent |

**Règle d’or :** ne pas récompenser uniquement le temps passé. La **décision** doit primer.

---

## 3. Piliers de design

1. **Localisation significative** — climat, sol, risque, cultures adaptées.
2. **Boucle agricole crédible** — préparer → semer → soigner → récolter → stocker/vendre.
3. **Économie mondiale** — marché central absorbant la production, prix dynamiques.
4. **Interdépendance joueurs** — céréaliers ↔ éleveurs ; propriétaires ↔ entrepreneurs agricoles.
5. **Progression faible mais lisible** — machines > niveaux ; spécialisations ≤ +10 %.
6. **Accessibilité navigateur** — sessions courtes possibles ; simulation serveur persistante.
7. **Identité visuelle propre** — isométrique 3D stylisée, pas photoréaliste.

---

## 4. Boucle de gameplay principale

```
Choisir parcelle (géographie)
    ↓
Spécialisation légère (céréalier / éleveur / …)
    ↓
Cycle cultural / animal
    ↓
Décision : vendre / stocker / transformer (plus tard)
    ↓
Réinvestir : terres, machines, semences, bâtiments
    ↓
Optionnel : prestations pour autres joueurs
    ↓
Marché mondial réagit (offre, stocks, météo, saison)
```

### Micro-boucle (session courte)
Consulter météo → état des champs → lancer 1–2 actions → vendre/stocker → quitter.

### Méso-boucle (session moyenne)
Planifier cultures → engager travaux (soi / prestataire) → optimiser stock → marchés.

### Macro-boucle (semaine/mois IG)
Spécialisation, expansion foncière, R&D semences, positionnement marché, réputation services.

---

## 5. Systèmes majeurs (vue d’ensemble)

| Système | MVP | V1 | V2+ |
|---------|-----|----|-----|
| Compte + ferme | ✓ | ✓ | ✓ |
| Carte mondiale simplifiée | ✓ | ✓ | ✓ |
| Cultures de base (blé, maïs…) | ✓ | ✓ | ✓ |
| Météo simple | ✓ | ✓ | ✓ |
| Marché mondial NPC | ✓ | ✓ | ✓ |
| Machines + usure | ✓ | ✓ | ✓ |
| Prestations joueurs | — | ✓ | ✓ |
| Qualité produits | basique | ✓ | ✓ |
| Semences / variétés | 2–3 | ✓ + R&D | ✓ |
| Élevage | — | basique | profond |
| OGM / réglementation locale | — | — | ✓ |
| Politique locale | — | — | optionnel |
| Marketplace premium | — | ✓ | ✓ |
| Cash-out argent réel | **NON** | **NON** | étude séparée |

---

## 6. Spécialisations

Au début, le joueur choisit une **orientation** (pas un lock définitif).

### Céréalier `[PROPOSITION]`
Bonus légers (plafond global de progression de spécialisation **≤ +10 %**) sur :
- rendement céréales ;
- efficacité semis/récolte ;
- coûts de stockage céréaliers ;
- certaines cultures.

### Éleveur `[PROPOSITION]`
Bonus légers sur :
- conversion alimentaire ;
- santé / survie ;
- production (lait, viande, œufs) ;
- qualité animalière.

### Extensions futures
Entrepreneur agricole, maraîcher, viticulteur, bio-spécialiste, trader/stockeur…  
Toujours avec des bonus **faibles** pour préserver l’économie et l’interdépendance.

**Philosophie :** identité + orientation économique, **pas** prison de build. Un céréalier peut avoir quelques animaux ; un éleveur peut cultiver un peu de fourrage.

---

## 7. Interdépendance céréalier / éleveur

```
Céréalier → céréales/fourrages → Marché → Éleveur → viande/lait → Marché
Éleveur → fumier/lisier → Marché / contrats → Céréalier → fertilisation
```

**Challenge :** si l’interdépendance est trop forte, un déséquilibre de population (trop de céréaliers) casse l’autre métier.  
**Mitigation `[PROPOSITION]` :**
- le marché NPC absorbe toujours un volume (demande plancher) ;
- les engrais minéraux restent disponibles (plus chers / moins « qualité sol ») ;
- les aliments animaux industriels NPC existent comme filet de sécurité ;
- bonus de spécialisation trop faibles pour forcer le mono-métier.

Verdict : **intéressant si non obligatoire**. Filets NPC + bonus faibles = boucle saine.

---

## 8. Action case par case

Chaque parcelle est une grille de **cases** (taille à calibrer — voir `09_WORLD_MAP.md`).

Travail machine :
- sélection de cases / chemin ;
- animation machine ;
- temps par case (ex. **1 case ≈ 30–60 s réel** en manuel `[TEST]`) ;
- possibilité d’engager un prestataire ou d’automatiser partiellement plus tard.

Équilibre recherché :
- manuel = plaisir / feedback ;
- prestataire = économie sociale ;
- auto (tardif / limité) = confort, pas remplacement total du multi.

---

## 9. Qualité vs quantité

Toute production majeure distingue **volume** et **qualité** (grades 1–5 `[GD]`).

Stratégies :
- **Volume** : rendement haut, qualité moyenne, prix bas ;
- **Premium** : rendement moindre, qualité haute, prix haut ;
- **Résilient** : meilleures résistances climatiques, stats moyennes ailleurs.

Appliqué à céréales, puis fruits/légumes, viande, lait, œufs.

---

## 10. Style visuel

- Vue **isométrique 3D simplifiée** (pas photoréaliste).
- Lisibilité > détail : champs, stades de culture, bâtiments, animaux, machines, routes.
- Identité propre (charme, animations, feedback) — **pas** clone FS.
- Performances navigateur prioritaires (LOD, instancing, baked lighting).

Direction artistique recommandée `[PROPOSITION]` : stylisé « diorama agricole », couleurs régionales selon climat, motion subtile (vent, machines, fumée douce).

---

## 11. Promesse marketing (interne)

> « FS te fait conduire le tracteur. Nous, on te fait diriger une exploitation sur la vraie planète — dans le navigateur, avec un marché mondial et d’autres joueurs. »

Éviter : « Farming Simulator free », « réaliste comme FS », « John Deere ».

---

## 12. Critères de décision (rappel)

Quand deux options s’opposent, scorer :
1. plaisir · 2. réalisme · 3. profondeur · 4. accessibilité · 5. économie · 6. perf · 7. scale · 8. coût dev · 9. monétisation · 10. risque déséquilibre.

Objectif : *assez réaliste pour croire à l’exploitation, assez simple pour s’amuser dans un navigateur.*

---

## 13. Hors-scope explicite du GDD (renvois)

- Détail FS → `02`
- Agronomie → `03`
- Économie / marché → `04`, `05`, `15`
- Légal → `12`
- Technique → `13`, `14`
- MVP → `16`
