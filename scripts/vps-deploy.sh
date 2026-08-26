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

# --- état de la machine ---
#
# Deux diagnostics faux de suite ont coûté des heures : « des constructions
# orphelines saturent le serveur » (le journal a répondu « aucune ») puis
# « le disque est plein » (il était à 78 %, treize gigaoctets libres). À
# chaque fois on corrigeait une cause plausible sans jamais l'avoir mesurée.
#
# Ce que le journal montrait vraiment, c'est que **tout** est lent sur cette
# machine : `docker ps` en six minutes, `df` en une minute et demie, quatre
# `git fetch` d'affilée en échec. Une commande qui ne fait que lire une table
# du noyau ne met pas une minute — sauf si la machine s'effondre dans le
# swap, ou si un processus la monopolise.
#
# Ces quatre lignes coûtent moins d'une seconde et disent lequel des deux.
# Elles passent en premier, avant tout ce qui pourrait échouer : un
# diagnostic qu'on n'obtient qu'en cas de succès ne sert à rien.
echo "==> État de la machine"
uptime 2>/dev/null | sed 's/^/    /' || true
free -m 2>/dev/null | sed -n '1,3p' | sed 's/^/    /' || true
echo "    les cinq processus les plus gourmands en mémoire :"
ps -eo pid,pmem,pcpu,etimes,comm --sort=-pmem 2>/dev/null | head -6 | sed 's/^/      /' || true

# Une machine à genoux ne se déploie pas : on le dit tout de suite.
#
# Mesuré ici : charge moyenne 25 à 31 sur un serveur de deux gigaoctets, un
# gigaoctet et quart déjà dans le swap. Dans cet état chaque commande met des
# minutes, la fenêtre de quarante minutes se consume en diagnostics, et
# l'échec final ne dit rien de la cause. Autant l'annoncer à la première
# seconde, avec le chiffre qui le prouve.
#
# On n'interrompt pas pour autant — un déploiement qui a une chance
# d'aboutir vaut mieux qu'un refus — mais quiconque lit le journal saura où
# regarder au lieu de soupçonner le déploiement.
charge="$(cut -d' ' -f1 /proc/loadavg 2>/dev/null || echo 0)"
coeurs="$(nproc 2>/dev/null || echo 1)"
if awk -v c="$charge" -v n="$coeurs" 'BEGIN{exit !(c > n * 4)}' 2>/dev/null; then
  echo "WARN: charge $charge pour $coeurs cœur(s) — la machine est saturée." >&2
  echo "      Les commandes vont mettre des minutes. Si ce déploiement échoue," >&2
  echo "      la cause est ici, pas dans le script : redémarrez le serveur ou" >&2
  echo "      donnez-lui plus de mémoire." >&2
fi

# --- reprise après un déploiement coupé ---
#
# Trois déploiements de suite ont échoué, et le troisième a mis le jeu à
# terre. L'enchaînement, une fois reconstitué, est le même à chaque fois :
#
#  1. la construction de l'image dépasse le délai de la session SSH ;
#  2. couper la session **ne tue pas** le `docker build` lancé derrière : il
#     continue à tourner sur la machine, sans personne pour l'attendre ;
#  3. le déploiement suivant démarre sur un serveur saturé par cet orphelin.
#     Mesuré : trois cent vingt-cinq secondes pour transférer six kilo-octets
#     de Dockerfile, cinq minutes pour ouvrir une session SSH, puis un
#     `git fetch` qui expire au bout d'un quart d'heure.
#
# Un échec en causait donc un second, puis un troisième. On casse la chaîne
# ici, avant de toucher à quoi que ce soit d'autre : c'est le premier travail
# du script, parce que tout le reste en dépend.
#
# Le filtre est volontairement étroit — un processus de construction, et âgé
# de plus de dix minutes. Un déploiement légitime en cours n'a jamais dix
# minutes au moment où celui-ci démarre, puisqu'ils ne peuvent pas se
# chevaucher (voir la clause `concurrency` du workflow).
echo "==> Recherche de constructions orphelines"
trouves=0
for pid in $(pgrep -f 'docker.*build|buildx' 2>/dev/null || true); do
  age="$(ps -o etimes= -p "$pid" 2>/dev/null | tr -d ' ' || true)"
  [[ -n "$age" ]] || continue
  (( age > 600 )) || continue
  echo "    construction orpheline : pid $pid, ${age}s — arrêt"
  kill -TERM "$pid" 2>/dev/null || true
  trouves=$((trouves + 1))
