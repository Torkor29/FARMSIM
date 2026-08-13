# 49 — Le triangle des métiers

**Statut :** Stratégie — à valider avant toute ligne de code  
**Date :** 2026-08-13  
**Mise à jour :** 2026-08-13 — boucles métier (§ 7) ; l'ETA glisse, graisse, répare, habite un dépôt sans champ (Strea / Torkor).  
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

Pas des bonus. Des façons de gagner sa vie, des kits de départ, des dépendances, un échec propre. Le **mode de jeu** de chacun — la liste exacte de ce qu'il fait, et ce que ça donne à cultiver et à travailler chez les deux autres — est au § 7. Ici, seulement l'identité.

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
  type          PLOW | SOW | FERTILIZE | HARVEST | STUBBLE | BALE | SPREAD | LIME | WEED | ENSILE | TRANSPORT | REPAIR
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

1. Une **ETA joueur** prend le chantier, **à condition d'avoir chez elle la machine exigée** en état de partir (graissée, assez propre, condition ≥ seuil). Elle se rend sur la parcelle, **glisse l'outil sur les cases** (§ 7.3), usure réelle, paiement escrow.
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

## 7. Les trois modes de jeu

Un seul monde : un jeu de gestion en ligne, persistant, celui qu'on construit depuis le début. Il n'y a pas de playlist Solo, Mixte, Entente. Le filet PNJ (§ 9) n'est pas un mode, c'est l'infrastructure qui empêche le monde d'être vide.

Le mode de jeu, c'est **le métier**. Je suis éleveur : je fais *ceci*, et *ceci* force le céréalier à cultiver *cela* et donne à l'ETA *cela* à faire. Les trois horloges s'entraînent. Si une action d'un métier ne change rien chez les deux autres, ce n'est pas du jeu, c'est un mini-jeu collé à côté.

---

### 7.1 Je suis éleveur

Je transforme de la matière végétale en lait, viande et lisier. Je ne gagne pas en « cliquant des vaches ». Je gagne en tenant un troupeau vivant, propre, nourri — ce qui *tire* toute la production végétale de la région.

**Ce que je fais, dans l'ordre d'une exploitation qui tourne :**

1. **Je compose la ration.** Ensilage (volume, énergie) + grain (concentré) + un peu de foin. La jauge `feedQuality` cesse d'être un curseur magique : c'est le mélange que j'ai en stock. Une ration juste = plus de lait. Une ration de survie (que du foin NPC) = le troupeau survit, le tank se remplit mal.
2. **Je paille.** Chaque cycle, le troupeau consomme de la litière. Sans paille, l'hygiène baisse, le lait se paie moins, la maladie approche. La paille ne pousse pas chez moi : elle vient du blé du céréalier.
3. **Je sors au pré.** Déjà en place (doc 37). Ça baisse un peu la ration, ça monte le bonheur. Ça ne remplace ni l'ensilage ni la paille.
4. **Je traite / je remplis le tank.** Le lait s'accumule. Tank plein → il faut vendre ou faire collecter. C'est un revenu régulier, à l'opposé des à-coups du céréalier.
5. **Je vide la fosse.** Le lisier monte tout seul. À 80 %, je publie un épandage. À 100 %, je ne produis plus. Le lisier n'est pas un déchet : c'est de l'azote pour le champ du voisin.
6. **Je fais naître, j'achète, j'abats.** Plus de bêtes = plus de ration, plus de paille, plus de lisier. Grandir *est* une commande passée aux deux autres métiers. Rétrécir, c'est les laisser sans débouché.
7. **Je commande à l'avance.** Contrat d'ensilage, commande de paille, avant que le céréalier ne sème. C'est moi qui lui dis quoi mettre en terre — pas le cours mondial tout seul.

**Donc le céréalier cultive :**

| Ce que je fais | Ce qu'il met en terre / ce qu'il garde |
|----------------|----------------------------------------|
| Je signe 20 t d'ensilage | Il sème du **maïs ensilage**, pas du maïs grain |
| Mon troupeau a besoin de litière | Il **presse** son blé au lieu de l'enfouir |
| Je monte à 40 bêtes | Il **étend** une parcelle, ou il sème plus de fourrage et moins de pois « cash » |
| Je n'achète plus (je suis parti, troupeau vendu) | Il enfouit, il vend au marché, il perd le premium local |

**Donc l'ETA a à faire :**

