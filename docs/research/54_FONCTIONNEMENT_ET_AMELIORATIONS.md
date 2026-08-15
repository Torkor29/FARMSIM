# 54 — Comment le jeu marche, et ce qui cloche

**Statut :** Plan à suivre  
**Date :** 2026-08-13  
**Base :** le code de `main` tel qu’il tourne aujourd’hui, plus les quatre plaintes du jour

Ce n’est pas un rêve de jeu. C’est le fonctionnement **réel**, puis ce qu’on change, dans l’ordre.

---

## 0. La phrase du jeu

Vous avez une parcelle. Vous semez, vous attendez, vous récoltez, vous vendez. Les bêtes mangent ce que le champ produit. L’argent (terron, TRN) sert à bâtir, acheter des machines, et tenir.

Tout le reste — graisse, silo, missions, hôtel des ventes — doit **servir cette phrase**, pas l’interrompre toutes les deux secondes.

---

## 1. La boucle d’aujourd’hui (honnête)

```
Arrivée
  → choisir céréalier ou éleveur
  → une parcelle 12×12, un tracteur, un peu de foin
  → semer (blé, maïs, pois, orge, colza, herbe)
  → attendre que ça mûrisse (quelques minutes)
  → récolter
       sans silo  → le grain est vendu tout de suite, moins cher
       avec silo  → le grain est dans le stock, vous choisissez quand vendre
  → (éleveur) nourrir, sortir, traire / ramasser / tondre
  → bâtir (silo, hangar, étable, atelier…)
  → machines : elles s’usent, se salissent, perdent leur graisse
  → appoint : aider un voisin, ou une mission solo
```

### Ce qui est déjà vrai et bien

- Le champ se voit : tiges, vent, coupe au passage de la machine.
- Les machines sont des volumes, pas des cartes.
- Les bêtes ont deux poses et marchent de la porte au pré.
- Aider un **joueur** se fait déjà sur **sa** parcelle (vrai labour, vrai semis).
- L’hôtel des ventes a deux portes : Acheter / Vendre.

### Ce qui casse le plaisir (les quatre plaintes)

| Plainte | Cause réelle dans le code | Pas un « ressenti » |
|---------|---------------------------|---------------------|
| Graisser toutes les 2 secondes | Après **chaque** chantier, même 1 case, la graisse tombe à zéro. Au 3ᵉ passage sans graisser, le tracteur refuse. | `applyJobCare` met `greased: false` à chaque job. `machineWorkBlock` bloque dès `greaseSkipStreak >= 1`. |
| Missions nulles | Les missions **solo / PNJ** sont une grille de cases colorées à glisser. Pas de ferme, pas de machine qui roule. | `MissionPlay.tsx` : mini-jeu overlay. |
| Barres du bas trop pleines | Dock + options + quête + « qui est connecté » + tiroirs, tout en bas. | `FieldDock` + `.who-now-bar` + `.quest-chip` + tiroirs 820 px. |
| « J’ai du blé, le jeu dit 0 » | **Sans silo, le blé n’entre jamais en stock.** Il est vendu tout de suite au négociant (60 % du cours). L’hôtel des ventes ne montre que le stock. | `allocateGrainIntake` avec capacité 0 → tout en `soldIncoming`. |

On ne « rééquilibre » pas à l’aveugle. On change ces quatre règles.

---

## 2. Le grain : où il est, pourquoi on ne le vend pas

### 2.1 Ce qui se passe à la récolte

1. La moissonneuse coupe. Le jeu calcule des tonnes.
2. S’il y a un **silo** avec de la place : les tonnes vont dans le stock (`inventory`).
3. S’il n’y a **pas de silo**, ou s’il est plein : les tonnes sont vendues **tout de suite**, moins cher. L’argent arrive dans le portefeuille. Le stock reste à 0 pour ce grain.

Le foin (herbe fauchée) va au hangar, pas au silo. Il n’est pas vendu de force.

### 2.2 Pourquoi l’hôtel dit 0

L’onglet **Vendre** liste uniquement ce qui est **encore chez vous**.  
Pas ce qui vient d’être vendu tout seul.  
Pas « le blé que j’ai vu tomber dans le champ ».

