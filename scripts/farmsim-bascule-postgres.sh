#!/usr/bin/env bash
# Bascule les données de l'ancienne base SQLite vers PostgreSQL.
#
# À lancer **une fois**, sur le VPS, après que le déploiement a monté
# PostgreSQL. Le jeu tourne alors sur une base vide : ce script y verse la ferme
# d'avant.
#
#   sudo bash /opt/farmsim/scripts/farmsim-bascule-postgres.sh
#
# Il est écrit pour être relançable et difficile à rater :
#
#   - il refuse d'écraser une base qui contient de vrais joueurs, sauf si on
#     le lui demande explicitement (--vraiment) ;
#   - il sauvegarde ce qu'il s'apprête à remplacer, quand il y a quelque chose ;
#   - il vérifie le fichier source avant de toucher à quoi que ce soit ;
#   - le transfert lui-même recompte les deux côtés et échoue si un seul nombre
#     diffère.
#
# L'ancienne base n'est jamais modifiée : elle reste sur son volume, intacte.
set -euo pipefail

VRAIMENT="${1:-}"
APP_DIR="${FARMSIM_DIR:-/opt/farmsim}"
CONTENEUR="${FARMSIM_CONTAINER:-farmsim}"
CONTENEUR_DB="${FARMSIM_DB_CONTAINER:-farmsim-db}"
DEPOT="${FARMSIM_BACKUP_DIR:-/var/backups/farmsim}"
SOURCE="${FARMSIM_SQLITE:-/tmp/farmsim-avant-bascule.db}"
PORT="${FARMSIM_PORT:-8081}"

dire() { echo "==> $*"; }
mourir() { echo "ERREUR : $*" >&2; exit 1; }

# Le jeu est-il arrêté de notre fait, en ce moment ?
JEU_ARRETE=0

# Quoi qu'il arrive, le jeu redémarre.
#
# Ce script arrête le conteneur au milieu, et `set -e` le fait sortir au
# premier faux pas. C'est arrivé — une date illisible dans la source — et le
# jeu est resté éteint jusqu'à ce que quelqu'un s'en aperçoive. Une bascule
# qui échoue doit coûter une bascule, pas une coupure de service.
au_retour() {
  local code=$?
  if [[ "$JEU_ARRETE" == "1" ]]; then
    echo >&2
    echo "==> Bascule interrompue : le jeu est remis en service." >&2
    docker compose up -d >/dev/null 2>&1 || \
      echo "    (échec du redémarrage — lancez : sudo docker compose up -d)" >&2
  fi
  exit "$code"
}
trap au_retour EXIT

command -v docker >/dev/null 2>&1 || mourir "docker introuvable — ce script se lance sur l'hôte du jeu."
[[ -d "$APP_DIR" ]] || mourir "$APP_DIR introuvable."
cd "$APP_DIR"

docker inspect "$CONTENEUR_DB" >/dev/null 2>&1 \
  || mourir "conteneur « $CONTENEUR_DB » absent — lancez d'abord : sudo docker compose up -d"

IMAGE="$(docker inspect "$CONTENEUR" -f '{{.Config.Image}}' 2>/dev/null || true)"
[[ -n "$IMAGE" ]] || mourir "conteneur « $CONTENEUR » introuvable — le jeu n'a jamais démarré ?"
UTILISATEUR="$(docker exec "$CONTENEUR_DB" printenv POSTGRES_USER 2>/dev/null || echo farmsim)"
MOT_DE_PASSE="$(docker exec "$CONTENEUR_DB" printenv POSTGRES_PASSWORD 2>/dev/null || true)"
[[ -n "$MOT_DE_PASSE" ]] || mourir "mot de passe de la base illisible sur le conteneur."

URL_JEU="postgresql://${UTILISATEUR}:${MOT_DE_PASSE}@127.0.0.1:5432/farmsim"
URL_ADMIN="postgresql://${UTILISATEUR}:${MOT_DE_PASSE}@127.0.0.1:5432/postgres"

# Tout ce qui parle à la base passe par un conteneur jetable posé sur son
# réseau : aucun port n'est ouvert sur l'hôte, et les outils sont à la bonne
# version puisqu'ils viennent de l'image du jeu.
pg() {
  local entree="$1"; shift
  docker run --rm --user 0:0 \
    --network "container:${CONTENEUR_DB}" \
    -v /tmp:/tmp-hote \
    -v "${DEPOT}:/sauvegardes" \
    -v "${APP_DIR}/scripts:/scripts:ro" \
    -e PGPASSWORD="$MOT_DE_PASSE" \
    -e DATABASE_URL="$URL_JEU" \
    --entrypoint "$entree" "$IMAGE" "$@"
}

# ————————————————————————————————————————————————————————————————
# 1. Le fichier source
# ————————————————————————————————————————————————————————————————
if [[ ! -f "$SOURCE" ]]; then
  dire "Extraction de l'ancienne base depuis son volume"
  # Compose préfixe ses volumes du nom du projet : on cherche plutôt que de
  # deviner. Un nom inexistant ferait créer à Docker un volume **vide** sans
  # rien dire, et la copie échouerait sur un « No such file » trompeur.
  VOLUME=""
  for v in $(docker volume ls -q | grep -i 'farmsim.*data' || true); do
    if docker run --rm -v "$v":/d alpine test -f /d/farmsim.db 2>/dev/null; then
      VOLUME="$v"; break
    fi
  done
  [[ -n "$VOLUME" ]] || mourir "aucun volume ne contient farmsim.db — indiquez le fichier par FARMSIM_SQLITE=..."
  dire "    volume trouvé : $VOLUME"
  docker run --rm -v "$VOLUME":/data -v /tmp:/sortie alpine cp /data/farmsim.db "/sortie/$(basename "$SOURCE")"
