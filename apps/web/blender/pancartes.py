"""
Les pancartes du jeu, modélisées dans Blender.

Elles étaient des images plates posées sur des bâtons carrés : une texture de
canevas collée sur un quad, lisible mais « moche ». Chacune devient ici un
objet : un panneau épais aux bords arrondis, des lettres en relief dans la
police du jeu (Baloo 2, graisse 800), et ce qui le tient — poteau, potence,
chaînes, montants, socle.

    python -m venv env && env/bin/pip install bpy==4.2.0
    env/bin/python apps/web/blender/pancartes.py

Sortie : `apps/web/public/assets/decor3d/pancartes.glb`, compressé en meshopt
(Node requis). Il contient un nœud par pancarte, chacun à l'origine, que le
jeu va chercher par son nom :

- `pancarte-vente`        le « À VENDRE » des parcelles (poteau à x = −1,05) ;
- `enseigne-rucher`       la pancarte du rucher (panneau centré, y = 1) ;
- `enseigne-cooperative`  le totem de la coopérative (panneau à y = 1,95) ;
- `enseigne-concession`   le caisson posé sur le toit de la concession ;
- `plaque-mairie`         la plaque émaillée de la façade (dos à l'origine).

Les dimensions sont celles du jeu, en unités du jeu. Repère : Blender est en
Z vers le haut, et l'export glTF fait du −Y de Blender le +Z du jeu : les
pancartes regardent vers −Y. La police est `polices/baloo2-800.ttf`, tirée du
`baloo2-latin.woff2` du jeu : fontTools, instance wght = 800, **contours
fusionnés** (`OverlapMode.REMOVE`, skia-pathops). Une police variable garde des
contours qui se chevauchent ; Blender remplit pair-impair, et chaque
chevauchement devenait un trou — un « N » sans jambage, un « I » en deux points.
"""

import math
import os
import subprocess
import sys

import bpy  # noqa: I001 — bpy d'abord : il installe bmesh et mathutils
import bmesh
from mathutils import Matrix, Vector

ICI = os.path.dirname(os.path.abspath(__file__))
SORTIE = os.path.join(ICI, "..", "public", "assets", "decor3d", "pancartes.glb")
POLICE = os.path.join(ICI, "polices", "baloo2-800.ttf")


# --------------------------------------------------------------------------
# Matières et accumulation
# --------------------------------------------------------------------------

def lineaire(hexa: int) -> tuple:
    def canal(c: float) -> float:
        return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4

    r, g, b = (hexa >> 16) & 255, (hexa >> 8) & 255, hexa & 255
    return (canal(r / 255), canal(g / 255), canal(b / 255), 1.0)


MATIERES: dict = {}


def matiere(nom, hexa, rugosite=0.6, metal=0.0, emission=0.0):
    if nom not in MATIERES:
        m = bpy.data.materials.new(nom)
        m.use_nodes = True
        bsdf = m.node_tree.nodes["Principled BSDF"]
        bsdf.inputs["Base Color"].default_value = lineaire(hexa)
        bsdf.inputs["Roughness"].default_value = rugosite
        bsdf.inputs["Metallic"].default_value = metal
        if emission:
            bsdf.inputs["Emission Color"].default_value = lineaire(hexa)
            bsdf.inputs["Emission Strength"].default_value = emission
        m.use_backface_culling = True
        MATIERES[nom] = m
    return nom