Donc : récolte sans silo → toast « vendue tout de suite » (facile à rater) → vous ouvrez Vendre → pas de blé → « j’en ai 0 ».

L’argent est déjà là. Le blé n’a pas disparu : il a été racheté sans que vous ayez choisi.

### 2.3 Ce qu’on change (grain)

**Règle unique, dite à l’écran :**

> Sans silo, on ne garde rien. Bâtissez un silo pour choisir quand vendre.

Concrètement :

1. **Après une récolte sans silo**  
   - Grand bandeau, pas un toast minuscule : « 2,4 t de blé vendues tout de suite · +X TRN · bâtissez un silo pour attendre un meilleur prix. »  
   - Le portefeuille clignote.  
   - Un bouton **Bâtir un silo** sur le bandeau.

2. **L’hôtel des ventes**  
   - S’ouvre sur **Vendre** quand on appuie sur Vendre (aujourd’hui il s’ouvre sur Acheter).  
   - S’il n’y a pas de blé mais qu’on vient d’en vendre de force : « Votre blé a déjà été vendu (pas de silo). Il reste X TRN. »  
   - Un chiffre **Blé : 0 t** visible sur la ferme, pas seulement dans l’hôtel.

3. **Le silo est le premier bâtiment qu’on pousse**  
   - Le guide le dit dès la première récolte, pas après.  
   - On ne change pas la règle « pas de silo = pas de stock ». On la **rend évidente**. Garder du grain dans les poches casserait l’intérêt de bâtir.

4. **Plus tard (pas tout de suite)**  
   Un tout petit « tas au bord du champ » le temps de construire le silo, 1 récolte max, qui se vend tout seul si on tarde. Seulement si le bandeau ne suffit pas.

---

## 3. Graisser : plus une corvée toutes les deux secondes

### 3.1 Pourquoi c’est abusif aujourd’hui

La graisse n’est pas une jauge. C’est un interrupteur.

- Vous semez 3 cases → graisse = off.  
- Vous semez encore 2 cases → encore autorisé, mais « un départ sans graisse » est compté.  
- Au passage suivant → **bloqué** : « Graissez avant de repartir. »

Si on sème au pinceau, case par case, on est bloqué avant d’avoir fini cinq cases. D’où « toutes les 2 secondes ».

L’usure (la barre 100 % → 15 %) n’est **pas** le problème. Un tracteur tient ~400 cases à 0,25 point / case. C’est la graisse binaire qui tue le rythme.

### 3.2 Nouvelle règle

La graisse est une **jauge**, comme le réservoir.

| | Aujourd’hui | Demain |
|--|-------------|--------|
| Durée | 1 chantier | **un tour de parcelle** (~80–120 cases) ou 8 minutes de jeu, le premier des deux |
| Ce qui la vide | N’importe quel « Valider » | Les cases travaillées, plus vite si on va vite / si c’est sale |
| Quand ça bloque | 3ᵉ chantier | Jauge à 0 **et** un bandeau « Graissez, sinon ça force » — encore **un** passage de grâce |
| Mini-jeu | 5 points à toucher, à chaque fois | Seulement quand **vous** ouvrez l’atelier, ou quand la jauge le demande |

Saleté : elle monte toujours (engrais plus que semis). Nettoyer reste un plus (moins d’usure, un peu plus de récolte). Ce n’est plus obligatoire tous les deux tours.

### 3.3 Ce qu’on voit

- Sur le tracteur / dans le dock : une petite goutte (pleine / à moitié / vide).  
- À 20 % : « Pensez à graisser » — on peut encore semer.  
- À 0 % : un passage, puis blocage.  
- L’atelier reste le mini-jeu des 5 points. Il n’apparaît plus tout seul au milieu d’un semis.

Chiffres de départ à tester (pas gravés) : 100 points de graisse, −1 par case, −0,4 en plus si sale. Un champ 12×12 ≈ une vidange. C’est un rythme de **saison**, pas de **clic**.

---

## 4. Missions : du vrai travail, pas une grille

### 4.1 Deux sortes, deux traitements

| Mission | Aujourd’hui | Demain |
|---------|-------------|--------|
| **Chez un joueur** | Déjà sur sa parcelle, vrais outils | On garde. On arrive chez lui, on fait le vrai labour / semis / moisson. On est payé case par case. |
| **Solo / PNJ** | Grille colorée à glisser (`MissionPlay`) | **On arrête ça.** Soit on va sur une **vraie petite ferme PNJ**, soit on n’offre pas la mission. |