| Ce que je fais | Chantier qui naît |
|----------------|-------------------|
| Fosse à 80 % | Épandage + transport chez le céréalier |
| Commande d'ensilage mûre | Ensileuse chez le céréalier, remorque jusqu'à *mon* silo |
| Paille pressée chez le voisin | Ramassage / livraison jusqu'à mon hangar |
| Tank plein, laiterie pas passée | Collecte (transport) |
| Je n'ai pas de champ et je veux un peu de maïs à moi | Semis + ensilage chez moi — rare, cher, possible |

**Si je joue bien :** le céréalier de ma région a un carnet de commandes avant de semer. L'ETA a de l'épandage en hiver et de l'ensilage en été. Le cours du lait me paie le quotidien ; la viande paie les à-coups. **Si je joue mal :** j'achète tout au NPC, plus cher, moins bon, et je n'ai fait travailler personne. Le triangle tourne sans moi. Je survis, je ne suis plus un métier.

---

### 7.2 Je suis céréalier

Je fais pousser. Je ne tiens pas tout le matériel. Chaque hectare que j'ouvre est une question : *pour qui*, et *qui va le travailler*.

**Ce que je fais :**

1. **Je lis la demande, pas seulement le cours.** L'éleveur voisin a-t-il commandé de l'ensilage ? De la paille ? Le pois est-il dû (rotation, doc 45) ? Le contrat à terme (doc 47) m'a-t-il déjà vendu du blé ? La parcelle se décide à l'intersection de ces quatre signaux, pas au plus haut prix du tick.
2. **Je prépare le sol.** Déchaumage, labour, ou semis direct. Tracteur à moi, ou chantier ETA si j'ai trop de cases, ou si je suis parti.
3. **Je sème.** Blé (grain + paille), maïs grain (marché), maïs ensilage (éleveur), pois (azote, peu de paille). Semer de l'ensilage sans ensileuse, c'est déjà embaucher une ETA. Semer du blé et décider plus tard « j'enfouis », c'est dire non à l'éleveur.
4. **Je fertilise.** Engrais de synthèse, *ou* lisier de l'éleveur (moins cher à l'unité d'azote, fenêtre plus étroite, chantier d'ETA).
5. **Je moissonne dans la fenêtre** (doc 38). Moi, ou l'ETA. Trois parcelles mûres le même jour : je ne peux pas être sur les trois. L'expansion *crée* de l'ETA.
6. **Je décide de la paille.** Presser (revenu + litière pour l'éleveur, plus de bonus résidus) ou enfouir (sol, l'éleveur se fournit ailleurs). L'andain au sol est un chantier de presse en attente.
7. **Je vends.** Négociant, criée, éleveur local, contrat à terme. Vendre local, c'est mieux pour les deux. Vendre au monde, c'est le filet.

**Donc l'éleveur reçoit / subit :**

| Ce que je fais | Chez l'éleveur |
|----------------|----------------|
| Je sème de l'ensilage sur sa commande | Son silo se remplira. Il peut monter le troupeau |
| Je presse le blé | Il a de la litière locale, moins chère que le NPC |
| J'enfouis tout, je ne sème que du pois et du maïs grain | Il n'a plus de paille ici. Il paie le filet, ou il réduit le cheptel |
| Je m'absente sans consigne, culture perdue | Rien à lui livrer. Sa commande tombe |
| Je prends son lisier | Mon azote est payé par son problème de fosse |

**Donc l'ETA a à faire :**

| Ce que je fais | Chantier qui naît |
|----------------|-------------------|
| Je sème sans tout pouvoir faire | Semis, puis plus tard moisson |
| Je sème de l'ensilage sans ensileuse | **Le** chantier signature : ensileuse + remorques |
| Je laisse l'andain | Pressage, puis souvent transport vers l'éleveur |
| J'achète une 2ᵉ / 3ᵉ parcelle | Pic : plusieurs moissons dans la même fenêtre |
| Je m'absente, consigne « si mûr » | Chantier publié tout seul. C'est son pain quotidien |
| Je prends du lisier | Elle vient épandre *chez moi*, payée par l'éleveur ou par moi |

**Si je joue bien :** mes assolements sont un planning pour l'éleveur et un carnet pour l'ETA. Mes hectares valent plus que leur grain, parce qu'ils font vivre deux voisins. **Si je joue mal :** j'achète une moissonneuse, je sème toujours du blé, j'enfouis, je vends au négociant. Je tiens. Personne n'a eu besoin de moi. J'ai refusé le métier.

