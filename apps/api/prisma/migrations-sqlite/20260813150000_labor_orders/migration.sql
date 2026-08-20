-- CreateTable
CREATE TABLE "LaborOrder" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "parcelId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "providerId" TEXT,
    "work" TEXT NOT NULL,
    "crop" TEXT,
    "cellsJson" TEXT NOT NULL,
    "remainingJson" TEXT NOT NULL,
    "quoteCrd" REAL NOT NULL,
    "extrasCrd" REAL NOT NULL,
    "escrowCrd" REAL NOT NULL,
    "payoutCrd" REAL NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME NOT NULL,
    "completedAt" DATETIME,
    CONSTRAINT "LaborOrder_parcelId_fkey" FOREIGN KEY ("parcelId") REFERENCES "Parcel" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "LaborOrder_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "LaborOrder_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "LaborOrder_status_createdAt_idx" ON "LaborOrder"("status", "createdAt");
CREATE INDEX "LaborOrder_providerId_status_idx" ON "LaborOrder"("providerId", "status");
CREATE INDEX "LaborOrder_parcelId_status_idx" ON "LaborOrder"("parcelId", "status");
