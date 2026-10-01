-- Le bois : un sol de plus, et l'âge de ses arbres.
ALTER TYPE "SolCase" ADD VALUE 'BOIS';
ALTER TABLE "ParcelCell" ADD COLUMN "boiseDepuis" TIMESTAMP(3);
