#!/usr/bin/env bash
# Sauvegarde la base FARMSIM depuis l'hôte, sans interrompre les joueurs.
#
# Le jeu tient toute sa vie — comptes, fermes, parcelles, argent — dans un
# unique fichier SQLite posé sur un volume Docker. Jusqu'ici il n'en existait
# aucune copie : une perte de volume, ou une migration qui abîme les données au
# lieu d'échouer proprement, et tout disparaissait sans recours.
#
# Ce script ne contient délibérément que de la plomberie. Tout ce qui peut
# faire perdre des données — l'instantané, sa vérification, la rotation — vit
# dans `farmsim-backup.mjs`, en Node, pour pouvoir être éprouvé en intégration
# sur une base jetable plutôt que découvert un jour de panne.
#
#   sudo bash scripts/farmsim-backup.sh              # sauvegarde quotidienne
#   sudo bash scripts/farmsim-backup.sh avant-deploi # étiquetée
#
set -euo pipefail

ÉTIQUETTE="${1:-}"
CONTENEUR="${FARMSIM_CONTAINER:-farmsim}"
DEPOT="${FARMSIM_BACKUP_DIR:-/var/backups/farmsim}"
GARDER="${FARMSIM_BACKUP_KEEP:-14}"

if ! command -v docker >/dev/null 2>&1; then
  echo "ERREUR : docker introuvable — ce script se lance sur l'hôte du jeu." >&2
  exit 1
fi

# Le volume et l'image se lisent sur le conteneur lui-même : les coder en dur
# les ferait diverger de docker-compose.yml au premier changement.
VOLUME="$(docker inspect "$CONTENEUR" -f '{{range .Mounts}}{{if eq .Destination "/data"}}{{.Name}}{{end}}{{end}}' 2>/dev/null || true)"
IMAGE="$(docker inspect "$CONTENEUR" -f '{{.Config.Image}}' 2>/dev/null || true)"

if [[ -z "$VOLUME" || -z "$IMAGE" ]]; then
  echo "ERREUR : conteneur « $CONTENEUR » introuvable, ou sans volume monté sur /data." >&2
  echo "        Vérifiez :  docker ps --filter name=$CONTENEUR" >&2
  exit 1
fi

mkdir -p "$DEPOT"

echo "==> Sauvegarde FARMSIM"
echo "    volume=$VOLUME  dépôt=$DEPOT  conserver=$GARDER"

# Le volume est monté en lecture-écriture, et c'est nécessaire : une base en
# mode WAL ne s'ouvre pas sans pouvoir toucher à son fichier `-shm`. Le seul
# fichier réellement créé est la destination, qui est hors du volume — la base
# du jeu n'est jamais modifiée.
#
# `--user 0:0` parce que l'image tourne normalement sous l'utilisateur farmsim
# (uid 10001), qui n'a aucun droit sur le dossier de sauvegarde de l'hôte.
docker run --rm \
  --user 0:0 \
  -v "${VOLUME}:/data" \
  -v "${DEPOT}:/sauvegardes" \
  -v "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/farmsim-backup.mjs:/opt/farmsim-backup.mjs:ro" \
  -e FARMSIM_DB=/data/farmsim.db \
  -e FARMSIM_BACKUP_DIR=/sauvegardes \
  -e FARMSIM_BACKUP_KEEP="$GARDER" \
  -e FARMSIM_BACKUP_LABEL="$ÉTIQUETTE" \
  --entrypoint node \
  "$IMAGE" /opt/farmsim-backup.mjs

echo "==> Sauvegardes présentes :"
ls -lh "$DEPOT" | tail -n +2 | awk '{print "    " $9 "  " $5}'
