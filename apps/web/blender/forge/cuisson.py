"""
La cuisson de l'occlusion ambiante dans les couleurs de sommets.

C'est la moitié du « moelleux » des images de référence : le creux sous un
toit, le pied d'un tronc, l'intérieur d'un buisson s'assombrissent doucement.
Le jeu n'a pas les moyens d'un SSAO sur téléphone ; on cuit donc cette ombre
une fois pour toutes dans l'attribut `COLOR_0` de chaque maillage. three.js
multiplie d'office la couleur de la matière par la couleur de sommet
(`vertexColors`), sans rien à changer côté jeu.

La valeur est remappée entre `plancher` et 1 (une occlusion brute noircit
trop), et un léger dégradé vertical assombrit le bas des objets hauts.
"""

from __future__ import annotations

import bpy

from .silence import silence


def cuire_ao(atelier, echantillons=48, distance=0.6, plancher=0.55, degrade=0.12):
    objets = [o for p in atelier.pieces.values() for o in p.objets]
    if not objets:
        return
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.samples = echantillons
    scene.world = scene.world or bpy.data.worlds.new("monde")
    scene.world.light_settings.distance = distance * atelier.echelle

    # Un sol provisoire : le dessous d'un objet posé est dans l'ombre.
    bpy.ops.mesh.primitive_plane_add(size=200, location=(0, 0, 0))
    sol = bpy.context.active_object
    sol.name = "__sol_cuisson"

    # Les pièces sont toutes à l'origine : on les cuit une à une, les autres
    # cachées, sinon elles s'ombrageraient entre elles.
    for piece in atelier.pieces.values():
        for autre in atelier.pieces.values():
            for o in autre.objets:
                o.hide_render = autre is not piece
        for o in piece.objets:
            me = o.data
            if "ao" not in me.color_attributes:
                me.color_attributes.new("ao", "FLOAT_COLOR", "POINT")
            me.color_attributes.active_color = me.color_attributes["ao"]
        bpy.ops.object.select_all(action="DESELECT")
        for o in piece.objets:
            o.select_set(True)
        bpy.context.view_layer.objects.active = piece.objets[0]
        with silence():
            bpy.ops.object.bake(type="AO", target="VERTEX_COLORS", use_clear=True)

        zs = [(o.matrix_world @ v.co).z for o in piece.objets for v in o.data.vertices]
        z0, z1 = min(zs), max(zs)
        h = max(z1 - z0, 1e-3)
        for o in piece.objets:
            attr = o.data.color_attributes["ao"]
            mw = o.matrix_world
            for i, v in enumerate(o.data.vertices):
                ao = attr.data[i].color[0]
                t = ((mw @ v.co).z - z0) / h
                f = (plancher + (1 - plancher) * ao) * (1 - degrade * (1 - min(1.0, t * 2.5)))
                attr.data[i].color = (f, f, f, 1.0)

    for piece in atelier.pieces.values():
        for o in piece.objets:
            o.hide_render = False
    bpy.data.objects.remove(sol)