Aider un joueur sans aller chez lui, c’est un mensonge. Le code P2P le fait déjà bien (`laborOrder` + présence sur la parcelle). Le mensonge, c’est le filet solo.

### 4.2 Mini-jeux : simples, sur le champ

Pas un autre écran. Le plaisir, c’est la machine qui avance.

| Travail | Mini-jeu (30–90 s) | Ce qui le rend stimulant |
|---------|--------------------|---------------------------|
| Semis | Tenir la ligne : le tracteur avance, vous corrigez le cap | Une ligne droite rapporte un tout petit bonus ; un zigzag en sème à côté |
| Labour | Même idée, sillons visibles | Un sillon de travers se voit |
| Moisson | Suivre les cases mûres, ne pas rater une bande | Jauge « grains dans la trémie » |
| Engrais | Passer sans trop recouper (trop = gaspillé) | |
| Graisser / nettoyer | Les 5 points / la poussière, **seulement à l’atelier** | Rare, donc ok |

Règles des mini-jeux :

- Un doigt, pas de combo.  
- On peut **rater** un peu et finir quand même (moins payé / un peu plus d’usure).  
- On ne peut pas les « skip » contre de l’argent au début : sinon personne ne les joue. Plus tard, oui, cher.
- Durée courte. Si ça dépasse 2 minutes, c’est trop.

### 4.3 Missions joueur (le vrai appoint)

1. Quelqu’un publie « j’ai 24 cases à labourer ».  
2. Vous acceptez → vous **arrivez sur sa parcelle** (bandeau : « Chez Marie · encore 24 cases »).  
3. Vous utilisez **vos** outils, sur **son** sol.  
4. Chaque validation avance le chantier. À 0, vous êtes payé, vous rentrez chez vous.

Pas de grille. Pas de « Encaisser » magique. Le dock le dit : vous n’êtes pas chez vous.

Plafond : l’appoint ne doit pas rapporter plus que cultiver chez soi. Le salaire reste calé sur l’usure, pas sur le prix du blé.

### 4.4 Ce qu’on ne fait pas

- Inventer paille / ensilage pour « remplir » les missions.  
- Un troisième métier « ETA ».  
- Des missions de graissage isolées (graisser son propre tracteur n’est pas une mission).

---

## 5. Mobile : une seule barre en bas

### 5.1 Le problème

Aujourd’hui, en bas, ça s’empile :

1. Puce de quête  
2. Plateau d’options (cultures, pinceau, « payer quelqu’un »)  
3. Barre d’outils (Voir, Semer, Récolte, Sol, Vendre, plus Garage / Missions / Élevage / Test)  
4. Parfois le bandeau « qui est connecté »  
5. Le tiroir (bâtir, garage…) par-dessus

Sur un pouce, c’est illisible. Les labels sont minuscules. On tape à côté.

### 5.2 La règle

**Une barre. Cinq cases. Le reste est un tiroir.**

```
[ Semer ] [ Récolte ] [ Sol ] [ Vendre ] [ Plus ]
```

- **Plus** ouvre un tiroir : Garage, Missions, Élevage, Bâtir, Parcelle.  
- Quand un tiroir est ouvert, **la barre se cache**. On ne superpose pas.  
- Les options (blé / maïs / pinceau) n’apparaissent **que** si Semer ou Sol est choisi — une rangée, pas un deuxième dock.  
- La quête remonte **en haut**, une ligne.  
- « Qui est connecté » : un toast à l’arrivée, pas une barre permanente.  
- Le bouton Test disparaît hors développement.

### 5.3 Tailles pouce

- Cible 56×56 px minimum.  
- Cinq boutons, pas neuf.  
- Texte 0,75 rem, pas 0,64.  
- Zone sûre (encoche, barre iOS) : la barre flotte au-dessus, le tiroir aussi.  
- Un seul panneau à la fois. Retaper Plus le referme.

### 5.4 Gestes (déjà bons, à garder)

