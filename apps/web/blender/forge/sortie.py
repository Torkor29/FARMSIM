"""
La sortie : le .glb compressé, et sa ligne au manifeste.

Le manifeste (`decor3d/manifest.json`) est ce que le jeu et l'atelier web
lisent pour savoir ce qui existe : l'adresse de chaque asset, ses pièces (avec
triangles, appels de rendu, taille, nœuds animables), ses matières et leurs
couleurs de saison, et l'empreinte de la source qui l'a produit — pour savoir
si un .glb est périmé sans le reconstruire.
"""

from __future__ import annotations

import datetime
import hashlib
import json
import os
import shutil
import subprocess

import bpy

from . import palette
from .silence import silence

ICI = os.path.dirname(os.path.abspath(__file__))
BLENDER = os.path.dirname(ICI)
SORTIE = os.path.normpath(os.path.join(BLENDER, "..", "public", "assets", "decor3d"))
MANIFESTE = os.path.join(SORTIE, "manifest.json")
DEPOT = os.path.normpath(os.path.join(BLENDER, "..", "..", ".."))


def empreinte(recette: str) -> str:
    """L'empreinte de la recette et de toute la forge : si elle change, le .glb est périmé."""
    h = hashlib.sha256()
    fichiers = [recette] + sorted(
        os.path.join(ICI, f) for f in os.listdir(ICI) if f.endswith(".py")
    )
    for f in fichiers:
        with open(f, "rb") as fh:
            h.update(os.path.basename(f).encode())
            h.update(fh.read())
    return h.hexdigest()[:16]


def _gltf(chemin: str, ao: bool) -> None:
    bpy.ops.export_scene.gltf(
        filepath=chemin,
        export_format="GLB",
        export_yup=True,
        export_apply=True,
        export_texcoords=False,
        export_normals=True,
        export_materials="EXPORT",
        # L'occlusion cuite part dans COLOR_0 ; three.js la multiplie d'office.
        export_vertex_color="ACTIVE" if ao else "NONE",
        export_cameras=False,
        export_lights=False,
        use_selection=False,
    )


def exporter(atelier, compresser=True, ao=True) -> str:
    os.makedirs(SORTIE, exist_ok=True)
    final = os.path.join(SORTIE, f"{atelier.id}.glb")
    brut = final.replace(".glb", ".brut.glb")
    # L'exportateur glTF journalise chaque primitive sur la sortie d'erreur.
    with silence(erreurs=True):
        _gltf(brut, ao)
    if compresser and shutil.which("npx"):
        # Quantification et compression meshopt : le quart du poids, sans perte
        # visible à l'échelle du jeu (le jeu décode avec `MeshoptDecoder`).
        subprocess.run(
            ["npx", "-y", "@gltf-transform/cli@4", "meshopt", brut, final],
            check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
        )
        os.remove(brut)
    else:
        os.replace(brut, final)
    return final


def lire_manifeste() -> dict:
    try:
        with open(MANIFESTE, encoding="utf-8") as fh:
            return json.load(fh)
    except FileNotFoundError:
        return {"version": 1, "assets": {}}


def inscrire(atelier, info: dict, rapports: dict, chemin: str, source: str) -> dict:
    manifeste = lire_manifeste()
    matieres = sorted(atelier.teintes)
    saisons = {
        s: {m: palette.hexa(c) for m, c in teintes.items() if m in atelier.teintes}
        for s, teintes in palette.SAISONS.items()
    }
    entree = {
        "titre": info.get("titre", atelier.id),
        "url": f"/assets/decor3d/{atelier.id}.glb",
        "octets": os.path.getsize(chemin),
        "echelle": atelier.echelle,
        "source": os.path.relpath(source, DEPOT).replace(os.sep, "/"),
        "empreinte": info["empreinte"],
        "construit": datetime.date.today().isoformat(),
        "matieres": {m: palette.hexa(atelier.teintes[m]) for m in matieres},
        "saisons": {s: t for s, t in saisons.items() if t},
        "pieces": {
            nom: {k: v for k, v in r.dict().items() if k not in ("alertes", "erreurs")}
            for nom, r in rapports.items()
        },
    }
    if info.get("etiquettes"):
        entree["etiquettes"] = info["etiquettes"]
    manifeste["assets"][atelier.id] = entree
    manifeste["assets"] = dict(sorted(manifeste["assets"].items()))
    with open(MANIFESTE, "w", encoding="utf-8") as fh:
        json.dump(manifeste, fh, ensure_ascii=False, indent=2)
        fh.write("\n")
    return entree
