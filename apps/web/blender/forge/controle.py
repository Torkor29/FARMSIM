"""
Les contrôles : ce qu'un œil ne voit pas sur une image fixe.

- **budget** : triangles et appels de rendu par pièce, sous le plafond déclaré
  par la recette (le jeu tourne sur téléphone) ;
- **sol** : une pièce posée touche la terre (ni flottante, ni enterrée) ;
- **coplanarité** : deux faces visibles dans le même plan, tournées du même
  côté, qui se chevauchent — le scintillement (z-fighting) qu'aucune capture
  ne montre et qui rampe dès que la caméra bouge. On espace : une pièce en
  saillie de 1 à 3 cm, une pièce recouvrante en retrait.

Tout se mesure en unités du jeu, sur les objets matérialisés (`realiser()`).
"""

from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass, field

from mathutils import Vector

AIRE_MIN = 1.5e-3  # m², en unités du jeu


@dataclass
class Rapport:
    piece: str
    triangles: int = 0
    appels: int = 0
    sommets: int = 0
    taille: tuple = (0.0, 0.0, 0.0)  # repère du jeu : x, y (haut), z
    bas: float = 0.0
    matieres: list = field(default_factory=list)
    noeuds: list = field(default_factory=list)
    alertes: list = field(default_factory=list)
    erreurs: list = field(default_factory=list)

    def dict(self) -> dict:
        return {
            "triangles": self.triangles,
            "appels": self.appels,
            "sommets": self.sommets,
            "taille": [round(v, 3) for v in self.taille],
            "matieres": self.matieres,
            "noeuds": self.noeuds,
            "alertes": self.alertes,
            "erreurs": self.erreurs,
        }


def _triangles_monde(objets):
    for o in objets:
        mw = o.matrix_world
        me = o.data
        me.calc_loop_triangles()
        vs = [mw @ v.co for v in me.vertices]
        for t in me.loop_triangles:
            yield o.name, [vs[i] for i in t.vertices]


def _chevauchement_2d(a, b, marge=1e-4) -> bool:
    """Deux triangles plans se recouvrent-ils (au-delà du simple contact) ? SAT."""
    for tri in (a, b):
        for i in range(3):
            p, q = tri[i], tri[(i + 1) % 3]
            nx, ny = q[1] - p[1], p[0] - q[0]
            pa = [nx * v[0] + ny * v[1] for v in a]
            pb = [nx * v[0] + ny * v[1] for v in b]
            longueur = (nx * nx + ny * ny) ** 0.5 or 1.0
            if min(max(pa), max(pb)) - max(min(pa), min(pb)) <= marge * longueur:
                return False
    return True


def coplanaires(objets, max_rapports=6) -> list[str]:
    """Les paires de faces coplanaires, de même sens, qui se chevauchent."""
    seaux = defaultdict(list)
    for nom, tri in _triangles_monde(objets):
        n = (tri[1] - tri[0]).cross(tri[2] - tri[0])
        aire = n.length / 2
        # Un brin, une tige, un pétale : quelques millimètres de large. Deux
        # brins qui se croisent presque à plat se recouvrent sur moins d'un
        # pixel — pas de scintillement visible. On ne juge que les surfaces
        # d'au moins 15 cm² (à l'échelle du jeu).
        if aire < AIRE_MIN:
            continue
        n.normalize()
        d = n.dot(tri[0])
        # Le dessous posé à même le sol ne se voit jamais.
        if n.z < -0.99 and abs(d) < 0.005:
            continue
        cle = (round(n.x, 2), round(n.y, 2), round(n.z, 2), round(d, 3))
        seaux[cle].append((nom, tri, n))
    trouves = []
    for cle, faces in seaux.items():
        if len(faces) < 2 or len(faces) > 400:
            continue
        n = faces[0][2]
        u = n.orthogonal().normalized()
        v = n.cross(u)
        proj = [(nom, [(p.dot(u), p.dot(v)) for p in tri]) for nom, tri, _ in faces]
        for i in range(len(proj)):
            for j in range(i + 1, len(proj)):
                # Deux triangles d'un même morceau lisse se touchent par un bord :
                # le test exige un vrai recouvrement.
                if _chevauchement_2d(proj[i][1], proj[j][1]):
                    a, b = proj[i][0], proj[j][0]
                    c = sum(faces[i][1], Vector()) / 3
                    trouves.append(f"faces confondues {a} / {b} près de "
                                   f"({c.x:.2f}, {c.z:.2f}, {-c.y:.2f})")
                    break
            if len(trouves) >= max_rapports:
                return trouves
    return trouves


def controler(atelier, budget_triangles=None, budget_appels=None, posee=True,
              tolerance_sol=0.03, verifier_coplanaires=True) -> dict[str, Rapport]:
    """Un rapport par pièce. Les erreurs doivent être corrigées, les alertes lues."""
    rapports = {}
    for piece in atelier.pieces.values():
        r = Rapport(piece.nom)
        mini = Vector((1e9, 1e9, 1e9))
        maxi = Vector((-1e9, -1e9, -1e9))
        for o in piece.objets:
            me = o.data
            r.triangles += sum(len(p.vertices) - 2 for p in me.polygons)
            r.sommets += len(me.vertices)
            r.appels += 1
            mat = me.materials[0].name if me.materials else "?"
            if mat not in r.matieres:
                r.matieres.append(mat)
            for v in me.vertices:
                w = o.matrix_world @ v.co
                mini = Vector(map(min, mini, w))
                maxi = Vector(map(max, maxi, w))
        r.noeuds = [n for n in piece.noeuds if n]
        if r.appels:
            d = maxi - mini
            r.taille = (d.x, d.z, d.y)
            r.bas = mini.z
        if budget_triangles and r.triangles > budget_triangles:
            r.erreurs.append(f"{r.triangles} triangles > budget {budget_triangles}")
        if budget_appels and r.appels > budget_appels:
            r.erreurs.append(f"{r.appels} appels de rendu > budget {budget_appels}")
        if posee and r.appels:
            if r.bas > tolerance_sol:
                r.erreurs.append(f"flotte : le point le plus bas est à {r.bas:.3f} au-dessus du sol")
            elif r.bas < -0.25:
                r.alertes.append(f"s'enfonce de {-r.bas:.3f} sous le sol")
        if verifier_coplanaires:
            r.alertes.extend(coplanaires(piece.objets))
        rapports[piece.nom] = r
    return rapports