fi
[[ -s "$SOURCE" ]] || mourir "$SOURCE est vide."
dire "Source : $SOURCE ($(du -h "$SOURCE" | cut -f1))"

# ————————————————————————————————————————————————————————————————
# 2. Que contient déjà la base d'arrivée ?
# ————————————————————————————————————————————————————————————————
SCHEMA_PRESENT="$(pg psql "$URL_JEU" -tAc "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public' AND table_name='User'" | tr -d '[:space:]')"
JOUEURS=0
if [[ "$SCHEMA_PRESENT" == "1" ]]; then
  # Les fermes PNJ sont semées à chaque démarrage : elles ne comptent pas comme
  # des données à perdre. Un vrai joueur, si.
  JOUEURS="$(pg psql "$URL_JEU" -tAc 'SELECT COUNT(*) FROM "User" WHERE COALESCE("isNpc", false) = false' | tr -d '[:space:]')"
fi
dire "Base d'arrivée : schéma=${SCHEMA_PRESENT:-0} · joueurs réels=${JOUEURS}"

if [[ "${JOUEURS:-0}" -gt 0 && "$VRAIMENT" != "--vraiment" ]]; then
  echo >&2
  echo "ERREUR : la base PostgreSQL contient déjà ${JOUEURS} compte(s) réel(s) :" >&2
  # On les **nomme**. « Il y a des joueurs » ne permet pas de décider ; voir
  # que ce sont trois adresses tapées au hasard aujourd'hui, si. C'est
  # exactement la question que se pose celui qui lit ce message : est-ce que
  # ce sont mes données, ou des essais ?
  pg psql "$URL_JEU" -c \
    'SELECT email, "displayName", "createdAt" FROM "User" WHERE COALESCE("isNpc", false) = false ORDER BY "createdAt"' >&2 || true
  cat >&2 <<TXT

Ce script remplace tout : si ces comptes ont joué depuis, leur travail sera
perdu. Regardez la liste ci-dessus et tranchez :

  - vous y reconnaissez votre compte d'avant la bascule
    → elle a déjà eu lieu, il n'y a rien à faire ;

  - ce sont des comptes d'essai créés depuis, et vous acceptez de les perdre
    → sudo bash $0 --vraiment

Dans tous les cas, l'ancienne base SQLite reste intacte sur son volume.
TXT
  exit 1
fi

# ————————————————————————————————————————————————————————————————
# 3. Le filet
# ————————————————————————————————————————————————————————————————
dire "Arrêt du jeu (la base reste debout)"
docker compose stop "$CONTENEUR" >/dev/null
JEU_ARRETE=1

if [[ "$SCHEMA_PRESENT" == "1" ]]; then
  dire "Sauvegarde de ce qui va être remplacé"
  mkdir -p "$DEPOT"
  FILET="avant-bascule-$(date -u +%Y-%m-%dT%H%M%SZ).dump"
  pg pg_dump "$URL_JEU" --format=custom --compress=6 --no-owner --no-privileges \
    --file "/sauvegardes/$FILET" || dire "    (rien à sauvegarder)"
fi

# ————————————————————————————————————————————————————————————————
# 4. Base neuve, schéma neuf
# ————————————————————————————————————————————————————————————————
dire "Remise à zéro de la base"
pg psql "$URL_ADMIN" -v ON_ERROR_STOP=1 -q \
  -c "DROP DATABASE IF EXISTS farmsim WITH (FORCE)" \
  -c "CREATE DATABASE farmsim OWNER ${UTILISATEUR}"

dire "Application des migrations"
# Par `sh -c` : `--entrypoint` veut un exécutable, et le CLI Prisma est désigné
# par un chemin relatif au dossier de travail de l'image — c'est le shell qui
# sait le résoudre, exactement comme le fait le CMD du Dockerfile.
pg sh -c "./node_modules/.bin/prisma migrate deploy" 

# ————————————————————————————————————————————————————————————————
# 5. Le transfert
# ————————————————————————————————————————————————————————————————
dire "Transfert des données"
pg node --disable-warning=ExperimentalWarning \
  /scripts/farmsim-vers-postgres.mjs "/tmp-hote/$(basename "$SOURCE")" "$URL_JEU"

# ————————————————————————————————————————————————————————————————
# 6. Retour en service
# ————————————————————————————————————————————————————————————————
dire "Redémarrage"
docker compose up -d >/dev/null
JEU_ARRETE=0

dire "Attente de la santé…"
for i in $(seq 1 90); do
  if curl -fsS "http://127.0.0.1:${PORT}/api/health" >/dev/null 2>&1; then
    echo
    dire "Le jeu répond. Bascule terminée."
    echo
    echo "Vérifiez à l'œil : votre compte, votre ferme, vos bâtiments, votre argent."
    echo "Puis prenez la première sauvegarde PostgreSQL :"
    echo "  sudo bash $APP_DIR/scripts/farmsim-backup.sh apres-bascule"
    echo
    echo "L'ancienne base SQLite reste intacte sur son volume. Ne la supprimez"
    echo "pas avant une bonne semaine de fonctionnement normal."
    exit 0
  fi
  if (( i % 5 == 0 )); then printf '.'; fi
  sleep 2
done

echo
mourir "le jeu ne répond pas après la bascule — voir : docker compose logs --tail=80 farmsim"
