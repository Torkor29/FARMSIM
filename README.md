# Farming Navigateur / FARMSIM

Jeu de gestion agricole mondial persistant (navigateur).

## Documentation

Conception : [`docs/research/`](./docs/research/00_INDEX.md)  
Rapport exécutif : [`docs/research/17_EXECUTIVE_REPORT.md`](./docs/research/17_EXECUTIVE_REPORT.md)

## Stack MVP

- `apps/web` — Vite + React
- `apps/api` — Express + Prisma (SQLite en local ; PostgreSQL en prod)
- `packages/sim` — simulation croissance / marché (lazy)
- `packages/shared` — types & constantes

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

Atelier du parc matériel 3D (hors jeu, pour juger les engins) :
`http://localhost:5173/machines.html` — suffixer `?iso` n'affiche que la vue
ferme, utile quand la machine à tester peine à faire tourner cinq canevas 3D.

Atelier des cultures et des bêtes : `http://localhost:5173/farm.html` —
`?only=crops` aligne les six cultures à trois âges, `?only=animals` met chaque
bête sur un plateau dans tous ses états, `?only=herd` montre le troupeau qui
sort et rentre de l'étable.

Atelier des personnages : `http://localhost:5173/characters.html` — le
catalogue de pièces, famille par famille (`?family=hat`, `beard`, `clothes`…),
puis le menu de création. `?solo` n'affiche que le menu, pour juger un visage
en grand sans faire tourner huit canevas.

Modèles 3D exportables (Blender, autre moteur) — `models/*.glb`, hiérarchie
nommée et animation « Travail » incluses :

```bash
node scripts/export-machines.mjs
```

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
- **Éleveur** — animaux
- Les travaux à façon sont un **appoint** (missions 8–24 cases), pas un troisième métier.