---

### 7.3 Je suis ETA

Je ne cultive pas. Je ne trait pas. **Mon mode de jeu, c'est d'entrer sur les terres des deux autres et d'y faire ce qu'ils ont affiché au tableau.** Sans eux — joueurs ou fermes PNJ du voisinage — je n'ai pas de partie.

Strea le dit tel quel : c'est une Entreprise de Travaux Agricoles. Un joueur sans matériel pose la mission (épandre du fumier, labourer, moissonner…). Je la prends. Je dois avoir l'engin **chez moi**, sinon le bouton n'existe pas. Sur le champ, je ne valide pas un contrat : **je clique (ou j'appuie) et je glisse en maintenant**, avec le bon outil, jusqu'à avoir couvert la parcelle.

**Ce que je fais :**

1. **Je lis le tableau.** Chaque ligne est un lieu réel, un type de travail, une machine exigée, une échéance. Épandre, labourer, déchaumer, semer, récolter, désherber, chaux, presser, ensiler, transporter, **réparer le matériel d'un autre**. Les missions PNJ des parcelles autour remplissent les trous : je n'attends pas qu'un humain clique.
2. **Je ne pars que si l'engin est chez moi et prêt.** Pas de location magique. Pas de « le jeu te prête la moissonneuse ». Pas de machine en panne, ni sèche de graisse, ni crottée de la veille.
3. **Avant le chantier : je graisse.** C'est le rituel de départ, à l'atelier. Sans ça, l'engin part quand même une fois — et il casse plus vite, ou il refuse au deuxième essai.
4. **Sur le champ : je glisse.** Maintien + glisser, toute la surface du contrat, largeur de l'outil (1 case au T1, davantage ensuite). L'animation suit *ma* trace, ce n'est plus un aller-retour automatique. Un céréalier sur *sa* terre garde la sélection + passage auto : ce n'est pas le même métier.
5. **Après : je souffle, puis je nettoie.** Retour au dépôt. Tant que ce n'est pas fait, le prochain chantier use double, et la panne se rapproche.
6. **De temps à autre, ça casse.** En plein champ : le chantier se fige, le client voit « en panne », les cases non faites restent. Je répare sur place (plus cher, plus sale) ou je ramène à l'atelier, ou **je sors la deuxième moissonneuse**. C'est pour ça que j'en achète trois, pas une.
7. **Je répare aussi chez les autres.** Leur tracteur à 15 %, leur moissonneuse coincée : chantier `REPAIR`, dans *leur* cour ou à *mon* atelier. Ils paient plus cher que si je répare le mien — je suis le pro. Eux gardent un bouton « Réparer » simple, au tarif fort. Moi j'ai l'atelier, le geste, la remise.
8. **Je vis de leur absence.** Consigne « si mûr, publier » : ils ne sont pas là, la terre l'est. J'y glisse. Quand *je* m'absente, les chantiers vont ailleurs.

**Ma parcelle, réponse à Torkor : ce n'est pas un champ.** Hangars, atelier, cour de manœuvre. On y range, on y graisse, on y souffle, on y répare, on y aligne quatre tracteurs. Pas de blé. Si plus tard j'achète une terre agricole, je sors du métier, je ne l'approfondis pas.

**Donc le céréalier peut :**

| Ce que je fais | Chez le céréalier |
|----------------|-------------------|
| Je glisse la moisson / le labour / le déchaumage chez lui | Il étend sans acheter l'engin |
| Je graisse et je ne casse pas | Sa fenêtre est honorée |
| Je casse au milieu | Sa culture attend. Il voit la panne. Il peut rappeler un PNJ |
| Je répare *sa* machine | Il n'a plus à payer le tarif amateur |
| Je n'ai pas l'outil qu'il a affiché | Sa ligne reste au tableau, un autre la prend |

**Donc l'éleveur peut :**

| Ce que je fais | Chez l'éleveur |
|----------------|----------------|
| J'épands son fumier / lisier (l'exemple de Strea) | La fosse baisse, le céréalier reçoit l'azote |
| J'ensile et je livre | Le silo tient l'hiver |
| Je répare son petit tracteur | Il nourrit sans attendre une pièce |
| Je suis saturée ou en panne | Fosse qui monte, ration qui glisse |

