-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Building" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "parcelId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "level" INTEGER NOT NULL DEFAULT 1,
    "originX" INTEGER NOT NULL,
    "originY" INTEGER NOT NULL,
    CONSTRAINT "Building_parcelId_fkey" FOREIGN KEY ("parcelId") REFERENCES "Parcel" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Building" ("id", "originX", "originY", "parcelId", "type") SELECT "id", "originX", "originY", "parcelId", "type" FROM "Building";
DROP TABLE "Building";
ALTER TABLE "new_Building" RENAME TO "Building";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
