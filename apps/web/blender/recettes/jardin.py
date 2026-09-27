"""
Le kit du jardin : les petits objets qui font un lieu habité.

Dans les références, ce ne sont pas les repères qui font la richesse, ce
sont les dizaines de petites choses autour : un bain d'oiseaux, une lanterne
de pierre, une ruche en paille sur son tabouret, un nichoir, des pots de
fleurs, un banc, des sacs, des lampions. Chacun est une pièce à semer.
"""

import math

from mathutils import Matrix

from forge.formes import rot

ASSET = {
    "titre": "Kit du jardin",
    "echelle": 1.0,
    "budget_triangles": 3000,
    "budget_appels": 10,
    "etiquettes": ["jardin", "decor", "instanciable"],
}


def construire(a):
    with a.piece("bain-oiseaux"):
        bain_oiseaux(a)
    with a.piece("lanterne-pierre"):
        lanterne_pierre(a)
    with a.piece("ruche-paille"):
        ruche_paille(a)
    with a.piece("nichoir"):
        nichoir(a)
    with a.piece("banc"):
        banc(a)
    with a.piece("pots-fleurs"):
        pots_fleurs(a)
    with a.piece("lampion"):
        lampion(a)
    with a.piece("sacs"):
        for k, (x, y, rz) in enumerate(((0, 0, 0.2), (0.44, 0.05, -0.3), (0.2, 0.44, 0.9))):
            sac(a, (x, y, 0), rz, k)


def bain_oiseaux(a):
    """Un bain d'oiseaux : pied tourné, vasque, eau, un rouge-gorge sur le bord."""
    with a.objet("objet", 0.3, haut=0.75):
        # Un pied tourné, une vasque, de l'eau, un oiseau posé sur le bord.
        a.tour("pierre", [(0.2, 0.0), (0.2, 0.06), (0.1, 0.1), (0.07, 0.3), (0.08, 0.5), (0.12, 0.56),
                          (0.26, 0.64), (0.29, 0.72), (0.26, 0.74), (0.0, 0.68)], cotes=16, lisse=True)
        a.cylindre("eau", 0.23, 0.66, 0.715, cotes=16, biseau=0.0)
        a.boule("mousse", (0.09, -0.07, 0.1), (0.06, 0.05, 0.03), finesse=2, bosses=0.3)
        oiseau(a, (0.22, 0.1, 0.73), 2.2)


def lanterne_pierre(a):
    """Une lanterne de pierre (tōrō) : socle, fût, chambre à lumière, toit relevé."""
    with a.objet("objet", 0.3, haut=1.2):
        # Une tōrō : socle, fût, chambre à lumière ajourée, toit relevé, bouton.
        a.cylindre("pierre-sombre", 0.26, 0.0, 0.1, cotes=6, biseau=0.02)
        a.cylindre("pierre", 0.09, 0.1, 0.62, cotes=8, biseau=0.015)
        a.cylindre("pierre", 0.2, 0.62, 0.7, cotes=6, biseau=0.02)
        a.boite("lumiere", (0.2, 0.2, 0.2), (0, 0, 0.82), biseau=0.02)
        for k in range(4):
            ang = k * math.pi / 2 + math.pi / 4
            a.boite("pierre", (0.06, 0.06, 0.24), (math.cos(ang) * 0.13, math.sin(ang) * 0.13, 0.82), biseau=0.01)
        a.tour("pierre-sombre", [(0.34, 0.93), (0.36, 0.96), (0.3, 0.98), (0.12, 1.1), (0.0, 1.13)], cotes=6,
               lisse=False)
        a.boule("pierre-sombre", (0, 0, 1.17), 0.06, finesse=1)
        a.boule("mousse", (0.1, -0.12, 0.99), (0.1, 0.06, 0.03), finesse=2, bosses=0.2)


def ruche_paille(a):
    """Une ruche en paille tressée (un « skep ») sur son tabouret."""
    with a.objet("objet", 0.36, haut=1.1):
        # Une ruche en paille tressée (un « skep ») sur son tabouret.
        for x, y in ((-0.2, -0.2), (0.2, -0.2), (0.2, 0.2), (-0.2, 0.2)):
            a.baton("bois-sombre", (x * 1.2, y * 1.2, 0), (x, y, 0.5), 0.03, cotes=6)
        a.cylindre("bois", 0.34, 0.5, 0.56, cotes=14, biseau=0.015)
        prof = [(0.3, 0.56), (0.31, 0.7), (0.27, 0.86), (0.19, 0.98), (0.08, 1.06), (0.0, 1.08)]
        a.tour("paille", prof, cotes=18, lisse=True)
        # Les boudins de paille tressée : des anneaux bien en saillie, qui
        # suivent la cloche jusqu'au sommet.
        for k in range(8):
            z = 0.6 + k * 0.058
            r = max(0.06, _rayon_cloche(prof, z) + 0.004)
            a.tore("paille-sombre", (0, 0, z), r, 0.026, cotes=22, section=5, aplatir=0.8)
        a.boite("ombre", (0.09, 0.04, 0.05), (0, -0.305, 0.6), biseau=0.01)
        for k in range(3):
            a.boule("coeur-fleur", (0.05 * k - 0.05, -0.36 - 0.03 * k, 0.72 + 0.05 * k), 0.018, finesse=1)