**Si je joue bien :** j'ai plusieurs fois le même engin, un atelier qui tourne, un tableau plein, et les deux autres osent grandir. **Si je joue mal :** je clique un titre, je n'ai pas glissé, je n'ai pas graissé, je n'ai touché aucune terre. Je ne suis pas ETA.

---

### 7.4 Table d'osmose — une action, trois métiers, le monde

Chaque ligne se lit : *quelqu'un fait X → les deux autres reçoivent Y → le jeu global (marché, sol, saison, foncier) bouge*.

| Action | Céréalier | Éleveur | ETA | Jeu global |
|--------|-----------|---------|-----|------------|
| L'éleveur signe 20 t d'ensilage | Sème du maïs ensilage, pas du grain | Réserve son hiver | Ensileuse + livraison dans 1 saison | Moins de maïs grain sur le cours |
| L'éleveur passe de 12 à 40 bêtes | Plus de paille et de fourrage à produire | Plus de lait, plus de lisier | Plus d'épandage, plus de transport | Demande locale > filet NPC |
| L'éleveur laisse la fosse à 100 % | Plus de lisier disponible | Production **stoppée** | Chantier urgent, mieux payé | Azote organique en retard sur les semis |
| Le céréalier sème du blé et presse | Perd le bonus résidus | Gagne la litière | Chantier presse + livraison | Cours paille local s'affaisse si trop d'offre |
| Le céréalier sème du blé et enfouit | Gagne le sol | Doit acheter au NPC | Pas de presse | Sol (doc 39) vs triangle : l'arbitrage *est* le jeu |
| Le céréalier sème du pois | Azote pour la suite, peu de paille | Trou de litière ce cycle | Moisson plus courte, moins de presse | Rotation (doc 45) vs demande éleveur |
| Le céréalier ouvre une 3ᵉ parcelle | Plus de grain, plus de fenêtre | Plus de matière possible | Pic saturé : il *doit* me prendre | Foncier (doc 32) : l'hectare crée du travail, pas que du stock |
| Le céréalier part, consigne moisson | Sauve une partie du rendement | Livraison possible quand même | Pain quotidien | Fenêtre 38 devient un appel d'offres, plus une amende |
| L'ETA achète une 2ᵉ / 3ᵉ moissonneuse | Moisson tenue même si l'une casse | Ensilage moins risqué | Enchaîne sans rentrer à chaque panne | Le capital ETA = flotte, pas un champ |
| L'ETA ne graisse pas / ne nettoie pas | Panne possible en pleine fenêtre | Chantier figé, fosse ou silo en attente | Usure ×2, puis casse | L'atelier est sa « terre » |
| L'ETA répare la machine du voisin | Tarif amateur évité | Tracteur d'alimentation OK | Chantier `REPAIR`, atelier qui tourne | Usure (doc 24) devient un pont métier |
| Le client affiche un épandage de fumier | Reçoit l'azote si c'est chez lui | Fosse qui baisse | Glisse la tonne sur *son* champ | L'exemple de Strea : le tableau *est* le métier |
| L'ETA est saturée / absente | Urgent PNJ, ou décote | Ration rabotée, fosse qui monte | Les autres ETA / le filet prennent | Le présent gagne. L'absence de l'ETA *libère* du travail |
| Le cours du lait monte | On lui commande plus d'ensilage | Il agrandit | Plus d'ensilage, plus d'épandage | Le marché mondial oriente l'assolement local |
| Le cours du blé explose | Il sème du blé « cash », presse ou pas selon l'éleveur | Risque de manquer d'ensilage | Moisson blé plutôt qu'ensileuse | Tension volontaire : le monde tire, le voisin aussi |
| L'hiver ferme les champs | Vend, planifie, consignes | **Son** pic : ration, litière, lisier | Transport, labour d'hiver, entretien | Saison = changement de métier temporaire, pas un mur |
| Pluie sur andain / moisson | Décote, urgence | Qualité de paille ↓ | Malus, tarif qui monte | Météo déjà là, enfin branchée sur le triangle |

Rien dans cette table n'est un DLC. Tout s'appuie sur ce qui existe (fenêtre, sol, rotation, marché, foncier, élevage, usure) ou sur les briques déjà planifiées (paille, ensilage, lisier, bourse).

---

### 7.5 Une année lue à trois voix

Pas trois jeux qui s'alternent. La même horloge, trois lectures.

