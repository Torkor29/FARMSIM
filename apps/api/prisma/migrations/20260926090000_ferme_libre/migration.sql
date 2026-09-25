-- La ferme libre : sols, chemins, décor, domaine et lots.
-- Voir docs/ferme-libre.md. Aucune case ni aucun bâtiment existant ne bouge.

CREATE TYPE "SolCase" AS ENUM ('CHAMP', 'PRE', 'EAU');

ALTER TABLE "ParcelCell" ADD COLUMN "sol" "SolCase" NOT NULL DEFAULT 'CHAMP';
ALTER TABLE "ParcelCell" ADD COLUMN "revetement" TEXT;

ALTER TABLE "Parcel" ADD COLUMN "domaineMarge" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Parcel" ADD COLUMN "lotsAchetes" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "Amenagement" (
    "id" TEXT NOT NULL,
    "parcelId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "originX" INTEGER NOT NULL,
    "originY" INTEGER NOT NULL,
    "rotation" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Amenagement_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Amenagement_parcelId_idx" ON "Amenagement"("parcelId");
ALTER TABLE "Amenagement" ADD CONSTRAINT "Amenagement_parcelId_fkey"
    FOREIGN KEY ("parcelId") REFERENCES "Parcel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Une case sous un bâtiment n'est pas un champ : c'est du pré bâti. Quand le
-- bâtiment partira, elle restera libre pour bâtir ou décorer.
UPDATE "ParcelCell" SET "sol" = 'PRE' WHERE "kind" = 'BUILDING';

-- Le siège de chaque ferme de joueur devient un domaine : sa première
-- parcelle, dans l'ordre même où le jeu les range (acquiredAt, puis id).
UPDATE "Parcel" p SET "domaineMarge" = 6
FROM (
    SELECT DISTINCT ON (pa."farmId") pa."id"
    FROM "Parcel" pa
    JOIN "Farm" f ON f."id" = pa."farmId"
    JOIN "User" u ON u."id" = f."userId"
    WHERE u."isNpc" = false
    ORDER BY pa."farmId", pa."acquiredAt" ASC NULLS FIRST, pa."id" ASC
) AS siege
WHERE p."id" = siege."id";
