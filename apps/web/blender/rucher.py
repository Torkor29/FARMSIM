"""
Le rucher du village, modélisé dans Blender.

Les versions dessinées en code — pavés, puis caisses, puis ruches en paille —
se lisaient comme des jouets. Celle-ci est modélisée comme on modélise un
décor : des ruches Dadant en bois peint (corps, hausse, poignées, trou de
vol, toit en tôle galvanisée lesté d'une pierre) sur parpaings et rails, des
pieds de lavande aux tiges arquées et aux épis en verticilles, des
tournesols, des fleurs des champs et des touffes d'herbe.

Tout est construit par script, donc reproductible et retouchable :

    python -m venv env && env/bin/pip install bpy==4.2.0
    env/bin/python apps/web/blender/rucher.py

Le fichier `apps/web/public/assets/decor3d/rucher.glb` est réécrit, puis
compressé par `gltf-transform meshopt` (Node requis : 1,3 Mo → 320 Ko ; le jeu
décode avec le `MeshoptDecoder` de three). Chaque
matière n'y forme qu'un maillage : une quinzaine d'appels de rendu pour tout
le rucher. On modélise en mètres réels, puis on met à l'échelle du jeu
(`ECHELLE`) : l'emprise d'un décor y est de six unités.

Repère : Blender est en Z vers le haut ; l'export glTF passe en Y vers le
haut, et le −Y de Blender devient le +Z du jeu — le côté de la caméra. Les
ruches ont donc leur entrée vers −Y.
"""

import math
import os
import random
import subprocess
import sys

import bpy  # noqa: I001 — bpy d'abord : il installe bmesh et mathutils
import bmesh
from mathutils import Matrix, Vector

ICI = os.path.dirname(os.path.abspath(__file__))
SORTIE = os.path.join(ICI, "..", "public", "assets", "decor3d", "rucher.glb")
ECHELLE = 1.7
ALEA = random.Random(1789)


# --------------------------------------------------------------------------
# Matières
# --------------------------------------------------------------------------

def lineaire(hexa: int) -> tuple:
    """sRGB → linéaire : Blender et glTF travaillent en linéaire."""

    def canal(c: float) -> float:
        return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4

    r, g, b = (hexa >> 16) & 255, (hexa >> 8) & 255, hexa & 255
    return (canal(r / 255), canal(g / 255), canal(b / 255), 1.0)


MATIERES: dict = {}
MORCEAUX: dict = {}


def matiere(nom: str, hexa: int, rugosite=0.8, metal=0.0, deux_faces=False):
    if nom in MATIERES:
        return nom
    m = bpy.data.materials.new(nom)
    m.use_nodes = True
    bsdf = m.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = lineaire(hexa)
    bsdf.inputs["Roughness"].default_value = rugosite
    bsdf.inputs["Metallic"].default_value = metal
    # Une face qu'on ne voit que d'un côté se dessine une fois : seules les
    # lames fines (pétales, feuilles, brins) ont besoin des deux faces.
    m.use_backface_culling = not deux_faces
    MATIERES[nom] = m
    return nom


def verser(bm: bmesh.types.BMesh, nom: str, lisse=False, m: Matrix | None = None):
    """Ajoute un morceau au maillage de sa matière, puis libère le morceau."""
    if m is not None:
        bmesh.ops.transform(bm, matrix=m, verts=bm.verts)
    for f in bm.faces:
        f.smooth = lisse
    temp = bpy.data.meshes.new("temp")
    bm.to_mesh(temp)
    bm.free()
    cible = MORCEAUX.setdefault(nom, bmesh.new())
    cible.from_mesh(temp)
    bpy.data.meshes.remove(temp)


# --------------------------------------------------------------------------
# Formes
# --------------------------------------------------------------------------