def nichoir(a):
    """Un nichoir bleu sur son poteau."""
    with a.objet("objet", 0.2, haut=1.9):
        a.boite("bois", (0.08, 0.08, 1.5), (0, 0, 0.75), biseau=0.015)
        with a.repere((0, 0, 1.5)):
            a.boite("peinture-bleue", (0.26, 0.24, 0.28), (0, 0, 0.14), biseau=0.02)
            a.toit("tuile", 0.36, 0.34, 35, epais=0.035, centre=(0, 0, 0.4), rot_z=math.pi / 2)
            a.cylindre("ombre", 0.045, 0.0, 0.03, centre=(0, 0), cotes=10, biseau=0.0,
                       m=Matrix.Translation((0, -0.12, 0.17)) @ rot(x=math.pi / 2))
            a.baton("bois-sombre", (0, -0.12, 0.08), (0, -0.2, 0.08), 0.012, cotes=5)


def banc(a):
    """Un banc de bois à dossier."""
    with a.objet("objet", 0.68, haut=0.9):
        for x in (-0.5, 0.5):
            a.boite("bois-sombre", (0.07, 0.36, 0.4), (x, 0, 0.2), biseau=0.015)
        for k in range(3):
            a.boite("bois", (1.25, 0.1, 0.045), (0, -0.11 + k * 0.11, 0.42), biseau=0.012)
        for k in range(2):
            a.boite("bois", (1.25, 0.04, 0.09), (0, 0.17, 0.6 + k * 0.13), biseau=0.012)
        for x in (-0.5, 0.5):
            a.boite("bois-sombre", (0.06, 0.05, 0.4), (x, 0.17, 0.62), biseau=0.012)


def pots_fleurs(a):
    """Trois pots de terre cuite fleuris."""
    with a.objet("objet", 0.45, haut=0.6):
        for k, (x, y, r, fleur) in enumerate(((0, 0, 0.16, "coquelicot"), (0.3, 0.08, 0.12, "lavande"),
                                              (0.12, -0.26, 0.1, "marguerite"))):
            a.tour("pot", [(r * 0.7, 0.0), (r, r * 1.4), (r * 1.12, r * 1.4), (r * 1.12, r * 1.6),
                           (r * 0.92, r * 1.6)], centre=(x, y, 0), cotes=12, lisse=False)
            a.cylindre("terre", r * 0.92, r * 1.2, r * 1.52, centre=(x, y), cotes=12, biseau=0.0)
            if fleur == "lavande":
                a.lavande((x, y, r * 1.5), graine=k, tiges=14, hauteur=0.35)
            else:
                a.boule("feuillage", (x, y, r * 1.75), (r * 0.95, r * 0.95, r * 0.6), finesse=2, bosses=0.25,
                        graine=k)
                for j in range(5):
                    ang = j * 1.3 + k
                    a.fleur((x + math.cos(ang) * r * 0.5, y + math.sin(ang) * r * 0.5, r * 1.6), fleur,
                            graine=j + k * 7, hauteur=0.16)


def lampion(a):
    """Un lampion de papier plissé, suspendu : le jeu le pend où il veut."""
    with a.objet("objet", 0.2, haut=0.62):
        # Un lampion de papier plissé, suspendu : le jeu le pend où il veut.
        a.baton("fer", (0, 0, 0.62), (0, 0, 0.5), 0.006, cotes=4)
        a.cylindre("bois-sombre", 0.06, 0.46, 0.5, cotes=10, biseau=0.005)
        prof = [(0.06, 0.2), (0.15, 0.25), (0.18, 0.33), (0.15, 0.41), (0.06, 0.46)]
        a.tour("lampion", prof, cotes=12, lisse=True)
        for z in (0.24, 0.285, 0.33, 0.375, 0.42):
            r = 0.18 - abs(z - 0.33) * 0.6
            a.tore("bois-sombre", (0, 0, z), r, 0.006, cotes=14, section=3)
        a.cylindre("bois-sombre", 0.06, 0.17, 0.2, cotes=10, biseau=0.005)
        a.baton("toile-rouge", (0, 0, 0.17), (0, 0, 0.02), 0.012, cotes=4)



def sac(a, pos, rot_z, graine):
    """Un sac de jute plein, trapu et affaissé, le col noué et ses oreilles."""
    with a.repere(pos, rot_z=rot_z), a.objet("objet", 0.21, haut=0.45):
        a.fondre("jute", [((0, 0, 0.17), (0.23, 0.18, 0.19)), ((0, 0, 0.3), (0.16, 0.13, 0.1))],
                 voxel=0.03, lissage=3, triangles=260, sol=0.0)
        a.tore("paille-sombre", (0, 0, 0.37), 0.045, 0.014, cotes=10, section=4)
        for s in (-1, 1):
            a.lame("jute", (0, 0, 0.38), (s * 0.6, 0.2, 1), (0, 1, 0), 0.09, 0.07, courbe=0.02, pas=2)


def _rayon_cloche(profil, z):
    """Le rayon du profil de révolution à la hauteur z (interpolé)."""
    for (r0, z0), (r1, z1) in zip(profil, profil[1:]):
        if z0 <= z <= z1:
            return r0 + (r1 - r0) * (z - z0) / (z1 - z0)
    return profil[-1][0]


def oiseau(a, pos, cap):
    """Un rouge-gorge : un corps rond, une tête, un bec, une queue."""
    x, y, z = pos
    with a.repere(pos, rot_z=cap):
        a.boule("bois", (0, 0, 0.05), (0.05, 0.07, 0.05), finesse=2)
        a.boule("peinture-rouge", (0, -0.035, 0.05), (0.04, 0.04, 0.04), finesse=2)
        a.boule("bois", (0, -0.05, 0.1), 0.035, finesse=2)
        a.tour("coeur-fleur", [(0.01, 0.0), (0.0, 0.03)], cotes=4,
               m=Matrix.Translation((0, -0.08, 0.1)) @ rot(x=math.pi / 2))
        a.boite("bois-sombre", (0.04, 0.07, 0.015), (0, 0.08, 0.07), biseau=0.005, m=rot(x=-0.4))
