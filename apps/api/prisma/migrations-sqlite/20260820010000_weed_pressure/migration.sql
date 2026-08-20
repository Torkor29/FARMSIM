-- Les adventices deviennent une pression, pas un interrupteur.
--
-- `weedsControlled` valait dix pour cent de rendement et ne passait à vrai
-- qu'en même temps que la fertilisation, en silence : aucun geste du joueur ne
-- pouvait le déclencher, et personne n'apprenait que ces dix pour cent
-- existaient.
--
-- Les cases déjà « désherbées » repartent propres, les autres avec une
-- pression moyenne — c'est l'état que le booléen décrivait, traduit sur une
-- échelle continue. Aucun champ en cours n'est puni rétroactivement.
ALTER TABLE "ParcelCell" ADD COLUMN "weedPressure" REAL NOT NULL DEFAULT 0;

UPDATE "ParcelCell" SET "weedPressure" = 0.45 WHERE "weedsControlled" = 0;

-- La colonne d'avant disparaît. SQLite sait retirer une colonne depuis 3.35 ;
-- Prisma embarque plus récent.
ALTER TABLE "ParcelCell" DROP COLUMN "weedsControlled";
