-- La campagne se façonne autour de la ferme ; la réserve achetable disparaît.
ALTER TABLE "ParcelCell" DROP COLUMN "vocation";

CREATE TABLE "CaseCampagne" (
    "id" TEXT NOT NULL,
    "parcelId" TEXT NOT NULL,
    "x" INTEGER NOT NULL,
    "y" INTEGER NOT NULL,
    "sol" TEXT NOT NULL DEFAULT 'PRE',
    "fleurie" BOOLEAN NOT NULL DEFAULT false,
    "niveau" INTEGER NOT NULL DEFAULT 0,
    "forme" INTEGER NOT NULL DEFAULT 0,
    "boiseDepuis" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CaseCampagne_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CaseCampagne_parcelId_x_y_key" ON "CaseCampagne"("parcelId", "x", "y");
ALTER TABLE "CaseCampagne" ADD CONSTRAINT "CaseCampagne_parcelId_fkey" FOREIGN KEY ("parcelId") REFERENCES "Parcel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
