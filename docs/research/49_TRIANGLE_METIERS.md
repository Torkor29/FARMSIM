# 49 — Le triangle des métiers

**Statut :** Stratégie — à valider avant toute ligne de code  
**Date :** 2026-08-13  
**Remplace :** la lecture de [48_PLAN_MECANIQUES.md](./48_PLAN_MECANIQUES.md) sur les métiers, l'absence et les salariés. Le 48 reste le plan d'exécution des briques (paille, ensilage, saisons, CUMA). Celui-ci dit **pourquoi** elles existent et **comment** elles s'emboîtent.

---

## 1. Thèse

Allonger le temps de jeu n'est pas le but. Le but est que **céréalier, éleveur et ETA ne puissent pas gagner leur vie l'un sans les deux autres**. Le temps de jeu s'allonge alors tout seul : chaque récolte ouvre trois chantiers, chaque absence ouvre un contrat, chaque troupeau ouvre un débouché.

La correction décisive, par rapport au plan 48 :

> Si un joueur appelle une ETA pendant son absence, **c'est le jeu**. L'ETA a besoin de travailler les parcelles et les terres des autres. Elle a besoin d'intervenir.

L'absence n'est pas un trou à boucher par de l'automatisation. L'absence d'un métier **est l'offre de travail de l'autre**.

```
                    paille, grain, ensilage
         Céréalier ──────────────────────────► Éleveur
             │                                    │
             │ chantiers                          │ chantiers
             │ (moisson, sol, pressage)           │ (litière, lisier, ration)
             │                                    │
             └──────────────► ETA ◄───────────────┘
                    travail sur LES TERRES DES AUTRES
                    fumier / lisier en retour vers le céréalier
```

Trois flux, pas un. **Matière, travail, calendrier.** Si une brique n'alimente pas au moins deux métiers, on ne la construit pas.

---

## 2. Diagnostic — ce qui existe vraiment

Les trois métiers sont une étiquette. Rien d'autre.

| Ce que le jeu promet | Ce que le jeu fait |
|----------------------|--------------------|
| Choisir céréalier / éleveur / ETA à l'installation | `SPECIALIZATION_BONUSES` : +2 % sur un domaine. Invisible. |
| L'ETA travaille chez les autres | `NpcContract` : un titre, une récompense, une usure forfaitaire. **Aucune parcelle n'est touchée.** |
| Faire venir une ETA sur sa terre | `POST /parcels/:id/contractor` : un PNJ instantané, −6 % de rendement, l'argent disparaît. **Aucun joueur ETA n'est appelé.** |
| L'éleveur a besoin du céréalier | Le foin et le maïs grain existent. La paille n'existe pas. L'ensilage n'existe pas. On peut tout acheter au marché NPC. |
| Le monde tourne sans vous | La fenêtre de récolte punit l'absence. Les bêtes meurent. **Personne n'en profite.** L'absence est une amende, pas un contrat. |

Conséquence : un céréalier seul peut tout faire s'il achète une moissonneuse. Un éleveur seul achète au marché. Un ETA clique des contrats fantômes. Les trois boucles sont parallèles. Elles ne se croisent jamais.

C'est ça qu'il faut casser.

---

## 3. Loi du triangle

Cinq règles. Elles tranchent les débats avant qu'ils n'arrivent.

1. **Pas de mur de métier.** Un céréalier peut acheter une moissonneuse. Un éleveur peut semer du maïs. Un ETA peut avoir un petit champ. La spécialisation est une *pente*, pas une porte. On est meilleur chez soi, plus cher ailleurs, moins bien équipé au départ.
2. **Deux marchés, toujours.** Marché des matières (grain, paille, ensilage, lisier, lait, viande) et bourse des chantiers (labour, semis, moisson, pressage, épandage, transport). Chaque métier est vendeur sur l'un, client sur l'autre.
3. **Filet PNJ, préférence joueur.** Solo, le triangle est tenu par des fermes PNJ. Dès qu'un joueur peut tenir le rôle, il gagne : mieux payé, mieux servi, meilleure qualité. Le PNJ est le plancher, jamais le plafond.
4. **L'absence publie une offre.** Se déconnecter n'arrête pas l'exploitation : ça convertit l'état de la ferme en chantiers et en ordres d'achat. Le joueur qui revient lit un rapport, pas une amende silencieuse.
5. **Être présent reste supérieur.** Une ETA à l'écran prend les chantiers d'urgence, soigne mieux, facture plus. Un céréalier à l'écran choisit le moment, évite le malus, presse lui-même. L'absence fait tourner le triangle ; la présence le fait **mieux** tourner. On n'achète pas le droit de ne plus jouer.

