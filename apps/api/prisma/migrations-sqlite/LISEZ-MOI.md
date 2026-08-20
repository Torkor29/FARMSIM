# Les migrations d'avant PostgreSQL

Ces quarante-deux migrations ont construit la base du jeu tant qu'elle vivait
sur SQLite. Elles ne sont **plus rejouées** : Prisma ne regarde que
`prisma/migrations`, et leur SQL est écrit dans le dialecte de SQLite —
reconstructions de table, `DATETIME`, `PRAGMA`. Les rejouer sur PostgreSQL
échouerait dès la première.

Elles sont gardées pour deux raisons :

- **L'histoire du schéma se lit ici.** Pourquoi telle colonne existe, quand
  elle est apparue, et ce qu'elle a remplacé.
- **La bascule a un point de retour.** Tant que le volume `farmsim-data`
  existe, ce dossier permet de reconstruire à l'identique la base qu'il
  contient.

Les données, elles, ont été transférées par `scripts/farmsim-vers-postgres.mjs`
— pas en rejouant cet historique. Voir `docs/POSTGRESQL.md`.

Ce dossier pourra disparaître une fois l'ancien volume supprimé.
