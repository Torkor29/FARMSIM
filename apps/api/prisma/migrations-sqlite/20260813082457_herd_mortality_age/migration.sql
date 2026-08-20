-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Herd" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "farmId" TEXT NOT NULL,
    "buildingId" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'COW',
    "size" INTEGER NOT NULL DEFAULT 0,
    "happiness" REAL NOT NULL DEFAULT 0.6,
    "bornAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastGrazedAt" DATETIME,
    "lastTickAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastMilkedAt" DATETIME,
    "grazingUntil" DATETIME,
    "lastFedAt" DATETIME,
    "feedQuality" REAL NOT NULL DEFAULT 0,
    "feedStock" REAL NOT NULL DEFAULT 0,
    "gestatingSince" DATETIME,
    "lastCalvedAt" DATETIME,
    "avgAgeMs" REAL NOT NULL DEFAULT 0,
    "mortalityDebt" REAL NOT NULL DEFAULT 0,
    CONSTRAINT "Herd_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Herd_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "Building" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Herd" ("bornAt", "buildingId", "farmId", "feedQuality", "feedStock", "gestatingSince", "grazingUntil", "happiness", "id", "kind", "lastCalvedAt", "lastFedAt", "lastGrazedAt", "lastMilkedAt", "lastTickAt", "size") SELECT "bornAt", "buildingId", "farmId", "feedQuality", "feedStock", "gestatingSince", "grazingUntil", "happiness", "id", "kind", "lastCalvedAt", "lastFedAt", "lastGrazedAt", "lastMilkedAt", "lastTickAt", "size" FROM "Herd";
DROP TABLE "Herd";
ALTER TABLE "new_Herd" RENAME TO "Herd";
CREATE UNIQUE INDEX "Herd_buildingId_key" ON "Herd"("buildingId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
