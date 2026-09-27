"""
La ligne de commande de la forge.

    atelier.py liste                         les recettes, et si leur .glb est à jour
    atelier.py construire moulin puits       construit, contrôle, cuit l'AO, exporte
    atelier.py construire --tout             toutes les recettes
    atelier.py construire --perimes          celles dont la source a changé
    atelier.py apercu moulin                 construit et rend, sans exporter
    atelier.py apercu moulin --piece moulin --angles 4 --reference ref.png

Options communes : `--apercu` (rendre aussi à la construction), `--sans-ao`,
`--brut` (pas de compression meshopt), `--json` (rapport machine sur la
sortie standard — c'est l'interface d'un agent), `--dossier` (où écrire les
aperçus, `apps/web/blender/.apercus` par défaut).

Code de sortie : 0 si tout va bien, 1 si un contrôle a échoué (budget,
pièce qui flotte) — l'export n'a alors pas lieu, sauf `--forcer`.
"""

from __future__ import annotations

import argparse
import importlib.util
import json
import os
import sys
import time

import bpy

from . import apercu, controle, cuisson, sortie
from .atelier import Atelier

RECETTES = os.path.join(sortie.BLENDER, "recettes")
APERCUS = os.path.join(sortie.BLENDER, ".apercus")


def recettes() -> dict[str, str]:
    out = {}
    for f in sorted(os.listdir(RECETTES)):
        if f.endswith(".py") and not f.startswith("_"):
            out[f[:-3]] = os.path.join(RECETTES, f)
    return out


def charger(chemin: str):
    nom = "recette_" + os.path.basename(chemin)[:-3].replace("-", "_")
    spec = importlib.util.spec_from_file_location(nom, chemin)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    if not hasattr(mod, "ASSET") or not hasattr(mod, "construire"):
        raise ValueError(f"{chemin} : une recette définit ASSET et construire(a)")
    return mod


def etat(ident: str, chemin: str, manifeste: dict) -> str:
    entree = manifeste["assets"].get(ident)
    if not entree or not os.path.exists(os.path.join(sortie.SORTIE, f"{ident}.glb")):
        return "absent"
    deps = charger(chemin).ASSET.get("dependances", ())
    return "à jour" if entree.get("empreinte") == sortie.empreinte(chemin, deps) else "périmé"


def fabriquer(ident: str, chemin: str, args) -> dict:
    """Une recette de bout en bout. Rend le rapport (sérialisable)."""
    t0 = time.time()
    bpy.ops.wm.read_factory_settings(use_empty=True)
    mod = charger(chemin)
    info = dict(mod.ASSET)
    a = Atelier(ident, echelle=info.get("echelle", 1.0), graine=info.get("graine", 1))
    mod.construire(a)
    a.realiser()

    rapports = controle.controler(
        a,
        budget_triangles=info.get("budget_triangles"),
        budget_appels=info.get("budget_appels"),
        posee=info.get("posee", True),
        verifier_coplanaires=not args.vite,
    )
    erreurs = [f"{p}: {e}" for p, r in rapports.items() for e in r.erreurs]
    rapport = {
        "asset": ident,
        "titre": info.get("titre", ident),
        "pieces": {p: r.dict() for p, r in rapports.items()},
        "erreurs": erreurs,
    }

    if args.commande == "apercu" or args.apercu:
        dossier = args.dossier or APERCUS
        rapport["apercus"] = apercu.rendre(
            a, dossier, pieces=args.piece or None, largeur=args.largeur,
            angles=[apercu.AZIMUT_JEU + k * 360 / args.angles for k in range(args.angles)],
            reference=args.reference,
        )
        rapport["planche"] = os.path.join(dossier, ident, "planche.png")

    if args.commande == "construire":
        if erreurs and not args.forcer:
            rapport["exporte"] = False
        else:
            ao = info.get("ao", True) and not args.sans_ao
            if ao:
                cuisson.cuire_ao(a, echantillons=16 if args.vite else 48,
                                 distance=info.get("ao_distance", 0.6))
            info["empreinte"] = sortie.empreinte(chemin, info.get("dependances", ()))
            glb = sortie.exporter(a, compresser=not args.brut, ao=ao)
            sortie.inscrire(a, info, rapports, glb, chemin)
            rapport["exporte"] = True
            rapport["glb"] = os.path.relpath(glb, sortie.DEPOT)
            rapport["octets"] = os.path.getsize(glb)
    rapport["secondes"] = round(time.time() - t0, 1)
    return rapport