**Semis.** Le céréalier décide les surfaces *avec* les commandes de l'éleveur sous les yeux. L'éleveur, lui, est encore dans son hiver : il vide la fosse sur les terres qui vont être semées (chantier ETA), et il signe l'ensilage de l'année. L'ETA enchaîne labour, épandage, semis. Le pic n'est pas « à moi » : il est *causé* par la décision de semer.

**Pousse.** Le céréalier surveille. L'éleveur vit son quotidien (ration, pré, lait) sur les stocks de l'an passé. L'ETA entretient, livre ce qui reste, prend les retards. Le calme du champ n'est pas du vide : c'est le temps de l'élevage.

**Moisson.** Le céréalier publie. L'éleveur ouvre le silo couloir et le hangar à paille. L'ETA *est* la saison. Moisson, ensilage, presse, livraison. Si elle n'y arrive pas, le céréalier décote et l'éleveur n'a pas d'hiver. Un seul raté, deux métiers touchés.

**Arrière-saison.** Le céréalier déchaume ou pas, selon qu'il a pressé. L'éleveur pèse ses stocks : assez pour l'hiver ? L'ETA épand le lisier d'automne, laboure. Le sol du céréalier se lit encore à la fosse de l'éleveur.

**Hiver.** Les champs se ferment (quand les saisons compteront). L'éleveur passe devant : c'est *son* mode qui tient le monde. Le céréalier vend, relit la rotation, pose les consignes. L'ETA transporte le fourrage, répare, prend les labours. Personne n'est au chômage si le triangle a été semé à l'automne.

C'est ça, l'osmose avec le jeu global : le marché dit les prix, le sol dit la rotation, la saison dit *qui* est urgent, le foncier dit *combien* de chantiers. Aucun métier n'a sa propre carte. Ils jouent le même monde, de trois endroits.

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

### 8.7 L'atelier est la ferme de l'ETA

Aujourd'hui une machine a une jauge `condition` et un bouton « Réparer » (doc 24). L'atelier donne −10 %. L'ETA use 10 % de moins (`etaBonus`). C'est trop plat pour un métier dont l'outil *est* le matériel.

Strea demande trois gestes, pas un bouton. On les pose **seulement sur l'ETA**. Céréalier et éleveur gardent « Réparer » au tarif fort — c'est ce qui rend le chantier `REPAIR` rationnel.

| Geste | Quand | Où | Si on saute |
|-------|-------|----|-------------|
| **Graisser** | Avant de partir | Atelier du dépôt | Usure ×1,5 sur le chantier ; à la 2ᵉ fois sans graisse, refus de partir `[GD]` |
| **Glisser le chantier** | Pendant | Parcelle du client | Voir ci-dessous |
| **Souffler puis nettoyer** | Après, deux actions | Cour / atelier | Prochain chantier : usure ×2, saleté visible sur le sprite |
| **Réparer (panne)** | Quand ça casse | Sur place (cher) ou atelier (remise ETA) | Chantier figé. Client voit l'état. On peut swapper d'engin |

**Panne** `[TEST]` : tirage sur un chantier si condition basse **et** (pas graissé ou sale). Plus fréquent chez l'ETA parce qu'elle enchaîne, pas parce que le RNG la punit. Visible : l'engin s'arrête, fumée, cases restantes intactes.

**Coûts** `[GD]` : graisser / souffler / nettoyer = temps + CRD faibles (consommables). Réparer : tarif ETA = déjà `workshopDiscount` + remise de métier **−25 %** sur `repairCostPerPoint`. Tarif céréalier / éleveur = plein tarif, d'où le chantier chez l'ETA.

**Plusieurs fois le même engin.** Le schéma le permet déjà (`Machine` en N). C'est la stratégie de Strea : 3 moissonneuses, 4 tracteurs. Une à l'atelier, deux au champ. La flotte de conducteurs (§ 8.4) vient *après* ; la flotte d'engins, dès qu'on a l'argent.

**Le geste sur le champ.** Chez soi (céréalier) : sélection de cases + passage automatique, déjà là. En mission ETA : l'outil est armé, **maintien + glisser** couvre une bande égale à la largeur de l'engin. Mobile : un doigt = travail, deux doigts = cadrage (le pan actuel). Mission livrée seulement si toutes les cases du contrat sont passées. L'animation existante (va-et-vient, poussière) **suit la trace**, elle ne la remplace pas.

