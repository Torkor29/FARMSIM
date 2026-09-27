"""
Le kit de la fête : ce qu'on sème autour des étals et sur le port la nuit.

Citrouilles, botte de foin, tonneau, caisse, lanterne sur poteau (qui brille
la nuit : matière `lumiere`, émissive), guirlande de fanions, bateau de papier
à bougie. Pièces à poser ou à instancier.
"""

import math

from forge.formes import rot

ASSET = {
    "titre": "Kit de la fête",
    "echelle": 1.0,
    "budget_triangles": 3500,
    "budget_appels": 8,
    "etiquettes": ["fete-des-recoltes", "port-au-clair-de-lune", "instanciable"],
}


def construire(a):
    with a.piece("citrouille"):
        a.citrouille("citrouille", (0, 0, 0), 0.32, graine=1)
    with a.piece("citrouilles"):
        a.citrouille("citrouille", (0, 0, 0), 0.34, graine=2)
        a.citrouille("citrouille", (0.6, -0.12, 0), 0.22, graine=3)
        a.citrouille("peinture-blanche", (-0.45, -0.35, 0), 0.18, graine=4)
        a.touffe((0.2, 0.25, 0), graine=5, brins=6)

    with a.piece("botte-de-foin"):
        a.boite("paille", (1.0, 0.56, 0.52), (0, 0, 0.26), biseau=0.12, segments=3)
        for x in (-0.25, 0.25):
            a.boite("paille-sombre", (0.035, 0.6, 0.56), (x, 0, 0.26), biseau=0.015)
        # Des brins qui s'échappent.
        rnd = a.alea
        for k in range(10):
            x = rnd.uniform(-0.45, 0.45)
            a.lame("paille", (x, -0.28, rnd.uniform(0.1, 0.45)), (rnd.uniform(-0.5, 0.5), -1, rnd.uniform(-0.6, 0.2)),
                   (1, 0, 0), 0.12, 0.03, profil=lambda t: 1 - t, pas=2)

    with a.piece("tonneau"):
        prof = [(0.26, 0.0), (0.31, 0.2), (0.33, 0.4), (0.31, 0.6), (0.26, 0.8)]
        a.tour("bois", prof, cotes=16, lisse=True)
        for z in (0.12, 0.68):
            r = 0.26 + 0.07 * math.sin(math.pi * z / 0.8)
            a.tore("fer", (0, 0, z), r + 0.002, 0.011, cotes=18, section=4, aplatir=1.6)
        a.cylindre("bois-sombre", 0.245, 0.74, 0.79, cotes=16, biseau=0.01)

    with a.piece("caisse"):
        a.boite("bois-clair", (0.6, 0.45, 0.36), (0, 0, 0.18), biseau=0.02)
        for s in (-1, 1):
            a.boite("bois", (0.63, 0.03, 0.08), (0, s * 0.235, 0.3), biseau=0.01)
            a.boite("bois", (0.63, 0.03, 0.08), (0, s * 0.235, 0.07), biseau=0.01)
        for i in range(3):
            for j in range(2):
                a.boule("peinture-rouge", (-0.18 + i * 0.18, -0.1 + j * 0.2, 0.36), 0.068, finesse=2)

    with a.piece("lanterne"):
        a.boite("bois-sombre", (0.1, 0.1, 2.0), (0, 0, 1.0), biseau=0.02)
        a.boite("bois-sombre", (0.5, 0.08, 0.08), (0.21, 0, 1.92), biseau=0.02)
        a.baton("fer", (0.42, 0, 1.92), (0.42, 0, 1.8), 0.01, cotes=4)
        lanterne(a, (0.42, 0, 1.52))
        a.touffe((0.06, -0.05, 0), graine=7, brins=8)

    with a.piece("guirlande"):
        # Deux poteaux et une guirlande de fanions entre eux, face à la caméra.
        for x in (-2.0, 2.0):
            a.boite("bois", (0.1, 0.1, 2.4), (x, 0, 1.2), biseau=0.02)
            a.boule("bois-sombre", (x, 0, 2.44), 0.07, finesse=2)
        a.fanions(["toile-rouge", "toile-creme", "toile-orange", "toile-verte"], (-1.95, 0, 2.3), (1.95, 0, 2.3),
                  0.45, nb=11, taille=0.32)

    with a.piece("guirlande-lumineuse"):
        for x in (-2.0, 2.0):
            a.boite("bois-sombre", (0.1, 0.1, 2.4), (x, 0, 1.2), biseau=0.02)
        points = a.corde("fer", (-1.95, 0, 2.3), (1.95, 0, 2.3), 0.4, rayon=0.008, pas=12, cotes=4)
        for p in points[2:-2:2]:
            a.boule("lumiere", (p[0], p[1], p[2] - 0.08), 0.07, finesse=2)
            a.baton("fer", (p[0], p[1], p[2]), (p[0], p[1], p[2] - 0.03), 0.012, cotes=4)

    with a.piece("bateau-bougie"):
        bateau_papier(a)


def lanterne(a, centre):
    x, y, z = centre
    a.tour("fer", [(0.0, 0.3), (0.14, 0.22), (0.12, 0.2)], centre=(x, y, z), cotes=4, lisse=False,
           m=None)
    for dx, dy in ((-1, -1), (1, -1), (1, 1), (-1, 1)):
        a.baton("fer", (x + dx * 0.085, y + dy * 0.085, z), (x + dx * 0.085, y + dy * 0.085, z + 0.2), 0.012, cotes=4)
    a.boite("lumiere", (0.14, 0.14, 0.18), (x, y, z + 0.1), rot_z=0.0, biseau=0.02)
    a.boite("fer", (0.2, 0.2, 0.03), (x, y, z - 0.005), biseau=0.01)


def bateau_papier(a):
    """Le bateau de papier plié qui porte une bougie (le port la nuit)."""
    import bmesh

    bm = bmesh.new()
    # Une coque en V, deux voiles pliées.
    L, l, h = 0.3, 0.12, 0.08
    v = [bm.verts.new(p) for p in ((-L, 0, h), (L, 0, h), (-L * 0.6, -l, h * 0.9), (L * 0.6, -l, h * 0.9),
                                     (-L * 0.6, l, h * 0.9), (L * 0.6, l, h * 0.9), (-L * 0.45, 0, 0.0),
                                     (L * 0.45, 0, 0.0))]
    for f in ((v[0], v[2], v[6]), (v[2], v[3], v[7], v[6]), (v[3], v[1], v[7]),
              (v[0], v[6], v[4]), (v[6], v[7], v[5], v[4]), (v[7], v[1], v[5])):
        bm.faces.new(f)
    a.verser(bm, "marguerite")
    bm = bmesh.new()
    s = [bm.verts.new(p) for p in ((-L * 0.5, 0, h), (L * 0.5, 0, h), (0, 0, 0.28), (-L * 0.2, -0.06, h),
                                     (L * 0.2, 0.06, h))]
    bm.faces.new((s[0], s[3], s[2]))
    bm.faces.new((s[3], s[1], s[2]))
    bm.faces.new((s[0], s[2], s[4]))
    bm.faces.new((s[4], s[2], s[1]))
    a.verser(bm, "marguerite")
    a.cylindre("peinture-blanche", 0.03, 0.08, 0.2, centre=(0.14, -0.03), cotes=8, biseau=0.005)
    a.boule("lumiere", (0.14, -0.03, 0.24), (0.025, 0.025, 0.04), finesse=1)
