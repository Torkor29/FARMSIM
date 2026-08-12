-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Parcel" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "zoneId" TEXT NOT NULL,
    "farmId" TEXT,
    "label" TEXT NOT NULL,
    "mapX" INTEGER NOT NULL,
    "mapY" INTEGER NOT NULL,
    "gridW" INTEGER NOT NULL DEFAULT 12,
    "gridH" INTEGER NOT NULL DEFAULT 12,
    "landPrice" REAL NOT NULL,
    "fertility" REAL NOT NULL DEFAULT 0.7,
    "accessIndex" REAL NOT NULL DEFAULT 0.5,
    CONSTRAINT "Parcel_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "Zone" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Parcel_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Parcel" ("farmId", "fertility", "gridH", "gridW", "id", "label", "landPrice", "mapX", "mapY", "zoneId") SELECT "farmId", "fertility", "gridH", "gridW", "id", "label", "landPrice", "mapX", "mapY", "zoneId" FROM "Parcel";
DROP TABLE "Parcel";
ALTER TABLE "new_Parcel" RENAME TO "Parcel";
CREATE UNIQUE INDEX "Parcel_zoneId_mapX_mapY_key" ON "Parcel"("zoneId", "mapX", "mapY");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
