# 52 — Plan : cultures, élevage, fumier, transport, halle

**Statut :** Plan à suivre, pas encore codé  
**Date :** 2026-08-13  
**Complète :** les 7 idées validées (sans la pression « tout mûr le même jour », sans l’hiver, sans le journal de login)

Tout ce qui suit doit se **voir sur la ferme**, **se vendre à la halle**, et **s’offrir au Bureau**. Si un ajout ne touche qu’un métier, on ne le fait pas.

---

## Ce qui existe aujourd’hui (pour ne pas rêver)

**Céréales :** blé, maïs, pois. Le pois sert surtout à reposer le sol.  
**Élevage :** vaches (lait + viande) et cochons (viande). On les nourrit avec du foin, du maïs, de l’ensilage.  
**Le foin :** on l’achète au négociant. On ne le fait **pas** pousser.  
**Paille / ensilage :** déjà là (andain, bottes, ensileuse, silo couloir).  
**Bureau / halle :** menus à trois colonnes (autre PR).  
**3D :** low-poly (boîtes colorées). Les vaches au pré sont déjà des petits volumes. Les cultures sont des cubes dont la couleur change en poussant. On **garde ce style**. Pas de modèles « réalistes » avant que le jeu tienne.

---

## Ordre (chaque étape s’appuie sur la précédente)

| Étape | Quoi | Pourquoi maintenant |
|-------|------|---------------------|
| **1** | Trois cultures de plus | Sans ça, l’éleveur n’a toujours que maïs + foin acheté |
| **2** | Poules et moutons | L’éleveur a enfin plus que deux bâtiments |
| **3** | Fumier | L’éleveur vend quelque chose au céréalier |
| **4** | Départ sans moissonneuse + joueur mieux que voisin auto | Le Bureau sert dès le premier jour |
| **5** | Transport | La marchandise ne se téléporte plus |
| **6** | Qualité à la halle + phrases au bon moment | On comprend pourquoi un lot vaut moins |

On ne code pas l’étape 5 tant que 1–3 ne se vendent pas. Sinon on transporte du vent.

---

## 1. Trois cultures de plus

Aujourd’hui : blé, maïs, pois. Trop peu, et le foin n’existe que comme achat.

### Ce qu’on ajoute

| Culture | Pousse | Récolte | Sert à |
|---------|--------|---------|--------|
| **Orge** | Comme le blé, un peu plus vite | Grain + **paille** (comme le blé) | Nourrir les cochons (mieux que le blé). Vendre le grain. |
| **Colza** | Un peu plus long | Grain **sans** paille | Tête de rotation (comme le pois) : le sol est meilleur après. Prix à la tonne plus haut, rendement plus bas. |
| **Herbe** | La plus rapide | On **fauche** → foin en stock | Nourrir tout le monde. Plus besoin d’acheter le foin si on a de l’herbe. |

L’herbe n’est pas une céréale. C’est un champ qu’on coupe plusieurs fois. Pas de moissonneuse : tracteur (ou quelqu’un au Bureau). Après la coupe, le champ reprend tout seul un moment, puis il faut resemer.

### Liens

- Orge → paille (déjà le système andain / presse / bottes).  
- Orge grain → ration cochons (nouveau type de nourriture, à côté du maïs).  
- Colza → rotation (déjà le système pois).  
- Herbe → foin → étable. Le hangar foin sert enfin à **ranger ce qu’on a coupé**, pas seulement ce qu’on a acheté.  
- Halle : orge et colza dans « Céréales », foin déjà dans « Fourrage ».

### Chiffres de départ (à tester, pas gravés)

| | Rendement / case | Temps de pousse | Semence / case | Paille |
|--|------------------|-----------------|----------------|--------|
| Orge | 0,32 t | 2 min 40 | 13 TRN | oui, comme le blé |
| Colza | 0,22 t | 3 min 20 | 16 TRN | non |
| Herbe | 0,40 t de foin / coupe | 2 min, puis 1 min 20 entre deux coupes | 8 TRN | non |

### 3D et animation

- **Pas de nouveau fichier 3D obligatoire.** On change couleur et hauteur du cube culture :
  - orge : plus blond, plus bas que le blé ;
  - colza : jaune franc à maturité ;
  - herbe : vert court ; après fauche, sol ras + andain de foin (même idée que la paille).