- Un doigt = déplacer la vue.  
- Deux doigts = zoom.  
- Clic seulement au relâchement, si on n’a presque pas bougé.  
- On ne resème pas en glissant pour cadrer.

---

## 6. Le reste qui n’est pas ouf (à traiter après les quatre)

Ordre : on ne touche à ça **qu’une fois** graisse, grain, missions joueur et barre mobile tenables.

| Sujet | Pourquoi ça gêne | Direction |
|-------|------------------|-----------|
| On ne voit pas son stock sur la ferme | Il faut ouvrir l’hôtel pour savoir si on a du blé | Une ligne HUD : `Blé 2,1 t · Foin 0,4 t · 1 240 TRN` |
| Qualité / humidité | « Trop d’eau, moins cher » est juste, mais invisible au champ | Une teinte ou un picto sur le tas / le silo |
| Réparer / graisser / nettoyer mélangés | Trois actions d’atelier, on ne sait pas laquelle ouvrir | Une fiche machine : jauge état, jauge graisse, jauge saleté, un bouton chacune |
| Guide trop long | Beaucoup de drapeaux, peu de « maintenant, fais ça » | Une seule consigne à la fois, en haut |
| Bâtiments en photo manquante | Beaucoup de `.webp` absents → trous | Fallback dessin (comme les SVG animaux) |
| Paille / ensilage | Encore « bientôt » | On ne les invente pas. Quand on les fera : andain visible, puis bottes / silo couloir, vendables |
| Fermes PNJ persistantes | Les missions solo n’ont pas de terre | Une parcelle PNJ par région, plus tard, pour remplacer la grille |
| Transport | La marchandise se téléporte encore souvent | Tracteur + remorque déjà là pour une livraison ; l’étendre aux ventes silo → hôtel |
| Élevage | Solide (fosse, pré, lait) | Ne pas alourdir tant que le céréalier n’a pas compris son grain |

---

## 7. Ordre de fabrication

On ne fait pas tout d’un coup. Chaque étape se **joue** avant la suivante.

| # | Quoi | On arrête quand |
|---|------|-----------------|
| **1** | Graisse = jauge. Plus de blocage à 3 coups de pinceau. Goutte visible. | On sème un champ entier sans ouvrir l’atelier. |
| **2** | Récolte sans silo : bandeau clair + argent qui clignote. Vendre ouvre Vendre. Stock sur le HUD. | Personne ne demande « il est où mon blé ». |
| **3** | Barre mobile à 5 cases + Plus. Tiroir unique. Quête en haut. | Le pouce n’empile plus trois barres. |
| **4** | Missions joueur : on arrive chez lui, on fait le vrai travail. On retire la grille solo (ou on la cache). | Aider un voisin = être sur sa parcelle. |
| **5** | Mini-jeux de champ (ligne de semis / moisson). Courts. | Un chantier solo (quand les PNJ auront une terre) n’est plus une grille. |
| **6** | HUD stock + fiche machine à 3 jauges. | L’atelier n’est plus une surprise. |

Pas de paille, pas d’ensilage, pas de 3ᵉ métier dans cet ordre.

---

## 8. Chiffres à tester (étape 1–2)

| | Valeur de départ | Si c’est encore pénible |
|--|------------------|-------------------------|
| Graisse pleine | 100 | Monter à 140 |
| Coût / case | 1 | Baisser à 0,6 |
| Passage de grâce à 0 | 1 chantier | 2 chantiers |
| Prix négociant sans silo | 60 % du cours | Garder 60 % — le problème est la **lecture**, pas le prix |
| Silo T1 | 40 t | Assez pour plusieurs récoltes 12×12 |

---

## 9. Ce que le joueur doit pouvoir raconter

Après ces changements, une partie ressemble à ça :

> J’ai semé tout mon blé d’un coup, le tracteur a tenu.  
> J’ai récolté : sans silo, on m’a dit tout de suite que c’était vendu, et j’ai vu l’argent.  
> J’ai bâti le silo. La fois d’après, le blé était dans mon stock, je l’ai vendu quand j’ai voulu.  
> Un voisin a demandé un labour : je suis allé chez lui, j’ai labouré pour de vrai.  
> Sur le téléphone, j’ai cinq boutons. Le reste est derrière Plus.

Si on ne peut pas raconter ça, le plan n’est pas fini.
