---
name: forge-assets
description: Model, preview, check and export FARMSIM 3D decor assets (trees, landmarks, props, terrain pieces) in the cozy-island style with the Blender-based forge (apps/web/blender). Use when asked to create or revise a 3D model, decor, landmark, prop or asset for the game, to match a reference image, or to rebuild stale .glb files. Not for code-built parametric geometry (fields, fences, silos in decor3d.ts) or characters.
---

# Forge d'assets FARMSIM

The forge turns Python recipes into compressed `.glb` files the game loads.
Read `apps/web/blender/README.md` (API, conventions, rules) before writing a
recipe, and `docs/FORGE_ASSETS.md` §1 for what the target style is.

## Commands

```bash
scripts/forge.sh liste --json                    # recipes and whether their .glb is stale
scripts/forge.sh apercu <id> --json              # build + render, no export (fast loop)
scripts/forge.sh apercu <id> --piece <p> --angles 4 --reference <img> --json
scripts/forge.sh construire <id> --apercu --json # checks, AO bake, export, manifest
scripts/forge.sh construire --perimes            # rebuild everything whose source changed
```

First call creates `.forge-env/` (Python 3.11 + bpy 4.2, ~500 MB). If
`python3.11` is elsewhere: `FORGE_PYTHON=/path/python3.11`. An existing venv
with bpy can be reused with `FORGE_ENV=/path/env`.

`--json` prints one report per asset on stdout (per piece: triangles,
appels, sommets, taille [x, y-up, z], matieres, noeuds, alertes, erreurs;
plus `apercus`, `planche`, `glb`). Exit code 1 means a check failed and
nothing was exported. `--vite` = fast AO and no coplanarity check, for
iterating only; do the final `construire` without it.

## Loop

1. Write `apps/web/blender/recettes/<id>.py` (`ASSET` dict with titre,
   echelle, budget_triangles, budget_appels, etiquettes; `construire(a)`).
   Metres, Z up, facades toward −Y. Colours by palette name
   (`forge/palette.py`); add a colour there rather than inline when it is
   reusable.
2. `apercu` as soon as the silhouette exists. **Open the `planche.png` with
   the Read tool and look at it.** With a reference, pass `--reference` so it
   sits on the left of the sheet.
3. Critique honestly: resemblance score /100; what reads right; at most three
   prioritised fixes (silhouette and proportions first, then masses, then
   distinctive landmarks, then colour, then detail); separately, modelling
   errors with location (floating part, part through another, coincident
   faces). Apply the highest-impact fix, render again.
4. Stop at ≥ 85, after two plateauing scores (change the representation:
   e.g. `fondre` instead of stacked spheres), or after ten iterations.
5. Read every `alerte` in the report: coincident faces z-fight in game; fix
   them by offsetting 1–3 cm (proud parts out, lapping parts in).
6. `construire` without `--vite`, then run the web tests
   (`cd apps/web && pnpm test -- forge-decor`). Commit the recipe, the
   `.glb`, and `manifest.json` together. Never commit `.apercus/`.
7. Show the requester the contact sheet and point them to
   `http://localhost:5173/decor.html?asset=<id>`; say what you approximated.
   Their eye is the acceptance, not your score.

## Rules that save iterations

- Bevel everything (`biseau`); thin bars get one segment automatically.
- Organic masses (canopies, bushes, lavender base) go through `fondre`, never
  as raw overlapping spheres.
- One mesh per (node, material): each extra material is a draw call. Reuse
  palette materials; keep a piece under its role budget (README table).
- Animated parts are nodes (`with a.noeud("ailes", origine=hub)`) named by the
  conventions `animerDecor` knows (`ailes` spin on local Z, `treuil` on X);
  add a convention there if you need a new one.
- The Cycles preview judges shape; final colour and AO are judged in
  `decor.html` (three.js, game lights).
- Changing anything in `forge/*.py` marks **every** asset stale (the
  fingerprint covers the whole forge): rebuild them all before committing.