**Chaux et désherbage.** Strea les met au tableau. Le désherbage s'adosse à `weedsControlled` (déjà posé par l'épandage). La chaux attend un vrai levier sol (NPK / pH) : en attendant, on ne l'invente pas comme un bouton cosmétique. Lisier / fumier, labour, déchaumage, moisson, réparation : jour 1 du tableau.

**Missions PNJ autour.** Confirmé § 9. Rayon : la région, pas la planète. L'ETA voit les parcelles PNJ occupées et y entre comme chez un joueur.

---

## 9. Fermes PNJ — l'infrastructure, pas un mode

Le monde est unique et en ligne. S'il n'y a pas d'humain à côté, les deux autres métiers existent quand même, sur de vraies parcelles. Sinon l'éleveur n'a pas de paille le mardi, et l'ETA n'a nulle part où entrer. Ce n'est pas une playlist « solo ». C'est le filet du même jeu.

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
| Terre | 1 parcelle agricole | dépôt + étable, pas de champ | **dépôt : hangar + atelier, pas de champ** |
| Machines | tracteur + outil de sol | petit tracteur *ou* rien | **1** machine de chantier (moissonneuse *ou* gros tracteur + outil) |
| Stock | semences | 2 jours de fourrage + litière | gasoil, graisse |
| Première leçon | « Votre blé est mûr. Publiez la moisson. » | « Il vous reste 2 jours. Commandez de la paille. » | « Une parcelle est mûre à 400 m. Graissez, prenez, glissez. » |
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
- **Pas de playlist Solo / Mixte / Entente.** Un seul monde de gestion en ligne. Le filet PNJ comble les trous ; ce n'est pas un mode. Une CUMA / une entente de trois joueurs pourra exister plus tard, comme un contrat, pas comme une façon de lancer la partie.
- **Pas de salariés jour 1.** Voir § 8.4.
- **Pas d'ensilage vendu comme du blé.** S'il a un cours mondial liquide, le pont céréalier–éleveur meurt.
- **Pas de graisse / soufflage / nettoyage chez le céréalier et l'éleveur.** Ils gardent « Réparer » au tarif fort. L'entretien profond *est* le mode ETA.
- **Pas de location magique.** Pas l'engin du chantier = pas la mission.
- **Pas de chaux cosmétique.** Tant qu'il n'y a pas de levier sol (NPK / pH), on ne pose pas le bouton.

---

## 14. Ordre d'implémentation — révisé

Le 48 disait : paille → ensilage → métiers → saisons → CUMA. C'était l'ordre des *gestes*. L'ordre du *triangle* est différent : sans bourse réelle, la paille relie deux métiers et laisse le troisième à ses contrats fictifs.

