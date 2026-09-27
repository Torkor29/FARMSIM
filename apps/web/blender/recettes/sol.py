"""
Le kit du sol : les pièces qui façonnent le terrain autour des repères.

- `terrasses` : une butte en trois gradins, flancs de terre et dessus
  d'herbe qui déborde (les champs en terrasses des références) ;
- `ilot` : un îlot de sable et d'herbe qui dépasse de l'eau (le sanctuaire) ;
- `dallage` et `dallage-petit` : des pierres plates irrégulières ;
- `pas-japonais` : des pierres de gué, à poser dans l'eau ou l'herbe ;
- `mare` : une petite mare cerclée de pierres, nénuphars et roseaux.
"""

import math

from forge.formes import contour_organique

ASSET = {
    "titre": "Kit du sol",
    "echelle": 1.0,
    "budget_triangles": 13000,
    "budget_appels": 8,
    "etiquettes": ["terrain", "instanciable"],
}


def construire(a):
    with a.piece("terrasses"):
        for k, (r, h) in enumerate(((3.0, 0.45), (2.2, 0.9), (1.4, 1.35))):
            c = contour_organique(r, graine=10 + k, points=32, ampleur=0.1, lobes=4)
            c = [(x + k * 0.35, y + k * 0.25) for x, y in c]
            a.plateau("herbe", "terre", c, h - 0.45 - 0.2 if k else -0.05, h, rebord=0.12)
        for k in range(8):
            ang = 2 * math.pi * k / 8 + 0.2
            a.touffe((math.cos(ang) * 2.7, math.sin(ang) * 2.7, 0.45), graine=k, brins=7)
        # Quelques pierres au pied des talus, et de la lavande sur le premier gradin.
        for k, ang in enumerate((1.9, 2.6, 3.4, 4.3, 5.0)):
            a.rocher((math.cos(ang) * 3.15, math.sin(ang) * 3.15, 0), (0.22, 0.18, 0.15), graine=70 + k,
                     rot_z=ang, mousse=k % 2 == 0)
        for k, ang in enumerate((0.6, 1.2, 5.6)):
            a.lavande((math.cos(ang) * 2.5, math.sin(ang) * 2.5, 0.45), graine=80 + k, tiges=18, hauteur=0.5)

    with a.piece("ilot"):
        c = contour_organique(1.3, graine=3, points=26, ampleur=0.12, lobes=3)
        a.plateau("sable", "sable", [(x * 1.18, y * 1.18) for x, y in c], -0.4, 0.08, rebord=0.06)
        a.plateau("herbe", "terre", [(x * 0.92, y * 0.92) for x, y in c], -0.1, 0.24, rebord=0.08)
        a.rocher((0.35, 0.2, 0.2), (0.5, 0.4, 0.35), graine=4)
        a.rocher((-0.4, 0.35, 0.2), (0.3, 0.26, 0.2), graine=5, mat="pierre-sombre")
        a.touffe((-0.2, -0.4, 0.22), graine=6, brins=8)

    with a.piece("dallage"):
        a.dalles("pierre", 1.6, nb=18, epais=0.08, graine=7, hauteur=0.0, mat2="pierre-sombre")
    with a.piece("dallage-petit"):
        a.dalles("pierre", 0.9, nb=7, epais=0.08, graine=8, hauteur=0.0)

    with a.piece("pas-japonais"):
        for k in range(5):
            t = k / 4
            x, y = -1.6 + 3.2 * t, math.sin(t * math.pi * 1.2) * 0.4
            c = contour_organique(0.26 + 0.04 * (k % 2), graine=20 + k, points=14, ampleur=0.12, lobes=3)
            a.prisme("pierre", [(x + px, y + py) for px, py in c], -0.02, 0.07, biseau=0.035, segments=2,
                     lisse=True)

    with a.piece("mare"):
        c = contour_organique(1.3, graine=31, points=30, ampleur=0.12, lobes=4, aplatir=(1.2, 0.9))
        a.prisme("eau", [(x * 0.98, y * 0.98) for x, y in c], -0.1, 0.02, biseau=0.0)
        for k, (x, y) in enumerate(c[::2]):
            ang = math.atan2(y, x)
            a.rocher((x * 1.02, y * 1.02, -0.05), (0.22, 0.18, 0.15), graine=40 + k, rot_z=ang,
                     mat="pierre" if k % 3 else "pierre-sombre")
        for k, (x, y) in enumerate(((0.3, 0.1), (-0.4, -0.2), (0.1, -0.35))):
            a.cylindre("feuillage-clair", 0.14, 0.02, 0.035, centre=(x, y), cotes=10, biseau=0.005)
            if k == 0:
                a.boule("rose", (x + 0.03, y, 0.06), 0.05, finesse=1)
        a.roseaux((-1.05, 0.55, 0), graine=50, tiges=5, hauteur=0.9)
        a.roseaux((1.2, -0.3, 0), graine=51, tiges=4, hauteur=0.8)
