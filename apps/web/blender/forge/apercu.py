"""
L'aperçu : une image de chaque pièce, sous l'angle et la lumière du jeu.

C'est la boucle courte du modelage — on écrit, on regarde, on corrige — et
c'est aussi ce qu'un agent (Claude) lit pour juger son propre travail : une
image déterministe, cadrée comme en jeu, à comparer à une référence.

- Caméra orthographique, azimut 45°, élévation ~32° : celle de la ferme
  (`IsoFarmView`, caméra en (18, 16, 18) regardant l'origine).
- Soleil chaud venant de (14, 24, 10) comme en jeu, ciel bleu tendre.
- Rendu Cycles sur CPU (le module `bpy` n'a pas d'OpenGL en tâche de fond),
  débruité : une seconde ou deux par pièce.

Sortie : `<dossier>/<asset>/<piece>.png`, plus une planche contact
`<dossier>/<asset>/planche.png` — avec la référence à gauche si on en donne
une.
"""

from __future__ import annotations

import math
import os

import bpy
from mathutils import Vector

from . import palette
from .silence import silence

# L'azimut du jeu : la caméra est en (+X, +Z) du jeu, soit (+X, −Y) dans Blender.
AZIMUT_JEU = 45.0
ELEVATION_JEU = math.degrees(math.atan2(16, math.hypot(18, 18)))


def _scene_apercu(fond=0xbfe3ef):
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.samples = 40
    scene.cycles.use_denoising = True
    scene.render.film_transparent = False
    scene.view_settings.view_transform = "Standard"
    scene.view_settings.look = "None"

    monde = scene.world or bpy.data.worlds.new("monde")
    scene.world = monde
    monde.use_nodes = True
    fond_node = monde.node_tree.nodes["Background"]
    fond_node.inputs["Color"].default_value = palette.lineaire(fond)
    fond_node.inputs["Strength"].default_value = 0.55

    soleil = bpy.data.lights.new("__soleil", "SUN")
    soleil.energy = 2.1
    soleil.color = palette.lineaire(0xfff2d4)[:3]
    soleil.angle = math.radians(6)
    o = bpy.data.objects.new("__soleil", soleil)
    # Direction du soleil du jeu : de (14, 24, 10) vers l'origine.
    d = Vector((14, -10, 24)).normalized()
    o.rotation_euler = d.to_track_quat("Z", "Y").to_euler()
    scene.collection.objects.link(o)

    sol_me = bpy.data.meshes.new("__sol")
    sol = bpy.data.objects.new("__sol", sol_me)
    import bmesh

    bm = bmesh.new()
    bmesh.ops.create_circle(bm, cap_ends=True, radius=60, segments=48)
    bm.to_mesh(sol_me)
    bm.free()
    mat = bpy.data.materials.new("__sol")
    mat.use_nodes = True
    mat.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = palette.lineaire(0x9cc865)
    mat.node_tree.nodes["Principled BSDF"].inputs["Roughness"].default_value = 1.0
    sol_me.materials.append(mat)
    scene.collection.objects.link(sol)

    cam_data = bpy.data.cameras.new("__camera")
    cam_data.type = "ORTHO"
    cam = bpy.data.objects.new("__camera", cam_data)
    scene.collection.objects.link(cam)
    scene.camera = cam
    return [o, sol, cam], sol


def _cadrer(cam, objets, azimut, elevation, marge=1.15):
    """Place la caméra orthographique pour que les objets remplissent le cadre."""
    pts = [o.matrix_world @ Vector(c) for o in objets for c in o.bound_box]
    centre = sum(pts, Vector()) / len(pts)
    az, el = math.radians(azimut), math.radians(elevation)
    # Azimut 0 : la caméra plein sud (−Y, face aux pièces) ; 45 : celle du jeu.
    direction = Vector((math.cos(el) * math.sin(az), -math.cos(el) * math.cos(az), math.sin(el)))
    cam.location = centre + direction * 50
    cam.rotation_euler = (-direction).to_track_quat("-Z", "Y").to_euler()
    # Étendue des points projetés dans le plan de l'image.
    rot = cam.rotation_euler.to_matrix()
    droite, haut = rot.col[0], rot.col[1]
    xs = [(p - centre).dot(droite) for p in pts]
    ys = [(p - centre).dot(haut) for p in pts]
    decale = Vector(droite) * (max(xs) + min(xs)) / 2 + Vector(haut) * (max(ys) + min(ys)) / 2
    cam.location += decale
    etendue = max(max(xs) - min(xs), max(ys) - min(ys))
    cam.data.ortho_scale = max(etendue * marge, 0.2)


def rendre(atelier, dossier, pieces=None, largeur=640, angles=(AZIMUT_JEU,),
           reference: str | None = None, fond=0xbfe3ef) -> list[str]:
    """Rend chaque pièce (ou celles nommées) ; rend la liste des images."""
    scene = bpy.context.scene
    scene.render.resolution_x = largeur
    scene.render.resolution_y = largeur
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    extras, sol = _scene_apercu(fond)
    cam = scene.camera
    sortie = os.path.join(dossier, atelier.id)
    os.makedirs(sortie, exist_ok=True)
    images = []
    noms = pieces or list(atelier.pieces)
    for nom in noms:
        piece = atelier.pieces[nom]
        for autre in atelier.pieces.values():
            for o in autre.objets:
                o.hide_render = autre is not piece
        if not piece.objets:
            continue
        for k, az in enumerate(angles):
            _cadrer(cam, piece.objets, az, ELEVATION_JEU)
            suffixe = "" if len(angles) == 1 else f"-{k}"
            chemin = os.path.join(sortie, f"{nom}{suffixe}.png")
            scene.render.filepath = chemin
            with silence():
                bpy.ops.render.render(write_still=True)
            images.append(chemin)
    for p in atelier.pieces.values():
        for o in p.objets:
            o.hide_render = False
    for o in extras:
        data = o.data
        bpy.data.objects.remove(o)
        if isinstance(data, bpy.types.Mesh):
            bpy.data.meshes.remove(data)
    planche(images, os.path.join(sortie, "planche.png"), reference)
    return images


def planche(images, chemin, reference=None, colonnes=4, cellule=320):
    """Une planche contact : toutes les pièces, légendées, référence en tête."""
    try:
        from PIL import Image, ImageDraw
    except ImportError:  # Pillow facultatif : pas de planche, les images restent
        return None
    entrees = ([("référence", reference)] if reference else []) + [
        (os.path.splitext(os.path.basename(i))[0], i) for i in images
    ]
    if not entrees:
        return None
    colonnes = min(colonnes, len(entrees))
    lignes = math.ceil(len(entrees) / colonnes)
    out = Image.new("RGB", (colonnes * cellule, lignes * (cellule + 22)), (245, 240, 230))
    d = ImageDraw.Draw(out)
    for k, (titre, image) in enumerate(entrees):
        im = Image.open(image).convert("RGB")
        im.thumbnail((cellule, cellule))
        x, y = (k % colonnes) * cellule, (k // colonnes) * (cellule + 22)
        out.paste(im, (x + (cellule - im.width) // 2, y + (cellule - im.height) // 2))
        d.text((x + 8, y + cellule + 4), titre, fill=(70, 55, 40))
    out.save(chemin)
    return chemin
