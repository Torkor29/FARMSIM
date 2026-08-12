# 37 — Élevage au pré, prestation ETA, revente

**Statut :** Implémenté  
**Date :** 2026-08-12  
**Voir aussi :** [07_ANIMAL_SYSTEM](./07_ANIMAL_SYSTEM.md) · [36_SYSTEMS_V2](./36_SYSTEMS_V2.md)

---

## 1. Le mot ETA était employé à contresens

**ETA = Entreprise de Travaux Agricoles.** Une ETA travaille les terres
d'autrui avec ses propres machines. Le jeu utilisait le sigle pour désigner
un panneau contenant le stock, le marché et l'achat de terres — sans rapport.

| Avant | Après |
|-------|-------|
| Bouton « ETA Presta » | Bouton **« Bureau »** |
| Section « Missions ETA » | Section **« Travaux à façon »**, avec définition du sigle |
| Classe « Entrepreneur (ETA) » | **« ETA — Travaux agricoles »** |

---

## 2. Faire venir une ETA

Un joueur sans moissonneuse était bloqué : la récolte exigeait la machine, et
la machine coûte 4 800 CRD. C'est précisément le cas que le métier d'ETA
existe pour résoudre.

Dès qu'une sélection de travail est faite, un bouton propose la prestation.

| Travail | Tarif à la case | Frais de déplacement |
|---------|-----------------|----------------------|
| Semis | 22 CRD | 120 CRD |
| Épandage | 16 CRD | 120 CRD |
| Moisson | 38 CRD | 120 CRD |

Le prestataire ne connaît pas la parcelle aussi bien que son exploitant :
**−6 % de rendement**. Aucune usure machine, puisque ce sont les siennes.

`contractorBreakEvenCells()` donne le seuil à partir duquel acheter sa propre
machine devient rentable — pour afficher un conseil honnête plutôt que
vendre du service à perte.

**API :** `POST /parcels/:id/contractor` — `{ work, crop?, cells[] }`

---

## 3. Revente

| Bien | Taux | Modulation |
|------|------|------------|
| Machine | 55 % | × (0,45 + état × 0,55) — une épave ne vaut presque rien |
| Bâtiment | 40 % | Porte sur le coût cumulé, niveaux d'agrandissement compris |

Démolir un hangar ne détruit pas les engins qu'il abritait : ils ressortent.
Vendre un engin stationné libère sa case.

**API :** `POST /machines/:id/sell` · `POST /buildings/:id/sell`

---

## 4. Élevage : l'étable seule ne suffit pas

C'est la demande centrale. Une étable **enferme**. Un enclos posé contre elle
**ouvre**.

### Bien-être

Le bonheur est une relaxation exponentielle vers une cible :

- **Sans enclos** → cible = plancher **0,35**. Une bête correctement nourrie
  mais jamais sortie n'est pas maltraitée, elle est *sans plus*.
- **Sortie récente** → cible = plafond **0,95**
- **Surpeuplement** au-delà de 85 % d'occupation → jusqu'à −0,30 sur la cible,
  seul cas qui pousse sous le plancher

La montée est trois fois plus rapide que la descente : le joueur voit
immédiatement l'effet d'une bonne décision, et paie lentement une négligence.

### Ce que le bonheur rapporte

| Production | Écart enfermé → au pré |
|------------|------------------------|
| Lait | jusqu'à **+32 %** |
| Viande à l'abattage | jusqu'à **+22 %** |

Pour la viande, le bonheur courant sert de proxy du bonheur *cumulé* : la
relaxation exponentielle **est** déjà une moyenne mobile des conditions de vie
récentes.

### L'enclos

Nouveau type de bâtiment, 3×3, 1 210 CRD.

| Règle | Valeur |
|-------|--------|
| Places de sortie | 2 par case, soit 18 pour un 3×3 |
| Surface minimale | 6 cases — en deçà c'est un couloir, capacité nulle |
| Adjacence | **bord commun obligatoire**, la diagonale ne compte pas |

Un enclos posé à l'autre bout de la ferme existe mais ne sert à rien, et le
panneau le dit.

### Sortie au pré

Refusée par **orage** ou **neige**, si l'enclos est plein, ou pour les porcs.
Le motif du refus s'affiche en clair.

Les bêtes sortent par vagues de 8. En 3D, chaque vache a sa propre
trajectoire, sa propre allure et son propre rythme de broutage — un troupeau
qui se déplacerait d'un bloc ne tromperait personne. Huit bêtes visibles au
maximum : au-delà l'enclos devient illisible.

### Tempo

Un cycle d'élevage vaut **une saison** (15 minutes), pas 24 heures réelles.

C'est le correctif qui rend la fonctionnalité perceptible : calé sur
l'horloge murale, le bien-être n'aurait jamais bougé sous les yeux du joueur.
Mesuré en jeu, la jauge passe de 58 % à 64 % en une minute après une sortie,
et le lait suit de 113 L à 118 L.

**API :** `GET /parcels/:id/livestock` · `POST /buildings/:id/animals` ·
`POST /herds/:id/graze`

---

## 5. Assets

Seize illustrations isométriques s'ajoutent aux huit bâtiments existants,
toutes dans la même charte : toit vert sarcelle, bois miel, socle en tuile
d'herbe.

| Famille | Contenu |
|---------|---------|
| Cultures | blé jeune, blé mûr, maïs mûr, terre labourée |
| Véhicules | tracteur, moissonneuse, épandeur |
| Animaux | vache, cochon |
| Bâtiments | enclos, étable avec pré |
| Métiers | céréalier, éleveur, ETA |
| Objets | bottes de paille, grain |

**692 Ko** pour l'ensemble du dossier, après détourage et conversion WebP.

---

## 6. Reste à faire

- La traite et l'abattage ne sont pas encore des actions : le lait et la
  viande sont calculés et affichés, mais rien ne les récolte
- Le fourrage n'est pas consommé — `feedConsumption()` existe et est testée
- Les porcs n'ont pas d'équivalent de l'enclos
- Les niveaux de bâtiment changent de taille, pas de forme, alors que la
  planche de référence les remodèle
