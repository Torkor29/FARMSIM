-- SQLite : livraisons après achat à la criée (le stock n'arrive pas tout seul).
CREATE TABLE "Delivery" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sellerId" TEXT NOT NULL,
    "buyerId" TEXT NOT NULL,
    "buyerFarmId" TEXT NOT NULL,
    "listingId" TEXT,
    "commodity" TEXT NOT NULL,
    "tons" REAL NOT NULL,
    "moisture" REAL NOT NULL DEFAULT 0.12,
    "quality" INTEGER NOT NULL DEFAULT 3,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueAt" DATETIME NOT NULL,
    "autoFee" REAL NOT NULL,
    "deliveredAt" DATETIME,
    CONSTRAINT "Delivery_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Delivery_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "Delivery_buyerId_status_idx" ON "Delivery"("buyerId", "status");
CREATE INDEX "Delivery_sellerId_status_idx" ON "Delivery"("sellerId", "status");
CREATE INDEX "Delivery_status_dueAt_idx" ON "Delivery"("status", "dueAt");