class Pancarte:
    """Une pancarte en cours : un maillage par matière, sous un nœud nommé."""

    def __init__(self, nom: str):
        self.nom = nom
        self.morceaux: dict = {}

    def verser(self, bm, mat, lisse=False, m: Matrix | None = None):
        if m is not None:
            bmesh.ops.transform(bm, matrix=m, verts=bm.verts)
        for f in bm.faces:
            f.smooth = lisse
        temp = bpy.data.meshes.new("temp")
        bm.to_mesh(temp)
        bm.free()
        cible = self.morceaux.setdefault(mat, bmesh.new())
        cible.from_mesh(temp)
        bpy.data.meshes.remove(temp)

    # ---- Formes -------------------------------------------------------

    def boite(self, mat, taille, centre, biseau=0.006, rot: Matrix | None = None, coins=0.0):
        """
        Un pavé biseauté. `coins` arrondit les quatre arêtes parallèles à Y :
        un panneau vu de face aux coins ronds, comme une plaque émaillée.
        """
        bm = bmesh.new()
        bmesh.ops.create_cube(bm, size=1.0)
        bmesh.ops.scale(bm, vec=Vector(taille), verts=bm.verts)
        if coins > 0:
            aretes = [e for e in bm.edges if abs((e.verts[0].co - e.verts[1].co).normalized().y) > 0.99]
            bmesh.ops.bevel(bm, geom=aretes, offset=min(coins, min(taille[0], taille[2]) * 0.49),
                            segments=5, profile=0.5, affect="EDGES")
        elif biseau > 0:
            bmesh.ops.bevel(bm, geom=list(bm.edges), offset=min(biseau, min(taille) * 0.45),
                            segments=2, profile=0.5, affect="EDGES")
        m = Matrix.Translation(Vector(centre)) @ (rot or Matrix.Identity(4))
        self.verser(bm, mat, m=m)

    def cylindre(self, mat, rayon, bas, haut, cotes=10, lisse=True):
        """Un cylindre entre deux points."""
        bas, haut = Vector(bas), Vector(haut)
        axe = haut - bas
        bm = bmesh.new()
        bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=cotes,
                              radius1=rayon, radius2=rayon, depth=axe.length)
        rot = axe.normalized().to_track_quat("Z", "Y").to_matrix().to_4x4()
        self.verser(bm, mat, lisse=lisse, m=Matrix.Translation((bas + haut) / 2) @ rot)

    def maillon(self, mat, centre, rayon, epais, tourne):
        """Un maillon de chaîne : un tore étiré, dressé à la verticale."""
        bm = bmesh.new()
        n, k = 8, 4
        anneaux = []
        for i in range(n):
            a = 2 * math.pi * i / n
            c = Vector((math.cos(a) * rayon * 0.75, 0, math.sin(a) * rayon * 1.3))
            d = Vector((math.cos(a), 0, math.sin(a)))
            anneaux.append([bm.verts.new(c + (d * math.cos(2 * math.pi * j / k) + Vector((0, 1, 0)) * math.sin(2 * math.pi * j / k)) * epais) for j in range(k)])
        for i in range(n):
            for j in range(k):
                a, b = anneaux[i][j], anneaux[i][(j + 1) % k]
                c, d = anneaux[(i + 1) % n][(j + 1) % k], anneaux[(i + 1) % n][j]
                bm.faces.new((a, b, c, d))
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        m = Matrix.Translation(Vector(centre)) @ Matrix.Rotation(math.pi / 2 if tourne else 0, 4, "Z")
        self.verser(bm, mat, lisse=True, m=m)

    def texte(self, mat, chaine, centre, hauteur, largeur_max, relief=0.012, finesse=3):
        """
        Des lettres en relief, dans la police du jeu, posées sur un panneau
        qui regarde vers −Y ; `centre` est le milieu du texte sur la face.
        """
        courbe = bpy.data.curves.new("texte", type="FONT")
        courbe.body = chaine
        courbe.font = bpy.data.fonts.load(POLICE, check_existing=True)
        courbe.align_x = "CENTER"
        courbe.align_y = "CENTER"
        courbe.size = 1.0
        courbe.extrude = 0.0
        courbe.resolution_u = finesse
        objet = bpy.data.objects.new("texte", courbe)
        bpy.context.scene.collection.objects.link(objet)
        graphe = bpy.context.evaluated_depsgraph_get()
        maillage = objet.evaluated_get(graphe).to_mesh()
        bm = bmesh.new()
        bm.from_mesh(maillage)
        objet.evaluated_get(graphe).to_mesh_clear()
        bpy.data.objects.remove(objet)
        bpy.data.curves.remove(courbe)
        # Le remplissage plat des glyphes, toutes faces tournées vers +Z, puis
        # un relief extrudé ici : le volume est fermé par construction. Laisser
        # Blender extruder donnait des faces orientées au petit bonheur, et le
        # devant d'un « I » disparaissait avec l'élimination des faces arrière.
        # La face de dos, collée au panneau, ne se verrait pas : l'extrusion
        # la retire.
        bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
        bmesh.ops.triangulate(bm, faces=bm.faces)
        for f in bm.faces:
            f.normal_update()
            if f.normal.z < 0:
                f.normal_flip()
        fait = bmesh.ops.extrude_face_region(bm, geom=list(bm.faces))
        bmesh.ops.translate(bm, vec=Vector((0, 0, 1)),
                            verts=[v for v in fait["geom"] if isinstance(v, bmesh.types.BMVert)])
        # Surtout pas de `recalc_face_normals` ici : sur un volume ouvert, il
        # retourne des régions entières — c'étaient les trous dans les lettres.
        # La hauteur des capitales fixe l'échelle, la largeur la plafonne.
        xs = [v.co.x for v in bm.verts]
        ys = [v.co.y for v in bm.verts]
        larg, haut = max(xs) - min(xs), max(ys) - min(ys)
        cx, cy = (max(xs) + min(xs)) / 2, (max(ys) + min(ys)) / 2
        s = min(hauteur / haut, largeur_max / larg)
        bmesh.ops.translate(bm, vec=Vector((-cx, -cy, 0)), verts=bm.verts)
        # Le dos des lettres sur la face du panneau, le relief vers la caméra.
        m = (
            Matrix.Translation(Vector(centre))
            @ Matrix.Rotation(math.pi / 2, 4, "X")
            @ Matrix.Diagonal(Vector((s, s, relief, 1)))
        )
        self.verser(bm, mat, m=m)

    def plaque(self, largeur, hauteur, epais, centre, bord, fond, liseré=0.05, rayon=0.08):
        """
        Une plaque émaillée : la tôle aux coins ronds dans la couleur du bord,
        et le champ intérieur, un peu en saillie. Renvoie la face avant (y).
        """
        x, y, z = centre
        self.boite(bord, (largeur, epais, hauteur), (x, y, z), coins=rayon)
        interieur = (largeur - 2 * liseré, 0.006, hauteur - 2 * liseré)
        face = y - epais / 2 - 0.003
        self.boite(fond, interieur, (x, face, z), coins=max(0.01, rayon - liseré * 0.6))
        return face - 0.003

    def vis(self, mat, points, face_y):
        for (x, z) in points:
            self.cylindre(mat, 0.012, (x, face_y + 0.002, z), (x, face_y - 0.006, z), cotes=8)

    # ---- Export -------------------------------------------------------

    def poser(self):
        racine = bpy.data.objects.new(self.nom, None)
        bpy.context.scene.collection.objects.link(racine)
        triangles = 0
        for mat, bm in self.morceaux.items():
            maillage = bpy.data.meshes.new(f"{self.nom}:{mat}")
            bm.to_mesh(maillage)
            bm.free()
            maillage.materials.append(MATIERES[mat])
            triangles += sum(len(p.vertices) - 2 for p in maillage.polygons)
            objet = bpy.data.objects.new(f"{self.nom}:{mat}", maillage)
            bpy.context.scene.collection.objects.link(objet)
            objet.parent = racine
        print(f"  {self.nom} : {len(self.morceaux)} matières, {triangles} triangles", file=sys.stderr)


