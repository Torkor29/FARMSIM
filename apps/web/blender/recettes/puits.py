"""
Le puits à souhaits — margelle de pierres, petit toit de tuiles, treuil et seau.

Pièce `puits` ; la manivelle et son treuil forment le nœud `puits:treuil`
(pivot sur l'axe du treuil, parallèle à X) si le jeu veut faire remonter le
seau.
"""

import math

from mathutils import Matrix

from forge.formes import rot

ASSET = {
    "titre": "Puits à souhaits",
    "echelle": 1.0,
    "budget_triangles": 7000,
    "budget_appels": 16,
    "etiquettes": ["repere", "port-au-clair-de-lune"],
}

R = 0.72


def construire(a):
    rnd = a.alea
    with a.piece("puits"):
        # La margelle : trois rangs de pierres taillées, en quinconce.
        a.cylindre("pierre-sombre", R + 0.08, 0, 0.1, cotes=20, biseau=0.03)
        rangs = ((0.1, 0.24), (0.33, 0.22), (0.54, 0.2))
        for i, (z, h) in enumerate(rangs):
            n = 11
            for k in range(n):
                ang = 2 * math.pi * (k + 0.5 * (i % 2)) / n
                larg = 2 * math.pi * R / n - 0.035
                a.boite("pierre" if rnd.random() > 0.25 else "pierre-sombre",
                        (larg, 0.26, h - 0.02),
                        (math.cos(ang) * R, math.sin(ang) * R, z + h / 2),
                        rot_z=ang + math.pi / 2, biseau=0.045)
        # Le couronnement, plus large, et l'eau sombre au fond.
        a.tore("pierre", (0, 0, 0.8), R, 0.1, cotes=24, section=6, aplatir=0.7)
        a.cylindre("eau", R - 0.14, 0.2, 0.46, cotes=20, biseau=0.0)

        # Les deux montants et la traverse du toit.
        for s in (-1, 1):
            a.boite("bois", (0.14, 0.14, 1.75), (s * (R + 0.02), 0, 0.8 + 0.8), biseau=0.03)
            a.boite("bois-sombre", (0.12, 0.3, 0.1), (s * (R + 0.02), 0, 2.3), biseau=0.03)
        a.boite("bois-sombre", (2 * R + 0.34, 0.12, 0.12), (0, 0, 2.38), biseau=0.03)

        # Le toit : deux pans de tuiles au-dessus de la traverse.
        a.toit("tuile", 2 * R + 0.55, 1.35, 42, epais=0.07, centre=(0, 0, 2.66), courbe=0.03)
        a.boite("tuile", (2 * R + 0.62, 0.14, 0.1), (0, 0, 2.68), biseau=0.04)
        for s in (-1, 1):
            a.pignon("bois-sombre", 1.1, 0.0, 0.42, 0.05, centre=(s * (R + 0.02), 0, 2.36), rot_z=math.pi / 2)

        # Le treuil, sa corde, le seau.
        with a.noeud("treuil", origine=(0, 0, 1.58)):
            a.baton("bois-clair", (-R - 0.05, 0, 1.58), (R + 0.05, 0, 1.58), 0.07, cotes=10)
            # La corde enroulée : quelques spires autour du treuil.
            for dx in (-0.12, -0.04, 0.04, 0.12):
                a.tore("paille-sombre", (0, 0, 0), 0.085, 0.03, cotes=12, section=4,
                       m=_axe_x((dx, 0, 1.58)))
            # La manivelle, côté droit.
            a.baton("fer", (R + 0.05, 0, 1.58), (R + 0.2, 0, 1.58), 0.03)
            a.baton("fer", (R + 0.2, 0, 1.58), (R + 0.2, 0, 1.3), 0.03)
            a.baton("bois-sombre", (R + 0.2, 0, 1.3), (R + 0.36, 0, 1.3), 0.04)
        a.baton("paille-sombre", (0, 0, 1.5), (0, 0, 1.12), 0.015, cotes=4)
        seau(a, (0.0, 0.0, 0.88))

        # Une pancarte de bois à côté, et un petit tapis d'herbe.
        a.baton("bois", (R + 0.45, -0.35, 0), (R + 0.45, -0.35, 0.8), 0.04)
        a.boite("bois-clair", (0.46, 0.05, 0.28), (R + 0.45, -0.4, 0.72), rot_z=-0.3, biseau=0.02)
        for k in range(6):
            ang = rnd.uniform(0, 2 * math.pi)
            a.touffe((math.cos(ang) * (R + 0.18), math.sin(ang) * (R + 0.18), 0), graine=k, brins=7)


def _axe_x(centre):
    """Un anneau couché dans le plan YZ (autour de l'axe X), centré en `centre`."""
    return Matrix.Translation(centre) @ rot(y=math.pi / 2)


def seau(a, bas):
    x, y, z = bas
    a.tour("bois", [(0.13, z), (0.16, z + 0.24)], centre=(x, y, 0), cotes=12, lisse=False)
    a.cylindre("ombre", 0.145, z + 0.18, z + 0.235, centre=(x, y), cotes=12, biseau=0.0)
    for zz in (z + 0.05, z + 0.19):
        a.tore("fer", (x, y, zz), 0.135 + (zz - z) * 0.12, 0.012, cotes=14, section=4)
    a.tube("fer", [(x - 0.15, y, z + 0.24), (x - 0.1, y, z + 0.36), (x, y, z + 0.4),
                   (x + 0.1, y, z + 0.36), (x + 0.15, y, z + 0.24)], 0.01, cotes=4)
