# 48 — Plan des mécaniques à développer

**Statut :** Plan d'exécution des briques — la stratégie des métiers est dans [49_TRIANGLE_METIERS.md](./49_TRIANGLE_METIERS.md)
**Date :** 2026-08-13
**Mise à jour :** 2026-08-13 — l'absence n'est plus un trou ; l'ordre d'implémentation est révisé.

---

## Le problème posé

Deux remarques, la même conclusion. « Développer le système de jeu en lui-même,
trouver des trucs secondaires à faire, augmenter le temps de jeu. » Et une
série d'idées précises sur la paille, l'ensilage, les bottes.

Le jeu sait aujourd'hui semer, travailler le sol, récolter, élever et vendre.
Chacune de ces briques fonctionne, mais la boucle est courte : on sème, on
attend, on récolte, on vend. Une fois comprise, elle se répète sans rien
apporter de neuf.

Il manque deux choses. **De la profondeur verticale** — plusieurs façons de
valoriser la même récolte, avec un arbitrage à chaque fois. Et **des raisons de
revenir**, c'est-à-dire des chantiers qui s'enchaînent au lieu d'un unique
aller-retour.

Un troisième manque, moins visible mais plus grave : **les trois métiers
n'existent pas**. Céréalier, éleveur et ETA se distinguent par un bonus de deux
pour cent, et rien d'autre. Choisir son métier à l'installation n'engage donc à
rien, alors que c'est la première décision qu'on demande au joueur.

---

## Ce qu'on exige d'une mécanique avant de l'écrire

Une mécanique ajoutée sans ces cinq points devient un bouton de plus dans une
barre déjà chargée.

1. **Un arbitrage.** Si une option domine toujours, ce n'est pas une mécanique,
   c'est une étape obligatoire déguisée. Il faut pouvoir se tromper.
2. **Une lecture à l'écran.** La règle doit se voir sur la parcelle. La leçon du
   labour invisible a coûté cher : une règle que le joueur ne peut pas vérifier
   est vécue comme un bug.
3. **Un lien avec l'existant.** Une mécanique isolée est un mini-jeu. Elle doit
   toucher le sol, l'élevage, le marché ou le temps.
4. **Une trace économique.** Un coût, un revenu, un risque — sinon elle ne pèse
   sur aucune décision.
5. **Une animation.** Ce qui se produit doit se voir se produire, pas
   apparaître dans un compteur.

---

## Phase 1 — La paille : andain, bottes, chariot

*Idée de Strea, et la plus rentable des trois : elle ajoute un second passage
sur le même champ.*

Aujourd'hui la moisson laisse des chaumes et c'est tout. En réalité, elle laisse
surtout de la paille en andain, qu'il faut presser, puis ramasser. Cela fait
**trois chantiers là où il y en avait un**, sur la même parcelle, à des moments
différents.

### Le déroulé

| Étape | Machine | Ce qui apparaît sur la case |
|-------|---------|------------------------------|
| Moisson | Moissonneuse | Chaumes + **andain** (cordon de paille) |
| Pressage | Presse | **Bottes** posées au sol |
| Ramassage | Chariot télescopique | Bottes retirées, stock rempli |

Les bottes restent physiquement sur la parcelle. On peut les ramasser une à une
d'un clic — Strea le propose, et c'est juste : le geste manuel doit exister
d'abord, sinon la machine qui l'automatise n'a aucune valeur. Le chariot
télescopique se débloque ensuite et ramasse tout d'un passage.

### L'arbitrage, et il est beau

La paille exportée ne retourne pas au sol. Or le déchaumage tire son bonus de
rendement des résidus incorporés, déjà implémenté. Donc :

- **Presser et vendre** : un revenu immédiat, mais on perd le bonus de résidus
  et le sol s'appauvrit.
- **Broyer et enfouir** : pas de revenu, mais la terre garde sa matière
  organique.

L'arbitrage tombe tout seul dans le système existant, sans rien forcer. C'est
le signe qu'il est juste.

### Ce qu'il faut produire

**Assets** : andain (cordon clair sur le chaume), botte ronde, tas de bottes,
presse, chariot télescopique. Cinq illustrations, au style des précédentes.

**Mécanisme** : `ParcelCell.strawTons` posé à la moisson, décroissant si on
tarde (la pluie abîme un andain). `Bale` comme objet de parcelle, avec position.

