#!/usr/bin/env bash
# Restaure la base FARMSIM depuis une sauvegarde.
#
# C'est le script qu'on lance un mauvais jour, souvent depuis un téléphone, et
# probablement en panique. Il est donc écrit pour être difficile à rater :
#
#   - sans argument, il ne restaure rien : il liste ce qui est disponible ;
#   - il vérifie la sauvegarde **avant** de toucher à quoi que ce soit ;
#   - il met la base actuelle de côté avant de l'écraser, même abîmée : une
#     restauration sur la mauvaise sauvegarde ne doit pas être irréversible ;
#   - il redémarre le jeu et attend que la santé revienne au vert.
#
#   sudo bash scripts/farmsim-restore.sh                                   # liste
#   sudo bash scripts/farmsim-restore.sh farmsim-2026-08-17T031500Z.db     # restaure
#
set -euo pipefail

CHOIX="${1:-}"
CONTENEUR="${FARMSIM_CONTAINER:-farmsim}"
DEPOT="${FARMSIM_BACKUP_DIR:-/var/backups/farmsim}"
APP_DIR="${FARMSIM_DIR:-/opt/farmsim}"
PORT="${FARMSIM_PORT:-8081}"

VOLUME="$(docker inspect "$CONTENEUR" -f '{{range .Mounts}}{{if eq .Destination "/data"}}{{.Name}}{{end}}{{end}}' 2>/dev/null || true)"
IMAGE="$(docker inspect "$CONTENEUR" -f '{{.Config.Image}}' 2>/dev/null || true)"
if [[ -z "$VOLUME" || -z "$IMAGE" ]]; then
  echo "ERREUR : conteneur « $CONTENEUR » introuvable ou sans volume /data." >&2
  exit 1
fi

if [[ -z "$CHOIX" ]]; then
  echo "Sauvegardes disponibles dans $DEPOT :"
  echo
  ls -lh "$DEPOT"/farmsim-*.db 2>/dev/null | awk '{print "  " $9 "   " $5 "   " $6 " " $7 " " $8}' || echo "  (aucune)"
  echo
  echo "Pour restaurer :"
  echo "  sudo bash scripts/farmsim-restore.sh <nom-du-fichier>"
  exit 0
fi

SOURCE="$DEPOT/$(basename "$CHOIX")"
[[ -f "$SOURCE" ]] || { echo "ERREUR : $SOURCE introuvable." >&2; exit 1; }

echo "==> Vérification de la sauvegarde avant toute chose"
# On refuse de démonter une base en service pour la remplacer par un fichier
# qu'on n'a pas relu. Le même contrôle que celui de la sauvegarde.
docker run --rm \
  --user 0:0 \
  -v "${DEPOT}:/sauvegardes:ro" \
  -v "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/farmsim-backup.mjs:/opt/farmsim-backup.mjs:ro" \
  --entrypoint node \
  "$IMAGE" -e "
    import('/opt/farmsim-backup.mjs').then((m) => {
      const r = m.vérifier('/sauvegardes/$(basename "$SOURCE")');
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
docker compose stop farmsim

FILET="$DEPOT/avant-restauration-$(date -u +%Y-%m-%dT%H%M%SZ).db"
echo "==> Mise de côté de la base actuelle → $(basename "$FILET")"
# Une copie brute suffit ici : le conteneur est arrêté, plus personne n'écrit.
# C'est le filet si l'on s'aperçoit qu'on a restauré la mauvaise sauvegarde.
docker run --rm --user 0:0 -v "${VOLUME}:/data" -v "${DEPOT}:/sauvegardes" \
  --entrypoint sh "$IMAGE" -c "cp /data/farmsim.db '/sauvegardes/$(basename "$FILET")' 2>/dev/null || echo '    (aucune base à mettre de côté)'"

echo "==> Remise en place"
# Les fichiers -wal et -shm doivent disparaître : laissés là, ils
# appartiennent à l'ancienne base et SQLite les rejouerait par-dessus la
# nouvelle. C'est le piège classique d'une restauration par simple copie.
docker run --rm --user 0:0 -v "${VOLUME}:/data" -v "${DEPOT}:/sauvegardes:ro" \
  --entrypoint sh "$IMAGE" -c "
    rm -f /data/farmsim.db-wal /data/farmsim.db-shm &&
    cp '/sauvegardes/$(basename "$SOURCE")' /data/farmsim.db &&
    chown 10001:10001 /data/farmsim.db"

echo "==> Redémarrage"
docker compose up -d

echo "==> Attente de la santé…"
for i in $(seq 1 150); do
  if curl -fsS "http://127.0.0.1:${PORT}/api/health" >/dev/null 2>&1; then
    echo "    OK — le jeu répond."
    echo
    echo "Base restaurée depuis $(basename "$SOURCE")."
    echo "L'état précédent reste disponible : $(basename "$FILET")"
    exit 0
  fi
  if (( i % 5 == 0 )); then printf '.'; fi
  sleep 2
done

echo
echo "ERREUR : le jeu ne répond pas après restauration." >&2
docker compose logs --tail=80
exit 1
