#!/usr/bin/env bash
# Rend au monde les parcelles retenues par les comptes d'essai.
#
#   sudo bash scripts/farmsim-purge-essais.sh              # dit ce qu'il ferait
#   sudo bash scripts/farmsim-purge-essais.sh --vraiment   # le fait
#
# Sans `--vraiment`, rien n'est supprimé : le script compte et s'arrête. C'est
# le bon réglage pour un outil qui touche aux données de production.
#
# Avec `--vraiment`, il prend une sauvegarde étiquetée **avant** d'écrire, et
# refuse d'aller plus loin si elle échoue. On dispose donc toujours d'un retour
# en arrière, y compris si le ménage se révèle plus large que prévu.
#
# Le jeu est arrêté pendant l'opération : on ne réécrit pas la base sous les
# pieds des joueurs connectés. Cela dure quelques secondes.
set -euo pipefail

VRAIMENT=""
JOURS=""
for arg in "$@"; do
  case "$arg" in
    --vraiment) VRAIMENT="--vraiment" ;;
    --jours=*) JOURS="$arg" ;;
    *) echo "Argument inconnu : $arg" >&2; exit 1 ;;
  esac
done

CONTENEUR="${FARMSIM_CONTAINER:-farmsim}"
APP_DIR="${FARMSIM_DIR:-/opt/farmsim}"
ICI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

VOLUME="$(docker inspect "$CONTENEUR" -f '{{range .Mounts}}{{if eq .Destination "/data"}}{{.Name}}{{end}}{{end}}' 2>/dev/null || true)"
IMAGE="$(docker inspect "$CONTENEUR" -f '{{.Config.Image}}' 2>/dev/null || true)"
if [[ -z "$VOLUME" || -z "$IMAGE" ]]; then
  echo "ERREUR : conteneur « $CONTENEUR » introuvable ou sans volume /data." >&2
  exit 1
fi

lancer() {
  docker run --rm --user 0:0 \
    -v "${VOLUME}:/data" \
    -v "${ICI}/farmsim-purge-essais.mjs:/opt/purge.mjs:ro" \
    -e FARMSIM_DB=/data/farmsim.db \
    --entrypoint node \
    "$IMAGE" --disable-warning=ExperimentalWarning /opt/purge.mjs "$@"
}

if [[ -z "$VRAIMENT" ]]; then
  lancer ${JOURS:+"$JOURS"}
  exit 0
fi

echo "==> Sauvegarde avant le ménage"
if ! bash "$ICI/farmsim-backup.sh" avant-purge; then
  echo "ERREUR : sauvegarde impossible — rien n'a été touché." >&2
  exit 1
fi

cd "$APP_DIR"
echo "==> Arrêt du jeu"
docker compose stop farmsim

echo "==> Ménage"
lancer --vraiment ${JOURS:+"$JOURS"}

echo "==> Redémarrage"
docker compose up -d

echo "==> Attente de la santé…"
for i in $(seq 1 150); do
  if curl -fsS "http://127.0.0.1:${FARMSIM_PORT:-8081}/api/health" >/dev/null 2>&1; then
    echo "    OK — le jeu répond."
    exit 0
  fi
  if (( i % 5 == 0 )); then printf '.'; fi
  sleep 2
done
echo
echo "ERREUR : le jeu ne répond pas après le ménage." >&2
echo "         La sauvegarde « avant-purge » permet de revenir en arrière :" >&2
echo "         sudo bash $ICI/farmsim-restore.sh" >&2
docker compose logs --tail=80
exit 1
