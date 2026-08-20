-- Séparation porteur / outil : donner aux fermes existantes de quoi travailler.
--
-- Un tracteur ne sème plus et ne laboure plus — c'est l'outil attelé qui le
-- fait. Sans cette migration, tout joueur en cours de partie se réveillerait
-- avec un tracteur qui ne sait plus rien faire et une parcelle en friche.
--
-- Le semoir et la charrue sont donnés, pas vendus : le joueur les avait déjà
-- payés à l'intérieur du prix de son tracteur, qui faisait alors les cinq
-- travaux. Ils arrivent au palier 1 et à l'état neuf.
--
-- `randomblob(16)` tient lieu de cuid : ces identifiants ne sont jamais
-- comparés à ceux de Prisma, seulement lus.
INSERT INTO "Machine" ("id", "farmId", "type", "tier", "condition", "hours", "greased", "grease", "dirt", "greaseSkipStreak")
SELECT lower(hex(randomblob(16))), f."id", 'SEEDER', 1, 100, 0, 1, 100, 0, 0
FROM "Farm" f
WHERE EXISTS (SELECT 1 FROM "Machine" m WHERE m."farmId" = f."id" AND m."type" = 'TRACTOR')
  AND NOT EXISTS (SELECT 1 FROM "Machine" m WHERE m."farmId" = f."id" AND m."type" = 'SEEDER');

INSERT INTO "Machine" ("id", "farmId", "type", "tier", "condition", "hours", "greased", "grease", "dirt", "greaseSkipStreak")
SELECT lower(hex(randomblob(16))), f."id", 'PLOUGH', 1, 100, 0, 1, 100, 0, 0
FROM "Farm" f
WHERE EXISTS (SELECT 1 FROM "Machine" m WHERE m."farmId" = f."id" AND m."type" = 'TRACTOR')
  AND NOT EXISTS (SELECT 1 FROM "Machine" m WHERE m."farmId" = f."id" AND m."type" = 'PLOUGH');

-- La fauche et le ramassage des bottes passaient aussi par le tracteur. On ne
-- distribue faucheuse et remorque qu'aux fermes qui ont un troupeau : les
-- autres ne fauchaient pas, et leur en donner encombrerait leur hangar.
INSERT INTO "Machine" ("id", "farmId", "type", "tier", "condition", "hours", "greased", "grease", "dirt", "greaseSkipStreak")
SELECT lower(hex(randomblob(16))), f."id", 'MOWER', 1, 100, 0, 1, 100, 0, 0
FROM "Farm" f
WHERE EXISTS (SELECT 1 FROM "Herd" h WHERE h."farmId" = f."id")
  AND NOT EXISTS (SELECT 1 FROM "Machine" m WHERE m."farmId" = f."id" AND m."type" = 'MOWER');

-- Les paliers valaient tous 1 sans que la colonne serve. On s'assure qu'aucune
-- ligne ne porte une valeur hors bornes avant que le code s'y fie.
UPDATE "Machine" SET "tier" = 1 WHERE "tier" IS NULL OR "tier" < 1 OR "tier" > 3;
