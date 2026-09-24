#!/usr/bin/env bash
#
# Le veilleur : il remet la pile debout quand elle ne répond plus.
#
# `docker-compose.yml` donne aux deux conteneurs un contrôle de santé, et
# `restart: unless-stopped` ne relance que ce qui **sort**. Entre les deux, il
# reste deux états dont personne ne s'occupe, et la nuit du 26 au 27 août les a
# rencontrés tous les deux :
#
#  - **vivant mais figé.** Le processus tourne, le contrôle passe à
#    `unhealthy`, et rien ne s'en sert. Mesuré : plus une réponse à partir de
#    20 h 12, y compris sur `/api/health` — une route qui écrit `{"ok":true}`
#    sans toucher la base. Une heure et demie plus tard, toujours rien.
#  - **arrêté sans être sorti proprement.** Une fenêtre SSH a expiré au milieu
#    d'un `--force-recreate` : `farmsim-db` est resté à l'état `created`, créé
#    et jamais démarré. Le jeu, lui, tournait et se déclarait en bonne santé —
#    son contrôle ne regarde pas la base — pendant que toutes ses routes
#    rendaient 500. À 5 h 31, c'est le jeu lui-même qui ne répondait plus :
#    502 sur tout, y compris les routes sans base.
#
# Un état `created`, `exited` ou `dead` n'est pas `unhealthy` : la version
# précédente de ce script passait à côté. Il regarde donc maintenant l'état du
# conteneur **et** sa santé, et il regarde les **deux** conteneurs — la base
# tombée suffit à rendre le jeu inutilisable sans qu'il s'en aperçoive.
#
# Ce qu'il ne prétend pas être : une guérison. Un conteneur qu'on relance
# toutes les dix minutes est un symptôme. Il fait la différence entre « le jeu
# est mort toute la nuit » et « le jeu a hoqueté deux minutes ».
#
# Posé par `scripts/vps-deploy.sh` comme service systemd, déclenché par une
# minuterie chaque minute.
set -uo pipefail

# La base d'abord : le jeu ne sert à rien sans elle, et la remonter avant lui
# évite de le relancer une seconde fois pour qu'il la retrouve.
CONTENEURS="${FARMSIM_VEILLEUR_CONTENEURS:-farmsim-db farmsim}"
# Délai de garde entre deux interventions **sur un même conteneur**. Une
# machine qui s'effondre dans le swap le rendra malade à nouveau tout de suite
# après ; agir en boucle ne ferait qu'ajouter au désordre, et effacerait la
# trace de ce qui se passe vraiment.
REPOS_S="${FARMSIM_VEILLEUR_REPOS:-600}"
MARQUES="${FARMSIM_VEILLEUR_MARQUES:-/var/lib/farmsim}"

# Toutes les commandes Docker sont bornées : sur cette machine, `docker ps` a
# déjà mis six minutes. Un veilleur qui reste accroché est un veilleur de
# moins, et systemd empilerait les exécutions.
inspecte() {
  timeout 20 docker inspect -f "$2" "$1" 2>/dev/null || true
}

# Ce conteneur a-t-il été touché il y a moins de REPOS_S ?
au_repos() {
  local marque="$MARQUES/derniere-relance-$1"
  [[ -r "$marque" ]] || return 1
  local precedente
  precedente="$(cat "$marque" 2>/dev/null || echo 0)"
  # Une marque illisible ou farfelue ne doit pas condamner le jeu à rester
  # figé : on la traite comme absente.
  [[ "$precedente" =~ ^[0-9]+$ ]] || return 1
  (( $(date +%s) - precedente < REPOS_S ))
}

marquer() {
  mkdir -p "$MARQUES"
  date +%s > "$MARQUES/derniere-relance-$1"
}

for conteneur in $CONTENEURS; do
  etat="$(inspecte "$conteneur" '{{.State.Status}}')"
  sante="$(inspecte "$conteneur" '{{if .State.Health}}{{.State.Health.Status}}{{else}}sans-controle{{end}}')"

  # Conteneur inconnu : ce n'est pas au veilleur de le créer. Un déploiement
  # le fera, avec sa configuration ; en inventer un ici donnerait une pile
  # bâtarde que personne n'a décrite.
  [[ -n "$etat" ]] || continue

  geste=""
  case "$etat" in
    running)
      # `starting` couvre l'amorçage : le monde se peuple avant que le port ne
      # s'ouvre, et cela peut prendre cinq minutes. Relancer là-dessus
      # empêcherait le jeu de démarrer, indéfiniment.
      [[ "$sante" == "unhealthy" ]] && geste="restart"
      ;;
    created|exited|dead|paused)
      # C'est l'état que la version précédente ne voyait pas, et c'est celui
      # qui a tenu le jeu à terre deux fois cette nuit-là.
      geste="start"
      ;;
    *) ;;
  esac

  [[ -n "$geste" ]] || continue

  if au_repos "$conteneur"; then
    echo "farmsim-veilleur : $conteneur toujours en $etat/$sante, mais touché il y a moins de ${REPOS_S} s — on attend." >&2
    continue
  fi

  marquer "$conteneur"
  echo "farmsim-veilleur : $conteneur est en $etat/$sante — $geste."
  # Les cent dernières lignes avant d'agir : sans elles, la relance efface la
  # seule trace de ce qui a figé le processus.
  timeout 30 docker logs --tail=100 "$conteneur" 2>&1 | sed 's/^/    /' || true
  if timeout 120 docker "$geste" "$conteneur"; then
    echo "farmsim-veilleur : $conteneur $geste fait."
  else
    echo "farmsim-veilleur : $geste sur $conteneur a échoué." >&2
  fi
done