- Animation de fauche : la machine passe, le cube raccourcit, le foin apparaît au sol puis part au hangar (comme les bottes).
- Plus tard, si on a le temps : une image `/assets/crops/barley.webp` etc. pour le dock. Pas bloquant.

### Fichiers touchés

`CropCode`, `CROP_DEFS`, `GOOD_DEFS` (orge, colza), `STRAW_YIELD`, `feedUnits` / ration, `IsoFarmView.cropColor`, dock de semis, halle, guide de jeu, régions dans `world.ts` (qui a le droit de semer quoi).

---

## 2. Poules et moutons

Aujourd’hui : vaches et cochons seulement. Les vaches donnent lait + viande. Les cochons, viande. Pas d’œufs. Pas de laine. Le pré n’existe que pour les vaches (et une courette pour les cochons).

### Ce qu’on ajoute

**Poules**

- Bâtiment : **poulailler** (petit, pas cher).  
- Courette adjacente (comme la porcherie) : sinon elles restent enfermées, bonheur bas.  
- Action : **ramasser les œufs** (souvent, peu à la fois).  
- Nourriture : orge ou blé, un peu de foin. Très peu de kilos.  
- Marchandise : **œufs** (caisse, se gâte vite — chambre froide utile).  
- Viande : on peut réformer un lot, mais ce n’est pas le but. Le revenu, c’est l’œuf.

**Moutons**

- Bâtiment : **bergerie**.  
- Pré adjacent : ils vivent surtout dehors.  
- Ils mangent surtout de **l’herbe / foin**. Peu de grain.  
- Actions : **tondre** (laine) et, plus tard, vendre un lot pour la viande.  
- Marchandise : **laine** (ne se gâte pas, prix calme).  

On ne sépare pas encore « vache laitière » et « vache à viande ». Deux espèces nouvelles suffisent. Quatre bâtiments (étable, porcherie, poulailler, bergerie), c’est un vrai choix d’éleveur.

### Liens

- Herbe (étape 1) → moutons. Sans herbe, les moutons coûtent cher en foin acheté.  
- Orge (étape 1) → poules.  
- Œufs et laine → halle, catégorie « Élevage ».  
- Fumier (étape 3) : poules et moutons en produisent aussi, moins que les vaches.  
- Bureau : « ramasser les œufs » / « tondre » peuvent se publier si on part (consignes), comme la traite.

### 3D et animation

- Poules : petits volumes blancs / bruns dans la courette, tête qui picore (boucle courte).  
- Moutons : volumes blancs plus bas que la vache, ils se déplacent au pré comme les vaches déjà.  
- Tonte : le volume rétrécit un peu, un ballot de laine apparaît près de la bergerie.  
- Œufs : caisse au pied du poulailler quand c’est prêt (clic = ramasser).  
- Bâtiments : d’abord la même recette que l’étable (boîte + toit sarcelle). Images `/assets/buildings/henhouse.webp` et `sheepfold.webp` ensuite, comme les autres.

`IsoFarmView` a déjà `makeCowMesh()`. On ajoute `makeHenMesh()` et `makeSheepMesh()` sur le même modèle. Pas de fichier `.glb` pour commencer.

### Fichiers touchés

`AnimalKind` (`COW` \| `PIG` \| `HEN` \| `SHEEP`), bâtiments, `LivestockPanel`, tick bonheur / faim, `GOOD_DEFS` (EGGS, WOOL), chambre froide pour les œufs, consignes, guide.

---

## 3. Fumier

Aujourd’hui l’éleveur vend lait, viande, et c’est tout. Le céréalier n’achète rien à l’éleveur. L’engrais, c’est l’épandeur + de l’argent, point.

### Ce que ça fait

Chaque cycle d’élevage, le troupeau **laisse du fumier** à côté du bâtiment (tas sur une case, ou barre « fosse »).  
On ne le téléporte pas dans le silo : il est **là**, sur la ferme.

Trois usages, un choix :