| # | Brique | Pourquoi maintenant | Dépend de |
|---|--------|---------------------|-----------|
| **0** | **Bourse + geste** | Chantier lié à une parcelle. Machine **possédée** exigée. L'ETA **glisse** l'outil chez le client. Urgent PNJ = filet. | Travail aux champs déjà là |
| **0b** | **Atelier ETA** | Graisser / souffler / nettoyer / panne. Remise métier. Chantier `REPAIR` chez les autres. Plusieurs fois le même engin. | 0, bâtiment `WORKSHOP` déjà là |
| **1** | **Consignes + rapport d'absence** | Transforme la fenêtre de récolte (38) et la mortalité (44) en offre. L'absence devient le jeu de l'ETA. | 0 |
| **2** | **Fermes PNJ sur la carte** | Rend le solo vrai. Donne à l'ETA des terres où aller dès le jour 1. | 0 |
| **3** | **Kits de départ par métier** | Le choix à l'onboarding commence à tenir sa promesse. | 0, 2 (l'ETA a quelqu'un à servir) |
| **4** | **Paille** | Pont matière céréalier ↔ éleveur. Chantier de pressage pour l'ETA. | 0 (le pressage est un type de chantier) |
| **5** | **Ensilage** | Pont matière + machine signature ETA. | 0, 4 (même logique récolte à fourche) |
| **6** | **Lisier** | Pont retour éleveur → céréalier. | 0, et un bâtiment fosse |
| **7** | **Saisons qui ferment** | Crée les pics sans lesquels l'ETA n'a pas de saison. | 4–6, pour que l'hiver ait de quoi vivre |
| **8** | **Flotte ETA (conducteurs)** | Tardif. Capacité, pas remplacement. | 0, 3, matériel T2 |
| **9** | **CUMA** | Capital commun, pas un mode de jeu. | 5, 7, joueurs installés |

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
| Remise réparation ETA (en plus de l'atelier) | −25 % | `[GD]` |
| Usure si pas graissé | ×1,5 | `[GD]` |
| Usure si pas nettoyé | ×2 sur le chantier suivant | `[GD]` |
| 2ᵉ départ sans graisse | refus | `[GD]` |
| Largeur d'outil T1 (glisser) | 1 case | `[GD]` |
| Jours de stock éleveur au départ | 2 | `[GD]` |
| Fosse lisier, seuil chantier | 80 % | `[GD]` |
| Fosse lisier, blocage | 100 % | `[GD]` |
| Consignes : semer une culture neuve | interdit | `[GD]` |
| Contrats fantômes | supprimés | `[GD]` |

Barème de prestation : on **garde** `CONTRACTOR_RATE_PER_CELL` et `CONTRACTOR_CALLOUT_FEE` comme tarif PNJ. Le tarif bourse joueur se négocie autour, par défaut égal au barème (le client économise le +15 % d'urgent, l'ETA empoche ce que le PNJ avalait).

---

## 16. Critères d'acceptation — le triangle est vrai quand

Un testeur (ou nous) peut vérifier tout ça **à l'écran**, sans ouvrir le code.

1. Un céréalier sans moissonneuse publie une moisson. Une ETA **qui a la moissonneuse chez elle** entre sur **sa** parcelle, **glisse** l'outil, les cases changent, l'argent a bougé chez les deux.
2. Le même céréalier se déconnecte avec la consigne « si mûr, publier ». Une ETA (joueur ou PNJ) prend. Au retour, le rapport cite le nom, les tonnes, le coût.
3. Un éleveur à court de paille achète à un céréalier de la région. Les deux comptes bougent. Le cours mondial n'est pas passé par là.
4. Un ETA **sans champ**, avec hangar et atelier, enchaîne deux chantiers sur deux parcelles qui ne sont pas les siennes. Entre les deux, il graisse / souffle / nettoie, ou il sort le deuxième engin.
5. Une région sans aucun autre humain : des fermes PNJ sont sur la carte, elles publient, on peut y travailler. Le monde vide n'est pas une version amputée.
6. Urgent PNJ existe toujours, plus cher, pour celui qui est devant l'écran et qui refuse d'attendre.
7. Un joueur peut tout faire seul, plus mal, plus cher, plus lentement. Aucun bouton n'est grisé « parce que vous n'êtes pas ETA ».
8. Un éleveur qui signe de l'ensilage change **ce que le céréalier sème** et **ce que l'ETA a dans sa bourse**. On le voit à l'écran chez les trois, pas dans un texte d'aide.
9. Un céréalier dont la machine est à 15 % publie `REPAIR`. L'ETA la répare moins cher que le bouton amateur. Sans l'engin exigé, la mission n'est pas prenante.

Si 1 et 4 sont faux, l'ETA n'existe pas. Si le geste de 1 est un clic sur un titre, ce n'est toujours pas le métier. Si 2 est faux, l'absence n'est pas le jeu. Si 3 est faux, céréalier et éleveur ne se parlent pas. Si 5 est faux, le monde vide n'offre personne à servir. Si 7 est faux, on a posé un mur. Si 8 est faux, les métiers sont encore des playlists parallèles. Si 9 est faux, l'atelier n'est pas une ferme.

---

## 17. Lecture écran — où ça vit dans l'UI

On n'ajoute pas une application dans l'application. On branche.

| Besoin | Où |
|--------|----|
| Publier / urgent PNJ | Panneau Parcelle, à la place du bouton contractor actuel |
| Bourse, filtres, prendre un chantier | Bureau, à la place de « Travaux à façon » |
| Glisser l'outil (mission) | Même grille ferme, bandeau « Chantier chez *X* », 1 doigt = travail |
| Graisser / souffler / nettoyer / panne | Garage + atelier du dépôt ETA |
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
2. Les trois modes de jeu du § 7 — pas des playlists, les boucles métier qui s'entraînent.
3. Les kits de départ (le céréalier **sans** moissonneuse, l'ETA **sans** champ). C'est le changement le plus visible pour un joueur actuel.
4. L'ordre 0 → 9 ci-dessus, en particulier « bourse avant paille ».
5. Le plafond à 2 conducteurs, tardif, jamais au départ.

Les chiffres du § 15 se calibrent en jouant, pas en réunion. Les quatre points ci-dessus, non : ils sont des murs porteurs.