**Animation** : la presse recrache une botte tous les deux ou trois cases, le
chariot lève et empile.

**Liens** : sol (résidus), élevage (litière), marché (nouvelle marchandise
STRAW), bâtiment (le hangar à paille sert enfin à quelque chose).

**Économie** : la paille vaut peu à la tonne mais sort d'une récolte déjà payée.
Elle devient la première source de revenu secondaire.

---

## Phase 2 — Maïs grain ou maïs ensilage

*Idée de Strea également.*

Le maïs se récolte de deux façons, et ce sont deux métiers.

| | Maïs grain | Maïs ensilage |
|---|---|---|
| Récolte | Tardive, épi seul | Précoce, plante entière |
| Machine | Moissonneuse | **Ensileuse** |
| Tonnage | Faible | Trois à quatre fois plus |
| Humidité | Forte, séchage à payer | Sans objet |
| Débouché | Marché, alimentation humaine | Alimentation animale |
| Prix | Élevé | Faible à la tonne |

La décision se prend **au semis**, pas à la récolte : c'est ce qui en fait un
pari. On sème pour l'ensilage en pariant sur son troupeau, ou pour le grain en
pariant sur le cours.

### Ce que ça débloque

L'ensilage donne enfin son sens au champ `feedQuality`, déjà présent mais
alimenté au maïs grain, ce qui n'a pas de sens agronomique. Il faut un **silo
couloir** pour le stocker, et il ne se vend quasiment pas : sa valeur est
d'être mangé. Un céréalier qui en produit doit donc trouver un éleveur — c'est
un pont naturel entre deux métiers, et une raison d'utiliser la criée.

**Assets** : ensileuse, remorque d'ensilage, silo couloir bâché, tas
d'ensilage. **Économie** : l'ensilage vaut moins cher que le foin à la tonne
mais nourrit bien mieux ; acheter de l'ensilage doit rester moins cher que de
le produire quand on n'a pas les machines.

---

## Phase 3 — Les trois métiers, enfin distincts

Le détail — kits, absence, bourse, modes, filet PNJ — est dans le
[49](./49_TRIANGLE_METIERS.md). Ici, seulement ce que chaque métier *gagne à
faire en plus* une fois le triangle posé. Le bonus de deux pour cent n'est plus
ce qui fait le métier.

### Céréalier — la terre se travaille

**Mécanique propre : l'analyse de sol.** Chaque parcelle porte un azote, un
phosphore et un potassium qu'on ne connaît pas sans analyse payante. Fertiliser
au jugé gaspille ou sous-dose. Le pois, déjà implémenté, prend alors tout son
sens : il recharge l'azote gratuitement.

**Progression** : la largeur de travail. Les machines de départ traitent une
case par passage, les suivantes trois, puis six. C'est ce qui permet de gérer
plus de terres sans y passer plus de temps — le vrai ressort de croissance d'une
exploitation céréalière.

**Bâtiments** : séchoir (réduit la pénalité d'humidité, déjà à moitié là avec
`softDryer`), silo à plat.

### Éleveur — la ration se calcule

**Mécanique propre : la formulation.** On compose une ration à partir du foin,
de l'ensilage et du grain, pour atteindre une cible en énergie et en protéine.
Une ration juste augmente le lait ; une ration déséquilibrée coûte cher pour
rien. Cela transforme `feedQuality`, aujourd'hui un simple curseur, en décision.

**Mécanique propre : la sélection.** Les lots portent un indice de
productivité. Choisir quelles bêtes reproduire l'améliore lentement. C'est un
investissement à long terme, exactement ce qui manque à l'élevage actuel.

**Bâtiments** : salle de traite à paliers, tank à lait, nurserie. Le tank
change le modèle de vente : la laiterie collecte à intervalle fixe, à un prix
contractuel plus stable que le marché — ce qui donne à l'éleveur un revenu
régulier là où le céréalier encaisse par à-coups.

**Litière** : la paille de la phase 1 sert ici. Sans litière, l'hygiène baisse,
et avec elle la santé et la qualité du lait.

### ETA — on travaille chez les autres

Le modèle existe à l'état d'ébauche : un titre, une récompense. Il faut en faire
une entreprise.

**Mécanique propre : le carnet de commandes.** Des chantiers avec une surface,
un type de travail, une échéance et une exigence de matériel. On en accepte
plusieurs, on planifie, on livre à temps ou la réputation baisse.

