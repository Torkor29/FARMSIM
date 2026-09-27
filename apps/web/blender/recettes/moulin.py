"""
Le moulin à vent — tour chaulée, bonnet de bois, quatre ailes en treillis.

Pièce `moulin` ; les ailes sont un nœud à part, `moulin:ailes`, pivot au
moyeu : le jeu les fait tourner autour de leur axe Z local (l'axe du moyeu,
tourné vers la caméra).
"""

import math

from forge.formes import rot
from recettes.jardin import sac

ASSET = {
    "titre": "Moulin à vent",
    "echelle": 1.0,
    "budget_triangles": 16000,
    "budget_appels": 20,
    "etiquettes": ["repere", "fete-des-recoltes"],
    "dependances": ["jardin"],
}

H_TOUR = 4.3
R_BAS, R_HAUT = 1.35, 0.98


def rayon_a(z):
    return R_BAS + (R_HAUT - R_BAS) * z / H_TOUR


def construire(a):
    with a.piece("moulin"):
        # Le socle de pierres et la tour chaulée, légèrement évasée au pied.
        a.cylindre("pierre-sombre", R_BAS + 0.2, 0, 0.28, cotes=18, biseau=0.06)
        a.tour("enduit", [(R_BAS, 0.2), (rayon_a(1.0) * 1.01, 1.0), (rayon_a(3.0), 3.0), (R_HAUT, H_TOUR)],
               cotes=18, lisse=True, fermer=False)
        # Des pierres d'angle apparentes dans l'enduit, au pied et çà et là.
        rnd = a.alea
        for rang, z in enumerate((0.42, 0.72, 1.02)):
            n = 12 - rang * 2
            for k in range(n):
                if rnd.random() < 0.35 + rang * 0.15:
                    continue
                ang = 2 * math.pi * (k + 0.5 * (rang % 2)) / n
                r = rayon_a(z) + 0.02
                a.boite("pierre", (0.42, 0.14, 0.24),
                        (math.cos(ang) * r, math.sin(ang) * r, z), rot_z=ang + math.pi / 2, biseau=0.05)

        # La porte, dans son encadrement, côté caméra (−Y).
        yp = -rayon_a(0.9) - 0.02
        a.boite("bois-sombre", (0.9, 0.16, 1.5), (0, yp + 0.04, 0.95), biseau=0.04)
        a.planches("bois", 0.72, 1.3, 0.08, 4, centre=(0, yp - 0.03, 0.28), graine=3)
        a.boite("fer", (0.08, 0.05, 0.08), (0.22, yp - 0.09, 0.95), biseau=0.02)
        a.boite("pierre", (1.05, 0.4, 0.12), (0, yp - 0.12, 0.24), biseau=0.04)

        # Devant la porte : un chemin de dalles, des sacs de farine, un tonneau.
        a.dalles("pierre", 1.0, nb=9, epais=0.06, graine=5, hauteur=0.0,
                 contour=[(-0.55, -1.3), (0.55, -1.3), (0.6, -2.6), (-0.6, -2.6)])
        sac(a, (0.85, -1.35, 0), 0.4, 1)
        sac(a, (1.15, -1.0, 0), -0.6, 2)
        sac(a, (0.95, -1.05, 0.33), 1.2, 3)
        a.tour("bois", [(0.24, 0.0), (0.28, 0.16), (0.29, 0.3), (0.28, 0.44), (0.24, 0.6)],
               centre=(-0.95, -1.2, 0), cotes=14, lisse=True)
        for z in (0.1, 0.5):
            a.tore("fer", (-0.95, -1.2, z), 0.265, 0.01, cotes=16, section=4, aplatir=1.6)
        a.cylindre("bois-sombre", 0.23, 0.58, 0.62, centre=(-0.95, -1.2), cotes=14, biseau=0.01)
        for k in range(5):
            a.touffe((-1.3 + k * 0.1, -1.5 + (k % 2) * 0.2, 0), graine=k, brins=6)

        # Deux fenêtres à volets, chacune avec sa jardinière fleurie.
        for ang, z in ((math.radians(-60), 2.5), (math.radians(40), 3.3)):
            r = rayon_a(z)
            with a.repere((math.sin(ang) * r, -math.cos(ang) * r, z), rot_z=ang):
                a.boite("bois-sombre", (0.5, 0.12, 0.6), (0, -0.02, 0), biseau=0.03)
                a.boite("ombre", (0.34, 0.06, 0.44), (0, -0.07, 0), biseau=0.01)
                for s in (-1, 1):
                    a.boite("peinture-verte", (0.2, 0.05, 0.56), (s * 0.37, -0.08, 0), rot_z=s * 0.25, biseau=0.015)
                a.boite("bois", (0.56, 0.16, 0.12), (0, -0.12, -0.36), biseau=0.02)
                for k in range(5):
                    x = -0.2 + k * 0.1
                    a.boule("feuillage", (x, -0.13, -0.27), 0.06, finesse=1)
                    a.boule("coquelicot" if k % 2 else "rose", (x + 0.02, -0.18, -0.24), 0.03, finesse=1)

        # Le bonnet : une corniche, puis un toit de bardeaux en cloche.
        a.cylindre("bois-sombre", R_HAUT + 0.14, H_TOUR - 0.05, H_TOUR + 0.14, cotes=18, biseau=0.04)
        a.tour("bois", [(R_HAUT + 0.2, H_TOUR + 0.1), (R_HAUT + 0.12, H_TOUR + 0.35),
                        (R_HAUT * 0.78, H_TOUR + 0.9), (R_HAUT * 0.42, H_TOUR + 1.35),
                        (0.12, H_TOUR + 1.62), (0.0, H_TOUR + 1.66)], cotes=18, lisse=True)
        # Les rangs de bardeaux : des anneaux en léger débord.
        for k, t in enumerate((0.3, 0.62)):
            z = H_TOUR + 0.35 + t * 0.9
            r = (R_HAUT + 0.12) + ((R_HAUT * 0.42) - (R_HAUT + 0.12)) * t * 1.1
            a.tore("bois-sombre", (0, 0, z), r + 0.02, 0.035, cotes=24, section=5, aplatir=0.7)
        # L'épi de faîtage.
        a.baton("bois-sombre", (0, 0, H_TOUR + 1.6), (0, 0, H_TOUR + 1.95), 0.03)
        a.boule("peinture-rouge", (0, 0, H_TOUR + 1.98), 0.07, finesse=2)

        # L'arbre moteur qui sort du bonnet vers la caméra.
        hub = (0, -R_HAUT - 0.42, H_TOUR + 0.62)
        a.baton("bois-sombre", (0, -0.3, hub[2] + 0.06), (0, hub[1] + 0.05, hub[2]), 0.11, cotes=10)

        with a.noeud("ailes", origine=hub):
            with a.repere(hub):
                # Le moyeu.
                a.cylindre("bois-sombre", 0.2, -0.12, 0.12, cotes=12, biseau=0.03, m=rot(x=math.pi / 2))
                a.boule("fer", (0, -0.13, 0), 0.08, finesse=2)
                for k in range(4):
                    angle = math.pi / 4 + k * math.pi / 2
                    aile(a, angle)


