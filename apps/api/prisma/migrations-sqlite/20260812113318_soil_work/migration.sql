-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ParcelCell" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "parcelId" TEXT NOT NULL,
    "x" INTEGER NOT NULL,
    "y" INTEGER NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'EMPTY',
    "buildingId" TEXT,
    "machineId" TEXT,
    "crop" TEXT,
    "fieldStage" TEXT NOT NULL DEFAULT 'EMPTY',
    "plantedAt" DATETIME,
    "readyAt" DATETIME,
    "fertilizedPasses" INTEGER NOT NULL DEFAULT 0,
    "weedsControlled" BOOLEAN NOT NULL DEFAULT false,
    "harvestsSincePlow" INTEGER NOT NULL DEFAULT 0,
    "residuePasses" INTEGER NOT NULL DEFAULT 0,
    "hasStubble" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "ParcelCell_parcelId_fkey" FOREIGN KEY ("parcelId") REFERENCES "Parcel" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ParcelCell_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "Building" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ParcelCell_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "Machine" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_ParcelCell" ("buildingId", "crop", "fertilizedPasses", "fieldStage", "id", "kind", "machineId", "parcelId", "plantedAt", "readyAt", "weedsControlled", "x", "y") SELECT "buildingId", "crop", "fertilizedPasses", "fieldStage", "id", "kind", "machineId", "parcelId", "plantedAt", "readyAt", "weedsControlled", "x", "y" FROM "ParcelCell";
DROP TABLE "ParcelCell";
ALTER TABLE "new_ParcelCell" RENAME TO "ParcelCell";
CREATE UNIQUE INDEX "ParcelCell_machineId_key" ON "ParcelCell"("machineId");
CREATE UNIQUE INDEX "ParcelCell_parcelId_x_y_key" ON "ParcelCell"("parcelId", "x", "y");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
