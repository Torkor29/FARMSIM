#!/usr/bin/env bash
# Redonne un code d'accès à un joueur qui a tout perdu.
#
#   sudo bash /opt/farmsim/scripts/farmsim-code-secours.sh joueur@exemple.fr
#   sudo bash /opt/farmsim/scripts/farmsim-code-secours.sh --lister
#
# Le jeu sait se dépanner tout seul : depuis l'écran de connexion, « Mot de
# passe oublié ? » envoie un lien à l'adresse du compte, valable trente
# minutes, qui ouvre le choix d'un nouveau mot de passe.
#
# Ce script est le cran d'après, et il ne reste qu'un seul cas : le joueur n'a
# plus accès à sa boîte aux lettres — perdue, fermée, ou mal saisie à
# l'inscription, l'adresse n'étant pas vérifiée. Là, plus rien côté joueur ne
# peut le tirer d'affaire ; il faut quelqu'un qui ait la main sur la base.
# C'est vous.
#
# Le nom du fichier vient du **code de secours**, un code remis à la création
# de la ferme que le joueur devait noter. Il a été retiré le jour où le lien
# par courriel est entré en service — deux voies pour le même oubli, c'était
# deux écrans à expliquer et une fenêtre imposée à l'inscription. Le nom reste
# tel quel : le script est déployé sous ce chemin sur le serveur, et le
# renommer casserait la seule commande qu'on tape un jour de panne.
#
# Ce qu'il fait : tire un code d'accès neuf, l'écrit sur le compte, ferme les
# sessions ouvertes, et l'affiche **une fois**. Transmettez-le au joueur par un
# canal privé, et dites-lui de le changer en arrivant.
#
# Ce qu'il ne fait pas : lire l'ancien mot de passe. Il **ne le peut plus** —
# la colonne ne porte qu'une empreinte bcrypt depuis la correction du stockage
# en clair, et une empreinte ne se remonte pas. C'est précisément la propriété
# qu'on voulait : personne ne relit le mot de passe d'un joueur, pas même le
# propriétaire du serveur. Le remplacer est donc le seul geste possible, et
# c'est le bon.
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
« Mot de passe oublié ? », si sa boîte aux lettres lui répond encore.
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

# Un mot de passe lisible au téléphone : pas de I, de l, de O ni de 0.
CODE="$(LC_ALL=C tr -dc 'ABCDEFGHJKMNPQRSTUVWXYZ23456789' </dev/urandom | head -c 12)"
[[ ${#CODE} -eq 12 ]] || mourir "tirage du mot de passe raté."

# On écrit une **empreinte**, jamais le mot de passe.
#
# Ce script posait la chaîne en clair dans la colonne. Ça marchait — la
# connexion reconnaît encore l'ancienne forme et bascule d'elle-même — mais ça
# rouvrait pour de bon le trou qu'on venait de fermer : entre le dépannage et
# la première connexion du joueur, son mot de passe redevenait lisible par
# quiconque ouvre la base. Le hachage se fait dans le conteneur du jeu, qui a
# déjà bcrypt et la bonne fonction ; aucune dépendance à installer sur l'hôte.
# Chemin absolu, et pas relatif : le répertoire de travail de l'image peut
# changer sans que personne ne pense à ce script, et un dépannage qui échoue
# est un dépannage qu'on découvre au pire moment.
EMPREINTE="$(docker exec -i "$CONTENEUR" node -e '
  import("/app/apps/api/dist/access-code.js").then(async (m) => {
    process.stdout.write(await m.hacherCode(process.argv[1]));
  });
' "$CODE" 2>/dev/null)" || mourir "hachage impossible — le conteneur « $CONTENEUR » tourne-t-il ?"
case "$EMPREINTE" in
  '$2'*) : ;;
  *) mourir "le hachage n'a pas rendu une empreinte bcrypt : ${EMPREINTE:0:12}" ;;
esac

# Les sessions ouvertes tombent avec l'ancien mot de passe : si quelqu'un
# d'autre était entré, le remplacer doit le mettre dehors, sans quoi la reprise
# en main n'est qu'apparente.
pg "$URL_JEU" -v ON_ERROR_STOP=1 -q <<SQL
UPDATE "User" SET "accessCode" = '${EMPREINTE}' WHERE id = '${ID}';
DELETE FROM "Session" WHERE "userId" = '${ID}';
SQL

echo
dire "Compte « $CIBLE » : mot de passe remplacé, sessions fermées."
echo
echo "    Nouveau mot de passe : ${CODE}"
echo
cat <<'TXT'
À transmettre au joueur par un canal privé. Dites-lui :

  - de se connecter avec ce mot de passe, puis d'en choisir un autre depuis
    l'écran Compte ;
  - de **vérifier son adresse e-mail** au passage, dans ce même écran. C'est
    elle qui porte désormais tout le dépannage : une adresse juste lui évitera
    de vous redéranger.
TXT