def boite(nom, taille, centre, rot_z=0.0, biseau=0.006, pivot=(0.0, 0.0)):
    """Un pavé biseauté : l'arête arrondie accroche la lumière comme du bois."""
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, vec=Vector(taille), verts=bm.verts)
    if biseau > 0:
        bmesh.ops.bevel(
            bm, geom=list(bm.edges), offset=min(biseau, min(taille) * 0.45),
            segments=2, profile=0.5, affect="EDGES",
        )
    m = (
        Matrix.Translation(Vector((pivot[0], pivot[1], 0)))
        @ Matrix.Rotation(rot_z, 4, "Z")
        @ Matrix.Translation(Vector(centre) - Vector((pivot[0], pivot[1], 0)))
    )
    verser(bm, nom, m=m)


def tube(nom, points, rayons, cotes=5, lisse=True, fermer=True):
    """Un tube le long d'une polyligne : tiges, épis, tronc de tournesol."""
    bm = bmesh.new()
    anneaux = []
    n = len(points)
    for i, (p, r) in enumerate(zip(points, rayons)):
        p = Vector(p)
        avant = Vector(points[min(i + 1, n - 1)]) - Vector(points[max(i - 1, 0)])
        avant.normalize()
        a = Vector((0, 0, 1)) if abs(avant.z) < 0.95 else Vector((1, 0, 0))
        u = avant.cross(a).normalized()
        v = avant.cross(u).normalized()
        anneau = []
        for k in range(cotes):
            t = 2 * math.pi * k / cotes
            anneau.append(bm.verts.new(p + (u * math.cos(t) + v * math.sin(t)) * r))
        anneaux.append(anneau)
    for i in range(n - 1):
        for k in range(cotes):
            a, b = anneaux[i][k], anneaux[i][(k + 1) % cotes]
            c, d = anneaux[i + 1][(k + 1) % cotes], anneaux[i + 1][k]
            bm.faces.new((a, b, c, d))
    if fermer:
        bout = bm.verts.new(Vector(points[-1]) + (Vector(points[-1]) - Vector(points[-2])).normalized() * rayons[-1])
        for k in range(cotes):
            bm.faces.new((anneaux[-1][k], anneaux[-1][(k + 1) % cotes], bout))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    verser(bm, nom, lisse=lisse)


def lame(nom, base, direction, cote, longueur, largeur, courbe=0.0, profil=None, pas=4, lisse=True):
    """
    Une lame fine : pétale, feuille, brin d'herbe.

    `direction` porte la longueur, `cote` la largeur ; `courbe` fait ployer la
    pointe vers le bas (feuille, brin) ou la creuse en coupe (pétale).
    """
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
    verser(bm, nom, lisse=lisse)


def caillou(nom, centre, taille, graine, finesse=2):
    """Une pierre irrégulière : une icosphère bosselée, aplatie, lissée."""
    rnd = random.Random(graine)
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=finesse, radius=1.0)
    bosses = [Vector((rnd.uniform(-1, 1), rnd.uniform(-1, 1), rnd.uniform(-1, 1))).normalized() for _ in range(4)]
    for v in bm.verts:
        n = v.co.normalized()
        v.co *= 0.9 + sum(max(0.0, n.dot(b)) ** 3 for b in bosses) * 0.18
        if v.co.z < -0.3:
            v.co.z = -0.3 - (v.co.z + 0.3) * 0.2
    bmesh.ops.scale(bm, vec=Vector(taille), verts=bm.verts)
    bmesh.ops.translate(bm, vec=Vector(centre), verts=bm.verts)
    verser(bm, nom, lisse=True)


# --------------------------------------------------------------------------
# La ruche Dadant
# --------------------------------------------------------------------------

PEINTURES = [0x7aa6c9, 0xe6c56c, 0x93b487, 0xefe8d8, 0xd98f6a]


