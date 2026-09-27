"""
L'atelier : ce qu'une recette remplit, et ce qui en sort.

Une recette décrit un décor en appelant des formes (`a.boite`, `a.tour`,
`a.canopee`…) ; chaque forme **verse** sa géométrie dans le maillage de sa
matière, au sein de la pièce et du nœud courants. À la fin, l'atelier
matérialise un maillage par (nœud, matière) : le jeu dessine donc une pièce en
autant d'appels de rendu qu'elle a de matières, pas de morceaux.

    with a.piece("moulin"):                 # un nœud racine que le jeu cherche par son nom
        a.tour("enduit", profil, ...)       # versé dans « moulin:enduit »
        with a.noeud("ailes", origine=(0, -1.2, 5.4)):
            ...                              # un nœud enfant qu'on fait tourner

    with a.repere(position=(2, 0, 0), rot_z=0.4):
        ...                                  # tout ce qui est versé ici est déplacé

On modélise en **mètres réels**, Z vers le haut, la caméra du jeu du côté −Y.
L'`echelle` de l'asset convertit en unités du jeu à la fin ; l'export glTF
passe en Y vers le haut, et le −Y de Blender devient le +Z du jeu.
"""

from __future__ import annotations

import contextlib
import math
import random
from dataclasses import dataclass, field

import bpy  # noqa: I001 — bpy d'abord : il installe bmesh et mathutils
import bmesh
from mathutils import Matrix, Vector

from . import palette
from .formes import Formes
from .nature import Nature


@dataclass
class Noeud:
    nom: str
    origine: Vector
    morceaux: dict[str, bmesh.types.BMesh] = field(default_factory=dict)
    lisse: dict[str, bool] = field(default_factory=dict)


@dataclass
class Empreinte:
    """La place d'un objet au sol : un cercle, et la tranche de hauteur qu'il occupe."""
    nom: str
    genre: str
    x: float
    y: float
    r: float  # rayon d'un cercle ; 0 pour une boîte
    bas: float
    haut: float
    w: float = 0.0  # boîte : largeur, profondeur, angle autour de Z
    d: float = 0.0
    angle: float = 0.0


@dataclass
class Piece:
    nom: str
    noeuds: dict[str, Noeud] = field(default_factory=dict)
    empreintes: list[Empreinte] = field(default_factory=list)
    # Renseignés par `realiser()`
    racine: bpy.types.Object | None = None
    objets: list[bpy.types.Object] = field(default_factory=list)


