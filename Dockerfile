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

FROM base AS runner
ENV NODE_ENV=production
ENV PORT=8080
ENV DATABASE_URL="file:/data/farmsim.db"
ENV WEB_DIST_DIR=/app/apps/web/dist
WORKDIR /app

RUN groupadd --gid 10001 farmsim \
  && useradd --uid 10001 --gid farmsim --shell /usr/sbin/nologin --create-home farmsim \
  && mkdir -p /data \
  && chown -R farmsim:farmsim /data

# Copie du workspace complet plutôt que de morceaux choisis : pnpm relie les
# paquets d'un même monorepo par des liens symboliques relatifs (vers
# node_modules/.pnpm à la racine) — cherry-picker des sous-dossiers casserait
# ces liens de façon peu évidente. C'est le même choix que sur Comptap.
COPY --from=build --chown=farmsim:farmsim /app/node_modules ./node_modules
COPY --from=build --chown=farmsim:farmsim /app/apps ./apps
COPY --from=build --chown=farmsim:farmsim /app/packages ./packages

USER farmsim
EXPOSE 8080
VOLUME ["/data"]
WORKDIR /app/apps/api

# « migrate deploy » applique les migrations déjà écrites dans le dépôt sans
# jamais deviner ni accepter de perte de données — à la différence de
# « db push », qui n'a pas sa place en production. Le CLI Prisma est appelé
# directement (node_modules/.bin), jamais via pnpm ni npx : aucune tentative
# de téléchargement au démarrage du conteneur.
CMD ["sh", "-c", "./node_modules/.bin/prisma migrate deploy && node dist/main.js"]