def ruche(x, y, rot, peinture, hausses, pierre, graine):
    rnd = random.Random(graine)
    corps = matiere(f"peinture-{peinture:06x}", peinture, 0.62)
    bois = matiere("bois-brut", 0x8a6a45, 0.85)
    beton = matiere("parpaing", 0x9d9a94, 0.95)
    sombre = matiere("ombre", 0x1b140e, 1.0)
    tole = matiere("tole", 0xb4bcc1, 0.38, 0.65)
    roche = matiere("pierre", 0x8c877f, 0.95)
    p = (x, y)

    def b(nom, taille, centre, biseau=0.006):
        boite(nom, taille, (x + centre[0], y + centre[1], centre[2]), rot, biseau, pivot=p)

    # Deux parpaings creux, deux rails.
    for sx in (-0.17, 0.17):
        b(beton, (0.19, 0.39, 0.19), (sx, 0, 0.095), 0.01)
        for sy in (-0.09, 0.09):
            b(sombre, (0.12, 0.12, 0.004), (sx, sy, 0.1905), 0)
        b(bois, (0.06, 0.64, 0.055), (sx, 0, 0.218), 0.004)
    # Le plateau, et la planche d'envol qui dépasse devant.
    b(bois, (0.5, 0.56, 0.028), (0, -0.03, 0.26))
    b(bois, (0.44, 0.09, 0.016), (0, -0.33, 0.252), 0.003)
    # Le corps.
    z = 0.274
    h = 0.31
    b(corps, (0.5, 0.5, h), (0, 0, z + h / 2))
    # Le trou de vol, et la grille d'entrée en tôle.
    b(sombre, (0.3, 0.012, 0.016), (0, -0.2505, z + 0.012), 0)
    b(tole, (0.34, 0.006, 0.012), (0, -0.2545, z + 0.028), 0.002)
    # Les poignées creusées sur les flancs.
    for sx in (-0.2505, 0.2505):
        b(sombre, (0.004, 0.13, 0.032), (sx, 0, z + h * 0.62), 0)
    z += h
    # Les hausses, d'une autre couleur parfois : on les rachète au fil des ans.
    for i in range(hausses):
        hh = 0.17
        teinte = corps if rnd.random() < 0.6 else matiere("bois-clair", 0xc9a877, 0.7)
        b(sombre, (0.49, 0.49, 0.006), (0, 0, z + 0.003), 0)
        z += 0.005
        b(teinte, (0.5, 0.5, hh), (0, 0, z + hh / 2))
        for sx in (-0.2505, 0.2505):
            b(sombre, (0.004, 0.11, 0.026), (sx, 0, z + hh * 0.6), 0)
        z += hh
    # Le toit en tôle, qui coiffe la dernière hausse.
    b(tole, (0.57, 0.57, 0.085), (0, 0, z + 0.0425 - 0.035), 0.008)
    z += 0.05
    if pierre:
        c = Matrix.Translation(Vector((*p, 0))) @ Matrix.Rotation(rot, 4, "Z") @ Matrix.Translation(-Vector((*p, 0)))
        centre = c @ Vector((x + rnd.uniform(-0.08, 0.08), y + rnd.uniform(-0.08, 0.05), z + 0.04))
        caillou(roche, centre, (0.12, 0.09, 0.05), graine)


# --------------------------------------------------------------------------
# La lavande
# --------------------------------------------------------------------------

def lavande(cx, cy, graine, tiges=70):
    """
    Un pied de lavande : une touffe grise d'où partent des dizaines de tiges
    droites qui s'ouvrent en éventail. Leurs épis dessinent un dôme violet —
    c'est ce dôme, plus que chaque épi, qu'on reconnaît de loin.
    """
    rnd = random.Random(graine)
    feuillage = matiere("lavande-feuillage", 0x7b9170, 0.9)
    tige = matiere("lavande-tige", 0x86996a, 0.85)
    epis = [matiere("lavande-a", 0x7453b3, 0.7), matiere("lavande-b", 0x8a69c8, 0.7)]
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=2, radius=1.0)
    for v in bm.verts:
        v.co *= 0.88 + rnd.random() * 0.24
    bmesh.ops.scale(bm, vec=Vector((0.36, 0.36, 0.22)), verts=bm.verts)
    bmesh.ops.translate(bm, vec=Vector((cx, cy, 0.1)), verts=bm.verts)
    verser(bm, feuillage, lisse=True)
    for i in range(tiges):
        # Directions réparties sur une calotte : le nombre d'or évite les trous.
        u = (i + 0.5) / tiges
        theta = math.acos(1 - u * (1 - math.cos(math.radians(62))))
        phi = i * 2.39996 + rnd.uniform(-0.2, 0.2)
        d = Vector((math.sin(theta) * math.cos(phi), math.sin(theta) * math.sin(phi), math.cos(theta)))
        base = Vector((cx, cy, 0.14)) + Vector((d.x, d.y, 0)) * 0.06
        long = rnd.uniform(0.3, 0.38)
        pts = [base + d * (long * k / 3) + Vector((0, 0, -0.02 * (k / 3) ** 2 * math.sin(theta))) for k in range(4)]
        tube(tige, pts, [0.005, 0.0042, 0.0035, 0.003], cotes=3, fermer=False)
        sens = (pts[-1] - pts[-2]).normalized()
        le = rnd.uniform(0.08, 0.11)
        epi = [pts[-1] + sens * (le * k / 4) for k in range(5)]
        tube(rnd.choice(epis), epi, [0.015, 0.019, 0.016, 0.014, 0.006], cotes=4)


