# La forge d'assets 3D

Les décors du jeu (arbres, moulin, puits, étals…) sont **modélisés par
script dans Blender**, puis exportés en `.glb` compressé que le jeu charge.
Tout est du code versionné : on relit une recette comme on relit du
TypeScript, on la modifie, on la reconstruit à l'identique.

Le pourquoi (style visé, options étudiées, budgets, feuille de route) :
[`docs/FORGE_ASSETS.md`](../../../docs/FORGE_ASSETS.md).

## Démarrer

```bash
scripts/forge.sh liste                      # les recettes, à jour / périmé / absent
scripts/forge.sh construire moulin --apercu # construire, contrôler, cuire l'AO, exporter, rendre
scripts/forge.sh construire --perimes       # tout ce dont la source a changé
scripts/forge.sh apercu nature --piece sapin-1 --angles 4   # rendre sans exporter
```

Premier appel : `scripts/forge.sh` crée `.forge-env/` (Python 3.11 + `bpy`
4.2, environ 500 Mo). Il faut aussi Node (`npx`) pour la compression meshopt.

L'atelier web montre les `.glb` livrés, sous l'éclairage du jeu :
`http://localhost:5173/decor.html` (`?asset=moulin`, `?piece=moulin`,
`?saison=automne`, `?nuit`).

## Ce qui se passe à la construction

```
recettes/<id>.py ──construire(a)──▶ Atelier (pièces × nœuds × matières)
                                      │ realiser() : un maillage par (nœud, matière)
                                      ▼
                                   controle   budgets, pose au sol, faces confondues
                                      │ (échec → pas d'export, code 1)
                                      ▼
                                   cuisson    occlusion ambiante → COLOR_0
                                      ▼
                                   sortie     .glb → meshopt → public/assets/decor3d/<id>.glb
                                      │                  + manifest.json (pièces, matières, saisons, empreinte)
                                      ▼
                                   apercu     Cycles, caméra et soleil du jeu → .apercus/<id>/*.png + planche.png
```

## Écrire une recette

Un fichier `recettes/<id>.py` qui définit `ASSET` et `construire(a)` :

```python
ASSET = {
    "titre": "Puits à souhaits",
    "echelle": 1.0,              # mètres → unités du jeu
    "budget_triangles": 7000,    # par pièce
    "budget_appels": 16,         # par pièce (= nombre de matières)
    "etiquettes": ["repere"],
}

def construire(a):
    with a.piece("puits"):                                  # nœud racine nommé
        a.cylindre("pierre-sombre", 0.8, 0, 0.1)            # matière de la palette
        a.toit("tuile", 2.0, 1.35, 42, centre=(0, 0, 2.66))
        with a.noeud("treuil", origine=(0, 0, 1.58)):       # nœud animable
            a.baton("bois-clair", (-0.8, 0, 1.58), (0.8, 0, 1.58), 0.07)
```

Repère : **mètres, Z en haut, la caméra du jeu du côté −Y** (les façades
regardent −Y). L'export passe en Y en haut ; le −Y de Blender devient le +Z
du jeu.

### Les outils de l'atelier

| Famille | Méthodes |
| --- | --- |
| Structure | `piece(nom)`, `noeud(nom, origine)`, `repere(position, rot_z, echelle)`, `matiere(nom, couleur…)` |
| Volumes | `boite`, `pose`, `cylindre`, `baton`, `tour` (révolution), `tube`, `tore`, `boule`, `prisme`, `pignon`, `toit` |
| Toiles, bois | `toile` (auvent rayé), `planches`, `corde`, `fanions` |
| Organique | `fondre` (sphères → une peau douce, remaillage voxel), `citrouille`, `dalles` (Voronoï), `plateau` (terrasse), `contour_organique` |
| Nature | `arbre_rond`, `sapin`, `buisson`, `rocher`, `roseaux`, `lavande`, `fleur`, `touffe`, `lame`, `tronc` |

Les couleurs viennent de `forge/palette.py` : un **nom de matière** stable par
couleur. Le jeu repeint par nom (`teinterSaison`) avec les couleurs de
`SAISONS` recopiées au manifeste.

### Les règles qui évitent les ratés

1. **Toujours un biseau.** Une arête vive fait « pavé de code ». Les barreaux
   fins passent d'eux-mêmes à un seul segment de biseau (on ne le verrait pas).
2. **Jamais deux faces dans le même plan.** Une pièce en saillie dépasse de
   1 à 3 cm, une pièce recouvrante est en retrait. Le contrôle signale les
   faces confondues avec leur position (en coordonnées du jeu).
3. **Posé au sol.** Le point le plus bas d'une pièce posée est à 0 (± 3 cm).
   Un décor qui s'enfonce volontairement (îlot, mare) le déclare.
4. **Budget par rôle.** Un élément instancié par centaines (touffe, fleur)
   reste sous quelques centaines de triangles ; un repère unique (moulin)
   peut monter à 10 000. Chaque matière coûte un appel de rendu.
5. **Regarder l'aperçu, pas seulement le rapport.** La boucle est :
   écrire → `apercu` → lire `planche.png` → corriger la chose la plus
   visible → recommencer.

## Anciens scripts

`rucher.py` et `pancartes.py` précèdent la forge ; ils s'exécutent seuls
(`env/bin/python apps/web/blender/rucher.py`) et restent valides. Les porter
en recettes est au programme (voir la feuille de route).
