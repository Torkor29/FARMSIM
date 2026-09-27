-- La décoration libre : ce que le joueur pose autour de sa ferme.
ALTER TABLE "Farm" ADD COLUMN "decorJson" TEXT NOT NULL DEFAULT '[]';