1. **Épandre chez soi** — l’épandeur (déjà là) passe sur le champ. Le sol est un peu plus fertile, moins cher que l’engrais du magasin, un peu plus lent.  
2. **Vendre / faire venir quelqu’un** — on publie au Bureau : « venir chercher le fumier » ou « venir l’épandre chez moi ».  
3. **Laisser pourrir** — le tas grandit, puis ça bloque (plus de place, odeur = bonheur des bêtes qui baisse). On ne peut pas ignorer.

Marchandise : **fumier**. Pas un cours mondial. On le vend au voisin ou on l’épand. Comme l’ensilage : local.

### Liens

- Toutes les bêtes (vaches, cochons, poules, moutons) en produisent.  
- Céréalier : nouvel outil / même épandeur, nouvelle ligne au Bureau.  
- Halle : catégorie « Intrants », à côté du foin. Le négociant **n’en vend pas** (sinon plus personne n’élève pour ça).  
- Transport (étape 5) : un tas chez l’éleveur → champ chez le céréalier.

### 3D et animation

- Tas brun à côté de l’étable, qui grossit.  
- Passage de l’épandeur : le tas baisse, les cases du champ prennent une teinte plus sombre une minute (on **voit** que c’est passé).  
- Pas de nouveau véhicule au début : l’épandeur existe.

### Fichiers touchés

`goods.ts` (MANURE, `localOnly`), tick élevage, case ou jauge « fosse », `FERTILIZE` qui accepte le fumier, labor `SPREAD` ou extra sur `FERTILIZE`, halle, consignes (« publier l’épandage »).

---

## 4. Départ sans moissonneuse, et un joueur plutôt qu’un voisin auto

Aujourd’hui tout le monde peut acheter la moissonneuse tout de suite. L’entreprise instantanée fait le travail toute seule, un peu moins bien. Le Bureau est facultatif.

### Matériel de départ

| Métier | On donne | On ne donne pas |
|--------|----------|-----------------|
| Céréalier | Tracteur + déchaumeur, semences, une parcelle | Moissonneuse, ensileuse |
| Éleveur | Étable (ou poulailler si on choisit), quelques bêtes, un peu de foin | Moissonneuse |

La **première récolte** du céréalier passe par le Bureau : il publie, quelqu’un vient (joueur ou voisin auto). Ensuite il peut économiser et acheter la machine. Ce n’est pas interdit, c’est juste plus tard.

### Joueur mieux que voisin automatique

| | Voisin auto (déjà là) | Joueur qui prend le chantier |
|--|----------------------|------------------------------|
| Salaire | Un peu moins (déjà −12 %) | Plein tarif |
| Qualité du travail | Moins bon (déjà −6 % de récolte si entreprise instantanée) | Normal, ou un peu mieux si le joueur est là |
| Bouton « Entreprise » | Reste, pour dépanner | — |

Règle simple à l’écran : « Un joueur fera mieux. Le voisin auto, c’est si personne ne vient. »

### Liens

- Étape 1 : sans moissonneuse, faucher l’herbe et moissonner l’orge passent au Bureau.  
- Étape 3 : épandre le fumier aussi.  
- Consignes : si tu pars, ça publie. Un joueur peut te remplacer.

### 3D et animation

Rien de neuf. On réutilise l’entrée chez le voisin (déjà là) et les machines qui roulent.

### Fichiers touchés

Création de compte / première ferme (machines de départ), `contractor` plus cher ou plus laid que le chantier joueur, textes Bureau.

---

## 5. Transport

Aujourd’hui, vendre à la halle = le grain change de poche. Personne ne le déplace.

### Ce que ça fait

Quand un éleveur achète 10 t de paille à un céréalier (criée), **un chantier de livraison** se crée : aller de la parcelle A à la parcelle B.  
Soit le vendeur le fait (tracteur, déjà capable de ramasser), soit il publie au Bureau.

Tant que ce n’est pas livré : l’acheteur n’a pas le stock. Le délai est court. Si personne ne vient, un voisin auto livre, plus cher / plus lent.

Prix : vendre **au voisin** (livré) rapporte plus que vendre « au marché lointain » (négociant), parce que le trajet est déjà un travail.

### Liens

