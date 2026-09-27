"""
L'épouvantail — un sac de jute cousu, un chapeau de paille, une chemise à
carreaux, de la paille qui dépasse de partout. Pièce `epouvantail`.
"""

import math

from mathutils import Matrix

from forge.formes import rot, vers

ASSET = {
    "titre": "Épouvantail",
    "echelle": 1.0,
    "budget_triangles": 5000,
    "budget_appels": 10,
    "etiquettes": ["repere", "fete-des-recoltes"],
}


def construire(a):
    rnd = a.alea
    with a.piece("epouvantail"):
        # Le piquet et la traverse des bras.
        a.boite("bois", (0.09, 0.09, 1.95), (0, 0.02, 0.975), biseau=0.02)
        a.boite("bois", (1.45, 0.08, 0.08), (0, 0.06, 1.42), biseau=0.02)
        # La motte au pied.
        for k in range(3):
            a.touffe((0.08 * math.cos(k * 2.1), 0.08 * math.sin(k * 2.1), 0), graine=k, brins=6)

        # La chemise : un tronc évasé, et deux manches le long de la traverse.
        a.tour("peinture-bleue", [(0.2, 0.82), (0.26, 0.9), (0.24, 1.2), (0.22, 1.42), (0.12, 1.5)],
               centre=(0, 0, 0), cotes=10, aplatir=(1.0, 0.72), lisse=True)
        for s in (-1, 1):
            a.baton("peinture-bleue", (s * 0.16, 0.02, 1.4), (s * 0.62, 0.05, 1.4), 0.1, cotes=8,
                    rayon_b=0.085)
            # Des carreaux : deux bandes rouges sur chaque manche.
            for t in (0.35, 0.6):
                x = s * (0.16 + (0.62 - 0.16) * t)
                a.tore("peinture-rouge", (0, 0, 0), 0.097, 0.012, cotes=12, section=4,
                       m=_axe_x((x, 0.03, 1.4)))
            # La paille qui sort des manches.
            for k in range(7):
                ang = 2 * math.pi * k / 7
                d = (s, math.cos(ang) * 0.5, math.sin(ang) * 0.5 - 0.3)
                a.lame("paille", (s * 0.62, 0.05, 1.4), d, (0, math.sin(ang), -math.cos(ang)),
                       rnd.uniform(0.14, 0.22), 0.04, courbe=0.02, profil=lambda t: 1 - t, pas=2)
        # Une pièce rapiécée sur la poitrine, et deux boutons.
        a.boite("peinture-rouge", (0.14, 0.03, 0.14), (0.07, -0.185, 1.12), rot_z=0.0, biseau=0.01,
                m=rot(y=0.2))
        for z in (1.02, 1.28):
            a.boule("bois-sombre", (-0.04, -0.18, z), 0.022, finesse=1)
        # La paille qui sort du bas de la chemise.
        for k in range(12):
            ang = 2 * math.pi * k / 12
            base = (math.cos(ang) * 0.2, math.sin(ang) * 0.14, 0.84)
            a.lame("paille", base, (math.cos(ang) * 0.4, math.sin(ang) * 0.4, -1), (-math.sin(ang), math.cos(ang), 0),
                   rnd.uniform(0.15, 0.25), 0.045, courbe=0.01, profil=lambda t: 1 - t, pas=2)

        # La tête : un sac de jute noué, un visage cousu.
        a.boule("toile-jute", (0, 0.0, 1.72), (0.19, 0.17, 0.21), finesse=3, bosses=0.12, graine=5)
        a.tore("paille-sombre", (0, 0, 1.53), 0.09, 0.025, cotes=12, section=4)
        for s in (-1, 1):
            a.boule("ombre", (s * 0.065, -0.155, 1.76), (0.03, 0.015, 0.03), finesse=1)
        # La bouche cousue : des points.
        for k in range(5):
            x = -0.07 + 0.035 * k
            a.boite("ombre", (0.012, 0.012, 0.04), (x, -0.16 + abs(x) * 0.3, 1.64 + (x * x) * 3),
                    biseau=0.0)
        # Le chapeau de paille, cabossé, avec un ruban rouge.
        with a.repere((0, 0, 1.84), rot_z=0.3):
            a.tour("paille", [(0.36, 0.0), (0.38, 0.02), (0.3, 0.05), (0.17, 0.05), (0.16, 0.2),
                              (0.12, 0.26), (0.0, 0.25)], cotes=18, lisse=True,
                   m=rot(x=0.12, y=-0.1))
            a.tour("peinture-rouge", [(0.165, 0.05), (0.162, 0.1)], cotes=18, fermer=False, lisse=True,
                   m=rot(x=0.12, y=-0.1))
        # Un corbeau perché au bout du bras.
        corbeau(a, (0.52, 0.06, 1.47))


def _axe_x(centre):
    """Un anneau couché autour de l'axe X, centré en `centre`."""
    return Matrix.Translation(centre) @ rot(y=math.pi / 2)


def corbeau(a, pos):
    x, y, z = pos
    a.boule("ombre", (x, y, z + 0.12), (0.07, 0.11, 0.07), finesse=2)
    a.boule("ombre", (x, y - 0.1, z + 0.19), 0.05, finesse=2)
    a.tour("tournesol", [(0.015, 0.0), (0.0, 0.05)], centre=(0, 0, 0), cotes=5,
           m=vers((x, y - 0.14, z + 0.19), (x, y - 0.2, z + 0.18)))
    a.lame("ombre", (x, y + 0.08, z + 0.13), (0, 1, -0.3), (1, 0, 0), 0.12, 0.08, pas=2)
