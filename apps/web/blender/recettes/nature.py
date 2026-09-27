"""
Le kit nature : ce qu'on sème partout autour de la ferme.

Des feuillus « nuage » (trois silhouettes), deux sapins en jupes, des
buissons (dont deux fleuris), des rochers, des roseaux de berge, des touffes
de lavande et des fleurs des champs. Chaque élément est une pièce posée à
l'origine : le jeu en pose des clones, ou les instancie par centaines
(`instancierPiece`).
"""

import math

ASSET = {
    "titre": "Kit nature",
    "echelle": 1.0,
    "budget_triangles": 2600,
    "budget_appels": 6,
    "etiquettes": ["nature", "decor", "instanciable"],
}


def construire(a):
    for k, (h, env) in enumerate(((4.4, 3.4), (3.6, 2.8), (5.2, 3.8))):
        with a.piece(f"arbre-rond-{k + 1}"):
            a.arbre_rond(hauteur=h, envergure=env, graine=11 + k * 7)

    with a.piece("arbre-rond-automne"):
        # Un feuillu déjà roux, quelle que soit la saison : le jeu le mêle aux autres.
        a.matiere("feuillage-roux", 0xe0923a, 0.85)
        a.arbre_rond(hauteur=4.0, envergure=3.1, graine=41, feuillage="feuillage-roux")

    # Les arbres de la campagne : les mêmes feuillus « nuage », allégés (un
    # houppier de 520 triangles) pour être instanciés par centaines. Chacun
    # a sa matière de feuillage : à l'automne, le bois roussit en plusieurs
    # teintes au lieu d'une seule.
    for k, (h, env, mat, graine) in enumerate(((4.4, 3.4, "feuillage", 101), (3.8, 3.0, "feuillage-clair", 102),
                                               (5.0, 3.7, "feuillage-sombre", 103), (4.1, 3.3, "feuillage", 104))):
        with a.piece(f"arbre-leger-{k + 1}"):
            a.arbre_rond(hauteur=h, envergure=env, graine=graine, feuillage=mat, triangles=520)
    with a.piece("sapin-leger"):
        a.sapin(hauteur=4.6, largeur=2.1, etages=4, graine=111)

    for k, (h, l) in enumerate(((5.0, 2.3), (3.8, 1.9))):
        with a.piece(f"sapin-{k + 1}"):
            a.sapin(hauteur=h, largeur=l, etages=4 if k == 0 else 3, graine=21 + k)

    for k, t in enumerate((0.95, 0.7)):
        with a.piece(f"buisson-{k + 1}"):
            a.buisson(taille=t, graine=31 + k)
    with a.piece("buisson-roses"):
        a.buisson(taille=0.9, graine=35, fleurs="rose", nb_fleurs=16)
    with a.piece("buisson-coquelicots"):
        a.buisson(taille=0.75, graine=36, mat="feuillage", fleurs="coquelicot", nb_fleurs=10)

    for k, t in enumerate(((0.9, 0.7, 0.5), (0.55, 0.45, 0.35), (1.3, 0.9, 0.75))):
        with a.piece(f"rocher-{k + 1}"):
            a.rocher(taille=t, graine=51 + k, mat="pierre" if k != 2 else "pierre-sombre", mousse=k != 1)
            # Quelques touffes au pied : une pierre posée dans un pré n'est jamais nue.
            for j in range(3):
                ang = j * 2.1 + k
                a.touffe((math.cos(ang) * t[0] * 1.15, math.sin(ang) * t[1] * 1.15, 0), graine=60 + k * 3 + j,
                         brins=7)

    with a.piece("roseaux"):
        a.roseaux((0, 0, 0), graine=61, tiges=7)

    with a.piece("lavande"):
        a.lavande((0, 0, 0), graine=71)

    with a.piece("fleurs"):
        for k, (x, y, esp) in enumerate(((0, 0, "coquelicot"), (0.12, 0.08, "coquelicot"),
                                         (-0.1, 0.1, "marguerite"), (0.05, -0.12, "marguerite"),
                                         (-0.14, -0.06, "bleuet"), (0.18, -0.05, "coquelicot"))):
            a.fleur((x, y, 0), esp, graine=80 + k)
        a.touffe((0, 0, 0), graine=90, brins=10)

    with a.piece("touffe"):
        a.touffe((0, 0, 0), graine=91, brins=12, hauteur=0.32)