# --------------------------------------------------------------------------
# Le tournesol
# --------------------------------------------------------------------------

def tournesol(x, y, hauteur, graine):
    rnd = random.Random(graine)
    vert = matiere("tournesol-vert", 0x55802f, 0.75, deux_faces=True)
    jaune = matiere("tournesol-petale", 0xf2bd1a, 0.6, deux_faces=True)
    coeur = matiere("tournesol-coeur", 0x4a2d14, 0.95)
    # La tige, un peu arquée vers la lumière.
    pts = [Vector((x + 0.03 * math.sin(t * 2.2), y - 0.04 * t * t, hauteur * t)) for t in (i / 9 for i in range(10))]
    tube(vert, pts, [0.02 - 0.008 * i / 9 for i in range(10)], cotes=6)
    # Les feuilles, alternes, qui retombent.
    for i in range(5):
        t = 0.25 + i * 0.13
        a = i * 2.4 + rnd.uniform(-0.3, 0.3)
        base = Vector((x, y, hauteur * t))
        d = Vector((math.cos(a), math.sin(a), 0.55))
        lame(vert, base, d, Vector((-math.sin(a), math.cos(a), 0)), 0.2 - i * 0.015, 0.15 - i * 0.012, courbe=0.08,
             profil=lambda t: math.sin(math.pi * min(1.0, 0.1 + t * 0.9)) ** 0.8, pas=5)
    # La fleur, tournée vers la caméra et un peu vers le ciel.
    sommet = pts[-1]
    face = Vector((0.55, -0.62, 0.45)).normalized()
    rot = face.to_track_quat("Z", "Y").to_matrix().to_4x4()
    pose = Matrix.Translation(sommet + face * 0.02) @ rot
    # Le cœur : un disque bombé.
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=True, segments=20, radius1=0.1, radius2=0.085, depth=0.03)
    for v in bm.verts:
        if v.co.z > 0 and v.co.xy.length < 0.01:
            v.co.z += 0.012
    verser(bm, coeur, m=pose)
    # Deux couronnes de pétales, légèrement creusées.
    for couronne, (n, long, decal) in enumerate(((20, 0.09, 0.0), (18, 0.075, 0.08))):
        for k in range(n):
            a = 2 * math.pi * (k + decal * n) / n + rnd.uniform(-0.05, 0.05)
            d = Vector((math.cos(a), math.sin(a), -0.08 - couronne * 0.12))
            base = Vector((math.cos(a) * 0.092, math.sin(a) * 0.092, 0.004 - couronne * 0.004))
            lame(jaune, pose @ base, (pose.to_3x3() @ d), pose.to_3x3() @ Vector((-math.sin(a), math.cos(a), 0)),
                 long, 0.03, courbe=-0.01, pas=3)
    # Les sépales verts derrière la fleur.
    for k in range(14):
        a = 2 * math.pi * k / 14
        base = Vector((math.cos(a) * 0.08, math.sin(a) * 0.08, -0.018))
        lame(vert, pose @ base, pose.to_3x3() @ Vector((math.cos(a), math.sin(a), -0.5)),
             pose.to_3x3() @ Vector((-math.sin(a), math.cos(a), 0)), 0.05, 0.028, pas=2)


