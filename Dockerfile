# syntax=docker/dockerfile:1

FROM node:22-bookworm-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/sim/package.json packages/sim/package.json
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY . .
# Le client Prisma est généré ici, à la construction : les binaires du
# moteur sont mis en cache dans node_modules et embarqués dans l'image.
# « prisma migrate deploy », à l'exécution, n'a donc besoin d'aucun accès
# réseau — il applique seulement les fichiers SQL déjà présents dans le
# dépôt (apps/api/prisma/migrations/).
RUN pnpm --filter @farmsim/api exec prisma generate
RUN pnpm -r build

# Le moteur de schéma, mis à un endroit fixe et **vérifié ici**.
#
# `prisma migrate deploy` le cherche dans l'arborescence pnpm, à un chemin qui
# contient le numéro de version du paquet. En production le conteneur a
# redémarré en boucle sur « Could not find schema-engine binary » : le jeu
# était en panne, et la seule trace était dans les journaux du conteneur.
#
# Deux corrections en une :
#   - on le copie sous un nom stable et on le désigne par
#     `PRISMA_SCHEMA_ENGINE_BINARY`, donc plus aucune dépendance à un chemin
#     qui bouge avec les versions ;
#   - `test -n` fait **échouer la construction** s'il est introuvable. Une
#     image qui ne peut pas migrer ne doit pas exister, plutôt que d'être
#     découverte au démarrage sur le serveur.
RUN set -eu; \
  moteur="$(find /app/node_modules -type f -name 'schema-engine-*' | head -1)"; \
  test -n "$moteur" || { echo "ERREUR : moteur de schéma Prisma introuvable dans node_modules." >&2; exit 1; }; \
  mkdir -p /moteurs; \
  cp "$moteur" /moteurs/schema-engine; \
  chmod 0755 /moteurs/schema-engine; \
  echo "moteur de schéma : $moteur"


FROM base AS runner
ENV NODE_ENV=production
ENV PORT=8080
# Aucune valeur par défaut : la base vient de l'orchestration (docker-compose),
# et un défaut ici ferait démarrer le jeu sur une base fantôme le jour où la
# variable manque, au lieu de refuser bruyamment.
ENV WEB_DIST_DIR=/app/apps/web/dist
WORKDIR /app

# Le client PostgreSQL, dans la version **du serveur**.
#
# `pg_dump` refuse net de travailler contre un serveur plus récent que lui, et
# Debian bookworm n'apporte que la 15 : sans le dépôt officiel, la sauvegarde
# échouerait le jour où on en aurait besoin — c'est-à-dire trop tard pour s'en
# apercevoir. C'est cette image qui fait tourner `farmsim-backup.mjs`, dans un
# conteneur jetable, et elle a donc besoin de pg_dump, pg_restore et psql.
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates curl gnupg \
  && curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc \
     | gpg --dearmor -o /usr/share/keyrings/pgdg.gpg \
  && echo "deb [signed-by=/usr/share/keyrings/pgdg.gpg] https://apt.postgresql.org/pub/repos/apt bookworm-pgdg main" \
     > /etc/apt/sources.list.d/pgdg.list \
  && apt-get update \
  && apt-get install -y --no-install-recommends postgresql-client-16 \
  && rm -rf /var/lib/apt/lists/*
# `apt-get purge curl gnupg` + `autoremove` faisaient gagner quelques
# mégaoctets et pouvaient emporter une bibliothèque dont autre chose dépend.
# Le jeu ne tient pas à ces mégaoctets ; il tient à démarrer.

RUN groupadd --gid 10001 farmsim \
  && useradd --uid 10001 --gid farmsim --shell /usr/sbin/nologin --create-home farmsim

# Copie du workspace complet plutôt que de morceaux choisis : pnpm relie les
# paquets d'un même monorepo par des liens symboliques relatifs (vers
# node_modules/.pnpm à la racine) — cherry-picker des sous-dossiers casserait
# ces liens de façon peu évidente. C'est le même choix que sur Comptap.
COPY --from=build /moteurs/schema-engine /usr/local/bin/schema-engine
# Prisma prend ce chemin plutôt que d'aller le chercher dans node_modules.
ENV PRISMA_SCHEMA_ENGINE_BINARY=/usr/local/bin/schema-engine

COPY --from=build --chown=farmsim:farmsim /app/node_modules ./node_modules
COPY --from=build --chown=farmsim:farmsim /app/apps ./apps
COPY --from=build --chown=farmsim:farmsim /app/packages ./packages

USER farmsim
EXPOSE 8080
# Plus de volume de données : la base vit dans son propre conteneur. Le jeu
# n'écrit plus rien sur disque, ce qui laisse enfin son système de fichiers
# entièrement en lecture seule.
WORKDIR /app/apps/api

# « migrate deploy » applique les migrations déjà écrites dans le dépôt sans
# jamais deviner ni accepter de perte de données — à la différence de
# « db push », qui n'a pas sa place en production. Le CLI Prisma est appelé
# directement (node_modules/.bin), jamais via pnpm ni npx : aucune tentative
# de téléchargement au démarrage du conteneur.
CMD ["sh", "-c", "./node_modules/.bin/prisma migrate deploy && node dist/main.js"]
