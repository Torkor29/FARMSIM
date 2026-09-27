"""
Les formes de base : ce dont on bâtit un moulin, un puits, un étal.

Le style visé est « jouet de bois poli » : des volumes simples, épais, aux
arêtes **toujours** adoucies (un biseau accroche la lumière et c'est ce qui
distingue un objet modelé d'un pavé de code), des proportions trapues, peu de
détails mais lisibles de loin. Chaque forme verse sa géométrie dans le
maillage de sa matière (`Atelier.verser`).

Toutes les dimensions sont en mètres, Z vers le haut.
"""

from __future__ import annotations

import math
import random

import bmesh
from mathutils import Matrix, Vector


def rot(x: float = 0.0, y: float = 0.0, z: float = 0.0) -> Matrix:
    """Rotation d'Euler (X puis Y puis Z), en radians."""
    return Matrix.Rotation(z, 4, "Z") @ Matrix.Rotation(y, 4, "Y") @ Matrix.Rotation(x, 4, "X")


def vers(a, b) -> Matrix:
    """La matrice qui pose l'axe Z local de `a` vers `b` (origine en `a`)."""
    a, b = Vector(a), Vector(b)
    d = b - a
    q = Vector((0, 0, 1)).rotation_difference(d.normalized())
    return Matrix.Translation(a) @ q.to_matrix().to_4x4()


def _biseauter(bm: bmesh.types.BMesh, biseau: float, segments: int, aretes=None):
    if biseau <= 0:
        return
    bmesh.ops.bevel(
        bm, geom=list(aretes if aretes is not None else bm.edges), offset=biseau,
        segments=segments, profile=0.5, affect="EDGES", clamp_overlap=True,
    )


