#!/usr/bin/env bash
# La forge d'assets 3D : Blender en bibliothèque Python (bpy), sans interface.
#
#   scripts/forge.sh liste
#   scripts/forge.sh construire moulin --apercu
#   scripts/forge.sh construire --perimes
#   scripts/forge.sh apercu nature --piece sapin-1 --angles 4 --json
#
# Au premier appel, crée l'environnement `.forge-env/` (bpy 4.2 exige
# Python 3.11 : ~500 Mo à télécharger une fois). Node (npx) sert à la
# compression meshopt. Voir apps/web/blender/README.md.
set -euo pipefail

RACINE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV="${FORGE_ENV:-$RACINE/.forge-env}"

if [ ! -x "$ENV/bin/python" ]; then
  PY="${FORGE_PYTHON:-}"
  if [ -z "$PY" ]; then
    for c in python3.11 python3; do
      if command -v "$c" >/dev/null && "$c" -c 'import sys; sys.exit(sys.version_info[:2] != (3, 11))'; then
        PY="$c"
        break
      fi
    done
  fi
  if [ -z "$PY" ]; then
    echo "forge : il faut Python 3.11 pour bpy 4.2 (FORGE_PYTHON=/chemin/python3.11)" >&2
    exit 2
  fi
  echo "forge : création de $ENV (une fois)…" >&2
  "$PY" -m venv "$ENV"
  "$ENV/bin/pip" install -q -r "$RACINE/apps/web/blender/requirements.txt" >&2
fi

exec "$ENV/bin/python" "$RACINE/apps/web/blender/atelier.py" "$@"
