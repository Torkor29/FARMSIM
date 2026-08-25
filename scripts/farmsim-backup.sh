#!/usr/bin/env bash
# Sauvegarde la base FARMSIM depuis l'hôte, sans interrompre les joueurs.
#
# Le jeu tient toute sa vie — comptes, fermes, parcelles, argent — dans une
# base PostgreSQL portée par le conteneur `farmsim-db`. Une perte de volume, ou
# une migration qui abîme les données au lieu d'échouer proprement, et tout
# disparaîtrait sans recours.
#
# Ce script ne contient délibérément que de la plomberie. Tout ce qui peut
# faire perdre des données — l'instantané, sa vérification par restauration
# réelle, la rotation — vit dans `farmsim-backup.mjs`, en Node, pour pouvoir
# être éprouvé en intégration sur une base jetable plutôt que découvert un jour
# de panne.
#
#   sudo bash scripts/farmsim-backup.sh              # sauvegarde quotidienne
#   sudo bash scripts/farmsim-backup.sh avant-deploi # étiquetée
#
# Les noms de variables restent en ASCII : bash n'accepte que
# [A-Za-z_][A-Za-z0-9_]*, et un « ÉTIQUETTE » accentué n'est pas une
# affectation mais une commande introuvable. C'est arrivé, en production.
set -euo pipefail

ETIQUETTE="${1:-}"
CONTENEUR="${FARMSIM_CONTAINER:-farmsim}"
CONTENEUR_DB="${FARMSIM_DB_CONTAINER:-farmsim-db}"
DEPOT="${FARMSIM_BACKUP_DIR:-/var/backups/farmsim}"
GARDER="${FARMSIM_BACKUP_KEEP:-14}"

if ! command -v docker >/dev/null 2>&1; then
  echo "ERREUR : docker introuvable — ce script se lance sur l'hôte du jeu." >&2
  exit 1
fi

# L'image et les identifiants se lisent sur le conteneur lui-même : les coder
# en dur les ferait diverger de docker-compose.yml au premier changement, et
# **le mot de passe n'a alors à figurer nulle part ici**.
# L'image du **jeu** : c'est elle qui porte à la fois Node et le client
# PostgreSQL 16, donc de quoi exécuter `farmsim-backup.mjs`. L'image de la base
# n'a pas Node ; celle du jeu a les deux.
IMAGE="$(docker inspect "$CONTENEUR" -f '{{.Config.Image}}' 2>/dev/null || true)"
#
# Les identifiants se demandent au conteneur lui-même plutôt que de découper
# `docker inspect` à l'index près : compter les caractères de
# « POSTGRES_PASSWORD= » est le genre de détail qu'on rate une fois sur deux, et
# l'erreur ne se voit qu'au moment de la panne.
#
# Le mot de passe n'est écrit ni ici ni dans le dépôt : il n'existe que dans le
# `.env` du serveur et dans l'environnement du conteneur qu'il a démarré.
UTILISATEUR="$(docker exec "$CONTENEUR_DB" printenv POSTGRES_USER 2>/dev/null || true)"
UTILISATEUR="${UTILISATEUR:-farmsim}"
MOT_DE_PASSE="$(docker exec "$CONTENEUR_DB" printenv POSTGRES_PASSWORD 2>/dev/null || true)"

if [[ -z "$IMAGE" ]]; then
  echo "ERREUR : conteneur « $CONTENEUR » introuvable." >&2
  echo "        Vérifiez :  docker ps --filter name=$CONTENEUR" >&2
  exit 1
fi

mkdir -p "$DEPOT"

echo "==> Sauvegarde FARMSIM"
echo "    base=$CONTENEUR_DB  dépôt=$DEPOT  conserver=$GARDER"

# La sauvegarde tourne dans un conteneur **jetable** posé sur le réseau du
# conteneur de base : il ne touche ni au jeu en service, ni au volume de
# données. L'image est celle du jeu, qui porte Node **et** le client
# PostgreSQL 16 — un pg_dump plus ancien que le serveur refuse de travailler.
#
# `--user 0:0` parce que l'image tourne normalement sous farmsim (uid 10001),
# qui n'a aucun droit sur le dossier de sauvegarde de l'hôte.
docker run --rm \
  --user 0:0 \
  --network "container:${CONTENEUR_DB}" \
  -v "${DEPOT}:/sauvegardes" \
  -v "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/farmsim-backup.mjs:/opt/farmsim-backup.mjs:ro" \
  -e DATABASE_URL="postgresql://${UTILISATEUR}@127.0.0.1:5432/farmsim" \
  -e PGPASSWORD="$MOT_DE_PASSE" \
  -e PGPASSWORD_FILE_UNUSED=1 \
  -e FARMSIM_BACKUP_DIR=/sauvegardes \
  -e FARMSIM_BACKUP_KEEP="$GARDER" \
  -e FARMSIM_BACKUP_LABEL="$ETIQUETTE" \
  -e FARMSIM_BACKUP_VERIFY="${FARMSIM_BACKUP_VERIFY:-1}" \
  --entrypoint node \
  "$IMAGE" /opt/farmsim-backup.mjs || CODE=$?
CODE="${CODE:-0}"

# Code 3 : la base n'a pas encore de schéma, il n'y a rien à perdre. On le dit
# et on rend la main sans échouer — sans quoi le garde-fou « pas de
# déploiement sans sauvegarde » bloquerait le déploiement qui doit justement
# initialiser cette base. Tout autre code reste un échec.
if [[ "$CODE" == "3" ]]; then
  echo "==> Base pas encore initialisée : rien à sauvegarder, on continue."
  exit 0
elif [[ "$CODE" != "0" ]]; then
  exit "$CODE"
fi

echo "==> Sauvegardes présentes :"
ls -lh "$DEPOT" | tail -n +2 | awk '{print "    " $9 "  " $5}'