def afficher(r: dict) -> None:
    ok = "✗" if r["erreurs"] else "✓"
    print(f"{ok} {r['asset']} — {r['titre']} ({r['secondes']} s)", file=sys.stderr)
    for nom, p in r["pieces"].items():
        t = p["taille"]
        print(f"    {nom:<24} {p['triangles']:>6} tri  {p['appels']:>2} appels  "
              f"{t[0]:.2f}×{t[1]:.2f}×{t[2]:.2f}"
              + (f"  nœuds: {', '.join(p['noeuds'])}" if p["noeuds"] else ""), file=sys.stderr)
        for e in p["erreurs"]:
            print(f"      ERREUR  {e}", file=sys.stderr)
        for e in p["alertes"]:
            print(f"      alerte  {e}", file=sys.stderr)
    if r.get("glb"):
        print(f"    → {r['glb']} ({r['octets'] / 1024:.0f} Ko)", file=sys.stderr)
    if r.get("planche"):
        print(f"    → aperçu {r['planche']}", file=sys.stderr)


def main(argv=None) -> int:
    p = argparse.ArgumentParser(prog="atelier.py", description="La forge d'assets 3D de FARMSIM.")
    p.add_argument("commande", choices=["liste", "construire", "apercu"])
    p.add_argument("assets", nargs="*")
    p.add_argument("--tout", action="store_true")
    p.add_argument("--perimes", action="store_true")
    p.add_argument("--apercu", action="store_true")
    p.add_argument("--piece", action="append")
    p.add_argument("--angles", type=int, default=1)
    p.add_argument("--largeur", type=int, default=640)
    p.add_argument("--reference")
    p.add_argument("--dossier")
    p.add_argument("--sans-ao", action="store_true")
    p.add_argument("--brut", action="store_true")
    p.add_argument("--vite", action="store_true", help="AO rapide, pas de test de coplanarité")
    p.add_argument("--forcer", action="store_true")
    p.add_argument("--json", action="store_true")
    args = p.parse_args(argv)

    toutes = recettes()
    manifeste = sortie.lire_manifeste()
    if args.commande == "liste":
        lignes = [
            {"asset": i, "titre": charger(c).ASSET.get("titre", i), "etat": etat(i, c, manifeste)}
            for i, c in toutes.items()
        ]
        if args.json:
            print(json.dumps(lignes, ensure_ascii=False, indent=2))
        else:
            for li in lignes:
                print(f"{li['asset']:<16} {li['etat']:<8} {li['titre']}")
        return 0

    if args.tout:
        choix = list(toutes)
    elif args.perimes:
        choix = [i for i, c in toutes.items() if etat(i, c, manifeste) != "à jour"]
    else:
        choix = args.assets
    inconnus = [c for c in choix if c not in toutes]
    if inconnus:
        print(f"recettes inconnues : {', '.join(inconnus)} (connues : {', '.join(toutes)})", file=sys.stderr)
        return 2
    if not choix:
        print("rien à faire", file=sys.stderr)
        return 0

    rapports = []
    for ident in choix:
        r = fabriquer(ident, toutes[ident], args)
        rapports.append(r)
        if not args.json:
            afficher(r)
    if args.json:
        print(json.dumps(rapports, ensure_ascii=False, indent=2))
    return 1 if any(r["erreurs"] for r in rapports) else 0
