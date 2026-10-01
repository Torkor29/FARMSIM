-- La biodiversité : la faune installée sur la ferme, et l'heure de sa dernière lecture.
ALTER TABLE "Farm" ADD COLUMN "fauneJson" TEXT NOT NULL DEFAULT '{}';
ALTER TABLE "Farm" ADD COLUMN "fauneAt" TIMESTAMP(3);