done
if (( trouves > 0 )); then
  sleep 5
  for pid in $(pgrep -f 'docker.*build|buildx' 2>/dev/null || true); do
    kill -KILL "$pid" 2>/dev/null || true
  done
  echo "    $trouves arrêtée(s) ; on laisse la machine respirer"
  sleep 10
else
  echo "    aucune"
fi

# Et les sauvegardes orphelines, qui ne sont pas des constructions.
#
# Le filtre ci-dessus ne cherchait que des `docker build`, parce que c'est par
# là que le problème est arrivé. Mais un déploiement peut être coupé n'importe
# où, et il l'a été **pendant la sauvegarde** : celle-ci tourne dans un
# conteneur jetable qui, lui, survit très bien à la mort de la session. Le
# déploiement suivant lançait alors une seconde sauvegarde par-dessus la
# première, sur la même base, et les deux se disputaient la machine.
#
# Un conteneur de sauvegarde de plus de dix minutes n'appartient à personne :
# le déploiement en cours vient tout juste de commencer.
# Chaque appel à Docker est borné. Mesuré sur cette machine : ce `docker ps`
# a mis **vingt et une minutes** à répondre, soit plus de la moitié de la
# fenêtre de déploiement, consommée par le code censé la protéger. Un
# diagnostic qui coûte plus cher que la panne qu'il cherche n'est pas un
# diagnostic.
for cid in $(timeout 60 docker ps --format '{{.ID}} {{.Command}}' 2>/dev/null \
             | grep -F 'farmsim-backup.mjs' | cut -d' ' -f1 || true); do
  debut="$(timeout 20 docker inspect "$cid" -f '{{.State.StartedAt}}' 2>/dev/null || true)"
  [[ -n "$debut" ]] || continue
  age=$(( $(date +%s) - $(date -d "$debut" +%s 2>/dev/null || echo 0) ))
  (( age > 600 )) || continue
  echo "    sauvegarde orpheline : $cid, ${age}s — arrêt"
  timeout 60 docker rm -f "$cid" >/dev/null 2>&1 || true
done

# --- le disque ---
#
# Le symptôme qui a mis des heures à se laisser lire : `docker ps` et
# `docker inspect` prenaient **plusieurs minutes**, le script de sauvegarde
# mettait dix minutes à atteindre sa première ligne, `/health` répondait mais
# `/world` — qui lit la base — expirait. Aucune construction orpheline ne
# tournait ; la machine n'était pas occupée, elle était **pleine**.
#
# Trois constructions ratées d'affilée laissent derrière elles autant de jeux
# de couches intermédiaires. Sur un VPS modeste ça suffit à saturer le disque,
# et un disque saturé ne ralentit pas seulement Docker : PostgreSQL ne peut
# plus écrire, donc plus se sauvegarder, donc le déploiement s'arrête sur un
# échec de sauvegarde qui n'a rien à voir avec la sauvegarde.
#
# On fait donc le ménage avant tout le reste, et on l'affiche : c'est la seule
# façon de savoir, la prochaine fois, si le disque était en cause.
#
# `--volumes` n'est **jamais** employé : les données du jeu vivent dans un
# volume nommé, et cette option les effacerait. Les images encore utilisées
# par un conteneur en marche sont conservées par construction.
echo "==> Place disque avant ménage"
timeout 60 df -h / | tail -n +2 | awk '{print "    " $5 " occupé, " $4 " libre sur " $2}'
# Le ménage n'a de raison d'être que si le disque est réellement plein.
#
# Mesuré le 26 août : 27 % occupé, 42 Go libres, et les deux `prune` ont
# quand même tenu **dix minutes** — cinq pour le cache (borne atteinte),
# quatre pour les images — avant de rendre exactement la même place. Sur une
# machine déjà dans le swap, ces dix minutes sont la fenêtre de déploiement.
# On ne les dépense que si le disque dépasse 70 %.
occupe_pct="$(timeout 60 df --output=pcent / | tail -1 | tr -dc '0-9' || true)"
if [[ -n "$occupe_pct" ]] && (( occupe_pct < 70 )); then
  echo "==> Ménage Docker sauté (${occupe_pct} % occupé) — le disque n'est pas en cause."