def rot_z(a):
    return Matrix.Rotation(a, 4, "Z")


def rot_y(a):
    return Matrix.Rotation(a, 4, "Y")


# --------------------------------------------------------------------------
# Les pancartes
# --------------------------------------------------------------------------

def vente():
    """
    « À VENDRE » : un poteau de bois planté dans sa motte, une potence et sa
    jambe de force, deux chaînes, et la plaque émaillée qui pend.
    """
    p = Pancarte("pancarte-vente")
    bois = matiere("bois-poteau", 0x7a5a3a, 0.85)
    bois_clair = matiere("bois-potence", 0x94714a, 0.8)
    terre = matiere("terre", 0x6b5236, 0.95)
    acier = matiere("acier", 0x8e969b, 0.4, 0.7)
    blanc = matiere("email-blanc", 0xf6f0e2, 0.3)
    rouge = matiere("email-rouge", 0xb8321c, 0.35)
    H, L = 2.1, 1.9
    xp = -L / 2 - 0.1
    # La motte, le poteau, la potence, la jambe de force.
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=2, radius=1.0)
    bmesh.ops.scale(bm, vec=Vector((0.26, 0.26, 0.07)), verts=bm.verts)
    p.verser(bm, terre, lisse=True, m=Matrix.Translation(Vector((xp, 0, 0.0))))
    p.boite(bois, (0.13, 0.13, H + 0.05), (xp, 0, (H + 0.05) / 2), biseau=0.012)
    p.boite(bois, (0.15, 0.15, 0.04), (xp, 0, H + 0.07), biseau=0.01)
    p.boite(bois_clair, (L + 0.35, 0.1, 0.1), (0.02, 0, H - 0.05), biseau=0.01)
    jambe = 0.5
    p.boite(bois_clair, (jambe, 0.07, 0.07), (xp + 0.22, 0, H - 0.27), biseau=0.008, rot=rot_y(math.pi / 4))
    for bx in (xp + 0.07, xp + 0.4):
        p.cylindre(acier, 0.012, (bx, -0.07, H - 0.05), (bx, 0.07, H - 0.05), cotes=6)
    # La plaque : tôle rouge aux coins ronds, champ blanc, lettres rouges.
    hp = L * (208 / 512)
    zc = H - 0.36 - hp / 2
    face = p.plaque(L, hp, 0.035, (0, 0, zc), rouge, blanc, liseré=0.055, rayon=0.1)
    p.texte(rouge, "À VENDRE", (0, face, zc + 0.01), hp * 0.46, L - 0.34, finesse=2)
    p.vis(acier, [(-L / 2 + 0.1, zc + hp / 2 - 0.1), (L / 2 - 0.1, zc + hp / 2 - 0.1),
                  (-L / 2 + 0.1, zc - hp / 2 + 0.1), (L / 2 - 0.1, zc - hp / 2 + 0.1)], face)
    # Les chaînes : de la potence aux œillets de la plaque.
    for sx in (-(L / 2 - 0.25), L / 2 - 0.25):
        haut, bas = H - 0.1, zc + hp / 2
        n = 4
        for k in range(n):
            z = haut - (k + 0.5) * (haut - bas) / n
            p.maillon(acier, (sx, 0, z), 0.028, 0.007, k % 2 == 1)
    p.poser()