class Formes:
    # ------------------------------------------------------------------
    # Volumes
    # ------------------------------------------------------------------

    def boite(self, mat, taille, centre=(0, 0, 0), rot_z=0.0, biseau=0.02, segments=2,
              lisse=False, m: Matrix | None = None):
        """Un pavé biseauté. `m` (facultative) s'applique après le placement."""
        tx, ty, tz = taille
        # Un barreau fin n'a pas besoin de deux segments de biseau : on ne les
        # verrait pas, et ils coûtent cher (règle : biseau selon le rôle).
        if min(tx, ty, tz) < 0.08:
            segments = 1
        bm = bmesh.new()
        bmesh.ops.create_cube(bm, size=1.0)
        bmesh.ops.scale(bm, vec=Vector(taille), verts=bm.verts)
        _biseauter(bm, min(biseau, min(tx, ty, tz) * 0.45), segments)
        place = Matrix.Translation(Vector(centre)) @ Matrix.Rotation(rot_z, 4, "Z")
        self.verser(bm, mat, lisse=lisse, m=(m @ place) if m is not None else place)

    def pose(self, mat, taille, bas=(0, 0, 0), **kw):
        """Un pavé posé : `bas` est le centre de sa face inférieure."""
        self.boite(mat, taille, (bas[0], bas[1], bas[2] + taille[2] / 2), **kw)

    def tour(self, mat, profil, centre=(0, 0, 0), cotes=16, lisse=True, fermer=True,
             aplatir=(1.0, 1.0), m: Matrix | None = None, torsion=0.0):
        """
        Un solide de révolution autour de Z : `profil` est une suite de
        (rayon, hauteur) de bas en haut. Tour de moulin, phare, margelle,
        tonneau, pot, toit conique — tout ce qui se tourne au tour.

        `aplatir` étire en X/Y (ovale), `torsion` fait tourner chaque anneau
        (en radians par mètre) pour casser la régularité.
        """
        bm = bmesh.new()
        anneaux = []
        for r, z in profil:
            if r <= 1e-6:
                anneaux.append([bm.verts.new((0, 0, z))])
                continue
            a0 = torsion * z
            anneaux.append([
                bm.verts.new((
                    math.cos(a0 + 2 * math.pi * k / cotes) * r * aplatir[0],
                    math.sin(a0 + 2 * math.pi * k / cotes) * r * aplatir[1],
                    z,
                ))
                for k in range(cotes)
            ])
        for i in range(len(anneaux) - 1):
            a, b = anneaux[i], anneaux[i + 1]
            for k in range(cotes):
                k2 = (k + 1) % cotes
                if len(a) == 1:
                    bm.faces.new((a[0], b[k], b[k2]))
                elif len(b) == 1:
                    bm.faces.new((a[k], a[k2], b[0]))
                else:
                    bm.faces.new((a[k], a[k2], b[k2], b[k]))
        if fermer:
            if len(anneaux[0]) > 1:
                bm.faces.new(list(reversed(anneaux[0])))
            if len(anneaux[-1]) > 1:
                bm.faces.new(anneaux[-1])
        place = Matrix.Translation(Vector(centre))
        self.verser(bm, mat, lisse=lisse, m=(m @ place) if m is not None else place)

    def cylindre(self, mat, rayon, bas, haut, centre=(0, 0), cotes=14, rayon_haut=None,
                 biseau=0.015, lisse=True, m: Matrix | None = None):
        """Un cylindre (ou tronc de cône) debout, aux bords arrondis."""
        rh = rayon if rayon_haut is None else rayon_haut
        h = haut - bas
        b = min(biseau, h * 0.3, rayon * 0.3, rh * 0.3 if rh > 0 else 1)
        profil = [(rayon - b, 0.0), (rayon - b * 0.3, b * 0.3), (rayon, b)]
        if rh > 0:
            profil += [(rh, h - b), (rh - b * 0.3, h - b * 0.3), (rh - b, h)]
        else:
            profil += [(0.0, h)]
        self.tour(mat, profil, (centre[0], centre[1], bas), cotes, lisse, m=m)

    def baton(self, mat, a, b, rayon, cotes=7, rayon_b=None, lisse=True, biseau=0.0):
        """Un rondin, un piquet, une perche : un cylindre de `a` à `b`."""
        longueur = (Vector(b) - Vector(a)).length
        rb = rayon if rayon_b is None else rayon_b
        if biseau > 0:
            self.cylindre(mat, rayon, 0, longueur, cotes=cotes, rayon_haut=rb, biseau=biseau,
                          lisse=lisse, m=vers(a, b))
        else:
            self.tour(mat, [(rayon, 0), (rb, longueur)], cotes=cotes, lisse=lisse, m=vers(a, b))

    def tube(self, mat, points, rayons, cotes=6, lisse=True, fermer=True):
        """Un tube le long d'une polyligne : tige, tronc, corde, anse."""
        pts = [Vector(p) for p in points]
        if isinstance(rayons, (int, float)):
            rayons = [rayons] * len(pts)
        bm = bmesh.new()
        anneaux = []
        n = len(pts)
        precedent = None
        for i, (p, r) in enumerate(zip(pts, rayons)):
            t = (pts[min(i + 1, n - 1)] - pts[max(i - 1, 0)]).normalized()
            # Un repère transporté le long de la courbe : pas de vrille.
            if precedent is None:
                aide = Vector((0, 0, 1)) if abs(t.z) < 0.9 else Vector((1, 0, 0))
                u = t.cross(aide).normalized()
            else:
                u = (precedent - t * precedent.dot(t)).normalized()
            precedent = u
            v = t.cross(u)
            if r <= 1e-6:
                anneaux.append([bm.verts.new(p)])
                continue
            anneaux.append([
                bm.verts.new(p + (u * math.cos(2 * math.pi * k / cotes) + v * math.sin(2 * math.pi * k / cotes)) * r)
                for k in range(cotes)
            ])
        for i in range(n - 1):
            a, b = anneaux[i], anneaux[i + 1]
            for k in range(cotes):
                k2 = (k + 1) % cotes
                if len(a) == 1:
                    bm.faces.new((a[0], b[k], b[k2]))
                elif len(b) == 1:
                    bm.faces.new((a[k], a[k2], b[0]))
                else:
                    bm.faces.new((a[k], a[k2], b[k2], b[k]))
        if fermer:
            if len(anneaux[0]) > 1:
                bm.faces.new(list(reversed(anneaux[0])))
            if len(anneaux[-1]) > 1:
                bm.faces.new(anneaux[-1])
        self.verser(bm, mat, lisse=lisse)

    def tore(self, mat, centre, rayon, epais, cotes=20, section=6, aplatir=1.0, m: Matrix | None = None):
        """Un anneau : cerclage de tonneau, margelle, bouée."""
        bm = bmesh.new()
        anneaux = []
        for i in range(cotes):
            a = 2 * math.pi * i / cotes
            c, s = math.cos(a), math.sin(a)
            anneaux.append([
                bm.verts.new((
                    c * (rayon + math.cos(2 * math.pi * k / section) * epais),
                    s * (rayon + math.cos(2 * math.pi * k / section) * epais),
                    math.sin(2 * math.pi * k / section) * epais * aplatir,
                ))
                for k in range(section)
            ])
        for i in range(cotes):
            a, b = anneaux[i], anneaux[(i + 1) % cotes]
            for k in range(section):
                k2 = (k + 1) % section
                bm.faces.new((a[k], b[k], b[k2], a[k2]))
        place = Matrix.Translation(Vector(centre))
        self.verser(bm, mat, lisse=True, m=(m @ place) if m is not None else place)

    def boule(self, mat, centre, rayon, finesse=2, bosses=0.0, graine=0, lisse=True,
              aplatir_bas: float | None = None):
        """
        Une boule bosselée : caillou, citrouille, pompon, touffe de buisson.

        `rayon` peut être un triplet (ellipsoïde). `bosses` règle l'irrégularité
        (0 = sphère lisse). `aplatir_bas` écrase le dessous sous cette hauteur
        relative (−1…1) : une pierre posée, un buisson assis.
        """
        rnd = random.Random(graine)
        r = rayon if isinstance(rayon, (tuple, list)) else (rayon, rayon, rayon)
        bm = bmesh.new()
        bmesh.ops.create_icosphere(bm, subdivisions=finesse, radius=1.0)
        if bosses > 0:
            dirs = [Vector((rnd.uniform(-1, 1), rnd.uniform(-1, 1), rnd.uniform(-1, 1))).normalized()
                    for _ in range(5)]
            for v in bm.verts:
                n = v.co.normalized()
                v.co *= 1.0 - bosses * 0.5 + sum(max(0.0, n.dot(d)) ** 3 for d in dirs) * bosses
        if aplatir_bas is not None:
            for v in bm.verts:
                if v.co.z < aplatir_bas:
                    v.co.z = aplatir_bas - (v.co.z - aplatir_bas) * -0.15
        bmesh.ops.scale(bm, vec=Vector(r), verts=bm.verts)
        self.verser(bm, mat, lisse=lisse, m=Matrix.Translation(Vector(centre)))

    def prisme(self, mat, contour, bas, haut, biseau=0.02, segments=2, lisse=False,
               m: Matrix | None = None):
        """
        Un contour plan (liste de (x, y), sens trigonométrique) extrudé de `bas`
        à `haut`, arêtes biseautées : dalle, planche découpée, pignon, socle.
        """
        bm = bmesh.new()
        bas_v = [bm.verts.new((x, y, bas)) for x, y in contour]
        haut_v = [bm.verts.new((x, y, haut)) for x, y in contour]
        n = len(contour)
        bm.faces.new(list(reversed(bas_v)))
        bm.faces.new(haut_v)
        for i in range(n):
            j = (i + 1) % n
            bm.faces.new((bas_v[i], bas_v[j], haut_v[j], haut_v[i]))
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        _biseauter(bm, min(biseau, (haut - bas) * 0.45), segments)
        self.verser(bm, mat, lisse=lisse, m=m)

    def pignon(self, mat, largeur, hauteur_mur, hauteur_faite, epais, centre=(0, 0, 0), rot_z=0.0, biseau=0.02):
        """Un mur à pignon (triangle sur rectangle), dressé dans le plan XZ."""
        w = largeur / 2
        contour = [(-w, 0), (w, 0), (w, hauteur_mur), (0, hauteur_faite), (-w, hauteur_mur)]
        m = Matrix.Translation(Vector(centre)) @ Matrix.Rotation(rot_z, 4, "Z") @ rot(x=math.pi / 2) \
            @ Matrix.Translation((0, 0, -epais / 2))
        self.prisme(mat, contour, 0, epais, biseau=biseau, m=m)

    def toit(self, mat, longueur, largeur, pente_deg, epais=0.08, centre=(0, 0, 0), rot_z=0.0,
             biseau=0.02, courbe=0.0):
        """
        Un toit à deux pans : `centre` est le faîtage. Les pans descendent de
        part et d'autre en Y, sur la demi-`largeur` horizontale. `courbe`
        creuse légèrement chaque pan (toit « fatigué », plus vivant).
        """
        a = math.radians(pente_deg)
        demi = largeur / 2
        rampant = demi / math.cos(a)
        for signe in (-1, 1):
            # Les deux pans se croisent au faîtage : leurs bouts décalés de
            # 3 mm ne tombent jamais dans le même plan.
            longueur_pan = longueur + (0.006 if signe < 0 else 0.0)
            if courbe <= 0:
                m = (
                    Matrix.Translation(Vector(centre)) @ Matrix.Rotation(rot_z, 4, "Z")
                    @ Matrix.Rotation(-signe * a, 4, "X")
                    @ Matrix.Translation((0, signe * rampant / 2, -epais / 2))
                )
                self.boite(mat, (longueur_pan, rampant + epais * 0.6, epais), biseau=biseau, m=m)
            else:
                pas = 5
                for k in range(pas):
                    t0, t1 = k / pas, (k + 1) / pas
                    h0 = -math.sin(math.pi * t0) * courbe
                    h1 = -math.sin(math.pi * t1) * courbe
                    lg = rampant / pas
                    penteloc = math.atan2(h1 - h0, lg)
                    m = (
                        Matrix.Translation(Vector(centre)) @ Matrix.Rotation(rot_z, 4, "Z")
                        @ Matrix.Rotation(-signe * a, 4, "X")
                        @ Matrix.Translation((0, signe * (t0 + t1) / 2 * rampant, (h0 + h1) / 2 - epais / 2))
                        @ Matrix.Rotation(signe * penteloc, 4, "X")
                    )
                    self.boite(mat, (longueur_pan, lg * 1.04, epais), biseau=biseau * 0.5, segments=1, m=m)

    # ------------------------------------------------------------------
    # Toiles, planches, cordes
    # ------------------------------------------------------------------

    def toile(self, mats, largeur, profondeur, bandes=8, fleche=0.08, festons=True,
              centre=(0, 0, 0), pente_deg=18.0, rot_z=0.0, epais=0.015):
        """
        Une toile rayée tendue (auvent d'étal) : bandes alternées de `mats`,
        dans le sens de la pente, un léger ventre, et des festons en bas.
        Le bord haut est en `centre`, la toile descend vers −Y (côté caméra).
        """
        a = math.radians(pente_deg)
        pas_y = 6
        for i in range(bandes):
            x0 = -largeur / 2 + largeur * i / bandes
            x1 = x0 + largeur / bandes
            bm = bmesh.new()
            rangs = []
            for j in range(pas_y + 1):
                t = j / pas_y
                y = -profondeur * t
                z = -math.sin(math.pi * t) * fleche
                rangs.append([bm.verts.new((x, y, z)) for x in (x0, x1)])
            if festons:
                # Un feston en demi-disque sous chaque bande.
                bas = rangs[-1]
                pointe = bm.verts.new(((x0 + x1) / 2, -profondeur, -largeur / bandes * 0.45))
                bm.faces.new((bas[0], bas[1], pointe))
            for j in range(pas_y):
                bm.faces.new((rangs[j][0], rangs[j][1], rangs[j + 1][1], rangs[j + 1][0]))
            bmesh.ops.solidify(bm, geom=list(bm.faces), thickness=epais)
            m = (
                Matrix.Translation(Vector(centre)) @ Matrix.Rotation(rot_z, 4, "Z")
                @ Matrix.Rotation(a, 4, "X")
            )
            self.verser(bm, mats[i % len(mats)], lisse=False, m=m)

    def planches(self, mat, largeur, hauteur, epais, nb, centre=(0, 0, 0), rot_z=0.0, jeu=0.012,
                 graine=0, biseau=0.012, desordre=0.01):
        """Un pan de planches verticales (porte, bardage, caisse), dans le plan XZ."""
        rnd = random.Random(graine)
        lp = (largeur - jeu * (nb - 1)) / nb
        for k in range(nb):
            x = -largeur / 2 + lp / 2 + k * (lp + jeu)
            h = hauteur - rnd.uniform(0, desordre * 3)
            m = (
                Matrix.Translation(Vector(centre)) @ Matrix.Rotation(rot_z, 4, "Z")
                @ Matrix.Translation((x, rnd.uniform(-desordre, desordre) * 0.3, h / 2))
                @ Matrix.Rotation(rnd.uniform(-desordre, desordre), 4, "Y")
            )
            self.boite(mat, (lp, epais, h), biseau=biseau, m=m)

    def corde(self, mat, a, b, fleche, rayon=0.012, pas=10, cotes=5):
        """Une corde (ou un fil de guirlande) qui pend en chaînette entre a et b."""
        a, b = Vector(a), Vector(b)
        points = [a.lerp(b, i / pas) - Vector((0, 0, fleche * 4 * (i / pas) * (1 - i / pas))) for i in range(pas + 1)]
        self.tube(mat, points, rayon, cotes=cotes)
        return points

    def fanions(self, mats, a, b, fleche, nb=9, taille=0.22, fil="bois-sombre", graine=0):
        """Une guirlande de fanions triangulaires entre deux poteaux."""
        pts = self.corde(fil, a, b, fleche, rayon=0.01, pas=max(nb * 2, 8), cotes=4)
        a, b = Vector(a), Vector(b)
        axe = (b - a).normalized()
        rnd = random.Random(graine)
        for k in range(nb):
            t = (k + 0.5) / nb
            p = a.lerp(b, t) - Vector((0, 0, fleche * 4 * t * (1 - t)))
            bm = bmesh.new()
            v1 = bm.verts.new(p - axe * taille * 0.45)
            v2 = bm.verts.new(p + axe * taille * 0.45)
            v3 = bm.verts.new(p + Vector((0, 0, -taille * 1.05)) + Vector((rnd.uniform(-0.02, 0.02), 0, 0)))
            bm.faces.new((v1, v2, v3))
            self.verser(bm, mats[k % len(mats)])
        return pts

    # ------------------------------------------------------------------
    # Formes organiques du bâti et du sol
    # ------------------------------------------------------------------

    def citrouille(self, mat, centre, rayon, cotes=8, hauteur=0.72, graine=0, tige="bois-sombre"):
        """Une citrouille côtelée, un peu écrasée, et son pédoncule."""
        rnd = random.Random(graine)
        bm = bmesh.new()
        # Une petite citrouille (dans une caisse) se contente de moins de facettes.
        grande = rayon > 0.15
        bmesh.ops.create_uvsphere(bm, u_segments=cotes * (4 if grande else 2), v_segments=12 if grande else 7,
                                  radius=1.0)
        for v in bm.verts:
            a = math.atan2(v.co.y, v.co.x)
            cote = 1.0 - 0.13 * (0.5 - 0.5 * math.cos(a * cotes)) ** 0.7
            v.co.x *= cote
            v.co.y *= cote
            v.co.z *= hauteur
            # Le creux du pédoncule.
            if v.co.z > hauteur * 0.85:
                v.co.z -= (v.co.z - hauteur * 0.85) * 1.2
        bmesh.ops.scale(bm, vec=(rayon, rayon, rayon), verts=bm.verts)
        cx, cy, cz = centre
        self.verser(bm, mat, lisse=True, m=Matrix.Translation((cx, cy, cz + rayon * hauteur)))
        haut = Vector((cx, cy, cz + rayon * hauteur * 1.8))
        self.tube(tige, [haut - Vector((0, 0, rayon * 0.2)), haut + Vector((0, 0, rayon * 0.12)),
                         haut + Vector((rayon * 0.12 * rnd.choice((-1, 1)), 0, rayon * 0.22))],
                  [rayon * 0.1, rayon * 0.08, rayon * 0.06], cotes=5)

    def dalles(self, mat, rayon, nb=14, jeu=0.05, epais=0.08, graine=0, contour=None,
               hauteur=0.0, mat2: str | None = None):
        """
        Un dallage de pierres plates irrégulières (cellules de Voronoï) dans
        un disque de `rayon` (ou dans `contour`, un polygone convexe) :
        chaque dalle en retrait de `jeu`, biseautée, à hauteur un peu variable.
        """
        rnd = random.Random(graine)
        if contour is None:
            contour = [(math.cos(2 * math.pi * k / 20) * rayon, math.sin(2 * math.pi * k / 20) * rayon)
                       for k in range(20)]
        # Des germes répartis sans trop se toucher (tirage de Poisson naïf).
        germes = []
        essais = 0
        dmin = rayon * 1.6 / math.sqrt(nb)
        while len(germes) < nb and essais < nb * 60:
            essais += 1
            p = (rnd.uniform(-rayon, rayon), rnd.uniform(-rayon, rayon))
            if not _dans(contour, p):
                continue
            if all((p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2 > dmin * dmin for q in germes):
                germes.append(p)
        for i, g in enumerate(germes):
            cellule = list(contour)
            for j, h in enumerate(germes):
                if i == j:
                    continue
                # Le demi-plan plus proche de g que de h, reculé de jeu/2.
                nx, ny = h[0] - g[0], h[1] - g[1]
                ln = math.hypot(nx, ny)
                nx, ny = nx / ln, ny / ln
                mx, my = (g[0] + h[0]) / 2 - nx * jeu / 2, (g[1] + h[1]) / 2 - ny * jeu / 2
                cellule = _couper(cellule, (mx, my), (nx, ny))
                if len(cellule) < 3:
                    break
            if len(cellule) < 3:
                continue
            # Retrait sur le bord extérieur aussi, et coins adoucis.
            cx = sum(p[0] for p in cellule) / len(cellule)
            cy = sum(p[1] for p in cellule) / len(cellule)
            cellule = [(cx + (x - cx) * 0.94, cy + (y - cy) * 0.94) for x, y in cellule]
            h = hauteur + epais * rnd.uniform(0.75, 1.15)
            m = mat2 if mat2 and rnd.random() < 0.3 else mat
            self.prisme(m, cellule, hauteur - epais * 0.5, h, biseau=min(0.035, epais * 0.4), segments=2)

    def plateau(self, mat_dessus, mat_flanc, contour, bas, haut, rebord=0.12, biseau=0.05):
        """
        Un plateau de terrain (terrasse, îlot, butte) : un flanc de terre, un
        dessus d'herbe qui déborde un peu en bourrelet — la tranche de gâteau
        des images de référence.
        """
        self.prisme(mat_flanc, contour, bas, haut - rebord * 0.4, biseau=biseau, segments=2)
        cx = sum(p[0] for p in contour) / len(contour)
        cy = sum(p[1] for p in contour) / len(contour)
        dessus = [(cx + (x - cx) * 1.0 + _norme(x - cx, y - cy)[0] * rebord * 0.25,
                   cy + (y - cy) * 1.0 + _norme(x - cx, y - cy)[1] * rebord * 0.25) for x, y in contour]
        self.prisme(mat_dessus, dessus, haut - rebord, haut, biseau=rebord * 0.45, segments=3, lisse=True)


def contour_organique(rayon, graine=0, points=28, ampleur=0.16, lobes=5, aplatir=(1.0, 1.0)):
    """Un contour plan de blob (liste (x, y), sens trigonométrique) : île, terrasse, mare."""
    rnd = random.Random(graine)
    phases = [rnd.uniform(0, 2 * math.pi) for _ in range(3)]
    out = []
    for k in range(points):
        a = 2 * math.pi * k / points
        r = rayon * (1 + ampleur * (0.6 * math.sin(a * lobes + phases[0])
                                    + 0.3 * math.sin(a * (lobes + 2) + phases[1])
                                    + 0.2 * math.sin(a * 2 + phases[2])))
        out.append((math.cos(a) * r * aplatir[0], math.sin(a) * r * aplatir[1]))
    return out


def _norme(x, y):
    n = math.hypot(x, y) or 1.0
    return x / n, y / n


def _dans(poly, p) -> bool:
    x, y = p
    dedans = False
    for i in range(len(poly)):
        x1, y1 = poly[i]
        x2, y2 = poly[(i + 1) % len(poly)]
        if (y1 > y) != (y2 > y) and x < (x2 - x1) * (y - y1) / (y2 - y1) + x1:
            dedans = not dedans
    return dedans


def _couper(poly, point, normale):
    """Sutherland–Hodgman : garde la partie de `poly` du côté opposé à `normale`."""
    px, py = point
    nx, ny = normale

    def cote(q):
        return (q[0] - px) * nx + (q[1] - py) * ny

    out = []
    for i in range(len(poly)):
        a, b = poly[i], poly[(i + 1) % len(poly)]
        da, db = cote(a), cote(b)
        if da <= 0:
            out.append(a)
        if (da <= 0) != (db <= 0):
            t = da / (da - db)
            out.append((a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t))
    return out
