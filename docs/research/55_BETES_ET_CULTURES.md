# Les bêtes et les cultures

*Note de conception — état des lieux, puis refonte.*

## L'état des lieux

Deux constats, faits en posant côte à côte ce que la ferme montre déjà.

**Les bêtes étaient hors sujet.** Un assemblage de boîtes et de cylindres en
Lambert plat, à côté d'engins en géométrie procédurale vernie et de
personnages articulés. Pire : sur la carte, l'étable est une illustration 2D
où des vaches sont **peintes dans le décor** — la seule vraie bête à l'écran
était un petit cube blanc au pied du bâtiment.

Côté états, la simulation suit depuis le début le bien-être (`happiness`), la
faim, le risque de perte et l'avancement de la collecte. La parcelle n'en
montrait rien : seulement « dedans / dehors » et « tondu », ce dernier réduit
à une mise à l'échelle de 0,75.

**Les cultures ne se distinguaient pas.** Six cultures — blé, orge, maïs,
pois, colza, herbe — partageaient la même lame et le même épi. Seule la teinte
changeait, et l'orge et le blé sont deux jaunes voisins. Un cube doré flottait
au-dessus des cases mûres pour annoncer la récolte.

## Les cultures

Chacune a sa silhouette, parce que c'est **elle** qui nomme une culture : la
barbe de l'orge, deux fois plus longue que l'épi ; la grappe jaune du colza ;
le panache et les feuilles retombantes du maïs ; les gousses et vrilles du
pois ; la touffe sans épi de l'herbe.

Le champ passe d'un maillage unique à **un maillage instancié par espèce
semée**. Douze cases de blé ne coûtent toujours qu'un appel de rendu ; c'est
le maillage unique qui interdisait de donner sa forme à chaque culture.

Un attribut `aAccent` marque les sommets qui prennent la couleur de l'espèce.
Sans lui, un colza en fleur serait un buisson uniformément jaune, tige
comprise.

L'épi, la gousse et la fleur **sortent avec la maturité** : avant l'heure, ils
sont repliés contre la tige. Le cube doré a disparu — un vrai épi qui grossit
dit la même chose et fait partie de la plante.

## Les bêtes

Refaites au même vocabulaire que les personnages : ellipsoïdes et capsules,
matières `sheen` pour le poil et la laine, fusion par matière, articulations
nommées.

Ce qu'une bête raconte maintenant, sans qu'on ouvre un menu :

- **son espèce**, à la silhouette — cornes et taches, toison, crête et bec,
  groin et queue en tire-bouchon ;
- **son bien-être** : le poil se ternit et perd son halo, l'échine ressort
  chez la vache, les côtes se marquent chez le cochon, le port de tête baisse.
  C'est le même principe que l'usure des machines ;
- **sa production en attente** : le pis se remplit entre deux traites, la
  toison gonfle entre deux tontes, la poule s'arrondit ;
- **ce qu'elle fait** : elle rumine en continu, chasse les mouches de la
  queue, couche l'oreille par à-coups, broute, marche, se couche.

La foulée vient de la **distance parcourue**, comme les roues des engins :
deux bêtes à la même vitesse posent le pied ensemble. Les pattes battent en
diagonale — les quatre en phase donnent un jouet à ressort.

## La peau, pas l'assemblage

Premier jet : chaque bête était une union d'ellipsoïdes qui se recouvrent.
Lisse en apparence, mais **chaque intersection laisse une arête** — la même
cicatrice que le crâne et la mâchoire des personnages. C'est elle qui donnait
aux bêtes leur air géométrique.

Corps, cous, têtes, pattes et queues sont désormais des **fuselages** : une
surface unique tendue sur une suite de sections elliptiques, interpolées en
Catmull-Rom. Le garrot enfle, le flanc s'arrondit, la croupe redescend, sans
une seule couture. Un membre est un fuselage lui aussi : le canon se resserre
sous le genou puis s'évase au boulet, là où deux cylindres empilés laissaient
une arête au milieu.

La toison **multiplie** le gabarit au lieu de s'y ajouter. Ajoutée, l'épaisseur
gonflait aussi les deux bouts du fuselage et la brebis devenait un tonneau à
fonds plats.

Une peau se paie en secteurs : dix-huit secteurs sur vingt tranches tiennent la
rondeur et divisent la facture par deux — six mille cinq cents triangles pour
une vache, contre onze mille au premier jet. Un test verrouille le plafond : au
champ, une bête fait quarante pixels de haut, et il y en a huit par troupeau.

## Deux pièges payés au prix fort

**Le garrot ne tient qu'à deux millimètres du sol.** Une première version
baissait le corps des bêtes mal en point pour dire l'affaissement : elles se
retrouvaient les sabots dans la terre. Le mal-être se dit par la posture, dos
voûté et tête basse, jamais par l'altitude.

**Une bête couchée ne broute pas.** Cumuler les deux poses enfonçait le museau
sous la terre, le corps étant déjà au ras du sol. L'ampleur du pâturage est
donc bornée par celle du coucher.

La descente au repos a coûté la même leçon une troisième fois : exprimée en
pourcentage de la hauteur au garrot, elle enfonçait la brebis sous terre — une
toison est bien plus épaisse qu'un flanc de vache pour un garrot plus bas. On
mesure donc le dessous réel de la bête, toison comprise, et elle descend
jusqu'à poser le ventre, pas plus loin.

Le pis a coûté le même genre d'erreur : logé à l'intérieur de l'ellipsoïde du
corps, il ne se voyait pas, et une vache pleine ressemblait à une vache qu'on
venait de traire. Il pend maintenant sous le ventre — et se rentre quand la
bête se couche, sinon il traverse le sol.

## L'atelier

`farm.html` — trois planches. `?only=crops` aligne les six cultures à trois
âges ; `?only=animals` met chaque bête sur un plateau dans tous ses états ;
`?only=herd` montre le troupeau qui sort et rentre de l'étable.