---

## 4. Ce que chaque métier *est*

Pas des bonus. Des façons de gagner sa vie, des kits de départ, des dépendances, un échec propre.

### 4.1 Céréalier — « je fais pousser, je ne tiens pas tout le matériel »

**Gagne sa vie** en vendant du grain, de la paille, de l'ensilage, parfois des pois. Encaissement par à-coups, calé sur les récoltes.

**Kit de départ** `[GD]` : tracteur + déchaumeur (ou charrue), semences, une parcelle. **Pas de moissonneuse.** La première moisson est un appel d'ETA. C'est le tutoriel du triangle, pas un manque.

**Vend à l'éleveur :** paille, ensilage, grain fourrager. Prix local > cours mondial, parce que le transport est déjà fait et la qualité connue.

**Vend à l'ETA :** des chantiers. Moisson, labour, pressage, épandage. Plus il a de terres, plus il *doit* sous-traiter : une seule moissonneuse ne couvre pas trois parcelles mûres le même jour.

**Achète à l'éleveur :** fumier / lisier (azote organique, moins cher que l'engrais de synthèse, plus lent).

**Achète à l'ETA :** le travail qu'il n'a pas le temps ou le matériel de faire.

**Échec propre :** culture trop mûre → décote puis perte (déjà en place, doc 38). Sans consigne d'ETA, c'est une amende. Avec consigne, c'est un chantier — l'ETA encaisse, le céréalier sauve une partie.

**Session type, présent :** semer / travailler le sol / décider grain vs ensilage / presser ou enfouir / vendre. 20–40 min.
**Session type, retour d'absence :** lire le rapport, ajuster les consignes, décider la suite. 5–10 min.

### 4.2 Éleveur — « je transforme la matière des autres en lait et viande »

**Gagne sa vie** en vendant du lait (revenu régulier, collecte) et de la viande (à-coups). Le lisier est un sous-produit qui a une valeur *s'il part*, un coût s'il reste.

**Kit de départ** `[GD]` : étable + petit troupeau + **deux jours** de fourrage et de litière. Pas de champ, ou un minuscule pré. Au bout de deux jours, il doit acheter — au céréalier de la région, ou au marché NPC plus cher.

**Vend au céréalier :** lisier / fumier.
**Vend à l'ETA :** des chantiers d'épandage, de livraison de fourrage, plus tard de collecte du lait si la laiterie n'est pas passée.

