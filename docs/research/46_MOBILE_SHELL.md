# 46 — Coque mobile

**Statut :** Implémenté
**Date :** 2026-08-13

---

## Pourquoi

Le jeu se voulait « comme une application mobile » dès la première demande.
Il ne l'était pas. La disposition mobile existante se contentait de rétrécir
deux panneaux et de **masquer les autres** :

```css
.build-panel { display: none; }   /* on ne pouvait plus bâtir */
.livestock-panel { display: none; }  /* ni gérer son troupeau */
```

Le reste flottait par-dessus la ferme en petites boîtes de 170 pixels. On
voyait donc mal le jeu, et la moitié des actions étaient inatteignables.

À quoi s'ajoutait un problème plus profond : la grille fait douze cases sur
douze, cadrée pour tenir entièrement à l'écran. Sur un téléphone, une case
mesure quelques millimètres. Sans zoom ni déplacement, viser relevait de la
chance — et chaque tentative ratée semait au mauvais endroit.

---

## Principe

La ferme occupe tout l'écran. Chaque panneau devient un **tiroir du bas**, un
seul ouvert à la fois, appelé par une barre d'onglets.

Rien n'est supprimé : tout ce qui existe sur grand écran reste atteignable.
C'est la règle qui a guidé le reste — une interface mobile qui ampute n'est
pas une interface mobile, c'est une démo.

| Onglet | Contenu |
|--------|---------|
| Parcelle | Région, climat, météo, fertilité, expansion |
| Bâtir | Catalogue des bâtiments |
| Élevage | Troupeaux, ration, traite, abattage |
| Garage | Machines et usure |
| Bureau | Travaux à façon, terres, stock |

Un voile referme le tiroir d'une tape hors de lui : chercher la bonne croix
au pouce est une corvée. Retaper l'onglet actif le referme aussi.

Le seuil porte sur la largeur seule, à 820 pixels, et non sur le type de
pointeur. Une tablette au doigt et une fenêtre de bureau étroite ont le même
problème de place, et un téléphone couché repasse volontairement en
disposition large.

---

## Gestes sur la grille

Le déplacement à un doigt, le zoom à deux, la molette sur ordinateur.

Le point délicat n'est pas le geste mais sa distinction d'avec le clic. Le
semis partait auparavant sur `pointerdown` : tout déplacement de la vue aurait
semé une case au passage. Le clic ne part donc plus qu'au relâchement, et
seulement si le doigt a bougé de moins de huit pixels. Un pincement n'est
jamais un clic, même si les doigts bougent peu.

Le cadrage choisi **survit aux reconstructions de scène**. La scène se
rebâtit à chaque changement de données ; recadrer d'office renverrait le
joueur au centre à chaque semis, ce qui serait insupportable dès qu'on
travaille sur un coin de la parcelle. Le déplacement est borné pour qu'on ne
puisse pas perdre la ferme de vue sans moyen d'y revenir.

`touch-action: none` sur le canevas : sans cela le navigateur intercepte le
glissement pour faire défiler la page, et le pincement ne parvient jamais
jusqu'au jeu.

---

## Détails qui décident du ressenti

**`dvh` plutôt que `vh`.** Sur mobile, `100vh` ignore la barre d'adresse et
pousse le bas de l'interface sous le pli. `100dvh` la suit.

**Encoches et barres système.** `env(safe-area-inset-*)` sur l'en-tête, la
barre d'onglets et les modales, avec `viewport-fit=cover` déjà présent.

**Quarante-quatre pixels.** En deçà, le doigt manque la cible. Appliqué aux
onglets, aux outils, aux boutons des listes denses.

**Une seule rangée d'outils, qui défile.** La barre d'action passait à la
ligne et mangeait le tiers de l'écran. Elle défile désormais
horizontalement, en `touch-action: pan-x` pour que le geste ne parte pas en
zoom de page. Garage et Bureau y sont masqués : la barre d'onglets les
couvre déjà.

**Les modales montent du bas** en pleine largeur au lieu de flotter au
centre, et les onglets de l'écran de vente défilent.

---

## Une violation traitée au passage