# --------------------------------------------------------------------------
# Les fleurs des champs et l'herbe
# --------------------------------------------------------------------------

def fleur(x, y, espece, graine):
    rnd = random.Random(graine)
    tige = matiere("fleur-tige", 0x6d9443, 0.8)
    h = rnd.uniform(0.28, 0.45)
    pts = [Vector((x + 0.02 * math.sin(t * 3 + graine), y, h * t)) for t in (i / 3 for i in range(4))]
    tube(tige, pts, [0.006, 0.005, 0.0045, 0.004], cotes=3, fermer=False)
    haut = pts[-1]
    if espece == "coquelicot":
        rouge = matiere("coquelicot", 0xcf2f1c, 0.55, deux_faces=True)
        noir = matiere("coquelicot-coeur", 0x221815, 0.9)
        for k in range(4):
            a = k * math.pi / 2 + rnd.uniform(-0.2, 0.2)
            lame(rouge, haut, Vector((math.cos(a), math.sin(a), 0.55)), Vector((-math.sin(a), math.cos(a), 0)),
                 0.06, 0.075, courbe=-0.016, profil=lambda t: math.sin(math.pi * min(1.0, 0.25 + t * 0.7)) ** 0.5, pas=3)
        caillou(noir, haut + Vector((0, 0, 0.01)), (0.01, 0.01, 0.012), graine)
    elif espece == "bleuet":
        bleu = matiere("bleuet", 0x3f63c8, 0.6, deux_faces=True)
        for k in range(9):
            a = 2 * math.pi * k / 9
            lame(bleu, haut, Vector((math.cos(a), math.sin(a), 0.7)), Vector((-math.sin(a), math.cos(a), 0)),
                 0.04, 0.02, pas=2)
    else:
        blanc = matiere("marguerite", 0xf6f3ea, 0.6, deux_faces=True)
        jaune = matiere("marguerite-coeur", 0xf0b81c, 0.7)
        for k in range(14):
            a = 2 * math.pi * k / 14
            lame(blanc, haut, Vector((math.cos(a), math.sin(a), 0.12)), Vector((-math.sin(a), math.cos(a), 0)),
                 0.05, 0.016, courbe=0.004, pas=2)
        caillou(jaune, haut + Vector((0, 0, 0.004)), (0.014, 0.014, 0.008), graine)


def touffe(x, y, graine, brins=9):
    rnd = random.Random(graine)
    verts = [matiere("herbe-a", 0x6f9a3c, 0.9, deux_faces=True), matiere("herbe-b", 0x86ac4a, 0.9, deux_faces=True)]
    for _ in range(brins):
        a = rnd.uniform(0, 2 * math.pi)
        d = Vector((math.cos(a) * rnd.uniform(0.2, 0.5), math.sin(a) * rnd.uniform(0.2, 0.5), 1))
        lame(rnd.choice(verts), (x + math.cos(a) * 0.02, y + math.sin(a) * 0.02, 0), d,
             Vector((-math.sin(a), math.cos(a), 0)), rnd.uniform(0.14, 0.28), 0.018, courbe=0.05,
             profil=lambda t: 1 - t, pas=3)


# --------------------------------------------------------------------------
# Le rucher
# --------------------------------------------------------------------------