def rucher():
    """
    La pancarte du rucher : deux rondins, une planche à deux lattes sous un
    petit toit de bardeaux, les lettres couleur de miel, et des alvéoles.
    """
    p = Pancarte("enseigne-rucher")
    ecorce = matiere("ecorce", 0x5b4330, 0.95)
    planche = matiere("planche", 0xb98b54, 0.8)
    planche_sombre = matiere("planche-joint", 0x6e4d2c, 0.9)
    miel = matiere("peinture-miel", 0x8a4f10, 0.55)
    alveole = matiere("alveole", 0xe3a526, 0.45)
    bardeau = matiere("bardeau", 0x6d4a34, 0.9)
    L, hp, zc = 1.7, 0.66, 1.0
    for sx in (-L / 2 + 0.08, L / 2 - 0.08):
        p.cylindre(ecorce, 0.055, (sx, 0.05, 0), (sx, 0.05, zc + hp / 2 + 0.28), cotes=9)
    # Deux lattes épaisses, le joint entre elles.
    for dz in (hp / 4, -hp / 4):
        p.boite(planche, (L, 0.05, hp / 2 - 0.012), (0, 0, zc + dz), biseau=0.012)
    p.boite(planche_sombre, (L - 0.04, 0.03, 0.014), (0, 0.006, zc), biseau=0)
    face = -0.025
    p.texte(miel, "RUCHER", (0.12, face, zc + 0.1), 0.24, L - 0.72, relief=0.01)
    p.texte(miel, "Miel de la ferme", (0.12, face, zc - 0.17), 0.085, L - 0.72, relief=0.008)
    # Trois alvéoles de cire, à gauche.
    for (dx, dz) in ((-0.7, 0.07), (-0.6, 0.01), (-0.7, -0.05)):
        bm = bmesh.new()
        bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=6, radius1=0.055, radius2=0.055, depth=0.014)
        p.verser(bm, alveole, m=Matrix.Translation(Vector((dx, face - 0.005, zc + dz))) @ Matrix.Rotation(math.pi / 2, 4, "X") @ rot_z(math.pi / 6))
    # Le petit toit à deux pans, en bardeaux.
    zt = zc + hp / 2 + 0.2
    for s in (-1, 1):
        p.boite(bardeau, (L + 0.24, 0.24, 0.035), (0, s * 0.1, zt), biseau=0.008, rot=Matrix.Rotation(-s * 0.55, 4, "X"))
    p.poser()