- Paille, ensilage, foin, fumier, orge fourragère : tout ce qui va de l’un à l’autre.  
- Bureau : nouvelle ligne « Livraison ».  
- Halle : après « Acheter », on voit « en attente de livraison » ou « arrivé ».

### 3D et animation

- Au début : le tracteur du livreur apparaît sur la parcelle d’arrivée, comme aujourd’hui quand on va chez le voisin.  
- Plus tard : une **remorque** (nouveau véhicule, image + boîte 3D). Pas bloquant pour ouvrir le système.

### Fichiers touchés

`FarmWork` + `TRANSPORT` (le contrat le mentionne déjà, le champ ne le fait pas), criée → ordre de livraison, stock bloqué « en route ».

---

## 6. Qualité à la halle, et une phrase au moment où ça coûte

### Qualité

Chaque lot à la halle montre déjà l’humidité. On ajoute **pourquoi** le prix bouge :

- trop humide → prix bas (déjà vrai, mal montré) ;  
- récolté trop tard → prix bas ;  
- fumier / ensilage trop vieux → prix bas ;  
- œufs hors froid → ça se gâte (déjà le système « périssable »).

Sur la fiche à droite : « 12 t · 18 % d’eau · −X % ». Le bouton Sécher reste à côté.

### Phrases (pas un tutoriel)

Une seule ligne, là où l’argent bouge :

- Grain humide : « Trop d’eau : le prix baisse. Séchez. »  
- Publier un chantier : « Cet argent est bloqué jusqu’à la fin (ou l’annulation). »  
- Fumier plein : « La fosse est pleine : les bêtes sont moins bien. Épandez ou vendez. »  
- Première récolte sans moissonneuse : « Publiez au Bureau, ou achetez la machine. »  
- Achat criée : « Pas encore chez vous : quelqu’un doit livrer. »

### 3D

Rien. C’est de l’écriture dans les menus déjà faits.

---

## Assets 3D — liste unique

Tout en **low-poly**, comme maintenant. On n’attend pas un artiste pour coder : les volumes suffisent. Les images (webp) viennent après, pour le catalogue.

| Asset | D’abord (code) | Ensuite (image) | Animation |
|-------|----------------|-----------------|-----------|
| Orge / colza / herbe | Couleur + hauteur du cube culture | Icône dock | Pousse déjà animée par la hauteur |
| Andain de foin | Même chose que l’andain de paille | — | Fauche = cube qui baisse |
| Poules | `makeHenMesh()` | — | Picorer en boucle dans la courette |
| Moutons | `makeSheepMesh()` | — | Marche au pré (copie vaches) |
| Poulailler / bergerie | Boîte + toit | `henhouse.webp`, `sheepfold.webp` | — |
| Tas de fumier | Tas brun sur une case | — | Grossit ; baisse à l’épandage |
| Caisse d’œufs | Petit volume au pied du poulailler | Icône halle | Disparaît au ramassage |
| Ballot de laine | Volume près de la bergerie | Icône halle | Après tonte |
| Remorque (plus tard) | Boîte derrière le tracteur | `trailer.webp` | Trajet chez le voisin |

Pas de `.glb` tant que les silhouettes en boîtes ne se lisent pas. Le jeu tourne dans le navigateur : un modèle lourd casse le téléphone.

---

## Ce qu’on ne fait pas dans ce plan

- Forcer deux champs mûrs le même jour (idée écartée).  
- Un « mode hiver » à part.  
- Un journal au login.  
- Séparer vaches laitières / viande.  
- Chevaux, chèvres, serres, tracteurs T3.  
- Un salarié qui joue à ta place.

---

## Critère « c’est lié »

Avant de merger une étape, on doit pouvoir jouer **cette** partie :

1. Je sème de l’herbe, je fauche, je nourris les moutons.  
2. Les poules pondent, je vends les œufs à la halle.  
3. Le fumier s’entasse, je l’épands sur le blé **ou** je le vends au céréalier voisin.  
4. Sans moissonneuse, je publie la moisson ; un joueur (ou le voisin auto) vient.  
5. La paille achetée arrive après une livraison.  
6. Un lot humide affiche clairement qu’il vaut moins.

Si l’un de ces six phrases est impossible, l’étape n’est pas finie.
