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

## Spécialisations

- **Céréalier** — cultures
- **Éleveur** — animaux (contenu limité MVP)
- **ETA** — Entreprise de Travaux Agricoles (missions NPC dès le MVP)
