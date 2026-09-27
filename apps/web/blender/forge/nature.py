"""
Le végétal et le minéral : arbres, sapins, buissons, rochers, roseaux, fleurs.

Ce qui fait le « cosy » d'un arbre, c'est son feuillage en **nuage** : une
seule surface douce et bosselée, pas un tas de boules qui se traversent. On
l'obtient en fondant des sphères (remaillage voxel), en lissant, puis en
décimant jusqu'au budget de triangles voulu — voir `fondre()`.
"""

from __future__ import annotations

import math
import random

import bpy  # noqa: I001
import bmesh
from mathutils import Matrix, Vector, noise


def _bm_depuis_objet(obj) -> bmesh.types.BMesh:
    """Le maillage évalué (modificateurs appliqués) d'un objet temporaire."""
    deps = bpy.context.evaluated_depsgraph_get()
    ev = obj.evaluated_get(deps)
    bm = bmesh.new()
    bm.from_mesh(ev.to_mesh())
    ev.to_mesh_clear()
    return bm


class Nature:
    # ------------------------------------------------------------------
    # La fonte : des volumes qui se chevauchent → une seule peau douce
    # ------------------------------------------------------------------

    def fondre(self, mat, boules, voxel=0.08, lissage=4, triangles=900, bosses=0.0,
               graine=0, lisse=True, sol: float | None = None):
        """
        Fond des sphères (`boules` : liste de (centre, rayon) ou
        (centre, (rx, ry, rz))) en une seule surface, lissée puis décimée à
        environ `triangles` triangles. `bosses` ajoute un relief de bruit
        (feuillage qui moutonne), `sol` coupe tout ce qui passe sous cette
        hauteur (buisson assis dans l'herbe).
        """
        bm = bmesh.new()
        for centre, r in boules:
            r3 = r if isinstance(r, (tuple, list)) else (r, r, r)
            tmp = bmesh.new()
            bmesh.ops.create_icosphere(tmp, subdivisions=3, radius=1.0)
            bmesh.ops.scale(tmp, vec=Vector(r3), verts=tmp.verts)
            bmesh.ops.translate(tmp, vec=Vector(centre), verts=tmp.verts)
            me = bpy.data.meshes.new("tmp")
            tmp.to_mesh(me)
            tmp.free()
            bm.from_mesh(me)
            bpy.data.meshes.remove(me)

        me = bpy.data.meshes.new("fonte")
        bm.to_mesh(me)
        bm.free()
        obj = bpy.data.objects.new("fonte", me)
        bpy.context.scene.collection.objects.link(obj)
        rem = obj.modifiers.new("remesh", "REMESH")
        rem.mode = "VOXEL"
        rem.voxel_size = voxel
        rem.adaptivity = 0.0
        if lissage:
            lis = obj.modifiers.new("lissage", "LAPLACIANSMOOTH")
            lis.iterations = lissage
            lis.lambda_factor = 0.8
            lis.use_volume_preserve = True
        bm = _bm_depuis_objet(obj)
        bpy.data.objects.remove(obj)
        bpy.data.meshes.remove(me)

        if bosses > 0:
            decal = Vector((graine * 7.13, graine * 3.71, graine * 1.93))
            for v in bm.verts:
                n = v.normal
                h = noise.noise(v.co * 2.2 + decal) * 0.6 + noise.noise(v.co * 4.5 + decal) * 0.4
                v.co += n * h * bosses

        if sol is not None:
            for v in bm.verts:
                if v.co.z < sol:
                    v.co.z = sol

        bm = self._decimer(bm, triangles)
        self.verser(bm, mat, lisse=lisse)

    def _decimer(self, bm, triangles):
        n = sum(len(f.verts) - 2 for f in bm.faces)
        if n <= triangles:
            return bm
        me = bpy.data.meshes.new("dec")
        bm.to_mesh(me)
        bm.free()
        obj = bpy.data.objects.new("dec", me)
        bpy.context.scene.collection.objects.link(obj)
        dec = obj.modifiers.new("dec", "DECIMATE")
        dec.decimate_type = "COLLAPSE"
        dec.ratio = triangles / n
        out = _bm_depuis_objet(obj)
        bpy.data.objects.remove(obj)
        bpy.data.meshes.remove(me)
        return out

    # ------------------------------------------------------------------
    # Arbres
    # ------------------------------------------------------------------

    def tronc(self, mat, base, hauteur, rayon, graine=0, racines=4, penche=0.08, branches=2,
              cotes=7):
        """Un tronc un peu tordu, évasé au pied, qui se partage en branches."""
        rnd = random.Random(graine)
        bx, by, bz = base
        dx, dy = rnd.uniform(-penche, penche), rnd.uniform(-penche, penche)
        pts, rs = [], []
        pas = 6
        for i in range(pas + 1):
            t = i / pas
            courbe = math.sin(t * math.pi * 0.9) * 0.5
            pts.append((bx + dx * hauteur * courbe, by + dy * hauteur * courbe, bz + hauteur * t))
            evase = 1.0 + 0.55 * max(0.0, 1 - t * 4) ** 2
            rs.append(rayon * (1 - 0.35 * t) * evase)
        self.tube(mat, pts, rs, cotes=cotes)
        # Les racines qui plongent dans l'herbe.
        for k in range(racines):
            a = 2 * math.pi * (k + rnd.uniform(-0.2, 0.2)) / racines
            d = Vector((math.cos(a), math.sin(a), 0))
            p0 = Vector((bx, by, bz + rayon * 0.9))
            p1 = Vector((bx, by, bz)) + d * rayon * 1.7 + Vector((0, 0, 0.02))
            p2 = Vector((bx, by, bz)) + d * rayon * 2.4 + Vector((0, 0, -0.05))
            self.tube(mat, [p0, p1, p2], [rayon * 0.45, rayon * 0.3, rayon * 0.08], cotes=5)
        # Les maîtresses branches, qui partent dans le feuillage.
        haut = Vector(pts[-2])
        for k in range(branches):
            a = 2 * math.pi * (k / max(branches, 1)) + rnd.uniform(-0.5, 0.5)
            d = Vector((math.cos(a), math.sin(a), 0))
            p1 = haut + d * hauteur * 0.18 + Vector((0, 0, hauteur * 0.2))
            p2 = haut + d * hauteur * 0.35 + Vector((0, 0, hauteur * 0.38))
            self.tube(mat, [haut, p1, p2], [rayon * 0.6, rayon * 0.4, rayon * 0.2], cotes=5)
        return Vector(pts[-1])

    def arbre_rond(self, position=(0, 0, 0), hauteur=4.2, envergure=3.2, graine=0,
                   feuillage="feuillage", ecorce="ecorce", triangles=1300):
        """
        Le feuillu « nuage » : un tronc trapu et un houppier de gros lobes
        ronds, bien marqués, en dôme — une couronne de lobes en bas, quelques
        uns au-dessus, une calotte. Le dessous est aplati, comme vu en jeu.
        """
        rnd = random.Random(graine)
        x, y, z = position
        self.empreinte("tronc", (x, y), envergure * 0.16, z, z + hauteur * 0.4)
        self.empreinte("couronne", (x, y), envergure * 0.5, z + hauteur * 0.36, z + hauteur)
        h_tronc = hauteur * 0.36
        self.tronc(ecorce, (x, y, z), h_tronc + hauteur * 0.14, envergure * 0.085, graine, branches=3)
        hh = hauteur - h_tronc
        cz = z + h_tronc + hh * 0.45
        R = envergure / 2
        boules = [((x, y, cz), (R * 0.7, R * 0.7, hh * 0.36))]
        couronne = rnd.randint(5, 6)
        for k in range(couronne):
            a = 2 * math.pi * k / couronne + rnd.uniform(-0.25, 0.25)
            d = R * rnd.uniform(0.52, 0.62)
            r = R * rnd.uniform(0.4, 0.5)
            boules.append(((x + math.cos(a) * d, y + math.sin(a) * d, cz - hh * 0.08 + rnd.uniform(-0.05, 0.1) * hh), r))
        for k in range(3):
            a = 2 * math.pi * k / 3 + rnd.uniform(0, 2)
            d = R * rnd.uniform(0.2, 0.35)
            boules.append(((x + math.cos(a) * d, y + math.sin(a) * d, cz + hh * rnd.uniform(0.2, 0.3)),
                           R * rnd.uniform(0.42, 0.5)))
        self.fondre(feuillage, boules, voxel=envergure / 34, lissage=2, triangles=triangles,
                    bosses=envergure * 0.012, graine=graine, sol=z + h_tronc + hh * 0.08)

    def sapin(self, position=(0, 0, 0), hauteur=5.0, largeur=2.2, etages=4, graine=0,
              mat="sapin", ecorce="ecorce", cotes=9):
        """Un sapin en étages de jupes dentelées, chacune retombant sur la suivante."""
        rnd = random.Random(graine)
        x, y, z = position
        self.empreinte("tronc", (x, y), largeur * 0.12, z, z + hauteur * 0.3)
        self.empreinte("couronne", (x, y), largeur * 0.5, z + hauteur * 0.14, z + hauteur)
        self.cylindre(ecorce, largeur * 0.08, z, z + hauteur * 0.3, centre=(x, y), cotes=7,
                      rayon_haut=largeur * 0.06)
        base = z + hauteur * 0.14
        pas = (hauteur - hauteur * 0.14) / (etages + 0.4)
        for k in range(etages):
            t = k / max(etages - 1, 1)
            r = largeur / 2 * (1 - 0.62 * t)
            z0 = base + k * pas * 0.92
            h = pas * 1.65
            tw = rnd.uniform(0, math.pi)
            bm = bmesh.new()
            # Une jupe : un anneau dentelé en bas, qui retombe, puis la pointe.
            bas, mi = [], []
            for i in range(cotes * 2):
                a = tw + math.pi * i / cotes
                rr = r * (1.0 if i % 2 == 0 else 0.78)
                zz = z0 - (0.12 * r if i % 2 == 0 else 0.0)
                bas.append(bm.verts.new((x + math.cos(a) * rr, y + math.sin(a) * rr, zz)))
                mi.append(bm.verts.new((x + math.cos(a) * rr * 0.62, y + math.sin(a) * rr * 0.62,
                                        z0 + h * 0.38)))
            dessous = bm.verts.new((x, y, z0 + h * 0.08))
            pointe = bm.verts.new((x, y, z0 + h))
            n = len(bas)
            for i in range(n):
                j = (i + 1) % n
                bm.faces.new((bas[i], bas[j], mi[j], mi[i]))
                bm.faces.new((mi[i], mi[j], pointe))
                bm.faces.new((bas[j], bas[i], dessous))
            self.verser(bm, mat, lisse=False)

    def buisson(self, position=(0, 0, 0), taille=0.9, graine=0, mat="feuillage-sombre",
                fleurs: str | None = None, nb_fleurs=14, triangles=500):
        """Un buisson rond assis dans l'herbe, fleuri si `fleurs` nomme une matière."""
        rnd = random.Random(graine)
        x, y, z = position
        self.empreinte("buisson", (x, y), taille * 0.62, z, z + taille * 0.9)
        boules = [((x, y, z + taille * 0.42), (taille * 0.62, taille * 0.58, taille * 0.5))]
        lobes = rnd.randint(4, 6)
        for k in range(lobes):
            a = 2 * math.pi * k / lobes + rnd.uniform(-0.3, 0.3)
            d = taille * rnd.uniform(0.3, 0.42)
            boules.append(((x + math.cos(a) * d, y + math.sin(a) * d, z + taille * rnd.uniform(0.3, 0.6)),
                           taille * rnd.uniform(0.3, 0.42)))
        self.fondre(mat, boules, voxel=taille / 22, lissage=2, triangles=triangles,
                    bosses=taille * 0.02, graine=graine, sol=z)
        if fleurs:
            for k in range(nb_fleurs):
                # Des fleurs piquées dans la moitié haute, un peu en saillie.
                a = rnd.uniform(0, 2 * math.pi)
                el = rnd.uniform(0.15, 1.2)
                d = Vector((math.cos(a) * math.cos(el), math.sin(a) * math.cos(el), math.sin(el)))
                p = Vector((x, y, z + taille * 0.42)) + Vector((d.x * taille * 0.66, d.y * taille * 0.62,
                                                                 d.z * taille * 0.5))
                self.boule(fleurs, p, taille * rnd.uniform(0.05, 0.075), finesse=1, graine=k)

    def rocher(self, position=(0, 0, 0), taille=(0.8, 0.6, 0.45), graine=0, mat="pierre",
               rot_z=0.0, facettes=False, mousse=False):
        """Une pierre posée : bosselée, aplatie dessous ; douce, ou à facettes franches."""
        x, y, z = position
        self.empreinte("rocher", (x, y), max(taille[0], taille[1]) * 0.95, z, z + taille[2] * 1.2)
        with self.repere((x, y, z + taille[2] * 0.3), rot_z=rot_z):
            self.boule(mat, (0, 0, 0), taille, finesse=2 if facettes else 3, bosses=0.3, graine=graine,
                       lisse=not facettes, aplatir_bas=-0.55)
            if mousse:
                # Une calotte de mousse sur le dessus, décalée vers l'ombre.
                self.boule("mousse", (taille[0] * 0.08, taille[1] * 0.12, taille[2] * 0.9),
                           (taille[0] * 0.55, taille[1] * 0.5, taille[2] * 0.22), finesse=2, bosses=0.3,
                           graine=graine + 3)

    # ------------------------------------------------------------------
    # Herbes et fleurs
    # ------------------------------------------------------------------

    def lame(self, mat, base, direction, cote, longueur, largeur, courbe=0.0, profil=None, pas=4,
             lisse=True):
        """Une lame fine : pétale, feuille, brin d'herbe, feuille de roseau."""
        base, direction, cote = Vector(base), Vector(direction).normalized(), Vector(cote).normalized()
        bas = direction.cross(cote).normalized()
        profil = profil or (lambda t: math.sin(math.pi * min(1.0, 0.15 + t * 0.85)))
        bm = bmesh.new()
        rangs = []
        for i in range(pas + 1):
            t = i / pas
            c = base + direction * (longueur * t) + bas * (courbe * t * t)
            w = largeur * 0.5 * profil(t)
            rangs.append((bm.verts.new(c - cote * w), bm.verts.new(c + cote * w)))
        for i in range(pas):
            bm.faces.new((rangs[i][0], rangs[i][1], rangs[i + 1][1], rangs[i + 1][0]))
        self.verser(bm, mat, lisse=lisse)

    def touffe(self, position, graine=0, brins=9, hauteur=0.28, mat="brin"):
        """Une touffe d'herbe : des brins qui partent en gerbe et ploient."""
        rnd = random.Random(graine)
        x, y, z = position
        for _ in range(brins):
            a = rnd.uniform(0, 2 * math.pi)
            inc = rnd.uniform(0.15, 0.55)
            d = Vector((math.cos(a) * inc, math.sin(a) * inc, 1.0))
            cote = Vector((-math.sin(a), math.cos(a), 0))
            self.lame(mat, (x + math.cos(a) * 0.02, y + math.sin(a) * 0.02, z), d, cote,
                      hauteur * rnd.uniform(0.6, 1.1), 0.035, courbe=rnd.uniform(0.02, 0.08),
                      profil=lambda t: 1 - t, pas=3)

    def roseaux(self, position, graine=0, tiges=6, hauteur=1.1):
        """Une touffe de massettes (quenouilles) : feuilles en lames, épis bruns."""
        rnd = random.Random(graine)
        x, y, z = position
        for k in range(tiges):
            a = rnd.uniform(0, 2 * math.pi)
            r = rnd.uniform(0, 0.08)
            px, py = x + math.cos(a) * r, y + math.sin(a) * r
            h = hauteur * rnd.uniform(0.75, 1.1)
            lean = Vector((rnd.uniform(-0.08, 0.08), rnd.uniform(-0.08, 0.08), 0))
            haut = Vector((px, py, z + h)) + lean
            self.tube("roseau", [(px, py, z), Vector((px, py, z + h * 0.6)) + lean * 0.4, haut],
                      [0.012, 0.01, 0.008], cotes=4)
            if k % 2 == 0 or k < 3:
                self.tube("massette", [haut - Vector((0, 0, h * 0.22)), haut - Vector((0, 0, h * 0.2)),
                                       haut - Vector((0, 0, 0.03)), haut - Vector((0, 0, 0.01))],
                          [0.001, 0.032, 0.032, 0.001], cotes=6)
                self.tube("roseau", [haut, haut + Vector((0, 0, 0.08))], [0.006, 0.002], cotes=3)
        for k in range(tiges + 2):
            a = rnd.uniform(0, 2 * math.pi)
            d = Vector((math.cos(a) * 0.3, math.sin(a) * 0.3, 1.0))
            self.lame("roseau", (x, y, z), d, Vector((-math.sin(a), math.cos(a), 0)),
                      hauteur * rnd.uniform(0.5, 0.85), 0.05, courbe=0.12, profil=lambda t: 1 - t * 0.9, pas=4)

    def fleur(self, position, espece="coquelicot", graine=0, hauteur=0.35):
        """Une fleur des champs sur sa tige : coquelicot, marguerite, bleuet."""
        rnd = random.Random(graine)
        x, y, z = position
        h = hauteur * rnd.uniform(0.75, 1.15)
        tete = Vector((x + rnd.uniform(-0.04, 0.04), y + rnd.uniform(-0.04, 0.04), z + h))
        self.tube("brin", [(x, y, z), ((x + tete.x) / 2, (y + tete.y) / 2, z + h * 0.5), tete], 0.008, cotes=4,
                  fermer=False)
        petales = {"coquelicot": 4, "marguerite": 9}.get(espece, 6)
        mat = {"bleuet": "peinture-bleue"}.get(espece, espece)
        long = 0.05 if espece == "coquelicot" else 0.04
        for k in range(petales):
            a = 2 * math.pi * k / petales + rnd.uniform(0, 0.3)
            d = Vector((math.cos(a), math.sin(a), 0.35 if espece == "coquelicot" else 0.1))
            self.lame(mat, tete, d, Vector((-math.sin(a), math.cos(a), 0)), long,
                      long * (1.1 if espece == "coquelicot" else 0.45), courbe=-0.01, pas=2)
        self.boule("coeur-fleur" if espece != "coquelicot" else "ombre", tete + Vector((0, 0, 0.004)),
                   0.012, finesse=1)

    def lavande(self, position, graine=0, tiges=42, hauteur=0.62):
        """
        Un pied de lavande : une touffe de feuilles fines gris-vert au pied,
        des tiges arquées en gerbe, et des épis violets en grappe dense —
        c'est la masse violette qui se lit de loin, pas le feuillage.
        """
        rnd = random.Random(graine)
        x, y, z = position
        self.empreinte("lavande", (x, y), hauteur * 0.32, z, z + hauteur)
        for _ in range(14):
            a = rnd.uniform(0, 2 * math.pi)
            d = Vector((math.cos(a) * 0.5, math.sin(a) * 0.5, 1.0))
            self.lame("feuillage-sombre", (x, y, z), d, (-math.sin(a), math.cos(a), 0),
                      rnd.uniform(0.12, 0.2), 0.03, courbe=0.03, profil=lambda t: 1 - t * 0.8, pas=2)
        for _ in range(tiges):
            a = rnd.uniform(0, 2 * math.pi)
            inc = rnd.uniform(0.15, 0.62)
            h = hauteur * rnd.uniform(0.7, 1.1)
            # Des pieds dispersés : des tiges parties du même point auraient des
            # faces confondues (et scintilleraient).
            r0 = rnd.uniform(0.01, 0.07)
            pied = (x + math.cos(a) * r0, y + math.sin(a) * r0, z + rnd.uniform(0.0, 0.05))
            bout = Vector((x + math.cos(a) * inc * h, y + math.sin(a) * inc * h, z + h))
            mi = Vector((x + math.cos(a) * inc * h * 0.3, y + math.sin(a) * inc * h * 0.3, z + h * 0.6))
            self.tube("brin", [pied, mi, bout], 0.005, cotes=3, fermer=False)
            d = (bout - mi).normalized()
            self.tube("lavande", [bout - d * 0.01, bout + d * 0.03, bout + d * 0.12, bout + d * 0.15],
                      [0.001, 0.024, 0.018, 0.001], cotes=5)
