-- CreateTable
CREATE TABLE "Herd" (
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
    CONSTRAINT "Herd_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Herd_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "Building" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Herd_buildingId_key" ON "Herd"("buildingId");
