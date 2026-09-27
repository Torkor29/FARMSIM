"""
Les étals de marché — comptoir de bois, auvent rayé à festons, caisses pleines.

Trois pièces aux couleurs de la fête des récoltes : `etal-rouge`,
`etal-vert`, `etal-orange`, chacune avec son étalage (citrouilles, pommes,
bottes de foin, paniers). Face à la caméra (−Y).
"""

import math
import random

ASSET = {
    "titre": "Étals de marché",
    "echelle": 1.0,
    "budget_triangles": 9000,
    "budget_appels": 14,
    "etiquettes": ["fete-des-recoltes", "village"],
}

L, P = 2.0, 1.1


def construire(a):
    for nom, toile, graine in (("etal-rouge", "toile-rouge", 1), ("etal-vert", "toile-verte", 2),
                               ("etal-orange", "toile-orange", 3)):
        with a.piece(nom):
            etal(a, toile, graine)


def etal(a, toile, graine):
    rnd = random.Random(graine)
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

    # L'étalage : caisses inclinées pleines, citrouilles, panier.
    for k, x in enumerate((-0.6, 0.0, 0.6)):
        with a.repere((x, -0.05, 0.9)):
            a.boite("bois", (0.52, 0.4, 0.2), (0, 0, 0.1), biseau=0.02)
            fruit = ("citrouille", "peinture-rouge", "tournesol")[(k + graine) % 3]
            for i in range(3):
                for j in range(2):
                    px, py = -0.16 + i * 0.16, -0.08 + j * 0.16
                    if fruit == "citrouille":
                        a.citrouille("citrouille", (px, py, 0.16), 0.085, graine=i + j * 3)
                    else:
                        a.boule(fruit if fruit != "tournesol" else "coeur-fleur", (px, py, 0.24), 0.075,
                                finesse=2)
    # Au pied : une botte de foin et deux grosses citrouilles.
    a.boite("paille", (0.7, 0.42, 0.4), (L / 2 + 0.25, -P / 2 - 0.05, 0.2), rot_z=0.2, biseau=0.08)
    a.citrouille("citrouille", (-L / 2 - 0.1, -P / 2 - 0.2, 0), 0.26, graine=graine)
    a.citrouille("citrouille", (-L / 2 + 0.25, -P / 2 - 0.35, 0), 0.18, graine=graine + 4)
    # Un panier.
    a.tour("paille-sombre", [(0.14, 0.0), (0.2, 0.2), (0.21, 0.22), (0.19, 0.22)],
           centre=(L / 2 + 0.2, -P / 2 - 0.1, 0.4), cotes=12, lisse=False)
    for i in range(4):
        a.boule("peinture-rouge", (L / 2 + 0.2 + rnd.uniform(-0.08, 0.08),
                                   -P / 2 - 0.1 + rnd.uniform(-0.08, 0.08), 0.64), 0.06, finesse=1)