Les deux écouteurs de molette — ferme et globe — étaient déclarés bloquants
pour appeler `preventDefault`, ce que Chrome signale : il ne peut plus faire
défiler la page avant de savoir si on l'y autorise. C'était inutile, la scène
occupe un conteneur qui ne défile pas. Ils sont passifs, et le zoom du
navigateur reste sur Ctrl+molette, à qui il appartient.

---

## Vérifié

Sur trois formats en émulation d'appareil — 375 × 667, 430 × 932,
768 × 1024 — puis au redimensionnement continu de la fenêtre : bascule nette,
sans panneaux dédoublés ni superposition. Le glissement déplace la vue sans
jamais semer, la tape brève sélectionne, le cadrage tient après une action.
Console vide, aucune violation.

Le petit téléphone reste le format le plus serré. Il est jouable, sans marge.

---

## Deuxième passe : le haut se superposait encore

Une capture d'un joueur, sur son propre téléphone, a montré ce que
l'émulation n'avait pas révélé : le haut de l'écran était un empilement
illisible, et la ferme n'occupait plus que la moitié de la hauteur.

### Quatre calques à des décalages fixes

Le bandeau, les pastilles du joueur, les cotations et le bilan d'absence
étaient positionnés en absolu, indépendamment, à des décalages codés en dur —
`top: 0`, `top: 3.4rem`, `top: 5.8rem`. Il suffisait qu'un élément grandisse
pour qu'il recouvre le suivant. Or les pastilles passent à la ligne dès qu'on
rétrécit, et elles étaient six.

Bandeau et cotations vivent désormais dans un même conteneur en flux. La
superposition n'est plus improbable, elle est **structurellement impossible**.

### Ce que le bandeau garde, et ce qu'il rend

Nom du jeu, badge de version, métier, niveau, expérience, bonus de ferme,
bouton d'aide et déconnexion occupaient quatre rangées au-dessus de la ferme.
Il n'en reste que ce qu'on surveille en jouant : qui l'on est, et ce qu'on a
en caisse. Le reste est passé dans un tiroir *Profil*, appelé par un bouton du
bandeau.

Le nom du jeu lui-même est masqué : sur un téléphone, le logo suffit à dire où
l'on est, et son texte écrasait le nom du joueur à trois lettres tout en
poussant la trésorerie sur une deuxième ligne.

Les cotations défilent sur une seule ligne au lieu d'en empiler trois.

Le bilan d'absence est devenu un dialogue qu'on acquitte. Il annonce parfois
huit cultures perdues : il mérite d'être lu, pas de flotter sur la ferme.

Le sélecteur de pinceau, enfin, tenait trois boutons en tête d'une barre qui
défile et repoussait les outils hors de vue. Un seul bouton alterne
maintenant entre les trois tailles.

### La grille sortait de l'écran

Défaut plus grave, et sans rapport avec la superposition : le cadrage de la
caméra se réglait sur la hauteur seule. L'étendue horizontale vaut cette
hauteur multipliée par le rapport de l'écran — donc **plus petite** en
portrait. La parcelle n'y tenait pas, et le joueur atterrissait dans un coin,
la grille coupée des deux côtés.

La caméra recule désormais jusqu'à ce que la parcelle tienne dans la dimension
la plus étroite. Le comportement sur grand écran est inchangé, le facteur ne
s'appliquant qu'en deçà d'un rapport de 1.

### Résultat

La ferme occupe environ les trois quarts de la hauteur, contre la moitié
avant. Le bandeau tient sur une rangée, les cotations sur une autre, et les
quatre bords de la parcelle sont visibles avec leurs cases distinctes.

**La leçon :** trois formats d'émulation n'avaient rien montré, parce que
j'avais vérifié que chaque élément était atteignable sans regarder ce que leur
somme donnait. Une capture d'un vrai téléphone l'a montré en une seconde.

---

## Reste à faire

- La barre d'onglets ne signale pas ce qui réclame l'attention : un troupeau
  affamé ou des cases mûres devraient s'y voir sans ouvrir le tiroir
- Les tiroirs ne se ferment pas d'un glissement vers le bas, seulement d'une
  tape hors d'eux
- L'installation guidée et le globe n'ont pas été retravaillés pour le
  tactile avec la même attention que la ferme
- Aucun mode paysage dédié : le téléphone couché reçoit la disposition large,
  qui est à l'étroit en hauteur
