-- CreateTable
CREATE TABLE "MarketListing" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sellerId" TEXT NOT NULL,
    "commodity" TEXT NOT NULL,
    "tons" REAL NOT NULL,
    "pricePerTon" REAL NOT NULL,
    "moisture" REAL NOT NULL DEFAULT 0.12,
    "quality" INTEGER NOT NULL DEFAULT 3,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME NOT NULL,
    "buyerId" TEXT,
    "soldAt" DATETIME,
    CONSTRAINT "MarketListing_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MarketListing_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "MarketListing_status_commodity_idx" ON "MarketListing"("status", "commodity");
