# 51 — L’ETA n’est pas une spécialisation

**Statut :** En code sur `main` (2 métiers, marché P2P, filet PNJ). Les fermes PNJ persistantes restent plus tard.  
**Date :** 2026-08-13  
**Corrige :** [06_PROGRESSION.md](./06_PROGRESSION.md) § 3, [49_TRIANGLE_METIERS.md](./49_TRIANGLE_METIERS.md) § 4.3 / kits de départ, [50_MACHINE_CARE.md](./50_MACHINE_CARE.md) (l’atelier n’est plus « le métier »)  
**Conserve du 49 :** la bourse de chantiers sur de **vraies** parcelles, le filet PNJ, les consignes d’absence, « pas de mur d’outils ».

---

## 1. Thèse

On n’est pas « ETA ». On est céréalier ou éleveur. Les travaux à façon sont un **appoint** : du fer qui ne tourne pas chez soi va tourner chez le voisin (ou une ferme PNJ), contre des CRD.

L’identité de l’ETA comme troisième métier (dépôt sans champ, kit moissonneuse, graisse obligatoire, XP dédiée) **est abandonnée**. Ce qui reste, c’est un marché du travail agricole, ouvert à quiconque a la machine et du temps.

```
Chez soi                    Appoint
────────                    ───────
semer, soigner, vendre      prendre un chantier
attendre que ça pousse      (fer idle + cases d’un autre)
revenu principal            revenu d’appoint, plafonné
```

Si les missions rapportent autant que cultiver, elles deviennent le jeu. Donc **le salaire du chantier est calé sur l’usure, pas sur le prix que paie le client**.

---

## 2. Ce qui est cassé aujourd’hui

Deux systèmes, deux tarifs, aucun lien.

| Côté | Objet | Argent | Terre réelle |
|------|--------|--------|----------------|
| Client | `POST /parcels/:id/contractor` | **Vous payez** `120 + taux × cases`, malus −6 % | Oui, *votre* parcelle |
| Prestataire | `NpcContract` « Travaux à façon » | **Vous encaissez** 300–850 CRD | **Non.** Titre + usure forfaitaire 10 cases |

Le tarif client (`CONTRACTOR_RATE_PER_CELL`) a été posé pour **dissuader d’acheter la machine**. Ce n’est pas un salaire. Le tableau ETA le reverse pourtant comme s’il l’était, en plus gras.

### 2.1 Usure réelle `[FAIT]`

`réparation / case = wearPerCell × repairCostPerPoint`

| Machine | Achat | Usure / case | Réparer 1 pt | Coût usure / case |
|---------|------:|-------------:|-------------:|------------------:|
| Tracteur T1 | 3 200 | 0,7 | 8 | **5,6 CRD** |
| Moissonneuse T1 | 4 800 | 1,1 | 12 | **13,2 CRD** |
| Épandeur T1 | 1 800 | 0,45 | 6 | **2,7 CRD** |
| Déchaumeur | 2 100 | 0,3 | 5 | **1,5 CRD** |

### 2.2 Ce que paie le client `[FAIT]`

`contractorQuote = 120 + taux × N`  (−6 % de rendement en plus sur une moisson)

| Travail | Taux / case | 24 cases (un chantier) | 144 cases (parcelle 12×12) |
|---------|------------:|-----------------------:|---------------------------:|
| Semis | 22 | 648 | 3 288 |
| Épandage | 16 | 504 | 2 424 |
| **Moisson** | **38** | **1 032** | **5 592** |
| Labour | 14 | 456 | 2 136 |
| Déchaumage | 9 | 336 | 1 416 |

Une moisson PNJ sur **toute** la parcelle (5 592) coûte plus cher que la moissonneuse (4 800). C’est voulu **côté client** : au bout d’un cycle, acheter l’engin est rationnel. Ce n’est pas un salaire à verser au joueur qui clique « Faire ».

### 2.3 Ce que le tableau paie aujourd’hui `[FAIT]`

Usure factice : toujours **10 cases**, quelle que soit la ligne.

