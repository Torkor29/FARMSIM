"""
Les étals de marché — comptoir de bois, auvent rayé à festons, caisses pleines.

Trois pièces aux couleurs de la fête des récoltes : `etal-rouge`,
`etal-vert`, `etal-orange`, chacune avec son étalage (citrouilles, pommes,
bottes de foin, paniers). Face à la caméra (−Y).
"""

import math
import random

from recettes.jardin import lampion, sac

ASSET = {
    "titre": "Étals de marché",
    "echelle": 1.0,
    "budget_triangles": 13000,
    "budget_appels": 18,
    "etiquettes": ["fete-des-recoltes", "village"],
    "dependances": ["jardin"],
}

L, P = 2.0, 1.1


def construire(a):
    for nom, toile, graine in (("etal-rouge", "toile-rouge", 1), ("etal-vert", "toile-verte", 2),
                               ("etal-orange", "toile-orange", 3)):
        with a.piece(nom):
            etal(a, toile, graine)


def etal(a, toile, graine):
    rnd = random.Random(graine)
    # Le corps de l'étal — poteaux, comptoir, enseigne, auvent, étalage,
    # lampions — ne fait qu'un objet : ce qui est posé autour ne doit pas y
    # entrer (voir `controle.interpenetrations`).
    with a.objet_boite("objet", (L + 0.12, P + 0.12), haut=2.35, nom="etal"):
        corps(a, toile, graine)

    # Au pied : une botte de foin (et son panier), deux grosses citrouilles,
    # des sacs, une ardoise — chacun à sa place, sans entrer dans l'étal.
    bx, by = L / 2 + 0.5, -P / 2 - 0.3
    with a.objet_boite("objet", (0.72, 0.44), centre=(bx, by), rot_z=0.2, haut=0.4, nom="botte"):
        a.boite("paille", (0.7, 0.42, 0.4), (bx, by, 0.2), rot_z=0.2, biseau=0.08)
    with a.objet("objet", 0.21, centre=(bx - 0.05, by), bas=0.4, haut=0.7, nom="panier"):
        a.tour("paille-sombre", [(0.14, 0.0), (0.2, 0.2), (0.21, 0.22), (0.19, 0.22)],
               centre=(bx - 0.05, by, 0.4), cotes=12, lisse=False)
        for i in range(4):
            a.boule("peinture-rouge", (bx - 0.05 + rnd.uniform(-0.08, 0.08), by + rnd.uniform(-0.08, 0.08), 0.64),
                    0.06, finesse=1)
    a.citrouille("citrouille", (-L / 2 - 0.2, -P / 2 - 0.25, 0), 0.26, graine=graine)
    a.citrouille("citrouille", (-L / 2 + 0.3, -P / 2 - 0.5, 0), 0.18, graine=graine + 4)
    sac(a, (-L / 2 - 0.35, 0.15, 0), 0.5, graine)
    sac(a, (-L / 2 - 0.3, 0.62, 0), -0.4, graine + 1)
    with a.repere((0.35, -P / 2 - 0.25, 0), rot_z=0.15), a.objet_boite("objet", (0.42, 0.06), haut=0.55,
                                                                       nom="ardoise"):
        a.boite("bois", (0.42, 0.04, 0.55), (0, 0, 0.27), biseau=0.015, m=None)
        a.boite("ombre", (0.34, 0.02, 0.44), (0, -0.025, 0.28), biseau=0.005)
        for k in range(3):
            a.boite("marguerite", (0.22 - k * 0.05, 0.01, 0.02), (0, -0.04, 0.4 - k * 0.08), biseau=0.0)


def corps(a, toile, graine):
    """Poteaux, comptoir, enseigne, auvent rayé, étalage, lampions, pots de miel."""
    # Les quatre poteaux, plus hauts derrière (l'auvent penche vers l'avant).
    for sx in (-1, 1):
        a.boite("bois", (0.1, 0.1, 2.25), (sx * (L / 2 - 0.05), P / 2 - 0.05, 1.125), biseau=0.02)
        a.boite("bois", (0.1, 0.1, 1.85), (sx * (L / 2 - 0.05), -P / 2 + 0.05, 0.925), biseau=0.02)
    # Le comptoir : un caisson de planches, un plateau qui déborde.
    a.planches("bois-clair", L - 0.1, 0.82, 0.05, 7, centre=(0, -P / 2 + 0.12, 0), graine=graine)
    for sx in (-1, 1):
        a.boite("bois-clair", (0.05, P - 0.3, 0.8), (sx * (L / 2 - 0.1), 0, 0.4), biseau=0.015)
    a.boite("bois", (L + 0.08, P - 0.1, 0.07), (0, 0.02, 0.86), biseau=0.02)
    # L'enseigne au-dessus du comptoir.
    a.boite("bois-sombre", (L * 0.55, 0.05, 0.26), (0, -P / 2 + 0.02, 1.62), biseau=0.02)
    a.boite("peinture-blanche", (L * 0.48, 0.02, 0.18), (0, -P / 2 - 0.01, 1.62), biseau=0.01)

    # L'auvent rayé : il part du haut des poteaux arrière et descend vers l'avant.
    pente = math.degrees(math.atan2(0.4, P))
    a.toile([toile, "toile-creme"], L + 0.3, P / math.cos(math.radians(pente)) + 0.18, bandes=8,
            fleche=0.06, centre=(0, P / 2 + 0.02, 2.3), pente_deg=pente)
    a.boite("bois-sombre", (L + 0.34, 0.07, 0.07), (0, P / 2 + 0.02, 2.29), biseau=0.015)

    # L'étalage : caisses inclinées pleines.
    for k, x in enumerate((-0.6, 0.0, 0.6)):
        with a.repere((x, -0.05, 0.9)):
            a.boite("bois", (0.52, 0.4, 0.2), (0, 0, 0.1), biseau=0.02)
            fruit = ("citrouille", "peinture-rouge", "tournesol")[(k + graine) % 3]
            for i in range(3):
                for j in range(2):
                    px, py = -0.16 + i * 0.16, -0.08 + j * 0.16
                    if fruit == "citrouille":
                        a.citrouille("citrouille", (px, py, 0.16), 0.075, graine=i + j * 3)
                    else:
                        a.boule(fruit if fruit != "tournesol" else "coeur-fleur", (px, py, 0.24), 0.07,
                                finesse=2)
    # Des lampions pendus au bord de l'auvent : ils luisent le soir.
    for x in (-0.75, 0.0, 0.75):
        with a.repere((x, -P / 2 - 0.08, 1.42), echelle=0.68):
            lampion(a)
    # Des pots de miel alignés au bord du comptoir.
    for k in range(5):
        x = -0.85 + k * 0.1
        a.cylindre("tournesol", 0.04, 0.9, 0.99, centre=(x, -P / 2 + 0.12), cotes=8, biseau=0.01)
        a.cylindre("toile-rouge" if k % 2 else "toile-creme", 0.045, 0.99, 1.01, centre=(x, -P / 2 + 0.12),
                   cotes=8, biseau=0.005)
