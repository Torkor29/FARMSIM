-- CreateTable
CREATE TABLE "FuturesContract" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sellerId" TEXT NOT NULL,
    "commodity" TEXT NOT NULL,
    "tons" REAL NOT NULL,
    "pricePerTon" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueAt" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "settledAt" DATETIME,
    "marketAtDue" REAL,
    CONSTRAINT "FuturesContract_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "FuturesContract_sellerId_status_idx" ON "FuturesContract"("sellerId", "status");

-- CreateIndex
CREATE INDEX "FuturesContract_status_dueAt_idx" ON "FuturesContract"("status", "dueAt");
