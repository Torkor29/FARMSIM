#!/usr/bin/env bash
# Déploie ou met à jour FARMSIM sur le VPS. Pile autonome (aucun réseau ni
# conteneur externe requis) ; le HTTPS est servi par le portier commun du
# serveur, une pile Caddy séparée — voir deploy/Caddyfile.farmsim.exemple.caddy.
# À lancer en root OU : sudo bash -c 'curl -fsSL ... | bash'
set -euo pipefail

REPO_URL="${FARMSIM_REPO_URL:-https://github.com/Torkor29/FARMSIM.git}"
BRANCH="${FARMSIM_BRANCH:-main}"
APP_DIR="${FARMSIM_DIR:-/opt/farmsim}"
# Facultatif : renseignez pour que le test HTTPS final porte sur le bon nom.
DOMAIN="${FARMSIM_DOMAIN:-}"

echo "==> FARMSIM deploy"
echo "    dir=$APP_DIR branch=$BRANCH"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "ERROR: lance en root, ou :" >&2
  echo "  sudo bash -c 'curl -fsSL https://raw.githubusercontent.com/Torkor29/FARMSIM/${BRANCH}/scripts/vps-deploy.sh | bash'" >&2
  exit 1
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "ERROR: docker introuvable. Tu n'es pas sur l'hôte Docker." >&2
  exit 1
fi

# --- git ---
mkdir -p "$(dirname "$APP_DIR")"
if [[ ! -d "$APP_DIR/.git" ]]; then
  rm -rf "$APP_DIR"
  git clone --branch "$BRANCH" "$REPO_URL" "$APP_DIR"
else
  cd "$APP_DIR"
  git fetch origin
  git checkout "$BRANCH"
  git reset --hard "origin/$BRANCH"
  git clean -fd
fi
cd "$APP_DIR"

# --- .env ---
[[ -f .env ]] || cp .env.example .env

echo "==> Build & start"
docker compose up -d --build --force-recreate

# Un volume nommé créé par une exécution antérieure — ou par une image
# construite avec un uid différent — garde son propriétaire d'origine tant
# que personne ne le change explicitement. On force la propriété une fois ;
# sans effet si elle était déjà correcte (voir deploiement/ du dépôt Vigie,
# check-list « Ajouter un site ou un service »).
echo "==> Vérification des droits sur le volume de données"
DATA_VOL="$(docker inspect farmsim -f '{{range .Mounts}}{{if eq .Destination "/data"}}{{.Name}}{{end}}{{end}}' 2>/dev/null || true)"
if [[ -n "$DATA_VOL" ]]; then
  docker run --rm -v "${DATA_VOL}:/data" busybox chown -R 10001:10001 /data
  docker compose up -d
else
  echo "WARN: volume /data introuvable sur le conteneur farmsim — vérifie docker-compose.yml" >&2
fi

# Le serveur amorce le monde — régions, parcelles, fermes voisines — **avant**
# d'ouvrir son port. Sur une base déjà en service, une migration qui introduit
# une population nouvelle (les fermes PNJ, par exemple) la fait créer d'un coup
# au démarrage suivant : plus d'un millier d'écritures en série. Cinquante
# secondes n'y suffisaient pas, et le script déclarait en panne un conteneur
# qui travaillait très bien. Ce coût n'est payé qu'une fois : au démarrage
# d'après, l'amorçage constate que tout est en place et rend la main aussitôt.
echo "==> Attente health… (le premier démarrage après migration peut être long)"
ok=0
for i in $(seq 1 150); do
  if curl -fsS "http://127.0.0.1:${FARMSIM_PORT:-8081}/api/health" >/tmp/farmsim-health.json 2>/dev/null; then
    ok=1
    break
  fi
  # Un point toutes les dix secondes : on doit voir que ça avance.
  if (( i % 5 == 0 )); then printf '.'; fi
  sleep 2
done
echo

docker ps --filter name=farmsim --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'

if [[ "$ok" -ne 1 ]]; then
  echo "ERROR: health local KO" >&2
  docker compose logs --tail=100
  exit 1
fi

echo "==> Health local OK:"
cat /tmp/farmsim-health.json
echo

if [[ -n "$DOMAIN" ]]; then
  echo "==> Test HTTPS…"
  sleep 3
  if curl -fsSI "https://${DOMAIN}/api/health" | head -n 1; then
    echo "DONE — https://${DOMAIN} répond."
  else
    echo "WARN: local OK mais HTTPS encore KO."
    echo "Vérifie le fichier de site du portier commun (ex. /opt/proxy/sites/${DOMAIN}.caddy)"
    echo "et recharge-le sans interrompre les autres sites :"
    echo "  docker compose -f /opt/proxy/docker-compose.yml exec caddy caddy reload --config /etc/caddy/Caddyfile"
  fi
else
  echo "==> FARMSIM_DOMAIN non renseigné — étape HTTPS sautée."
  echo "    Relance avec FARMSIM_DOMAIN=mon-jeu.fr pour la vérification finale."
fi