**Achète au céréalier :** paille (litière), ensilage, grain.
**Achète à l'ETA :** l'épandage (il n'a pas de tonne à lisier), parfois la livraison.

**Échec propre :** sans litière, hygiène ↓, lait ↓, maladie. Sans fourrage, bonheur ↓, mortalité (déjà en place). Fosse à lisier pleine → production bloquée jusqu'à épandage. Ces trois pannes sont des **commandes** pour les deux autres métiers.

**Session type, présent :** rations, sortie au pré, traite / tank, commandes de fourrage, gestion de la fosse. 15–30 min, plus souvent que le céréalier.
**Session type, retour :** le troupeau a vécu. Le rapport dit qui a livré, ce que ça a coûté, ce qui manque.

### 4.3 ETA — « mon outil de production, ce sont les terres des autres »

**Gagne sa vie** en vendant du *travail*. Elle ne produit aucune matière. Pas de récolte à elle, pas de lait à elle. Son chiffre d'affaires est la somme des chantiers honorés. Sa charge, c'est le matériel : achat, usure, gasoil, hangar.

**Kit de départ** `[GD]` : **une** machine chère (moissonneuse *ou* gros tracteur + un outil), un hangar, **pas de parcelle agricole** — un dépôt. Le premier contrat est une parcelle mûre, PNJ ou joueur, **visible sur la carte**. On y entre. On travaille. On est payé.

**Vend aux deux autres :** capacité. Moisson, ensilage, pressage, labour, épandage, transport. L'ensileuse et la presse sont *ses* machines emblématiques : trop chères, trop saisonnières pour qu'un céréalier les amortisse seul.

**Achète :** rien en matière agricole. Du gasoil, des pièces, plus tard des salariés (voir § 8.4). Elle a besoin que les deux autres **existent et plantent**. Une région sans céréaliers est une ETA au chômage.

**Échec propre :** machines qui s'usent à l'arrêt (traites, hangar), file d'attente vide, réputation qui glisse si on lâche un chantier. Être hors-ligne pendant la fenêtre de moisson, c'est laisser les chantiers aux autres ETA — joueurs ou PNJ.

**Session type, présent :** lire la bourse, enchaîner 3–8 chantiers, réparer, repositionner. C'est le métier *le plus* présent pendant les pics. 30–60 min d'affilée.
**Session type, calme :** entretien, achat d'un second outil, élargir la zone, régler les filtres de la flotte. 10 min.

L'ETA n'est pas un céréalier sans champ. C'est un entrepreneur dont le planning *est* le jeu.

---

## 5. Les deux marchés, en exact

### 5.1 Marché des matières

Déjà là pour le grain, le lait, la viande, le foin, le pois. À étendre, pas à remplacer.

| Bien | Producteur | Client naturel | Filet NPC | Particularité |
|------|------------|----------------|-----------|---------------|
| Blé, pois | Céréalier | Marché, un peu l'éleveur | Cours mondial | Déjà en place |
| Maïs grain | Céréalier | Marché + éleveur (concentré) | Cours mondial | Déjà en place |
| Maïs ensilage | Céréalier | **Éleveur seulement** | Achat NPC cher, vente NPC quasi nulle | Pont métier. Décision au semis. |
| Paille | Céréalier | **Éleveur** (litière) | Cours bas, profondeur faible | Pont métier. Concurrent du déchaumage. |
| Fumier / lisier | Éleveur | **Céréalier** | Le céréalier peut rester à l'engrais de synthèse | Pont métier. Coût de stockage si personne n'en veut. |
| Lait, viande | Éleveur | Marché / laiterie | Déjà en place | Collecte = chantier de transport possible |

Règle de prix `[GD]` :

- **Joueur → joueur, même région, livré :** +8 à +15 % pour le vendeur par rapport au cours, −5 à −10 % pour l'acheteur par rapport au négociant + transport. Les deux gagnent. C'est ça qui rend le voisin meilleur que le marché.
- **NPC :** toujours disponible. Toujours moins bon. C'est le filet, pas le métier.

### 5.2 Bourse des chantiers

C'est la pièce manquante. Aujourd'hui il y a deux systèmes qui ne se parlent pas : le bouton « faire venir une ETA » (PNJ instantané) et le tableau « Travaux à façon » (contrats fictifs). **Un seul objet les remplace.**

Un chantier, c'est :

```
Chantier
  client        joueur ou ferme PNJ
  parcelle      id réel, on peut s'y rendre
  cases         liste, état du sol / de la culture
  type          PLOW | SOW | FERTILIZE | HARVEST | BALE | SPREAD | TRANSPORT | ENSILE
  échéance      héritée de la fenêtre (maturité, fosse pleine, etc.)
  offre         CRD proposés par le client, ou tarif barème
  matériel exigé
  statut        OUVERT → PRIS → EN COURS → LIVRÉ | RATÉ | REPRIS_PNJ
```

**Naissance d'un chantier** — trois sources, une seule file :

1. **Le client est là** et publie (« moissonnez-moi ces 24 cases, 900 CRD, dans 20 min »).
2. **Le client est parti** et une consigne a tiré (« si mûr, publier moisson au barème »).
3. **Une ferme PNJ** a atteint le même état. Elle publie au barème, un peu moins-disante.

**Exécution** — trois issues, dans l'ordre :

1. Une **ETA joueur** prend le chantier, se rend sur la parcelle, travaille avec *ses* machines, animation réelle, usure réelle, paiement escrow.
2. Personne ne prend avant l'échéance de confort → **ETA PNJ** au tarif actuel (`contractorQuote`), malus −6 %, instantané ou après un court délai visible.
3. Personne ne prend avant l'échéance dure (culture perdue, fosse qui déborde) → sauvetage PNJ **plus cher**, ou échec si le client a interdit le sauvetage.

Le bouton actuel « faire venir une ETA » devient **« Urgent PNJ »** : on paie le filet tout de suite, sans passer par la bourse. C'est plus cher d'un cran `[GD]` +15 % sur le devis. On l'utilise quand on est devant l'écran et qu'on ne veut pas attendre. Ce n'est plus le chemin par défaut.

**Malus de qualité** `[GD]` :

| Qui travaille | Malus rendement / qualité |
|---------------|---------------------------|
| Le propriétaire lui-même | 0 |
| ETA joueur, réputation haute | −2 % |
| ETA joueur, réputation basse | −5 % |
| ETA PNJ | −6 % (déjà en place) |

L'ETA joueur bat toujours le PNJ. Le propriétaire bat toujours l'ETA. Les trois options restent rationnelles selon le temps, le matériel et le nombre de parcelles.

---

## 6. L'absence n'est pas un trou — les consignes

Panneau **Consignes**, dans le Bureau. C'est le mode de jeu de celui qui part, et le carnet de commandes de celui qui reste.

### 6.1 Forme d'une consigne

```
Quand  [déclencheur]
Faire  [action]
Avec   [plafond CRD, priorité de parcelle, PNJ autorisé oui/non]
```

Déclencheurs, métier par métier :

| Métier | Déclencheur | Action typique |
|--------|-------------|----------------|
| Céréalier | Culture à point | Publier moisson |
| Céréalier | Andain au sol > N heures | Publier pressage, ou enfouir |
| Céréalier | Après moisson, chaumes | Publier déchaumage / labour |
| Céréalier | Cours blé > seuil | Vendre N tonnes |
| Éleveur | Fourrage < 2 jours | Acheter au voisin, sinon marché |
| Éleveur | Paille litière < 1 jour | Idem |
| Éleveur | Fosse lisier > 80 % | Publier épandage (chez soi ou chez un céréalier) |
| Éleveur | Tank lait plein | Publier collecte / vente laiterie |
| ETA | Chantier ouvert, marge > X, rayon < Y | Accepter automatiquement *(flotte, § 8.4)* |

### 6.2 Ce que ça produit

Le céréalier qui s'absente **crée du travail**. L'ETA n'attend pas que quelqu'un clique un contrat fantôme : elle voit une parcelle mûre, un nom, un tarif, une échéance. Elle y va. C'est pour ça qu'elle a acheté une moissonneuse.

L'éleveur qui s'absente **crée de la demande de matière**. Un céréalier de la région écoule sa paille. Une ETA livre.

L'ETA qui s'absente **laisse la place**. Les chantiers vont aux autres ETA, ou au PNJ. Si elle a une flotte, ses machines tournent moins bien, moins cher, et elle encaisse une partie. Être là pendant le pic reste le meilleur coup.

### 6.3 Le rapport de retour

À la reconnexion, un écran unique, pas une liste de toasts :

> Pendant votre absence (4 h 12)  
> — ETA *Martin* a moissonné la parcelle nord, 24 cases, −890 CRD, +4,2 t blé, −2 % (réputation 72).  
> — Andain pressé par ETA PNJ, +1,8 t paille.  
> — 1,8 t paille achetées par *Élevage Lefèvre* à 108 CRD/t.  
> — Déchaumage non fait : consigne plafonnée, budget restant 40 CRD.

On peut tout retracer. Une règle que le joueur ne peut pas vérifier est vécue comme un bug — c'est déjà arrivé avec le labour.

### 6.4 Garde-fous

- Plafond de dépense obligatoire. Sans plafond, une absence vide le compte.
- Les consignes ne font **jamais** semer une culture nouvelle : trop de décision. Elles enchaînent ce qui est déjà engagé (récolter, presser, enfouir, nourrir, épandre).
- Une culture perdue reste possible si le client a interdit le PNJ *et* qu'aucune ETA n'a pris. C'est un choix, affiché en rouge dans les consignes.

---

## 7. Modes de jeu

Pas des playlists séparées. Trois façons d'habiter le même monde, plus une entente optionnelle.

### Mode S — Solo, triangle PNJ

Le joueur choisit un métier. Les deux autres existent comme **fermes PNJ de sa région**, sur de vraies parcelles, visibles sur la carte, nommées.

- 4 à 8 fermes PNJ par région `[TEST]` : mix céréaliers / éleveurs.
- Elles sèment, mûrissent, publient des chantiers, achètent de la paille, vendent du lisier, au tick monde.
- L'ETA joueur travaille **chez elles**. Le céréalier joueur leur vend. L'éleveur joueur leur achète.
- L'ETA PNJ reste le filet pour le joueur qui embauche.

C'est le mode par défaut tant qu'une région n'a pas assez de joueurs. Il n'y a pas de bouton « solo / multi ».

### Mode R — Région mixte (le vrai jeu)

Joueurs + PNJ sur la même bourse et le même marché local.

- Un chantier joueur paie mieux qu'un chantier PNJ (+10 à +20 % `[GD]`). L'ETA priorise les voisins.
- Un voisin éleveur paie mieux que le cours pour la paille. Le céréalier priorise le voisin.
- Les fermes PNJ comblent les trous (région vide le mardi matin, pic le dimanche soir).
- La carte distingue clairement : parcelle joueur, parcelle PNJ, parcelle libre.

### Mode E — Entente (plus tard, après la CUMA)

Trois joueurs se lient : un de chaque métier. Contrats internes à tarif préférentiel, machines éventuellement en CUMA, objectif commun (quota lait, surfaces, chiffre ETA).

Ce n'est **pas** requis pour que le triangle marche. C'est la cerise, pas le gâteau. On ne le code pas avant que S et R existent.

### Ce que chaque métier joue, en une phrase

| Métier | Fantaisie | Pic de présence | Calme |
|--------|-----------|-----------------|-------|
| Céréalier | Faire le plus de terre possible sans tout posséder | Semis et décisions grain/ensilage/paille | Attendre, vendre, consignes |
| Éleveur | Transformer la matière du voisin, tous les jours | Ration, lisier, commandes | Collecte, rapport |
| ETA | Être la machine que les autres n'achètent pas | Fenêtres de moisson / ensilage | Entretien, zone, flotte |

Le « mode de jeu » *est* le métier. On ne fait pas trois jeux dans un. On fait un monde où les trois horloges s'emboîtent.

---

## 8. Complémentarité concrète — les ponts, un par un

Chaque pont dit : qui donne, qui reçoit, ce qu'on voit, ce qui se passe si on refuse.

### 8.1 Paille (céréalier → éleveur, chantier ETA)

Voir 48 phase 1, inchangé sur le geste. Ce qui change : **la destination**.

- Presser + vendre à l'éleveur voisin : revenu, litière chez lui, plus de bonus résidus chez soi.
- Enfouir : sol, zéro paille, l'éleveur achète au NPC.
- Laisser l'andain : la pluie l'abîme, puis un chantier de pressage s'invite tout seul si consigne.

L'ETA possède la presse. Le céréalier peut l'acheter plus tard. L'éleveur, presque jamais.

### 8.2 Ensilage (céréalier → éleveur, *signature* ETA)

Voir 48 phase 2. Décision au semis. L'ensileuse est trop chère et trop saisonnière : c'est **le** matériel d'ETA.

Un céréalier qui sème de l'ensilage *sans* ensileuse a déjà décidé d'appeler une ETA. Un éleveur qui en commande a déjà décidé de dépendre d'un céréalier. Le pont est obligatoire par construction, pas par tutoriel.

### 8.3 Lisier (éleveur → céréalier, chantier ETA)

La fosse se remplit au tick. Seuil 80 % → chantier d'épandage.

- Épandre chez le céréalier voisin : lui gagne de l'azote, l'éleveur se vide, l'ETA facture le transport + la rampe.
- Épandre chez soi (si l'éleveur a un champ) : plus simple, moins bon agronomiquement s'il n'a rien à fertiliser.
- Refuser : à 100 %, la production animale **s'arrête**. Visible. Pas une mort silencieuse.

Le céréalier peut rester à l'engrais de synthèse. Le lisier est moins cher à l'unité d'azote, plus contraignant (fenêtre, odeur = délai, chantier). Arbitrage, pas péage.

### 8.4 Flotte de l'ETA — l'équivalent des consignes, pas des « salariés qui jouent à votre place »

Le 48 hésitait : les salariés raccourcissent le temps de jeu. Mauvaise question.

La bonne : **quand l'ETA s'absente, que deviennent ses machines ?**

Réponse alignée sur la thèse :

- Par défaut, elles **dorment**. Les chantiers vont aux autres. C'est juste. Une ETA absente libère du travail, comme un céréalier absent en crée.
- En tardif, on débloque des **conducteurs PNJ** (1, puis 2). Ils utilisent *les machines du joueur*, usure réelle, salaire au chantier, malus qualité type PNJ. Filtres : type de chantier, rayon, marge minimum.
- Ils ne prennent **jamais** les chantiers marqués urgents / haute réputation si une ETA joueur est en ligne dans la région — le présent gagne.

Ce n'est pas « le jeu se joue tout seul ». C'est l'ETA qui vend de la capacité. Acheter la deuxième moissonneuse n'a de sens que si quelqu'un la conduit. Le joueur reste le dispatch : filtres, zone, entretien, achats. Les pics, il les joue.

Plafond `[GD]` : 2 conducteurs. Coût élevé. Qualité inférieure. Jamais au départ.

### 8.5 Fenêtre de récolte (déjà là) — elle devient un appel d'offres

La doc 38 punit l'absence. On ne retire pas la punition. On la **convertit**.

Culture à point → consigne → chantier. Si une ETA prend, le céréalier sauve le rendement (moins le malus, moins le tarif). Si personne ne prend et que le PNJ est interdit, la décote suit son cours. La mécanique actuelle reste le plancher de vérité.

### 8.6 CUMA (en dernier)

Achat commun d'une ensileuse, d'une presse, d'une tonne à lisier. Calendrier de partage. Naturel **après** que ces machines existent et qu'on a senti qu'on ne peut pas les amortir seul.

La CUMA n'est pas un quatrième métier. C'est le céréalier et l'ETA (parfois l'éleveur) qui mettent en commun ce que le triangle a rendu trop cher.

---

## 9. Fermes PNJ — le filet qui rend le solo vrai

Sans elles, l'ETA n'a personne à servir le mardi, et l'éleveur n'a pas de paille si le voisin céréalier n'est pas encore arrivé.

### 9.1 Occupation

À la génération d'une région, une fraction des parcelles est attribuée à des **fermes PNJ** (`ownerKind: NPC`). Elles apparaissent occupées, avec un nom, un métier affiché.

`[GD]` : ~30 % des cases d'une région neuve. Les parcelles déjà prises par des joueurs ne bougent pas. Sur un monde déjà déployé, on n'installe des PNJ **que** sur du vide.

Elles n'achètent pas de terres ensuite. Elles ne meurent pas. Elles ne parlent pas. Elles publient et achètent.

### 9.2 Comportement

Tick monde, mêmes règles que le joueur, en plus simple :

- Céréalier PNJ : rotation blé / maïs / pois, publie moisson et pressage, vend le surplus de paille.
- Éleveur PNJ : troupeau stable, achète paille et ensilage en priorité joueur local, publie l'épandage.

Ils paient un peu moins que le barème joueur. Un ETA rationnel sert d'abord les humains.

### 9.3 Ce qu'on voit

Sur la carte région : pastille métier. Sur leur parcelle : on peut **entrer** en mission (ETA) ou passer un ordre de matière (céréalier / éleveur). Même vision isométrique que sa propre ferme, en lecture seule hors du chantier accepté.

Si on ne peut pas se rendre chez l'autre, l'ETA n'existe pas. Un contrat-titre dans un tableau n'est pas le métier.

---

## 10. Kits de départ — le triangle dès la première heure

Aujourd'hui tout le monde démarre presque pareil, plus un bonus de 2 %. Le choix du métier à l'écran 2 de l'onboarding ne tient pas sa promesse (doc 35).

| | Céréalier | Éleveur | ETA |
|--|-----------|---------|-----|
| Terre | 1 parcelle agricole | dépôt + étable, pas de champ | dépôt, pas de champ |
| Machines | tracteur + outil de sol | petit tracteur *ou* rien | **1** machine de chantier (moissonneuse *ou* gros tracteur + outil) |
| Stock | semences | 2 jours de fourrage + litière | gasoil |
| Première leçon | « Votre blé est mûr. Publiez la moisson. » | « Il vous reste 2 jours. Commandez de la paille. » | « Une parcelle est mûre à 400 m. Prenez le chantier. » |
| Bonus chiffré | on le garde faible, domaines disjoints (doc 06) | idem | idem |

Le bonus de 2 % peut rester. Il n'est plus ce qui *fait* le métier.

Changer de métier plus tard : coûteux, rare, on perd le kit d'identité (pas les terres déjà achetées). `[PROPOSITION]` alignée sur 06.

---

## 11. Réputation

Trois scores, pas un karma global. Ils se voient.

| Score | Qui | Monte | Descend | Effet |
|-------|-----|-------|---------|-------|
| Ponctualité ETA | ETA | Livré avant l'échéance | Lâché, en retard | Accès aux chantiers bien payés, malus qualité |
| Fiabilité fournisseur | Céréalier | Matière livrée comme annoncé | Commande non honorée | L'éleveur filtre, petit premium de prix |
| Client solvable | Éleveur / céréalier côté chantier | Paiement escrow OK | Impayé (ne devrait plus arriver : escrow) | L'ETA refuse les mauvais payeurs |

Escrow sur tous les chantiers : l'argent est bloqué à la publication, libéré à la livraison, rendu si RATÉ. Pas de grief.

---

## 12. Saisons — le metronome du triangle, pas une brique isolée

Le 48 les met en phase 4. On confirme, avec une raison plus nette.

Sans saison qui *ferme* les fenêtres, le céréalier moissonne quand il veut, l'ETA n'a pas de pic, l'éleveur n'a pas de soudure. Le triangle se desserre.

Avec saisons :

- Printemps / début été : semis. L'ETA sème chez ceux qui n'ont pas le temps.
- Été / automne : **le** pic. Toutes les parcelles mûrissent dans une fenêtre courte. C'est la saison de l'ETA. Le céréalier qui a trois parcelles *doit* sous-traiter.
- Hiver : presque rien aux champs. L'éleveur passe au premier plan (ration, bâtiment, lisier sur sol portant). L'ETA répare, prend les labours d'hiver, les transports. Le céréalier vend, planifie, lit le sol.

On ne les code pas tant que la bourse, la paille et l'ensilage n'existent pas : un hiver sans rien à faire est un mur. Un hiver avec un troupeau, une fosse et des machines à entretenir est un **changement de métier temporaire**. C'est exactement l'allongement de temps de jeu que Torkor demande, obtenu par complémentarité, pas par une corvée de plus.

---

## 13. Ce qu'on ne fait pas

- **Pas d'automatisation totale.** Pas de « ma ferme joue sans moi » au-delà des consignes bornées. Les consignes enchaînent, elles n'inventent pas.
- **Pas de contrats fantômes.** Chaque ligne de la bourse pointe une parcelle réelle. `NpcContract` titre + récompense disparaît.
- **Pas de murs de métier.** On ne retire pas d'outils selon la spé. On équipe différemment au départ.
- **Pas de quatrième métier.** Transporteur, meunier, laiterie = PNJ ou chantiers d'ETA, pas une classe.
- **Pas d'entente forcée.** Le solo avec PNJ est un jeu complet. Le multi est une meilleure version, pas la seule.
- **Pas de salariés jour 1.** Voir § 8.4.
- **Pas d'ensilage vendu comme du blé.** S'il a un cours mondial liquide, le pont céréalier–éleveur meurt.

---

## 14. Ordre d'implémentation — révisé

Le 48 disait : paille → ensilage → métiers → saisons → CUMA. C'était l'ordre des *gestes*. L'ordre du *triangle* est différent : sans bourse réelle, la paille relie deux métiers et laisse le troisième à ses contrats fictifs.

| # | Brique | Pourquoi maintenant | Dépend de |
|---|--------|---------------------|-----------|
| **0** | **Bourse des chantiers réelle** | Sans elle, l'ETA n'existe pas. Convertir contractor + NpcContract en un `Chantier` lié à une parcelle. Urgent PNJ = filet. | Rien. On peut l'ancrer sur la moisson / le labour déjà là. |
| **1** | **Consignes + rapport d'absence** | Transforme la fenêtre de récolte (38) et la mortalité (44) en offre. L'absence devient le jeu de l'ETA. | 0 |
| **2** | **Fermes PNJ sur la carte** | Rend le solo vrai. Donne à l'ETA des terres où aller dès le jour 1. | 0 |
| **3** | **Kits de départ par métier** | Le choix à l'onboarding commence à tenir sa promesse. | 0, 2 (l'ETA a quelqu'un à servir) |
| **4** | **Paille** | Pont matière céréalier ↔ éleveur. Chantier de pressage pour l'ETA. | 0 (le pressage est un type de chantier) |
| **5** | **Ensilage** | Pont matière + machine signature ETA. | 0, 4 (même logique récolte à fourche) |
| **6** | **Lisier** | Pont retour éleveur → céréalier. | 0, et un bâtiment fosse |
| **7** | **Saisons qui ferment** | Crée les pics sans lesquels l'ETA n'a pas de saison. | 4–6, pour que l'hiver ait de quoi vivre |
| **8** | **Flotte ETA (conducteurs)** | Tardif. Capacité, pas remplacement. | 0, 3, matériel T2 |
| **9** | **CUMA** | Capital commun. | 5, 7, joueurs installés |
| **10** | **Entente (mode E)** | Optionnel. | 9 |

Les mécaniques « profondes » du 48 (analyse NPK, formulation de ration, sélection génétique, largeur de travail) restent valides. Elles **enrichissent un métier déjà relié**. On ne les fait pas avant 0–6 : un céréalier qui analyse son sol tout seul n'a toujours pas besoin de l'ETA.

Garde-fous du 48, conservés : arbitrage, lecture écran, lien, économie, animation. Plus un sixième :

6. **Deux métiers touchés, ou on ne code pas.**

---

## 15. Chiffres de départ `[GD]` / `[TEST]`

À calibrer en partie. On les écrit pour ne pas coder à l'aveugle.

| Paramètre | Valeur | Tag |
|-----------|--------|-----|
| Malus ETA joueur (rép. haute) | −2 % | `[GD]` |
| Malus ETA PNJ | −6 % | déjà là |
| Surcoût Urgent PNJ vs barème bourse | +15 % | `[GD]` |
| Prime chantier joueur vs PNJ (côté ETA) | +15 % | `[GD]` |
| Prime matière locale livrée (vendeur) | +10 % vs cours | `[GD]` |
| Remise matière locale (acheteur vs négociant) | −8 % | `[GD]` |
| Fermes PNJ / région | 4–8, ~30 % des parcelles vides | `[TEST]` |
| Timeout bourse avant filet PNJ (client présent) | 45 s, skippable | `[TEST]` |
| Timeout bourse (client absent) | jusqu'à l'échéance de consigne / palier de maturité | `[GD]` |
| Plafond conducteurs ETA | 2 | `[GD]` |
| Jours de stock éleveur au départ | 2 | `[GD]` |
| Fosse lisier, seuil chantier | 80 % | `[GD]` |
| Fosse lisier, blocage | 100 % | `[GD]` |
| Consignes : semer une culture neuve | interdit | `[GD]` |
| Contrats fantômes | supprimés | `[GD]` |

Barème de prestation : on **garde** `CONTRACTOR_RATE_PER_CELL` et `CONTRACTOR_CALLOUT_FEE` comme tarif PNJ. Le tarif bourse joueur se négocie autour, par défaut égal au barème (le client économise le +15 % d'urgent, l'ETA empoche ce que le PNJ avalait).

---

## 16. Critères d'acceptation — le triangle est vrai quand

Un testeur (ou nous) peut vérifier tout ça **à l'écran**, sans ouvrir le code.

1. Un céréalier sans moissonneuse publie une moisson. Une ETA entre sur **sa** parcelle, on voit la machine, les cases changent, l'argent a bougé chez les deux.
2. Le même céréalier se déconnecte avec la consigne « si mûr, publier ». Une ETA (joueur ou PNJ) prend. Au retour, le rapport cite le nom, les tonnes, le coût.
3. Un éleveur à court de paille achète à un céréalier de la région. Les deux comptes bougent. Le cours mondial n'est pas passé par là.
4. Un ETA sans champ enchaîne deux chantiers sur deux parcelles qui ne sont pas les siennes. Son hangar, lui, est à lui.
5. Une région sans aucun autre humain : des fermes PNJ sont sur la carte, elles publient, on peut y travailler. Le solo n'est pas une version amputée.
6. Urgent PNJ existe toujours, plus cher, pour celui qui est devant l'écran et qui refuse d'attendre.
7. Un joueur peut tout faire seul, plus mal, plus cher, plus lentement. Aucun bouton n'est grisé « parce que vous n'êtes pas ETA ».

Si 1 et 4 sont faux, l'ETA n'existe pas. Si 2 est faux, l'absence n'est pas le jeu. Si 3 est faux, céréalier et éleveur ne se parlent pas. Si 5 est faux, on a conçu un MMO qui ne se joue pas à un. Si 7 est faux, on a posé un mur.

---

## 17. Lecture écran — où ça vit dans l'UI

On n'ajoute pas une application dans l'application. On branche.

| Besoin | Où |
|--------|----|
| Publier / urgent PNJ | Panneau Parcelle, à la place du bouton contractor actuel |
| Bourse, filtres, prendre un chantier | Bureau, à la place de « Travaux à façon » |
| Consignes | Bureau, nouvel onglet |
| Rapport d'absence | Plein écran à la reconnexion, puis consultable au Bureau |
| Fermes PNJ / joueurs | Carte région déjà là, pastilles métier |
| Entrer chez l'autre | Même vue ferme, bandeau « Chantier chez *X* » |
| Offres de matière locale | Criée déjà là, plus un filtre « ma région / paille / ensilage / lisier » |
| Alertes | Système déjà là (`use-alerts`) : chantier pris, échéance, fosse, stock |

Mobile : le Bureau est déjà un tiroir. Bourse et consignes y vivent. La parcelle d'un autre s'ouvre comme la sienne.

---

## 18. Décision demandée

Ce document est la stratégie. Rien n'est codé.

À valider, dans l'ordre, avant la brique 0 :

1. La thèse : l'absence publie, l'ETA travaille chez les autres, le filet PNJ existe toujours.
2. Les kits de départ (le céréalier **sans** moissonneuse, l'ETA **sans** champ). C'est le changement le plus visible pour un joueur actuel.
3. L'ordre 0 → 10 ci-dessus, en particulier « bourse avant paille ».
4. Le plafond à 2 conducteurs, tardif, jamais au départ.

Les chiffres du § 15 se calibrent en jouant, pas en réunion. Les quatre points ci-dessus, non : ils sont des murs porteurs.