| Contrat affiché | Gain | Usure réparée | Net | Équivalent / case |
|-----------------|-----:|--------------:|----:|------------------:|
| Moisson blé — 12 ha | 850 (+5 % si spé ETA) | 132 | **≈ 718** | 85 CRD (client : 38) |
| Semis maïs | 560 | 56 | ≈ 504 | 56 (client : 22) |
| Labour | 420 | 56 | ≈ 364 | 42 (client : 14) |
| Épandage | 380 | 27–56 | ≈ 320+ | 38 (client : 16) |

C’est une planche à billets. Aucune parcelle n’est touchée. Un « ETA » de départ (tracteur + moissonneuse offerts) n’a qu’à cliquer.

### 2.4 Cultiver chez soi, pour comparaison `[TEST]`

Blé, cours initial 220 CRD/t, 0,35 t/case, semence 15 CRD/case. Chantier de **24 cases** :

| | CRD |
|--|----:|
| Vente grain | 1 848 |
| Semences | −360 |
| Usure moisson | −317 |
| **Net (hors sol / engrais)** | **≈ 1 170** |
| Temps | 3 min de pousse + le geste |

Le grain paie le temps d’attente. La mission ne doit **pas** approcher ce net, sinon plus personne ne sème.

---

## 3. Règle d’or — deux prix, pas un

```
Prix client     =  ce qu’on paie pour NE PAS avoir la machine     (déjà là)
Salaire mission =  ce qu’on gagne à sortir SON fer                (à créer)
```

Le second est un **pourcentage du premier**, jamais l’égal, tant que le donneur d’ordre est un PNJ. Entre joueurs, l’écart se resserre (les deux humains se partagent le surplus).

| Qui travaille | Ce que paie le client | Ce que touche le prestataire | Qualité |
|---------------|----------------------:|-----------------------------:|---------|
| Lui-même | 0 (usure seulement) | — | 100 % |
| **Joueur voisin** (P2P) | barème client | **85 %** du barème `[GD]` | −2 % |
| **Joueur sur ferme PNJ** | (la caisse monde) | **55 %** du barème `[GD]` | −4 % |
| **Urgent PNJ** (bouton actuel) | barème **+15 %** `[GD]` | 0 (l’argent sort de l’économie joueur) | −6 % (déjà là) |

`MISSION_NPC_SHARE = 0.55`  
`MISSION_P2P_SHARE = 0.85`  
`URGENT_NPC_SURCHARGE = 0.15`

Pourquoi 55 % : ça laisse un net d’appoint après usure, pas une rente. Pourquoi 85 % P2P : ça bat le PNJ pour le prestataire, et le client gagne encore en qualité (−2 % vs −6 %). L’urgent PNJ reste le filet pour celui qui est devant l’écran et qui n’attend pas.

### 3.1 Barème prestataire, chantier type (24 cases) `[GD]`

Quote client = `120 + taux × 24`. Salaire PNJ = 55 %.

| Travail | Client paie | Salaire mission | Usure (meilleure machine) | **Net prestataire** |
|---------|------------:|----------------:|--------------------------:|--------------------:|
| Moisson | 1 032 | 568 | 317 | **≈ 250** |
| Semis | 648 | 356 | 134 | **≈ 220** |
| Labour | 456 | 251 | 134 | **≈ 115** |
| Épandage (épandeur) | 504 | 277 | 65 | **≈ 210** |
| Déchaumage | 336 | 185 | 36 | **≈ 150** |

Ordre de grandeur : **100 à 250 CRD par chantier**, pour un vrai passage sur 24 cases. Un blé à soi sur la même surface reste ~1 170. L’appoint est visible, pas dominant.

### 3.2 Garde-fous anti-rente `[GD]`

Sans ça, un joueur saturé de fer ne cultive plus.

1. **Taille.** Un chantier NPC fait **8 à 24 cases**, jamais 144 d’un clic. Une parcelle PNJ se découpe en plusieurs lignes au tableau.
2. **Offre.** Par région : **au plus 3 chantiers ouverts** à la fois `[TEST]`. Pas de file infinie.
3. **Expiration.** Si personne n’a pris avant l’échéance (maturité, consigne), le PNJ le fait lui-même : la ligne disparaît, personne n’est payé.
4. **Machine exigée, à soi, en état.** Pas de location magique. Condition ≥ `minCondition`. Déjà l’esprit de `pickMachineForWork`.
5. **Une mission à la fois.** Pas de batch « Faire tout ».
6. **Pas de bonus de spé.** Plus de `+5 %` ni de `+25 XP`. Même XP que n’importe quel travail (15).