else
  echo "==> Ménage Docker (cache de construction et images orphelines)"
  timeout 300 docker builder prune -af >/dev/null 2>&1 || echo "    (cache : ménage incomplet)"
  timeout 300 docker image prune -f >/dev/null 2>&1 || echo "    (images : ménage incomplet)"
  timeout 120 docker container prune -f >/dev/null 2>&1 || true
fi
# Les journaux de conteneurs, que le ménage Docker ne touche pas.
#
# Le pilote `json-file` écrit sans jamais tourner tant qu'on ne le lui a pas
# demandé. `docker-compose.yml` le lui demande désormais, mais ce réglage ne
# s'applique qu'aux conteneurs **créés ensuite** : ceux qui tournent depuis
# des semaines gardent leur journal sans limite, et c'est précisément
# celui-là qui a rempli le disque. On les vide ici une bonne fois.
#
# On tronque, on ne supprime pas : Docker garde le fichier ouvert, et
# l'effacer lui ferait écrire dans un fichier fantôme jusqu'au prochain
# redémarrage — la place ne serait même pas rendue.
echo "==> Journaux de conteneurs volumineux"
vides=0
for f in /var/lib/docker/containers/*/*-json.log; do
  [[ -f "$f" ]] || continue
  taille="$(stat -c %s "$f" 2>/dev/null || echo 0)"
  (( taille > 209715200 )) || continue
  echo "    $(( taille / 1048576 )) Mo — $(basename "$(dirname "$f")" | cut -c1-12)"
  : > "$f"
  vides=$((vides + 1))
done
(( vides > 0 )) || echo "    aucun au-delà de 200 Mo"

echo "==> Place disque après ménage"
timeout 60 df -h / | tail -n +2 | awk '{print "    " $5 " occupé, " $4 " libre sur " $2}'
# Si le disque reste plein après tout ça, on veut savoir **qui** l'occupe :
# sans cette ligne, le prochain incident repartira de zéro comme celui-ci.
libre_pct="$(df --output=pcent / | tail -1 | tr -dc '0-9')"
if [[ -n "$libre_pct" ]] && (( libre_pct > 85 )); then
  echo "WARN: disque encore à ${libre_pct} % — les dix plus gros postes :" >&2
  du -xhd2 /var 2>/dev/null | sort -rh | head -10 | sed 's/^/    /' >&2 || true
fi

# --- git ---
#
# Le VPS a déjà perdu GitHub en plein `git fetch` (SSL connection timeout)
# et Docker Hub en plein pull. Quatre essais, avec une pause qui double :
# 4 s, 8 s, 16 s, 32 s. Un seul essai laissait le déploiement en échec alors
# que le jeu tournait encore très bien.
#
# Chaque essai est **borné à trois minutes**, et c'est cette borne qui fait le
# travail. La panne observée n'était pas une erreur rapide mais un blocage :
# le `git fetch` du dernier déploiement a tenu la session un quart d'heure
# avant d'admettre qu'il n'aboutirait pas. Réessayer sans borne ne l'aurait
# pas rattrapé — ça aurait fait quatre quarts d'heure au lieu d'un.
git_essaie() {
  local i attente
  for i in 1 2 3 4; do
    if timeout 180 "$@"; then
      return 0
    fi
    attente=$((4 * 2 ** (i - 1)))
    echo "    essai $i/4 échoué — nouvelle tentative dans ${attente}s"
    sleep "$attente"
  done
  echo "ERROR: impossible de joindre GitHub après 4 essais." >&2
  return 1
}

mkdir -p "$(dirname "$APP_DIR")"
if [[ ! -d "$APP_DIR/.git" ]]; then
  # Premier déploiement : sans dépôt, il n'y a ni docker-compose.yml ni
  # scripts. Là, l'échec est bien un échec.
  rm -rf "$APP_DIR"
  git_essaie git clone --branch "$BRANCH" "$REPO_URL" "$APP_DIR"
else
  cd "$APP_DIR"
  # Un `git fetch` en échec n'est plus une raison de ne pas déployer.
  #
  # C'est ce qui vient d'emporter un déploiement : quatre tentatives sans
  # succès, et le script s'est arrêté là — alors que **l'image était déjà
  # construite et publiée**, et qu'elle contient tout le code applicatif.
  #
  # Le dépôt local ne sert plus qu'à deux choses depuis que l'image vient
  # d'un registre : `docker-compose.yml` et les scripts. Ces fichiers-là
  # bougent rarement, et une version vieille de quelques commits vaut
  # infiniment mieux qu'un déploiement qui n'a pas lieu. On déploie donc avec
  # ce qu'on a sous la main, en le disant fort.
  #
  # La contrepartie est réelle et il faut la connaître : un changement
  # d'orchestration — un port, une variable, une limite de journaux — ne
  # prendra pas effet ce tour-ci. Le code du jeu, lui, sera bien à jour,
  # puisqu'il ne vient pas d'ici.
  if git_essaie git fetch origin; then
    git checkout "$BRANCH"
    git reset --hard "origin/$BRANCH"
    git clean -fd
  else
    echo "WARN: GitHub injoignable — on déploie avec le dépôt local tel quel." >&2
    echo "      L'image vient du registre, donc le code du jeu sera à jour ;" >&2
    echo "      seule l'orchestration reste à sa version précédente." >&2
    git log -1 --format='      dépôt local : %h %s' 2>/dev/null || true
  fi
fi
cd "$APP_DIR"

# --- .env ---
[[ -f .env ]] || cp .env.example .env

# --- sauvegarde avant migration ---
#
# Le conteneur applique « prisma migrate deploy » à son démarrage. Une
# migration qui abîme les données au lieu d'échouer proprement est donc à un
# `docker compose up` de distance, et il n'y aurait aucun retour en arrière.
# On prend l'instantané **avant**, pendant que l'ancienne version tourne
# encore.
#
# Deux cas où il n'y a rien à sauvegarder, et où bloquer n'aurait aucun sens :
#
#  - **le tout premier déploiement**, où aucun conteneur n'existe encore ;
#  - **le premier déploiement d'après la bascule vers PostgreSQL**, où le
#    script de sauvegarde est déjà le nouveau — il cherche `farmsim-db` — mais
#    où ce conteneur n'a encore jamais été créé. C'est arrivé, et le
#    déploiement s'est bloqué net : le garde-fou « pas de déploiement sans
#    sauvegarde » réclamait une sauvegarde d'une base qui n'existait pas.
#
# Dans les deux cas on continue, en le disant fort. Partout ailleurs, une
# sauvegarde qui échoue arrête tout : c'est le seul filet avant une migration.
if ! docker inspect farmsim >/dev/null 2>&1; then
  echo "==> Premier déploiement : aucune base à sauvegarder"
elif ! docker inspect farmsim-db >/dev/null 2>&1; then
  echo "==> Bascule vers PostgreSQL : la nouvelle base n'existe pas encore."
  echo "    Aucune sauvegarde possible ici — l'ancienne base SQLite reste"
  echo "    intacte sur le volume farmsim-data, et c'est elle le filet."
  echo "    Voir docs/POSTGRESQL.md pour le transfert des données."
else
  # La sauvegarde est bornée, et son échec n'a que deux issues : une
  # sauvegarde plus modeste, ou pas de déploiement. Jamais un déploiement sans
  # filet.
  #
  # Elle prend un instantané **puis le restaure dans une base jetable** pour
  # vérifier qu'il est relisible — c'est ce qui fait la différence entre une
  # sauvegarde et un fichier qu'on espère. Mais mesuré en production, cette
  # relecture a tenu trente-cinq minutes sans finir sur une machine occupée à
  # déployer, et a emporté le déploiement avec elle : la session SSH a expiré
  # pendant que la sauvegarde tournait encore.
  #
  # Sans borne, l'échec est le pire des trois : ni sauvegarde, ni déploiement,
  # et une demi-heure perdue à ne rien apprendre.
  # Une sauvegarde relue ne se paie que s'il y a une migration à craindre.
  #
  # Le garde-fou protège d'une chose précise : une migration qui abîme les
  # données au lieu d'échouer proprement. Quand le déploiement n'apporte
  # aucune migration — le cas le plus fréquent, puisqu'on livre surtout du
  # code — il n'y a rien dont se protéger, et la relecture complète coûte
  # alors un quart d'heure de fenêtre pour rien.
  #
  # On compare les migrations présentes dans le dépôt à celles que la base dit
  # avoir appliquées. Si la base est à jour, on prend quand même un
  # instantané — la sauvegarde reste due, un bogue applicatif peut abîmer des
  # données sans migration — mais sans le relire.
  #
  # En cas de doute (base muette, requête en échec), on retombe sur la
  # sauvegarde complète : un garde-fou qui se désarme quand il ne comprend pas
  # ne garde plus rien.
  relire=1
  appliquees="$(docker exec "${FARMSIM_DB_CONTAINER:-farmsim-db}" \
      psql -U "${FARMSIM_DB_USER:-farmsim}" -d "${FARMSIM_DB_NAME:-farmsim}" -tAc \
      'SELECT count(*) FROM _prisma_migrations WHERE finished_at IS NOT NULL' 2>/dev/null || true)"
  presentes="$(find "$APP_DIR/apps/api/prisma/migrations" -mindepth 1 -maxdepth 1 -type d 2>/dev/null | wc -l)"
  if [[ "$appliquees" =~ ^[0-9]+$ ]] && (( appliquees >= presentes )) && (( presentes > 0 )); then
    echo "==> Base à jour ($appliquees migrations sur $presentes) : aucune migration à appliquer."
    echo "    Instantané sans relecture — il n'y a pas de migration dont se protéger."
    relire=0
  fi

  dump_avant_deploi() {
    find "${FARMSIM_BACKUP_DIR:-/var/backups/farmsim}" \
        -name '*avant-deploi.dump' -mmin -20 -size +4k 2>/dev/null | head -1 || true
  }

  echo "==> Sauvegarde avant migration"
  code=0
  timeout 900 env FARMSIM_BACKUP_VERIFY="$relire" \
    bash "$APP_DIR/scripts/farmsim-backup.sh" avant-deploi || code=$?
  if (( code == 124 )); then
    # 124 : la borne a parlé. Le dump est souvent **déjà là** — `docker run
    # --rm` a fini d'écrire et n'a pas encore rendu la main. On le cherche
    # **avant** de relancer. Relancer un instantané qui a réussi, sur une
    # machine saturée, a emporté le déploiement du 26 août : la session SSH
    # a expiré pendant le second essai, alors que le premier avait déjà
    # tenu quinze minutes *sans* relecture.
    fraiche="$(dump_avant_deploi)"
    if [[ -n "$fraiche" ]]; then
      echo "==> Sauvegarde bien présente malgré la borne : $fraiche"
      echo "    $(du -h "$fraiche" 2>/dev/null | cut -f1) — on continue."
      code=0
    elif (( relire != 0 )); then
      # L'arbitrage est détaillé dans `farmsim-backup.mjs` : une sauvegarde
      # non relue vaut mieux que pas de sauvegarde, et refuser le repli ne
      # rendrait personne plus sûr. On ne retente **que** si le premier
      # essai lisait encore la sauvegarde — sinon c'est le même travail.
      echo "WARN: sauvegarde relue trop longue (15 min) — instantané sans relecture." >&2
      code=0
      timeout 600 env FARMSIM_BACKUP_VERIFY=0 \
        bash "$APP_DIR/scripts/farmsim-backup.sh" avant-deploi || code=$?
    else
      echo "WARN: instantané trop long à se ranger (15 min) — on cherche le fichier." >&2
    fi
  fi
  # Le fichier fait foi, pas le code de sortie.
  #
  # Mesuré, et c'est le défaut que ce bloc corrige : la sauvegarde a écrit son
  # archive et affiché « OK » à 10:32:33 — puis la borne l'a tuée à 10:33:31,
  # une minute plus tard, et le déploiement s'est arrêté en déclarant n'avoir
  # aucune sauvegarde. Il y en avait deux, valides, de six mégaoctets et demi.
  #
  # `docker run --rm` démonte son conteneur après que le programme a fini. Sur
  # une machine chargée ce démontage prend des minutes : le travail est fait,
  # l'enveloppe ne rend pas encore la main, et une borne posée sur l'enveloppe
  # tue un succès.
  #
  # On regarde donc ce qui existe sur le disque. Un fichier d'avant-déploiement
  # écrit dans les vingt dernières minutes et non vide **est** la sauvegarde
  # qu'on réclamait ; refuser de déployer parce qu'un processus a mis trop
  # longtemps à se ranger serait confondre la preuve et le messager.
  if (( code != 0 )); then
    fraiche="$(dump_avant_deploi)"
    if [[ -n "$fraiche" ]]; then
      echo "==> Sauvegarde bien présente malgré la borne : $fraiche"
      echo "    $(du -h "$fraiche" 2>/dev/null | cut -f1) — on continue."
      code=0
    fi
  fi
  if (( code != 0 )); then
    echo "ERROR: la sauvegarde a échoué — déploiement interrompu." >&2
    echo "       Rien n'a été touché ; le jeu tourne toujours sur l'ancienne" >&2
    echo "       version. Corrigez la sauvegarde avant de recommencer." >&2
    exit 1
  fi
fi

# --- l'image ---
#
# Elle est construite par l'action GitHub et publiée sur ghcr.io ; le VPS ne
# fait plus que la tirer. C'est la correction d'un défaut qui a coûté deux
# déploiements de suite : construire ici demandait six à sept minutes, la
# session SSH était coupée avant la fin, et le `docker build` continuait à
# tourner sans personne pour l'attendre — si bien que le déploiement suivant
# démarrait sur une machine saturée et mourait à son tour.
#
# Le repli sur une construction locale est délibéré et n'est pas de la
# prudence décorative : sans lui, un registre indisponible, une image pas
# encore publiée ou un premier déploiement empêcheraient toute mise en ligne.
# On préfère un déploiement lent à pas de déploiement du tout.
if [[ -n "${FARMSIM_IMAGE:-}" ]]; then
  export FARMSIM_IMAGE
  echo "==> Image : $FARMSIM_IMAGE"
  if docker compose pull farmsim; then
    echo "==> Démarrage sur l'image du registre"
    docker compose up -d --force-recreate
  else
    echo "WARN: image introuvable au registre — construction sur place." >&2
    docker compose up -d --build --force-recreate
  fi
else
  echo "==> Aucune image fournie — construction sur place"
  docker compose up -d --build --force-recreate
fi

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

# ————————————————————————————————————————————————————————————————————————
# Le veilleur.
#
# Le conteneur du jeu a un contrôle de santé, et personne ne s'en sert :
# `restart: unless-stopped` ne relance qu'un conteneur qui **sort**. Un
# conteneur vivant mais figé — boucle d'événements bloquée, machine dans le
# swap — reste figé, et le site est mort jusqu'à ce qu'un humain s'en
# aperçoive. C'est ce qui s'est passé le 26 août : plus une réponse à partir
# de 20 h 12, y compris sur `/api/health`, et toujours rien une heure et
# demie plus tard.
#
# La minuterie regarde chaque minute ; le script relance ce qui est
# `unhealthy`, une fois toutes les dix minutes au plus. Voir
# deploy/farmsim-veilleur.sh pour ce qu'il ne prétend pas régler.
#
# Posé à chaque déploiement, et sans condition : c'est ce qui le répare si
# quelqu'un l'a désactivé ou si le fichier a changé.
# ————————————————————————————————————————————————————————————————————————
echo "==> Veilleur (relance le jeu s'il ne répond plus)"
if [[ -r "$APP_DIR/deploy/farmsim-veilleur.sh" ]] && command -v systemctl >/dev/null 2>&1; then
  install -m 0755 "$APP_DIR/deploy/farmsim-veilleur.sh" /usr/local/bin/farmsim-veilleur
  cat > /etc/systemd/system/farmsim-veilleur.service <<'UNITE'
[Unit]
Description=Relance FARMSIM quand son conteneur ne répond plus
Documentation=https://github.com/Torkor29/FARMSIM/blob/main/deploy/farmsim-veilleur.sh
After=docker.service
Requires=docker.service

[Service]
Type=oneshot
ExecStart=/usr/local/bin/farmsim-veilleur
UNITE
  cat > /etc/systemd/system/farmsim-veilleur.timer <<'MINUTERIE'
[Unit]
Description=Surveille FARMSIM toutes les minutes

[Timer]
OnBootSec=5min
OnUnitActiveSec=1min
# Le veilleur ne doit jamais s'empiler sur lui-même : sur une machine lente,
# un `docker restart` peut durer plus d'une minute.
AccuracySec=10s

[Install]
WantedBy=timers.target
MINUTERIE
  systemctl daemon-reload
  systemctl enable --now farmsim-veilleur.timer
  systemctl status farmsim-veilleur.timer --no-pager --lines=0 2>/dev/null | sed 's/^/    /' || true
else
  echo "    systemd absent ou script introuvable — veilleur non posé."
fi
echo

# ————————————————————————————————————————————————————————————————————————
# Les codes d'accès restés en clair.
#
# Le balayage tournait ici, **dans le conteneur du jeu**, juste après le
# contrôle de santé. C'était une erreur : `docker compose exec` démarre un
# second processus Node à l'intérieur du conteneur, qui partage donc son
# plafond de mémoire avec le jeu en train de tourner. Il a échoué au premier
# déploiement, et le site a rendu 502 dans la foulée.
#
# Il tourne désormais dans un **conteneur jetable**, bâti sur la même image
# mais avec sa propre mémoire — exactement comme la sauvegarde. Le jeu ne le
# voit pas passer, et un balayage qui trébuche ne peut plus l'emporter avec
# lui.
#
# Il ne fait pas échouer le déploiement : le jeu répond, et une remise à
# l'abri manquée se rattrape en relançant la commande à la main.
# ————————————————————————————————————————————————————————————————————————
echo "==> Mise à l'abri des codes d'accès restés en clair"
# `run` sans `--service-ports` ne publie aucun port : il ne peut donc pas
# entrer en conflit avec le conteneur du jeu qui tient déjà le 8081.
# `--no-deps` laisse la base tranquille — elle tourne déjà, et le réseau de la
# pile suffit à la joindre.
if ! docker compose run --rm --no-deps farmsim \
     node /app/scripts/farmsim-hacher-codes.mjs --vraiment; then
  echo "WARN: le balayage des codes en clair a échoué — relancez-le à la main :" >&2
  echo "  cd $APP_DIR && docker compose run --rm --no-deps farmsim \\" >&2
  echo "    node /app/scripts/farmsim-hacher-codes.mjs --vraiment" >&2
fi
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