def construire():
    bpy.ops.wm.read_factory_settings(use_empty=True)

    # Le sol du rucher, fauché : un peu plus sombre que le pré.
    sol = matiere("sol-fauche", 0x6a8f3d, 0.95)
    bm = bmesh.new()
    pts = []
    for k in range(24):
        a = 2 * math.pi * k / 24
        r = 1.05 + 0.12 * math.sin(a * 3) + ALEA.uniform(-0.05, 0.05)
        pts.append(bm.verts.new((math.cos(a) * r * 1.35, 0.25 + math.sin(a) * r * 0.75, 0.008)))
    bm.faces.new(pts)
    verser(bm, sol)

    # Quatre ruches en arc, de couleurs dépareillées.
    for i, x in enumerate((-1.2, -0.4, 0.4, 1.2)):
        y = 0.3 + 0.08 * abs(x)
        ruche(x, y, ALEA.uniform(-0.1, 0.1) - x * 0.06, PEINTURES[i], hausses=1 + (i % 3 == 0),
              pierre=i != 2, graine=100 + i)

    # La lavande, derrière.
    for k in range(4):
        lavande(-1.25 + k * 0.82, 1.2, 200 + k)
    for k in range(3):
        lavande(-0.85 + k * 0.82, 1.62, 300 + k)

    # Trois tournesols au bout du rang.
    for k, (x, y, h) in enumerate(((1.55, 1.15, 1.55), (1.7, 0.75, 1.4), (1.5, 1.52, 1.65))):
        tournesol(x, y, h, 400 + k)

    # Les fleurs des champs en massifs, avec leur herbe, devant et sur les
    # bords — le coin de la pancarte (côté caméra, à gauche) reste dégagé.
    massifs = [(-1.55, 0.2), (-1.2, -0.45), (-0.45, -0.55), (0.35, -0.75), (1.1, -0.55),
               (1.6, 0.15), (-0.2, -1.25), (0.85, -1.3), (1.55, -1.1), (-1.7, 1.2)]
    especes = ("coquelicot", "coquelicot", "bleuet", "marguerite")
    for m, (mx, my) in enumerate(massifs):
        rnd = random.Random(500 + m)
        for k in range(7):
            a = rnd.uniform(0, 2 * math.pi)
            r = rnd.uniform(0, 0.2)
            fleur(mx + math.cos(a) * r, my + math.sin(a) * r, especes[(k + m) % 4], 500 + m * 10 + k)
        for k in range(4):
            a = rnd.uniform(0, 2 * math.pi)
            r = rnd.uniform(0, 0.24)
            touffe(mx + math.cos(a) * r, my + math.sin(a) * r, 700 + m * 10 + k, brins=12)
    # Quelques touffes isolées, et au pied des parpaings.
    for k in range(14):
        x = ALEA.uniform(-1.7, 1.7)
        y = ALEA.uniform(-1.5, 1.8)
        if x < -0.8 and y < -0.8:
            continue
        touffe(x, y, 800 + k)
    for x in (-1.2, -0.4, 0.4, 1.2):
        for dx in (-0.3, 0.3):
            touffe(x + dx, 0.1 + 0.08 * abs(x), 900 + int(x * 10 + dx * 100))

    # Un maillage par matière, mis à l'échelle du jeu.
    echelle = Matrix.Scale(ECHELLE, 4)
    triangles = 0
    for nom, bm in MORCEAUX.items():
        if not bm.faces:
            bm.free()
            continue
        bmesh.ops.transform(bm, matrix=echelle, verts=bm.verts)
        maillage = bpy.data.meshes.new(nom)
        bm.to_mesh(maillage)
        bm.free()
        maillage.materials.append(MATIERES[nom])
        triangles += sum(len(p.vertices) - 2 for p in maillage.polygons)
        objet = bpy.data.objects.new(nom, maillage)
        bpy.context.scene.collection.objects.link(objet)

    os.makedirs(os.path.dirname(SORTIE), exist_ok=True)
    brut = SORTIE.replace(".glb", ".brut.glb")
    bpy.ops.export_scene.gltf(
        filepath=brut,
        export_format="GLB",
        export_yup=True,
        export_apply=True,
        export_texcoords=False,
        export_normals=True,
        export_materials="EXPORT",
        export_cameras=False,
        export_lights=False,
    )
    # Quantification et compression meshopt : le quart du poids, sans perte
    # visible à l'échelle du jeu.
    subprocess.run(["npx", "-y", "@gltf-transform/cli@4", "meshopt", brut, SORTIE], check=True)
    os.remove(brut)
    print(f"rucher.glb : {len(MORCEAUX)} matières, {triangles} triangles, "
          f"{os.path.getsize(SORTIE) / 1024:.0f} Ko", file=sys.stderr)


if __name__ == "__main__":
    construire()