def aile(a, angle):
    """Une aile : la vergue, et le treillis d'un côté, en légère hélice."""
    longueur = 2.75
    with a.repere((0, -0.05, 0)):
        m = rot(y=-angle)
        # La vergue (du moyeu à la pointe).
        a.boite("bois-sombre", (longueur, 0.11, 0.11), (longueur / 2 + 0.1, 0, 0), biseau=0.02, m=m)
        # Le treillis : deux longerons et des barreaux, décalé d'un côté.
        largeur = 0.86
        debut = 0.55
        for s in (0.06, largeur / 2 + 0.04, largeur):
            a.boite("bois-clair", (longueur - debut + 0.05, 0.06, 0.06),
                    ((longueur + debut) / 2 + 0.05, -0.05, s), biseau=0.012, m=m @ rot(x=0.08))
        n = 8
        for k in range(n):
            x = debut + 0.1 + (longueur - debut - 0.1) * k / (n - 1)
            a.boite("bois-clair", (0.06, 0.055, largeur + 0.05), (x, -0.07, largeur / 2 + 0.03),
                    biseau=0.01, m=m @ rot(x=0.08))
        # Une toile repliée le long de la vergue, comme au repos.
        a.boite("toile-creme", (longueur - debut - 0.1, 0.07, 0.14), ((longueur + debut) / 2, -0.07, -0.1),
                biseau=0.03, m=m)
