-- Lieu de vie durable et herbe sur pied.
--
-- Deux colonnes seulement, avec des défauts **constants** : SQLite refuse
-- d'ajouter une colonne dont le défaut est une expression dès qu'il y a des
-- lignes à remplir, et c'est exactement ce qui avait cassé la production sur
-- `20260814120000_building_rotation`. Le test `migrations.test.ts` monte la
-- garde.
--
-- `INSIDE` et `0` sont les valeurs qui reproduisent le comportement d'avant :
-- un troupeau existant se retrouve à l'étable, avec un pré à faire pousser.
ALTER TABLE "Herd" ADD COLUMN "housing" TEXT NOT NULL DEFAULT 'INSIDE';
ALTER TABLE "Herd" ADD COLUMN "grassTons" REAL NOT NULL DEFAULT 0;
