"""
La serre — châssis de bois peint en blanc, vitres, jardinières à l'intérieur.

Une pièce, `serre`, posée sur un petit dallage. Le verre est translucide
(`alphaMode: BLEND` dans le glTF) : ce qu'on y a planté se voit à travers.
"""

import math

from mathutils import Matrix

from forge.formes import rot

ASSET = {
    "titre": "Serre",
    "echelle": 1.0,
    "budget_triangles": 9000,
    "budget_appels": 12,
    "etiquettes": ["repere", "fete-des-recoltes"],
}

L, P = 2.4, 1.7  # longueur (X), profondeur (Y)
H_MUR = 1.25
PENTE = 38
H_FAITE = H_MUR + math.tan(math.radians(PENTE)) * P / 2
MONTANT = 0.07


def construire(a):
    with a.piece("serre"):
        # Le dallage, et le soubassement de planches peintes.
        a.dalles("pierre", 1.75, nb=16, epais=0.07, graine=4, hauteur=0.02, mat2="pierre-sombre")
        for s in (-1, 1):
            a.boite("peinture-blanche", (L, 0.08, 0.36), (0, s * P / 2, 0.24), biseau=0.02)
            a.boite("peinture-blanche", (0.08, P, 0.36), (s * L / 2, 0, 0.24), biseau=0.02)
        z0 = 0.42

        # Les montants, les lisses, et le faîtage.
        nx = 4
        for i in range(nx + 1):
            x = -L / 2 + L * i / nx
            for s in (-1, 1):
                a.boite("peinture-blanche", (MONTANT, MONTANT, H_MUR - z0 + 0.04),
                        (x, s * P / 2, (z0 + H_MUR) / 2), biseau=0.012)
            # Les chevrons, du haut du mur au faîtage.
            for s in (-1, 1):
                a.baton("peinture-blanche", (x, s * P / 2, H_MUR), (x, 0, H_FAITE), MONTANT * 0.55, cotes=6)
        for s in (-1, 1):
            a.boite("peinture-blanche", (L + 0.12, MONTANT * 1.2, MONTANT * 1.2), (0, s * P / 2, H_MUR),
                    biseau=0.012)
            # Les lisses débordent un peu des montants : jamais deux faces dans le même plan.
            a.boite("peinture-blanche", (L + 0.12, MONTANT * 1.3, MONTANT), (0, s * P / 2, z0), biseau=0.012)
            for y in (-P / 4, 0, P / 4):
                a.boite("peinture-blanche", (MONTANT, MONTANT, H_MUR - z0), (s * L / 2, y, (z0 + H_MUR) / 2),
                        biseau=0.012)
        a.boite("peinture-blanche", (L + 0.16, 0.1, 0.1), (0, 0, H_FAITE + 0.02), biseau=0.02)

        # Les vitres : un peu en retrait des montants (jamais dans leur plan).
        e = 0.012
        for s in (-1, 1):
            a.boite("verre", (L - 0.02, e, H_MUR - z0 - 0.02), (0, s * (P / 2 - 0.01), (z0 + H_MUR) / 2), biseau=0.0)
            a.boite("verre", (e, P - 0.02, H_MUR - z0 - 0.04), (s * (L / 2 - 0.01), 0, (z0 + H_MUR) / 2), biseau=0.0)
            # Les pans de toit vitrés.
            rampant = (P / 2) / math.cos(math.radians(PENTE))
            m = (Matrix.Translation((0, 0, H_FAITE - 0.03)) @ rot(x=-s * math.radians(PENTE))
                 @ Matrix.Translation((0, s * rampant / 2, 0)))
            a.boite("verre", (L, rampant - 0.04, e), biseau=0.0, m=m)
            # Les pignons vitrés (triangles au-dessus des murs).
            a.pignon("verre", P - 0.04, 0.0, H_FAITE - H_MUR - 0.03, e,
                     centre=(s * (L / 2 - 0.01), 0, H_MUR), rot_z=math.pi / 2, biseau=0.0)

        # La porte, sur le pignon droit : un cadre, une poignée.
        a.boite("peinture-blanche", (0.06, 0.62, 0.06), (L / 2 + 0.02, 0, H_MUR - 0.08), biseau=0.01)

        # Dedans : deux jardinières et leurs pousses.
        for s in (-1, 1):
            a.boite("bois", (L - 0.4, 0.42, 0.34), (0, s * 0.45, 0.25), biseau=0.03)
            a.boite("terre", (L - 0.5, 0.34, 0.04), (0, s * 0.45, 0.42), biseau=0.01)
            for k in range(6):
                x = -L / 2 + 0.4 + k * (L - 0.8) / 5
                if k % 2:
                    a.boule("feuillage-clair", (x, s * 0.45, 0.52), (0.13, 0.13, 0.12), finesse=2, bosses=0.2,
                            graine=k)
                else:
                    a.boule("feuillage", (x, s * 0.45, 0.5), (0.1, 0.1, 0.1), finesse=2, bosses=0.25, graine=k)
                    a.boule("peinture-rouge", (x + 0.05, s * 0.45 - 0.06, 0.55), 0.035, finesse=1)
        # Des pots devant la porte.
        for k, (x, y) in enumerate(((L / 2 + 0.28, -0.55), (L / 2 + 0.34, -0.2))):
            a.tour("terre-claire", [(0.1, 0.0), (0.14, 0.2), (0.155, 0.2), (0.155, 0.24), (0.13, 0.24)],
                   centre=(x, y, 0.08), cotes=10, lisse=False)
            a.boule("feuillage", (x, y, 0.4), 0.14, finesse=2, bosses=0.2, graine=k + 10)
