-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Zone" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "koppen" TEXT NOT NULL,
    "riskNote" TEXT NOT NULL,
    "mapW" INTEGER NOT NULL DEFAULT 4,
    "mapH" INTEGER NOT NULL DEFAULT 3,
    "continentCode" TEXT NOT NULL DEFAULT 'AUR',
    "continentName" TEXT NOT NULL DEFAULT 'Auralie',
    "city" TEXT NOT NULL DEFAULT '',
    "climateLabel" TEXT NOT NULL DEFAULT '',
    "hemisphere" TEXT NOT NULL DEFAULT 'N',
    "lat" REAL NOT NULL DEFAULT 0,
    "lon" REAL NOT NULL DEFAULT 0,
    "priceMult" REAL NOT NULL DEFAULT 1,
    "baseFertility" REAL NOT NULL DEFAULT 0.7
);
INSERT INTO "new_Zone" ("code", "country", "id", "koppen", "mapH", "mapW", "name", "riskNote") SELECT "code", "country", "id", "koppen", "mapH", "mapW", "name", "riskNote" FROM "Zone";
DROP TABLE "Zone";
ALTER TABLE "new_Zone" RENAME TO "Zone";
CREATE UNIQUE INDEX "Zone_code_key" ON "Zone"("code");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