Parcelle entière 12×12, **si** on la découpe en 6 chantiers de 24 (moisson) : 6 × 250 = 1 500 CRD de net, mais six allers, six usures, six créneaux. Cultiver sa propre 12×12 de blé : 144 × 0,35 × 220 − 144 × 15 − 144 × 13,2 ≈ **7 000 CRD**. L’appoint ne rattrape pas une ferme.

### 3.3 Côté client — inchangé dans l’esprit

Le céréalier **sans** moissonneuse continue de payer le barème pour faire venir quelqu’un. C’est le tutoriel du matériel, pas une punition d’ETA.

Seuil d’achat déjà codé : `contractorBreakEvenCells("HARVEST", 4800) = 127 cases` ≈ une parcelle. On le **montre** au garage : « Encore ~N cases sous-traitées avant que l’engin soit rentabilisé. »

Urgent PNJ : même geste qu’aujourd’hui, **+15 %**, instantané, malus −6 %. On l’utilise quand on ne veut pas attendre qu’un voisin prenne.

---

## 4. Conséquences sur l’identité

| Avant (spé ETA) | Après |
|-----------------|--------|
| 3e choix à l’installation | **Céréalier** ou **Éleveur** seulement |
| Kit ETA : tracteur **+ moissonneuse**, champ quand même | Tout le monde : kit de son métier. La moissonneuse **s’achète** |
| `SPECIALIZATION_BONUSES.ETA` +2 % vitesse | Supprimé |
| `etaBonus` usure −10 %, graisse obligatoire, `ETA_REPAIR_EXTRA_DISCOUNT −25 %` | Entretien **ouvert à tous** (geste utile dès qu’on enchaîne), **sans** remise de caste |
| Bureau « C’est le métier d’une ETA » | Bureau **« Travaux à façon »** : « Votre fer est idle ? Il y a des cases à côté. » |
| Glisser (1 doigt) réservé à `specialization === "ETA"` | Glisser = **mode mission** (chez l’autre). Chez soi : sélection + passage auto, inchangé |
| Contrats fantômes | Disparaissent dès qu’un chantier pointe une parcelle. En attendant : **même barème 55 %**, usure = cases affichées |

Migration des comptes déjà `ETA` : recode en `CEREALIER`. Ils gardent leurs machines (y compris la moissonneuse de trop) — c’est un avantage de pionnier, pas un rollback.

Changer de métier plus tard (céréalier ↔ éleveur) : hors sujet ici. Pas de troisième case.

---

## 5. Ce qu’on garde du triangle (49)

Le 49 a raison sur **l’infrastructure**, tort sur **l’identité**.

On garde :

- Un chantier = une parcelle réelle, des cases, une machine exigée, une échéance, un escrow.
- L’absence d’un joueur **publie** une offre (consigne « si mûr »).
- Filet PNJ toujours là (urgent, ou expiration).
- Pas de bouton grisé « vous n’êtes pas ETA ».
- Ponts matière céréalier ↔ éleveur (paille, ensilage, lisier) : **inchangés**, ce n’est pas de l’ETA.

On ne fait pas :

- Kit « pas de champ, hangar + atelier + une machine chère ».
- Mini-jeux réservés à une caste.
- Conducteurs PNJ / flotte « je suis une entreprise ». Trop tôt, et ça re-fabrique le métier.
- XP / usure / réparation différentes selon une étiquette.

L’atelier reste un **bâtiment** (−10 % déjà là) que n’importe qui peut poser. Ce n’est plus « la ferme de l’ETA ».

---

## 6. Boucle économique fermée (solo)

```
Céréalier sans moissonneuse
    paie 1 032  ──►  caisse monde (urgent PNJ)
                         │
                         │ finance le salaire des missions PNJ
                         ▼
Joueur avec moissonneuse idle
    prend 24 cases PNJ  ──►  encaisse 568, use 317, net ≈ 250
```

