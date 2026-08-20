#!/usr/bin/env bash
# Restaure la base FARMSIM depuis une sauvegarde.
#
# C'est le script qu'on lance un mauvais jour, souvent depuis un téléphone, et
# probablement en panique. Il est donc écrit pour être difficile à rater :
#
#   - sans argument, il ne restaure rien : il liste ce qui est disponible ;
#   - il vérifie la sauvegarde **avant** de toucher à quoi que ce soit, en la
#     restaurant pour de bon dans une base jetable ;
#   - il met la base actuelle de côté avant de l'écraser, même abîmée : une
#     restauration sur la mauvaise sauvegarde ne doit pas être irréversible ;
#   - il redémarre le jeu et attend que la santé revienne au vert.
#
#   sudo bash scripts/farmsim-restore.sh                                     # liste
#   sudo bash scripts/farmsim-restore.sh farmsim-2026-08-17T031500Z.dump     # restaure
#
set -euo pipefail

CHOIX="${1:-}"
CONTENEUR="${FARMSIM_CONTAINER:-farmsim}"
CONTENEUR_DB="${FARMSIM_DB_CONTAINER:-farmsim-db}"
DEPOT="${FARMSIM_BACKUP_DIR:-/var/backups/farmsim}"
APP_DIR="${FARMSIM_DIR:-/opt/farmsim}"
PORT="${FARMSIM_PORT:-8081}"

IMAGE="$(docker inspect "$CONTENEUR" -f '{{.Config.Image}}' 2>/dev/null || true)"
if [[ -z "$IMAGE" ]]; then
  echo "ERREUR : conteneur « $CONTENEUR » introuvable." >&2
  exit 1
fi

if [[ -z "$CHOIX" ]]; then
  echo "Sauvegardes disponibles dans $DEPOT :"
  echo
  ls -lh "$DEPOT"/farmsim-*.dump 2>/dev/null | awk '{print "  " $9 "   " $5 "   " $6 " " $7 " " $8}' || echo "  (aucune)"
  echo
  echo "Pour restaurer :"
  echo "  sudo bash scripts/farmsim-restore.sh <nom-du-fichier>"
  exit 0
fi

SOURCE="$DEPOT/$(basename "$CHOIX")"
[[ -f "$SOURCE" ]] || { echo "ERREUR : $SOURCE introuvable." >&2; exit 1; }

UTILISATEUR="$(docker exec "$CONTENEUR_DB" printenv POSTGRES_USER 2>/dev/null || true)"
UTILISATEUR="${UTILISATEUR:-farmsim}"
MOT_DE_PASSE="$(docker exec "$CONTENEUR_DB" printenv POSTGRES_PASSWORD 2>/dev/null || true)"

# Toutes les opérations de base passent par un conteneur jetable posé sur le
# réseau de la base : l'image du jeu porte Node et le client PostgreSQL 16.
pg() {
  docker run --rm --user 0:0 \
    --network "container:${CONTENEUR_DB}" \
    -v "${DEPOT}:/sauvegardes" \
    -v "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/farmsim-backup.mjs:/opt/farmsim-backup.mjs:ro" \
    -e PGPASSWORD="$MOT_DE_PASSE" \
    -e DATABASE_URL="postgresql://${UTILISATEUR}@127.0.0.1:5432/farmsim" \
    --entrypoint "$1" "$IMAGE" "${@:2}"
}

echo "==> Vérification de la sauvegarde avant toute chose"
# On refuse de remplacer une base en service par un fichier qu'on n'a pas relu.
# `vérifier` la restaure réellement dans une base jetable, puis la jette.
pg node -e "
  import('/opt/farmsim-backup.mjs').then((m) => {
    const r = m.vérifier('/sauvegardes/$(basename "$SOURCE")', process.env.DATABASE_URL);
    const compte = Object.entries(r.lignes).map(([t, n]) => t + ' ' + n).join(' · ');
    console.log('    OK · ' + (r.octets / 1048576).toFixed(2) + ' Mo · ' + compte);
  }).catch((e) => { console.error('    REFUSÉE : ' + e.message); process.exit(1); });
"

echo
echo "Cette opération remplace la base en service par $(basename "$SOURCE")."
echo "Tout ce que les joueurs ont fait depuis cette sauvegarde sera perdu."
read -r -p "Tapez RESTAURER pour continuer : " REPONSE
[[ "$REPONSE" == "RESTAURER" ]] || { echo "Annulé."; exit 0; }

cd "$APP_DIR"
echo "==> Arrêt du jeu"
# Seul le jeu s'arrête : la base doit rester debout pour recevoir la
# restauration. C'est aussi ce qui garantit que plus personne n'écrit pendant
# qu'on remplace les données.
docker compose stop farmsim

FILET="avant-restauration-$(date -u +%Y-%m-%dT%H%M%SZ).dump"
echo "==> Mise de côté de la base actuelle → $FILET"
# Le filet si l'on s'aperçoit qu'on a restauré la mauvaise sauvegarde. Il est
# pris même si la base est en mauvais état : `|| true`, parce qu'un filet
# impossible ne doit pas empêcher la réparation.
pg pg_dump "postgresql://${UTILISATEUR}@127.0.0.1:5432/farmsim" \
  --format=custom --compress=6 --no-owner --no-privileges \
  --file "/sauvegardes/$FILET" || echo "    (aucune base à mettre de côté)"

echo "==> Remise en place"
# `--clean --if-exists` efface les objets avant de les recréer : sans cela, la
# restauration s'ajouterait à ce qui reste et doublerait tout. On vise la base
# `postgres` pour pouvoir recréer entièrement `farmsim`.
pg psql "postgresql://${UTILISATEUR}@127.0.0.1:5432/postgres" -v ON_ERROR_STOP=1 -q \
  -c "DROP DATABASE IF EXISTS farmsim WITH (FORCE)" \
  -c "CREATE DATABASE farmsim OWNER ${UTILISATEUR}"
pg pg_restore --dbname "postgresql://${UTILISATEUR}@127.0.0.1:5432/farmsim" \
  --no-owner --no-privileges --exit-on-error "/sauvegardes/$(basename "$SOURCE")"

echo "==> Redémarrage"
docker compose up -d

echo "==> Attente de la santé…"
for i in $(seq 1 150); do
  if curl -fsS "http://127.0.0.1:${PORT}/api/health" >/dev/null 2>&1; then
    echo "    OK — le jeu répond."
    echo
    echo "Base restaurée depuis $(basename "$SOURCE")."
    echo "L'état précédent reste disponible : $FILET"
    exit 0
  fi
  if (( i % 5 == 0 )); then printf '.'; fi
  sleep 2
done

echo
echo "ERREUR : le jeu ne répond pas après restauration." >&2
docker compose logs --tail=80
exit 1
