# Les personnages en 3D

*Note de conception — refonte du bonhomme et de son menu.*

## Le problème

Le personnage était un empilement de boîtes : tête cubique, torse
parallélépipédique, yeux en plaquettes, bouche en barrette. Aucune articulation,
donc aucune animation possible — la vignette ne pouvait que tourner sur son
socle. Et le menu de création alignait onze rangs de pastilles sous un
formulaire, si bien que le personnage sortait de l'écran dès qu'on descendait
régler sa tenue.

Le verdict du propriétaire du jeu était sans appel : « le menu personnalisation
du bonhomme est pas beau ni esthétique ni sympa, les bonhommes sont moches de
fou ».

## Ce qui a changé

### Une seule tête, rétreinte

Premier essai : un crâne et une mâchoire, deux ellipsoïdes qui se recouvrent.
Le résultat portait une cicatrice — la courbe d'intersection des deux surfaces,
parfaitement visible de l'oreille au menton. **Deux volumes qui se croisent
laissent toujours cette trace.**

D'où une seule forme : une sphère mise à l'échelle, puis resserrée vers le bas
sommet par sommet (`headShape`). Le crâne garde son galbe, la mâchoire se
resserre, le menton avance. La transition est continue, donc il n'y a rien à
raccorder.

### Tout se pose sur la surface, jamais à une profondeur devinée

`faceZ(x, y)` rend la profondeur de la peau à un point donné du visage ;
`bustZ(y)` fait de même pour le buste. Yeux, nez, bouche, sourcils, barbe,
bavette, revers, boutons : chaque pièce se place par rapport à ces fonctions.

C'est la leçon la plus coûteuse de la refonte. La première version plaçait les
yeux à `z = 0.096` — une valeur juste pour la tête de l'instant. Au premier
ajustement de la forme du crâne, les globes se sont retrouvés **à l'intérieur**
et le personnage a perdu son regard, sans que rien ne le signale. Même
mésaventure pour la bavette de la salopette, noyée dans le torse : le vêtement
se réduisait à sa couleur.

### Les paupières font le regard

Une paupière haute articulée (`lidL` / `lidR`) et une basse fixe bornent
l'ouverture. Sans la basse, le globe entier est visible et le personnage
écarquille les yeux en permanence — le regard de terreur de tous les avatars
ratés. La forme des yeux choisie dans le menu ne change que l'angle de repos de
la paupière haute et l'écartement : cinq regards pour une seule géométrie.

Le clignement interpole cet angle vers `LID_CLOSED`, toutes les trois secondes
environ.

### Un squelette, donc des animations

Vingt-trois articulations nommées (`hips`, `chest`, `head`, `armL`, `foreR`,
`thighL`, `lidR`…), chacune gardant sa pose de repos. Les animations s'y
ajoutent au lieu de l'écraser :

- **respiration** — la cage se soulève, le corps monte d'un millimètre ;
- **report du poids** d'un pied sur l'autre, ce qui empêche la pose de paraître
  figée ;
- **clignement** et balayage lent du regard ;
- **marche** — la phase vient de la **distance parcourue**, comme les roues des
  engins : deux personnages à la même vitesse posent le pied ensemble, quel que
  soit le moment où ils sont apparus à l'écran ;
- **salut** de la main, joué à l'apparition et à chaque sélection ;
- **posture de travail**, penché sur l'ouvrage.

### Les matières

Deux choix portent tout le rendu. La peau reçoit un voile de `sheen` chaud —
l'approximation la moins chère de la lumière qui traverse l'épiderme ; sans
elle un visage a l'air taillé dans le plâtre, avec trop il vire au laiteux. Le
tissu reçoit un `sheen` large et rugueux, le halo qu'on voit sur un vêtement à
contre-jour, ce qui suffit à le distinguer d'une carrosserie peinte.

Le couvre-chef a sa propre matière (`hat`) : la première version le peignait
avec le tissu des vêtements, si bien que changer de pantalon changeait la
couleur du chapeau.

### Cheveux, barbe, chapeaux

Trois nouveaux réglages : **coiffure** (8), **couleur de cheveux** (7) et
**barbe** (6) — le personnage était chauve et glabre, ce qui expliquait une
bonne part du « moches de fou ». `parseAppearance` remplit les champs manquants
par défaut, donc les comptes existants restent lisibles.

La coiffe est une calotte **inclinée vers l'arrière** : droite, elle descend à
la même hauteur partout, donc soit elle laisse la nuque nue, soit elle mange les
sourcils. Sous un chapeau, tout ce qui coiffait le crâne disparaît — les mèches
traversaient la paille et ressortaient sur le dessus ; ne restent que la nuque,
les tempes, une natte ou une queue de cheval.

La barbe pleine est découpée dans la **surface de la tête** elle-même, grossie
de l'épaisseur du poil : elle épouse le menton exactement, quelle que soit la
tête.

## Le menu

Onze réglages empilés, c'est un formulaire administratif. Trois onglets —
Visage, Coiffure, Tenue — tiennent chacun sous le personnage, qui reste visible
pendant qu'on le modifie : c'est tout l'intérêt d'un miroir. Le cadrage suit
l'onglet, buste pour le visage et la coiffure, plein pied pour la tenue. Le
plateau se fait tourner au doigt, et chaque rang a ses flèches pour parcourir
les options sans viser une pastille.

## Ce qui mesure tout ça

`apps/web/src/__tests__/character-mesh.test.ts`, dans la lignée des tests du
parc matériel : trois.js construit une scène sans le moindre contexte
graphique, donc l'aplomb, l'échelle et la hiérarchie se vérifient dans Node.

Un bonhomme est plus fragile qu'un engin : ses pièces se posent au millimètre
sur un visage de trente centimètres, et **toute** combinaison doit tenir debout
— il y en a des dizaines de milliers, et le joueur en verra une que personne n'a
jamais regardée. Les tests balayent donc chaque option de chaque famille, plus
cinquante tirages au sort, en vérifiant à chaque fois l'aplomb au sol et
l'échelle. S'y ajoutent la présence des articulations, le fait qu'une pièce
choisie apparaisse vraiment, et les invariants d'animation — le pas suit la
distance et non le temps, les jambes marchent en opposition, l'œil finit par se
fermer, et le pied ne passe jamais sous le sol en pleine foulée.

## L'atelier

`characters.html` — le catalogue de pièces, famille par famille, chacune isolée
sur son plateau, puis le menu et huit tirages au sort. Page de travail, hors
jeu. `?family=hat` choisit la famille (huit canevas 3D rendent la page trop
occupée pour répondre à un clic) et `?solo` n'affiche que le menu, pour juger un
visage en grand.
