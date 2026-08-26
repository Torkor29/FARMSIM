#!/usr/bin/env bash
#
# Le veilleur : il relance le jeu quand il ne répond plus.
#
# `docker-compose.yml` donne au conteneur du jeu un contrôle de santé — un
# appel à `/api/health`, une route qui ne touche pas la base et ne peut donc
# échouer que si le processus est mort ou si sa boucle d'événements est
# bloquée. Ce contrôle tourne, il passe à `unhealthy`… et **rien ne s'en
# sert**. `restart: unless-stopped` ne relance qu'un conteneur qui *sort* :
# un conteneur vivant mais figé reste figé.
#
# Mesuré le 26 août : le site n'a plus répondu à partir de 20 h 12. La
# poignée de main TLS aboutissait en trois secondes — le portier était donc
# debout — puis plus rien pendant cinquante-sept secondes, y compris sur
# `/api/health`. Une heure et demie plus tard, toujours rien. Personne ne
# pouvait le savoir avant qu'un joueur ne s'en plaigne, et personne ne
# pouvait le relancer avant qu'un humain n'ouvre une session.
#
# Ce script comble ce trou, et rien de plus. Il ne remplace ni les plafonds
# de ressources (voir docs/PLAFONDS.md) ni une machine assez grande : un
# conteneur qu'on relance toutes les dix minutes est un symptôme, pas une
# guérison. Il fait la différence entre « le jeu est mort toute la soirée »
# et « le jeu a hoqueté deux minutes ».
#
# Posé par `scripts/vps-deploy.sh` comme service systemd, déclenché par une
# minuterie chaque minute.
set -uo pipefail

CONTENEUR="${FARMSIM_CONTENEUR:-farmsim}"
# Délai de garde entre deux relances. Une machine qui s'effondre dans le swap
# rendra le conteneur malade à nouveau tout de suite après ; le relancer en
# boucle ne ferait qu'ajouter au désordre — et effacerait la trace de ce qui
# se passe vraiment.
REPOS_S="${FARMSIM_VEILLEUR_REPOS:-600}"
MARQUE="${FARMSIM_VEILLEUR_MARQUE:-/var/lib/farmsim/derniere-relance}"

# Toutes les commandes Docker sont bornées : sur cette machine, `docker ps` a
# déjà mis six minutes. Un veilleur qui reste accroché est un veilleur de
# moins, et systemd empilerait les exécutions.
etat="$(timeout 20 docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}sans-controle{{end}}' "$CONTENEUR" 2>/dev/null || true)"

case "$etat" in
  unhealthy) ;;
  # `starting` couvre la période d'amorçage (cinq minutes : le monde se peuple
  # avant que le port ne s'ouvre). Relancer là-dessus empêcherait le jeu de
  # démarrer, indéfiniment.
  healthy|starting|"") exit 0 ;;
  sans-controle)
    echo "farmsim-veilleur : le conteneur n'a pas de contrôle de santé — rien à surveiller." >&2
    exit 0
    ;;
  *) exit 0 ;;
esac

maintenant="$(date +%s)"
if [[ -r "$MARQUE" ]]; then
  precedente="$(cat "$MARQUE" 2>/dev/null || echo 0)"
  # Une marque illisible ou farfelue ne doit pas bloquer une relance légitime.
  [[ "$precedente" =~ ^[0-9]+$ ]] || precedente=0
  if (( maintenant - precedente < REPOS_S )); then
    echo "farmsim-veilleur : $CONTENEUR toujours malade, mais relancé il y a $(( maintenant - precedente )) s — on attend." >&2
    exit 0
  fi
fi

mkdir -p "$(dirname "$MARQUE")"
echo "$maintenant" > "$MARQUE"

echo "farmsim-veilleur : $CONTENEUR est unhealthy — relance."
# Les cent dernières lignes avant de couper : sans elles, la relance efface la
# seule trace de ce qui a figé le processus.
timeout 30 docker logs --tail=100 "$CONTENEUR" 2>&1 | sed 's/^/    /' || true
timeout 120 docker restart "$CONTENEUR" || {
  echo "farmsim-veilleur : la relance a échoué." >&2
  exit 1
}
echo "farmsim-veilleur : $CONTENEUR relancé."