L’argent du client qui **n’attend pas** sort du jeu (sink). L’argent des missions PNJ est un **faucet** calibré, alimenté par le fait que des fermes PNJ existent et mûrissent. Les deux doivent rester du même ordre sur une région, sinon inflation.

P2P : escrow. 1 032 bloqués chez le client → 85 % = 877 au prestataire, 15 % = 155 **rendu au client** (rabais automatique d’avoir attendu un voisin) `[GD]`. Variante à tester : 100 % au prestataire, client paye le barème plein, gagne seulement en qualité. **Décision à trancher au playtest** ; défaut proposé = rabais 15 % + qualité −2 %.

---

## 7. Plan d’implémentation

Rien de tout ça n’est un DLC. C’est du recâblage de ce qui existe (`contractorQuote`, `NpcContract`, `pickMachineForWork`, `strokeWork`).

| # | Brique | Effet joueur | Risque |
|---|--------|--------------|--------|
| **A** | **Barème unique** dans `packages/shared` : `missionPayout(work, cells, kind)` | Les chiffres du § 3 existent en code, testés | Faible |
| **B** | **Nerf / recalage des `NpcContract`** : `rewardCrd = missionPayout(..., "NPC")` pour 10 cases (moisson **275** au lieu de 850) ; retirer le +5 % ETA | Le tableau arrête d’imprimer des CRD | Faible — les pionniers ETA le sentiront |
| **C** | **Spé à 2** : onboarding, `/world/claim`, `Specialization = "CEREALIER" \| "ELEVEUR"` ; migrate `ETA` → `CEREALIER` | Plus de 3e carte métier | Moyen — textes guide / tutoriel |
| **D** | **Soins machines pour tous** : graisse / saleté ne lisent plus `specialization === "ETA"` | L’atelier sert dès qu’on enchaîne, y compris en mission | Moyen — UI garage |
| **E** | **Mode mission** : `strokeWork` si on est *en chantier chez l’autre*, pas si on est ETA | Le geste « glisser » veut dire « je suis en prestation » | Moyen |
| **F** | **Chantier réel PNJ** | Le tableau pointe une parcelle, on y entre, les cases changent, on est payé au 55 % | Fort — fermes PNJ (49 § 9), pas encore là |
| **G** | **P2P + consignes** | Un joueur publie, l’autre prend, escrow 85 % | Fort — dépend de F |

Ordre : **A → B → C** (jouable dès la semaine, économie honnête) puis D, E. **F et G** restent le vrai jeu ; sans eux on a un tableau moins mensonger, pas encore l’appoint spatial.

Critère d’arrêt de A–C : un testeur avec moissonneuse qui enchaîne le tableau gagne **moins** en 10 min que s’il avait semé et vendu 24 cases de blé. Aujourd’hui c’est l’inverse.

---

## 8. Textes UI (cible)

- Bureau : **Travaux à façon** — « Cases à travailler dans la région. Il faut l’engin, et qu’il tienne. »
- Dock champ, sans la machine : **Faire venir une entreprise — N CRD** (plus le mot « ETA » comme identité).
- Toast mission : **Chantier honoré · +568 CRD · usure moissonneuse 24 %**.
- Guide : le chapitre « Les trois métiers » devient **« Cultiver, élever, et le fer des autres »**. Deux métiers. Le troisième paragraphe est l’appoint.

---

## 9. Décision demandée

À valider, dans l’ordre :

1. **Pas de spé ETA.** Céréalier / éleveur seulement.
2. **Deux prix.** Client = barème actuel. Prestataire NPC = 55 %. P2P = 85 % + qualité −2 %.
3. **Chantiers 8–24 cases**, max 3 ouverts / région, une mission à la fois.
4. **Ordre A–C d’abord** (chiffres + onboarding), F–G ensuite (vraies parcelles).

Les constantes `MISSION_NPC_SHARE` / `MISSION_P2P_SHARE` se calibrent en jouant. Les quatre points ci-dessus, non : c’est le mur porteur.
