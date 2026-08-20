#!/usr/bin/env bash
# Redonne un code d'accès à un joueur qui a tout perdu.
#
#   sudo bash /opt/farmsim/scripts/farmsim-code-secours.sh joueur@exemple.fr
#   sudo bash /opt/farmsim/scripts/farmsim-code-secours.sh --lister
#
# Le jeu sait se dépanner tout seul : à la création de sa ferme, chaque joueur
# reçoit un **code de secours** qui lui permet de choisir un nouveau code
# d'accès depuis l'écran de connexion, sans e-mail et sans vous déranger.
#
# Ce script est le cran d'après : celui qui a oublié son code d'accès **et**
# perdu son code de secours. Là, plus rien côté joueur ne peut le tirer
# d'affaire — il faut quelqu'un qui ait la main sur la base. C'est vous.
#
# Ce qu'il fait : tire un code d'accès neuf, l'écrit sur le compte, ferme les
# sessions ouvertes, et l'affiche **une fois**. Transmettez-le au joueur par un
# canal privé, et dites-lui de le changer en arrivant.
#
# Ce qu'il ne fait pas : lire l'ancien code. Le code d'accès est stocké en
# clair (dette connue, notée dans le schéma), mais l'afficher en ferait une
# habitude ; le remplacer laisse au moins une trace pour le joueur.
set -euo pipefail

CIBLE="${1:-}"
CONTENEUR="${FARMSIM_CONTAINER:-farmsim}"
CONTENEUR_DB="${FARMSIM_DB_CONTAINER:-farmsim-db}"

dire() { echo "==> $*"; }
mourir() { echo "ERREUR : $*" >&2; exit 1; }

if [[ -z "$CIBLE" ]]; then
  cat >&2 <<'TXT'
Usage :
  farmsim-code-secours.sh <adresse e-mail>   redonne un code d'accès
  farmsim-code-secours.sh --lister           liste les comptes réels

Rappel : le joueur peut se dépanner seul depuis l'écran de connexion,
« Code d'accès oublié ? », s'il a noté son code de secours.
TXT
  exit 1
fi

command -v docker >/dev/null 2>&1 || mourir "docker introuvable — ce script se lance sur l'hôte du jeu."
docker inspect "$CONTENEUR_DB" >/dev/null 2>&1 || mourir "conteneur « $CONTENEUR_DB » absent."

IMAGE="$(docker inspect "$CONTENEUR" -f '{{.Config.Image}}' 2>/dev/null || true)"
[[ -n "$IMAGE" ]] || mourir "conteneur « $CONTENEUR » introuvable — le jeu n'a jamais démarré ?"
UTILISATEUR="$(docker exec "$CONTENEUR_DB" printenv POSTGRES_USER 2>/dev/null || echo farmsim)"
MOT_DE_PASSE="$(docker exec "$CONTENEUR_DB" printenv POSTGRES_PASSWORD 2>/dev/null || true)"
[[ -n "$MOT_DE_PASSE" ]] || mourir "mot de passe de la base illisible sur le conteneur."

URL_JEU="postgresql://${UTILISATEUR}:${MOT_DE_PASSE}@127.0.0.1:5432/farmsim"

# Aucun port n'est ouvert sur l'hôte : on parle à la base depuis son propre
# réseau, avec le client livré dans l'image du jeu.
pg() {
  docker run --rm -i --user 0:0 \
    --network "container:${CONTENEUR_DB}" \
    -e PGPASSWORD="$MOT_DE_PASSE" \
    --entrypoint psql "$IMAGE" "$@"
}

if [[ "$CIBLE" == "--lister" ]]; then
  pg "$URL_JEU" -c \
    'SELECT email, "displayName", "createdAt", "lastSeenAt" FROM "User" WHERE COALESCE("isNpc", false) = false ORDER BY "createdAt"'
  exit 0
fi

# La comparaison est insensible à la casse : personne ne retient s'il s'est
# inscrit avec une majuscule, et l'adresse arrive souvent recopiée d'un message.
ID="$(pg "$URL_JEU" -tAc "SELECT id FROM \"User\" WHERE lower(email) = lower('${CIBLE//\'/\'\'}') LIMIT 1" | tr -d '[:space:]')"
[[ -n "$ID" ]] || mourir "aucun compte pour « $CIBLE » — vérifiez l'adresse avec --lister."

# Un code lisible au téléphone : pas de I, de l, de O ni de 0.
CODE="$(LC_ALL=C tr -dc 'ABCDEFGHJKMNPQRSTUVWXYZ23456789' </dev/urandom | head -c 10)"
[[ ${#CODE} -eq 10 ]] || mourir "tirage du code raté."

# Le code de secours est mis à néant en même temps : celui que le joueur avait
# noté n'existe peut-être plus, et un compte ne doit pas rester sans filet. Le
# serveur lui en remettra un neuf à sa prochaine connexion réussie.
pg "$URL_JEU" -v ON_ERROR_STOP=1 -q <<SQL
UPDATE "User" SET "accessCode" = '${CODE}', "recoveryHash" = NULL, "recoveryAt" = NULL WHERE id = '${ID}';
DELETE FROM "Session" WHERE "userId" = '${ID}';
SQL

echo
dire "Compte « $CIBLE » : code d'accès remplacé, sessions fermées."
echo
echo "    Nouveau code d'accès : ${CODE}"
echo
cat <<'TXT'
À transmettre au joueur par un canal privé. Dites-lui :

  - de se connecter avec ce code ;
  - qu'un **code de secours** neuf lui sera affiché à ce moment-là, une seule
    fois — c'est celui-là qu'il doit noter, il lui évitera de vous redéranger.
TXT