class Atelier(Formes, Nature):
    def __init__(self, asset_id: str, echelle: float = 1.0, graine: int = 1):
        self.id = asset_id
        self.echelle = echelle
        self.alea = random.Random(graine)
        self.pieces: dict[str, Piece] = {}
        self.matieres: dict[str, bpy.types.Material] = {}
        self.teintes: dict[str, int] = {}
        self._piece: Piece | None = None
        self._noeud: Noeud | None = None
        self._pile: list[Matrix] = [Matrix.Identity(4)]
        self._dans_objet = 0
        self.realise = False

    # ------------------------------------------------------------------
    # Structure
    # ------------------------------------------------------------------

    @contextlib.contextmanager
    def piece(self, nom: str):
        """Une pièce : un nœud racine à l'origine, que le jeu va chercher par son nom."""
        if nom in self.pieces:
            raise ValueError(f"pièce « {nom} » déjà définie")
        avant = (self._piece, self._noeud, self._pile)
        self._piece = Piece(nom)
        self.pieces[nom] = self._piece
        self._noeud = self._piece.noeuds.setdefault("", Noeud("", Vector()))
        self._pile = [Matrix.Identity(4)]
        try:
            yield self._piece
        finally:
            self._piece, self._noeud, self._pile = avant

    @contextlib.contextmanager
    def noeud(self, nom: str, origine=(0.0, 0.0, 0.0)):
        """
        Un nœud enfant de la pièce, pivot en `origine` (dans le `repere`
        courant) : ailes de moulin, porte, manivelle — ce que le jeu anime. La
        géométrie reste donnée dans le repère courant, pas relative au pivot.
        """
        if self._piece is None:
            raise RuntimeError("un nœud se déclare dans une pièce")
        avant = self._noeud
        self._noeud = self._piece.noeuds.setdefault(nom, Noeud(nom, self._pile[-1] @ Vector(origine)))
        try:
            yield self._noeud
        finally:
            self._noeud = avant

    @contextlib.contextmanager
    def repere(self, position=(0.0, 0.0, 0.0), rot_z: float = 0.0, echelle: float | tuple = 1.0):
        """Déplace, tourne (autour de Z) et met à l'échelle tout ce qui est versé dedans."""
        e = echelle if isinstance(echelle, tuple) else (echelle, echelle, echelle)
        m = (
            Matrix.Translation(Vector(position))
            @ Matrix.Rotation(rot_z, 4, "Z")
            @ Matrix.Diagonal((e[0], e[1], e[2], 1.0))
        )
        self._pile.append(self._pile[-1] @ m)
        try:
            yield
        finally:
            self._pile.pop()

    # ------------------------------------------------------------------
    # Les empreintes : qui prend quelle place (voir `controle.interpenetrations`)
    # ------------------------------------------------------------------

    def empreinte(self, genre: str, centre, rayon: float, bas: float = 0.0, haut: float = 1.0,
                  nom: str | None = None) -> None:
        """
        Déclare la place d'un objet : un cercle au sol (dans le repère courant)
        et la tranche de hauteur qu'il occupe. Ignoré à l'intérieur d'un
        `objet` : un objet composé n'a qu'une empreinte, la sienne.
        """
        if self._piece is None or self._dans_objet:
            return
        m = self._pile[-1]
        c = m @ Vector((centre[0], centre[1], 0.0))
        z0 = (m @ Vector((centre[0], centre[1], bas))).z
        z1 = (m @ Vector((centre[0], centre[1], haut))).z
        e = (m.to_3x3() @ Vector((1, 0, 0))).length
        n = nom or f"{genre}-{len(self._piece.empreintes)}"
        self._piece.empreintes.append(Empreinte(n, genre, c.x, c.y, rayon * e, min(z0, z1), max(z0, z1)))

    def empreinte_boite(self, genre: str, centre, taille, rot_z: float = 0.0, bas: float = 0.0,
                        haut: float = 1.0, nom: str | None = None) -> None:
        """Comme `empreinte`, pour un objet long : une boîte tournée au sol."""
        if self._piece is None or self._dans_objet:
            return
        m = self._pile[-1]
        c = m @ Vector((centre[0], centre[1], 0.0))
        z0 = (m @ Vector((centre[0], centre[1], bas))).z
        z1 = (m @ Vector((centre[0], centre[1], haut))).z
        ax = m.to_3x3() @ Vector((math.cos(rot_z), math.sin(rot_z), 0))
        e = ax.length
        n = nom or f"{genre}-{len(self._piece.empreintes)}"
        self._piece.empreintes.append(Empreinte(n, genre, c.x, c.y, 0.0, min(z0, z1), max(z0, z1),
                                                taille[0] * e, taille[1] * e, math.atan2(ax.y, ax.x)))

    @contextlib.contextmanager
    def objet_boite(self, genre: str, taille, centre=(0.0, 0.0), rot_z: float = 0.0, bas: float = 0.0,
                    haut: float = 1.0, nom: str | None = None):
        """Un objet composé long (étal, banc, comptoir) : une empreinte en boîte."""
        self.empreinte_boite(genre, centre, taille, rot_z, bas, haut, nom)
        self._dans_objet += 1
        try:
            yield
        finally:
            self._dans_objet -= 1

    @contextlib.contextmanager
    def objet(self, genre: str, rayon: float, centre=(0.0, 0.0), bas: float = 0.0, haut: float = 1.0,
              nom: str | None = None):
        """
        Un objet composé (lanterne, puits, sac…) : une seule empreinte pour
        tout ce qui est versé dedans. Les formes sémantiques appelées à
        l'intérieur (buisson, lavande…) ne déclarent rien d'elles-mêmes.
        """
        self.empreinte(genre, centre, rayon, bas, haut, nom)
        self._dans_objet += 1
        try:
            yield
        finally:
            self._dans_objet -= 1

    # ------------------------------------------------------------------
    # Matières
    # ------------------------------------------------------------------

    def matiere(self, nom: str, couleur: int | None = None, rugosite: float | None = None,
                metal: float | None = None, emission: float | None = None,
                opacite: float | None = None, deux_faces: bool | None = None) -> str:
        """
        Déclare (au besoin) la matière `nom` et rend son nom.

        Un nom de la palette suffit ; les paramètres surchargent. Un nom hors
        palette exige une couleur.
        """
        if nom in self.matieres:
            return nom
        base = palette.COULEURS.get(nom)
        if base is None and couleur is None:
            raise KeyError(f"matière « {nom} » absente de la palette : donner une couleur")
        c, r, me, em, op, df = base or (couleur, 0.8, 0.0, 0.0, 1.0, False)
        c = couleur if couleur is not None else c
        r = rugosite if rugosite is not None else r
        me = metal if metal is not None else me
        em = emission if emission is not None else em
        op = opacite if opacite is not None else op
        df = deux_faces if deux_faces is not None else df

        m = bpy.data.materials.new(nom)
        m.use_nodes = True
        bsdf = m.node_tree.nodes["Principled BSDF"]
        bsdf.inputs["Base Color"].default_value = palette.lineaire(c)
        bsdf.inputs["Roughness"].default_value = r
        bsdf.inputs["Metallic"].default_value = me
        if em > 0:
            bsdf.inputs["Emission Color"].default_value = palette.lineaire(c)
            bsdf.inputs["Emission Strength"].default_value = em
        if op < 1.0:
            bsdf.inputs["Alpha"].default_value = op
            m.surface_render_method = "BLENDED"
        # Une face qu'on ne voit que d'un côté se dessine une fois : seules les
        # lames fines (pétales, feuilles, toiles) ont besoin des deux faces.
        m.use_backface_culling = not df
        self.matieres[nom] = m
        self.teintes[nom] = c
        return nom

    # ------------------------------------------------------------------
    # Géométrie
    # ------------------------------------------------------------------

    def verser(self, bm: bmesh.types.BMesh, mat: str, lisse: bool = False, m: Matrix | None = None):
        """Ajoute un morceau au maillage de sa matière, puis libère le morceau."""
        if self._noeud is None:
            bm.free()
            raise RuntimeError("verser hors d'une pièce")
        self.matiere(mat)
        total = self._pile[-1] @ m if m is not None else self._pile[-1]
        if total != Matrix.Identity(4):
            bmesh.ops.transform(bm, matrix=total, verts=bm.verts)
            # Une échelle négative retourne les faces : on les remet à l'endroit.
            if total.to_3x3().determinant() < 0:
                bmesh.ops.reverse_faces(bm, faces=bm.faces)
        for f in bm.faces:
            f.smooth = lisse
        temp = bpy.data.meshes.new("temp")
        bm.to_mesh(temp)
        bm.free()
        cible = self._noeud.morceaux.setdefault(mat, bmesh.new())
        cible.from_mesh(temp)
        bpy.data.meshes.remove(temp)

    # ------------------------------------------------------------------
    # Matérialisation
    # ------------------------------------------------------------------

    def realiser(self) -> None:
        """Un objet Blender par (nœud, matière), mis à l'échelle du jeu."""
        if self.realise:
            return
        echelle = Matrix.Scale(self.echelle, 4)
        col = bpy.context.scene.collection
        for piece in self.pieces.values():
            racine = bpy.data.objects.new(piece.nom, None)
            racine.empty_display_size = 0.3
            col.objects.link(racine)
            piece.racine = racine
            for noeud in piece.noeuds.values():
                parent = racine
                origine = noeud.origine * self.echelle
                if noeud.nom:
                    parent = bpy.data.objects.new(f"{piece.nom}:{noeud.nom}", None)
                    parent.empty_display_size = 0.2
                    parent.location = origine
                    parent.parent = racine
                    col.objects.link(parent)
                for mat, bm in noeud.morceaux.items():
                    if not bm.faces:
                        bm.free()
                        continue
                    bmesh.ops.transform(bm, matrix=Matrix.Translation(-origine) @ echelle, verts=bm.verts)
                    # Les sommets confondus d'un même morceau (pôles, soudures)
                    # sont fusionnés : moins de sommets, des normales propres.
                    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
                    nom = f"{piece.nom}:{noeud.nom + ':' if noeud.nom else ''}{mat}"
                    maillage = bpy.data.meshes.new(nom)
                    bm.to_mesh(maillage)
                    bm.free()
                    maillage.materials.append(self.matieres[mat])
                    objet = bpy.data.objects.new(nom, maillage)
                    objet.parent = parent
                    col.objects.link(objet)
                    piece.objets.append(objet)
                noeud.morceaux.clear()
        bpy.context.view_layer.update()
        self.realise = True
