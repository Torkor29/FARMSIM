"""
La source chaude — un bassin irrégulier au milieu d'un dallage de pierres
plates, cerclé de rochers moussus, traversé de pierres de gué ; des nénuphars
fleuris, de la vapeur, un bec de bambou qui verse, deux lanternes de pierre,
un bain d'oiseaux, un nichoir et une pancarte. Pièce `source-chaude`.

C'est le repère « Hot spring » des références : ce qui le rend lisible n'est
pas le bassin, c'est la densité de petites choses autour.
"""

import math
import random

from mathutils import Matrix

from forge.formes import contour_organique, rot
from recettes.jardin import bain_oiseaux, lanterne_pierre, nichoir

ASSET = {
    "titre": "Source chaude",
    "echelle": 1.0,
    "budget_triangles": 28000,
    "budget_appels": 24,
    "etiquettes": ["repere", "source-chaude"],
    "dependances": ["jardin"],
}


EAU = 0.035  # la surface de l'eau


def construire(a):
    rnd = random.Random(7)
    with a.piece("source-chaude"):
        bassin = contour_organique(1.25, graine=12, points=30, ampleur=0.16, lobes=3, aplatir=(1.25, 0.95))
        place = contour_organique(2.6, graine=13, points=36, ampleur=0.12, lobes=5, aplatir=(1.15, 1.0))

        # Le dallage de pierres plates, qui laisse la place du bassin.
        a.dalles("pierre", 2.9, nb=72, jeu=0.045, epais=0.07, graine=21, contour=place, hauteur=0.0,
                 mat2="pierre-sombre", trou=[(x * 0.97, y * 0.97) for x, y in bassin])

        # Le bassin : une eau turquoise opaque, laiteuse comme celle d'une
        # source chaude, affleurant sous le dallage (au-dessus du sol du jeu,
        # sinon l'herbe transparaîtrait).
        a.matiere("eau-source", 0x8fdcdc, rugosite=0.12)
        a.prisme("eau-source", bassin, -0.1, EAU, biseau=0.0)

        # Les rochers ronds du bord, moussus par endroits.
        for k, (x, y) in enumerate(bassin[::2]):
            if k in (3, 11):
                continue  # deux trouées : l'eau touche les dalles
            ang = math.atan2(y, x)
            t = (0.2 + rnd.uniform(-0.04, 0.06), 0.17 + rnd.uniform(-0.03, 0.04), 0.13 + rnd.uniform(0, 0.06))
            a.rocher((x * 1.04, y * 1.04, -0.08), t, graine=30 + k, rot_z=ang,
                     mat="pierre" if k % 3 else "pierre-sombre")
            if k % 4 == 1:
                a.boule("mousse", (x * 1.04, y * 1.04, t[2] * 0.95), (t[0] * 0.6, t[1] * 0.6, 0.04),
                        finesse=2, bosses=0.2, graine=k)

        # Les pierres de gué, en travers du bassin.
        for k in range(5):
            u = k / 4
            x, y = -1.05 + 2.1 * u, math.sin(u * math.pi * 1.1) * 0.28 - 0.12
            c = contour_organique(0.17 + 0.03 * (k % 2), graine=40 + k, points=12, ampleur=0.14, lobes=3)
            a.prisme("pierre", [(x + px, y + py) for px, py in c], 0.0, EAU + 0.05, biseau=0.03, lisse=True)

        # Des nénuphars, trois en fleur.
        for k, (x, y) in enumerate(((0.55, 0.35), (-0.45, 0.42), (0.2, -0.55), (-0.75, -0.3), (0.9, -0.1),
                                    (-0.1, 0.55))):
            r = 0.12 + 0.03 * (k % 3)
            feuille = [(math.cos(2 * math.pi * i / 14) * r, math.sin(2 * math.pi * i / 14) * r)
                       for i in range(14) if i not in (0,)]
            with a.repere((x, y, EAU + 0.004), rot_z=k * 1.7):
                a.prisme("feuillage-clair", feuille + [(0.0, 0.0)], 0.0, 0.015, biseau=0.0)
            if k % 2 == 0:
                fleur_nenuphar(a, (x + 0.03, y, EAU + 0.02), k)

        # La vapeur : quelques bouffées translucides au-dessus de l'eau.
        a.matiere("vapeur", opacite=0.16)
        for k, (x, y) in enumerate(((0.3, 0.05), (-0.4, 0.2))):
            boules = [((x + 0.06 * j, y - 0.04 * j, 0.3 + j * 0.22), (0.14 - j * 0.03, 0.12 - j * 0.03, 0.08))
                      for j in range(3)]
            a.fondre("vapeur", boules, voxel=0.04, lissage=4, triangles=140, graine=k)

        # Le bec de bambou qui verse dans le bassin, sur son rocher.
        bx, by = bassin[16][0] * 1.12, bassin[16][1] * 1.12
        a.rocher((bx, by, 0), (0.38, 0.32, 0.36), graine=60, mat="pierre-sombre")
        haut = (bx * 0.86, by * 0.86, 0.62)
        a.baton("bambou", (bx, by, 0.2), (bx, by, 0.68), 0.045, cotes=8)
        a.baton("bambou", (bx, by, 0.6), haut, 0.03, cotes=8)
        for z in (0.35, 0.52):
            a.tore("bois-clair", (bx, by, z), 0.047, 0.008, cotes=10, section=3)
        a.tube("eau", [haut, (haut[0] * 0.95, haut[1] * 0.95, 0.4), (haut[0] * 0.93, haut[1] * 0.93, 0.02)],
               [0.015, 0.012, 0.02], cotes=5)

        # Deux lanternes de pierre, un bain d'oiseaux, un nichoir, une pancarte.
        for (x, y, rz) in ((-2.35, -0.55, 0.3), (1.95, 1.1, -0.4)):
            with a.repere((x, y, 0.06), rot_z=rz):
                lanterne_pierre(a)
        with a.repere((1.3, -1.45, 0.06), rot_z=0.8):
            bain_oiseaux(a)
        with a.repere((2.55, -0.3, 0), rot_z=-0.3, echelle=0.9):
            nichoir(a)
        with a.repere((-1.7, 1.55, 0), rot_z=0.4):
            pancarte(a)

        # Le jardin autour : lavande, un rosier, des touffes, des fleurs.
        for k, (x, y) in enumerate(((-2.7, 0.6), (-2.2, 1.3), (2.6, 0.6), (0.4, 2.05), (-0.6, -2.15),
                                    (-2.95, -1.2))):
            a.lavande((x, y, 0), graine=70 + k, tiges=22)
        a.buisson((1.05, 1.95, 0), taille=0.75, graine=80, fleurs="rose", nb_fleurs=12)
        a.buisson((-1.3, -1.85, 0), taille=0.6, graine=81, mat="feuillage")
        for k in range(16):
            ang = rnd.uniform(0, 2 * math.pi)
            r = rnd.uniform(2.55, 3.0)
            x, y = math.cos(ang) * r * 1.1, math.sin(ang) * r
            if rnd.random() < 0.45:
                a.fleur((x, y, 0), rnd.choice(("coquelicot", "marguerite", "coquelicot")), graine=90 + k)
            else:
                a.touffe((x, y, 0), graine=120 + k, brins=7)