def cooperative():
    """
    Le totem de la coopérative : un socle de béton, deux montants d'acier, un
    caisson aux coins ronds, bandeau vert en tête, un épi de blé au sous-titre.
    """
    p = Pancarte("enseigne-cooperative")
    beton = matiere("beton", 0xb7b1a4, 0.95)
    acier = matiere("acier-laque", 0x4f575d, 0.45, 0.5)
    creme = matiere("caisson-creme", 0xf5f0e2, 0.4)
    vert = matiere("coop-vert", 0x2f5d3a, 0.45)
    blanc = matiere("lettre-blanche", 0xfbf8f0, 0.4)
    ble = matiere("ble", 0xe0b54a, 0.6)
    L, hp, zc = 2.4, 1.0, 1.95
    p.boite(beton, (0.95, 0.7, 0.3), (0, 0, 0.15), biseau=0.03)
    for sx in (-0.45, 0.45):
        p.boite(acier, (0.09, 0.09, zc), (sx, 0, 0.3 + zc / 2 - 0.15), biseau=0.01)
    p.boite(creme, (L, 0.14, hp), (0, 0, zc), coins=0.1)
    # Le bandeau vert, en tête du caisson, et le liseré du bas.
    bandeau = 0.4
    p.boite(vert, (L - 0.08, 0.008, bandeau), (0, -0.074, zc + hp / 2 - bandeau / 2 - 0.04), coins=0.06)
    p.texte(blanc, "COOPÉRATIVE", (0, -0.078, zc + hp / 2 - bandeau / 2 - 0.04), 0.24, L - 0.35)
    p.boite(vert, (L - 0.3, 0.006, 0.03), (0, -0.074, zc - hp / 2 + 0.09), biseau=0)
    p.texte(vert, "Collecte · Vente des récoltes", (0.14, -0.072, zc - 0.12), 0.12, L - 0.7, relief=0.008)
    # Un épi de blé, à gauche du sous-titre.
    ex, ez = -L / 2 + 0.24, zc - 0.13
    p.cylindre(ble, 0.008, (ex, -0.078, ez - 0.2), (ex, -0.078, ez + 0.14), cotes=5)
    for k in range(5):
        for s in (-1, 1):
            bm = bmesh.new()
            bmesh.ops.create_icosphere(bm, subdivisions=1, radius=1.0)
            bmesh.ops.scale(bm, vec=Vector((0.018, 0.01, 0.034)), verts=bm.verts)
            m = Matrix.Translation(Vector((ex + s * 0.022, -0.082, ez - 0.08 + k * 0.05))) @ rot_y(-s * 0.45)
            p.verser(bm, ble, lisse=True, m=m)
    p.poser()