**Mécanique propre : la flotte.** Quand l'ETA s'absente, ses machines dorment
par défaut — les chantiers vont aux autres, c'est le jeu. En tardif, des
conducteurs PNJ (plafond 2) utilisent *ses* machines, usure réelle, moins bien,
moins cher. Ce n'est pas « le jeu se joue tout seul » : c'est vendre de la
capacité. Le détail est au 49, § 8.4.

**Économie** : l'ETA achète du matériel surdimensionné qu'il amortit sur les
chantiers. Sa courbe de risque est inverse de celle du céréalier — il ne subit
pas la météo sur une récolte, mais il porte des traites de matériel. Son
matière première, ce sont les terres des autres.

---

## Phase 4 — Que les saisons comptent

La saison est déjà calculée et affichée, mais elle n'interdit rien. En faire une
contrainte change la nature du jeu : **l'activité rentable tourne au fil de
l'année**, et l'ennui recule tout seul.

- Fenêtres de semis par culture : on ne sème pas le maïs en novembre.
- L'hiver ne permet presque rien aux champs — c'est le moment de l'élevage, des
  réparations, des chantiers ETA, des achats.
- Le rendement dépend de la date de semis dans la fenêtre.

C'est peu de code pour beaucoup d'effet, mais c'est aussi la mécanique la plus
susceptible de frustrer : il faut que l'interface annonce les fenêtres très
clairement, longtemps à l'avance.

---

## Phase 5 — La coopération entre joueurs

**La CUMA** : plusieurs joueurs achètent une machine ensemble et se la
partagent selon un calendrier. Une ensileuse coûte trop cher pour un seul, ce
qui rend l'achat commun naturel plutôt qu'artificiel.

C'est la brique qui donne une raison de se parler au-delà de la criée, et elle
s'appuie sur des machines que les phases 1 et 2 auront rendues indispensables.

---

## Ordre retenu, et pourquoi

L'ordre ci-dessous est celui des *gestes* (ce que le joueur touche). L'ordre du
*triangle* — bourse réelle, consignes, fermes PNJ, kits, puis seulement la
paille — est dans le 49, § 14. On ne commence plus par la paille si l'ETA n'a
toujours nulle part où aller.

1. **La bourse des chantiers** (49, brique 0). Sans elle, l'ETA clique des
   titres. Avec elle, elle entre sur une parcelle qui n'est pas la sienne.
2. **Les consignes.** L'absence publie. La fenêtre de récolte (38) devient un
   appel d'offres au lieu d'une amende.
3. **Les fermes PNJ, puis les kits.** Le solo est un vrai triangle. Le choix
   de métier à l'installation tient enfin sa promesse.
4. **La paille.** Pont matière céréalier ↔ éleveur, chantier de pressage pour
   l'ETA. L'arbitrage résidus vs vente était déjà le bon.
5. **Le maïs ensilage.** Pont matière + ensileuse, machine signature de l'ETA.
6. **Le lisier.** Pont retour éleveur → céréalier.
7. **Les saisons qui ferment.** Elles créent le pic sans lequel l'ETA n'a pas
   de saison. Pas avant d'avoir de quoi vivre l'hiver.
8. **La flotte ETA, puis la CUMA.** Capacité et capital, en dernier.

---

## Le risque à surveiller

Empiler les mécaniques peut rendre le jeu illisible plutôt que riche. Trois
garde-fous :

- Chaque brique doit être **enseignée là où elle se joue**, pas dans un
  tutoriel séparé qu'on passe.
- Aucune ne doit être **obligatoire pour progresser** : la paille, l'ensilage et
  la CUMA sont des façons de mieux jouer, pas des péages.
- On mesure le temps qu'un joueur passe par session avant et après chaque
  phase. Si une brique n'allonge pas la session ou ne diversifie pas les
  actions, elle a échoué et on la coupe.

---

## Reste à faire

- Valider le 49 (thèse, kits de départ, ordre, flotte tardive) avant d'écrire
  la brique 0.
- Chiffrer les prix et les rendements de chaque nouvelle marchandise avant de
  coder : l'équilibrage rétroactif est toujours pire.
- Les « salariés » ne sont plus une question ouverte : c'est la flotte, tardive,
  plafond 2, machines du joueur, le présent gagne toujours (49, § 8.4).