def fleur_nenuphar(a, pos, graine):
    """Une fleur de nénuphar : deux couronnes de pétales roses, un cœur jaune."""
    x, y, z = pos
    rnd = random.Random(graine)
    for couronne, (n, long, lev) in enumerate(((7, 0.07, 0.5), (5, 0.05, 1.2))):
        for i in range(n):
            ang = 2 * math.pi * i / n + couronne * 0.4 + rnd.uniform(-0.1, 0.1)
            d = (math.cos(ang), math.sin(ang), lev)
            a.lame("rose" if couronne == 0 else "marguerite", (x, y, z), d, (-math.sin(ang), math.cos(ang), 0),
                   long, long * 0.6, courbe=-0.01, pas=2)
    a.boule("coeur-fleur", (x, y, z + 0.02), 0.018, finesse=1)


def pancarte(a):
    """Une pancarte de bois sous un petit toit, sur deux piquets."""
    for x in (-0.25, 0.25):
        a.boite("bois-sombre", (0.06, 0.06, 1.0), (x, 0, 0.5), biseau=0.012)
    a.boite("bois-clair", (0.62, 0.05, 0.34), (0, -0.04, 0.78), biseau=0.02)
    for k in range(3):
        a.boite("bois-sombre", (0.36 - k * 0.08, 0.01, 0.025), (0, -0.07, 0.86 - k * 0.07), biseau=0.0)
    a.toit("tuile", 0.72, 0.26, 30, epais=0.03, centre=(0, 0, 1.08))
    a.boite("bois-sombre", (0.72, 0.05, 0.05), (0, 0, 1.03), biseau=0.01)
