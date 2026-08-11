# Farming Navigateur / FARMSIM

Jeu de gestion agricole mondial persistant (navigateur).

## Documentation

Conception : [`docs/research/`](./docs/research/00_INDEX.md)  
Rapport exécutif : [`docs/research/17_EXECUTIVE_REPORT.md`](./docs/research/17_EXECUTIVE_REPORT.md)

## Stack MVP

- `apps/web` — Vite + React
- `apps/api` — Express + Prisma (SQLite en local ; PostgreSQL en prod)
- `packages/sim` — simulation croissance / marché (lazy)
- `packages/shared` — types & constantes (dont spé **ETA**)

## Démarrage

```bash
pnpm install
pnpm --filter @farmsim/shared build
pnpm --filter @farmsim/sim build
cd apps/api && pnpm prisma:generate && pnpm prisma:push && cd ../..
pnpm dev:api   # :3001
pnpm dev:web   # :5173
```

Tests sim : `pnpm test:sim`

## Déploiement

Une seule image Docker : l'API (Express + Prisma) sert aussi les fichiers
statiques du front construit (`apps/web/dist`), sur un seul port. SQLite en
production comme en local — pas de service de base séparé, un seul volume à
sauvegarder.

```bash
sudo bash -c 'curl -fsSL https://raw.githubusercontent.com/Torkor29/FARMSIM/main/scripts/vps-deploy.sh | bash'
```

Le script construit l'image, corrige au besoin la propriété du volume de
données, applique les migrations (`prisma migrate deploy` — jamais
`db push`, pour ne jamais risquer de perte de données en production) et
attend que `/api/health` réponde.

La pile est autonome : aucun réseau ni conteneur externe requis, elle publie
son port sur l'hôte (`8081` par défaut — `8080` est déjà pris par Comptap sur
ce serveur). Le HTTPS est branché séparément, via le portier commun du
serveur — voir `deploy/Caddyfile.farming-navigator.com.caddy` et le dépôt
GESTIONPROJET, dossier `deploiement/`, pour la marche à suivre complète.

## Spécialisations

- **Céréalier** — cultures
- **Éleveur** — animaux (contenu limité MVP)
- **ETA** — Entreprise de Travaux Agricoles (missions NPC dès le MVP)
