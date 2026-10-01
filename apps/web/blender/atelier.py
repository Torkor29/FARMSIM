"""
Lanceur de la forge d'assets : `python apps/web/blender/atelier.py --help`.

Il faut le module `bpy` (Blender en bibliothèque Python, Python 3.11) :
`scripts/forge.sh` crée l'environnement au premier appel.
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from forge.cli import main  # noqa: E402

if __name__ == "__main__":
    code = main()
    sys.stdout.flush()
    sys.stderr.flush()
    # bpy en module plante parfois à la fermeture de l'interpréteur, après une
    # cuisson Cycles (erreur de segmentation au démontage) : le travail est
    # fini et écrit, on sort sans démontage pour garder un code de sortie fiable.
    os._exit(code)