def concession():
    """
    L'enseigne de la concession, sur le toit : un caisson vert à liseré
    jaune, sur un châssis d'acier contreventé.
    """
    p = Pancarte("enseigne-concession")
    acier = matiere("acier-laque", 0x4f575d, 0.45, 0.5)
    vert = matiere("concession-vert", 0x2f7d4a, 0.4)
    jaune = matiere("concession-jaune", 0xf2c230, 0.4)
    blanc = matiere("lettre-blanche", 0xfbf8f0, 0.4)
    L, hp = 2.6, 1.0
    zc = 0.32 + hp / 2
    for sx in (-1.0, 1.0):
        p.boite(acier, (0.08, 0.08, zc), (sx, 0.06, zc / 2), biseau=0.008)
        p.boite(acier, (0.05, 0.05, 0.62), (sx, 0.26, 0.24), biseau=0.006, rot=Matrix.Rotation(-0.75, 4, "X"))
        p.boite(acier, (0.2, 0.44, 0.03), (sx, 0.16, 0.015), biseau=0.006)
    p.boite(jaune, (L, 0.16, hp), (0, 0, zc), coins=0.08)
    p.boite(vert, (L - 0.08, 0.01, hp - 0.08), (0, -0.082, zc), coins=0.06)
    p.texte(blanc, "CONCESSION", (0, -0.088, zc + 0.14), 0.3, L - 0.3)
    p.texte(jaune, "Engins neufs & occasions", (0, -0.086, zc - 0.22), 0.12, L - 0.6, relief=0.008)
    p.poser()


def mairie():
    """
    La plaque de la mairie : émail bleu à la française, bord blanc, « MAIRIE »
    et la devise. Le dos est à l'origine, contre la façade.
    """
    p = Pancarte("plaque-mairie")
    bleu = matiere("email-bleu", 0x23407a, 0.3)
    blanc = matiere("email-blanc", 0xf6f0e2, 0.3)
    acier = matiere("acier", 0x8e969b, 0.4, 0.7)
    L, hp, ep = 1.66, 0.64, 0.03
    p.boite(blanc, (L, ep, hp), (0, -ep / 2, 0), coins=0.08)
    face = -ep - 0.003
    p.boite(bleu, (L - 0.08, 0.006, hp - 0.08), (0, face, 0), coins=0.05)
    p.texte(blanc, "MAIRIE", (0, face - 0.003, 0.07), 0.25, L - 0.3)
    p.texte(blanc, "Liberté · Égalité · Fraternité", (0, face - 0.003, -0.18), 0.075, L - 0.4, relief=0.006)
    p.vis(acier, [(-L / 2 + 0.07, 0), (L / 2 - 0.07, 0)], face - 0.003)
    p.poser()


def construire():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    print("pancartes.glb :", file=sys.stderr)
    for faire in (vente, rucher, cooperative, concession, mairie):
        faire()
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
    subprocess.run(["npx", "-y", "@gltf-transform/cli@4", "meshopt", brut, SORTIE], check=True)
    if not os.environ.get("GARDER_BRUT"):
        os.remove(brut)
    print(f"  {os.path.getsize(SORTIE) / 1024:.0f} Ko", file=sys.stderr)


if __name__ == "__main__":
    construire()
